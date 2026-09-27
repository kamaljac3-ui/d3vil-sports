// Research: does wind DIRECTION (along the field vs. across it) matter beyond wind speed?
//   node nfl-lines/research/wind-direction.js      (FROM=1999 TO=2025)
// - Field orientation: the long axis of each stadium's football pitch from OpenStreetMap
//   (demolished stadiums have no pitch left, so their games are skipped).
// - Wind at kickoff (+1 h): Open-Meteo historical archive (ERA5 reanalysis, ~10-30 km grid,
//   10 m above ground - NOT the swirl inside a stadium bowl).
// - Outcomes: combined passing yards vs. both teams' season norms, and total points vs. the closing total.
const fs=require("fs"),path=require("path");
const {parseCSV,getText,etToUtc,log,env}=require("../../nfl-props/lib");

const FROM=env("FROM",1999),TO=env("TO",2025);
const CACHE=path.join(__dirname,".cache");fs.mkdirSync(CACHE,{recursive:true});
const OVERPASS=process.env.OVERPASS||"https://maps.mail.ru/osm/tools/overpass/api/interpreter";
const {ST}=require("./stadiums");
const d2r=Math.PI/180,sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---------- field orientation from OpenStreetMap ----------
async function orientation(sid){
  const p=path.join(CACHE,"orient.json"),all=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};
  if(sid in all)return all[sid];
  // the pitch outline; fallback: the stadium bowl, whose long axis runs with the field
  const [lat,lon]=ST[sid],q=`[out:json][timeout:25];(way(around:500,${lat},${lon})["leisure"="pitch"];way(around:400,${lat},${lon})["leisure"="stadium"];);out geom tags;`;
  let j=null;
  for(let a=0;a<3&&!j;a++){const r=await fetch(`${OVERPASS}?data=${encodeURIComponent(q)}`,{headers:{"User-Agent":"d3vil-sports-research/1.0"}}).catch(()=>null);
    if(r&&r.ok)j=await r.json().catch(()=>null);else await sleep(5000);}
  let best=null;
  for(const w of (j&&j.elements)||[]){
    const bowl=(w.tags||{}).leisure==="stadium",s=(w.tags||{}).sport||"";if(!bowl&&s&&!/american_football|football/.test(s))continue;
    const g=w.geometry||[];if(g.length<4)continue;
    // local x/y in meters, principal axis of the outline = the long axis of the field
    const cy=g.reduce((a,v)=>a+v.lat,0)/g.length,cx=g.reduce((a,v)=>a+v.lon,0)/g.length,k=Math.cos(cy*d2r);
    const pts=g.map(v=>[(v.lon-cx)*111320*k,(v.lat-cy)*110540]);
    let sxx=0,syy=0,sxy=0;for(const [x,y] of pts){sxx+=x*x;syy+=y*y;sxy+=x*y;}
    const ang=0.5*Math.atan2(2*sxy,sxx-syy);                   // radians from east
    const bearing=((90-ang/d2r)%180+180)%180;                   // compass bearing of the long axis, 0-180
    const dist=Math.hypot((cx-lon)*111320*k,(cy-lat)*110540);
    const xs=pts.map(p=>p[0]*Math.cos(ang)+p[1]*Math.sin(ang)),ys=pts.map(p=>-p[0]*Math.sin(ang)+p[1]*Math.cos(ang));
    const len=Math.max(...xs)-Math.min(...xs),wid=Math.max(...ys)-Math.min(...ys);
    if(bowl?(len<150||len/wid<1.1):(len<80||len/wid<1.3))continue;   // not a football field / bowl shape
    const cand={bearing:+bearing.toFixed(1),dist:Math.round(dist),len:Math.round(len),src:bowl?"bowl":"pitch"};
    if(!best||(best.src==="bowl"&&!bowl)||(best.src===cand.src&&dist<best.dist))best=cand;
  }
  all[sid]=best;fs.writeFileSync(p,JSON.stringify(all,null,1));
  log(`orientation ${sid}: ${best?`${best.bearing}° (${best.src} ${best.len} m, ${best.dist} m from stadium point)`:"not found"}`);
  await sleep(1500);return best;
}

