# Review C: game data and derived statistics

Scope: the YAML under `data/` (factions and `data/sim`), `tools/build_gcs.py`, `tools/build_site.py` (`combat_flags`, `character_stats`) and `tools/sim/engine/20-units.js` (with the parsers in `10-rolls.js`), checked against the Basic Set, High-Tech, Ultra-Tech and Powers and against `docs/framework.md`. Read-only: nothing in the repository was changed.

Page references: B = Basic Set (Characters to p. 336, Campaigns after), HT = High-Tech, UT = Ultra-Tech, P = Powers. Rules are paraphrased.

How it was done: every trait library, every equipment file and all 96 templates were flattened by script (includes resolved, GCS cost arithmetic reproduced) and read as one list; every weapon line and armour entry was read; each template's total was recomputed; the built site was loaded into the simulator and every default loadout was built with `SIM.buildUnit` to see the numbers the engine actually derives. The earlier engine review (`docs/gurps-rules-review.md`) was read first, and its findings are not repeated here except where a page it could not settle is now settled.

Documented conversion choices (damage scale, DR scale, Weak Points, Shield Points, Progressive Recoil, bolter Rcl 3, monomolecular (3), Damage Reduction levels, user-directed ST values and so on) are not reported.

---

## 1. Findings, by impact

### 1. Affliction "Advantage" enhancement priced at a tenth of its cost
- **Kind:** wrong cost.
- **Where:** `data/xenos/aeldari/traits.yaml` 929 (Guide), 950 (Fortune), 1089 (Conceal), 1128 (Protect), 1166 (Enhance), 1226 (Embolden); `data/xenos/tyranids/traits.yaml` 276, 307, 332 (Synapse Creature: Warrior, Zoanthrope, Hive Tyrant); `data/imperium/psykers/warp.yaml` 992 (Sanctuary). Grep: `Advantage Delivered`.
- **Data has:** an Affliction that grants an advantage, with the enhancement set equal to the advantage's point value as a percentage (a 25-point effect is "+25%", a 10-point one "+10%"). The design notes treat it as the mirror of the Disadvantage enhancement.
- **Book:** the two are not symmetrical. Inflicting a disadvantage costs +1% per point of the disadvantage; granting an advantage costs +10% per point of the advantage (B36).
- **Corrected costs** (same other modifiers): Guide 20 → 43; Fortune 14 → 27; Conceal, Protect, Enhance 9 → 18 each (each pair of alternative abilities 21 → 23); Embolden 8 → 12 (if it is Fearlessness 2, 4 points, +40%; the pair 64 → 65); Synapse Creature (Warrior, Zoanthrope) 25 → 34; Synapse Creature (Hive Tyrant) 30 → 39; Sanctuary 13 → 26.
- **Affected templates:** Farseer +43, Warlock +7, Tyranid Warrior (both) +9, Zoanthrope +9, Hive Tyrant +9, Grey Knight Add-On +13.
- **Knock-on:** the Warp Empowerment cap. Guide's note says it needs Aeldari Warp Empowerment level 1 (cap 20); at 43 points it needs level 4.
- **Impact:** medium on point totals; none on simulated fights.
- **Confidence:** high (B36 read). Nothing in the framework makes this a house rule.
- **Fix:** multiply each "Advantage Delivered" percentage by 10, or rebuild the buffs another way and say so in the framework.

### 2. Auramite power armour counts its servo strength twice
- **Kind:** wrong statistic (and inconsistent with the framework).
- **Where:** `data/custodes/armour.yaml` 14 (container: Lifting ST +10, Striking ST +6) and 85 (child "Servo-Motor Actuators (Aquilon Pattern)": the same bonus again; its design note says it "duplicates the parent entry's own servo ST bonus").
- **Framework:** "Servo Lifting/Striking ST lives on the servo child only." The Mark VII and Indomitus entries follow that; Auramite is the only suit with the bonus on both.
- **Effect:** GCS adds the features of a container and its equipped children, and `armourProfile` in `20-units.js` walks `flat(hit.e)` and sums both. The default Custodian Guardian and Shield-Captain loadouts come out at Lifting ST 60 and Striking ST 52 instead of 50 and 46: Basic Lift 720 instead of 500, thrust 5d+2 instead of 5d, swing 8d-1 instead of 7d+1. The guardian spear shows 9d+15(10) imp where 9d+13(10) is right.
- **Impact:** medium for Custodes fights and for the GCS sheet.
- **Confidence:** high (built in the simulator and read off `u.liftST`).
- **Fix:** remove `attributes` from the Auramite container (line 14), as on the Mark VII.

