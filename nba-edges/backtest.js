// NBA Edges backtest: are the projections and flags better than the player's own average?
// Replays whole regular seasons with the bot's own scoring (run.js projectSide/flagRows) and no look-ahead:
//   stats   - stats.nba.com season-to-date as of the day before each weekly bucket (DateTo), blended with the
//             prior full season exactly like the live bot (blend: ~15 games to trust the current season)
//   game    - ESPN box score: who played (a regular with no minutes counts as ruled out; see caveats) and the
//             spread/total from ESPN's pick center where it exists (Dec 2025 onward), else the bot's pace fallback
//   outcome - the box score line
// Usage: node nba-edges/backtest.js     (SEASONS=2024-25,2025-26; the first season fits, the rest are out of sample)
const fs=require("fs"),path=require("path");
const R=require("./run.js"),M=require("./model");

const SEASONS=(process.env.SEASONS||"2024-25,2025-26").split(",");
const OUT=process.env.OUT||path.join(__dirname,"BACKTEST.md");
const CACHE=path.join(__dirname,".cache","bt");fs.mkdirSync(CACHE,{recursive:true});
const CONC=+(process.env.CONCURRENCY||4);
const {STATS,AVG,ZONE_MIN,BOOST_MIN,ABS_MIN}=R.SETTINGS;
const LABEL={pts:"PTS",reb:"REB",ast:"AST",fg3m:"3PM"};
const log=(...a)=>console.log("[bt]",...a);
const sleep=ms=>new Promise(s=>setTimeout(s,ms));
// regular-season date ranges (ET)
const RANGE={"2023-24":["2023-10-24","2024-04-14"],"2024-25":["2024-10-22","2025-04-13"],"2025-26":["2025-10-21","2026-04-12"]};
const prevSeason=s=>{const y=+s.slice(0,4)-1;return `${y}-${String((y+1)%100).padStart(2,"0")}`;};
const addDays=(d,n)=>{const x=new Date(d+"T12:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const days=(a,b)=>Math.round((new Date(b+"T12:00:00Z")-new Date(a+"T12:00:00Z"))/864e5);
const mdY=d=>`${d.slice(5,7)}%2F${d.slice(8,10)}%2F${d.slice(0,4)}`;

async function diskCached(name,fn){
  const p=path.join(CACHE,name);if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p,"utf8"));
  const v=await fn();if(v!==null&&v!==undefined)fs.writeFileSync(p,JSON.stringify(v));return v;
}
async function getJ(url){
  for(let a=0;a<4;a++){try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(r.ok)return r.json();if(r.status===404)return null;}
    catch(e){}await sleep(1500*(a+1));}
  return null;
}
async function pool(items,fn){let i=0;await Promise.all([...Array(CONC)].map(async()=>{while(i<items.length)await fn(items[i++]);}));}

