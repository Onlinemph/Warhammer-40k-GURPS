// The calibrated resolver: the outcome of a faceless battle in a few milliseconds, from the attrition rates in
// table.json (calibrate.js measures them with the full engine). Runs anywhere: no engine, no data.
//
//   const { predict } = require("./tools/resolver/resolver.js");
//   predict([{ template: "Ork Boy", count: 30 }], [{ template: "Astra Militarum Guardsman", count: 20 }])
//   -> { pWinA, pWinB, pDraw, lossA, lossB, seconds, sims }
//
// How: a battle second by second in aggregate. Each type's men put their effort on the enemy types they do most to
// (in proportion to how many of each there are and their rate against each), each second's removals are drawn at
// random around those rates, and the battle is fought `sims` times over (seeded, so the same call gives the same
// answer). A side with nobody standing has lost. lossA and lossB are the average share of each side removed.
// The rates are for a meeting engagement in the open; terrain and range will need their own calibration.
const fs = require("fs"), path = require("path");
let TABLE = null;
const table = () => TABLE || (TABLE = JSON.parse(fs.readFileSync(path.join(__dirname, "table.json"), "utf8")));

// a small seeded generator and a Poisson draw (Knuth's for small means, a normal approximation for large)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function poisson(mean, R) {
  if (mean <= 0) return 0;
  if (mean > 30) { const u = Math.max(1e-12, R()), v = R(); return Math.max(0, Math.round(mean + Math.sqrt(mean) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v))); }
  const L = Math.exp(-mean); let k = 0, p = 1;
  do { k++; p *= R(); } while (p > L);
  return k - 1;
}

function predict(armyA, armyB, opt = {}) {
  const T = opt.table || table(), sims = opt.sims ?? 400, maxSec = opt.maxSeconds ?? 300, R = rng(opt.seed ?? 1);
  const types = [...armyA.map(e => ({ t: e.template, n: e.count, side: 0 })), ...armyB.map(e => ({ t: e.template, n: e.count, side: 1 }))];
  for (const x of types) if (!T.rate[x.t]) throw new Error(`the resolver has no rates for ${x.t}: add it to roster.json and calibrate`);
  const n0 = [0, 1].map(s => types.filter(x => x.side === s).reduce((a, x) => a + x.n, 0));
  let win = [0, 0], draw = 0, loss = [0, 0], secs = 0;
  for (let k = 0; k < sims; k++) {
    const N = types.map(x => x.n);
    let s = 0;
    for (; s < maxSec; s++) {
      const alive = [0, 1].map(side => types.reduce((a, x, i) => a + (x.side === side ? N[i] : 0), 0));
      if (!alive[0] || !alive[1]) break;
      const hit = new Array(types.length).fill(0);
      types.forEach((x, i) => {
        if (!N[i]) return;
        const foes = types.map((y, j) => y.side !== x.side && N[j] ? N[j] * (T.rate[x.t][y.t] || 0) : 0), tot = foes.reduce((a, v) => a + v, 0);
        if (!tot) return;
        foes.forEach((v, j) => { if (v) hit[j] += N[i] * (T.rate[x.t][types[j].t] || 0) * (v / tot); });
      });
      hit.forEach((h, j) => { N[j] = Math.max(0, N[j] - poisson(h, R)); });
    }
    const left = [0, 1].map(side => types.reduce((a, x, i) => a + (x.side === side ? N[i] : 0), 0));
    if (left[0] && !left[1]) win[0]++; else if (left[1] && !left[0]) win[1]++; else draw++;
    loss[0] += 1 - left[0] / n0[0]; loss[1] += 1 - left[1] / n0[1]; secs += s;
  }
  return { pWinA: win[0] / sims, pWinB: win[1] / sims, pDraw: draw / sims, lossA: loss[0] / sims, lossB: loss[1] / sims, seconds: secs / sims, sims };
}
module.exports = { predict, table };
