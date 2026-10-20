// The ground battles are fought on (docs/setting.md, Worlds to conquer): terrain types, each with the battle map the
// engine builds for it (the countryside generator dialled to it, or the city generator), what mix of them each world
// has, which a battle is fought on, and what close or open ground does for each side. Deterministic: a world's mix
// comes from the war's seed, a battle's ground from its own seed.
const { rng } = require("./galaxy.js");
const { UNITS } = require("./units.js");

// close: woods, streets and marsh, where hand-to-hand fighters get in among the guns; open: where the guns see far
const TERRAIN = {
  plains:    { name: "plains", at: "on the plains",          map: { ground: {} },                                                                              open: true },
  farmland:  { name: "farmland", at: "in farmland",        map: { ground: { farms: 2, open: 0.2, hedge: 0.5 } },                                            open: true },
  forest:    { name: "forest", at: "in a forest",          map: { ground: { woods: 3, trunk: 0.35, thicket: 0.15 } },                                        close: true },
  jungle:    { name: "jungle", at: "in jungle",          map: { ground: { woods: 4, trunk: 0.45, thicket: 0.25, farms: 0.2, brush: 1.5 } },                close: true },
  hills:     { name: "hills", at: "in the hills",           map: { ground: { hills: 2.5, hillH: 1.5, zmax: 10, woods: 0.5 } } },
  mountains: { name: "mountains", at: "in the mountains",       map: { ground: { hills: 2, hillH: 2, zmax: 14, rocks: 2, woods: 0.3, farms: 0.2, brush: 0.5, theme: "desert" } } },
  desert:    { name: "desert", at: "in the desert",          map: { ground: { hills: 0.6, woods: 0, farms: 0.3, open: 0.9, hedge: 0, rocks: 0.6, brush: 0.4, theme: "desert" } }, open: true },
  swamp:     { name: "swamp", at: "in a swamp",           map: { ground: { pools: 3, woods: 1.5, thicket: 0.3, farms: 0.3, hills: 0.3 } },                  close: true },
  tundra:    { name: "tundra", at: "on the tundra",          map: { ground: { woods: 0.4, farms: 0.3, brush: 0.5, rocks: 0.4, theme: "desert" } },               open: true },
  wasteland: { name: "wasteland", at: "in a wasteland",       map: { ground: { farms: 0.6, woods: 0, brush: 2.5, rocks: 0.5, open: 0.8, hedge: 0, theme: "desert" } }, open: true },
  river:     { name: "a river valley", at: "in a river valley",  map: { ground: { river: 1, woods: 1 } } },
  town:      { name: "a farm town", at: "in a farm town",     map: { city: "town" },     close: true, town: true },
  city:      { name: "a city", at: "in a city",          map: { city: "city" },     close: true, town: true },
  hive:      { name: "a hive city", at: "in a hive city",     map: { city: "hive" },     close: true, town: true },
  fortress:  { name: "a fortress city", at: "at a fortress city", map: { city: "fortress" }, close: true, town: true },
};
// what each kind of world is mostly made of (weights), before its own extra
const MIX = {
  hive:     { hive: 3, city: 2, wasteland: 2, plains: 1 },
  forge:    { wasteland: 3, city: 2, town: 1, hills: 1 },
  agri:     { farmland: 4, plains: 2, town: 2, river: 1, forest: 1 },
  fortress: { fortress: 3, hills: 2, city: 1, plains: 1 },
  death:    { jungle: 3, swamp: 2, mountains: 2, forest: 1 },
  tomb:     { desert: 4, mountains: 1, wasteland: 1 },
};
// a world's terrain: its type's mix, and one ground of its own (any but a town) at weight 2
function worldTerrain(seed, w) {
  const R = rng((seed ^ 0x2c1b3c6d) + w.id.length * 7919 + w.x * 31 + w.y);
  const mix = { ...(MIX[w.type] || MIX.agri) }, wild = Object.keys(TERRAIN).filter(k => !TERRAIN[k].town);
  const own = wild[Math.floor(R() * wild.length)];
  mix[own] = (mix[own] || 0) + 2;
  return mix;
}
const melee = army => { let m = 0, n = 0; for (const [k, c] of Object.entries(army)) { n += c; if (k !== "militia" && UNITS[k].melee) m += c; } return n ? m / n : 0; };
// the ground of one battle: drawn from the world's mix by the battle's seed; a leader who won "the ground" picks what
// suits his side best instead (close for the side that fights hand to hand, open for the guns)
function pick(w, seed, choose) {
  const mix = w.terrain || MIX.agri, keys = Object.keys(mix).sort(), tot = keys.reduce((a, k) => a + mix[k], 0);
  if (choose) {
    const want = choose.melee ? "close" : "open", fit = keys.filter(k => TERRAIN[k][want]);
    if (fit.length) return fit.sort((a, b) => mix[b] - mix[a])[0];
  }
  let x = (seed % 100000) / 100000 * tot;
  for (const k of keys) { if ((x -= mix[k]) < 0) return k; }
  return keys[0];
}
// what the ground does in the war's odds: close ground x1.15 for the side more given to hand-to-hand fighting, open
// ground x1.1 for the side more given to the gun
function factors(t, A, B) {
  const T = TERRAIN[t], mA = melee(A.army), mB = melee(B.army), f = [1, 1];
  if (!T || mA === mB) return f;
  const meleeSide = mA > mB ? 0 : 1;
  if (T.close) f[meleeSide] = 1.15;
  else if (T.open) f[1 - meleeSide] = 1.1;
  return f;
}
// the engine's battlefield for a ground
// (plains, or a battle from before terrain, is the countryside as it always was: no dials, the same map)
const battlefield = t => { const m = (TERRAIN[t] || TERRAIN.plains).map; return m.city ? { battlefield: "city", city: m.city } : { battlefield: "countryside", ...(m.ground && Object.keys(m.ground).length ? { ground: m.ground } : {}) }; };
// ---- weather (docs/setting.md): each world's, drawn each turn by its kind; shares of clear, rain, storm, fog, dust
const WEATHER = {
  hive:     { clear: 4, rain: 1, storm: 1, fog: 4, dust: 0 },     // smog
  forge:    { clear: 4, rain: 1, storm: 1, fog: 3, dust: 1 },
  agri:     { clear: 6, rain: 3, storm: 1, fog: 1, dust: 0 },
  fortress: { clear: 6, rain: 2, storm: 1, fog: 1, dust: 0 },
  death:    { clear: 3, rain: 3, storm: 3, fog: 1, dust: 0 },
  tomb:     { clear: 5, rain: 0, storm: 1, fog: 0, dust: 4 },
};
const WEATHER_NAMES = { clear: "clear", rain: "rain", storm: "a storm", fog: "fog", dust: "a dust storm" };
function weatherFor(type, R) {
  const mix = WEATHER[type] || WEATHER.agri, keys = Object.keys(mix), tot = keys.reduce((a, k) => a + mix[k], 0);
  let x = R() * tot;
  for (const k of keys) if ((x -= mix[k]) < 0) return k;
  return "clear";
}
module.exports = { TERRAIN, MIX, worldTerrain, pick, factors, battlefield, melee, WEATHER, WEATHER_NAMES, weatherFor };
