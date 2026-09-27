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

// ---------- missing starting cornerbacks ----------
// Research (research/cb-replacement.js, closing lines, regular season): offenses facing a defense missing
// a starting CB beat the spread 54.2% in 2020-2025 (650 games, +1.4 pts) but 48.1% in 2013-2019;
// 61.8% when 2+ starters were out (103 games). No measurable effect on the top receiver's yards,
// so this is a game-lines tag only.
// Starter = CB with >= 70% of defensive snaps in at least 2 of the team's last 3 games this season.
async function loadCB(S){
  const [sn,ro]=await Promise.all([getText(`${NV}/snap_counts/snap_counts_${S}.csv`),getText(`${NV}/rosters/roster_${S}.csv`)]);
  const byPfr={},byName={};
  for(const r of parseCSV(ro||"",["gsis_id","pfr_id","full_name","team"])){if(r.pfr_id)byPfr[r.pfr_id]=r.gsis_id;byName[r.full_name.toLowerCase()+"|"+r.team]=r.gsis_id;}
  const games={};   // team -> {game_id: {week, cb: {pfr: {pct, name, gsis}}}}
  for(const r of parseCSV(sn||"",["game_id","week","position","team","pfr_player_id","player","defense_pct"])){
    if(r.position!=="CB")continue;const t=games[r.team]||(games[r.team]={}),g=t[r.game_id]||(t[r.game_id]={week:+r.week,cb:{}});
    g.cb[r.pfr_player_id]={pct:+r.defense_pct,name:r.player,gsis:byPfr[r.pfr_player_id]||byName[r.player.toLowerCase()+"|"+r.team]||null};
  }
  log(`CB snaps ${S}: ${Object.keys(games).length} teams`);
  return games;
}
function cbStarters(CB,team,week){
  const prev=Object.values(CB[team]||{}).filter(g=>g.week<week).sort((a,b)=>b.week-a.week).slice(0,3);
  if(prev.length<2)return [];
  const ids=new Set(prev.flatMap(g=>Object.keys(g.cb)));
  return [...ids].filter(id=>prev.filter(g=>(g.cb[id]||{}).pct>=0.7).length>=2)
    .map(id=>{const any=prev.find(g=>g.cb[id]);return {pfr:id,name:any.cb[id].name,gsis:any.cb[id].gsis};});
}
// sl = trimmed Sleeper {gsis: [team, injury_status, status]}, inj = nflverse injury report Map(gsis -> status)
function cbTags(CB,g,sl,inj){
  const out=[];
  for(const def of [g.home_team,g.away_team]){
    const offense=def===g.home_team?g.away_team:g.home_team;
    const missing=cbStarters(CB,def,g.week).filter(p=>{
      // Sleeper by gsis id, else by name on this team; if neither finds him on the team, he may have been cut/traded
      const s=(p.gsis&&sl[p.gsis])||sl["n:"+normName(p.name)+"|"+def],ri=p.gsis?inj.get(p.gsis)||"":"";
      if(!s&&!ri)return false;   // unknown -> don't claim he's missing
      return (s&&s[0]&&s[0]!==def)||(s&&["Out","IR","PUP","Sus","NA","Doubtful"].includes(s[1]))||ri==="Out"||ri==="Doubtful";});
    if(!missing.length)continue;
    const two=missing.length>=2;
    out.push(`⚠️ ${def} missing starting CB${two?"s":""} ${missing.map(p=>p.name).join(" & ")}: offenses in this spot covered 54.2% since 2020 (650 games), 48% in 2013-19${two?"; 61.8% with 2+ out (103 games)":""}. Edge for ${offense}? Unproven.`);
  }
  return out;
}

module.exports={lateSeasonTag,domeTeam,WARM_OUTDOOR,loadCB,cbStarters,cbTags};
