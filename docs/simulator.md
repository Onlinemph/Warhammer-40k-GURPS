# Combat simulator: rules and data

The simulator (`tools/sim.js`, the Combat Simulator page on the site) plays GURPS 4e combat second by second on a hex map and repeats the battle many times. This page is the contract between the engine and the data: what the engine models, which Basic Set rule it follows, and what data it reads.

## Map and movement

- Hex grid, 1 yard per hex (B384), axial coordinates. The two sides deploy facing each other at the chosen distance; each unit deploys in a line with models 2 yards apart unless it has a formation setting.
- Every model has a facing (six directions). Front arc: the front hex and the two front-side hexes; side: the two flank hexes; rear: the back hex (B385). An attack from a side hex gives the defender −2 to active defences; from the rear, no active defence (B390–391).
- Movement costs 1 per hex. A model closing to melee searches for the nearest free hex beside any foe (breadth-first through free hexes), so a mob surrounds its targets instead of queueing. A model may change facing freely at the end of any maneuver that lets it move.
- Terrain: an optional cover setting per side. A model in cover has legs, feet and groin behind it: attacks on those locations hit the cover (its DR) first, and ranged attacks on the model take −2 (half exposed) (B407).
- Posture: standing or prone. Prone: −4 to melee attacks, −3 to defences, and ranged attacks against the model are at −2; standing up is a Change Posture maneuver (B551).

## Turn and maneuvers

Every model acts once per second in Basic Speed order (ties random), choosing one maneuver (B363–366):

- **Move** (full Move), **Move and Attack** (ranged: −2 or Bulk, no Acc; melee: −4, skill capped at 9, B365), **Attack**, **Aim** (+Acc, +1 more after 2 turns and +2 after 3; +1 if braced, B364), **Evaluate** (+1 per turn up to +3 to the next melee attack on that foe), **Feint** (Quick Contest of weapon skill; margin comes off the foe's next defence, B365), **All-Out Attack** (Determined: +4 melee / +1 ranged; Double: two attacks; Strong: +2 damage or +1/die; no active defence until next turn, B365), **All-Out Defense** (Increased: +2 to one defence type, B366), **Ready** (reload, clear a jam, pick up a weapon), **Change Posture**, **Concentrate** (psychic powers that need it).
- A shooter whose aimed roll would be under 8 closes the range first; low-RoF weapons re-aim when the unaimed roll is under 10; the "advance" stance fires on the move only while that shot is 8 or better.
- The model's AI picks the maneuver with the best expected result: All-Out Attack when the foe cannot hurt it or it cannot be defended against anyway, Feint or Deceptive Attack against strong defences, Rapid Strike (two attacks at −6, B370) when skill allows, Aim for accurate low-RoF weapons at range, Evaluate when closing is not possible this turn, All-Out Defense when it cannot hurt its foe and is being attacked.

## Attacks

- **Target location** (B398–400): by default only elites call shots (user direction): a model whose best combat skill (weapon or power) is 17+ with IQ 8+. Everyone else hits random locations (B552) with the framework's 1-in-6 eye-lens rule. Settings let everyone aim (RAW) or no one. An aiming attacker chooses where to hit, weighing the penalty against the damage: torso 0, vitals −3 (imp, pi, tight-beam burn ×3), skull −7 (×4, DR +2), eye −9 (via the helmet's eye DR; only piercing, impaling and tight-beam burning attacks may aim there, B399), face −5, neck −5, arm or leg −2, hand −4, foot −4, groin −3. An aiming attacker may also go for a chink in the armour (B400): −8 on the torso, −10 elsewhere, halving the worn armour's DR (not natural DR).
- Ranged: range penalty (B550), rapid-fire bonus and Recoil (B373), spreading automatic fire over two or three models, Min ST, ½D (half damage). Shots, reloads (Ready maneuvers), regrowing bio-weapon ammunition.
- **Malfunction** (B407): a roll at or above the weapon's Malf fails to fire and the weapon jams (1d turns of Ready to clear); a critical failure with a weapon marked `overheat` damages the firer as the data says (plasma).
- Melee: reach, Deceptive Attack optimised against the defender's best defence, Rapid Strike, Extra Attack, unbalanced weapons (no parry after attacking), point-blank fire with a gun when it beats the blade, close-combat reloads when quick.
- **Area effects** (B413–414): explosive (`ex`) damage also hits every model within range at damage ÷ (3 × yards), and a power bought with a higher Explosion level (B107) counts distance as yards ÷ level; fragmentation (`[Nd]`) attacks every model within 5 × dice yards at skill 15 with range penalties from the blast point; cones (`Cone N yards` in the usage) hit every model in the cone, and each may Dodge.

## Grappling

A charging model whose weapon can barely hurt its foe (under 1 HP of expected injury per swing) grabs it (B370): an attack with DX or Wrestling, Judo or Sumo Wrestling, defended normally. Holders then try a **takedown** (Quick Contest of the higher of ST, DX or grappling skill; the held model is at −4 DX) and, with the foe on the ground, a **pin** (Quick Contest of ST). Several grapplers pull together with the strongest one's ST plus a fifth of each other's (a simulator rule; Basic gives no formula). A held model can't retreat, parries and attacks at −4, can't fire a gun and isn't knocked back. On the ground or pinned it spends its turn trying to break free (Quick Contest of ST, one grip per success). A pinned model is helpless: no active defence, and any attacker may aim at it, chinks included. Two grapplers keep a pin; the others use All-Out Attack (Strong or Determined, B365) and Mighty Blows (1 FP for +2 damage or +1 per die, B357).

