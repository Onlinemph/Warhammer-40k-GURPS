// A small galaxy from a seed: worlds in three sectors west to east, joined by lanes (every world reachable, a few
// loops), each world a type that sets what it produces. The Hegemony starts in the west, the Brawl in the east,
// the Chorus in a cluster in the middle; the rest are unclaimed, held by a local militia.
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const TYPES = {
  hive:     { name: "hive world",     manpower: 6, materiel: 2, supply: 2 },
  forge:    { name: "forge world",    manpower: 2, materiel: 6, supply: 2 },
  agri:     { name: "agri world",     manpower: 2, materiel: 1, supply: 6 },
  fortress: { name: "fortress world", manpower: 3, materiel: 3, supply: 3, defence: 1.5 },
  death:    { name: "death world",    manpower: 1, materiel: 2, supply: 1 },
};
const SYL = ["ka", "vor", "tal", "en", "mir", "dus", "ae", "ol", "ix", "ran", "sel", "gor", "thi", "um", "bra", "nek", "os", "lia", "qer", "zan"];
function generate(seed = 1, opt = {}) {
  const R = rng(seed), n = opt.worlds || 24, W = 1000, H = 600;
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const names = new Set(), name = () => { for (;;) { const s = Array.from({ length: ri(2, 3) }, () => SYL[ri(0, SYL.length - 1)]).join(""); const v = s[0].toUpperCase() + s.slice(1); if (!names.has(v)) { names.add(v); return v; } } };
  const worlds = [];
  for (let i = 0; i < n; i++) {
    const sector = Math.min(2, Math.floor(i * 3 / n));
    let x, y, tries = 0;
    do { x = 60 + sector * 320 + R() * 260; y = 50 + R() * (H - 100); tries++; } while (tries < 50 && worlds.some(w => Math.hypot(w.x - x, w.y - y) < 70));
    const typeKeys = Object.keys(TYPES);
    worlds.push({ id: "w" + i, name: name(), sector, x: Math.round(x), y: Math.round(y), type: typeKeys[ri(0, typeKeys.length - 1)], owner: null, links: [] });
  }
  // lanes: a minimum spanning tree (everything reachable) plus each world's nearest neighbour or two
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), link = (a, b) => { if (a !== b && !a.links.includes(b.id)) { a.links.push(b.id); b.links.push(a.id); } };
  const inTree = new Set([worlds[0].id]);
  while (inTree.size < n) {
    let best = null;
    for (const a of worlds) if (inTree.has(a.id)) for (const b of worlds) if (!inTree.has(b.id) && (!best || d(a, b) < best[2])) best = [a, b, d(a, b)];
    link(best[0], best[1]); inTree.add(best[1].id);
  }
  for (const a of worlds) { const near = worlds.filter(b => b !== a).sort((p, q) => d(a, p) - d(a, q)); if (R() < 0.6) link(a, near[1]); }
  // starting holdings: the westmost three for the Hegemony, the eastmost three for the Brawl, a central cluster of
  // four for the Chorus; each side's capital is the first, a fortress
  const byX = worlds.slice().sort((a, b) => a.x - b.x);
  const claim = (list, f) => list.forEach((w, i) => { w.owner = f; if (i === 0) { w.type = "fortress"; w.capital = true; } });
  claim(byX.slice(0, 3), "hegemony"); claim(byX.slice(-3).reverse(), "brawl");
  const mid = worlds.filter(w => !w.owner).sort((a, b) => Math.hypot(a.x - W / 2, a.y - H / 2) - Math.hypot(b.x - W / 2, b.y - H / 2)).slice(0, 4);
  claim(mid, "chorus"); mid[0].type = "hive";
  return { seed, worlds, types: TYPES };
}
module.exports = { generate, TYPES, rng };
