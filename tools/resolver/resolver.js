// The calibrated resolver: the outcome of a faceless battle in a few milliseconds, from the attrition rates in
// table.json and table2.json (calibrate.js and calibrate2.js measure them with the full engine). Runs anywhere: no
// engine, no data.
//
//   const { predict } = require("./tools/resolver/resolver.js");
//   predict([{ template: "Ork Boy", count: 30 }], [{ template: "Astra Militarum Guardsman", count: 20 }], { ground: "city", hold: 1 })
//   -> { pWinA, pWinB, pDraw, lossA, lossB, seconds, sims }
//
// How: a battle second by second in aggregate. Each type's men put their effort on the enemy types they do most to
// (in proportion to how many of each there are and their rate against each), each second's removals are drawn at
// random around those rates, and the battle is fought `sims` times over (seeded, so the same call gives the same
// answer). A side with nobody standing has lost. lossA and lossB are the average share of each side removed.
//
// With a `ground` (one of the war's, game/world/terrain.js) the rates are those measured on that class of ground
// (table2.json: open, broken, close, urban), and `hold: 1` (or 0) has that side holding a city, with the rates
// measured that way. Then three things the 10-against-10 rates can't show, fitted to big engine battles (fit.js):
//   - the approach: a pair's rate starts only after its measured onset, longer on the bigger map a big battle has;
//   - crowding: in a big army not every man can see or reach the enemy, so a man's rate falls as (n / 10)^-crowd;
//   - breaking: a side cut down to `breaks` of its strength runs (its rest are removed).
// Without a ground it is the old open-field resolver, unchanged.
const fs = require("fs"), path = require("path");
let TABLE = null, TABLE2;
const table = () => TABLE || (TABLE = JSON.parse(fs.readFileSync(path.join(__dirname, "table.json"), "utf8")));
const table2 = () => { if (TABLE2 === undefined) { const f = path.join(__dirname, "table2.json"); TABLE2 = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; } return TABLE2; };
// which class each of the war's grounds is
const CLASS = { desert: "open", tundra: "open", hills: "broken", mountains: "broken", farmland: "broken", wasteland: "broken", river: "broken", plains: "broken",
  forest: "close", jungle: "close", swamp: "close", town: "urban", city: "urban", hive: "urban", fortress: "urban" };
// the fitted constants, by class (fit.js writes them into table2.json as `fit`; these are the defaults before it)
const FIT0 = { crowd: 0, approach: 1, breaks: 0 };
// the map a battle of n soldiers is fought on (the war's own sizing, game/replay/build.js): its width, for the approach
const mapW = n => Math.max(100, Math.min(300, Math.round(100 + 0.6 * n)));

// a small seeded generator and a Poisson draw (Knuth's for small means, a normal approximation for large)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function poisson(mean, R) {
  if (mean <= 0) return 0;
  if (mean > 30) { const u = Math.max(1e-12, R()), v = R(); return Math.max(0, Math.round(mean + Math.sqrt(mean) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v))); }
  const L = Math.exp(-mean); let k = 0, p = 1;
  do { k++; p *= R(); } while (p > L);
  return k - 1;
}

// the rates and onsets for a battle: [i][j] is type i's against type j
function ratesFor(types, opt) {
  const T2 = opt.ground && table2(), cls = T2 && CLASS[opt.ground];
  const hold = opt.hold === 0 || opt.hold === 1 ? opt.hold : null;
  const X = cls && T2.tables[cls + (hold != null && T2.tables[cls + "-hold"] ? "-hold" : "")];
  if (!X) { const T = opt.table || table(); return { rate: types.map(x => types.map(y => x.side !== y.side ? (T.rate[x.t][y.t] || 0) : 0)), onset: null, fit: null }; }
  const fit = { ...FIT0, ...((T2.fit || {})[cls + (hold != null ? "-hold" : "")] || (T2.fit || {})[cls] || {}) };
  const rate = [], onset = [];
  for (const x of types) {
    const r = [], o = [];
    for (const y of types) {
      if (x.side === y.side) { r.push(0); o.push(0); continue; }
      // in a holding table the attacker's rates are rate[att][def], the holder's def[def][att]
      const att = hold == null || x.side !== hold;
      const R0 = hold == null ? X.rate : att ? X.rate : X.def, O0 = hold == null ? X.onset : att ? X.onset : X.donset;
      const key = hold == null || att ? [x.t, y.t] : [x.t, y.t];
      r.push((R0[key[0]] || {})[key[1]] || 0); o.push((O0[key[0]] || {})[key[1]] ?? 0);
    }
    rate.push(r); onset.push(o);
  }
  return { rate, onset, fit };
}

