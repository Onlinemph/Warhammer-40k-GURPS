// The war's rules: a game is its event log, and the log rebuilds the same war every time.
const test = require("node:test");
const assert = require("node:assert/strict");
const { SCALE } = require("../world/units.js");
const { apply, rebuild, view, order, total, supplied } = require("../world/rules.js");
const { at, hold, clear: clearW, G, RG } = require("./helpers.js");

const start = () => [{ type: "create", seed: 7 }, { type: "join", player: "p1", name: "Varro", faction: "hegemony" }, { type: "join", player: "p2", name: "Gutrip", faction: "brawl" }];
function play(turns) {
  const ev = start(); let S = rebuild(ev);
  for (let t = 0; t < turns; t++) {
    for (const id of ["p1", "p2"]) {
      const wb = S.players[id].warband, here = S.worlds[wb.at], to = here.links[(t * 7 + id.length) % here.links.length];
      const e = { type: "order", player: id, move: t % 3 ? to : null, recruit: here.owner === S.players[id].faction ? [{ unit: id === "p1" ? "levy" : "brawler", count: 5 }] : [] };
      ev.push(e); S = apply(S, e);
    }
    const e = { type: "tick", seed: 1000 + t }; ev.push(e); S = apply(S, e);
  }
  return { S, ev };
}

