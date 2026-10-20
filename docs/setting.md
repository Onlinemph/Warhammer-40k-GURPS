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
Chorus).

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

