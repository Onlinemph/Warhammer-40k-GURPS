// Reference fights against the built site data, printing win rates: `node tools/sim/test/smoke.js [name] [log]`.
// Nothing here passes or fails; test/rules.test.js holds the assertions.
const fs = require("fs"), path = require("path");
const SIM = require("../load.js");
const html = fs.readFileSync(path.join(__dirname, "..", "..", "..", "site", "index.html"), "utf8");
const start = html.indexOf("const DATA = ") + 13, end = html.indexOf(";\nconst LIBS");
const DATA = JSON.parse(html.slice(start, end));
SIM.index(DATA);
const lo = DATA.loadouts || {};
const spec = (template, count, extra = {}) => ({ template, count, ...(lo[template] || {}), ...extra });
const fights = [
  ["Astra Militarum Guardsman", 10, "Astartes Battle-Brother", 1, 100],
  ["Astra Militarum Guardsman", 20, "Astartes Battle-Brother", 5, 100],
  ["Ork Boy", 10, "Astartes Battle-Brother", 5, 30],
  ["Genestealer", 5, "Astartes Battle-Brother", 5, 40],
  ["Fire Warrior (Shas'la)", 10, "Necron Warrior", 10, 100],
  ["Custodian Guardian", 1, "Astartes Battle-Brother", 3, 20],
];
const only = process.argv[2];
for (const [a, na, b, nb, d] of fights) {
  if (only && !a.includes(only) && !b.includes(only)) continue;
  const specs = [{ side: 0, spec: spec(a, na) }, { side: 1, spec: spec(b, nb) }];
  for (const s of specs) {
    const u = SIM.buildUnit(s.spec, s.side);
    console.log(s.spec.template, JSON.stringify(SIM.describe(u)));
  }
  const r = SIM.monteCarlo(specs, { runs: 300, distance: d, seed: 1 });
  console.log(`${na}x ${a} vs ${nb}x ${b} @${d}yd: A ${r.wins[0]} / B ${r.wins[1]} / draw ${r.draws}, avg ${r.turns.toFixed(1)} turns`,
    r.units.map(u => `${u.name}: ${u.standing.toFixed(1)}/${u.count} standing, ${u.kills.toFixed(1)} kills`).join("; "));
  console.log();
}
if (process.argv[3] === "log") {
  const [a, na, b, nb, d] = fights.find(f => f[0].includes(only) || f[2].includes(only));
  SIM.seed(7);
  console.log(SIM.runBattle([{ side: 0, spec: spec(a, na) }, { side: 1, spec: spec(b, nb) }], { distance: d, log: true }).log.slice(0, 80).join("\n"));
}
