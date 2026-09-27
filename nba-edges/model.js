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
// rough per-game spread of each stat around its projection
const SD={pts:p=>Math.max(4,0.28*p),reb:p=>Math.max(1.8,0.35*p),ast:p=>Math.max(1.5,0.38*p),fg3m:p=>Math.max(0.9,0.55*p)};
function Phi(x){const t=1/(1+0.2316419*Math.abs(x)),d=0.3989423*Math.exp(-x*x/2);
  const q=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-q:q;}
const pOver=(proj,line,stat)=>1-Phi((line-proj)/SD[stat](proj));

// Teammates ruled out. Only counts regulars who have actually been playing (a long-term absence is already in
// everyone's averages). Returns {out: names, forPlayer(p) -> {pts,reb,ast} multipliers}.
//  mode "minutes" (default): the out players' minutes go to the rest of the rotation weighted by MIN x (MAX_MIN - MIN),
//    so bench/rotation players with room absorb most of it and 36-minute starters little; each player's minutes
//    factor is scaled by minScale. On top of that, per-minute production rises by usage x (share of that stat the
//    team lost). Both fit by backtest.js: best on 2024-25 and held on 2025-26 was minScale 0.25, usage 0. For 20+ MPG
//    players a teammate sitting barely moves their numbers; any usage bump made projections worse.
//  mode "uniform": the original rule (everyone +70% x lost/remaining, capped at +25%); the 2024-26 backtest showed
//    it overshoots ~5x, kept only so the backtest can compare.
const OUT_OPTS={mode:process.env.NBA_OUT_MODE||"minutes",minScale:+(process.env.NBA_OUT_MIN_SCALE||0.25),usage:+(process.env.NBA_OUT_USAGE||0),maxMin:36};
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
    const dm=W?Math.min(lostMin*w(p)/W,Math.max(0,o.maxMin+4-p.MIN)):0,mf=1+o.minScale*dm/Math.max(p.MIN,1);
    return {pts:mf*(1+o.usage*sh.pts),reb:mf*(1+o.usage*sh.reb),ast:mf*(1+o.usage*sh.ast)};
  }};
}

module.exports={ZONES,zonesFromRow,leagueZones,zoneMatchup,project,pOver,outBoost,clamp};
