# Handoff: where the project is and how to work on it

Read this first. It covers what we're building, how the repository fits together, how to run and test each
piece, the rules the code depends on, and what's next. The full game vision is in `docs/mmo/design.md`; each
part also has its own README.

## What we're building

**A browser-first, turn-based MMO about a galactic war.** Players lead warbands. Every soldier is simulated with
GURPS 4th Edition combat rules, and the war keeps running whether players are online or not.

The setting will be the owner's own: original factions and units with a Warhammer 40k tone. The repository started
as GURPS conversions of 40k material, and those templates are still the combat stand-ins. **Don't chase exact 40k
mechanics.** The owner wants their own setting, and faction rules should live in the data, applied by the engine.

The repository has three layers, built on each other:

1. **The GURPS library** (`data/` → `Library/`): templates, traits, weapons and armour as YAML, compiled to GCS
   (GURPS Character Sheet) files. This is the source of every unit's stats.
2. **The combat simulator** (`tools/sim/`): a deterministic, second-by-second GURPS battle engine with AI, hex maps,
   morale and vehicles, plus a 2D/3D replay viewer in `site/index.html`.
3. **The war** (`game/`, `tools/resolver/`): the MMO's first playable loop. A galaxy with turns and warbands, an AI
   faction, battles resolved instantly by a calibrated model, and full engine replays on demand.

## Repository map

