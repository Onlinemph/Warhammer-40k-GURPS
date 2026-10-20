# The setting

The war's own names, factions and units, laid over the GURPS templates the engine and the resolver already know.
`game/world/units.js` follows this file: change a name here, then there. The GURPS library and the simulator page
keep their 40k conversion names; only the war is re-skinned.

**Tone:** grim, vast and old, with a touch of black humour. No faction is the good one.

## The galaxy

**The Reach.** The last stretch of settled space still lit by the Founder's beacons. Beyond it the beacons are dark,
and so are the worlds. Each war is fought over one sector of the Reach.

World types, by what they give (same numbers as now):

| Now | Proposed | What it is | Gives |
| --- | --- | --- | --- |
| hive world | **Spire world** | billions stacked in arcologies | manpower |
| forge world | **Foundry world** | a crust given over to industry | materiel |
| agri world | **Granary world** | farms, feeding its neighbours | supply |
| fortress world | **Bastion** | a capital or a world built to be held; +50% to its holder | a bit of each |
| death world | **Wildworld** | lethal native life, barely settled | little |

## The six factions

Costs follow what each unit is worth, measured with the resolver (`game/world/units.js` says how). Equal-cost
armies of each player faction's usual mix are within about 20 points of even; the Hegemony's Wardens beat the
Apostates' Vessels hard, and the Apostates have the hardest start (the map puts them between the Hegemony and the
Chorus, and the Hegemony's Levies turn on reaching an Apostate world to make up for it: see Faction mechanics).

A war fields three or four of them. The first test war has three player sides (**the Hegemony, the Apostates
and the Brawl**) and two AI sides (**the Chorus and the Dormant**). The Last Court comes later (a tiny elite
faction is the hardest to balance).

### The Hegemony (player)
*A decaying human empire that still obeys the sealed edicts of a Founder dead ten thousand years.* Its strength is
numbers, discipline and a few grown super-soldiers it can barely spare. Colour: tarnished gold.

| Unit | Role | Template | Cost |
| --- | --- | --- | --- |
| **Levy** | the line: a rifle and a uniform | Astra Militarum Guardsman | 0.3 manpower, 0.3 materiel |
| **Levy Sergeant** | holds a squad together | Astra Militarum Sergeant | 0.3 manpower, 0.3 materiel |
| **Provost** | the edicts' enforcer; shoots those who run | Commissar | 0.3 manpower, 0.6 materiel |
| **Storm Levy** | drop troops, the best-equipped humans | Militarum Tempestus Scion | 1.5 manpower, 6.5 materiel |
| **Oathsister** | a sworn militant order, flamer and bolt rifle | Adepta Sororitas Battle Sister | 1 manpower, 4 materiel |
| **Warden** | a grown super-soldier; grown only on long-held worlds | Astartes Battle-Brother | 5 manpower, 20 materiel |

### The Apostates (player)
*Hegemony worlds that opened a forbidden edict early and found something behind it: the Hosts, powers from outside
reality that answer prayers.* They recruit from the Hegemony's despair. Colour: bruised crimson.

| Unit | Role | Template | Cost |
| --- | --- | --- | --- |
| **Faithless** | mobs of the converted, cheap and many | Chaos Cultist | 0.45 manpower, 0.45 materiel |
| **Turncoat** | Hegemony troops who went over with their rifles | Traitor Guardsman | 0.9 manpower, 1.8 materiel |
| **Zealot** | a mob's leader, touched by a Host | Chaos Cultist Champion | 0.45 manpower, 0.45 materiel |
| **Vessel** | a body given to a Host; claws and no fear | Possessed | 6 manpower, 24 materiel |
| **Fallen Warden** | a Warden who broke his oath | Chaos Space Marine | 18 manpower, 70 materiel |

### The Brawl (player)
*A brute species for whom war is the only sport worth watching.* They grow bigger the more they fight. Colour:
moss green.

