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
| Flak (vest/jacket) | 30 | User's figure. Stops shrapnel, pistol rounds and most solid slugs (autogun 9%). Lasgun hits get through (98%); bolts always do. Flak helmet DR 25. |
| Mesh | 36, flexible | Hive-noble and assassin wear. Flexible: blunt trauma applies. |
| Carapace | 70 | User's figure. Rigid plate, near-immune to las (lasgun 0.6%, long-las 6%); a hellgun (82%) or bolter (79%) goes through. |
| Adepta Sororitas power armour | 85 | Raised with carapace so power armour stays above it; lighter than Astartes plate. A bolter penetrates 45%. |
| Astartes power armour (Mk VII baseline) | 100 | Ignores las and stub fire. A bolter penetrates about one shot in seven. Limbs a little lower. Eye lenses DR 40. Marks vary ±10–15 around this. |
| Mk X Gravis | 130 | Between power armour and Terminator plate. |
| Tactical Dreadnought (Terminator) | 200 | Ignores bolters. Plasma, lascannon, power fist and thunder hammer still kill. |

Limbs are usually a few DR below torso. Specify every location explicitly.

### Weak points and eye lenses

Massed fire brings down heavily armoured targets in the fiction, so armour has gaps.

**Weak Points.** Every armour piece has a Weak Points rating (3–9, a 3d target). When a hit on that armour fails to penetrate, roll 3d: on the rating or less the hit found a joint, seal or vision slit, and DR is halved against it (as for chinks in armour, B400, but by chance rather than aim). Recompute penetration with the halved DR.

| Armour | Weak Points | Lasgun hit penetrates (per hit) | 30 lasgun hits, chance of at least one |
|---|---|---|---|
| Flak | 7 | (always penetrates anyway) | |
| Carapace, Guard pattern | 5 | 4.9% | 78% |
| Carapace, Tempestus/Arbites/Vratine | 4 | 2.3% | 51% |
| Sororitas power armour | 5 | | |
| Astartes Mk VII | 4 | 0.8% | 21% |
| Terminator, Auramite, Allarus | 3 | 0 (bolter vs Terminator 0.07%) | |

**Eye lenses.** Helmet eye lenses and visors have much lower DR than the rest of the helmet: carapace visors 20, Sororitas 30, Astartes 40, Terminator and Auramite 60, Allarus 70. A hit through an eye counts as a brain hit for piercing, impaling and tight-beam burning (las) damage (B399). House rule: when a random hit location comes up face, roll 1d; on a 1 the hit struck an eye lens instead (about 0.5% of random hits). A lasgun that finds an Astartes lens penetrates 81% of the time.

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
| Laspistol | 4d(2) burn | Kills an unarmoured man in 1–2 hits. |
| Autogun | 7d pi | Equal to a lasgun against flesh; flak (DR 30) stops most slugs (9% get through), carapace all of them. |
| Lasgun | 7d(2) burn | User's figure. Punches flak (98%); almost never carapace (0.6%). Useless against power armour. |
| Long-las | 8d(2) burn | Sniper. |
| Hellgun / hot-shot | 8d(3) burn | Built to beat carapace (eff. DR 23): 82%. |
| Boltgun (Godwyn/standard) | 6d×2(2) pi++, follow-up 6d cr ex | Turns an unarmoured man to paste; always penetrates carapace. Against Astartes power armour (eff. DR 50) penetrates about one shot in seven (14%): a Marine takes several bolts to kill another Marine. |
| Human-scale boltgun / bolt pistol | 6d×2(2) pi, follow-up 3d cr ex / 5d×2(2) pi, follow-up 2d cr ex | Sororitas, Inquisition and Commissar pattern: smaller bolts with a lighter mass-reactive charge (user direction). |
| Heavy bolter | 7d×2(2) pi++, follow-up 8d cr ex | Chews light vehicles (AV10, eff. DR 50) about 40% of the time. |
| Plasma gun | 6d×4(3) burn ex | Kills Marines through power armour (eff. DR 33); penetrates Terminators (eff. DR 67) more often than not. Overheat risk. |
| Meltagun | 8d×6(10) burn to ½D; beyond ½D 4d×6(3) | Kills AV14 (eff. DR 35) at short range; past ½D still wrecks AV12 (76%), almost never beats AV14 (5%). |
| Lascannon | 8d×8(5) burn | Kills tanks (AV14 eff. DR 70) and Terminators. |
| Krak missile | 6d×6(3) cr | Reliable vs AV12–13 (90%); about two in three vs AV14. |
| Chainsword | sw+2d(2) cut | Tears flesh and flak; bites carapace; skids off power armour. |
| Power sword | sw+3d+1(10) cut | The disruption field shears power armour whoever holds it. |
| Power fist | thr+8d(10) cr | Kills Terminators in Astartes hands. |
| Thunder hammer | sw+6d(10) cr | The Terminator-killer; knockback. |

