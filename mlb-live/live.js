// MLB Live: in-game pitching-change alerts.
// Polls every live game; when a team brings in a new pitcher, re-runs the launch-angle model for the
// hitters due up against him and pushes to ntfy if any clear the edge bar (once per pitcher per game).
// Starters are left to launch-angle/ (morning + lineups); this bot only covers pitchers who enter mid-game.
// One run polls until MAX_MINUTES or until every game today is final (two scheduled windows cover a day).
const fs=require("fs"),path=require("path");
const M=require("../launch-angle/model"),E=require("../launch-angle/env");   // shared physics + park/weather, read-only

const DRY=process.env.DRY_RUN==="1";
const NTFY_SERVER=(process.env.NTFY_SERVER||"https://ntfy.sh").replace(/\/$/,"");
const NTFY_TOPIC=process.env.NTFY_TOPIC;
const NTFY_TOKEN=process.env.NTFY_TOKEN||"";
const FENCE=+(process.env.FENCE||380);
const MIN_HITTERS=+(process.env.MIN_HITTERS||100); // current-season hitters needed before skipping last season's fill-in
const MIN_EDGE=+(process.env.MIN_EDGE||0.03);      // window share above the hitter's own baseline
const GAP_LO=+(process.env.GAP_LO||5),GAP_HI=+(process.env.GAP_HI||12);
const REQUIRE_HR_EDGE=process.env.REQUIRE_HR_EDGE!=="0"; // also need HR contact at or above his baseline
const N_NEXT=+(process.env.N_NEXT||6);             // hitters due up to score against the new pitcher
const MIN_PITCHES=+(process.env.MIN_PITCHES||150); // skip pitchers with too little Statcast history
const POLL_SEC=+(process.env.POLL_SEC||45);
const PREFETCH_SEC=+(process.env.PREFETCH_SEC||20);// per poll, spent building bullpen profiles ahead of time
const MAX_MINUTES=+(process.env.MAX_MINUTES||345);
const ALERT_EXISTING=process.env.ALERT_EXISTING==="1"; // testing: treat relievers already in the game as new
const ONCE=process.env.ONCE==="1";                     // testing: one poll, then exit
const CACHE=path.join(__dirname,".cache");fs.mkdirSync(CACHE,{recursive:true});
const UA={"User-Agent":"Mozilla/5.0 (d3vil-sports mlb-live bot)"};

const etDate=(d=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(d);
const TODAY=process.env.DATE||etDate();
const YEAR=+TODAY.slice(0,4);
const log=(...a)=>console.log(`[live ${new Date().toISOString().slice(11,19)}]`,...a);
const sleep=ms=>new Promise(s=>setTimeout(s,ms));

// ---------- CSV / cache / fetch (same as launch-angle/run.js) ----------
function parseCSV(text){
  text=text.replace(/^﻿/,"");const rows=[];let row=[],f="",q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;else if(c===","){row.push(f);f="";}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(f);f="";if(row.length>1||row[0]!=="")rows.push(row);row=[];}
    else f+=c;}
  if(f!==""||row.length){row.push(f);rows.push(row);}
  if(!rows.length)return [];const h=rows.shift();
  return rows.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??""])));
}
function cached(name,maxAgeH){const p=path.join(CACHE,name);if(!fs.existsSync(p))return null;
  try{const d=JSON.parse(fs.readFileSync(p,"utf8"));if((Date.now()-d.at)/36e5<=maxAgeH)return d.v;}catch(e){}return null;}
function store(name,v){fs.writeFileSync(path.join(CACHE,name),JSON.stringify({at:Date.now(),v}));return v;}
async function get(url,asText,tries=3){
  for(let a=0;a<tries;a++){try{const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(60000)});if(r.ok)return asText?r.text():r.json();log("HTTP",r.status,url.slice(0,90));}
    catch(e){log("fetch error",e.message);}await sleep(2000*(a+1));}
  return null;
}

// ---------- Savant profiles ----------
// NB: the bat-tracking leaderboards ignore ?year= and always return the current season; seasonStart/seasonEnd works.
const LB=y=>[
  `https://baseballsavant.mlb.com/leaderboard/bat-tracking?gameType=Regular&minSwings=q&seasonStart=${y}&seasonEnd=${y}&csv=true`,
  `https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle?gameType=Regular&minSwings=q&seasonStart=${y}&seasonEnd=${y}&csv=true`,
  `https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${y}&position=&team=&min=25&csv=true`];
