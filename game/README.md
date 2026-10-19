# Galactic War: the war server

The first playable loop of the MMO in `docs/mmo/design.md` (roadmap steps 2 and 3): a small galaxy, warbands,
12-hour turns, battles fought by the calibrated resolver (`tools/resolver`), and one AI faction. Node 22, no
dependencies.

```sh
node game/server.js                                   # http://localhost:8080, a tick every 12 hours
TURN_SECONDS=60 ADMIN_KEY=secret node game/server.js  # fast turns for testing
curl -X POST -H "x-admin-key: secret" localhost:8080/api/admin/tick   # tick now
node --test game/test/*.test.js
```

**The war.** 24 worlds in three sectors joined by lanes. The Hegemony starts in the west, the Brawl in the east
(both for players), the Chorus (an AI swarm) in the middle, militia on the rest. Each world's type sets what it
yields each turn: manpower, materiel (the Chorus turns both into biomass). Players join one of the two player
factions and lead a warband from its capital.

**A turn.** Orders are in any time before the tick: move one jump, and recruit at your own worlds from the
faction's stockpile. At the tick, in order: income; recruiting and movement; the Chorus breeds broods and sends
swarms at whatever next door it can beat; battles wherever two factions meet (the resolver gives the odds and
expected losses, the tick's dice decide; a fortress world favours its holder; the beaten fall back to a friendly
world next door or are destroyed); worlds held by one faction's forces alone change hands; warbands out of supply
(not on or next to a world joined to their capital through their own) lose a tenth of their men; supplied worlds
raise a couple of local levies.

**The log is the game.** `data/events.jsonl` holds only the inputs: the war's creation, joins, orders and ticks
with their random seeds. The state is rebuilt from it on start and the same log always rebuilds the same war
(tested), which is what rollbacks, audits and the warband histories come from. Each battle report keeps its seed
for a full engine replay later. Player tokens are stored hashed in `data/tokens.json`, never in the log.

**What a player sees** is filtered on the server: the map and who holds each world are public; armies only where
their faction has eyes (its worlds, its warbands, and one jump from either).

**The setting layer.** `world/units.js` gives each faction its own unit names on top of a combat template; renaming
there re-skins the war without touching the GURPS data.

Not yet: speculative compute, order cutoff, live battles, highlight feed, politics and contracts, real
authentication (the join is a dev login), ship travel styles per faction, multiple wars.
