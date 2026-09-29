# Combat simulator results

Reference fights run with `tools/sim.js` against the current data: 300 battles each, morale on, default loadouts from `data/sim/loadouts.yaml`. Side A is listed first. "up" is models still fighting at the end; "dead" counts only models killed outright (the rest of the losses fell unconscious, phased out or fled).

Rerun after data changes to see what moved. The two scripts that produced this table live in the session scratchpad; `node tools/sim_test.js` runs a smaller set.

| Fight | Result | Length | Side A | Side B |
|---|---|---|---|---|
| 10 Astra Militarum Guardsman vs 10 Ork Boy @15yd | A 100% B 0% draw 0% | 8s | 9.5/10 up, 0.1 dead | 0.0/10 up, 2.0 dead |
| 20 Astra Militarum Guardsman vs 20 Ork Boy @40yd | A 100% B 0% draw 0% | 4s | 20.0/20 up, 0.0 dead | 0.0/20 up, 11.4 dead |
| 10 Ork Boy vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 4s | 0.0/10 up, 4.8 dead | 5.0/5 up, 0.0 dead |
| 5 Ork Nob vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 3s | 0.0/5 up, 3.0 dead | 5.0/5 up, 0.0 dead |
| 1 Ork Warboss vs 3 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 2s | 0.0/1 up, 0.7 dead | 3.0/3 up, 0.0 dead |
| 3 Ork Meganob vs 5 Astartes Battle-Brother @15yd | A 81% B 0% draw 19% | 49s | 3.0/3 up, 0.0 dead | 0.3/5 up, 0.3 dead |
| 5 Genestealer vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 3s | 0.0/5 up, 3.5 dead | 5.0/5 up, 0.0 dead |
| 10 Genestealer vs 20 Astra Militarum Guardsman @30yd | A 36% B 61% draw 3% | 10s | 1.7/10 up, 0.8 dead | 8.0/20 up, 2.8 dead |
| 20 Hormagaunt vs 10 Astra Militarum Guardsman @20yd | A 17% B 79% draw 4% | 8s | 1.8/20 up, 5.0 dead | 6.0/10 up, 0.6 dead |
| 1 Carnifex vs 5 Astartes Battle-Brother @10yd | A 1% B 0% draw 99% | 60s | 1.0/1 up, 0.0 dead | 3.7/5 up, 0.0 dead |
| 1 Hive Tyrant vs 5 Astartes Battle-Brother @30yd | A 0% B 1% draw 99% | 60s | 1.0/1 up, 0.0 dead | 4.3/5 up, 0.0 dead |
| 3 Tyranid Warrior vs 5 Astartes Battle-Brother @30yd | A 0% B 100% draw 0% | 3s | 0.0/3 up, 2.2 dead | 5.0/5 up, 0.0 dead |
| 5 Astartes Battle-Brother vs 10 Necron Warrior @60yd | A 100% B 0% draw 0% | 20s | 5.0/5 up, 0.0 dead | 0.0/10 up, 2.0 dead |
| 5 Necron Immortal vs 5 Astartes Battle-Brother @60yd | A 5% B 43% draw 52% | 44s | 0.8/5 up, 0.4 dead | 3.8/5 up, 0.0 dead |
| 5 Lychguard vs 5 Astartes Battle-Brother @10yd | A 3% B 22% draw 74% | 53s | 1.3/5 up, 0.1 dead | 3.4/5 up, 0.0 dead |
| 10 Flayed One vs 10 Astra Militarum Guardsman @20yd | A 98% B 1% draw 1% | 21s | 6.2/10 up, 0.0 dead | 0.1/10 up, 0.8 dead |
| 3 Skorpekh Destroyer vs 5 Astartes Battle-Brother @15yd | A 30% B 14% draw 57% | 53s | 1.4/3 up, 0.0 dead | 1.8/5 up, 0.1 dead |
| 5 Aspect Warrior vs 10 Ork Boy @15yd | A 100% B 0% draw 0% | 6s | 5.0/5 up, 0.0 dead | 0.0/10 up, 1.5 dead |
| 1 Exarch vs 2 Astartes Battle-Brother @10yd | A 2% B 98% draw 0% | 3s | 0.0/1 up, 0.6 dead | 2.0/2 up, 0.0 dead |
| 10 Aeldari Guardian vs 10 Astra Militarum Guardsman @50yd | A 100% B 0% draw 0% | 3s | 9.3/10 up, 0.3 dead | 0.0/10 up, 7.9 dead |
| 10 Wych vs 10 Ork Boy @15yd | A 100% B 0% draw 0% | 4s | 9.5/10 up, 0.2 dead | 0.0/10 up, 2.8 dead |
| 5 Incubus vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 4s | 0.0/5 up, 3.7 dead | 4.9/5 up, 0.0 dead |
| 10 Kabalite Warrior vs 10 Fire Warrior (Shas'la) @100yd | A 12% B 87% draw 1% | 6s | 0.5/10 up, 6.5 dead | 5.6/10 up, 1.3 dead |
| 10 Fire Warrior (Shas'la) vs 5 Astartes Battle-Brother @150yd | A 0% B 100% draw 0% | 15s | 0.0/10 up, 7.7 dead | 4.4/5 up, 0.0 dead |
| 3 Battlesuit Pilot (Shas'vre) vs 20 Ork Boy @60yd | A 100% B 0% draw 0% | 6s | 3.0/3 up, 0.0 dead | 0.0/20 up, 12.0 dead |
| 10 Kroot Carnivore vs 10 Astra Militarum Guardsman @30yd | A 0% B 100% draw 0% | 2s | 0.0/10 up, 9.2 dead | 9.9/10 up, 0.0 dead |
| 3 Custodian Guardian vs 10 Astartes Battle-Brother @20yd | A 100% B 0% draw 0% | 22s | 3.0/3 up, 0.0 dead | 0.0/10 up, 2.7 dead |
| 5 Sister of Silence vs 10 Astra Militarum Guardsman @20yd | A 88% B 12% draw 0% | 16s | 2.6/5 up, 0.4 dead | 1.0/10 up, 2.1 dead |
| 10 Adepta Sororitas Battle Sister vs 15 Ork Boy @30yd | A 100% B 0% draw 0% | 5s | 10.0/10 up, 0.0 dead | 0.0/15 up, 6.3 dead |
| 10 Militarum Tempestus Scion vs 3 Astartes Battle-Brother @60yd | A 4% B 88% draw 8% | 18s | 0.4/10 up, 4.1 dead | 2.4/3 up, 0.0 dead |
| 5 Primaris Battle-Brother vs 5 Astartes Battle-Brother @60yd | A 16% B 0% draw 84% | 55s | 3.8/5 up, 0.0 dead | 1.7/5 up, 0.3 dead |
| 5 Sicarian Ruststalker vs 10 Astra Militarum Guardsman @15yd | A 100% B 0% draw 0% | 12s | 4.9/5 up, 0.0 dead | 0.0/10 up, 1.7 dead |
| 10 Skitarii Ranger vs 10 Aeldari Guardian @100yd | A 100% B 0% draw 0% | 8s | 10.0/10 up, 0.0 dead | 0.0/10 up, 3.1 dead |
| 10 Astra Militarum Guardsman vs 10 Kabalite Warrior @100yd | A 2% B 98% draw 0% | 3s | 0.1/10 up, 7.1 dead | 8.5/10 up, 0.7 dead |
| 10 Astra Militarum Guardsman vs 10 Fire Warrior (Shas'la) @150yd | A 0% B 100% draw 0% | 6s | 0.0/10 up, 5.7 dead | 9.1/10 up, 0.2 dead |
| 10 Astra Militarum Guardsman vs 10 Skitarii Ranger @100yd | A 0% B 100% draw 0% | 9s | 0.0/10 up, 2.2 dead | 9.5/10 up, 0.2 dead |
| 30 Astra Militarum Guardsman vs 5 Genestealer @30yd | A 100% B 0% draw 0% | 4s | 29.9/30 up, 0.1 dead | 0.0/5 up, 2.8 dead |
| 20 Astra Militarum Guardsman vs 20 Termagant @60yd | A 100% B 0% draw 0% | 3s | 20.0/20 up, 0.0 dead | 0.0/20 up, 11.5 dead |
| 10 Astra Militarum Guardsman vs 10 Necron Warrior @60yd | A 1% B 99% draw 0% | 11s | 0.0/10 up, 2.8 dead | 8.9/10 up, 0.0 dead |
| 1 Commissar vs 3 Ork Boy @10yd | A 41% B 59% draw 0% | 10s | 0.4/1 up, 0.1 dead | 1.2/3 up, 0.1 dead |
| 1 Inquisitor vs 2 Genestealer @10yd | A 40% B 59% draw 1% | 5s | 0.4/1 up, 0.3 dead | 0.9/2 up, 0.2 dead |
| 5 Adepta Sororitas Battle Sister vs 10 Wych @20yd | A 97% B 0% draw 3% | 9s | 5.0/5 up, 0.0 dead | 0.1/10 up, 6.7 dead |
| 10 Militarum Tempestus Scion vs 10 Kabalite Warrior @80yd | A 97% B 2% draw 1% | 8s | 8.1/10 up, 0.3 dead | 0.1/10 up, 5.3 dead |
| 5 Astartes Scout vs 10 Kroot Carnivore @80yd | A 99% B 1% draw 0% | 10s | 4.9/5 up, 0.0 dead | 0.0/10 up, 5.1 dead |
| 5 Astartes Battle-Brother vs 5 Aspect Warrior @40yd | A 100% B 0% draw 0% | 3s | 5.0/5 up, 0.0 dead | 0.0/5 up, 4.0 dead |
| 5 Astartes Battle-Brother vs 5 Incubus @30yd | A 100% B 0% draw 0% | 4s | 5.0/5 up, 0.0 dead | 0.0/5 up, 3.7 dead |
| 5 Astartes Battle-Brother vs 10 Flayed One @30yd | A 100% B 0% draw 0% | 11s | 5.0/5 up, 0.0 dead | 0.0/10 up, 4.2 dead |
| 1 Shield-Captain vs 1 Necron Overlord @10yd | A 100% B 0% draw 0% | 14s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.1 dead |
| 1 Custodian Guardian vs 3 Lychguard @10yd | A 87% B 3% draw 10% | 41s | 1.0/1 up, 0.0 dead | 0.2/3 up, 0.2 dead |
| 5 Sister of Silence vs 5 Aspect Warrior @15yd | A 36% B 64% draw 0% | 8s | 1.0/5 up, 0.9 dead | 2.3/5 up, 0.7 dead |
| 10 Skitarii Vanguard vs 15 Ork Boy @40yd | A 100% B 0% draw 0% | 5s | 10.0/10 up, 0.0 dead | 0.0/15 up, 6.7 dead |
| 10 Electro-Priest vs 10 Ork Boy @15yd | A 100% B 0% draw 0% | 8s | 10.0/10 up, 0.0 dead | 0.0/10 up, 1.4 dead |
| 5 Sicarian Ruststalker vs 5 Wych @15yd | A 100% B 0% draw 0% | 8s | 5.0/5 up, 0.0 dead | 0.0/5 up, 1.8 dead |
| 5 Ork Nob vs 5 Aspect Warrior @15yd | A 0% B 100% draw 0% | 12s | 0.0/5 up, 0.4 dead | 5.0/5 up, 0.0 dead |
| 3 Ork Meganob vs 1 Custodian Guardian @15yd | A 1% B 99% draw 0% | 12s | 0.0/3 up, 0.2 dead | 1.0/1 up, 0.0 dead |
| 1 Ork Warboss vs 1 Tyranid Warrior @10yd | A 100% B 0% draw 0% | 8s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.2 dead |
| 1 Ork Weirdboy vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% draw 0% | 2s | 0.0/1 up, 0.9 dead | 5.0/5 up, 0.0 dead |
| 20 Gretchin vs 5 Astra Militarum Guardsman @40yd | A 0% B 100% draw 0% | 6s | 0.0/20 up, 11.6 dead | 5.0/5 up, 0.0 dead |
| 1 Lictor vs 5 Astra Militarum Guardsman @10yd | A 94% B 6% draw 0% | 25s | 0.9/1 up, 0.0 dead | 0.2/5 up, 0.8 dead |
| 3 Ravener vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% draw 0% | 25s | 3.0/3 up, 0.0 dead | 0.0/10 up, 1.0 dead |
| 1 Zoanthrope vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% draw 0% | 3s | 0.0/1 up, 0.4 dead | 5.0/5 up, 0.0 dead |
| 1 Necron Overlord vs 3 Astartes Battle-Brother @20yd | A 6% B 88% draw 7% | 19s | 0.1/1 up, 0.0 dead | 2.6/3 up, 0.0 dead |
| 5 Deathmark vs 10 Astra Militarum Guardsman @150yd | A 100% B 0% draw 0% | 13s | 5.0/5 up, 0.0 dead | 0.0/10 up, 2.1 dead |
| 1 Cryptek vs 5 Ork Boy @20yd | A 92% B 0% draw 8% | 40s | 1.0/1 up, 0.0 dead | 0.2/5 up, 0.0 dead |
| 1 Autarch vs 3 Ork Nob @15yd | A 100% B 0% draw 0% | 14s | 1.0/1 up, 0.0 dead | 0.0/3 up, 0.2 dead |
| 1 Farseer vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% draw 0% | 2s | 0.0/1 up, 1.0 dead | 5.0/5 up, 0.0 dead |
| 5 Aeldari Ranger vs 10 Astra Militarum Guardsman @300yd | A 1% B 98% draw 1% | 7s | 0.0/5 up, 1.9 dead | 8.6/10 up, 0.2 dead |
| 1 Archon vs 2 Astartes Battle-Brother @15yd | A 2% B 98% draw 0% | 4s | 0.0/1 up, 0.8 dead | 1.9/2 up, 0.0 dead |
| 1 Succubus vs 2 Ork Nob @10yd | A 32% B 68% draw 0% | 16s | 0.3/1 up, 0.1 dead | 1.3/2 up, 0.0 dead |
| 5 Mandrake vs 10 Astra Militarum Guardsman @10yd | A 0% B 100% draw 0% | 4s | 0.0/5 up, 3.5 dead | 9.9/10 up, 0.0 dead |
| 5 Scourge vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% draw 0% | 3s | 0.0/5 up, 4.4 dead | 9.9/10 up, 0.0 dead |
| 1 Commander (Shas'o) vs 3 Astartes Battle-Brother @60yd | A 0% B 97% draw 3% | 8s | 0.0/1 up, 0.6 dead | 2.9/3 up, 0.0 dead |
| 10 Pathfinder vs 10 Ork Boy @60yd | A 100% B 0% draw 0% | 4s | 10.0/10 up, 0.0 dead | 0.0/10 up, 5.6 dead |
| 5 Vespid Stingwing vs 3 Astartes Battle-Brother @40yd | A 0% B 100% draw 0% | 4s | 0.0/5 up, 3.8 dead | 2.9/3 up, 0.0 dead |
| 4 Gun Drone vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% draw 0% | 4s | 0.0/4 up, 2.8 dead | 5.0/5 up, 0.0 dead |
