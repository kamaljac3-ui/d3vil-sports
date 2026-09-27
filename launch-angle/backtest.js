// Launch Angle backtest: does the model find home runs beyond what the hitter and pitcher already tell you?
// For each test season Y, every profile comes from season Y-1 (no look-ahead):
//   hitters  - Savant bat-tracking + attack-angle + statcast leaderboards for Y-1
//   pitchers - Savant pitch-level data for Y-1 (arsenal, VAA, HR allowed)
// and outcomes are every plate appearance in Y against pitchers with a Y-1 profile.
// Expected HR = hitter HR/PA (Y-1) x pitcher HR/PA allowed (Y-1) / league, calibrated so the season total
// matches, so a flagged group's obs/exp ratio is what the model adds on top of "slugger vs. HR-prone pitcher".
// Usage: node launch-angle/backtest.js            (SEASONS=2025,2026 by default; first run downloads ~1,500 CSVs)
const fs=require("fs"),path=require("path");
const M=require("./model");

const SEASONS=(process.env.SEASONS||"2025,2026").split(",").map(Number);
const FENCE=+(process.env.FENCE||380);
const MIN_EDGE=+(process.env.MIN_EDGE||0.03),GAP_LO=+(process.env.GAP_LO||5),GAP_HI=+(process.env.GAP_HI||12);
const MIN_BF=+(process.env.MIN_BF||100);          // pitchers in the test season with at least this many batters faced
const MIN_PITCHES=+(process.env.MIN_PITCHES||150);// Y-1 pitches needed for a pitcher profile
const TOP_N=+(process.env.TOP_N||8);
const CONC=+(process.env.CONCURRENCY||3);
const OUT=process.env.OUT||path.join(__dirname,"BACKTEST.md");
const CACHE=path.join(__dirname,".cache","bt");fs.mkdirSync(CACHE,{recursive:true});
const UA={"User-Agent":"Mozilla/5.0 (d3vil-sports launch-angle bot)"};
const log=(...a)=>console.log("[bt]",...a);
const sleep=ms=>new Promise(s=>setTimeout(s,ms));

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
async function get(url,asText){
  for(let a=0;a<4;a++){try{const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(120000)});if(r.ok)return asText?r.text():r.json();log("HTTP",r.status,url.slice(0,90));}
    catch(e){log("fetch error",e.message);}await sleep(3000*(a+1));}
  return null;
}
async function diskCached(name,fn){
  const p=path.join(CACHE,name);if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p,"utf8"));
  const v=await fn();if(v!==null)fs.writeFileSync(p,JSON.stringify(v));return v;
}

// ---------- data ----------
// NB: the bat-tracking leaderboards ignore ?year= and always return the current season; seasonStart/seasonEnd works.
const hitterFiles=y=>[
  `https://baseballsavant.mlb.com/leaderboard/bat-tracking?gameType=Regular&minSwings=q&seasonStart=${y}&seasonEnd=${y}&csv=true`,
  `https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle?gameType=Regular&minSwings=q&seasonStart=${y}&seasonEnd=${y}&csv=true`,
  `https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${y}&position=&team=&min=25&csv=true`];
async function hitterProfiles(y){
  return diskCached(`hitters-${y}.json`,async()=>{
    const files=[];for(const u of hitterFiles(y)){const t=await get(u,true);if(t)files.push(parseCSV(t));}
    const r=M.hittersFrom(files);log(`hitter profiles ${y}: ${r.list.length}`);
    return Object.fromEntries(r.list.map(h=>[h.id,h]));
  });
}
async function seasonStats(y,group){
  return diskCached(`stats-${group}-${y}.json`,async()=>{
    const j=await get(`https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}&season=${y}&sportId=1&limit=5000&playerPool=ALL`);
    return j?j.stats[0].splits.map(s=>({id:String(s.player.id),name:s.player.fullName,pa:s.stat.plateAppearances||s.stat.battersFaced||0,hr:s.stat.homeRuns||0,gs:s.stat.gamesStarted||0})):null;
  });
}
const KEEP=["pitch_type","release_speed","vx0","vy0","vz0","ax","ay","az","batter","events","launch_angle","game_pk","game_date","inning"];
const SEARCH=(id,y)=>`https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfGT=R%7C&hfSea=${y}%7C&player_type=pitcher&pitchers_lookup%5B%5D=${id}&group_by=name&min_pitches=0&min_results=0&min_pas=0&type=details`;
async function pitches(id,y){
  return diskCached(`p-${id}-${y}.json`,async()=>{
    const t=await get(SEARCH(id,y),true);if(t===null)return null;
    return parseCSV(t).map(r=>{const o={};for(const k of KEEP)if(r[k]!=="")o[k]=r[k];return o;});
  });
}
async function pool(items,fn){
  let i=0,done=0;const t0=Date.now();
  await Promise.all([...Array(CONC)].map(async()=>{while(i<items.length){const it=items[i++];await fn(it);done++;
    if(done%50===0)log(`  ${done}/${items.length} (${Math.round((Date.now()-t0)/1000)}s)`);}}));
}

