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
const PICK_DIRS=(process.env.PICK_DIRS||"launch-angle/.cache,nba-edges/.cache,mlb-live/.cache").split(",").map(d=>path.resolve(ROOT,d.trim()));
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
        if(have){if(!have.modes.includes(p.mode))have.modes.push(p.mode);continue;}
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
async function gradeNba(r){
  const s=await nbaSummary(r.gameId);if(!s)return null;
  const st=s.header.competitions[0].status.type;
  if(/postponed|cancel/i.test(st.name))return {status:"void",why:st.description};
  if(!st.completed)return null;
  for(const t of s.boxscore.players||[])for(const g of t.statistics||[]){
    const a=(g.athletes||[]).find(x=>nk(x.athlete.displayName)===r.key);if(!a)continue;
    if(a.didNotPlay||!a.stats||!a.stats.length)return {status:"void",why:a.reason||"did not play"};
    const L=g.labels,v=k=>a.stats[L.indexOf(k)];
    const min=parseInt(v("MIN"))||0;if(!min)return {status:"void",why:"0 minutes"};
    return {status:"final",min,pts:+v("PTS")||0,reb:+v("REB")||0,ast:+v("AST")||0,fg3m:parseInt(String(v("3PT")).split("-")[0])||0};
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
function nbaCard(recs){
  const f=recs.filter(r=>r.result&&r.result.status==="final");if(!f.length)return ["NBA: no graded picks yet."];
  const out=[`NBA: ${f.length} picks${small(f.length)}`];
  const names={zone:"Shot-zone edges",boost:"Projection boosts",prop:"Prop lines"};
  for(const k of ["zone","boost","prop"]){
    const g=f.filter(r=>r.kind===k);if(!g.length)continue;
    if(k==="prop"){
      let w=0,l=0,p=0;for(const r of g){const a=r.result[r.stat],over=r.po>=0.5;if(a===r.line)p++;else if((a>r.line)===over)w++;else l++;}
      out.push(`- ${names[k]}: ${w}-${l}${p?`-${p}`:""} (${pct(w/(w+l))}), ${sg(w*0.909-l)} units at -110 (break-even 52.4%)`);
    }else{
      const beat=g.filter(r=>r.result[r.stat]>r.avg).length;
      out.push(`- ${names[k]}: ${beat}/${g.length} beat their average (${pct(beat/g.length)}); model said ${sg(mean(g.map(r=>r.proj-r.avg)))}, got ${sg(mean(g.map(r=>r.result[r.stat]-r.avg)))} per pick`);
    }
  }
  return out;
}
function recentLines(L,since){
  const out=[];
  for(const r of L.mlb.filter(r=>r.date>=since&&r.result))
    out.push(r.result.status==="void"?`${r.date} ${r.name} vs ${r.pitcher}: void (${r.result.why})`:
      r.kind==="live"?`${r.date} ${r.name} vs ${r.pitcher} (live, ${r.inning}): ${r.result.hrVsSP} HR in ${r.result.paVsSP} PA vs him (${pct(r.result.pHRvs)} expected)`:
      `${r.date} ${r.name} vs ${r.pitcher}: ${r.result.hr} HR in ${r.result.pa} PA (${pct(r.result.pHR)} expected), ${r.result.inWin}/${r.result.bbe} in window`);
  const LBL={pts:"PTS",reb:"REB",ast:"AST",fg3m:"3PM"};
  for(const r of L.nba.filter(r=>r.date>=since&&r.result)){
    const tgt=r.kind==="prop"?`${r.po>=0.5?"o":"u"}${r.line}`:`proj ${r.proj.toFixed(1)}, avg ${r.avg.toFixed(1)}`;
    out.push(r.result.status==="void"?`${r.date} ${r.name} ${LBL[r.stat]} (${r.kind}): void (${r.result.why})`:
      `${r.date} ${r.name} ${LBL[r.stat]} (${r.kind}, ${tgt}): ${r.result[r.stat]}`);
  }
  return out.sort().reverse();
}
function scorecard(L){
  const since=addDays(TODAY,-RECENT_DAYS),rec=a=>a.filter(r=>r.date>=since);
  const last=[...mlbCard(rec(L.mlb)),"",...nbaCard(rec(L.nba))],all=[...mlbCard(L.mlb),"",...nbaCard(L.nba)];
  const pending=SPORTS.reduce((s,k)=>s+L[k].filter(r=>!r.result).length,0);
  const md=[`# Bot results`,``,`Updated ${TODAY}. ${pending} picks waiting on games to finish.`,``,
    `## Last ${RECENT_DAYS} days`,``,...last,``,`## All time`,``,...all,``,
    `## How to read this`,``,
    `- **MLB "expected"** is each flagged hitter's chance of homering given his real plate appearances and his own HR rate before that day (shrunk toward league average). A ratio above 1.00x means the flagged hitters homered more than they normally do. |z| above 2 is where it starts to look real.`,
    `- **NBA boosts / zone edges** compare the actual stat to the player's own average. "Model said" is the projected gain; "got" is the real one. If "got" is near zero, the boost is noise.`,
    `- **Prop lines** win when the result lands on the side the model picked. You need 52.4% to break even at -110.`,
    ``,`## Recent picks`,``,...recentLines(L,since).map(l=>`- ${l}`),``].join("\n");
  return {md,text:[`Last ${RECENT_DAYS} days`,...last,"","All time",...all].join("\n")};
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
  if(SEND_SUMMARY&&SPORTS.some(s=>L[s].some(r=>r.result)))await ntfy(`Bot results, week to ${TODAY}`,card.text);
})().catch(async e=>{console.error(e);await ntfy("Results tracker error",String(e.message||e)).catch(()=>{});process.exit(1);});
