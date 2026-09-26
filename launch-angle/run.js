// Launch Angle Edges: daily matchup scan + ntfy alerts.
// MODE=morning  -> probable starters vs each team's active hitters, one "top edges" push
// MODE=lineups  -> once a game's lineups post, one push per game with its edges (sent once)
const fs=require("fs"),path=require("path");
const M=require("./model");

const MODE=process.env.MODE||"morning";
const DRY=process.env.DRY_RUN==="1";
const NTFY_SERVER=(process.env.NTFY_SERVER||"https://ntfy.sh").replace(/\/$/,"");
const NTFY_TOPIC=process.env.NTFY_TOPIC;
const NTFY_TOKEN=process.env.NTFY_TOKEN||"";
const FENCE=+(process.env.FENCE||380);
const MIN_EDGE=+(process.env.MIN_EDGE||0.03);   // window % above hitter's own baseline
const GAP_LO=+(process.env.GAP_LO||5), GAP_HI=+(process.env.GAP_HI||12);
const TOP_N=+(process.env.TOP_N||8);
const CACHE=path.join(__dirname,".cache");fs.mkdirSync(CACHE,{recursive:true});
const UA={"User-Agent":"Mozilla/5.0 (d3vil-sports launch-angle bot)"};

const etDate=(d=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(d);
const TODAY=process.env.DATE||etDate();
const YEAR=+TODAY.slice(0,4);
const log=(...a)=>console.log("[la]",...a);

// ---------- small CSV parser (handles quotes) ----------
function parseCSV(text){
  text=text.replace(/^\uFEFF/,"");const rows=[];let row=[],f="",q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;else if(c===","){row.push(f);f="";}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(f);f="";if(row.length>1||row[0]!=="")rows.push(row);row=[];}
    else f+=c;}
  if(f!==""||row.length){row.push(f);rows.push(row);}
  if(!rows.length)return [];const h=rows.shift();
  return rows.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??""])));
}
// ---------- cache helpers ----------
function cached(name,maxAgeH){const p=path.join(CACHE,name);if(!fs.existsSync(p))return null;
  try{const d=JSON.parse(fs.readFileSync(p,"utf8"));if((Date.now()-d.at)/36e5<=maxAgeH)return d.v;}catch(e){}return null;}
function store(name,v){fs.writeFileSync(path.join(CACHE,name),JSON.stringify({at:Date.now(),v}));return v;}
async function get(url,asText){
  for(let a=0;a<3;a++){try{const r=await fetch(url,{headers:UA});if(r.ok)return asText?r.text():r.json();log("HTTP",r.status,url.slice(0,90));}
    catch(e){log("fetch error",e.message);}await new Promise(s=>setTimeout(s,2000*(a+1)));}
  return null;
}
// ---------- Savant ----------
const LB=y=>[
  `https://baseballsavant.mlb.com/leaderboard/bat-tracking?year=${y}&csv=true`,
  `https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle?year=${y}&csv=true`,
  `https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${y}&position=&team=&min=25&csv=true`];
