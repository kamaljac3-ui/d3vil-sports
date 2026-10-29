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
// ctx: {zone, env (scoring environment), oppReb, oppAst, spread (this team's spread, negative = favorite),
//       blowout (old flag, used only when spread is missing), boost:{pts,reb,ast}}
// Blowout minutes, fit on PRA vs the calibrated projection with ESPN closing spreads (2024-25 fit, 2025-26 check, these
// values pooled): starters (28+ MPG) lose minutes when the spread is 12+ either way (x0.977 / x0.945 -> 0.96), and an
// 8+ point underdog's rotation (20-28 MPG, x1.039 / x1.052) and bench (<20, x1.063 / x1.183) pick up garbage time.
// The favorite's bench came in under only in 2025-26, so it's left alone. Out-of-sample error -0.4%.
const BLOW={starterSpread:+(process.env.BLOW_STARTER_SPREAD||12),starter:+(process.env.BLOW_STARTER||0.96),
  dogSpread:+(process.env.BLOW_DOG_SPREAD||8),dogRotation:+(process.env.BLOW_DOG_ROTATION||1.046),dogBench:+(process.env.BLOW_DOG_BENCH||1.126)};
function blowoutFactor(pl,ctx){
  const s=ctx.spread;
  if(s==null)return ctx.blowout&&pl.MIN>=28?BLOW.starter:1;
  if(pl.MIN>=28)return Math.abs(s)>=BLOW.starterSpread?BLOW.starter:1;
  if(s>=BLOW.dogSpread)return pl.MIN>=20?BLOW.dogRotation:BLOW.dogBench;
  return 1;
}
// Minutes and returns, fit 2026-10-29 on the 2024-26 box scores (fit 2024-25, checked 2025-26):
//  - projected minutes = 0.26 season + 0.15 last-10 + 0.60 last-3 games played (MINW). The old 50/50 season/last-10 blend
//    missed recent role changes: players 4+ min up over their last 3 came in +2.4/+3.0 PRA vs the projection, 4+ down
//    -2.5/-2.9; with the new weights +0.5/-0.25. PRA error out of sample 8.18 -> 7.93 (the plain average is 8.39).
//  - first game back after missing 3+ straight: x0.894 (0.916 / 0.873; unders 66% in 2025-26). Games 2-3 back need
//    nothing once last-3 minutes are in.
//  - teammates of a 30+ PRA regular returning from 2+ missed games: x0.922 (0.909 / 0.933; unders 57%), because their
//    recent numbers were built while he sat.
const MINW={season:+(process.env.MINW_SEASON||0.262),l10:+(process.env.MINW_L10||0.151),l3:+(process.env.MINW_L3||0.595)};
const RET={backAfter:+(process.env.RET_BACK_AFTER||3),back1:+(process.env.RET_BACK1||0.894),
  starPRA:+(process.env.RET_STAR_PRA||30),starAfter:+(process.env.RET_STAR_AFTER||2),starBack:+(process.env.RET_STAR_BACK||0.922)};
// team: player objects; hist[key] = {mins: minutes in his games for this team (oldest first), missed: team games missed
// in a row right before tonight, gp: games for this team}; out: Set of keys ruled out tonight. Returns copies with
// MIN3 (avg of his last 3 games, 2+ needed), back (1 = first game back) and starBack (a returning star teammate).
function recentInputs(team,hist,out=new Set()){
  const h=k=>hist[k]||null,mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
  const stars=team.filter(p=>{const x=h(p.key);return x&&!out.has(p.key)&&x.gp>=3&&x.missed>=RET.starAfter&&p.MIN>=20&&(p.PRA||0)>=RET.starPRA;}).map(p=>p.key);
  return team.map(p=>{const x=h(p.key),m=x?x.mins.slice(-3):[];
    return {...p,MIN3:m.length>=2?mean(m):null,back:x&&x.gp>=3&&x.missed>=RET.backAfter?1:0,starBack:stars.some(k=>k!==p.key)};});
}
function project(pl,ctx){
  // last-3 minutes when known (recentInputs), else the old season/last-10 blend
  const min=pl.MIN3!=null?MINW.season*pl.MIN+MINW.l10*(pl.MIN10||pl.MIN)+MINW.l3*pl.MIN3:pl.MIN10?0.5*pl.MIN+0.5*pl.MIN10:pl.MIN;
  const ret=(pl.back?RET.back1:1)*(pl.starBack&&!pl.back?RET.starBack:1);
  const minF=(pl.MIN?min/pl.MIN:1)*blowoutFactor(pl,ctx)*ret;
  const z=ctx.zone||{ptsFactor:1,threesFactor:1},e=ctx.env||1,b=ctx.boost||{pts:1,reb:1,ast:1};
  const pts=((pl.PTS-pl.FTM)*z.ptsFactor+pl.FTM)*minF*e*b.pts,reb=pl.REB*minF*(ctx.oppReb||1)*b.reb,ast=pl.AST*minF*(ctx.oppAst||1)*e*b.ast;
  return {min:min*blowoutFactor(pl,ctx)*ret,pts,reb,ast,fg3m:pl.FG3M*z.threesFactor*minF*e*b.pts,pra:pts+reb+ast};
}
// Calibration, fit by backtest.js on 2024-26 (rerun it and paste its "CAL" line here after a model change):
//  k     - starters (20+ MPG) get only k of the projection's gap from their average (the gap showed up at 0.6-0.8x;
//          bench gaps showed up at 1x or more, so the bench keeps the full gap)
//  m,beta- then everything is pulled toward m: a high season average is partly luck (28+ ppg scorers came in ~2 under it)
//  a,b   - real spread of the stat around that projection: sd = a + b*sqrt(proj). The old fixed spreads were ~2/3 of
//          the real one in the 8-20 pt range, which made 60% spots look like 85-90%.
const CAL=process.env.NBA_CAL?JSON.parse(process.env.NBA_CAL):{
  pra:{k:0.767,m:7.234,beta:0.964,a:2.928,b:1.167},pts:{k:0.744,m:7.705,beta:0.951,a:1.26,b:1.45},
  reb:{k:0.673,m:1.683,beta:0.942,a:-0.046,b:1.227},ast:{k:0.725,m:1.978,beta:0.944,a:-0.045,b:1.166},
  fg3m:{k:0.645,m:1.089,beta:0.909,a:-0.08,b:1.159}};
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
//    team lost). Both fit by backtest.js on 2024-25: minScale 0.25, usage 0 (2026-10-29, with last-3 minutes in the
//    projection; before that usage 0.15 won by a hair). 0.5+ minutes or 0.3+ usage overshoot.
//  mode "uniform": the original rule (everyone +70% x lost/remaining, capped at +25%); the 2024-26 backtest showed
//    it overshoots ~5x, kept only so the backtest can compare.
const OUT_OPTS={mode:process.env.NBA_OUT_MODE||"minutes",minScale:+(process.env.NBA_OUT_MIN_SCALE||0.25),usage:+(process.env.NBA_OUT_USAGE||0),maxMin:36,
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

module.exports={ZONES,zonesFromRow,leagueZones,zoneMatchup,project,MINW,RET,recentInputs,BLOW,blowoutFactor,calibrate,sdOf,pOver,outBoost,clamp,CAL};
