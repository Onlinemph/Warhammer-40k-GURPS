# Combat simulator

GURPS 4e combat on a hex map (1 yard per hex), second by second. `docs/simulator.md` is the rule list with Basic Set pages: facing and arcs, maneuvers chosen by an AI (Attack, Aim, Move and Attack, All-Out Attack and Defense, Feint, Rapid Strike, Ready, Change Posture, Concentrate), called shots, range and rapid fire, malfunctions, explosions, fragmentation and cones, Dodge, Parry and Block with retreat and shield DB, Dodge and Drop, cover and posture, armour divisors, Weak Points, regenerating shields, wounding and Injury Tolerance, follow-ups, crippling, knockback, bleeding, shock, stun, consciousness and death, Reanimation Protocols, morale, psychic powers and Perils, vehicles, and the user's Revised Fractional Health as an alternative wound system.

## Layout

The code is split into numbered parts that are joined in file-name order. `engine/` goes inside the `SIM` closure, which runs both in the page and under node. `page/` goes inside the page's closure, which is browser only. `assemble.js` does the joining for node, and `tools/build_site.py` does the same in Python when it inlines the simulator into `site/index.html`. A test checks that the two agree.

| Part | What's in it |
|---|---|
| `engine/10-rolls.js` | Dice, success rolls, damage notation, range, rate of fire, Progressive Recoil |
| `engine/20-units.js` | The data index, armour profiles, the ST damage table, building a unit or a vehicle from its template |
| `engine/30-wounds.js` | Wounding multipliers, Injury Tolerance, large-area injury, the hit location table |
| `engine/40-hexes-and-maps.js` | Hex geometry, facing arcs, the facility and ruins maps |
| `engine/45-aim-and-cover.js` | Called-shot penalties, chinks, cover DR and penalties |
| `engine/50-69-battle-*.js` | `runBattle`, one function split into sections: setup, terrain and sight, injury, defence, movement, attacks, maneuvers, the decision layer, vehicles, the AI's options, reactions, grappling, the turn loop |
| `engine/64-battle-flanking.js` | Fix and flank: the squads' plan on a big field (who holds as a base of fire, who goes round which end of the enemy line, by three legs) and the flanking soldier's option |
| `engine/90-api.js` | `monteCarlo` and what `SIM` exports, including `SIM.rules` for the tests |
| `page/10-picker-and-results.js` | The unit picker and the results charts |
| `page/20-tabletop-map.js` | Shared map palette and hex helpers for the replays |
| `page/30-37-view3d-*.js` | `makeView3D`, the three.js replay, split by section: scene, figures, models, battlefield scenery and sound from a local Dawn of War pack (optional, see `tools/dow/README.md`), effects, timeline and action camera plan, camera, posing, action camera, input |
| `page/40-table.js` | The 2D replay |
| `page/90-wire.js` | Wiring the page together |

`runBattle` and `makeView3D` are each one function whose body is split across several files. Their locals are shared closure state, so each part can use anything an earlier part declared. Those files aren't standalone modules. Splitting them for real would mean passing the battle state around as an explicit object, which is a bigger refactor than this split.

Under node, `require("tools/sim/load.js")` gives you `SIM`. Errors name the part file and line, for example `tools/sim/engine/55-battle-attacks.js:120`, not a line in the joined file.

## Commands

```sh
python3 tools/build_site.py                  # rebuild site/index.html (the tests read its data)
node --test tools/sim/test/rules.test.js     # rules assertions, under a second
node --test tools/sim/test/determinism.test.js   # golden battles and seeding, a few seconds
node tools/sim/test/smoke.js [name] [log]    # reference fights with win rates, about a minute
node tools/sim/assemble.js > /tmp/sim.js     # the joined simulator, to read or diff
```

`test/rules.test.js` checks the engine's tables and formulas against the Basic Set and the user's house rules: success rolls, damage notation, the ST damage table, range, rapid fire, Progressive Recoil, wounding and Injury Tolerance, and hit location. It also checks the data against the anchors in `docs/framework.md`: armour DR, weapon penetration percentages, the AV-to-DR table and vehicle HP. Finally it checks that a battle replays identically from its seed.

`test/determinism.test.js` replays a handful of seeded battles and compares each one's outcome and a hash of its full log with `test/golden.json`. A change that alters any of them fails. When that's intended (a rules fix, new AI behaviour), regenerate the file with `GOLDEN_UPDATE=1 node --test tools/sim/test/determinism.test.js` and commit it with the change, so the diff shows which battles moved.

## Randomness

There are two random streams. `R` rolls every die that decides what happens: to-hit, defences, damage, hit locations, morale. `AR` is the AI's own: the sample rolls behind its expected-injury estimates and its tie-breaks between equal choices. A change to how the AI estimates, or how many targets it looks at, therefore can't move a single real die. Both are `Math.random` until seeded. `SIM.seed(s)` seeds both, `runBattle(specs, { seed })` seeds a single battle so it plays the same whatever ran before it, and `monteCarlo` with a seed gives run `i` the seed `SIM.mixSeed(seed, i)`, so any run can be replayed alone. The result of `runBattle` carries the seed it was played from.

## Awareness

Each model weighs only the nearest few known foes (`scanOf` and `scanFoes` in `engine/51-battle-terrain.js`): 4 for line troops, 12 for leaders, snipers, anti-armour gunners, lone characters and vehicles, or whatever a spec's or AI profile's `scan` says. Targets, expected incoming fire, whether an Aim will last and the threat to it all come from that list, so a soldier's thinking costs the same in a battle of twenty or of a thousand. The battle result's roster shows each model's scan. Questions about neighbours (friends beside a target, how crowded a spot is, who a grenade would catch) read the occupancy map through `modelsNear` instead of scanning the army, and who is aiming at or holding a Wait on a foe is kept on the foe. When a test fails, the engine, the data or the doc has drifted, so fix whichever one is wrong.
