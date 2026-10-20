# Galactic War: the war server

The first playable loop of the MMO in `docs/mmo/design.md` (roadmap steps 2 and 3): a small galaxy, warbands,
12-hour turns, battles fought by the calibrated resolver (`tools/resolver`), and one AI faction. Node 22, no
dependencies.

```sh
node game/server.js                                   # http://localhost:8080, a tick every 12 hours
TURN_SECONDS=60 ADMIN_KEY=secret node game/server.js  # fast turns for testing (development join, no sign-in)
curl -X POST -H "x-admin-key: secret" localhost:8080/api/admin/tick   # tick now
node --test game/test/*.test.js
```

**The war.** 24 worlds in three sectors joined by lanes, in the setting of `docs/setting.md`. The Hegemony starts
in the far west with the Apostates beside it, the Brawl in the east (all three for players), the Chorus (an AI
swarm) in the middle, the Dormant (AI) asleep in three tomb worlds, and local defence on the rest. Each world's type
sets what it yields each turn: manpower, materiel (the Chorus turns both into biomass; the Dormant take nothing,
since they never recruit). Players join one of the player factions and lead a warband from its capital.

**A turn.** Orders are in any time before the tick: move one jump (or gate to gate), recruit at your own worlds
from your share of the faction's stockpile, raise a world's walls, hold a ritual (the Apostates). Standing orders
carry over: a stance (*advance*; *fortify*, stay put and fight at x1.5 on your own world; *raid*, strike a world,
loot three turns of its yield and come home without taking it) and *turn back* (call a move off at the tick if the
odds there are under 25%). Walls give a world's holder +25% a level, two levels (20 and 40 materiel), and lose a
level when the world is taken or raided. The move list shows the odds against the strongest force seen at each
world; reports give the odds each battle was fought at. At the tick, in order: income; recruiting and movement; the Chorus breeds broods and sends
swarms at whatever next door it can beat, and awake Dormant tombs march on a neighbour they are sure of; battles wherever two factions meet (the resolver gives the odds and
expected losses, the tick's dice decide; a fortress world favours its holder; the beaten fall back to a friendly
world next door or are destroyed); worlds held by one faction's forces alone change hands; warbands out of supply
(not on or next to a world joined to their capital through their own) lose a tenth of their men; supplied worlds
raise a couple of local levies.

**The log is the game.** `data/events.jsonl` holds only the inputs: the war's creation, joins, orders and ticks
with their random seeds. The state is rebuilt from it on start and the same log always rebuilds the same war
(tested), which is what rollbacks, audits and the warband histories come from. Each battle report keeps its seed
for a full engine replay later. Accounts and sessions (`data/accounts.json`, `data/sessions.json`) and development
tokens (`data/tokens.json`) are kept hashed beside it, never in the log.

**Accounts** (`auth.js`). Players sign in with Discord or Google (OAuth code flow with PKCE) and get a 30-day session
cookie; the warband belongs to the account, one a war. Which providers are offered depends on which have a client
id and secret set (`deploy/README.md`, Sign-in). With none set, the server falls back to the development join (a
name and a token kept in that browser), which `ALLOW_DEV_JOIN=1` keeps alongside sign-in for testing.

**Watching a battle.** Every battle report has a Watch button. The full engine re-fights it on a worker thread
(`replay/build.js`): the same armies on a countryside field sized to them, with seeds drawn from the report's until
the engine's winner agrees with the war's result (up to four tries; if none does, the replay says so). Battles a
player fought in are queued the moment their tick publishes, so most are ready before anyone opens them; any
other is queued when someone asks. While it runs the player sees a loading screen with the second the engine has
reached; the finished replay is kept gzipped in `data/replays/` and served instantly from then on. The player
draws the field once and moves the soldiers smoothly between seconds, with each second's shots, blows and blasts,
play, pause, scrub and speed.

**Running a war** (`ADMIN_KEY` set). Open the page once with `?admin=<ADMIN_KEY>` for the admin panel (kept for
that tab only): tick now, pause and resume (a resume gives a full turn), roll back the last turn (its battles and
the orders given since go; joins stay; the removed events are kept in `data/rolledback/`), and start a new war (the
old log, replays and tokens go to `data/archive/war-<when>/`; accounts are freed to join again). Every action is in
`data/admin-log.jsonl`, and the players' news says when the war is paused, resumed or rolled back. The same actions
are `/api/admin/<action>` with the `x-admin-key` header. For a playtest, `BOTS=2` adds two scripted warbands to
each player faction.

**What a player sees** is filtered on the server: the map and who holds each world are public; armies only where
their faction has eyes (its worlds, its warbands, and one jump from either).

**Each faction's own rules** (`world/factions.js`, `docs/setting.md`): Hegemony loyalty, edicts and Wardens grown
only on long-held worlds; Apostate captives, rituals (Summoning, Corruption) and deserting Levies; Brawl fame,
growth and infighting; the Chorus eating the dead and infesting; the Dormant's gates. They run at the tick from the
log like everything else; per-tick scratch (where battles were, how many died) stays off the state.

**The setting layer.** `world/units.js` gives each faction its own units on top of a combat template, from
`docs/setting.md`; renaming there re-skins the war without touching the GURPS data. Each unit's `power` is a rough
worth in Levies for the AI's sums; the resolver does the real reckoning.

Not yet: speculative compute, order cutoff, live battles, a 3D replay, highlight feed, politics and contracts, ship travel styles per faction, multiple wars.
