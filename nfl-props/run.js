// NFL Props Edges: weekly player projections + ntfy alerts.
// MODE=auto     -> (cron) decides from Eastern time what is due: Wednesday projections,
//                  Friday post-injury-report update, and per-game alerts ~90 min before kickoff.
// MODE=wed|fri  -> force that weekly alert now.   MODE=gameday -> force the game-day check
//                  (GAME=<nflverse game_id>, else games in the window, else the next game).
const {env,envs,log,etParts,etToUtc,etClock,readState,writeState,ntfy,summary,normName,LIVE,DRY}=require("./lib");
const data=require("./data"),M=require("./model"),W=require("./weather"),odds=require("./odds"),SH=require("./sharp");
const {VERSIONS,gameContext,windBucket}=require("./context");

const MODE=envs("MODE","auto");
const CFG={
  WED_HOUR:env("WED_HOUR",11),FRI_HOUR:env("FRI_HOUR",17),       // Eastern hour the weekly alerts become due
  // Game-day window, minutes before kickoff. Opens at 80 so the alert follows the inactives list (~90 min out)
  // and Sleeper's updates; stays open to 10 so a run GitHub starts late still sends instead of skipping (week 5:
  // a run began 74.6 min before Monday night's kickoff and missed the old 75-110 window by 36 seconds).
  GD_MIN:env("GD_MIN",10),GD_MAX:env("GD_MAX",80),
  TOP_N:env("TOP_N",12),
  MIN_PROB:env("MIN_PROB",0.56),                                  // calibrated chance the pick side hits
  MIN_EDGE_PCT:env("MIN_EDGE_PCT",0.2),                           // no line: projection vs recent average
  MIN_BASE_GAMES:env("MIN_BASE_GAMES",3),                          // no line: games behind that average
  MIN_EDGE:{recYds:env("MIN_EDGE_RECYDS",10),rec:env("MIN_EDGE_REC",0.8),rushYds:env("MIN_EDGE_RUSHYDS",10),passYds:env("MIN_EDGE_PASSYDS",20)},
  MIN_BASE:{recYds:env("MIN_BASE_RECYDS",25),rec:env("MIN_BASE_REC",2.5),rushYds:env("MIN_BASE_RUSHYDS",25),passYds:env("MIN_BASE_PASSYDS",150)},
  WIND_NOTE:env("WIND_NOTE",12),                               // mph before a game's wind is mentioned
  BUMP_TGT:env("BUMP_TGT",1.5),BUMP_CAR:env("BUMP_CAR",2.5),      // usage bump worth mentioning
  GD_DELTA_PCT:env("GD_DELTA_PCT",0.12),GD_WIND_DELTA:env("GD_WIND_DELTA",6),GD_ALWAYS:env("GD_ALWAYS",0),
  GD_DELTA_ABS:{recYds:env("GD_DELTA_RECYDS",8),rec:env("GD_DELTA_REC",0.7),rushYds:env("GD_DELTA_RUSHYDS",8),passYds:env("GD_DELTA_PASSYDS",15)},
  DOUBTFUL_OUT:env("DOUBTFUL_OUT",1),
  // stale props (needs ODDS_API_KEY): your books' prices vs the sharp book's no-vig price
  MIN_EV:env("MIN_EV_PROPS",0.03),STALE_N:env("STALE_N",6),
  STALE_GAP:{recYds:env("STALE_GAP_RECYDS",8),rec:env("STALE_GAP_REC",1),rushYds:env("STALE_GAP_RUSHYDS",8),passYds:env("STALE_GAP_PASSYDS",15)},
  PARLAY_HOUR:env("PARLAY_HOUR",11.75),PARLAY_LEGS:env("PARLAY_LEGS",5),PARLAY_MARKET_W:env("PARLAY_MARKET_W",0.5),   // Sunday parlay
  ODDS_TOP:env("ODDS_TOP_PLAYERS",20),ODDS_MAX_EVENTS:env("ODDS_MAX_EVENTS",8),ODDS_ON_GAMEDAY:env("ODDS_ON_GAMEDAY",0),
};
const LABEL={recYds:"rec yds",rec:"rec",rushYds:"rush yds",passYds:"pass yds"};
const r1=(v,s)=>s==="rec"?v.toFixed(1):Math.round(v);
const pct=v=>Math.round(v*100)+"%";
// link to this run's summary page (full projection table); ntfy opens it when the alert is tapped
const RUN_URL=process.env.GITHUB_RUN_ID?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:"";

