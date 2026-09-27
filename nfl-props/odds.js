// Optional lines from The Odds API (the-odds-api.com). Only used when ODDS_API_KEY is set.
// Credit math: listing events is free; an odds call costs (markets x regions) credits, and a
// bookmakers= list is billed as one region per 10 books. We always ask for the sharp book plus
// your books (<= 10, see sharp.js), only the markets needed, and stop before the budget runs out.
const {env,log,readState,writeState,normName}=require("./lib");
const {BOOKMAKERS}=require("./sharp");

const KEY=process.env.ODDS_API_KEY||"";
const BASE="https://api.the-odds-api.com/v4/sports/americanfootball_nfl";
const MARKET={recYds:"player_reception_yds",rec:"player_receptions",rushYds:"player_rush_yds",passYds:"player_pass_yds"};
const STAT_OF=Object.fromEntries(Object.entries(MARKET).map(([k,v])=>[v,k]));
const BUDGET=env("ODDS_MONTHLY_BUDGET",350);   // credits this bot allows itself per month (nfl-lines has its own budget;
                                               // both stop when the API's own remaining count nears ODDS_RESERVE)
const RESERVE=env("ODDS_RESERVE",25);          // never go below this many remaining credits
const REGIONS=Math.max(1,Math.ceil(BOOKMAKERS.split(",").length/10));

const TEAM={ARI:"Arizona Cardinals",ATL:"Atlanta Falcons",BAL:"Baltimore Ravens",BUF:"Buffalo Bills",CAR:"Carolina Panthers",
  CHI:"Chicago Bears",CIN:"Cincinnati Bengals",CLE:"Cleveland Browns",DAL:"Dallas Cowboys",DEN:"Denver Broncos",DET:"Detroit Lions",
  GB:"Green Bay Packers",HOU:"Houston Texans",IND:"Indianapolis Colts",JAX:"Jacksonville Jaguars",KC:"Kansas City Chiefs",
  LA:"Los Angeles Rams",LAC:"Los Angeles Chargers",LV:"Las Vegas Raiders",MIA:"Miami Dolphins",MIN:"Minnesota Vikings",
  NE:"New England Patriots",NO:"New Orleans Saints",NYG:"New York Giants",NYJ:"New York Jets",PHI:"Philadelphia Eagles",
  PIT:"Pittsburgh Steelers",SEA:"Seattle Seahawks",SF:"San Francisco 49ers",TB:"Tampa Bay Buccaneers",TEN:"Tennessee Titans",
  WAS:"Washington Commanders"};

const enabled=()=>!!KEY;
const month=()=>new Date().toISOString().slice(0,7);
function usage(){const u=readState("odds-usage.json")||{};return u.month===month()?u:{month:month(),used:0,remaining:null};}
function affordable(cost,what){const u=usage();
  if(u.used+cost>BUDGET||(u.remaining!=null&&u.remaining-cost<RESERVE)){
    log(`Odds API budget: skipping ${what} (used ${u.used}/${BUDGET} this month, ${u.remaining??"?"} remaining)`);return false;}
  return true;}

async function call(url){
  const r=await fetch(url).catch(e=>{log("odds fetch error",e.message);return null;});
  if(!r)return null;
  const u=usage(),last=+r.headers.get("x-requests-last")||0,rem=r.headers.get("x-requests-remaining");
  if(last||rem!=null){u.used+=last;if(rem!=null)u.remaining=+rem;writeState("odds-usage.json",u);}  // credits are real even on dry runs
  if(!r.ok){const t=await r.text().catch(()=>"");log(`Odds API ${r.status}: ${t.slice(0,200)}`);return null;}
  return r.json();
}

// Match nflverse games to Odds API event ids (the events list costs no credits).
async function eventIds(games){
  const ev=await call(`${BASE}/events?apiKey=${KEY}`);if(!ev)return {};
  const out={};
  for(const g of games){
    const e=ev.find(x=>x.home_team===TEAM[g.home_team]&&x.away_team===TEAM[g.away_team]&&Math.abs(Date.parse(x.commence_time)-g.kick)<12*36e5);
    if(e)out[g.game_id]=e.id;
  }
  return out;
}

