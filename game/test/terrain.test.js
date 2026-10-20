// The ground battles are fought on (game/world/terrain.js, the engine's countryside and city generators): every world
// has a mix, every battle a ground from it, every ground a map both armies can cross, and the old map unchanged.
const test = require("node:test");
const assert = require("node:assert/strict");
const { SIM, unitSpec } = require("../../tools/resolver/common.js");
const TER = require("../world/terrain.js");
const { apply } = require("../world/rules.js");

test("every ground builds a map the armies can cross, the same each time, and plain countryside is the old map", () => {
  const plain = SIM.battlefields.countryside(3, { mapW: 120, mapH: 60 });
  assert.equal(SIM.battlefields.countryside(3, { mapW: 120, mapH: 60, ...TER.battlefield("plains") }), plain, "plains: no dials, the old map");
  for (const t of Object.keys(TER.TERRAIN)) {
    const bf = TER.battlefield(t), opt = { mapW: 120, mapH: 60, mapSeed: 4, seed: 9, maxTurns: 200, log: true, ...bf };
    const a = SIM.battlefields[bf.battlefield](4, opt), b = SIM.battlefields[bf.battlefield](4, opt);
    assert.equal(a, b, `${t}: built once, the same`);
    const r = SIM.runBattle([unitSpec("Astra Militarum Guardsman", 10, 0), unitSpec("Ork Boy", 10, 1)], opt);
    assert.ok(r.winner >= 0 || r.turns >= 200, `${t}: a battle with an end`);
    assert.equal(r.log.filter(l => /can.t find a way/.test(l)).length, 0, `${t}: nobody stuck`);
  }
});

test("each world has a mix of ground from its type, and each battle is fought on one of them", () => {
  let S = apply(null, { type: "create", seed: 7 });
  for (const w of Object.values(S.worlds)) { assert.ok(Object.keys(w.terrain).length >= 2); for (const k of Object.keys(w.terrain)) assert.ok(TER.TERRAIN[k]); }
  for (let t = 0; t < 15; t++) S = apply(S, { type: "tick", seed: 100 + t });
  assert.ok(S.reports.length > 0);
  for (const r of S.reports) { assert.ok(S.worlds[r.world].terrain[r.terrain] > 0, `${r.terrain} on ${r.worldName}`); assert.match(r.text, /Fought (on|in|at) /); }
  // a leader who wins the ground picks close ground for hand-to-hand fighters, open for the guns
  const w = { terrain: { plains: 3, forest: 1, city: 1 } };
  assert.ok(TER.TERRAIN[TER.pick(w, 1, { melee: true })].close);
  assert.ok(TER.TERRAIN[TER.pick(w, 1, { melee: false })].open);
  assert.deepEqual(TER.factors("city", { army: { brawler: 10 } }, { army: { levy: 10 } }), [1.15, 1]);
  assert.deepEqual(TER.factors("plains", { army: { brawler: 10 } }, { army: { levy: 10 } }), [1, 1.1]);
});
