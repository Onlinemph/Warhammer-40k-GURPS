// Tactical Mass Combat (David L. Pulver, Pyramid 3/44 pp. 24-29, on GURPS Mass Combat) as the war's battles, with
// the war's expanded results (docs/setting.md, "More results than the article's"). Each element's OR and PR are the
// user's Scaled CER (ratings.json, tools/resolver/ratings.js). A battle is fought on a small hex map built from the
// region's ground, both sides played by a simple AI. Deterministic: the same inputs and seed give the same battle,
// so its record can be fought again to be watched.
//
//   const T = require("./tmc.js");
//   T.fight({ ground: "city", seed, sides: [sideA, sideB], hold: 1, attacker: 0 })
//   side: { faction, army: { unit: count }, extra: { unit: count }, named: { unit: count }, leader: 12,
//           earthworks: bool, prMult: 1, orMult: 1 }
//   -> { winner: 0 | 1 | null, kind, rounds, lost: [{unit: n}, {unit: n}], fled, surrendered, recon, night, events, ... }
const { rng } = require("./galaxy.js");
const { UNITS, templateOf, ratingKey } = require("./units.js");
const RT = require("./ratings.json").templates;

// ---- the tables, as the article gives them, and the expanded results built from them cell by cell
const FCOLS = [0.1, 0.2, 1 / 3, 0.5, 1, 2, 3, 4, 5, 10, 20], FNAMES = ["1:10", "1:5", "1:3", "1:2", "1:1", "2:1", "3:1", "4:1", "5:1", "10:1", "20:1+"];
const CCOLS = [0.05, 0.1, 0.2, 1 / 3, 0.5, 1, 2, 3, 4, 5, 10, 20], CNAMES = ["1:20", "1:10", "1:5", "1:3", "1:2", "1:1", "2:1", "3:1", "4:1", "5:1", "10:1", "20:1+"];
// the column for a ratio, rounded in the defender's favour: fire below 1:10 is no column (no effect); close combat
// below 1:20 is 1:20
const column = (ratio, cols) => { let c = -1; for (let i = 0; i < cols.length; i++) if (ratio >= cols[i] - 1e-9) c = i; return c; };
// Fire Combat Results Table (p. 27): column i, P on 12-i and 13-i, DE on 14-i and 15-i, DO from 16-i
const fireAsWritten = (i, r) => r >= 16 - i ? "DO" : r >= 14 - i ? "DE" : r >= 12 - i ? "P" : "NE";
// expanded: the roll below the first P is S, the second P is PC, the first DE is SL
function fireResult(i, r) {
  if (i < 0) return "NE";
  r = Math.max(2, Math.min(12, r));
  const o = fireAsWritten(i, r);
  if (o === "NE" && r === 11 - i) return "S";
  if (o === "P" && r === 13 - i) return "PC";
  if (o === "DE" && r === 14 - i) return "SL";
  return o;
}
// Close Combat Table (p. 28): column j, AE below 9-j, AR on 9-j to 11-j, NE on 12-j, DR on 13-j to 15-j, DE from 16-j
const closeAsWritten = (j, r) => r >= 16 - j ? "DE" : r >= 13 - j ? "DR" : r >= 12 - j ? "NE" : r >= 9 - j ? "AR" : "AE";
// expanded: NE is EN, or EX in the even columns (1:2, 1:1, 2:1); the last AR is AD; the first DR is DD; at 10:1 and
// up a 12 is DS
function closeResult(j, r) {
  j = Math.max(0, j); r = Math.max(2, Math.min(12, r));
  const o = closeAsWritten(j, r);
  if (o === "NE") return j >= 4 && j <= 6 ? "EX" : "EN";
  if (o === "AR" && r === 11 - j) return "AD";
  if (o === "DR" && r === 13 - j) return "DD";
  if (o === "DE" && r >= 12 && j >= 10) return "DS";
  return o;
}
// how bad a fire result is, for "one step worse" and the AI's choices
const FIRE_ORDER = ["NE", "S", "P", "PC", "SL", "DE", "DO"];
const worse = res => FIRE_ORDER[Math.min(FIRE_ORDER.length - 1, FIRE_ORDER.indexOf(res) + 1)];

