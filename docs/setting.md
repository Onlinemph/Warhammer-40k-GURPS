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

## Battles that can go either way

In a 40-turn war, the winner had 95% odds or better in 53 of 54 battles. The attacker only attacks when it's sure,
and the resolver's odds grow steep with numbers. Three changes:

- **The leaders' contest** (design doc): before every battle, each side's leader rolls Strategy against the other's.
  A warband's leader rolls at 10 plus their rank (a Legend at 14), Warmasters +2, and AI and militia at a flat 10
  (12 for a Dormant tomb lord). The margin buys one advantage per 2 points, chosen by what suits the winning side:
  - **Ambush:** the loser's first 2 seconds are lost (in the war's odds, x1.25 for the winner).
  - **The ground:** the winner picks the battle map and its edge (x1.15).
  - **First volley:** the winner's side fires a turn early (x1.1).
  - **Night or weather:** -2 to everyone's shooting, which helps whoever fights hand to hand (x1.15 for the side with
    more melee).

  The report says what was won ("Yara Keel outwitted the Chorus: an ambush and the high ground").
- **Fog:** you no longer see a force's exact numbers before you're there. Odds are shown as a band ("about 60-80%"),
  wider the less your faction can see, so a move can still surprise you. A world next to yours shows rough numbers; one
  further off shows only "a garrison".
- **Not all-or-nothing:** a battle ends in one of four ways, by how it went:
  - **Rout:** the beaten side is broken, as now.
  - **Repulse:** the attacker is thrown back to where it came from, both sides bloodied, the world unchanged.
  - **Stalemate:** both sides dig in and fight again next turn.
  - **Pyrrhic victory:** the winner holds, but loses more than half.

  Close fights mostly end the middle two ways, so a world can take several turns of fighting to take.

**As built** (`game/world/battle.js`), with two additions the measurements called for:
- The advantages count as **fighting strength**: the winner's numbers going into the resolver count for that much
  more, rather than its odds being multiplied, so the contest swings fights within about 3 to 1 and can't turn a
  rout.
- **A world rallies:** attacked by a force more than twice as strong as its defenders, a world with a garrison raises
  three of its people for every point of its yield, as its holder's basic troops.
- **Through the fog:** the bots, the Chorus, the Dormant and the turn-back order all judge a world by what can be seen
  of it, its rough numbers where they neither hold it nor have a warband there.

**Measured** (8 wars of 60 turns, before → after):
- Battles between sides within 3 to 1 went from 15% to 33%.
- The winner had 40-60% odds in 1% → 4%.
- Stalemates and repulses went from 0.5 to 4 a war; Pyrrhic victories from 0 to 10.
- The winner had 95% odds or more in 95% → 91%.

That last number is still the problem. The resolver's odds are steep (calibrated on the engine, where a 2 to 1 edge
almost always wins), and the Chorus's swarms are the weaker side in 58% of battles.

## Worlds to conquer

Today a world is taken in a single battle. Instead, each world becomes a campaign: many regions, many cities, its own
terrain, and battles fought on maps made from that terrain.

