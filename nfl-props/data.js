// nflverse + Sleeper loaders. Everything is rolled up into per-game team and player records;
// the model decides which games count (only games before the week being projected).
const {parseCSV,getText,getJSON,readState,writeState,log,normName}=require("./lib");

const NV="https://github.com/nflverse/nflverse-data/releases/download";
const GAMES_URL="https://github.com/nflverse/nfldata/raw/master/data/games.csv";
const SKILL={QB:"QB",RB:"RB",FB:"RB",WR:"WR",TE:"TE"};
const ord=(season,week)=>season*100+week;

// ---------- schedule (with spread/total lines, roof, stadium) ----------
const GAME_COLS=["game_id","season","game_type","week","gameday","gametime","away_team","home_team","away_score","home_score",
  "result","spread_line","total_line","roof","temp","wind","stadium_id","stadium",
  // used by nfl-lines
  "location","div_game","home_rest","away_rest","home_moneyline","away_moneyline","home_qb_id","away_qb_id","home_qb_name","away_qb_name"];
async function schedule(seasons){
  const t=await getText(GAMES_URL);if(!t)throw new Error("Could not download the nflverse schedule (games.csv).");
  return parseCSV(t,GAME_COLS).filter(g=>seasons.includes(+g.season)).map(g=>({...g,season:+g.season,week:+g.week}));
}

// ---------- play-by-play -> per-game team + player records ----------
const PBP_COLS=["game_id","play_id","season","week","posteam","defteam","play_type","sack","qb_scramble","qb_hit",
  "two_point_attempt","passer_player_id","receiver_player_id","rusher_player_id","passing_yards","receiving_yards",
  "rushing_yards","yards_gained","complete_pass","air_yards"];
const newTeamGame=(gid,season,week,team,opp)=>({gid,season,week,o:ord(season,week),team,opp,plays:0,pp:0,att:0,sacks:0,tgts:0,rush:0,
  press:0,cleanPP:0,cleanYds:0,pressPP:0,pressYds:0,passYds:0,ftnPP:0,blz:0,ftnRuns:0,stack:0,rbCar:0,rbYds:0,
  pos:{WR:{t:0,r:0,y:0},TE:{t:0,r:0,y:0},RB:{t:0,r:0,y:0}}});
const newPlayerGame=(gid,season,week,team,opp)=>({gid,season,week,o:ord(season,week),team,opp,snap:null,tgt:0,rec:0,ryds:0,air:0,
  car:0,ruyds:0,pp:0,pyds:0,cleanPP:0,cleanYds:0,pressPP:0,pressYds:0,blzPP:0,blzYds:0,noPP:0,noYds:0,stCar:0,stYds:0,ltCar:0,ltYds:0});

async function rosters(seasons){
  const P=new Map();
  for(const s of seasons.slice().sort()){   // later season overwrites earlier
    const t=await getText(`${NV}/rosters/roster_${s}.csv`);if(!t){log("no roster file for",s);continue;}
    for(const r of parseCSV(t,["gsis_id","full_name","position","team","status","pfr_id","sleeper_id"])){
      if(!r.gsis_id)continue;
      P.set(r.gsis_id,{id:r.gsis_id,name:r.full_name,pos:SKILL[r.position]||r.position,team:r.team,status:r.status,pfr:r.pfr_id,season:s});
    }
  }
  return P;
}

async function ftn(seasons){
  const F=new Map();
  for(const s of seasons){
    const t=await getText(`${NV}/ftn_charting/ftn_charting_${s}.csv`);if(!t){log("no FTN charting for",s);continue;}
    for(const r of parseCSV(t,["nflverse_game_id","nflverse_play_id","n_blitzers","n_defense_box"]))
      F.set(r.nflverse_game_id+"|"+r.nflverse_play_id,{blitz:+r.n_blitzers>0,stack:+r.n_defense_box>=8});
  }
  return F;
}

async function snaps(seasons,players){
  const byPfr=new Map(),byName=new Map();
  for(const p of players.values()){if(p.pfr)byPfr.set(p.pfr,p.id);byName.set(p.name.toLowerCase()+"|"+p.team,p.id);}
  const out=[];let miss=0;
  for(const s of seasons){
    const t=await getText(`${NV}/snap_counts/snap_counts_${s}.csv`);if(!t){log("no snap counts for",s);continue;}
    for(const r of parseCSV(t,["game_id","season","week","player","pfr_player_id","position","team","opponent","offense_pct","offense_snaps"])){
      if(!SKILL[r.position]||!(+r.offense_snaps>0))continue;
      const id=byPfr.get(r.pfr_player_id)||byName.get(r.player.toLowerCase()+"|"+r.team);
      if(!id){miss++;continue;}
      out.push({id,gid:r.game_id,season:+r.season,week:+r.week,team:r.team,opp:r.opponent,pct:+r.offense_pct});
    }
  }
  if(miss)log(`snap counts: ${miss} skill-player rows could not be matched to a gsis id`);
  return out;
}

