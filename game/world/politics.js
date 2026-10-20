// Politics and contracts (docs/setting.md): service, an elected Warmaster per player faction (votes weighted by
// service, recall, absence), stockpile priority, contracts paid from escrow into warband treasuries, reputations,
// and a log only the faction can read. Votes, standing and the Warmaster's acts are `politics` events, applied when
// they come in; elections, recalls, deadlines and payments are worked out at the tick. All from the log.
const { FACTIONS } = require("./units.js");

const SERVICE = { turn: 1, battle: 2, win: 3, contract: 5 };
const ELECTION = { every: 10, at: 5, minTurns: 5, minBattles: 3 }, ABSENT = 3;
const CONTRACT = { open: 4, deadline: 15, hold: [2, 6] }, PRIORITY = { max: 2, weight: 2 };
const KINDS = ["take", "hold", "deliver", "break"];
const RES = ["manpower", "materiel", "supply"];
const isPlayerFaction = f => !!(FACTIONS[f] && FACTIONS[f].player);

function setup(S) {
  S.politics = {};
  for (const f of Object.keys(S.factions)) if (isPlayerFaction(f)) S.politics[f] = { warmaster: null, candidates: [], votes: {}, recall: {}, priority: [], contracts: [], log: [], records: {}, next: 1 };
}
function joined(S, p) {
  const wb = p.warband;
  wb.service = 0; wb.treasury = { manpower: 0, materiel: 0, supply: 0 }; wb.record = { done: 0, failed: 0 }; wb.joinedTurn = S.turn; wb.battles = 0;
  p.lastActive = S.turn;
}
const flog = (S, f, text) => { const P = S.politics[f]; P.log.push({ turn: S.turn, text }); if (P.log.length > 200) P.log.shift(); };
const nameOf = (S, id) => S.players[id] ? S.players[id].name : id;
const nextElection = turn => { const k = Math.max(0, Math.ceil((turn + 1 - ELECTION.at) / ELECTION.every)); return ELECTION.at + k * ELECTION.every; };
const eligible = (S, p) => S.turn - (p.warband.joinedTurn ?? 0) >= ELECTION.minTurns && (p.warband.battles || 0) >= ELECTION.minBattles;
const members = (S, f) => Object.values(S.players).filter(p => p.faction === f);

// ---- the share of the stockpile a warband draws: double for the Warmaster's priority
function weight(S, p) { const P = S.politics[p.faction]; return P && P.priority.includes(p.id) ? PRIORITY.weight : 1; }

