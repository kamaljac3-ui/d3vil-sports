// Park + weather environment for the flight model.
// Builds {rho, dirs:[{spray, fence, wind, weight}]} for model.matchup(): air density from temperature and elevation,
// the park's fence distance in each spray direction, and the wind component along each direction.
// Spray angle: degrees from the home-plate -> center-field line, negative toward left field, positive toward right.

// ---------- park ----------
// MLB venue fieldInfo gives fence distances at the lines, gaps and center (some parks also list "left"/"right").
const FENCE_POINTS=[["leftLine",-45],["left",-32],["leftCenter",-22],["center",0],["rightCenter",22],["right",32],["rightLine",45]];
function fenceAt(fieldInfo,spray){
  const pts=FENCE_POINTS.filter(([k])=>fieldInfo&&fieldInfo[k]).map(([k,a])=>[a,+fieldInfo[k]]);
  if(pts.length<3)return 380;
  if(spray<=pts[0][0])return pts[0][1];
  for(let i=1;i<pts.length;i++)if(spray<=pts[i][0]){const [a0,d0]=pts[i-1],[a1,d1]=pts[i];return d0+(d1-d0)*(spray-a0)/(a1-a0);}
  return pts[pts.length-1][1];
}
// Where home-run-type fly balls go: mostly the pull side. Right-handed hitters pull to left field (negative spray).
const SPRAY=[[-38,0.22],[-19,0.33],[0,0.25],[19,0.13],[38,0.07]];
const sprayFor=bats=>bats==="L"?SPRAY.map(([a,w])=>[-a,w]):SPRAY;

// ---------- air ----------
// density from temperature (F), elevation (ft) and relative humidity (0-1); ~1.2 kg/m^3 at sea level, 70F
function airDensity(tempF,elevFt,rh=0.5){
  const T=(tempF-32)*5/9+273.15,Tc=T-273.15,h=elevFt*0.3048;
  const P=101325*Math.pow(1-2.25577e-5*h,5.25588);
  const pv=rh*610.78*Math.pow(10,7.5*Tc/(Tc+237.3));
  return (P-pv)/(287.05*T)+pv/(461.5*T);
}

// ---------- weather ----------
// MLB game weather: {condition:"Roof Closed", temp:"74", wind:"7 mph, Out To LF"}
// Returns {tempF, windMph, windTo} with windTo = direction the wind blows TOWARD, as a spray angle.
const MLB_WIND={"Out To CF":0,"Out To LF":-45,"Out To RF":45,"In From CF":180,"In From LF":135,"In From RF":-135,"L To R":90,"R To L":-90};
function fromMlb(w){
  if(!w)return null;
  const tempF=parseFloat(w.temp);const m=/^(\d+)\s*mph,\s*(.+)$/.exec(w.wind||"");
  const indoor=/roof closed|dome/i.test(w.condition||"");
  const dir=m?m[2].trim():"",windTo=MLB_WIND[dir];
  return {tempF:isNaN(tempF)?70:tempF,windMph:indoor||windTo===undefined?0:+m[1],windTo:windTo??0,indoor,label:m?`${m[1]} mph ${dir}`:(w.wind||"")};
}
// Compass wind (e.g. Open-Meteo: wind_direction = where it blows FROM, degrees clockwise from north) -> spray angle,
// using the park's azimuth (MLB venue location.azimuthAngle = compass bearing from home plate to center field).
function fromCompass(tempF,windMph,windFromDeg,azimuth){
  let rel=((windFromDeg+180)-azimuth)%360;if(rel>180)rel-=360;if(rel<-180)rel+=360;
  return {tempF,windMph,windTo:rel,indoor:false};
}

// ---------- environment ----------
// park: MLB venue {location:{elevation, azimuthAngle}, fieldInfo:{..., roofType}}; wx: from fromMlb/fromCompass; bats: "L"|"R"
function build(park,wx,bats,opts={}){
  const scale=opts.windScale??1;
  const elev=park&&park.location?+park.location.elevation||0:0,fi=park&&park.fieldInfo||{};
  const indoor=(wx&&wx.indoor)||fi.roofType==="Dome";
  const tempF=indoor?72:(wx?wx.tempF:70),windMph=indoor||!wx?0:wx.windMph*scale;
  const rho=airDensity(tempF,elev,opts.rh??0.5);
  const dirs=sprayFor(bats).map(([spray,weight])=>({spray,weight,fence:fenceAt(fi,spray),
    wind:windMph*Math.cos((wx&&!indoor?wx.windTo-spray:90)*Math.PI/180)}));   // + = blowing out along this direction
  return {rho,dirs,tempF,windMph,indoor};
}
// a neutral environment: sea-level-ish air, no wind, flat 380 ft fence (what the model assumed before)
const NEUTRAL=null;