## Wait, suppression, grenades, slams and two weapons

- **Wait** (B366): a shooter that a dangerous charger (expected injury a quarter of its HP or more) will reach this turn holds its fire and shoots the charger as it steps within reach + 1 yard; a charger that is killed, stunned or knocked down there makes no attack. Only the model the charger is heading for waits.
- **Suppression fire** (B409): a weapon of RoF 5+ may spray a 3-yard zone (a hex and its six neighbours) round a cluster of three or more foes instead of aiming, when that promises more harm. Everyone in the zone, and everyone who moves into it before the gunner's next turn, is attacked once at 6 or the gunner's own effective skill if lower, plus the rapid-fire bonus, SM, posture and cover (up to three hits; Dodge allowed).
- **Grenades** (B410): lore-standard grenades per loadout (`grenades` in `data/sim/loadouts.yaml`). Throwing range from ST and weight (B355); a Ready to prime, then an Attack with Throwing at the range penalty. The model struck takes full damage, the rest the blast (B414) and fragments; a miss lands two yards wide. Anyone within 3 yards who sees it land may dive for cover (B377): a Dodge that, on a success, puts them a yard further from the blast (the model struck takes the blast at 1 yard, damage ÷ 3) and leaves them prone. The AI throws at whichever foe gives the most expected harm, frag into clusters, krak at the Carnifex.
- **Slam** (B371): a charger whose weapon can't hurt its foe crashes into it instead (DX, or a grappling or unarmed skill if better; Move and Attack or All-Out Attack penalties). Each side takes HP × yards moved ÷ 100 dice of crushing damage; whoever rolls twice the other's damage knocks the other down, otherwise the one who took more rolls DX or falls. A mob uses this to put a Marine on the ground for the pin.
- **Shove** (B372): a model that can't hurt its foe, beside a friend who can, shoves it: knockback from double its thrust damage, DX to keep its feet.
- **Two weapons at once** (B417): a one-handed melee weapon and a pistol (Bulk −2 or better) attack in the same turn, each at −4 (reduced by the Dual-Weapon Attack technique), the off hand at −4 more without Ambidexterity or Off-Hand Weapon Training. Used when it beats a single attack.
- **Feverish Defense** (extra effort, B357): 1 FP for +2 to a Dodge, Parry or Block against an attack whose expected injury is a fifth of the defender's HP or more, while the defender has more than a third of its FP (minimum 3) left.

## Defence

Dodge, Parry and Block (B374–377); retreat once per turn (+3 Dodge, +1 Parry and Block); multiple parries −4 each; Block once per turn; a shield's Defense Bonus adds to all defences against attacks from the front or shield side (B287); Dodge and Drop against ranged attacks (+3, goes prone, B377); side −2, rear none; stunned −4 and no retreat.

## Injury

Standard GURPS HP (B377–420) or the user's Revised Fractional Health (see the rules document on the user's Drive; five boxes per level, multi-box hits). Both use armour divisors, Weak Points, regenerating shields, wounding multipliers, Injury Tolerance, Damage Reduction, follow-ups, and:

- **Crippling** (B420–421): a crippled arm drops what it holds (a two-handed weapon becomes unusable); a crippled leg or foot drops the model prone and it can only crawl.
- **Knockback** (B378): crushing and cutting damage over ST−2 moves the target 1 yard per (ST−2) and it must roll DX or fall prone.
- **Bleeding** (B420): every minute, a model below full HP rolls HT or loses 1 HP (standard mode).
- Shock, knockdown and stun, consciousness and death checks, Hard to Kill, Reanimation Protocols, morale (as before).

## Psychic powers

Psykers use the attack and defence powers listed for their template in `data/sim/powers.yaml` (built from the psyker traits under the project's Sorcery model). A power with Malediction (B106) is a Quick Contest of skill against the target's Will (or HT) instead of an attack and a defence, at −1 per yard (level 1), normal range penalties (level 2) or none within 200 yd (level 3). Warp powers fail against a blank (Pariah Gene). A power is used like a weapon when its expected harm beats the psyker's weapon: it rolls its skill, pays its FP cost, and on the listed Perils trigger rolls the listed consequence. FP loss is tracked; a model at 0 FP or below rolls HT to act (B426).

## Data the engine reads

- Templates (`Library/**/*.gct` via the site data): attributes, skills, traits and combat flags.
- Equipment: weapon lines (damage, Acc, range, RoF, shots, ST, Bulk, Rcl, reach, parry, skill and defaults), DR by location, Weak Points, servo ST, Basic Move and HP bonuses, `block` attributes (shields).
- `data/sim/loadouts.yaml`: default kit per template.
- `data/sim/weapons.yaml`: per weapon line, facts the stat line doesn't carry: `malf`, `overheat` (damage to the firer on a critical failure), `blast` (radius in yards for non-`ex` area weapons), `cone` (yards), `db` (shield Defense Bonus).
- `data/sim/powers.yaml`: psychic powers per template.

## Not modelled

Vehicles, stealth detection beyond an ambush option, psychic powers other than attacks and defences, morale beyond the half and quarter checks.
