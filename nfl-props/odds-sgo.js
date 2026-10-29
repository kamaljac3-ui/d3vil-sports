// NFL lines and prices from SportsGameOdds (sportsgameodds.com, free "Amateur" tier), with the same exports and output
// shapes as odds.js (The Odds API), so nfl-props and nfl-lines don't change. odds.js hands over to this file when
// SPORTSGAMEODDS_KEY is set and NFL_ODDS=sgo. That frees the shared Odds API key (500 credits/month) for nba-edges.
//   GET https://api.sportsgameodds.com/v2/events?leagueID=NFL&oddsAvailable=true&...   header x-api-key
//   odds keyed by oddID "{statID}-{statEntityID}-{periodID}-{betTypeID}-{sideID}"; per book in odds[id].byBookmaker[book]
//   e.g. receiving_yards-<PLAYER_ID>-game-ou-over, points-home-game-sp-home, points-all-game-ou-over, points-home-game-ml-home
// The free tier counts "entities" per month (an event returned is the likely unit); usage comes from /account/usage, and
// the bot stops at SGO_RESERVE entities left. Events are fetched once per SGO_TTL_MIN minutes per run and reused.
// `node nfl-props/odds-sgo.js` (or the workflow's mode=oddsprobe) prints usage and what the key actually returns.
const {env,envs,log,readState,writeState,normName}=require("./lib");
const {MINE,SHARP}=require("./sharp");

const KEY=process.env.SPORTSGAMEODDS_KEY||"";
const BASE="https://api.sportsgameodds.com/v2";
const STAT={recYds:"receiving_yards",rec:"receiving_receptions",rushYds:"rushing_yards",passYds:"passing_yards"};
const STAT_OF=Object.fromEntries(Object.entries(STAT).map(([k,v])=>[v,k]));
const TTL=env("SGO_TTL_MIN",30),RESERVE=env("SGO_RESERVE",100),AHEAD_H=env("SGO_AHEAD_H",8*24);
// the books to ask for: the sharp reference(s) + your books + a few US books for the median line
const BOOKS=envs("SGO_BOOKMAKERS",[...new Set([...SHARP,...MINE,"draftkings","fanduel","betmgm","caesars","espnbet","betrivers"])].filter(b=>b!=="consensus").join(","));
const TITLE={fanduel:"FanDuel",draftkings:"DraftKings",betmgm:"BetMGM",caesars:"Caesars",espnbet:"ESPN BET",betrivers:"BetRivers",
  pinnacle:"Pinnacle",bovada:"Bovada",unibet:"Unibet",pointsbet:"PointsBet",williamhill:"William Hill",consensus:"Market no-vig (SGO)"};
// same map as odds.js (which requires this file, so it can't be imported from there)
const TEAM={ARI:"Arizona Cardinals",ATL:"Atlanta Falcons",BAL:"Baltimore Ravens",BUF:"Buffalo Bills",CAR:"Carolina Panthers",
  CHI:"Chicago Bears",CIN:"Cincinnati Bengals",CLE:"Cleveland Browns",DAL:"Dallas Cowboys",DEN:"Denver Broncos",DET:"Detroit Lions",
  GB:"Green Bay Packers",HOU:"Houston Texans",IND:"Indianapolis Colts",JAX:"Jacksonville Jaguars",KC:"Kansas City Chiefs",
  LA:"Los Angeles Rams",LAC:"Los Angeles Chargers",LV:"Las Vegas Raiders",MIA:"Miami Dolphins",MIN:"Minnesota Vikings",
  NE:"New England Patriots",NO:"New Orleans Saints",NYG:"New York Giants",NYJ:"New York Jets",PHI:"Philadelphia Eagles",
  PIT:"Pittsburgh Steelers",SEA:"Seattle Seahawks",SF:"San Francisco 49ers",TB:"Tampa Bay Buccaneers",TEN:"Tennessee Titans",
  WAS:"Washington Commanders"};

