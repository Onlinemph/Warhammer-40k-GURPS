// The highlight feed (game/world/highlights.js): scoring a battle and saying why, the top of the turn, upvotes and
// how they move the weights.
const test = require("node:test");
const assert = require("node:assert/strict");
const { apply, rebuild, view, upvote } = require("../world/rules.js");
const HL = require("../world/highlights.js");

const report = (id, o) => ({ id, turn: 1, world: "w1", worldName: "Testworld", odds: 50, winner: "hegemony", losses: [0.2, 0.9], fallen: [], leaders: [],
  sides: [{ faction: "hegemony", before: { levy: 20 }, named: [], players: ["Varro"] }, { faction: "brawl", before: { brawler: 20 }, named: [], players: [] }], text: "x", ...o });
const bare = () => { const S = rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }]); S.turn = 1; S.reports = []; return S; };

test("a battle's score says why: an upset, the named who fell, a capital, a world taken", () => {
  const S = bare(), cap = Object.values(S.worlds).find(w => w.capital);
  S.reports.push(report("a", { odds: 15 }), report("b", { world: cap.id, worldName: cap.name, fallen: ["Ansel Varga"], leaders: ["Varro"] }), report("c", { odds: 55, losses: [0.6, 0.7] }));
  HL.score(S, { captured: { [cap.id]: ["h"] } });
  const [a, b, c] = S.reports;
  assert.match(a.hl.why.join(), /an upset: 15% odds/);
  assert.ok(Math.abs(a.hl.parts.upset - (40 * 20 / 35 + 10)) < 1e-9, "40 x (35 - 15) / 35, + 10");
  assert.match(b.hl.why.join(), /Ansel Varga fell/); assert.match(b.hl.why.join(), /the leader Varro fell/);
  assert.match(b.hl.why.join(), /changed hands/); assert.match(b.hl.why.join(), /a capital/);
  assert.match(c.hl.why.join(), /close, bloody fight/);
  assert.ok(HL.total(S, b) > HL.total(S, c), "a capital taken and a leader dead beats a close fight");
});

test("the feed shows the turn's top ten the faction knows of, the player's own marked", () => {
  const S = bare();
  for (let i = 0; i < 14; i++) S.reports.push(report("r" + i, { odds: 50 + i, winner: "hegemony" }));
  HL.score(S, { captured: {} });
  const v = view(S, "h").highlights;
  assert.equal(v.list.length, 10);
  assert.ok(v.list.every(h => h.mine));
  assert.ok(v.list[0].score >= v.list[9].score);
});

test("an upvote: once a player a battle, only on battles you know of; votes move the weights by at most a tenth", () => {
  let S = rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }, { type: "join", player: "b", name: "Gut", faction: "brawl" }]);
  S.turn = 1;
  S.reports = [report("up", { odds: 10 })];
  HL.score(S, { captured: {} });
  assert.equal(upvote(S, { type: "upvote", player: "h", report: "up" }), null);
  S = apply(S, { type: "upvote", player: "h", report: "up" });
  assert.match(upvote(S, { type: "upvote", player: "h", report: "up" }), /already/);
  assert.match(upvote(S, { type: "upvote", player: "h", report: "nope" }), /no such battle/);
  const w0 = { ...S.highlights.weights };
  S = apply(S, { type: "tick", seed: 1 });
  const w1 = S.highlights.weights;
  assert.ok(w1.upset > w0.upset && w1.upset <= w0.upset * 1.1 + 1e-9, `upset ${w0.upset} -> ${w1.upset}`);
  assert.ok(w1.close < w0.close, "reasons not in the marked battle lose a little");
  // a quiet turn after: the feed still shows the last turn that had battles
  assert.ok(view(S, "h").highlights.list.some(h => h.id === "up" && h.voted && h.votes === 1));
});
