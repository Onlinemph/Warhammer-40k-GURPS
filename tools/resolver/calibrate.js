// Calibrates the resolver: every pair of roster types fights short engine battles (PROBE a side, open ground,
// DIST yards apart), and the battles give each type's attrition rate against each other type: how many of them
// one of it removes (killed, knocked out or routed) per second it's on the field. Both directions come out of
// the same battles. Writes tools/resolver/table.json.
//   node tools/resolver/calibrate.js [runs=16] [workers=4]
const path = require("path"), fs = require("fs"), { fork } = require("child_process");
const PROBE = 10, DIST = 50, MAX = 300;
if (process.env.RESOLVER_WORKER) {
  const { SIM, unitSpec } = require("./common.js");
  process.on("message", ({ pairs, runs }) => {
    const out = [];
    for (const [a, b] of pairs) {
      let remA = 0, remB = 0, expA = 0, expB = 0, secs = 0, winA = 0;
      for (let i = 0; i < runs; i++) {
        const r = SIM.runBattle([unitSpec(a, PROBE, 0), unitSpec(b, PROBE, 1)], { distance: DIST, maxTurns: MAX, seed: 9000 + i });
        const t = r.tally, end = t[t.length - 1];
        remA += t[0][0] - end[0]; remB += t[0][1] - end[1];
        for (let k = 0; k + 1 < t.length; k++) { expA += t[k][0]; expB += t[k][1]; }
        secs += r.turns; if (r.winner === 0) winA++;
      }
      out.push({ a, b, ab: expA ? remB / expA : 0, ba: expB ? remA / expB : 0, secs: secs / runs, winA: winA / runs });
    }
    process.send(out);
  });
} else {
  const { engineCommit } = require("./common.js");
  const runs = +process.argv[2] || 16, workers = +process.argv[3] || 4;
  const roster = JSON.parse(fs.readFileSync(path.join(__dirname, "roster.json"), "utf8")).templates;
  const pairs = [];
  for (let i = 0; i < roster.length; i++) for (let j = i; j < roster.length; j++) pairs.push([roster[i], roster[j]]);
  const chunks = Array.from({ length: workers }, (_, w) => pairs.filter((_, k) => k % workers === w));
  const t0 = Date.now();
  Promise.all(chunks.map(ch => new Promise(res => {
    const w = fork(__filename, [], { env: { ...process.env, RESOLVER_WORKER: "1" } });
    w.on("message", m => { res(m); w.kill(); });
    w.send({ pairs: ch, runs });
  }))).then(parts => {
    const rate = {}, probe = [];
    for (const r of parts.flat()) {
      (rate[r.a] ||= {})[r.b] = r.ab; (rate[r.b] ||= {})[r.a] = r.ba;
      probe.push(r);
    }
    const table = { meta: { engine: engineCommit(), runs, probe: PROBE, distance: DIST, battlefield: "open", made: new Date().toISOString().slice(0, 10) }, roster, rate, probe };
    fs.writeFileSync(path.join(__dirname, "table.json"), JSON.stringify(table, null, 1) + "\n");
    console.log(`${pairs.length} pairs x ${runs} battles in ${((Date.now() - t0) / 1000).toFixed(0)} s -> tools/resolver/table.json`);
  });
}
