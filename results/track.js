// Results tracker: grades the picks the alert bots actually sent and keeps a running scorecard.
// Picks come from each bot's cache (picks-<date>.json, written only for alerts that were really sent).
// Graded picks live in the ledger (the bot-results branch, checked out at LEDGER_DIR) so they outlive the 7-day Actions cache.
const fs=require("fs"),path=require("path");

const ROOT=path.join(__dirname,"..");
const DRY=process.env.DRY_RUN==="1";
const NTFY_SERVER=(process.env.NTFY_SERVER||"https://ntfy.sh").replace(/\/$/,"");
const NTFY_TOPIC=process.env.NTFY_TOPIC;
const NTFY_TOKEN=process.env.NTFY_TOKEN||"";
const LEDGER=path.resolve(ROOT,process.env.LEDGER_DIR||"ledger");
const PICK_DIRS=(process.env.PICK_DIRS||"launch-angle/.cache,nba-edges/.cache,mlb-live/.cache,nba-news/.cache").split(",").map(d=>path.resolve(ROOT,d.trim()));
const RECENT_DAYS=+(process.env.RECENT_DAYS||7);
const GIVE_UP_DAYS=+(process.env.GIVE_UP_DAYS||3);   // void a pick whose game still isn't final after this long
const SMALL=+(process.env.SMALL_SAMPLE||100);
const LG_HR_PA=0.03,PRIOR_PA=100;                   // shrink each hitter's HR rate toward league average

