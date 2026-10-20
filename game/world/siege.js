// Sieges over several turns (docs/setting.md): a warband with the "besiege" stance next to a city its foes hold
// doesn't assault it but holds it under siege. Each turn under siege the city's garrison isn't supplied (a tenth lost,
// as a blockade's), it raises no levies and has no people to rally, and heavy weapons or vehicles among the besiegers
// knock a level off its world's walls every two turns. The besieged sortie when the odds are with them. Called from
// rules.js with its helpers (`H`); the tick's dice (`R`) are the only randomness.
const RG = require("./regions.js");
const { UNITS } = require("./units.js");

const STARVE = 0.1, BREACH_EVERY = 2, SORTIE_ODDS = 0.6;
const guns = army => Object.entries(army).some(([k, n]) => n > 0 && UNITS[k] && (UNITS[k].role === "heavy" || UNITS[k].role === "vehicle"));
// which cities are under siege this turn, and by whom: { "w3/r2": { w, r, by: [players] } }
function sieges(S) {
  const out = {};
  for (const p of Object.values(S.players)) {
    const wb = p.warband;
    if (wb.stance !== "besiege" || !Object.values(wb.army).some(n => n > 0)) continue;
    const w = S.worlds[wb.at], here = RG.region(w, wb.region);
    for (const id of here.links) {
      const r = RG.region(w, id);
      if (!r.city || r.owner === p.faction) continue;
      const k = w.id + "/" + r.id;
      (out[k] ||= { w, r, by: [] }).by.push(p);
    }
  }
  return out;
}
// the end of the turn: the besieged starve, their walls are knocked down, the siege's turns counted
function upkeep(S, R, H) {
  const now = sieges(S);
  for (const w of Object.values(S.worlds)) for (const r of w.regions) {
    const k = w.id + "/" + r.id, s = now[k];
    if (!s) { if (r.siege) { r.siege = 0; H.note(S, `The siege of ${r.name} on ${w.name} is lifted`); } continue; }
    r.siege = (r.siege || 0) + 1;
    if (r.siege === 1) H.note(S, `${s.by.map(p => p.name).join(" and ")} lay siege to ${r.name} on ${w.name}`);
    r.garrison = H.cut(r.garrison, STARVE, R);
    if (r.siege % BREACH_EVERY === 0 && (w.walls || 0) > 0 && s.by.some(p => guns(p.warband.army))) { w.walls--; H.note(S, `The guns before ${r.name} breach ${w.name}'s walls (level ${w.walls})`); }
    for (const p of s.by) p.warband.history.push(`Turn ${S.turn}: the siege of ${r.name} on ${w.name}, turn ${r.siege}`);
  }
}
// before the battles: a besieged garrison sorties against the besiegers next to it when its odds are good, as a force
// that fights there (and holds the region if it wins, joining its garrison there)
function sorties(S, R, H) {
  for (const w of Object.values(S.worlds)) for (const r of w.regions) {
    if (!r.siege || !r.owner || r.heldIn || H.total(r.garrison) < 10) continue;
    for (const id of r.links) {
      const x = RG.region(w, id), them = H.factionsIn(S, w, x).filter(s => s.faction !== r.owner);
      if (!them.length) continue;
      const army = them.reduce((a, s) => H.addArmy(a, s.army), {});
      const out = H.cut(r.garrison, 1 / 3, R), go = {};
      for (const [k, n] of Object.entries(r.garrison)) { const g = n - (out[k] || 0); if (g > 0) go[k] = g; }
      if (!H.total(go) || H.odds(S, w, x, r.owner, go, army) < SORTIE_ODDS) continue;
      r.garrison = out;
      S.swarms.push({ id: `o${S.turn}-${w.id}-${r.id}`, faction: r.owner, at: w.id, region: x.id, from: { at: w.id, region: r.id }, army: go });
      H.note(S, `The garrison of ${r.name} on ${w.name} sorties`);
      break;
    }
  }
}
module.exports = { sieges, upkeep, sorties, STARVE };
