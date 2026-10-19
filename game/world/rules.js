// The war's rules. A game is nothing but its event log: the inputs (the war's creation, players joining, orders,
// ticks with their random seeds) applied in order by apply(). Everything else (worlds, armies, battles, reports)
// is worked out from those, so the same log always rebuilds the same war (rollbacks after an exploit, audits and
// the soldiers' histories all come from that), and the server only has to store the log.
const { generate, TYPES, rng } = require("./galaxy.js");
const { UNITS, FACTIONS } = require("./units.js");
const { predict } = require("../../tools/resolver/resolver.js");

const MILITIA = { name: "Militia", template: "Chaos Cultist" };
const START = {
  hegemony: { stock: { manpower: 40, materiel: 60 }, warband: { levy: 15, storm: 3 }, garrison: { levy: 20 } },
  brawl:    { stock: { manpower: 40, materiel: 40 }, warband: { brawler: 20, boss: 3 }, garrison: { brawler: 20 } },
  chorus:   { stock: { biomass: 40 }, garrison: { leaper: 20, spitter: 10 } },
};
const GARRISON_CAP = 30, ATTRITION = 0.1;

// ---- armies: { unitId: count }; the militia's unit id is "militia"
const templateOf = id => id === "militia" ? MILITIA.template : UNITS[id].template;
const nameOf = id => id === "militia" ? MILITIA.name : UNITS[id].name;
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
  for (const [f, st] of Object.entries(START)) S.factions[f] = { id: f, ...FACTIONS[f], stock: { ...st.stock }, capital: Object.values(S.worlds).find(w => w.owner === f && w.capital).id };
  for (const w of Object.values(S.worlds)) w.garrison = w.owner ? { ...START[w.owner].garrison } : { militia: 10 + Math.floor(R() * 16) };
  return S;
}
function join(S, { player, name, faction }) {
  if (S.players[player]) return note(S, `${name} is already in the war`);
  if (!FACTIONS[faction] || !FACTIONS[faction].player) throw new Error(`no player faction ${faction}`);
  S.players[player] = { id: player, name, faction, warband: { at: S.factions[faction].capital, army: { ...START[faction].warband }, supplied: true, orders: null, history: [] } };
  note(S, `${name} raises a warband for ${FACTIONS[faction].name}`);
}
function note(S, text) { S.log.push({ turn: S.turn, text }); }

// orders for the next tick, checked against the state now; returns the problem, or null when accepted
function order(S, { player, move, recruit }) {
  const p = S.players[player];
  if (!p) return "no such player";
  const wb = p.warband, here = S.worlds[wb.at];
  if (move && !here.links.includes(move)) return `${S.worlds[move] ? S.worlds[move].name : move} is not one jump from ${here.name}`;
  for (const r of recruit || []) {
    const u = UNITS[r.unit];
    if (!u || u.faction !== p.faction) return `${p.name}'s faction can't raise ${r.unit}`;
    if (!(r.count > 0 && r.count <= 50 && Number.isInteger(r.count))) return "recruit 1 to 50 at a time";
  }
  if ((recruit || []).length && here.owner !== p.faction) return "recruits only come from your own worlds";
  wb.orders = { move: move || null, recruit: recruit || [] };
  return null;
}

// ---- the tick
const factionsAt = (S, w) => {
  const by = {};
  const put = (f, army, who) => { if (!total(army)) return; (by[f] ||= { faction: f, army: {}, parts: [] }); addArmy(by[f].army, army); by[f].parts.push(who); };
  if (total(w.garrison)) put(w.owner || "militia", w.garrison, { kind: "garrison" });
  for (const p of Object.values(S.players)) if (p.warband.at === w.id) put(p.faction, p.warband.army, { kind: "warband", player: p.id });
  for (const sw of S.swarms) if (sw.at === w.id) put("chorus", sw.army, { kind: "swarm", id: sw.id });
  return Object.values(by);
};
const strength = army => total(army) && asResolverArmy(army).reduce((a, e) => a + e.count * ({ "Astartes Battle-Brother": 8, "Militarum Tempestus Scion": 3, "Ork Nob": 3, "Genestealer": 6, "Tyranid Warrior": 8 }[e.template] || 1), 0);
// worlds a faction can supply: its own, joined to its capital through its own
function supplied(S, f) {
  const cap = S.worlds[S.factions[f].capital], seen = new Set();
  if (!cap || cap.owner !== f) { for (const w of Object.values(S.worlds)) if (w.owner === f) seen.add(w.id); return seen; }   // no capital: each world alone
  const q = [cap.id]; seen.add(cap.id);
  while (q.length) for (const n of S.worlds[q.shift()].links) if (!seen.has(n) && S.worlds[n].owner === f) { seen.add(n); q.push(n); }
  return seen;
}

