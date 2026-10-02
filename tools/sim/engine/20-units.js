  // ------------------------------------------------------------ data index
  let EQ = null, TEMPLATES = null, SIMW = {}, POWERS = {}, AI = [], LOADOUTS = {}, SQUADS = {}, VEHICLES = new Map();
  function index(data) {
    EQ = new Map(); TEMPLATES = new Map(); SIMW = data.simWeapons || {}; POWERS = data.powers || {}; AI = (data.ai && data.ai.profiles) || []; LOADOUTS = data.loadouts || {}; SQUADS = data.squads || {};
    const walk = (e, src) => { if (!EQ.has(e.name)) EQ.set(e.name, { e, src }); (e.children || []).forEach(c => walk(c, src)); };
    for (const lib of data.libraries) {
      if (lib.kind === "equipment") lib.items.forEach(e => walk(e, lib));
      if (lib.kind === "template" && !lib.template.addon) TEMPLATES.set(lib.title, { t: lib.template, lib });
    }
    VEHICLES = new Map([...EQ.values()].filter(x => x.e.vehicle).map(x => [x.e.name, x.e]));
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
    const dr = {}, gap = {}; let wp = 0, wpTorso = -1, striking = 0, lifting = 0, move = 0, hp = 0, sm = 0, dodge = 0, flexible = false;
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
        // the DR a gap faces at a location, where the item sets it (a found Weak Point or a chink): "Gap DR: arm 35, leg 35."
        const gm = /Gap DR: ([^.]*)\./.exec(e.notes || "");
        if (gm) for (const part of gm[1].split(",")) { const [loc, v] = part.trim().split(/\s+/); if (loc && v) gap[loc] = Number(v); }
        if (/Flexible armou?r/i.test(e.notes || "") && torso > 0) flexible = true;   // blunt trauma (B379)
        for (const o of (e.feat && e.feat.other) || []) {
          let m;
          if ((m = /^Striking St ([+-]\d+)/i.exec(o))) striking += Number(m[1]);
          else if ((m = /^Lifting St ([+-]\d+)/i.exec(o))) lifting += Number(m[1]);
          else if ((m = /^ST ([+-]\d+)/.exec(o))) { striking += Number(m[1]); lifting += Number(m[1]); }
          else if ((m = /^Basic Move ([+-]\d+)/i.exec(o))) move += Number(m[1]);
          else if ((m = /^HP ([+-]\d+)/.exec(o))) hp += Number(m[1]);   // battlesuit structure
          else if ((m = /^SM ([+-]\d+)/.exec(o))) sm += Number(m[1]);   // a suit that makes its wearer a size bigger
          else if ((m = /^Dodge ([+-]\d+)/.exec(o))) dodge += Number(m[1]);   // holo-suit, clone field
        }
      }
    }
    return { dr, wp, gap, striking, lifting, move, hp, sm, dodge, flexible };
  }
  // the DR a gap in the armour faces (a found Weak Point, or a chink, B400): half the location's DR, unless the item
  // sets it (an arm or leg plate's joints, by user direction)
  function gapDR(u, loc) {
    const l = loc === "vitals" && u.arm.dr.vitals == null ? "torso" : loc;
    return u.arm.gap && u.arm.gap[l] != null ? u.arm.gap[l] + (u.arm.dr.all || 0) : Math.floor(drAt(u.arm.dr, l) / 2);
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
        rend, rendBy, rendText: rl ? rl.damage : "", malf: facts.malf || 0, skill: line.skill || "",
        overheat: facts.overheat ? parseDamage(/[a-z]\s*$/.test(facts.overheat) ? facts.overheat : facts.overheat + " burn") : null,
        cone, blast: facts.blast || 0, corrode: facts.corrode || (dmg.type === "cor" ? 5 : 0), warpflame: !!facts.warpflame, indirect: !!facts.indirect, minRange: facts.minRange || 0, chink: ((SIMW[label] || {})._item || {}).chink || 0, natural: !!sel.trait, dST };
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
        const smR = [0, 0, 1, 2, 3, 5, 7, 10][Math.max(0, Math.min(7, (st.sm || 0) + arm.sm))];
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
    // Brawling at DX+2 or better adds +1 per die of basic thrust to its attacks: punches, claws, bites, and a fist
    // with a load in it (B182); below that it adds nothing
    const brawlLvl = (st.skills || []).some(s => s.name === "Brawling") ? skillLevel(st, "Brawling", ["Brawling"]) : 0;
    const brawler = w => {
      if (!w || !w.dmg || w.skill !== "Brawling" || brawlLvl < st.dx + 2 || !/^\s*thr/.test(w.text || "")) return w;
      const dice = Number((/^(\d+)d/.exec((w.dST || dmgST).thr) || [0, 0])[1]);
      if (!dice) return w;
      w.dmg = { ...w.dmg, add: w.dmg.add + dice };
      w.text += " (+1/die Brawling)";
      return w;
    };
    let melee = brawler(weaponMaster(mkWeapon(spec.melee, true)));
    // Flesh Hooks (Lictor, Ravener): a reach-2 hook strike that snags the target for a free grapple (bio-weapons.yaml)
    const hooks = findTraitWeapon(T.t.traits, "Flesh Hooks") ? brawler(mkWeapon({ trait: "Flesh Hooks", mode: "Standard" }, true)) : null;
    // the same blade's other way of hitting (a sword's thrust beside its swing, B271): same field setting,
    // chosen blow by blow
    if (melee && spec.melee && spec.melee.item) {
      const h = EQ.get(spec.melee.item);
      const norm = u => String(u || "").toLowerCase().replace(/^(thrust|swing)[,\s]*/, "").replace(/[()]/g, "").trim();
      const alt = h && h.e ? weaponLines(h.e).filter(l => l.melee && l.usage !== melee.usage && !/follow|force strike|thrown/i.test(l.usage || "") && norm(l.usage) === norm(melee.usage)) : [];
      melee.alt = alt.map(l => brawler(weaponMaster(mkWeapon({ item: spec.melee.item, mode: l.usage }, true)))).filter(w => w && w.dmg && w.reachMax === melee.reachMax);
    }
    // Tip Slash (MA113): a weapon that thrusts to impale can swing its tip across the target for cutting at its
    // impaling damage -2, at the same reach
    if (melee && melee.dmg) {
      const imp = [melee, ...(melee.alt || [])].find(w => w.dmg && w.dmg.type === "imp");
      if (imp) (melee.alt ||= []).push({ ...imp, id: ++WID, alt: undefined, usage: "Tip slash", text: imp.text + " (tip slash)", dmg: { ...imp.dmg, type: "cut", add: imp.dmg.add - 2, key: (imp.dmg.key || "") + "ts" } });
    }
    if (!melee) {
      const lvl = skillLevel(st, "Brawling", ["Brawling", "DX", "Karate"]);
      // a punch is thrust-1 crushing (B271)
      const pd = parseDamage("thr-1 cr", dmgST.thr, dmgST.sw);
      melee = brawler({ id: ++WID, name: "Punch", usage: "Punch", text: "thr-1 cr", skill: "Brawling", dmg: pd, follow: null, level: lvl, parry: 0, unbalanced: false, reach: "C", reachMax: 1, malf: 0, weight: st.st * st.st / 100 });
    }
    const ranged = mkWeapon(spec.ranged, false);
    // a crew-served heavy weapon (squad `team`): one on a tripod or bipod, or a mortar on its baseplate, is fired from
    // its mount once set up (no ST penalty, braced, its weight off the gunner); a shoulder-fired one isn't set up
    const teamGun = w => { if (!w) return w; w.team = true; w.needsSetup = w.mounted || w.bipod || w.indirect; if (w.needsSetup) { w.level += w.stPenProne || 0; w.stPen = w.stPenProne = w.stStand = 0; w.mounted = true; } return w; };
    if (spec.team) teamGun(ranged);
    const heavy = spec.heavy ? teamGun(mkWeapon(spec.heavy, false)) : null;
    // a combat knife carried besides the main blade (loadout `knife`): reach C, so it works in close combat unpenalised
    const knife = spec.knife ? brawler(mkWeapon(spec.knife, true)) : null;
    // a second ranged weapon that needs no hands (a Carnifex's bio-plasma): its own magazine, no reload in a fight
    const ranged2 = mkWeapon(spec.ranged2, false);
    if (ranged2) { ranged2.extra = true; ranged2.limit = ranged2.shots.mag === Infinity ? Infinity : ranged2.shots.mag; ranged2.shots = { mag: Infinity, reload: 0 }; }
    // thrown grenades (B410): Throwing skill, range from ST and weight (B355), one per Ready + Attack
    const THROW = [[0.05, 3.5], [0.1, 2.5], [0.15, 2], [0.2, 1.5], [0.25, 1.2], [0.3, 1.1], [0.4, 1], [0.5, 0.8], [0.75, 0.7], [1, 0.6], [1.5, 0.4], [2, 0.3]];
    const grenades = (spec.grenades || []).map(g => {
      const w = mkWeapon({ item: g.item, mode: g.mode }, false);
      if (!w) return null;
      const h = EQ.get(g.item), lb = parseFloat((h && h.e && h.e.weight) || 1) || 1;
      // Throwing at DX+1 adds 1 to ST for distance, DX+2 or better 2 (B356). Lifting ST, the wearer's or a suit's,
      // doesn't count for throwing (B65)
      const tST = st.st + (w.level >= st.dx + 2 ? 2 : w.level >= st.dx + 1 ? 1 : 0);
      const dist = Math.max(2, Math.floor(tST * ((THROW.find(([r]) => r >= lb / (tST * tST / 5)) || [0, 0.2])[1])));
      Object.assign(w, { range: { half: dist, max: dist }, acc: 0, rof: 1, rcl: 1, bulk: 0, shots: { mag: Infinity, reload: 0 }, thrown: true, count: g.count || 1, oneHanded: true, minST: 0, stStand: 0 });
      return w;
    }).filter(Boolean);
    // Encumbrance (B17): the loadout's weight against Basic Lift (Lifting ST); powered armour and battlesuits carry
    // themselves, and a mounted gun its mount. None, Light (x2 BL), Medium (x3), Heavy (x6), Extra-Heavy (x10)
    const POWERED = /Power Armour|Battlesuit|Mega Armour|Auramite|Terminator|Dreadnought|Gravis|Cataphractii/i;
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
      side, name: spec.label || spec.template, template: spec.template, count: Math.max(1, spec.count | 0), armourNames: spec.armour || [],
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
      dodge: st.dodge - enc + arm.dodge, enc, HP: st.hp + arm.hp, HT: st.ht, will: st.will, sm: (st.sm || 0) + arm.sm,
      arm, nat, ranged, melee, parry: parryOf(melee), knife, knifeParry: knife ? parryOf(knife) : null, cs, judo: (st.skills || []).some(s => /^(Judo|Karate|Boxing)/.test(s.name) && s.level != null), bl: Math.round(liftST * liftST / 5),
      shield: spec.shield && spec.shield.sp ? { ...spec.shield } : cs && cs.field ? { item: cs.name + " field", ...cs.field, ranged_only: false, arc: "shield" } : pshield,
      // clothing that can catch fire (B433-434): cloth, flak, robes and hides; sealed plate, carapace, chitin and
      // machine bodies are Nonflammable or Highly Resistant; the unarmoured burn unless bare chitin or machine
      burns: !flags.machine && ((spec.armour || []).length ? (spec.armour || []).some(n => FLAMMABLE.test(n)) : !UNCLOTHED.test(spec.template)),
    };
    return u;
  }
  // ---------------------------------------------------------------- vehicles
  // A vehicle (B462-470) fights as one model: its hull takes the hits (DR by facing, the Vehicle Hit Location
  // Table, B554), its crew sit at stations and each works its own gun on the vehicle's turn, the driver moves it.
  // The crew are real bodies of the vehicle's crew template, hit only when damage gets inside (Occupant Hit Table,
  // B555). Vehicle data: the `vehicle` block of a Vehicle item (data/imperium/vehicles.yaml).
  const VLOCS = new Set(["body", "turret", "track", "legs", "wheel", "mount", "open", "vitals", "area"]);
  function vehicleLocs(code) {
    // "2CT": two caterpillar tracks and a main turret; t independent turret, X exposed weapon mount, nW wheels,
    // nL legs, O open cabin, G/g windows (B462, B554)
    const L = { C: 0, T: false, t: false, X: 0, W: 0, L: 0, O: false };
    for (const [, n, c] of String(code || "").matchAll(/(\d*)([A-Za-z])/g)) {
      const k = Number(n || 1);
      if (c === "C") L.C = k; else if (c === "T") L.T = true; else if (c === "t") L.t = true; else if (c === "X") L.X = k;
      else if (c === "W") L.W = k; else if (c === "L") L.L = k; else if (c === "O") L.O = true;
    }
    return L;
  }
  function buildVehicle(spec, side) {
    const e = VEHICLES.get(spec.vehicle);
    if (!e) throw new Error("Unknown vehicle: " + spec.vehicle);
    const V = e.vehicle, lo = LOADOUTS[V.crew_template] || {}, skills = V.skills || {};
    // each station's crewman: the crew template in its usual armour, trained to the vehicle's levels, with the
    // station's gun. Mounted guns carry no ST or bracing penalty (B467); linked guns fire together (as one weapon
    // at twice the rate)
    const stations = (V.crew || []).map((c, i) => {
      const cu = buildUnit({ template: V.crew_template, armour: lo.armour, skills, ranged: c.weapon, label: c.role }, side);
      let w = c.weapon ? cu.ranged : null;
      if (w) {
        w.level += w.stPenProne || 0; w.stPen = w.stPenProne = w.stStand = 0; w.mounted = true; w.needsSetup = false; w.bulk = 0;
        if (c.twin) { w.rof = (w.rof || 1) * 2; w.text += " (linked pair)"; if (w.shots.mag !== Infinity) w.shots = { ...w.shots, mag: w.shots.mag * 2 }; }
        w.station = i;
      }
      return { i, role: c.role, station: c.station || "hull", arc: c.arc || "front", loads: c.loads || null, stab: !!c.stabilised, w, cu };
    });
    const base = buildUnit({ template: V.crew_template, armour: lo.armour, skills, label: spec.label || spec.vehicle }, side);
    const ctl = skillLevel(base.stats, V.control, [V.control, "DX-5", "IQ-5"]);
    // the operator who also fires (a walker's chin gun): the lower of Gunner and the control skill (B467)
    for (const s of stations) if (s.w && s.station === "driver") s.w.level = Math.min(s.w.level, ctl);
    const HP = V.st_hp, dr = V.dr, est = dr.side ?? dr.front;
    const arm = { dr: {}, gap: {}, wp: 0, striking: 0, lifting: 0, move: 0, hp: 0, flexible: false };
    for (const l of [...LOCS, ...VLOCS]) arm.dr[l] = est;   // what a planner expects to face; the hit uses the real facing
    const thrCr = parseDamage(`${Math.max(1, Math.round(HP * 5 / 100))}d cr`);   // ramming at 5 yd/s (B430)
    const main = stations.find(s => s.w);
    return Object.assign(base, {
      name: spec.label || spec.vehicle, template: spec.vehicle, count: Math.max(1, spec.count | 0),
      carries: spec.carries || null,
      veh: { name: spec.vehicle, room: Number((/\+(\d+)/.exec(String(V.occ || "")) || [0, 0])[1]), dr, turret: V.turret || null, locs: vehicleLocs(V.locations), accel: V.move[0], top: V.move[1], hnd: V.hnd, sr: V.sr, ctl, est, ht: V.ht, code: V.ht_code || "", stations },
      HP, HT: V.ht, st: HP, sm: V.sm || 0, move: V.move[1], movePacked: V.move[1], fp: 99, liftST: 10 * HP, bl: HP * HP * 20,
      dodge: Math.max(0, Math.floor(ctl / 2) + V.hnd), parry: null, block: 0, db: 0, cs: null, shield: null, knife: null, knifeParry: null,
      melee: { id: ++WID, name: "Ram", usage: "Ram", text: fmtDice(thrCr) + " (collision)", dmg: thrCr, follow: null, level: ctl, parry: null, unbalanced: false, reach: "1", reachMax: 1, malf: 0, weight: HP * HP, natural: true, huge: true },
      thrCr, ranged: main ? main.w : null, ranged2: null, heavy: null, hooks: null, grenades: [], powers: [], team: null, crew: null,
      arm, nat: {}, flags: { machine: 1, unliving: 1, hpt: 1, noblood: 1, noMorale: 1, unfazeable: 1, vehicle: 1 },
      _br: ctl, bothReady: true, body: vehicleLocs(V.locations).L ? "walker" : "vehicle", grapple: 0, elite: false, burns: false, enc: 0, mags: 9,
      squad: spec.squad || null, squadName: spec.squadName || null, role: null, leader: false, vox: false, commissar: false,
      stance: spec.stance || "shoot", ambush: !!spec.ambush,
    });
  }
  function describeVehicle(u) {
    const V = u.veh, d = V.dr;
    return { hp: u.HP, ht: u.HT, dodge: u.dodge, parry: null, move: u.move, drTorso: d.front, drEye: 0, wp: 0, dmgRed: 0,
      vehicle: { dr: d, turret: V.turret, locs: V.locs, accel: V.accel, top: V.top, hnd: V.hnd, sr: V.sr, sm: u.sm, ctl: V.ctl,
        stations: V.stations.map(s => ({ role: s.role, weapon: s.w ? `${s.w.name} (${s.w.text})` : "", skill: s.w ? s.w.level : null, arc: s.arc })) },
      ranged: u.ranged && { name: u.ranged.name, usage: u.ranged.usage, dmg: u.ranged.text, follow: u.ranged.followText, skill: u.ranged.level, acc: u.ranged.acc, rof: u.ranged.rof, range: u.ranged.range },
      melee: { name: "Ram", usage: "Ram", dmg: u.melee.text, skill: u.melee.level }, shield: null, db: 0, carried: null };
  }
  // what a weapon looks like when it fires, for the 3D replay: beam colours, tracers, shells, flame
  function wkind(w) {
    if (!w) return "";
    const n = (w.name || "") + " " + (w.usage || ""), d = w.dmg || {};
    if (w.thrown) return "grenade";
    if (w.cone) return /warp|soulfire|psy/i.test(n) ? "warpflame" : "flame";
    if (/gauss|tesla|particle|death ray|transdimensional/i.test(n)) return "gauss";
    if (w.natural) return "bio";
    if (/lascannon|las-?talon|twin lascannon/i.test(n)) return "lascannon";
    if (/las|hot-shot|hellgun|long-las/i.test(n)) return "las";
    if (/plasma|ion|burst cannon|fusion/i.test(n)) return /fusion/i.test(n) ? "melta" : "plasma";
    if (/melta|inferno/i.test(n)) return "melta";
    if (/pulse|rail/i.test(n)) return "pulse";
    if (/shuriken|scatter laser|bright lance|star cannon/i.test(n)) return /lance|laser|star/i.test(n) ? "lascannon" : "shuriken";
    if (/splinter|dark lance|blaster/i.test(n)) return /lance|blaster/i.test(n) ? "dark" : "splinter";
    if (/bolt|storm|combi/i.test(n)) return "bolt";
    if (/battle cannon|mortar|missile|rokkit|krak|frag|launcher|demolisher|vanquisher/i.test(n) || d.ex) return "shell";
    if (/flesh|venom|devourer|spinefist|deathspitter|barbed|bio|fleshborer|acid|spore/i.test(n) || w.natural) return "bio";
    if (/assault cannon|autocannon|heavy stubber|big shoota|shoota|slugga|dakka|auto|stub|sniper|needle/i.test(n)) return "slug";
    if (d.type === "burn") return "las";
    return "slug";
  }
  const mkind = w => !w || /^(Punch|Kick|Ram)$/.test(w.name) ? "fist" : /fist|klaw|claw|talon/i.test(w.name) && !w.natural ? "fist" : w.natural ? "claw" : /chain/i.test(w.name) ? "chain" : /hammer|maul|mace/i.test(w.name) ? "hammer" : /axe|choppa/i.test(w.name) ? "axe" : /spear|halberd|glaive|staff|stave/i.test(w.name) ? "spear" : /power|force|relic|blade|sword|knife|scythe|warscythe|sword/i.test(w.name) ? (/power|force/i.test(w.name) ? "power" : "blade") : "blade";
  function describe(u) {
    if (u.veh) return describeVehicle(u);
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

