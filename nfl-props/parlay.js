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
// ---------- read-aloud script (the "Jackson 5" push): numbers the way bettors say them ----------
const ONES=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function words(n){n=Math.round(n);if(n<0)return "minus "+words(-n);if(n<20)return ONES[n];if(n<100)return TENS[Math.floor(n/10)]+(n%10?"-"+ONES[n%10]:"");
  if(n<1000)return ONES[Math.floor(n/100)]+" hundred"+(n%100?" "+words(n%100):"");return words(Math.floor(n/1000))+" thousand"+(n%1000?" "+words(n%1000):"");}
// 34.5 -> "thirty-four and a half", 4 -> "four"
const spokenLine=x=>{const w=Math.floor(x),h=Math.abs(x-w-0.5)<1e-9;return (w===0&&h?"a half":words(w)+(h?" and a half":""));};
// -110 -> "minus one-ten", +116 -> "plus one-sixteen", +2400 -> "plus twenty-four hundred"
function spokenOdds(ml){const a=Math.abs(Math.round(ml)),sign=ml<0?"minus ":"plus ";
  if(a>=1000&&a%100===0&&a<10000)return sign+words(a/100)+" hundred";
  if(a>=1000&&a<10000){const h=Math.floor(a/100),r=a%100;return sign+words(h)+" "+(r<10?"oh-"+ONES[r]:words(r));}   // 2582 -> twenty-five eighty-two
  if(a>=100&&a<1000){const h=Math.floor(a/100),r=a%100;return sign+ONES[h]+(r===0?" hundred":r<10?"-oh-"+ONES[r]:"-"+words(r));}
  return sign+words(a);}
const LEG=["one","two","three","four","five","six","seven","eight"];
// legs: [{who, bet (spoken), why: [short spoken reasons]}]; title e.g. "NBA Saturday"
function script(pl,legs,{title,book}){
  const lines=[`It's Jackson 5 time. Five games, five props, one ticket. ${title}.`];
  legs.forEach((l,i)=>lines.push(`Leg ${LEG[i]||i+1}: ${l.who}, ${l.bet}. ${l.why.filter(Boolean).slice(0,2).join(" ")}`.trim()));
  const odds=pl.american,chance=pl.p,oneIn=Math.max(2,Math.round(1/chance));
  lines.push(`Put together, that's about ${spokenOdds(odds)} on ${book}. Our numbers give it roughly a one-in-${words(oneIn)} shot, so keep it small. That's the Jackson 5. Twenty-one and over, and bet responsibly.`);
  return lines.join("\n\n");
}
module.exports={build,dec,amer,summary,words,spokenLine,spokenOdds,script};
