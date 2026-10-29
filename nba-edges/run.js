// NBA Edges: daily slate scan + ntfy alerts.
// MODE=morning  -> whole slate, one push with the top shot-zone and projection edges, then every game's line vs model (lines.js)
// MODE=pregame  -> games tipping within PREGAME_MIN minutes: fresh injuries (+ prop lines if ODDS_API_KEY), one push per game (sent once)
// MODE=snapshot -> save stats.nba.com data to data/nba-stats.json (run on a PC; GitHub runners can't reach nba.com)
// MODE=probe    -> report which data sources this machine can reach
const fs=require("fs"),path=require("path");
const M=require("./model"),LN=require("./lines");

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
const CLOSE_LINES=process.env.CLOSE_LINES!=="0",CLOSE_WINDOW=+(process.env.CLOSE_WINDOW||45);  // closing-line capture, see captureCloses
// tagged on every logged pick so results/track.js can grade each model version separately; bump it on any model change
const MODEL_VERSION=process.env.MODEL_VERSION||"2026-10-28-ev";
const ABS_MIN={pra:3,pts:2,reb:1,ast:1,fg3m:0.5};
// PRA (points + rebounds + assists) first: it's Kamal's main bet. Its average is the PRA field (withPRA below).
const STATS=["pra","pts","reb","ast","fg3m"],AVG={pra:"PRA",pts:"PTS",reb:"REB",ast:"AST",fg3m:"FG3M"},LABEL={pra:"PRA",pts:"PTS",reb:"REB",ast:"AST",fg3m:"3PM"};
const withPRA=D=>{for(const k in D.players){const p=D.players[k];p.PRA=(p.PTS||0)+(p.REB||0)+(p.AST||0);}return D;};
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
  return withPRA(out);
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
  const hit=cached(`data-${CUR.nba}.json`,12);if(hit)return withPRA(hit);
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
  return store(`data-${CUR.nba}.json`,withPRA(D));
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
// ---------- prop lines and prices (The Odds API, optional ODDS_API_KEY) ----------
// The key is on the free tier (500 credits/month). Since 2026-10-29 the NFL bots use SportsGameOdds (NFL_ODDS=sgo), so
// the key is this bot's; it still keeps a monthly budget (NBA_ODDS_BUDGET) and stops at NBA_ODDS_RESERVE left.
// A call costs (markets x regions); asking for <= 10 named bookmakers counts as one region. By default only PRA is
// pulled (Kamal's main bet, 1 credit a game); NBA_PROP_MARKETS=pra,pts,reb,ast,fg3m pulls everything (5 a game).
const ODDS_BUDGET=+(process.env.NBA_ODDS_BUDGET||450),ODDS_RESERVE=+(process.env.NBA_ODDS_RESERVE||25);
const MKT_OF={pra:"player_points_rebounds_assists",pts:"player_points",reb:"player_rebounds",ast:"player_assists",fg3m:"player_threes"};
const PROP_MARKETS=(process.env.NBA_PROP_MARKETS||"pra").split(",").map(s=>s.trim()).filter(s=>MKT_OF[s]);
const MKT=Object.fromEntries(PROP_MARKETS.map(s=>[MKT_OF[s],s]));
// stale-line finder (shared with the NFL bots, read-only): your books (MY_BOOKS, FanDuel) vs the sharp book's no-vig price
const SH=require("../nfl-props/sharp.js");
const MIN_EV_PROPS=+(process.env.MIN_EV_PROPS||0.03),EV_MAX_GAP=+(process.env.EV_MAX_GAP||2);
// the sharp book + your books + enough US books for a median line, 10 at most (one region)
const LINE_BOOKS=(process.env.NBA_LINE_BOOKS||"draftkings,betmgm,williamhill_us,fanatics,betrivers,espnbet").split(",").map(s=>s.trim()).filter(Boolean);
const BOOKS=[...new Set([...SH.SHARP,...SH.MINE,...LINE_BOOKS])].filter(b=>b!=="consensus").slice(0,10);
const oddsUsageKey=()=>`odds-usage-${TODAY.slice(0,7)}.json`;
async function oddsGet(url,cost,what){
  const u=cached(oddsUsageKey(),24*40)||{used:0,remaining:null};
  if(u.used+cost>ODDS_BUDGET||(u.remaining!=null&&u.remaining-cost<ODDS_RESERVE)){
    log(`Odds API budget: skipping ${what} (NBA used ${u.used}/${ODDS_BUDGET} this month, ${u.remaining??"?"} left on the key, reserve ${ODDS_RESERVE})`);return null;}
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(30000)});
    const last=+r.headers.get("x-requests-last")||0,rem=r.headers.get("x-requests-remaining");
    if(last||rem!=null){u.used+=last;if(rem!=null)u.remaining=+rem;store(oddsUsageKey(),u);}   // credits are real even on dry runs
    if(!r.ok){log("Odds API HTTP",r.status,what);return null;}
    log(`Odds API: ${what} (${last} credits; NBA ${u.used}/${ODDS_BUDGET} this month, ${u.remaining??"?"} left on the key)`);
    return r.json();
  }catch(e){log("Odds API error",e.message,what);return null;}
}
// {lines: {key: {stat: median line}}, offers: {key: {stat: [{key: book, title, side A=over/B=under, L, price}]}}}
const BOOK_MEMO={};
async function propBook(g){
  if(!ODDS_KEY||!PROP_MARKETS.length)return null;
  if(g.id in BOOK_MEMO)return BOOK_MEMO[g.id];
  let ev=cached(`odds-events-${TODAY}.json`,3);   // listing events costs nothing
  if(!ev)ev=store(`odds-events-${TODAY}.json`,await get(`https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey=${ODDS_KEY}`)||[]);
  const e=ev.find(x=>x.home_team.endsWith(g.home.name)&&x.away_team.endsWith(g.away.name));if(!e)return BOOK_MEMO[g.id]=null;
  const j=await oddsGet(`https://api.the-odds-api.com/v4/sports/basketball_nba/events/${e.id}/odds?apiKey=${ODDS_KEY}&bookmakers=${BOOKS.join(",")}&oddsFormat=american&markets=${Object.keys(MKT).join(",")}`,
    Object.keys(MKT).length,`${label(g)} props`);
  if(!j)return BOOK_MEMO[g.id]=null;
  const acc={},offers={};
  for(const b of j.bookmakers||[])for(const m of b.markets||[])for(const o of m.outcomes||[]){
    const s=MKT[m.key];if(!s||o.point==null||!/^(Over|Under)$/.test(o.name))continue;const k=nk(o.description);
    ((offers[k]=offers[k]||{})[s]=offers[k][s]||[]).push({key:b.key,title:b.title,side:o.name==="Over"?"A":"B",L:o.point,price:o.price});
    if(o.name==="Over")((acc[k]=acc[k]||{})[s]=acc[k][s]||[]).push(o.point);}
  const med=a=>{a=a.slice().sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
  const lines={};for(const k in acc){lines[k]={};for(const s in acc[k])lines[k][s]=med(acc[k][s]);}
  return BOOK_MEMO[g.id]={lines,offers};
}
async function propLines(g){const b=await propBook(g);return b&&b.lines;}
// 💰 rows: a price at your books worth MIN_EV_PROPS+ against the sharp book's no-vig line (spread = the model's own sd)
function evRows(g,D,book,players){
  const out=[];if(!book)return out;
  for(const k in book.offers)for(const s in book.offers[k]){
    const list=book.offers[k][s],L0=book.lines[k]&&book.lines[k][s];if(L0==null)continue;
    const hits=SH.bestPerSide(SH.staleTwoWay(list,{sigma:M.sdOf(s,L0),maxGap:EV_MAX_GAP,minEV:MIN_EV_PROPS}));
    const pl=D.players[k],pr=players[k];
    for(const h of hits){
      const over=h.side==="A",mp=pr&&pr[s]!=null?M.pOver(pr[s],h.L,s):null;
      out.push({kind:"ev",name:pl?pl.name:k,key:k,team:pl?pl.team:"",stat:s,side:over?"over":"under",line:h.L,price:h.price,book:h.title,
        fair:h.fair,ev:h.ev,sharp:{book:h.sharp.title,L:h.sharp.L,over:h.sharp.A.price,under:h.sharp.B.price},
        model:mp==null?null:(over?mp:1-mp),proj:pr?pr[s]:null,gameId:g.id,tip:g.date,tags:[]});
    }
  }
  return out.sort((a,b)=>b.ev-a.ev);
}

// ---------- game lines: spread and total (lines.js; backtest in BACKTEST-LINES.md) ----------
// The backtest found no edge against closing lines at any size of disagreement (spreads ~50-53%, totals lose). Against
// the opening line spreads did better (55-60%), but that leans on knowing who sat, and the bot sees the 11 AM line, not
// the open. So every game shows line vs model with no ✅ (SPREAD_EDGES=1 / TOTAL_EDGES=1 turn them on), and spreads off
// by MIN_SPREAD+ are still logged as tracked picks: results/track.js grades them against the result and the closing
// line, which is what will show whether a morning disagreement is worth anything.
const SPREAD_EDGES=process.env.SPREAD_EDGES==="1",TOTAL_EDGES=process.env.TOTAL_EDGES==="1";
const MIN_SPREAD=+(process.env.MIN_SPREAD||4),MIN_TOTAL=+(process.env.MIN_TOTAL||6);
const TEAM_IDS=[1,2,17,30,4,5,6,7,8,9,10,11,12,13,29,14,15,16,3,18,25,19,20,21,22,23,24,28,26,27];
// a season's finished regular-season games from the 30 ESPN team schedules
async function seasonResults(y,maxAgeH){
  // v2 key: older caches were saved without game ids, which the head-to-head boxes need
  const key=`results2-${y}.json`;const hit=cached(key,maxAgeH);if(hit)return hit;
  const byId={};
  for(let i=0;i<TEAM_IDS.length;i+=6)await Promise.all(TEAM_IDS.slice(i,i+6).map(async id=>{
    const j=await get(`${ESPN}/teams/${id}/schedule?season=${y}&seasontype=2`);
    for(const e of (j&&j.events)||[]){const c=e.competitions[0];if(!c.status||!c.status.type.completed)continue;
      const t=h=>c.competitors.find(x=>x.homeAway===h),H=t("home"),A=t("away");
      byId[e.id]={id:e.id,date:e.date,home:H.team.abbreviation,away:A.team.abbreviation,hs:+H.score.value,as:+A.score.value};}
  }));
  const games=Object.values(byId).filter(g=>g.hs>0&&g.as>0).sort((a,b)=>a.date<b.date?-1:1);
  return games.length?store(key,games):games;
}
let RATINGS=null;
async function ratings(){
  if(RATINGS)return RATINGS;
  const prev=await seasonResults(CUR.espn-1,24*30),cur=await seasonResults(CUR.espn,4),now=new Date().toISOString();
  const prior=prev.length?LN.fitRatings(prev,prev[prev.length-1].date,null):null;
  const played=cur.filter(g=>g.date<now);
  log(`game ratings: ${played.length} games this season, prior from ${prev.length} last season`);
  return RATINGS={games:played,prev,R:LN.fitRatings(played,now,prior)};
}
// ---------- defense context (informational tags only, never in a projection) ----------
// The 2024-26 backtest: players facing a bottom-3 defense vs their position beat their own average by ~0.7 pts more than
// vs a top-3 one, but the projection (game total / pace) already carried that; adding the factor didn't help out of sample.
const DVP_RANK=+(process.env.DVP_RANK||3),DVP_MIN_GP=+(process.env.DVP_MIN_GP||10),DEF_MIN_GP=+(process.env.DEF_MIN_GP||5);
const POSG={PG:"G",SG:"G",G:"G",SF:"F",PF:"F",F:"F",C:"C"},POSN={G:"guards",F:"forwards",C:"centers"};
const ord=n=>n+(n%100>=11&&n%100<=13?"th":["th","st","nd","rd"][n%10]||"th");
// one finished game's box: {ESPN abbr: [{name,pos,min,pts}]}; finished games never change, so it's cached for good
async function boxScore(id){
  const key=`box-${id}.json`;const hit=cached(key,24*400);if(hit)return hit;
  const s=await get(`${ESPN}/summary?event=${id}`);if(!s||!s.boxscore||!s.boxscore.players)return null;
  const box={};
  for(const t of s.boxscore.players){const g=t.statistics[0],L=g.labels;
    box[t.team.abbreviation]=(g.athletes||[]).filter(a=>a.stats&&a.stats.length).map(a=>({name:a.athlete.displayName,
      pos:POSG[a.athlete.position&&a.athlete.position.abbreviation]||null,min:parseInt(a.stats[L.indexOf("MIN")])||0,pts:+a.stats[L.indexOf("PTS")]||0}));}
  return store(key,box);
}
// points each defense allows to guards/forwards/centers vs those players' own per-minute averages -> rank (1 = allows least)
let DVP=null;
async function dvp(D){
  if(DVP)return DVP;
  const {games}=await ratings(),def={},pos={};
  const ids=games.filter(g=>g.id).map(g=>g.id);
  for(let i=0;i<ids.length;i+=6){const boxes=await Promise.all(ids.slice(i,i+6).map(boxScore));
    for(const b of boxes){if(!b)continue;const t=Object.keys(b);if(t.length!==2)continue;
      for(const [me,opp] of [[t[0],t[1]],[t[1],t[0]]])for(const x of b[me]){const p=D.players[nk(x.name)];if(x.pos)pos[nk(x.name)]=x.pos;
        if(!x.pos||!p||!(p.MIN>=8)||!(x.min>0))continue;
        const c=((def[opp]=def[opp]||{gp:0})[x.pos]=def[opp][x.pos]||{a:0,e:0});c.a+=x.pts;c.e+=p.PTS*x.min/p.MIN;}
      for(const tm of t)if(def[tm])def[tm].gp++;}}
  const rank={};
  for(const q of ["G","F","C"]){const L=Object.entries(def).filter(([,d])=>d.gp>=DVP_MIN_GP&&d[q]&&d[q].e>0).map(([tm,d])=>[tm,d[q].a/d[q].e]).sort((a,b)=>a[1]-b[1]);
    L.forEach(([tm,r],i)=>{(rank[tm]=rank[tm]||{})[q]={rank:i+1,of:L.length,ratio:r};});}
  log(`defense vs position: ${ids.length} games, ${Object.keys(rank).length} teams ranked`);
  return DVP={rank,pos};
}
// the opponent's rank vs this player's position; show = top/bottom DVP_RANK (the tag), the rest is logged only
async function dvpOf(D,g,side,key){
  try{const {rank,pos}=await dvp(D),q=pos[key],opp=g[side==="home"?"away":"home"],r=q&&rank[opp.espnAbbr]&&rank[opp.espnAbbr][q];
    if(!r)return null;const d=Math.round((r.ratio-1)*100);
    return {pos:q,rank:r.rank,of:r.of,pct:d,show:r.rank<=DVP_RANK||r.rank>r.of-DVP_RANK,text:`${opp.abbr} ${ord(r.rank)} of ${r.of} vs ${POSN[q]} (${d>=0?"+":""}${d}% pts)`};}
  catch(e){return null;}
}
// points allowed per game this season (rank, 1 = fewest) and over the last 10
function defenseLine(games,team){
  const L=games.filter(g=>g.home===team||g.away===team);if(L.length<DEF_MIN_GP)return null;
  const pa=g=>g.home===team?g.as:g.hs,avg=a=>a.reduce((s,g)=>s+pa(g),0)/a.length;
  const all={};for(const g of games)for(const t of [g.home,g.away])(all[t]=all[t]||[]).push(g);
  const ranked=Object.entries(all).filter(([,a])=>a.length>=DEF_MIN_GP).map(([t,a])=>[t,a.reduce((s,g)=>s+(g.home===t?g.as:g.hs),0)/a.length]).sort((a,b)=>a[1]-b[1]);
  return {n:L.length,pa:avg(L),l10:avg(L.slice(-10)),rank:ranked.findIndex(x=>x[0]===team)+1,of:ranked.length};
}
// one game's line vs model; out = Set of name keys ruled out (both teams)
async function lineRow(g,D,out){
  const {games,R}=await ratings(),ctx={};
  for(const side of ["home","away"]){
    const team=(await roster(g[side].espnId)).map(n=>D.players[nk(n)]).filter(Boolean),teamGP=Math.max(0,...team.map(p=>p.gpCur||0));
    ctx[side==="home"?"outH":"outA"]=LN.outValue(team.filter(p=>out.has(p.key)),teamGP);
    ctx[side==="home"?"restH":"restA"]=LN.restDays(games,g[side].espnAbbr,g.date);
  }
  const pr=LN.predict({home:g.home.espnAbbr,away:g.away.espnAbbr},R,ctx);
  const row={kind:"lines",key:"game",gameId:g.id,tip:g.date,home:g.home.abbr,away:g.away.abbr,proj:pr.margin,projTotal:pr.total,
    homeSpread:g.homeSpread,total:g.total,b2b:[ctx.restH===1?g.home.abbr:null,ctx.restA===1?g.away.abbr:null].filter(Boolean),picks:[],
    def:{away:defenseLine(games,g.away.espnAbbr),home:defenseLine(games,g.home.espnAbbr)}};
  if(g.homeSpread!=null){const e=pr.margin+g.homeSpread;   // model home margin minus the market's (-homeSpread)
    if(Math.abs(e)>=MIN_SPREAD)row.picks.push({kind:"spread",side:e>0?"home":"away",team:e>0?g.home.abbr:g.away.abbr,line:e>0?g.homeSpread:-g.homeSpread,edge:Math.abs(e),tick:SPREAD_EDGES});}
  if(g.total!=null&&TOTAL_EDGES){const e=pr.total-g.total;
    if(Math.abs(e)>=MIN_TOTAL)row.picks.push({kind:"total",side:e>0?"over":"under",line:g.total,edge:Math.abs(e),tick:true});}
  return row;
}
const sgn=v=>(v>0?"+":"")+(Math.round(v*2)/2);   // spreads to the half point
function lineText(r){
  const mkt=r.homeSpread!=null?`${r.home} ${sgn(r.homeSpread)}`:"no line",mt=r.total!=null?`, o/u ${r.total}`:"";
  const apart=r.homeSpread!=null?` (${f1(Math.abs(r.proj+r.homeSpread))} apart)`:"";
  const ticks=r.picks.filter(p=>p.tick).map(p=>p.kind==="spread"?` ✅ ${p.team} ${sgn(p.line)}`:` ✅ ${p.side} ${p.line}`).join("");
  const dl=t=>{const d=r.def&&r.def[t==="away"?"away":"home"];return d&&`${r[t]} ${ord(d.rank)} (${f1(d.pa)}${d.n>10?`, L10 ${f1(d.l10)}`:""})`;};
  const dd=[dl("away"),dl("home")].filter(Boolean),def=dd.length?`
   pts allowed/g (1st = fewest): ${dd.join(", ")}`:"";
  return `${r.away} @ ${r.home}: ${mkt}${mt} | model ${r.home} ${sgn(-r.proj)}${apart}, ${f1(r.projTotal)}${r.b2b.length?` [b2b: ${r.b2b.join(", ")}]`:""}${ticks}${def}`;
}
const linesMessage=rows=>rows.length?`Game lines (model vs line; no proven edge yet, see BACKTEST-LINES.md)\n`+rows.map(lineText).join("\n"):"";

// ---------- scoring ----------
// Head-to-head (informational tag only). In the 2024-26 box scores a player's PRA over his last 5 meetings with tonight's
// opponent barely predicts tonight (+0.06 PRA per point of H2H gap, both seasons). The one part that repeated: players
// 5+ PRA BELOW their average vs this team came in ~1 PRA under their projection and went under a stand-in line 56%/58%
// of the time (vs 49%/52% for everyone). Team H2H vs the closing line was nothing (spread slope -0.10/-0.07). So: tag the
// cold side, log h2h on every pick, let the weekly review grade it.
const H2H_N=+(process.env.H2H_N||5),H2H_COLD=+(process.env.H2H_COLD||5);
async function meetingBox(id){
  const key=`box-${id}.json`;const hit=cached(key,24*400);if(hit)return hit;
  const s=await get(`${ESPN}/summary?event=${id}`);if(!s||!s.boxscore)return null;
  const out={};
  for(const t of s.boxscore.players||[])for(const g of t.statistics||[]){const L=g.labels||[];
    for(const a of g.athletes||[]){if(a.didNotPlay||!a.stats||!a.stats.length)continue;const v=k=>+a.stats[L.indexOf(k)]||0;
      out[nk(a.athlete.displayName)]=v("PTS")+v("REB")+v("AST");}}
  return store(key,out);
}
// {n, diff}: this player's PRA in his last H2H_N games vs tonight's opponent (this season and last), minus his average now
const H2H={};
async function h2hOf(g,D,key){
  const pair=[g.home.espnAbbr,g.away.espnAbbr].sort().join("|");
  if(!H2H[pair]){
    try{const {games,prev}=await ratings();
      const meet=[...prev,...games].filter(x=>[x.home,x.away].sort().join("|")===pair&&x.date<g.date&&x.id).slice(-H2H_N);
      H2H[pair]=[];for(const m of meet){const b=await meetingBox(m.id);if(b)H2H[pair].push(b);}}
    catch(e){H2H[pair]=[];}
  }
  const p=D.players[key],v=H2H[pair].map(b=>b[key]).filter(x=>x!=null);
  if(!p||v.length<2)return null;
  return {n:v.length,diff:Math.round((v.reduce((a,x)=>a+x,0)/v.length-p.PRA)*10)/10};
}
async function sideRows(g,side,D,outKeys,lines){
  const team=(await roster(g[side].espnId)).map(n=>D.players[nk(n)]).filter(Boolean);
  const S=projectSide(team,g,side,D,outKeys),rows=flagRows(S,lines),rest=await restOf(g,side);
  // every projected player's calibrated numbers, for the model column next to a 💰 price
  rows.proj=Object.fromEntries(S.players.map(x=>[x.p.key,Object.fromEntries(STATS.map(st=>[st,M.calibrate(st,x.pr[st],x.p[AVG[st]],x.p.MIN)]))]));
  // rest and dvp ride along on every logged pick so results/track.js can grade them, tagged or not
  const opp=g[side==="home"?"away":"home"].abbr;
  for(const r of rows){const t=[...r.tags],dv=await dvpOf(D,g,side,r.key),h=await h2hOf(g,D,r.key);if(rest===1)t.push("b2b 2nd night");if(dv&&dv.show)t.push(dv.text);
    if(h&&h.diff<=-H2H_COLD)t.push(`cold vs ${opp}: ${h.diff} PRA over ${h.n} mtgs`);
    r.tags=t;r.rest=isFinite(rest)?rest:null;r.dvp=dv&&{pos:dv.pos,rank:dv.rank,of:dv.of,pct:dv.pct};r.h2h=h;}
  return rows;
}
// Informational tag only, never in the projection: in the 2024-26 box scores regulars who played the 2nd night of a
// back-to-back scored right at their projection (and a player's own b2b split barely repeated year to year), but sat
// 21% of the time vs 16% otherwise. So the risk is a late rest day, not a cold night.
async function restOf(g,side){
  try{const {games}=await ratings();return LN.restDays(games.filter(x=>x.date<g.date),g[side].espnAbbr,g.date);}
  catch(e){return null;}
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
  // this team's spread (negative = favorite) drives the blowout minutes in model.project (starters down at 12+, an 8+
  // underdog's rotation and bench up)
  const spread=g.homeSpread!=null?(side==="home"?g.homeSpread:-g.homeSpread):null,blowout=spread!=null&&Math.abs(spread)>=M.BLOW.starterSpread;
  const dog=spread!=null&&spread>=M.BLOW.dogSpread;
  const tags=[...(boost.out.length?[`w/o ${boost.out.map(n=>n.split(" ").slice(-1)[0]).join(", ")}`]:[]),...(env>=1.04?["high team total"]:[]),...(blowout?["blowout risk"]:[]),...(dog?[`${spread>0?"+":""}${spread} underdog`]:[])];
  const players=[];
  for(const p of team){
    if(outKeys.has(p.key)||p.MIN<minProj)continue;
    const zone=p.zones&&O.oppZones&&lg.zones?M.zoneMatchup(p.zones,p.gpEff||p.GP,O.oppZones,lg.zones):null;
    const b=ob.forPlayer(p);   // teammate-out multipliers are per player now
    players.push({p,zone,boost:b,pr:M.project(p,{zone,env,oppReb,oppAst,spread,blowout,boost:b})});
  }
  return {me:me.abbr,opp:op.abbr,tags,ctx:{env,oppReb,oppAst,spread,blowout},players};
}
// the alert rows: shot-zone edges, prop-line edges (with lines) or projection boosts (without)
function flagRows(side,lines){
  const rows=[];
  for(const {p,zone,pr} of side.players){
    const base={name:p.name,key:p.key,team:side.me,opp:side.opp,tags:side.tags,mpg:p.MIN,minProj:pr.min};
    if(zone&&zone.delta>=ZONE_MIN&&p.PTS>=10)rows.push({kind:"zone",...base,stat:"pts",delta:zone.delta,best:zone.best,proj:pr.pts,avg:p.PTS});
    for(const s of STATS){
      // flags use the calibrated projection (model.calibrate: starters' gap shrunk, high averages pulled back)
      const avg=p[AVG[s]],projRaw=pr[s],proj=M.calibrate(s,projRaw,avg,p.MIN),line=lines&&lines[p.key]&&lines[p.key][s];
      if(line!=null){const po=M.pOver(proj,line,s);if((po>=P_MIN||po<=1-P_MIN)&&Math.abs(proj-line)>=ABS_MIN[s])rows.push({kind:"prop",...base,stat:s,proj,projRaw,avg,line,po});}
      else if(avg>0&&proj/avg-1>=BOOST_MIN&&proj-avg>=ABS_MIN[s])rows.push({kind:"boost",...base,stat:s,proj,projRaw,avg});
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
const EV_TOP=+(process.env.EV_TOP||5);
const evLine=r=>`${r.name}${r.team?` (${r.team})`:""} ${LABEL[r.stat]} ${r.side==="over"?"o":"u"}${r.line} ${SH.fmt(r.price)} at ${r.book}: fair ${pct(r.fair)}, +${(r.ev*100).toFixed(1)}% EV vs ${r.sharp.book} ${r.sharp.L} ${SH.fmt(r.sharp.over)}/${SH.fmt(r.sharp.under)}${r.model!=null?`; model ${pct(r.model)}`:""}`;
const evMessage=rows=>rows.length?`💰 ${SH.MINE.length===1?rows[0].book:"Your books"} vs sharp no-vig\n`+rows.slice(0,EV_TOP).map((r,i)=>`${i+1}. ${evLine(r)}`).join("\n"):"";
const message=secs=>secs.map(([t,k,l])=>`${t}\n`+l.map((r,i)=>`${i+1}. ${LINE[k](r)}`).join("\n")).join("\n\n");
// picks results/track.js grades later; only alerts that were really sent (same rule as the sent markers)
function logPicks(mode,secs){
  const rows=secs.flatMap(s=>s[2]);if(DRY||!NTFY_TOPIC||!rows.length)return;
  const key=`picks-${TODAY}.json`,at=new Date().toISOString();
  store(key,(cached(key,24*30)||[]).concat(rows.map(r=>({sport:"nba",date:TODAY,mode,at,model:MODEL_VERSION,...r}))));
}
// Closing line for prop picks already sent: one more Odds API pull per game in the last CLOSE_WINDOW minutes before
// tip, saved as `close` on those picks (results/track.js reports how often picks beat it). CLOSE_LINES=0 turns it off.
async function captureCloses(games){
  if(!ODDS_KEY||!CLOSE_LINES||DRY)return;
  const key=`picks-${TODAY}.json`,picks=cached(key,24*30);if(!picks)return;
  let changed=false;
  for(const g of games){
    const mins=(new Date(g.date)-Date.now())/6e4;if(mins>CLOSE_WINDOW||mins<0)continue;
    const mine=picks.filter(p=>p.gameId===g.id&&(p.kind==="prop"||p.kind==="ev")&&p.close==null);if(!mine.length)continue;
    const lines=await propLines(g);if(!lines)continue;
    for(const p of mine){const c=lines[p.key]&&lines[p.key][p.stat];if(c!=null){p.close=c;p.closeAt=new Date().toISOString();changed=true;}}
    log(`${label(g)}: closing lines for ${mine.filter(p=>p.close!=null).length}/${mine.length} props`);
  }
  if(changed)store(key,picks);
}

async function ntfy(title,message,priority=3,tags=["basketball"]){
  if(DRY||!NTFY_TOPIC){log("DRY ntfy:",title,"\n"+message);return;}
  const h={"Content-Type":"application/json"};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  const r=await fetch(NTFY_SERVER,{method:"POST",headers:h,body:JSON.stringify({topic:NTFY_TOPIC,title,message:message.slice(0,3900),priority,tags})});
  log("ntfy",r.status);
}
const label=g=>`${g.away.abbr} @ ${g.home.abbr}`;
const tip=g=>new Date(g.date).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"});
// player rows plus the game-lines row (null if the ratings can't be built; the player alerts still go out)
async function gameRows(g,D,withLines){
  const out=await injuries(g),book=withLines?await propBook(g):null,lines=book&&book.lines;
  const H=await sideRows(g,"home",D,out,lines),A=await sideRows(g,"away",D,out,lines);
  const rows=[...H,...A].map(r=>({...r,gameId:g.id,tip:g.date}));
  // 💰: ruled-out players can't be bet, so drop them
  const ev=evRows(g,D,book,{...H.proj,...A.proj}).filter(r=>!out.has(r.key));
  let line=null;try{line=await lineRow(g,D,out);}catch(e){log("game lines skipped:",e.message);}
  return {rows,line,ev};
}
// ✅ game-line picks, logged like the player picks (same sent-only rule) for results/track.js
function logLinePicks(mode,lineRows){
  const picks=lineRows.flatMap(r=>r.picks.map(p=>({sport:"nba",date:TODAY,mode,at:new Date().toISOString(),model:MODEL_VERSION,key:"game",stat:p.kind,
    gameId:r.gameId,tip:r.tip,home:r.home,away:r.away,name:`${r.away} @ ${r.home}`,proj:r.proj,projTotal:r.projTotal,b2b:r.b2b,def:r.def,...p})));
  if(DRY||!NTFY_TOPIC||!picks.length)return;
  const key=`picks-${TODAY}.json`;store(key,(cached(key,24*30)||[]).concat(picks));
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
module.exports={nba,nbaSeason,blend,projectSide,flagRows,evRows,evMessage,nk,ESPN_TO_NBA,loadData,slate,roster,TODAY,SETTINGS:{ZONE_MIN,BOOST_MIN,ABS_MIN,P_MIN,STATS,AVG}};
if(require.main===module)(async()=>{
  if(MODE==="probe")return probe();
  if(MODE==="snapshot")return snapshot();
  const games=await slate();log(`${TODAY}: ${games.length} upcoming games, mode=${MODE}`);
  if(!games.length)return;
  const D=await loadData();
  if(MODE==="morning"){
    const sentKey=`morning-${TODAY}.json`;if(cached(sentKey,30)&&!DRY){log("morning already sent");return;}
    let all=[];const lineRows=[];
    for(const g of games){const x=await gameRows(g,D,ODDS_IN_MORNING);all=all.concat(x.rows);if(x.line)lineRows.push(x.line);}
    const secs=shown(all,TOP_N),ticks=lineRows.some(r=>r.picks.some(p=>p.tick));
    const msg=[message(secs)||"No player edges clear the bar today.",linesMessage(lineRows)].filter(Boolean).join("\n\n");
    await ntfy(`NBA Edges ${TODAY} (${games.length} games)`,msg,all.length||ticks?4:2,["basketball","chart_with_upwards_trend"]);
    logPicks("morning",secs);logLinePicks("morning",lineRows);
    if(!DRY&&NTFY_TOPIC)store(sentKey,true);
  }else{
    const sent=cached(`pregame-${TODAY}.json`,30)||{};
    for(const g of games){
      const mins=(new Date(g.date)-Date.now())/6e4;
      if(sent[g.id]||mins>PREGAME_MIN||mins<-10)continue;
      const x=await gameRows(g,D,true),secs=shown(x.rows,4),pm=message(secs),em=evMessage(x.ev);
      // the game line rides along when the push goes out anyway, or on its own when it has a ✅; 💰 prices go first
      const ln=x.line&&(pm||em||x.line.picks.some(p=>p.tick))?x.line:null,msg=[em,pm,ln?linesMessage([ln]):""].filter(Boolean).join("\n\n");
      if(msg){await ntfy(`${label(g)} ${tip(g)} ET: NBA edges${em?" 💰":""}`,msg,4,["basketball"]);
        logPicks("pregame",[...secs,...(x.ev.length?[["💰","ev",x.ev.slice(0,EV_TOP)]]:[])]);if(ln)logLinePicks("pregame",[ln]);}else log(`${label(g)}: no edges`);
      sent[g.id]=true;
    }
    if(!DRY&&NTFY_TOPIC)store(`pregame-${TODAY}.json`,sent);
    await captureCloses(games);
  }
})().catch(async e=>{console.error(e);await ntfy("NBA Edges bot error",String(e.message||e),2,["warning"]).catch(()=>{});process.exit(1);});
