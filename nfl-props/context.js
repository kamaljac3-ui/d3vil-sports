// Context logged with every NFL pick (both bots), so the weekly review can grade picks by situation:
// does an angle (a tag, wind, rest, a teammate out...) actually help, judged by closing-line value first?
// Log it for EVERY pick, tagged or not, so each angle always has a "without" group to compare against.
const {etParts}=require("./lib");

// Bump a version whenever a model's numbers change, so grades can be split by version.
// History: nfl-props/LEARNINGS.md and nfl-lines/LEARNINGS.md.
const VERSIONS={"nfl-props":"props-2026.10.24","nfl-lines":"lines-2026.10.24"};

// g = nflverse schedule row (with .kick ms), wx = kickoff weather from weather.js (or null)
function gameContext(g,wx,now=Date.now()){
  const et=etParts(new Date(g.kick)),num=v=>v===""||v==null?null:+v;
  const hr=num(g.home_rest),ar=num(g.away_rest);
  return {
    week:g.week,mins_to_kick:Math.round((g.kick-now)/6e4),
    kick_et:`${et.wd} ${et.h}:${String(et.m).padStart(2,"0")}`,primetime:et.h>=19,
    div_game:g.div_game==="1",home_rest:hr,away_rest:ar,
    short_week:[hr!=null&&hr<=5?g.home_team:null,ar!=null&&ar<=5?g.away_team:null].filter(Boolean),
    spread:num(g.spread_line),total:num(g.total_line),
    indoor:!!(wx&&wx.indoor),wind:wx&&!wx.indoor?wx.wind:null,wind_rel:wx&&!wx.indoor?wx.rel||null:null,
    precip:wx&&!wx.indoor?wx.precip:null,temp:wx&&!wx.indoor?wx.temp:null,
  };
}

// wind bucket used by nfl-lines' wind tag (research/wind-direction.js), null below 12 mph or indoors
function windBucket(wx){
  if(!wx||wx.indoor||!(wx.wind>=12))return null;
  return wx.rel==="cross"?(wx.wind>=16?"wind_cross_16":"wind_cross_12"):wx.rel==="along"?"wind_along_12":wx.wind>=16?"wind_16":"wind_12_16";
}

module.exports={VERSIONS,gameContext,windBucket};
