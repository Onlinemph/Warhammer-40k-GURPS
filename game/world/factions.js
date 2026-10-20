// Each faction's own rules (docs/setting.md, Faction mechanics): its currency and what it does at the tick. Called
// from rules.js, which passes its helpers in (`H`) so the two files don't require each other. Like everything in the
// war it is worked out from the log: the tick's dice (`R`) are the only randomness.
const { UNITS, FACTIONS, SCALE } = require("./units.js");
const RG = require("./regions.js");

// loyalty: +5 a turn in supply; -5 beside an Apostate world, -10 with an Apostate warband on it or next door
const LOYALTY = { start: 60, capital: 100, retaken: 30, gain: 5, nearWorld: 5, nearWarband: 10, defect: 25, corruptible: 50 };
const EDICT = { every: 10, lasts: 10, hold: 5, loyalty: 20, materiel: 60 * SCALE, fail: 10 };
const WARDEN_HELD = 10;                        // turns a world must be held before it can grow Wardens
const CAPTIVES = 0.2;                          // share of the enemy's fallen the Apostates take alive
const RITUALS = {
  summon:  { name: "Summoning",  captives: 15 * SCALE, turns: 3 },
  corrupt: { name: "Corruption", captives: 10 * SCALE, turns: 3 },
};
// a Hegemony warband out of supply this long loses Levies to the Apostates; and of the Levies that march onto an
// Apostate world, this share turn their coats before the battle
const TURNED = { after: 3, share: 0.1, onWorld: 0.5 };
const FAME = { odds: 2, raise: 0.1, peace: 4, infighting: 0.05, grow: 0.1 };
const CORPSE = 1;                          // biomass the Chorus gets for each soldier dead on a field it holds
const INFEST = { dead: 60 * SCALE, delay: 3, guard: 20 * SCALE, brood: { leaper: 10 * SCALE, spitter: 5 * SCALE } };

const note = (S, text) => S.log.push({ turn: S.turn, text });
// T, passed to afterBattle and upkeep, is the tick's scratch (where battles were, how many died), kept off the state

// ---- moving: one jump along a lane, or from one gate to another gate the faction holds
function canMove(S, faction, from, to) {
  const a = S.worlds[from], b = S.worlds[to];
  if (!a || !b || a === b) return false;
  return a.links.includes(to) || (!!a.gate && !!b.gate && b.owner === faction);
}
function moves(S, faction, from) {
  const a = S.worlds[from];
  const gates = a.gate ? Object.values(S.worlds).filter(w => w.gate && w.id !== from && w.owner === faction && !a.links.includes(w.id)).map(w => w.id) : [];
  return [...a.links, ...gates];
}

// ---- at the war's start
function setup(S) {
  for (const w of Object.values(S.worlds)) { w.heldSince = 0; if (w.owner === "hegemony") w.loyalty = w.capital ? LOYALTY.capital : LOYALTY.start; }
  S.factions.apostates.stock.captives = 0;
  S.factions.brawl.stock.fame = 0;
  S.factions.hegemony.edict = null;
  S.broken = [];   // tombs broken open: { world, by, turn }
}
function joined(S, p) { p.warband.lastFight = S.turn; p.warband.outFor = 0; }

// ---- orders: what each faction may add, checked when the order comes in; returns the problem or null
function checkOrder(S, p, o) {
  const wb = p.warband, here = S.worlds[wb.at];
  if (o.move && wb.ritual) return `the ${RITUALS[wb.ritual.kind].name} holds the warband at ${here.name} until turn ${wb.ritual.done}`;
  for (const r of o.recruit || []) if (r.unit === "warden" && !here.capital && S.turn - (here.heldSince ?? 0) < WARDEN_HELD)
    return `Wardens are grown only on worlds held ${WARDEN_HELD} turns (${here.name}: ${S.turn - here.heldSince})`;
  if (!o.ritual) return null;
  const R0 = RITUALS[o.ritual.kind], st = S.factions[p.faction].stock;
  if (p.faction !== "apostates" || !R0) return "no such ritual";
  if (o.move) return "a ritual keeps the warband where it is";
  if (wb.ritual) return "a ritual is already under way";
  if (here.owner !== "apostates") return "rituals are held on your own worlds";
  if ((st.captives || 0) < R0.captives) return `the ${R0.name} needs ${R0.captives} captives (${Math.floor(st.captives || 0)} held)`;
  if (o.ritual.kind === "corrupt") {
    const t = S.worlds[o.ritual.target];
    if (!t || !here.links.includes(t.id) || t.owner !== "hegemony" || t.capital) return "a Corruption is aimed at a Hegemony world next door (not a capital)";
    if (t.loyalty >= LOYALTY.corruptible) return `${t.name} is too loyal (${Math.round(t.loyalty)})`;
  }
  return null;
}
// the order's ritual begins at the tick: the captives are spent and everyone hears of it
function beginRitual(S, p, o) {
  if (!o.ritual || checkOrder(S, p, { ...o, move: null })) return;
  const R0 = RITUALS[o.ritual.kind], wb = p.warband, here = S.worlds[wb.at];
  S.factions.apostates.stock.captives -= R0.captives;
  wb.ritual = { kind: o.ritual.kind, at: wb.at, target: o.ritual.target || null, done: S.turn + R0.turns };
  const t = wb.ritual.target && S.worlds[wb.ritual.target];
  note(S, `${p.name} begins a ${R0.name} on ${here.name}${t ? " against " + t.name : ""}`);
  wb.history.push(`Turn ${S.turn}: began a ${R0.name} at ${here.name}`);
}

