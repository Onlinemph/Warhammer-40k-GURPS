# Conversion Framework

The rules every entry in this project is built against. If a stat block disagrees with this file, the stat block is wrong (or this file needs a deliberate, logged change — see "Changing an anchor" at the bottom).

## Goals, in priority order

1. **Lore accuracy.** Stats should reproduce what the fiction shows: what kills what, what armour stops what, how a Space Marine fights compared to a Guardsman.
2. **Internal consistency.** A bolter built for the Astartes armoury and a bolter carried by a Sister of Battle are the same weapon with the same numbers. Anchors below keep separate files in step.
3. **Built, not borrowed.** GURPS books are used for their *design rules* (how armour divisors work, explosive damage, power modifiers, meta-trait construction). Catalogue entries are never lifted and renamed. A lasgun is not "the Ultra-Tech laser rifle with a new name" — it gets its own derivation, written in the entry's `design` field.
4. **Playability** comes last. Lore scale is the rule: a Space Marine costs what a Space Marine costs, even if that's 700 points.

## Lore sources

When sources disagree, prefer them in this order, and note the conflict in the entry's `lore` field:

1. Black Library fiction and the narrative/background sections of current Codexes and rulebooks.
2. Older Codex and White Dwarf background, Imperial Armour background, Forge World books.
3. Fantasy Flight / Cubicle 7 RPG lines (Dark Heresy 1e/2e, Rogue Trader, Deathwatch, Only War, Black Crusade, Wrath & Glory). These are the best source for *relative* calibration (how much harder carapace is than flak) because they were written to model the fiction at human scale.
4. Tabletop wargame profiles. Use only for ordering (S5 > S4) and never for absolute values: tabletop abstractions like "a lasgun barely scratches a Marine" and "Marines die to massed lasgun fire" are game balance, not lore.

Citation honesty: cite a source only as precisely as you actually know it. "Gaunt's Ghosts series" is fine. An invented page number is not. When unsure, say so ("widely depicted; no single canonical figure").

Write lore and description text in your own words. Don't paste Games Workshop or Steve Jackson Games text.

## Tech level

The Imperium doesn't have one TL; it has a TL it can *manufacture* and older TLs it can only copy or scavenge.

| Category | GURPS TL | Examples |
|---|---|---|
| Primitive / feral worlds | 0–4 | Feral-world blades, black-powder |
| Solid-projectile "stub" tech | 7–8 | Autogun, stubber, stub revolver, shotgun |
| Crew-served support weapons | 6–8 | Mortar (6), autocannon, missile launcher (7–8) |
| Standard Imperial manufacture | 10 | Lasgun, flak and carapace armour, chainsword, bolter, vox |
| Advanced Imperial / rare | 11 | Plasma, melta, power weapons, power armour, hellgun |
| Archeotech / STC-era | 12 | Dark Age relics, some Custodes and Mechanicus pieces |
| Warp-dependent | ^ (superscience) | Force weapons, Geller fields, warp drives, psychic hoods, null rods |

Mark superscience items `10^`, `11^` etc. Imperial *understanding* of their own tech is lower than what they build: a Tech-Priest's Engineer skill is at the item's TL, but the ritualised procedures mean a Guardsman's Armoury skill for the lasgun is fine at TL10.

## Money

Use GURPS $ as an abstract Throne Gelt, 1:1, so GCS totals work. Lore prices are inconsistent across sources; costs here are for campaign balance and relative scarcity. Price rare-tech (plasma, power weapons) high enough that a Guard officer owning one means something.

## Legality class

LC reflects Imperial law and Ecclesiarchy/Mechanicus control, not modern Earth law:

- LC4: cheap civilian stubbers, knives.
- LC3: lasguns, flak (common across the Imperium; every hive has them).
- LC2: military-issue heavy weapons, carapace, hellguns.
- LC1: bolters, plasma, melta, power weapons (Astartes, Inquisition, Sororitas, officers).
- LC0: power armour, Astartes/Custodes gear, xenos tech, anything warp-touched. Possession by the unauthorised is heresy.

