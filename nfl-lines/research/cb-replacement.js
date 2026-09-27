// Research: when a defense is missing a starting cornerback, does the opposing passing game
// do better than expected, and does the betting line account for it?
//   node nfl-lines/research/cb-replacement.js      (FROM=2013 TO=2025; snap counts start in 2013)
// Starter = CB who played >= 70% of defensive snaps in at least 2 of his team's previous 3 games
// (same season). Missing = no defensive snaps (or < 10%) in this game.
const fs=require("fs"),path=require("path");
const {parseCSV,getText,log,env}=require("../../nfl-props/lib");
const NV="https://github.com/nflverse/nflverse-data/releases/download";
const FROM=env("FROM",2013),TO=env("TO",2025);

const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/(a.length-1));};
const cell=a=>{if(a.length<20)return "-";const m=mean(a),se=sd(a)/Math.sqrt(a.length);return `${m>=0?"+":""}${m.toFixed(1)} ± ${se.toFixed(1)}${Math.abs(m/se)>=2.5?" **":Math.abs(m/se)>=2?" *":""}`;};

(async()=>{
  const G={};
  for(const g of parseCSV(await getText("https://github.com/nflverse/nfldata/raw/master/data/games.csv")))
    if(+g.season>=FROM&&+g.season<=TO&&g.result!==""&&g.spread_line!==""&&g.game_type==="REG")G[g.game_id]=g;

  const rows=[];
  for(let S=FROM;S<=TO;S++){
    // defensive snap shares for CBs, per team per game
    const sn=parseCSV(await getText(`${NV}/snap_counts/snap_counts_${S}.csv`)||"",["game_id","week","position","team","pfr_player_id","player","defense_pct","game_type"]);
    const byTeam={};
    for(const r of sn){if(r.game_type!=="REG"||!G[r.game_id])continue;
      const t=byTeam[r.team]||(byTeam[r.team]={});const gm=t[r.game_id]||(t[r.game_id]={week:+r.week,cb:{}});
      if(r.position==="CB")gm.cb[r.pfr_player_id]={pct:+r.defense_pct,name:r.player};}
    // team passing yards and each receiver's yards per game
    const st=parseCSV(await getText(`${NV}/stats_player/stats_player_week_${S}.csv.gz`)||"",["game_id","player_id","player_display_name","position","team","opponent_team","passing_yards","receiving_yards","season_type","week"]);
    const PY={},REC={};
    for(const r of st){if(r.season_type!=="REG")continue;const k=r.game_id+"|"+r.team;
      PY[k]=(PY[k]||0)+(+r.passing_yards||0);
      if(r.position==="WR"||r.position==="TE"){(REC[r.team]||(REC[r.team]={}))[r.player_id]=(REC[r.team][r.player_id]||[]);REC[r.team][r.player_id].push({gid:r.game_id,week:+r.week,y:+r.receiving_yards||0,name:r.player_display_name});}}
    const teamGames=t=>Object.keys(G).filter(id=>G[id].season==String(S)&&(G[id].home_team===t||G[id].away_team===t)).sort((a,b)=>+G[a].week-+G[b].week);
    const norm=(t,gid,allowed)=>{const l=teamGames(t).filter(id=>id!==gid).map(id=>{const g=G[id],opp=g.home_team===t?g.away_team:g.home_team;return PY[id+"|"+(allowed?opp:t)];}).filter(v=>v!=null);return l.length>=6?mean(l):null;};

    for(const def of Object.keys(byTeam)){
      const list=teamGames(def);
      for(let i=3;i<list.length;i++){
        const gid=list[i],cur=byTeam[def][gid];if(!cur)continue;
        const prev=list.slice(i-3,i).map(id=>byTeam[def][id]).filter(Boolean);if(prev.length<3)continue;
        const ids=new Set(prev.flatMap(p=>Object.keys(p.cb)));
        const starters=[...ids].filter(id=>prev.filter(p=>(p.cb[id]||{}).pct>=0.7).length>=2);
        if(!starters.length)continue;
        const missing=starters.filter(id=>!(cur.cb[id]&&cur.cb[id].pct>=0.1));
        const g=G[gid],off=g.home_team===def?g.away_team:g.home_team,offHome=g.home_team===off;
        const expMargin=offHome?+g.spread_line:-g.spread_line,margin=offHome?g.home_score-g.away_score:g.away_score-g.home_score;
        const pts=offHome?+g.home_score:+g.away_score,implied=(+g.total_line+expMargin)/2;
        const on=norm(off,gid,false),dn=norm(def,gid,true),py=PY[gid+"|"+off];
        // opponent's top receiver by yards per game before this game (min 3 games), if he played
        let wr=null;
        for(const [pid,l] of Object.entries(REC[off]||{})){const before=l.filter(x=>x.week<+g.week);if(before.length<3)continue;
          const avg=mean(before.map(x=>x.y)),now=l.find(x=>x.gid===gid);if(now&&(!wr||avg>wr.avg))wr={avg,y:now.y,name:now.name};}
        rows.push({S,missing:missing.length,starters:starters.length,
          py:py!=null&&on!=null&&dn!=null?py-(on+dn)/2:null,pts:pts-implied,ats:margin-expMargin,wr:wr?wr.y-wr.avg:null});
      }
    }
    log(`${S}: ${rows.length} defense-games so far`);
  }
  const grp=(label,R)=>{const c=R.map(r=>r.ats).filter(x=>x!==0);
    return `| ${label} | ${R.length} | ${cell(R.map(r=>r.py).filter(v=>v!=null))} | ${cell(R.map(r=>r.wr).filter(v=>v!=null))} | ${cell(R.map(r=>r.pts))} | ${cell(R.map(r=>r.ats))} | ${c.length?(100*c.filter(x=>x>0).length/c.length).toFixed(1)+"%":"-"} |`;};
  const two=rows.filter(r=>r.starters>=2);
  let md=`# Missing starting cornerbacks, ${FROM}-${TO} regular season\n\n`+
    `Opposing offense's results. Pass yds = vs. both teams' season norms. Top WR/TE = his yards vs. his average before the game.\n`+
    `Points / ATS = vs. the closing line (implied team total / spread). * = 2+ SE, ** = 2.5+ SE. Break-even ATS at -110: 52.4%.\n\n`+
    `| defense | games | pass yds vs norm | top WR/TE yds vs avg | points vs implied | vs spread | cover % |\n|---|---|---|---|---|---|---|\n`+
    [grp("All starters playing",rows.filter(r=>r.missing===0)),grp("1 starting CB missing",rows.filter(r=>r.missing===1)),
     grp("2+ starting CBs missing (of teams with 2+ starters)",two.filter(r=>r.missing>=2)),
     grp("  1+ missing, 2013-2019",rows.filter(r=>r.missing>=1&&r.S<=2019)),grp("  1+ missing, 2020-2025",rows.filter(r=>r.missing>=1&&r.S>=2020))].join("\n")+"\n";
  fs.writeFileSync(path.join(__dirname,"cb-replacement-results.md"),md);console.log("\n"+md);
})().catch(e=>{console.error(e);process.exit(1);});