// ---------- schedule ----------
async function scheduleFor(S,maxAgeH){
  const hit=readState(`sched-${S}.json`,maxAgeH);if(hit)return hit;
  const g=(await data.schedule([S])).map(x=>({...x,kick:etToUtc(x.gameday,x.gametime).getTime()}));
  return writeState(`sched-${S}.json`,g);
}

// ---------- availability ----------
function statusFn(DB,S,sl,inj,team){
  return id=>{
    const s=sl[id],r=DB.players.get(id);
    if(s){if(!s[0]||s[0]!==team)return "out";}                                   // traded, cut, free agent
    else if(!r||r.season<S||r.team!==team)return "out";
    if(r&&r.season===S&&r.status&&r.status!=="ACT")return "out";                  // IR, practice squad, cut...
    const si=s?s[1]:"",ri=inj.get(id)||"";
    if(["Out","IR","PUP","Sus","NA","COV","DNR"].includes(si)||ri==="Out")return "out";
    if(si==="Doubtful"||ri==="Doubtful")return CFG.DOUBTFUL_OUT?"out":"q";
    if(si==="Questionable"||ri==="Questionable")return "q";
    return "";
  };
}
function candidates(DB,S,week,team){
  const asOf=data.ord(S,week),out=[];
  for(const [id,recs] of DB.pg)if(recs.some(r=>r.team===team&&r.o<asOf&&(r.season===S||week<=2)))out.push(id);
  return out;
}

async function projectGame(ctx,g){
  const {DB,S,week,sl,inj,depth}=ctx,kick=new Date(g.kick);
  const wx=await W.kickoffWeather(g,kick);
  const side=home=>{const team=home?g.home_team:g.away_team,opp=home?g.away_team:g.home_team;
    return M.projectTeam(DB,{team,opp,home,spread:g.spread_line,total:g.total_line,weather:wx,asOf:data.ord(S,week),
      candidates:candidates(DB,S,week,team),status:statusFn(DB,S,sl,inj,team),depthQB:(depth[team]||{}).QB});};
  const sides=[side(false),side(true)];
  for(const s of sides)for(const p of s.players){p.gid=g.game_id;p.game=`${g.away_team}@${g.home_team}`;p.home=s.team===g.home_team;}
  return {g,kick,wx,sides,players:sides.flatMap(s=>s.players)};
}

