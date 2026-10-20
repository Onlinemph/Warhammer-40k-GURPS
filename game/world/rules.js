// The war's rules. A game is nothing but its event log: the inputs (the war's creation, players joining, orders,
// ticks with their random seeds) applied in order by apply(). Everything else (worlds, armies, battles, reports)
// is worked out from those, so the same log always rebuilds the same war (rollbacks after an exploit, audits and
// the soldiers' histories all come from that), and the server only has to store the log.
//
// Every world is a map of regions (regions.js): forces stand in a region, battles are fought region by region on
// that region's ground, garrisons are kept region by region, and a world changes hands when one faction holds its
// capital and more than half its cities. A position is { at: world, region }.
const { generate, TYPES, rng } = require("./galaxy.js");
const { UNITS, FACTIONS, MILITIA, templateOf, nameOf, SCALE } = require("./units.js");
const { predict } = require("../../tools/resolver/resolver.js");
const FX = require("./factions.js");
const VET = require("./veterans.js");
const LOG = require("./logistics.js");
const POL = require("./politics.js");
const HL = require("./highlights.js");
const BT = require("./battle.js");
const TER = require("./terrain.js");
const TMC = require("./tmc.js");
const FR = require("./fronts.js");
const SG = require("./siege.js");
const RG = require("./regions.js");

// (each count SCALE times what's written here: units.js)
const START0 = {
  hegemony:  { stock: { manpower: 40, materiel: 60 }, warband: { levy: 15, storm: 3 }, garrison: { levy: 20 } },
  apostates: { stock: { manpower: 40, materiel: 40 }, warband: { turncoat: 15, zealot: 3, vessel: 1 }, garrison: { faithless: 20, turncoat: 12 } },
  brawl:     { stock: { manpower: 40, materiel: 40 }, warband: { brawler: 20, boss: 3 }, garrison: { brawler: 20 } },
  chorus:    { stock: { biomass: 40 }, garrison: { leaper: 20, spitter: 10, conductor: 1 } },
  // a tomb's sleepers: the whole of the Dormant there will ever be
  dormant:   { stock: {}, garrison: { husk: 5, heavy_husk: 1, sentinel: 2, watcher: 1, flenser: 2, keeper: 1, reaper: 1 } },
};
const sc = o => Object.fromEntries(Object.entries(o).map(([k, n]) => [k, typeof n === "number" ? n * SCALE : sc(n)]));
const START = Object.fromEntries(Object.entries(START0).map(([f, x]) => [f, { stock: sc(x.stock), warband: x.warband ? sc(x.warband) : undefined, garrison: sc(x.garrison) }]));
// a Chorus brood keeps its one Conductor whatever its size
START.chorus.garrison.conductor = 1;
// and each tomb has one Overlord and a few Crypteks
Object.assign(START.dormant.garrison, { overlord: 1, cryptek: 3 });
const GARRISON_CAP = 30 * SCALE, ATTRITION = 0.1;
// the Dormant: a tomb wakes when it is fought over, or by itself between these turns; awake, the fallen on a field
// it holds are repaired at this rate
// (a tomb marches when it has about half a full tomb's strength, in Levies' worth: tmc.js prices)
const WAKE = [8, 18], REPAIR = 0.5, RAID_REST = 4, DORMANT_RAID = 100;

