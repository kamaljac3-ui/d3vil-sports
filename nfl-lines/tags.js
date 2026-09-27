// Situational tags backed by nfl-lines/research/travel-climate.js (1999-2025, vs. the closing spread).
// Informational only: they don't change the model's numbers.
const W=require("../nfl-props/weather");
const {parseCSV,getText,log,normName}=require("../nfl-props/lib");
const NV="https://github.com/nflverse/nflverse-data/releases/download";

// Warm-weather outdoor home cities (average >= 60°F in Dec-Jan); dome/retractable teams are detected from their home games.
const WARM_OUTDOOR=new Set(["MIA","TB","JAX"]);

// Is this team's home stadium indoors this season? (majority of its home games)
function domeTeam(sched,team,season){
  const h=sched.filter(g=>g.season===season&&g.home_team===team&&g.location!=="Neutral");
  if(!h.length)return false;
  return h.filter(g=>W.indoor(g)).length>h.length/2;
}

// Warm-weather or dome visitor playing outdoors in December/January.
// Research: 45.6% ATS 1999-2025 (668 games), 43.2% 1999-2011, 47.6% 2012-2025 (~break-even to fade now),
// playoffs 38.0% (79 games). Freezing temperature adds nothing beyond the time of year.
function lateSeasonTag(sched,g){
  const m=+g.gameday.slice(5,7);
  if((m!==12&&m!==1)||g.location==="Neutral"||W.indoor(g))return null;
  const v=g.away_team;
  const warm=WARM_OUTDOOR.has(v),dome=domeTeam(sched,v,g.season);
  if(!warm&&!dome)return null;
  const po=g.game_type!=="REG";
  return `⚠️ ${v} (${dome?"dome":"warm-weather"} team) outdoors in ${m===12?"Dec":"Jan"}: such visitors covered 45.6% since 1999, `+
    `47.6% since 2012${po?", 38% in playoffs (79 games)":""}`;
}

// ---------- missing starters ----------
// Research (closing lines, regular season 2013-2025):
//  research/cb-replacement.js    defense missing a starting CB: offenses covered 54.2% in 2020-25 (650), 48.1% in 2013-19;
//                                61.8% with 2+ out (103). No effect on the top receiver's yards.
//  research/position-absences.js offense missing 2+ starting OL: covered 43.9% (364; 45.2% 2013-19, 42.9% 2020-25),
//                                -9 pass yds, +0.22 sacks. Defense missing a starting DL/LB vs a run-heavy offense
//                                (top third in rushing yds/g, >= 122): offense ran +8 yds, scored +1.4 pts over its
//                                implied team total (507 games) but covered only 49.3%.
// Starter = at least the group's snap share in 2 of the team's last 3 games this season (nflverse snap counts).
const GROUPS={OL:{pos:["T","G","C","OL"],side:"off",thr:0.8},DL:{pos:["DE","DT","NT","DL"],side:"def",thr:0.55},
  LB:{pos:["LB","OLB","ILB","MLB"],side:"def",thr:0.6},CB:{pos:["CB"],side:"def",thr:0.7}};
