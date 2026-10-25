// Weekly review: grades every Sunday first-look card the bot sent, keeps the ledger on the bot-results branch
// (cfb/picks.json, cfb/SUMMARY.md, cfb/reports/week-N.md) and sends a Monday scorecard to the CFB ntfy topic.
// The workflow checks out bot-results into LEDGER_DIR (default "ledger") and pushes it afterwards.
//   MODE=review  -> always review now (manual)     otherwise: Mondays from REVIEW_HOUR ET, once per week
// The first look is the card to bet (the backtest edge is against the opener), so that's what gets graded:
// ✅ spreads against the line in the card, plus "line moved our way" (CLV) against CFBD's closing consensus.
const fs=require("fs"),path=require("path");
process.env.NP_CACHE=process.env.NP_CACHE||path.join(__dirname,".cache");
const {env,envs,log,etParts,readState,ntfy,summary,LIVE,DRY}=require("../nfl-props/lib");
const D=require("./data"),cfbd=require("./cfbd");

const MODE=envs("MODE","auto"),REVIEW_HOUR=env("REVIEW_HOUR",10);
const DIR=path.join(envs("LEDGER_DIR","ledger"),"cfb");
const ET=etParts(),S=+ET.date.slice(0,4)-(+ET.date.slice(5,7)<3?1:0);
const pct=(w,l)=>w+l?(100*w/(w+l)).toFixed(1)+"%":"-";
const r1=v=>Math.round(v*2)/2;

function load(){
  fs.mkdirSync(path.join(DIR,"reports"),{recursive:true});
  const f=path.join(DIR,"picks.json");
  return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):{season:S,weeks:{}};
}
function save(L){fs.writeFileSync(path.join(DIR,"picks.json"),JSON.stringify(L,null,1)+"\n");}

// ---------- grading ----------
// Each slate row (home perspective): lm = line's home margin in the card, om = ours, se = spread edge, spick = ✅ sent.
function gradeRow(r,g,close){
  if(!g||!g.done)return;
  r.hm=g.hp-g.ap;r.tot=g.hp+g.ap;
  if(r.lm!=null&&r.om!=null&&r.om!==r.lm){const s=Math.sign(r.om-r.lm),d=s*(r.hm-r.lm);r.res=d>0?"W":d<0?"L":"P";
    if(close&&close.m!=null){r.close=close.m;r.clv=+(s*(close.m-r.lm)).toFixed(1);}}
  if(r.lt!=null&&r.ot!=null&&r.ot!==r.lt){const d=Math.sign(r.ot-r.lt)*(r.tot-r.lt);r.tres=d>0?"W":d<0?"L":"P";}
}
const rec=rows=>{let w=0,l=0,p=0;for(const r of rows)r.res==="W"?w++:r.res==="L"?l++:r.res==="P"&&p++;return {w,l,p,s:`${w}-${l}${p?"-"+p:""}`,pct:pct(w,l)};};
const moved=rows=>{const c=rows.filter(r=>r.clv!=null);return c.length?`${Math.round(100*c.filter(r=>r.clv>0).length/c.length)}%`:"-";};
const dog=r=>r.om>r.lm?r.lm<0:r.lm>0;   // the side we took is the underdog

