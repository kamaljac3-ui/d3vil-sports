// Stadium locations/roofs + Open-Meteo kickoff forecast (free, no key).
const {getJSON,log}=require("./lib");

// nflverse stadium_id -> [lat, lon, roof, field bearing]. roof: "outdoor" | "dome" | "retractable".
// Field bearing = compass direction of the field's long axis (0-180), from OpenStreetMap pitch outlines
// (nfl-lines/research/wind-direction.js). Missing for a few international venues -> no direction effect.
// Retractable roofs are treated as weather-neutral (they close in bad weather almost every time).
const STADIUMS={
  ATL97:[33.7554,-84.4008,"retractable",85.5],BAL00:[39.2780,-76.6227,"outdoor",104.4],BOS00:[42.0909,-71.2643,"outdoor",160.2],
  BUF00:[42.7738,-78.7870,"outdoor",0.6],CAR00:[35.2258,-80.8528,"outdoor",150.1],CHI98:[41.8623,-87.6167,"outdoor",170.5],
  CIN00:[39.0955,-84.5161,"outdoor",142.8],CLE00:[41.5061,-81.6995,"outdoor",50.7],DAL00:[32.7473,-97.0945,"retractable",66.5],
  DEN00:[39.7439,-105.0201,"outdoor",175],DET00:[42.3400,-83.0456,"dome"],GNB00:[44.5013,-88.0622,"outdoor",174.2],
  HOU00:[29.6847,-95.4107,"retractable",173.4],IND00:[39.7601,-86.1639,"retractable",9.7],JAX00:[30.3239,-81.6373,"outdoor",15.3],
  KAN00:[39.0489,-94.4839,"outdoor",142.5],LAX01:[33.9535,-118.3392,"dome"],LON00:[51.5560,-0.2796,"outdoor"],
  LON02:[51.6043,-0.0664,"outdoor",173],MAD01:[40.4531,-3.6883,"retractable"],MEL00:[-37.8200,144.9834,"outdoor"],
  MEX00:[19.3029,-99.1505,"outdoor",17.7],MIA00:[25.9580,-80.2389,"outdoor",95.5],MIN01:[44.9737,-93.2575,"dome"],
  MUN01:[48.2188,11.6247,"outdoor",164.7],NAS00:[36.1665,-86.7713,"outdoor",160.8],NOR00:[29.9511,-90.0812,"dome"],
  NYC01:[40.8135,-74.0745,"outdoor",158.9],PAR00:[48.9245,2.3602,"outdoor"],PHI00:[39.9008,-75.1675,"outdoor",167],
  PHO00:[33.5276,-112.2626,"retractable",143.7],PIT00:[40.4468,-80.0158,"outdoor",165.3],RIO00:[-22.9121,-43.2302,"outdoor"],
  SEA00:[47.5952,-122.3316,"outdoor",5.6],SFO01:[37.4030,-121.9700,"outdoor",157.3],TAM00:[27.9759,-82.5033,"outdoor",6.5],
  VEG00:[36.0909,-115.1833,"dome"],WAS00:[38.9076,-76.8645,"outdoor",124.2],
};

// Is this game played indoors? nflverse's per-game roof wins when it's filled in.
function indoor(game){
  if(game.roof==="dome"||game.roof==="closed")return true;
  if(game.roof==="outdoors"||game.roof==="open")return false;
  const s=STADIUMS[game.stadium_id];return s?s[2]!=="outdoor":false;
}

// Forecast for the three hours from kickoff. Returns null when not applicable/unknown.
async function kickoffWeather(game,kick){
  if(indoor(game))return {indoor:true};
  const s=STADIUMS[game.stadium_id];
  if(!s){log("no coordinates for stadium",game.stadium_id,game.stadium);return null;}
  const hoursOut=(kick-Date.now())/36e5;if(hoursOut>15*24||hoursOut<-4)return null;
  const day=d=>d.toISOString().slice(0,10);
  const end=new Date(kick.getTime()+4*36e5);
  const j=await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${s[0]}&longitude=${s[1]}`+
    `&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=mph&temperature_unit=fahrenheit`+
    `&precipitation_unit=inch&timezone=GMT&start_date=${day(kick)}&end_date=${day(end)}`);
  if(!j||!j.hourly)return null;
  const H=j.hourly,t0=Math.floor(kick.getTime()/36e5)*36e5;const pick=[];
  H.time.forEach((t,i)=>{const ms=Date.parse(t+"Z");if(ms>=t0&&ms<t0+3*36e5)pick.push(i);});
  if(!pick.length)return null;
  const avg=k=>pick.reduce((a,i)=>a+(+H[k][i]||0),0)/pick.length;
  const max=k=>Math.max(...pick.map(i=>+H[k][i]||0));
  // average direction as a vector (so 350° and 10° average to 0°, not 180°)
  let vx=0,vy=0;for(const i of pick){const d=+H.wind_direction_10m[i]*Math.PI/180,sp=+H.wind_speed_10m[i]||0;vx+=sp*Math.sin(d);vy+=sp*Math.cos(d);}
  const dir=vx||vy?(Math.atan2(vx,vy)*180/Math.PI+360)%360:null;
  return {indoor:false,wind:+avg("wind_speed_10m").toFixed(1),gust:+max("wind_gusts_10m").toFixed(0),
    precip:+avg("precipitation").toFixed(2),temp:Math.round(avg("temperature_2m")),dir,...alignment(s[3],dir)};
}

// How the wind lines up with the field: align = |cos(angle)|, 1 = straight down the field, 0 = straight across.
// Research (1999-2025, 12+ mph): crosswinds cut combined passing ~43 yds vs ~26 for along-field wind.
function alignment(bearing,dir){
  if(bearing==null||dir==null)return {align:null,rel:null};
  const align=Math.abs(Math.cos((dir-bearing)*Math.PI/180));
  return {align:+align.toFixed(2),rel:align>=0.8?"along":align<=0.45?"cross":"diagonal"};
}

// Historical games (backtest): nflverse records game-time wind/temp for outdoor games.
function recordedWeather(game){
  if(indoor(game))return {indoor:true};
  if(game.wind==="")return null;
  return {indoor:false,wind:+game.wind||0,gust:0,precip:0,temp:game.temp===""?null:+game.temp};
}

const REL={along:"wind along the field",cross:"crosswind",diagonal:"diagonal wind"};
const wxText=w=>!w?"weather n/a":w.indoor?"indoors":`${Math.round(w.wind)} mph ${w.rel&&w.wind>=8?REL[w.rel]:"wind"}${w.gust>w.wind+8?`, gusts ${w.gust}`:""}${w.precip>=0.04?`, rain ${w.precip}"/hr`:""}${w.temp!=null?`, ${w.temp}°F`:""}`;

module.exports={STADIUMS,indoor,kickoffWeather,recordedWeather,wxText,alignment};