// ---- armies: { unitId: count }; the militia's unit id is "militia"
const total = army => Object.values(army).reduce((a, n) => a + n, 0);
const addArmy = (to, from) => { for (const [k, n] of Object.entries(from)) if (n > 0) to[k] = (to[k] || 0) + n; return to; };
// (a Chorus force with a Conductor among it fights as linked broods: the resolver's linked gaunts, tools/resolver)
const LINKABLE = new Set(["leaper", "spitter"]);
const asResolverArmy = army => {
  const byT = {}, linked = (army.conductor || 0) > 0;
  for (const [id, n] of Object.entries(army)) if (n > 0) { const t = templateOf(id) + (linked && LINKABLE.has(id) ? " (linked)" : ""); byT[t] = (byT[t] || 0) + n; }
  return Object.entries(byT).map(([template, count]) => ({ template, count }));
};
// take a share of an army away, type by type (rounded so the expected loss is kept overall)
function cut(army, share, R) {
  const out = {};
  for (const [k, n] of Object.entries(army)) {
    const x = n * share, lost = Math.min(n, Math.floor(x) + (R() < x - Math.floor(x) ? 1 : 0));
    out[k] = n - lost;
  }
  return out;
}
const cap = s => s[0].toUpperCase() + s.slice(1);
const describe = army => Object.entries(army).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${nameOf(k)}`).join(", ") || "nobody";
const fname = f => f === "militia" ? "the " + MILITIA.name.toLowerCase() : FACTIONS[f].name;
// a place's name: "Kavor Prime on Taldus"
const where = (w, r) => r ? `${r.name} on ${w.name}` : w.name;

// ---- the state
function create(seed, opt = {}) {
  const g = generate(seed, opt);
  const S = { seed, turn: 0, worlds: {}, order: g.worlds.map(w => w.id), factions: {}, players: {}, swarms: [], reports: [], log: [] };
  for (const w of g.worlds) S.worlds[w.id] = { ...w };
  const R = rng(seed ^ 0x5bd1e995);
  for (const [f, st] of Object.entries(START)) S.factions[f] = { id: f, ...FACTIONS[f], stock: { ...st.stock }, capital: (Object.values(S.worlds).find(w => w.owner === f && w.capital) || { id: null }).id };   // the Dormant have none
  for (const w of Object.values(S.worlds)) w.terrain = TER.worldTerrain(seed, w);   // what each world's ground is made of
  RG.setup(S, START, R);                                                              // and its regions, cities and garrisons
  for (const w of Object.values(S.worlds)) if (w.tomb) { w.awake = false; w.wakeAt = WAKE[0] + Math.floor(R() * (WAKE[1] - WAKE[0] + 1)); }
  FX.setup(S);
  LOG.setup(S);
  POL.setup(S);
  HL.setup(S);
  return S;
}
function join(S, { player, name, faction }) {
  if (S.players[player]) return note(S, `${name} is already in the war`);
  if (!FACTIONS[faction] || !FACTIONS[faction].player) throw new Error(`no player faction ${faction}`);
  const home = S.worlds[S.factions[faction].capital];
  S.players[player] = { id: player, name, faction, warband: { at: home.id, region: RG.capitalOf(home).id, army: { ...START[faction].warband }, supplied: true, orders: null, history: [] } };
  FX.joined(S, S.players[player]);
  VET.joined(S, S.players[player]);
  POL.joined(S, S.players[player]);
  note(S, `${name} raises a warband for ${FACTIONS[faction].name}`);
}
function note(S, text) { S.log.push({ turn: S.turn, text }); }
const regionOf = (S, box) => RG.region(S.worlds[box.at], box.region);

// orders for the next tick, checked against the state now; returns the problem, or null when accepted. A move is one
// jump along a lane, or from a gate to another gate the faction holds, landing in the region `land` names (or the
// nearest the capital it may land in); `region` is a march to a region next door on the same world. A ritual (the
// Apostates) is factions.js's.
// Standing orders kept from tick to tick: a stance (advance, fortify: stay and fight harder where you hold, raid:
// strike, loot and come back without taking the region), and `careful`: turn back from a move whose odds are poor.
// `build: "walls"` raises a world's walls a level.
function order(S, { player, move, land, region, recruit, ritual, stance, careful, build, convoy, command }) {
  const p = S.players[player];
  if (!p) return "no such player";
  const wb = p.warband, here = S.worlds[wb.at], hr = RG.region(here, wb.region);
  if (wb.heldIn && (move || region || (recruit || []).length)) return `your warband is held in the battle at ${where(here, hr)} until it's fought`;
  if (move && region) return "march to a region or move to another world, not both";
  if (move && !FX.canMove(S, p.faction, wb.at, move)) return `${S.worlds[move] ? S.worlds[move].name : move} is not one jump from ${here.name}`;
  if (move && land != null && !RG.canLand(S.worlds[move], p.faction, land)) return RG.region(S.worlds[move], land) ? `a fortress denies the sky over ${RG.region(S.worlds[move], land).name}` : "no such region to land in";
  if (region != null && !hr.links.includes(region)) return `${RG.region(here, region) ? RG.region(here, region).name : region} is not next to ${hr.name}`;
  if (stance != null && !STANCES.includes(stance)) return "no such stance";
  if ((move || region) && (stance ?? wb.stance) === "fortify") return "a fortified warband stays where it is: change its stance to move";
  if (build != null && build !== "walls" && build !== "depot") return "nothing like that to build";
  if (build === "walls" && here.owner !== p.faction) return "walls go up only on your own worlds";
  if (build === "walls" && (here.walls || 0) >= WALLS.max) return `${here.name}'s walls are as high as they go`;
  const cv = convoy && typeof convoy === "object" ? { to: String(convoy.to), supply: Math.floor(+convoy.supply) } : null;
  const lerr = LOG.checkOrder(S, p, { build, convoy: cv });
  if (lerr) return lerr;
  for (const r of recruit || []) {
    const u = UNITS[r.unit];
    if (!u || u.faction !== p.faction) return `${p.name}'s faction can't raise ${r.unit}`;
    if (!(r.count > 0 && r.count <= 50 * SCALE && Number.isInteger(r.count))) return `recruit 1 to ${50 * SCALE} at a time`;
  }
  if ((recruit || []).length && !(hr.city && hr.owner === p.faction)) return "recruits only come from cities you hold";
  // special and heavy weapons: one for every ten of the faction's line troops in the warband (counting this order's)
  const after = addArmy({ ...wb.army }, Object.fromEntries((recruit || []).map(r => [r.unit, r.count])));
  // vehicles: built in a city of a Foundry world or at the faction's capital, one for every twenty line troops
  if ((recruit || []).some(r => isVehicle(r.unit))) {
    if (!(here.type === "forge" || here.id === S.factions[p.faction].capital)) return "vehicles are built on a Foundry world or at your capital";
    if (vehicles(after) > vehicleCap(p.faction, after)) return `vehicles: one for every twenty line troops (this would be ${vehicles(after)} for ${vehicleCap(p.faction, after) * 20} line troops)`;
  }
  if ((recruit || []).some(r => isSpecial(r.unit)) && specials(after) > specialCap(p.faction, after)) return `special and heavy weapons: one for every ten line troops (this would be ${specials(after)} for ${specialCap(p.faction, after) * 10} line troops)`;
  const rit = ritual && typeof ritual === "object" ? { kind: String(ritual.kind), target: ritual.target ? String(ritual.target) : null } : null;
  const err = FX.checkOrder(S, p, { move: move || region, recruit, ritual: rit });
  if (err) return err;
  p.lastActive = S.turn;
  wb.orders = { move: move || null, land: move && land != null ? String(land) : null, region: region || null, recruit: recruit || [], ritual: rit, stance: stance ?? null, careful: careful == null ? null : !!careful, build: build || null, convoy: cv, command: command == null ? null : !!command };
  return null;
}
const STANCES = ["advance", "fortify", "raid", "besiege"];
const isSpecial = id => UNITS[id] && (UNITS[id].role === "special" || UNITS[id].role === "heavy");
const specials = army => Object.entries(army).reduce((a, [k, n]) => a + (isSpecial(k) ? n : 0), 0);
const specialCap = (f, army) => Math.floor((FACTIONS[f].line || []).reduce((a, k) => a + (army[k] || 0), 0) / 10);
const isVehicle = id => UNITS[id] && UNITS[id].role === "vehicle";
const vehicles = army => Object.entries(army).reduce((a, [k, n]) => a + (isVehicle(k) ? n : 0), 0);
const vehicleCap = (f, army) => Math.floor((FACTIONS[f].line || []).reduce((a, k) => a + (army[k] || 0), 0) / 20);
// fortify: x1.5 where you hold; walls: +25% a level in the world's cities, two levels, 20 then 40 materiel; turn back
// under 25%; a raid takes six turns of the city's share of its world's yield
const FORTIFY = 1.5, WALLS = { max: 2, each: 0.25, cost: [20 * SCALE, 40 * SCALE] }, TURN_BACK = 25, RAID_LOOT = 6;
// how much a side's holding of a region counts for in a battle there, past what the resolver already knows of
// fighting from a city's buildings (the ground and the holding are in its rates, tools/resolver): its world's own
// defence and its walls in a city, and a warband of the holder's fortified in it
function holdBonus(S, w, r, faction) {
  if (!r || r.owner !== faction) return 1;
  const fort = Object.values(S.players).some(p => p.faction === faction && p.warband.at === w.id && p.warband.region === r.id && p.warband.stance === "fortify" && total(p.warband.army));
  return (r.city ? (TYPES[w.type].defence || 1) * (1 + WALLS.each * (w.walls || 0)) : 1) * (fort ? FORTIFY : 1);
}
// how the resolver sees a battle in a region: its ground, and which side (0 or 1) holds it, a city's garrison
// fighting from its buildings
const holds = (r, x) => !!(r.city && x && x.faction === (r.owner || "militia") && x.parts.some(y => y.kind === "garrison"));
const groundOf = (r, A, B) => ({ ground: r.terrain, hold: holds(r, A) ? 0 : holds(r, B) ? 1 : undefined });
// a warband's chance against the strongest foe in a region (the resolver, a fixed seed: advice for the view and for
// turning back, not the battle's own dice)
// fog (battle.js): `fog` judges the foe by what the faction can see of it, rough numbers where it neither holds the
// region nor has a warband on the world
function oddsAt(S, p, id, rid, fog) {
  const w = S.worlds[id], r = RG.region(w, rid ?? (id === p.warband.at ? p.warband.region : RG.defaultLanding(w, p.faction))), mine = asResolverArmy(p.warband.army);
  if (!r) return null;
  const foe = factionsAt(S, w, r).filter(s => s.faction !== p.faction).sort((a, b) => strength(b.army) - strength(a.army))[0];
  if (!foe || !mine.length) return null;
  const close = r.owner === p.faction || Object.values(S.players).some(q => q.faction === p.faction && q.warband.at === id);
  const me = { faction: p.faction, army: p.warband.army, parts: [{ kind: "warband", player: p.id }] };
  const them = { ...foe, army: fog && !close ? BT.rough(foe.army) : foe.army };
  const q = TMC.predict({ ground: r.terrain, seed: 1, sides: [tmcSide(S, w, r, me), tmcSide(S, w, r, them)], hold: holds(r, foe) ? 1 : undefined, attacker: 0, weather: w.weather || "clear" }, 6);
  return Math.round(100 * q.pWinA);
}

// ---- the tick
// the forces in one region, by faction
const factionsAt = (S, w, r) => {
  const by = {};
  const put = (f, army, who) => { if (!total(army)) return; (by[f] ||= { faction: f, army: {}, parts: [] }); addArmy(by[f].army, army); by[f].parts.push(who); };
  if (total(r.garrison)) put(r.owner || "militia", r.garrison, { kind: "garrison", region: r.id });
  for (const p of Object.values(S.players)) if (p.warband.at === w.id && p.warband.region === r.id) put(p.faction, p.warband.army, { kind: "warband", player: p.id });
  for (const sw of S.swarms) if (sw.at === w.id && sw.region === r.id) put(sw.faction || "chorus", sw.army, { kind: "swarm", id: sw.id });
  return Object.values(by);
};
// everything on a world, by faction (for what looks at a world from outside: blockades, the dead rising, the AI's
// choice of target)
const factionsOn = (S, w) => {
  const by = {};
  for (const r of w.regions) for (const s of factionsAt(S, w, r)) { (by[s.faction] ||= { faction: s.faction, army: {}, parts: [] }); addArmy(by[s.faction].army, s.army); by[s.faction].parts.push(...s.parts); }
  return Object.values(by);
};
// a rough worth in Levies, for ordering sides and the AI's choice of target (the resolver does the real reckoning)
const strength = army => Object.entries(army).reduce((a, [k, n]) => a + n * (k === "militia" ? 1 : UNITS[k].power), 0);
// worlds a faction can supply: its own, joined to its capital through its own
function supplied(S, f) {
  const cap = S.worlds[S.factions[f].capital], seen = new Set();
  if (!cap || cap.owner !== f) { for (const w of Object.values(S.worlds)) if (w.owner === f) seen.add(w.id); return seen; }   // no capital: each world alone
  const q = [cap.id]; seen.add(cap.id);
  while (q.length) for (const n of S.worlds[q.shift()].links) if (!seen.has(n) && S.worlds[n].owner === f) { seen.add(n); q.push(n); }
  return seen;
}
// the share of a world's cities (the capital double) a faction holds: what of its yield it draws
const heldShare = (w, f) => w.regions.reduce((a, r) => a + (r.owner === f ? RG.share(w, r) : 0), 0);

// what factions.js and logistics.js need from here
const H = { strength: (...a) => strength(...a), addArmy, fname: (...a) => fname(...a),
  odds: (S, w, r, f, army, them) => TMC.predict({ ground: r.terrain, seed: 1, sides: [tmcSide(S, w, r, { faction: f, army, parts: [] }), tmcSide(S, w, r, { faction: Object.keys(them).includes("militia") ? "militia" : (r.owner || "militia"), army: them, parts: [] })], attacker: 0 }, 4).pWinA,
  weight: (...a) => POL.weight(...a), fromTreasury: (...a) => POL.fromTreasury(...a), total, cut, supplied: (...a) => supplied(...a), factionsAt: (...a) => factionsOn(...a), factionsIn: (...a) => factionsAt(...a), heldShare, ATTRITION, GARRISON_CAP, TYPES, note: (...a) => note(...a) };

