// Shared helpers: settings, CSV, fetch, state cache, Eastern-time math, ntfy.
const fs=require("fs"),path=require("path"),zlib=require("zlib");

// ---------- settings (every tunable is an env var with a default) ----------
const env=(k,d)=>{const v=process.env[k];return v==null||v===""?d:+v;};
const envs=(k,d)=>{const v=process.env[k];return v==null||v===""?d:v;};

const DRY=process.env.DRY_RUN==="1";
const log=(...a)=>console.log("[np]",...a);

// ---------- CSV (fast path for the 100 MB play-by-play files) ----------
// keep = list of column names to return; omit to return every column.
function parseCSV(text,keep){
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  const out=[],n=text.length;let header=null,sel=null,names=null,row=[],i=0;
  while(i<n){
    let val;
    if(text.charCodeAt(i)===34){
      let j=i+1,s="";
      for(;;){const k=text.indexOf('"',j);if(k<0){s+=text.slice(j);j=n;break;}
        s+=text.slice(j,k);if(text.charCodeAt(k+1)===34){s+='"';j=k+2;}else{j=k+1;break;}}
      val=s;i=j;
    }else{
      let j=i;while(j<n){const d=text.charCodeAt(j);if(d===44||d===10||d===13)break;j++;}
      val=text.slice(i,j);i=j;
    }
    row.push(val);
    if(text.charCodeAt(i)===44){i++;continue;}
    if(text.charCodeAt(i)===13)i++;if(text.charCodeAt(i)===10)i++;
    if(!header){header=row;names=keep||header;sel=names.map(k=>header.indexOf(k));}
    else if(row.length>1||row[0]!==""){const o={};for(let x=0;x<sel.length;x++)o[names[x]]=sel[x]>=0?(row[sel[x]]??""):"";out.push(o);}
    row=[];
  }
  return out;
}

// ---------- HTTP ----------
const UA={"User-Agent":"Mozilla/5.0 (d3vil-sports nfl-props bot)"};
async function getRaw(url,opts={}){
  for(let a=0;a<3;a++){
    try{const r=await fetch(url,{headers:UA,...opts});
      if(r.ok)return r;
      log("HTTP",r.status,url.replace(/apiKey=[^&]+/,"apiKey=***").slice(0,110));
      if(r.status===404||r.status===401||r.status===422)return null;
    }catch(e){log("fetch error",e.message);}
    await new Promise(s=>setTimeout(s,2000*(a+1)));
  }
  return null;
}
async function getText(url){
  const r=await getRaw(url);if(!r)return null;
  const buf=Buffer.from(await r.arrayBuffer());
  return (url.endsWith(".gz")?zlib.gunzipSync(buf):buf).toString("utf8");
}
async function getJSON(url){const r=await getRaw(url);return r?r.json():null;}

// ---------- state cache (persisted between runs by actions/cache) ----------
// Only small state lives here (sent markers, snapshots, trimmed Sleeper, odds usage).
// Raw nflverse files are re-downloaded each run: a few seconds, and it keeps the
// Actions cache tiny so it never pushes the MLB bot's cache out of the 10 GB quota.
const CACHE=process.env.NP_CACHE||path.join(__dirname,".cache");
fs.mkdirSync(CACHE,{recursive:true});
let changedFlagged=false;
function readState(name,maxAgeH=Infinity){
  const p=path.join(CACHE,name);if(!fs.existsSync(p))return null;
  try{const d=JSON.parse(fs.readFileSync(p,"utf8"));if((Date.now()-d.at)/36e5<=maxAgeH)return d.v;}catch(e){}
  return null;
}
function writeState(name,v){
  fs.writeFileSync(path.join(CACHE,name),JSON.stringify({at:Date.now(),v}));
  // tells the workflow to save a new cache entry; runs that change nothing save nothing
  if(!changedFlagged&&process.env.GITHUB_OUTPUT){fs.appendFileSync(process.env.GITHUB_OUTPUT,"state_changed=true\n");changedFlagged=true;}
  return v;
}

// ---------- Eastern time (DST-safe: always via Intl, never a fixed UTC offset) ----------
const TZ="America/New_York";
const FMT=new Intl.DateTimeFormat("en-US",{timeZone:TZ,hourCycle:"h23",weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
function etParts(d=new Date()){
  const p=Object.fromEntries(FMT.formatToParts(d).map(x=>[x.type,x.value]));
  return {wd:p.weekday,date:`${p.year}-${p.month}-${p.day}`,h:+p.hour%24,m:+p.minute};
}
// "2026-11-01","13:00" (Eastern wall clock) -> Date. Correct on both sides of a DST change.
function etToUtc(date,time){
  const [Y,M,D]=date.split("-").map(Number),[h,mi]=(time||"13:00").split(":").map(Number);
  const want=Date.UTC(Y,M-1,D,h,mi);let t=want+5*36e5;
  for(let k=0;k<3;k++){const p=etParts(new Date(t));const [y2,m2,d2]=p.date.split("-").map(Number);
    const got=Date.UTC(y2,m2-1,d2,p.h,p.m);if(got===want)break;t+=want-got;}
  return new Date(t);
}
const etClock=d=>d.toLocaleTimeString("en-US",{timeZone:TZ,hour:"numeric",minute:"2-digit"});

// ---------- ntfy (phone alerts only; never the newsletter) ----------
const NTFY_SERVER=(process.env.NTFY_SERVER||"https://ntfy.sh").replace(/\/$/,"");
const NTFY_TOPIC=process.env.NTFY_TOPIC;
const NTFY_TOKEN=process.env.NTFY_TOKEN||"";
const LIVE=!DRY&&!!NTFY_TOPIC;   // only a live send may mark anything as "sent"
async function ntfy(title,message,priority=3,tags=["football"],click=""){
  if(!LIVE){log("DRY ntfy:",title,"\n"+message);return true;}
  const h={"Content-Type":"application/json"};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  const r=await fetch(NTFY_SERVER,{method:"POST",headers:h,body:JSON.stringify({topic:NTFY_TOPIC,title,message:message.slice(0,3900),priority,tags,...(click?{click}:{})})});
  log("ntfy",r.status);return r.ok;
}
function summary(md){if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md+"\n");}

// ---------- names ----------
const normName=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[.'’`-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/g,"").replace(/\s+/g," ").trim();

module.exports={env,envs,DRY,LIVE,log,parseCSV,getRaw,getText,getJSON,readState,writeState,etParts,etToUtc,etClock,ntfy,summary,normName,CACHE};
