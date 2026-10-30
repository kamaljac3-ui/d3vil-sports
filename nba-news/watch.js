// NBA News: injury-news alerts for bench and rotation boosts.
// Polls ESPN's injury reports for today's games every POLL_SEC. When a regular (15+ MPG, playing most games) is newly
// listed Out or Doubtful, it re-projects his team with the nba-edges model and pushes who gains, immediately.
// Why: the 2024-26 backtest (nba-edges/BACKTEST.md) found the bench players who absorb a missing regular's minutes beat
// their average 70-77% of the time, and books move those lines within minutes of the news, so speed is the edge.
// One run polls until MAX_MINUTES or until every game today has tipped (two windows a day on game days).
const fs=require("fs"),path=require("path");
const R=require("../nba-edges/run.js"),M=require("../nba-edges/model");   // the NBA model and data, read-only
const SH=require("../nfl-props/sharp.js");                                   // your books (MY_BOOKS) and the no-vig price, read-only

const DRY=process.env.DRY_RUN==="1";
const NTFY_SERVER=(process.env.NTFY_SERVER||"https://ntfy.sh").replace(/\/$/,"");
const NTFY_TOPIC=process.env.NTFY_TOPIC;
const NTFY_TOKEN=process.env.NTFY_TOKEN||"";
const POLL_SEC=+(process.env.POLL_SEC||120);
const MAX_MINUTES=+(process.env.MAX_MINUTES||350);
const NEWS_TOP=+(process.env.NEWS_TOP||5);        // teammates listed per alert
const MIN_TIP_MIN=+(process.env.MIN_TIP_MIN||5);  // stop watching a game this close to tip
const ONCE=process.env.ONCE==="1";                 // testing: one poll
const POLLS=+(process.env.POLLS||0);               // testing: stop after N polls
const TEST_INJECT=process.env.TEST_INJECT||"";     // testing: "Player Name" ruled out from the 2nd poll on
const CACHE=path.join(__dirname,".cache");fs.mkdirSync(CACHE,{recursive:true});
const ESPN="https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const TODAY=R.TODAY;
const {STATS,AVG}=R.SETTINGS,LABEL={pra:"PRA",pts:"PTS",reb:"REB",ast:"AST",fg3m:"3PM"};
const log=(...a)=>console.log(`[news ${new Date().toISOString().slice(11,19)}]`,...a);
const sleep=ms=>new Promise(s=>setTimeout(s,ms));

function cached(name,maxAgeH){const p=path.join(CACHE,name);if(!fs.existsSync(p))return null;
  try{const d=JSON.parse(fs.readFileSync(p,"utf8"));if((Date.now()-d.at)/36e5<=maxAgeH)return d.v;}catch(e){}return null;}
function store(name,v){fs.writeFileSync(path.join(CACHE,name),JSON.stringify({at:Date.now(),v}));return v;}
async function get(url){
  for(let a=0;a<3;a++){try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(r.ok)return r.json();log("HTTP",r.status,url.slice(0,80));}
    catch(e){log("fetch error",e.message);}await sleep(2000*(a+1));}
  return null;
}
async function ntfy(title,message,priority=4,tags=["basketball","ambulance"]){
  if(DRY||!NTFY_TOPIC){log("DRY ntfy:",title,"\n"+message);return;}
  const h={"Content-Type":"application/json"};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  const r=await fetch(NTFY_SERVER,{method:"POST",headers:h,body:JSON.stringify({topic:NTFY_TOPIC,title,message:message.slice(0,3900),priority,tags})});
  log("ntfy",r.status);
}

// ---------- state: which outs we've already seen (persists across windows via the Actions cache) ----------
const STATE=`news-${TODAY}.json`;
const state=cached(STATE,30)||{seen:{},games:{}};   // seen["gameId|playerKey"], games[gameId] = baseline taken
const save=()=>{if(!DRY&&NTFY_TOPIC)store(STATE,state);};
const MODEL_VERSION=R.MODEL_VERSION;
function logPicks(rows){
  if(DRY||!NTFY_TOPIC||!rows.length)return;
  const key=`picks-${TODAY}.json`,at=new Date().toISOString();
  store(key,(cached(key,24*30)||[]).concat(rows.map(r=>({sport:"nba",date:TODAY,mode:"news",at,...r}))));
}

