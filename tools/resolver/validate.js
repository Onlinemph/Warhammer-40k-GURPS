// How good is the resolver? Random mixed armies from the roster, each fought by the full engine (a Monte Carlo
// in the same open-ground meeting the rates were measured in) and predicted by the resolver; prints the errors.
//   node tools/resolver/validate.js [battles=30] [engineRuns=16] [seed=1]
const { SIM, armySpecs } = require("./common.js");
const { predict, table } = require("./resolver.js");
const n = +process.argv[2] || 30, runs = +process.argv[3] || 16;
let s = (+process.argv[4] || 1) * 2654435761 >>> 0;
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const roster = table().roster, pick = () => roster[Math.floor(rnd() * roster.length)];
const army = () => Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ template: pick(), count: 4 + Math.floor(rnd() * 14) }));
let eW = 0, eL = 0, called = 0, rows = [];
for (let i = 0; i < n; i++) {
  const A = army(), B = army(), specs = [...armySpecs(A, 0), ...armySpecs(B, 1)];
  const mc = SIM.monteCarlo(specs, { runs, distance: 50, maxTurns: 300, seed: 500 + i });
  const nA = A.reduce((a, e) => a + e.count, 0), nB = B.reduce((a, e) => a + e.count, 0);
  const lostA = 1 - mc.units.filter(u => u.side === 0).reduce((a, u) => a + u.standing, 0) / nA;
  const lostB = 1 - mc.units.filter(u => u.side === 1).reduce((a, u) => a + u.standing, 0) / nB;
  const e = { pA: mc.wins[0] / runs, lostA, lostB }, p = predict(A, B);
  eW += Math.abs(e.pA - p.pWinA); eL += (Math.abs(e.lostA - p.lossA) + Math.abs(e.lostB - p.lossB)) / 2;
  if ((e.pA > 0.5) === (p.pWinA > 0.5) || Math.abs(e.pA - 0.5) < 0.15) called++;
  rows.push(`${A.map(x => x.count + " " + x.template).join(" + ")}  vs  ${B.map(x => x.count + " " + x.template).join(" + ")}\n    engine A wins ${(e.pA * 100).toFixed(0)}%  lost ${(lostA * 100).toFixed(0)}%/${(lostB * 100).toFixed(0)}%   resolver ${(p.pWinA * 100).toFixed(0)}%  lost ${(p.lossA * 100).toFixed(0)}%/${(p.lossB * 100).toFixed(0)}%`);
}
console.log(rows.join("\n"));
console.log(`\n${n} battles: mean |error| in A's win chance ${(eW / n * 100).toFixed(1)} points, in share lost ${(eL / n * 100).toFixed(1)} points; favourite called right (or a toss-up) in ${called}/${n}`);