// ---- the map: odd-q columns, W x H hexes of 20 yards; each hex clear, woods, high (ground), swamp, built (up), water
const TERRAIN_RATING = { plains: 8, desert: 7, tundra: 6, farmland: 6, forest: 5, jungle: 3, hills: 6, mountains: 4, swamp: 4, wasteland: 7, river: 6, town: 6, city: 6, hive: 6, fortress: 6 };
// what each ground is made of: shares of woods, high ground, swamp, built-up, and how they lie
const GROUND = {
  plains:    { woods: 0.06, high: 0.06 }, desert: { high: 0.08, built: 0.02 }, tundra: { high: 0.06, swamp: 0.04 },
  farmland:  { woods: 0.12, built: 0.05 }, forest: { woods: 0.6 }, jungle: { woods: 0.75, swamp: 0.05 },
  hills:     { high: 0.4, woods: 0.1 }, mountains: { high: 0.6, woods: 0.05 }, swamp: { swamp: 0.45, woods: 0.15 },
  wasteland: { built: 0.1, high: 0.08 }, river: { woods: 0.15, river: true },
  town: { built: 0.3, woods: 0.08, town: true }, city: { built: 0.6, town: true }, hive: { built: 0.85, town: true }, fortress: { built: 0.5, town: true, wall: true },
};
function buildMap(ground, seed, elements) {
  const R = rng((seed ^ 0x3c6ef372) >>> 0), W = Math.max(18, Math.min(120, 16 + Math.round(elements * 0.5))), H = Math.round(W * 0.6);
  const g = GROUND[ground] || GROUND.plains, t = new Array(W * H).fill("clear");
  const at = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  // patches grown by walkers; towns grow from the middle outward, the rest anywhere
  const grow = (kind, share, centre) => {
    let want = Math.round(share * W * H), tries = 0;
    while (want > 0 && tries++ < 400) {
      let x = centre ? Math.round(W / 2 + (R() - 0.5) * W * 0.5) : Math.floor(R() * W), y = centre ? Math.round(H / 2 + (R() - 0.5) * H * 0.6) : Math.floor(R() * H);
      for (let k = 0, len = 3 + Math.floor(R() * 8); k < len && want > 0; k++) {
        if (inside(x, y) && t[at(x, y)] === "clear") { t[at(x, y)] = kind; want--; }
        const d = DIRS[Math.floor(R() * 6)], n = step(x, y, d); x = n[0]; y = n[1];
      }
    }
  };
  for (const kind of ["built", "woods", "high", "swamp"]) if (g[kind]) grow(kind, g[kind], kind === "built" && g.town);
  // streets: in a town or a city every third column and row is open, so there are lines of fire along them
  if (g.town) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x % 3 === 1 || y % 3 === 1) && t[at(x, y)] === "built") t[at(x, y)] = "clear";
  // a river down the middle, with three crossings
  if (g.river) { const fords = [Math.floor(H / 5), Math.floor(H / 2), Math.floor(4 * H / 5)]; let x = Math.floor(W / 2); for (let y = 0; y < H; y++) { if (!fords.includes(y)) t[at(x, y)] = "water"; else t[at(x, y)] = "clear"; if (R() < 0.3) x = Math.max(2, Math.min(W - 3, x + (R() < 0.5 ? -1 : 1))); } }
  // a fortress city's wall across side 1's half, three gates
  if (g.wall) { const x = Math.round(W * 0.62), gates = [0.2, 0.5, 0.8].map(f => Math.round(H * f)); for (let y = 0; y < H; y++) t[at(x, y)] = gates.includes(y) ? "clear" : "built"; }
  return { W, H, t };
}
// odd-q neighbours and distances (cube coordinates)
const DIRS = [0, 1, 2, 3, 4, 5];
function step(x, y, d) {
  const odd = x & 1, Q = [[1, odd ? 0 : -1], [1, odd ? 1 : 0], [0, 1], [-1, odd ? 1 : 0], [-1, odd ? 0 : -1], [0, -1]][d];
  return [x + Q[0], y + Q[1]];
}
const cube = (x, y) => { const q = x, r = y - (x - (x & 1)) / 2; return [q, r, -q - r]; };
const fromCube = (q, r) => [q, r + (q - (q & 1)) / 2];
const dist = (a, b) => { const A = cube(a.x, a.y), B = cube(b.x, b.y); return (Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]) + Math.abs(A[2] - B[2])) / 2; };
// the hexes on a line from a to b (cube interpolation), not counting either end
function between(a, b) {
  const A = cube(a.x, a.y), B = cube(b.x, b.y), n = dist(a, b), out = [];
  for (let i = 1; i < n; i++) {
    const f = i / n, q = A[0] + (B[0] - A[0]) * f + 1e-6, r = A[1] + (B[1] - A[1]) * f + 1e-6, s = -q - r;
    let rq = Math.round(q), rr = Math.round(r); const rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
    out.push(fromCube(rq, rr));
  }
  return out;
}

// ---- movement: points by mobility, terrain costs (the article's Terrain Effects Table)
const MP = { foot: 3, mounted: 5 };
const COST = { foot: { clear: 1, high: 2, woods: 2, built: 1, swamp: 2 }, mounted: { clear: 1, high: 3, woods: 2, built: 1, swamp: 2 } };