// Out/Doubtful players per team from ESPN's game summary: {ESPN abbr: Map(key -> {name,status})}
async function outsFor(g,poll){
  const j=await get(`${ESPN}/summary?event=${g.id}`);if(!j)return null;
  const out={[g.home.espnAbbr]:new Map(),[g.away.espnAbbr]:new Map()};
  for(const t of j.injuries||[]){const m=out[t.team.abbreviation];if(!m)continue;
    for(const i of t.injuries||[])if(/^(out|doubtful)$/i.test(i.status||""))m.set(R.nk(i.athlete.displayName),{name:i.athlete.displayName,status:i.status});}
  if(TEST_INJECT&&poll>=2)for(const side of ["home","away"]){const k=R.nk(TEST_INJECT);
    if((await R.roster(g[side].espnId)).some(n=>R.nk(n)===k))out[g[side].espnAbbr].set(k,{name:TEST_INJECT,status:"Out (test)"});}
  return out;
}
const tipStr=g=>new Date(g.date).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"});
const f1=v=>v.toFixed(1),pct=v=>Math.round(v*100)+"%";

// ---------- board updates: a late Out that touches today's PRA board ----------
// nba-edges posts a compact copy of the board (about 1 PM ET) to NTFY_TOPIC + BOARD_DATA_SUFFIX. When a new Out lands for
// a team with board picks: the pick's own player out -> "voids"; a teammate out -> re-project him with tonight's outs and
// say how his chance at the board's line moved (or that it now leans the other way). No odds are pulled, so the line
// shown is the board's number; the book has usually moved by then. BOARD_JSON=<file> feeds a board for testing.
const BOARD_SUFFIX=process.env.BOARD_DATA_SUFFIX||"-board",BOARD_UPDATE_MIN=+(process.env.BOARD_UPDATE_MIN||1);
let BOARD=null,BOARD_AT=0;
async function todaysBoard(){
  if(process.env.BOARD_JSON)return JSON.parse(fs.readFileSync(process.env.BOARD_JSON,"utf8"));
  if(!NTFY_TOPIC)return null;
  if(BOARD&&Date.now()-BOARD_AT<10*6e4)return BOARD;
  const h={};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  try{
    const r=await fetch(`${NTFY_SERVER}/${encodeURIComponent(NTFY_TOPIC+BOARD_SUFFIX)}/json?poll=1&since=20h`,{headers:h,signal:AbortSignal.timeout(20000)});
    if(!r.ok){log("board fetch",r.status);return null;}
    let b=null;
    for(const line of (await r.text()).split("\n")){try{const m=JSON.parse(line);if(m.event!=="message")continue;const j=JSON.parse(m.message);if(j.date===TODAY)b=j;}catch(e){}}
    BOARD=b;BOARD_AT=Date.now();return b;
  }catch(e){log("board fetch error",e.message);return null;}
}
async function boardUpdate(g,side,D,outNow,newKeys){
  const b=await todaysBoard();if(!b||!b.picks)return false;
  const team=g[side].abbr,picks=b.picks.filter(p=>p.gid===g.id&&p.t===team);if(!picks.length)return false;
  const S=R.projectSide(await R.teamFor(g,side,D,outNow),g,side,D,outNow),by=Object.fromEntries(S.players.map(x=>[x.p.key,x]));
  const lines=[];
  for(const p of picks){
    const bet=`#${p.i} ${p.n} PRA ${p.s}${p.L}`;
    if(newKeys.has(p.k)){lines.push(`${bet}: he's OUT, the bet voids (FanDuel refunds props on players who don't play)`);continue;}
    const x=by[p.k];if(!x)continue;
    const proj=M.calibrate("pra",x.pr.pra,x.p.PRA,x.p.MIN),po=M.pOver(proj,p.L,"pra"),prob=p.s==="o"?po:1-po;
    if(Math.abs(proj-p.proj)<BOARD_UPDATE_MIN)continue;
    lines.push(`${bet}: proj ${f1(p.proj)} → ${f1(proj)}, ${pct(p.prob)} → ${pct(prob)}`+(prob<0.5?", now leans the other way: skip it":prob>p.prob?", stronger":", weaker"));
  }
  if(!lines.length){log(`${team}: board picks unchanged by the news`);return false;}
  const who=[...newKeys].map(k=>(D.players[k]&&D.players[k].name)||k).join(", ");
  await ntfy(`Board update: ${who} OUT (${team}), ${tipStr(g)} ET`,lines.join("\n")+"\n\nLines are the board's 1 PM numbers; the book has likely moved since.",4,["basketball","warning"]);
  return true;
}