function tick(S, seed) {
  const R = rng(seed);
  S.turn++;
  const W = id => S.worlds[id];
  // 1. income
  for (const w of Object.values(S.worlds)) {
    if (!w.owner) continue;
    const t = TYPES[w.type], st = S.factions[w.owner].stock;
    if (w.owner === "chorus") st.biomass = (st.biomass || 0) + t.manpower + t.materiel;
    else { st.manpower += t.manpower; st.materiel += t.materiel; }
  }
  // 2. players' orders: recruit where they stand, then move
  for (const p of Object.values(S.players)) {
    const o = p.warband.orders; if (!o) continue;
    const st = S.factions[p.faction].stock;
    for (const r of o.recruit) {
      const u = UNITS[r.unit], can = Math.min(r.count, ...Object.entries(u.cost).map(([k, c]) => Math.floor((st[k] || 0) / c)));
      if (can > 0 && W(p.warband.at).owner === p.faction && p.warband.supplied) {
        for (const [k, c] of Object.entries(u.cost)) st[k] -= c * can;
        p.warband.army[r.unit] = (p.warband.army[r.unit] || 0) + can;
        p.warband.history.push(`Turn ${S.turn}: raised ${can} ${u.name} at ${W(p.warband.at).name}`);
      }
    }
    if (o.move && W(p.warband.at).links.includes(o.move)) { p.warband.history.push(`Turn ${S.turn}: moved from ${W(p.warband.at).name} to ${W(o.move).name}`); p.warband.at = o.move; }
    p.warband.orders = null;
  }
  // 3. the Chorus
  chorusTurn(S, R);
  // 4. battles, wherever two factions meet
  for (const id of S.order) {
    const w = W(id);
    for (let guard = 0; guard < 4; guard++) {
      const sides = factionsAt(S, w).sort((a, b) => strength(b.army) - strength(a.army));
      if (sides.length < 2) break;
      fight(S, w, sides[0], sides[1], R);
    }
  }
  // 5. captures: a world held by one faction's forces alone becomes theirs
  for (const id of S.order) {
    const w = W(id), sides = factionsAt(S, w);
    if (sides.length === 1 && sides[0].faction !== "militia" && sides[0].faction !== w.owner) {
      const was = w.owner;
      w.owner = sides[0].faction; w.garrison = {};
      note(S, `${FACTIONS[w.owner].name} take ${w.name}${was ? " from " + FACTIONS[was].name : ""}`);
    }
  }
  // 6. supply: a warband on or beside its own supplied world is fed; otherwise it wastes away
  for (const f of Object.keys(FACTIONS)) {
    const ok = supplied(S, f);
    for (const p of Object.values(S.players).filter(p => p.faction === f)) {
      const at = W(p.warband.at);
      p.warband.supplied = ok.has(at.id) || at.links.some(n => ok.has(n));
      if (!p.warband.supplied && total(p.warband.army)) { p.warband.army = cut(p.warband.army, ATTRITION, R); p.warband.history.push(`Turn ${S.turn}: out of supply at ${at.name}, losing men`); }
    }
  }
  // 7. garrisons: each player faction's supplied worlds raise a few local levies a turn
  for (const w of Object.values(S.worlds)) {
    if (!w.owner || w.owner === "chorus") continue;
    const basic = w.owner === "hegemony" ? "levy" : "brawler";
    if (supplied(S, w.owner).has(w.id) && total(w.garrison) < GARRISON_CAP) w.garrison[basic] = (w.garrison[basic] || 0) + 2;
  }
}

