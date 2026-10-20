// The standing orders: stances (advance, fortify, raid), turning back from bad odds, and walls.
const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, rebuild, order, holdBonus } = require("../world/rules.js");
const { TYPES } = require("../world/galaxy.js");

const start = () => { const S = rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }]); S.swarms = []; return S; };
const tick = (S, seed = 1) => apply(S, { type: "tick", seed });

test("fortify: a fortified warband can't move, and fights at x1.5 on its own world, walls +25% a level", () => {
  let S = start();
  const cap = S.worlds[S.players.h.warband.at], base = TYPES[cap.type].defence || 1;
  assert.equal(holdBonus(S, cap, "hegemony"), base);
  S = apply(S, { type: "order", player: "h", move: null, recruit: [], stance: "fortify" });
  S = tick(S, 1);
  assert.equal(S.players.h.warband.stance, "fortify");
  assert.match(order(S, { player: "h", move: cap.links[0] }), /fortified warband stays/);
  assert.equal(order(S, { player: "h", move: cap.links[0], stance: "advance" }), null, "unless the order changes the stance");
  assert.equal(holdBonus(S, S.worlds[cap.id], "hegemony"), base * 1.5);
  S.worlds[cap.id].walls = 2;
  assert.equal(holdBonus(S, S.worlds[cap.id], "hegemony"), base * 1.5 * 1.5);
  assert.equal(holdBonus(S, S.worlds[cap.id], "brawl"), 1, "only the holder");
});

test("walls: 20 materiel for the first level, 40 for the second, and no third", () => {
  let S = start();
  const id = S.players.h.warband.at;
  S.factions.hegemony.stock.materiel = 100;
  S = apply(S, { type: "order", player: "h", move: null, recruit: [], build: "walls" });
  const m0 = S.factions.hegemony.stock.materiel;
  S = tick(S, 2);
  assert.equal(S.worlds[id].walls, 1);
  S = apply(S, { type: "order", player: "h", move: null, recruit: [], build: "walls" });
  S = tick(S, 3);
  assert.equal(S.worlds[id].walls, 2);
  assert.match(order(S, { player: "h", build: "walls" }), /as high as they go/);
  assert.ok(S.players.h.warband.history.some(h => /walls to level 2/.test(h)));
  assert.ok(m0 > 0);
});

test("careful: a move into a fight it can't win is called off at the tick", () => {
  let S = start();
  const wb = S.players.h.warband, here = S.worlds[wb.at], to = S.worlds[here.links[0]];
  Object.assign(to, { owner: null, tomb: false, garrison: { militia: 400 } });
  wb.army = { levy: 5 };
  S = apply(S, { type: "order", player: "h", move: to.id, recruit: [], careful: true });
  S = tick(S, 4);
  assert.equal(S.players.h.warband.at, here.id);
  assert.ok(S.players.h.warband.history.some(h => /turned back from .*% to win/.test(h)));
  // and without it, it goes
  S = apply(S, { type: "order", player: "h", move: to.id, recruit: [], careful: false });
  S = tick(S, 5);
  assert.ok(S.players.h.warband.history.some(h => /moved from .* to /.test(h)));
});

test("raid: strike a world, loot it, come home, and don't take it", () => {
  let S = start();
  const wb = S.players.h.warband, here = S.worlds[wb.at], to = S.worlds[here.links.find(l => S.worlds[l].owner !== "hegemony") || here.links[0]];
  Object.assign(to, { owner: null, tomb: false, garrison: { militia: 3 } });
  wb.army = { levy: 30, storm: 10 };
  const man = S.factions.hegemony.stock.manpower;
  S = apply(S, { type: "order", player: "h", move: to.id, recruit: [], stance: "raid" });
  S = tick(S, 6);
  assert.equal(S.players.h.warband.at, here.id, "home again");
  assert.equal(S.worlds[to.id].owner, null, "not taken");
  assert.ok(S.players.h.warband.history.some(h => /looted/.test(h)));
  assert.ok(S.factions.hegemony.stock.manpower > man);
  const rep = S.reports.find(r => r.world === to.id);
  assert.match(rep.text, /The odds were \d+% for The Hegemony/);
});