| Unit | Role | Template | Cost |
| --- | --- | --- | --- |
| **Runt** | small, cowardly, many | Gretchin | 0.25 manpower, 0.25 materiel |
| **Brawler** | the mob | Ork Boy | 0.5 manpower, 0.5 materiel |
| **Sneak** | the rare one who thinks before he hits | Ork Kommando | 0.5 manpower, 1 materiel |
| **Boss** | biggest in the mob, so in charge | Ork Nob | 2 manpower, 4 materiel |
| **Ironhide** | a Boss bolted into scrap plate | Ork Meganob | 6 manpower, 18 materiel |

### The Chorus (AI)
*One hungry intelligence wearing a million bodies, speaking with the voices of those it has eaten.* No morale, no
mercy, and it is listening. Colour: violet.

| Unit | Role | Template | Cost |
| --- | --- | --- | --- |
| **Leaper** | fast claws, sent in waves | Hormagaunt | 1 biomass |
| **Spitter** | living guns | Termagant | 1 biomass |
| **Stalker** | the hunter that needs no voice to guide it | Genestealer | 20 biomass |
| **Conductor** | carries the Chorus's voice; broods near it stay linked | Tyranid Warrior | 15 biomass |
| **Hollow** | an ambusher that wears the hide of its surroundings | Lictor | 12 biomass |
| **Bulwark** | a siege-form the size of a tank | Carnifex | 40 biomass |

### The Dormant (AI)
*The galaxy's last rulers, who archived themselves in tomb-worlds before humanity learned fire, and are waking up
sector by sector.* They can't recruit: what wakes is all there is, but they repair their fallen. Colour: cold
jade.

| Unit | Role | Template | Cost |
| --- | --- | --- | --- |
| **Husk** | the waking rank and file | Necron Warrior | never recruited |
| **Sentinel** | a heavier, better-preserved soldier | Necron Immortal | never recruited |
| **Watcher** | a sniper that sees through walls | Deathmark | never recruited |
| **Flenser** | went mad in the tomb; wears its kills | Flayed One | never recruited |
| **Keeper** | the guard of a tomb's lord | Lychguard | never recruited |

### The Last Court (later; AI to begin with)
*An ancient, dying race hunting the catastrophe they caused, which may be the Chorus.* Very few, very good, and
every death is a loss that never comes back. Colour: pale blue.

| Unit | Role | Template |
| --- | --- | --- |
| **Mourner** | the citizen-levy of a dying people | Aeldari Guardian |
| **Pathwalker** | a scout and a sniper | Aeldari Ranger |
| **Penitent** | a warrior who has taken one path of war for life | Aspect Warrior |
| **Seer** | sees the battle before it is fought | Farseer |

**The militia** holding unclaimed worlds: **Local Defence**, on the Traitor Guardsman template (now Chaos Cultist).

## In the war now

- **Names and text** everywhere the client shows them: factions, units, world types, news and reports.
- **More recruits** per player faction, from the tables above.
- **The Apostates** hold the three free worlds of the west sector furthest from the Hegemony's capital; garrisons
  of Faithless and Turncoats, and a Vessel in each warband.
- **The Dormant** hold three tomb worlds, one a sector, as far from everyone as the map allows. Each sleeps until it
  is fought over or until its turn comes (between turns 8 and 18). Awake, it defends, and every four turns at most sends half its garrison
  at a neighbour, only when the resolver gives it three chances in four. The war party raids and comes home: the
  Dormant never take worlds. They never recruit, and after a battle on a field they hold they get back half their
  fallen. A taken tomb is ruins: it never holds sleepers again.
- **The Chorus** keeps a Conductor (synapse) at each brood-world, breeds Hollows and Stalkers now and then, and a
  Bulwark once biomass piles up.
- Every template the war fields is in `tools/resolver/roster.json`, and the resolver is calibrated for them.

**Not in this pass** (design doc, later): edicts, Host rituals and captives, fame, waking gates, seer visions,
faction-specific travel.


## Faction mechanics

From the design doc, each faction's own currency and two rules that change how its war plays (`game/world/factions.js`). Numbers are first
guesses, to be measured in the sample wars. All of it is worked out at the tick from the log, like everything else.