### 3. Staff weapons parry at 0 where the framework and the Basic Set give +2
- **Kind:** wrong statistic / inconsistent with the framework.
- **Where:** Force Staff and Force Staff, Astartes Pattern (`data/imperium/psykers/psychic-gear.yaml` 153, 216), Warding Stave (`data/imperium/grey-knights/wargear.yaml` 297), Omnissian Staff and Electroleech Stave (`data/mechanicus/weapons/melee.yaml` 45, 390), Weirdboy Staff (`data/xenos/orks/wargear/melee.yaml` 352), Rod of Covenant and Staff of Light (`data/xenos/necrons/wargear/melee.yaml` 398, 493). The Kroot Rifle's blade stock also uses Staff at parry 0, which is defensible for a rifle.
- **Data has:** `parry: 0` with the Staff skill. The Force Staff's note says this is "the same convention as the Power Stave and Shock Staff", but those two are `parry: 2` now.
- **Book / framework:** a quarterstaff used with Staff skill parries at +2 (B273); the framework says "Quarterstaff-type weapons parry +2".
- **Effect in the simulator:** Parry 2 lower for the Sanctioned Psyker (9, should be 11), Magos, Chaos Sorcerer, Cryptek and Weirdboy default loadouts.
- **Impact:** medium for those models in melee; none on points.
- **Confidence:** high that it contradicts the framework line and the entries it cites as precedent.
- **Fix:** `parry: 2` on the eight staves.

### 4. Axes, mauls and clubs are listed at −1U and called "the Basic Set figure"; the Basic Set figure is 0U
- **Kind:** wrong statistic / notation error.
- **Where (20 items):** Chainaxe, Eviscerator, Power Axe (both), Power Maul (both), Crozius Arcanum, Power Lance, Shock Maul, Guardsman's Club, Entrenching Tool, Force Axe (both), Nemesis Force Halberd, Null Rod, Choppa, Big Choppa, Bosspole, Mek's Kustom Tools, Power Stabba. Grep: `parry: "-1U"`. The Omnissian Axe, Arc Maul and Castellan Axe are −1 without the U.
- **Data has:** −1U, with notes such as "parry −1U, the Basic Set Axe/Mace figure for a one-handed axe" and "the standard Basic Set figure for a simple blunt club".
- **Book:** axe, mace, small mace, pick, maul, great axe, warhammer and the polearms are all 0U; greatswords are 0 (B271-274). Only knives carry −1.
- **Second error in the same notes:** U is explained as "cannot parry again with it until a turn has passed since the last parry (B404)". The rule is that an unbalanced weapon cannot parry in a turn in which it has attacked, and the reverse (B269). The engine already implements the book rule, so only the note is wrong.
- **Framework:** it lists −1U for the Choppa only, so that one is documented; the rest are not.
- **Effect:** every axe or maul user parries 1 lower than by the book (Khorne Berzerker 13, Ork Boy 9, Enginseer 8).
- **Impact:** medium-small on fights. **Confidence:** high on the book; medium that the −1 was not intended (the notes say it is the book figure).
- **Fix:** 0U (and 0 for the Eviscerator, or 0U if it is meant to be unbalanced), keeping −1U for the Choppa and Big Choppa as the framework says; correct the U sentence and its page.

### 5. Heavy weapon Accuracy is on two different scales
- **Kind:** inconsistent with the framework.
- **Where:** `data/imperium/weapons/heavy.yaml`: Lascannon Acc 14 (line 13), Missile Launcher Acc 10 (186-206); also Heavy Rail Rifle 15, Ranger Long Rifle 11, Synaptic Disintegrator 10 in the xenos files.
- **Framework:** pistols 1–3, carbines 3–4, rifles 4–5, +1 to +3 for an optic, beams about +2 over a slug-thrower. Nothing on that scale reaches 10. The lasgun is 6 and the long-las 9.
- **Books:** Ultra-Tech lasers are Acc 12 (rifle) and 18 (semi-portable), so a lascannon at 14 is in range on that scale, but the lasgun at 6 is not on that scale. Unguided launchers in High-Tech are Acc 1 to 4 (HT148: light anti-armour weapon 1, RPG 2+1, recoilless rifle 4+1; B281: 3). The missile launcher's Acc 10 has no derivation in its design note.
- **Effect:** with Aim, a missile team adds 10 where comparable weapons add 3; that decides most long shots at vehicles.
- **Impact:** medium on vehicle fights. **Confidence:** medium (the lascannon figure is argued in its note; the missile launcher figure is not).
- **Fix:** missile launcher Acc 3 or 4; decide whether support beams follow the framework scale (lascannon about 8–9) and add that line to the framework.

### 6. Brawling's damage bonus is not applied, and bare punches get +1 at any Brawling level
- **Kind:** derivation bug.
- **Where:** `tools/sim/engine/20-units.js` 270-271 (punch built as `thr` if the template has Brawling or Karate at all, `thr-1` otherwise); `mkWeapon` adds nothing for Brawling.
- **Book:** a punch is thrust −1 crushing (B271). Brawling at DX+2 or better adds +1 per die of basic thrust to Brawling attacks: punches, kicks, claws, bites (B182). Below DX+2 it adds nothing.
- **Effect:** (a) a model with Brawling at DX or DX+1 gets +1 damage it should not have (most templates with 1–2 points in Brawling); (b) models with Brawling at DX+2 or better lose the per-die bonus on thrust-based Brawling lines. Examples: Carnifex Monstrous Crushing Claws, thrust 13d at ST 120, Brawling at DX+4: 19d(5) should be 19d+13(5); Ork Warboss power klaw, thrust 4d+1, Brawling at DX+7: 12d+1(10) should be 12d+5(10); Wrack flesh gauntlet; Kroot beak; Flesh Hooks. Swing-based claws (scything talons, rending claws) are unaffected.
- **Impact:** medium-small. **Confidence:** high on B182; medium on whether the project wants it for power fists (a punch with a fist load is still a punch by B271 note 3).
- **Fix:** punch = `thr-1`; for any line whose skill is Brawling and whose damage starts from `thr`, add +1 per thrust die when Brawling ≥ DX+2 (the Weapon Master code just below is the same shape).