// ---------- picks ----------
function evaluate(p,stat,lines){
  // only a line you can bet counts as a line; otherwise judge against the recent average as usual
  const proj=p.stats[stat],L=lines&&lines[stat]&&lines[stat].atMyBook!==false?lines[stat]:null;
  if(L){const pO=M.pOver(stat,proj,L.line),over=pO>=0.5,prob=over?pO:1-pO,edge=proj-L.line;
    return {p,stat,proj,ref:L.line,refKind:"line",over,prob,edge,price:over?L.over:L.under,
      ok:Math.abs(edge)>=CFG.MIN_EDGE[stat]&&prob>=CFG.MIN_PROB};}
  const b=p.base[stat];if(b==null||b<CFG.MIN_BASE[stat]||p.base.n<CFG.MIN_BASE_GAMES)return null;
  const pO=M.pOver(stat,proj,b),over=pO>=0.5,prob=over?pO:1-pO;
  return {p,stat,proj,ref:b,refKind:"avg",over,prob,edge:proj-b,ok:Math.abs(proj/b-1)>=CFG.MIN_EDGE_PCT&&prob>=CFG.MIN_PROB};
}
function pickLine(e){
  const {p,stat}=e,vol=stat==="passYds"?"":p.pos==="RB"&&stat==="rushYds"?` · ${p.car.toFixed(1)} car`:` · ${p.tgt.toFixed(1)} tgt`;
  const ref=e.refKind==="line"?`line ${e.ref}`:`avg ${r1(e.ref,stat)}`;
  const price=e.price?` ${odds.fmtPrice(e.price.price)} ${e.price.book}`:"";
  return `${e.over?"OVER":"UNDER"} ${p.name} (${p.game}) ${LABEL[stat]} ${r1(e.proj,stat)} vs ${ref}, ${pct(e.prob)}${price}${vol}${p.status==="q"?" [Q]":""}`;
}
function bumpLines(players){
  return players.filter(p=>p.bump.t>=CFG.BUMP_TGT||p.bump.c>=CFG.BUMP_CAR).sort((a,b)=>(b.bump.t+b.bump.c)-(a.bump.t+a.bump.c))
    .map(p=>`${p.name} (${p.team}) +${p.bump.t>=CFG.BUMP_TGT?p.bump.t.toFixed(1)+" tgt":p.bump.c.toFixed(1)+" car"}${p.bump.from.length?` with ${p.bump.from.join(", ")} out`:""}`);
}
function tableMd(title,games){
  let md=`## ${title}\n\n| player | game | proj | recent avg | line | tgt | car | status |\n|---|---|---|---|---|---|---|---|\n`;
  for(const G of games)for(const p of G.players){
    const cells=Object.keys(p.stats).map(s=>`${LABEL[s]} ${r1(p.stats[s],s)}`).join(", ");
    const base=Object.keys(p.stats).map(s=>p.base[s]==null?"-":r1(p.base[s],s)).join(" / ");
    const ln=Object.keys(p.stats).map(s=>p.lines&&p.lines[s]?p.lines[s].line:"-").join(" / ");
    md+=`| ${p.name} (${p.pos}) | ${p.game} | ${cells} | ${base} | ${ln} | ${p.tgt.toFixed(1)} | ${p.car.toFixed(1)} | ${p.status||""} |\n`;
  }
  return md;
}

// Pull lines for the games holding our strongest candidates (Friday / optional game day).
// Returns stale prop offers found in freshly pulled events (every priced player, not just our projections).
async function attachLines(games,fresh){
  if(!odds.enabled())return [];
  const stale=[];
  const ids=await odds.eventIds(games.map(G=>G.g));
  const score=[];
  for(const G of games)for(const p of G.players)for(const s in p.stats){const e=evaluate(p,s,null);if(e)score.push([e.prob,G,p,s]);}
  score.sort((a,b)=>b[0]-a[0]);
  const want=new Map();   // game_id -> set of stats
  for(const [,G,,s] of score.slice(0,CFG.ODDS_TOP)){if(!want.has(G.g.game_id)&&want.size>=CFG.ODDS_MAX_EVENTS)continue;
    (want.get(G.g.game_id)||want.set(G.g.game_id,new Set()).get(G.g.game_id)).add(s);}
  for(const G of games){
    const ev=ids[G.g.game_id];if(!ev)continue;
    let lines=fresh&&want.has(G.g.game_id)?await odds.eventLines(ev,[...want.get(G.g.game_id)]):null;
    if(lines)for(const st of Object.values(lines))for(const [stat,l] of Object.entries(st)){
      for(const x of SH.bestPerSide(SH.staleTwoWay(l.offers||[],{sigma:M.sdOf(stat,l.line),maxGap:CFG.STALE_GAP[stat],minEV:CFG.MIN_EV})).slice(0,1))
        stale.push({...x,stat,name:l.name,game:`${G.g.away_team}@${G.g.home_team}`,gid:G.g.game_id});}
    if(!lines)lines=odds.storedLines(ev);if(!lines)continue;
    for(const p of G.players){const l=lines[normName(p.name)];if(l)p.lines=l;}
  }
  return stale.sort((a,b)=>b.ev-a.ev);
}
const staleLine=x=>{const side=x.side==="A"?"Over":"Under",ss=x.side==="A"?x.sharp.A:x.sharp.B;
  return `💰 ${x.name} (${x.game}) ${side} ${x.L} ${LABEL[x.stat]} at ${x.title} ${SH.fmt(x.price)}: fair ${(x.fair*100).toFixed(1)}%, +${(x.ev*100).toFixed(1)}% EV vs ${x.sharp.title} ${side} ${ss.L} ${SH.fmt(ss.price)}`;};
