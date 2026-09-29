# Simulator mechanics review: GURPS rules that are missing or wrong

This review compares `tools/sim.js` with GURPS 4e combat rules. It lists rules the engine leaves out and rules it gets wrong, where fixing them would change fight results. It checks the whole engine as it stood when this review was written: `runBattle` and everything inside it (`applyHit`, `injure`, `knockback`, `defend`, `bestDefence`, `rangedDefence`, `planAttack`, `fireAt`, `strike`, `act`, `fightInMelee`, `afterStep`, `suppress`, `slam`, `shove`, `grab`, `wrestle`, `breakFree`, `feverish`, `throwGrenade`, `explosion`, the turn loop, morale), plus `buildUnit` and `tools/build_site.py:combat_flags`.

Sources: **B** is the Basic Set (Campaigns). **MA** (Martial Arts), **HT** (High-Tech), **TS** (Tactical Shooting) and **LT** (Low-Tech) are optional-rule books. Every item says which kind of source it relies on. Page numbers are from memory. Where I am not sure of a page or a number, the item says so and it should be checked against the book before anything is coded. The Confidence column in the summary is my confidence in the RAW claim, not in the size of the effect.

Numbers under "Measured" come from a scratch copy of the engine patched for that item alone, run on 300 battles with seed 1 and default loadouts. The repo's `sim.js` was not touched. They show direction and rough size only, because the AI is being refactored.

## Summary

| # | Item | Kind | Source | Pri | Cost | Confidence |
|---|---|---|---|---|---|---|
| 1 | Attack maneuver includes a step; sim uses Move and Attack (skill cap 9) for a foe one hex out of reach | missing | B364–365, B368 | 1 | S | high |
| 2 | Knockback from cutting blows that penetrate | wrong | B378 | 1 | S | medium-high |
| 3 | Guns in close combat: holding both a gun and a melee weapon ready, parrying the gun, Bulk | missing | B382, B391, B376; TS, MA optional | 1 | M–L | high (readiness); medium (parrying the gun) |
| 4 | Line of fire, shooting into melee, hitting the wrong target, friends as cover | missing | B389, B407 | 1 | L | high (concept); low (exact numbers) |
| 5 | Below 1/3 HP: half Move and Dodge (standard HP mode) | missing | B419 | 1 | S | high |
| 6 | Enhanced Move and sprinting for chargers | missing | B52, B354 | 1 | S–M | medium (exact combat use) |
| 7 | Shock for models with 20+ HP | wrong | B419 | 2 | S | high |
| 8 | Major wound: failure by 5+ knocks out; crippling counts as a major wound | missing | B420 | 2 | S | medium-high |
| 9 | Flexible armour blunt trauma | missing | B379 | 2 | S | high |
| 10 | Deceptive Attack may not take effective skill below 10 | wrong | B369 | 2 | S | high |
| 11 | Retreat needs a free hex; a surrounded model still gets the bonus | wrong | B377 | 2 | M | medium-high |
| 12 | Defences after Move and Attack | missing | B365 | 2 | S | medium |
| 13 | Weapon Master and Trained by a Master are read but not used | missing | B93, B99 | 2 | S | high |
| 14 | Wait and opportunity fire only cover charging models with no ranged weapon; no melee Wait | missing | B366, B390 | 2 | M | high (Wait); medium (B390 numbers) |
| 15 | Standing up from prone takes one turn in the sim | wrong? | B364, B551 | 2 | S | medium |
| 16 | Critical hit and critical miss tables | missing | B556 | 2 | M | high (tables exist); low (row detail) |
| 17 | Morale: Fright Check cap (14+ fails), Terror, Shadow in the Warp | house rule vs RAW | B360, B93; framework | 2 | M | high (cap) |
| 18 | Parrying a weapon bare-handed | missing | B376 | 3 | S | low–medium |
| 19 | Block uses DX, not Shield skill; ignores Combat Reflexes and Enhanced Block | wrong | B375, B43, B51 | 3 | S | high |
| 20 | All-Out Defense gives +2 to every defence, not to one | wrong | B366 | 3 | S | high |
| 21 | Fatigue: below 1/3 FP, the roll at 0 FP | missing / wrong? | B426 | 3 | S | medium |
| 22 | Knockback from ranged crushing and from explosions | missing | B378, B415 | 3 | S | medium |
| 23 | Evaluate and "+1 if braced" are documented but never happen | doc/engine mismatch | B364, B364 | 3 | S | high |
| 24 | Fast-Draw (Ammo) reload | missing | B194 | 3 | S | medium |
| 25 | Aim lost when the aimer is hurt | missing | B364 | 3 | S | medium-high |
| 26 | Extra Attack with Rapid Strike and with All-Out Attack (Double) | wrong | B53, B370 | 3 | S | medium |
| 27 | Automatic fire spread over several targets: no shots spent crossing the gaps | missing | B373 | 3 | S | medium |
| 28 | Flamer cones skip friendly models | wrong | B408? (area/cone) | 3 | S | medium |
| 29 | Optional Martial Arts attack options: Committed, Defensive, Telegraphic Attack, Beats, disarms, hitting weapons | missing | MA 99–101, MA 113, B400–401 | 3 | M | medium |
| 30 | Hardened DR | not needed yet | B47 | 3 | S | high |
| 31 | Bleeding details | minor | B420 | 3 | S | low |
| 32 | Same-hex close combat is not modelled | structural | B391–392 | 3 | L | medium |

