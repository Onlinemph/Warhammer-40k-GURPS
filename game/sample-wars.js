// Sample wars: scripted warbands play whole wars from the log, to measure the balance of the factions' rules.
//   node game/sample-wars.js [wars=8] [turns=60] [firstSeed=1]
// Two warbands a player faction. Each recruits its faction's mix at its capital until it is 25 strong, then wanders
// toward foreign worlds (the weakest next door first, gates included), and comes home to rebuild when cut below 12. The
// Apostates hold a Corruption when a Hegemony world next door is ripe, or a Summoning, whenever they have the
// captives. Prints the mean worlds held per faction at turns 20, 40 and 60, and in how many wars each was wiped out.
const { apply, order, total, strength, oddsAt, politics } = require("./world/rules.js");
const { rng } = require("./world/galaxy.js");
const FX = require("./world/factions.js");
const LOG = require("./world/logistics.js");

const MIX = {
  hegemony:  [{ unit: "levy", count: 10 }, { unit: "storm", count: 2 }, { unit: "warden", count: 1 }],
  apostates: [{ unit: "turncoat", count: 6 }, { unit: "faithless", count: 6 }, { unit: "vessel", count: 1 }],
  brawl:     [{ unit: "brawler", count: 10 }, { unit: "boss", count: 2 }],
};
const FULL = 25, WEAK = 12;
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
// a scripted warband's orders for the next tick ({move, recruit, ritual}), or null when it has none to give. The
// server's bots (BOTS=n) use it too, through order events in the log like anyone's
function decide(S, p, R) {
  const wb = p.warband, f = p.faction, here = S.worlds[wb.at], n = total(wb.army);
  if (wb.ritual) return null;
  // home is the capital, or while it is lost, any world the faction still holds
  const capital = S.worlds[S.factions[f].capital]?.owner === f ? S.factions[f].capital : null, home = here.owner === f && (!capital || wb.at === capital);
  const recruit = home && n < FULL ? MIX[f].filter(r => r.unit !== "warden" || here.capital || S.turn - here.heldSince >= FX.WARDEN_HELD) : [];
  if (f === "apostates" && here.owner === f) {
    const cap = S.factions.apostates.stock.captives || 0;
    const ripe = here.links.map(id => S.worlds[id]).find(w => w.owner === "hegemony" && !w.capital && w.loyalty < FX.LOYALTY.corruptible);
    const ritual = ripe && cap >= FX.RITUALS.corrupt.captives ? { kind: "corrupt", target: ripe.id } : cap >= FX.RITUALS.summon.captives ? { kind: "summon" } : null;
    if (ritual && !order(JSON.parse(JSON.stringify(S)), { player: p.id, recruit, ritual })) return { move: null, recruit, ritual };
  }
  let move = null;
  if (n < WEAK || (n < FULL && !home)) { if (!home) move = stepToward(S, f, wb.at, w => w.id === capital) || stepToward(S, f, wb.at, w => w.owner === f); }
  else if (n >= FULL) {
    const next = FX.moves(S, f, wb.at).map(id => S.worlds[id]).filter(w => w.owner !== f);
    if (next.length) {
      const them = w => strength(Object.values(S.players).filter(q => q.faction !== f && q.warband.at === w.id).reduce((a, q) => ({ ...a, ...q.warband.army }), { ...w.garrison }));
      next.sort((a, b) => them(a) - them(b) || R() - 0.5);
      move = next[0].id;
      // with the standing orders it reads the odds: the best fight on offer, and none at all if every one is hopeless
      // (then home to grow, rather than marching at the same wall every turn)
      if (SMART) {
        // (a world with a contract on it is worth a bit more to march on)
        const P = S.politics && S.politics[f], wanted = new Set(P ? P.contracts.filter(k => (k.kind === "take" || k.kind === "break") && (!k.offer || (k.accepted && k.offer === p.id))).map(k => k.world) : []);
        const scored = next.map(w => ({ w, o: oddsAt(S, p, w.id) ?? 100 })).sort((a, b) => (b.o + (wanted.has(b.w.id) && b.o >= 25 ? 30 : 0)) - (a.o + (wanted.has(a.w.id) && a.o >= 25 ? 30 : 0)));
        move = scored[0].o >= 25 ? scored[0].w.id : home ? null : stepToward(S, f, wb.at, w => w.id === capital) || stepToward(S, f, wb.at, w => w.owner === f);
      }
    } else move = stepToward(S, f, wb.at, w => w.owner !== f);
  }
  if (!SMART) return { move, recruit, ritual: null };
  // the standing orders: fortify while it stays on its own world, raid a world it can't be sure of taking (under 60%),
  // always turn back from a fight under 25%, and wall up a border world when the stockpile has materiel to spare
  const target = move && S.worlds[move], odds = target && target.owner !== f ? oddsAt(S, p, move) : null;
  const stance = !move ? (here.owner === f ? "fortify" : wb.stance || "advance") : odds != null && odds < 60 ? "raid" : "advance";
  const border = here.links.some(id => S.worlds[id].owner !== f), lvl = here.walls || 0;
  const mat = S.factions[f].stock.materiel || 0, sup = S.factions[f].stock.supply || 0;
  // a depot on a border world first (when there's materiel to spare), then walls
  const build = here.owner === f && border && !here.depot && mat >= 90 ? "depot" : here.owner === f && border && lvl < 2 && mat >= 3 * [20, 40][lvl] ? "walls" : null;
  // from the capital, a convoy to the emptiest depot when the stockpile has supply to spare
  let convoy = null;
  if (here.owner === f && here.capital && sup >= 40) {
    const d = Object.values(S.worlds).filter(w => w.owner === f && w.depot && w.id !== here.id && w.depot.supply < 30).sort((a, b) => a.depot.supply - b.depot.supply)[0];
    if (d && LOG.route(S, f, here.id, d.id)) convoy = { to: d.id, supply: 20 };
  }
  return { move, recruit, ritual: null, stance, careful: true, build, convoy };
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
  if (P.warmaster === p.id && P.contracts.length < 2 && (S.factions[f].stock.materiel || 0) >= 60) {
    const mine = Object.values(S.worlds).filter(w => w.owner === f);
    const near = [...new Set(mine.flatMap(w => w.links))].map(id => S.worlds[id]).filter(w => w.owner !== f && w.owner !== "dormant" && !P.contracts.some(k => k.world === w.id));
    const them = w => strength(Object.values(S.players).filter(q => q.faction !== f && q.warband.at === w.id).reduce((a, q) => ({ ...a, ...q.warband.army }), { ...w.garrison }));
    const t = near.sort((a, b) => them(a) - them(b))[0];
    if (t) out.push({ action: "post", contract: { kind: "take", world: t.id, deadline: 10, reward: { manpower: 10, materiel: 20 } } });
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
