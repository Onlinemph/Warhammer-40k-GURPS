// Combat simulator. Inlined into site/index.html by tools/build_site.py; the engine
// (SIM) also runs under node for testing: `node tools/sim_test.js`.
//
// GURPS 4e combat on a hex map (1 yard per hex), second by second. docs/simulator.md is
// the rule list with Basic Set pages: facing and arcs, maneuvers chosen by an AI
// (Attack, Aim, Move and Attack, All-Out Attack and Defense, Feint, Rapid Strike, Ready,
// Change Posture, Concentrate), called shots, range and rapid fire, malfunctions,
// explosions, fragmentation and cones, Dodge, Parry, Block with retreat and shield DB,
// Dodge and Drop, cover and posture, armour divisors, Weak Points, regenerating shields,
// wounding and Injury Tolerance, follow-ups, crippling, knockback, bleeding, shock, stun,
// consciousness and death, Reanimation Protocols, morale, psychic powers and Perils,
// and the user's Revised Fractional Health as an alternative wound system.

const SIM = (() => {
  // ------------------------------------------------------------------ dice
  let R = Math.random;
  function seed(s) {
    let a = s >>> 0;
    R = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const d6 = () => 1 + Math.floor(R() * 6);
  // P3[n] = chance that 3d6 rolls n or less (success chance at effective skill n, crits aside)
  const P3 = (() => { const c = Array(19).fill(0); for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let d = 1; d <= 6; d++) c[a + b + d]++;
    const out = []; let t = 0; for (let n = 0; n <= 18; n++) { t += c[n]; out.push(Math.min(n >= 17 ? 1 : 1, t / 216)); }
    out[3] = out[4] = Math.max(out[4], 4 / 216); return out; })();
  const roll3 = () => d6() + d6() + d6();
  const pick = a => a[Math.floor(R() * a.length)];
  // success roll: {ok, margin, crit}
  function check(level) {
    const r = roll3();
    const critS = r <= 4 || (r === 5 && level >= 15) || (r === 6 && level >= 16);
    const critF = r === 18 || (r === 17 && level <= 15) || r - level >= 10;
    return { ok: critS || (!critF && r <= level), margin: level - r, crit: critS, fumble: critF, roll: r };
  }

  // ---------------------------------------------------------------- parsing
  const TYPES = ["pi++", "pi+", "pi-", "pi", "cut", "imp", "cr", "burn", "tox", "cor", "fat", "aff", "spec"];
  function num(v, d = 0) { const m = /-?\d+(\.\d+)?/.exec(String(v ?? "")); return m ? Number(m[0]) : d; }

  // "6dx2(2) pi++", "sw+3d+1(10) cut", "thr+8d(10) cr", "4d cr ex [2d cut]", "5d+2x2(2) burn"
  function parseDamage(str, thr, sw) {
    let s = String(str || "").trim();
    if (!s) return null;
    const fr = /\[(\d+)d\s*([a-z+-]*)\]/.exec(s);
    const frag = fr ? { n: Number(fr[1]), type: fr[2] || "cut" } : null;
    s = s.replace(/\[[^\]]*\]/g, " ");
    const ignores = /ignores DR/i.test(s);
    s = s.replace(/\(ignores DR\)/i, " ");
    let type = null, ex = false;
    const tm = /\s(pi\+\+|pi\+|pi-|pi|cut|imp|cr|burn|tox|cor|fat|aff|spec)\b(\s+ex)?/.exec(" " + s);
    if (tm) { type = tm[1]; ex = !!tm[2]; s = (" " + s).slice(0, tm.index).trim(); }
    if (!type || type === "spec" || type === "aff" || type === "fat") return null;
    let div = 1;
    const dm = /\((\d+(?:\.\d+)?|∞)\)/.exec(s);
    if (dm) { div = dm[1] === "∞" ? Infinity : Number(dm[1]); s = s.replace(dm[0], ""); }
    if (ignores) div = Infinity;
    let mult = 1;
    const mm = /x(\d+(?:\.\d+)?)/.exec(s);
    if (mm) { mult = Number(mm[1]); s = s.replace(mm[0], ""); }
    s = s.replace(/^sw/, sw || "1d").replace(/^thr/, thr || "1d").replace(/\s+/g, "");
    let n = 0, add = 0, any = false;
    const re = /([+-]?)(\d*)d(?![a-z])|([+-]?)(\d+)/g;
    let m;
    while ((m = re.exec(s))) {
      any = true;
      if (m[0].includes("d")) n += (m[1] === "-" ? -1 : 1) * (m[2] === "" ? 1 : Number(m[2]));
      else add += (m[3] === "-" ? -1 : 1) * Number(m[4]);
    }
    if (!any) return null;
    return { n, add, mult, div, type, ex, frag, text: String(str) };
  }
  function rollDamage(dm) {
    let t = dm.add;
    for (let i = 0; i < dm.n; i++) t += d6();
    t = Math.max(dm.type === "cr" ? 0 : 1, t);
    return Math.floor(t * dm.mult);
  }
  function parseRange(r) {
    const s = String(r ?? "");
    if (/x/i.test(s)) return null;
    const parts = s.split("/").map(p => num(p, NaN)).filter(x => !isNaN(x));
    if (!parts.length) return null;
    return parts.length === 1 ? { half: parts[0], max: parts[0] } : { half: parts[0], max: parts[1] };
  }
  function parseRoF(r) {
    const s = String(r ?? "1");
    const m = /(\d+)\s*[x×]\s*(\d+)/.exec(s);
    return m ? Number(m[1]) * Number(m[2]) : Math.max(1, num(s, 1));
  }
  function parseShots(s) {
    const str = String(s ?? "");
    if (/∞|inf/i.test(str) || !str || /^[-–—]$/.test(str.trim())) return { mag: Infinity, reload: 0 };
    const m = /(\d+)\s*(?:\+\d+)?\s*\((\d+)/.exec(str);
    if (m) return { mag: Number(m[1]), reload: Number(m[2]) };
    const t = /T\((\d+)\)/.exec(str);
    if (t) return { mag: 1, reload: Number(t[1]) };
    return { mag: Math.max(1, num(str, 1)), reload: 3 };
  }
  function accOf(a) { return String(a ?? "0").split("+").reduce((t, p) => t + num(p, 0), 0); }

  // B550 speed/range table (range part only)
  const RANGE = [[2, 0], [3, -1], [5, -2], [7, -3], [10, -4], [15, -5], [20, -6], [30, -7], [50, -8], [70, -9],
    [100, -10], [150, -11], [200, -12], [300, -13], [500, -14], [700, -15], [1000, -16], [1500, -17],
    [2000, -18], [3000, -19], [5000, -20], [7000, -21], [10000, -22]];
  function rangePenalty(yd) { for (const [r, p] of RANGE) if (yd <= r) return p; return -23; }
  function rapidBonus(shots) {
    if (shots < 5) return 0; if (shots <= 8) return 1; if (shots <= 12) return 2; if (shots <= 16) return 3;
    if (shots <= 24) return 4; if (shots <= 49) return 5; if (shots <= 99) return 6; return 7;
  }

  // ------------------------------------------------------------ data index
  let EQ = null, TEMPLATES = null, SIMW = {}, POWERS = {};
  function index(data) {
    EQ = new Map(); TEMPLATES = new Map(); SIMW = data.simWeapons || {}; POWERS = data.powers || {};
    const walk = (e, src) => { if (!EQ.has(e.name)) EQ.set(e.name, { e, src }); (e.children || []).forEach(c => walk(c, src)); };
    for (const lib of data.libraries) {
      if (lib.kind === "equipment") lib.items.forEach(e => walk(e, lib));
      if (lib.kind === "template" && !lib.template.addon) TEMPLATES.set(lib.title, { t: lib.template, lib });
    }
    return { EQ, TEMPLATES };
  }
  function findTraitWeapon(traits, name) {
    for (const t of traits || []) {
      if (t.disabled) continue;
      if (t.name === name && t.weapons && t.weapons.length) return t;
      const k = findTraitWeapon(t.children, name);
      if (k) return k;
    }
    return null;
  }
  function traitWeapons(traits, out = []) {
    for (const t of traits || []) {
      if (t.disabled) continue;
      if (t.weapons && t.weapons.length) out.push(t);
      traitWeapons(t.children, out);
    }
    return out;
  }
  const flat = e => [e, ...(e.children || []).flatMap(flat)];
  let WID = 0;

  // Armour: DR by location (only DR that isn't limited to one damage type), Weak Points,
  // and the ST and Move features a suit carries (servo ST lives on a child item).
  const LOCS = ["skull", "eye", "face", "neck", "torso", "vitals", "groin", "arm", "hand", "leg", "foot"];
  function armourProfile(names) {
    const dr = {}; let wp = 0, wpTorso = -1, striking = 0, lifting = 0, move = 0, hp = 0;
    for (const nm of names || []) {
      const hit = EQ.get(nm);
      if (!hit) continue;
      for (const e of flat(hit.e)) {
        let torso = 0;
        for (const row of (e.feat && e.feat.dr) || []) {
          if (row.vs) continue;
          for (const g of row.groups) for (const loc of g.locs) {
            dr[loc] = (dr[loc] || 0) + g.dr;
            if (loc === "torso" || loc === "all") torso = Math.max(torso, g.dr);
          }
        }
        const w = /^Weak Points (\d+):/.exec(e.notes || "");
        if (w && torso >= wpTorso) { wp = Number(w[1]); wpTorso = torso; }
        for (const o of (e.feat && e.feat.other) || []) {
          let m;
          if ((m = /^Striking St ([+-]\d+)/i.exec(o))) striking += Number(m[1]);
          else if ((m = /^Lifting St ([+-]\d+)/i.exec(o))) lifting += Number(m[1]);
          else if ((m = /^ST ([+-]\d+)/.exec(o))) { striking += Number(m[1]); lifting += Number(m[1]); }
          else if ((m = /^Basic Move ([+-]\d+)/i.exec(o))) move += Number(m[1]);
          else if ((m = /^HP ([+-]\d+)/.exec(o))) hp += Number(m[1]);   // battlesuit structure
        }
      }
    }
    return { dr, wp, striking, lifting, move, hp };
  }
  function drAt(dr, loc) {
    const all = dr.all || 0;
    if (loc === "eye") return all + (dr.eye != null ? dr.eye : (dr.face || 0));
    return all + (dr[loc] || 0);
  }

  // Damage table (B16) for striking ST
  const DMG = [[1, "1d-6", "1d-5"], [3, "1d-5", "1d-4"], [5, "1d-4", "1d-3"], [7, "1d-3", "1d-2"], [9, "1d-2", "1d-1"],
    [10, "1d-2", "1d"], [11, "1d-1", "1d+1"], [12, "1d-1", "1d+2"], [13, "1d", "2d-1"], [14, "1d", "2d"],
    [15, "1d+1", "2d+1"], [16, "1d+1", "2d+2"], [17, "1d+2", "3d-1"], [18, "1d+2", "3d"], [19, "2d-1", "3d+1"],
    [20, "2d-1", "3d+2"], [21, "2d", "4d-1"], [22, "2d", "4d"], [23, "2d+1", "4d+1"], [24, "2d+1", "4d+2"],
    [25, "2d+2", "5d-1"], [26, "2d+2", "5d"], [27, "3d-1", "5d+1"], [29, "3d", "5d+2"], [31, "3d+1", "6d-1"],
    [33, "3d+2", "6d"], [35, "4d-1", "6d+1"], [37, "4d", "6d+2"], [39, "4d+1", "7d-1"], [45, "5d", "7d+1"],
    [50, "5d+2", "8d-1"], [55, "6d", "8d+1"], [60, "7d-1", "9d"], [65, "7d+1", "9d+2"], [70, "8d", "10d"]];
  function stDamage(st) { let r = DMG[0]; for (const row of DMG) if (st >= row[0]) r = row; return { thr: r[1], sw: r[2] }; }

  function skillLevel(stats, skill, defaults) {
    const known = new Map((stats.skills || []).filter(s => s.level != null).map(s => [s.name, s.level]));
    const attr = { ST: stats.st, DX: stats.dx, IQ: stats.iq, HT: stats.ht, Per: stats.per, Will: stats.will };
    // an unspecialised weapon skill ("Axe/Mace") matches a specialised one on the sheet ("Axe/Mace (Choppa)")
    const lookup = nm => known.has(nm) ? known.get(nm) : nm && !nm.includes("(") ?
      Math.max(-Infinity, ...[...known].filter(([k]) => k.startsWith(nm + " (")).map(([, v]) => v)) : undefined;
    let best = lookup(skill) ?? -Infinity;
    for (const d of defaults || []) {
      const m = /^(.*?)([+-]\d+)?$/.exec(d.trim());
      const base = m[1].trim(), mod = Number(m[2] || 0);
      const v = attr[base] != null ? attr[base] : lookup(base);
      if (v != null && v > -Infinity) best = Math.max(best, v + mod);
    }
    return best === -Infinity ? stats.dx - 5 : best;
  }

  function weaponLines(src) { return (src && src.weapons) || []; }
  function chooseLine(lines, mode, melee) {
    const usable = lines.filter(w => !!w.melee === melee);
    const isFollow = w => /follow-?up/i.test(w.usage || "");
    return (mode && usable.find(w => w.usage === mode)) ||
      usable.find(w => !isFollow(w) && !/field off|off\b/i.test(w.usage || "")) || usable.find(w => !isFollow(w)) || null;
  }
  function followLine(lines, main) {
    const i = lines.indexOf(main);
    for (let j = i + 1; j < lines.length; j++) {
      if (/follow-?up/i.test(lines[j].usage || "")) return lines[j];
      if (!/follow-?up/i.test(lines[j].usage || "")) break;
    }
    return lines.find(w => /follow-?up/i.test(w.usage || "") && !!w.melee === !!main.melee) || null;
  }

  // ------------------------------------------------------------ unit build
  // spec: {template, count, armour:[names], ranged:{item,mode}, melee:{item|trait,mode}, shield:{sp,delay,recharge,ranged_only}, stance}
  function buildUnit(spec, side) {
    const T = TEMPLATES.get(spec.template);
    if (!T) throw new Error("Unknown template: " + spec.template);
    const st = T.t.stats, flags = st.flags || {};
    const arm = armourProfile(spec.armour);
    const nat = {};
    for (const [k, v] of Object.entries(st.dr || {})) nat[k] = v;
    const baseStrike = st.st + ((st.bonus && st.bonus.striking_st) || 0);
    const dmgST = stDamage(baseStrike + arm.striking);
    const liftST = st.st + ((st.bonus && st.bonus.lifting_st) || 0) + arm.lifting;
    const mkWeapon = (sel, melee) => {
      if (!sel) return null;
      let src = null, label = "";
      if (sel.trait) { src = findTraitWeapon(T.t.traits, sel.trait); label = sel.trait; }
      else if (sel.item) { const h = EQ.get(sel.item); src = h && h.e; label = sel.item; }
      if (!src) return null;
      const lines = weaponLines(src);
      const line = chooseLine(lines, sel.mode, melee);
      if (!line) return null;
      const dmg = parseDamage(line.damage, dmgST.thr, dmgST.sw);
      if (!dmg) return null;
      const fl = followLine(lines, line);
      // "Rending hit (success by 5+ or critical)": same attack, better divisor on a good hit
      const rl = lines.find(x => x !== line && !!x.melee === melee && /success by (\d+)\+|rending hit/i.test(x.usage || ""));
      const rend = rl ? parseDamage(rl.damage, dmgST.thr, dmgST.sw) : null;
      const rendBy = rl ? Number((/success by (\d+)\+/i.exec(rl.usage) || [0, 5])[1]) : 0;
      const fdmg = fl ? parseDamage(fl.damage, dmgST.thr, dmgST.sw) : null;
      const level = skillLevel(st, line.skill, [line.skill, ...(line.defaults || [])]);
      const facts = (SIMW[label] || {})[line.usage] || {};
      const cone = facts.cone || Number((/cone[^0-9]*(\d+)\s*(?:yards|yd)/i.exec(line.usage || "") || [])[1] || 0);
      const w = { id: ++WID, name: label, usage: line.usage, text: line.damage, dmg, follow: fdmg, followText: fl ? fl.damage : "", level,
        rend, rendBy, rendText: rl ? rl.damage : "", malf: facts.malf || 0,
        overheat: facts.overheat ? parseDamage(/[a-z]\s*$/.test(facts.overheat) ? facts.overheat : facts.overheat + " burn") : null,
        cone, blast: facts.blast || 0, natural: !!sel.trait };
      if (melee) {
        const p = String(line.parry ?? "0");
        w.parry = /no/i.test(p) ? null : num(p, 0);
        w.unbalanced = /U/.test(p);
        w.reach = String(line.reach ?? "1");
        w.reachMax = Math.max(1, ...(w.reach.match(/\d+/g) || ["1"]).map(Number));
        w.oneHanded = !/[†‡]/.test(String(line.strength ?? ""));
      } else {
        w.acc = accOf(line.accuracy); w.range = parseRange(line.range) || { half: 100, max: 300 };
        w.rof = parseRoF(line.rate_of_fire); w.rcl = Math.max(1, num(line.recoil, 1));
        w.shots = parseShots(line.shots); w.bulk = num(line.bulk, 0);
        const sm = /^(\d+)([MB†]*)/.exec(String(line.strength ?? ""));
        w.minST = sm && !/[MB]/.test(sm[2]) ? Number(sm[1]) : 0;
        if (w.minST && liftST < w.minST) w.level -= w.minST - liftST;
        w.oneHanded = w.bulk >= -2 && !/[†‡]/.test(String(line.strength ?? ""));
      }
      return w;
    };
    let melee = mkWeapon(spec.melee, true);
    if (!melee) {
      const lvl = skillLevel(st, "Brawling", ["Brawling", "DX", "Karate"]);
      const hasB = (st.skills || []).some(s => s.name === "Brawling" || s.name === "Karate");
      const pd = parseDamage("thr" + (hasB ? "" : "-1") + " cr", dmgST.thr, dmgST.sw);
      melee = { id: ++WID, name: "Punch", usage: "Punch", text: "thr cr", dmg: pd, follow: null, level: lvl, parry: 0, unbalanced: false, reach: "C", reachMax: 1, malf: 0 };
    }
    const ranged = mkWeapon(spec.ranged, false);
    // thrown grenades (B410): Throwing skill, range from ST and weight (B355), one per Ready + Attack
    const THROW = [[0.05, 3.5], [0.1, 2.5], [0.15, 2], [0.2, 1.5], [0.25, 1.2], [0.3, 1.1], [0.4, 1], [0.5, 0.8], [0.75, 0.7], [1, 0.6], [1.5, 0.4], [2, 0.3]];
    const grenades = (spec.grenades || []).map(g => {
      const w = mkWeapon({ item: g.item, mode: g.mode }, false);
      if (!w) return null;
      const h = EQ.get(g.item), lb = parseFloat((h && h.e && h.e.weight) || 1) || 1, ratio = lb / (liftST * liftST / 5);
      const dist = Math.max(2, Math.floor(liftST * ((THROW.find(([r]) => ratio <= r) || [0, 0.2])[1])));
      Object.assign(w, { range: { half: dist, max: dist }, acc: 0, rof: 1, rcl: 1, bulk: 0, shots: { mag: Infinity, reload: 0 }, thrown: true, count: g.count || 1, oneHanded: true, minST: 0 });
      return w;
    }).filter(Boolean);
    // two weapons at once (B417): -4 each, the off hand -4 more unless Ambidexterity; Dual-Weapon Attack buys the -4 off
    const dwa = (st.skills || []).find(s => /^Dual-Weapon Attack/.test(s.name) && s.level != null);
    const dualPen = dwa && melee ? Math.max(0, melee.level - dwa.level) : 4;
    const offPen = flags.ambi || (st.skills || []).some(s => /^Off-Hand Weapon Training/.test(s.name)) ? 0 : 4;
    const parryOf = w => w && w.parry != null ? Math.floor(w.level / 2) + 3 + w.parry + (flags.enhParry || 0) + (flags.cr ? 1 : 0) : null;
    // shield Defense Bonus from any carried item (data/sim/weapons.yaml _item.db)
    let db = 0;
    for (const nm of [...(spec.armour || []), spec.melee && spec.melee.item, spec.ranged && spec.ranged.item, spec.shield && spec.shield.item])
      if (nm && SIMW[nm] && SIMW[nm]._item && SIMW[nm]._item.db) db = Math.max(db, SIMW[nm]._item.db);
    // psychic powers (data/sim/powers.yaml)
    const powers = [];
    let pshield = null;
    for (const p of POWERS[spec.template] || []) {
      if (p.kind === "shield" && p.shield) { pshield = pshield || { sp: p.shield.sp, delay: p.shield.delay || 3, recharge: p.shield.recharge || 0, ranged_only: false, item: p.name }; continue; }
      const dmg = parseDamage(p.damage, dmgST.thr, dmgST.sw);
      if (!dmg) continue;
      const pdm = x => x ? parseDamage(/[a-z]\s*$/.test(x) ? x : x + " cr") : null;
      const pp = p.perils;
      powers.push({ id: ++WID, name: p.name, usage: "power", text: p.damage, dmg, follow: null, level: Number(p.skill) || st.iq,
        melee: p.kind === "melee", acc: Number(p.acc) || 0, range: parseRange(p.range) || { half: 10, max: 100 }, rof: Number(p.rof) || 1,
        rcl: 1, bulk: 0, shots: { mag: Infinity, reload: 0 }, fp: Number(p.fp) || 0, concentrate: Number(p.concentrate) || 0,
        perils: pp ? { will: Number(pp.will) || st.will, waaagh: Number(pp.waaagh_perils_bonus) || 0, fp: (pp.minor && pp.minor.fp) || 1,
          modDmg: pdm(pp.moderate && pp.moderate.damage), majDmg: pdm(pp.major && pp.major.damage),
          cat: (pp.catastrophic && pp.catastrophic.margin) || 10 } : null,
        malediction: Number(p.malediction) || 0, resist: p.resist || "Will", reachMax: 1, parry: null, malf: 0, cone: Number(p.cone) || 0, blast: Number(p.blast) || 0, explosion: Number(p.explosion) || 1 });
    }
    const u = {
      side, name: spec.label || spec.template, template: spec.template, count: Math.max(1, spec.count | 0),
      db, powers, grenades, dualPen, offPen, fp: st.fp || st.ht, st: st.st, dx: st.dx, formation: spec.formation || "line",
      // elites call shots: a best combat skill (weapon or power) of 17+, two past a trained line soldier's 15,
      // and a mind that picks its shots (IQ 8+). Points were a poor proxy: an Ork Boy's ST 28 costs 300+.
      elite: Math.max(melee ? melee.level : 0, ranged ? ranged.level : 0, ...powers.map(p => p.level)) >= 17 && st.iq >= 8,
      // grappling (B370): DX, or Wrestling, Judo or Sumo Wrestling if better
      grapple: Math.max(st.dx, ...(st.skills || []).filter(s => /^(Wrestling|Judo|Sumo Wrestling)\b/.test(s.name) && s.level != null).map(s => s.level)),
      stance: spec.stance || "shoot", stats: st, flags, speed: st.speed, move: Math.max(1, st.move + arm.move),
      dodge: st.dodge, HP: st.hp + arm.hp, HT: st.ht, will: st.will, sm: st.sm || 0,
      arm, nat, ranged, melee, parry: parryOf(melee), shield: spec.shield && spec.shield.sp ? { ...spec.shield } : pshield,
    };
    return u;
  }
  function describe(u) {
    const tor = drAt(u.arm.dr, "torso") + drAt(u.nat, "torso"), eye = drAt(u.arm.dr, "eye") + drAt(u.nat, "eye");
    return {
      hp: u.HP, ht: u.HT, dodge: u.dodge, dmgRed: u.flags.dmgRed > 1 ? u.flags.dmgRed : 0, parry: u.parry, move: u.move, drTorso: tor, drEye: eye, wp: u.arm.wp,
      ranged: u.ranged && { name: u.ranged.name, usage: u.ranged.usage, dmg: u.ranged.text, follow: u.ranged.followText, skill: u.ranged.level, acc: u.ranged.acc, rof: u.ranged.rof, range: u.ranged.range },
      melee: u.melee && { name: u.melee.name, usage: u.melee.usage, dmg: u.melee.text + (u.melee.dmg ? ` = ${fmtDice(u.melee.dmg)}` : "") + (u.melee.rend ? `; rending hit (${u.melee.rendBy}+) ${fmtDice(u.melee.rend)}` : ""), skill: u.melee.level },
      shield: u.shield,
    };
  }
  function fmtDice(d) {
    return `${d.n}d${d.add > 0 ? "+" + d.add : d.add < 0 ? d.add : ""}${d.mult !== 1 ? "x" + d.mult : ""}${d.div !== 1 ? `(${d.div === Infinity ? "∞" : d.div})` : ""} ${d.type}${d.ex ? " ex" : ""}`;
  }

  // ---------------------------------------------------------------- wounding
  const BASE = { "pi-": 0.5, pi: 1, "pi+": 1.5, "pi++": 2, imp: 2, cut: 1.5, cr: 1, burn: 1, tox: 1, cor: 1 };
  const UNLIVING = { "pi-": 0.2, pi: 1 / 3, "pi+": 0.5, "pi++": 1, imp: 1 };
  const HOMOG = { "pi-": 0.1, pi: 0.2, "pi+": 1 / 3, "pi++": 0.5, imp: 0.5 };
  function woundMult(type, loc, flags, ex) {
    const brain = (loc === "skull" || loc === "eye") && !flags.nobrain && !flags.homogenous;
    if (loc === "skull" && brain) return type === "tox" ? 1 : 4;
    if (loc === "eye" && brain && (type.startsWith("pi") || type === "imp" || (type === "burn" && !ex))) return 4;
    if (loc === "vitals" && (flags.unliving || flags.homogenous || flags.novitals)) loc = "torso";
    if (loc === "vitals") return type.startsWith("pi") || type === "imp" ? 3 : type === "burn" && !ex ? 2 : BASE[type] ?? 1;
    let m = BASE[type] ?? 1;
    if (loc === "face" && type === "cor") m = 1.5;
    if (loc === "neck") m = type === "cut" ? 2 : (type === "cr" || type === "cor") ? 1.5 : m;
    if (["arm", "leg", "hand", "foot"].includes(loc) && (type === "pi+" || type === "pi++" || type === "imp")) m = 1;
    if (flags.homogenous && HOMOG[type] != null) m = Math.min(m, HOMOG[type]);
    else if (flags.unliving && UNLIVING[type] != null && loc !== "skull" && loc !== "eye") m = Math.min(m, UNLIVING[type]);
    return m;
  }
  function hitLocation() {
    const r = roll3();
    if (r <= 4) return "skull";
    if (r === 5) return d6() === 1 ? "eye" : "face";
    if (r <= 7 || r === 13 || r === 14) return "leg";
    if (r === 8 || r === 12) return "arm";
    if (r <= 10) return "torso";
    if (r === 11) return "groin";
    if (r === 15) return "hand";
    if (r === 16) return "foot";
    return "neck";
  }

  // ------------------------------------------------------------------ hex map
  // Axial coordinates (q, r), flat-topped hexes, 1 yard each (B384).
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const hexDist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
  const px = h => [1.5 * h.q, Math.sqrt(3) * (h.r + h.q / 2)];
  const key = (q, r) => q + "," + r;
  const DIRANG = DIRS.map(([q, r]) => { const [x, y] = px({ q, r }); return Math.atan2(y, x); });
  // arc of `from` as seen by a model at `at` facing `facing`: front (3 hexes), side, rear (B385-386)
  function arcOf(at, facing, from) {
    const [ax, ay] = px(at), [bx, by] = px(from);
    let d = Math.abs(Math.atan2(by - ay, bx - ax) - DIRANG[facing]) * 180 / Math.PI;
    if (d > 180) d = 360 - d;
    return d <= 91 ? "front" : d <= 151 ? "side" : "rear";
  }
  function faceToward(at, to) {
    const [ax, ay] = px(at), [bx, by] = px(to);
    const a = Math.atan2(by - ay, bx - ax);
    let best = 0, bd = 9;
    DIRANG.forEach((d, i) => { let x = Math.abs(a - d); if (x > Math.PI) x = 2 * Math.PI - x; if (x < bd) { bd = x; best = i; } });
    return best;
  }
  // offset (column, row) to axial, flat-topped "odd-q" layout: a column is a straight line of hexes
  const fromOffset = (col, row) => ({ q: col, r: row - (col - (col & 1)) / 2 });

  // called-shot locations and their penalties (B398-399)
  // Chinks in Armor (B400): an aimed attack at a gap in the armour, -8 on the torso and -10 anywhere else, halves the armour's DR.
  // Planned locations carry a "#c" suffix; only aiming attackers (elites by default) consider them.
  const CHINK = loc => loc === "torso" ? -8 : -10;
  const locName = l => l && l.endsWith("#c") ? "chink in the " + l.slice(0, -2) + " armour" : l;
  const AIM = { torso: 0, vitals: -3, skull: -7, eye: -9, face: -5, neck: -5, groin: -3, arm: -2, leg: -2, hand: -4, foot: -4 };
  const COVERED = new Set(["leg", "foot", "groin"]);
  const COVER_DR = { none: 0, light: 15, heavy: 60 };

  // ------------------------------------------------------------------ battle
  function runBattle(unitSpecs, opt = {}) {
    const distance = Math.max(2, Math.round(opt.distance ?? 100)), maxTurns = opt.maxTurns ?? 1200, morale = opt.morale !== false;
    const frac = opt.health === "fractional", boxes = opt.boxes || 5;
    // hit locations: "elite" (default: elites aim, everyone else hits random locations), "aimed" (everyone, RAW), "random"
    const locMode = opt.locations || "elite";
    const aimsShots = m => locMode === "aimed" || (locMode === "elite" && m.u.elite);
    const cover = opt.cover || ["none", "none"];
    const log = opt.log ? [] : null;
    const frames = opt.frames ? [] : null;
    const L = s => { if (log && log.length < 5000) log.push(s); };
    const units = unitSpecs.map(s => buildUnit(s.spec, s.side));
    const models = [];
    const occ = new Map();
    const place = (m, h) => { if (m.h) occ.delete(key(m.h.q, m.h.r)); m.h = h; if (h) occ.set(key(h.q, h.r), m); };
    // deployment: each side's units side by side in lines facing the enemy, models 2 yards apart,
    // ranks of ten with deeper ranks behind; each side's frontage is centred on the same axis
    const width = [0, 0];
    units.forEach(u => { width[u.side] += 2 * Math.min(u.count, 10) + 4; });
    const row0 = [-Math.floor((width[0] - 4) / 2), -Math.floor((width[1] - 4) / 2)];
    units.forEach((u, ui) => {
      u.idx = ui; u.models = []; u.routed = false; u.checked50 = false; u.checked25 = false;
      const perRank = Math.min(u.count, 10);
      for (let i = 0; i < u.count; i++) {
        const rank = Math.floor(i / perRank), file = i % perRank;
        const col = u.side === 0 ? -2 * rank : distance + 2 * rank;
        const row = row0[u.side] + 2 * file;
        const m = { u, id: `${u.name} #${i + 1}`, hp: u.HP, fp: u.fp, state: "ok", shock: 0, stunned: false,
          facing: u.side === 0 ? 0 : 3, prone: false, moved: false, aimTurns: 0, aimTarget: null, lastTarget: null,
          ammo: u.ranged ? u.ranged.shots.mag : 0, reload: 0, jam: 0, gunBroken: false, conc: 0,
          sp: u.shield ? u.shield.sp : 0, spHit: -99, spCollapsed: false,
          parries: 0, retreated: false, blocked: false, attacked: false, aoa: false, aod: false, feint: null,
          reanim: 0, dmgDealt: 0, kills: 0, armsLost: 0, legsLost: 0, grips: [], holding: null, pinned: false,
          waiting: null, zone: null, grenadesLeft: u.grenades.map(g => g.count), grenadeReady: null,
          wounds: {}, pain: 0, painSev: 0, halfMove: false, halfDodge: false, gawd: 0, crippled: {} };
        let h = fromOffset(col, row);
        while (occ.has(key(h.q, h.r))) h = fromOffset(h.q + (u.side ? 1 : -1), row);
        place(m, h);
        u.models.push(m); models.push(m);
      }
      row0[u.side] += 2 * perRank + 4;
    });

    const active = m => m.state === "ok";
    const unitActive = u => !u.routed && u.models.some(active);
    const sideActive = s => units.some(u => u.side === s && unitActive(u));
    const foes = m => models.filter(x => x.state === "ok" && x.u.side !== m.u.side && !x.u.routed);
    const inCover = m => cover[m.u.side] !== "none" && !m.moved;

    // skill penalty from shock (standard), or the larger of shock and pain plus wound effects (fractional)
    const skillPen = m => (frac ? Math.max(m.shock, m.pain) + m.gawd : Math.min(4, m.shock)) + (m.armsLost ? 4 : 0);
    const dodgeOf = t => (t.halfDodge ? Math.floor(t.u.dodge / 2) : t.u.dodge);
    const moveOf = m => m.legsLost ? 1 : m.halfMove ? Math.max(1, Math.floor(m.u.move / 2)) : m.u.move;

    // ---- Revised Fractional Health (the user's house rule; after panoptesv.com's wound rules).
    const SEVN = ["", "Scratch", "Minor", "Moderate", "Major", "Critical", "Massive", "Gawdawful", "Destruction"];
    const FRAC = [0, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8];
    const COLS = lvl => lvl === 2 ? [1, 1.125, 1.375, 1.625] : [1, 1.25, 1.5, 1.75];
    const thr = (HP, lvl, col = 1) => Math.max(1, Math.round(HP * FRAC[lvl] * COLS(lvl)[col - 1]));
    function severity(inj, HP) { let s = 0; for (let l = 1; l <= 8; l++) if (inj >= thr(HP, l)) s = l; return s; }
    function boxesFor(inj, HP, lvl) { let n = 0; for (let c = 1; c <= 4; c++) if (inj >= thr(HP, lvl, c)) n = c; return Math.max(1, n); }
    function incapacitate(t, why) { if (t.state === "ok") { t.state = "out"; place(t, null); L(`  ${t.id} ${why}`); } }
    function cripple(t, loc) {
      if (loc === "arm" || loc === "hand") {
        if (++t.armsLost >= 2) { incapacitate(t, "has lost the use of both arms"); return; }
        L(`  ${t.id}'s ${loc} is crippled: fights one-handed (-4)`);
      } else {
        t.legsLost++; t.prone = true; t.halfDodge = true;
        L(`  ${t.id}'s ${loc} is crippled: falls and can only crawl`);
      }
    }
    function fracInjure(att, t, inj, loc, type) {
      att.dmgDealt += inj;
      const f = t.u.flags, HT = t.u.HT;
      const numb = f.homogenous || f.diffuse;   // Unliving counts as ordinary Injury Tolerance (user direction)
      let sev = severity(inj, t.u.HP);
      if (f.diffuse && sev > 2) sev = 2;
      if (!sev) { L(`  ${inj} injury is too slight to count`); return; }
      const limb = ["arm", "hand", "leg", "foot"].includes(loc);
      const k = limb ? loc + (R() < 0.5 ? "L" : "R") : loc;
      const W = t.wounds[k] ||= Array(9).fill(0);
      const prevBad = W[4] + W[5];
      const nBox = boxesFor(inj, t.u.HP, sev);
      if (!(type === "cr" && sev <= 2)) {
        let top = sev;
        for (let i = 0; i < nBox; i++) { let l = sev; while (l < 8 && W[l] >= boxes) l++; W[l]++; top = Math.max(top, l); }
        sev = top;
      }
      L(`  ${SEVN[sev]} wound to ${loc} (${inj} injury vs HP ${t.u.HP}, ${nBox} box${nBox > 1 ? "es" : ""})`);
      if (sev === 8) { kill(att, t, "destroyed"); return; }
      const head = loc === "skull" || loc === "eye" || loc === "face", brain = loc === "skull" || loc === "eye";
      if (!numb && !f.hpt) t.shock = Math.max(t.shock, sev);
      if (!numb && sev >= 2) {
        const mod = head || loc === "vitals" ? [0, 0, -1, -2, -5, -6, -7, -8][sev] : [0, 0, 0, -1, -2, -3, -4, -5][sev];
        const r = check(HT + mod);
        if (!r.ok) {
          if (r.margin <= -5 && (sev >= 3 || head)) { incapacitate(t, "is knocked unconscious"); return; }
          t.stunned = true; L(`  ${t.id} is stunned`);
        }
      }
      if ((head || loc === "neck") && sev >= 6) { kill(att, t, "killed outright"); return; }
      if (loc === "vitals" && sev >= 6) { incapacitate(t, "goes down with a destroyed organ"); return; }
      if (brain && sev === 5 && !check(HT - 3 + (f.htk || 0)).ok) { kill(att, t, "dies of a brain wound"); return; }
      if ((loc === "neck" || loc === "vitals") && sev === 5 && !check(HT - 3 - (loc === "neck" ? 0 : 0)).ok) { incapacitate(t, "goes down, paralysed or bleeding out"); return; }
      if (sev === 6 && !check(HT - 3).ok) { incapacitate(t, "breaks and is incapacitated"); return; }
      if (sev === 7) {
        if (!check(HT - 5).ok) { incapacitate(t, "breaks and is incapacitated"); return; }
        t.halfMove = t.halfDodge = true; t.gawd++;
      }
      if (limb && (sev === 4 || sev === 5)) {
        const was = t.crippled[k];
        const ok = sev === 4 ? check(HT - 2 - 2 * prevBad).ok : check(HT - 5 - 3 * prevBad - (was ? 3 : 0)).ok;
        if ((!ok || sev === 5) && !was) { t.crippled[k] = true; cripple(t, loc); if (t.state !== "ok") return; }
      }
      if (!numb && sev >= 3 && (sev > t.painSev || sev >= 5)) {
        t.painSev = Math.max(t.painSev, sev);
        const r = check(HT + [0, 0, 0, 0, -1, -2, -3, -4][sev] + (f.hpt ? 2 : 0));
        if (!r.ok) {
          if (sev === 7 || r.margin <= -5) { incapacitate(t, "collapses in agony"); return; }
          let pain = [0, 0, 0, 2, 4, 6, 6][sev];
          if (f.hpt) pain = Math.floor(pain / 2);
          t.pain = Math.max(t.pain, pain);
          if (sev >= 4) t.halfMove = t.halfDodge = true;
          L(`  ${t.id} is in pain (-${t.pain})`);
        }
      }
    }
    function injure(att, t, inj, loc, type) {
      if (inj <= 0 || t.state !== "ok") return;
      if (frac) return fracInjure(att, t, inj, loc, type);
      const HP = t.u.HP, before = t.hp;
      t.hp -= inj;
      att.dmgDealt += inj;
      if (!t.u.flags.hpt) t.shock = Math.min(4, t.shock + inj);
      // crippling (B420-421): injury over HP/2 to a limb, HP/3 to an extremity
      const lim = loc === "arm" || loc === "leg" ? HP / 2 : loc === "hand" || loc === "foot" ? HP / 3 : Infinity;
      if (inj > lim) cripple(t, loc);
      if (t.state !== "ok") return;
      if (inj > HP / 2) {
        const mod = (t.u.flags.hpt ? 3 : 0) + (loc === "skull" || loc === "eye" ? -10 : loc === "face" || loc === "vitals" ? -5 : 0);
        if (!check(t.u.HT + mod).ok) { t.stunned = true; t.prone = true; L(`  ${t.id} is knocked down and stunned`); }
      }
      if (t.hp <= -5 * HP) { kill(att, t, "destroyed"); return; }
      for (let k = 1; k <= 4; k++) {
        if (before > -k * HP && t.hp <= -k * HP && t.state === "ok") {
          if (!check(t.u.HT + (t.u.flags.htk || 0)).ok) { kill(att, t, "killed"); return; }
        }
      }
    }
    function kill(att, t, how) {
      if (t.state !== "ok") return;
      place(t, null);
      if (t.u.flags.reanimation && how !== "destroyed" && t.hp > -5 * t.u.HP) {
        t.state = "down"; t.reanim = 3; L(`  ${t.id} falls; reanimation protocols engage`);
      } else { t.state = "dead"; L(`  ${t.id} is ${how}`); }
      att.kills++;
    }

    // ---- damage to a model at a location. Returns injury.
    function applyHit(att, w, t, loc, ranged, halfD, dmgOverride, rawOverride) {
      const chink = loc.endsWith("#c");
      if (chink) loc = loc.slice(0, -2);
      const dmg = dmgOverride || w.dmg;
      let raw = rawOverride != null ? rawOverride : rollDamage(dmg);
      if (halfD) raw = Math.floor(raw / 2);
      let fraw = w.follow && rawOverride == null ? rollDamage(w.follow) : 0;
      const basic = raw;
      const sh = t.u.shield;
      if (sh && t.sp > 0 && (ranged || !sh.ranged_only)) {
        t.spHit = turn;
        if (raw <= t.sp) { t.sp -= raw; if (fraw) t.sp = Math.max(0, t.sp - fraw); L(`  shield holds (${t.sp} SP left)`); return 0; }
        raw -= t.sp; t.sp = 0; t.spCollapsed = true; fraw = 0; L(`  shield collapses`);
      }
      const coverDR = ranged && COVERED.has(loc) && inCover(t) ? COVER_DR[cover[t.u.side]] : 0;
      const armDR = Math.floor(drAt(t.u.arm.dr, loc === "vitals" ? (t.u.arm.dr.vitals != null ? "vitals" : "torso") : loc) / (chink ? 2 : 1)) + coverDR;
      if (chink) L(`  strikes a chink in the armour`);
      const natDR = drAt(t.u.nat, loc === "vitals" ? "torso" : loc) + (loc === "skull" ? 2 : 0);
      const div = dmg.div;
      const eff = dr => dr <= 0 ? 0 : div === Infinity ? 0 : Math.max(1, Math.floor(dr / div));
      let DR = eff(armDR + natDR);
      let pen = raw - DR;
      if (pen <= 0 && !chink && armDR > 0 && t.u.arm.wp && roll3() <= t.u.arm.wp) {
        DR = eff(Math.floor(armDR / 2) + natDR); pen = raw - DR;
        if (pen > 0) L(`  finds a weak point`);
      }
      // knockback (B378) from crushing and cutting blows
      if ((dmg.type === "cr" || dmg.type === "cut") && !ranged && t.state === "ok" && !t.grips.length) knockback(att, t, basic);
      if (pen <= 0) { L(`  ${raw} dmg to ${loc} fails to penetrate DR ${armDR + natDR}${div !== 1 ? "/" + (div === Infinity ? "∞" : div) : ""}`); return 0; }
      const flags = t.u.flags, poison = flags.poison;
      let inj = dmg.type === "tox" && poison === "immune" ? 0 : Math.max(1, Math.floor(pen * woundMult(dmg.type, loc, flags, dmg.ex)));
      if (dmg.type === "tox" && poison === "resist") inj = Math.floor(inj / 2);
      const red = flags.dmgRed > 1 ? flags.dmgRed : 1;
      if (red > 1 && inj > 0) inj = Math.max(1, Math.floor(inj / red));
      const cap = frac ? Infinity : loc === "arm" || loc === "leg" ? Math.floor(t.u.HP / 2) + 1 : loc === "hand" || loc === "foot" ? Math.floor(t.u.HP / 3) + 1 : Infinity;
      inj = Math.min(inj, cap);
      let finj = 0;
      if (w.follow && fraw > 0) {
        const ft = w.follow.type;
        if (!(ft === "tox" && poison === "immune")) {
          finj = Math.max(1, Math.floor(fraw * woundMult(ft, ["arm", "leg", "hand", "foot"].includes(loc) ? loc : "torso", flags, w.follow.ex)));
          if (ft === "tox" && poison === "resist") finj = Math.floor(finj / 2);
          if (red > 1 && finj > 0) finj = Math.max(1, Math.floor(finj / red));
          finj = Math.max(0, Math.min(finj, cap - inj));
        }
      }
      L(`  ${raw} dmg to ${loc} (DR ${armDR + natDR}${div !== 1 ? "/" + (div === Infinity ? "∞" : div) : ""}): ${inj} injury${finj ? ` + ${finj} follow-up` : ""}${frac ? "" : `; ${t.id} at ${t.hp - inj - finj}/${t.u.HP} HP`}`);
      injure(att, t, inj + finj, loc, dmg.type);
      return inj + finj;
    }
    function knockback(att, t, basic) {
      const st = Math.max(3, t.u.st + (t.u.arm.lifting || 0));
      const kb = Math.floor(basic / Math.max(1, st - 2));
      if (kb < 1 || !t.h) return;
      const dir = faceToward(att.h, t.h);
      let h = t.h;
      for (let i = 0; i < kb; i++) { const n = { q: h.q + DIRS[dir][0], r: h.r + DIRS[dir][1] }; if (occ.has(key(n.q, n.r))) break; h = n; }
      if (h !== t.h) place(t, h);
      if (!check(t.u.dx - (kb - 1)).ok) { t.prone = true; L(`  ${t.id} is knocked back ${kb} yd and falls`); }
      else L(`  ${t.id} is knocked back ${kb} yd`);
    }

    // ---- area effects (B413-414)
    const noDiv = dm => dm.div === 1 ? dm : { ...dm, div: 1, key: (dm.key || "") + "nd" };
    function explosion(att, w, at, raw) {
      for (const x of models) {
        if (x.state !== "ok" || !x.h) continue;
        let d = hexDist(x.h, at);
        const lv = w.explosion || 1;
        if (d < 1 || d > 10 * lv) continue;
        if (w.thrown && d <= 3 && x !== att && dive(x)) d += 1;
        // Explosion level L (B107): each level past the first widens the burst; distance counts as yards / L
        const splash = Math.floor(raw / (3 * Math.max(1, d / lv)));
        // only the model struck directly faces the armour divisor; the blast around it has none (B414)
        if (splash >= 1) { L(`  blast catches ${x.id} (${d} yd)`); applyHit(att, { dmg: noDiv(w.dmg), follow: null }, x, "torso", true, false, noDiv(w.dmg), splash); }
      }
      const fr = w.dmg.frag;
      if (fr) {
        const fd = parseDamage(`${fr.n}d ${fr.type}`);
        for (const x of models) {
          if (x.state !== "ok" || !x.h) continue;
          const d = hexDist(x.h, at);
          if (d > 5 * fr.n) continue;
          const r = check(15 + rangePenalty(Math.max(1, d)) + x.u.sm - (x.prone ? 2 : 0));
          if (r.ok) { L(`  fragment hits ${x.id}`); applyHit(att, { dmg: fd, follow: null }, x, hitLocation(), true, false, fd); }
        }
      }
    }

    // ---- expected injury of weapon w against unit tu at a location (cached per battle)
    const EXP = new Map();
    function expInj(w, tu, loc, dmgOverride) {
      const chink = loc.endsWith("#c");
      if (chink) loc = loc.slice(0, -2);
      const d = dmgOverride || w.dmg;
      const k = w.id + "|" + tu.idx + "|" + loc + (chink ? "#c" : "") + "|" + (dmgOverride ? dmgOverride.key || "r" : "");
      if (EXP.has(k)) return EXP.get(k);
      const armDR = Math.floor(drAt(tu.arm.dr, loc === "vitals" ? (tu.arm.dr.vitals != null ? "vitals" : "torso") : loc) / (chink ? 2 : 1));
      const natDR = drAt(tu.nat, loc === "vitals" ? "torso" : loc) + (loc === "skull" ? 2 : 0);
      const effDR = d.div === Infinity ? 0 : Math.floor((armDR + natDR) / d.div);
      const red = tu.flags.dmgRed > 1 ? tu.flags.dmgRed : 1;
      const cap = loc === "arm" || loc === "leg" ? tu.HP / 2 + 1 : loc === "hand" || loc === "foot" ? tu.HP / 3 + 1 : Infinity;
      const avgF = w.follow ? (w.follow.n * 3.5 + w.follow.add) * w.follow.mult : 0;
      let tot = 0;
      // Weak Points: a hit that fails to penetrate finds a gap on 3d <= rating and faces half the armour's DR
      const wpP = !chink && armDR > 0 && tu.arm.wp ? P3[Math.min(18, tu.arm.wp)] : 0;
      const halfDR = d.div === Infinity ? 0 : Math.floor((Math.floor(armDR / 2) + natDR) / d.div);
      const injOf = pen => Math.min(cap, ((d.type === "tox" && tu.flags.poison === "immune" ? 0 : pen * woundMult(d.type, loc, tu.flags, d.ex)) + avgF) / red);
      for (let i = 0; i < 20; i++) {
        const raw = rollDamage(d), pen = raw - effDR;
        if (pen > 0) tot += injOf(pen);
        else if (wpP && raw - halfDR > 0) tot += wpP * injOf(raw - halfDR);
      }
      const v = tot / 20;
      EXP.set(k, v);
      return v;
    }
    const RANDOM_LOCS = [["skull", 4], ["face", 5], ["eye", 1], ["leg", 25 + 36], ["arm", 21 + 25], ["torso", 52], ["groin", 27], ["hand", 10], ["foot", 6], ["neck", 4]];
    function expInjRandom(w, tu, dmgOverride) {
      let s = 0;
      for (const [loc, n] of RANDOM_LOCS) s += n * expInj(w, tu, loc, dmgOverride);
      return s / 216;
    }
    // best location and deceptive level: returns {loc, da, score, lvl}
    function planAttack(m, w, t, lvl, melee, dmgOverride) {
      const locs = aimsShots(m) || (melee && t.pinned) ? [...Object.keys(AIM), ...Object.keys(AIM).filter(l => l !== "eye" && drAt(t.u.arm.dr, l === "vitals" ? "torso" : l) > 0).map(l => l + "#c")] : ["random"];
      const def0 = melee ? bestDefence(t, m, true) : w.malediction ? (w.fp && t.u.flags.blank ? 99 : w.resist === "HT" ? t.u.HT : t.u.will) - 2 : rangedDefence(t, m);
      let best = { loc: "torso", da: 0, score: 0, lvl };
      for (const loc of locs) {
        const pen = loc === "random" ? 0 : loc.endsWith("#c") ? Math.min(AIM[loc.slice(0, -2)], CHINK(loc.slice(0, -2))) : AIM[loc];
        if (loc === "eye" && !(/^pi/.test(w.dmg.type) || w.dmg.type === "imp" || (w.dmg.type === "burn" && !w.dmg.ex && !w.cone))) continue;
        const e = loc === "random" ? expInjRandom(w, t.u, dmgOverride) : expInj(w, t.u, loc, dmgOverride);
        if (e <= 0) continue;
        const maxDa = melee ? 6 : 0;
        for (let da = 0; da <= maxDa; da++) {
          const eff = lvl + pen - 2 * da;
          if (eff < 3) break;
          const pHit = P3[Math.min(18, eff)];
          const pDef = def0 == null ? 0 : P3[Math.max(0, Math.min(18, def0 - da))];
          const hits = melee ? 1 : Math.min(w.rof || 1, 1 + Math.max(0, eff - 10) / (w.rcl || 1));
          const score = pHit * (1 - pDef) * e * hits;
          if (score > best.score) best = { loc, da, score, lvl: eff };
        }
      }
      return best;
    }

    // ---- defence
    function arcTo(t, att) { return att && att.h && t.h ? arcOf(t.h, t.facing, att.h) : "front"; }
    function bestDefence(t, att, melee) {
      if (t.state !== "ok" || t.aoa || t.pinned) return null;
      const arc = arcTo(t, att);
      if (arc === "rear") return null;
      const mod = (arc === "side" ? -2 : 0) - (t.stunned ? 4 : 0) - (t.prone ? 3 : 0) + (t.aod ? 2 : 0) + (arc !== "rear" ? t.u.db : 0);
      let d = dodgeOf(t) + (melee && !t.retreated && !t.stunned ? 3 : 0);
      if (melee && t.u.parry != null && !(t.u.melee.unbalanced && t.attacked) && t.armsLost < 2)
        d = Math.max(d, t.u.parry + (!t.retreated && !t.stunned ? 1 : 0) - 4 * t.parries);
      if (melee && t.u.db && !t.blocked) d = Math.max(d, Math.floor(t.u.dx / 2) + 3 + (!t.retreated && !t.stunned ? 1 : 0));
      return d + mod;
    }
    function rangedDefence(t, att) {
      if (t.state !== "ok" || t.aoa) return null;
      const arc = arcTo(t, att);
      if (arc === "rear") return null;
      return dodgeOf(t) + (arc === "side" ? -2 : 0) - (t.stunned ? 4 : 0) - (t.prone ? 3 : 0) + (t.aod ? 2 : 0) + t.u.db;
    }
    // resolve a defence roll; returns margin (>=0) on success or null
    function defend(t, att, melee, da, feint) {
      if (t.state !== "ok" || t.aoa || t.pinned) return null;
      if (t.grips.length) t.retreated = true;   // held: no retreat
      const arc = arcTo(t, att);
      if (arc === "rear") return null;
      const mod = (arc === "side" ? -2 : 0) - (t.stunned ? 4 : 0) - (t.prone ? 3 : 0) + (t.aod ? 2 : 0) + t.u.db - da - (feint || 0);
      if (!melee) {
        let d = dodgeOf(t) + mod + feverish(t, att, false, dodgeOf(t) + mod);
        // Dodge and Drop (B377): a shooter not in melee drops prone for +3
        let drop = false;
        if (!t.prone && t.u.stance === "shoot" && (t.u.ranged || t.u.powers.some(p => !p.melee)) && !engaged(t)) { d += 3; drop = true; }
        const r = check(d);
        if (drop) t.prone = true;
        return r.ok ? Math.max(0, r.margin) : null;
      }
      const opts = [{ how: "dodge", v: dodgeOf(t) + (!t.retreated && !t.stunned ? 3 : 0), retreat: true }];
      if (t.u.parry != null && !(t.u.melee.unbalanced && t.attacked) && t.armsLost < 2)
        opts.push({ how: "parry", v: t.u.parry + (!t.retreated && !t.stunned ? 1 : 0) - 4 * t.parries - (t.grips.length ? 4 : 0), retreat: true });
      if (t.u.db && !t.blocked) opts.push({ how: "block", v: Math.floor(t.u.dx / 2) + 3 + (!t.retreated && !t.stunned ? 1 : 0), retreat: true });
      const o = opts.reduce((a, b) => b.v > a.v ? b : a);
      if (o.how === "parry") t.parries++;
      if (o.how === "block") t.blocked = true;
      if (o.retreat && !t.stunned) t.retreated = true;
      const r = check(o.v + mod + feverish(t, att, true, o.v + mod));
      return r.ok ? { how: o.how, margin: Math.max(0, r.margin) } : null;
    }

    // ---- threat: expected harm a foe can do to m this turn (for All-Out Attack / Defense choices)
    function threatTo(m) {
      let t = 0;
      for (const f of foes(m)) {
        if (!f.h || !m.h) continue;
        const d = hexDist(f.h, m.h);
        const w = d <= f.u.melee.reachMax ? f.u.melee : f.u.ranged && d <= f.u.ranged.range.max ? f.u.ranged : null;
        if (w) t += expInj(w, m.u, "torso");
      }
      return t;
    }
    const engaged = m => m.h && foes(m).some(f => f.h && hexDist(f.h, m.h) <= Math.max(f.u.melee.reachMax, m.u.melee.reachMax));

    // ---- movement: greedy steps through free hexes toward a goal hex
    function stepToward(m, goal, steps, stopAt = 1) {
      let moved = 0;
      while (moved < steps && hexDist(m.h, goal) > stopAt) {
        let best = null, bd = hexDist(m.h, goal);
        for (const [dq, dr] of DIRS) {
          const n = { q: m.h.q + dq, r: m.h.r + dr };
          if (occ.has(key(n.q, n.r))) continue;
          const d = hexDist(n, goal);
          if (d < bd || (d === bd && (!best || R() < 0.3))) { bd = d; best = n; }
        }
        if (!best) break;
        place(m, best); moved++;
        if (afterStep(m)) break;
      }
      if (moved) { m.moved = true; m.aimTurns = 0; }
      return moved;
    }
    // breadth-first search through free hexes for the nearest hex from which a foe is within reach: a mob flows
    // around its own front rank and spreads over every foe with room left beside it, instead of queueing on one
    function engagePath(m, reach, pool, maxNodes = 2500) {
      const slots = new Map();
      for (const f of pool) {
        if (!f.h) continue;
        for (let dq = -reach; dq <= reach; dq++) for (let dr = Math.max(-reach, -dq - reach); dr <= Math.min(reach, -dq + reach); dr++) {
          if (!dq && !dr) continue;
          const k = key(f.h.q + dq, f.h.r + dr);
          if (!occ.has(k) && !slots.has(k)) slots.set(k, f);
        }
      }
      if (!slots.size) return null;
      const start = key(m.h.q, m.h.r), prev = new Map([[start, null]]), q = [m.h];
      for (let i = 0; i < q.length && prev.size < maxNodes; i++) {
        const h = q[i], hk = key(h.q, h.r);
        if (hk !== start && slots.has(hk)) {
          const path = [];
          for (let k = hk, n = h; k !== start; ) { path.unshift(n); const p = prev.get(k); k = key(p.q, p.r); n = p; }
          return { path, foe: slots.get(hk) };
        }
        for (const [dq, dr] of DIRS) {
          const n = { q: h.q + dq, r: h.r + dr }, nk = key(n.q, n.r);
          if (prev.has(nk) || occ.has(nk)) continue;
          prev.set(nk, h); q.push(n);
        }
      }
      return null;
    }
    function followPath(m, path, steps) {
      let moved = 0;
      for (const n of path) { if (moved >= steps || occ.has(key(n.q, n.r))) break; place(m, n); moved++; if (afterStep(m)) break; }
      if (moved) { m.moved = true; m.aimTurns = 0; }
      return moved;
    }
    function nearestFoe(m, pool) {
      let best = null, bd = Infinity;
      for (const f of pool || foes(m)) { if (!f.h) continue; const d = hexDist(f.h, m.h); if (d < bd) { bd = d; best = f; } }
      return best;
    }

    // ---- attacks
    function jamCheck(m, w, r) {
      if (!w.malf || r.crit) return false;
      let malf = w.malf;
      if (/^Ork /.test(m.u.template) && m.u.models.filter(active).length >= 10) malf += 1;   // WAAAGH! (framework)
      if (r.roll < malf) return false;
      if (r.fumble && w.overheat) {
        L(`  ${m.id}'s ${w.name} overheats`);
        applyHit(m, { dmg: w.overheat, follow: null }, m, "torso", false, false, w.overheat);
        m.gunBroken = true;
      } else { m.jam = d6(); L(`  ${m.id}'s ${w.name} malfunctions (${m.jam} s to clear)`); }
      return true;
    }
    function fireAt(m, w, target, opts) {
      const d = Math.max(1, hexDist(m.h, target.h));
      if (d > w.range.max) return;
      const shots = w.shots.mag === Infinity ? w.rof : Math.min(w.rof, m.ammo);
      if (w.shots.mag !== Infinity) m.ammo -= shots;
      m.attacked = true;
      if (w.fp) { m.fp -= w.fp; }
      if (w.perils && perils(m, w)) return;
      const aimBonus = opts.aim ? w.acc + (m.aimTurns >= 3 ? 2 : m.aimTurns >= 2 ? 1 : 0) : 0;
      // Malediction (B106): no active defence; a Quick Contest against the target's Will (or HT), with range penalties
      // of -1/yard (level 1), the Size and Speed/Range Table (2) or long-distance modifiers (3, none inside 200 yd)
      if (w.malediction) {
        if (w.fp && target.u.flags.blank) { L(`${m.id} casts ${w.name} at ${target.id}: the power dies against a blank`); m.aimTurns = 0; return; }
        const lvl = w.level - skillPen(m) + (w.malediction === 1 ? -d : w.malediction === 2 ? rangePenalty(d) : 0) + (opts.aoa ? 1 : 0);
        const plan = planAttack(m, w, target, lvl, false), loc0 = plan.loc === "random" ? null : plan.loc;
        const r = check(plan.lvl), res = check(w.resist === "HT" ? target.u.HT : target.u.will);
        m.aimTurns = 0;
        const wins = r.ok && (!res.ok || r.margin > res.margin);
        L(`${m.id} casts ${w.name} at ${target.id} (${d} yd${loc0 && loc0 !== "torso" ? ", aiming at the " + locName(loc0) : ""}, skill ${plan.lvl} vs ${w.resist} ${w.resist === "HT" ? target.u.HT : target.u.will}): ${wins ? "it takes hold" : r.ok ? "resisted" : "fails"}`);
        if (!wins) return;
        const raw = rollDamage(w.dmg);
        applyHit(m, w, target, loc0 || hitLocation(), true, false, null, raw);
        if (w.dmg.ex && target.h) explosion(m, w, target.h, raw);
        return;
      }
      if (w.fp && target.u.flags.blank) { L(`${m.id} casts ${w.name} at ${target.id}: the power dies against a blank`); m.aimTurns = 0; return; }
      let base = w.level + (opts.pointBlank ? Math.min(0, w.bulk) : rangePenalty(d)) + target.u.sm - skillPen(m) + aimBonus - (opts.pen || 0)
        + (opts.moved ? Math.min(-2, w.bulk) : 0) + (opts.aoa ? 1 : 0) - (target.prone && !opts.pointBlank ? 2 : 0) - (inCover(target) && !opts.pointBlank ? 2 : 0);
      m.aimTurns = 0;
      // cones hit everyone in the cone; everything else may split automatic fire over neighbours (B373)
      const targets = [target];
      if (w.cone) {
        for (const x of models) if (x !== target && x.state === "ok" && x.h && x.u.side !== m.u.side && hexDist(x.h, target.h) <= Math.floor(w.cone / 2)) targets.push(x);
      } else if (shots >= 6) {
        const near = models.filter(x => x !== target && x.state === "ok" && x.h && x.u.side === target.u.side && hexDist(x.h, target.h) <= 2);
        const parts = Math.min(1 + near.length, shots >= 16 ? 3 : 2);
        while (targets.length < parts) targets.push(near.splice(Math.floor(R() * near.length), 1)[0]);
      }
      const halfD = d > w.range.half;
      targets.forEach((t, i) => {
        const n = w.cone ? 1 : Math.floor(shots / targets.length) + (i < shots % targets.length ? 1 : 0);
        const plan = planAttack(m, w, t, base + rapidBonus(n), false);
        const loc0 = plan.loc === "random" ? null : plan.loc;
        const lvl = plan.lvl;
        const r = check(lvl);
        if (i === 0 && jamCheck(m, w, r)) return;
        if (!r.ok && !w.cone) {
          L(`${m.id} fires ${n > 1 ? n + " " : ""}at ${t.id} (${d} yd${loc0 && loc0 !== "torso" ? ", aiming at the " + locName(loc0) : ""}, skill ${lvl}): misses`);
          if (w.dmg.ex && i === 0) explosion(m, w, { q: t.h.q + DIRS[Math.floor(R() * 6)][0], r: t.h.r + DIRS[Math.floor(R() * 6)][1] }, rollDamage(w.dmg));
          return;
        }
        let hits = w.cone ? 1 : Math.min(n, 1 + Math.floor(Math.max(0, r.margin) / w.rcl));
        L(`${m.id} ${w.usage === "power" ? "casts " + w.name + " at" : "fires " + (n > 1 ? n + " at" : "at")} ${t.id} (${d} yd${loc0 && loc0 !== "torso" ? ", aiming at the " + locName(loc0) : ""}, skill ${lvl}): ${hits} hit${hits > 1 ? "s" : ""}`);
        if (!r.crit && !w.malediction) {
          const def = defend(t, m, false, 0, 0);
          if (def != null) { const dg = Math.min(hits, 1 + def); hits -= dg; L(`  ${t.id} dodges ${dg}`); }
        }
        for (let k = 0; k < hits && t.state === "ok"; k++) {
          const loc = loc0 || hitLocation();
          const raw = rollDamage(w.dmg);
          applyHit(m, w, t, loc, true, halfD, null, halfD ? raw : raw);
          if (w.dmg.ex && k === 0 && t.h) explosion(m, w, t.h, raw);
          else if (w.dmg.ex && k === 0) explosion(m, w, t.lastH || m.h, raw);
        }
        if (w.blast && !w.dmg.ex && t.h) for (const x of models) if (x !== t && x.state === "ok" && x.h && hexDist(x.h, t.h) <= w.blast) {
          if (defend(x, m, false, 0, 0) == null) applyHit(m, w, x, "torso", true, halfD);
        }
      });
    }
    // Perils of the Warp (framework, warp.yaml): a Will roll on every casting; failure by 1-2 costs FP, 3-5 hurts
    // and fizzles, 6-9 hurts, stuns and fizzles, 10+ or a natural 18 is catastrophic. Returns true if the power fizzles.
    function perils(m, w) {
      const P = w.perils;
      const orks = /^Ork /.test(m.u.template) ? models.filter(x => x.state === "ok" && /^Ork /.test(x.u.template) && x.u.side === m.u.side).length : 0;
      const r = check(P.will + (orks >= 10 ? P.waaagh : 0));
      if (r.ok) return false;
      const by = -r.margin;
      if (by >= P.cat || r.roll === 18) { kill(m, m, "consumed by the warp (Perils of the Warp)"); return true; }
      if (by <= 2) { m.fp -= P.fp; L(`  ${m.id} strains against the warp (-${P.fp} FP)`); return false; }
      const d = by <= 5 ? P.modDmg : P.majDmg;
      L(`  Perils of the Warp! ${m.id}'s power backlashes`);
      if (d) injure(m, m, rollDamage(d), "torso", d.type);
      if (by >= 6 && m.state === "ok") m.stunned = true;
      return true;
    }
    function strike(m, w, t, opts) {
      const n = opts.double ? 2 : opts.rapid ? 2 : 1 + (m.u.flags.extraAttack || 0);
      for (let i = 0; i < n && t.state === "ok"; i++) {
        let lvl = w.level - skillPen(m) - (opts.charge ? 4 : 0) + (opts.determined ? 4 : 0) - (opts.rapid ? 6 : 0) + (m.evaluate && m.evaluate.t === t ? m.evaluate.n : 0)
          - (m.prone ? 4 : 0) - (m.grips.length ? 4 : 0) - (opts.pen || 0);
        if (opts.charge) lvl = Math.min(lvl, 9);
        const plan = planAttack(m, w, t, lvl, true);
        const loc = plan.loc === "random" ? hitLocation() : plan.loc;
        const feint = m.feint && m.feint.t === t ? m.feint.n : 0;
        const r = check(plan.lvl);
        m.attacked = true;
        if (w.fp) m.fp -= w.fp;
        if (w.perils && perils(m, w)) continue;
        if (!r.ok) { L(`${m.id} strikes at ${t.id} (${loc !== "torso" ? locName(loc) + ", " : ""}skill ${plan.lvl}): misses`); continue; }
        if (!r.crit) {
          const def = defend(t, m, true, plan.da, feint);
          if (def) { L(`${m.id} strikes at ${t.id}: ${def.how === "parry" ? "parried" : def.how === "block" ? "blocked" : "dodged"}`); if (def.how === "parry" && w.name === "Punch") cutsArm(t, m); continue; }
        }
        const rending = w.rend && (r.crit || r.margin >= w.rendBy);
        L(`${m.id} strikes ${t.id}${loc !== "torso" ? " in the " + locName(loc) : ""} with ${w.name}${rending ? " (rending hit)" : ""}`);
        let raw = rollDamage(rending ? w.rend : w.dmg);
        // All-Out Attack (Strong, B365) and Mighty Blows (extra effort, 1 FP, B357): each +2 or +1/die, whichever is more
        if (opts.strong) raw += Math.max(2, w.dmg.n);
        if (opts.mighty && m.fp > 1) { m.fp -= 1; raw += Math.max(2, w.dmg.n); L(`  ${m.id} puts everything into it (Mighty Blows, 1 FP)`); }
        applyHit(m, w, t, loc, false, false, rending ? w.rend : null, raw);
      }
      m.feint = null; m.evaluate = null;
    }

    // ---- choose and carry out a maneuver
    function weaponsFor(m, melee) {
      const out = [];
      if (melee) { if (m.armsLost < 2) out.push(m.u.melee); }
      else if (m.u.ranged && !m.gunBroken && !m.jam && m.armsLost < 2) out.push(m.u.ranged);
      for (const p of m.u.powers) if (!!p.melee === melee && m.fp - p.fp >= 0) out.push(p);
      return out;
    }
    function act(m) {
      const u = m.u;
      m.aoa = false; m.aod = false;
      clearZone(m); m.waiting = null;
      if (m.jam > 0) { m.jam--; if (!engaged(m)) { L(`${m.id} clears a jam`); return; } }
      const pool = foes(m);
      if (!pool.length) return;
      // stand up to fight in melee or to move
      const adj = pool.filter(f => f.h && hexDist(f.h, m.h) <= u.melee.reachMax);
      const shooter = u.ranged || u.powers.some(p => !p.melee);
      if (m.prone && !m.legsLost && (adj.length || u.stance !== "shoot" || !shooter)) { m.prone = false; L(`${m.id} gets up`); return; }
      if (adj.length) return fightInMelee(m, adj);
      const near = nearestFoe(m, pool);
      const d = hexDist(m.h, near.h);
      // concentrating on a power
      // an empty bio-weapon regrowing its ammunition isn't a weapon until it refills
      const rw = weaponsFor(m, false).filter(w => d <= w.range.max && !(w === u.ranged && w.natural && m.ammo <= 0 && w.shots.reload > 3));
      const bestR = rw.map(w => ({ w, s: planAttack(m, w, near, w.level + rangePenalty(d) + near.u.sm + (w.acc || 0), false).score })).sort((a, b) => b.s - a.s)[0];
      // close to melee when ordered to charge, when no gun can hurt the target, or (unless ordered to
      // hold and shoot) when the blade does clearly more harm than the gun
      const meleeScore = weaponsFor(m, true).reduce((s, w) => Math.max(s, planAttack(m, w, near, w.level, true).score * (1 + (u.flags.extraAttack || 0))), 0);
      const wantsMelee = u.stance === "charge" || !bestR || bestR.s <= 0 || (u.stance !== "shoot" && meleeScore > 1.5 * bestR.s);
      // grenades (B410): Ready one, then throw it at the best cluster (or the hardest target, for krak)
      if (u.grenades.length && u.stance !== "charge" && !m.grips.length && m.armsLost < 1) {
        const g = bestGrenade(m, pool);
        if (g && m.grenadeReady === g.i) { throwGrenade(m, g); return; }
        if (g && g.s > 2 * Math.max(bestR ? bestR.s : 0, wantsMelee ? meleeScore * 0.5 : 0)) { m.grenadeReady = g.i; L(`${m.id} readies a ${u.grenades[g.i].name}`); return; }
      }
      if (wantsMelee) {
        const mv = moveOf(m);
        const reach = u.melee.reachMax;
        // close in: near the foe, path to the nearest open hex beside any foe (a mob spreads round them);
        // far off, a straight greedy advance is enough
        const route = d <= 3 * mv + 12 ? engagePath(m, reach, pool) : null;
        const tgt = route ? route.foe : near;
        const len = route ? route.path.length : d - reach;
        const go = n => route ? followPath(m, route.path, n) : stepToward(m, near.h, n, reach);
        const stopped = () => m.state !== "ok" || m.stunned || m.prone || !m.h;
        // Slam (B371) when the weapon can't hurt the foe but the charger's mass can knock it down
        const hard = expInjRandom(u.melee, tgt.u) < 1;   // the weapon can't get through even when it lands
        const slamIt = len >= 2 && hard && !tgt.prone && !tgt.pinned && u.HP >= 0.8 * tgt.u.HP;
        const hit = (aoa, moved) => slamIt ? slam(m, tgt, Math.max(1, moved), aoa) : strike(m, u.melee, tgt, aoa ? { determined: true } : { charge: true });
        // All-Out Attack after a half move if that reaches (B365); otherwise Move and Attack or just close
        if (len <= Math.floor(mv / 2) && threatTo(m) < 1) {
          const moved = go(Math.floor(mv / 2)); if (stopped()) return; m.facing = faceToward(m.h, tgt.h);
          if (hexDist(m.h, tgt.h) <= reach) { m.aoa = true; L(`${m.id} charges in (All-Out Attack)`); hit(true, moved); return; }
        }
        const moved = go(mv); if (stopped()) return; m.facing = faceToward(m.h, tgt.h);
        if (tgt.h && hexDist(m.h, tgt.h) <= reach) hit(false, moved);
        return;
      }
      const w = bestR.w;
      if (m.reload > 0) { if (--m.reload <= 0) { m.reload = 0; m.ammo = w.shots.mag; } return; }
      if (m.ammo <= 0 && w === u.ranged) { m.reload = Math.max(1, w.shots.reload); if (w.shots.reload > 3) m.reload = 0; L(`${m.id} reloads`); return; }
      if (w.concentrate && m.conc < w.concentrate) { m.conc++; L(`${m.id} concentrates on ${w.name}`); return; }
      m.conc = 0;
      // choose the target: best expected harm among the nearest few
      const cands = pool.filter(f => f.h).sort((a, b) => hexDist(m.h, a.h) - hexDist(m.h, b.h)).slice(0, 6)
        .filter(f => hexDist(m.h, f.h) <= w.range.max);
      let target = m.aimTarget && m.aimTarget.state === "ok" && cands.includes(m.aimTarget) ? m.aimTarget : null;
      // spread fire: a foe that squad-mates are already shooting is worth less to one more shooter (no overkill)
      const claims = f => models.reduce((a, x) => a + (x !== m && x.u.side === u.side && x.state === "ok" && x.aimTarget === f ? 1 : 0), 0);
      if (!target) target = cands.map(f => ({ f, s: planAttack(m, w, f, w.level + rangePenalty(hexDist(m.h, f.h)) + f.u.sm, false).score / (1 + claims(f)) }))
        .sort((a, b) => b.s - a.s)[0]?.f || near;
      m.facing = faceToward(m.h, target.h);
      if (w === u.ranged && !engaged(m)) {
        // Wait (B366): hold fire for a dangerous charger that will reach us this turn, and shoot it as it closes
        const ch = pool.filter(f => f.h && !f.u.ranged && f.u.melee).map(f => ({ f, d: hexDist(m.h, f.h) }))
          .filter(x => x.d >= 3 && x.d - x.f.u.melee.reachMax <= moveOf(x.f) && nearestFoe(x.f) === m).sort((a, b) => a.d - b.d)[0];
        if (ch && expInjRandom(ch.f.u.melee, u) >= u.HP / 4) { m.waiting = w; L(`${m.id} waits for ${ch.f.id} to close (Wait)`); return; }
        // suppression fire (B409) over a cluster when it beats aimed fire
        if (w.rof >= 5 && (w.shots.mag === Infinity || m.ammo >= 5)) {
          let bestZ = null;
          for (const c of pool) {
            if (!c.h || hexDist(m.h, c.h) > w.range.max) continue;
            const inZ = pool.filter(x => x.h && hexDist(x.h, c.h) <= 1);
            if (inZ.length < 3) continue;
            const shots = w.shots.mag === Infinity ? w.rof : Math.min(w.rof, m.ammo);
            const v = inZ.reduce((a, x) => a + P3[Math.max(0, Math.min(18, Math.min(6, w.level - skillPen(m) + rangePenalty(Math.max(1, hexDist(m.h, x.h)))) + rapidBonus(shots) + x.u.sm))] * expInjRandom(w, x.u), 0);
            if (!bestZ || v > bestZ.v) bestZ = { c, v };
          }
          const now = planAttack(m, w, target, w.level - skillPen(m) + rangePenalty(hexDist(m.h, target.h)) + target.u.sm, false).score;
          if (bestZ && bestZ.v > 1.3 * now) { m.facing = faceToward(m.h, bestZ.c.h); suppress(m, w, bestZ.c.h); return; }
        }
      }
      // a shooter whose aimed roll would still be hopeless closes the range first (a power that costs FP isn't wasted)
      const td = hexDist(m.h, target.h);
      const unaimed = w.level - skillPen(m) + rangePenalty(td) + target.u.sm;
      if (td > 3 && unaimed + (w.acc || 0) < 8) {
        stepToward(m, target.h, moveOf(m), 2); if (m.state !== "ok" || !m.h || m.stunned) return; m.facing = faceToward(m.h, target.h);
        if (!w.fp) fireAt(m, w, target, { moved: true }); else L(`${m.id} closes in on ${target.id}`);
        return;
      }
      // advance under fire (Move and Attack, B365) only while the moving shot is still worth taking
      if (u.stance === "advance" && d > Math.min(w.range.half, 30) && unaimed + Math.min(-2, w.bulk || 0) >= 8) {
        stepToward(m, target.h, moveOf(m), 2); if (m.state !== "ok" || !m.h || m.stunned) return; m.facing = faceToward(m.h, target.h);
        fireAt(m, w, target, { moved: true }); return;
      }
      // Aim (B364): low-RoF accurate weapons aim at a new target, snipers keep aiming up to 3 turns
      const threat = threatTo(m);
      const sniper = w.rof === 1 && w.acc >= 5 && d > 50;
      // Aim only when it pays for the lost turn: the aimed roll must hit well over twice as often as a shot now
      const aimPays = P3[Math.max(0, Math.min(18, unaimed + w.acc + 1))] > 1.8 * P3[Math.max(0, Math.min(18, unaimed))];
      if (w.acc >= 2 && w.rof <= 3 && m.aimTurns === 0 && aimPays || (sniper && m.aimTarget === target && m.aimTurns > 0 && m.aimTurns < 3 && threat < 1)) {
        if (m.aimTarget !== target) m.aimTurns = 0;
        m.aimTarget = target; m.aimTurns++; L(`${m.id} aims at ${target.id}`); return;
      }
      const aim = m.aimTarget === target && m.aimTurns > 0;
      m.aimTarget = target;
      const aoa = threat < 1 && !engaged(m);
      if (aoa) m.aoa = true;
      fireAt(m, w, target, { aim, aoa });
    }
    // ---- grenades: expected harm of a throw at each foe (the one struck takes it all, the rest the blast and fragments)
    function bestGrenade(m, pool) {
      let best = null;
      m.u.grenades.forEach((g, i) => {
        if (!m.grenadesLeft[i]) return;
        for (const c of pool) {
          if (!c.h) continue;
          const d = hexDist(m.h, c.h);
          if (d < 3 || d > g.range.max) continue;
          const lvl = g.level - skillPen(m) + rangePenalty(d) + c.u.sm;
          // the target may Dodge (then it takes the blast at a yard, with no divisor)
          const dd = rangedDefence(c, m), pDodge = dd == null ? 0 : P3[Math.max(0, Math.min(18, dd))];
          let v = (1 - pDodge) * expInj(g, c.u, "torso") + pDodge * expInj(g, c.u, "torso", { ...g.dmg, div: 1, mult: g.dmg.mult / 3, key: "s1nd" });
          for (const x of pool) {
            if (x === c || !x.h) continue;
            const k = hexDist(x.h, c.h);
            if (k > 3) continue;
            v += expInj(g, x.u, "torso", { ...g.dmg, div: 1, mult: g.dmg.mult / (3 * k), key: "s" + k + "nd" });
            if (g.dmg.frag) v += P3[Math.max(0, Math.min(18, 15 + rangePenalty(k)))] * expInj(g, x.u, "torso", { n: g.dmg.frag.n, add: 0, mult: 1, div: 1, type: g.dmg.frag.type, key: "f" });
          }
          v *= P3[Math.max(0, Math.min(18, lvl))];
          if (!best || v > best.s) best = { i, c, s: v, lvl };
        }
      });
      return best;
    }
    // Diving for cover (B377): someone who sees a grenade land beside them may Dodge; success puts them a yard
    // further from the blast, prone
    function dive(x) {
      if (x.state !== "ok" || x.pinned || x.aoa || x.grips.length) return false;
      const r = check(dodgeOf(x) - (x.stunned ? 4 : 0) - (x.prone ? 3 : 0));
      if (!r.ok) return false;
      x.prone = true; L(`  ${x.id} dives for cover`);
      return true;
    }
    function throwGrenade(m, g) {
      const w = m.u.grenades[g.i], c = g.c;
      m.grenadeReady = null; m.grenadesLeft[g.i]--; m.attacked = true;
      m.facing = faceToward(m.h, c.h);
      const r = check(g.lvl);
      const raw = rollDamage(w.dmg);
      if (r.ok) {
        // a thrown grenade is an attack on its target, who may Dodge it (B377); a dodged grenade goes off a yard away
        const def = r.crit ? null : defend(c, m, false, 0, 0);
        if (def != null) {
          const off = DIRS[Math.floor(R() * 6)], at = { q: c.h.q + off[0], r: c.h.r + off[1] };
          L(`${m.id} throws a ${w.name} at ${c.id} (skill ${g.lvl}): ${c.id} dodges and it goes off a yard away`);
          const x0 = occ.get(key(at.q, at.r));
          if (x0 && x0.state === "ok" && x0 !== c) applyHit(m, { dmg: noDiv(w.dmg), follow: null }, x0, "torso", true, false, noDiv(w.dmg), raw);
          explosion(m, w, at, raw);
          return;
        }
        L(`${m.id} throws a ${w.name} at ${c.id} (skill ${g.lvl}): direct hit`);
        const at = c.h;
        applyHit(m, w, c, "torso", true, false, null, raw);
        explosion(m, w, at, raw);
      } else {
        const off = DIRS[Math.floor(R() * 6)], at = { q: c.h.q + off[0] * 2, r: c.h.r + off[1] * 2 };
        L(`${m.id} throws a ${w.name} at ${c.id} (skill ${g.lvl}): it lands wide`);
        const hitX = occ.get(key(at.q, at.r));
        if (hitX && hitX.state === "ok") {
          const nd = noDiv(w.dmg);
          if (dive(hitX)) { const sp = Math.floor(raw / 3); if (sp >= 1) applyHit(m, { dmg: nd, follow: null }, hitX, "torso", true, false, nd, sp); }
          else applyHit(m, { dmg: nd, follow: null }, hitX, "torso", true, false, nd, raw);
        }
        explosion(m, w, at, raw);
      }
    }

    // ---- Feverish Defense (extra effort, B357): 1 FP for +2 to an active defence against a blow worth fearing
    function feverish(t, att, melee, v) {
      if (!att || v < 5 || v > 15 || t.fp <= Math.max(3, Math.floor(t.u.fp / 3))) return 0;
      const aw = melee ? att.u.melee : att.u.ranged;
      if (!aw || expInjRandom(aw, t.u) < t.u.HP / 5) return 0;
      t.fp -= 1; L(`  ${t.id} defends feverishly (1 FP, +2)`);
      return 2;
    }

    // ---- Wait (B366) and suppression fire (B409) both interrupt a foe's movement
    const zones = [];
    function afterStep(m) {
      if (m.state !== "ok" || !m.h) return true;
      const k = key(m.h.q, m.h.r);
      for (const z of zones) if (m.state === "ok" && m.h && z.side !== m.u.side && z.owner.state === "ok" && z.owner.h && z.hexes.has(k) && !z.hit.has(m)) suppressHit(z, m);
      if (m.state !== "ok" || m.stunned) return true;
      for (const f of models) {
        if (!f.waiting || f.state !== "ok" || !f.h || f.u.side === m.u.side || f.stunned) continue;
        if (hexDist(f.h, m.h) > m.u.melee.reachMax + 1) continue;
        const w = f.waiting; f.waiting = null;
        L(`${f.id} was waiting for ${m.id} (Wait)`);
        if (w === f.u.melee) { if (hexDist(f.h, m.h) <= w.reachMax) strike(f, w, m, {}); }
        else fireAt(f, w, m, { pointBlank: hexDist(f.h, m.h) <= 1 });
        if (m.state !== "ok" || m.stunned || m.prone) return true;
      }
      return false;
    }
    function suppress(m, w, center) {
      const shots = w.shots.mag === Infinity ? w.rof : Math.min(w.rof, m.ammo);
      if (w.shots.mag !== Infinity) m.ammo -= shots;
      m.attacked = true;
      const hexes = new Set([key(center.q, center.r), ...DIRS.map(([a, b]) => key(center.q + a, center.r + b))]);
      const z = { owner: m, side: m.u.side, w, hexes, shots, hit: new Set() };
      zones.push(z); m.zone = z;
      L(`${m.id} lays down suppression fire (${shots} shots) over a 3-yard zone`);
      for (const x of models) if (x.state === "ok" && x.h && x.u.side !== m.u.side && hexes.has(key(x.h.q, x.h.r))) suppressHit(z, x);
    }
    // anyone in the zone, or moving into it before the gunner's next turn, is attacked once at 6 or the gunner's
    // own effective skill if lower, plus the rapid-fire bonus, SM, posture and cover (B409); they may Dodge
    function suppressHit(z, x) {
      z.hit.add(x);
      const m = z.owner, w = z.w, d = Math.max(1, hexDist(m.h, x.h));
      const eff = w.level - skillPen(m) + rangePenalty(d);
      const lvl = Math.min(6, eff) + rapidBonus(z.shots) + x.u.sm - (x.prone ? 2 : 0) - (inCover(x) ? 2 : 0);
      const r = check(lvl);
      if (!r.ok) { L(`  suppression fire misses ${x.id}`); return; }
      let hits = Math.min(3, z.shots, 1 + Math.floor(Math.max(0, r.margin) / w.rcl));
      if (!r.crit) { const def = defend(x, m, false, 0, 0); if (def != null) { const dg = Math.min(hits, 1 + def); hits -= dg; L(`  ${x.id} dodges ${dg}`); } }
      for (let k = 0; k < hits && x.state === "ok"; k++) { L(`  suppression fire hits ${x.id}`); applyHit(m, w, x, hitLocation(), true, d > w.range.half); }
    }
    function clearZone(m) { if (m.zone) { zones.splice(zones.indexOf(m.zone), 1); m.zone = null; } }

    // ---- Slam (B371): crash into a foe at speed; each side deals HP x velocity / 100 dice of crushing damage
    function slamDice(hp, v) { const n = hp * v / 100; return n >= 1 ? { n: Math.floor(n), add: Math.round((n - Math.floor(n)) * 3.5), mult: 1, div: 1, type: "cr", ex: false } : { n: 1, add: Math.max(-5, Math.round(-6 * (1 - n))), mult: 1, div: 1, type: "cr", ex: false }; }
    function slam(m, t, v, aoa) {
      let lvl = Math.max(m.u.dx, m.u.grapple, m.u.melee.name === "Punch" ? m.u.melee.level : 0) - skillPen(m) - (m.grips.length ? 4 : 0);
      if (aoa) lvl += 4; else lvl = Math.min(9, lvl - 4);
      m.attacked = true;
      const r = check(lvl);
      if (!r.ok) { L(`${m.id} slams at ${t.id} (skill ${lvl}): misses`); return; }
      if (!r.crit) { const def = defend(t, m, true, 0, 0); if (def) { L(`${m.id} slams at ${t.id}: ${def.how === "dodge" ? "dodged" : def.how + "ed"}`); return; } }
      const dm = slamDice(m.u.HP, v), dt = slamDice(t.u.HP, v);
      const a = rollDamage(dm), b = rollDamage(dt);
      L(`${m.id} slams into ${t.id} at ${v} yd/s (${a} vs ${b})`);
      applyHit(m, { dmg: dm, follow: null }, t, "torso", false, false, dm, a);
      applyHit(t, { dmg: dt, follow: null }, m, "torso", false, false, dt, b);
      const fall = x => { if (x.state === "ok" && !x.prone) { x.prone = true; L(`  ${x.id} is bowled over`); } };
      if (a >= 2 * b) fall(t);
      else if (b >= 2 * a) fall(m);
      else if (a > b) { if (!check(t.u.dx - (t.grips.length ? 4 : 0)).ok) fall(t); }
      else if (b > a) { if (!check(m.u.dx).ok) fall(m); }
    }
    // ---- Shove (B372): push instead of strike; knockback as a thrust with double dice, DX to stay standing
    function shove(m, t) {
      const lvl = Math.max(m.u.dx, m.u.grapple) - skillPen(m) - (m.prone ? 4 : 0) - (m.grips.length ? 4 : 0);
      m.attacked = true;
      const r = check(lvl);
      if (!r.ok) { L(`${m.id} shoves at ${t.id} (skill ${lvl}): misses`); return; }
      if (!r.crit) { const def = defend(t, m, true, 0, 0); if (def) { L(`${m.id} shoves at ${t.id}: ${def.how === "dodge" ? "dodged" : def.how + "ed"}`); return; } }
      const sd = stDamage(m.u.st), thr = parseDamage("thr cr", sd.thr, sd.sw);
      L(`${m.id} shoves ${t.id}`);
      if (t.grips.length) { if (!check(t.u.dx - 4).ok) { t.prone = true; L(`  ${t.id} goes down`); } return; }
      knockback(m, t, 2 * rollDamage(thr));
    }

    // ---- grappling (B370-371): grab, take down, pin; a pinned model is helpless until it breaks free
    function gripsOn(t) {
      t.grips = t.grips.filter(g => g.state === "ok" && g.holding === t && g.h && t.h && hexDist(g.h, t.h) <= 1);
      if (!t.grips.length) t.pinned = false;
      return t.grips;
    }
    function release(m) {
      const t = m.holding;
      if (!t) return;
      m.holding = null;
      t.grips = t.grips.filter(g => g !== m);
      if (!t.grips.length) t.pinned = false;
    }
    // several grapplers pull together: the strongest one's ST plus a fifth of each other's (simulator rule)
    function gripST(t) {
      const g = gripsOn(t).map(x => x.u.st).sort((a, b) => b - a);
      return g.length ? g[0] + g.slice(1).reduce((a, x) => a + x / 5, 0) : 0;
    }
    function contest(a, b) {
      const ra = check(a), rb = check(b);
      return ra.ok && (!rb.ok || ra.margin > rb.margin);
    }
    // Parrying an unarmed attack with a weapon (B376): the attacker's reaching arm takes the weapon's damage
    function cutsArm(t, att) {
      const w = t.u.melee;
      if (!w || w.natural || w.name === "Punch" || t.state !== "ok" || att.state !== "ok") return;
      L(`  ${t.id}'s ${w.name} catches ${att.id}'s arm`);
      applyHit(t, w, att, "arm", false, false, null, rollDamage(w.dmg));
    }
    function grab(m, t) {
      const lvl = m.u.grapple - skillPen(m) - (m.prone ? 4 : 0) - (m.grips.length ? 4 : 0);
      m.attacked = true;
      const r = check(lvl);
      if (!r.ok) { L(`${m.id} grabs at ${t.id} (skill ${lvl}): misses`); return; }
      if (!r.crit) { const def = defend(t, m, true, 0, 0); if (def) { L(`${m.id} grabs at ${t.id}: ${def.how === "parry" ? "parried" : def.how === "block" ? "blocked" : "dodged"}`); if (def.how === "parry") cutsArm(t, m); return; } }
      release(m); m.holding = t; t.grips.push(m);
      L(`${m.id} grabs ${t.id} (${t.grips.length} holding on)`);
    }
    function wrestle(m, t) {
      if (!t.prone) {
        // Takedown: Quick Contest of the higher of ST, DX or grappling skill
        // the held model is at -4 DX (B370)
        const a = Math.max(gripST(t), m.u.dx, m.u.grapple) - skillPen(m), d = Math.max(t.u.st, t.u.dx - 4, t.u.grapple - 4) - skillPen(t);
        if (contest(a, d)) { t.prone = true; L(`${m.id}${t.grips.length > 1 ? ` and ${t.grips.length - 1} more` : ""} drag ${t.id} to the ground`); }
        else L(`${m.id} tries to drag ${t.id} down (${Math.round(a)} vs ${d}): it keeps its feet`);
      } else if (!t.pinned) {
        // Pin: Quick Contest of ST against a foe on the ground
        if (contest(gripST(t) - skillPen(m), t.u.st - skillPen(t))) { t.pinned = true; L(`${m.id} pins ${t.id} (${t.grips.length} holding it down)`); }
        else L(`${m.id} tries to pin ${t.id}: it struggles free of the hold`);
      }
    }
    // the held model's turn: break one grip (Quick Contest of ST, or grappling skill if better)
    function breakFree(m) {
      const g = gripsOn(m);
      if (!g.length) return false;
      const a = Math.max(m.u.st, m.u.grapple - 4) - skillPen(m), d = gripST(m);
      if (contest(a, d)) {
        const strongest = g.slice().sort((x, y) => y.u.st - x.u.st)[0];
        release(strongest); m.pinned = false;
        L(`${m.id} breaks free of ${strongest.id}${m.grips.length ? ` (${m.grips.length} still holding)` : ""}`);
      } else L(`${m.id} strains against ${g.length} grappler${g.length > 1 ? "s" : ""} (ST ${Math.round(a)} vs ${Math.round(d)})`);
      return true;
    }
    // damage bonus for All-Out Attack (Strong) and Mighty Blows, for planning
    const boosted = (w, k) => ({ ...w.dmg, add: w.dmg.add + k * Math.max(2, w.dmg.n), key: "b" + k });

    function fightInMelee(m, adj) {
      const u = m.u;
      // grappling: a model already holding a foe keeps working the hold (takedown, then pin; a pinner just holds)
      if (m.holding) {
        const t = m.holding;
        if (t.state === "ok" && t.h && hexDist(m.h, t.h) <= 1) {
          if (!t.pinned) { wrestle(m, t); return; }
          if (t.grips.filter(g => g !== m).length >= 2) release(m);   // two can keep it pinned; the rest go back to hacking
          else return;
        } else release(m);
      }
      // prefer the foe we can hurt most, ideally from its flank or rear
      let best = null;
      const mw = weaponsFor(m, true);
      const gun = m.grips.length ? [] : weaponsFor(m, false).filter(w => w.shots.reload <= 3 || w.shots.mag === Infinity);
      for (const t of adj) for (const w of [...mw, ...gun]) {
        const isGun = !mw.includes(w);
        const lvl = isGun ? w.level + Math.min(0, w.bulk || 0) : w.level;
        const p = planAttack(m, w, t, lvl - skillPen(m), !isGun);
        const s = p.score * (isGun ? Math.min(3, w.rof) : 1 + (u.flags.extraAttack || 0));
        if (!best || s > best.s) best = { t, w, s, isGun, p };
      }
      if (!best) return;
      const { t, w } = best;
      m.facing = faceToward(m.h, t.h);
      const threat = threatTo(m);
      // a charging mob that can barely hurt a foe grabs it instead, piling on until it's down and pinned (B370)
      if (u.stance === "charge" && m.armsLost < 1) {
        const holdable = adj.filter(x => !x.pinned && gripsOn(x).length < 4).sort((a, b) => b.grips.length - a.grips.length);
        // "can't hurt it": under 1 HP of expected injury from a blow that lands (armour, not the foe's parry)
        const hard = expInjRandom(u.melee, holdable.length ? holdable[0].u : t.u) < 1;
        if (hard && holdable.length && !adj.some(x => x.pinned)) { m.facing = faceToward(m.h, holdable[0].h); grab(m, holdable[0]); return; }
      }
      // a helpless (pinned) foe draws everyone free to swing: All-Out Attack, Strong if the damage matters more
      const pinnedFoe = adj.find(x => x.pinned);
      if (pinnedFoe && !m.holding) {
        const mw0 = u.melee, lv = mw0.level - skillPen(m) - (m.prone ? 4 : 0) - (m.grips.length ? 4 : 0);
        const det = planAttack(m, mw0, pinnedFoe, lv + 4, true).score;
        const strong = planAttack(m, mw0, pinnedFoe, lv, true, boosted(mw0, 1)).score;
        const might = m.fp > 4 ? planAttack(m, mw0, pinnedFoe, lv, true, boosted(mw0, 2)).score : 0;
        m.facing = faceToward(m.h, pinnedFoe.h);
        m.aoa = true;
        if (might > strong * 1.2 && might > det) { L(`${m.id} lays into the pinned ${pinnedFoe.id} (All-Out Attack, Strong)`); strike(m, mw0, pinnedFoe, { strong: true, mighty: true }); }
        else if (strong > det) { L(`${m.id} lays into the pinned ${pinnedFoe.id} (All-Out Attack, Strong)`); strike(m, mw0, pinnedFoe, { strong: true }); }
        else { L(`${m.id} lays into the pinned ${pinnedFoe.id} (All-Out Attack, Determined)`); strike(m, mw0, pinnedFoe, { determined: true }); }
        return;
      }
      if (best.s <= 0.01) {
        // nothing gets through: defend (All-Out Defense) if threatened, else reload a quick gun or wait
        if (u.ranged && !m.gunBroken && m.ammo < u.ranged.shots.mag && u.ranged.shots.reload <= 3) {
          if (m.reload === 0) m.reload = u.ranged.shots.reload;
          if (--m.reload <= 0) { m.reload = 0; m.ammo = u.ranged.shots.mag; } L(`${m.id} reloads in close combat`); return;
        }
        // a charging mob keeps swinging for a lucky gap; anyone else defends
        if (u.stance === "charge") { strike(m, best.isGun ? u.melee : best.w, best.t, {}); return; }
        // Shove (B372) a foe we can't cut down so a friend who can gets it on the ground
        const friend = models.some(a => a !== m && a.u.side === u.side && a.state === "ok" && a.h && hexDist(a.h, t.h) <= a.u.melee.reachMax);
        if (friend && !t.prone && u.st >= t.u.st - 2) { m.facing = faceToward(m.h, t.h); shove(m, t); return; }
        if (threat > 0) { m.aod = true; L(`${m.id} goes on All-Out Defense`); }
        return;
      }
      if (best.isGun) {
        if (m.reload > 0 || m.ammo <= 0) {
          if (m.reload === 0) m.reload = Math.max(1, w.shots.reload);
          if (--m.reload <= 0) { m.reload = 0; m.ammo = w.shots.mag; } L(`${m.id} reloads in close combat`); return;
        }
        fireAt(m, w, t, { pointBlank: true }); return;
      }
      // two weapons at once (B417): blade and pistol, each at -4 (the off hand -4 more without Ambidexterity)
      const gun1 = u.ranged && u.ranged.oneHanded && !m.gunBroken && !m.jam && !m.grips.length && m.armsLost === 0 && m.reload === 0
        && (u.ranged.shots.mag === Infinity || m.ammo > 0) ? u.ranged : null;
      if (gun1 && u.melee.oneHanded && u.melee.name !== "Punch") {
        const pm = u.dualPen, pg = u.dualPen + u.offPen;
        const sM = planAttack(m, u.melee, t, u.melee.level - skillPen(m) - pm, true).score;
        const sG = planAttack(m, gun1, t, gun1.level + Math.min(0, gun1.bulk) - skillPen(m) - pg, false).score * Math.min(3, gun1.rof);
        if (sM + sG > best.s * 1.15) {
          m.facing = faceToward(m.h, t.h);
          L(`${m.id} attacks with both hands (${u.melee.name} and ${gun1.name})`);
          strike(m, u.melee, t, { pen: pm });
          if (t.state === "ok") fireAt(m, gun1, t, { pointBlank: true, pen: pg });
          return;
        }
      }
      // Feint (B365) when the foe's defence is the problem and we out-skill it
      const def = bestDefence(t, m, true);
      if (def != null && best.p.score > 0 && P3[Math.max(0, Math.min(18, def))] > 0.75 && w.level >= def + 2 && !m.feint) {
        const mine = check(w.level - skillPen(m)), theirs = check(Math.max(t.u.melee.level, t.u.dx));
        const margin = (mine.ok ? mine.margin : -99) - (theirs.ok ? Math.max(0, theirs.margin) : 0);
        m.feint = { t, n: mine.ok ? Math.max(0, margin) : 0 };
        L(`${m.id} feints at ${t.id}${m.feint.n ? ` (-${m.feint.n} to its defence)` : " but it isn't fooled"}`);
        return;
      }
      // All-Out Attack when nothing here can hurt us; Rapid Strike when skill allows (B370)
      if (threat < 1) { m.aoa = true; const dbl = w.level - skillPen(m) >= 16; strike(m, w, t, dbl ? { double: true } : { determined: true }); return; }
      const rapid = w.level - skillPen(m) - 6 >= 14 && !u.flags.extraAttack;
      strike(m, w, t, { rapid });
    }

    let turn = 0;
    for (turn = 1; turn <= maxTurns; turn++) {
      if (!sideActive(0) || !sideActive(1)) break;
      L(`— Turn ${turn} —`);
      if (frames) frames.push(models.map(m => m.h ? [m.h.q, m.h.r, m.u.side, m.state === "ok" ? (m.stunned ? 2 : m.prone ? 3 : 1) : 0, m.facing] : null));
      for (const m of models) {
        m.parries = 0; m.retreated = false; m.blocked = false; m.attacked = false;
        const sh = m.u.shield;
        if (!sh || m.state !== "ok" || m.sp >= sh.sp || !sh.recharge) continue;
        const delay = (sh.delay || 2) * (m.spCollapsed ? 2 : 1);
        if (turn - m.spHit > delay) { m.sp = Math.min(sh.sp, m.sp + sh.recharge); if (m.sp >= sh.sp) m.spCollapsed = false; }
      }
      const order = models.filter(active).sort((a, b) => (b.u.speed - a.u.speed) || (R() - 0.5));
      for (const m of order) {
        if (m.state !== "ok" || m.u.routed || !m.h) continue;
        if (!sideActive(0) || !sideActive(1)) break;
        if (!frac && m.hp <= 0) {
          const k = Math.floor(-m.hp / m.u.HP);
          if (!check(m.u.HT - k).ok) { m.state = "out"; place(m, null); L(`${m.id} collapses unconscious`); continue; }
        }
        if (m.fp <= 0 && !check(m.u.HT).ok) { L(`${m.id} is too exhausted to act`); m.shock = 0; continue; }
        if (m.stunned) { if (check(m.u.HT).ok) { m.stunned = false; L(`${m.id} recovers from stun`); } m.shock = 0; continue; }
        if (m.holding && (m.holding.state !== "ok" || !m.holding.h || hexDist(m.h, m.holding.h) > 1)) release(m);
        if (gripsOn(m).length && (m.pinned || m.prone)) { breakFree(m); m.shock = 0; continue; }
        act(m);
        m.shock = 0;
      }
      // regrowing bio-weapon ammunition
      for (const m of models) {
        const w = m.u.ranged;
        if (!w || m.state !== "ok" || w.shots.reload <= 3 || m.ammo > 0) continue;
        if (m.reload <= 0) m.reload = w.shots.reload;
        if (--m.reload <= 0) { m.reload = 0; m.ammo = w.shots.mag; }
      }
      // bleeding (B420), once a minute in standard mode
      if (!frac && turn % 60 === 0) for (const m of models) if (m.state === "ok" && m.hp < m.u.HP && !m.u.flags.unliving && !check(m.u.HT).ok) { m.hp -= 1; L(`${m.id} bleeds (${m.hp}/${m.u.HP} HP)`); }
      // reanimation
      for (const m of models) {
        if (m.state !== "down") continue;
        const r = check(m.u.HT);
        if (r.ok) {
          const spot = m.lastH || null;
          m.state = "ok"; m.hp = Math.max(1, Math.floor(m.u.HP / 2)); m.stunned = false; m.wounds = {}; m.pain = 0; m.painSev = 0;
          m.halfMove = m.halfDodge = false; m.gawd = 0; m.armsLost = 0; m.legsLost = 0; m.crippled = {}; m.prone = true;
          const home = m.u.models.find(x => x.h && x !== m);
          let h = spot || (home && home.h);
          if (h) { for (let i = 0; i < 8 && occ.has(key(h.q, h.r)); i++) h = { q: h.q + DIRS[i % 6][0], r: h.r + DIRS[i % 6][1] }; }
          place(m, h && !occ.has(key(h.q, h.r)) ? h : null);
          if (!m.h) { m.state = "phased"; continue; }
          L(`${m.id} reanimates`);
        } else if (r.fumble || --m.reanim <= 0) { m.state = "phased"; L(`${m.id} phases out`); }
      }
      // morale
      if (morale) for (const u of units) {
        if (u.routed || u.flags.unfazeable || u.flags.noMorale) continue;
        const alive = u.models.filter(active).length;
        const frac2 = alive / u.count;
        let need = false;
        if (frac2 <= 0.5 && !u.checked50) { u.checked50 = true; need = true; }
        if (frac2 <= 0.25 && !u.checked25) { u.checked25 = true; need = true; }
        if (need && alive > 0 && !check(u.will + (u.flags.fearless || 0)).ok) {
          u.routed = true; u.models.forEach(m => { if (m.state === "ok") { m.state = "routed"; place(m, null); } });
          L(`${u.name} breaks and flees`);
        }
      }
      for (const m of models) if (m.h) m.lastH = m.h;
    }
    const a = sideActive(0), b = sideActive(1);
    const winner = a && !b ? 0 : b && !a ? 1 : -1;
    const timeout = a && b;
    L(winner >= 0 ? `Side ${winner === 0 ? "A" : "B"} wins in ${turn - 1} turns` :
      timeout ? `Still fighting when the ${maxTurns}-second limit ran out` : `Both sides destroyed or broken after ${turn - 1} turns`);
    return {
      winner, timeout, turns: turn - 1, log, frames, roster: models.map(m => ({ id: m.id, side: m.u.side, unit: m.u.idx })),
      units: units.map(u => ({
        name: u.name, side: u.side, count: u.count, routed: u.routed,
        standing: u.models.filter(m => m.state === "ok").length,
        dead: u.models.filter(m => m.state === "dead").length,
        out: u.models.filter(m => m.state === "out" || m.state === "down").length,
        phased: u.models.filter(m => m.state === "phased").length,
        dmg: u.models.reduce((t, m) => t + m.dmgDealt, 0),
        kills: u.models.reduce((t, m) => t + m.kills, 0),
      })),
    };
  }

  function monteCarlo(unitSpecs, opt = {}) {
    const runs = opt.runs ?? 200;
    if (opt.seed != null) seed(opt.seed);
    const res = { runs, wins: [0, 0], draws: 0, timeouts: 0, mutual: 0, turns: 0, units: null, sample: null };
    for (let i = 0; i < runs; i++) {
      const r = runBattle(unitSpecs, { ...opt, log: i === 0, frames: i === 0 });
      if (i === 0) res.sample = r;
      if (r.winner < 0) { res.draws++; if (r.timeout) res.timeouts++; else res.mutual++; } else res.wins[r.winner]++;
      res.turns += r.turns;
      if (!res.units) res.units = r.units.map(u => ({ name: u.name, side: u.side, count: u.count, standing: 0, dead: 0, wiped: 0, routed: 0, dmg: 0, kills: 0 }));
      r.units.forEach((u, k) => {
        const a = res.units[k];
        a.standing += u.standing; a.dead += u.dead; a.dmg += u.dmg; a.kills += u.kills;
        if (u.standing === 0 && !u.routed) a.wiped++;
        if (u.routed) a.routed++;
      });
    }
    res.turns /= runs;
    res.units.forEach(u => { u.standing /= runs; u.dead /= runs; u.dmg /= runs; u.kills /= runs; });
    return res;
  }

  return { index, buildUnit, describe, runBattle, monteCarlo, parseDamage, seed, woundMult, fmtDice, px,
    get templates() { return TEMPLATES; }, get equipment() { return EQ; }, traitWeapons };
})();
if (typeof module !== "undefined") module.exports = SIM;

