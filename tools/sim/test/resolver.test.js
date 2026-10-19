// The calibrated resolver (tools/resolver): fast, seeded, and sensible on the cases with an obvious answer.
const test = require("node:test");
const assert = require("node:assert/strict");
const { predict, table } = require("../../resolver/resolver.js");

test("resolver: every roster type has a rate against every other", () => {
  const T = table();
  for (const a of T.roster) for (const b of T.roster) assert.ok(T.rate[a][b] >= 0, `${a} v ${b}`);
});
test("resolver: the same call gives the same answer, and a mirror match is close to even", () => {
  const A = [{ template: "Astra Militarum Guardsman", count: 20 }];
  assert.deepEqual(predict(A, A), predict(A, A));
  const p = predict(A, A, { sims: 2000 });
  assert.ok(Math.abs(p.pWinA - p.pWinB) < 0.1, `mirror: ${p.pWinA} v ${p.pWinB}`);
});
test("resolver: numbers tell, and a big mismatch is a near certainty", () => {
  const small = predict([{ template: "Astra Militarum Guardsman", count: 10 }], [{ template: "Astra Militarum Guardsman", count: 20 }]);
  assert.ok(small.pWinB > 0.8, `10 v 20 Guardsmen: ${small.pWinB}`);
  const marines = predict([{ template: "Astartes Battle-Brother", count: 10 }], [{ template: "Gretchin", count: 10 }]);
  assert.ok(marines.pWinA > 0.95);
});
test("resolver: an unknown unit type is an error, not a guess", () => {
  assert.throws(() => predict([{ template: "Nobody", count: 1 }], [{ template: "Ork Boy", count: 1 }]), /no rates/);
});
