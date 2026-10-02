// Exact penetration odds for a damage line: `node tools/sim/pen.js "6dx6(5) cr ex" [DR[/WP] ...]`.
// With no DRs it prints the vehicle AV table (docs/framework.md) and the main personal armours. A DR written
// as 85/4 adds the Weak Points chance (a hit that fails rolls 3d against the rating and, on a success, faces
// half DR; docs/framework.md "Weak points").
const SIM = require("./load.js");

function dice(n) {
  let d = new Map([[0, 1]]);
  for (let i = 0; i < n; i++) { const e = new Map(); for (const [s, p] of d) for (let f = 1; f <= 6; f++) e.set(s + f, (e.get(s + f) || 0) + p / 6); d = e; }
  return d;
}
const roll3 = k => { let t = 0; for (const [s, p] of dice(3)) if (s <= k) t += p; return t; };
function pen(text, dr, wp = 0) {
  const dm = SIM.parseDamage(text);
  if (!dm) throw new Error(`can't read damage "${text}"`);
  const through = d => {
    const eff = dm.div === Infinity ? 0 : Math.floor(d / dm.div);
    let p = 0;
    for (const [s, q] of dice(dm.n)) if (Math.floor(Math.max(dm.type === "cr" ? 0 : 1, s + dm.add) * dm.mult) > eff) p += q;
    return p;
  };
  const p = through(dr);
  return { p, wp: wp ? p + (1 - p) * roll3(wp) * through(Math.floor(dr / 2)) : null, eff: dm.div === Infinity ? 0 : Math.floor(dr / dm.div),
    avg: (dm.n * 3.5 + dm.add) * dm.mult };
}
const TABLE = [["AV10", 125], ["AV11", 185], ["AV12", 250], ["AV13", 340], ["AV14", 440], ["Leman Russ front / Land Raider", 1350],
  ["flak", 30], ["carapace", 70], ["Sororitas", 85], ["Astartes Mk VII", 100], ["Gravis", 130], ["Terminator", 200]];
module.exports = { pen, TABLE };

if (require.main === module) {
  const [text, ...rest] = process.argv.slice(2);
  if (!text) { console.log('usage: node tools/sim/pen.js "6dx6(5) cr ex" [DR[/WP] ...]'); process.exit(1); }
  const rows = rest.length ? rest.map(a => { const [d, w] = a.split("/").map(Number); return [a, d, w || 0]; }) : TABLE.map(([n, d]) => [`${n} (DR ${d})`, d, 0]);
  console.log(`${text}: average ${pen(text, 0).avg.toFixed(1)}`);
  for (const [name, dr, wp] of rows) {
    const r = pen(text, dr, wp);
    console.log(`  ${name.padEnd(36)} eff. DR ${String(r.eff).padStart(4)}  ${(100 * r.p).toFixed(1).padStart(5)}%${r.wp != null ? `  (${(100 * r.wp).toFixed(1)}% with WP ${wp})` : ""}`);
  }
}
