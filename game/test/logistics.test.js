// Supply and logistics (game/world/logistics.js): eating, being short, depots, convoys and raids on them, blockades.
const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, rebuild, order } = require("../world/rules.js");
const LOG = require("../world/logistics.js");

const start = (extra = []) => { const S = rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }, ...extra]); S.swarms = []; return S; };
const tick = (S, seed = 1) => apply(S, { type: "tick", seed });
const quiet = S => { S.swarms = []; for (const w of Object.values(S.worlds)) if (w.owner === "chorus" || w.owner === "dormant") w.garrison = {}; return S; };
const own = S => Object.values(S.worlds).filter(w => w.owner === "hegemony");

test("warbands eat a supply a turn per ten soldiers; with none to eat they're short and fight at x0.8", () => {
  let S = quiet(start());
  const wb = S.players.h.warband;
  wb.army = { levy: 95 };
  const s0 = S.factions.hegemony.stock.supply;
  S = quiet(tick(S, 1));
  assert.equal(S.players.h.warband.eats, 10);
  assert.equal(S.players.h.warband.short, false);
  assert.ok(S.factions.hegemony.stock.supply < s0 + 30, "income in, ten eaten");
  // nothing in the stockpile and no income: short
  for (const w of own(S)) w.type = "death";
  S.factions.hegemony.stock.supply = 0;
  for (const w of Object.values(S.worlds)) if (w.owner === "hegemony") w.owner = w.capital ? "hegemony" : null;
  S.worlds[S.factions.hegemony.capital].type = "death";
  S.players.h.warband.army = { levy: 200 };
  S = quiet(tick(S, 2));
  assert.equal(S.players.h.warband.short, true);
  assert.ok(S.players.h.warband.history.some(h => /short of supply/.test(h)));
  assert.equal(LOG.sideFactor(S, [{ kind: "warband", player: "h" }]), 0.8);
});

test("a depot (30 materiel) feeds a warband beside it, even far from home, and keeps it in supply", () => {
  let S = quiet(start());
  const wb = S.players.h.warband, here = S.worlds[wb.at];
  S.factions.hegemony.stock.materiel = 100;
  S = apply(S, { type: "order", player: "h", move: null, recruit: [], build: "depot" });
  S = quiet(tick(S, 3));
  assert.ok(S.worlds[here.id].depot, "built");
  assert.match(order(S, { player: "h", build: "depot" }), /has a depot already/);
  // a depot cut off from the capital, full, with the warband beside it
  const far = Object.values(S.worlds).find(w => !w.owner && w.links.length >= 1 && !w.links.some(n => S.worlds[n].owner === "hegemony"));
  Object.assign(far, { owner: "hegemony", garrison: {}, depot: { supply: 50 } });
  const next = S.worlds[far.links[0]]; Object.assign(next, { owner: null, tomb: false, garrison: {} });
  S.players.h.warband.at = next.id; S.players.h.warband.army = { levy: 40 };
  S = quiet(tick(S, 4));
  assert.equal(S.players.h.warband.depotFed, true);
  assert.equal(S.players.h.warband.supplied, true);
  assert.equal(S.worlds[far.id].depot.supply, 46);
});

test("a convoy goes a jump a turn through your own worlds and fills the depot; a raider beside its way takes half", () => {
  let S = quiet(start([{ type: "join", player: "b", name: "Gutrip", faction: "brawl" }]));
  const cap = S.worlds[S.factions.hegemony.capital];
  // a chain of three Hegemony worlds from the capital: cap - a - b, the depot at b
  const a = S.worlds[cap.links[0]], b = S.worlds[a.links.find(l => l !== cap.id)];
  for (const w of [a, b]) Object.assign(w, { owner: "hegemony", garrison: {}, tomb: false });
  b.depot = { supply: 0 };
  S.factions.hegemony.stock.supply = 50;
  S.players.h.warband.at = cap.id; S.players.b.warband.at = S.factions.brawl.capital;
  assert.equal(order(S, { player: "h", convoy: { to: b.id, supply: 25 } }), null);
  S = apply(S, { type: "order", player: "h", move: null, recruit: [], convoy: { to: b.id, supply: 25 } });
  S = quiet(tick(S, 5));
  assert.equal(S.convoys.length, 1);
  assert.ok(S.log.some(l => /convoy sets out/.test(l.text)));
  for (let k = 0; k < 3 && S.convoys.length; k++) S = quiet(tick(S, 6 + k));
  assert.equal(S.convoys.length, 0);
  assert.ok(S.worlds[b.id].depot.supply >= 25 - 8, `depot ${S.worlds[b.id].depot.supply}`);   // less what warbands ate from it
  // a second convoy, and a Brawl raider waiting beside its way
  S.factions.hegemony.stock.supply = 50;
  S = apply(S, { type: "order", player: "h", move: null, recruit: [], convoy: { to: b.id, supply: 20 } });
  const beside = b.links.find(l => l !== a.id && l !== cap.id);   // next to the convoy's last stop
  Object.assign(S.worlds[beside], { owner: null, tomb: false, garrison: {} });
  S.players.b.warband.at = beside; S.players.b.warband.stance = "raid"; S.players.b.warband.army = { brawler: 30 };
  const bs = S.factions.brawl.stock.supply;
  S = quiet(tick(S, 10));
  for (let k = 0; k < 2 && S.convoys.length; k++) { S.players.b.warband.at = beside; S = quiet(tick(S, 11 + k)); }
  assert.ok(S.log.some(l => /takes a convoy/.test(l.text)), "raided");
  assert.ok(S.factions.brawl.stock.supply >= bs + 10 - 5);
});

test("a blockaded world earns nothing and its garrison starves, unless a depot feeds it", () => {
  let S = quiet(start());
  const w = Object.values(S.worlds).find(x => !x.owner && x.links.length >= 1 && !x.links.some(n => S.worlds[n].owner === "hegemony"));
  Object.assign(w, { owner: "hegemony", garrison: { levy: 30 }, tomb: false });
  const n = S.worlds[w.links[0]]; Object.assign(n, { owner: null, tomb: false, garrison: { militia: 5 } });
  S = quiet(tick(S, 20));
  assert.equal(S.worlds[w.id].blockaded, true);
  assert.ok(S.worlds[w.id].garrison.levy < 30 + 2, "starving");
  assert.ok(S.log.some(l => l.text === `${w.name} is blockaded`));
  // with a depot it holds
  S.worlds[w.id].depot = { supply: 40 }; S.worlds[w.id].garrison = { levy: 30 };
  S.worlds[n.id].garrison = { militia: 5 };
  S = quiet(tick(S, 21));
  assert.ok(S.worlds[w.id].garrison.levy >= 30);
  assert.ok(S.worlds[w.id].depot.supply < 40);
});

test("a side short of supply is marked in its battle report, for the replay's magazines", () => {
  let S = quiet(start());
  const wb = S.players.h.warband, here = S.worlds[wb.at], to = S.worlds[here.links.find(l => S.worlds[l].owner !== "hegemony") || here.links[0]];
  Object.assign(to, { owner: null, tomb: false, garrison: { militia: 5 } });
  wb.army = { levy: 40 }; wb.short = true;
  S = apply(S, { type: "order", player: "h", move: to.id, recruit: [] });
  S = tick(S, 30);
  const rep = S.reports.find(r => r.world === to.id);
  assert.ok(rep);
  assert.equal(rep.sides.find(s => s.faction === "hegemony").short, true);
});
