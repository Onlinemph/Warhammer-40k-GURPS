// Rules assertions: the engine's tables and formulas against the Basic Set, the user's house rules and the anchors
// in docs/framework.md. Run `node --test tools/sim/test/` after `python3 tools/build_site.py` (the data comes from
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
    // 4 x the cube root of the curb weight, doubled for a tracked armoured hull
    const lb = parseFloat(item.weight), hp = 4 * Math.cbrt(lb) * (v.veh.locs.C ? 2 : 1);
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
