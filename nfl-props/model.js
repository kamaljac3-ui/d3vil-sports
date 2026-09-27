// Projection model: opportunity x matchup x environment.
// Every constant can be overridden with an env var of the same name.
const {env}=require("./lib");
const {ord}=require("./data");

const C={
  HL_TEAM:env("HL_TEAM",6),     // half-life (games) for team pace / pass rate / defense
  HL_SHARE:env("HL_SHARE",4),   // half-life for target / carry share per snap
  HL_SNAP:env("HL_SNAP",2),     // half-life for snap share (reacts fastest to role changes)
  HL_EFF:env("HL_EFF",10),      // half-life for efficiency (yards per target / carry / dropback)
  PRIOR_W:env("PRIOR_W",0.35),  // weight on last season's games vs this season's
  K_YPT:env("K_YPT",40),K_CATCH:env("K_CATCH",40),K_YPC:env("K_YPC",60),K_QB:env("K_QB",150),
  K_DEF_REC:env("K_DEF_REC",150),K_DEF_RUN:env("K_DEF_RUN",200),K_DEF_PASS:env("K_DEF_PASS",300),
  K_SPLIT:env("K_SPLIT",40),K_DEF_FREQ:env("K_DEF_FREQ",200),K_TEAM:env("K_TEAM",3),
  SCRIPT_K:env("SCRIPT_K",0.006), // pass-rate change per point of expected margin
  PTS_K:env("PTS_K",0.15),        // play-volume elasticity to implied team total
  REDIST:env("REDIST",0.85),      // share of a missing player's usage that goes to projected teammates
  SHARE_CAP:env("SHARE_CAP",0.95),
  QB_SHARE:env("QB_SHARE",0.97),  // starter's share of team dropbacks (backups, trick plays take the rest)// max total target/carry share across a team's projected players
  // wind: passing already drops ~16 yds (both teams) at 8-12 mph and ~53 at 16+ (research/wind-direction.js)
  WIND_MIN:env("WIND_MIN",8),WIND_PASS_K:env("WIND_PASS_K",0.009),WIND_RATE_K:env("WIND_RATE_K",0.003),RAIN_MULT:env("RAIN_MULT",0.96),
  // at 12+ mph a crosswind hurts passing more than wind along the field (~43 vs ~26 yds): scale the wind effect
  DIR_MIN:env("DIR_MIN",12),DIR_CROSS:env("DIR_CROSS",1.3),DIR_ALONG:env("DIR_ALONG",0.8),
};
// Spread of outcomes: sd = A * mean^B, fit from the 2025 backtest (see README).
const SD={recYds:[env("SD_RECYDS_A",4.94),env("SD_RECYDS_B",0.49)],rec:[env("SD_REC_A",1.20),env("SD_REC_B",0.45)],
  rushYds:[env("SD_RUSHYDS_A",6.31),env("SD_RUSHYDS_B",0.41)],passYds:[env("SD_PASSYDS_A",5.1),env("SD_PASSYDS_B",0.5)]};
