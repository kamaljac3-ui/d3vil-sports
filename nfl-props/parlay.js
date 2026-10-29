// Parlay builder shared by nba-edges (PRA board, Saturdays) and nfl-props (Sunday morning). Pure functions.
// One leg per game (legs in the same game are correlated, and books price same-game parlays with a bigger cut), the best
// leg of each game by expected value (chance x decimal payout), then the n best games. Each leg's chance should already
// be the bot's best estimate (model blended with the market's no-vig price); legs are treated as independent.
const dec=ml=>ml>0?1+ml/100:1+100/-ml;
const amer=d=>d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));
// legs: [{game, p, price, ...}]. Returns {legs, n, decimal, american, p, ev, negLegs} or null if fewer than n games.
function build(legs,n){
  const best={};
  for(const l of legs){
    if(!(l.p>0&&l.p<1)||l.price==null)continue;
    const v=Math.log(l.p*dec(l.price));
    if(!best[l.game]||v>best[l.game].v)best[l.game]={...l,v};
  }
  const pick=Object.values(best).sort((a,b)=>b.v-a.v).slice(0,n);
  if(pick.length<n)return null;
  const D=pick.reduce((a,l)=>a*dec(l.price),1),P=pick.reduce((a,l)=>a*l.p,1);
  return {legs:pick,n,decimal:D,american:amer(D),p:P,ev:P*D-1,negLegs:pick.filter(l=>l.v<0).length};
}
// one line under the legs: price, chance, EV, and an honest warning when a leg is -EV on its own
const summary=pl=>`about ${pl.american>0?"+":""}${pl.american} if your book prices it as the product of the legs · chance ${(pl.p*100).toFixed(1)}% · EV ${pl.ev>=0?"+":""}${(pl.ev*100).toFixed(0)}%`+
  (pl.negLegs?` · ${pl.negLegs} leg${pl.negLegs>1?"s are":" is"} -EV on its own (not enough good games)`:"");
module.exports={build,dec,amer,summary};
