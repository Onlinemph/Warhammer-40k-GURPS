// Sample wars: scripted warbands play whole wars from the log, to measure the balance of the factions' rules.
//   node game/sample-wars.js [wars=8] [turns=60] [firstSeed=1]
// Two warbands a player faction. Each recruits its faction's mix at its capital until it is 25 strong, then wanders
// toward foreign worlds (the weakest next door first, gates included), and comes home to rebuild when cut below 12. The
// Apostates hold a Corruption when a Hegemony world next door is ripe, or a Summoning, whenever they have the
// captives. Prints the mean worlds held per faction at turns 20, 40 and 60, and in how many wars each was wiped out.
const { apply, order, total, strength, oddsAt, politics, factionsAt } = require("./world/rules.js");
const { rng } = require("./world/galaxy.js");
const FX = require("./world/factions.js");
const LOG = require("./world/logistics.js");
const RG = require("./world/regions.js");
const FR = require("./world/fronts.js");

const { SCALE, UNITS, FACTIONS: FACTIONS_ } = require("./world/units.js");
// a recruiting round's mix, line troops first so the special and heavy weapons have their ten each to go among
const MIX = {
  hegemony:  [{ unit: "levy", count: 100 }, { unit: "storm", count: 20 }, { unit: "warden", count: 6 }, { unit: "levy_gunner", count: 4 }, { unit: "heavy_team", count: 3 }, { unit: "levy_melta", count: 2 }, { unit: "seer", count: 1 }],
  apostates: [{ unit: "turncoat", count: 60 }, { unit: "faithless", count: 60 }, { unit: "vessel", count: 6 }, { unit: "turncoat_gunner", count: 5 }, { unit: "turncoat_heavy", count: 4 }, { unit: "frenzied", count: 4 }, { unit: "hierophant", count: 1 }],
  brawl:     [{ unit: "brawler", count: 100 }, { unit: "boss", count: 20 }, { unit: "rokkit", count: 4 }, { unit: "big_shoota", count: 4 }, { unit: "burna", count: 2 }, { unit: "mek", count: 2 }],
};
const FULL = 25 * SCALE, WEAK = 12 * SCALE;
const FACTIONS = ["hegemony", "apostates", "brawl", "chorus", "dormant"];