function tick(S, seed) {
  const R = rng(seed);
  S.turn++;
  const W = id => S.worlds[id], T = { fought: new Set(), dead: {}, deadAt: {}, captured: {}, delivered: [] };
  // 0. the weather on every world this turn (terrain.js)
  for (const id of S.order) S.worlds[id].weather = TER.weatherFor(S.worlds[id].type, R);
  // 1. income: each city gives its holder its share of its world's yield (none to a blockaded world's holder; supply
  // from the worlds joined to the capital, logistics.js)
  for (const w of Object.values(S.worlds)) {
    const t = TYPES[w.type], blocked = LOG.noIncome(S, w, H);
    for (const f of new Set(w.regions.filter(r => r.city && r.owner).map(r => r.owner))) {
      if (f === "dormant" || (blocked && f === w.owner)) continue;   // the Dormant don't recruit
      const k = heldShare(w, f), st = S.factions[f].stock;
      if (f === "chorus") st.biomass = (st.biomass || 0) + (t.manpower + t.materiel) * k;
      else { st.manpower += t.manpower * k; st.materiel += t.materiel * k; }
    }
  }
  LOG.income(S, H);
  // 2. players' orders: recruit where they stand, then move. The stockpile is shared out: each warband recruiting
  // this tick may spend an equal share of what the faction had at the tick's start (what isn't spent stays), so
  // whoever orders first doesn't take it all
  // (a Warmaster's priority warbands draw a double share, politics.js; past its share a warband may spend its own
  // treasury)
  const share = {};
  for (const f of Object.keys(FACTIONS)) {
    const ws = Object.values(S.players).filter(p => p.faction === f && p.warband.orders && (p.warband.orders.recruit.length || p.warband.orders.build)).reduce((a, p) => a + POL.weight(S, p), 0);
    if (ws) share[f] = Object.fromEntries(Object.entries(S.factions[f].stock).map(([k, v]) => [k, v / ws]));
  }
  for (const p of Object.values(S.players)) {
    const o = p.warband.orders; if (!o) continue;
    const st = S.factions[p.faction].stock, mine = share[p.faction] ? Object.fromEntries(Object.entries(share[p.faction]).map(([k, v]) => [k, v * POL.weight(S, p)])) : {}, here = W(p.warband.at), hr = regionOf(S, p.warband);
    const tr = p.warband.treasury || {};
    for (const r of o.recruit) {
      const u = UNITS[r.unit];
      const why = FX.checkOrder(S, p, { recruit: [r] }) || (!(hr.city && hr.owner === p.faction) ? "not in a city you hold" : !p.warband.supplied ? "out of supply" : null);
      const room = isSpecial(r.unit) ? Math.max(0, specialCap(p.faction, p.warband.army) - specials(p.warband.army))
        : isVehicle(r.unit) ? (here.type === "forge" || here.id === S.factions[p.faction].capital ? Math.max(0, vehicleCap(p.faction, p.warband.army) - vehicles(p.warband.army)) : 0) : Infinity;
      const can = why ? 0 : Math.min(r.count, room, ...Object.entries(u.cost).map(([k, c]) => Math.floor((Math.min(st[k] || 0, mine[k] || 0) + (tr[k] || 0)) / c + 1e-9)));
      if (can > 0) {
        for (const [k, c] of Object.entries(u.cost)) { const all = c * can, fromShare = Math.min(all, Math.max(0, Math.min(st[k] || 0, mine[k] || 0))); st[k] -= fromShare; mine[k] -= fromShare; POL.fromTreasury(p, k, all - fromShare); }
        p.warband.army[r.unit] = (p.warband.army[r.unit] || 0) + can;
      }
      // say what happened, and why it fell short
      const short = Object.entries(u.cost).filter(([k, c]) => (mine[k] || 0) < c).map(([k]) => k).join(" and ");
      if (can === r.count) p.warband.history.push(`Turn ${S.turn}: raised ${can} ${u.name} at ${where(here, hr)}`);
      else p.warband.history.push(`Turn ${S.turn}: raised ${can} of ${r.count} ${u.name} at ${where(here, hr)}: ${why || `your share of the stockpile ran short of ${short}`}`);
    }
    // walls, from the warband's share like recruits
    if (o.build === "walls" && here.owner === p.faction && (here.walls || 0) < WALLS.max) {
      const c = WALLS.cost[here.walls || 0];
      const fromShare = Math.min(c, Math.max(0, Math.min(st.materiel, mine.materiel ?? st.materiel)));
      if (fromShare + (tr.materiel || 0) >= c) { st.materiel -= fromShare; if (mine.materiel != null) mine.materiel -= fromShare; POL.fromTreasury(p, "materiel", c - fromShare); here.walls = (here.walls || 0) + 1; p.warband.history.push(`Turn ${S.turn}: raised ${here.name}'s walls to level ${here.walls}`); }
      else p.warband.history.push(`Turn ${S.turn}: couldn't raise ${here.name}'s walls: ${c} materiel needed from your share`);
    }
    LOG.orders(S, p, o, mine, H);   // a depot, a convoy
    const wb = p.warband;
    if (o.stance) wb.stance = o.stance;
    if (o.careful != null) wb.careful = o.careful;
    if (o.command != null) wb.command = o.command;
    FX.beginRitual(S, p, o);
    const free = !wb.ritual && !wb.heldIn && wb.stance !== "fortify";
    // a move to another world: landing where it said if the sky is open there still, else where it may
    if (o.move && free && FX.canMove(S, p.faction, wb.at, o.move)) {
      const to = W(o.move), land = o.land != null && RG.canLand(to, p.faction, o.land) ? o.land : RG.defaultLanding(to, p.faction);
      const odds = wb.careful && land ? oddsAt(S, p, o.move, land, true) : null;
      if (!land) wb.history.push(`Turn ${S.turn}: couldn't land on ${to.name}: its fortresses deny the sky`);
      else if (odds != null && odds < TURN_BACK) wb.history.push(`Turn ${S.turn}: turned back from ${where(to, RG.region(to, land))}: about ${odds}% to win there`);
      else go(S, p, here, hr, to, RG.region(to, land));
    }
    // a march to the region next door
    else if (o.region && free && hr.links.includes(o.region)) {
      const odds = wb.careful ? oddsAt(S, p, wb.at, o.region, true) : null, tr2 = RG.region(here, o.region);
      if (odds != null && odds < TURN_BACK) wb.history.push(`Turn ${S.turn}: turned back from ${where(here, tr2)}: about ${odds}% to win there`);
      else go(S, p, here, hr, here, tr2);
    }
    p.warband.orders = null;
  }
  // 3. the AI factions (and first, counter-attacks that took their city back join its garrison)
  FR.settle(S, H);
  chorusTurn(S, R);
  dormantTurn(S, R);
  // 3a. the besieged may sortie (siege.js)
  SG.sorties(S, R, H);
  // 3b. convoys move a jump, and raiders take the ones they catch
  LOG.convoys(S, H, T);
  // 4. battles, wherever two factions meet in a region (first, Levies marching into an Apostate region may turn,
  // factions.js). Battles held open last tick for a commander are settled first: by the result fought live if one
  // came in, by the resolver if not (nothing is lost by sleeping)
  settleHeld(S, R, T);
  for (const id of S.order) {
    const w = W(id);
    for (const r of w.regions) {
      FX.beforeBattle(S, w, r, H, R);
      muster(S, w, r, R);
      for (let guard = 0; guard < 4; guard++) {
        const sides = factionsAt(S, w, r).sort((a, b) => strength(b.army) - strength(a.army));
        if (sides.length < 2) break;
        // a warband whose leader commands its battles in person: held open until the next tick, nothing else here meanwhile
        if (commanders(S, sides[0], sides[1]).some(Boolean)) { hold(S, w, r, sides[0], sides[1], R); break; }
        fight(S, w, r, sides[0], sides[1], R, T);
        // a stalemate is the turn's fighting there: both dig in, and fight again next turn
        const last = S.reports[S.reports.length - 1];
        if (last && last.world === w.id && last.region === r.id && last.turn === S.turn && (last.outcome === "stalemate" || last.outcome === "standoff")) break;
      }
    }
  }
  // 5. captures: a region held by one faction's forces alone becomes theirs (not the Dormant's: they raid, they don't
  // settle; not raiders'); then a world goes to whoever holds its capital and more than half its cities
  for (const id of S.order) {
    const w = W(id);
    for (const r of w.regions) {
      if (r.heldIn) continue;   // a battle still to be fought there
      const sides = factionsAt(S, w, r);
      const raiders = sides.length === 1 && sides[0].parts.every(x => x.kind === "warband" && S.players[x.player].warband.raidFrom);
      if (sides.length === 1 && !raiders && sides[0].faction !== "militia" && sides[0].faction !== "dormant" && sides[0].faction !== r.owner) {
        const was = r.owner;
        r.owner = sides[0].faction; r.garrison = {};
        if (r.city) note(S, `${FACTIONS[r.owner].name} take ${where(w, r)}${was ? " from " + FACTIONS[was].name : ""}`);
        if (r.city) (T.lostCities ||= []).push({ world: w.id, region: r.id, was });   // (fronts.js: a counter-attack)
      }
    }
  }
  settleWorlds(S, T);
  // 5b. raiders: a raid that holds the field in a city loots it (six turns of its share of the world's yield) and
  // knocks a level off the world's walls, then comes home; a beaten one has already fallen back
  for (const p of Object.values(S.players)) {
    const wb = p.warband;
    if (!wb.raidFrom) continue;
    const w = W(wb.at), r = regionOf(S, wb), from = wb.raidFrom;
    wb.raidFrom = null;
    if (r.owner === p.faction) continue;
    if (r.city && !factionsAt(S, w, r).some(s => s.faction !== p.faction)) {
      const t = TYPES[w.type], st = S.factions[p.faction].stock, k = RG.share(w, r) * RAID_LOOT, man = Math.round(t.manpower * k), mat = Math.round(t.materiel * k);
      st.manpower += man; st.materiel += mat;
      if (w.walls && r.owner === w.owner) w.walls--;
      wb.history.push(`Turn ${S.turn}: looted ${where(w, r)}: ${man} manpower, ${mat} materiel`);
      note(S, `${p.name} raids ${where(w, r)}${r.owner ? " of " + FACTIONS[r.owner].name : ""}`);
    }
    const home = W(from.at);
    if (from.at === wb.at ? true : FX.canMove(S, p.faction, wb.at, from.at)) { wb.at = from.at; wb.region = from.region; wb.history.push(`Turn ${S.turn}: back from the raid to ${where(home, RG.region(home, from.region))}`); }
  }
  // 6. supply: a warband on or beside a world joined to its capital is in supply, and eats from its share of the
  // stockpile; one beside a depot of its faction eats from the depot, and counts as in supply too (logistics.js).
  // Out of supply three turns running it wastes away (a Hegemony warband loses Levies to the Apostates instead)
  for (const f of Object.keys(FACTIONS)) {
    const ok = supplied(S, f);
    for (const p of Object.values(S.players).filter(p => p.faction === f)) { const at = W(p.warband.at); p.warband.supplied = ok.has(at.id) || at.links.some(n => ok.has(n)); }
  }
  LOG.eat(S, H);
  for (const p of Object.values(S.players)) {
    const wb = p.warband, at = W(wb.at);
    if (wb.depotFed) wb.supplied = true;
    wb.outFor = wb.supplied ? 0 : (wb.outFor || 0) + 1;
    if (wb.outFor >= LOG.WASTE_AFTER && total(wb.army) && !FX.outOfSupply(S, p, H, R)) { wb.army = cut(wb.army, ATTRITION, R); wb.history.push(`Turn ${S.turn}: out of supply at ${at.name}, losing men`); }
  }
  // 7. garrisons: each player faction's supplied worlds raise a few local levies a turn, in the emptiest city it holds
  // there
  for (const w of Object.values(S.worlds)) {
    const basic = w.owner && FACTIONS[w.owner].basic;
    if (!basic || !supplied(S, w.owner).has(w.id)) continue;
    const c = RG.cities(w).filter(r => r.owner === w.owner && !r.siege && total(r.garrison) < GARRISON_CAP).sort((a, b) => total(a.garrison) - total(b.garrison) || +a.id.slice(1) - +b.id.slice(1))[0];
    if (c) c.garrison[basic] = (c.garrison[basic] || 0) + 2 * SCALE;
  }
  // 7b. fronts (fronts.js): garrisons answer threats, quiet worlds help threatened ones, lost cities are counter-attacked
  FR.fronts(S, R, T, H);
  // 7c. sieges (siege.js): the besieged starve, their walls are knocked down
  SG.upkeep(S, R, H);
  // 8. each faction's own rules: loyalty and edicts, rituals, fame, the dead rising
  FX.upkeep(S, H, R, T);
  settleWorlds(S, T);
  LOG.blockades(S, H, R);
  // named soldiers lost with their units to hunger, desertion or infighting
  VET.reconcile(S, R);
  // politics: service, contracts paid or expired, recall, absence, elections
  POL.tick(S, T);
  // the highlight feed: this tick's battles scored, last turn's upvotes moving the weights
  HL.score(S, T); HL.drift(S);
}
// a city under attack: its holder's garrisons in the other regions of the world march half their strength to its
// defence (those of at least MUSTER.min, none that are fighting a battle of their own or have foes in their region)
const MUSTER = { share: 0.5, min: 6 * SCALE };
function muster(S, w, r, R) {
  const f = r.owner || "militia";
  if (!r.city || r.heldIn || !factionsAt(S, w, r).some(s => s.faction !== f)) return;
  let n = 0;
  for (const x of w.regions) {
    if (x === r || x.owner !== r.owner || x.heldIn || total(x.garrison) < MUSTER.min || factionsAt(S, w, x).some(s => s.faction !== f)) continue;
    const stay = cut(x.garrison, MUSTER.share, R);
    for (const [k, c] of Object.entries(x.garrison)) { const go = c - (stay[k] || 0); if (go > 0) { r.garrison[k] = (r.garrison[k] || 0) + go; n += go; } }
    x.garrison = stay;
  }
  if (n) note(S, `${n} of ${r.owner ? FACTIONS[r.owner].name : "the " + MILITIA.name.toLowerCase()} march to the defence of ${where(w, r)}`);
}
// a warband going somewhere: from world and region to world and region
function go(S, p, here, hr, to, tr) {
  const wb = p.warband, other = to !== here;
  wb.history.push(`Turn ${S.turn}: ${wb.stance === "raid" ? "raided" : other ? "moved" : "marched"} from ${where(here, hr)} to ${where(to, tr)}`);
  if (wb.stance === "raid") wb.raidFrom = { at: here.id, region: hr.id };
  wb.cameFrom = { at: here.id, region: hr.id }; wb.at = to.id; wb.region = tr.id;
}
// worlds changing hands by the rule (regions.js): whoever holds the capital and more than half the cities, or the
// capital's holder where the world's holder has no city left
function settleWorlds(S, T) {
  for (const id of S.order) {
    const w = S.worlds[id], c = RG.capitalOf(w);
    if (c.heldIn) continue;
    let h = RG.holder(w);
    if (!h && c.owner && c.owner !== w.owner && !RG.cities(w).some(r => r.owner === w.owner)) h = c.owner;
    if (!h || h === w.owner || h === "dormant") continue;
    const was = w.owner;
    w.owner = h;
    T.captured[w.id] = Object.values(S.players).filter(p => p.faction === h && p.warband.at === w.id && total(p.warband.army)).map(p => p.id);   // for contracts
    const broken = was === "dormant" && w.tomb;
    FX.captured(S, w, was);
    if (broken) w.tomb = false;   // a taken tomb is ruins: it never holds sleepers again (its gate stays)
    if (w.walls) w.walls--;       // taken, a world's walls come down a level
    note(S, `${FACTIONS[w.owner].name} take ${w.name}${was ? " from " + FACTIONS[was].name : ""}${broken ? ": the tomb is broken open" : ""}`);
  }
}