**Power-field rule.** Every disruption-field weapon (power sword, axe, maul, lance, fist, chainfist, thunder hammer, lightning claw) has armour divisor (10) with the field on, and a second weapon line for field-off at the mundane baseline. Bladed/mace power weapons add +3d over the mundane weapon; thunder hammers +6d; power fists thr+8d.

Follow-up damage (B414): the follow-up applies only when the penetrator gets through DR. In GCS, add the follow-up as a second weapon line with usage like "Follow-up (if bolt penetrates)".

Anything in the same family scales from the nearest anchor (bolt pistol from boltgun, plasma pistol from plasma gun) and explains the step in `design`.

### Weapon handling stats

Damage anchors aren't enough on their own: Acc, RoF, Shots, ST, Bulk, Recoil and weight must each be derived for the specific weapon, never copied from a neighbour. Every weapon's `design` field says where each came from.

**Weight** comes from the lore first (Black Library descriptions, FFG/C7 weights) and is the loaded weight in lb. Astartes-pattern weapons are built for ST 30 hands and are far heavier than human versions: an Astartes Godwyn boltgun is about 35–40 lb loaded (Deathwatch lists 18 kg), a human-scale boltgun roughly half that.

**Minimum ST** follows GURPS practice for shoulder arms, about √(10 × loaded weight in lb), rounded, then adjusted for recoil and balance. That gives about ST 9 for an 8 lb rifle and about ST 19 for a 36 lb Astartes boltgun (a Guardsman can lift it but fires it at a heavy penalty; a Marine at ST 30 exceeds 1.5 × 19 and so can fire it one-handed, as the fiction shows). Use † for two-handed weapons, B for bipod-mounted and M for mounted, per the Basic Set.

**RoF** reflects the actual mechanism:
- 1: single-shot, bolt/lever/pump action, anything that must recharge, vent or cool between shots (plasma, melta, lascannon, long-las, missile and grenade launchers).
- 3: semi-automatic weapons fired as fast as the trigger allows (most pistols, semi-auto rifles), per GURPS convention. Use only when the weapon really is semi-automatic.
- Automatic weapons use their cyclic rate in GURPS terms: lasguns and autoguns on auto around 10–12; bolters fire slower, heavier rounds (boltgun 3 semi or burst, storm bolter 3×2 or 6, heavy bolter around 8); heavy stubbers and assault cannons high (15–20+); multi-lasers are rapid emitters (8–10).

**Shots** come from the lore magazine or charge-pack capacity; (N) is reload time in seconds.

**Bulk** comes from length and handiness: holdout pistols −1, pistols −2, carbines −3, rifles −4 to −5, heavy/support −6 to −8, Astartes-pattern weapons one step bulkier than human ones of the same type.

**Recoil** comes from momentum: beams 1; pistols 2–3; rifles 2–3; bolters 3–4 (the rocket boosts after launch, but the initial charge still kicks); heavy stubbers and autocannon 3–4; anything braced or mounted uses the mounted value.

**Acc**: pistols 1–3, carbines 3–4, rifles 4–5, sniper and scoped weapons +1 to +3 for the optic, beam weapons about +2 over a slug-thrower of the same size (no drop, no recoil).

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

