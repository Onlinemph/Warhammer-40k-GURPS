// The war's setting (docs/setting.md): each faction's own units on top of a combat template the engine and the
// resolver know. This is the re-skin layer: rename here (and later swap the templates for the setting's own)
// without touching the GURPS data.
//
// `power` is how many Levies one is worth as the war now fights (Tactical Mass Combat: tools/resolver/price.js,
// against a line of Levies, a mob of Brawlers, Wardens and a Chorus brood); the units added with the bigger armies are
// priced from it at their faction's rate for its line troops, never below a line trooper. The older prices, below,
// were set from the engine-calibrated resolver's measure of the same thing:
// Costs are per soldier, set from what each is worth: `power` was how many Levies one is worth, measured with the
// resolver as the fewest of it that beat each of seven reference armies (a hundred Levies, Brawlers or Turncoats, a
// Chorus brood, twenty Wardens, thirty Bosses, thirty Husks), against the Levies it takes, a geometric mean.
// `melee`: fights mainly hand to hand (a night battle favours such a side, battle.js). The AI uses power for its sums of who is stronger; the resolver does the real reckoning. Within a faction the
// prices follow power; across factions each faction's prices are scaled so that equal-cost armies of its usual mix
// break even with the Brawl's (the Hegemony x0.31, the Apostates x0.88): recruiting stays cheap.
const UNITS = {
  // the Hegemony: a decaying empire's levies and its rare grown super-soldiers
  levy:       { faction: "hegemony",  name: "Levy",          template: "Astra Militarum Guardsman",      cost: { manpower: 0.3, materiel: 0.3 },       power: 1 },
  sergeant:   { faction: "hegemony",  name: "Levy Sergeant", template: "Astra Militarum Sergeant", role: "specialist",       cost: { manpower: 0.3, materiel: 0.3 },       power: 0.4 },
  provost:    { faction: "hegemony",  name: "Provost",       template: "Commissar", role: "specialist",                      cost: { manpower: 0.3, materiel: 0.6 },       power: 0.06 },
  storm:      { faction: "hegemony",  name: "Storm Levy",    template: "Militarum Tempestus Scion", role: "elite",      cost: { manpower: 1.5, materiel: 6.5 },      power: 2 },
  oathsister: { faction: "hegemony",  name: "Oathsister",    template: "Adepta Sororitas Battle Sister", role: "elite", cost: { manpower: 1, materiel: 4 },      power: 0.5 },
  warden:     { faction: "hegemony",  name: "Warden",        template: "Astartes Battle-Brother", role: "elite",        cost: { manpower: 5, materiel: 20 },     power: 2.1 },
  // (more kinds: special and heavy weapons carried by Levies, a sniper, a psyker)
  levy_gunner:  { faction: "hegemony", name: "Levy Gunner",  template: "Astra Militarum Guardsman", weapon: "Plasma Gun",   role: "special",    cost: { manpower: 0.1, materiel: 0.4 }, power: 1 },
  levy_burner:  { faction: "hegemony", name: "Levy Burner",  template: "Astra Militarum Guardsman", weapon: "Flamer",       role: "special",    cost: { manpower: 0.1, materiel: 0.4 }, power: 0.03 },
  levy_melta:   { faction: "hegemony", name: "Levy Melta",   template: "Astra Militarum Guardsman", weapon: "Meltagun",     role: "special",    cost: { manpower: 0.1, materiel: 0.4 }, power: 0.5 },
  heavy_team:   { faction: "hegemony", name: "Heavy Team",   template: "Astra Militarum Guardsman", weapon: "Heavy Bolter", role: "heavy",      cost: { manpower: 0.4, materiel: 1.1 }, power: 2.5 },
  marksman:     { faction: "hegemony", name: "Marksman",     template: "Astra Militarum Guardsman", weapon: "Long-Las",     role: "specialist", cost: { manpower: 0.3, materiel: 0.3 }, power: 0.3 },
  seer:         { faction: "hegemony", name: "Seer",         template: "Sanctioned Psyker",                                 role: "specialist", cost: { manpower: 0.3, materiel: 0.3 },   power: 0.2 },
  // the Apostates: Hegemony worlds that opened a forbidden edict early, and the Hosts that answered
  faithless:  { faction: "apostates", name: "Faithless",     template: "Chaos Cultist",                  cost: { manpower: 0.45, materiel: 0.45 },   power: 0.5 },
  turncoat:   { faction: "apostates", name: "Turncoat",      template: "Traitor Guardsman",              cost: { manpower: 0.9, materiel: 1.8 },       power: 0.6 },
  zealot:     { faction: "apostates", name: "Zealot",        template: "Chaos Cultist Champion", role: "specialist",         cost: { manpower: 0.45, materiel: 0.45 },   power: 0.2 },
  vessel:     { faction: "apostates", name: "Vessel",        template: "Possessed", role: "elite",                      cost: { manpower: 6, materiel: 24 },      power: 1.1, melee: true },
  fallen:     { faction: "apostates", name: "Fallen Warden", template: "Chaos Space Marine", role: "elite",             cost: { manpower: 18, materiel: 70 },     power: 2.1 },
  turncoat_gunner: { faction: "apostates", name: "Turncoat Gunner", template: "Traitor Guardsman", weapon: "Plasma Gun",    role: "special",    cost: { manpower: 0.4, materiel: 1.2 }, power: 0.5 },
  turncoat_burner: { faction: "apostates", name: "Turncoat Burner", template: "Traitor Guardsman", weapon: "Flamer",        role: "special",    cost: { manpower: 0.2, materiel: 0.7 }, power: 0.02 },
  turncoat_heavy:  { faction: "apostates", name: "Turncoat Heavy",  template: "Traitor Guardsman", weapon: "Heavy Stubber", role: "heavy",      cost: { manpower: 1, materiel: 2.9 }, power: 1.2 },
  frenzied:        { faction: "apostates", name: "Frenzied",        template: "Khorne Berzerker",                          role: "elite",      cost: { manpower: 0.8, materiel: 2.5 }, power: 1, melee: true },
  rotted:          { faction: "apostates", name: "Rotted",          template: "Plague Marine",                             role: "elite",      cost: { manpower: 1.9, materiel: 5.7 }, power: 2.4 },
  hierophant:      { faction: "apostates", name: "Hierophant",      template: "Chaos Sorcerer",                            role: "specialist", cost: { manpower: 3, materiel: 3 }, power: 1.9 },
  // the Brawl: a brute species that treats war as sport
  runt:       { faction: "brawl",     name: "Runt",          template: "Gretchin", role: "troops",                       cost: { manpower: 0.25, materiel: 0.25 }, power: 0.01 },
  brawler:    { faction: "brawl",     name: "Brawler",       template: "Ork Boy",                        cost: { manpower: 0.5, materiel: 0.5 },   power: 0.4, melee: true },
  sneak:      { faction: "brawl",     name: "Sneak",         template: "Ork Kommando", role: "specialist",                   cost: { manpower: 0.5, materiel: 1 },     power: 0.3 },
  boss:       { faction: "brawl",     name: "Boss",          template: "Ork Nob", role: "elite",                        cost: { manpower: 2, materiel: 4, fame: 3 },       power: 2.3, melee: true },
  ironhide:   { faction: "brawl",     name: "Ironhide",      template: "Ork Meganob", role: "elite",                    cost: { manpower: 6, materiel: 18, fame: 10 },      power: 3.4, melee: true },
  burna:      { faction: "brawl", name: "Burna",      template: "Ork Boy", weapon: "Burna",              role: "special",    cost: { manpower: 0.2, materiel: 0.8 }, power: 0.3, melee: true },
  rokkit:     { faction: "brawl", name: "Rokkit",     template: "Ork Boy", weapon: "Rokkit Launcha",     role: "special",    cost: { manpower: 0.5, materiel: 1.5 }, power: 0.7 },
  big_shoota: { faction: "brawl", name: "Big Shoota", template: "Ork Boy", weapon: "Big Shoota",         role: "heavy",      cost: { manpower: 0.9, materiel: 2.6 }, power: 1.3 },
  mek:        { faction: "brawl", name: "Mek",        template: "Ork Mek", weapon: "Kustom Mega-Blasta", role: "specialist", cost: { manpower: 0.8, materiel: 0.8 },     power: 0.6 },
  weirdboy:   { faction: "brawl", name: "Weirdboy",   template: "Ork Weirdboy",                          role: "specialist", cost: { manpower: 0.5, materiel: 0.5, fame: 3 }, power: 0.06 },
  // the Chorus: one hungry intelligence wearing a million bodies (AI)
  leaper:     { faction: "chorus",    name: "Leaper",        template: "Hormagaunt",                     cost: { biomass: 1 },  power: 0.5, melee: true },
  spitter:    { faction: "chorus",    name: "Spitter",       template: "Termagant",                      cost: { biomass: 1 },  power: 0.06 },
  stalker:    { faction: "chorus",    name: "Stalker",       template: "Genestealer",                    cost: { biomass: 20 }, power: 1, melee: true },
  conductor:  { faction: "chorus",    name: "Conductor",     template: "Tyranid Warrior",                cost: { biomass: 15 }, power: 0.9 },
  hollow:     { faction: "chorus",    name: "Hollow",        template: "Lictor",                         cost: { biomass: 12 }, power: 1.1, melee: true },
  bulwark:    { faction: "chorus",    name: "Bulwark",       template: "Carnifex",                       cost: { biomass: 40 }, power: 3.5, melee: true },
  burrower:   { faction: "chorus", name: "Burrower",   template: "Ravener",                                   cost: { biomass: 17 }, power: 1.2, melee: true },
  mindspike:  { faction: "chorus", name: "Mindspike",  template: "Zoanthrope",                                cost: { biomass: 5 }, power: 0.2 },
  bonewarrior:{ faction: "chorus", name: "Bonewarrior", template: "Tyranid Warrior (Bonesword and Lash Whip)", cost: { biomass: 13 }, power: 0.9, melee: true },
  overmind:   { faction: "chorus", name: "Overmind",   template: "Hive Tyrant",                               cost: { biomass: 40 }, power: 2.8 },
  // the Dormant: the galaxy's last rulers, waking in their tombs (AI). They never recruit: what wakes is all there is
  husk:       { faction: "dormant",   name: "Husk",          template: "Necron Warrior",                 cost: {}, power: 1 },
  sentinel:   { faction: "dormant",   name: "Sentinel",      template: "Necron Immortal",                cost: {}, power: 1.9 },
  watcher:    { faction: "dormant",   name: "Watcher",       template: "Deathmark",                      cost: {}, power: 1 },
  flenser:    { faction: "dormant",   name: "Flenser",       template: "Flayed One",                     cost: {}, power: 0.6, melee: true },
  keeper:     { faction: "dormant",   name: "Keeper",        template: "Lychguard",                      cost: {}, power: 2, melee: true },
  reaper:     { faction: "dormant", name: "Reaper",     template: "Skorpekh Destroyer", cost: {}, power: 2.1, melee: true },
  cryptek:    { faction: "dormant", name: "Cryptek",    template: "Cryptek",            cost: {}, power: 2.1 },
  overlord:   { faction: "dormant", name: "Overlord",   template: "Necron Overlord",    cost: {}, power: 2, melee: true },
  heavy_husk: { faction: "dormant", name: "Heavy Husk", template: "Necron Warrior", weapon: "Heavy Gauss Cannon", cost: {}, power: 6.1 },
  // the free worlds' Local Defence: its sergeants and heavy stubbers, one of each to every ten (regions.js)
  militia_sgt:   { faction: "militia", name: "Defence Sergeant", template: "Astra Militarum Sergeant", cost: {}, power: 0.4 },
  militia_heavy: { faction: "militia", name: "Defence Heavy",    template: "Traitor Guardsman", weapon: "Heavy Stubber", cost: {}, power: 1.2 },
};
// every count in the war is this many times what it was before the bigger armies (docs/setting.md): warbands,
// garrisons, levies, broods, sleepers, yields, stockpiles; what's measured per soldier (power, ratings) is not
const SCALE = 10;
// the key of a unit's ratings (ratings.json): its template, and its gun if it carries another than the template's
const ratingKey = id => id === "militia" ? MILITIA.template : UNITS[id].weapon ? `${UNITS[id].template}|${UNITS[id].weapon}` : UNITS[id].template;
// `basic` is what a faction's supplied worlds raise as local levies each turn
const FACTIONS = {
  hegemony:  { name: "The Hegemony",  colour: "#c9a227", player: true,  basic: "levy", line: ["levy"],
    blurb: "A decaying human empire that still obeys the sealed edicts of a Founder dead ten thousand years. Numbers, discipline, and a few grown super-soldiers it can barely spare." },
  apostates: { name: "The Apostates", colour: "#b0304a", player: true,  basic: "faithless", line: ["turncoat", "faithless"],
    blurb: "Hegemony worlds that opened a forbidden edict early and found the Hosts behind it, powers from outside reality that answer prayers." },
  brawl:     { name: "The Brawl",     colour: "#4caf50", player: true,  basic: "brawler", line: ["brawler"],
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
module.exports = { UNITS, FACTIONS, MILITIA, WORLD_NAMES, templateOf, nameOf, ratingKey, SCALE };