async function hitterProfiles(){
  const hit=cached("hitters.json",24*7);if(hit)return hit;
  for(const y of [YEAR,YEAR-1]){
    const files=[];
    for(const u of LB(y)){const t=await get(u,true);if(t&&t.includes(","))files.push(parseCSV(t));}
    // optional manual drop-ins: launch-angle/data/*.csv
    const dd=path.join(__dirname,"data");
    if(fs.existsSync(dd))for(const f of fs.readdirSync(dd))if(f.endsWith(".csv"))files.push(parseCSV(fs.readFileSync(path.join(dd,f),"utf8")));
    const r=M.hittersFrom(files);log(`hitters ${y}: ${r.list.length}`);
    if(r.list.length>=100)return store("hitters.json",Object.fromEntries(r.list.map(h=>[h.id,h])));
  }
  throw new Error("Could not build hitter profiles from Savant. Drop leaderboard CSVs into launch-angle/data/.");
}
const SEARCH=(id,y)=>"https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfPT=&hfAB=&hfGT=R%7CF%7CD%7CL%7CW%7C&hfPR=&hfZ=&hfStadium=&hfBBL=&hfNewZones=&hfPull=&hfC=&hfSea="+y+"%7C&hfSit=&player_type=pitcher&hfOuts=&hfOpponent=&pitcher_throws=&batter_stands=&hfSA=&game_date_gt=&game_date_lt=&hfMo=&hfTeam=&home_road=&hfRO=&position=&hfInfield=&hfOutfield=&hfInn=&hfBBT=&hfFlag=&pitchers_lookup%5B%5D="+id+"&metric_1=&group_by=name&min_pitches=0&min_results=0&min_pas=0&sort_col=pitches&player_event_sort=api_p_release_speed&sort_order=desc&type=details";
async function pitcherProfile(id,name){
  const key=`p-${id}.json`;const hit=cached(key,20);if(hit)return hit;
  let rows=[];
  for(const y of [YEAR,YEAR-1]){const t=await get(SEARCH(id,y),true);if(t)rows=rows.concat(parseCSV(t));if(rows.length>=400)break;}
  const r=M.pitchersFrom([rows]);const p=r.list[0]||null;
  if(p)p.name=name;log(`pitcher ${name}: ${rows.length} pitches, ${p?p.pitches.length:0} types`);
  return store(key,p);
}
// ---------- MLB schedule / rosters ----------
async function schedule(){
  const j=await get(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${TODAY}&hydrate=probablePitcher,lineups,team`);
  return (j&&j.dates&&j.dates[0]?j.dates[0].games:[]).filter(g=>g.status.abstractGameState==="Preview"||g.status.detailedState==="Warmup");
}
async function rosterHitters(teamId){
  const key=`r-${teamId}-${TODAY}.json`;const hit=cached(key,12);if(hit)return hit;
  const j=await get(`https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active`);
  const list=(j?j.roster:[]).filter(p=>p.position.type!=="Pitcher").map(p=>({id:String(p.person.id),name:p.person.fullName}));
  return store(key,list);
}
// ---------- scoring ----------
function score(hitter,pitcher,hitterName,team,oppP){
  const m=M.matchup(hitter,pitcher,FENCE);
  const base=M.matchup(hitter,M.LEAGUE_AVG_PITCHER,FENCE);
  return {name:hitterName,team,pitcher:oppP,win:m.win,hr:m.hr,edge:m.win-base.win,hrEdge:m.hr-base.hr,gap:m.gap,prim:m.prim.label};
}
const isEdge=r=>r.edge>=MIN_EDGE&&r.gap>=GAP_LO&&r.gap<=GAP_HI;
const pct=v=>Math.round(v*100)+"%";
const sgn=v=>(v>=0?"+":"")+Math.round(v*100);
const line=r=>`${r.name} (${r.team}) vs ${r.pitcher}: HR contact ${pct(r.hr)} (${sgn(r.hrEdge)}), window ${pct(r.win)} (${sgn(r.edge)}), gap ${r.gap>=0?"+":""}${r.gap.toFixed(1)}° vs ${r.prim}`;

async function ntfy(title,message,priority=3,tags=["baseball"]){
  if(DRY||!NTFY_TOPIC){log("DRY ntfy:",title,"\n"+message);return;}
  const h={"Content-Type":"application/json"};if(NTFY_TOKEN)h.Authorization="Bearer "+NTFY_TOKEN;
  const r=await fetch(NTFY_SERVER,{method:"POST",headers:h,body:JSON.stringify({topic:NTFY_TOPIC,title,message:message.slice(0,3900),priority,tags})});
  log("ntfy",r.status);
}
async function sideRows(game,side,H,useLineup){
  const opp=side==="home"?"away":"home";
  const pp=game.teams[opp].probablePitcher;if(!pp)return [];
  const P=await pitcherProfile(pp.id,pp.fullName);if(!P)return [];
  const team=game.teams[side].team.abbreviation||game.teams[side].team.name;
  const lu=game.lineups&&game.lineups[side+"Players"];
  const hitters=useLineup&&lu&&lu.length?lu.map(p=>({id:String(p.id),name:p.fullName})):await rosterHitters(game.teams[side].team.id);
  return hitters.filter(h=>H[h.id]).map(h=>score(H[h.id],P,h.name,team,pp.fullName));
}
(async()=>{
  const games=await schedule();log(`${TODAY}: ${games.length} upcoming games, mode=${MODE}`);
  if(!games.length)return;
  const H=await hitterProfiles();
  if(MODE==="morning"){
    const sentKey=`morning-${TODAY}.json`;if(cached(sentKey,30)&&!DRY){log("morning already sent");return;}
    let all=[];for(const g of games)for(const s of ["home","away"])all=all.concat(await sideRows(g,s,H,false));
    const edges=all.filter(isEdge).sort((a,b)=>b.hr-a.hr).slice(0,TOP_N);
    const noSP=games.filter(g=>!g.teams.home.probablePitcher||!g.teams.away.probablePitcher).length;
    const msg=edges.length?edges.map((r,i)=>`${i+1}. ${line(r)}`).join("\n"):"No hitters clear the edge bar today.";
    await ntfy(`Launch Angle Edges ${TODAY}`,msg+(noSP?`\n\n${noSP} game(s) still missing a probable starter.`:""),edges.length?4:2,["baseball","chart_with_upwards_trend"]);
    if(!DRY&&NTFY_TOPIC)store(sentKey,true);
  }else{
    const sent=cached(`lineups-${TODAY}.json`,30)||{};
    for(const g of games){
      if(sent[g.gamePk])continue;
      const lu=g.lineups;if(!lu||!lu.homePlayers?.length||!lu.awayPlayers?.length)continue;
      const rows=[...await sideRows(g,"home",H,true),...await sideRows(g,"away",H,true)];
      const edges=rows.filter(isEdge).sort((a,b)=>b.hr-a.hr);
      const matchup=`${g.teams.away.team.abbreviation||g.teams.away.team.name} @ ${g.teams.home.team.abbreviation||g.teams.home.team.name}`;
      const t=new Date(g.gameDate).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"});
      if(edges.length) await ntfy(`${matchup} ${t} ET: ${edges.length} edge${edges.length>1?"s":""}`,edges.map(line).join("\n"),4,["baseball"]);
      else log(`${matchup}: lineups in, no edges`);
      sent[g.gamePk]=true;
    }
    if(!DRY&&NTFY_TOPIC)store(`lineups-${TODAY}.json`,sent);
  }
})().catch(async e=>{console.error(e);await ntfy("Launch Angle bot error",String(e.message||e),2,["warning"]).catch(()=>{});process.exit(1);});
