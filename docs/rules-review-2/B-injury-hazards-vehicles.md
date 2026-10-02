# Review B: damage, injury, conditions, hazards, terrain, morale, powers and vehicles

Read-only review of `tools/sim/engine` against the Basic Set (B), Martial Arts (MA), Tactical Shooting (TS), High-Tech (HT) and Powers (P). Nothing in the repository was changed. Line numbers are the current part files (`tools/sim/engine/NN-*.js`). Engine files read in full: 10, 20, 30, 45, 50, 51, 52, 55, 58, 69; in part: 53, 59, 60, 61, 62, 63 and `tools/build_site.py` (`combat_flags`).

Two of the findings were confirmed by running the engine, not only by reading it:

- The limb finding (N1) was run on a scratch copy of the assembled engine with a debug hook. A Guardsman (HP 11) whose arms had each taken two 3-point wounds (6 a side, over HP/2) was not crippled, and eight further 200-point blows to the arms did 0 injury and crippled nothing. A fresh arm hit once for 200 lost 6 HP and was crippled.
- The blast finding (N2) shows in ordinary battle logs: a mortar shell "on target" lists every neighbour under "blast catches ..." but never the model on the target hex (14 on-target shells in six seeded fights, mortar squad against Ork Boyz).

Impact is the effect on simulated fights. Confidence is in the reading of the book and of the code path together.

---

## 1. Earlier findings in this scope: current status

Numbers are those of the summary table in `docs/gurps-rules-review.md`.

