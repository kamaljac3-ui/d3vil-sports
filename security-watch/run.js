// Security Watch: defensive monitor for this repo, its GitHub Actions and the live site, plus a daily brief on
// attacks being exploited around the world right now. Alerts go to ntfy only, like the other bots.
//
// Checks (each one is independent; a failing check is reported, never fatal to the others):
//   secrets   leaked keys in the tracked files and in new commit history (pattern + entropy, plus the repo's own
//             secret VALUES, passed in by the workflow, matched exactly and never printed)
//   workflows changes to .github/workflows and scripts/ since the last run, and risky workflow patterns
//   actions   Actions runs whose (workflow, event, actor) combination has never been seen before (a learned baseline)
//   site      scripts/iframes/forms on the live site that load from hosts the repo never uses (skimmer/defacement)
//   intel     world threat intel: CISA's Known Exploited Vulnerabilities catalog (attacks happening now), GitHub
//             advisories for the Actions this repo uses, and abuse.ch URLhaus malware hosts vs every link we publish
//
// Urgent findings push at once; the rest go into one daily brief (first run after DIGEST_HOUR ET).
// It only alerts. It never changes the repo, the workflows or any settings (see README "Responding").
const fs=require("fs"),path=require("path"),crypto=require("crypto"),{execFileSync}=require("child_process");

const env=(k,d)=>process.env[k]!==undefined&&process.env[k]!==""?process.env[k]:d;
const DRY=env("DRY_RUN","0")==="1";
const NTFY_SERVER=env("NTFY_SERVER","https://ntfy.sh").replace(/\/$/,"");
const NTFY_TOPIC=process.env.NTFY_TOPIC,NTFY_TOKEN=env("NTFY_TOKEN","");
const ROOT=path.resolve(env("REPO_ROOT",path.join(__dirname,"..")));
const CACHE=env("SW_CACHE",path.join(__dirname,".cache"));fs.mkdirSync(CACHE,{recursive:true});
const GH_TOKEN=env("GITHUB_TOKEN",""),GH_REPO=env("GITHUB_REPOSITORY","kamaljac3-ui/d3vil-sports");
const LIVE_URL=env("LIVE_URL","https://kamaljac3-ui.github.io/d3vil-sports/").replace(/\/?$/,"/");
const LIVE_PAGES=env("LIVE_PAGES","index.html,archive.html,posts/latest.html").split(",").filter(Boolean);
const CHECKS=new Set(env("CHECKS","secrets,workflows,actions,site,intel").split(","));
const DIGEST_HOUR=+env("DIGEST_HOUR",8);                 // ET hour after which the daily brief goes out
const DIGEST=env("DIGEST","1")==="1";
const KEV_WATCH=env("KEV_WATCH","GitHub,Git,Node.js,npm,Chrome,Chromium,Microsoft Windows,Microsoft Edge,Apple,iOS,macOS,Android,Cloudflare,ntfy")
  .split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
const KEV_DIGEST_MAX=+env("KEV_DIGEST_MAX",12);          // KEV entries listed in the brief
const ACTIONS_WARMUP_DAYS=+env("ACTIONS_WARMUP_DAYS",7); // learn run patterns silently this long after a cold start
const ACTIONS_LOOKBACK_H=+env("ACTIONS_LOOKBACK_H",36);
const MIN_ENTROPY=+env("MIN_ENTROPY",3.5);
const SECRET_NAMES=env("WATCH_SECRET_NAMES","NTFY_TOPIC,NTFY_TOPIC_NFL,NTFY_TOPIC_CFB,NTFY_TOKEN,KIT_API_KEY,ELEVENLABS_API_KEY,ODDS_API_KEY,SPORTSGAMEODDS_KEY,CFBD_API_KEY").split(",");
const SAFE_HOSTS=new Set(env("SAFE_HOSTS","").split(",").filter(Boolean));   // extra script hosts you approve
const FIXTURES=env("FIXTURE_DIR","");                     // testing: serve URLs from local files instead of the network
const KEV_URL="https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const URLHAUS_URL="https://urlhaus.abuse.ch/downloads/hostfile/";
const GHSA_URL="https://api.github.com/advisories?ecosystem=actions&per_page=100";

