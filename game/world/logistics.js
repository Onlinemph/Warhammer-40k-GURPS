// Supply and logistics (docs/setting.md): supply is made on worlds and eaten by warbands, stored in depots, carried
// by convoys that can be raided, and cut off by blockades; a warband short of it fights worse. Worked out at the tick
// from the log; the tick's dice (`R`) are the only randomness. Called from rules.js with its helpers (`H`).
const { FACTIONS, SCALE } = require("./units.js");

const EAT = 10 * SCALE;                            // soldiers a supply feeds for a turn (SCALE: units.js)
const DEPOT = { cost: 30 * SCALE, cap: 60 }, CONVOY = { max: 30 };
const SHORT = 0.8;                                 // a hungry or cut-off warband's side fights at this
const STARVE = 0.1, BLOCKADE_LOYALTY = 5;
const WASTE_AFTER = 3;                             // turns out of supply before a warband starts wasting away
const isPlayerFaction = f => !!(FACTIONS[f] && FACTIONS[f].player);
const need = army => Math.ceil(Object.values(army).reduce((a, n) => a + n, 0) / EAT);

function setup(S) {
  S.convoys = [];
  for (const [f, F] of Object.entries(S.factions)) if (isPlayerFaction(f)) F.stock.supply = 20;   // (supply isn't scaled: a supply feeds SCALE times as many)
}

// a world of its holder's that has no lane to another of its holder's worlds, with an enemy next door
function blockaded(S, w, H) {
  if (!w.owner || !isPlayerFaction(w.owner)) return false;
  if (w.links.some(n => S.worlds[n].owner === w.owner)) return false;
  return w.links.some(n => H.factionsAt(S, S.worlds[n]).some(s => s.faction !== w.owner));
}

// ---- income: supply from the worlds joined to the capital, none from a blockaded world
function income(S, H) {
  for (const f of Object.keys(S.factions)) {
    if (!isPlayerFaction(f)) continue;
    for (const id of H.supplied(S, f)) { const w = S.worlds[id]; if (!blockaded(S, w, H)) S.factions[f].stock.supply += (H.TYPES[w.type].supply || 0) / SCALE * H.heldShare(w, f); }
  }
}
const noIncome = (S, w, H) => blockaded(S, w, H);

// ---- orders: depots and convoys, checked when given; returns the problem or null
function checkOrder(S, p, { build, convoy }) {
  const wb = p.warband, here = S.worlds[wb.at];
  if (build === "depot") {
    if (here.owner !== p.faction) return "depots are built on your own worlds";
    if (here.depot) return `${here.name} has a depot already`;
  }
  if (convoy) {
    const to = S.worlds[convoy.to], n = Math.floor(+convoy.supply);
    if (!(n >= 1 && n <= CONVOY.max)) return `a convoy carries 1 to ${CONVOY.max} supply`;
    if (here.owner !== p.faction || !(here.capital || here.depot)) return "convoys leave from your capital or a depot";
    if (!to || to.owner !== p.faction || !to.depot || to.id === here.id) return "a convoy goes to another depot of yours";
    if (!route(S, p.faction, here.id, to.id)) return `no way to ${to.name} through your own worlds`;
  }
  return null;
}
// the shortest way from one world to another through the faction's own
function route(S, f, from, to) {
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const at = q.shift();
    if (at === to) { const path = []; for (let s = to; s !== from; s = prev[s]) path.unshift(s); return path; }
    for (const n of S.worlds[at].links) if (!(n in prev) && S.worlds[n].owner === f) { prev[n] = at; q.push(n); }
  }
  return null;
}
// at the tick: a depot paid for from the warband's share, a convoy loaded from the depot or the stockpile
function orders(S, p, o, mine, H) {
  const wb = p.warband, here = S.worlds[wb.at], st = S.factions[p.faction].stock;
  if (o.build === "depot" && !checkOrder(S, p, { build: "depot" })) {
    if (Math.min(st.materiel, mine.materiel ?? st.materiel) >= DEPOT.cost) { st.materiel -= DEPOT.cost; if (mine.materiel != null) mine.materiel -= DEPOT.cost; here.depot = { supply: 0 }; wb.history.push(`Turn ${S.turn}: built a depot at ${here.name}`); }
    else wb.history.push(`Turn ${S.turn}: couldn't build a depot at ${here.name}: ${DEPOT.cost} materiel needed from your share`);
  }
  if (o.convoy && !checkOrder(S, p, { convoy: o.convoy })) {
    const from = here.depot && !here.capital ? here.depot : null, have = from ? from.supply : Math.min(st.supply, mine.supply ?? st.supply);
    const n = Math.min(Math.floor(o.convoy.supply), Math.floor(have));
    if (n < 1) { wb.history.push(`Turn ${S.turn}: no supply to send from ${here.name}`); return; }
    if (from) from.supply -= n; else { st.supply -= n; if (mine.supply != null) mine.supply -= n; }
    const to = S.worlds[o.convoy.to];
    S.convoys.push({ id: `c${S.turn}-${p.id}-${S.convoys.length}`, faction: p.faction, player: p.id, at: here.id, to: to.id, supply: n });
    wb.history.push(`Turn ${S.turn}: sent a convoy of ${n} supply from ${here.name} to ${to.name}`);
    H.note(S, `A ${FACTIONS[p.faction].name.replace(/^The /, "")} convoy sets out from ${here.name} for ${to.name}`);
  }
}

