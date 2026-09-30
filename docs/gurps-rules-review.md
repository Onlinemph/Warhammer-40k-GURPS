# GURPS rules review: the simulator checked against the Basic Set

This review checks `tools/sim.js` (the engine: `runBattle` and everything inside it) and `tools/build_site.py` (`combat_flags`, `character_stats`) against the GURPS 4e Basic Set, read from the book this time rather than from memory. Five reviewers each took a block of pages. The success-roll reviewer read B338-361 (success rolls, contests, physical feats, extra effort, Will and Fright Checks). The combat reviewer read B356-388 (maneuvers, attack and defence, damage and injury basics, including the Unliving and Homogeneous wounding tables on B380) but could not read B389-394. The advanced-combat reviewer read B388-426 (line of fire, hitting the wrong target, close combat, hit locations, cover, explosions, injury, fatigue), so B389-394 are covered after all. The tables reviewer read B547-559 (combat tables, Size and Speed/Range, hit locations, the Critical Hit, Head Blow and Miss tables, cover DR), plus the Damage Table on B16 and the weapon-table notes on B268-270. The advantages reviewer read B1-121, less B27-28, a patchy B62-63 and B122-123.

Pages nobody could read: B427-432 (the rest of fatigue, Afflictions and incapacitating conditions on B428, Mortal Conditions on B429, Collisions on B430, Falling on B431), B433-434 (fire and burning), Berserk, Bad Temper and Cowardice (B124-129), and Fast-Draw (B194). Findings that need those pages say so.

The user's deliberate house rules are left out and not reported as errors: Revised Fractional Health; automatic fire rolled per round with cumulative -Recoil; "Deceptive Shot"; only elites (skill 17+, IQ 8+) call shots by default; kneeling or prone figures and adjacent friends don't block line of fire; kneeling to or from standing as a maneuver's step; regenerating force-field Shield Points, Weak Points in armour and eye-lens DR at 3/4 helmet DR; morale checks at 50% and 25% casualties; crate and barricade cover values; generated facility maps with doors and breachable plasteel walls (DR 50, 60 HP, Homogeneous); AI personalities; and internal explosions at x3 for explosive follow-ups (B414). Where a house rule interacts with a RAW detail, the finding says so.

Line numbers are `tools/sim.js` unless another file is named. They are the reviewers' citations and may drift by a line or two.

## Summary

Kinds: **wrong** means the sim contradicts the book; **missing** means the rule isn't modelled; **partial** means part of it is. Impact is the effect on this simulator's fights. Findings are ordered by impact, then roughly by how easy the fix is.

| # | Finding (short) | Book | Kind | Impact | Batch |
|---|---|---|---|---|---|
| 1 | Parry allowed after Move and Attack; ranged Move and Attack doesn't limit defences | B366 | partial | big | C |
| 2 | Fright Checks miss Heat of Battle +5 and Combat Reflexes +2; cap applied before modifiers | B360, B43, B95 | partial | big | A |
| 3 | Mighty Blows stacked on All-Out Attack (Strong); FP paid only on a hit | B357 | wrong | big | B |
| 4 | Sprinting and Enhanced Move acceleration not modelled | B354, B52 | missing | big | B |
| 5 | A roll of 17 succeeds at skill 17+; `P3` table wrong at the ends | B343, B348, B369, B374 | wrong | medium | A |
| 6 | Attacks rolled at effective skill below 3 (burst rounds keep critting) | B344 | wrong | medium | A |
| 7 | Takedown, pin and break free use the resistance form of the Quick Contest | B348 | partial | medium | A |
| 8 | Stun's -4 defence should last until the model's next turn even after recovery | B364, B381 | wrong | medium | C |
| 9 | Standing up from kneeling spends a whole turn instead of a step | B364, B368 | wrong | medium | B |
| 10 | Failed knockdown roll doesn't drop what the model holds | B420 | missing | medium | D |
| 11 | No knockdown roll for head and vitals hits that cause shock | B420 | missing | medium | D |
| 12 | Chinks in armour offered to every damage type | B400 | wrong | medium | D |
| 13 | Hard to Kill: surviving only thanks to the bonus should still drop the model | B58 | wrong | medium | D |
| 14 | Natural DR protects the eyes | B46 | wrong | medium | D |
| 15 | Slams take the Move and Attack -4 and skill cap of 9 | B371, B365 | wrong | medium | G |
| 16 | Break free: no +5/+10 for the grappler, no 10-second limit when pinned | B371 | wrong | medium | G |
| 17 | A grappled model swings any weapon and can Feint; its parry is -4 not -2 | B370-371 | partial | medium | G |
| 18 | Melee weapons have no minimum-ST penalty | B270 | missing | medium | F |
| 19 | † weapons one-handed at 1.5x ST (should be 2x); ‡ and "unready after attack" not modelled | B269-270, B369, B383 | wrong | medium | F |
| 20 | Shield DB added against firearms and from any non-rear side | B374 | wrong | medium | C |
| 21 | Aimed attack at a small location that misses by 1 doesn't hit the torso | B552 | missing | medium | D |
| 22 | Critical Head Blow Table not used for skull, face and eye crits | B399, B556 | missing | medium | A |
| 23 | Aim not spoilt by defending or injury; no 2x Acc cap; no brace bonus | B364, B372 | partial | medium | B |
| 24 | Retreat: bonus lost on later attacks by the same foe; prone and kneeling wrong; no fencing +3 | B377 | partial | medium | C |
| 25 | Suppression fire: skill cap applied before modifiers, zone size, 3-hit cap | B409 | wrong | medium | E |
| 26 | Cover: a shooter pays -2 and hits cover DR at once | B407, B548 | partial | medium | E |
| 27 | Hitting the wrong target: flat 9 or worse, bystander defends, dodged shots carry on | B389, B392 | wrong | medium | E |
| 28 | Fragments: one hit max, struck model rolls, kneeling ignored, cover from shooter's hex | B414, B551 | partial | medium | E |
| 29 | Scatter distance fixed at 1-2 yards instead of margin-based | B414 | wrong | medium | E |
| 30 | Cones and explosions take hit locations instead of large-area injury | B398, B400 | wrong | medium | E |
| 31 | Cones are a disc round the target, not a wedge from the shooter | B413 | partial | medium | E |
| 32 | Malfunctions always jam for 1d seconds; no malfunction table | B407-408 | partial | medium | F |
| 33 | Models can't move through friends | B368, B385, B387 | wrong | medium | B |
| 34 | Half damage at 1/2D applies "beyond", should be "at or beyond" | B378 | wrong | small | E |
| 35 | Armour divisor keeps DR at a minimum of 1 | B378 | wrong | small | D |
| 36 | Ranged attacks that fail by 10+ are treated as critical misses | B382 | wrong | small | A |
| 37 | Critical Hit Table: row 14 is double shock (should be major wound); row 8 cripples permanently | B556 | wrong | small | A |
| 38 | Rule of 16 missing for Maledictions | B349 | missing | small | A |
| 39 | Shock rounding for 20+ HP (per-hit floor, fractional HP/10) | B381, B419 | wrong | small | D |
| 40 | Double shock cap of -8 never applies; groin crushing shock and -5 knockdown missing | B399, B420, B556 | wrong | small | D |
| 41 | Crippled leg halves Dodge | B421 | wrong | small | D |
| 42 | Death check failed by 1-2 should be a mortal wound | B419, B423 | partial | small | D |
| 43 | Non-piercing random eye hits get the base multiplier; eye blinding missing | B399, B421, B552 | partial | small | D |
| 44 | Vitals open to all damage types; shield-arm penalty missing | B398, B552 | partial | small | D |
| 45 | No Blood not tracked; bleeding exemption tied to Unliving | B61 | wrong | small | D |
| 46 | Blunt trauma from hits stopped by cover | B379 | wrong | small | D |
| 47 | All-Out Attack move is floor(Move/2); should be the greater of 2 or ceil(Move/2) | B365, B385 | wrong | small | B |
| 48 | Step is always 1 yard; should be Move/10 rounded up | B368 | partial | small | B |
| 49 | Turn order ties reshuffled every second | B363 | wrong | small | B |
| 50 | Below 1/3 FP doesn't halve Move, Dodge and ST | B354, B426 | missing | small | B |
| 51 | 0 FP: HT roll instead of Will; no collapse, no HP cost, no unconsciousness at -FP | B426 | wrong | small | B |
| 52 | Bare-handed parry against weapons has no -3 | B377 | missing | small | C |
| 53 | Parrying an unarmed attack with a weapon injures without the skill roll | B376 | partial | small | C |
| 54 | Per-turn defence limits reset at the start of the second, not at the model's turn | B363, B375-377 | partial | small | C |
| 55 | Multiple parries: no -2 for fencing weapons (-1 with a master) | B376 | partial | small | C |
| 56 | Enhanced Parry and Weapon Master apply to any melee weapon | B51, B99 | partial | small | C |
| 57 | Explosion collateral cut off at 10 yards per level instead of 2 x dice | B414 | partial | small | E |
| 58 | Rapid-fire bonus stops at +7 above 99 shots | B373 | partial | small | E |
| 59 | Only the first hit of an explosive burst explodes | B414 | wrong | small | E |
| 60 | Target speed added for human-speed targets (counts movement twice) | B373 | partial | small | E |
| 61 | Posture -2 applied to every location, including the head | B548, B551 | wrong | small | E |
| 62 | Melee maximum ST (3x minimum ST) not modelled | B270 | missing | small | F |
| 63 | Damage table ends at ST 70 | B16 | partial | small | F |
| 64 | Throwing skill doesn't add to ST for distance | B356 | missing | small | F |
| 65 | Grappling ignores Lifting ST and armour ST | B65 | wrong | small | G |
| 66 | A foe of more than twice your ST isn't held in place | B370 | missing | small | G |
| 67 | All-Out Attack (Strong) and Mighty Blows apply to non-ST-based melee weapons | B365 | partial | small | B |
| 68 | Evaluate is never taken | B364-365 | missing | small | B |
| 69 | Feint helps every blow and can carry over turns; Shield skill ignored | B365 | partial | small | B |
| 70 | Flurry of Blows not modelled | B357 | missing | small | B |
| 71 | Critical failure while using extra effort costs no HP | B357 | missing | small | B |
| 72 | Critical success and failure on defence rolls have no effect | B381-382 | missing | small | A |
| 73 | Critical Miss Table: row 15, breakage-resistant weapons, 5/6 reroll | B556-557 | partial | small | A |
| 74 | Natural weapons use the armed Critical Miss Table | B557 | partial | small | A |
| 75 | Shadow in the Warp failure: single stun recovered on HT instead of the table and Will/IQ | B360-361, B364, B420 | partial | small | A |
| 76 | Point-blank shots can be blocked and get the retreat bonus | B375-377 | wrong | small | C |
| 77 | Parrying weapons heavier than your Basic Lift | B376 | missing | small | C |
| 78 | Thrown weapons can only be dodged | B373, B376 | missing | small | C |
| 79 | Knockback: melee only, DX only, no Perfect Balance | B378 | partial | small | D |
| 80 | Follow-up damage: lost when the carrier doesn't penetrate; per-turn burning; location | B381, B105 | partial | small | D |
| 81 | Injury Tolerance: No Brain, No Vitals, Diffuse, Unliving handled inconsistently | B61, B380, B400, B420 | partial | small | D |
| 82 | Crippled arm gives -4 to all attacks and drops nothing | B421 | wrong | small | D |
| 83 | Bleeding details | B420 | partial | small | D |
| 84 | Slam dice rounding and knockdown resolution; slams cause knockback | B371 | wrong | small | G |
| 85 | Lost takedown doesn't drop the attacker; pin lacks SM and free-hand bonuses | B370 | partial | small | G |
| 86 | Punching DR 3+ doesn't hurt the puncher | B379 | missing | small | G |
| 87 | Grenade needs two Readies (draw, arm); Combat Reflexes +1 Fast-Draw | B410, B43 | wrong | small | F |
| 88 | Bipod (B) weapons have no ST requirement at all | B270 | wrong | small | F |
| 89 | Backward and sideways moves cost 1; facing changes free | B386-387 | partial | small | B |
| 90 | Crates can't be crossed | B352 | missing | small | B |
| 91 | "Attacking an area" with grenades not available | B414 | missing | small | E |
| 92 | Overpenetration not modelled | B408-409 | missing | small | E |
| 93 | Affliction and other non-damaging weapon lines ignored | B35-36, B416 | missing | small | F |
| 94 | Encumbrance not modelled | B17 | missing | small | F |

