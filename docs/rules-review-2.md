# Rules review, second pass

A second review of the simulator engine and the library data against the books: Basic Set (Characters and Campaigns), Martial Arts, Tactical Shooting, High-Tech, Ultra-Tech and Powers. The first pass is `gurps-rules-review.md`; it covered the engine against the Basic Set only and could not read some pages.

Three reviewers worked separately, each on one area, reading the engine as it stood on 2 October 2026 and the book pages they cite:

| Report | Area |
|---|---|
| [A: attacks and defences](rules-review-2/A-attacks-defences.md) | success rolls, maneuvers, ranged and melee attacks, defences, grappling, movement |
| [B: injury, hazards and vehicles](rules-review-2/B-injury-hazards-vehicles.md) | damage and injury, conditions, explosions, fright, terrain, vehicles, and the pages the first pass could not read |
| [C: data and statistics](rules-review-2/C-data-and-stats.md) | point costs, weapon, armour and vehicle statistics, and the code that derives combat numbers from them |

Each report lists the status of the first pass's findings in its area, its new findings with book page and file and line, what it checked and found correct, and what it could not check. Line numbers are as they were before the fixes below. The user's house rules in `framework.md` and `simulator.md` were left alone.

## Where things stand

- **The first pass's findings** are nearly all fixed. Still open: Enhanced Parry and Weapon Master by weapon (#56), groin effects (#40), eye blinding (#43), the shield-arm penalty (#44), DR 0 against fractional armour divisors (#35), and a parry against a thrown weapon (part of #78).
- **The library data is in good shape.** Every template's total equals the sum of its lines, attribute costs are right, derived statistics match the framework's tables for all 96 templates, every framework anchor matches the data, and the thrust and swing tables, skill levels, minimum ST and damage parsing are correct.
- **Eleven engine errors were fixed** after this review (see below).
- **The rest is listed here for a decision**, because each either changes point totals in the library, is a judgment about how far to take a rule, or may be a simplification that was meant.

## Fixed after this review

Each has its page and the measured effect in `changelog.md`.

1. Vehicle Hit Location Table as B554 has it, with the vital area (B N3).
2. A limb is crippled by wounds that add up (B N1).
3. An explosive landing on an occupied hex hurts the figure there (A 4, B N2).
4. Move and Attack capped at 9 after Telegraphic Attack and hit location (A 1).
5. Suppression fire is an All-Out Attack (A 2).
6. Diving for cover gets +3 (A 3, B N5 in part).
7. An unbalanced weapon is unready to parry only after it struck (A 7).
8. A Quick Contest both fail goes to the smaller margin (A 10).
9. High Pain Threshold no longer helps recovery from stun (B N4).
10. Overpenetration divides the whole cover value (B N7).
11. Fright Check Table: margin at least 1, rows 14 and 15 stun for 1d (B N8).

## Open: the engine

In rough order of effect on fights. "Decide" marks the ones that may be intended.

| Finding | Book | Report | Note |
|---|---|---|---|
| Bulk replaces the range penalty at 1 to 3 yards, not only in the same hex | B391 | A 5 | Decide: `simulator.md` describes it. A boltgun at one yard is at −4 where the book has 0 |
| Nobody dives for cover from shells, missiles or mortar rounds, only from thrown grenades | B414 | B N5 | The +3 is fixed; who may dive is not |
| Opportunity fire (a Wait) has no penalty for the area watched | B390 | A 6 | 0 to −5 by hexes watched, −2 more to check the target |
| A missed cone catches nobody | B413-414 | A 8 | Decide: the doc records it. The book scatters the aim point and still draws the cone |
| Vehicles: no shock passed to the crew, no control roll after major damage, flammable hulls never burn | B484, B469, B555 | B N6 | Each small; how far to take them for a one-hex vehicle is a design call |
| Firing up and down adjusts range for beam weapons too | B407 | A 14, B N9 | Lasers should ignore it |
| A runaround attack gets "no defence" instead of −2 | B391 | A 9 | 1 to 3.5% of melee defences in test runs |
| One-handed weapons parry attacks from the shield side | B390 | A 11 | Small |
| Suppression fire: the cap should be 8 plus bonuses for mounted guns, darkness should not count, hits are not capped across targets | B410 | A 12 | Small |
| A stray round stops when a bystander dodges it | B390 | A 13 | The book carries on to the next figure |
| Knockdown for head and vitals hits is skipped once shock is at its cap | B420 | B N10 | Small |
| Crippling thresholds ignore extra limbs; a crippled shield arm drops the whole shield | B421 | B N11, N13 | Small |
| Three fire details; fractional divisors against DR 0 | B433-434, B379 | B N12, N14 | Small |
| Smaller items | | A 14, B N15 | −1 defence against two weapons never applied; Telegraphic Attack stacks with feint, Evaluate and Riposte; unseen mortar fire should scatter by the margin squared; retreat after sprinting; large shields lack −2 to attack; Aim survives other maneuvers; a critical Dodge should dodge a whole burst; Acrobatic Dodge, Double Defense and choking are not modelled |