### 7. Single-limb augmetics are built as whole-body Lifting and Striking ST, and mis-costed
- **Kind:** wrong cost / wrong statistic.
- **Where:** `data/mechanicus/traits/augmetics.yaml` 16 and 38 (Augmetic Arm), 57 and 74 (legs), 340 (Servo-Arm). Templates: Enginseer, Magos, Combat Servitor, Techmarine Add-On.
- **Data has:** "Arm ST +2 (B40, 5/level)" for one arm, written as `attributes: {lifting_st, striking_st}`; DR with "Partial (single limb) −60%" and "Partial (both legs) −50%".
- **Book:** Arm ST is 3 points per level for one arm, 5 for two (B40), applies only to that arm and does not change overall Basic Lift. Partial DR is −10% per point of the location's hit penalty, so both arms or both legs are −20% and a single limb is −40% (B47).
- **Corrected costs:** Augmetic Arm, Menial 14 → 12 (6 + 6); Combat 42 → 36 (18 + 18); Augmetic Leg, Menial 5 → 6; Augmetic Legs, Combat 20 → 29 (24 + 5).
- **Effect in play:** GCS and the simulator add the bonus to the whole body. The Enginseer swings his Omnissian axe at Striking ST 20 (arm +6 and servo-arm +3) and has Basic Lift 125; the servo-arm's strength should apply only to the servo-arm, giving ST 17 for the axe (3d−1 swing, not 3d+2) and Basic Lift 24. The Techmarine gets +3 Striking ST on everything.
- **Impact:** medium-small (four templates). **Confidence:** high on costs; the modelling question (GCS has no per-arm ST) is a judgement.
- **Fix:** correct the costs; put the servo-arm's ST on its own weapon line (a fixed damage) rather than as an attribute bonus; note on the augmetic arm that the bonus applies to that arm.

### 8. † on bolt and plasma pistols makes them two-handed for humans; the note reads the mark backwards
- **Kind:** notation error.
- **Where:** `data/imperium/weapons/bolt.yaml` 20, 30 (ST 10†), 83, 93, 130, 140 (13†); `data/imperium/weapons/plasma.yaml` 18, 32 (9†).
- **Data note:** "the † lets it be fired two-handed at the listed ST, one-handed by anyone under ST 10 at the standard penalty".
- **Book:** † means the weapon needs two hands. One hand is possible at 1.5 times the listed ST, but the weapon is unready after each shot; at twice the listed ST it is freely one-handed (B270).
- **Effect:** the engine follows the book, so a Commissar, Inquisitor or Interrogator (ST 10–11) cannot hold a bolt pistol and a sword ready together (`bothReady false` for all three default loadouts), while the Sergeant with a laspistol can. A Marine (2 × 13 = 26) is unaffected.
- **Impact:** medium-small on those three loadouts. **Confidence:** high on the rule; medium on intent ("hard for an unaugmented human to handle" could mean exactly this).
- **Fix:** if pistol and blade together is wanted for officers, drop the † and keep the raised ST (a ST 11 user is then at no penalty, a ST 9 user at −1); otherwise correct the note.

### 9. Fixed bayonet is thrust +1; the books give thrust +3, and the Guardsman has no Spear skill
- **Kind:** wrong statistic / missing.
- **Where:** `data/imperium/weapons/melee.yaml` 49 (Bayonet, "Fixed to lasgun": thr+1 imp, reach 1,2, parry 0, Spear); `data/imperium/humans/guardsman.yaml` skills.
- **Data note:** "follows Basic Set convention for a bayonet fixed to a long arm ... +1 to thrust".
- **Book:** a bayonet on a shoulder arm uses Spear and does thrust +3 impaling (HT197), the same as a spear in two hands (B273). The one-handed spear is thrust +2.
- **Template:** the Guardsman, Sergeant and Traitor Guardsman have no Spear skill, so the default melee attack is rolled at DX−5 = 7, with Parry 7. The same kind of gap (weapon skill not on the template, so it is used at default): Magos and Chaos Sorcerer with staves, Ethereal honour blade, Ork Mek, Painboy and Weirdboy, Farseer's shuriken pistol, Big Mek's mega-blasta.
- **Impact:** small-medium (Guard in melee). **Confidence:** high on the damage; the missing skill is a template choice, flagged because the simulator's default loadout depends on it.
- **Fix:** thr+3 imp; give the Guardsman 1–2 points in Spear (bayonet drill).

