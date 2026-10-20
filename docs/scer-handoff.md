# SCER Handoff: Changes to "It's a Threat!" CER

This document describes a modified version of the Combat Effectiveness Rating (CER) system from Christopher R. Rice's "It's a Threat!" (*Pyramid* #3/77, March 2015, pp. 29–35). The modified system is called **Scaled CER (SCER)**. It's meant to rate threats across all of GURPS, not only Dungeon Fantasy.

It covers the baseline system, every change made, the final formulas, the test data, and the known issues. It's written so someone who hasn't seen the original conversation can continue the work.

---

## 1. Files

| File | What it is | State |
|---|---|---|
| `cer-calculator.jsx` | React single-character calculator. Has a Standard/Scaled toggle. | Current. Matches this document. |
| `encounter-threat-calc.jsx` | React encounter builder: party vs. monster group, situational modifiers, threat class. Has a Standard/Scaled toggle. | Thresholds are current. **Bestiary CER values are standard CER only** (see Known Issues). |
| `scaled-cer-system.md` | Earlier design doc. | **Out of date.** It describes damage x^1.3, DR x^2.0, the old bands, and no synergy or soft cap. This handoff doc supersedes it. |

---

## 2. Baseline: Rice's original CER

CER = OR + PR (minimum 1).

**Offensive Rating (OR)** is the sum of five sub-scores:

- **Attack Skill:** best attack skill − 10. Ranged attacks add Acc + 2 (innate ranged attacks assume Acc 3).
  - Add 5 for multiple attacks (Extra Attack and the like).
  - For multiple Rapid Strikes, use (adjusted skill − 10, minimum 12) × number of attacks instead.
  - Add +3 each for Heroic Archer, Trained by a Master, and Weapon Master.
  - Add the Rapid Fire skill bonus.
  - Add 15 if the attack hits automatically, unless it needs another attack to hit first.
- **Affliction:** 1/5 of the costliest Affliction enhancement %.
  - If the attack does both damage and an Affliction, take the higher of the two values plus 1/5 of the lower.
  - Terror and True Faith add +1 per 5 CP.
  - Binding adds its ST.
  - Halve the result if the attack comes from a spell or another FP-using ability.
- **Damage:** ceil(dice × 3.5) + modifier.
  - Multiply by (Rapid Fire bonus + 1).
  - Multiply by the type modifier: small piercing ×0.5; cutting and large piercing ×1.5; impaling, huge piercing, corrosion, and fatigue ×2; everything else ×1. Explosive adds 0.5 to the type modifier; vampiric adds 1.
  - Add +5 per Armor Divisor step.
  - Cyclic attacks add the adjusted damage × the number of cycles within 15 seconds.
  - Halve the result for spells and FP abilities.
- **FP:** max FP − 10, plus any bonus FP (Energy Reserve and the like), plus 1 per 5 CP of FP-recovery traits that work within 15 seconds. A creature with FP "N/A" gets 0.
- **Move:** best Move (after encumbrance) − 6.

**Protective Rating (PR)** is the sum of five sub-scores:

- **Active Defense:** the best of the following, then add Defense Bonus and +20 per level of Altered Time Rate.
  - (Dodge − 8) × 2
  - Parry − 8, plus 2 per extra penalty-free parry, plus 1 for TbaM or Weapon Master
  - Block − 8, plus 1 for Weapon Master (Shield)
- **DR:** the four major locations (head, arms, legs, torso) summed and divided by 4; split DR uses the average of its two values.
  - Add +1 per 5 CP of DR that only protects against specific threats.
  - Add +5 per step of Hardened.
  - Add +1 per 5 CP of combat-useful traits (Injury Tolerance, Unliving, Resistant, and the like).
  - Subtract 1 per 5 CP of Vulnerability, Dependency, Weakness, and similar disadvantages.
  - Add levels of Magic Resistance.
- **Health:** HT − 10, plus +1 for Fit or +2 for Very Fit, plus half of Hard to Kill and half of Hard to Subdue, plus +2 each for High Pain Threshold and Recovery.
- **HP:** max HP − 10, plus bonus HP, plus 1 per 5 CP of healing traits.
  - Healers also add the **better** of these two: half the HP they can heal per use (or +10 if they can restore all HP), or 1/5 of the value of curing debilitating conditions.