// ---- a politics event, checked: returns the problem or null; apply() does it
function check(S, e) {
  const p = S.players[e.player];
  if (!p) return "no such player";
  const P = S.politics[p.faction];
  if (!P) return "your faction has no politics";
  const wm = P.warmaster === p.id;
  switch (e.action) {
    case "stand":
      if (P.candidates.includes(p.id)) return "you are standing already";
      if (!eligible(S, p)) return `to stand you need ${ELECTION.minTurns} turns served and ${ELECTION.minBattles} battles fought`;
      return null;
    case "vote": { const c = S.players[e.for]; return c && c.faction === p.faction && P.candidates.includes(c.id) ? null : "vote for one of the candidates"; }
    case "recall": return P.warmaster ? null : "there is no Warmaster to recall";
    case "priority":
      if (!wm) return "only the Warmaster sets priorities";
      if (!Array.isArray(e.warbands) || e.warbands.length > PRIORITY.max) return `name up to ${PRIORITY.max} warbands`;
      return e.warbands.every(id => S.players[id] && S.players[id].faction === p.faction) ? null : "only warbands of your faction";
    case "post": {
      if (!wm) return "only the Warmaster posts contracts";
      const c = e.contract || {};
      if (P.contracts.length >= CONTRACT.open) return `up to ${CONTRACT.open} contracts at once`;
      if (!KINDS.includes(c.kind)) return "no such contract";
      const w = S.worlds[c.world];
      if (!w) return "no such world";
      if (c.kind === "take" && w.owner === p.faction) return `${w.name} is yours already`;
      if (c.kind === "hold" && !(c.turns >= CONTRACT.hold[0] && c.turns <= CONTRACT.hold[1])) return `hold for ${CONTRACT.hold[0]} to ${CONTRACT.hold[1]} turns`;
      if (c.kind === "deliver" && (!w.depot || w.owner !== p.faction || !(c.supply >= 1 && c.supply <= 200))) return "deliver 1 to 200 supply to a depot of yours";
      if (c.kind === "break" && !(w.tomb && w.owner === "dormant")) return `${w.name} is no tomb to break`;
      if (!(c.deadline >= 1 && c.deadline <= CONTRACT.deadline)) return `a deadline of 1 to ${CONTRACT.deadline} turns`;
      if (c.offer && !(S.players[c.offer] && S.players[c.offer].faction === p.faction)) return "offer it to a warband of your faction";
      const st = S.factions[p.faction].stock, rw = c.reward || {};
      if (!RES.some(k => rw[k] > 0)) return "a contract needs a reward";
      for (const k of RES) if ((rw[k] || 0) < 0 || (rw[k] || 0) > (st[k] || 0)) return `the stockpile hasn't ${rw[k]} ${k} to put in escrow`;
      return null;
    }
    case "cancel": return wm && P.contracts.some(c => c.id === e.id) ? null : "only the Warmaster cancels, and only an open contract";
    case "accept": { const c = P.contracts.find(x => x.id === e.id); return c && c.offer === p.id && !c.accepted ? null : "no contract offered to you by that name"; }
    default: return "no such politics";
  }
}
function apply(S, e) {
  const err = check(S, e);
  if (err) return err;
  const p = S.players[e.player], f = p.faction, P = S.politics[f];
  p.lastActive = S.turn;
  if (e.action === "stand") { P.candidates.push(p.id); flog(S, f, `${p.name} stands for Warmaster`); }
  else if (e.action === "vote") P.votes[p.id] = e.for;
  else if (e.action === "recall") { if (e.yes === false) delete P.recall[p.id]; else P.recall[p.id] = true; }
  else if (e.action === "priority") { P.priority = [...e.warbands]; flog(S, f, `The Warmaster gives priority to ${P.priority.map(id => nameOf(S, id)).join(" and ") || "nobody"}`); }
  else if (e.action === "post") {
    const c = e.contract, st = S.factions[f].stock, w = S.worlds[c.world], reward = {};
    for (const k of RES) if (c.reward[k] > 0) { reward[k] = Math.floor(c.reward[k]); st[k] -= reward[k]; }
    const k = { id: `k${P.next++}`, kind: c.kind, world: w.id, turns: c.kind === "hold" ? c.turns : undefined, supply: c.kind === "deliver" ? c.supply : undefined,
      reward, offer: c.offer || null, accepted: false, posted: S.turn, deadline: S.turn + c.deadline, progress: {} };
    P.contracts.push(k);
    rec(S, f, p.id).posted++;
    flog(S, f, `The Warmaster posts a contract: ${describe(S, k)}, for ${pay(k.reward)}, by turn ${k.deadline}${k.offer ? `, offered to ${nameOf(S, k.offer)}` : ", an open bounty"}`);
  } else if (e.action === "cancel") {
    const k = P.contracts.find(c => c.id === e.id), st = S.factions[f].stock;
    P.contracts = P.contracts.filter(c => c !== k);
    if (k.accepted && S.players[k.offer]) { const half = {}; for (const r of RES) if (k.reward[r]) { half[r] = Math.floor(k.reward[r] / 2); S.players[k.offer].warband.treasury[r] += half[r]; st[r] += k.reward[r] - half[r]; } flog(S, f, `The Warmaster cancels ${describe(S, k)}; ${nameOf(S, k.offer)} is paid ${pay(half)} for the trouble`); }
    else { for (const r of RES) if (k.reward[r]) st[r] += k.reward[r]; flog(S, f, `The Warmaster cancels ${describe(S, k)}`); }
    rec(S, f, p.id).cancelled++;
  } else if (e.action === "accept") { const k = P.contracts.find(c => c.id === e.id); k.accepted = true; flog(S, f, `${p.name} accepts ${describe(S, k)}`); }
  return null;
}
const rec = (S, f, id) => (S.politics[f].records[id] ||= { posted: 0, paid: 0, cancelled: 0 });
const pay = r => RES.filter(k => r[k]).map(k => `${r[k]} ${k}`).join(", ") || "nothing";
function describe(S, k) {
  const w = S.worlds[k.world].name;
  return k.kind === "take" ? `take ${w}` : k.kind === "hold" ? `hold ${w} for ${k.turns} turns` : k.kind === "deliver" ? `deliver ${k.supply} supply to ${w}` : `break the tomb on ${w}`;
}