## Damage and armour anchors

These numbers are fixed. Everything else is placed relative to them.

### Personal armour (DR on covered locations)

GURPS real-world baseline for scale: a modern soft vest with ceramic plate is roughly DR 30–35, and a 5.56 mm rifle round is about 5d pi. 40k armour and weapons sit well above that.

| Armour | Torso DR | Notes |
|---|---|---|
| Unarmoured | 0 | |
| Flak (vest/jacket) | 12 | Stops shrapnel and pistol rounds. Lasgun and autogun hits usually get through; bolts always do. Flak helmet DR 10. |
| Mesh | 15, flexible | Hive-noble and assassin wear. Flexible: blunt trauma applies. |
| Carapace | 45 | Rigid plate. Stops stub rounds; stops most lasgun hits; a hellgun or bolter goes through. |
| Adepta Sororitas power armour | 70 | Lighter than Astartes plate. A bolter penetrates about four shots in five. |
| Astartes power armour (Mk VII baseline) | 100 | Ignores las and stub fire. A bolter penetrates about one shot in seven. Limbs a little lower. Eye lenses DR 50. Marks vary ±10–15 around this. |
| Mk X Gravis | 130 | Between power armour and Terminator plate. |
| Tactical Dreadnought (Terminator) | 200 | Ignores bolters. Plasma, lascannon, power fist and thunder hammer still kill. |

Limbs are usually a few DR below torso. Specify every location explicitly.

### Personal force fields (regenerating shields)

Refractor fields, conversion fields, rosarii, iron halos and storm shields work as regenerating shields, not DR:

- **Shield Points (SP).** Each field has a pool. Damage from an attack the field covers comes off SP first. Armour divisors don't apply to SP; they describe getting through matter.
- **Overflow.** If an attack does more damage than the SP left, the field drops to 0 and the excess carries on to worn armour with the attack's full armour divisor. A bolt stopped by the field detonates on it: its follow-up damage also comes off SP.
- **Recharge.** After a set delay (2–3 seconds) in which the field takes no damage, it regains SP each second until full. Any damage resets the delay.
- **Collapse.** A field knocked to 0 SP needs double its normal delay before it starts recharging.
- Track current SP with the item's Uses counter in GCS.

| Field | SP | Delay | Recharge/s | Covers |
|---|---|---|---|---|
| Refractor field | 40 | 2 s | 10 | Ranged only |
| Rosarius | 60 | 3 s | 10 | All |
| Conversion field | 80 | 3 s | 10 | All; flash on big hits |
| Iron halo | 120 | 3 s | 20 | All |
| Storm shield | 160 | 2 s | 20 | Front and shield side |

Vehicle void shields will use the same rules at larger scale.

### Weapon anchors

| Weapon | Damage | What it has to do |
|---|---|---|
| Laspistol | 3d(2) burn | Kills an unarmoured man in 1–2 hits. |
| Autogun | 5d+1 pi | Lasgun parity against flesh: equally lethal in the fiction and Only War. Stopped by carapace. |
| Lasgun | 5d(2) burn | Punches flak; penetrates carapace (eff. DR 22) about one hit in ten. Useless against power armour. |
| Long-las | 6d(2) burn | Sniper. |
| Hellgun / hot-shot | 6d(3) burn | Built to beat carapace (eff. DR 15). |
| Boltgun (Godwyn/standard) | 6d×2(2) pi++, follow-up 6d cr ex | Turns an unarmoured man to paste; always penetrates carapace. Against Astartes power armour (eff. DR 50) penetrates about one shot in seven (14%): a Marine takes several bolts to kill another Marine. |
| Heavy bolter | 7d×2(2) pi++, follow-up 8d cr ex | Chews light vehicles (AV10, eff. DR 50) about 40% of the time. |
| Plasma gun | 6d×4(3) burn ex | Kills Marines through power armour (eff. DR 33); penetrates Terminators (eff. DR 67) more often than not. Overheat risk. |
| Meltagun | 8d×6(10) burn to ½D; beyond ½D 4d×6(3) | Kills AV14 (eff. DR 35) at short range; past ½D still wrecks AV12 (76%), almost never beats AV14 (5%). |
| Lascannon | 8d×8(5) burn | Kills tanks (AV14 eff. DR 70) and Terminators. |
| Krak missile | 6d×6(3) cr | Reliable vs AV12–13 (90%); about two in three vs AV14. |
| Chainsword | sw+2d(2) cut | Tears flesh and flak; bites carapace; skids off power armour. |
| Power sword | sw+3d(10) cut | The disruption field shears power armour whoever holds it. |
| Power fist | thr+8d(10) cr | Kills Terminators in Astartes hands. |
| Thunder hammer | sw+6d(10) cr | The Terminator-killer; knockback. |