// ---- a battle's aftermath: who it feeds. `sides` are the two sides with what each lost (count and power), whether
// it won, and its chance
function afterBattle(S, w, sides, R, T, r) {
  const dead = sides.reduce((a, s) => a + s.lostN, 0);
  T.fought.add(w.id);
  T.dead[w.id] = (T.dead[w.id] || 0) + dead;
  // (where on the world the most fell: where they rise, if they do)
  const at = (T.deadAt[w.id] ||= {}); at[r.id] = (at[r.id] || 0) + dead;
  for (const [s, o] of [[sides[0], sides[1]], [sides[1], sides[0]]]) {
    // the Apostates take a fifth of the enemy's fallen alive
    if (s.faction === "apostates" && s.won) S.factions.apostates.stock.captives += Math.round(o.lostN * CAPTIVES);
    // the Chorus eats the dead of a field it holds
    if (s.faction === "chorus" && (s.won || (!o.won && r.owner === "chorus"))) S.factions.chorus.stock.biomass += dead * CORPSE;
    for (const part of s.parts) {
      if (part.kind !== "warband") continue;
      const wb = S.players[part.player].warband;
      wb.lastFight = S.turn;
      if (s.faction !== "brawl") continue;
      // fame for the power put down, doubled against the odds; and the winners grow
      const fame = o.lostPower * (s.p < 0.5 ? FAME.odds : 1) / s.parts.filter(x => x.kind === "warband").length;
      S.factions.brawl.stock.fame += fame;
      if (s.won && wb.army.brawler) {
        const x = wb.army.brawler * FAME.grow, n = Math.min(wb.army.brawler, Math.floor(x) + (R() < x - Math.floor(x) ? 1 : 0));
        if (n) { wb.army.brawler -= n; wb.army.boss = (wb.army.boss || 0) + n; wb.history.push(`Turn ${S.turn}: ${n} Brawler${n > 1 ? "s" : ""} grew into Boss${n > 1 ? "es" : ""}`); }
      }
    }
  }
}

// ---- a world changing hands
function captured(S, w, was) {
  w.heldSince = S.turn;
  if (w.owner === "hegemony") w.loyalty = LOYALTY.retaken; else delete w.loyalty;
  if (was === "dormant" && w.type === "tomb") S.broken.push({ world: w.id, by: w.owner, turn: S.turn });
}
// a Hegemony world going over to the Apostates: every region the Hegemony holds there, its Levies turning their coats
function defect(S, w, why) {
  for (const r of w.regions) if (r.owner === "hegemony") turn(r);
  w.owner = "apostates"; w.heldSince = S.turn; delete w.loyalty;
  note(S, `${w.name} goes over to the Apostates${why}`);
}
const turn = r => { const levies = r.garrison.levy || 0; r.owner = "apostates"; r.garrison = levies ? { turncoat: levies } : {}; };

// ---- supply: what a Hegemony warband long out of supply loses goes to the Apostates; returns true when handled
function outOfSupply(S, p, H, R) {
  const wb = p.warband;
  if (p.faction !== "hegemony" || wb.outFor < TURNED.after || !wb.army.levy) return false;
  // the nearest Apostate world, by lanes
  const seen = new Set([wb.at]), q = [wb.at];
  let to = null;
  while (q.length && !to) for (const n of S.worlds[q.shift()].links) { if (seen.has(n)) continue; seen.add(n); if (S.worlds[n].owner === "apostates") { to = S.worlds[n]; break; } q.push(n); }
  if (!to) return false;
  const seat = RG.seatOf(to, "apostates");
  if (!seat) return false;
  const kept = H.cut({ levy: wb.army.levy }, TURNED.share, R).levy, n = wb.army.levy - kept;
  const rest = H.cut(Object.fromEntries(Object.entries(wb.army).filter(([k]) => k !== "levy")), H.ATTRITION, R);
  wb.army = { ...rest, levy: kept };
  if (n) { seat.garrison.turncoat = (seat.garrison.turncoat || 0) + n; wb.history.push(`Turn ${S.turn}: ${n} Levies deserted to the Apostates at ${to.name}`); }
  return true;
}

