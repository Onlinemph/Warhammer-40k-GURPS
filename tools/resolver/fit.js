// Fits the resolver's three constants for each class of ground (resolver.js: crowding, the approach, the breaking
// point) to engine battles kept by truth.js, by trying every combination on a grid and keeping the one with the
// least error (the win chance's and the share lost's, added). Writes them into table2.json as `fit`.
//   node tools/resolver/fit.js <train files...>
const fs = require("fs"), path = require("path");
const R = require("./resolver.js");
const rows = process.argv.slice(2).flatMap(f => JSON.parse(fs.readFileSync(f, "utf8")));
const T2 = R.table2();
if (!T2) throw new Error("no table2.json: run calibrate2.js first");
const GRID = { crowd: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], approach: [0, 0.5, 1, 1.5, 2], breaks: [0, 0.1, 0.2, 0.3, 0.4] };
const keyOf = r => R.CLASS[r.ground] + (r.deploy === "hold" ? "-hold" : "");
const byKey = {};
for (const r of rows) if (R.CLASS[r.ground]) (byKey[keyOf(r)] ||= []).push(r);
const err = (list, f, key) => {
  T2.fit = { ...(T2.fit || {}), [key]: f }; R.setTable2(T2);
  let e = 0;
  for (const r of list) {
    const p = R.predict(r.A, r.B, { ground: r.ground, hold: r.deploy === "hold" ? 1 : undefined, seed: 1, sims: 100 });
    e += Math.abs(r.pA - p.pWinA) + (Math.abs(r.lossA - p.lossA) + Math.abs(r.lossB - p.lossB)) / 2;
  }
  return e / list.length;
};
T2.fit = T2.fit || {};
for (const [key, list] of Object.entries(byKey)) {
  let best = null;
  const t0 = Date.now();
  for (const crowd of GRID.crowd) for (const approach of GRID.approach) for (const breaks of GRID.breaks) {
    const f = { crowd, approach, breaks }, e = err(list, f, key);
    if (!best || e < best.e) best = { f, e };
  }
  const none = err(list, { crowd: 0, approach: 0, breaks: 0 }, key);
  T2.fit[key] = best.f;
  console.log(`${key.padEnd(12)} ${list.length} battles: ${JSON.stringify(best.f)}  error ${(best.e * 100).toFixed(1)} (${(none * 100).toFixed(1)} with none)  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
fs.writeFileSync(path.join(__dirname, "table2.json"), JSON.stringify(T2) + "\n");