async function hitterProfiles(){
  const hit=cached("hitters.json",24*7);if(hit)return hit;
  // Current season first. Early in the year (few qualified hitters) fill in anyone missing from last season.
  const out={};
  for(const y of [YEAR,YEAR-1]){
    const files=[];
    for(const u of LB(y)){const t=await get(u,true);if(t&&t.includes(","))files.push(parseCSV(t));}
    const r=M.hittersFrom(files);let added=0;
    for(const h of r.list)if(!out[h.id]){out[h.id]={...h,season:y};added++;}
    log(`hitters ${y}: ${r.list.length} (${added} used, ${Object.keys(out).length} total)`);
    if(Object.keys(out).length>=MIN_HITTERS)return store("hitters.json",out);
  }
  throw new Error(`Could not build hitter profiles from Savant. (${Object.keys(out).length} hitters, need ${MIN_HITTERS})`);
}
const SEARCH=(id,y)=>"https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfPT=&hfAB=&hfGT=R%7CF%7CD%7CL%7CW%7C&hfPR=&hfZ=&hfStadium=&hfBBL=&hfNewZones=&hfPull=&hfC=&hfSea="+y+"%7C&hfSit=&player_type=pitcher&hfOuts=&hfOpponent=&pitcher_throws=&batter_stands=&hfSA=&game_date_gt=&game_date_lt=&hfMo=&hfTeam=&home_road=&hfRO=&position=&hfInfield=&hfOutfield=&hfInn=&hfBBT=&hfFlag=&pitchers_lookup%5B%5D="+id+"&metric_1=&group_by=name&min_pitches=0&min_results=0&min_pas=0&sort_col=pitches&player_event_sort=api_p_release_speed&sort_order=desc&type=details";
// relievers' arsenals barely move day to day, so profiles keep for 3 days (and carry over between windows via the Actions cache)
const pitchers=new Map();
async function pitcherProfile(id,name){
  id=String(id);if(pitchers.has(id))return pitchers.get(id);
  const key=`p-${id}.json`;let p=cached(key,72);
  if(p===null){
    let rows=[];
    for(const y of [YEAR,YEAR-1]){const t=await get(SEARCH(id,y),true);if(t)rows=rows.concat(parseCSV(t));if(rows.length>=400)break;}
    p=M.pitchersFrom([rows]).list[0]||false;if(p)p.name=name;
    log(`pitcher ${name}: ${rows.length} pitches, ${p?p.pitches.length:0} types`);
    store(key,p);
  }
  pitchers.set(id,p);return p;
}
// ---------- bullpen prefetch ----------
const queue=[];
async function queueBullpens(games){
  const seen=new Set();
  for(const g of games)for(const s of ["home","away"]){
    const t=g.teams[s].team.id;if(seen.has(t))continue;seen.add(t);
    const j=await get(`https://statsapi.mlb.com/api/v1/teams/${t}/roster?rosterType=active`);
    for(const p of (j?j.roster:[]))if(p.position.type==="Pitcher"&&!cached(`p-${p.person.id}.json`,72))queue.push({id:p.person.id,name:p.person.fullName});
  }
  log(`bullpen prefetch: ${queue.length} pitcher profiles to build`);
}
async function prefetch(ms){
  const end=Date.now()+ms;
  while(queue.length&&Date.now()<end){const p=queue.shift();await pitcherProfile(p.id,p.name);}
}

// ---------- state ----------
const STATE=`live-${TODAY}.json`;
const state=cached(STATE,30)||{seen:{},games:{}};   // seen["gamePk|pitcherId"], games[gamePk] = first poll done
const save=()=>{if(!DRY&&NTFY_TOPIC)store(STATE,state);};
function logPicks(rows){
  if(DRY||!NTFY_TOPIC||!rows.length)return;
  const key=`picks-${TODAY}.json`,at=new Date().toISOString();
  store(key,(cached(key,24*30)||[]).concat(rows.map(r=>({sport:"mlb",kind:"live",date:TODAY,mode:"live",at,...r}))));
}
async function ntfy(title,message,priority=4,tags=["baseball","rotating_light"]){
  if(DRY||!NTFY_TOPIC){log("DRY ntfy:",title,"\n"+message);return;}
  const h={"Content-Type":"application/json"};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  const r=await fetch(NTFY_SERVER,{method:"POST",headers:h,body:JSON.stringify({topic:NTFY_TOPIC,title,message:message.slice(0,3900),priority,tags})});
  log("ntfy",r.status);
}

// ---------- scoring ----------
const pct=v=>Math.round(v*100)+"%";
const sgn=v=>(v>=0?"+":"")+Math.round(v*100);
const ORD=["1st","2nd","3rd","4th","5th","6th","7th","8th","9th"];
function score(h,P){
  const m=M.matchup(h,P,FENCE),b=M.matchup(h,M.LEAGUE_AVG_PITCHER,FENCE);
  return {win:m.win,hr:m.hr,edge:m.win-b.win,hrEdge:m.hr-b.hr,gap:m.gap,prim:m.prim.label};
}
const isEdge=r=>r.edge>=MIN_EDGE&&r.gap>=GAP_LO&&r.gap<=GAP_HI&&(!REQUIRE_HR_EDGE||r.hrEdge>=0);
const abbr=t=>t.abbreviation||t.teamName||t.name;