function report(L,wk){
  const W=L.weeks[wk].games,all=Object.values(L.weeks).flatMap(x=>x.games);
  const picks=rows=>rows.filter(r=>r.spick&&r.res);
  const wp=picks(W),sp=picks(all),slate=all.filter(r=>r.res);
  const lines=[];
  lines.push(`Week ${wk} ✅ spreads: ${rec(wp).s} (${rec(wp).pct}), line moved our way ${moved(wp)}`);
  lines.push(`Season ✅ spreads: ${rec(sp).s} (${rec(sp).pct}), moved our way ${moved(sp)}. Breakeven 52.4%.`);
  const b=(lab,f)=>{const x=rec(slate.filter(f));return `${lab}: ${x.s} (${x.pct})`;};
  lines.push("","Every game in the cards, our side vs the card's line (season):",
    b("  edge 0-2",r=>r.se<2),b("  edge 2-4",r=>r.se>=2&&r.se<4),b("  edge 4-6",r=>r.se>=4&&r.se<6),b("  edge 6-8",r=>r.se>=6&&r.se<8),b("  edge 8+",r=>r.se>=8));
  const p4=slate.filter(r=>r.se>=4);
  lines.push("Edge 4+ by situation (season):",
    `  underdog ${rec(p4.filter(dog)).s} · favorite ${rec(p4.filter(r=>!dog(r))).s}`,
    `  line under 14 ${rec(p4.filter(r=>Math.abs(r.lm)<14)).s} · line 14+ ${rec(p4.filter(r=>Math.abs(r.lm)>=14)).s}`);
  const tt=all.filter(r=>r.tres&&Math.abs(r.ot-r.lt)>=4);let tw=0,tl=0;for(const r of tt)r.tres==="W"?tw++:r.tres==="L"&&tl++;
  lines.push(`Totals at edge 4+ (not flagged, tracking only): ${tw}-${tl} (${pct(tw,tl)})`);
  const miss=wp.filter(r=>r.res==="L").sort((a,b)=>Math.abs(b.hm-b.lm)-Math.abs(a.hm-a.lm)).slice(0,3);
  if(miss.length)lines.push("","Worst misses this week:",...miss.map(r=>{const side=r.om>r.lm?r.home:r.away;
    return `  ${r.away} @ ${r.home}: took ${side} at ${r.lm>0?r.home+" -"+r1(r.lm):r.away+" -"+r1(-r.lm)}, final ${r.away} ${r.tot/2-r.hm/2} - ${r.home} ${r.tot/2+r.hm/2}${r.why?` (why: ${r.why})`:""}`;}));
  if(sp.length<100)lines.push("",`Small sample (${sp.length} graded picks): don't change settings on this alone.`);
  return {title:`CFB week ${wk} review: ${rec(wp).s} · season ${rec(sp).s} (${rec(sp).pct})`,body:lines.join("\n")};
}

(async()=>{
  const due=MODE==="review"||(ET.wd==="Mon"&&ET.h>=REVIEW_HOUR);
  if(!due){log("review: not due");return;}
  const L=load();
  // merge new first-look cards the bot recorded (actions/cache state) into the ledger
  const sent=readState(`picks-${S}.json`)||{};
  for(const [wk,card] of Object.entries(sent))if(!L.weeks[wk])L.weeks[wk]=card;
  const weeks=Object.keys(L.weeks).map(Number).sort((a,b)=>a-b);
  if(!weeks.length){log("review: no first-look cards recorded yet");return;}
  const games=await D.games(S,S),G=new Map(games.map(g=>[g.id,g])),teams=await D.teams(S,S);
  const byAbbr={};for(const [name,t] of Object.entries(teams))byAbbr[t.abbr]=name;
  for(const wk of weeks){const W=L.weeks[wk];if(W.graded)continue;
    const close=D.lines?await D.lines(S,S,wk,24):{};
    for(const r of W.games){
      let g=r.gid?G.get(r.gid):null;
      if(!g){const h=byAbbr[r.home]||r.home,a=byAbbr[r.away]||r.away;g=games.find(x=>x.wk===wk&&x.home===h&&x.away===a);if(g)r.gid=g.id;}
      gradeRow(r,g,g&&D.consensus(close[g.id]));
    }
    W.graded=W.games.every(r=>!r.gid||G.get(r.gid)?.done);
  }
  save(L);
  // review the latest week whose games are (nearly) all final and that has no report yet
  const ready=weeks.filter(wk=>{const W=L.weeks[wk].games;return W.filter(r=>r.hm!=null).length>=0.8*W.length;});
  const wk=ready.reverse().find(w=>MODE==="review"||!fs.existsSync(path.join(DIR,"reports",`week-${w}.md`)));
  if(wk==null){log("review: nothing new to review");return;}
  const R=report(L,wk);
  const md=`# ${R.title}\n\n\`\`\`\n${R.body}\n\`\`\`\n`;
  fs.writeFileSync(path.join(DIR,"reports",`week-${wk}.md`),md);
  const sum=weeks.filter(w=>L.weeks[w].games.some(r=>r.res)).map(w=>{const x=rec(L.weeks[w].games.filter(r=>r.spick&&r.res));return `| ${w} | ${x.s} | ${x.pct} | ${moved(L.weeks[w].games.filter(r=>r.spick))} |`;});
  fs.writeFileSync(path.join(DIR,"SUMMARY.md"),`# CFB Lines scorecard (${S})\n\nFirst-look ✅ spread picks, graded against the line in the card.\n\n| week | record | win% | line moved our way |\n|---|---|---|---|\n${sum.join("\n")}\n\nLatest review:\n\n${md}`);
  summary(md);log(R.title+"\n"+R.body);
  await ntfy(R.title,R.body,3,["football","bar_chart"]);
  log(`CFBD calls this month: ${cfbd.usage().calls}/${cfbd.BUDGET}`);
})().catch(e=>{console.error(e);process.exit(1);});