// a side as Tactical Mass Combat sees it (tmc.js): its soldiers, its named (their worth, and which units carry
// them), its leader's Strategy (a warband leader's skill, a Warmaster +2; otherwise 1d+8, or 12 for a tomb lord),
// earthworks if a warband of its holds the region fortified, its world's defence and walls in a city it holds, and
// supply and its leader's bonus
function tmcSide(S, w, r, X, roll) {
  const named = {};
  for (const y of X.parts) if (y.kind === "warband") for (const n of S.players[y.player].warband.named || []) named[n.unit] = (named[n.unit] || 0) + 1;
  const L = BT.leaderOf(S, X), skill = L.name ? L.skill : X.faction === "dormant" ? 12 : roll ? 8 + roll() : 11;
  const holds = r.owner === X.faction || (!r.owner && X.faction === "militia");
  const fortified = holds && X.parts.some(y => y.kind === "warband" && S.players[y.player].warband.stance === "fortify");
  return { faction: X.faction, name: cap(fname(X.faction)), army: { ...X.army }, extra: VET.extraOf(S, X.parts), named, leader: skill, earthworks: fortified,
    prMult: holds && r.city ? (TYPES[w.type].defence || 1) * (1 + WALLS.each * (w.walls || 0)) : 1,
    orMult: LOG.sideFactor(S, X.parts) * VET.sideLeader(S, X.parts) };
}
// one battle: fought by Tactical Mass Combat (tmc.js) on the region's ground
function fight(S, w, r, A, B, R, T, fixed) {
  const seed = Math.floor(R() * 2 ** 31);
  // a city attacked by a force far stronger than its defenders rallies its people (battle.js)
  const def0 = r.owner || "militia", rallied = fixed || r.siege ? 0 : BT.rally(S, w, r, A.faction === def0 ? A : B.faction === def0 ? B : null, A.faction === def0 ? B : A, strength);
  if (rallied) note(S, `${where(w, r)} rallies ${rallied} of its people to the defence`);
  const ground = fixed && fixed.terrain ? fixed.terrain : r.terrain;
  const G = { ...groundOf(r, A, B), ground };
  const def = r.owner || "militia", attacker = A.faction === def ? 1 : B.faction === def ? 0 : null;
  const sideA = tmcSide(S, w, r, A, () => 1 + Math.floor(R() * 6)), sideB = tmcSide(S, w, r, B, () => 1 + Math.floor(R() * 6));
  const input = { ground, seed, sides: [sideA, sideB], hold: G.hold, attacker, weather: w.weather || "clear" };
  // the odds, for the report and the highlights: the share of wins over a few quick battles
  const p = TMC.predict({ ...input, seed: (seed ^ 0x9e3779b9) >>> 0 }, 8);
  const pA = p.pWinA + p.pDraw / 2;
  // the battle itself; a battle fought live keeps its own result (who held the field, the share each side lost)
  const B0 = fixed ? null : TMC.fight(input);
  const O = fixed ? { kind: fixed.winner < 0 ? "stalemate" : "rout", winner: fixed.winner < 0 ? null : fixed.winner } : { kind: B0.kind, winner: B0.winner };
  // a standoff: a stalemate where hardly anyone fell, the attacker finding no way in: it pulls back where it came from
  if (!fixed && O.kind === "stalemate" && attacker != null && B0.loss[0] + B0.loss[1] < 0.05) O.kind = "standoff";
  const draw = O.winner == null, aWins = O.winner === 0;
  // each side's share lost, unit by unit (fled soldiers live: they fall back with the rest)
  const shareOf = (i, unit) => fixed ? fixed.losses[i] : (B0.lost[i][unit] || 0) / Math.max(1, (i ? B : A).army[unit] || 0);
  const lossA = fixed ? fixed.losses[0] : B0.loss[0], lossB = fixed ? fixed.losses[1] : B0.loss[1];
  const before = [A, B].map(x => ({ faction: x.faction, army: { ...x.army }, named: x.parts.filter(y => y.kind === "warband").flatMap(y => VET.forReplay(S.players[y.player].warband)), short: LOG.sideShort(S, x.parts) }));
  const parts = [];   // each warband part's army before and after, for its named soldiers
  // a sleeping tomb that is fought over wakes
  if (w.tomb && !w.awake && (A.faction === "dormant" || B.faction === "dormant")) { w.awake = true; note(S, `The tomb on ${w.name} wakes to the sound of battle`); }
  const fell = [{ n: 0, power: 0 }, { n: 0, power: 0 }];
  const hurt = (side, lost, i) => {
    for (const part of side.parts) {
      const box = part.kind === "garrison" ? r : part.kind === "warband" ? S.players[part.player].warband : S.swarms.find(s => s.id === part.id);
      const key = part.kind === "garrison" ? "garrison" : "army";
      const was = box[key], now = {};
      for (const [k, n] of Object.entries(was)) { const x = n * Math.min(1, shareOf(i, k)), l = Math.min(n, Math.floor(x) + (R() < x - Math.floor(x) ? 1 : 0)); now[k] = n - l; }
      box[key] = now;
      if (part.kind === "warband") parts.push({ part, i, was, lost });
      // the Dormant repair their fallen on a field they hold
      if (side.faction === "dormant" && !lost) for (const [k, n] of Object.entries(was)) { const x = (n - box[key][k]) * REPAIR; box[key][k] += Math.floor(x) + (R() < x - Math.floor(x) ? 1 : 0); }
      fell[i].n += total(was) - total(box[key]); fell[i].power += strength(was) - strength(box[key]);
      if (!lost) continue;
      // the beaten side: garrisons are gone, warbands and swarms fall back to a region of their own next door, or a
      // world of their own next door, or die; an attacker thrown back goes back where it came from
      if (part.kind === "garrison") { r.garrison = {}; continue; }
      const back = fallBack(S, w, r, side.faction, O.kind === "repulse" ? box.cameFrom || box.from || box.home : null);
      if (back) { box.at = back.at; box.region = back.region; } else box[key] = {};
      if (part.kind === "warband") S.players[part.player].warband.history.push(`Turn ${S.turn}: ${O.kind === "repulse" ? "thrown back" : "beaten"} at ${where(w, r)}${back ? ", fell back to " + where(S.worlds[back.at], RG.region(S.worlds[back.at], back.region)) : ", destroyed"}`);
    }
  };
  hurt(A, !draw && !aWins, 0); hurt(B, !draw && aWins, 1);
  if (O.kind === "standoff") for (const part of [A, B][attacker].parts) {
    if (part.kind === "garrison") continue;
    const box = part.kind === "warband" ? S.players[part.player].warband : S.swarms.find(s => s.id === part.id);
    if (!box) continue;
    const back = fallBack(S, w, r, [A, B][attacker].faction, box.cameFrom || box.from || box.home);
    if (back) { box.at = back.at; box.region = back.region; if (part.kind === "warband") box.history.push(`Turn ${S.turn}: found no way in at ${where(w, r)}, pulled back to ${where(S.worlds[back.at], RG.region(S.worlds[back.at], back.region))}`); }
  }
  S.swarms = S.swarms.filter(s => total(s.army));
  const winner = draw ? null : aWins ? A.faction : B.faction;
  // the named: who falls, who is named, the leader
  for (const x of parts) POL.battle(S, S.players[x.part.player], [A, B][x.i].faction === winner);
  const fallenNamed = parts.flatMap(x => VET.afterBattle(S, w, x.part, x.was, S.players[x.part.player].warband.army, [A, B][x.i].faction === winner, x.lost, x.i ? lossB : lossA, R));
  const leadersFell = parts.flatMap(x => S.players[x.part.player].warband.memorial.filter(m => m.leader && m.turn === S.turn && m.fell === w.name).map(m => m.name));
  // who the battle feeds: captives (and those who surrendered), biomass, fame (factions.js; the Brawl's close-combat
  // wins in the battle, tmc.js, add to it)
  FX.afterBattle(S, w, [A, B].map((x, i) => ({ faction: x.faction, parts: x.parts, won: winner === x.faction, p: i ? 1 - pA : pA, lostN: fell[i].n, lostPower: fell[i].power })), R, T, r);
  if (B0) [A, B].forEach((x, i) => {
    if (x.faction === "apostates" && B0.surrendered[1 - i]) S.factions.apostates.stock.captives += B0.surrendered[1 - i];
    if (x.faction === "brawl" && B0.fame[i]) S.factions.brawl.stock.fame += 3 * B0.fame[i];
  });
  const rc = B0 && B0.recon, names = [fname(A.faction), fname(B.faction)];
  const reconText = !rc ? "" : rc.winner == null ? (rc.bothConfused ? "Both sides blundered into each other." : rc.kind === "encounter" ? "The two forces met head on." : "They drew up for a pitched battle.")
    : `${cap(names[rc.winner])} ${rc.ambush ? "caught " + names[1 - rc.winner] + " in an ambush" : rc.surprise ? "took " + names[1 - rc.winner] + " by surprise" : "had the initiative"}.`;
  const ev = B0 ? B0.events.filter(e => ["surrender", "reanimate", "hot", "deed", "demoralized"].includes(e.kind)).slice(0, 4).map(e => e.text.replace(/^./, c => c.toUpperCase()) + ".").join(" ") : "";
  const report = {
    id: `t${S.turn}-${w.id}-${S.reports.filter(x => x.turn === S.turn && x.world === w.id).length}`,
    turn: S.turn, world: w.id, worldName: w.name, worldType: w.type, region: r.id, regionName: r.name, city: r.city || undefined, seed, odds: Math.round(pA * 100), winner,
    secs: B0 ? B0.rounds * 30 : 60, rounds: B0 ? B0.rounds : undefined, weather: w.weather && w.weather !== "clear" ? w.weather : undefined, outcome: O.kind, terrain: ground, hold: G.hold, night: B0 && B0.night ? true : undefined,
    recon: rc ? { winner: rc.winner, kind: rc.kind, surprise: rc.surprise || undefined, ambush: rc.ambush || undefined } : undefined,
    // what it takes to fight it again on the hex map (/api/tmc/<id>)
    tmc: B0 ? input : undefined,
    losses: [Math.round(lossA * 100) / 100, Math.round(lossB * 100) / 100], live: fixed ? true : undefined, held: fixed ? fixed.id : undefined, fallen: fallenNamed.filter(n => !leadersFell.includes(n)), leaders: leadersFell,
    sides: before.map((b, i) => ({ faction: b.faction, before: b.army, named: b.named, short: b.short || undefined, players: [A, B][i].parts.filter(x => x.kind === "warband").map(x => S.players[x.player].name) })),
    text: `${where(w, r)}: ${fname(A.faction)} (${describe(A.army)}) against ${fname(B.faction)} (${describe(B.army)}). ` +
      `Fought ${TER.TERRAIN[ground].at}${B0 && B0.night ? ", at night" : ""}${w.weather && w.weather !== "clear" ? ", in " + TER.WEATHER_NAMES[w.weather] : ""}. ` + (reconText ? reconText + " " : "") +
      (O.kind === "standoff" ? `${cap(fname([A, B][attacker].faction))} find no way in, and pull back.` : draw ? "Neither side gives way: they dig in to fight again." : O.kind === "repulse" ? `${cap(fname(winner))} throw back ${fname(aWins ? B.faction : A.faction)}.`
        : `${cap(fname(winner))} win${O.kind === "pyrrhic" ? ", at a terrible price" : pA >= 0.75 && aWins || pA <= 0.25 && !aWins ? ", as expected" : pA > 0.25 && pA < 0.75 ? " a close fight" : " against the odds"}.`) +
      (ev ? " " + ev : "") +
      ` The odds were ${Math.round(pA * 100)}% for ${fname(A.faction)}${G.hold != null ? `, ${fname([A, B][G.hold].faction)} holding the city${(w.walls || 0) ? " behind walls" : ""}` : ""}.` +
      ` ${cap(fname(A.faction))} lost about ${Math.round(lossA * 100)}%, ${fname(B.faction)} about ${Math.round(lossB * 100)}%${B0 ? `, in ${B0.rounds} round${B0.rounds === 1 ? "" : "s"}` : ""}.` +
      (fallenNamed.length ? ` Fallen among the named: ${fallenNamed.join(", ")}.` : "") +
      (fixed ? ` Fought live${fixed.by.length ? " by " + fixed.by.join(" and ") : ""}.` : ""),
  };
  for (const pl of report.sides.flatMap(s => s.players)) { const pp = Object.values(S.players).find(x => x.name === pl); if (pp) pp.warband.history.push(`Turn ${S.turn}: battle at ${where(w, r)}, ${winner === pp.faction ? "won" : draw ? "held" : "lost"}`); }
  S.reports.push(report);
}
// where a beaten force goes: back where it came from (thrown back), else a region of its own next door, else the
// seat of a world of its own next door; null: nowhere, it dies
function fallBack(S, w, r, f, from) {
  if (from && (from.at !== w.id || from.region !== r.id) && S.worlds[from.at] && RG.region(S.worlds[from.at], from.region)) return { at: from.at, region: from.region };
  const near = r.links.map(id => RG.region(w, id)).find(x => x.owner === f);
  if (near) return { at: w.id, region: near.id };
  for (const id of w.links) { const n = S.worlds[id], s = RG.seatOf(n, f); if (s) return { at: n.id, region: s.id }; }
  return null;
}