function predict(armyA, armyB, opt = {}) {
  const sims = opt.sims ?? 400, maxSec = opt.maxSeconds ?? 300, R = rng(opt.seed ?? 1);
  const types = [...armyA.map(e => ({ t: e.template, n: e.count, side: 0 })), ...armyB.map(e => ({ t: e.template, n: e.count, side: 1 }))];
  const T = table();
  for (const x of types) if (!T.rate[x.t]) throw new Error(`the resolver has no rates for ${x.t}: add it to roster.json and calibrate`);
  const n0 = [0, 1].map(s => types.filter(x => x.side === s).reduce((a, x) => a + x.n, 0));
  const { rate, onset, fit } = ratesFor(types, opt);
  // the approach on a big map, and crowding, per side
  const stretch = fit ? Math.pow(mapW(n0[0] + n0[1]) / mapW(20), fit.approach) : 1;
  const crowd = fit ? n0.map(n => Math.pow(Math.max(1, n / 10), -fit.crowd)) : [1, 1];
  const breaks = fit ? fit.breaks : 0;
  let win = [0, 0], draw = 0, loss = [0, 0], secs = 0;
  for (let k = 0; k < sims; k++) {
    const N = types.map(x => x.n);
    let s = 0;
    for (; s < maxSec; s++) {
      const alive = [0, 1].map(side => types.reduce((a, x, i) => a + (x.side === side ? N[i] : 0), 0));
      if (!alive[0] || !alive[1]) break;
      // a side cut down past its breaking point runs
      if (breaks) { let broke = false; for (const side of [0, 1]) if (alive[side] <= breaks * n0[side]) { types.forEach((x, i) => { if (x.side === side) N[i] = 0; }); broke = true; } if (broke) break; }
      const hit = new Array(types.length).fill(0);
      types.forEach((x, i) => {
        if (!N[i]) return;
        const live = j => onset ? s >= onset[i][j] * stretch : true;
        const foes = types.map((y, j) => y.side !== x.side && N[j] && live(j) ? N[j] * rate[i][j] : 0), tot = foes.reduce((a, v) => a + v, 0);
        if (!tot) return;
        foes.forEach((v, j) => { if (v) hit[j] += N[i] * rate[i][j] * crowd[x.side] * (v / tot); });
      });
      hit.forEach((h, j) => { N[j] = Math.max(0, N[j] - poisson(h, R)); });
    }
    const left = [0, 1].map(side => types.reduce((a, x, i) => a + (x.side === side ? N[i] : 0), 0));
    if (left[0] && !left[1]) win[0]++; else if (left[1] && !left[0]) win[1]++; else draw++;
    loss[0] += 1 - left[0] / n0[0]; loss[1] += 1 - left[1] / n0[1]; secs += s;
  }
  return { pWinA: win[0] / sims, pWinB: win[1] / sims, pDraw: draw / sims, lossA: loss[0] / sims, lossB: loss[1] / sims, seconds: secs / sims, sims };
}
// set the fitted constants (fit.js), or a stand-in table2 for testing
const setTable2 = t => { TABLE2 = t; };
module.exports = { predict, table, table2, setTable2, CLASS };