Items the engine already gets right are listed at the end, so nobody spends time on them.

---

## Priority 1

### 1. The Attack maneuver includes a step

**Rule (B364–365, step size B368).** Attack, Feint, All-Out Attack, All-Out Defense and Aim allow one step, either before or after the attack. A step is one yard, or a tenth of Move if that is more. Move and Attack (−4 to hit, effective skill capped at 9) is only needed when the foe is further away than one step plus reach.

**What the sim does.** `act` sends a model to `fightInMelee` only if a foe is already within reach (`adj`). Otherwise the `wantsMelee` branch moves the model. It uses All-Out Attack after a half move if nothing threatens it (`threatTo(m) < 1`). Failing that, it uses Move and Attack through `strike(..., { charge: true })`, which applies −4 and the cap of 9. A foe one hex beyond reach is therefore attacked at skill 9, not at full skill after a step. A Marine at 19 and a Genestealer at 20 both drop to 9.

**Why it matters.** Knockback (item 2) keeps pushing melee foes one yard out of reach. Next turn the attacker must Move and Attack at 9, or All-Out Attack if nothing can hurt it. This hits every melee fight where blows knock foes back: Marines against Ork Boyz (a chainsword averages about 26 basic damage against Ork ST 28, so it knocks back about half the time), Carnifex claws, Custodians against anything, and Slam and Shove. Fixing it makes melee elites more dangerous. With item 2 fixed as well, it mostly helps the side being knocked back to rejoin at full skill.

**Cost: S.** In `act`, when the nearest foe is at reach + 1 and a free hex beside it is one step away, take the step and call `fightInMelee`. Retreat does not move defenders in the sim (see item 11), so knockback is currently the main thing that opens gaps.

### 2. Knockback from cutting blows that penetrate

**Rule (B378).** Knockback comes from crushing damage. Cutting damage causes knockback only when it fails to penetrate DR. I am fairly sure of this wording but have not checked the page. The distance is one yard per full (ST − 2) of basic damage rolled, and the target rolls DX, or the higher of DX, Acrobatics and Judo, at −1 per yard after the first, or falls.

**What the sim does.** `applyHit` calls `knockback` for every melee `cr` or `cut` hit, before the penetration test, so a chainsword that cuts through still pushes the target away.

**Why it matters.** This is the second half of item 1. A Marine chainsword (`sw+2d(2) cut`, ST 30) knocks an Ork Boy (ST 28) back about half the time and knocks him down on a failed DX roll. The Ork then loses his next turn standing up, or charges back at skill 9. Genestealer and Lictor rending claws, Scything Talons, power swords and choppas all do the same. Penetrating cuts should not knock back, which keeps more fights in place. Measured alone, the fix moves win rates by only a few points (see the table under "Measured effects"). Its value is mostly alongside item 1.

**Cost: S.** Test `dmg.type === "cr" || (dmg.type === "cut" && pen <= 0)`.

### 3. Guns in close combat

This is the user's example. It has three parts.

**3a. Weapon readiness (B382 Ready; two-handed weapons; Fast-Draw B194).** A model holds only what its hands allow. A boltgun (Bulk −5, two-handed) and a chainsword cannot both be ready at once. Switching takes a Ready maneuver: drop or sling the gun, then draw the blade, with Fast-Draw saving the draw. A weapon that is not in hand cannot parry.

*What the sim does.* Every model always has its gun and its melee weapon ready. `fightInMelee` scores the gun and the blade each turn and uses whichever is better. `defend` and `bestDefence` always parry with the melee weapon (`t.u.parry`), even right after the model has fired a two-handed gun. The two-weapon check (`gun1`) does require a one-handed gun (Bulk −2 or better, no †), which is right, but that is the only place hands are counted.

*Effect.* Marines, Sisters, Scions and Primaris fire point-blank boltguns at adjacent Orks, Genestealers and Tyranid Warriors, and then parry the counterattack at 13 with a chainsword they could not be holding. Under RAW a Marine would either keep the boltgun (fire point-blank at −5 Bulk, and defend by Dodge or with the gun as an improvised club) or spend a turn switching to the chainsword. Either way it loses a turn of attacks or its parry. All charge fights with gun-and-blade troops move toward the charger. Guardsmen are unaffected, since the bayonet is on the lasgun, and so are one-handed pistol and blade users such as the Commissar and Aspect Warriors.

**3b. Parrying the gun (B391 and B376; TS and MA as optional expansions).** A defender in close combat with a shooter may parry the weapon rather than the bullet, deflecting the muzzle. I believe the Basic Set says this under close combat (B391), with the rule that projectiles cannot be parried on B376. The user also cites MA's "Parrying Firearms". Tactical Shooting has more detailed close-quarters rules (retention, grabbing the gun). I have not checked the exact pages or penalties in MA or TS. Treat the numbers as open until someone reads them.