### The Hegemony: loyalty and edicts
- **Loyalty** (its currency), per Hegemony world, 0 to 100. It rises 5 a turn while the world is held in supply. It
  falls 5 a turn beside an Apostate world, and 10 with an Apostate warband on it or next door (measured: at 10 for
  a world alone, the Hegemony's border went over within 7 turns without a shot). A world taken back from someone starts at 30.
  Below 25, a world can go over to the Apostates (see Corruption), garrison and all.
- **Edicts.** Every 10 turns a sealed edict opens: one war goal for the whole faction, picked by the tick's dice from
  the map as it stands. Take a named world, hold a named world for 5 turns, or break a tomb. It has 10 turns.
  Fulfilled, every Hegemony world gains 20 loyalty and the stockpile 60 materiel. Failed, every world loses 10.
- **Wardens are grown, not raised:** they can be recruited only at a world the Hegemony has held for 10 turns or
  more (the capital always counts).

### The Apostates: captives and rituals
- **Captives** (their currency). After a battle the Apostates win, a fifth of the enemy's fallen are taken alive.
- **Rituals**, a new order for an Apostate warband at one of its own worlds. A ritual takes 3 turns, and everyone
  sees it in the news. It fails if the world is fought over meanwhile. Two kinds:
  - *Summoning*: 15 captives become 2 Vessels in the warband.
  - *Corruption*: 10 captives, aimed at a Hegemony world next door with loyalty under 50. On success the world goes
    over to the Apostates, and its levies become Turncoats.
- **Turned regiments:** a Hegemony warband out of supply for 3 turns in a row loses a tenth of its Levies a turn to
  the nearest Apostate world as Turncoats, instead of just wasting away.
- **Brothers' worlds:** when a Hegemony warband marches onto an Apostate world, half its Levies turn their coats
  before the battle and join the world's garrison as Turncoats (the Apostate worlds were Hegemony worlds; the men
  sent to take them back are asked to fire on their own kind). Storm Levies, Oathsisters and Wardens don't turn.
  Measured over 96 sample wars of 60 turns: without it the Apostates were wiped out in 60 of them (the Hegemony's
  warbands, with about three times the Apostates' power for the same cost, walked through their home worlds while the
  Apostate warbands were away); with it, in 2. The Hegemony pays for it: 10.9 worlds at turn 60 before, 4.6
  after, wiped out in 12 wars instead of none.

### The Brawl: fame
- **Fame** (its currency). After every battle a Brawl warband fights, it gains fame in proportion to the enemy's
  power it put down, doubled when the odds were against it. Fame pays for Bosses and Ironhides (as well as manpower
  and materiel), and each turn the capital raises free Brawlers worth a tenth of the faction's fame.
- **Peace breeds trouble:** a Brawl warband that hasn't fought for 4 turns loses a twentieth of its men a turn to
  fighting among themselves.
- **They grow:** after a battle a Brawl warband wins, one surviving Brawler in ten becomes a Boss.

### The Chorus: the dead
- **Corpses** become biomass: after a battle on a field the Chorus holds, every fallen soldier on either side gives
  it 1 biomass (Leapers are bred where they fell).
- **Infestation:** a world next to a Chorus world where 60 or more died in one tick's battles rises as a Chorus
  world three turns later, unless 20 or more of someone else's soldiers stand there (measured: at 40, battles big
  enough were common, and the Chorus held 8 worlds of 24 by turn 60 instead of 6).

### The Dormant: gates
- As now: a fixed population, repair, waking tombs, raids that come home.
- **The gate network:** every tomb world is a gate. From one gate you can jump to any other gate your faction holds,
  as if it were next door. A broken tomb keeps its gate, so taking tombs opens fast routes across the map. Awake
  Dormant tombs can raid through their gates.

### Not in this pass
The Last Court, patron gifts and spawn, leaders and ascension, travel styles beyond gates, edict votes, and
treating captives in other ways (execute, ransom, exchange).

## Veterans and leaders

