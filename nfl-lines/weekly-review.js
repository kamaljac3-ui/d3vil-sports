// Weekly NFL bot review (run by .github/workflows/nfl-weekly-review.yml every Tuesday morning, after MNF).
// 1. `node nfl-lines/grade.js .` has already graded every pick in the restored caches -> ./graded.json
// 2. This script merges those grades into a permanent ledger on the bot-results branch (LEDGER_DIR/nfl/),
//    so picks outlive the bots' 7-day Actions caches, records alert delivery per week, writes
//    LEDGER_DIR/nfl/SUMMARY.md, and sends a short scorecard to the NFL ntfy feed.
// The Claude weekly review reads this ledger to look for what to improve; nothing here changes a bot.
const fs=require("fs"),path=require("path");
const {etToUtc,etParts,ntfy,log,envs,LIVE}=require("../nfl-props/lib");
const data=require("../nfl-props/data");

const LEDGER=path.join(envs("LEDGER_DIR","ledger"),"nfl");fs.mkdirSync(LEDGER,{recursive:true});
const S=+etParts().date.slice(0,4)-(+etParts().date.slice(5,7)<3?1:0);
const readJSON=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,"utf8"));}catch(e){return d;}};
const state=(bot,f)=>{const v=readJSON(path.join(bot,".cache",f),null);return v&&v.v;};

