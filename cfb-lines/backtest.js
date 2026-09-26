// Backtest: fit on TRAIN seasons, then grade every season's predictions against CFBD's historical lines.
//   node cfb-lines/backtest.js              fit params (writes params.json) + report
//   BT_FIT=0 node cfb-lines/backtest.js     report only, with the current params.json
// Env: BT_TRAIN (2021,2022), BT_TEST (2023,2024,2025), BT_QB=1 (QB starter changes; ~16 CFBD calls/season),
//      BT_WX=1 (Open-Meteo archive weather at each venue; free, no key), BT_MIN_WEEK (4).
// Honest-scoring rules: ratings for week W use only games before W; priors use only the previous
// season plus preseason talent/returning production. QB changes are read from box scores (who actually
// started), which is a little kinder than real life, where the news sometimes arrives late.
const fs=require("fs"),path=require("path");
process.env.NP_CACHE=process.env.NP_CACHE||path.join(__dirname,".cache");
const {log,summary,normName,getJSON,CACHE}=require("../nfl-props/lib");
const D=require("./data"),M=require("./model"),{C}=M,cfbd=require("./cfbd");

const list=(k,d)=>(process.env[k]||d).split(",").map(Number).filter(Boolean);
const TRAIN=list("BT_TRAIN","2021,2022"),TEST=list("BT_TEST","2023,2024,2025");
const FITP=process.env.BT_FIT!=="0",USE_QB=process.env.BT_QB!=="0",USE_WX=process.env.BT_WX!=="0";
const MIN_WEEK=+(process.env.BT_MIN_WEEK||4);
const SEASONS=[...new Set([...TRAIN,...TEST])].sort();
const CUR=9999;   // every backtest season is finished: cache forever

// ---------- load ----------
async function loadSeason(S,venues){
  const [games,adv,teams,talent,ret]=await Promise.all([D.games(S,CUR),D.advanced(S,CUR),D.teams(S,CUR),D.talent(S,CUR),D.returning(S,CUR)]);
  const fbs=Object.fromEntries(Object.keys(teams).map(t=>[t,true]));
  const prev=await D.games(S-1,CUR),prevAdv=await D.advanced(S-1,CUR),prevTeams=await D.teams(S-1,CUR);
  const prevFinal=M.seasonFinal(prevAdv,prev,Object.fromEntries(Object.keys(prevTeams).map(t=>[t,true])));
  const lines=await D.lines(S,CUR);
  const ctx={S,games,adv,fbs,teams,talent,ret,prevFinal,venues,lines,qb:{},wx:{}};
  if(USE_QB)ctx.qb=await qbChanges(S,games);
  if(USE_WX)ctx.wx=await seasonWeather(S,games,venues);
  log(`${S}: ${games.length} games, ${adv.length} team-game rows, ${Object.keys(lines).length} with lines, CFBD calls this month ${cfbd.usage().calls}`);
  return ctx;
}

// For each game: did each team start someone other than its usual QB (most starts in its last 3 games)?
async function qbChanges(S,games){
  const weeks=[...new Set(games.filter(g=>g.wk<D.POST).map(g=>g.wk))].sort((a,b)=>a-b);
  const box={};for(const w of weeks)Object.assign(box,await D.passers(S,CUR,w));
  const hist={},out={};
  for(const g of games){const B=box[g.id];if(!B)continue;out[g.id]={};
    for(const t of [g.home,g.away]){const st=B[t]&&B[t][0];if(!st||st.att<8)continue;   // < 8 attempts: no clear starter
      const h=hist[t]||(hist[t]=[]),recent=h.slice(-3),c={};for(const id of recent)c[id]=(c[id]||0)+1;
      const usual=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
      if(usual&&recent.length>=2&&usual[0]!==st.id)out[g.id][t]=1;
      h.push(st.id);}
  }
  return out;
}

