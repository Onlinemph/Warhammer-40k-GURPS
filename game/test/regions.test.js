// Worlds to conquer (game/world/regions.js): every world a map of regions with cities and a capital, fought over
// region by region, changing hands only when its capital and most of its cities are held.
const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, rebuild, order, view } = require("../world/rules.js");
const RG = require("../world/regions.js");
const { TERRAIN } = require("../world/terrain.js");
const { at, hold, cap, quiet } = require("./helpers.js");

const start = () => quiet(rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }, { type: "join", player: "b", name: "Gutrip", faction: "brawl" }]));
const tick = (S, seed = 1) => apply(S, { type: "tick", seed });
const free = S => Object.values(S.worlds).find(w => !w.owner && w.links.includes(S.players.h.warband.at)) || Object.values(S.worlds).find(w => !w.owner);

test("every world: 8 to 20 regions, all joined, a third of them cities, one capital, every name its own", () => {
  const S = start(), again = start();
  for (const w of Object.values(S.worlds)) {
    const n = w.regions.length, cs = RG.cities(w);
    assert.ok(n >= 8 && n <= 20, `${w.name}: ${n}`);
    assert.ok(cs.length >= 3 && cs.length >= Math.round(n / 3) - 0, `${w.name}: ${cs.length} cities`);
    assert.equal(w.regions.filter(r => r.capital).length, 1);
    assert.ok(cap(w).city && TERRAIN[cap(w).terrain].town);
    for (const r of w.regions) { assert.ok(TERRAIN[r.terrain]); assert.equal(!!TERRAIN[r.terrain].town, r.city, `${r.name}: a city is a town`); for (const l of r.links) assert.ok(RG.region(w, l).links.includes(r.id), "links go both ways"); }
    const seen = new Set(["r0"]), q = ["r0"];
    while (q.length) for (const l of RG.region(w, q.shift()).links) if (!seen.has(l)) { seen.add(l); q.push(l); }
    assert.equal(seen.size, n, `${w.name}: every region reachable`);
    assert.equal(new Set(w.regions.map(r => r.name)).size, n);
    assert.deepEqual(again.worlds[w.id].regions, w.regions, "the same from the same seed");
    // its holder holds it all at the start, its garrison in the capital
    for (const r of w.regions) assert.equal(r.owner, w.owner);
  }
});

test("a world changes hands only with its capital and more than half its cities; until then it's contested", () => {
  let S = start();
  const w = hold(free(S), null, { militia: 2 }); w.tomb = false;
  const cs = RG.cities(w), others = cs.filter(r => !r.capital);
  // the capital alone: not enough
  at(S, S.players.h, w.id); S.players.h.warband.army = { levy: 40, storm: 6 };
  S = tick(S, 2);
  assert.equal(cap(S.worlds[w.id]).owner, "hegemony", "the capital taken");
  assert.equal(S.worlds[w.id].owner, null, "the world not yet");
  assert.ok(RG.contested(S.worlds[w.id]));
  assert.ok(view(S, "h").worlds.find(x => x.id === w.id).split.hegemony > 0, "the map shows it split");
  // and enough of the rest
  for (const r of others.slice(0, Math.floor(cs.length / 2))) RG.region(S.worlds[w.id], r.id).owner = "hegemony";
  S = tick(S, 3);
  assert.equal(S.worlds[w.id].owner, "hegemony");
  assert.ok(S.log.some(l => l.text === `The Hegemony take ${w.name}`));
});

test("marching: one region a turn along the world's own links, and only from the region it's in", () => {
  let S = start();
  const wb = S.players.h.warband, w = S.worlds[wb.at], here = RG.region(w, wb.region);
  const far = w.regions.find(r => r !== here && !here.links.includes(r.id));
  assert.match(order(S, { player: "h", region: far.id }), /is not next to/);
  assert.match(order(S, { player: "h", region: here.links[0], move: w.links[0] }), /not both/);
  assert.equal(order(S, { player: "h", region: here.links[0] }), null);
  S = apply(S, { type: "order", player: "h", region: here.links[0], recruit: [] });
  S = tick(S, 4);
  assert.equal(S.players.h.warband.region, here.links[0]);
  assert.ok(S.players.h.warband.history.some(x => /marched from .* to /.test(x)));
  // recruits come from a city it holds, not the fields
  if (!RG.region(w, here.links[0]).city) assert.match(order(S, { player: "h", recruit: [{ unit: "levy", count: 1 }] }), /cities you hold/);
});

test("landing: where the order says, and never in or beside a fortress capital its foes hold", () => {
  let S = start();
  const w = free(S); w.tomb = false; hold(w, "brawl", { brawler: 10 });
  const c = cap(w); c.terrain = "fortress";
  const beside = c.links[0], away = w.regions.find(r => r !== c && !c.links.includes(r.id));
  assert.equal(RG.canLand(w, "hegemony", c.id), false);
  assert.equal(RG.canLand(w, "hegemony", beside), false);
  assert.equal(RG.canLand(w, "brawl", beside), true, "its holder's own may");
  assert.match(order(S, { player: "h", move: w.id, land: beside }) || "", w.links.includes(S.players.h.warband.at) ? /denies the sky/ : /not one jump/);
  at(S, S.players.h, w.links[0], cap(S.worlds[w.links[0]]).id);
  assert.equal(order(S, { player: "h", move: w.id, land: away.id }), null);
  S = apply(S, { type: "order", player: "h", move: w.id, land: away.id, recruit: [] });
  S = tick(S, 5);
  assert.equal(S.players.h.warband.at, w.id);
  assert.equal(S.players.h.warband.region, away.id);
});

test("a city attacked: the holder's garrisons elsewhere on the world march half their strength to its defence", () => {
  let S = start();
  const w = hold(free(S), null, { militia: 4 }); w.tomb = false;
  const other = RG.cities(w).find(r => !r.capital); other.garrison = { militia: 20 };
  at(S, S.players.h, w.id); S.players.h.warband.army = { levy: 30 };
  S = tick(S, 6);
  const rep = S.reports.find(r => r.world === w.id && r.region === cap(w).id);
  assert.ok(rep, "a battle at the capital");
  const rallied = +((S.log.find(l => /rallies \d+ of its people/.test(l.text)) || { text: "rallies 0" }).text.match(/rallies (\d+)/)[1]);
  assert.equal(rep.sides.find(s => s.faction === "militia").before.militia, 14 + rallied, "4 there, 10 come from the other city, and its people rallied");
  assert.ok(S.log.some(l => /10 of the local defence march to the defence of/.test(l.text)));
});
