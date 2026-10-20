// Fronts (game/world/fronts.js): garrisons answer threats, quiet worlds help threatened ones; and melee that ignores
// cover unless it's a fortification (game/world/tmc.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const { SCALE } = require("../world/units.js");
const { rebuild, apply, total } = require("../world/rules.js");
const T = require("../world/tmc.js");
const { at, hold, cap, quiet, RG } = require("./helpers.js");

test("a garrison moves a region toward the city its foes are next to, and stays at its floor", () => {
  let S = quiet(rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }, { type: "join", player: "b", name: "Gutrip", faction: "brawl" }]));
  const w = Object.values(S.worlds).find(x => x.owner === "hegemony" && !x.capital);
  const c = cap(w), quietCity = RG.cities(w).find(r => !r.capital && RG.steps(w, r.id, c.id) >= 2);
  assert.ok(quietCity, "a city two regions from the capital");
  for (const r of w.regions) r.garrison = {};
  c.garrison = { levy: 10 * SCALE }; quietCity.garrison = { levy: 60 * SCALE };
  // a Brawl warband next to the capital, in a region of the Hegemony's
  const by = RG.region(w, c.links[0]);
  at(S, S.players.b, w.id, by.id); S.players.b.warband.army = { brawler: 80 * SCALE };
  at(S, S.players.h, S.factions.hegemony.capital);
  const before = total(quietCity.garrison);
  S = apply(S, { type: "tick", seed: 3 });
  const after = total(RG.region(S.worlds[w.id], quietCity.id).garrison);
  assert.ok(after < before, `the quiet city sent some (${before} -> ${after})`);
  assert.ok(after >= 5 * SCALE, "never below its floor");
});

test("melee ignores cover unless it's a fortification: buildings don't stop an assault, earthworks do", () => {
  const sd = (f, a, more = {}) => ({ faction: f, army: a, leader: 11, ...more });
  const p = (ground, earthworks) => T.predict({ ground, seed: 3, attacker: 0, hold: 1, sides: [sd("brawl", { brawler: 200, boss: 40 }), sd("hegemony", { levy: 200, storm: 20 }, { earthworks })] }, 8).pWinA;
  assert.ok(p("city", false) >= 0.2, "an assault on a city held by Levies has a chance");
  assert.ok(p("city", true) <= p("city", false), "earthworks count against it");
});

test("a siege: the besieged starve, raise no levies, rally no one; guns breach the walls every two turns", () => {
  let S = quiet(rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }]));
  const w = Object.values(S.worlds).find(x => !x.owner && !x.tomb);
  hold(w, "apostates", { turncoat: 50 * SCALE }); w.walls = 2;
  const c = cap(w), next = RG.region(w, c.links[0]);
  next.owner = "hegemony";
  at(S, S.players.h, w.id, next.id); S.players.h.warband.army = { levy: 20 * SCALE, heavy_team: 10 };
  S = apply(S, { type: "order", player: "h", stance: "besiege", recruit: [] });
  const g0 = total(c.garrison);
  S = apply(S, { type: "tick", seed: 1 });
  const c1 = RG.region(S.worlds[w.id], c.id);
  assert.equal(c1.siege, 1);
  assert.ok(total(c1.garrison) < g0, "starving");
  S = apply(S, { type: "tick", seed: 2 });
  assert.equal(RG.region(S.worlds[w.id], c.id).siege, 2);
  assert.equal(S.worlds[w.id].walls, 1, "breached");
  assert.ok(S.log.some(l => /lay siege to/.test(l.text)) && S.log.some(l => /breach/.test(l.text)));
});