// ---- the battle
function fight(opt) {
  const R = rng(opt.seed >>> 0), d6 = () => 1 + Math.floor(R() * 6), roll2 = () => d6() + d6(), roll3 = () => d6() + d6() + d6();
  const ground = GROUND[opt.ground] ? opt.ground : "plains", log = opt.log ? [] : null, events = [];
  const say = (text, kind) => { events.push({ round, text, kind }); if (log) log.push({ t: "say", round, text }); };
  // elements: each unit type in a side split into elements of up to ten soldiers (evenly), however big the battle
  // (user direction: no cap on elements a side, past the article's 4 to 40)
  const els = [];
  opt.sides.forEach((sd, side) => {
    const size = 10;
    for (const [unit, count] of Object.entries(sd.army)) {
      if (!(count > 0)) continue;
      const template = UNITS[unit] || unit === "militia" ? ratingKey(unit) : unit, rt = RT[template];   // (a template by name too: tools/resolver/score-tmc.js)
      if (!rt) throw new Error(`no ratings for ${template}`);
      const k = Math.ceil(count / size), extra = (sd.extra || {})[unit] || 0, named = (sd.named || {})[unit] || 0;
      for (let i = 0; i < k; i++) {
        const n = Math.floor(count / k) + (i < count % k ? 1 : 0);
        els.push({ id: els.length, side, unit, template, rt, n0: n, n, worth: 1 + (i === 0 ? extra / n : 0), named: i < named ? 1 : 0,
          x: -1, y: -1, state: "ok", reduced: false, pinned: false, suppressed: false, broken: false, engaged: false, provostUsed: false, fired: false, lost: 0 });
      }
    }
  });
  const map = buildMap(ground, opt.seed, els.length), { W, H } = map, terr = (x, y) => map.t[y * W + x];
  const live = () => els.filter(e => e.state === "ok"), mine = s => els.filter(e => e.side === s && e.state === "ok");
  const occ = (x, y) => els.filter(e => e.state === "ok" && e.x === x && e.y === y);
  const adjacent = (a, b) => dist(a, b) === 1;
  const sideOf = s => opt.sides[s];
  let round = 0;

  // ---- before the battle: night, and the Reconnaissance Contest (Mass Combat pp. 28-29)
  const night = d6() + 1 >= 5;   // (every faction in the war is TL7 or more: +1)
  const tr = Math.ceil((TERRAIN_RATING[ground] || 6) / (night ? 2 : 1));
  const holder = opt.hold === 0 || opt.hold === 1 ? opt.hold : null;
  const reconTS = s => els.filter(e => e.side === s && e.rt.classes.recon).reduce((a, e) => a + e.n * (e.rt.or + e.rt.pr), 0);
  const totalTS = s => els.filter(e => e.side === s).reduce((a, e) => a + e.n * (e.rt.or + e.rt.pr), 0);
  const recSup = s => { const a = reconTS(s), b = reconTS(1 - s); if (!a || a < 0.01 * totalTS(1 - s)) return 0; const r = b ? a / b : 99; return r >= 5 ? 3 : r >= 3 ? 2 : r >= 2 ? 1 : 0; };
  const reconMod = s => { const list = els.filter(e => e.side === s); const n = list.filter(e => e.rt.classes.recon).length; return (n === 0 ? -1 : n === list.length ? 2 : 0) + recSup(s) + (holder === s && sideOf(s).earthworks ? 3 : 0); };
  const skill = s => sideOf(s).leader || 10;
  const rolls = [roll3(), roll3()], mos = [0, 1].map(s => skill(s) + reconMod(s) - rolls[s]);
  const crit = s => rolls[s] >= 17 || (rolls[s] >= 16 && mos[s] <= -10);
  let recon = { winner: null, margin: 0, kind: "pitched" };
  let mov = mos[0] - mos[1], win = mov > 0 ? 0 : mov < 0 ? 1 : null;
  // (a bunkered side that wins treats it as a tie)
  if (win != null && holder === win && sideOf(win).earthworks) win = null;
  if (crit(0) && crit(1)) recon = { winner: null, margin: 0, kind: "encounter", bothConfused: true };
  else if (win == null) recon = { winner: null, margin: 0, kind: d6() <= tr ? "pitched" : "encounter" };
  else {
    const m = Math.abs(mov), type = holder != null ? "pitched" : "encounter";
    recon = { winner: win, margin: m, kind: type, surprise: m >= tr, ambush: m >= tr + 5 };
  }
  const initiative = recon.winner != null ? recon.winner : d6() <= 3 ? 0 : 1;
  const confused = [false, false];
  if (recon.bothConfused) confused[0] = confused[1] = true;
  if (recon.surprise) confused[1 - recon.winner] = true;

  // ---- setup: home edges west (side 0) and east (side 1)
  const short = Math.min(W, H), cover = (x, y) => { const k = terr(x, y); return k === "built" ? 3 : k === "woods" ? 2 : k === "high" ? 2 : k === "swamp" ? 0 : 1; };
  const edgeDist = (s, x) => s === 0 ? x : W - 1 - x;
  const place = (e, zone, prefer) => {
    let best = null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!zone(x, y) || terr(x, y) === "water" || occ(x, y).length >= (prefer === "spread" ? 1 : 2)) continue;
      const others = els.filter(o => o.state === "ok" && o.side === e.side && o.x >= 0);
      const near = others.length ? Math.min(...others.map(o => dist(o, { x, y }))) : 9;
      const s = (prefer === "built" ? (terr(x, y) === "built" ? 6 : 0) : 0) + cover(x, y) + Math.min(near, 3) * 0.6 - Math.abs(y - H / 2) * 0.05 + R() * 0.5;
      if (!best || s > best.s) best = { x, y, s };
    }
    if (!best) for (let y = 0; y < H && !best; y++) for (let x = 0; x < W && !best; x++) if (zone(x, y) && terr(x, y) !== "water") best = { x, y };
    if (!best) best = { x: e.side ? W - 1 : 0, y: Math.floor(H / 2) };
    e.x = best.x; e.y = best.y;
  };
  const amb = recon.ambush ? 1 - recon.winner : null, q = Math.ceil(short / 4);
  const order = [1 - initiative, initiative];   // the side that lost initiative sets up first
  for (const s of amb != null ? [amb, 1 - amb] : order) {
    for (const e of els.filter(e => e.side === s)) {
      let zone;
      if (amb === s) zone = recon.kind === "pitched" ? (x, y) => dist({ x, y }, { x: Math.floor(W / 2), y: Math.floor(H / 2) }) <= q : (x, y) => edgeDist(s, x) >= q && edgeDist(s, x) <= Math.ceil(short / 2);
      else if (amb != null) zone = recon.kind === "pitched" ? (x, y) => els.filter(o => o.side !== s && o.x >= 0).every(o => dist(o, { x, y }) >= q) : (x, y) => edgeDist(amb, x) > q;
      else if (holder === s) zone = (x, y) => edgeDist(s, x) < Math.ceil(W * 0.45);   // a garrison holds its half, in its buildings
      else zone = recon.kind === "pitched" ? (x, y) => edgeDist(s, x) < q : (x, y) => edgeDist(s, x) < Math.max(1, Math.ceil(short / 10));
      place(e, zone, holder === s ? "built" : "spread");
    }
  }
  // earthworks: the fortified holder, one per four Foot elements, in its elements' hexes (not water, built, swamp)
  const works = new Set();
  opt.sides.forEach((sd, s) => {
    if (!sd.earthworks) return;
    const list = els.filter(e => e.side === s && e.rt.mobility === "foot" && !["built", "swamp", "water"].includes(terr(e.x, e.y)));
    for (const e of list.slice(0, Math.ceil(els.filter(x => x.side === s && x.rt.mobility === "foot").length / 4))) works.add(e.y * W + e.x);
  });
  // commanders: Command Points (Leadership + Strategy) / 4 (the leader's skill for both), with their best element
  const cp = [0, 1].map(s => Math.floor(2 * skill(s) / 4)), cpMax = cp.slice();
  if (log) log.push({ t: "map", W, H, terrain: map.t, works: [...works], els: els.map(e => ({ id: e.id, side: e.side, unit: e.unit, n: e.n, x: e.x, y: e.y })), recon, night });

  // ---- ratings with the article's modifiers
  const synapseNear = e => e.side != null && els.some(o => o.side === e.side && o.state === "ok" && o.rt.synapse && dist(o, e) <= 3);
  const orFire = e => e.n * e.worth * e.rt.orFire * (sideOf(e.side).orMult || 1) * (e.suppressed ? 0.5 : 1) * (e.reduced ? 1 : 1);
  const orClose = e => e.n * e.worth * e.rt.orClose * (sideOf(e.side).orMult || 1);
  const prOf = (e, closeCombat) => {
    const k = terr(e.x, e.y), foot = e.rt.mobility === "foot";
    let m = 1;
    if (foot && k === "built") m *= closeCombat ? 3 : 2;
    else if (foot && k === "woods" && closeCombat) m *= 2;
    if (works.has(e.y * W + e.x)) m *= 2;
    if (holder === e.side) m *= sideOf(e.side).prMult || 1;
    return e.n * e.worth * e.rt.pr * m;
  };
  const seeCache = new Map();
  const canSee = (a, b) => {
    const k1 = a.y * W + a.x, k2 = b.y * W + b.x, key = k1 < k2 ? k1 * 4096 + k2 : k2 * 4096 + k1;
    let v = seeCache.get(key);
    if (v === undefined) { v = between(a, b).every(([x, y]) => !["woods", "built", "high"].includes(terr(x, y))); seeCache.set(key, v); }
    return v;
  };
  const demoralized = [false, false];
  const mayAttack = e => e.state === "ok" && !e.pinned && !e.broken && !(confused[e.side] && round === 1) && (!demoralized[e.side] || e.rt.elite || e.rt.fanatic);

  // a step lost: a full element is reduced to half its soldiers, a reduced one eliminated
  const loseStep = (e, why) => { if (e.state !== "ok") return; if (!e.reduced) { const keep = Math.ceil(e.n0 / 2); e.lost += e.n - keep; e.n = keep; e.reduced = true; } else eliminate(e, why); };
  const eliminate = (e, why, surrendered) => { if (e.state !== "ok") return; e.lost += e.n; e.n = 0; e.state = "gone"; e.diedRound = round; e.surrendered = !!surrendered; e.pinned = e.engaged = false; if (log) log.push({ t: "gone", round, id: e.id, why }); };
  const pin = e => {
    if (e.state !== "ok") return;
    // (a Chorus element under synapse shrugs off its first pin)
    if (e.rt && synapseNear(e) && !e.synapseUsed && UNITS[e.unit] && UNITS[e.unit].faction === "chorus") { e.synapseUsed = true; return; }
    if (e.pinned) { loseStep(e, "pinned again"); return; }
    e.pinned = true;
    if (e.reduced) breakEl(e);
  };
  const breakEl = e => {
    if (e.state !== "ok" || e.broken || e.rt.fanatic) return;
    if (provostWith(e) && !e.provostUsed) { e.provostUsed = true; return; }
    e.broken = true; if (log) log.push({ t: "broken", round, id: e.id });
  };
  const provostWith = e => UNITS[e.unit] && UNITS[e.unit].faction === "hegemony" && els.some(o => o.state === "ok" && o.side === e.side && o.unit === "provost" && o.x === e.x && o.y === e.y);
  const applyFire = (t, res, by) => {
    if (res === "S") { if (!(synapseNear(t) && UNITS[t.unit] && UNITS[t.unit].faction === "chorus")) t.suppressed = true; }
    else if (res === "P") pin(t);
    else if (res === "PC") { pin(t); loseStep(t, "fire"); }
    else if (res === "SL") loseStep(t, "fire");
    else if (res === "DE" || res === "DO") eliminate(t, "fire");
    if (log) log.push({ t: "fire", round, by: by.map(e => e.id), at: t.id, res });
  };
  // a commander's +1 (attacking) or -1 (defending), where it changes the result for the better
  const spend = (s, near) => { const cost = near ? 1 : 2; if (cp[s] >= cost) { cp[s] -= cost; return true; } return false; };
  const leaderEl = s => mine(s).sort((a, b) => b.n * b.rt.pr - a.n * a.rt.pr)[0];
  const nearLeader = (s, e) => { const l = leaderEl(s); return !!l && dist(l, e) <= 10; };

  // ---- the fire phase
  function firePhase(s) {
    const shooters = mine(s).filter(e => e.rt.classes.fire && mayAttack(e) && !e.engaged);
    for (const e of shooters) e.fired = false;
    for (const e of shooters) {
      if (e.fired || e.state !== "ok") continue;
      const targets = mine(1 - s).filter(t => { const d = dist(e, t); return d >= 2 && d <= e.rt.range && canSee(e, t); });
      if (!targets.length) continue;
      // with up to three more of its own kind within two hexes that can also reach the target
      const best = targets.map(t => {
        const group = [e, ...shooters.filter(o => o !== e && !o.fired && o.state === "ok" && o.template === e.template && dist(o, e) <= 2 && dist(o, t) >= 2 && dist(o, t) <= o.rt.range && canSee(o, t))].slice(0, 4);
        const ratio = groupRatio(group, t), col = column(ratio, FCOLS);
        return { t, group, ratio, col, value: col + (t.reduced ? 1 : 0) + (t.named ? 0.5 : 0) };
      }).sort((a, b) => b.value - a.value || a.t.id - b.t.id)[0];
      if (best.col < 0) continue;   // no effect possible: hold fire
      shoot(best.group, best.t, 1);
    }
  }
  const groupRatio = (group, t) => {
    const into = ["woods", "built"].includes(terr(t.x, t.y));
    const or = group.reduce((a, o) => a + orFire(o) * (night && !o.rt.night ? 0.5 : 1) * (into ? 0.5 : 1), 0);
    return or / Math.max(1, prOf(t, false));
  };
  function shoot(group, t, share) {
    for (const o of group) o.fired = true;
    const s = group[0].side;
    let col = column(groupRatio(group, t) * share, FCOLS);
    if (col < 0) return;
    const nat = roll2();
    let r = nat;
    // commanders: the attacker spends to push a pin into a kill, the defender to save an element
    const res0 = fireResult(col, r);
    if (cp[s] && FIRE_ORDER.indexOf(fireResult(col, r + 1)) >= 5 && FIRE_ORDER.indexOf(res0) < 5 && spend(s, nearLeader(s, group[0]))) r++;
    if (cp[1 - s] && FIRE_ORDER.indexOf(fireResult(col, r)) >= 5 && FIRE_ORDER.indexOf(fireResult(col, r - 1)) < 5 && spend(1 - s, nearLeader(1 - s, t))) r--;
    let res = fireResult(col, r);
    // the dice themselves: a gun that gets hot cooks its own on a 2; a named soldier's 12 is one step worse
    if (nat === 2 && group.some(o => o.rt.getsHot)) { const o = group.find(x => x.rt.getsHot); loseStep(o, "its guns overheated"); say(`${nameOf(o)}'s guns overheat`, "hot"); return; }
    if (nat === 12 && group.some(o => o.named)) { res = worse(res); const o = group.find(x => x.named); say(`a named soldier of ${nameOf(o)} turns the fight`, "deed"); events[events.length - 1].unit = o.unit; events[events.length - 1].side = o.side; }
    applyFire(t, res, group);
    // obliterated: another shot at half strength at an enemy in the same or a next hex
    if (res === "DO") {
      const next = mine(1 - s).filter(u => dist(u, t) <= 1 && dist(u, group[0]) >= 2 && dist(u, group[0]) <= group[0].rt.range && canSee(group[0], u)).sort((a, b) => a.id - b.id)[0];
      if (next && share / 2 >= 1 / 64) shoot(group, next, share / 2);
    }
  }

  // ---- movement
  const meleeMinded = e => !e.rt.classes.fire || e.rt.orClose >= e.rt.orFire;
  let foeAt = null, foeNext = null, crowd = null;
  const mapFoes = s => {
    foeAt = new Uint8Array(W * H); foeNext = new Uint8Array(W * H); crowd = new Uint8Array(W * H);
    for (const f of mine(1 - s)) { foeAt[f.y * W + f.x] = 1; for (const d of DIRS) { const [x, y] = step(f.x, f.y, d); if (x >= 0 && y >= 0 && x < W && y < H) foeNext[y * W + x] = 1; } }
    for (const e of live()) crowd[e.y * W + e.x]++;
  };
  function reach(e) {
    // cheapest paths from e with its movement points; it stops on moving next to an enemy and can't enter one's hex
    const mp = MP[e.rt.mobility] || 3, cost = COST[e.rt.mobility] || COST.foot;
    const best = new Map([[e.y * W + e.x, 0]]), q = [[e.x, e.y, 0]];
    while (q.length) {
      q.sort((a, b) => a[2] - b[2]);
      const [x, y, c] = q.shift();
      if (c > 0 && foeNext[y * W + x]) continue;   // stopped next to the enemy
      for (const d of DIRS) {
        const [nx, ny] = step(x, y, d);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = terr(nx, ny); if (k === "water") continue;
        if (foeAt[ny * W + nx]) continue;
        const nc = c + (cost[k] || 1);
        if (nc > mp) continue;
        const key = ny * W + nx;
        if (best.has(key) && best.get(key) <= nc) continue;
        best.set(key, nc); q.push([nx, ny, nc]);
      }
    }
    return [...best.keys()].map(k => ({ x: k % W, y: Math.floor(k / W) })).filter(h => (h.x === e.x && h.y === e.y) || crowd[h.y * W + h.x] < 4);
  }
  function movePhase(s) {
    const list = mine(s).sort((a, b) => a.id - b.id), foes = mine(1 - s);
    if (!foes.length) return;
    mapFoes(s);
    // the nearest foe from each hex, once a turn
    const near = new Float32Array(W * H).fill(99);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const f of foes) { const d = dist(f, { x, y }); if (d < near[y * W + x]) near[y * W + x] = d; }
    const moveTo = (e, h) => { crowd[e.y * W + e.x]--; e.x = h.x; e.y = h.y; crowd[e.y * W + e.x]++; };
    for (const e of list) {
      if (e.state !== "ok" || e.pinned || e.engaged || (confused[s] && round === 1)) continue;
      const hexes = reach(e);
      // the broken and the demoralized fall back to their edge, and off it
      if (e.broken || (demoralized[s] && !e.rt.elite && !e.rt.fanatic)) {
        const h = hexes.sort((a, b) => edgeDist(s, a.x) - edgeDist(s, b.x) || a.y - b.y)[0];
        moveTo(e, h);
        if (edgeDist(s, e.x) === 0) { e.state = "fled"; if (log) log.push({ t: "fled", round, id: e.id }); }
        else if (log) log.push({ t: "move", round, id: e.id, x: e.x, y: e.y });
        continue;
      }
      // a holding garrison stays in its buildings
      if (holder === s && ["built", "woods"].includes(terr(e.x, e.y)) && !e.rt.impetuous) continue;
      const nearest = h => near[h.y * W + h.x];
      let pick;
      if (meleeMinded(e)) pick = hexes.sort((a, b) => nearest(a) - nearest(b) || cover(b.x, b.y) - cover(a.x, a.y) || a.y - b.y || a.x - b.x)[0];
      else {
        const score = h => { const n0 = near[h.y * W + h.x], can = n0 <= e.rt.range && foes.some(f => { const d = dist(f, h); return d >= 2 && d <= e.rt.range && canSee(h, f); }); const n = nearest(h); return (can ? 10 : -n * 0.3) + cover(h.x, h.y) * 1.2 - (n <= 1 ? 6 : 0) - (works.has(h.y * W + h.x) ? -2 : 0); };
        pick = hexes.map(h => ({ h, s: score(h) })).sort((a, b) => b.s - a.s || a.h.y - b.h.y || a.h.x - b.h.x)[0].h;
      }
      if (pick && (pick.x !== e.x || pick.y !== e.y)) { moveTo(e, pick); if (log) log.push({ t: "move", round, id: e.id, x: e.x, y: e.y }); }
    }
  }

  // ---- close combat
  function closePhase(s) {
    const used = new Set();
    const targets = [...new Set(mine(1 - s).map(t => t.y * W + t.x))];
    // the hexes in reach, the best odds first
    const plans = targets.map(k => {
      const hx = { x: k % W, y: Math.floor(k / W) }, def = occ(hx.x, hx.y).filter(e => e.side !== s);
      const att = mine(s).filter(e => !used.has(e) && mayAttack(e) && e.rt.orClose > 0 && adjacent(e, hx) && !(e.rt.classes.fire && !meleeMinded(e) && !e.engaged && !def.some(d => d.engaged)));
      return { hx, def, att, ratio: ratioClose(att, def, hx) };
    }).filter(p => p.att.length && p.def.length).sort((a, b) => b.ratio - a.ratio);
    for (const p of plans) {
      const att = p.att.filter(e => !used.has(e) && e.state === "ok");
      if (!att.length) continue;
      const def = occ(p.hx.x, p.hx.y).filter(e => e.side !== s);
      if (!def.length) continue;
      const ratio = ratioClose(att, def, p.hx), col = column(ratio, CCOLS);
      // attack at 1:1 or better, or if already locked in, or if they must (Impetuous, Fanatic)
      const must = att.some(e => e.rt.impetuous || e.rt.fanatic) || att.some(e => e.engaged) || def.some(e => e.engaged);
      const bold = s === opt.attacker || opt.attacker == null ? (round >= 7 ? 3 : round >= 4 ? 4 : 5) : 5;
      if (col < bold && !must) continue;
      att.forEach(e => used.add(e));
      melee(att, def, Math.max(0, col), p.hx);
    }
  }
  const ratioClose = (att, def, hx) => {
    const k = terr(hx.x, hx.y);
    const a = att.reduce((v, e) => { let m = 1; if (e.rt.mobility !== "foot" && (k === "built" || k === "swamp")) m *= 0.5; if (k === "high" && terr(e.x, e.y) !== "high") m *= 0.5; return v + orClose(e) * m; }, 0);
    return a / Math.max(1, def.reduce((v, e) => v + prOf(e, true), 0));
  };
  function melee(att, def, col, hx) {
    const s = att[0].side;
    const nat = roll2();
    let r = nat;
    if (cp[s] && spend(s, nearLeader(s, att[0]))) r++;
    if (cp[1 - s] && spend(1 - s, nearLeader(1 - s, def[0]))) r--;
    let res = closeResult(col, r);
    if (nat === 2 && att.some(e => e.named)) { const o = att.find(e => e.named); say(`a named soldier of ${nameOf(o)} is wounded`, "wound"); events[events.length - 1].unit = o.unit; events[events.length - 1].side = o.side; }
    // the factions' own: a Provost turns a retreat into standing; Fanatics ignore retreats and die instead; the Chorus
    // under synapse doesn't stop
    const fanAtt = att.some(e => e.rt.fanatic), fanDef = def.every(e => e.rt.fanatic);
    if (res === "AR" && att.some(provostWith)) res = "AD";
    if (res === "AR" && fanAtt) res = "AE";
    if (res === "DR" && fanDef) res = "DD";
    if (res === "EN" && [...att, ...def].some(e => synapseNear(e) && UNITS[e.unit] && UNITS[e.unit].faction === "chorus")) res = "EX";
    if (log) log.push({ t: "melee", round, by: att.map(e => e.id), at: def.map(e => e.id), res, col: CNAMES[col] });
    const retreat = (list, from) => { for (const e of list) { const back = [0, 1, 2, 3, 4, 5].map(d => step(e.x, e.y, d)).filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H && terr(x, y) !== "water" && !mine(1 - e.side).some(f => dist(f, { x, y }) <= 1) && occ(x, y).length < 4).sort((a, b) => edgeDist(e.side, a[0]) - edgeDist(e.side, b[0]))[0]; if (!back || e.rt.mobility == null) eliminate(e, "cut off"); else { e.x = back[0]; e.y = back[1]; e.engaged = false; } } };
    const engage = () => { for (const e of [...att, ...def]) if (e.state === "ok") e.engaged = true; };
    if (res === "AE") att.forEach(e => eliminate(e, "close combat"));
    else if (res === "AR") retreat(att);
    else if (res === "AD") { att.forEach(e => loseStep(e, "close combat")); engage(); }
    else if (res === "EN") engage();
    else if (res === "EX") { att.forEach(e => loseStep(e, "close combat")); def.forEach(e => loseStep(e, "close combat")); engage(); }
    else if (res === "DD") { def.forEach(e => loseStep(e, "close combat")); engage(); }
    else if (res === "DR") retreat(def);
    else if (res === "DE") def.forEach(e => eliminate(e, "close combat"));
    else if (res === "DS") { def.forEach(e => eliminate(e, "surrendered", true)); say(`${def.map(nameOf).join(", ")} surrender`, "surrender"); }
    if (["DD", "DR", "DE", "DS"].includes(res) && att.some(e => UNITS[e.unit] && UNITS[e.unit].faction === "brawl")) fame[s] += def.length;
    // advance into an emptied hex: the Impetuous and Fanatic must, the rest as stacking allows
    if (["DR", "DE", "DS"].includes(res) && !occ(hx.x, hx.y).some(e => e.side !== s)) {
      for (const e of att.filter(e => e.state === "ok").sort((a, b) => (b.rt.impetuous || b.rt.fanatic ? 1 : 0) - (a.rt.impetuous || a.rt.fanatic ? 1 : 0)).slice(0, 4)) { e.x = hx.x; e.y = hx.y; e.engaged = false; }
    }
    // a hex with nobody left of one side frees the other from the melee
    for (const e of [...att, ...def]) if (e.state === "ok" && e.engaged && !mine(1 - e.side).some(f => adjacent(f, e))) e.engaged = false;
  }
  const fame = [0, 0];
  const nameOf = e => (UNITS[e.unit] ? UNITS[e.unit].name : "Local Defence") + (e.reduced ? " (reduced)" : "");

  // ---- pin recovery, merging, rallies, reanimation
  function recover(s) {
    for (const e of mine(s)) {
      if (e.pinned && !mine(1 - s).some(f => adjacent(f, e))) e.pinned = false;
      e.suppressed = false;
      // a commander rallies a broken element worth it
      if (e.broken && cp[s] >= 1 && e.n * e.rt.pr >= 0.5 * Math.max(...mine(s).map(o => o.n * o.rt.pr)) && spend(s, true)) { e.broken = false; if (log) log.push({ t: "rally", round, id: e.id }); }
    }
    // two reduced elements of a unit in one hex merge into one full one
    for (const e of mine(s)) if (e.reduced) { const o = mine(s).find(x => x !== e && x.reduced && x.unit === e.unit && x.x === e.x && x.y === e.y); if (o) { e.n += o.n; e.n0 = Math.max(e.n0, e.n); e.reduced = e.n < e.n0; o.n = 0; o.state = "merged"; } }
    // planning: a commander who spent nothing this turn regains a point on a Strategy roll
    if (cp[s] < cpMax[s] && roll3() <= skill(s)) cp[s]++;
  }
  function reanimate() {
    for (const e of els) if (e.state === "gone" && !e.surrendered && e.rt.reanimates && e.diedRound === round && !occ(e.x, e.y).some(o => o.side !== e.side) && d6() >= 5) {
      e.state = "ok"; e.reduced = true; e.n = Math.ceil(e.n0 / 2); e.lost -= e.n; e.pinned = false; e.reanimated = (e.reanimated || 0) + 1;
      say(`${nameOf(e)} rises again`, "reanimate"); if (log) log.push({ t: "reanimate", round, id: e.id });
    }
  }
  // demoralization (the article): the first side with over half its elements gone that has lost more than the enemy
  function morale() {
    const gone = s => els.filter(e => e.side === s && e.state === "gone").length, all = s => els.filter(e => e.side === s && e.state !== "merged").length;
    for (const s of [0, 1]) if (!demoralized[s] && !demoralized[1 - s] && gone(s) * 2 > all(s) && gone(s) > gone(1 - s)) { demoralized[s] = true; say(`${opt.sides[s].name || opt.sides[s].faction} are demoralized`, "demoralized"); if (log) log.push({ t: "demoralized", round, side: s }); }
  }

  // ---- the rounds
  // (for watching: every element's place, soldiers and state after each side's turn; flags 1 pinned, 2 broken,
  // 4 suppressed, 8 engaged, 16 fled, 32 gone, 64 reduced)
  const snap = s => ({ t: "snap", round, side: s, els: els.filter(e => e.state !== "merged").map(e => [e.id, e.x, e.y, e.n, (e.state === "fled" ? 16 : e.state === "gone" ? 32 : (e.pinned ? 1 : 0) | (e.broken ? 2 : 0) | (e.suppressed ? 4 : 0) | (e.engaged ? 8 : 0)) | (e.reduced ? 64 : 0)]) });
  if (log) log.push(snap(null));
  // (16 rounds, or more on a bigger map: half its width, the time it takes armies to cross it)
  const MAX = opt.maxRounds || Math.max(16, Math.ceil(W / 2));
  let winner = null, withdrew = null;
  const since = [null, null];
  for (round = 1; round <= MAX; round++) {
    for (const s of [initiative, 1 - initiative]) {
      if (!mine(0).length || !mine(1).length) break;
      firePhase(s); movePhase(s); closePhase(s); recover(s); morale();
      if (log) log.push(snap(s));
    }
    reanimate();
    if (!mine(0).length || !mine(1).length) break;
    // (the article lets the GM rule a demoralized force has lost: still demoralized a round on, it withdraws, its
    // elements fleeing the field)
    for (const s of [0, 1]) if (demoralized[s]) { if (since[s] == null) since[s] = round; else if (round > since[s]) withdrew = s; }
    if (withdrew != null) { for (const e of mine(withdrew)) { e.state = "fled"; if (log) log.push({ t: "fled", round, id: e.id }); } say(`${opt.sides[withdrew].name || opt.sides[withdrew].faction} withdraw`, "withdraw"); break; }
  }
  round = Math.min(round, MAX);
  const left = [mine(0).length, mine(1).length];
  if (left[0] && !left[1]) winner = 0; else if (left[1] && !left[0]) winner = 1;
  const lost = [{}, {}], fled = [{}, {}], surrendered = [0, 0], start = [{}, {}];
  for (const e of els) {
    start[e.side][e.unit] = (start[e.side][e.unit] || 0) + (e.state === "merged" ? 0 : e.n0);
    if (e.lost > 0) lost[e.side][e.unit] = (lost[e.side][e.unit] || 0) + e.lost;
    if (e.state === "fled") fled[e.side][e.unit] = (fled[e.side][e.unit] || 0) + e.n;
    if (e.surrendered) surrendered[e.side] += e.lost;
  }
  const n0 = [0, 1].map(s => opt.sides[s] ? Object.values(opt.sides[s].army).reduce((a, n) => a + n, 0) : 0);
  const share = s => Object.values(lost[s]).reduce((a, n) => a + n, 0) / Math.max(1, n0[s]);
  const att = opt.attacker === 0 || opt.attacker === 1 ? opt.attacker : null;
  const kind = winner == null ? "stalemate" : att != null && winner !== att && share(att) < 0.5 ? "repulse" : share(winner) >= 0.5 ? "pyrrhic" : "rout";
  return { winner, kind, rounds: round, lost, fled, surrendered, loss: [share(0), share(1)], recon, night, initiative, demoralized, fame, events,
    reanimated: els.filter(e => e.reanimated).length, log, map: log ? { W, H } : undefined };
}

