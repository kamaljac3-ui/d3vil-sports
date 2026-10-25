// NBA Edges model: shot-zone matchups + per-game stat projections.
// Same idea as launch-angle: a player's own tendencies vs. what tonight's opponent gives up.

// ---------- shot zones ----------
const ZONES=[
  {key:"RA",label:"rim",val:2},{key:"PAINT",label:"paint",val:2},{key:"MID",label:"mid-range",val:2},
  {key:"LC3",label:"left corner 3",val:3},{key:"RC3",label:"right corner 3",val:3},{key:"ATB3",label:"above-break 3",val:3}];
// stats.nba.com "By Zone" column groups, in order (FGM,FGA,FG_PCT each). BACK and C3 (combined corners) are ignored.
const ZONE_COLS=["RA","PAINT","MID","LC3","RC3","ATB3","BACK","C3"];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

function zonesFromRow(row,start){
  const z={};ZONE_COLS.forEach((k,i)=>{z[k]={fgm:+row[start+i*3]||0,fga:+row[start+i*3+1]||0};});return z;
}
// league totals = every team's opponent-allowed zones added up
function leagueZones(teamZones){
  const L={total:0};
  for(const {key} of ZONES){L[key]={fgm:0,fga:0};for(const t of teamZones){L[key].fgm+=t[key].fgm;L[key].fga+=t[key].fga;}L.total+=L[key].fga;}
  return L;
}
const K_SHRINK=30; // attempts of league-average shooting mixed into every player's zone FG%
function zoneMatchup(p,gp,opp,L){
  // p, opp: per-game {fgm,fga} by zone (player's own / opponent-allowed); L: league totals
  const oppTotal=ZONES.reduce((s,z)=>s+opp[z.key].fga,0),g=Math.min(gp||0,60);
  let base=0,match=0,base3=0,match3=0;const per=[];
  for(const z of ZONES){
    const pz=p[z.key],oz=opp[z.key],lz=L[z.key];if(!lz||!lz.fga)continue;
    const lgPct=lz.fgm/lz.fga;
    const pPct=(pz.fgm*g+lgPct*K_SHRINK)/(pz.fga*g+K_SHRINK);
    const def=oz.fga?clamp((oz.fgm/oz.fga)/lgPct,0.85,1.15):1;                              // how well they defend the zone
    const vol=oppTotal?clamp(Math.sqrt((oz.fga/oppTotal)/(lz.fga/L.total)),0.85,1.15):1;   // how often they allow it
    const b=pz.fga*pPct*z.val,m=pz.fga*vol*pPct*def*z.val;
    base+=b;match+=m;if(z.val===3){base3+=pz.fga*pPct;match3+=pz.fga*vol*pPct*def;}
    per.push({...z,fga:pz.fga,oppPct:oz.fga?oz.fgm/oz.fga:lgPct,lgPct,delta:m-b});
  }
  per.sort((a,b)=>b.delta-a.delta);
  return {ptsFactor:base?match/base:1,threesFactor:base3?match3/base3:1,delta:match-base,best:per[0]||null,per};
}

// ---------- projections ----------
// pl: season per-game line {MIN,PTS,REB,AST,FG3M,FTM,MIN10?}
// ctx: {zone, env (scoring environment), oppReb, oppAst, blowout, boost:{pts,reb,ast}}
function project(pl,ctx){
  const min=pl.MIN10?0.5*pl.MIN+0.5*pl.MIN10:pl.MIN;
  let minF=pl.MIN?min/pl.MIN:1;if(ctx.blowout&&pl.MIN>=28)minF*=0.95;
  const z=ctx.zone||{ptsFactor:1,threesFactor:1},e=ctx.env||1,b=ctx.boost||{pts:1,reb:1,ast:1};
  return {min,
    pts:((pl.PTS-pl.FTM)*z.ptsFactor+pl.FTM)*minF*e*b.pts,
    reb:pl.REB*minF*(ctx.oppReb||1)*b.reb,
    ast:pl.AST*minF*(ctx.oppAst||1)*e*b.ast,
    fg3m:pl.FG3M*z.threesFactor*minF*e*b.pts};
}
// Calibration, fit by backtest.js on 2024-26 (rerun it and paste its "CAL" line here after a model change):
//  k     - starters (20+ MPG) get only k of the projection's gap from their average (the gap showed up at 0.6-0.8x;
//          bench gaps showed up at 1x or more, so the bench keeps the full gap)
//  m,beta- then everything is pulled toward m: a high season average is partly luck (28+ ppg scorers came in ~2 under it)
//  a,b   - real spread of the stat around that projection: sd = a + b*sqrt(proj). The old fixed spreads were ~2/3 of
//          the real one in the 8-20 pt range, which made 60% spots look like 85-90%.
const CAL=process.env.NBA_CAL?JSON.parse(process.env.NBA_CAL):{
  pts:{k:0.842,m:9.37,beta:0.931,a:1.524,b:1.398},reb:{k:0.575,m:2.59,beta:0.938,a:-0.027,b:1.233},
  ast:{k:0.666,m:2.366,beta:0.937,a:-0.036,b:1.17},fg3m:{k:0.612,m:1.198,beta:0.906,a:-0.081,b:1.164}};