const sdOf=(stat,m)=>SD[stat][0]*Math.pow(Math.max(m,1),SD[stat][1]);
// Yardage is right-skewed (median below mean), so use a lognormal with the fitted mean and sd.
function pOver(stat,mean,line){
  const m=Math.max(mean,0.5),s=sdOf(stat,m),v=Math.log(1+s*s/(m*m)),mu=Math.log(m)-v/2;
  const raw=1-Phi((Math.log(Math.max(line,0.5))-mu)/Math.sqrt(v));
  // The 2025 backtest showed raw probabilities are about twice as confident as reality
  // (projections carry their own error on top of game-to-game noise), so pull them toward 50%.
  return 0.5+PROB_CAL*(raw-0.5);
}
const PROB_CAL=env("PROB_CAL",0.5);
function Phi(z){const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p;}

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const shrink=(num,den,base,k)=>(num+base*k)/(den+k);
const log5=(a,b,l)=>{if(!(l>0&&l<1))return a;const x=a*b/l,y=(1-a)*(1-b)/(1-l);return x/(x+y);};
// Player's expected rate under a defense's frequency of situation A vs. the league's frequency.
function splitMult(yA,nA,yB,nB,base,k,fDef,fLg){
  if(!(base>0))return 1;
  const rA=shrink(yA,nA,base,k),rB=shrink(yB,nB,base,k);
  return (fDef*rA+(1-fDef)*rB)/(fLg*rA+(1-fLg)*rB);
}
// Exponentially weighted sums over chronologically sorted records (most recent weighs most).
function wsum(recs,S,hl,fields){
  const acc={w:0};for(const k in fields)acc[k]=0;const n=recs.length;
  recs.forEach((r,i)=>{const w=Math.pow(0.5,(n-1-i)/hl)*(r.season<S?C.PRIOR_W:1);acc.w+=w;for(const k in fields)acc[k]+=w*fields[k](r);});
  return acc;
}

// ---------- indexes ----------
function index(DB){
  if(DB.ix)return DB.ix;
  const byTeam=new Map(),byOpp=new Map(),byKey=new Map();
  for(const r of DB.tg){(byTeam.get(r.team)||byTeam.set(r.team,[]).get(r.team)).push(r);
    (byOpp.get(r.opp)||byOpp.set(r.opp,[]).get(r.opp)).push(r);byKey.set(r.gid+"|"+r.team,r);}
  return DB.ix={byTeam,byOpp,byKey,lg:new Map(),tctx:new Map()};
}

// ---------- league baselines ----------
function league(DB,asOf){
  const ix=index(DB);if(ix.lg.has(asOf))return ix.lg.get(asOf);
  const S=DB.S,T={plays:0,pp:0,att:0,sacks:0,tgts:0,press:0,cleanPP:0,cleanYds:0,pressPP:0,pressYds:0,passYds:0,ftnPP:0,blz:0,ftnRuns:0,stack:0,rbCar:0,rbYds:0,n:0};
  const P={WR:{t:0,r:0,y:0,air:0},TE:{t:0,r:0,y:0,air:0},RB:{t:0,r:0,y:0,air:0}};
  for(const r of DB.tg){if(r.o>=asOf)continue;const w=r.season<S?C.PRIOR_W:1;T.n+=w;
    for(const k in T)if(k!=="n")T[k]+=w*r[k];for(const p in P){P[p].t+=w*r.pos[p].t;P[p].r+=w*r.pos[p].r;P[p].y+=w*r.pos[p].y;}}
  const R={QB:{c:0,y:0},RB:{c:0,y:0},WR:{c:0,y:0},TE:{c:0,y:0}};
  for(const [id,recs] of DB.pg){const pos=(DB.players.get(id)||{}).pos;
    for(const g of recs){if(g.o>=asOf)continue;const w=g.season<S?C.PRIOR_W:1;
      if(R[pos]&&g.car){R[pos].c+=w*g.car;R[pos].y+=w*g.ruyds;}if(P[pos]&&g.tgt)P[pos].air+=w*g.air;}}
  const tot=DB.games.filter(g=>ord(g.season,g.week)<asOf&&g.total_line!=="");
  const L={
    plays:T.plays/T.n,passRate:T.pp/T.plays,sackRate:T.sacks/T.pp,tgtRate:T.tgts/T.att,press:T.press/T.pp,
    cleanYPD:T.cleanYds/T.cleanPP,pressYPD:T.pressYds/T.pressPP,ypd:T.passYds/T.pp,
    blitz:T.ftnPP?T.blz/T.ftnPP:0.25,stack:T.ftnRuns?T.stack/T.ftnRuns:0.2,rbYPC:T.rbYds/T.rbCar,
    pts:tot.length?tot.reduce((a,g)=>a+(+g.total_line),0)/tot.length/2:22.5,
    ypt:{},catch:{},adot:{},ypc:{},
  };
  for(const p in P){L.ypt[p]=P[p].y/P[p].t;L.catch[p]=P[p].r/P[p].t;L.adot[p]=P[p].air/P[p].t;}
  for(const p in R)L.ypc[p]=R[p].c?R[p].y/R[p].c:4;
  ix.lg.set(asOf,L);return L;
}

