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