### 10. Two-handed marks are missing from almost every two-handed weapon
- **Kind:** notation error (with a small simulator effect for melee).
- **Where:** 101 long arms with Bulk −3 or worse carry a bare number (lasguns, boltguns, autogun, shotguns, plasma gun, meltagun, flamers, pulse rifle, shuriken catapult and so on); 24 two-handed melee weapons carry none (Thunder Hammer, Eviscerator, Nemesis Daemon Hammer and Force Halberd, Executioner Greatblade, Warscythe, Voidscythe, Reap-blade, Big Choppa, both glaives, all the staves). Only 46 lines in the data have a †.
- **Framework:** "Use † for two-handed weapons, B for bipod-mounted and M for mounted, per the Basic Set." B270 defines † and ‡.
- **Effect:** ranged: none, because `20-units.js` treats any gun of Bulk −3 or worse as two-handed whatever the mark. Melee: `oneHand()` returns true for a bare number, so these weapons count as one-handed: a Chaos Sorcerer or Sanctioned Psyker has pistol and staff both ready, and nothing stops a two-handed weapon being paired with a shield.
- **Impact:** small. **Confidence:** high.
- **Fix:** add † (or ‡ for mauls, great axes and polearms, as in B272-274) to the lines listed; the script output listing all of them is easy to regenerate with `grep -n "st: [0-9]*$"` against the two-handed skills.

### 11. Heavy weapons: the B mark is used to mean "the mount carries it", and ST is far below the framework formula
- **Kind:** inconsistent with the framework.
- **Where:** Heavy Bolter and Infernus Heavy Bolter 85 lb, ST 14B; Blastmaster 80 lb, 14B; Heavy Stubber 40 lb, 12B; Hot-Shot Volley Gun 30 lb, 10B; Assault Cannon 55 lb, ST 15 with no mark; Shuriken Cannon 32 lb, ST 12.
- **Data note (heavy bolter):** B "marks that the mount, not the gunner's back, bears most of that weight, so the ST figure covers recoil control".
- **Book:** the listed ST of a B weapon is what it takes to fire it unsupported; prone on the bipod it drops to two-thirds (B270). M is the mark for a weapon whose ST is ignored on its mount. For scale: an 84-lb heavy machine gun is ST 21M (HT137), a 61-lb rotary gun 20M (HT137), a 30-lb light machine gun 13B (B281). The framework formula, the square root of ten times the weight, gives 29 for 85 lb.
- **Effect:** a ST 11 Guardsman fires an 85-lb heavy bolter from the hip at −3 and prone at no penalty. Heavy-weapon teams are set up as mounted anyway, so the default squads are barely affected.
- **Impact:** small. **Confidence:** medium (no bipod weapon this heavy exists in the books to compare directly).
- **Fix:** heavy bolter about 20M (as the autocannon and lascannon are M), assault cannon 20M or a higher bare ST, and keep B for guns that really are fired from a bipod.

### 12. Devourer: wrong Rapid Fire bracket; ranges and Accuracy of the bio-weapons are not paid for
- **Kind:** wrong cost.
- **Where:** `data/xenos/tyranids/bio-weapons.yaml` 155 (Devourer, 88 points, "Rapid Fire, RoF 5-8 bracket, +70%").
- **Book:** RoF 4–7 is +70%; RoF 8–15 is +100% (B108). At RoF 8 the Devourer is 40 × 2.5 = 100 points. Both Tyranid Warrior templates +12.
- **Also:** every ranged symbiote is priced as a plain Innate Attack, whose default is ½D 10, Max 100, Acc 3 (B61), but the weapon lines give 80/240 to 250/750 and Acc up to 4 without Increased Range (B106, +10% per step, half that for ½D or Max alone) or Accurate (B102, +5% per +1). The limited, slowly regrowing shots are not credited as a limitation either. These roughly offset; confidence medium.
- **Impact:** small. **Fix:** Devourer 100; add the range and accuracy modifiers to the builds or state that range is free for symbiotes.

### 13. Smaller cost errors against the Basic Set
Each is high confidence unless noted, and small.

