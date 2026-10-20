# Galactic War MMO: Design Document

Oct 19, 2026 · @Michael

## Overview and pillars

A browser-first, turn-based MMO where thousands of players lead warbands in a grimdark galactic war, and every soldier on every side is individually simulated with GURPS-derived combat. The setting is original: it shares the tone and battlefield roles of Warhammer 40k but uses its own factions, names and history.

The players are warband leaders. Their soldiers are NPCs who gain experience, get scarred, form friendships and die, and the game records all of it. The war runs whether players are online or not, with AI forces filling every gap.

1. Stories nobody wrote. Every system feeds emergent narrative: soldier biographies, last letters, highlight replays, a chronicle written by the winners.
2. Every scale is real. A million-soldier campaign and a knife fight in a hive tunnel come from the same simulation, and players can zoom from one to the other.
3. Players decide, the sim executes. Strategy, doctrine and politics are player choices; the engine and AI carry them out, so nobody needs to micromanage.
4. Respect players' time. Twelve-hour turns, standing orders and doctrine mean nobody loses for sleeping.
5. Never sell power. Losing a veteran must always be the war's fault, never someone else's wallet.

Development is solo with Claude Code, starting from the existing combat engine at github.com/Onlinemph/warhammer-40k-gurps.

## Factions

Six factions, each keeping a familiar battlefield role but fighting for a different reason. The rule for every faction: its unique mechanics change how the strategic war plays, not just its unit stats. Names are placeholders.

| Faction | Role it fills | Core twist | Strategic mechanics |
| --- | --- | --- | --- |
| The Hegemony | Imperium, with Wardens (super-soldiers) and levies (guard) | A decaying empire obeying sealed edicts left by a founder dead for millennia | Edicts become server-wide war goals; Wardens are grown only from long-held worlds and mutate as they age; levy regiments carry their homeworld's traits |
| The Apostates | Chaos | Hegemony humans who opened a forbidden edict early and now serve the Hosts, rival entities from beyond reality | Captives as currency; slow, visible rituals; random patron gifts instead of training (too many = mindless spawn); recruit by turning suffering Hegemony regiments; leaders can ascend |
| The Chorus | Tyranids, Zerg, Dead Space necromorphs | One intelligence spreading by infection, reshaping the dead, speaking with absorbed voices; capable of diplomacy | The dead on fields it holds become reinforcements; absorbing a named veteran gains his skills; honours deals with alien terms; no morale |
| The Dormant | Necrons | The galaxy's previous rulers, archived in tomb-worlds and waking sector by sector | Fixed population for the whole war; repair the fallen on fields they hold; a gate network others can capture; insane tombs as rogue AI threats |
| The Brawl | Orks | A brute species treating war as spectator sport | Recruit from fame by fighting famous enemies; peace causes civil war; soldiers physically grow with experience |
| The Last Court | Space elves | An ancient, dying race hunting a catastrophe they caused (possibly the Chorus) | Tiny numbers, elite soldiers; farseer visions; hidden travel paths; every death is a disaster |

Each faction also chooses leaders differently: Hegemony votes plus appointment, Apostate patron favour or sanctioned betrayal, Brawl fame and challenges, Chorus influence by biomass fed, Dormant fixed ancient hierarchy, Last Court council of proven seers.

Farseer visions: after orders lock, a farseer sees N possible versions of a battle (N scales with skill, two to four), simulated with different seeds against the enemy's final orders, and picks which becomes real. Visions are blurry for weaker seers, cost fatigue, and are contested by enemy psykers. A live enemy commander can try to break a foreseen battle with a Quick Contest of Will against the farseer.

To keep it legally distinct: no Games Workshop names, iconography or terms (melta, warp, aquila, the four gods). The combat library's YAML data gets re-skinned onto these factions.

## Turn structure

One turn every 12 real hours represents one week of game time. A war of four to six real weeks is 55 to 85 turns, roughly a year or more of game time, after which the map resets and warbands, veterans and relics carry over.

1. Orders open. Players submit and revise orders any time. Standing orders and doctrine cover anything unexpected.
2. Speculative compute. Once every input to a battle (both sides plus possible reinforcements) has been unchanged for 30 minutes, the server runs it in the background and caches the result under a fingerprint of its inputs. A changed order reruns only the battles that depend on it. Nothing about a cached result is visible early, including timing.
3. Order cutoff, about one hour before the tick. Orders lock and remaining battles resolve.
4. Farseer phase. Last Court seers view visions built from the locked orders and choose; offline seers pick by doctrine.
5. Tick. Results, replays and highlights publish simultaneously for everyone.
6. Live battle window. Battles declared at the tick can be fought live by either commander until the next tick; otherwise doctrine and AI resolve them.

