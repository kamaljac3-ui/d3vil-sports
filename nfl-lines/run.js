// NFL Lines: one game-day alert per kickoff slot (~90 min out) with the current spread, total and
// moneyline next to the model's numbers, after inactives and the latest weather.
// MODE=auto  -> (cron) sends each slot once when it is GD_MIN-GD_MAX minutes from kickoff.
// MODE=slate -> force the next slot now (for testing; pair with dry_run).
// Shares nfl-props' helpers; state goes to NP_CACHE (the workflow points it at nfl-lines/.cache).
const {env,envs,log,etParts,etToUtc,etClock,readState,writeState,ntfy,summary,getRaw,LIVE,DRY}=require("../nfl-props/lib");
const data=require("../nfl-props/data"),W=require("../nfl-props/weather"),odds=require("../nfl-props/odds"),M=require("./model");
const SH=require("../nfl-props/sharp");
const {lateSeasonTag,loadCB,cbTags}=require("./tags");

const MODE=envs("MODE","auto");
const CFG={
  GD_MIN:env("GD_MIN",75),GD_MAX:env("GD_MAX",110),
  MIN_SPREAD:env("MIN_SPREAD",3),         // model vs line, points
  MIN_ML:env("MIN_ML",0.06),              // model win % minus the market's no-vig %
  MIN_TOTAL:env("MIN_TOTAL",4),
  TOTAL_EDGES:env("TOTAL_EDGES",0),       // off: totals lost badly in the 2023-25 backtests (see README)
  LINES:envs("LINES","auto"),             // auto = Odds API consensus when ODDS_API_KEY is set, else ESPN | espn | odds
  MIN_WEEK:env("MIN_WEEK",4),             // no ✅ before this week: ratings from 1-3 games swing wildly
  // stale lines (needs ODDS_API_KEY): your books vs the sharp book's no-vig price
  MIN_EV:env("MIN_EV_LINES",0.02),        // flag offers worth at least +2% expected value
  STALE_GAP:env("STALE_GAP",2.5),         // max points between your book's number and the sharp number
  SIGMA_SPREAD:env("SIGMA_SPREAD",13.5),SIGMA_TOTAL:env("SIGMA_TOTAL",13),
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
// Returns {L: display lines per game, OD: per-book Odds API offers per game (null without a key)}.
async function currentLines(S,week,games){
  let L={};const OD=odds.enabled()?await odds.gameLines():null;   // one call: consensus + every book's prices
  if(CFG.LINES!=="espn"&&OD)L={...OD};   // live multi-book consensus beats ESPN's single (sometimes lagging) number
  const missing=()=>games.some(g=>!L[`${g.away_team}@${g.home_team}`]);
  if(missing()){const e=await espnLines(S,week,week>18);for(const k in e)if(!L[k])L[k]=e[k];}
  if(missing()&&OD)for(const k in OD)if(!L[k])L[k]=OD[k];
  for(const g of games){const k=`${g.away_team}@${g.home_team}`;   // last resort: nflverse's (daily) lines
    if(!L[k]&&g.spread_line!=="")L[k]={spread:+g.spread_line,total:g.total_line===""?null:+g.total_line,
      homeML:g.home_moneyline===""?null:+g.home_moneyline,awayML:g.away_moneyline===""?null:+g.away_moneyline,src:"nflverse (daily)"};}
  return {L,OD};
}

// ---------- stale lines: your books vs the sharp book ----------
function staleLines(g,od){
  if(!od||!od.offers)return {text:[],picks:[],sharp:null};
  const o=od.offers,opt=(sigma)=>({sigma,maxGap:CFG.STALE_GAP,minEV:CFG.MIN_EV});
  const sp=SH.bestPerSide(SH.staleTwoWay(o.spreads,opt(CFG.SIGMA_SPREAD))).slice(0,2);
  const to=SH.bestPerSide(SH.staleTwoWay(o.totals,opt(CFG.SIGMA_TOTAL))).slice(0,2);
  const ml=SH.bestPerSide(SH.staleMoneyline(o.h2h,{minEV:CFG.MIN_EV})).slice(0,1);
  const pct=v=>(v*100).toFixed(1)+"%";
  const txt=(x,label,sharpLabel)=>`  💰 ${x.title} ${label} (${SH.fmt(x.price)}): fair ${pct(x.fair)}, +${pct(x.ev)} EV vs ${x.sharp.title} ${sharpLabel}`;
  const text=[],picks=[];
  for(const x of sp){const s=x.sharp,sa=x.team===g.home_team?s.A:s.B;
    text.push(txt(x,`${x.team} ${SH.fmt(x.point)}`,`${sa.team} ${SH.fmt(sa.point)} ${SH.fmt(sa.price)}`));
    picks.push({market:"spread",team:x.team,point:x.point,book:x.key,price:x.price,fair:x.fair,ev:x.ev,sharp:`${s.key} ${sa.point} ${sa.price}`});}
  for(const x of to){const s=x.sharp,side=x.side==="A"?"Over":"Under",ss=x.side==="A"?s.A:s.B;
    text.push(txt(x,`${side} ${x.L}`,`${side} ${ss.L} ${SH.fmt(ss.price)}`));
    picks.push({market:"total",side,point:x.L,book:x.key,price:x.price,fair:x.fair,ev:x.ev,sharp:`${s.key} ${ss.L} ${ss.price}`});}
  for(const x of ml){const s=x.sharp,ss=x.side==="A"?s.A:s.B;
    text.push(txt(x,`${x.team} ML`,`${ss.team} ${SH.fmt(ss.price)}`));
    picks.push({market:"ml",team:x.team,book:x.key,price:x.price,fair:x.fair,ev:x.ev,sharp:`${s.key} ${ss.price}`});}
  // the sharp book's own spread, for reference
  const sk=SH.SHARP.find(k=>o.spreads.some(y=>y.key===k)),ps=o.spreads.find(x=>x.key===sk&&x.side==="A");
  // show it favorite-first like the main line: home point -7.5 -> "BUF -7.5", home point +9.5 -> "SEA -9.5"
  const sharpTxt=ps?(ps.point===0?`${ps.title} PK`:ps.point<0?`${ps.title} ${g.home_team} ${ps.point}`:`${ps.title} ${g.away_team} -${ps.point}`):null;
  return {text,picks,sharp:sharpTxt};
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
function gameBlock(g,P,L,notes,stale){
  const k=`${g.away_team} @ ${g.home_team}`,lines=[],edges=[],flag=g.week>=CFG.MIN_WEEK;
  if(!L||L.spread==null){lines.push(`${k}: no line yet. Model ${fav(g,r1(P.margin))}, total ${r1(P.total)}`);return {text:lines.join("\n"),edges,k,stale:0};}
  const sp=M.spreadPick(P,L.spread);
  const spSide=sp.side==="home"?`${g.home_team} ${sgn(-L.spread)}`:`${g.away_team} ${sgn(L.spread)}`;
  const spEdge=flag&&sp.cushion>=CFG.MIN_SPREAD;if(spEdge)edges.push("spread");
  lines.push(`${k}: line ${fav(g,L.spread)}${stale&&stale.sharp?` (${stale.sharp})`:""}, model ${fav(g,r1(P.margin))}${spEdge?` → ${spSide} (${Math.round(sp.prob*100)}%) ✅`:""}`);
  const mp=M.mlPick(P,L.homeML,L.awayML);
  if(mp){const team=mp.side==="home"?g.home_team:g.away_team,ok=flag&&mp.edge>=CFG.MIN_ML;if(ok)edges.push("ml");
    lines.push(`  ML: ${g.away_team} ${sgn(L.awayML)} / ${g.home_team} ${sgn(L.homeML)}, model ${team} ${Math.round(mp.model*100)}% vs market ${Math.round(mp.market*100)}%${ok?` → ${team} ${sgn(mp.price)} ✅`:""}`);}
  if(L.total!=null){const tp=M.totalPick(P,L.total),ok=flag&&CFG.TOTAL_EDGES&&tp.cushion>=CFG.MIN_TOTAL;if(ok)edges.push("total");
    lines.push(`  Total ${L.total}, model ${r1(P.total)}${ok?` → ${tp.side.toUpperCase()} (${Math.round(tp.prob*100)}%) ✅`:""}`);}
  if(stale&&stale.text.length)lines.push(...stale.text);
  if(notes.length)lines.push(`  ${notes.join("; ")}`);
  return {text:lines.join("\n"),edges,k,stale:stale?stale.picks.length:0};
}

(async()=>{
  if(MODE==="test"){   // just prove the ntfy topic reaches the phone (no data, no credits, no state)
    const ok=await ntfy("NFL alerts test","If you can read this, NFL alerts are reaching this ntfy feed.",3,["football","white_check_mark"]);
    log(ok?"test alert sent":"test alert failed");if(!ok)process.exit(1);return;}
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
  const [{L,OD},sl,inj,CB]=await Promise.all([currentLines(S,week,games),data.sleeper(1),data.injuryReport(S,week),loadCB(S)]);
  const blocks=[],picks=[];
  for(const g of games){
    const hq=qbStatus(sched,S,week,g,g.home_team,sl,inj),aq=qbStatus(sched,S,week,g,g.away_team,sl,inj);
    const wx=await W.kickoffWeather(g,new Date(g.kick));
    const P=M.predict(R,g,{homeQB:hq.status,awayQB:aq.status,wx});
    const notes=[hq.note,aq.note,lateSeasonTag(sched,g),...cbTags(CB,g,sl,inj)].filter(Boolean);
    if(wx&&!wx.indoor&&(wx.wind>=M.C.WIND_MPH||wx.precip>=M.C.PRECIP_IN))notes.push(W.wxText(wx));
    const key=`${g.away_team}@${g.home_team}`,st=staleLines(g,OD&&OD[key]);
    blocks.push(gameBlock(g,P,L[key],notes,st));
    for(const p of st.picks)picks.push({kind:"stale",game:g.game_id,...p});
    const b=blocks[blocks.length-1],mp=M.mlPick(P,(L[key]||{}).homeML,(L[key]||{}).awayML);
    if(b.edges.includes("spread"))picks.push({kind:"model",market:"spread",game:g.game_id,line:L[key].spread,model:P.margin,src:L[key].src});
    if(b.edges.includes("ml")&&mp)picks.push({kind:"model",market:"ml",game:g.game_id,team:mp.side==="home"?g.home_team:g.away_team,price:mp.price,model:mp.model,marketProb:mp.market,src:L[key].src});
  }
  blocks.sort((a,b)=>(b.edges.length+b.stale)-(a.edges.length+a.stale));
  const nEdges=blocks.reduce((a,b)=>a+b.edges.length,0),nStale=blocks.reduce((a,b)=>a+b.stale,0),src=[...new Set(Object.values(L).map(x=>x.src))].join(", ");
  const title=`${etParts(new Date(kick)).wd} ${etClock(new Date(kick))} ET lines: ${nEdges} edge${nEdges===1?"":"s"}${OD?`, ${nStale} stale`:""} (${games.length} game${games.length>1?"s":""})`;
  const early=week<CFG.MIN_WEEK?`Week ${week}: numbers only, no edges flagged until week ${CFG.MIN_WEEK}.\n\n`:"";
  const msg=early+blocks.map(b=>b.text).join("\n\n")+`\n\nLines: ${src||"none"}. Model = nfl-edge-finder port; not proven to beat closing lines (see README).`;
  summary(`## ${title}\n\n\`\`\`\n${msg}\n\`\`\`\n`);
  const ok=await ntfy(title,msg,nEdges||nStale?4:3,["football","moneybag"],RUN_URL);
  if(LIVE&&ok&&MODE==="auto"){sent[kick]=true;writeState(`sent-${S}.json`,sent);}
  // log what was sent, for grading and closing-line value later (results tracker format: sport + date)
  if(LIVE&&ok&&picks.length){const date=et.date,key=`picks-${date}.json`,at=new Date().toISOString();
    writeState(key,(readState(key)||[]).concat(picks.map(p=>({sport:"nfl",bot:"nfl-lines",date,at,...p}))));}
  if(odds.enabled()){const u=odds.usage();log(`Odds API credits: used ${u.used} this month, ${u.remaining??"?"} remaining`);}
})().catch(async e=>{
  console.error(e);
  const last=readState("error-alert.json",6);
  if(!last&&LIVE){await ntfy("NFL lines bot error",String(e.message||e),2,["warning"]).catch(()=>{});writeState("error-alert.json",true);}
  process.exit(1);
});
