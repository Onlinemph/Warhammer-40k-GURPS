// The war's rules. A game is nothing but its event log: the inputs (the war's creation, players joining, orders,
// ticks with their random seeds) applied in order by apply(). Everything else (worlds, armies, battles, reports)
// is worked out from those, so the same log always rebuilds the same war (rollbacks after an exploit, audits and
// the soldiers' histories all come from that), and the server only has to store the log.
const { generate, TYPES, rng } = require("./galaxy.js");
const { UNITS, FACTIONS, MILITIA, templateOf, nameOf } = require("./units.js");
const { predict } = require("../../tools/resolver/resolver.js");
const FX = require("./factions.js");
const VET = require("./veterans.js");
const LOG = require("./logistics.js");
const POL = require("./politics.js");

const START = {
  hegemony:  { stock: { manpower: 40, materiel: 60 }, warband: { levy: 15, storm: 3 }, garrison: { levy: 20 } },
  apostates: { stock: { manpower: 40, materiel: 40 }, warband: { turncoat: 15, zealot: 3, vessel: 1 }, garrison: { faithless: 20, turncoat: 12 } },
  brawl:     { stock: { manpower: 40, materiel: 40 }, warband: { brawler: 20, boss: 3 }, garrison: { brawler: 20 } },
  chorus:    { stock: { biomass: 40 }, garrison: { leaper: 20, spitter: 10, conductor: 1 } },
  // a tomb's sleepers: the whole of the Dormant there will ever be
  dormant:   { stock: {}, garrison: { husk: 6, sentinel: 2, watcher: 1, flenser: 2, keeper: 1 } },
};
const GARRISON_CAP = 30, ATTRITION = 0.1;
// the Dormant: a tomb wakes when it is fought over, or by itself between these turns; awake, the fallen on a field
// it holds are repaired at this rate
const WAKE = [8, 18], REPAIR = 0.5, RAID_REST = 4;