- **Will:** Will − 10, plus half the levels of Fearlessness (rounded up), plus 1 for Combat Reflexes, plus 8 for Unfazeable.

**Threat class.** N = party total CER ÷ monster total CER.

| N | Class |
|---|---|
| 11+ | Nuisance |
| 3–10 | Fodder |
| 0.49–2 | Worthy |
| 0.10–0.50 | Boss |
| < 0.10 | Epic |

### Implementation bugs fixed (not design changes)

The first build had errors in implementing Rice's rules. All four are fixed:

1. Explosive and vampiric were applied as separate multipliers. They now add to the type modifier, so cutting + explosive is ×2.0.
2. Bonus FP had 10 subtracted from it. It's now added directly.
3. Cyclic damage used the base damage. It now uses the fully adjusted damage total.
4. Healing bonuses were added together. The calculator now uses the better of heal-damage or cure-conditions.

---

## 3. The problem being solved

Rice's CER is linear, and it was tuned for DF's power band (about 250 points, DR rarely above 12). Outside that band it badly underrates concentrated power.

The test case is a TL8 robot facing a DF party:

- Skill 20, with a 6d×4 crushing explosive rocket (Acc 5, RoF 1).
- DR 30 on head, arms, and legs; DR 120 on the torso. Unliving and Combat Reflexes.
- HT 14, HP 73, Will 12, Move 8, Dodge 9, FP N/A.

Standard CER rates it at 274. Against a 4–5 person DF party, that gives N ≈ 0.8, or "Worthy." In practice, the party can't penetrate DR 30 anywhere, and the rocket kills any party member in one hit. The real result is a total party kill.

---

## 4. Changes (final state)

### Change 1: DR is weighted by hit location and minimum DR

This affects **both Standard and Scaled mode** in the current code.

```
weighted = head×0.15 + arms×0.15 + torso×0.50 + legs×0.20
drBase   = ceil(weighted × 0.5 + min(head, arms, legs, torso) × 0.5)
```

The other DR adjustments (specific-threat DR, Hardened, IT, vulnerabilities, Magic Resistance) are then added to `drBase` exactly as in Rice's rules.

Rationale: attackers target weak spots, and hits mostly land on the torso. Under Rice's formula, DR 300 on the head alone scored 75, the same as DR 75 everywhere. It now scores 22.5. Uniform DR is unchanged, and the DF knight's score barely moves (3.5 → 3.3).

### Change 2: Each sub-score is scaled

The raw sub-scores from Section 2 are computed first. Each is then passed through its own curve before being summed into OR or PR. Negative values keep their sign: f(−x) = −f(x).

| Sub-score | Curve | Rationale |
|---|---|---|
| Attack Skill | `x + x²/7` | Extra skill buys Deceptive Attacks, hit-location shots, and Rapid Strikes. |
| Damage | `|x|^1.5` | Damage past −5×HP kills outright. Set so that offense roughly equals the defense it can overcome (see Change 6). |
| Affliction | `x` | Already an abstraction; it has no threshold effects. |
| FP | `x` | Linear resource. |
| Move | `x` | Its breakpoints depend on the matchup. |
| Active Defense | `x × (1 + x/5)` | 3d6 curve: Dodge 12 is hit 4.6% of the time; Dodge 14 is hit 0.9%. |
| DR | `|x|^1.75` | Immunity thresholds: each tier removes a whole class of weapons. |
| HP | `|x|^1.2` | Mild resistance to attrition at high values. |
| Health | `|x|^1.2` | Death checks and consciousness rolls become near-automatic. |
| Will | `|x|^1.2` | Fright Checks and mental attacks become near-irrelevant. |

History of the tuning, for context:

- **DR** went from x^1.5 to x^2.0 to x^1.75. Squared ran away too fast at high values.
- **Active Defense** went from x(1+x/15) to x(1+x/8) to x(1+x/5).
- **Damage** went from x^1.15 to x^1.3 to x^1.5.
- **Skill** went from x+x²/20 to x+x²/10 to x+x²/7.
- **HP, HT, and Will** went from x^1.1 to x^1.2.

