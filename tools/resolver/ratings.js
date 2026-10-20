// Writes game/world/ratings.json: each template's ratings for Tactical Mass Combat (docs/setting.md), so the war
// needs no engine to fight its battles. SCER (cer.js, uncapped): an OR for fire combat (its gun), an OR for close
// combat (its hand weapon), its PR; and the Mass Combat classes and mobility worked out from the same data.
//   node tools/resolver/ratings.js
const fs = require("fs"), path = require("path");
const { rate } = require("./cer.js");
const { engineCommit } = require("./common.js");
const YARDS = 20;   // a hex
// Recon: the stealthy and the scouts; C3I: those who command or link others
const RECON = /Kommando|Scout|Ranger|Pathfinder|Lictor|Ravener|Mandrake|Vanguard|Deathmark/;
const C3I = /Sergeant|Commissar|Champion|Nob\b|Lord|Overlord|Exarch|Shas'ui|Warboss|Tyranid Warrior/;
function ratingOf(template) {
  const r = rate(template), u = r.unit, f = u.flags || {}, s = r.scaled, w = u.ranged;
  return {
    or: s.OR, orFire: s.orFire, orClose: s.orClose, pr: s.PR, scer: s.SCER, cer: r.CER,
    classes: {
      fire: !!w,
      armor: s.dr >= 60,
      neutralizeArmor: !!w && (w.dmg.div || 1) >= 3,
      artillery: !!w && (w.blast > 0 || !!w.indirect),
      recon: RECON.test(template) || !!f.chameleon,
      c3i: C3I.test(template) || !!f.synapse,
    },
    mobility: u.move >= 10 ? "mounted" : "foot",
    // fire range in hexes: the gun's half-damage range
    range: w ? Math.max(2, Math.min(40, Math.round((w.range.half || 100) / YARDS))) : 0,
    night: (f.nightVision || 0) >= 3 || !!f.infravision || !!f.machine,
    impetuous: !!(f.impulsive || f.bloodlust),
    fanatic: (f.fearless || 0) >= 6 || !!f.unfazeable || !!f.noMorale,
    elite: !!u.elite,
    getsHot: !!w && !!w.overheat,   // (plasma: it can cook its wielder)
    synapse: !!f.synapse,
    reanimates: !!f.reanimation,
    weapon: w ? w.name : null, hand: u.melee ? u.melee.name : null,
  };
}
if (require.main === module) {
  const roster = require("./roster.json").templates.filter(t => !/\(linked\)/.test(t));
  const out = { meta: { engine: engineCommit(), hex: YARDS, made: new Date().toISOString().slice(0, 10), from: "tools/resolver/ratings.js" }, templates: {} };
  for (const t of roster) out.templates[t] = ratingOf(t);
  fs.writeFileSync(path.join(__dirname, "..", "..", "game", "world", "ratings.json"), JSON.stringify(out, null, 1) + "\n");
  for (const [t, x] of Object.entries(out.templates)) console.log(t.padEnd(32), `fire ${String(x.orFire).padStart(5)} close ${String(x.orClose).padStart(5)} PR ${String(x.pr).padStart(5)}  range ${String(x.range).padStart(2)}  ${x.mobility.padEnd(7)} ${Object.entries(x.classes).filter(([, v]) => v).map(([k]) => k).join(",")}${x.impetuous ? " impetuous" : ""}${x.fanatic ? " fanatic" : ""}${x.night ? " night" : ""}${x.getsHot ? " hot" : ""}`);
}
module.exports = { ratingOf };