(async()=>{
  // ---------- merge grades into the ledger ----------
  const fresh=readJSON("graded.json",[]);
  const key=p=>`${p.bot}|${p.at}|${p.label}`;
  const ledger=new Map(readJSON(path.join(LEDGER,"picks.json"),[]).map(p=>[key(p),p]));
  for(const p of fresh)ledger.set(key(p),p);   // newer grade wins (pending -> W/L/P)
  const picks=[...ledger.values()].sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  fs.writeFileSync(path.join(LEDGER,"picks.json"),JSON.stringify(picks,null,1));

  // ---------- alert delivery per week (from the bots' sent markers) ----------
  const sched=(await data.schedule([S])).map(g=>({...g,kick:etToUtc(g.gameday,g.gametime).getTime()}));
  const lsent=state("nfl-lines","sent-"+S+".json")||{};
  const delivery=new Map(readJSON(path.join(LEDGER,"delivery.json"),[]).map(d=>[d.week,d]));
  for(const w of [...new Set(sched.map(g=>g.week))]){
    const done=sched.filter(g=>g.week===w&&g.result!==""&&g.kick>=Date.parse("2026-09-27T00:00:00Z"));if(!done.length)continue;
    const slots=[...new Set(done.map(g=>g.kick))],pm=state("nfl-props",`sent-${S}-w${w}.json`);
    const row={week:w,lines_slots:slots.length,lines_sent:slots.filter(k=>lsent[k]).length,props_games:done.length,
      props_checked:pm?done.filter(g=>pm.games&&pm.games[g.game_id]).length:null};
    const old=delivery.get(w);   // a cache can lose markers; never let a week's count go down
    if(!old||row.lines_sent>=old.lines_sent)delivery.set(w,{...old,...row,props_checked:row.props_checked??(old&&old.props_checked)});
  }
  const del=[...delivery.values()].sort((a,b)=>a.week-b.week);
  fs.writeFileSync(path.join(LEDGER,"delivery.json"),JSON.stringify(del,null,1));

  // ---------- the week to review: the latest week whose games are all final ----------
  const weeks=[...new Set(sched.map(g=>g.week))].sort((a,b)=>a-b);
  const W=weeks.filter(w=>sched.filter(g=>g.week===w).every(g=>g.result!=="")).pop();
  const fam=p=>p.kind==="stale"?(p.bot==="nfl-props"?"Props 💰 stale":"Lines 💰 stale"):(p.bot==="nfl-props"?"Props model":"Lines model ✅");
  const tally=R=>{const g=R.filter(p=>["W","L","P"].includes(p.res)),w=g.filter(p=>p.res==="W").length,l=g.filter(p=>p.res==="L").length;
    const u=g.reduce((a,p)=>a+(p.units||0),0),c=g.filter(p=>p.clv!=null);
    return {w,l,p:g.length-w-l,u,rec:`${w}-${l}${g.length-w-l?"-"+(g.length-w-l):""}`,pct:w+l?(100*w/(w+l)).toFixed(1)+"%":"-",
      clv:c.length?`${c.filter(p=>p.clv>1e-9).length}/${c.length} beat close`:""};};
  const fams=["Props model","Props 💰 stale","Lines 💰 stale","Lines model ✅"];
  const row=(label,R)=>{const t=tally(R);return `| ${label} | ${t.rec} | ${t.pct} | ${(t.u>=0?"+":"")+t.u.toFixed(2)}u | ${t.clv} |`;};
  const wk=picks.filter(p=>p.week===W),dW=del.find(d=>d.week===W);
  let md=`# NFL bots: season review (updated ${etParts().date})\n\n`+
    `Ledger: \`nfl/picks.json\` (every graded pick), \`nfl/delivery.json\` (alerts sent per week). Graded by \`nfl-lines/grade.js\`.\n\n`+
    `## Week ${W}\n\n| pick type | record | win % | units | closing line |\n|---|---|---|---|---|\n`+
    fams.map(f=>row(f,wk.filter(p=>fam(p)===f))).join("\n")+
    `\n\nAlerts delivered: lines ${dW?`${dW.lines_sent}/${dW.lines_slots} slots`:"n/a"}, props game-day checks ${dW&&dW.props_checked!=null?`${dW.props_checked}/${dW.props_games} games`:"n/a"}.\n\n`+
    `## Season to date\n\n| pick type | record | win % | units | closing line |\n|---|---|---|---|---|\n`+
    fams.map(f=>row(f,picks.filter(p=>fam(p)===f))).join("\n")+
    `\n\n## By week\n\n| week | `+fams.join(" | ")+` | lines alerts |\n|---|${fams.map(()=>"---|").join("")}---|\n`+
    [...new Set(picks.map(p=>p.week).filter(Boolean))].sort((a,b)=>a-b).map(w=>{const d=del.find(x=>x.week===w);
      return `| ${w} | `+fams.map(f=>{const t=tally(picks.filter(p=>p.week===w&&fam(p)===f));return t.w+t.l+t.p?`${t.rec} (${(t.u>=0?"+":"")+t.u.toFixed(1)}u)`:"";}).join(" | ")+` | ${d?`${d.lines_sent}/${d.lines_slots}`:""} |`;}).join("\n")+
    `\n\n## Week ${W} picks\n\n`+wk.filter(p=>p.res!=="pending").map(p=>`- ${p.res} ${fam(p)}: ${p.label}${p.book?` (${p.book}${p.price!=null?" "+(p.price>0?"+":"")+p.price:""})`:""}${p.units!=null?` ${(p.units>=0?"+":"")+p.units.toFixed(2)}u`:""}`).join("\n")+"\n";
  fs.writeFileSync(path.join(LEDGER,"SUMMARY.md"),md);
  log(`ledger: ${picks.length} picks, week ${W} reviewed`);

  // ---------- phone scorecard ----------
  const lines=fams.map(f=>{const t=tally(wk.filter(p=>fam(p)===f));return t.w+t.l+t.p?`${f}: ${t.rec} (${(t.u>=0?"+":"")+t.u.toFixed(2)}u)${t.clv?", "+t.clv:""}`:null;}).filter(Boolean);
  const season=tally(picks.filter(p=>fam(p)!=="Lines model ✅"));
  const msg=(lines.length?lines.join("\n"):"No graded picks this week.")+
    `\n\nAlerts: lines ${dW?`${dW.lines_sent}/${dW.lines_slots}`:"n/a"} slots`+(dW&&dW.props_checked!=null?`, props ${dW.props_checked}/${dW.props_games} games`:"")+
    `\nSeason (excl. retired lines ✅): ${season.rec}, ${(season.u>=0?"+":"")+season.u.toFixed(2)}u`+
    `\n\nClaude's weekly review follows with what to improve.`;
  const url=process.env.GITHUB_SERVER_URL?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/blob/bot-results/nfl/SUMMARY.md`:"";
  // one scorecard per week: the backup Tuesday run (or a rerun) won't send it again unless FORCE_SEND=1
  const sentF=path.join(LEDGER,"scorecards.json"),sent=readJSON(sentF,{});
  if(sent[W]&&process.env.FORCE_SEND!=="1")log(`week ${W} scorecard already sent ${sent[W]}`);
  else{const ok=await ntfy(`NFL bots week ${W} review`,msg,3,["football","bar_chart"],url);
    if(LIVE&&ok){sent[W]=new Date().toISOString();fs.writeFileSync(sentF,JSON.stringify(sent,null,1));}}
  if(!LIVE)log("(dry run or no topic: nothing sent)");
})().catch(e=>{console.error(e);process.exit(1);});