### Change 3: Soft cap

This is applied to every scaled sub-score after its curve.

```
T = 500
softCap(x) = x                         if |x| ≤ 500
           = sign(x) × 500 × (1 + ln(|x|/500))   otherwise
```

Rationale: it stops absurd values. Scaled DR for a raw score of 500 is 2,830 instead of 52,869. It doesn't change any threat class in the test set.

### Change 4: Synergy term

```
synergy = round( sqrt(OR × PR) × 0.2 )      (0 if OR or PR ≤ 0)
SCER    = OR + PR + synergy                  (minimum 1)
```

Rationale: a creature that is both lethal and hard to kill leaves no counterplay. A glass cannon (OR 899, PR 1) gets 6 points of synergy. A brick wall (OR 1, PR 939) gets 6. The robot (OR 1,080, PR 1,015) gets 209. The 0.2 coefficient is a guess.

### Change 5: SCER threat bands

These apply only in Scaled mode. Standard mode keeps Rice's bands.

| N | Class |
|---|---|
| ≥ 10 | Nuisance |
| 2 – 9.99 | Fodder |
| 1.5 – 1.99 | Worthy |
| 0.3 – 1.49 | Boss |
| < 0.3 | Epic |

The encounter-sizing targets in Scaled mode are N ≈ 12 / 5 / 1.7 / 0.8 / 0.15, in the same order as the classes above.

### Change 6: The parity principle (design rule)

"Offensive value should equal the defensive value it can penetrate."

Damage and skill curves were raised until the robot's OR roughly matched its PR, because its rocket defeats about the same tier of armor its DR blocks. At the final curves, the robot's OR/PR ratio is 1.06.

---

## 5. Reference implementation (JS, final)

```js
const SOFT_CAP_THRESHOLD = 500;
function softCap(x) {
  const T = SOFT_CAP_THRESHOLD;
  if (Math.abs(x) <= T) return x;
  const sign = x >= 0 ? 1 : -1;
  return sign * T * (1 + Math.log(Math.abs(x) / T));
}
const pw = (x, e) => (x >= 0 ? Math.pow(x, e) : -Math.pow(-x, e));

const scaleSkill   = x => softCap(x + (x * x) / 7);
const scaleDamage  = x => softCap(pw(x, 1.5));
const scaleDR      = x => softCap(pw(x, 1.75));
const scaleDefense = x => softCap(x * (1 + x / 5));
const scaleHP      = x => softCap(pw(x, 1.2));
const scaleHT      = x => softCap(pw(x, 1.2));
const scaleWill    = x => softCap(pw(x, 1.2));

function calcSynergy(or, pr) {
  if (or <= 0 || pr <= 0) return 0;
  return Math.round(Math.sqrt(or * pr) * 0.2);
}

// OR = max(1, round(scaleSkill + affliction + scaleDamage + fp + move))
// PR = max(1, round(scaleDefense + scaleDR + scaleHT + scaleHP + scaleWill))
// SCER = max(1, OR + PR + calcSynergy(OR, PR))

function threatScaled(n) {
  if (n >= 10)  return "Nuisance";
  if (n >= 2)   return "Fodder";
  if (n >= 1.5) return "Worthy";
  if (n >= 0.3) return "Boss";
  return "Epic";
}
```

---

## 6. Test data (final curves)

The raw sub-scores are post-Rice and pre-scaling, listed in the order skill / damage / move / FP | defense / DR / HT / HP / Will. The lich, troll, battlesuit, kaiju, and peasant are approximations, not published stat blocks.