// ---------- team offense + defense context ----------
function teamCtx(DB,team,asOf){
  const ix=index(DB),key=team+"@"+asOf;if(ix.tctx.has(key))return ix.tctx.get(key);
  const L=league(DB,asOf),S=DB.S,K=C.K_TEAM;
  const off=wsum((ix.byTeam.get(team)||[]).filter(r=>r.o<asOf),S,C.HL_TEAM,{plays:r=>r.plays,pp:r=>r.pp,att:r=>r.att,sacks:r=>r.sacks,
    tgts:r=>r.tgts,press:r=>r.press,passYds:r=>r.passYds});
  const def=wsum((ix.byOpp.get(team)||[]).filter(r=>r.o<asOf),S,C.HL_TEAM,{plays:r=>r.plays,pp:r=>r.pp,sacks:r=>r.sacks,press:r=>r.press,
    cleanPP:r=>r.cleanPP,cleanYds:r=>r.cleanYds,pressPP:r=>r.pressPP,pressYds:r=>r.pressYds,ftnPP:r=>r.ftnPP,blz:r=>r.blz,
    ftnRuns:r=>r.ftnRuns,stack:r=>r.stack,rbCar:r=>r.rbCar,rbYds:r=>r.rbYds,
    WRt:r=>r.pos.WR.t,WRr:r=>r.pos.WR.r,WRy:r=>r.pos.WR.y,TEt:r=>r.pos.TE.t,TEr:r=>r.pos.TE.r,TEy:r=>r.pos.TE.y,
    RBt:r=>r.pos.RB.t,RBr:r=>r.pos.RB.r,RBy:r=>r.pos.RB.y});
  const perG=L.plays;   // pseudo-games of league-average play for shrinkage
  const x={
    plays:shrink(off.plays,off.w,L.plays,K),
    passRate:shrink(off.pp,off.plays,L.passRate,K*perG),
    sackRate:shrink(off.sacks,off.pp,L.sackRate,K*perG*L.passRate),
    tgtRate:shrink(off.tgts,off.att,L.tgtRate,K*perG*L.passRate),
    press:shrink(off.press,off.pp,L.press,K*perG*L.passRate),
    ypd:shrink(off.passYds,off.pp,L.ypd,K*perG*L.passRate),
    d:{
      playsF:shrink(def.plays,def.w,L.plays,K),
      passRateF:shrink(def.pp,def.plays,L.passRate,K*perG),
      sackGen:shrink(def.sacks,def.pp,L.sackRate,K*perG*L.passRate),
      pressGen:shrink(def.press,def.pp,L.press,K*perG*L.passRate),
      covF:shrink(def.cleanYds,def.cleanPP,L.cleanYPD,C.K_DEF_PASS)/L.cleanYPD,
      prF:shrink(def.pressYds,def.pressPP,L.pressYPD,C.K_DEF_PASS/2)/L.pressYPD,
      blitz:shrink(def.blz,def.ftnPP,L.blitz,C.K_DEF_FREQ),
      stack:shrink(def.stack,def.ftnRuns,L.stack,C.K_DEF_FREQ),
      runF:shrink(def.rbYds,def.rbCar,L.rbYPC,C.K_DEF_RUN)/L.rbYPC,
      recF:{},catchF:{},
    },
  };
  for(const p of ["WR","TE","RB"]){
    x.d.recF[p]=shrink(def[p+"y"],def[p+"t"],L.ypt[p],C.K_DEF_REC)/L.ypt[p];
    x.d.catchF[p]=shrink(def[p+"r"],def[p+"t"],L.catch[p],C.K_DEF_REC)/L.catch[p];
  }
  ix.tctx.set(key,x);return x;
}

