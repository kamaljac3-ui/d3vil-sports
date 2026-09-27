// CFB Lines: college football spread/total edges -> ntfy.
// MODE=auto (cron, every 15 min) decides from Eastern time what's due:
//   first    Sun from FIRST_HOUR ET (or once lines cover the week), Monday noon at the latest: the week's first look
//   update   noon ET, 2 days before Saturday games (Thursday) or the day before a weeknight game: injuries + forecast
//   final    FINAL_HOUR ET on game day: weather, availability reports, current lines
//   gameday  GD_MIN-GD_MAX min before each kickoff, ONLY if something changed materially since the last card
// Manual: MODE=first|update|final (build that card now for the next games), gameday (check the next kickoff now),
//         probe (check CFBD / Open-Meteo / availability feed from wherever this runs).
// Each card lists only games with an edge; state (sent markers, snapshots, CFBD cache) lives in cfb-lines/.cache.
const path=require("path");
process.env.NP_CACHE=process.env.NP_CACHE||path.join(__dirname,".cache");
const {env,envs,log,etParts,etToUtc,etClock,readState,writeState,ntfy,summary,normName,getRaw,LIVE,DRY}=require("../nfl-props/lib");
const cfbd=require("./cfbd"),D=require("./data"),M=require("./model"),A=require("./avail");

const MODE=envs("MODE","auto");
const CFG={
  MIN_SPREAD:env("MIN_SPREAD",4),MIN_TOTAL:env("MIN_TOTAL",8),   // from the 2023-25 backtest (README)
  SPREAD_EDGES:env("SPREAD_EDGES",1),TOTAL_EDGES:env("TOTAL_EDGES",0),   // totals: no reliable edge in the backtest
  MAX_EDGE:env("MAX_EDGE",14),           // bigger gaps are usually news the model hasn't seen: shown with ⚠️, not ✅
  MIN_WEEK:env("MIN_WEEK",4),            // weeks 1-3 lost in the backtest (priors-heavy)
  FIRST_HOUR:env("FIRST_HOUR",14),FIRST_COVER:env("FIRST_COVER",0.6),
  UPDATE_HOUR:env("UPDATE_HOUR",12),FINAL_HOUR:env("FINAL_HOUR",9),
  GD_MIN:env("GD_MIN",75),GD_MAX:env("GD_MAX",110),
  GD_MOVE:env("GD_MOVE",1.5),GD_WIND:env("GD_WIND",7),   // material change: our number moved this much / wind shift (mph)
};
const RUN_URL=process.env.GITHUB_RUN_ID?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:"";
const r1=v=>Math.round(v*2)/2,f1=v=>(Math.round(v*10)/10).toFixed(1);
const now=Date.now(),ET=etParts(new Date(now));
const S=+ET.date.slice(0,4)-(+ET.date.slice(5,7)<3?1:0);
// a "card date" is the ET date of kickoff minus 5 h, so a 12:00 AM ET Hawaii kickoff belongs to Saturday
const cardDate=t=>etParts(new Date(t-5*36e5)).date;
const addDays=(d,n)=>new Date(Date.parse(d+"T12:00:00Z")+n*864e5).toISOString().slice(0,10);
const wdOf=d=>new Date(d+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"short",timeZone:"UTC"});
const updateAt=d=>{const wd=wdOf(d);return etToUtc(addDays(d,wd==="Sat"?-2:wd==="Sun"?-3:-1),`${CFG.UPDATE_HOUR}:00`).getTime();};
const finalAt=d=>etToUtc(d,`${String(CFG.FINAL_HOUR).padStart(2,"0")}:00`).getTime();

// ---------- context ----------
async function context(){
  const [games,venues,teams]=await Promise.all([D.games(S,S),D.venues(),D.teams(S,S)]);
  return {S,games,venues,teams,fbs:Object.fromEntries(Object.keys(teams).map(t=>[t,true]))};
}
async function modelContext(ctx){
  const [adv,talent,ret,pg,pa,pt]=await Promise.all([D.advanced(S,S),D.talent(S,S),D.returning(S,S),D.games(S-1,S),D.advanced(S-1,S),D.teams(S-1,S)]);
  const prevFinal=M.seasonFinal(pa,pg,Object.fromEntries(Object.keys(pt).map(t=>[t,true])));
  return {...ctx,adv,talent,ret,prevFinal};
}

