// Battles that can go either way (game/world/battle.js): the leaders' contest, how a battle ends, a world rallying,
// and the fog.
const test = require("node:test");
const assert = require("node:assert/strict");
const BT = require("../world/battle.js");
const { rebuild, apply, view } = require("../world/rules.js");

const seq = xs => { let i = 0; return () => xs[i++ % xs.length]; };   // dice that fall as told
const side = (faction, army, parts = []) => ({ faction, army, parts });

test("the leaders' contest: the margin buys one advantage per 2 points, a night attack only for the side that fights hand to hand", () => {
  const S = { players: {}, politics: {} };
  // both at 10; dice: A rolls 3 (margin 7), B rolls 18 (margin -8): a 15-point win for A, so all four... but night only if A is the melee side
  let c = BT.contest(S, side("hegemony", { levy: 10 }), side("brawl", { brawler: 10 }), seq([0, 0, 0, 0.99, 0.99, 0.99]));
  assert.equal(c.winner, 0);
  assert.deepEqual(c.adv.map(a => a.id), ["ambush", "ground", "volley"], "no night attack for the Levies against Brawlers");
  assert.ok(Math.abs(c.factor[0] - 1.25 * 1.15 * 1.1) < 1e-9 && c.factor[1] === 1);
  c = BT.contest(S, side("brawl", { brawler: 10 }), side("hegemony", { levy: 10 }), seq([0, 0, 0, 0.99, 0.99, 0.99]));
  assert.deepEqual(c.adv.map(a => a.id), ["ambush", "ground", "night", "volley"]);
  // within a point: nobody wins anything
  c = BT.contest(S, side("brawl", { brawler: 1 }), side("hegemony", { levy: 1 }), seq([0.5]));
  assert.equal(c.winner, -1); assert.deepEqual(c.factor, [1, 1]);
});

test("how a battle ends: an attacker beaten in a close fight is thrown back; a lopsided one is a rout; close fights often stall", () => {
  const p = { pDraw: 0, lossA: 0.7, lossB: 0.3 };
  // close (pA 0.45), A attacking, A loses: a repulse with capped losses
  let o = BT.outcome(p, 0.45, 0, seq([0.99, 0.9]));
  assert.equal(o.kind, "repulse"); assert.ok(o.lossA <= 0.5 && o.lossB <= 0.4);
  // lopsided (pA 0.05), A attacking, A loses: a rout
  o = BT.outcome(p, 0.05, 0, seq([0.99, 0.9]));
  assert.equal(o.kind, "rout");
  // an even fight stalls three times in ten
  let st = 0; const R = (() => { let x = 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 2000; i++) if (BT.outcome(p, 0.5, 0, R).kind === "stalemate") st++;
  assert.ok(st > 500 && st < 700, `${st} of 2000`);
  // a winner losing more than half: Pyrrhic
  o = BT.outcome({ pDraw: 0, lossA: 0.6, lossB: 0.9 }, 0.9, 1, seq([0.99, 0.1]));
  assert.equal(o.kind, "pyrrhic");
});

test("a world attacked by a far stronger force rallies its people; fog rounds what you see of a world you don't hold", () => {
  const S = rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }]);
  const w = Object.values(S.worlds).find(x => x.owner === "hegemony" && !x.capital);
  w.garrison = { levy: 4 };
  const def = side("hegemony", { levy: 4 }, [{ kind: "garrison" }]), att = side("brawl", { ironhide: 20 });
  const strength = a => Object.values(a).reduce((x, y) => x + y, 0) * 1;
  const n = BT.rally(S, w, def, att, strength);
  assert.ok(n > 0 && w.garrison.levy === 4 + n && def.army.levy === 4 + n);
  assert.equal(BT.rally(S, w, side("hegemony", { levy: 999 }, [{ kind: "garrison" }]), att, strength), 0, "not when the defenders are a match");
  assert.deepEqual(BT.rough({ levy: 23, warden: 1 }), { levy: 25, warden: 1 });
  // in the view: odds are a band
  let S2 = rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }]);
  const v = view(S2, "h");
  for (const o of Object.values(v.you.odds)) { assert.ok(Array.isArray(o) && o[0] <= o[1]); }
  assert.ok(v.worlds.filter(x => x.forces && x.owner !== "hegemony").every(x => x.forces.every(f => f.faction === "hegemony" || f.rough || x.id === v.you.warband.at)));
  assert.ok(apply);
});