// what a live alert contained, for grading / closing-line value later (results tracker format: sport + date)
// games = the projectGame results in the alert: every pick carries its game's context and, for model picks,
// the player's situation (teammates out, usage bump, injury status, projected snap share...) - see context.js
function logPicks(ctx,kind,evals,stale,games){
  const date=etParts().date,key=`picks-${date}.json`,at=new Date().toISOString();
  const G=Object.fromEntries((games||[]).map(x=>[x.g.game_id,x]));
  const gctx=gid=>{const x=G[gid];if(!x)return {model_version:VERSIONS["nfl-props"]};
    const w=windBucket(x.wx);return {...gameContext(x.g,x.wx),model_version:VERSIONS["nfl-props"],tags:w?[{tag:w,team:null}]:[]};};
  const pctx=e=>{const p=e.p,c=gctx(p.gid),side=G[p.gid]&&G[p.gid].sides.find(s=>s.team===p.team),tags=[...(c.tags||[])];
    if(p.bump.t>=0.5||p.bump.c>=1)tags.push({tag:"teammate_out",team:p.team,players:p.bump.from});
    if(p.status==="q")tags.push({tag:"questionable",team:p.team});
    if(side&&side.qbChanged)tags.push({tag:"qb_changed",team:p.team});
    return {...c,tags,player:{status:p.status||"",proj_snap:p.snap,t_share:p.tShare,c_share:p.cShare,tgt:p.tgt,car:p.car,
      bump_tgt:p.bump.t,bump_car:p.bump.c,teammates_out:p.bump.from,matchup:p.ctx.matchup,man_zone:p.ctx.mz??null,qb_factor:p.ctx.qbFactor}};};
  const rows=[...evals.filter(e=>e.refKind==="line").map(e=>({kind:"model",market:e.stat,player:e.p.name,playerId:e.p.id,game:e.p.gid,
      side:e.over?"Over":"Under",point:e.ref,price:e.price?e.price.price:null,book:e.price?e.price.book:null,proj:e.proj,prob:e.prob,ctx:pctx(e)})),
    ...stale.map(x=>({kind:"stale",market:x.stat,player:x.name,game:x.gid,side:x.side==="A"?"Over":"Under",point:x.L,price:x.price,book:x.key,fair:x.fair,ev:x.ev,
      sharp:`${x.sharp.key} ${(x.side==="A"?x.sharp.A:x.sharp.B).L} ${(x.side==="A"?x.sharp.A:x.sharp.B).price}`,ctx:gctx(x.gid)}))];
  if(rows.length)writeState(key,(readState(key)||[]).concat(rows.map(r=>({sport:"nfl",bot:"nfl-props",date,at,alert:kind,week:ctx.week,...r}))));
}

