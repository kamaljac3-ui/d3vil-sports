// Grades the NFL bots' logged picks (both nfl-lines and nfl-props) against final results.
//   1. Actions -> "NFL Picks Export" -> Run, then: gh run download <id> -n nfl-state -D <dir>
//   2. node nfl-lines/grade.js <dir>            (writes <dir>/graded.json and prints a summary)
// Game lines are also graded on closing-line value (CLV): how far the closing number (nflverse's consensus
// close) moved toward our side after the alert. CLV is the quickest honest read on a small sample.
const fs=require("fs"),path=require("path");
const {parseCSV,getText,normName,env}=require("../nfl-props/lib");
const NV="https://github.com/nflverse/nflverse-data/releases/download";
const DIR=process.argv[2];if(!DIR){console.error("usage: node nfl-lines/grade.js <export dir>");process.exit(1);}
const S=env("SEASON",2026);

const implied=ml=>ml<0?-ml/(-ml+100):100/(ml+100);
const profit=(res,price)=>res==="W"?(price==null?100/110:price>0?price/100:100/-price):res==="L"?-1:0;
const read=f=>{try{return JSON.parse(fs.readFileSync(f,"utf8")).v||[];}catch(e){return [];}};
const picksOf=bot=>{const d=path.join(DIR,bot,".cache");return fs.existsSync(d)?fs.readdirSync(d).filter(f=>/^picks-.*\.json$/.test(f)).sort().flatMap(f=>read(path.join(d,f))):[];};

