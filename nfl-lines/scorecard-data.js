// Builds the "NFL Bots 2026 Scorecard" dashboard's data files from the bot-results ledger plus fresh backtests.
//   node nfl-lines/scorecard-data.js <ledger dir with nfl/> <out dir>
// Writes picks.json, delivery.json, model_props.json, model_lines.json, tags.json, changes.json in the
// schemas the dashboard page reads (https://claude.ai/artifact/HLWg82VRvxsYgya4Gjpb2k). Used by the weekly
// Claude review, which uploads them to the dashboard. Takes a few minutes (it runs both backtests).
const fs=require("fs"),path=require("path"),{execFileSync}=require("child_process");
const {etToUtc,etParts}=require("../nfl-props/lib");
const data=require("../nfl-props/data");
const [LEDGER,OUT]=process.argv.slice(2);if(!LEDGER||!OUT){console.error("usage: node nfl-lines/scorecard-data.js <ledger dir> <out dir>");process.exit(1);}
fs.mkdirSync(OUT,{recursive:true});
const ROOT=path.join(__dirname,"..");
const S=+etParts().date.slice(0,4)-(+etParts().date.slice(5,7)<3?1:0);
const readJSON=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,"utf8"));}catch(e){return d;}};
const write=(f,v)=>fs.writeFileSync(path.join(OUT,f),JSON.stringify(v));
const run=(script,env)=>execFileSync(process.execPath,[path.join(ROOT,script)],{cwd:ROOT,env:{...process.env,...env},encoding:"utf8",maxBuffer:64<<20});
const rowsOf=(md,first)=>md.split("\n").filter(l=>l.startsWith("| "+first)).map(l=>l.split("|").slice(1,-1).map(c=>c.trim()));

(async()=>{
  const FAM={"nfl-lines|model":"Lines: model ✅","nfl-lines|stale":"Lines: 💰 stale price","nfl-props|model":"Props: model vs FanDuel line","nfl-props|stale":"Props: 💰 stale price"};
  // picks (ledger rows are grade.js output)
  const picks=readJSON(path.join(LEDGER,"nfl","picks.json"),[]).map((x,i)=>({id:i+1,family:FAM[x.bot+"|"+x.kind],bot:x.bot,kind:x.kind,market:x.market,week:x.week,
    pick:x.label,side:/ Over /.test(x.label||"")?"Over":/ Under /.test(x.label||"")?"Under":"",book:x.book||"",price:x.price??"",result:x.res,
    units:x.units==null?"":+x.units.toFixed(3),clv:x.clv==null?"":+x.clv.toFixed(4),clv_unit:x.clvUnit||"",alert:x.alert||""}));
  write("picks.json",picks);
  // delivery
  const delivery=readJSON(path.join(LEDGER,"nfl","delivery.json"),[]).map(d=>({week:d.week,schedule:d.week<=4?"15-minute cron":"long-running loop",
    lines_slots:d.lines_slots,lines_sent:d.lines_sent,props_games:d.props_games,props_checked:d.props_checked}));
  write("delivery.json",delivery);
  // latest week with every game final
  const sched=(await data.schedule([S])).map(g=>({...g,kick:etToUtc(g.gameday,g.gametime).getTime()}));
  const W=[...new Set(sched.map(g=>g.week))].sort((a,b)=>a-b).filter(w=>sched.filter(g=>g.week===w).every(g=>g.result!=="")).pop();
  // model checks on every game this season, weeks 4..W
  const NAME={recYds:"Receiving yards",rec:"Receptions",rushYds:"Rushing yards",passYds:"Passing yards"};
  const pmd=run("nfl-props/backtest.js",{BT_SEASON:String(S),BT_FROM:"4",BT_TO:String(W)});
  write("model_props.json",Object.keys(NAME).flatMap(k=>rowsOf(pmd,k+" ").map(c=>({stat:NAME[k],player_games:+c[1],mae_model:+c[2],mae_recent_avg:+c[3],
    bias:+c[4],edge_calls:+c[5],edge_hit_rate:+(parseFloat(c[6])/100).toFixed(3)}))));
  const lmd=run("nfl-lines/backtest.js",{BT_SEASON:String(S),BT_FROM:"4",BT_TO:String(W)});
  const LBET=[["Spread, every game","Spread, every game"],["Spread, cushion","Spread, model 3+ pts off"],["Moneyline, edge","Moneyline, model 6+ pts edge"],["Total, every game","Total, every game"]];
  write("model_lines.json",LBET.flatMap(([src,bet])=>rowsOf(lmd,src).slice(0,1).map(c=>{const [w,l,p]=c[1].split("-").map(Number);
    return {bet,wins:w,losses:l,pushes:p||0,win_rate:+(w/(w+l)).toFixed(3)};})));
  // tag situations this season vs the 2013-2025 research
  const tmp=path.join(OUT,"_pa.json");
  run("nfl-lines/research/position-absences.js",{FROM:String(S),TO:String(S),MIN_CELL:"1",JSON_OUT:tmp});
  const pa=readJSON(tmp,[]);fs.rmSync(tmp,{force:true});
  const TAGS=[["Own 2+ OL starters missing","Offense missing 2+ starting O-linemen",0.439,364],["Opp CB starter(s) missing","Defense missing a starting CB",0.542,650],
    ["Opp DL or LB missing vs run-heavy offense","Defense missing DL/LB vs run-heavy offense",0.493,507]];
  write("tags.json",TAGS.map(([src,situation,hist,n])=>{const r=pa.find(x=>x.situation===src)||{covers:0,misses:0};
    return {situation,measure:"offense covers",wins_2026:r.covers,losses_2026:r.misses,rate_2026:r.covers+r.misses?+(r.covers/(r.covers+r.misses)).toFixed(3):0,historical_rate:hist,historical_games:n};}));
  // change log (kept on the ledger by the weekly review)
  write("changes.json",readJSON(path.join(LEDGER,"nfl","changes.json"),[]));
  console.log(`scorecard data for ${S} through week ${W}: ${picks.length} picks -> ${OUT}`);
})().catch(e=>{console.error(e);process.exit(1);});