// ---------- what the bots use ----------
// Backtest (launch-angle/BACKTEST.md, 2025 fit, 2026 out of sample): park/air/wind is real signal but the physics
// overstates it, so the multiplier is shrunk: (modeled HR in this env / modeled HR in a neutral park)^ENV_B, with the
// reported wind scaled by WIND_SCALE. Bottom/top deciles came out around 0.8x / 1.15x actual HR.
const ENV_B=+(process.env.LA_ENV_B||0.2),WIND_SCALE=+(process.env.LA_WIND_SCALE||0.5);
const NEUTRAL_PARK={location:{elevation:0},fieldInfo:{leftLine:330,leftCenter:375,center:400,rightCenter:375,rightLine:330}};
const batsVs=(batSide,pitchHand)=>batSide==="S"?(pitchHand==="L"?"R":"L"):(batSide||"R");
function describe(windTo,mph){ // field-relative wind in words
  if(!mph)return "calm";const a=windTo;
  const d=Math.abs(a)<=22?"out to CF":a>22&&a<=67?"out to RF":a<-22&&a>=-67?"out to LF":a>67&&a<=112?"L to R":a<-67&&a>=-112?"R to L":
    a>112&&a<=157?"in from LF":a<-112&&a>=-157?"in from RF":"in from CF";
  return `${Math.round(mph)} mph ${d}`;
}
// Weather at first pitch for a schedule game hydrated with weather,venue(location,fieldInfo):
// MLB's own report once posted (usually close to first pitch), else the Open-Meteo forecast for the park at game time.
async function forGame(game){
  const v=game.venue||{},w=game.weather;
  if(w&&w.wind){const wx=fromMlb(w);wx.label=wx.indoor?"roof closed":`${describe(wx.windTo,wx.windMph)}, ${Math.round(wx.tempF)}°F`;return {park:v,wx,src:"MLB"};}
  if(v.fieldInfo&&v.fieldInfo.roofType==="Dome")return {park:v,wx:{tempF:72,windMph:0,windTo:0,indoor:true,label:"dome"},src:"dome"};
  const c=v.location&&v.location.defaultCoordinates;if(!c)return {park:v,wx:null,src:"none"};
  try{
    const d=game.gameDate.slice(0,10);
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.latitude}&longitude=${c.longitude}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=UTC&start_date=${d}&end_date=${d}`,{signal:AbortSignal.timeout(20000)});
    const j=await r.json(),t=new Date(game.gameDate).getTime();let bi=0,bd=Infinity;
    j.hourly.time.forEach((x,i)=>{const dd=Math.abs(new Date(x+"Z").getTime()-t);if(dd<bd){bd=dd;bi=i;}});
    const wx=fromCompass(j.hourly.temperature_2m[bi],j.hourly.wind_speed_10m[bi],j.hourly.wind_direction_10m[bi],+v.location.azimuthAngle);
    wx.label=`${describe(wx.windTo,wx.windMph)}, ${Math.round(wx.tempF)}°F, forecast${v.fieldInfo&&v.fieldInfo.roofType==="Retractable"?", roof may close":""}`;
    return {park:v,wx,src:"forecast"};
  }catch(e){return {park:v,wx:null,src:"none"};}
}
// shrunk park/weather HR multiplier for one hitter (bats "L"|"R") in a game's park and weather
function multiplier(M,h,park,wx,bats,fence=380){
  if(!park||!park.fieldInfo||!wx)return 1;
  const a=M.matchup(h,M.LEAGUE_AVG_PITCHER,fence,build(park,wx,bats,{windScale:WIND_SCALE})).hr;
  const b=M.matchup(h,M.LEAGUE_AVG_PITCHER,fence,build(NEUTRAL_PARK,fromMlb({temp:"70",wind:"0 mph, Calm"}),bats)).hr;
  return b>0?Math.pow(Math.max(a/b,0.05),ENV_B):1;
}
// batSide / pitchHand for a list of MLB ids (one request per 150)
async function hands(ids){
  const out={};ids=[...new Set(ids.map(String))];
  for(let i=0;i<ids.length;i+=150){
    try{const r=await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.slice(i,i+150).join(",")}`,{signal:AbortSignal.timeout(20000)});
      for(const p of (await r.json()).people||[])out[String(p.id)]={bat:p.batSide&&p.batSide.code,pitch:p.pitchHand&&p.pitchHand.code};}catch(e){}
  }
  return out;
}

module.exports={build,fromMlb,fromCompass,airDensity,fenceAt,NEUTRAL,NEUTRAL_PARK,describe,forGame,multiplier,hands,batsVs,ENV_B,WIND_SCALE};