// ---------- weekly alert (Wednesday / Friday) ----------
async function weekly(ctx,kind,games){
  const G=[];for(const g of games)G.push(await projectGame(ctx,g));
  const stale=kind==="fri"?await attachLines(G,true):[];
  const evals=[];
  for(const x of G)for(const p of x.players)for(const s in p.stats){const e=evaluate(p,s,p.lines);if(e&&e.ok)evals.push(e);}
  evals.sort((a,b)=>b.prob-a.prob);
  const seen=new Set(),top=evals.filter(e=>!seen.has(e.p.id)&&seen.add(e.p.id)).slice(0,CFG.TOP_N);   // one line per player
  const bumps=bumpLines(G.flatMap(x=>x.players)).slice(0,6);
  const wind=G.filter(x=>x.wx&&!x.wx.indoor&&x.wx.wind>=CFG.WIND_NOTE).map(x=>`${x.g.away_team}@${x.g.home_team}: ${W.wxText(x.wx)}`);
  const qb=G.flatMap(x=>x.sides).filter(s=>s.qbChanged).map(s=>`${s.team} QB: ${s.qb||"unknown"}`);
  const label=kind==="wed"?"first projections":"post-injury-report update";
  let msg=top.length?top.map((e,i)=>`${i+1}. ${pickLine(e)}`).join("\n"):"Nothing clears the edge bar yet.";
  if(bumps.length)msg+=`\n\nUsage bumps:\n${bumps.join("\n")}`;
  if(qb.length)msg+=`\n\nQB changes: ${qb.join("; ")}`;
  if(wind.length)msg+=`\n\nWind: ${wind.join("; ")}`;
  if(stale.length)msg+=`\n\nStale prices at your books:\n${stale.slice(0,CFG.STALE_N).map(staleLine).join("\n")}`;
  const hasLines=top.some(e=>e.refKind==="line");
  msg+=hasLines?"":"\n\n(\"avg\" = his last-4-game average; compare with your book's line.)";
  const ok=await ntfy(`NFL props W${ctx.week}: ${label} (${top.length}${stale.length?`, ${stale.length} stale`:""})`,msg+(RUN_URL?"\n\nTap for every projection.":""),top.length?4:2,["football","chart_with_upwards_trend"],RUN_URL);
  summary(tableMd(`NFL week ${ctx.week} projections (${label})`,G));
  if(LIVE&&ok){
    logPicks(ctx,kind,top,stale.slice(0,CFG.STALE_N),G);
    const snap={kind,games:{}};
    for(const x of G)snap.games[x.g.game_id]={wx:x.wx,qb:x.sides.map(s=>s.qb),
      out:x.sides.flatMap(s=>s.out.map(o=>o.id)),players:Object.fromEntries(x.players.map(p=>[p.id,{name:p.name,stats:p.stats,status:p.status}]))};
    writeState(`proj-${ctx.S}-w${ctx.week}.json`,snap);
  }
  return ok;
}

// ---------- Sunday parlay (one push, PARLAY_HOUR ET on Sundays: 11:45 AM, after the 1 PM games' inactives) ----------
// The best PARLAY_LEGS legs from different Sunday games (nfl-props/parlay.js, shared with the NBA Saturday parlay). Each
// leg is a prop at your book's number and price (MY_BOOKS), its chance a PARLAY_MARKET_W blend of the model and the
// market's no-vig price (SportsGameOdds consensus; Pinnacle when there is one). Logged as one pick (kind "parlay") with
// its legs; nfl-lines/grade.js grades it leg by leg on Tuesday.
const PL=require("./parlay");
async function sundayParlay(ctx,games){
  const G=[];for(const g of games)G.push(await projectGame(ctx,g));
  const ids=await odds.eventIds(G.map(x=>x.g)),legs=[];
  for(const x of G){
    const ev=ids[x.g.game_id];if(!ev)continue;
    const lines=await odds.eventLines(ev,Object.keys(LABEL));if(!lines)continue;
    for(const p of x.players){
      const L=lines[normName(p.name)];if(!L)continue;p.lines=L;
      for(const s in p.stats){
        const e=evaluate(p,s,p.lines);if(!e||e.refKind!=="line"||!e.price||e.prob<0.5)continue;
        const l=L[s],side=e.over?"A":"B";
        const f=SH.staleTwoWay(l.offers||[],{sigma:M.sdOf(s,l.line),maxGap:CFG.STALE_GAP[s],minEV:-1}).find(o=>SH.MINE.includes(o.key)&&o.side===side&&o.L===e.ref);
        const kp=f?f.fair:null,pb=kp!=null?CFG.PARLAY_MARKET_W*e.prob+(1-CFG.PARLAY_MARKET_W)*kp:e.prob;
        legs.push({game:x.g.game_id,p:pb,modelP:e.prob,mktP:kp,price:e.price.price,book:e.price.book,e,kick:x.kick,mkt:f?f.sharp.title:null});
      }
    }
  }
  const pl=PL.build(legs,CFG.PARLAY_LEGS);
  if(!pl){log(`Sunday parlay: fewer than ${CFG.PARLAY_LEGS} games with a priced leg (${new Set(legs.map(l=>l.game)).size})`);return false;}
  const late=pl.legs.filter(l=>etParts(new Date(l.kick)).h>=15).length;
  const msg=pl.legs.map((l,i)=>`${i+1}. ${l.e.over?"OVER":"UNDER"} ${l.e.p.name} (${l.e.p.game}) ${LABEL[l.e.stat]} ${l.e.ref} ${odds.fmtPrice(l.price)} ${l.book} · ${pct(l.p)}`+
      ` (model ${pct(l.modelP)}${l.mktP!=null?`, ${l.mkt} ${pct(l.mktP)}`:""})`).join("\n")+`\n${PL.summary(pl)}`+
    (late?`\n${late} leg${late>1?"s are":" is"} in a late game: its inactives aren't out yet, so check that game's alert before kickoff.`:"");
  const ok=await ntfy(`NFL W${ctx.week} Sunday 🎯 ${pl.n}-leg parlay`,msg,4,["football","dart"]);
  if(LIVE&&ok){const date=etParts().date,key=`picks-${date}.json`;
    writeState(key,(readState(key)||[]).concat([{sport:"nfl",bot:"nfl-props",date,at:new Date().toISOString(),alert:"parlay",week:ctx.week,kind:"parlay",
      decimal:+pl.decimal.toFixed(3),american:pl.american,p:+pl.p.toFixed(4),ev:+pl.ev.toFixed(3),ctx:{model_version:VERSIONS["nfl-props"]},
      legs:pl.legs.map(l=>({player:l.e.p.name,playerId:l.e.p.id,game:l.game,market:l.e.stat,side:l.e.over?"Over":"Under",point:l.e.ref,price:l.price,book:l.book,p:+l.p.toFixed(3),modelP:+l.modelP.toFixed(3),mktP:l.mktP==null?null:+l.mktP.toFixed(3)}))}]));}
  return ok;
}

