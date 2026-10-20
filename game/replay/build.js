// A battle report into a full engine replay: the same armies fought second by second on a countryside field sized
// to them. The engine's winner has to agree with the report's (the resolver decided the war; the replay shows how),
// so it tries seeds drawn from the report's until one does, up to ATTEMPTS; if none does it keeps the last and
// says so. The replay is compact: the map once, a roster, and per second each model's hex, state and condition,
// with the shots, blows and blasts of that second.
const { SIM, unitSpec } = require("../../tools/resolver/common.js");
const { templateOf, nameOf } = require("../world/units.js");
const ATTEMPTS = 4;

function fieldFor(report) {
  const n = report.sides.reduce((a, s) => a + Object.values(s.before).reduce((x, y) => x + y, 0), 0);
  const W = Math.max(100, Math.min(300, Math.round(100 + 0.6 * n)));
  return { mapW: W, mapH: Math.round(W / 2), mapSeed: 1 + (report.seed % 997) };
}
// a named soldier's weapon skills, raised by their rank (less their scars): the template's own levels plus the bonus
function skillsFor(template, bonus) {
  const u = SIM.buildUnit(unitSpec(template, 1, 0).spec, 0), out = {};
  for (const w of [u.ranged, u.melee]) if (w && w.skill && w.level != null) out[w.skill] = w.level + bonus;
  return out;
}
// a report's (or a held battle's) armies as engine unit specs: the named as themselves, a side short of supply with
// two spare magazines; with the roster of names in the order the engine numbers the models
function unitsFor(report) {
  const roster = [];
  const units = report.sides.flatMap((s, side) => {
    // the named fight as themselves, out of their unit's count, in its squad
    const named = (s.named || []).filter(n => (s.before[n.unit] || 0) > 0), left = { ...s.before };
    for (const n of named) left[n.unit]--;
    // a side short of supply carries two spare magazines, not its usual
    const mags = s.short ? { mags: 2 } : {};
    return Object.entries(s.before).filter(([, n]) => n > 0).flatMap(([id], i) => {
      const squad = `${side}-${id}-${i}`, out = [];
      if (left[id] > 0) { for (let k = 0; k < left[id]; k++) roster.push({ side, name: nameOf(id) }); out.push(unitSpec(templateOf(id), left[id], side, { squad, squadName: nameOf(id), label: nameOf(id), ...mags })); }
      for (const n of named.filter(m => m.unit === id)) { roster.push({ side, name: n.name }); out.push(unitSpec(templateOf(id), 1, side, { squad, squadName: nameOf(id), label: n.name, ...mags, ...(n.bonus ? { skills: skillsFor(templateOf(id), n.bonus) } : {}) })); }
      return out;
    });
  });
  return { units, roster };
}
function build(report, onProgress = () => {}) {
  const field = fieldFor(report), { units, roster } = unitsFor(report);
  const want = report.winner == null ? -1 : report.sides[0].faction === report.winner ? 0 : 1;
  let r = null, attempt = 0;
  for (attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const seed = (report.seed + attempt * 7919) >>> 0;
    r = SIM.runBattle(units, { battlefield: "countryside", ...field, seed, maxTurns: 600, frames: true, log: true, onTurn: t => onProgress({ attempt, attempts: ATTEMPTS, second: t, estimate: report.secs || 60 }) });
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
    // the engine's own result, whole, for the 3D and broadcast views on the simulator page (kept in its own file)
    full: { frames: r.frames, fx: r.fx, terrain: r.terrain, roster: r.roster, beatTurn: r.beatTurn, logAt: r.logAt, log: r.log, winner: r.winner,
      timeout: r.timeout, over: r.over ?? true, turns: r.turns, ridge: r.ridge, tally: r.tally },
  };
}
module.exports = { build, fieldFor, unitsFor, ATTEMPTS };
