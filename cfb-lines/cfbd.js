// CollegeFootballData.com API client: disk cache + monthly call budget.
// Free tier = 1,000 calls/month, so every response is cached (gzipped) and a completed season's
// data is cached forever. The call counter lives in state and survives runs via actions/cache.
const fs=require("fs"),path=require("path"),zlib=require("zlib");
process.env.NP_CACHE=process.env.NP_CACHE||path.join(__dirname,".cache");
const {env,log,readState,writeState,CACHE}=require("../nfl-props/lib");

const BASE=(process.env.CFBD_BASE||"https://api.collegefootballdata.com").replace(/\/$/,"");
// Actions: the CFBD_API_KEY secret. Local runs: that env var, or the key alone in ~/.cfbd_key (outside the repo).
const KEYFILE=path.join(require("os").homedir(),".cfbd_key");
const KEY=process.env.CFBD_API_KEY||(fs.existsSync(KEYFILE)?fs.readFileSync(KEYFILE,"utf8").trim():"");
const BUDGET=env("CFBD_MONTHLY_BUDGET",700);   // hard stop for this bot, under the 1,000 free calls
const DIR=path.join(CACHE,"cfbd");fs.mkdirSync(DIR,{recursive:true});

const month=()=>new Date().toISOString().slice(0,7);
function usage(){const u=readState("cfbd-usage.json")||{};return u.month===month()?u:{month:month(),calls:0,remaining:null};}

// ttlH = hours a cached copy stays fresh (Infinity for finished seasons).
async function get(route,params={},ttlH=24){
  const qs=Object.entries(params).filter(([,v])=>v!=null&&v!=="").map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join("&");
  const url=`${BASE}${route}${qs?"?"+qs:""}`;
  const file=path.join(DIR,(route+"_"+qs).replace(/[^a-z0-9=_-]+/gi,"_").slice(0,150)+".json.gz");
  let stale=null;
  if(fs.existsSync(file)){
    try{const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
      if((Date.now()-d.at)/36e5<=ttlH)return d.v;stale=d.v;}catch(e){}
  }
  if(!KEY){if(stale)return stale;throw new Error("CFBD_API_KEY is not set (free key: collegefootballdata.com/key)");}
  const u=usage();
  if(u.calls>=BUDGET){if(stale){log(`CFBD budget ${BUDGET} reached; using stale ${route}`);return stale;}
    throw new Error(`CFBD monthly budget (${BUDGET}) used up; raise CFBD_MONTHLY_BUDGET or wait for next month`);}
  let r=null;
  for(let a=0;a<3;a++){
    try{r=await fetch(url,{headers:{Authorization:"Bearer "+KEY,Accept:"application/json"}});}catch(e){log("CFBD fetch error",e.message);r=null;}
    if(r&&(r.ok||r.status<500&&r.status!==429))break;
    await new Promise(s=>setTimeout(s,3000*(a+1)));
  }
  u.calls++;const rem=r&&r.headers.get("x-calllimit-remaining");if(rem!=null)u.remaining=+rem;
  writeState("cfbd-usage.json",u);
  if(!r||!r.ok){
    const msg=`CFBD ${r?r.status:"network"} on ${route}${qs?"?"+qs:""}${r?": "+(await r.text()).slice(0,160):""}`;
    if(stale){log(msg,"(using stale copy)");return stale;}
    throw new Error(msg);
  }
  const v=await r.json();
  fs.writeFileSync(file,zlib.gzipSync(JSON.stringify({at:Date.now(),v})));
  writeState("cfbd-last.json",{route,at:Date.now()});   // marks state changed so the workflow saves the cache
  return v;
}

// /info reports the key's own remaining calls (not counted against our budget).
async function info(){const r=await fetch(BASE+"/info",{headers:{Authorization:"Bearer "+KEY}});return r.ok?r.json():{status:r.status,body:(await r.text()).slice(0,160)};}

module.exports={get,info,usage,BUDGET,hasKey:()=>!!KEY};
