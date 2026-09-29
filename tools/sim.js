// Combat simulator. Inlined into site/index.html by tools/build_site.py; the engine
// (SIM) also runs under node for testing: `node tools/sim_test.js`.
//
// GURPS 4e combat, simplified to a one-dimensional battlefield: each unit stands at a
// position on a line, the two sides start a set distance apart, and every model acts
// once per one-second turn in Basic Speed order. Rules used, with Basic Set pages:
// ranged attacks with Acc, range penalties (B550), rapid fire (B373) and Rcl; Dodge
// against every attack, Parry in melee; random hit location (B552) with the framework's
// eye-lens rule; DR with armour divisors, Weak Points and regenerating shields
// (docs/framework.md); wounding multipliers and Injury Tolerance (B379-380); follow-up
// damage only on penetration (B414); limb injury caps; shock, knockdown and stun,
// consciousness and death checks (B419-420); Necron Reanimation Protocols; and an
// optional morale check when a unit falls to half strength. Not modelled: cover,
// terrain, explosion splash and fragmentation, psychic powers, vehicles, bleeding.

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
    return { n, add, mult, div, type, ex, text: String(str) };
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
  let EQ = null, TEMPLATES = null;
  function index(data) {
    EQ = new Map(); TEMPLATES = new Map();
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

  // Armour: DR by location (only DR that isn't limited to one damage type), Weak Points,
  // and the ST and Move features a suit carries (servo ST lives on a child item).
  const LOCS = ["skull", "eye", "face", "neck", "torso", "vitals", "groin", "arm", "hand", "leg", "foot"];
  function armourProfile(names) {
    const dr = {}; let wp = 0, wpTorso = -1, striking = 0, lifting = 0, move = 0;
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
        }
      }
    }
    return { dr, wp, striking, lifting, move };
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
      const w = { name: label, usage: line.usage, text: line.damage, dmg, follow: fdmg, followText: fl ? fl.damage : "", level,
        rend, rendBy, rendText: rl ? rl.damage : "" };
      if (melee) {
        const p = String(line.parry ?? "0");
        w.parry = /no/i.test(p) ? null : num(p, 0);
        w.unbalanced = /U/.test(p);
        w.reach = String(line.reach ?? "1");
      } else {
        w.acc = accOf(line.accuracy); w.range = parseRange(line.range) || { half: 100, max: 300 };
        w.rof = parseRoF(line.rate_of_fire); w.rcl = Math.max(1, num(line.recoil, 1));
        w.shots = parseShots(line.shots); w.bulk = num(line.bulk, 0);
        const sm = /^(\d+)([MB†]*)/.exec(String(line.strength ?? ""));
        w.minST = sm && !/[MB]/.test(sm[2]) ? Number(sm[1]) : 0;
        if (w.minST && liftST < w.minST) w.level -= w.minST - liftST;
      }
      return w;
    };
    let melee = mkWeapon(spec.melee, true);
    if (!melee) {
      const lvl = skillLevel(st, "Brawling", ["Brawling", "DX", "Karate"]);
      const hasB = (st.skills || []).some(s => s.name === "Brawling" || s.name === "Karate");
      const pd = parseDamage("thr" + (hasB ? "" : "-1") + " cr", dmgST.thr, dmgST.sw);
      melee = { name: "Punch", usage: "Punch", text: "thr cr", dmg: pd, follow: null, level: lvl, parry: 0, unbalanced: false, reach: "C" };
    }
    const ranged = mkWeapon(spec.ranged, false);
    const parryOf = w => w && w.parry != null ? Math.floor(w.level / 2) + 3 + w.parry + (flags.enhParry || 0) + (flags.cr ? 1 : 0) : null;
    const u = {
      side, name: spec.label || spec.template, template: spec.template, count: Math.max(1, spec.count | 0),
      stance: spec.stance || "shoot", stats: st, flags, speed: st.speed, move: Math.max(1, st.move + arm.move),
      dodge: st.dodge, HP: st.hp, HT: st.ht, will: st.will, sm: st.sm || 0,
      arm, nat, ranged, melee, parry: parryOf(melee), shield: spec.shield && spec.shield.sp ? { ...spec.shield } : null,
    };
    return u;
  }
  function describe(u) {
    const tor = drAt(u.arm.dr, "torso") + drAt(u.nat, "torso"), eye = drAt(u.arm.dr, "eye") + drAt(u.nat, "eye");
    return {
      hp: u.HP, ht: u.HT, dodge: u.dodge, parry: u.parry, move: u.move, drTorso: tor, drEye: eye, wp: u.arm.wp,
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

  // ------------------------------------------------------------------ battle
  function runBattle(unitSpecs, opt = {}) {
    const distance = opt.distance ?? 100, maxTurns = opt.maxTurns ?? 60, morale = opt.morale !== false;
    const log = opt.log ? [] : null;
    const L = s => { if (log && log.length < 4000) log.push(s); };
    const units = unitSpecs.map(s => { const u = buildUnit(s.spec, s.side); u.pos = s.side === 0 ? 0 : distance; return u; });
    const models = [];
    units.forEach((u, ui) => {
      u.idx = ui; u.models = []; u.brokeAt = null; u.routed = false; u.checked50 = false; u.checked25 = false;
      for (let i = 0; i < u.count; i++) {
        const m = { u, id: `${u.name} #${i + 1}`, hp: u.HP, state: "ok", shock: 0, stunned: false, aimed: false,
          ammo: u.ranged ? u.ranged.shots.mag : 0, reload: 0, sp: u.shield ? u.shield.sp : 0, spHit: -99, spCollapsed: false,
          parries: 0, attacked: false, deathChecks: 0, reanim: 0, dmgDealt: 0, kills: 0 };
        u.models.push(m); models.push(m);
      }
    });
    const active = m => m.state === "ok";
    const unitActive = u => !u.routed && u.models.some(active);
    const sideActive = s => units.some(u => u.side === s && unitActive(u));
    const dist = (a, b) => Math.abs(a.pos - b.pos);
    const enemiesOf = u => units.filter(v => v.side !== u.side && unitActive(v));

    function injure(att, t, inj, loc) {
      if (inj <= 0) return;
      const HP = t.u.HP, before = t.hp;
      t.hp -= inj;
      att.dmgDealt += inj;
      if (!t.u.flags.hpt) t.shock = Math.min(4, t.shock + inj);
      if (inj > HP / 2 && t.state === "ok") {
        const mod = (t.u.flags.hpt ? 3 : 0) + (loc === "skull" || loc === "eye" ? -10 : loc === "face" ? -5 : 0);
        if (!check(t.u.HT + mod).ok) { t.stunned = true; L(`  ${t.id} is knocked down and stunned`); }
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
      if (t.u.flags.reanimation && how !== "destroyed" && t.hp > -5 * t.u.HP) {
        t.state = "down"; t.reanim = 3; L(`  ${t.id} falls; reanimation protocols engage`);
      } else { t.state = "dead"; L(`  ${t.id} is ${how}`); }
      att.kills++;
    }

    // one hit on target t at loc; returns injury dealt
    function applyHit(att, w, t, loc, ranged, halfD, dmgOverride) {
      const dmg = dmgOverride || w.dmg;
      let raw = rollDamage(dmg);
      if (halfD) raw = Math.floor(raw / 2);
      let fraw = w.follow ? rollDamage(w.follow) : 0;
      const sh = t.u.shield;
      if (sh && t.sp > 0 && (ranged || !sh.ranged_only)) {
        t.spHit = turn;
        if (raw <= t.sp) { t.sp -= raw; if (fraw) t.sp = Math.max(0, t.sp - fraw); L(`  shield holds (${t.sp} SP left)`); return 0; }
        raw -= t.sp; t.sp = 0; t.spCollapsed = true; fraw = 0; L(`  shield collapses`);
      }
      const armDR = drAt(t.u.arm.dr, loc), natDR = drAt(t.u.nat, loc) + (loc === "skull" ? 2 : 0);
      const div = dmg.div;
      const eff = dr => dr <= 0 ? 0 : div === Infinity ? 0 : Math.max(1, Math.floor(dr / div));
      let DR = eff(armDR + natDR);
      let pen = raw - DR;
      if (pen <= 0 && armDR > 0 && t.u.arm.wp && roll3() <= t.u.arm.wp) {
        DR = eff(Math.floor(armDR / 2) + natDR); pen = raw - DR;
        if (pen > 0) L(`  finds a weak point`);
      }
      if (pen <= 0) { L(`  ${raw} dmg to ${loc} fails to penetrate DR ${armDR + natDR}${div !== 1 ? "/" + (div === Infinity ? "∞" : div) : ""}`); return 0; }
      const flags = t.u.flags;
      const poison = flags.poison;
      let inj = dmg.type === "tox" && poison === "immune" ? 0 : Math.max(1, Math.floor(pen * woundMult(dmg.type, loc, flags, dmg.ex)));
      if (dmg.type === "tox" && poison === "resist") inj = Math.floor(inj / 2);
      if (loc === "arm" || loc === "leg") inj = Math.min(inj, Math.floor(t.u.HP / 2) + 1);
      if (loc === "hand" || loc === "foot") inj = Math.min(inj, Math.floor(t.u.HP / 3) + 1);
      let finj = 0;
      if (w.follow && fraw > 0) {
        const ft = w.follow.type;
        if (!(ft === "tox" && poison === "immune")) {
          finj = Math.max(1, Math.floor(fraw * woundMult(ft, loc === "arm" || loc === "leg" ? loc : "torso", flags, w.follow.ex)));
          if (ft === "tox" && poison === "resist") finj = Math.floor(finj / 2);
        }
      }
      L(`  ${raw} dmg to ${loc} (DR ${armDR + natDR}${div !== 1 ? "/" + (div === Infinity ? "∞" : div) : ""}): ${inj} injury${finj ? ` + ${finj} follow-up` : ""}; ${t.id} at ${t.hp - inj - finj}/${t.u.HP} HP`);
      injure(att, t, inj + finj, loc);
      return inj + finj;
    }

    function bestDefence(t) {
      let d = t.u.dodge + 3 - (t.stunned ? 4 : 0);
      if (t.u.parry != null && !(t.u.melee.unbalanced && t.attacked)) d = Math.max(d, t.u.parry + 1 - 4 * t.parries - (t.stunned ? 4 : 0));
      return d;
    }
    function defend(t, melee, da = 0) {
      if (t.state !== "ok") return false;
      let dodge = t.u.dodge + (melee ? 3 : 0) - (t.stunned ? 4 : 0) - da;
      let best = dodge, how = "dodge";
      if (melee && t.u.parry != null && !(t.u.melee.unbalanced && t.attacked)) {
        const p = t.u.parry + 1 - 4 * t.parries - (t.stunned ? 4 : 0) - da;
        if (p > best) { best = p; how = "parry"; }
      }
      if (how === "parry") t.parries++;
      const r = check(best);
      return r.ok ? { how, margin: Math.max(0, r.margin) } : null;
    }

    // rough expected injury of one attack on t: chance to hit x average penetration x wounding
    function expected(w, t, lvl, n) {
      if (!w || !w.dmg) return 0;
      const avg = d => (d.n * 3.5 + d.add) * d.mult;
      const dr = drAt(t.u.arm.dr, "torso") + drAt(t.u.nat, "torso");
      const eff = w.dmg.div === Infinity ? 0 : Math.floor(dr / w.dmg.div);
      // expected penetration over the damage roll's spread, so a long shot still beats nothing
      let pen = 0, got = 0;
      for (let i = 0; i < 24; i++) { const p = rollDamage(w.dmg) - eff; if (p > 0) { pen += p; got++; } }
      pen /= 24;
      const fol = w.follow ? avg(w.follow) * got / 24 : 0;
      return P3[Math.max(0, Math.min(18, lvl))] * n * (pen * woundMult(w.dmg.type, "torso", t.u.flags, w.dmg.ex) + fol);
    }
    function rangedAttack(m, target, moved, pointBlank) {
      const w = m.u.ranged, u = m.u;
      if (m.reload > 0) { m.reload--; if (m.reload === 0) m.ammo = w.shots.mag; return; }
      if (m.ammo <= 0) { m.reload = Math.max(1, w.shots.reload); L(`${m.id} reloads`); return; }
      const d = Math.max(1, dist(u, target.u));
      if (d > w.range.max) return;
      if (pointBlank) {
        const shots = Math.min(w.rof, m.ammo, 3);
        m.ammo -= shots; m.attacked = true; m.aimed = false;
        const lvl = w.level + Math.min(0, w.bulk) + rapidBonus(shots) - Math.min(4, m.shock);
        const r = check(lvl);
        if (!r.ok) { L(`${m.id} fires point-blank at ${target.id} (skill ${lvl}): misses`); return; }
        let hits = Math.min(shots, 1 + Math.floor(Math.max(0, r.margin) / w.rcl));
        L(`${m.id} fires point-blank at ${target.id} (skill ${lvl}): ${hits} hit${hits > 1 ? "s" : ""}`);
        if (!r.crit) { const def = defend(target, false); if (def) { const dg = Math.min(hits, 1 + def.margin); hits -= dg; L(`  ${target.id} dodges ${dg}`); } }
        for (let k = 0; k < hits && target.state === "ok"; k++) applyHit(m, w, target, hitLocation(), true, false);
        return;
      }
      // Aim once at each new target (B364), then keep firing; Acc applies to the first volley only
      if (u.stance === "shoot" && !moved && !m.aimed && m.lastTarget !== target) { m.aimed = true; m.aimTarget = target; m.lastTarget = target; L(`${m.id} aims at ${target.id}`); return; }
      m.lastTarget = target;
      const total = Math.min(w.rof, m.ammo);
      m.ammo -= total;
      const acc = !moved && m.aimed ? w.acc : 0;
      m.aimed = false;
      m.attacked = true;
      // Automatic fire is spread across neighbouring models in the target unit (rapid fire
      // against several targets, B373): a burst of 6+ splits between two, 16+ between three,
      // each part rolled separately with its own rapid-fire bonus. Low-RoF weapons keep to one.
      const pool = target.u.models.filter(x => x.state === "ok" && x !== target);
      const parts = Math.min(1 + pool.length, total >= 16 ? 3 : total >= 6 ? 2 : 1);
      const targets = [target];
      while (targets.length < parts) targets.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
      targets.forEach((t, i) => {
        const shots = Math.floor(total / parts) + (i < total % parts ? 1 : 0);
        let lvl = w.level + rangePenalty(d) + rapidBonus(shots) + t.u.sm - Math.min(4, m.shock) + acc;
        if (moved) lvl += Math.min(-2, w.bulk);
        const r = check(lvl);
        if (!r.ok) { L(`${m.id} fires ${shots} at ${t.id} (${d} yd, skill ${lvl}): misses`); return; }
        let hits = Math.min(shots, 1 + Math.floor(Math.max(0, r.margin) / w.rcl));
        L(`${m.id} fires ${shots} at ${t.id} (${d} yd, skill ${lvl}): ${hits} hit${hits > 1 ? "s" : ""}`);
        if (!r.crit) {
          const def = defend(t, false);
          if (def) { const dodged = Math.min(hits, 1 + def.margin); hits -= dodged; L(`  ${t.id} dodges ${dodged}`); }
        }
        const halfD = d > w.range.half;
        for (let k = 0; k < hits && t.state === "ok"; k++) applyHit(m, w, t, hitLocation(), true, halfD);
      });
    }

    function meleeAttack(m, target, charged) {
      const w = m.u.melee, n = 1 + (m.u.flags.extraAttack || 0);
      for (let i = 0; i < n && target.state === "ok"; i++) {
        let lvl = w.level - Math.min(4, m.shock) - (charged ? 4 : 0);
        if (charged) lvl = Math.min(lvl, 9);
        // Deceptive Attack (B369): -2 skill per -1 to the defence, at the level that
        // gives the best chance to land a blow against this defender's best defence
        const def0 = bestDefence(target);
        let da = 0, bestP = -1;
        for (let k = 0; lvl - 2 * k >= 3 && k <= 10; k++) {
          const p = P3[Math.max(0, Math.min(18, lvl - 2 * k))] * (1 - P3[Math.max(0, Math.min(18, def0 - k))]);
          if (p > bestP + 1e-9) { bestP = p; da = k; }
        }
        lvl -= 2 * da;
        const r = check(lvl);
        m.attacked = true;
        if (!r.ok) { L(`${m.id} strikes at ${target.id} (skill ${lvl}): misses`); continue; }
        if (!r.crit) {
          const def = defend(target, true, da);
          if (def) { L(`${m.id} strikes at ${target.id}: ${def.how === "parry" ? "parried" : "dodged"}`); continue; }
        }
        const rending = w.rend && (r.crit || r.margin >= w.rendBy);
        L(`${m.id} strikes ${target.id} with ${w.name}${rending ? " (rending hit)" : ""}`);
        applyHit(m, w, target, hitLocation(), false, false, rending ? w.rend : null);
        if (charged) break;
      }
    }

    let turn = 0;
    const casualtiesAtStart = new Map();
    for (turn = 1; turn <= maxTurns; turn++) {
      if (!sideActive(0) || !sideActive(1)) break;
      L(`— Turn ${turn} —`);
      // shields recharge
      for (const m of models) {
        const sh = m.u.shield;
        if (!sh || m.state !== "ok" || m.sp >= sh.sp || !sh.recharge) continue;
        const delay = (sh.delay || 2) * (m.spCollapsed ? 2 : 1);
        if (turn - m.spHit > delay) { m.sp = Math.min(sh.sp, m.sp + sh.recharge); if (m.sp >= sh.sp) m.spCollapsed = false; }
      }
      // movement
      const charged = new Set(), moved = new Set();
      for (const u of [...units].sort((a, b) => b.speed - a.speed)) {
        if (!unitActive(u)) continue;
        const foes = enemiesOf(u);
        if (!foes.length) continue;
        const near = foes.reduce((a, b) => dist(u, a) <= dist(u, b) ? a : b);
        const d = dist(u, near);
        if (d <= 1 || u.stance === "shoot") continue;
        if (u.stance === "advance" && u.ranged && u.melee && u.melee.name === "Punch" && d <= u.ranged.range.half) continue;
        const step = Math.min(u.move, d - 1);
        u.pos += (near.pos > u.pos ? 1 : -1) * step;
        if (dist(u, near) <= 1) { u.pos = near.pos; if (u.stance === "charge") charged.add(u); }
        moved.add(u);
      }
      // actions in Basic Speed order
      const order = models.filter(active).sort((a, b) => (b.u.speed - a.u.speed) || (R() - 0.5));
      for (const m of models) { m.parries = 0; m.attacked = false; }
      for (const m of order) {
        if (m.state !== "ok") continue;
        if (!sideActive(0) || !sideActive(1)) break;
        if (m.u.routed) continue;
        if (m.hp <= 0) {
          const k = Math.floor(-m.hp / m.u.HP);
          if (!check(m.u.HT - k).ok) { m.state = "out"; L(`${m.id} collapses unconscious`); continue; }
        }
        if (m.stunned) { if (check(m.u.HT).ok) { m.stunned = false; L(`${m.id} recovers from stun`); } m.shock = 0; continue; }
        const u = m.u;
        const engaged = enemiesOf(u).filter(v => dist(u, v) <= 1);
        if (engaged.length) {
          const pool = engaged.flatMap(v => v.models.filter(active));
          if (pool.length) {
            const t = pick(pool);
            // In close combat a fighter may shoot at point-blank range instead (Bulk as a penalty,
            // no Acc); choose whichever attack does more expected harm to this target
            if (u.ranged && !charged.has(u) && m.reload === 0 && m.ammo > 0 &&
                expected(u.ranged, t, u.ranged.level + Math.min(0, u.ranged.bulk), Math.min(3, u.ranged.rof)) >
                expected(u.melee, t, u.melee.level, 1 + (u.flags.extraAttack || 0))) rangedAttack(m, t, false, true);
            else meleeAttack(m, t, charged.has(u));
          }
        } else if (u.ranged && u.stance !== "charge") {
          const foes = enemiesOf(u).filter(v => dist(u, v) <= u.ranged.range.max);
          if (foes.length) {
            const near = foes.reduce((a, b) => dist(u, a) <= dist(u, b) ? a : b);
            let target = m.aimed && m.aimTarget && m.aimTarget.state === "ok" ? m.aimTarget : pick(near.models.filter(active));
            if (target) rangedAttack(m, target, moved.has(u));
          }
        } else if (u.ranged && u.stance === "charge" && !moved.has(u)) {
          const foes = enemiesOf(u).filter(v => dist(u, v) <= u.ranged.range.max);
          if (foes.length) { const t = pick(foes[0].models.filter(active)); if (t) rangedAttack(m, t, false); }
        }
        m.shock = 0;
      }
      // reanimation
      for (const m of models) {
        if (m.state !== "down") continue;
        const r = check(m.u.HT);
        if (r.ok) { m.state = "ok"; m.hp = Math.max(1, Math.floor(m.u.HP / 2)); m.stunned = false; L(`${m.id} reanimates`); }
        else if (r.fumble || --m.reanim <= 0) { m.state = "phased"; L(`${m.id} phases out`); }
      }
      // morale
      if (morale) for (const u of units) {
        if (u.routed || u.flags.unfazeable || u.flags.noMorale) continue;
        const alive = u.models.filter(active).length;
        const frac = alive / u.count;
        let need = false;
        if (frac <= 0.5 && !u.checked50) { u.checked50 = true; need = true; }
        if (frac <= 0.25 && !u.checked25) { u.checked25 = true; need = true; }
        if (need && alive > 0 && !check(u.will + (u.flags.fearless || 0)).ok) {
          u.routed = true; u.models.forEach(m => { if (m.state === "ok") m.state = "routed"; });
          L(`${u.name} breaks and flees`);
        }
      }
    }
    const a = sideActive(0), b = sideActive(1);
    const winner = a && !b ? 0 : b && !a ? 1 : -1;
    L(winner < 0 ? `Battle undecided after ${turn - 1} turns` : `Side ${winner === 0 ? "A" : "B"} wins in ${turn - 1} turns`);
    return {
      winner, turns: turn - 1, log,
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
    const res = { runs, wins: [0, 0], draws: 0, turns: 0, units: null, sample: null };
    for (let i = 0; i < runs; i++) {
      const r = runBattle(unitSpecs, { ...opt, log: i === 0 });
      if (i === 0) res.sample = r;
      if (r.winner < 0) res.draws++; else res.wins[r.winner]++;
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

  return { index, buildUnit, describe, runBattle, monteCarlo, parseDamage, seed, woundMult, fmtDice,
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
  if (!S || !S.sides) S = { distance: 100, runs: 200, maxTurns: 60, morale: true, sides: [[], []] };
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
      return `<div class="prof"><span><b>HP</b>${d.hp}</span><span><b>DR</b>${d.drTorso} torso · ${d.drEye} eye${d.wp ? ` · WP ${d.wp}` : ""}</span>
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
        <label>Turn limit <input type="number" min="5" max="600" value="${S.maxTurns}" data-g="maxTurns"> s</label>
        <label><input type="checkbox" data-g="morale"${S.morale ? " checked" : ""}> Morale checks</label>
        <button class="run" id="simrun">Run simulation</button>
      </div>
      <div class="sgrid">${side(0)}${side(1)}</div>
      <div id="simout">${last ? results(last) : ""}</div>
      <details class="more"><summary>How the simulator works</summary><p>${esc(HOW)}</p></details>`;
    wire();
  }
  const HOW = `Each second every model acts in Basic Speed order. Shooters aim once at each new target (+Acc), then fire every turn with range penalties (B550), the rapid-fire bonus and Recoil for extra hits, spreading automatic bursts across two or three models (B373); targets Dodge, and every point of margin dodges one more round. Units set to advance move and fire (−2 or Bulk, no Acc); units set to charge run in and strike, with Move and Attack penalties on the turn they arrive. In close combat a model with a gun fires it point-blank (Bulk as a penalty) when that does more harm than its melee weapon. In melee, defenders use the better of Dodge (+3 retreat) and Parry (+1 retreat, −4 per extra parry), and skilled attackers make Deceptive Attacks. Hits land on a random location (B552), with 1 in 6 face hits striking an eye lens. Regenerating shields soak damage first; armour divisors, Weak Points, wounding multipliers, Injury Tolerance, limb caps and follow-up damage all apply. Shock, knockdown, stun, the HT rolls to stay conscious and to survive at −1×HP and below, Hard to Kill and Necron Reanimation Protocols are modelled. With morale on, a unit checks Will (+Fearlessness) when it falls to half and to a quarter strength, and breaks on a failure; Unfazeable units, machines with Slave Mentality and Necrons never break, and Tyranids are assumed to be within synapse range (Fearlessness 5). Not modelled: cover and terrain, explosion splash and fragmentation, crippled-limb effects, psychic powers, vehicles and drones' support roles.`;

  function results(r) {
    const pct = x => (100 * x / r.runs).toFixed(0) + "%";
    const bar = `<div class="sbar"><span class="a" style="width:${100 * r.wins[0] / r.runs}%"></span><span class="d" style="width:${100 * r.draws / r.runs}%"></span><span class="b" style="width:${100 * r.wins[1] / r.runs}%"></span></div>`;
    return `<h2>Result over ${r.runs} battles</h2>
      <div class="tsum"><div>Side A wins<b>${pct(r.wins[0])}</b></div><div>Side B wins<b>${pct(r.wins[1])}</b></div><div>Undecided<b>${pct(r.draws)}</b></div><div>Average length<b>${r.turns.toFixed(1)} s</b></div></div>
      ${bar}
      <div class="tablewrap" style="max-width:1100px"><table><thead><tr><th>Side</th><th>Unit</th><th>Models</th><th>Still standing (avg)</th><th>Killed (avg)</th><th>Wiped out</th><th>Broke and fled</th><th>Injury dealt (avg)</th></tr></thead><tbody>
      ${r.units.map(u => `<tr><td>${"AB"[u.side]}</td><td>${esc(u.name)}</td><td class="n">${u.count}</td><td class="n">${u.standing.toFixed(1)}</td><td class="n">${u.dead.toFixed(1)}</td><td class="n">${pct(u.wiped)}</td><td class="n">${pct(u.routed)}</td><td class="n">${u.dmg.toFixed(0)} HP</td></tr>`).join("")}
      </tbody></table></div>
      <details class="more"><summary>Blow-by-blow of one battle</summary><pre class="slog">${esc(r.sample.log.join("\n"))}</pre></details>`;
  }

  function wire() {
    const main = $("#main");
    main.querySelectorAll("[data-g]").forEach(el => el.onchange = () => {
      S[el.dataset.g] = el.type === "checkbox" ? el.checked : Math.max(1, Number(el.value) || 1); save();
    });
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
        try { last = SIM.monteCarlo(specs, { runs: S.runs, distance: S.distance, maxTurns: S.maxTurns, morale: S.morale }); $("#simout").innerHTML = results(last); }
        catch (e) { $("#simout").innerHTML = `<p class="empty">Could not run: ${esc(e.message)}</p>`; }
      }, 20);
    };
  }
  window.simView = render;
})();
