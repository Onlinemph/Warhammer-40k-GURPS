// Veterans and leaders (docs/setting.md): most of a warband is a number, but the soldiers who live through battles
// get names, ranks and scars, the dead get a last letter home, and the warband has a leader who can fall. Worked out
// at the tick from the log; the tick's dice (`R`) are the only randomness. Called from rules.js.
const { UNITS } = require("./units.js");

const MAX_NAMED = 12, SCAR = 0.3, LEADER = { base: 0.10, top: 0.20, perWin: 0.01, risk: 0.5 };
const RANKS = [[10, "Legend"], [6, "Hardened"], [3, "Veteran"], [1, "Blooded"]];
const rankOf = battles => (RANKS.find(([n]) => battles >= n) || [0, "Recruit"])[1];
const rankLevel = battles => battles >= 10 ? 4 : battles >= 6 ? 3 : battles >= 3 ? 2 : battles >= 1 ? 1 : 0;
// what a named soldier adds to their side in the resolver: a tenth of a soldier of their type a battle, up to double
const worth = n => Math.min(1, n.battles / 10);
const pick = (R, list) => list[Math.floor(R() * list.length)];

// ---- names, each faction its own
const NAMES = {
  hegemony: {
    first: ["Ansel", "Brannoc", "Corvin", "Darra", "Edrik", "Feyna", "Galen", "Hesk", "Ilsa", "Joram", "Kestrel", "Lucan", "Mara", "Nils", "Orrin", "Petra", "Quill", "Roswen", "Sabine", "Tobin", "Ulla", "Varga", "Wendel", "Yara"],
    last: ["Varga", "Holt", "Kessan", "Morrow", "Dray", "Ostrin", "Vell", "Carrow", "Tamsin", "Brask", "Leutz", "Harrow", "Silvane", "Rook", "Danek", "Marsh", "Corran", "Steel", "Abend", "Keel"],
    name: (R, N) => `${pick(R, N.first)} ${pick(R, N.last)}`,
  },
  apostates: {
    first: ["Mirel", "Asch", "Velka", "Corse", "Ilun", "Seth", "Ravia", "Tarn", "Oskel", "Neva", "Garran", "Lysse", "Hekat", "Brim", "Sorrel", "Venn"],
    epithet: ["the Unbound", "the Opened", "Who Listens", "the Hollow-Eyed", "of the Second Edict", "the Whisperer", "the Bargained", "the Lit", "Thrice-Promised", "the Unforgiven", "the Unsleeping", "Who Was Heard"],
    name: (R, N) => `${pick(R, N.first)} ${pick(R, N.epithet)}`,
  },
  brawl: {
    first: ["Gutsnag", "Rokk", "Snazza", "Grub", "Mogg", "Drekk", "Skarn", "Bonk", "Zogga", "Hruk", "Narg", "Krumpa", "Blort", "Urk", "Skab", "Gorbo"],
    epithet: ["Ironjaw", "Bigmouth", "Two-Fists", "the Loud", "Teefgrinder", "Skullkicker", "Oneye", "the Champ", "Stompa", "Redknuckle", "Krunchface", "the Unbeaten"],
    name: (R, N) => `${pick(R, N.first)} ${pick(R, N.epithet)}`,
  },
};
const HOW = ["first over the wall at %w", "held the line at %w when the rest broke", "dragged two of the fallen out of the fire at %w", "took the enemy's banner at %w", "kept firing at %w with the squad dead around them", "led the last charge at %w", "brought the wounded home from %w", "was the only one of their squad to walk off the field at %w"];
const SCARS = ["lost an eye", "a crude augmetic arm", "the shakes", "a ruined leg, held together with wire", "burns down one side", "deaf in one ear", "a skull plate", "a hand that won't close"];
const LETTER = {
  hegemony: {
    open: ["To my mother on %h,", "To whoever reads this on %h,", "Dear sister,", "To Father, on %h,"],
    body: ["We fought at %w today. It was not like the drills.", "The edict sends us to %w. I am told it is an honour.", "I have been %t times in the line now. They call me %r.", "They say the Founder watches. I hope he watched us at %w."],
    scar: ["Do not worry about the %s. It hardly hurts now.", "I have %s. The surgeon says I was lucky."],
    close: ["Light a candle at the shrine for me. Your %n.", "Keep the house. I will come home. %n.", "If this reaches you, I was proud. %n."],
  },
  apostates: {
    open: ["To those who still kneel on %h,", "Brother, if you still call me that,", "To my old company,"],
    body: ["We opened the door at %w and something answered.", "I have been %t times in the fire. They call me %r, and the voices agree.", "At %w the old edicts burned, and so did we."],
    scar: ["The %s was a gift. Everything is a gift now.", "I paid with %s. It was cheap."],
    close: ["Open the edict. You will understand. %n.", "Do not grieve. I was heard. %n.", "It is listening. It was always listening. %n."],
  },
  brawl: {
    open: ["Oi, ladz back on %h,", "Ta da boss,", "Fer da big mob,"],
    body: ["We had a propa scrap at %w.", "%t fights now. Dey call me %r, coz I'm da best.", "At %w dey had big gunz. We had bigger mouths."],
    scar: ["Got %s. Looks propa killy.", "Dat %s don't bovver me."],
    close: ["Tell 'em I went down swingin'. %n.", "Save me a seat at da next one. %n.", "WAAAGH. %n."],
  },
};
function letter(R, f, n, w) {
  const L = LETTER[f], fill = s => s.replace(/%h/g, n.home).replace(/%w/g, w).replace(/%t/g, String(n.battles)).replace(/%r/g, rankOf(n.battles)).replace(/%s/g, n.scars[0] || "").replace(/%n/g, n.name);
  return [pick(R, L.open), pick(R, L.body), ...(n.scars.length ? [pick(R, L.scar)] : []), pick(R, L.close)].map(fill).join(" ");
}

