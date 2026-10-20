// Rules assertions: the engine's tables and formulas against the Basic Set, the user's house rules and the anchors
// in docs/framework.md. Run `node --test tools/sim/test/*.test.js` after `python3 tools/build_site.py` (the data comes from
// the built site). A failure here means the engine, the data or the doc has drifted; fix whichever is wrong.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const SIM = require("../load.js");
const { assemble } = require("../assemble.js");

const html = fs.readFileSync(path.join(__dirname, "..", "..", "..", "site", "index.html"), "utf8");
const DATA = JSON.parse(html.slice(html.indexOf("const DATA = ") + 13, html.indexOf(";\nconst LIBS")));
SIM.index(DATA);
const R = SIM.rules;
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: got ${got}, want ${want} ± ${tol}`);

// exact chance that a weapon's damage gets through DR (B378: DR divided by the armour divisor, rounded down)
function dice(n) {
  let d = new Map([[0, 1]]);
  for (let i = 0; i < n; i++) { const e = new Map(); for (const [s, p] of d) for (let f = 1; f <= 6; f++) e.set(s + f, (e.get(s + f) || 0) + p / 6); d = e; }
  return d;
}
function penChance(text, dr) {
  const dm = SIM.parseDamage(text), eff = dm.div === Infinity ? 0 : Math.floor(dr / dm.div);
  let p = 0;
  for (const [s, q] of dice(dm.n)) if (Math.floor(Math.max(dm.type === "cr" ? 0 : 1, s + dm.add) * dm.mult) > eff) p += q;
  return 100 * p;
}
const damageOf = (item, usage = "") => {
  const e = SIM.equipment.get(item);
  assert.ok(e, `no equipment called ${item}`);
  const w = e.e.weapons.find(x => x.usage.includes(usage));
  assert.ok(w, `${item} has no "${usage}" line`);
  return w.damage;
};
const armour = item => { assert.ok(SIM.equipment.get(item), `no armour called ${item}`); return R.armourProfile([item]); };

test("the site carries the engine exactly as tools/sim assembles it", () => {
  assert.ok(html.includes(assemble().code), "site/index.html is stale or build_site.py assembles differently: run python3 tools/build_site.py");
});

test("3d success rolls (B343, B347-348)", () => {
  assert.equal(R.P3[10], 108 / 216);
  assert.equal(R.P3[12], 160 / 216);
  assert.equal(R.P3[16], 212 / 216);
  assert.equal(R.P3[17], R.P3[16], "17 always fails");
  assert.equal(R.P3[18], R.P3[16], "18 always fails");
  assert.equal(R.P3[3], 4 / 216, "3 and 4 always succeed");
  const cases = [
    // roll, skill, ok, critical success, critical failure
    [3, 3, true, true, false], [4, 3, true, true, false], [5, 14, true, false, false], [5, 15, true, true, false],
    [6, 15, true, false, false], [6, 16, true, true, false], [10, 10, true, false, false], [11, 10, false, false, false],
    [16, 20, true, false, false], [17, 20, false, false, false], [17, 15, false, false, true], [18, 25, false, false, true],
    [14, 5, false, false, false], [15, 5, false, false, true],
  ];
  for (const [r, l, ok, crit, fumble] of cases) {
    const j = R.judge(r, l);
    assert.deepEqual([j.ok, j.crit, j.fumble], [ok, crit, fumble], `roll ${r} against ${l}`);
    assert.equal(j.margin, l - r);
  }
});

test("damage notation", () => {
  for (const t of ["pi-", "pi", "pi+", "pi++", "imp", "cut", "cr", "burn", "cor", "tox"]) assert.equal(SIM.parseDamage(`3d ${t}`).type, t, t);
  assert.deepEqual(pick(SIM.parseDamage("6dx2(2) pi++")), { n: 6, add: 0, mult: 2, div: 2, type: "pi++", ex: false });
  assert.deepEqual(pick(SIM.parseDamage("sw+3d+1(10) cut", "3d", "5d+2")), { n: 8, add: 3, mult: 1, div: 10, type: "cut", ex: false });
  assert.deepEqual(pick(SIM.parseDamage("thr+8d(10) cr", "3d", "5d+2")), { n: 11, add: 0, mult: 1, div: 10, type: "cr", ex: false });
  assert.deepEqual(pick(SIM.parseDamage("1d-1 cr")), { n: 1, add: -1, mult: 1, div: 1, type: "cr", ex: false });
  const frag = SIM.parseDamage("4d cr ex [2d cut]");
  assert.equal(frag.ex, true); assert.deepEqual(frag.frag, { n: 2, type: "cut" });
  assert.equal(SIM.parseDamage("6d (ignores DR) burn").div, Infinity);
  assert.equal(SIM.parseDamage("special spec"), null);
  // B378: crushing can do 0, anything else at least 1
  assert.equal(R.rollDamage({ n: 1, add: -6, mult: 1, type: "cr" }), 0);
  assert.equal(R.rollDamage({ n: 1, add: -6, mult: 1, type: "cut" }), 1);
});
function pick(d) { return { n: d.n, add: d.add, mult: d.mult, div: d.div, type: d.type, ex: d.ex }; }

test("damage from ST (B16)", () => {
  const rows = [[10, "1d-2", "1d"], [11, "1d-1", "1d+1"], [12, "1d-1", "1d+2"], [14, "1d", "2d"], [20, "2d-1", "3d+2"], [30, "3d", "5d+2"],
    [40, "4d+1", "7d-1"], [50, "5d+2", "8d-1"], [100, "11d", "13d"], [110, "12d", "14d"], [130, "14d", "16d"]];
  for (const [st, thr, sw] of rows) assert.deepEqual(R.stDamage(st), { thr, sw }, `ST ${st}`);
});

test("range penalties (B550)", () => {
  const rows = [[1, 0], [2, 0], [3, -1], [5, -2], [7, -3], [10, -4], [11, -5], [20, -6], [30, -7], [50, -8], [100, -10], [150, -11], [1000, -16], [10001, -23]];
  for (const [yd, pen] of rows) assert.equal(R.rangePenalty(yd), pen, `${yd} yd`);
});

test("rapid fire bonus (B373)", () => {
  const rows = [[1, 0], [4, 0], [5, 1], [8, 1], [9, 2], [12, 2], [13, 3], [16, 3], [17, 4], [24, 4], [25, 5], [49, 5], [50, 6], [99, 6], [100, 7], [200, 8]];
  for (const [n, b] of rows) assert.equal(R.rapidBonus(n), b, `${n} shots`);
});

test("Progressive Recoil (house rule): round k at -k x Rcl", () => {
  assert.equal(R.rclPen({ rcl: 2 }, 0), 0, "the first round is free");
  assert.equal(R.rclPen({ rcl: 2 }, 3), 6);
  assert.equal(R.rclPen({ rcl: 3 }, 2, true), 4, "braced halves Rcl, rounding up");
  assert.equal(R.rclPen({ rcl: 1, rclFlat: true }, 4), 1, "true lasers (1L) take a flat -1");
  assert.equal(R.rclPen({ rcl: 3, mounted: true }, 3), 3, "a mount soaks recoil to -1 a round");
  near(R.burstHits(12, 3, { rcl: 2 }), R.P3[12] + R.P3[10] + R.P3[8], 1e-12, "expected hits of a 3-round burst");
});

test("wounding multipliers (B379, B398-400) and Injury Tolerance (B380)", () => {
  const none = {}, unl = { unliving: true }, hom = { homogenous: true }, nov = { novitals: true };
  const rows = [
    ["pi-", "torso", none, 0.5], ["pi", "torso", none, 1], ["pi+", "torso", none, 1.5], ["pi++", "torso", none, 2], ["imp", "torso", none, 2],
    ["cut", "torso", none, 1.5], ["cr", "torso", none, 1], ["burn", "torso", none, 1], ["cor", "torso", none, 1], ["tox", "torso", none, 1],
    ["pi", "skull", none, 4], ["cr", "skull", none, 4], ["tox", "skull", none, 1], ["pi", "eye", none, 4],
    ["pi-", "vitals", none, 3], ["pi++", "vitals", none, 3], ["imp", "vitals", none, 3], ["cr", "vitals", none, 1],
    ["cut", "neck", none, 2], ["cr", "neck", none, 1.5], ["cor", "neck", none, 1.5], ["cor", "face", none, 1.5],
    ["imp", "arm", none, 1], ["pi++", "leg", none, 1], ["pi+", "hand", none, 1], ["pi-", "foot", none, 0.5], ["cut", "arm", none, 1.5],
    ["pi-", "torso", unl, 0.2], ["pi", "torso", unl, 1 / 3], ["pi+", "torso", unl, 0.5], ["pi++", "torso", unl, 1], ["imp", "torso", unl, 1], ["cut", "torso", unl, 1.5],
    ["pi-", "torso", hom, 0.1], ["pi", "torso", hom, 0.2], ["pi+", "torso", hom, 1 / 3], ["pi++", "torso", hom, 0.5], ["imp", "torso", hom, 0.5],
    ["pi", "skull", hom, 0.2], ["pi", "vitals", nov, 1], ["imp", "vitals", nov, 2],
  ];
  for (const [type, loc, flags, m] of rows) near(SIM.woundMult(type, loc, flags, false), m, 1e-12, `${type} to the ${loc} ${JSON.stringify(flags)}`);
  assert.equal(SIM.woundMult("burn", "vitals", none, false), 2, "a tight beam to the vitals");
  assert.equal(SIM.woundMult("burn", "vitals", none, true), 1, "an explosion's burn isn't a tight beam");
});

test("random hit location (B552; the eye on a 1 in 6 face hit)", () => {
  const n = {};
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
    const r = a + b + c;
    if (r === 5) for (let e = 1; e <= 6; e++) { const l = R.locFor(r, e); n[l] = (n[l] || 0) + 1 / 6; }
    else { const l = R.locFor(r, 0); n[l] = (n[l] || 0) + 1; }
  }
  const want = { skull: 4, face: 5, eye: 1, leg: 61, arm: 46, torso: 52, groin: 27, hand: 10, foot: 6, neck: 4 };
  for (const [l, k] of Object.entries(want)) near(n[l], k, 1e-9, `${l} out of 216`);
});

test("hex geometry", () => {
  assert.equal(R.hexDist({ q: 0, r: 0 }, { q: 3, r: -1 }), 3);
  assert.equal(R.hexDist({ q: -2, r: 5 }, { q: 4, r: -1 }), 6);
  const line = R.lineHexes({ q: 0, r: 0 }, { q: 6, r: -2 });
  assert.equal(line.length, 5, "the hexes strictly between");
  [{ q: 0, r: 0 }, ...line, { q: 6, r: -2 }].reduce((a, b) => { assert.equal(R.hexDist(a, b), 1, "the line is unbroken"); return b; });
  assert.equal(R.arcOf({ q: 0, r: 0 }, 0, { q: 5, r: 0 }), "front");
  assert.equal(R.arcOf({ q: 0, r: 0 }, 0, { q: -5, r: 0 }), "rear");
});

test("armour anchors (docs/framework.md)", () => {
  const torso = item => R.drAt(armour(item).dr, "torso");
  assert.equal(torso("Flak Armour, Full Suit (Cadian Pattern)"), 30);
  assert.equal(torso("Carapace Armour, Guard Pattern"), 70);
  assert.equal(torso("Power Armour, Adepta Sororitas"), 85);
  assert.equal(torso("Power Armour, Mark X (Gravis Pattern)"), 130);
  assert.equal(torso("Tactical Dreadnought Armour, Indomitus Pattern"), 200);
  const mk7 = armour("Power Armour, Mark VII (Aquila Pattern)");
  assert.deepEqual(["torso", "arm", "leg", "neck", "skull", "face", "hand", "foot"].map(l => R.drAt(mk7.dr, l)), [100, 88, 88, 50, 100, 75, 50, 60]);
  assert.equal(mk7.gap.arm, 35, "a Weak Point in the arm faces DR 35");
  assert.equal(mk7.wp, 4);
  assert.equal(armour("Carapace Armour, Guard Pattern").wp, 5);
});

test("penetration against armour (docs/framework.md weapon and armour tables)", () => {
  const rows = [
    // weapon, line, DR, % that penetrates, what the doc says
    ["Lasgun, Kantrael Pattern", "Standard", 30, 97.8, "lasgun punches flak"],
    ["Lasgun, Kantrael Pattern", "Standard", 70, 0.6, "lasgun almost never beats carapace"],
    ["Hellgun", "", 70, 82.1, "hellgun beats carapace"],
    ["Boltgun, Godwyn Pattern", "", 70, 79.4, "bolter vs carapace"],
    ["Boltgun, Godwyn Pattern", "", 85, 45.4, "bolter vs Sororitas plate"],
    ["Boltgun, Godwyn Pattern", "", 100, 14.5, "bolter vs a Mk VII torso: about one in seven"],
    ["Boltgun, Godwyn Pattern", "", 88, 36.3, "bolter vs a Mk VII limb: about one in three"],
    ["Boltgun, Godwyn Pattern", "", 200, 0, "bolter vs Terminator plate"],
    ["Heavy Bolter", "", 100, 82.1, "heavy bolter vs a Mk VII torso"],
    ["Heavy Bolter", "", 185, 0, "heavy bolter vs AV11: not a tank killer"],
    ["Heavy Bolter", "", 200, 0, "heavy bolter vs Terminator plate"],
    ["Heavy Bolter", "", 125, 38.0, "heavy bolter chews light vehicles (AV10)"],
    ["Plasma Gun", "", 100, 99.9, "plasma kills Marines through power armour"],
    ["Plasma Gun", "", 200, 85.5, "plasma beats Terminators more often than not"],
    ["Meltagun", "Short", 440, 100, "melta kills AV14 at short range"],
    ["Meltagun", "Beyond", 250, 55.6, "melta past half range vs AV12"],
    ["Meltagun", "Beyond", 440, 0, "melta past half range vs AV14"],
    ["Meltagun", "Short", 1350, 87.0, "melta at short range vs a Leman Russ glacis"],
    ["Lascannon", "", 440, 100, "lascannon kills AV14"],
    ["Lascannon", "", 1350, 13.0, "lascannon vs a Leman Russ glacis: only lucky rolls"],
    ["Missile Launcher", "Krak", 250, 99.9, "krak vs AV12"],
    ["Missile Launcher", "Krak", 340, 99.0, "krak vs AV13"],
    ["Missile Launcher", "Krak", 440, 93.9, "krak is reliable against AV14"],
    ["Missile Launcher", "Krak", 1350, 0, "krak never beats a Leman Russ glacis"],
    ["Seeker Missile", "", 440, 93.9, "the T'au seeker missile is the krak anchor"],
    ["Autocannon", "", 185, 80.8, "the autocannon beats a Rhino (AV11)"],
    ["Autocannon", "", 250, 25.7, "the autocannon sometimes cracks a Chimera front (AV12)"],
    ["Autocannon", "", 340, 0.1, "the autocannon doesn't beat AV13"],
    ["Missile Pod", "", 185, 80.8, "the missile pod is autocannon class"],
    ["Bright Lance", "", 1350, 100, "a lance goes through even the glacis"],
    ["Dark Lance", "", 1350, 100, "the dark lance is the bright lance"],
    ["Eldritch Lance", "", 1350, 100, "the Eldritch lance ignores armour too"],
    ["Gauss Flayer", "", 100, 80.8, "gauss flayer vs a Mk VII torso"],
  ];
  for (const [item, usage, dr, pct, what] of rows) near(+penChance(damageOf(item, usage), dr).toFixed(1), pct, 0.05, what);
});

test("vehicles (docs/framework.md: AV to DR, HP from weight; B554 locations)", () => {
  assert.deepEqual(R.vehicleLocs("2CT"), { C: 2, T: true, t: false, X: 0, W: 0, L: 0, O: false });
  assert.deepEqual(R.vehicleLocs("O4WX"), { C: 0, T: false, t: false, X: 1, W: 4, L: 0, O: true });
  const AV = new Set([0, 125, 185, 250, 340, 440, 1350]);
  for (const [name, item] of SIM.vehicles) {
    const v = SIM.buildVehicle({ vehicle: name, count: 1 }, 0);
    for (const [face, dr] of Object.entries({ ...v.veh.dr, ...(v.veh.turret || {}) })) assert.ok(AV.has(dr), `${name} ${face} DR ${dr} isn't on the AV table`);
    // 4 x the cube root of the curb weight (loaded weight less Load, B463), doubled for a tracked armoured hull
    const lb = parseFloat(item.weight) - 2000 * ((item.vehicle || {}).load || 0), hp = 4 * Math.cbrt(lb) * (v.veh.locs.C ? 2 : 1);
    assert.ok(Math.abs(v.HP - hp) / hp < 0.02, `${name}: HP ${v.HP}, the formula gives ${hp.toFixed(0)}`);
  }
  const russ = SIM.buildVehicle({ vehicle: "Leman Russ Battle Tank", count: 1 }, 0).veh;
  assert.deepEqual([russ.dr.front, russ.dr.side, russ.dr.rear, russ.turret.front], [1350, 340, 125, 1350]);
  const raider = SIM.buildVehicle({ vehicle: "Land Raider", count: 1 }, 0).veh;
  assert.deepEqual([raider.dr.front, raider.dr.side, raider.dr.rear], [1350, 1350, 1350], "Land Raider: glacis-grade armour all round");
});