// ---------- game-day alert (~90 min before kickoff, when inactives post) ----------
async function gameday(ctx,g){
  const x=await projectGame(ctx,g);let stale=[];
  const snap=((readState(`proj-${ctx.S}-w${g.week}.json`)||{}).games||{})[g.game_id];
  if(odds.enabled()){
    if(CFG.ODDS_ON_GAMEDAY)stale=await attachLines([x],true);else await attachLines([x],false);   // Friday's prices are too old to call stale
  }
  const notes=[];
  // who is out now that wasn't when the weekly projections went out, and who gains
  const outNow=x.sides.flatMap(s=>s.out).filter(o=>(o.tShare>0.08||o.cShare>0.15)&&(!snap||!snap.out.includes(o.id)));
  if(outNow.length)notes.push(`Out: ${outNow.map(o=>`${o.name} (${o.pos})`).join(", ")}`);
  for(const s of x.sides)if(snap&&snap.qb&&!snap.qb.includes(s.qb))notes.push(`${s.team} QB now ${s.qb}`);
  const moves=[];
  for(const p of x.players){
    const before=snap&&snap.players[p.id];
    for(const s in p.stats){
      if(before&&before.stats[s]!=null){const d=p.stats[s]-before.stats[s];
        if(Math.abs(d)>=Math.max(CFG.GD_DELTA_PCT*before.stats[s],CFG.GD_DELTA_ABS[s]))moves.push([Math.abs(d)/Math.max(before.stats[s],1),
          `${p.name} ${LABEL[s]} ${r1(before.stats[s],s)} → ${r1(p.stats[s],s)}`]);}
    }
    if(!snap&&(p.bump.t>=CFG.BUMP_TGT||p.bump.c>=CFG.BUMP_CAR))moves.push([1,bumpLines([p])[0]]);
  }
  moves.sort((a,b)=>b[0]-a[0]);
  if(moves.length)notes.push(`Usage/projection moves:\n${moves.slice(0,8).map(m=>m[1]).join("\n")}`);
  const w0=snap&&snap.wx,w1=x.wx;
  if(w1&&!w1.indoor){
    const changed=w0&&!w0.indoor&&(Math.abs(w1.wind-w0.wind)>=CFG.GD_WIND_DELTA||(w1.wind>=CFG.WIND_NOTE)!==(w0.wind>=CFG.WIND_NOTE));
    if(changed)notes.push(`Weather: ${W.wxText(w1)} (was ${W.wxText(w0)})`);
    else if(!w0&&w1.wind>=CFG.WIND_NOTE)notes.push(`Weather: ${W.wxText(w1)}`);
  }
  const evals=[];for(const p of x.players)for(const s in p.stats){const e=evaluate(p,s,p.lines);if(e&&e.ok)evals.push(e);}
  evals.sort((a,b)=>b.prob-a.prob);
  const matchup=`${g.away_team} @ ${g.home_team}`,t=etClock(x.kick);
  if(!notes.length&&!evals.length&&!stale.length&&!CFG.GD_ALWAYS){log(`${matchup}: no changes since the weekly projections`);return true;}
  let msg=notes.join("\n\n");
  if(evals.length)msg+=(msg?"\n\n":"")+`Edges:\n${evals.slice(0,6).map(pickLine).join("\n")}`;
  if(stale.length)msg+=(msg?"\n\n":"")+`Stale prices at your books:\n${stale.slice(0,CFG.STALE_N).map(staleLine).join("\n")}`;
  if(!snap)msg+="\n\n(no Wed/Fri snapshot for this game - showing current projections only)";
  summary(tableMd(`${matchup} game-day projections`,[x]));
  const ok=await ntfy(`${matchup} ${t} ET: inactives check`,msg||"No changes.",notes.length||stale.length?4:3,["football"],RUN_URL);
  if(LIVE&&ok)logPicks({...ctx,week:g.week},"gameday",evals,stale.slice(0,CFG.STALE_N),[x]);
  return ok;
}

