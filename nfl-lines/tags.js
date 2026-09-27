// Situational tags backed by nfl-lines/research/travel-climate.js (1999-2025, vs. the closing spread).
// Informational only: they don't change the model's numbers.
const W=require("../nfl-props/weather");

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

module.exports={lateSeasonTag,domeTeam,WARM_OUTDOOR};
