// CFB weekly review: the learning loop. Merges every pick the bot logged (state picks-<S>-w<wk>.json, written by
// run.js only on real sends) into the ledger on the bot-results branch (LEDGER_DIR/cfb/picks.json), grades each one
// (W-L-push, units at -110, closing line value), writes cfb/SUMMARY.md + cfb/reports/week-N.md, and sends one
// scorecard per week to the CFB ntfy topic.
//   MODE=review -> review now (manual; FORCE_SEND=1 resends a week's scorecard)
//   otherwise   -> Monday from REVIEW_HOUR ET (or Tuesday as a backup), once per week (cfb/scorecards.json)
// CLV first: "did the market move to our number" shows an edge (or none) in ~50 picks; W-L needs hundreds.
// Grading costs at most one CFBD /lines call per finished week (the close), plus the bot's own cached schedule.
const fs=require("fs"),path=require("path");
process.env.NP_CACHE=process.env.NP_CACHE||path.join(__dirname,".cache");
const {env,envs,log,etParts,ntfy,summary,CACHE,LIVE}=require("../nfl-props/lib");
const D=require("./data"),M=require("./model"),cfbd=require("./cfbd");

const MODE=envs("MODE","auto"),REVIEW_HOUR=env("REVIEW_HOUR",8),FORCE=process.env.FORCE_SEND==="1";
const MIN_TAG=env("REVIEW_MIN_TAG",10);   // tag rows with fewer graded leans are folded into "rare tags"
const DIR=path.join(envs("LEDGER_DIR","ledger"),"cfb");
const ET=etParts(),S=+ET.date.slice(0,4)-(+ET.date.slice(5,7)<3?1:0);
const readJSON=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,"utf8"));}catch(e){return d;}};
const WIN=100/110;   // CFBD has no spread prices: every pick is graded at -110

// ---------- ledger ----------
// v2: {season, picks:[record]}. The first ledger ({season, weeks:{wk:{sentAt,games}}}, weeks 5-8 rebuilt from run
// logs) is converted once: those are first-look cards from model v1.
function load(){
  fs.mkdirSync(path.join(DIR,"reports"),{recursive:true});
  const L=readJSON(path.join(DIR,"picks.json"),null);
  if(!L)return {season:S,picks:[]};
  if(Array.isArray(L.picks))return L;
  const picks=[];
  for(const [wk,c] of Object.entries(L.weeks||{}))for(const r of c.games){
    picks.push({key:r.gid?`first|${r.gid}`:`first|seed|${wk}|${r.away}@${r.home}`,S:L.season||S,wk:+wk,gid:r.gid||null,card:"first",ver:"v1",
      sentAt:c.sentAt,seeded:c.seeded||true,away:r.away,home:r.home,lm:r.lm,lt:r.lt??null,om:r.om,ot:r.ot??null,se:r.se,
      te:r.ot!=null&&r.lt!=null?+Math.abs(r.ot-r.lt).toFixed(1):0,spick:!!r.spick,tpick:false,wx:wxFromWhy(r.why||""),why:r.why||""});}
  return {season:L.season||S,picks};
}
function wxFromWhy(w){
  const n=re=>{const m=w.match(re);return m?+m[1]:null;};
  if(/indoors/.test(w))return {indoor:true};
  const wind=n(/wind (\d+) mph/);return wind==null?null:{wind,precip:n(/rain ([\d.]+)"/)||0,temp:n(/mph[^,]*(?:, rain [\d.]+"\/hr)?, (-?\d+)°F/),dew:n(/dew point (\d+)°F/)};
}
function merge(L){
  const by=new Map(L.picks.map(p=>[p.key,p]));let n=0;
  for(const f of fs.existsSync(CACHE)?fs.readdirSync(CACHE).filter(f=>f.startsWith(`picks-${S}-w`)):[]){
    const st=readJSON(path.join(CACHE,f),null),v=st&&st.v;if(!v)continue;
    for(const r of Object.values(v))if(!by.has(r.key)){by.set(r.key,r);n++;}}
  L.picks=[...by.values()];return n;
}

