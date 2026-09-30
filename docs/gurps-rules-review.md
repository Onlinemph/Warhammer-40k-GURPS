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

## User decisions

1. Shields: force-field shields are shields like any other: Defense Bonus against every attack (by the book once Damage to Shields is used, #96: a defence that passes only thanks to the DB puts the round into the shield), plus the shield's own DR and HP and the force field. The AI should also exploit a shield's downsides (it covers only the front and shield side, occupies an arm, and can be struck).
2. Necrons are Machines (no extra effort from FP).
3. Use the book's tables: a ranged critical miss rolls the Critical Miss Table; guns with a Malf number use the Malfunction Table. **Done in batch A.**
6. Morale uses the Fright Check Table. **Done in batch A.**
7. Keep natural eye DR (house rule), or every monster gets shot in the eye every time.
10. Crates are easier to step over the bigger you are.
11. Not ruled on; the simulator treats power, force and relic weapons as fine (breakage-resistant), chainswords as ordinary.
14. The pages are in the Drive after all; see the supplement below.

## Progress

- Batch A (items 2, 5, 6, 7, 22, 36, 37, 38, 72, 73, 74, 75): implemented.
- Batch C (items 1, 8, 20, 24, 52, 53, 54, 55, 76, 78, 95, 96, 97; 77 for Slams and Shoves only): implemented. Open: #56, #77 for weapons. Shield DR and HP values await the user.
- #109 (Machines have no FP): done for Necrons; the Gun Drone's Machine Mind isn't flagged yet. #110: keep Regeneration (user).
- #98-#101 (Progressive Recoil as written): done; flat −1 later limited to true lasers with Rcl 1 (data "1L"), everything else stacks (user). #102: suppression keeps B409 as the one exception to Progressive Recoil (user decision).
- Tactical Shooting: #114-#126 done (#118 drilled factions chosen by me: Astartes, Custodes, Sororitas, Mechanicus, Guard, Aeldari, T'au, Necrons); #127 as an option, off; #130 done; #128, #129 done (awareness a setting, limited by default in facilities); #131 as an option, off; #122 slicing the pie done (user). Not done: #132 by design (conflicts with Progressive Recoil).
- Martial Arts: #150-#161, #164, #167 (All-Out and Committed; not extra arms or Sprawl), #168, #169, #173, #175 done; #162 stop thrust only; #163 Riposte only; #165 limited dodges and #172 Heroic Charge as options, off; #166 already in; #170, #171, #174 not modelled; #176 through the new options. Also #3 (Mighty Blows with Attack only), and #63 (Damage Table above ST 70).
- Batch B: #4, #9, #23, #33, #47, #48, #49, #50 (Move and Dodge; ST in contests not halved), #51, #67, #69 (not Shield-skill resistance), #70, #71, #89 (not the backward-move cost), #90 done; #3 and #68 earlier.
- Batch D: all done (#14 as half natural DR on the eye; #40 without the groin case; #43 without blinding; #44 without the shield-arm penalty; #80 without per-turn burning).
- Batch E: #25 (zone and swath left as they were), #26, #27 ("beside the target" only when it's in a close combat, B392), #28, #29, #30 (not for a model struck directly by an `ex` shot), #31, #34, #57, #58, #59, #60, #61, #91 (at a foe's feet and round corners), #92, #113 (clothing only; not standing in fire or wooden shields) done. #80's per-turn burning is covered by #113.

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

## Supplement: pages read later

A later reviewer read the pages the first five couldn't: B124-129 and the other mental disadvantages the templates carry (B124-162), the Machine meta-trait (B263) with Machines and Fatigue (B16) and Immunity to Metabolic Hazards (B80), B427-434 (Afflictions, Mortal Conditions, Collisions and Falling, electricity, fire), Shields (B287), Overpenetration (B408) and Damage to Objects and Damage to Shields (B483-484). The reviewer also compared the user's written house rule "House Rules: Progressive Recoil System for GURPS 4e" (Google Doc, version 2025-04-05) with `fireAt`. That document is the user's own rule, so where the sim differs from it, the sim is wrong. Line numbers are approximate: `tools/sim.js` was being edited during the review, so function names are the reliable pointer. New batch **H. Disadvantages and machines** covers the trait findings.

| # | Finding | Pages | Verdict | Impact | Batch |
|---|---|---|---|---|---|
| 95 | Shields have no DR or HP (Damage to Shields) | B484, B287, B408 | missing | medium to big | C |
| 96 | Shield DB against firearms is RAW once Damage to Shields is used; the arc limit still applies | B287, B374 | revises #20 | small | C |
| 97 | Storm-shield force field soaks hits from every direction | data, B287 | wrong | medium | C |
| 98 | Natural Rcl 1 weapons: flat -1, not cumulative | house rule §5 | wrong | big | E |
| 99 | Aim bonus only on the first shot of a burst | house rule §7 | wrong | medium to big | E |
| 100 | Bracing halves Rcl and gives +1 to every shot | house rule §6 | missing | medium | E |
| 101 | Planner and shot count follow the old progression | house rule §3-5 | partial | small | E |
| 102 | Suppression fire still uses the rapid-fire bonus | house rule §3, §8 | question | small | E |
| 103 | Berserk (Skorpekh Destroyer) | B124 | missing | medium | H |
| 104 | Cowardice (Gretchin) | B129 | missing | small to medium | H |
| 105 | Overconfidence | B148 | missing | small | H |
| 106 | Impulsiveness (Orks) | B139 | missing | small | H |
| 107 | Bloodlust | B125 | missing | small | H |
| 108 | Other mental traits: no combat effect; Slave Mentality → no morale isn't RAW | B124-162 | partial | small | H |
| 109 | Machines have no FP | B16, B263 | wrong | medium | H |
| 110 | Machine's Unhealing (Total) vs Necron Regeneration | B263, B160, B80 | question | medium | H |
| 111 | What Machine does and doesn't change | B263, B80, B483 | partial | small | H |
| 112 | Affliction effects (supplements #93) | B428-429 | missing | small to medium | F |
| 113 | Catching fire | B433-434 | missing | small to medium | E |

### 95. Damage to Shields: shield DR and HP (medium to big, C)
- **Rule** (B484): "If your shield's DB makes the difference between success and failure on any active defense (not just a block), the blow struck the shield squarely, and may damage it. Apply the attack's damage to the shield. Subtract the shield's DR. If no damage penetrates the shield, there is no effect . . . but you experience full knockback!" Damage that penetrates comes off the shield's HP under Damage to Objects; "ordinary shields are Homogenous, with HT 12. If the shield is disabled or destroyed, it no longer provides its DB, but it still encumbers you until dropped. If it is completely destroyed (-10×HP), it falls off." Punch-through: "The shield acts as cover, with 'cover DR' equal to its DR + (HP/4). Damage in excess of cover DR penetrates the shield and possibly injures you … roll 1d: on 1-2, apply damage to your shield arm; on 3-6, apply it to the location targeted by the attacker." B483 (artifacts): at 0 HP or less, roll HT each second the object is under stress (in use) or it's disabled; at -1×HP and each further multiple, roll HT or it's destroyed (as B419); destroyed automatically at -5×HP. B408: cover DR takes the armour divisor ("Finally, apply any armor divisor"). B287 figures: Medium Shield DB 2, DR 7, HP 40; Large Shield DB 3, DR 9, HP 60; Force Shield DB 3, DR 100, no HP. "This DR protects the shield, not the wielder."
- **Sim**: shields are only a Defense Bonus (`_item.db` in `data/sim/weapons.yaml`, summed in `buildUnit` around 339) and a Block score (362). They have no DR or HP and never take damage. The storm shield's field is a separate SP pool (`applyHit`, around 918).
- **Fix** (the user's decision: every shield keeps its DB against every attack, has its own DR and HP, and keeps any field it carries):
  1. **Data.** Add `dr`, `hp` and optionally `ht` (default 12) to each shield's `_item` in `data/sim/weapons.yaml`. Combat Shield (a Medium Shield) takes 7/40 and Boarding Shield (a Large Shield) 9/60, both from B287. The user sets values for the Storm Shield and Praesidium Shield plates; their data entries give only DB 3. In `buildUnit`, store `shield: {db, dr, hp, ht}`, and per model keep `m.shHP = hp` and `m.shState = "ok" | "disabled" | "destroyed" | "gone"`.
  2. **When the shield is hit.** Only on a successful active defence, from the front or the shield side (see #96), where the roll was higher than the effective defence minus DB, that is, it would have failed without DB. This applies to Dodge, Parry, Block, Dodge and Drop, and to a dodge against cones. Critical hits and explosions get no defence, so they never damage the shield. Against a burst where the dodge removes `1 + margin` hits (B375): if margin < DB, every hit removed struck the shield; otherwise the DB accounts for DB of the removed hits, which strike the shield. The burst case is an extension; B484 covers one attack.
  3. **Damage order.** Roll the attack's damage. A storm shield's field, if up and covering that arc (#97), absorbs first as now. Then subtract the shield's DR, divided by the armour divisor. If nothing penetrates, the shield is unharmed, and crushing or cutting damage applies full knockback to the wielder from the basic damage (the existing `knockback`). If damage penetrates, the shield loses `max(1, floor(penetration × HOMOG[type]))` HP, using the existing `HOMOG` multipliers (pi- 1/10, pi 1/5, pi+ 1/3, pi++ and imp 1/2, others x1).
  4. **Punch-through.** `coverDR = floor((DR + fullHP/4) / divisor)`, with no divisor for (∞). Basic damage above coverDR goes to the wielder: on 1d 1-2 the shield arm, on 3-6 the location the attacker aimed at (or the random location). The wielder's armour, wounding and follow-up then apply as usual. A follow-up (bolt shell) is spent on the shield unless the carrier punches through. That is a judgement call, consistent with #80.
  5. **Shield condition.** At `shHP <= 0`, roll HT (12) at the start of each of the wielder's turns and each time the shield is used to defend. On a failure it's disabled: no DB, no Block, still carried. On crossing -1×, -2×, -3× and -4× HP, roll HT or it's destroyed. At -5×HP it's destroyed automatically, and at -10×HP it falls off. A disabled or destroyed shield still blocks two-handed weapons until dropped. Dropping it is a Ready, which the AI can take when it has a two-handed option. A Force Shield with no HP (B287 style) never loses DB.
  6. **Log and FX.** Log "shield takes N (M HP left)", "shield disabled" and "shield smashed", and add the shield's HP to the token sheet.
- **Impact**: medium to big. Storm-shield Terminators, Boarding Marines, Custodes and Guard shield squads currently keep DB 2-3 forever against lascannon and power-fist hits. With DR/HP a Large-Shield-class plate (9/60, cover DR 24) survives small arms but is punched through or wrecked by meltas, lascannons and heavy melee in a few hits.

### 96. Shield DB against firearms is RAW with Damage to Shields; the arc limit stands (small, C)
- **Rule** (B287): DB applies "against attacks from the front or shield side … only against melee or muscle-powered ranged weapons – not against firearms, unless you use the optional Damage to Shields rule (p. 484)." B374 says the same.
- **Sim**: `bestDefence`, `rangedDefence` and `defend` add `t.u.db` against every attack from any non-rear arc, both sides included.
- **Fix**: this revises #20. With #95 adopted, the user's "DB against every attack" is RAW, not a house rule, so drop the firearms half of #20's fix. Keep its arc half: `arcOf` should return `left` or `right` for side hexes, and DB (and Block) should apply only from the front and the shield side (left, unless the model is left-handed). Also add B552's -4 to hit the shield arm (-8 the shield hand) if shields are ever aimed at (#44).
- **Impact**: small; it closes #20 and Question 1.

### 97. Storm-shield force field covers every direction (medium, C)
- **Rule**: `data/imperium/armour/fields.yaml`, Storm Shield (Field Component): "Covers only attacks from the front and the shield-arm side (the arcs a shield covers); attacks from behind or the off side bypass it." This matches B287's arcs for a shield.
- **Sim**: `applyHit` (around 918) soaks with `t.sp` whenever the shield is up, whatever direction the attack comes from. The planner check (`shUp`, around 1040) doesn't check the arc either.
- **Fix**: give the field an `arc: "shield"` property (fields worn as personal fields, such as refractor or rosarius, keep all-round cover). Soak only when `arcOf` is front or the shield side. Do the same in the planner so flankers know to ignore the field.
- **Impact**: medium. Surrounding a storm-shield Terminator, or shooting from its weapon side, becomes the way to beat it, as the data intends.

### 98. Progressive Recoil: natural Rcl 1 weapons take a flat -1 (big, E)
- **Rule** (house rule §5): "Weapons with a natural Recoil value of 1 … Shot 2 onwards: Roll against Skill - 1. This is a flat -1 penalty applied to every shot after the first in the burst; it does not accumulate further." §4 (Rcl 2+): shot n at Skill - (n-1)×Rcl.
- **Sim**: `fireAt` rolls shot k at `lvl - (k0 + k) * w.rcl` (the per-round loop, around 1339-1343) for every weapon, so a lasgun's tenth round is at -9 (`docs/simulator.md` line 35 says so explicitly).
- **Fix**: `const pen = k => k === 0 ? 0 : (w.rcl === 1 && !braced) ? 1 : k * effRcl` (`effRcl` from #100). Apply it to the first-target roll, the loop and the log text, and update `docs/simulator.md`. With 48 Rcl 1 automatic weapons in the data (every lasgun and hellgun, splinter, shuriken, pulse and gauss weapons, Burst Cannon, Avenger), this is the biggest single change to ranged fire.
- **Impact**: big. Expected hits at effective skill 10: lasgun (RoF 10) 1.5 now vs 3.9 under the house rule; Burst Cannon (RoF 20) 1.5 vs 7.6. At effective 6 (unaimed at range): lasgun 0.16 vs 0.51. Rcl 2+ weapons are unchanged (bolter 0.85 either way).

### 99. Progressive Recoil: Aim applies to the first shot only (medium to big, E)
- **Rule** (house rule §7): "Bonuses gained from an Aim maneuver apply fully only to the first shot roll of a rapid-fire burst. Subsequent shots in the same burst do not benefit from that specific Aim bonus." §4: shot 1 is at normal effective skill "including … aiming, bracing Acc".
- **Sim**: `aimBonus` (Acc + 1 or 2 for extra seconds, around 1298) is part of `base`, so every round of the burst gets it.
- **Fix**: keep `aimBonus` out of `base`. Add it to shot 1 only (the first-target roll when `k0 === 0`). Rounds 2+ use `lvl - aimBonus - pen(k)`. The planner (`burstHits`) needs the same split (#101). All-Out Attack (Determined) +1 is not Aim, so it stays on every shot.
- **Impact**: medium to big. An aimed lasgun burst (Acc 6) at effective 6 now expects 2.8 hits (+6 on all ten rounds, climbing -1). Under the house rule (#98 and #99 together) it's 1.2: one good shot and nine at -1 unaimed. Aiming automatic weapons becomes much less valuable, and Acc matters mainly for single shots.

### 100. Progressive Recoil: bracing (medium, E)
- **Rule** (house rule §6): bracing (bipod, a wall, a vehicle frame, a deployed shield) (A) halves Rcl for the cumulative penalty, rounding 0.5 up (Rcl 2 → 1, Rcl 3 → 2, Rcl 4 → 2). (B) gives its Acc bonus, usually +1, to all attack rolls in the braced burst. "If bracing reduces a weapon's effective Rcl to 1 … you still use the standard cumulative penalty progression … You do not switch to the special non-cumulative rule from section 5".
- **Sim**: no bracing at all. #88 notes bipod weapons are never braced.
- **Fix**: `braced = !moved && (prone || mounted || bipod && prone || adjacent crate/barricade/wall toward the target || carrying a shield with DB >= 2 and kneeling or behind it)`. The exact list is the user's choice; the house rule names bipod, wall, vehicle and deployed shield. Then `effRcl = braced ? Math.max(1, Math.ceil(w.rcl / 2)) : w.rcl`, cumulative even when it comes to 1, and +1 on every shot. Give the AI a reason to fire from cover or prone with heavy weapons. Bracing a natural-Rcl-1 weapon gains only the +1 (effective Rcl stays 1, cumulative), so for those weapons bracing is worse than not bracing past shot 2. The house rule says exactly that ("Rcl 1 weapon braced remains effective Rcl 1" together with §6's clarification); flag it for the user.
- **Impact**: medium. Heavy stubbers, heavy bolters and big shootas (Rcl 3-4) nearly double their useful rounds when braced.

### 101. Progressive Recoil: planner and shot count (small, E)
- **Rule** (house rule §3): "A weapon's listed RoF determines the maximum number of shots … you can choose to make". §8: "Each successful roll is one hit."
- **Sim**: `burstHits` (110) mirrors the cumulative -Rcl and applies `eff` (which includes Aim) to every round. It's used by the AI in `planAttack` and the option scoring (around 1571 and 1899). `fireAt` always fires `min(RoF, ammo)` and stops rolling below 3 but still spends the rounds.
- **Fix**: `burstHits(eff, n, rcl, aim, braced)` with the #98-#100 progression. Optionally, stop the burst at the first round whose skill is below the "Can't hope to hit" floor of 3 and keep the rest of the ammunition. The house rule lets the shooter choose. That matters only for Rcl 3-4 weapons with small magazines. Dodge against the burst stays at `1 + margin` hits removed (B375); the house rule is silent there, and `docs/simulator.md` records it.
- **Impact**: small, but the AI's choice between Aim and fire and between weapons follows the real odds only once this matches #98-#100.

### 102. Suppression fire and the house rule (small, E, question)
- **Rule** (house rule §1): the rules "replace the standard GURPS 4th Edition rapid-fire system described on p. B408 … and p. 373". §3: "RoF does not grant any bonus to your skill rolls under this system." Suppression fire (B409) is the rapid-fire rule on those pages.
- **Sim**: `suppressHit` (around 2290) rolls once per model at `min(6, skill) + rapidBonus(shots)` with `1 + margin/Rcl` hits (capped at 3), and `docs/simulator.md` says "Suppression fire keeps B409". The AI's suppression score (around 1781) uses the same.
- **Fix**: ask the user. If the house rule covers suppression, one version is: each model in the zone faces `min(shots, 3)` rolls, the first at `min(6, skill)` and later ones at the #98/#100 recoil progression, with no `rapidBonus`. Otherwise record "suppression keeps B409" as an explicit exception in the house-rules list.
- **Impact**: small; suppression is a minor AI option.

### 103. Berserk (medium, H)
- **Rule** (B124): "Make a self-control roll any time you suffer damage over 1/4 your HP in the space of one second". On a failure you go berserk (automatically if you fail a Bad Temper roll; deliberately with Concentrate and a Will roll). While berserk:
  - "If armed with a hand weapon, you must make an All-Out Attack each turn a foe is in range. If no foe is in range, you must use a Move maneuver to get as close as possible to a foe – and if you can Move and Attack, or end your Move with a slam, you will."
  - "If the enemy is more than 20 yards away, you may attack with a ranged weapon … but you may not take the Aim maneuver. If using a gun, you blaze away at your maximum rate of fire until your gun is empty. You cannot reload" (unless it takes a second or less).
  - "You are immune to stun and shock, and your injuries cause no penalty to your Move score. You make all rolls to remain conscious or alive at +4 to HT. If you don't fail any rolls, you remain alive and madly attacking until you reach -5×HP."
  - "When you down a foe, you may … attempt another self-control roll to see if you snap out", with one extra roll when no foes remain. "Once you snap out of the berserk state, all your wounds immediately affect you. Roll at normal HT to see whether you remain conscious and alive."
  - Battle Rage (+50%): berserk in any combat unless you make a self-control roll on entering combat.
  - Pain (B126 area) reduces self-control rolls against Berserk.
- **Sim**: not modelled; `combat_flags` doesn't read it. Only the Skorpekh Destroyer carries it (Destroyer Cult mind, `data/xenos/necrons/traits.yaml` around 929, CR 12).
- **Fix**: flag `berserk: cr`. In `injure`, when one second's injury exceeds HP/4, roll `3d <= cr` (minus any pain penalty). On a failure set `m.berserk = true`. While berserk, the AI's menu is reduced to melee All-Out Attack (Determined or Double; Strong needs no FP, but Mighty Blows does, see #109), charge or Move and Attack, or slam when in reach. It never uses Aim, All-Out Defense, retreat, Wait or cover; since All-Out Attack gives no defence, `defend` already returns null. Ignore stun and shock, don't halve Move below 1/3 HP, and add +4 to consciousness and death rolls. The model doesn't die before -5×HP unless it fails a death roll. On each foe it downs, roll cr to snap out; on success, roll HT for consciousness at the current HP. It's exempt from morale. Data: B124 prices Berserk at -10 at CR 12; the trait records -15, which is the Battle Rage price. If "attacks organic life on sight" is meant, add Battle Rage (+50%) and roll on entering combat; otherwise correct the points.
- **Impact**: medium for Skorpekh Destroyers. They stop parrying once hurt (All-Out Attack) but ignore stun and fight to -5×HP. As Necrons they already have High Pain Threshold, so the shock immunity adds little.

### 104. Cowardice (small to medium, H)
- **Rule** (B129): "Make a self-control roll any time you are called on to risk physical danger. Roll at -5 if you must risk death. If you fail, you must refuse to endanger yourself unless threatened with greater danger! Cowardice gives a penalty to Fright Checks whenever physical danger is involved": self-control 6 → -4, 9 → -3, 12 → -2, 15 → -1. B428: Tipsy and Drunk penalties don't apply to Cowardice rolls, which is irrelevant here.
- **Sim**: not modelled. Gretchin carry Cowardice (12) (`data/xenos/orks/traits.yaml` around 426).
- **Fix**: flag `coward: cr`. In `frightLevel` (727), take `-2` at CR 12 (table above) for morale checks and any other Fright Check in combat. In the AI, when a Gretchin picks an option that risks physical danger (charging into melee, advancing into a foe's line of fire out of cover, moving adjacent to a foe), roll CR; roll at -5 when the move risks death (a melee foe that can kill it in one blow, or a model already below 1/3 HP). On a failure, choose among options that don't close with the enemy: shoot from where it stands, take cover, fall back, All-Out Defense. Being in melee already, or being the target of a charge, is "greater danger", so it fights back normally.
- **Impact**: small to medium. Gretchin hang back and rout more easily, as their fiction suggests; units that rely on grot screens change.

### 105. Overconfidence (small, H)
- **Rule** (B148): "You must make a self-control roll any time the GM feels you show an unreasonable degree of caution. If you fail, you must go ahead as though you were able to handle the situation! Caution is not an option."
- **Sim**: not modelled. It's on Stormtroopers, Interrogators, Wyches, Succubi, Scourges, Archons and Necron Nobles, at CR 12 where given.
- **Fix**: when the AI picks a cautious option (All-Out Defense, withdrawing, Dodge and Drop, going prone, waiting in cover while a foe is in reach or range), roll CR. On a failure, take the best aggressive option instead. Skip if the AI personality code already makes these units aggressive.
- **Impact**: small.

### 106. Impulsiveness (small, H)
- **Rule** (B139): "You hate talk and debate. You prefer action! … act first and think later." The self-control roll applies "when it would be wise to wait and ponder"; on a failure you act. B120 self-control numbers: 6, 9, 12, 15.
- **Sim**: not modelled. It's in the Ork package (`data/xenos/orks/traits.yaml` around 163, CR 12).
- **Fix**: when an Ork's AI picks Wait, a second or third turn of Aim, or holding in cover for a better shot, roll 12. On a failure it takes its best immediate attack or advance instead.
- **Impact**: small; Orks already favour charging.

### 107. Bloodlust (small, H)
- **Rule** (B125): "In battle, you must go for killing blows, and put in an extra shot to make sure of a downed foe." The self-control roll applies to accepting surrender, taking prisoners and evading sentries.
- **Sim**: not modelled. It's on Orks, the Blood Angels' Red Thirst (as Bloodlust), Flayed Ones and Destroyer Cult Necrons.
- **Fix**: when a Bloodlust model downs a foe in reach or range, and no standing foe threatens it this turn, its next attack goes into the downed model. Against a downed Necron awaiting reanimation (`state "down"`) that's useful: it finishes the model, per whatever rule the sim uses for attacking downed Necrons. Otherwise it's a wasted action. "Killing blows" can bias called shots toward vitals and skull for elites who already call shots.
- **Impact**: small; it slightly slows Bloodlust units and helps them against reanimation.

### 108. Other mental traits (small, H)
- **Rule**: Bad Temper (B124): "Make a self-control roll in any stressful situation. If you fail, you lose your temper and must insult, attack, or otherwise act against the cause of the stress". In a fight that changes nothing unless the model also has Berserk (then a failure triggers Berserk). Fanaticism (B136) has no roll. Only Extreme Fanaticism gives "+3 on Will rolls to resist Brainwashing, Interrogation, and supernatural mind control"; there's nothing for Fright Checks. Callous (B125), Sadism, Megalomania, Paranoia, Low Empathy and Intolerance are social. Slave Mentality (B154): "You must make an IQ roll at -8 before you can take any action that isn't either obeying a direct order or part of an established routine", and you "automatically fail any Will roll to assert yourself or resist social influence". The Automaton meta-trait (B263) is Hidebound, Incurious, Low Empathy, No Sense of Humor and Slave Mentality; none of them exempts from Fright Checks.
- **Sim**: none of these is modelled, correctly for all but one. `combat_flags` sets `noMorale` for "slave mentality" and "machine mind" (build_site.py around 322).
- **Fix**: no change for Bad Temper (the Aeldari trait), Fanaticism, Callous and the social traits. Label `noMorale` from Slave Mentality as a house rule in `docs/simulator.md`, or drop it. RAW, a Slave Mentality drone or Necron Warrior still makes morale Fright Checks. Necrons keep `noMorale` from Reanimation Protocols, so only T'au drones and servitors change.
- **Impact**: small.

### 109. Machines have no FP (medium, H)
- **Rule** (B263, Machine): "You neither have nor can spend Fatigue Points; see Machines and Fatigue (p. 16)." B16: "Those with the Machine meta-trait … should list FP as 'N/A' … machines do not fatigue, but they cannot spend FP to use extra effort or fuel special abilities. When a machine operates beyond its normal limits, it risks lasting structural damage. This takes the form of reduced HT, not lost FP."
- **Sim**: every model gets `fp: st.fp || st.ht` (`buildUnit`, 361). Necrons (the user has decided they are Machines) can therefore use Mighty Blows (around 1485, and `aoa-mighty` around 2098) and Feverish Defense (`feverish`, around 2236), and they roll the 0-FP exhaustion check (around 2442) after a Fright Check table result or warp strain costs FP.
- **Fix**: `combat_flags` sets `machine: 1` for the Machine meta-trait and for "Necrodermis Machine-Body" (and T'au drones and servitors if they carry Machine; data has 59 mentions). `buildUnit` then sets `fp: Infinity` and `machine: true`, with no FP to spend: `feverish` returns 0, the Mighty Blows options aren't offered, FP-cost powers can't be used (every Necron power in `data/sim/powers.yaml` is already 0 FP), `frightTable`'s FP loss is ignored, and there's no exhaustion check. All-Out Attack (Strong) still works without Mighty Blows. Optional, per B16: a "redline" extra effort that costs HT instead of FP isn't in the Basic Set as a mechanic; leave it out.
- **Impact**: medium. Necron Lychguard, Destroyers and Nobles lose +2 on a defence per fight and the Mighty Blows damage bump.

### 110. Machine's Unhealing (Total) vs Necron Regeneration (medium, H, question)
- **Rule** (B263): Machine "includes Immunity to Metabolic Hazards [30], Injury Tolerance (No Blood, Unliving) [25], Unhealing (Total) [-30], and several 0-point features". "Your Unhealing disadvantage means that the only way for you to regain lost HP is through repairs with Mechanic or Electronics Repair skill". B160, Unhealing (Total): "You can never heal naturally". Accelerated natural healing "is useless".
- **Sim**: Necrons regenerate every second (the Regeneration block around 2458; `Regeneration (Necrodermis Self-Repair)` for all, `Very Fast` for Lychguard, Nobles, Crypteks and Destroyers).
- **Fix**: the user's call. Either Necron Machines drop Unhealing from the package (Machine without Unhealing is a common GURPS build for self-repairing robots, costed +30 points) and keep Regeneration as "living metal self-repair", or they take Machine as written and lose Regeneration. The first keeps current sim behaviour and only needs the Necron trait notes to say so.
- **Impact**: medium if Regeneration were removed; nil if the user confirms the exception.

### 111. What Machine does and doesn't change in a fight (small, H)
- **Rule** (B263, B80, B483): Machine gives Immunity to Metabolic Hazards: "all threats that only affect the living, including all disease and poison, plus such syndromes as altitude sickness, the bends, seasickness, and jet lag" (B80). It also gives Injury Tolerance (No Blood, Unliving) and no FP. It doesn't give Doesn't Breathe, High Pain Threshold, No Vitals, or any immunity to shock, stun, knockdown or major wounds. B483's "Knockdown and Stunning: A non-sentient artifact ignores these effects. A sentient machine (IQ 1+) can suffer these results as a damage-induced malfunction" confirms that sentient machines are stunned and knocked down normally. Heart Attack (B429): "Injury Tolerance (Diffuse, Homogenous, or No Vitals) grants immunity".
- **Sim**: Necrons already have Unliving, No Blood and No Vitals (the trait file), High Pain Threshold through "No Pain Receptors" (build_site.py around 275), and poison immunity through `flags.poison === "immune"` (the `injOf` line around 1000). Stun, knockdown and major wounds apply to them as to anyone, which is correct.
- **Fix**: none beyond #109 and #110. For #112: a Machine is immune to afflictions delivered as poison or disease (toxins, gas agents) and to biological conditions (Coughing, Nauseated, Retching, Heart Attack, drug Coma). It still suffers Daze, Paralysis, Agony (halved by High Pain Threshold to -3 per B428, see #112), Seizure and Unconsciousness from non-metabolic afflictions such as stun weapons and psychic powers.
- **Impact**: small.

### 112. Affliction effects (small to medium, F; supplements #93)
- **Rule** (B428-429): an affliction is resisted with HT and lasts as the source says.
  - Irritating conditions:
    - Coughing or Sneezing: -3 DX, -1 IQ.
    - Nauseated: -2 to all attribute and skill rolls, -1 to active defences.
    - Pain: -2/-4/-6 to DX, IQ, skill and self-control rolls (Moderate, Severe, Terrible); High Pain Threshold halves, Low Pain Threshold doubles.
    - Euphoria: -3.
    - Tipsy: -1 DX and IQ.
    - Drunk: -2 DX and IQ.
  - Incapacitating conditions: "you're effectively stunned (-4 to active defenses). In combat, you must Do Nothing on your turn."
    - Agony: fall down; lose 1 FP per minute. High Pain Threshold lets you function at -3 to DX, IQ, skill and self-control rolls.
    - Choking: only drop; none with Doesn't Breathe or Homogenous.
    - Daze: stay upright; "If you are struck, slapped, or shaken, you recover on your next turn."
    - Paralysis: fall over.
    - Retching: -5 DX, IQ and Per; no Concentrate actions; 1 FP at the end.
    - Seizure: fall, 1d FP at the end.
    - Unconsciousness.
  - Mortal conditions: Coma (as if at -1×HP and unconscious) and Heart Attack (drop to -1×FP, die in HT/3 minutes; immune with Diffuse, Homogenous or No Vitals). In a battle both mean the model is out.
  - Electricity (B432): non-lethal electrical attacks stun on a failed HT roll (DR of non-metallic armour adds; metallic armour counts as DR 1). An instantaneous jolt stuns for one second, then HT each second to recover; EMD at HT-5 knocks down and paralyses.
- **Sim**: `parseDamage` returns `null` for `aff`, `fat` and `spec`, so none of this happens (#93).
- **Fix**: add to #93's minimal Affliction path an `effect` field per weapon line in `data/sim/weapons.yaml` (`stun`, `daze`, `agony`, `paralysis`, `nauseated`, `unconscious`) with duration or recovery. Map `daze`, `agony`, `paralysis` and `seizure` to the existing stun state (Do Nothing, -4 defences, no retreat). Agony and paralysis also drop the model prone; Daze ends when the model is hit. `nauseated` gives -2 to skills and -1 to defences for the duration; `unconscious` takes the model out as unconscious. The Agoniser's agony with High Pain Threshold becomes -3 to skills instead of stun. Apply the Machine immunities in #111.
- **Impact**: small to medium for Drukhari Agonisers, stun and photon grenades, and Tyranid toxin sacs if any are affliction lines.

### 113. Catching fire (small to medium, E)
- **Rule** (B433-434):
  - Clothes catching fire:
    - "A single hit that inflicts at least 3 points of basic burning damage ignites part of the victim's clothing." This does 1d-4 burning per second and "-2 to DX, unless the damage simply cannot harm the target". Putting it out takes a DX roll, and each attempt is a Ready.
    - "A single hit that inflicts 10 or more points of basic burning damage ignites all of the victim's clothes." This does 1d-1 per second and -3 DX. Putting it out means rolling on the ground: a DX roll, three Ready maneuvers per attempt.
  - Standing in fire: "If you spend part of a turn in a fire … you take 1d-3 burning damage. If you spend all of a turn in a fire of ordinary intensity – or if you are on fire – you take 1d-1 damage per second." It uses Large-Area Injury (B400).
  - Making Things Burn (B433): "Divide damage by 10 for tight-beam burning attacks." Flesh is Highly Resistant (30 points); metal, brick and rock are Nonflammable.
  - Incendiary attacks add 1 point of linked burning.
  - "If a wooden shield takes 10 or more points of burning damage in one second, the bearer is at -2 to DX, and takes 1d-5 burning damage per second until he gets rid of it."
- **Sim**: burning damage is applied once; nothing ignites and there's no ongoing fire.
- **Fix**: on a hit by a non-tight-beam burning attack (flamers, cones, incendiary follow-ups, `burn ex`), with basic damage 3+ (or 10+) before DR, set `m.onFire = 1` (part) or `2` (all). Apply this only to models whose outer layer can burn: cloth, flak or light armour (Guard, Gretchin, Orks, cultists, Drukhari wychsuits). Sealed power or Terminator armour, carapace, necrodermis and chitin are Nonflammable or Highly Resistant. Each turn the model takes 1d-4 or 1d-1 burning, with armour DR as a large-area hit, and -2 or -3 DX to skills. The AI can spend Ready maneuvers (1, or 3 prone) and a DX roll to put it out, or ignore it. Tight-beam lasers use damage/10 and effectively never ignite. Wooden-shield ignition doesn't apply to the metal shields in the data.
- **Impact**: small to medium. Flamers against Guard and Orks gain a lingering effect and pull targets into Ready maneuvers; power-armoured targets are unaffected.

### Checked in these pages, no change needed
- Collisions (B430) use the same dice rounding as slams (B371). This confirms #84's fix: below 1d, 1d-3/-2/-1 at 0.25/0.5/more; otherwise round to the nearest die with no adds.
- Falling (B431), falling objects, overruns and whiplash: no elevation or vehicles in the sim, so not applicable.
- Coma and Heart Attack (B429) are relevant only through afflictions (#112); Necrons' No Vitals already gives immunity to Heart Attack.
- Lethal electrical damage (B432) is overridden by specific weapon stats ("If a specific attack or scenario gives different rules, they override the guidelines"), so tesla and arc weapons keep their listed damage.
- Unliving and No Blood for Necrons match the Machine meta-trait's Injury Tolerance (B263).
- Fanaticism, Callous, Sadism and Bad Temper (without Berserk) correctly have no combat mechanics in the sim.
- The house rule's "RoF does not grant any bonus" and "each successful roll is one hit" match `fireAt`'s per-round loop. The cumulative progression for Rcl 2+ weapons matches §4 exactly, and recoil keeps climbing across a split burst, consistent with "within the same Attack maneuver".


## Supplement: GURPS Tactical Shooting

A reviewer read the whole of GURPS Tactical Shooting (Hans-Christian Vortisch, e23, version 1.0, February 2011; the user's Drive copy "GURPS 4th - Tactical Shooting.pdf") against `docs/simulator.md` and `tools/sim.js`. "TS p." below is a page of that book; "B" is still the Basic Set. The myths, gun descriptions, gunsmithing, ammunition and gear chapters and the legal and civilian material have nothing for a 40k squad skirmish and were skipped. Most of the book's rules are options for the GM, so each finding says whether it is an option. The user's house rules (per-round automatic fire with Progressive Recoil, Deceptive Shot, Fractional Health, eye DR, elite-only called shots, firing lines, Damage to Shields) are not reported as errors. Where a Tactical Shooting rule collides with the Progressive Recoil rule it is listed in #132 with no change proposed. `tools/sim.js` was being edited during the review, so function names are the pointer, not line numbers. New batch **T. Tactics, doctrine and Tactical Shooting options** covers all of these.

Also confirmed by the book: TS p. 37 halves "Firing Through an Occupied Hex (p. B389)" "to -2", which confirms the -4 per figure that `docs/simulator.md` says it recalled from memory. TS p. 12 and p. 28 support the bracing values in #100 and #23 (see #120).

| # | Finding | Pages | Verdict | Impact | Batch |
|---|---|---|---|---|---|
| 114 | Troops under fire keep their heads down: Will-2 to leave cover | TS 21, 7-8 | missing (option) | medium | T |
| 115 | Fright Checks from suppression, near misses, blasts, wounds and fallen friends | TS 34 | missing (option) | medium | T |
| 116 | Fire and maneuver: half the team bounds while the other half shoots | TS 21 | missing (AI) | big | T |
| 117 | Suppression is area denial; the AI offers it only on clusters of three | TS 18, 9, 21-22 | partial (AI) | medium | T |
| 118 | Drilled teams: -2 through a friend's hex, no wrong-target hits on formed-up friends | TS 22-23, 37 | missing | medium | T |
| 119 | Follow-up shots keep half the Acc bonus after an aimed shot | TS 14 | missing (option) | medium | T |
| 120 | Bracing sources: cover, two-handed pistols, slings, mounts (supplements #23, #100) | TS 11-12, 28, 75 | missing | medium | T |
| 121 | Cover categories, and the cost of shooting back from behind them | TS 28 | partial | medium | T |
| 122 | Corners and doorways: Wait for the first foe to appear; stay off the wall | TS 23-24 | missing (AI) | medium | T |
| 123 | Entering rooms: grenade first, second man covers the far corner | TS 24-25 | missing (AI) | medium | T |
| 124 | Battle drills for the AI: Counterattack and Peeling | TS 22-23 | missing (AI) | small | T |
| 125 | Reload behind cover and in lulls, not standing when empty | TS 20 | missing (AI) | small | T |
| 126 | Close-contact shots: +4 with All-Out Attack, -2 to parry a hip-held gun, firing a grabbed gun | TS 25 | missing | small to medium | T |
| 127 | Sighted and aimed shots are All-Out Attack (Determined): +1 and no dodge | TS 13-14, 17 | question | small | T |
| 128 | Situational awareness: the AI knows where every foe is; no ambush or surprise | TS 11, 21, 27-28 | missing | medium | T |
| 129 | Shooting through a wall or door at a foe whose position is known | TS 28 | missing | small | T |
| 130 | Cover made of solid material wears down (semi-ablative) | TS 29 | missing | small | T |
| 131 | Restricted Dodge against firearms (option) | TS 17 | question | small to medium | T |
| 132 | Tactical Shooting rules that use the rapid-fire bonus or margin-over-Rcl hits (house-rule conflicts, no change proposed) | TS 14-18, 31, 34, 75-76 | conflict | small | T |

Totals: 19 findings (#114-#132), 1 big, 10 medium, 6 small, 2 small to medium.

### 114. Troops under fire keep their heads down (medium, T, option)
- **Rule** (TS p. 21, Fire and Maneuver; p. 7-8): "anyone under fire must make a Will-2 roll each turn, unless he has Combat Reflexes or Unfazeable; failure means he stays safely behind cover – though he may take actions that don't expose him to fire (e.g., moving further behind cover, communicating, reloading). This is only an absolute for NPCs." The same passage adds that a non-Combat-Reflexes model who takes cover or does a dodge and drop must roll DX or Acrobatics, and on a failure takes Do Nothing next turn. After shooting, "make a Vision roll to determine if the opposition has sought cover."
- **Sim**: nothing makes a shot at a model change what it does next. `defend` only rolls the defence, `dive` only handles grenades, and the only morale test is the half and quarter strength Fright Check in the turn loop (`u.checked50`, `u.checked25`). A Guardsman with a lasgun fires back at full effect however many bolts crack past him.
- **Fix**: at the start of `act`, if the model was the target of a ranged attack, a suppression zone or a blast since its last turn, and is not Unfazeable, has no Combat Reflexes flag (`u.flags.cr`) and is in cover (`inCover`), roll `check(will - 2)`. On a failure, offer only options that don't expose it: reload, Aim from where it stands without firing, step to a hex with no line of sight to the shooters (`coverOptions` with a no-LOS score), Wait, All-Out Defense. Log "keeps its head down". Optionally add the DX or Acrobatics roll after a Dodge and Drop. If #115 is adopted, keep only one of the two, or skip a Fright Check for a model that has already failed this roll.
- **Impact**: medium. This is the mechanism that gives suppression and cover their purpose in the book. Guard, Gretchin, cultists and Kabalite warriors would be pinned by return fire; Marines, Custodes and anything Fearless or with Combat Reflexes would not, which fits the lore.

### 115. Fright Checks from suppression, near misses, blasts, wounds and fallen friends (medium, T, option)
- **Rule** (TS p. 34, Cool Under Fire): the GM may require a Fright Check on the turn after "especially traumatic events". "A failed Fright Check is likely to stun the victim, forcing him to hesitate for those important moments that get even skilled shooters killed." Typical triggers: "coming under Suppression Fire; being the target of a near miss (by 2 or less) from any attack; being in the blast zone of an explosion (2 × dice of damage in yards); suffering a wound (even a graze may set some people off); or seeing an ally incapacitated or killed." Modifiers: the standard ones including +5 for the heat of battle; "a penalty equal to the attacker's rapid-fire bonus unless you are safely behind cover (you suffer the full penalty if the cover gets penetrated)"; -1 if you can't tell where the attack came from; +1 if it was silenced. The Shell Shock passage on the same page lists further modifiers, including +1 each for a pre-arranged plan (battle drills), attacking from ambush, and fighting at 100+ yards.
- **Sim**: `fright` and `frightTable` exist and work, but are called only from the casualty check (half and quarter strength), from Shadow in the Warp and from Perils.
- **Fix**: add a per-model trigger list to the turn loop: in a suppression zone (`suppressHit` reached the model), a ranged miss by 2 or less, inside a blast, took any injury, a friend within 5 yards went down since the last turn. Roll `fright(u, mod)` once per turn per model (worst modifier only, so a burst doesn't roll ten times) and send failures to `frightTable`, which already stuns for seconds. `mod` is minus the shooter's burst size in place of the rapid-fire bonus (see #132), zero behind intact cover. Skip models flagged Unfazeable, Necron and mindless, as now.
- **Impact**: medium. Big for Guard, Orks, Gretchin and cultists in a firefight (they stop shooting under heavy fire); nothing for Fearless or Unfazeable models. It also gives the AI a reason to use suppression (#117).

### 116. Fire and maneuver: half the team bounds while the other half shoots (big for the AI, T)
- **Rule** (TS p. 21, Fire and Maneuver): "Also known as 'Bounding,' 'Leapfrogging,' or 'Shoot and Scoot,' this is how trained shooters move in combat: Attack or All-Out Attack, ideally from cover and often prone or kneeling to reduce your silhouette. The shots can be targeted, but will usually be suppression fire. … While the opposition is thus occupied with keeping their heads down, you can move ('bound') to a new location, fire again to remind them you're still a threat, and so on. The bounding distance is usually 10-20 yards … Bounding works best if you have at least a pair of shooters – with one firing from an overwatch position while the other moves." Scales to two pairs (fire team), teams (squad) and squads (platoon).
- **Sim**: each model picks its own best option every second. In the advance stance every shooter takes `advance-fire@` (Move and Attack, -2 or Bulk, no Aim), `move-closer@`, `advance@` or `cover@`, all valued alone through `risk`. Nothing pairs models, so a squad either all shoots (holding) or all runs; the hold-and-shoot half never protects the moving half. `incoming`, which `risk` uses, counts every foe with a line of sight as if it were firing at full effect, whatever the foes' own squads are doing.
- **Fix**: in the decision layer, each second split each unit's shooters into pairs by nearest neighbour and give each pair a role: overwatch or bound, swapping each time the bounders reach cover. Overwatch models get a bonus for `fire`, `suppress` and `aim@` on the foes the bounders will cross fire from (or a penalty for moving); bounders get a `bound@hex` option: a Move (sprint, once #4 exists) of up to 2 x Move to the best `cover@` hex nearer the foe, valued by progress plus cover, minus `risk`. In `incoming`, scale a foe's contribution by (1 - pin chance) when a friend's suppression zone or overwatch claims it (`claims`), where the pin chance comes from #114 or #115. Without those two the discount is a plain 0.5 on foes a friend is firing at. Skip it for melee stances and for Orks and Tyranids (zeal), which charge.
- **Impact**: big for how squads look and for shooter-versus-shooter results. Today a Guard squad advancing across a crate room takes all its fire while nobody covers it, so a defender who simply holds always wins the exchange.

### 117. Suppression as area denial, not only a cluster attack (medium for the AI, T)
- **Rule** (TS p. 18; also p. 7, p. 9, p. 21, p. 22): suppression fire is "less about engaging targets than about area denial". It needs RoF 5+, "either from a single weapon or from a combination of guns" (each rolled separately). Doctrine: much of a non-professional's fire "shouldn't be aimed shots, but Suppression Fire … or even Shooting Blind"; "most fire at 300+ yards without an optical sight is really just suppression fire (pp. B409-410) for harassment"; Fire and Maneuver shots "will usually be suppression fire"; in Peeling the point man "immediately begins suppression fire" while the rest of the team moves.
- **Sim**: in `rangedOptions` the `suppress` option is built only for a candidate `c` with at least three foes within one hex (`inZ.length < 3`), and is valued only by the harm the zone does (`Ez` and `kv`). A single foe behind a crate or in a doorway can't be suppressed, and the value of pinning a foe while friends move is zero.
- **Fix**: allow zones on one or two foes when the target is in cover, in a doorway or hallway lane (`coverAt` not "none", or `los` through a door hex), or beyond the shooter's unaimed range. Add a pin value to the zone's score: the harm the pinned foe's fire would have done (`threatOf(f) * HORIZON * pinChance`) times the harm friends avoid or gain while it is pinned, using #114 or #115 for the pin chance. Keep the friendly-fire term as it is. This ties directly to #116.
- **Impact**: medium. Suppression is currently a niche damage option for gunners with RoF 5+ (heavy bolters, autocannons, shootas are the users); with a pin effect it becomes the tool the book says it is.

### 118. Drilled teams: -2 through a friend's hex, no wrong-target hits on formed-up friends (medium, T)
- **Rule** (TS p. 22-23, Battle Drills; p. 37, perk): a team that has "formed up" (one Ready maneuver, ordered by a leader who has the perk) may "ignore Hitting the Wrong Target (pp. B389-390) for allies who have formed up" and "halve the penalty for Firing Through an Occupied Hex (p. B389) to -2, if the occupant has formed up." Formed-up members also get +2 to spot a threat another member has seen, one free movement point to reposition, and may turn a Wait into Move or Move and Attack so faster members can move after slower ones. Battle drills "require a lot of coordinated training to execute without confusion or friendly fire casualties"; they suit military, special-ops and police teams.
- **Sim**: `between` costs -4 per figure on the line for every unit alike, and `stray` checks friends on the line and beside the target (`docs/simulator.md`: "The AI counts the penalty and the chance of hitting a friend"). No unit is drilled, so Space Marines, Custodes, veteran Guard and Necron warriors take the same friendly-fire risk as an Ork mob.
- **Fix**: add a `drilled` flag per unit or template in `data/sim/ai.yaml` (the user's call which ones: Astartes, Custodes, Sisters, veteran Guard, Kabal or Wych cults, Necron warriors are the obvious candidates). For a drilled shooter and a drilled friend on the line, use -2 in `between`-based penalties and skip that friend in `stray` (and in `ffCost` in `rangedOptions`). The book also wants one Ready to form up; the cheap version is a free formed-up state at the start of the fight, the strict one costs each unit's first turn. The Wait-to-Move trick is not worth modelling.
- **Impact**: medium. It changes how often trained squads shoot through each other, and it makes firing lines (already a house rule) stronger for elite units than for mobs, which is the intended difference.

### 119. Follow-up shots keep half the Acc bonus (medium, T, option)
- **Rule** (TS p. 14, Aimed Shooting, Follow-Up Shots): "The GM may allow shooters to retain half their weapon's base Accuracy (round down) on subsequent sighted shots against the same target after using aimed shooting. Shooters with braced weapons may add full base Acc when firing at RoF 1; mounted weapons on flexible or fixed mounts (p. 75) may add full base Acc even when firing at higher RoF." You still lose the bonus when you lose sight of the target, switch targets, move, defend, unbrace or switch weapons.
- **Sim**: `fireAt` sets `m.aimTurns = 0` after every shot, so a sniper or heavy gunner who has spent two turns aiming gets one shot at the bonus and then either fires unaimed or spends another turn re-aiming. The planner's `aim@` option in `rangedOptions` (which pays a turn for Acc next turn) therefore compares against a floor that is too low, and the "re-aim when the unaimed roll is under 10" behaviour is stronger than the book intends.
- **Fix**: after an aimed shot, keep `m.aimTarget` and store `m.followAcc = braced && rof === 1 ? w.acc : Math.floor(w.acc / 2)`. On the next `fireAt` at the same target, if the model hasn't moved, defended (needs #23), switched target or weapon, add `followAcc` to `base` and clear it. Include it in `rangedOptions`' non-aimed `fire` plan (`base + followAcc`). Under the Progressive Recoil rule the bonus goes on shot one of the burst only, as the Aim bonus does (#99). The mounted "full Acc at higher RoF" line is the one that touches the house rule (see #132).
- **Impact**: medium for single-shot and low-RoF weapons (lascannons, sniper rifles, Guard heavy weapons, Eldar and Tau precision guns): aim once, keep shooting. Small for high-RoF weapons, where the bonus is one shot in the burst.

### 120. Bracing sources: cover, two-handed pistols, slings and mounts (medium, T; supplements #23 and #100)
- **Rule**:
  - TS p. 12 (Two-Handed Shooting of Handguns): the two-handed stances "multiply minimum ST by 0.8 (round up), reduce Bulk by 1, and treat all aimed shots as braced (see Aim, p. B364)".
  - TS p. 11 (Shoulder Shooting of Long Arms): a two-point sling wrapped round the supporting arm counts as braced; setting it takes one Ready per -1 Bulk, halved by a Fast-Draw (Long Arm) roll.
  - TS p. 28 (Using Cover): medium cover gives -3 to be hit and -2 to you "unless you brace your weapon against the cover and make an aimed shot"; you "can brace against a vertical object like a wall". Heavy cover is the same at -4.
  - TS p. 75 (Tripods and Other Mounts, an option): tripods and other flexible mounts give +2 Acc for bracing, fixed mounts (carriages, hardpoints, turret mounts) +4, against +1 for a bipod.
  - TS p. 14: braced weapons add full base Acc on follow-up shots at RoF 1 (see #119).
- **Sim**: there is no bracing at all (#23, #88, #100).
- **Fix**: give #100's `braced` these inputs in `fireAt` and the planners: prone with a bipod weapon; standing or kneeling at a crate, barricade or wall hex on the target side (`coverAt`-style lookup of the next hex toward the target; a two-handed weapon or pistol both count); a pistol fired two-handed (also Bulk -1, ST x 0.8 in `weaponsFor`, but not while a hand is busy with a shield or a second weapon); a mounted weapon (`m` flagged `mount`). The +2 and +4 mount values differ from #100's +1 (see #132). The two-point sling is a one-time Ready per fight and is not worth modelling.
- **Impact**: medium. It is the same change as #100 with more triggers, and it feeds #121: the book's price for shooting from behind medium or heavy cover is waived by bracing on it and aiming.

### 121. Cover categories, and the cost of shooting back from behind them (medium, T)
- **Rule** (TS p. 28-29, Using Cover, an option instead of B408): "very light cover gives others -1 to hit you while giving you no penalty to shoot back … Light cover is similar, but gives -2 … Medium cover gives -3, but you are also at -2 to hit – unless you brace your weapon against the cover and make an aimed shot … Heavy cover is similar to medium, but gives -4 to your foes and -4 to you (unless you brace and aim)." Shooting around the cover means the cover DR doesn't protect; the penalty stacks on the hit-location penalty. Exceptions: "any hit location necessary to operate the weapon can be targeted at no extra penalty on any turn in which you attack" (hands, face, the weapon: hand -4, face -5), and "total cover can't be shot around; the enemy must shoot through it and deal with its DR" at random hit location. Barricade Tactics (perk, p. 37) upgrades your cover one step.
- **Sim**: `coverAt` returns a crate ("light", DR 15), a barricade ("heavy", DR 60), a corner ("heavy") or the side's open-ground setting, and `fireAt`, `rangedOptions` and `incoming` all apply a flat -2 to hit whichever it is (`inCover`). Nothing charges the model in cover for peeking out, so a barricade is only as good as a crate against fire, and standing behind it costs nothing when shooting back. This overlaps #26, which is about the flat -2 and the DR route; this finding is about the categories.
- **Fix**: give each cover type a penalty: crate -2 (light), barricade -4 (heavy), corner -2, open-ground setting per side as chosen. Then when a model whose own cover is medium (-2) or heavy (-4) attacks from it, subtract 2 or 4 from its own `base` in `fireAt` and in the planner, unless `braced` (#120) and it aimed last turn (`aimTurns > 0`). Keep #26's rule for random locations and DR. This makes a barricade shooter want Aim and a brace, which the AI already values through `aim@`, while a shooter behind a crate (light cover) pays nothing to shoot back, as now. Hand, face and weapon locations stay open to aimed shots at the normal penalty.
- **Impact**: medium. Cover fights are the core of the facility maps, and heavy cover would finally mean something. The strict version halves the return fire from behind a barricade for anyone who is not aiming.

### 122. Corners and doorways: Wait for the first foe to appear; stay off the wall (medium for the AI, T)
- **Rule** (TS p. 23-24, Urban Combat, Turning Corners): "One of the fundamental rules of tactics is to stay away from corners." Don't walk in the middle of a hallway, but "never stay too close to a wall or corner, either – ricochets travel along walls. A distance of 1-2 yards from walls is advisable. If you stand too close to a corner, you limit your field of view and are also easily engaged in melee combat by someone hiding just around the corner." The safe way round a corner is "slicing the pie": start as far from the corner as possible, step sideways one hex at a time, revealing a sliver of the far side; "the corner counts as light cover for both you and any possible opponent until you have fully turned it." "If someone is lurking around the corner, he may use Opportunity Fire (p. B390) if he took a Wait maneuver. If neither of you chose to Wait, you both roll [Per] as a Quick Contest; the winner acts first and a tie means truly simultaneous actions! Combat Reflexes gives +1." Rushing with Move and Attack turns a corner in one second but at -2 to Sense rolls and the Move and Attack penalty.
- **Sim**: line of sight is symmetric (`los`), so a figure at a corner sees and is seen, and the one who acts first in Basic Speed order shoots first. Wait (`wait@` and `wait-melee@` in `rangedOptions`) fires only at a charger about to reach the waiter, never at "the first foe who steps into this doorway". `coverOptions` picks hexes beside a wall (`wallAt` on a neighbour) with line of sight to foes, which is the spot the book says to avoid. Foes that aren't in `los` are ignored by `risk` even when they are one step round the corner.
- **Fix**: (a) a Wait trigger "a foe enters `los`" for a model watching a door or corner hex from at least a yard back: in `followPath` (or wherever a foe's step is committed), if a waiting model gains `los` to the mover, it shoots first with the normal Wait rules (the same hook the charger Wait uses; the book does not add a penalty beyond B390). (b) Extend `risk` to include foes that are out of sight but whose walking distance to the hex (`walk`) is within their Move plus reach, so hugging a corner in front of a waiting Ork counts as the grab risk it is; this only needs a foe list, since the AI already knows where they are (see #128). (c) In `coverOptions`, subtract a small cost for a spot adjacent to a wall corner when (b) is non-zero. Slicing the pie itself (one lateral step a second past a corner) is optional: it slows the AI to a crawl, which is the book's point, but is a big change for the facility maps.
- **Impact**: medium for the facility maps. Defenders holding a doorway or hallway corner get the first shot the way the book (and the user's "Wait on a doorway") intend, and attackers stop hugging corners next to Orks and Genestealers.

### 123. Entering rooms: grenade first, second man covers the far corner (medium for the AI, T)
- **Rule** (TS p. 24-25, Entering Through Doors): look through the doorway from an angle first, moving in a half-circle; "the two near corners on the opposite side of the wall with the door" are the likeliest hiding places. A lone entrant "move[s] diagonally through the doorway into the near corner opposite of your position" and glances back at the other near corner at -2 (and -2 more to shoot, as opportunity fire). "Entering a door with a partner is much safer": the partner covers the other corner (a "Cross Entry"). "The entry can be preceded by hand grenades" (stun, tear gas or fragmentation; "grenades with fuses of more than 2 seconds should be 'cooked off' so they can't be tossed back"), unless the walls can't contain the blast and would endanger the thrower.
- **Sim**: doors are opened as a Ready (`setDoor`) and models walk in one after another along `engagePath` or `stepToward`. `bestGrenade` only throws at foes it has a line of sight to (a `los` gate on `pool`), so grenades never go through a doorway ahead of the entry, and nothing arranges a partner to cover the other corner.
- **Fix**: (a) let `bestGrenade` consider a throw to a hex inside an open doorway or the first hexes beyond it when a foe is inside within blast range (with the AI knowing where foes are, or with #128, where one was last seen or heard); the landing point is the door's far hex, so the blast stays inside the room, but skip it when a friend is inside the blast radius (`docs/simulator.md`: the blast stops at walls). (b) For entry: when a model would step through a door hex and a friend within two hexes could take a Wait covering the opposite near corner, score the friend's `wait@corner` (see #122) and charge the entrant's `risk` with only the near-corner foe. Both are small additions to options that exist.
- **Impact**: medium for the facility maps: rooms are where Guard and Marines meet Orks and Necrons at point-blank range, and a frag or krak through the door is the standard answer. Grenades are a per-loadout item, so this is mostly for Guard, Marines and Kabal.

### 124. Battle drills for the AI: Counterattack and Peeling (small, T)
- **Rule** (TS p. 22-23, Battle Drills): Counterattack, for a near-ambush at hand-grenade range (under 40 yards): the first man to notice fires, the rest join, then "the entire unit will then Move and Attack together, charging toward the enemy (preceded by hand grenades or other explosives, if available) and firing as fast as possible, to overrun the enemy and break up the attack". It suits small units. Peeling, "a controlled retreat in the face of overwhelming opposition … a reversed, accelerated version of a Fire and Maneuver advance": the point man suppresses for a second or two, then runs back past the others, who fire in turn, "until the unit manages to disengage from the enemy"; it may include a thrown smoke grenade.
- **Sim**: a unit's stance (`charge`, `shoot`, advance) is fixed for the fight, and the only way a unit leaves is the morale rout (`u.routed`). There is no smoke, and nothing peels.
- **Fix**: optional AI mode per unit: `disengage` when the unit's remaining strength against the foes' in sight falls below a set ratio (use the quantities `threatOf` and `remOf` already compute) and the unit is not zealous (Orks, Tyranids). While it lasts the rear models Move back out of `los` to a rally hex and the front models fire; roles swap each second, as in #116. A `counterattack` mode is the existing charge stance switched on for a shooter unit that is in a doorway or hallway with foes at 10 yards or less; it gains nothing that `stanceW` doesn't already do, so leave it.
- **Impact**: small. It only matters for Guard and Kabal squads at bad odds; today they stay and die, which is right for Orks and the Astartes and wrong for line troops.

### 125. Reload behind cover and in lulls, not standing when empty (small, T)
- **Rule** (TS p. 20, Reloading): "If at all possible, reload while behind cover; even when behind cover, it makes sense to take a Change Posture maneuver to kneel in order to reduce your silhouette." A tactical reload is "done for practical reasons, rather than out of necessity … at a time (and place) of your choosing, preferably safe behind cover, during a lull", so that a full magazine is in the weapon when needed; it "should be the norm for weapons with integral magazines". Reloading in a team means telling your partners they can't expect cover fire from you.
- **Sim**: `rangedOptions` offers `reload` only when `m.ammo <= 0` (and `reload-cc` in close combat), always where the model stands. The AI never tops off in a lull, never steps out of sight to reload, and doesn't stagger reloads among the squad.
- **Fix**: add a `tac-reload` option when no foe has `los` to the model (or all foes are further than one Move plus range beyond its own reach) and `m.ammo < w.shots.mag`, valued like the existing `reload` branch (`Math.pow(GAMMA, turns) * shotValueFrom - rNow`). Add `reload-cover`: when empty and `risk(m, m.h, "")` is high, move to a hex with no `los` to the foes with a `coverOptions`-style search, then reload there. To stagger, subtract a small amount when more than a set fraction of the unit is already reloading (`m.reload > 0`).
- **Impact**: small; most 40k guns have big magazines or short reloads. It matters for plasma, melta, lascannons and heavy bolters with reload times of 2-3 seconds.

### 126. Close-contact shots (small to medium, T)
- **Rule** (TS p. 25-26, Close-Contact Shots; also p. 12, p. 25): "At Reach C with a weapon used with Guns (Pistol), or Reach C or 1 with any other firearm, All-Out Attack (Determined) gives +4 to hit, as with a melee attack, instead of +1. However, your target may attempt a melee parry against such an attack (p. B376). Pressing your gun against your target also gives you +4 to hit, cumulative with an All-Out Attack – but now your foe gets +2 to defend with a dodge or a parry." Holding the gun close for two turns adds +1 (bracing). A weapon's Acc and sights "can never" add more here; Bulk applies in close combat only because the foe resists, so "if you're standing behind an unresisting target you never suffer Bulk penalties". Holding a firearm "close to the body, as in a hip-shooting stance, gives your opponent -2 to parry a handgun or -1 to parry a long arm". To fire a handgun your foe has grabbed you first "win a Quick Contest of DX or Retain Weapon vs. his DX or grappling skill"; a long arm he holds by the barrel can still be fired, rolling at +2.
- **Sim**: the point-blank option in `approachOptions` and `fireAt` (`opts.pointBlank`) uses the weapon's Bulk in place of the range penalty and gives +1 for All-Out Attack; `defend` in kind "pb" parries at full value, and `docs/simulator.md` says the exact penalty for parrying a gun "hasn't been checked against the book, so none is applied". A held model can't fire a gun.
- **Fix**: in `fireAt` with `opts.pointBlank` and `opts.aoa`, use +4 instead of +1 (for pistols at Reach C, other guns at Reach 1, which is the sim's d <= 1); add a `pbParryPen` of -2 (handgun) or -1 (long arm) to the parry option in `defOpts` when kind is "pb" (this supplies the missing number, taking the hip-shooting stance as the close-combat stance the book describes); optionally let a held model fire after a DX or Retain Weapon Quick Contest (+2 for a long arm). The +2 to defend for a pressed gun is not worth adding.
- **Impact**: small to medium. It raises hit chances for the point-blank shots that Marines with bolt pistols, plasma pistol officers and Kabal use against melee units, and makes "gun beats blade" choices more frequent in `approachOptions`.

### 127. Sighted and aimed shots are All-Out Attack (Determined): +1 and no dodge (small, T, question)
- **Rule** (TS p. 13-14, p. 17, p. 32): unsighted ("snap") shooting is the GURPS default: it "enables the Attack and Move and Attack maneuvers, and allows you to dodge. It doesn't allow All-Out Attack (Determined) or Aim." "Sighted shooting … is represented by All-Out Attack (Determined), which gives +1 to Guns. Concentrating on the sights makes shooting more accurate, but also means you can't dodge." "Aimed shooting … Treat this as Aim followed by All-Out Attack (Determined)." "Only unsighted shooting allows you to dodge. When using sighted or aimed shooting, you're standing still and concentrating." (Harsh Realism, p. 32, an option: a sighted or aimed shooter has No Peripheral Vision until his next turn.)
- **Sim**: the shot after an Aim (`fire` with `opts.aim`) is an ordinary Attack, so the shooter keeps its active defences and gets no +1; `aoa-fire` (with +1 and no defence) is offered only when `threatNow < 1`, and its risk term is `risk(m, m.h, "aoa")`. B364 itself says an aimed shot is Aim then Attack, so the sim follows the Basic Set here; the book's version is the stricter option.
- **Fix**: if the user wants the book's model, treat a shot that uses the Aim bonus as All-Out Attack (Determined): +1 to hit, no active defence until next turn, and the planner (`fire` after aim) uses `risk(m, m.h, "aoa")`. Aim turns themselves keep the defences (and lose the bonus when used, #23). Aimed-and-defending would stop being free.
- **Impact**: small. It only changes the balance between `aim@` and snap `fire` for gunners who are being shot at, mostly snipers and heavy weapons, and makes aiming under fire less attractive, in line with #23.

### 128. Situational awareness: the AI knows where every foe is; no ambush or surprise (medium, T)
- **Rule** (TS p. 11, Situational Awareness, an option; p. 21, Ambush; p. 27-28, Countersniping; p. 7, Don't Get Shot): "GURPS usually assumes that everybody in a fight is aware of several things that are hard to keep track of in reality. Notably, the players can see the battle map … and know precisely where their enemies and allies are." The GM may instead limit knowledge: a fighter turning to new targets may not see a camouflaged foe, and "the GM may also assign -2 (see Pop-Up Attacks, p. B390) to attack new targets". Rolls to notice: Per, Observation, Per-based Guns, Soldier or Tactics, -4 for a glance or none with a Concentrate maneuver. "The ambush is the standard tactic of TL6-8 military operations": if the target expects trouble, a Quick Contest of the ambusher's Camouflage, Shadowing, Stealth or Tactics against the prey's Per, Observation or Tactics decides between partial surprise for the target, no surprise, or (on a 5+ ambusher loss) the prey ambushing back; otherwise "each side spots the other". Muzzle flashes and shots reveal a shooter to within one yard (B548); a Hearing-2 roll gives the direction of an unseen shooter. The surprise rules are at B393.
- **Sim**: `pool` (the foe list every option is built from) contains all living foes. Models with nobody in sight "advance toward the nearest foe on foot" through `field` (a walking-distance field to the nearest foe, wall corners and all), so a squad in the staging bay heads straight for the enemy's position round any number of walls. There is no surprise, no hiding, no delay in learning that a foe has fired from a doorway, and no pop-up penalty (the "stealth" rows in `docs/simulator.md`, "Not modelled", agree).
- **Fix**: a per-side `known` map: foes seen by any friend (line of sight) in the last few seconds, plus foes that fired (position known to within one yard, B548), plus foes that shot at a friend through a doorway. `pool` becomes the known list for anything that needs a target; models with nothing known advance along the axis (or the unit's objective) rather than toward a hidden foe, or stand and Wait. Add a per-unit `ambush` option: the unit deploys hidden, its first turn is unseen (no `los` from the other side until it fires or comes within a set range), and the first side seen gets partial surprise (per B393). A fired-upon attacker at a new target takes -2 unless it has a Cool Under Fire flag (the perk, p. 38). Keep an "omniscient AI" setting for current comparisons.
- **Impact**: medium overall, big for the facility maps. It removes the perfect knowledge that lets a squad go round three walls to reach the one room with foes in it, and it gives "Wait on a doorway" and grenade-through-the-door (#122, #123) something to hit. It does change every existing result, so keep it a setting.

### 129. Shooting through a wall or door at a foe whose position is known (small, T)
- **Rule** (TS p. 28, Cover and Concealment): "A trained tactical shooter knows that concealment is not cover … Many modern firearms will blast right through typical obstacles … if an opponent hides behind a corner or on the far side of a door, you may simply shoot through it (p. B408). However, this isn't a good idea if you don't know exactly who (or who else!) is behind that cover." "Total cover can't be shot around. The enemy must shoot through it and deal with its DR, and must roll randomly for hit location. This is the case when shooting through walls." Material DR is tabled on pp. 29-30 (a fire door DR 8, drywall DR 1*, reinforced concrete 4" DR 40-48*).
- **Sim**: `docs/simulator.md`: "No shot, thrown grenade, suppression or cone goes through a wall." `fireAt` returns at once without `los`. Walls are DR 50 and doors DR 30 (Homogeneous, so piercing does a fraction), so most 40k guns wouldn't get through anyway, but lascannons, meltas, plasma, krak missiles and autocannons would hurt a figure standing behind a door.
- **Fix**: with #128's known-position map, let `fireAt` and `rangedOptions` shoot at a foe whose hex is known and hidden by a door or wall hex, at random hit location, with the structure's DR added on top of the target's (armour divisor still applies) and the structure damaged as `damageStructure` already does; the planner's expected injury (`expInjRandom`) takes the extra DR; skip friends behind the wall (the AI doesn't know they're there). The B408 rule is "shoot through the cover with DR added"; nothing more is needed. Ordinary bolters, lasguns and shootas will not bother; the AI decides on expected harm.
- **Impact**: small. It only shows for heavy weapons, and it is a natural companion of #128.

### 130. Cover made of solid material wears down (small, T)
- **Rule** (TS p. 29): "If cover can't be penetrated by a single round, it may be chipped away by repeated attacks – treat any cover with a * as semi-ablative (p. B559). This method can be used to create a hole – e.g. to toss a grenade inside. Some 150 rounds of 5.56×45mm NATO or 100 rounds of 7.62×51mm NATO … will chew a 7" loophole into an 8"-thick wall of reinforced concrete."
- **Sim**: as far as `docs/simulator.md` and `coverAt` show, crate and barricade DR (15 and 60) are fixed values, and structures only lose HP to area effects and deliberate breaches (`damageStructure`); hits stopped by cover leave it untouched.
- **Fix**: apply B559's semi-ablative step (check the exact amount in the book) to hits absorbed by a crate or barricade, keep a per-cover DR in `terr.crates` and lower it, and remove the crate when the DR reaches 0. A crate lost mid-fight also changes `coverAt`, so clear `terr.covC`. No AI change is needed; expected harm already includes cover.
- **Impact**: small. Fights are short. It matters for a long firefight round one crate, where a heavy bolter or autocannon should chew through it.

### 131. Restricted Dodge against firearms (small to medium, T, question)
- **Rule** (TS p. 17, Tactical Dodging, an optional rule): "if a fighter is aware of someone with a firearm and selects All-Out Defense, Attack, Change Posture, Defensive Attack, Feint, Move, or Move and Attack on his turn, he may take 'evasive movement' with respect to that one foe as a free action. If the specified gunman shoots at him before the start of his next turn, he may dodge … He can't dodge firearms attacks from any enemy but the one specified, evade more than one shooter, or declare his evasive movement in response to being attacked until it's his turn again." Acrobatic Dodge needs its roll on the model's own turn; Dodge and Drop needs the dive at the end of its turn.
- **Sim**: `rangedDefence` gives a Dodge against every shot from every shooter, and `bestDefence` is called with no reference to who the model was watching.
- **Fix**: on the model's turn set `m.evading` to the foe that presents the highest `incoming` share; in `defOpts` for kinds "ranged" and "pb", allow the Dodge only if `att === m.evading` (or `att` is unknown to be firing, when nothing is set). Models on All-Out Attack or Do Nothing still get no defence. The AI's `risk` and `planAttack` see the same rule for free, since they call `rangedDefence`. It hits hard on fast dodgers (Eldar, Drukhari, Genestealers) fighting several shooters and removes most of the value of Dodge against squads.
- **Impact**: small to medium, and a change to the balance rather than a correction, so it is an option for the user.

### 132. Tactical Shooting rules that collide with the Progressive Recoil house rule (small, T, conflict)
No change is proposed; each is listed so the rule is not imported by accident. The house rule (the user's "Progressive Recoil" document) rolls each round separately, gives no rapid-fire bonus (§3), applies bracing as halved Rcl and +Acc (§6) and gives the Aim bonus to shot one only (§7).
- TS p. 15-16 (Double-Tap, the Mozambique Drill): "You must succeed by at least your gun's Rcl to hit with both shots!" This is the B373 rule (one extra hit per Rcl of margin) that the house rule replaces. A two-shot attack under the house rule is two rolls, the second at -Rcl. The drill's second turn, one skull shot at -7 (or -15 with Ranged Rapid Strike and target check) is unaffected.
- TS p. 14 (Fast-Firing), p. 18 (Ranged Rapid Strike, Suppression Fire, Spraying Fire, the two-RoF-3-pistols example): each takes "the usual rapid fire bonus" for the RoF used, works out the bonus "for each attack" from the shots fired, or gives a single RoF 6 weapon +1. The house rule has no rapid-fire bonus. Fast-Firing also adds +1 Rcl (and Fanning +2 at RoF 5), which the house rule's Rcl progression could take as given.
- TS p. 16 (Walking the Burst): "Modifiers: … your current rapid-fire bonus" for the Per roll, and a success gives a bonus to later attacks in the same 30° direction (add half Acc for braced weapons, full for tripods), "not cumulative with Follow-Up Shots". The rapid-fire bonus term has no meaning under §3; the later-attack bonus overlaps §7.
- TS p. 34 (Cool Under Fire, Fright Check modifiers): "a penalty equal to the attacker's rapid-fire bonus unless you are safely behind cover". Under §3 the attacker has no rapid-fire bonus, so #115 needs another measure (the fix there uses the burst size).
- TS p. 31 (Attacks with Mixed Ammunition): each ammo type is checked for "potential hits" as margin over Rcl (B373), weighted by the mix. The house rule's per-round rolls need a different treatment for a mixed magazine (each round its own type).
- TS p. 14 (Follow-Up Shots): "mounted weapons on flexible or fixed mounts may add full base Acc even when firing at higher RoF". §7 says the Aim bonus applies fully only to the first shot of a burst.
- TS p. 75 (Tripods and Other Mounts): bracing gives +1 (bipod) but +2 for flexible and +4 for fixed mounts, where §6's bracing gives "usually +1".
- TS p. 76 (Compensator, Muzzle Port, Muzzle Weight): each "grants +1 to effective skill whenever three or more shots are fired (RoF 3+)". That is a bonus tied to burst size, close to what §3 removes; under the house rule a compensator would more naturally lower Rcl.

### Checked in Tactical Shooting, no change needed
- Snap or unsighted shooting as the default (TS p. 13): the sim's `fire` without Aim gives no Acc and keeps the dodge. Correct.
- Move and Attack at "-2 or the weapon's Bulk rating, whichever is worse" (TS p. 17): matches `fireAt` (`opts.moved`).
- Aim lost by moving, defending, switching target or weapon, or failing Will after injury (TS p. 14): already #23.
- Dodge and Drop as "hitting the deck" (TS p. 8, p. 17): matches the sim's Dodge and Drop.
- -4 for firing through an occupied hex (TS p. 37, halved to -2 for formed-up friends): confirms `between`'s -4.
- A shooter kneeling or prone to reduce silhouette (TS p. 8, p. 20): the sim's firing line and posture penalties already do this; the book's -4 for a lying target in its example (p. 11, p. 28) is the same B548 modifier discussed in #61.
- Target priority, "hit each hostile once until he is down or running away … shoot the most immediate threat first" (TS p. 17): the sim's spread of fire (`claims`) and threat weighting (`threatOf`) do the same.
- Sniping and precision aiming (TS p. 26-27: extra Aim steps up to +Acc+7 at 90 seconds, Deadeye, spotters, range cards): the sim's Aim caps at three seconds and maps are 64 yards long, so the extra steps would never be reached; not worth adding.
- Night fighting, light adaptation, NVGs, sound suppressors, dazzle, hearing loss, gun handling (holsters, Fast-Draw, conditions of readiness, Immediate Action, Who Draws First): the sim has no darkness or sound model and no holstered weapons at the start; malfunction clearing already exists (`jamCheck`).
- Bullet Travel (TS p. 32): irrelevant at 64-yard ranges.
- Mozambique drill, Double-Tap, pelvic shot, Targeted Attack, Armor Gaps (TS p. 12, p. 15-16, p. 45): call-shot options, covered by the elite-only called-shot rule. The pelvic-shot hit location is not in the sim's location list; not worth adding for sealed armour.

## Supplement: GURPS Martial Arts

This supplement checks the combat side of `tools/sim.js` against GURPS Martial Arts (MA), read from the user's split PDFs on Google Drive: parts 1 to 3 (pp. 1-228) were read; part 4 (pp. 229-258) came back from the Drive text reader empty, so nothing from it was used. The chapters read closely are Techniques (for Counterattack, Feint, Targeted Attack, Evade and the defensive techniques), Combat (pp. 95-139: maneuvers, combat options, close combat, active defence options, Harsh Realism, cinematic and multiple-attack rules, extra effort, injury variants) and the weapon notes. Where MA restates a Basic Set rule the Basic page was compared too (B364-366, B369-370, B376-377, B388, B391 and B417, from the Basic Set PDFs on the same Drive).

MA is a set of optional rules and the user will probably adopt some of them. Each finding is marked "MA rule" (an option MA adds) or "MA clarification" (MA spells out something the Basic Set already says, so the sim is wrong or incomplete even without MA). Findings marked cinematic or gritty are flagged as such; adopting them is the user's call. None of the current templates carries a Feint, Counterattack, Targeted Attack, Riposte or Evade technique (only `Dual-Weapon Attack` is read, `sim.js` around line 344), so technique-based rules only matter once data adds them; the maneuver and option rules matter now. Where a finding quotes odds, they were computed with a small script from the 3d6 table (a roll of 3-4 always succeeds, 17-18 always fails) and "landed hits" means an attack roll that succeeds and is not defended.

Numbering starts at #150 so it doesn't collide with the Tactical Shooting supplement (from #114). Batch letter M. Line numbers are `tools/sim.js` as read; the file was being edited while this was written, so they may be a few lines off.

### Summary

| # | Finding (short) | MA page | Type | Kind | Impact | Batch |
|---|---|---|---|---|---|---|
| 150 | Evaluate: no way to take it; MA adds Committed/Defensive Attack and cancelling feints | MA100 | MA rule | missing | small | M |
| 151 | Feint: the AI's expected margin runs a fifth to a quarter low; resisting with the best skill | MA101, MA73 | MA rule | partial | small | M |
| 152 | Beats: a ST-based feint against Parry or Block that helps every attacker | MA100-101 | MA rule | missing | medium | M |
| 153 | Ruses (IQ-based feints) and Defensive Feints | MA101 | MA rule | missing | small to medium | M |
| 154 | All-Out Attack (Feint) and feints traded for attacks inside a multiple attack | MA97-98, MA127 | MA clarification (B365) | missing | medium to big | M |
| 155 | Telegraphic Attack: +4 to hit, defences +2 | MA113 | MA rule | missing | medium | M |
| 156 | Committed Attack: the step between Attack and All-Out Attack | MA99-100 | MA rule | missing | medium to big | M |
| 157 | Defensive Attack: the step between Attack and All-Out Defense | MA100 | MA rule | missing | small to medium | M |
| 158 | All-Out Attack (Double) plus Rapid Strike gives three attacks | MA97-98, MA126-127 | MA clarification (B370) | missing | medium | M |
| 159 | Extra attacks are lost when the first target falls; multiple targets | MA127-128 | MA clarification (B370) | wrong | medium | M |
| 160 | Dual-Weapon Attack: the target defends at -1; melee pairs | MA83, B417 | MA clarification (B417) | partial | small | M |
| 161 | Parrying heavy weapons: no weights, no sweep-aside, no breakage; Cross Parry | MA121, B376 | MA clarification (B376) | missing | medium | M |
| 162 | Stop Hits against the melee Wait; stop thrust damage | MA108, B366 | MA rule | partial | small to medium | M |
| 163 | Counterattack and Riposte | MA70, MA124-125 | MA rule | missing | small to medium | M |
| 164 | Retreat: sideways steps get the full bonus; Sideslip, Slip and Dive | MA123-124, B377 | MA clarification (B377) plus MA rule | wrong | medium | M |
| 165 | Limiting Multiple Dodges, Restricted Dodge against firearms, Multiple Blocks | MA122-123 | MA rule (gritty option) | missing | big if adopted | M |
| 166 | Harsh Realism for Unarmed Fighters; retreat bonus for Boxing and Karate | MA124, B377 | MA rule | partial | small | M |
| 167 | Grappling: All-Out and Committed Attackers lose the contests; extra arms; Sprawling | MA114-119 | MA rule | missing | small to medium | M |
| 168 | Held models and long weapons: the close-combat skill table | MA117, B391 | MA clarification (B371, B391) | partial | small to medium | M |
| 169 | Tip Slash for thrust-only weapons | MA113 | MA rule | missing | small | M |
| 170 | Defensive Grip, Reversed Grip, Pummeling | MA109-112 | MA rule | missing | small | M |
| 171 | Targeted Attacks: repeating a called shot | MA68 | MA rule | missing | small | M |
| 172 | Extra effort in combat: Heroic Charge, Giant Step, Great Lunge, Rapid Recovery | MA131-132 | MA rule (cinematic) | missing | medium to big | M |
| 173 | Untrained fighters | MA113 | MA rule | missing | small | M |
| 174 | Ranged feints and Prediction Shots | MA121 | MA rule | missing | small | M |
| 175 | Acrobatic Stand costs Acrobatics-6 and encumbrance | MA98 | MA rule | wrong | small to medium | M |
| 176 | AI tactics the MA options change: who should Feint, when to All-Out Defend | MA100, MA126, MA131 | MA clarification | question | medium | M |

**M. Martial Arts options** (27: #150-#176). `strike`, `meleeOptions`, `approachOptions`, `defOpts`, `defend`, `retreatHex`, `act`, `afterStep`. Most of these add options to the melee decision layer; #159, #161 and #164 fix places where the sim gives a defender or attacker more than the Basic Set does.

### 150. Evaluate: Committed and Defensive Attack, and cancelling feints (small, M)
- **Rule** (MA100, MA rule): "Evaluate provides exactly the same benefits for Committed Attack and Defensive Attack that it does for the maneuvers listed on pp. B364-365." Optional: "you may use your current Evaluate bonus against a foe to cancel out defense penalties from any feint or Deceptive Attack he attempts against you. This can never give a net bonus." It applies only to attempts made while you Evaluate, against that one foe, and is lost when you attack him and claim the bonus.
- **Sim**: `strike` reads and clears `m.evaluate` but nothing sets it (#68). `defend` subtracts `da + feint` in full (`const mod = D.mod - da - (feint || 0)`).
- **Fix**: do #68 first (an `evaluate@t` option; `m.evaluate = {t, n: min(3, n+1)}`, cleared unless the last turn was an Evaluate on the same foe). For the MA counter, record `t.evalOn = att` and `t.evalN` when a model Evaluates, and in `defend` reduce `da + feint` by `t.evalN` (floor 0) when `t.evalOn === att`. Offer Evaluate from `act` only when nothing else scores: a foe out of reach that is waiting or on All-Out Defense, or a stand-off with no ranged option.
- **Impact**: small. One Evaluate turn takes skill 12 against a defence of 9 from 0.46 landed hits to 0.59 on the next blow with +3 after three turns; a turn spent for +13 points rarely wins the scoring, so the AI will seldom pick it. It matters for stalemates and for models facing Deceptive Attack users.

### 151. Feint: the AI's expected margin, and who resists (small, M)
- **Rule** (MA101, MA73, MA rule): "the GM should consider allowing all combatants to resist (but not initiate) feints using their best Melee Weapon or unarmed combat skill." A fighter who knows the Feint technique uses it both to feint and to resist.
- **Sim**: the resistance skill is `skillT = max(t.u.melee.level, t.u.dx)`, the weapon in hand or DX, which is the Basic Set's rule (B365) and is right for single-weapon units. The value of a feint in `meleeOptions` uses `gain = (lvl - skillT) / 2 + 1`. The true expected reduction (chance to win times margin of victory) is 1.2, 2.3, 3.8 and 5.5 at skill gaps of 0, 2, 4 and 6 against skill 12; the sim's formula gives 1, 2, 3 and 4, so it undervalues feints by about 17% at equal skill and 27% at a six-point gap.
- **Fix**: `gain = 1.2 + 0.7 * max(0, lvl - skillT)` fits the four points above to within 0.3. Resist with the best skill of any melee weapon the model has (Custodes with sword and spear) when the user adopts MA's option; nothing changes for models with one weapon.
- **Impact**: small. It shifts a few borderline Feint choices toward feinting for skilled duellists; see #154 for the larger change.

### 152. Beats (medium, M)
- **Rule** (MA100-101, MA rule): "A strong fighter can try to batter down his enemy's guard in preparation for an attack. This is a Beat." It needs a Feint maneuver and a target defence: your weapon or limb that parried or blocked last turn (against the weapon or shield you defended against), or the attack you made this or last turn that the foe parried or blocked, or a grapple (against Dodge). The initiator rolls a ST-based skill roll; the victim rolls a DX-based roll or a ST-based roll. "That defense is reduced against attacks from anyone! ... The penalty lasts until the end of the next turn of the fighter who made the Beat."
- **Sim**: none. A feint (`m.feint = {t, n}`) only lowers the feinter's own next attack. `defOpts` has no per-defence penalty on the target.
- **Fix**: a `beat@t` option offered when `m.parriedFrom === t` or the model's last blow at `t` was parried or blocked. Roll `check(lvl + (st - dx))` against the target's better of its skill and `skill + (st - dx)`; on a win store `t.beat = {how: "parry" | "block", n: margin, until: turn + 1}` and subtract it in `defOpts` from that defence against every attacker. The AI values it as the feint is valued now, but with the target's damage taken from every friend who can reach it.
- **Impact**: medium in melee mobs and against Parry or Block users (Marines with blades, shield bearers). At skill 12 against 12, a fighter with a +4 ST edge wins 79% of the time with a mean margin of 4.8, against 43% and 2.8 for a plain feint, and the penalty is shared by the whole squad. It does nothing against pure Dodge fighters, so it doesn't change Ork or Tyranid mobs.

### 153. Ruses and Defensive Feints (small to medium, M)
- **Rule** (MA101, MA rule): a Ruse is a feint by "clever tactics rather than deftness": the trickster rolls an IQ-based skill roll, and the foe resists with a Per-based roll, a DX-based roll or Tactics. Defensive Feints: "If you win, you inflict a penalty on your foe's next attack roll against you instead of on his next defense roll against you." This is useful "when your opponent is less skilled than you but has a weapon you would rather not defend against."
- **Sim**: none.
- **Fix**: a Ruse is the feint roll at `skill + (IQ - DX)` against the better of the foe's `skillT`, `skill + (Per - DX)` and Tactics; offer it only where that beats the plain feint (high-IQ models: Eldar, Mechanicus). A defensive feint sets `m.feintDef = {t, n}` and `strike` subtracts `n` from the foe's attack level against `m` next turn only. The AI should choose it next to All-Out Defense when its own skill beats the foe's by 4 or more and the foe carries the weapon it fears (a Necron warscythe, a power klaw).
- **Impact**: small to medium. A defensive feint at a four-point skill edge (79% win, mean margin 4.8) takes a skill-14 attacker from 90% to hit down to about 40%, which is better than All-Out Defense's +2 (a Dodge of 9 goes from 38% to 62% defended). It needs the skill edge, so it helps elites and does nothing for horde units.

### 154. All-Out Attack (Feint) and feints inside a multiple attack (medium to big, M)
- **Rule** (B365, MA97-98, MA127, MA clarification): "All-Out Attack (Feint) is just an All-Out Attack (Double) that trades the first attack for a feint, so there's no reason why a fighter couldn't reverse the order." Determined all-out attacks feint at +4. MA127: attacks and feints trade one for one; "a feint during a Rapid Strike is at -6"; a feint before attacks on the same target in the same maneuver lowers his defences against them; a feint on the last attack helps only the next maneuver; only the most recent feint applies; a feint never unreadies a weapon. MA98 adds that AOA (Feint) followed by a Deceptive Attack is the "unstoppable blow".
- **Sim**: `meleeOptions` offers `aoa-det`, `aoa-double`, `aoa-strong`, `aoa-mighty`, `rapid` and a separate-turn `feint@`. There is no `aoa-feint`, and Rapid Strike can't include a feint. A separate `feint@` costs the whole turn and is discounted by GAMMA.
- **Fix**: add `aoa-feint@t` (feint roll at `lvl`, then one attack with the foe's defence lowered by the margin; the model has no defence next turn, like `aoa-double`) and `rapid-feint@t` (Rapid Strike, first roll a feint, both at `-rp`, defences kept). Value them with `planAttack(..., lvl)` at defence `def - E[margin]`; the expected margin is the `gain` of #151. Keep `feint@` for duels where the model wants to keep its defences.
- **Impact**: medium to big for skilled melee units, nil for horde units. Expected landed hits per turn against a foe with skill S and best defence D:

| Attack skill | Foe skill / defence | Attack | AOA (Double) | AOA (Feint) |
|---|---|---|---|---|
| 12 | 12 / 11 | 0.28 | 0.56 | 0.38 |
| 14 | 12 / 12 | 0.24 | 0.47 | 0.46 |
| 16 | 12 / 12 | 0.25 | 0.51 | 0.63 |
| 16 | 13 / 13 | 0.16 | 0.32 | 0.49 |
| 18 | 12 / 12 | 0.25 | 0.51 | 0.76 |
| 20 | 14 / 13 | 0.16 | 0.32 | 0.71 |
| 12 | 10 / 9 | 0.46 | 0.93 | 0.56 |

  AOA (Feint) beats AOA (Double) once the attacker's skill is 4 or more above the foe's and the foe's defence is 11 or higher, which is the situation of a Custodian, Exarch, Harlequin or Marine character against a Parry-12 foe. It loses against soft targets, so the AI should compare the two, not always feint.

### 155. Telegraphic Attack (medium, M)
- **Rule** (MA113, MA rule): "You can carefully line up an attack ... gaining the +4 for routine skill use ... all active defenses against a Telegraphic Attack are at +2!" It is the opposite of Deceptive Attack and can't be combined with it, can't be a Riposte, gains nothing from an earlier feint, and doesn't stack with Evaluate. "You can combine it with all other combat options." The +4 doesn't change the critical-hit range (use skill before the bonus). Anyone may attempt it, and MA says it is for offsetting called-shot penalties, shock and other attacks "at the edge of their skill".
- **Sim**: none. `planAttack` tries locations and Deceptive levels only.
- **Fix**: add a Telegraphic branch to `planAttack` (`eff + 4`, defence `+ 2`, mutually exclusive with `da > 0`, crit range from the unmodified level) and a flag `tele` in `strike`. It combines with All-Out Attack (Determined) for +8.
- **Impact**: medium for elites and for weak attackers. Landed hits against a defence of 9: skill 8 goes from 0.16 to 0.28, skill 9 from 0.23 to 0.31, skill 10 from 0.31 to 0.34, skill 12 falls from 0.46 to 0.37. Against a defence of 12 it never helps. A called skull shot at effective 7 against a defence of 9 goes from 0.10 to 0.23; with All-Out Attack (Determined) added, the attack roll succeeds 95% of the time. So it lets elites that call shots (skill 17+) use the eye, skull and chink options much more often, and lets Gretchin-level attackers hit Marines a third more often. It is worse than plain skill once skill is more than 1-2 above the defence.

### 156. Committed Attack (medium to big, M)
- **Rule** (MA99-100, MA rule): a maneuver "between Attack and All-Out Attack". Determined: one attack at +2. Strong: one attack at +1 damage (GM's option: +1 per two full dice). Movement: a step or two steps, the second at -2 to hit, "step, attack, and step again - a tactic known as 'attack and fly out'". Defence: no parry with the hand that attacked, no block if the shield attacked, no dodge if kicked; any other defence at -2; no retreat.
- **Sim**: only Attack and All-Out Attack exist. `defOpts` returns null for `t.aoa`; `step-strike` and `step-aoa` step only before the blow.
- **Fix**: a `committed` flag on the model (like `aoa`) that makes `defOpts` subtract 2, remove the retreat and remove the parry when the parrying weapon was used (`t.u.melee` for one-weapon units). Options `ca-det@t` (+2), `ca-strong@t` (+1 damage or `Math.max(1, floor(dice / 2))`), each with an optional second step at -2, and `risk(..., "ca")`. The step after the blow lets a long-weapon model hit and step out of a shorter foe's reach (the Long Weapon Tactics of B388), which the sim never does.
- **Impact**: medium to big for models with a good Dodge or a shield. A model that would take All-Out Attack (Determined) at +4 with no defence can instead take +2 and keep Dodge -2, which is worth having whenever `risk(..., "aoa")` is large, as it is for Marines against Ork mobs. It changes little for units with Dodge 6-7 or no defence to keep. It also gives attackers a way to move two hexes and strike at +0 without Move and Attack's skill cap of 9.

### 157. Defensive Attack (small to medium, M)
- **Rule** (MA100, MA rule): "a cautious 'probing' attack made from a full guard position": -2 damage or -1 per die, whichever is worse, one step, any active defence, and before rolling a choice of +1 to one Parry or +1 to Block. With an unbalanced weapon, +1 to a different weapon's Parry, or a parry with the same weapon at no bonus (MA125: "A Defensive Attack ... does allow a parry after an attack with such a weapon"). A grab at the target gets +1 to defend. MA131: it stacks with Feverish Defense and All-Out Defense.
- **Sim**: none. `canParry` is false when `t.u.melee.unbalanced && t.attacked`, so an axe or maul user that attacks has only its Dodge.
- **Fix**: `da-strike@t` option with `dmgOverride` of -1 per die (min -2) and a flag that lifts the unbalanced restriction for that turn and gives `+1` to the parry option; `risk(..., "da")` accordingly.
- **Impact**: small to medium. The +1 is worth about 12 points of defence at Parry 10-12. It mostly matters for the unbalanced weapons the data carries (axes, mauls, Ork choppas) whose users currently give up their parry every time they swing, and as the middle option the AI lacks between Attack and All-Out Defense (see #176).

### 158. All-Out Attack (Double) plus Rapid Strike (medium, M)
- **Rule** (MA97-98, MA126-127, MA clarification of B370): "A warrior could choose All-Out Attack (Double) and make a Rapid Strike or Dual-Weapon Attack with one of his two attacks, giving him three attacks." Once per maneuver a fighter may trade one attack for a Rapid Strike (two attacks at an extra -6, half for Weapon Master or Trained by a Master), a Combination or a Dual-Weapon Attack. Cinematic (MA127): more than two attacks at -6 per extra attack (-12 for three), halved for masters, GM may cap adjusted skill at 12 and require Trained by a Master or Weapon Master for three or more.
- **Sim**: `rapid@` is offered under Attack only, and only when `lvl - rp >= 10`. `aoa-double` gives `n + 1` blows with no penalty. `strike` already puts `-rp` on blows `i < 2` when `opts.rapid`, so three attacks (two at `-rp`, one at full skill) fit the existing loop.
- **Fix**: add `aoa-double-rapid@t` with `strike(m, w, t, { double: true, rapid: true })` (n = 1 + 1 + 1 + extra attacks; first two at `-rp`), valued with the same sum. Keep the cinematic "more than two" behind a setting.
- **Impact**: medium for masters. Expected landed hits against a defence of 13 at skill 20: Attack 0.16, All-Out Attack (Double) 0.32, Rapid Strike 0.29 (0.32 for a Weapon Master), All-Out (Double) plus Rapid Strike 0.45 (0.48 for a master). For a Weapon Master at skill 16 against a defence of 11 it is 1.00 against 0.74. Only Custodes, Aspect Warriors and other Weapon Master or Trained by a Master templates gain; everyone else has `lvl - rp` below the useful range.

### 159. Extra attacks are lost when the first target falls (medium, M)
- **Rule** (MA127-128, B370, MA clarification): "A fighter who has two or more melee attacks with a given maneuver can use them to attack or feint multiple foes. He can alternate between opponents in any order he wishes - but each full yard (hex, on a battle map) he skips between targets 'wastes' one attack." B370's Rapid Strike says "You can target multiple opponents this way."
- **Sim**: `strike` loops `for (i < n && t.state === "ok" ...)` on one target, so once the target is down, the remaining blows of a Rapid Strike, All-Out Attack (Double) or Extra Attack are simply not made. Nothing lets the blows go to a second adjacent foe.
- **Fix**: pass `strike` a list of adjacent foes ordered by hex direction; after the current target is down (or by choice when the second target is worth more) move to the next hex in the same rotation, losing one blow per skipped hex. Value in `meleeOptions` as the best split.
- **Impact**: medium in mob fights, for multi-attack models (any template with `extraAttack`, Rapid Strikers, All-Out Attack (Double) users). A surrounded model with four attacks that drops its first foe with the first blow wastes three.

### 160. Dual-Weapon Attack: the -1 to defend, and melee pairs (small, M)
- **Rule** (B417, restated in MA83's Dual-Weapon Defense, MA clarification): "If you aim both attacks at a single opponent, he defends at -1 against them, as his attention is divided!" "You may 'trade' only one" of multiple attacks (B417, MA126). MA83 lets the Dual-Weapon Attack technique buy off the -4 (the sim reads that, `dualPen`).
- **Sim**: `dual@` in `meleeOptions` is offered only for a one-handed melee weapon plus a pistol, and passes `strike(..., { pen: pm })` and `fireAt(..., { pen: pg })` with no defence penalty. Two melee weapons, or a weapon and a shield bash, aren't offered.
- **Fix**: pass `feint + 1` (a plain extra -1) to `defend` for both halves. Later, allow two melee weapons for models that carry two ready one-handed blades (`u.melee2`).
- **Impact**: small: the -1 is worth about 12 points of hit chance against a defence of 10 to 12, for Ork Boyz with slugga and choppa and Marines with pistol and sword.

### 161. Parrying heavy weapons: weights, sweep-aside, breakage and Cross Parry (medium, M)
- **Rule** (B376, MA121, MA clarification): "you cannot parry a weapon heavier than your Basic Lift - or twice BL, if using a two-handed weapon"; the attack "sweeps it aside" and you drop the weapon if it survives. A weapon parrying "anything three or more times its own weight" breaks on 2 in 6 (1 or 2 on 1d), one more per whole multiple past 3, +2 cheap, -1 fine, -2 very fine; if the odds pass 6 in 6 the parry doesn't count. Unarmed attacks weigh ST/10 lb (full ST for a slam). MA's Cross Parry (two ready weapons, one parry at the better score +2, treated as a two-handed weapon of the combined weight; it ties up both weapons for the turn and a critical miss hits both) and Supported Parry (a hand on the weapon: +1, treated as two-handed).
- **Sim**: `defOpts` tests `aw.weight > t.u.bl * (w.oneHanded === false ? 2 : 1)`, but `mkWeapon` doesn't set `weight` on a weapon line (a search of `sim.js` finds it only on grenades, slams and shoves); only slams and shoves pass `weight: m.u.st`. So an ordinary blade parries a Carnifex scything talon, a Nob's power klaw or a Dreadnought fist with no chance of being swept aside or broken. #77 is only fixed for slams and shoves.
- **Fix**: read the item `weight` (the grenade code already does) into `w.weight`, treat natural and unarmed attacks as ST/10, block the parry above BL (2 x BL two-handed), and after a successful parry roll breakage from the weight ratio (`meleeBroken = true`, quality from the item). Breakage-resistant power and force weapons count as "fine". Optionally Cross Parry once a model can hold two blades.
- **Impact**: medium in fights against Nobz, Carnifexes, Necron lords and vehicles: right now their heavy hits can be parried like any others.

### 162. Stop Hits and the melee Wait (small to medium, M)
- **Rule** (MA108, MA rule): "attack into his attack in an effort to hit him while he's on the offensive." Both roll to hit; if one hits and the other doesn't, the struck fighter defends at -1 (-3 if he parries with the weapon he attacked with); if both hit, the larger margin defends normally and the other takes the penalty, a tie penalises both. Swings subtract 1 from the margin, and "A Matter of Inches" adds weapon weight and length modifiers (MA110). B366's Stop Thrust: a thrusting weapon on Wait gets +1 thrust damage per two full yards the attacker moved if the foe fails to defend.
- **Sim**: `wait-melee` and `afterStep` give the waiting model one strike as the charger steps into reach; the charger then defends normally and, if not stunned or downed, attacks itself. The charge's own attack isn't part of the exchange, and the stop thrust damage bonus isn't applied.
- **Fix**: the Basic rule stands; keep it unless the user wants Stop Hits. To adopt them, resolve the waiter's and the charger's attack rolls together in `afterStep` with the -1 / -3 rule. Add the stop thrust bonus in `strike` when `opts.stop` and the weapon's `usage` is a thrust.
- **Impact**: small to medium for long-weapon and spear Waits: MA's rule lowers the waiter's edge, because the charger's blow is part of the same exchange. It matters most for the Wait options in #176.

### 163. Counterattack and Riposte (small to medium, M)
- **Rule** (MA70, MA124-125, MA rule): Counterattack is a technique (default prerequisite skill-5) usable "on your turn immediately following a successful active defense" against that foe; the foe is at -2 to Parry, -1 to Block or Dodge. Riposte: declare before parrying and take a penalty to Parry (never below 8 before other modifiers except Enhanced Parry); if the parry works, your first attack next turn with the parrying weapon against that foe lowers one of his defences by that penalty and the others by half, cumulative with feints, and can't be a Deceptive Attack. An unbalanced weapon can't parry after attacking, so a Riposte with one takes a whole turn without attacking.
- **Sim**: none. `defend` always uses the best defence with no declared penalty, and `canParry` fails for unbalanced weapons that attacked.
- **Fix**: `t.riposte = {foe, pen}` set in `defend` when the parry option is chosen and the model's Parry minus 8 is at least 2; `strike` applies `pen` to the matching defence of `t` and half to the others when `m.riposte.foe === t` and the weapon is the parrying weapon; expire after one turn. Counterattack needs a technique in data and a `m.counter` flag set by any successful active defence.
- **Impact**: small to medium, for elite duels only. A Riposte at -4 turns a Parry of 14 into 10 (from 90% to 50% defended) and takes a Parry-11 foe to 7 (from 62% to 16%); it is a fair trade and only pays when the riposter out-damages or out-skills the foe. The AI should use it against a lone foe when its Parry is 13 or more.

### 164. Retreat: the sideways step, Sideslip, Slip and Dive (medium, M)
- **Rule** (B377, MA123-124, MA clarification of B377 plus MA rule): a retreat is a step "away from your attacker: at least one yard" (B377); in tactical combat, "any adjacent hex that's further from your enemy than your starting hex" (MA123). Sideslip (MA124): "any adjacent hex that's the same distance from your attacker"; defences "at -1 plus your retreat bonus (+1 or +3)": net +0 to blocks and most parries, +2 to dodges and fencing parries. Slip: an adjacent hex closer to the attacker, "You can step into close combat with him!"; defences at -2 plus the retreat bonus (net +1 at best); -1 more against a stop thrust. Dive: -1 plus the bonus, leaves you prone (-3 to later defences).
- **Sim**: `retreatHex` accepts any free hex with `dd >= d0` and prefers the farthest, so a model whose way back is blocked (a wall, or friends behind it, which is every model in a mob's front or flank) still steps sideways and takes the full +3 Dodge and +1 Parry or Block. That is a Sideslip at the wrong price.
- **Fix**: prefer a hex with `dd > d0` at the full bonus; a `dd === d0` hex counts as Sideslip (-1 to the whole bonus, so +2 Dodge, +0 Parry, +2 for +3 parries). Offer Slip as an AI option when the foe out-reaches the model (its weapon's `reachMax` is bigger and the model stands at the edge of that reach): step one hex closer to remove the reach advantage, at net +1 for a Dodge or a fencing Parry and -1 for other parries, and Dive only for cornered models with friends near.
- **Impact**: medium. Crowded melee and reach mismatches are where the sim's defenders currently get the biggest bonus for a step that MA prices as a net +0 to +2. Slip also gives short-reach models a reasonable way to fight a spear or a warscythe instead of losing a turn closing. MA125 lists Retreat Options among the cinematic mobility rules, so the Slip and Dive additions can be treated as optional.

### 165. Limiting Multiple Dodges, Restricted Dodge against firearms, Multiple Blocks (big if adopted, M)
- **Rule** (MA122-123, MA rule, gritty option): "The GM may assess a cumulative -1 per dodge after the first in a turn." "Restricted Dodge Against Firearms": if aware of a gunman and taking one of a set of maneuvers, a fighter may take "evasive movement" against that one foe as a free action and only then dodge his shots; he "can't dodge firearms attacks from any enemy but the one he specified". Multiple Blocks (a cinematic option): -5 per block after the first, halved for Weapon Masters. MA recommends exempting Trained by a Master and Weapon Master fighters from the first two. Parrying with Two-Handed Weapons (cinematic, reach 2+ two-handed weapons): -2 per extra parry, -1 for a Weapon Master, and a single parry at -1 against both halves of a Dual-Weapon Attack.
- **Sim**: `defOpts` gives every Dodge at full value however many attacks came in, and every ranged Dodge and Drop is against any shooter. Parries fall by `step * t.parries` as B376 says; only one Block per turn (`t.blocked`), which is stricter than MA's option.
- **Fix**: a setting `dodgeRule`: "basic" (now), "limited" (`t.dodges` counter reset with `t.parries`, `-1 * t.dodges` on the Dodge option, exempt `flags.master`) or "restricted" (a chosen `t.evasive = shooter` in `act`, Dodge against ranged fire only from that model). `master` models keep the Basic rule under both.
- **Impact**: big for both melee and shooting balance if the user turns it on. A model in a mob currently dodges six Ork attacks at full value; under "limited" its sixth dodge is at -5. Under "restricted" a squad of shooters can only be dodged against one at a time, which cuts the value of Dodge against bolter fire. It is off by default in MA and works against the user's cinematic tone, so this is a question for the user, not a fix.

### 166. Harsh Realism for Unarmed Fighters, and the Boxing and Karate retreat bonus (small, M)
- **Rule** (MA124, MA rule; B377): Bruised Knuckles (striking with an injured body part takes the shock penalty, or -damage), Defense Limitations (Boxing, Judo and Karate parry at +3 on a retreat only when stepping, +1 when diving; Dodge penalties apply to their Parry), Low-Line Parries (-2 to parry legs or feet with a hand), Parrying Weapons (unarmed skills "including Judo and Karate" parry weapons at -3, and failure by 3 or less still lands the attack on the limb), Striking Bone, Strong and Weak Hands (-4 skill and -2 ST for the off hand). "Those with Trained by a Master are never subject to" it.
- **Sim**: bare-handed parries against weapons are -3 unless the attack is a thrust or the defender has Judo (`defOpts`, `!t.u.judo`), which is B376-377; the +3 retreat parry is given only to `bare && t.u.judo` or fencing weapons (`w.fencing || (bare && t.u.judo) ? 3 : 1`), so Boxing and Karate models get +1 where B377 gives +3.
- **Fix**: give the +3 retreat parry to Boxing and Karate as well as Judo (Basic Set). Harsh Realism as a whole isn't recommended: MA says it is "unsuitable for most games" and it only touches `Punch` users, who are rare in the data. If adopted, apply the -3 to Judo and Karate parries against weapons and exempt `flags.master`.
- **Impact**: small.

### 167. Grappling: All-Out and Committed attackers, extra arms, Sprawling (small to medium, M)
- **Rule** (MA114-119, MA rule): "If you make an All-Out Attack, you're truly defenseless. You automatically lose any Contest to avoid a close-combat attack following a grapple. This includes all takedowns, pins ... " A Committed Attack costs -2 to those rolls. Extra Arms (MA115): each arm past two gives +2 to hit with a grapple, to keep a victim from breaking free and to break free yourself; with more arms than the foe, +3 to pin him or resist his pin. Sprawling (MA119): "fall willingly", the takedown works but the contest still runs at +3 for the defender; if the grappler loses or ties he falls too and loses the hold. Actions after a grapple need an Attack, All-Out Attack or Committed Attack.
- **Sim**: `wrestle` rolls a takedown and a pin contest every time, and never checks `t.aoa`. `gripsOn` and `gripST` don't count arms. There is no Sprawl.
- **Fix**: in `wrestle`, an automatic loss when `t.aoa` (and -2 in the contest when `t.committed`, after #156); +2 per extra arm in `grab` and in the contest for models with `armsExtra` (Tyranid Warriors, Hive Tyrants), and `+3` to pin with more arms; a Sprawl option for a held model that expects to lose the takedown, at +3 and taking the grappler down if it loses.
- **Impact**: small to medium in grapple mobs: a charging Marine that ended its last turn on All-Out Attack, which the AI does often, is currently as hard to take down as one that held back.

### 168. Held models and long weapons: MA's close-combat table (small to medium, M)
- **Rule** (MA117, B371, B391, MA clarification): "A reach 1+ weapon in close combat gives a skill penalty equal to -4 times its longest reach in yards ... This lowers skill for all purposes." Parry is computed from the reduced skill (-2 at reach 1, -4 at reach 2, -6 at reach 3). Swings do "-1 per yard of your weapon's maximum reach"; thrusts are unchanged; a reach 2 or 3 polearm can only do quarterstaff damage with the haft unless readied. "It doesn't matter whether your current target is in close combat with you! Just having someone in the way is enough." Pummeling, Armed Grapple and similar moves are exempt.
- **Sim**: the sim has no same-hex close combat; a grab is made from the adjacent hex and the grappled model uses `meleeOptions` with any weapon at -4 (`m.grips.length`), parrying at -4 skill (`- (t.grips.length ? 4 : 0)` in `defOpts`). #17 proposes to allow only reach C weapons; MA gives the softer official version.
- **Fix**: while `m.grips.length` (or a foe holds `m`), replace the flat -4 with -4 x `reachMax` on skill for every purpose, -1 per yard of `reachMax` on swings, and compute Parry from that reduced skill; reach C weapons and punches keep the flat -4 for being grappled. #17's simpler ban on non-C weapons stays valid for the strict Basic reading.
- **Impact**: small to medium. A Marine with a reach-1 chainsword held by two Ork Boyz swings at -4 (grappled) plus -4 (reach), not -4, which makes it much more likely to lose the fight in the mob; a reach C combat knife or a punch keeps -4. It also means models carrying long weapons are worse in a scrum than the sim shows.

### 169. Tip Slash (small, M)
- **Rule** (MA113, MA rule): "If your weapon can thrust for impaling damage, you can instead swing it so that the tip pierces and rips across your target laterally." Cutting damage equals the weapon's impaling damage at -2, at full skill, at the weapon's current maximum reach; parry and ST unchanged. It counts as a swing for the unarmed-parry rules.
- **Sim**: `bestMode` chooses only between the modes listed on the weapon table (thrust or swing with the same reach).
- **Fix**: for a weapon whose thrust is impaling (`imp`), add an alternate mode `{ ...thrust, type: "cut", add: add - 2 }` with `reachMax` unchanged; `planAttack` already picks the best mode against each target.
- **Impact**: small. It matters against foes with an impaling modifier below the cutting one: Homogeneous targets take impaling at x0.5 (the sim's `HOMOG`) and Unliving at x1, against cutting x1.5, so a spear or bayonet Tip Slash beats its own thrust against Necrons and walls once the thrust dice average above 3 or so.

### 170. Defensive Grip, Reversed Grip and Pummeling (small, M)
- **Rule** (MA109-112, MA101-104, MA rule): Defensive Grip gives +1 Parry against frontal attacks and an extra -1 against attacks from the side; a one-handed weapon held in two hands takes -2 to hit and +1 damage and is treated as two-handed; a two-handed weapon choked gives -1 breakage odds and -2 damage or -1 per die on swings. Changing grip is a Ready maneuver, never free even with Fast-Draw. Reversed Grip gives +1 thrust damage, -2 parries, and an extra -1 to the target's defence when a feint or Deceptive Attack succeeds.
- **Sim**: none.
- **Fix**: not worth modelling now. The one clear use, a two-handed-weapon model holding a doorway with no foe behind it, would be a Ready and a +1 Parry. If the user adds it, make it a stance set by `act` when the model is waiting in a doorway, with `defOpts` adding +1 or -1 by arc.
- **Impact**: small. Recorded so the user knows it was read and skipped.

### 171. Targeted Attacks: repeating a called shot (small, M)
- **Rule** (MA68, MA rule): the technique buys off up to half of a hit location penalty; "Repeating a Targeted Attack makes you predictable. If you use the same TA twice on a foe in a fight, he defends at +1 against your third and later uses!" Chinks default to -10 (-8 on the torso) as in the sim; attacks at weapons default -4.
- **Sim**: elites call shots by default and `planAttack` picks the same best location every blow; no technique is read.
- **Fix**: only if the data gets Targeted Attack techniques: reduce the location penalty by half (rounded up) for models that have one, and track `m.taUse[t.id + loc]`, adding +1 to the target's defences from the third use. For called shots without the technique the Basic Set has no such rule.
- **Impact**: small. Buying off half of a skull's -7 (leaving -3) would make elite skull shots cheap; that is a data decision.

### 172. Extra effort in combat (medium to big, M, cinematic)
- **Rule** (MA131-132, MA rule): the GM may restrict extra effort to Trained by a Master or Weapon Master fighters, or open it to everyone. Notes: Feverish Defense is incompatible with Committed Attack and All-Out Attack, and its +2 "stacks" with Defensive Attack (+1), All-Out Defense (+2) and Defensive Grip (+1); Mighty Blows is "exclusively an option for Attack", not All-Out, Committed, Defensive or Move and Attack (this agrees with #3), at 1 FP per attack. New options, each 1 FP: Giant Step (an extra step with Attack or Defensive Attack), Great Lunge (the effects of All-Out Attack (Long): +1 reach, -2 damage or -1 per die on swings, without losing defences), Heroic Charge ("If you make a Move and Attack, you can spend 1 FP to ignore both its skill penalty and its effective skill cap in melee combat", but no parry or retreat), Rapid Recovery (parry with an unbalanced weapon after attacking). Flurry of Blows is #70. One offensive and one defensive option per turn; a critical failure costs 1 HP.
- **Sim**: Mighty Blows and Feverish Defense only; `approachOptions` caps charges at skill 9 (`Math.min(9, w.level - skillPen(m) - 4)`); `feverish` lets any model with FP above a third of its pool buy +2 against a blow worth a fifth of its HP.
- **Fix**: a setting `cinematicEffort`. Heroic Charge in the `charge@` option: `lvl = w.level - skillPen(m)` for 1 FP, when `m.fp` allows; Great Lunge as +1 `reachMax` for one blow at 1 FP; Giant Step as a second step on `step-strike`.
- **Impact**: medium to big for charge-stance melee units if the user allows it. A skill-15 charger rolls at 9 (38% before the defence) after the -4 and cap; Heroic Charge takes that to 15 (95%), for 1 FP of a 10-13 pool. That is the largest single boost to the first turn of a charge. Necrons and other machines have no FP (#109) and get none of it. Everything here is cinematic per MA, so it stays off unless chosen.

### 173. Untrained fighters (small, M)
- **Rule** (MA113, MA rule): "Only combatants with at least DX level in a melee combat skill (1 point if Easy, 2 points if Average, or 4 points if Hard) can choose a Committed Attack, Defensive Attack, or Feint maneuver, or exercise combat options such as Deceptive Attack, Defensive Grip, and Rapid Strike. Exception: Anyone can attempt a Telegraphic Attack." Untrained fighters also make a Fright Check when the fight starts, and then act by a coin toss each turn (1-3 an All-Out Attack (Determined), 4-6 an All-Out Defense).
- **Sim**: `feint@` is offered to any model whose target's best defence is above 50%; Deceptive Attack and Rapid Strike have effective-skill floors (10 and `lvl - rp >= 10`), which serve as a proxy. Fright Checks already run at half and quarter strength, not at the start.
- **Fix**: require `melee.level >= dx` (and, for a Combat Art or Sport user, DX+3) before offering feint, Committed and Defensive Attack, Deceptive Attack or Rapid Strike; leave Telegraphic open to all. The coin toss and start-of-battle Fright Check are optional for cannon fodder (Gretchin, Cultists, Conscripts).
- **Impact**: small. It removes odd feints by low-skill models and gives unskilled mobs the extra Telegraphic option (#155).

### 174. Ranged feints and Prediction Shots (small, M)
- **Rule** (MA121, MA rule): Prediction Shots: Deceptive Attack for ranged weapons where "the defense penalty reduces Dodge but not Block or Parry", still at effective skill 10 or better. Ranged Feints: a shooter may feint (fake a shot) if he could hit and the victim is aware of him; all attack modifiers apply, and shooters may use All-Out Attack (Feint). The GM may reserve both for Heroic Archers or Weapon Masters.
- **Sim**: the house rule "Deceptive Shot" (docs/simulator.md) matches Prediction Shots on the Dodge-only point; the house rule also lets it reduce a Parry at point-blank, which MA doesn't. There are no ranged feints.
- **Fix**: none required; the house rule is the user's. If ranged feints are wanted, resolve them as #151 with the shooter's ranged skill against the target's best melee skill and subtract the margin from the Dodge of the next shot at that target.
- **Impact**: small: burst fire removes only `1 + margin` hits per successful Dodge, so a lower Dodge helps little.

### 175. Acrobatic Stand (small to medium, M)
- **Rule** (MA98, MA rule): from lying down, a Change Posture maneuver with an Acrobatics roll "at -6 with an additional penalty equal to encumbrance level" takes you to standing; a critical success does it as a step; failure ends the turn sitting, critical failure leaves you down. From crawling or sitting, the same roll (also -6 and encumbrance) stands you as a step; failure stands you but as a Change Posture; critical failure falls.
- **Sim**: `act` lets a prone model with an Acrobatics skill spring up on `check(acro.level - skillPen(m))`, one turn, with no -6 and no encumbrance.
- **Fix**: `acro.level - 6 - encLevel(m) - skillPen(m)` (the encumbrance level is in the unit stats); a critical success lets the model use the rest of the turn; failure leaves it kneeling (sitting isn't modelled).
- **Impact**: small to medium for the few templates with Acrobatics (Eldar, Harlequins, Wyches). Acrobatics 16 stands up on 98% now against 50% at -6.

### 176. AI tactics the MA options change: who should Feint, when to All-Out Defend (medium, M)
- **Rule** (MA126, MA131, MA125, MA clarification): "Encourage options that lower defenses. Deceptive Attacks, feints, Ripostes, and Stop Hits add complexity ... but reduced defenses increase the odds that a blow will land and end the fight." All-Out Defense (+2), Defensive Attack (+1), Defensive Grip (+1), retreat (+3 Dodge) and Feverish Defense (+2) stack, so "a fighter can buy a lot of time"; MA suggests the GM allow the whole stack only for characters in the grip of a mental disadvantage.
- **Sim**: `act` offers `aod` whenever a melee foe can reach the model this turn and scores it as the risk saved times `aodHelp` (how well squad-mates can kill the threat in the next turns). `feint@` is scored at GAMMA times a foe knocked out next turn. Neither uses skill gap or the number of friends who benefit.
- **Fix**: for Feint, prefer the same-turn forms (#154) when own skill is 4 or more above the foe's and its best defence is 11 or more, and the separate-turn Feint only against a foe that will not attack back (a Waiting or All-Out Defense foe) or when the model must keep its defences. For All-Out Defense: take it when the model is outmatched and help is 2 turns away (as now); against a foe it can still hurt, prefer Defensive Attack (#157) or a plain Attack with a retreat, since the model keeps its blow. Count the stacked bonuses honestly in `risk(..., "aod")`: a Dodge of 9 with All-Out Defense, retreat and Feverish Defense is 16, which is why a lone Marine can stall a whole mob, and check whether the sim's `aodHelp` is too generous to that stall.
- **Impact**: medium; this is where the AI's choices between Attack, Feint, All-Out Attack and All-Out Defense would change most once #154, #156 and #157 exist.

### Checked in Martial Arts, no change needed
- Deceptive Attack is B369 (-2 to skill for -1 to the defender, never below 10); MA111 adds only flavour, and the sim's floor and per-location optimisation in `planAttack` match. MA112 gives an extra -1 against a Reversed Grip; not modelled (#170).
- Weapon Master and Trained by a Master halve Rapid Strike and multiple-parry penalties once, "they don't divide by 4" (MA48-49): `flags.master` is a single boolean, correct.
- Extra Attack and All-Out Attack (Double) add up as MA126 says (`n = 1 + double/rapid + extraAttack`); Determined, Strong and Long add no attacks.
- Feint resists with DX or weapon skill as B365 says; a feint never unreadies a weapon (MA127); the sim's `strike` leaves readiness alone after a feint.
- Mounted and cavalry rules (MA Cavalry Training, Combat Riding, mounted styles): no mounts in the sim, not applicable.
- Cinematic skills (Power Blow, Kiai, Push, Immovable Stance, Blind Fighting, Precognitive Parry, Pressure Points, Flying Leap, Light Walk, Lizard Climb) and chambara rules (leaps, steps traded for attacks, MA128-130): optional and cinematic. None of the 40k templates in `Library` carries them, and the Contest of Wills and Mind Games (MA130) overlap the Fright Check morale rule. Not recommended for this sim; Flying Leap and Light Walk would only matter on the facility map if models could cross walls.
- Postures, Hit Locations and Techniques (MA96-99): the sim's Basic postures (-4 attack and -3 defend prone, -2 kneeling) are the generic values MA starts from; the detailed per-location and per-attack tables are for extreme realism and not worth the bookkeeping.
- Realistic Injury (MA136-139: Partial Injuries, Extreme Dismemberment, New Hit Locations such as joints, spine, veins and arteries, Severe Bleeding): built on standard HP thresholds and "intended for humans", not for models with Injury Tolerance, and the user's Revised Fractional Health has no HP/5 or HP/3 thresholds to hang them on. Recorded, not recommended.
- Teeth, Close Combat and Body Morphology, Bear Hugs, Grab and Smash: only the Extra Arms and Sprawling parts are worth a look (#167); the rest is for individual grapples and doesn't change squad fights.
- Fencing Parries (MA122): +3 on a retreat with a fencing weapon and half the multiple-parry penalty are in `defOpts` already (`w.fencing`); MA's Encumbrance-limits-Parry note applies only to fencing weapons and would touch Eldar and Harlequin blades.
- Weapon quality by balance (MA Weapons of Quality: cheap -1 skill, fine +1) and the weapon length ranking in A Matter of Inches (MA110): no data for either, and they only feed Stop Hits (#162), Beats and heavy parries.