// ---------- one player's usage + efficiency profile ----------
function profile(DB,id,team,asOf){
  const ix=index(DB),S=DB.S,L=league(DB,asOf);
  const info=DB.players.get(id)||{name:id,pos:"?"};const pos=info.pos;
  const all=(DB.pg.get(id)||[]).filter(g=>g.o<asOf);
  let onTeam=all.filter(g=>g.team===team&&g.season===S);
  if(onTeam.length<2)onTeam=all.filter(g=>g.team===team);           // early season: lean on last year with this team
  if(!onTeam.length)return null;
  // shares of the team's targets / rushes / pass plays in each game he played
  const rows=onTeam.map(g=>{const t=ix.byKey.get(g.gid+"|"+team)||{};
    return {...g,ts:t.tgts?g.tgt/t.tgts:0,cs:t.rush?g.car/t.rush:0,qs:t.pp?g.pp/t.pp:0};});
  const snapRows=rows.filter(r=>r.snap!=null&&r.snap>0.03);
  let tShare,cShare,snap=null;
  const sh=wsum(rows,S,C.HL_SHARE,{ts:r=>r.ts,cs:r=>r.cs,qs:r=>r.qs});
  if(snapRows.length>=2){
    const sn=wsum(snapRows,S,C.HL_SNAP,{s:r=>r.snap});snap=sn.s/sn.w;
    const per=wsum(snapRows,S,C.HL_SHARE,{ts:r=>r.ts,cs:r=>r.cs,s:r=>r.snap});
    tShare=snap*per.ts/per.s;cShare=snap*per.cs/per.s;
  }else{tShare=sh.ts/sh.w;cShare=sh.cs/sh.w;}
  const qShare=sh.qs/sh.w;
  const e=wsum(all,S,C.HL_EFF,{tgt:g=>g.tgt,rec:g=>g.rec,ryds:g=>g.ryds,air:g=>g.air,car:g=>g.car,ruyds:g=>g.ruyds,
    cPP:g=>g.cleanPP,cY:g=>g.cleanYds,pPP:g=>g.pressPP,pY:g=>g.pressYds,bPP:g=>g.blzPP,bY:g=>g.blzYds,nPP:g=>g.noPP,nY:g=>g.noYds,
    sC:g=>g.stCar,sY:g=>g.stYds,lC:g=>g.ltCar,lY:g=>g.ltYds});
  const rp=L.ypt[pos]?pos:"WR";
  // team games since he last played for them: an absence that's weeks old is already in teammates' shares
  const tGames=(ix.byTeam.get(team)||[]).filter(r=>r.o<asOf),lastGid=onTeam[onTeam.length-1].gid;
  const idx=tGames.findIndex(r=>r.gid===lastGid),gap=idx<0?99:tGames.length-1-idx;
  const p={id,name:info.name,pos,team,games:onTeam.length,gap,vacate:gap===0?1:gap===1?0.5:0,snap,tShare,cShare,qShare,e,
    ypt:shrink(e.ryds,e.tgt,L.ypt[rp],C.K_YPT),catch:shrink(e.rec,e.tgt,L.catch[rp],C.K_CATCH),
    adot:shrink(e.air,e.tgt,L.adot[rp],10),ypc:shrink(e.ruyds,e.car,L.ypc[pos]||L.ypc.RB,C.K_YPC),
    cYPD:shrink(e.cY,e.cPP,L.cleanYPD,C.K_QB),pYPD:shrink(e.pY,e.pPP,L.pressYPD,C.K_QB/2)};
  // recent-average baseline (roughly where books hang a line): last 4 games, this season first
  // this season only: last year's average (often on another team) is not what books are pricing
  const cur=all.filter(g=>g.season===S),recent=cur.length>=2?cur.slice(-4):[];
  const avg=f=>recent.length?recent.reduce((a,g)=>a+f(g),0)/recent.length:null;
  p.base={recYds:avg(g=>g.ryds),rec:avg(g=>g.rec),rushYds:avg(g=>g.ruyds),passYds:avg(g=>g.pyds),n:recent.length};
  return p;
}

