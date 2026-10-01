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
    const out = []; let t = 0; for (let n = 0; n <= 18; n++) { t += c[n]; out.push(t / 216); }
    out[17] = out[18] = out[16];                                  // 17 and 18 always fail (B343)
    out[3] = out[4] = Math.max(out[4], 4 / 216); return out; })();
  const roll3 = () => d6() + d6() + d6();
  const pick = a => a[Math.floor(R() * a.length)];
  // success roll: {ok, margin, crit}
  function check(level) {
    const r = roll3();
    const critS = r <= 4 || (r === 5 && level >= 15) || (r === 6 && level >= 16);
    const critF = r === 18 || (r === 17 && level <= 15) || r - level >= 10;
    return { ok: critS || (!critF && r <= Math.min(level, 16)), margin: level - r, crit: critS, fumble: critF, roll: r, level };
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
  // Progressive Recoil (the user's house rule, replacing B373): every round of a burst is rolled on its own. Round k
  // (the first is 0) is at -k x Rcl; only true laser weapons with Rcl 1 (marked "1L" in the data: lascannon,
  // multi-laser, lasblaster, scatter laser) take a flat -1 on every round after the first instead (user direction). Braced, Rcl is halved (rounding up) for
  // the progression and every round gets +1 (the caller adds it); Aim helps only the first round.
  // A gun fired from a tripod, baseplate or vehicle mount (data ST "M", or a heavy weapon team's gun once set up) takes
  // the mount's flat -1 a round instead (user direction): the mount soaks the recoil a brace only halves
  function rclPen(w, k, braced) {
    if (!k) return 0;
    const r = (w && w.rcl) || 1;
    if (w && w.mounted && r > 1) return k;
    if (r === 1 && w && w.rclFlat) return 1;
    return k * (braced ? Math.max(1, Math.ceil(r / 2)) : r);
  }
  // expected hits from n rounds at effective skill eff (aim: the Aim bonus inside eff, first round only)
  function burstHits(eff, n, w, aim = 0, braced = false) {
    let h = 0;
    for (let k = 0; k < n; k++) { const l = eff - (k ? aim : 0) - rclPen(w, k, braced); if (l < 3) break; h += P3[Math.min(18, l)]; }
    return h;
  }
  // expected critical rounds (B347: 3-4, 5 at skill 15, 6 at 16+): these can't be defended against
  const critP = l => l < 3 ? 0 : (l >= 16 ? 16 : l >= 15 ? 10 : 4) / 216;
  function burstCrits(eff, n, w, aim = 0, braced = false) {
    let c = 0;
    for (let k = 0; k < n; k++) { const l = eff - (k ? aim : 0) - rclPen(w, k, braced); if (l < 3) break; c += critP(l); }
    return c;
  }
  function rapidBonus(shots) {
    if (shots < 5) return 0; if (shots <= 8) return 1; if (shots <= 12) return 2; if (shots <= 16) return 3;
    if (shots <= 24) return 4; if (shots <= 49) return 5; if (shots <= 99) return 6;
    return 6 + Math.floor(Math.log2(shots / 50));   // +1 per doubling past 50-99 (B373)
  }

  // ------------------------------------------------------------ data index
  let EQ = null, TEMPLATES = null, SIMW = {}, POWERS = {}, AI = [], LOADOUTS = {}, SQUADS = {};
  function index(data) {
    EQ = new Map(); TEMPLATES = new Map(); SIMW = data.simWeapons || {}; POWERS = data.powers || {}; AI = (data.ai && data.ai.profiles) || []; LOADOUTS = data.loadouts || {}; SQUADS = data.squads || {};
    const walk = (e, src) => { if (!EQ.has(e.name)) EQ.set(e.name, { e, src }); (e.children || []).forEach(c => walk(c, src)); };
    for (const lib of data.libraries) {
      if (lib.kind === "equipment") lib.items.forEach(e => walk(e, lib));
      if (lib.kind === "template" && !lib.template.addon) TEMPLATES.set(lib.title, { t: lib.template, lib });
    }
    return { EQ, TEMPLATES };
  }
  // a lore squad (data/sim/squads.yaml) as unit specs: each member is its template's default loadout with the
  // member's own fields laid over it, tagged with the squad so the engine deploys and rallies them together.
  // tag tells two squads of the same kind apart; n numbers their names ("Guard Squad 2 Sergeant")
  const SQUAD_KEYS = ["armour", "ranged", "ranged2", "melee", "grenades", "knife", "stance", "shield", "carried", "mags", "body", "skills"];
  function squadSpecs(name, tag, n) {
    const sq = SQUADS[name];
    if (!sq) throw new Error("Unknown squad: " + name);
    const short = (sq.short || name) + (n > 1 ? " " + n : "");
    return sq.members.map(mb => {
      const lo = LOADOUTS[mb.template] || {}, spec = { template: mb.template, count: mb.count || 1 };
      for (const k of SQUAD_KEYS) { const v = k in mb ? mb[k] : lo[k]; if (v !== undefined) spec[k] = JSON.parse(JSON.stringify(v)); }
      if (!spec.stance) spec.stance = "advance";
      return Object.assign(spec, { label: `${short} ${mb.role}`, role: mb.role, squad: tag || name, squadName: short, leader: !!mb.leader, vox: !!mb.vox, commissar: !!mb.commissar,
        ...(mb.team ? { team: String(mb.team), crew: mb.crew || "gunner" } : {}) });
    }).map((spec, i, all) => {
      // a team's loader carries the means to take over the gun: its weapon line and the gunner's skill with it
      if (spec.crew !== "loader") return spec;
      const g = all.find(x => x.team === spec.team && x.crew === "gunner");
      return g ? { ...spec, heavy: g.ranged ? { ...g.ranged } : undefined, skills: { ...(g.skills || {}), ...(spec.skills || {}) } } : spec;
    });
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
    const dr = {}; let wp = 0, wpTorso = -1, striking = 0, lifting = 0, move = 0, hp = 0, flexible = false;
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
        if (/Flexible armou?r/i.test(e.notes || "") && torso > 0) flexible = true;   // blunt trauma (B379)
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
    return { dr, wp, striking, lifting, move, hp, flexible };
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
    [50, "5d+2", "8d-1"], [55, "6d", "8d+1"], [60, "7d-1", "9d"], [65, "7d+1", "9d+2"], [70, "8d", "10d"],
    [75, "8d+2", "10d+2"], [80, "9d", "11d"], [85, "9d+2", "11d+2"], [90, "10d", "12d"], [95, "10d+2", "12d+2"], [100, "11d", "13d"],
    // above ST 100: +1d thrust and swing per full 10 ST (B16)
    ...Array.from({ length: 90 }, (_, i) => [110 + 10 * i, `${12 + i}d`, `${14 + i}d`])];
  // decision weights for a template (data/sim/ai.yaml): first profile whose regex matches the template name
  function aiProfile(name) {
    const base = { name: "Default", aggression: 1, caution: 1, melee: 1, ranged: 1, focus: 1, noise: 0, prey: 1, zeal: 0 };
    const p = AI.find(x => { try { return new RegExp(x.match || "^$").test(name); } catch (e) { return false; } });
    return p ? { ...base, ...p } : base;
  }
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
  const FLAMMABLE = /flak|robe|wychsuit|hide|cloth|coat|fatigue/i;
  const UNCLOTHED = /Tyranid|gaunt|Genestealer|Lictor|Ravener|Carnifex|Hive Tyrant|Zoanthrope|Necron|Deathmark|Lychguard|Cryptek|Flayed|Skorpekh|Servitor|Drone|Vespid|Wrack/;
  function buildUnit(spec, side) {
    const T = TEMPLATES.get(spec.template);
    if (!T) throw new Error("Unknown template: " + spec.template);
    // a squad's specialist trains on its weapon: spec.skills {"Gunner (Rockets)": 20} sets those skill levels
    const st = spec.skills ? { ...T.t.stats, skills: [...(T.t.stats.skills || []).filter(x => !(x.name in spec.skills)), ...Object.entries(spec.skills).map(([name, level]) => ({ name, level }))] } : T.t.stats, flags = st.flags || {};
    const arm = armourProfile(spec.armour);
    const nat = {};
    for (const [k, v] of Object.entries(st.dr || {})) nat[k] = v;
    const baseStrike = st.st + ((st.bonus && st.bonus.striking_st) || 0);
    const dmgST = stDamage(baseStrike + arm.striking);
    const liftST = st.st + ((st.bonus && st.bonus.lifting_st) || 0) + arm.lifting;
    // one hand? "†" needs two hands unless ST is 2x the listed ST, "‡" unless 3x (B270). Between 1.5x and 2x a †
    // weapon can be swung or fired one-handed but must be readied again after each use; the sim counts it as two-handed
    const oneHand = str => {
      const m = /^(\d+)\s*([†‡]*)/.exec(String(str ?? ""));
      if (!m || !m[2]) return true;
      return liftST >= Number(m[1]) * (m[2].includes("‡") ? 3 : 2);
    };
    const mkWeapon = (sel, melee) => {
      if (!sel) return null;
      let src = null, label = "";
      if (sel.trait) { src = findTraitWeapon(T.t.traits, sel.trait); label = sel.trait; }
      else if (sel.item) { const h = EQ.get(sel.item); src = h && h.e; label = sel.item; }
      if (!src) return null;
      const lines = weaponLines(src);
      const line = chooseLine(lines, sel.mode, melee);
      if (!line) return null;
      // a melee weapon's minimum ST (B270): -1 to skill per point short, and damage from no more than 3x it
      const mST = melee && !sel.trait ? Number((/^(\d+)/.exec(String(line.strength ?? "")) || [0, 0])[1]) : 0;
      const dST = mST && baseStrike + arm.striking > 3 * mST ? stDamage(3 * mST) : dmgST;
      const dmg = parseDamage(line.damage, dST.thr, dST.sw);
      if (!dmg) return null;
      const fl = followLine(lines, line);
      // "Rending hit (success by 5+ or critical)": same attack, better divisor on a good hit
      const rl = lines.find(x => x !== line && !!x.melee === melee && /success by (\d+)\+|rending hit/i.test(x.usage || ""));
      const rend = rl ? parseDamage(rl.damage, dST.thr, dST.sw) : null;
      const rendBy = rl ? Number((/success by (\d+)\+/i.exec(rl.usage) || [0, 5])[1]) : 0;
      const fdmg = fl ? parseDamage(fl.damage, dST.thr, dST.sw) : null;
      const level = skillLevel(st, line.skill, [line.skill, ...(line.defaults || [])]) - (mST && liftST < mST ? mST - liftST : 0);
      const facts = (SIMW[label] || {})[line.usage] || {};
      const cone = facts.cone || Number((/cone[^0-9]*(\d+)\s*(?:yards|yd)/i.exec(line.usage || "") || [])[1] || 0);
      const w = { id: ++WID, name: label, usage: line.usage, text: line.damage, dmg, follow: fdmg, followText: fl ? fl.damage : "", level,
        rend, rendBy, rendText: rl ? rl.damage : "", malf: facts.malf || 0,
        overheat: facts.overheat ? parseDamage(/[a-z]\s*$/.test(facts.overheat) ? facts.overheat : facts.overheat + " burn") : null,
        cone, blast: facts.blast || 0, warpflame: !!facts.warpflame, indirect: !!facts.indirect, minRange: facts.minRange || 0, chink: ((SIMW[label] || {})._item || {}).chink || 0, natural: !!sel.trait, dST };
      // an Agoniser's agony follow-up (B428): HT-N or Severe Pain (-4, -2 with High Pain Threshold); a critical
      // failure also stuns
      if (fl && !fdmg && /agony/i.test(fl.usage || "")) w.agony = -Number((/HT-(\d+)/.exec(fl.notes || "") || [0, 3])[1]);
      // a "per turn while ablaze" line is the burning the flames leave on a target that catches fire (B434), not a
      // second hit
      if (fl && /ablaze|catches fire/i.test(fl.usage || "")) { w.ablaze = fdmg; w.follow = null; w.followText = ""; }
      if (melee) {
        const p = String(line.parry ?? "0");
        w.parry = /no/i.test(p) ? null : num(p, 0);
        w.unbalanced = /U/.test(p);
        w.reach = String(line.reach ?? "1");
        // Size Modifier and Reach (B402): a big fighter's limbs and weapons reach further (SM +1 only turns C into 1)
        const smR = [0, 0, 1, 2, 3, 5, 7, 10][Math.max(0, Math.min(7, st.sm || 0))];
        w.reachMax = Math.max(1, ...(w.reach.match(/\d+/g) || ["1"]).map(Number)) + smR;
        w.oneHanded = oneHand(line.strength);
        w.fencing = /^(Rapier|Saber|Smallsword|Main-Gauche)/.test(line.skill || "");   // B208: +3 retreating parry, -2 per extra parry
        // weight for parrying (B376): the item's, or for a limb, claw or fist 1/20 of Basic Lift, ST x ST / 100
        // (Quadratic Natural Attacks, Pyramid 3/77 p. 8)
        w.weight = sel.trait ? st.st * st.st / 100 : parseFloat(src.weight) || 0;
      } else {
        w.acc = accOf(line.accuracy); w.range = parseRange(line.range) || { half: 100, max: 300 };
        w.rof = parseRoF(line.rate_of_fire); w.rcl = Math.max(1, num(line.recoil, 1)); w.rclFlat = /L/i.test(String(line.recoil ?? ""));
        w.shots = parseShots(line.shots); w.bulk = num(line.bulk, 0);
        // M: the ST and Bulk only matter off the mount (the sim always fires it mounted); B: the listed ST standing,
        // 2/3 of it (round up) fired prone from the bipod, which is braced (B270)
        const sm = /^(\d+)([MB†‡]*)/.exec(String(line.strength ?? ""));
        w.minST = sm && !/M/.test(sm[2]) ? Number(sm[1]) : 0;
        w.bipod = !!(sm && /B/.test(sm[2])); w.mounted = !!(sm && /M/.test(sm[2]));
        w.stPen = w.minST && liftST < w.minST ? w.minST - liftST : 0;
        w.stPenProne = w.bipod ? Math.max(0, Math.ceil(2 * w.minST / 3) - liftST) : w.stPen;
        w.level -= w.stPenProne; w.stStand = w.stPen - w.stPenProne;   // the rest only when not fired prone
        w.oneHanded = w.bulk >= -2 && oneHand(line.strength);
        // a long gun is a two-handed weapon (B270 †): with 1.5x its ST it can be held and fired in one hand, but is
        // unready after each shot; with 2x, freely. The sim uses this for a gun kept in one hand beside a drawn blade
        w.semiOne = !w.oneHanded && !w.mounted && w.minST > 0 && liftST >= Math.ceil(1.5 * w.minST);
        w.spentAfter = w.semiOne && liftST < 2 * w.minST;
        w.pistol = /Pistol/.test(line.skill || "");
      }
      return w;
    };
    const weaponMaster = w => {
      if (!w || !flags.wm || w.natural || w.level < st.dx + 1 || !w.dmg) return w;
      // per die of the ST-based thrust or swing the weapon line starts from, not the weapon's own added dice
      const per = w.level >= st.dx + 2 ? 2 : 1;
      const base = /^\s*(thr|sw)/.exec(w.text || "");
      const sd = w.dST || dmgST, dice = base ? Number((/^(\d+)d/.exec(base[1] === "thr" ? sd.thr : sd.sw) || [0, 0])[1]) : 0;
      w.dmg = { ...w.dmg, add: w.dmg.add + per * dice };
      w.text += ` (+${per}/die Weapon Master)`;
      return w;
    };
    let melee = weaponMaster(mkWeapon(spec.melee, true));
    // Flesh Hooks (Lictor, Ravener): a reach-2 hook strike that snags the target for a free grapple (bio-weapons.yaml)
    const hooks = findTraitWeapon(T.t.traits, "Flesh Hooks") ? mkWeapon({ trait: "Flesh Hooks", mode: "Standard" }, true) : null;
    // the same blade's other way of hitting (a sword's thrust beside its swing, B271): same field setting,
    // chosen blow by blow
    if (melee && spec.melee && spec.melee.item) {
      const h = EQ.get(spec.melee.item);
      const norm = u => String(u || "").toLowerCase().replace(/^(thrust|swing)[,\s]*/, "").replace(/[()]/g, "").trim();
      const alt = h && h.e ? weaponLines(h.e).filter(l => l.melee && l.usage !== melee.usage && !/follow|force strike|thrown/i.test(l.usage || "") && norm(l.usage) === norm(melee.usage)) : [];
      melee.alt = alt.map(l => weaponMaster(mkWeapon({ item: spec.melee.item, mode: l.usage }, true))).filter(w => w && w.dmg && w.reachMax === melee.reachMax);
    }
    // Tip Slash (MA113): a weapon that thrusts to impale can swing its tip across the target for cutting at its
    // impaling damage -2, at the same reach
    if (melee && melee.dmg) {
      const imp = [melee, ...(melee.alt || [])].find(w => w.dmg && w.dmg.type === "imp");
      if (imp) (melee.alt ||= []).push({ ...imp, id: ++WID, alt: undefined, usage: "Tip slash", text: imp.text + " (tip slash)", dmg: { ...imp.dmg, type: "cut", add: imp.dmg.add - 2, key: (imp.dmg.key || "") + "ts" } });
    }
    if (!melee) {
      const lvl = skillLevel(st, "Brawling", ["Brawling", "DX", "Karate"]);
      const hasB = (st.skills || []).some(s => s.name === "Brawling" || s.name === "Karate");
      const pd = parseDamage("thr" + (hasB ? "" : "-1") + " cr", dmgST.thr, dmgST.sw);
      melee = { id: ++WID, name: "Punch", usage: "Punch", text: "thr cr", dmg: pd, follow: null, level: lvl, parry: 0, unbalanced: false, reach: "C", reachMax: 1, malf: 0, weight: st.st * st.st / 100 };
    }
    const ranged = mkWeapon(spec.ranged, false);
    // a crew-served heavy weapon (squad `team`): one on a tripod or bipod, or a mortar on its baseplate, is fired from
    // its mount once set up (no ST penalty, braced, its weight off the gunner); a shoulder-fired one isn't set up
    const teamGun = w => { if (!w) return w; w.team = true; w.needsSetup = w.mounted || w.bipod || w.indirect; if (w.needsSetup) { w.level += w.stPenProne || 0; w.stPen = w.stPenProne = w.stStand = 0; w.mounted = true; } return w; };
    if (spec.team) teamGun(ranged);
    const heavy = spec.heavy ? teamGun(mkWeapon(spec.heavy, false)) : null;
    // a combat knife carried besides the main blade (loadout `knife`): reach C, so it works in close combat unpenalised
    const knife = spec.knife ? mkWeapon(spec.knife, true) : null;
    // a second ranged weapon that needs no hands (a Carnifex's bio-plasma): its own magazine, no reload in a fight
    const ranged2 = mkWeapon(spec.ranged2, false);
    if (ranged2) { ranged2.extra = true; ranged2.limit = ranged2.shots.mag === Infinity ? Infinity : ranged2.shots.mag; ranged2.shots = { mag: Infinity, reload: 0 }; }
    // thrown grenades (B410): Throwing skill, range from ST and weight (B355), one per Ready + Attack
    const THROW = [[0.05, 3.5], [0.1, 2.5], [0.15, 2], [0.2, 1.5], [0.25, 1.2], [0.3, 1.1], [0.4, 1], [0.5, 0.8], [0.75, 0.7], [1, 0.6], [1.5, 0.4], [2, 0.3]];
    const grenades = (spec.grenades || []).map(g => {
      const w = mkWeapon({ item: g.item, mode: g.mode }, false);
      if (!w) return null;
      const h = EQ.get(g.item), lb = parseFloat((h && h.e && h.e.weight) || 1) || 1;
      // Throwing at DX+1 adds 1 to ST for distance, DX+2 or better 2 (B356)
      const tST = liftST + (w.level >= st.dx + 2 ? 2 : w.level >= st.dx + 1 ? 1 : 0);
      const dist = Math.max(2, Math.floor(tST * ((THROW.find(([r]) => r >= lb / (tST * tST / 5)) || [0, 0.2])[1])));
      Object.assign(w, { range: { half: dist, max: dist }, acc: 0, rof: 1, rcl: 1, bulk: 0, shots: { mag: Infinity, reload: 0 }, thrown: true, count: g.count || 1, oneHanded: true, minST: 0, stStand: 0 });
      return w;
    }).filter(Boolean);
    // Encumbrance (B17): the loadout's weight against Basic Lift (Lifting ST); powered armour and battlesuits carry
    // themselves, and a mounted gun its mount. None, Light (x2 BL), Medium (x3), Heavy (x6), Extra-Heavy (x10)
    const POWERED = /Power Armour|Battlesuit|Mega Armour|Auramite|Terminator|Gravis|Cataphractii/i;
    const lbOf = n => { const h = n && EQ.get(n); return h ? parseFloat(h.e.weight) || 0 : 0; };
    const load = (spec.armour || []).filter(n => !POWERED.test(n)).reduce((a, n) => a + lbOf(n), 0)
      + (spec.ranged && spec.ranged.item && !(ranged && ranged.mounted) ? lbOf(spec.ranged.item) : 0)
      + (spec.melee && spec.melee.item && (!spec.ranged || spec.melee.item !== spec.ranged.item) ? lbOf(spec.melee.item) : 0)
      + (spec.grenades || []).reduce((a, g) => a + lbOf(g.item) * (g.count || 1), 0) + lbOf(spec.carried);
    const BL = liftST * liftST / 5;
    const encOf = l => l <= BL ? 0 : l <= 2 * BL ? 1 : l <= 3 * BL ? 2 : l <= 6 * BL ? 3 : 4;
    const enc = encOf(load);
    // a packed-up team weapon on the move: the gunner carries half of it and its tripod (20 lb; the autocannon's and
    // a mortar's own weight includes the mount), the loader the rest
    const packLb = ranged && ranged.team && ranged.needsSetup && spec.ranged ? (lbOf(spec.ranged.item) + (/Lascannon|Heavy Bolter|Multi-Melta|Plasma Cannon/.test(spec.ranged.item) ? 20 : 0)) / 2 : 0;
    // two weapons at once (B417): -4 each, the off hand -4 more unless Ambidexterity; Dual-Weapon Attack buys the -4 off
    const dwa = (st.skills || []).find(s => /^Dual-Weapon Attack/.test(s.name) && s.level != null);
    const dualPen = dwa && melee ? Math.max(0, melee.level - dwa.level) : 4;
    const offPen = flags.ambi || (st.skills || []).some(s => /^Off-Hand Weapon Training/.test(s.name)) ? 0 : 4;
    const parryOf = w => w && w.parry != null ? Math.floor(w.level / 2) + 3 + w.parry + (flags.enhParry || 0) + (flags.cr ? 1 : 0) : null;
    // a carried shield (data/sim/weapons.yaml _item): Defense Bonus, and its own DR and HP under Damage to Shields (B484)
    let db = 0, cs = null;
    for (const nm of [spec.carried, ...(spec.armour || []), spec.melee && spec.melee.item, spec.ranged && spec.ranged.item, spec.shield && spec.shield.item])
      if (nm && SIMW[nm] && SIMW[nm]._item && SIMW[nm]._item.db > db) { const it = SIMW[nm]._item; db = it.db; cs = { name: nm, db: it.db, dr: it.dr ?? null, hp: it.hp ?? null, ht: it.ht || 12, field: it.field || null }; }
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
      // spare magazines carried for the main gun (loadout `mags`, default 4); when they're gone the gun is empty for good
      mags: spec.mags ?? 4,
      db, powers, grenades, dualPen, offPen, fp: st.fp || st.ht, thrCr: parseDamage("thr cr", dmgST.thr, dmgST.sw),
      block: Math.floor(skillLevel(st, "Shield", ["Shield", "DX-4"]) / 2) + 3 + (flags.cr ? 1 : 0) + (flags.enhBlock || 0),
      // weapons in hand (B382): gun and blade are both ready when both are one-handed, when they're one weapon
      // (a bayonet on the lasgun, a guardian spear's bolt caster) or when either is natural; otherwise switching
      // is a Ready, free on a Fast-Draw roll (B194)
      bothReady: cs ? !ranged || !melee || !!melee.natural || !!ranged.natural || (spec.melee && spec.ranged && spec.melee.item === spec.ranged.item) : !ranged || !melee || melee.name === "Punch" || !!melee.natural || !!ranged.natural || (spec.melee && spec.ranged && spec.melee.item && spec.melee.item === spec.ranged.item)
        || /fixed to|mounted|underslung/i.test(melee.usage || "") || (!!ranged.oneHanded && !!melee.oneHanded),
      liftST,   // Lifting ST counts in grappling (B65)
      // squads: units sharing a squad tag deploy together and take morale together; the leader can give orders
      // (Leadership, B204), a vox-caster carries the orders to the whole squad, a Commissar keeps it in the fight
      squad: spec.squad || null, squadName: spec.squadName || null, role: spec.role || null, leader: !!spec.leader, vox: !!spec.vox,
      team: spec.team || null, crew: spec.crew || null, heavy, movePacked: Math.max(1, Math.floor((st.move + arm.move) * [1, 0.8, 0.6, 0.4, 0.2][encOf(load + packLb)])),
      commissar: !!spec.commissar || /Commissar/.test(spec.template),
      ranged2,
      body: spec.body || (LOADOUTS[spec.template] || {}).body || "upright",   // posture for height in melee (Pyramid 3/77 p. 4)
      hooks,
      // Fast-Draw, +1 with Combat Reflexes (B43); Fast-Draw (Grenade) on its own
      // Fast-Draw is specialised (B194): a blade needs Knife, Sword, Two-Handed Sword or Force Sword, a gun Pistol or Long Arm
      fdBlade: Math.max(-Infinity, ...(st.skills || []).filter(s => /^Fast-Draw \((Knife|Sword|Two-Handed Sword|Force Sword)/.test(s.name) && s.level != null).map(s => s.level)) + (flags.cr ? 1 : 0),
      fdKnife: Math.max(-Infinity, ...(st.skills || []).filter(s => /^Fast-Draw \(Knife/.test(s.name) && s.level != null).map(s => s.level)) + (flags.cr ? 1 : 0),
      fdGun: Math.max(-Infinity, ...(st.skills || []).filter(s => /^Fast-Draw \((Pistol|Long Arm)/.test(s.name) && s.level != null).map(s => s.level)) + (flags.cr ? 1 : 0),
      fdGrenade: Math.max(-Infinity, ...(st.skills || []).filter(s => /^Fast-Draw \(Grenade/.test(s.name) && s.level != null).map(s => s.level)) + (flags.cr ? 1 : 0), st: st.st, dx: st.dx, formation: spec.formation || "line",
      // elites call shots: a best combat skill (weapon or power) of 17+, two past a trained line soldier's 15,
      // and a mind that picks its shots (IQ 8+). Points were a poor proxy: an Ork Boy's ST 28 costs 300+.
      elite: Math.max(melee ? melee.level : 0, ranged ? ranged.level : 0, ...powers.map(p => p.level)) >= 17 && st.iq >= 8,
      // grappling (B370): DX, or Wrestling, Judo or Sumo Wrestling if better
      grapple: Math.max(st.dx, ...(st.skills || []).filter(s => /^(Wrestling|Judo|Sumo Wrestling)\b/.test(s.name) && s.level != null).map(s => s.level)),
      ai: aiProfile(spec.template),
      stance: spec.stance || "shoot", ambush: !!spec.ambush, stats: st, flags, speed: st.speed, move: Math.max(1, Math.floor((st.move + arm.move) * [1, 0.8, 0.6, 0.4, 0.2][enc])),
      dodge: st.dodge - enc, enc, HP: st.hp + arm.hp, HT: st.ht, will: st.will, sm: st.sm || 0,
      arm, nat, ranged, melee, parry: parryOf(melee), knife, knifeParry: knife ? parryOf(knife) : null, cs, judo: (st.skills || []).some(s => /^(Judo|Karate|Boxing)/.test(s.name) && s.level != null), bl: Math.round(liftST * liftST / 5),
      shield: spec.shield && spec.shield.sp ? { ...spec.shield } : cs && cs.field ? { item: cs.name + " field", ...cs.field, ranged_only: false, arc: "shield" } : pshield,
      // clothing that can catch fire (B433-434): cloth, flak, robes and hides; sealed plate, carapace, chitin and
      // machine bodies are Nonflammable or Highly Resistant; the unarmoured burn unless bare chitin or machine
      burns: !flags.machine && ((spec.armour || []).length ? (spec.armour || []).some(n => FLAMMABLE.test(n)) : !UNCLOTHED.test(spec.template)),
    };
    return u;
  }
  function describe(u) {
    const tor = drAt(u.arm.dr, "torso") + drAt(u.nat, "torso"), eye = drAt(u.arm.dr, "eye") + natDRat(u, "eye");
    return {
      hp: u.HP, ht: u.HT, dodge: u.dodge, dmgRed: u.flags.dmgRed > 1 ? u.flags.dmgRed : 0, parry: u.parry, move: u.move, drTorso: tor, drEye: eye, wp: u.arm.wp,
      ranged: u.ranged && { name: u.ranged.name, usage: u.ranged.usage, dmg: u.ranged.text, follow: u.ranged.followText, skill: u.ranged.level, acc: u.ranged.acc, rof: u.ranged.rof, range: u.ranged.range },
      melee: u.melee && { name: u.melee.name, usage: u.melee.usage, dmg: u.melee.text + (u.melee.dmg ? ` = ${fmtDice(u.melee.dmg)}` : "") + (u.melee.rend ? `; rending hit (${u.melee.rendBy}+) ${fmtDice(u.melee.rend)}` : ""), skill: u.melee.level },
      shield: u.shield, db: u.db, carried: u.cs && { name: u.cs.name, db: u.cs.db, dr: u.cs.dr, hp: u.cs.hp },
    };
  }
  function fmtDice(d) {
    return `${d.n}d${d.add > 0 ? "+" + d.add : d.add < 0 ? d.add : ""}${d.mult !== 1 ? "x" + d.mult : ""}${d.div !== 1 ? `(${d.div === Infinity ? "∞" : d.div})` : ""} ${d.type}${d.ex ? " ex" : ""}`;
  }

  // ---------------------------------------------------------------- wounding
  const BASE = { "pi-": 0.5, pi: 1, "pi+": 1.5, "pi++": 2, imp: 2, cut: 1.5, cr: 1, burn: 1, tox: 1, cor: 1 };
  const UNLIVING = { "pi-": 0.2, pi: 1 / 3, "pi+": 0.5, "pi++": 1, imp: 1 };
  const HOMOG = { "pi-": 0.1, pi: 0.2, "pi+": 1 / 3, "pi++": 0.5, imp: 0.5 };
  // natural DR at a location: the skull's +2 only for those with a brain (No Brain treats the skull as the face, B61);
  // the eye half the hide's DR unless a trait gives an eye value (every template note gives exactly half)
  function natDRat(u, loc) {
    const nb = u.flags.nobrain || u.flags.homogenous || u.flags.diffuse;
    // a hide's eye is as tough as its head (user direction), unless the template gives the eye its own DR
    if (loc === "eye") return u.nat.eye != null ? drAt(u.nat, "eye") : drAt(u.nat, "skull");
    return drAt(u.nat, loc === "vitals" ? "torso" : loc) + (loc === "skull" && !nb ? 2 : 0);
  }
  function woundMult(type, loc, flags, ex) {
    const brain = (loc === "skull" || loc === "eye") && !flags.nobrain && !flags.homogenous;
    if (loc === "skull" && brain) return type === "tox" ? 1 : 4;
    if (loc === "eye" && brain) return type === "tox" ? 1 : 4;
    if (loc === "vitals" && (flags.homogenous || flags.novitals || flags.diffuse)) loc = "torso";
    if (loc === "vitals") return type.startsWith("pi") || type === "imp" ? 3 : type === "burn" && !ex ? 2 : BASE[type] ?? 1;
    let m = BASE[type] ?? 1;
    if (loc === "face" && type === "cor") m = 1.5;
    if (loc === "neck") m = type === "cut" ? 2 : (type === "cr" || type === "cor") ? 1.5 : m;
    if (["arm", "leg", "hand", "foot"].includes(loc) && (type === "pi+" || type === "pi++" || type === "imp")) m = 1;
    if (flags.homogenous && HOMOG[type] != null) m = Math.min(m, HOMOG[type]);
    else if (flags.unliving && UNLIVING[type] != null && loc !== "skull" && loc !== "eye") m = Math.min(m, UNLIVING[type]);
    return m;
  }
  // Large-area injury (B400): cones, area effects and external explosions strike the torso with the average of the
  // torso's DR and the least protected location's, rounded up. Returns { arm, nat } like a location's DR
  const AREA_LOCS = ["skull", "face", "neck", "torso", "groin", "arm", "hand", "leg", "foot"];
  function areaDR(u) {
    const tot = l => drAt(u.arm.dr, l) + natDRat(u, l);
    let lo = Infinity;
    for (const l of AREA_LOCS) lo = Math.min(lo, tot(l));
    const all = Math.ceil((tot("torso") + lo) / 2), nat = Math.min(natDRat(u, "torso"), all);
    return { arm: all - nat, nat };
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
  // hexes strictly between a and b on the straight line (cube-coordinate lerp, nudged off hex edges)
  function lineHexes(a, b, s = 1) {
    const n = hexDist(a, b), out = [];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = a.q + (b.q - a.q) * t + 1e-6 * s, z = a.r + (b.r - a.r) * t + 1e-6 * s, y = -x - z;
      let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
      out.push({ q: rx, r: rz });
    }
    return out;
  }
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
  // which side a figure in a side or front hex is on: "L" or "R" (the shield arm is the left)
  function sideOf(at, facing, from) {
    const [ax, ay] = px(at), [bx, by] = px(from);
    let d = Math.atan2(by - ay, bx - ax) - DIRANG[facing];
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    return d < 0 ? "L" : "R";
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

  // ------------------------------------------------------------------ battlefields
  // A facility (user direction): long hallways three yards wide, cross corridors, rooms off them through doors,
  // staging bays at each end, and crates and barricades for cover. Walls block movement and sight; crates block
  // movement but not sight, and cover whoever crouches behind them. Built from a layout number, so every run of
  // a Monte Carlo fights over the same ground.
  const MAPS = new Map();
  function facilityMap(seed = 1) {
    seed = Math.max(1, Math.floor(seed));
    if (MAPS.has(seed)) return MAPS.get(seed);
    let st = (seed * 2654435761) >>> 0;
    const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const W = 64, H = 37, floor = new Set(), crates = new Map(), doors = new Set();
    const K = (c, r) => { const h = fromOffset(c, r); return key(h.q, h.r); };
    const carve = (c0, r0, c1, r1) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (c > 0 && r > 0 && c < W - 1 && r < H - 1) floor.add(K(c, r)); };
    carve(1, 1, 7, H - 2); carve(W - 8, 1, W - 2, H - 2);                     // staging bays
    const hy = [ri(8, 10), ri(17, 19), ri(26, 28)];                            // hallways
    for (const y of hy) carve(1, y - 1, W - 2, y + 1);
    const vx = [ri(19, 21), ri(31, 33), ri(43, 45)];                           // cross corridors, in pieces
    [[1, hy[0]], [hy[0], hy[1]], [hy[1], hy[2]], [hy[2], H - 2]].forEach(([a, b]) => vx.forEach(x => { if (rnd() < 0.55) carve(x - 1, a, x + 1, b); }));
    const bandsY = [[1, hy[0] - 3], [hy[0] + 3, hy[1] - 3], [hy[1] + 3, hy[2] - 3], [hy[2] + 3, H - 2]];
    const bandsX = [[9, vx[0] - 3], [vx[0] + 3, vx[1] - 3], [vx[1] + 3, vx[2] - 3], [vx[2] + 3, W - 10]];
    const rooms = [];
    for (const [y0, y1] of bandsY) for (const [x0, x1] of bandsX) {
      if (y1 - y0 < 1 || x1 - x0 < 2 || rnd() < 0.12) continue;
      carve(x0, y0, x1, y1); rooms.push([x0, y0, x1, y1]);
      // a door is the two wall hexes cut through to the hallway or corridor
      const door = (c0, r0, c1, r1) => { carve(c0, r0, c1, r1); for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) doors.add(K(c, r)); };
      const up = () => { const c = ri(x0, x1 - 1); door(c, y0 - 1, c + 1, y0 - 1); };
      const down = () => { const c = ri(x0, x1 - 1); door(c, y1 + 1, c + 1, y1 + 1); carve(c, y1 + 2, c + 1, y1 + 2); };
      const left = () => { const r = ri(y0, Math.max(y0, y1 - 1)); door(x0 - 1, r, x0 - 1, r + 1); carve(x0 - 2, r, x0 - 2, r + 1); };
      const right = () => { const r = ri(y0, Math.max(y0, y1 - 1)); door(x1 + 1, r, x1 + 1, r + 1); carve(x1 + 2, r, x1 + 2, r + 1); };
      if (y0 > 1 && (y1 >= H - 2 || rnd() < 0.5)) up(); else down();        // always a door to a hallway
      if (rnd() < 0.6) [up, down, left, right][ri(0, 3)]();
    }
    const spawn = [fromOffset(4, hy[1]), fromOffset(W - 5, hy[1])];
    // crates: a few per room and bay, and every several yards along the hallways; each kept only if every
    // floor hex stays reachable from the first bay
    const reach = () => {
      const k0 = key(spawn[0].q, spawn[0].r), seen = new Set([k0]), q = [spawn[0]];
      for (let i = 0; i < q.length; i++) for (const [dq, dr] of DIRS) {
        const n = { q: q[i].q + dq, r: q[i].r + dr }, nk = key(n.q, n.r);
        if (!seen.has(nk) && floor.has(nk) && !crates.has(nk)) { seen.add(nk); q.push(n); }
      }
      return seen.size;
    };
    const cands = [];
    for (const [x0, y0, x1, y1] of rooms) for (let i = 0; i < Math.floor((x1 - x0 + 1) * (y1 - y0 + 1) / 16); i++) cands.push([ri(x0, x1), ri(y0, y1)]);
    for (const y of hy) for (let c = 10 + ri(0, 4); c < W - 10; c += ri(5, 9)) if (rnd() < 0.75) cands.push([c, y + ri(-1, 1)]);
    for (const x0 of [2, W - 7]) for (let i = 0; i < 5; i++) cands.push([x0 + ri(0, 4), ri(3, H - 4)]);
    let want = reach();
    for (const [c, r] of cands) {
      const k = K(c, r);
      if (!floor.has(k) || crates.has(k) || doors.has(k) || spawn.some(sp => hexDist(sp, fromOffset(c, r)) <= 2)) continue;
      crates.set(k, rnd() < 0.5 ? "light" : "heavy");
      const got = reach();
      if (got < want - 1) crates.delete(k); else want = got;
    }
    // every hex inside the outer wall, as indices: floor, crates, doors and the interior walls (which can be
    // breached); the outer wall can't
    const ids = new Map(), hx = [];
    for (let c = 1; c < W - 1; c++) for (let r = 1; r < H - 1; r++) { const h = fromOffset(c, r), k = key(h.q, h.r); ids.set(k, hx.length); hx.push(h); }
    const nb = hx.map(h => DIRS.map(([dq, dr]) => ids.get(key(h.q + dq, h.r + dr))).filter(i => i != null));
    const ks = hx.map(h => key(h.q, h.r));
    const wallI = Uint8Array.from(ks, k => floor.has(k) ? 0 : 1), crateI = Uint8Array.from(ks, k => crates.has(k) ? 1 : 0), doorI = Uint8Array.from(ks, k => doors.has(k) ? 1 : 0);
    // line of sight and cover geometry never change, so they're cached per map; what a line crosses that can
    // change (walls, doors) is stored with it and checked against the battle's own state
    // lighting (B394): the bays and hallways are lit, the cross corridors dim (-2), and each room lit, dim (-3) or
    // dark (-7), drawn after everything else so the layout itself is unchanged
    const lightAt = new Map();
    for (const x of vx) for (let c = x - 1; c <= x + 1; c++) for (let r = 1; r < H - 1; r++) if (!hy.some(y => Math.abs(r - y) <= 1)) lightAt.set(K(c, r), -2);
    for (const [x0, y0, x1, y1] of rooms) { const v = rnd(), L0 = v < 0.4 ? 0 : v < 0.75 ? -3 : -7; for (let c = x0; c <= x1; c++) for (let r = y0; r <= y1; r++) lightAt.set(K(c, r), L0); }
    const light = Int8Array.from(ks, k => floor.has(k) ? lightAt.get(k) || 0 : 0);
    // elevation (B402, B407), from its own random stream so the layout and lighting above are unchanged: a gantry
    // 3 yards up along the back wall of each staging bay, reached by a stair (a yard a hex) at each end, and in some
    // rooms a loading dock 4 feet high along a wall without a door
    let st2 = (seed * 2246822519 + 3266489917) >>> 0;
    const rnd2 = () => { st2 = (st2 + 0x6D2B79F5) >>> 0; let t = st2; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri2 = (a, b) => a + Math.floor(rnd2() * (b - a + 1));
    const zAt = new Map(), clear = (c, r) => { const k = K(c, r); crates.delete(k); };
    for (const [c0, c1, dir] of [[1, 2, 1], [W - 3, W - 2, -1]]) {
      for (let c = c0; c <= c1; c++) for (let r = 1; r < H - 1; r++) zAt.set(K(c, r), 3);
      const edge = dir > 0 ? c1 : c0;
      for (const r of [ri2(3, hy[0] - 2), ri2(hy[2] + 2, H - 4)]) for (let st = 1; st <= 3; st++) { zAt.set(K(edge + dir * st, r), Math.max(0, 3 - st)); clear(edge + dir * st, r); }
    }
    for (const [x0, y0, x1, y1] of rooms) {
      if (rnd2() >= 0.35 || x1 - x0 < 4) continue;
      const doorBy = c => { for (let r = y0 - 1; r <= y1 + 1; r++) if (doors.has(K(c, r))) return true; return false; };
      const cs = !doorBy(x0 - 1) ? [x0, x0 + 1] : !doorBy(x1 + 1) ? [x1 - 1, x1] : null;
      if (!cs) continue;
      for (const c of cs) for (let r = y0; r <= y1; r++) zAt.set(K(c, r), 4 / 3);
    }
    const elev = Float32Array.from(ks, k => floor.has(k) ? zAt.get(k) || 0 : 0);
    for (let i = 0; i < ks.length; i++) if (crateI[i] && !crates.has(ks[i])) crateI[i] = 0;
    const map = { floor, crates, doors, spawn, W, H, ids, hx, nb, wallI, crateI, doorI, light, elev, lineC: new Map(), covC: new Map() };
    MAPS.set(seed, map);
    return map;
  }

  // ruins (user direction): a shattered city block. Open streets with rubble, and six to nine ruined buildings of one
  // to three storeys. Each storey is 3 yards; an upper floor that still stands covers part of its building (solid
  // beneath, in this one-surface-per-hex map), reached by a stair of 1-yard steps. Outer walls stand at full height in
  // places and are broken down elsewhere: to a parapet a yard and a bit above a floor, to a stump, to rubble (a
  // barricade) or to a gap. Each wall hex keeps its height for sight (wallTop)
  function ruinsMap(seed = 1) {
    seed = Math.max(1, Math.floor(seed));
    const mk = "ruins" + seed;
    if (MAPS.has(mk)) return MAPS.get(mk);
    let st = (seed * 3266489917 + 668265263) >>> 0;
    const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const W = 64, H = 37, floor = new Set(), crates = new Map(), doors = new Set(), zAt = new Map(), top = new Map(), inside = new Set();
    const K = (c, r) => { const h = fromOffset(c, r); return key(h.q, h.r); };
    for (let c = 1; c < W - 1; c++) for (let r = 1; r < H - 1; r++) floor.add(K(c, r));
    const xb = [[10, 22], [26, 38], [42, 53]], yb = [[2, 11], [14, 22], [25, 34]];
    const blds = [];
    for (const [bx0, bx1] of xb) for (const [by0, by1] of yb) {
      if (rnd() < 0.15) continue;   // an open square
      const x0 = bx0 + ri(0, 2), x1 = bx1 - ri(0, 2), y0 = by0 + ri(0, 1), y1 = by1 - ri(0, 1);
      const S = rnd() < 0.25 ? 1 : rnd() < 0.6 ? 2 : 3, Hb = 3 * S + 2;
      const b = { x0, y0, x1, y1, S, Hb, gaps: [] };
      blds.push(b);
      for (let c = x0 + 1; c < x1; c++) for (let r = y0 + 1; r < y1; r++) inside.add(K(c, r));
      // upper floors: the first covers the building's left or right part, the second the top or bottom of that
      if (S >= 2) {
        const left = rnd() < 0.5, w = x1 - x0 - 1, sw = Math.max(3, Math.min(w - 4, Math.round(w * (0.45 + rnd() * 0.2))));
        const sx0 = left ? x0 + 1 : x1 - sw, sx1 = left ? x0 + sw : x1 - 1;
        for (let c = sx0; c <= sx1; c++) for (let r = y0 + 1; r < y1; r++) zAt.set(K(c, r), 3);
        let ry0 = -1, ry1 = -2;
        const third = S === 3 && y1 - y0 >= 7, up = rnd() < 0.5;
        if (third) { const h = y1 - y0 - 1, sh = Math.max(2, Math.round(h * 0.45)); ry0 = up ? y0 + 1 : y1 - sh; ry1 = up ? y0 + sh : y1 - 1; }
        // a stair down into the ground floor: 2 then 1 yard, on a row clear of the walls and of the floor above
        const rows = []; for (let r = y0 + 2; r <= y1 - 2; r++) if (r < ry0 - 1 || r > ry1 + 1) rows.push(r);
        const sr = rows.length ? rows[ri(0, rows.length - 1)] : y1 - 2, dir = left ? 1 : -1, e = left ? sx1 : sx0;
        zAt.set(K(e + dir, sr), 2); zAt.set(K(e + 2 * dir, sr), 1);
        b.stair = [K(e + dir, sr), K(e + 2 * dir, sr), K(e + 3 * dir, sr)];
        if (third) {
          for (let c = sx0; c <= sx1; c++) for (let r = ry0; r <= ry1; r++) zAt.set(K(c, r), 6);
          const sc = ri(sx0 + 1, sx1 - 1), d2 = up ? 1 : -1, e2 = up ? ry1 : ry0;
          zAt.set(K(sc, e2 + d2), 5); zAt.set(K(sc, e2 + 2 * d2), 4);
          b.stair.push(K(sc, e2 + d2), K(sc, e2 + 2 * d2), K(sc, e2 + 3 * d2));
        } else if (S === 3) b.S = S - 1;
      }
      // the outer wall, hex by hex
      const zIn = (c, r) => zAt.get(K(Math.max(x0 + 1, Math.min(x1 - 1, c)), Math.max(y0 + 1, Math.min(y1 - 1, r)))) || 0;
      for (let c = x0; c <= x1; c++) for (let r = y0; r <= y1; r++) {
        if (c > x0 && c < x1 && r > y0 && r < y1) continue;
        const k = K(c, r), corner = (c === x0 || c === x1) && (r === y0 || r === y1), zi = zIn(c, r), v = rnd();
        if (!corner && v < 0.16) { b.gaps.push([c, r, zi]); continue; }                          // a gap: open floor
        if (!corner && v < 0.32) { crates.set(k, rnd() < 0.7 ? "heavy" : "light"); continue; }    // fallen to rubble
        floor.delete(k);
        const full = corner || v < 0.62;
        top.set(k, full ? 3 * b.S + 2 : Math.min(3 * b.S + 2, zi > 0 ? zi + 1.2 : [2, 4.2, 7.2][ri(0, Math.max(0, b.S - 1))]));
      }
      // at least two ways in at street level
      for (let tries = 0; b.gaps.filter(g => g[2] === 0).length < 2 && tries < 60; tries++) {
        const side = ri(0, 3), c = side < 2 ? ri(x0 + 1, x1 - 1) : side === 2 ? x0 : x1, r = side < 2 ? (side ? y1 : y0) : ri(y0 + 1, y1 - 1);
        if (zIn(c, r) > 0 || b.gaps.some(g => g[0] === c && g[1] === r)) continue;
        const k = K(c, r); floor.add(k); top.delete(k); crates.delete(k); b.gaps.push([c, r, 0]);
      }
    }
    const spawn = [fromOffset(4, Math.floor(H / 2)), fromOffset(W - 5, Math.floor(H / 2))];
    // rubble in the streets and the deployment zones, kept only if every street hex stays reachable
    const reach = () => {
      const k0 = key(spawn[0].q, spawn[0].r), seen = new Set([k0]), q = [spawn[0]];
      for (let i = 0; i < q.length; i++) for (const [dq, dr] of DIRS) {
        const n = { q: q[i].q + dq, r: q[i].r + dr }, nk = key(n.q, n.r);
        if (!seen.has(nk) && floor.has(nk) && !crates.has(nk) && Math.abs((zAt.get(nk) || 0) - (zAt.get(key(q[i].q, q[i].r)) || 0)) <= 1.01) { seen.add(nk); q.push(n); }
      }
      return seen.size;
    };
    let want = reach();
    for (let i = 0; i < 70; i++) {
      const c = ri(2, W - 3), r = ri(2, H - 3), k = K(c, r);
      if (!floor.has(k) || crates.has(k) || inside.has(k) || zAt.get(k) || spawn.some(sp => hexDist(sp, fromOffset(c, r)) <= 2)) continue;
      crates.set(k, rnd() < 0.45 ? "heavy" : "light");
      const got = reach();
      if (got < want - 1) crates.delete(k); else want = got;
    }
    // rubble that walls off a stair or a gap goes
    for (const b of blds) { for (const k of b.stair || []) crates.delete(k); for (const [c, r] of b.gaps) crates.delete(K(c, r)); }
    const ids = new Map(), hx = [];
    for (let c = 1; c < W - 1; c++) for (let r = 1; r < H - 1; r++) { const h = fromOffset(c, r), k = key(h.q, h.r); ids.set(k, hx.length); hx.push(h); }
    const nb = hx.map(h => DIRS.map(([dq, dr]) => ids.get(key(h.q + dq, h.r + dr))).filter(i => i != null));
    const ks = hx.map(h => key(h.q, h.r));
    const wallI = Uint8Array.from(ks, k => floor.has(k) ? 0 : 1), crateI = Uint8Array.from(ks, k => crates.has(k) ? 1 : 0), doorI = new Uint8Array(ks.length);
    // the ground floors inside the shells are dim (-2): smoke, dust, the floor above
    const light = Int8Array.from(ks, k => floor.has(k) && inside.has(k) && !zAt.get(k) ? -2 : 0);
    const elev = Float32Array.from(ks, k => floor.has(k) ? zAt.get(k) || 0 : 0);
    const wallTop = Float32Array.from(ks, k => floor.has(k) ? 0 : top.get(k) || 99);
    const map = { kind: "ruins", floor, crates, doors, spawn, W, H, ids, hx, nb, wallI, crateI, doorI, light, elev, wallTop, lineC: new Map(), covC: new Map() };
    MAPS.set(mk, map);
    return map;
  }
  const battleMap = opt => opt.terrain || (opt.battlefield === "facility" ? facilityMap(opt.mapSeed || 1) : opt.battlefield === "ruins" ? ruinsMap(opt.mapSeed || 1) : null);

  // called-shot locations and their penalties (B398-399)
  // Chinks in Armor (B400): an aimed attack at a gap in the armour, -8 on the torso and -10 anywhere else, halves the armour's DR.
  // Planned locations carry a "#c" suffix; only aiming attackers (elites by default) consider them.
  const CHINK = loc => loc === "torso" ? -8 : -10;
  const locName = l => l && l.endsWith("#c") ? "chink in the " + l.slice(0, -2) + " armour" : l;
  const AIM = { torso: 0, vitals: -3, skull: -7, eye: -9, face: -5, neck: -5, groin: -3, arm: -2, leg: -2, hand: -4, foot: -4 };
  // an aimed attack at one of these that misses by exactly 1 hits the torso instead (B552 note 1)
  const NEAR_TORSO = new Set(["eye", "skull", "face", "groin", "neck", "vitals"]);
  // cover (Tactical Shooting p. 28): what it takes off a foe's shot at you, and what it costs you to shoot back from
  // behind it unless braced and aiming; its DR for the legs and groin it hides (B407)
  const COVER_DR = { none: 0, crate: 15, barricade: 60, corner: 60, light: 15, heavy: 60, crest: 200, parapet: 50 };
  const COVER_PEN = { none: 0, crate: 2, corner: 2, light: 2, barricade: 3, heavy: 4, crest: 2, parapet: 3 };
  const COVER_OWN = { none: 0, crate: 0, corner: 0, light: 0, barricade: 2, heavy: 4, crest: 0, parapet: 0 };
  // what each kind of cover hides (B407): 1 covered, 0.5 half exposed (a random hit there strikes the cover on 4-6).
  // A crate or light cover is waist-high; a barricade chest-high; heavy cover a firing slit; a corner hides one side
  const LEGS = { leg: 1, foot: 1, groin: 1 };
  const HIDES = {
    crate: LEGS, light: LEGS, crest: LEGS, parapet: { ...LEGS, vitals: 0.5, torso: 0.5 },
    barricade: { ...LEGS, torso: 0.5, vitals: 0.5, arm: 0.5, hand: 0.5 },
    heavy: { ...LEGS, torso: 1, vitals: 1, arm: 0.5, hand: 0.5 },
    corner: { torso: 0.5, vitals: 0.5, groin: 0.5, arm: 0.5, hand: 0.5, leg: 0.5, foot: 0.5 },
  };
  // a crouching, kneeling or lying target is an extra -2 to hit in these (B548)
  const LOW = new Set(["torso", "vitals", "groin", "leg", "foot"]);
  // plunging fire: how high each location sits on a standing man (yards, of 2), and how high each kind of cover
  // stands. Cover a yard in front of a target hides a location only while the line from a higher shooter passes
  // below the cover's top there; it drops a yard every (distance / height advantage) yards
  const LOC_H = { foot: 0.1, leg: 0.5, groin: 0.9, hand: 1.0, vitals: 1.15, torso: 1.25, arm: 1.35, neck: 1.65, face: 1.75, eye: 1.75, skull: 1.85 };
  const COVER_TOP = { crate: 1, light: 1, barricade: 1.5, heavy: 1.9 };

  // ------------------------------------------------------------------ battle
  function runBattle(unitSpecs, opt = {}) {
    const distance = Math.max(2, Math.round(opt.distance ?? 100)), maxTurns = opt.maxTurns ?? 1200, morale = opt.morale !== false;
    const frac = opt.health === "fractional", boxes = opt.boxes || 5;
    const SIGHTED = !!opt.sightedShots;
    const TDODGE = !!opt.tacticalDodge;
    const LIMDODGE = opt.limitedDodges !== false;   // Limiting Multiple Dodges (MA122), a base rule here (user direction): -1 per dodge after the first each turn
    const CINEMATIC = !!opt.cinematicEffort;   // Martial Arts option (MA131-132): Heroic Charge and other extra effort   // Tactical Shooting option (p. 17): Dodge firearms only from the one gunman you watch   // Tactical Shooting option: an aimed shot is All-Out Attack (Determined)
    // hit locations: "elite" (default: elites aim, everyone else hits random locations), "aimed" (everyone, RAW), "random"
    const locMode = opt.locations || "elite";
    const aimsShots = m => locMode === "aimed" || (locMode === "elite" && m.u.elite);
    const cover = opt.cover || ["none", "none"];
    const log = opt.log ? [] : null;
    const frames = opt.frames ? [] : null;
    // what happened each second, for the replay: shots, blows, blasts and casualties
    const fx = frames ? [] : null;
    let fxb = [];
    const FX = e => { if (fx) fxb.push(e); };
    const L = s => { if (log && log.length < 5000) log.push(s); };
    const units = unitSpecs.map(s => buildUnit(s.spec, s.side));
    const models = [];
    const occ = new Map();
    const place = (m, h) => { if (m.h) occ.delete(key(m.h.q, m.h.r)); m.prevH = m.h; m.h = h; if (h) { occ.set(key(h.q, h.r), m); if (frames && m.trail) m.trail.push([h.q, h.r]); } };
    // terrain: walls block movement and sight until breached; crates block movement only; doors block both
    // while closed. The map is shared by every run; what changes in a battle (doors, breaches, wall damage) lives here
    const terr = battleMap(opt);
    // lighting (B394): "mixed" (a facility's default: lit hallways, dim corridors, rooms lit, dim or dark), "lit",
    // or "dark" (-7 everywhere). Open ground is lit
    const LIGHT = terr ? opt.lighting || "mixed" : "lit";
    const nH = terr ? terr.hx.length : 0;
    const pass = terr ? Uint8Array.from(terr.wallI, (w, i) => w || terr.crateI[i] ? 0 : 1) : null;   // walkable (closed doors count: they open)
    const broken = new Uint8Array(nH), closed = new Uint8Array(nH), shp = new Float64Array(nH).fill(-1);
    const tev = [];            // terrain changes for the replay: [second, "q,r", "open" | "closed" | "broken"]
    let turnNow = 0;
    if (terr) for (let i = 0; i < nH; i++) if (terr.doorI[i] && R() < 0.5) closed[i] = 1;   // half the doors start shut
    const idx = k => terr.ids.get(k);
    const startShut = terr ? new Set([...terr.doors].filter(k => closed[idx(k)])) : null;
    const blocker = i => (terr.wallI[i] && !broken[i]) || closed[i];
    const walkable = k => { const i = idx(k); return i != null && pass[i] && !closed[i]; };
    const wallAt = k => !!terr && !walkable(k);
    const taken = k => occ.has(k) || wallAt(k);
    const NK = (q, r) => (q + 2048) * 4096 + (r + 2048);
    // ---- elevation, in yards above the ground: a facility's gantries and docks, or on open ground a ridge held by one
    // side ({ side, height }): a plateau from 3 yards in front of that side's line back, sloping down to the plain
    // over twice its height (at least 6 yards)
    const EL = terr && terr.elev && terr.elev.some(z => z) ? terr.elev : null;
    const RIDGE = !terr && opt.ridge && opt.ridge.height > 0 ? (() => {
      const H = Math.min(30, +opt.ridge.height), side = opt.ridge.side ? 1 : 0;
      return { H, side, qc: side ? distance - 3 : 3, dir: side ? -1 : 1, S: Math.max(6, 2 * H) };
    })() : null;
    const ridgeZ = q => { const x = RIDGE.dir * (q - RIDGE.qc); return x <= 0 ? RIDGE.H : x >= RIDGE.S ? 0 : RIDGE.H * (1 - x / RIDGE.S); };
    const ELEV = !!(EL || RIDGE);
    const elevAt = h => !h || !ELEV ? 0 : EL ? EL[idx(key(h.q, h.r))] || 0 : ridgeZ(h.q);
    // firing up and down (B407): +1 yard of effective range a yard the target is above, -1 for every two yards it's
    // below (to no less than half the ground distance)
    const rngD = (a, b, d) => {
      if (!ELEV || !a || !b) return d;
      const dz = elevAt(b) - elevAt(a);
      if (dz > 0) return d + Math.round(dz);
      const sub = Math.floor(-dz / 2);
      return sub ? Math.max(Math.ceil(d / 2), d - sub) : d;
    };
    // a line over the ridge's crest from a point za yards above a's ground to one zb above b's: clear if it passes
    // above the crest (the plateau's edge is the only point that can block it)
    function overCrest(a, b, za, zb) {
      const { qc } = RIDGE;
      if ((a.q - qc) * (b.q - qc) >= 0) return true;
      const t = (qc - a.q) / (b.q - a.q), z0 = ridgeZ(a.q) + za, z1 = ridgeZ(b.q) + zb;
      return z0 + t * (z1 - z0) >= RIDGE.H - 1e-6;
    }
    // the hexes a line crosses that could block it (walls, doors), or null if it leaves the facility
    // in the ruins, sight runs from eyes 1.6 yards above the floor to the same height over the target's: a wall blocks
    // it only where it stands taller than the line, and a floor (or the solid mass under an upper floor) taller than
    // the line blocks it outright
    const WT = terr && terr.wallTop ? terr.wallTop : null;
    function lineBlockers(a, b, sgn) {
      const n = hexDist(a, b), out = [];
      const za = WT ? terr.elev[idx(key(a.q, a.r))] + 1.6 : 0, zb = WT ? terr.elev[idx(key(b.q, b.r))] + 1.6 : 0;
      for (let i = 1; i < n; i++) {
        const t = i / n, x = a.q + (b.q - a.q) * t + 1e-6 * sgn, z = a.r + (b.r - a.r) * t + 1e-6 * sgn, y = -x - z;
        let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
        const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
        if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
        const j = idx(key(rx, rz));
        if (j == null) return null;
        if (WT) {
          const lz = za + (zb - za) * t;
          if (terr.wallI[j] ? WT[j] <= lz : terr.elev[j] <= lz) continue;
          if (!terr.wallI[j]) return null;
        }
        if (terr.wallI[j] || terr.doorI[j]) { out.push(j); if (out.length > 4) return null; }   // past four walls: no line
      }
      return out;
    }
    function lineEntry(a, b) {
      const k = NK(a.q, a.r) * 16777216 + NK(b.q, b.r);
      let e = terr.lineC.get(k);
      if (e === undefined) { e = [lineBlockers(a, b, 1), lineBlockers(a, b, -1)]; if (terr.lineC.size > 3e6) terr.lineC.clear(); terr.lineC.set(k, e); }
      return e;
    }
    const lineOpen = L2 => L2 !== null && L2.every(i => !blocker(i));
    // line of sight: either of the two lines nudged off the hex edges is clear (a figure at a corner can be seen)
    function los(a, b) {
      if (!a || !b) return true;
      if (!terr) return !RIDGE || overCrest(a, b, 1.6, 1.6);
      const e = lineEntry(a, b);
      return lineOpen(e[0]) || lineOpen(e[1]);
    }
    // cover for a figure on hex h against fire from hex f (B407): a crate in the next hex toward the shooter
    // hides its legs and groin; a wall edge that only one of the two lines clears (a corner or a door frame)
    // hides more of it; on open ground, the side's cover setting while it stands still
    // cover for h against fire from f: { kind, i } with i the crate hex (for wear) or -1
    function coverOf(h, f, m) {
      if (terr && h && f && hexDist(h, f) > 1) {
        const k = NK(h.q, h.r) * 16777216 + NK(f.q, f.r);
        let c = terr.covC.get(k);
        if (c === undefined) {
          const a = lineHexes(h, f, 1)[0], b = lineHexes(h, f, -1)[0];
          c = [idx(key(a.q, a.r)), idx(key(b.q, b.r))].filter(i => i != null && terr.crateI[i]);
          if (terr.covC.size > 3e6) terr.covC.clear();
          terr.covC.set(k, c);
        }
        for (const i of c) if (!crateGone[i]) return { kind: terr.crates.get(key(terr.hx[i].q, terr.hx[i].r)) === "heavy" ? "barricade" : "crate", i };
        // a broken wall in front of a target whose head clears it but whose waist doesn't: a parapet (ruins)
        if (WT) {
          const hi = idx(key(h.q, h.r)), fi = idx(key(f.q, f.r)), n = hexDist(h, f);
          for (const x of [lineHexes(h, f, 1)[0], lineHexes(h, f, -1)[0]]) {
            const j = idx(key(x.q, x.r));
            if (j == null || !terr.wallI[j] || broken[j] || hi == null || fi == null) continue;
            const zw = terr.elev[hi] + 0.9, zf = terr.elev[fi] + 1.6, lz = zw + (zf - zw) / n;
            if (WT[j] > lz && los(h, f)) return { kind: "parapet", i: -1 };
          }
        }
        const e = lineEntry(h, f);
        if (lineOpen(e[0]) !== lineOpen(e[1])) return { kind: "corner", i: -1 };
      }
      // hull-down behind the ridge's crest: the head and shoulders clear it, the legs don't
      if (RIDGE && h && f && !terr && overCrest(f, h, 1.6, 1.6) && !overCrest(f, h, 1.6, 0.9)) return { kind: "crest", i: -1 };
      return { kind: m && cover[m.u.side] !== "none" && !m.moved ? cover[m.u.side] : "none", i: -1 };
    }
    const coverAt = (h, f, m) => coverOf(h, f, m).kind;
    // ---- height (B402-403, Pyramid 3/77 p. 4-5): effective SM is full SM upright, one less horizontal, two less
    // legless; effective height is the Size Modifier Table's longest dimension. Fliers ignore height
    const HFT = { "-4": 1.5, "-3": 2, "-2": 3, "-1": 4.5, "0": 6, "1": 9, "2": 15, "3": 21, "4": 30, "5": 45, "6": 60 };
    const heightOf = u => HFT[Math.max(-4, Math.min(6, (u.sm || 0) - (u.body === "horizontal" ? 1 : u.body === "legless" ? 2 : 0)))];
    // vertical difference in feet for att striking t with weapon w (positive: att is higher), less 3 feet for each
    // yard of the attacker's reach past the first (B403)
    // fighting across a level change (B402): over six feet between a man's feet and his foe's (more for big fighters,
    // less with a long weapon) and they can't reach each other
    function levelOK(ah, au, th, tu, w) {
      if (!ELEV || !ah || !th || au.body === "flying" || tu.body === "flying") return true;
      const dz = 3 * Math.abs(elevAt(ah) - elevAt(th));
      return dz - Math.max(heightOf(au), heightOf(tu)) - 3 * Math.max(0, ((w && w.reachMax) || 1) - 1) <= 0.01;
    }
    function vdiff(att, t, w) {
      if (!att || !t || !att.u || att.u.body === "flying" || t.u.body === "flying") return 0;
      const raw = heightOf(att.u) - heightOf(t.u) + 3 * (elevAt(att.h) - elevAt(t.h)), mit = 3 * Math.max(0, ((w && w.reachMax) || 1) - 1);
      return Math.sign(raw) * Math.max(0, Math.abs(raw) - mit);
    }
    const HEADL = new Set(["skull", "face", "eye", "neck"]), LEGL = new Set(["leg", "foot"]);
    // the hit-location modifier for a melee blow across a height difference, or null if the location is out of reach:
    // the higher fighter -2 at the legs and feet and +1 at the head and neck (up to 5 feet), can't reach the legs from
    // 4 feet, and from 6 feet reaches only the head, neck, arms and torso (Pyramid: a bigger fighter isn't limited to
    // the head); the lower fighter +2 at the legs, -2 at the head, can't reach the head from 5 feet and only the legs
    // and feet from 6
    function heightLoc(att, t, w, loc) {
      const D = vdiff(att, t, w), a = Math.abs(D);
      if (a <= 1 || loc === "random") return 0;
      const l = loc.replace("#c", "");
      if (D > 0) {
        if (a >= 6) return HEADL.has(l) || l === "arm" || l === "hand" || l === "torso" || l === "vitals" ? 0 : null;
        if (a >= 4 && LEGL.has(l)) return null;
        return LEGL.has(l) ? -2 : HEADL.has(l) ? 1 : 0;
      }
      if (a >= 6) return LEGL.has(l) ? 0 : null;
      if (a >= 5 && HEADL.has(l) && l !== "neck") return null;
      return LEGL.has(l) ? 2 : HEADL.has(l) ? -2 : 0;
    }
    // where a random blow lands when part of the target is out of reach
    function reachLoc(att, t, w, loc) {
      if (heightLoc(att, t, w, loc) !== null) return loc;
      return vdiff(att, t, w) > 0 ? "torso" : R() < 0.8 ? "leg" : "foot";
    }
    // the defence modifier: the lower fighter -1 at 3 feet, -2 at 4, -3 at 5 or more; the higher fighter as much better
    const heightDef = (t, att, w) => { const D = vdiff(att, t, w), a = Math.abs(D), k = a >= 5 ? 3 : a >= 4 ? 2 : a >= 3 ? 1 : 0; return D > 0 ? -k : k; };
    const darkAt = h => { if (LIGHT === "lit" || !h) return 0; if (LIGHT === "dark") return -7; const i = idx(key(h.q, h.r)); return i == null || !terr.light ? 0 : terr.light[i]; };
    // what darkness at t's hex costs viewer v to see or strike it: less Night Vision, nothing with Dark Vision, nor with
    // Infravision against a warm body (B47, B60, B71, B394)
    const darkPen = (v, t) => { const L = -darkAt(t.h); if (!L || v.u.flags.darkVision || (v.u.flags.infravision && !t.u.flags.machine)) return 0; return Math.max(0, L - (v.u.flags.nightVision || 0)); };
    // crates and barricades are semi-ablative (TS p. 29, B559): every 10 points of damage they stop wears 1 DR off
    const crateGone = terr ? new Uint8Array(terr.hx.length) : null, crateWear = terr ? new Float64Array(terr.hx.length) : null;
    function wearCover(i, stopped) {
      if (i < 0 || stopped < 10) return;
      crateWear[i] += Math.floor(stopped / 10);
      const base = COVER_DR[terr.crates.get(key(terr.hx[i].q, terr.hx[i].r)) === "heavy" ? "barricade" : "crate"];
      if (crateWear[i] >= base) {
        crateGone[i] = 1; pass[i] = 1; fieldCache.clear();
        tev.push([turnNow, key(terr.hx[i].q, terr.hx[i].r), "broken"]);
        L(`  the cover at ${terr.hx[i].q},${terr.hx[i].r} is shot to pieces`);
      }
    }
    const coverDRof = cv => cv.i >= 0 ? Math.max(0, COVER_DR[cv.kind] - crateWear[cv.i]) : COVER_DR[cv.kind];
    // what a model's own cover costs it to shoot out from (TS p. 28): nothing behind light cover, -2 from medium, -4 from heavy
    const ownCoverPen = (m, tH, bracedAimed) => bracedAimed || !m.h || !tH ? 0 : COVER_OWN[coverAt(m.h, tH, m)];
    // structures (B558): interior walls are plasteel partitions (DR 50, 60 HP a yard) and doors DR 30, 40 HP;
    // both are Homogeneous (B380), so bullets do little and blasts, plasma, melta and power weapons break through
    const STRUCT = { wall: { dr: 50, hp: 60 }, door: { dr: 30, hp: 40 } };
    const structOf = i => terr.wallI[i] && !broken[i] ? STRUCT.wall : terr.doorI[i] && !broken[i] ? STRUCT.door : null;
    const hpOf = i => shp[i] < 0 ? structOf(i).hp : shp[i];
    const hexName = i => (terr.wallI[i] ? "wall" : "door") + " at " + terr.hx[i].q + "," + terr.hx[i].r;
    function damageStructure(i, raw, dm, direct) {
      const st = structOf(i);
      if (!st) return 0;
      const div = direct ? (dm.div || 1) : 1;
      const inj = Math.floor(Math.max(0, raw - Math.floor(st.dr / div)) * woundMult(dm.type, "torso", { homogenous: 1 }, dm.ex));
      if (inj <= 0) return 0;
      shp[i] = hpOf(i) - inj;
      if (shp[i] <= 0) {
        broken[i] = 1; pass[i] = 1; closed[i] = 0; fieldCache.clear();
        tev.push([turnNow, key(terr.hx[i].q, terr.hx[i].r), "broken"]);
        L(`  the ${hexName(i)} is breached`);
      }
      return inj;
    }
    function setDoor(i, shut, who) {
      closed[i] = shut ? 1 : 0;
      tev.push([turnNow, key(terr.hx[i].q, terr.hx[i].r), shut ? "closed" : "open"]);
      L(`${who.id} ${shut ? "closes" : "opens"} a door (Ready)`);
      who.readied = true;
    }
    // walking distance to a goal round the walls, from a breadth-first field cached for the second
    // (typed arrays over the map's walkable hexes; F.get(key) keeps the Map-like use)
    // Crates and barricades (B352): an obstacle 3 or more SM smaller than a model is jumped as part of a Move for +1
    // movement point; anything bigger takes a whole turn and a DX roll (fall on a failure). A crate counts as SM -3 (a
    // SM 0 man hops it, a Gretchin climbs), a barricade as SM -2 (SM +1 and up hop it). Nobody ends a move on one.
    const OBST_SM = { light: -3, heavy: -2 };
    const obstClass = m => Math.max(0, Math.min(2, (m.u.sm | 0) + 1));   // 0: climbs both, 1: hops crates, 2: hops both
    const hops = (cls, i) => terr.crateI[i] && !crateGone[i] ? (cls - 1 >= OBST_SM[terr.crates.get(key(terr.hx[i].q, terr.hx[i].r))] + 3 ? 2 : 6) : 0;
    const fieldCache = new Map();
    // climbing (B349-350, B352): stepping up half a yard is free, a yard (a stair) costs a movement point more, a ledge
    // up to a yard and a half three more (hands and a knee up); higher can't be climbed in a fight. Dropping a yard is
    // free, two yards a point more (a jump down), and anything higher isn't risked. A big model (9 feet and up)
    // manages half as much again; fliers ignore it. cc: 0 man-sized, 1 big, 2 flier
    // Clinging (B43): up or down a wall at half Move, any height: 2 movement points a yard (cc 3)
    const climbCls = m => m.u.body === "flying" ? 2 : m.u.flags.clinging ? 3 : heightOf(m.u) >= 9 ? 1 : 0;
    function climb(i, j, cc = 0) {
      if (!EL || cc === 2 || i == null || j == null) return 0;
      const dz = EL[j] - EL[i], s = cc === 1 ? 1.5 : 1;
      if (cc === 3) return Math.abs(dz) <= 0.5 ? 0 : Math.round(2 * Math.abs(dz)) - 1;
      if (dz > 0) return dz <= 0.5 * s ? 0 : dz <= 1 * s + 0.01 ? 1 : dz <= 1.5 * s ? 3 : Infinity;
      return -dz <= 1 * s + 0.01 ? 0 : -dz <= 2 * s + 0.01 ? 1 : Infinity;
    }
    function field(goal, cls = 1, cc = 0) {
      const gk = key(goal.q, goal.r) + "|" + cls + "|" + cc;
      let F = fieldCache.get(gk);
      if (F) return F;
      const N = terr.hx.length, D = new Int16Array(N).fill(-1), g = terr.ids.get(key(goal.q, goal.r));
      // Dijkstra with small integer costs: 1 a hex, 2 to hop an obstacle, 6 to clamber over one
      const dist = new Float64Array(N).fill(Infinity), heap = [];
      const push = (i, d) => { if (d >= dist[i]) return; dist[i] = d; heap.push([d, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
      const cost = i => pass[i] ? 1 : hops(cls, i);
      if (g != null) push(g, 0);
      else for (const [dq, dr] of DIRS) { const i = terr.ids.get(key(goal.q + dq, goal.r + dr)); if (i != null && cost(i)) push(i, cost(i)); }
      while (heap.length) {
        const [d, c] = pop();
        if (d > dist[c]) continue;
        for (const x of terr.nb[c]) { const k = cost(x); if (!k) continue; const e = climb(x, c, cc); if (e !== Infinity) push(x, d + k + e); }
      }
      for (let i = 0; i < N; i++) if (dist[i] < Infinity) D[i] = Math.min(32000, dist[i]);
      F = { get: k => { const i = terr.ids.get(k); return i == null || D[i] < 0 ? undefined : D[i]; }, D };
      fieldCache.set(gk, F);
      return F;
    }
    // walking distance (symmetric): the field is built from b, so pass the foe's hex second
    const walk = (a, b) => !terr ? hexDist(a, b) : (field(b).get(key(a.q, a.r)) ?? 999);
    // deployment in a facility: each side fills its staging bay outward from its spawn point, a yard apart
    const spawnList = terr ? terr.spawn.map(sp => { const F = field(sp); return terr.hx.map((h, i) => [key(h.q, h.r), F.D[i]]).filter(x => x[1] >= 0 && !terr.doorI[idx(x[0])]).sort((x, y) => x[1] - y[1]).map(x => x[0]); }) : null;
    const spawnAt = [0, 0];
    function nextSpawn(side) {
      const L2 = spawnList[side];
      while (spawnAt[side] < L2.length) {
        const [q, r] = L2[spawnAt[side]++].split(",").map(Number), h = { q, r };
        if (!taken(key(q, r)) && !DIRS.some(([dq, dr]) => occ.has(key(q + dq, r + dr)))) return h;
      }
      return null;
    }
    // deployment: each side's units side by side in lines facing the enemy, models 2 yards apart,
    // ranks of ten with deeper ranks behind; each side's frontage is centred on the same axis
    const width = [0, 0];
    const sameSquad = (a, b) => a && b && a.squad && a.squad === b.squad && a.side === b.side;
    units.forEach((u, ui) => { width[u.side] += 2 * Math.min(u.count, 10) + (sameSquad(u, units[ui + 1]) ? 0 : 4); });
    const row0 = [-Math.floor((width[0] - 4) / 2), -Math.floor((width[1] - 4) / 2)];
    units.forEach((u, ui) => {
      u.idx = ui; u.models = []; u.routed = false; u.checked50 = false; u.checked25 = false;
      const perRank = Math.min(u.count, 10);
      for (let i = 0; i < u.count; i++) {
        const rank = Math.floor(i / perRank), file = i % perRank;
        const col = u.side === 0 ? -2 * rank : distance + 2 * rank;
        const row = row0[u.side] + 2 * file;
        const m = { u, id: `${u.name} #${i + 1}`, hp: u.HP, fp: u.fp, state: "ok", shock: 0, stunned: false, init: R(),
          facing: u.side === 0 ? 0 : 3, prone: false, moved: false, aimTurns: 0, aimTarget: null, lastTarget: null,
          ammo: u.ranged ? u.ranged.shots.mag : 0, mags: u.mags, reload: 0, jam: 0, gunBroken: false, conc: 0,
          sp: u.shield ? u.shield.sp : 0, spHit: -99, spCollapsed: false, shHP: u.cs && u.cs.hp != null ? u.cs.hp : 0, shState: "ok",
          parries: 0, retreated: false, blocked: false, attacked: false, aoa: false, aod: false, feint: null,
          reanim: 0, dmgDealt: 0, kills: 0, armsLost: 0, legsLost: 0, grips: [], holding: null, pinned: false,
          waiting: null, zone: null, grenadesLeft: u.grenades.map(g => g.count), grenadeReady: null,
          inHand: u.bothReady ? "both" : u.stance === "charge" ? "melee" : "gun",
          setUp: !!(u.ranged && u.ranged.needsSetup), setupT: 0, setupTo: null, idle: 0,
          wounds: {}, pain: 0, painSev: 0, halfMove: false, halfDodge: false, gawd: 0, crippled: {} };
        let h = terr ? nextSpawn(u.side) : fromOffset(col, row);
        if (!terr) while (occ.has(key(h.q, h.r))) h = fromOffset(h.q + (u.side ? 1 : -1), row);
        // a loader deploys beside its gun, on the side away from the enemy where there's room
        const gun = u.crew === "loader" && models.find(x => x.u.side === u.side && x.u.squad === u.squad && x.u.team === u.team && x.u.crew === "gunner" && x.h);
        if (gun) {
          const back = u.side === 0 ? -1 : 1, nbs = DIRS.map(([dq, dr]) => ({ q: gun.h.q + dq, r: gun.h.r + dr })).filter(n => !taken(key(n.q, n.r)) && (!terr || walkable(key(n.q, n.r))));
          nbs.sort((a, b) => back * (b.q - a.q));
          if (nbs.length) { if (terr && h) { spawnAt[u.side]--; } h = nbs[0]; u.besideGun = true; }
        }
        place(m, h);
        m.ix = models.length; m.trail = []; u.models.push(m); models.push(m);
      }
      if (!u.besideGun) row0[u.side] += 2 * perRank + (sameSquad(u, units[ui + 1]) ? 0 : 4);
    });
    // squads: one morale group per squad (a lone unit is its own group)
    const groups = [], gmap = new Map();
    for (const u of units) {
      const k = u.squad ? u.side + "|" + u.squad : "u" + u.idx;
      let g = gmap.get(k);
      if (!g) { g = { name: u.squad ? (u.squadName || u.squad) : u.name, units: [], models: [], count: 0, checked50: false, checked25: false, led: null, hadLeader: false, steeled: 0, executed: 0 }; gmap.set(k, g); groups.push(g); }
      g.units.push(u); g.models.push(...u.models); g.count += u.count; u.group = g;
    }
    for (const g of groups) g.hadLeader = g.units.some(u => u.leader);

    const active = m => m.state === "ok";
    const unitActive = u => !u.routed && u.models.some(active);
    const sideActive = s => units.some(u => u.side === s && unitActive(u));
    const foes = m => models.filter(x => x.state === "ok" && x.u.side !== m.u.side && !x.u.routed);
    // situational awareness (Tactical Shooting p. 11, 21, 27-28): in a facility each side knows only the foes some
    // friend has seen in the last few seconds (a shooter gives itself away to within a yard, B548); models that
    // ambush stay unseen until they attack or a foe comes within 5 yards. "omniscient" restores the old knowledge.
    const AWARE = opt.awareness ? opt.awareness === "limited" : !!terr;
    const seenAt = [new Map(), new Map()];
    const contact = [0, 0];   // the last second each side saw a foe
    const spot = (side, f) => { contact[side] = turn; if (!seenAt[side].has(f) && f.u.ambush && !f.revealed) L(`  ${f.id} is spotted`); seenAt[side].set(f, turn); f.lastSeenH = f.h; };
    // ---- stealth (B222, B47): a model with something to hide behind (cover from the viewer, lying down, a chameleon
    // hide, or 20+ yards) and that hasn't given itself away this second or the last is spotted only by winning a
    // Quick Contest: the viewing side's best Perception (or Observation) plus Acute Vision, the range penalty and the
    // target's SM, against the target's Stealth (DX-5 untrained), -5 if it moved more than half its Move, plus its
    // chameleon hide. Once seen it stays seen while anyone keeps it in sight; one roll a second per side
    const skillOf = (u, re) => Math.max(-Infinity, ...(u.stats.skills || []).filter(x => re.test(x.name) && x.level != null).map(x => x.level));
    const stealthOf = u => u._st ?? (u._st = Math.max(u.dx - 5, skillOf(u, /^Stealth/)));
    const spotOf = u => u._sp ?? (u._sp = Math.max(u.stats.per || u.stats.iq || 10, skillOf(u, /^Observation/)) + (u.flags.acuteVision || 0));
    function concealed(f, x) {
      if ((f.loudAt ?? -99) >= turn - 1) return false;
      return f.prone || !!f.u.flags.chameleon || darkAt(f.h) <= -3 || hexDist(x.h, f.h) >= 20 || coverAt(f.h, x.h, f) !== "none";
    }
    function trySpot(f) {
      const S = 1 - f.u.side, viewers = models.filter(x => x.state === "ok" && x.h && x.u.side === S && los(x.h, f.h));
      if (!viewers.length) return;
      const hidden = f.u.ambush && !f.revealed;
      if (hidden && !viewers.some(x => hexDist(x.h, f.h) <= 5)) return;   // an ambush shows only up close
      if ((seenAt[S].get(f) ?? -99) >= turn - 1) { spot(S, f); return; }   // still being watched
      const hid = viewers.filter(x => concealed(f, x));
      if (hid.length < viewers.length && !hidden) { spot(S, f); return; }   // someone has a clear look at it
      if ((f.spotRoll || [])[S] === turn) return;   // one roll a second per side
      (f.spotRoll ||= [])[S] = turn;
      let best = -Infinity;
      for (const x of viewers) best = Math.max(best, spotOf(x.u) - skillPen(x) + rangePenalty(Math.max(1, hexDist(x.h, f.h))) + f.u.sm - darkPen(x, f));
      const cham = f.u.flags.chameleon || 0, still = !(f.steps > 0);
      const st = stealthOf(f.u) - (f.steps > moveOf(f) / 2 ? 5 : 0) + (still ? cham : Math.floor(cham / 2)) - skillPen(f) + (darkAt(f.h) <= -3 ? 2 * (f.u.flags.chamShadow || 0) : 0);
      const a = check(best), b = check(st);
      if (a.ok && (!b.ok || a.margin > b.margin)) { L(`  ${f.id} is spotted (Per ${best} vs Stealth ${st})`); spot(S, f); }
    }
    function lookAround() {
      if (!AWARE) return;
      for (const f of models) if (f.state === "ok" && f.h) trySpot(f);
    }
    // what a side knows: foes in sight now, and for 5 seconds those last seen that haven't moved since; one that
    // slipped out of sight and moved is only a last known position (search goes there)
    const known = m => !AWARE ? foes(m) : foes(m).filter(f => { const t = seenAt[m.u.side].get(f) ?? -99; return t >= turn - 1 || (t >= turn - 5 && f.h && f.lastSeenH && f.h.q === f.lastSeenH.q && f.h.r === f.lastSeenH.r); });
    // an ambusher that attacks gives itself away; foes who hadn't seen it are partly surprised (B393): each must make
    // an IQ roll (+6 with Combat Reflexes) or lose its next turn
    // an attack gives the attacker away: a gunshot to every foe within earshot (40 yards, walls or not), anything
    // quieter (a blade, a throw, a splinter or shuriken weapon, a psychic power) only to foes that can see it
    const QUIET = /splinter|shuriken|needle|bow\b|crossbow|silenced|stake|shardcarbine|Kroot/i;
    function reveal(m, w) {
      if (!AWARE || !m.h) return;
      const loud = !!w && !w.thrown && w.usage !== "power" && !QUIET.test(w.name || "");
      m.loudAt = turn;
      const side = 1 - m.u.side, fresh = !seenAt[side].has(m), unseen = (seenAt[side].get(m) ?? -99) < turn - 1;
      m.revealed = true;
      if (!models.some(x => x.state === "ok" && x.h && x.u.side === side && (loud ? hexDist(x.h, m.h) <= 40 : los(x.h, m.h)))) return;
      seenAt[side].set(m, turn); m.lastSeenH = m.h; contact[side] = turn;
      if (fresh && m.u.ambush && !m.u.sprung) {
        m.u.sprung = true;
        L(`  ${m.u.name} spring their ambush`);
        for (const x of models) if (x.state === "ok" && x.h && x.u.side === side && !check((x.u.stats.iq || 10) + (x.u.flags.cr ? 6 : 0)).ok) x.surprised = true;
      } else if (unseen) {
        // any attack out of hiding is a surprise attack (B393): foes who see it or are within 10 yards roll IQ
        // (+6 with Combat Reflexes) or lose their next turn
        L(`  ${m.id} strikes from hiding`); m.hiddenStrike = turn;
        for (const x of models) if (x.state === "ok" && x.h && x.u.side === side && (los(x.h, m.h) || hexDist(x.h, m.h) <= 10) && !check((x.u.stats.iq || 10) + (x.u.flags.cr ? 6 : 0)).ok) x.surprised = true;
      }
    }
    // target speed (B373): below Move 10 the book drops it and lets the target's Dodge stand for its movement
    const spdOf = n => n > 10 ? n : 0;
    // how much of location loc the cover of kind k hides on t; a model firing a two-handed gun from behind it
    // exposes its arms and hands and half its torso (B407)
    function hideOf(k, loc, t, f, th = t && t.h) {
      let h = (HIDES[k] || {})[loc] || 0;
      if (h && f && t && th && ELEV && COVER_TOP[k]) {
        const up = elevAt(f) - elevAt(th);
        if (up > 0) {
          const lh = (LOC_H[loc.replace("#c", "")] ?? 1) * (t.prone ? 0.25 : t.kneel ? 0.65 : 1) * heightOf(t.u) / 6;
          if (lh + up / Math.max(1, hexDist(f, th)) >= COVER_TOP[k]) h = 0;
        }
      }
      if (!h || !t || !t.attacked || !t.u.ranged || t.u.ranged.pistol || !gunReady(t)) return h;
      return loc === "arm" || loc === "hand" ? 0 : loc === "torso" || loc === "vitals" ? Math.min(h, 0.5) : h;
    }
    // cover and posture against a shot at t from hex f (B407, B548, B551): an aimed shot at a location the cover
    // hides is -2 and meets the cover's DR; a random one strikes the cover whenever it lands there, at no penalty.
    // A kneeling or lying target is -2 to hit in the torso, groin, legs and feet, and to random fire.
    // keep: the planner's share of a hit's harm that isn't lost in the cover
    function shotFx(t, f, pb) {
      // a lying target is no harder to hit from above (B551): only a shooter at its level or lower is hampered
      const k = pb || !t.h || !f ? "none" : coverAt(t.h, f, t), low = ((t.prone && !(f && elevAt(f) - elevAt(t.h) >= 1)) || t.kneel) && !pb;
      let hid = 0;
      for (const [l, n] of RANDOM_LOCS) hid += n * hideOf(k, l, t, f) / 216;
      return {
        pen: loc => loc === "random" ? (low ? -2 : 0) : (low && LOW.has(loc) ? -2 : 0) - (hideOf(k, loc, t, f) > 0 ? 2 : 0),
        keep: loc => 1 - 0.7 * (loc === "random" ? hid : hideOf(k, loc, t, f)),
      };
    }
    // random hit location on t: a lying figure can't be hit in the groin, legs or feet, only the torso (B551)
    const hitLocOn = t => { const l = hitLocation(); return t && t.prone && (l === "groin" || l === "leg" || l === "foot") ? "torso" : l; };
    const inCover = (t, f) => coverAt(t.h, f, t) !== "none";
    const coverPen = (t, f) => covPenAt(t.h, f, t);
    // what m's cover at h takes off a shot from f: nothing once the shooter is high enough to see over it
    function covPenAt(h, f, m) {
      const k = coverAt(h, f, m);
      if (!COVER_PEN[k] || !ELEV || !COVER_TOP[k] || !f || elevAt(f) <= elevAt(h)) return COVER_PEN[k];
      return Object.keys(HIDES[k]).some(l => hideOf(k, l, m, f, h) > 0) ? COVER_PEN[k] : 0;
    }
    // drilled squads (TS p. 22-23, 37): a drilled shooter fires past a drilled friend at -2, not -4, and doesn't hit him by mistake
    const drilled = x => !!(x && x.u.ai.drilled);
    const linePen = (m, inter) => inter.reduce((a, x) => a + (drilled(m) && x.u.side === m.u.side && drilled(x) ? 2 : 4), 0);

    // skill penalty from shock (standard), or the larger of shock and pain plus wound effects (fractional)
    // (burning clothes are -2 DX, or -3 when all of them are alight, B434)
    const skillPen = m => (frac ? Math.max(m.shock, m.pain) + m.gawd : Math.min(m.shockCap || 4, m.shock)) + (m.onFire ? m.onFire + 1 : 0) + (m.painAff || 0);
    // below 1/3 HP (standard HP, B419), or halved by a Fractional Health wound or a crippled leg: half Move and
    // Dodge, rounding up
    const weak = m => !frac && m.hp < m.u.HP / 3 && !m.berserk;   // a berserker's wounds don't slow it (B124)
    // Shadow in the Warp (Tyranid traits): a psyker within the radius of an enemy bioform carrying it is at -3 to
    // psychic skill and to the Will roll against Perils of the Warp
    const psyker = u => u.powers.some(p => p.fp);
    const shadowed = m => !!m.h && psyker(m.u) && models.some(x => x.state === "ok" && x.h && x.u.side !== m.u.side && x.u.flags.shadow && hexDist(x.h, m.h) <= x.u.flags.shadow);
    // a model whose weapon arm is crippled fights with the other hand: -4 unless ambidextrous (B421, B417)
    const wl = (m, w) => w.level - (m.prone ? 0 : w.stStand || 0) - (w.usage === "power" && w.fp && shadowed(m) ? 3 : 0) - (m.weaponArmLost && !w.natural && w.usage !== "power" ? m.u.offPen : 0);
    // Fright Check (B360): Will plus Fearlessness, never better than 13
    // capped at 13 (B360) only for Shadow in the Warp; morale and the Fright Checks under fire aren't capped (user
    // direction: superhuman nerve should tell), so only a 17 or 18 breaks a Marine
    // Cowardice (B129) is a penalty to Fright Checks in physical danger: -4 at self-control 6, -3 at 9, -2 at 12, -1 at 15
    const frightLevel = (u, mod = 0, cap = 13) => Math.min(cap, u.will + (u.flags.fearless || 0) + (u.flags.cr ? 2 : 0) + 5 + mod - (u.flags.coward ? Math.ceil((18 - u.flags.coward) / 3) : 0));
    const fright = (u, mod = 0, cap = 13) => check(frightLevel(u, mod, cap));
    // a failed Fright Check rolls 3d + the margin of failure on the Fright Check Table (B360-361)
    // what happened to a model since its last turn, for keeping its head down and Fright Checks under fire (TS p. 21, 34)
    const ev = m => m.ev || (m.ev = {});
    function sawFall(t) {
      if (!t.h) return;
      for (const x of models) if (x !== t && x.state === "ok" && x.h && x.u.side === t.u.side && hexDist(x.h, t.h) <= 5 && los(x.h, t.h)) ev(x).allyDown = true;
    }
    // under fire (Tactical Shooting): a Fright Check after suppression, a near miss (by 2 or less), a blast within 2
    // yards per die, a wound or a friend going down nearby, at minus the volume of fire (the rapid-fire table as a
    // measure of it) unless in cover (p. 34); then anyone shot at while in cover rolls Will-2 or keeps its head down
    // this turn, unless it has Combat Reflexes (p. 21). Unfazeable and fearless-by-nature models ignore both.
    // fire and movement (TS p. 21): each shooting squad that advances pairs off; one of each pair covers while the
    // other bounds, swapping every two seconds. Zealots (Orks, Tyranids) and chargers just go.
    function assignRoles() {
      for (const u of units) {
        const ms = models.filter(x => x.u === u && x.state === "ok" && x.h && !u.routed);
        // peeling (TS p. 22-23): cautious line troops outgunned by what they can see fall back by pairs out of its
        // sight and hold there (shooting stance), covering each other
        if (!u.peel && u.ai.caution >= 1.1 && !((u.ai.zeal || 0) > 0) && u.ranged && ms.length >= 2 && turn > 3) {
          const ours = ms.reduce((a, x) => a + threatOf(x), 0);
          const seen = models.filter(f => f.u.side !== u.side && f.state === "ok" && f.h && ms.some(x => los(x.h, f.h)));
          const theirs = seen.reduce((a, f) => a + threatOf(f), 0);
          if (ours < 0.35 * theirs) { u.peel = turn; u.stanceWas = u.stance; u.stance = "shoot"; L(`${u.name} fall back by pairs (peeling)`); }
        } else if (u.peel && turn - u.peel > 20) { u.peel = false; u.stance = u.stanceWas || "advance"; }
        if ((u.stance !== "advance" && !u.peel) || (u.ai.zeal || 0) > 0 || !u.ranged || ms.length < 2) { for (const x of ms) x.role = null; continue; }
        const f0 = models.find(x => x.u.side !== u.side && x.state === "ok" && x.h);
        if (!f0) continue;
        ms.sort((a, b) => hexDist(a.h, f0.h) - hexDist(b.h, f0.h) || a.h.q - b.h.q || a.h.r - b.h.r);
        const phase = Math.floor(turn / 2) % 2;
        ms.forEach((x, i) => { x.role = (Math.floor(i / 2) + i + phase) % 2 ? "bound" : "cover"; });
      }
    }
    function underFire(m) {
      const e = m.ev; m.ev = null; m.headsDown = false;
      if (!e || !morale || m.u.flags.unfazeable || m.u.flags.noMorale || m.berserk) return false;
      const covered = e.shotAt && e.shotAt.h && m.h && inCover(m, e.shotAt.h);
      if (e.supp || e.near || e.blast || e.wounded || e.allyDown) {
        const why = e.blast ? "a blast" : e.allyDown ? "a comrade falls" : e.wounded ? "wounded" : e.supp ? "suppression fire" : "a near miss";
        const r = fright(m.u, (e.vol && !covered ? -rapidBonus(e.vol) : 0) + ledBonus(m), Infinity);
        if (!r.ok) { frightTable(m, -r.margin, why); if (m.state === "routed" || (m.stunned && m.stunT > 1)) commissar(m.u.group, [m]); if (m.stunned || m.state !== "ok" || m.u.routed) return true; }
      }
      if (e.horror != null) {
        const r = fright(m.u, -e.horror + ledBonus(m), Infinity);
        if (!r.ok) { frightTable(m, -r.margin, `${e.horrorWhy}, -${e.horror}`); if (m.stunned || m.state !== "ok" || m.u.routed) return true; }
      }
      if (covered && !m.u.flags.cr && !check(m.u.will - 2).ok) m.headsDown = true;
      return false;
    }
    // Leadership (B204): a leader who spends its turn giving orders gives everyone in its squad who can hear it +1
    // (+2 on a critical) to combat Fright Checks and to self-control rolls against Berserk or Cowardice, until its
    // next turn; within 20 yards, or the whole squad when a vox-caster is with it
    function ledBonus(m) {
      const g = m.u.group, o = g && g.led, st = (g && g.steeled) || 0;
      if (!o || o.until < turn || o.by.state !== "ok" || !o.by.h || !m.h) return st;
      return st + (g.models.some(x => x.u.vox && active(x)) || hexDist(m.h, o.by.h) <= 20 ? o.bonus : 0);
    }
    // squad cohesion: a squad member doesn't run more than 4 yards ahead of its nearest squad-mate toward the foe;
    // a flamer closes with the squad, not alone across open ground (chargers rush as they please)
    function cohesion(m, t) {
      const u = m.u;
      if (!u.group || u.stance === "charge" || !t.h) return 0;
      const ds = u.group.models.filter(x => x !== m && x.state === "ok" && x.h && !x.stunned).map(x => hexDist(x.h, t.h));
      return ds.length ? Math.min(...ds) - 4 : 0;
    }
    function giveOrders(m) {
      const g = m.u.group, l = skillOf(m.u, /^Leadership/), r = check(l - skillPen(m));
      m.attacked = false; m.aimTurns = 0;
      if (g.models.some(x => x !== m && x.u.leader && x.state === "ok" && g.led && g.led.by === x && g.led.until >= turn)) return;   // one leader per group
      if (r.ok) { g.led = { by: m, bonus: r.crit ? 2 : 1, until: turn + 1 }; L(`${m.id} bellows orders (Leadership: +${r.crit ? 2 : 1} to the squad's Fright Checks)`); }
      else L(`${m.id} shouts orders, but nobody's listening (Leadership failed)`);
    }
    // a Commissar keeps a squad in the fight (house rule: summary execution as an Intimidation display, B202). When
    // members break or freeze, a Commissar of the squad within 20 yards and in sight shoots the worst of them, then wins a Quick
    // Contest of Intimidation (+3 for the display, +1 if Callous) against the squad's best Will: the frozen snap out of
    // it, and the squad fights on at +2 to its Fright Checks for the rest of the battle
    function commissar(g, failed) {
      const c = g.models.find(x => x.u.commissar && active(x) && x.h && !x.stunned);
      if (!c || !failed.length || turn - (g.execAt ?? -99) < 20) return;   // one example lasts a while
      // the first to run, else the first frozen with fear: a Commissar doesn't wait for the rot to spread
      const v = failed.find(x => x !== c && x.state === "routed") || failed.find(x => x !== c && x.state === "ok" && x.stunned);
      if (!v) return;
      if (v.h && (hexDist(c.h, v.h) > 20 || !los(c.h, v.h))) return;
      L(`${c.id} executes ${v.id} for cowardice`);
      v.state = "dead"; if (v.h) { FX(["d", v.h.q, v.h.r, v.u.side, 1]); place(v, null); }
      g.executed++; g.execAt = turn;
      const it = skillOf(c.u, /^Intimidation/), w = Math.max(...g.models.filter(x => active(x) && x !== c).map(x => x.u.will), 0);
      if (contest(Math.max(it, c.u.will) + 3 + (c.u.flags.callous ? 1 : 0), w)) {
        g.steeled = 2;
        for (const x of g.models) if (x !== c && active(x) && x.stunned && x.stunRec !== "ht") { x.stunned = false; x.stunT = 0; }
        L(`  ${g.name} steels itself under the Commissar's eye`);
      } else L(`  ${g.name} is too shaken to care`);
    }
    function frightTable(m, by, why) {
      const r = roll3() + by, u = m.u;
      const stun = (sec, how, txt) => { m.stunned = true; m.stunT = sec; m.stunRec = how; L(`  ${m.id} ${txt || "freezes"} (${why}, Fright Check Table ${r})`); };
      if (r <= 5) stun(1, "auto");
      else if (r <= 7) stun(1, "will");
      else if (r <= 9) stun(1, "willmod");
      else if (r === 10) stun(d6(), "willmod");
      else if (r === 11) stun(d6() + d6(), "willmod");
      else if (r === 12) stun(d6(), "willmod", "retches, helpless");
      else if (r === 13) L(`  ${m.id} shakes it off with a new quirk (${why}, Fright Check Table 13)`);
      else if (r <= 15) { spendFP(m, d6()); stun(r === 14 ? d6() : d6() + d6(), "willmod", "loses fatigue and freezes"); }
      else if (r === 16) stun(d6(), "willmod");
      else if (r <= 20 || r >= 22) { incapacitate(m, `faints or collapses (${why}, Fright Check Table ${r})`); }
      else { m.state = "routed"; place(m, null); L(`  ${m.id} panics and runs (${why}, Fright Check Table 21)`); }
    }
    // stun recovery: physical stun on HT (B420); a fright stun as its table row says; other mental stun on IQ,
    // +6 with Combat Reflexes (B43, B364)
    function recoverStun(m) {
      if (m.stunT > 0) { m.stunT--; if (m.stunT > 0) return false; if (m.stunRec === "auto") return true; }
      const u = m.u, how = m.stunRec || "ht";
      const lvl = how === "will" ? u.will : how === "willmod" ? frightLevel(u, 0, Infinity) : how === "iq" ? (u.stats.iq || 10) + (u.flags.cr ? 6 : 0) : u.HT + (u.flags.hpt && !frac ? 3 : 0);
      return check(lvl).ok;
    }
    function spendFP(m, n) {
      if (m.u.flags.machine || !n) return;
      const before = m.fp; m.fp -= n;
      const over = Math.min(n, Math.max(0, -m.fp) - Math.max(0, -before));
      if (over > 0) { L(`  ${m.id} burns itself out (${over} HP)`); injure(m, m, over, "torso", "cr"); }
      if (m.state === "ok" && m.fp <= -m.u.fp) incapacitate(m, "collapses, utterly spent");
    }
    const tired = m => !m.u.flags.machine && m.fp < m.u.fp / 3;   // below 1/3 FP (B426): Move, Dodge and ST halved
    const dodgeOf = t => (t.halfDodge || weak(t) || tired(t) ? Math.ceil(t.u.dodge / 2) : t.u.dodge);
    // facing (B386-387): a mover faces the way it walks; after a move that used more than half its Move it may turn
    // only one hex-side at the end, so a model that runs past a foe can end with its side or back to it
    function faceTo(m, h) {
      if (!m.h || !h) return;
      const want = faceToward(m.h, h);
      if (!m.movedFar) { m.facing = want; return; }
      const d = ((want - m.facing) % 6 + 6) % 6;
      m.facing = d === 0 ? m.facing : d <= 3 ? (m.facing + 1) % 6 : (m.facing + 5) % 6;
    }
    // sprinting (B354): a Move straight on adds 20% (at least +1) from the second second; Enhanced Move (B52) instead
    // accelerates by Basic Move each second up to its top speed (x2 per level)
    function runMove(m) {
      const base = moveOf(m);
      if (m.legsLost || m.halfMove) return base;
      const k = m.runPrev || 0, L = m.u.flags.enhMove || 0;
      if (L > 0) return Math.min(Math.floor(base * Math.pow(2, L)), base * (k + 1));
      return k >= 1 ? Math.max(base + 1, Math.floor(base * 1.2)) : base;
    }
    const baseMove = m => m.u.ranged && m.u.ranged.needsSetup && !m.setUp ? m.u.movePacked : m.u.move;
    const moveOf = m => m.legsLost ? 1 : m.halfMove || weak(m) || tired(m) ? Math.max(1, Math.ceil(baseMove(m) / 2)) : baseMove(m);

    // ---- Revised Fractional Health (the user's house rule; after panoptesv.com's wound rules).
    const SEVN = ["", "Scratch", "Minor", "Moderate", "Major", "Critical", "Massive", "Gawdawful", "Destruction"];
    const FRAC = [0, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8];
    const COLS = lvl => lvl === 2 ? [1, 1.125, 1.375, 1.625] : [1, 1.25, 1.5, 1.75];
    const thr = (HP, lvl, col = 1) => Math.max(1, Math.round(HP * FRAC[lvl] * COLS(lvl)[col - 1]));
    function severity(inj, HP) { let s = 0; for (let l = 1; l <= 8; l++) if (inj >= thr(HP, l)) s = l; return s; }
    function boxesFor(inj, HP, lvl) { let n = 0; for (let c = 1; c <= 4; c++) if (inj >= thr(HP, lvl, c)) n = c; return Math.max(1, n); }
    // a model cut down by wounds (at 0 HP or below) is as horrible to see as one killed outright
    function incapacitate(t, why) { if (t.state === "ok") { sawFall(t); if (frac ? t.lastHitBy : t.hp <= 0) { horror(t.lastHitBy, t); downed(t.lastHitBy); } if (t.h) FX(["d", t.h.q, t.h.r, t.u.side, 0]); t.state = "out"; place(t, null); L(`  ${t.id} ${why}`); } }
    // crippling (B421): an arm or hand drops what it holds and can't hold anything; the weapon goes to the other
    // hand (off-hand -4), two-handed weapons can't be used, and a crippled shield arm loses the shield. A leg drops
    // the model, which can fight lying down and crawl
    function cripple(t, loc) {
      if (loc === "arm" || loc === "hand") {
        if (++t.armsLost >= 2) { incapacitate(t, "has lost the use of both arms"); return; }
        const weaponArm = !t.u.cs || R() < 0.5;
        if (weaponArm) t.weaponArmLost = true; else t.shState = "gone";
        const drop = weaponArm && !t.u.melee.natural && t.inHand !== "none";
        if (drop) t.inHand = "none";
        L(`  ${t.id}'s ${loc} is crippled${weaponArm ? (drop ? ": it drops its weapon" : "") : ": its shield hangs useless"}`);
      } else {
        t.legsLost++; t.prone = true; if (frac) t.halfDodge = true;
        L(`  ${t.id}'s ${loc} is crippled: falls and can only crawl`);
      }
    }
    function fracInjure(att, t, inj, loc, type) {
      att.dmgDealt += inj;
      const f = t.u.flags, HT = t.u.HT;
      const numb = f.homogenous || f.diffuse;   // Unliving counts as ordinary Injury Tolerance (user direction)
      let sev = severity(inj, t.u.HP);
      // a "major wound" critical counts at least as a Moderate wound; "double shock" doubles the shock (max 8)
      const cMajor = t.critMajor, cShock = t.critShock;
      t.critMajor = t.critShock = false;
      if (cMajor && sev) sev = Math.max(sev, 3);
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
      if (!numb && !f.hpt) t.shock = Math.min(cShock ? 8 : 7, Math.max(t.shock, sev * (cShock ? 2 : 1)));
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
      if (brain && sev === 5) {
        const r = check(HT - 3 + (f.htk || 0));
        if (!r.ok) { kill(att, t, "dies of a brain wound"); return; }
        if (f.htk && r.roll > HT - 3) { incapacitate(t, "collapses, apparently dead (Hard to Kill)"); return; }
      }
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
      if (att && att !== t) t.lastHitBy = att;
      if (inj <= 0 || t.state !== "ok") return;
      ev(t).wounded = true;
      if ((t.aimTurns || t.follow) && !check(t.u.will).ok) { t.aimTurns = 0; t.follow = null; L(`  ${t.id} loses its aim`); }
      // Berserk (B124): more than HP/4 of injury in one second calls for a self-control roll (less shock); failure
      // sends the model berserk
      if (t.injTurn !== turn) { t.injTurn = turn; t.injSum = 0; }
      t.injSum += inj;
      if (t.u.flags.berserk && !t.berserk && t.injSum > t.u.HP / 4 && roll3() > t.u.flags.berserk - skillPen(t)) goBerserk(t, "wounded");
      if (frac) return fracInjure(att, t, inj, loc, type);
      const HP = t.u.HP, before = t.hp, f = t.u.flags;
      if (/^(cut|imp|pi)/.test(type)) t.bleeds = true;   // bleeding wounds (B420)
      const nb = f.nobrain || f.homogenous || f.diffuse, nv = f.novitals || f.homogenous || f.diffuse;
      t.hp -= inj;
      att.dmgDealt += inj;
      // shock (B419): -1 per HP of injury this turn, or per full HP/10 with 20+ HP (fractions dropped over the
      // turn's total), at most -4; a critical hit can double it, to -8 (B556)
      const cShock = t.critShock, cMajor = t.critMajor;
      t.critShock = t.critMajor = false;
      const shock0 = t.shock;
      if (!f.hpt && !t.berserk) {   // a berserker ignores shock (B124)
        t.shockInj = (t.shockInj || 0) + inj * (cShock ? 2 : 1);
        if (cShock) t.shockCap = 8;
        t.shock = Math.min(t.shockCap || 4, HP >= 20 ? Math.floor(t.shockInj / Math.floor(HP / 10)) : t.shockInj);
      }
      // crippling (B420-421): injury over HP/2 to a limb, HP/3 to an extremity
      const lim = loc === "arm" || loc === "leg" ? HP / 2 : loc === "hand" || loc === "foot" ? HP / 3 : Infinity;
      const crippled = inj > lim;
      if (crippled) cripple(t, loc);
      else if (cShock && lim !== Infinity) {
        // critical row 8 to a limb: a "funny-bone" hit, crippled only for the moment (B556): the hand lets go, the leg folds
        if (loc === "arm" || loc === "hand") { if (!t.u.melee.natural && t.inHand !== "none") { t.inHand = "none"; L(`  ${t.id}'s ${loc} goes numb: it drops what it holds`); } }
        else { t.prone = true; L(`  ${t.id}'s ${loc} goes numb: it falls`); }
      }
      if (t.state !== "ok") return;
      // knockdown and stun (B420): an HT roll on a major wound (over HP/2, any crippling, a crit's "major wound"),
      // and on a head (skull, face, eye) or vitals hit that causes shock; the -10 / -5 for the head and vitals apply
      // only to major wounds, and not to those without a brain or vitals (B420); High Pain Threshold +3
      const major = inj > HP / 2 || crippled || cMajor;
      const headV = (loc === "skull" || loc === "eye" || loc === "face") ? !nb || loc === "face" : loc === "vitals" ? !nv : false;
      if (!t.berserk && (major || (headV && t.shock > shock0))) {   // immune to stun (B124)
        const mod = (f.hpt ? 3 : 0) + (major && headV ? (loc === "skull" || loc === "eye" ? -10 : -5) : 0);
        const r = check(t.u.HT + mod);
        if (!r.ok && (r.margin + (f.hts || 0) <= -5 || r.fumble)) { incapacitate(t, "is knocked out"); return; }   // Hard to Subdue (B59) helps only against the knockout
        if (!r.ok) {
          t.stunned = true; t.prone = true;
          // a knocked-down model drops what it holds (B420)
          const drop = (gunReady(t) && !!t.u.ranged && !t.u.ranged.natural) || (bladeReady(t) && !t.u.melee.natural && t.u.melee.name !== "Punch");
          if (drop) t.inHand = "none";
          L(`  ${t.id} is knocked down and stunned${drop ? ", dropping its weapon" : ""}`);
        }
      }
      if (t.hp <= -5 * HP) { kill(att, t, "destroyed"); return; }
      for (let k = 1; k <= 4; k++) {
        if (before > -k * HP && t.hp <= -k * HP && t.state === "ok") {
          // death check (B419): failure by 1-2 is a mortal wound (out of the fight, dying), worse is death; a success
          // that needed Hard to Kill leaves it collapsed, apparently dead (B58)
          const r = check(t.u.HT + (f.htk || 0) + (t.berserk ? 4 : 0));   // a berserker rolls at +4 (B124)
          if (!r.ok && r.margin >= -2) { if (f.reanimation) kill(att, t, "mortally wounded"); else incapacitate(t, "is mortally wounded"); return; }
          if (!r.ok) { kill(att, t, "killed"); return; }
          if (f.htk && r.roll > t.u.HT) { incapacitate(t, "collapses, apparently dead (Hard to Kill)"); return; }
        }
      }
    }
    // Horror (user direction): every comrade who sees a model cut down (in sight, within 20 yards, not blind in the
    // dark) makes a Fright Check at -1, -1 more for each one it has already seen this fight, -2 if it was up close in
    // melee, -2 if it was grisly (the body taken past -2 x HP), -3 if the killer struck out of hiding
    // Berserk (B124): all-out attack on the nearest foe, immune to stun and shock, +4 to stay conscious and alive;
    // each foe it downs gives a self-control roll to snap out, after which its wounds tell at once (an HT roll to stay
    // conscious below 0 HP)
    function goBerserk(m, why) { if (m.berserk || m.state !== "ok") return; m.berserk = true; m.stunned = false; m.shock = 0; L(`  ${m.id} goes berserk (${why})`); }
    function downed(att) {
      if (!att || !att.berserk || att.state !== "ok") return;
      if (roll3() > att.u.flags.berserk) return;
      att.berserk = false; L(`  ${att.id} snaps out of its berserk rage`);
      if (!frac && att.hp <= 0 && !check(att.u.HT - Math.floor(-att.hp / att.u.HP)).ok) incapacitate(att, "collapses as its wounds tell");
    }
    function horror(att, t) {
      if (!t.h || !morale) return;
      const close = !!(att && att.h && att !== t && hexDist(att.h, t.h) <= 1);
      const gore = !frac && t.hp <= -2 * t.u.HP, hidden = !!(att && att.hiddenStrike === turn);
      for (const x of models) {
        if (x === t || x.state !== "ok" || !x.h || x.u.side !== t.u.side || hexDist(x.h, t.h) > 20 || !los(x.h, t.h) || darkPen(x, t) >= 5) continue;
        // a bigger killer is more frightening: relative SM counts against the smaller (Pyramid 3/77 p. 8)
        const pen = 1 + (x.horror || 0) + (close ? 2 : 0) + (gore ? 2 : 0) + (hidden ? 3 : 0) + (att && att.u ? Math.max(0, att.u.sm - x.u.sm) : 0);
        const e = ev(x); e.horror = Math.max(e.horror ?? -1, pen); e.horrorWhy = close ? "a comrade torn apart" : "a comrade killed";
        x.horror = (x.horror || 0) + 1;
      }
    }
    function kill(att, t, how) {
      if (t.state !== "ok") return;
      sawFall(t); horror(att, t); downed(att);
      if (t.h) FX(["d", t.h.q, t.h.r, t.u.side, 1]);
      place(t, null);
      if (t.u.flags.reanimation && how !== "destroyed" && t.hp > -5 * t.u.HP) {
        t.state = "down"; t.reanim = 3; L(`  ${t.id} falls; reanimation protocols engage`);
      } else { t.state = "dead"; L(`  ${t.id} is ${how}`); }
      att.kills++;
    }

    // Critical Hit Table (B556), rolled on 3d after a critical success
    const CRIT = { 3: "triple damage", 4: "DR at half", 5: "double damage", 6: "maximum damage", 7: "a major wound", 8: "double shock",
      12: "the victim drops its weapon", 13: "a major wound", 14: "a major wound", 15: "maximum damage", 16: "double damage", 17: "DR at half", 18: "triple damage" };
    const HEAD = new Set(["skull", "face", "eye"]);
    const HEADCRIT = { 3: "maximum damage, no DR", 4: "DR halved, a major wound", 5: "DR halved, a major wound", 6: "strikes the eye", 7: "strikes the eye",
      8: "knocked off balance", 14: "the victim drops its weapon", 15: "maximum damage", 16: "double damage", 17: "DR halved", 18: "triple damage" };
    // ---- damage to a model at a location. Returns injury.
    let hitFrom = null;   // where a hit comes from when it isn't the attacker's hex (a blast's fragments), for cover
    function applyHit(att, w, t, loc, ranged, halfD, dmgOverride, rawOverride, crit) {
      const area = loc === "area";
      if (area) loc = "torso";
      const chink = loc.endsWith("#c");
      if (chink) loc = loc.slice(0, -2);
      const dmg = dmgOverride || w.dmg;
      let raw = rawOverride != null ? rawOverride : rollDamage(dmg);
      const maxD = () => Math.floor((dmg.n * 6 + dmg.add) * dmg.mult);
      const dropAll = () => { if (!t.u.bothReady && ((gunReady(t) && t.u.ranged && !t.u.ranged.natural) || (bladeReady(t) && !t.u.melee.natural && t.u.melee.name !== "Punch"))) { t.inHand = "none"; L(`  ${t.id} drops its weapon`); } };
      let noDR = false, halfDR = false;
      if (crit && HEAD.has(loc)) {
        // Critical Head Blow Table (B556) for skull, face and eye
        L(`  critical head blow: ${HEADCRIT[crit] || "normal damage"}`);
        if (crit === 3) { raw = maxD(); noDR = true; }
        else if (crit === 6 || crit === 7) { if (loc !== "eye" && arcTo(t, att) !== "rear") { loc = "eye"; L(`  the blow finds an eye`); } else { halfDR = true; t.critMajor = true; } }
        else if (crit === 4 || crit === 5) { halfDR = true; t.critMajor = true; }
        else if (crit === 8) t.doNothing = true;
        else if (crit === 14) dropAll();
        else if (crit === 15) raw = maxD();
        else if (crit === 16) raw *= 2;
        else if (crit === 17) halfDR = true;
        else if (crit === 18) raw *= 3;
      } else if (crit) {
        L(`  critical hit: ${CRIT[crit] || "normal damage"}`);
        if (crit === 3 || crit === 18) raw *= 3;
        else if (crit === 5 || crit === 16) raw *= 2;
        else if (crit === 6 || crit === 15) raw = maxD();
        else if (crit === 4 || crit === 17) halfDR = true;
        else if (crit === 12) dropAll();
        if (crit === 7 || crit === 13 || crit === 14) t.critMajor = true;
        if (crit === 8) t.critShock = true;
      }
      if (halfD) raw = Math.floor(raw / 2);
      let fraw = w.follow ? rollDamage(w.follow) : 0;   // splash and fragments pass follow: null
      const basic = raw;
      const sh = t.u.shield;
      if (sh && t.sp > 0 && (ranged || !sh.ranged_only) && (!sh.arc || !att || !att.h || !t.h || shieldCovers(t, att))) {
        t.spHit = turn;
        if (raw <= t.sp) { t.sp -= raw; if (fraw) t.sp = Math.max(0, t.sp - fraw); if (t.h) FX(["f", t.ix, raw, t.h.q, t.h.r]); L(`  shield holds (${t.sp} SP left)`); return 0; }
        raw -= t.sp; t.sp = 0; t.spCollapsed = true; L(`  shield collapses`);   // what gets through still carries its follow-up
      }
      // a flame or burning blast of 3+ basic damage sets clothing alight, 10+ all of it (B433-434); tight beams don't
      if (dmg.type === "burn" && (dmg.ex || w.cone) && raw >= 3 && (t.u.burns || w.warpflame) && t.state === "ok") ignite(att, t, raw >= 10 ? 2 : 1, w.ablaze, w.warpflame);
      let cv = null;
      if (ranged && t.h && !area) {
        const c = coverOf(t.h, hitFrom || (att && att.h), t), hd = hideOf(c.kind, loc, t, hitFrom || (att && att.h));
        if (hd >= 1 || (hd > 0 && d6() >= 4)) cv = c;
      }
      const coverDR = cv ? coverDRof(cv) : 0;
      if (cv && cv.i >= 0 && coverDR > 0) wearCover(cv.i, Math.min(raw, coverDR));
      const aDR = area ? areaDR(t.u) : null;
      const armDR = (area ? aDR.arm : Math.floor(drAt(t.u.arm.dr, loc === "vitals" ? (t.u.arm.dr.vitals != null ? "vitals" : "torso") : loc) / (chink ? 2 : 1))) + coverDR;
      if (chink) L(`  strikes a chink in the armour`);
      const natDR = area ? aDR.nat : natDRat(t.u, loc);
      const div = dmg.div;
      const eff = dr => dr <= 0 ? 0 : div === Infinity ? 0 : Math.floor(dr / div);   // round down, minimum 0 (B378)
      let DR = eff(armDR + natDR);
      if (noDR) DR = 0; else if (halfDR) DR = Math.ceil(DR / 2);
      let pen = raw - DR;
      if (pen <= 0 && !chink && armDR > 0 && t.u.arm.wp && roll3() <= t.u.arm.wp) {
        DR = eff(Math.floor(armDR / 2) + natDR); pen = raw - DR;
        if (pen > 0) L(`  finds a weak point`);
      }
      // knockback (B378) from crushing and cutting blows
      if ((dmg.type === "cr" || (dmg.type === "cut" && pen <= 0 && !ranged)) && !dmg.ex && !w.slam && t.state === "ok" && !t.grips.length) knockback(att, t, basic);
      // Hurting yourself (B379): a punch or kick at DR 3+ does its striker 1 crushing per 5 points of basic damage,
      // up to that DR, against the striker's own DR there
      if (!ranged && att && att !== t && (w.name === "Punch" || w.name === "Kick") && armDR + natDR >= 3 && basic >= 5) {
        const back = Math.min(Math.floor(basic / 5), armDR + natDR), cr = parseDamage("1d cr");
        L(`  ${att.id} hurts its ${w.name === "Kick" ? "foot" : "hand"} on the armour`);
        applyHit(t, { dmg: cr, follow: null, slam: true }, att, w.name === "Kick" ? "foot" : "hand", false, false, cr, back);
      }
      // blunt trauma: armour that stops a hit still passes some of its force (see bluntOf)
      // (only what gets past cover can bruise through the armour beneath, B379)
      if (pen <= 0 && armDR - coverDR > 0 && raw > coverDR) {
        const bt = bluntOf(raw - coverDR, dmg.type, t.u.arm.flexible, dmg.ex);
        if (bt > 0) { L(`  ${raw} dmg to ${loc} stopped by ${t.u.arm.flexible ? "flexible" : "rigid"} armour: ${bt} blunt trauma`); injure(att, t, bt, loc, "cr"); return bt; }
      }
      if (pen <= 0) {
        if (t.h) FX(["h", t.ix, 0, loc, t.h.q, t.h.r]); L(`  ${raw} dmg to ${loc} ${coverDR > 0 && raw <= coverDR ? `stopped by the cover (DR ${coverDR})` : "fails to penetrate"} DR ${armDR + natDR}${div !== 1 ? "/" + (div === Infinity ? "∞" : div) : ""}`);
        // an explosive follow-up still goes off against the armour that stopped its carrier (B381)
        if (w.follow && w.follow.ex && fraw > armDR + natDR && t.state === "ok") {
          const fi = Math.max(1, Math.floor((fraw - armDR - natDR) * woundMult(w.follow.type, loc, t.u.flags, true)));
          L(`  the shell bursts on the armour: ${fi} injury`); injure(att, t, fi, loc, w.follow.type); return fi;
        }
        return 0;
      }
      const flags = t.u.flags, poison = flags.poison;
      let inj = dmg.type === "tox" && poison === "immune" ? 0 : Math.max(1, Math.floor(pen * woundMult(dmg.type, loc, flags, dmg.ex)));
      if (dmg.type === "tox" && poison === "resist") inj = Math.floor(inj / 2);
      const red = flags.dmgRed > 1 ? flags.dmgRed : 1;
      if (red > 1 && inj > 0) inj = Math.max(1, Math.floor(inj / red));
      // Diffuse (B380): at most 1 HP from impaling or piercing and 2 from anything else, but not from areas and cones
      if (flags.diffuse && !frac && !dmg.ex && !w.cone && inj > 0) inj = Math.min(inj, /^(imp|pi)/.test(dmg.type) ? 1 : 2);
      // a limb or extremity takes no more injury than it needs to be crippled, over all the hits it takes (B420);
      // left or right is a coin toss
      const lim0 = loc === "arm" || loc === "leg" ? Math.floor(t.u.HP / 2) + 1 : loc === "hand" || loc === "foot" ? Math.floor(t.u.HP / 3) + 1 : Infinity;
      const side = lim0 === Infinity || frac ? null : loc + (R() < 0.5 ? "L" : "R"), took = side ? ((t.limbInj ||= {})[side] || 0) : 0;
      const cap = frac ? Infinity : Math.max(0, lim0 - took);
      inj = Math.min(inj, cap);
      if (side) { t.limbInj[side] = took + inj; if (t.limbInj[loc + "L"] >= lim0 && t.limbInj[loc + "R"] >= lim0) (t.limbFull ||= {})[loc] = true; }
      let finj = 0;
      if (w.follow && fraw > 0) {
        const ft = w.follow.type;
        if (!(ft === "tox" && poison === "immune")) {
          // an explosive follow-up that gets inside goes off within the body: triple damage, no DR (B414)
          finj = Math.max(1, Math.floor(fraw * (w.follow.ex ? 3 : 1) * woundMult(ft, ["arm", "leg", "hand", "foot"].includes(loc) ? loc : "torso", flags, w.follow.ex)));
          if (ft === "tox" && poison === "resist") finj = Math.floor(finj / 2);
          if (red > 1 && finj > 0) finj = Math.max(1, Math.floor(finj / red));
          finj = Math.max(0, Math.min(finj, cap - inj));
        }
      }
      if (side && finj) t.limbInj[side] += finj;
      L(`  ${raw} dmg to ${area ? "the body (large area)" : loc} (DR ${armDR + natDR}${div !== 1 ? "/" + (div === Infinity ? "∞" : div) : ""}): ${inj} injury${finj ? ` + ${finj} ${w.follow.ex ? "from the internal explosion" : "follow-up"}` : ""}${frac ? "" : `; ${t.id} at ${t.hp - inj - finj}/${t.u.HP} HP`}`);
      if (t.h) FX(["h", t.ix, inj + finj, loc, t.h.q, t.h.r]);
      injure(att, t, inj + finj, loc, dmg.type);
      // agony (B428): HT (+3 with High Pain Threshold) at the weapon's penalty, or Severe Pain for the rest of the
      // fight (-4, -2 with High Pain Threshold); a critical failure stuns too. Machines feel nothing
      if (w.agony != null && inj > 0 && t.state === "ok" && !t.u.flags.machine) {
        const r = check(t.u.HT + w.agony + (t.u.flags.hpt ? 3 : 0) + Math.max(0, t.u.sm));   // SM adds to resisting afflictions (Pyramid 3/77 p. 8)
        if (!r.ok) {
          t.painAff = Math.max(t.painAff || 0, t.u.flags.hpt ? 2 : 4);
          L(`  ${t.id} is wracked with agony (-${t.painAff})`);
          if (r.fumble) { t.stunned = true; t.stunRec = "ht"; }
        }
      }
      return inj + finj;
    }
    // Catching fire (B434): part of the clothing burns for 1d-4 a second, all of it for 1d-1, as large-area injury
    const FIRE = [null, parseDamage("1d-4 burn"), parseDamage("1d-1 burn")];
    // a weapon's own "per turn while ablaze" damage (promethium clinging) replaces the clothing's
    // warpflame burns by the warp's will, not on fuel: it catches on sealed plate and bare carapace alike, and its
    // burning reaches the flesh inside whatever the armour
    function ignite(att, t, lv, ablaze, warp) {
      if ((t.onFire || 0) >= lv && !(ablaze && !t.fireDmg) && !(warp && !t.fireWarp)) return;
      const a = areaDR(t.u), dm = ablaze || FIRE[lv];
      if (!warp && a.arm + a.nat >= Math.floor((dm.n * 6 + dm.add) * dm.mult)) return;   // flames that can't get through its gear are no bother
      t.onFire = Math.max(t.onFire || 0, lv); t.fireBy = att; t.fireWork = 0; if (ablaze) t.fireDmg = ablaze; if (warp) t.fireWarp = true;
      L(warp ? `  ${t.id} is wreathed in warpflame` : `  ${t.id}'s ${lv === 2 ? "clothes go up in flames" : "clothing catches fire"}`);
    }
    function burn(m) {
      const dm = m.fireDmg || FIRE[m.onFire];
      L(`${m.id} is on fire`);
      if (m.fireWarp) { const inj = rollDamage(dm); L(`  warpflame sears through for ${inj}`); injure(m.fireBy || m, m, inj, "torso", "burn"); return; }
      applyHit(m.fireBy || m, { dmg: dm, follow: null }, m, "area", false, false, dm, rollDamage(dm));
    }
    // putting it out (B434): a Ready and a DX roll; with all its clothes alight it must roll on the ground, three
    // Readies to an attempt
    function beatFlames(m) {
      if (m.onFire === 2) {
        m.prone = true; m.kneel = false; m.fireWork = (m.fireWork || 0) + 1;
        if (m.fireWork < 3) { L(`${m.id} rolls on the ground to smother the flames`); return; }
        m.fireWork = 0;
      }
      if (check(m.u.dx - skillPen(m)).ok) { m.onFire = 0; m.fireDmg = null; m.fireWarp = false; L(`${m.id} beats out the flames`); }
      else L(`${m.id} fails to put out the flames`);
    }
    // Damage to Shields (B484): a defence that only succeeded thanks to the shield's DB means the attack struck the
    // shield. Its field (if any) takes it first, then the shield's DR; penetrating damage costs HP as a Homogeneous
    // object, and damage beyond DR + HP/4 punches through to the bearer (the shield arm on 1-2, else where aimed)
    function shieldHit(att, w, t, loc, ranged) {
      const cs = t.u.cs;
      if (!cs || t.shState === "gone" || t.state !== "ok" || !w || !w.dmg) return;
      let raw = rollDamage(w.dmg);
      const sh = t.u.shield;
      L(`  the ${ranged ? "shot" : "blow"} strikes ${t.id}'s ${cs.name}`);
      if (sh && t.sp > 0 && (ranged || !sh.ranged_only) && (!sh.arc || shieldCovers(t, att))) {
        t.spHit = turn;
        if (raw <= t.sp) { t.sp -= raw; if (t.h) FX(["f", t.ix, raw, t.h.q, t.h.r]); L(`  its field holds (${t.sp} SP left)`); return; }
        raw -= t.sp; t.sp = 0; t.spCollapsed = true; L(`  its field collapses`);
      }
      if (cs.dr == null) return;
      const div = w.dmg.div, dr = div === Infinity ? 0 : Math.floor(cs.dr / div);
      if (raw <= dr) {
        if (t.h) FX(["h", t.ix, 0, "shield", t.h.q, t.h.r]);
        L(`  ${raw} dmg fails to penetrate the shield (DR ${cs.dr})`);
        if (!ranged && /^(cr|cut)/.test(w.dmg.type)) knockback(att, t, raw);   // full knockback (B484)
        return;
      }
      const loss = Math.max(1, Math.floor((raw - dr) * (HOMOG[w.dmg.type] ?? 1))), before = t.shHP;
      t.shHP -= loss;
      L(`  the shield takes ${loss} (${t.shHP}/${cs.hp} HP)`);
      const hp = cs.hp;
      if (t.shHP <= -10 * hp) { t.shState = "gone"; L(`  ${t.id}'s ${cs.name} is torn away`); }
      else if (t.shHP <= -5 * hp) { if (t.shState !== "destroyed") L(`  ${t.id}'s ${cs.name} is smashed`); t.shState = "destroyed"; }
      else {
        for (let k = 1; k <= 4; k++) if (before > -k * hp && t.shHP <= -k * hp && t.shState !== "destroyed" && !check(cs.ht).ok) { t.shState = "destroyed"; L(`  ${t.id}'s ${cs.name} is smashed`); }
        if (t.shHP <= 0 && t.shState === "ok" && !check(cs.ht).ok) { t.shState = "disabled"; L(`  ${t.id}'s ${cs.name} gives out`); }
      }
      const cover = div === Infinity ? 0 : Math.floor((cs.dr + hp / 4) / div);
      if (raw > cover) { L(`  and punches through`); applyHit(att, w, t, d6() <= 2 ? "arm" : loc === "random" ? hitLocation() : loc, ranged, false, null, raw - cover); }
    }
    function knockback(att, t, basic) {
      const st = Math.max(3, t.u.st + (t.u.arm.lifting || 0));
      const kb = Math.floor(basic / Math.max(1, st - 2));
      if (kb < 1 || !t.h) return;
      const dir = faceToward(att.h, t.h);
      let h = t.h;
      for (let i = 0; i < kb; i++) { const n = { q: h.q + DIRS[dir][0], r: h.r + DIRS[dir][1] }; if (taken(key(n.q, n.r))) break; h = n; }
      if (h !== t.h) place(t, h);
      const sk = n => ((t.u.stats.skills || []).find(x => x.name === n && x.level != null) || {}).level || 0;
      if (!check(Math.max(t.u.dx, sk("Acrobatics"), sk("Judo")) + (t.u.flags.pbal ? 4 : 0) - (kb - 1)).ok) { t.prone = true; L(`  ${t.id} is knocked back ${kb} yd and falls`); }
      else L(`  ${t.id} is knocked back ${kb} yd`);
    }

    // ---- area effects (B413-414)
    const noDiv = dm => dm.div === 1 ? dm : { ...dm, div: 1, key: (dm.key || "") + "nd" };
    // struck: the model the explosive hit directly (it takes the full blast already, and every fragment roll hits it)
    function explosion(att, w, at, raw, struck) {
      FX(["b", at.q, at.r, Math.min(6, 1 + Math.floor(Math.log2(Math.max(2, raw)) / 2) * (w.explosion || 1))]);
      // a blast also batters the walls and doors beside it (B558; no armour divisor)
      if (terr) for (const [dq, dr] of [[0, 0], ...DIRS]) { const i = idx(key(at.q + dq, at.r + dr)); if (i != null && structOf(i)) damageStructure(i, Math.floor(raw / 3), w.dmg, false); }
      const lv = w.explosion || 1;
      const zone = 2 * (w.dmg.n || 1) * lv;   // the blast zone for Fright Checks: 2 yards per die (TS p. 34)
      // collateral reaches 2 yards per die of damage (B414); Explosion level L (B107) widens it: distance counts as yards / L
      const reach = 2 * (w.dmg.n || 1) * (w.dmg.mult || 1) * lv;
      hitFrom = at;
      for (const x of models) {
        if (x.state !== "ok" || !x.h || !los(at, x.h)) continue;
        let d = hexDist(x.h, at);
        if (d <= zone && x !== att) ev(x).blast = true;
        if (d < 1 || d > reach) continue;
        // diving for cover (B377): anyone who sees a grenade land close enough to fear it may dive
        const fearR = Math.max(3, w.dmg.frag ? Math.ceil(5 * w.dmg.frag.n / 2) : 0);
        if (w.thrown && d <= fearR && x !== att && blastBites(x, w, d, lv) && dive(x, at)) {
          if (!x.h || !los(at, x.h)) { L(`  ${x.id} is out of the blast`); continue; }
          d = hexDist(x.h, at);
          if (d < 1) d = 1;
        }
        const splash = Math.floor(raw / (3 * Math.max(1, d / lv)));
        // only the model struck directly faces the armour divisor; the blast around it has none, and it lands as
        // large-area injury (B400, B414)
        if (splash >= 1) { L(`  blast catches ${x.id} (${d} yd)`); applyHit(att, { dmg: noDiv(w.dmg), follow: null }, x, "area", true, false, noDiv(w.dmg), splash); }
      }
      // fragments (B414): everyone within 5 yards per die is attacked at 15, modified only by range, posture and SM;
      // one more fragment for every 3 points of success; the model struck directly is hit by at least one. Random
      // locations, and a location behind cover from the blast hits the cover
      const fr = w.dmg.frag;
      if (fr) {
        const fd = parseDamage(`${fr.n}d ${fr.type}`);
        for (const x of models) {
          if (x.state !== "ok" || !x.h || !los(at, x.h)) continue;
          const d = hexDist(x.h, at);
          if (d > 5 * fr.n) continue;
          // bodies between the blast and the target shield it like any figure in a line of fire: -4 each (B389);
          // kneeling and lying figures don't block, as for shots
          const screen = x === struck ? 0 : 4 * between(at, x.h, null).filter(y => y !== x).length;
          const r = check(15 + rangePenalty(Math.max(1, d)) + x.u.sm - (x.prone || x.kneel ? 2 : 0) - screen);
          let n = r.ok ? 1 + Math.floor(Math.max(0, r.margin) / 3) : 0;
          if (x === struck) n = Math.max(1, n);
          for (let k = 0; k < n && x.state === "ok"; k++) { L(`  fragment hits ${x.id}`); applyHit(att, { dmg: fd, follow: null }, x, hitLocOn(x), true, false, fd); }
        }
      }
      hitFrom = null;
    }
    // worth diving from? Only if the blast at that distance, at its worst, or a fragment could get through the
    // model's armour: a Marine doesn't throw itself flat in a melee for a grenade that can't scratch its plate
    function blastBites(x, w, d, lv) {
      const dm = w.dmg, mx = ((dm.n || 1) * 6 + (dm.add || 0)) * (dm.mult || 1), a = areaDR(x.u);
      if (mx / (3 * Math.max(1, d / lv)) > a.arm + a.nat) return true;
      const fr = dm.frag;
      if (fr && d <= 5 * fr.n) { const weak = Math.min(...["neck", "face", "arm", "leg"].map(l => drAt(x.u.arm.dr, l) + drAt(x.u.nat, l))); if (fr.n * 6 + (fr.add || 0) > weak) return true; }
      return false;
    }
    // an explosive that comes down on an occupied hex: the one there may dive clear (B377, taking a third) or
    // takes the full blast, as large-area injury with no armour divisor
    function landOn(m, w, at, raw) {
      const x = occ.get(key(at.q, at.r));
      if (!x || x.state !== "ok") return;
      const nd = noDiv(w.dmg), full = !dive(x, at), dmg = full ? raw : Math.floor(raw / 3);
      if (!full && x.h && !los(at, x.h)) { L(`  ${x.id} gets clear of it`); return; }
      if (dmg >= 1) applyHit(m, { dmg: nd, follow: null }, x, "area", true, false, nd, dmg);
    }

    // ---- expected injury of weapon w against unit tu at a location (cached per battle)
    const EXP = new Map();
    // blunt trauma (B379, extended by user direction): flexible armour that stops a hit passes 1 HP per full 5 points
    // of crushing damage, or per full 10 of impaling or piercing; a cutting blow that doesn't get through lands as a
    // crushing one; rigid armour passes crushing force too, at half the rate (1 per full 10). Burning, toxic, corrosive
    // and explosive damage pass nothing this way.
    function bluntOf(raw, type, flexible, ex) {
      if (ex) return 0;
      const crushy = /^cr/.test(type) || /^cut/.test(type);
      if (flexible) return Math.floor(raw / (crushy ? 5 : /^(imp|pi)/.test(type) ? 10 : Infinity));
      return crushy ? Math.floor(raw / 10) : 0;
    }
    function expInj(w, tu, loc, dmgOverride) {
      const chink = loc.endsWith("#c");
      if (chink) loc = loc.slice(0, -2);
      const d = dmgOverride || w.dmg;
      const k = w.id + "|" + tu.idx + "|" + loc + (chink ? "#c" : "") + "|" + (dmgOverride ? dmgOverride.key || "r" : "");
      if (EXP.has(k)) return EXP.get(k);
      const aDR = loc === "area" ? areaDR(tu) : null;
      if (aDR) loc = "torso";
      const armDR = aDR ? aDR.arm : Math.floor(drAt(tu.arm.dr, loc === "vitals" ? (tu.arm.dr.vitals != null ? "vitals" : "torso") : loc) / (chink ? 2 : 1));
      const natDR = aDR ? aDR.nat : natDRat(tu, loc);
      const effDR = d.div === Infinity ? 0 : Math.floor((armDR + natDR) / d.div);
      const red = tu.flags.dmgRed > 1 ? tu.flags.dmgRed : 1;
      const cap = loc === "arm" || loc === "leg" ? tu.HP / 2 + 1 : loc === "hand" || loc === "foot" ? tu.HP / 3 + 1 : Infinity;
      const avgF = w.follow ? (w.follow.n * 3.5 + w.follow.add) * w.follow.mult * (w.follow.ex ? 3 : 1) : 0;   // an explosive follow-up bursts inside: x3 (B414)
      let tot = 0;
      // Weak Points: a hit that fails to penetrate finds a gap on 3d <= rating and faces half the armour's DR
      const wpP = !chink && armDR > 0 && tu.arm.wp ? P3[Math.min(18, tu.arm.wp)] : 0;
      const halfDR = d.div === Infinity ? 0 : Math.floor((Math.floor(armDR / 2) + natDR) / d.div);
      const injOf = pen => Math.min(cap, ((d.type === "tox" && tu.flags.poison === "immune" ? 0 : pen * woundMult(d.type, loc, tu.flags, d.ex)) + avgF) / red);
      for (let i = 0; i < 20; i++) {
        const raw = rollDamage(d), pen = raw - effDR;
        if (pen > 0) tot += injOf(pen);
        else {
          const bt = armDR > 0 ? Math.min(cap, bluntOf(raw, d.type, tu.arm.flexible, d.ex) / red) : 0;
          if (wpP && raw - halfDR > 0) tot += wpP * injOf(raw - halfDR) + (1 - wpP) * bt;
          else tot += bt;
        }
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
    function planAttack(m, w, t, lvl, melee, dmgOverride, fo = {}) {
      // a regenerating shield that's up soaks the blow before armour: a called shot is wasted on it, so aim at the
      // body (or not at all) until it's down, and count only what the shield won't absorb
      const sh = t.u.shield, shUp = !!(sh && t.sp > 0 && (!melee || !sh.ranged_only) && !w.malediction && (!sh.arc || shieldCovers(t, m)));
      const locs = w.cone ? ["area"] : shUp ? [aimsShots(m) ? "torso" : "random"] : aimsShots(m) || (melee && t.pinned) ? [...Object.keys(AIM), ...Object.keys(AIM).filter(l => l !== "eye" && drAt(t.u.arm.dr, l === "vitals" ? "torso" : l) > 0).map(l => l + "#c")] : ["random"];
      const def0 = melee ? bestDefence(t, m, true, w) : w.malediction ? (w.fp && t.u.flags.blank ? 99 : w.resist === "HT" ? t.u.HT : t.u.will) - 2 : rangedDefence(t, m);
      let best = { loc: "torso", da: 0, score: 0, lvl };
      for (const loc of locs) {
        const pen = (fo.fx ? fo.fx.pen(loc.replace("#c", "")) : 0) + (loc === "random" || loc === "area" ? 0 : loc.endsWith("#c") ? Math.min(0, Math.min(AIM[loc.slice(0, -2)], CHINK(loc.slice(0, -2))) + (w.chink || 0)) : loc === "eye" && drAt(t.u.arm.dr, "eye") > 0 ? -10 : AIM[loc]);   // an eye behind a helmet lens or visor is -10 (B399-400)
        const pointed = /^pi/.test(w.dmg.type) || w.dmg.type === "imp" || (w.dmg.type === "burn" && !w.dmg.ex && !w.cone);
        if ((loc === "eye" || loc === "vitals" || loc.endsWith("#c")) && !pointed) continue;   // B398, B400
        const hmod = melee ? heightLoc(m, t, w, loc) : 0;
        if (hmod === null) continue;   // out of reach across the height difference (B402-403)
        if (t.limbFull && t.limbFull[loc.replace("#c", "")]) continue;   // both already crippled: nothing more to take there
        const e = (loc === "area" ? expInj(w, t.u, "area", dmgOverride) : loc === "random" ? expInjRandom(w, t.u, dmgOverride) : expInj(w, t.u, loc, dmgOverride)) * (fo.fx ? fo.fx.keep(loc.replace("#c", "")) : 1);
        // a rending weapon (success by N+ or a critical) does its rending damage on a good enough roll: count it, or
        // the planner sees only the ordinary line and goes hunting for chinks it can't reach the margin on
        const rendL = melee && w.rend && !dmgOverride ? (loc === "random" ? expInjRandom(w, t.u, w.rend) : expInj(w, t.u, loc, w.rend)) : 0;
        if (e <= 0 && rendL <= 0) continue;
        // expected injury per attack at effective skill x: the share of hits good enough to rend does the rending damage
        const perHit = x => { if (!rendL) return e * P3[cl(Math.min(18, x))]; const all = P3[cl(Math.min(18, x))], r = Math.min(all, Math.max(P3[cl(x - w.rendBy)], 4 / 216)); return e * (all - r) + rendL * r; };
        // Deceptive Shot (house rule): a shooter may trade 2 skill for each -1 to the target's Dodge, as Deceptive
        // Attack (B369) does in melee; not for area attacks or Malediction
        const maxDa = fo.noDa ? 0 : melee || !(w.malediction || w.cone || w.dmg.ex || w.blast) ? 6 : 0;
        for (let da = 0; da <= maxDa; da++) {
          const eff = lvl + pen + hmod - 2 * da;
          if (eff < 3 || (da > 0 && eff < 10)) break;
          const pDef = def0 == null ? 0 : P3[Math.max(0, Math.min(18, def0 - da))];
          const hits = melee ? P3[Math.min(18, eff)] : burstHits(eff, w.cone ? 1 : (w.rof || 1), w, fo.aim || 0, !!fo.braced);
          // a critical hit can't be defended (B381): against a foe who dodges nearly everything, a burst's few
          // critical rounds are most of what gets through (fishing for crits)
          const crits = melee ? critP(eff) : w.cone || w.malediction ? 0 : burstCrits(eff, w.rof || 1, w, fo.aim || 0, !!fo.braced);
          let score = (1 - pDef) * (melee ? perHit(eff) : e * hits) + pDef * (melee ? (perHit(eff) / Math.max(1e-9, P3[Math.min(18, eff)])) * crits : e * crits);
          if (melee && NEAR_TORSO.has(loc)) score += (1 - pDef) * (P3[Math.min(18, eff + 1)] - P3[Math.min(18, eff)]) * expInj(w, t.u, "torso", dmgOverride);
          if (shUp) {
            // the share of this attack's raw damage the shield absorbs is lost; stripping it is worth a quarter
            const dm = dmgOverride || w.dmg, raw = Math.max(1, (dm.n * 3.5 + dm.add) * (dm.mult || 1) * hits);
            const soak = Math.min(1, t.sp / raw);
            score *= (1 - soak) + soak * 0.25;
          }
          if (score > best.score) best = { loc, da, score, lvl: eff };
        }
        // Telegraphic Attack (MA113): +4 to hit, +2 to the foe's defences; not with Deceptive Attack
        if (melee && !fo.noTele && lvl + pen + hmod + 4 >= 3) {
          const eff = lvl + pen + hmod + 4, pDef = def0 == null ? 0 : P3[cl(def0 + 2)];
          let score = (1 - pDef) * perHit(eff);
          if (shUp) { const dm = dmgOverride || w.dmg, raw = Math.max(1, (dm.n * 3.5 + dm.add) * (dm.mult || 1)); const soak = Math.min(1, t.sp / raw); score *= (1 - soak) + soak * 0.25; }
          if (score > best.score) best = { loc, da: 0, score, lvl: eff, tele: true };
        }
      }
      return best;
    }

    // ---- defence
    function arcTo(t, att) { return att && att.h && t.h ? arcOf(t.h, t.facing, att.h) : "front"; }
    // a free hex for a retreat: beside the defender and no closer to the attacker (back or to the side)
    function retreatHex(t, att) {
      if (!t.h || !att || !att.h) return null;
      const d0 = hexDist(t.h, att.h);
      let best = null, bd = -1;
      for (const [dq, dr] of DIRS) {
        const h = { q: t.h.q + dq, r: t.h.r + dr };
        if (taken(key(h.q, h.r))) continue;
        const dd = hexDist(h, att.h);
        if (dd >= d0 && dd > bd) { bd = dd; best = h; }
      }
      if (best) best.side = bd === d0;   // a step to the side is a Sideslip: the retreat bonus -1 (MA124)
      return best;
    }
    // retreat (B377): melee only, once per turn, not while held, stunned, kneeling or after a Move and Attack; the bonus
    // then holds against every attack by the same foe until the defender's next turn
    const canRetreat = (t, att) => t.retreatFrom === att || (!t.retreated && !t.stunned && !t.stunRecovering && !t.mna && !t.grips.length && !(t.kneel && !t.prone) && !!retreatHex(t, att));
    // shields cover the front and the shield (left) side (B287)
    const shieldCovers = (t, att) => { const a = arcTo(t, att); return a === "front" || (a === "side" && sideOf(t.h, t.facing, att.h) === "L"); };
    const shieldDB = t => t.u.cs && t.shState === "ok" && !t.blockLost ? t.u.cs.db : 0;
    const canParry = t => t.u.parry != null && bladeReady(t) && !(t.u.melee.unbalanced && t.attacked && !t.defAtk) && t.armsLost < 2 && (!t.armsLost || t.u.melee.oneHanded !== false) && !t.mna;
    // the defences open to t against att: kind is melee, ranged, pb (a gun fired at point-blank) or thrown.
    // With Damage to Shields in play (B484) a shield's DB counts against every attack from its arcs (B287)
    function defOpts(t, att, kind, aw) {
      if (t.state !== "ok" || t.aoa || t.pinned) return null;
      const arc = arcTo(t, att);
      if (arc === "rear") return null;
      // a slam by something three or more SM bigger (Pyramid 3/77 p. 9): diving aside is the only defence, and no
      // shield helps
      const huge = !!(aw && aw.huge);
      const db = !huge && att && att.h && t.h && shieldCovers(t, att) ? shieldDB(t) : 0;
      const mod = (arc === "side" ? -2 : 0) - (t.stunned || t.stunRecovering ? 4 : 0) - (t.prone ? 3 : 0) - (t.kneel && !t.prone ? 2 : 0) - (t.offBalance ? 2 : 0) + db - (att && att.h ? darkPen(t, att) : 0) + (kind === "melee" && att && att.u ? heightDef(t, att, aw) : 0);
      const aod = how => t.aod && t.aodDef === how ? 2 : 0;
      const rt = kind === "melee" && canRetreat(t, att);
      const slip = rt && t.retreatFrom !== att && (retreatHex(t, att) || {}).side ? 1 : 0;
      // Committed Attack (MA99): -2 to every defence, no retreat, no parry with the weapon that struck; Defensive
      // Attack (MA100): +1 to a parry or block; Beats (MA100) lower one defence against everyone
      const beat = t.beat && t.beat.until >= turn ? t.beat : null;
      const ca = t.committed ? 2 : 0, dA = t.defAtk ? 1 : 0;
      // Limiting Multiple Dodges (MA122, an option): -1 per dodge after the first this turn, not for masters
      const dLim = LIMDODGE && !t.u.flags.master ? t.dodges || 0 : 0;
      // Tactical Dodging (TS p. 17, an option): a model can dodge gunfire only from the one shooter it chose to watch
      if (TDODGE && kind === "ranged" && t.evading && t.evading !== att) return null;
      const opts = TDODGE && kind === "pb" && t.evading && t.evading !== att ? [] : [{ how: "dodge", v: dodgeOf(t) + (rt ? 3 - slip : 0) + aod("dodge") - ca - dLim, retreat: rt && !ca }];
      if ((kind === "melee" || kind === "pb") && canParry(t) && !t.committed && !huge) {
        const w = t.u.melee, bare = w.name === "Punch", master = !!t.u.flags.master;
        const step = w.fencing && master ? 1 : w.fencing || master ? 2 : 4;   // B376
        // held: the reach penalty of close combat lowers the parry too (half, as Parry is half skill, MA117)
        let v = (t.knifeOut && t.u.knife ? t.u.knifeParry : t.u.parry) + (rt ? (w.fencing || (bare && t.u.judo) ? 3 : 1) - slip : 0) - step * t.parries - Math.ceil(closePen(t, t.knifeOut && t.u.knife ? t.u.knife : t.u.melee) / 2) + aod("parry") + dA - (beat && beat.how === "parry" ? beat.n : 0);
        // bare hands against a weapon: -3 unless it's a thrust or the defender knows Judo or Karate (B377)
        if (bare && aw && !aw.natural && aw.name !== "Punch" && !/^imp|^pi/.test((aw.dmg || {}).type || "") && !t.u.judo) v -= 3;
        // a gun held close in (TS p. 25): -2 to parry a handgun, -1 a long arm
        if (kind === "pb" && aw) v -= aw.pistol ? 2 : 1;
        // nobody parries a weapon (or a body) heavier than their Basic Lift, twice that two-handed (B376)
        // Weapon Power (Pyramid 3/77 p. 8): an armed blow counts as the heavier of the weapon and the wielder's own fist
        if (!(aw && attackWeight(att, aw) > t.u.bl * (w.oneHanded === false ? 2 : 1))) opts.push({ how: "parry", v, retreat: rt });
      }
      // no blocking bullets or beams (B375); thrown weapons and melee blows can be blocked
      if ((kind === "melee" || kind === "thrown") && db && !t.blocked && !huge) opts.push({ how: "block", v: t.u.block + (rt ? 1 - slip : 0) + aod("block") - ca + dA - (beat && beat.how === "block" ? beat.n : 0), retreat: rt && !ca });
      return { arc, mod, db, opts };
    }
    function bestDefence(t, att, melee, aw) {
      const d = defOpts(t, att, melee ? "melee" : "ranged", aw);
      return d && d.opts.length ? Math.max(...d.opts.map(o => o.v)) + d.mod : null;
    }
    function rangedDefence(t, att) { return bestDefence(t, att, false); }
    // resolve a defence roll; a melee (or point-blank) defence returns { how, margin } or null, a ranged one the margin or null.
    // t.shieldStruck: the defence only succeeded thanks to the shield's DB, so the attack struck the shield (B484)
    function defend(t, att, melee, da, feint, aw) {
      t.shieldStruck = false; t.fever = false;
      if (t.state !== "ok" || t.aoa || t.pinned) return null;
      // an active defence spoils any Aim and follow-up aim (B364, TS p. 14): an aiming model lets a shot come when
      // dodging is a long shot or the shot can barely hurt it, and keeps its aim; the more its aim is worth (the
      // Accuracy of the gun it's aiming: a lascannon's 14 against a boltgun's 2), the longer the odds it accepts
      if ((t.aimTurns || t.follow) && melee !== true && melee !== "pb" && melee !== "thrown") {
        const dd = rangedDefence(t, att), rw = aw || (att && att.u.ranged);
        const harm = rw ? expInjRandom(rw, t.u) : 0, acc = t.u.ranged && t.aimTurns ? t.u.ranged.acc || 0 : 0;
        if (dd == null || P3[cl(dd)] < Math.min(0.75, 0.3 + 0.03 * Math.max(0, acc - 2)) || harm < 0.15 * remOf(t)) return null;
      }
      // choosing when to dodge: every dodge costs the next one this turn -1 (MA122), so an attack that can't really
      // hurt is let through to keep the dodge for one that can; so is one the dodge has almost no chance against.
      // Parries and blocks are spent the same way in melee only against a blow that matters
      {
        const rw = aw || (att && (melee === true ? att.u.melee : att.u.ranged));
        const harm = rw && rw.dmg ? expInjRandom(rw, t.u) : Infinity;
        if (harm < Math.max(0.5, 0.06 * remOf(t))) return null;
        if (melee !== true && melee !== "pb" && LIMDODGE && (t.dodges || 0) > 0) {
          const dd = rangedDefence(t, att);
          if (dd != null && P3[cl(dd)] < 0.1 && harm < 0.5 * remOf(t)) return null;
        }
      }
      if (t.aimTurns || t.follow) { t.aimTurns = 0; t.follow = null; }
      if (t.grips.length) t.retreated = true;   // held: no retreat
      // a shield at 0 HP or less may give out whenever it's used (HT roll, B483)
      if (t.u.cs && t.u.cs.hp != null && t.shHP <= 0 && t.shState === "ok" && !check(t.u.cs.ht).ok) { t.shState = "disabled"; L(`  ${t.id}'s ${t.u.cs.name} gives out`); }
      const kind = melee === true ? "melee" : melee || "ranged";
      const D = defOpts(t, att, kind, aw);
      if (!D) return null;
      // an Evaluate bonus against this attacker cancels its feint and Deceptive Attack penalties (MA100), never below 0
      const evC = t.evaluate && t.evaluate.t === att && feint > 0 ? Math.min(t.evaluate.n, Math.max(0, da) + Math.max(0, feint)) : 0;
      const mod = D.mod - da - (feint || 0) + evC;
      const aod = how => t.aod && t.aodDef === how ? 2 : 0;
      if (kind === "ranged") {
        let d = dodgeOf(t) + mod + aod("dodge") + feverish(t, att, false, dodgeOf(t) + mod);
        // Dodge and Drop (B377): a shooter not in melee drops prone for +3
        let drop = false;
        if (!t.prone && t.u.stance === "shoot" && (t.u.ranged || t.u.powers.some(p => !p.melee)) && !engaged(t)) { d += 3; drop = true; }
        if (LIMDODGE && !t.u.flags.master) d -= t.dodges || 0;
        t.dodges = (t.dodges || 0) + 1;
        const r = check(d);
        if (drop || r.fumble) t.prone = true;
        if (r.ok && r.margin < D.db) t.shieldStruck = true;
        t.defDB = D.db;
        return r.ok ? Math.max(0, r.margin) : null;
      }
      const opts = D.opts;
      if (!opts.length) return null;
      const o = opts.reduce((a, b) => b.v > a.v ? b : a);
      if (o.how === "parry") t.parries++;
      if (o.how === "dodge") t.dodges = (t.dodges || 0) + 1;
      // Riposte (MA124): a strong parrier facing one foe trades part of its Parry for a lower defence on its next blow
      let rip = 0;
      if (o.how === "parry" && kind === "melee" && trained(t, t.u.melee)) {
        const v = o.v + mod, alone = models.filter(x => x.state === "ok" && x.h && x.u.side === att.u.side && hexDist(x.h, t.h) <= x.u.melee.reachMax).length <= 1;
        if (alone && v >= 14) { rip = Math.min(4, v - 12, Math.max(0, t.u.parry - 8)); o.v -= rip; }
      }
      if (o.how === "block") t.blocked = true;
      // retreating is a real step back or aside, once per turn (B377)
      if (o.retreat && t.retreatFrom !== att) { t.retreated = true; t.retreatFrom = att; const h = retreatHex(t, att); if (h) place(t, h); }
      const r = check(o.v + mod + feverish(t, att, true, o.v + mod));
      if (r.ok && r.margin < D.db) t.shieldStruck = true;
      t.defDB = D.db;
      if (rip && r.ok) { t.riposte = { t: att, n: rip }; L(`  ${t.id} parries into a riposte (-${rip})`); }
      if (r.ok && t.h) FX(["v", t.ix, o.how, t.h.q, t.h.r]);
      // criticals on defence (B381-382): a critical success sends the attacker to the Critical Miss Table;
      // a botched Dodge falls down, a botched Block loses the shield until a Ready, a botched parry rolls the table
      if (r.crit && aw && att.state === "ok") { L(`  critical defence by ${t.id}`); critMiss(att, aw); }
      else if (r.fumble) {
        if (t.fever && t.state === "ok") { L(`  ${t.id} strains a limb (extra effort)`); injure(t, t, 1, o.how === "dodge" ? "leg" : "arm", "cr"); }
        if (o.how === "dodge") { t.prone = true; L(`  ${t.id} botches its dodge and falls`); }
        else if (o.how === "block") { t.blockLost = true; L(`  ${t.id} botches its block and loses its grip on the shield`); }
        else { L(`  ${t.id} botches its parry`); critMiss(t, t.u.melee); }
      }
      return r.ok ? { how: o.how, margin: Math.max(0, r.margin) } : null;
    }

    // ---- threat: expected harm a foe can do to m this turn (for All-Out Attack / Defense choices)
    function threatTo(m) {
      let t = 0;
      for (const f of foes(m)) {
        if (!f.h || !m.h) continue;
        const d = hexDist(f.h, m.h);
        const w = d <= f.u.melee.reachMax ? f.u.melee : f.u.ranged && d <= f.u.ranged.range.max && los(f.h, m.h) ? f.u.ranged : null;
        if (w) t += expInj(w, m.u, "torso");
      }
      return t;
    }
    const engaged = m => m.h && foes(m).some(f => f.h && hexDist(f.h, m.h) <= Math.max(f.u.melee.reachMax, m.u.melee.reachMax));

    // ---- movement: greedy steps through free hexes toward a goal hex
    // Moving through friends (B368): a model may pass through an ally's hex for +1 movement point but not stop there.
    // A hop over a friend or an obstacle lands on the free hex beyond it.
    // a friend, or a foe 3+ SM smaller that a big model simply steps over for a movement point (Pyramid 3/77 p. 6)
    const friendAt = (m, k) => { const x = occ.get(k); return x && x !== m && (x.u.side === m.u.side || (x.state === "ok" && m.u.sm - x.u.sm >= 3)) ? x : null; };
    function hopTo(m, over, target, cost, ctx) {
      if (cost >= 6) {
        // too big to hop: the whole turn and a DX roll to clamber over (B352)
        if (!check(m.u.dx - skillPen(m)).ok) { m.prone = true; L(`${m.id} tries to climb the obstacle and falls`); return false; }
        L(`${m.id} clambers over the obstacle`);
      }
      place(m, target);
      return true;
    }
    // a mover under grenade threat (a known foe with a grenade left and within a move of throwing range) spreads out:
    // among the steps that gain as much ground, it takes the one with fewest squad-mates beside it (user direction:
    // charging mobs too)
    const nearFriends = (m, h) => { let c = 0; for (const [dq, dr] of DIRS) { const x = occ.get(key(h.q + dq, h.r + dr)); if (x && x !== m && x.u.side === m.u.side && x.state === "ok") c++; } return c; };
    // a stalker: a stealthy model (Stealth 14+ or a chameleon hide) that fights hand to hand and hasn't been seen
    const stalker = m => AWARE && m.h && (stealthOf(m.u) >= 14 || !!m.u.flags.chameleon || !!m.u.flags.chamShadow)
      && (!m.u.ranged || m.u.stance === "charge" || m.u.ai.melee > m.u.ai.ranged) && (seenAt[1 - m.u.side].get(m) ?? -99) < turn - 1;
    const grenadeThreat = m => known(m).some(f => f.h && f.state === "ok" && f.u.grenades.length && f.grenadesLeft.some(n => n > 0) && hexDist(f.h, m.h) <= Math.max(...f.u.grenades.map(g => g.range.max)) + moveOf(m));
    function stepToward(m, goal, steps, stopAt = 1) {
      let moved = 0;
      const spread = grenadeThreat(m), stalk = stalker(m);
      // a stalker near its prey moves at half Move (no -5 to Stealth) and keeps to steps the foe can't see, then the dark
      if (stalk && hexDist(m.h, goal) <= 20) steps = Math.min(steps, Math.max(1, Math.floor(moveOf(m) / 2)));
      const foesK = stalk ? known(m).filter(f => f.h) : [];
      const sc = n => (stalk ? (foesK.some(f => los(f.h, n)) ? 10 : 0) + (darkAt(n) <= -3 ? 0 : 1) : 0) + (spread ? nearFriends(m, n) : 0);
      const better = (n, d, bd, best) => d < bd || (d === bd && best && (sc(n) < sc(best) || (sc(n) === sc(best) && R() < 0.3)));
      if (terr) {
        // round the walls: each step goes to a free neighbour nearer the goal on foot, hopping crates it's big
        // enough to jump and friends in the way
        const cls = obstClass(m), cc = climbCls(m), F = field(goal, cls, cc);
        while (moved < steps) {
          const cur = F.get(key(m.h.q, m.h.r)) ?? 999, ci = idx(key(m.h.q, m.h.r));
          if (cur <= stopAt && los(m.h, goal)) break;
          let best = null, bd = cur, via = null, bc = 1;
          for (const [dq, dr] of DIRS) {
            const n = { q: m.h.q + dq, r: m.h.r + dr }, nk = key(n.q, n.r), i = idx(nk);
            if (i == null) continue;
            const e = climb(ci, i, cc);
            if (e === Infinity) continue;
            if (!occ.has(nk) && pass[i]) {
              if (e && moved + 1 + e > steps) continue;
              const d = F.get(nk) ?? 999;
              if (d < bd || (d === bd && best && !via && better(n, d, bd, best))) { bd = d; best = n; via = null; bc = 1 + e; }
              continue;
            }
            // a friend or an obstacle in the way: hop it to the free hex straight beyond
            const fr = friendAt(m, nk), ob = !fr && hops(cls, i);
            if (!fr && !ob) continue;
            const cost = fr ? 2 : ob;
            const b = { q: n.q + dq, r: n.r + dr }, bk = key(b.q, b.r), bi = idx(bk);
            if (bi == null || occ.has(bk) || !pass[bi] || closed[bi] || climb(i, bi, cc) === Infinity) continue;
            if (cost >= 6 ? moved > 0 : moved + cost + 1 > steps) continue;
            const d = F.get(bk) ?? 999;
            if (d < bd) { bd = d; best = b; via = n; bc = cost + 1; }
          }
          if (!best) break;
          const bi = idx(key(best.q, best.r));
          if (closed[bi]) { if (!moved) setDoor(bi, false, m); break; }   // opening a door is a Ready (B382)
          if (via) { if (!hopTo(m, via, best, bc - 1)) { moved = steps; break; } moved += bc >= 7 ? steps : bc; }
          else { place(m, best); moved += bc; }
          if (afterStep(m)) break;
        }
        if (moved) { m.moved = true; m.aimTurns = 0; m.follow = null; }
        return moved;
      }
      while (moved < steps && hexDist(m.h, goal) > stopAt) {
        let best = null, bd = hexDist(m.h, goal), via = null;
        for (const [dq, dr] of DIRS) {
          const n = { q: m.h.q + dq, r: m.h.r + dr }, nk = key(n.q, n.r);
          if (!taken(nk)) {
            const d = hexDist(n, goal);
            if (d < bd || (d === bd && (!best || better(n, d, bd, best)))) { bd = d; best = n; via = null; }
            continue;
          }
          // through a friend: +1 movement point, onto the hex beyond
          if (!friendAt(m, nk) || moved + 3 > steps) continue;
          const b = { q: n.q + dq, r: n.r + dr };
          if (taken(key(b.q, b.r))) continue;
          const d = hexDist(b, goal);
          if (d < bd) { bd = d; best = b; via = n; }
        }
        if (!best) break;
        place(m, best); moved += via ? 3 : 1;
        if (afterStep(m)) break;
      }
      if (moved) { m.moved = true; m.aimTurns = 0; m.follow = null; }
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
          if (!taken(k) && !slots.has(k) && (!ELEV || levelOK({ q: f.h.q + dq, r: f.h.r + dr }, m.u, f.h, f.u, { reachMax: reach }))) slots.set(k, f);
        }
      }
      if (!slots.size) return null;
      // a shield (and a storm shield's field) covers only the front and the shield side: go round to the weapon
      // side or the back when that's no more than two steps further (B287)
      const stalk = stalker(m);
      const guarded = (hk, f) => {
        // a stalker goes for the flank or the back (the front is a last resort)
        if (stalk) { const [q, r] = hk.split(",").map(Number); if (arcOf(f.h, f.facing, { q, r }) === "front") return true; }
        if (!(shieldDB(f) || (f.u.shield && f.u.shield.arc && f.sp > 0))) return false;
        const [q, r] = hk.split(",").map(Number), h = { q, r }, a = arcOf(f.h, f.facing, h);
        return a === "front" || (a === "side" && sideOf(f.h, f.facing, h) === "L");
      };
      const start = key(m.h.q, m.h.r), prev = new Map([[start, null]]), dist = new Map([[start, 0]]), q = [m.h], cc = climbCls(m);
      let fallback = null;
      const route = (hk, h) => {
        const path = [];
        for (let k = hk, n = h; k !== start; ) { path.unshift(n); const p = prev.get(k); k = key(p.q, p.r); n = p; }
        return { path, foe: slots.get(hk) };
      };
      for (let i = 0; i < q.length && prev.size < maxNodes; i++) {
        const h = q[i], hk = key(h.q, h.r);
        if (fallback && dist.get(hk) > fallback.d + 2) break;
        if (hk !== start && slots.has(hk)) {
          if (!guarded(hk, slots.get(hk))) return route(hk, h);
          if (!fallback) fallback = { hk, h, d: dist.get(hk) };
        }
        for (const [dq, dr] of DIRS) {
          const n = { q: h.q + dq, r: h.r + dr }, nk = key(n.q, n.r);
          if (prev.has(nk) || (taken(nk) && !friendAt(m, nk))) continue;   // friends can be passed through (B368)
          const e = EL ? climb(idx(hk), idx(nk), cc) : 0;
          if (e === Infinity) continue;
          prev.set(nk, h); dist.set(nk, dist.get(hk) + (taken(nk) ? 2 : 1) + e); q.push(n);
        }
      }
      return fallback ? route(fallback.hk, fallback.h) : null;
    }
    function followPath(m, path, steps) {
      let moved = 0;
      // still more than a move out and under grenade threat: head for the same end but fan out on the way
      if (path.length > steps + 1 && (grenadeThreat(m) || stalker(m))) return stepToward(m, path[path.length - 1], steps, 0);
      // a friend on the path is passed through for an extra movement point (B368), never stopped on
      let from = m.h;
      for (const n of path) {
        const nk = key(n.q, n.r), e = EL ? climb(idx(key(from.q, from.r)), idx(nk), climbCls(m)) : 0;
        if (moved >= steps || e === Infinity || (e && moved + 1 + e > steps)) break;
        from = n;
        if (taken(nk)) { if (friendAt(m, nk) && moved + 2 + e < steps) { moved += 2 + e; continue; } break; }
        place(m, n); moved += 1 + e; if (afterStep(m)) break;
      }
      if (moved) { m.moved = true; m.aimTurns = 0; m.follow = null; }
      return moved;
    }
    function nearestFoe(m, pool) {
      let best = null, bd = Infinity;
      for (const f of pool || foes(m)) { if (!f.h) continue; const d = hexDist(f.h, m.h); if (d < bd) { bd = d; best = f; } }
      return best;
    }

    // ---- attacks
    function jamCheck(m, w, r) {
      const rf = r.roll === 18 || (r.roll === 17 && r.level <= 15);
      r.fumble = rf;
      if (rf && !w.malf && !w.natural && w.usage !== "power") { critMiss(m, w, true); return true; }
      if (!w.malf || r.crit) return false;
      let malf = w.malf;
      if (/^Ork /.test(m.u.template) && m.u.models.filter(active).length >= 10) malf += 1;   // WAAAGH! (framework)
      if (r.roll < malf) return false;
      if (r.fumble && w.overheat) {
        L(`  ${m.id}'s ${w.name} overheats`);
        applyHit(m, { dmg: w.overheat, follow: null }, m, "torso", false, false, w.overheat);
        m.gunBroken = true;
        return true;
      }
      // Malfunction table (B407-408): 3-4 and 15-18 a mechanical or electrical problem, out for the fight; 9-11 a
      // stoppage (the round fires, then it jams; a beam weapon's is a mechanical problem): three Readies and an
      // Armoury roll, or IQ-based weapon skill -4, per attempt; otherwise a misfire (no shot): a Ready to find it, then
      // three Readies and Armoury +2 per attempt
      const t = roll3(), sk = (m.u.stats.skills || []).find(x => /^Armoury/.test(x.name) && x.level != null);
      const armoury = sk ? sk.level : (m.u.stats.iq || 10) - 5, iqGun = w.level - m.u.dx + (m.u.stats.iq || 10) - 4;
      if (t <= 4 || t >= 15 || (t <= 11 && t >= 9 && BEAM.test(w.name))) { m.gunBroken = true; L(`  ${m.id}'s ${w.name} breaks down (malfunction)`); return true; }
      if (t >= 9 && t <= 11) { m.jam = 3; m.jamSkill = Math.max(armoury, iqGun); L(`  ${m.id}'s ${w.name} fires once and jams`); return "one"; }
      m.jam = 4; m.jamSkill = armoury + 2; L(`  ${m.id}'s ${w.name} misfires`);
      return true;
    }
    function fireThrough(m, w, t, i, lvl) {
      const shots = w.shots.mag === Infinity ? (w.rof || 1) : Math.min(w.rof || 1, m.ammo);
      if (w.shots.mag !== Infinity) m.ammo -= shots;
      m.attacked = true; m.aimTurns = 0; if (w.fp) spendFP(m, w.fp); reveal(m, w);
      faceTo(m, t.h);
      L(`${m.id} fires ${shots > 1 ? shots + " " : ""}through the ${hexName(i)} at ${t.id} (skill ${lvl})`);
      let hits = 0;
      for (let k = 0; k < shots && t.state === "ok"; k++) {
        const lk = lvl - rclPen(w, k, false);
        if (lk < 3 || !check(lk).ok) continue;
        hits++;
        const raw = rollDamage(w.dmg), st = structOf(i), sDR = st ? (w.dmg.div === Infinity ? 0 : Math.floor(st.dr / (w.dmg.div || 1))) : 0;
        if (st) damageStructure(i, raw, w.dmg, true);
        if (raw > sDR && t.h) applyHit(m, w, t, hitLocation(), true, hexDist(m.h, t.h) >= w.range.half, null, raw - sDR);
        else L(`  the ${hexName(i)} stops it`);
      }
      if (!hits) L(`  no round finds its mark`);
    }
    // Line of fire (B389): every figure on the line between shooter and target, friend or foe, costs -4 to hit
    // (simulator value from the Basic Set rule, to be checked against the book); a miss may hit one of them or
    // someone beside the target instead, on a roll of 9 + its SM (likewise to be checked)
    // figures on the line from a to b that block it; a kneeling or prone figure is shot over, and a friend of the
    // shooter's in the next hex is fired past (house rule: a front rank kneels or a man leans past his neighbour)
    function between(a, b, side) {
      if (!a || !b || hexDist(a, b) <= 1) return [];
      const out = [];
      for (const h of lineHexes(a, b)) {
        const x = occ.get(key(h.q, h.r));
        if (!x || x.state !== "ok" || x.kneel || x.prone) continue;
        if (side != null && x.u.side === side && hexDist(a, x.h) <= 1) continue;
        out.push(x);
      }
      return out;
    }
    // Hitting the wrong target (B389, B392): each figure that might be hit, closest first, is attacked at a flat 9 or
    // what the shooter would need to hit it on purpose, whichever is worse; it defends as it would against a shot
    // at it. The first that is hit, or defends, ends the round's flight. Drilled squads don't hit each other by mistake
    function strayAt(m, w, c, raw) {
      if (!c.h || c.state !== "ok" || !m.h) return false;
      if (c.u.side === m.u.side && drilled(m) && drilled(c)) return false;
      const d = Math.max(1, hexDist(m.h, c.h));
      const lvl = Math.min(9, wl(m, w) - skillPen(m) + rangePenalty(rngD(m.h, c.h, d)) + c.u.sm + shotFx(c, m.h, false).pen("random") - darkPen(m, c));
      if (lvl < 3 || !check(lvl).ok) return false;
      if (defend(c, m, false, 0, 0, w) != null) { L(`  a stray round goes past ${c.id}, who ducks`); return true; }
      L(`  a stray round hits ${c.id}${c.u.side === m.u.side ? " (friendly fire)" : ""}`);
      applyHit(m, w, c, hitLocOn(c), true, raw == null && d >= w.range.half, null, raw);
      return true;
    }
    // the first figure beyond hex tH on the line of fire from m, within the weapon's range (up to 20 yards on)
    function beyond(m, w, tH) {
      if (!m.h || !tH) return null;   // the shooter fell during its own burst
      const d = hexDist(m.h, tH), ext = Math.min(20, w.range.max - d);
      if (d < 1 || ext < 1) return null;
      const far = { q: tH.q + Math.round((tH.q - m.h.q) * ext / d), r: tH.r + Math.round((tH.r - m.h.r) * ext / d) };
      for (const h of [...lineHexes(tH, far), far]) {
        if (terr && !los(tH, h)) return null;
        const x = occ.get(key(h.q, h.r));
        if (x && x.state === "ok" && x !== m) return x;
      }
      return null;
    }
    // the candidates: figures on the line of fire, then (when the target is in a close combat, B392) those fighting
    // beside it, then whoever is beyond it
    function stray(m, w, t, inter) {
      if (!m.h) return;
      const melee = t.h && models.some(x => x.u.side !== t.u.side && x.state === "ok" && x.h && hexDist(x.h, t.h) <= 1);
      const near = melee ? models.filter(x => x !== m && x !== t && x.state === "ok" && x.h && hexDist(x.h, t.h) <= 1) : [];
      const cands = [...new Set([...inter, ...near])].filter(x => x.h && x.state === "ok").sort((a, b) => hexDist(m.h, a.h) - hexDist(m.h, b.h));
      for (const c of cands) if (strayAt(m, w, c)) return;
      const b = t.h && beyond(m, w, t.h);
      if (b && !cands.includes(b)) strayAt(m, w, b);
    }
    // Overpenetration (B408-409): a piercing, impaling or tight-beam burning shot whose basic damage beats the
    // target's cover DR (its DR front and back plus its HP; half HP if Unliving, a quarter if Homogeneous) goes on
    // to whoever is behind, less that cover DR
    const pointedW = w => /^pi/.test(w.dmg.type) || w.dmg.type === "imp" || (w.dmg.type === "burn" && !w.dmg.ex && !w.cone);
    function overpen(m, w, t, tH, loc, basic) {
      if (!tH || w.cone || w.dmg.ex || !pointedW(w)) return;
      const l = loc.replace("#c", ""), f = t.u.flags;
      const dr = drAt(t.u.arm.dr, l === "vitals" ? "torso" : l) + natDRat(t.u, l);
      const cov = (w.dmg.div === Infinity ? 0 : Math.floor(2 * dr / (w.dmg.div || 1))) + Math.floor(t.u.HP * (f.homogenous ? 0.25 : f.unliving ? 0.5 : 1));
      if (basic <= cov) return;
      const x = beyond(m, w, tH);
      if (!x) return;
      L(`  the shot punches through ${t.id}`);
      strayAt(m, w, x, basic - cov);
    }
    // a missed or dodged explosive lands n yards off in a random direction (B414), short of any wall
    function scatter(at, n) {
      const [dq, dr] = DIRS[Math.floor(R() * 6)];
      let h = at;
      for (let i = 0; i < n; i++) { const x = { q: h.q + dq, r: h.r + dr }; if (terr && (idx(key(x.q, x.r)) == null || wallAt(key(x.q, x.r)))) break; h = x; }
      return h;
    }
    // Bracing (the user's Progressive Recoil rule): a gun fired without moving from a mount or bipod line, from prone,
    // over a crate, barricade or wall in the next hex toward the target, or from a kneel behind a carried shield
    // (TS p. 12, 28): and an aimed pistol shot held in both hands, when the off hand is free
    function bracedFor(m, w, t, moved, aimed) {
      if (moved || !m.h || !t || !t.h || w.usage === "power" || w.thrown || w.cone) return false;
      if (/mount|braced|bipod|tripod/i.test(w.usage || "")) return true;
      if (w.team && w.needsSetup && m.setUp) return true;
      if (m.prone) return true;
      if (m.kneel && shieldDB(m)) return true;
      if (aimed && w.pistol && !m.u.cs && (m.inHand !== "both" || !m.u.melee || m.u.melee.natural || m.u.melee.name === "Punch")) return true;
      if (terr) { const [dq, dr] = DIRS[faceToward(m.h, t.h)], i = idx(key(m.h.q + dq, m.h.r + dr)); if (i != null && ((terr.crateI[i] && !crateGone[i]) || (terr.wallI[i] && !broken[i]))) return true; }
      return false;
    }
    function fireAt(m, w, target, opts) {
      if (m.state !== "ok" || !m.h || !target.h || !los(m.h, target.h) || duckedFrom(target, m.h)) return;   // the attacker fell, the target left or ducked, or a wall is in the way
      reveal(m, w);
      const d = Math.max(1, hexDist(m.h, target.h));
      if (d > w.range.max) return;
      if (w === m.u.ranged && m.gunOneHand && w.spentAfter) m.gunSpent = true;   // fired one-handed: unready (B270)
      m.holdN = 0;
      const shots = w.shots.mag === Infinity ? w.rof : Math.min(w.rof, m.ammo);
      if (w.shots.mag !== Infinity) m.ammo -= shots;
      if (w.extra) m.extraLeft = (m.extraLeft ?? w.limit) - shots;
      m.attacked = true;
      if (w.fp) spendFP(m, w.fp);
      if (w.perils && perils(m, w)) return;
      const aimBonus = opts.aim ? Math.min(2 * w.acc, w.acc + (m.aimTurns >= 3 ? 2 : m.aimTurns >= 2 ? 1 : 0)) : 0;
      // follow-up shots (TS p. 14): after an aimed shot, later shots at the same target keep half the base Acc (all of
      // it braced at RoF 1) until the shooter moves, defends, or switches target or weapon; first round only
      const fAcc = !opts.aim && m.follow && m.follow.t === target && m.follow.w === w && !m.moved ? m.follow.acc : 0;
      const firstB = aimBonus + fAcc;
      // Malediction (B106): no active defence; a Quick Contest against the target's Will (or HT), with range penalties
      // of -1/yard (level 1), the Size and Speed/Range Table (2) or long-distance modifiers (3, none inside 200 yd)
      if (w.malediction) {
        if (w.fp && target.u.flags.blank) { L(`${m.id} casts ${w.name} at ${target.id}: the power dies against a blank`); m.aimTurns = 0; return; }
        const resist0 = w.resist === "HT" ? target.u.HT : target.u.will;
        // Rule of 16 (B349): a resisted power's skill can't exceed the higher of 16 and the resistance
        const lvl = Math.min(Math.max(16, resist0), wl(m, w) - skillPen(m) + (w.malediction === 1 ? -d : w.malediction === 2 ? rangePenalty(d) : 0) + (opts.aoa ? 1 : 0));
        const plan = planAttack(m, w, target, lvl, false), loc0 = plan.loc === "random" ? null : plan.loc;
        const r = check(plan.lvl), res = check(w.resist === "HT" ? target.u.HT : target.u.will);
        m.aimTurns = 0;
        const wins = r.ok && (!res.ok || r.margin > res.margin);
        L(`${m.id} casts ${w.name} at ${target.id} (${d} yd${loc0 && loc0 !== "torso" ? ", aiming at the " + locName(loc0) : ""}, skill ${plan.lvl} vs ${w.resist} ${w.resist === "HT" ? target.u.HT : target.u.will}): ${wins ? "it takes hold" : r.ok ? "resisted" : "fails"}`);
        if (!wins) return;
        const raw = rollDamage(w.dmg);
        applyHit(m, w, target, loc0 || hitLocation(), true, false, null, raw);
        if (w.dmg.ex && target.h) explosion(m, w, target.h, raw, target);
        return;
      }
      if (w.fp && target.u.flags.blank) { L(`${m.id} casts ${w.name} at ${target.id}: the power dies against a blank`); m.aimTurns = 0; return; }
      const braced = bracedFor(m, w, target, opts.moved || m.moved, firstB > 0);
      // sighted and aimed shots as All-Out Attack (Determined) (TS p. 13-14; an option): +1, no defence till next turn
      const sighted = SIGHTED && opts.aim && !opts.aoa;
      if (sighted) { m.aoa = true; L(`${m.id} settles into the sights (All-Out Attack)`); }
      let base = wl(m, w) + (braced ? 1 : 0) + (opts.pointBlank ? Math.min(0, w.bulk) : rangePenalty(rngD(m.h, target.h, d) + spdOf(target.steps || 0)))   // a target moving faster than Move 10 adds its speed to the range (B373, B550)
        + target.u.sm - skillPen(m) + firstB - (opts.pen || 0) - darkPen(m, target)
        // All-Out Attack (Determined): +1, or +4 for a gun fired at a foe within reach (TS p. 25)
        + (opts.moved ? Math.min(-2, w.bulk) : 0) + (opts.aoa || sighted ? (opts.pointBlank ? 4 : 1) : 0)
        - (opts.pointBlank || opts.popup ? 0 : ownCoverPen(m, target.h, braced && firstB > 0));
      m.aimTurns = 0;
      m.follow = firstB > 0 && !w.cone && !w.malediction ? { t: target, w, acc: braced && (w.rof || 1) === 1 ? w.acc : Math.floor(w.acc / 2) } : null;
      if (w.cone) { coneFire(m, w, target, base, d); return; }
      // a burst goes at one target (with recoil climbing per round, spreading it over neighbours as B373 allows
      // would only put the later rounds at worse odds)
      const t = target;
      const halfD = d >= w.range.half;   // at or beyond 1/2D (B378)
      const n = shots;
      const inter = between(m.h, t.h, m.u.side).filter(x => x !== t);
      const plan = planAttack(m, w, t, base - linePen(m, inter), false, null, { aim: firstB, braced, fx: shotFx(t, m.h, opts.pointBlank) });
      const loc0 = plan.loc === "random" ? null : plan.loc;
      const lvl = plan.lvl;
      let nb = n;
      if (lvl < 3) { L(`${m.id} can't hope to hit ${t.id} (skill ${lvl})`); return; }   // B344
      const r = check(lvl);
      const jc = jamCheck(m, w, r);
      if (jc === true) return;
      if (jc === "one") nb = 1;
      // every round rolled on its own (Progressive Recoil); Aim counts on the first only; criticals can't be dodged.
      // misses: the margin of each round that missed (for strays and scatter); rounds below skill 3 aren't rolled
      const toTorso = loc0 && NEAR_TORSO.has(loc0) ? 1 : 0;
      let got = r.ok ? 1 : 0, crits = r.crit ? 1 : 0, near = !r.ok && r.margin >= -2, tg = toTorso && !r.ok && !r.fumble && r.margin === -1 ? 1 : 0;
      const misses = r.ok || (toTorso && !r.fumble && r.margin === -1) ? [] : [r.margin];
      for (let k = 1; k < nb; k++) {
        const lk = lvl - firstB - rclPen(w, k, braced);
        if (lk < 3) { misses.push(-3); continue; }   // no roll below 3 (B344): a wild round
        const rk = check(lk);
        if (rk.ok) { got++; if (rk.crit) crits++; }
        else { if (rk.margin >= -2) near = true; if (toTorso && rk.margin === -1 && !rk.fumble) tg++; else misses.push(rk.margin); }
      }
      const aimedGot = got; got += tg;
      const e = ev(t); e.shotAt = m; e.vol = Math.max(e.vol || 0, nb); if (near) e.near = true;
      const thru = (inter.length ? `, through ${inter.length}` : "") + (plan.da ? `, deceptive -${plan.da}` : "");
      // a missed explosive lands its margin of failure in yards off, at most half the distance (B414); any other
      // missed round may strike someone on the line, beside the target or beyond it (B389, B392)
      const wild = () => {
        for (const mg of misses) {
          if (w.dmg.ex) { const at = t.h || t.lastH; if (at) explosion(m, w, scatter(at, Math.max(1, Math.min(Math.ceil(d / 2), -mg))), rollDamage(w.dmg)); }
          else if (t.h) stray(m, w, t, inter);
        }
      };
      if (!got) {
        L(`${m.id} fires ${n > 1 ? n + " " : ""}at ${t.id} (${d} yd${loc0 && loc0 !== "torso" ? ", aiming at the " + locName(loc0) : ""}${thru}, skill ${lvl}): misses`);
        FX(["s", m.h.q, m.h.r, t.h.q, t.h.r, m.u.side, 0, m.ix, t.ix, lvl, 0, nb]);
        wild();
        return;
      }
      let hits = got;
      FX(["s", m.h.q, m.h.r, t.h.q, t.h.r, m.u.side, got ? 1 : 0, m.ix, t.ix, lvl, got, nb]);
      L(`${m.id} ${w.usage === "power" ? "casts " + w.name + " at" : "fires " + (n > 1 ? n + " at" : "at")} ${t.id} (${d} yd${loc0 && loc0 !== "torso" ? ", aiming at the " + locName(loc0) : ""}${thru}, skill ${lvl}${braced ? ", braced" : ""}${nb > 1 ? (w.rcl === 1 && w.rclFlat ? ", then -1" : `, then -${w.mounted && w.rcl > 1 ? 1 : braced ? Math.max(1, Math.ceil(w.rcl / 2)) : w.rcl} a round${w.mounted && w.rcl > 1 ? " on the mount" : ""}`) + (firstB ? ` unaimed` : "") : ""}): ${hits} hit${hits > 1 ? "s" : ""}`);
      let dodged = 0, dMargin = 0;
      if (hits > crits && !w.malediction) {
        const open = hits - crits;   // critical rounds can't be defended
        if (d <= 1) {
          // in close combat the defender can parry the weapon (or step aside) instead of dodging the shot (B391)
          const def = defend(t, m, "pb", plan.da, 0, w);
          if (def) {
            const dg = def.how === "parry" ? open : Math.min(open, 1 + def.margin); hits -= dg; L(`  ${t.id} ${def.how === "parry" ? "knocks the gun aside" : "dodges " + dg}`);
            if (def.how !== "parry") { dodged = dg; dMargin = def.margin; }
            if (t.shieldStruck && def.how !== "parry") for (let k = 0; k < dg; k++) shieldHit(m, w, t, loc0 || "random", true);
          }
        } else {
          const def = defend(t, m, false, plan.da, 0, w);
          if (def != null) {
            const dg = Math.min(open, 1 + def); hits -= dg; L(`  ${t.id} dodges ${dg}`);
            // the rounds the shield's DB turned aside struck it: all of them if the dodge needed the DB, else DB of them
            const struck = t.shieldStruck ? dg : Math.min(dg, t.defDB || 0);
            for (let k = 0; k < struck && t.state === "ok"; k++) shieldHit(m, w, t, loc0 || "random", true);
            dodged = dg - struck; dMargin = def;
          }
        }
      }
      const tH = t.h;
      for (let k = 0; k < hits && t.state === "ok"; k++) {
        const loc = k < aimedGot ? (loc0 || hitLocOn(t)) : "torso";
        const raw = rollDamage(w.dmg);
        applyHit(m, w, t, loc, true, halfD, null, raw, k < crits ? roll3() : 0);
        // every explosive round that hits bursts on its own (B414)
        if (w.dmg.ex) { const at = t.h || t.lastH; if (at) explosion(m, w, at, raw, t); }
        else overpen(m, w, t, tH, loc, halfD ? Math.floor(raw / 2) : raw);
      }
      // a dodged round flies on: an explosive lands the dodge's margin of success in yards away (B414), a bullet
      // may hit someone behind (B389)
      for (let k = 0; k < dodged; k++) {
        if (w.dmg.ex) { const at = tH || t.lastH; if (at) explosion(m, w, scatter(at, Math.max(1, dMargin)), rollDamage(w.dmg)); }
        else if (tH) { const b = beyond(m, w, tH); if (b) strayAt(m, w, b); }
      }
      wild();
      if (w.blast && !w.dmg.ex && tH) for (const x of models) if (x !== t && x.state === "ok" && x.h && hexDist(x.h, tH) <= w.blast) {
        if (defend(x, m, false, 0, 0, w) == null) applyHit(m, w, x, "area", true, halfD);
      }
    }
    // Cones (B413): one attack roll at the aim point; everyone in the wedge (a yard wide at the muzzle, widening
    // to the full width at maximum range) whom the shooter can see is caught, and may dodge. Large-area injury (B400)
    function coneCaught(m, w, target, from = m.h) {
      const S = Math.sqrt(3), [ax, ay] = px(from), [bx, by] = px(target.h);
      const len = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / len, uy = (by - ay) / len;
      const caught = [target];
      for (const x of models) {
        if (x === m || x === target || x.state !== "ok" || !x.h) continue;
        const [xx, xy] = px(x.h), along = ((xx - ax) * ux + (xy - ay) * uy) / S, off = Math.abs((xx - ax) * uy - (xy - ay) * ux) / S;
        if (along <= 0 || along > w.range.max + 0.5) continue;
        if (off > Math.max(1, w.cone * along / w.range.max) / 2 + 0.5) continue;   // half a hex for the hex grid
        if (los(from, x.h)) caught.push(x);
      }
      return caught;
    }
    function coneFire(m, w, target, base, d) {
      const caught = coneCaught(m, w, target);
      const lvl = base;
      if (lvl < 3) { L(`${m.id} can't hope to hit ${target.id} (skill ${lvl})`); return; }
      const r = check(lvl);
      if (jamCheck(m, w, r) === true) return;
      FX(["s", m.h.q, m.h.r, target.h.q, target.h.r, m.u.side, r.ok ? 1 : 0, m.ix, target.ix, lvl, r.ok ? 1 : 0, 1]);
      for (const x of caught) { const e = ev(x); e.shotAt = m; e.vol = Math.max(e.vol || 0, 1); e.near = true; }
      if (!r.ok) { L(`${m.id} ${w.usage === "power" ? "casts " + w.name + " at" : "fires at"} ${target.id} (${d} yd, skill ${lvl}): the ${w.name} goes wide`); return; }
      L(`${m.id} ${w.usage === "power" ? "casts " + w.name + " at" : "fires at"} ${target.id} (${d} yd, skill ${lvl}): the ${w.name} catches ${caught.map(x => x.id).join(", ")}`);
      for (const x of caught) {
        if (x.state !== "ok") continue;
        if (!r.crit && defend(x, m, false, 0, 0, w) != null) { L(`  ${x.id} dives clear`); continue; }
        applyHit(m, w, x, "area", true, hexDist(m.h, x.h) >= w.range.half);
      }
    }
    // Perils of the Warp (framework, warp.yaml): a Will roll on every casting; failure by 1-2 costs FP, 3-5 hurts
    // and fizzles, 6-9 hurts, stuns and fizzles, 10+ or a natural 18 is catastrophic. Returns true if the power fizzles.
    function perils(m, w) {
      const P = w.perils;
      const orks = /^Ork /.test(m.u.template) ? models.filter(x => x.state === "ok" && /^Ork /.test(x.u.template) && x.u.side === m.u.side).length : 0;
      const r = check(P.will + (orks >= 10 ? P.waaagh : 0) - (shadowed(m) ? 3 : 0));
      if (r.ok) return false;
      const by = -r.margin;
      if (by >= P.cat || r.roll === 18) { kill(m, m, "consumed by the warp (Perils of the Warp)"); return true; }
      if (by <= 2) { spendFP(m, P.fp); L(`  ${m.id} strains against the warp (-${P.fp} FP)`); return false; }
      const d = by <= 5 ? P.modDmg : P.majDmg;
      L(`  Perils of the Warp! ${m.id}'s power backlashes`);
      if (d) injure(m, m, rollDamage(d), "torso", d.type);
      if (by >= 6 && m.state === "ok") { m.stunned = true; m.stunRec = "iq"; }   // mental stun: IQ to recover (B364)
      return true;
    }
    // Critical Miss Table for melee (B556), as far as the sim can show it: the weapon breaks, you hit yourself,
    // lose your balance (-2 to defend until your next turn), must re-Ready or drop the weapon, or fall down.
    // Natural weapons can't break or be dropped: those rows cost balance instead.
    // Critical Miss Tables (B556-557). Guns and blades use the armed table; claws, fists, slams and powers the unarmed one.
    // Breakage-resistant (roll "broken" twice to break, else drop): firearms other than beam weapons, solid crushing
    // weapons, and fine weapons (power, force and master-crafted relic blades).
    const BEAM = /\b(las|hot-shot|plasma|melta|flamer|volkite|gauss|tesla|pulse|ion|rail|lance|shuriken|splinter|dark lance|fusion|beam)/i;
    const FINE = /\b(power|force|relic|guardian spear|sentinel|castellan|crozius|thunder hammer|misericordia|null|nemesis|daemon|artificer|master-crafted|Emperor|Talon|axe of|blade of)/i;
    const UNARMED = { name: "Slam", natural: true };
    function critMiss(m, w, ranged) {
      const unarmed = w.natural || w.name === "Punch" || w.name === "Slam" || w.usage === "power";
      const say = x => L(`  critical miss: ${m.id} ${x}`);
      let row = roll3();
      if (unarmed) {
        if (row === 3 || row === 18) { say("knocks itself senseless"); incapacitate(m, "is out of the fight"); return; }
        if (row === 4 || row === 17) { say("strains a limb"); if (w.usage === "power") m.offBalance = true; else { injure(m, m, 1, "arm", "cr"); if (m.state === "ok") cripple(m, "arm"); } return; }
        if (row === 5 || row === 6) {
          // hits a wall or the floor: its own thrust crushing to the limb (half on a 6)
          const own = m.u.thrCr;
          const raw = Math.max(0, Math.floor(rollDamage(own) / (row === 6 ? 2 : 1)));
          say("hits something solid");
          applyHit(m, { dmg: own, follow: null }, m, "arm", false, false, null, raw);
          return;
        }
        if (row === 7 || row === 14) { if (m.h) m.facing = (m.facing + 3) % 6; m.offBalance = true; say("stumbles past; its foe is behind it"); return; }
        if (row === 8 || row === 16) { m.prone = true; say("falls down"); return; }
        if (row === 12) { if (!check(m.u.dx).ok) { m.prone = true; say("trips and falls"); } else say("trips but keeps its feet"); return; }
        if (row === 13) { m.offBalance = true; say("drops its guard"); return; }
        if (row === 15) { injure(m, m, Math.max(0, d6() - 3), "arm", "cr"); m.offBalance = true; say("tears a muscle"); return; }
        m.offBalance = true; say("loses its balance"); return;   // 9-11
      }
      const tough = ranged ? !BEAM.test(w.name) : w.dmg.type === "cr" || FINE.test(w.name);
      const broken = r => r <= 4 || r >= 17;
      if (broken(row) && tough) { row = roll3(); if (!broken(row)) row = 10; }   // resists: drops it instead
      // piercing, impaling and ranged attacks only hit their user on a second 5 or 6
      if ((row === 5 || row === 6) && (ranged || /^(imp|pi)/.test(w.dmg.type))) { const r2 = roll3(); row = r2 === 5 || r2 === 6 ? r2 : 10; }
      if (ranged && row === 16) row = 7;
      const lose = (x, broke) => {
        if (ranged) { if (broke) m.gunBroken = true; m.inHand = m.inHand === "both" ? "melee" : m.inHand === "gun" ? "none" : m.inHand; }
        else { if (broke) m.meleeBroken = true; m.inHand = m.inHand === "both" ? (m.u.ranged ? "gun" : "none") : m.inHand === "melee" ? "none" : m.inHand; }
        say(x);
      };
      if (broken(row)) lose(`breaks its ${w.name}`, true);
      else if (row === 5 || row === 6) {
        const raw = Math.floor(rollDamage(w.dmg) / (row === 6 ? 2 : 1)); say(`hits itself`);
        applyHit(m, { ...w, follow: null }, m, R() < 0.5 ? "arm" : "leg", false, false, null, raw);
      }
      else if (row === 7 || row === 13) { m.offBalance = true; say("loses its balance"); }
      else if (row === 8 || row === 12) lose(`has its ${w.name} turn in its hand (a Ready to recover)`);
      else if (row === 15) { lose(`strains its shoulder: can't use its ${w.name} this fight`, true); }
      else if (row === 16) { m.prone = true; say("falls down"); }
      else lose(`drops its ${w.name}`);   // 9-11, 14
    }
    // the better of a weapon's ways of hitting (swing or thrust) against this foe
    function bestMode(m, w, t) {
      if (!w.alt || !w.alt.length) return w;
      let best = w, bs = planAttack(m, w, t, w.level - skillPen(m), true).score;
      for (const a of w.alt) { const sc = planAttack(m, a, t, a.level - skillPen(m), true).score; if (sc > bs) { bs = sc; best = a; } }
      return best;
    }
    function strike(m, w, t, opts) {
      if (ELEV && m.h && t.h && !levelOK(m.h, m.u, t.h, t.u, w)) { L(`${m.id} can't reach ${t.id} from here (${Math.round(3 * Math.abs(elevAt(m.h) - elevAt(t.h)))} feet ${elevAt(m.h) > elevAt(t.h) ? "below" : "above"})`); return; }
      reveal(m);
      w = bestMode(m, w, t);
      // attacks this turn: 1, +1 for All-Out Attack (Double), +1 for Rapid Strike (both together make three, MA97),
      // + Extra Attack; Rapid Strike's penalty falls on the two blows it makes (-6, or -3 for a master)
      const n = opts.blows ?? 1 + (opts.double ? 1 : 0) + (opts.rapid ? 1 : 0) + (m.u.flags.extraAttack || 0);
      if (opts.charge) m.mna = true;   // Move and Attack: no retreat until its next turn (B365)
      if (opts.committed) m.committed = true;   // Committed Attack (MA99): defences -2, no retreat, no parry with this weapon
      if (opts.defensive) m.defAtk = true;      // Defensive Attack (MA100): +1 to a parry or block, even after an unbalanced swing
      const rp = m.u.flags.master ? 3 : 6;
      const ev = m.evaluate && m.evaluate.t === t && m.evaluate.turn === turn - 1 ? m.evaluate.n : 0;
      let feintNow = m.feint && m.feint.t === t ? m.feint.n : 0;
      for (let i = 0; i < n && m.state === "ok" && m.h; i++) {
        // a foe that falls leaves the rest of the blows for another in reach (MA127, B370): each hex skipped round the
        // attacker between the two costs a blow
        if (t.state !== "ok" || !t.h) {
          const last = t.h || t.prevH;
          const next = models.filter(x => x.state === "ok" && x.h && x.u.side !== m.u.side && hexDist(x.h, m.h) <= w.reachMax && los(m.h, x.h) && levelOK(m.h, m.u, x.h, x.u, w))
            .sort((a, b) => (last ? hexDist(a.h, last) - hexDist(b.h, last) : 0))[0];
          if (!next) break;
          const skip = last ? Math.max(0, hexDist(next.h, last) - 1) : 0;
          i += skip; if (i >= n) break;
          L(`${m.id} turns on ${next.id}${skip ? ` (${skip} blow${skip > 1 ? "s" : ""} lost turning)` : ""}`);
          t = next; faceTo(m, t.h); feintNow = 0;
        }
        const rapidPen = opts.rapid && i < 2 ? (opts.flurry ? Math.ceil(rp / 2) : rp) : 0;
        // a feint in place of the first attack (All-Out Attack (Feint) or a Rapid Strike opening with one, MA97, MA127)
        if (i === 0 && opts.feintFirst) {
          const r0 = feintRoll(m, w, t, wl(m, w) - skillPen(m) - rapidPen + (opts.determined ? 4 : 0));
          feintNow = r0; continue;
        }
        const dfe = t.feintDef && t.feintDef.t === m && turn - t.feintDef.turn <= 1 ? t.feintDef.n : 0;
        if (dfe) t.feintDef = null;
        let lvl = -dfe + wl(m, w) - skillPen(m) - (opts.charge && !opts.heroic ? 4 : 0) + (opts.determined ? 4 : 0) + (opts.committed === "det" ? 2 : 0) - rapidPen + ev
          - (m.prone ? 4 : 0) - (m.kneel && !m.prone ? 2 : 0) - closePen(m, w) - (opts.pen || 0) + smMelee(m, t) - darkPen(m, t);
        if (opts.charge && !opts.heroic) lvl = Math.min(lvl, 9);
        const plan = planAttack(m, w, t, lvl, true, null, { noDa: !trained(m, w) });
        let loc = plan.loc === "random" ? reachLoc(m, t, w, hitLocation()) : plan.loc;
        if (plan.lvl < 3) { m.attacked = true; L(`${m.id} can't hope to hit ${t.id} (skill ${plan.lvl})`); continue; }   // B344
        // Telegraphic Attack (MA113): +4 to hit but +2 to every defence, and the crit range of the unmodified skill
        const tele = !!plan.tele, r = check(plan.lvl);
        // extra effort (B357): Mighty Blows and Flurry of Blows cost 1 FP an attack whether it lands or not, and a
        // critical failure while using it costs 1 HP to the arm, DR no help
        if ((opts.mighty || opts.flurry) && !m.u.flags.machine) { spendFP(m, 1); if (r.fumble && m.state === "ok") { L(`  ${m.id} wrenches its arm`); injure(m, m, 1, "arm", "cr"); } }
        if (tele && r.crit && r.roll > (plan.lvl - 4 >= 16 ? 6 : plan.lvl - 4 >= 15 ? 5 : 4)) r.crit = false;
        m.attacked = true;
        if (w.fp) spendFP(m, w.fp);
        if (w.perils && perils(m, w)) continue;
        if (m.h && t.h) FX(["m", m.h.q, m.h.r, t.h.q, t.h.r, m.u.side, r.ok ? 1 : 0, m.ix, t.ix, plan.lvl, r.roll]);
        if (!r.ok && !r.fumble && r.margin === -1 && plan.loc !== "random" && NEAR_TORSO.has(plan.loc)) { r.ok = true; r.margin = 0; L(`  (just misses the ${plan.loc}: the blow lands on the torso)`); loc = "torso"; }
        if (!r.ok) { L(`${m.id} strikes at ${t.id} (${loc !== "torso" ? locName(loc) + ", " : ""}skill ${plan.lvl}${tele ? ", telegraphic" : ""}): misses`); if (r.fumble) critMiss(m, w); continue; }
        if (!r.crit) {
          // two weapons at one foe: it defends at -1 against both (B417)
          const fN = i === 0 || (opts.double && i === 1) || (opts.feintFirst && i <= (opts.double ? 2 : 1)) ? feintNow : 0;
          const def = defend(t, m, true, plan.da, fN + (opts.dual ? 1 : 0) - (tele ? 2 : 0) + (m.riposte && m.riposte.t === t ? m.riposte.n : 0), w);
          if (def) {
            L(`${m.id} strikes at ${t.id}${tele ? " (telegraphic)" : ""}: ${def.how === "parry" ? "parried" : def.how === "block" ? "blocked" : "dodged"}`);
            if (def.how === "parry" || def.how === "block") m.parriedBy = { t, how: def.how, turn };
            if (def.how === "parry" && (w.name === "Punch" || w.natural)) cutsArm(t, m);
            else if (t.shieldStruck) shieldHit(m, w, t, loc, false);
            if (def.how === "parry") parryBreak(t, w, m);
            continue;
          }
        }
        const rending = w.rend && (r.crit || r.margin >= w.rendBy);
        L(`${m.id} strikes ${t.id}${loc !== "torso" ? " in the " + locName(loc) : ""} with ${w.name}${w.alt || /^thrust/i.test(w.usage || "") ? (/thrust/i.test(w.usage || "") ? " (thrust)" : /tip slash/i.test(w.usage || "") ? " (tip slash)" : " (swing)") : ""}${rending ? " (rending hit)" : ""}`);
        let raw = rollDamage(rending ? w.rend : w.dmg);
        if (inClose(m) && longPen(w) && /^\s*sw/.test(w.text || "")) raw = Math.max(0, raw - w.reachMax);   // MA117: a cramped swing
        // All-Out Attack (Strong, B365) and Mighty Blows (extra effort, 1 FP, B357; with Attack only, MA131): each +2 or +1/die
        if (opts.strong) raw += Math.max(2, w.dmg.n);
        if (opts.committed === "str") raw += Math.max(1, Math.floor(w.dmg.n / 2));   // Committed Attack (Strong), MA99
        if (opts.defensive) raw -= Math.max(2, w.dmg.n);                              // Defensive Attack: -2 or -1/die, MA100
        if (opts.mighty) { raw += Math.max(2, w.dmg.n); L(`  ${m.id} puts everything into it (Mighty Blows)`); }
        // a stop thrust on a Wait (B366): +1 damage per two full yards the charger ran onto it
        if (opts.stopYd && (w.dmg.type === "imp" || /thrust/i.test(w.usage || ""))) raw += Math.floor(opts.stopYd / 2);
        m.landed = t;
        applyHit(m, w, t, loc, false, false, rending ? w.rend : null, Math.max(0, raw), r.crit ? roll3() : 0);
      }
      m.feint = null; m.evaluate = null; m.riposte = null;
      // attack and fly out (MA99): a long weapon's Committed Attack may step back out of a shorter foe's reach
      if (opts.flyOut && m.state === "ok" && m.h && t.h && t.state === "ok" && !m.grips.length) {
        const h = retreatHex(m, t);
        if (h && hexDist(h, t.h) <= w.reachMax) { place(m, h); faceTo(m, t.h); L(`${m.id} steps back out of ${t.id}'s reach`); }
      }
    }
    // a feint roll (B365, MA101): Quick Contest of skill against the foe's best of weapon skill and DX; the margin comes
    // off its next defence against this attacker. A Beat (MA100) uses ST-based skill against the Parry or Block and
    // helps every attacker; a Ruse is IQ-based; a Defensive Feint takes the margin off the foe's next attack instead.
    function feintRoll(m, w, t, lvl, kind = "feint") {
      const u = m.u, T = t.u;
      const skillT = Math.max(T.melee.level, T.dx);
      const mine = check(kind === "beat" ? lvl + u.st - u.dx : kind === "ruse" ? lvl + (u.stats.iq || 10) - u.dx : lvl);
      const res = kind === "beat" ? Math.max(skillT, skillT + T.st - T.dx) : kind === "ruse" ? Math.max(skillT, skillT + (T.stats.per || T.stats.iq || 10) - T.dx) : skillT;
      const theirs = check(res);
      const n = mine.ok ? Math.max(0, mine.margin - (theirs.ok ? Math.max(0, theirs.margin) : 0)) : 0;
      const what = { feint: "feints at", beat: "beats at the guard of", ruse: "tricks", dfeint: "feints to throw off" }[kind];
      L(`${m.id} ${what} ${t.id}${n ? ` (-${n})` : " but it isn't fooled"}`);
      return n;
    }
    // trained fighters only (MA113): Committed and Defensive Attack, feints, Deceptive Attack and Rapid Strike need at
    // least DX level in the weapon's skill; anyone may make a Telegraphic Attack
    const trained = (m, w) => !w || w.natural || w.name === "Punch" ? m.u.grapple >= m.u.dx || (m.u.melee && m.u.melee.level >= m.u.dx) : w.level >= m.u.dx;
    // close combat while held (B391, MA117): -4 for being grappled, and -4 more per yard of the weapon's reach
    // Size Modifiers in Melee Combat (Pyramid 3/77 p. 7): the smaller fighter gets the SM difference as a bonus (at most
    // +4), the larger takes it as a penalty
    const smMelee = (m, t) => { const d = t.u.sm - m.u.sm; return d > 0 ? Math.min(4, d) : d; };
    // close combat (B391, MA117): a model holding or held by a foe is in its hex; a weapon without reach C is at -4 per
    // yard of its longest reach for all purposes (parry at half that) and swings for -1 per yard; being held is -4 more (B370)
    const inClose = m => !!(m.grips.length || (m.holding && m.holding.state === "ok"));
    const longPen = w => w && !/C/.test(w.reach || "") && w.reachMax >= 1 ? 4 * w.reachMax : 0;
    const closePen = (m, w) => (m.grips.length ? 4 : 0) + (inClose(m) ? longPen(w) : 0);
    // a parried weapon three or more times the parrying weapon's weight may break it (B376): 2 in 6, +1 per multiple past 3
    const attackWeight = (att, aw) => Math.max(aw.weight || 0, att && att.u && !aw.huge && aw !== UNARMED ? att.u.st * att.u.st / 100 : 0);
    function parryBreak(t, aw, att) {
      const pw = t.u.melee;
      if (!pw || pw.natural || pw.name === "Punch" || !aw || !pw.weight) return;
      const ratio = attackWeight(att, aw) / pw.weight;
      if (ratio < 3) return;
      const odds = 2 + Math.floor(ratio - 3) - (FINE.test(pw.name) ? 1 : 0);
      if (d6() <= odds) { t.meleeBroken = true; t.inHand = t.inHand === "both" ? (t.u.ranged ? "gun" : "none") : "none"; L(`  ${t.id}'s ${pw.name} breaks under the blow`); }
    }

    // ---- choose and carry out a maneuver
    const gunReady = m => m.inHand === "gun" || m.inHand === "both";
    // a fresh magazine from the belt (the part-used one is put away, its rounds not counted again)
    function refill(m, w) {
      if (m.mags <= 0) return;
      m.mags--; m.ammo = w.shots.mag;
      if (!m.mags) L(`  ${m.id} loads its last magazine`);
    }
    // a foe's hand on the gun (B370: a weapon can be grappled): the muzzle is held aside and the gun can't be fired
    // until its owner wrenches it free (a Quick Contest of ST) or lets it go for another weapon
    function gunGrip(t) {
      const g = t.gunGrip;
      if (!g) return null;
      if (g.state === "ok" && g.h && t.h && t.state === "ok" && g.gunHold === t && hexDist(g.h, t.h) <= 1 && gunReady(t)) return g;
      if (g.gunHold === t) g.gunHold = null;
      t.gunGrip = null; return null;
    }
    const holdingGun = m => m.gunHold && gunGrip(m.gunHold) === m ? m.gunHold : null;
    const longGun = t => t.u.ranged && !t.u.ranged.natural && !t.u.ranged.thrown && (t.u.ranged.bulk || 0) <= -3 && !t.gunBroken;
    const bladeReady = m => (m.inHand === "melee" || m.inHand === "both") && !m.meleeBroken;
    // Ready (B382): swap gun and blade; with Fast-Draw a successful roll makes it free and the model acts at once
    function switchTo(m, hand) {
      m.lastSwitch = turn;
      const w = hand === "melee" ? m.u.melee : m.u.ranged;
      // a model that holds both when it can picks both back up; a long gun it can hold in one hand (B270, 1.5x its ST)
      // stays in the other hand when it draws the blade
      m.knifeOut = false;
      const keep = hand === "melee" && m.u.ranged && m.u.ranged.semiOne && gunReady(m) && !m.gunBroken && !m.armsLost;
      m.inHand = m.u.bothReady || keep ? "both" : hand;
      m.gunOneHand = keep; if (hand === "gun") { m.gunOneHand = false; m.gunSpent = false; }
      const fd = hand === "melee" ? m.u.fdBlade : m.u.fdGun;
      if (fd > -Infinity && !m.fastDrew && check(fd - skillPen(m)).ok) {
        L(`${m.id} fast-draws the ${w.name}${keep ? `, keeping the ${m.u.ranged.name.split(",")[0]} in its other hand` : ""}`);
        m.fastDrew = true; act(m); m.fastDrew = false;
        return;
      }
      L(`${m.id} readies the ${w.name}${keep ? `, keeping the ${m.u.ranged.name.split(",")[0]} in its other hand` : ""}`);
    }
    // the combat knife (B194 Fast-Draw (Knife)): free on a roll, and the model strikes at once; otherwise a Ready
    function drawKnife(m, t) {
      m.knifeOut = true; m.lastSwitch = turn;
      if (m.u.fdKnife > -Infinity && !m.fastDrew && check(m.u.fdKnife - skillPen(m)).ok) {
        L(`${m.id} fast-draws its ${m.u.knife.name.split(",")[0]}`);
        if (t && t.state === "ok" && t.h && m.h && hexDist(m.h, t.h) <= 1) { faceTo(m, t.h); strike(m, m.u.knife, t, {}); }
        return;
      }
      L(`${m.id} draws its ${m.u.knife.name.split(",")[0]}`);
    }
    // ---- heavy weapon teams: a gunner and a loader (squad `team`, `crew`)
    const teamMates = m => m.u.team ? models.filter(x => x !== m && x.u.side === m.u.side && x.u.squad === m.u.squad && x.u.team === m.u.team) : [];
    const crewNear = m => m.h && teamMates(m).some(x => x.state === "ok" && x.h && !x.stunned && hexDist(x.h, m.h) <= 1);
    // a loader beside the gun feeds it: reloading takes half the time (house rule, after the crews of TS and B)
    const reloadTime = (m, w) => Math.max(1, m.u.crew === "gunner" && crewNear(m) ? Math.ceil(w.shots.reload / 2) : w.shots.reload);
    // setting a tripod weapon or mortar up, or packing it to move: 3 seconds with the loader beside it, 6 alone
    // (house rule; the item notes' "about a minute" is an unhurried setup)
    const setupTime = m => crewNear(m) ? 3 : 6;
    function weaponsFor(m, melee) {
      const out = [];
      const oneHand = m.armsLost || holdingGun(m);
      if (melee) { if (m.knifeOut && m.u.knife && m.armsLost < 2) out.push(m.u.knife); else if (m.armsLost < 2 && bladeReady(m) && (!oneHand || m.u.melee.oneHanded !== false)) out.push(m.u.melee); }
      else if (m.u.ranged && !m.gunBroken && !m.jam && m.armsLost < 2 && gunReady(m) && (!oneHand || m.u.ranged.oneHanded) && !gunGrip(m) && !m.gunSpent && (!m.u.ranged.needsSetup || m.setUp)) out.push(m.u.ranged);
      if (!melee && m.u.ranged2 && (m.extraLeft ?? m.u.ranged2.limit) > 0) out.push(m.u.ranged2);
      for (const p of m.u.powers) if (!!p.melee === melee && m.fp - p.fp >= 0) out.push(p);
      return out;
    }
    // ================= decision layer: one value scale for every choice =================
    // value of an option = aggression x SUM(share of a foe knocked out x that foe's threat)
    //                    - caution x P(I'm knocked out next turn) x my own worth over the next few turns
    //                    + delayed payoffs (Aim, Ready, reload, closing in) discounted GAMMA per turn.
    // "Threat" is the share of an average enemy's HP a model takes off per turn, so harm dealt and harm taken
    // share one currency. Personality weights (data/sim/ai.yaml) and stance (charge / advance / shoot) scale
    // the terms; noise lets a disorderly faction pick among near-best options.
    const GAMMA = 0.8, HORIZON = 4;
    const cl = x => Math.max(0, Math.min(18, Math.round(x)));
    const TV = new Map();
    function threatOf(f) {
      const k = f.u.idx;
      if (TV.has(k)) return TV.get(k);
      let best = 0.15;   // even a harmless foe has to be put down to win
      for (const U of units) {
        if (U.side === f.u.side) continue;
        let v = 0;
        const mw = f.u.melee;
        if (mw) v = Math.max(v, expInjRandom(mw, U) * P3[cl(mw.level - 4)] * (1 + (f.u.flags.extraAttack || 0)));
        const rw = f.u.ranged;
        if (rw) v = Math.max(v, expInjRandom(rw, U) * P3[cl(rw.level - 6)] * Math.min(3, rw.rof || 1));
        for (const p of f.u.powers) if (!p.melee && p.dmg) v = Math.max(v, expInjRandom(p, U) * P3[cl(p.level - 6)]);
        best = Math.max(best, Math.min(3, v / Math.max(1, U.HP)));
      }
      TV.set(k, best);
      return best;
    }
    // injury still needed to take a model out of the fight (standard HP: down to about -HP/2 where the
    // consciousness rolls start to bite; Fractional Health: a flat share of HP)
    const remOf = t => frac ? Math.max(1, t.u.HP * 0.75) : Math.max(t.u.HP * 0.3, t.hp + t.u.HP * 0.5);
    // value of E expected injury on foe t, seen by model m (Drukhari "prey" favour the wounded); same horizon as risk()
    function kv(m, t, E) {
      if (!(E > 0) || !t) return 0;
      const rem = remOf(t), share = Math.min(1, E / rem);
      // Bloodlust (B125): it goes for the killing blow, so a wounded foe is worth more to it
      const prey = m && t.hp < t.u.HP ? Math.max(m.u.ai.prey > 1 ? m.u.ai.prey : 1, m.u.flags.bloodlust ? 1.5 : 1) : 1;
      return share * threatOf(t) * prey * HORIZON;   // a foe taken out stops hurting us for the rest of the fight
    }
    // expected injury to m next turn standing on hex h: "aoa" (no defence), "aod" (+2) or normal
    // chance a foe under our fire keeps its head down or freezes (TS p. 21, 34): Will-2 in cover without Combat
    // Reflexes, and a Fright Check for suppression; the unafraid ignore both
    function pinOf(f) {
      if (f.u.flags.unfazeable || f.u.flags.noMorale) return 0;
      const down = f.u.flags.cr ? 0 : 1 - P3[cl(f.u.will - 2)];
      const scare = 1 - P3[cl(frightLevel(f.u, 0, Infinity))];
      return Math.min(0.9, down * 0.7 + scare * 0.5);
    }
    // a foe a friend is covering (an overwatch shooter's target, or inside a friend's suppression zone) shoots back
    // at less than full effect: that's what covering fire is for (TS p. 21)
    const covered = (m, f) => zones.some(z => z.side === m.u.side && z.owner.state === "ok" && f.h && z.hexes.has(key(f.h.q, f.h.r)))
      || models.some(x => x !== m && x.u.side === m.u.side && x.state === "ok" && x.role === "cover" && x.aimTarget === f);
    function incoming(m, h, mode) {
      let tot = 0;
      const near = known(m).filter(f => f.h && f.state === "ok").sort((a, b) => walk(h, a.h) - walk(h, b.h)).slice(0, 8);
      for (const f of near) {
        if (f.pinned || f.grips.length > 1) continue;
        const d = hexDist(f.h, h);
        // a foe spreads its attacks over the models of ours at least as close to it as this hex
        const rivals = models.filter(x => x !== m && x.u.side === m.u.side && x.state === "ok" && x.h && hexDist(x.h, f.h) <= d).length;
        const share = 1 / (1 + rivals);
        let best = 0;
        const mw = f.u.melee;
        if (mw && (terr ? walk(h, f.h) : d) - mw.reachMax <= moveOf(f) && (!ELEV || d > mw.reachMax || levelOK(f.h, f.u, h, m.u, mw))) {
          const lvl = mw.level - (d > mw.reachMax ? 4 : 0) - skillPen(f) + smMelee(f, m);
          const def = mode === "aoa" ? null : (mode === "ca" ? Math.max(m.u.dodge, m.u.db ? m.u.block : 0) - 2 : Math.max(m.u.dodge + 3, m.u.parry != null && bladeReady(m) ? m.u.parry + 1 : 0) + (mode === "da" ? 1 : 0)) + (mode === "aod" ? 2 : 0) - (m.stunned ? 4 : 0) - (m.prone ? 3 : 0) + m.u.db;
          best = expInjRandom(mw, m.u) * P3[cl(lvl)] * (1 - (def == null ? 0 : P3[cl(def)])) * (1 + (f.u.flags.extraAttack || 0));
        }
        const rw = f.u.ranged;
        if (rw && !f.gunBroken && d <= rw.range.max && los(f.h, h) && !(mode === "duck" && DUCK.has(coverAt(h, f.h, m)) && covPenAt(h, f.h, m) > 0)) {
          const lvl = rw.level - skillPen(f) + rangePenalty(rngD(f.h, h, Math.max(1, d)) + spdOf(h === m.h ? m.steps || 0 : hexDist(m.h, h))) + m.u.sm - (m.prone && elevAt(f.h) - elevAt(h) < 1 ? 2 : 0) + Math.min(2, rw.acc || 0) - covPenAt(h, f.h, m) - (f.h ? ownCoverPen(f, h, false) : 0);
          const def = mode === "aoa" ? null : m.u.dodge + (mode === "aod" ? 2 : 0) + m.u.db - (m.prone ? 3 : 0);
          best = Math.max(best, expInjRandom(rw, m.u) * burstHits(lvl, rw.rof || 1, rw) * (1 - (def == null ? 0 : P3[cl(def)])) * (covered(m, f) ? 1 - pinOf(f) : 1));
        }
        tot += best * share;
      }
      return tot + grenadeRisk(m, h, near);
    }
    // grenades (B414): the worst a foe with a grenade left, and a throw that reaches h, can do to m there with one
    // landing a yard or two away, weighted by how tempting a target the spot is (the more of us within 2 yards, the
    // likelier the throw). Cover from the thrower, kneeling and lying all cut the fragments that land (B414, B551)
    function grenadeRisk(m, h, near) {
      let worst = 0;
      const crowd = models.filter(x => x !== m && x.u.side === m.u.side && x.state === "ok" && x.h && hexDist(x.h, h) <= 2).length;
      const low = m.prone || m.kneel;
      for (const f of near) {
        if (!f.u.grenades.length || f.grips.length || f.armsLost >= 1) continue;
        const d = hexDist(f.h, h);
        f.u.grenades.forEach((g, i) => {
          if (!f.grenadesLeft[i] || d < 3 || d > g.range.max || !los(f.h, h)) return;
          const k = coverAt(h, f.h, m);
          let hid = 0;
          for (const [l, n] of RANDOM_LOCS) hid += n * hideOf(k, l, m, f.h, h) / 216;
          let e = expInj(g, m.u, "area", { ...g.dmg, div: 1, mult: g.dmg.mult / 3, key: "s1nd" });
          const fr = g.dmg.frag;
          if (fr) {
            let nF = 0;
            for (let j = 15 + rangePenalty(2) + m.u.sm - (low ? 2 : 0); j >= 3; j -= 3) nF += P3[Math.min(18, j)];
            e += nF * (1 - hid) * expInjRandom(g, m.u, { n: fr.n, add: 0, mult: 1, div: 1, type: fr.type, key: "f" });
          }
          const pHit = P3[cl(g.level - skillPen(f) + rangePenalty(d))];
          worst = Math.max(worst, e * pHit * Math.min(1, 0.15 + 0.25 * crowd));
        });
      }
      return worst;
    }
    // cost of standing on hex h in that posture: chance of being put down x what I'd do over the next turns
    function risk(m, h, mode) {
      const inc = incoming(m, h, mode);
      return m.u.ai.caution * Math.min(1, inc / remOf(m)) * threatOf(m) * HORIZON;
    }
    const stanceW = (m, kind) => {
      const s = m.u.stance, a = m.u.ai;
      if (kind === "melee") return a.melee * (s === "charge" ? 1.6 : s === "shoot" ? 0.8 : 1);
      return a.ranged * (s === "shoot" ? 1.2 : s === "charge" ? 0.6 : 1);
    };
    // how many squad-mates already have this foe in their sights (for spreading fire)
    const claims = (m, f) => models.reduce((a, x) => a + (x !== m && x.u.side === m.u.side && x.state === "ok" && x.aimTarget === f ? 1 : 0), 0);
    // sustained harm of a gun: turns firing a magazine vs turns reloading it
    function sustainOf(w) {
      if (!w.shots || w.shots.mag === Infinity) return 1;
      const fire = w.shots.mag / Math.max(1, Math.min(3, w.rof || 1));
      return fire / (fire + w.shots.reload);
    }
    // best shot value a model could take from hex h next turn (for comparing positions)
    function shotValueFrom(m, h, pool) {
      let best = 0;
      for (const w of weaponsFor(m, false)) for (const t of pool.slice(0, 6)) {
        if (!t.h || !los(h, t.h)) continue;
        const d = Math.max(1, hexDist(h, t.h));
        if (d > w.range.max) continue;
        const E = planAttack(m, w, t, wl(m, w) - skillPen(m) + rangePenalty(rngD(h, t.h, d) + spdOf(t.steps || 0)) + t.u.sm - darkPen(m, t) - COVER_OWN[coverAt(h, t.h, null)] - linePen(m, between(h, t.h, m.u.side).filter(x => x !== t && x !== m)), false, null, { fx: shotFx(t, h, false) }).score * sustainOf(w);
        best = Math.max(best, kv(m, t, E));
      }
      return best * stanceW(m, "ranged") * m.u.ai.aggression;
    }

    // nobody known: head for where a foe was last seen, or else for the far side's staging bay, and look; a unit that
    // holds (shooting stance) or lies in ambush stays put and waits
    function search(m) {
      // a holding unit waits 10 quiet seconds before it goes looking, an ambush a minute
      const quiet = turn - contact[m.u.side];
      if ((m.u.ambush && !m.u.sprung && quiet < 60) || (m.u.stance === "shoot" && quiet < 10)) return;
      let goal = null, best = -99;
      for (const [f, t] of seenAt[m.u.side]) if (t > best && f.state === "ok" && f.lastSeenH) { best = t; goal = f.lastSeenH; }
      if (!goal || hexDist(goal, m.h) <= 1) {
        // then the far staging bay, then sweep the facility room by room (a random walkable hex at a time)
        if (!m.searchGoal) m.searchGoal = terr.spawn[1 - m.u.side];
        while (hexDist(m.searchGoal, m.h) <= 2) { const i = Math.floor(R() * terr.hx.length); if (pass[i]) m.searchGoal = terr.hx[i]; }
        goal = m.searchGoal;
      }
      const n = stepToward(m, goal, runMove(m), 1);
      if (n) { L(`${m.id} searches ahead`); if (n >= moveOf(m) - 1) m.runK = m.runPrev + 1; }
    }
    function act(m) {
      const u = m.u, A = u.ai;
      m.aoa = false; m.aod = false; m.mna = false; m.offBalance = false; m.readied = false; m.steps = 0; m.moved = false; m.movedFar = false;
      m.runPrev = m.runK || 0; m.runK = 0;   // a sprint carries on only through consecutive straight Moves
      if (m.feint && m.feint.turn !== turn - 1) m.feint = null;   // a feint lapses if not used the next turn (B365)
      clearZone(m); m.waiting = null; m.watch = false; m.ducked = false; m.waitOpen = null;
      if (m.doNothing) { m.doNothing = false; L(`${m.id} reels from the blow (Do Nothing)`); return; }
      if (m.surprised) { m.surprised = false; L(`${m.id} is caught by surprise`); return; }
      if (m.skipNext) { m.skipNext = false; L(`${m.id} already acted this second (${m.skipWhy || "it saw the foe first"})`); m.skipWhy = null; return; }
      if (m.blockLost) { m.blockLost = false; L(`${m.id} recovers its shield (Ready)`); return; }
      // working on a jammed or misfired gun: Readies, then a roll that clears it or starts another attempt
      if (m.jam > 0 && !engaged(m) && u.ranged) {
        m.jam--;
        if (m.jam > 0) { L(`${m.id} works on its ${u.ranged.name}`); return; }
        if (check(m.jamSkill - skillPen(m)).ok) L(`${m.id} clears its ${u.ranged.name}`);
        else { m.jam = 3; L(`${m.id} fails to clear its ${u.ranged.name}`); }
        return;
      }
      const pool = known(m).filter(f => f.h).sort((a, b) => walk(m.h, a.h) - walk(m.h, b.h));
      if (!pool.length) { if (AWARE) search(m); return; }
      const adj = pool.filter(f => hexDist(f.h, m.h) <= u.melee.reachMax && los(m.h, f.h) && levelOK(m.h, u, f.h, f.u, u.melee));
      const shooter = u.ranged || u.powers.some(p => !p.melee);
      // stand up (Change Posture) unless a shooter holding its ground is better off prone
      // a firing line (house rule on B364/B551: kneeling to or from standing is the step of a maneuver): a shooter
      // holding its ground with friends behind it kneels to fire, so they shoot over it; it rises when a foe closes
      // to 3 yards, when it moves (afterStep) or when its squad charges
      // kneeling to standing is the step of a maneuver (B364): it rises and acts, but can't also move
      let rose = false;
      if (m.kneel && !m.prone && !m.kneelVol) { m.kneel = false; rose = true; L(`${m.id} stands up`); }
      if (m.prone && !m.legsLost && !gripsOn(m).length && (adj.length || u.stance !== "shoot" || !shooter)) {
        // lying to standing is two Change Postures, through kneeling (-2 to attack and defend); a successful
        // Acrobatics roll makes it one (B551)
        m.prone = false;
        const acro = (u.stats.skills || []).find(s => s.name === "Acrobatics" && s.level != null);
        if (acro && check(acro.level - 6 - (u.stats.enc || 0) - skillPen(m)).ok) { L(`${m.id} springs to its feet (Acrobatics -6, MA98)`); return; }
        m.kneel = true; L(`${m.id} gets up to a kneel`); return;
      }
      // a model working a hold keeps at it: takedown, then pin; two pinners are enough, the rest go back to hacking
      if (m.holding) {
        const t = m.holding;
        if (t.state === "ok" && t.h && hexDist(m.h, t.h) <= 1) {
          if (!t.pinned) { wrestle(m, t); return; }
          if (t.grips.filter(g => g !== m).length >= 2) release(m);
          else {
            // pin and stab (house rule): one hand keeps the pin (it then counts one-handed, B371) while the other drives
            // a combat knife into a chink the helpless foe can't defend
            if (u.knife && m.armsLost < 1) { if (!m.knifeOut) drawKnife(m, t); else { faceTo(m, t.h); strike(m, u.knife, t, {}); } }
            return;
          }
        } else release(m);
      }
      const opts = [];
      const add = (v, label, run) => { if (Number.isFinite(v)) opts.push({ v, label, run }); };
      const here = m.h, rNow = risk(m, here, ""), mw = weaponsFor(m, true);
      if (m.onFire) {
        // what burning on for another five seconds or so would cost it, against the chance this attempt ends it
        const a = areaDR(u), dm = m.fireDmg || FIRE[m.onFire], per = Math.max(1, (dm.n * 3.5 + dm.add) * dm.mult - (a.arm + a.nat));
        const loss = u.ai.caution * Math.min(1, per * 5 / remOf(m)) * threatOf(m) * HORIZON;
        add(P3[cl(u.dx - skillPen(m))] * loss / (m.onFire === 2 ? 3 : 1) - rNow, "beat-flames", () => beatFlames(m));
      }
      // evasive movement toward the gunman that worries it most (Tactical Dodging option)
      if (TDODGE) m.evading = pool.filter(f => f.u.ranged && f.h && los(f.h, m.h)).sort((a, b) => threatOf(b) / Math.max(1, hexDist(b.h, m.h)) - threatOf(a) / Math.max(1, hexDist(a.h, m.h)))[0] || null;
      const Wm = stanceW(m, "melee") * A.aggression, Wr = stanceW(m, "ranged") * A.aggression;
      if (u.hooks) hookOptions(m, pool, add, rNow, Wm);
      if (u.sm >= 1 && adj.length && !m.grips.length) trampleOptions(m, adj, add, rNow, Wm);
      if (adj.length) meleeOptions(m, adj, add, rNow, Wm, Wr, mw);
      else {
        rangedOptions(m, pool, add, rNow, Wr);
        if (bladeReady(m)) approachOptions(m, pool, add, Wm);
      }
      // Ready the other weapon (B382): worth what it could do next turn
      // (not straight back to what it just put away: swapping every second is a deadlock, not a plan)
      if ((!u.bothReady || m.inHand !== "both") && !m.grips.length && turn - (m.lastSwitch ?? -99) >= 4) {
        const tmp = [], save = m.inHand, push = v => { if (Number.isFinite(v)) tmp.push(v); };
        if (!bladeReady(m) && u.melee && m.armsLost < 2 && !m.meleeBroken) {
          const keep = u.ranged && u.ranged.semiOne && gunReady(m) && !m.gunBroken && !m.armsLost;
          m.inHand = keep ? "both" : "melee"; m.gunOneHand = keep;
          if (adj.length) meleeOptions(m, adj, push, rNow, Wm, Wr, weaponsFor(m, true)); else approachOptions(m, pool, push, Wm);
          // draw before contact: a foe that can reach us next turn and means to (a charger, a zealot, one with its
          // blade out) is better met blade in hand than with a Ready spent once it's here
          let early = -Infinity;
          if (!adj.length) {
            const t = pool.find(f => f.h && f.state === "ok" && hexDist(f.h, m.h) <= moveOf(f) + (f.u.melee ? f.u.melee.reachMax : 1)
              && (f.u.stance === "charge" || (f.u.ai.zeal || 0) > 0 || (bladeReady(f) && !gunReady(f))));
            if (t) { const e = []; meleeOptions(m, [t], v => { if (Number.isFinite(v)) e.push(v); }, rNow, Wm, Wr, weaponsFor(m, true)); if (e.length) early = GAMMA * 0.7 * Math.max(...e); }
          }
          m.inHand = save; m.gunOneHand = false;
          const best = Math.max(tmp.length ? Math.max(...tmp) : -Infinity, early / GAMMA);
          if (Number.isFinite(best)) add(GAMMA * best - 0.001, early / GAMMA >= (tmp.length ? Math.max(...tmp) : -Infinity) ? `draw-early` : `ready-blade`, () => switchTo(m, "melee"));
        }
        // (both are offered when neither is in hand: a dropped gun is worth picking back up)
        if ((!gunReady(m) || m.gunOneHand) && u.ranged && !m.gunBroken) {
          tmp.length = 0;
          const sp = m.gunSpent, oh = m.gunOneHand;
          m.inHand = "gun"; m.gunSpent = false; m.gunOneHand = false;
          if (adj.length) meleeOptions(m, adj, push, rNow, Wm, Wr, []); else rangedOptions(m, pool, push, rNow, Wr);
          m.inHand = save; m.gunSpent = sp; m.gunOneHand = oh;
          if (tmp.length) add(GAMMA * Math.max(...tmp) - 0.001, `ready-gun`, () => switchTo(m, "gun"));
        }
      }
      // close combat (MA117): a long blade is at -4 a yard of reach there, the knife (reach C) isn't; draw it, and put it
      // away again for the main blade once out of the clinch
      if (u.knife && u.knife !== u.melee && m.armsLost < 2) {
        const tmp = [], push = v => { if (Number.isFinite(v)) tmp.push(v); };
        if (!m.knifeOut && inClose(m) && adj.length) {
          m.knifeOut = true; meleeOptions(m, adj, push, rNow, Wm, Wr, weaponsFor(m, true)); m.knifeOut = false;
          const pFD = u.fdKnife > -Infinity ? P3[cl(u.fdKnife - skillPen(m))] : 0;
          if (tmp.length) add((pFD + (1 - pFD) * GAMMA) * Math.max(...tmp) - 0.001, "draw-knife", () => drawKnife(m, adj[0]));
        } else if (m.knifeOut && !inClose(m)) {
          m.knifeOut = false;
          if (adj.length) meleeOptions(m, adj, push, rNow, Wm, Wr, weaponsFor(m, true)); else approachOptions(m, pool, push, Wm);
          m.knifeOut = true;
          if (tmp.length) add(GAMMA * Math.max(...tmp) - 0.001, "ready-blade", () => { m.knifeOut = false; m.lastSwitch = turn; L(`${m.id} sheathes its knife and takes up the ${u.melee.name.split(",")[0]}`); });
        }
      }
      // a gun fired one-handed beside the blade (B270) is unready until a Ready brings it back on target
      if (m.gunSpent && m.inHand === "both") {
        const tmp = [], push = v => { if (Number.isFinite(v)) tmp.push(v); };
        m.gunSpent = false;
        if (adj.length) meleeOptions(m, adj, push, rNow, Wm, Wr, []); else rangedOptions(m, pool, push, rNow, Wr);
        m.gunSpent = true;
        if (tmp.length) add(GAMMA * Math.max(...tmp) - 0.001, `re-ready-gun`, () => { m.gunSpent = false; L(`${m.id} brings its ${u.ranged.name.split(",")[0]} back to bear`); });
      }
      // a squad leader may spend the turn giving orders (Leadership, B204): worth the Fright Checks it's likely to
      // save among squad-mates in hearing, those already shaken by fire most of all
      if (u.leader && morale && u.group && !m.grips.length) {
        const g = u.group, lv = skillOf(u, /^Leadership/);
        if (lv > -Infinity && !(g.led && g.led.until > turn)) {
          const vox = g.models.some(x => x.u.vox && active(x)), hot = g.models.some(x => x.ev && Object.keys(x.ev).length);
          let v = 0;
          for (const x of g.models) {
            if (x === m || !active(x) || !x.h || x.u.flags.unfazeable || x.u.flags.noMorale || (!vox && hexDist(x.h, m.h) > 20)) continue;
            const l0 = frightLevel(x.u, (g.steeled || 0), Infinity), pc = x.ev && Object.keys(x.ev).length ? 0.8 : hot ? 0.3 : 0.05;
            v += pc * (P3[cl(l0 + 1)] - P3[cl(l0)]) * threatOf(x) * 2.5;
          }
          add(P3[cl(lv - skillPen(m))] * v - rNow, "orders", () => giveOrders(m));
        }
      }
      if (terr && !m.grips.length) { doorOptions(m, pool, add, rNow); if (!adj.length) breachOptions(m, pool, add, rNow, Wm); }
      // a foe holds our gun aside: wrench it free, worth what a free gun would do (else ready the blade, above)
      if (gunGrip(m)) {
        const g = gunGrip(m), gw = u.ranged, pWin = Math.max(0.02, Math.min(0.98, 0.5 + 0.08 * (u.liftST + 2 - g.u.liftST)));
        const E = planAttack(m, gw, g, gw.level + Math.min(0, gw.bulk || 0) - skillPen(m), false).score * sustainOf(gw);
        add(GAMMA * pWin * Wr * kv(m, g, E) - rNow, "wrench-gun", () => wrenchGun(m));
      }
      // held (not pinned): struggle free, worth more on the ground where the hold becomes a pin
      if (gripsOn(m).length) {
        const lead = leadGrip(m), a = u.liftST - skillPen(m), d = gripST(m) + holdBonus(m, lead);
        const pWin = Math.max(0.02, Math.min(0.98, 0.5 + 0.08 * (a - d)));
        add(pWin * (m.prone ? 0.8 : 0.4) * Math.max(rNow, 0.1 * threatOf(m) * HORIZON), "break-free", () => breakFree(m));
      }
      // All-Out Defense (+2 to defences): only against hand-to-hand, a foe beside us or one that can reach us this turn
      // a foe already in reach, or one set on closing (a charger, a zealot, one with its blade out or no gun) that can
      // reach us this turn; a gunman who could walk up but will shoot instead isn't a hand-to-hand threat
      // (a model with a gun ready shoots a charger rather than bracing for it)
      const canShoot = weaponsFor(m, false).some(w => w !== u.ranged || m.ammo > 0 || w.shots.mag === Infinity);
      const meleeThreat = pool.some(f => f.u.melee && expInjRandom(f.u.melee, u) >= 1 && (hexDist(f.h, m.h) <= f.u.melee.reachMax
        || (!canShoot && (f.u.stance === "charge" || (f.u.ai.zeal || 0) > 0 || !f.u.ranged || (bladeReady(f) && !gunReady(f))) && hexDist(f.h, m.h) - f.u.melee.reachMax <= moveOf(f))));
      // it only buys time: worth the risk it saves only as far as squad-mates can use that time to put the threat down
      if (meleeThreat) add(-(rNow - (rNow - risk(m, here, "aod")) * aodHelp(m, pool)), "aod", () => {
        m.aod = true;
        const par = u.parry != null ? u.parry + 1 : -1, blk = u.db ? u.block + 1 : -1, dod = u.dodge + 3;
        m.aodDef = par >= dod && par >= blk ? "parry" : blk >= dod ? "block" : "dodge";
        L(`${m.id} goes on All-Out Defense (+2 ${m.aodDef})`);
      });
      if (u.peel && m.role === "bound" && !adj.length) {
        const hide = hideHex(m, pool);
        if (hide) { const top0 = opts.reduce((a, b) => b.v > a.v ? b : a, { v: 0 }); add(top0.v + 0.3 * Math.max(0.02, Math.abs(top0.v)), "peel", () => { followPath(m, hide.path, moveOf(m)); L(`${m.id} falls back out of sight`); }); }
      }
      // fire and movement: the covering half leans to shooting (and aiming), the bounding half to moving up
      if (m.role && !adj.length && !(pool[0] && hexDist(pool[0].h, m.h) <= 5)) {
        const moveL = /^(advance@|move-closer@|cover@|advance-fire@|close@)/, fireL = /^(fire |aim@|aoa-fire@|suppress|wait@|watch@)/;
        const top0 = opts.reduce((a, b) => b.v > a.v ? b : a, { v: 0 });
        const bonus = 0.3 * Math.max(0.02, Math.abs(top0.v));
        for (const o of opts) if ((m.role === "bound" ? moveL : fireL).test(o.label)) o.v += bonus;
      }
      if (u.team) crewOptions(m, pool, opts, add, rNow, adj);
      // keeping its head down (TS p. 21): only what doesn't expose it: reload, ready, defend, a door, or stay down
      if (m.headsDown && !adj.length) {
        const safe = opts.filter(o => /^(reload|reloading|tac-reload|ready-|re-ready-|draw-early|orders|aod|concentrate|close-door|door)/.test(o.label));
        opts.length = 0; opts.push(...safe);
        add(-rNow * 0.5, "heads-down", () => L(`${m.id} keeps its head down`));
      }
      if (rose) { const still = opts.filter(o => !/^(advance|close|charge|aoa-charge|heroic|move-closer|advance-fire|cover@|peel|reload-cover|step-|ca-flyout|watch)/.test(o.label)); opts.length = 0; opts.push(...still); }
      if (!opts.length) return;
      // pick the best; a disorderly faction picks among the near-best
      const top = opts.reduce((a, b) => b.v > a.v ? b : a);
      let pick = top;
      if (A.noise > 0) {
        const span = Math.max(0.05, Math.abs(top.v)) * A.noise;
        const close = opts.filter(o => o.v >= top.v - span);
        pick = close[Math.floor(R() * close.length)];
      }
      // Battle Rage (B124): berserk on entering combat unless it makes its self-control roll
      if (u.flags.battleRage && !m.rageRolled) { m.rageRolled = true; if (roll3() > u.flags.berserk + ledBonus(m)) goBerserk(m, "battle rage"); }
      pick = mentalPick(m, opts, pick, adj);
      if (globalThis.SIM_DEBUG) globalThis.SIM_DEBUG(m, opts.slice().sort((a, b) => b.v - a.v).slice(0, globalThis.SIM_DEBUG_ALL ? 40 : 6).map(o => `${o.label}=${o.v.toFixed(3)}`).join("  "));
      pick.run();
    }

    // ---- Trampling (B404): a model 2+ SM bigger (1+ against a prone foe) tramples: DX or Brawling (with the relative
    // SM penalty for the bigger striker, Pyramid 3/77 p. 7), dodge only, thrust crushing on its own ST; 3+ SM bigger is
    // large-area injury
    const canTrample = (m, t) => m.u.sm - t.u.sm >= 2 || (m.u.sm - t.u.sm >= 1 && t.prone && !m.prone);
    const brawlOf = u => u._br ?? (u._br = Math.max(u.dx, skillOf(u, /^Brawling/)));
    function trample(m, t) {
      m.attacked = true; faceTo(m, t.h); reveal(m);
      const lvl = brawlOf(m.u) - skillPen(m) + smMelee(m, t) - darkPen(m, t), r = check(lvl);
      if (!r.ok) { L(`${m.id} tries to trample ${t.id} (skill ${lvl}): misses`); return; }
      if (!r.crit && defend(t, m, true, 0, 0, { ...UNARMED, weight: m.u.st * m.u.st / 10, huge: true })) { L(`${m.id} tries to trample ${t.id}: dodged`); return; }
      L(`${m.id} tramples ${t.id}`);
      m.landed = t;
      applyHit(m, { dmg: m.u.thrCr, follow: null }, t, m.u.sm - t.u.sm >= 3 ? "area" : hitLocOn(t), false, false, m.u.thrCr);
    }
    function trampleOptions(m, adj, add, rNow, Wm) {
      for (const t of adj) {
        if (!t.h || hexDist(m.h, t.h) > 1 || !canTrample(m, t)) continue;
        const lvl = brawlOf(m.u) - skillPen(m) + smMelee(m, t), dd = dodgeOf(t) - (t.prone ? 3 : 0);
        const E = P3[cl(lvl)] * (1 - P3[cl(dd)]) * expInj({ id: "trample" + m.u.idx, dmg: m.u.thrCr, follow: null }, t.u, m.u.sm - t.u.sm >= 3 ? "area" : "torso");
        add(Wm * kv(m, t, E) - rNow, `trample@${t.id}`, () => trample(m, t));
      }
    }
    // ---- Flesh Hooks: strike with the hooks; on a hit, a free grapple (no defence: the hooks already hold) that drags the
    // victim beside the bearer; an Extra Attack then goes into it with the claws
    function hookStrike(m, f) {
      const u = m.u;
      faceTo(m, f.h); m.landed = null;
      L(`${m.id} lashes its flesh hooks at ${f.id}`);
      strike(m, u.hooks, f, { blows: 1 });
      if (m.landed !== f || f.state !== "ok" || !f.h || m.state !== "ok" || !m.h) return;
      const g = check(u.grapple - skillPen(m) + smGrab(m, f) + 2 * (u.flags.extraArms || 0));
      if (!g.ok) { L(`  the hooks tear free of ${f.id}`); return; }
      release(m); m.holding = f; f.grips.push(m);
      if (hexDist(m.h, f.h) > 1) {
        const h = DIRS.map(([dq, dr]) => ({ q: m.h.q + dq, r: m.h.r + dr })).filter(h => !taken(key(h.q, h.r)) && (!terr || walkable(key(h.q, h.r)))).sort((a, b) => hexDist(a, f.h) - hexDist(b, f.h))[0];
        if (h) place(f, h);
      }
      L(`  the hooks drag ${f.id} in`);
      if ((u.flags.extraAttack || 0) > 0 && f.state === "ok" && f.h && hexDist(m.h, f.h) <= u.melee.reachMax) strike(m, u.melee, f, { blows: u.flags.extraAttack });
    }
    function hookOptions(m, pool, add, rNow, Wm) {
      const u = m.u, w = u.hooks;
      if (!w || m.grips.length || m.holding || m.armsLost >= 1) return;
      for (const f of pool) {
        if (!f.h || hexDist(m.h, f.h) > w.reachMax || !los(m.h, f.h) || f.grips.includes(m)) continue;
        const lvl = wl(m, w) - skillPen(m) + smMelee(m, f) - darkPen(m, f), def = bestDefence(f, m, true, w);
        const pHit = P3[cl(lvl)] * (1 - (def == null ? 0 : P3[cl(def)])), pGrab = P3[cl(u.grapple - skillPen(m) + smGrab(m, f))];
        const eC = expInjRandom(u.melee, f.u);
        // what the hook does, the claws that follow it, and the held victim's lost defences next turn
        const E = pHit * (expInjRandom(w, f.u) + pGrab * ((u.flags.extraAttack || 0) * eC + 0.5 * eC));
        add(Wm * kv(m, f, E) - rNow, `hook@${f.id}`, () => hookStrike(m, f));
      }
    }
    // ---- mental disadvantages steer the choice (B120 self-control rolls)
    const AGGR = /^(aoa|charge|strike|step-|rapid|flurry|mighty|dual|heroic|ca-|da-strike|beat|feint|ruse|grab|shove|fire |point-blank|advance|close@|move-closer|throw|suppress)/;
    const CAUTIOUS = /^(aod|peel|reload-cover|cover@|wait|watch|spread)/;
    const DANGER = /^(charge|aoa-charge|heroic|advance|close@|move-closer|step-|grab)/;
    const bestOf = (opts, re, not) => opts.filter(o => re.test(o.label) && !(not && not.test(o.label))).reduce((a, b) => !a || b.v > a.v ? b : a, null);
    function mentalPick(m, opts, pick, adj) {
      const f = m.u.flags;
      // berserk: All-Out Attack anything in reach; else close on the nearest foe (Move and Attack, a charge or a
      // slam if it can); else blaze away with its gun, never aiming
      if (m.berserk) { const b = (adj.length ? bestOf(opts, /^(aoa|step-aoa)/) : bestOf(opts, /^(aoa-charge|charge|heroic|close@|advance|move-closer|step-)/)) || bestOf(opts, /^(aoa-fire|fire |point-blank)/); if (b) return b; }
      // Cowardice (B129): before closing with the enemy, a self-control roll (-5 if hurt badly enough to die); being
      // in melee already is greater danger, so it fights back
      if (f.coward && !adj.length && DANGER.test(pick.label) && roll3() > f.coward + ledBonus(m) - (m.hp < m.u.HP / 3 ? 5 : 0)) {
        const s = opts.filter(o => !DANGER.test(o.label)).reduce((a, b) => !a || b.v > a.v ? b : a, null);
        if (s) { L(`${m.id} hangs back (Cowardice)`); return s; }
      }
      // Overconfidence (B148): caution needs a self-control roll; failing, it takes the best bold option
      if (f.overconf && CAUTIOUS.test(pick.label) && roll3() > f.overconf) { const a = bestOf(opts, AGGR); if (a) { L(`${m.id} scorns caution (Overconfidence)`); return a; } }
      // Impulsiveness (B139): waiting, holding in cover or aiming a second time needs a self-control roll
      if (f.impulsive && (/^(wait|watch|cover@)/.test(pick.label) || (/^aim@/.test(pick.label) && m.aimTurns >= 1)) && roll3() > f.impulsive) { const a = bestOf(opts, AGGR); if (a) { L(`${m.id} can't wait (Impulsiveness)`); return a; } }
      return pick;
    }
    // the chance an Aim lasts to the model's next turn: an active defence spoils it (B364). A foe in reach, or one that
    // will charge into reach, almost surely forces one; a gunman in range does if it picks this model and hits.
    // Worked out once per model per turn
    const keepC = new Map(); let keepTurn = -1;
    function aimKeep(m) {
      if (keepTurn !== turn) { keepC.clear(); keepTurn = turn; }
      if (keepC.has(m)) return keepC.get(m);
      let p = 1;
      for (const f of models) {
        if (f.u.side === m.u.side || f.state !== "ok" || !f.h || !m.h || f.pinned) continue;
        // a stunned foe may shake it off and come on this very turn: half the threat
        const d = hexDist(f.h, m.h), reach = f.u.melee ? f.u.melee.reachMax : 1, half = x => f.stunned ? 1 - (1 - x) / 2 : x;
        if (d <= reach) { p *= half(0.3); continue; }
        const closer = f.u.melee && (f.u.stance === "charge" || (f.u.ai.zeal || 0) > 0 || bladeReady(f)) && d <= moveOf(f) + reach;
        if (closer) { p *= half(0.5); continue; }
        if (f.u.ranged && d <= f.u.ranged.range.max && los(f.h, m.h)) {
          const mine = models.filter(x => x.u.side === m.u.side && x.state === "ok" && x.h && hexDist(f.h, x.h) <= f.u.ranged.range.max).length;
          p *= 1 - 0.5 / Math.max(1, mine);
        }
      }
      keepC.set(m, p); return p;
    }
    // ---- pop-up attacks (B390): an Attack in which the shooter comes out of cover, fires and goes back into it in one
    // turn, at -2 (it couldn't see the target when its turn began; none for Gunslinger) and with no Aim. Firearms and
    // thrown weapons only. Two kinds: round a corner (a step to a hex that sees a known foe, the shot, the step back),
    // and up out of a trench (rising over the cover in front, firing, ducking down again). Only a foe holding a Wait on
    // that spot can shoot it while it's out; ducked behind its cover till its next turn, a foe the cover screens from
    // can't target it at all
    const DUCK = new Set(["crate", "barricade", "parapet", "crest", "light", "heavy"]);
    const popPen = m => m.u.flags.gunslinger ? 0 : 2;
    const popW = w => w.range && !w.malediction && !w.fp && !w.cone && w.usage !== "power";
    // fire from foes holding a Wait (watch) on hex n: what stepping or rising into their sights costs m
    function waitRisk(m, n) {
      let inc = 0;
      for (const f of models) {
        if (f.u.side === m.u.side || f.state !== "ok" || !f.h || !f.watch || f.waiting !== f.u.ranged || f.stunned) continue;
        const rw = f.u.ranged, d = hexDist(f.h, n);
        if (d > rw.range.max || !los(f.h, n)) continue;
        const lvl = rw.level - skillPen(f) + rangePenalty(rngD(f.h, n, Math.max(1, d))) + m.u.sm;
        inc += expInjRandom(rw, m.u) * burstHits(lvl, rw.rof || 1, rw) * (1 - P3[cl(m.u.dodge + m.u.db)]);
      }
      return m.u.ai.caution * Math.min(1, inc / remOf(m)) * threatOf(m) * HORIZON;
    }
    // watchers fire as m comes into view (its rising out of cover; a step is handled by afterStep)
    function popWaits(m) {
      for (const f of models) {
        if (m.state !== "ok" || m.stunned) return;
        if (!f.waiting || !f.watch || f.state !== "ok" || !f.h || f.u.side === m.u.side || f.stunned) continue;
        if (!los(f.h, m.h) || hexDist(f.h, m.h) > f.waiting.range.max) continue;
        const w = f.waiting; f.waiting = null; f.watch = false;
        if (w === f.u.ranged && gunGrip(f)) continue;
        L(`${f.id} was waiting for ${m.id} to show itself (Wait)`);
        fireAt(f, w, m, { pointBlank: hexDist(f.h, m.h) <= 1 });
      }
    }
    function popUpOptions(m, pool, cands, ws, add, rNow, Wr) {
      const u = m.u;
      if (m.grips.length) return;
      const usable = ws.filter(w => popW(w) && (w !== u.ranged || (m.ammo > 0 && m.reload <= 0 && !m.jam && !m.gunBroken && gunReady(m))));
      if (!usable.length) return;
      const shotAt = (from, t, w) => {
        const d = Math.max(1, hexDist(from, t.h));
        if (d > w.range.max) return 0;
        const lvl = wl(m, w) - skillPen(m) + rangePenalty(rngD(from, t.h, d) + spdOf(t.steps || 0)) + t.u.sm - popPen(m) - darkPen(m, t) - linePen(m, between(from, t.h, u.side).filter(x => x !== t && x !== m));
        return planAttack(m, w, t, lvl, false, null, { fx: shotFx(t, from, false) }).score * sustainOf(w);
      };
      // up out of a trench: a foe in sight that m's cover screens it from
      for (const t of cands.slice(0, 4)) {
        const k = coverAt(m.h, t.h, m);
        if (!DUCK.has(k) || !covPenAt(m.h, t.h, m)) continue;
        for (const w of usable) {
          const E = shotAt(m.h, t, w);
          if (E <= 0) continue;
          add(Wr * kv(m, t, E) - risk(m, m.h, "duck") - waitRisk(m, m.h), `popup-trench@${t.id}`, () => {
            L(`${m.id} rises out of cover to fire at ${t.id} (pop-up attack)`);
            popWaits(m); if (m.state !== "ok" || m.stunned || !t.h) return;
            m.aimTurns = 0; m.follow = null; faceTo(m, t.h);
            fireAt(m, w, t, { pen: popPen(m), popup: true });
            if (m.state === "ok" && m.h) { m.ducked = true; L(`  ${m.id} ducks back down`); }
          });
        }
      }
      // round a corner: nobody in sight from here, a known foe in sight from the next hex
      if (!terr || cands.length || m.u.stance === "charge") return;
      const ci = idx(key(m.h.q, m.h.r));
      for (const [dq, dr] of DIRS) {
        const n = { q: m.h.q + dq, r: m.h.r + dr }, nk = key(n.q, n.r);
        if (taken(nk) || !walkable(nk) || (EL && climb(ci, idx(nk), climbCls(m)) > 0)) continue;
        let best = null;
        for (const t of pool.slice(0, 6)) {
          if (!t.h || !los(n, t.h) || duckedFrom(t, n)) continue;
          for (const w of usable) { const E = shotAt(n, t, w); if (E > 0 && (!best || E * kv(m, t, 1) > best.v)) best = { t, w, E, v: E * kv(m, t, 1) }; }
        }
        if (!best) continue;
        const { t, w, E } = best;
        add(Wr * kv(m, t, E) - rNow - waitRisk(m, n), `popup@${t.id}`, () => {
          const h0 = m.h;
          L(`${m.id} steps out of cover to fire at ${t.id} (pop-up attack)`);
          m.popping = true; place(m, n); afterStep(m); m.popping = false;
          if (m.state === "ok" && m.h && !m.stunned && t.h && t.state === "ok") { m.aimTurns = 0; m.follow = null; faceTo(m, t.h); fireAt(m, w, t, { pen: popPen(m) }); }
          if (m.state === "ok" && m.h && !m.grips.length && !taken(key(h0.q, h0.r))) { place(m, h0); L(`  ${m.id} steps back into cover`); }
        });
      }
    }
    // a model ducked behind its cover after a pop-up: no foe the cover screens it from can draw a bead on it
    function duckedFrom(t, fh) {
      if (!t.ducked || !t.h || !fh) return false;
      const k = coverAt(t.h, fh, t);
      return DUCK.has(k) && covPenAt(t.h, fh, t) > 0;
    }
    // ---- the heavy weapon team's choices, laid over the ordinary ones
    const MOVES = /^(advance|move-closer|cover@|high-ground|close@|charge|aoa-charge|heroic|advance-fire|spread@|peel|reload-cover|step-|popup@|search|rejoin)/;
    const targetsFor = (m, w, h = m.h) => known(m).filter(f => f.h && f.state === "ok" && hexDist(h, f.h) <= w.range.max && hexDist(h, f.h) >= (w.minRange || 0) && (w.indirect ? spotted(m, f) : los(h, f.h)));
    function crewOptions(m, pool, opts, add, rNow, adj) {
      const u = m.u, top = () => opts.reduce((a, b) => b.v > a.v ? b : a, { v: 0 }), force = (label, run) => { const t0 = top(); add(t0.v + 0.5 * Math.max(0.05, Math.abs(t0.v)), label, run); };
      const w = u.ranged;
      // setting up or packing up takes several seconds of Ready; once begun it's carried through
      if (m.setupT > 0) {
        opts.length = 0;
        add(0, "setting-up", () => {
          if (--m.setupT <= 0) { m.setUp = m.setupTo === "up"; L(`${m.id} ${m.setUp ? "has the " + w.name + " set up" : "has the " + w.name + " packed to move"}`); }
          else L(`${m.id} keeps ${m.setupTo === "up" ? "setting up" : "packing up"} the ${w.name}`);
        });
        return;
      }
      if (u.crew === "gunner" && w && w.needsSetup && !adj.length) {
        const have = targetsFor(m, w).length > 0;
        m.idle = have ? 0 : (m.idle || 0) + 1;
        if (m.setUp) {
          // dug in: it fires from here; after ten quiet seconds with nothing in range it packs up to find a new spot
          for (let i = opts.length - 1; i >= 0; i--) if (MOVES.test(opts[i].label)) opts.splice(i, 1);
          if (m.idle >= 10) force("pack-up", () => { m.setupTo = "down"; m.setupT = setupTime(m) - 1; L(`${m.id} starts packing up the ${w.name} to move`); });
        } else if (have) {
          // something to shoot: set the gun up here
          force("set-up", () => { m.setupTo = "up"; m.setupT = setupTime(m) - 1; L(`${m.id} starts setting up the ${w.name}`); });
        }
      }
      if (u.crew === "loader") {
        const g = teamMates(m).find(x => x.u.crew === "gunner");
        if (g && g.state === "ok" && g.h) {
          // with the gun: stay beside it, go where it goes
          if (hexDist(m.h, g.h) > 1) force(`rejoin@${g.id}`, () => { stepToward(m, g.h, moveOf(m), 1); L(`${m.id} keeps up with ${g.id}`); });
          else if (g.setUp || g.setupT > 0) for (let i = opts.length - 1; i >= 0; i--) if (MOVES.test(opts[i].label)) opts.splice(i, 1);
        } else if (g && u.heavy && !m.tookOver && (g.lastH || g.h) && hexDist(m.h, g.lastH || g.h) <= 2 && !adj.length) {
          // the gunner is down: the loader takes the gun (two seconds to get behind it)
          force("take-over", () => {
            m.takeT = (m.takeT || 0) + 1;
            if (m.takeT < 2) { L(`${m.id} drags ${g.id} off the ${u.heavy.name}`); return; }
            m.tookOver = true; u.ranged = u.heavy; u.crew = "gunner";
            m.ammo = g.ammo > 0 ? g.ammo : 0; m.mags = Math.max(0, g.mags ?? 0); m.reload = 0; m.jam = 0; m.gunBroken = !!g.gunBroken; m.inHand = "gun";
            m.setUp = !!(u.ranged.needsSetup && g.setUp); m.idle = 0;
            L(`${m.id} takes over the ${u.heavy.name}`);
          });
        }
      }
    }
    // indirect fire (mortars): at a foe someone on its side can see (the shooter, or a spotter) within range and outside
    // the minimum. Attacking a hex is +4 (B414); without its own line of sight -2 (house rule: the spotter's
    // corrections); no defence (anyone there may dive for cover); a miss lands its margin in yards off, at most half
    // the distance, as a thrown grenade's does
    const spotted = (m, f) => !AWARE || models.some(x => x.u.side === m.u.side && x.state === "ok" && x.h && !x.stunned && los(x.h, f.h) && hexDist(x.h, f.h) <= 120);
    function indirectOptions(m, w, add, rNow, Wr) {
      for (const t of targetsFor(m, w).slice(0, 6)) {
        const d = hexDist(m.h, t.h), own = los(m.h, t.h);
        const lvl = wl(m, w) - skillPen(m) + rangePenalty(d) + 4 + (own ? 0 : -2) + Math.min(2, w.acc || 0);
        const crowd = models.filter(x => x !== t && x.state === "ok" && x.h && x.u.side !== m.u.side && hexDist(x.h, t.h) <= 2).length;
        const E = P3[cl(lvl)] * expInjRandom(w, t.u) * (1 + 0.5 * crowd);
        add(Wr * kv(m, t, E) - rNow, `indirect@${t.id}`, () => lobShell(m, w, t, lvl, own));
      }
    }
    function lobShell(m, w, t, lvl, own) {
      if (!t.h) return;
      reveal(m, w); m.attacked = true; m.aimTurns = 0;
      if (w.shots.mag !== Infinity) m.ammo--;
      const r = lvl < 3 ? { ok: false, margin: lvl - 10 } : check(lvl), raw = rollDamage(w.dmg);
      const d = hexDist(m.h, t.h), off = r.ok ? 0 : Math.max(1, Math.min(Math.ceil(d / 2), -r.margin)), at = off ? scatter(t.h, off) : t.h;
      L(`${m.id} fires the ${w.name} at ${t.id}'s position (${d} yd${own ? "" : ", called in by a spotter"}, skill ${lvl})${off ? `: ${off} yd off` : ": on target"}`);
      FX(["s", m.h.q, m.h.r, at.q, at.r, m.u.side, r.ok ? 1 : 0, m.ix, t.ix, lvl, r.ok ? 1 : 0, 0]);
      explosion(m, w, at, raw);
    }
    // a foe that can hardly defend against a shot just now: stunned, down, exhausted, All-Out Attacking, held
    const openFor = (t, m) => { if (t.state !== "ok" || !t.h) return false; const dd = rangedDefence(t, m); return dd == null || P3[cl(dd)] <= 0.375; };
    // a gun holding for an opening fires the moment its foe shows one (the Wait's trigger, B366), spending its next turn
    function seizeOpenings() {
      for (const x of models) {
        const o = x.waitOpen;
        if (!o || x.state !== "ok" || !x.h || x.stunned) continue;
        const t = o.t;
        if (t.state !== "ok" || !t.h) { x.waitOpen = null; continue; }
        if (!openFor(t, x) || !los(x.h, t.h) || duckedFrom(t, x.h) || !weaponsFor(x, false).includes(o.w) || (o.w === x.u.ranged && x.ammo <= 0)) continue;
        x.waitOpen = null;
        L(`${x.id} sees ${t.id} falter and fires (Wait)`);
        fireAt(x, o.w, t, { aim: x.aimTarget === t && x.aimTurns > 0 });
        x.skipNext = true; x.skipWhy = "it fired on its Wait";
      }
    }
    // ---- options at range: shoot (each weapon and target), aim, Move and Attack, suppression, grenades, Wait, reload
    function rangedOptions(m, pool, add, rNow, Wr) {
      const u = m.u;
      const cands = pool.filter(t => los(m.h, t.h) && !duckedFrom(t, m.h)).slice(0, 6);
      if (cands.length) m.watchN = 0;
      const ws = weaponsFor(m, false).filter(w => !(w === u.ranged && w.natural && m.ammo <= 0 && w.shots.reload > 3));
      if (ws.length && !m.headsDown) popUpOptions(m, pool, cands, ws, add, rNow, Wr);
      if (terr && ws.length) {
        // nobody in sight: work toward the nearest foe on foot
        const t = pool[0];
        if (!cands.length && t) {
          const h2 = stepHex(m.h, t.h, runMove(m));
          add(GAMMA * shotValueFrom(m, h2, pool) - risk(m, h2, "") + 0.001, `advance@${t.id}`, () => {
            if (stepToward(m, t.h, runMove(m), 1) >= moveOf(m) - 1) m.runK = m.runPrev + 1; if (m.state !== "ok" || !m.h) return; if (t.h) faceTo(m, t.h); L(`${m.id} advances toward ${t.id}`);
          });
        }
        coverOptions(m, pool, add);
        if (EL && u.stance !== "charge") highGroundOptions(m, pool, add);
      }
      spreadOptions(m, pool, add);
      const threatNow = threatTo(m);
      // corners and doorways (TS p. 23-24): with no foe in sight but one close enough to come round the corner or
      // through the door, hold a Wait for the first to appear rather than walk into it; not for zealots or chargers
      if (terr && !cands.length && pool[0] && ws.length && !m.waiting && u.stance !== "charge" && !((u.ai.zeal || 0) > 0)) {
        const t = pool[0], w = ws[0], wd = walk(m.h, t.h);
        // only for a foe that means to come on (not one holding, waiting or falling back itself: two sides watching
        // each other's doors would never meet), and not for ever: after three quiet seconds, go and look
        const coming = t.u.stance !== "shoot" && !t.u.peel && !t.waiting && !t.aod;
        if (coming && (m.watchN || 0) < 3 && wd <= moveOf(t) * 2 + 2 && (w !== u.ranged || m.ammo > 0 || w.shots.mag === Infinity)) {
          const E = planAttack(m, w, t, wl(m, w) - skillPen(m) + rangePenalty(Math.max(1, Math.min(wd, 10))) + t.u.sm, false).score;
          const comes = t.u.stance === "shoot" ? 0.3 : 0.6;
          add(GAMMA * comes * Wr * kv(m, t, E) + comes * 0.2 * threatOf(m) * u.ai.caution - rNow, `watch@${t.id}`, () => { m.waiting = w; m.watch = true; m.watchN = (m.watchN || 0) + 1; L(`${m.id} covers the approach (Wait)`); });
        }
      }
      // through a wall or a shut door (TS p. 28, B408): a foe seen a moment ago on the far side of one partition can be
      // shot through it, at random hit location, with the structure's DR on top of its own; the partition takes the hits
      if (terr && AWARE) for (const t of pool.slice(0, 6)) {
        if (!t.h || los(m.h, t.h) || (seenAt[u.side].get(t) ?? -99) < turn - 1) continue;
        const d = hexDist(m.h, t.h), line = lineHexes(m.h, t.h).map(h => idx(key(h.q, h.r))).filter(i => i != null && blocker(i));
        if (line.length !== 1) continue;
        const i = line[0], st = structOf(i) || STRUCT.door;
        for (const w of ws) {
          const isGun = w === u.ranged;
          if (w.malediction || w.cone || d > w.range.max || (isGun && (m.ammo <= 0 || m.reload > 0))) continue;
          const dm = w.dmg, sDR = dm.div === Infinity ? 0 : Math.floor(st.dr / (dm.div || 1));
          const dO = { ...dm, add: dm.add - sDR / (dm.mult || 1), key: (dm.key || "") + "thru" + sDR };
          const lvl = wl(m, w) - skillPen(m) + rangePenalty(d) + t.u.sm;
          const E = burstHits(lvl, w.rof || 1, w) * expInjRandom(w, t.u, dO) * sustainOf(w);
          if (E > 0.05 * remOf(t)) add(Wr * kv(m, t, E) - rNow, `fire-through@${t.id}`, () => fireThrough(m, w, t, i, lvl));
        }
      }
      // reloads (TS p. 20): top up a part-used magazine while nobody can see us; when empty under fire, step out of
      // sight first if there's somewhere within a move
      if (u.ranged && !m.gunBroken && m.reload === 0 && m.mags > 0 && u.ranged.shots.mag !== Infinity && m.ammo < u.ranged.shots.mag && u.ranged.shots.reload > 0 && u.ranged.shots.reload <= 3) {
        const w = u.ranged, turns = reloadTime(m, w);
        if (!cands.length && m.ammo > 0 && m.ammo < w.shots.mag * 0.6)
          add(Math.pow(GAMMA, turns) * 0.5 * shotValueFrom(m, m.h, pool) - rNow + 0.002 * (1 - m.ammo / w.shots.mag), "tac-reload", () => { m.reload = turns; L(`${m.id} tops up its magazine`); });
        if (terr && cands.length && m.ammo <= 0) {
          const hide = hideHex(m, pool);
          if (hide) add(Math.pow(GAMMA, turns + 1) * shotValueFrom(m, m.h, pool) - risk(m, hide.h, ""), "reload-cover", () => { followPath(m, hide.path, moveOf(m)); L(`${m.id} steps out of sight to reload`); });
        }
      }
      for (const w of ws) {
        const isGun = w === u.ranged;
        if (isGun && m.reload > 0) {
          add(GAMMA * shotValueFrom(m, m.h, pool) - rNow, "reloading", () => { if (--m.reload <= 0) { m.reload = 0; refill(m, w); L(`${m.id} finishes reloading`); } else L(`${m.id} keeps reloading`); });
          continue;
        }
        if (isGun && m.ammo <= 0) {
          if (m.mags <= 0) continue;   // out of magazines: the gun is done
          const turns = reloadTime(m, w);
          add(Math.pow(GAMMA, turns) * shotValueFrom(m, m.h, pool) - rNow, "reload", () => { m.reload = turns; if (w.natural && w.shots.reload > 3) m.reload = 0; L(`${m.id} ${crewNear(m) ? "and its loader reload" : "reloads"}`); });
          continue;
        }
        if (w.indirect) { indirectOptions(m, w, add, rNow, Wr); continue; }
        if (w.concentrate && m.conc < w.concentrate) {
          add(Math.pow(GAMMA, w.concentrate - m.conc) * shotValueFrom(m, m.h, pool) - rNow, "concentrate", () => { m.conc++; L(`${m.id} concentrates on ${w.name}`); });
          continue;
        }
        const fpCost = (w.fp || 0) * 0.02;
        for (const t of cands) {
          const d = Math.max(1, hexDist(m.h, t.h));
          if (d > w.range.max) continue;
          const spread = 1 / (1 + 0.5 * u.ai.focus * claims(m, t));
          // figures in the line of fire cost -4 each, and a miss may hit a friend on the line or beside the target
          const inter = w.malediction ? [] : between(m.h, t.h, m.u.side).filter(x => x !== t);
          const base = wl(m, w) - skillPen(m) + rangePenalty(rngD(m.h, t.h, d) + spdOf(t.steps || 0)) + t.u.sm - linePen(m, inter) - darkPen(m, t);
          const fx = w.malediction ? null : shotFx(t, m.h, false);
          const pals = w.malediction || w.dmg.ex ? [] : [...new Set([...inter, ...models.filter(x => x !== m && x.state === "ok" && x.h && hexDist(x.h, t.h) <= 1)])].filter(x => x.u.side === u.side && !(drilled(m) && drilled(x)));
          // a cone catches every friend in the wedge (who may dive clear)
          const coneFF = w.cone ? P3[cl(base)] * coneCaught(m, w, t).filter(x => x.u.side === u.side).reduce((a, x) => { const dd = rangedDefence(x, m); return a + (1 - (dd == null ? 0 : P3[cl(dd)])) * Math.min(1, expInj(w, x.u, "area") / remOf(x)) * threatOf(x) * HORIZON; }, 0) * u.ai.caution : 0;
          const ffCost = coneFF + (pals.length && !w.cone ? (1 - P3[cl(base)]) * pals.reduce((a, x) => a + P3[cl(9 + x.u.sm)] * Math.min(1, expInjRandom(w, x.u) / remOf(x)) * threatOf(x) * HORIZON, 0) * u.ai.caution : 0);
          const aimed = m.aimTarget === t && m.aimTurns > 0;
          const aimB = aimed ? Math.min(2 * w.acc, w.acc + (m.aimTurns >= 3 ? 2 : m.aimTurns >= 2 ? 1 : 0)) : 0;
          const fA = !aimed && m.follow && m.follow.t === t && m.follow.w === w && !m.moved ? m.follow.acc : 0;
          const br = bracedFor(m, w, t, m.moved, aimB + fA > 0), bB = br ? 1 : 0;
          const own = w.malediction ? 0 : ownCoverPen(m, t.h, br && aimB + fA > 0);
          const Enow = planAttack(m, w, t, base + bB + aimB + fA - own, false, null, { aim: aimB + fA, braced: br, fx }).score * sustainOf(w) * spread;
          // a friendly heavy gun is holding for an opening on this foe: rattling it (a crit, a knock-down, a stun, its
          // fatigue spent on feverish dodges) is worth more than the shot alone, most of all from a burst
          const forGun = models.some(x => x !== m && x.u.side === u.side && x.waitOpen && x.waitOpen.t === t && x.state === "ok");
          const vNow = (Wr * kv(m, t, Enow) - fpCost - ffCost) * (forGun ? ((w.rof || 1) >= 3 ? 1.6 : 1.25) : 1);
          // a big gun (a hit all but kills) against a foe who dodges most shots: don't waste it; keep the aim and hold
          // for an opening (stunned, down, exhausted, committed to an attack), fired the moment it comes (a Wait, B366)
          // Holding is a trade: the shot now (at the foe's full defence) against the chance an opening comes in the next
          // few seconds (more likely the more friendly bursts can reach the foe: each forces a dodge, -1 the next,
          // MA122), at a defence of 9 or less, discounted for the seconds and for the gunner surviving them
          const dd0 = rangedDefence(t, m), pD = dd0 == null ? 0 : P3[cl(dd0)];
          let holdIt = !w.malediction && !w.cone && (w.rof || 1) <= 2 && pD >= 0.5 && (m.holdN || 0) < 8
            && expInjRandom(w, t.u) >= 0.5 * remOf(t) && (terr ? walk(m.h, t.h) : d) > moveOf(t) + 3;
          if (holdIt) {
            const bursts = models.filter(x => x !== m && x.u.side === u.side && x.state === "ok" && x.h && !x.stunned && x.u.ranged && (x.u.ranged.rof || 1) >= 3 && los(x.h, t.h) && hexDist(x.h, t.h) <= x.u.ranged.range.max).length;
            const pOpen = Math.min(0.6, 0.08 * bursts), live = 1 - Math.min(0.9, incoming(m, m.h, "") / remOf(m));
            const Eopen = Enow / Math.max(0.05, 1 - pD) * (1 - 0.375);
            let vHold = 0;
            for (let k = 1; k <= 3; k++) vHold += Math.pow(GAMMA * live, k) * pOpen * Math.pow(1 - pOpen, k - 1) * Eopen;
            holdIt = vHold > 1.1 * Enow;
          }
          if (holdIt) {
            add(Math.max(vNow, 0) * 1.2 + 0.001 - rNow, `hold@${t.id}`, () => {
              if (m.aimTarget !== t) m.aimTurns = 0;
              m.aimTarget = t; m.aimTurns = Math.min(3, m.aimTurns + 1); faceTo(m, t.h); m.waitOpen = { t, w }; m.holdN = (m.holdN || 0) + 1;
              L(`${m.id} holds its aim on ${t.id}, waiting for an opening (Wait)`);
            });
            continue;
          }
          add(vNow - rNow, `fire ${w.name}@${t.id}`, () => { m.aimTarget = t; faceTo(m, t.h); fireAt(m, w, t, { aim: aimed }); });
          // All-Out Attack (Determined, +1 ranged): only worth it when little can hit back
          if (threatNow < 1) {
            const Eaoa = planAttack(m, w, t, base + bB + aimB + fA - own + 1, false, null, { aim: aimB + fA, braced: br, fx }).score * sustainOf(w) * spread;
            add(Wr * kv(m, t, Eaoa) - fpCost - ffCost - risk(m, m.h, "aoa"), `aoa-fire@${t.id}`, () => { m.aoa = true; m.aimTarget = t; faceTo(m, t.h); fireAt(m, w, t, { aim: aimed, aoa: true }); });
          }
          // Aim (B364): pay a turn now for Acc (and +1/+2 more on later turns) next turn
          if ((w.acc || 0) >= 1 && !(aimed && m.aimTurns >= 3)) {
            const nextB = Math.min(2 * w.acc, (aimed ? aimB : 0) + (aimed ? 1 : w.acc));
            const brA = bracedFor(m, w, t, false, true);
            const Eaim = planAttack(m, w, t, base + (brA ? 1 : 0) + nextB - ownCoverPen(m, t.h, brA), false, null, { aim: nextB, braced: brA, fx }).score * sustainOf(w) * spread;
            // any active defence before next turn spoils the aim (B364): then it's an unaimed shot a turn late
            const keepP = aimKeep(m), Eun = keepP < 1 ? planAttack(m, w, t, base + bB - own, false, null, { aim: 0, braced: br, fx }).score * sustainOf(w) * spread : 0;
            add(GAMMA * Wr * kv(m, t, keepP * Eaim + (1 - keepP) * Eun) - GAMMA * ffCost - rNow, `aim@${t.id}`, () => {
              if (m.aimTarget !== t) m.aimTurns = 0;
              m.aimTarget = t; m.aimTurns++; faceTo(m, t.h); L(`${m.id} aims at ${t.id}`);
            });
          }
        }
        const keep = t => cohesion(m, t);
        // Move and Attack (B365): step up the range and fire at -2 (or Bulk), no Aim; the new position counts next turn
        if (u.stance !== "shoot" && cands.length && !(w.fp)) {
          const t = cands[0], d = hexDist(m.h, t.h), hold = Math.max(2, keep(t));
          if (d > hold + 1) {
            const mv = Math.min(moveOf(m), d - hold), nd = d - mv;
            const E = planAttack(m, w, t, wl(m, w) - skillPen(m) + rangePenalty(nd + spdOf(t.steps || 0)) + t.u.sm + Math.min(-2, w.bulk || 0), false).score * sustainOf(w);
            const h2 = stepHex(m.h, t.h, mv);
            const cont = GAMMA * (shotValueFrom(m, h2, pool) - shotValueFrom(m, m.h, pool));
            add(Wr * kv(m, t, E) + cont - risk(m, h2, ""), `advance-fire@${t.id}`, () => {
              stepToward(m, t.h, mv, hold); if (m.state !== "ok" || !m.h || m.stunned || !t.h || m.readied) return;
              faceTo(m, t.h); m.mna = true; fireAt(m, w, t, { moved: true });
            });
          }
        }
        // close the range without firing (a power that costs FP isn't wasted on a hopeless roll)
        // only when the shot from here is poor (-3 or worse for range, 7 yards and more): a soldier with a fair shot
        // takes it, or advances firing, rather than walking up to arm's length for one; and a gunman stops 3 yards off
        if (cands.length) {
          const t = cands[0], d = hexDist(m.h, t.h), stop = Math.max(u.stance === "charge" ? 2 : 3, keep(t));
          if (d > stop + 1 && (rangePenalty(d) <= -3 || w.fp)) {
            const h2 = stepHex(m.h, t.h, Math.min(moveOf(m), d - stop));
            add(GAMMA * shotValueFrom(m, h2, pool) - risk(m, h2, "") - 0.001, `move-closer@${t.id}`, () => {
              stepToward(m, t.h, moveOf(m), stop); if (m.state !== "ok" || !m.h) return; if (t.h) faceTo(m, t.h); L(`${m.id} closes in on ${t.id}`);
            });
          }
        }
        // suppression fire (B409) over a cluster
        if (isGun && (w.rof || 1) >= 5 && (w.shots.mag === Infinity || m.ammo >= 5)) {
          let bestZ = null;
          for (const c of cands) {
            if (hexDist(m.h, c.h) > w.range.max) continue;
            const inZ = pool.filter(x => hexDist(x.h, c.h) <= 1);
            // area denial (TS p. 18): a cluster, or a lone foe in cover or in a doorway
            if (inZ.length < 3 && !(inCover(c, m.h) || (terr && terr.doorI[idx(key(c.h.q, c.h.r))]))) continue;
            const shots = w.shots.mag === Infinity ? w.rof : Math.min(w.rof, m.ammo);
            const Ez = x => P3[cl(Math.min(6, w.level - skillPen(m) + rangePenalty(rngD(m.h, x.h, Math.max(1, hexDist(m.h, x.h))))) + rapidBonus(shots) + x.u.sm)] * (1 - P3[cl(rangedDefence(x, m))]) * expInjRandom(w, x.u);
            // the zone attacks friends in it too (B409): their loss counts against it
            const pals = models.filter(x => x !== m && x.state === "ok" && x.h && x.u.side === u.side && hexDist(x.h, c.h) <= 1);
            // pinning them is worth the harm their fire won't do while our squad moves (TS p. 21)
            const pinV = inZ.reduce((a, x) => a + pinOf(x) * Math.min(1, threatOf(x)) * 0.25 * HORIZON * (x.u.ranged ? 1 : 0.3), 0);
            const v = pinV + inZ.reduce((a, x) => a + kv(m, x, Ez(x) * sustainOf(w)), 0)
              - u.ai.caution * pals.reduce((a, x) => a + Math.min(1, Ez(x) / remOf(x)) * threatOf(x) * HORIZON, 0);
            if (!bestZ || v > bestZ.v) bestZ = { c, v };
          }
          if (bestZ) add(Wr * bestZ.v - rNow, "suppress", () => { faceTo(m, bestZ.c.h); suppress(m, w, bestZ.c.h); });
        }
        // Wait (B366): hold fire for a charger heading for me; shoot it as it closes, maybe before it strikes
        if (isGun && !engaged(m)) {
          const ch = pool.filter(f => f.u.melee && (f.u.stance === "charge" || !f.u.ranged) && !f.waiting && !f.aod).map(f => ({ f, d: hexDist(m.h, f.h) }))
            .filter(x => x.d >= 3 && x.d - x.f.u.melee.reachMax <= moveOf(x.f) && nearestFoe(x.f) === m).sort((a, b) => a.d - b.d)[0];
          if (ch) {
            const E = planAttack(m, w, ch.f, w.level - skillPen(m) + ch.f.u.sm, false).score;
            const stop = Math.min(1, E / remOf(ch.f));
            const saved = stop * expInjRandom(ch.f.u.melee, u) / remOf(m) * threatOf(m) * u.ai.caution;
            add(Wr * kv(m, ch.f, E) + saved - rNow, `wait@${ch.f.id}`, () => { m.waiting = w; L(`${m.id} waits for ${ch.f.id} to close (Wait)`); });
          }
        }
      }
      // a melee Wait (B366) with a long weapon: strike a charger as it steps into reach, before its own blow
      if (u.melee.reachMax >= 2 && !engaged(m)) {
        // only a foe that means to close: a charger or a pure melee model, not one itself waiting or dug in on All-Out Defense (either deadlocks)
        const ch = pool.filter(f => f.u.melee && f.u.melee.reachMax < u.melee.reachMax && (f.u.stance === "charge" || !f.u.ranged) && !f.waiting && !f.aod).map(f => ({ f, d: hexDist(m.h, f.h) }))
          .filter(x => x.d > u.melee.reachMax && x.d - x.f.u.melee.reachMax <= moveOf(x.f) && nearestFoe(x.f) === m).sort((a, b) => a.d - b.d)[0];
        if (ch) {
          const E = planAttack(m, u.melee, ch.f, u.melee.level - skillPen(m), true).score * (1 + (u.flags.extraAttack || 0));
          const stop = Math.min(1, E / remOf(ch.f));
          const saved = stop * expInjRandom(ch.f.u.melee, u) / remOf(m) * threatOf(m) * u.ai.caution;
          add(stanceW(m, "melee") * u.ai.aggression * kv(m, ch.f, E) + saved - rNow, `wait-melee@${ch.f.id}`, () => { m.waiting = u.melee; L(`${m.id} waits for ${ch.f.id} with ${u.melee.name} ready (Wait)`); });
        }
      }
      // grenades (B410): a Ready to grab one, a second to arm it, then throw
      if (u.grenades.length && !m.grips.length && m.armsLost < 1) {
        const g = bestGrenade(m, pool);
        if (g) {
          const gv = Wr * g.v, left = 2 - grenadeStage(m, g.i);
          if (!left) add(gv - rNow, "throw", () => throwGrenade(m, g));
          else add(Math.pow(GAMMA, left) * gv - rNow, "ready-grenade", () => readyGrenade(m, g.i));
        }
      }
    }
    // a grenade in hand: 0 none, 1 drawn, 2 armed. A Ready draws it (Fast-Draw (Grenade) makes that free, and the
    // same Ready arms it), a second arms it (B410)
    const grenadeStage = (m, gi) => m.grenadeReady === gi ? (m.grenadeArmed ? 2 : 1) : 0;
    function readyGrenade(m, gi, why = "") {
      const nm = m.u.grenades[gi].name;
      if (m.grenadeReady !== gi) {
        m.grenadeReady = gi; m.grenadeArmed = false;
        if (m.u.fdGrenade > -Infinity && check(m.u.fdGrenade - skillPen(m)).ok) { m.grenadeArmed = true; L(`${m.id} fast-draws and arms a ${nm}${why}`); }
        else L(`${m.id} draws a ${nm}${why}`);
      } else { m.grenadeArmed = true; L(`${m.id} arms its ${nm}${why}`); }
    }
    // a hex up to n steps from a toward b (for valuing positions without moving)
    function stepHex(a, b, n) {
      let h = a;
      if (terr) {
        const F = field(b);
        for (let i = 0; i < n; i++) {
          let best = null, bd = F.get(key(h.q, h.r)) ?? 999;
          for (const [dq, dr] of DIRS) { const x = { q: h.q + dq, r: h.r + dr }, d = F.get(key(x.q, x.r)); if (d != null && d < bd) { bd = d; best = x; } }
          if (!best || bd < 1) break;
          h = best;
        }
        return h;
      }
      for (let i = 0; i < n; i++) {
        let best = null, bd = hexDist(h, b);
        for (const [dq, dr] of DIRS) { const x = { q: h.q + dq, r: h.r + dr }; const dd = hexDist(x, b); if (dd < bd) { bd = dd; best = x; } }
        if (!best) break;
        h = best;
      }
      return h;
    }

    // how much of the hand-to-hand threat to m its squad-mates could remove over the next couple of turns (0-1)
    function aodHelp(m, pool) {
      let best = 0;
      for (const f of pool) {
        if (!f.u.melee || hexDist(f.h, m.h) - f.u.melee.reachMax > moveOf(f)) continue;
        let inj = 0;
        for (const a of models) {
          if (a === m || a.state !== "ok" || !a.h || a.u.side !== m.u.side) continue;
          const d = hexDist(a.h, f.h);
          const mw = a.u.melee, rw = a.u.ranged;
          let e = 0;
          if (mw && d - mw.reachMax <= moveOf(a)) e = expInjRandom(mw, f.u) * 0.5;
          if (rw && d <= rw.range.max && los(a.h, f.h)) e = Math.max(e, expInjRandom(rw, f.u) * 0.5 * Math.min(3, rw.rof || 1));
          inj += e;
        }
        if (f.u.shield && f.sp > 0) inj *= 0.3;   // a field that's up takes most of it first
        best = Math.max(best, Math.min(1, 2 * inj / remOf(f)));
      }
      return best;
    }
    // ---- in a facility: shut a door that a foe is shooting through (a Ready, B382), when that's safer than anything else
    function doorOptions(m, pool, add, rNow) {
      if (!pool.some(f => los(f.h, m.h))) return;
      for (const [dq, dr] of DIRS) {
        const k = key(m.h.q + dq, m.h.r + dr), i = idx(k);
        if (i == null || !terr.doorI[i] || broken[i] || closed[i] || occ.has(k)) continue;
        // no shutting a door on a foe in or beside the doorway: it would just push it open again
        const dh = terr.hx[i];
        if (pool.some(f => f.h && hexDist(f.h, dh) <= 1)) continue;
        closed[i] = 1; const r2 = risk(m, m.h, ""); closed[i] = 0;
        if (r2 < rNow - 1e-6) add(-r2 - 0.001, `close-door@${k}`, () => setDoor(i, true, m));
      }
    }
    // ---- breaching (B558): when the way round to the nearest foe is much longer than the way through, attack the
    // first wall or shut door on the straight line: a gun or power at a wall in sight, a blow at one within reach.
    // Worth what the opening gives (a shot through it, or the charge it shortens) once the turns to break it pass
    function breachOptions(m, pool, add, rNow, Wm) {
      const f = pool[0];
      if (!f || !f.h || los(m.h, f.h)) return;
      const hd = hexDist(m.h, f.h), wk = walk(m.h, f.h), mv = moveOf(m);
      if (wk - hd < 2) return;
      let j = null, jd = 99;
      for (const L2 of lineEntry(m.h, f.h)) if (L2) for (const i of L2) if (blocker(i)) { const d = hexDist(m.h, terr.hx[i]); if (d < jd) { jd = d; j = i; } break; }
      if (j == null || !structOf(j)) return;
      const th = terr.hx[j], st = structOf(j), hp = hpOf(j);
      for (const melee of [true, false]) {
        if (melee ? jd > m.u.melee.reachMax : !los(m.h, th)) continue;
        for (const w of weaponsFor(m, melee)) {
          const isGun = w === m.u.ranged;
          if (!melee && (jd > w.range.max || w.malediction || w.cone || (isGun && (m.ammo <= 0 || m.reload > 0)))) continue;
          const dm = w.dmg, mean = (dm.n * 3.5 + dm.add) * (dm.mult || 1);
          const per = Math.max(0, mean - Math.floor(st.dr / (dm.div || 1))) * woundMult(dm.type, "torso", { homogenous: 1 }, dm.ex);
          const lvl = melee ? w.level - skillPen(m) : wl(m, w) - skillPen(m) + rangePenalty(jd);
          const E = per * (melee ? P3[cl(lvl)] : burstHits(lvl, isGun && w.shots.mag !== Infinity ? Math.min(w.rof || 1, m.ammo) : (w.rof || 1), w));
          if (!(E > 0)) continue;
          const T = Math.ceil(hp / E);
          if (T > 4 || T - 1 > (wk - hd) / mv) continue;   // walking round would be as quick
          let V;
          broken[j] = 1;
          if (!melee && shotValueFrom(m, m.h, pool) > 0) V = shotValueFrom(m, m.h, pool);
          else V = Wm * kv(m, f, planAttack(m, m.u.melee, f, m.u.melee.level - skillPen(m), true).score) * Math.pow(GAMMA, Math.ceil(hd / mv));
          broken[j] = 0;
          if (V > 0) add(Math.pow(GAMMA, T - 1) * V - rNow, `breach@${th.q},${th.r}`, () => attackStructure(m, w, j, melee));
        }
      }
      // a grenade (krak, above all) against the wall: Ready it, then throw
      if (los(m.h, th) && jd >= 2) m.u.grenades.forEach((g, gi) => {
        if (!m.grenadesLeft[gi] || jd > g.range.max) return;
        const dm = g.dmg, mean = (dm.n * 3.5 + dm.add) * (dm.mult || 1);
        const lvl = g.level - skillPen(m) + rangePenalty(jd);
        const E = P3[cl(lvl)] * Math.max(0, mean - Math.floor(st.dr / (dm.div || 1))) * woundMult(dm.type, "torso", { homogenous: 1 }, dm.ex);
        if (!(E > 0)) return;
        const T = Math.ceil(hp / E) * 3 - grenadeStage(m, gi);
        if (T > 4 || T - 1 > (wk - hd) / mv || m.grenadesLeft[gi] * 3 < T) return;
        broken[j] = 1;
        const V = shotValueFrom(m, m.h, pool) || Wm * kv(m, f, planAttack(m, m.u.melee, f, m.u.melee.level - skillPen(m), true).score) * Math.pow(GAMMA, Math.ceil(hd / mv));
        broken[j] = 0;
        if (V > 0) add(Math.pow(GAMMA, T - 1) * V - rNow, `breach-grenade@${th.q},${th.r}`, () => {
          if (grenadeStage(m, gi) < 2) { readyGrenade(m, gi, ` to breach the ${hexName(j)}`); return; }
          m.grenadeReady = null; m.grenadeArmed = false; m.grenadesLeft[gi]--; m.attacked = true; faceTo(m, th);
          const r = check(lvl), raw = rollDamage(dm);
          L(`${m.id} throws a ${g.name} at the ${hexName(j)} (skill ${lvl}): ${r.ok ? "it goes off against it" : "it bounces wide"}`);
          if (r.ok) { damageStructure(j, raw, dm, true); if (!broken[j]) L(`  ${hpOf(j)} HP of it left`); explosion(m, g, th, raw); }
          else explosion(m, g, stepHex(th, m.h, 1), raw);
        });
      });
    }
    function attackStructure(m, w, j, melee) {
      const th = terr.hx[j], d = hexDist(m.h, th), isGun = w === m.u.ranged, name = hexName(j);
      faceTo(m, th); m.attacked = true; m.aimTurns = 0;
      if (w.fp) spendFP(m, w.fp);
      if (w.perils && perils(m, w)) return;
      const n = melee ? 1 : isGun ? (w.shots.mag === Infinity ? w.rof : Math.min(w.rof, m.ammo)) : (w.rof || 1);
      if (isGun && w.shots.mag !== Infinity) m.ammo -= n;
      const lvl = melee ? w.level - skillPen(m) : wl(m, w) - skillPen(m) + rangePenalty(d);
      L(`${m.id} ${melee ? "strikes at" : w.usage === "power" ? "casts " + w.name + " at" : "fires " + (n > 1 ? n + " " : "") + "at"} the ${name} to breach it (skill ${lvl})`);
      let hits = 0, inj = 0;
      for (let k = 0; k < n && !broken[j]; k++) {
        if (!check(lvl - (melee ? 0 : rclPen(w, k, false))).ok) continue;
        hits++;
        const raw = rollDamage(w.dmg);
        inj += damageStructure(j, raw, w.dmg, true);
        if (w.dmg.ex) explosion(m, w, th, raw);
      }
      if (!broken[j]) L(`  ${hits} hit${hits === 1 ? "" : "s"}, ${inj} damage; ${hpOf(j)} HP of the ${terr.wallI[j] ? "wall" : "door"} left`);
    }

    // ---- in a facility: move to a spot beside a crate or a corner that has a line of fire and cover against
    // the foes in sight; valued like any move (the shot it gives next turn less the risk of standing there)
    // the nearest hex within a move that no known foe can see (to reload or rally out of their fire)
    function hideHex(m, pool) {
      const mv = moveOf(m), start = key(m.h.q, m.h.r), prev = new Map([[start, null]]), q = [{ h: m.h, d: 0 }];
      const near = pool.slice(0, 8);
      for (let i = 0; i < q.length; i++) {
        const { h, d } = q[i];
        if (d > 0 && !near.some(f => f.h && los(h, f.h))) {
          const path = [];
          for (let k = key(h.q, h.r), n = h; k !== start; ) { path.unshift(n); const p = prev.get(k); k = key(p.q, p.r); n = p; }
          return { h, path };
        }
        if (d >= mv) continue;
        for (const [dq, dr] of DIRS) {
          const n = { q: h.q + dq, r: h.r + dr }, nk = key(n.q, n.r);
          if (prev.has(nk) || taken(nk)) continue;
          prev.set(nk, h); q.push({ h: n, d: d + 1 });
        }
      }
      return null;
    }
    // spread out (TS p. 21-22): with a foe in grenade range and squad-mates within 2 yards, a step or two to a spot
    // with fewer of them close (and cover from the thrower if there is one), valued like any move
    function spreadOptions(m, pool, add) {
      if (m.grips.length || m.prone || !m.h) return;
      const near = pool.slice(0, 8);
      const g0 = grenadeRisk(m, m.h, near);
      if (!(g0 > 0)) return;
      const crowd = h => models.filter(x => x !== m && x.u.side === m.u.side && x.state === "ok" && x.h && hexDist(x.h, h) <= 2).length;
      const c0 = crowd(m.h);
      if (!c0) return;
      const spots = [];
      for (const [dq, dr] of DIRS) for (const k of [1, 2]) {
        const h = { q: m.h.q + dq * k, r: m.h.r + dr * k };
        if (taken(key(h.q, h.r)) || (terr && !walkable(key(h.q, h.r))) || (k === 2 && taken(key(m.h.q + dq, m.h.r + dr)))) continue;
        if (crowd(h) < c0) spots.push(h);
      }
      spots.sort((a, b) => grenadeRisk(m, a, near) - grenadeRisk(m, b, near));
      for (const h of spots.slice(0, 2)) {
        add(GAMMA * shotValueFrom(m, h, pool) - risk(m, h, ""), `spread@${h.q},${h.r}`, () => {
          stepToward(m, h, hexDist(m.h, h), 0); if (m.state !== "ok" || !m.h) return;
          const f = pool.find(x => x.h && los(m.h, x.h)); if (f) faceTo(m, f.h);
          L(`${m.id} spreads out from its squad-mates`);
        });
      }
    }
    function coverOptions(m, pool, add) {
      const mv = moveOf(m), start = key(m.h.q, m.h.r), prev = new Map([[start, null]]), q = [{ h: m.h, d: 0 }], spots = [];
      const near = pool.slice(0, 6);
      for (let i = 0; i < q.length; i++) {
        const { h, d } = q[i];
        if (d > 0 && DIRS.some(([dq, dr]) => wallAt(key(h.q + dq, h.r + dr)))) {
          let sc = 0;
          for (const f of near) if (los(h, f.h)) { const c = coverAt(h, f.h, m), cp = c !== "none" ? covPenAt(h, f.h, m) : 0; sc += cp ? cp / 2 : -0.6; }
            // don't hug a corner a hidden foe could come round and grab you at (TS p. 23)
            else if (f.u.melee && walk(h, f.h) <= moveOf(f) + f.u.melee.reachMax) sc -= 1;
          if (sc > 0) spots.push({ h, sc: sc - d * 0.01 });
        }
        if (d >= mv) continue;
        for (const [dq, dr] of DIRS) {
          const n = { q: h.q + dq, r: h.r + dr }, nk = key(n.q, n.r);
          if (prev.has(nk) || taken(nk)) continue;
          const e = EL ? climb(idx(key(h.q, h.r)), idx(nk), climbCls(m)) : 0;
          if (e === Infinity || d + 1 + e > mv) continue;
          prev.set(nk, h); q.push({ h: n, d: d + 1 + e });
        }
      }
      spots.sort((a, b) => b.sc - a.sc);
      for (const { h } of spots.slice(0, 4)) {
        const path = [];
        for (let k = key(h.q, h.r), n = h; k !== start; ) { path.unshift(n); const p = prev.get(k); k = key(p.q, p.r); n = p; }
        add(GAMMA * shotValueFrom(m, h, pool) - risk(m, h, ""), `cover@${h.q},${h.r}`, () => {
          followPath(m, path, mv); if (m.state !== "ok" || !m.h) return;
          const f = pool.find(x => x.h && los(m.h, x.h)); if (f) faceTo(m, f.h);
          L(`${m.id} moves into cover`);
        });
      }
    }

    // the high ground (B407, plunging fire): a gunman within two moves of a gantry or dock with a shot from it climbs
    // up, valued like cover by the shot it gives and the fire it draws there, a turn's discount for each move it takes
    function highGroundOptions(m, pool, add) {
      const mv = moveOf(m), cc = climbCls(m), z0 = elevAt(m.h), start = key(m.h.q, m.h.r);
      const prev = new Map([[start, null]]), q = [{ h: m.h, d: 0 }], spots = [];
      for (let i = 0; i < q.length; i++) {
        const { h, d } = q[i];
        if (d > 0 && elevAt(h) >= z0 + 1 && !taken(key(h.q, h.r))) spots.push({ h, d, sc: elevAt(h) * 2 + pool.filter(f => f.h && los(h, f.h)).length - d * 0.1 });
        for (const [dq, dr] of DIRS) {
          const n = { q: h.q + dq, r: h.r + dr }, nk = key(n.q, n.r);
          if (prev.has(nk) || taken(nk) || !walkable(nk)) continue;
          const e = climb(idx(key(h.q, h.r)), idx(nk), cc);
          if (e === Infinity || d + 1 + e > 2 * mv) continue;
          prev.set(nk, h); q.push({ h: n, d: d + 1 + e });
        }
      }
      spots.sort((a, b) => b.sc - a.sc);
      for (const { h, d } of spots.slice(0, 2)) {
        const path = [];
        for (let k = key(h.q, h.r), n = h; k !== start; ) { path.unshift(n); const p = prev.get(k); k = key(p.q, p.r); n = p; }
        add(Math.pow(GAMMA, Math.ceil(d / mv)) * shotValueFrom(m, h, pool) - risk(m, h, ""), `high-ground@${h.q},${h.r}`, () => {
          followPath(m, path, mv); if (m.state !== "ok" || !m.h) return;
          const f = pool.find(x => x.h && los(m.h, x.h)); if (f) faceTo(m, f.h);
          L(`${m.id} ${elevAt(m.h) >= elevAt(h) - 0.01 ? "takes the high ground" : "heads for the high ground"}`);
        });
      }
    }
    // ---- options to close for hand-to-hand: charge (Move and Attack, All-Out Attack, Slam) or just advance
    function approachOptions(m, pool, add, Wm) {
      const u = m.u;
      if (m.armsLost >= 2 && u.melee.name === "Punch") return;
      const mv = moveOf(m), reach = u.melee.reachMax, near = pool[0], d = walk(m.h, near.h);
      // the path search (a mob flowing round its front rank) only matters once the foe is nearly in reach;
      // further off a straight-line estimate and a greedy advance do
      const route = d <= mv + reach + 2 ? engagePath(m, reach, pool, 600) : null;
      const tgt = route ? route.foe : near;
      const len = route ? route.path.length : Math.max(0, d - reach);
      const go = n => route ? followPath(m, route.path, n) : stepToward(m, near.h, n, reach);
      const stopped = () => m.state !== "ok" || m.stunned || m.prone || !m.h || m.readied;
      const w = u.melee;
      const helpers = models.filter(a => a !== m && a.u.side === u.side && a.state === "ok" && a.h && hexDist(a.h, tgt.h) <= moveOf(a) + 1).length;
      const worth = meleeWorth(m, tgt, helpers);
      const arrive = route && route.path.length ? route.path[Math.min(route.path.length, mv) - 1] : stepHex(m.h, tgt.h, Math.min(mv, len));
      const hard = expInjRandom(w, tgt.u) < 1;
      const stepN = Math.max(1, Math.ceil(mv / 10));   // a step is Move/10, rounded up (B368)
      if (route && route.path.length >= 1 && route.path.length <= stepN) {
        // one step short: the Attack maneuver's step, then a blow at full skill (B364-365), or All-Out Attack
        const lvl = w.level - skillPen(m) - (m.prone ? 4 : 0) + smMelee(m, tgt);
        const n = 1 + (u.flags.extraAttack || 0);
        const stepIn = () => { followPath(m, route.path, stepN); return !stopped() && tgt.h && hexDist(m.h, tgt.h) <= reach; };
        add(Wm * kv(m, tgt, planAttack(m, w, tgt, lvl, true).score * n) - risk(m, arrive, ""), `step-strike@${tgt.id}`, () => {
          if (stepIn()) { faceTo(m, tgt.h); strike(m, w, tgt, {}); }
        });
        add(Wm * kv(m, tgt, planAttack(m, w, tgt, lvl + 4, true).score * n) - risk(m, arrive, "aoa"), `step-aoa@${tgt.id}`, () => {
          if (stepIn()) { faceTo(m, tgt.h); m.aoa = true; strike(m, w, tgt, { determined: true }); }
        });
        if (grabValue(m, tgt, 0) > 0) add(Wm * grabValue(m, tgt, helpers) - risk(m, arrive, ""), `step-grab@${tgt.id}`, () => {
          if (stepIn() && hexDist(m.h, tgt.h) <= 1) { faceTo(m, tgt.h); grab(m, tgt); }
        });
      }
      if (len <= mv) {
        // arrives this turn: Move and Attack (-4, max 9) or a Slam if the weapon can't get through
        const lvl = Math.min(9, w.level - skillPen(m) - 4 + smMelee(m, tgt));
        const Ema = planAttack(m, w, tgt, lvl, true).score;
        const slamOK = len >= 2 && hard && !tgt.prone && !tgt.pinned && u.HP >= 0.8 * tgt.u.HP;
        // a Slam's worth: knocking the foe down sets up the pin (valued as a share of the foe taken out)
        const slamV = slamOK ? 0.25 * threatOf(tgt) * P3[cl(Math.max(u.dx, u.grapple) - skillPen(m))] * HORIZON : 0;
        const vMA = Wm * Math.max(kv(m, tgt, Ema), slamV) + GAMMA * Wm * worth - risk(m, arrive, "");
        add(vMA, `charge@${tgt.id}`, () => {
          const moved = go(mv); if (stopped() || !tgt.h) return; faceTo(m, tgt.h);
          if (tgt.h && hexDist(m.h, tgt.h) <= reach) slamOK && slamV > kv(m, tgt, Ema) ? slam(m, tgt, Math.max(1, moved), false) : strike(m, w, tgt, { charge: true });
          else L(`${m.id} charges at ${tgt.id} but can't get through to it`);
        });
        // Heroic Charge (MA132, cinematic option): 1 FP to ignore the Move and Attack penalty and cap
        if (CINEMATIC && !u.flags.machine && m.fp > Math.max(3, u.fp / 3)) {
          const Eh = planAttack(m, w, tgt, w.level - skillPen(m), true).score;
          add(Wm * kv(m, tgt, Eh) + GAMMA * Wm * worth - risk(m, arrive, "") - 0.02, `heroic-charge@${tgt.id}`, () => {
            go(mv); if (stopped() || !tgt.h) return; faceTo(m, tgt.h);
            if (hexDist(m.h, tgt.h) <= reach) { spendFP(m, 1); L(`${m.id} makes a heroic charge (1 FP)`); strike(m, w, tgt, { charge: true, heroic: true }); }
          });
        }
        // All-Out Attack after a half move (B365): +4 to hit, no defence until next turn
        if (len <= Math.max(2, Math.ceil(mv / 2))) {
          const Eaoa = planAttack(m, w, tgt, w.level - skillPen(m) + 4 + smMelee(m, tgt), true).score;
          const grabNear = models.filter(f => f.u.side !== u.side && f.state === "ok" && f.h && hexDist(f.h, tgt.h) <= 2 && f.armsLost < 1).length;
          const rG = grabNear >= 3 ? 0.5 * threatOf(m) * HORIZON * Math.max(0.3, u.ai.caution) : 0;   // a crowd could drag an All-Out Attacker down (MA114)
          add(Wm * Math.max(kv(m, tgt, Eaoa), slamV) + GAMMA * Wm * worth - risk(m, arrive, "aoa") - rG, `aoa-charge@${tgt.id}`, () => {
            const moved = go(Math.max(2, Math.ceil(mv / 2))); if (stopped() || !tgt.h) return; faceTo(m, tgt.h);
            if (hexDist(m.h, tgt.h) <= reach) { m.aoa = true; L(`${m.id} charges in (All-Out Attack)`); slamOK && slamV > kv(m, tgt, Eaoa) ? slam(m, tgt, Math.max(1, moved), true) : strike(m, w, tgt, { determined: true }); }
            else L(`${m.id} rushes at ${tgt.id} but can't get through to it`);
          });
        }
      } else {
        // still out of reach: close the distance; the payoff is the fight when it arrives
        // zeal (faction profile): how little a far-off fight is discounted; Orks and the swarm run at the enemy
        // and zealots run in on faith: they half-ignore the fire on the way and believe the fight is worth having
        const z = u.ai.zeal || 0, rm = Math.max(mv, runMove(m) + (u.flags.enhMove ? mv : 0)), turns = (Math.ceil((len - mv) / Math.max(1, rm)) + 1) * (1 - z);
        const v = Math.pow(GAMMA, turns) * Wm * Math.max(worth, z * 0.1 * threatOf(tgt) * HORIZON) - risk(m, arrive, "") * (1 - z / 2);
        if (cohesion(m, tgt) <= len - rm) add(v, `close@${tgt.id}`, () => { const n = go(runMove(m)); if (n >= mv - 1) m.runK = m.runPrev + 1; if (stopped()) return; if (tgt.h) faceTo(m, tgt.h); L(n ? `${m.id} moves in on ${tgt.id}` : `${m.id} can't find a way to ${tgt.id}`); });
      }
    }

    // worth of grabbing t (B370): a pinned foe is out of the fight while friends hack at it; more hands, better odds
    function grabValue(m, t, helpers) {
      const u = m.u;
      if (m.armsLost >= 1 || t.pinned || hangsOn(m, t)) return 0;
      const hit = P3[cl(u.grapple - skillPen(m) + smGrab(m, t))];
      const def = bestDefence(t, m, true);
      const pGrab = hit * (1 - (def == null ? 0 : P3[cl(def)]));
      const hands = (t.grips ? t.grips.length : 0) + helpers + 1;
      // the hold only matters if the grapplers can then take the foe down and pin it: Quick Contests of their
      // pooled ST (the strongest plus a fifth of each other) against the foe's ST, DX or grappling skill
      const pooled = u.liftST * (1 + 0.2 * Math.min(3, hands - 1));
      const contest = (a, d) => Math.max(0.02, Math.min(0.98, 0.5 + 0.08 * (a - d)));
      const pDown = t.prone ? 1 : contest(Math.max(pooled, u.dx, u.grapple), Math.max(t.u.liftST, t.u.dx - 4, t.u.grapple - 4));
      const dSM = t.u.sm - u.sm, pPin = contest(pooled + (dSM < 0 ? -3 * dSM : 0), t.u.liftST + (dSM > 0 ? 3 * dSM : 0));
      // and only if someone can then hurt the helpless foe (any location, chinks included); a foe nobody can
      // cut is just held, which doesn't win the fight
      const hurt = models.filter(a => a.u.side === u.side && a.state === "ok" && a.h && hexDist(a.h, t.h) <= moveOf(a) + 1)
        .reduce((b, a) => Math.max(b, ...["torso#c", "neck#c", "skull#c", "vitals", "neck"].map(l => expInj(a.u.melee, t.u, l))), 0);
      const kill = Math.max(0.05, Math.min(1, hurt / remOf(t)));
      return pGrab * pDown * pPin * kill * threatOf(t) * Math.min(1, hands / 4) * 0.8 * HORIZON;
    }
    // worth of being in reach of t: the best of a full blow (with Extra Attacks) and a grab
    function meleeWorth(m, t, helpers) {
      const w = m.u.melee;
      const E = planAttack(m, w, t, w.level - skillPen(m), true).score * (1 + (m.u.flags.extraAttack || 0));
      return Math.max(kv(m, t, E), grabValue(m, t, helpers));
    }
    // ---- options in hand-to-hand
    function meleeOptions(m, adj, add, rNow, Wm, Wr, mw) {
      const u = m.u;
      const gun = m.grips.length || gunGrip(m) || !gunReady(m) || m.gunSpent || (holdingGun(m) && !(u.ranged && u.ranged.oneHanded)) ? null : (u.ranged && !m.gunBroken && !m.jam && m.armsLost < 2 ? u.ranged : null);
      const threat = threatTo(m);
      for (const t of adj) {
        const face = () => { faceTo(m, t.h); };
        for (const w of mw) {
          const lvl = w.level - skillPen(m) - (m.prone ? 4 : 0) - closePen(m, w) + smMelee(m, t);
          const n = 1 + (u.flags.extraAttack || 0), tr = trained(m, w), P = (L2, d) => planAttack(m, w, t, L2, true, d, { noDa: !tr }).score;
          const ev = m.evaluate && m.evaluate.t === t && m.evaluate.turn === turn - 1 ? m.evaluate.n : 0;
          const base = P(lvl + ev);
          add(Wm * kv(m, t, base * n) - rNow, `strike ${w.name}@${t.id}`, () => { face(); strike(m, w, t, {}); });
          // Mighty Blows (extra effort, 1 FP, B357): with an Attack only (MA131)
          // All-Out Attack (Strong) and Mighty Blows only work with ST-based thrust or swing damage (B365)
          const stB = /^\s*(thr|sw)/.test(w.text || "");
          if (stB && m.fp > Math.max(4, m.u.fp / 3) && !u.flags.machine)
            add(Wm * kv(m, t, P(lvl + ev, boosted(w, 1)) * n) - rNow - 0.02 * n, `mighty@${t.id}`, () => { face(); strike(m, w, t, { mighty: true }); });
          // Rapid Strike (B370): two blows at -6 (-3 for a master); trained fighters only (MA113)
          const rp = u.flags.master ? 3 : 6;
          if (tr && lvl - rp >= 10) {
            const Er = 2 * P(lvl - rp) + (n - 1) * P(lvl);
            add(Wm * kv(m, t, Er) - rNow, `rapid@${t.id}`, () => { face(); strike(m, w, t, { rapid: true }); });
          }
          // Flurry of Blows (B357): 1 FP a blow halves the Rapid Strike penalty
          const rf = Math.ceil(rp / 2);
          if (tr && lvl - rf >= 10 && lvl - rp < lvl - rf && m.fp > Math.max(4, m.u.fp / 3) && !u.flags.machine) {
            const Ef = 2 * P(lvl - rf) + (n - 1) * P(lvl);
            add(Wm * kv(m, t, Ef) - rNow - 0.04, `flurry@${t.id}`, () => { face(); strike(m, w, t, { rapid: true, flurry: true }); });
          }
          // the foe's best defence now, and what a feint's margin is worth: the chance to win the contest times the
          // margin (about 1.2 at equal skill, +0.7 a point of edge, MA101)
          const def = bestDefence(t, m, true, w), skillT = Math.max(t.u.melee.level, t.u.dx);
          const gainOf = L2 => Math.max(0, 1.2 + 0.7 * (L2 - skillT));
          const Pfd = (L2, g) => { if (def == null) return P(L2); const a = P3[cl(def)], b = P3[cl(def - g)]; return a < 1 ? P(L2) * (1 - b) / Math.max(0.01, 1 - a) : P(L2); };
          // All-Out Attack (B365): Determined +4, Double (two blows), Strong (+2 or +1/die), Feint (a feint, then a blow, MA97)
          // an All-Out Attacker loses every grapple contest (MA114): held, or with two foes beside it who could grab,
          // that risks being dragged down and pinned, which is as good as out of the fight
          const grabbers = adj.filter(f => f.armsLost < 1 && !f.grips.length).length;
          const rA = risk(m, m.h, "aoa") + (m.grips.length || grabbers >= 2 ? 0.5 * threatOf(m) * HORIZON * Math.max(0.3, u.ai.caution) : 0);
          add(Wm * kv(m, t, P(lvl + 4) * n) - rA, `aoa-det@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { determined: true }); });
          add(Wm * kv(m, t, (n + 1) * P(lvl)) - rA, `aoa-double@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { double: true }); });
          if (stB) add(Wm * kv(m, t, P(lvl, boosted(w, 1)) * n) - rA, `aoa-strong@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { strong: true }); });
          if (tr) {
            add(Wm * kv(m, t, Pfd(lvl, gainOf(lvl)) * n) - rA, `aoa-feint@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { double: true, feintFirst: true }); });
            // All-Out Attack (Double) with a Rapid Strike: three blows, two of them at -6 (MA97)
            if (lvl - rp >= 10) add(Wm * kv(m, t, 2 * P(lvl - rp) + n * P(lvl)) - rA, `aoa-rapid@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { double: true, rapid: true }); });
            // a Rapid Strike that opens with a feint (MA127): feint and blow both at -6
            if (lvl - rp >= 10) add(Wm * kv(m, t, Pfd(lvl - rp, gainOf(lvl - rp)) + (n - 1) * P(lvl)) - rNow, `rapid-feint@${t.id}`, () => { face(); strike(m, w, t, { rapid: true, feintFirst: true }); });
            // Committed Attack (MA99): +2 to hit or +1 damage per two dice, defences at -2 with no retreat or parry
            const rC = risk(m, m.h, "ca") + (m.grips.length || grabbers >= 2 ? 0.2 * threatOf(m) * HORIZON * Math.max(0.3, u.ai.caution) : 0);   // -2 in grapple contests (MA114)
            add(Wm * kv(m, t, P(lvl + 2) * n) - rC, `ca-det@${t.id}`, () => { face(); strike(m, w, t, { committed: "det" }); });
            if (stB) add(Wm * kv(m, t, P(lvl, boosted(w, 0.5)) * n) - rC, `ca-strong@${t.id}`, () => { face(); strike(m, w, t, { committed: "str" }); });
            // attack and fly out: a long weapon strikes, then steps back out of a shorter foe's reach
            if (w.reachMax >= 2 && t.u.melee.reachMax < w.reachMax && hexDist(m.h, t.h) < w.reachMax) {
              const h = retreatHex(m, t);
              if (h && hexDist(h, t.h) <= w.reachMax) add(Wm * kv(m, t, P(lvl) * n) - risk(m, h, "ca"), `ca-flyout@${t.id}`, () => { face(); strike(m, w, t, { committed: "fly", flyOut: true }); });
            }
            // Defensive Attack (MA100): -2 damage or -1/die, +1 to a parry or block
            add(Wm * kv(m, t, P(lvl, boosted(w, -1)) * n) - risk(m, m.h, "da"), `da-strike@${t.id}`, () => { face(); strike(m, w, t, { defensive: true }); });
          }
          // Feint, Beat, Ruse (B365, MA100-101): this turn, for the next; trained fighters only (MA113)
          if (tr && def != null && !m.feint && !m.grips.length && P3[cl(def)] > 0.4) {   // no Feint while held (B371)
            const g = gainOf(lvl);
            add(GAMMA * Wm * kv(m, t, Pfd(lvl, g) * n) - rNow, `feint@${t.id}`, () => { face(); m.feint = { t, n: feintRoll(m, w, t, lvl), turn }; });
            // a Ruse (IQ-based) when wits beat hands
            const iqE = (u.stats.iq || 10) - u.dx, perE = (t.u.stats.per || t.u.stats.iq || 10) - t.u.dx;
            if (iqE > 0 && iqE > perE) add(GAMMA * Wm * kv(m, t, Pfd(lvl, gainOf(lvl + iqE - Math.max(0, perE))) * n) - rNow, `ruse@${t.id}`, () => { face(); m.feint = { t, n: feintRoll(m, w, t, lvl, "ruse"), turn }; });
            // a Beat (ST-based) against the Parry or Block that turned our blow, or that we parried: it helps the whole squad
            if (m.parriedBy && m.parriedBy.t === t && turn - m.parriedBy.turn <= 1) {
              const stE = u.st - u.dx - Math.max(0, t.u.st - t.u.dx), pals = models.filter(x => x !== m && x.u.side === u.side && x.state === "ok" && x.h && hexDist(x.h, t.h) <= x.u.melee.reachMax).length;
              const how = m.parriedBy.how;
              add(GAMMA * Wm * kv(m, t, Pfd(lvl, gainOf(lvl + stE)) * n * (1 + 0.6 * pals)) - rNow, `beat@${t.id}`, () => {
                face(); const b = feintRoll(m, w, t, lvl, "beat");
                if (b) t.beat = { how, n: b, until: turn + 1 };
              });
            }
          }
          // Defensive Feint (MA101): throw off the foe's next blow when its weapon is the thing to fear
          if (tr && lvl - skillT >= 4 && !m.feintDef && t.u.melee) {
            const g = gainOf(lvl), fl = t.u.melee.level;
            const cut = rNow * Math.max(0, 1 - P3[cl(fl - g)] / Math.max(0.01, P3[cl(fl)]));
            add(cut * 0.8 - rNow * 0.2, `dfeint@${t.id}`, () => { face(); m.feintDef = { t, n: feintRoll(m, w, t, lvl, "dfeint"), turn }; });
          }
          // Evaluate (B364): +1 a turn (to +3) on the next blow at this foe, and it cancels its feints against us (MA100)
          if (!m.grips.length) {
            const e1 = Math.min(3, (m.evaluate && m.evaluate.t === t ? m.evaluate.n : 0) + 1);
            add(GAMMA * Wm * kv(m, t, P(lvl + e1) * n) - rNow - 0.01, `evaluate@${t.id}`, () => { face(); m.evaluate = { t, n: e1, turn }; L(`${m.id} evaluates ${t.id} (+${e1})`); });
          }
        }
        // point-blank gun (Bulk penalty), averaged over its reloads
        if (gun && (gun.shots.mag === Infinity || m.ammo > 0) && m.reload === 0) {
          const E = planAttack(m, gun, t, gun.level + Math.min(0, gun.bulk || 0) - skillPen(m), false).score * sustainOf(gun);
          add(Wr * kv(m, t, E) - rNow, `point-blank@${t.id}`, () => { face(); fireAt(m, gun, t, { pointBlank: true }); });
          // All-Out Attack (Determined) with a gun at a foe in reach: +4 (TS p. 25)
          const E4 = planAttack(m, gun, t, gun.level + Math.min(0, gun.bulk || 0) - skillPen(m) + 4, false).score * sustainOf(gun);
          add(Wr * kv(m, t, E4) - risk(m, m.h, "aoa"), `aoa-point-blank@${t.id}`, () => { face(); m.aoa = true; fireAt(m, gun, t, { pointBlank: true, aoa: true }); });
          // blade and pistol together (B417)
          if (gun.oneHanded && u.melee.oneHanded && u.melee.name !== "Punch" && !m.armsLost) {
            const pm = u.dualPen, pg = u.dualPen + u.offPen;
            const Ed = planAttack(m, u.melee, t, u.melee.level - skillPen(m) - pm, true).score
              + planAttack(m, gun, t, gun.level + Math.min(0, gun.bulk) - skillPen(m) - pg, false).score;
            add(Wm * kv(m, t, Ed) - rNow, `dual@${t.id}`, () => {
              face(); L(`${m.id} attacks with both hands (${u.melee.name} and ${gun.name})`);
              strike(m, u.melee, t, { pen: pm }); if (t.state === "ok") fireAt(m, gun, t, { pointBlank: true, pen: pg });
            });
          }
        }
        if (gun && gun.shots.mag !== Infinity && m.ammo < gun.shots.mag && gun.shots.reload <= 3 && (m.mags > 0 || m.reload > 0)) {
          const turns = Math.max(1, gun.shots.reload - Math.max(0, m.reload > 0 ? gun.shots.reload - m.reload : 0));
          const Eg = planAttack(m, gun, t, gun.level + Math.min(0, gun.bulk || 0) - skillPen(m), false).score;
          add(Math.pow(GAMMA, turns) * Wr * kv(m, t, Eg) - rNow, `reload-cc`, () => {
            if (m.reload === 0) m.reload = gun.shots.reload;
            if (--m.reload <= 0) { m.reload = 0; refill(m, gun); } L(`${m.id} reloads in close combat`);
          });
        }
        // grappling (B370): grab a foe the weapon can't hurt; a pinned foe is out of the fight while friends hack at it
        if (m.armsLost < 1 && !t.pinned && gripsOn(t).length < 4) {
          const helpers = models.filter(a => a !== m && a.u.side === u.side && a.state === "ok" && a.h && hexDist(a.h, t.h) <= 1).length;
          add(Wm * grabValue(m, t, helpers) - rNow, `grab@${t.id}`, () => { face(); grab(m, t); });
        }
        // grab the gun (B370): a hand on a long gun's barrel pushes the muzzle aside; worth what the gun would do to us
        // over what the foe could do once it lets go and draws a blade
        if (m.armsLost < 1 && !m.grips.length && !holdingGun(m) && longGun(t) && gunReady(t) && !gunGrip(t) && !t.pinned && t.reload === 0
          && (m.inHand !== "both" || !u.melee || u.melee.natural || u.melee.oneHanded !== false)) {
          const g = t.u.ranged, hit = P3[cl(u.grapple - skillPen(m) + smGrab(m, t))], def = bestDefence(t, m, true);
          const pGrab = hit * (1 - (def == null ? 0 : P3[cl(def)]));
          const Eg = planAttack(t, g, m, g.level + Math.min(0, g.bulk || 0) - skillPen(t) + 4, false).score * sustainOf(g);
          const Em = t.u.melee ? GAMMA * planAttack(t, t.u.melee, m, t.u.melee.level - skillPen(t), true).score : 0;
          // the share of the foe's threat that is its gun, denied for the two or so turns it takes to wrench it free
          const share = Eg > 0 ? Math.max(0, Eg - Em) / Eg : 0;
          add(pGrab * share * threatOf(t) * 2 - rNow, `grab-gun@${t.id}`, () => { face(); grabGun(m, t); });
        }
        // Shove (B372): put a foe on the ground for friends who can hurt it
        if (!t.prone && m.armsLost < 2) {
          const friends = models.filter(a => a !== m && a.u.side === u.side && a.state === "ok" && a.h && hexDist(a.h, t.h) <= a.u.melee.reachMax);
          if (friends.length) {
            const sd = stDamage(u.st), thr = parseDamage("thr cr", sd.thr, sd.sw);
            const kb = 2 * (thr.n * 3.5 + thr.add) / Math.max(1, t.u.st - 2);
            const pDown = kb >= 1 ? 1 - P3[cl(t.u.dx - Math.floor(kb) + 1)] : 0;
            const pHit = P3[cl(Math.max(u.dx, u.grapple) - skillPen(m))];
            const vS = pHit * pDown * 0.3 * threatOf(t) * Math.min(1, friends.length / 2) * HORIZON;
            add(vS - rNow, `shove@${t.id}`, () => { face(); shove(m, t); });
          }
        }
      }
    }

    // ---- grenades: expected harm of a throw at each foe (the one struck takes it all, the rest the blast and fragments)
    // figures screening x from a blast at hex a, cached for the second (the planner asks the same pairs often)
    const SCR = new Map(); let scrTurn = -1;
    function screenN(a, x) {
      if (scrTurn !== turn) { SCR.clear(); scrTurn = turn; }
      const k = a.q + "," + a.r + ">" + x.ix;
      let n = SCR.get(k);
      if (n === undefined) { n = between(a, x.h, null).filter(y => y !== x).length; SCR.set(k, n); }
      return n;
    }
    function bestGrenade(m, pool) {
      let best = null;
      m.u.grenades.forEach((g, i) => {
        if (!m.grenadesLeft[i]) return;
        for (const c of pool.slice(0, 8)) {
          if (!c.h || !los(m.h, c.h)) continue;
          const d = hexDist(m.h, c.h);
          if (d < 3 || d > g.range.max) continue;
          const lvl = g.level - skillPen(m) + rangePenalty(d + spdOf(c.steps || 0)) + c.u.sm;
          // the target may Dodge (then it takes the blast at a yard, with no divisor)
          const dd = rangedDefence(c, m), pDodge = dd == null ? 0 : P3[Math.max(0, Math.min(18, dd))];
          const third = { ...g.dmg, div: 1, mult: g.dmg.mult / 3, key: "s1nd" };
          const direct = kv(m, c, (1 - pDodge) * expInj(g, c.u, "torso") + pDodge * expInj(g, c.u, "area", third));
          // everyone else in reach of the blast (3 yards counted) and the fragments, friends (and the thrower) included
          let others = 0;
          const fr = g.dmg.frag, fR = fr ? 5 * fr.n : 0;
          for (const x of models) {
            if (x === c || !x.h || x.state !== "ok") continue;
            const k = Math.max(1, hexDist(x.h, c.h));
            if (k > Math.max(3, fR) || !los(c.h, x.h)) continue;
            let e = k <= 3 ? expInj(g, x.u, "area", { ...g.dmg, div: 1, mult: g.dmg.mult / (3 * k), key: "s" + k + "nd" }) : 0;
            // expected fragments: the chance of success by 0, 3, 6... (one more per 3 points, B414)
            if (fr && k <= fR) { let nF = 0; for (let j = 15 + rangePenalty(k) + x.u.sm - (x.prone || x.kneel ? 2 : 0) - 4 * screenN(c.h, x); j >= 3; j -= 3) nF += P3[Math.min(18, j)]; e += nF * expInjRandom(g, x.u, { n: fr.n, add: 0, mult: 1, div: 1, type: fr.type, key: "f" }); }
            others += x.u.side === m.u.side ? -m.u.ai.caution * Math.min(1, e / remOf(x)) * threatOf(x) * HORIZON : kv(m, x, e);
          }
          const v = (direct + others) * P3[Math.max(0, Math.min(18, lvl))];
          if (!best || v > best.s) best = { i, c, s: v, v, lvl };
          // (a foe in sight is thrown at, and may dodge; the +4 throw at a hex is kept for foes out of sight, below:
          // user direction)
        }
        // through a doorway or round a corner (TS p. 24): a foe out of sight, a hex we can see that it can see
        if (terr) for (const c of pool.slice(0, 6)) {
          if (!c.h || los(m.h, c.h) || hexDist(m.h, c.h) > g.range.max + 2) continue;
          for (const [dq, dr] of [...DIRS, ...DIRS.map(([a, b]) => [2 * a, 2 * b])]) {
            const X = { q: c.h.q + dq, r: c.h.r + dr }, xi = idx(key(X.q, X.r));
            if (xi == null || !pass[xi] || closed[xi] || !los(m.h, X) || !los(X, c.h)) continue;
            const d = hexDist(m.h, X);
            if (d < 3 || d > g.range.max) continue;
            const lvl = g.level - skillPen(m) + rangePenalty(d) + 4;   // a throw at a hex (B414)
            let v = 0;
            for (const x of models) {
              if (x.state !== "ok" || !x.h || !los(X, x.h)) continue;
              const k = Math.max(1, hexDist(x.h, X));
              if (k > 3) continue;
              const e = expInj(g, x.u, "area", { ...g.dmg, div: 1, mult: g.dmg.mult / (3 * k), key: "s" + k + "nd" });
              v += x.u.side === m.u.side ? -m.u.ai.caution * Math.min(1, e / remOf(x)) * threatOf(x) * HORIZON : kv(m, x, e);
            }
            v *= P3[Math.max(0, Math.min(18, lvl))];
            if (v > 0 && (!best || v > best.s)) best = { i, c, hex: X, s: v, v, lvl };
          }
        }
      });
      return best;
    }
    // Diving for cover (B377): someone who sees a grenade land beside them may Dodge; success puts them a yard
    // further from the blast, prone
    // Diving for cover (B377): someone who sees a grenade land may Dodge; success puts them a yard further from it,
    // prone, and into a hex out of its sight (behind a crate, a wall or a corner) when there is one
    function dive(x, at) {
      if (x.state !== "ok" || x.pinned || x.aoa || x.grips.length) return false;
      const r = check(dodgeOf(x) - (x.stunned ? 4 : 0) - (x.prone ? 3 : 0));
      if (!r.ok) return false;
      if (at && x.h) {
        let best = null, bs = -1;
        for (const [dq, dr] of DIRS) {
          const h = { q: x.h.q + dq, r: x.h.r + dr };
          if (taken(key(h.q, h.r)) || (terr && !walkable(key(h.q, h.r)))) continue;
          const sc = (los(at, h) ? 0 : 10) + hexDist(h, at);
          if (hexDist(h, at) >= hexDist(x.h, at) && sc > bs) { bs = sc; best = h; }
        }
        if (best) place(x, best);
      }
      x.prone = true; x.kneel = false; L(`  ${x.id} dives for cover`);
      return true;
    }
    function throwGrenade(m, g) {
      const w = m.u.grenades[g.i], c = g.c;
      m.grenadeReady = null; m.grenadeArmed = false; m.grenadesLeft[g.i]--; m.attacked = true;
      reveal(m);
      if (g.hex) {
        // Attacking an area (B414): a throw at a hex is +4 (in g.lvl), with no defence, though anyone there may dive
        // for cover; a miss lands its margin of failure in yards off, at most half the distance
        faceTo(m, g.hex);
        const r = g.lvl < 3 ? { ok: false, margin: g.lvl - 10 } : check(g.lvl), raw = rollDamage(w.dmg);
        const off = r.ok ? 0 : Math.max(1, Math.min(Math.ceil(hexDist(m.h, g.hex) / 2), -r.margin));
        const at = off ? scatter(g.hex, off) : g.hex;
        const how = g.feet ? `at ${c.id}'s feet` : terr && terr.doorI[idx(key(g.hex.q, g.hex.r))] ? `through the doorway at ${c.id}` : `round the corner at ${c.id}`;
        L(`${m.id} lobs a ${w.name} ${how} (skill ${g.lvl})${off ? `: ${off} yd off` : ""}`);
        landOn(m, w, at, raw);
        explosion(m, w, at, raw);
        return;
      }
      faceTo(m, c.h);
      const r = g.lvl < 3 ? { ok: false, margin: g.lvl - 10, crit: false, fumble: false } : check(g.lvl);   // no roll below 3 (B344): a wild throw
      const raw = rollDamage(w.dmg);
      if (r.ok) {
        // a thrown grenade can be dodged or blocked (B373-375); it then lands the defence's margin of success in
        // yards away (B414)
        const def = r.crit ? null : defend(c, m, "thrown", 0, 0, w);
        if (def != null) {
          const off = Math.max(1, def.margin), at = scatter(c.h, off);
          L(`${m.id} throws a ${w.name} at ${c.id} (skill ${g.lvl}): ${c.id} ${def.how === "block" ? "knocks it aside" : "dodges"} and it goes off ${off} yd away`);
          landOn(m, w, at, raw);
          explosion(m, w, at, raw);
          return;
        }
        L(`${m.id} throws a ${w.name} at ${c.id} (skill ${g.lvl}): direct hit`);
        const at = c.h;
        applyHit(m, w, c, "torso", true, false, null, raw);
        explosion(m, w, at, raw, c);
      } else {
        const off = Math.max(1, Math.min(Math.ceil(hexDist(m.h, c.h) / 2), -r.margin)), at = scatter(c.h, off);
        L(`${m.id} throws a ${w.name} at ${c.id} (skill ${g.lvl}): it lands ${off} yd wide`);
        landOn(m, w, at, raw);
        explosion(m, w, at, raw);
      }
    }

    // ---- Feverish Defense (extra effort, B357): 1 FP for +2 to an active defence against a blow worth fearing
    function feverish(t, att, melee, v) {
      if (!att || t.u.flags.machine || t.committed || t.aoa || v < 5 || v > 15 || t.fp <= Math.max(3, Math.floor(t.u.fp / 3))) return 0;
      const aw = melee ? att.u.melee : att.u.ranged;
      if (!aw || expInjRandom(aw, t.u) < t.u.HP / 5) return 0;
      spendFP(t, 1); t.fever = true; L(`  ${t.id} defends feverishly (1 FP, +2)`);
      return 2;
    }

    // ---- Wait (B366) and suppression fire (B409) both interrupt a foe's movement
    const zones = [];
    // the firing line, settled for everyone at the start of the second so the rear rank sees the front rank down
    function firingLine(m) {
      if (m.prone) { m.kneelVol = false; return; }
      const pool = foes(m).filter(f => f.h).sort((a, b) => hexDist(m.h, a.h) - hexDist(m.h, b.h));
      if (!pool.length) return;
      const u = m.u, near = hexDist(pool[0].h, m.h) <= 3;
      if (m.kneelVol && (near || u.stance === "charge")) { m.kneel = m.kneelVol = false; L(`${m.id} rises`); }
      else if (!m.kneel && u.ranged && u.stance !== "charge" && !near && !m.grips.length && gunReady(m)) {
        const d0 = hexDist(m.h, pool[0].h);
        if (u.models.some(x => x !== m && x.state === "ok" && x.h && !x.kneelVol && hexDist(x.h, m.h) <= 4 && hexDist(x.h, pool[0].h) > d0)) {
          m.kneel = m.kneelVol = true; L(`${m.id} kneels to fire`);
        }
      }
    }
    function afterStep(m) {
      if (m.state !== "ok" || !m.h) return true;
      m.steps = (m.steps || 0) + 1;   // yards moved this turn: a moving target is harder to hit (B550)
      if (m.prevH) m.facing = faceToward(m.prevH, m.h);
      if (m.steps > moveOf(m) / 2) m.movedFar = true;
      if (AWARE) trySpot(m);   // stepping into view: seen at once in the open, a Stealth contest from concealment
      if (m.kneelVol) { m.kneel = m.kneelVol = false; }   // it rose as the step's start
      const k = key(m.h.q, m.h.r);
      for (const z of zones) if (m.state === "ok" && m.h && z.side !== m.u.side && z.owner.state === "ok" && z.owner.h && z.hexes.has(k) && !z.hit.has(m)) suppressHit(z, m);
      if (m.state !== "ok" || m.stunned) return true;
      for (const f of models) {
        if (!f.waiting || f.state !== "ok" || !f.h || f.u.side === m.u.side || f.stunned) continue;
        // a Wait on a door or corner fires at the first foe to step into view and range; any other at a charger closing in
        if (f.watch) { if (!los(f.h, m.h) || hexDist(f.h, m.h) > f.waiting.range.max) continue; }
        else if (hexDist(f.h, m.h) > (f.waiting === f.u.melee ? f.u.melee.reachMax : m.u.melee.reachMax + 1)) continue;
        const w = f.waiting; f.waiting = null; f.watch = false;
        if (w === f.u.ranged && gunGrip(f)) continue;
        L(`${f.id} was waiting for ${m.id} (Wait)`);
        if (w === f.u.melee) { if (hexDist(f.h, m.h) <= w.reachMax) strike(f, w, m, { stopYd: m.steps || 0 }); }
        else fireAt(f, w, m, { pointBlank: hexDist(f.h, m.h) <= 1 });
        if (m.state !== "ok" || m.stunned || m.prone) return true;
      }
      // slicing the pie (TS p. 23-24): a careful mover in a facility stops at the step that first shows it a foe, so
      // it meets it at the corner with the corner as light cover for both; if neither was waiting, a Quick Contest of
      // Per (+1 for Combat Reflexes) says who acts first, and a foe that wins shoots now and loses its next turn
      if (AWARE && terr && m.prevH && !m.popping && !((m.u.ai.zeal || 0) > 0) && m.u.stance !== "charge") {
        const newly = models.filter(x => x.state === "ok" && x.h && x.u.side !== m.u.side && !x.u.routed && hexDist(x.h, m.h) <= 10 && los(m.h, x.h) && !los(m.prevH, x.h));
        if (newly.length) {
          for (const x of newly) {
            if (x.waiting || x.stunned || x.early === turn || m.state !== "ok" || !m.h || x.state !== "ok" || !x.h) continue;
            const xw = weaponsFor(x, false).find(w => w.range && hexDist(x.h, m.h) <= w.range.max && (w !== x.u.ranged || x.ammo > 0 || w.shots.mag === Infinity));
            if (!xw || x.reload > 0 || x.jam) continue;
            const per = u => (u.stats.per || u.stats.iq || 10) + (u.flags.cr ? 1 : 0);
            const a = check(per(m.u)), b = check(per(x.u));
            const xWins = a.ok !== b.ok ? b.ok : b.margin > a.margin;
            if (xWins) { L(`${x.id} sees ${m.id} round the corner first`); x.early = turn; x.skipNext = true; fireAt(x, xw, m, {}); }
          }
          if (m.state === "ok") L(`${m.id} slices the pie and stops at the corner`);
          return true;
        }
      }
      return false;
    }
    function suppress(m, w, center) {
      reveal(m, w);
      const shots = w.shots.mag === Infinity ? w.rof : Math.min(w.rof, m.ammo);
      if (w.shots.mag !== Infinity) m.ammo -= shots;
      m.attacked = true;
      const hexes = new Set([key(center.q, center.r), ...DIRS.map(([a, b]) => key(center.q + a, center.r + b))]);
      const z = { owner: m, side: m.u.side, w, hexes, shots, hit: new Set() };
      zones.push(z); m.zone = z;
      L(`${m.id} lays down suppression fire (${shots} shots) over a 3-yard zone`);
      for (const x of models) if (x !== m && x.state === "ok" && x.h && hexes.has(key(x.h.q, x.h.r))) suppressHit(z, x);   // friend or foe (B409)
    }
    // anyone in the zone, or moving into it before the gunner's next turn, is attacked once at the gunner's effective
    // skill with every modifier (rapid-fire bonus, SM, posture), capped at 6 + the rapid-fire bonus (B409); one hit
    // plus one per full Rcl of margin, up to the shots fired; random locations, so cover takes what hits behind it.
    // They may Dodge
    function suppressHit(z, x) {
      z.hit.add(x);
      { const e = ev(x); e.supp = true; e.shotAt = z.owner; e.vol = Math.max(e.vol || 0, z.shots); }
      if (!los(z.owner.h, x.h)) return;
      const m = z.owner, w = z.w, d = Math.max(1, hexDist(m.h, x.h));
      const eff = w.level - skillPen(m) + rangePenalty(rngD(m.h, x.h, d)) - darkPen(m, x);
      const rb = rapidBonus(z.shots);
      const lvl = Math.min(6 + rb, eff + rb + x.u.sm + shotFx(x, m.h, false).pen("random"));
      const r = check(lvl);
      if (!r.ok) { L(`  suppression fire misses ${x.id}`); return; }
      let hits = Math.min(z.shots, 1 + Math.floor(Math.max(0, r.margin) / (w.mounted ? 1 : Math.max(1, w.rcl))));   // a mounted gun: Rcl 1
      if (!r.crit) { const def = defend(x, m, false, 0, 0, w); if (def != null) { const dg = Math.min(hits, 1 + def); hits -= dg; L(`  ${x.id} dodges ${dg}`); } }
      for (let k = 0; k < hits && x.state === "ok"; k++) { L(`  suppression fire hits ${x.id}`); applyHit(m, w, x, hitLocOn(x), true, d >= w.range.half); }
    }
    function clearZone(m) { if (m.zone) { zones.splice(zones.indexOf(m.zone), 1); m.zone = null; } }

    // ---- Slam (B371): crash into a foe at speed; each side deals HP x velocity / 100 dice of crushing damage
    // HP x velocity / 100 dice (B371): a fraction of 0.5 or more rounds up to a full die; below one die, 1d-3 up to
    // 0.25, 1d-2 up to 0.5, else 1d-1
    function slamDice(hp, v) { const n = hp * v / 100; return n >= 1 ? { n: n % 1 >= 0.5 ? Math.ceil(n) : Math.floor(n), add: 0, mult: 1, div: 1, type: "cr", ex: false } : { n: 1, add: n <= 0.25 ? -3 : n <= 0.5 ? -2 : -1, mult: 1, div: 1, type: "cr", ex: false }; }
    function slam(m, t, v, aoa) {
      if (!aoa) m.mna = true;
      let lvl = Math.max(m.u.dx, m.u.grapple, m.u.melee.name === "Punch" ? m.u.melee.level : 0) - skillPen(m) - (m.grips.length ? 4 : 0);
      if (aoa) lvl += 4;   // a slam at the end of a Move and Attack takes neither its -4 nor its cap of 9 (B371)
      m.attacked = true;
      const r = check(lvl);
      if (!r.ok) { L(`${m.id} slams at ${t.id} (skill ${lvl}): misses`); return; }
      if (!r.crit) { const def = defend(t, m, true, 0, 0, { ...UNARMED, weight: m.u.st * m.u.st / 10, huge: m.u.sm - t.u.sm >= 3 }); if (def) { L(`${m.id} slams at ${t.id}: ${def.how === "dodge" ? "dodged" : def.how + "ed"}`); return; } }
      const dm = slamDice(m.u.HP, v), dt = slamDice(t.u.HP, v);
      const a = rollDamage(dm), b = rollDamage(dt);
      L(`${m.id} slams into ${t.id} at ${v} yd/s (${a} vs ${b})`);
      // slams knock down rather than back (B371)
      applyHit(m, { dmg: dm, follow: null, slam: true }, t, "torso", false, false, dm, a);
      applyHit(t, { dmg: dt, follow: null, slam: true }, m, "torso", false, false, dt, b);
      const fall = x => { if (x.state === "ok" && !x.prone) { x.prone = true; L(`  ${x.id} is bowled over`); } };
      if (a >= 2 * b) fall(t);
      else if (b >= 2 * a) fall(m);
      else if (a >= b) { if (!check(t.u.dx - (t.grips.length ? 4 : 0)).ok) fall(t); }
    }
    // ---- Shove (B372): push instead of strike; knockback as a thrust with double dice, DX to stay standing
    function shove(m, t) {
      const lvl = Math.max(m.u.dx, m.u.grapple) - skillPen(m) - (m.prone ? 4 : 0) - (m.grips.length ? 4 : 0);
      m.attacked = true;
      const r = check(lvl);
      if (!r.ok) { L(`${m.id} shoves at ${t.id} (skill ${lvl}): misses`); return; }
      if (!r.crit) { const def = defend(t, m, true, 0, 0, { ...UNARMED, weight: m.u.st * m.u.st / 10, huge: m.u.sm - t.u.sm >= 3 }); if (def) { L(`${m.id} shoves at ${t.id}: ${def.how === "dodge" ? "dodged" : def.how + "ed"}`); return; } }
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
    // Grappling and size (B370, Pyramid 3/77 p. 9-10): the larger fighter gets +1 per SM of difference to grab (at
    // most +4), and so does a smaller one, "because there's so much to hang on to", but a smaller grappler can only
    // exploit a hold (take down, pin) on a part where that bonus plus the location's grappling penalty is 0 or less:
    // it goes for the neck (-3), and against something more than 3 SM bigger it can only hang on. So can anyone the
    // foe out-muscles more than twice over (B370): it's just extra encumbrance. In the pin, the larger gets +3 per SM.
    const hangsOn = (g, t) => t.u.sm - g.u.sm > 3 || t.u.liftST > 2 * g.u.liftST;
    const smGrab = (m, t) => { const d = t.u.sm - m.u.sm; return d > 0 ? (d <= 3 ? Math.min(4, d) - 3 : 4) : Math.min(4, -d); };
    function gripST(t) {
      const g = gripsOn(t).filter(x => !hangsOn(x, t)).map(x => x.u.liftST).sort((a, b) => b - a);
      return g.length ? g[0] + g.slice(1).reduce((a, x) => a + x / 5, 0) : 0;
    }
    function contest(a, b) { return contest3(a, b) > 0; }
    // Quick Contest (B348): 1 a win, -1 a loss, 0 a tie (both fail, or equal margins)
    function contest3(a, b) {
      const ra = check(a), rb = check(b);
      if (ra.ok !== rb.ok) return ra.ok ? 1 : -1;
      if (!ra.ok) return 0;
      return Math.sign(ra.margin - rb.margin);
    }
    // the grappler whose hold counts, and what the hold is worth in a break-free contest (B371): +5 with two hands,
    // pinned +10 (+5 with one); -4 if it's stunned
    const leadGrip = t => gripsOn(t).filter(x => !hangsOn(x, t)).sort((x, y) => y.u.liftST - x.u.liftST)[0] || gripsOn(t)[0];
    const twoHands = g => g.armsLost < 1 && !g.knifeOut && (g.inHand === "none" || g.inHand === "gun" || !g.u.melee || g.u.melee.natural || g.u.melee.name === "Punch");
    const holdBonus = (t, g) => !g ? 0 : (t.pinned ? (twoHands(g) ? 10 : 5) : (twoHands(g) ? 5 : 0)) - (g.stunned ? 4 : 0) + 2 * (g.u.flags.extraArms || 0);   // +2 per extra arm (MA115)
    const armsOf = x => 2 + (x.u.flags.extraArms || 0) - (x.armsLost || 0);
    // Parrying an unarmed attack with a weapon (B376): the attacker's reaching arm takes the weapon's damage
    function cutsArm(t, att) {
      const w = t.u.melee;
      if (!w || w.natural || w.name === "Punch" || t.state !== "ok" || att.state !== "ok") return;
      if (!check(w.level - skillPen(t) - (att.u.judo ? 4 : 0)).ok) return;   // B376: a skill roll to strike the limb squarely
      L(`  ${t.id}'s ${w.name} catches ${att.id}'s arm`);
      applyHit(t, w, att, "arm", false, false, null, rollDamage(w.dmg));
    }
    function grab(m, t) {
      const lvl = m.u.grapple - skillPen(m) - (m.prone ? 4 : 0) - (m.grips.length ? 4 : 0) + smGrab(m, t) + 2 * (m.u.flags.extraArms || 0);   // +2 per extra arm (MA115)
      m.attacked = true;
      if (lvl < 3) return;   // B344
      const r = check(lvl);
      if (!r.ok) { L(`${m.id} grabs at ${t.id} (skill ${lvl}): misses`); return; }
      if (!r.crit) { const def = defend(t, m, true, 0, 0, UNARMED); if (def) { L(`${m.id} grabs at ${t.id}: ${def.how === "parry" ? "parried" : def.how === "block" ? "blocked" : "dodged"}`); if (def.how === "parry") cutsArm(t, m); return; } }
      release(m); if (m.gunHold) { m.gunHold.gunGrip = null; m.gunHold = null; } m.holding = t; t.grips.push(m);
      L(`${m.id} grabs ${t.id} (${t.grips.length} holding on)`);
    }
    function grabGun(m, t) {
      const lvl = m.u.grapple - skillPen(m) - (m.prone ? 4 : 0) + smGrab(m, t);
      m.attacked = true;
      if (lvl < 3) return;
      const r = check(lvl), gn = t.u.ranged.name.split(",")[0];
      if (!r.ok) { L(`${m.id} grabs at ${t.id}'s ${gn} (skill ${lvl}): misses`); return; }
      if (!r.crit) { const def = defend(t, m, true, 0, 0, UNARMED); if (def) { L(`${m.id} grabs at ${t.id}'s ${gn}: ${def.how === "parry" ? "parried" : def.how === "block" ? "blocked" : "dodged"}`); return; } }
      release(m); m.gunHold = t; t.gunGrip = m;
      L(`${m.id} seizes ${t.id}'s ${gn} and forces the muzzle aside`);
    }
    // wrench the gun free: a Quick Contest of ST, the owner's two hands against one (+2)
    function wrenchGun(m) {
      const g = gunGrip(m);
      if (!g) return;
      if (contest(m.u.liftST - skillPen(m) + 2, g.u.liftST - skillPen(g) + 2 * (g.u.flags.extraArms || 0))) { g.gunHold = null; m.gunGrip = null; L(`${m.id} wrenches its ${m.u.ranged.name.split(",")[0]} free of ${g.id}`); }
      else L(`${m.id} struggles for its ${m.u.ranged.name.split(",")[0]} with ${g.id}`);
    }
    function wrestle(m, t) {
      if (hangsOn(m, t)) { L(`${m.id} hangs on to ${t.id} but can do nothing more with it`); return; }
      const dSM = t.u.sm - m.u.sm;
      if (!t.prone) {
        // Takedown: Quick Contest of the higher of ST, DX or grappling skill
        // the held model is at -4 DX (B370)
        const a = Math.max(gripST(t), m.u.dx, m.u.grapple) - skillPen(m), d = Math.max(t.u.liftST, t.u.dx - 4, t.u.grapple - 4) - skillPen(t) - (t.committed ? 2 : 0);
        // a foe on All-Out Attack is truly defenceless: it loses the contest outright (MA114); a grappler that loses
        // the contest suffers the takedown itself (B370): it goes down and loses its hold
        // Sprawling (MA119): a trained grappler who expects to lose falls willingly; the contest runs at +3 for it, and a
        // grappler that loses or ties goes down too and loses its hold
        if (!t.aoa && t.u.grapple > t.u.dx && a - d >= 2 && t.state === "ok") {
          t.prone = true;
          const c2 = contest3(a, d + 3);
          if (c2 <= 0) { L(`${t.id} sprawls as ${m.id} drags it down, and takes ${m.id} with it`); release(m); m.prone = true; }
          else L(`${t.id} sprawls as ${m.id} drags it down`);
          return;
        }
        const c = t.aoa ? 1 : contest3(a, d);
        if (c > 0) { t.prone = true; L(`${m.id}${t.grips.length > 1 ? ` and ${t.grips.length - 1} more` : ""} drag ${t.id} to the ground`); }
        else if (c < 0) { L(`${m.id} tries to drag ${t.id} down (${Math.round(a)} vs ${d}) and is thrown down itself`); release(m); m.prone = true; }
        else L(`${m.id} tries to drag ${t.id} down (${Math.round(a)} vs ${d}): it keeps its feet`);
      } else if (!t.pinned) {
        // Pin: Quick Contest of ST against a foe on the ground
        // more arms than the foe: +3 to pin it or resist its pin (MA115)
        const arms = armsOf(m) > armsOf(t) ? 3 : armsOf(t) > armsOf(m) ? -3 : 0;
        if (t.aoa || contest(gripST(t) - skillPen(m) + (dSM < 0 ? -3 * dSM : 0) + arms, t.u.liftST - skillPen(t) - (t.committed ? 2 : 0) + (dSM > 0 ? 3 * dSM : 0))) { t.pinned = true; L(`${m.id} pins ${t.id} (${t.grips.length} holding it down)`); }
        else L(`${m.id} tries to pin ${t.id}: it struggles free of the hold`);
      }
    }
    // the held model's turn: break one grip (Quick Contest of ST, or grappling skill if better)
    function breakFree(m) {
      const g = gripsOn(m);
      if (!g.length) return false;
      // a Quick Contest of ST (B371); pinned, one attempt every 10 seconds
      const lead = leadGrip(m), a = m.u.liftST - skillPen(m) + 2 * (m.u.flags.extraArms || 0), d = gripST(m) + holdBonus(m, lead);
      if (m.pinned) m.nextBreak = turn + 10;
      if (contest(a, d)) {
        const strongest = lead;
        release(strongest); m.pinned = false;
        L(`${m.id} breaks free of ${strongest.id}${m.grips.length ? ` (${m.grips.length} still holding)` : ""}`);
      } else L(`${m.id} strains against ${g.length} grappler${g.length > 1 ? "s" : ""} (ST ${Math.round(a)} vs ${Math.round(d)})`);
      return true;
    }
    // damage bonus for All-Out Attack (Strong) and Mighty Blows, for planning
    const boosted = (w, k) => ({ ...w.dmg, add: w.dmg.add + k * Math.max(2, w.dmg.n), key: "b" + k });

    // a model's condition for the replay: share of HP left, or the worst wound box under Fractional Health
    const vit = m => {
      if (!frac) return Math.max(0, Math.min(1, m.hp / m.u.HP));
      let worst = 0;
      for (const W of Object.values(m.wounds)) for (let l = 8; l > worst; l--) if (W[l] > 0) { worst = l; break; }
      return 1 - worst / 8;
    };
    // condition bits for the replay: 1 stunned, 2 prone, 4 kneeling, 8 held, 16 holding, 32 All-Out Defense,
    // 64 All-Out Attack, 128 aiming, 256 pinned, 512 waiting
    const bits = m => (m.stunned ? 1 : 0) | (m.prone ? 2 : 0) | (m.kneel ? 4 : 0) | (m.grips.length ? 8 : 0) | (m.holding ? 16 : 0) | (m.aod ? 32 : 0) | (m.aoa ? 64 : 0) | (m.aimTurns > 0 ? 128 : 0) | (m.pinned ? 256 : 0) | (m.waiting ? 512 : 0);
    const snap = () => models.map(m => {
      const path = m.trail; m.trail = [];
      return m.h ? [m.h.q, m.h.r, m.u.side, m.state === "ok" ? (m.stunned ? 2 : m.prone ? 3 : 1) : 0, m.facing, Math.round(vit(m) * 100) / 100, path,
        bits(m), m.u.shield ? Math.round(100 * Math.max(0, m.sp) / m.u.shield.sp) / 100 : -1, m.aimTarget && m.aimTurns > 0 ? m.aimTarget.ix : -1] : null;
    });
    let turn = 0;
    for (turn = 1; turn <= maxTurns; turn++) {
      if (!sideActive(0) || !sideActive(1)) break;
      L(`— Turn ${turn} —`); fieldCache.clear(); turnNow = turn - 1;
      if (frames) { if (turn > 1) { fx.push(fxb); fxb = []; } frames.push(snap()); }
      for (const m of models) {
        const sh = m.u.shield;
        if (!sh || m.state !== "ok" || m.sp >= sh.sp || !sh.recharge) continue;
        const delay = (sh.delay || 2) * (m.spCollapsed ? 2 : 1);
        if (turn - m.spHit > delay) { m.sp = Math.min(sh.sp, m.sp + sh.recharge); if (m.sp >= sh.sp) m.spCollapsed = false; }
      }
      for (const m of models) if (m.state === "ok" && m.h && !m.u.routed && !m.stunned) firingLine(m);
      lookAround();
      assignRoles();
      // the order is fixed for the fight (B363): Basic Speed, then DX, then a roll made at the start
      const order = models.filter(active).sort((a, b) => (b.u.speed - a.u.speed) || (b.u.dx - a.u.dx) || (a.init - b.init));
      for (const m of order) {
        if (m.state !== "ok" || m.u.routed || !m.h) continue;
        if (!sideActive(0) || !sideActive(1)) break;
        // per-turn defence limits last from one of the model's turns to the next (B363, B375-377)
        m.parries = 0; m.dodges = 0; m.retreated = false; m.retreatFrom = null; m.blocked = false; m.attacked = false; m.stunRecovering = false;
        m.committed = false; m.defAtk = false; m.aoa = false; m.aod = false; m.mna = false; m.offBalance = false;   // "until its next turn", whatever it does with it
        if (!frac && m.hp <= 0) {
          const k = Math.floor(-m.hp / m.u.HP);
          if (!check(m.u.HT - k + (m.berserk ? 4 : 0) + (m.u.flags.hts || 0)).ok) { FX(["d", m.h.q, m.h.r, m.u.side, 0]); m.state = "out"; place(m, null); L(`${m.id} collapses unconscious`); continue; }
        }
        if (m.onFire) { burn(m); if (m.state !== "ok") continue; }
        // at 0 FP or less, a Will roll before each maneuver; failure collapses it for the fight (B426)
        if (m.fp <= 0 && !m.u.flags.machine && !check(m.u.will).ok) { incapacitate(m, "collapses from exhaustion"); continue; }
        // a stunned model that recovers still defends at -4, without retreating, until its next turn (B364)
        if (m.stunned) { m.ev = null; }
        if (m.stunned) { if (recoverStun(m)) { m.stunned = false; m.stunRec = null; m.stunT = 0; m.stunRecovering = true; L(`${m.id} recovers from stun`); } m.shock = 0; m.shockInj = 0; m.shockCap = 0; continue; }
        if (underFire(m)) { m.shock = 0; m.shockInj = 0; m.shockCap = 0; continue; }
        if (m.holding && (m.holding.state !== "ok" || !m.holding.h || hexDist(m.h, m.holding.h) > 1)) release(m);
        // grapplers it out-muscles more than twice over, or that are far smaller, are only extra encumbrance (B370)
        { const weak = gripsOn(m).filter(g => hangsOn(g, m)); if (weak.length && weak.length === gripsOn(m).length && !m.pinned) { for (const g of weak) release(g); L(`${m.id} shrugs off ${weak.length} clinging foe${weak.length > 1 ? "s" : ""}`); } }
        // pinned, all it can do is struggle; held on the ground it may also fight back from where it lies
        if (gripsOn(m).length && m.pinned) { if ((m.nextBreak || 0) <= turn) breakFree(m); else L(`${m.id} lies pinned`); m.shock = 0; m.shockInj = 0; m.shockCap = 0; continue; }
        if (!m.warpShadow && shadowed(m) && !m.u.flags.unfazeable && !m.u.flags.noMorale) {
          m.warpShadow = true;
          const fc = fright(m.u);
          if (!fc.ok) { L(`${m.id} feels the Shadow in the Warp close over its mind`); frightTable(m, -fc.margin, "Shadow in the Warp"); m.shock = 0; m.shockInj = 0; m.shockCap = 0; if (m.state !== "ok" || m.stunned) continue; }
          L(`${m.id} steels itself against the Shadow in the Warp`);
        }
        act(m);
        m.shock = 0; m.shockInj = 0; m.shockCap = 0;
        seizeOpenings();
      }
      // Regeneration (B80): HP back each second; under Fractional Health the healing clears the least severe
      // wound box once enough has built up to cover that level's threshold
      for (const m of models) {
        const rate = m.u.flags.regen;
        if (!rate || (m.state !== "ok" && m.state !== "down")) continue;
        if (!frac) { if (m.hp < m.u.HP) m.hp = Math.min(m.u.HP, m.hp + rate); continue; }
        m.regenAcc = (m.regenAcc || 0) + rate;
        for (let l = 1; l <= 7; l++) {
          const need = Math.max(1, m.u.HP * FRAC[l]);
          const k = Object.keys(m.wounds).find(x => m.wounds[x][l] > 0);
          if (!k) continue;
          if (m.regenAcc >= need) { m.wounds[k][l]--; m.regenAcc -= need; L(`${m.id}'s living metal knits a ${SEVN[l]} wound to ${k.replace(/[LR]$/, "")}`); }
          break;
        }
      }
      // regrowing bio-weapon ammunition
      for (const m of models) {
        const w = m.u.ranged;
        if (!w || !w.natural || m.state !== "ok" || w.shots.reload <= 3 || m.ammo > 0) continue;
        if (m.reload <= 0) m.reload = w.shots.reload;
        if (--m.reload <= 0) { m.reload = 0; m.ammo = w.shots.mag; }   // grown, not carried: no magazines used
      }
      // bleeding (B420), once a minute in standard mode: HT at -1 per 5 HP lost; a failure costs 1 HP (3 on a critical
      // failure); a critical success or three successes in a row stop it; No Blood and Diffuse don't bleed, and nor do
      // wounds that were all crushing or burning
      if (!frac && turn % 60 === 0) for (const m of models) {
        if (m.state !== "ok" || m.hp >= m.u.HP || m.u.flags.noblood || m.u.flags.diffuse || m.u.flags.machine || !m.bleeds || m.bleedStop) continue;
        const r = check(m.u.HT - Math.floor((m.u.HP - m.hp) / 5));
        if (r.ok) { m.bleedOK = (m.bleedOK || 0) + 1; if (r.crit || m.bleedOK >= 3) { m.bleedStop = true; L(`${m.id}'s bleeding stops`); } continue; }
        m.bleedOK = 0; const lose = r.fumble ? 3 : 1; m.hp -= lose; L(`${m.id} bleeds (${lose} HP)`);
        if (m.hp <= 0 && !check(m.u.HT).ok) incapacitate(m, "bleeds out");
      }
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
          if (h) { for (let i = 0; i < 8 && taken(key(h.q, h.r)); i++) h = { q: h.q + DIRS[i % 6][0], r: h.r + DIRS[i % 6][1] }; }
          place(m, h && !taken(key(h.q, h.r)) ? h : null);
          if (!m.h) { m.state = "phased"; continue; }
          L(`${m.id} reanimates`);
        } else if (r.fumble || --m.reanim <= 0) { m.state = "phased"; L(`${m.id} phases out`); }
      }
      // morale, squad by squad: Fright Checks at half and at a quarter strength, and when the squad's leader falls
      if (morale) for (const g of groups) {
        if (g.units.every(u => u.routed || u.flags.unfazeable || u.flags.noMorale)) continue;
        const alive = g.models.filter(active).length;
        const frac2 = alive / g.count;
        let need = false, why = "casualties";
        if (frac2 <= 0.5 && !g.checked50) { g.checked50 = true; need = true; }
        if (frac2 <= 0.25 && !g.checked25) { g.checked25 = true; need = true; }
        // the leader down (a Mass Combat rule, p. 30, brought to the squad): the next in command rolls Leadership to
        // avert panic; failing, or with no one to take over, the squad makes its Fright Checks
        if (g.hadLeader && !g.models.some(x => x.u.leader && active(x)) && alive > 0) {
          g.hadLeader = false;
          const next = g.models.filter(x => active(x) && !x.u.leader).map(x => ({ x, l: skillOf(x.u, /^Leadership/) })).sort((a, b) => b.l - a.l)[0];
          if (next && next.l > -Infinity && check(next.l - skillPen(next.x)).ok) L(`${next.x.id} takes command of ${g.name} (Leadership)`);
          else { need = true; why = "leader down"; L(`${g.name} loses its leader`); }
        }
        if (need && alive > 0) {
          L(`${g.name} ${why === "leader down" ? "wavers" : "takes heavy losses"}: Fright Checks`);
          const failed = [];
          for (const m of g.models) { if (m.state !== "ok" || m.berserk || m.u.flags.unfazeable || m.u.flags.noMorale) continue; const fc = fright(m.u, ledBonus(m), Infinity); if (!fc.ok) { frightTable(m, -fc.margin, why); failed.push(m); } }
          commissar(g, failed);
          if (!g.models.some(active)) { for (const u of g.units) u.routed = true; L(`${g.name} breaks and flees`); }
        }
      }
      for (const m of models) if (m.h) m.lastH = m.h;
    }
    if (frames) { fx.push(fxb); fxb = []; frames.push(snap()); fx.push([]); }
    const a = sideActive(0), b = sideActive(1);
    const winner = a && !b ? 0 : b && !a ? 1 : -1;
    const timeout = a && b;
    L(winner >= 0 ? `Side ${winner === 0 ? "A" : "B"} wins in ${turn - 1} turns` :
      timeout ? `Still fighting when the ${maxTurns}-second limit ran out` : `Both sides destroyed or broken after ${turn - 1} turns`);
    return {
      winner, timeout, turns: turn - 1, log, frames, fx, terrain: frames && terr ? { floor: [...terr.floor], crates: [...terr.crates], doors: [...terr.doors], shut: [...startShut], events: tev, light: [...terr.floor].map(k => { const [q, r] = k.split(",").map(Number); return [k, darkAt({ q, r })]; }).filter(x => x[1]),
        elev: EL ? terr.hx.map((h, i) => [key(h.q, h.r), EL[i]]).filter(x => x[1]) : [], kind: terr.kind || "facility",
        wallTop: WT ? terr.hx.map((h, i) => [key(h.q, h.r), WT[i]]).filter((x, i) => terr.wallI[i] && x[1] < 99) : null } : null,
      ridge: frames && RIDGE ? { ...RIDGE } : null, roster: models.map(m => { const u = m.u; return { id: m.id, side: u.side, unit: u.idx, template: u.template, faction: u.ai.name, speed: u.speed, move: u.move, hp: u.HP, st: u.st, dx: u.dx, dodge: u.dodge, parry: u.parry, dr: drAt(u.arm.dr, "torso") + drAt(u.nat, "torso"), sp: u.shield ? u.shield.sp : 0, sm: u.sm || 0, body: u.body || "upright",
        ranged: u.ranged ? `${u.ranged.name} (${u.ranged.text}${u.ranged.followText ? " + " + u.ranged.followText : ""})` : "", melee: `${u.melee.name} (${u.melee.text})`, kills: m.kills, fate: m.state }; }),
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
    const res = { runs, wins: [0, 0], draws: 0, timeouts: 0, mutual: 0, turns: 0, units: null, sample: null, runsList: [] };
    const terrain = battleMap(opt);
    for (let i = 0; i < runs; i++) {
      const r = runBattle(unitSpecs, { ...opt, terrain, log: i === 0, frames: i === 0 });
      if (i === 0) res.sample = r;
      if (r.winner < 0) { res.draws++; if (r.timeout) res.timeouts++; else res.mutual++; } else res.wins[r.winner]++;
      res.runsList.push([r.turns, r.winner]);
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

  return { index, buildUnit, describe, runBattle, monteCarlo, parseDamage, seed, woundMult, fmtDice, px, facilityMap, ruinsMap, fromOffset, rangePenalty, DIRS, squadSpecs,
    get squads() { return SQUADS; },
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
  const shieldOpts = Object.keys(DATA.simWeapons || {}).filter(n => DATA.simWeapons[n]._item && DATA.simWeapons[n]._item.db).sort();
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
      ranged2: lo.ranged2 ? { ...lo.ranged2 } : null, shield: lo.shield ? { ...lo.shield } : null, carried: lo.carried || null, grenades: (lo.grenades || []).map(g => ({ ...g })), body: lo.body, mags: lo.mags, knife: lo.knife ? { ...lo.knife } : null, skills: lo.skills ? { ...lo.skills } : undefined };
  }
  const MAPPED = () => S.battlefield === "facility" || S.battlefield === "ruins";
  const PRESETS = [
    ["20 Guardsmen vs 5 Space Marines", [["Astra Militarum Guardsman", 20]], [["Astartes Battle-Brother", 5]], 150],
    ["10 Ork Boyz charge 5 Marines", [["Ork Boy", 10]], [["Astartes Battle-Brother", 5]], 40],
    ["Custodian vs 3 Marines", [["Custodian Guardian", 1]], [["Astartes Battle-Brother", 3]], 20],
    ["Fire Warriors vs Necron Warriors", [["Fire Warrior (Shas'la)", 10]], [["Necron Warrior", 10]], 100],
    ["Wyches vs Guardsmen", [["Wych", 10]], [["Astra Militarum Guardsman", 10]], 30],
    ["Genestealers vs Marines", [["Genestealer", 5]], [["Astartes Battle-Brother", 5]], 40],
    ["Facility: 5 Marines vs 10 Genestealers", [["Astartes Battle-Brother", 5]], [["Genestealer", 10]], 60, "facility"],
    ["Facility: 20 Guardsmen vs 20 Ork Boyz", [["Astra Militarum Guardsman", 20]], [["Ork Boy", 20]], 60, "facility"],
    ["Ruins: 10 Genestealers vs a Tactical squad", [["Genestealer", 10]], [["squad:Astartes Tactical Squad"]], 60, "ruins"],
    ["Ruins: 2 Guard squads vs Ork Boyz", [["squad:Astra Militarum Infantry Squad"], ["squad:Astra Militarum Infantry Squad"]], [["squad:Ork Boyz Mob"]], 60, "ruins"],
    ["Lascannon teams vs a Carnifex", [["squad:Heavy Weapons Squad (Lascannons)"]], [["Carnifex", 1]], 150],
    ["Mortars and a Guard squad vs 30 Hormagaunts", [["squad:Heavy Weapons Squad (Mortars)"], ["squad:Astra Militarum Infantry Squad"]], [["Hormagaunt", 30]], 150],
    ["Meltaguns and a Guard squad vs a Carnifex", [["squad:Special Weapons Squad (Meltaguns)"], ["squad:Astra Militarum Infantry Squad"]], [["Carnifex", 1]], 60],
    ["Squads: Commissar's squad vs Ork Boyz", [["squad:Astra Militarum Infantry Squad with Commissar"]], [["squad:Ork Boyz Mob"]], 80],
    ["Squads: Tactical vs Chaos", [["squad:Astartes Tactical Squad"]], [["squad:Chaos Space Marine Squad"]], 40],
    ["Squads: 3 Guard squads vs a Tactical squad", [["squad:Astra Militarum Infantry Squad"], ["squad:Astra Militarum Infantry Squad"], ["squad:Astra Militarum Infantry Squad"]], [["squad:Astartes Tactical Squad"]], 100],
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
        ${d.carried ? `<span><b>${esc(d.carried.name)}</b>DB ${d.carried.db}${d.carried.dr != null ? ` · DR ${d.carried.dr} · ${d.carried.hp} HP` : ""}</span>` : ""}
        ${d.shield ? `<span><b>Field</b>${d.shield.sp} SP${d.shield.recharge ? "" : ", no recharge"}</span>` : ""}</div>
        <div class="prof">${r ? `<span><b>Ranged</b>${esc(r.name)}: ${esc(r.dmg)}${r.follow ? " + " + esc(r.follow) : ""}, skill ${r.skill}, Acc ${r.acc}, RoF ${r.rof}, ${r.range.half}/${r.range.max} yd</span>` : ""}
        <span><b>Melee</b>${esc(m.name)}: ${esc(m.dmg)}, skill ${m.skill}</span></div>`;
    } catch (e) { return `<div class="prof err">${esc(e.message)}</div>`; }
  }
  const ptsOf = name => { const l = TEMPL.find(x => x.title === name); return l ? l.template.points : 0; };
  // one pip per model (up to 30), so a mob looks like a mob
  const pips = n => `<span class="pips" aria-hidden="true">${"<i></i>".repeat(Math.min(n, 30))}${n > 30 ? `<em>+${n - 30}</em>` : ""}</span>`;
  function unitCard(u, si, ui) {
    const p = ptsOf(u.template);
    return `<div class="sunit" data-s="${si}" data-u="${ui}">
      <div class="shead"><input type="number" min="1" max="200" value="${u.count}" data-f="count" aria-label="Models"><b>${esc(u.role || u.template)}${u.role || p ? `<small>${u.role ? esc(u.template) + (p ? " · " : "") : ""}${p ? `${p.toLocaleString("en-US")} pts each` : ""}</small>` : ""}</b>
        <select data-f="stance" aria-label="Stance">${["shoot", "advance", "charge"].map(s => `<option${s === u.stance ? " selected" : ""}>${s}</option>`).join("")}</select>
        <button class="x" data-del aria-label="Remove unit">×</button></div>
      ${pips(u.count)}
      ${profile(u)}
      <details class="lo"><summary>Loadout</summary><div class="lgrid">
        <label>Armour ${armourSelect(u, 0)}</label><label>Armour 2 ${armourSelect(u, 1)}</label>
        <label>Ranged ${weaponSelect(u, "ranged")}</label><label>Melee ${weaponSelect(u, "melee")}</label>
        <label class="chk"><input type="checkbox" data-amb${u.ambush ? " checked" : ""}> Lies in ambush (facility)</label>
        <label>Carried shield <select data-cs><option value="">None</option>${shieldOpts.map(n => `<option${n === u.carried ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
        <label class="sh">Energy field <input type="checkbox" data-sh${u.shield ? " checked" : ""}>
          ${u.shield ? `SP <input type="number" data-shf="sp" value="${u.shield.sp}"> delay <input type="number" data-shf="delay" value="${u.shield.delay}"> recharge/s <input type="number" data-shf="recharge" value="${u.shield.recharge}">` : ""}</label>
      </div>${LO[u.template] && LO[u.template].note ? `<p class="lonote">${esc(LO[u.template].note)}</p>` : ""}</details></div>`;
  }
  // a squad's members stay separate cards (each with its own loadout) under one heading for the squad
  function squadHead(u, si) {
    const ms = S.sides[si].filter(x => x.squad === u.squad), n = ms.reduce((a, x) => a + x.count, 0), pts = ms.reduce((a, x) => a + x.count * ptsOf(x.template), 0);
    return `<div class="squad-h"><b>${esc(u.squadName || u.squad)}</b><small>${n} models${pts ? ` · ${pts.toLocaleString("en-US")} pts` : ""}</small><button class="x" data-delsq="${si}" data-sq="${esc(u.squad)}" aria-label="Remove squad">×</button></div>`;
  }
  // squads added from the picker get a tag unique on the page; n numbers a second squad of the same kind
  function addSquad(si, name) {
    const SQ = SIM.squads[name], short = (SQ && SQ.short) || name;
    const n = new Set(S.sides.flat().filter(x => x.squad && x.squadName && x.squadName.startsWith(short)).map(x => x.squad)).size + 1;
    return SIM.squadSpecs(name, `${name}#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, n).map(sp => ({ ...newUnit(sp.template, sp.count), ...sp, armour: sp.armour || [] }));
  }
  const expand = (list, si) => list.flatMap(([t, n]) => t.startsWith("squad:") ? addSquad(si, t.slice(6)) : [newUnit(t, n)]);
  function tmplOptions() {
    const groups = {};
    for (const l of TEMPL) (groups[l.section.replace(/\/Templates$/, "").replace(/\//g, " › ")] ||= []).push(l.title);
    const sq = Object.keys(SIM.squads || {});
    return `<option value="">Add a unit…</option>` + (sq.length ? `<optgroup label="Squads (lore organisation)">${sq.map(n => `<option value="squad:${esc(n)}">${esc(n)}</option>`).join("")}</optgroup>` : "") + Object.entries(groups).map(([g, ts]) => `<optgroup label="${esc(g)}">${ts.map(t => `<option>${esc(t)}</option>`).join("")}</optgroup>`).join("");
  }

  let last = null;
  function render() {
    const sidePts = si => S.sides[si].reduce((a, u) => a + u.count * ptsOf(u.template), 0);
    const side = si => `<section class="sside"><h2>Side ${"AB"[si]}${sidePts(si) ? `<small>${sidePts(si).toLocaleString("en-US")} pts</small>` : ""}</h2>${S.sides[si].map((u, ui) => (u.squad && (ui === 0 || S.sides[si][ui - 1].squad !== u.squad) ? squadHead(u, si) : "") + unitCard(u, si, ui)).join("") || `<p class="empty">No units yet.</p>`}
      <select class="addu" data-add="${si}" aria-label="Add a unit to side ${"AB"[si]}">${tmplOptions()}</select></section>`;
    $("#main").innerHTML = `<header class="libhead"><div class="eyebrow">Tools</div><h1>Combat Simulator</h1>
      <p>Pit units against each other using their templates and default loadouts. Every run plays a full GURPS fight second by second; the result is the spread over many runs.</p></header>
      <div class="spresets">${PRESETS.map((p, i) => `<button class="chip tag" data-preset="${i}">${esc(p[0])}</button>`).join("")}</div>
      <form class="sset" onsubmit="return false">
        <fieldset><legend>Engagement</legend>
          <label for="s-dist">Starting distance <span><input id="s-dist" type="number" min="1" max="3000" value="${S.distance}" data-g="distance"> yd</span></label>
          <label for="s-runs">Battles to fight <input id="s-runs" type="number" min="1" max="2000" value="${S.runs}" data-g="runs"></label>
          <label for="s-turns">Time limit <span><input id="s-turns" type="number" min="5" max="3600" value="${S.maxTurns}" data-g="maxTurns"> s</span></label>
          <label class="chk" for="s-morale"><input id="s-morale" type="checkbox" data-g="morale"${S.morale ? " checked" : ""}> Morale (Fright Checks)</label>
        </fieldset>
        <fieldset><legend>Rules</legend>
          <label for="s-loc">Hit locations <select id="s-loc" data-o="locations"><option value="elite"${!S.locations || S.locations === "elite" ? " selected" : ""}>Elites aim</option><option value="aimed"${S.locations === "aimed" ? " selected" : ""}>Everyone aims (RAW)</option><option value="random"${S.locations === "random" ? " selected" : ""}>Random</option></select></label>
          <label for="s-hp">Wounds <select id="s-hp" data-h><option value="standard"${S.health !== "fractional" ? " selected" : ""}>Standard HP</option><option value="fractional"${S.health === "fractional" ? " selected" : ""}>Fractional Health</option></select></label>
          <label class="chk" for="s-sight"><input id="s-sight" type="checkbox" data-g="sightedShots"${S.sightedShots ? " checked" : ""}> Aimed shots are All-Out Attacks (Tactical Shooting)</label>
          <label class="chk" for="s-ldodge"><input id="s-ldodge" type="checkbox" data-g="limitedDodges"${S.limitedDodges !== false ? " checked" : ""}> -1 per extra dodge in a turn (Martial Arts; on by default)</label>
          <label class="chk" for="s-cine"><input id="s-cine" type="checkbox" data-g="cinematicEffort"${S.cinematicEffort ? " checked" : ""}> Cinematic extra effort: Heroic Charge (Martial Arts)</label>
          <label class="chk" for="s-tdodge"><input id="s-tdodge" type="checkbox" data-g="tacticalDodge"${S.tacticalDodge ? " checked" : ""}> Dodge gunfire from one shooter only (Tactical Shooting)</label>
          ${S.health === "fractional" ? `<label for="s-box">Boxes per level <input id="s-box" type="number" min="1" max="9" value="${S.boxes || 5}" data-g="boxes"></label>` : ""}
        </fieldset>
        <fieldset><legend>Battlefield</legend>
          <label for="s-bf">Ground <select id="s-bf" data-o="battlefield"><option value="open"${!S.battlefield || S.battlefield === "open" ? " selected" : ""}>Open ground</option><option value="facility"${S.battlefield === "facility" ? " selected" : ""}>Facility</option><option value="ruins"${S.battlefield === "ruins" ? " selected" : ""}>Ruins</option></select></label>
          ${MAPPED() ? `<label for="s-aw">Knowledge <select id="s-aw" data-o="awareness"><option value="limited"${S.awareness !== "omniscient" ? " selected" : ""}>Only what they've seen</option><option value="omniscient"${S.awareness === "omniscient" ? " selected" : ""}>Everyone sees everything</option></select></label>
          <label for="s-lt">Lighting <select id="s-lt" data-o="lighting"><option value="mixed"${!S.lighting || S.lighting === "mixed" ? " selected" : ""}>Mixed (dim and dark rooms)</option><option value="lit"${S.lighting === "lit" ? " selected" : ""}>All lit</option><option value="dark"${S.lighting === "dark" ? " selected" : ""}>Dark (−7)</option></select></label>` : ""}
          ${!MAPPED() ? `<label for="s-rg">Ridge <select id="s-rg" data-o="ridge"><option value=""${!S.ridge ? " selected" : ""}>none (flat)</option><option value="0"${S.ridge === "0" ? " selected" : ""}>held by side A</option><option value="1"${S.ridge === "1" ? " selected" : ""}>held by side B</option></select></label>
          ${S.ridge ? `<label for="s-rh">Ridge height <span><input id="s-rh" type="number" min="1" max="30" value="${S.ridgeH || 8}" data-g="ridgeH"> yd</span></label>` : ""}` : ""}
          ${MAPPED() ? `<label for="s-map">Layout number <input id="s-map" type="number" min="1" max="9999" value="${S.mapSeed || 1}" data-g="mapSeed"></label>` : ""}
          <label for="s-ca">Cover, side A <select id="s-ca" data-o="coverA"><option${(S.coverA || "none") === "none" ? " selected" : ""}>none</option><option${S.coverA === "light" ? " selected" : ""}>light</option><option${S.coverA === "heavy" ? " selected" : ""}>heavy</option></select></label>
          <label for="s-cb">Cover, side B <select id="s-cb" data-o="coverB"><option${(S.coverB || "none") === "none" ? " selected" : ""}>none</option><option${S.coverB === "light" ? " selected" : ""}>light</option><option${S.coverB === "heavy" ? " selected" : ""}>heavy</option></select></label>
        </fieldset>
        <div class="go"><button class="run" id="simrun" type="button">Run simulation</button><p>${S.battlefield === "facility" ? "Each side deploys in its staging bay; starting distance is ignored." : S.battlefield === "ruins" ? "Each side deploys at its end of the ruined block; starting distance is ignored." : "Sides deploy in lines facing each other at the starting distance."}</p></div>
      </form>
      <div class="sgrid">${side(0)}${side(1)}</div>
      <div id="simout">${last ? results(last) : ""}</div>
      <details class="more"><summary>How the simulator works</summary><p>${esc(HOW)}</p></details>`;
    wire();
    if (last) setupReplay();
  }
  const HOW = `Every run plays a full GURPS 4e fight on a hex map, one yard per hex, second by second. Models act in Basic Speed order and an AI picks each one's maneuver: Aim, Attack, Move and Attack, All-Out Attack (Determined or Double) when nothing can hurt it, All-Out Defense when it can't hurt its foe, Feint and Deceptive Attack against strong defences, Rapid Strike, Ready to reload or clear a jam, Change Posture, and Concentrate for psychic powers. Facing matters: attacks from a flank cost the defender 2, from behind it gets no defence, so surrounding a foe pays. Elite attackers (best combat skill 17+, IQ 8+) aim at the location that does most harm (vitals, skull, eye lens at −10, neck, limbs, or a chink in the armour at −8 or −10 that halves its DR); everyone else hits random locations, with 1 in 6 face hits striking an eye lens. The setting can let everyone aim, as RAW allows, or no one. Ranged fire uses range penalties, per-round rolls with climbing Recoil for automatic fire, and can malfunction or overheat; explosions splash neighbours, fragments fly, flamers hit the whole cone. Defenders Dodge, Parry or Block with retreat and shield DB, and shooters Dodge and Drop. Cover hides legs and groin and costs attackers 2; prone models are harder to shoot but fight badly. Armour divisors, Weak Points, regenerating shields, wounding, Injury Tolerance, Damage Reduction, follow-ups, crippling, knockback, bleeding, shock, stun, consciousness and death rolls, Reanimation Protocols, morale and Perils of the Warp all apply, with either standard HP or the Revised Fractional Health wound system. The full rule list with page references is docs/simulator.md. A charging mob that can barely hurt its foe grabs it, drags it down and pins it (B370), then the rest lay in with All-Out Attack (Strong) and Mighty Blows (1 FP). Not modelled: vehicles and stealth.`;

  function results(r) {
    const pct = x => Math.round(100 * x / r.runs);
    const sideUnits = si => r.units.filter(u => u.side === si);
    const roster = si => sideUnits(si).map(u => `<span>${u.count} × ${esc(u.name)}</span>`).join("");
    const wA = pct(r.wins[0]), wB = pct(r.wins[1]), wD = 100 - wA - wB;
    const lead = wA > wB + 10 ? 0 : wB > wA + 10 ? 1 : -1;
    const verdict = lead < 0 ? "Too close to call" : `Side ${"AB"[lead]} is favoured`;
    return `<section class="verdict" aria-label="Result over ${r.runs} battles">
        <div class="vside a${lead === 0 ? " lead" : ""}"><span class="vlab">Side A wins</span><b>${wA}<small>%</small></b><div class="vros">${roster(0)}</div></div>
        <div class="vmid"><span class="vsays">${verdict}</span><span class="vvs">vs</span><span class="vmeta">${r.runs} battles · average ${r.turns.toFixed(1)} s${r.timeouts ? ` · ${pct(r.timeouts)}% ran out of time` : ""}${r.mutual ? ` · ${pct(r.mutual)}% mutual ruin` : ""}</span></div>
        <div class="vside b${lead === 1 ? " lead" : ""}"><span class="vlab">Side B wins</span><b>${wB}<small>%</small></b><div class="vros">${roster(1)}</div></div>
      </section>
      <div class="vbar" role="img" aria-label="Side A ${wA}%, neither ${wD}%, side B ${wB}%"><span class="a" style="flex:${wA}"></span><span class="d" style="flex:${wD}"></span><span class="b" style="flex:${wB}"></span></div>
      <div class="rgrid">
        <figure class="rcard"><figcaption>How long the battles lasted</figcaption>${histogram(r)}</figure>
        <figure class="rcard"><figcaption>What was left of each unit (average)</figcaption>${casualties(r)}</figure>
      </div>
      <h2>One battle on the table</h2>
      <div class="vtt" id="vtt">
        <div class="vtt-main">
          <canvas class="vtt-c" id="vtt-c" aria-label="Battle map. Drag to pan, scroll or pinch to zoom, click a token to see its sheet."></canvas>
          <div class="vtt-3d" id="vtt-3d" hidden aria-label="Battle in 3D. Drag to orbit, right-drag or Shift-drag to pan, scroll or pinch to zoom, click a figure to see its sheet."></div>
          <div class="vtt-hud"><span class="hud-a" id="hudA"></span><span class="clock" id="rlab"></span><span class="hud-b" id="hudB"></span></div>
          <div class="vtt-tools" role="toolbar" aria-label="Map tools">
            <button type="button" data-tool="3d" aria-pressed="false" title="Show the battle in 3D (loads three.js)">3D</button>
            <button type="button" data-tool="walls" aria-pressed="false" title="Lower the walls to see into the rooms" hidden>Low walls</button>
            <button type="button" data-tool="fit" title="Fit the battle to the view">Fit</button>
            <button type="button" data-tool="grid" aria-pressed="true" title="Show the hex grid">Grid</button>
            <button type="button" data-tool="trails" aria-pressed="true" title="Show each model's path this second">Paths</button>
            <button type="button" data-tool="measure" aria-pressed="false" title="Drag between two hexes to measure range">Measure</button>
          </div>
          <div class="vtt-tip" id="vtt-tip" hidden></div>
        </div>
        <aside class="vtt-side">
          <div class="vtt-tabs" role="tablist"><button type="button" role="tab" data-tab="init" aria-selected="true">Initiative</button><button type="button" role="tab" data-tab="chat" aria-selected="false">Log</button><button type="button" role="tab" data-tab="sheet" aria-selected="false">Sheet</button></div>
          <div class="vtt-pane" id="vtt-init"></div>
          <div class="vtt-pane" id="vtt-chat" hidden></div>
          <div class="vtt-pane" id="vtt-sheet" hidden><p class="vtt-empty">Click a token on the map, or a name in the initiative list.</p></div>
        </aside>
        <div class="vtt-time">
          <button type="button" id="rback" title="Back one second" aria-label="Back one second">◂◂</button>
          <button type="button" id="rplay" class="primary" aria-label="Play">Play</button>
          <button type="button" id="rstep" title="Forward one second" aria-label="Forward one second">▸▸</button>
          <div class="vtt-track"><div class="vtt-ticks" id="vtt-ticks"></div><input id="rturn" type="range" min="0" max="${Math.max(0, r.sample.frames.length - 1)}" value="0" aria-label="Second"></div>
          <label for="rspeed">Speed <select id="rspeed"><option value="1400">½×</option><option value="800" selected>1×</option><option value="420">2×</option><option value="200">4×</option></select></label>
        </div>
      </div>
      <p class="rleg">Drag to pan, scroll or pinch to zoom, click a token for its sheet. Space plays and pauses; the arrow keys step. Tokens: rim colour is the side, bar is health (blue above it is a shield). Badges: <b>S</b> stunned, <b>P</b> prone, <b>K</b> kneeling, <b>G</b> held, <b>H</b> holding, <b>D</b> All-Out Defense, <b>A</b> All-Out Attack, <b>W</b> waiting; a dotted line shows what a model is aiming at. Floating numbers are injury; grey is a hit armour stopped.</p>
      <details class="more"><summary>Blow-by-blow of the whole battle</summary><pre class="slog">${esc(r.sample.log.join("\n"))}</pre></details>`;
  }
  // battle lengths, stacked by who won
  function histogram(r) {
    const runs = r.runsList || [];
    if (!runs.length) return "";
    const lens = runs.map(x => x[0]).sort((a, b) => a - b);
    const hi = Math.max(2, lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.97))]);
    const nb = Math.min(24, Math.max(6, hi));
    const bw = hi / nb;
    const bins = Array.from({ length: nb }, () => [0, 0, 0]);
    for (const [t, w] of runs) bins[Math.min(nb - 1, Math.floor(Math.min(t, hi) / bw * 0.99999))][w === 0 ? 0 : w === 1 ? 1 : 2]++;
    const top = Math.max(1, ...bins.map(b => b[0] + b[1] + b[2]));
    const W = 320, H = 150, L = 28, B = 22, T = 8, cw = (W - L - 6) / nb;
    const y = v => T + (H - T - B) * (1 - v / top);
    let bars = "";
    bins.forEach((b, k) => {
      let acc = 0;
      [[0, "a"], [2, "d"], [1, "b"]].forEach(([i, c]) => { if (!b[i]) return; const y0 = y(acc), y1 = y(acc + b[i]); bars += `<rect class="${c}" x="${(L + k * cw + 1).toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(1, cw - 2).toFixed(1)}" height="${(y0 - y1).toFixed(1)}"/>`; acc += b[i]; });
    });
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => { const x = L + f * nb * cw; return `<line class="tk" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${H - B}" y2="${H - B + 4}"/><text x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${Math.round(f * hi)}${f === 1 ? "s" : ""}</text>`; }).join("");
    return `<svg class="hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="Battle lengths"><line class="grid" x1="${L}" x2="${W - 6}" y1="${y(top / 2)}" y2="${y(top / 2)}"/><text x="${L - 5}" y="${y(top) + 4}" text-anchor="end">${top}</text><text x="${L - 5}" y="${y(top / 2) + 4}" text-anchor="end">${Math.round(top / 2)}</text>${bars}<line class="axis" x1="${L}" x2="${W - 6}" y1="${H - B}" y2="${H - B}"/>${ticks}</svg>`;
  }
  // per unit: still standing, fled, fallen but alive, killed
  function casualties(r) {
    return `<div class="cas">${r.units.map(u => {
      const dead = u.dead, up = u.standing, down = Math.max(0, u.count - up - dead);
      const seg = (v, c, t) => v > 0.005 ? `<span class="${c}" style="flex:${v.toFixed(3)}" title="${t}: ${v.toFixed(1)}"></span>` : "";
      return `<div class="crow"><div class="cname"><b class="s${u.side ? "b" : "a"}">${"AB"[u.side]}</b>${esc(u.name)}<span>${up.toFixed(1)} of ${u.count} standing</span></div>
        <div class="cbar">${seg(up, "up s" + (u.side ? "b" : "a"), "Standing")}${seg(down, "down", "Down or fled")}${seg(dead, "dead", "Killed")}</div>
        <div class="cfoot"><span>${u.dead.toFixed(1)} killed</span><span>${Math.round(100 * u.wiped / r.runs)}% wiped out</span><span>${Math.round(100 * u.routed / r.runs)}% broke</span><span>${u.dmg.toFixed(0)} HP dealt</span></div></div>`;
    }).join("")}<p class="ckey"><span class="k up"></span>standing <span class="k down"></span>down or fled <span class="k dead"></span>killed</p></div>`;
  }

  // ================= the tabletop: one battle replayed on a canvas, like a virtual tabletop =================
  // The map is painted once to an offscreen canvas (a battle-map palette, the same in either theme); tokens,
  // paths, shots, blows, blasts and floating injury are drawn over it each animation frame. Drag pans, the wheel
  // or a pinch zooms, a click opens a token's sheet.
  const MAP = { earth: "#5a5344", earth2: "#4c4638", rock: "#3a352c", crater: "#2b271f", wall: "#23262c", wallHi: "#6b717b", plate: "#5d6167", plate2: "#54585e",
    seam: "#3b3e44", grate: "#44484e", crateL: "#7a5a35", crateLd: "#4e3a22", crateH: "#8a8a84", crateHd: "#55554f", hazard: "#d4a52a", door: "#9aa1a8", doorD: "#2f3338",
    gridO: "rgba(0,0,0,.22)", gridF: "rgba(255,255,255,.07)", sideA: "#c23a30", sideB: "#d6a73c", sideAl: "#f08a7e", sideBl: "#f1d38a", ink: "#15161a", paper: "#f4f1e8",
    shield: "#58b6e8", hpHi: "#5fbf6a", hpMid: "#e3b341", hpLo: "#e0564b", shot: "#fff3c4", miss: "rgba(255,255,255,.35)", blast: "#ffb347" };
  const SQ3 = Math.sqrt(3), rangePenalty = SIM.rangePenalty, DIRN = SIM.DIRS;
  // the two corners bounding the edge toward each neighbour in DIRS (flat-topped hexes, corner i at i x 60 degrees)
  const EDGE = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];
  const hexCorner = (cx, cy, i, k = 1) => [cx + Math.cos(i * Math.PI / 3) * k, cy + Math.sin(i * Math.PI / 3) * k];
  function hexPath(g, cx, cy, k = 1) { g.beginPath(); for (let i = 0; i < 6; i++) { const [x, y] = hexCorner(cx, cy, i, k); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
  // a small repeatable random for textures, so the same map always looks the same
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // faction emblems: simple generated marks, drawn in unit space (radius about 0.45)
  const GLYPH = {
    Astartes(g) { g.beginPath(); g.moveTo(-.34, -.3); g.lineTo(.34, -.3); g.lineTo(.3, .12); g.lineTo(0, .38); g.lineTo(-.3, .12); g.closePath(); g.fill(); g.fillStyle = MAP.ink; g.fillRect(-.22, -.08, .44, .09); },
    Custodes(g) { g.fillRect(-.04, -.42, .08, .84); g.beginPath(); g.moveTo(0, -.46); g.lineTo(.13, -.26); g.lineTo(-.13, -.26); g.closePath(); g.fill(); g.lineWidth = .07; g.beginPath(); g.arc(0, .06, .3, Math.PI * .15, Math.PI * .85); g.stroke(); },
    "Adepta Sororitas"(g) { g.beginPath(); g.moveTo(0, -.4); g.lineTo(.12, -.08); g.lineTo(.4, 0); g.lineTo(.12, .08); g.lineTo(0, .4); g.lineTo(-.12, .08); g.lineTo(-.4, 0); g.lineTo(-.12, -.08); g.closePath(); g.fill(); },
    "Adeptus Mechanicus"(g) { g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? .3 : .42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = MAP.ink; g.beginPath(); g.arc(0, 0, .14, 0, 7); g.fill(); },
    "Imperial Guard"(g) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .17 : .42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); },
    "Inquisition and Psykers"(g) { g.lineWidth = .1; g.beginPath(); g.moveTo(-.2, -.36); g.lineTo(.2, .36); g.moveTo(.2, -.36); g.lineTo(-.2, .36); g.stroke(); g.beginPath(); g.arc(0, 0, .16, 0, 7); g.fill(); },
    Orks(g) { g.beginPath(); g.moveTo(-.36, -.26); g.lineTo(.36, -.26); g.lineTo(.3, .1); g.lineTo(.16, .36); g.lineTo(-.16, .36); g.lineTo(-.3, .1); g.closePath(); g.fill(); g.fillStyle = MAP.ink; g.beginPath(); g.moveTo(-.24, -.14); g.lineTo(-.04, -.04); g.lineTo(-.22, .04); g.closePath(); g.moveTo(.24, -.14); g.lineTo(.04, -.04); g.lineTo(.22, .04); g.closePath(); g.fill(); g.fillRect(-.14, .18, .28, .06); },
    Tyranids(g) { g.lineWidth = .09; g.lineCap = "round"; for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(s * .22, .34); g.quadraticCurveTo(s * .3 + .02, -.1, s * .08 + .12, -.38); g.stroke(); } },
    Necrons(g) { g.lineWidth = .08; g.beginPath(); g.arc(0, -.12, .2, 0, 7); g.stroke(); g.fillRect(-.04, .02, .08, .38); g.fillRect(-.24, .12, .48, .07); },
    Aeldari(g) { g.beginPath(); g.moveTo(0, -.42); g.lineTo(.12, 0); g.lineTo(0, .42); g.lineTo(-.12, 0); g.closePath(); g.fill(); g.lineWidth = .06; g.beginPath(); g.arc(0, 0, .3, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.beginPath(); g.arc(0, 0, .3, Math.PI * .15, Math.PI * .85); g.stroke(); },
    Drukhari(g) { g.beginPath(); g.moveTo(-.34, .3); g.lineTo(.38, -.4); g.lineTo(.08, .06); g.lineTo(.3, .1); g.lineTo(-.2, .36); g.closePath(); g.fill(); },
    "T'au"(g) { g.lineWidth = .07; g.beginPath(); g.arc(0, 0, .34, 0, 7); g.stroke(); g.beginPath(); g.arc(0, .06, .14, 0, 7); g.fill(); g.fillRect(-.03, -.34, .06, .2); },
    "Kroot and Vespid"(g) { g.beginPath(); g.moveTo(-.34, .3); g.quadraticCurveTo(0, -.6, .34, .3); g.quadraticCurveTo(0, .02, -.34, .3); g.fill(); },
    Default(g) { g.beginPath(); g.moveTo(0, -.38); g.lineTo(.3, 0); g.lineTo(0, .38); g.lineTo(-.3, 0); g.closePath(); g.fill(); },
  };
  const BADGES = [[1, "S", "#e3b341"], [2, "P", "#b9b4a8"], [4, "K", "#b9b4a8"], [8, "G", "#e0564b"], [16, "H", "#e0564b"], [32, "D", "#58b6e8"], [64, "A", "#e0564b"], [512, "W", "#b9b4a8"], [256, "N", "#e0564b"]];

  // ================= the 3D view: the same replay drawn with three.js, loaded on demand from cdnjs =================
  // Presentation only: the engine stays a flat hex map, one yard per hex. Height comes from each model's Size
  // Modifier and body posture; walls and doors are extruded; darkness shades the floor. Drag to orbit, right-drag
  // or Shift-drag (two fingers) to pan, wheel or pinch to zoom, click a figure for its sheet.
  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  let threeLoading = null;
  const loadThree = () => window.THREE ? Promise.resolve(window.THREE) : (threeLoading = threeLoading || new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = THREE_URL; s.async = true;
    s.onload = () => window.THREE ? ok(window.THREE) : no(new Error("three.js did not load"));
    s.onerror = () => { threeLoading = null; s.remove(); no(new Error("three.js could not be fetched")); };
    document.head.appendChild(s);
  }));
  // faction colours for the figures (the side shows in the base and trim)
  const FACTION3 = [[/Custodes/, 0xc9a347], [/Sororitas/, 0x2c2b30], [/Mechanicus/, 0x8e2a22], [/Khorne/, 0x8a1c1c], [/Rubric/, 0x1f6f78],
    [/Heretic|Chaos Space/, 0x2b2b2e], [/Traitor/, 0x5a4a3a], [/Cultist/, 0x6a5a48], [/Astartes/, 0x2d4f8a], [/Guard|Militarum/, 0x5b6a3e],
    [/Inquisition|Psyker/, 0x3b3b44], [/Ork/, 0x4f7a2e], [/Tyranid/, 0x6a3d7a], [/Necron/, 0x8c9298], [/Drukhari/, 0x3a2d4a],
    [/Aeldari/, 0x2c6e6a], [/T'au/, 0xb8a77c], [/Kroot|Vespid/, 0x7a6a4a]];
  const ARMOURED = /Astartes|Custodes|Heretic|Khorne|Rubric|Chaos Space/;
  // height by Size Modifier in feet (as the engine's height rules), SM 0 = 6 ft
  const HFT3 = { "-4": 1.5, "-3": 2, "-2": 3, "-1": 4.5, "0": 6, "1": 9, "2": 15, "3": 21, "4": 30, "5": 45, "6": 60 };
  function makeView3D(THREE, o) {
    const { host, fr, fx, T, ros, P, posAt, fallen } = o;
    // ground height (yards; a 3D unit is about a yard upward) under a hex, or under a world point
    const zOf = o.zOf || (() => 0);
    const zXY = (x, y) => { const q = x / 1.5, r = y / SQ3 - q / 2; let rx = Math.round(q), ry = Math.round(-q - r), rz = Math.round(r); const dx = Math.abs(rx - q), dy = Math.abs(ry + q + r), dz = Math.abs(rz - r); if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry; return zOf(rx, rz); };
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { throw new Error("this browser can't draw WebGL"); }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block"; renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    const bgc = T ? 0x14161a : 0x2a2822;
    scene.background = new THREE.Color(bgc); scene.fog = new THREE.Fog(bgc, 70, 190);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
    const disposables = [];
    const keep = x => { disposables.push(x); return x; };
    const mat = (c, extra = {}) => keep(new THREE.MeshStandardMaterial({ color: c, roughness: .8, metalness: .1, ...extra }));
    // world: 2D (x, y) -> 3D (x, height, y)
    const W3 = (x, y, h = 0) => new THREE.Vector3(x, h, y);
    // ---- bounds and lights
    const pts = [];
    fr.forEach(f => f.forEach(x => { if (x) pts.push(P(x[0], x[1])); }));
    if (T) for (const k of T.floor) { const [q, r] = k.split(",").map(Number); pts.push(P(q, r)); }
    const bx0 = Math.min(...pts.map(p => p[0])) - 6, bx1 = Math.max(...pts.map(p => p[0])) + 6, by0 = Math.min(...pts.map(p => p[1])) - 6, by1 = Math.max(...pts.map(p => p[1])) + 6;
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, span = Math.max(bx1 - bx0, by1 - by0);
    scene.add(new THREE.HemisphereLight(0xd6dde8, 0x3a352c, T ? .5 : .75));
    const sun = new THREE.DirectionalLight(0xfff1dc, T ? .55 : .95);
    sun.position.set(cx - span * .4, span * .9, cy - span * .3); sun.target.position.set(cx, 0, cy);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -span * .75, right: span * .75, top: span * .75, bottom: -span * .75, near: 1, far: span * 3 });
    scene.add(sun, sun.target);
    // ---- hex prisms (flat-topped, corner 0 on +x, as the 2D map)
    const hexGeo = (h, k = 1) => {
      const sh = new THREE.Shape();
      for (let i = 0; i < 6; i++) { const x = Math.cos(i * Math.PI / 3) * k, y = Math.sin(i * Math.PI / 3) * k; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return keep(g);
    };
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    const inst = (geo, material, list, place) => {
      const im = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
      im.count = list.length; list.forEach((it, i) => place(im, it, i)); im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.receiveShadow = true; scene.add(im); return im;
    };
    const keyHex = k => k.split(",").map(Number);
    const dark = new Map(T && T.light ? T.light : []);
    const shade = v => v == null ? 1 : v <= -7 ? .42 : v <= -3 ? .62 : .82;
    let walls = null, wallList = [], wallH = [], doorMesh = null, doorList = [], rubble = [];
    const gridLines = [];
    const floorSet = T ? new Set(T.floor) : null;
    if (T) {
      const floor = [...T.floor];
      inst(hexGeo(.15, .985), mat(0xffffff), floor, (im, k, i) => {
        const [q, r] = keyHex(k), [x, y] = P(q, r);
        m4.makeTranslation(x, zOf(q, r) - .15, y); im.setMatrixAt(i, m4);
        const h = hash(q, r), base = new THREE.Color(T.kind === "ruins" ? (h < .5 ? 0x67625a : 0x5f5a52) : h < .5 ? 0x5d6167 : 0x54585e).multiplyScalar(shade(dark.get(k)));
        im.setColorAt(i, base);
      });
      // walls: every hex beside the floor that isn't floor
      // the raised deck's sides: a solid column under each gantry, stair and dock hex
      const up = floor.filter(k => zOf(...keyHex(k)) > 0);
      if (up.length) inst(hexGeo(1, .985), mat(0x6c7178, { roughness: .7, metalness: .3 }), up, (im, k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.compose(W3(x, y, -.15), new THREE.Quaternion(), new THREE.Vector3(1, zOf(q, r), 1)); im.setMatrixAt(i, m4); }).castShadow = true;
      const ws = new Set();
      for (const k of floor) { const [q, r] = keyHex(k); for (const [dq, dr] of DIRN) { const k2 = (q + dq) + "," + (r + dr); if (!floorSet.has(k2)) ws.add(k2); } }
      wallList = [...ws];
      // each wall's height: a facility's walls clear its highest deck; a ruin's stand as tall as they're left
      const wTop = new Map(T.wallTop || []), wFull = 2.4 + Math.max(0, ...floor.map(k => zOf(...keyHex(k))));
      wallH = wallList.map(k => wTop.get(k) || wFull);
      walls = inst(hexGeo(1), mat(T.kind === "ruins" ? 0x9a9184 : 0x2c3037, { roughness: .9 }), wallList, (im, k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.compose(W3(x, y, 0), new THREE.Quaternion(), new THREE.Vector3(1, wallH[i], 1)); im.setMatrixAt(i, m4); });
      walls.castShadow = true;
      const crates = [...(T.crates || [])];
      const cGeo = keep(new THREE.BoxGeometry(1.15, 1, 1.15));
      for (const [kind, c] of [["light", 0x7a5a35], ["heavy", 0x8a8a84]]) {
        const list = crates.filter(([, v]) => v === kind);
        const im = inst(cGeo, mat(c), list, (im2, [k], i) => { const [q, r] = keyHex(k), [x, y] = P(q, r), h = kind === "heavy" ? 1.1 : .85; m4.compose(W3(x, y, zOf(q, r) + h / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(q, r) * .6), new THREE.Vector3(1, h, 1)); im2.setMatrixAt(i, m4); });
        im.castShadow = true;
      }
      doorList = [...(T.doors || [])];
      doorMesh = inst(hexGeo(2.3, .9), mat(0xffffff, { metalness: .4 }), doorList, (im, k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.makeTranslation(x, 0, y); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(0x9aa1a8)); });
      doorMesh.castShadow = true;
      const rGeo = keep(new THREE.DodecahedronGeometry(.22)), rMat = mat(0x4a4e55);
      for (const [tt, k, what] of T.events || []) if (what === "broken") {
        const [q, r] = keyHex(k), [x, y] = P(q, r), g = new THREE.Group();
        for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(rGeo, rMat); m.position.set(x + (hash(q + i, r) - .5) * 1.2, .12, y + (hash(q, r + i) - .5) * 1.2); m.scale.setScalar(.6 + hash(i, q)); m.castShadow = true; g.add(m); }
        g.visible = false; scene.add(g); rubble.push({ t: tt, k, g });
      }
    } else {
      // open ground: churned earth, the hexes faintly shaded
      const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(span * 4, span * 4)), mat(0x5a5344, { roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -.02, cy); ground.receiveShadow = true; scene.add(ground);
      const tiles = [];
      for (let q = Math.floor(bx0 / 1.5) - 1; q <= Math.ceil(bx1 / 1.5) + 1; q++) for (let r = Math.floor(by0 / SQ3 - q / 2) - 1; r <= Math.ceil(by1 / SQ3 - q / 2) + 1; r++) tiles.push([q, r]);
      const hill = tiles.filter(([q, r]) => zOf(q, r) > 0);
      if (hill.length) inst(hexGeo(1, .995), mat(0xffffff, { roughness: 1 }), hill, (im, [q, r], i) => { const [x, y] = P(q, r); m4.compose(W3(x, y, -.02), new THREE.Quaternion(), new THREE.Vector3(1, zOf(q, r), 1)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(0x6a6050).multiplyScalar(.85 + .3 * hash(q, r))); });
      inst(hexGeo(.02, .985), mat(0xffffff, { roughness: 1 }), tiles, (im, [q, r], i) => { const [x, y] = P(q, r); m4.makeTranslation(x, zOf(q, r) - .01, y); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(0x5a5344).multiplyScalar(.9 + hash(q, r) * .16)); });
    }
    // hex grid lines on the floor
    {
      const pos = [];
      for (let q = Math.floor(bx0 / 1.5) - 1; q <= Math.ceil(bx1 / 1.5) + 1; q++) for (let r = Math.floor(by0 / SQ3 - q / 2) - 1; r <= Math.ceil(by1 / SQ3 - q / 2) + 1; r++) {
        if (floorSet && !floorSet.has(q + "," + r)) continue;
        const [x, y] = P(q, r);
        const z = zOf(q, r) + .012;
        for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3, b = (i + 1) * Math.PI / 3; pos.push(x + Math.cos(a), z, y + Math.sin(a), x + Math.cos(b), z, y + Math.sin(b)); }
      }
      const g = keep(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const ls = new THREE.LineSegments(g, keep(new THREE.LineBasicMaterial({ color: T ? 0xffffff : 0x000000, transparent: true, opacity: T ? .07 : .2 })));
      scene.add(ls); gridLines.push(ls);
    }
    // ---- figures
    const SIDE = [0xc23a30, 0xd6a73c];
    const geo = {
      base: keep(new THREE.CylinderGeometry(.46, .5, .08, 24)), ring: keep(new THREE.TorusGeometry(.62, .05, 6, 32)),
      cyl: keep(new THREE.CylinderGeometry(1, 1, 1, 12)), sph: keep(new THREE.SphereGeometry(1, 16, 12)), box: keep(new THREE.BoxGeometry(1, 1, 1)),
      bar: keep(new THREE.PlaneGeometry(1, 1)),
    };
    const part = (g2, m, sx, sy, sz, x, y, z) => { const p = new THREE.Mesh(g2, m); p.scale.set(sx, sy, sz); p.position.set(x, y, z); p.castShadow = true; return p; };
    const pick = [];
    const figs = ros.map((r, i) => {
      const k = HFT3[String(Math.max(-4, Math.min(6, r.sm || 0)))] / 6, body = r.body || "upright", side = r.side || 0;
      const tone = (FACTION3.find(([re]) => re.test(r.faction || "")) || [0, 0x6b6f76])[1];
      const mBody = mat(tone), mTrim = mat(SIDE[side], { metalness: .3 }), mDark = mat(0x1d1e22), mEye = mat(0x111111, { emissive: /Necron/.test(r.faction || "") ? 0x39ff6a : /Tyranid/.test(r.faction || "") ? 0xffb030 : 0x000000 });
      const g = new THREE.Group(), fig = new THREE.Group();
      g.add(part(geo.base, mTrim, 1, 1, 1, 0, .04, 0));
      const bulk = ARMOURED.test(r.faction || "") ? 1.18 : /Ork/.test(r.faction || "") ? 1.12 : 1;
      if (body === "horizontal") {
        fig.add(part(geo.sph, mBody, .62, .34, .32, 0, .7, 0), part(geo.sph, mBody, .22, .2, .2, .62, .82, 0), part(geo.sph, mEye, .05, .05, .05, .8, .86, .08), part(geo.sph, mEye, .05, .05, .05, .8, .86, -.08));
        for (const [lx, lz] of [[.3, .2], [.3, -.2], [-.3, .2], [-.3, -.2]]) fig.add(part(geo.cyl, mBody, .06, .55, .06, lx, .3, lz));
        fig.add(part(geo.box, mTrim, .5, .06, .3, -.05, .98, 0));
      } else if (body === "legless") {
        [[.36, -.45, .3], [.3, -.1, .42], [.26, .25, .62], [.22, .55, .9]].forEach(([s, x, y]) => fig.add(part(geo.sph, mBody, s, s, s, x, y, 0)));
        fig.add(part(geo.sph, mEye, .05, .05, .05, .72, .98, .1), part(geo.sph, mEye, .05, .05, .05, .72, .98, -.1), part(geo.box, mTrim, .3, .06, .3, -.1, .78, 0));
      } else {
        const lift = body === "flying" ? .7 : 0;
        fig.add(part(geo.cyl, mDark, .11 * bulk, .7, .11 * bulk, 0, .35 + lift, .12), part(geo.cyl, mDark, .11 * bulk, .7, .11 * bulk, 0, .35 + lift, -.12));
        fig.add(part(geo.cyl, mBody, .26 * bulk, .72, .2 * bulk, 0, 1.06 + lift, 0));
        fig.add(part(geo.sph, mBody, .17, .19, .17, .02, 1.6 + lift, 0), part(geo.sph, mEye, .045, .045, .045, .16, 1.63 + lift, .06), part(geo.sph, mEye, .045, .045, .045, .16, 1.63 + lift, -.06));
        if (bulk > 1.1) fig.add(part(geo.sph, mTrim, .17, .14, .17, 0, 1.38 + lift, .3), part(geo.sph, mTrim, .17, .14, .17, 0, 1.38 + lift, -.3));
        else fig.add(part(geo.box, mTrim, .3, .08, .44, 0, 1.36 + lift, 0));
        // a gun or blade held forward
        fig.add(part(geo.box, mDark, .55, .09, .09, .32, 1.05 + lift, -.18));
        if (body === "flying") { const wm = mat(tone, { transparent: true, opacity: .55, side: THREE.DoubleSide }); fig.add(part(geo.box, wm, .5, .02, .7, -.15, 1.25 + lift, .5), part(geo.box, wm, .5, .02, .7, -.15, 1.25 + lift, -.5)); }
      }
      fig.scale.setScalar(k); g.add(fig);
      fig.traverse(m => { if (m.isMesh) { m.userData.i = i; pick.push(m); } });
      const sel = new THREE.Mesh(geo.ring, keep(new THREE.MeshBasicMaterial({ color: 0xffffff }))); sel.rotation.x = Math.PI / 2; sel.position.y = .06; sel.scale.setScalar(Math.max(1, k * .8)); sel.visible = false; g.add(sel);
      // health and shield bars, turned to the camera
      const bars = new THREE.Group();
      const back = new THREE.Mesh(geo.bar, keep(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .6, depthTest: false }))); back.scale.set(1.32, .2, 1);
      const hp = new THREE.Mesh(geo.bar, keep(new THREE.MeshBasicMaterial({ color: 0x5fbf6a, depthTest: false })));
      const sp = new THREE.Mesh(geo.bar, keep(new THREE.MeshBasicMaterial({ color: 0x58b6e8, depthTest: false })));
      [back, hp, sp].forEach((m, j) => { m.renderOrder = 10 + j; bars.add(m); });
      bars.position.y = (body === "horizontal" ? 1.25 : body === "legless" ? 1.35 : body === "flying" ? 2.6 : 1.95) * k + .2;
      g.add(bars); scene.add(g);
      return { g, fig, sel, bars, hp, sp, k, body, side };
    });
    // the fallen: a figure on its side, darkened, where it went down
    const fallenObj = fallen.map(f => {
      const g = new THREE.Group(), m = mat(f.dead ? 0x2a1b1b : 0x2b2d31), t = mat(SIDE[f.side]);
      g.add(part(geo.cyl, m, .24, .9, .2, 0, .22, 0), part(geo.sph, m, .16, .16, .16, .58, .2, 0), part(geo.base, t, .9, .6, .9, 0, .03, 0));
      g.children[0].rotation.z = Math.PI / 2;
      const [x, y] = P(f.q, f.r); g.position.set(x, zOf(f.q, f.r), y); g.rotation.y = hash(f.q, f.r) * 6.28; g.visible = false; scene.add(g);
      return { f, g };
    });
    // ---- this second's action
    let fxT = -1, fxObjs = [];
    const textSprite = (txt, color) => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 96; const x = c.getContext("2d");
      x.font = "bold 64px ui-monospace,monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 12; x.strokeStyle = "rgba(0,0,0,.8)"; x.strokeText(txt, 128, 48); x.fillStyle = color; x.fillText(txt, 128, 48);
      const tex = new THREE.CanvasTexture(c), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      s.scale.set(1.6, .6, 1); s.renderOrder = 20; return s;
    };
    const clearFx = () => { for (const o2 of fxObjs) { scene.remove(o2.obj); o2.obj.traverse(m => { if (m.geometry && !Object.values(geo).includes(m.geometry)) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }); } fxObjs = []; };
    const heightAt = (i, h = 1.2) => (figs[i] ? figs[i].k : 1) * h;
    function buildFx(t) {
      clearFx(); fxT = t;
      if (t <= 0) return;
      const es = fx[t - 1] || [], seen = new Map();
      es.forEach((e, n) => {
        if (e[0] === "s") {
          const [ax, ay] = P(e[1], e[2]), [bx, by] = P(e[3], e[4]);
          const a = W3(ax, ay, zOf(e[1], e[2]) + heightAt(e[7], 1.15)), b = W3(bx, by, zOf(e[3], e[4]) + heightAt(e[8], 1));
          const g2 = new THREE.BufferGeometry().setFromPoints([a, a.clone()]);
          const hit = !!e[6], m = hit ? new THREE.LineBasicMaterial({ color: e[5] ? 0xf1d38a : 0xffa08c, transparent: true }) : new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: .3, gapSize: .25, transparent: true, opacity: .45 });
          const line = new THREE.Line(g2, m), bolt = new THREE.Mesh(geo.sph, new THREE.MeshBasicMaterial({ color: 0xfff3c4 })); bolt.scale.setScalar(.1);
          const obj = new THREE.Group(); obj.add(line, bolt); scene.add(obj);
          fxObjs.push({ obj, lag: Math.min(.3, n * .012), run(q2, p) { const c = a.clone().lerp(b, q2); g2.attributes.position.setXYZ(1, c.x, c.y, c.z); g2.attributes.position.needsUpdate = true; if (!hit) line.computeLineDistances(); bolt.position.copy(c); bolt.visible = q2 < 1 || hit; if (q2 >= 1 && hit) bolt.scale.setScalar(p >= 1 ? .18 : .26); m.opacity = p >= 1 ? .45 : hit ? 1 : .45; } });
        } else if (e[0] === "m") {
          const [ax, ay] = P(e[1], e[2]), [bx, by] = P(e[3], e[4]), ang = Math.atan2(by - ay, bx - ax);
          const arc = new THREE.Mesh(new THREE.TorusGeometry(.75, e[6] ? .06 : .03, 6, 24, 2.2), new THREE.MeshBasicMaterial({ color: e[5] ? 0xf1d38a : 0xf08a7e, transparent: true }));
          arc.position.set(bx - Math.cos(ang) * .3, zOf(e[3], e[4]) + heightAt(e[8], 1.1), by - Math.sin(ang) * .3); arc.rotation.set(Math.PI / 2, 0, ang - 1.1); scene.add(arc);
          fxObjs.push({ obj: arc, lag: Math.min(.3, n * .012), run(q2, p) { arc.scale.setScalar(.4 + .6 * q2); arc.material.opacity = (e[6] ? 1 : .5) * (p >= 1 ? .35 : 1); } });
        } else if (e[0] === "b") {
          const [x, y] = P(e[1], e[2]), R = e[3] * 1.4;
          const ball = new THREE.Mesh(geo.sph, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          const z0 = zOf(e[1], e[2]), light = new THREE.PointLight(0xffa040, 0, R * 4); light.position.set(x, z0 + 1.5, y);
          const obj = new THREE.Group(); ball.position.set(x, z0 + .3, y); obj.add(ball, light); scene.add(obj);
          fxObjs.push({ obj, lag: 0, run(q2, p) { const s = R * Math.min(1, .25 + p); ball.scale.set(s, s * .6, s); ball.material.opacity = p >= 1 ? .18 : .75 * (1 - p * .6); light.intensity = p >= 1 ? 0 : 3 * (1 - p); } });
        } else if (e[0] === "h" || e[0] === "v" || e[0] === "f") {
          const q0 = e[0] === "h" ? e[4] : e[3], r0 = e[0] === "h" ? e[5] : e[4];
          if (q0 == null) return;
          const key2 = q0 + "," + r0, nn = seen.get(key2) || 0; seen.set(key2, nn + 1);
          const txt = e[0] === "h" ? (e[2] > 0 ? "−" + e[2] : "no pen") : e[0] === "f" ? "shield" : String(e[2]);
          const colr = e[0] === "h" ? (e[2] > 0 ? "#ffd2c8" : "#c9c6bd") : e[0] === "f" ? "#a8dcf6" : "#f4f1e8";
          const s = textSprite(txt, colr), [x, y] = P(q0, r0), base = zOf(q0, r0) + heightAt(e[1], 2.1) + nn * .55;
          if (e[0] === "h" && e[2] > 0) s.scale.multiplyScalar(1.25);
          scene.add(s);
          fxObjs.push({ obj: s, lag: 0, run(q2, p) { const show = p >= .35 || o.reduce; s.visible = show; s.position.set(x + .5, base + (o.reduce ? .6 : .3 + Math.min(1, Math.max(0, (p - .35) / .65)) * 1.1), y); s.material.opacity = p >= 1 ? .85 : Math.min(1, (1.15 - p) * 2 + .3); } });
        }
      });
    }
    // aim lines and paths, rebuilt every frame (few of them)
    let lineObjs = [];
    const clearLines = () => { for (const l of lineObjs) { scene.remove(l); l.geometry.dispose(); l.material.dispose(); } lineObjs = []; };
    const dashed = (pts2, color, opacity) => { const g2 = new THREE.BufferGeometry().setFromPoints(pts2), l = new THREE.Line(g2, new THREE.LineDashedMaterial({ color, dashSize: .25, gapSize: .2, transparent: true, opacity })); l.computeLineDistances(); scene.add(l); lineObjs.push(l); };
    // ---- camera: orbit around a target
    const orb = { tx: cx, ty: 0, tz: cy, r: span * .8, th: -Math.PI / 2 + .35, ph: .95 };
    // the opening view frames the two sides as they deploy; Fit shows the whole map
    const tp = (fr[0] || []).filter(Boolean).map(x => P(x[0], x[1]));
    const act = tp.length ? [Math.min(...tp.map(p => p[0])), Math.max(...tp.map(p => p[0])), Math.min(...tp.map(p => p[1])), Math.max(...tp.map(p => p[1]))] : [bx0, bx1, by0, by1];
    const place = () => {
      orb.ph = Math.max(.12, Math.min(1.45, orb.ph)); orb.r = Math.max(4, Math.min(span * 3, orb.r));
      camera.position.set(orb.tx + orb.r * Math.sin(orb.ph) * Math.cos(orb.th), orb.ty + orb.r * Math.cos(orb.ph), orb.tz + orb.r * Math.sin(orb.ph) * Math.sin(orb.th));
      camera.lookAt(orb.tx, orb.ty, orb.tz);
    };
    const fit = (whole) => {
      const [ax0, ax1, ay0, ay1] = whole ? [bx0, bx1, by0, by1] : act;
      orb.tx = (ax0 + ax1) / 2; orb.tz = (ay0 + ay1) / 2; orb.ty = 0;
      orb.r = Math.max(9, Math.max(ax1 - ax0, (ay1 - ay0) * camera.aspect) * (whole ? 1.1 : .85) + (whole ? 6 : 4)); orb.th = Math.PI / 2 + .3; orb.ph = .85; place();
    };
    let W = 0, H = 0, last = { t: 0, p: 1, st: {} };
    function resize(w, h) { W = w; H = h; renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px"; camera.aspect = w / h; camera.updateProjectionMatrix(); place(); render(); }
    // ---- one frame
    const facingAng = d => [0, -60, -120, 180, 120, 60][d] * Math.PI / 180;
    function update(t, p, st) {
      last = { t, p, st };
      if (fxT !== t) buildFx(t);
      const f = fr[t] || [], prev = t > 0 ? fr[t - 1] || [] : [];
      figs.forEach((F, i) => {
        const x = f[i], at = posAt(i, t, p);
        const gone = !x && !(prev[i] && p < .6);
        F.g.visible = !!at && !gone;
        if (!F.g.visible) return;
        const cur = x || prev[i], bitsv = cur[7] || 0;
        F.g.position.set(at[0], zXY(at[0], at[1]), at[1]); F.g.rotation.y = -facingAng(cur[4] || 0);
        const prone = bitsv & 2, kneel = bitsv & 4, stun = bitsv & 1;
        F.fig.rotation.set(0, 0, 0); F.fig.position.set(0, 0, 0); F.fig.scale.setScalar(F.k);
        if (prone && F.body === "upright") { F.fig.rotation.z = Math.PI / 2; F.fig.position.set(-.3 * F.k, .3 * F.k, 0); }
        else if (prone) F.fig.scale.set(F.k, F.k * .5, F.k);
        else if (kneel) F.fig.scale.set(F.k, F.k * .72, F.k);
        if (stun) F.fig.rotation.x = .3;
        if (!x) { F.fig.traverse(m => { if (m.isMesh) { m.material.transparent = true; m.material.opacity = 1 - p / .6; } }); }
        else F.fig.traverse(m => { if (m.isMesh && m.material.transparent && m.material.opacity < 1 && !m.material.side) { m.material.opacity = 1; m.material.transparent = false; } });
        F.sel.visible = i === st.sel || i === st.hover; F.sel.material.color.set(i === st.sel ? 0xffffff : 0x9aa0a8);
        const hpv = cur[5] == null ? 1 : Math.max(0, cur[5]);
        F.hp.scale.set(1.24 * hpv, .13, 1); F.hp.position.x = -.62 + .62 * hpv; F.hp.material.color.set(hpv > .6 ? 0x5fbf6a : hpv > .3 ? 0xe3b341 : 0xe0564b);
        F.sp.visible = cur[8] >= 0; if (cur[8] >= 0) { F.sp.scale.set(1.24 * cur[8], .07, 1); F.sp.position.set(-.62 + .62 * cur[8], .14, 0); }
        F.bars.quaternion.copy(F.g.quaternion).invert().multiply(camera.quaternion);   // face the camera whatever way the figure faces
      });
      for (const { f: fl, g } of fallenObj) g.visible = fl.t < t || (fl.t === t && p >= .6);
      for (const r of rubble) r.g.visible = r.t <= t;
      if (T) {
        const state = new Map(doorList.map(k => [k, (T.shut || []).includes(k) ? "shut" : "open"]));
        const broken = new Set();
        for (const [tt, k, what] of T.events || []) if (tt <= t) { if (what === "broken") broken.add(k); if (state.has(k)) state.set(k, what === "broken" ? "rubble" : what === "closed" ? "shut" : "open"); }
        doorList.forEach((k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r), s2 = state.get(k); m4.compose(W3(x, y, 0), new THREE.Quaternion(), new THREE.Vector3(1, s2 === "shut" ? 1 : .02, 1)); doorMesh.setMatrixAt(i, m4); doorMesh.setColorAt(i, col.set(s2 === "shut" ? 0x9aa1a8 : 0xd4a52a)); });
        doorMesh.instanceMatrix.needsUpdate = true; if (doorMesh.instanceColor) doorMesh.instanceColor.needsUpdate = true;
        wallList.forEach((k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.compose(W3(x, y, 0), new THREE.Quaternion(), new THREE.Vector3(1, broken.has(k) ? .001 : wallH[i] * (st.lowWalls ? .25 : 1), 1)); walls.setMatrixAt(i, m4); });
        walls.instanceMatrix.needsUpdate = true;
      }
      for (const o2 of fxObjs) o2.run(o.reduce ? 1 : Math.max(0, Math.min(1, (p - o2.lag) / .45)), p);
      clearLines();
      f.forEach((x, i) => { if (!x || x[9] == null || x[9] < 0 || !f[x[9]]) return; const a = posAt(i, t, p), c = posAt(x[9], t, p); if (a && c) dashed([W3(a[0], a[1], zXY(a[0], a[1]) + heightAt(i, 1.2)), W3(c[0], c[1], zXY(c[0], c[1]) + heightAt(x[9], 1.1))], x[2] ? 0xf1d38a : 0xf08a7e, .55); });
      if (st.trails && t > 0) f.forEach((x, i) => { if (!x || !x[6] || !x[6].length || !prev[i]) return; dashed([P(prev[i][0], prev[i][1]), ...x[6].map(([q, r]) => P(q, r))].map(([a, b]) => W3(a, b, zXY(a, b) + .06)), x[2] ? 0xd6a73c : 0xc23a30, .6); });
      for (const l of gridLines) l.visible = !!st.grid;
      render();
    }
    function render() { if (W) renderer.render(scene, camera); }
    // ---- input
    const el = renderer.domElement, ptr = new Map(); let drag = null, pin = null;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const hit = (sx, sy) => { ndc.set(sx / W * 2 - 1, -sy / H * 2 + 1); ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(pick.filter(m => m.parent && m.parent.parent && m.parent.parent.visible), false)[0]; return h ? h.object.userData.i : -1; };
    const loc = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("pointerdown", e => { el.setPointerCapture(e.pointerId); ptr.set(e.pointerId, loc(e)); const [sx, sy] = loc(e); drag = { sx, sy, pan: e.button === 2 || e.shiftKey, moved: false }; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pin = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), r: orb.r, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; } });
    el.addEventListener("pointermove", e => {
      const [sx, sy] = loc(e);
      if (!ptr.has(e.pointerId)) { const i = hit(sx, sy); if (i !== last.st.hover) o.onHover(i, sx, sy); else if (i >= 0) o.onHover(i, sx, sy); return; }
      const [px0, py0] = ptr.get(e.pointerId); ptr.set(e.pointerId, [sx, sy]);
      if (pin && ptr.size === 2) {
        const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        orb.r = pin.r * pin.d / Math.max(1, d); panBy(mx - pin.mx, my - pin.my); pin.mx = mx; pin.my = my; place(); render(); return;
      }
      if (!drag) return;
      const dx = sx - px0, dy = sy - py0;
      if (Math.abs(sx - drag.sx) + Math.abs(sy - drag.sy) > 4) drag.moved = true;
      if (drag.pan) panBy(dx, dy); else { orb.th += dx * .008; orb.ph -= dy * .008; }
      place(); update(last.t, last.p, last.st);
    });
    // the ground under the pointer follows it: right is (sin, -cos), forward (away from the camera) is (-cos, -sin)
    const panBy = (dx, dy) => { const s = orb.r * .0016, c = Math.cos(orb.th), n = Math.sin(orb.th); orb.tx += (-c * dy - n * dx) * s; orb.tz += (-n * dy + c * dx) * s; };
    const up = e => { ptr.delete(e.pointerId); if (ptr.size < 2) pin = null; if (drag && !drag.moved && ptr.size === 0) { const [sx, sy] = loc(e); o.onPick(hit(sx, sy)); } if (!ptr.size) drag = null; };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", () => o.onHover(-1));
    // zoom toward the ground under the pointer
    const groundAt = (sx, sy) => { ndc.set(sx / W * 2 - 1, -sy / H * 2 + 1); ray.setFromCamera(ndc, camera); const d = ray.ray.direction, o2 = ray.ray.origin; if (d.y > -1e-3) return null; const k2 = -o2.y / d.y; return [o2.x + d.x * k2, o2.z + d.z * k2]; };
    el.addEventListener("wheel", e => {
      e.preventDefault(); const f = Math.exp(e.deltaY * .0012), g2 = groundAt(...loc(e));
      if (g2 && f < 1) { orb.tx += (g2[0] - orb.tx) * (1 - f); orb.tz += (g2[1] - orb.tz) * (1 - f); }
      orb.r *= f; place(); update(last.t, last.p, last.st);
    }, { passive: false });
    return {
      update, resize, fit(whole) { fit(whole); update(last.t, last.p, last.st); },
      dispose() { clearFx(); clearLines(); for (const d of disposables) d.dispose && d.dispose(); renderer.dispose(); el.remove(); },
    };
  }

  let vtt = null;
  function setupReplay() {
    if (vtt) vtt.stop();
    const cv = document.getElementById("vtt-c");
    if (!cv || !last || !last.sample.frames.length) return;
    vtt = makeTable(last.sample, cv);
  }

  function makeTable(sample, cv) {
    const fr = sample.frames, fx = sample.fx || [], log = sample.log, T = sample.terrain, ros = sample.roster || [];
    const P = (q, r) => SIM.px({ q, r });
    const g = cv.getContext("2d");
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = { t: 0, p: 1, playing: false, grid: true, trails: true, measure: false, sel: -1, hover: -1, meas: null, view3d: false, lowWalls: false };
    let v3 = null;   // the 3D view, made the first time it's switched on
    // ---- the map, painted once
    const pts = [];
    fr.forEach(f => f.forEach(x => { if (x) pts.push(P(x[0], x[1])); }));
    const floor = T ? new Set(T.floor) : null, crates = T ? new Map(T.crates) : null, doors = T ? new Set(T.doors || []) : null;
    // elevation in yards: a facility's gantries and docks, or the ridge on open ground
    const ZM = new Map(T && T.elev ? T.elev : []), RG = sample.ridge;
    const zOf = (q, r) => { if (RG) { const x = RG.dir * (q - RG.qc); return x <= 0 ? RG.H : x >= RG.S ? 0 : RG.H * (1 - x / RG.S); } return ZM.get(q + "," + r) || 0; };
    if (T) for (const k of T.floor) { const [q, r] = k.split(",").map(Number); pts.push(P(q, r)); }
    let x0 = Math.min(...pts.map(p => p[0])) - 4, x1 = Math.max(...pts.map(p => p[0])) + 4, y0 = Math.min(...pts.map(p => p[1])) - 4, y1 = Math.max(...pts.map(p => p[1])) + 4;
    if (!T) { const padX = Math.max(0, 24 - (x1 - x0)) / 2, padY = Math.max(0, 16 - (y1 - y0)) / 2; x0 -= padX; x1 += padX; y0 -= padY; y1 += padY; }
    const RES = Math.max(8, Math.min(24, Math.floor(4200 / Math.max(x1 - x0, y1 - y0))));
    const bg = document.createElement("canvas");
    bg.width = Math.ceil((x1 - x0) * RES); bg.height = Math.ceil((y1 - y0) * RES);
    const b = bg.getContext("2d");
    b.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
    const eachHex = fn => { for (let q = Math.floor(x0 / 1.5) - 1; q <= Math.ceil(x1 / 1.5) + 1; q++) for (let r = Math.floor(y0 / SQ3 - q / 2) - 1; r <= Math.ceil(y1 / SQ3 - q / 2) + 1; r++) fn(q, r); };
    if (!T) {
      // open ground: churned earth, speckle, stones and old craters
      b.fillStyle = MAP.earth; b.fillRect(x0, y0, x1 - x0, y1 - y0);
      eachHex((q, r) => { const [cx, cy] = P(q, r), h = hash(q, r); b.fillStyle = h < .5 ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.035)"; hexPath(b, cx, cy, 1.02); b.fill(); });
      const area = (x1 - x0) * (y1 - y0);
      for (let i = 0; i < area * 5; i++) { const x = x0 + hash(i, 7) * (x1 - x0), y = y0 + hash(i, 13) * (y1 - y0), s = .03 + hash(i, 3) * .08; b.fillStyle = hash(i, 5) < .5 ? MAP.earth2 : "rgba(255,255,255,.08)"; b.fillRect(x, y, s, s); }
      for (let i = 0; i < area / 110; i++) {
        const x = x0 + hash(i, 101) * (x1 - x0), y = y0 + hash(i, 103) * (y1 - y0), rr = .8 + hash(i, 107) * 2.2;
        const gr = b.createRadialGradient(x, y, rr * .1, x, y, rr); gr.addColorStop(0, "rgba(43,39,31,.7)"); gr.addColorStop(.7, "rgba(40,36,28,.3)"); gr.addColorStop(1, "rgba(90,83,68,0)");
        b.fillStyle = gr; b.beginPath(); b.arc(x, y, rr, 0, 7); b.fill();
      }
      for (let i = 0; i < area / 12; i++) { const x = x0 + hash(i, 211) * (x1 - x0), y = y0 + hash(i, 223) * (y1 - y0), rr = .08 + hash(i, 227) * .18; b.fillStyle = MAP.rock; b.beginPath(); b.ellipse(x, y, rr, rr * .7, hash(i, 229) * 3, 0, 7); b.fill(); }
      if (RG) {
        // the ridge: lighter the higher, a contour every 2 yards, and the crest marked
        eachHex((q, r) => { const z = zOf(q, r); if (z <= 0) return; const [cx, cy] = P(q, r); b.fillStyle = `rgba(255,236,190,${(.05 + .22 * z / RG.H).toFixed(3)})`; hexPath(b, cx, cy, 1.02); b.fill(); });
        b.lineWidth = .07;
        for (let z = 2; z < RG.H; z += 2) { const qz = RG.qc + RG.dir * RG.S * (1 - z / RG.H), xz = 1.5 * qz; b.strokeStyle = "rgba(255,236,190,.28)"; b.setLineDash([.4, .3]); b.beginPath(); b.moveTo(xz, y0); b.lineTo(xz, y1); b.stroke(); }
        b.setLineDash([]); const xc = 1.5 * RG.qc; b.strokeStyle = "rgba(255,236,190,.7)"; b.lineWidth = .14; b.beginPath(); b.moveTo(xc, y0); b.lineTo(xc, y1); b.stroke();
        b.fillStyle = "rgba(255,236,190,.85)"; b.font = "1px ui-monospace, monospace"; b.textAlign = RG.dir > 0 ? "right" : "left";
        for (let y = y0 + 3; y < y1; y += 18) b.fillText(`crest ${RG.H} yd`, xc - RG.dir * .5, y);
      }
    } else {
      // a facility: gunmetal walls, deck plates with seams, grates, bulkhead edges, crates and barricades
      b.fillStyle = MAP.wall; b.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let i = 0; i < (x1 - x0) * (y1 - y0) * 2; i++) { b.fillStyle = "rgba(255,255,255,.025)"; b.fillRect(x0 + hash(i, 31) * (x1 - x0), y0 + hash(i, 37) * (y1 - y0), .25, .04); }
      const RU = T.kind === "ruins";
      for (const k of T.floor) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r), h = hash(q, r);
        b.fillStyle = RU ? (h < .5 ? "#67625a" : "#5f5a52") : h < .5 ? MAP.plate : MAP.plate2; hexPath(b, cx, cy, 1.02); b.fill();
        if (RU) { for (let i = 0; i < 3; i++) { b.fillStyle = hash(q + i, r - i) < .5 ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.07)"; b.fillRect(cx + (hash(q, r + i) - .5) * 1.3, cy + (hash(q + i, r) - .5) * 1.3, .12, .09); } continue; }
        if (h > .9) { b.save(); hexPath(b, cx, cy, .8); b.clip(); b.strokeStyle = MAP.grate; b.lineWidth = .06; for (let d = -1; d <= 1; d += .2) { b.beginPath(); b.moveTo(cx - 1, cy + d); b.lineTo(cx + 1, cy + d); b.stroke(); } b.restore(); }
        b.strokeStyle = MAP.seam; b.lineWidth = .04; hexPath(b, cx, cy, 1); b.stroke();
        if (h < .12) { b.fillStyle = "rgba(0,0,0,.18)"; b.beginPath(); b.ellipse(cx + (h - .06) * 4, cy, .5, .28, h * 9, 0, 7); b.fill(); }
      }
      // lighting: dim corridors and dim or dark rooms shaded
      for (const [k, v] of T.light || []) { const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r); b.fillStyle = `rgba(0,0,0,${v <= -7 ? .55 : v <= -3 ? .35 : .18})`; hexPath(b, cx, cy, 1.02); b.fill(); }
      // ruined walls: the taller, the darker and heavier; stumps and parapets lighter, with a broken top edge
      for (const [k, tp] of T.wallTop || []) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
        b.fillStyle = tp >= 8 ? "#34312e" : tp >= 5 ? "#46423e" : tp >= 3 ? "#5a554f" : "#6e685f"; hexPath(b, cx, cy, 1.02); b.fill();
        b.strokeStyle = tp >= 5 ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.22)"; b.lineWidth = .07; hexPath(b, cx, cy, .82); b.stroke();
        if (tp < 5 && hash(q, r) < .5) { b.fillStyle = "rgba(255,255,255,.5)"; b.font = ".5px ui-monospace, monospace"; b.textAlign = "center"; b.fillText(`${Math.round(tp * 3)}ft`, cx, cy + .18); }
      }
      // gantries, stairs and docks: lighter deck, a dark lip where it drops a yard or more, the height marked
      for (const [k, z] of ZM) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
        b.fillStyle = `rgba(255,255,255,${(.06 + .05 * z).toFixed(3)})`; hexPath(b, cx, cy, 1.02); b.fill();
        DIRN.forEach(([dq, dr], i) => {
          const k2 = (q + dq) + "," + (r + dr); if (!floor.has(k2) || (ZM.get(k2) || 0) > z - 1 + 1e-3) return;
          const [ax, ay] = hexCorner(cx, cy, EDGE[i][0]), [bx, by] = hexCorner(cx, cy, EDGE[i][1]);
          b.strokeStyle = "rgba(0,0,0,.7)"; b.lineWidth = .2; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
          b.strokeStyle = MAP.hazard; b.lineWidth = .06; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
        });
        if (T.kind === "ruins" ? z % 3 !== 0 || hash(q, r) < .06 : hash(q, r) < .25 || z < 3) { b.fillStyle = "rgba(255,255,255,.55)"; b.font = ".55px ui-monospace, monospace"; b.textAlign = "center"; b.fillText(`+${Math.round(z * 3)}ft`, cx, cy + .2); }
      }
      // bulkhead edges where floor meets wall
      b.lineCap = "round";
      for (const k of T.floor) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
        DIRN.forEach(([dq, dr], i) => {
          if (floor.has((q + dq) + "," + (r + dr))) return;
          const [ax, ay] = hexCorner(cx, cy, EDGE[i][0]), [bx, by] = hexCorner(cx, cy, EDGE[i][1]);
          b.strokeStyle = "rgba(0,0,0,.55)"; b.lineWidth = .28; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
          b.strokeStyle = MAP.wallHi; b.lineWidth = .08; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
        });
      }
      for (const [k, kind] of crates) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
        b.fillStyle = "rgba(0,0,0,.35)"; b.fillRect(cx - .62, cy - .5, 1.3, 1.1);
        if (kind === "light") {
          b.fillStyle = MAP.crateL; b.fillRect(cx - .7, cy - .6, 1.3, 1.1); b.strokeStyle = MAP.crateLd; b.lineWidth = .08; b.strokeRect(cx - .7, cy - .6, 1.3, 1.1);
          b.beginPath(); b.moveTo(cx - .7, cy - .6); b.lineTo(cx + .6, cy + .5); b.moveTo(cx + .6, cy - .6); b.lineTo(cx - .7, cy + .5); b.stroke();
        } else {
          b.fillStyle = MAP.crateH; b.fillRect(cx - .75, cy - .55, 1.4, 1.05); b.save(); b.beginPath(); b.rect(cx - .75, cy + .25, 1.4, .25); b.clip();
          for (let d = -1; d < 1.6; d += .3) { b.fillStyle = MAP.hazard; b.beginPath(); b.moveTo(cx - .75 + d, cy + .5); b.lineTo(cx - .6 + d, cy + .5); b.lineTo(cx - .35 + d, cy + .25); b.lineTo(cx - .5 + d, cy + .25); b.fill(); }
          b.restore(); b.strokeStyle = MAP.crateHd; b.lineWidth = .07; b.strokeRect(cx - .75, cy - .55, 1.4, 1.05);
        }
      }
    }
    // ---- camera
    const cam = { s: 20, x: x0, y: y0 };
    let W = 0, H = 0, dpr = 1;
    // the first view frames where the fighting happens; Fit shows the whole map
    const tp = []; fr.forEach(f => f.forEach(x => { if (x) tp.push(P(x[0], x[1])); }));
    const act = [Math.min(...tp.map(p2 => p2[0])) - 5, Math.min(...tp.map(p2 => p2[1])) - 5, Math.max(...tp.map(p2 => p2[0])) + 5, Math.max(...tp.map(p2 => p2[1])) + 5];
    const frame = (ax0, ay0, ax1, ay1) => { cam.s = Math.min(W / (ax1 - ax0), H / (ay1 - ay0)); cam.x = ax0 - (W / cam.s - (ax1 - ax0)) / 2; cam.y = ay0 - (H / cam.s - (ay1 - ay0)) / 2; };
    const fit = () => frame(x0, y0, x1, y1);
    const resize = () => {
      const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(200, Math.round(r.width)), h = Math.round(Math.min(640, Math.max(280, w * 0.62)));
      cv.style.height = h + "px"; cv.width = w * dpr; cv.height = h * dpr;
      const side = cv.closest(".vtt").querySelector(".vtt-side"); if (side) side.style.height = window.innerWidth > 820 ? h + "px" : "";
      const firstFit = !W; W = w; H = h; if (firstFit) frame(...act);
      const h3 = document.getElementById("vtt-3d"); if (h3) h3.style.height = h + "px";
      if (v3) v3.resize(w, h);
      draw();
    };
    const toWorld = (sx, sy) => [sx / cam.s + cam.x, sy / cam.s + cam.y];
    // world point to hex (flat-topped, size 1)
    const toHex = (wx, wy) => {
      const q = wx / 1.5, r = wy / SQ3 - q / 2;
      let x = q, z = r, y = -x - z, rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
      return { q: rx, r: rz };
    };
    const hexDistUI = (a, b2) => (Math.abs(a.q - b2.q) + Math.abs(a.r - b2.r) + Math.abs(a.q + a.r - b2.q - b2.r)) / 2;
    // ---- where each model stands at second t, progress p through that second (moving along its path)
    const along = (path, p) => {
      if (path.length < 2) return path[0];
      let L = 0; const seg = [];
      for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); L += d; }
      let want = L * p;
      for (let i = 0; i < seg.length; i++) { if (want <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, want / seg[i]) : 1; return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f]; } want -= seg[i]; }
      return path[path.length - 1];
    };
    const posAt = (i, t, p) => {
      const cur = fr[t] && fr[t][i], prev = t > 0 && fr[t - 1] ? fr[t - 1][i] : null;
      if (!cur) return prev && p < 0.6 ? P(prev[0], prev[1]) : null;
      if (!prev || p >= 1) return P(cur[0], cur[1]);
      const path = [P(prev[0], prev[1]), ...(cur[6] || []).map(([q, r]) => P(q, r))];
      if (path.length === 1) path.push(P(cur[0], cur[1]));
      return along(path, Math.min(1, p / 0.7));
    };
    // the fallen: where and when each model went down, from the casualty events
    const fallen = [];
    fx.forEach((es, k) => es.forEach(e => { if (e[0] === "d") fallen.push({ t: k + 1, q: e[1], r: e[2], side: e[3], dead: e[4] }); }));
    const ticks = document.getElementById("vtt-ticks");
    if (ticks) ticks.innerHTML = fallen.map(f => `<i class="s${f.side ? "b" : "a"}${f.dead ? " dead" : ""}" style="left:${(100 * f.t / Math.max(1, fr.length - 1)).toFixed(2)}%"></i>`).join("");
    const names = ros.map(r => r.id), sideOf = i => ros[i] ? ros[i].side : 0;
    const order = ros.map((r, i) => i).sort((a, c) => (ros[c].speed - ros[a].speed) || a - c);

    // ---- drawing
    function token(i, x, y, f, alpha) {
      const r = ros[i] || {}, side = f[2], hp = f[5] == null ? 1 : f[5], bitsv = f[7] || 0, prone = bitsv & 2, rad = prone ? .62 : .78;
      g.save(); g.globalAlpha = alpha; g.translate(x, y);
      g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(.08, .12, rad, rad * .9, 0, 0, 7); g.fill();
      g.fillStyle = side ? MAP.sideB : MAP.sideA; g.beginPath(); g.arc(0, 0, rad, 0, 7); g.fill();
      g.fillStyle = MAP.ink; g.beginPath(); g.arc(0, 0, rad - .13, 0, 7); g.fill();
      if (i === st.sel || i === st.hover) { g.strokeStyle = i === st.sel ? "#fff" : "rgba(255,255,255,.6)"; g.lineWidth = .1; g.beginPath(); g.arc(0, 0, rad + .12, 0, 7); g.stroke(); }
      // facing notch
      const a = [0, -60, -120, 180, 120, 60][f[4]] * Math.PI / 180;
      g.fillStyle = side ? MAP.sideB : MAP.sideA; g.beginPath(); g.moveTo(Math.cos(a) * (rad + .22), Math.sin(a) * (rad + .22)); g.lineTo(Math.cos(a + .35) * rad, Math.sin(a + .35) * rad); g.lineTo(Math.cos(a - .35) * rad, Math.sin(a - .35) * rad); g.closePath(); g.fill();
      // emblem
      g.save(); g.scale(rad / .78, rad / .78); g.fillStyle = side ? MAP.sideBl : MAP.sideAl; g.strokeStyle = g.fillStyle; (GLYPH[r.faction] || GLYPH.Default)(g); g.restore();
      if (bitsv & 1) { g.strokeStyle = MAP.hpMid; g.lineWidth = .08; g.setLineDash([.18, .12]); g.beginPath(); g.arc(0, 0, rad + .02, 0, 7); g.stroke(); g.setLineDash([]); }
      // health and shield bars
      const bw = 1.5, by = rad + .18;
      g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(-bw / 2 - .03, by - .03, bw + .06, .22);
      g.fillStyle = hp > .6 ? MAP.hpHi : hp > .3 ? MAP.hpMid : MAP.hpLo; g.fillRect(-bw / 2, by, bw * Math.max(0, hp), .16);
      if (f[8] >= 0) { g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(-bw / 2 - .03, by - .25, bw + .06, .18); g.fillStyle = MAP.shield; g.fillRect(-bw / 2, by - .22, bw * f[8], .12); }
      // condition badges
      let n = 0;
      for (const [bit, ch, col] of BADGES) {
        if (!(bitsv & bit)) continue;
        const ang = -Math.PI / 4 + n * .62, bx = Math.cos(ang) * (rad + .12), byy = Math.sin(ang) * (rad + .12) - .1;
        g.fillStyle = MAP.ink; g.beginPath(); g.arc(bx, byy, .26, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = .06; g.stroke();
        g.fillStyle = col; g.font = "bold .3px ui-monospace,monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, bx, byy + .02); n++;
      }
      g.restore();
    }
    function draw() {
      if (st.view3d && v3) { v3.update(st.t, st.p, st); return; }
      const t = st.t, p = st.p;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = T ? MAP.wall : MAP.earth; g.fillRect(0, 0, W, H);
      g.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, -cam.x * cam.s * dpr, -cam.y * cam.s * dpr);
      g.imageSmoothingEnabled = true; g.drawImage(bg, x0, y0, x1 - x0, y1 - y0);
      // doors and breaches as they stand
      if (T) {
        const state = new Map([...doors].map(k => [k, (T.shut || []).includes(k) ? "shut" : "open"]));
        for (const [tt, k, what] of T.events || []) if (tt <= t) state.set(k, what === "broken" ? "rubble" : what === "closed" ? "shut" : "open");
        for (const [k, s2] of state) {
          const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
          if (s2 === "shut") { g.fillStyle = MAP.door; hexPath(g, cx, cy, .96); g.fill(); g.strokeStyle = MAP.doorD; g.lineWidth = .1; g.beginPath(); g.moveTo(cx - .8, cy); g.lineTo(cx + .8, cy); g.stroke(); g.strokeStyle = MAP.hazard; g.lineWidth = .06; hexPath(g, cx, cy, .9); g.stroke(); }
          else if (s2 === "open") { g.strokeStyle = MAP.door; g.lineWidth = .08; g.setLineDash([.2, .15]); hexPath(g, cx, cy, .9); g.stroke(); g.setLineDash([]); }
          else { g.fillStyle = MAP.plate2; hexPath(g, cx, cy, 1); g.fill(); for (let i = 0; i < 6; i++) { g.fillStyle = MAP.seam; g.beginPath(); g.arc(cx + (hash(q + i, r) - .5) * 1.2, cy + (hash(q, r + i) - .5) * 1.2, .08 + hash(i, q) * .1, 0, 7); g.fill(); } }
        }
        for (const [tt, k, what] of T.events || []) if (what === "broken" && tt <= t && !doors.has(k)) {
          const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
          g.fillStyle = MAP.plate2; hexPath(g, cx, cy, 1.02); g.fill();
          for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? MAP.seam : MAP.wallHi; g.beginPath(); g.arc(cx + (hash(q + i, r) - .5) * 1.3, cy + (hash(q, r + i) - .5) * 1.3, .07 + hash(i, q) * .12, 0, 7); g.fill(); }
        }
      }
      // hex grid over the visible area
      if (st.grid && cam.s > 6) {
        const [vx0, vy0] = toWorld(0, 0), [vx1, vy1] = toWorld(W, H);
        g.strokeStyle = T ? MAP.gridF : MAP.gridO; g.lineWidth = 1 / cam.s; g.beginPath();
        for (let q = Math.floor(vx0 / 1.5) - 1; q <= Math.ceil(vx1 / 1.5) + 1; q++) for (let r = Math.floor(vy0 / SQ3 - q / 2) - 1; r <= Math.ceil(vy1 / SQ3 - q / 2) + 1; r++) {
          const [cx, cy] = P(q, r); for (let i = 0; i < 3; i++) { const [ax, ay] = hexCorner(cx, cy, i), [bx, by] = hexCorner(cx, cy, i + 1); g.moveTo(ax, ay); g.lineTo(bx, by); }
        }
        g.stroke();
      }
      // the fallen
      for (const f of fallen) {
        if (f.t > t || (f.t === t && p < 0.6)) continue;
        const [cx, cy] = P(f.q, f.r);
        g.globalAlpha = f.t === t ? 1 : .55; g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(cx, cy, .62, 0, 7); g.fill();
        g.strokeStyle = f.side ? MAP.sideB : MAP.sideA; g.lineWidth = f.dead ? .16 : .1; g.beginPath(); g.moveTo(cx - .38, cy - .38); g.lineTo(cx + .38, cy + .38); g.moveTo(cx + .38, cy - .38); g.lineTo(cx - .38, cy + .38); g.stroke();
        g.globalAlpha = 1;
      }
      const f = fr[t] || [];
      // paths walked this second
      if (st.trails && t > 0) {
        g.lineWidth = .1; g.setLineDash([.25, .2]); g.lineCap = "round";
        f.forEach((x, i) => { if (!x || !x[6] || !x[6].length || !fr[t - 1][i]) return; const pr = fr[t - 1][i]; g.strokeStyle = x[2] ? "rgba(214,167,60,.55)" : "rgba(194,58,48,.55)"; g.beginPath(); const [sx, sy] = P(pr[0], pr[1]); g.moveTo(sx, sy); for (const [q, r] of x[6]) { const [px2, py2] = P(q, r); g.lineTo(px2, py2); } g.stroke(); });
        g.setLineDash([]);
      }
      // aim lines
      g.setLineDash([.12, .18]); g.lineWidth = .06;
      f.forEach((x, i) => { if (!x || x[9] == null || x[9] < 0 || !f[x[9]]) return; const a = posAt(i, t, p), c = posAt(x[9], t, p); if (!a || !c) return; g.strokeStyle = x[2] ? "rgba(241,211,138,.5)" : "rgba(240,138,126,.5)"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke(); });
      g.setLineDash([]);
      // tokens
      const drawn = [];
      f.forEach((x, i) => { const at = posAt(i, t, p); if (x && at) { token(i, at[0], at[1], x, 1); drawn.push([i, at]); } });
      if (t > 0 && p < 0.6) (fr[t - 1] || []).forEach((x, i) => { if (x && !f[i]) { const at = posAt(i, t, p); if (at) token(i, at[0], at[1], x, 1 - p / 0.6); } });
      st.drawn = drawn;
      // this second's action: shots, blows, blasts, and what the hits did
      if (t > 0) {
        const es = fx[t - 1] || [];
        let k = 0;
        for (const e of es) {
          const lag = Math.min(0.3, k++ * 0.012), q2 = reduce ? 1 : Math.max(0, Math.min(1, (p - lag) / 0.45));
          if (e[0] === "s") {
            const [ax, ay] = P(e[1], e[2]), [bx, by] = P(e[3], e[4]);
            g.strokeStyle = e[6] ? (e[5] ? "rgba(241,211,138,.8)" : "rgba(255,160,140,.8)") : MAP.miss; g.lineWidth = e[6] ? .08 : .05;
            if (!e[6]) g.setLineDash([.3, .25]);
            g.globalAlpha = p >= 1 ? .45 : 1; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (bx - ax) * q2, ay + (by - ay) * q2); g.stroke(); g.setLineDash([]);
            if (q2 < 1) { g.fillStyle = MAP.shot; g.beginPath(); g.arc(ax + (bx - ax) * q2, ay + (by - ay) * q2, .16, 0, 7); g.fill(); }
            else if (e[6]) { g.fillStyle = MAP.shot; g.globalAlpha = p >= 1 ? .6 : 1; g.beginPath(); g.arc(bx, by, .28, 0, 7); g.fill(); }
            g.globalAlpha = 1;
          } else if (e[0] === "m") {
            const [ax, ay] = P(e[1], e[2]), [bx, by] = P(e[3], e[4]), ang = Math.atan2(by - ay, bx - ax);
            g.strokeStyle = e[5] ? MAP.sideBl : MAP.sideAl; g.lineWidth = e[6] ? .16 : .08; g.globalAlpha = e[6] ? 1 : .5; g.lineCap = "round";
            g.beginPath(); g.arc(bx - Math.cos(ang) * .3, by - Math.sin(ang) * .3, .75, ang - 1.1 * q2, ang + 1.1 * q2); g.stroke(); g.globalAlpha = 1;
          } else if (e[0] === "b") {
            const [cx, cy] = P(e[1], e[2]), rr = e[3] * 1.4 * (reduce ? 1 : Math.min(1, .25 + p));
            const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, `rgba(255,220,140,${p >= 1 ? .35 : .9})`); gr.addColorStop(.6, `rgba(255,140,40,${p >= 1 ? .2 : .55})`); gr.addColorStop(1, "rgba(255,120,30,0)");
            g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill();
          }
        }
        // floating numbers
        const seen = new Map();
        g.textAlign = "center"; g.textBaseline = "middle";
        for (const e of es) {
          if (e[0] !== "h" && e[0] !== "v" && e[0] !== "f") continue;
          const q0 = e[0] === "h" ? e[4] : e[3], r0 = e[0] === "h" ? e[5] : e[4];
          if (q0 == null) continue;
          const key2 = q0 + "," + r0, n = seen.get(key2) || 0; seen.set(key2, n + 1);
          const lift = reduce ? .6 : .3 + Math.min(1, Math.max(0, (p - .35) / .65)) * 1.1;
          const [cx, cy] = P(q0, r0), txt = e[0] === "h" ? (e[2] > 0 ? "−" + e[2] : "no pen") : e[0] === "f" ? "shield" : e[2];
          const col = e[0] === "h" ? (e[2] > 0 ? "#ffd2c8" : "#c9c6bd") : e[0] === "f" ? "#a8dcf6" : "#f4f1e8";
          if (p < .35 && !reduce) continue;
          g.font = `bold ${e[0] === "h" && e[2] > 0 ? .62 : .48}px ui-monospace,monospace`;
          g.lineWidth = .14; g.strokeStyle = "rgba(0,0,0,.75)"; g.globalAlpha = p >= 1 ? .85 : Math.min(1, (1.15 - p) * 2 + .3);
          const yy = cy - 1 - lift - n * .55; g.strokeText(txt, cx + .6, yy); g.fillStyle = col; g.fillText(txt, cx + .6, yy); g.globalAlpha = 1;
        }
      }
      // the measuring tape
      if (st.meas) {
        const [a, c] = st.meas, [ax, ay] = P(a.q, a.r), [cx, cy] = P(c.q, c.r), d = hexDistUI(a, c);
        g.strokeStyle = "#fff"; g.lineWidth = .1; g.setLineDash([.3, .2]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(cx, cy); g.stroke(); g.setLineDash([]);
        for (const [x, y] of [[ax, ay], [cx, cy]]) { g.strokeStyle = "#fff"; g.lineWidth = .08; hexPath(g, x, y, .95); g.stroke(); }
        const lab = `${d} yd · ${rangePenalty(Math.max(1, d))}`;
        g.font = "bold .6px ui-monospace,monospace"; g.textAlign = "center"; g.lineWidth = .16; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(lab, (ax + cx) / 2, (ay + cy) / 2 - .6); g.fillStyle = "#fff"; g.fillText(lab, (ax + cx) / 2, (ay + cy) / 2 - .6);
      }
    }
    // ---- side panels
    const hudA = document.getElementById("hudA"), hudB = document.getElementById("hudB"), clock = document.getElementById("rlab");
    const initEl = document.getElementById("vtt-init"), chatEl = document.getElementById("vtt-chat"), sheetEl = document.getElementById("vtt-sheet");
    const idRe = names.length ? new RegExp(names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, c) => c.length - a.length).join("|"), "g") : null;
    const idSide = new Map(names.map((n, i) => [n, sideOf(i)]));
    const COND = [[1, "stunned"], [2, "prone"], [4, "kneeling"], [8, "held"], [16, "holding a foe"], [32, "All-Out Defense"], [64, "All-Out Attack"], [128, "aiming"], [256, "pinned"], [512, "waiting"]];
    const fate = (i, t) => { const x = fr[t] && fr[t][i]; if (x) return x[3] === 2 ? "stunned" : x[3] === 3 ? "prone" : ""; const f = fallen.find(v => v.q != null && v.t <= t && ros[i] && sideOf(i) === v.side && fr[v.t - 1] && fr[v.t - 1][i] && fr[v.t - 1][i][0] === v.q && fr[v.t - 1][i][1] === v.r); return f ? (f.dead ? "killed" : "down") : "out of the fight"; };
    function panels() {
      const t = st.t, f = fr[t] || [];
      const up = s => f.filter(x => x && x[2] === s && x[3]).length, tot = s => ros.filter(r => r.side === s).length;
      hudA.textContent = `A ${up(0)}/${tot(0)}`; hudB.textContent = `B ${up(1)}/${tot(1)}`;
      clock.textContent = t === 0 ? "Deployment" : t === fr.length - 1 ? `End · ${t} s` : `${t} s`;
      initEl.innerHTML = `<ol class="vtt-init">${order.map(i => { const x = f[i], r = ros[i], hp = x ? x[5] : 0;
        return `<li data-i="${i}" class="s${r.side ? "b" : "a"}${x ? "" : " gone"}${i === st.sel ? " sel" : ""}"><span class="spd">${r.speed.toFixed(2)}</span><span class="nm">${esc(r.id)}</span><span class="hb"><i style="width:${Math.round(100 * Math.max(0, hp))}%"></i></span><span class="st">${x ? COND.filter(([bit]) => x[7] & bit).map(c => c[1]).join(", ") : esc(fate(i, t))}</span></li>`; }).join("")}</ol>`;
      const a = log.findIndex(l => l === `— Turn ${t} —`), b2 = log.findIndex(l => l === `— Turn ${t + 1} —`);
      const lines = t === 0 ? ["The sides deploy."] : a < 0 ? log.slice(-3) : log.slice(a + 1, b2 < 0 ? undefined : b2);
      chatEl.innerHTML = lines.map(l => { const sub = l.startsWith("  "); let h = esc(l.trim()); if (idRe) h = h.replace(idRe, m2 => `<b class="s${idSide.get(m2) ? "b" : "a"}">${m2}</b>`); return `<p class="${sub ? "sub" : "act"}">${h}</p>`; }).join("");
      if (st.sel >= 0) {
        const i = st.sel, r = ros[i], x = f[i];
        sheetEl.innerHTML = `<div class="vtt-sheet s${r.side ? "b" : "a"}"><div class="sh-top"><span class="side">Side ${"AB"[r.side]}</span><h3>${esc(r.id)}</h3><p>${esc(r.template)} · ${esc(r.faction)}</p></div>
          <dl class="sh-grid"><div><dt>ST</dt><dd>${r.st}</dd></div><div><dt>DX</dt><dd>${r.dx}</dd></div><div><dt>Speed</dt><dd>${r.speed}</dd></div><div><dt>Move</dt><dd>${r.move}</dd></div>
          <div><dt>HP</dt><dd>${x ? Math.round(x[5] * r.hp) + " / " : ""}${r.hp}</dd></div><div><dt>Dodge</dt><dd>${r.dodge}</dd></div><div><dt>Parry</dt><dd>${r.parry ?? "—"}</dd></div><div><dt>DR</dt><dd>${r.dr}</dd></div>
          ${r.sp ? `<div><dt>Shield</dt><dd>${x && x[8] >= 0 ? Math.round(x[8] * r.sp) + " / " : ""}${r.sp}</dd></div>` : ""}</dl>
          <p class="sh-w"><b>Ranged</b>${r.ranged ? esc(r.ranged) : "none"}</p><p class="sh-w"><b>Melee</b>${esc(r.melee)}</p>
          <p class="sh-w"><b>Now</b>${x ? (COND.filter(([bit]) => x[7] & bit).map(c => c[1]).join(", ") || "ready") : esc(fate(i, st.t))}</p>
          <p class="sh-w"><b>Whole battle</b>${r.kills} kill${r.kills === 1 ? "" : "s"}; ended ${r.fate === "ok" ? "still fighting" : r.fate === "dead" ? "dead" : r.fate === "routed" ? "fleeing" : "out of the fight"}</p></div>`;
      }
    }
    const tabs = [...document.querySelectorAll(".vtt-tabs [data-tab]")];
    const showTab = name => { tabs.forEach(b2 => b2.setAttribute("aria-selected", b2.dataset.tab === name)); [initEl, chatEl, sheetEl].forEach(el => el.hidden = el.id !== "vtt-" + name); };
    tabs.forEach(b2 => b2.onclick = () => showTab(b2.dataset.tab));
    initEl.onclick = e => { const li = e.target.closest("li[data-i]"); if (!li) return; st.sel = +li.dataset.i; panels(); draw(); showTab("sheet"); };
    // ---- time
    const slider = document.getElementById("rturn"), play = document.getElementById("rplay"), speed = document.getElementById("rspeed");
    let raf = 0, t0 = 0;
    const setT = (t, animate) => { st.t = Math.max(0, Math.min(fr.length - 1, t)); slider.value = st.t; st.p = animate && !reduce ? 0 : 1; t0 = performance.now(); panels(); if (animate && !reduce) loop(); else draw(); };
    function loop() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(now => {
        const dur = +speed.value;
        st.p = Math.min(1, (now - t0) / (dur * 0.85));
        draw();
        if (st.p < 1) loop();
        else if (st.playing) { if (st.t >= fr.length - 1) stopPlay(); else setTimeout(() => { if (st.playing) setT(st.t + 1, true); }, dur * 0.15); }
      });
    }
    const stopPlay = () => { st.playing = false; play.textContent = "Play"; play.setAttribute("aria-label", "Play"); };
    const startPlay = () => { if (st.t >= fr.length - 1) setT(0, false); st.playing = true; play.textContent = "Pause"; play.setAttribute("aria-label", "Pause"); setT(st.t + 1, true); };
    play.onclick = () => st.playing ? stopPlay() : startPlay();
    document.getElementById("rback").onclick = () => { stopPlay(); setT(st.t - 1, false); };
    document.getElementById("rstep").onclick = () => { stopPlay(); setT(st.t + 1, true); };
    slider.oninput = () => { stopPlay(); setT(+slider.value, false); };
    const root = document.getElementById("vtt");
    root.tabIndex = -1;
    const onKey = e => { if (!root.contains(document.activeElement) && document.activeElement !== document.body) return; if (e.key === " ") { e.preventDefault(); play.click(); } else if (e.key === "ArrowRight") { stopPlay(); setT(st.t + 1, true); } else if (e.key === "ArrowLeft") { stopPlay(); setT(st.t - 1, false); } };
    root.addEventListener("keydown", onKey);
    // ---- tools
    const toolBtn = n => root.querySelector(`[data-tool="${n}"]`);
    toolBtn("fit").onclick = () => { if (st.view3d && v3) v3.fit(true); else { fit(); draw(); } };
    // ---- the 3D view: three.js loads the first time it's asked for; the 2D canvas keeps the size and stays underneath
    const host3 = document.getElementById("vtt-3d");
    const tip3 = (i, sx, sy) => {
      if (i !== st.hover) { st.hover = i; draw(); }
      const tp2 = document.getElementById("vtt-tip"); if (!tp2) return;
      if (i < 0) { tp2.hidden = true; return; }
      const x = (fr[st.t] || [])[i], r = ros[i]; tp2.hidden = false; tp2.style.left = sx + 14 + "px"; tp2.style.top = sy + 10 + "px";
      tp2.innerHTML = `<b>${esc(r.id)}</b><span>${x ? Math.round(x[5] * r.hp) : 0} / ${r.hp} HP${x && x[8] >= 0 ? ` · shield ${Math.round(x[8] * r.sp)}` : ""}</span>`;
    };
    const set3d = on => {
      st.view3d = on; toolBtn("3d").setAttribute("aria-pressed", on);
      toolBtn("walls").hidden = !on || !T; toolBtn("measure").hidden = on;
      if (on) { st.measure = false; st.meas = null; toolBtn("measure").setAttribute("aria-pressed", "false"); }
      host3.hidden = !on; cv.style.visibility = on ? "hidden" : "";
      draw();
    };
    toolBtn("3d").onclick = () => {
      if (st.view3d) { set3d(false); return; }
      const b3 = toolBtn("3d"); b3.textContent = "Loading…"; b3.disabled = true;
      loadThree().then(THREE => {
        if (!v3) {
          v3 = makeView3D(THREE, { host: host3, fr, fx, T, ros, P, posAt, fallen, reduce, zOf,
            onPick: i => { st.sel = i; panels(); draw(); if (i >= 0) showTab("sheet"); }, onHover: tip3 });
          host3.hidden = false; v3.resize(W, H); v3.fit(false);
        }
        set3d(true);
      }).catch(err => {
        const tp2 = document.getElementById("vtt-tip"); tp2.hidden = false; tp2.style.left = "12px"; tp2.style.top = "46px";
        tp2.innerHTML = `<b>3D view unavailable</b><span>${esc(err.message)}</span>`; setTimeout(() => { tp2.hidden = true; }, 4000);
      }).finally(() => { const b3 = toolBtn("3d"); b3.textContent = "3D"; b3.disabled = false; });
    };
    toolBtn("walls").onclick = e => { st.lowWalls = !st.lowWalls; e.currentTarget.setAttribute("aria-pressed", st.lowWalls); draw(); };
    toolBtn("grid").onclick = e => { st.grid = !st.grid; e.currentTarget.setAttribute("aria-pressed", st.grid); draw(); };
    toolBtn("trails").onclick = e => { st.trails = !st.trails; e.currentTarget.setAttribute("aria-pressed", st.trails); draw(); };
    toolBtn("measure").onclick = e => { st.measure = !st.measure; e.currentTarget.setAttribute("aria-pressed", st.measure); if (!st.measure) st.meas = null; cv.classList.toggle("measuring", st.measure); draw(); };
    // ---- pan, zoom, pick
    const pointers = new Map(); let drag = null, pinch = null;
    const tip = document.getElementById("vtt-tip");
    const pick = (sx, sy) => { const [wx, wy] = toWorld(sx, sy); let best = -1, bd = 0.9; for (const [i, [x, y]] of st.drawn || []) { const d = Math.hypot(x - wx, y - wy); if (d < bd) { bd = d; best = i; } } return best; };
    const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", e => {
      cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, local(e));
      if (pointers.size === 2) { const [a, c] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - c[0], a[1] - c[1]), s: cam.s, m: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2] }; drag = null; return; }
      const [sx, sy] = local(e);
      if (st.measure) { const [wx, wy] = toWorld(sx, sy); const h = toHex(wx, wy); st.meas = [h, h]; drag = { measure: true }; draw(); return; }
      drag = { sx, sy, cx: cam.x, cy: cam.y, moved: false };
    });
    cv.addEventListener("pointermove", e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, local(e));
      const [sx, sy] = local(e);
      if (pinch && pointers.size === 2) {
        const [a, c] = [...pointers.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]);
        const [wx, wy] = toWorld(pinch.m[0], pinch.m[1]); cam.s = Math.max(2, Math.min(90, pinch.s * d / pinch.d)); cam.x = wx - pinch.m[0] / cam.s; cam.y = wy - pinch.m[1] / cam.s; draw(); return;
      }
      if (drag && drag.measure) { const [wx, wy] = toWorld(sx, sy); st.meas[1] = toHex(wx, wy); draw(); return; }
      if (drag) { const dx = sx - drag.sx, dy = sy - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; cam.x = drag.cx - dx / cam.s; cam.y = drag.cy - dy / cam.s; draw(); return; }
      const i = pick(sx, sy);
      if (i !== st.hover) { st.hover = i; draw(); }
      if (i >= 0) { const x = (fr[st.t] || [])[i], r = ros[i]; tip.hidden = false; tip.style.left = sx + 14 + "px"; tip.style.top = sy + 10 + "px"; tip.innerHTML = `<b>${esc(r.id)}</b><span>${x ? Math.round(x[5] * r.hp) : 0} / ${r.hp} HP${x && x[8] >= 0 ? ` · shield ${Math.round(x[8] * r.sp)}` : ""}</span>`; }
      else tip.hidden = true;
    });
    const end = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && !drag.measure && !drag.moved) { const [sx, sy] = local(e); const i = pick(sx, sy); st.sel = i; panels(); draw(); if (i >= 0) showTab("sheet"); }
      drag = null;
    };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    cv.addEventListener("pointerleave", () => { tip.hidden = true; if (st.hover >= 0) { st.hover = -1; draw(); } });
    cv.addEventListener("wheel", e => { e.preventDefault(); const [sx, sy] = local(e), [wx, wy] = toWorld(sx, sy); cam.s = Math.max(2, Math.min(90, cam.s * Math.exp(-e.deltaY * 0.0015))); cam.x = wx - sx / cam.s; cam.y = wy - sy / cam.s; draw(); }, { passive: false });
    const ro = new ResizeObserver(() => resize()); ro.observe(cv);
    resize(); panels(); draw();
    return { stop() { stopPlay(); cancelAnimationFrame(raf); ro.disconnect(); root.removeEventListener("keydown", onKey); if (v3) { v3.dispose(); v3 = null; } } };
  }

  function wire() {
    const main = $("#main");
    main.querySelectorAll("[data-g]").forEach(el => el.onchange = () => {
      S[el.dataset.g] = el.type === "checkbox" ? el.checked : Math.max(1, Number(el.value) || 1); save();
    });
    main.querySelectorAll("[data-o]").forEach(el => el.onchange = () => { S[el.dataset.o] = el.value; save(); if (el.dataset.o === "battlefield" || el.dataset.o === "ridge") render(); });
    const hs = main.querySelector("[data-h]"); hs.onchange = () => { S.health = hs.value; save(); render(); };
    main.querySelectorAll("[data-add]").forEach(el => el.onchange = () => {
      if (!el.value) return; const si = +el.dataset.add;
      S.sides[si].push(...(el.value.startsWith("squad:") ? addSquad(si, el.value.slice(6)) : [newUnit(el.value, 5)])); save(); render();
    });
    main.querySelectorAll("[data-preset]").forEach(el => el.onclick = () => {
      const p = PRESETS[+el.dataset.preset];
      S.sides = [[], []]; S.sides[0] = expand(p[1], 0); S.sides[1] = expand(p[2], 1); S.distance = p[3]; S.battlefield = p[4] || "open"; last = null; save(); render();
    });
    main.querySelectorAll("[data-delsq]").forEach(el => el.onclick = () => { const si = +el.dataset.delsq; S.sides[si] = S.sides[si].filter(x => x.squad !== el.dataset.sq); save(); render(); });
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
      const amb = card.querySelector("[data-amb]");
      if (amb) amb.onchange = () => { u.ambush = amb.checked; save(); };
      const cs = card.querySelector("[data-cs]");
      if (cs) cs.onchange = () => { u.carried = cs.value || null; upd(); };
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
          locations: S.locations || "elite", cover: [S.coverA || "none", S.coverB || "none"], battlefield: S.battlefield || "open", mapSeed: S.mapSeed || 1,
          ridge: !MAPPED() && S.ridge ? { side: +S.ridge, height: S.ridgeH || 8 } : null,
          awareness: MAPPED() ? S.awareness || "limited" : undefined, lighting: S.lighting || "mixed", sightedShots: !!S.sightedShots, tacticalDodge: !!S.tacticalDodge, limitedDodges: S.limitedDodges !== false, cinematicEffort: !!S.cinematicEffort }); $("#simout").innerHTML = results(last); setupReplay(); }
        catch (e) { $("#simout").innerHTML = `<p class="empty">Could not run: ${esc(e.message)}</p>`; }
      }, 20);
    };
  }
  window.simView = render;
})();