// Game-window weather from the Open-Meteo archive: one call per venue per season, trimmed and cached.
async function seasonWeather(S,games,venues){
  const file=path.join(CACHE,`wx-${S}.json`);
  if(fs.existsSync(file))return JSON.parse(fs.readFileSync(file,"utf8"));
  const out={},byV={};
  for(const g of games)if(g.wk<D.POST&&venues[g.venueId]&&!venues[g.venueId].dome&&venues[g.venueId].lat!=null)(byV[g.venueId]||(byV[g.venueId]=[])).push(g);
  let n=0;
  for(const [vid,gs] of Object.entries(byV)){const v=venues[vid];
    const day=t=>new Date(t).toISOString().slice(0,10);
    const lo=day(Math.min(...gs.map(g=>g.start))),hi=day(Math.max(...gs.map(g=>g.start))+864e5);
    const j=await getJSON(`https://archive-api.open-meteo.com/v1/archive?latitude=${v.lat}&longitude=${v.lon}&start_date=${lo}&end_date=${hi}`+
      `&hourly=temperature_2m,precipitation,wind_speed_10m&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=GMT`);
    if(++n%25===0)log(`  weather ${S}: ${n}/${Object.keys(byV).length} venues`);
    if(!j||!j.hourly)continue;
    const T=j.hourly.time.map(t=>Date.parse(t+"Z"));
    for(const g of gs){const t0=Math.floor(g.start/36e5)*36e5,ix=[];T.forEach((t,i)=>{if(t>=t0&&t<t0+3*36e5)ix.push(i);});
      if(!ix.length)continue;const avg=k=>ix.reduce((a,i)=>a+(+j.hourly[k][i]||0),0)/ix.length;
      out[g.id]={wind:+avg("wind_speed_10m").toFixed(1),precip:+avg("precipitation").toFixed(3),temp:Math.round(avg("temperature_2m"))};}
    await new Promise(s=>setTimeout(s,150));
  }
  fs.writeFileSync(file,JSON.stringify(out));
  return out;
}

// ---------- predictions for a season ----------
const playable=g=>g.homeFBS&&g.awayFBS&&g.done&&g.wk<D.POST;
function seasonPreds(ctx,{raw=false}={}){
  const out=[],byWk={};
  for(const g of ctx.games)if(playable(g))(byWk[g.wk]||(byWk[g.wk]=[])).push(g);
  for(const wk of Object.keys(byWk).map(Number).sort((a,b)=>a-b)){
    const R=M.ratings(ctx,wk);
    for(const g of byWk[wk]){
      const q=ctx.qb[g.id]||{},w=ctx.wx[g.id];
      const inj={home:q[g.home]?{pts:C.QB_OUT,total:C.QB_TOTAL}:null,away:q[g.away]?{pts:C.QB_OUT,total:C.QB_TOTAL}:null};
      const P=raw?{margin:M.sidePts(R,g.home,g.away)-M.sidePts(R,g.away,g.home),total:M.sidePts(R,g.home,g.away)+M.sidePts(R,g.away,g.home),f:M.features(ctx,g)}
        :M.predict(R,ctx,g,{wx:w?{indoor:false,...w}:null,inj});
      out.push({g,wk,P,am:g.hp-g.ap,at:g.hp+g.ap,L:D.consensus(ctx.lines[g.id]),qH:q[g.home]||0,qA:q[g.away]||0,w});
    }
  }
  return out;
}