**Power-field rule.** Every disruption-field weapon (power sword, axe, maul, lance, fist, chainfist, thunder hammer, lightning claw) has armour divisor (10) with the field on, and a second weapon line for field-off at the mundane baseline. Bladed/mace power weapons add +3d over the mundane weapon; thunder hammers +6d; power fists thr+8d.

Follow-up damage (B414): the follow-up applies only when the penetrator gets through DR. In GCS, add the follow-up as a second weapon line with usage like "Follow-up (if bolt penetrates)".

Anything in the same family scales from the nearest anchor (bolt pistol from boltgun, plasma pistol from plasma gun) and explains the step in `design`.

### Vehicle armour

Wargame armour values give only relative order. Map them to DR when a weapon needs to be checked against a vehicle:

| AV | DR | Typical |
|---|---|---|
| 10 | 100 | Rear armour, Sentinel, Chimera sides |
| 11 | 150 | Rhino front/sides |
| 12 | 200 | Chimera front |
| 13 | 275 | Leman Russ sides |
| 14 | 350 | Leman Russ front, Land Raider |

Anti-tank weapons must beat the DR they are known to beat in the fiction.

## Characters and species

### Human baseline

Attributes 10, HP 10. Imperial citizens are human; abhumans (Ogryn, Ratling, Squat, Beastman) are racial templates built off human.

### Point-scale targets (lore scale, not a party-balance guide)

| Tier | Typical total | Examples |
|---|---|---|
| Ordinary citizen | 0–50 | Hive worker, scribe |
| Trained soldier | 100–175 | Guardsman, PDF trooper, Arbitrator |
| Elite human | 200–350 | Stormtrooper, veteran Commissar, Battle Sister, Inquisitorial acolyte |
| Senior agents | 350–600 | Field Inquisitor, veteran Interrogator, Canoness, Lord Commissar |
| Astartes | 550–800 | Battle-Brother, veteran, Primaris adds more |
| Heroes and legends | 1,000–3,000 | Chapter Master, Custodian, Living Saint, Lord Inquisitor |
| Beyond play | 5,000+ | Primarchs, Greater Daemons, C'tan shards. Built for GM reference only. |

Equipment is not included in these totals.

### Astartes physiology

The nineteen gene-seed organs each become a trait (or several) inside an **Astartes** racial meta-trait, so a GM can remove or alter one for a Chapter's gene-seed (the Imperial Fists line lacks the Betcher's gland and Sus-an membrane; the Blood Angels carry the Red Thirst). Target physique: ~2.1–2.4 m unarmoured, heavily muscled, ST around 18–20, HT 14+, faster reflexes than baseline humans, fused ribcage, no need to sleep for weeks. Stay at SM 0 unarmoured; a Terminator can be SM +1.

## Psykers and the warp

Psychic abilities in the fiction are the sort of thing GURPS Thaumatology:
Sorcery was written to model: a personal, trained reserve of power that
gates what you may know, sharpened by a separate Talent, drawn on at a
fatigue cost, and prone to backfiring. This project builds 40k psychic
powers directly on that chassis (data/imperium/psykers/warp.yaml has the
full build):