| Trait | Where | Data | Book | Affected |
|---|---|---|---|---|
| Flame Breath, "Cone, +50%" | `imperium/psykers/warp.yaml` 763 | 30 | Cone is +50% plus +10% per yard of width, so +60% at least (B103): 33, which also breaks its "Warp Empowerment 2 (cap 30)" note | Sanctioned Psyker +3 |
| Resistant to Poison, note "+8" | `chaos/traits.yaml` 183 | 5 | Poison is a Common category, 15 points; +8 is half: 7. Five points buys +3 (B81). The framework says +8 | Mark of Nurgle, Plague Marine +2 |
| Social Regard (Ecclesiarchy) | `imperium/common/imperial-traits.yaml` 329 | 2/level; note says it is "not a Basic Set trait" | It is: 5 points per +1 reaction, up to +4 (B86). The T'au version already uses 5 | 4 → 10 where taken |
| Legal Enforcement Powers (Inquisitorial Rosette) | same file, 169 | 4 levels, 20, "its maximum" | Three fixed levels: 5, 10 or 15 (B65) | Inquisitor −5 |
| Weapon Master (Swords) | `chaos/templates/chaos-lord.yaml` 147 | 20, "one weapon group" | 20 is one specific weapon; two weapons 25, a small class 30, a medium class such as all swords 35 (B99) | Chaos Lord +15, or rename to one weapon |
| Electrostatic Gauntlets | `mechanicus/traits/augmetics.yaml` 478 | 8/level × 7 = 56 | Round once, at the end: 35 × 1.5 = 52.5 → 53 | Electro-Priest −3. The Electroleech Staff (13/level) has the same per-level rounding |
| Vortex of Doom, "Explosion, +200%" | `imperium/psykers/warp.yaml` 1064 | level 4 | Explosion has three levels, +150% at most (B104) | GM-reference power only |
| Mind War, "Based on Will, +25%" | `xenos/aeldari/traits.yaml` 1023 | +25% | +20% (B102); the total happens to stay 20 | none |
| Distinctive Features (Third Eye) | `imperium/psykers/navigator.yaml` | −5 | Distinctive Features is a quirk, −1 (B165); −5 would be Unnatural or Supernatural Features | Navigator |
| Callous with `cr: 12` | several | self-control number | Callous has no self-control roll (B125) | cosmetic |

### 14. Skills that are not skills, or have the wrong difficulty
- **Language (Binharic)** is an IQ/Average skill (`data/mechanicus/skills/skills.yaml` 10; Enginseer 4 points, Magos 8, Techmarine 4). Languages are bought as advantages by comprehension level, 2 points for Accented and 4 for Native in one mode pair, up to 6 (B24). The framework itself calls binharic "a Language".
- **Navigation (Warp)** is IQ/Hard on the Navigator (`data/imperium/psykers/navigator.yaml` 76, 20 points) but IQ/Average in `data/imperium/common/skills.yaml`; Navigation is Average (B211). The Navigator is one level low for his points.
- **Impact:** small. **Confidence:** high.

### 15. Vehicles: HP from loaded weight, and no Range
- **Kind:** inconsistent with the framework / missing.
- **Where:** `data/imperium/vehicles.yaml`, `data/xenos/orks/wargear/vehicles.yaml`.
- **Framework:** ST/HP is 4 × the cube root of the curb weight. Curb weight is loaded weight minus Load (B463). The data's `weight` is `lwt` × 2,000 lb, the loaded weight, and HP is computed from that.
- **From curb weight:** Trukk 83 (data 92), Land Raider 412 (420), Chimera 334 (340), Rhino 316 (320), Predator 357 (360), Sentinel 96 (96), Leman Russ 400 (400). The framework's own examples (Rhino 320, Land Raider 420, Chimera 340) carry the same slip.
- **Range** (miles on a tank of fuel) is part of the stat block (B463-464) and is absent from every vehicle and from the stat line `build_gcs.py` writes.
- Everything else on the vehicles checks: SM from length with +1 for an elongated box (B19), Move from road speed, Hnd/SR against the APC's −3/5 (B464), HT codes, Occ, location codes, DR by facing against the AV table, and the stat line's "front / average of side and rear" DR (B463).
- **Impact:** small (the Trukk is 10% too tough). **Confidence:** high.

### 16. Shields give a Block bonus, not a Defense Bonus; shield bashes swing
- **Kind:** notation / wrong statistic.
- **Where:** `data/imperium/weapons/melee.yaml` 1397, 1430, 1460; Praesidium Shield; Dispersion Shield.
- **Book:** a shield's DB adds to Dodge, Parry and Block against attacks from the front or shield side (B374). A shield bash is thrust crushing (B273). The data writes DB as `attributes: {block: N}` only (the note says so) and bashes as sw−2, sw−1, sw+1.
- **Effect:** the simulator takes DB from `data/sim/weapons.yaml` and is right; the GCS sheet under-reports Dodge and Parry behind a shield. A swing-based bash in ST 30+ hands does far more than a thrust.
- **Fix:** `attributes: {block: N, dodge: N, parry: N}` (all three are accepted by `build_gcs.py`); bash `thr cr`.

