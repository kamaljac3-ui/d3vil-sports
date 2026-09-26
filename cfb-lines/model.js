// CFB lines model.
//  1. Opponent-adjusted efficiency: for each metric (EPA/play, success rate, explosiveness, plays)
//     solve  metric = mu + off[team] + def[opp] + hf*home  as a ridge regression whose prior is the
//     team's preseason value, weighted like PRIOR_GAMES games. So the prior dominates in week 1
//     and fades as real games pile up.
//  2. Preseason prior = last season's final adjusted value regressed toward average, shifted by
//     returning production (offense) and roster talent (247 composite).
//  3. Expected points per side = a fitted map from those metrics (params.json, made by the backtest).
//  4. Situational adjustments (home field by venue/situation, travel, time zones, rest, altitude,
//     weather, QB and other availability), each a coefficient the backtest fits toward a sane default.
const fs=require("fs"),path=require("path");
const {env}=require("../nfl-props/lib");

// ---------- tunables (env overrides > params.json > defaults) ----------
const PFILE=path.join(__dirname,"params.json");
const FIT=fs.existsSync(PFILE)?JSON.parse(fs.readFileSync(PFILE,"utf8")):{};
const DEF={
  PRIOR_GAMES:3,PRIOR_REG:0.6,RET_K:1.0,TAL_K:0.3,RIDGE:0.5,
  // expected points = c0 + c1*ppa*plays + c2*sr + c3*ex + c4*plays   (per team-game)
  PTS:[ -8, 1.0, 35, 5, 0.25 ],
  MARGIN_SCALE:1.0,TOTAL_BIAS:0,
  // margin coefficients (home perspective)
  HFA:2.5,HFA_CAP:0.6,          // base home edge; extra per 25k seats above 50k
  HFA_AWAY_VENUE:0.5,           // home team "hosting" away from its own stadium keeps this share
  TRAVEL:-0.3,                  // per 1,000 miles the team travelled (applied to the difference)
  TZ:-0.3,                      // per time zone crossed
  REST:0.15,REST_CAP:7,         // per day of rest advantage (bye weeks included), capped
  ALT:1.5,ALT_M:1500,           // home team at >1,500 m vs a visitor from low ground
  // totals
  WIND_MPH:15,WIND:-0.35,WIND_CAP:-8,RAIN_IN:0.1,RAIN:-2.5,COLD_F:25,COLD:-1.0,
  // availability
  QB_OUT:6.0,QB_TOTAL:-2.0,SKILL:8.0,DEF:10.0,INJ_CAP:6,
};
const C={};
for(const k of Object.keys(DEF))C[k]=Array.isArray(DEF[k])?(FIT[k]||DEF[k]):env(k,FIT[k]??DEF[k]);

const METRICS=["ppa","sr","ex","pl"];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))||1;};

// ---------- 1. opponent adjustment ----------
// rows: {o, d, y, h} (h = +1 offense at home, -1 away, 0 neutral). prior: {o:{t}, d:{t}} or null.
function adjust(rows,prior,K,iters=40){
  const o={},d={};let mu=mean(rows.map(r=>r.y)),hf=0;
  const po=t=>prior&&prior.o[t]!=null?prior.o[t]:0,pd=t=>prior&&prior.d[t]!=null?prior.d[t]:0;
  const teams=new Set();for(const r of rows){teams.add(r.o);teams.add(r.d);}
  for(const t of teams){o[t]=po(t);d[t]=pd(t);}
  for(let it=0;it<iters;it++){
    const so={},no={},sd_={},nd={};
    for(const r of rows){const e=r.y-mu-hf*r.h;
      so[r.o]=(so[r.o]||0)+e-d[r.d];no[r.o]=(no[r.o]||0)+1;
      sd_[r.d]=(sd_[r.d]||0)+e-o[r.o];nd[r.d]=(nd[r.d]||0)+1;}
    for(const t of teams){
      o[t]=((so[t]||0)+K*po(t))/((no[t]||0)+K);
      d[t]=((sd_[t]||0)+K*pd(t))/((nd[t]||0)+K);}
    let a=0,b=0,m=0;
    for(const r of rows){const e=r.y-o[r.o]-d[r.d];m+=e-hf*r.h;a+=r.h*(e-mu);b+=r.h*r.h;}
    mu=m/rows.length;hf=b?a/b:0;
  }
  return {mu,o,d,hf};
}

// adv rows -> per-metric regression rows. Non-FBS teams share one "FCS" identity.
function metricRows(adv,games,fbs,maxWk){
  const G=new Map(games.map(g=>[g.id,g]));const out={};for(const m of METRICS)out[m]=[];
  const id=t=>fbs[t]?t:"FCS";
  for(const r of adv){
    if(r.wk>=maxWk)continue;const g=G.get(r.gid);if(!g)continue;
    const h=g.neutral?0:(g.home===r.team?1:-1);
    for(const m of METRICS)out[m].push({o:id(r.team),d:id(r.opp),y:r[m],h});
  }
  return out;
}

