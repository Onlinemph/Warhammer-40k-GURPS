// Fronts (docs/setting.md, "Fronts: big, fair fights through the AI"): at the end of each turn, the holders of the
// war's cities answer the threats against them, whoever plays them. Garrisons move a region toward the city most
// threatened on their world; quiet worlds send part of their garrisons to a threatened world next door; and a faction
// that lost a city this turn sends what stands next to it to take it back, if the odds are at least even. Called from
// rules.js with its helpers (`H`); the tick's dice (`R`) are the only randomness.
const RG = require("./regions.js");
const { SCALE } = require("./units.js");

const SHARE = 1 / 3, WORLD_SHARE = 1 / 4, FLOOR = 5 * SCALE, COUNTER_ODDS = 0.5;

// what's against a region: the strength of the forces of others on it or in the regions next to it
function threatTo(S, w, r, f, H) {
  let foe = 0;
  for (const id of [r.id, ...r.links]) for (const s of H.factionsIn(S, w, RG.region(w, id))) if (s.faction !== f) foe += H.strength(s.army);
  return foe;
}
// a region's own: its garrison and the faction's warbands and swarms in it
const ownIn = (S, w, r, f, H) => H.factionsIn(S, w, r).filter(s => s.faction === f).reduce((a, s) => a + H.strength(s.army), 0);
// take a share of a garrison (rounded so the share is kept overall), leaving at least FLOOR soldiers
function draw(gar, share, R, H) {
  const n = H.total(gar), give = Math.min(Math.floor(n * share), n - FLOOR);
  if (give <= 0) return {};
  const out = H.cut(gar, give / n, R), sent = {};
  for (const [k, c] of Object.entries(gar)) { const g = c - (out[k] || 0); if (g > 0) sent[k] = g; }
  for (const k of Object.keys(gar)) gar[k] = out[k] || 0;
  return sent;
}
function fronts(S, R, T, H) {
  const moved = [];
  // ---- garrisons answer threats on their own world: the quiet ones send a third a region toward the city most in
  // danger (its foes next to it against its own), along regions their faction holds
  for (const id of S.order) {
    const w = S.worlds[id];
    for (const f of new Set(w.regions.filter(r => r.owner && r.city).map(r => r.owner))) {
      if (f === "dormant") continue;
      const danger = RG.cities(w).filter(r => r.owner === f && !r.heldIn).map(r => ({ r, t: threatTo(S, w, r, f, H), own: ownIn(S, w, r, f, H) })).filter(x => x.t > 0).sort((a, b) => b.t / Math.max(1, b.own) - a.t / Math.max(1, a.own))[0];
      if (!danger || danger.t <= danger.own * 0.5) continue;
      for (const r of w.regions) {
        if (r === danger.r || r.owner !== f || r.heldIn || threatTo(S, w, r, f, H) > 0 || H.total(r.garrison) <= FLOOR) continue;
        const step = RG.stepToward(w, r.id, x => x.id === danger.r.id);
        const next = step && RG.region(w, step);
        if (!next || next.owner !== f || next.heldIn) continue;
        const sent = draw(r.garrison, SHARE, R, H);
        if (!H.total(sent)) continue;
        H.addArmy(next.garrison, sent);
        moved.push({ w, from: r, to: next, n: H.total(sent), f });
      }
    }
  }
  // ---- worlds help worlds: a faction's quiet world sends a quarter of its biggest garrison one jump to a threatened
  // world of its own next door, to its seat there
  for (const f of Object.keys(S.factions)) {
    if (f === "dormant") continue;
    const mine = Object.values(S.worlds).filter(w => w.owner === f);
    const threatened = mine.map(w => { const seat = RG.seatOf(w, f); if (!seat) return null; const foe = w.regions.reduce((a, r) => a + H.factionsIn(S, w, r).filter(s => s.faction !== f).reduce((x, s) => x + H.strength(s.army), 0), 0); const near = w.links.reduce((a, id) => a + H.factionsAt(S, S.worlds[id]).filter(s => s.faction !== f && s.faction !== "militia").reduce((x, s) => x + H.strength(s.army), 0) * 0.5, 0); return { w, seat, t: foe + near, own: H.strength(RG.garrisonOf(w)) }; })
      .filter(x => x && x.t > x.own).sort((a, b) => b.t / Math.max(1, b.own) - a.t / Math.max(1, a.own));
    const used = new Set();
    for (const t of threatened) {
      const donor = mine.filter(d => d !== t.w && !used.has(d.id) && t.w.links.includes(d.id) && !threatened.some(x => x.w === d)).map(d => ({ d, r: d.regions.filter(r => r.owner === f && !r.heldIn).sort((a, b) => H.total(b.garrison) - H.total(a.garrison))[0] })).filter(x => x.r && H.total(x.r.garrison) > 2 * FLOOR)[0];
      if (!donor) continue;
      const sent = draw(donor.r.garrison, WORLD_SHARE, R, H);
      if (!H.total(sent)) continue;
      H.addArmy(t.seat.garrison, sent); used.add(donor.d.id);
      H.note(S, `${H.total(sent)} of ${H.fname(f)} go from ${donor.d.name} to the defence of ${t.w.name}`);
    }
  }
  // ---- counter-attacks: a city lost this turn, retaken by its old holder's garrisons next to it if the odds are at
  // least even (they go as a force, fight there next turn, and join the city's garrison if they take it)
  for (const lost of T.lostCities || []) {
    const w = S.worlds[lost.world], r = RG.region(w, lost.region), f = lost.was;
    if (!f || f === "dormant" || r.owner === f || r.heldIn) continue;
    // (its garrisons anywhere on the world that aren't under threat themselves)
    const donors = w.regions.filter(x => x !== r && x.owner === f && !x.heldIn && H.total(x.garrison) > FLOOR && threatTo(S, w, x, f, H) === 0);
    if (!donors.length) continue;
    const army = {}, from = [];
    // (each sends all but FLOOR: `keep` is what stays)
    for (const d of donors) { const n = H.total(d.garrison), keep = H.cut(d.garrison, (n - FLOOR) / n, R); for (const [k, c] of Object.entries(d.garrison)) { const g = c - (keep[k] || 0); if (g > 0) army[k] = (army[k] || 0) + g; } from.push({ d, keep }); }
    if (!H.total(army)) continue;
    const them = H.factionsIn(S, w, r).filter(s => s.faction !== f).reduce((a, s) => H.addArmy(a, s.army), {});
    if (H.total(them) && H.odds(S, w, r, f, army, them) < COUNTER_ODDS) continue;
    for (const x of from) for (const k of Object.keys(x.d.garrison)) x.d.garrison[k] = x.keep[k] || 0;
    S.swarms.push({ id: `k${S.turn}-${w.id}-${r.id}`, faction: f, at: w.id, region: r.id, from: { at: w.id, region: donors[0].id }, army });
    H.note(S, `${H.fname(f)} counter-attack ${r.name} on ${w.name}`);
  }
  return moved;
}
// a faction's forces that hold the region they stand in join its garrison there (a counter-attack that took its city
// back); called at the start of the AI's turn
function settle(S, H) {
  for (const sw of S.swarms) {
    if (!sw.faction || sw.faction === "chorus" || sw.faction === "dormant" || sw.heldIn) continue;
    const r = RG.region(S.worlds[sw.at], sw.region);
    if (r && r.owner === sw.faction) { H.addArmy(r.garrison, sw.army); sw.army = {}; }
  }
  S.swarms = S.swarms.filter(s => H.total(s.army));
}
module.exports = { fronts, settle, threatTo };