| # | Earlier finding | Status now | Evidence |
|---|---|---|---|
| 2 | Fright Check modifiers | Fixed, plus a house rule: heat of battle +5, Combat Reflexes +2, Fearlessness and Cowardice are in; the cap of 13 is deliberately dropped for morale and under-fire checks (documented), kept for Shadow in the Warp. See N8 for a side effect of dropping the cap. | 51-battle-terrain.js:445-446; 69-battle-turns.js:61, 140 |
| 3 | Mighty Blows | Fixed: offered with a plain Attack, 1 FP spent before the roll, hit or miss | 61-battle-close-options.js:119-122; 55-battle-attacks.js:427, 456 |
| 10 | Knockdown drops held items | Fixed | 52-battle-injury.js:139-145 |
| 11 | Knockdown roll for head and vitals hits that cause shock | Fixed, with a gap (N10) | 52-battle-injury.js:133-136 |
| 12 | Chinks for every damage type | Fixed | 53-battle-defence.js:75-76 |
| 13 | Hard to Kill collapse | Fixed | 52-battle-injury.js:155 (Fractional Health: 68) |
| 14 | Natural DR on the eyes | Documented house rule (user decision 7): the eye is as tough as the head unless the trait gives an eye figure | 30-wounds.js:9-10; docs/simulator.md:194 |
| 21 | Miss by 1 hits the torso | Fixed for guns and for blows | 55-battle-attacks.js:202-212, 433; 45-aim-and-cover.js:8 |
| 22 | Critical Head Blow Table | Fixed | 52-battle-injury.js:387-398 |
| 26 | Cover penalty and cover DR together | Fixed | 51-battle-terrain.js:403-411; 52-battle-injury.js:420-425 |
| 28 | Fragments | Fixed (bodies screening fragments is a documented house rule) | 52-battle-injury.js:620-634 |
| 29 | Scatter distance | Fixed | 55-battle-attacks.js:219, 266; 61-battle-close-options.js:347, 376 |
| 30 | Large-area injury | Fixed for cones, blasts and collateral; a direct hit by an explosive keeps its hit location (earlier question 12, never ruled on) | 30-wounds.js:27-36; 52-battle-injury.js:427, 615; 55-battle-attacks.js:302 |
| 31 | Cone shape | Fixed (a miss catches nobody: documented simplification) | 55-battle-attacks.js:276-303 |
| 34 | Half damage at or beyond 1/2D | Fixed | 55-battle-attacks.js:188 |
| 35 | Armour divisor DR floor | Fixed for the floor of 0. Still open: with a fractional divisor DR 0 should count as 1 (N12) | 52-battle-injury.js:436 |
| 37 | Critical Hit Table rows 14 and 8 | Rows fixed. Row 8 on a limb is a one-moment effect (drop or fall), not the 16 - HT seconds the table gives; documented that way | 52-battle-injury.js:124-128, 406-407 |
| 38 | Rule of 16 | Fixed | 55-battle-attacks.js:159-160 |
| 39 | Shock rounding | Fixed | 52-battle-injury.js:115-119 |
| 40 | Double-shock cap; groin | Cap fixed. Groin (double crushing shock, -5 to knockdown, B399) still open, as the progress note says | 52-battle-injury.js:117, 134-136; 51-battle-terrain.js:431 |
| 41 | Crippled leg halves Dodge | Fixed in standard HP. A later user direction (changelog: "One crippled leg is lameness, not collapse") lets a model with one crippled leg stand and hobble at Move -3; `docs/simulator.md` lines 181 and 195 still say it can only crawl, so the doc is stale | 52-battle-injury.js:26-27; 51-battle-terrain.js:430, 590; docs/changelog.md:230 |
| 42 | Mortal wounds | Fixed | 52-battle-injury.js:150-154 |
| 43 | Eye hits | Multiplier fixed. Blinding over HP/10 (B399, B421) still not modelled | 30-wounds.js:16 |
| 44 | Vitals and shield arm | Vitals restricted to piercing, impaling and tight beams. Shield-arm penalty still open | 53-battle-defence.js:76 |
| 45 | No Blood | Fixed | tools/build_site.py:354-357; 69-battle-turns.js:95 |
| 46 | Blunt trauma through cover | Fixed | 52-battle-injury.js:455-456 |
| 50 | Below 1/3 FP | Fixed for Move and Dodge (ST in contests not halved, as noted) | 51-battle-terrain.js:569-570, 590 |
| 51 | 0 FP | Fixed: Will roll, HP for FP below 0, collapse at -FP | 69-battle-turns.js:49; 51-battle-terrain.js:562-568 |
| 57 | Explosion collateral radius | Changed to 2 yards per die but counting the dice before any multiplier. `docs/simulator.md` cites B414 for this, yet B414's own example gives 24 yards for 6d x 2. Documented, and worth 1-2 points at most beyond the engine's radius, so it changes nothing | 52-battle-injury.js:595-598 |
| 59 | Explosive bursts | Fixed | 55-battle-attacks.js:259-260 |
| 67 | All-Out Attack (Strong) scope | Fixed | 61-battle-close-options.js:119-121, 147 |
| 70 | Flurry of Blows | Fixed | 61-battle-close-options.js:133; 55-battle-attacks.js:409 |
| 71 | Critical failure with extra effort | Fixed for blows and defences | 55-battle-attacks.js:427; 53-battle-defence.js:264 |
| 75 | Shadow in the Warp failure and mental stun | Fixed: the table is rolled, recovery by row, IQ +6 with Combat Reflexes for other mental stun | 51-battle-terrain.js:539-561; 55-battle-attacks.js:318 |
| 79 | Knockback | Fixed for ranged crushing hits, best of DX, Acrobatics or Judo, Perfect Balance. Cutting knockback is still melee only | 52-battle-injury.js:445, 573-584 |
| 80 | Follow-up damage | Fixed: an explosive follow-up bursts on the armour that stopped its carrier; "while ablaze" lines become burning | 52-battle-injury.js:461-465; 20-units.js:206 |
| 81 | Injury Tolerance handling | Fixed. One leftover: a No Brain model still rolls for a shock-causing face hit and takes -5 on a major face wound (B420 exempts the face too). Only the Rubric Marine has No Brain | 30-wounds.js:13-25; 52-battle-injury.js:107, 134 |
| 82 | Crippled arm | Fixed, with one difference (N13: a crippled shield arm loses the whole shield) | 52-battle-injury.js:17-24 |
| 83 | Bleeding | Fixed | 69-battle-turns.js:94-100 |
| 84 | Slam damage and knockdown | Fixed | 62-battle-reactions.js:106-125 |
| 86 | Hurting yourself | Fixed | 52-battle-injury.js:448-452 |
| 91 | Attacking an area | Fixed | 61-battle-close-options.js:342-354 |
| 92 | Overpenetration | Implemented, with the armour divisor applied to the wrong part (N7) | 55-battle-attacks.js:104-115 |
| 93 / 112 | Afflictions | Agoniser only, as the docs say. The item's own note asks for Severe Pain, which the engine gives (-4, -2 with High Pain Threshold). No loadout carries the other affliction lines (checked `data/sim/loadouts.yaml` and `squads.yaml`) | 20-units.js:203; 52-battle-injury.js:499-506 |
| 113 | Catching fire | Implemented; three small gaps (N14) | 52-battle-injury.js:419, 509-537 |

Still undecided from the earlier review's questions: whether Resistant to Poison should halve toxic injury (question 4). The engine still halves it (52-battle-injury.js:470, 488) and `docs/simulator.md` does not mention it. By the book Resistant only adds to HT rolls to resist (B80-81), and these follow-ups have no roll. 22 templates carry the flag (Orks, Custodes, Plague Marines among them), so it is worth a line in the doc as a house rule, or removing.

---

## 2. The pages the earlier review could not read

The supplement in `docs/gurps-rules-review.md` covered B427-434 later, but before elevation and vehicles existed. Against the current engine:

