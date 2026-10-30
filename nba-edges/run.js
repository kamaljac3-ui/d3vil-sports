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
const MODEL_VERSION=process.env.MODEL_VERSION||"2026-10-29-market";
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
// Out/Doubtful players (a Set of name keys); out.status maps every listed player to his status, so picks on players who
// are Questionable / Day-To-Day / Probable can be tagged and graded (ESPN keeps no history, so this can only be learned live)
async function injuries(g){
  const j=await get(`${ESPN}/summary?event=${g.id}`);const out=new Set();out.status=new Map();
  for(const t of (j&&j.injuries)||[])for(const i of t.injuries||[]){const k=nk(i.athlete&&i.athlete.displayName);out.status.set(k,i.status||"");
    if(/^(out|doubtful)$/i.test(i.status||""))out.add(k);}
  return out;
}
// PRA line vs the sum of the points, rebounds and assists lines (only when those markets are pulled too, which costs 3
// more credits a game: NBA_PROP_MARKETS=pra,pts,reb,ast). Positive = the PRA line sits below the sum. Logged, not traded on.
const COMP_GAP=+(process.env.COMP_GAP||2);
const compGap=(lines,key,stat)=>{const l=lines&&lines[key];if(stat!=="pra"||!l||l.pra==null||l.pts==null||l.reb==null||l.ast==null)return null;return Math.round((l.pts+l.reb+l.ast-l.pra)*10)/10;};
const injTag=st=>st&&/questionable|day-to-day|probable/i.test(st)?st.toLowerCase():null;
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
// A pull is reused for PROPS_TTL_H hours (the PRA board's 1:30 PM pull serves the evening's pregame alerts), so a game
// costs ~2 credits: the board/pregame pull and the closing-line pull (fresh=true).
const PROPS_TTL_H=+(process.env.PROPS_TTL_H||8);
async function propBook(g,fresh=false){
  if(!ODDS_KEY||!PROP_MARKETS.length)return null;
  if(!fresh&&g.id in BOOK_MEMO)return BOOK_MEMO[g.id];
  if(!fresh){const hit=cached(`book-${g.id}.json`,PROPS_TTL_H);if(hit){log(`${label(g)}: props from a pull ${Math.round((Date.now()-hit.at)/6e4)} min old`);
    // pulls cached before the consensus fallback existed get it added here
    for(const k in hit.offers)for(const st in hit.offers[k])if(!hit.offers[k][st].some(o=>o.key==="consensus"))hit.offers[k][st].push(...consensusOffers(hit.offers[k][st]));
    return BOOK_MEMO[g.id]=hit;}}
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
  for(const k in offers)for(const s in offers[k])offers[k][s].push(...consensusOffers(offers[k][s]));
  return BOOK_MEMO[g.id]=store(`book-${g.id}.json`,{at:Date.now(),lines,offers});
}
// Fallback "sharp" line when Pinnacle (or another sharp book) doesn't price a prop: the other US books' no-vig price,
// averaged at the number most of them post. Your own books are left out so FanDuel isn't graded against itself.
// sharp.js tries the real sharp books first; "consensus" is appended last (Odds API has no book by that name).
if(!SH.SHARP.includes("consensus"))SH.SHARP.push("consensus");
const implied=ml=>ml<0?-ml/(-ml+100):100/(ml+100),toAmerican=p=>p>=0.5?Math.round(-100*p/(1-p)):Math.round(100*(1-p)/p);
function consensusOffers(list){
  const byL={};
  for(const o of list){if(SH.MINE.includes(o.key)||SH.SHARP.includes(o.key))continue;(byL[o.L]=byL[o.L]||{})[o.key]=(byL[o.L][o.key]||{});byL[o.L][o.key][o.side]=o.price;}
  let best=null;
  for(const [L,books] of Object.entries(byL)){const q=Object.values(books).filter(b=>b.A!=null&&b.B!=null).map(b=>implied(b.A)/(implied(b.A)+implied(b.B)));
    if(q.length>=2&&(!best||q.length>best.n))best={L:+L,n:q.length,p:q.reduce((a,x)=>a+x,0)/q.length};}
  if(!best)return [];
  const t=`US-book no-vig (${best.n})`;
  return [{key:"consensus",title:t,side:"A",L:best.L,price:toAmerican(best.p)},{key:"consensus",title:t,side:"B",L:best.L,price:toAmerican(1-best.p)}];
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
  // meetingBox (head-to-head) wrote flat {player: PRA} files under this same name from 2026-10-28 until 2026-10-29;
  // only the per-team shape (every value an array) counts as a hit, anything else is refetched
  const key=`box-${id}.json`;const hit=cached(key,24*400);if(hit&&Object.values(hit).every(Array.isArray))return hit;
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
  // pra-<id>, not box-<id>: that name is boxScore's per-team cache (DvP)
  const key=`pra-${id}.json`;const hit=cached(key,24*400);if(hit)return hit;
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
// This team's earlier games this season -> {key: {mins, missed, gp}} for model.recentInputs (last-3 minutes, first game
// back, returning star). Built from the cached box scores (boxScore), the same way backtest.js does it.
const HIST={};
async function teamHist(espnAbbr,before){
  const id=espnAbbr+"|"+String(before).slice(0,10);if(HIST[id])return HIST[id];
  const {games}=await ratings(),list=games.filter(x=>(x.home===espnAbbr||x.away===espnAbbr)&&x.date<before&&x.id);
  const h={};let n=0;
  for(const m of list){
    const b=await boxScore(m.id),mine=b&&b[espnAbbr];if(!mine)continue;
    for(const p of mine){if(!(p.min>0))continue;const k=nk(p.name),x=h[k]||(h[k]={mins:[],last:-1,gp:0});x.mins.push(p.min);x.last=n;x.gp++;}
    n++;
  }
  for(const k in h)h[k].missed=n-1-h[k].last;
  return HIST[id]=h;
}
// one side's roster as model inputs (exported: nba-news projects with it too, so its numbers match the board's)
async function teamFor(g,side,D,outKeys=new Set()){
  const team=(await roster(g[side].espnId)).map(n=>D.players[nk(n)]).filter(Boolean);
  let h={};try{h=await teamHist(g[side].espnAbbr,g.date);}catch(e){log("recent minutes skipped:",e.message);}
  return M.recentInputs(team,h,outKeys);
}
async function sideRows(g,side,D,outKeys,lines){
  const team=await teamFor(g,side,D,outKeys);
  const S=projectSide(team,g,side,D,outKeys),rows=flagRows(S,lines),rest=await restOf(g,side);
  // every projected player's calibrated numbers, for the model column next to a 💰 price
  rows.proj=Object.fromEntries(S.players.map(x=>[x.p.key,Object.fromEntries(STATS.map(st=>[st,M.calibrate(st,x.pr[st],x.p[AVG[st]],x.p.MIN)]))]));
  // rest and dvp ride along on every logged pick so results/track.js can grade them, tagged or not
  const opp=g[side==="home"?"away":"home"].abbr;
  for(const r of rows){const t=[...r.tags],dv=await dvpOf(D,g,side,r.key),h=await h2hOf(g,D,r.key);if(rest===1)t.push("b2b 2nd night");if(dv&&dv.show)t.push(dv.text);
    if(h&&h.diff<=-H2H_COLD)t.push(`cold vs ${opp}: ${h.diff} PRA over ${h.n} mtgs`);
    const st=outKeys.status&&outKeys.status.get(r.key);if(injTag(st))t.push(injTag(st));
    const pp=S.players.find(x=>x.p.key===r.key);if(pp&&pp.p.back)t.push("first game back");if(pp&&pp.p.starBack)t.push("star teammate back");
    r.back=pp?pp.p.back||0:0;r.starBack=!!(pp&&pp.p.starBack);r.min3=pp?pp.p.MIN3:null;
    r.tags=t;r.rest=isFinite(rest)?rest:null;r.dvp=dv&&{pos:dv.pos,rank:dv.rank,of:dv.of,pct:dv.pct};r.h2h=h;r.inj=st||null;
    r.compGap=compGap(lines,r.key,r.stat);if(r.compGap!=null&&Math.abs(r.compGap)>=COMP_GAP)t.push(`PRA line ${Math.abs(r.compGap)} ${r.compGap>0?"below":"above"} P+R+A lines`);}
  rows.S=S;rows.rest=rest;   // the PRA board reads every projected player, not just the flagged ones
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
  const tags=[...(boost.out.length?[`w/o ${boost.out.map(n=>n.replace(/s+(Jr.?|Sr.?|II|III|IV)$/i,"").split(" ").slice(-1)[0]).join(", ")}`]:[]),...(env>=1.04?["high team total"]:[]),...(blowout?["blowout risk"]:[]),...(dog?[`${spread>0?"+":""}${spread} underdog`]:[])];
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
    const b=await propBook(g,true),lines=b&&b.lines;if(!lines)continue;
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
  return {rows,line,ev,H,A,book,out};
}
// ---------- PRA board: the slate's top BOARD_N PRA bets, with the facts behind each ----------
// Ranked by expected value at your book's price (MY_BOOKS, FanDuel), using the calibrated model probability; the facts
// (last 5, season, minutes, last meetings, sharp price, tags) are context, not part of the ranking. Sent once a day by
// the first pregame run after BOARD_HOUR ET (or MODE=board), from the same props pull the pregame alerts reuse.
const BOARD_N=+(process.env.BOARD_N||10),BOARD_HOUR=+(process.env.BOARD_HOUR||13),BOARD_MIN_GAP=+(process.env.BOARD_MIN_GAP||2.5);
// weight on the model vs the market's no-vig chance (0.5 = even); both are logged so the weekly review can fit it
const BOARD_MARKET_W=+(process.env.BOARD_MARKET_W||0.5);
const payout=ml=>ml>0?ml/100:100/-ml;
const etHour=()=>+new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"numeric",hourCycle:"h23"}).format(new Date());
// this team's last n finished games this season: [{date, opp, box (name key -> PRA)}]
async function teamLast(espnAbbr,before,n=5){
  const {games}=await ratings(),mine=games.filter(x=>(x.home===espnAbbr||x.away===espnAbbr)&&x.date<before&&x.id).slice(-n),out=[];
  for(const m of mine){const b=await meetingBox(m.id);if(b)out.push({date:m.date,opp:m.home===espnAbbr?m.away:m.home,box:b});}
  return out;
}
async function boardRows(g,D){
  const x=await gameRows(g,D,true);if(!x.book)return [];
  const rows=[];
  for(const [side,R] of [["home",x.H],["away",x.A]]){
    const S=R.S,opp=g[side==="home"?"away":"home"],last=await teamLast(g[side].espnAbbr,g.date);
    for(const {p,pr} of S.players){
      if(x.out.has(p.key))continue;
      const offers=(x.book.offers[p.key]||{}).pra||[],med=x.book.lines[p.key]&&x.book.lines[p.key].pra;if(med==null)continue;
      const proj=M.calibrate("pra",pr.pra,p.PRA,p.MIN);
      // Both sides at your book's own numbers (MY_BOOKS, FanDuel). The model's chance is blended with the market's no-vig
      // chance of that exact bet (Pinnacle, else the other US books' consensus without your book) at BOARD_MARKET_W; a bet
      // makes the board if the model is BOARD_MIN_GAP+ off the line with +EV, or if the market alone says your book is
      // stale (MIN_EV_PROPS+) and the model doesn't disagree. Players your book doesn't list are skipped (you can't bet them).
      const fairs=SH.staleTwoWay(offers,{sigma:M.sdOf("pra",med),maxGap:EV_MAX_GAP,minEV:-1});
      let best=null;
      for(const o of offers.filter(o=>SH.MINE.includes(o.key))){
        const L=o.L,price=o.price,po=M.pOver(proj,L,"pra"),mp=o.side==="A"?po:1-po;
        const f=fairs.find(y=>y.key===o.key&&y.side===o.side&&y.L===L),kp=f?f.fair:null;
        const bp=kp!=null?BOARD_MARKET_W*mp+(1-BOARD_MARKET_W)*kp:mp,ev=bp*payout(price)-(1-bp),kev=kp!=null?kp*payout(price)-(1-kp):null;
        const modelPick=Math.abs(proj-L)>=BOARD_MIN_GAP&&(o.side==="A")===(proj>L),marketPick=kev!=null&&kev>=MIN_EV_PROPS&&mp>=0.5;
        if(!(modelPick||marketPick)||ev<=0)continue;
        // how much easier your number is than the market's, in your direction (+ = softer at your book)
        const soft=f?(o.side==="A"?f.sharp.L-L:L-f.sharp.L):null;
        if(!best||ev>best.ev)best={side:o.side,L,price,book:o.title,mp,kp,bp,ev,kev,soft,sharp:f?{book:f.sharp.title,L:f.sharp.L}:null,why:modelPick&&marketPick?"both":modelPick?"model":"market"};
      }
      if(!best)continue;
      const L=best.L,price=best.price,lean=best.side,po=M.pOver(proj,L,"pra"),prob=best.bp,ev=best.ev;
      const fair=best.kp!=null?{p:best.kp,book:best.sharp.book,L:best.sharp.L}:null;
      const l5=last.map(m=>m.box[p.key]),played=l5.filter(v=>v!=null),hits=played.filter(v=>lean==="A"?v>L:v<L).length;
      const h=await h2hOf(g,D,p.key),dv=await dvpOf(D,g,side,p.key);
      const st=x.out.status&&x.out.status.get(p.key),cg=compGap(x.book.lines,p.key,"pra");
      const tags=[...S.tags,...(R.rest===1?["b2b 2nd night"]:[]),...(dv&&dv.show?[dv.text]:[]),...(h&&h.diff<=-H2H_COLD?[`cold vs ${opp.abbr}`]:[]),...(injTag(st)?[injTag(st)]:[]),
        ...(best.soft!=null&&best.soft>=1?[`💰 ${best.book} ${best.soft} softer than ${best.sharp.book}`]:[]),...(p.back?["first game back"]:[]),...(p.starBack?["star teammate back"]:[]),...(cg!=null&&Math.abs(cg)>=COMP_GAP?[`PRA line ${Math.abs(cg)} ${cg>0?"below":"above"} P+R+A lines`]:[])];
      rows.push({kind:"prop",stat:"pra",name:p.name,key:p.key,team:S.me,opp:S.opp,mpg:p.MIN,minProj:pr.min,proj,projRaw:pr.pra,avg:p.PRA,line:L,po,price,
        book:best.book,prob,ev,modelP:best.mp,mktP:best.kp,mktEV:best.kev,soft:best.soft,why:best.why,fair,l5,hits,games:played.length,h2h:h,tags,
        rest:isFinite(R.rest)?R.rest:null,dvp:dv&&{pos:dv.pos,rank:dv.rank,of:dv.of,pct:dv.pct},inj:st||null,compGap:cg,back:p.back||0,starBack:!!p.starBack,min3:p.MIN3,gameId:g.id,tip:g.date});
    }
  }
  return rows;
}
const boardLine=(r,i)=>{
  const side=r.po>=0.5?"o":"u",l5=r.l5.map(v=>v==null?"–":v).join(" ");
  return `${i+1}. ${r.name} (${r.team}) vs ${r.opp}: PRA ${side}${r.line} ${SH.fmt(r.price)} ${r.book}\n`+
    `   proj ${f1(r.proj)} · model ${pct(r.modelP)}`+(r.fair?` · ${r.fair.book} ${r.fair.L} ${pct(r.fair.p)}`:"")+` → ${pct(r.prob)}, +${(r.ev*100).toFixed(0)}% EV`+(r.why==="market"?" (market pick)":"")+`\n`+
    `   L5 ${l5}${r.games?` (${r.hits}/${r.games} ${side==="o"?"over":"under"})`:""} · avg ${f1(r.avg)} · ${Math.round(r.minProj)} min`+
    (r.h2h?` · last ${r.h2h.n} vs ${r.opp}: ${r.h2h.diff>=0?"+":""}${r.h2h.diff} vs avg`:"")+(r.tags.length?`\n   ${r.tags.join("; ")}`:"");
};
// A compact copy of the board goes to a second ntfy topic (NTFY_TOPIC + BOARD_DATA_SUFFIX, not subscribed on the phone),
// where nba-news reads it when a late Out lands, to send a "Board update" for the picks on that team.
const BOARD_DATA_SUFFIX=process.env.BOARD_DATA_SUFFIX||"-board";
async function publishBoard(top){
  if(DRY||!NTFY_TOPIC||!top.length)return;
  const data={date:TODAY,at:new Date().toISOString(),model:MODEL_VERSION,picks:top.map((r,i)=>({i:i+1,k:r.key,n:r.name,t:r.team,gid:r.gameId,
    s:r.po>=0.5?"o":"u",L:r.line,price:r.price,proj:+r.proj.toFixed(2),prob:+r.prob.toFixed(3)}))};
  const h={"Content-Type":"application/json"};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  const r=await fetch(NTFY_SERVER,{method:"POST",headers:h,body:JSON.stringify({topic:NTFY_TOPIC+BOARD_DATA_SUFFIX,title:"board-data",message:JSON.stringify(data),priority:1})}).catch(e=>({status:e.message}));
  log("board data",r.status);
}
// Saturday parlay (PARLAY_DAYS, ET weekday names): the best PARLAY_LEGS legs from different games among the board's
// candidates, each at its blended chance and your book's price (nfl-props/parlay.js, shared with the NFL Sunday parlay).
const PL=require("../nfl-props/parlay.js");
const PARLAY_LEGS=+(process.env.PARLAY_LEGS||5),PARLAY_DAYS=(process.env.PARLAY_DAYS||"Sat").split(",").map(x=>x.trim());
const etWeekday=()=>new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short"}).format(process.env.DATE?new Date(process.env.DATE+"T17:00:00Z"):new Date());
function parlayOf(rows){
  if(!PARLAY_DAYS.includes(etWeekday())&&process.env.PARLAY_FORCE!=="1")return null;
  return PL.build(rows.map(r=>({...r,game:r.gameId,p:r.prob})),PARLAY_LEGS);
}
const parlayText=pl=>`🎯 ${pl.n}-leg parlay, one leg per game (${pl.legs[0].book})\n`+
  pl.legs.map((l,i)=>`${i+1}. ${l.name} (${l.team}) PRA ${l.po>=0.5?"o":"u"}${l.line} ${SH.fmt(l.price)} · ${pct(l.prob)}${l.soft!=null&&l.soft>=1?" 💰":""}`).join("\n")+`\n${PL.summary(pl)}`;
