// Replays a finished season week by week using only data available before each week,
// and compares the projections with what actually happened.
//   node nfl-props/backtest.js            (BT_SEASON=2025 BT_FROM=4 BT_TO=18)
// Uses perfect inactive info (anyone who didn't play is "out") and nflverse's closing
// spread/total + recorded game-time wind, so it measures the model, not the injury feed.
const {env,log,summary}=require("./lib");
const data=require("./data"),M=require("./model");
const {recordedWeather}=require("./weather");

const S=env("BT_SEASON",2025),FROM=env("BT_FROM",4),TO=env("BT_TO",18);
const ACT={recYds:"ryds",rec:"rec",rushYds:"ruyds",passYds:"pyds"};
const MIN_BASE={recYds:20,rec:2,rushYds:20,passYds:150};

(async()=>{
  const DB=await data.load(S);
  const rows=[];
  for(let W=FROM;W<=TO;W++){
    const asOf=data.ord(S,W);
    for(const g of DB.games.filter(x=>x.season===S&&x.week===W&&x.game_type==="REG"&&x.result!=="")){
      for(const home of [true,false]){
        const team=home?g.home_team:g.away_team,opp=home?g.away_team:g.home_team;
        const cand=[],played=new Map();
        for(const [id,recs] of DB.pg){
          if(recs.some(r=>r.team===team&&r.o<asOf&&(r.season===S||W<=2)))cand.push(id);
          const r=recs.find(x=>x.gid===g.game_id&&x.team===team);if(r)played.set(id,r);
        }
        const res=M.projectTeam(DB,{team,opp,home,spread:g.spread_line,total:g.total_line,weather:recordedWeather(g),asOf,
          candidates:cand,status:id=>played.has(id)?"":"out"});
        for(const p of res.players){const a=played.get(p.id);if(!a)continue;
          for(const [s,v] of Object.entries(p.stats))rows.push({W,s,pos:p.pos,proj:v,base:p.base[s],act:a[ACT[s]],bumped:p.bump.t+p.bump.c>1});}
      }
    }
    log(`week ${W}: ${rows.length} player-stat rows so far`);
  }
  let md=`## Backtest ${S}, weeks ${FROM}-${TO}\n\n| stat | n | MAE model | MAE recent avg | bias | edge calls | hit rate | RMSE | fitted sd |\n|---|---|---|---|---|---|---|---|---|\n`;
  for(const s of Object.keys(ACT)){
    const R=rows.filter(r=>r.s===s&&r.base!=null&&r.base>=MIN_BASE[s]*0.5);if(!R.length)continue;
    const mae=f=>R.reduce((a,r)=>a+Math.abs(f(r)-r.act),0)/R.length;
    const bias=R.reduce((a,r)=>a+r.proj-r.act,0)/R.length;
    // "edge calls": projection at least 15% away from the recent average - how often is the model on the right side?
    const E=R.filter(r=>r.base>=MIN_BASE[s]&&Math.abs(r.proj/r.base-1)>=0.15&&r.act!==r.base);
    const hit=E.filter(r=>Math.sign(r.proj-r.base)===Math.sign(r.act-r.base)).length;
    // sd = A*mean^B from binned residuals
    const bins=[...R].sort((a,b)=>a.proj-b.proj),k=10,xs=[],ys=[];
    for(let i=0;i<k;i++){const b=bins.slice(Math.floor(i*bins.length/k),Math.floor((i+1)*bins.length/k));if(b.length<20)continue;
      const m=b.reduce((a,r)=>a+r.proj,0)/b.length,rm=Math.sqrt(b.reduce((a,r)=>a+(r.act-r.proj)**2,0)/b.length);xs.push(Math.log(m));ys.push(Math.log(rm));}
    const n=xs.length,mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;
    const B=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/xs.reduce((a,x)=>a+(x-mx)**2,0),A=Math.exp(my-B*mx);
    md+=`| ${s} | ${R.length} | ${mae(r=>r.proj).toFixed(2)} | ${mae(r=>r.base).toFixed(2)} | ${bias>=0?"+":""}${bias.toFixed(2)} | ${E.length} | ${E.length?(100*hit/E.length).toFixed(1)+"%":"-"} | ${Math.sqrt(R.reduce((a,r)=>a+(r.proj-r.act)**2,0)/R.length).toFixed(1)} | ${A.toFixed(2)}·m^${B.toFixed(2)} |\n`;
  }
  // calibration of P(over recent average) - what MIN_PROB actually means
  md+=`\n| P(over) bucket | calls | actual over rate |\n|---|---|---|\n`;
  for(const [lo,hi] of [[0,0.3],[0.3,0.42],[0.42,0.58],[0.58,0.7],[0.7,1.01]]){
    const R=rows.filter(r=>r.base!=null&&r.base>=MIN_BASE[r.s]&&r.act!==r.base).map(r=>({...r,p:M.pOver(r.s,r.proj,r.base)})).filter(r=>r.p>=lo&&r.p<hi);
    if(R.length)md+=`| ${lo}-${Math.min(hi,1)} | ${R.length} | ${(100*R.filter(r=>r.act>r.base).length/R.length).toFixed(1)}% |\n`;
  }
  console.log("\n"+md);summary(md);
})().catch(e=>{console.error(e);process.exit(1);});