Battle seeds come from a secure random source on the server at lock time and are revealed only with the replay. The engine is public and deterministic, so a predictable seed would let anyone rehearse battles at home.

Tick times should be tolerable for every expected region and can rotate each war. Engaged players fill the time between ticks with live battles, contracts, politics, logistics and the highlight feed.

## Combat

All combat runs on the existing GURPS-based engine: second-by-second, hex maps, AI-chosen maneuvers, active defences, hit locations, morale, vehicles and psychic powers, with a 3D replay. It is deterministic under a seed and passes its 18 rules tests.

Measured speed today, one core, Guardsmen against Ork Boyz:

| Soldiers per side | Time per battle |
| --- | --- |
| 10 | 0.15 to 0.25 s |
| 30 | 0.8 to 1 s |
| 100 | about 5 s |
| 200 | about 25 s |

Time grows roughly with the square of battle size because each soldier's AI weighs every target. Profiling shows about 40% of time in the expected-injury estimate (`expInj`), which rolls each weapon 20 times per target and location and is rebuilt every battle, and about 30% in the decision layer.

How battles scale:

1. Sectors. Large battles are split into sectors of up to 500 per side, run in parallel on worker cores. A light layer connects them: reserves, artillery, orbital fire and morale collapse spreading along the front.
2. WWI-style campaigns. A planetary campaign can hold millions of soldiers over many turns, but each turn only the active sectors are fully simulated. Quiet sectors take abstract attrition; reserves wait until committed.
3. Calibrated resolver. Thousands of Monte Carlo runs across matchups, ranges and terrain fit a fast model (win odds, casualties, duration) used for faceless fights. When a player zooms into one, the full engine runs with a seed chosen to match the abstract result.

Estimated after optimisation: a 1,000,000-soldier battle is about 1,000 sectors, roughly 1.5 to 3 CPU-hours, so 10 to 20 minutes on one 8-core server. This needs benchmarking.

Space combat uses GURPS spaceship mechanics: range bands, contested Piloting, Gunner rolls, ships built from systems in sections, system damage. Ships need size tables extended for kilometre-long cruisers, and big fleet battles use the same tiering as ground combat. Boarding actions run the ground engine inside the ship using hulk maps, and the result (capture, sabotage, repelled) feeds back to the ship fight.