### What a world is made of
- Each world has **8 to 20 regions** in a map of its own (a small graph of its own, like the galaxy's), drawn from
  its type:
  - a **Spire world** is mostly hive cities and their wastes;
  - a **Granary** is plains, fields and farm towns;
  - a **Wildworld** is jungle, swamp and mountains;
  - a **Bastion** is fortress cities, trench lines and hills;
  - a **Foundry world** is industrial sprawl, slag wastes and refinery towns;
  - a **Tomb world** is desert and buried necropolises.
- **Terrain types** (each with its own battle map): plains, farmland, forest, jungle, hills, mountains, desert, swamp,
  tundra, wasteland, river valley, and four kinds of town: farm town, city, hive city, fortress. Each world has
  several towns and cities, each with its own name, and one is its capital.
- **What's held:** each region has a holder and its own garrison. Cities are where income, recruits and supply
  come from (a world's yield is shared among its cities), and where a world's levies are raised.

### Conquest
- **Landing:** a warband arriving from another world lands in a region of its choice. A defended world's
  orbital fortress or fortress city can deny a landing next to it. Inside a world, a warband moves one region a
  turn, along the world's own links.
- **Battles are fought per region,** wherever two factions meet in one, on a map built from that region's terrain.
- **A world changes hands** when one faction holds its capital and more than half its cities. Until then it's
  **contested**: both sides hold parts of it, each draws income only from the cities it holds, and the galaxy map
  shows it split.
- The AI factions, the bots, raids, rituals, convoys, contracts and edicts all work at the region level. A raid
  hits a city, Corruption turns a city, a contract can name a city, and a convoy unloads at a city's depot.

### Battle maps from the terrain
- The countryside generator becomes a **terrain-driven** one, with every element dialled by the region's terrain:
  hills and their height, woods and how thick, hedges and walls, farms and buildings, rubble and craters, rivers
  and marsh water, rock outcrops, and the 3D view's ground and scenery theme.
  - **Mountains:** high ground and rock, few buildings.
  - **Jungle:** thick trunks everywhere.
  - **Desert:** open sand and rock.
  - **Swamp:** pools and reeds.
  - **Wasteland:** craters and wreckage.
  - **River valley:** a river with its crossings.
- A new **city** generator, at war scale: blocks of buildings, streets and squares, rubble where blocks have
  fallen. Its density and building height grow from farm town to city to hive city (towering blocks, narrow streets).
  A fortress adds walls and a gate.
- The map is built from the region and the battle's seed, so its replay rebuilds it exactly.
- The leader who wins **the ground** picks the edge (and on a hill, the higher one).
- **As built (step 2):** each world's battles are fought on a ground drawn from its mix (`game/world/terrain.js`),
  until regions arrive in step 3. The leader who wins the ground picks the ground itself rather than the edge, and
  close or open ground counts in the war's odds (x1.15 for the hand-to-hand side in close ground, x1.1 for the
  guns in the open).

- **As built (step 3):** `game/world/regions.js`. Each world has 8 to 20 regions (by type: a Spire world 12-20, a
  Bastion 9-14, a tomb 8-12), joined by links of their own; a third of them (at least three) are cities, drawn from
  the world's towns, and the region nearest the middle is the capital, built as the world's kind of capital (a hive
  city, a fortress, a city, a farm town). Cities have names; the countryside is named for its ground ("Vorka
  Hills"); a capital is "<world> Prime". A world's starting garrison is in its capital, with five of its basic troops
  (a free world's three to eight Local Defence) in each other city. A warband marches one region a turn (`region`
  in the order) or moves to another world, landing in the region it names (`land`) or the one nearest the capital
  it may land in. Only a **fortress capital** held by a foe with a garrison denies the sky, over itself and the
  regions next to it: when every fortress city denied it, a Bastion couldn't be landed on at all, and the bots
  beside one walked up and down their own lanes. Battles are fought region by region on the region's ground; a
  region held by one faction's forces alone is theirs; a world goes to whoever holds its capital and more than half
  its cities (or to the capital's holder, where the old holder has no city left), and is **contested** until then.
  Each city gives its holder its share of the world's yield (the capital counts double); recruits come only from a
  city you hold; a world's two new levies a turn go to its holder's emptiest city; walls and a world's defence count
  in its cities, and a fortress city's works x1.25. **Added by measurement:** a city under attack is reinforced by
  half of each of its holder's other garrisons on the world (a muster), since otherwise warbands picked off cities
  of three to eight defenders. Rallies are a city's share of its world's people; a raid loots a city; Corruption
  turns a world's capital; the dead rise in the region where most of them fell; the Chorus breeds in every city it
  holds, each with its own Conductor; the Dormant raid regions in reach.

### In the client
- Clicking a world opens its **planet view**: its regions and cities on a map of their own, coloured by holder,
  with terrain, garrisons where you can see them, and your warband's region. Orders target regions there.
- The galaxy map shows contested worlds split by the share each faction holds.
- **As built:** a planet card under the galaxy map draws the picked world (or your warband's) region by region:
  cities as squares, the capital biggest, each coloured by its holder, troops seen as numbers, your warband ringed,
  a battle waiting circled red. Picking a region shows its ground, holder and forces, the odds if you'd fight there,
  and sets a march or a landing in the orders. The orders have a march (to a region next door, with its odds) and a
  move to another world with its landing choice.

### Not in this pass
Orbit and space battles, sieges lasting several turns as a mechanic of their own, the planet surface in 3D, and
weather that changes between turns.

### The order to build in
1. **Battles that can go either way**, on the war as it is (a few sessions' work, measured on the sample wars).
2. **Terrain-driven battle maps** for the existing worlds: each world gets a terrain profile, and its battles use
   it. This is an engine change; the generator has to be deterministic and keep its replays rebuilding.
3. **Regions and cities**: the war's rules, AI, client and every system above move to the region level. This is
   the biggest change since the war began, and the event log of a war started before it won't rebuild after it.

## Bigger armies, more kinds of soldier

*Draft, for approval.* Today a battle has 36 soldiers at the median (90% under 79, the biggest 139), a warband ends a
war about 23 strong, and a city's garrison is about 17 (measured over 4 sample wars of 60 turns). The aim is
**warbands of 60 to 100** and **battles of 100 to 250**, with every side fielding a real mix: line troops, special
and heavy weapons, specialists and a few rare leaders. One figure is still one soldier.

### Four times the numbers
- One constant, `SCALE = 4`, multiplies every count in the war: the starting warbands and garrisons, the Local
  Defence, the levies a world raises each turn (8, not 2) and the garrison cap (120), a city's rally, the Chorus's
  broods (96 a city a turn at most) and the size at which a brood swarms (100), the Dormant's sleepers and the
  strength a tomb raids at, the dead that rise (240) and the guard that stops them (80), and a recruit order (up to
  200). The bots fill up to 100 and go home under 48.
- **Yields go up four times**, not prices down, so a soldier costs what it does now and the stockpile numbers read
  four times bigger. A supply feeds 40 soldiers a turn, not 10, so supply stays as it is.
- What's measured per soldier stays: power, the resolver's odds, the muster's half, a rally's share.

### More kinds of soldier
Each new unit is a template the engine already has, or a template with a different weapon. The second kind is a
resolver variant, like the linked broods, calibrated with the rest. Each is priced by its measured power, as
today. Special and heavy weapons are limited to **one for every ten** of the faction's line troops in a warband, as
squads carry them. That gives every army a mix without an army of nothing but plasma guns.
- **The Hegemony:** Levy Gunner (plasma gun), Levy Burner (flamer), Levy Melta (meltagun), Heavy Team (heavy bolter
  or autocannon), Marksman (long-las), Seer (Sanctioned Psyker).
- **The Apostates:** Turncoat Gunner (plasma gun), Turncoat Burner (flamer), Turncoat Heavy (heavy stubber or
  autocannon), the Frenzied (Khorne Berzerker), the Rotted (Plague Marine), Hierophant (Chaos Sorcerer).
- **The Brawl:** Burna (burna), Rokkit (rokkit launcha), Big Shoota, Mek (kustom mega-blasta), Weirdboy (psyker).
- **The Chorus:** Burrower (Ravener), Mindspike (Zoanthrope), Bonewarrior (Tyranid Warrior with bonesword and lash
  whip), and rarely an Overmind (Hive Tyrant), bred when the biomass has piled up.
- **The Dormant:** Reaper (Skorpekh Destroyer), Cryptek, and one Overlord a tomb. Some Husks carry heavy gauss
  cannons.
- **Local Defence:** a sergeant and a heavy stubber for every ten.
- The bots' mixes, the Chorus's breeding and the Dormant's sleepers use them. The recruit form groups units by role:
  line, special weapons, heavy weapons, specialists, elites.
- Each weapon is checked in the engine first: it has a profile there, it fires, and nobody gets stuck carrying it.
  Any that don't are left out of this pass and listed.

### What it costs to watch
- Measured on the engine (one battle each, countryside): 100 against 130 takes 7 seconds to fight out, 200
  against 260 takes 45 seconds, 400 against 520 takes 155 seconds. A replay tries up to four seeds to match the
  war's winner, so at the sizes aimed for, a replay can take up to three minutes the first time. That's fine on the
  worker, one at a time. The resolver decides the war's battles and costs nothing more.
- The 3D view at 250 figures is measured before anything else is built. If it's slow, figures are drawn as
  instances.
- **Live battles** at 100 a side would mean answering for a hundred soldiers one by one. In this pass a commander
  answers for the units they pick and the AI fights the rest. Orders for whole squads come later.
- The resolver is validated again at these sizes (it was calibrated on smaller fights), and re-calibrated if its
  error grows.

### A resolver that knows the ground
*User direction: make the resolver as smart as it can be, before the armies grow.* Today its rates come from 10
against 10 in the open, 50 yards apart; the war bolts terrain and holding a city on as flat multipliers.
- **Ground:** rates measured on the war's own maps, in four classes: open (plains, desert, tundra), broken (hills,
  mountains, farmland, wasteland, river valley), close (forest, jungle, swamp) and urban (the four kinds of town).
  A battle uses its region's class, in place of today's x1.15 and x1.1.
- **Holding:** a defender deployed in the ground it holds (in the buildings of a city, in the cover of the
  country), staying put and firing, against an attacker coming on from its edge. Measured as a second set of rates,
  it takes the place of the flat bonus for holding a city (walls and fortifying stay as they are). This needs the
  engine to deploy a side that way; it's off unless asked for, so every battle and replay so far is unchanged.
- **Closing in:** a hand-to-hand fighter does nothing until it reaches the enemy and a gun has the opening volleys.
  Each pair's rate is measured with how long it takes to start, not as one rate from the first second.
- **Size:** the rates measured at more than one size, and how much a man's rate falls as the crowd grows (not
  everyone can see or reach the enemy), fitted for each class.
- **Checked** against the engine on each class, both ways of deploying, mixed armies from 10 to 250 a side, before
  and after, and reported as before: the error in the win chance and in the share lost.

### As built
*User direction while building: much larger battles than the draft's 4x, and no cap on elements a side.*
- **`SCALE = 10`** (`game/world/units.js`), one constant through the war: starting warbands and garrisons, the Local
  Defence, worlds' yields (so income, rallies and raids), a world's levies a turn and the garrison cap, the Chorus's
  broods and the size a brood swarms at, the Dormant's sleepers, the dead that rise and the guard that stops them,
  the muster, walls, depots, edicts, rituals' captives, recruit orders (up to 500), the bots' mixes and thresholds. A
  supply feeds 100 soldiers, so supply itself isn't scaled. A Chorus brood keeps one Conductor however big; a tomb has
  one Overlord and three Crypteks.
- **Elements stay about ten soldiers** however big the battle (the article's 4 to 40 a side is passed), so a battle
  of a thousand is a hundred elements a side. The map grows with them (up to 120 hexes wide, 2,400 yards) and so
  does the round limit (half the map's width, at least 16). Measured, one battle on open ground: 700 soldiers 0.06
  s, 2,800 0.9 s, 5,000 1.7 s, 10,000 3.8 s, 20,000 8.4 s. A battle's odds take fewer quick runs the bigger it is
  (8 at a thousand or fewer, down to 2), and the same question is answered once.
- **The new units** are in, each rated by SCER (its own gun for a variant, a psyker's best power at half, as the
  article says for FP-using abilities) and priced from its worth as the war now fights: `tools/resolver/price.js`
  fights each against a line of Levies, a mob of Brawlers, Wardens and a Chorus brood, the fewest that win half the
  time against the Levies it takes. Special and heavy weapons are limited to one for every ten line troops (Levies;
  Turncoats and Faithless; Brawlers). Free worlds' Local Defence has a sergeant and a heavy stubber to every ten.
  The Chorus breeds its new forms by chance, an Overmind rarely; the Dormant wake with theirs.
- **Every unit's `power`** (the AI's sums) is now its measured worth. The older units keep their prices for now.
  **Measured worths, in Levies:** Storm Levy 2.0, Warden 2.1, Levy Gunner 1.0, Heavy Team 2.5, Levy Melta 0.5,
  Marksman 0.35, Seer 0.22, Levy Burner 0.03; Turncoat 0.61, Turncoat Heavy 1.2, Rotted 2.35, Fallen Warden 2.1;
  Brawler 0.38, Boss 2.3, Ironhide 3.4, Big Shoota 1.3; Leaper 0.45, Spitter 0.06, Bulwark 3.5, Overmind 2.8;
  Husk 1.0, Heavy Husk 6.1. Under Tactical Mass Combat the elites are worth far less against the line than in the
  engine (a Warden 2.1 Levies, against 41), and the short-ranged (flamers 2 hexes, psykers 5) are nearly worthless:
  the fire table is fought at range, and a lasgun reaches 20.
- **3D replays and live battles** of more than 250 soldiers are fought as a sample, each unit in its share, and the
  replay says so.
- **Measured** (8 wars of 60 turns, about 90 seconds a war to run): battles of 401 soldiers at the median, 851 at
  the 90th percentile, 1,509 the biggest; 96 battles a war, 70 cities and 10 or 11 worlds taken. **Worse:** close
  fights (40-60%) fell from 18% of battles to 8%, and the winner at 95%+ rose from 29% to 50%: with a hundred
  elements a side the dice average out, and the bigger side wins far more surely than with ten. Balance at turn 60:
  Hegemony 3.1, Apostates 5.4, Brawl 5.5, Chorus 5.0, Dormant 2.4.
- **Repriced** (user direction, after the first measurements): every unit now costs its measured worth at its
  faction's rate, set by what its line troops cost for a Levy's worth (the Hegemony 0.6, the Apostates 3.2, the
  Brawl 2.9, the Chorus 2.3 biomass); the line keeps its price, the Brawl's Bosses and Ironhides their fame. A Warden
  now costs 1.3 (it was 25), a Stalker 2 biomass (20), a Bulwark 8 (40). And every element that shoots has at least 6
  hexes of range (a round is half a minute; a squad with a short weapon closes in within it; the article gives every
  infantry element one range), a flamer counts in close combat too, and a flame cone counts as an attack that hits
  automatically (the article's +15): flamer squads went from 0.03 Levies' worth to 0.34, Meltas 0.5 to 1.15, Meks 0.6
  to 0.95. Psykers stay weak (a Seer 0.23, a Weirdboy 0.08): CER halves an ability that costs FP, and the fire table
  favours range. Measured over 4 wars of 60 turns: Hegemony 4.3 worlds at turn 60 (3.1 before), Apostates 3.3 (5.4),
  Brawl 5.8 (5.5), Chorus 6.3 (5.0), Dormant 2.3 (2.4); close fights 9.5% of battles, 95%+ 49%; battles of 340 at the
  median, 1,953 the biggest.
- Found on the way: a stalemate was fought up to four times in the same turn (the battle loop ran while two sides
  stood); now it's the turn's fighting there. The view keeps a player's own last ten battles even when thirty others
  are newer.

### The order to build in
0. The resolver that knows the ground (above).
1. The 3D view and a replay at 250 figures, measured.
2. `SCALE` through the war, the bots and the AI, with balance and battle sizes measured on the sample wars.
3. The new units: weapons checked in the engine, the variants calibrated, prices measured, the factions' mixes and
   the AI's breeding.
4. The client: the recruit form by role, and army lists grouped by kind.

### Not in this pass
Vehicles, squads drawn as single figures, orders for whole squads in a live battle, and wargear chosen soldier by
soldier.

## Tactical Mass Combat as the resolver

*Draft, for approval.* User direction: resolve the war's battles with **Tactical Mass Combat** (David L. Pulver,
Pyramid 3/44 pp. 24-29, on GURPS Mass Combat), with each unit's offensive and defensive values from the **Combat
Effectiveness Rating** (Christopher R. Rice, "It's a Threat!", Pyramid 3/77 pp. 29-33) in the user's scaled form
(SCER, `docs/scer-handoff.md`), checked against the engine.
This replaces the calibrated resolver as what decides a battle; the engine stays the 3D zoom-in on any battle.

### A battle
- **The map:** a small hex map built from the region's ground, each hex one of the article's terrains: clear
  (plains, desert, tundra, farmland), woods (forest, jungle), high ground (hills, mountains), swampland (swamp, mud),
  built-up (a town's or city's blocks), water and streams (a river valley), roads. A hive city is nearly all
  built-up; a fortress city has its wall as built-up hexes with gates. The article's hexes are 100 yards for
  battalions; ours are company fights, so a hex is 20 yards and ranges and moves are scaled to match (checked
  against the engine, below).
- **Elements:** each unit type in a force becomes elements of about ten soldiers (the last one smaller), a named
  hero is an element of their own (the article's Hero), and the new heavy weapons are elements of their team.
- **Before it:** the Reconnaissance Contest replaces the leaders' contest: initiative, and whether it's a pitched
  battle, an encounter battle, or an ambush (the ambushed side confused on its first turn). Night on 5+ on 1d.
  A side fortified in a region it holds has earthworks (one per four Foot elements). A city's garrison sets up in
  its built-up hexes.
- **Fighting it:** rounds of fire combat, movement and close combat, on the article's two tables (Fire Combat:
  pinned, eliminated, obliterated with a follow-up shot at half strength; Close Combat: attackers or defenders
  eliminated or retreating). Its modifiers as written: half strength firing into woods or buildings or at night,
  Foot defending double in woods and in earthworks, triple in buildings, half strength attacking uphill or across a
  stream.
- **Commanders:** each side's leader has Command Points, (Leadership + Strategy) / 4, spent for +1 on a roll, a
  rally, or a double move, and regained by planning. A warband's leader uses their own skills, a Warmaster +2; an AI
  force has a standard leader (the article's 1d+8; 12 for the Dormant).
- **Ending it:** a side is demoralized as the article says (over half its elements gone and losing more than the
  enemy): its elements fall back to their edge and won't attack. A side with nothing left on the map has lost. A
  battle with both sides still fighting after a set number of rounds is a stalemate.
- **The AI:** both sides are played by a simple tactical AI, per element: fire at the target with the best odds in
  range, advance toward the enemy through cover, close in with hand-to-hand elements when the odds are good, hold
  built-up hexes and earthworks when defending, fall back when demoralized. Commanders spend points where the odds
  are closest. Fighting the battle yourself, on the hex map, comes later.
- **What it gives the war:** who holds the field, each side's elements lost (eliminated, or fled off the map and
  back next turn), the named who fell (a Hero element eliminated), and how it ended (a rout; a repulse when the
  attacker is demoralized; a stalemate; a Pyrrhic victory past half its elements). The war's odds, for advice and
  for the AI, are the share of wins over a few dozen quick runs.

### More results than the article's
*User direction: more variety of results than Tactical Mass Combat gives.* The article's tables have four results
for fire (no effect, pinned, eliminated, obliterated) and five for close combat. Ours keep each table's shape, the
same odds columns and the same rolls, and split its results into finer steps, so a fight grinds and swings instead
of going straight from nothing to gone.

**Steps.** Every element has two steps: full, and reduced (half its soldiers lost, half its OR and PR). A result
that costs a step reduces a full element and eliminates a reduced one. Two reduced elements of the same unit in one
hex may merge into one full element in the Pin Recovery phase.

**Fire Combat Results**, built from the article's table cell by cell: the roll just below its first P becomes S;
its second P becomes PC; its first DE becomes SL; the rest is as written.

| 2d | 1:10 | 1:5 | 1:3 | 1:2 | 1:1 | 2:1 | 3:1 | 4:1 | 5:1 | 10:1 | 20:1+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2- | NE | NE | NE | NE | NE | NE | NE | NE | NE | S | P |
| 3 | NE | NE | NE | NE | NE | NE | NE | NE | S | P | PC |
| 4 | NE | NE | NE | NE | NE | NE | NE | S | P | PC | SL |
| 5 | NE | NE | NE | NE | NE | NE | S | P | PC | SL | DE |
| 6 | NE | NE | NE | NE | NE | S | P | PC | SL | DE | DO |
| 7 | NE | NE | NE | NE | S | P | PC | SL | DE | DO | DO |
| 8 | NE | NE | NE | S | P | PC | SL | DE | DO | DO | DO |
| 9 | NE | NE | S | P | PC | SL | DE | DO | DO | DO | DO |
| 10 | NE | S | P | PC | SL | DE | DO | DO | DO | DO | DO |
| 11 | S | P | PC | SL | DE | DO | DO | DO | DO | DO | DO |
| 12+ | P | PC | SL | DE | DO | DO | DO | DO | DO | DO | DO |
- **NE:** no effect.
- **S, Suppressed** (new): the target fires at half OR next turn and may not move closer to the enemy. Gone in Pin
  Recovery.
- **P, Pinned** (as written): it may not move or attack until it recovers; a second P while pinned counts as a step
  lost (the article has DE).
- **PC, Pinned with casualties** (new): pinned, and a step lost.
- **SL, Step lost** (new): a step lost, not pinned.
- **DE, Eliminated** and **DO, Obliterated** (as written; DO's follow-up shot at half OR).

Over all the columns, a shot does nothing 37% of the time (the article: 45%), suppresses 9%, pins 9%, pins with
casualties 9%, takes a step 8%, eliminates 8% (the article: 16%) and obliterates 21% (unchanged).

**Close Combat Results**, the same way: the article's NE becomes EN, or EX in the even columns (1:2, 1:1, 2:1);
its last AR becomes AD; its first DR becomes DD; at 10:1 and up a 12 is DS.

| 2d | 1:20 | 1:10 | 1:5 | 1:3 | 1:2 | 1:1 | 2:1 | 3:1 | 4:1 | 5:1 | 10:1 | 20:1+ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2- | AE | AE | AE | AE | AE | AE | AE | AR | AR | AD | EN | DD |
| 3 | AE | AE | AE | AE | AE | AE | AR | AR | AD | EN | DD | DR |
| 4 | AE | AE | AE | AE | AE | AR | AR | AD | EN | DD | DR | DR |
| 5 | AE | AE | AE | AE | AR | AR | AD | EN | DD | DR | DR | DE |
| 6 | AE | AE | AE | AR | AR | AD | EX | DD | DR | DR | DE | DE |
| 7 | AE | AE | AR | AR | AD | EX | DD | DR | DR | DE | DE | DE |
| 8 | AE | AR | AR | AD | EX | DD | DR | DR | DE | DE | DE | DE |
| 9 | AR | AR | AD | EN | DD | DR | DR | DE | DE | DE | DE | DE |
| 10 | AR | AD | EN | DD | DR | DR | DE | DE | DE | DE | DE | DE |
| 11 | AD | EN | DD | DR | DR | DE | DE | DE | DE | DE | DE | DE |
| 12+ | EN | DD | DR | DR | DE | DE | DE | DE | DE | DE | DS | DS |
- **AE, Attackers eliminated** and **AR, Attackers retreat** (as written).
- **AD, Attackers disrupted** (new): they lose a step and stay where they are, still adjacent.
- **EN, Engaged** (new): locked in melee. Neither side may move away or fire at anyone else; they fight again in
  the next Close Combat phase of either side.
- **EX, Bloody exchange** (new): both sides lose a step, and stay engaged.
- **DD, Defenders disrupted** (new): they lose a step and hold the hex.
- **DR, Defenders retreat** and **DE, Defenders eliminated** (as written).
- **DS, Defenders surrender** (new): eliminated, and taken prisoner (the Apostates' captives; anyone else's, a
  share of the loot).

**The dice themselves.**
- **A natural 2 when firing a weapon that gets hot** (plasma, the Malf 14 and 16 weapons): the firing element loses a
  step to its own guns instead of whatever the table says.
- **A natural 12** in any attack by an element with a named soldier: the result is one step worse for the target
  (NE becomes S, S becomes P, and so on), and the named soldier's history records the deed.
- **A natural 2 in close combat** by the attacker: one of its named soldiers is wounded (a scar, veterans.js).

**Breaking.** A reduced element that is pinned again **breaks**: it falls back two hexes toward its edge and may not
attack until a commander spends a Command Point to rally it. A side's demoralization is as the article has it.

**The factions' own.**
- **The Dormant:** an eliminated Dormant element rolls 1d at the end of the round, and on 5-6 it **reanimates** as a
  reduced element in its hex (the engine's reanimation protocols).
- **The Chorus:** elements within 3 hexes of a Conductor ignore S and their first P (synapse). In close combat
  their EN results count as EX: they don't stop.
- **The Brawl:** Impetuous, as the article has it (they must attack when they can). A Brawl element that gets DD,
  DR, DE or DS in close combat wins fame, and on an EX its Brawlers may grow into Bosses (factions.js).
- **The Hegemony:** an element with a Provost turns its AR into AD (the Provost shoots the first to run, and the
  rest stand) and ignores breaking once a battle.
- **The Apostates:** Vessels are Fanatic (the article's rule: they ignore DR, and AR counts as AE). DS results give
  them captives.

What the war reads from it: steps lost become soldiers lost (half an element a step), engaged elements at the end
of the battle count as a stalemate there, and surrenders and reanimations go into the report.

### The ratings: OR and PR for every unit
Each element's **OR** and **PR** are its soldiers' summed, worked out by the article's formulas from the same data
the engine fights with (`tools/resolver/cer.js`):
- **OR:** best attack's skill - 10 (+ Accuracy + 2 for a gun, + Rapid Fire's bonus, +5 for extra attacks), plus
  damage (dice x 3.5 + adds, x Rapid Fire's bonus + 1, x the type: 0.5 small piercing, 1.5 cutting or large
  piercing, 2 impaling, huge piercing or corrosion, +0.5 explosive; +5 a step of armour divisor), plus FP - 10 and
  Move - 6.
- **PR:** active defence ((Dodge - 8) x 2, or Parry - 8 if better), DR over skull, arms, legs and torso / 4, plus 1
  per 5 points of Damage Reduction, Injury Tolerance, Regeneration and reanimation, plus HT - 10 (+ half Hard to
  Kill, +2 High Pain Threshold), HP - 10, Will - 10 (+ half Fearlessness, +1 Combat Reflexes, +8 Unfazeable or no
  morale).
- An element **attacks with its OR** and **defends with its PR**: the ratio of the attacker's OR to the target's PR,
  after the article's modifiers, is the column on its table.
- **Classes** from the same data: Fire (has a gun), Neutralize Armor (armour divisor 3 or more), Armor (DR 60 or
  more over the body), Artillery (the heavy weapons that fire indirect or with a blast), Recon (Stealth or
  Chameleon: Lictors, Sneaks), C3I (Sergeants, Provosts, Conductors), and Mounted mobility for Move 8 or more.

**SCER.** The user's Scaled CER (`docs/scer-handoff.md`) is also worked out for every unit (`tools/resolver/cer.js`):
DR weighted by where hits land and half on the weakest spot, each sub-score through its curve (skill x + x²/7,
damage x^1.5, DR x^1.75, defence x(1 + x/5), HP, HT and Will x^1.2), and the synergy of lethal and hard to kill
(0.2 × √(OR × PR)). Its soft cap at 500 is lifted here: this setting's damage and DR run five to ten times
Dungeon Fantasy's (a lasgun is 7d(2), flak armour DR 30), so at 500 nearly every unit hit the cap and the scale
flattened again.

Today's units, worked out, and for comparison what each is worth in the engine (the war's measured `power`, in
Levies):

| Unit | Faction | Template | OR | PR | CER | SCER OR | SCER PR | SCER | SCER in Levies | Engine worth |
|---|---|---|---|---|---|---|---|---|---|---|
| Levy | Hegemony | Astra Militarum Guardsman | 95 | 32 | 127 | 763 | 287 | 1144 | 1.00 | 1 |
| Levy Sergeant | Hegemony | Astra Militarum Sergeant | 32 | 33 | 65 | 153 | 288 | 483 | 0.42 | 0.5 |
| Provost | Hegemony | Commissar | 53 | 28 | 81 | 283 | 77 | 390 | 0.34 | 1.5 |
| Storm Levy | Hegemony | Militarum Tempestus Scion | 114 | 78 | 192 | 983 | 1543 | 2772 | 2.42 | 13 |
| Oathsister | Hegemony | Adepta Sororitas Battle Sister | 63 | 89 | 152 | 366 | 1758 | 2284 | 2.00 | 8 |
| Warden | Hegemony | Astartes Battle-Brother | 119 | 141 | 260 | 906 | 2872 | 4101 | 3.58 | 41 |
| Faithless | Apostates | Chaos Cultist | 85 | 10 | 95 | 677 | 40 | 750 | 0.66 | 0.3 |
| Turncoat | Apostates | Traitor Guardsman | 97 | 24 | 121 | 765 | 70 | 881 | 0.77 | 1.4 |
| Zealot | Apostates | Chaos Cultist Champion | 30 | 13 | 43 | 151 | 44 | 211 | 0.18 | 0.2 |
| Vessel | Apostates | Possessed | 91 | 164 | 255 | 511 | 3451 | 4228 | 3.70 | 17 |
| Fallen Warden | Apostates | Chaos Space Marine | 122 | 140 | 262 | 919 | 2628 | 3858 | 3.37 | 51 |
| Runt | Brawl | Gretchin | 14 | 1 | 15 | 32 | 1 | 34 | 0.03 | 0.1 |
| Brawler | Brawl | Ork Boy | 48 | 44 | 92 | 247 | 143 | 428 | 0.37 | 0.5 |
| Sneak | Brawl | Ork Kommando | 48 | 44 | 92 | 247 | 143 | 428 | 0.37 | 0.5 |
| Boss | Brawl | Ork Nob | 160 | 103 | 263 | 1756 | 1369 | 3435 | 3.00 | 2.7 |
| Ironhide | Brawl | Ork Meganob | 157 | 205 | 362 | 1746 | 7273 | 9732 | 8.51 | 12 |
| Leaper | Chorus | Hormagaunt | 47 | 24 | 71 | 223 | 277 | 550 | 0.48 | 0.4 |
| Spitter | Chorus | Termagant | 46 | 20 | 66 | 241 | 272 | 564 | 0.49 | 0.4 |
| Stalker | Chorus | Genestealer | 74 | 94 | 168 | 391 | 1369 | 1906 | 1.67 | 39 |
| Conductor | Chorus | Tyranid Warrior | 95 | 104 | 199 | 711 | 1759 | 2694 | 2.35 | 20 |
| Hollow | Chorus | Lictor | 74 | 105 | 179 | 437 | 1762 | 2374 | 2.08 | 5 |
| Bulwark | Chorus | Carnifex | 153 | 327 | 480 | 1612 | 8813 | 11179 | 9.77 | 20 |
| Husk | Dormant | Necron Warrior | 80 | 105 | 185 | 556 | 1794 | 2550 | 2.23 | 16 |
| Sentinel | Dormant | Necron Immortal | 89 | 142 | 231 | 640 | 3289 | 4219 | 3.69 | 20 |
| Watcher | Dormant | Deathmark | 62 | 118 | 180 | 315 | 2250 | 2733 | 2.39 | 35 |
| Flenser | Dormant | Flayed One | 48 | 105 | 153 | 240 | 1794 | 2165 | 1.89 | 14 |
| Keeper | Dormant | Lychguard | 82 | 172 | 254 | 614 | 4821 | 5779 | 5.05 | 20 |
| Local Defence | free worlds | Traitor Guardsman | 97 | 24 | 121 | 765 | 70 | 881 | 0.77 | 1.4 |

**What the numbers say.** How far each rating is from the engine's worth, over the 28 units (the order: rank
correlation with the engine's; the scale: how far off a unit typically is, as a factor, once the rating is lined up
with the Levy):

| Rating | Order | Typically off by | A Warden, in Levies (engine 41) |
|---|---|---|---|
| CER, as the article gives it | 0.82 | ×3.4 | 2.0 |
| SCER, as the handoff gives it (cap 500) | 0.80 | ×2.7 | 2.3 |
| SCER, no cap | 0.81 | ×2.4 | 3.6 |
| SCER, no cap, raised to its best-fitting power (1.3) | 0.81 | ×2.2 | |
| A matchup rating (prototype, below), raised to its best-fitting power (0.41) | 0.89 | ×1.56 | 24 |

CER and SCER both get the order about right and the scale wrong. The reason is the one the handoff names as its
issue 5: neither can see whether an attack gets through. The OR counts a weapon's damage whatever it's fired at, so
lasguns (7d(2)) count the same against Cultists (DR 8) as against Wardens (DR 95), and the Brawl's Shootas, many
shots of small damage, rate above a boltgun; in the engine they barely scratch power armour.

The **matchup rating** prototype works it out pair by pair: how often each hits the other (3d6 against skill, less
the other's Dodge), how much of each hit gets past the other's DR (by armour divisor) by damage type, shots a turn,
and the other's HP; a unit's worth against a foe is the square root of what it does to the foe over what the foe
does to it (Lanchester), relative to a Levy's, averaged over the reference foes the war's `power` was measured
against. Raw, it overshoots wildly (full immunity makes worth explode: a Carnifex 15,000 Levies), but with one
fitted power it lands within ×1.56 of the engine on average, with Storm Levies, Husks, Sentinels, Vessels and
Bosses within a fifth. Its worst misses: Genestealers and Watchers rated a third of what they're worth (their
edge is Deceptive Attacks and the first strike at range, which it doesn't count), Ironhides and Bulwarks three
times (big bodies the engine's guns can still reach).

**Checked on the Warden** (user question: are a Space Marine's numbers right?). The inputs match the codex's
823-point Battle-Brother: ST 30, HT 15, HP 34, Will 14, Guns (Rifle) 20, Broadsword 19, Dodge 12, Parry 13, Move 12,
Mk VII power armour DR 100 (skull, torso) and 88 (arms, legs) with the Ossmodula's DR 3, the boltgun 6d×2(2) pi++.
Two traits were missed because the engine doesn't carry them and are now read from the codex's write-up: the
Secondary Heart (Hard to Kill 2) and Larraman's Organ (Rapid Healing). DR is already the biggest part of its
rating: 95 in CER, which at the article's 1 per 5 points is the same as about 475 points, and in SCER about 2,880 of
its PR of 2,876, ten times the Levy's. What was wrong was comparing totals: the Levy's lasgun counted in full
against armour it can't get through. Fought on Tactical Mass Combat's fire table with OR against PR, the Warden still
comes out at only 4.2 Levies, because the table can't go further: at 1:5 a 12 on 2d still kills, about 3% a shot.
With the damage in each attack counting only what gets past the target's DR, a Levy element's fire on Wardens
falls below 1:10, the table's "no effect", as lasguns do in the engine. The engine's 41 is finite only because
massed lasguns now and then find a gap or a critical; on the table that is up to four elements combining their fire
in one attack, and how much gets through that way is fitted to the engine.

**Decided (user direction): Tactical Mass Combat as written, for now.** The engine is for watching a battle in 3D,
not the yardstick the war is tuned to. So:
1. **SCER is the rating** every unit carries (OR and PR, uncapped for this setting's numbers), and an element's OR
   and PR are its soldiers' summed.
2. **The tables as the article gives them:** the attacker's OR against the target's PR, with the article's
   modifiers, rounded in the defender's favour, up to four elements combining fire. No matchup layer and nothing
   fitted to the engine: armour counts through the target's PR, as the article and the handoff have it.
3. **Mass Combat's classes as written** for what the totals can't show: Armor and Neutralize Armor (the article's
   rule for an element that can only hurt Armor), Artillery, Recon, C3I, and Mounted mobility, from the unit data as
   above.

How it plays, for the case asked about (ten Levies a squad against ten Wardens, each squad one element), on the
article's table: one Levy squad firing at a Warden squad is at 1:5 (pinned on 11-12: 8% a shot, never eliminated);
two or three combining fire are at 1:2 (pinned or worse 28%, eliminated 8%); four, the most that may combine, at 1:1
(42% and 17%). A Warden squad firing at a Levy squad is at 3:1 (72% and 42%). (Corrected: the first figures here
came from a misreading of the table, one P a column where it has two.) So massed Levies can bring Wardens down on the table, at a price, where in the
engine they can't. That is the difference between the two this decision accepts; the 3D replay of such a battle may
end differently from the war's own result, and the report says which is the record (the hex map).

### Measured, not tuned
The engine's kept battles (`tools/resolver/truth.js`) still score each version (`tools/resolver/score.js`), as
information: how far the war's results are from what the engine would do, by ground and size, so the difference
is known and can be revisited. Nothing is fitted to them. Measured on the sample wars after: battle sizes, close
fights, outcomes, balance.

### Watching a battle
- Every battle can be watched on its **hex map**: counters for each element by faction, moving and firing round by
  round, exactly as the war resolved it (the same seed gives the same battle), with each round's results in a feed.
- **Watch in 3D** stays: the engine fights the same armies on the region's map, as now. It won't always end the same
  way; the hex map is the war's own record.

### The order to build in
1. SCER for every unit, and its classes and mobility.
2. Tactical Mass Combat itself: the map from the ground, elements, the recon contest, the two tables, commanders,
   demoralization, and the AI for both sides. Measured against the engine's kept battles, for information.
3. In the war: it decides battles, gives the AI and the player their odds, and the reports say what happened round
   by round. Measured on the sample wars.
4. The hex map view of a battle in the client.
5. Then the bigger armies and new units (above), whose new weapons get their ratings the same way.

### As built
`game/world/tmc.js`, with the ratings in `game/world/ratings.json` (`tools/resolver/ratings.js`, SCER uncapped, an
OR for fire and one for close combat). Built as drafted, with these choices and changes, each from watching it:
- **Scale:** a hex is 20 yards; Foot moves 3 hexes a turn and Mounted (Move 10 or more) 5, at the article's terrain
  costs; a gun's range is its half-damage range in hexes. The map is 18 to 40 hexes wide by the number of elements.
  Towns and cities get **streets** (every third row and column open): without them, built-up blobs left no line of
  fire anywhere and nearly every city battle stalled.
- **Lines of fire** follow the article's spotting rule: into, but not through, woods, built-up or high ground.
- **Commanders:** a warband's leader's skill counts for both Leadership and Strategy (so Command Points are half
  of it), the same for Intelligence Analysis in the Reconnaissance Contest; others 1d+8, a tomb lord 12. Mass
  Combat's Terrain Ratings (Plains 8 ... Jungle 3, halved at night) set surprise and ambush.
- **The attacker grows bolder:** it assaults at 1:1, from the fourth round at 1:2, from the seventh at 1:3 (or at any
  odds if it must, Impetuous or Fanatic, or is already locked in). Holding garrisons stay in their buildings.
- **Ending:** a demoralized side still demoralized a round later withdraws (the article lets the GM rule that a
  demoralized force has lost); a battle still going after 16 rounds is a stalemate. A stalemate where hardly anyone
  fell (under 5% between them) is a **standoff**: the attacker found no way in and pulls back where it came from.
  Without that, small swarms sat in the same region fighting the same quiet battle every turn.
- **The AI's odds** are the share of real wins over 4 to 8 quick battles; a likely stalemate no longer counts as half
  a win when the Chorus and the Dormant choose where to strike.
- **Kept from before:** a city's rally, the Dormant's repair after a battle they hold, the veterans' leader bonus
  and supply's x0.8 (as OR), named soldiers' worth (as their element's), a world's defence and walls in its cities (as
  PR), fortify (as earthworks). Live battles still settle by the engine's result.

**Measured** (8 wars of 60 turns, two scripted warbands a player faction): 138 battles a war, 42 soldiers on the
field on average, about 10 rounds; the winner's odds 40-60% in 18% of battles (2% before), 95%+ in 29% (91%
before); 6 upsets a war, 33 stalemates, 3 repulses, 8 Pyrrhic victories, 12 ambushes and 67 surprises (half of all
battles: city and night Terrain Ratings are low), night in about half. Balance over 24 wars at turn 60: Hegemony
3.2, Apostates 5.8, Brawl 6.3, Chorus 4.6, Dormant 1.7 (wiped out in 3 of 24); before, 2.4, 5.3, 5.0, 7.3, 2.5.
**Against the engine** (174 kept battles, for information): Tactical Mass Combat picks the engine's favourite in
118 (68%) and its win chance is 31 points off on average (the old resolver: 4.7). That is the decision taken: the
war follows the article, and the 3D replay of a battle may end differently from the war's record.

### Not in this pass
Air, transports and vehicles (the war has no vehicles yet), off-map artillery, battles of more than two factions,
and fighting a Tactical Mass Combat battle yourself.
