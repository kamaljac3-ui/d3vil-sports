// NBA game lines: spread and total from opponent-adjusted team ratings. Pure functions, shared by run.js and backtest-lines.js.
// Ratings: every game gives two equations, home pts = mu + h/2 + o[home] + d[away] and away pts = mu - h/2 + o[away] + d[home]
// (o = points scored above average, d = points allowed above average). Solved as a weighted ridge fit: recent games count
// more (half-life HALF_LIFE days) and every team is pulled toward its prior (last season's final rating x REGRESS) with
// strength PRIOR_GAMES games, so October ratings lean on last year and fade out as games come in.
// defaults = the settings backtest-lines.js picked on 2024-25 (BACKTEST-LINES.md; back-to-back and injuries fit to the
// closing line); rerun it after any change here
const LP={
  HALF_LIFE:+(process.env.NBA_LINES_HALF_LIFE||30),
  PRIOR_GAMES:+(process.env.NBA_LINES_PRIOR_GAMES||4),
  REGRESS:+(process.env.NBA_LINES_REGRESS||0.6),
  HCA:+(process.env.NBA_LINES_HCA||1.64),          // home court, points
  B2B:+(process.env.NBA_LINES_B2B||1.76),          // a team on the 2nd night of a back-to-back loses this many points of margin
  INJ:+(process.env.NBA_LINES_INJ||0.086),          // margin lost per point of "value" ruled out (see outValue)
  INJ_TOTAL:+(process.env.NBA_LINES_INJ_TOTAL||0.023) // total lost per point of value ruled out (both teams)
};
const day=d=>Math.floor(new Date(d).getTime()/864e5);

// games: [{date (ISO), home, away, hs, as}] all finished before asOf. prior: {o:{},d:{}} or null.
function fitRatings(games,asOf,prior,p=LP){
  const now=day(asOf),teams=new Set();for(const g of games){teams.add(g.home);teams.add(g.away);}
  if(prior)for(const t in prior.o)teams.add(t);
  const W=games.map(g=>Math.pow(0.5,(now-day(g.date))/p.HALF_LIFE));
  let sw=0,sp=0;games.forEach((g,i)=>{sw+=2*W[i];sp+=W[i]*(g.hs+g.as);});
  const mu=sw?sp/sw:(prior&&prior.mu)||114;
  const o={},d={},po={},pd={};
  for(const t of teams){po[t]=prior&&prior.o[t]!=null?p.REGRESS*prior.o[t]:0;pd[t]=prior&&prior.d[t]!=null?p.REGRESS*prior.d[t]:0;o[t]=po[t];d[t]=pd[t];}
  const lam=p.PRIOR_GAMES;   // a prior worth this many full-weight games
  for(let it=0;it<40;it++){
    const no={},nw={},nd={},ndw={};for(const t of teams){no[t]=lam*po[t];nw[t]=lam;nd[t]=lam*pd[t];ndw[t]=lam;}
    games.forEach((g,i)=>{const w=W[i];
      no[g.home]+=w*(g.hs-mu-p.HCA/2-d[g.away]);nw[g.home]+=w;
      no[g.away]+=w*(g.as-mu+p.HCA/2-d[g.home]);nw[g.away]+=w;
      nd[g.away]+=w*(g.hs-mu-p.HCA/2-o[g.home]);ndw[g.away]+=w;
      nd[g.home]+=w*(g.as-mu+p.HCA/2-o[g.away]);ndw[g.home]+=w;});
    for(const t of teams){o[t]=no[t]/nw[t];d[t]=nd[t]/ndw[t];}
  }
  return {mu,o,d};
}
// days since each team's previous game (Infinity if none) -> back-to-back flag. Counted in Eastern calendar days:
// a 10:30 PM ET tip is already tomorrow in UTC.
const etDay=d=>day(new Date(d).toLocaleDateString("en-CA",{timeZone:"America/New_York"})+"T12:00:00Z");
function restDays(games,team,asOf){
  let last=null;for(const g of games)if((g.home===team||g.away===team)&&(!last||g.date>last))last=g.date;
  return last?etDay(asOf)-etDay(last):Infinity;
}
// Value of the regulars ruled out tonight. A regular = 15+ MPG who has played most of the team's games; his value is a
// box-score line (PTS + 0.4 REB + 0.7 AST), scaled by the share of games he HAS played, since the ratings already
// carry the games he missed. pl: player stat lines {MIN,PTS,REB,AST,gpCur}; teamGP: team games this season.
function outValue(out,teamGP){
  let v=0;for(const pl of out){if(!(pl.MIN>=15))continue;const share=teamGP>0?Math.min(1,(pl.gpCur||0)/teamGP):1;
    if(teamGP>=5&&share<0.6)continue;v+=(pl.PTS+0.4*pl.REB+0.7*pl.AST)*share;}
  return v;
}
// g: {home, away, neutral?}; R: fitRatings output; ctx: {restH, restA, outH, outA} (rest in days, out = value)
function predict(g,R,ctx={},p=LP){
  const oh=R.o[g.home]||0,dh=R.d[g.home]||0,oa=R.o[g.away]||0,da=R.d[g.away]||0,h=g.neutral?0:p.HCA;
  const b2b=(ctx.restA===1?p.B2B:0)-(ctx.restH===1?p.B2B:0);
  const inj=p.INJ*((ctx.outA||0)-(ctx.outH||0));
  const margin=(oh+da)-(oa+dh)+h+b2b+inj;
  const total=2*R.mu+oh+da+oa+dh-p.INJ_TOTAL*((ctx.outA||0)+(ctx.outH||0));
  return {margin,total,home:(total+margin)/2,away:(total-margin)/2};
}
module.exports={LP,fitRatings,restDays,outValue,predict,day};
