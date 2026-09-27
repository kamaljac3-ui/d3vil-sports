// Stale-line finder: compare the books you bet at against a sharp book (Pinnacle by default).
// The sharp book's two-way price, with its margin removed, is taken as the fair probability.
// That fair line is shifted to the exact number a soft book is offering (normal approximation),
// and any offer whose expected value clears the threshold is flagged.
//
// Every market is put on one scale: side "A" wins if X > L, side "B" wins if X < L.
//   totals / props: X = the total or player stat, L = the posted number, A = Over, B = Under
//   spreads:        X = home margin, L = -(home spread),  A = home covers, B = away covers
//   moneyline:      no number; the fair no-vig probability is used directly
const {env,envs}=require("./lib");

const SHARP=envs("ODDS_SHARP","pinnacle,lowvig,betonlineag").split(",").map(s=>s.trim()).filter(Boolean);   // first one present wins
const MINE=envs("MY_BOOKS","draftkings,fanduel,betmgm,williamhill_us,espnbet,fanatics,betrivers").split(",").map(s=>s.trim()).filter(Boolean);
// Odds API bills every 10 bookmakers as one region, so ask for exactly the sharp + your books (max 10).
const BOOKMAKERS=process.env.ODDS_BOOKMAKERS||[...new Set([...SHARP,...MINE])].slice(0,10).join(",");

const Phi=z=>{const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p;};
function invPhi(p){let lo=-8,hi=8;for(let i=0;i<60;i++){const m=(lo+hi)/2;if(Phi(m)<p)lo=m;else hi=m;}return (lo+hi)/2;}
const implied=ml=>ml<0?-ml/(-ml+100):100/(ml+100);
const payout=ml=>ml>0?ml/100:100/-ml;
const ev=(p,price)=>p*payout(price)-(1-p);

// offers: [{key, title, side:"A"|"B", L, price}] for ONE market/participant.
// opts: {sigma, maxGap, minEV}. Returns flagged soft offers, best first.
function staleTwoWay(offers,{sigma,maxGap,minEV}){
  let sharp=null;
  for(const k of SHARP){
    const a=offers.filter(o=>o.key===k&&o.side==="A"),b=offers.filter(o=>o.key===k&&o.side==="B");
    const pair=a.map(x=>[x,b.find(y=>y.L===x.L)]).find(p=>p[1]);
    if(pair){const [A,B]=pair,qa=implied(A.price)/(implied(A.price)+implied(B.price));sharp={key:k,title:A.title,L:A.L,qa,A,B};break;}
  }
  if(!sharp)return [];
  const mu=sharp.L+sigma*invPhi(sharp.qa);   // where the sharp book's fair line centers X
  const out=[];
  for(const o of offers){
    if(!MINE.includes(o.key)||o.price==null||Math.abs(o.L-sharp.L)>maxGap)continue;
    const pA=Phi((mu-o.L)/sigma),p=o.side==="A"?pA:1-pA,e=ev(p,o.price);
    if(e>=minEV)out.push({...o,fair:p,ev:e,sharp});
  }
  return out.sort((x,y)=>y.ev-x.ev);
}
function staleMoneyline(offers,{minEV}){   // offers: [{key,title,side:"A"(home)|"B"(away),price}]
  let q=null,sharp=null;
  for(const k of SHARP){const A=offers.find(o=>o.key===k&&o.side==="A"),B=offers.find(o=>o.key===k&&o.side==="B");
    if(A&&B){q=implied(A.price)/(implied(A.price)+implied(B.price));sharp={key:k,title:A.title,A,B};break;}}
  if(q==null)return [];
  return offers.filter(o=>MINE.includes(o.key)).map(o=>{const p=o.side==="A"?q:1-q;return {...o,fair:p,ev:ev(p,o.price),sharp};})
    .filter(o=>o.ev>=minEV).sort((x,y)=>y.ev-x.ev);
}
// keep only the best offer per side (several books often share the same stale number)
function bestPerSide(list){const seen=new Set();return list.filter(o=>{const k=o.side+"|"+o.L;if(seen.has(k))return false;seen.add(k);return true;});}

const fmt=p=>p==null?"":(p>0?"+":"")+p;
module.exports={staleTwoWay,staleMoneyline,bestPerSide,BOOKMAKERS,SHARP,MINE,invPhi,Phi,ev,payout,fmt};