const enabled=()=>!!KEY;
const num=v=>{const x=parseFloat(String(v==null?"":v).replace("+",""));return isFinite(x)?x:null;};

async function call(path){
  for(let a=0;a<3;a++){
    const r=await fetch(`${BASE}${path}`,{headers:{"x-api-key":KEY},signal:AbortSignal.timeout(45000)}).catch(e=>{log(`SGO fetch error (try ${a+1}/3)`,e.message);return null;});
    if(r&&r.ok)return r.json();
    if(r&&r.status<500&&r.status!==429){log(`SGO ${r.status}: ${(await r.text().catch(()=>"")).slice(0,200)}`);return null;}
    if(r)log(`SGO ${r.status} (try ${a+1}/3)`);
    await new Promise(x=>setTimeout(x,4000*(a+1)));
  }
  return null;
}
// monthly entities used / allowed, from the API (the call itself isn't documented as costing anything)
let USAGE=null;
async function usageNow(){
  if(USAGE)return USAGE;
  const j=await call("/account/usage");const m=j&&j.data&&j.data.rateLimits&&j.data.rateLimits["per-month"];
  USAGE=m?{used:num(m["current-entities"]),max:num(m["max-entities"]),reqUsed:num(m["current-requests"]),reqMax:num(m["max-requests"])}:{used:null,max:null};
  writeState("sgo-usage.json",{...USAGE,at:new Date().toISOString()});
  return USAGE;
}
async function affordable(what){
  const u=await usageNow();
  if(u.max!=null&&u.used!=null&&u.max-u.used<RESERVE){log(`SportsGameOdds: skipping ${what} (${u.used}/${u.max} entities used this month, reserve ${RESERVE})`);return false;}
  return true;
}
// one fetch of upcoming NFL events with odds, reused for SGO_TTL_MIN minutes (all props + game lines come in it)
let CACHE=null;
async function events(){
  if(CACHE&&Date.now()-CACHE.at<TTL*6e4)return CACHE.list;
  if(!await affordable("NFL odds"))return CACHE?CACHE.list:null;
  const now=Date.now(),q=`leagueID=NFL&oddsAvailable=true&includeOpposingOdds=true&bookmakerID=${encodeURIComponent(BOOKS)}`+
    `&startsAfter=${encodeURIComponent(new Date(now-4*36e5).toISOString())}&startsBefore=${encodeURIComponent(new Date(now+AHEAD_H*36e5).toISOString())}&limit=50`;
  const list=[];let cursor=null;
  for(let page=0;page<5;page++){
    const j=await call(`/events?${q}${cursor?`&cursor=${encodeURIComponent(cursor)}`:""}`);if(!j||!j.success)break;
    list.push(...(j.data||[]));cursor=j.nextCursor;if(!cursor)break;
  }
  USAGE=null;   // re-read usage next time
  log(`SportsGameOdds: ${list.length} NFL events with odds`);
  CACHE={at:Date.now(),list};return list;
}
const abbrOf=t=>{if(!t)return null;const long=t.names&&(t.names.long||t.names.medium);return Object.keys(TEAM).find(k=>TEAM[k]===long)||null;};
const startOf=e=>Date.parse((e.status&&e.status.startsAt)||e.startsAt||0);
// player name for a statEntityID: the event's players map if present, else from the ID itself (JOSH_ALLEN_1_NFL)
function playerName(e,id){
  const p=e.players&&e.players[id];if(p)return p.name||[p.firstName,p.lastName].filter(Boolean).join(" ");
  return id.replace(/_NFL$/,"").replace(/_\d+$/,"").replace(/_/g," ").toLowerCase();
}
// every book's offer for one oddID: {key,title,side,L,price}; L from the book's own overUnder/spread
function offersOf(o,side,lineField){
  const out=[];
  for(const [b,x] of Object.entries(o.byBookmaker||{})){
    if(x.available===false)continue;const price=num(x.odds),L=lineField?num(x[lineField]):null;if(price==null||(lineField&&L==null))continue;
    out.push({key:b,title:TITLE[b]||b,side,L,price});
  }
  // SGO's own no-vig consensus as a fallback "sharp" (sharp.js tries the real sharp books first)
  if(o.fairOdds!=null){const L=lineField?num(lineField==="overUnder"?o.fairOverUnder:o.fairSpread):null;
    if(!lineField||L!=null)out.push({key:"consensus",title:TITLE.consensus,side,L,price:num(o.fairOdds)});}
  return out;
}

