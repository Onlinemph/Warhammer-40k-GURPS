// Veterans and leaders (game/world/veterans.js): who gets a name, what they bring, how they die, who takes command.
const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, rebuild } = require("../world/rules.js");
const { at, hold, quiet } = require("./helpers.js");
const VET = require("../world/veterans.js");

const start = () => { const S = rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }]); S.swarms = []; return S; };
// a fight next door the warband can't lose
function easyWin(S, seed) {
  const wb = S.players.h.warband, here = S.worlds[wb.at], to = S.worlds[here.links.find(l => S.worlds[l].owner !== "hegemony") || here.links[0]];
  hold(to, null, { militia: 4 }); to.tomb = false;
  S = apply(S, { type: "order", player: "h", move: to.id, recruit: [] });
  return apply(S, { type: "tick", seed });
}

test("a warband starts with its leader, and a won battle names up to two survivors", () => {
  let S = start();
  const wb0 = S.players.h.warband;
  assert.equal(wb0.leader.name, "Varro");
  assert.deepEqual(wb0.named, []);
  S.players.h.warband.army = { levy: 60, storm: 10 };
  S = easyWin(S, 1);
  const wb = S.players.h.warband;
  assert.ok(wb.named.length >= 1 && wb.named.length <= 2, `${wb.named.length} named`);
  for (const n of wb.named) { assert.ok(n.name && n.how && ["levy", "storm"].includes(n.unit)); assert.equal(n.battles, 1); }
  assert.ok(wb.history.some(h => wb.named.some(n => h.includes(n.name))));
  assert.equal(wb.leader.battles, 4); assert.equal(wb.leader.wins, 1);
});

test("named soldiers add to their side's worth, a tenth of a soldier a battle up to double, and the leader +10% to +20%", () => {
  const S = start(), wb = S.players.h.warband;
  wb.named = [{ name: "A", unit: "levy", battles: 6, scars: [] }, { name: "B", unit: "levy", battles: 6, scars: [] }, { name: "C", unit: "storm", battles: 20, scars: [] }];
  assert.deepEqual(VET.extraOf(S, [{ kind: "warband", player: "h" }]), { levy: 1, storm: 1 });
  assert.equal(VET.leaderBonus(wb), 1.1);
  wb.leader.wins = 25;
  assert.equal(VET.leaderBonus(wb), 1.2);
  assert.equal(VET.rankOf(6), "Hardened"); assert.equal(VET.rankOf(10), "Legend"); assert.equal(VET.rankOf(1), "Blooded");
});

test("when their unit is wiped out the named fall, each with a last letter home, and the report names them", () => {
  let S = start();
  const wb = S.players.h.warband, here = S.worlds[wb.at];
  wb.army = { levy: 3 };
  wb.named = [{ name: "Ansel Varga", unit: "levy", home: here.name, joined: 0, battles: 4, scars: ["lost an eye"], how: "held the line" }];
  // a hopeless fight with nowhere to fall back to: every world next door belongs to someone else
  const to = S.worlds[here.links[0]];
  hold(to, null, { militia: 300 }); to.tomb = false;
  for (const n of to.links) if (S.worlds[n].owner === "hegemony" && n !== here.id) S.worlds[n].owner = null;
  hold(S.worlds[here.id], "brawl");
  S = apply(S, { type: "order", player: "h", move: to.id, recruit: [] });
  S = apply(S, { type: "tick", seed: 2 });
  const m = S.players.h.warband.memorial.find(x => x.name === "Ansel Varga");
  assert.ok(m, "in the memorial");
  assert.equal(m.fell, to.name);
  assert.ok(m.letter && m.letter.includes("Ansel Varga") && m.letter.length > 40, m.letter);
  assert.ok(S.reports.some(r => /Fallen among the named: .*Ansel Varga/.test(r.text)));
});

test("a fallen leader's place goes to the most battle-hardened of the named, or to someone new", () => {
  const S = start(), p = S.players.h, w = S.worlds[p.warband.at];
  p.warband.army = { levy: 10 };
  p.warband.named = [{ name: "Young", unit: "levy", home: "x", battles: 1, scars: [], how: "" }, { name: "Old", unit: "levy", home: "x", battles: 7, scars: [], how: "" }];
  // dice that always roll 0.4: the named live (no losses), no scars (0.4 isn't under 0.3), the leader falls (0.4 is
  // under half the 0.9 lost)
  VET.afterBattle(S, w, { kind: "warband", player: "h" }, { levy: 10 }, { levy: 10 }, false, true, 0.9, () => 0.4);
  assert.ok(p.warband.memorial.some(m => m.name === "Varro" && m.leader), "the leader fell");
  assert.equal(p.warband.leader.name, "Old");
  assert.ok(!p.warband.named.some(n => n.name === "Old"));
});

test("named soldiers lost with their unit outside battle (hunger, desertion) go to the memorial too", () => {
  let S = start();
  const wb = S.players.h.warband;
  wb.army = { levy: 30, storm: 1 };
  wb.named = [{ name: "Storm One", unit: "storm", home: "x", battles: 2, scars: [], how: "" }];
  wb.army.storm = 0;
  S = apply(S, { type: "tick", seed: 3 });
  assert.ok(S.players.h.warband.memorial.some(m => m.name === "Storm One"));
  assert.equal(S.players.h.warband.named.length >= 0, true);
});

test("the replay fields the named as themselves, with their rank on their skills", () => {
  const { build } = require("../replay/build.js");
  const r = build({ id: "x", turn: 1, worldName: "Test", seed: 42, winner: "hegemony", secs: 30,
    sides: [{ faction: "hegemony", before: { levy: 6, storm: 1 }, named: [{ name: "Ansel Varga", unit: "levy", bonus: 3 }], players: ["V"] },
            { faction: "brawl", before: { brawler: 6 }, named: [], players: [] }] });
  assert.equal(r.roster.length, 13);
  assert.equal(r.roster.filter(x => x.name === "Ansel Varga").length, 1);
  assert.equal(r.roster.filter(x => x.name === "Levy").length, 5);
});

test("the war with its veterans still rebuilds the same from its log", () => {
  const ev = [{ type: "create", seed: 5 }, { type: "join", player: "h", name: "H", faction: "hegemony" }, { type: "join", player: "b", name: "B", faction: "brawl" }];
  const { decide } = require("../sample-wars.js");
  let S = rebuild(ev);
  let x = 1; const R = () => (x = (x * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 25; t++) {
    for (const p of Object.values(S.players)) { const o = decide(S, p, R); if (o) { const e = { type: "order", player: p.id, ...o }; ev.push(e); S = apply(S, e); } }
    const e = { type: "tick", seed: 900 + t }; ev.push(e); S = apply(S, e);
  }
  assert.deepEqual(rebuild(ev), S);
});