// ---- in battle: service for fighting and winning
function battle(S, p, won) { const wb = p.warband; wb.battles = (wb.battles || 0) + 1; wb.service += SERVICE.battle + (won ? SERVICE.win : 0); }

// ---- the tick's politics: service for the turn, contracts checked and paid, recall, absence, elections.
// `T.captured` world id -> player ids whose warbands took it this tick; `T.delivered` [{player, world, n}]
function tick(S, T) {
  for (const p of Object.values(S.players)) if (p.warband.army && Object.values(p.warband.army).some(n => n > 0)) p.warband.service += SERVICE.turn;
  for (const [f, P] of Object.entries(S.politics)) {
    // contracts
    for (const k of [...P.contracts]) {
      const w = S.worlds[k.world], may = id => !k.offer || (k.accepted && k.offer === id);
      let paidTo = null;
      if (k.kind === "take" || k.kind === "break") {
        const by = (T.captured[w.id] || []).filter(id => S.players[id] && S.players[id].faction === f && may(id));
        const broke = k.kind === "break" ? S.broken.some(b => b.world === w.id && b.turn === S.turn && b.by === f) : w.owner === f;
        if (by.length && broke) paidTo = by;
      } else if (k.kind === "hold") {
        for (const p of members(S, f)) if (may(p.id) && p.warband.at === w.id && w.owner === f && Object.values(p.warband.army).some(n => n > 0)) k.progress[p.id] = (k.progress[p.id] || 0) + 1;
        const done = Object.entries(k.progress).find(([, n]) => n >= k.turns);
        if (done) paidTo = [done[0]];
      } else if (k.kind === "deliver") {
        for (const d of T.delivered) if (d.world === w.id && S.players[d.player] && S.players[d.player].faction === f && may(d.player)) k.progress[d.player] = (k.progress[d.player] || 0) + d.n;
        const done = Object.entries(k.progress).find(([, n]) => n >= k.supply);
        if (done) paidTo = [done[0]];
      }
      if (paidTo) {
        P.contracts = P.contracts.filter(c => c !== k);
        const each = {};
        for (const r of RES) if (k.reward[r]) each[r] = Math.floor(k.reward[r] / paidTo.length);
        for (const id of paidTo) { const wb = S.players[id].warband; for (const r of RES) if (each[r]) wb.treasury[r] += each[r]; wb.record.done++; wb.service += SERVICE.contract; wb.history.push(`Turn ${S.turn}: paid ${pay(each)} for the contract to ${describe(S, k)}`); }
        if (P.warmaster) rec(S, f, P.warmaster).paid++;
        flog(S, f, `Contract fulfilled: ${describe(S, k)}, ${pay(each)} to ${paidTo.map(id => nameOf(S, id)).join(" and ")}`);
      } else if (S.turn >= k.deadline) {
        P.contracts = P.contracts.filter(c => c !== k);
        for (const r of RES) if (k.reward[r]) S.factions[f].stock[r] += k.reward[r];
        if (k.accepted && S.players[k.offer]) S.players[k.offer].warband.record.failed++;
        flog(S, f, `Contract expired: ${describe(S, k)}${k.accepted ? `; ${nameOf(S, k.offer)} failed it` : ""}`);
      }
    }
    // recall, then absence
    const total = members(S, f).reduce((a, p) => a + p.warband.service, 0);
    if (P.warmaster) {
      const yes = Object.keys(P.recall).filter(id => S.players[id] && S.players[id].faction === f).reduce((a, id) => a + S.players[id].warband.service, 0);
      if (yes * 2 > total) { flog(S, f, `${nameOf(S, P.warmaster)} is recalled as Warmaster (${yes} of ${total} service)`); vacate(S, f); }
      else if (S.turn - (S.players[P.warmaster]?.lastActive ?? -99) > ABSENT) { flog(S, f, `${nameOf(S, P.warmaster)} has given no orders for ${ABSENT} turns and loses the office`); vacate(S, f); }
    }
    // the election
    if (S.turn >= ELECTION.at && (S.turn - ELECTION.at) % ELECTION.every === 0) {
      const cands = P.candidates.filter(id => S.players[id] && eligible(S, S.players[id]));
      if (cands.length) {
        const tally = Object.fromEntries(cands.map(id => [id, 0]));
        for (const [voter, c] of Object.entries(P.votes)) if (c in tally && S.players[voter]) tally[c] += S.players[voter].warband.service;
        const win = cands.slice().sort((a, b) => tally[b] - tally[a] || S.players[b].warband.service - S.players[a].warband.service)[0];
        if (P.warmaster !== win) P.priority = [];
        P.warmaster = win; S.players[win].lastActive = S.turn; P.recall = {};
        flog(S, f, `${nameOf(S, win)} is elected Warmaster: ${cands.map(id => `${nameOf(S, id)} ${tally[id]}`).join(", ")}`);
        S.log.push({ turn: S.turn, text: `${nameOf(S, win)} is the new Warmaster of ${FACTIONS[f].name}` });
      }
      P.candidates = []; P.votes = {};
    }
  }
}
function vacate(S, f) { const P = S.politics[f]; P.warmaster = null; P.priority = []; P.recall = {}; }

