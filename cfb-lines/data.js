// CFBD data for one season, normalized into small plain objects the model uses.
// Call cost per season is ~8 calls (plus 1 per week for QB box scores); everything is cached.
const cfbd=require("./cfbd");

const POST=20;   // postseason weeks are stored as 20+week so they sort after the regular season
const wkOf=g=>(g.seasonType==="postseason"?POST:0)+(+g.week||0);

// ttl: a finished season never changes; the current one refreshes on these hour counts.
const ttl=(S,cur,h)=>S<cur?Infinity:h;

async function games(S,cur){
  const out=[];
  // the current season's bowl schedule only matters from December; skip that call before then
  const types=S===cur&&new Date().getUTCMonth()>=7&&new Date().getUTCMonth()<11?["regular"]:["regular","postseason"];
  for(const st of types){
    const rows=await cfbd.get("/games",{year:S,seasonType:st},ttl(S,cur,6))||[];
    for(const g of rows){
      const fbs=c=>String(c||"").toLowerCase()==="fbs";
      out.push({id:g.id,S,wk:wkOf(g),start:Date.parse(g.startDate),tbd:!!g.startTimeTBD,neutral:!!g.neutralSite,
        conf:!!g.conferenceGame,venueId:g.venueId,venue:g.venue,home:g.homeTeam,away:g.awayTeam,
        homeFBS:fbs(g.homeClassification),awayFBS:fbs(g.awayClassification),
        hp:g.homePoints??null,ap:g.awayPoints??null,done:!!g.completed&&g.homePoints!=null});
    }
  }
  return out.sort((a,b)=>a.start-b.start);
}

// Opponent-adjustable box: one row per team per game (its offense; the opponent's defense).
async function advanced(S,cur){
  const rows=await cfbd.get("/stats/game/advanced",{year:S,excludeGarbageTime:true},ttl(S,cur,12))||[];
  return rows.filter(r=>r.offense&&r.offense.plays).map(r=>({gid:r.gameId,wk:wkOf({week:r.week,seasonType:r.seasonType}),team:r.team,opp:r.opponent,
    ppa:+r.offense.ppa||0,sr:+r.offense.successRate||0,ex:+r.offense.explosiveness||0,pl:+r.offense.plays||0}));
}

// Lines per game: every book's current (closing, for past games) and opening numbers, home perspective.
// CFBD's spread is the home line (negative = home favored); we store the home *margin* the book implies.
function normLines(rows){
  const out={};
  for(const g of rows||[]){
    const L=(g.lines||[]).filter(l=>l.spread!=null||l.overUnder!=null).map(l=>({book:l.provider,
      m:l.spread==null?null:-l.spread,mOpen:l.spreadOpen==null?null:-l.spreadOpen,
      t:l.overUnder==null?null:+l.overUnder,tOpen:l.overUnderOpen==null?null:+l.overUnderOpen}));
    if(L.length)out[g.id]=L;
  }
  return out;
}
async function lines(S,cur,week,h=1){
  if(week!=null){const post=week>=POST;
    return normLines(await cfbd.get("/lines",{year:S,week:post?week-POST:week,seasonType:post?"postseason":"regular"},ttl(S,cur,h)));}
  const out={};
  for(const st of ["regular","postseason"])Object.assign(out,normLines(await cfbd.get("/lines",{year:S,seasonType:st},ttl(S,cur,6))));
  return out;
}
const median=a=>{const v=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y);if(!v.length)return null;const k=v.length>>1;return v.length%2?v[k]:(v[k-1]+v[k])/2;};
function consensus(L){
  if(!L)return null;
  return {m:median(L.map(l=>l.m)),mOpen:median(L.map(l=>l.mOpen)),t:median(L.map(l=>l.t)),tOpen:median(L.map(l=>l.tOpen)),books:L.map(l=>l.book)};
}

async function teams(S,cur){
  const rows=await cfbd.get("/teams/fbs",{year:S},ttl(S,cur,24*30))||[];
  const out={};
  for(const t of rows){const l=t.location||{};
    out[t.school]={id:t.id,conf:t.conference,abbr:t.abbreviation||t.school,lat:+l.latitude||null,lon:+l.longitude||null,
      elev:+l.elevation||0,tz:l.timezone||null,venueId:l.id??null};}
  return out;
}
async function venues(){
  const rows=await cfbd.get("/venues",{},24*60)||[];
  const out={};
  for(const v of rows)out[v.id]={name:v.name,lat:+v.latitude||null,lon:+v.longitude||null,elev:+v.elevation||0,
    tz:v.timezone||null,cap:+v.capacity||0,dome:!!v.dome,city:v.city,state:v.state};
  return out;
}
async function talent(S,cur){
  const rows=await cfbd.get("/talent",{year:S},ttl(S,cur,24*30))||[];
  const out={};for(const r of rows)out[r.team||r.school]=+r.talent;return out;
}
async function returning(S,cur){
  const rows=await cfbd.get("/player/returning",{year:S},ttl(S,cur,24*30))||[];
  const out={};for(const r of rows)out[r.team]={ppa:+r.percentPPA,pass:+r.percentPassingPPA,usage:+r.usage};return out;
}

// Passing box scores for one week -> {gameId: {team: [{id,name,att}] sorted by attempts}}.
async function passers(S,cur,wk,h=24*30){
  const post=wk>=POST;
  const rows=await cfbd.get("/games/players",{year:S,week:post?wk-POST:wk,seasonType:post?"postseason":"regular",category:"passing"},ttl(S,cur,h))||[];
  const out={};
  for(const g of rows){const G=out[g.id]={};
    for(const t of g.teams||[]){const qbs=[];
      for(const c of t.categories||[])for(const ty of c.types||[])if(/C\/ATT/i.test(ty.name))
        for(const a of ty.athletes||[]){const att=+String(a.stat).split("/")[1]||0;if(att>0)qbs.push({id:String(a.id),name:a.name,att});}
      G[t.team||t.school]=qbs.sort((x,y)=>y.att-x.att);}
  }
  return out;
}

// Offensive usage share per player (to weight a skill-player absence). One call per season.
async function usage(S,cur){
  const rows=await cfbd.get("/player/usage",{year:S},ttl(S,cur,24*3))||[];
  const out={};for(const r of rows){const u=r.usage||{};out[String(r.id)]={name:r.name,team:r.team,pos:r.position,u:+u.overall||0};}
  return out;
}

// Share of team tackles per defender (a rough "is he a starter, and how much" weight). One call per season.
async function tackles(S,cur){
  const rows=await cfbd.get("/stats/player/season",{year:S,category:"defensive"},ttl(S,cur,24*3))||[];
  const tot={},by={};
  for(const r of rows)if(r.statType==="TOT"){const v=+r.stat||0;tot[r.team]=(tot[r.team]||0)+v;by[String(r.playerId)]={name:r.player,team:r.team,v};}
  const out={};for(const [id,x] of Object.entries(by))out[id]={name:x.name,team:x.team,share:tot[x.team]?x.v/tot[x.team]:0};
  return out;
}

module.exports={games,advanced,lines,consensus,teams,venues,talent,returning,passers,usage,tackles,median,POST};