// ---- before the battles in a region: Levies sent against an Apostate city, once Hegemony like their own, turn on
// arrival and join its garrison as Turncoats
function beforeBattle(S, w, r, H, R) {
  if (r.owner !== "apostates" || !r.city) return;
  for (const p of Object.values(S.players)) {
    const wb = p.warband;
    if (p.faction !== "hegemony" || wb.at !== w.id || wb.region !== r.id || !wb.army.levy) continue;
    const n = wb.army.levy - H.cut({ levy: wb.army.levy }, TURNED.onWorld, R).levy;
    if (!n) continue;
    wb.army.levy -= n; r.garrison.turncoat = (r.garrison.turncoat || 0) + n;
    wb.history.push(`Turn ${S.turn}: ${n} Levies turned their coats at ${r.name} on ${w.name}`);
    note(S, `${n} of ${p.name}'s Levies go over to the Apostates at ${r.name} on ${w.name}`);
  }
}

// ---- the end of the tick: loyalty and edicts, rituals, fame, the dead rising
function upkeep(S, H, R, T) {
  const W = Object.values(S.worlds);
  // the Hegemony: loyalty rises in supply and falls beside the Apostates; the disloyal go over
  const sup = H.supplied(S, "hegemony");
  const apoWarband = w => Object.values(S.players).some(p => p.faction === "apostates" && H.total(p.warband.army) && (p.warband.at === w.id || w.links.includes(p.warband.at)));
  const pressure = w => apoWarband(w) ? LOYALTY.nearWarband : w.links.some(n => S.worlds[n].owner === "apostates") ? LOYALTY.nearWorld : 0;
  for (const w of W) {
    if (w.owner !== "hegemony") continue;
    w.loyalty = Math.max(0, Math.min(100, (w.loyalty ?? LOYALTY.start) + (sup.has(w.id) ? LOYALTY.gain : 0) - pressure(w)));
    if (w.loyalty < LOYALTY.defect && !w.capital && w.links.some(n => S.worlds[n].owner === "apostates")) defect(S, w, ", its loyalty spent");
  }
  edicts(S, H, R);
  // the Apostates: rituals finish, or fail if fought over or left
  for (const p of Object.values(S.players)) {
    const wb = p.warband, r = wb.ritual;
    if (!r) continue;
    const R0 = RITUALS[r.kind], at = S.worlds[r.at];
    if (wb.at !== r.at || T.fought.has(r.at) || at.owner !== "apostates") { note(S, `${p.name}'s ${R0.name} on ${at.name} is broken`); wb.history.push(`Turn ${S.turn}: the ${R0.name} was broken`); wb.ritual = null; continue; }
    if (S.turn < r.done) continue;
    wb.ritual = null;
    if (r.kind === "summon") { wb.army.vessel = (wb.army.vessel || 0) + 2; note(S, `Something answers ${p.name}'s Summoning on ${at.name}`); wb.history.push(`Turn ${S.turn}: the Summoning gave 2 Vessels`); }
    else {
      const t = S.worlds[r.target];
      // a Corruption turns a city: the world's capital, the seat of its governor, and its Levies with it
      const c = RG.capitalOf(t);
      if (t.owner === "hegemony" && !t.capital && t.loyalty < LOYALTY.corruptible && c.owner === "hegemony") { turn(c); note(S, `${c.name} on ${t.name} goes over to the Apostates, corrupted by ${p.name}`); wb.history.push(`Turn ${S.turn}: corrupted ${c.name} on ${t.name}`); }
      else note(S, `${p.name}'s Corruption finds no purchase on ${t.name}`);
    }
  }
  // the Brawl: fame raises free Brawlers at the capital; warbands at peace fight each other
  const bst = S.factions.brawl.stock, bcap = S.worlds[S.factions.brawl.capital];
  const bseat = bcap && RG.capitalOf(bcap);
  if (bcap && bcap.owner === "brawl" && bseat.owner === "brawl") {
    const n = Math.min(H.GARRISON_CAP - H.total(bseat.garrison), Math.floor(bst.fame * FAME.raise / UNITS.brawler.power));
    if (n > 0) bseat.garrison.brawler = (bseat.garrison.brawler || 0) + n;
  }
  for (const p of Object.values(S.players)) {
    if (p.faction !== "brawl" || S.turn - (p.warband.lastFight ?? 0) < FAME.peace || !H.total(p.warband.army)) continue;
    const before = H.total(p.warband.army);
    p.warband.army = H.cut(p.warband.army, FAME.infighting, R);
    const n = before - H.total(p.warband.army);
    if (n) p.warband.history.push(`Turn ${S.turn}: bored, the warband fought itself (${n} lost)`);
  }
  // the Chorus: a heap of dead on a world beside the Chorus, or where it holds a region, rises a few turns later in the
  // region where most of them fell, unless that region is held in strength
  const nearChorus = w => w.regions.some(r => r.owner === "chorus") || w.links.some(n => S.worlds[n].owner === "chorus");
  for (const w of W) {
    if ((T.dead[w.id] || 0) >= INFEST.dead && w.infestAt == null && nearChorus(w)) {
      const at = Object.entries(T.deadAt[w.id] || {}).sort((a, b) => b[1] - a[1])[0];
      if (at && RG.region(w, at[0]).owner !== "chorus") { w.infestAt = S.turn + INFEST.delay; w.infestIn = at[0]; }
    }
    if (w.infestAt !== S.turn) continue;
    w.infestAt = null;
    const r = RG.region(w, w.infestIn);
    const held = H.factionsIn(S, w, r).filter(s => s.faction !== "chorus").reduce((a, s) => a + H.total(s.army), 0);
    if (r.owner === "chorus" || held >= INFEST.guard) continue;
    const was = r.owner;
    r.owner = "chorus"; r.garrison = { ...INFEST.brood };
    note(S, `The dead of ${r.name} on ${w.name} rise: it is the Chorus's now${was ? ", lost by " + FACTIONS[was].name : ""}`);
  }
}