// the read-aloud "Jackson 5" script for the parlay (second push), up to two plain reasons per leg from its facts
const DAYS={Sun:"Sunday",Mon:"Monday",Tue:"Tuesday",Wed:"Wednesday",Thu:"Thursday",Fri:"Friday",Sat:"Saturday"};
function nbaLegSpeech(l){
  const over=l.po>=0.5,why=[],wo=l.tags.find(t=>t.startsWith("w/o "));
  if(l.soft!=null&&l.soft>=1)why.push(`${l.book}'s number is ${PL.spokenLine(l.soft)} ${l.soft===1?"point":"points"} easier than the other books.`);
  if(wo&&over)why.push(`With ${wo.slice(4).split(", ").join(" and ")} out, there's more for him.`);
  if(!over&&l.min3!=null&&l.mpg-l.min3>=4)why.push(`His minutes are way down lately, about ${PL.words(Math.round(l.min3))} a night.`);
  if(l.tags.includes("first game back"))why.push("It's his first game back, so his minutes could be limited.");
  if(l.games>=3)why.push(l.hits===l.games?`He's gone ${over?"over":"under"} that in all of his last ${PL.words(l.games)}.`:`He's gone ${over?"over":"under"} that in ${PL.words(l.hits)} of his last ${PL.words(l.games)}.`);
  why.push(`I got him at ${PL.words(Math.round(l.proj))}.`);
  return {who:l.name,bet:`${over?"over":"under"} ${PL.spokenLine(l.line)} points, rebounds and assists`,why};
}
// ---------- NBA Short script (Mon/Wed/Fri, right after the board): 5 PRA picks in KJ's voice for the cloned-voice Short ----------
// Format follows the 48th State Shorts scout (one-line VOICEOVER for TTS, ~110-140 words, numbers written out) and KJ's
// voice rules (~/.claude/skills/picks-video-overlay/show-scripts/kj_voice.md): everyday NY, one or two touches ("let's be
// real", "stop playing with me", "guy"), one dry one-liner, never "keep it a hundred", never a "lock" or a guarantee.
const SHORT_DAYS=(process.env.SHORT_DAYS||"Mon,Wed,Fri").split(",").map(x=>x.trim());
// fresh one-liners for the picks Shorts (not in kj_voice.md's used list); rotated by date, swap any you've used
const SHORT_ONELINERS=[
  "Five legs? Nah. Five separate bets. I've been hurt before.",
  "My last parlay died on one assist. One. I still hear it at night.",
  "I asked FanDuel for a soft line. They gave me one. Then I bet the other side.",
  "Rebounds are the easy part. Getting paid is the hard part.",
  "I told my bookie I'm on a heater. He said I live in Phoenix. Everybody's on a heater.",
  "My overs hit so rarely, the under sends me a thank-you note.",
  "I don't chase. I just jog behind it. Real slow.",
  "Bankroll management? I manage it. Straight to zero. Very organized."];