// ---- the AI's reach: where a force in a region may go next turn. The regions next door on its world, and on each
// world next door (and, through the gates, `gates`) the regions it may land in that it doesn't hold
function reachOf(S, w, r, f, gates = []) {
  const out = r.links.map(id => ({ w, r: RG.region(w, id) })).filter(x => x.r.owner !== f);
  for (const id of [...new Set([...w.links, ...gates])]) { const n = S.worlds[id]; for (const x of n.regions) if (x.owner !== f && RG.canLand(n, f, x.id)) out.push({ w: n, r: x }); }
  return out;
}
// what a region is worth taking: its capital, then a city, then the rest
const worth = r => r.capital ? 3 : r.city ? 2 : 1;
// the AI's pick: of the targets in reach, the most worth taking it is sure enough of (judged through the fog), the
// weakest first among equals; three tries at most
function pickTarget(S, f, targets, go, sure, R) {
  const them = x => factionsAt(S, x.w, x.r).reduce((a, s) => addArmy(a, s.army), {});
  const list = targets.map(x => ({ ...x, them: them(x) })).sort((a, b) => worth(b.r) - worth(a.r) || strength(a.them) - strength(b.them) || (a.w.id + a.r.id < b.w.id + b.r.id ? -1 : 1));
  // (the weakest of each worth first; a strong capital is tried after a weak city)
  list.sort((a, b) => (strength(a.them) > strength(go) ? 1 : 0) - (strength(b.them) > strength(go) ? 1 : 0));
  for (const t of list.slice(0, 3)) {
    const seed = Math.floor(R() * 2 ** 31);
    const theirs = factionsAt(S, t.w, t.r).sort((a, b) => strength(b.army) - strength(a.army))[0];
    if (!total(t.them)) return t;
    const us = { faction: f, army: go, parts: [] }, them = { faction: theirs.faction, army: BT.rough(t.them), parts: theirs.parts };
    const q = TMC.predict({ ground: t.r.terrain, seed, sides: [tmcSide(S, t.w, t.r, us), tmcSide(S, t.w, t.r, them)], hold: holds(t.r, theirs) ? 1 : undefined, attacker: 0 }, 4);
    if (q.pWinA >= sure) return t;
  }
  return null;
}

