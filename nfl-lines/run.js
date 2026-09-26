// NFL Lines: one game-day alert per kickoff slot (~90 min out) with the current spread, total and
// moneyline next to the model's numbers, after inactives and the latest weather.
// MODE=auto  -> (cron) sends each slot once when it is GD_MIN-GD_MAX minutes from kickoff.
// MODE=slate -> force the next slot now (for testing; pair with dry_run).
// Shares nfl-props' helpers; state goes to NP_CACHE (the workflow points it at nfl-lines/.cache).
const {env,envs,log,etParts,etToUtc,etClock,readState,writeState,ntfy,summary,getRaw,LIVE,DRY}=require("../nfl-props/lib");
const data=require("../nfl-props/data"),W=require("../nfl-props/weather"),odds=require("../nfl-props/odds"),M=require("./model");

const MODE=envs("MODE","auto");
const CFG={
  GD_MIN:env("GD_MIN",75),GD_MAX:env("GD_MAX",110),
  MIN_SPREAD:env("MIN_SPREAD",3),         // model vs line, points
  MIN_ML:env("MIN_ML",0.06),              // model win % minus the market's no-vig %
  MIN_TOTAL:env("MIN_TOTAL",4),
  TOTAL_EDGES:env("TOTAL_EDGES",0),       // off: totals lost badly in the 2023-25 backtests (see README)
  LINES:envs("LINES","espn"),
  MIN_WEEK:env("MIN_WEEK",4),             // no ✅ before this week: ratings from 1-3 games swing wildly             // espn (free, DraftKings) | odds (Odds API consensus, 3 credits/slot)
};
const RUN_URL=process.env.GITHUB_RUN_ID?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:"";
const ESPN_TEAM={LAR:"LA",WSH:"WAS"};
const sgn=v=>v>0?"+"+v:String(v);
const fav=(g,m)=>m===0?"PK":m>0?`${g.home_team} -${Math.abs(m)}`:`${g.away_team} -${Math.abs(m)}`;   // m = home margin
const r1=v=>Math.round(v*2)/2;