const STATS={QB:["passYds","rushYds"],RB:["rushYds","recYds","rec"],WR:["recYds","rec"],TE:["recYds","rec"]};

// ---------- project one side of a game ----------
// status(id) -> "out" | "q" | "" ; candidates = player ids to consider for this team.
function projectTeam(DB,{team,opp,home,spread,total,weather,asOf,candidates,status,depthQB}){
  const L=league(DB,asOf),T=teamCtx(DB,team,asOf),D=teamCtx(DB,opp,asOf).d;
  const margin=spread===""||spread==null?0:(home?+spread:-spread);
  const pts=total===""||total==null?L.pts:(+total+margin)/2;
  const w=weather&&!weather.indoor?weather:null;
  const windRaw=w?Math.max(w.wind,(w.gust||0)*0.6):0;
  const dirMult=w&&w.rel&&windRaw>=C.DIR_MIN?(w.rel==="cross"?C.DIR_CROSS:w.rel==="along"?C.DIR_ALONG:1):1;
  const windEx=Math.max(0,windRaw-C.WIND_MIN)*dirMult;
  const passMult=clamp(1-C.WIND_PASS_K*windEx,0.75,1)*(w&&w.precip>=0.04?C.RAIN_MULT:1);

  const plays=(0.5*T.plays+0.5*D.playsF)*(1+C.PTS_K*(pts/L.pts-1));
  const passRate=clamp(T.passRate+0.5*(D.passRateF-L.passRate)-C.SCRIPT_K*margin-C.WIND_RATE_K*windEx,0.35,0.8);
  const pp=plays*passRate,rush=plays-pp;
  const sackRate=log5(T.sackRate,D.sackGen,L.sackRate),press=log5(T.press,D.pressGen,L.press);
  const tgts=pp*(1-sackRate)*T.tgtRate;

  // usage profiles
  const profs=[];
  for(const id of candidates){const p=profile(DB,id,team,asOf);if(!p||!STATS[p.pos])continue;p.status=status(id);profs.push(p);}
  const active=profs.filter(p=>p.status!=="out");
  // quarterback: highest pass-play share among active QBs, else the depth chart's next man
  let qb=active.filter(p=>p.pos==="QB").sort((a,b)=>b.qShare-a.qShare)[0]||null;
  const qbOut=profs.filter(p=>p.pos==="QB"&&p.status==="out").sort((a,b)=>b.qShare-a.qShare)[0];
  const qbChanged=!!(qbOut&&(!qb||qbOut.qShare>qb.qShare));
  if(!qb&&depthQB){const id=depthQB.find(i=>status(i)!=="out");if(id){const info=DB.players.get(id)||{name:id};
    qb={id,name:info.name,pos:"QB",team,games:0,tShare:0,cShare:0,qShare:1,e:{},cYPD:L.cleanYPD*0.88,pYPD:L.pressYPD*0.88,ypc:L.ypc.QB,
      base:{passYds:null,rushYds:null,n:0},status:status(id),noHistory:true};active.push(qb);}}
  // hand a missing player's targets/carries to teammates, mostly to the same position
  const redistribute=(key,aff,cap)=>{
    for(const out of profs.filter(p=>p.status==="out"&&p[key]>0&&p.vacate>0)){
      const wts=active.map(p=>p[key]*aff(out.pos,p.pos)),W=wts.reduce((a,b)=>a+b,0);if(!W)continue;
      active.forEach((p,i)=>{const add=out[key]*out.vacate*C.REDIST*wts[i]/W;p[key+"Bump"]=(p[key+"Bump"]||0)+add;
        if(add>0.01)(p.from||(p.from=new Set())).add(out.name);});
    }
    // a team can't hand out more than 100% of its targets/carries
    const sum=active.reduce((a,p)=>a+p[key]+(p[key+"Bump"]||0),0);
    if(sum>cap)for(const p of active){p[key]*=cap/sum;if(p[key+"Bump"])p[key+"Bump"]*=cap/sum;}
  };
  redistribute("tShare",(a,b)=>a===b?1:0.5,C.SHARE_CAP);
  redistribute("cShare",(a,b)=>a==="RB"?(b==="RB"?1:b==="QB"?0.2:0.05):(a===b?1:0.3),C.SHARE_CAP);

  const qbEff=qb?(1-L.press)*qb.cYPD+L.press*qb.pYPD:L.ypd;
  const qbFactor=clamp(qbEff/T.ypd,0.7,1.2);
  const cov=DB.cov,mzDef=cov.def[opp]?shrink(cov.def[opp].man,cov.def[opp].n,cov.lgMan,C.K_DEF_FREQ):cov.lgMan;
  const out=[];
  for(const p of active){
    const stats={},why=[];
    const tS=p.tShare+(p.tShareBump||0),cS=p.cShare+(p.cShareBump||0);
    const tgt=tgts*tS,car=rush*cS;
    if(p.pos!=="QB"){
      const rp=p.pos;const r=cov.rec[p.id];
      const mz=r?splitMult(r.mY,r.mT,r.zY,r.zT,p.ypt,C.K_SPLIT,mzDef,cov.lgMan):1;
      const windRec=clamp(1-C.WIND_PASS_K*windEx*(0.5+p.adot/16),0.7,1);
      stats.recYds=tgt*p.ypt*D.recF[rp]*mz*qbFactor*windRec;
      stats.rec=tgt*Math.min(0.92,p.catch*D.catchF[rp])*Math.sqrt(windRec);
      p.mz=mz;
    }
    if(p===qb){
      const pe=p.e||{};
      const blitz=splitMult(pe.bY||0,pe.bPP||0,pe.nY||0,pe.nPP||0,p.cYPD,C.K_SPLIT*2,D.blitz,L.blitz);
      stats.passYds=pp*C.QB_SHARE*((1-press)*p.cYPD*D.covF+press*p.pYPD*D.prF)*blitz*passMult;
      p.blitz=blitz;
    }
    if(p.pos==="RB"||(p.pos==="QB"&&p===qb)){
      const pe=p.e||{};
      const box=p.pos==="RB"?splitMult(pe.sY||0,pe.sC||0,pe.lY||0,pe.lC||0,p.ypc,C.K_SPLIT,D.stack,L.stack):1;
      stats.rushYds=car*p.ypc*D.runF*box;
    }
    const want=STATS[p.pos].filter(s=>stats[s]!=null&&(s!=="passYds"||p===qb));
    if(!want.length||(p.pos==="QB"&&p!==qb))continue;
    out.push({id:p.id,name:p.name,pos:p.pos,team,opp,status:p.status,noHistory:!!p.noHistory,
      tgt,car,snap:p.snap,tShare:tS,cShare:cS,bump:{t:tgts*(p.tShareBump||0),c:rush*(p.cShareBump||0),from:p.from?[...p.from]:[]},
      stats:Object.fromEntries(want.map(s=>[s,stats[s]])),base:p.base,
      ctx:{mz:p.mz,blitz:p.blitz,qbFactor,matchup:p.pos==="QB"?D.covF:p.pos==="RB"&&stats.rushYds!=null?D.runF:D.recF[p.pos]}});
  }
  return {team,opp,plays,pp,rush,pts,margin,passRate,press,qb:qb&&qb.name,qbChanged,windEx,
    out:profs.filter(p=>p.status==="out").map(p=>({id:p.id,name:p.name,pos:p.pos,tShare:p.tShare,cShare:p.cShare})),players:out};
}

module.exports={C,SD,sdOf,pOver,projectTeam,profile,league,teamCtx,STATS};