// Final (end of season) adjusted values, used as next season's starting point.
function seasonFinal(adv,games,fbs){
  const R=metricRows(adv,games,fbs,Infinity),out={};
  for(const m of METRICS)out[m]=R[m].length?adjust(R[m],null,C.RIDGE):null;
  return out;
}

// ---------- 2. preseason priors ----------
function priors(prevFinal,fbs,talent,ret){
  const teams=Object.keys(fbs);
  const tv=teams.map(t=>talent[t]).filter(x=>x>0),tm=mean(tv),ts=sd(tv);
  const rv=teams.map(t=>ret[t]&&ret[t].ppa).filter(x=>x>=0),rm=mean(rv);
  const P={};
  for(const m of METRICS){
    const F=prevFinal&&prevFinal[m];P[m]={o:{},d:{}};
    const so=F?sd(teams.map(t=>F.o[t]).filter(x=>x!=null)):0,sdd=F?sd(teams.map(t=>F.d[t]).filter(x=>x!=null)):0;
    // "better" is higher for offense and lower for defense, except plays (pace), which talent doesn't predict
    const good=m==="pl"?0:1;
    for(const t of teams){
      const tz=talent[t]>0?clamp((talent[t]-tm)/ts,-3,3):-1;   // missing talent: usually a new/small program
      const rz=ret[t]&&ret[t].ppa>=0?ret[t].ppa-rm:0;
      const baseO=F&&F.o[t]!=null?F.o[t]:(F?F.o.FCS*0.5:0),baseD=F&&F.d[t]!=null?F.d[t]:(F?F.d.FCS*0.5:0);
      P[m].o[t]=C.PRIOR_REG*baseO*(1+C.RET_K*rz)+good*C.TAL_K*tz*so;
      P[m].d[t]=C.PRIOR_REG*baseD-good*C.TAL_K*tz*sdd;
    }
    if(F){P[m].o.FCS=F.o.FCS;P[m].d.FCS=F.d.FCS;}
  }
  return P;
}

// ---------- ratings as of a week ----------
function ratings({adv,games,fbs,prevFinal,talent,ret},wk){
  const P=priors(prevFinal,fbs,talent,ret),R=metricRows(adv,games,fbs,wk),out={n:{}};
  for(const m of METRICS){
    out[m]=R[m].length?adjust(R[m],P[m],C.PRIOR_GAMES):{mu:prevFinal&&prevFinal[m]?prevFinal[m].mu:0,o:P[m].o,d:P[m].d,hf:0};
    // teams with no games yet still need their prior
    for(const t in P[m].o){if(out[m].o[t]==null)out[m].o[t]=P[m].o[t];if(out[m].d[t]==null)out[m].d[t]=P[m].d[t];}
  }
  for(const r of R.ppa)out.n[r.o]=(out.n[r.o]||0)+1;
  return out;
}

// ---------- 3. expected points ----------
const ptsFrom=(x)=>C.PTS[0]+C.PTS[1]*x.ppa*x.pl+C.PTS[2]*x.sr+C.PTS[3]*x.ex+C.PTS[4]*x.pl;
function sidePts(R,off,def){
  const id=t=>R.ppa.o[t]!=null?t:"FCS",x={};
  for(const m of METRICS)x[m]=R[m].mu+(R[m].o[id(off)]||0)+(R[m].d[id(def)]||0);
  return ptsFrom(x);
}

// ---------- 4. situational features ----------
const R_MI=3958.8;
function miles(a,b){
  if(!a||!b||a.lat==null||b.lat==null)return 0;
  const r=x=>x*Math.PI/180,dl=r(b.lat-a.lat),dn=r(b.lon-a.lon);
  const h=Math.sin(dl/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dn/2)**2;
  return 2*R_MI*Math.asin(Math.sqrt(h));
}
function tzOffset(tz,at){   // hours from UTC for an IANA zone at a moment (DST-aware)
  if(!tz)return null;
  try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:tz,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})
    .formatToParts(new Date(at)).map(x=>[x.type,x.value]));
    return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute)-at)/36e5*2)/2;}catch(e){return null;}
}
// Days since each team's previous game (any opponent). First game of the year counts as fully rested.
function restDays(games,team,g){
  let last=null;for(const x of games)if(x.start<g.start&&x.id!==g.id&&(x.home===team||x.away===team)&&(!last||x.start>last.start))last=x;
  return last?Math.min(21,(g.start-last.start)/864e5):14;
}

