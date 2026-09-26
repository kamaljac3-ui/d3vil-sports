// Game-lines model: team ratings -> predicted margin, win probability and total.
// A port of nfl-edge-finder's model (same defaults), plus an optional strength-of-schedule
// rating (RATING=srs) that the backtest compares against the original (RATING=margin).
const {env,envs}=require("../nfl-props/lib");
const {ord}=require("../nfl-props/data");

const C={
  RATING:envs("RATING","margin"),        // "margin" (nfl-edge-finder) or "srs" (schedule-adjusted)
  DECAY:env("DECAY",0.90),               // weight per week of age: a 10-week-old game counts ~35%
  BLEND_WEEKS:env("BLEND_WEEKS",4),      // last season's rating fades out over this many games
  HFA:env("HFA",2.0),                    // home-field points (0 at neutral sites)
  DIV_HFA_CUT:env("DIV_HFA_CUT",1.0),    // divisional games: less home edge
  REST_K:env("REST_K",0.5),MAX_REST:env("MAX_REST",4.0),   // points per day of rest advantage, capped
  QB_OUT:env("QB_OUT",6.0),QB_DOUBTFUL:env("QB_DOUBTFUL",3.0),
  SD_MARGIN:env("SD_MARGIN",13.5),SD_TOTAL:env("SD_TOTAL",10.0),
  WIND_MPH:env("WIND_MPH",15),WIND_PTS:env("WIND_PTS",-3),PRECIP_IN:env("PRECIP_IN",0.04),PRECIP_PTS:env("PRECIP_PTS",-2),WX_CAP:env("WX_CAP",-5),
};
const Phi=z=>{const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p;};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// Completed games as team-perspective rows.
function teamRows(games,asOf){
  const T=new Map();
  for(const g of games){
    if(g.result===""||g.home_score===""||ord(g.season,g.week)>=asOf)continue;
    const hs=+g.home_score,as=+g.away_score,neutral=g.location==="Neutral";
    const add=(team,opp,pf,pa,home)=>{(T.get(team)||T.set(team,[]).get(team)).push({season:g.season,week:g.week,o:ord(g.season,g.week),opp,pf,pa,
      // margin with home field taken out, so a home win isn't over-credited
      adj:pf-pa-(neutral?0:(home?C.HFA:-C.HFA))});};
    add(g.home_team,g.away_team,hs,as,true);add(g.away_team,g.home_team,as,hs,false);
  }
  return T;
}

// Ratings for every team as of a given week: {team: {r, pf, pa}} (points per game for totals).
function ratings(games,S,week){
  const asOf=ord(S,week),T=teamRows(games,asOf);
  const cur=new Map(),prev=new Map();
  for(const [t,rows] of T){cur.set(t,rows.filter(r=>r.season===S));prev.set(t,rows.filter(r=>r.season===S-1));}
  const wOf=r=>Math.pow(C.DECAY,Math.max(0,week-r.week));
  const avg=(rows,f,w)=>{let a=0,b=0;for(const r of rows){const x=w?w(r):1;a+=x*f(r);b+=x;}return b?a/b:0;};
  const solve=(pick,weight)=>{
    const R=new Map();for(const t of T.keys())R.set(t,avg(pick(t),r=>C.RATING==="srs"?r.adj:r.pf-r.pa,weight));
    if(C.RATING==="srs")for(let it=0;it<60;it++){
      const N=new Map();
      for(const t of T.keys()){const rows=pick(t);N.set(t,avg(rows,r=>r.adj+(R.get(r.opp)||0),weight));}
      const m=[...N.values()].reduce((a,b)=>a+b,0)/N.size;for(const [t,v] of N)R.set(t,v-m);
    }
    return R;
  };
  const Rcur=solve(t=>cur.get(t)||[],wOf),Rprev=solve(t=>prev.get(t)||[],null);
  const lgPts=avg([...T.values()].flat().filter(r=>r.season===S||!cur.size),r=>r.pf)||22;
  const out={};
  for(const t of T.keys()){
    const n=(cur.get(t)||[]).length,wp=clamp(1-n/C.BLEND_WEEKS,0,1),c=cur.get(t)||[],p=prev.get(t)||[];
    const blend=(a,b)=>n===0?b:(p.length?wp*b+(1-wp)*a:a);
    out[t]={r:blend(Rcur.get(t),Rprev.get(t)),
      pf:blend(avg(c,r=>r.pf,wOf),p.length?avg(p,r=>r.pf):lgPts),pa:blend(avg(c,r=>r.pa,wOf),p.length?avg(p,r=>r.pa):lgPts),n};
  }
  return out;
}

// game: nflverse schedule row. adj: {homeQB:"out"|"doubtful"|"", awayQB, wx}
function predict(R,g,adj={}){
  const h=R[g.home_team]||{r:0,pf:22,pa:22},a=R[g.away_team]||{r:0,pf:22,pa:22};
  const neutral=g.location==="Neutral";
  let hfa=neutral?0:C.HFA;if(!neutral&&g.div_game==="1")hfa-=C.DIV_HFA_CUT;
  const rest=g.home_rest!==""&&g.away_rest!==""?clamp(C.REST_K*(+g.home_rest-+g.away_rest),-C.MAX_REST,C.MAX_REST):0;
  const qb=s=>s==="out"?C.QB_OUT:s==="doubtful"?C.QB_DOUBTFUL:0;
  const hq=qb(adj.homeQB),aq=qb(adj.awayQB);
  let wx=0;const w=adj.wx;
  if(w&&!w.indoor){if(w.wind>=C.WIND_MPH)wx+=C.WIND_PTS;if(w.precip>=C.PRECIP_IN)wx+=C.PRECIP_PTS;wx=Math.max(wx,C.WX_CAP);}
  const margin=h.r-a.r+hfa+rest-hq+aq;
  const homePts=(h.pf+a.pa)/2-hq+wx/2,awayPts=(a.pf+h.pa)/2-aq+wx/2;
  return {margin,pHome:Phi(margin/C.SD_MARGIN),total:homePts+awayPts,homePts,awayPts,parts:{hfa,rest,hq,aq,wx}};
}

// ---------- market comparisons ----------
const implied=ml=>ml<0?-ml/(-ml+100):100/(ml+100);
function devig(homeML,awayML){const h=implied(homeML),a=implied(awayML);return {home:h/(h+a),away:a/(h+a)};}
// mktMargin = market's expected home margin (positive = home favored)
function spreadPick(P,mktMargin){const c=P.margin-mktMargin;return {side:c>=0?"home":"away",cushion:Math.abs(c),prob:Phi(Math.abs(c)/C.SD_MARGIN)};}
function totalPick(P,line){const c=P.total-line;return {side:c>=0?"over":"under",cushion:Math.abs(c),prob:Phi(Math.abs(c)/C.SD_TOTAL)};}
function mlPick(P,homeML,awayML){if(homeML==null||awayML==null||homeML===""||awayML==="")return null;
  const m=devig(+homeML,+awayML),eh=P.pHome-m.home;
  return eh>=0?{side:"home",edge:eh,model:P.pHome,market:m.home,price:+homeML}:{side:"away",edge:-eh,model:1-P.pHome,market:m.away,price:+awayML};}
const payout=ml=>ml>0?ml/100:100/-ml;   // profit per 1 unit staked

module.exports={C,ratings,predict,spreadPick,totalPick,mlPick,devig,payout,Phi};
