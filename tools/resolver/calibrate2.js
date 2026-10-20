// Calibrates the resolver on the war's own ground: every pair of roster types fights PROBE against PROBE on the maps
// of each class of ground (the grounds of a class taken in turn, a new map each battle, the war's own map size for
// that many soldiers), and for the urban class also with side B holding the city (opt.hold). From the engine's
// per-second tally: each type's rate against the other (how many of them one of it removes a second it's on the
// field, counted from when the removals start), and the onset (the seconds before the first removal: the approach).
// Writes tools/resolver/table2.json.
//   node tools/resolver/calibrate2.js [runs=16] [workers=7] [classes=open,broken,close,urban,urban-hold]
const path = require("path"), fs = require("fs"), { fork } = require("child_process");
const PROBE = 10, MAX = 300;
const CLASSES = {
  open: ["desert", "tundra"],
  broken: ["hills", "mountains", "farmland", "wasteland", "river", "plains"],
  close: ["forest", "jungle", "swamp"],
  urban: ["town", "city", "hive", "fortress"],
};
const field = n => { const W = Math.max(100, Math.min(300, Math.round(100 + 0.6 * n))); return { mapW: W, mapH: Math.round(W / 2) }; };
if (process.env.RESOLVER_WORKER) {
  const { SIM, unitSpec } = require("./common.js");
  const TER = require("../../game/world/terrain.js");
  process.on("message", ({ jobs, runs }) => {
    const out = [];
    for (const { a, b, cls, hold } of jobs) {
      let remA = 0, remB = 0, expA = 0, expB = 0, secs = 0, winA = 0, onA = 0, onB = 0, nA = 0, nB = 0;
      for (let i = 0; i < runs; i++) {
        const g = CLASSES[cls][i % CLASSES[cls].length];
        const r = SIM.runBattle([unitSpec(a, PROBE, 0), unitSpec(b, PROBE, 1)], { ...TER.battlefield(g), ...field(2 * PROBE), mapSeed: 1 + i * 37, seed: 9000 + i, maxTurns: MAX, hold: hold ? 1 : undefined });
        const t = r.tally, end = t[t.length - 1];
        // onset: the first second each side's numbers fall (B's fall is A's doing)
        const first = s => { for (let k = 1; k < t.length; k++) if (t[k][s] < t[0][s]) return k - 1; return null; };
        const fB = first(1), fA = first(0);
        if (fB != null) { onA += fB; nA++; }
        if (fA != null) { onB += fA; nB++; }
        remA += t[0][0] - end[0]; remB += t[0][1] - end[1];
        // exposure from the onset on: a man's rate is what he does once the fighting has reached him
        const s0 = Math.min(fA ?? t.length, fB ?? t.length);
        for (let k = s0; k + 1 < t.length; k++) { expA += t[k][0]; expB += t[k][1]; }
        secs += r.turns; if (r.winner === 0) winA++;
      }
      out.push({ a, b, cls, hold: !!hold, ab: expA ? remB / expA : 0, ba: expB ? remA / expB : 0, onA: nA ? onA / nA : null, onB: nB ? onB / nB : null, secs: secs / runs, winA: winA / runs });
    }
    process.send(out);
  });
} else {
  const { engineCommit } = require("./common.js");
  const runs = +process.argv[2] || 16, workers = +process.argv[3] || 7, which = (process.argv[4] || "open,broken,close,urban,urban-hold").split(",");
  const roster = JSON.parse(fs.readFileSync(path.join(__dirname, "roster.json"), "utf8")).templates;
  const jobs = [];
  for (const w of which) {
    const [cls, mode] = w.split("-"), hold = mode === "hold";
    // holding is one-sided: every ordered pair (a attacks b holding); meeting is symmetric: each pair once
    for (let i = 0; i < roster.length; i++) for (let j = hold ? 0 : i; j < roster.length; j++) jobs.push({ a: roster[i], b: roster[j], cls, hold });
  }
  const file = path.join(__dirname, "table2.json");
  const T = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { roster, tables: {} };
  const chunks = Array.from({ length: workers }, (_, w) => jobs.filter((_, k) => k % workers === w));
  const t0 = Date.now();
  Promise.all(chunks.map(ch => new Promise(res => {
    const w = fork(__filename, [], { env: { ...process.env, RESOLVER_WORKER: "1" } });
    w.on("message", m => { res(m); w.kill(); });
    w.send({ jobs: ch, runs });
  }))).then(parts => {
    for (const w of which) T.tables[w] = { rate: {}, onset: {}, secs: {} };
    for (const r of parts.flat()) {
      const X = T.tables[r.cls + (r.hold ? "-hold" : "")];
      // rate[x][y]: x's rate against y; in a holding table x attacks and y holds, or (the second key) y holds and x
      // is the one attacking it, kept apart as rate[x][y] (x attacking) and def[y][x] (y holding, shooting x)
      if (r.hold) { (X.rate[r.a] ||= {})[r.b] = r.ab; (X.def ||= {}); (X.def[r.b] ||= {})[r.a] = r.ba; (X.onset[r.a] ||= {})[r.b] = r.onA; (X.donset ||= {}); (X.donset[r.b] ||= {})[r.a] = r.onB; }
      else { (X.rate[r.a] ||= {})[r.b] = r.ab; (X.rate[r.b] ||= {})[r.a] = r.ba; (X.onset[r.a] ||= {})[r.b] = r.onA; (X.onset[r.b] ||= {})[r.a] = r.onB; }
      (X.secs[r.a] ||= {})[r.b] = r.secs;
    }
    T.meta = { engine: engineCommit(), runs, probe: PROBE, map: field(2 * PROBE), classes: CLASSES, made: new Date().toISOString().slice(0, 10) };
    fs.writeFileSync(file, JSON.stringify(T) + "\n");
    console.log(`${jobs.length} pairs x ${runs} battles in ${((Date.now() - t0) / 1000).toFixed(0)} s -> tools/resolver/table2.json`);
  });
}
