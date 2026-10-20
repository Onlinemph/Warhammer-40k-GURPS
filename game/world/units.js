// The war's unit types: each faction's own names on top of a combat template the engine and the resolver know.
// This is where the re-skin to the war's own setting happens: rename here (and later swap the templates for the
// setting's own) without touching the GURPS data. Costs are per soldier.
const UNITS = {
  // the Hegemony: a decaying empire's levies and its rare grown super-soldiers
  levy:      { faction: "hegemony", name: "Levy Trooper",      template: "Astra Militarum Guardsman", cost: { manpower: 1, materiel: 1 } },
  storm:     { faction: "hegemony", name: "Storm Levy",        template: "Militarum Tempestus Scion", cost: { manpower: 1, materiel: 4 } },
  warden:    { faction: "hegemony", name: "Warden",            template: "Astartes Battle-Brother",   cost: { manpower: 4, materiel: 12 } },
  // the Brawl: a brute species that treats war as sport
  brawler:   { faction: "brawl",    name: "Brawler",           template: "Ork Boy",                   cost: { manpower: 1, materiel: 1 } },
  boss:      { faction: "brawl",    name: "Boss",              template: "Ork Nob",                   cost: { manpower: 2, materiel: 3 } },
  runt:      { faction: "brawl",    name: "Runt",              template: "Gretchin",                  cost: { manpower: 0.5, materiel: 0.5 } },
  // the Chorus: one hungry intelligence wearing a million bodies (AI-run)
  leaper:    { faction: "chorus",   name: "Leaper",            template: "Hormagaunt",                cost: { biomass: 1 } },
  spitter:   { faction: "chorus",   name: "Spitter",           template: "Termagant",                 cost: { biomass: 1 } },
  stalker:   { faction: "chorus",   name: "Stalker",           template: "Genestealer",               cost: { biomass: 6 } },
  conductor: { faction: "chorus",   name: "Conductor",         template: "Tyranid Warrior",           cost: { biomass: 10 } },
};
const FACTIONS = {
  hegemony: { name: "The Hegemony", colour: "#c9a227", player: true },
  brawl:    { name: "The Brawl",    colour: "#4caf50", player: true },
  chorus:   { name: "The Chorus",   colour: "#a24bd1", player: false },
};
module.exports = { UNITS, FACTIONS };