// ---- the Chorus: spends its biomass on new broods in the cities it holds, then sends swarms at whatever in reach it
// can beat, the richest first, keeping a garrison home
function chorusTurn(S, R) {
  const st = S.factions.chorus.stock;
  // swarms that hold a Chorus region join its garrison
  for (const sw of S.swarms) { if ((sw.faction || "chorus") !== "chorus" || sw.heldIn) continue; const r = regionOf(S, sw); if (r && r.owner === "chorus") { addArmy(r.garrison, sw.army); sw.army = {}; } }
  S.swarms = S.swarms.filter(s => total(s.army));
  // the broods: every city it holds
  const mine = Object.values(S.worlds).flatMap(w => w.regions.filter(r => r.city && r.owner === "chorus"));
  // a siege-form now and then, once the biomass has piled up, at the biggest brood
  if (st.biomass >= 80 * SCALE && mine.length && R() < 0.25) {
    const r = mine.slice().sort((a, b) => total(b.garrison) - total(a.garrison))[0];
    r.garrison.bulwark = (r.garrison.bulwark || 0) + 1; st.biomass -= UNITS.bulwark.cost.biomass;
  }
  if (st.biomass >= 200 * SCALE && mine.length && R() < 0.1) {
    const r = mine.slice().sort((a, b) => total(b.garrison) - total(a.garrison))[0];
    r.garrison.overmind = (r.garrison.overmind || 0) + 1; st.biomass -= UNITS.overmind.cost.biomass;
  }
  // first a Conductor for every brood without one, the biggest first, so they stay under synapse
  for (const r of mine.slice().sort((a, b) => total(b.garrison) - total(a.garrison))) if (!r.garrison.conductor && st.biomass >= UNITS.conductor.cost.biomass) { r.garrison.conductor = 1; st.biomass -= UNITS.conductor.cost.biomass; }
  const each = Math.min(Math.floor(st.biomass / (mine.length || 1)), 24 * SCALE);
  for (const r of mine) {
    let want = each;
    if (want <= 0) continue;
    st.biomass -= want;
    const add = (k, n = 1) => { r.garrison[k] = (r.garrison[k] || 0) + n; want -= UNITS[k].cost.biomass * n; };
    // its other forms, each by its own chance, a few at a time (a tenth of what it breeds this turn at most):
    // Stalkers and Hollows hunting, Burrowers under the ground, Bonewarriors to lead, a Mindspike now and then
    for (const [k, p] of [["stalker", 0.3], ["hollow", 0.2], ["burrower", 0.2], ["bonewarrior", 0.15], ["mindspike", 0.1]]) {
      if (R() >= p) continue;
      const n = Math.floor(R() * Math.max(1, Math.floor(each / 10 / UNITS[k].cost.biomass)) + 1);
      if (want >= n * UNITS[k].cost.biomass) add(k, n);
    }
    if (want > 0) { const l = Math.ceil(want / 2); add("leaper", l); if (want > 0) add("spitter", want); }
  }
  const idle = [];
  for (const w of Object.values(S.worlds)) for (const r of w.regions) {
    if (r.owner !== "chorus" || total(r.garrison) < 25 * SCALE || r.heldIn) continue;
    const send = cut(r.garrison, 0.4, R), go = Object.fromEntries(Object.entries(r.garrison).map(([k, n]) => [k, n - (send[k] || 0)]));
    // a swarm goes out with a Conductor if the brood can spare one (it breeds another), so its broods stay linked
    if (!go.conductor && (send.conductor || 0) >= 1) { send.conductor--; go.conductor = 1; }
    const reach = reachOf(S, w, r, "chorus"), t = pickTarget(S, "chorus", reach, go, 0.5, R);
    if (!t) { idle.push({ w, r, send, go, reach }); continue; }
    r.garrison = send;
    S.swarms.push({ id: `s${S.turn}-${w.id}-${r.id}`, faction: "chorus", at: t.w.id, region: t.r.id, from: { at: w.id, region: r.id }, army: go });
    if (t.w !== w || t.r.city) note(S, `The Chorus swarms from ${where(w, r)} toward ${where(t.w, t.r)}`);
  }
  // the broods gather (fronts.js's draft): broods that couldn't win alone pool against a target in reach of two or
  // more of them, the richest first, if together they're sure enough
  const byTarget = new Map();
  for (const b of idle) for (const x of b.reach) { const k = x.w.id + "/" + x.r.id; if (!byTarget.has(k)) byTarget.set(k, { x, broods: [] }); byTarget.get(k).broods.push(b); }
  const used = new Set();
  for (const { x, broods } of [...byTarget.values()].filter(t => t.broods.length >= 2).sort((a, b) => worth(b.x.r) - worth(a.x.r) || b.broods.length - a.broods.length || (a.x.w.id + a.x.r.id < b.x.w.id + b.x.r.id ? -1 : 1)).slice(0, 6)) {
    const free = broods.filter(b => !used.has(b));
    if (free.length < 2) continue;
    const go = free.reduce((a, b) => addArmy(a, b.go), {});
    const t = pickTarget(S, "chorus", [x], go, 0.5, R);
    if (!t) continue;
    for (const b of free) { used.add(b); b.r.garrison = b.send; }
    S.swarms.push({ id: `s${S.turn}-${x.w.id}-${x.r.id}-g`, faction: "chorus", at: x.w.id, region: x.r.id, from: { at: free[0].w.id, region: free[0].r.id }, army: go });
    note(S, `The Chorus gathers ${free.length} broods against ${where(x.w, x.r)}`);
  }
}