*What the sim does.* A point-blank shot (`fireAt` with `pointBlank`) is defended by `defend(t, m, false, …)`, which is Dodge only. Dodge and Drop is refused because the target is engaged.

*Effect.* This matters in the same fights as 3a. An Ork (parry 9, dodge 9) gains little, but a Genestealer (parry 13, dodge 10), a Tyranid Warrior or a Custodian (parry 17, dodge 14) gains a lot against point-blank fire.

**3c. Bulk (B269, B391).** Bulk is a to-hit penalty in close combat. The sim applies `Math.min(0, w.bulk)` to every point-blank shot in `fightInMelee`, in Wait fire at 1 yard, and in the two-weapon attack. RAW close combat means the same hex, which the sim never uses, so applying Bulk at 1 yard is a fair stand-in. **No change needed**, except as part of item 32.

**Long guns fired at a grappler.** `fightInMelee` already refuses guns to a held model (`m.grips.length`), which matches B370–371 (a grappled fighter can't use two-handed weapons, and fights at −4). This is correct.

**Cost: M–L.** 3a needs an `inHand` state per model, a Ready maneuver to switch, Fast-Draw where the template has it, and parry only with a ready weapon. 3b needs a parry option in `defend` for shots from within reach, with the penalty taken from the book.

### 4. Line of fire, shooting into melee, friendly fire, people as cover

**Rules (B389, B407; exact numbers to be checked).** A shot needs a clear line. Figures in the way make the shot harder: I recall −4 per intervening figure, but have not checked it. A missed shot may hit someone close to the line of fire or beside the target ("Hitting the Wrong Target", B389). I recall that as a roll at a fixed low skill modified by the new target's size, but have not checked the details. Bodies in the way give cover (B407). None of this is optional; it is all Basic Set.

**What the sim does.** `fireAt` has no line of fire at all. A rear rank shoots through its own front rank at no penalty. A Marine shoots an Ork that is grappling or surrounding a brother Marine with no chance of hitting the brother. The only friendly-fire effects are explosions and `blast` (which hit every model in range) and the stray grenade that lands wide. Suppression and cones skip friends (see item 28 for cones).

**Why it matters.** This touches every large shooting fight:

- Ork mobs against Marines (20, 30 or 50 Boyz). Once the first Orks reach a Marine, the other Marines keep firing boltguns into the mob around him for free. RAW, they would take the intervening-figure penalty and risk hitting him. This moves results toward the Orks.
- Guardsmen in two or more ranks (20 or 30 Guardsmen against Orks, Genestealers or Termagants). The rear rank fires through the front rank. RAW this costs them. Formation spacing of 2 yards leaves gaps, so a line of fire check would block some shots, not all. This moves results toward the chargers.
- Genestealers or Hormagaunts that reach a Guardsman line. The rest of the squad keeps shooting into the melee freely.

**Cost: L.** A hex line-draw (cube-coordinate lerp) from shooter to target, listing occupied hexes. Apply a penalty per figure, and on a miss roll against each figure on the line and each figure beside the target. Automatic fire needs the same check per shot or per target. Performance matters: a 50-model fight makes thousands of shots.

### 5. Below 1/3 HP: half Move and Dodge

**Rule (B419).** With fewer than 1/3 of your HP left, halve your Move and Dodge, rounding up. High Pain Threshold does not change this.

**What the sim does.** `dodgeOf` and `moveOf` halve only through `halfDodge` and `halfMove`, which are set by Revised Fractional Health wounds, crippled legs and nothing else. In standard HP mode a model on 2 HP of 34 dodges and runs at full rate.

**Why it matters.** Standard HP is the default and every reference table uses it. High-HP models that fight on while badly hurt are the ones most affected: Orks (HP 32, Hard to Kill 3, halved injury), Marines (34), Nobs (40), Tyranid Warriors, Lictors, Carnifex (70), Custodians (50), and Necrons on 32 HP who keep fighting until their death rolls. Wounded models should die faster. Long fights shorten, such as Carnifex against Marines (186 s) and Hive Tyrant against Marines (152 s). Measured: see the table.

**Cost: S.**

### 6. Enhanced Move and sprinting

**Rules.** Enhanced Move (B52) multiplies top speed (level 1 doubles it). I believe the Basic Set lets you use top speed only on Move maneuvers and on turns spent running in a straight line, and that Basic Move for Move and Attack and for steps is unchanged. I have not checked how B52 handles acceleration in tactical combat. Sprinting (B354) is +20% Move after a second of running straight.

**What the sim does.** `buildUnit` sets `move` from Basic Move plus armour. Neither Enhanced Move nor sprinting is read. Enhanced Move (Ground) is on the Marine, Primaris, Scout, Custodian, Genestealer, Hormagaunt, Wych, Aspect Warrior, Kabalite, Guardian, Incubus and most Aeldari templates (checked in the site data).

**Why it matters.** Charge fights across open ground turn on how many volleys the charger takes. A Hormagaunt at Move 12 closing 20 yards takes two turns. At an Enhanced top speed of 24 it takes one, and a Genestealer at 28 crosses 30 yards in one turn. Genestealers against Guardsmen at 30 yards (46%/51% now) and Hormagaunts against Guardsmen (2%/98%) would move toward the Tyranids. Wyches and Aspect Warriors against Orks would too. Marines would cross ground faster in their own charges.

**Cost: S–M.** Parse Enhanced Move (level) in `combat_flags`. In the full-Move branch of `act` (charging with no attack this turn), and when closing for shooting, use top speed if the path is mostly straight. Keep Basic Move for Move and Attack and All-Out Attack. The level of detail depends on how B52 reads.

---

## Priority 2

### 7. Shock for models with 20+ HP

**Rule (B419).** Shock is −1 to DX and IQ per HP of injury, at most −4, on your next turn only. With 20 or more HP, the penalty is −1 per full HP/10 of injury.

**What the sim does.** `injure` sets `shock = min(4, shock + inj)` for every model. A Carnifex (70 HP, no High Pain Threshold) takes −4 from 4 HP of injury. RAW it would take 28. Active defences are correctly left out: `skillPen` feeds attacks, not defences.

**Why it matters.** The rule only bites on large models without High Pain Threshold: Genestealers (28 HP), Tyranid Warriors and Lictors (40), the Carnifex, and the Hive Tyrant. These models lose attack skill much too easily now, so the fix helps Tyranids against Marines and Guardsmen. Measured, though, it changed nothing in the tested fights (see the table below). It is a correctness fix more than an outcome changer.

**Cost: S.** Measured: see the table.

### 8. Major wounds: knockout, and crippling as a major wound

**Rule (B420).** A major wound (a single injury over HP/2, and I believe also any crippling injury) calls for an HT roll. On a failure the victim is stunned and falls down. On failure by 5 or more, or a critical failure, the victim is knocked out. The same roll is modified for hits on the face, skull and vitals (sim: −5, −10, −5) and by High Pain Threshold (+3).

**What the sim does.** `injure` handles the stun and knockdown with the right modifiers, but never knocks anyone out. Crippling a hand or foot (injury over HP/3, capped at HP/3 + 1) can stay under HP/2 and then skips the roll.

**Why it matters.** Knockouts end fights sooner. Heavy weapons with head hits drop Marines, Nobs and Sisters that now stay up stunned. Guardsmen hit hard are usually dead anyway. The effect is moderate across many fights.

**Cost: S.**

### 9. Flexible armour blunt trauma

**Rule (B379).** When flexible armour stops all of a hit, the wearer still takes blunt trauma: 1 HP per full 5 points of crushing damage, or per full 10 points of cutting, impaling or piercing damage. Burning and other types cause none.

**What the sim does.** Nothing. The data marks flexible armour in its `notes` ("Flexible armour (B47)…"): Mesh Armour, Aspect Armour and the other Aeldari plate, the Guardian mesh, Wych and Drukhari suits, Pathfinder recon armour and Mechanicus robes. `armourProfile` reads only the Weak Points line from those notes.

**Why it matters.** Aspect Warriors (DR 70 flexible, 11 HP) are close to immune to Ork weapons now. A Slugga (7d pi+, about 24) or a Choppa (about 20 cut against DR 35 after the divisor) almost never penetrates, but each such hit should do 2 HP of blunt trauma. Aspect Warriors against Ork Boyz (68%/31% now) and Aspect Warriors against Nobs would shift toward the Orks. It matters less for Guardians and Wyches, whose low DR is usually penetrated anyway, and for the Inquisitor's mesh.

**Cost: S.** Add a `flexible` flag in `armourProfile` from `/Flexible armou?r/i` in the notes. In `applyHit`, on `pen <= 0`, injure the wearer by `floor(raw / (cr ? 5 : 10))` for cr, cut, imp and pi types.

### 10. Deceptive Attack floor

**Rule (B369).** Each −2 to your skill gives −1 to the foe's defence, but your final effective skill may not go below 10.

**What the sim does.** `planAttack` tries deceptive levels until effective skill drops under 3. It can plan a deceptive attack at 8 or 9, and even from the capped skill of 9 in Move and Attack, which RAW forbids.

**Why it matters.** Low-skill attackers against high-parry targets use it: Ork mobs against Marines and Custodians, Hormagaunts against Marines. The planner only picks such a level when it scores best, so the effect is modest, but it is a plain rules error.

**Cost: S.** Stop the loop at `eff < 10`, and skip deceptive levels entirely when `lvl + pen < 12`.

### 11. Retreat needs somewhere to go

**Rule (B377).** Retreating moves the defender one yard away from the attacker (sideways or back), into a hex it can enter, once per turn. A defender with no free hex behind or beside it cannot retreat.

**What the sim does.** `defend` gives the retreat bonus (+3 Dodge, +1 Parry and Block) whenever the model hasn't retreated this turn, isn't stunned and isn't held. It never moves the model and never checks for a free hex.

**Why it matters.** Mobs surround single elites, and the sim's `engagePath` is built to do exactly that. A Marine ringed by six Ork Boyz or Hormagaunts still gets +3 to Dodge once his parries are used up. RAW he would not. This affects 20, 30 and 50 Ork Boyz against 5 Marines, Custodian fights against mobs, and Genestealers against Guardsmen. If retreat actually moved the defender, item 1 (steps) becomes essential, and the sim would reproduce a fighting retreat.

**Cost: M.** Minimal version: allow the bonus only if some hex adjacent to the defender and not adjacent to the attacker is free. Full version: move the defender, which also affects grapples, zones and Wait.

### 12. Defences after Move and Attack

**Rule (B365).** I believe a model that makes a Move and Attack may Dodge or Block but not Parry, and may not retreat, until its next turn. Please check this; I am not certain of the parry restriction.

**What the sim does.** Only All-Out Attack limits defences (`t.aoa`). A model that charged with Move and Attack defends in full.

**Why it matters.** Every melee charger that isn't in All-Out Attack is affected: Orks (parry 9, dodge 9, so little change), Genestealers (parry 13, dodge 10), Hormagaunts, Wyches (dodge 12), Aspect Warriors, Lictors. The fix moves results toward the side that receives the charge. It also affects models forced into Move and Attack by knockback (items 1 and 2).

**Cost: S.** Set an `mna` flag, cleared at the start of the model's own turn, as `aoa` is.

### 13. Weapon Master and Trained by a Master are not used

**Rules.** Trained by a Master (B93) and Weapon Master (B99) each halve the Rapid Strike penalty (−3 instead of −6) and the multiple-parry penalty (−2 per parry instead of −4). Weapon Master also adds damage with the chosen weapons: +1 per die of thrust or swing damage at skill DX+1, +2 per die at DX+2.

**What the sim does.** `combat_flags` sets `flags.master` for either trait. `sim.js` never reads it. `strike` always applies −6 for Rapid Strike, and the Rapid Strike choice in `fightInMelee` requires skill − 6 ≥ 14. `defend` always applies −4 per extra parry. Weapon damage comes from the equipment line, so the Weapon Master damage bonus is not in it (the GCS sheet adds it; the site data does not).

**Why it matters.** It affects the Incubus, Exarch, Autarch, Succubus, Custodian Guardian and Shield-Captain (checked in the site data). Incubi against Marines (7%/93% now) and the Exarch against 2 Marines (0%) are the fights where this could matter. Custodians already win all their fights.

**Cost: S.** Weapon Master should apply only to the named weapons. The flag loses the specialisation, so either keep the name in `combat_flags` or accept that it applies to the loadout's melee weapon.

### 14. Wait and opportunity fire

**Rules.** Wait (B366) lets a model hold an attack until a condition is met, then interrupt the foe's move. That includes a melee Wait: strike the foe as it steps into reach, before its attack (MA calls the committed form a "Stop Hit", optional). Opportunity Fire (B390) is Wait watching an area. I recall its penalties as −2 if you check targets, and −1 to −5 by the number of hexes watched, but have not checked the numbers.

**What the sim does.** `act` puts a shooter on Wait only for a charger that has no ranged weapon at all (`!f.u.ranged`), that is heading for this model, and that will arrive this turn. `afterStep` has a melee branch, but nothing ever waits with a melee weapon.

**Why it matters.** Ork Boyz carry Sluggas, and Wyches, Aspect Warriors, Hormagaunts with bio-weapons and Commissars carry pistols, so none of them ever trigger Wait. The Wait rule mostly fires against Genestealers, Flayed Ones and Lictors. Letting shooters Wait against any charger that will arrive this turn gives the defenders one more free volley in every charge fight. Melee Wait with a reach-2 weapon (Custodian spear, Guardsman bayonet at reach 2) gives the first blow. General opportunity fire over an area would matter only if the sim adds terrain.

**Cost: M.** This is AI, and it overlaps the refactor underway, so coordinate with that developer.

### 15. Standing up from prone

**Rule (B364, B551).** I believe getting up from lying down takes two Change Posture maneuvers (lying to kneeling or crawling, then to standing). I am not certain, and the Acrobatics roll that speeds it up is also worth checking.

**What the sim does.** One turn (`act`: "gets up").

**Why it matters.** Many things drop models in the sim: knockback, knockdown, slams, shoves, takedowns, and Dodge and Drop. If RAW is two turns, knockdowns are worth twice as much and the prone model spends an extra turn at −3 to defend. This affects Ork mobs slamming Marines, Marine chainswords knocking Orks down (until item 2 is fixed), and shooters who dodge and drop and then must stand to charge.

**Cost: S.**

### 16. Critical hit and critical miss tables

**Rule (B556).** A critical hit is not only "no defence". A second 3d roll on the Critical Hit Table can double or triple damage, or halve or ignore DR, among other results. A critical miss rolls on the Critical Miss Table: dropped or broken weapons, falls, hitting yourself. I have not checked the exact rows.

**What the sim does.** `check` reports `crit` and `fumble`. `strike` and `fireAt` skip the defence on a crit. Critical misses do nothing, except `jamCheck` overheating plasma on a fumble.

**Why it matters.** It matters most where normal hits cannot get through armour: Ork mobs against Marines (Choppa 6d−1(2) against DR 103, 51 after the divisor) and anything against Custodians (DR 150). A tripled or armour-halving crit is the only way through. With a crit chance of 1.9% at skill 14 and a minority of table rows that help, a 50-Ork fight might see a few such hits per battle. That can decide a close fight. Critical misses cost high-rate swingers (mobs) dropped weapons.

**Cost: M.** Two tables and the effects the sim can represent.

### 17. Morale, Fright Checks, Terror, Shadow in the Warp

**Rules.** A Fright Check (B360) is a Will roll, with Fearlessness added, and I am confident any roll of 14 or more fails regardless of modifiers. Unfazeable exempts. Terror (B93) forces a Fright Check on sight. The Basic Set has no unit morale for losses. The sim's half and quarter casualty checks are a house rule (docs/simulator.md, "Not modelled").

**What the sim does.** The turn loop rolls `check(u.will + fearless)` at 50% and 25% losses, with no 13 cap. Marines roll 18 and fail only on 18. Nothing models the framework's Shadow in the Warp (−3 to psychic skill within 8 or 16 yards, and a Fright Check on first exposure, in `data/xenos/tyranids/traits.yaml`) or the Psychomancer's −2 to Fright Checks. No template carries Terror.

**Why it matters.** If the loss check is meant to be a Fright Check, the 14+ rule makes every unit break about 9% of the time per check at best. That affects long fights such as Primaris against Marines, and Marines against Necrons. Shadow in the Warp would make psyker fights against synapse Tyranids (Zoanthrope, Hive Tyrant, Warrior) much worse for the psyker. This is a design choice for the user, not a rules bug.

**Cost: M.**

---

## Priority 3

### 18. Parrying a weapon bare-handed

**Rule (B376).** Parrying a weapon bare-handed carries a penalty unless you use Judo or Karate. I recall −3, and a failed parry against a swung weapon may hit the arm, but please check the page. The sim does handle the reverse case, a weapon parrying a bare hand (`cutsArm`), as B376 says.

**What the sim does.** The "Punch" fallback parries at skill/2 + 3 with no penalty (Necron Warriors, Fire Warriors, Kabalites, Deathmarks).

**Effect.** Small shifts in fights where gunline troops are charged by blades: Kabalites against Wyches, Necron Warriors against Flayed Ones or Orks.

**Cost: S.**

### 19. Block

**Rule (B375).** Block = Shield skill / 2 + 3, plus Combat Reflexes (+1, B43) and Enhanced Block (B51). The shield's DB adds too, which the sim does right.

**What the sim does.** `bestDefence` and `defend` use `floor(dx / 2) + 3`. `flags.enhBlock` and Combat Reflexes are ignored for Block.

**Effect.** Custodians (Shield 20, Combat Reflexes) block at 14 instead of 13. Sisters of Silence and Lychguard (Shield 14) are affected too. Small.

**Cost: S.** Store Shield skill in `buildUnit`.

### 20. All-Out Defense

**Rule (B366).** Increased Defense gives +2 to one active defence (Dodge, Parry or Block), or Double Defense allows two different defences against one attack.

**What the sim does.** `t.aod` adds +2 to all defences, ranged Dodge included.

**Effect.** Very small, since a model usually uses one defence type.

**Cost: S.**

### 21. Fatigue

**Rules (B426).** Below 1/3 FP: halve Move, Dodge and ST. At 0 FP or less, each further FP lost also costs 1 HP, and I believe a model needs a Will roll (not HT) to do anything but rest, collapsing on a failure. It falls unconscious at −FP. The FP cost of a whole fight (B426, 1 FP plus encumbrance for a fight over about 10 seconds) is charged afterwards, so it changes nothing inside a simulated fight.

**What the sim does.** At `fp <= 0` the model rolls HT to act. There is no 1/3 FP halving and no HP cost for spending FP below zero.

**Effect.** Psykers spend FP on powers, charging mobs spend it on Mighty Blows, and Marines spend it on Feverish Defense. Feverish Defense stops at 1/3 FP already. Small outside psyker fights.

**Cost: S.**

### 22. Knockback from ranged crushing and explosions

**Rules (B378, B415).** Crushing ranged attacks knock back like melee ones. Explosions also knock back (B415).

**What the sim does.** `knockback` runs only for melee hits (`!ranged`).

**Effect.** The Carnifex's Venom Cannon (6dx3(3) cr ex) and grenade blasts would knock models down. Small.

**Cost: S.**

### 23. Evaluate and bracing are documented but not implemented

`docs/simulator.md` lists Evaluate (+1 per turn to +3) and "+1 if braced" under Aim. In `sim.js`, `m.evaluate` is read in `strike` and cleared, but nothing sets it, and there is no brace bonus. Either implement them (B364–366, S) or drop them from the doc.

### 24. Fast-Draw (Ammo)

**Rule (B194).** I believe a successful Fast-Draw (Ammo) roll cuts one second off a reload. Marines, Primaris, Aspect Warriors, Kabalites, Fire Warriors, Skitarii and others have it (site data).

**What the sim does.** Reload time is the weapon's figure.

**Effect.** Small.

**Cost: S.**

### 25. Aim lost when hurt

**Rule (B364).** An aiming model that is injured must roll Will or lose the aim.

**What the sim does.** `aimTurns` resets only when the model moves or fires.

**Effect.** It matters for snipers and three-turn aimers under fire, such as Fire Warriors against Marines at 150 yards. Small.

**Cost: S.**

### 26. Extra Attack with Rapid Strike and with All-Out Attack (Double)

**Rules (B53, B370, B365).** A model with Extra Attack may make one of its attacks a Rapid Strike. All-Out Attack (Double) adds one attack to however many the model has.

**What the sim does.** Rapid Strike is refused to Extra Attack models (`!u.flags.extraAttack`). In `strike`, `double` gives 2 attacks in total, so a Genestealer with Extra Attack gets 2 on All-Out Attack (Double) instead of 3.

**Effect.** Genestealers and other multi-attack monsters lose some attacks. Small to moderate for Genestealers.

**Cost: S.**

### 27. Automatic fire over several targets

**Rule (B373).** Spreading a burst over several targets spends shots on the gaps between them (I recall one shot per yard, but have not checked the number).

**What the sim does.** `fireAt` splits bursts of 6+ shots over up to 3 targets within 2 yards of the main target, with no wasted shots.

**Effect.** Slightly fewer hits from Shootas, Hellguns and lasguns on full auto. Small.

**Cost: S.**

### 28. Cones skip friends

**What the sim does.** `fireAt` builds the cone's target list from foes only (`x.u.side !== m.u.side`).

**Rule.** A flamer's cone hits everything in it. I have not checked the page for the Basic Set's cone rule; it is on the area and spreading attacks pages (about B413).

**Effect.** It matters only when a flamer fires into a melee with friends in it. It is part of item 4.

**Cost: S.**

### 29. Optional Martial Arts attack options

**Rules (MA, optional).** Committed Attack (MA 99, about +2 to hit or +1 damage per die, 2 steps, reduced defence) and Defensive Attack (MA 100, about −2 damage and +1 to parry). Telegraphic Attack (MA 113: +4 to hit, the foe gets +2 to defend). Beats (MA 100–101, a Quick Contest to lower the foe's parry). Numbers are from memory and need checking. Also Basic Set disarming (B401) and hitting a held weapon (B400).

**What the sim does.** None of these.

**Effect.** Telegraphic Attack helps low-skill troops a lot: a Guardsman bayonet at skill 7 becomes 11 against a Marine. Hitting weapons gives mobs that cannot hurt a Marine something useful to do (break his boltgun). None of this is Basic Set, so treat it as an optional ruleset toggle.

**Cost: M.**

### 30. Hardened DR

**Rule (B47).** Each level of Hardened steps the attacker's armour divisor down one step: (∞) to (100) to (10) to (5) to (3) to (2) to (1).

**Status.** No armour in `data/` uses Hardened (checked), so the sim doesn't need it yet. If it is ever added, it belongs in `applyHit` and `expInj`, on the divisor, before `eff`.

### 31. Bleeding

**Rule (B420, optional rule).** Wounded models roll HT periodically or lose HP. I don't remember the exact interval, the amounts, or which damage types bleed.

**What the sim does.** Every minute, a model below full HP rolls HT or loses 1 HP (standard mode). Unliving models are skipped. Burns and crushing wounds bleed too.

**Effect.** Almost none, since most fights end in under a minute. Leave it.

### 32. Same-hex close combat

**Rule (B391–392).** Close combat means figures in the same hex. Reach C weapons, grapples, pistols with their Bulk and knives work there. I am not certain of the exact Reach C wording in 4e (B269). There are special rules for entering a foe's hex and for defending there.

**What the sim does.** Two models never share a hex. All grapples and Reach C attacks happen from adjacent hexes, which is a reasonable abstraction (see item 3c).

**Effect.** Unknown, and it is a large change. Leave it unless the grappling and gun-parry work (item 3) needs it.

---

## Measured effects of the three smallest fixes

Items 2 (knockback only from crushing or non-penetrating cutting), 5 (below 1/3 HP halves Move and Dodge) and 7 (shock scaled for 20+ HP) were each patched into a scratch copy of `sim.js`, alone and together. Each fight was run for 300 battles with seed 1. Side A win % / side B win %, then average length:

| Fight | Current engine | Knockback fix (2) | 1/3 HP fix (5) | Shock fix (7) | All three |
|---|---|---|---|---|---|
| 10 Ork Boy v 5 Battle-Brother @10 | 0/100, 8 s | 0/100, 8 s | 0/100, 7 s | 0/100, 8 s | 0/100, 7 s |
| 30 Ork Boy v 5 Battle-Brother @30 | 0/100, 20 s | 0/100, 21 s | 0/100, 21 s | 0/100, 20 s | 0/100, 21 s |
| 20 Ork Boy v 5 Battle-Brother @30 | 0/100, 21 s | 0/100, 21 s | 0/100, 21 s | 0/100, 21 s | 0/100, 21 s |
| 10 Genestealer v 20 Guardsman @30 | 3/96, 24 s | 2/98, 23 s | **17/82, 18 s** | 4/96, 23 s | **17/82, 18 s** |
| 3 Tyranid Warrior v 5 Battle-Brother @30 | 0/100, 8 s | 0/100, 9 s | 0/100, 8 s | 0/100, 9 s | 0/100, 9 s |
| 5 Aspect Warrior v 10 Ork Boy @15 | 93/7, 12 s | 90/9, 12 s | 93/7, 12 s | 93/7, 12 s | 91/9, 11 s |
| 5 Incubus v 5 Battle-Brother @10 | 2/98, 6 s | 4/96, 6 s | 4/96, 6 s | 2/98, 6 s | 4/96, 6 s |
| 1 Ork Warboss v 1 Tyranid Warrior @10 | 100/0, 4 s | 100/0, 4 s | 100/0, 4 s | 100/0, 4 s | 100/0, 4 s |
| 5 Lychguard v 5 Battle-Brother @10 | 93/3, 79 s | 92/4, 71 s | 90/5, 89 s | 93/3, 79 s | 90/5, 87 s |
| 10 Wych v 10 Ork Boy @15 | 10/89, 9 s | 16/84, 9 s | 16/82, 9 s | 10/89, 9 s | 12/87, 9 s |

What this shows:

- **Most of these fights are one-sided** (0/100 or 100/0), so a single fix rarely flips a winner. The fixes matter in close fights. That is a reason to re-run the whole results table, not to skip the fixes.
- **The knockback fix alone (item 2) moves little**: a few points in Wych v Ork and Aspect v Ork, and 8 seconds off the Lychguard fight. It needs the step rule (item 1) to show its full effect, and that was not measured here because it is AI work. On measurement alone, item 2 would rank as priority 2. It stays at priority 1 because it is paired with item 1.
- **The 1/3 HP fix (item 5)** is the one that shows up: Genestealers against Guardsmen goes from 3% to 17%, and that fight ends 6 seconds sooner.
- **The shock fix (item 7)** changed nothing in these fights. The big models it affects lose either way here, so treat it as a correctness fix (priority 2 to 3).
- The current engine's baselines already differ from `docs/sim-results.md`. For example, 30 Ork Boyz now lose to 5 Marines every time, where the doc shows the Orks winning 94%. That is presumably the AI refactor in progress, so compare fixes against a fresh baseline.

These runs use the engine as it was when copied. The AI refactor now in progress will move the baselines.

---

## What the engine already gets right

These were checked and need no change:

- Shock does not touch active defences (B419). `skillPen` feeds only attacks, and High Pain Threshold removes shock.
- Consciousness rolls at 0 HP or less: HT at −1 per full multiple of HP below zero, each turn (B419). Death checks at each multiple from −1×HP to −4×HP, with Hard to Kill added, and death at −5×HP (B419–420).
- Crippling thresholds: over HP/2 for a limb, over HP/3 for an extremity, with extra injury lost (B420–421).
- Random hit-location table (B552), and the location penalties and wounding multipliers for skull, eye, face, neck, vitals, limbs and groin (B398–400). Chinks in Armor at −8 and −10, halving DR (B400).
- Rapid fire: rapid-fire bonus table, hits of 1 + margin/Recoil, and a successful Dodge avoiding 1 + margin hits (B373–375).
- Aim: +Acc, +1 at 2 turns, +2 at 3 turns (B364). Move and Attack with a gun: −2 or Bulk, whichever is worse, and no Acc (B365). All-Out Attack (Determined): +1 ranged, +4 melee. Move and Attack in melee: −4, capped at 9 (B365).
- Side attacks at −2 to defend, rear attacks with no active defence (B390–391). Multiple parries at −4 each. Block once per turn. Unbalanced weapons can't parry after attacking. A shield's DB counts against ranged attacks too (B374–376).
- Dodge and Drop: +3 against ranged attacks, and the model ends prone (B377). Diving for cover from a grenade (B377).
- Explosions: damage ÷ (3 × yards) around the blast (B414). A held model can't retreat and fights at −4, and can't fire a two-handed gun (B370–371).
- Parrying an unarmed attack with a weapon injures the attacker's arm (B376).
- Feverish Defense and Mighty Blows cost 1 FP with no roll (B357).

## Recommended implementation order

1. **Items 2 and 1 together.** Limit knockback to crushing and non-penetrating cutting hits, and give Attack its step. Both are S, they fix the most common melee error, and item 11 needs them.
2. **Items 5, 7, 8 and 10.** These are small, clear rules fixes in `injure`, `dodgeOf`, `moveOf` and `planAttack`. Re-run `docs/sim-results.md` after this batch.
3. **Item 9, flexible armour blunt trauma.** It is S and the data already marks the armour.
4. **Item 3, readiness and parrying guns.** It is the user's example, but it touches the AI being refactored, so do it after that work lands. Coordinate the Wait changes (item 14) at the same time.
5. **Items 12, 13, 15 and 6.** Move and Attack defences, Weapon Master, standing up and Enhanced Move. Check the uncertain pages first (B365, B52, B551).
6. **Item 11, retreat that needs space.** Do the minimal version first.
7. **Item 4, line of fire and shooting into melee.** It is the largest change and needs a performance check on 50-model fights.
8. **Items 16 and 17**, crit tables and Fright Checks, as options, then the priority-3 list as time allows.
