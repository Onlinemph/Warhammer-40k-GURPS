// Battles fought live (docs/setting.md, Watching battles): a battle held open at the tick for its commanders is run
// here on the full engine, one answer at a time, from the commanders' own browsers. The browser runs the same battle
// from the same setup to show it, but the result is this server's: it steps the engine with each answer, checks the
// answer comes from the commander of the side the battle is waiting on, keeps the answers on disk (a restart steps
// the battle again from them), and when the battle ends logs a "live" event with who held the field and what each side
// lost, which the war applies at the next tick.
const fs = require("fs"), path = require("path");
const { SIM } = require("../tools/resolver/common.js");
const { unitsFor, fieldFor } = require("./replay/build.js");
const { FACTIONS, MILITIA } = require("./world/units.js");
const factionName = f => f === "militia" ? MILITIA.name : FACTIONS[f] ? FACTIONS[f].name : f;

function makeLive({ dataDir, state, record }) {
  const DIR = path.join(dataDir, "live");
  fs.mkdirSync(DIR, { recursive: true });
  const games = new Map();   // held battle id -> { h, gen, step, answers, human }
  const file = id => path.join(DIR, id.replace(/[^\w-]/g, "") + ".json");

  // the battle as the engine takes it, the same for the server and the browser
  function setup(h) {
    const { units } = unitsFor(h), field = fieldFor(h);
    const sides = h.commanders.map((c, i) => c ? i : null).filter(x => x != null);
    return { units, opts: { battlefield: "countryside", ...field, seed: h.seed, maxTurns: 600, human: { side: sides.length === 2 ? "both" : sides[0], direct: [] } } };
  }
  function open(id) {
    const S = state(), h = (S.held || []).find(x => x.id === id);
    if (!h) { games.delete(id); return null; }
    let g = games.get(id);
    if (g && g.h === h) return g;
    const st = setup(h), gen = SIM.playBattle(st.units, st.opts);
    g = { h, st, gen, step: gen.next(), answers: [], logged: !!h.result };
    // a restart: the answers so far, stepped through again
    const saved = fs.existsSync(file(id)) ? JSON.parse(fs.readFileSync(file(id), "utf8")).answers : [];
    for (const a of saved) { if (g.step.done) break; g.step = g.gen.next(a); g.answers.push(a); }
    games.set(id, g);
    finish(g);
    return g;
  }
  const sideOf = (g, player) => g.h.commanders.indexOf(player);
  const waitingOn = g => g.step.done ? null : g.step.value.side;
  // the battle over: who held the field, what each side lost (from the standing count at the start and the end)
  function finish(g) {
    if (!g.step.done || g.logged) return;
    const r = g.step.value, t = r.tally || [], a = t[0] || [1, 1], z = t[t.length - 1] || a;
    const losses = [0, 1].map(s => a[s] ? Math.round(1000 * (1 - z[s] / a[s])) / 1000 : 0);
    record({ type: "live", id: g.h.id, winner: r.winner, losses });
    g.logged = true;
  }
  // what a commander's browser needs: the setup, the answers so far, whose turn it is
  function get(id, player) {
    const g = open(id);
    if (!g) return { error: "that battle isn't waiting to be fought" };
    const you = sideOf(g, player);
    if (you < 0) return { error: "you don't command a side in that battle" };
    return { id, world: g.h.worldName, turn: g.h.turn, sides: g.h.sides.map(s => ({ faction: s.faction, name: factionName(s.faction), players: s.players })), you, commanders: g.h.commanders.map(c => c != null),
      setup: g.st, answers: g.answers, waitingOn: waitingOn(g), done: g.step.done ? { winner: g.step.value.winner } : null };
  }
  // one answer: the k-th, from the commander of the side the battle waits on
  function answer(id, player, k, ans) {
    const g = open(id);
    if (!g) return { error: "that battle isn't waiting to be fought" };
    if (g.step.done) return { error: "the battle is over" };
    if (k !== g.answers.length) return { error: `out of step: the battle is at answer ${g.answers.length}`, at: g.answers.length };
    if (sideOf(g, player) !== waitingOn(g)) return { error: "the battle is waiting on the other side" };
    let step;
    try { step = g.gen.next(ans); } catch (e) { return { error: "the engine refused that: " + e.message }; }
    g.step = step; g.answers.push(ans);
    fs.writeFileSync(file(id) + ".tmp", JSON.stringify({ answers: g.answers })); fs.renameSync(file(id) + ".tmp", file(id));
    finish(g);
    return { ok: true, at: g.answers.length, waitingOn: waitingOn(g), done: g.step.done ? { winner: g.step.value.winner } : null };
  }
  // held battles that are gone (settled at a tick): forget them and their answers
  function sweep() {
    const S = state(), live = new Set((S.held || []).map(h => h.id));
    for (const id of [...games.keys()]) if (!live.has(id)) games.delete(id);
    for (const f of fs.readdirSync(DIR)) if (!live.has(f.replace(/\.json$/, ""))) fs.unlinkSync(path.join(DIR, f));
  }
  return { get, answer, sweep };
}
module.exports = { makeLive };
