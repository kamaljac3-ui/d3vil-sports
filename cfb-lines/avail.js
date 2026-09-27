// Official player availability reports (SEC, Big Ten, ACC, Big 12) + kickoff weather.
//
// Availability: the conferences' report pages embed HD Intelligence, whose public JSON endpoint is what
// their own pages call (no login). Undocumented, so everything here is defensive: any failure means
// "no report", never a crash. Conference games only; no other conference is reachable
// (Mountain West/Pac-12 codes return "Invalid parameters"). Replies are big (logos inline, SEC ~10 MB),
// so we only call it for the conferences playing in the window, and at most every AVAIL_TTL_MIN minutes.
const {env,log,readState,writeState,normName,getJSON}=require("../nfl-props/lib");

const HD="https://app.hdintelligence.com/api/get-publish-public";
const CONF={SEC:"SEC","Big Ten":"B10",ACC:"ACC","Big 12":"B12"};   // CFBD conference name -> feed code
const TTL=env("AVAIL_TTL_MIN",45);
// the feed uses short names in teamName; teamDisplayName is usually CFBD's school name
const ALIAS={"Southern California":"USC","Miami (FL)":"Miami","Miami (Fla.)":"Miami","Pitt":"Pittsburgh","Ole Miss":"Ole Miss","Mississippi":"Ole Miss","UConn":"UConn"};
const teamKey=s=>normName(ALIAS[s]||s).replace(/\bst$/,"state");

async function fetchConf(code){
  const hit=readState(`avail-${code}.json`,TTL/60);if(hit)return hit;
  let j=null;
  try{const r=await fetch(HD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sport:"Football",organization:code,conference:code})});
    if(r.ok)j=await r.json();else log("availability feed",code,"HTTP",r.status);}catch(e){log("availability feed",code,e.message);}
  if(!j||typeof j!=="object"||j.error){if(j&&j.error)log("availability feed",code,j.error);return {};}
  // keep only what we need: team -> {type, posted, rows[{name,pos,status}]}; newest report per team wins
  const out={};
  for(const rep of Object.values(j)){
    let games=rep&&rep.games;if(typeof games==="string")try{games=JSON.parse(games);}catch(e){games=null;}
    if(!Array.isArray(games))continue;
    const posted=`${rep.publishDate||""} ${rep.postedTime||""}`.trim();
    for(const t of games){const name=t.teamDisplayName||t.teamName;if(!name||!Array.isArray(t.rows))continue;
      const k=teamKey(name);if(out[k]&&out[k].posted>posted)continue;
      out[k]={team:name,type:rep.ReportType||"",posted,date:rep.publishDate||"",rows:t.rows.map(x=>{
        const m=String(x.name||"").match(/^(\S+)\s+#\S+\s+(.*)$/);
        return {pos:m?m[1].toUpperCase():"",name:m?m[2]:String(x.name||""),status:x.exemptStatus==="Exempt"?"":String(x.status||"")};})
        // QBs always (a missing starter is itself a signal); everyone else only if not plainly available
        .filter(x=>x.pos==="QB"||(x.status&&!/^available$/i.test(x.status)))};}
  }
  return writeState(`avail-${code}.json`,out);
}

// Reports for the teams in these games, keyed by CFBD school name. Only reports dated within
// maxAgeDays of kickoff count (the feed can still hold last week's game).
async function reports(games,confOf,maxAgeDays=5){
  const codes=new Set();for(const g of games)if(g.conf)for(const t of [g.home,g.away]){const c=CONF[confOf(t)];if(c)codes.add(c);}
  const all={};for(const c of codes)Object.assign(all,await fetchConf(c));
  const out={};
  for(const g of games)for(const t of [g.home,g.away]){const r=all[teamKey(t)];if(!r)continue;
    const age=(g.start-Date.parse(r.date+"T12:00:00Z"))/864e5;if(r.date&&(age>maxAgeDays||age<-1))continue;
    out[t]=r;}
  return out;
}

// ---------- weather (Open-Meteo forecast at the venue, 3 hours from kickoff; skips domes) ----------
async function kickoffWeather(venue,kick){
  if(!venue||venue.lat==null)return null;
  if(venue.dome)return {indoor:true};
  const hoursOut=(kick-Date.now())/36e5;if(hoursOut>15*24||hoursOut<-4)return null;
  const day=d=>new Date(d).toISOString().slice(0,10);
  const j=await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${venue.lat}&longitude=${venue.lon}`+
    `&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,dew_point_2m&wind_speed_unit=mph&temperature_unit=fahrenheit`+
    `&precipitation_unit=inch&timezone=GMT&start_date=${day(kick)}&end_date=${day(kick+4*36e5)}`);
  if(!j||!j.hourly)return null;
  const H=j.hourly,t0=Math.floor(kick/36e5)*36e5,pick=[];
  H.time.forEach((t,i)=>{const ms=Date.parse(t+"Z");if(ms>=t0&&ms<t0+3*36e5)pick.push(i);});
  if(!pick.length)return null;
  const avg=k=>pick.reduce((a,i)=>a+(+H[k][i]||0),0)/pick.length,max=k=>Math.max(...pick.map(i=>+H[k][i]||0));
  return {indoor:false,wind:+avg("wind_speed_10m").toFixed(1),gust:Math.round(max("wind_gusts_10m")),precip:+avg("precipitation").toFixed(2),temp:Math.round(avg("temperature_2m")),dew:Math.round(avg("dew_point_2m"))};
}

// A team's usual air: last season's Sep-Nov afternoon/evening average temp and dew point at its home stadium
// (Open-Meteo archive, same definition the backtest fitted on). Cached 30 days per team.
async function homeClimate(team,loc,S){
  if(!loc||loc.lat==null)return null;
  const all=readState("climate.json",24*30)||{};if(all[team])return all[team];
  const j=await getJSON(`https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat}&longitude=${loc.lon}&start_date=${S-1}-09-01&end_date=${S-1}-11-30`+
    `&hourly=temperature_2m,dew_point_2m&temperature_unit=fahrenheit&timezone=GMT`);
  if(!j||!j.hourly)return null;
  let ds=0,ts=0,n=0;j.hourly.time.forEach((t,i)=>{const h=+t.slice(11,13);
    if((h>=17||h<=2)&&j.hourly.dew_point_2m[i]!=null){ds+=+j.hourly.dew_point_2m[i];ts+=+j.hourly.temperature_2m[i];n++;}});
  if(n<100)return null;
  all[team]={dew:+(ds/n).toFixed(1),temp:+(ts/n).toFixed(1)};writeState("climate.json",all);
  return all[team];
}
const wxText=w=>!w?"":w.indoor?"indoors":`wind ${Math.round(w.wind)} mph${w.gust>w.wind+8?` (gusts ${w.gust})`:""}${w.precip>=0.04?`, rain ${w.precip}"/hr`:""}, ${w.temp}°F`;

module.exports={reports,kickoffWeather,homeClimate,wxText,CONF,teamKey};
