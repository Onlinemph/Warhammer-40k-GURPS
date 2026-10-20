  // Named paint schemes a side can be given in the 3D view instead of its faction's default: main colour, second
  // (trim), skin, metal, eye glow. They repaint the built miniatures and, through the game's own team-colour masks,
  // the models from a local Dawn of War pack.
  const SKIN = 0xd9a982, STEEL = 0xa9a9b0, ORK = 0x4f7a2e, ELF = 0xe8d8c8;
  const COLOUR_SCHEMES = [
    ["Adeptus Astartes", [
      ["Ultramarines", [0x1f3f8f, 0xc9a24a, SKIN, STEEL, 0xff3a2a]], ["Blood Angels", [0x9a1410, 0xc9a24a, SKIN, STEEL, 0x4aff7a]],
      ["Dark Angels", [0x0f3a24, 0x8a1a14, SKIN, STEEL, 0xff3a2a]], ["Imperial Fists", [0xd9a514, 0x1a1a1e, SKIN, STEEL, 0xff3a2a]],
      ["Space Wolves", [0x7c8fa0, 0xd9c14a, SKIN, STEEL, 0xffd03a]], ["Salamanders", [0x1f6a2a, 0x1a1a1e, 0x2a2420, STEEL, 0xff3a2a]],
      ["Raven Guard", [0x18181c, 0xd8d8d8, 0xe6e2d8, STEEL, 0xff3a2a]], ["White Scars", [0xe6e2d8, 0x9a1410, SKIN, STEEL, 0xff3a2a]],
      ["Iron Hands", [0x1c1e22, 0xa9a9b0, SKIN, STEEL, 0x7ad8ff]], ["Black Templars", [0x16161a, 0xe6e2d8, SKIN, STEEL, 0xff3a2a]],
      ["Crimson Fists", [0x1a2a5a, 0x9a1410, SKIN, STEEL, 0xff3a2a]], ["Blood Ravens", [0x7a1418, 0xd8cfb8, SKIN, STEEL, 0x4aff7a]]]],
    ["Heretic Astartes", [
      ["Black Legion", [0x18181c, 0xb08a3a, SKIN, 0x9a7a3a, 0xff3a2a]], ["World Eaters", [0x8a1c1c, 0xa07a3a, SKIN, 0xa07a3a, 0xff5a3a]],
      ["Death Guard", [0x6f7a45, 0x8a6a3a, 0xb8c08a, 0x7a6a4a, 0xc8ff5a]], ["Thousand Sons", [0x1f5fa0, 0xc9a347, SKIN, 0xc9a347, 0x7affff]],
      ["Emperor's Children", [0x6a2a8a, 0xc9a347, 0xe0c0d0, 0xc9a347, 0x7affea]], ["Night Lords", [0x1a2550, 0xa07a3a, 0xe6e2d8, 0x9a7a3a, 0xff3a2a]],
      ["Iron Warriors", [0x6a6e74, 0xc9a514, SKIN, 0x8a8f96, 0xff3a2a]], ["Word Bearers", [0x6a1418, 0x8a8f96, SKIN, 0x8a8f96, 0xff3a2a]],
      ["Alpha Legion", [0x1f6f78, 0x8a8f96, SKIN, 0x8a8f96, 0x4aff7a]]]],
    ["Astra Militarum", [
      ["Cadian", [0x6a6a48, 0x3e4a2c, SKIN, 0x77736a, 0x000000]], ["Catachan", [0x3e5a2c, 0x7a2a22, SKIN, 0x77736a, 0x000000]],
      ["Valhallan", [0x8a8674, 0x5a2020, SKIN, 0x77736a, 0x000000]], ["Steel Legion", [0x7a6a4a, 0x3a3d42, SKIN, 0x77736a, 0x000000]],
      ["Mordian", [0x1f2f6a, 0xb02020, SKIN, 0xc9a24a, 0x000000]], ["Tallarn", [0xc9b98c, 0x7a6a4a, 0xb8875f, 0x77736a, 0x000000]],
      ["Death Korps of Krieg", [0x4a4e52, 0x2a2c30, SKIN, 0x77736a, 0x000000]]]],
    ["Orks", [
      ["Goffs", [0x1c1c1e, 0xe0e0d8, ORK, 0x77736a, 0xff3a1a]], ["Evil Sunz", [0xa01c14, 0xd9a514, ORK, 0x77736a, 0xff3a1a]],
      ["Bad Moons", [0xd9b514, 0x1c1c1e, ORK, 0x77736a, 0xff3a1a]], ["Deathskulls", [0x1f4f9f, 0xe0e0d8, ORK, 0x77736a, 0xff3a1a]],
      ["Blood Axes", [0x5a6a3a, 0x8a5a2a, ORK, 0x77736a, 0xff3a1a]], ["Snakebites", [0x6a4a2a, 0xc8b88a, ORK, 0x77736a, 0xff3a1a]]]],
    ["Aeldari", [
      ["Ulthwé", [0x18181c, 0xe8d8b0, ELF, 0xd8c9a8, 0x7affea]], ["Biel-Tan", [0xe6e2d8, 0x1f6a2a, ELF, 0xd8c9a8, 0x7affea]],
      ["Saim-Hann", [0xa01c14, 0x18181c, ELF, 0xd8c9a8, 0x7affea]], ["Iyanden", [0xd9b514, 0x1f3f8f, ELF, 0xd8c9a8, 0x7affea]],
      ["Alaitoc", [0x1f3f8f, 0xd9b514, ELF, 0xd8c9a8, 0x7affea]]]],
    ["Tyranids", [
      ["Leviathan", [0x5a2c6e, 0xe0d8c8, 0xe0d8c8, 0x5a2c6e, 0xffb030]], ["Kraken", [0xa01c14, 0xd8c9a8, 0xd8c9a8, 0xa01c14, 0xffb030]],
      ["Behemoth", [0x1f3f8f, 0xa01c14, 0xa01c14, 0x1f3f8f, 0xffb030]], ["Jormungandr", [0x1c1c1e, 0xd8c070, 0xd8c070, 0x1c1c1e, 0xff5a3a]]]],
    ["Necrons", [
      ["Sautekh", [0x8a9096, 0x23272b, 0x8a9096, 0x8a9096, 0x39ff6a]], ["Mephrit", [0x6e7378, 0xd95a14, 0x6e7378, 0x8a9096, 0xff7a20]],
      ["Nihilakh", [0x2a7a78, 0xc9a347, 0x2a7a78, 0xc9a347, 0x39ff6a]]]],
    ["T'au Empire", [
      ["T'au", [0xc9b98c, 0x3a3d42, 0x6a8aa8, 0x8a8f96, 0x7ad8ff]], ["Vior'la", [0xe6e2d8, 0xa01c14, 0x6a8aa8, 0x8a8f96, 0x7ad8ff]],
      ["Farsight Enclaves", [0xa01c14, 0x3a3d42, 0x6a8aa8, 0x8a8f96, 0x7ad8ff]], ["Sa'cea", [0x6a5a8a, 0xe6e2d8, 0x6a8aa8, 0x8a8f96, 0x7ad8ff]],
      ["Bork'an", [0x3a8a8a, 0xe6e2d8, 0x6a8aa8, 0x8a8f96, 0x7ad8ff]]]],
  ];
  // The army badge that goes with a scheme (Dawn of War II's own badge images, in a local pack's badges.js): a
  // Chapter's symbol on the shoulder pad and the banner. A side left to its faction's colours takes the faction's.
  const SCHEME_BADGE = { Ultramarines: "sm_ultramarines", "Blood Angels": "sm_bloodangels", "Dark Angels": "sm_darkangels", "Imperial Fists": "sm_imperialfists", "Space Wolves": "sm_spacewolves",
    Salamanders: "sm_salamanders", "Raven Guard": "sm_ravenguard", "White Scars": "sm_whitescars", "Iron Hands": "sm_ironhands", "Black Templars": "sm_blacktemplars", "Blood Ravens": "sm_bloodravens",
    "Black Legion": "chaos_blacklegion", "World Eaters": "chaos_worldeaters", "Death Guard": "chaos_deathguard", "Thousand Sons": "chaos_thousandsons", "Emperor's Children": "chaos_emperors_children",
    "Night Lords": "chaos_nightlords", "Iron Warriors": "chaos_iron_warriors", "Word Bearers": "chaos_word_bearers", "Alpha Legion": "chaos_alpha_legion",
    Goffs: "ork_goffs", "Evil Sunz": "ork_evil_sunz", "Bad Moons": "ork_bad_moonz", Deathskulls: "ork_death_skulls", "Blood Axes": "ork_blood_axes", Snakebites: "ork_snake_bites",
    "Ulthwé": "eldar_ulthwe", "Biel-Tan": "eldar_biel_tan", "Saim-Hann": "eldar_saim_hann", Iyanden: "eldar_iyanden", Alaitoc: "eldar_alaitoc", Cadian: "ig_skullwings" };
  const FACTION_BADGE = [[/Khorne/, "chaos_khorne"], [/Plague/, "chaos_nurgle"], [/Rubric|Thousand/, "chaos_thousandsons"], [/Noise/, "chaos_slaanesh"], [/Heretic|Chaos Space/, "chaos_blacklegion"],
    [/Deathwatch/, "gw_deathwatch"], [/Astartes/, "sm_ultramarines"]];
  // null: the scheme has no badge of its own, so the model wears none rather than another army's
  const badgeFor = (scheme, faction) => scheme ? SCHEME_BADGE[scheme] || null : (FACTION_BADGE.find(([re]) => re.test(faction || "")) || [0, undefined])[1];
  // Soulstorm files its badges and banners by race ("ss/<race>/<name>", "ssb/<race>/<name>" in badges.js). A model
  // wears its race's: the one that goes with the side's scheme, or the race's usual one when the side keeps its
  // faction's colours and is of that race (a Custodian drawn with a Space Marine's model wears no Chapter's badge).
  const OLD_BADGE = { Ultramarines: "ultramarines", "Blood Angels": "bloodangels", "Dark Angels": "darkangels", "Imperial Fists": "imperialfists", "Space Wolves": "spacewolves", Salamanders: "salamanders",
    "Raven Guard": "ravenguard", "White Scars": "whitescars", "Iron Hands": "ironhands", "Black Templars": "blacktemplar", "Blood Ravens": "bloodravens",
    "Black Legion": "blacklegion", "World Eaters": "worldeaters", "Death Guard": "nurgle", "Emperor's Children": "empororschildren", "Night Lords": "nightlords", "Iron Warriors": "ironwarriors",
    "Word Bearers": "wordbearers", "Alpha Legion": "alphalegion", Goffs: "coffs", "Evil Sunz": "evilsunz", "Bad Moons": "badmoons", Deathskulls: "deathskulls", "Blood Axes": "bloodaxes", Snakebites: "snakebites",
    "Ulthwé": "ulthwe", "Biel-Tan": "biel_tan", "Saim-Hann": "saim_hann", Iyanden: "iyanden", Alaitoc: "alaitoc", Cadian: "cadian8", "T'au": "tau", "Vior'la": "viorla", "Sa'cea": "sacea", "Bork'an": "borkan" };
  const OLD_RACE = { space_marine_race: [/^(Astartes|Deathwatch)/, "ultramarines"], chaos_marine_race: [/Heretic|Chaos Space|Khorne|Plague|Rubric|Noise/, "blacklegion"], guard_race: [/Guard|Militarum|Tempestus/, "cadian8"],
    ork_race: [/Ork/, "coffs"], eldar_race: [/Aeldari/, "alaitoc"], dark_eldar_race: [/Drukhari/, "blackheart"], sisters_race: [/Sororitas/, "ourmartyredlady"], tau_race: [/T'au/, "tau"], necron_race: [/Necron/, "necron"] };
  function oldBadge(race, scheme, faction, banner) {
    const R = OLD_RACE[race], all = window.DOW_BADGES || {}; if (!R) return null;
    const name = scheme ? OLD_BADGE[scheme] : R[0].test(faction || "") ? R[1] : null; if (!name) return null;
    const pre = (banner ? "ssb/" : "ss/") + race + "/";
    // (the banner files are named a little differently from the badges: "ultramarine", "emperorschildren", "cadian_001")
    return all[pre + name] ? pre + name : Object.keys(all).find(k => k.startsWith(pre) && (k.slice(pre.length).startsWith(name.slice(0, 6)) || name.startsWith(k.slice(pre.length, pre.length + 6)))) || null;
  }
  const colourScheme = name => { for (const [, list] of COLOUR_SCHEMES) for (const [n, c] of list) if (n === name) return c; return null; };
  const colourOptions = cur => `<option value="">By faction</option>` + COLOUR_SCHEMES.map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(([n]) => `<option${n === cur ? " selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>`).join("");