const lastName=n=>n.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i,"").split(" ").slice(-1)[0];
function shortPicks(top){
  // names people know first (22+ min or 18+ PRA a night), then the rest; 💰 and market-agrees picks first; max 2 a game
  const known=r=>r.mpg>=22||r.avg>=18,pref=r=>(known(r)?4:0)+(r.soft!=null&&r.soft>=1?2:0)+(r.mktP!=null&&r.mktP>=0.5?1:0);
  const out=[],perGame={};
  for(const r of top.slice().sort((a,b)=>pref(b)-pref(a)||b.ev-a.ev)){if((perGame[r.gameId]||0)>=2)continue;perGame[r.gameId]=(perGame[r.gameId]||0)+1;out.push(r);if(out.length>=5)break;}
  return out;
}
// a few wordings per reason, so five picks never repeat the same line
const SHORT_WHY={
  // "stop playing with me" only once a script: it's the punch
  soft:[r=>`${r.book}'s ${PL.spokenLine(r.soft)} easier than everybody else. Stop playing with me.`,r=>`Every other book is ${PL.spokenLine(r.soft)} higher. Come on.`,
    r=>`${r.book} is a step behind on this one.`,r=>`Softest number in town. We'll take it.`],
  out:[(r,n)=>`${n} out. Somebody's eating. It's him.`,(r,n)=>`No ${n} tonight. More touches, more everything.`],
  mins:[r=>`His minutes fell off a cliff.`,r=>`They cut his minutes, and the line didn't notice.`,r=>`He's barely playing lately. Easy.`],
  hits:[r=>`He's cleared it in ${PL.words(r.hits)} of his last ${PL.words(r.games)}.`,r=>`${PL.words(r.hits)} of his last ${PL.words(r.games)}. You see the pattern.`],
  proj:[r=>`I got him at ${PL.words(Math.round(r.proj))}.`,r=>`I see ${PL.words(Math.round(r.proj))} tonight. Respectfully.`]};
