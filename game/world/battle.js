// Battles that can go either way (docs/setting.md): the leaders' contest before a battle and what its margin buys,
// how a battle ends (rout, repulse, stalemate, a Pyrrhic victory), and the fog over what a faction can see of a force
// before it's there. Called from rules.js; the tick's dice (`R`) are the only randomness.
const { UNITS } = require("./units.js");
const VET = require("./veterans.js");

// ---- the leaders' contest: Strategy against Strategy (3d6, the margins compared)
const ADVANTAGES = [
  { id: "ambush", x: 1.25, text: "an ambush" },
  { id: "ground", x: 1.15, text: "the ground of its choosing" },
  { id: "night", x: 1.15, text: "a night attack", melee: true },   // -2 to shooting: worth it only to the side that fights hand to hand
  { id: "volley", x: 1.10, text: "the first volley" },
];
const roll3 = R => 3 + Math.floor(R() * 6) + Math.floor(R() * 6) + Math.floor(R() * 6);
// a side's leader: its best warband leader (10 + rank, +2 for a Warmaster), else 12 for a Dormant tomb lord, else 10
function leaderOf(S, side) {
  let best = null;
  for (const x of side.parts) {
    if (x.kind !== "warband") continue;
    const p = S.players[x.player], L = p.warband.leader;
    if (!L) continue;
    const P = S.politics && S.politics[p.faction];
    const skill = 10 + VET.rankLevel(L.battles) + (P && P.warmaster === p.id ? 2 : 0);
    if (!best || skill > best.skill) best = { name: L.name, skill };
  }
  return best || { name: null, skill: side.faction === "dormant" ? 12 : 10 };
}
// the share of a side that fights mainly hand to hand
const meleeShare = army => { let m = 0, n = 0; for (const [k, c] of Object.entries(army)) { n += c; if (k !== "militia" && UNITS[k].melee) m += c; } return n ? m / n : 0; };
function contest(S, A, B, R) {
  const L = [leaderOf(S, A), leaderOf(S, B)], mos = L.map(l => l.skill - roll3(R));
  const diff = mos[0] - mos[1];
  if (Math.abs(diff) < 2) return { winner: -1, factor: [1, 1], adv: [], leaders: L };
  const w = diff > 0 ? 0 : 1, sides = [A, B], meleeFirst = meleeShare(sides[w].army) > meleeShare(sides[1 - w].army);
  const adv = ADVANTAGES.filter(a => !a.melee || meleeFirst).slice(0, Math.min(4, Math.floor(Math.abs(diff) / 2)));
  const f = adv.reduce((a, x) => a * x.x, 1), factor = [1, 1];
  factor[w] = f;
  return { winner: w, factor, adv, leaders: L, margin: Math.abs(diff) };
}
function contestText(c, names) {
  if (c.winner < 0 || !c.adv.length) return "";
  const who = c.leaders[c.winner].name || names[c.winner];
  const list = c.adv.map(a => a.text), words = list.length > 1 ? list.slice(0, -1).join(", ") + " and " + list[list.length - 1] : list[0];
  return ` ${who} outwitted ${names[1 - c.winner]}: ${words}.`;
}

// ---- how a battle ends. pA: side A's chance; attacker: the side index that came to the world (or null, a meeting
// engagement); returns { kind, aWins, lossA, lossB }
function outcome(p, pA, attacker, R) {
  const close = 1 - Math.abs(2 * pA - 1);
  const stalemate = R() < Math.max(p.pDraw, 0.3 * close * close);
  if (stalemate) return { kind: "stalemate", aWins: null, lossA: p.lossA * 0.6, lossB: p.lossB * 0.6 };
  const aWins = R() < pA, win = aWins ? 0 : 1, loser = 1 - win;
  let lossA = aWins ? Math.min(p.lossA, 0.9) : Math.max(p.lossA, 0.6), lossB = aWins ? Math.max(p.lossB, 0.6) : Math.min(p.lossB, 0.9);
  // an attacker beaten in a fight that could have gone either way is thrown back, not broken
  if (attacker === loser && close >= 0.4) {
    if (loser === 0) { lossA = Math.min(p.lossA, 0.5); lossB = Math.min(p.lossB, 0.4); } else { lossB = Math.min(p.lossB, 0.5); lossA = Math.min(p.lossA, 0.4); }
    return { kind: "repulse", aWins, lossA, lossB };
  }
  const wl = win === 0 ? lossA : lossB;
  return { kind: wl >= 0.5 ? "pyrrhic" : "rout", aWins, lossA, lossB };
}

// ---- fog: what a faction sees of a force. Exact where it holds the world or has a warband there; rough (to the
// nearest 5) one jump off
const rough = army => Object.fromEntries(Object.entries(army).map(([k, n]) => [k, Math.max(n > 0 ? 1 : 0, Math.round(n / 5) * 5)]));
const band = (odds, exact) => { const w = exact ? 5 : 15; return [Math.max(0, odds - w), Math.min(100, odds + w)]; };

// ---- a world rallies: attacked by a force more than twice as strong as its defenders, a world with a garrison raises
// three of its people for every point of its yield (a Spire world 24, a Granary 9), as its holder's basic troops (the
// Chorus breeds Leapers; a tomb raises nothing; a free world's are more of its Local Defence)
const RALLY = { ratio: 2, perYield: 3 };
function rally(S, w, def, att, strength) {
  if (!def || !att || !def.parts.some(x => x.kind === "garrison") || strength(att.army) <= RALLY.ratio * strength(def.army)) return 0;
  const { TYPES } = require("./galaxy.js"), { FACTIONS } = require("./units.js");
  const unit = def.faction === "militia" ? "militia" : def.faction === "chorus" ? "leaper" : FACTIONS[def.faction] && FACTIONS[def.faction].basic;
  if (!unit) return 0;
  const t = TYPES[w.type], n = RALLY.perYield * (t.manpower + t.materiel);
  w.garrison[unit] = (w.garrison[unit] || 0) + n; def.army[unit] = (def.army[unit] || 0) + n;
  return n;
}
module.exports = { contest, contestText, outcome, leaderOf, rough, band, rally, ADVANTAGES };