// ---------- current lines ----------
async function espnLines(S,week,postseason){
  // ESPN answers 403 to a browser-looking User-Agent from a script, so send none
  const r=await getRaw(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=${postseason?3:2}&week=${postseason?week-18:week}&dates=${S}`,{headers:{}});
  const j=r?await r.json().catch(()=>null):null;
  const out={};if(!j)return out;
  for(const e of j.events||[]){const c=e.competitions&&e.competitions[0];if(!c)continue;
    const t={};for(const x of c.competitors||[])t[x.homeAway]=ESPN_TEAM[x.team.abbreviation]||x.team.abbreviation;
    const o=(c.odds||[])[0];if(!o)continue;
    const ml=s=>{const v=o.moneyline&&o.moneyline[s]&&(o.moneyline[s].close||o.moneyline[s].open);return v&&v.odds&&v.odds!=="EVEN"?+v.odds:v&&v.odds==="EVEN"?100:null;};
    out[`${t.away}@${t.home}`]={spread:o.spread!=null?-o.spread:null,total:o.overUnder??null,homeML:ml("home"),awayML:ml("away"),src:(o.provider&&o.provider.name)||"ESPN"};}
  return out;
}
async function currentLines(S,week,games){
  let L={};
  if(CFG.LINES==="odds"&&odds.enabled())L=await odds.gameLines()||{};
  const missing=()=>games.some(g=>!L[`${g.away_team}@${g.home_team}`]);
  if(missing()){const e=await espnLines(S,week,week>18);for(const k in e)if(!L[k])L[k]=e[k];}
  if(missing()&&CFG.LINES!=="odds"&&odds.enabled()){const o=await odds.gameLines()||{};for(const k in o)if(!L[k])L[k]=o[k];}
  for(const g of games){const k=`${g.away_team}@${g.home_team}`;   // last resort: nflverse's (daily) lines
    if(!L[k]&&g.spread_line!=="")L[k]={spread:+g.spread_line,total:g.total_line===""?null:+g.total_line,
      homeML:g.home_moneyline===""?null:+g.home_moneyline,awayML:g.away_moneyline===""?null:+g.away_moneyline,src:"nflverse (daily)"};}
  return L;
}

// ---------- starting QB availability ----------
function qbStatus(sched,S,week,g,team,sl,inj){
  const prev=sched.filter(x=>x.season===S&&x.week<week&&x.result!==""&&(x.home_team===team||x.away_team===team)).slice(-3)
    .map(x=>x.home_team===team?[x.home_qb_id,x.home_qb_name]:[x.away_qb_id,x.away_qb_name]);
  const c={};for(const [id,nm] of prev)if(id)c[id]=(c[id]||{n:0,nm}),c[id].n++;
  const top=Object.entries(c).sort((a,b)=>b[1].n-a[1].n)[0];if(!top)return {status:"",note:""};
  const [id,{nm}]=top,s=sl[id],ri=inj.get(id)||"",si=s?s[1]:"";
  const listed=g.home_team===team?g.home_qb_id:g.away_qb_id,listedNm=g.home_team===team?g.home_qb_name:g.away_qb_name;
  if((s&&s[0]&&s[0]!==team)||["Out","IR","PUP","Sus"].includes(si)||ri==="Out")return {status:"out",note:`${team} QB ${nm} out`};
  if(si==="Doubtful"||ri==="Doubtful")return {status:"doubtful",note:`${team} QB ${nm} doubtful`};
  if(si==="Questionable"||ri==="Questionable")return {status:"",note:`${team} QB ${nm} questionable`};
  // nflverse's listed starter is sometimes stale, so it's a heads-up only, not a rating penalty
  if(listed&&listed!==id)return {status:"",note:`${team}: nflverse lists ${listedNm} as starter (usual: ${nm})`};
  return {status:"",note:""};
}

// ---------- one game ----------
function gameBlock(g,P,L,notes){
  const k=`${g.away_team} @ ${g.home_team}`,lines=[],edges=[],flag=g.week>=CFG.MIN_WEEK;
  if(!L||L.spread==null){lines.push(`${k}: no line yet. Model ${fav(g,r1(P.margin))}, total ${r1(P.total)}`);return {text:lines.join("\n"),edges,k};}
  const sp=M.spreadPick(P,L.spread);
  const spSide=sp.side==="home"?`${g.home_team} ${sgn(-L.spread)}`:`${g.away_team} ${sgn(L.spread)}`;
  const spEdge=flag&&sp.cushion>=CFG.MIN_SPREAD;if(spEdge)edges.push("spread");
  lines.push(`${k}: line ${fav(g,L.spread)}, model ${fav(g,r1(P.margin))}${spEdge?` → ${spSide} (${Math.round(sp.prob*100)}%) ✅`:""}`);
  const mp=M.mlPick(P,L.homeML,L.awayML);
  if(mp){const team=mp.side==="home"?g.home_team:g.away_team,ok=flag&&mp.edge>=CFG.MIN_ML;if(ok)edges.push("ml");
    lines.push(`  ML: ${g.away_team} ${sgn(L.awayML)} / ${g.home_team} ${sgn(L.homeML)}, model ${team} ${Math.round(mp.model*100)}% vs market ${Math.round(mp.market*100)}%${ok?` → ${team} ${sgn(mp.price)} ✅`:""}`);}
  if(L.total!=null){const tp=M.totalPick(P,L.total),ok=flag&&CFG.TOTAL_EDGES&&tp.cushion>=CFG.MIN_TOTAL;if(ok)edges.push("total");
    lines.push(`  Total ${L.total}, model ${r1(P.total)}${ok?` → ${tp.side.toUpperCase()} (${Math.round(tp.prob*100)}%) ✅`:""}`);}
  if(notes.length)lines.push(`  ${notes.join("; ")}`);
  return {text:lines.join("\n"),edges,k};
}

(async()=>{
  const now=Date.now(),et=etParts(new Date(now));
  const S=+et.date.slice(0,4)-(+et.date.slice(5,7)<3?1:0);
  const cachedSched=async h=>{const hit=readState(`sched-${S}.json`,h);if(hit)return hit;
    const s=(await data.schedule([S-1,S])).map(x=>({...x,kick:etToUtc(x.gameday,x.gametime).getTime()}));return writeState(`sched-${S}.json`,s);};
  let sched=await cachedSched(6);
  if(sched.some(g=>g.season===S&&g.result===""&&g.kick>now&&g.kick-now<3*36e5))sched=await cachedSched(1);
  const upcoming=sched.filter(g=>g.season===S&&g.result===""&&g.kick>now).sort((a,b)=>a.kick-b.kick);
  if(!upcoming.length){log(`${et.date}: no upcoming ${S} games`);return;}
  const sent=readState(`sent-${S}.json`)||{};
  // a slot = every game sharing one kickoff time
  let kick=null;
  if(MODE==="auto"){const due=upcoming.find(g=>{const m=(g.kick-now)/6e4;return m>=CFG.GD_MIN&&m<=CFG.GD_MAX&&!sent[g.kick];});kick=due&&due.kick;}
  else if(MODE==="slate")kick=upcoming[0].kick;
  else throw new Error(`Unknown MODE "${MODE}" (auto, slate)`);
  log(`${et.wd} ${et.date} ${et.h}:${String(et.m).padStart(2,"0")} ET, mode=${MODE}${DRY?" (dry run)":""}: slot=${kick?new Date(kick).toISOString():"-"}`);
  if(!kick)return;

  const games=upcoming.filter(g=>g.kick===kick),week=games[0].week;
  const R=M.ratings(sched,S,week);
  const [L,sl,inj]=await Promise.all([currentLines(S,week,games),data.sleeper(1),data.injuryReport(S,week)]);
  const blocks=[];
  for(const g of games){
    const hq=qbStatus(sched,S,week,g,g.home_team,sl,inj),aq=qbStatus(sched,S,week,g,g.away_team,sl,inj);
    const wx=await W.kickoffWeather(g,new Date(g.kick));
    const P=M.predict(R,g,{homeQB:hq.status,awayQB:aq.status,wx});
    const notes=[hq.note,aq.note].filter(Boolean);
    if(wx&&!wx.indoor&&(wx.wind>=M.C.WIND_MPH||wx.precip>=M.C.PRECIP_IN))notes.push(W.wxText(wx));
    blocks.push(gameBlock(g,P,L[`${g.away_team}@${g.home_team}`],notes));
  }
  blocks.sort((a,b)=>b.edges.length-a.edges.length);
  const nEdges=blocks.reduce((a,b)=>a+b.edges.length,0),src=[...new Set(Object.values(L).map(x=>x.src))].join(", ");
  const title=`${etParts(new Date(kick)).wd} ${etClock(new Date(kick))} ET lines: ${nEdges} edge${nEdges===1?"":"s"} (${games.length} game${games.length>1?"s":""})`;
  const early=week<CFG.MIN_WEEK?`Week ${week}: numbers only, no edges flagged until week ${CFG.MIN_WEEK}.\n\n`:"";
  const msg=early+blocks.map(b=>b.text).join("\n\n")+`\n\nLines: ${src||"none"}. Model = nfl-edge-finder port; not proven to beat closing lines (see README).`;
  summary(`## ${title}\n\n\`\`\`\n${msg}\n\`\`\`\n`);
  const ok=await ntfy(title,msg,nEdges?4:3,["football","moneybag"],RUN_URL);
  if(LIVE&&ok&&MODE==="auto"){sent[kick]=true;writeState(`sent-${S}.json`,sent);}
  if(odds.enabled()){const u=odds.usage();log(`Odds API credits: used ${u.used} this month, ${u.remaining??"?"} remaining`);}
})().catch(async e=>{
  console.error(e);
  const last=readState("error-alert.json",6);
  if(!last&&LIVE){await ntfy("NFL lines bot error",String(e.message||e),2,["warning"]).catch(()=>{});writeState("error-alert.json",true);}
  process.exit(1);
});