// ---------- wind archive ----------
async function seasonWind(sid,season){
  const [lat,lon]=ST[sid],p=path.join(CACHE,`wind_${lat.toFixed(2)}_${lon.toFixed(2)}_${season}.json`);
  if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p,"utf8"));
  const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${season}-08-01&end_date=${season+1}-02-20`+
    `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=mph&timezone=GMT`;
  for(let a=0;a<5;a++){const r=await fetch(url).catch(()=>null);
    if(r&&r.ok){const j=await r.json();const o={t0:Date.parse(j.hourly.time[0]+"Z"),spd:j.hourly.wind_speed_10m,dir:j.hourly.wind_direction_10m,gust:j.hourly.wind_gusts_10m};
      fs.writeFileSync(p,JSON.stringify(o));return o;}
    const wait=r&&r.status===429?60000:3000*(a+1);log(`wind ${r?r.status:"error"} ${sid} ${season}, retry in ${wait/1000}s`);await sleep(wait);}
  return null;
}

const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/(a.length-1));};
function row(label,G){
  if(G.length<20)return `| ${label} | ${G.length} | (too few) | | |`;
  const py=G.map(g=>g.pyRes),tt=G.map(g=>g.totRes),c=tt.filter(x=>x!==0);
  const f=(a)=>{const m=mean(a),se=sd(a)/Math.sqrt(a.length);return `${m>=0?"+":""}${m.toFixed(1)} ± ${se.toFixed(1)}${Math.abs(m/se)>=2?" *":""}`;};
  return `| ${label} | ${G.length} | ${f(py)} | ${f(tt)} | ${(100*c.filter(x=>x<0).length/c.length).toFixed(1)}% |`;
}

(async()=>{
  const games=parseCSV(await getText("https://github.com/nflverse/nfldata/raw/master/data/games.csv"))
    .filter(g=>+g.season>=FROM&&+g.season<=TO&&g.result!==""&&g.total_line!==""&&(g.roof==="outdoors"||g.roof==="open")&&ST[g.stadium_id])
    .map(g=>({...g,season:+g.season,kick:etToUtc(g.gameday,g.gametime||"13:00").getTime(),tot:+g.home_score+ +g.away_score,line:+g.total_line}));
  log(`${games.length} outdoor games`);

  // passing yards per team-game (nflverse weekly player stats), and season norms excluding the game itself
  const PY={};
  for(let y=FROM;y<=TO;y++){
    const t=await getText(`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${y}.csv.gz`);
    if(!t){log("no player stats for",y);continue;}
    for(const r of parseCSV(t,["game_id","team","opponent_team","passing_yards"]))if(r.game_id&&r.passing_yards!==""){
      const k=r.game_id+"|"+r.team;PY[k]=PY[k]||{gid:r.game_id,team:r.team,opp:r.opponent_team,y:0};PY[k].y+=+r.passing_yards;}
  }
  const off={},def={};   // season|team -> [yards]
  for(const v of Object.values(PY)){const s=v.gid.slice(0,4);(off[s+"|"+v.team]||(off[s+"|"+v.team]=[])).push([v.gid,v.y]);(def[s+"|"+v.opp]||(def[s+"|"+v.opp]=[])).push([v.gid,v.y]);}
  const norm=(tbl,s,team,gid)=>{const l=(tbl[s+"|"+team]||[]).filter(x=>x[0]!==gid);return l.length>=4?mean(l.map(x=>x[1])):null;};

  const rows=[];let done=0;
  for(const g of games){
    const o=await orientation(g.stadium_id);if(!o)continue;
    const w=await seasonWind(g.stadium_id,g.season);if(!w)continue;
    const i=Math.round((g.kick+36e5-w.t0)/36e5);if(!(i>=0&&i<w.spd.length)||w.dir[i]==null)continue;
    const s=String(g.season),ph=PY[g.game_id+"|"+g.home_team],pa=PY[g.game_id+"|"+g.away_team];
    const eh=[norm(off,s,g.home_team,g.game_id),norm(def,s,g.away_team,g.game_id)],ea=[norm(off,s,g.away_team,g.game_id),norm(def,s,g.home_team,g.game_id)];
    if(!ph||!pa||eh.includes(null)||ea.includes(null))continue;
    const align=Math.abs(Math.cos((w.dir[i]-o.bearing)*d2r));   // 1 = straight down the field, 0 = straight across
    rows.push({g,spd:w.spd[i],gust:w.gust[i],align,pyRes:ph.y+pa.y-mean(eh)-mean(ea),totRes:g.tot-g.line});
    if(++done%500===0)log(`${done} games with wind + orientation`);
  }
  const along=r=>r.align>=0.8,across=r=>r.align<=0.45;
  const band=(lo,hi)=>rows.filter(r=>r.spd>=lo&&r.spd<hi);
  let md=`# Wind direction vs. passing and totals, outdoor games ${FROM}-${TO}\n\n`+
    `Along = wind within ~37° of the field's long axis (|cos| ≥ 0.8); across = more than ~63° off it (|cos| ≤ 0.45).\n`+
    `Pass yds = combined passing yards minus both teams' season norms. Total = points minus the closing total. * = 2+ SE.\n\n`+
    `| wind at kickoff | games | pass yds vs norm | total vs line | under % |\n|---|---|---|---|---|\n`+
    [row("Calm (< 8 mph)",band(0,8)),row("8-12 mph",band(8,12)),row("12-16 mph",band(12,16)),row("16+ mph",band(16,99)),
     row("**12+ mph, along the field**",band(12,99).filter(along)),row("**12+ mph, across the field**",band(12,99).filter(across)),
     row("16+ mph, along",band(16,99).filter(along)),row("16+ mph, across",band(16,99).filter(across)),
     row("8-12 mph, along",band(8,12).filter(along)),row("8-12 mph, across",band(8,12).filter(across))].join("\n")+"\n";
  // orientation table for the record
  const O=JSON.parse(fs.readFileSync(path.join(CACHE,"orient.json"),"utf8"));
  md+=`\nField bearings used (0° = north-south): ${Object.entries(O).filter(([,v])=>v).map(([k,v])=>`${k} ${v.bearing}°`).join(", ")}.\n`+
    `Not found (demolished or unmapped): ${Object.entries(O).filter(([,v])=>!v).map(([k])=>k).join(", ")||"none"}.\n`;
  fs.writeFileSync(path.join(__dirname,"wind-direction-results.md"),md);console.log(md);
})().catch(e=>{console.error(e);process.exit(1);});