test("the galaxy: every world reachable, each side with a capital it holds", () => {
  const S = rebuild(start());
  const seen = new Set(["w0"]), q = ["w0"];
  while (q.length) for (const n of S.worlds[q.shift()].links) if (!seen.has(n)) { seen.add(n); q.push(n); }
  assert.equal(seen.size, Object.keys(S.worlds).length);
  for (const f of ["hegemony", "apostates", "brawl", "chorus"]) assert.equal(S.worlds[S.factions[f].capital].owner, f);
  // three Dormant tombs, one a sector, asleep
  const tombs = Object.values(S.worlds).filter(w => w.tomb);
  assert.deepEqual(tombs.map(w => w.sector).sort(), [0, 1, 2]);
  for (const w of tombs) { assert.equal(w.owner, "dormant"); assert.equal(w.awake, false); }
});
test("the Dormant: a tomb sleeps, wakes when fought over or in its time, and repairs its fallen on a field it holds", () => {
  let S = rebuild(start());
  const id = Object.values(S.worlds).find(w => w.tomb).id, wake = S.worlds[id].wakeAt;
  // (the sleepers: the garrisons of the regions the Dormant hold; someone else may take a region of the tomb world)
  const sleepers = w => w.regions.filter(r => r.owner === "dormant").reduce((a, r) => a + total(r.garrison), 0), n0 = sleepers(S.worlds[id]);
  // left alone (no one fights there) it wakes on its turn, not before, and never adds to its sleepers
  for (let t = 1; t <= wake; t++) {
    S = apply(S, { type: "tick", seed: t });
    const fought = S.reports.some(r => r.world === id);
    if (!fought) assert.equal(S.worlds[id].awake, S.turn >= wake, `turn ${S.turn}`);
    if (S.worlds[id].owner === "dormant") assert.ok(sleepers(S.worlds[id]) <= n0);
  }
  // a fight it holds: the fallen come back by half
  S = rebuild(start());
  const w = Object.values(S.worlds).find(x => x.tomb);
  const p = at(S, S.players.p1, w.id); p.army = { levy: 30 };
  S = apply(S, { type: "tick", seed: 5 });
  const rep = S.reports.find(r => r.world === w.id);
  assert.ok(rep, "the levies fought at the tomb");
  assert.ok(S.worlds[w.id].awake, "the tomb woke");
  if (rep.winner === "dormant") {
    const before = total(rep.sides.find(s => s.faction === "dormant").before), after = total(RG.capitalOf(S.worlds[w.id]).garrison);
    assert.ok(after > before * 0.6, `repaired: ${after} of ${before}`);
  }
});
test("the log rebuilds exactly the same war", () => {
  const { S, ev } = play(20);
  assert.deepEqual(rebuild(ev), S);
});
test("orders: one jump at a time, recruits only at home, and a refused order changes nothing", () => {
  const S = rebuild(start()), here = S.worlds[S.players.p1.warband.at];
  const far = Object.values(S.worlds).find(w => w.id !== here.id && !here.links.includes(w.id));
  assert.match(order(S, { player: "p1", move: far.id }), /not one jump/);
  assert.match(order(S, { player: "p1", recruit: [{ unit: "brawler", count: 5 }] }), /can't raise/);
  assert.equal(S.players.p1.warband.orders, null);
  assert.equal(order(S, { player: "p1", move: here.links[0], recruit: [{ unit: "levy", count: 5 }] }), null);
});
test("a tick moves, recruits, pays for it, and writes the warband's history", () => {
  let S = rebuild(start());
  const wb = S.players.p1.warband, to = S.worlds[wb.at].links[0], before = S.factions.hegemony.stock.materiel;
  hold(S.worlds[to], "hegemony");   // home ground next door: no battle
  S = apply(S, { type: "order", player: "p1", move: to, recruit: [{ unit: "levy", count: 5 }] });
  S = apply(S, { type: "tick", seed: 1 });
  assert.equal(S.players.p1.warband.at, to);
  assert.equal(S.players.p1.warband.army.levy, 15 * SCALE + 5);
  assert.ok(S.players.p1.warband.history.some(h => /raised 5 Levy\b/.test(h)));
  assert.ok(S.factions.hegemony.stock.materiel < before + 20 * SCALE);
});
test("battles happen, worlds change hands, and the Chorus spreads", () => {
  const { S } = play(40);
  assert.ok(S.reports.length > 5, `${S.reports.length} battles`);
  assert.ok(Object.values(S.worlds).filter(w => w.regions.some(r => r.owner === "chorus")).length > 4, "the Chorus should have spread");
  assert.ok(Object.values(S.worlds).some(w => w.regions.some(r => r.owner && r.owner !== w.owner)), "some world contested");
  for (const r of S.reports) assert.ok(r.seed >= 0 && r.text.length > 20);
});
test("supply: a warband far from its own worlds holds out two turns, then wastes away", () => {
  let S = rebuild(start());
  const wb = S.players.p1.warband;
  const ok = supplied(S, "hegemony");
  const far = Object.values(S.worlds).find(w => !ok.has(w.id) && !w.links.some(n => ok.has(n)));
  const clear = () => { clearW(S.worlds[far.id]); S.swarms = []; for (const w of Object.values(S.worlds)) if (w.links.includes(far.id) && w.owner !== "hegemony") clearW(w); };
  at(S, wb, far.id); wb.army = { brawler: 0, levy: 40 }; S.players.p1.faction = "hegemony"; clear();
  const n0 = total(wb.army);
  S = apply(S, { type: "tick", seed: 3 }); clear();
  S = apply(S, { type: "tick", seed: 4 }); clear();
  assert.equal(S.players.p1.warband.supplied, false);
  assert.equal(total(S.players.p1.warband.army), n0, "two turns' grace");
  S = apply(S, { type: "tick", seed: 5 });
  assert.ok(total(S.players.p1.warband.army) < n0, "then it starts to go");
});
test("fog of war: a player sees armies only where the faction has eyes", () => {
  const { S } = play(5), v = view(S, "p1");
  const hidden = v.worlds.filter(w => !w.seen);
  assert.ok(hidden.length > 0);
  for (const w of hidden) assert.equal(w.forces, null);
  for (const w of v.worlds.filter(w => w.owner === "hegemony")) assert.ok(w.seen);
  assert.ok(!JSON.stringify(v).includes('"tokens"'));
});
test("the stockpile is shared out: two warbands recruiting in one tick get half each, and a shortfall is reported", () => {
  let S = rebuild([{ type: "create", seed: 7 }, { type: "join", player: "a", name: "A", faction: "hegemony" }, { type: "join", player: "b", name: "B", faction: "hegemony" }]);
  S.swarms = [];
  S.factions.hegemony.stock = { manpower: 0, materiel: 0 };   // only this tick's income to share: not enough for 50 each
  for (const id of ["a", "b"]) S = apply(S, { type: "order", player: id, move: null, recruit: [{ unit: "levy", count: 50 * SCALE }] });
  const before = { a: S.players.a.warband.army.levy, b: S.players.b.warband.army.levy };
  S = apply(S, { type: "tick", seed: 1 });
  const got = { a: S.players.a.warband.army.levy - before.a, b: S.players.b.warband.army.levy - before.b };
  // income comes in first (the capital's), then each may spend half of what there is
  assert.ok(Math.abs(got.a - got.b) <= 1, `equal shares: ${got.a} and ${got.b}`);
  assert.ok(got.a < 50 * SCALE && got.a > 0);
  assert.ok(S.players.a.warband.history.some(h => new RegExp(`raised ${got.a} of ${50 * SCALE} Levy .*share of the stockpile ran short`).test(h)));
});