// ---- a warband's people
function joined(S, p) {
  const at = S.worlds[p.warband.at];
  p.warband.named = []; p.warband.memorial = [];
  p.warband.leader = { name: p.name, unit: null, home: at.name, joined: S.turn, battles: 3, wins: 0, scars: [], how: "raised the warband" };
}
const leaderBonus = wb => wb.leader ? 1 + Math.min(LEADER.top, LEADER.base + LEADER.perWin * wb.leader.wins) : 1;
// the extra worth a side's named soldiers bring to the resolver: per unit type, whole soldiers
function extraOf(S, parts) {
  const ex = {};
  for (const part of parts) if (part.kind === "warband") for (const n of S.players[part.player].warband.named) ex[n.unit] = (ex[n.unit] || 0) + worth(n);
  for (const k of Object.keys(ex)) ex[k] = Math.round(ex[k]);
  return ex;
}
// a side's leader bonus in a battle: its best leader present
const sideLeader = (S, parts) => Math.max(1, ...parts.filter(x => x.kind === "warband").map(x => leaderBonus(S.players[x.player].warband)));

// ---- after a battle: each warband part's named live or die, the living are named or scarred, the leader may fall.
// `was` and `now` are its army before and after; returns the names of the fallen, for the report
function afterBattle(S, w, part, was, now, won, lost, lossShare, R) {
  const p = S.players[part.player], wb = p.warband, fallen = [];
  // the named die as any of their type: the share of that type lost (all of them, if their type is gone)
  for (const n of [...wb.named]) {
    const before = was[n.unit] || 0, after = now[n.unit] || 0;
    if (R() < (before ? 1 - after / before : 1)) { die(S, p, n, w.name, R); fallen.push(n.name); continue; }
    n.battles++;
    if (lossShare >= 0.5 && R() < SCAR) {
      const s = pick(R, SCARS.filter(x => !n.scars.includes(x)));
      n.scars.push(s);
      if (n.scars.length >= 2) { retire(S, p, n, s); continue; }
    }
  }
  // the leader
  const L = wb.leader;
  if (L) {
    if (lost && R() < LEADER.risk * Math.max(lossShare, 0.3)) { fallen.push(L.name); die(S, p, L, w.name, R, true); succeed(S, p, R); }
    else { L.battles++; if (won) L.wins++; }
  }
  // a win or a held field names up to two survivors (one if it was costly), up to twelve
  if (!lost) {
    let k = Math.min(lossShare > 0.5 ? 1 : 2, MAX_NAMED - wb.named.length);
    while (k-- > 0) {
      const pool = Object.entries(wb.army).map(([u, c]) => [u, c - wb.named.filter(n => n.unit === u).length]).filter(([, c]) => c > 0);
      const tot = pool.reduce((a, [, c]) => a + c, 0);
      if (!tot) break;
      let x = R() * tot, u = pool[0][0];
      for (const [t, c] of pool) { if ((x -= c) < 0) { u = t; break; } }
      const N = NAMES[p.faction], n = { name: N.name(R, N), unit: u, home: wb.home || S.worlds[S.factions[p.faction].capital]?.name || w.name, joined: S.turn, battles: 1, scars: [], how: pick(R, HOW).replace("%w", w.name) };
      if (wb.named.some(m => m.name === n.name) || wb.leader?.name === n.name) continue;
      wb.named.push(n);
      wb.history.push(`Turn ${S.turn}: ${n.name} (${UNITS[u].name}) ${n.how}`);
    }
  }
  return fallen;
}
function die(S, p, n, where, R, isLeader = false) {
  const wb = p.warband;
  wb.named = wb.named.filter(m => m !== n);
  wb.memorial.push({ name: n.name, unit: n.unit, rank: rankOf(n.battles), battles: n.battles, fell: where, turn: S.turn, leader: isLeader || undefined, scars: n.scars, how: n.how, letter: letter(R, p.faction, n, where) });
  wb.history.push(`Turn ${S.turn}: ${isLeader ? "the warband's leader " : ""}${n.name} fell at ${where}`);
}
function retire(S, p, n, s) {
  const wb = p.warband;
  wb.named = wb.named.filter(m => m !== n);
  if (wb.army[n.unit]) wb.army[n.unit]--;
  wb.memorial.push({ name: n.name, unit: n.unit, rank: rankOf(n.battles), battles: n.battles, retired: true, turn: S.turn, scars: n.scars, how: n.how });
  wb.history.push(`Turn ${S.turn}: ${n.name} went home with ${s}, their second wound`);
}
// a fallen leader's place goes to the warband's most battle-hardened, or to someone new
function succeed(S, p, R) {
  const wb = p.warband, best = wb.named.slice().sort((a, b) => b.battles - a.battles)[0];
  if (best) { wb.named = wb.named.filter(m => m !== best); wb.leader = { ...best, wins: 0 }; wb.history.push(`Turn ${S.turn}: ${best.name} takes command`); return; }
  const N = NAMES[p.faction];
  wb.leader = { name: N.name(R, N), unit: null, home: S.worlds[p.warband.at].name, joined: S.turn, battles: 1, wins: 0, scars: [], how: "stepped up when no one else would" };
  wb.history.push(`Turn ${S.turn}: ${wb.leader.name} takes command`);
}
// at the end of the tick: a warband with fewer of a type than it has named of it (hunger, desertion, infighting)
// loses those named too
function reconcile(S, R) {
  for (const p of Object.values(S.players)) {
    const wb = p.warband;
    if (!wb.named) continue;
    for (const u of new Set(wb.named.map(n => n.unit))) {
      const of = wb.named.filter(n => n.unit === u), have = wb.army[u] || 0;
      for (const n of of.slice(have)) die(S, p, n, S.worlds[wb.at].name, R);
    }
  }
}
// what the replay needs: each named soldier as their own figure, with their rank (and scars) on their skills
const forReplay = wb => (wb.named || []).map(n => ({ name: n.name, unit: n.unit, bonus: rankLevel(n.battles) - n.scars.length }));

module.exports = { joined, leaderBonus, extraOf, sideLeader, afterBattle, reconcile, forReplay, rankOf, rankLevel, MAX_NAMED };