test("unit stats from the templates", () => {
  const lo = DATA.loadouts;
  const marine = SIM.buildUnit({ template: "Astartes Battle-Brother", count: 1, ...lo["Astartes Battle-Brother"] }, 0);
  assert.equal(marine.st, 30);
  assert.equal(SIM.describe(marine).drTorso, 103, "Mk VII 100 + the ossmodula's fused ribcage 3");
  assert.equal(marine.ranged.dmg.type, "pi++", "the bolter is huge piercing");
  const guard = SIM.buildUnit({ template: "Astra Militarum Guardsman", count: 1, ...lo["Astra Militarum Guardsman"] }, 0);
  assert.equal(guard.st, 11);
  assert.equal(SIM.describe(guard).drTorso, 30);
});

test("a battle is reproducible from its seed", () => {
  const lo = DATA.loadouts, spec = t => ({ template: t, count: 3, ...lo[t] });
  const run = () => { SIM.seed(42); return SIM.runBattle([{ side: 0, spec: spec("Astra Militarum Guardsman") }, { side: 1, spec: spec("Traitor Guardsman") }], { distance: 40, log: true }); };
  const a = run(), b = run();
  assert.equal(a.winner, b.winner);
  assert.deepEqual(a.log, b.log);
});

test("nobody fires a weapon that cannot hurt its target (user report: boltguns at a Leman Russ)", () => {
  const lo = DATA.loadouts || {};
  const squad = (name, side) => SIM.squadSpecs(name, name + side).map(sp => ({ side, spec: { ...(lo[sp.template] || {}), ...sp, armour: sp.armour || (lo[sp.template] || {}).armour || [] } }));
  SIM.seed(3);
  const tank = { side: 0, spec: { vehicle: "Leman Russ Battle Tank", template: "Leman Russ Battle Tank", count: 1, stance: "shoot", armour: [] } };
  const r = SIM.runBattle([tank, ...squad("Astartes Tactical Squad", 1)], { distance: 150, log: true });
  // nothing in this squad gets through the tank's front, so it should not shoot at it from there at all: none in
  // the first ten seconds, before anyone can have got round it
  const t11 = r.log.findIndex(l => /Turn 11\b/.test(l));
  assert.ok(t11 > 0, "the fight should last past ten seconds");
  const shots = r.log.slice(0, t11).filter(l => l.startsWith("Tactical Squad") && l.includes(" fires ") && l.includes("at Leman Russ"));
  assert.equal(shots.length, 0, "shots that could not hurt the tank:\n" + shots.slice(0, 5).join("\n"));
  // it works round to the armour its weapons can get through instead (user direction)
  assert.ok(r.log.some(l => /works round to Leman Russ Battle Tank #1's side armour with its Missile Launcher/.test(l)), "the missile launcher should make for the side armour");
  assert.ok(r.log.some(l => /works round to Leman Russ Battle Tank #1's rear armour with its Krak Grenade/.test(l)), "the rest should make for the rear with krak grenades");
  assert.ok(r.log.some(l => /throws a Krak Grenade at Leman Russ/.test(l)), "and get a grenade onto it");
});

test("every battlefield builds, and both sides can reach each other on every layout", () => {
  for (const [name, build] of Object.entries(SIM.battlefields)) for (let seed = 1; seed <= 6; seed++) {
    const m = build(seed), at = h => m.ids.get(h.q + "," + h.r);
    assert.ok(m.floor.size > 250, `${name} ${seed}: only ${m.floor.size} floor hexes`);
    assert.ok(m.floor.has(m.spawn[0].q + "," + m.spawn[0].r) && m.floor.has(m.spawn[1].q + "," + m.spawn[1].r), `${name} ${seed}: a side deploys inside a wall`);
    // walk from one deployment zone to the other, round cover and up or down no more than a yard a step
    const seen = new Set([at(m.spawn[0])]), queue = [at(m.spawn[0])];
    for (let i = 0; i < queue.length; i++) for (const j of m.nb[queue[i]]) {
      if (seen.has(j) || m.wallI[j] || m.crateI[j] || Math.abs(m.elev[j] - m.elev[queue[i]]) > 1.01) continue;
      seen.add(j); queue.push(j);
    }
    assert.ok(seen.has(at(m.spawn[1])), `${name} ${seed}: no way from one side to the other`);
    assert.ok(seen.size > 0.8 * (m.floor.size - m.crates.size), `${name} ${seed}: ${m.floor.size - m.crates.size - seen.size} floor hexes cut off`);
  }
});

// ---- a battle a person plays: SIM.playBattle stops for them, and the same battle left to the AI is the simulation
const playSpecs = () => { const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] }); return [{ side: 0, spec: spec("Astartes Battle-Brother", 3) }, { side: 1, spec: spec("Ork Boy", 6) }]; };
test("a played battle answered with the AI's own picks is the simulated battle", () => {
  SIM.seed(11);
  const sim = SIM.runBattle(playSpecs(), { distance: 40, log: true, frames: true });
  const g = SIM.playBattle(playSpecs(), { distance: 40, seed: 11, human: { side: 0, direct: "all" } });
  let s = g.next(), acts = 0, turns = 0;
  for (; !s.done; s = g.next(null)) {
    const v = s.value;
    assert.equal(v.view.fx.length, v.view.frames.length - 1, "one stretch of events between each pair of beats");
    assert.equal(v.view.frames.length, v.view.beatTurn.length);
    if (v.type === "turn") { turns++; assert.ok(v.units.filter(u => u.side === 0).every(u => u.direct)); continue; }
    acts++;
    assert.ok(v.opts[v.pick], "the AI's pick is one of the options");
    assert.ok(v.opts.some(o => o.label === "pass"), "holding still is always offered");
    assert.equal(v.view.roster[v.ix].side, 0, "only the player's models stop the battle");
  }
  assert.ok(acts > 3 && turns === s.value.turns);
  assert.equal(s.value.over, true);
  // the same dice in the same order (the one extra option, holding still, is never the AI's pick)
  assert.equal(s.value.winner, sim.winner);
  assert.deepEqual(s.value.log, sim.log);
});
test("a played battle: an ordered move, standing orders, a unit given back to the AI", () => {
  const g = SIM.playBattle(playSpecs(), { distance: 40, seed: 5, human: { side: 0, direct: "all" } });
  let s = g.next();
  assert.equal(s.value.type, "turn");
  s = g.next({ units: { 0: { stance: "charge" } } });
  assert.equal(s.value.type, "act");
  // walk three yards toward the enemy
  const a = s.value, to = { q: a.at[0] + 3, r: a.at[1] };
  s = g.next({ move: to });
  const f = s.value.view.frames[s.value.view.frames.length - 1][a.ix];
  assert.deepEqual([f[0], f[1]], [to.q, to.r], "the model stands on the hex it was sent to");
  assert.ok(s.value.view.log.some(l => l === `${a.id} moves 3 yards (ordered)`));
  // give the unit back to the AI: no more stops for its models, and the standing order shows at the next second
  s = g.next({ release: true });
  while (!s.done && s.value.type !== "turn") s = g.next(null);
  if (!s.done) {
    assert.equal(s.value.units[0].stance, "charge");
    assert.equal(s.value.units[0].direct, false);
    for (s = g.next(null); !s.done; s = g.next(null)) assert.equal(s.value.type, "turn", "a unit left to the AI stops only for orders at each second");
  }
  assert.equal(s.value.over, true);
});
test("a simulated battle never stops for a player", () => {
  SIM.seed(3);
  const r = SIM.runBattle(playSpecs(), { distance: 40, human: { side: 0, direct: "all" } });
  assert.ok(r.winner === 0 || r.winner === 1 || r.winner === -1);
});

test("Necrons stay on their feet (user direction: ai.yaml `upright`)", () => {
  const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] });
  for (const seed of [3, 4]) {
    SIM.seed(seed);
    const r = SIM.runBattle([{ side: 0, spec: spec("Fire Warrior (Shas'la)", 8) }, { side: 1, spec: spec("Necron Warrior", 8) }], { battlefield: "streets", mapSeed: 1, log: true, frames: true });
    const down = r.log.filter(l => /Necron Warrior #\d+ (kneels to fire|goes to ground|keeps its head down|ducks back down)/.test(l));
    assert.deepEqual(down, [], "a Necron chose to go down");
    // prone only while knocked down and getting up: a small share of the fight
    let prone = 0, all = 0;
    r.frames.forEach(f => f.forEach((x, i) => { if (x && r.roster[i].side === 1) { all++; if (x[7] & 2) prone++; } }));
    assert.ok(prone < 0.2 * all, `Necrons prone in ${prone} of ${all} frames`);
  }
});
test("the elite stay on their feet too (skill 17+), and line troops still use the ground", () => {
  const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] });
  SIM.seed(8);
  const r = SIM.runBattle([{ side: 0, spec: spec("Astartes Battle-Brother", 5) }, { side: 1, spec: spec("Astra Militarum Guardsman", 20) }], { distance: 80, log: true, frames: true });
  const down = who => r.log.filter(l => new RegExp(who + " #[0-9]+ (kneels to fire|goes to ground|keeps its head down|ducks back down)").test(l)).length;
  assert.equal(down("Astartes Battle-Brother"), 0, "a Marine chose to go down");
  assert.ok(down("Astra Militarum Guardsman") > 0, "Guardsmen kneel to fire and keep their heads down");
});
test("a squad that can't hurt its foe falls back from it (user report: Guardsmen standing still for a Carnifex)", () => {
  const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] });
  SIM.seed(5);
  const r = SIM.runBattle([{ side: 0, spec: spec("Astra Militarum Guardsman", 10) }, { side: 1, spec: spec("Carnifex", 1) }], { distance: 60, log: true, frames: true });
  assert.ok(r.log.some(l => /Guardsman #\d+ falls back from Carnifex/.test(l)));
  assert.ok(!r.log.some(l => /goes to ground, with nothing left to fight with/.test(l)), "nobody lies down in front of it");
  // by the third second most of them are moving
  const moving = r.frames[3].filter((x, i) => x && r.roster[i].side === 0 && x[6] && x[6].length).length;
  assert.ok(moving >= 7, `${moving} of 10 on the move`);
  assert.ok(r.log.some(l => /quits the field/.test(l)), "those that get clear leave the field");
});
test("a squad stays while its heavy weapon is still in the fight, and a model run down turns at bay (user direction)", () => {
  const lo = DATA.loadouts || {};
  const squad = (name, side) => SIM.squadSpecs(name, name + side).map(sp => ({ side, spec: { ...(lo[sp.template] || {}), ...sp, armour: sp.armour || (lo[sp.template] || {}).armour || [] } }));
  let bay = 0;
  for (const seed of [1, 2, 3]) {
    SIM.seed(seed * 7 + 1);
    const r = SIM.runBattle([...squad("Astra Militarum Infantry Squad", 0), { side: 1, spec: { template: "Carnifex", count: 1, ...lo.Carnifex } }], { distance: 60, log: true });
    // nobody leaves while the heavy bolter is still in the fight: the Carnifex has to have got to its crew first
    const gone = r.log.findIndex(l => /quits the field/.test(l));
    if (gone >= 0) assert.ok(r.log.slice(0, gone).some(l => /Carnifex #1 strikes Guard Squad (Heavy Bolter|Loader) #1 /.test(l)), `seed ${seed}: the squad left before the Carnifex reached its heavy bolter`);
    bay += r.log.filter(l => /turns at bay/.test(l)).length;
    // and nobody with nothing to hurt it with walks up to it
    assert.ok(!r.log.some(l => /Guard Squad (Guardsman|Flamer|Sergeant|Vox-caster) #\d+ (closes in on|moves in on|advances toward) Carnifex/.test(l)), `seed ${seed}: a Guardsman walked up to the Carnifex`);
  }
  assert.ok(bay > 0, "somebody caught by it should turn at bay");
});
test("a Hormagaunt swarm under synapse keeps coming under fire: no fear, no standing about (user report)", () => {
  const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] });
  SIM.seed(8);
  const r = SIM.runBattle([{ side: 0, spec: spec("Astra Militarum Guardsman", 10) }, { side: 1, spec: spec("Hormagaunt", 20) }, { side: 1, spec: spec("Tyranid Warrior", 2) }], { distance: 80, log: true, frames: true });
  // while the brood is linked (Synapse Discipline): no Fright Checks under fire. Out of the field it may freeze;
  // the fast Hormagaunts outrun their Warriors here, so the test follows the link through the log
  const first = r.log.find(l => /^Hormagaunt (lose|come back)/.test(l));
  let linked = !first || /lose/.test(first), froze = 0;
  for (const l of r.log) {
    if (/^Hormagaunt lose synapse/.test(l)) linked = false; else if (/^Hormagaunt come back/.test(l)) linked = true;
    else if (linked && /Hormagaunt #\d+ (freezes|loses fatigue and freezes|retches|faints)/.test(l)) froze++;
  }
  assert.equal(froze, 0, "a Hormagaunt froze under synapse");
  // and none stands three seconds in one place with no foe beside it (they used to, a fast model's charge being
  // read as overshooting its brood)
  const stuck = [];
  r.roster.forEach((u, i) => { if (u.template !== "Hormagaunt") return; for (let t = 2; t < r.frames.length; t++) {
    const [a, b, c] = [r.frames[t - 2][i], r.frames[t - 1][i], r.frames[t][i]];
    if (!a || !b || !c || a[0] !== c[0] || a[1] !== c[1] || b[0] !== c[0] || b[1] !== c[1]) continue;
    if ([a, b, c].some(x => (x[7] || 0) & 7)) continue;   // stunned, down or getting up: that's not standing about
    const near = r.frames[t].some((x, j) => x && r.roster[j].side === 0 && Math.max(Math.abs(x[0] - c[0]), Math.abs(x[1] - c[1]), Math.abs(x[0] + x[1] - c[0] - c[1])) <= 2);
    if (!near) stuck.push(u.id + "@" + t);
  } });
  assert.ok(stuck.length <= 2, "Hormagaunts standing about: " + stuck.slice(0, 6).join(" "));
});
test("Termagants advance as a swarm rather than trade shots at long range (user direction)", () => {
  const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] });
  SIM.seed(8);
  // with their synapse Warriors: a brood cut off from synapse fights on instinct, and doesn't advance as one
  const r = SIM.runBattle([{ side: 0, spec: spec("Termagant", 20) }, { side: 0, spec: spec("Tyranid Warrior", 2) }, { side: 1, spec: spec("Astra Militarum Guardsman", 10) }], { distance: 60, log: true, frames: true });
  const hd = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[0] + a[1] - b[0] - b[1]));
  const f = r.frames[5], T = [], G = [];
  f.forEach((x, i) => { if (x && r.roster[i].side) G.push(x); else if (x && r.roster[i].template === "Termagant") T.push(x); });
  const near = Math.min(...T.map(a => Math.min(...G.map(b => hd(a, b)))));
  assert.ok(near <= 30, `after five seconds the nearest Termagant is still ${near} yards off`);
  // and they don't stand at range aiming while the lasguns work on them
  const early = r.log.slice(0, r.log.findIndex(l => /Turn 5\b/.test(l)));
  assert.ok(early.filter(l => /^Termagant #\d+ aims/.test(l)).length <= 2, "Termagants aimed at long range");
});
test("Necron gunlines hold and shoot: no walking up to Marines to grapple them (user report)", () => {
  const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] });
  let melee = 0, fire = 0;
  for (const seed of [1, 2, 3]) {
    SIM.seed(seed * 7 + 1);
    const r = SIM.runBattle([{ side: 0, spec: spec("Necron Immortal", 5) }, { side: 1, spec: spec("Astartes Battle-Brother", 5) }], { distance: 60, log: true });
    melee += r.log.filter(l => /^Necron Immortal #\d+ (charges|slams|rushes|moves in on|closes in on)/.test(l)).length;
    fire += r.log.filter(l => /^Necron Immortal #\d+ fires/.test(l)).length;
  }
  // they used to charge, slam and grapple the Marines; now any hand-to-hand is the Marines' doing
  assert.ok(melee <= 3, `Immortals went looking for a fight hand to hand ${melee} times`);
  assert.ok(fire > 50, "and they shoot");
});
test("a swarm gets over the river: nobody stuck at a crossing (user report)", () => {
  const lo = DATA.loadouts || {};
  const squad = (name, side) => SIM.squadSpecs(name, name + side).map(sp => ({ side, spec: { ...(lo[sp.template] || {}), ...sp, armour: sp.armour || (lo[sp.template] || {}).armour || [] } }));
  for (const seed of [1, 4, 6]) {
    SIM.seed(seed * 7 + 1);
    const r = SIM.runBattle([...squad("Astra Militarum Infantry Squad", 0), { side: 1, spec: { template: "Hormagaunt", count: 20, ...lo.Hormagaunt } }], { battlefield: "river", awareness: "limited", mapSeed: seed, log: true });
    const stuck = r.log.filter(l => /can't find a way/.test(l));
    assert.equal(stuck.length, 0, `layout ${seed}: ` + stuck.slice(0, 3).join(" | "));
  }
});
test("friendly fire: any squad can hit its own, and shooters step clear of a friend in the line (user direction)", () => {
  const lo = DATA.loadouts || {};
  const squad = (name, side) => SIM.squadSpecs(name, name + side).map(sp => ({ side, spec: { ...(lo[sp.template] || {}), ...sp, armour: sp.armour || (lo[sp.template] || {}).armour || [] } }));
  let ff = 0, steps = 0;
  for (const seed of [1, 2, 3, 4]) {
    SIM.seed(seed * 7 + 1);
    const r = SIM.runBattle([...squad("Astartes Tactical Squad", 0), ...squad("Chaos Space Marine Squad", 1)], { battlefield: "outpost", awareness: "limited", mapSeed: seed, log: true });
    ff += r.log.filter(l => /\(friendly fire\)/.test(l)).length;   // both squads are drilled: they used to be immune
    steps += r.log.filter(l => /steps aside to clear its line of fire/.test(l)).length;
  }
  assert.ok(ff > 0, "drilled squads should be able to hit each other by mistake");
  assert.ok(steps > 0, "a shooter with a friend in its line should sometimes step clear");
});
test("troops under fire from several guns keep their feet, and Tyranids never go down by choice (user direction)", () => {
  const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] });
  SIM.seed(8);
  const a = SIM.runBattle([{ side: 0, spec: spec("Adepta Sororitas Battle Sister", 10) }, { side: 1, spec: spec("Chaos Space Marine", 5) }], { distance: 60, log: true });
  // getting up is what a Dodge and Drop costs: before, Sisters did it eleven times a fight each
  const ups = {};
  for (const l of a.log) { const m = /^(Adepta Sororitas Battle Sister #\d+) gets up to a kneel/.exec(l); if (m) ups[m[1]] = (ups[m[1]] || 0) + 1; }
  assert.ok(Math.max(0, ...Object.values(ups)) <= 3, "a Sister got up " + Math.max(0, ...Object.values(ups)) + " times");
  SIM.seed(8);
  const b = SIM.runBattle([{ side: 0, spec: spec("Termagant", 20) }, { side: 1, spec: spec("Astra Militarum Guardsman", 10) }], { distance: 60, log: true });
  assert.ok(!b.log.some(l => /^Termagant #\d+ (kneels to fire|goes to ground|keeps its head down)/.test(l)), "a Termagant knelt or went to ground");
});

test("design notes quote the current AV table", () => {
  // "AV13 (DR 340...)" or "AV12-14 (DR 250-440)" anywhere in the data must match docs/framework.md's table
  const AV = { 10: 125, 11: 185, 12: 250, 13: 340, 14: 440 };
  const files = [];
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith(".yaml")) files.push(p); } };
  walk(path.join(__dirname, "..", "..", "..", "data"));
  const bad = [];
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8").replace(/\s+/g, " ");
    for (const m of text.matchAll(/AV ?(1[0-4])(?:\s*(?:[-–]|through|to)\s*(?:AV ?)?(1[0-4]))?,? \(DR (\d+)(?:\s*[-–]\s*(\d+))?/g)) {
      const [, a, b, lo, hi] = m;
      if (+lo !== AV[a] || (b && hi && +hi !== AV[b])) bad.push(`${path.relative(process.cwd(), f)}: "${m[0]}"`);
    }
  }
  assert.deepEqual(bad, [], "stale AV figures:\n" + bad.join("\n"));
});