### 17. Derivation code: small items
- **Lifting ST counts for throwing** (`20-units.js` 292, `tST = liftST + ...`, and Basic Lift from it). Lifting ST does not raise ST or Basic Lift for throwing distance (B65). The earlier review left this open and its "verified" list says the opposite. A Marine in power armour throws a grenade 136 yd where 105 is right. Small.
- **Powered-armour list misses Terminator plate by name** (line 299): `POWERED` matches "Terminator" but the Indomitus and Tartaros suits are called "Tactical Dreadnought Armour", so their 300 and 250 lb count as carried load. A Marine has the Basic Lift to ignore it; a ST 11 wearer goes to Light encumbrance in Indomitus and not in Cataphractii. Add `Dreadnought` to the pattern.
- **Armour features not read by `armourProfile`:** Size Modifier (Terminator, Allarus, XV8 and XV88 give SM +1, and the unit stays SM 0, so it is not easier to hit) and Dodge (Holo-Suit +3, Clone Field +2). No default loadout uses the last two.
- **Default table for Shortsword** (`build_gcs.py` 101): Force Sword −3 and Saber −3; the book has −4 for both (B273 heading, B209). No template is affected.
- **Skill bonuses ignore the specialisation** (`build_site.py` 411, keyed on the skill name only): the Grey Knight's +1 to Guns (Rifle) raises every Guns skill.
- **Negative fractional costs round away from zero** (`build_site.py` 75, `floor` for negatives). Fractions round up, in the buyer's disfavour, so −7.5 is −7. No trait in the data produces a fraction today.
- Everything else in section 3 below was checked and is right.

### 18. Slug-throwers with Rcl 1, and the stub revolver's RoF
- **Kind:** inconsistent with the framework. No effect in the simulator (all are RoF 1).
- Stub Revolver RoF 1, Rcl 1 (`data/imperium/weapons/stub.yaml` 114; its note calls Rcl 1 "GURPS convention"): double-action revolvers are RoF 3 and Rcl 2 to 4 (B278), and the framework says pistols are Rcl 2–3 and RoF 3 for anything fired as fast as the trigger allows. Galvanic Rifle Rcl 1 (a solid slug) and Grenade Launcher Rcl 1 (grenade launchers are Rcl 2: B281, HT142) are the same kind. Shuriken and splinter weapons at Rcl 1 are argued in their notes and left alone.

### 19. Stale or wrong text shown on the sheets
- Template notes quote totals that are 1 to 5 points behind the build: Battle-Brother "about 822" (823; other files say 821), Scout "about 440" (445), Primaris "148 skill points ... the Battle-Brother's 168" (149 and 170), Chaos Space Marine 857 (858), Chaos Lord 1181 (1182), Sorcerer 1289 (1290), Berzerker 809 (810), Noise Marine 865 (866), Plague Marine 917 (918), Rubric 596 (597).
- Tyranid weapon notes still give the old strengths: Monstrous Scything Talons and Crushing Claws "Carnifex-scale bearer (ST 60 ...)", "Hive Tyrant (ST 55 ...)" (`bio-weapons.yaml` 727-784). They are ST 120 and 100; the simulator uses the real ST (19d(5) and 17d(3)).
- Chainsword design note says "Fixed anchor: sw+2d(2) cut" (`melee.yaml` 311) and works its percentages at (2); the line and the framework are (3).
- `docs/data-format.md` still shows a lasgun at 4d burn, Acc 10, 700/2100.
- The framework says a Marine "exceeds 1.5 × 19 and so can fire it one-handed"; at 1.5 times the weapon is unready after each shot and it takes twice the ST to do it freely (B270). The engine has this right.
- The Barbed Strangler anchor is "4d cr ex [3d cut]"; the data writes the 3d as a separate "Vine burst" weapon line, which neither GCS nor the simulator treats as fragmentation.

### 20. Things that look odd next to the books but are, or may be, conversion choices
Not counted as errors; listed so they can be confirmed.
- **Flamers** reach 3 to 8 yards as a cone. Book flamethrowers are jets of 25 to 50 yards or more (B281; HT179). The framework has no flamer anchor, so this choice is not written down anywhere.
- **Buckshot** is a single 6d–8d pi+ projectile at RoF 1–3; book shotguns fire multiple pellets (RoF 2×9, 3×9, Rcl 1, B279).
- **Fragmentation dice above the blast dice** (frag grenade 3d cr ex [4d cut]): as an Innate Attack that would exceed the limit (B104), but as equipment the framework fixes it.
- **Size discount on HP** is applied to the Hive Tyrant and Carnifex but not to the Custodian, Warboss, Ravener, Tyranid Warrior, Lictor or Zoanthrope. The discount is optional (B16); the difference is at most 2 points.
- **Reanimation Protocols** is Extra Life with invented modifiers ("Recurring +100%" and so on); the book route would be Unkillable. A stated house build.
- **Gun Drone**: ST −2 priced at −12 using the No Manipulators discount on a reduction; taken at face value.

---

## 2. Templates recomputed

"Built" is the total GCS and the site compute from the data. "By the book" applies only the corrections above that are certain (findings 1, 7, 12, 13).