| Combatant | Raw sub-scores | OR | PR | Syn | SCER | Std CER |
|---|---|---|---|---|---|---|
| Peasant (TL0) | 1/8/−1/0 \| 0/1/0/0/0 | 23 | 1 | 1 | 25 | 9 |
| DF Knight (Lady Ion) | 7/14/−1/3 \| 4/3.3/7/6/0 | 68 | 34 | 10 | 112 | 45 |
| Troll (approx.) | 7/15/0/0 \| 2/5/7/40/2 | 72 | 116 | 18 | 206 | — |
| Lich (approx.) | 17/20/0/0 \| 8/10/5/10/10 | 148 | 116 | 26 | 290 | — |
| Robot (TL8) | 17/126/2/0 \| 2/52.5/4/63/3 | 1,080 | 1,015 | 209 | 2,304 | 274 |
| Battlesuit (TL9) | 18/63/2/2 \| 4/75/2/2/3 | 568 | 1,186 | 164 | 1,918 | 171 |
| Kaiju (SM +10) | 6/123/14/0 \| 0/54/4/340/4 | 1,027 | 1,784 | 271 | 3,082 | 545 |
| Glass cannon | 15/100/5/0 \| all 0 | 899 | 1 | 6 | 906 | — |
| Brick wall | 0/0/0/0 \| 0/50/5/50/5 | 1 | 939 | 6 | 946 | — |

### Against a party of 5 DF knights (SCER 560)

| Opponent | N | SCER class | Intended class | Status |
|---|---|---|---|---|
| Peasant | 22.4 | Nuisance | Nuisance | ✓ |
| Troll | 2.72 | Fodder | Worthy | ✗ |
| Lich | 1.93 | Worthy | Boss | ✗ |
| Robot | 0.24 | Epic | Epic | ✓ |
| Battlesuit | 0.29 | Epic | Epic | ✓ |
| Kaiju | 0.18 | Epic | Epic | ✓ |

---

## 7. Known issues and open work

1. **The threat bands need recalibrating.** The bands were fitted (9 of 10 cases correct) before damage and skill were raised to x^1.5 and x²/7. That raise inflated the DF party's SCER more than it inflated mid-tier monsters. As a result, the troll now reads Fodder (intended: Worthy), and the lich reads Worthy (intended: Boss). The extreme cases are still correct. Either shift the Fodder, Worthy, and Boss boundaries up, or pull back the low-end effect of the damage curve.

2. **Offense may be overweighted at low power.** The knight's OR is now twice his PR, and almost all of the peasant's SCER comes from his hatchet. Parity was tuned from one data point (the robot). An option is a curve that stays close to linear at small values.

3. **Standard mode is no longer pure Rice.** The DR location weighting lives in the shared PR function. If Standard mode should reproduce Rice's published table exactly, split it so the old divide-by-4 DR is used in Standard mode.

4. **The bestiary uses the wrong values in Scaled mode.** The encounter calculator's prebuilt monster CERs are Rice's standard values. They aren't comparable to a scaled party CER, so every monster needs to be re-rated in SCER. Raw stat blocks are in the DF books and *Pyramid* issues listed in Rice's table.

5. **SCER can't see immunity, only predict it.** High DR is a stand-in for "the party can't penetrate this." SCER can't tell whether a specific party has an answer, such as Deathtouch, armor divisors, or anti-armor weapons. Fixing this needs a matchup-aware layer, for example hit probability × penetration probability × kill probability for each party member.

6. **Supernatural abilities aren't modeled.** Insubstantiality, Warp, Terror, flight, invisibility, and mind control don't show up in OR or PR. A ghost with Insubstantiality and HP 1 scores near the minimum.

7. **Party composition is invisible.** Parties are summed, so a mixed party and five clones with the same total rate the same. Group synergy isn't modeled.

8. **Some constants are unvalidated.** The synergy coefficient (0.2), the soft-cap threshold (500), the 50/50 split in the DR formula, and the hit-location weights are all judgment calls. None of them have been tested at the table.

9. **SM isn't rated.** Size Modifier affects how easy a creature is to hit, along with grappling, reach, and trampling (see "Combat Writ Large" in the same issue). Neither CER nor SCER accounts for it.

---

## 8. Suggested next steps, in priority order

1. Recalibrate the Fodder, Worthy, and Boss boundaries against the final curves (Issue 1).
2. Re-rate the bestiary in SCER (Issue 4).
3. Split Standard mode back to pure Rice DR (Issue 3).
4. Add a matchup check as an optional overlay. For example: "can any party member penetrate the monster's minimum DR?" A "no" could force the class toward Epic (Issue 5).