The design doc's "stories nobody wrote": most of a warband stays a number, but the soldiers who live through
battles get names, and the war remembers them. All of it is worked out at the tick from the log, and the dice are
the tick's own (`game/world/veterans.js`).

### Who gets a name
- After a battle a warband **wins or holds**, up to two of its survivors are named (one if it barely won), up to
  **12 named soldiers** a warband. They are picked by the dice from its unit types, weighted by how many of each
  survived.
- A name comes from the faction's own name lists, drawn by the tick's dice: Hegemony "Corporal Ansel Varga of
  Kamirbra", Apostate "Mirel the Unbound", Brawl "Gutsnag Ironjaw". Each also gets a homeworld (the world the warband
  recruited at), the turn they joined, and a short line about how they were named ("first over the wall at Braae").

### What they gain
- **Ranks by battles survived:** Blooded (1), Veteran (3), Hardened (6), Legend (10). Each rank is +1 to the
  soldier's weapon skills in the full engine replays (the engine already takes a skill override per unit), so a
  Legend Levy fights at +4.
- **In the war's own battles** (the resolver), a side's named soldiers count as extra worth: a tenth of a soldier of
  their type for each battle survived, up to double (a Legend counts as two), so twelve Hardened Levies are worth
  about 7 more Levies. Small, but it adds up, and it's what makes losing them hurt. (The draft said "each rank adds a
  tenth", which didn't give its own examples; the per-battle rule does.)
- **Scars:** a named soldier on a side that loses half or more can come out with a lasting wound (a lost eye, a
  crude augmetic arm, the shakes): -1 to their skills in the replays, and a line in their record. Two scars and they
  retire home: they leave the warband and the record says so.

### Death
- When a warband takes losses, each named soldier dies with the same chance as any of its type (the share of that
  type lost). The dead go to the warband's **memorial**: name, rank, battles, where they fell, and a short **last
  letter home**, written from their record (homeworld, how they were named, their scars, the battle they died in),
  from the faction's own phrases.

### The leader
- The player's warband has a **leader**, a named character from the start (the player's name, rank Veteran). The
  leader gives the warband's side +10% in its battles, rising to +20% with experience (+1% a battle won).
- A leader can fall: in a battle the warband loses, the leader dies with half the chance of a common soldier. The
  highest-ranked named soldier takes command, keeping their experience; with none, a new leader is raised at rank
  Blooded and the bonus drops back to +10%.

### In the client
- A **roster** card: the leader and every named soldier with rank, unit, battles, scars and how they were named;
  the **memorial** with the fallen and their letters.
- Battle reports name the named who fell ("Sergeant Varga fell at Qerum").
- The replay labels named soldiers by name, so you can watch your veterans fight.

### Not in this pass
Friendships and rivalries, XP spent on particular skills by what a soldier did, augmetics as gear, retiring as
drill instructors or governors, players marking soldiers to follow, captives among the named, and leader duels.

## Supply and logistics

The design doc: "the economy stays small; logistics is where the war is won." Today supply is only "within a jump of
a world joined to your capital", and each world's supply rating goes unused. This pass makes supply a thing that is
made, carried, stored, cut off and fought over. Like the rest, it is worked out at the tick from the log
(`game/world/logistics.js`).

### Supply is made and eaten
- **Supply** is the shared fourth resource of every player faction. Each of its worlds yields its supply rating a
  turn (Granary 6, Bastion 3, Spire and Foundry 2, Wildworld 1, Tomb 1), and so do worlds joined to the capital.
- **Every warband eats**: 1 supply a turn for each 10 soldiers (rounded up), taken from its share of the stockpile
  like recruits. A warband that can't eat its fill is **short**.

### Depots and convoys
- **Depots:** a new order at your own world, *build a depot* (30 materiel). A depot holds supply, up to 60. A warband
  on a depot world or next to it eats from the depot first, so it can fight far from home.
- **Convoys:** a new order at a depot or the capital, *send a convoy* of up to 30 supply to a depot of yours. A convoy
  moves one jump a turn along your own worlds, the shortest way, and is listed in the news.