| Template | Notes say | Built | By the book | Difference explained by |
|---|---|---|---|---|
| Astra Militarum Guardsman | 100 | 100 | 100 | |
| Militarum Tempestus Scion | 208 | 208 | 208 | |
| Adepta Sororitas Battle Sister | 214 | 214 | 214 | |
| Inquisitor | 563 | 563 | 558 | Legal Enforcement Powers 20 → 15 |
| Astartes Battle-Brother | about 822 | 823 | 823 | Astartes package 573 re-added item by item; note is one behind |
| Astartes Scout | about 440 | 445 | 445 | note stale |
| Custodian Guardian | (in 1,200–1,600) | 1232 | 1232 | 1230 if HP took the Size discount the Hive Tyrant takes |
| Sister of Silence | 319 | 319 | 319 | |
| Grey Knight Add-On | 212 | 212 | 225 | Sanctuary 13 → 26 |
| Sanctioned Psyker | 550 | 550 | 553 | Flame Breath 30 → 33 |
| Skitarii Ranger | 184 | 184 | 193 | Augmetic Legs 20 → 29 (same for the Vanguard) |
| Tech-Priest Enginseer | 265 | 265 | 259 | Augmetic Arm 42 → 36 (Language as a skill not re-priced) |
| Electro-Priest | 185 | 185 | 182 | Gauntlets 56 → 53 |
| Chaos Space Marine | about 857 | 858 | 858 | note stale |
| Chaos Lord | about 1181 | 1182 | 1197 | Weapon Master (Swords) 20 → 35 |
| Plague Marine | 917 | 918 | 920 | Resistant to Poison (+8) 5 → 7 |
| Ork Boy | 341 | 341 | 341 | |
| Ork Warboss | 773 | 773 | 773 | ST +14 at the SM +1 discount, taken on the whole ST 42: checked |
| Gretchin | 10 | 10 | 10 | |
| Necron Warrior | 525 | 525 | 525 | |
| Fire Warrior | 130 | 130 | 130 | |
| Gun Drone | 23 | 23 | 23 | see finding 20 |
| Aeldari Guardian | 187 | 187 | 187 | |
| Farseer | 1131 | 1131 | 1174 | Guide +23, Fortune +13, Runes of Battle +7 |
| Warlock | 445 | 445 | 452 | Runes of Battle +7 |
| Kabalite Warrior | 181 | 181 | 181 | |
| Wych | 313 | 313 | 313 | |
| Termagant | 115 | 115 | 115 | |
| Genestealer | 791 | 791 | 791 | |
| Tyranid Warrior | 849 | 849 | 870 | Synapse Creature +9, Devourer +12 |
| Zoanthrope | 868 | 868 | 877 | Synapse Creature +9 |
| Hive Tyrant | 2296 | 2296 | 2305 | Synapse Creature +9 |
| Carnifex | 2498 | 2498 | 2498 | |

For all 96 templates the built total equals the sum of the listed lines (no arithmetic slip anywhere), and where the notes state a total it matches the build except for the stale ones in finding 19.

---

## 3. Checked and found correct

**Attributes and secondary characteristics.** ST 10/level, DX and IQ 20, HT 10, HP 2, Will and Per 5, FP 3, Basic Speed 5 per 0.25, Basic Move 5 (B14-17), in every "Attribute Modifiers" entry: Astartes 407, Neophyte 250, Primaris 25, Custodian 655, Possessed 50, Rubric −120, every Necron body lens, every Ork lens, every Aeldari and Drukhari package, every T'au caste lens, Kroot, Vespid, every Tyranid body lens. Size discount on ST (−10% per SM, B15) is right for the Custodian, Warboss, Ravener, Tyranid Warrior, Lictor, Hive Tyrant and Carnifex.

