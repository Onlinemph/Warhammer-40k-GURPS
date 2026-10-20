// The balance pass's yardstick (docs/setting.md, "A balance pass"): N sample wars of 60 turns, eight at a time, from
// the game folder: `cd game && node ../tools/balance/par.js 16 label [first seed]`. Prints the summary, appends it to
// the OS temp folder's balance/log.txt and keeps each war's numbers (one.js) in balance/<label>.json there.
const {spawn}=require("child_process"); const OUT=require("path").join(require("os").tmpdir(),"balance"); require("fs").mkdirSync(OUT,{recursive:true}); const N=+process.argv[2]||8, label=process.argv[3]||"run", s0=+process.argv[4]||1;
const F=["hegemony","apostates","brawl","chorus","dormant"], res=[], t0=Date.now(); let next=s0, live=0;
const go=()=>{ while(live<8&&next<s0+N){ const s=next++; live++; let buf=""; const p=spawn("node",[__dirname+"/one.js",String(s)],{cwd:process.cwd()});
  p.stdout.on("data",d=>buf+=d); p.stderr.on("data",d=>process.stderr.write(d)); p.on("close",()=>{ live--; try{res.push(JSON.parse(buf.trim().split("\n").pop()));}catch(e){console.error("war",s,"failed")} if(live===0 && next>=s0+N) done(); else go(); }); } };
const done=()=>{ const a={}; for(const f of F) a[f]=+(res.reduce((x,r)=>x+r.held[f],0)/res.length).toFixed(1);
  const wiped={}; for(const f of F) wiped[f]=res.filter(r=>r.held[f]===0).length;
  const sum=k=>res.reduce((x,r)=>x+r[k],0), B=sum("battles"), sz=res.flatMap(r=>r.sizes).sort((x,y)=>x-y);
  const line=`${label}: wars ${res.length} | worlds ${JSON.stringify(a)} | wiped ${JSON.stringify(wiped)} | battles/war ${(B/res.length).toFixed(0)} close ${(100*sum("close")/B).toFixed(1)}% 95+ ${(100*sum("fav95")/B).toFixed(0)}% badwx ${(100*sum("badwx")/B).toFixed(0)}% night ${(100*sum("night")/B).toFixed(0)}% | sieges/war ${(sum("sieges")/res.length).toFixed(1)} sorties ${(sum("sorties")/res.length).toFixed(1)} | size med ${sz[sz.length>>1]} p90 ${sz[Math.floor(sz.length*.9)]} | ${((Date.now()-t0)/1000).toFixed(0)} s`;
  console.log(line); require("fs").appendFileSync(OUT+"/log.txt",line+"\n"); require("fs").writeFileSync(OUT+`/${label}.json`,JSON.stringify(res)); };
go();