// ---- the Dormant: a tomb sleeps until it is fought over or its turn comes. Awake, it holds what it has and sends a
// war party at a region in reach only when sure of winning (it can't replace the fallen, only repair them), keeping
// half at home. A war party raids and comes home the next turn: the Dormant purge, they don't settle. One whose tomb
// has fallen stays where it is, a lost remnant
function dormantTurn(S, R) {
  for (const sw of S.swarms) {
    if (sw.faction !== "dormant" || sw.heldIn) continue;
    const home = sw.home && RG.region(S.worlds[sw.home.at], sw.home.region);
    if (home && home.owner === "dormant") { addArmy(home.garrison, sw.army); sw.army = {}; }
  }
  S.swarms = S.swarms.filter(s => total(s.army));
  for (const w of Object.values(S.worlds)) {
    if (w.owner !== "dormant") continue;
    if (w.tomb && !w.awake) { if (S.turn >= w.wakeAt) { w.awake = true; note(S, `Lights kindle deep inside ${w.name}: the tomb is waking`); } continue; }
    const r = RG.capitalOf(w);
    if (r.owner !== "dormant" || strength(r.garrison) < DORMANT_RAID || r.heldIn || S.turn - (w.raidT ?? -99) < RAID_REST) continue;   // a tomb rests between raids
    // through the gates, the worlds next to every other gate the Dormant hold
    const gates = w.gate ? Object.values(S.worlds).filter(g => g.gate && g.owner === "dormant" && g !== w).flatMap(g => g.links) : [];
    const stay = cut(r.garrison, 0.5, R), go = Object.fromEntries(Object.entries(r.garrison).map(([k, n]) => [k, n - (stay[k] || 0)]));
    if (!total(go)) continue;
    const t = pickTarget(S, "dormant", reachOf(S, w, r, "dormant", gates).filter(x => x.w.owner !== "dormant"), go, 0.75, R);
    if (!t) continue;
    r.garrison = stay;
    S.swarms.push({ id: `d${S.turn}-${w.id}`, faction: "dormant", at: t.w.id, region: t.r.id, home: { at: w.id, region: r.id }, army: go }); w.raidT = S.turn;
    note(S, `The Dormant march out of ${w.name} toward ${where(t.w, t.r)}`);
  }
}

// ---- the event log
function apply(S, e) {
  if (e.type === "create") return create(e.seed, e.opt);
  if (e.type === "join") { join(S, e); return S; }
  if (e.type === "order") { const err = order(S, e); if (err) note(S, `order refused: ${err}`); return S; }
  if (e.type === "tick") { tick(S, e.seed); return S; }
  if (e.type === "notice") { note(S, String(e.text)); return S; }   // a word from the admin, in the news (a rollback, a pause)
  if (e.type === "politics") { POL.apply(S, e); return S; }         // votes, standing, the Warmaster's acts (checked when given)
  if (e.type === "live") { const h = (S.held || []).find(x => x.id === e.id); if (h && !h.result) h.result = { winner: e.winner, losses: e.losses }; return S; }   // a held battle's result, fought live
  if (e.type === "upvote") { if (!upvote(S, e)) HL.vote(S, e); return S; }   // a highlight marked worth watching
  throw new Error(`unknown event ${e.type}`);
}
const rebuild = events => events.reduce((S, e) => apply(S, e), null);

