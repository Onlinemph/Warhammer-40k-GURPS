// Golden battles: seeded fights whose outcomes and full logs are recorded in golden.json. Any engine change that
// alters what happens in one of these battles fails here. That's the point: the MMO stores battles as a seed plus
// the engine version, so a silent change would rewrite history. When a change is meant to alter outcomes (a rules
// fix, new AI), regenerate the file and commit it with the change:
//   GOLDEN_UPDATE=1 node --test tools/sim/test/determinism.test.js
// Needs `python3 tools/build_site.py` first, like the rules tests.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const SIM = require("../load.js");

const html = fs.readFileSync(path.join(__dirname, "..", "..", "..", "site", "index.html"), "utf8");
const DATA = JSON.parse(html.slice(html.indexOf("const DATA = ") + 13, html.indexOf(";\nconst LIBS")));
SIM.index(DATA);
const lo = DATA.loadouts || {};
const spec = (template, count, extra = {}) => ({ template, count, ...(lo[template] || {}), ...extra });
const side = (s, template, count) => ({ side: s, spec: spec(template, count) });
const squad = (name, s) => SIM.squadSpecs(name, name + s).map(sp => ({ side: s, spec: { ...(lo[sp.template] || {}), ...sp, armour: sp.armour || (lo[sp.template] || {}).armour || [] } }));

// a spread of what the engine does: massed fire, a melee charge, power armour, reanimation, a mapped facility
// with doors and search, and a vehicle against infantry
const BATTLES = {
  "guard vs boyz, open": { seed: 101, units: () => [side(0, "Astra Militarum Guardsman", 10), side(1, "Ork Boy", 10)], opt: { distance: 50 } },
  "boyz charge marines": { seed: 202, units: () => [side(0, "Ork Boy", 10), side(1, "Astartes Battle-Brother", 5)], opt: { distance: 30 } },
  "genestealers in the facility": { seed: 303, units: () => [side(0, "Genestealer", 5), side(1, "Astartes Battle-Brother", 5)], opt: { battlefield: "facility", mapSeed: 2 } },
  "fire warriors vs necrons": { seed: 404, units: () => [side(0, "Fire Warrior (Shas'la)", 10), side(1, "Necron Warrior", 10)], opt: { distance: 100 } },
  "leman russ vs tactical squad": { seed: 505, units: () => [{ side: 0, spec: { vehicle: "Leman Russ Battle Tank", template: "Leman Russ Battle Tank", count: 1, stance: "shoot", armour: [] } }, ...squad("Astartes Tactical Squad", 1)], opt: { distance: 150 } },
};

const sha = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
function fingerprint(r) {
  return { winner: r.winner, turns: r.turns, units: r.units.map(u => [u.name, u.standing, u.dead, u.kills]), log: sha(r.log.join("\n")) };
}
const fight = (b, extra = {}) => SIM.runBattle(b.units(), { ...b.opt, seed: b.seed, log: true, ...extra });

const GOLDEN = path.join(__dirname, "golden.json");
if (process.env.GOLDEN_UPDATE) {
  const out = {};
  for (const [name, b] of Object.entries(BATTLES)) out[name] = fingerprint(fight(b));
  fs.writeFileSync(GOLDEN, "{\n" + Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n}\n");
}
const golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));

for (const [name, b] of Object.entries(BATTLES)) {
  test(`golden battle: ${name}`, () => {
    assert.ok(golden[name], `${name} isn't in golden.json; regenerate it (see the top of this file)`);
    assert.deepEqual(fingerprint(fight(b)), golden[name], `${name} played out differently from the recorded battle`);
  });
}

test("a seeded battle ignores whatever ran before it", () => {
  const b = BATTLES["guard vs boyz, open"];
  const alone = fingerprint(fight(b));
  SIM.seed(999); SIM.runBattle(BATTLES["boyz charge marines"].units(), { distance: 30 });   // churn both streams
  SIM.runBattle(BATTLES["boyz charge marines"].units(), { distance: 30 });                  // and an unseeded battle
  assert.deepEqual(fingerprint(fight(b)), alone);
});

test("each seeded Monte Carlo run is its own battle, replayable alone from its derived seed", () => {
  const b = BATTLES["guard vs boyz, open"], specs = b.units();
  const mc = SIM.monteCarlo(specs, { ...b.opt, runs: 4, seed: 77 });
  mc.runsList.forEach(([turns, winner], i) => {
    const r = SIM.runBattle(specs, { ...b.opt, seed: SIM.mixSeed(77, i) });
    assert.deepEqual([r.turns, r.winner], [turns, winner], `run ${i}`);
  });
  const again = SIM.monteCarlo(specs, { ...b.opt, runs: 4, seed: 77 });
  assert.deepEqual(again.runsList, mc.runsList);
});

test("the result carries the seed it was played from", () => {
  const b = BATTLES["guard vs boyz, open"];
  assert.equal(SIM.runBattle(b.units(), { ...b.opt, seed: 4242 }).seed, 4242);
  assert.equal(SIM.runBattle(b.units(), b.opt).seed, null);
});