| Path | What it is |
| --- | --- |
| `docs/mmo/design.md` | The game design document and roadmap (the owner's spec) |
| `docs/simulator.md` | Every simulator rule, with Basic Set page references (the rules reference for the engine) |
| `docs/framework.md`, `docs/data-format.md` | Calibration anchors for the data, and the YAML field reference |
| `data/**/*.yaml` | Source of truth for units, traits, gear. `data/sim/` holds the simulator's AI profiles (`ai.yaml`), loadouts, squads |
| `Library/` | Generated GCS files (don't edit by hand) |
| `site/index.html` | Generated single-page site: the library browser and the simulator. **The engine and the resolver read their data from it** |
| `tools/build_gcs.py` | `data/` → `Library/` |
| `tools/build_site.py` | `Library/` + `tools/sim/` → `site/index.html` (also turns traits into simulator flags, see `combat_flags`) |
| `tools/sim/engine/*.js` | The engine, split into numbered parts joined in file-name order (`tools/sim/README.md` lists them) |
| `tools/sim/test/` | Rules tests, golden battles, resolver tests |
| `tools/resolver/` | The calibrated resolver: `calibrate.js`, `resolver.js`, `validate.js`, `table.json` |
| `game/` | The war server, rules, client and battle replays (`game/README.md`) |
| `deploy/`, `Dockerfile`, `fly.toml` | Deployment (`deploy/README.md`) |

## Running things

You need Node 22. Python 3 is only needed for the build scripts. There are no npm dependencies anywhere.

```sh
# after changing anything in data/: rebuild the library, then the site (the engine reads data from the site)
python3 tools/build_gcs.py
python3 tools/build_site.py           # also needed after any engine change: the site inlines the engine

# tests (run the files, not the directory: Node 22 rejects a directory argument)
node --test tools/sim/test/*.test.js  # rules, golden battles, determinism, resolver (~1-2 min)
node --test game/test/*.test.js       # the war: rules, server, replays (~5 s)

# the simulator in a browser: open site/index.html

# the war locally, with fast turns and a key to tick by hand
TURN_SECONDS=60 ADMIN_KEY=secret node game/server.js        # http://localhost:8080
curl -X POST -H "x-admin-key: secret" localhost:8080/api/admin/tick

# resolver
node tools/resolver/calibrate.js 24 4   # re-measure rates after engine changes (~3.5 min on 4 cores)
node tools/resolver/validate.js 30 16   # resolver against engine Monte Carlo
```

From node, `require("./tools/sim/load.js")` gives you `SIM`. See `tools/resolver/common.js` for loading the data
and building unit specs.

## The simulator: rules the code depends on

**Determinism is sacred.** A battle is stored as its seed plus the engine version, and replays re-run in whatever
browser opens them.
- **Two random streams.** `R` rolls every die that decides what happens. `AR` is the AI's own stream, for estimates
  and tie-breaks. Never use `R` for planning, or AI changes will shift real dice.
- **Seeding.** `SIM.seed(s)` seeds both streams. `runBattle(specs, { seed })` plays a battle the same way whatever
  ran before it. `monteCarlo` with a seed gives run `i` the seed `SIM.mixSeed(seed, i)`.
- **Deterministic maths only.** Don't call `Math.sin`, `exp`, `log`, `pow`, `atan2` or `hypot` in `tools/sim/engine/`;
  engines round them differently. Use the stand-ins in `engine/05-dmath.js` (`dsin`, `dexp`, `dlog`, `dpow`, `powi`,
  `hyp`, `ilog2`). A rules test fails otherwise.
- **Golden battles.** `tools/sim/test/golden.json` records the outcome and log hash of five seeded battles. If a
  change is *meant* to alter outcomes, regenerate with
  `GOLDEN_UPDATE=1 node --test tools/sim/test/determinism.test.js` and commit it with the change. If it isn't, a
  golden failure is a bug.
- **Prove "no behaviour change" claims.** For pure optimisations, compare log hashes on bigger battles before and
  after, using `git stash`. Several commits in the history do this.

**Scale.** The owner wants lots of soldiers. Each model weighs only its nearest foes:
- **Awareness tiers.** Line troops scan 4 foes. Leaders, snipers, anti-armour gunners, lone characters and vehicles
  scan 12. A spec or AI profile can set `scan`.
- **Avoid scanning the whole army** in anything per-model or per-hex. `modelsNear` reads the occupancy map or the
  spatial grid. Targets track who aims at them (`aimedBy`) and who waits on them (`openBy`). `sideWithin` uses
  per-turn sorted distances.
- **Measured speed.** Open ground, Guardsmen against Boyz: 100 a side takes about 0.9 s, and 500 a side about 14 s.
  On the 300-yard countryside, 200 a side takes about 40 s; line of sight is the remaining cost there.

**Big maps.** The `countryside` battlefield is 300 by 150 yards by default, set with `mapW` and `mapH`, and sides
deploy along their edges.
- **Walking distance.** On maps over 12,000 hexes the walking-distance field is capped at 48 movement points. Long
  marches steer for waypoints on a coarse grid of 8-yard cells.
- **Spotting** checks the nearest 24 foes plus up to 16 wide-awareness watchers.
- **Sight is shared across the whole side.** Knowledge is side-wide (`seenAt[side]`) for every army.

**The AI.** Each soldier picks options on one value scale (`engine/57-battle-decisions.js`). Above the soldiers,
each side has a **director** (`engine/64-battle-director.js`). Every 6 seconds it gives squads orders by need:
- **Fire:** focus on the enemy squad most worth killing; target weight scales with the faction's `focus`.
- **Assault:** melee squads route through ground the enemy can't see, using a threat map.
- **Support:** help a squad losing men or pinned.
- **Flank:** go round an enemy dug in behind cover.

The director is on by default on the countryside, and `director: true | false | [sideA, sideB]` overrides it. Its
measured gains are real for melee armies crossing open ground, and nil for rifle duels between equal forces.

**Synapse.** A Tyranid brood is linked when half its members are within a synapse creature's field (16 yards for a
Warrior or Zoanthrope, 32 for a Hive Tyrant). Linked broods get Fearlessness 5 and High Pain Threshold, and take
director orders; unlinked ones fight on instinct. Genestealers have the Independent Hunter trait: always linked.
This is data-driven, through the `synDisc`, `synapse` and `synIndep` flags.

**Perception floor.** Every template is at least Per 10. Tyranid hunters are Per 12, and Deathmarks are 12. This is
set in the data, at 5 points a level.

**Engine conventions.**
- **Shared closure.** `runBattle` is one function split across `engine/50-69-*.js`, so its locals are shared state.
- **Unit flags.** Each built unit gets its own copy of its template's flags, so the engine may change them during a
  battle (synapse does).
- **Battle results** carry `seed`, `tally` (standing per side, per second), `roster` (with `scan`, `start`) and
  units' `synapse`.
- **Progress.** `opt.onTurn(turn, maxTurns)` reports progress, which the replay loading bar uses.

## The resolver

`tools/resolver/resolver.js` predicts `{ pWinA, pWinB, pDraw, lossA, lossB, seconds }` in about 20 ms from
`table.json`. The table holds per-pair attrition rates, measured from 10-against-10 engine battles in the open. It
calls the favourite right in 28 of 30 unseen mixed battles, with about 11 points of error on win chance; close
fights are where it misses. Its duration estimate is poor. It covers open ground only. **Re-run `calibrate.js` after
engine changes that move results**, and add new unit types to `roster.json` first.

## The war (`game/`)

**The game is its event log.** `data/events.jsonl` holds only inputs: the war's creation, joins, orders, and ticks
with their seeds. `world/rules.js` rebuilds the state deterministically, and tests assert it. Never put derived
state or secrets in the log.
- **Galaxy.** 24 worlds in three sectors. The Hegemony and the Brawl are for players; the Chorus is the AI swarm.
  `world/units.js` gives each faction its own unit names over a combat template; that's the re-skin layer.
- **A tick** runs income, recruiting and moves, the Chorus AI, battles (through the resolver, with readable reports
  that keep their seed), captures, supply attrition, then local levies.
- **Server** (`server.js`): sign-in, join, view, orders and admin tick. The view is fog-filtered on the server.
  Players sign in with Discord or Google (`auth.js`: OAuth code flow with PKCE, a 30-day HttpOnly session cookie,
  one warband an account); accounts, sessions and development-join tokens are stored hashed in `data/`, never in
  the log. With no provider configured it falls back to the development join. It also serves `/healthz`, takes the client address from
  proxy headers under `TRUST_PROXY=1`, writes daily log backups, and stops cleanly on SIGTERM.
- **Replays** (`replay/build.js`, run on a worker thread). The full engine re-fights a report's armies on a
  countryside field sized to them. It tries up to four seeds until the engine's winner matches the war's result.
  Replays are cached gzipped in `data/replays/`. Player battles are queued at the tick; the client shows a loading
  bar, then a canvas player.
- **Client** (`public/`): an SVG galaxy map with labels that fit the screen, orders, reports with a Watch button,
  and news. It works on a phone.

## Deployment

The recommendation is Fly.io: one always-on machine with a volume, following `fly.toml` and `deploy/README.md`.
`deploy/docker-compose.yml` with Caddy runs on any VPS instead. The image was built and tested in Docker; `fly.toml`
itself hasn't been validated with flyctl. **Run exactly one server**, or the war forks.

## Owner's decisions so far

- Their own setting, not 40k accuracy. The placeholder factions come from the design doc: Hegemony, Apostates,
  Chorus, Dormant, Brawl, Last Court.
- Lots of soldiers. Keep recruiting cheap, and make the engine scale instead.
- Rank-and-file AI simplified (nearest foes). Specialists see more.
- A faction director gives orders by need. Soldiers keep their own tactics.
- Synapse for Tyranids. Genestealers independent. Perception at least 10-12 for low-IQ creatures.
- A loading screen is fine for big replays.

## What's next

1. **Deploy and run the closed test war** (roadmap step 4). Sign-in is in, tested against a stand-in provider but
   not yet against real Discord or Google: register the apps (`deploy/README.md`, Sign-in) and try both. Still
   needed: admin tools to pause, roll back a turn, and start a new war.
2. **Re-skin** `game/world/units.js` (and eventually the templates) to the owner's setting.
3. **Later, guided by the playtest:**
   - Live battles, the highlight feed, politics and contracts (design doc).
   - Resolver accuracy on close fights and terrain.
   - Sector splitting for huge replays.
   - Hooking the 3D viewer into war replays.
   - Per-squad knowledge, so vox-casters and synapse matter for what a side knows.

## Gotchas

- **Rebuild the site** (`python3 tools/build_site.py`) after engine or data changes. Tests and the resolver read
  `site/index.html`, and data changes need `build_gcs.py` first.
- **Run test files, not the directory.** `node --test <dir>` fails on Node 22.
- **Don't use `pkill -f` with a pattern** that appears in your own shell command; it kills the shell. Use
  `pgrep -f '^node game/server.js'` and `kill`.
- **Shut the server down in tests.** Server tests must call `stop()`, `server.closeAllConnections()` and
  `server.close()`, or the process hangs on the turn timer and the replay worker.
- **Memory on big maps.** Line-of-sight caches live with each map; only the map being fought over keeps its caches.
  Big Monte Carlos over many countryside maps peak around 1.1 GB.
- **Monte Carlo noise.** A 24-battle sample swung 5 wins on pure noise. Use 48 or more battles, or fresh seeds,
  before believing an AI improvement.

## Working style the owner likes

- Direct, plain writing; no hype words.
- Commit in coherent steps, with messages that say what changed, why, and what was measured.
- Measure claims: timings, Monte Carlo win rates, before and after. Report honestly when something didn't help.
  For example, flanking alone was neutral and focus fire showed nothing at 48 battles, and both were reported as such.
- Keep docs in step with code: `docs/simulator.md`, the READMEs, and `ai.yaml` comments.