// ---------- grading ----------
const sgn=x=>x>0?1:x<0?-1:0;
function grade(r,g,close){
  r.hm=g.hp-g.ap;r.tot=g.hp+g.ap;
  const s=sgn(r.om-r.lm);   // +1 = our side is the home team
  if(r.lm!=null&&s){const d=s*(r.hm-r.lm);r.res=d>0?"W":d<0?"L":"P";r.units=+(d>0?WIN:d<0?-1:0).toFixed(3);
    if(close&&close.m!=null){r.close=+close.m.toFixed(2);r.clv=+(s*(close.m-r.lm)).toFixed(2);}}
  const t=sgn((r.ot??r.lt)-r.lt);
  if(r.lt!=null&&r.ot!=null&&t){const d=t*(r.tot-r.lt);r.tres=d>0?"W":d<0?"L":"P";r.tunits=+(d>0?WIN:d<0?-1:0).toFixed(3);
    if(close&&close.t!=null){r.tclose=+close.t.toFixed(2);r.tclv=+(t*(close.t-r.lt)).toFixed(2);}}
  r.graded=new Date().toISOString().slice(0,10);
}
// Fields the bot logs live, rebuilt from the schedule for seeded records (no kickoff weather or availability).
function fillStatic(r,g,ctx){
  if(r.kick==null)r.kick=new Date(g.start).toISOString();
  if(r.conf==null)r.conf=!!g.conf;if(r.neutral==null)r.neutral=!!g.neutral;
  if(!r.rest)r.rest={home:+M.restDays(ctx.games,g.home,g).toFixed(1),away:+M.restDays(ctx.games,g.away,g).toFixed(1)};
  if(!r.f&&ctx.venues){const f=M.features(ctx,g,{});r.f={home:f.home,capZ:+f.capZ.toFixed(1),travel:+f.travel.toFixed(1),tz:f.tz,rest:f.rest,
    climb:+f.climb.toFixed(2),descend:+f.descend.toFixed(2),humid:0,heat:0,dome:f.dome};}
}

// ---------- tags: what the review splits on. Oriented to OUR side of the spread. ----------
// Angle tags are the situational ideas worth testing; "no tags" = none of them. Structural splits (favorite/dog,
// home/road, line size, edge size, card) are shown separately and don't count as tags.
const fam=t=>t.split(":")[0];
function sideOf(r){const s=sgn(r.om-r.lm);return {s,home:s>0,dog:s>0?r.lm<0:r.lm>0};}
function tags(r){
  const {s}=sideOf(r),T=[],f=r.f||{},o=r.outs||{},us=s>0?"home":"away",them=s>0?"away":"home";
  const helps=(name,v,min)=>{if(Math.abs(v||0)>=min)T.push(`${name}: ${s*v>0?"helps us":"hurts us"}`);};
  if(r.rest){const a=r.rest[us],b=r.rest[them];
    if(a<=5.5)T.push("rest: we're on a short week");if(b<=5.5)T.push("rest: they're on a short week");
    if(a>=12&&b<12)T.push("rest: we're off a bye, they aren't");if(b>=12&&a<12)T.push("rest: they're off a bye, we aren't");}
  helps("altitude climb",f.climb,0.2);helps("coming down from altitude",f.descend,0.2);
  helps("humidity vs home",f.humid,0.3);helps("heat vs home",f.heat,0.3);
  helps("travel (1,000+ mi more)",f.travel,1);helps("time zones (2+)",f.tz,2);
  if(f.capZ!=null&&f.capZ<=-0.8&&f.home>0)T.push(`small home crowd: ${s>0?"we're home":"we're the visitor"}`);
  if(r.neutral)T.push("neutral site");
  const w=r.wx;
  if(w&&!w.indoor){if(w.wind>=15)T.push("weather: wind 15+ mph");if(w.precip>=0.1)T.push("weather: rain");if(w.temp!=null&&w.temp<35)T.push("weather: cold (<35°F)");
    if(w.dew>=68)T.push("weather: muggy (dew 68°F+)");if(w.temp>=88)T.push("weather: hot (88°F+)");}
  for(const [side,who] of [[us,"ours"],[them,"theirs"]]){const x=o[side];if(!x)continue;
    if(x.qb||(x.groups&&x.groups.QB))T.push(`out: QB (${who})`);
    if(x.groups&&x.groups.OL)T.push(`out: OL (${who})`);
    if(x.groups&&x.groups.DB)T.push(`out: DB (${who})`);
    if(x.n>=3)T.push(`out: 3+ players (${who})`);}
  if(r.conf&&!(o.home||o.away)&&r.outsChecked)T.push("out: no report found");
  const k=r.kick&&etParts(new Date(Date.parse(r.kick)-5*36e5)).wd;if(k&&k!=="Sat")T.push(`weeknight (${k})`);
  return T;
}
const splits=r=>{const x=sideOf(r),L=Math.abs(r.lm);return [x.home?"we're home":"we're the visitor",x.dog?"underdog":"favorite",
  L<7?"line under 7":L<14?"line 7-13.5":"line 14+",r.conf?"conference game":"non-conference"];};