// ---- spending from a warband's treasury, after its share: what's left to pay for `need` of resource k
function fromTreasury(p, k, need) { const t = p.warband.treasury; if (!t || need <= 0) return need; const use = Math.min(t[k] || 0, need); t[k] -= use; return need - use; }

// ---- what a player's faction may see of its politics
function view(S, p) {
  const P = S.politics[p.faction];
  if (!P) return null;
  const mem = members(S, p.faction), total = mem.reduce((a, q) => a + q.warband.service, 0);
  const tally = Object.fromEntries(P.candidates.map(id => [id, 0]));
  for (const [voter, c] of Object.entries(P.votes)) if (c in tally && S.players[voter]) tally[c] += S.players[voter].warband.service;
  return {
    warmaster: P.warmaster ? { id: P.warmaster, name: nameOf(S, P.warmaster), record: rec(S, p.faction, P.warmaster) } : null, youAre: p.id,
    nextElection: nextElection(S.turn), candidates: P.candidates.map(id => ({ id, name: nameOf(S, id), service: S.players[id].warband.service, votes: tally[id] })),
    yourVote: P.votes[p.id] || null, recall: { yes: Object.keys(P.recall).reduce((a, id) => a + (S.players[id]?.warband.service || 0), 0), total, you: !!P.recall[p.id] },
    eligible: eligible(S, p), priority: P.priority.map(id => ({ id, name: nameOf(S, id) })),
    members: mem.map(q => ({ id: q.id, name: q.name, service: q.warband.service, record: q.warband.record })),
    contracts: P.contracts.map(k => ({ id: k.id, text: describe(S, k), kind: k.kind, world: k.world, reward: k.reward, deadline: k.deadline, offer: k.offer ? { id: k.offer, name: nameOf(S, k.offer) } : null, accepted: k.accepted, progress: k.progress[p.id] || 0 })),
    log: P.log.slice(-30).reverse(), limits: { contracts: CONTRACT.open, deadline: CONTRACT.deadline, hold: CONTRACT.hold, priority: PRIORITY.max },
  };
}

module.exports = { setup, joined, weight, check, apply, battle, tick, fromTreasury, view, describe, nextElection, eligible, KINDS, ELECTION };