// one battle: the resolver gives the odds and the expected losses; the tick's dice say who won
function fight(S, w, A, B, R) {
  const seed = Math.floor(R() * 2 ** 31), p = predict(asResolverArmy(A.army), asResolverArmy(B.army), { seed, sims: 200 });
  const defence = w.owner === B.faction ? TYPES[w.type].defence || 1 : w.owner === A.faction ? 1 / (TYPES[w.type].defence || 1) : 1;
  const pA = p.pWinA / (p.pWinA + p.pWinB * defence || 1), r = R();
  const draw = r < p.pDraw, aWins = !draw && R() < pA;
  const lossA = draw ? p.lossA : aWins ? Math.min(p.lossA, 0.9) : Math.max(p.lossA, 0.6), lossB = draw ? p.lossB : aWins ? Math.max(p.lossB, 0.6) : Math.min(p.lossB, 0.9);
  const before = [A, B].map(x => ({ faction: x.faction, army: { ...x.army } }));
  const hurt = (side, loss, lost) => {
    for (const part of side.parts) {
      const box = part.kind === "garrison" ? w : part.kind === "warband" ? S.players[part.player].warband : S.swarms.find(s => s.id === part.id);
      const key = part.kind === "garrison" ? "garrison" : "army";
      box[key] = cut(box[key], loss, R);
      if (!lost) continue;
      // the beaten side: garrisons are gone, warbands and swarms fall back to a friendly world next door or die
      if (part.kind === "garrison") { w.garrison = {}; continue; }
      const back = w.links.map(id => S.worlds[id]).find(n => n.owner === side.faction);
      if (back) box.at = back.id; else box[key] = {};
      if (part.kind === "warband") S.players[part.player].warband.history.push(`Turn ${S.turn}: beaten at ${w.name}${back ? ", fell back to " + back.name : ", destroyed"}`);
    }
  };
  hurt(A, lossA, !draw && !aWins); hurt(B, lossB, !draw && aWins);
  S.swarms = S.swarms.filter(s => total(s.army));
  const winner = draw ? null : aWins ? A.faction : B.faction;
  const fname = f => f === "militia" ? "the local militia" : FACTIONS[f].name;
  const report = {
    turn: S.turn, world: w.id, worldName: w.name, seed, odds: Math.round(pA * 100), winner,
    sides: before.map((b, i) => ({ faction: b.faction, before: b.army, players: [A, B][i].parts.filter(x => x.kind === "warband").map(x => S.players[x.player].name) })),
    text: `${w.name}: ${fname(A.faction)} (${describe(A.army)}) against ${fname(B.faction)} (${describe(B.army)}). ` +
      (draw ? "Neither side gives way." : `${cap(fname(winner))} win${pA > 0.75 && aWins || pA < 0.25 && !aWins ? ", as expected" : pA > 0.25 && pA < 0.75 ? " a close fight" : " against the odds"}.`) +
      ` Roughly ${Math.round(lossA * 100)}% and ${Math.round(lossB * 100)}% lost.`,
  };
  for (const pl of report.sides.flatMap(s => s.players)) { const pp = Object.values(S.players).find(x => x.name === pl); if (pp) pp.warband.history.push(`Turn ${S.turn}: battle at ${w.name}, ${winner === pp.faction ? "won" : draw ? "held" : "lost"}`); }
  S.reports.push(report);
}

// ---- the Chorus: spends its biomass on new broods at its worlds, then sends swarms at whatever next door it can
// beat, weakest first, keeping a garrison home
function chorusTurn(S, R) {
  const st = S.factions.chorus.stock, mine = Object.values(S.worlds).filter(w => w.owner === "chorus");
  // swarms that hold a Chorus world join its garrison again
  for (const sw of S.swarms) if (S.worlds[sw.at].owner === "chorus") { addArmy(S.worlds[sw.at].garrison, sw.army); sw.army = {}; }
  S.swarms = S.swarms.filter(s => total(s.army));
  for (const w of mine) {
    const want = Math.min(Math.floor(st.biomass / mine.length), 12);
    if (want <= 0) continue;
    const stalk = want >= 12 && R() < 0.3 ? 1 : 0, leapers = want - stalk * 6;
    w.garrison.leaper = (w.garrison.leaper || 0) + Math.ceil(leapers / 2); w.garrison.spitter = (w.garrison.spitter || 0) + Math.floor(leapers / 2);
    if (stalk) w.garrison.stalker = (w.garrison.stalker || 0) + 1;
    st.biomass -= want;
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
    S.swarms.push({ id: `s${S.turn}-${w.id}`, at: t.n.id, army: go });
    note(S, `The Chorus swarms from ${w.name} toward ${t.n.name}`);
  }
}

// ---- the event log
function apply(S, e) {
  if (e.type === "create") return create(e.seed, e.opt);
  if (e.type === "join") { join(S, e); return S; }
  if (e.type === "order") { const err = order(S, e); if (err) note(S, `order refused: ${err}`); return S; }
  if (e.type === "tick") { tick(S, e.seed); return S; }
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
  return {
    turn: S.turn, you: { name: p.name, faction: f, warband: p.warband, stock: S.factions[f].stock },
    factions: Object.fromEntries(Object.entries(S.factions).map(([k, v]) => [k, { name: v.name, colour: v.colour }])),
    units: Object.fromEntries(Object.entries(UNITS).filter(([, u]) => u.faction === f).map(([k, u]) => [k, { name: u.name, cost: u.cost }])),
    worlds: S.order.map(id => {
      const w = S.worlds[id], seen = eyes.has(id);
      return { id, name: w.name, x: w.x, y: w.y, type: w.type, typeName: TYPES[w.type].name, owner: w.owner, links: w.links, capital: !!w.capital, seen,
        forces: seen ? factionsAt(S, w).map(s => ({ faction: s.faction, army: Object.fromEntries(Object.entries(s.army).map(([k, n]) => [nameOf(k), n])), players: s.parts.filter(x => x.kind === "warband").map(x => S.players[x.player].name) })) : null };
    }),
    reports: S.reports.filter(r => r.sides.some(s => s.faction === f) || eyes.has(r.world)).slice(-30).reverse(),
    news: S.log.slice(-30).reverse(),
  };
}
module.exports = { apply, rebuild, view, order, total, strength, supplied, START };
