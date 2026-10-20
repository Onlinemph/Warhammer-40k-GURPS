// A battle report into a full engine replay: the same armies fought second by second on a countryside field sized
// to them. The engine's winner has to agree with the report's (the resolver decided the war; the replay shows how),
// so it tries seeds drawn from the report's until one does, up to ATTEMPTS; if none does it keeps the last and
// says so. The replay is compact: the map once, a roster, and per second each model's hex, state and condition,
// with the shots, blows and blasts of that second.
const { SIM, unitSpec } = require("../../tools/resolver/common.js");
const { UNITS } = require("../world/units.js");
const ATTEMPTS = 4;
const templateOf = id => id === "militia" ? "Chaos Cultist" : UNITS[id].template;
const nameOf = id => id === "militia" ? "Militia" : UNITS[id].name;

function fieldFor(report) {
  const n = report.sides.reduce((a, s) => a + Object.values(s.before).reduce((x, y) => x + y, 0), 0);
  const W = Math.max(100, Math.min(300, Math.round(100 + 0.6 * n)));
  return { mapW: W, mapH: Math.round(W / 2), mapSeed: 1 + (report.seed % 997) };
}
function build(report, onProgress = () => {}) {
  const field = fieldFor(report), roster = [];
  const units = report.sides.flatMap((s, side) => Object.entries(s.before).filter(([, n]) => n > 0).map(([id, n], i) => {
    for (let k = 0; k < n; k++) roster.push({ side, name: nameOf(id) });
    return unitSpec(templateOf(id), n, side, { squad: `${side}-${id}-${i}`, squadName: nameOf(id), label: nameOf(id) });
  }));
  const want = report.winner == null ? -1 : report.sides[0].faction === report.winner ? 0 : 1;
  let r = null, attempt = 0;
  for (attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const seed = (report.seed + attempt * 7919) >>> 0;
    r = SIM.runBattle(units, { battlefield: "countryside", ...field, seed, maxTurns: 600, frames: true, onTurn: t => onProgress({ attempt, attempts: ATTEMPTS, second: t, estimate: report.secs || 60 }) });
    if (r.winner === want) break;
  }
  const map = SIM.battlefields.countryside(field.mapSeed, field);
  // the map: every hex of the rectangle in order (offset columns, then rows), as ground height, or a wall's height
  // (negative), or an obstacle
  const ground = map.hx.map((h, i) => map.wallI[i] ? -Math.round(Math.min(99, map.wallTop[i]) * 10) : map.crateI[i] ? 1000 : Math.round(map.elev[i] * 10));
  const frames = r.frames.map(f => f.map(m => m ? [m[0], m[1], m[3], Math.round(m[5] * 100)] : 0));
  const fx = (r.fx || []).map(list => list.filter(e => e[0] === "s" || e[0] === "m" || e[0] === "b").map(e => e[0] === "b" ? ["b", e[1], e[2], e[3]] : [e[0], e[1], e[2], e[3], e[4], e[5], e[6]]));
  return {
    id: report.id, world: report.worldName, turn: report.turn, seed: report.seed, attempt: Math.min(attempt, ATTEMPTS), matched: r.winner === want,
    sides: report.sides.map(s => ({ faction: s.faction, players: s.players })), winner: r.winner, seconds: r.turns,
    map: { W: map.W, H: map.H, ground }, roster, frames, fx,
  };
}
module.exports = { build, fieldFor, ATTEMPTS };
