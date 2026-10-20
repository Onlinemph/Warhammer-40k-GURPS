// Worlds to conquer (docs/setting.md): every world is a map of its own, 8 to 20 regions joined by their own links,
// each of one ground (terrain.js), some of them cities with names, one the capital. Each region has a holder and a
// garrison of its own; battles are fought region by region, and a world changes hands when one faction holds its
// capital and more than half its cities. Deterministic: a world's regions come from the war's seed.
const { rng } = require("./galaxy.js");
const { TERRAIN } = require("./terrain.js");
const { SCALE } = require("./units.js");
// a free world's Local Defence: to every ten, a sergeant and a heavy stubber
const defence = n => { const k = Math.floor(n / 10); return { militia: n - 2 * k, ...(k ? { militia_sgt: k, militia_heavy: k } : {}) }; };

const SYL = ["ka", "vor", "tal", "en", "mir", "dus", "ae", "ol", "ix", "ran", "sel", "gor", "thi", "um", "bra", "nek", "os", "lia", "qer", "zan", "hel", "dro", "cas", "ur"];
// how a region of each ground is called after its name
const KIND = { plains: "Plains", farmland: "Fields", forest: "Woods", jungle: "Jungle", hills: "Hills", mountains: "Peaks", desert: "Sands", swamp: "Mire", tundra: "Steppe", wasteland: "Waste", river: "Vale" };
// how many regions and cities, by kind of world; and what a capital is built as
const SIZE = { hive: [12, 20], forge: [10, 16], agri: [10, 16], fortress: [9, 14], death: [8, 14], tomb: [8, 12] };
const CAPITAL = { hive: "hive", forge: "city", agri: "city", fortress: "fortress", death: "town", tomb: "fortress" };
const W = 100, H = 60;   // the planet map's frame

function generate(seed, w) {
  const R = rng((seed ^ 0x6a09e667) + w.id.length * 104729 + w.x * 977 + w.y * 13);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const [lo, hi] = SIZE[w.type] || SIZE.agri, n = ri(lo, hi);
  // places spread over the frame
  const pts = [];
  for (let i = 0; i < n; i++) {
    let x, y, t = 0;
    do { x = 6 + R() * (W - 12); y = 6 + R() * (H - 12); t++; } while (t < 60 && pts.some(p => Math.hypot(p.x - x, p.y - y) < 13));
    pts.push({ x: Math.round(x), y: Math.round(y), links: [] });
  }
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), link = (i, j) => { if (i !== j && !pts[i].links.includes(j)) { pts[i].links.push(j); pts[j].links.push(i); } };
  const tree = new Set([0]);
  while (tree.size < n) {
    let best = null;
    for (const i of tree) for (let j = 0; j < n; j++) if (!tree.has(j) && (!best || d(pts[i], pts[j]) < best[2])) best = [i, j, d(pts[i], pts[j])];
    link(best[0], best[1]); tree.add(best[1]);
  }
  for (let i = 0; i < n; i++) { const near = pts.map((p, j) => j).filter(j => j !== i).sort((a, b) => d(pts[i], pts[a]) - d(pts[i], pts[b])); for (const j of near.slice(0, 2)) if (R() < 0.55) link(i, j); }
  // the ground of each: the world's mix, its towns as cities (a third of the regions, at least three), the capital
  // the region nearest the middle, built as the world's kind of capital
  const mix = w.terrain || { plains: 1 }, keys = Object.keys(mix).sort();
  const wild = keys.filter(k => !TERRAIN[k].town), towns = keys.filter(k => TERRAIN[k].town);
  const draw = list => { const tot = list.reduce((a, k) => a + mix[k], 0); let x = R() * tot; for (const k of list) if ((x -= mix[k]) < 0) return k; return list[0]; };
  const cap = pts.map((p, i) => i).sort((a, b) => Math.hypot(pts[a].x - W / 2, pts[a].y - H / 2) - Math.hypot(pts[b].x - W / 2, pts[b].y - H / 2))[0];
  const nc = Math.max(3, Math.round(n / 3)), cities = new Set([cap]);
  // the other cities spread out: each the place furthest from the cities so far, with a little chance in it
  while (cities.size < nc) {
    const far = i => Math.min(...[...cities].map(c => d(pts[i], pts[c]))) * (0.7 + 0.6 * R());
    cities.add(pts.map((p, i) => i).filter(i => !cities.has(i)).sort((a, b) => far(b) - far(a))[0]);
  }
  const names = new Set([w.name]), name = () => { for (;;) { const s = Array.from({ length: ri(2, 3) }, () => SYL[ri(0, SYL.length - 1)]).join(""); const v = s[0].toUpperCase() + s.slice(1); if (!names.has(v)) { names.add(v); return v; } } };
  return pts.map((p, i) => {
    const city = cities.has(i), capital = i === cap;
    const terrain = capital ? CAPITAL[w.type] || "city" : city ? (towns.length ? draw(towns) : "town") : wild.length ? draw(wild) : "plains";
    const nm = capital ? `${w.name} Prime` : city ? name() : `${name()} ${KIND[terrain] || "Lands"}`;
    return { id: "r" + i, name: nm, terrain, city, capital, x: p.x, y: p.y, links: p.links.map(j => "r" + j), owner: w.owner || null, garrison: {} };
  });
}

