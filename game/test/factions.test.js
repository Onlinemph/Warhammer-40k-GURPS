// Each faction's own rules (game/world/factions.js, docs/setting.md): one test a mechanic, on a war set up so the
// mechanic is the thing that decides.
const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, rebuild, order, total } = require("../world/rules.js");

const start = () => rebuild([{ type: "create", seed: 7 },
  { type: "join", player: "h", name: "Varro", faction: "hegemony" },
  { type: "join", player: "a", name: "Ashen", faction: "apostates" },
  { type: "join", player: "b", name: "Gutrip", faction: "brawl" }]);
const tick = (S, seed = 1) => apply(S, { type: "tick", seed });
// a quiet war: no AI forces anywhere, nobody else on the map
const quiet = S => { S.swarms = []; for (const w of Object.values(S.worlds)) if (w.owner === "chorus" || w.owner === "dormant") w.garrison = {}; return S; };
const W = S => Object.values(S.worlds);

test("Hegemony loyalty: steady in supply beside an Apostate world, worn down by an Apostate warband, and the disloyal go over", () => {
  let S = quiet(start());
  const w = W(S).find(x => x.owner === "hegemony" && !x.capital && x.links.some(n => S.worlds[n].owner === "apostates"))
    || (() => { const x = W(S).find(y => y.owner === "hegemony" && !y.capital); const n = S.worlds[x.links.find(l => !S.worlds[l].capital)]; Object.assign(n, { owner: "apostates", garrison: {} }); return x; })();
  for (const p of Object.values(S.players)) p.warband.at = S.factions[p.faction].capital;
  const l0 = w.loyalty;
  S = tick(S, 1);
  assert.ok(S.worlds[w.id].loyalty >= l0 - 5, "beside an Apostate world alone it holds about steady");
  // an Apostate warband next door, sitting there: -10 a turn against +5
  const next = w.links.find(n => S.worlds[n].owner === "apostates");
  S.players.a.warband.at = next;
  S.worlds[w.id].loyalty = 35;
  S = tick(S, 2); S = tick(S, 3);
  assert.ok(S.worlds[w.id].owner === "apostates", `went over at loyalty ${S.worlds[w.id].loyalty}`);
  assert.ok(S.log.some(l => /goes over to the Apostates, its loyalty spent/.test(l.text)));
});

test("Hegemony edicts open every 10 turns, and taking the named world fulfils one", () => {
  let S = quiet(start());
  for (let t = 1; t <= 10; t++) { S = quiet(tick(S, t)); }
  const e = S.factions.hegemony.edict;
  assert.ok(e && e.until === 20, "an edict opened on turn 10 for 10 turns");
  assert.ok(S.log.some(l => /A sealed edict opens/.test(l.text)));
  // whatever the dice chose, make it "take" a world, then take it
  const tgt = W(S).find(w => w.owner !== "hegemony" && w.links.some(n => S.worlds[n].owner === "hegemony"));
  Object.assign(e, { kind: "take", world: tgt.id, text: `take ${tgt.name}` });
  const mat = S.factions.hegemony.stock.materiel, loy = W(S).filter(w => w.owner === "hegemony").map(w => w.loyalty);
  Object.assign(S.worlds[tgt.id], { owner: "hegemony", garrison: {}, tomb: false });
  S = tick(S, 11);
  assert.equal(S.factions.hegemony.edict, null);
  assert.ok(S.factions.hegemony.stock.materiel >= mat + 60);
  assert.ok(S.log.some(l => /edict is fulfilled/.test(l.text)));
  assert.ok(W(S).filter(w => w.owner === "hegemony" && w.id !== tgt.id).every((w, i) => w.loyalty >= Math.min(100, (loy[i] ?? 0))), "loyalty up");
});

test("Wardens are grown only on worlds held 10 turns, or the capital", () => {
  const S = start(), p = S.players.h, cap = S.worlds[p.warband.at];
  assert.equal(order(S, { player: "h", recruit: [{ unit: "warden", count: 1 }] }), null, "at the capital");
  const other = W(S).find(w => w.owner === "hegemony" && !w.capital);
  p.warband.at = other.id; other.heldSince = 5; S.turn = 8;
  assert.match(order(S, { player: "h", recruit: [{ unit: "warden", count: 1 }] }), /held 10 turns/);
  S.turn = 15;
  assert.equal(order(S, { player: "h", recruit: [{ unit: "warden", count: 1 }] }), null);
  assert.ok(cap.capital);
});

