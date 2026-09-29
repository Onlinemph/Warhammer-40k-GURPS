# Combat simulator results

Reference fights run with `tools/sim.js` against the current data: 300 battles each, morale on, default loadouts from `data/sim/loadouts.yaml`. Side A is listed first. "up" is models still fighting at the end; "dead" counts only models killed outright (the rest of the losses fell unconscious, phased out or fled).

Rerun after data changes to see what moved. The two scripts that produced this table live in the session scratchpad; `node tools/sim_test.js` runs a smaller set.

## Standard GURPS HP

| Fight | Result | Length | Side A | Side B |
|---|---|---|---|---|
| 10 Astra Militarum Guardsman vs 10 Ork Boy @15yd | A 96% B 3% draw 1% | 10s | 8.1/10 up, 0.2 dead | 0.1/10 up, 0.9 dead |
| 20 Astra Militarum Guardsman vs 20 Ork Boy @40yd | A 100% B 0% draw 0% | 4s | 20.0/20 up, 0.0 dead | 0.0/20 up, 11.3 dead |
| 10 Ork Boy vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 5s | 0.0/10 up, 2.8 dead | 5.0/5 up, 0.0 dead |
| 5 Ork Nob vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 6s | 0.0/5 up, 1.3 dead | 5.0/5 up, 0.0 dead |
| 1 Ork Warboss vs 3 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 6s | 0.0/1 up, 0.2 dead | 3.0/3 up, 0.0 dead |
| 3 Ork Meganob vs 5 Astartes Battle-Brother @15yd | A 78% B 0% draw 22% | 51s | 3.0/3 up, 0.0 dead | 0.3/5 up, 0.3 dead |
| 5 Genestealer vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 3s | 0.0/5 up, 3.4 dead | 5.0/5 up, 0.0 dead |
| 10 Genestealer vs 20 Astra Militarum Guardsman @30yd | A 38% B 59% draw 2% | 10s | 1.8/10 up, 0.7 dead | 7.8/20 up, 2.9 dead |
| 20 Hormagaunt vs 10 Astra Militarum Guardsman @20yd | A 17% B 80% draw 3% | 8s | 1.7/20 up, 5.0 dead | 6.0/10 up, 0.7 dead |
| 1 Carnifex vs 5 Astartes Battle-Brother @10yd | A 0% B 0% draw 100% | 60s | 1.0/1 up, 0.0 dead | 3.7/5 up, 0.0 dead |
| 1 Hive Tyrant vs 5 Astartes Battle-Brother @30yd | A 0% B 0% draw 100% | 60s | 1.0/1 up, 0.0 dead | 4.3/5 up, 0.0 dead |
| 3 Tyranid Warrior vs 5 Astartes Battle-Brother @30yd | A 0% B 100% draw 0% | 4s | 0.0/3 up, 1.8 dead | 5.0/5 up, 0.0 dead |
| 5 Astartes Battle-Brother vs 10 Necron Warrior @60yd | A 100% B 0% draw 0% | 20s | 4.9/5 up, 0.0 dead | 0.0/10 up, 1.9 dead |
| 5 Necron Immortal vs 5 Astartes Battle-Brother @60yd | A 6% B 45% draw 49% | 43s | 0.7/5 up, 0.4 dead | 3.7/5 up, 0.0 dead |
| 5 Lychguard vs 5 Astartes Battle-Brother @10yd | A 5% B 22% draw 73% | 53s | 1.4/5 up, 0.1 dead | 3.2/5 up, 0.0 dead |
| 10 Flayed One vs 10 Astra Militarum Guardsman @20yd | A 99% B 1% draw 0% | 18s | 6.8/10 up, 0.0 dead | 0.0/10 up, 1.0 dead |
| 3 Skorpekh Destroyer vs 5 Astartes Battle-Brother @15yd | A 28% B 19% draw 53% | 52s | 1.4/3 up, 0.0 dead | 1.8/5 up, 0.1 dead |
| 5 Aspect Warrior vs 10 Ork Boy @15yd | A 100% B 0% draw 0% | 10s | 5.0/5 up, 0.0 dead | 0.0/10 up, 0.3 dead |
| 1 Exarch vs 2 Astartes Battle-Brother @10yd | A 2% B 98% draw 0% | 3s | 0.0/1 up, 0.6 dead | 1.9/2 up, 0.0 dead |
| 10 Aeldari Guardian vs 10 Astra Militarum Guardsman @50yd | A 99% B 0% draw 0% | 3s | 9.3/10 up, 0.4 dead | 0.0/10 up, 7.7 dead |
| 10 Wych vs 10 Ork Boy @15yd | A 99% B 1% draw 0% | 7s | 8.6/10 up, 0.3 dead | 0.0/10 up, 0.6 dead |
| 5 Incubus vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 3s | 0.0/5 up, 3.6 dead | 5.0/5 up, 0.0 dead |
| 10 Kabalite Warrior vs 10 Fire Warrior (Shas'la) @100yd | A 7% B 91% draw 2% | 5s | 0.3/10 up, 6.4 dead | 5.9/10 up, 1.2 dead |
| 10 Fire Warrior (Shas'la) vs 5 Astartes Battle-Brother @150yd | A 0% B 99% draw 0% | 15s | 0.0/10 up, 7.6 dead | 4.3/5 up, 0.0 dead |
| 3 Battlesuit Pilot (Shas'vre) vs 20 Ork Boy @60yd | A 100% B 0% draw 0% | 7s | 3.0/3 up, 0.0 dead | 0.0/20 up, 6.5 dead |
| 10 Kroot Carnivore vs 10 Astra Militarum Guardsman @30yd | A 0% B 100% draw 0% | 2s | 0.0/10 up, 9.2 dead | 9.9/10 up, 0.0 dead |
| 3 Custodian Guardian vs 10 Astartes Battle-Brother @20yd | A 100% B 0% draw 0% | 23s | 3.0/3 up, 0.0 dead | 0.0/10 up, 2.5 dead |
| 5 Sister of Silence vs 10 Astra Militarum Guardsman @20yd | A 88% B 12% draw 0% | 16s | 2.7/5 up, 0.4 dead | 0.9/10 up, 2.1 dead |
| 10 Adepta Sororitas Battle Sister vs 15 Ork Boy @30yd | A 100% B 0% draw 0% | 6s | 10.0/10 up, 0.0 dead | 0.0/15 up, 3.7 dead |
| 10 Militarum Tempestus Scion vs 3 Astartes Battle-Brother @60yd | A 4% B 88% draw 7% | 20s | 0.4/10 up, 4.2 dead | 2.3/3 up, 0.0 dead |
| 5 Primaris Battle-Brother vs 5 Astartes Battle-Brother @60yd | A 17% B 0% draw 83% | 54s | 3.9/5 up, 0.0 dead | 1.6/5 up, 0.3 dead |
| 5 Sicarian Ruststalker vs 10 Astra Militarum Guardsman @15yd | A 100% B 0% draw 0% | 11s | 4.9/5 up, 0.0 dead | 0.0/10 up, 1.7 dead |
| 10 Skitarii Ranger vs 10 Aeldari Guardian @100yd | A 100% B 0% draw 0% | 7s | 10.0/10 up, 0.0 dead | 0.0/10 up, 2.9 dead |
| 10 Astra Militarum Guardsman vs 10 Kabalite Warrior @100yd | A 2% B 98% draw 0% | 3s | 0.1/10 up, 7.1 dead | 8.5/10 up, 0.7 dead |
| 10 Astra Militarum Guardsman vs 10 Fire Warrior (Shas'la) @150yd | A 0% B 100% draw 0% | 6s | 0.0/10 up, 5.7 dead | 9.1/10 up, 0.2 dead |
| 10 Astra Militarum Guardsman vs 10 Skitarii Ranger @100yd | A 0% B 100% draw 0% | 9s | 0.0/10 up, 2.2 dead | 9.5/10 up, 0.2 dead |
| 30 Astra Militarum Guardsman vs 5 Genestealer @30yd | A 100% B 0% draw 0% | 4s | 29.9/30 up, 0.1 dead | 0.0/5 up, 2.8 dead |
| 20 Astra Militarum Guardsman vs 20 Termagant @60yd | A 100% B 0% draw 0% | 3s | 20.0/20 up, 0.0 dead | 0.0/20 up, 11.5 dead |
| 10 Astra Militarum Guardsman vs 10 Necron Warrior @60yd | A 0% B 100% draw 0% | 9s | 0.0/10 up, 3.2 dead | 9.5/10 up, 0.0 dead |
| 1 Commissar vs 3 Ork Boy @10yd | A 11% B 89% draw 0% | 7s | 0.1/1 up, 0.2 dead | 2.1/3 up, 0.0 dead |
| 1 Inquisitor vs 2 Genestealer @10yd | A 39% B 60% draw 0% | 5s | 0.4/1 up, 0.3 dead | 1.0/2 up, 0.2 dead |
| 5 Adepta Sororitas Battle Sister vs 10 Wych @20yd | A 96% B 0% draw 4% | 10s | 5.0/5 up, 0.0 dead | 0.1/10 up, 6.7 dead |
| 10 Militarum Tempestus Scion vs 10 Kabalite Warrior @80yd | A 98% B 1% draw 1% | 8s | 8.2/10 up, 0.3 dead | 0.0/10 up, 5.5 dead |
| 5 Astartes Scout vs 10 Kroot Carnivore @80yd | A 98% B 1% draw 0% | 11s | 4.8/5 up, 0.0 dead | 0.1/10 up, 5.2 dead |
| 5 Astartes Battle-Brother vs 5 Aspect Warrior @40yd | A 100% B 0% draw 0% | 3s | 5.0/5 up, 0.0 dead | 0.0/5 up, 4.1 dead |
| 5 Astartes Battle-Brother vs 5 Incubus @30yd | A 100% B 0% draw 0% | 4s | 5.0/5 up, 0.0 dead | 0.0/5 up, 3.6 dead |
| 5 Astartes Battle-Brother vs 10 Flayed One @30yd | A 100% B 0% draw 0% | 11s | 5.0/5 up, 0.0 dead | 0.0/10 up, 4.1 dead |
| 1 Shield-Captain vs 1 Necron Overlord @10yd | A 100% B 0% draw 0% | 15s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.2 dead |
| 1 Custodian Guardian vs 3 Lychguard @10yd | A 90% B 3% draw 7% | 41s | 1.0/1 up, 0.0 dead | 0.2/3 up, 0.3 dead |
| 5 Sister of Silence vs 5 Aspect Warrior @15yd | A 30% B 70% draw 0% | 8s | 0.9/5 up, 0.9 dead | 2.5/5 up, 0.7 dead |
| 10 Skitarii Vanguard vs 15 Ork Boy @40yd | A 100% B 0% draw 0% | 7s | 10.0/10 up, 0.0 dead | 0.0/15 up, 2.8 dead |
| 10 Electro-Priest vs 10 Ork Boy @15yd | A 100% B 0% draw 0% | 10s | 9.7/10 up, 0.0 dead | 0.0/10 up, 0.6 dead |
| 5 Sicarian Ruststalker vs 5 Wych @15yd | A 100% B 0% draw 0% | 9s | 5.0/5 up, 0.0 dead | 0.0/5 up, 1.9 dead |
| 5 Ork Nob vs 5 Aspect Warrior @15yd | A 0% B 100% draw 0% | 23s | 0.0/5 up, 0.1 dead | 5.0/5 up, 0.0 dead |
| 3 Ork Meganob vs 1 Custodian Guardian @15yd | A 5% B 95% draw 0% | 22s | 0.1/3 up, 0.0 dead | 1.0/1 up, 0.0 dead |
| 1 Ork Warboss vs 1 Tyranid Warrior @10yd | A 100% B 0% draw 0% | 10s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.1 dead |
| 1 Ork Weirdboy vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% draw 0% | 2s | 0.0/1 up, 0.9 dead | 5.0/5 up, 0.0 dead |
| 20 Gretchin vs 5 Astra Militarum Guardsman @40yd | A 0% B 100% draw 0% | 6s | 0.0/20 up, 11.8 dead | 5.0/5 up, 0.0 dead |
| 1 Lictor vs 5 Astra Militarum Guardsman @10yd | A 100% B 0% draw 0% | 25s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.8 dead |
| 3 Ravener vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% draw 0% | 24s | 3.0/3 up, 0.0 dead | 0.0/10 up, 1.1 dead |
| 1 Zoanthrope vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% draw 0% | 3s | 0.0/1 up, 0.5 dead | 5.0/5 up, 0.0 dead |
| 1 Necron Overlord vs 3 Astartes Battle-Brother @20yd | A 9% B 84% draw 7% | 20s | 0.2/1 up, 0.0 dead | 2.5/3 up, 0.0 dead |
| 5 Deathmark vs 10 Astra Militarum Guardsman @150yd | A 100% B 0% draw 0% | 13s | 5.0/5 up, 0.0 dead | 0.0/10 up, 2.2 dead |
| 1 Cryptek vs 5 Ork Boy @20yd | A 58% B 0% draw 42% | 52s | 1.0/1 up, 0.0 dead | 0.9/5 up, 0.0 dead |
| 1 Autarch vs 3 Ork Nob @15yd | A 99% B 1% draw 0% | 25s | 1.0/1 up, 0.0 dead | 0.0/3 up, 0.0 dead |
| 1 Farseer vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% draw 0% | 2s | 0.0/1 up, 1.0 dead | 5.0/5 up, 0.0 dead |
| 5 Aeldari Ranger vs 10 Astra Militarum Guardsman @300yd | A 3% B 97% draw 0% | 7s | 0.0/5 up, 1.9 dead | 8.5/10 up, 0.2 dead |
| 1 Archon vs 2 Astartes Battle-Brother @15yd | A 2% B 98% draw 0% | 4s | 0.0/1 up, 0.8 dead | 1.9/2 up, 0.0 dead |
| 1 Succubus vs 2 Ork Nob @10yd | A 1% B 99% draw 0% | 17s | 0.0/1 up, 0.3 dead | 2.0/2 up, 0.0 dead |
| 5 Mandrake vs 10 Astra Militarum Guardsman @10yd | A 0% B 100% draw 0% | 4s | 0.0/5 up, 3.6 dead | 9.9/10 up, 0.0 dead |
| 5 Scourge vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% draw 0% | 3s | 0.0/5 up, 4.4 dead | 9.9/10 up, 0.0 dead |
| 1 Commander (Shas'o) vs 3 Astartes Battle-Brother @60yd | A 0% B 90% draw 10% | 14s | 0.1/1 up, 0.2 dead | 2.9/3 up, 0.0 dead |
| 10 Pathfinder vs 10 Ork Boy @60yd | A 100% B 0% draw 0% | 4s | 10.0/10 up, 0.0 dead | 0.0/10 up, 4.5 dead |
| 5 Vespid Stingwing vs 3 Astartes Battle-Brother @40yd | A 0% B 100% draw 0% | 4s | 0.0/5 up, 3.6 dead | 3.0/3 up, 0.0 dead |
| 4 Gun Drone vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% draw 0% | 4s | 0.0/4 up, 2.6 dead | 5.0/5 up, 0.0 dead |

## Revised Fractional Health

The user's wound rules: no HP pool; five boxes per level per location; a hit marks as many boxes of its level as its injury reaches on the sheet's 1-4 columns, spilling into the next level when a row is full. Unliving counts as ordinary Injury Tolerance, so Necrons can be stunned. Here "up" still counts models fighting and "dead" those killed outright; the rest were knocked out, broke, or collapsed in agony.

| Fight | Result | Length | Side A | Side B |
|---|---|---|---|---|
| 10 Astra Militarum Guardsman vs 10 Ork Boy @15yd | A 33% B 67% draw 0% | 15s | 2.6/10 up, 0.7 dead | 5.0/10 up, 0.3 dead |
| 20 Astra Militarum Guardsman vs 20 Ork Boy @40yd | A 100% B 0% draw 0% | 5s | 20.0/20 up, 0.0 dead | 0.0/20 up, 1.0 dead |
| 10 Ork Boy vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 6s | 0.0/10 up, 0.5 dead | 5.0/5 up, 0.0 dead |
| 5 Ork Nob vs 5 Astartes Battle-Brother @10yd | A 0% B 96% draw 4% | 28s | 0.1/5 up, 0.1 dead | 5.0/5 up, 0.0 dead |
| 1 Ork Warboss vs 3 Astartes Battle-Brother @10yd | A 5% B 81% draw 14% | 30s | 0.2/1 up, 0.0 dead | 2.7/3 up, 0.1 dead |
| 3 Ork Meganob vs 5 Astartes Battle-Brother @15yd | A 9% B 0% draw 91% | 59s | 3.0/3 up, 0.0 dead | 3.0/5 up, 0.4 dead |
| 5 Genestealer vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 2s | 0.0/5 up, 0.3 dead | 5.0/5 up, 0.0 dead |
| 10 Genestealer vs 20 Astra Militarum Guardsman @30yd | A 98% B 2% draw 0% | 8s | 8.4/10 up, 0.2 dead | 0.3/20 up, 0.9 dead |
| 20 Hormagaunt vs 10 Astra Militarum Guardsman @20yd | A 47% B 50% draw 3% | 7s | 6.0/20 up, 0.2 dead | 3.6/10 up, 0.6 dead |
| 1 Carnifex vs 5 Astartes Battle-Brother @10yd | A 0% B 0% draw 100% | 60s | 1.0/1 up, 0.0 dead | 4.8/5 up, 0.1 dead |
| 1 Hive Tyrant vs 5 Astartes Battle-Brother @30yd | A 0% B 0% draw 100% | 60s | 1.0/1 up, 0.0 dead | 4.9/5 up, 0.0 dead |
| 3 Tyranid Warrior vs 5 Astartes Battle-Brother @30yd | A 0% B 97% draw 3% | 11s | 0.0/3 up, 0.2 dead | 5.0/5 up, 0.0 dead |
| 5 Astartes Battle-Brother vs 10 Necron Warrior @60yd | A 41% B 0% draw 59% | 55s | 4.9/5 up, 0.0 dead | 2.2/10 up, 0.0 dead |
| 5 Necron Immortal vs 5 Astartes Battle-Brother @60yd | A 0% B 0% draw 100% | 60s | 4.4/5 up, 0.0 dead | 4.7/5 up, 0.2 dead |
| 5 Lychguard vs 5 Astartes Battle-Brother @10yd | A 0% B 0% draw 100% | 60s | 4.6/5 up, 0.0 dead | 4.4/5 up, 0.1 dead |
| 10 Flayed One vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% draw 0% | 14s | 9.8/10 up, 0.0 dead | 0.0/10 up, 0.7 dead |
| 3 Skorpekh Destroyer vs 5 Astartes Battle-Brother @15yd | A 13% B 0% draw 87% | 59s | 3.0/3 up, 0.0 dead | 2.8/5 up, 0.4 dead |
| 5 Aspect Warrior vs 10 Ork Boy @15yd | A 97% B 0% draw 3% | 34s | 4.8/5 up, 0.0 dead | 0.1/10 up, 0.1 dead |
| 1 Exarch vs 2 Astartes Battle-Brother @10yd | A 0% B 98% draw 2% | 4s | 0.0/1 up, 0.0 dead | 2.0/2 up, 0.0 dead |
| 10 Aeldari Guardian vs 10 Astra Militarum Guardsman @50yd | A 100% B 0% draw 0% | 2s | 9.8/10 up, 0.0 dead | 0.0/10 up, 0.8 dead |
| 10 Wych vs 10 Ork Boy @15yd | A 46% B 53% draw 1% | 16s | 3.4/10 up, 0.2 dead | 3.8/10 up, 0.1 dead |
| 5 Incubus vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 3s | 0.0/5 up, 0.3 dead | 5.0/5 up, 0.0 dead |
| 10 Kabalite Warrior vs 10 Fire Warrior (Shas'la) @100yd | A 8% B 91% draw 1% | 5s | 0.4/10 up, 0.3 dead | 6.7/10 up, 0.1 dead |
| 10 Fire Warrior (Shas'la) vs 5 Astartes Battle-Brother @150yd | A 0% B 100% draw 0% | 16s | 0.0/10 up, 0.3 dead | 4.7/5 up, 0.2 dead |
| 3 Battlesuit Pilot (Shas'vre) vs 20 Ork Boy @60yd | A 100% B 0% draw 0% | 8s | 3.0/3 up, 0.0 dead | 0.0/20 up, 1.3 dead |
| 10 Kroot Carnivore vs 10 Astra Militarum Guardsman @30yd | A 0% B 100% draw 0% | 2s | 0.0/10 up, 0.4 dead | 9.8/10 up, 0.0 dead |
| 3 Custodian Guardian vs 10 Astartes Battle-Brother @20yd | A 99% B 0% draw 1% | 39s | 3.0/3 up, 0.0 dead | 0.0/10 up, 2.1 dead |
| 5 Sister of Silence vs 10 Astra Militarum Guardsman @20yd | A 77% B 22% draw 1% | 17s | 2.4/5 up, 0.2 dead | 2.0/10 up, 0.3 dead |
| 10 Adepta Sororitas Battle Sister vs 15 Ork Boy @30yd | A 86% B 0% draw 14% | 15s | 10.0/10 up, 0.0 dead | 0.6/15 up, 0.8 dead |
| 10 Militarum Tempestus Scion vs 3 Astartes Battle-Brother @60yd | A 0% B 86% draw 14% | 22s | 0.5/10 up, 0.6 dead | 2.8/3 up, 0.1 dead |
| 5 Primaris Battle-Brother vs 5 Astartes Battle-Brother @60yd | A 0% B 0% draw 100% | 60s | 4.8/5 up, 0.1 dead | 4.2/5 up, 0.1 dead |
| 5 Sicarian Ruststalker vs 10 Astra Militarum Guardsman @15yd | A 100% B 0% draw 0% | 10s | 4.8/5 up, 0.0 dead | 0.0/10 up, 0.6 dead |
| 10 Skitarii Ranger vs 10 Aeldari Guardian @100yd | A 100% B 0% draw 0% | 5s | 10.0/10 up, 0.0 dead | 0.0/10 up, 0.1 dead |
| 10 Astra Militarum Guardsman vs 10 Kabalite Warrior @100yd | A 5% B 94% draw 1% | 3s | 0.2/10 up, 0.5 dead | 7.5/10 up, 0.0 dead |
| 10 Astra Militarum Guardsman vs 10 Fire Warrior (Shas'la) @150yd | A 0% B 99% draw 0% | 5s | 0.0/10 up, 0.4 dead | 8.6/10 up, 0.0 dead |
| 10 Astra Militarum Guardsman vs 10 Skitarii Ranger @100yd | A 0% B 100% draw 0% | 7s | 0.0/10 up, 0.6 dead | 9.5/10 up, 0.0 dead |
| 30 Astra Militarum Guardsman vs 5 Genestealer @30yd | A 100% B 0% draw 0% | 5s | 29.4/30 up, 0.0 dead | 0.0/5 up, 0.3 dead |
| 20 Astra Militarum Guardsman vs 20 Termagant @60yd | A 100% B 0% draw 0% | 2s | 20.0/20 up, 0.0 dead | 0.0/20 up, 0.4 dead |
| 10 Astra Militarum Guardsman vs 10 Necron Warrior @60yd | A 0% B 100% draw 0% | 8s | 0.0/10 up, 0.4 dead | 9.9/10 up, 0.0 dead |
| 1 Commissar vs 3 Ork Boy @10yd | A 1% B 99% draw 0% | 5s | 0.0/1 up, 0.1 dead | 2.7/3 up, 0.0 dead |
| 1 Inquisitor vs 2 Genestealer @10yd | A 31% B 68% draw 1% | 7s | 0.3/1 up, 0.1 dead | 1.2/2 up, 0.0 dead |
| 5 Adepta Sororitas Battle Sister vs 10 Wych @20yd | A 98% B 0% draw 2% | 7s | 5.0/5 up, 0.0 dead | 0.1/10 up, 0.3 dead |
| 10 Militarum Tempestus Scion vs 10 Kabalite Warrior @80yd | A 100% B 0% draw 0% | 7s | 9.3/10 up, 0.1 dead | 0.0/10 up, 0.2 dead |
| 5 Astartes Scout vs 10 Kroot Carnivore @80yd | A 99% B 0% draw 1% | 10s | 4.9/5 up, 0.0 dead | 0.0/10 up, 0.3 dead |
| 5 Astartes Battle-Brother vs 5 Aspect Warrior @40yd | A 100% B 0% draw 0% | 3s | 5.0/5 up, 0.0 dead | 0.0/5 up, 0.1 dead |
| 5 Astartes Battle-Brother vs 5 Incubus @30yd | A 100% B 0% draw 0% | 4s | 5.0/5 up, 0.0 dead | 0.0/5 up, 0.3 dead |
| 5 Astartes Battle-Brother vs 10 Flayed One @30yd | A 92% B 0% draw 8% | 32s | 5.0/5 up, 0.0 dead | 0.3/10 up, 0.0 dead |
| 1 Shield-Captain vs 1 Necron Overlord @10yd | A 100% B 0% draw 0% | 23s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.0 dead |
| 1 Custodian Guardian vs 3 Lychguard @10yd | A 7% B 0% draw 93% | 59s | 1.0/1 up, 0.0 dead | 2.2/3 up, 0.0 dead |
| 5 Sister of Silence vs 5 Aspect Warrior @15yd | A 34% B 66% draw 0% | 8s | 1.2/5 up, 0.2 dead | 2.6/5 up, 0.1 dead |
| 10 Skitarii Vanguard vs 15 Ork Boy @40yd | A 29% B 0% draw 71% | 44s | 9.8/10 up, 0.0 dead | 4.9/15 up, 0.6 dead |
| 10 Electro-Priest vs 10 Ork Boy @15yd | A 99% B 1% draw 0% | 17s | 9.2/10 up, 0.1 dead | 0.1/10 up, 0.4 dead |
| 5 Sicarian Ruststalker vs 5 Wych @15yd | A 100% B 0% draw 0% | 6s | 4.9/5 up, 0.0 dead | 0.0/5 up, 0.1 dead |
| 5 Ork Nob vs 5 Aspect Warrior @15yd | A 1% B 21% draw 78% | 58s | 2.9/5 up, 0.0 dead | 4.3/5 up, 0.0 dead |
| 3 Ork Meganob vs 1 Custodian Guardian @15yd | A 9% B 19% draw 73% | 55s | 1.8/3 up, 0.0 dead | 0.9/1 up, 0.1 dead |
| 1 Ork Warboss vs 1 Tyranid Warrior @10yd | A 97% B 0% draw 3% | 27s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.1 dead |
| 1 Ork Weirdboy vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% draw 0% | 2s | 0.0/1 up, 0.1 dead | 5.0/5 up, 0.0 dead |
| 20 Gretchin vs 5 Astra Militarum Guardsman @40yd | A 0% B 100% draw 0% | 5s | 0.0/20 up, 0.5 dead | 5.0/5 up, 0.0 dead |
| 1 Lictor vs 5 Astra Militarum Guardsman @10yd | A 100% B 0% draw 0% | 19s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.2 dead |
| 3 Ravener vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% draw 0% | 19s | 3.0/3 up, 0.0 dead | 0.0/10 up, 0.6 dead |
| 1 Zoanthrope vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% draw 0% | 6s | 0.0/1 up, 0.1 dead | 5.0/5 up, 0.0 dead |
| 1 Necron Overlord vs 3 Astartes Battle-Brother @20yd | A 1% B 5% draw 95% | 57s | 1.0/1 up, 0.0 dead | 2.6/3 up, 0.1 dead |
| 5 Deathmark vs 10 Astra Militarum Guardsman @150yd | A 100% B 0% draw 0% | 9s | 5.0/5 up, 0.0 dead | 0.0/10 up, 0.5 dead |
| 1 Cryptek vs 5 Ork Boy @20yd | A 1% B 0% draw 99% | 60s | 1.0/1 up, 0.0 dead | 4.3/5 up, 0.0 dead |
| 1 Autarch vs 3 Ork Nob @15yd | A 7% B 5% draw 88% | 58s | 1.0/1 up, 0.0 dead | 2.4/3 up, 0.0 dead |
| 1 Farseer vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% draw 0% | 2s | 0.0/1 up, 0.0 dead | 4.9/5 up, 0.0 dead |
| 5 Aeldari Ranger vs 10 Astra Militarum Guardsman @300yd | A 2% B 96% draw 2% | 7s | 0.0/5 up, 0.0 dead | 8.6/10 up, 0.1 dead |
| 1 Archon vs 2 Astartes Battle-Brother @15yd | A 1% B 98% draw 1% | 5s | 0.0/1 up, 0.1 dead | 1.9/2 up, 0.0 dead |
| 1 Succubus vs 2 Ork Nob @10yd | A 0% B 100% draw 0% | 11s | 0.0/1 up, 0.1 dead | 2.0/2 up, 0.0 dead |
| 5 Mandrake vs 10 Astra Militarum Guardsman @10yd | A 0% B 100% draw 0% | 3s | 0.0/5 up, 0.1 dead | 9.8/10 up, 0.0 dead |
| 5 Scourge vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% draw 0% | 2s | 0.0/5 up, 0.2 dead | 9.9/10 up, 0.0 dead |
| 1 Commander (Shas'o) vs 3 Astartes Battle-Brother @60yd | A 0% B 50% draw 50% | 34s | 0.5/1 up, 0.0 dead | 2.9/3 up, 0.0 dead |
| 10 Pathfinder vs 10 Ork Boy @60yd | A 100% B 0% draw 0% | 4s | 10.0/10 up, 0.0 dead | 0.0/10 up, 0.8 dead |
| 5 Vespid Stingwing vs 3 Astartes Battle-Brother @40yd | A 0% B 100% draw 0% | 4s | 0.0/5 up, 0.1 dead | 3.0/3 up, 0.0 dead |
| 4 Gun Drone vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% draw 0% | 3s | 0.0/4 up, 0.0 dead | 5.0/5 up, 0.0 dead |
