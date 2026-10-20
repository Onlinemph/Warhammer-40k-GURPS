// Combat Effectiveness Rating (Christopher R. Rice, "It's a Threat!", Pyramid 3/77 pp. 29-33) for the engine's unit
// templates: an Offensive Rating (OR) from the best attack, a Protective Rating (PR) from defences, armour and
// toughness, CER = OR + PR. Worked from the same data the engine fights with (SIM.buildUnit). Where the article
// counts a trait by its point cost, the engine's flags are priced by the Basic Set costs noted beside each.
//   node tools/resolver/cer.js [template...]       (no arguments: the whole roster)
const { SIM, unitSpec, DATA } = require("./common.js");
// the traits a template's write-up lists that the engine doesn't carry as flags but CER counts: found in the codex's
// trait tree by name, or by what a trait is "modelled as" (the Astartes' Secondary Heart is Hard to Kill 2)
const TEMPLATES = (() => { const out = {}; const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.traits && o.name && o.stats) out[o.name] = o; Object.values(o).forEach(walk); } }; walk(DATA.libraries); return out; })();
function extraTraits(template) {
  const t = TEMPLATES[template], x = { htk: 0, rapidHealing: 0, recovery: 0, fit: 0, unfazeable: 0, hts: 0 };
  if (!t) return x;
  const walk = n => {
    const text = `${n.name} ${typeof n.feat === "string" ? n.feat : ""} ${typeof n.design === "string" ? n.design : ""}`;
    let m;
    if ((m = /Hard to Kill (\d+)/.exec(text))) x.htk = Math.max(x.htk, +m[1]);
    if ((m = /Hard to Subdue (\d+)/.exec(text))) x.hts = Math.max(x.hts, +m[1]);
    if (/Rapid Healing|Very Rapid Healing/.test(text)) x.rapidHealing = 1;
    if (/^Recovery/.test(n.name)) x.recovery = 1;
    if (/^Very Fit/.test(n.name)) x.fit = 2; else if (/^Fit/.test(n.name)) x.fit = Math.max(x.fit, 1);
    if (/^Unfazeable/.test(n.name)) x.unfazeable = 1;
    (n.children || []).forEach(walk);
  };
  t.traits.forEach(walk);
  return x;
}

// Rapid Fire's bonus to skill (B373)
const rofBonus = r => r >= 25 ? 5 : r >= 17 ? 4 : r >= 13 ? 3 : r >= 9 ? 2 : r >= 5 ? 1 : 0;
// damage type, as the article weighs it (types it doesn't list count x1)
const TYPE = { "pi-": 0.5, pi: 1, "pi+": 1.5, cut: 1.5, "pi++": 2, imp: 2, cor: 2, fat: 2, cr: 1, burn: 1, tox: 1 };
// armour divisor steps (the article: +5 a step; Basic Set steps 2, 3, 5, 10, 100)
const adSteps = d => d >= 100 ? 5 : d >= 10 ? 4 : d >= 5 ? 3 : d >= 3 ? 2 : d >= 2 ? 1 : 0;