// ---------- one check: send whatever is due now ----------
// Returns ms until the next thing worth waking up for (game-day window or today's weekly alert), or null.
async function tick(){
  const now=Date.now(),et=etParts(new Date(now));
  const S=+et.date.slice(0,4)-(+et.date.slice(5,7)<3?1:0);
  const inWindow=g=>{const m=(g.kick-now)/6e4;return m>=CFG.GD_MIN&&m<=CFG.GD_MAX;};
  // refresh the schedule (and its lines) at least hourly when a game is close
  let sched=await scheduleFor(S,6);
  if(sched.some(g=>g.result===""&&g.kick>now&&g.kick-now<3*36e5))sched=await scheduleFor(S,1);
  const upcoming=sched.filter(g=>g.result===""&&g.kick>now).sort((a,b)=>a.kick-b.kick);
  if(!upcoming.length){log(`${et.date}: no upcoming ${S} games`);return null;}
  const week=upcoming[0].week;
  if(upcoming[0].kick-now>9*24*36e5){log(`${et.date}: next game is more than 9 days away (week ${week})`);return null;}
  const weekGames=upcoming.filter(g=>g.week===week);
  const sentKey=`sent-${S}-w${week}.json`,sent=readState(sentKey)||{games:{}};
  // when to wake next: the next game's alert window, or today's Wednesday/Friday alert hour
  const waits=[Math.max(0,upcoming[0].kick-CFG.GD_MAX*6e4-now)];
  for(const [day,hr,k] of [["Wed",CFG.WED_HOUR,"wed"],["Fri",CFG.FRI_HOUR,"fri"]])
    if(et.wd===day&&!sent[k])waits.push(Math.max(0,etToUtc(et.date,`${hr}:00`).getTime()-now));
  const ph=`${Math.floor(CFG.PARLAY_HOUR)}:${String(Math.round((CFG.PARLAY_HOUR%1)*60)).padStart(2,"0")}`;
  if(et.wd==="Sun"&&!sent.parlay)waits.push(Math.max(0,etToUtc(et.date,ph).getTime()-now));
  const hint=Math.min(...waits);

  let kind=null,gd=[],parlay=false;
  // Sunday games still to kick off (manual MODE=parlay on another day: the week's Sunday games)
  const sunday=()=>weekGames.filter(g=>etParts(new Date(g.kick)).wd==="Sun"&&g.kick>now+10*6e4&&(MODE==="parlay"||etParts(new Date(g.kick)).date===et.date));
  if(MODE==="auto"){
    parlay=et.wd==="Sun"&&et.h+et.m/60>=CFG.PARLAY_HOUR&&!sent.parlay&&sunday().length>0;
    if(et.wd==="Wed"&&et.h>=CFG.WED_HOUR&&!sent.wed)kind="wed";
    else if(et.wd==="Fri"&&et.h>=CFG.FRI_HOUR&&!sent.fri)kind="fri";
    gd=upcoming.filter(g=>inWindow(g)&&!sent.games[g.game_id]);
  }else if(MODE==="wed"||MODE==="fri")kind=MODE;
  else if(MODE==="parlay")parlay=true;
  else if(MODE==="gameday"){
    const pick=process.env.GAME?sched.filter(g=>g.game_id===process.env.GAME):upcoming.filter(inWindow);
    gd=pick.length?pick:upcoming.slice(0,1);
  }else throw new Error(`Unknown MODE "${MODE}" (auto, wed, fri, gameday, parlay)`);
  log(`${et.wd} ${et.date} ${et.h}:${String(et.m).padStart(2,"0")} ET, week ${week}, mode=${MODE}${DRY?" (dry run)":""}: weekly=${kind||"-"}, game-day=${gd.map(g=>g.game_id).join(",")||"-"}${parlay?", Sunday parlay":""}`);
  if(!kind&&!gd.length&&!parlay)return hint;

  const DB=await data.load(S);
  const ctx={DB,S,week,depth:await data.depthCharts(S),inj:await data.injuryReport(S,week),sl:await data.sleeper(gd.length?1:12)};
  if(kind){
    const ok=await weekly(ctx,kind,weekGames);
    if(LIVE&&ok){sent[kind]=true;writeState(sentKey,sent);}
  }
  if(parlay){
    const ok=await sundayParlay(ctx,sunday());
    if(LIVE&&ok){sent.parlay=true;writeState(sentKey,sent);}
  }
  for(const g of gd){
    const c={...ctx};if(g.week!==week){c.week=g.week;c.inj=await data.injuryReport(S,g.week);}
    const ok=await gameday(c,g);
    if(LIVE&&ok&&MODE==="auto"){const k=`sent-${S}-w${g.week}.json`,s=readState(k)||{games:{}};s.games[g.game_id]=true;writeState(k,s);}
  }
  if(odds.enabled()){const u=odds.usage();log(`Odds API credits: used ${u.used} this month, ${u.remaining??"?"} remaining`);}
  return hint;
}