// ---- armies: { unitId: count }; the militia's unit id is "militia"
const total = army => Object.values(army).reduce((a, n) => a + n, 0);
const addArmy = (to, from) => { for (const [k, n] of Object.entries(from)) if (n > 0) to[k] = (to[k] || 0) + n; return to; };
const asResolverArmy = army => {
  const byT = {};
  for (const [id, n] of Object.entries(army)) if (n > 0) byT[templateOf(id)] = (byT[templateOf(id)] || 0) + n;
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

// ---- the state
function create(seed, opt = {}) {
  const g = generate(seed, opt);
  const S = { seed, turn: 0, worlds: {}, order: g.worlds.map(w => w.id), factions: {}, players: {}, swarms: [], reports: [], log: [] };
  for (const w of g.worlds) S.worlds[w.id] = { ...w, garrison: {} };
  const R = rng(seed ^ 0x5bd1e995);
  for (const [f, st] of Object.entries(START)) S.factions[f] = { id: f, ...FACTIONS[f], stock: { ...st.stock }, capital: (Object.values(S.worlds).find(w => w.owner === f && w.capital) || { id: null }).id };   // the Dormant have none
  for (const w of Object.values(S.worlds)) w.garrison = w.owner ? { ...START[w.owner].garrison } : { militia: 10 + Math.floor(R() * 16) };
  for (const w of Object.values(S.worlds)) if (w.tomb) { w.awake = false; w.wakeAt = WAKE[0] + Math.floor(R() * (WAKE[1] - WAKE[0] + 1)); }
  FX.setup(S);
  LOG.setup(S);
  POL.setup(S);
  return S;
}
function join(S, { player, name, faction }) {
  if (S.players[player]) return note(S, `${name} is already in the war`);
  if (!FACTIONS[faction] || !FACTIONS[faction].player) throw new Error(`no player faction ${faction}`);
  S.players[player] = { id: player, name, faction, warband: { at: S.factions[faction].capital, army: { ...START[faction].warband }, supplied: true, orders: null, history: [] } };
  FX.joined(S, S.players[player]);
  VET.joined(S, S.players[player]);
  POL.joined(S, S.players[player]);
  note(S, `${name} raises a warband for ${FACTIONS[faction].name}`);
}
function note(S, text) { S.log.push({ turn: S.turn, text }); }

// orders for the next tick, checked against the state now; returns the problem, or null when accepted. A move is one
// jump along a lane, or from a gate to another gate the faction holds; a ritual (the Apostates) is factions.js's
// Standing orders kept from tick to tick: a stance (advance, fortify: stay and fight harder on your own world, raid:
// strike, loot and come back without taking the world), and `careful`: turn back from a move whose odds are poor.
// `build: "walls"` raises a world's walls a level.
function order(S, { player, move, recruit, ritual, stance, careful, build, convoy }) {
  const p = S.players[player];
  if (!p) return "no such player";
  const wb = p.warband, here = S.worlds[wb.at];
  if (move && !FX.canMove(S, p.faction, wb.at, move)) return `${S.worlds[move] ? S.worlds[move].name : move} is not one jump from ${here.name}`;
  if (stance != null && !STANCES.includes(stance)) return "no such stance";
  if (move && (stance ?? wb.stance) === "fortify") return "a fortified warband stays where it is: change its stance to move";
  if (build != null && build !== "walls" && build !== "depot") return "nothing like that to build";
  if (build === "walls" && here.owner !== p.faction) return "walls go up only on your own worlds";
  if (build === "walls" && (here.walls || 0) >= WALLS.max) return `${here.name}'s walls are as high as they go`;
  const cv = convoy && typeof convoy === "object" ? { to: String(convoy.to), supply: Math.floor(+convoy.supply) } : null;
  const lerr = LOG.checkOrder(S, p, { build, convoy: cv });
  if (lerr) return lerr;
  for (const r of recruit || []) {
    const u = UNITS[r.unit];
    if (!u || u.faction !== p.faction) return `${p.name}'s faction can't raise ${r.unit}`;
    if (!(r.count > 0 && r.count <= 50 && Number.isInteger(r.count))) return "recruit 1 to 50 at a time";
  }
  if ((recruit || []).length && here.owner !== p.faction) return "recruits only come from your own worlds";
  const rit = ritual && typeof ritual === "object" ? { kind: String(ritual.kind), target: ritual.target ? String(ritual.target) : null } : null;
  const err = FX.checkOrder(S, p, { move, recruit, ritual: rit });
  if (err) return err;
  p.lastActive = S.turn;
  wb.orders = { move: move || null, recruit: recruit || [], ritual: rit, stance: stance ?? null, careful: careful == null ? null : !!careful, build: build || null, convoy: cv };
  return null;
}
const STANCES = ["advance", "fortify", "raid"];
// fortify: x1.5 on your own world; walls: +25% a level, two levels, 20 then 40 materiel; turn back under 25%; a raid
// takes three turns' yield of the world it strikes
const FORTIFY = 1.5, WALLS = { max: 2, each: 0.25, cost: [20, 40] }, TURN_BACK = 25, RAID_LOOT = 3;
// how much a side's holding of the world counts for in a battle there: the world's own defence and its walls, and a
// warband of the holder's fortified on it
function holdBonus(S, w, faction) {
  if (w.owner !== faction) return 1;
  const fort = Object.values(S.players).some(p => p.faction === faction && p.warband.at === w.id && p.warband.stance === "fortify" && total(p.warband.army));
  return (TYPES[w.type].defence || 1) * (1 + WALLS.each * (w.walls || 0)) * (fort ? FORTIFY : 1);
}
// a warband's chance against the strongest foe at a world (the resolver, a fixed seed: advice for the view and for
// turning back, not the battle's own dice)
function oddsAt(S, p, id) {
  const w = S.worlds[id], mine = asResolverArmy(p.warband.army);
  const foe = factionsAt(S, w).filter(s => s.faction !== p.faction).sort((a, b) => strength(b.army) - strength(a.army))[0];
  if (!foe || !mine.length) return null;
  const q = predict(mine, asResolverArmy(foe.army), { seed: 1, sims: 100 }), dA = holdBonus(S, w, p.faction), dB = holdBonus(S, w, foe.faction);
  return Math.round(100 * q.pWinA * dA / (q.pWinA * dA + q.pWinB * dB || 1));
}

// ---- the tick
const factionsAt = (S, w) => {
  const by = {};
  const put = (f, army, who) => { if (!total(army)) return; (by[f] ||= { faction: f, army: {}, parts: [] }); addArmy(by[f].army, army); by[f].parts.push(who); };
  if (total(w.garrison)) put(w.owner || "militia", w.garrison, { kind: "garrison" });
  for (const p of Object.values(S.players)) if (p.warband.at === w.id) put(p.faction, p.warband.army, { kind: "warband", player: p.id });
  for (const sw of S.swarms) if (sw.at === w.id) put(sw.faction || "chorus", sw.army, { kind: "swarm", id: sw.id });
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

// what factions.js needs from here
const H = { weight: (...a) => POL.weight(...a), fromTreasury: (...a) => POL.fromTreasury(...a), total, cut, supplied: (...a) => supplied(...a), factionsAt: (...a) => factionsAt(...a), ATTRITION, GARRISON_CAP, TYPES, note: (...a) => note(...a) };

function tick(S, seed) {
  const R = rng(seed);
  S.turn++;
  const W = id => S.worlds[id], T = { fought: new Set(), dead: {}, captured: {}, delivered: [] };
  // 1. income (none from a blockaded world; supply from the worlds joined to the capital, logistics.js)
  for (const w of Object.values(S.worlds)) {
    if (!w.owner || LOG.noIncome(S, w, H)) continue;
    const t = TYPES[w.type], st = S.factions[w.owner].stock;
    if (w.owner === "dormant") continue;   // they don't recruit
    if (w.owner === "chorus") st.biomass = (st.biomass || 0) + t.manpower + t.materiel;
    else { st.manpower += t.manpower; st.materiel += t.materiel; }
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
    const st = S.factions[p.faction].stock, mine = share[p.faction] ? Object.fromEntries(Object.entries(share[p.faction]).map(([k, v]) => [k, v * POL.weight(S, p)])) : {}, here = W(p.warband.at);
    const tr = p.warband.treasury || {};
    for (const r of o.recruit) {
      const u = UNITS[r.unit];
      const why = FX.checkOrder(S, p, { recruit: [r] }) || (here.owner !== p.faction ? "not on your own world" : !p.warband.supplied ? "out of supply" : null);
      const can = why ? 0 : Math.min(r.count, ...Object.entries(u.cost).map(([k, c]) => Math.floor((Math.min(st[k] || 0, mine[k] || 0) + (tr[k] || 0)) / c + 1e-9)));
      if (can > 0) {
        for (const [k, c] of Object.entries(u.cost)) { const all = c * can, fromShare = Math.min(all, Math.max(0, Math.min(st[k] || 0, mine[k] || 0))); st[k] -= fromShare; mine[k] -= fromShare; POL.fromTreasury(p, k, all - fromShare); }
        p.warband.army[r.unit] = (p.warband.army[r.unit] || 0) + can;
      }
      // say what happened, and why it fell short
      const short = Object.entries(u.cost).filter(([k, c]) => (mine[k] || 0) < c).map(([k]) => k).join(" and ");
      if (can === r.count) p.warband.history.push(`Turn ${S.turn}: raised ${can} ${u.name} at ${here.name}`);
      else p.warband.history.push(`Turn ${S.turn}: raised ${can} of ${r.count} ${u.name} at ${here.name}: ${why || `your share of the stockpile ran short of ${short}`}`);
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
    FX.beginRitual(S, p, o);
    if (o.move && !wb.ritual && wb.stance !== "fortify" && FX.canMove(S, p.faction, wb.at, o.move)) {
      const odds = wb.careful ? oddsAt(S, p, o.move) : null;
      if (odds != null && odds < TURN_BACK) wb.history.push(`Turn ${S.turn}: turned back from ${W(o.move).name}: about ${odds}% to win there`);
      else { wb.history.push(`Turn ${S.turn}: ${wb.stance === "raid" ? "raided" : "moved"} from ${here.name} to ${W(o.move).name}`); if (wb.stance === "raid") wb.raidFrom = wb.at; wb.at = o.move; }
    }
    p.warband.orders = null;
  }
  // 3. the AI factions
  chorusTurn(S, R);
  dormantTurn(S, R);
  // 3b. convoys move a jump, and raiders take the ones they catch
  LOG.convoys(S, H, T);
  // 4. battles, wherever two factions meet (first, Levies marching on an Apostate world may turn, factions.js)
  for (const id of S.order) {
    const w = W(id);
    FX.beforeBattle(S, w, H, R);
    for (let guard = 0; guard < 4; guard++) {
      const sides = factionsAt(S, w).sort((a, b) => strength(b.army) - strength(a.army));
      if (sides.length < 2) break;
      fight(S, w, sides[0], sides[1], R, T);
    }
  }
  // 5. captures: a world held by one faction's forces alone becomes theirs (not the Dormant's: they raid, they don't
  // settle)
  for (const id of S.order) {
    const w = W(id), sides = factionsAt(S, w);
    const raiders = sides.length === 1 && sides[0].parts.every(x => x.kind === "warband" && S.players[x.player].warband.raidFrom);
    if (sides.length === 1 && !raiders && sides[0].faction !== "militia" && sides[0].faction !== "dormant" && sides[0].faction !== w.owner) {
      const was = w.owner;
      w.owner = sides[0].faction; w.garrison = {};
      T.captured[w.id] = sides[0].parts.filter(x => x.kind === "warband").map(x => x.player);   // for contracts
      const broken = was === "dormant" && w.tomb;
      FX.captured(S, w, was);
      if (broken) w.tomb = false;   // a taken tomb is ruins: it never holds sleepers again (its gate stays)
      if (w.walls) w.walls--;       // taken, a world's walls come down a level
      note(S, `${FACTIONS[w.owner].name} take ${w.name}${was ? " from " + FACTIONS[was].name : ""}${broken ? ": the tomb is broken open" : ""}`);
    }
  }
  // 5b. raiders: a raid that holds the field loots the world (three turns of its yield) and knocks a level off its
  // walls, then comes home; a beaten one has already fallen back
  for (const p of Object.values(S.players)) {
    const wb = p.warband;
    if (!wb.raidFrom) continue;
    const w = W(wb.at), from = wb.raidFrom;
    wb.raidFrom = null;
    if (w.owner === p.faction) continue;
    if (!factionsAt(S, w).some(s => s.faction !== p.faction)) {
      const t = TYPES[w.type], st = S.factions[p.faction].stock, man = t.manpower * RAID_LOOT, mat = t.materiel * RAID_LOOT;
      st.manpower += man; st.materiel += mat;
      if (w.walls) w.walls--;
      wb.history.push(`Turn ${S.turn}: looted ${w.name}: ${man} manpower, ${mat} materiel`);
      note(S, `${p.name} raids ${w.name}${w.owner ? " of " + FACTIONS[w.owner].name : ""}`);
    }
    if (FX.canMove(S, p.faction, wb.at, from)) { wb.at = from; wb.history.push(`Turn ${S.turn}: back from the raid to ${W(from).name}`); }
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
  // 7. garrisons: each player faction's supplied worlds raise a few local levies a turn
  for (const w of Object.values(S.worlds)) {
    const basic = w.owner && FACTIONS[w.owner].basic;
    if (!basic) continue;
    if (supplied(S, w.owner).has(w.id) && total(w.garrison) < GARRISON_CAP) w.garrison[basic] = (w.garrison[basic] || 0) + 2;
  }
  // 8. each faction's own rules: loyalty and edicts, rituals, fame, the dead rising
  FX.upkeep(S, H, R, T);
  LOG.blockades(S, H, R);
  // named soldiers lost with their units to hunger, desertion or infighting
  VET.reconcile(S, R);
  // politics: service, contracts paid or expired, recall, absence, elections
  POL.tick(S, T);
}

// one battle: the resolver gives the odds and the expected losses; the tick's dice say who won
function fight(S, w, A, B, R, T) {
  // named soldiers add to their side's worth, and a leader to its chances (veterans.js)
  const armyOf = x => asResolverArmy(addArmy({ ...x.army }, VET.extraOf(S, x.parts)));
  const seed = Math.floor(R() * 2 ** 31), p = predict(armyOf(A), armyOf(B), { seed, sims: 200 });
  const hA = holdBonus(S, w, A.faction), hB = holdBonus(S, w, B.faction), dA = hA * VET.sideLeader(S, A.parts) * LOG.sideFactor(S, A.parts), dB = hB * VET.sideLeader(S, B.parts) * LOG.sideFactor(S, B.parts);
  const pA = p.pWinA * dA / (p.pWinA * dA + p.pWinB * dB || 1), r = R();
  const draw = r < p.pDraw, aWins = !draw && R() < pA;
  const lossA = draw ? p.lossA : aWins ? Math.min(p.lossA, 0.9) : Math.max(p.lossA, 0.6), lossB = draw ? p.lossB : aWins ? Math.max(p.lossB, 0.6) : Math.min(p.lossB, 0.9);
  const before = [A, B].map(x => ({ faction: x.faction, army: { ...x.army }, named: x.parts.filter(y => y.kind === "warband").flatMap(y => VET.forReplay(S.players[y.player].warband)), short: LOG.sideShort(S, x.parts) }));
  const parts = [];   // each warband part's army before and after, for its named soldiers
  // a sleeping tomb that is fought over wakes
  if (w.tomb && !w.awake && (A.faction === "dormant" || B.faction === "dormant")) { w.awake = true; note(S, `The tomb on ${w.name} wakes to the sound of battle`); }
  const fell = [{ n: 0, power: 0 }, { n: 0, power: 0 }];
  const hurt = (side, loss, lost, i) => {
    for (const part of side.parts) {
      const box = part.kind === "garrison" ? w : part.kind === "warband" ? S.players[part.player].warband : S.swarms.find(s => s.id === part.id);
      const key = part.kind === "garrison" ? "garrison" : "army";
      const was = box[key];
      box[key] = cut(box[key], loss, R);
      if (part.kind === "warband") parts.push({ part, i, was, lost });
      // the Dormant repair their fallen on a field they hold
      if (side.faction === "dormant" && !lost) for (const [k, n] of Object.entries(was)) { const x = (n - box[key][k]) * REPAIR; box[key][k] += Math.floor(x) + (R() < x - Math.floor(x) ? 1 : 0); }
      fell[i].n += total(was) - total(box[key]); fell[i].power += strength(was) - strength(box[key]);
      if (!lost) continue;
      // the beaten side: garrisons are gone, warbands and swarms fall back to a friendly world next door or die
      if (part.kind === "garrison") { w.garrison = {}; continue; }
      const back = w.links.map(id => S.worlds[id]).find(n => n.owner === side.faction);
      if (back) box.at = back.id; else box[key] = {};
      if (part.kind === "warband") S.players[part.player].warband.history.push(`Turn ${S.turn}: beaten at ${w.name}${back ? ", fell back to " + back.name : ", destroyed"}`);
    }
  };
  hurt(A, lossA, !draw && !aWins, 0); hurt(B, lossB, !draw && aWins, 1);
  S.swarms = S.swarms.filter(s => total(s.army));
  const winner = draw ? null : aWins ? A.faction : B.faction;
  // the named: who falls, who is named, the leader
  for (const x of parts) POL.battle(S, S.players[x.part.player], [A, B][x.i].faction === winner);
  const fallenNamed = parts.flatMap(x => VET.afterBattle(S, w, x.part, x.was, S.players[x.part.player].warband.army, [A, B][x.i].faction === winner, x.lost, x.i ? lossB : lossA, R));
  // who the battle feeds: captives, biomass, fame (factions.js)
  FX.afterBattle(S, w, [A, B].map((x, i) => ({ faction: x.faction, parts: x.parts, won: winner === x.faction, p: i ? 1 - pA : pA, lostN: fell[i].n, lostPower: fell[i].power })), R, T);
  const fname = f => f === "militia" ? "the " + MILITIA.name.toLowerCase() : FACTIONS[f].name;
  const report = {
    id: `t${S.turn}-${w.id}-${S.reports.filter(r => r.turn === S.turn && r.world === w.id).length}`,
    turn: S.turn, world: w.id, worldName: w.name, worldType: w.type, seed, odds: Math.round(pA * 100), winner, secs: Math.round(p.seconds),
    sides: before.map((b, i) => ({ faction: b.faction, before: b.army, named: b.named, short: b.short || undefined, players: [A, B][i].parts.filter(x => x.kind === "warband").map(x => S.players[x.player].name) })),
    text: `${w.name}: ${fname(A.faction)} (${describe(A.army)}) against ${fname(B.faction)} (${describe(B.army)}). ` +
      (draw ? "Neither side gives way." : `${cap(fname(winner))} win${pA > 0.75 && aWins || pA < 0.25 && !aWins ? ", as expected" : pA > 0.25 && pA < 0.75 ? " a close fight" : " against the odds"}.`) +
      ` The odds were ${Math.round(pA * 100)}% for ${fname(A.faction)}${hA > 1 || hB > 1 ? `, ${fname(hA > 1 ? A.faction : B.faction)} holding the world${(w.walls || 0) ? " behind walls" : ""}` : ""}.` +
      ` ${cap(fname(A.faction))} lost about ${Math.round(lossA * 100)}%, ${fname(B.faction)} about ${Math.round(lossB * 100)}%.` +
      (fallenNamed.length ? ` Fallen among the named: ${fallenNamed.join(", ")}.` : ""),
  };
  for (const pl of report.sides.flatMap(s => s.players)) { const pp = Object.values(S.players).find(x => x.name === pl); if (pp) pp.warband.history.push(`Turn ${S.turn}: battle at ${w.name}, ${winner === pp.faction ? "won" : draw ? "held" : "lost"}`); }
  S.reports.push(report);
}

// ---- the Chorus: spends its biomass on new broods at its worlds, then sends swarms at whatever next door it can
// beat, weakest first, keeping a garrison home
function chorusTurn(S, R) {
  const st = S.factions.chorus.stock, mine = Object.values(S.worlds).filter(w => w.owner === "chorus");
  // swarms that hold a Chorus world join its garrison again
  for (const sw of S.swarms) if ((sw.faction || "chorus") === "chorus" && S.worlds[sw.at].owner === "chorus") { addArmy(S.worlds[sw.at].garrison, sw.army); sw.army = {}; }
  S.swarms = S.swarms.filter(s => total(s.army));
  // a siege-form now and then, once the biomass has piled up, at the biggest brood-world
  if (st.biomass >= 80 && mine.length && R() < 0.25) {
    const w = mine.slice().sort((a, b) => total(b.garrison) - total(a.garrison))[0];
    w.garrison.bulwark = (w.garrison.bulwark || 0) + 1; st.biomass -= UNITS.bulwark.cost.biomass;
  }
  for (const w of mine) {
    let want = Math.min(Math.floor(st.biomass / mine.length), 24);
    if (want <= 0) continue;
    st.biomass -= want;
    const add = (k, n = 1) => { w.garrison[k] = (w.garrison[k] || 0) + n; want -= UNITS[k].cost.biomass * n; };
    // each brood-world keeps a Conductor, so its broods stay under synapse; then now and then a hunter-form
    if (!w.garrison.conductor && want >= 15) add("conductor");
    else if (want >= 12 && R() < 0.2) add("hollow");
    else if (want >= 20 && R() < 0.3) add("stalker");
    if (want > 0) { const l = Math.ceil(want / 2); add("leaper", l); if (want > 0) add("spitter", want); }
  }
  for (const w of mine) {
    if (total(w.garrison) < 25) continue;
    const targets = w.links.map(id => S.worlds[id]).filter(n => n.owner !== "chorus")
      .map(n => ({ n, them: factionsAt(S, n).reduce((a, s) => addArmy(a, s.army), {}) })).sort((a, b) => strength(a.them) - strength(b.them));
    const t = targets[0];
    if (!t) continue;
    const send = cut(w.garrison, 0.4, R), go = Object.fromEntries(Object.entries(w.garrison).map(([k, n]) => [k, n - (send[k] || 0)]));
    if (total(t.them) && predict(asResolverArmy(go), asResolverArmy(t.them), { seed: Math.floor(R() * 2 ** 31), sims: 100 }).pWinA < 0.6) continue;
    w.garrison = send;
    S.swarms.push({ id: `s${S.turn}-${w.id}`, faction: "chorus", at: t.n.id, army: go });
    note(S, `The Chorus swarms from ${w.name} toward ${t.n.name}`);
  }
}

// ---- the Dormant: a tomb sleeps until it is fought over or its turn comes. Awake, it holds what it has and sends a
// war party at a neighbour only when sure of winning (it can't replace the fallen, only repair them), keeping half
// at home. A war party raids and comes home the next turn: the Dormant purge, they don't settle. One whose tomb
// has fallen stays where it is, a lost remnant
function dormantTurn(S, R) {
  for (const sw of S.swarms) {
    if (sw.faction !== "dormant") continue;
    const home = S.worlds[sw.home];
    if (home && home.owner === "dormant") { addArmy(home.garrison, sw.army); sw.army = {}; }
  }
  S.swarms = S.swarms.filter(s => total(s.army));
  for (const w of Object.values(S.worlds)) {
    if (w.owner !== "dormant") continue;
    if (w.tomb && !w.awake) { if (S.turn >= w.wakeAt) { w.awake = true; note(S, `Lights kindle deep inside ${w.name}: the tomb is waking`); } continue; }
    if (strength(w.garrison) < 60 || S.turn - (w.raidT ?? -99) < RAID_REST) continue;   // a tomb rests between raids
    // its own neighbours, and through the gates, the neighbours of every other gate the Dormant hold
    const reach = new Set(w.links);
    if (w.gate) for (const g of Object.values(S.worlds)) if (g.gate && g.owner === "dormant" && g !== w) g.links.forEach(n => reach.add(n));
    const t = [...reach].map(id => S.worlds[id]).filter(n => n.owner !== "dormant")
      .map(n => ({ n, them: factionsAt(S, n).reduce((a, s) => addArmy(a, s.army), {}) })).sort((a, b) => strength(a.them) - strength(b.them))[0];
    if (!t) continue;
    const stay = cut(w.garrison, 0.5, R), go = Object.fromEntries(Object.entries(w.garrison).map(([k, n]) => [k, n - (stay[k] || 0)]));
    if (!total(go) || (total(t.them) && predict(asResolverArmy(go), asResolverArmy(t.them), { seed: Math.floor(R() * 2 ** 31), sims: 100 }).pWinA < 0.75)) continue;
    w.garrison = stay;
    S.swarms.push({ id: `d${S.turn}-${w.id}`, faction: "dormant", at: t.n.id, home: w.id, army: go }); w.raidT = S.turn;
    note(S, `The Dormant march out of ${w.name} toward ${t.n.name}`);
  }
}

// ---- the event log
function apply(S, e) {
  if (e.type === "create") return create(e.seed, e.opt);
  if (e.type === "join") { join(S, e); return S; }
  if (e.type === "order") { const err = order(S, e); if (err) note(S, `order refused: ${err}`); return S; }
  if (e.type === "tick") { tick(S, e.seed); return S; }
  if (e.type === "notice") { note(S, String(e.text)); return S; }
  if (e.type === "politics") { POL.apply(S, e); return S; }   // votes, standing, the Warmaster's acts (checked when given)   // a word from the admin, in the news (a rollback, a pause)
  throw new Error(`unknown event ${e.type}`);
}
const rebuild = events => events.reduce((S, e) => apply(S, e), null);

// ---- what a player may see: the map and who holds each world are public; armies only where the faction has
// eyes (its own worlds, its warbands, and the worlds one jump from either)
function view(S, player) {
  const p = S.players[player];
  if (!p) return null;
  const f = p.faction, eyes = new Set();
  for (const w of Object.values(S.worlds)) if (w.owner === f) { eyes.add(w.id); w.links.forEach(n => eyes.add(n)); }
  for (const q of Object.values(S.players)) if (q.faction === f) { eyes.add(q.warband.at); S.worlds[q.warband.at].links.forEach(n => eyes.add(n)); }
  // the odds the warband would have where it can go, against the strongest foe it can see there (the resolver, with a
  // fixed seed: advice, not the battle's dice; a world's defence favours its holder as in a real fight)
  const odds = {};
  for (const id of FX.moves(S, f, p.warband.at)) { if (!eyes.has(id)) continue; const o = oddsAt(S, p, id); if (o != null) odds[id] = o; }
  return {
    turn: S.turn, you: { name: p.name, faction: f, warband: p.warband, stock: S.factions[f].stock, moves: FX.moves(S, f, p.warband.at), odds,
      edict: f === "hegemony" ? S.factions.hegemony.edict : null, rituals: f === "apostates" ? FX.RITUALS : null, walls: WALLS, turnBack: TURN_BACK, depot: LOG.DEPOT, convoyMax: LOG.CONVOY.max },
    politics: POL.view(S, p),
    factions: { ...Object.fromEntries(Object.entries(S.factions).map(([k, v]) => [k, { name: v.name, colour: v.colour }])), militia: { name: MILITIA.name, colour: "#8d887e" } },
    units: Object.fromEntries(Object.entries(UNITS).filter(([, u]) => u.faction === f).map(([k, u]) => [k, { name: u.name, cost: u.cost }])),
    worlds: S.order.map(id => {
      const w = S.worlds[id], seen = eyes.has(id);
      // loyalty is known to the Hegemony on its own worlds, and to the Apostates where they have eyes (they look for it)
      const loyal = w.owner === "hegemony" && (f === "hegemony" || (f === "apostates" && seen)) ? Math.round(w.loyalty) : undefined;
      return { id, name: w.name, x: w.x, y: w.y, type: w.type, typeName: TYPES[w.type].name, owner: w.owner, links: w.links, capital: !!w.capital, seen, walls: w.walls || 0, blockaded: !!w.blockaded,
        depot: w.depot ? (w.owner === f ? { supply: w.depot.supply } : seen ? {} : undefined) : undefined,
        convoys: S.convoys.filter(c => c.at === id && (c.faction === f || seen)).map(c => ({ faction: c.faction, to: S.worlds[c.to].name, supply: c.faction === f ? c.supply : undefined })), tomb: !!w.tomb, gate: !!w.gate, asleep: seen && w.tomb ? !w.awake : undefined, loyalty: loyal,
        held: w.owner === f ? S.turn - (w.heldSince ?? 0) : undefined,
        forces: seen ? factionsAt(S, w).map(s => ({ faction: s.faction, army: Object.fromEntries(Object.entries(s.army).map(([k, n]) => [nameOf(k), n])), players: s.parts.filter(x => x.kind === "warband").map(x => S.players[x.player].name) })) : null };
    }),
    reports: S.reports.filter(r => r.sides.some(s => s.faction === f) || eyes.has(r.world)).slice(-30).reverse(),
    news: S.log.slice(-30).reverse(),
  };
}
// a politics action checked against the state now (the server logs only what passes)
const politics = (S, e) => POL.check(S, e);
module.exports = { politics, apply, rebuild, view, order, total, strength, supplied, holdBonus, oddsAt, START };
