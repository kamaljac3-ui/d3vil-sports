// Research, not a bot: do altitude, humidity, cold and late-season travel beat the closing line?
//   node nfl-lines/research/travel-climate.js      (FROM=1999 TO=2025)
// For each situation it reports the raw effect (margin / points vs. league norms) AND the
// market-adjusted effect (result vs. closing spread / implied team total). A factor is only
// useful to a bettor if the second number is reliably non-zero - the market prices the obvious.
// Weather at kickoff (dew point, temp) comes from Open-Meteo's free historical archive and is
// cached in nfl-lines/research/.cache (first run downloads ~1,000 small season files).
const fs=require("fs"),path=require("path");
const {parseCSV,getText,etToUtc,log,env}=require("../../nfl-props/lib");

const FROM=env("FROM",1999),TO=env("TO",2025);
const CACHE=path.join(__dirname,".cache");fs.mkdirSync(CACHE,{recursive:true});

const {ST}=require("./stadiums");   // stadium_id -> [lat, lon, elevation ft]
const INDOOR=r=>r==="dome"||r==="closed";

// ---------- weather archive ----------
async function seasonWeather(sid,season){
  const s=ST[sid];if(!s)return null;
  const key=`${s[0].toFixed(2)}_${s[1].toFixed(2)}_${season}.json`,p=path.join(CACHE,key);
  if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p,"utf8"));
  const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${s[0]}&longitude=${s[1]}&start_date=${season}-08-01&end_date=${season+1}-02-20`+
    `&hourly=temperature_2m,dew_point_2m&temperature_unit=fahrenheit&timezone=GMT`;
  for(let a=0;a<5;a++){
    const r=await fetch(url).catch(()=>null);
    if(r&&r.ok){const j=await r.json();const out={t0:Date.parse(j.hourly.time[0]+"Z"),temp:j.hourly.temperature_2m,dew:j.hourly.dew_point_2m};
      fs.writeFileSync(p,JSON.stringify(out));return out;}
    const wait=r&&r.status===429?60000:3000*(a+1);log(`archive ${r?r.status:"error"} for ${sid} ${season}, retrying in ${wait/1000}s`);
    await new Promise(x=>setTimeout(x,wait));
  }
  return null;
}
const at=(w,ms)=>{if(!w)return null;const i=Math.round((ms-w.t0)/36e5);return i>=0&&i<w.temp.length&&w.dew[i]!=null?{temp:w.temp[i],dew:w.dew[i]}:null;};

// ---------- stats ----------
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/(a.length-1));};
// rows: {ats (points beating the spread, team's perspective), pts (points vs implied team total), margin, tot (total vs line)}
function line(label,rows,{totals=false}={}){
  if(rows.length<15)return `| ${label} | ${rows.length} | (too few games) | | | |`;
  const a=rows.map(r=>r.ats),c=a.filter(x=>x!==0),cov=c.filter(x=>x>0).length/c.length;
  const se=sd(a)/Math.sqrt(a.length),m=mean(a),z=m/se;
  const tag=Math.abs(z)>=2.5?" **strong**":Math.abs(z)>=2?" *likely*":"";
  const extra=totals?`${mean(rows.map(r=>r.tot)).toFixed(1)} vs total line`:`${mean(rows.map(r=>r.pts)).toFixed(1)} pts vs implied`;
  return `| ${label} | ${rows.length} | ${mean(rows.map(r=>r.margin)).toFixed(1)} | ${m>=0?"+":""}${m.toFixed(1)} ± ${se.toFixed(1)}${tag} | ${(100*cov).toFixed(1)}% | ${extra} |`;
}
const HEAD=`| situation | games | avg margin | vs spread (pts ± SE) | cover % | scoring |\n|---|---|---|---|---|---|`;

(async()=>{
  const t=await getText("https://github.com/nflverse/nfldata/raw/master/data/games.csv");
  const G=parseCSV(t).filter(g=>+g.season>=FROM&&+g.season<=TO&&g.result!==""&&g.spread_line!==""&&g.total_line!=="")
    .map(g=>({...g,season:+g.season,week:+g.week,hs:+g.home_score,as:+g.away_score,spread:+g.spread_line,total:+g.total_line,
      kick:etToUtc(g.gameday,g.gametime||"13:00").getTime(),month:+g.gameday.slice(5,7)}));
  log(`${G.length} games ${FROM}-${TO}`);

  // each team's home stadium per season (most-used non-neutral venue)
  const home={};
  for(const g of G){if(g.location==="Neutral")continue;const k=g.home_team+"|"+g.season;(home[k]||(home[k]={}))[g.stadium_id]=(home[k][g.stadium_id]||0)+1;}
  const homeSid=(team,season)=>{const h=home[team+"|"+season];return h?Object.entries(h).sort((a,b)=>b[1]-a[1])[0][0]:null;};
  const homeRoof={};for(const g of G)if(g.location!=="Neutral")homeRoof[g.home_team+"|"+g.season]=g.roof;

  // weather at every game (kickoff + 1h) and each team's home climate
  let done=0;const need=new Set();
  for(const g of G)if(ST[g.stadium_id])need.add(g.stadium_id+"|"+g.season);
  for(const k of Object.keys(home)){const [team,s]=k.split("|");const sid=homeSid(team,+s);if(sid&&ST[sid])need.add(sid+"|"+s);}
  const W={};
  for(const k of need){const [sid,s]=k.split("|");W[k]=await seasonWeather(sid,+s);if(++done%100===0)log(`weather ${done}/${need.size}`);}
  for(const g of G)g.wx=at(W[g.stadium_id+"|"+g.season],g.kick+36e5);

  // climate of a team's home city in a given month (average of 1 PM ET-ish hours, all seasons)
  const clim={};
  for(const k of Object.keys(home)){
    const [team,s]=k.split("|"),sid=homeSid(team,+s),w=W[sid+"|"+s];if(!w)continue;
    for(let i=0;i<w.temp.length;i+=24){const ms=w.t0+(i+18)*36e5,m=new Date(ms).getUTCMonth()+1;
      if(w.dew[i+18]==null)continue;const c=clim[team+"|"+m]||(clim[team+"|"+m]={t:[],d:[]});c.t.push(w.temp[i+18]);c.d.push(w.dew[i+18]);}
  }
  const climOf=(team,m)=>{const c=clim[team+"|"+m];return c?{temp:mean(c.t),dew:mean(c.d)}:null;};

  // team-perspective rows
  const rows=[];
  for(const g of G)for(const isHome of [true,false]){
    const team=isHome?g.home_team:g.away_team,opp=isHome?g.away_team:g.home_team;
    const margin=isHome?g.hs-g.as:g.as-g.hs,exp=isHome?g.spread:-g.spread;
    const implied=(g.total+exp)/2,pts=isHome?g.hs:g.as;
    rows.push({g,team,opp,isHome,margin,ats:margin-exp,pts:pts-implied,tot:g.hs+g.as-g.total,
      homeSid:homeSid(team,g.season),domeTeam:["dome","closed"].includes(homeRoof[team+"|"+g.season]),
      climate:climOf(team,g.month),sept:climOf(team,9)});
  }
  const road=rows.filter(r=>!r.isHome&&r.g.location!=="Neutral");
  const allRoad=line("All road teams (baseline)",road);
  let md=`# Travel, altitude and climate vs. the closing line, ${FROM}-${TO}\n\n`+
    `"vs spread" = average points the team beat (+) or missed (-) the closing spread by. SE = standard error;\n`+
    `*likely* = about 2 SE from zero, **strong** = 2.5+. With ~20 comparisons, expect one *likely* by pure chance.\n`+
    `Break-even betting at -110 needs a 52.4% cover rate.\n\n${HEAD}\n${allRoad}\n`;

  // ---- 1. altitude: going up ----
  const hi=r=>r.g.stadium_id.startsWith("DEN")||r.g.stadium_id==="MEX00";
  const upVis=road.filter(r=>hi(r)&&!(r.homeSid||"").startsWith("DEN"));
  md+=`\n## 1. Traveling up to altitude (visitors at Denver, 5,280 ft)\n\n${HEAD}\n`+
    line("Visitors at Denver, all",upVis)+"\n"+
    line("  Sep-Oct",upVis.filter(r=>r.g.month>=9&&r.g.month<=10))+"\n"+
    line("  Nov-Jan",upVis.filter(r=>r.g.month>=11||r.g.month<=1))+"\n"+
    line("  on short rest (≤6 days)",upVis.filter(r=>+(r.g.away_rest||7)<=6))+"\n"+
    line("  from sea-level home (<500 ft)",upVis.filter(r=>(ST[r.homeSid]||[0,0,0])[2]<500))+"\n"+
    line(`  ${FROM}-2011`,upVis.filter(r=>r.g.season<=2011))+"\n"+line(`  2012-${TO}`,upVis.filter(r=>r.g.season>=2012))+"\n";
  const denHome=rows.filter(r=>r.isHome&&r.team==="DEN"&&r.g.location!=="Neutral"),allHome=rows.filter(r=>r.isHome&&r.g.location!=="Neutral");
  md+=`\nRaw home edge: Denver wins at home by ${mean(denHome.map(r=>r.margin)).toFixed(1)} pts on average vs ${mean(allHome.map(r=>r.margin)).toFixed(1)} for all home teams (${denHome.length} games), `+
    `win rate ${(100*denHome.filter(r=>r.margin>0).length/denHome.length).toFixed(0)}% vs ${(100*allHome.filter(r=>r.margin>0).length/allHome.length).toFixed(0)}%.\n`;
  md+=`Totals at Denver: ${line("Games at Denver",upVis,{totals:true}).split("|").slice(-2,-1)[0].trim()} (${upVis.length} games).\n`;

  // ---- 2. altitude: coming down ----
  const denRoad=road.filter(r=>r.team==="DEN");
  const after=[];   // teams in the game right after visiting Denver
  const byTeam={};for(const r of rows)(byTeam[r.team]||(byTeam[r.team]=[])).push(r);
  for(const list of Object.values(byTeam)){list.sort((a,b)=>a.g.kick-b.g.kick);
    for(let i=1;i<list.length;i++){const p=list[i-1];if(!p.isHome&&p.team!=="DEN"&&hi(p)&&p.g.season===list[i].g.season&&list[i].g.kick-p.g.kick<9*864e5)after.push(list[i]);}}
  md+=`\n## 2. Coming down from altitude\n\n${HEAD}\n`+line("Denver on the road",denRoad)+"\n"+
    line("  Denver road, Sep-Oct",denRoad.filter(r=>r.g.month>=9&&r.g.month<=10))+"\n"+
    line("  Denver road, to humid sites (dew ≥ 60°F)",denRoad.filter(r=>r.g.wx&&!INDOOR(r.g.roof)&&r.g.wx.dew>=60))+"\n"+
    line("Any team's next game after visiting Denver (\"hangover\")",after)+"\n";

  // ---- 3. dry climate -> humid ----
  const out=road.filter(r=>r.g.wx&&!INDOOR(r.g.roof)&&r.climate);
  // classify by September climate so "dry" means an arid city, not a northern city in winter
  const dryTeam=r=>r.sept&&r.sept.dew<=50,humidTeam=r=>r.sept&&r.sept.dew>=64;
  const muggy=r=>r.g.wx.dew>=65;
  const dryTeams=[...new Set(out.filter(dryTeam).map(r=>r.team))].sort();
  const humidTeams=[...new Set(out.filter(humidTeam).map(r=>r.team))].sort();
  md+=`\n## 3. Dry-climate teams playing in humidity\n\nDry = home city's average September dew point ≤ 50°F (${dryTeams.join(", ")}). Humid = ≥ 64°F (${humidTeams.join(", ")}). `+
    `Muggy = dew point ≥ 65°F at kickoff, outdoors.\n\n${HEAD}\n`+
    line("Dry-climate visitor, muggy game",out.filter(r=>dryTeam(r)&&muggy(r)))+"\n"+
    line("  control: humid-climate visitor, muggy game",out.filter(r=>humidTeam(r)&&muggy(r)))+"\n"+
    line("  control: all visitors, muggy game",out.filter(muggy))+"\n"+
    line("Dry visitor, big dew-point jump (+20°F vs home that month)",out.filter(r=>dryTeam(r)&&r.g.wx.dew-r.climate.dew>=20))+"\n"+
    line("Any visitor, big dew-point jump (+20°F vs home that month)",out.filter(r=>r.g.wx.dew-r.climate.dew>=20))+"\n"+
    line("Hot and muggy (≥85°F, dew ≥ 65), any visitor",out.filter(r=>r.g.wx.temp>=85&&muggy(r)))+"\n"+
    `\nScoring in muggy games (both teams): ${line("",out.filter(muggy),{totals:true}).split("|").slice(-2,-1)[0].trim()}.\n`;

  // ---- 4. cold / late season ----
  const temp=r=>r.g.temp!==""?+r.g.temp:(r.g.wx?r.g.wx.temp:null);
  const outT=road.filter(r=>!INDOOR(r.g.roof)&&temp(r)!=null);
  const warmTeam=r=>r.domeTeam||(r.climate&&r.climate.temp>=60);
  const coldTeam=r=>!r.domeTeam&&r.climate&&r.climate.temp<45;
  const freezing=r=>temp(r)<=32;
  md+=`\n## 4. Cold weather and late season\n\nWarm-weather/dome team = plays home games indoors, or its home city averages ≥ 60°F that month. `+
    `Cold team = outdoor home city averaging < 45°F that month.\n\n${HEAD}\n`+
    line("Warm/dome visitor at ≤ 32°F",outT.filter(r=>warmTeam(r)&&freezing(r)))+"\n"+
    line("  Dome teams only",outT.filter(r=>r.domeTeam&&freezing(r)))+"\n"+
    line("  Warm outdoor teams only (MIA, TB, JAX...)",outT.filter(r=>!r.domeTeam&&r.climate&&r.climate.temp>=60&&freezing(r)))+"\n"+
    line("  control: cold-climate visitor at ≤ 32°F",outT.filter(r=>coldTeam(r)&&freezing(r)))+"\n"+
    line("Warm/dome visitor at ≤ 20°F",outT.filter(r=>warmTeam(r)&&temp(r)<=20))+"\n"+
    line("Warm/dome visitor, outdoors in Dec-Jan (any temp)",outT.filter(r=>warmTeam(r)&&(r.g.month===12||r.g.month===1)))+"\n"+
    line("  control: ALL visitors outdoors in Dec-Jan",outT.filter(r=>r.g.month===12||r.g.month===1))+"\n"+
    line("  control: cold-climate visitors outdoors in Dec-Jan",outT.filter(r=>coldTeam(r)&&(r.g.month===12||r.g.month===1)))+"\n"+
    line("  warm/dome Dec-Jan, 1999-2011",outT.filter(r=>warmTeam(r)&&(r.g.month===12||r.g.month===1)&&r.g.season<=2011))+"\n"+
    line("  warm/dome Dec-Jan, 2012-2025",outT.filter(r=>warmTeam(r)&&(r.g.month===12||r.g.month===1)&&r.g.season>=2012))+"\n"+
    line("  warm/dome Dec-Jan, regular season only",outT.filter(r=>warmTeam(r)&&(r.g.month===12||r.g.month===1)&&r.g.game_type==="REG"))+"\n"+
    line("  warm/dome Dec-Jan, playoffs only",outT.filter(r=>warmTeam(r)&&(r.g.month===12||r.g.month===1)&&r.g.game_type!=="REG"))+"\n"+
    line("Warm/dome visitor, outdoors in Sep-Oct",outT.filter(r=>warmTeam(r)&&(r.g.month===9||r.g.month===10)))+"\n"+
    `\n${HEAD}\n`+
    line("Totals: games at ≤ 32°F",outT.filter(freezing),{totals:true})+"\n"+
    line("Totals: games at ≤ 20°F",outT.filter(r=>temp(r)<=20),{totals:true})+"\n";

  const file=path.join(__dirname,"travel-climate-results.md");fs.writeFileSync(file,md);
  console.log(md);log("written",file);
})().catch(e=>{console.error(e);process.exit(1);});
