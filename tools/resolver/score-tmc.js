// How far Tactical Mass Combat (game/world/tmc.js) is from the engine on its kept battles (truth.js): for information
// only, nothing is tuned to it (docs/setting.md, "Measured, not tuned").
//   node tools/resolver/score-tmc.js tools/resolver/truth/*.json
const fs = require("fs");
const T = require("../../game/world/tmc.js");
const rows = process.argv.slice(2).flatMap(f => JSON.parse(fs.readFileSync(f, "utf8")));
const groups = {};
for (const r of rows) {
  const army = list => Object.fromEntries(list.filter(e => !/\(linked\)/.test(e.template)).map(e => [e.template, e.count]));
  const p = T.predict({ ground: r.ground === "field" ? "plains" : r.ground, seed: 1, sides: [{ faction: "a", army: army(r.A), leader: 11 }, { faction: "b", army: army(r.B), leader: 11 }], hold: r.deploy === "hold" ? 1 : undefined }, 16);
  const g = (groups[`${r.ground} ${r.size}`] ||= { n: 0, w: 0, called: 0 });
  g.n++; g.w += Math.abs(r.pA - p.pWinA);
  if ((r.pA > 0.5) === (p.pWinA > 0.5) || Math.abs(r.pA - 0.5) < 0.15) g.called++;
}
const all = Object.values(groups).reduce((a, g) => ({ n: a.n + g.n, w: a.w + g.w, called: a.called + g.called }), { n: 0, w: 0, called: 0 });
for (const [k, g] of [...Object.entries(groups), ["all", all]]) console.log(`${k.padEnd(14)} ${String(g.n).padStart(4)} battles   win chance off the engine's by ${(g.w / g.n * 100).toFixed(1).padStart(5)} points   favourite as the engine's ${g.called}/${g.n}`);