const log=(...a)=>console.log(`[sw ${new Date().toISOString().slice(11,19)}]`,...a);
const sleep=ms=>new Promise(s=>setTimeout(s,ms));
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const etNow=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hour12:false})
  .formatToParts(new Date()).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,hour:+p.hour%24};};
const git=(...a)=>execFileSync("git",["-C",ROOT,...a],{encoding:"utf8",maxBuffer:512<<20});

// ---------- state ----------
const STATE_FILE=path.join(CACHE,"state.json");
let state={};try{state=JSON.parse(fs.readFileSync(STATE_FILE,"utf8"));}catch(e){}
state={alerted:{},fileHashes:null,lastCommit:null,runTuples:null,runsSince:null,kevSeen:null,ghsaSeen:{},digestDate:null,pending:[],kevPending:[],...state};
let changed=false;const mark=()=>{changed=true;};
const save=()=>{if(DRY||!NTFY_TOPIC){log("dry/no topic: state not saved");return;}
  if(changed){fs.writeFileSync(STATE_FILE,JSON.stringify(state));console.log("::notice::state saved");}};

// ---------- network ----------
async function fetchText(url,headers={}){
  if(FIXTURES){const f=path.join(FIXTURES,encodeURIComponent(url));return fs.existsSync(f)?fs.readFileSync(f,"utf8"):null;}
  for(let a=0;a<3;a++){try{const r=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});if(r.ok)return r.text();
      log("HTTP",r.status,url.slice(0,90));if(r.status===404||r.status===401||r.status===403)return null;}
    catch(e){log("fetch error",url.slice(0,60),e.message);}await sleep(3000*(a+1));}
  return null;
}
const fetchJSON=async(u,h)=>{const t=await fetchText(u,h);if(t==null)return null;try{return JSON.parse(t);}catch(e){log("bad JSON",u.slice(0,60));return null;}};
const ghHeaders=()=>({Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",...(GH_TOKEN?{Authorization:"Bearer "+GH_TOKEN}:{})});

async function ntfy(title,message,priority=3,tags=["shield"]){
  if(DRY||!NTFY_TOPIC){log("DRY ntfy:",`[p${priority}]`,title,"\n"+message);return;}
  const h={"Content-Type":"application/json"};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  const r=await fetch(NTFY_SERVER,{method:"POST",headers:h,body:JSON.stringify({topic:NTFY_TOPIC,title,message:message.slice(0,3900),priority,tags})});
  log("ntfy",r.status);
}

// Findings. `key` dedupes across runs (an alert is sent once per key). urgent → pushed now; otherwise → daily brief.
const findings=[],notes=[],failures=[];
function find(check,key,text,{urgent=false,priority=4}={}){
  if(state.alerted[key])return;
  findings.push({check,key,text,urgent,priority});
}

// ---------- 1. secrets ----------
const PATTERNS=[
  ["GitHub token",/\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g],
  ["AWS access key",/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["Google API key",/\bAIza[0-9A-Za-z_\-]{35}\b/g],
  ["Slack token",/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g],
  ["Stripe live key",/\b[sr]k_live_[A-Za-z0-9]{20,}\b/g],
  ["OpenAI/Anthropic-style key",/\bsk-(?:ant-|proj-)?[A-Za-z0-9_\-]{32,}\b/g],
  ["Private key",/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g],
  ["Hard-coded credential",/(?:api[_-]?key|apikey|secret|token|passw(?:or)?d|auth)["']?\s*[:=]\s*["']([A-Za-z0-9_\-\/+=.]{20,})["']/gi],
];
function entropy(s){const c={};for(const ch of s)c[ch]=(c[ch]||0)+1;let e=0;for(const k in c){const p=c[k]/s.length;e-=p*Math.log2(p);}return e;}
const SKIP_FILE=/\.(png|jpe?g|gif|webp|ico|mp3|mp4|wav|woff2?|ttf|pdf|zip|gz)$|(^|\/)\.cache\/|(^|\/)security-watch\/(run\.js|README\.md)$/i;
const secretValues=()=>SECRET_NAMES.map(n=>[n,process.env[n]]).filter(([,v])=>v&&v.length>=8);
const redact=s=>s.length<=8?"****":s.slice(0,4)+"…"+s.slice(-2);

function scanText(text,where,out){
  for(const [name,re] of PATTERNS){re.lastIndex=0;let m;
    while((m=re.exec(text))){const val=m[1]||m[0];
      if(name==="Hard-coded credential"&&(entropy(val)<MIN_ENTROPY||/^(?:x+|your|example|placeholder|changeme)/i.test(val)))continue;
      out.push({name,where,fp:sha(name+val).slice(0,16),hint:name==="Private key"?"":redact(val)});}}
  for(const [n,v] of secretValues())if(text.includes(v))out.push({name:`value of secret ${n}`,where,fp:sha("secret:"+n).slice(0,16),hint:"(exact match)"});
}
function checkSecrets(){
  const out=[];
  // the tree as it is now
  for(const f of git("ls-files","-z").split("\0").filter(Boolean)){
    if(SKIP_FILE.test(f))continue;const p=path.join(ROOT,f);let st;try{st=fs.statSync(p);}catch(e){continue;}
    if(!st.isFile()||st.size>3<<20)continue;scanText(fs.readFileSync(p,"utf8"),f,out);}
  // lines added by commits since the last run (catches a key committed and then deleted: it is still in history)
  const head=git("rev-parse","HEAD").trim();
  let range=["--all"];
  if(state.lastCommit){try{git("cat-file","-e",state.lastCommit+"^{commit}");range=[`${state.lastCommit}..HEAD`];}catch(e){}}
  if(state.lastCommit!==head){
    const shallow=git("rev-parse","--is-shallow-repository").trim()==="true";
    if(shallow&&range[0]==="--all")notes.push("history scan: shallow clone, only recent commits checked");
    const lg=git("log","-p","--no-color","--no-ext-diff","--format=@@COMMIT %h %an: %s",...range);
    let commit="",file="";const buf=[];
    const flush=()=>{if(buf.length&&!SKIP_FILE.test(file))scanText(buf.join("\n"),`${file} (commit ${commit})`,out);buf.length=0;};
    for(const line of lg.split("\n")){
      if(line.startsWith("@@COMMIT ")){flush();commit=line.slice(9,80);}
      else if(line.startsWith("+++ ")){flush();file=line.replace(/^\+\+\+ (b\/)?/,"");}
      else if(line.startsWith("+")&&!line.startsWith("+++"))buf.push(line.slice(1));}
    flush();state.lastCommit=head;mark();
  }
  const byFp={};for(const o of out)(byFp[o.fp]=byFp[o.fp]||{...o,places:new Set()}).places.add(o.where);
  for(const fp in byFp){const o=byFp[fp],places=[...o.places];
    find("secrets","secret:"+fp,`🔑 ${o.name} ${o.hint} in ${places.slice(0,3).join(", ")}${places.length>3?` +${places.length-3} more`:""}`,{urgent:true,priority:5});}
  log(`secrets: ${Object.keys(byFp).length} distinct hit(s)`);
}

// ---------- 2. workflow and script changes ----------
const WATCH_DIRS=env("WATCH_PATHS",".github/workflows,scripts").split(",");
const RISKY=[
  [/\bpull_request_target\b/,"runs on pull_request_target (forks can reach secrets)"],
  [/\$\{\{\s*github\.event\.(issue|pull_request|comment|review|head_commit|commits)[^}]*\.(title|body|message|name|label|ref)\b/,"untrusted event text inside ${{ }} (script injection)"],
  [/permissions:\s*write-all/,"permissions: write-all"],
  [/curl[^\n|]*\|\s*(ba)?sh/,"pipes a download into a shell"],
  [/uses:\s*(?!actions\/|github\/|\.\/)[\w.-]+\/[\w.\/-]+@(?![0-9a-f]{40}\b)/,"third-party action not pinned to a commit SHA"],
];
function checkWorkflows(){
  const now={};
  for(const f of git("ls-files","-z","--",...WATCH_DIRS).split("\0").filter(Boolean)){
    try{now[f]=sha(fs.readFileSync(path.join(ROOT,f)));}catch(e){}}
  const prev=state.fileHashes;
  if(!prev){notes.push(`workflows: baseline of ${Object.keys(now).length} files recorded`);}
  else{
    const added=Object.keys(now).filter(f=>!prev[f]),gone=Object.keys(prev).filter(f=>!now[f]),mod=Object.keys(now).filter(f=>prev[f]&&prev[f]!==now[f]);
    const all=[...added.map(f=>"+ "+f),...mod.map(f=>"~ "+f),...gone.map(f=>"- "+f)];
    if(all.length){
      const who=[...added,...mod,...gone].map(f=>{try{return git("log","-1","--format=%h %an: %s","--",f).trim();}catch(e){return "";}}).filter(Boolean);
      const wf=all.some(x=>x.includes(".github/workflows"));
      find("workflows","wf:"+sha(JSON.stringify(now)).slice(0,16),
        `${wf?"⚙️ Workflow":"📜 Script"} files changed:\n${all.join("\n")}\nLast commits:\n${[...new Set(who)].slice(0,5).join("\n")}\nIf this wasn't you, disable Actions in repo Settings and rotate secrets.`,
        {urgent:wf,priority:wf?4:3});}
  }
  for(const f of Object.keys(now).filter(f=>f.startsWith(".github/workflows"))){
    const txt=fs.readFileSync(path.join(ROOT,f),"utf8");
    for(const [re,why] of RISKY)if(re.test(txt))find("workflows",`risky:${f}:${why}`,`⚠️ ${f}: ${why}`,{urgent:false});}
  state.fileHashes=now;mark();
}

// ---------- 3. Actions run anomalies (learned baseline) ----------
async function checkActions(){
  if(!GH_TOKEN){notes.push("actions: no GITHUB_TOKEN, skipped");return;}
  const since=new Date(Date.now()-ACTIONS_LOOKBACK_H*36e5).toISOString().slice(0,19)+"Z";
  const runs=[];
  for(let page=1;page<=5;page++){
    const j=await fetchJSON(`https://api.github.com/repos/${GH_REPO}/actions/runs?per_page=100&page=${page}&created=%3E%3D${since}`,ghHeaders());
    if(!j)throw new Error("could not list Actions runs");runs.push(...(j.workflow_runs||[]));if((j.workflow_runs||[]).length<100)break;}
  const known=new Set(git("ls-files","--",".github/workflows").split("\n").filter(Boolean));
  const cold=!state.runTuples;if(cold){state.runTuples={};state.runsSince=Date.now();}
  const learning=(Date.now()-state.runsSince)<ACTIONS_WARMUP_DAYS*864e5;
  let fresh=0;
  for(const r of runs){
    const actor=(r.triggering_actor||r.actor||{}).login||"?",wfPath=(r.path||"").split("@")[0];
    const tuple=`${wfPath}|${r.event}|${actor}`,url=r.html_url||"";
    if(!wfPath.startsWith("dynamic/")&&!known.has(wfPath))
      find("actions","unk-wf:"+r.id,`🚨 Actions ran a workflow that isn't in the repo: ${r.name} (${wfPath}) by ${actor} on ${r.head_branch}\n${url}`,{urgent:true,priority:5});
    if(r.event==="pull_request_target")
      find("actions","prt:"+r.id,`🚨 pull_request_target run: ${r.name} by ${actor}\n${url}`,{urgent:true,priority:5});
    if(!state.runTuples[tuple]){
      state.runTuples[tuple]=r.created_at;fresh++;mark();
      if(!learning)find("actions","tuple:"+tuple,`👀 New Actions pattern: "${r.name}" triggered by ${r.event} from ${actor} (branch ${r.head_branch})\n${url}`,{urgent:true,priority:4});}
  }
  notes.push(`actions: ${runs.length} runs in ${ACTIONS_LOOKBACK_H}h, ${Object.keys(state.runTuples).length} known patterns${learning?` (learning until ${new Date(state.runsSince+ACTIONS_WARMUP_DAYS*864e5).toISOString().slice(0,10)})`:""}`);
  log(`actions: ${runs.length} runs, ${fresh} new patterns, learning=${learning}`);
}

// ---------- 4. live site integrity + 5c. malicious links ----------
const hostOf=u=>{try{return new URL(u,LIVE_URL).hostname.toLowerCase();}catch(e){return null;}};
function tagHosts(html){   // hosts the page EXECUTES or SUBMITS to (where a skimmer/defacement would show up)
  const out=new Set();const re=/<(script|iframe|form|embed|object)\b[^>]*?\b(?:src|action|data)\s*=\s*["']([^"']+)["']/gi;let m;
  while((m=re.exec(html))){const h=hostOf(m[2]);if(h)out.add(`${m[1].toLowerCase()}:${h}`);}return out;}
function linkHosts(html){const out=new Set();const re=/\b(?:href|src)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;let m;
  while((m=re.exec(html))){const h=hostOf(m[1]);if(h)out.add(h);}return out;}
function repoHtml(){return git("ls-files","-z","--","*.html").split("\0").filter(Boolean).map(f=>[f,fs.readFileSync(path.join(ROOT,f),"utf8")]);}
let livePages=[];
async function checkSite(){
  const allowed=new Set([hostOf(LIVE_URL),...SAFE_HOSTS]);
  for(const [,h] of repoHtml())for(const t of tagHosts(h))allowed.add(t.split(":")[1]);
  let got=0;
  for(const p of LIVE_PAGES){
    const html=await fetchText(LIVE_URL+p);if(html==null){notes.push(`site: could not load ${p}`);continue;}got++;livePages.push([p,html]);
    for(const t of tagHosts(html)){const [tag,h]=t.split(":");
      if(!allowed.has(h))find("site",`site:${p}:${t}`,`🚨 Live page ${p} loads a <${tag}> from ${h}, which the repo never uses (possible injected script or defacement).\n${LIVE_URL}${p}`,{urgent:true,priority:5});}
    for(const [n,v] of secretValues())if(html.includes(v))find("site",`site-secret:${n}`,`🔑 The live site (${p}) contains the value of secret ${n}. Rotate it now.`,{urgent:true,priority:5});
  }
  if(!got)throw new Error("live site unreachable");
  log(`site: ${got}/${LIVE_PAGES.length} pages checked, ${allowed.size} allowed script hosts`);
}

// ---------- 5. world threat intel ----------
const vparse=v=>{const m=String(v||"").replace(/^v/i,"").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);return m?[+m[1],+(m[2]||0),+(m[3]||0)]:null;};
const vcmp=(a,b)=>{for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
function inRange(v,range){   // GitHub advisory ranges: ">= 1.0.0, < 4.2.1" / "<= 3.0" / "= 45.0.7"
  return String(range||"").split(",").map(s=>s.trim()).filter(Boolean).every(c=>{const m=c.match(/^(>=|<=|>|<|=)\s*(.+)$/);if(!m)return true;
    const w=vparse(m[2]);if(!w)return true;const d=vcmp(v,w);return {">=":d>=0,"<=":d<=0,">":d>0,"<":d<0,"=":d===0}[m[1]];});}
function usedActions(){
  const used={};
  for(const f of git("ls-files","--",".github/workflows").split("\n").filter(Boolean)){
    const re=/uses:\s*([\w.-]+\/[\w.-]+)(?:\/[\w.\/-]*)?@([\w.\-]+)/g;let m;const t=fs.readFileSync(path.join(ROOT,f),"utf8");
    while((m=re.exec(t))){const k=m[1].toLowerCase();(used[k]=used[k]||new Set()).add(m[2]);}}
  return used;
}
const intel={kevNew:[],kevTotal:0,ghsaHits:0,urlhausHosts:0,urlhausOk:false};
async function checkIntel(){
  // 5a. CISA KEV: vulnerabilities confirmed exploited in the wild, added as attacks are observed
  const kev=await fetchJSON(KEV_URL);
  if(kev&&Array.isArray(kev.vulnerabilities)){
    intel.kevTotal=kev.vulnerabilities.length;
    const cold=!state.kevSeen;const seen=new Set(state.kevSeen||[]);
    const recentCut=new Date(Date.now()-3*864e5).toISOString().slice(0,10);
    for(const v of kev.vulnerabilities){
      if(seen.has(v.cveID))continue;seen.add(v.cveID);
      if(cold&&!(v.dateAdded>=recentCut))continue;   // cold start: only the last 3 days count as news
      intel.kevNew.push(v);
      state.kevPending.push({cveID:v.cveID,vendorProject:v.vendorProject,product:v.product,dateAdded:v.dateAdded,knownRansomwareCampaignUse:v.knownRansomwareCampaignUse});
      const hay=`${v.vendorProject} ${v.product} ${v.vulnerabilityName}`.toLowerCase();
      const hit=KEV_WATCH.find(k=>new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z]|$)`).test(hay));
      if(hit)find("intel","kev:"+v.cveID,`🌍 Actively exploited now, affects something you use (${hit}):\n${v.cveID} ${v.vendorProject} ${v.product}: ${v.vulnerabilityName}\n${(v.shortDescription||"").slice(0,300)}\nFix: ${(v.requiredAction||"").slice(0,200)}${v.knownRansomwareCampaignUse==="Known"?"\n☠️ Used by ransomware":""}`,{urgent:true,priority:4});
    }
    state.kevSeen=[...seen];state.kevPending=state.kevPending.slice(-300);mark();
  }else failures.push("intel: CISA KEV feed unavailable");

  // 5b. GitHub advisories for the Actions ecosystem vs the actions our workflows run (supply-chain attacks)
  const ghsa=await fetchJSON(GHSA_URL,ghHeaders());
  if(Array.isArray(ghsa)){
    const used=usedActions();
    for(const a of ghsa)for(const v of a.vulnerabilities||[]){
      const name=((v.package||{}).name||"").toLowerCase();if(!used[name])continue;
      const patched=typeof v.first_patched_version==="string"?v.first_patched_version:(v.first_patched_version||{}).identifier;
      for(const ref of used[name]){
        if(/^[0-9a-f]{40}$/.test(ref))continue;   // pinned to a commit: check by hand, not by version
        const rv=vparse(ref);if(!rv)continue;const exact=/^v?\d+\.\d+\.\d+$/.test(ref);
        // a floating major tag (v4) tracks the newest v4.x, so it is only stuck if no patched release exists in that major
        const pv=vparse(patched);
        const affected=exact?inRange(rv,v.vulnerable_version_range)
          :([[rv[0],0,0],[rv[0],999,999]].some(x=>inRange(x,v.vulnerable_version_range))&&(!pv||pv[0]!==rv[0]));
        if(affected){intel.ghsaHits++;find("intel",`ghsa:${a.ghsa_id}:${name}@${ref}`,
          `🧬 ${name}@${ref} is affected by ${a.ghsa_id} (${a.severity}): ${a.summary}\nVulnerable: ${v.vulnerable_version_range}; fixed in ${patched||"no release yet"}\n${a.html_url||""}`,{urgent:true,priority:a.severity==="critical"||a.severity==="high"?5:4});}
      }}
  }else failures.push("intel: GitHub advisory feed unavailable");

  // 5c. URLhaus: hosts serving malware right now, vs every external link in the repo's pages and the live site
  const uh=await fetchText(URLHAUS_URL,process.env.ABUSECH_AUTH_KEY?{"Auth-Key":process.env.ABUSECH_AUTH_KEY}:{});
  if(uh){
    const bad=new Set();for(const l of uh.split("\n")){if(!l||l[0]==="#")continue;const h=l.trim().split(/\s+/).pop().toLowerCase();if(h&&h!=="localhost")bad.add(h);}
    intel.urlhausHosts=bad.size;intel.urlhausOk=bad.size>0;
    const where={};
    for(const [f,h] of [...repoHtml(),...livePages.map(([p,h])=>["live:"+p,h])])for(const host of linkHosts(h))if(bad.has(host))(where[host]=where[host]||[]).push(f);
    for(const host in where)find("intel","urlhaus:"+host,`☣️ ${host} is on URLhaus (serving malware now) and is linked from ${where[host].slice(0,4).join(", ")}${where[host].length>4?` +${where[host].length-4} more`:""}. Remove or replace the link.`,{urgent:true,priority:5});
  }else failures.push("intel: URLhaus feed unavailable (set ABUSECH_AUTH_KEY if abuse.ch now requires one)");
}

// ---------- brief ----------
function brief(){
  const L=[];
  const kev=(state.kevPending||[]).slice().sort((a,b)=>(b.dateAdded||"").localeCompare(a.dateAdded||""));
  L.push(`🌍 Exploited in the wild (CISA KEV, ${intel.kevTotal} total): ${kev.length} new since last brief`);
  for(const v of kev.slice(0,KEV_DIGEST_MAX))L.push(`• ${v.cveID} ${v.vendorProject} ${v.product}${v.knownRansomwareCampaignUse==="Known"?" ☠️ransomware":""}`);
  if(kev.length>KEV_DIGEST_MAX)L.push(`  …and ${kev.length-KEV_DIGEST_MAX} more`);
  L.push(`☣️ URLhaus: ${intel.urlhausOk?`${intel.urlhausHosts.toLocaleString()} malware hosts checked against your links`:"unavailable"}`);
  L.push(`🧬 Actions advisories affecting your workflows: ${intel.ghsaHits}`);
  const pend=state.pending||[];
  if(pend.length){L.push("","Lower-priority findings:");for(const p of pend.slice(0,15))L.push(p);}
  L.push("",...notes.map(n=>"· "+n),...failures.map(f=>"✖ "+f));
  return L.join("\n");
}

async function main(){
  const t0=Date.now(),{date,hour}=etNow();
  const steps=[["secrets",checkSecrets],["workflows",checkWorkflows],["site",checkSite],["actions",checkActions],["intel",checkIntel]];
  for(const [name,fn] of steps){if(!CHECKS.has(name))continue;
    try{await fn();}catch(e){log(name,"FAILED",e.stack||e.message);failures.push(`${name}: ${e.message}`);}}

  const urgent=findings.filter(f=>f.urgent),later=findings.filter(f=>!f.urgent);
  if(urgent.length){
    const top=Math.max(...urgent.map(f=>f.priority));
    await ntfy(`🛡️ Security Watch: ${urgent.length} alert${urgent.length>1?"s":""}`,urgent.map(f=>f.text).join("\n\n"),top,["rotating_light","shield"]);}
  for(const f of findings)state.alerted[f.key]=new Date().toISOString();
  if(findings.length)mark();
  state.pending=[...(state.pending||[]),...later.map(f=>f.text)].slice(-50);

  if(DIGEST&&state.digestDate!==date&&hour>=DIGEST_HOUR){
    await ntfy(`🛡️ Daily security brief, ${date}`,brief()+(urgent.length?`\n\n${urgent.length} urgent alert(s) were sent separately.`:"\n\nNo urgent findings on your repo or site."),2,["shield","globe_with_meridians"]);
    state.digestDate=date;state.pending=[];state.kevPending=[];mark();
  }else if(DRY)log("brief preview:\n"+brief());
  log(`done in ${((Date.now()-t0)/1000).toFixed(1)}s: ${urgent.length} urgent, ${later.length} for the brief, ${failures.length} failed check(s)`);
  save();
  if(failures.length&&failures.length>=[...CHECKS].length)process.exitCode=1;   // everything failed: let the run go red
}
if(require.main===module)main().catch(async e=>{console.error(e);try{await ntfy("Security Watch bot error",String(e.stack||e).slice(0,1500),2,["warning"]);}catch(_){}process.exit(1);});
module.exports={scanText,inRange,vparse,tagHosts,linkHosts,entropy};
