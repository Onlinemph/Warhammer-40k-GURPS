// Politics and contracts (game/world/politics.js): service, elections, recall and absence, contracts in escrow and
// paid into treasuries, priority, and the log still rebuilding the war.
const test = require("node:test");
const assert = require("node:assert/strict");
const { SCALE } = require("../world/units.js");
const { apply, rebuild, politics } = require("../world/rules.js");
const { at, hold, quiet } = require("./helpers.js");

const start = () => { const S = rebuild([{ type: "create", seed: 7 },
  { type: "join", player: "a", name: "Ansel", faction: "hegemony" }, { type: "join", player: "b", name: "Brannoc", faction: "hegemony" }, { type: "join", player: "c", name: "Corvin", faction: "hegemony" }]); S.swarms = []; return S; };
const tick = (S, seed) => quiet(apply(quiet(S), { type: "tick", seed }));
const pol = (S, player, action, rest = {}) => { const e = { type: "politics", player, action, ...rest }; const err = politics(S, e); if (err) return err; apply(S, e); return null; };
const P = S => S.politics.hegemony;

test("service: a turn in the field, a battle, a win", () => {
  let S = start();
  const s0 = S.players.a.warband.service;
  S = tick(S, 1);
  assert.equal(S.players.a.warband.service, s0 + 1);
  const wb = S.players.a.warband, here = S.worlds[wb.at], to = S.worlds[here.links.find(l => S.worlds[l].owner !== "hegemony") || here.links[0]];
  hold(to, null, { militia: 3 }); to.tomb = false;
  wb.army = { levy: 60, storm: 10 };
  S = apply(S, { type: "order", player: "a", move: to.id, recruit: [] });
  const s1 = S.players.a.warband.service;
  S = tick(S, 2);
  assert.equal(S.players.a.warband.service, s1 + 1 + 2 + 3);
  assert.equal(S.players.a.warband.battles, 1);
});

test("standing needs 5 turns and 3 battles; the election on turn 5 goes to the most service-weighted votes", () => {
  let S = start();
  assert.match(pol(S, "a", "stand"), /5 turns served and 3 battles/);
  for (const id of ["a", "b", "c"]) { S.players[id].warband.battles = 3; S.players[id].warband.joinedTurn = -10; }
  S.players.a.warband.service = 10; S.players.b.warband.service = 30; S.players.c.warband.service = 50;
  assert.equal(pol(S, "a", "stand"), null);
  assert.equal(pol(S, "b", "stand"), null);
  assert.match(pol(S, "c", "vote", { for: "c" }), /one of the candidates/);
  pol(S, "a", "vote", { for: "a" }); pol(S, "b", "vote", { for: "b" }); pol(S, "c", "vote", { for: "a" });
  for (let t = 1; t <= 5; t++) S = tick(S, t);
  assert.equal(P(S).warmaster, "a", "Ansel's 10 and Corvin's 50 beat Brannoc's 30");
  assert.deepEqual(P(S).candidates, []);
  assert.ok(P(S).log.some(l => /Ansel is elected Warmaster/.test(l.text)));
  assert.ok(S.log.some(l => /new Warmaster of The Hegemony/.test(l.text)));
  // recall: more than half the faction's service
  pol(S, "c", "recall");
  S = tick(S, 6);
  assert.equal(P(S).warmaster, null, "Corvin alone has more than half");
  assert.ok(P(S).log.some(l => /recalled/.test(l.text)));
});

test("a Warmaster who gives no orders for 3 turns loses the office", () => {
  let S = start();
  P(S).warmaster = "a"; S.players.a.lastActive = S.turn;
  for (let t = 1; t <= 5; t++) { S = apply(S, { type: "order", player: "b", move: null, recruit: [] }); S = tick(S, 10 + t); }
  assert.equal(P(S).warmaster, null);
  assert.ok(P(S).log.some(l => /no orders for 3 turns/.test(l.text)));
});

