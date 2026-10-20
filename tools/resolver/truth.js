// The engine's answers to a set of mixed battles, kept so any version of the resolver can be scored against them at
// once (score.js). Each battle: two random armies from the roster, fought `runs` times on one ground of the war's
// (its own map for the battle), side 1 meeting side 0 or holding the ground. Fought in parallel; appends to the file.
//   node tools/resolver/truth.js <file> <battles> <runs> <small|big> <ground,...> [meet|hold] [workers=7] [seed=1]
const path = require("path"), fs = require("fs"), { fork } = require("child_process");
// the map a battle of n soldiers is fought on (the war's own sizing, game/replay/build.js)
const field = n => { const W = Math.max(100, Math.min(300, Math.round(100 + 0.6 * n))); return { mapW: W, mapH: Math.round(W / 2) }; };
if (process.env.TRUTH_WORKER) {
  const { SIM, armySpecs } = require("./common.js");
  const TER = require("../../game/world/terrain.js");
  process.on("message", job => {
    const { A, B, ground, deploy, runs, seed } = job, n = [A, B].map(x => x.reduce((a, e) => a + e.count, 0));
    const specs = [...armySpecs(A, 0), ...armySpecs(B, 1)];
    const bf = ground === "field" ? { distance: 50 } : { ...TER.battlefield(ground), ...field(n[0] + n[1]), mapSeed: 1 + (seed % 997) };
    const t0 = Date.now();
    const mc = SIM.monteCarlo(specs, { ...bf, hold: deploy === "hold" ? 1 : undefined, runs, maxTurns: 300, seed });
    const left = s => mc.units.filter(u => u.side === s).reduce((a, u) => a + u.standing, 0);
    process.send({ ...job, pA: mc.wins[0] / runs, pB: mc.wins[1] / runs, lossA: 1 - left(0) / n[0], lossB: 1 - left(1) / n[1], secs: mc.turns, ms: Date.now() - t0 });
  });
} else {
  const [file, battles = 20, runs = 12, size = "small", grounds = "field", deploy = "meet", workers = 7, seed0 = 1] = process.argv.slice(2);
  const { table } = require("./resolver.js");
  let s = (+seed0) * 2654435761 >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const roster = table().roster.filter(t => !/\(linked\)/.test(t)), pick = () => roster[Math.floor(rnd() * roster.length)];
  // small: one to three types, 4 to 17 of each; big: two to four types, 100 to 250 soldiers on the field in all
  const army = big => { const k = big ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 3), tot = big ? 50 + Math.floor(rnd() * 76) : 0; return Array.from({ length: k }, () => ({ template: pick(), count: big ? Math.max(2, Math.round(tot / k * (0.5 + rnd()))) : 4 + Math.floor(rnd() * 14) })); };
  const jobs = [];
  for (const ground of grounds.split(",")) for (let i = 0; i < +battles; i++) jobs.push({ ground, deploy, size, A: army(size === "big"), B: army(size === "big"), runs: +runs, seed: 700 + i * 31 + (+seed0) * 7 });
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  const t0 = Date.now(); let done = 0;
  const run = () => new Promise(res => {
    const w = fork(__filename, [], { env: { ...process.env, TRUTH_WORKER: "1" } });
    const next = () => { const j = jobs.shift(); if (!j) { w.kill(); return res(); } w.send(j); };
    w.on("message", m => { out.push(m); done++; if (done % 5 === 0) { fs.writeFileSync(file, JSON.stringify(out)); console.log(`${done} fought, ${((Date.now() - t0) / 1000).toFixed(0)} s`); } next(); });
    next();
  });
  Promise.all(Array.from({ length: +workers }, run)).then(() => { fs.writeFileSync(file, JSON.stringify(out)); console.log(`${done} battles in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${file}`); });
}