One question for you rather than a finding (B): whether models with High Pain Threshold should roll for knockdown on head and vitals hits that are not major wounds. They never do now, because they never take shock. The other reading would let aimed skull and vitals hits stun Marines, Orks and Necrons.

## Open: the data

These change what is on the character sheets, so none was changed without you.

| Finding | Book | Effect |
|---|---|---|
| Affliction's "Advantage" enhancement is priced at a tenth of its cost (+1% a point where the book has +10%) | B36 | Eleven abilities: six Aeldari runes, three Synapse Creature traits, Sanctuary. Farseer +43 points, Grey Knight add-on +13, Tyranid Warrior, Zoanthrope and Hive Tyrant +9 each, Warlock +7; it also breaks the Warp Empowerment caps in the notes |
| Auramite armour counts its servo ST twice | framework | Custodians come out at Lifting ST 60 and Striking ST 52 instead of 50 and 46, in GCS and in the simulator |
| Eight staves parry at 0 | B273 | The book and the framework give +2: Parry is 2 low for the Sanctioned Psyker, Magos, Chaos Sorcerer, Cryptek and Weirdboy |
| Twenty axes, mauls and clubs are −1U "per the Basic Set" | B271-274 | The book figure is 0U; only the Choppa's −1U is in the framework |
| Heavy weapon Accuracy is on two scales | HT, UT | Missile Launcher Acc 10 and Lascannon 14 against the framework's rifle scale of 4 to 5 |
| Brawling damage: +1 at any level, and never the +1 a die at DX+2 | B182 | `20-units.js`; the Carnifex's claws and the Warboss's klaw lose most |
| Single-limb augmetics are written as whole-body Lifting and Striking ST | B40, B47 | The Enginseer swings at ST 20 with Basic Lift 125 |
| † on bolt and plasma pistols | B270 | As written a ST 10 or 11 officer needs both hands, so the Commissar, Inquisitor and Interrogator cannot hold pistol and blade; the design note reads the mark the other way. Which is meant? |
| A fixed bayonet is thrust +1 | HT197, B273 | The books give thrust +3; the Guardsman also has no Spear skill, so he stabs at 7 |
| Smaller | | † missing on long arms and two-handed melee weapons; heavy bolter ST; the Devourer's Rapid Fire bracket; Cone +50%; several small advantage and skill costs; vehicle HP from loaded weight; shield DB counted for Block only; stale notes on ten templates |

Small derivation bugs in the code (report C, item 17): Lifting ST used for throwing distance (B65 says it does not count); the powered-armour test misses "Tactical Dreadnought Armour", so Terminator plate counts as carried weight; armour SM and Dodge bonuses are not read; Shortsword defaults in `build_gcs.py` off by one for Force Sword and Saber.

## A balance point the fights showed

Not a rules error, but worth knowing: the Leman Russ's front (DR 1350) is beyond almost everything a squad carries. In 30 battles each, a Tactical squad with a meltagun and a lascannon beat it once before the fixes and not at all after, three lascannon teams lost every time in about eight seconds, and a krak missile (about 75 points with a divisor of 5) cannot get through its front at all. If that is harder than you mean it to be, the levers are the lascannon and missile figures or the glacis; `changelog.md` records how those numbers were set.

## Not covered

Revised Fractional Health (the rule document is not in the repository), the force-field rules against Ultra-Tech, project-only rules with no book text (Perils of the Warp, Reanimation Protocols, horror checks), Thaumatology: Sorcery, Pyramid 3/77 and the Progressive Recoil document, and most of Tactical Shooting's options. The † and ‡ marks in the books' weapon tables could not be read from the extracted text.