const edgeB=e=>e<2?"0-2":e<4?"2-4":e<6?"4-6":e<8?"6-8":"8+";

// ---------- stats ----------
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
function st(R,k=""){
  const g=R.filter(r=>r[k+"res"]),w=g.filter(r=>r[k+"res"]==="W").length,l=g.filter(r=>r[k+"res"]==="L").length,p=g.length-w-l;
  const u=g.reduce((a,r)=>a+(r[k+"units"]||0),0),c=g.map(r=>r[k+"clv"]).filter(v=>v!=null);
  const se=c.length>1?Math.sqrt(c.reduce((a,v)=>a+(v-mean(c))**2,0)/(c.length-1)/c.length):null;
  return {n:g.length,w,l,p,u,rec:`${w}-${l}${p?"-"+p:""}`,pct:w+l?(100*w/(w+l)).toFixed(1)+"%":"-",
    nc:c.length,beat:c.length?`${Math.round(100*c.filter(v=>v>0).length/c.length)}%`:"-",
    beatN:`${c.filter(v=>v>0).length}/${c.length}`,clv:c.length?mean(c):null,
    clvTxt:c.length?`${mean(c)>=0?"+":""}${mean(c).toFixed(2)}${se!=null?` ± ${se.toFixed(2)}`:""}`:"-"};
}
const U=u=>`${u>=0?"+":""}${u.toFixed(2)}u`;
const row=(label,R,k="")=>{const x=st(R,k);return `| ${label} | ${x.n} | ${x.rec} | ${x.pct} | ${U(x.u)} | ${x.beat} (${x.beatN}) | ${x.clvTxt} |`;};
const HEAD="| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |\n|---|---|---|---|---|---|---|";