// one attack's worth: skill and damage parts of OR
function attack(w, ranged, u) {
  if (!w) return null;
  const rb = ranged ? rofBonus(w.rof || 1) : 0, d = w.dmg;
  // (a flame cone counts as the article's attack that hits automatically, +15: it washes over whoever is in it)
  let skill = w.level - 10 + rb + (ranged ? (w.acc ?? 3) + 2 : 0) + ((u.flags.extraAttack || 0) ? 5 : 0) + (w.cone ? 15 : 0);
  const dice = d.n * (d.mult || 1);
  let dmg = Math.ceil(dice * 3.5) + (d.add || 0) * (d.mult || 1);
  dmg = Math.ceil(dmg * (rb + 1));
  dmg = Math.ceil(dmg * ((TYPE[d.type] ?? 1) + (d.ex ? 0.5 : 0))) + 5 * adSteps(d.div || 1);
  return { name: w.name, text: w.text, skill, dmg, total: skill + dmg };
}
// `extra`: spec fields laid over the template's own (a different gun: { ranged: { item } })
function rate(template, extra = {}) {
  const u = SIM.buildUnit(unitSpec(template, 1, 0, extra).spec, 0), f = u.flags || {}, st = u.stats;
  // OR: the better of its gun and its hand weapon, then FP and Move
  // psychic powers count as the article's FP-using abilities: their score halved
  const powers = (u.powers || []).filter(p => p.dmg && p.dmg.n).map(p => { const a = attack(p, true, u); return { ...a, skill: Math.floor(a.skill / 2), dmg: Math.ceil(a.dmg / 2), total: Math.floor(a.skill / 2) + Math.ceil(a.dmg / 2), power: true, range: p.range }; });
  const bestPower = powers.sort((a, b) => b.total - a.total)[0];
  const best = [attack(u.ranged, true, u), attack(u.melee, false, u), bestPower].filter(Boolean).sort((a, b) => b.total - a.total)[0];
  const fp = (u.fp ?? st.fp) - 10, move = u.move - 6;
  const OR = Math.max(1, best.total + fp + move);
  // PR: active defence (Dodge, or Parry/Block if better), DR over head, arms, legs and torso, health, HP, Will
  const ad = Math.max(2 * (u.dodge - 8), (u.parry || 0) - 8, u.shield ? (u.block || 0) - 8 : -99) + (u.db || 0);
  const nat = loc => (u.nat.all || 0) + (u.nat[loc] || 0);
  const dr = loc => (u.arm.dr[loc] || 0) + nat(loc);
  let drs = Math.ceil((dr("skull") + dr("arm") + dr("leg") + dr("torso")) / 4);
  // SCER (the user's Scaled CER, scer-handoff.md, change 1): DR weighted by where hits land, half on the weakest spot
  const locs = [dr("skull"), dr("arm"), dr("leg"), dr("torso")], weighted = locs[0] * 0.15 + locs[1] * 0.15 + locs[3] * 0.5 + locs[2] * 0.2;
  let drw = Math.ceil(weighted * 0.5 + Math.min(...locs) * 0.5);
  // traits by their points, 1 a 5: Damage Reduction (/2 50, /3 100, /4 150), Injury Tolerance (Unliving 20, No
  // Vitals 5, No Blood 5), Regeneration (Slow 10, Regular 25, Fast 50, Very Fast 100), reanimation as Unkillable 1
  // (50); Supernatural Durability isn't in the flags
  const pts = (f.dmgRed ? 50 * (f.dmgRed - 1) : 0) + (f.unliving ? 20 : 0) + (f.novitals ? 5 : 0) + (f.noblood ? 5 : 0)
    + (f.regen ? (f.regen >= 1 ? 100 : f.regen >= 1 / 60 ? 25 : 10) : 0) + (f.reanimation ? 50 : 0);
  drs += Math.ceil(pts / 5); drw += Math.ceil(pts / 5);
  const X = extraTraits(template);
  const health = (u.HT ?? st.ht) - 10 + X.fit + Math.ceil(Math.max(f.htk || 0, X.htk) / 2) + Math.ceil(X.hts / 2) + (f.hpt ? 2 : 0) + (X.recovery ? 2 : 0);
  // (Rapid Healing 5 points, Very Rapid Healing 15: 1 a 5 to HP; Recovery's 10 points likewise)
  const hp = u.HP - 10 + (X.rapidHealing ? 1 : 0) + (X.recovery ? 2 : 0);
  const will = (u.will ?? st.will) - 10 + Math.ceil((f.fearless || 0) / 2) + (f.cr ? 1 : 0) + (f.unfazeable || X.unfazeable || f.noMorale ? 8 : 0);
  const PR = Math.max(1, ad + drs + health + hp + will);
  // SCER: each sub-score through its curve (changes 2-4), the soft cap, and the synergy of lethal and hard to kill
  const sOR = Math.max(1, Math.round(scaleSkill(best.skill) + scaleDamage(best.dmg) + fp + move));
  // (each attack on its own, for Tactical Mass Combat: fire combat uses the gun's, close combat the hand weapon's)
  const sOf = a => a ? Math.max(1, Math.round(scaleSkill(a.skill) + scaleDamage(a.dmg) + fp + move)) : 0;
  const gun = attack(u.ranged, true, u), fireAtt = [gun, bestPower].filter(Boolean).sort((a, b) => b.total - a.total)[0];
  const orFire = sOf(fireAtt), orClose = sOf(attack(u.melee, false, u));
  const sPR = Math.max(1, Math.round(scaleDefense(ad) + scaleDR(drw) + scaleHT(health) + scaleHP(hp) + scaleWill(will)));
  const syn = sOR > 0 && sPR > 0 ? Math.round(Math.sqrt(sOR * sPR) * 0.2) : 0;
  return { template, OR, PR, CER: OR + PR, best: best.name, parts: { skill: best.skill, damage: best.dmg, fp, move, defence: ad, dr: drs, health, hp, will },
    scaled: { OR: sOR, PR: sPR, synergy: syn, SCER: Math.max(1, sOR + sPR + syn), dr: drw, orFire, orClose }, unit: u, firePower: fireAtt && fireAtt.power ? fireAtt : null };
}
// SCER's curves (scer-handoff.md section 5): signs kept, a soft cap past 500
// (the handoff caps at 500; this setting's damage and DR run five to ten times Dungeon Fantasy's, so it isn't capped here:
// SCER_CAP=500 gives the handoff's own)
const CAP = +(process.env.SCER_CAP || Infinity), softCap = x => Math.abs(x) <= CAP ? x : Math.sign(x) * CAP * (1 + Math.log(Math.abs(x) / CAP));
const pw = (x, e) => x >= 0 ? Math.pow(x, e) : -Math.pow(-x, e);
const scaleSkill = x => softCap(x + x * x / 7 * Math.sign(x)), scaleDamage = x => softCap(pw(x, 1.5)), scaleDR = x => softCap(pw(x, 1.75));
const scaleDefense = x => softCap(x * (1 + Math.abs(x) / 5)), scaleHP = x => softCap(pw(x, 1.2)), scaleHT = scaleHP, scaleWill = scaleHP;
module.exports = { rate };
if (require.main === module) {
  const list = process.argv.slice(2).length ? process.argv.slice(2) : require("./roster.json").templates.filter(t => !/\(linked\)/.test(t));
  for (const t of list) { const r = rate(t); console.log(`${t.padEnd(32)} OR ${String(r.OR).padStart(4)}  PR ${String(r.PR).padStart(4)}  CER ${String(r.CER).padStart(4)}   ${r.best}  ${JSON.stringify(r.parts)}`); }
}