- **Raiding a convoy:** an enemy warband in the *raid* stance on a world a convoy passes through, or next to it,
  takes it: half the supply goes to the raiders' faction, the rest is lost. An escort (a warband of the convoy's
  faction on the same world when it gets there) stops the raid.

### Blockade
- A world of yours with **no lane to another world of yours**, and an enemy warband or garrison next door, is
  **blockaded**: no income at all, its garrison loses a tenth a turn, and on Hegemony worlds loyalty falls 5 a turn.
  A depot on a blockaded world feeds its own garrison first (1 supply a turn per 10).

### Fighting short of supply
- A warband that is short, or out of supply as now, fights at x0.8 in the war's battles, and in the replays its
  soldiers carry two spare magazines instead of the usual (the engine counts them, so they really do run dry).
- Out of supply for 3 turns it starts wasting away (and Hegemony Levies desert, as before). Before this pass the
  wasting started on the first turn out of supply; the draft said "as now", and it is built as the draft's 3 turns.

### In the client
- The stockpile shows supply, and your warband's line shows how much it eats and whether it's short.
- World panel: depots and their supply, blockades, convoys passing.
- Orders: *build a depot*, *send a convoy* (to which depot, how much).

### Not in this pass
Ships and orbit, faction travel styles beyond gates, supply moving on its own along the lanes, convoys of troops,
and medics and healing.

## Politics and contracts

From the design doc: players run their factions. Ranks are elected, votes are weighted by service in this war, and
the elected set the stockpile's priorities and post binding contracts paid from escrow. Nobody can force another
player to obey; contracts make it worth their while. Worked out from the log like everything else (`game/world/politics.js`).

### Service
- Every warband earns **service** in its war: 1 a turn in the field, 2 a battle fought, 3 a battle won, 5 a contract
  completed. It's shown on the warband and decides how much its vote weighs.

### The Warmaster
- Each player faction has one elected office, the **Warmaster**. An election is held every 10 turns, on turns 5, 15,
  25 and so on.
- **Standing:** any warband with 5 turns served and 3 battles fought can stand, with a new order, *stand for
  Warmaster*.
- **Voting:** every warband of the faction may vote with the order *vote for* (the last vote before the election
  counts), weighted by its service. The candidate with the most weight wins, a tie going to the one with more
  service. With no candidates the office stays as it is.
- **Recall:** at any tick, if votes to recall the Warmaster (the order *vote to recall*) carry more than half the
  faction's service, the office falls vacant until the next election.
- **Absence:** a Warmaster who gives no orders for 3 turns loses the office.
- Ranks end with the war.

