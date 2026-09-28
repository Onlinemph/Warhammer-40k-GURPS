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

| Armour | Torso DR | Notes |
|---|---|---|
| Unarmoured | 0 | |
| Flak (vest/jacket) | 8 | Stops shrapnel and pistol-calibre stub rounds. Lasgun and autogun hits usually get through; bolts always do. Flak helmet DR 6. |
| Mesh | 10, flexible | Hive-noble and assassin wear. Flexible: blunt trauma applies. |
| Carapace | 20 | Rigid plate. Usually stops a lasgun; a bolter or hot-shot las goes through. |
| Adepta Sororitas power armour | 32 | Lighter than Astartes plate. |
| Astartes power armour (Mk VII baseline) | 40 | Shrugs off las, stub, most small-arms bolts. Eye lenses DR 20. Marks vary ±5 around this. |
| Tactical Dreadnought (Terminator) | 80 | Ignores bolters. Plasma, lascannon, power fist and thunder hammer still kill. |

Limbs are usually a few DR below torso. Specify every location explicitly.

### Weapon anchors

| Weapon | Damage | What it has to do |
|---|---|---|
| Laspistol | 3d burn | Kills an unarmoured man in 1–2 hits. |
| Autogun | 4d+1 pi | Lasgun parity: the two are equally lethal in fiction and Only War. |
| Lasgun | 4d burn | Punches flak; rarely penetrates carapace (4d max 24 vs DR 20). |
| Long-las | 5d burn | Sniper. |
| Hellgun / hot-shot | 5d(2) burn | Built to beat carapace. |
| Boltgun (Godwyn/standard) | 6d(2) pi+, follow-up 3d cr ex | Turns an unarmoured man to paste. Penetrates carapace easily. Against power armour (effective DR 20), penetrates sometimes: a Marine takes several bolts to kill another Marine. |
| Heavy bolter | 8d(2) pi+, follow-up 4d cr ex | Chews light vehicles (AV10 ≈ DR 50). |
| Plasma gun | 6d×2(3) burn ex | Kills Marines through power armour. Overheat risk (see Malfunction). |
| Meltagun | 8d×3(10) burn to ½D; beyond ½D 4d×3(5) | Vehicle-killer at short range. |
| Lascannon | 8d×4(5) burn | Kills tanks and Terminators. |
| Chainsword | sw+1d cut | Tears flesh, skids off power armour. |
| Power sword | sw+1d+1(10) cut | The disruption field shears ceramite whoever holds it. |

**Power-field rule.** Every disruption-field weapon (power sword, axe, maul, lance, fist, chainfist, thunder hammer, lightning claw) has armour divisor (10) with the field on, and a second weapon line for field-off at the mundane baseline. Bladed/mace power weapons add +1d over the mundane weapon; thunder hammers +2d; power fists thr+4d.

Follow-up damage (B414): the follow-up applies only when the penetrator gets through DR. In GCS, add the follow-up as a second weapon line with usage like "Follow-up (if bolt penetrates)".

Anything in the same family scales from the nearest anchor (bolt pistol from boltgun, plasma pistol from plasma gun) and explains the step in `design`.

### Vehicle armour

Wargame armour values give only relative order. Map them to DR when a weapon needs to be checked against a vehicle:

| AV | DR | Typical |
|---|---|---|
| 10 | 50 | Rear armour, Sentinel, Chimera sides |
| 11 | 80 | Rhino front/sides |
| 12 | 120 | Chimera front |
| 13 | 180 | Leman Russ sides |
| 14 | 250 | Leman Russ front, Land Raider |

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
| Astartes | 550–800 | Battle-Brother, veteran, Primaris adds more |
| Heroes and legends | 1,000–3,000 | Chapter Master, Custodian, Living Saint, Lord Inquisitor |
| Beyond play | 5,000+ | Primarchs, Greater Daemons, C'tan shards. Built for GM reference only. |

Equipment is not included in these totals.

### Astartes physiology

The nineteen gene-seed organs each become a trait (or several) inside an **Astartes** racial meta-trait, so a GM can remove or alter one for a Chapter's gene-seed (the Imperial Fists line lacks the Betcher's gland and Sus-an membrane; the Blood Angels carry the Red Thirst). Target physique: ~2.1–2.4 m unarmoured, heavily muscled, ST around 18–20, HT 14+, faster reflexes than baseline humans, fused ribcage, no need to sleep for weeks. Stay at SM 0 unarmoured; a Terminator can be SM +1.

## Psykers and the warp

Psychic abilities use the *Powers* framework with a **Warp** power modifier. The modifier covers:

- Can be blocked by pariahs/blanks (Null), null rods, hexagrammic and psychic wards.
- Detectable by other psykers, daemons, and the Astronomican-attuned.
- **Perils of the Warp:** every use risks warp backlash. Model it as a limitation, not free flavour, and scale the risk by how hard the psyker pushes.

Psychic abilities are grouped into disciplines (Biomancy, Divination, Pyromancy, Telekinesis, Telepathy, plus faction lists) as Talent-linked power groups. Assignment grades (Alpha–Iota) are used as a reference for how strong a psyker may be.

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