Totals: 94 findings, 4 big, 29 medium, 61 small.

## Proposed fix batches

**A. Rolls, contests, Fright Checks and criticals** (12: #2, 5, 6, 7, 22, 36, 37, 38, 72, 73, 74, 75). Mostly `check`, `contest`, `fright`, `critMiss` and the crit tables in `applyHit`. Morale and psyker Fright Checks get much less decisive for low-Will troops, elites stop hitting on 17, long bursts stop producing undefendable crits, and head crits become a real threat to helmeted models.

**B. Maneuvers, movement, extra effort and fatigue** (17: #3, 4, 9, 23, 33, 47, 48, 49, 50, 51, 67, 68, 69, 70, 71, 89, 90). The action menu in `act` and `approachOptions`, plus `moveOf`. Chargers get faster (sprint, Enhanced Move, moving through friends), knocked-down models lose one turn instead of two, Mighty Blows becomes a cheaper trade that keeps defences, and aimers lose their aim when they defend.

**C. Active defences** (12: #1, 8, 20, 24, 52, 53, 54, 55, 56, 76, 77, 78). `defend`, `bestDefence`, `rangedDefence`, `canRetreat`. Charging blade-users lose their parry, shield-bearers lose DB against guns, stun hurts for a full turn, and retreat follows the book against multi-attack foes. Overall a shift toward the side that receives the charge and toward shooters against shield units.

**D. Injury, shock, knockdown and hit location** (20: #10, 11, 12, 13, 14, 21, 35, 39, 40, 41, 42, 43, 44, 45, 46, 79, 80, 81, 82, 83). `injure`, `applyHit`, `woundMult`, `cripple`, `planAttack`. Head and vitals hits stun more often and knockdowns disarm, Hard to Kill Orks drop sooner, eye shots become the answer to big chitin monsters, and power swords stop halving power armour through chinks.

**E. Ranged fire, cover and area attacks** (15: #25, 26, 27, 28, 29, 30, 31, 34, 57, 58, 59, 60, 61, 91, 92). `fireAt`, `stray`, `suppressHit`, `explosion`, `throwGrenade`, the cone code. Cover stops doubling up, suppression works against the prone and covered targets it's meant for, grenades scatter by margin and throw more fragments, flamers sweep a wedge, and friendly fire into melee follows the flat-9 rule with a defence.

**F. Weapons, equipment and afflictions** (10: #18, 19, 32, 62, 63, 64, 87, 88, 93, 94). `mkWeapon`, `oneHand`, `jamCheck`, `grenadeReady`, `buildUnit`, `parseDamage`. Weak humans with Astartes-grade melee weapons and bipod guns take their ST penalties, Ork guns malfunction in more varied ways (a stoppage still fires once), and grenades take a turn longer to throw.

**G. Grappling and slams** (8: #15, 16, 17, 65, 66, 84, 85, 86). `slam`, `grab`, `wrestle`, `breakFree`. Slams hit more often, pins hold far better, a held model can't swing a chainsword, and armoured ST counts in wrestling. The "grab and pin" mob tactic becomes stronger, while a Gretchin can no longer hold a Carnifex.

---

## Detailed findings

### 1. Parry allowed after Move and Attack (big, C)
- **Rule** (B366): Move and Attack, "Active Defense: Dodge or block only. You cannot parry and you may not retreat."
- **Sim**: `strike` (1335) and `slam` (2179) set `m.mna`, and `canRetreat` (1029) checks it, but the parry options in `bestDefence` (1038) and `defend` (1068) don't. The ranged Move and Attack (`fireAt` with `moved`, 1631, the `advance-fire` branch) never sets `mna`, so that shooter can still parry and retreat.
- **Fix**: add `&& !t.mna` to both parry conditions; set `m.mna = true` in the `advance-fire` branch.
- **Impact**: big. Every charge by a blade-armed model (Genestealers, Orks, Wyches, Incubi) is affected. The earlier review's item 12 was only half done.

### 2. Fright Check modifiers (big, A)
- **Rule** (B360): "The Rule of 14: If final, modified Will exceeds 13, reduce it to 13." Modifiers include +2 for Combat Reflexes (also B43), Fearlessness, "Heat of Battle: +5 if you are in combat when the terrifying thing happens", horde penalties (-1 for 5 monsters up to -5 for 100+), monster penalties, -1 if touched, -2 if alone. B95: Unfazeable is exempt from Fright Checks.
- **Sim**: `fright` (716) is `check(Math.min(13, u.will + fearless) + mod)`: the cap comes before `mod`, every caller passes `mod = 0` (2318, 2372), and Combat Reflexes and Heat of Battle are never added. The morale check skips Unfazeable (2366) but the Shadow in the Warp check (2316-2318) doesn't.
- **Fix**: `check(Math.min(13, u.will + (fearless||0) + (cr ? 2 : 0) + 5 + mod))`; optionally pass horde penalties from the enemy side. Skip `unfazeable` in the Shadow in the Warp check.
- **Impact**: big for units with Will + Fearlessness under 13. A Will 10 Guardsman squad fails a morale check 50% of the time now; with Heat of Battle it is capped at 13 and fails 16.2%. Marines (Will 14 + Fearlessness 4) stay at 16.2%. Reviewers rated it big (success-roll reviewer), medium (advantages) and small to medium (combat, which treated morale as a house rule). The morale checks are the user's rule, but the sim calls them Fright Checks, so the RAW modifiers belong on the roll.

### 3. Mighty Blows (big, B)
- **Rule** (B357): "If you take an Attack maneuver in melee combat, you can spend FP to gain the damage bonus of an All-Out Attack (Strong) ... without sacrificing your defenses. This costs 1 FP per attack." FP must be spent "before you make your attack or defense roll."
- **Sim**: the only option is `aoa-mighty` (1971-1974), which sets `m.aoa = true` and calls `strike(..., {strong: true, mighty: true})`; 1358-1359 add both bonuses (+2 x max(2, dice)) and the model has no defence. The FP is deducted inside the hit branch (1359), so missed or defended blows are free. `docs/simulator.md:50` describes the same stack.
- **Fix**: remove `aoa-mighty`; add a `mighty@t` option on the Attack maneuver (`strike(m, w, t, {mighty: true})`, no `aoa`), valued with `boosted(w, 1)` less the FP. Deduct 1 FP per blow before `check(plan.lvl)` (1345), when `m.fp > 1`.
- **Impact**: medium to big (success-roll reviewer), medium (combat reviewer). The option is currently worth twice the RAW bonus and costs the defences RAW keeps; it changes charging-mob fights and the pinned-foe finish.

### 4. Sprinting and Enhanced Move (big, B)
- **Rule** (B354): sprinting in a straight line adds 20% to Move after one second, drop fractions, minimum +1; any deviation needs a second at normal Move. "If you have Enhanced Move (Ground), you can accelerate by your Basic Move every second until you reach top speed ... Basic Move 7 and Enhanced Move 2, you run at Move 7 the first second, Move 14 the next second, Move 21 the third second, and your top speed of Move 28 in the fourth second." B52: Enhanced Move doesn't change Basic Move or Dodge.
- **Sim**: `moveOf` (718) has no sprint bonus. `combat_flags` (`tools/build_site.py:267+`) has no Enhanced Move branch.
- **Fix**: track consecutive straight Move maneuvers `k`. Without Enhanced Move: Move `max(move + 1, floor(move * 1.2))` from the second one. With Enhanced Move level L: `min(base * 2^L, base * k)` (no 20% on top). Reset on any other maneuver or a sharp turn; Move and Attack and steps use base Move. Add `flags.enhMove` (Ground only).
- **Impact**: big for melee-rush factions (Genestealers, Hormagaunts, Wyches, Aspect Warriors) in open bays: a second straight second doubles their closing speed. Short hallways and corners limit it on facility maps.

### 5. A roll of 17 succeeds at skill 17+ (medium, A)
- **Rule** (B343): "a roll of 17 or 18 is always a failure." B348: 17 is a critical failure at skill 15 or less, otherwise an ordinary failure. B369 and B374 repeat it for attacks and defences.
- **Sim**: `check` (30-35): `ok = critS || (!critF && r <= level)`, so at level 17+ a 17 succeeds (99.5% instead of 98.1%). `P3` (24-26) has 215/216 at 17, 1.0 at 18+ and 0 below 3; the `n >= 17 ? 1 : 1` on line 25 is a no-op.
- **Fix**: `ok: critS || (!critF && r <= Math.min(level, 16))`. Clamp `P3[n]` to 212/216 for n >= 16 and 4/216 for n <= 4.
- **Impact**: the success-roll reviewer rated it small, the combat reviewer medium: aimed Marine and Custodian attacks and high defences often run at 17-20, and the AI thinks a defence of 17+ never fails.

### 6. Rolls attempted at effective skill below 3 (medium, A)
- **Rule** (B344): "You may not attempt a success roll if your effective skill is less than 3, unless you are attempting a defense roll."
- **Sim**: `strike` (1345), `fireAt` (1261, and the per-round loop at 1265), `grab` and `throwGrenade` roll at any level, so a 3 or 4 is still an undefendable critical. With the house-rule cumulative -Recoil, a 20-round burst can have 15 such rounds, about 0.28 crits per burst. The planner (`burstHits`, 111) already stops at `l < 3`.
- **Fix**: in the burst loop `if (lvl - (k0 + k) * w.rcl < 3) break;`; skip any attack below 3 in `strike`, `grab` and `throwGrenade`. Defence rolls stay exempt.
- **Impact**: medium for high-RoF weapons at range (heavy bolters, shuriken, assault cannon); small elsewhere. This is a house-rule interaction, not an objection to it.

### 7. Quick Contests are one-sided (medium, A)
- **Rule** (B348): "if both fail, the winner is the one with the smallest margin of failure. A tie means nobody won." The form where the attacker must succeed is only for resistance rolls.
- **Sim**: `contest` (2228-2231) returns `ra.ok && (!rb.ok || ra.margin > rb.margin)`; used for takedown (2253), pin (2257) and break free (2266).
- **Fix**: `if (ra.ok !== rb.ok) return ra.ok; return ra.margin > rb.margin;` (a tie changes nothing).
- **Impact**: medium in grapple-mob fights, both ways: with scores near 10, both sides fail about 25% of the time and about half of those flip.

### 8. Stun's defence penalty ends too early (medium, C)
- **Rule** (B364): "If you are stunned, however, your active defenses are at -4 until your next turn – even if you recover." B381: -4 to active defences and no retreat.
- **Sim**: the turn loop (2313) clears `m.stunned` on a successful HT roll, so the model defends normally and can retreat for the rest of that second.
- **Fix**: on recovery set `m.stunRecovering`; apply -4 and no retreat in `defend` and `bestDefence`; clear it at the start of the model's next turn.
- **Impact**: medium; stun from major wounds is common.

### 9. Standing up from kneeling (medium, B)
- **Rule** (B364, B368): "You can switch between kneeling and standing (only) as the 'step' portion of any maneuver that allows a step." Prone to kneeling is one Change Posture; then stand as the step of the next maneuver.
- **Sim**: `act` (1495, `if (m.kneel && !m.prone && !m.kneelVol)`) spends the whole turn standing, so a knocked-down model loses two turns instead of one.
- **Fix**: clear `m.kneel` and continue into the options that include a step (Attack, Aim, Feint, Ready, Concentrate, All-Out Defense), not Move, Move and Attack or All-Out Attack movement.
- **Impact**: medium; every knockdown is affected. It contradicts the rule the user's firing-line house rule relies on.

### 10. Knockdown doesn't drop held items (medium, D)
- **Rule** (B420): on a failed knockdown roll "You fall prone (if you weren't already), and if you were holding anything, you drop it."
- **Sim**: 813 sets `stunned` and `prone` only; only crit row 12 drops a weapon (846).
- **Fix**: on a failed knockdown roll set `t.inHand = "none"` (except natural weapons, and strapped or both-ready weapons as for crit row 12). The existing Ready then picks it up.
- **Impact**: medium; a knocked-down model loses at least one more turn.

### 11. Knockdown for head and vitals hits (medium, D)
- **Rule** (B420): an HT roll against knockdown and stun is needed "whenever you suffer a major wound, and whenever you are struck in the head (skull, face, or eye) or vitals for enough injury to cause a shock penalty". The -5/-10 location modifiers apply only to major wounds; High Pain Threshold +3.
- **Sim**: `injure` (809-814) rolls only on `inj > HP/2 || crippled || cMajor`.
- **Fix**: also roll for skull, eye, face and vitals hits that cause shock, at plain HT (+3 HPT) unless the wound is also major. Models with High Pain Threshold take no shock, so RAW they never roll for non-major head and vitals hits.
- **Impact**: medium; elites aim at vitals and skull, and every such hit becomes a stun chance.

### 12. Chinks in armour for every damage type (medium, D)
- **Rule** (B400): "You may use a piercing, impaling, or tight-beam burning attack to target joints or weak points in a suit of armor." -8 torso, -10 elsewhere, halve DR.
- **Sim**: `planAttack` (985) offers `#c` locations to every weapon, including power swords, chainswords, fists and flamers.
- **Fix**: offer chinks only for `pi*`, `imp`, or `burn` that isn't explosive or a cone.
- **Impact**: medium; elite melee models currently halve power armour DR at -8.

### 13. Hard to Kill collapse (medium, D)
- **Rule** (B58): "If this bonus makes the difference between success and failure, you collapse, apparently dead (or disabled)".
- **Sim**: 818 rolls `check(HT + htk)` and any success leaves the model fighting; the Fractional Health brain-wound roll (768) is the same.
- **Fix**: if the roll succeeds but the raw roll is over plain HT, `incapacitate(t, "collapses, apparently dead")` (not a kill, no Reanimation). Same at 768.
- **Impact**: medium. Every Ork has HTK 3 (Warboss 6); for an Ork Boy (HT 13) the bonus decides about 14% of death checks.

### 14. Natural DR on the eyes (medium, D)
- **Rule** (B46): "By default, natural DR does not protect your eyes."
- **Sim**: `drAt(dr, "eye")` (183) returns `dr.all + (dr.eye ?? dr.face)`, and `applyHit` (~866) uses it for natural DR, so eyes get full chitin or necrodermis DR. The Tyranid trait notes give lower eye DR ("Eye clusters run at DR 12 rather than 25") but no data carries it.
- **Fix**: for natural DR, the eye uses only an explicit `dr.eye` (default 0). Either add the notes' eye values to the traits' `dr_bonus` or accept 0 (see Questions).
- **Impact**: medium; eye shots against a Carnifex (DR 150), Hive Tyrant, Lictor or Necrons are useless today.

### 15. Slams take the Move and Attack penalty (medium, G)
- **Rule** (B371): "the -4 to hit and effective skill cap of 9 for a Move and Attack do not apply to slams." B365 agrees.
- **Sim**: `slam` (2181): `if (aoa) lvl += 4; else lvl = Math.min(9, lvl - 4);`; the AI value (1894) also subtracts 4.
- **Fix**: remove the -4 and the cap for non-All-Out-Attack slams.
- **Impact**: medium; Ork and Tyranid mobs slam to set up pins.

### 16. Breaking free is too easy (medium, G)
- **Rule** (B371): a Quick Contest of ST. "Your foe has +5 if he is grappling you with two hands. If he has you pinned, he rolls at +10 if using two hands or at +5 if using only one, and you may only attempt to break free once every 10 seconds." +2 per arm past two; a stunned grappler is at -4.
- **Sim**: `breakFree` (2262-2271) is `contest(max(st, grapple-4) - skillPen, gripST)` every turn (2315), with no bonuses or limit. Grappling skill - 4 isn't in B371.
- **Fix**: +5 for the holder (two hands), +10 when pinned; `m.nextBreak = turn + 10` when pinned; -4 when the lead grappler is stunned; ST only.
- **Impact**: medium; pins break far too easily, undervaluing the mob grab-and-pin tactic.

### 17. What a grappled model can do (medium, G)
- **Rule** (B371): "You're limited to unarmed attacks (striking or grappling) or attacks using weapons with reach C. You can stab with a dagger, but not swing a sword!" No Aim, Feint, Concentrate, Wait or ranged attacks. B370: -4 DX.
- **Sim**: a held model uses `meleeOptions` with any weapon at -4 (1953); guns are blocked (1948, correct); Feint is still offered (1976-1990); parry is -4 (1069).
- **Fix**: while `m.grips.length`, allow only reach C weapons, punches and bites; drop Feint; make the held parry -2 (a -4 skill gives -2 to Parry).
- **Impact**: medium; a held Marine keeps swinging his chainsword or power fist.

### 18. Melee minimum ST (medium, F)
- **Rule** (B270): -1 to weapon skill per point of ST you lack.
- **Sim**: `w.minST` is set only in the ranged branch (289-291); the melee branch (276-282) reads ST only for † and ‡.
- **Fix**: parse the ST in the melee branch and apply `level -= minST - liftST`.
- **Impact**: medium for loadouts that give ST 15-18 weapons (Eviscerator 15, Astartes chainsword 15, chainaxe 16, power sword 16, power axe 18, chainfist 17, power fist 15) to ST 10-12 humans.

### 19. Two-handed and unwieldy weapons (medium, F)
- **Rule** (B270): † weapons can be used one-handed at 1.5x listed ST but "become unready after you attack", and freely one-handed at 2x. ‡ weapons need two hands and become unready after each attack unless ST is 1.5x; one-handed without that needs 3x. B369, B383: unwieldy weapons also become unready if you fall or are stunned. B365: All-Out Attack (Double) needs a weapon that doesn't have to be readied.
- **Sim**: `oneHand` (249-253) makes † fully one-handed at 1.5x. ‡ is one-handed at 3x (correct), but "unready after attack" isn't modelled (252). The extra rule that a one-handed gun needs Bulk -2 or better (292) isn't in B270; it's a framework heuristic.
- **Fix**: † free one-handed at 2x; between 1.5x and 2x one-handed but re-Ready after each attack (at least not `bothReady`). Model ‡ unreadiness if ‡ weapons are added (none in the data now).
- **Impact**: medium for dual-wield decisions; ST 18-23 wielders of 12† guns are one-handed in the sim but not RAW.

### 20. Shield DB against firearms (medium, C)
- **Rule** (B374): DB applies against attacks from the front or the shield side, and "adds to active defense rolls against melee attacks, thrown weapons, and muscle-powered missile weapons – not against firearms (unless the GM wishes to use the optional Damage to Shields rules, p. 484)."
- **Sim**: `rangedDefence` (1047) and `defend` (1055) add `t.u.db` against every ranged attack from any non-rear side.
- **Fix**: add DB only for melee, thrown or muscle-powered attacks, from the front or the shield (left) side. If storm and praesidium shields are meant to stop guns as force fields, record that as a house rule instead (see Questions).
- **Impact**: medium for Custodes, storm-shield Terminators and Boarding Marines (+2 or +3 against every gun). The earlier review listed "DB counts against ranged attacks too" as correct; the book refutes it.

### 21. Missing by 1 hits the torso (medium, D)
- **Rule** (B552 note [1]): for eye, skull, face, groin, neck and vitals, "An attack that misses by 1 hits the torso instead."
- **Sim**: an aimed miss is a miss (1349, 1270); `planAttack` (996-1008) doesn't value the fallback.
- **Fix**: in melee and ranged, when `!r.ok && !r.fumble && r.margin === -1` at those locations, resolve a torso hit (defences still apply). In `planAttack`, add `(P3[eff+1] - P3[eff])` x torso expected injury.
- **Impact**: medium for elites; about 7-12% of aimed attacks at effective skill 10-12 miss by exactly 1.

### 22. Critical Head Blow Table (medium, A)
- **Rule** (B399, B556): skull, face and eye crits use the Head Blow Table: 3 max damage ignoring DR; 4-5 DR halved (round up) and any penetration is a major wound; 6-7 a face or skull hit becomes an eye hit (if impossible, as 4); 8 knocked off balance, Do Nothing next turn but may defend; 9-11 normal; 12-13 deafened or scarred; 14 drop weapon; 15 max; 16 double; 17 DR halved, rounded up; 18 triple.
- **Sim**: `CRIT` (833-849) is used for every location.
- **Fix**: add a head table in `applyHit` for skull, face and eye: 3 → max and DR 0; 4-5 → `ceil(DR/2)` and `critMajor`; 6-7 → eye if from front or side, else as 4; 8 → `doNothing` one turn; 14 → drop; 17 → `ceil(DR/2)`; 18 → x3.
- **Impact**: the tables reviewer rated it medium (elites aim at skull and eye and crit about 4.6%; rows 3 and 6-7 turn helmet bounces into kills), the advanced-combat reviewer small.

### 23. Aim (medium, B)
- **Rule** (B364): Aim gives +Acc, +1 at 2 seconds, +2 at 3+; bracing adds +1 (a pistol two-handed, a rifle on a bipod while prone, any gun on a wall or sandbag). "Active Defense: Any, but you automatically spoil your aim and lose all accumulated benefits." If injured while aiming, roll Will or lose the aim. B372: Acc plus aim bonuses can't exceed twice base Acc.
- **Sim**: `fireAt` (1224) and `rangedOptions` (1602) get +Acc +1/+2 right. `defend` never resets `aimTurns`, nor does injury; no brace bonus; no 2x Acc cap (Acc 1 aimed 3 turns gets +3, cap +2).
- **Fix**: `t.aimTurns = 0` when the model rolls a defence (ideally let an aimer skip defending weak attacks); Will roll in `injure` when `aimTurns > 0`; cap at `min(acc + extra, 2 * acc)`; +1 braced for a model beside a crate or barricade, a prone bipod gun, or a two-handed pistol.
- **Impact**: medium for sniper and heavy-weapon duels. Today Dodge and Drop keeps the aim.

### 24. Retreat details (medium, C)
- **Rule** (B377): +3 Dodge, +1 Block or Parry; +3 Parry with Boxing, Judo, Karate or a fencing skill. "You get your retreating bonus on all active defense rolls against all of his attacks until your next turn." No retreat while sitting or kneeling, stunned, or after moving faster than Basic Move; "You can retreat (by rolling) if you are lying down." Melee only.
- **Sim**: `canRetreat` (1029) requires `!t.retreated`, so later attacks from the same attacker get no bonus; forbids retreat when prone; doesn't check `kneel`; no fencing +3; `retreated` resets at the start of the second (2297).
- **Fix**: store `t.retreatFrom = att` and keep the bonus against that attacker; block retreat when kneeling, allow it when prone; +3 Parry for fencing-skill weapons (flag in `mkWeapon`).
- **Impact**: medium against multi-attack foes (Genestealers, Custodians, Carnifex).

### 25. Suppression fire (medium, E)
- **Rule** (B409): a zone two yards across (RoF 10+ can cover adjacent zones with 5+ shots each), plus a swath one yard either side of the line to the zone. All normal modifiers apply, including rapid-fire bonus and aim; "Your final effective skill cannot exceed 6 + your rapid-fire bonus". Random hit location.
- **Sim**: `suppressHit` (2166) uses `Math.min(6, eff) + rapidBonus + SM - prone 2 - cover 2`, so the cap comes first: a skill-14 gunner against a prone target in cover gets 2 + RB, where RAW gives 6 + RB. An SM+ target can beat the cap. The zone is 7 hexes with no swath; hits are capped at 3 (2169).
- **Fix**: `lvl = Math.min(6 + rb, eff + rb + sm + posture + cover)`; hits `Math.min(z.shots, 1 + margin/Rcl)`; optionally narrow the zone and add the swath.
- **Impact**: medium; suppression is much weaker than RAW against prone and covered targets.

### 26. Cover: penalty and cover DR together (medium, E)
- **Rule** (B407, B548): the shooter chooses one: target an exposed location at its normal penalty (extra -2 only if half exposed); or roll random location with no penalty, where hits on covered locations strike the cover (half-exposed locations: cover on 4-6 on 1d); or shoot through the cover at -2 with cover DR added. A shooter firing a two-handed weapon from cover exposes both arms and hands and half the torso and vitals.
- **Sim**: 1244 gives -2 to every ranged attack on a model in cover, and 855-859 also route leg, foot and groin hits through cover DR, so a random-location shooter pays both; an aimed skull shot also pays -2.
- **Fix**: random location: no -2, covered locations hit cover (half-exposed torso and vitals of a two-handed firer: 4-6 on 1d). Aimed at an exposed location: normal penalty, -2 only if half exposed. Aimed at a covered location: -2 plus cover DR. The DR values stay the user's.
- **Impact**: medium; both reviewers who covered it note that cover is roughly twice as protective as RAW for non-elites, and crate firefights are the core of facility battles.

### 27. Hitting the wrong target (medium, E)
- **Rule** (B389): "your attack roll against each possible target is the same: a flat 9 or the number you would have had to roll to hit him on purpose, whichever is worse." Roll closest first until one is hit or defends. "Anyone (friend or foe) gets the same defense against this attack that he would have had." -4 per figure in the way (confirmed). A dodged projectile goes past and may hit someone beyond. B392: striking into a close combat is -2, misses may hit others there at the same rule.
- **Sim**: `stray` (1205-1213) rolls `9 + SM - (prone ? 2 : 0)`, so a big bystander is easier than 9 and range is ignored; no defence; dodged shots never stray; a burst strays once, only if it misses entirely. "Beside the target" candidates (1206) aren't RAW but stand in fairly for B392.
- **Fix**: `lvl = Math.min(9, skill against c with range, SM, posture, cover)`, then `defend(c, m, false)`; after a successful dodge, check figures beyond the target on the line.
- **Impact**: medium; friendly-fire rates into melee. House-rule note: RAW says a kneeling figure is in the way if shooter or target also kneels; the house rule removes that.

### 28. Fragments (medium, E)
- **Rule** (B414): everyone within 5 x dice of fragmentation is attacked at skill 15, modified only by range, target posture and SM. "A hit is automatic if the explosive attack actually strikes the target." "For every three points by which the attack roll succeeds, one additional fragment strikes the target." Random location; a covered location hits the cover. B551: kneeling is -2 to be hit, like prone.
- **Sim**: `explosion` (934-942) gives at most one fragment each; the struck model rolls too; prone -2 but not kneeling; cover judged from the thrower's hex (`coverAt(t.h, att.h)`).
- **Fix**: `n = r.ok ? 1 + Math.floor(r.margin / 3) : 0`, at least 1 for the struck model; -2 for prone or kneeling; cover judged from the blast point.
- **Impact**: medium; a frag grenade at 1-2 yards should land 2-3 fragments, not 1.

### 29. Scatter distance (medium, E)
- **Rule** (B414): a miss lands "a number of yards equal to your margin of failure, to a maximum of half the distance to the target (round up). If the enemy dodges, use his margin of success". Direction 1d, 60 degrees per step from the thrower's facing.
- **Sim**: a missed grenade lands exactly 2 yards off (2098); a dodged one 1 yard (2082); a missed or dodged `ex` shot 1 hex (1273). Direction is uniform, which matches 1d.
- **Fix**: `dist = Math.min(Math.ceil(d/2), -r.margin)` for a miss, the dodge margin for a dodge.
- **Impact**: medium; bad throws land close today, good dodges don't carry the grenade away.

### 30. Large-area injury for cones and explosions (medium, E)
- **Rule** (B398, B400): cones and area effects make hit location irrelevant; "Any damage described as being 'area effect' or 'cone', and any external explosion, inflicts large-area injury": treat as a torso hit with DR = average of torso DR and the least protected exposed location, rounded up.
- **Sim**: cone hits in `fireAt` take `planAttack`/`hitLocation()` (1257, 1288), so a flamer can roll skull x4 or be aimed; a direct `ex` hit takes a location (1288); collateral (931), `blast` (1296) and grenades (2092) use torso DR only.
- **Fix**: for cones, `blast` and all collateral, loc "torso" with `DR = ceil((torsoDR + minExposedDR) / 2)` (exposed = all locations, or those not behind cover). Consider the same for the model struck directly by an `ex` weapon (arguable, see Questions).
- **Impact**: medium; Guardsmen with flak torsos and open faces take more from blasts, and flamers stop rolling x4 skull hits.

### 31. Cone shape (medium, E)
- **Rule** (B413): one attack roll; a cone is one yard wide at the origin and widens at max width / max range; it affects everyone in the area, except those completely screened; targets may dodge.
- **Sim**: 1250 takes everyone within `cone/2` hexes of the target, each with its own attack roll; nobody between shooter and target, or beyond, is caught. Friends are included (earlier item 28 fixed).
- **Fix**: a wedge from the shooter, `width(r) = max(1, maxWidth * r / maxRange)`, to max range; one roll for the centre.
- **Impact**: medium for flamer fights.

### 32. Malfunction types (medium, F)
- **Rule** (B407-408): on a malfunction roll 3d: 3-4 mechanical or electrical problem (out for the fight); 5-8 and 12-14 misfire (a Ready and a roll to diagnose, then 3 Readies and Armoury+2 per attempt); 9-11 stoppage, "the weapon fires one shot, then jams" (3 Readies and Armoury or IQ-based weapon skill -4 per attempt); 15-18 mechanical problem (TL5+ doesn't explode). Beam weapons: stoppage counts as mechanical problem. Grenades: misfire is a dud.
- **Sim**: 1185 jams for 1d seconds and fires nothing. The trigger (unmodified roll >= Malf, 1180-1183) is correct. 30 weapon lines have Malf 12-16.
- **Fix**: roll the table; on 9-11 fire one shot then jam; clearing is 3 Readies per attempt at skill; 3-4 and 15-18 set `gunBroken`; beam stoppage → broken.
- **Impact**: medium for Ork shooting.

### 33. Moving through friends (medium, B)
- **Rule** (B368): "You can always move through space occupied by your allies in combat." B385, B387: +1 movement point per obstruction.
- **Sim**: `taken()` treats every occupied hex as impassable in `stepToward`, `engagePath` and `followPath`, so mobs route round their own front rank.
- **Fix**: let pathing enter friendly hexes at cost 2, without ending there.
- **Impact**: medium for large mobs. It may be a deliberate speed choice (see Questions).

### 34. Half damage "at or beyond" 1/2D (small, E)
- **Rule** (B378): "If the target is at or beyond 1/2D range, divide basic damage by 2."
- **Sim**: `fireAt` (1252) and `suppressHit` (2172) use `d > w.range.half`.
- **Fix**: `>=`.
- **Impact**: small.

### 35. Armour divisor DR floor (small, D)
- **Rule** (B378): "Round DR down. Minimum DR is 0." With fractional divisors, treat DR 0 as DR 1.
- **Sim**: `applyHit` (864) `Math.max(1, Math.floor(dr / div))`; `expInj` (956) uses a plain floor, so estimate and roll disagree.
- **Fix**: `Math.floor(dr / div)`; for `div < 1`, DR 0 counts as 1.
- **Impact**: small.

### 36. Ranged attacks failing by 10+ (small, A)
- **Rule** (B382): "A melee attack (but not a ranged attack) or defense roll that fails by 10 or more is also a critical miss."
- **Sim**: `check` flags any 10+ failure as `fumble`, and `jamCheck` (1177) then jams the gun.
- **Fix**: for ranged attacks, fumble only on 18, or 17 at skill 15 or less.
- **Impact**: small; the AI rarely shoots below 8.

### 37. Critical Hit Table rows 14 and 8 (small, A)
- **Rule** (B556): "13, 14 – If any damage penetrates DR, treat it as if it were a major wound." Row 8: double shock (max -8), and a limb or extremity hit is crippled only as a "funny-bone" injury lasting (16 - HT) seconds, minimum 2, unless the injury would cripple anyway.
- **Sim**: `CRIT` (834, 848) treats 14 as double shock; row 8 calls `cripple()` permanently plus a major-wound roll (805-812). `docs/simulator.md:66` repeats the 8-or-14 error.
- **Fix**: `if (crit === 7 || crit === 13 || crit === 14) critMajor; if (crit === 8) critShock;`. Row 8 limbs: a `funnyBone` timer of `max(2, 16 - HT)` seconds, no major-wound roll. Two small notes: rows 6 and 15 overwrite a Strong or Mighty Blows bonus with the weapon maximum (add the bonus back); the Weak Point fallback (865-866) recomputes DR without the row 4/17 halving.
- **Impact**: small overall, moderate in crit-heavy fights; a row-8 arm crit now permanently one-hands a Marine where RAW lasts 2 seconds.

### 38. Rule of 16 (small, A)
- **Rule** (B349): for supernatural attacks that allow a resistance roll against a living or sapient subject, "the attacker's effective skill cannot exceed the higher of 16 and the defender's actual resistance."
- **Sim**: the Malediction contest (1227-1237) is correctly a resistance roll but `plan.lvl` isn't capped; the Farseer's Executioner is 17 (`data/sim/powers.yaml:116`). The planner uses `resist - 2` as a defence (986), an approximation.
- **Fix**: `lvl = Math.min(lvl, Math.max(16, resist))`.
- **Impact**: small; only the Farseer is above 16.

### 39. Shock rounding (small, D)
- **Rule** (B419): with 20+ HP, "-1 per HP/10 of injury (drop all fractions). Thus ... 20-29 HP, it's -1 per 2 HP lost". B381: shock totals the HP lost this turn, max -4.
- **Sim**: `injure` (802) uses `Math.floor(inj / (HP / 10))` per hit. With 25 HP, 4 injury gives -1 where RAW gives -2 (the combat reviewer's point is the per-hit floor: two 4-point hits on 50 HP give 0, RAW -1).
- **Fix**: accumulate injury this turn and use `Math.floor(total / Math.floor(HP / 10))`.
- **Impact**: small. The two reviewers found different halves of the same rounding problem; both apply.

### 40. Double shock cap and groin (small, D)
- **Rule** (B556 row 8): double shock, max -8. B399, B420: human males hit in the groin take double shock from crushing (max -8) and -5 to knockdown.
- **Sim**: 802 stores up to 8, but `skillPen` (706) reads `Math.min(4, m.shock)`. No groin case at 810.
- **Fix**: store the cap with the shock (`Math.min(m.shockCap || 4, m.shock)`); add groin -5 knockdown and doubled crushing shock for male humanoids.
- **Impact**: small.

### 41. Crippled leg halves Dodge (small, D)
- **Rule** (B421): "Leg: You fall down! You can still fight if you assume a sitting or lying posture." Nothing about Dodge.
- **Sim**: 733 sets `halfDodge`; prone already gives -3.
- **Fix**: drop `halfDodge` for crippled legs in standard mode.
- **Impact**: small.

### 42. Mortal wounds (small, D)
- **Rule** (B419, B423): a failed death check kills, but "If you fail by only 1 or 2, you're dying, but not dead". A mortally wounded model is incapacitated; a later failed death roll kills.
- **Sim**: 816-819 kill on any failure.
- **Fix**: `if (r.margin >= -2) incapacitate(t, "is mortally wounded")`, else kill. Decide whether Necron reanimation should trigger from it (see Questions).
- **Impact**: small; it changes the dead and out tallies.

### 43. Eye hits (small, D)
- **Rule** (B552 [2]): only impaling, piercing and tight-beam burning can target the eye; "Otherwise, treat as skull, but without the extra DR!" B399, B421: injury over HP/10 blinds the eye.
- **Sim**: a random eye hit from cr or cut gets the base multiplier because `woundMult` (390) applies x4 only to pi, imp and burn; knockdown still uses -10 (810). Blinding isn't modelled.
- **Fix**: `if (loc === "eye" && brain) return type === "tox" ? 1 : 4;`. Blinding (One Eye: -1 ranged, -1 defence on that side) is optional.
- **Impact**: small.

### 44. Vitals and shield-arm restrictions (small, D)
- **Rule** (B398): vitals take x3 for impaling and piercing, x2 for tight-beam burning; "Other attacks cannot target the vitals." B552 [6]: -4 to hit the shield arm, -8 the shield hand.
- **Sim**: no vitals filter at 990 (only the eye has one); no shield-arm penalty.
- **Fix**: filter vitals like the eye; add the shield-arm penalty if shields are aimed at.
- **Impact**: small; the AI gains nothing from non-piercing vitals hits anyway.

### 45. No Blood (small, D)
- **Rule** (B61): No Blood means you don't bleed and are unaffected by blood-borne toxins. Unliving doesn't include it; Diffuse does.
- **Sim**: bleeding skips `flags.unliving` (2347); `combat_flags` never sets `noblood`. Necrons and the Gun Drone come out right by coincidence; the Combat Servitor (`Injury Tolerance (No Blood)`) bleeds.
- **Fix**: detect "no blood" in Injury Tolerance keywords and modifier names; skip bleeding on `noblood || diffuse`. Arguably blood-agent tox follow-ups (splinter, Hellfire) do nothing to No Blood targets.
- **Impact**: small.

### 46. Blunt trauma through cover (small, D)
- **Rule** (B379): "If you layer other DR over flexible DR, only damage that penetrates the outer layer can inflict blunt trauma."
- **Sim**: 876-878 are right for armour, but `armDR` includes cover DR (860), so a hit stopped by a crate can cause blunt trauma.
- **Fix**: skip blunt trauma when `raw <= coverDR`.
- **Impact**: negligible.

### 47. All-Out Attack movement (small, B)
- **Rule** (B365): up to half Move, forward only. B385: "up to two hexes or ... half your Move (round up), whichever is more."
- **Sim**: `approachOptions` (1901, 1904) uses `Math.floor(mv / 2)`.
- **Fix**: `Math.max(2, Math.ceil(mv / 2))` (Move 5 → 3, Move 3 → 2).
- **Impact**: small to medium; it changes how often chargers reach with All-Out Attack.

### 48. Step size (small, B)
- **Rule** (B368): "You may step a distance equal to 1/10 your Move, but never less than one yard. Round all fractions up." Retreat distance is the same.
- **Sim**: the step-strike branch (1873) triggers only for a 1-hex path; retreat is 1 hex.
- **Fix**: `step = Math.max(1, Math.ceil(moveOf(m) / 10))`, `route.path.length <= step`.
- **Impact**: small; only Move 11+.

### 49. Turn order (small, B)
- **Rule** (B363): the sequence "is set at the start of the fight and does not change during combat."
- **Sim**: `order` (2304) sorts with `(R() - 0.5)` as the tie-breaker each second, an inconsistent comparator.
- **Fix**: a fixed random `m.init` at deployment; sort by `(speed, dx, init)`.
- **Impact**: small.

### 50. Below 1/3 FP (small, B)
- **Rule** (B426, B354): "Halve your Move, Dodge, and ST (round up). This does not affect ST-based quantities, such as HP and damage."
- **Sim**: not modelled; `weak` checks HP only.
- **Fix**: `weak(m) || m.fp < m.u.fp / 3` for Move and Dodge; halve ST for contests, grapples and slams, not damage.
- **Impact**: small; Feverish Defense and Mighty Blows stop near 1/3, so it's mostly psykers.

### 51. 0 FP (small, B)
- **Rule** (B426): at 0 FP or less each further FP lost also costs 1 HP; to act, roll Will before each maneuver other than Do Nothing; on a failure "you collapse, incapacitated, and can do nothing until you recover to positive FP"; on a critical failure an HT roll against a heart attack; at -1 x FP unconscious.
- **Sim**: 2312: `m.fp <= 0 && !check(HT)` loses one turn; FP spent below 0 (Perils, 1311) costs no HP; no -FP unconsciousness.
- **Fix**: `check(will)`, `incapacitate` on failure; `injure(m, m, 1, "torso")` per FP below 0; incapacitate at `fp <= -u.fp`.
- **Impact**: small to medium (psykers). Confirms the earlier review's guess of Will.

### 52. Bare-handed parry against weapons (small, C)
- **Rule** (B377): "You are at -3 to parry weapons, unless the attack is a thrust or you are using Judo or Karate." A failed bare-handed parry against a weapon may let the attacker hit the arm.
- **Sim**: the Punch fallback parries at `floor(level/2) + 3` (`parryOf`, 326) with no -3.
- **Fix**: in `defend`, -3 when parrying unarmed against a weapon, unless the attack is `imp` or thrust-based or the defender knows Judo or Karate.
- **Impact**: small (Necron Warriors, Fire Warriors, Kabalites charged by blades).

### 53. Parrying an unarmed attack with a weapon (small, C)
- **Rule** (B376): "Immediately roll against your skill with the weapon you used to parry. This roll is at -4 if your attacker used Judo or Karate. If you succeed, your parry struck the attacker's limb squarely."
- **Sim**: `cutsArm` (2233) applies the damage with no roll, and only for Punch and grabs, not natural weapons such as claws.
- **Fix**: `if (!check(w.level - skillPen(t)).ok) return;` before the damage; consider natural-weapon attackers.
- **Impact**: small.

### 54. Per-turn defence limits (small, C)
- **Rule**: one retreat until after your next turn (B377), one block per turn (B375), multiple-parry penalties reset between turns (B376); "your turn" runs from one maneuver to the next (B363).
- **Sim**: `parries`, `retreated` and `blocked` reset for everyone at the top of the second (2297), so an early actor can retreat or block twice within one of its turns.
- **Fix**: reset them in `act(m)`.
- **Impact**: small.

### 55. Multiple parries with fencing weapons (small, C)
- **Rule** (B376): each parry after the first is -4 cumulative; -2 with a fencing weapon or Trained by a Master or Weapon Master; -1 if both.
- **Sim**: `master ? 2 : 4` (1039, 1069); fencing weapons aren't recognised. The site data has many Rapier, Saber and Smallsword lines.
- **Fix**: flag fencing skills in `mkWeapon`; -2 for fencing, -1 for fencing plus master. Same flag as the +3 retreat parry in #24.
- **Impact**: small.

### 56. Enhanced Parry and Weapon Master specialisation (small, C)
- **Rule** (B51): Enhanced Parry is for bare hands, one Melee Weapon skill, or all parries. B99: Weapon Master covers a class of weapons.
- **Sim**: `flags.enhParry` is added to any melee parry (326); the Exarch, Incubus, Autarch and Succubus take the one-skill version. Weapon Master likewise (earlier review item 13).
- **Fix**: keep the specialisation in `combat_flags` and apply only when the weapon's skill matches.
- **Impact**: small with default loadouts.

### 57. Explosion collateral radius (small, E)
- **Rule** (B414): collateral reaches "everything within (2 x dice of damage) yards" (6dx2 → 24 yards); damage / (3 x yards), no armour divisor, large-area DR.
- **Sim**: 926 cuts off at `10 * level` yards; for 6dx4 plasma and melta or 6dx3-6dx6 missiles RAW is 36-72 yards.
- **Fix**: `if (d > 2 * w.dmg.n * (w.dmg.mult || 1) * lv) continue;`
- **Impact**: small; 2-3 points at 11+ yards.

### 58. Rapid-fire bonus above 99 shots (small, E)
- **Rule** (B373): 50-99 shots +6, then +1 per doubling (100-199 +7, 200-399 +8, ...).
- **Sim**: `rapidBonus` (114) returns 7 for anything over 99; suppression only.
- **Fix**: continue the doubling.
- **Impact**: negligible.

### 59. Explosive bursts (small, E)
- **Rule** (B414): each explosion resolves its own blast.
- **Sim**: 1289-1290 call `explosion` only for `k === 0`.
- **Fix**: explode each hitting round.
- **Impact**: small; few `ex` weapons have RoF > 1.

### 60. Target speed for human-speed targets (small, E)
- **Rule** (B373): up to Move 10 "you may simplify the calculation by using just a range modifier and neglecting speed ... Assume that the target's ability to take a dodge defense adequately represents the effects of movement."
- **Sim**: `fireAt` (1242) always adds `target.steps`, and the target still dodges. The tables and advantages reviewers treated adding speed as correct (B550, B52); the combat reviewer points out that it's allowed but the book recommends dropping it below Move 10.
- **Fix** (optional): add speed only when `steps > 10` or the target flies.
- **Impact**: small to medium; charging mobs take about 1 point less fire on the way in.

### 61. Posture penalty by location (small, E)
- **Rule** (B548): a crouching, kneeling, sitting or lying target gives "an extra -2 to hit torso, groin, or legs". B551 †: against lying or crawling targets at the same or lower elevation, random hits treat the torso as half exposed (-2) and can't hit groin, legs or feet.
- **Sim**: -2 on every shot at a prone or kneeling model whatever the location (1244, 1443, 2167).
- **Fix**: -2 only for torso, groin, legs, feet and vitals; for random-location fire at prone targets, remap groin, leg and foot hits to torso.
- **Impact**: small; an elite aiming at a kneeling Guardsman's skull shouldn't take it.

### 62. Melee maximum ST (small, F)
- **Rule** (B270): "your effective ST for damage purposes cannot exceed triple the weapon's minimum ST."
- **Sim**: not modelled.
- **Fix**: `dmgST = stDamage(Math.min(strikeST, 3 * minST))` for thr/sw lines.
- **Impact**: small; knives (ST 6 → 18) in Marine or Nob hands.

### 63. Damage table above ST 70 (small, F)
- **Rule** (B16): 75 8d+2/10d+2, 80 9d/11d, 85 9d+2/11d+2, 90 10d/12d, 95 10d+2/12d+2, 100 11d/13d; +1d per full 10 ST above 100.
- **Sim**: `DMG` (188-196) and `build_site.py:230-239` stop at 70. Rows 1-70 all match.
- **Fix**: add the rows.
- **Impact**: none today (highest template ST 60, Carnifex); Striking ST from armour could pass 74.

### 64. Throwing skill and distance (small, F)
- **Rule** (B356): Throwing at DX+1 adds +1 to ST for distance, DX+2 or better +2. Grenades use Throwing.
- **Sim**: distance = `liftST * modifier`, no skill bonus. The THROW table itself is right up to ratio 2.0 (313-318).
- **Fix**: `ST_throw = liftST + (throwLvl >= dx + 2 ? 2 : throwLvl >= dx + 1 ? 1 : 0)`.
- **Impact**: small (about 3.5 yd for a Marine's 1-lb grenade). Whether Lifting ST counts for throwing wasn't settled on the pages read.

### 65. Lifting ST in grappling (small, G)
- **Rule** (B65): "Lifting ST also adds to ST in situations where you can apply slow, steady pressure (grappling, choking, ...)", but not to HP.
- **Sim**: grab, takedown, pin and break free use base `u.st` (1928-1931, 2225, 2252-2267), leaving out `lifting_st` and armour `arm.lifting` (servo and "ST +N"), which feed `liftST` at 247.
- **Fix**: store `u.liftST` in `buildUnit`; use it in grapple contests and `gripST`.
- **Impact**: small to medium; power armour and battlesuits wrestle at unarmoured ST today.

### 66. Grappling a much stronger foe (small, G)
- **Rule** (B370): "If you grapple a foe of more than twice your ST, you do not prevent him from moving away – you're just extra encumbrance for him!"
- **Sim**: not modelled; a Gretchin holds a Carnifex.
- **Fix**: grips from models with less than half the target's ST don't stop its movement.
- **Impact**: small.

### 67. All-Out Attack (Strong) scope (small, B)
- **Rule** (B365): "This only applies to melee attacks doing ST-based thrust or swing damage, not to weapons such as force swords."
- **Sim**: `strike` (1358) and `boosted` (2274) apply it to every melee line, including melee psychic powers.
- **Fix**: allow Strong and Mighty Blows only when the damage is `thr`/`sw`-based or a natural ST-based attack.
- **Impact**: small.

### 68. Evaluate (small, B)
- **Rule** (B364-365): +1 per consecutive turn, max +3, to the next attack on that foe; step; any defence.
- **Sim**: `strike` reads and clears `m.evaluate` (1338, 1362) but nothing sets it.
- **Fix**: an `evaluate@t` option that sets `{t, n: min(3, n+1)}`; clear it on any other turn.
- **Impact**: small; still open from the earlier review (item 23). Alternatively drop it from `docs/simulator.md`.

### 69. Feint (small, B)
- **Rule** (B365): the penalty applies to "your next attack" next turn only (both attacks of All-Out Attack Double); it lapses if you can't attack that foe next turn. The defender may resist with DX, Shield or Cloak.
- **Sim**: `strike` (1343) applies `m.feint` to every blow in the loop; it's cleared only after a strike, so it can carry over turns; the defender uses `max(melee.level, dx)` (1978), ignoring Shield and `skillPen`.
- **Fix**: apply to the first blow only (both for Double); clear it in `act` unless last turn was the Feint; allow Shield skill.
- **Impact**: small. The success-roll reviewer asked whether B348's margin of victory (adding the loser's margin of failure) should apply; the combat reviewer read B365 and found the sim's margin handling correct.

### 70. Flurry of Blows (small, B)
- **Rule** (B357): with an Attack maneuver, 1 FP per attack halves the Rapid Strike penalty; not with Mighty Blows.
- **Sim**: Rapid Strike only at -6 or -3 for masters (1959-1963), and only when `lvl - rp >= 10`.
- **Fix**: `rapid-flurry@t` at -3 (-2 for a master) for 2 FP.
- **Impact**: small to medium (success-roll reviewer); the combat reviewer thought leaving it out is fine.

### 71. Critical failure with extra effort (small, B)
- **Rule** (B357): a critical failure while using extra effort causes 1 HP of injury to the arm (attack, block, parry) or leg (dodge, kick); "DR does not protect you".
- **Sim**: not modelled (`feverish`, 2108-2114; Mighty Blows).
- **Fix**: on a fumbled Feverish defence or Mighty Blow, 1 HP to the limb, ignoring DR.
- **Impact**: small.

### 72. Criticals on defence rolls (small, A)
- **Rule** (B381): a critical success on a defence against a melee attack sends the attacker to the Critical Miss Table. B382: a critically failed parry rolls on the Critical Miss Table; a critically failed Dodge falls prone; a critically failed Block loses the shield until readied.
- **Sim**: `defend` (1076) returns only success or failure.
- **Fix**: return `crit` and `fumble`; call `critMiss(m, w)` on a melee defence crit; on a fumble Dodge → prone, Block → `blockLost`, parry → `critMiss(t, t.u.melee)`.
- **Impact**: small to medium; good defenders punish mobs.

### 73. Critical Miss Table rows (small, A)
- **Rule** (B556-557): 3, 4, 17, 18 break the weapon, but solid crushing, magic, firearms and fine or very fine weapons roll again and break only on a second "broken", otherwise drop. 5 and 6: impaling or piercing melee attacks and ranged attacks reroll, hitting yourself only on a second 5 or 6. 15: "You strain your shoulder! Your weapon arm is 'crippled'... you cannot use it, either to attack or defend, for 30 minutes." 16 (ranged) becomes 7.
- **Sim**: `critMiss` (1318-1330) always breaks, always hits itself, and makes 15 off balance (1326). Slams, grabs and shoves (2185, 2203, 2244) never critically miss. Rows 7, 8, 9-11, 12, 13, 14, 16 are right for melee.
- **Fix**: row 15 → the weapon is out of the fight (`meleeBroken` or `armStrained`, not an arm lost for injury); a breakage-resistant flag and reroll; reroll 5/6 for pi and imp weapons.
- **Impact**: small to medium; row 15 is currently the mildest result and should be one of the harshest.

### 74. Unarmed Critical Miss Table (small, A)
- **Rule** (B557): for bites, claws, kicks, punches, slams and so on: 3 and 18 knock yourself out; 4 and 17 strain the limb (1 HP, unusable 30 min); 5 and 16 hit a solid object for your own thrust crushing; 6 half that (claws and teeth break, -1 damage); 7 and 14 stumble, foe now behind you; 8 fall down; 9-11 lose balance; 12 DX roll or fall; 13 drop guard (-2 defences, Feint and Evaluate count double); 15 tear a muscle (1d-3 injury).
- **Sim**: `critMiss` with `nat` (1321-1329) uses the armed table with break and drop rows mapped to off balance, and 5/6 use the weapon's own damage.
- **Fix**: an `UNARMED_MISS` branch with those rows.
- **Impact**: small (Tyranid and Genestealer claw fights).

### 75. Shadow in the Warp failure and mental stun (small, A)
- **Rule** (B360-361): a failed Fright Check rolls 3d + margin of failure: 4-5 stunned one second then automatic recovery; 6-7 stunned, recover on unmodified Will; 8-9 recover on Will with the Fright Check modifiers; 10 and 11 add 1d and 2d seconds of stun; 12 retching; 13 a quirk; 14-15 lose 1d FP plus 1d s stun; 16 1d s stun plus quirk; 17+ faint, panic, coma and so on (out of the fight). B364 and B420: mental stun is shaken off with IQ; B43: Combat Reflexes gives +6 to recover from mental stun.
- **Sim**: failure sets `m.stunned` (2318) and recovery is an HT roll (2313); Perils stun (1315) is the same.
- **Fix**: roll the table; mark mental stun; recover on Will per the table (or IQ for other mental stun), +6 with Combat Reflexes; 17+ incapacitates for the battle.
- **Impact**: small to medium, psyker against synapse fights only. Reviewers disagree on the recovery roll: the success-roll reviewer follows the Fright Check Table (Will), the other three cite B364/B420 (IQ). The table is the more specific rule for a Fright Check stun; IQ applies to other mental stun.

### 76. Point-blank shots: no block, no retreat (small, C)
- **Rule** (B375): "You cannot block bullets or beam weapons." B377: retreat is against melee attacks. B376: you may parry the gun if the shooter is within your weapon's reach, with no stated penalty.
- **Sim**: `fireAt` (1281-1284) calls `defend(t, m, true, ...)` at 1 yard, allowing Block (1070) and the retreat bonus.
- **Fix**: a `pointBlank` mode in `defend`: Dodge and parry the gun only, no retreat or block; allow the parry whenever the shooter is within the defender's reach.
- **Impact**: small to medium (storm-shield Marines against Ork Sluggas).

### 77. Parrying heavy weapons (small, C)
- **Rule** (B376): "you cannot parry a weapon heavier than your Basic Lift – or twice BL, if using a two-handed weapon". An unarmed strike counts as ST/10 lb (full ST for a slam). A weapon parrying 3x its weight may break.
- **Sim**: not modelled.
- **Fix**: compare attacking weight to the defender's BL (x2 two-handed); no parry if heavier.
- **Impact**: small to medium (Carnifex and Nob slams against Guardsmen).

### 78. Thrown weapons can be blocked or parried (small, C)
- **Rule** (B373): the target may block or parry a thrown weapon instead of dodging; B376: parry at -1, or -2 for 1 lb or less.
- **Sim**: grenades are dodged only (2079).
- **Fix**: allow block and parry.
- **Impact**: negligible; a parried grenade still goes off nearby.

### 79. Knockback (small, D)
- **Rule** (B378): crushing, and cutting that fails to penetrate, knock back 1 yard per full (ST - 2) of basic damage; the target rolls "the highest of DX, Acrobatics, or Judo ... -1 per yard after the first. Perfect Balance ... +4." Nothing limits it to melee. Knocking into something solid is a collision (B430, unread).
- **Sim**: `applyHit` (873), `knockback` (904-914): type, penetration and ST - 2 are right, but only for melee (`!ranged`), DX only, no Perfect Balance.
- **Fix**: drop `!ranged` for `cr`; roll `max(dx, Acrobatics, Judo) + (Perfect Balance ? 4 : 0) - (kb - 1)`.
- **Impact**: small. Explosion knockback (earlier review, "B415") isn't on B413-415.

### 80. Follow-up damage (small, D)
- **Rule** (B381): if the carrier fails to penetrate, "an explosive projectile would still do damage ... but the DR that stopped the primary damage would protect against it." B105: DR is ignored once the carrier penetrates.
- **Sim**: `applyHit` returns at 880 when `pen <= 0`, losing the follow-up (documented). Flamer "per turn while ablaze" and the Liquifier "per turn while gel clings" lines get one roll, only on penetration (888-896). Follow-up wounding uses torso for every non-limb hit (892).
- **Fix**: on `pen <= 0` with an `ex` follow-up, apply it as an external hit against the same DR. Burning each turn belongs to B433-434, which nobody read.
- **Impact**: small.

### 81. Injury Tolerance handling (small, D)
- **Rule**: B420: No Brain means skull, face and eye injuries cause knockdown only as major wounds, "and even then, the roll is at no special penalty"; No Vitals the same for vitals and groin; Homogeneous and Diffuse include both. B61: No Brain treats skull and eye as face. B400: Unliving keeps normal eye, skull and vitals effects; only No Vitals makes vitals a torso hit. B380: Diffuse caps injury at 1 HP (impaling, piercing) or 2 HP (other), except area, cone and explosion attacks.
- **Sim**: 810 applies -10 and -5 whatever the flags (Orks have No Brain). No Brain removes x4 but keeps skull DR +2 (866). `woundMult` (391) maps vitals to torso for `unliving`, so Electro-Priests and Gun Drones (Unliving without No Vitals) lose vitals x3. In standard HP, Diffuse has no cap and isn't in the brain and vitals tests (388-391); only Fractional Health caps it (742).
- **Fix**: `nb = nobrain || homogenous || diffuse`, `nv = novitals || homogenous || diffuse`; no location knockdown penalty under `nb`/`nv`; treat skull as face for DR under `nb`; remove `unliving` from 391 and set `novitals` from the Necron trait modifiers in `combat_flags` (`build_site.py:297-300`); add the Diffuse cap and crippling immunity.
- **Impact**: small to medium; an Ork with a major skull wound should roll HT+0, not HT-10. No template has Diffuse today.

### 82. Crippled arm (small, D)
- **Rule** (B421): a crippled hand or arm drops what it holds (DX roll if two hands held it); it can't hold anything or block. No general skill penalty.
- **Sim**: `cripple` (729-731) increments `armsLost`; `skillPen` (706) gives -4 to every attack, ranged included; nothing is dropped; two-handed weapons stay usable (`armsLost < 2`, 1038, 1068, 1383). `docs/simulator.md` claims the drop. Both arms crippled → incapacitated (730) is a harmless simplification.
- **Fix**: pick which arm; a crippled weapon arm drops the weapon, re-Ready in the other hand at off-hand -4 (none with Ambidexterity); two-handed weapons unusable unless ST allows one hand; the off arm affects only two-handed weapons and shields.
- **Impact**: small to medium.

### 83. Bleeding (small, D)
- **Rule** (B420, optional): each minute roll HT at -1 per 5 HP lost; failure 1 HP, critical failure 3 HP; critical success or three straight successes stop it. Cutting, impaling and piercing bleed; crushing generally doesn't.
- **Sim**: 2347: flat HT, 1 HP, no crits, never stops, every wound type bleeds.
- **Fix**: `check(HT - Math.floor((HP - hp) / 5))`, crit rules, stop after three successes, skip crushing and burning wounds.
- **Impact**: small (only fights over 60 s).

### 84. Slam damage and knockdown (small, G)
- **Rule** (B371): dice = HP x velocity / 100; below 1d, fractions up to 0.25 are 1d-3, up to 0.5 1d-2, more 1d-1; otherwise round 0.5+ up to a full die. If your damage equals or exceeds his, he rolls DX or falls; twice his, he falls automatically; if he rolls twice yours, you fall. Slams use knockdown, not knockback.
- **Sim**: `slamDice` (2177) turns fractions into adds (1.4 → 1d+1, 1.6 → 1d+2) and below 1d gives 1d-4 at 0.25. `slam` (2192-2195): a tie gives no roll; `b > a` makes the slammer roll DX; the hit goes through `applyHit` as melee `cr`, causing knockback (873).
- **Fix**: `n >= 1 ? {n: n % 1 >= 0.5 ? ceil(n) : floor(n), add: 0} : {n: 1, add: n <= 0.25 ? -3 : n <= 0.5 ? -2 : -1}`; `if (a >= 2*b) fall(t); else if (b >= 2*a) fall(m); else if (a >= b && !DX) fall(t);`; skip knockback for slams.
- **Impact**: small.

### 85. Takedown and pin (small, G)
- **Rule** (B370): a lost takedown means "you suffer the same effects!" (a tie does nothing). Pin is a Regular Contest of ST, +3 per SM difference, +3 to the side with more free hands.
- **Sim**: `wrestle` (2248-2259): a lost takedown does nothing to the attacker; pin has no SM or hands bonus.
- **Fix**: on a lost takedown the lead grappler falls prone and loses its grip; add +3 per SM difference.
- **Impact**: small to medium. The pooled-ST formula is a documented sim rule.

### 86. Hurting yourself (small, G)
- **Rule** (B379): striking unarmed at DR 3+ does 1 point of crushing to yourself per 5 points of basic damage, up to the target's DR.
- **Sim**: not modelled.
- **Fix**: apply it for punches and kicks.
- **Impact**: small (punching Marines).

### 87. Grenade readiness (small, F)
- **Rule** (B410): a Ready to grab the grenade, then "a second Ready maneuver" to arm it, then throw. B43: Combat Reflexes gives +1 to Fast-Draw.
- **Sim**: one Ready (`grenadeReady`, 1692) then the throw; `docs/simulator.md` says "a Ready to prime". `fastDraw` (~356) reads only the skill.
- **Fix**: two states (drawn, armed), or value a 2-turn lead (`GAMMA^2`); Fast-Draw (Grenade) could skip the first; +1 Fast-Draw with Combat Reflexes.
- **Impact**: small to medium.

### 88. Bipod and mounted weapons (small, F)
- **Rule** (B270): B: "When firing from a prone position using the bipod, treat the weapon as if it were braced and reduce its ST requirement to 2/3 of the listed value (round up)." M: ignore ST and Bulk only when fired from the mount.
- **Sim**: `/[MB]/` → `minST = 0` (290), so B weapons (Heavy Bolter 14B, others 10-22) never need ST; Bulk still applies for Move and Attack.
- **Fix**: B: listed ST standing, `ceil(2/3 x ST)` and braced when prone. M: fine if always mounted, else apply ST when carried.
- **Impact**: small to medium; a ST 10 Guardsman firing a heavy bolter standing is -4 RAW, 0 prone.

### 89. Facing and backward movement (small, B)
- **Rule** (B386-387): sidestep or backward move costs 2 per hex; facing changes cost 1 per hex-side; after a Move or Move and Attack that used more than half the movement points, only one hex-side of turn; All-Out Attack may not change facing at the end of its move; a step allows free facing.
- **Sim**: every hex costs 1; `docs/simulator.md` says models face freely after any move.
- **Fix**: 2 per hex outside the front three hexes; limit the final turn after a long move.
- **Impact**: small to medium; side and rear attacks are rarer than RAW, and withdrawing shooters back off at full speed.

### 90. Crossing crates (small, B)
- **Rule** (B352): jumping a small obstacle (SM 3 or more below yours) is part of a Move at +1 movement point; a larger one takes the whole turn and a DX roll (fall on a failure), or two Move maneuvers to clamber without a roll.
- **Sim**: crates are impassable (`docs/simulator.md:12`).
- **Fix**: +1 MP if crates are small obstacles; a full-turn Move with a DX roll if they're waist-high. Barricades can stay impassable if wall-height.
- **Impact**: small to medium; it changes chokepoints on the generated maps.

### 91. Attacking an area (small, E)
- **Rule** (B414): lobbing an explosive at a spot: "Roll to hit at +4. There's no defense roll, but anyone in the area can dive for cover".
- **Sim**: grenades always target a model, who may dodge (2079).
- **Fix**: an AI option to throw at a hex (beside the target or the centre of a cluster) at +4, dive only.
- **Impact**: small to medium for Guard grenade play.

### 92. Overpenetration (small, E)
- **Rule** (B408-409): pi, imp and tight-beam burning ranged attacks whose basic damage exceeds the target's cover DR (DR both sides plus HP; 1/2 HP Unliving, 1/4 HP Homogeneous) continue to whoever is directly behind, who gets that cover DR plus their own.
- **Sim**: not modelled.
- **Impact**: small (lascannons and meltas through a front rank).

### 93. Afflictions and non-damaging weapon lines (small, F)
- **Rule** (B35-36, B416): on a hit the victim rolls HT+1 minus the Affliction level, plus DR unless the attack has Follow-Up, Blood or Contact Agent and so on; default effect is stun, recovering on HT+1 minus level each second. The effects list (B428) wasn't read.
- **Sim**: `parseDamage` returns `null` for `aff`, `fat` and `spec` (53), so the Stun Grenade's stun, Photon and Blind grenades, the Agoniser's agony follow-up, Psyk-out grenades, Shredder and Shardnet entangle, and Mindshackle Scarabs are ignored.
- **Fix**: a minimal Affliction path: HT+1 - level (+ DR where allowed); failure stuns; recovery at the same number. The Stun Grenade uses its listed HT-4 within 3 yards.
- **Impact**: small to medium for Agoniser Drukhari and grenade-heavy loadouts.

### 94. Encumbrance (small, F)
- **Rule** (B17): None up to BL (full Move and Dodge), Light 2x BL (x0.8, -1), Medium 3x (x0.6, -2), Heavy 6x (x0.4, -3), Extra-Heavy 10x (x0.2, -4); drop fractions, never below 1.
- **Sim**: `move = st.move + arm.move`, `dodge = st.dodge` (361-362); weight is never totalled.
- **Fix**: total the loadout, BL = liftST²/5, apply the level; self-carrying powered armour counts as 0.
- **Impact**: depends on the data (heavy weapons on ST 10-11 Guardsmen or Fire Warriors). Worth a weight audit before coding.

---

## Questions for the user

1. Should force-field shields (storm shields, praesidium shields) add their Defense Bonus against firearms and beams as a house rule? RAW (B374) they don't (#20).
2. Are Necrons (and the Gun Drone) Machines? RAW Machines can't spend FP on extra effort (B16, B356), so no Feverish Defense or Mighty Blows. They carry a "Necrodermis Machine-Body" flavour trait, not the Machine meta-trait.
3. Keep gun jams on a critical miss as a simplification? RAW, a ranged critical miss rolls the Critical Miss Table (mostly drop, turn in hand or off balance), and malfunctions have their own table (#32, #36, #73).
4. Is Resistant halving toxic injury intended? RAW Resistant only adds to HT rolls; plain toxic damage has no roll (B80). If intended, label it a house rule in `docs/simulator.md` (it affects Orks against splinter weapons).
5. Should High Pain Threshold give +3 to the Fractional Health stun and knockout roll (758)? RAW gives +3 on all knockdown and stun rolls (B59); the Revised Fractional Health document may say otherwise.
6. Morale rout: RAW Fright Check failures are mostly a few seconds of stun. Keep rout-on-any-failure, or rout only on table results of 17+ and stun below that?
7. Natural DR on eyes: use RAW 0, or put the trait notes' eye values (Tyranid chitin "DR 12 rather than 25" and so on) into the data (#14)?
8. Mortal wounds and Hard to Kill collapses: should Necron reanimation trigger from them (as from a kill) or not (#13, #42)?
9. Is blocking movement through friends a deliberate speed choice (#33)? And should target speed still be added to range for Move 10 or less (#60)?
10. Crates: small obstacles (+1 MP to cross) or waist-high (a full turn and a DX roll)? (#90)
11. Which weapons count as breakage-resistant ("fine") on the Critical Miss Table: chainswords, power weapons (#73)?
12. Should a direct hit by an explosive weapon use large-area injury too, or keep its hit location (#30)? B400 says "any external explosion".
13. Are M (mounted) weapons always fired from their mounts in the sim (#88)?
14. Berserk (Skorpekh Destroyer) and Cowardice (Gretchin) aren't modelled, and their pages (B124-129) weren't available. Can someone supply them? Cowardice likely penalises Gretchin morale.

## Status of the earlier from-memory review

Items of `docs/sim-mechanics-review.md`:

- 1 (Attack includes a step): confirmed (B363, B365, B368); step is Move/10 rounded up, and the sim only does 1-yard steps (#48).
- 2 (knockback from penetrating cuts): confirmed (B378) and implemented; ranged crushing knockback still missing (#79).
- 3 (guns in close combat): parrying the gun is confirmed on B376 with no penalty; close-combat -Bulk confirmed (B548); block and retreat against point-blank shots are wrong (#76). Readiness not rechecked.
- 4 (line of fire): -4 per figure confirmed (B389); the stray roll is corrected to "flat 9 or skill, whichever is worse", with a defence (#27).
- 5 (below 1/3 HP): confirmed (B419) and implemented; B380 words it as halving Basic Speed, B419 as Move and Dodge.
- 6 (Enhanced Move, sprinting): confirmed, and the acceleration question is answered by B354 (#4).
- 7 (shock for 20+ HP): confirmed; rounding still off (#39).
- 8 (major wound knockout, crippling as major): confirmed (B420, B421); head and vitals trigger added (#11).
- 9 (flexible blunt trauma): confirmed (B379) and implemented; cover exception (#46).
- 10 (Deceptive Attack floor 10): confirmed (B369-370), implemented.
- 11 (retreat needs a free hex): not checked by any reviewer; other retreat gaps found (#24).
- 12 (Move and Attack defences): confirmed (B366); only the retreat half is implemented (#1).
- 13 (Weapon Master, Trained by a Master): confirmed (B93, B99), implemented; specialisation open (#56).
- 14 (Wait, opportunity fire): Wait's conversion rules confirmed (B366); opportunity fire numbers not rechecked.
- 15 (standing up): lying to standing in two maneuvers confirmed; kneeling to standing is a step, so the sim's extra turn is wrong (#9).
- 16 (crit tables): confirmed; row details corrected (#22, #37, #73, #74).
- 17 (Fright Check cap): Rule of 14 confirmed; Combat Reflexes +2 and Heat of Battle +5 were missed (#2).
- 18 (bare-handed parry): confirmed, -3 unless thrust or Judo/Karate (#52).
- 19 (Block): Combat Reflexes +1 to Block confirmed (B43); the rest not rechecked.
- 20 (All-Out Defense): confirmed, +2 to one defence (B366), implemented.
- 21 (fatigue): confirmed and completed: Will roll, collapse, HP cost, unconscious at -FP; halve Move, Dodge and ST below 1/3 (#50, #51).
- 22 (ranged and explosion knockback): ranged crushing confirmed (#79); explosion knockback not found on B413-415, so unconfirmed.
- 23 (Evaluate, bracing): still not implemented (#68, #23).
- 24 (Fast-Draw Ammo): not checked (B194 unread); Combat Reflexes +1 Fast-Draw confirmed (#87).
- 25 (aim lost when hurt): confirmed, a Will roll; also, defending spoils the aim (#23).
- 26 (Extra Attack with Rapid Strike and Double): confirmed (B53, B370), implemented.
- 27 (auto fire across gaps): not checked.
- 28 (cones skip friends): fixed; B413 confirms cones hit everyone, but the shape is wrong (#31).
- 29 (Martial Arts options): out of scope; disarming (B400-401) noted as not worth modelling.
- 30 (Hardened DR): still not needed; no Hardened DR in the data.
- 31 (bleeding): rule now known (#83).
- 32 (same-hex close combat): B392's -2 for striking into a close combat noted (#27); not reviewed further.
- "Right" list, shock ignores active defences: confirmed (B374, B419).
- "Right" list, consciousness and death checks: confirmed; mortal wounds and Hard to Kill collapse missing (#42, #13).
- "Right" list, crippling thresholds and hit locations: confirmed (B398-400, B420-421, B552).
- "Right" list, rapid fire and Dodge against it: confirmed (B373-375); bonus above 99 shots (#58).
- "Right" list, Aim, Move and Attack, All-Out Attack (Determined): confirmed; the 2x Acc cap and aim spoiling are missing (#23).
- "Right" list, side -2 and rear no defence (B390-391): not explicitly rechecked.
- "Right" list, multiple parries, block once, unbalanced weapons: confirmed (B375-376).
- "Right" list, "a shield's DB counts against ranged attacks too": refuted (B374, #20).
- "Right" list, Dodge and Drop and diving for cover: confirmed (B377).
- "Right" list, explosions ÷ (3 x yards): confirmed (B414); radius wrong (#57).
- "Right" list, held model can't retreat and fights at -4: partly; parry should be -2 and only reach C weapons (#17).
- "Right" list, parrying an unarmed attack injures the arm: partly; a skill roll comes first (#53).
- "Right" list, Feverish Defense and Mighty Blows cost 1 FP with no roll: confirmed, but Mighty Blows belongs on the Attack maneuver (#3).

## Verified correct

- `check()` critical thresholds: success on 3-4, 5 at 15+, 6 at 16+; failure on 18, 17 at 15 or less, or 10+ over skill (B347-348, B556); margin = skill - roll.
- No active defence against a critical hit, melee or ranged (B374, B381).
- Critical Hit Table rows 3, 4, 5, 6, 7, 9-13, 15-18 (B556).
- Critical Miss Table rows 7, 8, 9-11, 12, 13, 14, 16 for melee (B556-557).
- Malediction as a resistance roll: attacker must succeed, ties to the defender (B348).
- Fright Check cap at 13 and Fearlessness added (B360, B55); Unfazeable skips morale (B95).
- Feverish Defense: 1 FP, +2, paid before the roll, no Will roll, not with All-Out Attack (B357).
- Mighty Blows and All-Out Attack (Strong) damage size: +2 or +1/die, whichever is more (B357, B365).
- All-Out Attack: Determined +4 melee, +1 ranged; Double; no active defence (B365).
- Move and Attack: ranged -2 or Bulk and no Aim; melee -4 capped at 9; no retreat afterwards (B365, B548).
- All-Out Defense (Increased): +2 to one defence (B366).
- Aim: +Acc, +1 at 2 s, +2 at 3+; Aim then All-Out Attack keeps Acc (B364, B372).
- Deceptive Attack: -2 per -1, never below 10 (B369-370).
- Rapid Strike: two attacks at -6, replacing one of several; -3 for masters (B370, B93, B99).
- Extra Attack: one attack per level; Double adds one; Rapid Strike penalty only on the pair (B53).
- Wait converts only to Attack or a shot (B366).
- Maneuver defence states last until the model's next turn (`aoa`, `aod` cleared in `act`) (B363).
- Dodge against rapid fire removes 1 + margin hits; rapid-fire bonus table to 50-99 +6 (B373, B375).
- Retreat +3 Dodge, +1 Parry or Block, melee only, not while stunned (B377).
- Dodge and Drop +3 against ranged, ends prone; diving for cover (B377).
- Block once per turn; no block against bullets or beams at range (B375).
- Multiple parries -4, or -2 for masters; unbalanced weapons can't parry after attacking (B376).
- Stun: Do Nothing, -4 defences, no retreat, HT to recover (B364, B381, B420).
- Shock ignores active defences; -1/HP, max -4, next turn only; High Pain Threshold removes shock and gives +3 to knockdown in standard HP (B374, B381, B419, B59).
- Range penalty table to 10,000 yd, rounding up, speed and SM added (B550).
- Max range; damage floor 0 for crushing, 1 otherwise (B378).
- Armour divisor divides DR, (∞) ignores it (B378).
- Wounding modifiers pi- x0.5, pi/cr/burn/cor/tox x1, cut and pi+ x1.5, imp and pi++ x2; minimum 1 on penetration (B379).
- Unliving and Homogeneous wounding tables (`UNLIVING`, `HOMOG`) match B380.
- Blunt trauma: 1 HP per full 10 cut/imp/pi (5 cr) stopped by flexible DR, none if anything penetrates (B379).
- Knockback: crushing and non-penetrating cutting, 1 yard per full ST - 2, ST 3 or less 1 per point, -1 per yard after the first (B378).
- Below 1/3 HP: half Move and Dodge rounded up (B419).
- 0 HP: HT each turn at -1 per full multiple below zero; death checks at -1 to -4 x HP with Hard to Kill; death at -5 x HP (B380, B419-420).
- Major wound over HP/2 → HT roll, stun and fall; 5+ failure or crit failure knocks out; crippling is a major wound; skull/eye -10, face/vitals -5 (B420-421).
- Crippling thresholds over HP/2 (limb) and HP/3 (extremity), injury capped at floor(HP/2)+1 and floor(HP/3)+1; crippled leg or foot drops the model (B420-421, B552).
- Follow-up: only on a hit, ignores DR once the carrier penetrates, not halved at 1/2D, no knockback or blunt trauma (B105, B378, B381).
- Hit location penalties (`AIM`) for every location; chinks -8/-10 halving DR after the divisor (B398-400, B547, B552).
- Wounding by location: skull x4 and DR +2 (not tox); eye x4 for pi/imp/tight-beam burn; vitals x3 and x2; neck cut x2, cr/cor x1.5; face cor x1.5; limbs cap pi+/pi++/imp at x1; No Brain and Homogeneous handling (B398-400).
- Random hit location table and `RANDOM_LOCS` weights summing to 216 (B552); the eye on 5 is the framework rule.
- Explosion collateral ÷ (3 x yards) rounded down, no armour divisor beyond the struck target; fragment radius 5 x dice, skill 15 + range + SM, cutting, random location, no armour divisor; only a dive defends; blasts stop at walls; the attacker can be caught (B414).
- Internal explosion: no DR, x3 (B414).
- -4 per figure in the line of fire; prone figures never block (B389).
- Ranged attacks against prone or kneeling targets -2 (B551), subject to #61.
- Attacker posture in melee: prone -4, kneeling -2; defence -3 prone, -2 kneeling (B547, B551).
- Malfunction on an unmodified roll >= Malf; fine or cheap ±1 (B407).
- Suppression uses random location and the rapid-fire bonus, and allows Dodge (B409).
- Cones affect friends as well as foes (B413).
- Reloading takes Shots (N) Readies; opening a door is a Ready (B382-383).
- Grenades thrown with Throwing as an Attack after a Ready; THROW table 0.05 to 2.0 with round-up; BL = ST²/5 (B353, B355-356).
- Grappling rolls DX or grappling skill, foe defends normally, grappler's attacks -4; takedown is a Quick Contest of the best of ST, DX or skill with the held side's DX -4 (B370).
- Shove: thrust crushing doubled, knockback only (B372); skill should be DX or Sumo, close enough.
- Posture movement: lying Move 1; crippled leg crawls (B367).
- Ranged minimum ST -1 per point; ‡ one-handed at 3x; Shots and reload parsing (B269-270).
- `DMG` / `stDamage` match B16 for ST 1-70.
- Basic Speed (DX+HT)/4 unrounded; Basic Move drops fractions; Dodge = Speed + 3 plus Enhanced Dodge and Combat Reflexes; HP = ST + bought, FP = HT + bought (B16-17).
- Striking ST only for thrust and swing; Lifting ST for BL, one-hand ST, gun Min ST and throwing (B65, B88), apart from #65.
- Combat Reflexes +1 Dodge, Parry, Block (B43); Enhanced Dodge, Parry, Block +1 per level (B51); Ambidexterity removes the off-hand -4 (B39).
- Weapon Master damage +1/die at DX+1, +2/die at DX+2, muscle-powered only (B99).
- Regeneration tiers and rates (B80); Slow correctly ignored.
- Natural DR subtracted after armour, before wounding (B46), apart from eyes (#14).
- End-of-battle FP costs correctly left out (B426).
