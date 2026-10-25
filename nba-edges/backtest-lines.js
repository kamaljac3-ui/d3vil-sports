// NBA game-lines backtest: does the lines.js model know anything the closing line doesn't?
// Replays whole regular seasons with no look-ahead: ratings are refit before every game day from that season's earlier
// results, seeded by the prior season's final ratings. Lines are ESPN's (core API) opening and closing spread/total.
// Injuries: "a regular who didn't play" from the box score (like backtest.js; slightly optimistic, see its caveats),
// with player averages from backtest.js's weekly nba.com snapshots in .cache/bt (run that first).
// Usage: node nba-edges/backtest-lines.js   (fits on 2024-25, checks 2025-26; 2023-24 is only the prior)
const fs=require("fs"),path=require("path");
const L=require("./lines"),R=require("./run.js");

const OUT=process.env.OUT||path.join(__dirname,"BACKTEST-LINES.md");
const CACHE=path.join(__dirname,".cache","bt");fs.mkdirSync(CACHE,{recursive:true});
const CONC=+(process.env.CONCURRENCY||6);
const log=(...a)=>console.log("[btl]",...a);
const sleep=ms=>new Promise(s=>setTimeout(s,ms));
const SEASONS={"2023-24":{y:2024,start:"2023-10-24"},"2024-25":{y:2025,start:"2024-10-22"},"2025-26":{y:2026,start:"2025-10-21"}};
const FIT="2024-25",TEST="2025-26";
const TEAM_IDS=[1,2,17,30,4,5,6,7,8,9,10,11,12,13,29,14,15,16,3,18,25,19,20,21,22,23,24,28,26,27];
const addDays=(d,n)=>{const x=new Date(d+"T12:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const days=(a,b)=>Math.round((new Date(b+"T12:00:00Z")-new Date(a+"T12:00:00Z"))/864e5);
const etDate=iso=>new Date(iso).toLocaleDateString("en-CA",{timeZone:"America/New_York"});

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

// ---------- data ----------
async function results(season){
  const y=SEASONS[season].y,byId={};
  await pool(TEAM_IDS,async id=>{
    const j=await diskCached(`ts-${id}-${y}.json`,()=>getJ(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}/schedule?season=${y}&seasontype=2`));
    for(const e of (j&&j.events)||[]){const c=e.competitions[0];if(!c.status||!c.status.type.completed)continue;
      const t=h=>c.competitors.find(x=>x.homeAway===h),H=t("home"),A=t("away");
      byId[e.id]={id:e.id,date:e.date,day:etDate(e.date),home:H.team.abbreviation,away:A.team.abbreviation,hs:+H.score.value,as:+A.score.value,neutral:!!c.neutralSite};}
  });
  return Object.values(byId).filter(g=>g.hs>0&&g.as>0).sort((a,b)=>a.date<b.date?-1:1);
}
const num=v=>{const x=parseFloat(String(v==null?"":v).replace("+",""));return isFinite(x)?x:null;};
async function odds(id){
  return diskCached(`od-${id}.json`,async()=>{
    const j=await getJ(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/${id}/competitions/${id}/odds`);
    const x=j&&(j.items||[]).find(i=>i.overUnder!=null||i.spread!=null);if(!x)return {};
    const h=x.homeTeamOdds||{},ps=o=>o&&o.pointSpread&&num(o.pointSpread.american);
    return {book:x.provider&&x.provider.name,openSpread:ps(h.open),closeSpread:ps(h.close)??num(x.spread),
      openTotal:num(x.open&&x.open.total&&x.open.total.american),closeTotal:num(x.close&&x.close.total&&x.close.total.american)??num(x.overUnder)};
  });
}
const fileMemo=new Map(),readMemo=p=>{if(!fileMemo.has(p))fileMemo.set(p,fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):null);return fileMemo.get(p);};
// Who was out, per game. Rosters come from the box scores themselves, walked in date order: nba.com's historical
// snapshots list each player's CURRENT team (Anthony Davis shows up on DAL in Jan 2025), so they can't say who was on
// a team that night. A player belongs to the team he last played for; he's "out" if he's on it, didn't play, and wasn't
// a coach's decision. His averages (MIN/PTS/REB/AST) come from that week's snapshot; gpCur = games for this team.
const OUTS={};
function precomputeOuts(season,games){
  const start=SEASONS[season].start,teams={},lastTeam={},res={};
  for(const g of games){
    const bt=readMemo(path.join(CACHE,`g2-${g.id}.json`));fileMemo.delete(path.join(CACHE,`g2-${g.id}.json`));
    const D=readMemo(path.join(CACHE,`D-${season}-${addDays(start,7*Math.floor(days(start,g.day)/7))}.json`));
    if(!bt){res[g.id]=null;continue;}
    const r={};
    for(const side of ["home","away"]){
      const ab=g[side],box=bt.box[ab]||[],T=teams[ab]||(teams[ab]={games:0,apps:{}});
      const played=new Set(box.filter(x=>!x.dnp&&x.min>0).map(x=>R.nk(x.name))),cd=new Set(box.filter(x=>x.dnp&&/coach/i.test(x.reason)).map(x=>R.nk(x.name)));
      const out=[];
      for(const k in T.apps){if(played.has(k)||cd.has(k))continue;const p=D&&D.players[k];if(p)out.push({...p,gpCur:T.apps[k]});}
      r[side]={value:L.outValue(out,T.games),names:out.filter(p=>p.MIN>=15&&p.gpCur>=0.6*T.games).map(p=>p.name)};
      T.games++;
      for(const k of played){if(lastTeam[k]&&lastTeam[k]!==ab)delete teams[lastTeam[k]].apps[k];lastTeam[k]=ab;T.apps[k]=(T.apps[k]||0)+1;}
    }
    res[g.id]=D?r:null;
  }
  OUTS[season]=res;
}
const outFor=(g,season)=>OUTS[season]?OUTS[season][g.id]:null;

// ---------- replay ----------
function replay(season,games,prior,p,ctxOf){
  const recs=[];const byDay={};for(const g of games)(byDay[g.day]=byDay[g.day]||[]).push(g);
  for(const d of Object.keys(byDay).sort()){
    const before=games.filter(g=>g.day<d),Rt=L.fitRatings(before,d+"T12:00:00Z",prior,p);
    for(const g of byDay[d]){
      const c=ctxOf?ctxOf(g,before):{};
      const pr=L.predict(g,Rt,c,p);
      recs.push({season,day:d,g,c,pr,gp:Math.min(before.filter(x=>x.home===g.home||x.away===g.home).length,before.filter(x=>x.home===g.away||x.away===g.away).length),
        margin:g.hs-g.as,total:g.hs+g.as});
    }
  }
  return recs;
}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
const mse=(recs,f)=>mean(recs.map(f).map(x=>x*x));
const pc=v=>isFinite(v)?(v*100).toFixed(1)+"%":"–",f2=v=>isFinite(v)?v.toFixed(2):"–",sg=v=>(v>=0?"+":"")+f2(v);
// least squares slope of y on x (no intercept), with its standard error
function slope(xs,ys){let sxy=0,sxx=0;xs.forEach((x,i)=>{sxy+=x*ys[i];sxx+=x*x;});const b=sxx?sxy/sxx:0;let r=0;xs.forEach((x,i)=>{r+=(ys[i]-b*x)**2;});return {b,se:Math.sqrt(r/Math.max(1,xs.length-1)/sxx)};}

(async()=>{
  const G={};for(const s of Object.keys(SEASONS)){G[s]=await results(s);log(`${s}: ${G[s].length} games`);}
  for(const s of [FIT,TEST]){let n=0;await pool(G[s],async g=>{g.odds=await odds(g.id);if(++n%300===0)log(`  odds ${s} ${n}/${G[s].length}`);});}
  for(const s of [FIT,TEST])precomputeOuts(s,G[s]);
  const ctxOf=season=>(g,before)=>{const o=outFor(g,season);
    return {restH:L.restDays(before,g.home,g.date),restA:L.restDays(before,g.away,g.date),outH:o?o.home.value:0,outA:o?o.away.value:0,outNames:o&&{home:o.home.names,away:o.away.names},hasOut:!!o};};
  const priorOf=(s,p)=>{const prev=Object.keys(SEASONS)[Object.keys(SEASONS).indexOf(s)-1];if(!prev)return null;
    const pp=Object.keys(SEASONS)[Object.keys(SEASONS).indexOf(prev)-1];
    return L.fitRatings(G[prev],G[prev][G[prev].length-1].date,pp?priorOf(prev,p):null,p);};

  // 1) rating settings, picked on the fit season by squared error of the margin and total vs the result (no lines used)
  const md=[];const grid=[];
  const base={...L.LP,B2B:0,INJ:0,INJ_TOTAL:0};
  const hl=[20,30,45,70,120],pg=[4,8,15],rg=[0.4,0.6,0.8];
  for(const HALF_LIFE of hl)for(const PRIOR_GAMES of pg)for(const REGRESS of rg){
    const p={...base,HALF_LIFE,PRIOR_GAMES,REGRESS},r=replay(FIT,G[FIT],priorOf(FIT,p),p);
    grid.push({p,m:mse(r,x=>x.margin-x.pr.margin),t:mse(r,x=>x.total-x.pr.total)});
  }
  grid.sort((a,b)=>(a.m+a.t)-(b.m+b.t));const P0=grid[0].p;
  log(`picked half-life ${P0.HALF_LIFE}, prior games ${P0.PRIOR_GAMES}, regress ${P0.REGRESS} (margin MSE ${grid[0].m.toFixed(1)}, total MSE ${grid[0].t.toFixed(1)})`);
  // 2) home court, back-to-back and injuries: least squares on the fit season's residuals
  let fitRecs=replay(FIT,G[FIT],priorOf(FIT,P0),P0,ctxOf(FIT));
  const hcaHat=mean(fitRecs.filter(x=>!x.g.neutral).map(x=>x.margin-(x.pr.margin-P0.HCA)));
  const P1={...P0,HCA:+hcaHat.toFixed(2)};fitRecs=replay(FIT,G[FIT],priorOf(FIT,P1),P1,ctxOf(FIT));
  // FIT_TO=results to fit back-to-back and injuries to game results; by default (market) they're fit to the closing line. Results are so noisy
  // (13-14 pt RMSE) that a real injury effect barely registers; the closing line prices injuries far more precisely.
  const toMarket=process.env.FIT_TO!=="results";   // default: market
  if(toMarket)fitRecs=fitRecs.filter(x=>x.g.odds&&x.g.odds.closeSpread!=null&&x.g.odds.closeTotal!=null);
  const res=fitRecs.map(x=>(toMarket?-x.g.odds.closeSpread:x.margin)-x.pr.margin),b2bX=fitRecs.map(x=>(x.c.restA===1?1:0)-(x.c.restH===1?1:0)),injX=fitRecs.map(x=>x.c.outA-x.c.outH);
  // two-variable least squares
  const sxx=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),A=[[sxx(b2bX,b2bX),sxx(b2bX,injX)],[sxx(b2bX,injX),sxx(injX,injX)]],bv=[sxx(b2bX,res),sxx(injX,res)];
  const det=A[0][0]*A[1][1]-A[0][1]*A[1][0],B2B=(bv[0]*A[1][1]-A[0][1]*bv[1])/det,INJ=(A[0][0]*bv[1]-A[1][0]*bv[0])/det;
  const tres=fitRecs.map(x=>(toMarket?x.g.odds.closeTotal:x.total)-x.pr.total),injT=fitRecs.map(x=>-(x.c.outA+x.c.outH)),INJ_TOTAL=sxx(injT,tres)/sxx(injT,injT);
  // NO_INJ=1: drop the injury terms, to check that results against the opening line don't lean on knowing who sat
  const P={...P1,B2B:+B2B.toFixed(2),INJ:process.env.NO_INJ==="1"?0:+INJ.toFixed(3),INJ_TOTAL:process.env.NO_INJ==="1"?0:+INJ_TOTAL.toFixed(3)};
  log(`HCA ${P.HCA}, B2B ${P.B2B}, INJ ${P.INJ}, INJ_TOTAL ${P.INJ_TOTAL}`);
  const RECS={[FIT]:replay(FIT,G[FIT],priorOf(FIT,P),P,ctxOf(FIT)),[TEST]:replay(TEST,G[TEST],priorOf(TEST,P),P,ctxOf(TEST))};

  // 3) against the market
  md.push(`# NBA Lines backtest`,"",`Generated ${new Date().toISOString().slice(0,10)} by \`node nba-edges/backtest-lines.js\`. \`lines.js\` ratings refit before every game day from that season's earlier results (no look-ahead), seeded by last season's final ratings. Lines are ESPN's opening and closing numbers (core API; ESPN BET, or whichever book ESPN lists first). Settings picked on ${FIT}; ${TEST} is out of sample. "Ruled out" = a regular who didn't play (optimistic: the live bot only knows the injury report).`,"",
    `**Picked settings:** half-life ${P.HALF_LIFE} days, prior worth ${P.PRIOR_GAMES} games, last season regressed ×${P.REGRESS}, home court ${P.HCA}, back-to-back ${P.B2B}, injuries ${P.INJ} margin and ${P.INJ_TOTAL} total per point of value out (back-to-back and injuries fit to ${toMarket?"the closing line":"results"}).`,"",
    "The one question that matters: **when the model disagrees with the line, does the result move with the model?** \"Slope\" is the share of the model's disagreement that showed up in results, (result − line) on (model − line): 1 means the model is right and the line is wrong, 0 means the line already knew. ATS/totals records are against the closing line; pushes excluded; break-even at -110 is 52.4%.","");
  for(const s of [FIT,TEST]){
    const r=RECS[s].filter(x=>x.g.odds&&x.g.odds.closeSpread!=null&&x.g.odds.closeTotal!=null);
    const mk=x=>-x.g.odds.closeSpread,er=x=>x.pr.margin-mk(x),et=x=>x.pr.total-x.g.odds.closeTotal;
    const ss=slope(r.map(er),r.map(x=>x.margin-mk(x))),st=slope(r.map(et),r.map(x=>x.total-x.g.odds.closeTotal));
    md.push(`## ${s}${s===FIT?" (fit)":" (out of sample)"}`,"",`${r.length} games with closing lines (of ${RECS[s].length}).`,"",
      `| | Model error | Closing-line error | Slope (result − line on model − line) |`,`|---|---:|---:|---:|`,
      `| Margin (RMSE) | ${Math.sqrt(mse(r,x=>x.margin-x.pr.margin)).toFixed(2)} | ${Math.sqrt(mse(r,x=>x.margin-mk(x))).toFixed(2)} | ${f2(ss.b)} ± ${f2(ss.se)} |`,
      `| Total (RMSE) | ${Math.sqrt(mse(r,x=>x.total-x.pr.total)).toFixed(2)} | ${Math.sqrt(mse(r,x=>x.total-x.g.odds.closeTotal)).toFixed(2)} | ${f2(st.b)} ± ${f2(st.se)} |`,"",
      `| Disagreement with closing line | Spread picks | Spread record | Total picks | Total record |`,`|---|---:|---:|---:|---:|`);
    for(const [lo,hi] of [[0,1],[1,2],[2,3],[3,4],[4,6],[6,99],[2,99],[3,99]]){
      const rec=(arr,e,res)=>{let w=0,l=0;for(const x of arr){const d=e(x);if(!(Math.abs(d)>=lo&&Math.abs(d)<hi))continue;const v=res(x);if(v===0)continue;if(Math.sign(v)===Math.sign(d))w++;else l++;}return [w,l];};
      const [sw,sl]=rec(r,er,x=>x.margin-mk(x)),[tw,tl]=rec(r,et,x=>x.total-x.g.odds.closeTotal);
      md.push(`| ${hi===99?lo+"+":lo+"–"+hi} pts | ${sw+sl} | ${sw}-${sl} (${pc(sw/(sw+sl))}) | ${tw+tl} | ${tw}-${tl} (${pc(tw/(tw+tl))}) |`);
    }
    // line movement: does the close move toward the model from the open?
    const mv=r.filter(x=>x.g.odds.openSpread!=null&&x.g.odds.openTotal!=null);
    const toward=(arr,e0,mvf,lo)=>{const a=arr.filter(x=>Math.abs(e0(x))>=lo);let t=0,aw=0,sum=0;for(const x of a){const m=mvf(x)*Math.sign(e0(x));sum+=m;if(m>0)t++;else if(m<0)aw++;}return {n:a.length,t,aw,avg:sum/Math.max(1,a.length)};};
    const eo=x=>x.pr.margin-(-x.g.odds.openSpread),ms=x=>(-x.g.odds.closeSpread)-(-x.g.odds.openSpread);
    const eto=x=>x.pr.total-x.g.odds.openTotal,mt=x=>x.g.odds.closeTotal-x.g.odds.openTotal;
    md.push("",`**Open → close** (${mv.length} games with both): when the model disagreed with the *opening* line by 2+ / 4+ pts, how often the line then moved toward the model, and the average move in the model's direction. Betting at the open only pays if the close keeps coming your way.`,"",
      `| | Disagreement | Games | Moved toward model | Moved away | Avg move toward model |`,`|---|---|---:|---:|---:|---:|`);
    for(const lo of [2,4]){const a=toward(mv,eo,ms,lo),b=toward(mv,eto,mt,lo);
      md.push(`| Spread | ${lo}+ | ${a.n} | ${a.t} | ${a.aw} | ${sg(a.avg)} |`,`| Total | ${lo}+ | ${b.n} | ${b.t} | ${b.aw} | ${sg(b.avg)} |`);}
    // record against the opening line (what a morning alert could actually bet)
    const ro=(e,res,lo)=>{let w=0,l=0;for(const x of mv){const d=e(x);if(Math.abs(d)<lo)continue;const v=res(x);if(v===0)continue;if(Math.sign(v)===Math.sign(d))w++;else l++;}return `${w}-${l} (${pc(w/(w+l))})`;};
    md.push("",`Against the **opening** line: spread 3+ pts ${ro(eo,x=>x.margin+x.g.odds.openSpread,3)}, 5+ pts ${ro(eo,x=>x.margin+x.g.odds.openSpread,5)}; total 4+ pts ${ro(eto,x=>x.total-x.g.odds.openTotal,4)}, 6+ pts ${ro(eto,x=>x.total-x.g.odds.openTotal,6)}.`,"");
    log(`${s}: margin slope ${f2(ss.b)}±${f2(ss.se)}, total slope ${f2(st.b)}±${f2(st.se)}`);
  }
  md.push(`## Settings grid (${FIT}, squared error vs results, no lines)`,"",`| Half-life | Prior games | Regress | Margin MSE | Total MSE |`,`|---:|---:|---:|---:|---:|`,
    ...grid.slice(0,10).map(x=>`| ${x.p.HALF_LIFE} | ${x.p.PRIOR_GAMES} | ${x.p.REGRESS} | ${x.m.toFixed(1)} | ${x.t.toFixed(1)} |`),"",
    "Env for the picked settings: `"+["HALF_LIFE","PRIOR_GAMES","REGRESS","HCA","B2B","INJ","INJ_TOTAL"].map(k=>`NBA_LINES_${k}=${P[k]}`).join(" ")+"`","");
  fs.writeFileSync(OUT,md.join("\n"));log(`wrote ${path.relative(process.cwd(),OUT)}`);
})().catch(e=>{console.error(e);process.exit(1);});