// ---- odds: the share of wins over a few quick battles (for advice, the AI's choices, turning back)
// (the same inputs always give the same answer, so answers are kept: the AI and the view ask the same question often)
const MEMO = new Map();
function predict(opt, runs = 8) {
  // (a battle of thousands takes fewer quick runs: no fewer than two)
  const n = opt.sides.reduce((a, sd) => a + Object.values(sd.army).reduce((x, y) => x + (y > 0 ? y : 0), 0), 0);
  runs = Math.max(2, Math.min(runs, Math.round(runs * 1000 / Math.max(1000, n))));
  const key = runs + JSON.stringify(opt);
  if (MEMO.has(key)) return MEMO.get(key);
  const out = predictRuns(opt, runs);
  if (MEMO.size > 20000) MEMO.clear();
  MEMO.set(key, out);
  return out;
}
function predictRuns(opt, runs) {
  let w = [0, 0], d = 0, lA = 0, lB = 0, rounds = 0;
  for (let i = 0; i < runs; i++) {
    const r = fight({ ...opt, seed: ((opt.seed || 1) * 2654435761 + i * 40503) >>> 0, log: false });
    if (r.winner === 0) w[0]++; else if (r.winner === 1) w[1]++; else d++;
    lA += r.loss[0]; lB += r.loss[1]; rounds += r.rounds;
  }
  return { pWinA: w[0] / runs, pWinB: w[1] / runs, pDraw: d / runs, lossA: lA / runs, lossB: lB / runs, rounds: rounds / runs, runs };
}
module.exports = { fight, predict, fireResult, closeResult, fireAsWritten, closeAsWritten, column, FCOLS, CCOLS, FNAMES, CNAMES, buildMap, TERRAIN_RATING };
