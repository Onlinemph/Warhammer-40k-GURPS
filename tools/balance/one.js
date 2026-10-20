// One sample war's numbers, as JSON (par.js runs these): worlds held at the end, battles, close (40-60% odds) and
// lopsided (95%+) fights, bad weather, night, sieges, who took worlds from whom, and fights by who attacked whom.
// From the game folder: node ../tools/balance/one.js seed [turns]
const {war}=require(process.cwd()+"/sample-wars.js");
const seed=+process.argv[2], turns=+process.argv[3]||60, F=["hegemony","apostates","brawl","chorus","dormant"];
const {S}=war(seed,turns), R=S.reports, n=a=>Object.values(a).reduce((x,y)=>x+y,0);
const held={}; for (const f of F) held[f]=Object.values(S.worlds).filter(w=>w.owner===f).length;
const out={seed,held,battles:R.length,close:R.filter(r=>r.odds>=40&&r.odds<=60).length,fav95:R.filter(r=>Math.max(r.odds,100-r.odds)>=95).length,
 badwx:R.filter(r=>r.weather).length, night:R.filter(r=>r.night).length,
 sieges:S.log.filter(l=>/lay siege to/.test(l.text)).length, sorties:S.log.filter(l=>/sorties/.test(l.text)).length,
 flows:(()=>{const o={}; for(const l of S.log){ const m=/^The (\w+) take ([A-Z][\w' -]+?)(?: from The (\w+))?(?::.*)?$/.exec(l.text); if(m&&!/ on /.test(l.text)){const k=m[1]+"<"+(m[3]||"free"); o[k]=(o[k]||0)+1;} if(/goes over to the Apostates/.test(l.text)&&!/ on /.test(l.text)){o["Apostates<Hegemony(defect)"]=(o["Apostates<Hegemony(defect)"]||0)+1;} } return o;})(),
 kinds:(()=>{const o={}; for(const r of R){ const a=r.sides[0], d=r.sides[1]; const k=a.faction+(a.players.length?"":"*")+">"+(d.players.length?"band":"garr"); const x=o[k]||(o[k]={n:0,close:0,lop:0}); x.n++; if(r.odds>=40&&r.odds<=60)x.close++; if(Math.max(r.odds,100-r.odds)>=95)x.lop++; } return o;})(),
 sizes:R.map(r=>r.sides.reduce((p,x)=>p+n(x.before),0))};
console.log(JSON.stringify(out));
