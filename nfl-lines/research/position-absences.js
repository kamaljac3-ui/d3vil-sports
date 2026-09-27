// Research: missing starters at every position group, on both sides of the ball.
//   node nfl-lines/research/position-absences.js      (FROM=2013 TO=2025; snap counts start in 2013)
// Starter = played >= the group's snap threshold in at least 2 of the team's previous 3 games (same season).
// Missing = < 10% of snaps (or absent) in this game.
// Offensive absences are scored on that team's offense; defensive absences on the OPPONENT's offense.
// Market columns are vs. the closing line (implied team total from spread/total; spread).
const fs=require("fs"),path=require("path");
const {parseCSV,getText,log,env}=require("../../nfl-props/lib");
const NV="https://github.com/nflverse/nflverse-data/releases/download";
const FROM=env("FROM",2013),TO=env("TO",2025);

// snap-count position -> [group, side, starter threshold]
const GROUP={T:["OL","off",0.8],G:["OL","off",0.8],C:["OL","off",0.8],OL:["OL","off",0.8],
  WR:["WR","off",0.6],TE:["TE","off",0.6],RB:["RB","off",0.5],HB:["RB","off",0.5],
  DE:["DL","def",0.55],DT:["DL","def",0.55],NT:["DL","def",0.55],DL:["DL","def",0.55],
  LB:["LB","def",0.6],OLB:["LB","def",0.6],ILB:["LB","def",0.6],MLB:["LB","def",0.6],
  CB:["CB","def",0.7],S:["S","def",0.7],FS:["S","def",0.7],SS:["S","def",0.7]};
const OFF=["OL","WR","TE","RB"],DEF=["DL","LB","CB","S"];

const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/(a.length-1));};
const cell=(a,d=1)=>{a=a.filter(v=>v!=null&&!isNaN(v));if(a.length<25)return "-";const m=mean(a),se=sd(a)/Math.sqrt(a.length);
  return `${m>=0?"+":""}${m.toFixed(d)}±${se.toFixed(d)}${Math.abs(m/se)>=2.5?" **":Math.abs(m/se)>=2?" *":""}`;};
const cov=R=>{const c=R.map(r=>r.ats).filter(x=>x!==0);return c.length>=25?(100*c.filter(x=>x>0).length/c.length).toFixed(1)+"%":"-";};