// ---- what a player may see: the map, who holds each world and each region are public; armies only where the
// faction has eyes (its own worlds, its warbands, and the worlds one jump from either)
function view(S, player) {
  const p = S.players[player];
  if (!p) return null;
  const f = p.faction, eyes = eyesOf(S, f), wb = p.warband, here = S.worlds[wb.at], hr = regionOf(S, wb);
  // fog (battle.js): a faction sees forces exactly in a region it holds and on a world where it has a warband,
  // roughly (to the nearest 5) elsewhere it has eyes; the odds shown are a band, narrow or wide by the same
  const near = new Set(Object.values(S.players).filter(q => q.faction === f).map(q => q.warband.at));
  const exact = (w, r) => r.owner === f || near.has(w.id);
  // the odds the warband would have where it can go, against the strongest foe it can see there (the resolver, with a
  // fixed seed: advice, not the battle's dice; a region's holding favours its holder as in a real fight): the regions
  // next door, and on each world it can move to, where it would land by default and the capital if it may land there
  const odds = {}, landing = {};
  const put = (w, rid) => { if (!eyes.has(w.id)) return; const o = oddsAt(S, p, w.id, rid, true); if (o != null) odds[`${w.id}/${rid}`] = BT.band(o, exact(w, RG.region(w, rid))); };
  for (const rid of hr.links) put(here, rid);
  for (const id of FX.moves(S, f, wb.at)) {
    const w = S.worlds[id], d = RG.defaultLanding(w, f), c = RG.capitalOf(w);
    landing[id] = { default: d, may: w.regions.filter(r => RG.canLand(w, f, r.id)).map(r => r.id) };
    if (d) { put(w, d); const o = odds[`${id}/${d}`]; if (o) odds[id] = o; }
    if (c.id !== d && RG.canLand(w, f, c.id)) put(w, c.id);
  }
  const forcesIn = (w, list) => list.map(s => ({ faction: s.faction, rough: s.faction !== f && !exact(w, s.region || {}) || undefined, army: Object.fromEntries(Object.entries(s.faction !== f && !exact(w, s.region || {}) ? BT.rough(s.army) : s.army).map(([k, n]) => [nameOf(k), n])), players: s.parts.filter(x => x.kind === "warband").map(x => S.players[x.player].name) }));
  return {
    turn: S.turn, you: { name: p.name, faction: f, warband: wb, stock: S.factions[f].stock, moves: FX.moves(S, f, wb.at), marches: hr.links, landing, odds,
      edict: f === "hegemony" ? S.factions.hegemony.edict : null, rituals: f === "apostates" ? FX.RITUALS : null, walls: WALLS, turnBack: TURN_BACK, depot: LOG.DEPOT, convoyMax: LOG.CONVOY.max },
    politics: POL.view(S, p),
    held: (S.held || []).filter(h => h.commanders.includes(p.id)).map(h => ({ id: h.id, world: h.worldName, region: h.regionName, turn: h.turn, done: !!h.result })),
    highlights: HL.view(S, p, knows(S, p)),
    factions: { ...Object.fromEntries(Object.entries(S.factions).map(([k, v]) => [k, { name: v.name, colour: v.colour }])), militia: { name: MILITIA.name, colour: "#8d887e" } },
    units: Object.fromEntries(Object.entries(UNITS).filter(([, u]) => u.faction === f).map(([k, u]) => [k, { name: u.name, cost: u.cost, role: u.role || (FACTIONS[f].line || []).includes(k) ? u.role || "line" : "troops" }])),
    specials: { have: specials(wb.army), cap: specialCap(f, wb.army) }, vehicles: { have: vehicles(wb.army), cap: vehicleCap(f, wb.army), here: here.type === "forge" || here.id === S.factions[f].capital },
    terrains: Object.fromEntries(Object.entries(TER.TERRAIN).map(([k, t]) => [k, t.name])),
    worlds: S.order.map(id => {
      const w = S.worlds[id], seen = eyes.has(id);
      // loyalty is known to the Hegemony on its own worlds, and to the Apostates where they have eyes (they look for it)
      const loyal = w.owner === "hegemony" && (f === "hegemony" || (f === "apostates" && seen)) ? Math.round(w.loyalty) : undefined;
      return { id, name: w.name, x: w.x, y: w.y, type: w.type, typeName: TYPES[w.type].name, owner: w.owner, links: w.links, capital: !!w.capital, seen, walls: w.walls || 0, terrain: Object.keys(w.terrain || {}).sort((a, b) => w.terrain[b] - w.terrain[a]).map(k => TER.TERRAIN[k].name), blockaded: !!w.blockaded,
        contested: RG.contested(w), split: RG.split(w), weather: w.weather ? TER.WEATHER_NAMES[w.weather] : undefined,
        depot: w.depot ? (w.owner === f ? { supply: w.depot.supply } : seen ? {} : undefined) : undefined,
        convoys: S.convoys.filter(c => c.at === id && (c.faction === f || seen)).map(c => ({ faction: c.faction, to: S.worlds[c.to].name, supply: c.faction === f ? c.supply : undefined })), tomb: !!w.tomb, gate: !!w.gate, asleep: seen && w.tomb ? !w.awake : undefined, loyalty: loyal,
        held: w.owner === f ? S.turn - (w.heldSince ?? 0) : undefined,
        forces: seen ? forcesIn(w, factionsOn(S, w).map(s => ({ ...s, region: s.faction === f ? { owner: f } : {} }))) : null,
        regions: w.regions.map(r => ({ id: r.id, name: r.name, terrain: r.terrain, city: r.city, capital: r.capital, x: r.x, y: r.y, links: r.links, owner: r.owner, battle: !!r.heldIn || undefined, siege: r.siege || undefined,
          forces: seen ? forcesIn(w, factionsAt(S, w, r).map(s => ({ ...s, region: r }))) : null })) };
    }),
    // the last 30 battles the faction knows of, and always its own warbands' last 10
    reports: (() => { const k = S.reports.filter(r => r.sides.some(s => s.faction === f) || eyes.has(r.world)), last = k.slice(-30), own = k.filter(r => r.sides.some(s => s.players.length && s.faction === f)).slice(-10);
      return [...new Set([...last, ...own])].sort((a, b) => S.reports.indexOf(b) - S.reports.indexOf(a)); })(),
    news: S.log.slice(-30).reverse(),
  };
}
// where a faction has eyes: its own worlds and its warbands' worlds, any world where it holds a region, and the
// worlds one jump from any of those
function eyesOf(S, f) {
  const eyes = new Set(), look = w => { eyes.add(w.id); w.links.forEach(n => eyes.add(n)); };
  for (const w of Object.values(S.worlds)) if (w.owner === f || w.regions.some(r => r.owner === f)) look(w);
  for (const q of Object.values(S.players)) if (q.faction === f) look(S.worlds[q.warband.at]);
  return eyes;
}
// ---- battles fought live. A warband with `command` on has its battles held open at the tick for its player to fight
// in person on the full engine (game/live.js runs it on the server from the player's answers); the result comes in as
// a "live" event and is applied at the next tick, or the resolver settles it there if none did
const commanders = (S, A, B) => [A, B].map(x => { const q = x.parts.find(y => y.kind === "warband" && S.players[y.player].warband.command && !y.player.startsWith("bot-")); return q ? q.player : null; });
function hold(S, w, r, A, B, R) {
  const id = `h${S.turn}-${w.id}-${r.id}`, cmd = commanders(S, A, B);
  const seed = Math.floor(R() * 2 ** 31);
  const sides = [A, B].map(x => ({ faction: x.faction, before: { ...x.army }, named: x.parts.filter(y => y.kind === "warband").flatMap(y => VET.forReplay(S.players[y.player].warband)), short: LOG.sideShort(S, x.parts),
    players: x.parts.filter(y => y.kind === "warband").map(y => S.players[y.player].name) }));
  // who is in it: only these forces are settled by it (anyone arriving meanwhile fights afterwards, as usual)
  const parts = [A, B].map(x => x.parts.map(y => ({ ...y })));
  (S.held ||= []).push({ id, world: w.id, worldName: w.name, region: r.id, regionName: r.name, turn: S.turn, seed, terrain: r.terrain, hold: groundOf(r, A, B).hold, factions: [A.faction, B.faction], sides, parts, commanders: cmd, result: null });
  r.heldIn = id;
  for (const x of [A, B]) for (const part of x.parts) {
    if (part.kind === "warband") { const wb = S.players[part.player].warband; wb.heldIn = id; wb.history.push(`Turn ${S.turn}: a battle at ${where(w, r)}, held for ${cmd.filter(Boolean).map(c => S.players[c].name).join(" and ")} to fight`); }
    else if (part.kind === "swarm") { const sw = S.swarms.find(s => s.id === part.id); if (sw) sw.heldIn = id; }
  }
  note(S, `A battle at ${where(w, r)} waits for its commander${cmd.filter(Boolean).length > 1 ? "s" : ""}: ${cmd.filter(Boolean).map(c => S.players[c].name).join(" and ")}`);
}
// a held battle's side as it stands now: the same forces, with what they have left
function heldSide(S, w, r, faction, parts) {
  const side = { faction, army: {}, parts: [] };
  const there = b => b && b.at === w.id && b.region === r.id;
  for (const part of parts) {
    const box = part.kind === "garrison" ? ((r.owner || "militia") === faction ? r.garrison : null) : part.kind === "warband" ? (S.players[part.player] && there(S.players[part.player].warband) ? S.players[part.player].warband.army : null) : (S.swarms.find(s => s.id === part.id && there(s)) || {}).army;
    if (!box || !total(box)) continue;
    addArmy(side.army, box); side.parts.push(part);
  }
  return side.parts.length ? side : null;
}
function settleHeld(S, R, T) {
  for (const h of S.held || []) {
    const w = S.worlds[h.world], r = RG.region(w, h.region);
    const A = heldSide(S, w, r, h.factions[0], h.parts[0]), B = heldSide(S, w, r, h.factions[1], h.parts[1]);
    r.heldIn = null;
    for (const p of Object.values(S.players)) if (p.warband.heldIn === h.id) p.warband.heldIn = null;
    for (const sw of S.swarms) if (sw.heldIn === h.id) sw.heldIn = null;
    if (!A || !B) continue;   // one side gone meanwhile (a rollback, a deserted garrison): nothing to fight
    fight(S, w, r, A, B, R, T, h.result ? { ...h.result, id: h.id, terrain: h.terrain, by: h.commanders.filter(Boolean).map(c => S.players[c] ? S.players[c].name : c) } : null);
  }
  S.held = [];
}

// a politics action checked against the state now (the server logs only what passes)
const politics = (S, e) => POL.check(S, e);
// which battles a player's faction knows of: its own, and those where it has eyes
function knows(S, p) {
  const f = p.faction, eyes = eyesOf(S, f);
  return r => r.sides.some(s => s.faction === f) || eyes.has(r.world);
}
// an upvote checked: returns the problem or null
const upvote = (S, e) => S.players[e.player] ? HL.checkVote(S, e, knows(S, S.players[e.player])) : "no such player";
module.exports = { politics, upvote, apply, rebuild, view, order, total, strength, supplied, holdBonus, oddsAt, factionsAt, factionsOn, knows, START };
