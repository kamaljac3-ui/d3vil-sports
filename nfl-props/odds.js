// Optional prop lines from The Odds API (the-odds-api.com). Only used when ODDS_API_KEY is set.
// Credit math: listing events is free; each event's odds call costs (markets x regions) credits.
// We pull one region (us), only the markets our candidates need, only for a handful of games,
// and stop well before the monthly allowance runs out.
const {env,log,readState,writeState,normName}=require("./lib");

const KEY=process.env.ODDS_API_KEY||"";
const BASE="https://api.the-odds-api.com/v4/sports/americanfootball_nfl";
const MARKET={recYds:"player_reception_yds",rec:"player_receptions",rushYds:"player_rush_yds",passYds:"player_pass_yds"};
const STAT_OF=Object.fromEntries(Object.entries(MARKET).map(([k,v])=>[v,k]));
const BUDGET=env("ODDS_MONTHLY_BUDGET",450);   // credits we allow ourselves per calendar month
const RESERVE=env("ODDS_RESERVE",25);          // never go below this many remaining credits
const BOOKS=process.env.ODDS_BOOKMAKERS||"";   // optional comma list, e.g. draftkings,fanduel

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

// Consensus (median) line per player per stat, with the best price on each side at that number.
function parse(j){
  const acc={};
  for(const b of j.bookmakers||[])for(const m of b.markets||[]){
    const stat=STAT_OF[m.key];if(!stat)continue;
    for(const o of m.outcomes||[]){if(o.point==null||!o.description)continue;
      const k=normName(o.description),e=(acc[k]||(acc[k]={}))[stat]||(acc[k][stat]={pts:[],o:{},u:{}});
      if(o.name==="Over"){e.pts.push(o.point);const c=e.o[o.point];if(c==null||o.price>c.price)e.o[o.point]={price:o.price,book:b.title};}
      if(o.name==="Under"){const c=e.u[o.point];if(c==null||o.price>c.price)e.u[o.point]={price:o.price,book:b.title};}}
  }
  const out={};
  for(const [k,st] of Object.entries(acc))for(const [stat,e] of Object.entries(st)){
    if(!e.pts.length)continue;const s=e.pts.slice().sort((a,b)=>a-b),line=s[Math.floor(s.length/2)];
    (out[k]||(out[k]={}))[stat]={line,over:e.o[line]||null,under:e.u[line]||null,books:e.pts.length};
  }
  return out;
}

// stats = which of our stats to request for this event. Returns {normName: {stat: {line,...}}} or null.
async function eventLines(eventId,stats){
  const markets=[...new Set(stats)].map(s=>MARKET[s]).filter(Boolean);if(!markets.length)return null;
  const cost=markets.length*(BOOKS?Math.ceil(BOOKS.split(",").length/10):1),u=usage();
  if(u.used+cost>BUDGET||(u.remaining!=null&&u.remaining-cost<RESERVE)){
    log(`Odds API budget: skipping (used ${u.used}/${BUDGET} this month, ${u.remaining??"?"} remaining)`);return null;}
  const q=BOOKS?`bookmakers=${BOOKS}`:"regions=us";
  const j=await call(`${BASE}/events/${eventId}/odds?apiKey=${KEY}&${q}&markets=${markets.join(",")}&oddsFormat=american`);
  if(!j)return null;
  const lines=parse(j);writeState(`lines-${eventId}.json`,lines);
  log(`Odds API: ${Object.keys(lines).length} players priced for event ${eventId} (${cost} credits)`);
  return lines;
}
const storedLines=eventId=>readState(`lines-${eventId}.json`,4*24);

const fmtPrice=p=>p==null?"":(p>0?"+":"")+p;
module.exports={enabled,eventIds,eventLines,storedLines,usage,fmtPrice,TEAM};