(async()=>{
  const G={};
  for(const g of parseCSV(await getText("https://github.com/nflverse/nfldata/raw/master/data/games.csv")))
    if(+g.season>=FROM&&+g.season<=TO&&g.result!==""&&g.spread_line!==""&&g.total_line!==""&&g.game_type==="REG")G[g.game_id]=g;
  const rows=[];   // one row per offense per game, with the missing-starter counts on its side and the defense it faced
  for(let S=FROM;S<=TO;S++){
    const sn=parseCSV(await getText(`${NV}/snap_counts/snap_counts_${S}.csv`)||"",["game_id","week","position","team","pfr_player_id","offense_pct","defense_pct","game_type"]);
    const snaps={};   // team -> game_id -> {pfr: [group, pct]}
    for(const r of sn){const gp=GROUP[r.position];if(!gp||r.game_type!=="REG"||!G[r.game_id])continue;
      const pct=gp[1]==="off"?+r.offense_pct:+r.defense_pct;
      ((snaps[r.team]||(snaps[r.team]={}))[r.game_id]||(snaps[r.team][r.game_id]={}))[r.pfr_player_id]=[gp[0],pct];}
    const st=parseCSV(await getText(`${NV}/stats_player/stats_player_week_${S}.csv.gz`)||"",["game_id","team","passing_yards","rushing_yards","sacks_suffered","season_type"]);
    const T={};   // game|team -> offense totals
    for(const r of st){if(r.season_type!=="REG")continue;const k=r.game_id+"|"+r.team,t=T[k]||(T[k]={py:0,ry:0,sk:0});
      t.py+=+r.passing_yards||0;t.ry+=+r.rushing_yards||0;t.sk+=+r.sacks_suffered||0;}
    const games=t=>Object.keys(G).filter(id=>G[id].season==String(S)&&(G[id].home_team===t||G[id].away_team===t)).sort((a,b)=>+G[a].week-+G[b].week);
    const oppOf=(id,t)=>G[id].home_team===t?G[id].away_team:G[id].home_team;
    // season norms excluding the game: offense produced, defense allowed
    const norm=(t,gid,key,allowed)=>{const l=games(t).filter(id=>id!==gid).map(id=>T[id+"|"+(allowed?oppOf(id,t):t)]).filter(Boolean).map(x=>x[key]);return l.length>=6?mean(l):null;};
    // pass-rush strength before the game: defense's sacks per game so far
    const rushBefore=(t,gid)=>{const l=games(t);const i=l.indexOf(gid);const prev=l.slice(0,i).map(id=>T[id+"|"+oppOf(id,t)]).filter(Boolean);return prev.length>=3?mean(prev.map(x=>x.sk)):null;};
    const runBefore=(t,gid)=>{const l=games(t);const i=l.indexOf(gid);const prev=l.slice(0,i).map(id=>T[id+"|"+t]).filter(Boolean);return prev.length>=3?mean(prev.map(x=>x.ry)):null;};
    const missingBy=(t,gid)=>{   // {group: count of starters missing}
      const l=games(t),i=l.indexOf(gid);if(i<3||!snaps[t])return null;
      const prev=l.slice(i-3,i).map(id=>snaps[t][id]).filter(Boolean),cur=snaps[t][gid];if(prev.length<3||!cur)return null;
      const out={};for(const g of [...OFF,...DEF])out[g]=0;
      const ids=new Set(prev.flatMap(p=>Object.keys(p)));
      for(const id of ids){const gp=(prev.find(p=>p[id])||{})[id][0],thr=Object.values(GROUP).find(v=>v[0]===gp)[2];
        if(prev.filter(p=>p[id]&&p[id][1]>=thr).length<2)continue;
        if(!(cur[id]&&cur[id][1]>=0.1))out[gp]++;}
      return out;};
    for(const gid of Object.keys(G).filter(id=>G[id].season==String(S))){
      const g=G[gid];
      for(const off of [g.home_team,g.away_team]){
        const def=oppOf(gid,off),home=off===g.home_team,t=T[gid+"|"+off];if(!t)continue;
        const mo=missingBy(off,gid),md=missingBy(def,gid);if(!mo||!md)continue;
        const exp=home?+g.spread_line:-g.spread_line,margin=home?g.home_score-g.away_score:g.away_score-g.home_score;
        const pts=home?+g.home_score:+g.away_score,implied=(+g.total_line+exp)/2;
        const e=k=>{const a=norm(off,gid,k,false),b=norm(def,gid,k,true);return a==null||b==null?null:t[k]-(a+b)/2;};
        rows.push({S,off:mo,def:md,pts:pts-implied,ats:margin-exp,ry:e("ry"),py:e("py"),sk:e("sk"),defRush:rushBefore(def,gid),offRun:runBefore(off,gid)});
      }
    }
    log(`${S}: ${rows.length} offense-games`);
  }
  const q=(arr,p)=>{const s=arr.filter(v=>v!=null).sort((a,b)=>a-b);return s[Math.floor(p*(s.length-1))];};
  const topRush=q(rows.map(r=>r.defRush),2/3),topRun=q(rows.map(r=>r.offRun),2/3);
  const line=(label,R)=>`| ${label} | ${R.length} | ${cell(R.map(r=>r.pts))} | ${cell(R.map(r=>r.ats))} | ${cov(R)} | ${cov(R.filter(r=>r.S<=2019))} | ${cov(R.filter(r=>r.S>=2020))} | ${cell(R.map(r=>r.ry),0)} | ${cell(R.map(r=>r.py),0)} | ${cell(R.map(r=>r.sk),2)} |`;
  const none=rows.filter(r=>OFF.every(g=>!r.off[g])&&DEF.every(g=>!r.def[g]));
  let md=`# Missing starters by position group, ${FROM}-${TO} regular season\n\n`+
    `Every row is scored on the OFFENSE: its points vs. the implied team total, its result vs. the spread, and its rushing yards / passing yards / sacks taken vs. both teams' season norms.\n`+
    `"Own" = starters missing from that offense; "opp" = starters missing from the defense it faced. * = 2+ SE, ** = 2.5+ SE. Break-even at -110: 52.4%.\n`+
    `Pass rush = defense's sacks per game before the game (top third ≥ ${topRush.toFixed(2)}). Run-heavy = offense's rushing yards per game before the game (top third ≥ ${topRun.toFixed(0)}).\n\n`+
    `| situation | games | pts vs implied | vs spread | cover % | 2013-19 | 2020-25 | rush yds | pass yds | sacks taken |\n|---|---|---|---|---|---|---|---|---|---|\n`+
    [line("No starters missing on either side",none),
     ...OFF.map(g=>line(`Own ${g} starter(s) missing`,rows.filter(r=>r.off[g]>=1))),
     line("Own 2+ OL starters missing",rows.filter(r=>r.off.OL>=2)),
     line("Own OL missing vs top-third pass rush",rows.filter(r=>r.off.OL>=1&&r.defRush!=null&&r.defRush>=topRush)),
     line("Own 2+ OL missing vs top-third pass rush",rows.filter(r=>r.off.OL>=2&&r.defRush!=null&&r.defRush>=topRush)),
     ...DEF.map(g=>line(`Opp ${g} starter(s) missing`,rows.filter(r=>r.def[g]>=1))),
     line("Opp 2+ DL starters missing",rows.filter(r=>r.def.DL>=2)),
     line("Opp 2+ LB starters missing",rows.filter(r=>r.def.LB>=2)),
     line("Opp DL or LB missing vs run-heavy offense",rows.filter(r=>(r.def.DL>=1||r.def.LB>=1)&&r.offRun!=null&&r.offRun>=topRun)),
     line("Opp 3+ defensive starters missing (any)",rows.filter(r=>DEF.reduce((a,g)=>a+r.def[g],0)>=3)),
     line("Own 3+ offensive starters missing (any)",rows.filter(r=>OFF.reduce((a,g)=>a+r.off[g],0)>=3)),
    ].join("\n")+"\n";
  fs.writeFileSync(path.join(__dirname,"position-absences-results.md"),md);console.log("\n"+md);
})().catch(e=>{console.error(e);process.exit(1);});
