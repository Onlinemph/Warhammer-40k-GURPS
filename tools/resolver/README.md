# Calibrated resolver

The outcome of a faceless battle in milliseconds, for fights nobody is watching. `resolver.js` needs nothing but
`table.json`; the engine is only used to make and check that table.

```sh
node tools/resolver/calibrate.js 24 4     # every roster pair, 24 engine battles each, 4 cores (~3.5 min)
node tools/resolver/validate.js 30 16     # random mixed armies: engine Monte Carlo against the resolver
```

```js
const { predict } = require("./tools/resolver/resolver.js");
predict([{ template: "Ork Boy", count: 30 }], [{ template: "Astra Militarum Guardsman", count: 20 }]);
// { pWinA, pWinB, pDraw, lossA, lossB, seconds, sims }
```

**Calibration.** Each pair of types in `roster.json` fights 10 against 10 in the open, 50 yards apart. From the
engine's per-second tally of who is standing, each type's rate against the other is the number of them it removes
(killed, knocked out or routed) per second per man on the field. Both directions come from the same battles.

**Prediction.** The battle is fought second by second in aggregate: each type spreads its effort over the enemy
types in proportion to how many there are and its rate against each, removals are drawn at random around the
rates, and it's fought 400 times over (seeded).

**Accuracy** (engine at the commit in `table.json`, 30 random mixed armies of 1-3 types and 4-17 of each, 16
engine battles each): the favourite is called right in 28 of 30; the mean error is about 11 points in the win
chance and 8 in the share of each side lost. Lopsided fights come out nearly exact; close ones are where it errs
(one the engine calls 50-50 it gives 13%). Rates are for a meeting engagement in the open: terrain, range and
the director aren't in them yet.

Re-run `calibrate.js` whenever the engine changes in a way that moves results (the golden battles will say so).