**Fatigue (B426-427).** Right: below 1/3 FP halves Move and Dodge (51-battle-terrain.js:569-570, 590); at 0 FP or less a Will roll before acting, collapse on a failure (69-battle-turns.js:49); FP spent below 0 costs HP one for one and -FP collapses the model (51-battle-terrain.js:562-568); machines have no FP (51-battle-terrain.js:563). Not modelled, and harmless in a fight: the heart-attack roll on a critical failure, the end-of-battle FP cost, being both under 1/3 HP and under 1/3 FP (the book's effects are cumulative; the engine halves once).

**Afflictions and incapacitating conditions (B428-429).** Right: Severe Pain is -4, halved by High Pain Threshold (52-battle-injury.js:502; 51-battle-terrain.js:431). Only the Agoniser's line is modelled; that is documented. Mortal conditions never arise.

**Collisions (B430-432).** Right: the dice formula and its rounding (62-battle-reactions.js:106); each side takes the other's dice in a slam, and the twice-the-damage knockdown rule (B371; 62-battle-reactions.js:117-124). Partial: a vehicle's overrun uses a fixed 5 yards a second whatever it is doing and leaves out the overrun's extra thrust damage for half its HP (B432; 20-units.js:420), documented as a simplification. Missing: knockback into a wall or another figure stops short with no collision damage to either (B378 sends you to B430; 52-battle-injury.js:579). Small.

**Falling (B431).** Not modelled, and listed as such. With gantries, ridges and three-storey ruins now on the map, knockback off an edge and voluntary drops of two yards are the cases that would matter. The engine lets a model step down two yards for one movement point and take nothing (51-battle-terrain.js:212); by the table a two-yard fall is a 7 yd/s collision with a hard surface (twice the faller's HP in the formula): 1d crushing for a 10 HP man, 3d for a 22 HP one, before armour, and falls count all armour as flexible for blunt trauma. Small.

**Fire (B433-434).** Right: 3 points of basic burning damage lights part of the clothing, 10 all of it; 1d-4 or 1d-1 a second as large-area injury; -2 or -3 DX; nothing when the flames cannot get through the gear; a Ready and a DX roll, or three Readies rolling on the ground (52-battle-injury.js:419, 509-537; 51-battle-terrain.js:431). Gaps are in N14.

**Electricity (B432).** Not applicable: weapon lines carry their own damage, and the stun riders on shock mauls and arc weapons are affliction lines that no loadout uses.

---

## 3. New findings, by impact

### N1. A limb that has taken any injury can no longer be crippled, and then stops taking injury

- **Kind:** wrong. **Impact:** medium. **Confidence:** high (run and confirmed, see the top of this file).
- **Book:** B420-421, B399. Injury over HP/2 to a limb or HP/3 to an extremity in one blow cripples it, and that blow does no more injury than the minimum needed. The optional Accumulated Wounds rule (box, B420) tracks injury per body part instead: the total passing the threshold cripples it, and later injury there is ignored.
- **Code:** `applyHit` keeps a running total per limb side and caps each hit at what is left of `floor(HP/2)+1` (or `floor(HP/3)+1`) (52-battle-injury.js:475-481). `injure` then tests the capped injury of this one hit against HP/2 or HP/3 (52-battle-injury.js:121-123). The first rule is Accumulated Wounds, the second is the single-blow rule. Together: after any earlier wound to that side, the cap is at most HP/2, so the test can never pass again. The limb fills up to the threshold without being crippled, and from then on every hit there does 0. The vehicle track code in the same file does it correctly (cumulative test, 52-battle-injury.js:342-344).
- **Effect on fights:** arms and legs are 107 of 216 random hits. A scratch from a lasgun or a fragment on an arm makes that arm immune to crippling for the rest of the fight, so no dropped weapon, no fall, and no major-wound knockdown roll (a crippling is a major wound). Tough models that soak many small wounds (Orks with Damage Reduction, Marines taking blunt trauma and chip damage) benefit most; one-shot weapons are unaffected.
- **Fix:** pick one rule. To keep the documented cumulative cap: in `applyHit`, after updating `limbInj[side]`, pass a flag to `injure` when `took <= threshold && took + inj > threshold`, and cripple on that flag instead of on `inj > lim`. To follow the standard rule instead: cap each blow at `lim0` on its own and drop `limbInj`. A regression test can use the scenario above.

### N2. An explosive that lands on an occupied hex does no blast damage to the figure standing there

- **Kind:** wrong. **Impact:** medium (large for mortars). **Confidence:** high (seen in logs).
- **Book:** B414. Whoever is struck takes the listed damage; everyone else takes it divided by three times the distance in yards. Attacking an area: no defence, but those there may dive for cover.
- **Code:** `explosion` skips anyone at distance 0 (`if (d < 1 || d > reach) continue`, 52-battle-injury.js:604), on the assumption that the caller has already dealt with the figure on the hex. Thrown grenades do (`landOn`, 61-battle-close-options.js:352, 367, 378). These callers do not:
  - indirect fire, `lobShell` (59-battle-special-options.js:248-257): a mortar round that is on target does nothing but fragments to its target;
  - a missed direct-fire explosive that scatters onto someone (55-battle-attacks.js:219);
  - a dodged explosive that lands on someone else (55-battle-attacks.js:266).
- **Effect on fights:** a mortar's 6d x 2 never reaches the model it was aimed at; the neighbours two yards away take more blast than the target. Krak and frag missiles, plasma and battle-cannon shells that miss or are dodged spare whoever stands on the landing hex.
- **Fix:** call `landOn(m, w, at, raw)` before `explosion` in those three places (it already gives the occupant a dive and full or one-third damage), or move that step inside `explosion` when no `struck` model is passed.

### N3. The Vehicle Hit Location Table is not the book's

- **Kind:** wrong. **Impact:** medium in any fight with a vehicle. **Confidence:** high for rows printed in the table (the extracted text is clean there and the rows read in order).
- **Book:** B554. 3-4 exposed weapon mount (or small window); 5 independent turret; 6-7 and 13-14 tracks; 8 and 12 main turret; 9-10 body; 11 open cabin (or large window); 15-16 wheel (or runner); 17-18 vital area.
- **Code:** `vehLoc` (52-battle-injury.js:210-219) has tracks on 6-7 and 15-16, main turret on 8 and 13-14, open cabin on 12, wheels on 17-18, and no vital area. `docs/simulator.md:239` repeats the engine's rows and cites B554.
- **Effect on fights (chances out of 216):** tracks 41 instead of 61, so a tank is immobilised a third less often than the book has it; main turret 57 instead of 46; a Trukk's wheels 4 instead of 16; open cab 25 instead of 27; and random fire never finds the vital area (4 in 216, triple injury for piercing and impaling, double for a tight beam), which only an elite's called shot can reach now.
- **Note:** the printed table has no row for legs (code L), so putting a walker's legs with the tracks is the engine's own reasonable extension; with the fix they would share 6-7 and 13-14.
- **Fix:** `r <= 4` mount; `r === 5` independent turret; `r <= 7 || r === 13 || r === 14` track or legs; `r === 8 || r === 12` main turret; `r === 11` open cab; `r === 15 || r === 16` wheel; `r >= 17` vital area; otherwise body. Correct the doc line and add a table test beside the existing `vehicleLocs` one.

### N4. High Pain Threshold gives +3 to recover from stun

- **Kind:** wrong. **Impact:** small to medium (40 templates carry the trait, all Astartes, Orks and Necrons among them). **Confidence:** medium; what would raise it is an official ruling, since the trait's wording is the only source.
- **Book:** B59 gives +3 on HT rolls to avoid knockdown and stunning. B420's recovery roll at the end of each stunned turn is a plain HT roll.
- **Code:** `recoverStun` adds 3 for the trait in standard HP (51-battle-terrain.js:559).
- **Effect:** an HT 12 model shakes off stun 95% of the time instead of 74% each second, so stuns on tough troops almost never last past one turn.
- **Fix:** drop the `+ 3` from the recovery level (keep it on the knockdown roll at 52-battle-injury.js:136).

### N5. Diving for cover: no +3, and only from thrown grenades

- **Kind:** partial. **Impact:** small to medium. **Confidence:** medium-high.
- **Book:** B377: diving for cover is a Dodge and Drop, which is +3 to Dodge. B414: anyone caught in a blast may try it, against collateral damage and fragments, whatever delivered the explosive.
- **Code:** `dive` rolls plain Dodge (61-battle-close-options.js:323), while the ordinary ranged defence does add the +3 for dropping (53-battle-defence.js:230-232). `explosion` offers the dive only when `w.thrown` (52-battle-injury.js:607), so nobody dives from a missile, shell, mortar round or plasma burst except the one figure `landOn` handles.
- **Effect:** grenade dives succeed less often than the book allows (Dodge 9: 37% instead of 74%), and squads under shellfire stand and take it.
- **Fix:** add 3 in `dive`; let `explosion` offer the dive for any explosive the model could see coming (keep the "worth diving from" test).

### N6. Vehicles: three damage effects left out

- **Kind:** missing. **Impact:** small each. **Confidence:** medium (the rules are clear; how far to take them for a one-hex vehicle is a design call).
- **Shock.** B484: an artifact without backup systems passes the usual shock penalty to whoever uses it next turn (a vehicle's driver, by the book's example). The engine gives every vehicle High Pain Threshold (20-units.js:430) and `docs/simulator.md:238` says "no shock" citing B462. With 300-400 HP a hit must do 30-40 injury per point, so penetrating anti-tank hits would put the gunners at -1 to -4 for a second.
- **Control rolls.** B469: a control roll whenever the vehicle takes major damage or knockback; failing it wipes accumulated Aim and penalises all fire from the vehicle by the margin, worse failures crash it. Nothing in 58-battle-vehicles.js rolls control skill. `docs/simulator.md` lists other vehicle omissions but not this one.
- **Flammable hulls.** Six of the seven vehicles carry HT code "f" (B463, B555, B137): after a major wound, an HT roll (-3 for a burning or explosive attack, -3 for a vital-area hit) or the vehicle catches fire for 1d-1 a second. The code is read into `veh.code` (20-units.js:425) and never used.
- **Fix:** drop `hpt` from the vehicle flags and apply the hull's shock to the crew's gunnery and driving next second; a control roll in `vehHit` when `maj` is true (52-battle-injury.js:366); a fire state for coded hulls.

### N7. Overpenetration: the armour divisor is applied to the DR only, not to the whole cover value

- **Kind:** wrong. **Impact:** small. **Confidence:** high (the book's worked example settles it).
- **Book:** B408. Cover value is DR on both sides plus HP (half for Unliving, a quarter for Homogenous), and the divisor is applied last, to the total. The example halves 16 + 12 together.
- **Code:** `floor(2 x DR / div) + HP share` (55-battle-attacks.js:109). The shield code does it the book's way (52-battle-injury.js:570).
- **Effect:** shots with a divisor pass through bodies less often than they should. For a divisor of (5) the engine asks the shot to beat 2 x DR / 5 + HP, the book (2 x DR + HP) / 5: against an Ork Boy (HP 32, little DR) that is about 32 against about 7.
- **Fix:** `Math.floor((2 * dr + hpShare) / div)`.

### N8. Fright Check Table: a failure on 17 or 18 feeds a negative margin into the table

- **Kind:** wrong (a side effect of the documented no-cap house rule). **Impact:** small. **Confidence:** high on what the code does; the intended result under the house rule is the user's call.
- **Book:** B360-361: roll 3d plus the margin of failure. With the Rule of 14 the margin is always at least 1.
- **Code:** with no cap, a model at effective Will 18 or more fails only on 17-18, and `-r.margin` is then negative (51-battle-terrain.js:486, 489; 69-battle-turns.js:140), so `frightTable` rolls 3d minus up to 8 (51-battle-terrain.js:540). A Marine at 25 who rolls 17 gets 3d-8: nearly always the one-second stun with automatic recovery.
- **Also in the table:** row 15 stuns for 2d seconds where the book gives 1d for both 14 and 15 (51-battle-terrain.js:549); row 12 is 1d seconds of stun where the book has 25 - HT seconds of retching (-5 to act, not stunned); rows 22-25 (new mental or physical disadvantages, no immediate effect) take the model out of the fight, which `docs/simulator.md:192` does state.
- **Fix:** `frightTable(m, Math.max(1, -r.margin), why)`; `stun(d6(), ...)` for both 14 and 15.

### N9. Firing up and down is applied to beam weapons

- **Kind:** wrong. **Impact:** small. **Confidence:** high.
- **Book:** B407 says to ignore the up and down range adjustment for beams such as lasers.
- **Code:** `rngD` adjusts every shot (51-battle-terrain.js:16-22; callers 55-battle-attacks.js:177, 58-battle-vehicles.js:33).
- **Effect:** lasguns, lascannon and other beams gain or lose a range step from a ridge or gantry that only projectile weapons should. The ridge result quoted in the changelog (Guardsmen against Guardsmen going from 18-22 to 40-0) credits B407's range edge among its causes; for lasguns that edge should not exist. Not measured.
- **Fix:** skip `rngD` for weapons matching the engine's existing `BEAM` test (55-battle-attacks.js:327).

### N10. Knockdown roll for head and vitals hits depends on the shock counter moving

- **Kind:** partial. **Impact:** small. **Confidence:** high for the cap case, low for the High Pain Threshold case.
- **Book:** B420: roll when struck in the head or vitals for enough injury to cause shock.
- **Code:** the test is `t.shock > shock0` (52-battle-injury.js:135). Once a model is at the -4 cap from earlier hits this second, a further head or vitals hit never calls for the roll. With 20+ HP the accumulated fraction can also tip over on a hit too small to cause shock by itself.
- **High Pain Threshold:** such models never gain shock, so they never make this roll. The earlier review read that as correct. The other reading is that the phrase sets an injury size, not a requirement to feel it. With 40 templates carrying the trait this decides whether aimed skull and vitals hits on Marines, Orks and Necrons can stun without a major wound, so it deserves an explicit ruling in the doc.
- **Fix:** test the hit's own injury: `inj >= 1` under 20 HP, `inj >= Math.floor(HP / 10)` otherwise.

### N11. Crippling thresholds ignore extra limbs

- **Kind:** partial. **Impact:** small (Tyranids and servo-armed Mechanicus). **Confidence:** medium; needs each template's limb count.
- **Book:** B421: with more than two limbs of a kind, a limb is crippled by injury over HP divided by their number; extremities over HP / (1.5 x number).
- **Code:** HP/2 and HP/3 for everyone (52-battle-injury.js:121, 477); two crippled arms always takes the model out (52-battle-injury.js:19).
- **Fix:** an `arms` and `legs` count per body plan in the loadout data, used in both places.

### N12. Fractional armour divisors against DR 0

- **Kind:** missing. **Impact:** small (two optional ammunition lines, Manstopper and Dum-Dum at (0.5), and the psyk-out grenade at (0.2); none in a default loadout). **Confidence:** high.
- **Book:** B379: against a fractional divisor, DR 0 counts as DR 1 before multiplying.
- **Code:** `eff` returns 0 for DR 0 (52-battle-injury.js:436; the planner at 53-battle-defence.js:26).
- **Fix:** `if (div < 1 && dr <= 0) dr = 1`.

### N13. A crippled shield arm drops the whole shield

- **Kind:** wrong. **Impact:** small. **Confidence:** high.
- **Book:** B421: a shield on a crippled arm stays where it is; it can no longer block and its Defense Bonus falls by one.
- **Code:** `t.shState = "gone"` (52-battle-injury.js:21), which removes the bonus entirely.
- **Fix:** a `"hanging"` state: no Block, DB - 1.

### N14. Fire: three details

- **Kind:** partial. **Impact:** small. **Confidence:** high.
- B434: the -3 for all clothes alight does not apply to the roll to put the fire out; `beatFlames` subtracts `skillPen`, which includes it (52-battle-injury.js:535; 51-battle-terrain.js:431).
- B433-434, B399: tight beams ignite at a tenth of their damage; the engine never lets them (52-battle-injury.js:419). Only a 30-point laser hit on a clothed target would matter.
- B414: every explosion counts as incendiary; only burning ones can ignite in the engine (same line).

### N15. Smaller points

- **Critical hit rows 4 and 17** halve DR rounding down on the general table and up on the head table (B556); the engine rounds up on both (52-battle-injury.js:438). One point of DR at most.
- **Cutting knockback** is limited to melee (52-battle-injury.js:445); B378 has no such limit. Rare.
- **Shock in ST contests.** `skillPen` (shock, fire, pain, lameness) comes off Lifting ST in grappling contests (63-battle-grappling.js:74, 83, 103, 112). Shock lowers DX and IQ, not ST (B419, B421). Low confidence that this matters; it belongs with the grappling review.
- **Indirect fire at an unseen target** scatters by the margin of failure (59-battle-special-options.js:253); B414 squares the margin for Artillery fire at a target the firer can't see.
- **Pintle gunners** (Rhino, Trukk) sit inside the hull for all purposes; B467 says an external open mount gives the weapon and its crew no protection. Related: blasts on the open-topped Trukk hit the hull at top DR 0 but never its exposed crew and passengers (B555: large-area injury reaches exposed occupants).
- **Aim from a moving vehicle** is thrown away for unstabilised mounts (58-battle-vehicles.js:102); B548 and B469 cap the aiming bonuses at the vehicle's SR instead.
- **Combat at different levels**: the engine's bands start at whole feet (`a >= 4`, `a >= 5`), the book's run "up to" each figure (B402), so a 4.5-foot difference gets the 4-foot row (defence +/-2, head still reachable) where the book gives the 5-foot row (51-battle-terrain.js:126-145).
- **Under-fire Fright Checks** (TS p. 34) allow a Will-based Soldier roll in place of Will and add penalties for visible casualties by HP multiple; the engine uses Will and the rapid-fire penalty only. Optional rule, partly adopted.
- **Explosions indoors** (HT p. 181, optional): a blast contained by a room does double damage, or half again with doors and windows. Not modelled; it would matter in the facility if adopted.

---

## 4. Checked and found correct

Damage and penetration
- Damage roll minimums, 0 for crushing and 1 otherwise (B378): 10-rolls.js:60-65.
- DR divided by the armour divisor, rounded down, floor 0; "ignores DR" as an infinite divisor (B378): 52-battle-injury.js:436; 10-rolls.js:41-44.
- Wounding modifiers by type; skull and eye x4 except toxic; vitals x3 for piercing and impaling, x2 for a tight beam; neck; face corrosion; limbs reduce large piercing, huge piercing and impaling to x1 (B379, B399): 30-wounds.js:2, 13-25.
- Unliving and Homogenous modifiers, and Unliving not applying to skull, eye or vitals (B380, B400): 30-wounds.js:3-4, 22-24. No Brain, No Vitals: 30-wounds.js:8, 14, 17.
- Diffuse cap of 1 or 2, lifted for areas, cones and explosions (B380): 52-battle-injury.js:474.
- Injury Tolerance (Damage Reduction) divides injury after wounding (P53): 52-battle-injury.js:471-472, 489.
- Injury rounds down, minimum 1 when anything penetrates (B379): 52-battle-injury.js:469.
- Random hit location table (B552): 30-wounds.js:38-49. Skull's own DR 2, not for the eye: 30-wounds.js:10-11.
- Large-area injury: torso with the average of torso DR and the lowest location's, rounded up (B400): 30-wounds.js:27-36.
- Blunt trauma only when nothing penetrates, piercing and impaling at 1 per 10 (B379; the cutting and rigid-armour rates are documented house rules): 53-battle-defence.js:9-14; 52-battle-injury.js:455-458.
- Half damage at or beyond 1/2D, never for the follow-up (B378): 55-battle-attacks.js:188; 52-battle-injury.js:409-410.
- Follow-up inside only on penetration, ignoring DR; outside against the DR that stopped the carrier (B381): 52-battle-injury.js:461-465, 483-492.
- Corrosion eats 1 DR per 5 points of basic damage, armour first, for later hits (B379): 52-battle-injury.js:431-434.
- Hurting yourself on DR 3+ (B379): 52-battle-injury.js:448-452.
- Knockback: yards per full ST - 2 of basic damage, roll at -1 per extra yard, Perfect Balance +4 (B378): 52-battle-injury.js:573-584.
- Cover: a hidden location's hit meets the cover's DR with the divisor on the sum; half-hidden on 4-6 (B407-408): 52-battle-injury.js:420-428, 436-437. Shooting through a wall or door uses its DR alone (B408): 55-battle-attacks.js:40-42.
- Damage to Shields: cover value DR + HP/4, shield arm on 1-2, Homogenous, HT rolls at 0 HP and each multiple, gone at -10 x HP, full knockback when it holds (B484): 52-battle-injury.js:541-572.

Injury and conditions
- Shock: -1 per HP, per HP/10 for 20+ HP over the turn's total, cap -4 (-8 on the critical), next turn only, not on defences (B419): 52-battle-injury.js:115-119; 69-battle-turns.js:66; 53-battle-defence.js (no `skillPen` in defences).
- Major wound over HP/2; knockdown roll, -10 skull and eye, -5 face and vitals on major wounds only, +3 High Pain Threshold; failure stuns and knocks down, by 5 or a critical failure knocks out (B420): 52-battle-injury.js:133-146.
- Below 1/3 HP: half Move and Dodge, rounded up (B419): 51-battle-terrain.js:434, 570, 590.
- At 0 HP or less: HT roll each turn at -1 per multiple of HP (B419); Hard to Subdue added (B59): 69-battle-turns.js:43-46.
- Death checks at each -1 x HP crossed, automatic at -5 x HP (B419); mortal wound on a failure by 1-2 (B423); Hard to Kill (B58): 52-battle-injury.js:147-157.
- Stun recovery on HT at the model's turn, which is lost either way; mental stun on IQ, +6 with Combat Reflexes (B420, B43): 51-battle-terrain.js:556-561; 69-battle-turns.js:52.
- Critical Hit Table and Critical Head Blow Table rows (B556): 52-battle-injury.js:196-200, 387-408.
- Bleeding (B420 box): 69-battle-turns.js:94-100.
- Regeneration rates, 10 a second, 1 a second, 1 a minute, 1 an hour (B80): tools/build_site.py:359-365; 69-battle-turns.js:71-74.
- Fatigue thresholds and extra-effort costs (B426, B357): see part 2; 62-battle-reactions.js:4-9.

Explosions, areas, fire
- Collateral damage divided by 3 x yards, no divisor, as large-area injury; direct hit takes the listed damage with its divisor (B414): 52-battle-injury.js:587, 612-615; 55-battle-attacks.js:258-260.
- Fragments: 5 yards per die, skill 15 with range, posture and SM only, one more per 3 of margin, random location, cover from the blast point, cutting (B414-415): 52-battle-injury.js:620-634.
- Scatter by margin, at most half the distance, random hex side (B414): 55-battle-attacks.js:117-122, 219.
- Cone: a yard wide at the muzzle widening to full width at maximum range, one roll, dodge to get clear (B413): 55-battle-attacks.js:276-303.
- Catching fire thresholds, burning damage, DX penalties and putting it out (B434): 52-battle-injury.js:419, 509-537.

Morale
- Fright Check modifiers that are in: Fearlessness, Combat Reflexes +2, heat of battle +5, Cowardice by self-control number (B360, B129); Unfazeable exempt (B95): 51-battle-terrain.js:445, 481.
- Fright Check Table rows 4-11, 13, 14, 16, 17-21 (B360-361): 51-battle-terrain.js:539-553.
- Blast zone for a Fright Check, 2 yards per die; rapid-fire penalty unless in cover (TS p. 34): 52-battle-injury.js:594, 603; 51-battle-terrain.js:485.

Powers
- Malediction as a Quick Contest with its three range schemes, no active defence (B106), and the Rule of 16 (B349): 55-battle-attacks.js:156-171.

Vehicles
- Injury to machines as Unliving; vital area x3 piercing and impaling, x2 tight beam (B555): 52-battle-injury.js:222.
- Location effects once a location is chosen: body and main-turret major wounds with an HT roll, track over HP/2, independent turret over HP/3, wheel over HP/(2 x wheels), mount over HP/5, excess lost; open cabin strikes an occupant with no hull DR (B554-555): 52-battle-injury.js:314-371.
- Occupant Hit Table numbers, 5 points of penetration to trigger, 1d cutting per 5 points, 4d lots, own DR (B555): 52-battle-injury.js:206-208, 257-271, 372.
- At 0 HP an HT roll each second or it stops; destruction checks as for death (B483-484): 69-battle-turns.js:43-46; 52-battle-injury.js:147-157.
- Vehicle Dodge, control skill / 2 + Handling, rounded down (B470): 20-units.js:427.
- Acceleration and Top Speed (B463, B468): 58-battle-vehicles.js:45-47.
- Firing from a moving ground vehicle off road: -1 stabilised turret, -2 turret or fixed mount, -3 open mount (B548): 58-battle-vehicles.js:32.
- An operator firing a fixed gun uses the lower of Gunner and control skill (B467): 20-units.js:416.
- Trampling: SM difference of 2 (1 against a prone foe), dodge only, large-area injury at 3 or more (B404): 59-battle-special-options.js:6-16.

Terrain
- Firing up adds a yard per yard; firing down takes one off per two yards, to no less than half (B407), apart from the beam exception in N9: 51-battle-terrain.js:16-22.
- Combat at different levels: location modifiers, defence modifiers and what can be reached (B402), apart from the band edges in N15: 51-battle-terrain.js:110-145.
- Darkness as a to-hit penalty reduced by Night Vision, ignored with Dark Vision (B394, B548, B71, B47): 51-battle-terrain.js:146-149.
- Structures as Homogenous objects with DR and HP per hex (B558; the DR 50 / HP 60 values are documented house values): 51-battle-terrain.js:165-184. Cover wearing down as semi-ablative (B559): 51-battle-terrain.js:150-162.

---

## 5. Not checked, and why

- **Revised Fractional Health** (`fracInjure`, 52-battle-injury.js:3-93): the rule lives in a document on the user's Drive that was not available. Nothing was compared.
- **Force fields and Shield Points**: a documented house rule (`docs/framework.md` "Personal force fields"). The code was checked against that doc only (absorb before armour, no divisor, follow-up drains the field, overflow carries on, double delay after a collapse: 52-battle-injury.js:412-417; 69-battle-turns.js:26-31) and matches. It was not compared with Ultra-Tech's force screens.
- **Perils of the Warp, Shadow in the Warp, Reanimation Protocols, horror checks, half and quarter strength morale, Commissars**: project rules with no book text to check against.
- **Individual psychic powers** in `data/sim/powers.yaml`: only the engine's handling of Malediction, range and resistance was checked, not each power's build. Psionic Powers was not used; the project builds powers as Sorcery.
- **Pyramid 3/77** ("Combat Writ Large"), cited for size rules and for SM adding to HT against afflictions: not among the extracted books.
- **Low Pain Threshold, Supernatural Durability, Unkillable, Injury Tolerance (Diffuse, Homogenous) on a character**: no template carries them (checked the built site data), so the engine paths are either absent or never run. The Homogenous path is exercised only by walls, doors and shields.
- **Limited DR**: `armourProfile` skips any DR row limited to one damage type (20-units.js:65); no armour in the current data has such a row, so nothing to compare.
- **Groin and eye-blinding effects, shield-arm penalty**: known open items from the earlier review, not re-argued here.
- **High-Tech and Ultra-Tech vehicle and explosive chapters** beyond HT p. 181: the engine uses the Basic Set's vehicle rules, so those were only searched for rules on blasts and cover.
- **The full battery of reference fights** was not rerun; only targeted runs for N1 and N2.