- Discovery, legal status, the Scholastia Psykana, Soulbinding, blanks and
  pariahs, and the Navigator's third eye are unchanged: psychic ability is
  still a rare, dangerous mutation that the Imperium hunts, sanctions, or
  binds into service, depending on what it finds.
- Every trained psychic ability requires **Warp Empowerment**, a reskin of
  Sorcerous Empowerment (TSOR4, 10 points + 10/level): a power's full,
  modified point cost can never exceed the point cost of the psyker's own
  Warp Empowerment. This is what actually gates which powers a given psyker
  may know, and it is what the Adeptus Astra Telepathica's Assignment scale
  (Iota through Alpha, Alpha-Plus beyond play) is calibrated against — see
  the Warp Empowerment trait's notes for the full grade-to-level table.
- **Psyker (Talent)** is this setting's Sorcery Talent (TSOR5, 10/level): it
  sharpens Psyniscience, Meditation, Hidden Lore (the Warp), and the Will
  roll to resist Perils of the Warp, exactly as Sorcery Talent aids a
  sorcerer's related skills in TSOR. It does not gate which powers a psyker
  may know — that is Warp Empowerment's job, on its own separate track.
- **Warp Sorcery** (-20%) replaces the project's earlier bespoke -15% "Warp"
  modifier with Sorcery (-15%, TSOR) stacked with Detectable (-5%, kept from
  the original design). It is cast per Thaumatology: Sorcery (TSOR) — 1 FP
  per casting — and fails against blanks/pariahs, null rods, hexagrammic and
  psychic wards, and inside a Geller field, as appropriate to the scene.
- **Perils of the Warp** stacks on top of Warp Sorcery unchanged: it is the
  40k-specific backlash risk that Sorcery itself doesn't model, scaled by
  how hard the psyker pushes past their safe limit (Pushing, kept as-is).

Psychic abilities are grouped into disciplines (Biomancy, Divination,
Pyromancy, Telekinesis, Telepathy, plus faction lists like Sanctic
Daemonology and Librarius) as Talent-linked power groups, each child ability
tagged with Warp Sorcery and Perils of the Warp. Great Powers (e.g. Vortex
of Doom) are exempt from the Warp Empowerment cap outright — they are
GM-reference material, not something any PC's Empowerment is meant to reach.

## Skills

Use Basic Set skills whenever one fits. Imperial-specific knowledge lives in specialisations, not new skills:

- Forbidden lore → Hidden Lore (Daemons), Hidden Lore (Xenos), Hidden Lore (Heresy), etc.
- The Imperial Creed → Theology (Imperial Creed).
- Mechanicus rites → Machine lore is still Engineer/Mechanic/Armoury at the item's TL; the Cult Mechanicus's faith is Theology (Cult Mechanicus).
- Warp navigation → Navigation (Hyperspace) renamed Navigation (Warp), restricted to Navigators.

New skills only when nothing fits (e.g., Psyniscience is a Talent-affected Perception-based skill).

Weapon skills:

| Weapon type | Skill |
|---|---|
| Las and plasma small arms, melta | Beam Weapons (Pistol / Rifle) |
| Autoguns, stubbers, shotguns, bolters | Guns (Pistol / Rifle / Shotgun / Light Machine Gun) |
| Braced / mounted heavies | Gunner (Beams / Machine Gun / Cannon / Rockets) |
| Flamers | Liquid Projector (Flamethrower) |
| Chainswords, power swords | Broadsword (or Two-Handed Sword) |
| Chainaxes, power axes, maces | Axe/Mace (or Two-Handed Axe/Mace) |
| Power fist, lightning claws | Brawling or Karate (weapon adds damage) |

## Entry checklist

Every entry needs:

- `lore`: what the fiction says about it, with sources at the honesty level above.
- `design`: how the numbers were derived: which anchor, what scaling, which GURPS design rule.
- `tags`: GCS category tags plus the faction (e.g., `Imperium`, `Astra Militarum`).
- Weight in lb, TL, LC, cost.

## Changing an anchor

Anchors will be wrong in places. To change one: edit this file, log the change and reason in `docs/changelog.md`, and update every entry built from it in the same commit.