// Per player per stat: consensus (median) line, best price each side at that number, and every
// book's individual offer (for the stale-line check).
function parse(j){
  const acc={};
  for(const b of j.bookmakers||[])for(const m of b.markets||[]){
    const stat=STAT_OF[m.key];if(!stat)continue;
    for(const o of m.outcomes||[]){if(o.point==null||!o.description)continue;
      const k=normName(o.description),e=(acc[k]||(acc[k]={}))[stat]||(acc[k][stat]={pts:[],o:{},u:{},offers:[],name:o.description});
      e.offers.push({key:b.key,title:b.title,side:o.name==="Over"?"A":"B",L:o.point,price:o.price});
      if(o.name==="Over"){e.pts.push(o.point);const c=e.o[o.point];if(c==null||o.price>c.price)e.o[o.point]={price:o.price,book:b.title};}
      if(o.name==="Under"){const c=e.u[o.point];if(c==null||o.price>c.price)e.u[o.point]={price:o.price,book:b.title};}}
  }
  const out={};
  for(const [k,st] of Object.entries(acc))for(const [stat,e] of Object.entries(st)){
    if(!e.pts.length)continue;const s=e.pts.slice().sort((a,b)=>a-b),line=s[Math.floor(s.length/2)];
    (out[k]||(out[k]={}))[stat]={line,over:e.o[line]||null,under:e.u[line]||null,books:e.pts.length,offers:e.offers,name:e.name};
  }
  return out;
}

// stats = which of our stats to request for this event. Returns {normName: {stat: {line,...,offers}}} or null.
async function eventLines(eventId,stats){
  const markets=[...new Set(stats)].map(s=>MARKET[s]).filter(Boolean);if(!markets.length)return null;
  const cost=markets.length*REGIONS;if(!affordable(cost,"props"))return null;
  const j=await call(`${BASE}/events/${eventId}/odds?apiKey=${KEY}&bookmakers=${BOOKMAKERS}&markets=${markets.join(",")}&oddsFormat=american`);
  if(!j)return null;
  const lines=parse(j);writeState(`lines-${eventId}.json`,lines);
  log(`Odds API: ${Object.keys(lines).length} players priced for event ${eventId} (${cost} credits)`);
  return lines;
}
const storedLines=eventId=>readState(`lines-${eventId}.json`,4*24);

// Game lines for every NFL game in one call (3 markets x 1 region = 3 credits).
// Returns {"AWAY@HOME": {spread (home margin, + = home favored), total, homeML, awayML, offers:{spreads,totals,h2h}}}.
async function gameLines(){
  if(!affordable(3*REGIONS,"game lines"))return null;
  const j=await call(`${BASE}/odds?apiKey=${KEY}&bookmakers=${BOOKMAKERS}&markets=h2h,spreads,totals&oddsFormat=american`);if(!j)return null;
  const abbr=Object.fromEntries(Object.entries(TEAM).map(([k,v])=>[v,k])),med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;};
  const out={};
  for(const e of j){const h=abbr[e.home_team],a=abbr[e.away_team];if(!h||!a)continue;
    const sp=[],tot=[],hm=[],am=[],offers={spreads:[],totals:[],h2h:[]};
    for(const b of e.bookmakers||[])for(const m of b.markets||[])for(const o of m.outcomes||[]){
      const home=o.name===e.home_team,base={key:b.key,title:b.title,price:o.price};
      if(m.key==="spreads"){if(home)sp.push(-o.point);
        // one scale: side A = home covers when margin > L, with L = -(home point) = (away point)
        offers.spreads.push({...base,side:home?"A":"B",L:home?-o.point:o.point,team:home?h:a,point:o.point});}
      if(m.key==="totals"){if(o.name==="Over")tot.push(o.point);offers.totals.push({...base,side:o.name==="Over"?"A":"B",L:o.point});}
      if(m.key==="h2h"){(home?hm:am).push(o.price);offers.h2h.push({...base,side:home?"A":"B",team:home?h:a});}}
    out[`${a}@${h}`]={spread:med(sp),total:med(tot),homeML:med(hm),awayML:med(am),books:(e.bookmakers||[]).length,src:"Odds API consensus",offers};}
  return out;
}

const fmtPrice=p=>p==null?"":(p>0?"+":"")+p;
module.exports={enabled,eventIds,eventLines,storedLines,gameLines,usage,fmtPrice,TEAM};
