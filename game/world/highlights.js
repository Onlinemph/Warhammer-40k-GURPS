// The highlight feed (docs/setting.md, Watching battles): each tick every battle gets a score from what happened in
// it, with a line saying why; each faction sees its top 10 of the turn; players upvote what was worth watching, and
// each reason's weight drifts toward what they vote for. Worked out from the log like everything else.
const REASONS = ["upset", "close", "size", "named", "weight"];
const BASE = { upset: 40, close: 25, size: 2, named: 1, weight: 1 };
const DRIFT = 0.1, LIMITS = [0.5, 2], TOP = 10;

function setup(S) { S.highlights = { weights: Object.fromEntries(REASONS.map(r => [r, 1])), votes: {}, turnVotes: {} }; }

// ---- each battle of this tick: its parts of the score, and the words for them. `T.captured`: worlds taken this tick
function score(S, T) {
  for (const r of S.reports) {
    if (r.turn !== S.turn || r.hl) continue;
    const parts = {}, why = [];
    const w = r.winner == null ? null : r.sides[0].faction === r.winner ? 0 : 1, odds = w == null ? null : w === 0 ? r.odds : 100 - r.odds;
    if (odds != null && odds < 35) { parts.upset = BASE.upset * (35 - odds) / 35 + 10; why.push(`an upset: ${odds}% odds`); }
    if (r.odds >= 40 && r.odds <= 60 && (r.losses || [0, 0]).every(x => x >= 0.5)) { parts.close = BASE.close; why.push("a close, bloody fight"); }
    const n = r.sides.reduce((a, s) => a + Object.values(s.before).reduce((x, y) => x + y, 0), 0);
    parts.size = BASE.size * Math.sqrt(n);
    if (n >= 100) why.push(`${n} on the field`);
    let named = 0;
    if ((r.fallen || []).length) { named += 8 * r.fallen.length; why.push(`${r.fallen.slice(0, 2).join(" and ")}${r.fallen.length > 2 ? ` and ${r.fallen.length - 2} more` : ""} fell`); }
    if ((r.leaders || []).length) { named += 15 * r.leaders.length; why.push(`the leader ${r.leaders[0]} fell`); }
    const legends = r.sides.flatMap(s => (s.named || []).filter(x => x.bonus >= 4));
    if (legends.length) { named += 10; why.push(`${legends[0].name}, a Legend, fought`); }
    if (named) parts.named = named;
    let weight = 0;
    const wd = S.worlds[r.world];
    if (T.captured[r.world]) { weight += 15; why.push(`${r.worldName} changed hands`); }
    if (wd && wd.capital) { weight += 20; why.push("a capital"); }
    if (S.broken && S.broken.some(b => b.world === r.world && b.turn === S.turn)) { weight += 20; why.push("a tomb broken open"); }
    if (weight) parts.weight = weight;
    r.hl = { parts, why };
  }
}
const total = (S, r) => r.hl ? REASONS.reduce((a, k) => a + (r.hl.parts[k] || 0) * S.highlights.weights[k], 0) : 0;

// ---- an upvote: one a player a battle, on a battle their faction can see
function checkVote(S, e, visible) {
  if (!S.players[e.player]) return "no such player";
  const r = S.reports.find(x => x.id === e.report);
  if (!r || !visible(r)) return "no such battle that you know of";
  if ((S.highlights.votes[r.id] || []).includes(e.player)) return "you've marked that one already";
  return null;
}
function vote(S, e) {
  (S.highlights.votes[e.report] ||= []).push(e.player);
  (S.highlights.turnVotes[S.turn] ||= []).push(e.report);
}
// ---- at the end of the tick: this turn's votes move the weights, each by at most a tenth: toward the reasons in the
// battles people marked, in proportion to how much of those battles' scores each reason made
function drift(S) {
  const ids = S.highlights.turnVotes[S.turn - 1] || [];
  delete S.highlights.turnVotes[S.turn - 1];
  if (!ids.length) return;
  const share = Object.fromEntries(REASONS.map(k => [k, 0]));
  for (const id of ids) {
    const r = S.reports.find(x => x.id === id); if (!r || !r.hl) continue;
    const t = REASONS.reduce((a, k) => a + (r.hl.parts[k] || 0), 0) || 1;
    for (const k of REASONS) share[k] += (r.hl.parts[k] || 0) / t / ids.length;
  }
  for (const k of REASONS) {
    const w = S.highlights.weights[k], step = Math.max(-DRIFT, Math.min(DRIFT, (share[k] - 1 / REASONS.length) * 2));
    S.highlights.weights[k] = Math.round(Math.max(LIMITS[0], Math.min(LIMITS[1], w * (1 + step))) * 1000) / 1000;
  }
}

// ---- what a player sees: the top battles of the latest turn that had any, among those they can see
function view(S, p, visible) {
  const turn = Math.max(0, ...S.reports.map(r => r.turn));
  const mine = r => r.sides.some(s => s.players.includes(p.name));
  const list = S.reports.filter(r => r.turn === turn && visible(r)).map(r => ({ r, s: total(S, r) })).sort((a, b) => b.s - a.s).slice(0, TOP);
  return { turn, weights: S.highlights.weights, list: list.map(({ r, s }) => ({ id: r.id, world: r.worldName, text: r.text, score: Math.round(s), why: r.hl ? r.hl.why : [], mine: mine(r),
    votes: (S.highlights.votes[r.id] || []).length, voted: (S.highlights.votes[r.id] || []).includes(p.id) })) };
}
module.exports = { setup, score, checkVote, vote, drift, view, total, REASONS };