The nineteen gene-seed organs each become a trait (or several) inside an **Astartes** racial meta-trait, so a GM can remove or alter one for a Chapter's gene-seed (the Imperial Fists line lacks the Betcher's gland and Sus-an membrane; the Blood Angels carry the Red Thirst). Target physique: ~2.1–2.4 m unarmoured, heavily muscled, ST 30 (HP 34), DX 16 (package +5, plus training), Basic Move +4 (Move 12) and Enhanced Move (Ground) 1/2, HT 14+, faster reflexes than baseline humans, fused ribcage, no need to sleep for weeks. Stay at SM 0 unarmoured; a Terminator can be SM +1.

### Adeptus Custodes physiology

Each Custodian is individually gene-wrought from infancy, not built from gene-seed organs, and outclasses a Space Marine as far as a Marine outclasses a Guardsman. Targets: roughly 2.5–3 m tall, SM +1 unarmoured; ST 40 (with the SM +1 cost reduction), DX 20 (package 19 plus training), Basic Move +4, Enhanced Move (Ground) 1, IQ 13, HT 16, Will 16, HP about 50, Basic Speed well above an Astartes; needs almost no sleep or food; immune to fear; lives for millennia. A Custodian Guardian template lands around 1,200–1,600 points without gear.

Custodes armour and arms:

| Item | Anchor |
|---|---|
| Auramite power armour (Aquilon pattern) | Torso DR 150 |
| Allarus Terminator armour | Torso DR 250 |
| Custodes power weapons | Field-on = mundane baseline +4d, divisor (10): one step above Astartes power weapons, reflecting master-crafted Custodian arms |
| Bolt casters on Custodes weapons (guardian spear, sentinel blade) | Boltgun anchor, 6d×2(2) pi++ with 6d cr ex follow-up |

Sisters of Silence are unaugmented human Pariahs (see the Pariah Gene traits) in Vratine armour, which is carapace-class.

### Adeptus Mechanicus

Tech-Priests and Skitarii are humans rebuilt with augmetics. Model augmetics as traits (GURPS cybernetic advantages built from Basic Set abilities), one per implant, so a character sheet lists what has been replaced. Mechadendrites are Extra Arms with appropriate limitations; the Noosphere and binharic cant are Telecommunication and a Language; the Cult Mechanicus is Theology (Cult Mechanicus) plus faith disadvantages.

Mechanicus weapons are older and stranger than Astra Militarum ones. Scale each from the nearest anchor and state the step:

| Weapon | Anchor |
|---|---|
| Galvanic rifle | 8d(2) pi+: long-las dice with pi+ wounding, long range, high Acc |
| Radium carbine | Lasgun-class 7d(2) pi plus a radiation follow-up that ignores DR on unsealed targets |
| Arc rifle / arc pistol | Weak against flesh, strong against machines: extra effect vs vehicles, cyborgs and powered armour systems (surge) |
| Phosphor blaster | Burn damage that ignores concealment and marks the target |
| Plasma caliver | Plasma gun anchor, higher RoF, same overheat risk |
| Transuranic arquebus | Heavy sniper: beats Astartes armour (DR 100) reliably at long range |
| Volkite weapons | Burn ex that chains to nearby targets on a kill; volkite blaster sits between heavy bolter and plasma |
| Eradication ray | Melta-like, short range, disintegrating |

## Xenos

### Orks

Orks are fungal-based greenskins who grow bigger, stronger and tougher the longer they live and the more they fight, and whose technology works partly because they believe it will. Anchors, relative to an Astartes Battle-Brother (ST 30, DX 16, HT 15, HP 34):

