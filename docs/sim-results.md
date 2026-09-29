# Combat simulator results

Reference fights run with `tools/sim.js` against the current data: 300 battles each, morale on, default loadouts from `data/sim/loadouts.yaml`. Side A is listed first. "up" is models still fighting at the end; "dead" counts only models killed outright (the rest of the losses fell unconscious, phased out or fled).

Rerun after data changes to see what moved. The two scripts that produced this table live in the session scratchpad; `node tools/sim_test.js` runs a smaller set.

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
| 5 Astartes Battle-Brother vs 10 Necron Warrior @60yd | A 100% B 0% draw 0% | 19s | 5.0/5 up, 0.0 dead | 0.0/10 up, 2.1 dead |
| 5 Necron Immortal vs 5 Astartes Battle-Brother @60yd | A 2% B 45% draw 53% | 44s | 0.7/5 up, 0.4 dead | 3.8/5 up, 0.0 dead |
| 5 Lychguard vs 5 Astartes Battle-Brother @10yd | A 3% B 21% draw 76% | 53s | 1.3/5 up, 0.1 dead | 3.4/5 up, 0.0 dead |
| 10 Flayed One vs 10 Astra Militarum Guardsman @20yd | A 98% B 2% draw 0% | 19s | 6.5/10 up, 0.0 dead | 0.1/10 up, 0.9 dead |
| 3 Skorpekh Destroyer vs 5 Astartes Battle-Brother @15yd | A 28% B 18% draw 54% | 52s | 1.4/3 up, 0.0 dead | 1.8/5 up, 0.1 dead |
| 5 Aspect Warrior vs 10 Ork Boy @15yd | A 100% B 0% draw 0% | 10s | 5.0/5 up, 0.0 dead | 0.0/10 up, 0.3 dead |
| 1 Exarch vs 2 Astartes Battle-Brother @10yd | A 2% B 98% draw 0% | 3s | 0.0/1 up, 0.6 dead | 2.0/2 up, 0.0 dead |
| 10 Aeldari Guardian vs 10 Astra Militarum Guardsman @50yd | A 100% B 0% draw 0% | 3s | 9.5/10 up, 0.3 dead | 0.0/10 up, 8.0 dead |
| 10 Wych vs 10 Ork Boy @15yd | A 99% B 1% draw 0% | 7s | 8.8/10 up, 0.4 dead | 0.0/10 up, 0.6 dead |
| 5 Incubus vs 5 Astartes Battle-Brother @10yd | A 0% B 100% draw 0% | 4s | 0.0/5 up, 3.8 dead | 5.0/5 up, 0.0 dead |
| 10 Kabalite Warrior vs 10 Fire Warrior (Shas'la) @100yd | A 11% B 87% draw 1% | 5s | 0.5/10 up, 6.3 dead | 5.8/10 up, 1.3 dead |
| 10 Fire Warrior (Shas'la) vs 5 Astartes Battle-Brother @150yd | A 0% B 100% draw 0% | 15s | 0.0/10 up, 8.0 dead | 4.4/5 up, 0.1 dead |
| 3 Battlesuit Pilot (Shas'vre) vs 20 Ork Boy @60yd | A 100% B 0% draw 0% | 8s | 3.0/3 up, 0.0 dead | 0.0/20 up, 6.3 dead |
| 10 Kroot Carnivore vs 10 Astra Militarum Guardsman @30yd | A 0% B 100% draw 0% | 2s | 0.0/10 up, 9.3 dead | 9.9/10 up, 0.0 dead |
| 3 Custodian Guardian vs 10 Astartes Battle-Brother @20yd | A 100% B 0% draw 0% | 22s | 3.0/3 up, 0.0 dead | 0.0/10 up, 2.5 dead |
| 5 Sister of Silence vs 10 Astra Militarum Guardsman @20yd | A 88% B 12% draw 0% | 16s | 2.7/5 up, 0.4 dead | 0.9/10 up, 2.2 dead |
| 10 Adepta Sororitas Battle Sister vs 15 Ork Boy @30yd | A 100% B 0% draw 0% | 6s | 10.0/10 up, 0.0 dead | 0.0/15 up, 3.9 dead |
| 10 Militarum Tempestus Scion vs 3 Astartes Battle-Brother @60yd | A 4% B 86% draw 10% | 19s | 0.5/10 up, 4.3 dead | 2.4/3 up, 0.0 dead |
| 5 Primaris Battle-Brother vs 5 Astartes Battle-Brother @60yd | A 18% B 0% draw 82% | 54s | 3.8/5 up, 0.0 dead | 1.7/5 up, 0.3 dead |
| 5 Sicarian Ruststalker vs 10 Astra Militarum Guardsman @15yd | A 100% B 0% draw 0% | 12s | 4.9/5 up, 0.0 dead | 0.0/10 up, 1.7 dead |
| 10 Skitarii Ranger vs 10 Aeldari Guardian @100yd | A 100% B 0% draw 0% | 8s | 10.0/10 up, 0.0 dead | 0.0/10 up, 3.1 dead |
| 10 Astra Militarum Guardsman vs 10 Kabalite Warrior @100yd | A 2% B 98% draw 0% | 3s | 0.1/10 up, 7.1 dead | 8.5/10 up, 0.7 dead |
| 10 Astra Militarum Guardsman vs 10 Fire Warrior (Shas'la) @150yd | A 0% B 100% draw 0% | 6s | 0.0/10 up, 5.7 dead | 9.1/10 up, 0.2 dead |
| 10 Astra Militarum Guardsman vs 10 Skitarii Ranger @100yd | A 0% B 100% draw 0% | 9s | 0.0/10 up, 2.2 dead | 9.5/10 up, 0.2 dead |
| 30 Astra Militarum Guardsman vs 5 Genestealer @30yd | A 100% B 0% draw 0% | 4s | 29.9/30 up, 0.1 dead | 0.0/5 up, 2.8 dead |
| 20 Astra Militarum Guardsman vs 20 Termagant @60yd | A 100% B 0% draw 0% | 3s | 20.0/20 up, 0.0 dead | 0.0/20 up, 11.5 dead |
| 10 Astra Militarum Guardsman vs 10 Necron Warrior @60yd | A 1% B 99% draw 0% | 11s | 0.0/10 up, 2.8 dead | 8.9/10 up, 0.0 dead |
| 1 Commissar vs 3 Ork Boy @10yd | A 10% B 90% draw 0% | 8s | 0.1/1 up, 0.2 dead | 2.1/3 up, 0.0 dead |
| 1 Inquisitor vs 2 Genestealer @10yd | A 44% B 54% draw 1% | 5s | 0.4/1 up, 0.3 dead | 0.9/2 up, 0.2 dead |
| 5 Adepta Sororitas Battle Sister vs 10 Wych @20yd | A 95% B 0% draw 5% | 10s | 5.0/5 up, 0.0 dead | 0.1/10 up, 6.8 dead |
| 10 Militarum Tempestus Scion vs 10 Kabalite Warrior @80yd | A 98% B 1% draw 0% | 8s | 8.2/10 up, 0.2 dead | 0.1/10 up, 5.1 dead |
| 5 Astartes Scout vs 10 Kroot Carnivore @80yd | A 99% B 1% draw 0% | 11s | 4.9/5 up, 0.0 dead | 0.0/10 up, 5.3 dead |
| 5 Astartes Battle-Brother vs 5 Aspect Warrior @40yd | A 100% B 0% draw 0% | 3s | 5.0/5 up, 0.0 dead | 0.0/5 up, 4.0 dead |
| 5 Astartes Battle-Brother vs 5 Incubus @30yd | A 100% B 0% draw 0% | 4s | 5.0/5 up, 0.0 dead | 0.0/5 up, 3.6 dead |
| 5 Astartes Battle-Brother vs 10 Flayed One @30yd | A 100% B 0% draw 0% | 12s | 5.0/5 up, 0.0 dead | 0.0/10 up, 4.2 dead |
| 1 Shield-Captain vs 1 Necron Overlord @10yd | A 100% B 0% draw 0% | 14s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.1 dead |
| 1 Custodian Guardian vs 3 Lychguard @10yd | A 88% B 4% draw 8% | 42s | 1.0/1 up, 0.0 dead | 0.2/3 up, 0.2 dead |
| 5 Sister of Silence vs 5 Aspect Warrior @15yd | A 32% B 67% draw 0% | 8s | 1.0/5 up, 1.0 dead | 2.5/5 up, 0.7 dead |
| 10 Skitarii Vanguard vs 15 Ork Boy @40yd | A 100% B 0% draw 0% | 7s | 10.0/10 up, 0.0 dead | 0.0/15 up, 2.9 dead |
| 10 Electro-Priest vs 10 Ork Boy @15yd | A 100% B 0% draw 0% | 11s | 9.7/10 up, 0.1 dead | 0.0/10 up, 0.7 dead |
| 5 Sicarian Ruststalker vs 5 Wych @15yd | A 100% B 0% draw 0% | 8s | 5.0/5 up, 0.0 dead | 0.0/5 up, 1.7 dead |
| 5 Ork Nob vs 5 Aspect Warrior @15yd | A 0% B 100% draw 0% | 22s | 0.0/5 up, 0.1 dead | 5.0/5 up, 0.0 dead |
| 3 Ork Meganob vs 1 Custodian Guardian @15yd | A 5% B 95% draw 0% | 22s | 0.1/3 up, 0.0 dead | 0.9/1 up, 0.0 dead |
| 1 Ork Warboss vs 1 Tyranid Warrior @10yd | A 100% B 0% draw 0% | 10s | 1.0/1 up, 0.0 dead | 0.0/1 up, 0.1 dead |
| 1 Ork Weirdboy vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% draw 0% | 2s | 0.0/1 up, 0.9 dead | 5.0/5 up, 0.0 dead |
| 20 Gretchin vs 5 Astra Militarum Guardsman @40yd | A 0% B 100% draw 0% | 6s | 0.0/20 up, 11.7 dead | 5.0/5 up, 0.0 dead |
| 1 Lictor vs 5 Astra Militarum Guardsman @10yd | A 100% B 0% draw 0% | 24s | 1.0/1 up, 0.0 dead | 0.0/5 up, 0.8 dead |
| 3 Ravener vs 10 Astra Militarum Guardsman @20yd | A 100% B 0% draw 0% | 25s | 3.0/3 up, 0.0 dead | 0.0/10 up, 1.2 dead |
| 1 Zoanthrope vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% draw 0% | 3s | 0.0/1 up, 0.4 dead | 5.0/5 up, 0.0 dead |
| 1 Necron Overlord vs 3 Astartes Battle-Brother @20yd | A 8% B 85% draw 7% | 21s | 0.1/1 up, 0.0 dead | 2.5/3 up, 0.0 dead |
| 5 Deathmark vs 10 Astra Militarum Guardsman @150yd | A 100% B 0% draw 0% | 13s | 5.0/5 up, 0.0 dead | 0.0/10 up, 2.1 dead |
| 1 Cryptek vs 5 Ork Boy @20yd | A 62% B 0% draw 38% | 53s | 1.0/1 up, 0.0 dead | 0.9/5 up, 0.0 dead |
| 1 Autarch vs 3 Ork Nob @15yd | A 100% B 0% draw 0% | 24s | 1.0/1 up, 0.0 dead | 0.0/3 up, 0.0 dead |
| 1 Farseer vs 5 Astra Militarum Guardsman @20yd | A 0% B 100% draw 0% | 2s | 0.0/1 up, 1.0 dead | 5.0/5 up, 0.0 dead |
| 5 Aeldari Ranger vs 10 Astra Militarum Guardsman @300yd | A 2% B 98% draw 0% | 7s | 0.0/5 up, 1.9 dead | 8.6/10 up, 0.2 dead |
| 1 Archon vs 2 Astartes Battle-Brother @15yd | A 3% B 97% draw 0% | 4s | 0.0/1 up, 0.7 dead | 1.9/2 up, 0.0 dead |
| 1 Succubus vs 2 Ork Nob @10yd | A 2% B 98% draw 0% | 17s | 0.0/1 up, 0.2 dead | 1.9/2 up, 0.0 dead |
| 5 Mandrake vs 10 Astra Militarum Guardsman @10yd | A 0% B 100% draw 0% | 4s | 0.0/5 up, 3.4 dead | 9.9/10 up, 0.0 dead |
| 5 Scourge vs 10 Fire Warrior (Shas'la) @100yd | A 0% B 100% draw 0% | 3s | 0.0/5 up, 4.4 dead | 9.9/10 up, 0.0 dead |
| 1 Commander (Shas'o) vs 3 Astartes Battle-Brother @60yd | A 0% B 86% draw 14% | 16s | 0.1/1 up, 0.2 dead | 2.8/3 up, 0.0 dead |
| 10 Pathfinder vs 10 Ork Boy @60yd | A 100% B 0% draw 0% | 4s | 10.0/10 up, 0.0 dead | 0.0/10 up, 4.4 dead |
| 5 Vespid Stingwing vs 3 Astartes Battle-Brother @40yd | A 0% B 100% draw 0% | 4s | 0.0/5 up, 3.8 dead | 3.0/3 up, 0.0 dead |
| 4 Gun Drone vs 5 Astra Militarum Guardsman @60yd | A 0% B 100% draw 0% | 4s | 0.0/4 up, 2.6 dead | 5.0/5 up, 0.0 dead |

## Revised Fractional Health

The same engine with the user's Revised Fractional Health wound rules, under two readings of how repeated wounds stack (the rules don't say): five boxes per level before a wound steps up (as on the Fractional Health 40k sheet), and one box, so a second wound at a level counts one level higher. 300 battles each.

```
== standard
  10 Astra Militarum Guardsman vs 10 Ork Boy: A 97% B 3% draw 0% 10s
  5 Astartes Battle-Brother vs 10 Necron Warrior: A 100% B 0% draw 0% 20s
  5 Primaris Battle-Brother vs 5 Astartes Battle-Brother: A 12% B 0% draw 88% 57s
  3 Custodian Guardian vs 10 Astartes Battle-Brother: A 100% B 0% draw 0% 22s
  5 Ork Nob vs 5 Astartes Battle-Brother: A 0% B 100% draw 0% 6s
  5 Astartes Battle-Brother vs 10 Flayed One: A 100% B 0% draw 0% 11s
  10 Adepta Sororitas Battle Sister vs 15 Ork Boy: A 100% B 0% draw 0% 6s
  30 Astra Militarum Guardsman vs 5 Genestealer: A 100% B 0% draw 0% 4s
== frac 5 boxes
  10 Astra Militarum Guardsman vs 10 Ork Boy: A 20% B 79% draw 2% 18s
  5 Astartes Battle-Brother vs 10 Necron Warrior: A 0% B 0% draw 100% 60s
  5 Primaris Battle-Brother vs 5 Astartes Battle-Brother: A 1% B 0% draw 99% 60s
  3 Custodian Guardian vs 10 Astartes Battle-Brother: A 71% B 0% draw 29% 52s
  5 Ork Nob vs 5 Astartes Battle-Brother: A 0% B 27% draw 73% 52s
  5 Astartes Battle-Brother vs 10 Flayed One: A 6% B 0% draw 94% 59s
  10 Adepta Sororitas Battle Sister vs 15 Ork Boy: A 72% B 0% draw 28% 22s
  30 Astra Militarum Guardsman vs 5 Genestealer: A 50% B 48% draw 3% 19s
== frac 2 = next
  10 Astra Militarum Guardsman vs 10 Ork Boy: A 53% B 46% draw 1% 14s
  5 Astartes Battle-Brother vs 10 Necron Warrior: A 87% B 0% draw 13% 45s
  5 Primaris Battle-Brother vs 5 Astartes Battle-Brother: A 0% B 0% draw 100% 60s
  3 Custodian Guardian vs 10 Astartes Battle-Brother: A 100% B 0% draw 0% 33s
  5 Ork Nob vs 5 Astartes Battle-Brother: A 0% B 100% draw 0% 8s
  5 Astartes Battle-Brother vs 10 Flayed One: A 100% B 0% draw 0% 21s
  10 Adepta Sororitas Battle Sister vs 15 Ork Boy: A 99% B 0% draw 1% 6s
  30 Astra Militarum Guardsman vs 5 Genestealer: A 100% B 0% draw 0% 2s
```