// ---------- stats snapshots ----------
async function snapshot(season,bucketStart,prev){
  return diskCached(`D-${season}-${bucketStart}.json`,async()=>{
    let cur=null;
    if(bucketStart>RANGE[season][0]){
      const x=`&DateTo=${mdY(addDays(bucketStart,-1))}`;
      cur=await R.nbaSeason(season,x);
      if(cur){const l10=await R.nba("leaguedashplayerstats",season,"MeasureType=Base&LastNGames=10"+x);
        for(const p of l10.objs){const q=cur.players[R.nk(p.PLAYER_NAME)];if(q&&q.GP>=3)q.MIN10=p.MIN;}}
    }
    log(`  snapshot ${season} as of ${addDays(bucketStart,-1)}: ${cur?Object.keys(cur.players).length+" players this season":"prior season only"}`);
    return R.blend(cur,prev);
  });
}
// ---------- ESPN games ----------
const ESPN="https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const abbr=a=>R.ESPN_TO_NBA[a]||a;
async function gamesOn(d){
  return diskCached(`sb-${d}.json`,async()=>{
    const j=await getJ(`${ESPN}/scoreboard?dates=${d.replace(/-/g,"")}`);if(!j)return null;
    return (j.events||[]).filter(e=>e.season&&e.season.type===2&&e.status.type.completed).map(e=>{const c=e.competitions[0],s=h=>c.competitors.find(x=>x.homeAway===h).team.abbreviation;
      return {id:e.id,date:d,home:s("home"),away:s("away")};});
  });
}
async function boxOf(id){
  return diskCached(`g-${id}.json`,async()=>{
    const s=await getJ(`${ESPN}/summary?event=${id}`);if(!s)return null;
    const pc=(s.pickcenter||[])[0]||{},box={};
    for(const t of s.boxscore.players||[]){const g=t.statistics[0],L=g.labels,out=[];
      for(const a of g.athletes||[]){const v=k=>a.stats&&a.stats[L.indexOf(k)];
        out.push({name:a.athlete.displayName,dnp:!!a.didNotPlay||!a.stats||!a.stats.length,min:parseInt(v("MIN"))||0,
          pts:+v("PTS")||0,reb:+v("REB")||0,ast:+v("AST")||0,fg3m:parseInt(String(v("3PT")).split("-")[0])||0});}
      box[t.team.abbreviation]=out;}
    return {details:pc.details||null,total:pc.overUnder||null,box};
  });
}

// ---------- replay ----------
async function replay(season){
  const [start,end]=RANGE[season];
  log(`=== ${season} (${start} to ${end}) ===`);
  const prev=await diskCached(`prev-${prevSeason(season)}.json`,()=>R.nbaSeason(prevSeason(season)));
  const dates=[];for(let d=start;d<=end;d=addDays(d,1))dates.push(d);
  if(+process.env.MAX_DAYS)dates.splice(+process.env.MAX_DAYS); // smoke tests
  const games=[];await pool(dates,async d=>{const g=await gamesOn(d);if(g)games.push(...g);});
  log(`${games.length} games; downloading box scores…`);
  await pool(games,async g=>{g.b=await boxOf(g.id);});
  const recs=[];const snaps={};
  for(const g of games.sort((a,b)=>a.date<b.date?-1:1)){
    if(!g.b)continue;
    const bucket=addDays(start,7*Math.floor(days(start,g.date)/7));
    if(!snaps[bucket])snaps[bucket]=await snapshot(season,bucket,prev);
    const D=snaps[bucket];
    let homeSpread=null;const m=/^(\S+)\s+(-?[\d.]+)$/.exec(g.b.details||"");
    if(g.b.details==="EVEN")homeSpread=0;else if(m)homeSpread=m[1]===g.home?-Math.abs(+m[2]):Math.abs(+m[2]);
    const G={home:{abbr:abbr(g.home)},away:{abbr:abbr(g.away)},total:g.b.total,homeSpread};
    for(const side of ["home","away"]){
      const espnAbbr=g[side],box=g.b.box[espnAbbr]||[],played=new Map(box.filter(x=>!x.dnp&&x.min>0).map(x=>[R.nk(x.name),x]));
      // roster: everyone in the box + this season's regulars on this team; a regular who didn't play is "out"
      const keys=new Set([...box.map(x=>R.nk(x.name)),...Object.values(D.players).filter(p=>p.gpCur>0&&p.team===G[side].abbr).map(p=>p.key)]);
      const team=[...keys].map(k=>D.players[k]).filter(Boolean);
      const out=new Set(team.filter(p=>!played.has(p.key)).map(p=>p.key));
      const S=R.projectSide(team,G,side,D,out);
      const flags=R.flagRows(S,null);
      for(const {p,zone,pr} of S.players){
        const a=played.get(p.key);if(!a)continue;
        const f=flags.filter(r=>r.key===p.key);
        recs.push({season,date:g.date,name:p.name,team:S.me,opp:S.opp,hasLine:!!g.b.total,
          p:{MIN:p.MIN,MIN10:p.MIN10,PTS:p.PTS,REB:p.REB,AST:p.AST,FG3M:p.FG3M,FTM:p.FTM,gpCur:p.gpCur},
          zone:zone&&{ptsFactor:zone.ptsFactor,threesFactor:zone.threesFactor,delta:zone.delta},ctx:S.ctx,pr,
          act:{min:a.min,pts:a.pts,reb:a.reb,ast:a.ast,fg3m:a.fg3m},
          zoneFlag:f.some(r=>r.kind==="zone"),boostFlags:f.filter(r=>r.kind==="boost").map(r=>r.stat)});
      }
    }
  }
  log(`${season}: ${recs.length} player-games scored`);
  return recs;
}