// Man/zone from the previous season's participation file (the current season isn't published).
async function coverage(season,pbpPrev){
  const t=await getText(`${NV}/pbp_participation/pbp_participation_${season}.csv`);
  const cov={def:{},rec:{},lgMan:0.33};
  if(!t){log("no participation file for",season,"- man/zone matchup disabled");return cov;}
  const MZ=new Map();
  for(const r of parseCSV(t,["nflverse_game_id","play_id","defense_man_zone_type"]))
    if(r.defense_man_zone_type)MZ.set(r.nflverse_game_id+"|"+r.play_id,r.defense_man_zone_type==="MAN_COVERAGE");
  let man=0,n=0;
  for(const p of pbpPrev){
    if(p.play_type!=="pass"||p.sack==="1"||!p.receiver_player_id)continue;
    const m=MZ.get(p.game_id+"|"+p.play_id);if(m==null)continue;
    const d=cov.def[p.defteam]||(cov.def[p.defteam]={man:0,n:0});d.n++;if(m)d.man++;man+=m;n++;
    const r=cov.rec[p.receiver_player_id]||(cov.rec[p.receiver_player_id]={mT:0,mY:0,zT:0,zY:0});
    const y=+p.receiving_yards||0;if(m){r.mT++;r.mY+=y;}else{r.zT++;r.zY+=y;}
  }
  if(n)cov.lgMan=man/n;
  log(`coverage ${season}: ${n} charted targets, league man rate ${(cov.lgMan*100).toFixed(0)}%`);
  return cov;
}

async function pbp(season){
  const t=await getText(`${NV}/pbp/play_by_play_${season}.csv.gz`);
  if(!t){log("no play-by-play for",season);return [];}
  return parseCSV(t,PBP_COLS);
}

function rollUp(plays,players,F,TG,PG){
  const tg=(gid,s,w,team,opp)=>{const k=gid+"|"+team;let r=TG.get(k);if(!r)TG.set(k,r=newTeamGame(gid,s,w,team,opp));return r;};
  const pg=(id,gid,s,w,team,opp)=>{let m=PG.get(id);if(!m)PG.set(id,m=new Map());let r=m.get(gid);if(!r)m.set(gid,r=newPlayerGame(gid,s,w,team,opp));return r;};
  for(const p of plays){
    if(p.two_point_attempt==="1"||!p.posteam)continue;
    const isPass=p.play_type==="pass",isRun=p.play_type==="run";if(!isPass&&!isRun)continue;
    const s=+p.season,w=+p.week,o=tg(p.game_id,s,w,p.posteam,p.defteam);
    const f=F.get(p.game_id+"|"+p.play_id);o.plays++;
    if(isPass){
      const sack=p.sack==="1",press=sack||p.qb_hit==="1",py=+p.passing_yards||0;
      o.pp++;if(sack)o.sacks++;else o.att++;o.passYds+=py;
      if(press){o.press++;o.pressPP++;o.pressYds+=py;}else{o.cleanPP++;o.cleanYds+=py;}
      if(f){o.ftnPP++;if(f.blitz)o.blz++;}
      if(p.passer_player_id){const q=pg(p.passer_player_id,p.game_id,s,w,p.posteam,p.defteam);
        q.pp++;q.pyds+=py;if(press){q.pressPP++;q.pressYds+=py;}else{q.cleanPP++;q.cleanYds+=py;}
        if(f){if(f.blitz){q.blzPP++;q.blzYds+=py;}else{q.noPP++;q.noYds+=py;}}}
      if(!sack&&p.receiver_player_id){
        const pos=(players.get(p.receiver_player_id)||{}).pos,ry=+p.receiving_yards||0,c=p.complete_pass==="1"?1:0;
        o.tgts++;const b=o.pos[pos];if(b){b.t++;b.r+=c;b.y+=ry;}
        const r=pg(p.receiver_player_id,p.game_id,s,w,p.posteam,p.defteam);r.tgt++;r.rec+=c;r.ryds+=ry;r.air+=+p.air_yards||0;
      }
    }else{
      o.rush++;const ru=p.rushing_yards!==""?+p.rushing_yards:+p.yards_gained||0;
      if(f){o.ftnRuns++;if(f.stack)o.stack++;}
      if(p.rusher_player_id){
        const r=pg(p.rusher_player_id,p.game_id,s,w,p.posteam,p.defteam);r.car++;r.ruyds+=ru;
        if((players.get(p.rusher_player_id)||{}).pos==="RB"){o.rbCar++;o.rbYds+=ru;
          if(f){if(f.stack){r.stCar++;r.stYds+=ru;}else{r.ltCar++;r.ltYds+=ru;}}}
      }
    }
  }
}