### What the Warmaster can do
- **Priority:** name up to two warbands to draw a double share of the stockpile (recruits, supply, walls and depots).
- **Contracts:** post one, with its reward taken from the stockpile into **escrow** when it's posted, and a deadline
  of up to 15 turns. Up to 4 open at once. Each is either an *open bounty* (anyone of the faction may complete it) or
  *offered to* one warband (which must accept it first). Four kinds, each checked at the tick:
  - *Take* a named world (paid to the warband or warbands whose forces took it).
  - *Hold* a named world for N turns, 2 to 6 (the taker's warband must be on it, and the faction holding it, each of
    those turns).
  - *Deliver* N supply to a named depot by convoy (counted as the taker's convoys arrive).
  - *Break* a named tomb.
- **Pay** goes into the completing warband's **treasury**: manpower, materiel and supply it spends on its own orders,
  after its share of the stockpile.
- **Cancel:** a contract can be withdrawn. An accepted one pays its taker half in compensation, and the rest returns
  to the stockpile. One that reaches its deadline undone returns to the stockpile, and an accepted one counts as
  failed.

### Reputation
- Each warband's record: contracts completed and failed, shown to its faction. The Warmaster's own record shows
  contracts posted, paid and cancelled.

### The faction's own log
- Every election, vote total, priority, contract posted, accepted, paid, failed or cancelled goes in a log only that
  faction can read.

### The bots
- Bots vote for the candidate with the most service, stand when they are the faction's most served, and take open
  bounties that lie on their way. A bot Warmaster posts a *take* contract on the weakest enemy world next to the
  faction's territory when the stockpile can spare it.

### In the client
- A **Politics** card: the Warmaster, the next election and its candidates, your service and vote, the recall tally,
  the contracts board (accept, and what each pays), your treasury and record, and the faction log.
- For the Warmaster: post a contract, set priorities, cancel.

### Not in this pass
More offices than one, appointment by the elected, edict votes, sanctioned traitors, counter-intelligence,
propaganda, captive treatment, duels, and contracts between factions.

## Watching battles

From the design doc: replays, a highlight feed, and battles fought live between ticks. Three parts:

### 1. War battles in 3D
- Every war replay also keeps the **full engine result** (every model's facing, path, aim and condition each
  second, every shot, blow, hit and fall, the terrain, each soldier's kit), gzipped beside the compact one.
- The war server also serves the simulator's page, which already has the 3D view and the broadcast view (a
  scoreboard, a kill feed, title and result cards). A battle report gets a second button, **Watch in 3D**. It opens
  that page on the battle, with the sides' faction names and colours, named soldiers labelled, and the kill feed
  naming them.
- The 2D player stays. It loads fast and works on any phone; the 3D view wants a decent machine.
- The Dawn of War models stay optional, as on the simulator page: without a local pack it uses its own miniatures.

### 2. The highlight feed
- Each tick, every battle gets a **score** from what happened:
  - an **upset** (the winner's odds were under 35%), counting more the longer the odds;
  - a **close fight** (odds between 40% and 60%, and heavy losses on both sides);
  - **size** (soldiers on the field);
  - **the named** (a named soldier or a leader fell, a Legend fought);
  - **weight** (a capital, a tomb broken, a world changing hands, a contract or an edict fulfilled by it).
- A **Highlights** card shows the faction's **top 10 of the turn** among the battles it can see, each with a line
  saying why it's there ("an upset: 18% odds, and Sergeant Varga fell"), Watch buttons, and your own warband's
  battles marked.
- **Upvotes:** a player can mark a highlight worth watching, one vote per battle. The votes show, and over the war
  each reason's weight drifts toward what players vote for (by at most a tenth a turn).

### 3. Fighting a battle live
- **Command it yourself:** a new standing choice for a warband. When it's on, a battle your warband fights at the
  tick isn't settled by the resolver. It is **held open until the next tick** and listed in your news as "waiting
  for you".
- You fight it in the browser on the full engine, as on the simulator's "Play it yourself": standing orders to your
  units each second, or each model's turn chosen from the options the AI weighed. The server runs the battle and
  keeps it, so nothing is trusted from the browser. Each answer goes to the server, which steps the engine and sends
  back what happened, and a battle survives a restart because its answers are kept.
- When it ends, its result applies at the next tick: the winner, each side's losses, the named who fell.
- **Not fought by the next tick:** the resolver settles it there as usual, and nothing is lost by sleeping (the
  design doc's "respect players' time"). Only your own side is yours to command. The enemy is the engine's AI, or a
  human player of theirs who also chose to command, in which case each of you commands your own side and the battle
  waits on both.
- **Limits:** a held battle keeps its armies in place on that world until it's settled. While it waits, neither side
  can move away or recruit into it. Forces that arrive meanwhile aren't in it: the result settles only those that
  fought it, and the newcomers fight afterwards, as usual (built so after a playtest in which a bot's Wardens,
  arriving late, died in a fight they never took part in).
- **How it runs** (`game/live.js`, `tools/sim/page/46-war-replay.js`): the war server sends the battle's setup and
  seed, the browser runs the same battle as "Play it yourself" does and sends every answer, and the server steps
  its own copy with each one. It takes an answer only in order and only from the commander of the side the battle
  waits on, keeps the answers on disk (a restart steps the battle again from them), and logs the result as a "live"
  event when the battle ends. The engine runs on the server's main thread between answers.

### Not in this pass
Sector splitting for very large replays, the 3D view inside the war page itself, sharing highlights outside the
game, a following feed for individual soldiers, and live spectating of someone else's live battle.