// ---- looking things up
const region = (w, id) => w && id != null ? w.regions[+String(id).slice(1)] || null : null;
const capitalOf = w => w.regions.find(r => r.capital);
const cities = w => w.regions.filter(r => r.city);
// a city's share of its world's yield: the capital counts double
const share = (w, r) => r.city ? (r.capital ? 2 : 1) / (cities(w).length + 1) : 0;
// the faction that holds a world by the rule: its capital and more than half its cities; or null
function holder(w) {
  const c = capitalOf(w), cs = cities(w);
  if (!c.owner) return null;
  return cs.filter(r => r.owner === c.owner).length * 2 > cs.length ? c.owner : null;
}
// a world is contested while any of its cities is held by someone other than its holder
const contested = w => cities(w).some(r => r.owner !== w.owner);
// the shares of a world's cities each faction holds (for the galaxy map's split)
const split = w => { const out = {}, cs = cities(w); for (const r of cs) { const k = r.owner || "militia"; out[k] = (out[k] || 0) + 1 / cs.length; } return out; };
// every garrison on a world added up
const garrisonOf = w => { const a = {}; for (const r of w.regions) for (const [k, n] of Object.entries(r.garrison)) if (n > 0) a[k] = (a[k] || 0) + n; return a; };
// where a faction's troops on a world gather: its capital if it holds it, else the city it holds with the most, else
// any region it holds
const seatOf = (w, f) => { const c = capitalOf(w); if (c.owner === f) return c; const mine = w.regions.filter(r => r.owner === f), tot = r => Object.values(r.garrison).reduce((a, n) => a + n, 0); return mine.filter(r => r.city).sort((a, b) => tot(b) - tot(a))[0] || mine[0] || null; };
// the fewest steps from one region to another inside a world
function steps(w, from, to) {
  const dist = { [from]: 0 }, q = [from];
  while (q.length) { const a = q.shift(); if (a === to) return dist[a]; for (const b of region(w, a).links) if (!(b in dist)) { dist[b] = dist[a] + 1; q.push(b); } }
  return Infinity;
}
// the first step from one region toward the nearest that passes `want`
function stepToward(w, from, want) {
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const a = q.shift();
    if (a !== from && want(region(w, a))) { let s = a; while (prev[s] !== from) s = prev[s]; return s; }
    for (const b of region(w, a).links) if (!(b in prev)) { prev[b] = a; q.push(b); }
  }
  return null;
}
// landing: a faction coming from another world may land anywhere but in, or next to, a capital built as a fortress
// that its foes hold with a garrison (its guns deny the sky around it)
const garrisoned = r => Object.values(r.garrison).some(n => n > 0);
function canLand(w, f, id) {
  const r = region(w, id);
  if (!r) return false;
  const denies = x => x.capital && x.terrain === "fortress" && x.owner && x.owner !== f && garrisoned(x);
  return !denies(r) && !r.links.some(l => denies(region(w, l)));
}
// where a landing goes when the order names none: the region it may land in nearest the capital
function defaultLanding(w, f) {
  const c = capitalOf(w).id;
  return w.regions.filter(r => canLand(w, f, r.id)).sort((a, b) => steps(w, a.id, c) - steps(w, b.id, c) || +a.id.slice(1) - +b.id.slice(1))[0]?.id || null;
}

// ---- the war's start: everything on a world held by its holder, its starting garrison in the capital and a few in
// each other city (a free world's Local Defence the same way)
function setup(S, START, R) {
  for (const w of Object.values(S.worlds)) {
    w.regions = generate(S.seed, w);
    const c = capitalOf(w);
    if (w.owner) {
      c.garrison = { ...START[w.owner].garrison };
      const basic = { hegemony: "levy", apostates: "faithless", brawl: "brawler", chorus: "leaper" }[w.owner];
      if (basic) for (const r of cities(w)) if (!r.capital) r.garrison = { [basic]: 5 * SCALE };
    } else {
      c.garrison = defence((10 + Math.floor(R() * 16)) * SCALE);
      for (const r of cities(w)) if (!r.capital) r.garrison = defence((3 + Math.floor(R() * 6)) * SCALE);
    }
  }
}

module.exports = { generate, setup, region, capitalOf, cities, share, holder, contested, split, garrisonOf, seatOf, steps, stepToward, canLand, defaultLanding, KIND };
