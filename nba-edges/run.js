// NBA Edges: daily slate scan + ntfy alerts.
// MODE=morning  -> whole slate, one push with the top shot-zone and projection edges
// MODE=pregame  -> games tipping within PREGAME_MIN minutes: fresh injuries (+ prop lines if ODDS_API_KEY), one push per game (sent once)
// MODE=snapshot -> save stats.nba.com data to data/nba-stats.json (run on a PC; GitHub runners can't reach nba.com)
// MODE=probe    -> report which data sources this machine can reach
const fs=require("fs"),path=require("path");
const M=require("./model");

const MODE=process.env.MODE||"morning";
const DRY=process.env.DRY_RUN==="1";
const NTFY_SERVER=(process.env.NTFY_SERVER||"https://ntfy.sh").replace(/\/$/,"");
const NTFY_TOPIC=process.env.NTFY_TOPIC;
const NTFY_TOKEN=process.env.NTFY_TOKEN||"";
const ODDS_KEY=process.env.ODDS_API_KEY||"";
const ODDS_IN_MORNING=process.env.ODDS_IN_MORNING==="1";
const TOP_N=+(process.env.TOP_N||6);
// pts/game gained from the opponent's zone defense. Shot-zone alerts are OFF by default (99): the 2024-26 backtest
// found them noise (flags promised ~+2 pts, got +0.2-0.3). The zone factor still feeds the projections. ZONE_MIN=1 re-enables.
const ZONE_MIN=+(process.env.ZONE_MIN||99);
// only project players averaging at least this many minutes. 10 = bench included: in the 2024-26 backtest, flagged
// bench boosts (almost all "teammate out" spots) beat the player's average 70-77% of the time vs ~48% baseline.
const MIN_PROJ=+(process.env.MIN_PROJ||10);
const BOOST_MIN=+(process.env.BOOST_MIN||0.10);   // projection this far above the player's own average
const P_MIN=+(process.env.P_MIN||0.58);           // model over/under probability vs a posted line
const PREGAME_MIN=+(process.env.PREGAME_MIN||90);
const ABS_MIN={pts:2,reb:1,ast:1,fg3m:0.5};
const STATS=["pts","reb","ast","fg3m"],AVG={pts:"PTS",reb:"REB",ast:"AST",fg3m:"FG3M"},LABEL={pts:"PTS",reb:"REB",ast:"AST",fg3m:"3PM"};
const CACHE=path.join(__dirname,".cache");fs.mkdirSync(CACHE,{recursive:true});
// ESPN 403s custom "bot" agents everywhere and a spoofed Chrome agent from GitHub runners; Node's default agent passes both.
const UA={};
const NBA_H={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36","Referer":"https://www.nba.com/","Origin":"https://www.nba.com","Accept":"application/json, text/plain, */*","x-nba-stats-origin":"stats","x-nba-stats-token":"true"};
const ESPN="https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const ESPN_TO_NBA={GS:"GSW",NY:"NYK",SA:"SAS",NO:"NOP",UTAH:"UTA",WSH:"WAS"};

const etDate=(d=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(d);
const TODAY=process.env.DATE||etDate();
const log=(...a)=>console.log("[nba]",...a);
const sleep=ms=>new Promise(s=>setTimeout(s,ms));
// season a date belongs to: Oct onward is the new season
function seasonOf(date){const y=+date.slice(0,4),m=+date.slice(5,7),s=m>=10?y:y-1;return {nba:`${s}-${String((s+1)%100).padStart(2,"0")}`,espn:s+1};}
const CUR=seasonOf(TODAY),PREV=seasonOf(`${+TODAY.slice(0,4)-1}${TODAY.slice(4)}`);
// name key that matches across ESPN / nba.com / sportsbooks
const nk=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g,"").replace(/[^a-z]/g,"");

// ---------- cache / fetch ----------
function cached(name,maxAgeH){const p=path.join(CACHE,name);if(!fs.existsSync(p))return null;
  try{const d=JSON.parse(fs.readFileSync(p,"utf8"));if((Date.now()-d.at)/36e5<=maxAgeH)return d.v;}catch(e){}return null;}
function store(name,v){fs.writeFileSync(path.join(CACHE,name),JSON.stringify({at:Date.now(),v}));return v;}
async function get(url,headers=UA,tries=3){
  for(let a=0;a<tries;a++){try{const r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(r.ok)return r.json();log("HTTP",r.status,url.replace(/apiKey=[^&]+/,"apiKey=…").slice(0,100));}
    catch(e){log("fetch error",e.message,url.slice(0,60));}await sleep(2000*(a+1));}
  return null;
}

// ---------- stats.nba.com (shot zones, pace, opponent stats) ----------
const NBA_Q="SeasonType=Regular%20Season&PerMode=PerGame&LeagueID=00&Conference=&DateFrom=&Division=&GameScope=&GameSegment=&Location=&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&SeasonSegment=&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=";
// params may include LastNGames=N and DateTo=MM%2FDD%2FYYYY (season-to-date as of that day; the backtest uses it)
async function nba(ep,season,params){
  await sleep(700);
  const def=(params.includes("LastNGames")?"":"LastNGames=0&")+(params.includes("DateTo")?"":"DateTo=&");
  const j=await get(`https://stats.nba.com/stats/${ep}?Season=${season}&${NBA_Q}&${def}${params}`,NBA_H,2);
  if(!j)throw new Error(`stats.nba.com unreachable (${ep})`);
  const rs=Array.isArray(j.resultSets)?j.resultSets[0]:j.resultSets;
  const h=typeof rs.headers[0]==="string"?rs.headers:null;
  return {rows:rs.rowSet,objs:h?rs.rowSet.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]]))):null};
}
async function nbaSeason(s,x=""){   // x: extra params, e.g. "&DateTo=..."
  const base=await nba("leaguedashplayerstats",s,"MeasureType=Base"+x);
  if(!base.rows.length)return null;
  const zones=await nba("leaguedashplayershotlocations",s,"DistanceRange=By%20Zone&MeasureType=Base"+x);
  const tz=await nba("leaguedashteamshotlocations",s,"DistanceRange=By%20Zone&MeasureType=Opponent"+x);
  const adv=await nba("leaguedashteamstats",s,"MeasureType=Advanced"+x);
  const opp=await nba("leaguedashteamstats",s,"MeasureType=Opponent"+x);
  const tb=await nba("leaguedashteamstats",s,"MeasureType=Base"+x);
  const abbr={};for(const p of base.objs)abbr[p.TEAM_ID]=p.TEAM_ABBREVIATION;
  const zByPlayer={};for(const r of zones.rows)zByPlayer[r[0]]=M.zonesFromRow(r,6);
  const players={};
  for(const p of base.objs){const k=nk(p.PLAYER_NAME);
    players[k]={key:k,name:p.PLAYER_NAME,team:p.TEAM_ABBREVIATION,GP:p.GP,MIN:p.MIN,PTS:p.PTS,REB:p.REB,AST:p.AST,FG3M:p.FG3M,FTM:p.FTM,zones:zByPlayer[p.PLAYER_ID]||null};}
  const teams={};
  for(const t of tb.objs)teams[abbr[t.TEAM_ID]||t.TEAM_ID]={gp:t.GP,ppg:t.PTS};
  const T=id=>teams[abbr[id]||id]||(teams[abbr[id]||id]={});
  for(const t of adv.objs)T(t.TEAM_ID).pace=t.PACE;
  for(const t of opp.objs)Object.assign(T(t.TEAM_ID),{oppReb:t.OPP_REB,oppAst:t.OPP_AST});
  for(const r of tz.rows)T(r[0]).oppZones=M.zonesFromRow(r,2);
  return {players,teams,src:"nba.com"};
}
// ---------- ESPN fallback (no shot zones / opponent stats, but keeps projections alive) ----------
async function espnSeason(y){
  const j=await get(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=${y}&seasontype=2&limit=1000`);
  if(!j||!j.athletes||!j.athletes.length)return null;
  const idx={};for(const c of j.categories)idx[c.name]=c.names;
  const val=(a,cat,name)=>{const c=a.categories.find(x=>x.name===cat);const i=idx[cat]?idx[cat].indexOf(name):-1;return c&&i>=0?+c.values[i]:0;};
  const players={},teamPts={};
  for(const a of j.athletes){const k=nk(a.athlete.displayName),team=ESPN_TO_NBA[a.athlete.teamShortName]||a.athlete.teamShortName;
    const p={key:k,name:a.athlete.displayName,GP:val(a,"general","gamesPlayed"),MIN:val(a,"general","avgMinutes"),PTS:val(a,"offensive","avgPoints"),
      REB:val(a,"general","avgRebounds"),AST:val(a,"offensive","avgAssists"),FG3M:val(a,"offensive","avgThreePointFieldGoalsMade"),FTM:val(a,"offensive","avgFreeThrowsMade"),zones:null};
    players[k]=p;if(team){teamPts[team]=teamPts[team]||{pts:0,gp:0};teamPts[team].pts+=p.PTS*p.GP;teamPts[team].gp=Math.max(teamPts[team].gp,p.GP);}}
  const teams={};for(const t in teamPts)if(teamPts[t].gp)teams[t]={gp:teamPts[t].gp,ppg:teamPts[t].pts/teamPts[t].gp};
  return {players,teams,src:"espn"};
}
// early in a season, lean on last season until a player has ~15 games
const PKEYS=["MIN","PTS","REB","AST","FG3M","FTM"],TKEYS=["ppg","pace","oppReb","oppAst"];
function mixZones(a,b,w){if(!a||!b)return a||b||null;const z={};for(const k in a)z[k]={fgm:w*a[k].fgm+(1-w)*b[k].fgm,fga:w*a[k].fga+(1-w)*b[k].fga};return z;}
function mix(c,p,w,keys){const o={};for(const k of keys){const a=c[k],b=p[k];o[k]=a==null?b:b==null?a:w*a+(1-w)*b;}return o;}
function blend(cur,prev){
  const out={players:{},teams:{},src:(cur||prev).src};
  for(const k of new Set([...Object.keys(cur?.players||{}),...Object.keys(prev?.players||{})])){
    const c=cur?.players[k],p=prev?.players[k];
    if(!c||!p){const x=c||p;out.players[k]={...x,gpCur:c?c.GP:0,gpEff:x.GP};continue;}
    const w=Math.min(c.GP/15,1);
    out.players[k]={...c,...mix(c,p,w,PKEYS),gpCur:c.GP,gpEff:c.GP+p.GP*(1-w),zones:mixZones(c.zones,p.zones,w)};
  }
  for(const t of new Set([...Object.keys(cur?.teams||{}),...Object.keys(prev?.teams||{})])){
    const c=cur?.teams[t],p=prev?.teams[t];
    if(!c||!p){out.teams[t]={...(c||p)};continue;}
    const w=Math.min((c.gp||0)/15,1);out.teams[t]={...c,...mix(c,p,w,TKEYS),oppZones:mixZones(c.oppZones,p.oppZones,w)};
  }
  const T=Object.values(out.teams),avg=k=>{const v=T.map(t=>t[k]).filter(x=>x>0);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null;};
  const zt=T.map(t=>t.oppZones).filter(Boolean);
  out.league={pace:avg("pace"),ppg:avg("ppg"),oppReb:avg("oppReb"),oppAst:avg("oppAst"),zones:zt.length>=20?M.leagueZones(zt):null};
  return out;
}
async function fromNbaCom(){
  const cur=await nbaSeason(CUR.nba),prev=await nbaSeason(PREV.nba);
  if(cur){const l10=await nba("leaguedashplayerstats",CUR.nba,"MeasureType=Base&LastNGames=10");
    for(const p of l10.objs){const x=cur.players[nk(p.PLAYER_NAME)];if(x&&x.GP>=3)x.MIN10=p.MIN;}}
  if(!cur&&!prev)throw new Error("stats.nba.com returned no players");
  return blend(cur,prev);
}
// stats.nba.com times out from GitHub runners, so a machine that can reach it (MODE=snapshot)
// commits data/nba-stats.json and the Action reads that instead.
const SNAP=path.join(__dirname,"data","nba-stats.json");
function readSnap(maxAgeH){
  try{const s=JSON.parse(fs.readFileSync(SNAP,"utf8"));const age=(Date.now()-s.at)/36e5;
    if(s.season===CUR.nba&&age<=maxAgeH){log(`using snapshot from ${Math.round(age)}h ago`);return {...s.data,src:"nba.com snapshot"};}}catch(e){}
  return null;
}
async function loadData(){
  const hit=cached(`data-${CUR.nba}.json`,12);if(hit)return hit;
  let D=readSnap(36);
  if(!D&&process.env.FORCE_ESPN!=="1"){try{D=await fromNbaCom();}catch(e){log(e.message);}}
  if(!D)D=readSnap(24*7);
  if(!D){
    log("falling back to ESPN (no shot zones or opponent adjustments)");
    const cur=await espnSeason(CUR.espn),prev=await espnSeason(PREV.espn);
    if(!cur&&!prev)throw new Error("No NBA player stats from stats.nba.com, the snapshot, or ESPN.");
    D=blend(cur,prev);
  }
  log(`stats: ${Object.keys(D.players).length} players, ${Object.keys(D.teams).length} teams via ${D.src}${D.league.zones?"":" (no zone data)"}`);
  return store(`data-${CUR.nba}.json`,D);
}
async function snapshot(){
  const D=await fromNbaCom();
  // keep rotation-ish players only and trim decimals so the daily commit stays small
  for(const k in D.players)if(!(D.players[k].MIN>=8))delete D.players[k];
  const round=(k,v)=>typeof v==="number"?Math.round(v*1000)/1000:v;
  fs.mkdirSync(path.dirname(SNAP),{recursive:true});
  fs.writeFileSync(SNAP,JSON.stringify({season:CUR.nba,at:Date.now(),data:D},round));
  log(`snapshot: ${Object.keys(D.players).length} players, ${Object.keys(D.teams).length} teams -> ${path.relative(process.cwd(),SNAP)} (${Math.round(fs.statSync(SNAP).size/1024)} KB)`);
}

// ---------- ESPN slate / rosters / injuries ----------
async function slate(){
  const j=await get(`${ESPN}/scoreboard?dates=${TODAY.replace(/-/g,"")}`);
  const tm=c=>({espnId:c.team.id,espnAbbr:c.team.abbreviation,abbr:ESPN_TO_NBA[c.team.abbreviation]||c.team.abbreviation,name:c.team.name});
  // an explicit DATE (testing on a past slate) keeps finished games
  return (j&&j.events||[]).filter(e=>(e.status.type.state==="pre"||process.env.DATE)&&[2,3].includes(e.season&&e.season.type)).map(e=>{
    const c=e.competitions[0],side=h=>tm(c.competitors.find(x=>x.homeAway===h)),o=(c.odds||[])[0]||{};
    const g={id:e.id,date:e.date,home:side("home"),away:side("away"),total:o.overUnder||null,homeSpread:null};
    // details looks like "ORL -2.5" (favorite first) or "EVEN"
    const m=/^(\S+)\s+(-?[\d.]+)$/.exec(o.details||"");
    if(o.details==="EVEN")g.homeSpread=0;else if(m)g.homeSpread=m[1]===g.home.espnAbbr?-Math.abs(+m[2]):Math.abs(+m[2]);
    return g;});
}
async function roster(espnId){
  const key=`r-${espnId}-${TODAY}.json`;const hit=cached(key,12);if(hit)return hit;
  const j=await get(`${ESPN}/teams/${espnId}/roster`);
  return store(key,(j&&j.athletes||[]).map(a=>a.displayName||a.fullName));
}
async function injuries(g){
  const j=await get(`${ESPN}/summary?event=${g.id}`);const out=new Set();
  for(const t of (j&&j.injuries)||[])for(const i of t.injuries||[])if(/^(out|doubtful)$/i.test(i.status||""))out.add(nk(i.athlete&&i.athlete.displayName));
  return out;
}
// ---------- prop lines (optional, The Odds API) ----------
const MKT={player_points:"pts",player_rebounds:"reb",player_assists:"ast",player_threes:"fg3m"};
async function propLines(g){
  if(!ODDS_KEY)return null;
  let ev=cached(`odds-events-${TODAY}.json`,3);
  if(!ev)ev=store(`odds-events-${TODAY}.json`,await get(`https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey=${ODDS_KEY}`)||[]);
  const e=ev.find(x=>x.home_team.endsWith(g.home.name)&&x.away_team.endsWith(g.away.name));if(!e)return null;
  const j=await get(`https://api.the-odds-api.com/v4/sports/basketball_nba/events/${e.id}/odds?apiKey=${ODDS_KEY}&regions=us&oddsFormat=american&markets=${Object.keys(MKT).join(",")}`);
  if(!j)return null;const acc={};
  for(const b of j.bookmakers||[])for(const m of b.markets||[])for(const o of m.outcomes||[]){
    if(o.name!=="Over"||o.point==null||!MKT[m.key])continue;const k=nk(o.description);
    ((acc[k]=acc[k]||{})[MKT[m.key]]=acc[k][MKT[m.key]]||[]).push(o.point);}
  const med=a=>{a=a.slice().sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
  const lines={};for(const k in acc){lines[k]={};for(const s in acc[k])lines[k][s]=med(acc[k][s]);}
  return lines;
}

// ---------- scoring ----------
async function sideRows(g,side,D,outKeys,lines){
  const team=(await roster(g[side].espnId)).map(n=>D.players[nk(n)]).filter(Boolean);
  return flagRows(projectSide(team,g,side,D,outKeys),lines);
}
// Pure scoring (also used by backtest.js): project every rotation player on one side of a game.
// team: stat objects for that side's roster; g: {home,away:{abbr},total,homeSpread}; outKeys: Set of ruled-out name keys.
// outOpts: optional teammate-out settings (model.outBoost), used by the backtest grid.
function projectSide(team,g,side,D,outKeys,outOpts,minProj=MIN_PROJ){
  const me=g[side],op=g[side==="home"?"away":"home"],T=D.teams[me.abbr]||{},O=D.teams[op.abbr]||{},lg=D.league;
  const ob=M.outBoost(team,outKeys,Math.max(0,...team.map(p=>p.gpCur||0)),outOpts),boost=ob;
  let env=1;
  if(g.total&&g.homeSpread!=null&&T.ppg){const implied=g.total/2+(side==="home"?-1:1)*g.homeSpread/2;env=M.clamp(implied/T.ppg,0.88,1.12);}
  else if(O.pace&&lg.pace)env=M.clamp(O.pace/lg.pace,0.94,1.06);
  const oppReb=O.oppReb&&lg.oppReb?M.clamp(O.oppReb/lg.oppReb,0.9,1.1):1;
  const oppAst=O.oppAst&&lg.oppAst?M.clamp(O.oppAst/lg.oppAst,0.9,1.1):1;
  const blowout=g.homeSpread!=null&&Math.abs(g.homeSpread)>=12;
  const tags=[...(boost.out.length?[`w/o ${boost.out.map(n=>n.split(" ").slice(-1)[0]).join(", ")}`]:[]),...(env>=1.04?["high team total"]:[]),...(blowout?["blowout risk"]:[])];
  const players=[];
  for(const p of team){
    if(outKeys.has(p.key)||p.MIN<minProj)continue;
    const zone=p.zones&&O.oppZones&&lg.zones?M.zoneMatchup(p.zones,p.gpEff||p.GP,O.oppZones,lg.zones):null;
    const b=ob.forPlayer(p);   // teammate-out multipliers are per player now
    players.push({p,zone,boost:b,pr:M.project(p,{zone,env,oppReb,oppAst,blowout,boost:b})});
  }
  return {me:me.abbr,opp:op.abbr,tags,ctx:{env,oppReb,oppAst,blowout},players};
}
// the alert rows: shot-zone edges, prop-line edges (with lines) or projection boosts (without)
function flagRows(side,lines){
  const rows=[];
  for(const {p,zone,pr} of side.players){
    const base={name:p.name,key:p.key,team:side.me,opp:side.opp,tags:side.tags,mpg:p.MIN};
    if(zone&&zone.delta>=ZONE_MIN&&p.PTS>=10)rows.push({kind:"zone",...base,stat:"pts",delta:zone.delta,best:zone.best,proj:pr.pts,avg:p.PTS});
    for(const s of STATS){
      const proj=pr[s],avg=p[AVG[s]],line=lines&&lines[p.key]&&lines[p.key][s];
      if(line!=null){const po=M.pOver(proj,line,s);if((po>=P_MIN||po<=1-P_MIN)&&Math.abs(proj-line)>=ABS_MIN[s])rows.push({kind:"prop",...base,stat:s,proj,line,po});}
      else if(avg>0&&proj/avg-1>=BOOST_MIN&&proj-avg>=ABS_MIN[s])rows.push({kind:"boost",...base,stat:s,proj,avg});
    }
  }
  return rows;
}
const pct=v=>Math.round(v*100)+"%";
const f1=v=>v.toFixed(1);
const tagStr=r=>r.tags.length?` [${r.tags.join("; ")}]`:"";
const LINE={
  zone:r=>`${r.name} (${r.team}) vs ${r.opp}: +${f1(r.delta)} pts from shot mix; ${r.best.label} ${f1(r.best.fga)} FGA/g, ${r.opp} allows ${pct(r.best.oppPct)} (lg ${pct(r.best.lgPct)})`,
  boost:r=>`${r.name} (${r.team}${r.mpg<20?`, bench ${Math.round(r.mpg)} mpg`:""}) vs ${r.opp}: ${LABEL[r.stat]} proj ${f1(r.proj)} vs ${f1(r.avg)} avg (+${pct(r.proj/r.avg-1)})${tagStr(r)}`,
  prop:r=>`${r.name} (${r.team}) ${LABEL[r.stat]} ${r.po>=0.5?"o":"u"}${r.line}: proj ${f1(r.proj)}, ${pct(r.po>=0.5?r.po:1-r.po)} ${r.po>=0.5?"over":"under"}${tagStr(r)}`};
const rank={zone:r=>r.delta,boost:r=>r.proj/r.avg-1,prop:r=>Math.abs(r.po-0.5)};
// the rows that make it into an alert: top n of each section
const SECTIONS=[["Shot-zone edges","zone"],["Prop lines","prop"],["Projection boosts","boost"]];
const shown=(rows,n)=>SECTIONS.map(([t,k])=>[t,k,rows.filter(r=>r.kind===k).sort((a,b)=>rank[k](b)-rank[k](a)).slice(0,n)]).filter(s=>s[2].length);
const message=secs=>secs.map(([t,k,l])=>`${t}\n`+l.map((r,i)=>`${i+1}. ${LINE[k](r)}`).join("\n")).join("\n\n");
// picks results/track.js grades later; only alerts that were really sent (same rule as the sent markers)
function logPicks(mode,secs){
  const rows=secs.flatMap(s=>s[2]);if(DRY||!NTFY_TOPIC||!rows.length)return;
  const key=`picks-${TODAY}.json`,at=new Date().toISOString();
  store(key,(cached(key,24*30)||[]).concat(rows.map(({tags,...r})=>({sport:"nba",date:TODAY,mode,at,...r}))));
}

async function ntfy(title,message,priority=3,tags=["basketball"]){
  if(DRY||!NTFY_TOPIC){log("DRY ntfy:",title,"\n"+message);return;}
  const h={"Content-Type":"application/json"};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  const r=await fetch(NTFY_SERVER,{method:"POST",headers:h,body:JSON.stringify({topic:NTFY_TOPIC,title,message:message.slice(0,3900),priority,tags})});
  log("ntfy",r.status);
}
const label=g=>`${g.away.abbr} @ ${g.home.abbr}`;
const tip=g=>new Date(g.date).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"});
async function gameRows(g,D,withLines){
  const out=await injuries(g),lines=withLines?await propLines(g):null;
  return [...await sideRows(g,"home",D,out,lines),...await sideRows(g,"away",D,out,lines)].map(r=>({...r,gameId:g.id,tip:g.date}));
}
// MODE=probe: report which data sources this machine can reach (GitHub runners get blocked by some)
async function probe(){
  const d=TODAY.replace(/-/g,"");
  const tests=[
    ["espn scoreboard (browser UA)",`${ESPN}/scoreboard?dates=${d}`,UA],
    ["espn scoreboard (no UA)",`${ESPN}/scoreboard?dates=${d}`,{}],
    ["espn cdn scoreboard",`https://cdn.espn.com/core/nba/scoreboard?xhr=1&dates=${d}`,UA],
    ["espn core api events",`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events?dates=${d}`,UA],
    ["espn byathlete",`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=${CUR.espn}&seasontype=2&limit=5`,UA],
    ["stats.nba.com player stats",`https://stats.nba.com/stats/leaguedashplayerstats?Season=${CUR.nba}&MeasureType=Base&LastNGames=0&DateTo=&${NBA_Q}`,NBA_H],
    ["stats.nba.com scoreboardv3",`https://stats.nba.com/stats/scoreboardv3?GameDate=${TODAY}&LeagueID=00`,NBA_H],
    ["nba cdn today scoreboard","https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json",UA],
  ];
  for(const [n,u,h] of tests){const t=Date.now();
    try{const r=await fetch(u,{headers:h,signal:AbortSignal.timeout(25000)});const b=await r.text();log(`${r.status} ${n} (${b.length}b, ${Date.now()-t}ms)`);}
    catch(e){log(`FAIL ${n}: ${e.message}`);}}
}
// require()d by backtest.js for the stats fetch and the scoring; only runs the bot when started directly
module.exports={nba,nbaSeason,blend,projectSide,flagRows,nk,ESPN_TO_NBA,SETTINGS:{ZONE_MIN,BOOST_MIN,ABS_MIN,STATS,AVG}};
if(require.main===module)(async()=>{
  if(MODE==="probe")return probe();
  if(MODE==="snapshot")return snapshot();
  const games=await slate();log(`${TODAY}: ${games.length} upcoming games, mode=${MODE}`);
  if(!games.length)return;
  const D=await loadData();
  if(MODE==="morning"){
    const sentKey=`morning-${TODAY}.json`;if(cached(sentKey,30)&&!DRY){log("morning already sent");return;}
    let all=[];for(const g of games)all=all.concat(await gameRows(g,D,ODDS_IN_MORNING));
    const secs=shown(all,TOP_N),msg=message(secs)||"No edges clear the bar today.";
    await ntfy(`NBA Edges ${TODAY} (${games.length} games)`,msg,all.length?4:2,["basketball","chart_with_upwards_trend"]);
    logPicks("morning",secs);
    if(!DRY&&NTFY_TOPIC)store(sentKey,true);
  }else{
    const sent=cached(`pregame-${TODAY}.json`,30)||{};
    for(const g of games){
      const mins=(new Date(g.date)-Date.now())/6e4;
      if(sent[g.id]||mins>PREGAME_MIN||mins<-10)continue;
      const secs=shown(await gameRows(g,D,true),4),msg=message(secs);
      if(msg){await ntfy(`${label(g)} ${tip(g)} ET: NBA edges`,msg,4,["basketball"]);logPicks("pregame",secs);}else log(`${label(g)}: no edges`);
      sent[g.id]=true;
    }
    if(!DRY&&NTFY_TOPIC)store(`pregame-${TODAY}.json`,sent);
  }
})().catch(async e=>{console.error(e);await ntfy("NBA Edges bot error",String(e.message||e),2,["warning"]).catch(()=>{});process.exit(1);});
