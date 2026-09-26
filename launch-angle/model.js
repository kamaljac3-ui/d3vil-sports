// ---------- physics ----------
const d2r=Math.PI/180;
function compute(vp,vaa,vs,aa,D){
  const RB=1.45,RBAT=1.30,k=0.25,e=0.5;
  const s=D/(RB+RBAT); if(Math.abs(s)>=1) return null;
  const phi=Math.asin(s);
  const n=[Math.cos(phi),Math.sin(phi)], t=[-Math.sin(phi),Math.cos(phi)];
  const vb=[-vp*Math.cos(vaa*d2r), vp*Math.sin(vaa*d2r)];
  const vt=[vs*Math.cos(aa*d2r), vs*Math.sin(aa*d2r)];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
  const vbn=dot(vb,n),vbt=dot(vb,t),btn=dot(vt,n),btt=dot(vt,t);
  const vn=((k-e)*vbn+(1+e)*btn)/(1+k);
  if(vn<=0) return null;
  const vtt=btt+(5/7)*(vbt-btt);
  const out=[vn*n[0]+vtt*t[0], vn*n[1]+vtt*t[1]];
  const w=-2.5*((vtt-vbt)*0.44704)/0.0368;
  return {la:Math.atan2(out[1],out[0])/d2r, ev:Math.hypot(out[0],out[1]), w};
}
function clears(ev,la,w,fenceFt){
  const rho=1.2,A=0.00426,m=0.145,Cd=0.40,R=0.0368,g=9.81,dt=0.01,fence=fenceFt/3.281;
  let x=0,y=0.9,v0=ev*0.44704,vx=v0*Math.cos(la*d2r),vy=v0*Math.sin(la*d2r),tt=0;
  const kd=0.5*rho*Cd*A/m,sg=Math.sign(w);
  while(y>=0&&tt<10){
    const v=Math.hypot(vx,vy),S=R*Math.abs(w)/v,CL=Math.min(S<0.1?1.5*S:0.09+0.6*S,0.3),kl=0.5*rho*CL*A/m;
    const ax=-kd*v*vx-kl*v*vy*sg, ay=-g-kd*v*vy+kl*v*vx*sg;
    vx+=ax*dt;vy+=ay*dt;const px=x;x+=vx*dt;y+=vy*dt;tt+=dt;
    if(px<fence&&x>=fence) return y>3.05;
  }
  return false;
}
const REF={vp:86,vaa:-5}; // league-average fastball at the plate
function calibrate(h){
  if(h.la==null||isNaN(h.la)) return 0.5;
  let best=0.5,bd=1e9;
  for(let D=-1.2;D<=2.0;D+=0.02){const q=compute(REF.vp,REF.vaa,h.bs,h.aa,D);if(!q)continue;const d=Math.abs(q.la-h.la);if(d<bd){bd=d;best=D;}}
  return best;
}
function matchPitch(h,p,fence){
  const sig=0.55,D0=h.D0;let W=0,win=0,hr=0;
  for(let z=-2;z<=2.001;z+=0.2){
    const w=Math.exp(-z*z/2),D=D0+z*sig;W+=w;
    const q=compute(p.vp,p.vaa,h.bs,h.aa,D);if(!q)continue;
    if(q.la>=25&&q.la<=35)win+=w;
    if(q.la>=18&&q.la<=45&&q.ev>90&&clears(q.ev,q.la,q.w,fence))hr+=w;
  }
  return {win:win/W,hr:hr/W};
}
function matchup(h,pit,fence){
  let win=0,hr=0,u=0;const per=[];
  for(const p of pit.pitches){const r=matchPitch(h,p,fence);per.push({...r,p});win+=p.use*r.win;hr+=p.use*r.hr;u+=p.use;}
  const prim=pit.pitches.slice().sort((a,b)=>b.use-a.use)[0];
  return {win:win/u,hr:hr/u,per,gap:h.aa-(-prim.vaa),prim};
}
// ---------- CSV → profiles ----------
const norm=s=>String(s||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
function pick(cols,aliases){for(const a of aliases){const i=cols.indexOf(a);if(i>=0)return cols[i];}return null;}
function fixName(n){n=String(n||"").trim();if(n.includes(",")){const [l,f]=n.split(",");return (f.trim()+" "+l.trim()).trim();}return n;}
const num=v=>{if(v===""||v==null)return NaN;const x=parseFloat(v);return x;};
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
function rowsNorm(rows){return rows.map(r=>{const o={};for(const k in r)o[norm(k)]=r[k];return o;});}

function hittersFrom(files){
  const g=new Map();const foundAll=[];
  for(let rows of files){
  rows=rowsNorm(rows);if(!rows.length)continue;
  const cols=Object.keys(rows[0]);
  const c={
    id:pick(cols,["batter","player_id","id","mlbam_id"]),
    name:pick(cols,["last_name_first_name","name","player_name","batter_name","player"]),
    first:pick(cols,["first_name"]),last:pick(cols,["last_name"]),
    aa:pick(cols,["attack_angle","avg_attack_angle","swing_attack_angle","attack_angle_avg"]),
    bs:pick(cols,["avg_bat_speed","bat_speed","batspeed"]),
    la:pick(cols,["avg_launch_angle","launch_angle","avg_hit_angle","la","launch_angle_avg"])};
  foundAll.push(c);
  for(const r of rows){
    const nm=c.name?fixName(r[c.name]):((r[c.first]||"")+" "+(r[c.last]||"")).trim();
    const key=(c.id&&r[c.id])||nm;if(!key)continue;
    if(!g.has(key))g.set(key,{name:nm,aa:[],bs:[],la:[]});
    const e=g.get(key);if(!e.name&&nm)e.name=nm;
    const aa=num(r[c.aa]),bs=num(r[c.bs]),la=num(r[c.la]);
    if(!isNaN(aa))e.aa.push(aa);if(!isNaN(bs))e.bs.push(bs);if(!isNaN(la))e.la.push(la);
  }}
  const list=[];
  for(const [id,e] of g){
    if(!e.aa.length||!e.bs.length)continue;
    let bs;if(e.bs.length>5){const s=e.bs.slice().sort((a,b)=>b-a);bs=mean(s.slice(0,Math.ceil(s.length*0.9)));}else bs=mean(e.bs);
    const h={id:String(id),name:e.name||String(id),aa:mean(e.aa),bs,la:e.la.length?mean(e.la):null,n:Math.max(e.aa.length,e.bs.length)};
    h.D0=calibrate(h);list.push(h);
  }
  return {list,found:foundAll};
}
function vaaFrom(r){
  const vy0=num(r.vy0),vz0=num(r.vz0),ay=num(r.ay),az=num(r.az),vx0=num(r.vx0),ax=num(r.ax);
  if([vy0,vz0,ay,az].some(isNaN))return null;
  const vyf=-Math.sqrt(vy0*vy0-2*ay*(50-17/12));const t=(vyf-vy0)/ay;const vzf=vz0+az*t;
  const vxf=isNaN(vx0)?0:vx0+(isNaN(ax)?0:ax)*t;
  return {vaa:-Math.atan(vzf/vyf)/d2r, plate:Math.hypot(vxf,vyf,vzf)*0.681818};
}
const PT={FF:"4-seam",SI:"Sinker",FC:"Cutter",SL:"Slider",ST:"Sweeper",CU:"Curveball",KC:"Knuckle curve",CH:"Changeup",FS:"Splitter",SV:"Slurve",FO:"Forkball",SC:"Screwball",KN:"Knuckleball"};
function pitchersFrom(files){
  const g=new Map();const foundAll=[];
  for(let rows of files){
  rows=rowsNorm(rows);if(!rows.length)continue;
  const cols=Object.keys(rows[0]);
  const c={
    id:pick(cols,["pitcher","player_id","id","mlbam_id"]),
    name:pick(cols,["last_name_first_name","name","player_name","pitcher_name","player"]),
    first:pick(cols,["first_name"]),last:pick(cols,["last_name"]),
    type:pick(cols,["pitch_type","pitch_name","pitch"]),
    velo:pick(cols,["release_speed","velo","avg_speed","velocity","pitch_speed","plate_speed"]),
    vaa:pick(cols,["vaa","vertical_approach_angle","avg_vaa"]),
    use:pick(cols,["usage","pitch_usage","usage_pct","pitch_percent","percent"]),
    traj:cols.includes("vy0")&&cols.includes("az")?"vy0/vz0/ay/az":null};
  foundAll.push(c);
  for(const r of rows){
    const nm=c.name?fixName(r[c.name]):((r[c.first]||"")+" "+(r[c.last]||"")).trim();
    const key=(c.id&&r[c.id])||nm;const ty=c.type?String(r[c.type]||"").trim():"FF";
    if(!key||!ty||ty==="PO"||ty==="EP"||ty==="FA")continue;
    if(!g.has(key))g.set(key,{name:nm,pt:new Map(),total:0});
    const e=g.get(key);if(!e.name&&nm)e.name=nm;
    if(!e.pt.has(ty))e.pt.set(ty,{vaa:[],vp:[],cnt:0,use:NaN});
    const p=e.pt.get(ty);
    let vaa=num(r[c.vaa]),vp=NaN;
    if(isNaN(vaa)&&c.traj){const t=vaaFrom(r);if(t){vaa=t.vaa;vp=t.plate;}}
    if(isNaN(vp)){const v=num(r[c.velo]);if(!isNaN(v))vp=c.velo==="plate_speed"?v:v*0.92;}
    if(!isNaN(vaa))p.vaa.push(vaa);if(!isNaN(vp))p.vp.push(vp);
    const u=num(r[c.use]);if(!isNaN(u))p.use=u>1?u/100:u;
    p.cnt++;e.total++;
  }}
  const list=[];
  for(const [id,e] of g){
    const pitches=[];
    for(const [ty,p] of e.pt){
      if(!p.vaa.length||!p.vp.length)continue;
      const use=!isNaN(p.use)?p.use:p.cnt/e.total;
      if(use<0.03)continue;
      pitches.push({type:ty,label:PT[ty]||ty,vaa:mean(p.vaa),vp:mean(p.vp),use});
    }
    if(pitches.length)list.push({id:String(id),name:e.name||String(id),pitches:pitches.sort((a,b)=>b.use-a.use),n:e.total});
  }
  return {list,found:foundAll};
}

const LEAGUE_AVG_PITCHER={id:"avg",name:"League-average fastball",pitches:[{type:"FF",label:"4-seam",vp:86,vaa:-5,use:1}]};
module.exports={compute,clears,calibrate,matchPitch,matchup,hittersFrom,pitchersFrom,LEAGUE_AVG_PITCHER};
