// Sample wars: scripted warbands play whole wars from the log, to measure the balance of the factions' rules.
//   node game/sample-wars.js [wars=8] [turns=60] [firstSeed=1]
// Two warbands a player faction. Each recruits its faction's mix at its capital until it is 25 strong, then wanders
// toward foreign worlds (the weakest next door first, gates included), and comes home to rebuild when cut below 12. The
// Apostates hold a Corruption when a Hegemony world next door is ripe, or a Summoning, whenever they have the
// captives. Prints the mean worlds held per faction at turns 20, 40 and 60, and in how many wars each was wiped out.
const { apply, order, total, strength } = require("./world/rules.js");
const { rng } = require("./world/galaxy.js");
const FX = require("./world/factions.js");

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
function play(S, p, R) {
  const wb = p.warband, f = p.faction, here = S.worlds[wb.at], n = total(wb.army);
  if (wb.ritual) return;
  // home is the capital, or while it is lost, any world the faction still holds
  const capital = S.worlds[S.factions[f].capital]?.owner === f ? S.factions[f].capital : null, home = here.owner === f && (!capital || wb.at === capital);
  const recruit = home && n < FULL ? MIX[f].filter(r => r.unit !== "warden" || here.capital || S.turn - here.heldSince >= FX.WARDEN_HELD) : [];
  if (f === "apostates" && here.owner === f) {
    const cap = S.factions.apostates.stock.captives || 0;
    const ripe = here.links.map(id => S.worlds[id]).find(w => w.owner === "hegemony" && !w.capital && w.loyalty < FX.LOYALTY.corruptible);
    const ritual = ripe && cap >= FX.RITUALS.corrupt.captives ? { kind: "corrupt", target: ripe.id } : cap >= FX.RITUALS.summon.captives ? { kind: "summon" } : null;
    if (ritual && !order(S, { player: p.id, recruit, ritual })) return;
  }
  let move = null;
  if (n < WEAK || (n < FULL && !home)) { if (!home) move = stepToward(S, f, wb.at, w => w.id === capital) || stepToward(S, f, wb.at, w => w.owner === f); }
  else if (n >= FULL) {
    const next = FX.moves(S, f, wb.at).map(id => S.worlds[id]).filter(w => w.owner !== f);
    if (next.length) {
      const them = w => strength(Object.values(S.players).filter(q => q.faction !== f && q.warband.at === w.id).reduce((a, q) => ({ ...a, ...q.warband.army }), { ...w.garrison }));
      next.sort((a, b) => them(a) - them(b) || R() - 0.5);
      move = next[0].id;
    } else move = stepToward(S, f, wb.at, w => w.owner !== f);
  }
  order(S, { player: p.id, move, recruit });
}
function war(seed, turns) {
  const R = rng(seed * 7919), log = [{ type: "create", seed }];
  for (const f of ["hegemony", "apostates", "brawl"]) for (const i of [1, 2]) log.push({ type: "join", player: `${f}${i}`, name: `${f} ${i}`, faction: f });
  let S = log.reduce((s, e) => apply(s, e), null);
  const held = {};
  for (let t = 1; t <= turns; t++) {
    for (const p of Object.values(S.players)) play(S, p, R);
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
module.exports = { war };