// ---------- your book's PRA price on the news (2026-10-29) ----------
// The edge from a late Out lasts until the book moves, so the alert carries the bet: one fresh Odds API pull for the game
// (1 credit, PRA only; at most NEWS_ODDS_MAX a day, shared by both windows) and, for each teammate the alert lists or whose
// calibrated PRA projection rose NEWS_PRA_MIN+ with the news, your book's (MY_BOOKS, FanDuel) best over: line, price, the model's chance
// at that line, the market's no-vig chance (Pinnacle, else the other US books) and EV on the model's chance. The market
// may not have priced the news in yet, which is the point, so EV is on the model. NEWS_ODDS=0 turns it off.
const NEWS_ODDS=process.env.NEWS_ODDS!=="0"&&!!process.env.ODDS_API_KEY,NEWS_ODDS_MAX=+(process.env.NEWS_ODDS_MAX||8);
const NEWS_PRA_MIN=+(process.env.NEWS_PRA_MIN||0.75),NEWS_PRA_TOP=+(process.env.NEWS_PRA_TOP||4),EV_MAX_GAP=+(process.env.EV_MAX_GAP||2);
const BOOK_AT={};
async function freshBook(g){
  if(!NEWS_ODDS)return null;
  const b=BOOK_AT[g.id];if(b&&Date.now()-b.at<10*6e4)return b.book;   // news for both teams at once: one pull
  if((state.odds||0)>=NEWS_ODDS_MAX){log(`news odds: ${NEWS_ODDS_MAX} pulls today already, no prices`);return null;}
  state.odds=(state.odds||0)+1;
  const book=await R.propBook(g,true);BOOK_AT[g.id]={at:Date.now(),book};return book;
}
const calPra=x=>M.calibrate("pra",x.pr.pra,x.p.PRA,x.p.MIN);
// teammates the alert lists, or whose PRA projection the news raised NEWS_PRA_MIN+, each with pre/post projections
function praGainers(S0,S1,outNow,listed){
  const prev=Object.fromEntries(S0.players.map(x=>[x.p.key,x]));
  return S1.players.filter(x=>!outNow.has(x.p.key)&&prev[x.p.key]).map(x=>({x,proj:calPra(x),proj0:calPra(prev[x.p.key])}))
    .filter(r=>r.proj-r.proj0>=NEWS_PRA_MIN||(listed.has(r.x.p.key)&&r.proj>r.proj0));
}
function praRows(gainers,book,g){
  if(!book)return [];
  const out=[];
  for(const {x,proj,proj0} of gainers){
    const k=x.p.key,offers=(book.offers[k]||{}).pra||[],med=book.lines[k]&&book.lines[k].pra;if(med==null)continue;
    const fairs=SH.staleTwoWay(offers,{sigma:M.sdOf("pra",med),maxGap:EV_MAX_GAP,minEV:-1});
    let best=null;
    for(const o of offers.filter(o=>SH.MINE.includes(o.key)&&o.side==="A")){   // the news raises him: the over
      const mp=M.pOver(proj,o.L,"pra"),ev=SH.ev(mp,o.price),f=fairs.find(y=>y.key===o.key&&y.side==="A"&&y.L===o.L);
      if(!best||ev>best.ev)best={L:o.L,price:o.price,book:o.title,mp,ev,kp:f?f.fair:null,sharp:f?{book:f.sharp.title,L:f.sharp.L}:null};
    }
    if(!best||best.ev<=0||best.mp<0.5)continue;
    out.push({kind:"prop",stat:"pra",name:x.p.name,key:k,team:x.p.team||"",mpg:x.p.MIN,proj,proj0,projRaw:x.pr.pra,avg:x.p.PRA,
      line:best.L,po:best.mp,price:best.price,book:best.book,prob:best.mp,ev:best.ev,mktP:best.kp,fair:best.sharp&&best.kp!=null?{p:best.kp,...best.sharp}:null,
      model:MODEL_VERSION,gameId:g.id,tip:g.date});
  }
  return out.sort((a,b)=>b.ev-a.ev).slice(0,NEWS_PRA_TOP);
}
const praLine=r=>`${r.name}${r.mpg<20?` (bench ${Math.round(r.mpg)} mpg)`:""}: PRA o${r.line} ${SH.fmt(r.price)} ${r.book}\n`+
  `   proj ${f1(r.proj)} (was ${f1(r.proj0)} before the news) · model ${pct(r.prob)}, +${Math.round(r.ev*100)}% EV`+
  (r.fair?` · ${r.fair.book} ${r.fair.L} ${pct(r.fair.p)}`:"")+(r.line>=r.proj0+1?" · line already moved up":"");

