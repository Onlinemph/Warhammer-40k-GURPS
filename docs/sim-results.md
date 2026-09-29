# Combat simulator results

Reference fights run with `tools/sim.js` (the 2D hex engine; rules in docs/simulator.md) against the current data: 300 battles each, morale on, a 1,200-second limit, default loadouts from `data/sim/loadouts.yaml`, no cover. Side A is listed first. "up" is models still fighting at the end; "dead" counts models killed outright (the rest fell unconscious, broke, collapsed or phased out). "timeout" is a fight still going at the limit; "mutual" is both sides destroyed or broken on the same turn.

## Standard GURPS HP, elites aim (default)

Only elites (best combat skill 17+, IQ 8+) call shots, including Chinks in Armor (B400); everyone else hits random locations. Psychic powers are at lore damage and the Zoanthrope's Warp Field is 200 SP; the last eleven rows are three Ork mob charges and eight psyker fights. Grappling, Wait, suppression fire, grenades, Slam, Shove, two-weapon attacks and Feverish Defense are on. The "everyone aims" and random tables below predate the power rescale, chinks and the latest AI changes. Decisions come from the value-based decision layer with faction personalities (docs/simulator.md, data/sim/ai.yaml).

| Fight | Result | Length | Side A | Side B |
|---|---|---|---|---|
| 10 Astra Militarum Guardsman vs 10 Ork Boy @15yd | A 96% B 3% timeout 0% mutual 1% | 7s | 7.8/10 up, 0.6 dead | 0.1/10 up, 2.7 dead |
| 20 Astra Militarum Guardsman vs 20 Ork Boy @40yd | A 94% B 6% timeout 0% mutual 1% | 12s | 15.2/20 up, 1.3 dead | 0.3/20 up, 4.3 dead |
| 10 Ork Boy vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 7s | 0.0/10 up, 1.8 dead | 5.0/5 up, 0.0 dead |
| 5 Ork Nob vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 12s | 0.0/5 up, 1.0 dead | 5.0/5 up, 0.0 dead |
| 1 Ork Warboss vs 3 Astartes Battle-Brother @10yd | A 1% B 99% timeout 0% mutual 0% | 6s | 0.0/1 up, 0.4 dead | 2.7/3 up, 0.1 dead |
| 3 Ork Meganob vs 5 Astartes Battle-Brother @15yd | A 2% B 98% timeout 0% mutual 0% | 12s | 0.0/3 up, 0.5 dead | 4.3/5 up, 0.1 dead |
| 5 Genestealer vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/5 up, 3.0 dead | 4.7/5 up, 0.0 dead |
| 10 Genestealer vs 20 Astra Militarum Guardsman @30yd | A 100% B 0% timeout 0% mutual 0% | 6s | 8.7/10 up, 0.1 dead | 0.0/20 up, 8.6 dead |
| 20 Hormagaunt vs 10 Astra Militarum Guardsman @20yd | A 5% B 93% timeout 0% mutual 2% | 5s | 0.4/20 up, 6.8 dead | 8.0/10 up, 0.4 dead |
| 1 Carnifex vs 5 Astartes Battle-Brother @10yd | A 100% B 0% timeout 0% mutual 0% | 176s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.3 dead |
| 1 Hive Tyrant vs 5 Astartes Battle-Brother @30yd | A 100% B 0% timeout 0% mutual 0% | 198s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.2 dead |
| 3 Tyranid Warrior vs 5 Astartes Battle-Brother @30yd | A 0% B 100% timeout 0% mutual 0% | 8s | 0.0/3 up, 1.7 dead | 5.0/5 up, 0.0 dead |
| 5 Astartes Battle-Brother vs 10 Necron Warrior @60yd | A 96% B 4% timeout 0% mutual 0% | 87s | 3.6/5 up, 0.0 dead | 0.1/10 up, 0.2 dead |
| 5 Necron Immortal vs 5 Astartes Battle-Brother @60yd | A 97% B 3% timeout 0% mutual 0% | 79s | 3.4/5 up, 0.0 dead | 0.1/5 up, 0.3 dead |
| 5 Lychguard vs 5 Astartes Battle-Brother @10yd | A 99% B 1% timeout 0% mutual 0% | 18s | 4.0/5 up, 0.0 dead | 0.0/5 up, 1.1 dead |
| 10 Flayed One vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% timeout 0% mutual 0% | 10s | 8.8/10 up, 0.0 dead | 0.0/10 up, 2.1 dead |
| 3 Skorpekh Destroyer vs 5 Astartes Battle-Brother @15yd | A 87% B 13% timeout 0% mutual 0% | 51s | 1.9/3 up, 0.0 dead | 0.5/5 up, 0.5 dead |
| 5 Aspect Warrior vs 10 Ork Boy @15yd | A 76% B 23% timeout 0% mutual 1% | 15s | 2.8/5 up, 0.3 dead | 1.2/10 up, 0.6 dead |
| 1 Exarch vs 2 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 6s | 0.0/1 up, 0.9 dead | 2.0/2 up, 0.0 dead |
| 10 Aeldari Guardian vs 10 Astra Militarum Guardsman @50yd | A 95% B 3% timeout 0% mutual 2% | 6s | 6.7/10 up, 1.4 dead | 0.1/10 up, 3.6 dead |
| 10 Wych vs 10 Ork Boy @15yd | A 15% B 83% timeout 0% mutual 2% | 8s | 0.5/10 up, 4.4 dead | 5.7/10 up, 0.3 dead |
| 5 Incubus vs 5 Astartes Battle-Brother @10yd | A 3% B 97% timeout 0% mutual 0% | 6s | 0.1/5 up, 4.0 dead | 4.0/5 up, 0.6 dead |
| 10 Kabalite Warrior vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% timeout 0% mutual 0% | 6s | 0.0/10 up, 7.5 dead | 9.3/10 up, 0.1 dead |
| 10 Fire Warrior (Shas'la) vs 5 Astartes Battle-Brother @150yd | A 47% B 53% timeout 0% mutual 0% | 28s | 2.5/10 up, 2.7 dead | 1.9/5 up, 0.0 dead |
| 3 Battlesuit Pilot (Shas'vre) vs 20 Ork Boy @60yd | A 100% B 0% timeout 0% mutual 0% | 13s | 3.0/3 up, 0.0 dead | 0.0/20 up, 7.1 dead |
| 10 Kroot Carnivore vs 10 Astra Militarum Guardsman @30yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/10 up, 4.8 dead | 9.3/10 up, 0.4 dead |
| 3 Custodian Guardian vs 10 Astartes Battle-Brother @20yd | A 35% B 65% timeout 0% mutual 0% | 25s | 0.7/3 up, 1.9 dead | 3.7/10 up, 3.4 dead |
| 5 Sister of Silence vs 10 Astra Militarum Guardsman @20yd | A 16% B 83% timeout 0% mutual 1% | 10s | 0.4/5 up, 0.8 dead | 6.0/10 up, 1.3 dead |
| 10 Adepta Sororitas Battle Sister vs 15 Ork Boy @30yd | A 100% B 0% timeout 0% mutual 0% | 10s | 9.8/10 up, 0.0 dead | 0.0/15 up, 5.9 dead |
| 10 Militarum Tempestus Scion vs 3 Astartes Battle-Brother @60yd | A 100% B 0% timeout 0% mutual 0% | 9s | 8.9/10 up, 0.4 dead | 0.0/3 up, 1.1 dead |
| 5 Primaris Battle-Brother vs 5 Astartes Battle-Brother @60yd | A 71% B 29% timeout 0% mutual 0% | 123s | 2.1/5 up, 0.3 dead | 0.7/5 up, 0.2 dead |
| 5 Sicarian Ruststalker vs 10 Astra Militarum Guardsman @15yd | A 0% B 99% timeout 0% mutual 0% | 6s | 0.0/5 up, 0.8 dead | 8.6/10 up, 0.5 dead |
| 10 Skitarii Ranger vs 10 Aeldari Guardian @100yd | A 100% B 0% timeout 0% mutual 0% | 9s | 10.0/10 up, 0.0 dead | 0.0/10 up, 6.9 dead |
| 50 Ork Boy vs 5 Astartes Battle-Brother @30yd | A 2% B 98% timeout 0% mutual 0% | 22s | 0.4/50 up, 4.4 dead | 4.8/5 up, 0.0 dead |
| 30 Ork Boy vs 5 Astartes Battle-Brother @30yd | A 1% B 99% timeout 0% mutual 0% | 21s | 0.1/30 up, 4.3 dead | 4.9/5 up, 0.0 dead |
| 20 Ork Boy vs 5 Astartes Battle-Brother @30yd | A 0% B 100% timeout 0% mutual 0% | 19s | 0.0/20 up, 4.2 dead | 5.0/5 up, 0.0 dead |
| 1 Sanctioned Psyker vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.7 dead | 5.0/5 up, 0.0 dead |
| 1 Sanctioned Psyker vs 1 Astartes Battle-Brother @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.8 dead | 1.0/1 up, 0.0 dead |
| 1 Warlock vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.6 dead | 5.0/5 up, 0.0 dead |
| 1 Farseer vs 3 Astartes Battle-Brother @20yd | A 0% B 100% timeout 0% mutual 0% | 3s | 0.0/1 up, 0.9 dead | 3.0/3 up, 0.0 dead |
| 1 Ork Weirdboy vs 1 Astartes Battle-Brother @20yd | A 0% B 100% timeout 0% mutual 0% | 5s | 0.0/1 up, 0.2 dead | 1.0/1 up, 0.0 dead |
| 1 Zoanthrope vs 3 Astartes Battle-Brother @60yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/1 up, 0.6 dead | 3.0/3 up, 0.0 dead |
| 1 Zoanthrope vs 1 Carnifex @40yd | A 0% B 100% timeout 0% mutual 0% | 38s | 0.0/1 up, 0.2 dead | 1.0/1 up, 0.0 dead |
| 1 Farseer vs 3 Sister of Silence @20yd | A 92% B 8% timeout 0% mutual 0% | 8s | 0.9/1 up, 0.1 dead | 0.2/3 up, 2.3 dead |
| 10 Astra Militarum Guardsman vs 10 Kabalite Warrior @100yd | A 54% B 44% timeout 0% mutual 2% | 14s | 2.8/10 up, 3.4 dead | 2.1/10 up, 2.5 dead |
| 10 Astra Militarum Guardsman vs 10 Fire Warrior (Shas'la) @150yd | A 0% B 100% timeout 0% mutual 0% | 7s | 0.0/10 up, 6.3 dead | 9.5/10 up, 0.1 dead |
| 10 Astra Militarum Guardsman vs 10 Skitarii Ranger @100yd | A 0% B 100% timeout 0% mutual 0% | 9s | 0.0/10 up, 5.3 dead | 9.6/10 up, 0.1 dead |
| 30 Astra Militarum Guardsman vs 5 Genestealer @30yd | A 100% B 0% timeout 0% mutual 0% | 8s | 24.1/30 up, 3.1 dead | 0.0/5 up, 1.7 dead |
| 20 Astra Militarum Guardsman vs 20 Termagant @60yd | A 100% B 0% timeout 0% mutual 0% | 11s | 19.9/20 up, 0.0 dead | 0.0/20 up, 7.6 dead |
| 10 Astra Militarum Guardsman vs 10 Necron Warrior @60yd | A 0% B 100% timeout 0% mutual 0% | 21s | 0.0/10 up, 2.4 dead | 8.6/10 up, 0.0 dead |
| 1 Commissar vs 3 Ork Boy @10yd | A 4% B 96% timeout 0% mutual 0% | 4s | 0.0/1 up, 0.3 dead | 2.5/3 up, 0.0 dead |
| 1 Inquisitor vs 2 Genestealer @10yd | A 35% B 65% timeout 0% mutual 1% | 4s | 0.3/1 up, 0.4 dead | 1.2/2 up, 0.3 dead |
| 5 Adepta Sororitas Battle Sister vs 10 Wych @20yd | A 98% B 2% timeout 0% mutual 0% | 7s | 4.4/5 up, 0.1 dead | 0.1/10 up, 6.7 dead |
| 10 Militarum Tempestus Scion vs 10 Kabalite Warrior @80yd | A 100% B 0% timeout 0% mutual 0% | 3s | 10.0/10 up, 0.0 dead | 0.0/10 up, 8.1 dead |
| 5 Astartes Scout vs 10 Kroot Carnivore @80yd | A 0% B 100% timeout 0% mutual 0% | 14s | 0.0/5 up, 0.0 dead | 8.8/10 up, 0.6 dead |
| 5 Astartes Battle-Brother vs 5 Aspect Warrior @40yd | A 100% B 0% timeout 0% mutual 0% | 8s | 5.0/5 up, 0.0 dead | 0.0/5 up, 3.5 dead |
| 5 Astartes Battle-Brother vs 5 Incubus @30yd | A 98% B 2% timeout 0% mutual 0% | 7s | 4.2/5 up, 0.5 dead | 0.0/5 up, 3.9 dead |
| 5 Astartes Battle-Brother vs 10 Flayed One @30yd | A 97% B 3% timeout 0% mutual 0% | 35s | 4.0/5 up, 0.1 dead | 0.1/10 up, 1.6 dead |
| 1 Shield-Captain vs 1 Necron Overlord @10yd | A 99% B 1% timeout 0% mutual 0% | 14s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.4 dead |
| 1 Custodian Guardian vs 3 Lychguard @10yd | A 100% B 0% timeout 0% mutual 0% | 14s | 1.0/1 up, 0.0 dead | 0.0/3 up, 1.4 dead |
| 5 Sister of Silence vs 5 Aspect Warrior @15yd | A 67% B 32% timeout 0% mutual 0% | 7s | 1.9/5 up, 1.5 dead | 1.0/5 up, 1.9 dead |
| 10 Skitarii Vanguard vs 15 Ork Boy @40yd | A 100% B 0% timeout 0% mutual 0% | 12s | 9.8/10 up, 0.0 dead | 0.0/15 up, 5.3 dead |
| 10 Electro-Priest vs 10 Ork Boy @15yd | A 69% B 31% timeout 0% mutual 0% | 15s | 3.5/10 up, 1.7 dead | 1.5/10 up, 0.4 dead |
| 5 Sicarian Ruststalker vs 5 Wych @15yd | A 21% B 74% timeout 0% mutual 5% | 3s | 0.7/5 up, 0.0 dead | 2.8/5 up, 1.7 dead |
| 5 Ork Nob vs 5 Aspect Warrior @15yd | A 59% B 40% timeout 0% mutual 1% | 16s | 1.7/5 up, 0.2 dead | 1.2/5 up, 0.5 dead |
| 3 Ork Meganob vs 1 Custodian Guardian @15yd | A 0% B 100% timeout 0% mutual 0% | 13s | 0.0/3 up, 0.4 dead | 1.0/1 up, 0.0 dead |
| 1 Ork Warboss vs 1 Tyranid Warrior @10yd | A 100% B 0% timeout 0% mutual 0% | 5s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.4 dead |
| 1 Ork Weirdboy vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 3s | 0.0/1 up, 0.5 dead | 5.0/5 up, 0.0 dead |
| 20 Gretchin vs 5 Astra Militarum Guardsman @40yd | A 0% B 100% timeout 0% mutual 0% | 10s | 0.0/20 up, 9.5 dead | 5.0/5 up, 0.0 dead |
| 1 Lictor vs 5 Astra Militarum Guardsman @10yd | A 100% B 0% timeout 0% mutual 0% | 19s | 1.0/1 up, 0.0 dead | 0.0/5 up, 2.2 dead |
| 3 Ravener vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% timeout 0% mutual 0% | 20s | 3.0/3 up, 0.0 dead | 0.0/10 up, 2.3 dead |
| 1 Zoanthrope vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/1 up, 0.4 dead | 5.0/5 up, 0.0 dead |
| 1 Necron Overlord vs 3 Astartes Battle-Brother @20yd | A 54% B 46% timeout 0% mutual 0% | 50s | 0.5/1 up, 0.0 dead | 1.1/3 up, 0.1 dead |
| 5 Deathmark vs 10 Astra Militarum Guardsman @150yd | A 100% B 0% timeout 0% mutual 0% | 16s | 5.0/5 up, 0.0 dead | 0.0/10 up, 5.9 dead |
| 1 Cryptek vs 5 Ork Boy @20yd | A 29% B 71% timeout 0% mutual 0% | 17s | 0.3/1 up, 0.0 dead | 2.7/5 up, 0.0 dead |
| 1 Autarch vs 3 Ork Nob @15yd | A 67% B 33% timeout 0% mutual 0% | 26s | 0.7/1 up, 0.1 dead | 0.7/3 up, 0.2 dead |
| 1 Farseer vs 5 Astra Militarum Guardsman @20yd | A 5% B 92% timeout 0% mutual 3% | 3s | 0.1/1 up, 0.5 dead | 3.6/5 up, 1.0 dead |
| 5 Aeldari Ranger vs 10 Astra Militarum Guardsman @300yd | A 5% B 94% timeout 0% mutual 0% | 13s | 0.1/5 up, 1.3 dead | 7.4/10 up, 1.1 dead |
| 1 Archon vs 2 Astartes Battle-Brother @15yd | A 46% B 54% timeout 0% mutual 0% | 14s | 0.5/1 up, 0.4 dead | 0.9/2 up, 0.3 dead |
| 1 Succubus vs 2 Ork Nob @10yd | A 3% B 97% timeout 0% mutual 0% | 6s | 0.0/1 up, 0.5 dead | 1.9/2 up, 0.0 dead |
| 5 Mandrake vs 10 Astra Militarum Guardsman @10yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/5 up, 3.4 dead | 9.8/10 up, 0.2 dead |
| 5 Scourge vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/5 up, 4.2 dead | 10.0/10 up, 0.0 dead |
| 1 Commander (Shas'o) vs 3 Astartes Battle-Brother @60yd | A 32% B 68% timeout 0% mutual 0% | 53s | 0.3/1 up, 0.0 dead | 1.8/3 up, 0.1 dead |
| 10 Pathfinder vs 10 Ork Boy @60yd | A 100% B 0% timeout 0% mutual 0% | 7s | 10.0/10 up, 0.0 dead | 0.0/10 up, 4.8 dead |
| 5 Vespid Stingwing vs 3 Astartes Battle-Brother @40yd | A 0% B 100% timeout 0% mutual 0% | 6s | 0.0/5 up, 3.2 dead | 3.0/3 up, 0.0 dead |
| 4 Gun Drone vs 5 Astra Militarum Guardsman @60yd | A 1% B 99% timeout 0% mutual 0% | 10s | 0.0/4 up, 1.9 dead | 4.4/5 up, 0.2 dead |

## Standard GURPS HP, everyone aims (RAW)

| Fight | Result | Length | Side A | Side B |
|---|---|---|---|---|
| 10 Astra Militarum Guardsman vs 10 Ork Boy @15yd | A 100% B 0% timeout 0% mutual 0% | 5s | 8.9/10 up, 0.4 dead | 0.0/10 up, 3.0 dead |
| 20 Astra Militarum Guardsman vs 20 Ork Boy @40yd | A 100% B 0% timeout 0% mutual 0% | 9s | 19.3/20 up, 0.3 dead | 0.0/20 up, 7.4 dead |
| 10 Ork Boy vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 7s | 0.0/10 up, 4.2 dead | 5.0/5 up, 0.0 dead |
| 5 Ork Nob vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 9s | 0.0/5 up, 1.0 dead | 5.0/5 up, 0.0 dead |
| 1 Ork Warboss vs 3 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/1 up, 0.5 dead | 3.0/3 up, 0.0 dead |
| 3 Ork Meganob vs 5 Astartes Battle-Brother @15yd | A 3% B 97% timeout 0% mutual 0% | 12s | 0.0/3 up, 0.6 dead | 4.2/5 up, 0.4 dead |
| 5 Genestealer vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/5 up, 2.9 dead | 5.0/5 up, 0.0 dead |
| 10 Genestealer vs 20 Astra Militarum Guardsman @30yd | A 25% B 73% timeout 0% mutual 2% | 13s | 1.1/10 up, 1.4 dead | 9.3/20 up, 5.3 dead |
| 20 Hormagaunt vs 10 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/20 up, 12.3 dead | 9.8/10 up, 0.0 dead |
| 1 Carnifex vs 5 Astartes Battle-Brother @10yd | A 100% B 0% timeout 0% mutual 0% | 155s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.2 dead |
| 1 Hive Tyrant vs 5 Astartes Battle-Brother @30yd | A 94% B 2% timeout 5% mutual 0% | 652s | 1.0/1 up, 0.0 dead | 0.1/5 up, 0.1 dead |
| 3 Tyranid Warrior vs 5 Astartes Battle-Brother @30yd | A 0% B 100% timeout 0% mutual 0% | 7s | 0.0/3 up, 2.0 dead | 5.0/5 up, 0.0 dead |
| 5 Astartes Battle-Brother vs 10 Necron Warrior @60yd | A 100% B 0% timeout 0% mutual 0% | 74s | 4.8/5 up, 0.0 dead | 0.0/10 up, 0.6 dead |
| 5 Necron Immortal vs 5 Astartes Battle-Brother @60yd | A 0% B 100% timeout 0% mutual 0% | 131s | 0.0/5 up, 0.0 dead | 3.3/5 up, 0.0 dead |
| 5 Lychguard vs 5 Astartes Battle-Brother @10yd | A 99% B 1% timeout 0% mutual 0% | 71s | 4.0/5 up, 0.0 dead | 0.0/5 up, 0.5 dead |
| 10 Flayed One vs 10 Astra Militarum Guardsman @20yd | A 80% B 20% timeout 0% mutual 0% | 24s | 5.2/10 up, 0.0 dead | 0.7/10 up, 2.5 dead |
| 3 Skorpekh Destroyer vs 5 Astartes Battle-Brother @15yd | A 99% B 1% timeout 0% mutual 0% | 57s | 2.7/3 up, 0.0 dead | 0.0/5 up, 0.7 dead |
| 5 Aspect Warrior vs 10 Ork Boy @15yd | A 98% B 2% timeout 0% mutual 0% | 14s | 4.2/5 up, 0.0 dead | 0.1/10 up, 0.4 dead |
| 1 Exarch vs 2 Astartes Battle-Brother @10yd | A 1% B 99% timeout 0% mutual 0% | 4s | 0.0/1 up, 0.7 dead | 2.0/2 up, 0.0 dead |
| 10 Aeldari Guardian vs 10 Astra Militarum Guardsman @50yd | A 96% B 3% timeout 0% mutual 1% | 9s | 7.6/10 up, 0.7 dead | 0.1/10 up, 4.8 dead |
| 10 Wych vs 10 Ork Boy @15yd | A 84% B 15% timeout 0% mutual 1% | 14s | 5.6/10 up, 1.4 dead | 0.7/10 up, 0.7 dead |
| 5 Incubus vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 6s | 0.0/5 up, 4.5 dead | 4.7/5 up, 0.1 dead |
| 10 Kabalite Warrior vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% timeout 0% mutual 0% | 9s | 0.0/10 up, 7.6 dead | 9.8/10 up, 0.0 dead |
| 10 Fire Warrior (Shas'la) vs 5 Astartes Battle-Brother @150yd | A 8% B 92% timeout 0% mutual 0% | 31s | 0.6/10 up, 6.2 dead | 3.6/5 up, 0.0 dead |
| 3 Battlesuit Pilot (Shas'vre) vs 20 Ork Boy @60yd | A 100% B 0% timeout 0% mutual 0% | 8s | 3.0/3 up, 0.0 dead | 0.0/20 up, 10.3 dead |
| 10 Kroot Carnivore vs 10 Astra Militarum Guardsman @30yd | A 2% B 98% timeout 0% mutual 0% | 4s | 0.1/10 up, 5.8 dead | 8.1/10 up, 1.3 dead |
| 3 Custodian Guardian vs 10 Astartes Battle-Brother @20yd | A 28% B 72% timeout 0% mutual 0% | 42s | 0.5/3 up, 0.9 dead | 4.2/10 up, 3.4 dead |
| 5 Sister of Silence vs 10 Astra Militarum Guardsman @20yd | A 17% B 82% timeout 0% mutual 0% | 7s | 0.4/5 up, 1.0 dead | 7.0/10 up, 1.7 dead |
| 10 Adepta Sororitas Battle Sister vs 15 Ork Boy @30yd | A 100% B 0% timeout 0% mutual 0% | 10s | 10.0/10 up, 0.0 dead | 0.0/15 up, 9.1 dead |
| 10 Militarum Tempestus Scion vs 3 Astartes Battle-Brother @60yd | A 68% B 32% timeout 0% mutual 0% | 18s | 4.8/10 up, 2.5 dead | 0.6/3 up, 0.1 dead |
| 5 Primaris Battle-Brother vs 5 Astartes Battle-Brother @60yd | A 75% B 25% timeout 0% mutual 0% | 114s | 2.4/5 up, 0.1 dead | 0.6/5 up, 0.2 dead |
| 5 Sicarian Ruststalker vs 10 Astra Militarum Guardsman @15yd | A 3% B 97% timeout 0% mutual 0% | 3s | 0.1/5 up, 0.4 dead | 9.1/10 up, 0.4 dead |
| 10 Skitarii Ranger vs 10 Aeldari Guardian @100yd | A 100% B 0% timeout 0% mutual 0% | 21s | 10.0/10 up, 0.0 dead | 0.0/10 up, 8.1 dead |
| 10 Astra Militarum Guardsman vs 10 Kabalite Warrior @100yd | A 0% B 100% timeout 0% mutual 0% | 15s | 0.0/10 up, 3.5 dead | 8.9/10 up, 0.1 dead |
| 10 Astra Militarum Guardsman vs 10 Fire Warrior (Shas'la) @150yd | A 0% B 100% timeout 0% mutual 0% | 8s | 0.0/10 up, 6.8 dead | 10.0/10 up, 0.0 dead |
| 10 Astra Militarum Guardsman vs 10 Skitarii Ranger @100yd | A 0% B 100% timeout 0% mutual 0% | 23s | 0.0/10 up, 6.8 dead | 10.0/10 up, 0.0 dead |
| 30 Astra Militarum Guardsman vs 5 Genestealer @30yd | A 100% B 0% timeout 0% mutual 0% | 5s | 29.1/30 up, 0.5 dead | 0.0/5 up, 2.2 dead |
| 20 Astra Militarum Guardsman vs 20 Termagant @60yd | A 100% B 0% timeout 0% mutual 0% | 32s | 19.3/20 up, 0.0 dead | 0.0/20 up, 4.1 dead |
| 10 Astra Militarum Guardsman vs 10 Necron Warrior @60yd | A 0% B 100% timeout 0% mutual 0% | 21s | 0.0/10 up, 4.1 dead | 10.0/10 up, 0.0 dead |
| 1 Commissar vs 3 Ork Boy @10yd | A 30% B 70% timeout 0% mutual 0% | 8s | 0.3/1 up, 0.4 dead | 1.6/3 up, 0.3 dead |
| 1 Inquisitor vs 2 Genestealer @10yd | A 74% B 26% timeout 0% mutual 0% | 7s | 0.7/1 up, 0.2 dead | 0.4/2 up, 0.6 dead |
| 5 Adepta Sororitas Battle Sister vs 10 Wych @20yd | A 100% B 0% timeout 0% mutual 0% | 8s | 4.9/5 up, 0.0 dead | 0.0/10 up, 8.2 dead |
| 10 Militarum Tempestus Scion vs 10 Kabalite Warrior @80yd | A 99% B 1% timeout 0% mutual 0% | 15s | 8.7/10 up, 0.0 dead | 0.0/10 up, 6.3 dead |
| 5 Astartes Scout vs 10 Kroot Carnivore @80yd | A 93% B 7% timeout 0% mutual 0% | 12s | 4.4/5 up, 0.0 dead | 0.3/10 up, 5.6 dead |
| 5 Astartes Battle-Brother vs 5 Aspect Warrior @40yd | A 100% B 0% timeout 0% mutual 0% | 6s | 5.0/5 up, 0.0 dead | 0.0/5 up, 4.1 dead |
| 5 Astartes Battle-Brother vs 5 Incubus @30yd | A 100% B 0% timeout 0% mutual 0% | 7s | 4.8/5 up, 0.1 dead | 0.0/5 up, 4.5 dead |
| 5 Astartes Battle-Brother vs 10 Flayed One @30yd | A 100% B 0% timeout 0% mutual 0% | 20s | 5.0/5 up, 0.0 dead | 0.0/10 up, 6.4 dead |
| 1 Shield-Captain vs 1 Necron Overlord @10yd | A 100% B 0% timeout 0% mutual 0% | 11s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.6 dead |
| 1 Custodian Guardian vs 3 Lychguard @10yd | A 40% B 60% timeout 0% mutual 0% | 69s | 0.4/1 up, 0.0 dead | 1.6/3 up, 0.8 dead |
| 5 Sister of Silence vs 5 Aspect Warrior @15yd | A 94% B 6% timeout 0% mutual 0% | 5s | 3.4/5 up, 0.8 dead | 0.1/5 up, 2.7 dead |
| 10 Skitarii Vanguard vs 15 Ork Boy @40yd | A 100% B 0% timeout 0% mutual 0% | 9s | 10.0/10 up, 0.0 dead | 0.0/15 up, 6.4 dead |
| 10 Electro-Priest vs 10 Ork Boy @15yd | A 100% B 0% timeout 0% mutual 0% | 13s | 9.8/10 up, 0.1 dead | 0.0/10 up, 0.9 dead |
| 5 Sicarian Ruststalker vs 5 Wych @15yd | A 41% B 54% timeout 0% mutual 5% | 4s | 1.3/5 up, 0.1 dead | 1.6/5 up, 2.5 dead |
| 5 Ork Nob vs 5 Aspect Warrior @15yd | A 61% B 38% timeout 0% mutual 1% | 17s | 2.1/5 up, 0.0 dead | 1.1/5 up, 0.1 dead |
| 3 Ork Meganob vs 1 Custodian Guardian @15yd | A 8% B 92% timeout 0% mutual 0% | 33s | 0.1/3 up, 0.0 dead | 0.9/1 up, 0.0 dead |
| 1 Ork Warboss vs 1 Tyranid Warrior @10yd | A 100% B 0% timeout 0% mutual 0% | 8s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.3 dead |
| 1 Ork Weirdboy vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.5 dead | 5.0/5 up, 0.0 dead |
| 20 Gretchin vs 5 Astra Militarum Guardsman @40yd | A 0% B 100% timeout 0% mutual 0% | 11s | 0.0/20 up, 11.7 dead | 4.9/5 up, 0.0 dead |
| 1 Lictor vs 5 Astra Militarum Guardsman @10yd | A 100% B 0% timeout 0% mutual 0% | 11s | 1.0/1 up, 0.0 dead | 0.0/5 up, 2.9 dead |
| 3 Ravener vs 10 Astra Militarum Guardsman @20yd | A 99% B 1% timeout 0% mutual 0% | 21s | 2.9/3 up, 0.0 dead | 0.0/10 up, 4.9 dead |
| 1 Zoanthrope vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% timeout 0% mutual 0% | 8s | 0.0/1 up, 0.2 dead | 5.0/5 up, 0.0 dead |
| 1 Necron Overlord vs 3 Astartes Battle-Brother @20yd | A 91% B 9% timeout 0% mutual 0% | 48s | 0.9/1 up, 0.0 dead | 0.2/3 up, 0.3 dead |
| 5 Deathmark vs 10 Astra Militarum Guardsman @150yd | A 100% B 0% timeout 0% mutual 0% | 21s | 5.0/5 up, 0.0 dead | 0.0/10 up, 6.2 dead |
| 1 Cryptek vs 5 Ork Boy @20yd | A 100% B 0% timeout 0% mutual 0% | 35s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.1 dead |
| 1 Autarch vs 3 Ork Nob @15yd | A 26% B 74% timeout 0% mutual 0% | 9s | 0.3/1 up, 0.1 dead | 1.8/3 up, 0.2 dead |
| 1 Farseer vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.7 dead | 5.0/5 up, 0.0 dead |
| 5 Aeldari Ranger vs 10 Astra Militarum Guardsman @300yd | A 58% B 42% timeout 0% mutual 0% | 45s | 2.3/5 up, 0.2 dead | 2.9/10 up, 2.4 dead |
| 1 Archon vs 2 Astartes Battle-Brother @15yd | A 16% B 84% timeout 0% mutual 0% | 8s | 0.2/1 up, 0.5 dead | 1.5/2 up, 0.2 dead |
| 1 Succubus vs 2 Ork Nob @10yd | A 5% B 95% timeout 0% mutual 0% | 9s | 0.1/1 up, 0.7 dead | 1.8/2 up, 0.0 dead |
| 5 Mandrake vs 10 Astra Militarum Guardsman @10yd | A 0% B 100% timeout 0% mutual 0% | 1s | 0.0/5 up, 4.9 dead | 10.0/10 up, 0.0 dead |
| 5 Scourge vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% timeout 0% mutual 0% | 5s | 0.0/5 up, 4.3 dead | 10.0/10 up, 0.0 dead |
| 1 Commander (Shas'o) vs 3 Astartes Battle-Brother @60yd | A 54% B 46% timeout 0% mutual 0% | 38s | 0.5/1 up, 0.0 dead | 1.1/3 up, 0.3 dead |
| 10 Pathfinder vs 10 Ork Boy @60yd | A 100% B 0% timeout 0% mutual 0% | 5s | 10.0/10 up, 0.0 dead | 0.0/10 up, 5.6 dead |
| 5 Vespid Stingwing vs 3 Astartes Battle-Brother @40yd | A 0% B 100% timeout 0% mutual 0% | 7s | 0.0/5 up, 3.6 dead | 2.7/3 up, 0.0 dead |
| 4 Gun Drone vs 5 Astra Militarum Guardsman @60yd | A 4% B 96% timeout 0% mutual 0% | 25s | 0.1/4 up, 1.3 dead | 4.2/5 up, 0.2 dead |

## Standard GURPS HP, random hit locations

| Fight | Result | Length | Side A | Side B |
|---|---|---|---|---|
| 10 Astra Militarum Guardsman vs 10 Ork Boy @15yd | A 100% B 0% timeout 0% mutual 0% | 5s | 9.5/10 up, 0.1 dead | 0.0/10 up, 2.8 dead |
| 20 Astra Militarum Guardsman vs 20 Ork Boy @40yd | A 100% B 0% timeout 0% mutual 0% | 9s | 19.5/20 up, 0.1 dead | 0.0/20 up, 6.4 dead |
| 10 Ork Boy vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 8s | 0.0/10 up, 0.9 dead | 5.0/5 up, 0.0 dead |
| 5 Ork Nob vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 13s | 0.0/5 up, 0.3 dead | 5.0/5 up, 0.0 dead |
| 1 Ork Warboss vs 3 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 9s | 0.0/1 up, 0.1 dead | 2.8/3 up, 0.0 dead |
| 3 Ork Meganob vs 5 Astartes Battle-Brother @15yd | A 100% B 0% timeout 0% mutual 0% | 26s | 3.0/3 up, 0.0 dead | 0.0/5 up, 0.7 dead |
| 5 Genestealer vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 5s | 0.0/5 up, 1.3 dead | 5.0/5 up, 0.0 dead |
| 10 Genestealer vs 20 Astra Militarum Guardsman @30yd | A 12% B 87% timeout 0% mutual 1% | 13s | 0.5/10 up, 1.6 dead | 12.5/20 up, 2.5 dead |
| 20 Hormagaunt vs 10 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/20 up, 7.7 dead | 9.8/10 up, 0.1 dead |
| 1 Carnifex vs 5 Astartes Battle-Brother @10yd | A 100% B 0% timeout 0% mutual 0% | 126s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.3 dead |
| 1 Hive Tyrant vs 5 Astartes Battle-Brother @30yd | A 95% B 0% timeout 5% mutual 0% | 268s | 1.0/1 up, 0.0 dead | 0.1/5 up, 0.2 dead |
| 3 Tyranid Warrior vs 5 Astartes Battle-Brother @30yd | A 0% B 100% timeout 0% mutual 0% | 11s | 0.0/3 up, 1.2 dead | 5.0/5 up, 0.0 dead |
| 5 Astartes Battle-Brother vs 10 Necron Warrior @60yd | A 100% B 0% timeout 0% mutual 0% | 70s | 4.2/5 up, 0.0 dead | 0.0/10 up, 1.3 dead |
| 5 Necron Immortal vs 5 Astartes Battle-Brother @60yd | A 22% B 78% timeout 0% mutual 0% | 133s | 0.7/5 up, 0.0 dead | 1.7/5 up, 0.1 dead |
| 5 Lychguard vs 5 Astartes Battle-Brother @10yd | A 98% B 2% timeout 0% mutual 0% | 59s | 4.1/5 up, 0.0 dead | 0.1/5 up, 0.5 dead |
| 10 Flayed One vs 10 Astra Militarum Guardsman @20yd | A 83% B 17% timeout 0% mutual 0% | 24s | 5.0/10 up, 0.0 dead | 0.6/10 up, 1.3 dead |
| 3 Skorpekh Destroyer vs 5 Astartes Battle-Brother @15yd | A 99% B 1% timeout 0% mutual 0% | 54s | 2.7/3 up, 0.0 dead | 0.0/5 up, 0.6 dead |
| 5 Aspect Warrior vs 10 Ork Boy @15yd | A 100% B 0% timeout 0% mutual 0% | 14s | 5.0/5 up, 0.0 dead | 0.0/10 up, 0.4 dead |
| 1 Exarch vs 2 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 5s | 0.0/1 up, 0.2 dead | 2.0/2 up, 0.0 dead |
| 10 Aeldari Guardian vs 10 Astra Militarum Guardsman @50yd | A 97% B 3% timeout 0% mutual 0% | 8s | 7.7/10 up, 0.6 dead | 0.2/10 up, 3.2 dead |
| 10 Wych vs 10 Ork Boy @15yd | A 66% B 34% timeout 0% mutual 1% | 21s | 3.6/10 up, 1.8 dead | 1.8/10 up, 0.1 dead |
| 5 Incubus vs 5 Astartes Battle-Brother @10yd | A 1% B 99% timeout 0% mutual 0% | 8s | 0.0/5 up, 1.8 dead | 4.3/5 up, 0.1 dead |
| 10 Kabalite Warrior vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% timeout 0% mutual 0% | 9s | 0.0/10 up, 6.0 dead | 10.0/10 up, 0.0 dead |
| 10 Fire Warrior (Shas'la) vs 5 Astartes Battle-Brother @150yd | A 3% B 97% timeout 0% mutual 0% | 33s | 0.1/10 up, 4.4 dead | 3.5/5 up, 0.1 dead |
| 3 Battlesuit Pilot (Shas'vre) vs 20 Ork Boy @60yd | A 100% B 0% timeout 0% mutual 0% | 7s | 3.0/3 up, 0.0 dead | 0.0/20 up, 2.8 dead |
| 10 Kroot Carnivore vs 10 Astra Militarum Guardsman @30yd | A 12% B 87% timeout 0% mutual 1% | 6s | 0.5/10 up, 3.5 dead | 6.5/10 up, 1.3 dead |
| 3 Custodian Guardian vs 10 Astartes Battle-Brother @20yd | A 100% B 0% timeout 0% mutual 0% | 22s | 3.0/3 up, 0.0 dead | 0.0/10 up, 3.5 dead |
| 5 Sister of Silence vs 10 Astra Militarum Guardsman @20yd | A 91% B 9% timeout 0% mutual 0% | 8s | 4.5/5 up, 0.1 dead | 0.7/10 up, 3.1 dead |
| 10 Adepta Sororitas Battle Sister vs 15 Ork Boy @30yd | A 100% B 0% timeout 0% mutual 0% | 11s | 10.0/10 up, 0.0 dead | 0.0/15 up, 2.3 dead |
| 10 Militarum Tempestus Scion vs 3 Astartes Battle-Brother @60yd | A 77% B 23% timeout 0% mutual 0% | 17s | 5.4/10 up, 1.2 dead | 0.6/3 up, 0.5 dead |
| 5 Primaris Battle-Brother vs 5 Astartes Battle-Brother @60yd | A 97% B 3% timeout 1% mutual 0% | 82s | 4.0/5 up, 0.0 dead | 0.1/5 up, 0.4 dead |
| 5 Sicarian Ruststalker vs 10 Astra Militarum Guardsman @15yd | A 86% B 14% timeout 0% mutual 0% | 8s | 4.3/5 up, 0.1 dead | 1.2/10 up, 1.8 dead |
| 10 Skitarii Ranger vs 10 Aeldari Guardian @100yd | A 100% B 0% timeout 0% mutual 0% | 18s | 10.0/10 up, 0.0 dead | 0.0/10 up, 4.8 dead |
| 10 Astra Militarum Guardsman vs 10 Kabalite Warrior @100yd | A 0% B 100% timeout 0% mutual 0% | 11s | 0.0/10 up, 2.7 dead | 9.1/10 up, 0.1 dead |
| 10 Astra Militarum Guardsman vs 10 Fire Warrior (Shas'la) @150yd | A 0% B 100% timeout 0% mutual 0% | 9s | 0.0/10 up, 5.3 dead | 10.0/10 up, 0.0 dead |
| 10 Astra Militarum Guardsman vs 10 Skitarii Ranger @100yd | A 0% B 100% timeout 0% mutual 0% | 17s | 0.0/10 up, 4.4 dead | 10.0/10 up, 0.0 dead |
| 30 Astra Militarum Guardsman vs 5 Genestealer @30yd | A 100% B 0% timeout 0% mutual 0% | 5s | 29.5/30 up, 0.2 dead | 0.0/5 up, 2.2 dead |
| 20 Astra Militarum Guardsman vs 20 Termagant @60yd | A 100% B 0% timeout 0% mutual 0% | 47s | 19.1/20 up, 0.1 dead | 0.0/20 up, 2.9 dead |
| 10 Astra Militarum Guardsman vs 10 Necron Warrior @60yd | A 0% B 100% timeout 0% mutual 0% | 24s | 0.0/10 up, 2.9 dead | 10.0/10 up, 0.0 dead |
| 1 Commissar vs 3 Ork Boy @10yd | A 13% B 87% timeout 0% mutual 0% | 8s | 0.1/1 up, 0.2 dead | 2.1/3 up, 0.0 dead |
| 1 Inquisitor vs 2 Genestealer @10yd | A 43% B 56% timeout 0% mutual 0% | 8s | 0.4/1 up, 0.2 dead | 0.9/2 up, 0.2 dead |
| 5 Adepta Sororitas Battle Sister vs 10 Wych @20yd | A 100% B 0% timeout 0% mutual 0% | 9s | 5.0/5 up, 0.0 dead | 0.0/10 up, 6.0 dead |
| 10 Militarum Tempestus Scion vs 10 Kabalite Warrior @80yd | A 100% B 0% timeout 0% mutual 0% | 9s | 10.0/10 up, 0.0 dead | 0.0/10 up, 6.4 dead |
| 5 Astartes Scout vs 10 Kroot Carnivore @80yd | A 100% B 0% timeout 0% mutual 0% | 13s | 5.0/5 up, 0.0 dead | 0.0/10 up, 4.5 dead |
| 5 Astartes Battle-Brother vs 5 Aspect Warrior @40yd | A 100% B 0% timeout 0% mutual 0% | 7s | 5.0/5 up, 0.0 dead | 0.0/5 up, 2.1 dead |
| 5 Astartes Battle-Brother vs 5 Incubus @30yd | A 100% B 0% timeout 0% mutual 0% | 9s | 4.6/5 up, 0.1 dead | 0.0/5 up, 1.9 dead |
| 5 Astartes Battle-Brother vs 10 Flayed One @30yd | A 100% B 0% timeout 0% mutual 0% | 36s | 5.0/5 up, 0.0 dead | 0.0/10 up, 1.6 dead |
| 1 Shield-Captain vs 1 Necron Overlord @10yd | A 83% B 17% timeout 0% mutual 0% | 37s | 0.8/1 up, 0.0 dead | 0.2/1 up, 0.1 dead |
| 1 Custodian Guardian vs 3 Lychguard @10yd | A 7% B 93% timeout 0% mutual 0% | 68s | 0.1/1 up, 0.1 dead | 2.5/3 up, 0.0 dead |
| 5 Sister of Silence vs 5 Aspect Warrior @15yd | A 98% B 2% timeout 0% mutual 0% | 6s | 4.0/5 up, 0.1 dead | 0.0/5 up, 1.9 dead |
| 10 Skitarii Vanguard vs 15 Ork Boy @40yd | A 100% B 0% timeout 0% mutual 0% | 10s | 10.0/10 up, 0.0 dead | 0.0/15 up, 4.1 dead |
| 10 Electro-Priest vs 10 Ork Boy @15yd | A 99% B 1% timeout 0% mutual 0% | 16s | 7.3/10 up, 0.5 dead | 0.0/10 up, 0.4 dead |
| 5 Sicarian Ruststalker vs 5 Wych @15yd | A 100% B 0% timeout 0% mutual 0% | 6s | 5.0/5 up, 0.0 dead | 0.0/5 up, 2.2 dead |
| 5 Ork Nob vs 5 Aspect Warrior @15yd | A 1% B 99% timeout 0% mutual 0% | 28s | 0.0/5 up, 0.0 dead | 4.9/5 up, 0.0 dead |
| 3 Ork Meganob vs 1 Custodian Guardian @15yd | A 40% B 60% timeout 0% mutual 0% | 19s | 1.0/3 up, 0.0 dead | 0.6/1 up, 0.0 dead |
| 1 Ork Warboss vs 1 Tyranid Warrior @10yd | A 100% B 0% timeout 0% mutual 0% | 9s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.1 dead |
| 1 Ork Weirdboy vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.4 dead | 5.0/5 up, 0.0 dead |
| 20 Gretchin vs 5 Astra Militarum Guardsman @40yd | A 0% B 100% timeout 0% mutual 0% | 11s | 0.0/20 up, 10.0 dead | 5.0/5 up, 0.0 dead |
| 1 Lictor vs 5 Astra Militarum Guardsman @10yd | A 100% B 0% timeout 0% mutual 0% | 14s | 1.0/1 up, 0.0 dead | 0.0/5 up, 1.8 dead |
| 3 Ravener vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% timeout 0% mutual 0% | 22s | 3.0/3 up, 0.0 dead | 0.0/10 up, 2.4 dead |
| 1 Zoanthrope vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% timeout 0% mutual 0% | 8s | 0.0/1 up, 0.2 dead | 5.0/5 up, 0.0 dead |
| 1 Necron Overlord vs 3 Astartes Battle-Brother @20yd | A 82% B 18% timeout 0% mutual 0% | 44s | 0.8/1 up, 0.0 dead | 0.3/3 up, 0.2 dead |
| 5 Deathmark vs 10 Astra Militarum Guardsman @150yd | A 100% B 0% timeout 0% mutual 0% | 20s | 5.0/5 up, 0.0 dead | 0.0/10 up, 3.8 dead |
| 1 Cryptek vs 5 Ork Boy @20yd | A 100% B 0% timeout 0% mutual 0% | 39s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.0 dead |
| 1 Autarch vs 3 Ork Nob @15yd | A 99% B 1% timeout 0% mutual 0% | 33s | 1.0/1 up, 0.0 dead | 0.0/3 up, 0.0 dead |
| 1 Farseer vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.5 dead | 5.0/5 up, 0.0 dead |
| 5 Aeldari Ranger vs 10 Astra Militarum Guardsman @300yd | A 69% B 31% timeout 0% mutual 0% | 41s | 2.7/5 up, 0.2 dead | 2.0/10 up, 1.6 dead |
| 1 Archon vs 2 Astartes Battle-Brother @15yd | A 1% B 99% timeout 0% mutual 0% | 7s | 0.0/1 up, 0.4 dead | 1.9/2 up, 0.0 dead |
| 1 Succubus vs 2 Ork Nob @10yd | A 0% B 100% timeout 0% mutual 0% | 8s | 0.0/1 up, 0.5 dead | 2.0/2 up, 0.0 dead |
| 5 Mandrake vs 10 Astra Militarum Guardsman @10yd | A 0% B 100% timeout 0% mutual 0% | 1s | 0.0/5 up, 3.6 dead | 10.0/10 up, 0.0 dead |
| 5 Scourge vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% timeout 0% mutual 0% | 5s | 0.0/5 up, 3.3 dead | 10.0/10 up, 0.0 dead |
| 1 Commander (Shas'o) vs 3 Astartes Battle-Brother @60yd | A 12% B 60% timeout 28% mutual 0% | 359s | 0.4/1 up, 0.0 dead | 2.2/3 up, 0.1 dead |
| 10 Pathfinder vs 10 Ork Boy @60yd | A 100% B 0% timeout 0% mutual 0% | 5s | 10.0/10 up, 0.0 dead | 0.0/10 up, 1.7 dead |
| 5 Vespid Stingwing vs 3 Astartes Battle-Brother @40yd | A 1% B 99% timeout 0% mutual 0% | 8s | 0.0/5 up, 2.6 dead | 2.5/3 up, 0.1 dead |
| 4 Gun Drone vs 5 Astra Militarum Guardsman @60yd | A 10% B 90% timeout 0% mutual 0% | 32s | 0.3/4 up, 0.9 dead | 3.7/5 up, 0.3 dead |

## Revised Fractional Health, elites aim

The user's wound rules: no HP pool; five boxes per level per location; a hit marks as many boxes of its level as its injury reaches on the sheet's 1-4 columns, spilling into the next level when a row is full. Unliving counts as ordinary Injury Tolerance, so Necrons can be stunned.

| Fight | Result | Length | Side A | Side B |
|---|---|---|---|---|
| 10 Astra Militarum Guardsman vs 10 Ork Boy @15yd | A 80% B 19% timeout 0% mutual 1% | 8s | 6.4/10 up, 0.2 dead | 1.1/10 up, 0.3 dead |
| 20 Astra Militarum Guardsman vs 20 Ork Boy @40yd | A 73% B 25% timeout 0% mutual 2% | 11s | 10.0/20 up, 1.1 dead | 2.8/20 up, 0.4 dead |
| 10 Ork Boy vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 6s | 0.0/10 up, 1.1 dead | 5.0/5 up, 0.0 dead |
| 5 Ork Nob vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 7s | 0.0/5 up, 0.1 dead | 5.0/5 up, 0.0 dead |
| 1 Ork Warboss vs 3 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/1 up, 0.2 dead | 2.9/3 up, 0.1 dead |
| 3 Ork Meganob vs 5 Astartes Battle-Brother @15yd | A 0% B 100% timeout 0% mutual 0% | 7s | 0.0/3 up, 0.7 dead | 4.9/5 up, 0.0 dead |
| 5 Genestealer vs 5 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 3s | 0.0/5 up, 0.0 dead | 4.9/5 up, 0.0 dead |
| 10 Genestealer vs 20 Astra Militarum Guardsman @30yd | A 100% B 0% timeout 0% mutual 0% | 5s | 9.6/10 up, 0.1 dead | 0.0/20 up, 0.6 dead |
| 20 Hormagaunt vs 10 Astra Militarum Guardsman @20yd | A 7% B 91% timeout 0% mutual 2% | 4s | 0.8/20 up, 0.2 dead | 7.5/10 up, 0.2 dead |
| 1 Carnifex vs 5 Astartes Battle-Brother @10yd | A 100% B 0% timeout 0% mutual 0% | 338s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.8 dead |
| 1 Hive Tyrant vs 5 Astartes Battle-Brother @30yd | A 100% B 0% timeout 0% mutual 0% | 499s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.6 dead |
| 3 Tyranid Warrior vs 5 Astartes Battle-Brother @30yd | A 0% B 100% timeout 0% mutual 0% | 6s | 0.0/3 up, 0.1 dead | 5.0/5 up, 0.0 dead |
| 5 Astartes Battle-Brother vs 10 Necron Warrior @60yd | A 100% B 0% timeout 0% mutual 0% | 59s | 4.9/5 up, 0.0 dead | 0.0/10 up, 0.2 dead |
| 5 Necron Immortal vs 5 Astartes Battle-Brother @60yd | A 0% B 100% timeout 0% mutual 0% | 83s | 0.0/5 up, 0.4 dead | 4.6/5 up, 0.2 dead |
| 5 Lychguard vs 5 Astartes Battle-Brother @10yd | A 100% B 0% timeout 0% mutual 0% | 19s | 4.7/5 up, 0.0 dead | 0.0/5 up, 0.7 dead |
| 10 Flayed One vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% timeout 0% mutual 0% | 9s | 9.8/10 up, 0.0 dead | 0.0/10 up, 0.6 dead |
| 3 Skorpekh Destroyer vs 5 Astartes Battle-Brother @15yd | A 97% B 3% timeout 0% mutual 0% | 58s | 2.8/3 up, 0.0 dead | 0.1/5 up, 0.7 dead |
| 5 Aspect Warrior vs 10 Ork Boy @15yd | A 85% B 15% timeout 0% mutual 0% | 10s | 3.4/5 up, 0.0 dead | 0.9/10 up, 1.2 dead |
| 1 Exarch vs 2 Astartes Battle-Brother @10yd | A 0% B 100% timeout 0% mutual 0% | 3s | 0.0/1 up, 0.2 dead | 1.9/2 up, 0.0 dead |
| 10 Aeldari Guardian vs 10 Astra Militarum Guardsman @50yd | A 84% B 14% timeout 0% mutual 2% | 5s | 5.6/10 up, 0.0 dead | 0.5/10 up, 0.5 dead |
| 10 Wych vs 10 Ork Boy @15yd | A 9% B 90% timeout 0% mutual 1% | 4s | 0.4/10 up, 0.3 dead | 6.7/10 up, 0.2 dead |
| 5 Incubus vs 5 Astartes Battle-Brother @10yd | A 5% B 95% timeout 0% mutual 0% | 5s | 0.1/5 up, 1.7 dead | 3.8/5 up, 0.8 dead |
| 10 Kabalite Warrior vs 10 Fire Warrior (Shas'la) @100yd | A 1% B 99% timeout 0% mutual 0% | 8s | 0.0/10 up, 0.0 dead | 8.0/10 up, 0.0 dead |
| 10 Fire Warrior (Shas'la) vs 5 Astartes Battle-Brother @150yd | A 4% B 96% timeout 0% mutual 0% | 31s | 0.2/10 up, 0.0 dead | 4.6/5 up, 0.0 dead |
| 3 Battlesuit Pilot (Shas'vre) vs 20 Ork Boy @60yd | A 100% B 0% timeout 0% mutual 0% | 13s | 3.0/3 up, 0.0 dead | 0.0/20 up, 0.0 dead |
| 10 Kroot Carnivore vs 10 Astra Militarum Guardsman @30yd | A 0% B 100% timeout 0% mutual 0% | 3s | 0.0/10 up, 0.4 dead | 9.2/10 up, 0.0 dead |
| 3 Custodian Guardian vs 10 Astartes Battle-Brother @20yd | A 61% B 39% timeout 0% mutual 0% | 21s | 1.4/3 up, 1.4 dead | 2.0/10 up, 1.7 dead |
| 5 Sister of Silence vs 10 Astra Militarum Guardsman @20yd | A 11% B 89% timeout 0% mutual 1% | 14s | 0.3/5 up, 0.3 dead | 7.4/10 up, 0.1 dead |
| 10 Adepta Sororitas Battle Sister vs 15 Ork Boy @30yd | A 100% B 0% timeout 0% mutual 0% | 7s | 9.9/10 up, 0.0 dead | 0.0/15 up, 0.0 dead |
| 10 Militarum Tempestus Scion vs 3 Astartes Battle-Brother @60yd | A 100% B 0% timeout 0% mutual 0% | 8s | 9.3/10 up, 0.0 dead | 0.0/3 up, 1.2 dead |
| 5 Primaris Battle-Brother vs 5 Astartes Battle-Brother @60yd | A 69% B 31% timeout 0% mutual 0% | 118s | 2.9/5 up, 1.3 dead | 1.2/5 up, 1.6 dead |
| 5 Sicarian Ruststalker vs 10 Astra Militarum Guardsman @15yd | A 0% B 100% timeout 0% mutual 0% | 5s | 0.0/5 up, 0.1 dead | 8.9/10 up, 0.5 dead |
| 10 Skitarii Ranger vs 10 Aeldari Guardian @100yd | A 100% B 0% timeout 0% mutual 0% | 7s | 10.0/10 up, 0.0 dead | 0.0/10 up, 0.0 dead |
| 50 Ork Boy vs 5 Astartes Battle-Brother @30yd | A 34% B 66% timeout 0% mutual 0% | 57s | 10.5/50 up, 4.2 dead | 3.1/5 up, 0.8 dead |
| 30 Ork Boy vs 5 Astartes Battle-Brother @30yd | A 8% B 92% timeout 0% mutual 0% | 32s | 1.5/30 up, 3.0 dead | 4.5/5 up, 0.2 dead |
| 20 Ork Boy vs 5 Astartes Battle-Brother @30yd | A 0% B 100% timeout 0% mutual 0% | 20s | 0.0/20 up, 1.9 dead | 5.0/5 up, 0.0 dead |
| 1 Sanctioned Psyker vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.1 dead | 5.0/5 up, 0.0 dead |
| 1 Sanctioned Psyker vs 1 Astartes Battle-Brother @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.0 dead | 1.0/1 up, 0.0 dead |
| 1 Warlock vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.0 dead | 5.0/5 up, 0.0 dead |
| 1 Farseer vs 3 Astartes Battle-Brother @20yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/1 up, 0.0 dead | 3.0/3 up, 0.0 dead |
| 1 Ork Weirdboy vs 1 Astartes Battle-Brother @20yd | A 0% B 100% timeout 0% mutual 0% | 8s | 0.0/1 up, 0.0 dead | 1.0/1 up, 0.0 dead |
| 1 Zoanthrope vs 3 Astartes Battle-Brother @60yd | A 0% B 100% timeout 0% mutual 0% | 6s | 0.0/1 up, 0.0 dead | 3.0/3 up, 0.0 dead |
| 1 Zoanthrope vs 1 Carnifex @40yd | A 0% B 100% timeout 0% mutual 0% | 18s | 0.0/1 up, 0.1 dead | 1.0/1 up, 0.0 dead |
| 1 Farseer vs 3 Sister of Silence @20yd | A 76% B 24% timeout 0% mutual 0% | 11s | 0.8/1 up, 0.1 dead | 0.4/3 up, 0.4 dead |
| 10 Astra Militarum Guardsman vs 10 Kabalite Warrior @100yd | A 10% B 88% timeout 0% mutual 2% | 8s | 0.5/10 up, 0.0 dead | 6.1/10 up, 0.0 dead |
| 10 Astra Militarum Guardsman vs 10 Fire Warrior (Shas'la) @150yd | A 0% B 100% timeout 0% mutual 0% | 8s | 0.0/10 up, 0.0 dead | 9.1/10 up, 0.0 dead |
| 10 Astra Militarum Guardsman vs 10 Skitarii Ranger @100yd | A 0% B 100% timeout 0% mutual 0% | 7s | 0.0/10 up, 0.0 dead | 9.7/10 up, 0.0 dead |
| 30 Astra Militarum Guardsman vs 5 Genestealer @30yd | A 97% B 2% timeout 0% mutual 1% | 9s | 22.1/30 up, 0.3 dead | 0.1/5 up, 0.1 dead |
| 20 Astra Militarum Guardsman vs 20 Termagant @60yd | A 100% B 0% timeout 0% mutual 0% | 8s | 19.9/20 up, 0.0 dead | 0.0/20 up, 0.3 dead |
| 10 Astra Militarum Guardsman vs 10 Necron Warrior @60yd | A 0% B 100% timeout 0% mutual 0% | 18s | 0.0/10 up, 0.4 dead | 9.9/10 up, 0.0 dead |
| 1 Commissar vs 3 Ork Boy @10yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/1 up, 0.1 dead | 2.5/3 up, 0.0 dead |
| 1 Inquisitor vs 2 Genestealer @10yd | A 43% B 56% timeout 0% mutual 0% | 3s | 0.4/1 up, 0.0 dead | 1.0/2 up, 0.0 dead |
| 5 Adepta Sororitas Battle Sister vs 10 Wych @20yd | A 97% B 3% timeout 0% mutual 0% | 4s | 4.5/5 up, 0.0 dead | 0.2/10 up, 1.7 dead |
| 10 Militarum Tempestus Scion vs 10 Kabalite Warrior @80yd | A 100% B 0% timeout 0% mutual 0% | 3s | 10.0/10 up, 0.0 dead | 0.0/10 up, 0.0 dead |
| 5 Astartes Scout vs 10 Kroot Carnivore @80yd | A 6% B 93% timeout 0% mutual 0% | 17s | 0.2/5 up, 0.0 dead | 7.4/10 up, 0.1 dead |
| 5 Astartes Battle-Brother vs 5 Aspect Warrior @40yd | A 100% B 0% timeout 0% mutual 0% | 5s | 5.0/5 up, 0.0 dead | 0.0/5 up, 0.0 dead |
| 5 Astartes Battle-Brother vs 5 Incubus @30yd | A 95% B 5% timeout 0% mutual 0% | 7s | 4.1/5 up, 0.6 dead | 0.2/5 up, 1.5 dead |
| 5 Astartes Battle-Brother vs 10 Flayed One @30yd | A 94% B 6% timeout 0% mutual 0% | 38s | 4.1/5 up, 0.4 dead | 0.4/10 up, 0.0 dead |
| 1 Shield-Captain vs 1 Necron Overlord @10yd | A 100% B 0% timeout 0% mutual 0% | 37s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.0 dead |
| 1 Custodian Guardian vs 3 Lychguard @10yd | A 99% B 1% timeout 0% mutual 0% | 24s | 1.0/1 up, 0.0 dead | 0.0/3 up, 0.0 dead |
| 5 Sister of Silence vs 5 Aspect Warrior @15yd | A 81% B 19% timeout 0% mutual 0% | 7s | 2.6/5 up, 0.6 dead | 0.5/5 up, 1.1 dead |
| 10 Skitarii Vanguard vs 15 Ork Boy @40yd | A 100% B 0% timeout 0% mutual 0% | 5s | 10.0/10 up, 0.0 dead | 0.0/15 up, 0.0 dead |
| 10 Electro-Priest vs 10 Ork Boy @15yd | A 10% B 90% timeout 0% mutual 0% | 17s | 0.5/10 up, 0.8 dead | 7.4/10 up, 0.1 dead |
| 5 Sicarian Ruststalker vs 5 Wych @15yd | A 11% B 85% timeout 0% mutual 3% | 4s | 0.4/5 up, 0.0 dead | 3.0/5 up, 0.2 dead |
| 5 Ork Nob vs 5 Aspect Warrior @15yd | A 77% B 22% timeout 0% mutual 0% | 18s | 2.8/5 up, 0.3 dead | 0.8/5 up, 0.1 dead |
| 3 Ork Meganob vs 1 Custodian Guardian @15yd | A 0% B 100% timeout 0% mutual 0% | 10s | 0.0/3 up, 0.8 dead | 1.0/1 up, 0.0 dead |
| 1 Ork Warboss vs 1 Tyranid Warrior @10yd | A 100% B 0% timeout 0% mutual 0% | 3s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.6 dead |
| 1 Ork Weirdboy vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% timeout 0% mutual 0% | 3s | 0.0/1 up, 0.0 dead | 5.0/5 up, 0.0 dead |
| 20 Gretchin vs 5 Astra Militarum Guardsman @40yd | A 0% B 100% timeout 0% mutual 0% | 8s | 0.0/20 up, 0.5 dead | 4.9/5 up, 0.0 dead |
| 1 Lictor vs 5 Astra Militarum Guardsman @10yd | A 100% B 0% timeout 0% mutual 0% | 27s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.6 dead |
| 3 Ravener vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% timeout 0% mutual 0% | 16s | 3.0/3 up, 0.0 dead | 0.0/10 up, 0.4 dead |
| 1 Zoanthrope vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% timeout 0% mutual 0% | 5s | 0.0/1 up, 0.1 dead | 5.0/5 up, 0.0 dead |
| 1 Necron Overlord vs 3 Astartes Battle-Brother @20yd | A 77% B 23% timeout 0% mutual 0% | 96s | 0.8/1 up, 0.0 dead | 0.6/3 up, 0.2 dead |
| 5 Deathmark vs 10 Astra Militarum Guardsman @150yd | A 100% B 0% timeout 0% mutual 0% | 13s | 5.0/5 up, 0.0 dead | 0.0/10 up, 0.8 dead |
| 1 Cryptek vs 5 Ork Boy @20yd | A 92% B 8% timeout 0% mutual 0% | 99s | 0.9/1 up, 0.0 dead | 0.3/5 up, 0.1 dead |
| 1 Autarch vs 3 Ork Nob @15yd | A 92% B 8% timeout 0% mutual 0% | 18s | 0.9/1 up, 0.0 dead | 0.2/3 up, 0.0 dead |
| 1 Farseer vs 5 Astra Militarum Guardsman @20yd | A 5% B 91% timeout 0% mutual 3% | 3s | 0.1/1 up, 0.0 dead | 3.6/5 up, 0.0 dead |
| 5 Aeldari Ranger vs 10 Astra Militarum Guardsman @300yd | A 9% B 91% timeout 0% mutual 1% | 11s | 0.2/5 up, 0.0 dead | 6.8/10 up, 0.0 dead |
| 1 Archon vs 2 Astartes Battle-Brother @15yd | A 4% B 96% timeout 0% mutual 0% | 6s | 0.0/1 up, 0.1 dead | 1.8/2 up, 0.1 dead |
| 1 Succubus vs 2 Ork Nob @10yd | A 0% B 100% timeout 0% mutual 0% | 5s | 0.0/1 up, 0.0 dead | 2.0/2 up, 0.0 dead |
| 5 Mandrake vs 10 Astra Militarum Guardsman @10yd | A 0% B 100% timeout 0% mutual 0% | 2s | 0.0/5 up, 0.2 dead | 9.4/10 up, 0.1 dead |
| 5 Scourge vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% timeout 0% mutual 0% | 4s | 0.0/5 up, 0.0 dead | 10.0/10 up, 0.0 dead |
| 1 Commander (Shas'o) vs 3 Astartes Battle-Brother @60yd | A 28% B 71% timeout 1% mutual 0% | 90s | 0.3/1 up, 0.1 dead | 2.0/3 up, 0.1 dead |
| 10 Pathfinder vs 10 Ork Boy @60yd | A 100% B 0% timeout 0% mutual 0% | 6s | 10.0/10 up, 0.0 dead | 0.0/10 up, 0.0 dead |
| 5 Vespid Stingwing vs 3 Astartes Battle-Brother @40yd | A 0% B 100% timeout 0% mutual 0% | 6s | 0.0/5 up, 0.0 dead | 3.0/3 up, 0.0 dead |
| 4 Gun Drone vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% timeout 0% mutual 0% | 9s | 0.0/4 up, 0.1 dead | 4.6/5 up, 0.0 dead |