// the first step toward the nearest world that passes `want`, by the moves the faction has (lanes and gates)
function stepToward(S, f, from, want) {
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const at = q.shift();
    if (at !== from && want(S.worlds[at])) { let s = at; while (prev[s] !== from) s = prev[s]; return s; }
    for (const n of FX.moves(S, f, at)) if (!(n in prev)) { prev[n] = at; q.push(n); }
  }
  return null;
}
// a scripted warband's orders for the next tick ({move, land, region, recruit, ritual, ...}), or null when it has none
// to give. The server's bots (BOTS=n) use it too, through order events in the log like anyone's. On a world it doesn't
// wholly hold it marches on the cities it doesn't hold, the capital first; on its own it picks the next world, and
// lands at its capital when it may
function decide(S, p, R) {
  const wb = p.warband, f = p.faction, here = S.worlds[wb.at], hr = RG.region(here, wb.region), n = total(wb.army);
  if (wb.ritual) return null;
  // home is a city it holds on its capital world, or while the capital is lost, any city it holds
  const capital = S.worlds[S.factions[f].capital]?.owner === f ? S.factions[f].capital : null, home = hr.city && hr.owner === f && (!capital || wb.at === capital);
  let recruit = home && n < FULL ? MIX[f].filter(r => r.unit !== "warden" || here.capital || S.turn - here.heldSince >= FX.WARDEN_HELD) : [];
  // (special and heavy weapons only as far as the line troops allow: one for every ten)
  const special = u => UNITS[u].role === "special" || UNITS[u].role === "heavy";
  const line = FACTIONS_[f].line.reduce((a, k) => a + (wb.army[k] || 0) + (recruit.find(r => r.unit === k) || { count: 0 }).count, 0);
  let room = Math.floor(line / 10) - Object.entries(wb.army).reduce((a, [k, c]) => a + (special(k) ? c : 0), 0);
  recruit = recruit.map(r => { if (!special(r.unit)) return r; const c = Math.max(0, Math.min(r.count, room)); room -= c; return { ...r, count: c }; }).filter(r => r.count > 0);
  if (f === "apostates" && here.owner === f) {
    const cap = S.factions.apostates.stock.captives || 0;
    const ripe = here.links.map(id => S.worlds[id]).find(w => w.owner === "hegemony" && !w.capital && w.loyalty < FX.LOYALTY.corruptible && RG.capitalOf(w).owner === "hegemony");
    const ritual = ripe && cap >= FX.RITUALS.corrupt.captives ? { kind: "corrupt", target: ripe.id } : cap >= FX.RITUALS.summon.captives ? { kind: "summon" } : null;
    if (ritual && !order(JSON.parse(JSON.stringify(S)), { player: p.id, recruit, ritual })) return { move: null, recruit, ritual };
  }
  // the way home: to the capital world (landing in its seat), then a march to the nearest city it holds
  const goHome = () => {
    if (wb.at === capital || (!capital && here.owner === f)) { const s = RG.stepToward(here, wb.region, r => r.city && r.owner === f); return s ? { region: s } : {}; }
    const s = stepToward(S, f, wb.at, w => w.id === capital) || stepToward(S, f, wb.at, w => w.owner === f);
    if (!s) return {};
    const to = S.worlds[s], seat = RG.seatOf(to, f);
    return { move: s, land: seat && RG.canLand(to, f, seat.id) ? seat.id : undefined };
  };
  const landAt = w => { const c = RG.capitalOf(w); return RG.canLand(w, f, c.id) ? c.id : RG.defaultLanding(w, f); };
  const unheld = w => RG.cities(w).some(r => r.owner !== f);
  // a city worth the fight: its odds (through the fog), the capital counting 15 more
  // (by what the fight is worth, not only how sure: a capital counts double, a city that would give it the world half
  // as much again; so a capital at 50% beats a farm town at 95%)
  const givesWorld = (w, r) => { const cs = RG.cities(w), mineAfter = cs.filter(x => x.owner === f || x === r).length; const capHeld = RG.capitalOf(w).owner === f || r.capital; return capHeld && mineAfter * 2 > cs.length && w.owner !== f; };
  const score = (w, r) => { const o = oddsAt(S, p, w.id, r.id, true) ?? 100; return { w, r, o, s: o * ((r.capital ? 2 : 1) + (givesWorld(w, r) ? 0.5 : 0)) }; };
  let go = {}, odds = null;
  // (a warband in the middle of a campaign on a world presses on until it's weak; elsewhere it fills up at home first)
  const campaign = unheld(here) && here.regions.some(r => r.owner === f);
  // defending (the fronts): a city of its own under threat, here or on a world of its own next door, by a force it could
  // stand against (at least two fifths of its strength): it goes there and holds it, fortified
  const HF = { factionsIn: factionsAt, strength };
  if (SMART && n >= WEAK) {
    const mineNear = [here, ...FX.moves(S, f, wb.at).map(id => S.worlds[id])].filter(w => w.regions.some(r => r.owner === f && r.city));
    const cand = mineNear.flatMap(w => RG.cities(w).filter(r => r.owner === f).map(r => ({ w, r, t: FR.threatTo(S, w, r, f, HF), own: factionsAt(S, w, r).filter(s => s.faction === f).reduce((a, s) => a + strength(s.army), 0) })))
      .filter(x => x.t > x.own && strength(wb.army) >= 0.4 * (x.t - x.own) && !(x.w.id === wb.at && x.r.id === wb.region)).sort((a, b) => (b.t - b.own) - (a.t - a.own));
    const d = cand[0];
    if (d && !(here.id === wb.at && hr.id === d.r.id)) {
      if (d.w === here) { const s2 = RG.stepToward(here, wb.region, x => x.id === d.r.id); if (s2) go = { region: s2, defend: true }; }
      else if (RG.canLand(d.w, f, d.r.id)) go = { move: d.w.id, land: d.r.id, defend: true };
    }
  }
  if (go.defend) { /* (on its way to defend) */ }
  else if (n < WEAK || (n < FULL && !home && !campaign)) { if (!home) go = goHome(); }
  else if (n >= FULL || campaign) {
    if (unheld(here)) {
      // a campaign on this world: the best of the cities it doesn't hold, a region a turn toward it
      const best = SMART ? RG.cities(here).filter(r => r.owner !== f).map(r => score(here, r)).sort((a, b) => b.s - a.s)[0] : { r: RG.cities(here).find(r => r.capital && r.owner !== f) || RG.cities(here).find(r => r.owner !== f), o: 100 };
      if (best && best.o >= 25) { const s = RG.stepToward(here, wb.region, r => r.id === best.r.id); if (s) go = { region: s }; }
      else if (n < FULL) go = home ? {} : goHome();
    }
    if (!go.region && !go.move) {
      const next = FX.moves(S, f, wb.at).map(id => S.worlds[id]).filter(w => w.owner !== f || unheld(w));
      if (next.length) {
        const them = w => strength(Object.values(S.players).filter(q => q.faction !== f && q.warband.at === w.id).reduce((a, q) => ({ ...a, ...q.warband.army }), RG.garrisonOf(w)));
        next.sort((a, b) => them(a) - them(b) || R() - 0.5);
        go = { move: next[0].id, land: landAt(next[0]) };
        // with the standing orders it reads the odds: the best city on offer to land on, and none at all if every one
        // is hopeless (then home to grow, rather than marching at the same wall every turn)
        if (SMART) {
          // (a world with a contract on it is worth a bit more to march on)
          const P = S.politics && S.politics[f], wanted = new Set(P ? P.contracts.filter(k => (k.kind === "take" || k.kind === "break") && (!k.offer || (k.accepted && k.offer === p.id))).map(k => k.world) : []);
          const scored = next.flatMap(w => RG.cities(w).filter(r => r.owner !== f && RG.canLand(w, f, r.id)).map(r => score(w, r)))
            .map(x => ({ ...x, s: x.s + (wanted.has(x.w.id) && x.o >= 25 ? 30 : 0) })).sort((a, b) => b.s - a.s);
          if (scored.length && scored[0].o >= 25) { go = { move: scored[0].w.id, land: scored[0].r.id }; odds = scored[0].o; }
          else go = home ? {} : goHome();
        }
      } else { const s = stepToward(S, f, wb.at, w => w.owner !== f); if (s) go = { move: s, land: landAt(S.worlds[s]) }; }
    }
  }
  const move = go.move || null;
  if (!SMART) return { move, land: go.land, region: go.region || null, recruit, ritual: null };
  // the standing orders: fortify while it stays where it holds, raid a world it can't be sure of taking (under 60%),
  // always turn back from a fight under 25%, and wall up a border world when the stockpile has materiel to spare
  if (move && odds == null && S.worlds[move].owner !== f) odds = oddsAt(S, p, move, go.land, true);
  const stance = !move && !go.region ? (hr.owner === f ? "fortify" : wb.stance === "fortify" ? "advance" : wb.stance || "advance") : move && odds != null && odds < 60 ? "raid" : "advance";
  const border = here.links.some(id => S.worlds[id].owner !== f), lvl = here.walls || 0;
  const mat = S.factions[f].stock.materiel || 0, sup = S.factions[f].stock.supply || 0;
  // a depot on a border world first (when there's materiel to spare), then walls
  const build = here.owner === f && border && !here.depot && mat >= 90 * SCALE ? "depot" : here.owner === f && border && lvl < 2 && mat >= 3 * [20, 40][lvl] * SCALE ? "walls" : null;
  // from the capital, a convoy to the emptiest depot when the stockpile has supply to spare
  let convoy = null;
  if (here.owner === f && here.capital && sup >= 40) {
    const d = Object.values(S.worlds).filter(w => w.owner === f && w.depot && w.id !== here.id && w.depot.supply < 30).sort((a, b) => a.depot.supply - b.depot.supply)[0];
    if (d && LOG.route(S, f, here.id, d.id)) convoy = { to: d.id, supply: 20 };
  }
  return { move, land: go.land, region: go.region || null, recruit, ritual: null, stance, careful: true, build, convoy };
}
// BOT_ORDERS=0: the bots as they were, moving and recruiting only (to measure what the standing orders change)
const SMART = process.env.BOT_ORDERS !== "0";
function play(S, p, R) { const o = decide(S, p, R); if (o) order(S, { player: p.id, ...o }); }
// a bot's politics for this turn, as politics events: stand when it's the most served of its faction, vote for the
// most served candidate, accept what's offered to it, and as Warmaster post a "take" bounty on the weakest enemy world
// beside the faction's territory when the stockpile can spare it
function politicsFor(S, p) {
  if (!SMART || !S.politics || !S.politics[p.faction]) return [];
  const f = p.faction, P = S.politics[f], out = [], mates = Object.values(S.players).filter(q => q.faction === f);
  const top = mates.slice().sort((a, b) => b.warband.service - a.warband.service)[0];
  if (top === p && !P.candidates.includes(p.id) && P.warmaster !== p.id) out.push({ action: "stand" });
  const best = P.candidates.map(id => S.players[id]).filter(Boolean).sort((a, b) => b.warband.service - a.warband.service)[0];
  if (best && P.votes[p.id] !== best.id) out.push({ action: "vote", for: best.id });
  for (const k of P.contracts) if (k.offer === p.id && !k.accepted) out.push({ action: "accept", id: k.id });
  if (P.warmaster === p.id && P.contracts.length < 2 && (S.factions[f].stock.materiel || 0) >= 60 * SCALE) {
    const mine = Object.values(S.worlds).filter(w => w.owner === f);
    const near = [...new Set(mine.flatMap(w => w.links))].map(id => S.worlds[id]).filter(w => w.owner !== f && w.owner !== "dormant" && !P.contracts.some(k => k.world === w.id));
    const them = w => strength(Object.values(S.players).filter(q => q.faction !== f && q.warband.at === w.id).reduce((a, q) => ({ ...a, ...q.warband.army }), RG.garrisonOf(w)));
    const t = near.sort((a, b) => them(a) - them(b))[0];
    if (t) out.push({ action: "post", contract: { kind: "take", world: t.id, deadline: 10, reward: { manpower: 10 * SCALE, materiel: 20 * SCALE } } });
  }
  return out.map(a => ({ type: "politics", player: p.id, ...a }));
}
function war(seed, turns) {
  const R = rng(seed * 7919), log = [{ type: "create", seed }];
  for (const f of ["hegemony", "apostates", "brawl"]) for (const i of [1, 2]) log.push({ type: "join", player: `${f}${i}`, name: `${f} ${i}`, faction: f });
  let S = log.reduce((s, e) => apply(s, e), null);
  const held = {};
  for (let t = 1; t <= turns; t++) {
    for (const p of Object.values(S.players)) { for (const e of politicsFor(S, p)) if (!politics(S, e)) S = apply(S, e); play(S, p, R); }
    S = apply(S, { type: "tick", seed: Math.floor(R() * 2 ** 31) });
    if (t % 20 === 0) held[t] = Object.fromEntries(FACTIONS.map(f => [f, Object.values(S.worlds).filter(w => w.owner === f).length]));
  }
  const count = re => S.log.filter(l => re.test(l.text)).length;
  return { S, seed, held, defected: count(/goes over to the Apostates, its loyalty/), corrupted: count(/corrupted by/), summoned: count(/answers .*Summoning/), deserted: Object.values(S.players).reduce((a, p) => a + p.warband.history.filter(h => /deserted/.test(h)).length, 0) };
}
if (require.main === module) {
  const [wars = 8, turns = 60, first = 1] = process.argv.slice(2).map(Number);
  const res = [];
  for (let s = first; s < first + wars; s++) {
    const r = war(s, turns); res.push(r);
    console.log(`seed ${s}: ` + Object.entries(r.held).map(([t, h]) => `t${t} ` + FACTIONS.map(f => f.slice(0, 3) + " " + h[f]).join(" ")).join(" | ") + `  (defected ${r.defected}, corrupted ${r.corrupted}, summoned ${r.summoned})`);
  }
  const ts = Object.keys(res[0].held);
  console.log("\nmean worlds held" + " ".repeat(4) + FACTIONS.map(f => f.padStart(10)).join(""));
  for (const t of ts) console.log(`  turn ${t}`.padEnd(20) + FACTIONS.map(f => (res.reduce((a, r) => a + r.held[t][f], 0) / res.length).toFixed(1).padStart(10)).join(""));
  const last = ts[ts.length - 1];
  console.log("  wiped out".padEnd(20) + FACTIONS.map(f => `${res.filter(r => r.held[last][f] === 0).length}/${res.length}`.padStart(10)).join(""));
  console.log("  most worlds".padEnd(20) + FACTIONS.map(f => String(Math.max(...res.map(r => r.held[last][f]))).padStart(10)).join(""));
}
module.exports = { war, decide, politicsFor };