// ---------- analysis ----------
const NOBOOST={pts:1,reb:1,ast:1};
const VARIANTS={
  "full model":r=>r.pr,
  "without shot zones":r=>M.project(r.p,{...r.ctx,zone:null}),
  "without last-10 minutes":r=>M.project({...r.p,MIN10:undefined},{...r.ctx,zone:r.zone}),
  "without game total / pace":r=>M.project(r.p,{...r.ctx,zone:r.zone,env:1}),
  "without opponent REB/AST allowed":r=>M.project(r.p,{...r.ctx,zone:r.zone,oppReb:1,oppAst:1}),
  "without blowout trim":r=>M.project(r.p,{...r.ctx,zone:r.zone,blowout:false}),
  "without teammate-out boost":r=>M.project(r.p,{...r.ctx,zone:r.zone,boost:NOBOOST}),
};
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
function fit(recs,s,proj){ // MAE vs the plain average, and the slope of (actual-avg) on (proj-avg)
  let mA=0,mP=0,sxy=0,sxx=0;const n=recs.length;
  for(const r of recs){const avg=r.p[AVG[s]],pv=proj(r)[s],a=r.act[s];mA+=Math.abs(a-avg);mP+=Math.abs(a-pv);sxy+=(pv-avg)*(a-avg);sxx+=(pv-avg)**2;}
  const k=sxx?sxy/sxx:0;let res=0;for(const r of recs){const avg=r.p[AVG[s]],pv=proj(r)[s],a=r.act[s];res+=(a-avg-k*(pv-avg))**2;}
  return {n,maeAvg:mA/n,maeProj:mP/n,skill:1-mP/mA,k,se:sxx?Math.sqrt(res/(n-1)/sxx):NaN};
}
const f2=v=>isFinite(v)?v.toFixed(2):"–",f3=v=>isFinite(v)?v.toFixed(3):"–",sg=v=>(v>=0?"+":"")+v.toFixed(2),pc=v=>isFinite(v)?(v*100).toFixed(1)+"%":"–";
function flagTable(recs){
  const out=["| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |","|---|---:|---:|---:|---:|---:|"];
  const row=(label,list,stat)=>{if(!list.length)return;const said=mean(list.map(r=>r.pr[stat]-r.p[AVG[stat]])),got=mean(list.map(r=>r.act[stat]-r.p[AVG[stat]]));
    out.push(`| ${label} | ${list.length.toLocaleString()} | ${pc(list.filter(r=>r.act[stat]>r.p[AVG[stat]]).length/list.length)} | ${sg(said)} | **${sg(got)}** | ${f2(got/said)} |`);};
  row("Shot-zone edge (PTS)",recs.filter(r=>r.zoneFlag),"pts");
  for(const s of STATS)row(`Projection boost: ${LABEL[s]}`,recs.filter(r=>r.boostFlags.includes(s)),s);
  // what "beat their average" looks like with no model at all, for reference
  for(const s of STATS){const pool_=recs.filter(r=>r.p.MIN>=20);out.push(`| *(no flag) all rotation players, ${LABEL[s]}* | ${pool_.length.toLocaleString()} | ${pc(pool_.filter(r=>r.act[s]>r.p[AVG[s]]).length/pool_.length)} | – | ${sg(mean(pool_.map(r=>r.act[s]-r.p[AVG[s]])))} | – |`);}
  return out;
}
function fitTable(recs,label){
  const out=[`| ${label} | Stat | Player-games | Error of plain average | Error of projection | Better by | Slope (1 = right size, 0 = noise) |`,"|---|---|---:|---:|---:|---:|---:|"];
  for(const [name,fn] of Object.entries(VARIANTS))for(const s of STATS){const f=fit(recs,s,fn);
    out.push(`| ${name} | ${LABEL[s]} | ${f.n.toLocaleString()} | ${f3(f.maeAvg)} | ${f3(f.maeProj)} | ${pc(f.skill)} | ${f2(f.k)} ± ${f2(f.se)} |`);}
  return out;
}
(async()=>{
  const all={};for(const s of SEASONS)all[s]=await replay(s);
  const [train,...tests]=SEASONS;
  const md=[`# NBA Edges backtest`,"",
    `Generated ${new Date().toISOString().slice(0,10)} by \`node nba-edges/backtest.js\`. The bot's own scoring code (\`run.js\` projectSide/flagRows) replayed over whole regular seasons with **no look-ahead**: stats are season-to-date as of the day before each weekly bucket, blended with the prior season like the live bot.`,"",
    `**How to read it.** "Error" is the average miss in that stat per player-game. The projection has to beat simply using the player's season average. The **slope** asks: when the model says "+2 over his average", how much of that shows up? 1.00 means it's the right size, 0.50 means the real effect is half as big, and 0 means it's noise. **Got ÷ said** is the same idea for the picks the bot would actually alert on.`,"",
    `**Caveats.** (1) ESPN keeps only *current* injury lists, so "ruled out" is "a regular who didn't play". That's slightly optimistic, because real late scratches are known here. (2) Spreads/totals exist only from Dec 2025 on, so earlier games use the bot's pace fallback. (3) Prop lines aren't available historically, so this can't say whether the bot beats the sportsbooks, only whether its projections beat the player's average.`,""];
  for(const s of SEASONS){
    const r=all[s];
    md.push(`## ${s}${s===train?" (fit season)":" (out of sample)"}`,"",`${r.length.toLocaleString()} player-games (rotation players, 20+ min/g, who played).`,"",
      `### Alert flags`,"",...flagTable(r),"",`### Projection accuracy, with each piece removed in turn`,"",...fitTable(r,"Model"),"");
    const lined=r.filter(x=>x.hasLine);
    if(lined.length>1000)md.push(`### Games with a posted total/spread only (${lined.length.toLocaleString()} player-games)`,"",...fitTable(lined,"Model").filter((l,i)=>i<2||/full model|game total/.test(l)),"");
  }
  // shrink the boost to the size that actually showed up in the fit season, then check it out of sample
  md.push(`## Shrinking the projection to its real size`,"",`Fit on ${train}: projection' = average + k × (projection − average), with k = that season's slope. Then applied unchanged to later seasons.`,"",
    "| Season | Stat | k (from fit season) | Error of plain average | Error of raw projection | Error of shrunk projection |","|---|---|---:|---:|---:|---:|");
  const K={};for(const s of STATS)K[s]=Math.max(0,fit(all[train],s,VARIANTS["full model"]).k);
  for(const season of SEASONS)for(const s of STATS){const r=all[season],shr=x=>({[s]:x.p[AVG[s]]+K[s]*(x.pr[s]-x.p[AVG[s]])});
    const raw=fit(r,s,VARIANTS["full model"]),sh=fit(r,s,shr);
    md.push(`| ${season} | ${LABEL[s]} | ${f2(K[s])} | ${f3(raw.maeAvg)} | ${f3(raw.maeProj)} | ${f3(sh.maeProj)} |`);}
  md.push("");
  fs.writeFileSync(OUT,md.join("\n"));log(`wrote ${path.relative(process.cwd(),OUT)}`);
})().catch(e=>{console.error(e);process.exit(1);});
