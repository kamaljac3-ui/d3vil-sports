// NBA News: injury-news alerts for bench and rotation boosts.
// Polls ESPN's injury reports for today's games every POLL_SEC. When a regular (15+ MPG, playing most games) is newly
// listed Out or Doubtful, it re-projects his team with the nba-edges model and pushes who gains, immediately.
// Why: the 2024-26 backtest (nba-edges/BACKTEST.md) found the bench players who absorb a missing regular's minutes beat
// their average 70-77% of the time, and books move those lines within minutes of the news, so speed is the edge.
// One run polls until MAX_MINUTES or until every game today has tipped (two windows a day on game days).
const fs=require("fs"),path=require("path");
const R=require("../nba-edges/run.js"),M=require("../nba-edges/model");   // the NBA model and data, read-only

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
const {STATS,AVG}=R.SETTINGS,LABEL={pts:"PTS",reb:"REB",ast:"AST",fg3m:"3PM"};
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
function logPicks(rows){
  if(DRY||!NTFY_TOPIC||!rows.length)return;
  const key=`picks-${TODAY}.json`,at=new Date().toISOString();
  store(key,(cached(key,24*30)||[]).concat(rows.map(({tags,...r})=>({sport:"nba",date:TODAY,mode:"news",at,...r}))));
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

// A regular was just ruled out: project his team with and without the news; list who gains and clears the bar.
async function onNews(g,side,D,outNow,newKeys){
  const team=(await R.roster(g[side].espnId)).map(n=>D.players[R.nk(n)]).filter(Boolean);
  const teamGP=Math.max(0,...team.map(p=>p.gpCur||0));
  const regular=p=>p&&p.MIN>=15&&(teamGP<5||(p.gpCur||0)>=0.6*teamGP);
  const news=[...newKeys].map(k=>D.players[k]).filter(regular);
  if(!news.length){log(`${g[side].abbr}: ${[...newKeys].join(", ")} out, not regulars, no alert`);return false;}
  const before=new Set([...outNow].filter(k=>!newKeys.has(k)));
  const S0=R.projectSide(team,g,side,D,before),S1=R.projectSide(team,g,side,D,outNow);
  const prev=Object.fromEntries(S0.players.map(x=>[x.p.key,x.pr]));
  const rows=R.flagRows(S1,null).filter(r=>r.kind==="boost").map(r=>({...r,gain:r.proj-(prev[r.key]?prev[r.key][r.stat]:r.avg)}))
    .filter(r=>r.gain>0).sort((a,b)=>b.gain/b.avg-a.gain/a.avg).slice(0,NEWS_TOP);
  const opp=g[side==="home"?"away":"home"].abbr,who=news.map(p=>`${p.name} (${Math.round(p.MIN)} mpg)`).join(", ");
  const title=`${g[side].abbr}: ${news.map(p=>p.name).join(", ")} OUT vs ${opp}, ${tipStr(g)} ET`;
  const body=rows.length
    ?`Who gains:\n`+rows.map(r=>`${r.name}${r.mpg<20?` (bench ${Math.round(r.mpg)} mpg)`:""}: ${LABEL[r.stat]} proj ${f1(r.proj)} vs ${f1(r.avg)} avg (+${pct(r.proj/r.avg-1)})`).join("\n")+`\n\nOut: ${who}`
    :`Out: ${who}. No teammate boost clears the bar.`;
  await ntfy(title,body,rows.length?5:3);
  logPicks(rows.map(r=>({...r,gameId:g.id,tip:g.date})));
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
