# Review A: attacks, defences, maneuvers and movement

Scope: `tools/sim/engine/` files 10, 45, 53, 54, 55, 56, 57 (rules only), 59, 60, 61, 62, 63, 69, plus the helpers they call in 20, 51, 52 and 58 (`act`, `explosion`, `shotFx`, `rngD`, `moveOf`, `faceTo` and so on). Checked against the extracted Basic Set (B), Martial Arts (MA) and Tactical Shooting (TS). Read-only: nothing in the repository was changed. Where a number below comes from a test run, it was made with an in-memory copy of the engine patched in a scratch folder.

Line numbers are the current part files (branch `claude/vigilant-hawking-7x6tga`, commit 45123b0).

## 1. The earlier review's findings in this scope

Status of each numbered finding in the summary table of `docs/gurps-rules-review.md` that falls in this scope. "Fixed" means the code now does what the book (or the recorded user decision) says.

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Parry after Move and Attack; ranged Move and Attack | Fixed | `canParry` needs `!t.mna` (53:145); `canRetreat` needs `!t.mna` (53:141); `mna` set by melee charge (55:390), firing on the move (60:168) and slam (62:108) |
| 3 | Mighty Blows with All-Out Attack; FP only on a hit | Fixed | offered only as plain `mighty@` (61:118-122); FP spent per attack before the result (55:427) |
| 4 | Sprinting, Enhanced Move | Fixed | `runMove` (51:582-588) |
| 5 | 17 succeeds at skill 17+; `P3` ends | Fixed | `judge` (10:18-22), `P3` (10:12-13) |
| 6 | Attacks rolled below effective skill 3 | Fixed | 55:195, 55:207, 55:422, 63:53, `burstHits` 10:110 |
| 7 | Quick Contests one-sided | Mostly fixed | `contest3` (63:30-35) has win, loss and tie, but two failures are always a tie (new finding 10) |
| 8 | Stun's -4 lasts to the next turn after recovery | Fixed | `stunRecovering` set 69:52, used 53:157 and 53:141, cleared 69:41 |
| 9 | Kneeling to standing is a step | Fixed | 58:182, movement options removed 58:348 |
| 15 | Slam takes the Move and Attack -4 and cap | Fixed | 62:109-110 |
| 16 | Break free: +5/+10, 10 seconds when pinned | Fixed | `holdBonus` 63:40; `nextBreak` 63:113, 69:58 |
| 17 | What a grappled model can do | Documented variant (MA117 instead of B371's ban on long weapons) | `closePen` 55:494; parry at half that 53:174; no gun 61:108; no Feint 61:167 |
| 19 | Two-handed (†) at 2x ST; ‡; unready after attack | Fixed for † and for guns | `oneHand` 20:169-172; one-handed long gun unready after a shot 55:141. No ‡ weapon exists in the data, so the melee "unready after attack" case can't arise |
| 20 | Shield DB against firearms | Now a recorded user decision (Damage to Shields in use, B374/B484) | 53:143-144, 53:156 |
| 23 | Aim: spoiled by defending or injury, 2x Acc cap, brace | Fixed | defence spoils 53:217; Will roll on injury 52:98; cap 55:149 (B372 confirms the cap is on Acc plus all aiming bonuses); bracing 55:126-135 (always +1 under the Progressive Recoil house rule) |
| 24 | Retreat details | Fixed, one gap | bonus kept against the same foe 53:141 and 53:254; fencing or Judo +3 at 53:174; no retreat kneeling 53:141. Gap: no retreat after sprinting (listed under new finding 14) |
| 25 | Suppression fire | Partly fixed | cap applied after modifiers 62:94; hits capped by shots per target 62:97. Zone still 3 yards and no swath (62:77), as the doc records. New gaps in finding 2 and 12 |
| 26 | Cover penalty and cover DR together | Fixed | `shotFx` 51:403-411 |
| 27 | Hitting the wrong target | Mostly fixed | `strayAt` 55:66-75: flat 9 or worse, target defends. A dodge wrongly ends the round's flight (new finding 13) |
| 28 | Fragments | Fixed (with the documented -4 per screening body) | 52:620-634 |
| 29 | Scatter by margin | Fixed | 55:219, 55:266, 61:347, 61:376 |
| 30 | Large-area injury for cones and blasts | Fixed | 55:302, 52:615 |
| 31 | Cone as a wedge | Fixed in shape | `coneCaught` 55:276-288. A missed cone still catches nobody (new finding 8) |
| 33 | Moving through friends | Fixed | 54:7, 54:82-88, 54:135, 54:154 |
| 36 | Ranged failure by 10+ as a critical miss | Fixed | 55:5-6 (B382 confirms: melee and defence rolls only) |
| 38 | Rule of 16 | Fixed | 55:160 |
| 47 | All-Out Attack move | Fixed | 61:58, 61:63 |
| 48 | Step = Move/10 rounded up | Fixed | 61:20 |
| 49 | Turn order fixed for the fight | Fixed | 69:36 |
| 52 | Bare-handed parry against weapons -3 | Fixed | 53:176 |
| 53 | Parrying an unarmed attack: skill roll first | Fixed | `cutsArm` 63:43-49 |
| 54 | Defence limits reset at the model's own turn | Fixed | 69:41 |
| 55 | Fencing multiple parries | Fixed | 53:172 |
| 56 | Enhanced Parry and Weapon Master specialisation | Still open (recorded as open) | `parryOf` adds `enhParry` for any weapon 20:315; `master` is one flag 53:172 |
| 57 | Collateral radius 2 x dice | Fixed | 52:598 |
| 58 | Rapid-fire bonus above 99 shots | Fixed | 10:123 |
| 59 | Every explosive round bursts | Fixed | 55:260 |
| 60 | Target speed below Move 10 | Fixed | `spdOf` 51:384 |
| 61 | Posture -2 by location | Fixed | `LOW` 45:24, 51:409 |
| 64 | Throwing skill adds to ST for distance | Fixed | 20:291-293 |
| 65 | Lifting ST in grappling | Fixed | 63:24-26, 63:83, 63:112 |
| 66 | Foe of more than twice your ST | Fixed | `hangsOn` 63:22, shrug-off 69:56 |
| 67 | All-Out Attack (Strong) and Mighty Blows only for ST-based damage | Fixed | 61:120, 61:147 |
| 68 | Evaluate | Fixed | 61:190-193, 55:394 |
| 69 | Feint helps one attack, lapses; Shield skill | Fixed except Shield skill (recorded) | lapse 58:158; first blow only 55:437; resistance is best of weapon skill and DX 55:474 |
| 70 | Flurry of Blows | Fixed | 61:129-134, 55:409 |
| 71 | Critical failure with extra effort | Fixed | 55:427, 53:264 |
| 72 | Criticals on defence rolls | Fixed | 53:262-268 |
| 76 | Point-blank shots: no block, no retreat | Fixed | retreat only for `kind === "melee"` 53:159; block only melee and thrown 53:184 |
| 77 | Parrying heavy weapons | Fixed (with Pyramid 3/77 weights, documented) | 53:181, `parryBreak` 55:497-504 |
| 78 | Thrown weapons can be blocked or parried | Block fixed; parry not offered | 53:184; parry branch excludes `thrown` 53:170 |
| 84 | Slam dice, knockdown, no knockback | Fixed | 62:106, 62:122-124 |
| 85 | Lost takedown drops the attacker; pin SM bonus | Fixed; free-hands +3 replaced by an arm count (recorded) | 63:97, 63:102-103 |
| 87 | Grenade: two Readies | Fixed | 60:248-256 |
| 89 | Backward cost, facing | Partly (recorded) | one hex-side after more than half Move 51:573-579; backward cost documented as not modelled |
| 90 | Crossing crates | Fixed | 54:8-16, 51:196-198 |
| 91 | Attacking an area | Fixed | 61:294-313, 61:342-354 |
| 92 | Overpenetration | Fixed | 55:105-115 |

## 2. New findings, by impact

### 1. Move and Attack: Telegraphic Attack lifts the roll past the cap of 9

- Kind: wrong. Book: B365-366, B547 (the asterisk: adjusted skill "after all modifiers" cannot exceed 9), MA113, and the example on MA107.
- Code: `strike` caps the level at 9 (55:419) and then calls `planAttack` (55:420), which adds +4 for Telegraphic Attack (53:113-117) and the hit-location penalty (53:74, 53:95) on top of the capped number. A charging Ork Boy (Choppa 14) rolls 13 instead of 9. In 200 Ork Boy against Guardsman fights 587 of 758 Move and Attack blows were rolled above 9; against Marines 1,437 of 2,166.
- Book: the cap applies to the final adjusted skill, whatever options are added. Telegraphic Attack may be combined with other options but nothing exempts it from the cap.
- Impact: medium to big. A Move and Attack blow that should hit 37.5% of the time hits 84%, at +2 to the defence. It affects every charging melee unit. Win rates in the lopsided reference fights moved by a few points only.
- The other side of the same bug: a hit-location penalty comes off after the cap, so a skill-18 charger aiming at the neck rolls 4 instead of 9.
- Confidence: high (seen in the log as "skill 13, telegraphic" from chargers).
- Fix: pass the cap into `planAttack` (for example `fo.cap = 9`) and apply `eff = Math.min(cap, eff)` after location, Telegraphic and Deceptive modifiers, in both the plain and the Telegraphic branch. Do the same in the estimate at 61:38 and 58:143.

### 2. Suppression fire isn't an All-Out Attack

- Kind: wrong. Book: B365 (All-Out Attack options for ranged attacks), B409.
- Code: the option runs `suppress` (60:208, 62:72-82) without setting `m.aoa`, and it is priced at `rNow` rather than `risk(m, m.h, "aoa")`. The gunner keeps its Dodge, Parry and Block.
- Book: suppression fire is All-Out Attack (Suppression Fire), a full-turn maneuver, so the gunner has no active defence until its next turn.
- Impact: medium. Guardsmen against Ork Boyz used it about 17 times a fight. With the gunner undefended, Ork wins went from 4 to 9 in 100.
- Confidence: high on the rule. The house-rule note keeps "B409, rapid-fire bonus and all" for suppression, so the maneuver should come with it.
- Fix: set `m.aoa = true` in `suppress`, and price the option with `risk(m, m.h, "aoa")`.

### 3. Diving for cover is a plain Dodge, without the +3

- Kind: partial. Book: B377 (Dodge and Drop, Diving for Cover), B413-414.
- Code: `dive` rolls `dodgeOf(x)` less stun and prone penalties (61:323). Cones use `defend` (55:301), which adds +3 only for a model on the shooting stance that isn't engaged (53:232).
- Book: diving for cover from a blast, cone or area attack is a dodge and drop, so it gets the +3 and leaves the model prone.
- Impact: medium. A Guardsman's dive from a grenade should succeed 74% of the time (Dodge 9 + 3), not 37.5%. Grenades, mortars and flamers are all too deadly against troops who see them coming.
- Confidence: medium to high. The text calls the dive "a dodge and drop"; the earlier review marked the dive as verified without mentioning the bonus. Reading B377's last two paragraphs again would settle it.
- Fix: add 3 in `dive`; in `coneFire`, use `dive`-style resolution (Dodge +3, ends prone) for everyone caught.

### 4. A shell or scattered round that lands on an occupied hex does no blast damage to the model there

- Kind: wrong (a code bug, not a reading of the rule). Book: B414.
- Code: `explosion` skips anyone at distance 0 (`if (d < 1 || d > reach) continue`, 52:604). Grenades call `landOn` first for the model in the hex (61:352, 61:367, 61:378). `lobShell` does not (59:256), and nor do missed explosive rounds (55:219), dodged ones (55:266) and the breach grenade (60:361-362).
- Measured: in 30 mortar fights, 39 shells landed "on target"; the target was caught by the blast 0 times (it took fragments 33 times).
- Book: everything in the blast takes the damage divided by 3 x distance; a model in the hex takes the full roll (as the engine's own `landOn` does), and may dive.
- Impact: medium for mortars and missed plasma, krak and frag rounds; small across all fights. A mortar's direct hit is its weakest result.
- Confidence: high.
- Fix: call `landOn(m, w, at, raw)` before `explosion` in `lobShell`, in `wild()` and in the dodged-round loop, or handle `d === 0` inside `explosion` when no `struck` model is given. The doc also promises a dive for the mortar's target; `explosion` only allows dives for `w.thrown` (52:607).

### 5. Bulk penalty applied at one yard and more, not only in close combat

- Kind: partial; the doc describes it but cites the book for it. Book: B391 (Weapons for Close Combat), B548, TS25.
- Code: every "point-blank" shot replaces the range penalty with the gun's Bulk (55:177). The option is offered against any foe inside the shooter's melee reach (`adj`, 58:174; 61:196-201), which is 1 to 3 yards, and on a Wait at 1 yard (62:48).
- Book: Bulk replaces the range penalty only in close combat, meaning the same hex. A foe in the next hex is an ordinary shot at no range penalty. The melee parry against the gun (B376) and TS25's +4 need only reach, so those parts are right.
- Impact: medium. A boltgun or lasgun fired at a foe one yard away is at -4 or -5 where the book has 0. It tilts every fight at arm's length toward the blade.
- Confidence: high on the book; medium that it is unintended. `docs/simulator.md` says "the Basic Set applies it in close combat", and the engine has no same-hex combat except while grappling. If it is a deliberate simplification the doc should say so.
- Fix: apply Bulk only when `inClose(m)` (holding or held); otherwise no range penalty and no Bulk at 1 to 2 yards.

### 6. Opportunity fire penalties are missing

- Kind: partial. Book: B366 (Wait with a ranged weapon), B390, B548.
- Code: a Wait fires through `fireAt` with no modifier, for the charger Wait (62:48), the corner watch (60:34, 62:42) and pop-up triggers (59:130).
- Book: covering one hex is free; 2 hexes -1, 3-4 or a line -2, 5-6 -3, 7-10 -4, 11 or more -5. No Aim bonus unless a single hex is watched. Firing only at foes (checking the target first) is -2 more.
- Impact: small to medium. "Covers the approach" watches everything in sight, which is -5 by the table, or -2 for a doorway line. Waits fired about 0.3 to 3.6 times a fight in the runs.
- Confidence: high that a penalty applies; medium on which row fits each Wait.
- Fix: pass `pen` to `fireAt`: 2 for a doorway or corridor line and for the charger Wait, 4 or 5 for an open watch, plus 2 where friends could step into the zone.

### 7. An unbalanced weapon can't parry after any attack, including a pistol shot

- Kind: wrong. Book: B376.
- Code: `canParry` refuses when `t.u.melee.unbalanced && t.attacked` (53:145), and `attacked` is set by `fireAt` (55:146), `suppress` (62:76), `throwGrenade` (61:340) and `grab` (63:52) as well as by blows.
- Book: an unbalanced weapon can't parry if that weapon was used to attack this turn. A weapon in the other hand is unaffected.
- Impact: small to medium. Ork Boyz hold a slugga and a choppa (parry -1U) together; one that fires the slugga loses its only parry until its next turn.
- Confidence: high.
- Fix: track `m.struckWith = w` in `strike` and test `t.struckWith === t.u.melee` instead of `t.attacked`.

### 8. A missed cone catches nobody

- Kind: partial; the doc states it. Book: B413 (Cone Attacks), B414 (Scatter).
- Code: `coneFire` returns on a failed roll (55:297).
- Book: on a miss the aim point scatters by the margin of failure (at most half the distance) and the cone is drawn to the new point; it can still catch the target and others.
- Impact: small to medium for flamers. A miss by 1 or 2 at 10 yards would still sweep most of the same wedge.
- Confidence: high on the book. The doc records the behaviour, so it may be deliberate.
- Fix: on a miss, `scatter(target.h, margin)` and call `coneCaught` with a pseudo-target at that hex.

### 9. Runaround attacks get the full "no defence" of a rear attack

- Kind: partial. Book: B391 (box), B549.
- Code: `defOpts` returns no defence for any attacker in the rear hex (53:152).
- Book: an attacker who started its turn in front of the victim and ran behind it is treated as a side attack, -2, because the victim saw it coming.
- Impact: small. In 150-fight runs, 1% to 3.5% of melee defences were refused for the rear arc, and between a third and nearly all of those attackers (12 of 25, 7 of 19, 11 of 12) had started their turn in front or to the side.
- Confidence: high.
- Fix: store each model's hex at the start of its turn (`m.turnH`), and in `defOpts` treat the arc as "side" when `arcOf(t.h, t.facing, att.turnH)` isn't "rear".

### 10. Quick Contest: two failures are always a tie

- Kind: wrong, and the doc says otherwise. Book: B348.
- Code: `contest3` returns 0 when both fail (63:33). Used for takedown, pin, break free, the gun wrench and the Commissar.
- Book: if both fail, the smaller margin of failure wins.
- Impact: small. It matters when both scores are low: at 11 against 11 both fail 14% of the time.
- Confidence: high.
- Fix: `return Math.sign(ra.margin - rb.margin)` for both the both-succeed and both-fail cases.

### 11. One-handed weapons parry attacks from the off side

- Kind: missing. Book: B390.
- Code: a side attack is -2 to every defence (53:157); the parry is offered from either side (53:170-182). The block is correctly limited to the shield side through `db`.
- Book: a one-handed weapon can't parry an attack from the other side of the body (the shield side); a shield can't block one from the weapon side.
- Impact: small.
- Confidence: high.
- Fix: in `defOpts`, drop the parry when `arc === "side"`, `sideOf(...) === "L"` and the weapon is one-handed.

### 12. Suppression fire details

- Kind: partial. Book: B409-410.
- Tripod and vehicle guns: the cap is 8 + the rapid-fire bonus; the code uses 6 for all (62:94).
- Visibility penalties don't apply; the code subtracts `darkPen` (62:92).
- Total hits can't exceed the shots fired; the code caps each target at `z.shots` separately and never counts across targets (62:97).
- Impact: small (the heavy bolter team gains 2 points of skill in a zone).
- Confidence: high.
- Fix: `Math.min((w.mounted ? 8 : 6) + rb, ...)`, drop `darkPen` there, and keep a `z.left` counter.

### 13. A stray round stops when a bystander dodges it

- Kind: wrong; the doc states it. Book: B390.
- Code: `strayAt` returns true when the bystander defends (55:72), which ends the search in `stray` (55:97).
- Book: on a miss or a dodge, roll for the next figure; only a hit, a block or a parry ends it.
- Impact: small. Confidence: high.
- Fix: return false after a successful dodge.

### 14. Smaller items

Each is small in effect. Confidence is high unless stated.

- **Two weapons at one foe** (B417): the doc says the foe defends at -1 against both. `opts.dual` is read in `strike` (55:438) but the `dual@` option never sets it (61:207-210), and the pistol shot never carries it. Fix: pass `{ dual: true }` and add 1 to `da` for the shot.
- **Telegraphic Attack with a feint, Evaluate or Riposte** (MA113): it gains nothing from an earlier feint, doesn't stack with Evaluate and can't be a Riposte. The code adds `ev` before the +4 (55:417) and keeps the feint and riposte penalties on the defence (55:438).
- **Firing up and down for beams** (B407): beam weapons ignore the elevation adjustment; `rngD` applies it to every weapon (51:16-22).
- **Mortar scatter** (B414): Artillery fire at a target the gunner can't see misses by the square of the margin of failure; `lobShell` uses the margin (59:253).
- **Retreat after sprinting** (B377): no retreat for a model that moved faster than its Basic Move on its last turn; `canRetreat` doesn't check `runK` (53:141).
- **Large shields** (B547): holding a large shield is -2 to melee attacks. The boarding, storm and praesidium shields have DB 3; `strike` applies nothing (55:417-418).
- **Defensive Attack with an unbalanced weapon** (MA100): it may parry with the weapon it struck with, but without the +1; the code gives both (53:145, 53:164, 53:174).
- **Aim kept across other maneuvers** (B364): the Acc bonus needs the attack to follow the Aim. `aimTurns` survives a grenade throw, a Ready, suppression fire or a melee blow, so a later shot at the same target is still "aimed" (60:95).
- **Critical Dodge against a burst** (B375): a critical success dodges every hit; the code removes 1 + margin (55:246, 62:98).
- **Bare-handed parry and Boxing** (B377): only Judo and Karate escape the -3 against weapons; the `judo` flag includes Boxing (20:371, 53:176). "Thrust" is read as impaling or piercing damage, so a crushing thrust still takes -3.
- **Parrying thrown weapons** (B376): allowed at -1, or -2 for small ones; not offered (53:170).
- **Pin** (B370): a Regular Contest, and the +3 goes to the fighter with more free hands; the code rolls a Quick Contest and counts arms (63:102-103).
- **Shove with one hand** (B372): -1 damage per die; not applied (62:133).
- **Slam that is dodged** (B371): the slammer must run on two yards past; it stops beside the target.
- **Facing changes during a move** (B387): +1 movement point per hex-side beyond the free turn into a front hex; turning is free (62:32). All-Out Attack allows no facing change after the move; `faceTo` allows it (61:63).
- **Reach** (B388): only a weapon's longest reach is used (20:214). A reach 2 or 3 weapon strikes an adjacent foe with no grip change, and a reach C weapon or fist strikes at 1 yard.
- **Acrobatic Dodge** (B375) and **All-Out Defense (Double Defense)** (B366) aren't modelled. **Choke or Strangle** (B370) isn't either, and isn't listed under "Not modelled".
- **Sprinting fatigue** (B354): an HT roll every 15 seconds of sprinting; not modelled.

### 15. Darkness and defences (a note, not a finding)

The doc says darkness at the attacker's hex is a penalty to defending against it, and the code does that (53:157). B394 and B549 give a flat -4 only when the defender can't see the attacker at all; dim light costs nothing to defend. The engine does what the doc says, so this is only a note that the "(B394)" citation is the user's reading.

## 3. Checked and found correct

- Success rolls: 3-4 always succeed and are critical; 5 at 15+, 6 at 16+; 17-18 always fail; 18, 17 at 15 or less, and failure by 10 are critical failures (10:18-22; B347-348).
- No attempt below effective skill 3 except defences (55:195, 55:422; B345).
- Ranged critical miss only on 18, or 17 at 15 or less (55:5-6; B382).
- Resisted Malediction: attacker must succeed and win, ties to the defender; Rule of 16 (55:160-164; B348-349).
- Turn order: Basic Speed, DX, a roll made once (69:36; B363).
- Maneuver effects last until the model's next turn (69:41-42, 58:156; B363).
- Step = Move/10 rounded up; an Attack includes the step (61:20-28; B368).
- Kneeling to standing as a step; lying to kneeling a Change Posture (58:182-194; B364).
- Move and Attack: melee -4, ranged -2 or Bulk, no Aim, no parry, no retreat (55:417, 55:180, 60:164-168, 53:141, 53:145; B365-366).
- Slams take neither the -4 nor the cap (62:109-110; B371).
- All-Out Attack: Determined +4 melee and +1 ranged, Double, Feint, Strong +2 or +1 a die for ST-based damage; half Move, at least 2 hexes; no defence (61:58-63, 61:145-149, 55:453, 53:149; B365, B385).
- All-Out Defense (Increased): +2 to one defence (58:318-322, 53:158; B366).
- Aim: Acc, +1 at two seconds, +2 at three; total capped at twice Acc; spoiled by a defence; Will roll when hurt (55:149, 53:217, 52:98; B364, B372).
- Evaluate: +1 a turn to +3, next turn only (61:190-193, 55:394; B364-365).
- Feint: Quick Contest, foe may use DX; margin of success if the foe fails, else margin of victory; lapses after a turn; no Feint while grappled (55:472-481, 58:158, 61:167; B365, B371).
- Wait: turns into an attack when triggered, interrupting movement; stop thrust +1 damage per 2 yards (62:39-49, 55:458; B366).
- Deceptive Attack: -2 per -1, never below 10 (53:94-96; B369-370).
- Rapid Strike: two attacks at -6 (-3 for masters), replacing one attack; Flurry of Blows halves it for 1 FP each (55:409, 61:123-134; B370, B357).
- Mighty Blows and Feverish Defense: 1 FP, not with All-Out Attack (61:118-122, 62:4-10; B357).
- Attacker posture: prone -4, kneeling -2 in melee; none for ranged (55:418; B547, B551).
- Defender posture: prone -3, kneeling -2; side attack -2; stunned -4 (53:157; B549, B551).
- Target posture: -2 to torso, groin, legs and feet and to random fire; a lying target only from the same level or lower (45:24, 51:405-409; B548, B551).
- Dodge against a burst removes 1 + margin of success (55:246; B375).
- Parry: -4 per extra parry, -2 fencing or master, -1 both (53:172; B376).
- Block: once a turn; not against bullets or beams (53:184, 53:252; B375).
- Retreat: +3 Dodge, +1 Parry or Block, +3 for fencing, Judo and Karate parries; once a turn; kept against the same foe; not kneeling or stunned (53:141, 53:169-174, 53:254; B377).
- Dodge and Drop: +3 against ranged attacks, ends prone (53:232-236; B377).
- Shield DB from the front and shield side only (53:143; B374).
- Bare-handed parry -3 against weapons (53:176; B377); weapon parry of an unarmed attack hurts the limb after a skill roll, -4 against Judo or Karate (63:43-49; B376).
- Parrying heavy weapons: no parry above Basic Lift (twice for two-handed); breakage from three times the weapon's weight at 2 in 6, +1 per multiple (53:181, 55:497-504; B376).
- A gun fired within the defender's reach can be parried (55:235-242; B376, TS25).
- Critical defence sends the attacker to the Critical Miss Table; botched Dodge falls, botched Block loses the shield for a Ready (53:262-268; B381-382).
- Range table and rounding up (10:90-93; B550); speed added to range only above Move 10 (51:384; B373); SM added (55:178).
- Firing upward +1 yard per yard, downward -1 per 2 yards to half the distance (51:16-22; B407), apart from beams.
- Half damage at or beyond 1/2D (55:188; B378).
- Line of fire: -4 per figure in the way (51:425; B389).
- Hitting the wrong target: flat 9 or the real number, whichever is worse; bystander defends (55:70-72; B389-390).
- Overshooting: a dodged round goes on to the first figure beyond (55:267; B390).
- Pop-up attack: -2, no Aim, opportunity fire may answer (59:107, 59:151-178; B390).
- Cover: no penalty and the cover is struck for random fire; an aimed shot at a half-exposed location -2 (51:403-411; B407-408).
- Overpenetration: basic damage over DR on both sides plus HP (half Unliving, a quarter Homogeneous), divisor applied (55:105-115; B408).
- Malfunction: unmodified roll at or above Malf; table rows and repair rolls (55:8-27; B407).
- Suppression: needs RoF 5+, attacks friend and foe in the zone and anyone entering it until the gunner's next turn, random hit location, cap of 6 + rapid-fire bonus after modifiers (60:191, 62:81-99, 62:37; B409-410).
- Rapid-fire bonus table, continued past 99 shots (10:120-124; B373).
- Cone geometry: a yard wide at the muzzle, widening to the listed width at maximum range (55:284; B413).
- Explosions: collateral out to 2 x dice yards at damage / (3 x yards), no divisor (52:598-615; B414). Fragments: skill 15 with range, posture and SM, one more hit per 3 of margin, out to 5 x dice yards (52:620-634; B414-415).
- Scatter: margin of failure in yards, at most half the distance; the dodger's margin for a dodged one (55:219, 55:266, 61:347, 61:365, 61:376; B414).
- Attacking an area: +4, no defence, dive only (61:301, 61:342-354; B414).
- Grenades: a Ready to draw, a Ready to arm, then the throw (60:248-256; B410); thrown weapons can be dodged or blocked (53:184; B373).
- Dual-Weapon Attack penalties: -4 each, -4 more for the off hand, bought off by the technique, Ambidexterity or Off-Hand Weapon Training (20:312-314; B417).
- Hit location penalties: torso 0, vitals -3, skull -7, eye -9, face -5, neck -5, groin -3, arm and leg -2, hand and foot -4; chinks -8 and -10 (45:4-6; B547, B552).
- Missing an aimed head, neck, groin or vitals shot by 1 hits the torso (45:8, 55:203, 55:433; B552).
- Grab: DX or grappling skill, defended normally; the grappler is -4 while itself held (63:50-58; B370).
- Takedown: Quick Contest of the best of ST, DX and grappling skill, the held side's DX at -4; the loser goes down (63:83-98; B370).
- Pin: only on a foe on the ground; +3 per SM for the larger (63:99-104; B370).
- Break free: Quick Contest of ST; +5 two hands, pinned +10 or +5, -4 if the grappler is stunned, +2 per extra arm, once per 10 seconds when pinned (63:40, 63:108-119; B371).
- A grappler of less than half the foe's ST is only encumbrance (63:22, 69:56; B370).
- Several grapplers: the best score plus a fifth of each helper (63:24-26; B392).
- Slam: damage HP x yards / 100 dice with the book's rounding; twice the foe's roll knocks it down, an equal or better roll forces a DX roll, half the foe's roll drops the slammer (62:106-124; B371).
- Shove: DX roll, thrust crushing doubled as knockback only (62:127-137; B372).
- Combat at different levels: +1/+2/+3 to defend from 3, 4 and 5 feet up, the reverse below; reach brings the foe 3 feet closer per yard past the first (51:115-145; B402-403, B549).
- Moving through a friend's hex for +1 movement point, no stopping there (54:82-88; B387).
- Prone movement 1 yard a second (54:26, 54:144; B367).
- Sprinting: +20% (at least +1) from the second second of running straight; Enhanced Move accelerates by Basic Move a second (51:582-588; B354).
- Encumbrance: Move x 0.8/0.6/0.4/0.2 and Dodge -1 to -4 at 1, 2, 3, 6 and 10 x Basic Lift (20:305-307, 20:369-370; B17).
- After more than half Move, one hex-side of facing change at the end (51:573-579; B387).
- Stairs cost a movement point more (51:211; B387).
- Stun: Do Nothing, recovery roll at the end of the turn (69:52; B420).
- Committed Attack: +2 to hit or the damage bonus; defences -2, no parry with the weapon, no retreat; a second step makes Determined +0 (55:417, 53:164-170, 61:156-161; MA99-100).
- Defensive Attack: -2 or -1 a die, +1 to Parry or Block (55:455, 53:164; MA100).
- Telegraphic Attack: +4, defences +2, critical range from the unmodified skill (53:113-117, 55:428, 55:438; MA113), apart from findings 1 and 14.
- Acrobatic Stand: Acrobatics -6 less encumbrance as a Change Posture (58:191-192; MA98).
- Close-contact shots: All-Out Attack (Determined) with a gun in reach is +4 (55:180; TS25).

## 4. Not checked, and why

- **Injury side of an attack** (`applyHit`, critical hit tables, shock, knockdown, shields' DR and HP, knockback arithmetic): outside this scope; only the entry points were read.
- **Vehicles** (`vehicleAct`, gunners, ramming, vehicular dodge): read only where `act` and `flankOptions` touch infantry.
- **Tactical Shooting items** (follow-up shots, bracing sources, keeping heads down, fire and movement, slicing the pie): only close-contact shots (TS25) were re-read. The rest were covered by the earlier supplement and are user-directed options.
- **Pyramid 3/77 size rules** (melee SM modifier, quadratic weights, trampling, grappling by size): the article isn't among the extracted books.
- **The user's Progressive Recoil document**: on the user's Drive, not in the text folder. The engine was compared with the doc's description only.
- **High-Tech and Ultra-Tech**: not consulted; nothing in scope turned on them.
- **Shotguns and multiple projectiles** (B409): the data models buckshot as single projectiles and no loadout carries a shotgun, so the rule has nothing to act on.
- **B402's rows for 1 to 4 feet of height difference**: the extraction splits that column; only the 5-foot, 6-foot and reach paragraphs and the B549 table were confirmed.
- **Win-rate impact**: the test fights available are lopsided (most end 95-100% one way), so the measurements above count how often a rule fires rather than how much it changes who wins.