const etDate=(d=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(d);
const TODAY=process.env.DATE||etDate();
const WEEKDAY=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short"}).format(new Date(TODAY+"T12:00:00Z"));
const SEND_SUMMARY=process.env.SEND_SUMMARY==="1"||(process.env.SEND_SUMMARY!=="0"&&WEEKDAY==="Mon");
const log=(...a)=>console.log("[results]",...a);
const sleep=ms=>new Promise(s=>setTimeout(s,ms));
const addDays=(d,n)=>{const x=new Date(d+"T12:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const daysSince=d=>Math.round((new Date(TODAY+"T12:00:00Z")-new Date(d+"T12:00:00Z"))/864e5);
const nk=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g,"").replace(/[^a-z]/g,"");
async function get(url){
  for(let a=0;a<3;a++){try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(r.ok)return r.json();log("HTTP",r.status,url.slice(0,90));if(r.status===404)return null;}
    catch(e){log("fetch error",e.message);}await sleep(2000*(a+1));}
  return null;
}

// ---------- ledger ----------
const SPORTS=["mlb","nba"];
// live (mlb-live) picks are hitter vs one reliever, so the same hitter can have several in a game
const ID={mlb:p=>`${p.date}|${p.gamePk}|${p.hitterId}`+(p.kind==="live"?`|live|${p.pitcherId}`:""),nba:p=>`${p.date}|${p.gameId}|${p.key}|${p.kind}|${p.stat||""}`};
function loadLedger(){
  const L={};for(const s of SPORTS){try{L[s]=JSON.parse(fs.readFileSync(path.join(LEDGER,`${s}.json`),"utf8"));}catch(e){L[s]=[];}}
  return L;
}
function ingest(L){
  const idx={};for(const s of SPORTS)idx[s]=new Map(L[s].map(r=>[r.id,r]));
  let added=0;
  for(const dir of PICK_DIRS){
    if(!fs.existsSync(dir))continue;
    for(const f of fs.readdirSync(dir).filter(f=>/^picks-\d{4}-\d{2}-\d{2}\.json$/.test(f))){
      let picks=[];try{picks=JSON.parse(fs.readFileSync(path.join(dir,f),"utf8")).v||[];}catch(e){log("unreadable",f);continue;}
      for(const p of picks){
        if(!SPORTS.includes(p.sport))continue;
        const id=ID[p.sport](p),have=idx[p.sport].get(id);
        // a later run can add the closing line to a pick already in the ledger
        if(have){if(!have.modes.includes(p.mode))have.modes.push(p.mode);if(p.close!=null&&have.close==null){have.close=p.close;have.closeAt=p.closeAt;}continue;}
        const {mode,...rest}=p,rec={id,...rest,modes:[mode],result:null};
        L[p.sport].push(rec);idx[p.sport].set(id,rec);added++;
      }
    }
  }
  log(`ingested ${added} new picks`);
}

// ---------- MLB grading ----------
const feeds=new Map();
const mlbFeed=pk=>{if(!feeds.has(pk))feeds.set(pk,get(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`));return feeds.get(pk);};
async function hrRateBefore(id,date){
  const j=await get(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=byDateRange&group=hitting&startDate=${date.slice(0,4)}-01-01&endDate=${addDays(date,-1)}`);
  const s=j&&j.stats&&j.stats[0]&&j.stats[0].splits&&j.stats[0].splits[0]?j.stats[0].splits[0].stat:{};
  return ((s.homeRuns||0)+LG_HR_PA*PRIOR_PA)/((s.plateAppearances||0)+PRIOR_PA);
}
async function gradeMlb(r){
  const f=await mlbFeed(r.gamePk);if(!f)return null;
  const st=f.gameData.status;
  if(/postponed|cancel|suspended/i.test(st.detailedState))return {status:"void",why:st.detailedState};
  if(st.abstractGameState!=="Final")return null;
  const bx=f.liveData.boxscore.teams,pid="ID"+r.hitterId;
  const side=bx.home.players[pid]?"home":bx.away.players[pid]?"away":null;
  const bat=side&&bx[side].players[pid].stats.batting;
  if(!bat||!bat.plateAppearances)return {status:"void",why:"did not bat"};
  const opp=side==="home"?"away":"home",starter=String(bx[opp].pitchers[0]||"");
  let paVsSP=0,hrVsSP=0,bbe=0,inWin=0;
  for(const p of f.liveData.plays.allPlays){
    if(String(p.matchup.batter.id)!==String(r.hitterId))continue;
    const vs=String(p.matchup.pitcher.id)===String(r.pitcherId),hr=p.result.eventType==="home_run";
    if(vs){paVsSP++;if(hr)hrVsSP++;}
    const hit=p.playEvents.filter(e=>e.hitData&&e.hitData.launchAngle!=null).pop();
    if(hit){bbe++;const la=hit.hitData.launchAngle;if(la>=25&&la<=35)inWin++;}
  }
  const base=await hrRateBefore(r.hitterId,r.date);
  const pa=bat.plateAppearances;
  return {status:"final",pa,hr:bat.homeRuns||0,paVsSP,hrVsSP,bbe,inWin,starterMatched:starter===String(r.pitcherId),baseHrPA:base,pHR:1-Math.pow(1-base,pa),pHRvs:1-Math.pow(1-base,paVsSP)};
}
// ---------- NBA grading ----------
const sums=new Map();
const nbaSummary=id=>{if(!sums.has(id))sums.set(id,get(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`));return sums.get(id);};
// ESPN's closing spread (home) and total for a game; the same core-API numbers nba-edges/backtest-lines.js uses
async function nbaClose(id){
  const j=await get(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/${id}/competitions/${id}/odds`);
  const x=j&&(j.items||[]).find(i=>i.overUnder!=null||i.spread!=null);if(!x)return {};
  const n=v=>{const f=parseFloat(String(v==null?"":v).replace("+",""));return isFinite(f)?f:null;},h=x.homeTeamOdds||{};
  return {spread:n(h.close&&h.close.pointSpread&&h.close.pointSpread.american)??n(x.spread),total:n(x.close&&x.close.total&&x.close.total.american)??n(x.overUnder)};
}
async function gradeNba(r){
  const s=await nbaSummary(r.gameId);if(!s)return null;
  const comp=s.header.competitions[0],st=comp.status.type;
  if(/postponed|cancel/i.test(st.name))return {status:"void",why:st.description};
  if(!st.completed)return null;
  // game-line picks (nba-edges lines.js): final score, plus the closing line for closing-line value
  if(r.kind==="spread"||r.kind==="total"){
    const sc=h=>+(comp.competitors.find(c=>c.homeAway===h)||{}).score,hs=sc("home"),as=sc("away");
    const c=await nbaClose(r.gameId).catch(()=>({}));
    if(r.kind==="spread"){const m=r.side==="home"?hs-as:as-hs;r.close=c.spread==null?null:(r.side==="home"?c.spread:-c.spread);return {status:"final",hs,as,cover:m+r.line};}
    r.close=c.total;return {status:"final",hs,as,total:hs+as};
  }
  for(const t of s.boxscore.players||[])for(const g of t.statistics||[]){
    const a=(g.athletes||[]).find(x=>nk(x.athlete.displayName)===r.key);if(!a)continue;
    if(a.didNotPlay||!a.stats||!a.stats.length)return {status:"void",why:a.reason||"did not play"};
    const L=g.labels,v=k=>a.stats[L.indexOf(k)];
    const min=parseInt(v("MIN"))||0;if(!min)return {status:"void",why:"0 minutes"};
    const pts=+v("PTS")||0,reb=+v("REB")||0,ast=+v("AST")||0;
    return {status:"final",min,pts,reb,ast,pra:pts+reb+ast,fg3m:parseInt(String(v("3PT")).split("-")[0])||0};
  }
  return {status:"void",why:"not in box score"};
}
async function grade(L){
  const G={mlb:gradeMlb,nba:gradeNba};let n=0,voided=0;
  for(const s of SPORTS)for(const r of L[s]){
    if(r.result||r.date>=TODAY)continue;
    let res=null;try{res=await G[s](r);}catch(e){log("grade error",r.id,e.message);}
    if(!res&&daysSince(r.date)>GIVE_UP_DAYS)res={status:"void",why:"never went final"};
    if(res){r.result={...res,gradedOn:TODAY};n++;if(res.status==="void")voided++;}
  }
  log(`graded ${n} picks (${voided} void)`);
}

// ---------- scorecard ----------
const pct=v=>isFinite(v)?Math.round(v*100)+"%":"–";
const sg=v=>(v>=0?"+":"")+v.toFixed(1);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
const small=n=>n<SMALL?` (small sample: noise until ~${SMALL}+)`:"";
function liveCard(recs){
  const f=recs.filter(r=>r.kind==="live"&&r.result&&r.result.status==="final");if(!f.length)return [];
  const faced=f.filter(r=>r.result.paVsSP>0),hr=faced.filter(r=>r.result.hrVsSP>0).length;
  const exp=faced.reduce((s,r)=>s+r.result.pHRvs,0),v=faced.reduce((s,r)=>s+r.result.pHRvs*(1-r.result.pHRvs),0),z=v?(hr-exp)/Math.sqrt(v):0;
  return [`MLB live (pitching changes): ${f.length} picks, ${faced.length} faced the new pitcher${small(faced.length)}`,
    `- Homered off him in ${hr} vs ${exp.toFixed(1)} expected over ${faced.reduce((s,r)=>s+r.result.paVsSP,0)} PA: ${exp?(hr/exp).toFixed(2)+"x":"–"}, z ${sg(z)}`];
}
function mlbCard(recs){
  const live=liveCard(recs);recs=recs.filter(r=>r.kind!=="live");
  const f=recs.filter(r=>r.result&&r.result.status==="final");if(!f.length)return ["MLB: no graded picks yet.",...live];
  const hrG=f.filter(r=>r.result.hr>0).length,exp=f.reduce((s,r)=>s+r.result.pHR,0),v=f.reduce((s,r)=>s+r.result.pHR*(1-r.result.pHR),0);
  const z=v?(hrG-exp)/Math.sqrt(v):0;
  const bbe=f.reduce((s,r)=>s+r.result.bbe,0),inW=f.reduce((s,r)=>s+r.result.inWin,0),predW=bbe?f.reduce((s,r)=>s+r.win*r.result.bbe,0)/bbe:NaN;
  const sp=f.filter(r=>r.result.starterMatched),hrSP=sp.filter(r=>r.result.hrVsSP>0).length;
  return [
    `MLB: ${f.length} hitter-games${small(f.length)}`,
    `- Homered in ${hrG} (${pct(hrG/f.length)}) vs ${exp.toFixed(1)} expected from their own HR rates: ${exp?(hrG/exp).toFixed(2)+"x":"–"}, z ${sg(z)}`,
    `- Off the flagged starter: HR in ${hrSP} of ${sp.length} games he started`,
    `- Launch window: ${pct(bbe?inW/bbe:NaN)} of ${bbe} batted balls at 25-35 deg vs ${pct(predW)} predicted`,...live];
}
// picks logged before nba-edges started tagging a model version
const modelOf=r=>r.model||(r.modes&&r.modes.includes("news")?"nba-news":"pre-2026-10-24");
function nbaCard(recs){
  const f=recs.filter(r=>r.result&&r.result.status==="final");if(!f.length)return ["NBA: no graded picks yet."];
  // one block per model version, newest first, so a model change is judged on its own picks
  const versions=[...new Set(f.map(modelOf))].sort().reverse();
  if(versions.length>1)return versions.flatMap(v=>{const c=nbaCard(f.filter(r=>modelOf(r)===v));c[0]=c[0].replace(/^NBA:/,`NBA (model ${v}):`);return c;});
  const out=[`NBA: ${f.length} picks${small(f.length)}`];
  const names={zone:"Shot-zone edges",boost:"Projection boosts",prop:"Prop lines"};
  for(const k of ["zone","boost","prop"]){
    const g=f.filter(r=>r.kind===k);if(!g.length)continue;
    if(k==="prop"){
      let w=0,l=0,p=0;for(const r of g){const a=r.result[r.stat],over=r.po>=0.5;if(a===r.line)p++;else if((a>r.line)===over)w++;else l++;}
      out.push(`- ${names[k]}: ${w}-${l}${p?`-${p}`:""} (${pct(w/(w+l))}), ${sg(w*0.909-l)} units at -110 (break-even 52.4%)`);
      // closing-line value: did the line move our way after the alert? (over: close above our line is good)
      const c=g.filter(r=>r.close!=null);
      if(c.length){const clv=c.map(r=>(r.po>=0.5?1:-1)*(r.close-r.line)),beat=clv.filter(x=>x>0).length,lost=clv.filter(x=>x<0).length;
        out.push(`  - Closing line: ${c.length} with a close; it moved our way ${beat}, against us ${lost}, avg ${sg(mean(clv))} (beating the close is the early sign of a real edge)`);}
    }else{
      const beat=g.filter(r=>r.result[r.stat]>r.avg).length;
      out.push(`- ${names[k]}: ${beat}/${g.length} beat their average (${pct(beat/g.length)}); model said ${sg(mean(g.map(r=>r.proj-r.avg)))}, got ${sg(mean(g.map(r=>r.result[r.stat]-r.avg)))} per pick`);
    }
  }
  // game lines: tracked spread/total disagreements (no ✅ by default), against the result and the closing line
  for(const k of ["spread","total"]){
    const g=f.filter(r=>r.kind===k);if(!g.length)continue;
    const res=r=>k==="spread"?r.result.cover:(r.side==="over"?1:-1)*(r.result.total-r.line);
    const w=g.filter(r=>res(r)>0).length,l=g.filter(r=>res(r)<0).length,p=g.length-w-l;
    // more points on our side than the close (spread), or a better number than the close (total) = beat the close
    const c=g.filter(r=>r.close!=null),clv=c.map(r=>k==="spread"?r.line-r.close:(r.side==="over"?1:-1)*(r.close-r.line));
    out.push(`- Game ${k}s (model ${Math.floor(Math.min(...g.map(r=>r.edge)))}+ pts off the line): ${w}-${l}${p?`-${p}`:""} (${pct(w/(w+l))}), ${sg(w*0.909-l)} units at -110`+
      (c.length?`; vs the close: our way ${clv.filter(x=>x>0).length}, against ${clv.filter(x=>x<0).length}, avg ${sg(mean(clv))}`:""));
  }
  return out;
}
function recentLines(L,since){
  const out=[];
  for(const r of L.mlb.filter(r=>r.date>=since&&r.result))
    out.push(r.result.status==="void"?`${r.date} ${r.name} vs ${r.pitcher}: void (${r.result.why})`:
      r.kind==="live"?`${r.date} ${r.name} vs ${r.pitcher} (live, ${r.inning}): ${r.result.hrVsSP} HR in ${r.result.paVsSP} PA vs him (${pct(r.result.pHRvs)} expected)`:
      `${r.date} ${r.name} vs ${r.pitcher}: ${r.result.hr} HR in ${r.result.pa} PA (${pct(r.result.pHR)} expected), ${r.result.inWin}/${r.result.bbe} in window`);
  const LBL={pra:"PRA",pts:"PTS",reb:"REB",ast:"AST",fg3m:"3PM"};
  for(const r of L.nba.filter(r=>r.date>=since&&r.result)){
    if(r.kind==="spread"||r.kind==="total"){
      const what=r.kind==="spread"?`${r.team} ${r.line>0?"+":""}${r.line}`:`${r.side} ${r.line}`,cl=r.close!=null?`, closed ${r.close}`:"";
      out.push(r.result.status==="void"?`${r.date} ${r.name} ${what}: void (${r.result.why})`:`${r.date} ${r.name} ${what} (${r.kind}${cl}): ${r.result.as}-${r.result.hs}`);continue;}
    const tgt=r.kind==="prop"?`${r.po>=0.5?"o":"u"}${r.line}`:`proj ${r.proj.toFixed(1)}, avg ${r.avg.toFixed(1)}`;
    out.push(r.result.status==="void"?`${r.date} ${r.name} ${LBL[r.stat]} (${r.kind}): void (${r.result.why})`:
      `${r.date} ${r.name} ${LBL[r.stat]} (${r.kind}, ${tgt}): ${r.result[r.stat]}`);
  }
  return out.sort().reverse();
}
// ---------- NBA by tag: is an angle the alerts show actually worth anything? ----------
// Tags and context fields are logged on picks from 2026-10-25 on (older picks have no tags field and are left out).
// The DvP and rest groups use the logged fields, so every pick counts, not just the ones whose alert showed the tag.
const hoursOut=r=>r.tip&&r.at?(Date.parse(r.tip)-Date.parse(r.at))/36e5:null;
const NBA_FAMILIES=[
  ["no tags",r=>!r.tags.length],
  ["teammate out (w/o)",r=>r.tags.some(t=>t.startsWith("w/o"))],
  ["b2b 2nd night",r=>r.rest===1],
  ["2+ days rest",r=>r.rest>=3],
  ["soft D vs position (bottom 3)",r=>r.dvp&&r.dvp.rank>r.dvp.of-3],
  ["tough D vs position (top 3)",r=>r.dvp&&r.dvp.rank<=3],
  ["D vs position: bottom half",r=>r.dvp&&r.dvp.rank>r.dvp.of/2],
  ["D vs position: top half",r=>r.dvp&&r.dvp.rank<=r.dvp.of/2],
  ["high team total",r=>r.tags.includes("high team total")],
  ["blowout risk",r=>r.tags.includes("blowout risk")],
  // from model 2026-10-28-pra-blowout on: the team's spread drives blowout minutes, and h2h is logged on every pick
  ["8+ pt underdog",r=>r.tags.some(t=>/ underdog$/.test(t))],
  ["cold H2H (5+ PRA under avg vs this opp)",r=>r.h2h&&r.h2h.diff<=-5],
  ["hot H2H (5+ PRA over avg vs this opp)",r=>r.h2h&&r.h2h.diff>=5],
  ["PRA picks",r=>r.stat==="pra"],
  ["sent < 2h before tip",r=>hoursOut(r)!=null&&hoursOut(r)<2],
  ["sent 2h+ before tip",r=>hoursOut(r)!=null&&hoursOut(r)>=2],
];
// one line for a group of player picks: props by W-L/units/closing line, boosts by beat-their-average
function nbaGroup(g){
  const parts=[],pr=g.filter(r=>r.kind==="prop"),bo=g.filter(r=>r.kind==="boost"||r.kind==="zone");
  if(pr.length){let w=0,l=0,p=0;for(const r of pr){const a=r.result[r.stat];if(a===r.line)p++;else if((a>r.line)===(r.po>=0.5))w++;else l++;}
    const c=pr.filter(r=>r.close!=null),clv=c.map(r=>(r.po>=0.5?1:-1)*(r.close-r.line));
    parts.push(`props ${w}-${l}${p?`-${p}`:""} ${sg(w*0.909-l)}u`+(c.length?`, close our way ${clv.filter(x=>x>0).length}/${c.length} (avg ${sg(mean(clv))})`:""));}
  if(bo.length){const beat=bo.filter(r=>r.result[r.stat]>r.avg).length;
    parts.push(`boosts ${beat}/${bo.length} beat avg (${pct(beat/bo.length)}), said ${sg(mean(bo.map(r=>r.proj-r.avg)))} got ${sg(mean(bo.map(r=>r.result[r.stat]-r.avg)))}`);}
  return parts.join("; ");
}
function nbaTagCard(recs){
  const all=recs.filter(r=>r.result&&Array.isArray(r.tags)&&!["spread","total"].includes(r.kind)),f=all.filter(r=>r.result.status==="final");
  if(!f.length)return [];
  const out=[`NBA by tag: ${f.length} graded picks with tags logged${small(f.length)}`];
  for(const [name,fn] of NBA_FAMILIES){const g=f.filter(fn);if(g.length)out.push(`- ${name} (${g.length}): ${nbaGroup(g)}`);}
  // misses from minutes vs misses from the per-minute rate: says which half of the projection to fix
  const m=f.filter(r=>r.result.min>0&&r.minProj>0&&r.proj>0);
  if(m.length){const dm=m.map(r=>r.result.min-r.minProj),rate=m.map(r=>(r.result[r.stat]/r.result.min)/(r.proj/r.minProj));
    out.push(`- Minutes: projected ${mean(m.map(r=>r.minProj)).toFixed(1)}, played ${mean(m.map(r=>r.result.min)).toFixed(1)} (avg miss ${mean(dm.map(Math.abs)).toFixed(1)}, ${dm.filter(x=>x<=-8).length} picks 8+ min short); per-minute rate ${Math.round(mean(rate)*100)}% of projected`);}
  // didn't play (void): rest days and late scratches; the backtest says a b2b 2nd night should show more of these
  const vd=all.filter(r=>r.result.status==="void").length,b=all.filter(r=>r.rest===1),bv=b.filter(r=>r.result.status==="void").length;
  if(vd)out.push(`- Didn't play (void): ${vd}/${all.length} (${pct(vd/all.length)})`+(b.length?`; on a b2b 2nd night ${bv}/${b.length} (${pct(bv/b.length)})`:""));
  return out;
}
// NBA weekly review, the file the weekly Claude review reads (ledger nba-review.md), next to nba-edges/LEARNINGS.md on main,
// which lists every angle tested and what this review should check.
function nbaReview(L){
  const since=addDays(TODAY,-RECENT_DAYS),wk=L.nba.filter(r=>r.date>=since);
  return [`# NBA weekly review`,``,`Updated ${TODAY}. Ledger: \`nba.json\` on this branch. Read with \`nba-edges/LEARNINGS.md\` on main.`,``,
    `## Last ${RECENT_DAYS} days`,``,...nbaCard(wk),``,...nbaTagCard(wk),``,
    `## Season (by model version when there's more than one)`,``,...nbaCard(L.nba),``,...nbaTagCard(L.nba),``,
    `## How much to trust it`,``,
    `- Under ~${SMALL} graded picks a group is noise. Closing-line value (did the line move our way after the alert?) settles faster than W-L: about 50 picks with a close.`,
    `- A tag only matters against the "no tags" row in the same table, and only if it holds week after week.`,
    `- ${L.nba.filter(r=>r.result&&r.result.status==="final").length} graded, ${L.nba.filter(r=>!r.result).length} pending, ${L.nba.filter(r=>r.result&&r.result.status==="void").length} void.`,``].join("\n");
}
function scorecard(L){
  const since=addDays(TODAY,-RECENT_DAYS),rec=a=>a.filter(r=>r.date>=since);
  const tg=a=>{const t=nbaTagCard(a);return t.length?["",...t]:[];};
  const last=[...mlbCard(rec(L.mlb)),"",...nbaCard(rec(L.nba)),...tg(rec(L.nba))],all=[...mlbCard(L.mlb),"",...nbaCard(L.nba)],allMd=[...all,...tg(L.nba)];
  const pending=SPORTS.reduce((s,k)=>s+L[k].filter(r=>!r.result).length,0);
  const md=[`# Bot results`,``,`Updated ${TODAY}. ${pending} picks waiting on games to finish.`,``,
    `## Last ${RECENT_DAYS} days`,``,...last,``,`## All time`,``,...allMd,``,
    `## How to read this`,``,
    `- **MLB "expected"** is each flagged hitter's chance of homering given his real plate appearances and his own HR rate before that day (shrunk toward league average). A ratio above 1.00x means the flagged hitters homered more than they normally do. |z| above 2 is where it starts to look real.`,
    `- **NBA boosts / zone edges** compare the actual stat to the player's own average. "Model said" is the projected gain; "got" is the real one. If "got" is near zero, the boost is noise.`,
    `- **Prop lines** win when the result lands on the side the model picked. You need 52.4% to break even at -110.`,
    ``,`## Recent picks`,``,...recentLines(L,since).map(l=>`- ${l}`),``].join("\n");
  // the phone scorecard carries tags for the last week only, to stay short
  return {md,text:[`Last ${RECENT_DAYS} days`,...last,"","All time",...all].join("\n"),review:nbaReview(L)};
}
async function ntfy(title,message){
  if(DRY||!NTFY_TOPIC){log("DRY ntfy:",title,"\n"+message);return;}
  const h={"Content-Type":"application/json"};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  const r=await fetch(NTFY_SERVER,{method:"POST",headers:h,body:JSON.stringify({topic:NTFY_TOPIC,title,message:message.slice(0,3900),priority:3,tags:["bar_chart"]})});
  log("ntfy",r.status);
}

(async()=>{
  const L=loadLedger();
  ingest(L);
  await grade(L);
  const card=scorecard(L);
  console.log("\n"+card.text+"\n");
  fs.mkdirSync(LEDGER,{recursive:true});
  for(const s of SPORTS)fs.writeFileSync(path.join(LEDGER,`${s}.json`),JSON.stringify(L[s],null,1));
  fs.writeFileSync(path.join(LEDGER,"SUMMARY.md"),card.md);
  fs.writeFileSync(path.join(LEDGER,"nba-review.md"),card.review);
  if(SEND_SUMMARY&&SPORTS.some(s=>L[s].some(r=>r.result)))await ntfy(`Bot results, week to ${TODAY}`,card.text);
})().catch(async e=>{console.error(e);await ntfy("Results tracker error",String(e.message||e)).catch(()=>{});process.exit(1);});