// ---------- analysis ----------
const PA_EVENTS=r=>r.events&&!["truncated_pa"].includes(r.events);
function hrRate(list,prior){ // shrunk HR/PA by id
  const tot=list.reduce((s,x)=>({pa:s.pa+x.pa,hr:s.hr+x.hr}),{pa:0,hr:0}),lg=tot.hr/tot.pa,m={};
  for(const x of list)m[x.id]=(x.hr+lg*prior)/(x.pa+prior);
  return {lg,m};
}
async function season(Y){
  log(`=== test season ${Y} (profiles from ${Y-1}) ===`);
  const H=await hitterProfiles(Y-1);
  const hitStats=await seasonStats(Y-1,"hitting"),pitStatsPrev=await seasonStats(Y-1,"pitching"),pitStats=await seasonStats(Y,"pitching");
  const hRate=hrRate(hitStats,100);
  let pool_=pitStats.filter(p=>p.pa>=MIN_BF&&pitStatsPrev.some(q=>q.id===p.id));
  if(+process.env.LIMIT_PITCHERS)pool_=pool_.sort((a,b)=>b.pa-a.pa).slice(0,+process.env.LIMIT_PITCHERS); // smoke tests
  log(`pitchers: ${pool_.length} with ${MIN_BF}+ BF in ${Y} who also pitched in ${Y-1}; downloading pitch data…`);
  await pool(pool_,async p=>{await pitches(p.id,Y-1);await pitches(p.id,Y);});
  // pitcher profiles + HR allowed, from Y-1
  const P={},pAllowed=[];
  for(const p of pool_){
    const prev=await pitches(p.id,Y-1);if(!prev||prev.length<MIN_PITCHES)continue;
    const prof=M.pitchersFrom([prev.map(r=>({...r,pitcher:p.id}))]).list[0];if(!prof)continue; // parser keys rows by pitcher id
    const pas=prev.filter(PA_EVENTS);pAllowed.push({id:p.id,pa:pas.length,hr:pas.filter(r=>r.events==="home_run").length});
    P[p.id]={...prof,name:p.name};
  }
  const pRate=hrRate(pAllowed,200);
  log(`pitcher profiles: ${Object.keys(P).length}; hitter profiles: ${Object.keys(H).length}`);
  // outcomes in Y, grouped by (game, batter, pitcher)
  const groups=new Map();
  for(const pid of Object.keys(P)){
    const rows=await pitches(pid,Y);if(!rows)continue;
    const starterGames=new Set(rows.filter(r=>r.inning==="1").map(r=>r.game_pk));
    for(const r of rows){
      if(!PA_EVENTS(r)||!H[r.batter])continue;
      const k=`${r.game_pk}|${r.batter}|${pid}`;
      if(!groups.has(k))groups.set(k,{game:r.game_pk,date:r.game_date,batter:r.batter,pitcher:pid,starter:starterGames.has(r.game_pk),pa:0,hr:0,bbe:0,inWin:0});
      const g=groups.get(k);g.pa++;if(r.events==="home_run")g.hr++;
      const la=parseFloat(r.launch_angle);if(!isNaN(la)){g.bbe++;if(la>=25&&la<=35)g.inWin++;}
    }
  }
  // model per (batter, pitcher) pair
  const base={},pair={};
  const rows=[...groups.values()];
  log(`scoring ${rows.length} hitter-game-pitcher matchups…`);
  for(const g of rows){
    const h=H[g.batter],pk=`${g.batter}|${g.pitcher}`;
    if(!base[g.batter])base[g.batter]=M.matchup(h,M.LEAGUE_AVG_PITCHER,FENCE);
    if(!pair[pk]){const m=M.matchup(h,P[g.pitcher],FENCE),b=base[g.batter];
      pair[pk]={win:m.win,mhr:m.hr,edge:m.win-b.win,hrEdge:m.hr-b.hr,gap:m.gap};} // mhr = modeled HR contact (g.hr is the actual count)
    Object.assign(g,pair[pk]);
    const hr=hRate.m[g.batter]??hRate.lg,pf=(pRate.m[g.pitcher]??pRate.lg)/pRate.lg;
    g.expHitter=g.pa*hr;g.expBoth=g.pa*hr*pf;
  }
  // calibrate both baselines to this season's actual HR total
  const tot=rows.reduce((s,g)=>({hr:s.hr+g.hr,a:s.a+g.expHitter,b:s.b+g.expBoth}),{hr:0,a:0,b:0});
  for(const g of rows){g.expHitter*=tot.hr/tot.a;g.expBoth*=tot.hr/tot.b;}
  return {Y,rows,nP:Object.keys(P).length,nH:Object.keys(H).length};
}