// ------------------------------------------------------------------- page
// The simulator view in site/index.html. Uses DATA, $, esc and showLib from the page.
if (typeof document !== "undefined") (() => {
  SIM.index(DATA);
  const LO = DATA.loadouts || {};
  const flatEq = e => [e, ...(e.children || []).flatMap(flatEq)];
  const EQS = DATA.libraries.filter(l => l.kind === "equipment").flatMap(l => l.items.flatMap(flatEq).map(e => ({ e, lib: l })));
  const isFollow = w => /follow-?up/i.test(w.usage || "");
  const armourOpts = [...new Set(EQS.filter(x => x.e.feat && x.e.feat.dr && x.e.feat.dr.some(r => !r.vs)).map(x => x.e.name))].sort();
  const lineOpts = melee => {
    const out = [], seen = new Set();
    for (const { e } of EQS) for (const w of e.weapons || []) {
      if (!!w.melee !== melee || isFollow(w)) continue;
      const k = e.name + "\u0000" + w.usage;
      if (seen.has(k)) continue; seen.add(k);
      out.push({ item: e.name, mode: w.usage, label: `${e.name} — ${w.usage} (${w.damage})` });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  };
  const RANGED = lineOpts(false), MELEE = lineOpts(true);
  const TEMPL = DATA.libraries.filter(l => l.kind === "template" && !l.template.addon);

  const KEY = "sim-state-v1";
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (_) { S = null; }
  if (!S || !S.sides) S = { distance: 100, runs: 200, maxTurns: 1200, morale: true, sides: [[], []] };
  if (S.maxTurns === 60 || S.maxTurns === 300) S.maxTurns = 1200;   // old defaults
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

  function newUnit(template, count) {
    const lo = LO[template] || {};
    return { template, count: count || 5, stance: lo.stance || "advance", armour: [...(lo.armour || [])],
      ranged: lo.ranged ? { ...lo.ranged } : null, melee: lo.melee ? { ...lo.melee } : null,
      shield: lo.shield ? { ...lo.shield } : null };
  }
  const PRESETS = [
    ["20 Guardsmen vs 5 Space Marines", [["Astra Militarum Guardsman", 20]], [["Astartes Battle-Brother", 5]], 150],
    ["10 Ork Boyz charge 5 Marines", [["Ork Boy", 10]], [["Astartes Battle-Brother", 5]], 40],
    ["Custodian vs 3 Marines", [["Custodian Guardian", 1]], [["Astartes Battle-Brother", 3]], 20],
    ["Fire Warriors vs Necron Warriors", [["Fire Warrior (Shas'la)", 10]], [["Necron Warrior", 10]], 100],
    ["Wyches vs Guardsmen", [["Wych", 10]], [["Astra Militarum Guardsman", 10]], 30],
    ["Genestealers vs Marines", [["Genestealer", 5]], [["Astartes Battle-Brother", 5]], 40],
  ];

  const trW = template => {
    const T = SIM.templates.get(template);
    return T ? SIM.traitWeapons(T.t.traits).flatMap(t => t.weapons.filter(w => !isFollow(w)).map(w => ({ trait: t.name, mode: w.usage, melee: !!w.melee, label: `${t.name} — ${w.usage} (${w.damage})` }))) : [];
  };
  const selKey = s => !s ? "" : s.trait ? "t:" + s.trait + "\u0000" + (s.mode || "") : "i:" + s.item + "\u0000" + (s.mode || "");
  function weaponSelect(u, which) {
    const melee = which === "melee";
    const nat = trW(u.template).filter(w => w.melee === melee);
    const cur = selKey(u[which]);
    const opts = [`<option value="">${melee ? "Unarmed (punch)" : "None"}</option>`];
    if (nat.length) opts.push(`<optgroup label="Natural weapons">${nat.map(w => { const k = selKey(w); return `<option value="${esc(k)}"${k === cur ? " selected" : ""}>${esc(w.label)}</option>`; }).join("")}</optgroup>`);
    opts.push(`<optgroup label="Equipment">${(melee ? MELEE : RANGED).map(w => { const k = selKey(w); return `<option value="${esc(k)}"${k === cur ? " selected" : ""}>${esc(w.label)}</option>`; }).join("")}</optgroup>`);
    return `<select data-w="${which}">${opts.join("")}</select>`;
  }
  function armourSelect(u, i) {
    const cur = u.armour[i] || "";
    return `<select data-a="${i}"><option value="">${i ? "No second item" : "No armour"}</option>${armourOpts.map(n => `<option${n === cur ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
  }
  function profile(u) {
    try {
      const d = SIM.describe(SIM.buildUnit({ ...u, count: 1 }, 0));
      const r = d.ranged, m = d.melee;
      return `<div class="prof"><span><b>HP</b>${d.hp}${d.dmgRed ? ` · injury ÷${d.dmgRed}` : ""}</span><span><b>DR</b>${d.drTorso} torso · ${d.drEye} eye${d.wp ? ` · WP ${d.wp}` : ""}</span>
        <span><b>Dodge</b>${d.dodge}</span>${d.parry != null ? `<span><b>Parry</b>${d.parry}</span>` : ""}<span><b>Move</b>${d.move}</span>
        ${d.shield ? `<span><b>Shield</b>${d.shield.sp} SP${d.shield.recharge ? "" : ", no recharge"}</span>` : ""}</div>
        <div class="prof">${r ? `<span><b>Ranged</b>${esc(r.name)}: ${esc(r.dmg)}${r.follow ? " + " + esc(r.follow) : ""}, skill ${r.skill}, Acc ${r.acc}, RoF ${r.rof}, ${r.range.half}/${r.range.max} yd</span>` : ""}
        <span><b>Melee</b>${esc(m.name)}: ${esc(m.dmg)}, skill ${m.skill}</span></div>`;
    } catch (e) { return `<div class="prof err">${esc(e.message)}</div>`; }
  }
  function unitCard(u, si, ui) {
    return `<div class="sunit" data-s="${si}" data-u="${ui}">
      <div class="shead"><input type="number" min="1" max="200" value="${u.count}" data-f="count" aria-label="Models"><b>${esc(u.template)}</b>
        <select data-f="stance" aria-label="Stance">${["shoot", "advance", "charge"].map(s => `<option${s === u.stance ? " selected" : ""}>${s}</option>`).join("")}</select>
        <button class="x" data-del aria-label="Remove unit">×</button></div>
      ${profile(u)}
      <details class="lo"><summary>Loadout</summary><div class="lgrid">
        <label>Armour ${armourSelect(u, 0)}</label><label>Armour 2 ${armourSelect(u, 1)}</label>
        <label>Ranged ${weaponSelect(u, "ranged")}</label><label>Melee ${weaponSelect(u, "melee")}</label>
        <label class="sh">Shield <input type="checkbox" data-sh${u.shield ? " checked" : ""}>
          ${u.shield ? `SP <input type="number" data-shf="sp" value="${u.shield.sp}"> delay <input type="number" data-shf="delay" value="${u.shield.delay}"> recharge/s <input type="number" data-shf="recharge" value="${u.shield.recharge}">` : ""}</label>
      </div>${LO[u.template] && LO[u.template].note ? `<p class="lonote">${esc(LO[u.template].note)}</p>` : ""}</details></div>`;
  }
  function tmplOptions() {
    const groups = {};
    for (const l of TEMPL) (groups[l.section.replace(/\/Templates$/, "").replace(/\//g, " › ")] ||= []).push(l.title);
    return `<option value="">Add a unit…</option>` + Object.entries(groups).map(([g, ts]) => `<optgroup label="${esc(g)}">${ts.map(t => `<option>${esc(t)}</option>`).join("")}</optgroup>`).join("");
  }

  let last = null;
  function render() {
    const side = si => `<section class="sside"><h2>Side ${"AB"[si]}</h2>${S.sides[si].map((u, ui) => unitCard(u, si, ui)).join("") || `<p class="empty">No units yet.</p>`}
      <select class="addu" data-add="${si}" aria-label="Add a unit to side ${"AB"[si]}">${tmplOptions()}</select></section>`;
    $("#main").innerHTML = `<header class="libhead"><div class="eyebrow">Tools</div><h1>Combat Simulator</h1>
      <p>Pit units against each other using their templates and default loadouts. Every run plays a full GURPS fight second by second; the result is the spread over many runs.</p></header>
      <div class="spresets">${PRESETS.map((p, i) => `<button class="chip tag" data-preset="${i}">${esc(p[0])}</button>`).join("")}</div>
      <div class="sset">
        <label>Starting distance <input type="number" min="1" max="3000" value="${S.distance}" data-g="distance"> yd</label>
        <label>Runs <input type="number" min="1" max="2000" value="${S.runs}" data-g="runs"></label>
        <label>Turn limit <input type="number" min="5" max="3600" value="${S.maxTurns}" data-g="maxTurns"> s</label>
        <label><input type="checkbox" data-g="morale"${S.morale ? " checked" : ""}> Morale checks</label>
        <label>Hit locations <select data-o="locations" aria-label="Hit locations"><option value="elite"${!S.locations || S.locations === "elite" ? " selected" : ""}>Elites aim, others random</option><option value="aimed"${S.locations === "aimed" ? " selected" : ""}>Everyone aims (RAW)</option><option value="random"${S.locations === "random" ? " selected" : ""}>Random</option></select></label>
        <label>Cover, side A <select data-o="coverA"><option${(S.coverA || "none") === "none" ? " selected" : ""}>none</option><option${S.coverA === "light" ? " selected" : ""}>light</option><option${S.coverA === "heavy" ? " selected" : ""}>heavy</option></select></label>
        <label>side B <select data-o="coverB"><option${(S.coverB || "none") === "none" ? " selected" : ""}>none</option><option${S.coverB === "light" ? " selected" : ""}>light</option><option${S.coverB === "heavy" ? " selected" : ""}>heavy</option></select></label>
        <label>Wounds <select data-h aria-label="Wound rules"><option value="standard"${S.health !== "fractional" ? " selected" : ""}>Standard GURPS HP</option><option value="fractional"${S.health === "fractional" ? " selected" : ""}>Revised Fractional Health</option></select></label>
        ${S.health === "fractional" ? `<label>Boxes per level <input type="number" min="1" max="9" value="${S.boxes || 5}" data-g="boxes"></label>` : ""}
        <button class="run" id="simrun">Run simulation</button>
      </div>
      <div class="sgrid">${side(0)}${side(1)}</div>
      <div id="simout">${last ? results(last) : ""}</div>
      <details class="more"><summary>How the simulator works</summary><p>${esc(HOW)}</p></details>`;
    wire();
    if (last) setupReplay();
  }
  const HOW = `Every run plays a full GURPS 4e fight on a hex map, one yard per hex, second by second. Models act in Basic Speed order and an AI picks each one's maneuver: Aim, Attack, Move and Attack, All-Out Attack (Determined or Double) when nothing can hurt it, All-Out Defense when it can't hurt its foe, Feint and Deceptive Attack against strong defences, Rapid Strike, Ready to reload or clear a jam, Change Posture, and Concentrate for psychic powers. Facing matters: attacks from a flank cost the defender 2, from behind it gets no defence, so surrounding a foe pays. Elite attackers (best combat skill 17+, IQ 8+) aim at the location that does most harm (vitals, skull, eye lens, neck, limbs, or a chink in the armour at −8 or −10 that halves its DR); everyone else hits random locations, with 1 in 6 face hits striking an eye lens. The setting can let everyone aim, as RAW allows, or no one. Ranged fire uses range penalties, the rapid-fire bonus and Recoil, spreads bursts over neighbours, and can malfunction or overheat; explosions splash neighbours, fragments fly, flamers hit the whole cone. Defenders Dodge, Parry or Block with retreat and shield DB, and shooters Dodge and Drop. Cover hides legs and groin and costs attackers 2; prone models are harder to shoot but fight badly. Armour divisors, Weak Points, regenerating shields, wounding, Injury Tolerance, Damage Reduction, follow-ups, crippling, knockback, bleeding, shock, stun, consciousness and death rolls, Reanimation Protocols, morale and Perils of the Warp all apply, with either standard HP or the Revised Fractional Health wound system. The full rule list with page references is docs/simulator.md. A charging mob that can barely hurt its foe grabs it, drags it down and pins it (B370), then the rest lay in with All-Out Attack (Strong) and Mighty Blows (1 FP). Not modelled: vehicles and stealth.`;

  function results(r) {
    const pct = x => (100 * x / r.runs).toFixed(0) + "%";
    const bar = `<div class="sbar"><span class="a" style="width:${100 * r.wins[0] / r.runs}%"></span><span class="d" style="width:${100 * r.draws / r.runs}%"></span><span class="b" style="width:${100 * r.wins[1] / r.runs}%"></span></div>`;
    return `<h2>Result over ${r.runs} battles</h2>
      <div class="tsum"><div>Side A wins<b>${pct(r.wins[0])}</b></div><div>Side B wins<b>${pct(r.wins[1])}</b></div>${r.timeouts ? `<div>Still fighting at the limit<b>${pct(r.timeouts)}</b></div>` : ""}${r.mutual ? `<div>Both sides broken<b>${pct(r.mutual)}</b></div>` : ""}<div>Average length<b>${r.turns.toFixed(1)} s</b></div></div>
      ${bar}
      <div class="tablewrap" style="max-width:1100px"><table><thead><tr><th>Side</th><th>Unit</th><th>Models</th><th>Still standing (avg)</th><th>Killed (avg)</th><th>Wiped out</th><th>Broke and fled</th><th>Injury dealt (avg)</th></tr></thead><tbody>
      ${r.units.map(u => `<tr><td>${"AB"[u.side]}</td><td>${esc(u.name)}</td><td class="n">${u.count}</td><td class="n">${u.standing.toFixed(1)}</td><td class="n">${u.dead.toFixed(1)}</td><td class="n">${pct(u.wiped)}</td><td class="n">${pct(u.routed)}</td><td class="n">${u.dmg.toFixed(0)} HP</td></tr>`).join("")}
      </tbody></table></div>
      <h2>One battle on the map</h2>
      <div class="replay"><svg id="rmap" role="img" aria-label="Battle map"></svg>
        <div class="rctl"><button id="rplay" class="chip tag" aria-label="Play">▶</button><input id="rturn" type="range" min="0" max="${Math.max(0, r.sample.frames.length - 1)}" value="0" aria-label="Turn"><span id="rlab" class="n"></span></div>
        <p class="rleg"><span class="dot a"></span>Side A <span class="dot b"></span>Side B · ring: stunned · small: prone · tick: facing</p>
        <pre class="slog" id="rlog"></pre></div>
      <details class="more"><summary>Blow-by-blow of the whole battle</summary><pre class="slog">${esc(r.sample.log.join("\n"))}</pre></details>`;
  }

  // draw one battle's frames on an SVG hex map
  let timer = null;
  function setupReplay() {
    const svg = document.getElementById("rmap"); if (!svg || !last) return;
    const fr = last.sample.frames, log = last.sample.log;
    const pts = []; fr.forEach(f => f.forEach(x => { if (x) pts.push(SIM.px({ q: x[0], r: x[1] })); }));
    if (!pts.length) return;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const pad = 3, minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, W = Math.max(...xs) - minX + pad, H = Math.max(...ys) - minY + pad;
    svg.setAttribute("viewBox", `${minX} ${minY} ${W} ${H}`);
    const turnLog = t => { const a = log.findIndex(l => l === `— Turn ${t + 1} —`), b = log.findIndex(l => l === `— Turn ${t + 2} —`); return a < 0 ? "" : log.slice(a + 1, b < 0 ? undefined : b).join("\n"); };
    const show = t => {
      const f = fr[t] || [];
      svg.innerHTML = f.map(x => {
        if (!x) return "";
        const [cx, cy] = SIM.px({ q: x[0], r: x[1] }), st = x[3], rad = st === 3 ? 0.4 : 0.6;
        const a = [0, -60, -120, 180, 120, 60][x[4]] * Math.PI / 180;
        return `<g class="${x[2] ? "sb" : "sa"}"><circle cx="${cx}" cy="${cy}" r="${rad}"${st === 2 ? ' class="stun"' : ""}/><line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * 0.95}" y2="${cy + Math.sin(a) * 0.95}"/></g>`;
      }).join("");
      document.getElementById("rlab").textContent = `second ${t + 1} of ${fr.length}`;
      document.getElementById("rlog").textContent = turnLog(t);
    };
    const slider = document.getElementById("rturn");
    slider.oninput = () => show(+slider.value);
    document.getElementById("rplay").onclick = () => {
      if (timer) { clearInterval(timer); timer = null; return; }
      timer = setInterval(() => { if (+slider.value >= fr.length - 1) { clearInterval(timer); timer = null; return; } slider.value = +slider.value + 1; show(+slider.value); }, 350);
    };
    show(0);
  }

  function wire() {
    const main = $("#main");
    main.querySelectorAll("[data-g]").forEach(el => el.onchange = () => {
      S[el.dataset.g] = el.type === "checkbox" ? el.checked : Math.max(1, Number(el.value) || 1); save();
    });
    main.querySelectorAll("[data-o]").forEach(el => el.onchange = () => { S[el.dataset.o] = el.value; save(); });
    const hs = main.querySelector("[data-h]"); hs.onchange = () => { S.health = hs.value; save(); render(); };
    main.querySelectorAll("[data-add]").forEach(el => el.onchange = () => {
      if (!el.value) return; S.sides[+el.dataset.add].push(newUnit(el.value, 5)); save(); render();
    });
    main.querySelectorAll("[data-preset]").forEach(el => el.onclick = () => {
      const p = PRESETS[+el.dataset.preset];
      S.sides = [p[1].map(([t, n]) => newUnit(t, n)), p[2].map(([t, n]) => newUnit(t, n))]; S.distance = p[3]; last = null; save(); render();
    });
    main.querySelectorAll(".sunit").forEach(card => {
      const u = S.sides[+card.dataset.s][+card.dataset.u];
      const upd = () => { save(); render(); };
      card.querySelector("[data-del]").onclick = () => { S.sides[+card.dataset.s].splice(+card.dataset.u, 1); upd(); };
      card.querySelectorAll("[data-f]").forEach(el => el.onchange = () => { u[el.dataset.f] = el.dataset.f === "count" ? Math.max(1, Number(el.value) || 1) : el.value; upd(); });
      card.querySelectorAll("[data-a]").forEach(el => el.onchange = () => { u.armour[+el.dataset.a] = el.value; u.armour = u.armour.filter(Boolean); upd(); });
      card.querySelectorAll("[data-w]").forEach(el => el.onchange = () => {
        const v = el.value;
        if (!v) u[el.dataset.w] = null;
        else { const [k, rest] = [v.slice(0, 2), v.slice(2)]; const [name, mode] = rest.split("\u0000"); u[el.dataset.w] = k === "t:" ? { trait: name, mode } : { item: name, mode }; }
        upd();
      });
      const sh = card.querySelector("[data-sh]");
      sh.onchange = () => { u.shield = sh.checked ? (LO[u.template] && LO[u.template].shield ? { ...LO[u.template].shield } : { sp: 40, delay: 2, recharge: 10, ranged_only: true }) : null; upd(); };
      card.querySelectorAll("[data-shf]").forEach(el => el.onchange = () => { u.shield[el.dataset.shf] = Number(el.value) || 0; upd(); });
      const det = card.querySelector("details.lo");
      det.open = !!u.open; det.ontoggle = () => { u.open = det.open; save(); };
    });
    $("#simrun").onclick = () => {
      const specs = S.sides.flatMap((units, si) => units.map(u => ({ side: si, spec: u })));
      if (!S.sides[0].length || !S.sides[1].length) { $("#simout").innerHTML = `<p class="empty">Add at least one unit to each side.</p>`; return; }
      $("#simout").innerHTML = `<p class="empty">Fighting ${S.runs} battles…</p>`;
      setTimeout(() => {
        try { last = SIM.monteCarlo(specs, { runs: S.runs, distance: S.distance, maxTurns: S.maxTurns, morale: S.morale, health: S.health, boxes: S.boxes || 5,
          locations: S.locations || "elite", cover: [S.coverA || "none", S.coverB || "none"] }); $("#simout").innerHTML = results(last); setupReplay(); }
        catch (e) { $("#simout").innerHTML = `<p class="empty">Could not run: ${esc(e.message)}</p>`; }
      }, 20);
    };
  }
  window.simView = render;
})();