(async()=>{
  const G={};
  for(const g of parseCSV(await getText("https://github.com/nflverse/nfldata/raw/master/data/games.csv"),
    ["game_id","season","week","home_team","away_team","home_score","away_score","result","spread_line","total_line","home_moneyline","away_moneyline"]))
    if(+g.season===S)G[g.game_id]=g;
  const ST={};   // game|playerId and game|name -> stats row
  for(const r of parseCSV(await getText(`${NV}/stats_player/stats_player_week_${S}.csv.gz`)||"",
    ["game_id","player_id","player_display_name","receptions","receiving_yards","rushing_yards","passing_yards"])){
    ST[r.game_id+"|"+r.player_id]=r;ST[r.game_id+"|"+normName(r.player_display_name)]=r;}
  const STAT={rec:"receptions",recYds:"receiving_yards",rushYds:"rushing_yards",passYds:"passing_yards"};
  const out=[];

  // ---------- game lines (nfl-lines) ----------
  for(const p of picksOf("nfl-lines")){
    const g=G[p.game];const r={bot:"nfl-lines",kind:p.kind,market:p.market,game:p.game,week:g?+g.week:null,at:p.at,book:p.book||"consensus"};
    if(!g||g.result===""){out.push({...r,res:"pending"});continue;}
    const margin=g.home_score-g.away_score,close=+g.spread_line,tot=+g.home_score+ +g.away_score;
    const teamMargin=t=>t===g.home_team?margin:-margin;
    const closeNoVig=t=>{const h=implied(+g.home_moneyline),a=implied(+g.away_moneyline);return (t===g.home_team?h:a)/(h+a);};
    let res,clv=null,label,price=p.price??null;
    if(p.kind==="model"&&p.market==="spread"){
      const home=p.model-p.line>=0,team=home?g.home_team:g.away_team,pt=home?-p.line:p.line;   // p.line = expected home margin
      const d=teamMargin(team)+pt;res=d>0?"W":d<0?"L":"P";
      clv=home?close-p.line:p.line-close;label=`${team} ${pt>0?"+":""}${pt}`;
    }else if(p.market==="ml"){
      res=g.home_score==g.away_score?"P":teamMargin(p.team)>0?"W":"L";
      if(g.home_moneyline!=="")clv=closeNoVig(p.team)-implied(p.price);
      label=`${p.team} ML ${p.price>0?"+":""}${p.price}`;
    }else if(p.market==="spread"){   // stale spread: team + its own point
      const d=teamMargin(p.team)+p.point;res=d>0?"W":d<0?"L":"P";
      const closePt=p.team===g.home_team?-close:close;clv=p.point-closePt;label=`${p.team} ${p.point>0?"+":""}${p.point}`;
    }else if(p.market==="total"){
      const d=p.side==="Over"?tot-p.point:p.point-tot;res=d>0?"W":d<0?"L":"P";
      clv=p.side==="Over"?+g.total_line-p.point:p.point-+g.total_line;label=`${p.side} ${p.point}`;
    }else continue;
    out.push({...r,label,price,res,units:profit(res,price),clv,clvUnit:p.market==="ml"?"prob":"pts"});
  }

  // ---------- player props (nfl-props) ----------
  for(const p of picksOf("nfl-props")){
    const g=G[p.game];const r={bot:"nfl-props",kind:p.kind,market:p.market,game:p.game,week:g?+g.week:p.week,at:p.at,alert:p.alert,
      label:`${p.player} ${p.side} ${p.point} ${p.market}`,price:p.price??null,book:p.book||null};
    if(!g||g.result===""){out.push({...r,res:"pending"});continue;}
    const row=(p.playerId&&ST[p.game+"|"+p.playerId])||ST[p.game+"|"+normName(p.player)];
    if(!row){out.push({...r,res:"void"});continue;}   // didn't play (or no stat line)
    const v=+row[STAT[p.market]]||0,d=p.side==="Over"?v-p.point:p.point-v,res=d>0?"W":d<0?"L":"P";
    out.push({...r,actual:v,res,units:profit(res,r.price),proj:p.proj,prob:p.prob,fair:p.fair,ev:p.ev});
  }

  fs.writeFileSync(path.join(DIR,"graded.json"),JSON.stringify(out,null,1));
  const sum=(label,R)=>{const g=R.filter(x=>x.res==="W"||x.res==="L"||x.res==="P"),w=g.filter(x=>x.res==="W").length,l=g.filter(x=>x.res==="L").length,pu=g.length-w-l;
    const u=g.reduce((a,x)=>a+x.units,0),c=g.filter(x=>x.clv!=null);
    const cl=c.length?`CLV avg ${(c.reduce((a,x)=>a+x.clv,0)/c.length).toFixed(c[0].clvUnit==="prob"?3:2)} ${c[0].clvUnit} (better/same/worse than close: ${c.filter(x=>x.clv>1e-9).length}/${c.filter(x=>Math.abs(x.clv)<=1e-9).length}/${c.filter(x=>x.clv<-1e-9).length})`:"";
    return `${label.padEnd(34)} ${String(w).padStart(3)}-${String(l).padEnd(3)}${pu?`-${pu}`:"  "} ${w+l?(100*w/(w+l)).toFixed(1).padStart(5)+"%":"   - "}  ${(u>=0?"+":"")+u.toFixed(2)}u  ${cl}`;};
  const groups=[["Lines: model spread ✅",x=>x.bot==="nfl-lines"&&x.kind==="model"&&x.market==="spread"],["Lines: model moneyline ✅",x=>x.bot==="nfl-lines"&&x.kind==="model"&&x.market==="ml"],
    ["Lines: 💰 stale spread/total",x=>x.bot==="nfl-lines"&&x.kind==="stale"&&x.market!=="ml"],["Lines: 💰 stale moneyline",x=>x.bot==="nfl-lines"&&x.kind==="stale"&&x.market==="ml"],["Props: model vs line",x=>x.bot==="nfl-props"&&x.kind==="model"],
    ["  props model, Friday alert",x=>x.bot==="nfl-props"&&x.kind==="model"&&x.alert==="fri"],["  props model, game-day alert",x=>x.bot==="nfl-props"&&x.kind==="model"&&x.alert==="gameday"],
    ["  props model, Overs",x=>x.bot==="nfl-props"&&x.kind==="model"&&/Over/.test(x.label)],["  props model, Unders",x=>x.bot==="nfl-props"&&x.kind==="model"&&/Under/.test(x.label)],
    ["Props: 💰 stale",x=>x.bot==="nfl-props"&&x.kind==="stale"]];
  for(const [l,f] of groups)console.log(sum(l,out.filter(f)));
  console.log(`pending ${out.filter(x=>x.res==="pending").length}, void ${out.filter(x=>x.res==="void").length}`);
  // per-week W-L for each family (graded-weekly.json, for charts)
  const fam=x=>x.bot==="nfl-lines"?(x.kind==="stale"?"lines-stale":"lines-model"):(x.kind==="stale"?"props-stale":"props-model");
  const wk={};for(const x of out.filter(x=>["W","L","P"].includes(x.res))){const k=fam(x)+"|"+x.week,o=wk[k]||(wk[k]={fam:fam(x),week:x.week,w:0,l:0,p:0,units:0});o[x.res.toLowerCase()]++;o.units+=x.units;}
  fs.writeFileSync(path.join(DIR,"graded-weekly.json"),JSON.stringify(Object.values(wk).sort((a,b)=>a.week-b.week),null,1));
  for(const o of Object.values(wk).sort((a,b)=>a.fam.localeCompare(b.fam)||a.week-b.week))console.log(`  ${o.fam.padEnd(12)} wk${o.week}: ${o.w}-${o.l}${o.p?"-"+o.p:""} ${(o.units>=0?"+":"")+o.units.toFixed(2)}u`);
})().catch(e=>{console.error(e);process.exit(1);});