| Ork | ST | DX | IQ | HT | HP | SM | Notes |
|---|---|---|---|---|---|---|---|
| Gretchin | 8 | 11 | 9 | 10 | 8 | −1 | Cowardly, sneaky, expendable. |
| Boy | 22 | 11 | 8 | 13 | 26 | 0 | Stooped but heavy; brawnier than a man, far clumsier than a Marine. |
| Nob | 26 | 11 | 9 | 14 | 32 | 0 (+1 for big ones) | A Boy who survived long enough to grow. |
| Warboss | 32 | 12 | 10 | 15 | 40 | +1 | Out-muscles a Space Marine; sheer bulk. |

Ork physiology traits: very high pain tolerance, Hard to Kill, fast healing and survivability of wounds that kill other species (heads sewn back on by Painboyz), love of violence (Bloodlust, Impulsiveness), growth with age as template lenses. Orks reproduce by spores, have no fear to speak of, and the Weirdboy's psychic power is fed by nearby Orks' WAAAGH! energy.

**Ork tech.** Mekboyz build by instinct (a genetic Talent for Engineer/Mechanic/Armoury). Ork weapons are crude and unreliable: Malf 14 for most, 15 at best, and low Acc (shootas Acc 1–2). They compensate with big calibres and high RoF (dakka). Ork armour is thick scrap plate with many gaps: high Weak Points ratings (7–8).

| Ork gear | Anchor |
|---|---|
| Slugga | Big-bore pistol, about 5d pi+, Acc 1 |
| Shoota | Heavy slugs, about 7d pi+, RoF 10, Acc 1–2, Malf 14 |
| Big shoota | Heavy stubber class and up, about 9d pi+, RoF 15+ |
| Rokkit launcha | Anti-armour, about 6d×4(3) cr ex, Acc 0–1, Malf 14 |
| Choppa | Crude cleaver, sw+3 cut, parry −1U |
| Power klaw | Power-field weapon: thr+8d(10) cr, like a power fist but cruder |
| 'Eavy armour | Torso DR 45, Weak Points 7 |
| Mega armour | Torso DR 150, Weak Points 6: an Ork answer to Terminator plate |

### Aeldari

The Aeldari are an ancient, dying race: slender, long-lived, emotionally intense, and all latently psychic. Craftworld Aeldari follow the Paths, devoting centuries to one discipline at a time. Their souls are hunted by Slaanesh; a spirit stone worn on the breast catches the soul at death. Anchors, relative to humans (DX 10–12) and Astartes (DX 16):

| Aeldari | ST | DX | IQ | HT | HP | Per | Will | Notes |
|---|---|---|---|---|---|---|---|---|
| Guardian (citizen militia) | 10 | 14 | 12 | 10 | 10 | 13 | 12 | Faster and more precise than any human; fragile. |
| Aspect Warrior | 11 | 16 | 12 | 11 | 11 | 13 | 13 | Matches a Marine's DX through centuries on one Path. |
| Exarch | 12 | 18 | 13 | 12 | 12 | 14 | 15 | Lost forever to the Path of the Warrior. |
| Farseer | 10 | 14 | 15 | 10 | 10 | 15 | 17 | Psyker of the highest grade. |

Aeldari traits: superior reflexes (Basic Speed bonus, Enhanced Dodge for Aspect Warriors), acute senses, Extended Lifespan (millennia), Psyker talent latent in all (Warlocks and Farseers developed), Slaanesh's hunger (a disadvantage: a daemon-god waits for the soul; spirit stones shield it), emotional intensity (Path discipline keeps it in check), arrogance towards younger races.

Aeldari psychic powers use the same Sorcery model as Imperial psykers, but the Aeldari's runes and training make them far safer: their Perils limitation is milder than a human's (their runic discipline is Perils of the Warp with rune-warding reducing the risk), and Farseers reach the top Warp Empowerment grades.