test("countryside: sides deploy in lines along their own edges, on open ground, and fight across it", () => {
  const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] });
  const units = [{ side: 0, spec: spec("Astra Militarum Guardsman", 30) }, { side: 1, spec: spec("Ork Boy", 30) }];
  const m = SIM.battlefields.countryside(2);
  assert.equal(m.deploy, "edge");
  const r = SIM.runBattle(units, { battlefield: "countryside", mapSeed: 2, seed: 9, maxTurns: 30 });
  const seen = new Set();
  for (const x of r.roster) {
    const [q, rr] = x.start, k = q + "," + rr, i = m.ids.get(k), col = q;
    assert.ok(i != null && !m.wallI[i] && !m.crateI[i], `${x.id} starts on ${k}, not open floor`);
    assert.ok(!seen.has(k), `${x.id} shares ${k}`); seen.add(k);
    assert.ok(x.side === 0 ? col < m.band + 4 : col > m.W - m.band - 5, `${x.id} starts at column ${col}, outside its side's band`);
  }
  assert.ok(r.turns >= 1);
  // a custom size is honoured
  const small = SIM.battlefields.countryside(3, { mapW: 160, mapH: 80 });
  assert.equal(small.W, 160); assert.equal(small.H, 80);
});

test("the engine uses only maths that every JavaScript engine computes bit for bit the same", () => {
  // + - * / and Math.sqrt are correctly rounded by the standard; these aren't, and a replay re-runs the battle in
  // whatever browser opens it. engine/05-dmath.js has the stand-ins (dexp, dsin, dcos, datan2, dlog, dpow, powi, hyp, ilog2)
  const BAD = /Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log2|log10|log1p|pow|hypot|cbrt)\s*\(/;
  for (const f of fs.readdirSync(path.join(__dirname, "..", "engine"))) {
    if (f === "05-dmath.js") continue;
    fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8").split("\n").forEach((line, i) => {
      if (BAD.test(line)) assert.fail(`${f}:${i + 1} calls ${line.match(BAD)[0]}): use the deterministic stand-in`);
    });
  }
});
test("fire discipline: no shooting through a friend or into a friend's melee, so friendly fire stays rare (user report)", () => {
  // a war-sized fight on the countryside: Levies, Storm Levies and Wardens against a charging Ork mob. Before, about
  // 16 of every 100 bursts put a stray round into a friend (shots through the front rank, pop-ups and Waits fired
  // into melees, Move and Attack past a comrade)
  const lo = DATA.loadouts, spec = (t, n) => ({ template: t, count: n, ...lo[t] });
  let ff = 0, bursts = 0;
  for (const s of [1, 2, 3]) {
    const r = SIM.runBattle([{ side: 0, spec: { ...spec("Astra Militarum Guardsman", 40), squad: "a" } }, { side: 0, spec: { ...spec("Militarum Tempestus Scion", 8), squad: "b" } },
      { side: 1, spec: { ...spec("Ork Boy", 50), squad: "c" } }, { side: 1, spec: { ...spec("Ork Nob", 8), squad: "d" } }], { battlefield: "countryside", mapW: 160, mapH: 80, mapSeed: s, seed: s * 7, maxTurns: 600, log: true });
    ff += r.log.filter(l => /\(friendly fire\)/.test(l)).length;
    bursts += r.log.filter(l => / fires /.test(l)).length;
  }
  assert.ok(ff / bursts < 0.03, `${ff} friendly hits in ${bursts} bursts`);
});