// ---------- same interface as odds.js ----------
async function eventIds(games){
  const list=await events();if(!list)return {};
  const out={};
  for(const g of games){
    const e=list.find(x=>abbrOf(x.teams&&x.teams.home)===g.home_team&&abbrOf(x.teams&&x.teams.away)===g.away_team&&Math.abs(startOf(x)-g.kick)<12*36e5);
    if(e)out[g.game_id]=e.eventID;
  }
  return out;
}
// {normName: {stat: {line, median, over:{price,book}, under, atMyBook, books, offers, name}}}
function parseProps(e,stats){
  const want=new Set(stats.map(s=>STAT[s]).filter(Boolean)),acc={};
  for(const [id,o] of Object.entries(e.odds||{})){
    if(o.betTypeID!=="ou"||o.periodID!=="game"||!want.has(o.statID)||!o.statEntityID||["all","home","away"].includes(o.statEntityID))continue;
    const stat=STAT_OF[o.statID],name=playerName(e,o.statEntityID),k=normName(name);
    const E=(acc[k]||(acc[k]={}))[stat]||(acc[k][stat]={offers:[],name});
    E.offers.push(...offersOf(o,o.sideID==="over"?"A":"B","overUnder"));
  }
  const out={};
  for(const [k,st] of Object.entries(acc))for(const [stat,E] of Object.entries(st)){
    const real=E.offers.filter(x=>x.key!=="consensus"),pts=real.filter(x=>x.side==="A").map(x=>x.L).sort((a,b)=>a-b);if(!pts.length)continue;
    const median=pts[Math.floor(pts.length/2)];
    const mine=MINE.map(key=>{const ov=real.find(o=>o.key===key&&o.side==="A");if(!ov)return null;
      const un=real.find(o=>o.key===key&&o.side==="B"&&o.L===ov.L);return {line:ov.L,over:{price:ov.price,book:ov.title},under:un?{price:un.price,book:un.title}:null};}).find(Boolean);
    (out[k]||(out[k]={}))[stat]={line:mine?mine.line:median,median,over:mine?mine.over:null,under:mine?mine.under:null,atMyBook:!!mine,
      books:pts.length,offers:E.offers,name:E.name};
  }
  return out;
}
async function eventLines(eventId,stats){
  const list=await events();if(!list)return null;
  const e=list.find(x=>x.eventID===eventId);if(!e)return null;
  const lines=parseProps(e,stats);writeState(`lines-${eventId}.json`,lines);
  log(`SportsGameOdds: ${Object.keys(lines).length} players priced for event ${eventId}`);
  return lines;
}
const storedLines=eventId=>readState(`lines-${eventId}.json`,4*24);
// {"AWAY@HOME": {spread (home margin, + = home favored), total, homeML, awayML, books, src, offers:{spreads,totals,h2h}}}
async function gameLines(){
  const list=await events();if(!list)return null;
  const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;},out={};
  for(const e of list){
    const h=abbrOf(e.teams&&e.teams.home),a=abbrOf(e.teams&&e.teams.away);if(!h||!a)continue;
    const O=e.odds||{},get=id=>O[id];
    const spH=get("points-home-game-sp-home"),spA=get("points-away-game-sp-away"),toO=get("points-all-game-ou-over"),toU=get("points-all-game-ou-under");
    const mlH=get("points-home-game-ml-home"),mlA=get("points-away-game-ml-away");
    const offers={spreads:[],totals:[],h2h:[]};
    // one scale as in odds.js: side A = home covers when margin > L, L = -(home spread) = (away spread)
    if(spH)for(const x of offersOf(spH,"A","spread"))offers.spreads.push({...x,team:h,point:x.L,L:-x.L});
    if(spA)for(const x of offersOf(spA,"B","spread"))offers.spreads.push({...x,team:a,point:x.L,L:x.L});
    if(toO)offers.totals.push(...offersOf(toO,"A","overUnder"));
    if(toU)offers.totals.push(...offersOf(toU,"B","overUnder"));
    if(mlH)for(const x of offersOf(mlH,"A",null))offers.h2h.push({...x,team:h});
    if(mlA)for(const x of offersOf(mlA,"B",null))offers.h2h.push({...x,team:a});
    const real=k=>offers[k].filter(x=>x.key!=="consensus");
    out[`${a}@${h}`]={spread:med(real("spreads").filter(x=>x.side==="A").map(x=>-x.point)),total:med(real("totals").filter(x=>x.side==="A").map(x=>x.L)),
      homeML:med(real("h2h").filter(x=>x.side==="A").map(x=>x.price)),awayML:med(real("h2h").filter(x=>x.side==="B").map(x=>x.price)),
      books:new Set(real("spreads").map(x=>x.key)).size,src:"SportsGameOdds consensus",offers};
  }
  return out;
}
// odds.js reports {used, remaining} credits; here they're entities this month
function usage(){const u=USAGE||readState("sgo-usage.json")||{};return {used:u.used??"?",remaining:u.max!=null&&u.used!=null?u.max-u.used:null,src:"SportsGameOdds entities"};}
const fmtPrice=p=>p==null?"":(p>0?"+":"")+p;
module.exports={enabled,eventIds,eventLines,storedLines,gameLines,usage,fmtPrice,TEAM,provider:"sgo"};

