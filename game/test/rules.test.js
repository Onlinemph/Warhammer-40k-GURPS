// The war's rules: a game is its event log, and the log rebuilds the same war every time.
const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, rebuild, view, order, total, supplied } = require("../world/rules.js");

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
  for (const f of ["hegemony", "brawl", "chorus"]) assert.equal(S.worlds[S.factions[f].capital].owner, f);
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
  Object.assign(S.worlds[to], { owner: "hegemony", garrison: {} });   // home ground next door: no battle
  S = apply(S, { type: "order", player: "p1", move: to, recruit: [{ unit: "levy", count: 5 }] });
  S = apply(S, { type: "tick", seed: 1 });
  assert.equal(S.players.p1.warband.at, to);
  assert.equal(S.players.p1.warband.army.levy, 20);
  assert.ok(S.players.p1.warband.history.some(h => /raised 5 Levy Trooper/.test(h)));
  assert.ok(S.factions.hegemony.stock.materiel < before + 20);
});
test("battles happen, worlds change hands, and the Chorus spreads", () => {
  const { S } = play(40);
  assert.ok(S.reports.length > 5, `${S.reports.length} battles`);
  assert.ok(Object.values(S.worlds).filter(w => w.owner === "chorus").length > 4, "the Chorus should have grown");
  for (const r of S.reports) assert.ok(r.seed >= 0 && r.text.length > 20);
});
test("supply: a warband far from its own worlds wastes away", () => {
  let S = rebuild(start());
  const wb = S.players.p1.warband;
  const ok = supplied(S, "hegemony");
  const far = Object.values(S.worlds).find(w => !ok.has(w.id) && !w.links.some(n => ok.has(n)));
  wb.at = far.id; S.worlds[far.id].garrison = {}; S.swarms = [];
  for (const w of Object.values(S.worlds)) if (w.links.includes(far.id) && w.owner !== "hegemony") w.garrison = {};
  const n0 = total(wb.army);
  S = apply(S, { type: "tick", seed: 3 });
  assert.equal(S.players.p1.warband.supplied, false);
  assert.ok(total(S.players.p1.warband.army) < n0);
});
test("fog of war: a player sees armies only where the faction has eyes", () => {
  const { S } = play(5), v = view(S, "p1");
  const hidden = v.worlds.filter(w => !w.seen);
  assert.ok(hidden.length > 0);
  for (const w of hidden) assert.equal(w.forces, null);
  for (const w of v.worlds.filter(w => w.owner === "hegemony")) assert.ok(w.seen);
  assert.ok(!JSON.stringify(v).includes('"tokens"'));
});
