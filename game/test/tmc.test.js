// Tactical Mass Combat (game/world/tmc.js): the article's tables, the expanded results built from them, and battles
// that follow their rules.
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../world/tmc.js");
const { rebuild, apply } = require("../world/rules.js");

const side = (faction, army, more = {}) => ({ faction, army, leader: 11, ...more });

test("the tables as the article gives them (Pyramid 3/44 pp. 27-28), spot by spot", () => {
  const F = (col, r) => T.fireAsWritten(T.FNAMES.indexOf(col), r), C = (col, r) => T.closeAsWritten(T.CNAMES.indexOf(col), r);
  // Fire Combat Results Table: a few rows read off the page
  assert.deepEqual(["1:10", "1:5", "1:3", "1:2", "1:1", "2:1"].map(c => F(c, 12)), ["P", "P", "DE", "DE", "DO", "DO"]);
  assert.deepEqual(["3:1", "4:1", "5:1", "10:1", "20:1+"].map(c => F(c, 6)), ["P", "P", "DE", "DE", "DO"]);
  assert.equal(F("20:1+", 2), "P"); assert.equal(F("10:1", 2), "NE");
  // Close Combat Table
  assert.deepEqual(T.CNAMES.map(c => C(c, 2)), ["AE", "AE", "AE", "AE", "AE", "AE", "AE", "AR", "AR", "AR", "NE", "DR"]);
  assert.deepEqual(T.CNAMES.map(c => C(c, 12)), ["NE", "DR", "DR", "DR", "DE", "DE", "DE", "DE", "DE", "DE", "DE", "DE"]);
  assert.deepEqual(T.CNAMES.map(c => C(c, 8)), ["AE", "AR", "AR", "AR", "NE", "DR", "DR", "DR", "DE", "DE", "DE", "DE"]);
  // columns round in the defender's favour; fire below 1:10 has none
  assert.equal(T.column(7, T.FCOLS), T.FNAMES.indexOf("5:1"));
  assert.equal(T.column(0.09, T.FCOLS), -1);
  assert.equal(T.column(0.01, T.CCOLS), -1);
});

test("the expanded results keep each table's shape and split its results", () => {
  for (let i = 0; i < T.FNAMES.length; i++) for (let r = 2; r <= 12; r++) {
    const o = T.fireAsWritten(i, r), n = T.fireResult(i, r);
    // every cell is the article's result or one of its splits
    const ok = { NE: ["NE", "S"], P: ["P", "PC"], DE: ["DE", "SL"], DO: ["DO"] }[o];
    assert.ok(ok.includes(n), `${T.FNAMES[i]} ${r}: ${o} -> ${n}`);
  }
  assert.equal(T.fireResult(T.FNAMES.indexOf("1:1"), 7), "S");    // the roll below the first P
  assert.equal(T.fireResult(T.FNAMES.indexOf("1:1"), 9), "PC");   // the second P
  assert.equal(T.fireResult(T.FNAMES.indexOf("1:1"), 10), "SL");  // the first DE
  for (let j = 0; j < T.CNAMES.length; j++) for (let r = 2; r <= 12; r++) {
    const o = T.closeAsWritten(j, r), n = T.closeResult(j, r);
    const ok = { AE: ["AE"], AR: ["AR", "AD"], NE: ["EN", "EX"], DR: ["DR", "DD"], DE: ["DE", "DS"] }[o];
    assert.ok(ok.includes(n), `${T.CNAMES[j]} ${r}: ${o} -> ${n}`);
  }
  assert.equal(T.closeResult(T.CNAMES.indexOf("1:1"), 7), "EX");   // NE in an even fight is a bloody exchange
  assert.equal(T.closeResult(T.CNAMES.indexOf("5:1"), 3), "EN");   // elsewhere, engaged
  assert.equal(T.closeResult(T.CNAMES.indexOf("10:1"), 12), "DS"); // a surrender
});

test("a battle is the same every time from the same seed, and its losses add up", () => {
  const opt = { ground: "farmland", seed: 42, sides: [side("hegemony", { levy: 40, storm: 4 }), side("brawl", { brawler: 40, boss: 5 })], attacker: 0 };
  const a = T.fight(opt), b = T.fight(opt);
  assert.deepEqual(a, b);
  assert.ok(a.rounds >= 1 && a.rounds <= 16);
  for (const s of [0, 1]) for (const [u, n] of Object.entries(a.lost[s])) assert.ok(n >= 0 && n <= opt.sides[s].army[u], `${u}: ${n}`);
  assert.ok(["rout", "repulse", "stalemate", "pyrrhic"].includes(a.kind));
  // the log has the map, the setup and the fighting
  const L = T.fight({ ...opt, log: true }).log;
  assert.equal(L[0].t, "map");
  assert.ok(L.some(e => e.t === "fire" || e.t === "melee"));
});

test("the odds follow the numbers, armour counts through PR, and many Levies can bring down Wardens", () => {
  const odds = (a, b, g = "plains") => T.predict({ ground: g, seed: 7, sides: [side("hegemony", a), side("hegemony", b)], attacker: 0 }, 16).pWinA;
  assert.ok(odds({ levy: 60 }, { levy: 20 }) > odds({ levy: 20 }, { levy: 60 }));
  // ten Wardens against ten Levies: the Wardens; against a hundred, the Levies have a chance (combined fire)
  assert.ok(odds({ warden: 10 }, { levy: 10 }) > 0.9);
  assert.ok(odds({ levy: 100 }, { warden: 10 }) > 0.2);
});

test("the factions' own: the Dormant rise again; a fortified holder has earthworks", () => {
  let rose = 0;
  for (let k = 0; k < 30 && !rose; k++) rose += T.fight({ ground: "desert", seed: 100 + k, sides: [side("dormant", { husk: 20, keeper: 5 }), side("hegemony", { levy: 60, storm: 10 })], attacker: 1 }).reanimated;
  assert.ok(rose > 0, "a Dormant element reanimated");
  const dug = T.fight({ ground: "plains", seed: 3, log: true, hold: 1, attacker: 0, sides: [side("brawl", { brawler: 30 }), side("hegemony", { levy: 40 }, { earthworks: true })] }).log[0];
  assert.ok(dug.works.length >= 1, "earthworks dug");
});

test("in the war: every battle keeps what it takes to fight it again, and fought again it ends the same", () => {
  let S = rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }]);
  for (let t = 1; t <= 10; t++) S = apply(S, { type: "tick", seed: t });
  const reps = S.reports.filter(r => r.tmc);
  assert.ok(reps.length > 0, "battles were fought");
  for (const r of reps.slice(0, 5)) {
    const b = T.fight(r.tmc);
    assert.equal(b.rounds, r.rounds);
    const w = b.winner == null ? null : r.sides[b.winner].faction;
    assert.equal(w, r.winner);
  }
});
