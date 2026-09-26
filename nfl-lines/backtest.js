// Replays a finished season against nflverse's closing spread / total / moneylines.
//   node nfl-lines/backtest.js        (BT_SEASON=2025 BT_FROM=4 BT_TO=18; RATING=margin|srs)
// Closing lines are the sharpest number of the week, so this is a harder test than the
// ~90-minute-before-kickoff lines the live bot sees. QB changes use perfect information
// (the game's actual starter vs. the team's usual one).
const {env,log,summary}=require("../nfl-props/lib");
const data=require("../nfl-props/data"),M=require("./model");
const {recordedWeather}=require("../nfl-props/weather");

const S=env("BT_SEASON",2025),FROM=env("BT_FROM",4),TO=env("BT_TO",18);
const MIN_SPREAD=env("MIN_SPREAD",3),MIN_TOTAL=env("MIN_TOTAL",4),MIN_ML=env("MIN_ML",0.06);

(async()=>{
  const games=await data.schedule([S-1,S]);
  const rec=()=>({w:0,l:0,p:0,units:0});
  const res={spreadAll:rec(),spread:rec(),totalAll:rec(),total:rec(),ml:rec()};
  const grade=(r,won,push,price)=>{if(push){r.p++;return;}if(won){r.w++;r.units+=price?M.payout(price):100/110;}else{r.l++;r.units-=1;}};
  let err=0,errMkt=0,n=0;
  for(let W=FROM;W<=TO;W++){
    const R=M.ratings(games,S,W);
    // each team's usual starter = most common starting QB in its previous 3 games
    const usual=team=>{const prev=games.filter(g=>g.season===S&&g.week<W&&g.result!==""&&(g.home_team===team||g.away_team===team)).slice(-3)
      .map(g=>g.home_team===team?g.home_qb_id:g.away_qb_id);const c={};prev.forEach(q=>c[q]=(c[q]||0)+1);
      return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0];};
    for(const g of games.filter(x=>x.season===S&&x.week===W&&x.game_type==="REG"&&x.result!=="")){
      const hu=usual(g.home_team),au=usual(g.away_team);
      const P=M.predict(R,g,{homeQB:hu&&g.home_qb_id!==hu?"out":"",awayQB:au&&g.away_qb_id!==au?"out":"",wx:recordedWeather(g)});
      const margin=+g.home_score-+g.away_score,total=+g.home_score+ +g.away_score;
      n++;err+=Math.abs(P.margin-margin);errMkt+=Math.abs(+g.spread_line-margin);
      if(g.spread_line!==""){
        const sp=M.spreadPick(P,+g.spread_line),cover=margin-+g.spread_line;   // >0 home covers
        const won=sp.side==="home"?cover>0:cover<0;
        grade(res.spreadAll,won,cover===0);if(sp.cushion>=MIN_SPREAD)grade(res.spread,won,cover===0);
      }
      if(g.total_line!==""){
        const tp=M.totalPick(P,+g.total_line),d=total-+g.total_line,won=tp.side==="over"?d>0:d<0;
        grade(res.totalAll,won,d===0);if(tp.cushion>=MIN_TOTAL)grade(res.total,won,d===0);
      }
      const mp=M.mlPick(P,g.home_moneyline,g.away_moneyline);
      if(mp&&mp.edge>=MIN_ML)grade(res.ml,mp.side==="home"?margin>0:margin<0,margin===0,mp.price);
    }
  }
  const row=(k,label)=>{const r=res[k],t=r.w+r.l;return `| ${label} | ${r.w}-${r.l}${r.p?`-${r.p}`:""} | ${t?(100*r.w/t).toFixed(1)+"%":"-"} | ${r.units>=0?"+":""}${r.units.toFixed(1)}u | ${t?(100*r.units/(t)).toFixed(1)+"%":"-"} |`;};
  const md=`## Game-lines backtest ${S}, weeks ${FROM}-${TO} (RATING=${M.C.RATING})\n\n`+
    `Margin error: model ${(err/n).toFixed(2)} pts vs closing spread ${(errMkt/n).toFixed(2)} pts (${n} games)\n\n`+
    `| bet | record | win % | units (1u flat) | ROI |\n|---|---|---|---|---|\n`+
    [row("spreadAll","Spread, every game"),row("spread",`Spread, cushion ≥ ${MIN_SPREAD}`),row("totalAll","Total, every game"),
     row("total",`Total, cushion ≥ ${MIN_TOTAL}`),row("ml",`Moneyline, edge ≥ ${Math.round(MIN_ML*100)} pts`)].join("\n")+
    `\n\nBreak-even at -110 is 52.4%.\n`;
  console.log("\n"+md);summary(md);
})().catch(e=>{console.error(e);process.exit(1);});