// ---- Hegemony edicts: every 10 turns a sealed goal opens for 10 turns (take, hold, or break a tomb)
function edicts(S, H, R) {
  const F = S.factions.hegemony, mine = Object.values(S.worlds).filter(w => w.owner === "hegemony");
  const e = F.edict;
  if (e) {
    const t = S.worlds[e.world];
    let done = false;
    if (e.kind === "take") done = t.owner === "hegemony";
    else if (e.kind === "hold") { e.held = t.owner === "hegemony" ? e.held + 1 : 0; done = e.held >= EDICT.hold; }
    else done = S.broken.some(b => b.world === e.world && b.by === "hegemony" && b.turn >= e.opened);
    if (done) {
      for (const w of mine) w.loyalty = Math.min(100, w.loyalty + EDICT.loyalty);
      F.stock.materiel += EDICT.materiel; F.edict = null;
      note(S, `The edict is fulfilled: ${e.text}. The Hegemony rejoices`);
    } else if (S.turn >= e.until) {
      for (const w of mine) w.loyalty = Math.max(0, w.loyalty - EDICT.fail);
      F.edict = null;
      note(S, `The edict has failed: ${e.text}. Faith in the Founder wavers`);
    }
  }
  if (F.edict || S.turn % EDICT.every !== 0 || !mine.length) return;
  const border = id => S.worlds[id].owner !== "hegemony";
  const take = Object.values(S.worlds).filter(w => w.owner !== "hegemony" && w.links.some(n => S.worlds[n].owner === "hegemony"));
  const hold = mine.filter(w => w.links.some(border));
  const tombs = Object.values(S.worlds).filter(w => w.tomb && w.owner === "dormant");
  const kinds = [take.length && "take", hold.length && "hold", tombs.length && "tomb"].filter(Boolean);
  if (!kinds.length) return;
  const kind = kinds[Math.floor(R() * kinds.length)], list = kind === "take" ? take : kind === "hold" ? hold : tombs;
  const t = list[Math.floor(R() * list.length)];
  const text = kind === "take" ? `take ${t.name}` : kind === "hold" ? `hold ${t.name} for ${EDICT.hold} turns` : `break the tomb on ${t.name}`;
  F.edict = { kind, world: t.id, text, opened: S.turn, until: S.turn + EDICT.lasts, held: 0 };
  note(S, `A sealed edict opens: ${text}, within ${EDICT.lasts} turns`);
}

module.exports = { canMove, moves, setup, joined, checkOrder, beginRitual, beforeBattle, afterBattle, captured, outOfSupply, upkeep, RITUALS, LOYALTY, WARDEN_HELD, TURNED };
