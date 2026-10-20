// A prototype matchup rating, kept for the Tactical Mass Combat draft (docs/setting.md): how a unit fares against
// the reference foes from hit chance, penetrating damage, shots and HP. Run from tools/resolver.
// prototype: Lanchester worth of X against each reference foe, from hit chance, penetrating damage, RoF and HP
const {SIM,unitSpec}=require(process.cwd()+"/common.js"); const {UNITS,MILITIA}=require(process.cwd()+"/../../game/world/units.js");
const p3=[];{const c=Array(19).fill(0);for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let d=1;d<=6;d++)c[a+b+d]++;let s=0;for(let k=0;k<=18;k++){s+=c[k]||0;p3[k]=s/216;}}
const P=k=>k<3?0:k>=16?p3[16]:p3[Math.floor(k)];
const U={}; const get=t=>U[t]||(U[t]=SIM.buildUnit(unitSpec(t,1,0).spec,0));
const dr=(u)=>{const n=l=>(u.nat.all||0)+(u.nat[l]||0)+(u.arm.dr[l]||0); return n("torso")*0.6+n("skull")*0.1+n("arm")*0.15+n("leg")*0.15;};
const TYPE={"pi-":0.5,pi:1,"pi+":1.5,cut:1.5,"pi++":2,imp:2,cor:1,cr:1,burn:1};
function k(a,b){ const A=get(a),B=get(b); let best=0;
  for (const [w,rng] of [[A.ranged,1],[A.melee,0]]) { if(!w) continue; const d=w.dmg, raw=d.n*(d.mult||1)*3.5+(d.add||0)*(d.mult||1);
    const pen=Math.max(0, raw - dr(B)/(d.div||1)) * (TYPE[d.type]??1) * (d.ex?1.5:1);
    const hit=P(w.level + (rng?Math.min(w.acc||0,4)-4:0)) * (1-P(B.dodge-(rng?2:0))*0.5);
    const shots=rng?Math.min(w.rof||1,3+(w.rof>3?(w.rof-3)/4:0)):(A.flags.extraAttack?2:1);
    const ff=(B.flags.dmgRed||1); const v=hit*shots*pen/ff/Math.max(1,B.HP); if(v>best)best=v; }
  return best; }
const REF=["Astra Militarum Guardsman","Ork Boy","Traitor Guardsman","Hormagaunt","Astartes Battle-Brother","Ork Nob","Necron Warrior"];
const worth=t=>{ let s=0; for(const y of REF){ const wx=Math.sqrt((k(t,y)+1e-6)/(k(y,t)+1e-6)), wl=Math.sqrt((k("Astra Militarum Guardsman",y)+1e-6)/(k(y,"Astra Militarum Guardsman")+1e-6)); s+=Math.log(wx/wl);} return Math.exp(s/REF.length); };
const rows=[...Object.values(UNITS).map(u=>({name:u.name,t:u.template,power:u.power})),{name:"Local Defence",t:MILITIA.template,power:1.4}];
const v=rows.map(r=>worth(r.t)); const e=rows.map((r,i)=>Math.log(v[i]/r.power)); const m=e.reduce((a,b)=>a+b)/e.length;
const rk=a=>{const s=a.map((x,i)=>[x,i]).sort((p,q)=>p[0]-q[0]); const r=[]; s.forEach(([x,i],j)=>r[i]=j); return r;}; const a=rk(v),b=rk(rows.map(r=>r.power)),n=a.length;
console.log("rank", (1-6*a.reduce((s,x,i)=>s+(x-b[i])**2,0)/(n*(n*n-1))).toFixed(2), " typical miss x"+Math.exp(e.reduce((s,x)=>s+Math.abs(x-m),0)/e.length).toFixed(2));
rows.forEach((r,i)=>console.log(r.name.padEnd(14), "engine", String(r.power).padStart(4), " matchup", v[i].toFixed(1)));
{ const lx=v.map(Math.log), ly=rows.map(r=>Math.log(r.power)), mx=lx.reduce((a,b)=>a+b)/lx.length, my=ly.reduce((a,b)=>a+b)/ly.length;
  const g=lx.reduce((s,x,i)=>s+(x-mx)*(ly[i]-my),0)/lx.reduce((s,x)=>s+(x-mx)**2,0);
  const e2=rows.map((r,i)=>g*lx[i]-ly[i]), m2=e2.reduce((a,b)=>a+b)/e2.length;
  console.log("worth ∝ matchup^"+g.toFixed(2)+"  typical miss x"+Math.exp(e2.reduce((s,x)=>s+Math.abs(x-m2),0)/e2.length).toFixed(2));
  rows.forEach((r,i)=>console.log("  ", r.name.padEnd(14), "engine", String(r.power).padStart(4), " fitted", Math.exp(g*lx[i]-m2).toFixed(1))); }