// ---------- run loop ----------
// Scheduled runs keep going for LOOP_MIN minutes, waking for each alert window. GitHub runs frequent crons
// only every few hours on busy days (Sep 27, 2026: 3 of 4 game-day windows missed with a 15-minute cron),
// so a few long, overlapping runs replace them. Manual runs (LOOP_MIN=0) check once and exit.
const LOOP_MIN=env("LOOP_MIN",0),LOOP_EVERY=env("LOOP_EVERY",5);
async function errorAlert(e){
  console.error(e);process.exitCode=1;
  // at most one error push every 6 hours, so a broken feed doesn't buzz the phone all day
  const last=readState("error-alert.json",6);
  if(!last&&LIVE){await ntfy("NFL props bot error",String(e.message||e),2,["warning"]).catch(()=>{});writeState("error-alert.json",true);}
}
(async()=>{
  const t0=Date.now();
  for(;;){
    let next=null;
    try{next=await tick();}catch(e){await errorAlert(e);if(!LOOP_MIN)return;next=0;}
    const left=LOOP_MIN*6e4-(Date.now()-t0);
    if(left<=LOOP_EVERY*6e4)break;
    if(next==null||next>left-6e4){log(`nothing due in the remaining ${Math.round(left/6e4)} min of this run`);break;}
    const wait=next>LOOP_EVERY*6e4?next:LOOP_EVERY*6e4;   // sleep until the next window opens, else re-check in a few minutes
    log(`next check in ${Math.round(wait/6e4)} min`);await new Promise(r=>setTimeout(r,wait));
  }
})().catch(errorAlert);