// KJ owns the picks (kamal, Oct 30): never "the computer/model picked"; lead with "I'm riding with" and say his confidence,
// the pick's chance clamped to 60-70 percent
const SHORT_LEAD=["I'm riding with","Give me","I like","Put me down for","I'm on"];
const SHORT_CONF=[c=>`I'm ${c} percent on that.`,c=>`${cap(c)} percent confident.`,c=>`Call it ${c} percent.`,c=>`I'm ${c} percent there.`,c=>`${cap(c)} percent. I'm comfortable.`];
const shortConf=r=>PL.words(Math.min(70,Math.max(60,Math.round(r.prob*100))));
const cap=x=>x.charAt(0).toUpperCase()+x.slice(1);
function shortLines(picks){
  const used={};const take=(k,...a)=>{const i=used[k]||0;used[k]=i+1;return SHORT_WHY[k][i%SHORT_WHY[k].length](...a);};
  return picks.map((r,i)=>{
    const over=r.po>=0.5,wo=r.tags.find(t=>t.startsWith("w/o "));
    const why=r.soft!=null&&r.soft>=1?take("soft",r):wo&&over?take("out",r,wo.slice(4).split(", ").join(" and ")):
      !over&&r.min3!=null&&r.mpg-r.min3>=4?take("mins",r):r.games>=4&&r.hits>=r.games-1?take("hits",r):take("proj",r);
    return `${SHORT_LEAD[i%SHORT_LEAD.length]} ${r.name}, ${over?"over":"under"} ${PL.spokenLine(r.line)}. ${why} ${SHORT_CONF[i%SHORT_CONF.length](shortConf(r))}`;
  });
}
// The Short as data: the scout-format fields plus shorts.py build settings for KJ's approved "Matrix meets sports" look
// (bg "matrix", sport "nba": rain -> LED jumbotron -> blue CRT -> tracking cam, a glitch on every cut; palette and opening
// scene vary by date). Written to nba-edges/.out/short-<date>.json, uploaded as the run's "nba-short" artifact, and appended
// to KJ's OneDrive "YYYY-MM-DD shorts.txt" by his local "NBA Short to Shorts file" task so make_audio.py voices it.
// "retro" = the 8-bit Double Dribble-style court slide (kamal, Oct 29), so some Shorts open on it
const SHORT_PALETTES=["blue","crimson","purple","emerald","amber","teal","magenta"],SHORT_FIRST=["rain","led","retro","crt","track"];
function shortData(cands,games){
  const picks=shortPicks(cands);if(picks.length<5)return null;
  const day=DAYS[etWeekday()]||etWeekday(),soft=picks.some(r=>r.soft!=null&&r.soft>=1);
  const hook=soft?`Five P-R-A bets tonight. Let's be real, the books left one wide open.`:`Five P-R-A bets tonight. Let's be real, this ${day} slate is loaded.`;
  const doy=Math.floor((Date.parse(TODAY)-Date.parse(TODAY.slice(0,4)+"-01-01"))/864e5),joke=SHORT_ONELINERS[doy%SHORT_ONELINERS.length];
  const voiceover=[hook,"Points, rebounds and assists, all combined.",...shortLines(picks),joke,`${lastName(picks[0].name)}: you riding or fading? Comments.`,
    "Twenty-one and up, bet responsible. Newsletters, link's in the bio. We out."].join(" ");
  const md=new Date(TODAY+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
  const side=r=>r.po>=0.5?"o":"u",LN=r=>lastName(r.name).toUpperCase();
  const beats=picks.map(r=>`${LN(r)} ${side(r).toUpperCase()}${r.line} PRA ${SH.fmt(r.price)}${r.soft!=null&&r.soft>=1?" 💰":""}`);
  const tags=["nba player props","nba props tonight","nba picks tonight","pra props","nba bets",...picks.slice(0,3).map(r=>r.name.toLowerCase()+" props")];
  const hashtags=["#shorts","#nba","#nbapicks","#playerprops","#sportsbetting","#nbabets"];
  return {date:TODAY,day,model:MODEL_VERSION,title:`NBA Player Props Tonight: 5 PRA Bets (${day} ${md})`,hook,voiceover,words:voiceover.split(/\s+/).length,
    onscreen:beats,tags,description:`KJ's 5 PRA bets for tonight, shopped against the other books. Not a guarantee. 21+, bet responsibly. Newsletters: link in bio. ${hashtags.join(" ")}`,
    pinned:`${lastName(picks[0].name)} over or under tonight? Wrong answers only. 👇`,
    tiktok:`5 PRA bets for tonight's NBA slate. ${lastName(picks[0].name)}: riding or fading? 👇 Newsletters: link in bio. #nba #nbapicks #playerprops #nbabets #sportsbetting`,
    pronunciation:`P-R-A = "P R A" (letters). Check: ${picks.map(r=>r.name).join(", ")}`,oneLiner:joke,
    picks:picks.map(r=>({name:r.name,team:r.team,opp:r.opp,side:side(r)==="o"?"over":"under",line:r.line,price:r.price,book:r.book,proj:+r.proj.toFixed(1),
      chance:+r.prob.toFixed(3),market:r.mktP==null?null:+r.mktP.toFixed(3),softer:r.soft})),
    // glitch "surveillance" = the Enemy of the State spy-feed scrambles (NBA picks Shorts only; KJ's other Shorts keep "cut");
    // avatar = KJ in the NWA-style shades from his Oct 25 Jets rant (path relative to the OneDrive "48th State Shorts" folder)
    build:{bg:"matrix",sport:"nba",glitch:"surveillance",retro:true,avatar:"assets/kj_avatar_shades_frame.png",avatar_crop:[330,840,480],
      palette:SHORT_PALETTES[doy%SHORT_PALETTES.length],first:SHORT_FIRST[doy%SHORT_FIRST.length],
      tag:"NBA PROPS",headline:["5 PRA BETS",`${day.toUpperCase()} NIGHT`],
      // real lines for the LED jumbotron and the CRT screen (never filler stats)
      data:picks.flatMap(r=>[`${LN(r)} ${r.team} vs ${r.opp}  PRA ${side(r).toUpperCase()}${r.line}  ${SH.fmt(r.price)} ${r.book.toUpperCase()}`,
        `${LN(r)}  PROJ ${r.proj.toFixed(1)}  CHANCE ${Math.round(r.prob*100)}%${r.mktP!=null?`  MKT ${Math.round(r.mktP*100)}%`:""}`]),
      stats:[{title:"TONIGHT'S 5 PRA",items:picks.map(r=>[`${side(r).toUpperCase()}${r.line}`,LN(r)])}],
      ticker:{week_label:`NBA ${day.toUpperCase()}`,badge_sub:"PRA PICKS",sport:"NBA",games:games.map(g=>({away:g.away.abbr,home:g.home.abbr,
        line:g.homeSpread==null?"":`${g.home.abbr} ${g.homeSpread>0?"+":""}${g.homeSpread}`,total:g.total==null?"--":String(g.total)}))}}};
}
function shortText(d){
  return [`YouTube title: ${d.title}`,`Hook: ${d.hook}`,`VOICEOVER (${d.words} words, ~${Math.round(d.words/150*60)} s; paste into the voice tool):`,d.voiceover,
    `On-screen text: ${d.onscreen.join(" | ")}`,`Tags: ${d.tags.join(", ")}`,`Description: ${d.description}`,`Pinned comment: ${d.pinned}`,
    `Pronunciation: ${d.pronunciation}`,`One-liner from the rotating bank (swap it if you've used it): "${d.oneLiner}"`,
    `Look: Matrix meets sports, NBA, ${d.build.palette} palette, opens on ${d.build.first}, surveillance glitch, shades avatar. It lands in today's shorts.txt for make_audio.py.`].join("\n\n");
}
const OUT=path.join(__dirname,".out");
async function board(games,D){
  const key=`board-${TODAY}.json`;if(cached(key,30)&&!DRY&&MODE!=="board")return;
  if(!ODDS_KEY){log("PRA board needs ODDS_API_KEY");return;}
  let rows=[];for(const g of games)rows=rows.concat(await boardRows(g,D));
  // one bet per player (his best side/number), best EV first
  const seen=new Set(),top=rows.sort((a,b)=>b.ev-a.ev).filter(r=>!seen.has(r.key)&&seen.add(r.key)).slice(0,BOARD_N);
  const msg=top.length?top.map(boardLine).join("\n")+`\n\nRanked by EV at your book's price, from a ${Math.round(BOARD_MARKET_W*100)}/${Math.round((1-BOARD_MARKET_W)*100)} blend of the model and the market's no-vig chance (Pinnacle, else the other US books without yours). 💰 = your book's number is softer than the market's. The model alone isn't proven vs closing lines yet.`
    :"No PRA bet clears the bar on this slate.";
  const pl=parlayOf(rows);
  if(PARLAY_DAYS.includes(etWeekday())||process.env.PARLAY_FORCE==="1")log(pl?`parlay: ${pl.n} legs, ${pl.american}, chance ${(pl.p*100).toFixed(1)}%`:`parlay: fewer than ${PARLAY_LEGS} games with a candidate leg`);
  await ntfy(`NBA PRA board ${TODAY} (${games.length} games)${pl?" + 🎯 parlay":""}`,msg+(pl?"\n\n"+parlayText(pl):""),top.length?4:2,["basketball","trophy"]);
  // the read-aloud Jackson 5 script is NFL-Sunday only now (Kamal, Oct 29); the NBA Short covers Mon/Wed/Fri
  if(SHORT_DAYS.includes(etWeekday())||process.env.SHORT_FORCE==="1"){const one=new Set(),cands=rows.slice().sort((x,y)=>y.ev-x.ev).filter(r=>!one.has(r.key)&&one.add(r.key));const d=shortData(cands,games),sc=d&&shortText(d);
    if(d){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,`short-${TODAY}.json`),JSON.stringify(d,null,1));}   // every qualifying bet, not just the top 10, so it can reach names people know
    if(sc)await ntfy(`🎬 NBA Short script: ${DAYS[etWeekday()]||etWeekday()}`,sc,3,["clapper"]);else log("Short script: fewer than 5 board picks");}
  logPicks("board",[["PRA board","prop",top]]);await publishBoard(top);
  // the parlay is logged as one pick (kind "parlay") with its legs; results/track.js grades it leg by leg
  if(pl)logPicks("board",[["parlay","parlay",[{kind:"parlay",key:"parlay",gameId:"multi",stat:String(pl.n),name:`${pl.n}-leg PRA parlay`,
    legs:pl.legs.map(l=>({key:l.key,name:l.name,team:l.team,gameId:l.gameId,stat:"pra",side:l.po>=0.5?"o":"u",line:l.line,price:l.price,p:+l.prob.toFixed(3)})),
    decimal:+pl.decimal.toFixed(3),american:pl.american,p:+pl.p.toFixed(4),ev:+pl.ev.toFixed(3)}]]]);
  if(!DRY&&NTFY_TOPIC)store(key,true);
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
module.exports={nba,nbaSeason,blend,projectSide,flagRows,teamFor,evRows,evMessage,propBook,MODEL_VERSION,nk,ESPN_TO_NBA,loadData,slate,roster,TODAY,SETTINGS:{ZONE_MIN,BOOST_MIN,ABS_MIN,P_MIN,STATS,AVG}};
if(require.main===module)(async()=>{
  if(MODE==="probe")return probe();
  if(MODE==="snapshot")return snapshot();
  const games=await slate();log(`${TODAY}: ${games.length} upcoming games, mode=${MODE}`);
  if(!games.length)return;
  const D=await loadData();
  if(MODE==="board")return board(games,D);
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
    // the PRA board goes out once a day, from the first pregame run after BOARD_HOUR ET (crons can run late, so no own cron)
    if(etHour()>=BOARD_HOUR)await board(games,D);
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