// ---------- probe: what does this key actually return? ----------
if(require.main===module)(async()=>{
  if(!KEY){console.log("SPORTSGAMEODDS_KEY is not set");return;}
  const u0=await usageNow();console.log("usage before:",JSON.stringify(u0));
  const list=await events();if(!list){console.log("no events returned");return;}
  USAGE=null;const u1=await usageNow();console.log("usage after one events fetch:",JSON.stringify(u1),`(${list.length} events)`);
  const e=list[0];if(!e)return;
  console.log("first event:",e.eventID,abbrOf(e.teams.away),"@",abbrOf(e.teams.home),e.status&&e.status.startsAt,"| top-level keys:",Object.keys(e).join(","));
  const ids=Object.keys(e.odds||{}),books=new Set(),stats={};
  for(const id of ids){const o=e.odds[id];for(const b of Object.keys(o.byBookmaker||{}))books.add(b);stats[o.statID+"/"+o.betTypeID]=(stats[o.statID+"/"+o.betTypeID]||0)+1;}
  console.log("odds:",ids.length,"| bookmakers:",[...books].join(","),"| players map:",e.players?Object.keys(e.players).length:"none");
  console.log("stat/betType counts:",JSON.stringify(stats).slice(0,900));
  const sample=ids.find(id=>id.startsWith("receiving_yards-")&&id.endsWith("-over"));
  if(sample)console.log("sample prop:",sample,JSON.stringify(e.odds[sample]).slice(0,700),"| player:",playerName(e,e.odds[sample].statEntityID));
  const gl=await gameLines(),k=Object.keys(gl)[0];if(k)console.log("game lines",k,JSON.stringify({...gl[k],offers:{spreads:gl[k].offers.spreads.length,totals:gl[k].offers.totals.length,h2h:gl[k].offers.h2h.length}}));
  const props=parseProps(e,["recYds","rec","rushYds","passYds"]);console.log("props parsed for first event:",Object.keys(props).length,"players; e.g.",JSON.stringify(Object.entries(props)[0]||null).slice(0,500));
})().catch(e=>{console.error(e);process.exit(1);});