function calibrate(stat,proj,avg,mpg,cal=CAL){
  const c=cal[stat];if(!c||!(avg>=0))return proj;
  const p=mpg>=20?avg+c.k*(proj-avg):proj;
  return Math.max(0,c.m+c.beta*(p-c.m));
}
const sdOf=(stat,p,cal=CAL)=>Math.max(0.5,cal[stat].a+cal[stat].b*Math.sqrt(Math.max(0,p)));
function Phi(x){const t=1/(1+0.2316419*Math.abs(x)),d=0.3989423*Math.exp(-x*x/2);
  const q=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-q:q;}
// proj should already be calibrated
const pOver=(proj,line,stat,cal=CAL)=>1-Phi((line-proj)/sdOf(stat,proj,cal));

// Teammates ruled out. Only counts regulars who have actually been playing (a long-term absence is already in
// everyone's averages). Returns {out: names, forPlayer(p) -> {pts,reb,ast} multipliers}.
//  mode "minutes" (default): the out players' minutes go to the rest of the rotation weighted by MIN x (MAX_MIN - MIN),
//    so bench/rotation players with room absorb most of it and 36-minute starters little; each player's minutes
//    factor is scaled by minScale. On top of that, per-minute production rises by usage x (share of that stat the
//    team lost). Both fit by backtest.js on 2024-25: minScale 0.25, usage 0.15 (with box-score rosters; usage 0 was a
//    hair better on 2025-26, 0.9930 vs 0.9937, so the usage bump is marginal). 0.5+ minutes or 0.3+ usage overshoot.
//  mode "uniform": the original rule (everyone +70% x lost/remaining, capped at +25%); the 2024-26 backtest showed
//    it overshoots ~5x, kept only so the backtest can compare.
const OUT_OPTS={mode:process.env.NBA_OUT_MODE||"minutes",minScale:+(process.env.NBA_OUT_MIN_SCALE||0.25),usage:+(process.env.NBA_OUT_USAGE||0.15),maxMin:36,
  // bench (under 20 MPG) share of a missing teammate's minutes: 0.25 picked on 2024-25 (0.5 tied there and was better on 2025-26)
  benchScale:+(process.env.NBA_OUT_BENCH_SCALE||0.25)};
function outBoost(team,outKeys,teamGP,opts={}){
  const o={...OUT_OPTS,...opts};
  const regular=p=>p.MIN>=15&&(teamGP<5||(p.gpCur||0)>=0.6*teamGP);
  const out=team.filter(p=>outKeys.has(p.key)&&regular(p)),names=out.map(p=>p.name);
  const none={pts:1,reb:1,ast:1};
  if(!out.length)return {out:names,forPlayer:()=>none};
  if(o.mode==="uniform"){
    const rest=team.filter(p=>!outKeys.has(p.key)&&p.MIN>=12);
    const f=k=>{const lost=out.reduce((s,p)=>s+(p[k]||0),0),have=rest.reduce((s,p)=>s+(p[k]||0),0);return have?clamp(1+0.7*lost/have,1,1.25):1;};
    const b={pts:f("PTS"),reb:f("REB"),ast:f("AST")};return {out:names,forPlayer:()=>b};
  }
  const rest=team.filter(p=>!outKeys.has(p.key)&&p.MIN>=8);
  const w=p=>p.MIN*Math.max(0,o.maxMin-p.MIN),W=rest.reduce((s,p)=>s+w(p),0);
  const lostMin=out.reduce((s,p)=>s+p.MIN,0);
  const share=k=>{const lost=out.reduce((s,p)=>s+(p[k]||0),0),have=rest.reduce((s,p)=>s+(p[k]||0),0);return lost+have?lost/(lost+have):0;};
  const sh={pts:share("PTS"),reb:share("REB"),ast:share("AST")};
  return {out:names,forPlayer:p=>{
    const scale=p.MIN<20&&o.benchScale!=null?o.benchScale:o.minScale;   // bench (under 20 MPG) can get its own strength
    const dm=W?Math.min(lostMin*w(p)/W,Math.max(0,o.maxMin+4-p.MIN)):0,mf=1+scale*dm/Math.max(p.MIN,1);
    return {pts:mf*(1+o.usage*sh.pts),reb:mf*(1+o.usage*sh.reb),ast:mf*(1+o.usage*sh.ast)};
  }};
}

module.exports={ZONES,zonesFromRow,leagueZones,zoneMatchup,project,calibrate,sdOf,pOver,outBoost,clamp,CAL};