// Usual starting QB per team: most starts (most pass attempts, 8+) in its last 3 games.
async function usualQBs(ctx,wk){
  const box={};for(let w=Math.max(1,wk-4);w<wk;w++)Object.assign(box,await D.passers(S,S,w,w<wk-1?24*30:12));
  const st={};
  for(const g of ctx.games.filter(g=>g.done&&g.wk<wk))for(const t of [g.home,g.away]){const q=box[g.id]&&box[g.id][t]&&box[g.id][t][0];
    if(q&&q.att>=8)(st[t]||(st[t]=[])).push(q);}
  const out={};
  for(const [t,a] of Object.entries(st)){const c={};for(const q of a.slice(-3))(c[q.id]||(c[q.id]={...q,n:0})).n++;
    out[t]=Object.values(c).sort((x,y)=>y.n-x.n)[0];}
  return out;
}

// ---------- current lines: CFBD consensus, with ESPN's (DraftKings) number preferred on game day ----------
async function espnLines(dates){
  const out={};
  for(const d of dates){
    const r=await getRaw(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=300&dates=${d.replace(/-/g,"")}`,{headers:{}});
    const j=r?await r.json().catch(()=>null):null;if(!j)continue;
    for(const e of j.events||[]){const c=e.competitions&&e.competitions[0],o=c&&(c.odds||[])[0];if(!o||o.spread==null)continue;
      const t={};for(const x of c.competitors||[])t[x.homeAway]=x.team.location||x.team.displayName;
      out[normName(t.away)+"@"+normName(t.home)]={m:-o.spread,t:o.overUnder??null,book:(o.provider&&o.provider.name)||"ESPN"};}
  }
  return out;
}
async function currentLines(games,wk,{espn=false,h=1}={}){
  const cf=await D.lines(S,S,wk,h),es=espn?await espnLines([...new Set(games.map(g=>etParts(new Date(g.start)).date))]):{};
  const out={};
  for(const g of games){const c=D.consensus(cf[g.id]),e=es[normName(g.away)+"@"+normName(g.home)];
    if(e&&e.m!=null)out[g.id]={m:e.m,t:e.t??(c&&c.t),src:e.book};
    else if(c&&c.m!=null)out[g.id]={m:c.m,t:c.t,src:`${c.books.length} books`};}
  return out;
}

// ---------- evaluate games ----------
async function evaluate(ctx,games,{espn=false,avail=true,lineH=1}={}){
  const wk=Math.min(...games.map(g=>g.wk));
  const MC=await modelContext(ctx),R=M.ratings(MC,wk);
  const [L,qbs,use,tk]=await Promise.all([currentLines(games,wk,{espn,h:lineH}),usualQBs(ctx,wk),D.usage(S,S),D.tackles(S,S)]);
  const confOf=t=>ctx.teams[t]&&ctx.teams[t].conf;
  const reps=avail?await A.reports(games,confOf):{};
  const byTeam=(src,val)=>{const o={};for(const x of Object.values(src)){(o[x.team]||(o[x.team]={}))[normName(x.name)]=val(x);}return o;};
  const U=byTeam(use,x=>x.u),T=byTeam(tk,x=>x.share);
  const out=[];
  for(const g of games){
    if(!g.homeFBS||!g.awayFBS)continue;
    const wx=await A.kickoffWeather(ctx.venues[g.venueId],g.start);
    const inj={},notes=[],qbFlags={};
    for(const [side,t] of [["home",g.home],["away",g.away]]){
      const rep=reps[t],qb=qbs[t];
      if(!rep)continue;
      const a=M.availability(rep.rows,qb,U[t]||{},T[t]||{},normName);
      inj[side]={pts:a.pts,total:a.total};notes.push(...a.notes.map(n=>`${ctx.teams[t]?.abbr||t} ${n}`));
      qbFlags[t]=a.notes.filter(n=>n.startsWith("QB")).join(",");
      if(qb&&!a.qbListed)notes.push(`${ctx.teams[t]?.abbr||t} QB ${qb.name} not on the ${rep.type||"availability"} report`);
    }
    // home climates only matter on a hot or muggy day at an outdoor stadium
    const norm={};
    if(wx&&!wx.indoor&&(wx.dew>=M.C.HUMID_DEW||wx.temp>=M.C.HEAT_F))
      for(const t of [g.home,g.away]){const T=ctx.teams[t];norm[t]=await A.homeClimate(t,T&&T.venueId!=null&&ctx.venues[T.venueId]||T,S);}
    const P=M.predict(R,MC,g,{wx,inj,norm}),line=L[g.id];
    out.push({g,P,line,wx,notes,qbFlags,avail:{home:!!reps[g.home],away:!!reps[g.away]},...edges(g,P,line)});
  }
  return out;
}
function edges(g,P,line){
  const e={spread:null,total:null};if(!line)return e;
  const early=g.wk<CFG.MIN_WEEK;
  if(line.m!=null){const d=P.margin-line.m,side=d>0?"home":"away",size=Math.abs(d);
    e.spread={d,side,size,ok:!early&&CFG.SPREAD_EDGES&&size>=CFG.MIN_SPREAD,wild:size>CFG.MAX_EDGE};}
  if(line.t!=null){const d=P.total-line.t,size=Math.abs(d);
    e.total={d,side:d>0?"OVER":"UNDER",size,ok:!early&&CFG.TOTAL_EDGES&&size>=CFG.MIN_TOTAL,wild:size>CFG.MAX_EDGE};}
  return e;
}

// ---------- formatting ----------
const ab=(ctx,t)=>ctx.teams[t]?.abbr||t;
const spreadTxt=(ctx,g,m)=>r1(m)===0?"PK":m>0?`${ab(ctx,g.home)} -${Math.abs(r1(m))}`:`${ab(ctx,g.away)} -${Math.abs(r1(m))}`;
function reasons(ctx,x){
  const g=x.g,out=[];
  for(const p of x.P.parts){if(Math.abs(p.pts)<0.5||p.label.endsWith("availability"))continue;
    out.push(p.kind==="m"?`${p.label==="crowd size"&&p.f<0?"small crowd":p.label} ${p.pts>0?ab(ctx,g.home):ab(ctx,g.away)} +${f1(Math.abs(p.pts))}`:`${p.label} ${p.pts>0?"+":""}${f1(p.pts)} total`);}
  if(x.wx&&!x.wx.indoor&&(x.wx.wind>M.C.WIND_MPH||x.wx.precip>=M.C.RAIN_IN||x.wx.temp<M.C.COLD_F||x.P.f.humid||x.P.f.heat))out.push(A.wxText(x.wx)+(x.wx.dew>=M.C.HUMID_DEW?`, dew point ${x.wx.dew}°F`:""));
  out.push(...x.notes);
  return out;
}
function block(ctx,x){
  const g=x.g,L=[];
  L.push(`${ab(ctx,g.away)} @ ${ab(ctx,g.home)}${g.neutral?" (neutral)":""} · ${etParts(new Date(g.start)).wd} ${g.tbd?"TBD":etClock(new Date(g.start))+" ET"}`);
  const s=x.spread;
  if(s){const pick=s.side==="home"?`${ab(ctx,g.home)} ${x.line.m>=0?"-":"+"}${Math.abs(r1(x.line.m))}`:`${ab(ctx,g.away)} ${x.line.m>0?"+":"-"}${Math.abs(r1(x.line.m))}`;
    L.push(`  Spread ${spreadTxt(ctx,g,x.line.m)} · ours ${spreadTxt(ctx,g,x.P.margin)} · edge ${f1(s.size)}${s.ok&&!s.wild?` → ${pick} ✅`:s.ok?" ⚠️ too big, check news":""}`);}
  const t=x.total;
  if(t)L.push(`  Total ${x.line.t} · ours ${f1(x.P.total)} · edge ${f1(t.size)}${t.ok&&!t.wild?` → ${t.side} ✅`:t.ok?" ⚠️ too big, check news":""}`);
  const why=reasons(ctx,x);if(why.length)L.push(`  Why: ${why.join("; ")}`);
  return L.join("\n");
}
const hasEdge=x=>(x.spread&&x.spread.ok)||(x.total&&x.total.ok);
const edgeSize=x=>Math.max(x.spread&&x.spread.ok?x.spread.size:0,x.total&&x.total.ok?x.total.size:0);

async function sendCard(ctx,kind,games,title){
  const ev=await evaluate(ctx,games,{espn:kind!=="first",avail:kind!=="first"});
  const hits=ev.filter(hasEdge).sort((a,b)=>edgeSize(b)-edgeSize(a));
  const priced=ev.filter(x=>x.line).length;
  const head=`${hits.length} edge${hits.length===1?"":"s"} in ${priced} priced FBS game${priced===1?"":"s"}`+
    `${ev.length>priced?` (${ev.length-priced} no line yet)`:""}. Thresholds: spread ${CFG.MIN_SPREAD}, total ${CFG.MIN_TOTAL}.`;
  let body="",shown=0;
  for(const x of hits){const b=block(ctx,x)+"\n\n";if(body.length+b.length>3500)break;body+=b;shown++;}
  if(shown<hits.length)body+=`+${hits.length-shown} more in the run log.\n\n`;
  const early=ev.some(x=>x.g.wk<CFG.MIN_WEEK)?`Week ${ev[0].g.wk}: numbers only until week ${CFG.MIN_WEEK}.\n`:"";
  const msg=`${early}${head}\n\n${body}`.trim();
  summary(`## ${title}\n\n\`\`\`\n${msg}\n\`\`\`\n\n<details><summary>All games</summary>\n\n\`\`\`\n${ev.map(x=>block(ctx,x)).join("\n\n")}\n\`\`\`\n</details>\n`);
  log(title+"\n"+ev.map(x=>block(ctx,x)).join("\n\n"));
  const ok=await ntfy(title,msg,hits.length?4:3,["football","moneybag"],RUN_URL);
  if(LIVE&&ok)saveSnaps(ev);
  return ok;
}

// ---------- game-day: only material changes ----------
function snapOf(x){return {m:x.P.margin,t:x.P.total,lm:x.line?.m??null,lt:x.line?.t??null,qb:Object.values(x.qbFlags).filter(Boolean).join("|"),
  wind:x.wx&&!x.wx.indoor?x.wx.wind:null,es:x.spread&&x.spread.ok?x.spread.side:"",et:x.total&&x.total.ok?x.total.side:"",at:now};}
function saveSnaps(ev){const s=readState(`snap-${S}.json`)||{};for(const x of ev)s[x.g.id]=snapOf(x);writeState(`snap-${S}.json`,s);}
function changes(ctx,x,prev){
  const c=[],n=snapOf(x),g=x.g;
  if(!prev){if(hasEdge(x))c.push("no earlier card to compare (edge shown)");return c;}
  if(n.qb!==prev.qb)c.push(n.qb?`QB news: ${n.qb}`:"QB back to available");
  if(n.wind!=null&&prev.wind!=null&&(Math.abs(n.wind-prev.wind)>=CFG.GD_WIND||(n.wind>M.C.WIND_MPH)!==(prev.wind>M.C.WIND_MPH)))
    c.push(`wind ${Math.round(prev.wind)} → ${Math.round(n.wind)} mph`);
  if(n.es!==prev.es)c.push(n.es?`spread edge now on ${n.es==="home"?ab(ctx,g.home):ab(ctx,g.away)}`:"spread edge gone");
  if(n.et!==prev.et)c.push(n.et?`total edge now ${n.et}`:"total edge gone");
  // the line crossed our number (either direction)
  if(n.lm!=null&&prev.lm!=null&&Math.sign(n.m-n.lm)!==Math.sign(prev.m-prev.lm))c.push(`spread moved through our number (${spreadTxt(ctx,g,prev.lm)} → ${spreadTxt(ctx,g,n.lm)})`);
  if(n.lt!=null&&prev.lt!=null&&Math.sign(n.t-n.lt)!==Math.sign(prev.t-prev.lt))c.push(`total moved through our number (${prev.lt} → ${n.lt})`);
  if(Math.abs(n.m-prev.m)>=CFG.GD_MOVE)c.push(`our spread ${spreadTxt(ctx,g,prev.m)} → ${spreadTxt(ctx,g,n.m)}`);
  return c;
}
async function gameday(ctx,games,sent){
  const ev=await evaluate(ctx,games,{espn:true,avail:true,lineH:0.5}),snaps=readState(`snap-${S}.json`)||{};
  let n=0;
  for(const x of ev){
    const c=changes(ctx,x,snaps[x.g.id]);
    log(`${ab(ctx,x.g.away)} @ ${ab(ctx,x.g.home)}: ${c.length?c.join("; "):"no material change"}`);
    if(c.length){
      const title=`CFB kickoff ${etClock(new Date(x.g.start))} ET: ${ab(ctx,x.g.away)} @ ${ab(ctx,x.g.home)}${hasEdge(x)?" ✅":""}`;
      const msg=`Changed: ${c.join("; ")}\n\n${block(ctx,x)}${x.line?`\n\nLine: ${x.line.src}`:""}`;
      summary(`## ${title}\n\n\`\`\`\n${msg}\n\`\`\`\n`);
      const ok=await ntfy(title,msg,hasEdge(x)?4:3,["football","rotating_light"],RUN_URL);n++;
      if(LIVE&&ok)saveSnaps([x]);
    }
    if(LIVE&&MODE==="auto")sent.gd[x.g.id]=true;
  }
  return n;
}

// ---------- probe: can this machine reach everything? ----------
async function probe(){
  const out=[];
  const info=await cfbd.info().then(j=>JSON.stringify(j)).catch(e=>e.message);
  out.push(`CFBD /info: ${info}`);
  try{const ctx=await context();const up=ctx.games.filter(g=>g.start>now);const wk=up[0]?.wk;
    out.push(`CFBD games ${S}: ${ctx.games.length} (next week ${wk}), venues ${Object.keys(ctx.venues).length}, FBS teams ${Object.keys(ctx.teams).length}`);
    const hi=Object.values(ctx.venues).filter(v=>/Falcon|War Memorial|Folsom|Canvas|LaVell|Maverik|University Stadium|Rice-Eccles|Bronco|Sun Devil|Kinnick/.test(v.name)).map(v=>`${v.name} ${v.elev}`);out.push(`venue elevations: ${hi.join("; ")}`);
    const tm=["Air Force","Wyoming","Miami","Colorado"].map(t=>`${t} ${ctx.teams[t]&&ctx.teams[t].elev}`);out.push(`team elevations: ${tm.join("; ")}`);
    const L=await D.lines(S,S,wk,1);out.push(`CFBD lines week ${wk}: ${Object.keys(L).length} games priced, books: ${[...new Set(Object.values(L).flat().map(l=>l.book))].join(", ")}`);
    const g=up.find(x=>ctx.venues[x.venueId]&&!ctx.venues[x.venueId].dome);
    if(g){const w=await A.kickoffWeather(ctx.venues[g.venueId],g.start);out.push(`Open-Meteo ${g.venue}: ${w?A.wxText(w):"no forecast yet (more than 15 days out?)"}`);}
    const reps=await A.reports(up.filter(x=>x.conf).slice(0,40),t=>ctx.teams[t]&&ctx.teams[t].conf,14);
    out.push(`Availability feed: reports for ${Object.keys(reps).length} teams${Object.keys(reps).length?` (e.g. ${Object.values(reps)[0].team}: ${Object.values(reps)[0].type} ${Object.values(reps)[0].posted})`:""}`);
  }catch(e){out.push("ERROR: "+e.message);}
  const u=cfbd.usage();out.push(`CFBD calls by this bot this month: ${u.calls} (budget ${cfbd.BUDGET})${u.remaining!=null?`, key has ${u.remaining} left`:""}`);
  const msg=out.join("\n");console.log(msg);summary("## CFB Lines probe\n\n```\n"+msg+"\n```\n");
}

// ---------- main ----------
(async()=>{
  log(`${ET.wd} ${ET.date} ${ET.h}:${String(ET.m).padStart(2,"0")} ET, mode=${MODE}${DRY?" (dry run)":""}${LIVE?"":" (not sending)"}`);
  if(MODE==="probe")return probe();
  const ctx=await context();
  const up=ctx.games.filter(g=>g.start>now&&g.homeFBS&&g.awayFBS);
  if(!up.length){log(`no upcoming FBS games in ${S}`);return;}
  const sent=readState(`sent-${S}.json`)||{first:{},update:{},final:{},gd:{}};
  const wk=up[0].wk,weekGames=up.filter(g=>g.wk===wk);
  const jobs=[];
  const force=["first","update","final","gameday"].includes(MODE);
  if(!force&&MODE!=="auto")throw new Error(`Unknown MODE "${MODE}" (auto, first, update, final, gameday, probe)`);

  // first look: once per CFBD week
  if(MODE==="first"||(MODE==="auto"&&!sent.first[wk]&&((ET.wd==="Sun"&&ET.h>=CFG.FIRST_HOUR)||(ET.wd==="Mon"&&ET.h>=10)||(ET.wd==="Tue"&&ET.h<12)))){
    let go=MODE==="first"||ET.wd!=="Sun";
    if(!go){const L=await D.lines(S,S,wk,2);const c=weekGames.filter(g=>L[g.id]).length/weekGames.length;
      log(`first look: ${Math.round(c*100)}% of week ${wk}'s FBS games priced`);go=c>=CFG.FIRST_COVER;}
    if(go)jobs.push(["first",weekGames,`CFB week ${wk} first look`,()=>{sent.first[wk]=true;}]);
  }
  // update + final: per card date; dates due in the same run share one card (Thursday's covers Fri + Sat)
  const dates=[...new Set(up.map(g=>cardDate(g.start)))].sort();
  for(const kind of ["update","final"]){
    const dueDates=dates.filter(d=>up.some(g=>cardDate(g.start)===d&&g.start-now>=2*36e5)&&(MODE===kind?d===dates[0]:MODE==="auto"&&!sent[kind][d]&&
      (kind==="update"?now>=updateAt(d)&&now<finalAt(d):now>=finalAt(d))));
    if(!dueDates.length)continue;
    const gs=up.filter(g=>dueDates.includes(cardDate(g.start))&&g.start-now>=2*36e5);
    const label=dueDates.map(d=>wdOf(d)).join("+");
    jobs.push([kind,gs,kind==="update"?`CFB ${label} update: injuries + forecast`:`CFB ${label} final card`,()=>{for(const d of dueDates)sent[kind][d]=true;}]);
  }
  // game day: each game once, GD_MIN-GD_MAX minutes out
  const due=MODE==="gameday"?up.filter(g=>g.start===up[0].start)
    :MODE==="auto"?up.filter(g=>{const m=(g.start-now)/6e4;return !g.tbd&&m>=CFG.GD_MIN&&m<=CFG.GD_MAX&&!(sent.gd||{})[g.id];}):[];

  log(`week ${wk}; jobs: ${jobs.map(j=>j[0]).join(", ")||"-"}; game-day checks: ${due.length}`);
  for(const [kind,gs,title,mark] of jobs){const ok=await sendCard(ctx,kind,gs,title);if(LIVE&&ok&&MODE==="auto")mark();}
  if(due.length){sent.gd=sent.gd||{};await gameday(ctx,due,sent);}
  if(LIVE&&MODE==="auto"&&(jobs.length||due.length))writeState(`sent-${S}.json`,sent);
  const u=cfbd.usage();log(`CFBD calls this month: ${u.calls}/${cfbd.BUDGET}${u.remaining!=null?` (key: ${u.remaining} left)`:""}`);
})().catch(async e=>{
  console.error(e);
  const last=readState("error-alert.json",6);
  if(!last&&LIVE){await ntfy("CFB lines bot error",String(e.message||e),2,["warning"]).catch(()=>{});writeState("error-alert.json",true);}
  process.exit(1);
});