// Build everything the model needs for projecting season S (uses S-1 as the prior).
async function load(S){
  const t0=Date.now(),seasons=[S-1,S];
  const [games,players,F]=await Promise.all([schedule(seasons),rosters(seasons),ftn(seasons)]);
  const prev=await pbp(S-1),cur=await pbp(S);
  const cov=await coverage(S-1,prev);
  const TG=new Map(),PG=new Map();
  rollUp(prev,players,F,TG,PG);rollUp(cur,players,F,TG,PG);
  // snap share; also creates records for players who played but never touched the ball
  for(const r of await snaps(seasons,players)){
    let m=PG.get(r.id);if(!m)PG.set(r.id,m=new Map());
    let g=m.get(r.gid);if(!g)m.set(r.gid,g=newPlayerGame(r.gid,r.season,r.week,r.team,r.opp));g.snap=r.pct;
  }
  const pg=new Map();for(const [id,m] of PG)pg.set(id,[...m.values()].sort((a,b)=>a.o-b.o));
  const tgList=[...TG.values()].sort((a,b)=>a.o-b.o);
  log(`data for ${S}: ${games.length} scheduled games, ${prev.length+cur.length} plays, ${tgList.length} team-games, ${pg.size} players (${((Date.now()-t0)/1000).toFixed(0)}s)`);
  return {S,games,players,cov,tg:tgList,pg};
}

// ---------- live-only extras ----------
async function depthCharts(S){
  const t=await getText(`${NV}/depth_charts/depth_charts_${S}.csv.gz`);const D={};if(!t)return D;
  const rows=parseCSV(t,["dt","team","gsis_id","pos_abb","pos_rank"]);
  const last={};for(const r of rows)if(!last[r.team]||r.dt>last[r.team])last[r.team]=r.dt;
  for(const r of rows){if(r.dt!==last[r.team]||!SKILL[r.pos_abb]||!r.gsis_id)continue;
    const t2=D[r.team]||(D[r.team]={});const pos=SKILL[r.pos_abb];(t2[pos]||(t2[pos]=[])).push([+r.pos_rank,r.gsis_id]);}
  for(const t2 of Object.values(D))for(const k in t2)t2[k]=t2[k].sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
  return D;
}
async function injuryReport(S,week){
  const t=await getText(`${NV}/injuries/injuries_${S}.csv`);const I=new Map();if(!t)return I;
  for(const r of parseCSV(t,["week","gsis_id","report_status","practice_status"]))
    if(+r.week===week&&r.gsis_id)I.set(r.gsis_id,r.report_status||"");
  return I;
}
// Sleeper asks for /players/nfl at most about once a day; we keep a trimmed copy in state.
const SLEEPER_TEAM={LAR:"LA",OAK:"LV",SD:"LAC",STL:"LA",JAC:"JAX"};
async function sleeper(maxAgeH){
  const hit=readState("sleeper.json",maxAgeH);if(hit)return hit;
  const j=await getJSON("https://api.sleeper.app/v1/players/nfl");
  if(!j){log("Sleeper unavailable - using nflverse injury report only");return readState("sleeper.json")||{};}
  const out={};
  for(const p of Object.values(j)){
    const row=[SLEEPER_TEAM[p.team]||p.team||"",p.injury_status||"",p.status||""];
    if(p.gsis_id&&SKILL[p.position])out[String(p.gsis_id).trim()]=row;
    // defensive backs (for nfl-lines' missing-starting-CB tag): Sleeper lists most as "DB" with no gsis id,
    // so key them by name + team as well
    if(["CB","DB","S"].includes(p.position)&&row[0]){if(p.gsis_id)out[String(p.gsis_id).trim()]=row;out["n:"+normName(p.full_name)+"|"+row[0]]=row;}
  }
  log(`Sleeper: ${Object.keys(out).length} skill players refreshed`);
  return writeState("sleeper.json",out);
}

module.exports={schedule,load,depthCharts,injuryReport,sleeper,ord,SKILL};
