# Combat simulator: rules and data

The simulator (`tools/sim.js`, the Combat Simulator page on the site) plays GURPS 4e combat second by second on a hex map and repeats the battle many times. This page is the contract between the engine and the data: what the engine models, which Basic Set rule it follows, and what data it reads.

## Map and movement

- Hex grid, 1 yard per hex (B384), axial coordinates. The two sides deploy facing each other at the chosen distance; each unit deploys in a line with models 2 yards apart unless it has a formation setting.
- Every model has a facing (six directions). Front arc: the front hex and the two front-side hexes; side: the two flank hexes; rear: the back hex (B385). An attack from a side hex gives the defender −2 to active defences; from the rear, no active defence (B390–391).
- Movement costs 1 per hex. A model may change facing freely at the end of any maneuver that lets it move.
- Terrain: an optional cover setting per side. A model in cover has legs, feet and groin behind it: attacks on those locations hit the cover (its DR) first, and ranged attacks on the model take −2 (half exposed) (B407).
- Posture: standing or prone. Prone: −4 to melee attacks, −3 to defences, and ranged attacks against the model are at −2; standing up is a Change Posture maneuver (B551).

## Turn and maneuvers

Every model acts once per second in Basic Speed order (ties random), choosing one maneuver (B363–366):

- **Move** (full Move), **Move and Attack** (ranged: −2 or Bulk, no Acc; melee: −4, skill capped at 9, B365), **Attack**, **Aim** (+Acc, +1 more after 2 turns and +2 after 3; +1 if braced, B364), **Evaluate** (+1 per turn up to +3 to the next melee attack on that foe), **Feint** (Quick Contest of weapon skill; margin comes off the foe's next defence, B365), **All-Out Attack** (Determined: +4 melee / +1 ranged; Double: two attacks; Strong: +2 damage or +1/die; no active defence until next turn, B365), **All-Out Defense** (Increased: +2 to one defence type, B366), **Ready** (reload, clear a jam, pick up a weapon), **Change Posture**, **Concentrate** (psychic powers that need it).
- The model's AI picks the maneuver with the best expected result: All-Out Attack when the foe cannot hurt it or it cannot be defended against anyway, Feint or Deceptive Attack against strong defences, Rapid Strike (two attacks at −6, B370) when skill allows, Aim for accurate low-RoF weapons at range, Evaluate when closing is not possible this turn, All-Out Defense when it cannot hurt its foe and is being attacked.

## Attacks

- **Target location** (B398–400): by default only elites call shots (user direction): a template of 200+ points (the framework's Elite tier and up) with IQ 8+. Everyone else hits random locations (B552) with the framework's 1-in-6 eye-lens rule. Settings let everyone aim (RAW) or no one. An aiming attacker chooses where to hit, weighing the penalty against the damage: torso 0, vitals −3 (imp, pi, tight-beam burn ×3), skull −7 (×4, DR +2), eye −9 (via the helmet's eye DR), face −5, neck −5, arm or leg −2, hand −4, foot −4, groin −3.
- Ranged: range penalty (B550), rapid-fire bonus and Recoil (B373), spreading automatic fire over two or three models, Min ST, ½D (half damage). Shots, reloads (Ready maneuvers), regrowing bio-weapon ammunition.
- **Malfunction** (B407): a roll at or above the weapon's Malf fails to fire and the weapon jams (1d turns of Ready to clear); a critical failure with a weapon marked `overheat` damages the firer as the data says (plasma).
- Melee: reach, Deceptive Attack optimised against the defender's best defence, Rapid Strike, Extra Attack, unbalanced weapons (no parry after attacking), point-blank fire with a gun when it beats the blade, close-combat reloads when quick.
- **Area effects** (B413–414): explosive (`ex`) damage also hits every model within range at damage ÷ (3 × yards); fragmentation (`[Nd]`) attacks every model within 5 × dice yards at skill 15 with range penalties from the blast point; cones (`Cone N yards` in the usage) hit every model in the cone, and each may Dodge.

## Defence

Dodge, Parry and Block (B374–377); retreat once per turn (+3 Dodge, +1 Parry and Block); multiple parries −4 each; Block once per turn; a shield's Defense Bonus adds to all defences against attacks from the front or shield side (B287); Dodge and Drop against ranged attacks (+3, goes prone, B377); side −2, rear none; stunned −4 and no retreat.

## Injury

Standard GURPS HP (B377–420) or the user's Revised Fractional Health (see the rules document on the user's Drive; five boxes per level, multi-box hits). Both use armour divisors, Weak Points, regenerating shields, wounding multipliers, Injury Tolerance, Damage Reduction, follow-ups, and:

- **Crippling** (B420–421): a crippled arm drops what it holds (a two-handed weapon becomes unusable); a crippled leg or foot drops the model prone and it can only crawl.
- **Knockback** (B378): crushing and cutting damage over ST−2 moves the target 1 yard per (ST−2) and it must roll DX or fall prone.
- **Bleeding** (B420): every minute, a model below full HP rolls HT or loses 1 HP (standard mode).
- Shock, knockdown and stun, consciousness and death checks, Hard to Kill, Reanimation Protocols, morale (as before).

## Psychic powers

Psykers use the attack and defence powers listed for their template in `data/sim/powers.yaml` (built from the psyker traits under the project's Sorcery model). A power is used like a weapon when its expected harm beats the psyker's weapon: it rolls its skill, pays its FP cost, and on the listed Perils trigger rolls the listed consequence. FP loss is tracked; a model at 0 FP or below rolls HT to act (B426).

## Data the engine reads

- Templates (`Library/**/*.gct` via the site data): attributes, skills, traits and combat flags.
- Equipment: weapon lines (damage, Acc, range, RoF, shots, ST, Bulk, Rcl, reach, parry, skill and defaults), DR by location, Weak Points, servo ST, Basic Move and HP bonuses, `block` attributes (shields).
- `data/sim/loadouts.yaml`: default kit per template.
- `data/sim/weapons.yaml`: per weapon line, facts the stat line doesn't carry: `malf`, `overheat` (damage to the firer on a critical failure), `blast` (radius in yards for non-`ex` area weapons), `cone` (yards), `db` (shield Defense Bonus).
- `data/sim/powers.yaml`: psychic powers per template.

## Not modelled

Vehicles, grappling, stealth detection beyond an ambush option, psychic powers other than attacks and defences, morale beyond the half and quarter checks.