// a new pitcher for the fielding team: score the opponent's next N_NEXT hitters against him
async function onChange(g,H,pitcher,pitTeamId){
  const bx=await get(`https://statsapi.mlb.com/api/v1/game/${g.gamePk}/boxscore`);if(!bx)return;
  const pSide=bx.teams.home.team.id===pitTeamId?"home":"away",oSide=pSide==="home"?"away":"home";
  if(bx.teams[pSide].pitchers.indexOf(pitcher.id)===0){log(`${g.gamePk}: ${pitcher.fullName} is the starter, skipping`);return;}
  const P=await pitcherProfile(pitcher.id,pitcher.fullName);
  const label=`${abbr(g.teams.away.team)} @ ${abbr(g.teams.home.team)}`,ls=g.linescore;
  if(!P||P.n<MIN_PITCHES){log(`${label}: ${pitcher.fullName} in, too little Statcast data (${P?P.n:0} pitches)`);return;}
  const oppId=bx.teams[oSide].team.id,due=(ls.offense&&ls.offense.team&&ls.offense.team.id===oppId?ls.offense:ls.defense).batter;
  const order=bx.teams[oSide].battingOrder||[],start=Math.max(0,order.indexOf(due&&due.id));
  const next=[...Array(Math.min(N_NEXT,order.length))].map((_,i)=>order[(start+i)%order.length]);
  const oppAbbr=abbr(bx.teams[oSide].team),rows=[];
  next.forEach((id,i)=>{const h=H[String(id)];if(!h)return;
    const r=score(h,P);if(isEdge(r))rows.push({due:i+1,name:bx.teams[oSide].players["ID"+id].person.fullName,team:oppAbbr,pitcher:pitcher.fullName,
      hitterId:String(id),pitcherId:String(pitcher.id),gamePk:g.gamePk,inning:`${ls.inningHalf||""} ${ls.currentInning||""}`.trim(),...r});});
  const inn=`${(ls.inningHalf||"").slice(0,3)} ${ls.currentInning||""}`.trim();
  const scoreLine=`${abbr(g.teams.away.team)} ${ls.teams.away.runs??0}, ${abbr(g.teams.home.team)} ${ls.teams.home.runs??0}`;
  if(!rows.length){log(`${label} ${inn}: ${pitcher.fullName} in, no edges in the next ${next.length}`);return;}
  // park + weather (info only): MLB's game-time report, per hitter's batting side vs this pitcher
  let wxLine="";
  try{
    const sj=await get(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePk=${g.gamePk}&hydrate=weather,venue(location,fieldInfo)`);
    const sg_=sj&&sj.dates&&sj.dates[0]&&sj.dates[0].games[0];
    if(sg_){const w=await E.forGame(sg_),hand=await E.hands([...rows.map(r=>r.hitterId),pitcher.id]);
      if(w.wx){wxLine=`\n${w.wx.label}`;
        for(const r of rows){const hb=hand[r.hitterId]||{},hp=hand[String(pitcher.id)]||{};r.envMult=E.multiplier(M,H[r.hitterId],w.park,w.wx,E.batsVs(hb.bat,hp.pitch),FENCE);r.wx=w.wx.label;}}}
  }catch(e){log("park/weather error",e.message);}
  await ntfy(`${label}, ${inn}: ${pitcher.fullName} in`,
    rows.map(r=>`${ORD[r.due-1]} up: ${r.name}: HR contact ${pct(r.hr)} (${sgn(r.hrEdge)}), window ${pct(r.win)} (${sgn(r.edge)}), gap ${r.gap>=0?"+":""}${r.gap.toFixed(1)}° vs ${r.prim}${r.envMult?`, park/wx ×${r.envMult.toFixed(2)}`:""}`).join("\n")+`\n\n${scoreLine}${wxLine}`);
  logPicks(rows);
}

(async()=>{
  const deadline=Date.now()+MAX_MINUTES*6e4;
  let H=null,queued=false;
  while(true){
    const j=await get(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${TODAY}&hydrate=linescore,team`);
    const games=j&&j.dates&&j.dates[0]?j.dates[0].games:[];
    const open=games.filter(g=>g.status.abstractGameState!=="Final");
    if(!open.length){log(games.length?"all games final":"no games today");break;}
    if(!H)H=await hitterProfiles();
    if(!queued){await queueBullpens(open);queued=true;}
    const live=games.filter(g=>g.status.abstractGameState==="Live"&&g.linescore&&g.linescore.defense&&g.linescore.defense.pitcher);
    for(const g of live){
      const d=g.linescore.defense,k=`${g.gamePk}|${d.pitcher.id}`;
      // first look at a game this day (cold start mid-game): don't alert on pitchers already in
      if(!state.games[g.gamePk]&&!ALERT_EXISTING){state.games[g.gamePk]=1;state.seen[k]=1;continue;}
      state.games[g.gamePk]=1;
      if(state.seen[k])continue;state.seen[k]=1;
      try{await onChange(g,H,d.pitcher,d.team.id);}catch(e){log("change error",g.gamePk,e.message);}
    }
    save();
    log(`${live.length} live, ${open.length-live.length} upcoming/other, ${queue.length} profiles queued`);
    if(ONCE||Date.now()+POLL_SEC*1e3>deadline)break;
    const t=Date.now();await prefetch(PREFETCH_SEC*1e3);
    await sleep(Math.max(0,POLL_SEC*1e3-(Date.now()-t)));
  }
  save();
})().catch(async e=>{console.error(e);await ntfy("MLB Live bot error",String(e.message||e),2,["warning"]).catch(()=>{});process.exit(1);});