// ---------- fitting helpers ----------
// ridge toward prior b0: (X'X + lam*I) b = X'y + lam*b0
function ridge(X,y,b0,lam){
  const k=b0.length,A=Array.from({length:k},()=>Array(k+1).fill(0));
  for(let r=0;r<X.length;r++)for(let i=0;i<k;i++){A[i][k]+=X[r][i]*y[r];for(let j=0;j<k;j++)A[i][j]+=X[r][i]*X[r][j];}
  for(let i=0;i<k;i++){A[i][i]+=lam[i]??lam;A[i][k]+=(lam[i]??lam)*b0[i];}
  for(let i=0;i<k;i++){let p=i;for(let r=i+1;r<k;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;[A[i],A[p]]=[A[p],A[i]];
    for(let r=0;r<k;r++)if(r!==i){const f=A[r][i]/A[i][i];for(let c=i;c<=k;c++)A[r][c]-=f*A[i][c];}}
  return A.map((row,i)=>row[k]/row[i]);
}
const mae=a=>a.reduce((s,x)=>s+Math.abs(x),0)/a.length;

async function fit(ctxs){
  const tr=ctxs.filter(c=>TRAIN.includes(c.S)),F={};
  // (a) efficiency -> points, from actual game rows
  const X=[],y=[];
  for(const c of tr){const G=new Map(c.games.map(g=>[g.id,g]));
    for(const r of c.adv){const g=G.get(r.gid);if(!g||!g.done||!c.fbs[r.team]||!c.fbs[r.opp])continue;
      X.push([1,r.ppa*r.pl,r.sr,r.ex,r.pl]);y.push(g.home===r.team?g.hp:g.ap);}}
  F.PTS=ridge(X,y,[0,0,0,0,0],1e-6).map(v=>+v.toFixed(4));C.PTS=F.PTS;
  log("points map",F.PTS.join(", "),`(${X.length} team-games)`);
  // (b) prior strength: grid on raw margin MAE (vs results, never vs the market)
  let best=null;
  for(const PG of [1.5,2,3,4,6])for(const PR of [0.45,0.6,0.75])for(const TK of [0,0.2,0.4])for(const RK of [0,1]){
    Object.assign(C,{PRIOR_GAMES:PG,PRIOR_REG:PR,TAL_K:TK,RET_K:RK});
    const e=[];for(const c of tr)for(const p of seasonPreds(c,{raw:true}))e.push(p.am-p.P.margin-2.5*p.P.f.home);
    const s=mae(e);if(!best||s<best.s)best={s,PG,PR,TK,RK};
  }
  Object.assign(C,{PRIOR_GAMES:best.PG,PRIOR_REG:best.PR,TAL_K:best.TK,RET_K:best.RK});
  Object.assign(F,{PRIOR_GAMES:best.PG,PRIOR_REG:best.PR,TAL_K:best.TK,RET_K:best.RK});
  log(`priors: PRIOR_GAMES ${best.PG}, PRIOR_REG ${best.PR}, TAL_K ${best.TK}, RET_K ${best.RK} (raw MAE ${best.s.toFixed(2)})`);
  // (c) margin scale + situational coefficients, ridge toward the defaults
  const rows=[];for(const c of tr)rows.push(...seasonPreds(c,{raw:true}));
  const MX=rows.map(p=>[p.P.margin,p.P.f.home,p.P.f.capZ,p.P.f.travel,p.P.f.tz,p.P.f.rest,p.P.f.alt,p.qA-p.qH]);
  const b0=[1,M.DEF.HFA,M.DEF.HFA_CAP,M.DEF.TRAVEL,M.DEF.TZ,M.DEF.REST,M.DEF.ALT,M.DEF.QB_OUT];
  const lam=[0,50,200,300,300,300,100,20];   // how hard each coefficient is pulled to its default
  const b=ridge(MX,rows.map(p=>p.am),b0,lam);
  ["MARGIN_SCALE","HFA","HFA_CAP","TRAVEL","TZ","REST","ALT","QB_OUT"].forEach((k,i)=>{F[k]=+b[i].toFixed(3);C[k]=F[k];});
  // (d) totals: bias + weather + QB, ridge toward defaults
  const wxOf=p=>p.w&&!p.P.f.dome?p.w:null;
  const TX=rows.map(p=>{const w=wxOf(p);return [1,w?Math.max(0,w.wind-C.WIND_MPH):0,w&&w.precip>=C.RAIN_IN?1:0,w&&w.temp<C.COLD_F?1:0,p.qA+p.qH];});
  const tb=ridge(TX,rows.map(p=>p.at-p.P.total),[0,M.DEF.WIND,M.DEF.RAIN,M.DEF.COLD,M.DEF.QB_TOTAL],[0,200,30,30,20]);
  ["TOTAL_BIAS","WIND","RAIN","COLD","QB_TOTAL"].forEach((k,i)=>{F[k]=+tb[i].toFixed(3);C[k]=F[k];});
  const nWind=TX.filter(r=>r[1]>0).length,nRain=TX.filter(r=>r[2]).length;
  log(`fitted: ${JSON.stringify(F)}  (games with wind>${C.WIND_MPH}: ${nWind}, rain: ${nRain})`);
  F._fit={train:TRAIN,at:new Date().toISOString().slice(0,10),games:rows.length};
  fs.writeFileSync(M.PFILE,JSON.stringify(F,null,1)+"\n");
  return F;
}

// ---------- grading ----------
const TH=[0,1,2,3,4,5,6,8,10];
function grade(preds,kind){
  const res=TH.map(t=>({t,close:{w:0,l:0},open:{w:0,l:0},clv:{b:0,n:0,pts:0}}));
  for(const p of preds){
    const L=p.L;if(!L)continue;
    const model=kind==="spread"?p.P.margin:p.P.total,act=kind==="spread"?p.am:p.at;
    const close=kind==="spread"?L.m:L.t,open=(kind==="spread"?L.mOpen:L.tOpen)??close;
    if(close==null)continue;
    // bet at the close: did our side cover the closing number?
    const ec=model-close,dc=act-close;
    // bet at the open (the Sunday first look): cover the opener? and did the market move our way by the close (CLV)?
    const eo=model-open,dopen=act-open,move=(close-open)*Math.sign(eo);
    for(const r of res){
      if(Math.abs(ec)>=r.t&&ec!==0&&dc!==0){(Math.sign(ec)===Math.sign(dc)?r.close.w++:r.close.l++);}
      if(Math.abs(eo)>=r.t&&eo!==0){if(dopen!==0)(Math.sign(eo)===Math.sign(dopen)?r.open.w++:r.open.l++);
        r.clv.n++;r.clv.pts+=move;if(move>0)r.clv.b++;}
    }
  }
  return res;
}
const pct=(w,l)=>w+l?(100*w/(w+l)).toFixed(1)+"%":"-";
function table(title,res){
  const L=[`#### ${title}`,"","| edge ≥ | bets (close) | win% vs close | bets (open) | win% vs open | line moved our way | avg move (pts) |","|---|---|---|---|---|---|---|"];
  for(const r of res)L.push(`| ${r.t} | ${r.close.w+r.close.l} | ${pct(r.close.w,r.close.l)} | ${r.open.w+r.open.l} | ${pct(r.open.w,r.open.l)} | ${r.clv.n?(100*r.clv.b/r.clv.n).toFixed(1)+"%":"-"} | ${r.clv.n?(r.clv.pts/r.clv.n).toFixed(2):"-"} |`);
  return L.join("\n");
}

(async()=>{
  if(!cfbd.hasKey())throw new Error("Set CFBD_API_KEY (free at collegefootballdata.com/key)");
  const venues=await D.venues();
  const ctxs=[];for(const S of SEASONS)ctxs.push(await loadSeason(S,venues));
  if(FITP)await fit(ctxs);
  const md=[`## CFB lines backtest (${new Date().toISOString().slice(0,10)})`,"",
    `Train (params fitted on): ${TRAIN.join(", ")}. Test (never seen by the fit): ${TEST.join(", ")}. Weeks ≥ ${MIN_WEEK}, FBS vs FBS, regular season, consensus (median) line across CFBD's books. Breakeven at -110 is 52.4%.`,""];
  const all={train:[],test:[]};
  for(const c of ctxs){const p=seasonPreds(c).filter(x=>x.wk>=MIN_WEEK);(TRAIN.includes(c.S)?all.train:all.test).push(...p);
    const e=p.filter(x=>x.L&&x.L.m!=null);
    log(`${c.S}: ${p.length} games; model MAE ${mae(p.map(x=>x.am-x.P.margin)).toFixed(2)} vs closing line MAE ${mae(e.map(x=>x.am-x.L.m)).toFixed(2)} (${e.length} w/ lines)`);
    md.push(`- ${c.S}: margin MAE model ${mae(e.map(x=>x.am-x.P.margin)).toFixed(2)} vs closing line ${mae(e.map(x=>x.am-x.L.m)).toFixed(2)}; total MAE model ${mae(e.filter(x=>x.L.t!=null).map(x=>x.at-x.P.total)).toFixed(2)} vs close ${mae(e.filter(x=>x.L.t!=null).map(x=>x.at-x.L.t)).toFixed(2)} (${e.length} games)`);}
  md.push("");
  for(const [k,label] of [["test",`TEST ${TEST.join("+")}`],["train",`train ${TRAIN.join("+")}`]]){
    md.push(table(`Spreads, ${label}`,grade(all[k],"spread")),"",table(`Totals, ${label}`,grade(all[k],"total")),"");}
  const early=[];for(const c of ctxs)if(TEST.includes(c.S))early.push(...seasonPreds(c).filter(x=>x.wk<MIN_WEEK));
  md.push(table(`Spreads, TEST weeks 1-${MIN_WEEK-1} only (priors-heavy)`,grade(early,"spread")),"");
  const out=md.join("\n");console.log("\n"+out);summary(out);
  fs.writeFileSync(path.join(CACHE,"backtest.md"),out);
  log(`CFBD calls this month: ${cfbd.usage().calls}${cfbd.usage().remaining!=null?`, ${cfbd.usage().remaining} left on the key`:""}`);
})().catch(e=>{console.error(e);process.exit(1);});