**Advantages and disadvantages at book cost.** Combat Reflexes 15, High Pain Threshold 10, Hard to Kill and Hard to Subdue 2/level, Fearlessness 2/level, Unfazeable 15, Damage Resistance 5/level, Tough Skin −40%, Partial skull −70% and torso −10%, Limited DR against burning −40% (B46-47), Injury Tolerance parts (Unliving 20, No Blood 5, No Brain 5, No Vitals 5), Damage Reduction 50/75/100 (P53, matching the framework's 25 per level), Extra Attack 25, Enhanced Dodge 15, Enhanced Parry 5 or 10, Trained by a Master 30, Ambidexterity 5, Lifting ST 3, Striking ST 5, Night Vision 1/level, Acute senses 2/level, Regeneration 10/25/50/100, Rapid and Very Rapid Healing, Enhanced Move 20/level with half levels, Flight 40 with Winged −25%, Clinging 20, Tunneling 30 + 5/level, Super Jump, Chameleon, Silence, Perfect Balance, Infravision, Doesn't Breathe/Eat/Sleep, Sealed, Filter Lungs, Extended Lifespan, Unaging, Less Sleep, Reduced Consumption, Resistant at the 30/15/10 bases with the ×1, ×½, ×⅓ levels (other than the one in finding 13), Mind Shield, Charisma, Luck, Rank 5/level, Status, Wealth, Reputation, Striker 7 for cutting, Extra Arm with Extra-Flexible. Every disadvantage value checked (Berserk, Bloodlust, Bad Temper, Fanaticism, Slave Mentality, Low Empathy, Cannot Speak, Blindness, No Manipulators, Unhealing, Reprogrammable, Duty, Sense of Duty, Code of Honor, Vow, Secret, Social Stigma, Odious Personal Habit, Dependency with Aging, and the rest). All self-control numbers are 12, so no multiplier applies.

**Innate Attacks and psychic powers.** Per-die costs by damage type (B61), Armor Divisor steps, Area Effect steps and radii, Explosion levels 1–3, Malediction levels, Emanation, Increased Range, Accessibility, Preparation Required, Melee Attack (B102-112); the arithmetic of every power in `warp.yaml`, the Aeldari runes, the Tyranid and Ork powers; alternative-ability groups at one-fifth for the cheaper members.

**Skills.** Every skill name in every template has the Basic Set's controlling attribute and difficulty, except the two in finding 14. Skill levels derived by `skill_level` match the point table (1, 2, 4, then +1 per 4 points; B170) for Easy to Very Hard. Defaults written in `skills.yaml` match the book.

**Thrust and swing.** The table in `build_site.py` and the one in `20-units.js` match B16 for every row from ST 1 to 100, and +1d per full 10 above (Carnifex ST 120: 13d/15d). Basic Lift is ST²/5 on Lifting ST. Derived stats for all 96 templates (ST, DX, IQ, HT, HP, Will, Per, FP, Speed, Move, Dodge) match the framework's stat tables line for line.

**Weapons against the framework.** Every anchor in the framework's weapon, armour, field, vehicle-armour and faction tables was compared with the data line: all match (damage, divisor, follow-up, RoF, range where given, DR by location, eye-lens three-quarters rule, gap DR at 0.4 of the limb, Weak Points, heretic Weak Points +1, Shield Points). The power-field rule (+3d, hammers +6d, fists thr+8d, Custodes +4d, a field-off line on each) holds on every power weapon.

**Weapons against the books.** Lasguns sit beside the TL10 laser rifle (UT: 6d(2), RoF 10, 8 lb, Bulk −4, Rcl 1) apart from the framework's lower Acc; bolters beside the 15mm gyroc (6d pi++, RoF 3) with the documented higher Rcl; plasma and fusion weapons below the UT heavy plasma gun in range and RoF as the framework intends; chain weapons match the vibroblade's (3) divisor; power armour's Lifting +9/Striking +5 sits in the UT battlesuit range (+8/+4 to +20/+20) and, like those suits, its weight is not carried; hollow-point style rounds follow the (0.5) and damage-type step (B279).

**Derivation code.** Skill level from attribute plus relative level, with weapon defaults (the default families for Beam Weapons, Guns, Gunner, Liquid Projector, Throwing, Broadsword, Knife, Axe/Mace, the two-handed skills, Spear, Polearm, Staff, Force Sword and Flail match the book); minimum ST −1 per point for ranged and melee; damage capped at three times a melee weapon's ST; † one-handed at 2×, usable but unready at 1.5×, ‡ at 3×; B at two-thirds prone; M ignored on the mount (B270); `parseDamage` on every damage string in the data, including "8d+2x2(2) pi++", "sw+3d+1(10) cut", "thr+1(inf) imp", "sw(2) cor", "4dx3 burn (ignores DR)", "6d cr ex [3d cr]" and bare "cr" (correctly no attack); minimum damage 0 for crushing, 1 otherwise; RoF "3x2" as six rounds; Shots and reload in every form used; Acc with a scope term; range strings; DR summed per location with "all", DR limited to a damage type left out, eye falling back to face; natural DR kept apart from armour; encumbrance levels and their Move and Dodge effects (B17); Parry and Block formulas; throwing distance table (B355); vehicle Dodge and ramming dice (B470, B430); trait flags for Combat Reflexes, High Pain Threshold, Hard to Kill, Fearlessness, Damage Reduction levels, Injury Tolerance parts and Regeneration tiers.

---

## 4. Not checked, and why

- **The † and ‡ marks in the book tables.** The text extraction drops the dagger characters, so the marks on individual book weapons could not be read; finding 10 rests on B270's definitions and the framework's own rule.
- **Thaumatology: Sorcery, Pyramid 3/77, Low-Tech.** Not among the extracted books. Warp Empowerment (10 + 10/level), Psyker Talent (10/level) and the −15% Sorcery modifier are taken as stated; the "Quadratic Natural Attacks" weight rule is too.
- **Psionic Powers, Martial Arts, Tactical Shooting, Gun Fu.** Not needed for anything in the data; not read.
- **Project-specific traits.** The gene-seed organs (other than their components), Null Aura, Shadow in the Warp, Warp Field, Act of Faith, Power from Pain and the combat drugs are builds of the project's own; their arithmetic was checked, their fairness was not.
- **Cost, TL and LC of equipment**, and weights against lore sources.
- **`data/sim/powers.yaml`, `ai.yaml`, `squads.yaml`** beyond what `buildUnit` reads; the engine files other than `10-rolls.js` and `20-units.js` (covered by the earlier review).
- **The design field of every entry.** About 150 files; the derivations were read where a number looked wrong or a finding depended on intent, not everywhere.
- **GCS itself.** Costs were reproduced with the same arithmetic as `build_site.py`; the GCS application was not run. `Library/` and `site/` as committed were assumed to be in step with `data/` (the totals agree for all 96 templates).