// ---- convoys: a jump a turn along their own worlds; taken by a raiding warband on or beside a world they pass,
// unless a warband of theirs is with them; unloaded at the depot
function convoys(S, H, T) {
  for (const c of S.convoys) {
    if (c.done) continue;
    const here = S.worlds[c.at];
    if (here.owner !== c.faction) { c.done = true; H.note(S, `A convoy is lost at ${here.name}`); continue; }
    const path = route(S, c.faction, c.at, c.to);
    if (!path) continue;   // waits for a way to open
    if (path.length) c.at = path[0];
    const w = S.worlds[c.at];
    const escort = Object.values(S.players).some(p => p.faction === c.faction && p.warband.at === w.id && H.total(p.warband.army));
    const raider = !escort && Object.values(S.players).find(p => p.faction !== c.faction && p.warband.stance === "raid" && H.total(p.warband.army) && (p.warband.at === w.id || w.links.includes(p.warband.at)));
    if (raider) {
      const got = Math.floor(c.supply / 2);
      if (S.factions[raider.faction].stock.supply != null) S.factions[raider.faction].stock.supply += got;
      raider.warband.history.push(`Turn ${S.turn}: took a convoy at ${w.name}: ${got} supply`);
      const owner = S.players[c.player]; if (owner) owner.warband.history.push(`Turn ${S.turn}: your convoy was taken at ${w.name}`);
      H.note(S, `${raider.name} takes a convoy at ${w.name}`);
      c.done = true; continue;
    }
    if (c.at === c.to) {
      const d = w.depot;
      if (T) T.delivered.push({ player: c.player, world: w.id, n: c.supply });   // for contracts
      if (d) { const put = Math.min(c.supply, DEPOT.cap - d.supply); d.supply += put; const owner = S.players[c.player]; if (owner) owner.warband.history.push(`Turn ${S.turn}: a convoy reached ${w.name} with ${c.supply} supply${put < c.supply ? ` (the depot took ${put})` : ""}`); }
      c.done = true;
    }
  }
  S.convoys = S.convoys.filter(c => !c.done);
}

// ---- eating: each warband eats a supply a turn per ten soldiers, from a depot on or beside its world first, then its
// share of the stockpile. One fed from a depot counts as in supply even far from home. Returns nothing; sets
// wb.eats, wb.short and wb.depotFed
function eat(S, H) {
  // shares weighted as the stockpile's are (the Warmaster's priority draws double)
  const share = {};
  for (const f of Object.keys(S.factions)) {
    if (!isPlayerFaction(f)) continue;
    const n = Object.values(S.players).filter(p => p.faction === f && H.total(p.warband.army)).reduce((a, p) => a + H.weight(S, p), 0);
    share[f] = n ? S.factions[f].stock.supply / n : 0;
  }
  for (const p of Object.values(S.players)) {
    const wb = p.warband, want = need(wb.army);
    wb.eats = want; wb.short = false; wb.depotFed = false;
    if (!want) continue;
    let got = 0;
    const here = S.worlds[wb.at];
    const depots = [here, ...here.links.map(n => S.worlds[n])].filter(w => w.owner === p.faction && w.depot && w.depot.supply > 0).sort((a, b) => b.depot.supply - a.depot.supply);
    for (const d of depots) { const t = Math.min(want - got, d.depot.supply); d.depot.supply -= t; got += t; if (t) wb.depotFed = true; if (got >= want) break; }
    if (got < want && wb.supplied) { const st = S.factions[p.faction].stock, t = Math.min(want - got, share[p.faction] * H.weight(S, p), st.supply); st.supply -= t; got += t; }
    // then its own treasury, wherever it is
    if (got < want) got += (want - got) - H.fromTreasury(p, "supply", want - got);
    if (got + 1e-9 < want) { wb.short = true; wb.history.push(`Turn ${S.turn}: short of supply: ate ${Math.floor(got)} of ${want}`); }
  }
}

// ---- blockades at the end of the tick: no income (see income), the garrison starves unless a depot feeds it, and a
// Hegemony world's loyalty falls
function blockades(S, H, R) {
  for (const w of Object.values(S.worlds)) {
    if (!blockaded(S, w, H)) { w.blockaded = false; continue; }
    if (!w.blockaded) H.note(S, `${w.name} is blockaded`);
    w.blockaded = true;
    // (every garrison of its holder's on the world)
    const held = w.regions.filter(r => r.owner === w.owner), want = Math.ceil(held.reduce((a, r) => a + H.total(r.garrison), 0) / EAT);
    if (w.depot && w.depot.supply >= want) { w.depot.supply -= want; }
    else if (want) for (const r of held) r.garrison = H.cut(r.garrison, STARVE, R);
    if (w.owner === "hegemony" && w.loyalty != null) w.loyalty = Math.max(0, w.loyalty - BLOCKADE_LOYALTY);
  }
}
// a battle side's supply: x0.8 if any warband of it is short or out of supply
const sideFactor = (S, parts) => parts.some(x => x.kind === "warband" && (S.players[x.player].warband.short || !S.players[x.player].warband.supplied)) ? SHORT : 1;
const sideShort = (S, parts) => sideFactor(S, parts) < 1;

module.exports = { setup, income, noIncome, checkOrder, orders, convoys, eat, blockades, sideFactor, sideShort, blockaded, route, DEPOT, CONVOY, WASTE_AFTER, SHORT };