test("Apostate captives, a Summoning that gives Vessels, and one broken by a fight", () => {
  let S = quiet(start());
  const a = S.players.a, home = S.worlds[a.warband.at];
  // a battle the Apostates can't lose, against local defence next door
  const tgt = S.worlds[home.links.find(n => !S.worlds[n].owner) || home.links[0]];
  Object.assign(tgt, { owner: null, garrison: { militia: 20 } });
  a.warband.at = tgt.id; a.warband.army = { fallen: 6 };
  S = tick(S, 4);
  assert.ok(S.factions.apostates.stock.captives > 0, "captives taken");
  // a Summoning: 15 captives, three turns, two Vessels
  S = quiet(S);
  a.warband.at = home.id; S.factions.apostates.stock.captives = 20;
  const v0 = S.players.a.warband.army.vessel || 0;
  S = apply(S, { type: "order", player: "a", move: null, recruit: [], ritual: { kind: "summon" } });
  S = tick(S, 5);
  assert.equal(S.factions.apostates.stock.captives, 5);
  assert.ok(S.players.a.warband.ritual, "under way");
  assert.match(order(S, { player: "a", move: home.links[0] }), /holds the warband/);
  S = quiet(tick(S, 6)); S = quiet(tick(S, 7)); S = tick(S, 8);
  assert.equal(S.players.a.warband.army.vessel, v0 + 2);
  assert.ok(S.log.some(l => /answers Ashen's Summoning/.test(l.text)));
  // another, broken by an enemy warband arriving
  S.factions.apostates.stock.captives = 15;
  S = apply(S, { type: "order", player: "a", move: null, recruit: [], ritual: { kind: "summon" } });
  S = tick(S, 9);
  S.players.b.warband.at = S.players.a.warband.at; S.players.b.warband.army = { brawler: 5 };
  S = tick(S, 10);
  assert.equal(S.players.a.warband.ritual, null);
  assert.ok(S.log.some(l => /Summoning on .* is broken/.test(l.text)));
});

test("Apostate Corruption takes a disloyal Hegemony world next door", () => {
  let S = quiet(start());
  const a = S.players.a, home = S.worlds[a.warband.at];
  let t = W(S).find(w => w.owner === "hegemony" && !w.capital && w.links.includes(home.id));
  if (!t) { t = S.worlds[home.links.find(n => !S.worlds[n].capital)]; Object.assign(t, { owner: "hegemony", garrison: { levy: 6 }, loyalty: 40 }); }
  t.loyalty = 40; t.garrison = { levy: 6 };
  S.factions.apostates.stock.captives = 10;
  assert.match(order(S, { player: "a", ritual: { kind: "corrupt", target: home.links.find(n => S.worlds[n].owner !== "hegemony") || "x" } }), /Hegemony world next door|no such|too loyal/);
  S = apply(S, { type: "order", player: "a", move: null, recruit: [], ritual: { kind: "corrupt", target: t.id } });
  for (let k = 0; k < 3; k++) { S = quiet(tick(S, 20 + k)); S.worlds[t.id].loyalty = Math.min(S.worlds[t.id].loyalty, 40); for (const p of Object.values(S.players)) if (p.id !== "a") p.warband.at = S.factions[p.faction].capital; }
  assert.equal(S.worlds[t.id].owner, "apostates");
  assert.ok(S.worlds[t.id].garrison.turncoat >= 6, "its Levies turned their coats");
});

test("a Hegemony warband out of supply for three turns loses Levies to the Apostates as Turncoats", () => {
  let S = quiet(start());
  const h = S.players.h, apo = W(S).find(w => w.owner === "apostates");
  const far = W(S).find(w => !w.owner && !w.links.some(n => S.worlds[n].owner === "hegemony") && w.links.length);
  Object.assign(far, { garrison: {} }); for (const n of far.links) if (!S.worlds[n].owner) S.worlds[n].garrison = {};
  h.warband.at = far.id; h.warband.army = { levy: 50 };
  const t0 = apo.garrison.turncoat || 0;
  for (let k = 0; k < 5; k++) S = quiet(tick(S, 30 + k));
  assert.ok(S.players.h.warband.history.some(x => /deserted to the Apostates/.test(x)));
  assert.ok(W(S).filter(w => w.owner === "apostates").reduce((n, w) => n + (w.garrison.turncoat || 0), 0) > t0);
});

test("Brawl fame: won in battle, doubled against the odds, grows Bosses, and peace makes them fight each other", () => {
  let S = quiet(start());
  const b = S.players.b, home = S.worlds[b.warband.at];
  const tgt = S.worlds[home.links.find(n => !S.worlds[n].owner) || home.links[0]];
  Object.assign(tgt, { owner: null, garrison: { militia: 10 } });
  b.warband.at = tgt.id; b.warband.army = { brawler: 60, ironhide: 4 };
  S = tick(S, 40);
  assert.ok(S.factions.brawl.stock.fame > 0, "fame won");
  assert.ok(S.players.b.warband.history.some(x => /grew into Boss/.test(x)), "Brawlers grew");
  // four quiet turns and they start on each other
  S = quiet(S); S.players.b.warband.at = S.factions.brawl.capital; S.players.b.warband.army = { brawler: 100 };
  for (let k = 0; k < 5; k++) { S = quiet(tick(S, 41 + k)); for (const p of Object.values(S.players)) if (p.id !== "b") p.warband.at = S.factions[p.faction].capital; }
  assert.ok(S.players.b.warband.history.some(x => /fought itself/.test(x)));
  // and the capital raises free Brawlers from fame
  S.factions.brawl.stock.fame = 100; S.worlds[S.factions.brawl.capital].garrison = {};
  S = tick(S, 50);
  assert.ok((S.worlds[S.factions.brawl.capital].garrison.brawler || 0) >= 20);
});

test("the Chorus eats the dead of a field it holds, and a heap of dead beside it rises", () => {
  let S = start();
  const cw = W(S).find(w => w.owner === "chorus"), n = S.worlds[cw.links.find(l => S.worlds[l].owner !== "chorus")];
  // a big swarm on a world held by a few Levies: the Chorus wins and feeds
  S.swarms = [{ id: "x", faction: "chorus", at: n.id, army: { stalker: 10, leaper: 40 } }];
  Object.assign(n, { owner: n.owner === "dormant" ? null : n.owner, tomb: false, garrison: { militia: 60 } });
  const b0 = S.factions.chorus.stock.biomass;
  S = tick(S, 60);
  const rep = S.reports.find(r => r.world === n.id);
  assert.ok(rep && rep.winner === "chorus");
  assert.ok(S.factions.chorus.stock.biomass > b0, "biomass from the dead");
  // a world beside the Chorus where 60 or more died, held by fewer than 20: it rises three turns later
  S = start();
  const c2 = W(S).find(w => w.owner === "chorus"), m = S.worlds[c2.links.find(l => !S.worlds[l].owner || S.worlds[l].owner === "brawl" || S.worlds[l].owner === "hegemony") || c2.links[0]];
  Object.assign(m, { owner: null, tomb: false, garrison: { militia: 80 } });
  S.players.b.warband.at = m.id; S.players.b.warband.army = { brawler: 200, ironhide: 10 };
  S = tick(S, 61);
  assert.ok(S.reports.some(r => r.world === m.id), "a battle there");
  for (const p of Object.values(S.players)) p.warband.at = S.factions[p.faction].capital;
  S.worlds[m.id].garrison = {}; S.swarms = [];
  // (the Chorus kept from simply swarming it meanwhile)
  for (let k = 0; k < 3; k++) { S = quiet(tick(quiet(S), 62 + k)); for (const p of Object.values(S.players)) p.warband.at = S.factions[p.faction].capital; }
  assert.equal(S.worlds[m.id].owner, "chorus");
  assert.ok(S.log.some(l => /dead of .* rise/.test(l.text)));
});

test("gates: from one gate to another the faction holds, not to anyone else's", () => {
  const S = start(), gates = W(S).filter(w => w.gate);
  assert.equal(gates.length, 3);
  const [g1, g2, g3] = gates, h = S.players.h;
  h.warband.at = g1.id; g1.owner = "hegemony";
  assert.match(order(S, { player: "h", move: g2.id }) || "", g1.links.includes(g2.id) ? /^$/ : /not one jump/);
  g2.owner = "hegemony";
  assert.equal(order(S, { player: "h", move: g2.id }), null);
  let S2 = apply(S, { type: "order", player: "h", move: g2.id, recruit: [] });
  for (const w of [g2]) w.garrison = {};
  S2.swarms = [];
  S2 = tick(S2, 70);
  assert.ok(S2.players.h.warband.at === g2.id || S2.players.h.warband.history.some(x => /beaten/.test(x)), "jumped through the gate");
  assert.ok(g3);
});

test("the faction rules keep the war rebuildable from its log", () => {
  const ev = [{ type: "create", seed: 3 }, { type: "join", player: "a", name: "A", faction: "apostates" }, { type: "join", player: "b", name: "B", faction: "brawl" }, { type: "join", player: "h", name: "H", faction: "hegemony" }];
  let S = rebuild(ev);
  for (let t = 0; t < 30; t++) {
    const e1 = { type: "order", player: "a", move: null, recruit: [], ritual: S.factions.apostates.stock.captives >= 15 && !S.players.a.warband.ritual ? { kind: "summon" } : null };
    ev.push(e1); S = apply(S, e1);
    const e = { type: "tick", seed: 500 + t }; ev.push(e); S = apply(S, e);
  }
  assert.deepEqual(rebuild(ev), S);
  assert.ok(total(S.players.b.warband.army) >= 0);
});