// ctx: {teams (fbs info), venues, games}. Returns the features the margin model uses.
function features(ctx,g){
  const V=ctx.venues[g.venueId]||null,H=ctx.teams[g.home],A=ctx.teams[g.away];
  const site=V&&V.lat!=null?V:(H&&!g.neutral?H:null);
  const tzAt=t=>tzOffset(t,g.start);
  const vtz=site?tzAt(site.tz):null;
  const trav=T=>T&&site?miles(T,site)/1000:0;
  const tzs=T=>T&&vtz!=null&&T.tz?Math.abs(tzAt(T.tz)-vtz):0;
  const atHome=!g.neutral&&(!H||H.venueId==null||g.venueId==null||H.venueId===g.venueId);
  const cap=V&&V.cap?V.cap:0;
  const f={
    home:g.neutral?0:(atHome?1:C.HFA_AWAY_VENUE),
    capZ:g.neutral?0:clamp((cap-50000)/25000,-1.5,2)*(atHome?1:C.HFA_AWAY_VENUE),
    travel:trav(A)-trav(H),tz:tzs(A)-tzs(H),
    rest:clamp(restDays(ctx.games,g.home,g)-restDays(ctx.games,g.away,g),-C.REST_CAP,C.REST_CAP),
    alt:!g.neutral&&site&&site.elev>=C.ALT_M&&A&&A.elev<C.ALT_M*0.6?1:0,
    dome:!!(V&&V.dome),
  };
  return f;
}
const MARGIN_KEYS=[["home","HFA","home field"],["capZ","HFA_CAP","crowd size"],["travel","TRAVEL","travel"],["tz","TZ","time zones"],["rest","REST","rest"],["alt","ALT","altitude"]];

// ---------- prediction ----------
// extra: {wx, inj: {home:{pts,total,notes[]}, away:{...}}}
function predict(R,ctx,g,extra={}){
  const f=features(ctx,g),parts=[];
  const hp=sidePts(R,g.home,g.away),ap=sidePts(R,g.away,g.home);
  let margin=(hp-ap)*C.MARGIN_SCALE,total=hp+ap+C.TOTAL_BIAS;
  for(const [k,c,label] of MARGIN_KEYS){const v=f[k]*C[c];if(v){margin+=v;parts.push({kind:"m",label,pts:v,f:f[k]});}}
  const wx=extra.wx;
  if(wx&&!wx.indoor&&!f.dome){
    let w=0;
    if(wx.wind>C.WIND_MPH)w+=Math.max(C.WIND_CAP,C.WIND*(wx.wind-C.WIND_MPH));
    if(wx.precip>=C.RAIN_IN)w+=C.RAIN;
    if(wx.temp!=null&&wx.temp<C.COLD_F)w+=C.COLD;
    if(w){const before=total;total+=w;
      // less scoring also shrinks the expected margin a little
      margin*=Math.max(0.6,total/before);parts.push({kind:"t",label:"weather",pts:w});}
  }
  const inj=extra.inj||{};
  for(const [side,sgn] of [["home",1],["away",-1]]){const x=inj[side];if(!x)continue;
    if(x.pts){margin-=sgn*x.pts;parts.push({kind:"m",label:`${side==="home"?g.home:g.away} availability`,pts:-sgn*x.pts});}
    if(x.total){total+=x.total;parts.push({kind:"t",label:`${side==="home"?g.home:g.away} availability`,pts:x.total});}}
  return {margin,total,home:hp,away:ap,f,parts};
}

// Availability -> points. roster: [{name,pos,status}], qb: usual starter {name}, use: {normName: usage share},
// tk: {normName: share of team tackles}. Status factors: how likely the player misses the game.
const STATUS={"out":1,"out - (1st half)":0.4,"out (1st half)":0.4,"doubtful":0.75,"game time decision":0.35,"questionable":0.35,"probable":0.05};
function availability(roster,qb,use,tk,norm){
  let pts=0,total=0;const notes=[];
  const fac=s=>STATUS[String(s||"").toLowerCase()]||0;
  let qbListed=false;
  for(const p of roster){
    const n=norm(p.name),x=fac(p.status);
    if(qb&&n===norm(qb.name)){qbListed=true;if(x){pts+=C.QB_OUT*x;total+=C.QB_TOTAL*x;notes.push(`QB ${qb.name} ${p.status.toLowerCase()}`);}continue;}
    if(!x)continue;
    const u=use[n]||0,t=tk[n]||0;
    const v=/^(RB|WR|TE|FB)$/.test(p.pos)?C.SKILL*u*x:/^(DL|DE|DT|NT|EDGE|LB|ILB|OLB|MLB|CB|S|DB|FS|SS|NB|STAR)$/.test(p.pos)?C.DEF*t*x:0;
    if(v>=0.4)notes.push(`${p.pos} ${p.name} ${p.status.toLowerCase()}`);
    pts+=v;
  }
  return {pts:Math.min(pts,C.INJ_CAP+C.QB_OUT),total,notes,qbListed};
}

module.exports={C,DEF,METRICS,adjust,metricRows,seasonFinal,priors,ratings,sidePts,features,predict,availability,miles,tzOffset,ptsFrom,MARGIN_KEYS,PFILE};