// A regular was just ruled out: project his team with and without the news; list who gains and clears the bar.
async function onNews(g,side,D,outNow,newKeys){
  const team=(await R.roster(g[side].espnId)).map(n=>D.players[R.nk(n)]).filter(Boolean);
  const teamGP=Math.max(0,...team.map(p=>p.gpCur||0));
  const regular=p=>p&&p.MIN>=15&&(teamGP<5||(p.gpCur||0)>=0.6*teamGP);
  const news=[...newKeys].map(k=>D.players[k]).filter(regular);
  if(!news.length){log(`${g[side].abbr}: ${[...newKeys].join(", ")} out, not regulars, no alert`);return false;}
  const before=new Set([...outNow].filter(k=>!newKeys.has(k)));
  // with and without the news, each with its own model inputs (last-3 minutes, returns) from nba-edges' teamFor
  const S0=R.projectSide(await R.teamFor(g,side,D,before),g,side,D,before),S1=R.projectSide(await R.teamFor(g,side,D,outNow),g,side,D,outNow);
  const prev=Object.fromEntries(S0.players.map(x=>[x.p.key,x.pr]));
  const rows=R.flagRows(S1,null).filter(r=>r.kind==="boost").map(r=>({...r,gain:prev[r.key]?r.projRaw-prev[r.key][r.stat]:r.proj-r.avg}))
    .filter(r=>r.gain>0).sort((a,b)=>b.gain/b.avg-a.gain/a.avg).slice(0,NEWS_TOP);
  const gainers=praGainers(S0,S1,outNow,new Set(rows.map(r=>r.key)));
  const pra=gainers.length?praRows(gainers,await freshBook(g),g):[];
  const opp=g[side==="home"?"away":"home"].abbr,who=news.map(p=>`${p.name} (${Math.round(p.MIN)} mpg)`).join(", ");
  const title=`${g[side].abbr}: ${news.map(p=>p.name).join(", ")} OUT vs ${opp}, ${tipStr(g)} ET`;
  const bets=pra.length?`💰 ${SH.MINE.length===1?pra[0].book:"Your books"} PRA right now:\n`+pra.map(praLine).join("\n")+"\n\n":"";
  const body=bets+(rows.length
    ?`Who gains:\n`+rows.map(r=>`${r.name}${r.mpg<20?` (bench ${Math.round(r.mpg)} mpg)`:""}: ${LABEL[r.stat]} proj ${f1(r.proj)} vs ${f1(r.avg)} avg (+${pct(r.proj/r.avg-1)})`).join("\n")+`\n\nOut: ${who}`
    :`Out: ${who}. No teammate boost clears the bar.`);
  await ntfy(title,body,rows.length||pra.length?5:3);
  logPicks(rows.map(r=>({...r,gameId:g.id,tip:g.date})).concat(pra));
  return true;
}

(async()=>{
  const deadline=Date.now()+MAX_MINUTES*6e4;let D=null,poll=0;
  while(true){
    poll++;
    const games=(await R.slate()).filter(g=>process.env.DATE||(new Date(g.date)-Date.now())/6e4>MIN_TIP_MIN);
    if(!games.length){log("no games left to watch today");break;}
    if(!D)D=await R.loadData();
    let alerts=0;
    for(const g of games){
      const outs=await outsFor(g,poll);if(!outs)continue;
      const first=!state.games[g.id];state.games[g.id]=1;
      for(const side of ["home","away"]){
        const m=outs[g[side].espnAbbr],newKeys=new Set();
        for(const k of m.keys()){const sk=`${g.id}|${k}`;if(!state.seen[sk]){state.seen[sk]=1;if(!first)newKeys.add(k);}}
        // first look at a game (start of day or cold cache): the morning/pregame alerts already cover these outs
        if(newKeys.size){try{if(await boardUpdate(g,side,D,new Set(m.keys()),newKeys))alerts++;}catch(e){log("board update error",g.id,e.message);}}
        if(newKeys.size){try{if(await onNews(g,side,D,new Set(m.keys()),newKeys))alerts++;}catch(e){log("news error",g.id,e.message);}}
      }
    }
    save();
    log(`poll ${poll}: ${games.length} games watched, ${alerts} alerts`);
    if(ONCE||(POLLS&&poll>=POLLS)||Date.now()+POLL_SEC*1e3>deadline)break;
    await sleep(POLL_SEC*1e3);
  }
  save();
})().catch(async e=>{console.error(e);await ntfy("NBA News bot error",String(e.message||e),2,["warning"]).catch(()=>{});process.exit(1);});
