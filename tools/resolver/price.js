// Each unit's worth in Levies as the war now fights (Tactical Mass Combat, game/world/tmc.js), measured the way the
// war's first prices were: against reference foes (a line of Levies, a mob of Brawlers, Wardens in power armour, a
// Chorus brood), the fewest of a unit that beat each half the time, against the Levies it takes, a geometric mean.
// Prints each unit's worth and its cost.
//   node tools/resolver/price.js [unit...]
const T = require("../../game/world/tmc.js");
const { UNITS } = require("../../game/world/units.js");
const GROUNDS = (process.env.GROUNDS || "plains,town").split(","), RUNS = +(process.env.RUNS || 4);
const REFS = [["levy", 40], ["brawler", 40], ["warden", 10], ["leaper", 60]];
const fac = u => UNITS[u].faction;
const win = (unit, n, ref, m) => GROUNDS.reduce((a, g, i) => a + T.predict({ ground: g, seed: 11 + i, attacker: 0,
  sides: [{ faction: fac(unit), army: { [unit]: n }, leader: 11 }, { faction: fac(ref), army: { [ref]: m }, leader: 11 }] }, RUNS).pWinA, 0) / GROUNDS.length;
// the fewest of `unit` that beat m of `ref` half the time (grown from one, then halved in)
function needed(unit, ref, m) {
  let lo = 0, hi = 1;
  while (win(unit, hi, ref, m) < 0.5) { lo = hi; hi = Math.ceil(hi * 1.6); if (hi > 3000) return 3000; }
  while (hi - lo > 1 && hi / Math.max(1, lo) > 1.06) { const mid = Math.round((lo + hi) / 2); if (mid <= lo || mid >= hi) break; if (win(unit, mid, ref, m) >= 0.5) hi = mid; else lo = mid; }
  return hi;
}
const levyNeeds = {};
function worth(unit) {
  let s = 0;
  for (const [ref, m] of REFS) { const L = (levyNeeds[ref] ??= needed("levy", ref, m)), X = needed(unit, ref, m); s += Math.log(L / X); }
  return Math.round(Math.exp(s / REFS.length) * 100) / 100;
}
if (require.main === module) {
  const list = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(UNITS);
  for (const u of list) console.log(u.padEnd(16), UNITS[u].faction.padEnd(10), String(worth(u)).padStart(7), JSON.stringify(UNITS[u].cost));
}
module.exports = { worth };