Replays store the seed, full starting-state snapshot (every unit's stats as they were), player orders and the engine's git commit hash. Old engine versions stay bundled and load on demand in the browser. A set of golden battles is re-run against their recorded engines on every change to catch determinism breaks.

The highlight feed scores each battle from its event log (upsets against predicted odds, close finishes, comebacks, named-character feats, last stands, unusual events, strategic weight) and shows each faction its top 10 per turn, spread across fronts, plus a personal feed for its own warbands and followed soldiers. Highlights are shareable, and upvotes tune the weights.

## Soldiers and leaders

Every soldier exists, but most cost almost nothing until they matter. Soldiers are tracked in three tiers:

1. Faceless mass. A regiment is a few numbers: headcount, average skill, morale, equipment, casualties.
2. Looked-at soldiers. When someone zooms in, soldiers are generated from a seed of regiment ID plus slot number, so name, homeworld and face are rebuilt identically every time and never stored. Deaths are recorded by slot.
3. Named characters. A soldier who does something notable (survives many battles, gets promoted, kills a tank) gets a database record and an event timeline, with a backstory filled in from the regiment's real war history. Players can mark soldiers to track from day one.

Named soldiers spend XP automatically based on what they actually did: shooters raise Guns and Perception, melee survivors raise blade skills and HT, barrage survivors gain Hard to Kill. Warband training doctrine nudges it. High skill turns into Deceptive Attacks, chink shots and Rapid Strikes, which is what makes veterans terrifying.

Survival has costs: lasting injuries, crude augmetics, and combat-earned disadvantages (Flashbacks, Bloodlust, Berserk). Soldiers form friendships and rivalries; a friend's death affects morale and target choice. Veterans can retire as drill instructors or governors. A named soldier's death produces a short last letter home from his biography.

When a side holds the field, its medics recover some downed soldiers; losing the field means losing your wounded, who may become captives.

The player is the warband's leader, a real character on the battlefield. Before battle, opposing leaders roll a Quick Contest of Strategy or Tactics; the margin buys advantages such as time of day, terrain, first volley or an ambush. Leadership adds to morale and Fright Checks. Leaders gain XP from battles they command and are high-value targets. If a leader dies, the player picks a successor from the warband's named survivors.

Player choice comes in three layers: strategic (deployment, objectives, spending), doctrine before battle (aggression, retreat threshold, target priority, protect the leader), and live play when online (control the leader, give squad orders).

## Logistics, travel and economy

The economy stays small; logistics is where the war is won. Three shared resources plus one per faction:

| Resource | Source | Used for |
| --- | --- | --- |
| Manpower | Population of held worlds | Recruits, levies, ship crews |
| Materiel | Forge and industrial worlds | Weapons, armour, vehicles, ships, ammunition |
| Supply | Produced, then physically moved along routes | Keeping armies fed, armed and healing |
| Faction currency | Captives (Apostates), corpses (Chorus), fame (Brawl), repair stock (Dormant), world loyalty (Hegemony), seer insight (Last Court) | Faction-specific mechanics |

Under-supplied armies deploy with fewer magazines (the engine already counts them), suffer morale penalties and heal slower. Raiding and escorting convoys gives small and new warbands a real way to matter.

Each faction travels differently: Hegemony beacon routes (reliable, predictable, beacons can be destroyed), Dormant gates (instant, capturable), Chorus slow drift preceded by infected ships, Brawl fast reckless jumps that land near the target, Last Court hidden paths, Apostate ritual shortcuts paid in captives. Orbit control decides ground wars: bombardment, reinforcement, evacuation and supply. A blockaded world starves.

No open player market at launch. Faction stockpiles are requisitioned by warbands, with priority set by elected leaders. Warbands keep their soldiers, a small treasury and relic gear, which carries its own history. War destroys materiel, so the economy has a built-in sink, and it resets with each war.

## Politics, roleplay and events

Players run their factions. Elected ranks command NPC regiments and set stockpile priorities; they never force other players to obey.

Ranks are voted on, with votes weighted by service in the current war rather than one account, one vote. Candidates need time served and battles commanded. Recall votes exist, ranks expire with each war, and an inactive leader's regiments fall back to AI doctrine. Every order and stockpile decision is logged where the faction can see it.

Orders are binding contracts. The reward is taken from the commander's allocation into escrow when the order is posted and paid automatically on verified completion. Only verifiable orders qualify: hold a system or route for N turns, deliver supply, destroy or capture a target, escort a convoy, rescue a named captive. Contracts can be exclusive or open bounties, pay partially for partial completion, and compensate the taker if cancelled. Both sides carry visible reputations. Mercenary warbands live on contracts.

Traitors are a sanctioned mechanic. A struggling Hegemony commander can secretly accept a pact, keep his rank, and pursue hidden objectives for gifts. Corruption leaves tells (mutations under inspection, odd morale events, canary-trap leaks). At the reveal his named soldiers each roll Will to follow or mutiny. Caught early, he is purged. Damage scales with rank, traitors per faction are capped, and new accounts can neither be tempted nor accused. Double agents and Chorus sleeper infections work the same way.

Counterintelligence is gameplay: canary traps showing different plan details to different groups, decoy orders, an elected investigator role, faction exile votes with evidence and appeals, and official espionage (infiltrators, intercepts, interrogated officers).

More roleplay systems:

- Reputations from deeds (a butcher gets no surrenders but frightens his own levies into holding).
- Captive treatment for every faction: execute, ransom, exchange or recruit.
- Propaganda feeds that spin the same events per faction, with a player propaganda officer role.
- Formal duels between commanders, fought on the engine.
- The winners write history: the war's chronicle, edited by the victors, becomes the next war's lore intro.

Random events come from world state: starving blockaded worlds riot, ritual sites draw Host activity, corpse-heavy hive worlds risk Chorus outbreaks, overextended empires face rebellions, and derelicts and stirring tombs offer opportunities. GM events use the Hegemony edicts and AI factions to drive storylines. GMs never play a faction, never target one side, and every GM action is logged.

## Architecture, security and engine work

Four services around an append-only event log. Each piece is a standard pattern; the difficulty is in how they interact.

1. World service: holds the galaxy, validates orders, runs movement and the strategic tick.
2. Battle workers: pull battle jobs from a queue and run the headless engine. Battles are independent, so they spread across cores; the fleet scales up for big wars.
3. Replay storage: seed, starting snapshot, orders and engine version per battle.
4. Web client: sends orders and plays replays; never holds hidden information.

&#91;embedded content: service architecture · 4 services and the event log\]

Orders go into the world service, battles fan out to workers, and everything both produce lands in the event log and replay storage.

Every order and result is stored in the event log, and current state is built from it. That gives soldier biographies their history, allows rollbacks after exploits, feeds the balance dashboard, and makes admin actions auditable.

Engine changes before the MMO uses it:

- [ ] Per-battle seeded random generator (today one shared generator defaults to Math.random, and monteCarlo seeds it once, so each battle depends on the ones before)
- [ ] Separate random generator for AI estimates, so AI changes don't alter real dice
- [ ] Precompute expected injury per weapon, template and location at startup
- [ ] Limit each soldier's target evaluation to the nearest few enemies
- [ ] Larger battlefields (hundreds of yards) and AI that handles flanking at that size
- [ ] Check trig and other functions that can differ between JavaScript engines
- [ ] Golden-battle determinism tests
- [ ] Benchmark a 500-per-side sector before and after
- [ ] Re-skin the YAML data to the new factions; drop the Dawn of War asset pipeline from anything shipped

Security: fog of war filtered on the server, every order validated server-side, proven authentication (Steam or a standard provider) with two-factor required for high ranks, DDoS protection and rate limiting, secrets kept out of code, least-privilege service access, admin actions logged, and a professional penetration test before launch. Multiboxing is handled by paid accounts, no transfers between warbands, influence growing with account age, trust tiers on faction plans, a one-person-one-faction-per-war rule, and detection from payment, device, IP and order-timing signals.

## Business, launch and population

A cheap subscription plus a limited free tier, with cosmetics on the side, and never any power for money.

The subscription (around $8 to $10 a month) covers servers and makes every alt a paying account. Free players can join a faction and fight with a small warband, but can't lead politics, run rituals or use seer visions. Cosmetics show where players share things: heraldry, colour schemes, leader portraits and banners on replays and biographies. Development is funded by Kickstarter or Patreon with founder packs and access to test wars.

Running costs are low. One 8-core worker clears very roughly 200,000 of today's small battles an hour, replays store as seeds, and early test wars should cost tens of dollars a month, low hundreds at a few thousand players. The real costs are art for original models, Steam's 30% and card fees of about 3%, legal basics (company, trademark search, terms of service), DDoS protection, backups and monitoring.

Launch path: web-first test wars, a Steam Coming Soon page early to gather wishlists ($100 Steam Direct fee), then Steam Early Access once a full war loop holds players, with the web client wrapped in Electron or Tauri and shared accounts. Launch only when a war can be filled; AI factions cover dips.

Faction population balance: strength comes from territory, supply and AI forces, not headcount, so a crowded faction gets more decision-makers rather than a bigger army. Add population caps, underdog bonuses (recruitment, supply, XP), faction lock per war with carry-over only within a faction, prestige for fighting outnumbered, lore-small elite factions, and wars that rotate three or four of the six factions per sector. Wardens stay a rare elite inside the Hegemony.

## Roadmap and not doing yet

Build the smallest war that can be fun, test it with real people, and let what they do decide the next step.

1. Engine fixes from the checklist above, then the calibrated resolver.
2. A small galaxy map as a web app: sectors, worlds, fleets, supply, 12-hour turns.
3. Auto-resolved battles with readable reports, plus one AI threat faction.
4. First closed test war with 20 to 50 players for a few weeks. Watch what they fight over, what bores them and where they cheat.
5. Fix, run another war. Add live battles, highlights, politics and contracts as the wars show the need.
6. Steam page, then Early Access once a full war loop holds players.

Not doing in version one:

- Real-time combat
- Detailed tactical space combat (abstract ship fights and boarding only)
- Open player market or trading
- Mobile app
- More than the starting factions a test war needs
- Volunteer GMs (the developer is the only GM)
- Shipping any Games Workshop names or Dawn of War assets

Smaller to-dos: pick a name and check it against existing trademarks; start a Discord and devlog now; plan colourblind and screen-reader support; keep all game text in data files so it can be translated later.