// ---------- report ----------
const isEdge=g=>g.edge>=MIN_EDGE&&g.gap>=GAP_LO&&g.gap<=GAP_HI;
function stat(rows){
  const pa=rows.reduce((s,g)=>s+g.pa,0),hr=rows.reduce((s,g)=>s+g.hr,0),eA=rows.reduce((s,g)=>s+g.expHitter,0),eB=rows.reduce((s,g)=>s+g.expBoth,0);
  const bbe=rows.reduce((s,g)=>s+g.bbe,0),inW=rows.reduce((s,g)=>s+g.inWin,0),predW=bbe?rows.reduce((s,g)=>s+g.win*g.bbe,0)/bbe:NaN;
  return {n:rows.length,pa,hr,eA,eB,liftA:hr/eA,liftB:hr/eB,z:(hr-eB)/Math.sqrt(eB),inW:bbe?inW/bbe:NaN,predW};
}
const f2=v=>isFinite(v)?v.toFixed(2):"–",pc=v=>isFinite(v)?(v*100).toFixed(1)+"%":"–",sg=v=>(v>=0?"+":"")+v.toFixed(1);
const rowMd=(label,s)=>`| ${label} | ${s.n.toLocaleString()} | ${s.pa.toLocaleString()} | ${s.hr} | ${s.eB.toFixed(1)} | **${f2(s.liftB)}x** | ${sg(s.z)} | ${f2(s.liftA)}x | ${pc(s.inW)} / ${pc(s.predW)} |`;
const HEAD="| Group | Matchups | PA | HR | Expected | Lift | z | Lift (hitter only) | 25-35° actual / predicted |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|";
function deciles(rows,key){
  const s=rows.slice().sort((a,b)=>a[key]-b[key]),out=[];
  for(let d=0;d<10;d++){const part=s.slice(Math.floor(d*s.length/10),Math.floor((d+1)*s.length/10));
    out.push(rowMd(`D${d+1} (${key} ${part[0][key].toFixed(3)} to ${part[part.length-1][key].toFixed(3)})`,stat(part)));}
  return out;
}
function morningSim(rows){ // the live bot's morning list: starters only, edges, top TOP_N by modeled HR contact per day
  const byDay={};for(const g of rows)if(g.starter&&isEdge(g))(byDay[g.date]=byDay[g.date]||[]).push(g);
  const picked=[];for(const d in byDay)picked.push(...byDay[d].sort((a,b)=>b.mhr-a.mhr).slice(0,TOP_N));
  return picked;
}
function section(r){
  const R=r.rows,st=R.filter(g=>g.starter);
  const rules=[
    ["All matchups (baseline)",R],
    ["Current bot rule: window edge ≥ 3 pts, gap 5-12°",R.filter(isEdge)],
    ["Live bot rule: + HR contact ≥ baseline",R.filter(g=>isEdge(g)&&g.hrEdge>=0)],
    ["Bot rule, but HR contact below baseline",R.filter(g=>isEdge(g)&&g.hrEdge<0)],
    ["Morning alert sim (starters, top 8/day)",morningSim(R)],
    ["Relievers only, live bot rule",R.filter(g=>!g.starter&&isEdge(g)&&g.hrEdge>=0)],
  ];
  return [`## ${r.Y} season (profiles from ${r.Y-1})`,"",
    `${r.nH} hitter profiles, ${r.nP} pitcher profiles, ${R.length.toLocaleString()} hitter-game-pitcher matchups (${st.length.toLocaleString()} vs starters).`,"",
    HEAD,...rules.map(([l,x])=>rowMd(l,stat(x))),"",
    `### By modeled HR-contact edge (deciles)`,"",HEAD,...deciles(R,"hrEdge"),"",
    `### By modeled launch-window edge (deciles)`,"",HEAD,...deciles(R,"edge"),""].join("\n");
}
(async()=>{
  const results=[];for(const Y of SEASONS)results.push(await season(Y));
  const all={Y:SEASONS.join("+"),rows:results.flatMap(r=>r.rows)};
  const md=[`# Launch Angle backtest`,"",
    `Generated ${new Date().toISOString().slice(0,10)} by \`node launch-angle/backtest.js\` (FENCE ${FENCE}, MIN_EDGE ${MIN_EDGE}, gap ${GAP_LO}-${GAP_HI}°).`,"",
    `**How to read it.** Every profile comes from the season *before* the one being tested, so there's no look-ahead. "Expected" HRs come from the hitter's HR/PA and the pitcher's HR/PA allowed (both from the prior season), scaled so the whole season's expected total matches the actual one. **Lift** = actual ÷ expected: 1.00x means the model adds nothing beyond "who's the slugger and who gives up homers". |z| > 2 is where a lift stops looking like noise. "Lift (hitter only)" ignores the pitcher, which is closer to what the results tracker measures.`,"",
    `## Both seasons combined`,"",HEAD,
    rowMd("All matchups (baseline)",stat(all.rows)),
    rowMd("Current bot rule",stat(all.rows.filter(isEdge))),
    rowMd("Live bot rule",stat(all.rows.filter(g=>isEdge(g)&&g.hrEdge>=0))),
    rowMd("Morning alert sim",stat(results.flatMap(r=>morningSim(r.rows)))),"",
    ...results.map(section)].join("\n");
  fs.writeFileSync(OUT,md);log(`wrote ${path.relative(process.cwd(),OUT)}`);
  console.log(md.split("\n").slice(0,16).join("\n"));
})().catch(e=>{console.error(e);process.exit(1);});