(async()=>{
  const due=MODE==="review"||(ET.wd==="Mon"&&ET.h>=REVIEW_HOUR)||ET.wd==="Tue";
  if(!due){log("review: not due");return;}
  const L=load(),added=merge(L),sentF=path.join(DIR,"scorecards.json"),sent=readJSON(sentF,{});
  log(`review: ${L.picks.length} logged picks (${added} new from the bot's state)`);
  if(!L.picks.length){log("review: nothing logged yet");return;}

  // ---------- grade everything that has finished ----------
  const games=await D.games(S,S),G=new Map(games.map(g=>[g.id,g])),teams=await D.teams(S,S);
  const byAbbr={};for(const [name,t] of Object.entries(teams))byAbbr[t.abbr]=name;
  const needStatic=L.picks.some(r=>!r.f);
  const ctx={games,teams,venues:needStatic?await D.venues():null};
  for(const r of L.picks)if(!r.gid){const h=byAbbr[r.home]||r.home,a=byAbbr[r.away]||r.away;
    const g=games.find(x=>x.wk===r.wk&&x.home===h&&x.away===a);if(g){r.gid=g.id;if(r.key.startsWith("first|seed"))r.key=`first|${g.id}`;}}
  const lost=L.picks.filter(r=>!r.gid);
  if(lost.length)log(`review: ${lost.length} picks not matched to a game: ${lost.slice(0,8).map(r=>`wk${r.wk} ${r.away}@${r.home}`).join(", ")}`);
  const todo=L.picks.filter(r=>!r.graded&&r.gid&&G.get(r.gid)?.done);
  for(const wk of [...new Set(todo.map(r=>r.wk))].sort((a,b)=>a-b)){
    // the cached /lines copy only counts as the close if it was fetched after the week's last kickoff
    const last=Math.max(...games.filter(g=>g.wk===wk).map(g=>g.start));
    const close=await D.lines(S,S,wk,Math.max(0.5,(Date.now()-last)/36e5-0.5));
    for(const r of todo.filter(r=>r.wk===wk)){const g=G.get(r.gid);fillStatic(r,g,ctx);grade(r,g,D.consensus(close[g.id]));}
  }
  for(const r of L.picks)if(r.gid&&G.get(r.gid))fillStatic(r,G.get(r.gid),ctx);
  L.picks.sort((a,b)=>a.wk-b.wk||String(a.kick).localeCompare(String(b.kick))||a.key.localeCompare(b.key));
  fs.writeFileSync(path.join(DIR,"picks.json"),JSON.stringify(L,null,1)+"\n");

  // ---------- the week to review: the latest week with picks whose FBS games are all final ----------
  const wks=[...new Set(L.picks.map(r=>r.wk))].sort((a,b)=>a-b);
  const W=wks.filter(w=>games.filter(g=>g.wk===w&&g.homeFBS&&g.awayFBS).every(g=>g.done)).pop();
  if(W==null){log("review: no finished week yet");return;}
  if(sent[W]&&!FORCE&&MODE!=="review"){log(`review: week ${W} scorecard already sent ${sent[W]}`);return;}

  // ---------- tables ----------
  const P=L.picks.filter(r=>r.res||r.tres);
  const first=P.filter(r=>r.card==="first"),bets=first.filter(r=>r.spick),wkBets=bets.filter(r=>r.wk===W);
  // one view per game: the first-look pick (the one to bet), with availability/weather from the game's latest send
  const latest={};for(const r of L.picks)if(r.gid&&(!latest[r.gid]||r.sentAt>latest[r.gid].sentAt))latest[r.gid]=r;
  const view=first.map(r=>{const z=latest[r.gid]||r;const v={...r,outs:z.outs||r.outs,wx:z.wx||r.wx,outsChecked:!!(z.outs||z.card!=="first")};v.tags=tags(v);return v;});
  const vBets=view.filter(r=>r.spick);
  const tagRows=(R)=>{const all=[...new Set(R.flatMap(r=>r.tags))].sort((a,b)=>fam(a).localeCompare(fam(b))||a.localeCompare(b));
    const out=[row("**no tags (baseline)**",R.filter(r=>!r.tags.length))],rare=[];
    for(const t of all){const x=R.filter(r=>r.tags.includes(t));if(st(x).n>=MIN_TAG)out.push(row(t,x));else rare.push(`${t} (${st(x).rec})`);}
    return out.join("\n")+(rare.length?`\n\nRare tags (under ${MIN_TAG} graded): ${rare.join("; ")}.`:"");};
  const cards=["first","update","final","gameday"];
  const vers=[...new Set(P.map(r=>r.ver||"?"))];
  // later cards' ✅ rows (update/final/gameday), only once there are any
  const later=f=>cards.slice(1).map(c=>{const R=P.filter(r=>f(r)&&r.card===c&&r.spick);return R.length?row(`${c} card ✅`,R)+"\n":"";}).join("");
  const totalsLeans=first.filter(r=>r.tres&&r.te>=4);

  let md=`# CFB Lines: weekly review (${S}, updated ${ET.date})\n\n`+
    `Every pick the bot sent, graded by \`cfb-lines/review.js\`. Ledger: \`cfb/picks.json\`. Lessons so far: \`cfb-lines/LEARNINGS.md\` on main.\n\n`+
    `- **Bet** = a first-look ✅ spread (the backtest edge is against the opener). **Lean** = our side of every priced game in a card.\n`+
    `- Units assume -110 (CFBD has no prices). Breakeven 52.4%.\n`+
    `- **CLV** = points the closing consensus line moved toward our side (positive = beat the close). It's the early signal: about 50 bets show whether there's an edge, W-L needs hundreds.\n\n`+
    `## Week ${W}\n\n${HEAD}\n${row("bets (first-look ✅ spreads)",wkBets)}\n${row("all first-look leans",first.filter(r=>r.wk===W))}\n`+
    later(r=>r.wk===W)+`\n`+
    `## Season to date\n\n${HEAD}\n${row("**bets (first-look ✅ spreads)**",bets)}\n${row("all first-look leans",first)}\n`+
    later(()=>true)+
    row("totals leans, edge 4+ (no ✅: totals are off)",totalsLeans,"t")+"\n\n"+
    `### By model version\n\n${HEAD}\n`+vers.map(v=>[row(`${v} bets`,bets.filter(r=>(r.ver||"?")===v)),row(`${v} first-look leans`,first.filter(r=>(r.ver||"?")===v))].join("\n")).join("\n")+"\n\n"+
    `### First-look leans by edge size\n\nThe backtest's best sign: the line moving our way should grow with the edge.\n\n${HEAD}\n`+
    ["0-2","2-4","4-6","6-8","8+"].map(b=>row(`edge ${b}`,first.filter(r=>edgeB(r.se)===b))).join("\n")+"\n\n"+
    `### Bets by tag (angle tags, first-look ✅ spreads)\n\nTags are informational: an angle only goes into the model if it beats an out-of-sample backtest (LEARNINGS.md). `+
    `Compare each row with the no-tags baseline; a CLV gap smaller than about 2 standard errors is noise.\n\n${HEAD}\n${tagRows(vBets)}\n\n`+
    `### All first-look leans by tag (bigger sample)\n\n${HEAD}\n${tagRows(view)}\n\n`+
    `### Bets by situation\n\n${HEAD}\n`+["we're home","we're the visitor","favorite","underdog","line under 7","line 7-13.5","line 14+","conference game","non-conference"]
      .map(s=>row(s,vBets.filter(r=>splits(r).includes(s)))).join("\n")+"\n\n"+
    `### By week (bets)\n\n| week | W-L-P | units | beat the close | avg CLV | leans beat the close |\n|---|---|---|---|---|---|\n`+
    wks.filter(w=>P.some(r=>r.wk===w)).map(w=>{const x=st(bets.filter(r=>r.wk===w)),y=st(first.filter(r=>r.wk===w));
      return `| ${w} | ${x.rec} | ${U(x.u)} | ${x.beat} | ${x.clvTxt} | ${y.beat} |`;}).join("\n")+"\n";
  const wkLines=view.filter(r=>r.wk===W&&r.spick).sort((a,b)=>b.se-a.se).map(r=>{const x=sideOf(r),team=x.home?r.home:r.away,line=x.home?r.lm:-r.lm;
    return `- ${r.res} ${r.away} @ ${r.home}: ${team} ${line>0?"-":"+"}${Math.abs(line)} (edge ${r.se}), final ${r.away} ${(r.tot-r.hm)/2}-${(r.tot+r.hm)/2} ${r.home}`+
      `${r.clv!=null?`, CLV ${r.clv>=0?"+":""}${r.clv}`:""}${r.tags.length?` [${r.tags.join(", ")}]`:""}`;});
  md+=`\n## Week ${W} bets\n\n${wkLines.join("\n")||"None."}\n`;
  if(L.picks.some(r=>r.seeded))md+=`\nWeeks with "seeded" picks were rebuilt from run logs (our number rounded to 0.5, no availability or kickoff-weather fields).\n`;
  fs.writeFileSync(path.join(DIR,"SUMMARY.md"),md);

  // ---------- phone scorecard ----------
  const a=st(wkBets),b=st(bets),c=st(first),base=st(vBets.filter(r=>!r.tags.length));
  const tagged=[...new Set(view.flatMap(r=>r.tags))].map(t=>({t,x:st(view.filter(r=>r.tags.includes(t)))})).filter(z=>z.x.nc>=15&&z.x.clv!=null)
    .sort((p,q)=>q.x.clv-p.x.clv);
  const laterTxt=cards.slice(1).map(k=>{const x=st(P.filter(r=>r.card===k&&r.spick));return x.n?`${k} ${x.rec}`:null;}).filter(Boolean);
  const msg=[`Week ${W} bets (first-look ✅): ${a.rec}, ${U(a.u)}, beat close ${a.beatN}, avg CLV ${a.clvTxt}`,
    `Season bets: ${b.rec} (${b.pct}), ${U(b.u)}, beat close ${b.beat}, avg CLV ${b.clvTxt}`,
    `All first-look leans: beat close ${c.beat} of ${c.nc}, avg CLV ${c.clvTxt}`,
    `No-tags bets: ${base.rec}, beat close ${base.beat}`,
    laterTxt.length?`Later-card ✅: ${laterTxt.join(" · ")}`:"",
    tagged.length?`\nTags by lean CLV (15+ leans):\n${[...tagged.slice(0,3),...(tagged.length>3?tagged.slice(-2):[])].map(z=>`  ${z.t}: ${z.x.clvTxt} (${z.x.nc})`).join("\n")}`:"",
    `\nModel ${M.MODEL_VERSION}. ${b.nc<50?`Only ${b.nc} graded bets: CLV needs ~50, W-L hundreds. Don't change settings on this.`:"Read SUMMARY.md before changing anything."}`]
    .filter(Boolean).join("\n");
  const title=`CFB week ${W} review: ${a.rec} · season ${b.rec} (${b.pct})`;
  fs.writeFileSync(path.join(DIR,"reports",`week-${W}.md`),`# ${title}\n\n\`\`\`\n${msg}\n\`\`\`\n`);
  summary(`## ${title}\n\n\`\`\`\n${msg}\n\`\`\`\n\n${md}`);log(title+"\n"+msg);
  const url=process.env.GITHUB_SERVER_URL?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/blob/bot-results/cfb/SUMMARY.md`:"";
  if(sent[W]&&!FORCE)log(`week ${W} scorecard already sent ${sent[W]} (FORCE_SEND=1 resends)`);
  else{const ok=await ntfy(title,msg,3,["football","bar_chart"],url);
    if(LIVE&&ok){sent[W]=new Date().toISOString();fs.writeFileSync(sentF,JSON.stringify(sent,null,1)+"\n");}}
  if(!LIVE)log("(dry run or no topic: nothing sent)");
  log(`CFBD calls this month: ${cfbd.usage().calls}/${cfbd.BUDGET}`);
})().catch(e=>{console.error(e);process.exit(1);});