test("contracts: the reward goes into escrow; taking the world pays the taker's treasury; cancelling an accepted one pays half", () => {
  let S = start();
  P(S).warmaster = "a";
  const st = S.factions.hegemony.stock;
  st.materiel = 100; st.manpower = 100;
  const wb = S.players.b.warband, here = S.worlds[wb.at], to = S.worlds[here.links.find(l => S.worlds[l].owner !== "hegemony") || here.links[0]];
  hold(to, null, { militia: 3 }); to.tomb = false;
  for (const r of to.regions) if (!r.capital) r.owner = "hegemony";   // the last battle of a campaign: the rest is taken
  assert.match(pol(S, "b", "post", { contract: { kind: "take", world: to.id, deadline: 5, reward: { materiel: 20 } } }), /only the Warmaster/);
  assert.match(pol(S, "a", "post", { contract: { kind: "take", world: to.id, deadline: 5, reward: { materiel: 500 } } }), /hasn't 500 materiel/);
  assert.equal(pol(S, "a", "post", { contract: { kind: "take", world: to.id, deadline: 5, reward: { materiel: 20, manpower: 10 } } }), null);
  assert.equal(st.materiel, 80, "in escrow");
  wb.army = { levy: 60, storm: 10 };
  S = apply(S, { type: "order", player: "b", move: to.id, recruit: [] });
  S = tick(S, 20);
  assert.equal(S.worlds[to.id].owner, "hegemony");
  assert.equal(S.players.b.warband.treasury.materiel, 20);
  assert.equal(S.players.b.warband.record.done, 1);
  assert.equal(P(S).contracts.length, 0);
  // an offered contract, accepted, then cancelled: half to the taker, half back
  const m0 = S.factions.hegemony.stock.materiel;
  const tomb = Object.values(S.worlds).find(w => w.tomb);
  assert.equal(pol(S, "a", "post", { contract: { kind: "break", world: tomb.id, deadline: 10, reward: { materiel: 40 }, offer: "c" } }), null);
  assert.match(pol(S, "b", "accept", { id: P(S).contracts[0].id }), /offered to you/);
  assert.equal(pol(S, "c", "accept", { id: P(S).contracts[0].id }), null);
  assert.equal(pol(S, "a", "cancel", { id: P(S).contracts[0].id }), null);
  assert.equal(S.players.c.warband.treasury.materiel, 20);
  assert.equal(S.factions.hegemony.stock.materiel, m0 - 40 + 20);
});

test("hold and deliver contracts count turns and supply; an accepted one left undone at its deadline is a failure", () => {
  let S = start();
  P(S).warmaster = "a";
  S.factions.hegemony.stock.materiel = 200;
  const home = S.worlds[S.players.b.warband.at];
  assert.equal(pol(S, "a", "post", { contract: { kind: "hold", world: home.id, turns: 2, deadline: 6, reward: { materiel: 10 } } }), null);
  S = tick(S, 30); S = tick(S, 31);
  assert.ok(S.players.b.warband.treasury.materiel >= 10 || S.players.c.warband.treasury.materiel >= 10 || S.players.a.warband.treasury.materiel >= 10, "someone on it held it 2 turns");
  // an accepted deliver contract nobody fulfils
  home.depot = { supply: 0 };
  const far = Object.values(S.worlds).find(w => w.owner === "hegemony" && w.id !== home.id);
  far.depot = { supply: 0 };
  assert.equal(pol(S, "a", "post", { contract: { kind: "deliver", world: far.id, supply: 50, deadline: 2, reward: { materiel: 10 } , offer: "c" } }), null);
  pol(S, "c", "accept", { id: P(S).contracts[0].id });
  S = tick(S, 32); S = tick(S, 33);
  assert.equal(P(S).contracts.length, 0);
  assert.equal(S.players.c.warband.record.failed, 1);
  assert.ok(P(S).log.some(l => /Contract expired: .*Corvin failed it/.test(l.text)));
});

test("priority draws a double share of the stockpile, and a treasury pays where the share runs out", () => {
  let S = start();
  P(S).warmaster = "a";
  for (const id of ["b", "c"]) { at(S, S.players[id], S.factions.hegemony.capital); }
  S.players.a.warband.army = {};
  pol(S, "a", "priority", { warbands: ["b"] });
  S.factions.hegemony.stock = { manpower: 0, materiel: 0, supply: 100 };
  for (const id of ["b", "c"]) S = apply(S, { type: "order", player: id, move: null, recruit: [{ unit: "levy", count: 50 * SCALE }] });
  const n0 = { b: S.players.b.warband.army.levy, c: S.players.c.warband.army.levy };
  S = tick(S, 40);
  const got = { b: S.players.b.warband.army.levy - n0.b, c: S.players.c.warband.army.levy - n0.c };
  assert.ok(got.b >= 2 * got.c - 1 && got.b > 0, `double share: ${got.b} and ${got.c}`);
  // a treasury tops up
  S.factions.hegemony.stock = { manpower: 0, materiel: 0, supply: 100 };
  S.players.c.warband.treasury = { manpower: 30 * SCALE, materiel: 30 * SCALE, supply: 0 };
  S = apply(S, { type: "order", player: "c", move: null, recruit: [{ unit: "levy", count: 50 * SCALE }] });
  const c0 = S.players.c.warband.army.levy;
  S = tick(S, 41);
  assert.ok(S.players.c.warband.army.levy - c0 >= 50 || S.players.c.warband.treasury.materiel < 30, "spent its treasury");
});

test("politics events rebuild the same war from the log", () => {
  const { decide, politicsFor } = require("../sample-wars.js");
  const ev = [{ type: "create", seed: 3 }, { type: "join", player: "a", name: "A", faction: "brawl" }, { type: "join", player: "b", name: "B", faction: "brawl" }, { type: "join", player: "c", name: "C", faction: "hegemony" }];
  let S = rebuild(ev), x = 7;
  const R = () => (x = (x * 16807) % 2147483647) / 2147483647, push = e => { ev.push(e); S = apply(S, e); };
  let n = 0;
  for (let t = 0; t < 40; t++) {
    for (const p of Object.values(S.players)) {
      for (const e of politicsFor(S, p)) if (!politics(S, e)) { push(e); n++; }
      const o = decide(S, p, R); if (o) push({ type: "order", player: p.id, ...o });
    }
    push({ type: "tick", seed: 70 + t });
  }
  assert.ok(n > 0, "some politics happened");
  assert.deepEqual(rebuild(ev), S);
});