| Aeldari gear | Anchor |
|---|---|
| Shuriken catapult | Monomolecular discs: 5d(3) cut, RoF 10, short range (about 12/60 yd ½D/Max). Shreds flesh and flak; bites carapace sometimes; can't hurt power armour except on a Weak Point. |
| Avenger shuriken catapult | 5d(3) cut, longer range, higher RoF |
| Shuriken cannon | 7d(3) cut, RoF 15 |
| Lasblaster | 7d(2) burn, rapid |
| Fusion gun | Melta class (meltagun anchor) |
| Starcannon | Plasma class (plasma gun anchor) with no overheating |
| Bright lance | Anti-armour lance: its focused beam penetrates any armour to the same depth, so give it a high armour divisor (10) and moderate damage: about 6d×4(10) burn |
| Wraithcannon | D-weapon: tears the target into the warp. Build as an honest special effect with extreme damage, short range |
| Guardian mesh armour | Flexible, DR 36 (the mesh anchor), Weak Points 5 |
| Aspect armour | Flexible thermoplas plates, DR 70, Weak Points 4 |
| Exarch armour | DR 85, Weak Points 4 |
| Rune armour | Psychic ward: regenerating shield (see Personal force fields), pool scaling with the wearer's Warp Empowerment |
| Holo-suit / domino field | Harlequins: large defence bonus from scattering the wearer's image, not DR |

### Necrons

Necrons are ancient souls transferred into bodies of living metal (necrodermis) during the biotransference, then left to sleep for sixty million years. Most rank-and-file Necrons lost their minds in the process; nobles kept their personalities. Their armour is their body: necrodermis is natural DR in the ancestry, not equipment. Anchors:

| Necron | ST | DX | IQ | HT | HP | Natural DR (torso) | Mind |
|---|---|---|---|---|---|---|---|
| Warrior | 18 | 10 | 6 | 14 | 24 | 50 | Mindless automaton (Slave Mentality, Reprogrammable-style obedience) |
| Immortal | 20 | 11 | 8 | 15 | 28 | 80 | Dim but capable of tactical thought |
| Deathmark | 18 | 13 | 9 | 14 | 24 | 60 | Hunter; minimal personality |
| Lychguard | 22 | 12 | 9 | 15 | 30 | 90 | Honour-bound bodyguard, some awareness |
| Flayed One | 18 | 12 | 6 | 14 | 24 | 50 | Cursed by the flayer virus: madness and bloodlust |
| Lord / Overlord | 22–25 | 13 | 14 | 15 | 32–36 | 100 | Full personality, often eccentric |
| Cryptek | 18 | 12 | 16 | 14 | 24 | 60 | Technosorcerer, genius |

Necron traits: Machine body (no need to breathe, eat or sleep; immune to disease, poison and pain-based effects), Injury Tolerance (Unliving: no blood, no vitals), living metal self-repair (Regeneration), and **Reanimation Protocols**: a Necron reduced below −1×HP is not destroyed unless the damage exceeds −5×HP; roll HT at the end of each of the next few turns to rise again with some HP restored, and on failure it phases out (teleports home to its tomb). Necrons are soulless: immune to psychic mind control and possession, and largely beneath daemons' notice. Weak Points on necrodermis are low (joints and eye-slits: Warriors 4, nobles and Lychguard 3), and glowing optics have eye DR about half the torso.

| Necron gear | Anchor |
|---|---|
| Gauss flayer | Molecular disassembly beam: 6d(3) burn, RoF 2 (rapid fire), strips flak and carapace, only occasionally hurts power armour |
| Gauss blaster | 7d(3) burn, RoF 3 |
| Tesla carbine | 6d(2) burn with arcs that jump to nearby targets on a hit (like volkite chains) |
| Synaptic disintegrator | Sniper, 8d(3) burn, very high Acc |
| Gauss cannon | 6d×2(3) burn |
| Heavy gauss cannon | Anti-armour: 6d×4(5) burn |
| Particle beamer / caster | Particle weapons: burn ex, scale from plasma |
| Warscythe | Two-handed power-field blade: sw+4d(10) cut |
| Hyperphase sword | Phase blade: sw+3d(10) cut |
| Voidblade | Entropic blade that ignores armour: sw+2d (ignores DR) cut, but only for a limited number of charged strikes |
| Staff of light | Energy staff: ranged 6d(3) burn and a power-field melee strike |

C'tan Shards are beyond play and GM-reference only.

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
