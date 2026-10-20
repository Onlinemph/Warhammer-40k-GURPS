// The war's setting (docs/setting.md): each faction's own units on top of a combat template the engine and the
// resolver know. This is the re-skin layer: rename here (and later swap the templates for the setting's own)
// without touching the GURPS data.
//
// Costs are per soldier, set from what each is worth: `power` is how many Levies one is worth, measured with the
// resolver as the fewest of it that beat each of seven reference armies (a hundred Levies, Brawlers or Turncoats, a
// Chorus brood, twenty Wardens, thirty Bosses, thirty Husks), against the Levies it takes, a geometric mean.
// `melee`: fights mainly hand to hand (a night battle favours such a side, battle.js). The AI uses power for its sums of who is stronger; the resolver does the real reckoning. Within a faction the
// prices follow power; across factions each faction's prices are scaled so that equal-cost armies of its usual mix
// break even with the Brawl's (the Hegemony x0.31, the Apostates x0.88): recruiting stays cheap.
const UNITS = {
  // the Hegemony: a decaying empire's levies and its rare grown super-soldiers
  levy:       { faction: "hegemony",  name: "Levy",          template: "Astra Militarum Guardsman",      cost: { manpower: 0.3, materiel: 0.3 },       power: 1 },
  sergeant:   { faction: "hegemony",  name: "Levy Sergeant", template: "Astra Militarum Sergeant",       cost: { manpower: 0.3, materiel: 0.3 },       power: 0.5 },
  provost:    { faction: "hegemony",  name: "Provost",       template: "Commissar",                      cost: { manpower: 0.3, materiel: 0.6 },       power: 1.5 },
  storm:      { faction: "hegemony",  name: "Storm Levy",    template: "Militarum Tempestus Scion",      cost: { manpower: 1.5, materiel: 6.5 },      power: 13 },
  oathsister: { faction: "hegemony",  name: "Oathsister",    template: "Adepta Sororitas Battle Sister", cost: { manpower: 1, materiel: 4 },      power: 8 },
  warden:     { faction: "hegemony",  name: "Warden",        template: "Astartes Battle-Brother",        cost: { manpower: 5, materiel: 20 },     power: 41 },
  // the Apostates: Hegemony worlds that opened a forbidden edict early, and the Hosts that answered
  faithless:  { faction: "apostates", name: "Faithless",     template: "Chaos Cultist",                  cost: { manpower: 0.45, materiel: 0.45 },   power: 0.3 },
  turncoat:   { faction: "apostates", name: "Turncoat",      template: "Traitor Guardsman",              cost: { manpower: 0.9, materiel: 1.8 },       power: 1.4 },
  zealot:     { faction: "apostates", name: "Zealot",        template: "Chaos Cultist Champion",         cost: { manpower: 0.45, materiel: 0.45 },   power: 0.2 },
  vessel:     { faction: "apostates", name: "Vessel",        template: "Possessed",                      cost: { manpower: 6, materiel: 24 },      power: 17, melee: true },
  fallen:     { faction: "apostates", name: "Fallen Warden", template: "Chaos Space Marine",             cost: { manpower: 18, materiel: 70 },     power: 51 },
  // the Brawl: a brute species that treats war as sport
  runt:       { faction: "brawl",     name: "Runt",          template: "Gretchin",                       cost: { manpower: 0.25, materiel: 0.25 }, power: 0.1 },
  brawler:    { faction: "brawl",     name: "Brawler",       template: "Ork Boy",                        cost: { manpower: 0.5, materiel: 0.5 },   power: 0.5, melee: true },
  sneak:      { faction: "brawl",     name: "Sneak",         template: "Ork Kommando",                   cost: { manpower: 0.5, materiel: 1 },     power: 0.5 },
  boss:       { faction: "brawl",     name: "Boss",          template: "Ork Nob",                        cost: { manpower: 2, materiel: 4, fame: 3 },       power: 2.7, melee: true },
  ironhide:   { faction: "brawl",     name: "Ironhide",      template: "Ork Meganob",                    cost: { manpower: 6, materiel: 18, fame: 10 },      power: 12, melee: true },
  // the Chorus: one hungry intelligence wearing a million bodies (AI)
  leaper:     { faction: "chorus",    name: "Leaper",        template: "Hormagaunt",                     cost: { biomass: 1 },  power: 0.1, melee: true },
  spitter:    { faction: "chorus",    name: "Spitter",       template: "Termagant",                      cost: { biomass: 1 },  power: 0.1 },
  stalker:    { faction: "chorus",    name: "Stalker",       template: "Genestealer",                    cost: { biomass: 20 }, power: 39, melee: true },
  conductor:  { faction: "chorus",    name: "Conductor",     template: "Tyranid Warrior",                cost: { biomass: 15 }, power: 20 },
  hollow:     { faction: "chorus",    name: "Hollow",        template: "Lictor",                         cost: { biomass: 12 }, power: 5, melee: true },
  bulwark:    { faction: "chorus",    name: "Bulwark",       template: "Carnifex",                       cost: { biomass: 40 }, power: 20, melee: true },
  // the Dormant: the galaxy's last rulers, waking in their tombs (AI). They never recruit: what wakes is all there is
  husk:       { faction: "dormant",   name: "Husk",          template: "Necron Warrior",                 cost: {}, power: 16 },
  sentinel:   { faction: "dormant",   name: "Sentinel",      template: "Necron Immortal",                cost: {}, power: 20 },
  watcher:    { faction: "dormant",   name: "Watcher",       template: "Deathmark",                      cost: {}, power: 35 },
  flenser:    { faction: "dormant",   name: "Flenser",       template: "Flayed One",                     cost: {}, power: 14, melee: true },
  keeper:     { faction: "dormant",   name: "Keeper",        template: "Lychguard",                      cost: {}, power: 20, melee: true },
};
// `basic` is what a faction's supplied worlds raise as local levies each turn
const FACTIONS = {
  hegemony:  { name: "The Hegemony",  colour: "#c9a227", player: true,  basic: "levy",
    blurb: "A decaying human empire that still obeys the sealed edicts of a Founder dead ten thousand years. Numbers, discipline, and a few grown super-soldiers it can barely spare." },
  apostates: { name: "The Apostates", colour: "#b0304a", player: true,  basic: "faithless",
    blurb: "Hegemony worlds that opened a forbidden edict early and found the Hosts behind it, powers from outside reality that answer prayers." },
  brawl:     { name: "The Brawl",     colour: "#4caf50", player: true,  basic: "brawler",
    blurb: "A brute species for whom war is the only sport worth watching. They grow bigger the more they fight." },
  chorus:    { name: "The Chorus",    colour: "#a24bd1", player: false,
    blurb: "One hungry intelligence wearing a million bodies, speaking with the voices of those it has eaten." },
  dormant:   { name: "The Dormant",   colour: "#3fb8a0", player: false,
    blurb: "The galaxy's last rulers, archived in tomb-worlds before humanity learned fire, and waking up." },
};
// the unclaimed worlds' own defenders
const MILITIA = { name: "Local Defence", template: "Traitor Guardsman" };
// world types (galaxy.js has what each produces)
const WORLD_NAMES = { hive: "Spire world", forge: "Foundry world", agri: "Granary world", fortress: "Bastion", death: "Wildworld" };

const templateOf = id => id === "militia" ? MILITIA.template : UNITS[id].template;
const nameOf = id => id === "militia" ? MILITIA.name : UNITS[id].name;
module.exports = { UNITS, FACTIONS, MILITIA, WORLD_NAMES, templateOf, nameOf };