const GROUP_OF=Object.fromEntries(Object.entries(GROUPS).flatMap(([g,v])=>v.pos.map(p=>[p,g])));
async function loadStarters(S){
  const [sn,ro,st]=await Promise.all([getText(`${NV}/snap_counts/snap_counts_${S}.csv`),getText(`${NV}/rosters/roster_${S}.csv`),
    getText(`${NV}/stats_player/stats_player_week_${S}.csv.gz`)]);
  const byPfr={},byName={};
  for(const r of parseCSV(ro||"",["gsis_id","pfr_id","full_name","team"])){if(r.pfr_id)byPfr[r.pfr_id]=r.gsis_id;byName[r.full_name.toLowerCase()+"|"+r.team]=r.gsis_id;}
  const games={};   // team -> {game_id: {week, p: {pfr: {group, pct, name, gsis}}}}
  for(const r of parseCSV(sn||"",["game_id","week","position","team","pfr_player_id","player","offense_pct","defense_pct"])){
    const grp=GROUP_OF[r.position];if(!grp)continue;
    const t=games[r.team]||(games[r.team]={}),g=t[r.game_id]||(t[r.game_id]={week:+r.week,p:{}});
    g.p[r.pfr_player_id]={group:grp,pct:GROUPS[grp].side==="off"?+r.offense_pct:+r.defense_pct,name:r.player,
      gsis:byPfr[r.pfr_player_id]||byName[r.player.toLowerCase()+"|"+r.team]||null};
  }
  const rush={};   // team -> {game_id: {week, y}} rushing yards this season
  for(const r of parseCSV(st||"",["game_id","team","week","rushing_yards"])){if(!r.game_id)continue;
    const t=rush[r.team]||(rush[r.team]={});t[r.game_id]=t[r.game_id]||{week:+r.week,y:0};t[r.game_id].y+=+r.rushing_yards||0;}
  log(`starter snaps ${S}: ${Object.keys(games).length} teams`);
  return {games,rush};
}
function starters(ST,team,week,group){
  const prev=Object.values(ST.games[team]||{}).filter(g=>g.week<week).sort((a,b)=>b.week-a.week).slice(0,3);
  if(prev.length<2)return [];
  const thr=GROUPS[group].thr,ids=new Set(prev.flatMap(g=>Object.keys(g.p).filter(id=>g.p[id].group===group)));
  return [...ids].filter(id=>prev.filter(g=>g.p[id]&&g.p[id].pct>=thr).length>=2)
    .map(id=>{const any=prev.find(g=>g.p[id]);return {pfr:id,name:any.p[id].name,gsis:any.p[id].gsis};});
}
// sl = trimmed Sleeper (gsis ids, plus "n:<name>|<team>" for linemen/LBs/DBs), inj = nflverse injury report Map(gsis -> status)
function missing(ST,team,week,group,sl,inj){
  return starters(ST,team,week,group).filter(p=>{
    const s=(p.gsis&&sl[p.gsis])||sl["n:"+normName(p.name)+"|"+team],ri=p.gsis?inj.get(p.gsis)||"":"";
    if(!s&&!ri)return false;   // can't find him -> never assume he's out
    return (s&&s[0]&&s[0]!==team)||(s&&["Out","IR","PUP","Sus","NA","Doubtful"].includes(s[1]))||ri==="Out"||ri==="Doubtful";});
}
const RUN_HEAVY=122;   // rushing yds/g, top third of offenses 2013-2025
function absenceTags(ST,g,sl,inj){
  const out=[],names=l=>l.map(p=>p.name).join(" & ");
  for(const def of [g.home_team,g.away_team]){
    const off=def===g.home_team?g.away_team:g.home_team;
    const cb=missing(ST,def,g.week,"CB",sl,inj);
    if(cb.length)out.push(`⚠️ ${def} missing starting CB${cb.length>1?"s":""} ${names(cb)}: offenses in this spot covered 54.2% since 2020 (650 games), 48% in 2013-19${cb.length>1?"; 61.8% with 2+ out (103 games)":""}. Edge for ${off}? Unproven.`);
    const front=[...missing(ST,def,g.week,"DL",sl,inj),...missing(ST,def,g.week,"LB",sl,inj)];
    const r=Object.values(ST.rush[off]||{}).filter(x=>x.week<g.week),ypg=r.length>=2?r.reduce((a,x)=>a+x.y,0)/r.length:null;
    if(front.length&&ypg!=null&&ypg>=RUN_HEAVY)out.push(`⚠️ ${def} missing front-seven starter${front.length>1?"s":""} ${names(front)} vs run-heavy ${off} (${Math.round(ypg)} rush yds/g): such offenses ran +8 yds and scored +1.4 pts over their implied team total (507 games), but covered only 49%. Lean: ${off} team total over, not the spread.`);
  }
  for(const off of [g.home_team,g.away_team]){
    const ol=missing(ST,off,g.week,"OL",sl,inj);
    if(ol.length>=2)out.push(`⚠️ ${off} missing ${ol.length} starting O-linemen (${names(ol)}): offenses in this spot covered 43.9% (364 games; 45% in 2013-19, 43% since 2020), -9 pass yds, more sacks. Lean against ${off}? Unproven.`);
  }
  return out;
}

// ---------- windy games ----------
// Research (research/wind-direction.js, outdoor games 1999-2025, ERA5 wind at kickoff vs. the closing total):
// 12-16 mph 57.2% unders (530), 16+ 54.6% (219); crosswind 12+ 58.2% (216), crosswind 16+ 64.1% (66);
// along-field 12+ 54.9% (327). Measured on the wind that actually blew while the line closed on a forecast,
// so part of this is hindsight; the bot's ~90-minute forecast is close to, not the same as, what blew.
function windTag(wx){
  if(!wx||wx.indoor||!(wx.wind>=12))return null;
  const [pct,n,what]=wx.rel==="cross"?(wx.wind>=16?["64.1%",66,"16+ mph crosswinds"]:["58.2%",216,"12+ mph crosswinds"])
    :wx.rel==="along"?["54.9%",327,"12+ mph wind along the field"]
    :wx.wind>=16?["54.6%",219,"16+ mph wind"]:["57.2%",530,"12-16 mph wind"];
  return `⚠️ ${W.wxText(wx)}: games with ${what} went under the closing total ${pct} since 1999 (${n} games; partly hindsight)`;
}

module.exports={lateSeasonTag,domeTeam,WARM_OUTDOOR,loadStarters,starters,missing,absenceTags,windTag};
