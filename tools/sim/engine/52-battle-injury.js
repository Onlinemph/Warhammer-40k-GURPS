// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ---- Revised Fractional Health (the user's house rule; after panoptesv.com's wound rules).
    const SEVN = ["", "Scratch", "Minor", "Moderate", "Major", "Critical", "Massive", "Gawdawful", "Destruction"];
    const FRAC = [0, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8];
    const COLS = lvl => lvl === 2 ? [1, 1.125, 1.375, 1.625] : [1, 1.25, 1.5, 1.75];
    const thr = (HP, lvl, col = 1) => Math.max(1, Math.round(HP * FRAC[lvl] * COLS(lvl)[col - 1]));
    function severity(inj, HP) { let s = 0; for (let l = 1; l <= 8; l++) if (inj >= thr(HP, l)) s = l; return s; }
    function boxesFor(inj, HP, lvl) { let n = 0; for (let c = 1; c <= 4; c++) if (inj >= thr(HP, lvl, c)) n = c; return Math.max(1, n); }
    // a model cut down by wounds (at 0 HP or below) is as horrible to see as one killed outright
    // Reanimation Protocols: a Necron put down any way short of destruction (unconscious, mortally wounded, a ruined
    // limb's worth of injury) drops inert and rolls to rise again, as when it's killed (see kill)
    function incapacitate(t, why) { if (t.state === "ok") { sawFall(t); if (frac ? t.lastHitBy : t.hp <= 0) { horror(t.lastHitBy, t); downed(t.lastHitBy); } if (t.h) FX(["d", t.h.q, t.h.r, t.u.side, 0]); const re = t.u.flags.reanimation && !t.u.veh; t.state = re ? "down" : "out"; if (re) t.reanim = 3; place(t, null); L(`  ${t.id} ${why}${re ? "; reanimation protocols engage" : ""}`); } }
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
        t.legsLost++; t.prone = true; if (frac && t.legsLost >= 2) t.halfDodge = true;
        L(`  ${t.id}'s ${loc} is crippled: ${t.legsLost >= 2 ? "falls and can only crawl" : "falls; lame, it can get up and hobble (Move -3, -3 to attacks and Dodge)"}`);
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
      if (frac && !t.u.veh) return fracInjure(att, t, inj, loc, type);
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
      if (!t.berserk && !t.u.veh && (major || (headV && t.shock > shock0))) {   // immune to stun (B124); a vehicle's major wounds are its locations' (B554)
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
          if (!r.ok && r.margin >= -2) { if (f.reanimation) kill(att, t, "mortally wounded"); else incapacitate(t, t.u.veh ? "is knocked out, burning" : "is mortally wounded"); return; }
          if (!r.ok) { kill(att, t, t.u.veh ? "wrecked" : "killed"); return; }
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
    // ---- hits on a vehicle (B554-555): the facing's DR, the Vehicle Hit Location Table, location effects, and the
    // crew inside struck by what gets through (Occupant Hit Table)
    const VNAME = { body: "hull", turret: "turret", track: "track", legs: "leg", wheel: "wheel", mount: "weapon mount", open: "open cab", vitals: "vital area", area: "hull (blast)" };
    const OCC_N = [[1, [10, 9, 8, 7, 6, 5, 4, 3, 3, 3, 3]], [2, [12, 10, 9, 8, 7, 6, 5, 4, 3, 3, 3]], [5, [14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 3]],
      [10, [16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3]], [20, [17, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4]], [50, [17, 17, 16, 14, 12, 10, 9, 8, 7, 6, 5]], [100, [17, 17, 17, 16, 14, 12, 10, 9, 8, 7, 6]]];
    const occNumber = (n, sm) => (OCC_N.find(([k]) => n <= k) || OCC_N[OCC_N.length - 1])[1][Math.max(0, Math.min(10, sm - 1))];
    const crewOK = c => !!c && c.state === "ok";
    function vehLoc(t) {
      const L0 = t.u.veh.locs, r = roll3();
      if (r <= 4) return L0.X ? "mount" : "body";
      if (r === 5) return L0.t ? "turret" : "body";
      if (r <= 7 || r === 15 || r === 16) return L0.C ? "track" : L0.L ? "legs" : "body";
      if (r === 8 || r === 13 || r === 14) return L0.T ? "turret" : "body";
      if (r === 12) return L0.O ? "open" : "body";
      if (r >= 17) return L0.W ? "wheel" : "body";
      return "body";
    }
    // wounding on a machine (B380, B554): Unliving, except the vital area (engine, fuel): x3 piercing and impaling,
    // x2 a tight beam
    const vehMult = (type, loc, ex) => type === "tox" ? 0 : loc === "vitals" && (/^pi/.test(type) || type === "imp") ? 3 : loc === "vitals" && type === "burn" && !ex ? 2 : UNLIVING[type] ?? BASE[type] ?? 1;
    // which plate a hit lands on: hull or turret, and the facing (top for blasts)
    function vehFace(t, loc, from) {
      if (loc === "area") return "top";
      if (loc === "mount") return "mount";
      if (!from || !t.h || (from.q === t.h.q && from.r === t.h.r)) return loc === "turret" && t.u.veh.turret ? "turret front" : "front";
      if (loc === "turret" && t.u.veh.turret) return "turret " + arcOf(t.h, t.turretFacing ?? t.facing, from);
      return arcOf(t.h, t.facing, from);
    }
    function vehFacingDR(t, loc, from) {
      const V = t.u.veh, f = vehFace(t, loc, from);
      const base = f === "mount" ? 20 : f === "top" ? V.dr.top ?? V.dr.rear : f.startsWith("turret ") ? V.turret[f.slice(7)] : V.dr[f];
      return Math.max(0, base - ((t.corr && t.corr[f]) || 0));   // less what corrosion has eaten from that plate
    }
    function crewHit(att, t, x, dm, raw0) {
      const c = x.man, cu = c.cu, loc = hitLocation(), raw = raw0 ?? rollDamage(dm);
      const dr = drAt(cu.arm.dr, loc === "vitals" ? "torso" : loc) + natDRat(cu, loc);
      const pen = raw - (dm.div === Infinity ? 0 : Math.floor(dr / (dm.div || 1)));
      if (pen <= 0) { L(`  ${t.id}'s ${x.s.role.toLowerCase()} is struck (${raw} to the ${loc}) but the armour holds`); return; }
      const inj = Math.max(1, Math.floor(pen * woundMult(dm.type, loc, cu.flags, dm.ex)));
      c.hp -= inj; if (att) att.dmgDealt += inj;
      if (c.hp <= -cu.HP && !check(cu.HT).ok) c.state = "dead";
      else if (c.hp <= 0 && !check(cu.HT - Math.floor(-c.hp / cu.HP)).ok) c.state = "out";
      else if (inj > cu.HP / 2 && !check(cu.HT).ok) c.stunned = true;
      L(`  ${t.id}'s ${x.s.role.toLowerCase()} takes ${inj} injury to the ${loc}${c.state === "dead" ? " and is killed" : c.state === "out" ? " and is out of the fight" : c.stunned ? " and is stunned" : ""}`);
      if (c.state !== "ok") { if (att && c.state === "dead") att.kills++; crewCheck(t); }
    }
    // passengers in the troop bay are occupants too (the body); their own armour protects them
    const occOK = e => e.pax ? e.pax.state === "aboard" : crewOK(e.man);
    function paxHit(att, x, dm) {
      x.state = "ok";
      L(`  spall strikes ${x.id} in the troop bay`);
      applyHit(att, { dmg: dm, follow: null }, x, hitLocation(), false, false, dm);
      if (x.state === "ok") x.state = "aboard";
    }
    function occupantHit(att, t, pen, where) {
      const live = [...t.stn.filter(x => crewOK(x.man)), ...(t.cargo || []).filter(x => x.state === "aboard").map(x => ({ pax: x }))];
      if (!live.length || roll3() > occNumber(live.length, t.u.sm)) return;
      const here = live.filter(x => (where === "turret") === (!x.pax && x.s.station === "turret")), pool = here.length ? here : live;
      let dice = Math.floor(pen / 5);
      L(`  spall and fragments fly inside`);
      // more than 4d is shared out in 4d lots (B555)
      // (round the location's crew in turn while dice are left: a big penetration shreds everyone in it)
      for (let i = Math.floor(R() * pool.length); dice > 0 && t.state === "ok"; i++) {
        const live2 = pool.filter(occOK);
        if (!live2.length) break;
        const k = Math.min(4, dice), e = live2[i % live2.length]; dice -= k;
        if (e.pax) paxHit(att, e.pax, parseDamage(`${k}d cut`)); else crewHit(att, t, e, parseDamage(`${k}d cut`));
      }
    }
    // getting out (B467): passengers step down onto free hexes round the vehicle, the far side from the enemy first.
    // Out of a wreck they scramble clear and lose their next turn; with no room they're lost with it
    function dismount(v, bail) {
      const pax = (v.cargo || []).filter(x => x.state === "aboard");
      v.cargo = [];
      if (!pax.length) return;
      const at = v.h, fs = models.filter(f => f.state === "ok" && f.h && f.u.side !== v.u.side);
      const away = h => fs.length ? Math.min(...fs.map(f => hexDist(f.h, h))) : 0;
      const spots = [];
      for (let r = 1; r <= 4 && at && spots.length < pax.length + 6; r++) {
        const ring = [];
        for (let dq = -r; dq <= r; dq++) for (let dr = Math.max(-r, -dq - r); dr <= Math.min(r, -dq + r); dr++) {
          const h = { q: at.q + dq, r: at.r + dr }, k = key(h.q, h.r);
          if (hexDist(h, at) !== r || occ.has(k) || (terr && !walkable(k)) || (EL && Math.abs(elevAt(h) - elevAt(at)) > 1)) continue;
          ring.push(h);
        }
        ring.sort((a, b) => away(b) - away(a)); spots.push(...ring);
      }
      let out = 0;
      for (const x of pax) {
        const h = spots.shift();
        x.ride = null;
        if (!h) { x.state = "dead"; continue; }
        x.state = "ok"; x.facing = v.facing; place(x, h); out++;
        if (bail) { x.skipNext = true; x.skipWhy = "it was scrambling out of the wreck"; }
      }
      L(`  ${v.id} ${bail ? "is lost: its passengers scramble out" : "drops its passengers"} (${out}${out < pax.length ? `, ${pax.length - out} trapped inside` : ""})`);
    }
    function crewCheck(t) { if (t.state === "ok" && !t.stn.some(x => crewOK(x.man))) incapacitate(t, "has no crew left alive to fight it"); }
    function vehHit(att, w, t, loc, ranged, halfD, dmgOverride, rawOverride, crit) {
      const V = t.u.veh, L0 = V.locs, HP = t.u.HP;
      if (!VLOCS.has(loc)) loc = vehLoc(t);   // the body was the target, or a random hit (B554)
      const dmg = dmgOverride || w.dmg;
      let raw = rawOverride != null ? rawOverride : rollDamage(dmg), halfDR = false, major = false;
      if (crit) {
        L(`  critical hit: ${CRIT[crit] || "normal damage"}`);
        if (crit === 3 || crit === 18) raw *= 3; else if (crit === 5 || crit === 16) raw *= 2;
        else if (crit === 6 || crit === 15) raw = Math.floor((dmg.n * 6 + dmg.add) * dmg.mult); else if (crit === 4 || crit === 17) halfDR = true;
        if (crit === 7 || crit === 13 || crit === 14) major = true;
      }
      if (halfD) raw = Math.floor(raw / 2);
      const fraw = w.follow ? rollDamage(w.follow) : 0;
      // an open cab: the occupant is struck instead, unprotected by the vehicle (B554)
      if (loc === "open") {
        const live = [...t.stn.filter(x => crewOK(x.man)), ...(t.cargo || []).filter(x => x.state === "aboard").map(x => ({ pax: x }))];
        if (live.length) {
          L(`  ${raw} dmg into the open ${L0.O && (t.cargo || []).length ? "bed" : "cab"}`); if (t.h) FX(["h", t.ix, 0, "open", t.h.q, t.h.r]);
          const e = live[Math.floor(R() * live.length)];
          if (e.pax) { e.pax.state = "ok"; applyHit(att, w, e.pax, hitLocation(), ranged, false, dmg, raw); if (e.pax.state === "ok") e.pax.state = "aboard"; } else crewHit(att, t, e, dmg, raw);
          return 0;
        }
        loc = "body";
      }
      const pl = ["vitals", "track", "legs", "wheel"].includes(loc) ? "body" : loc, armDR = vehFacingDR(t, pl, hitFrom || (att && att.h));
      if (w.corrode && raw >= w.corrode && armDR > 0) { const f = vehFace(t, pl, hitFrom || (att && att.h)), k = Math.min(armDR, Math.floor(raw / w.corrode)); (t.corr ||= {})[f] = ((t.corr && t.corr[f]) || 0) + k; L(`  the ${f} plate is eaten away (DR -${k}, ${armDR - k} left there)`); }
      const div = dmg.div, eff = dr => dr <= 0 ? 0 : div === Infinity ? 0 : Math.floor(dr / div);
      let DR = eff(armDR); if (halfDR) DR = Math.ceil(DR / 2);
      const pen = raw - DR, drTxt = `DR ${armDR}${div !== 1 ? "/" + (div === Infinity ? "∞" : div) : ""}`;
      if (pen <= 0) {
        if (t.h) FX(["h", t.ix, 0, loc, t.h.q, t.h.r]);
        L(`  ${raw} dmg to the ${VNAME[loc]} fails to penetrate ${drTxt}`);
        return 0;
      }
      let inj = vehMult(dmg.type, loc, dmg.ex) ? Math.max(1, Math.floor(pen * vehMult(dmg.type, loc, dmg.ex))) : 0;
      // an explosive follow-up that gets inside goes off within the hull: triple damage, no DR (B414)
      let finj = w.follow && fraw > 0 && vehMult(w.follow.type, "body", w.follow.ex) ? Math.max(1, Math.floor(fraw * (w.follow.ex ? 3 : 1) * vehMult(w.follow.type, "body", w.follow.ex))) : 0;
      let note = "";
      if (loc === "track" || loc === "legs") {
        // over HP/2 cripples a track (ground Move 0) or a walker's leg (it falls); the excess is lost
        const sk = (hitFrom || (att && att.h)) && t.h ? sideOf(t.h, t.facing, hitFrom || att.h) : (R() < 0.5 ? "L" : "R");
        const lim = Math.floor(HP / 2) + 1, took = t.trackInj[sk] || 0;
        inj = Math.min(inj + finj, Math.max(0, lim - took)); finj = 0; t.trackInj[sk] = took + inj;
        if (took + inj > HP / 2 && took <= HP / 2) { t.immobile = true; note = loc === "legs" ? ": a leg gives way and the walker crashes down" : ": a track is blown off, immobilising it"; }
      } else if (loc === "wheel") {
        const n = Math.max(1, L0.W), lim = Math.floor(HP / (2 * n)) + 1;
        inj = Math.min(inj + finj, lim); finj = 0;
        if (inj >= lim) { t.wheelsLost++; note = ": a wheel is wrecked"; if (t.wheelsLost >= Math.ceil(n / 2)) { t.immobile = true; note += ", immobilising it"; } }
      } else if (loc === "mount") {
        // over HP/5 cripples it; like a limb it takes no more than that over all its hits (B420, B554)
        const lim = Math.floor(HP / 5) + 1, took = t.mountInj || 0;
        inj = Math.min(inj + finj, Math.max(0, lim - took)); finj = 0; t.mountInj = took + inj;
        const x = t.stn.find(y => y.s.arc === "pintle" && !y.out);
        if (took + inj >= lim && took < lim && x) { x.out = true; note = `: the ${x.s.w ? x.s.w.name : "mount"} is shot away`; }
      } else if (loc === "turret" && L0.t && !L0.T) {
        // an independent turret: over HP/3 wrecks it and what it carries; the excess is lost
        const lim = Math.floor(HP / 3) + 1;
        inj = Math.min(inj + finj, lim); finj = 0;
        if (inj >= lim) { for (const y of t.stn) if (y.s.station === "turret") y.out = true; note = ": the turret is wrecked"; }
      }
      const tot = inj + finj;
      L(`  ${raw} dmg to the ${VNAME[loc]} (${drTxt}): ${tot} injury${finj ? ` (${finj} from the burst inside)` : ""}${note}; ${t.id} at ${t.hp - tot}/${HP} HP`);
      if (t.h) FX(["h", t.ix, tot, loc, t.h.q, t.h.r]);
      // a major wound to the body: HT or the power or propulsion is damaged, halving Move; to a main turret: HT or
      // its main gun is knocked out or it jams (B554)
      const maj = tot > HP / 2 || major;
      if (maj && (loc === "body" || loc === "vitals") && !check(t.u.HT).ok) { t.propHalf++; L(`  the engine is hit: Move halved`); if (t.propHalf >= 3) t.immobile = true; }
      if (maj && loc === "turret" && L0.T && !check(t.u.HT).ok) {
        const g = t.stn.find(y => y.s.station === "turret" && y.s.w && !y.out);
        if (g && R() < 0.5) { g.out = true; L(`  the ${g.s.w.name} is knocked out`); } else { t.turretJam = true; L(`  the turret jams`); }
      }
      if ((loc === "body" || loc === "turret" || loc === "vitals") && pen >= 5) occupantHit(att, t, pen, loc);
      if (t.state === "ok") injure(att, t, tot, "body", dmg.type);
      return tot;
    }
    function applyHit(att, w, t, loc, ranged, halfD, dmgOverride, rawOverride, crit) {
      if (t.u.veh) return vehHit(att, w, t, loc, ranged, halfD, dmgOverride, rawOverride, crit);
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
      let armDR = (area ? aDR.arm : chink ? gapDR(t.u, loc) : drAt(t.u.arm.dr, loc === "vitals" ? (t.u.arm.dr.vitals != null ? "vitals" : "torso") : loc)) + coverDR;
      if (chink) L(`  strikes a chink in the armour`);
      let natDR = area ? aDR.nat : natDRat(t.u, loc);
      // armour eaten away by corrosion at this location (B61): off the armour first, then the hide
      const cLoc = area || loc === "vitals" ? "torso" : loc, eaten = (t.corr && t.corr[cLoc]) || 0;
      if (eaten) { const a = Math.min(eaten, Math.max(0, armDR - coverDR)); armDR -= a; natDR = Math.max(0, natDR - (eaten - a)); }
      if (w.corrode && raw >= w.corrode && armDR - coverDR + natDR > 0) { const k = Math.min(Math.floor(raw / w.corrode), armDR - coverDR + natDR); (t.corr ||= {})[cLoc] = eaten + k; L(`  the ${cLoc}'s armour is eaten away (DR -${k}, ${armDR - coverDR + natDR - k} left there)`); }
      const div = dmg.div;
      const eff = dr => dr <= 0 ? 0 : div === Infinity ? 0 : Math.floor(dr / div);   // round down, minimum 0 (B378)
      let DR = eff(armDR + natDR);
      if (noDR) DR = 0; else if (halfDR) DR = Math.ceil(DR / 2);
      let pen = raw - DR;
      if (pen <= 0 && !chink && armDR > 0 && t.u.arm.wp && roll3() <= t.u.arm.wp) {
        DR = eff((area ? Math.floor(armDR / 2) : gapDR(t.u, loc) + coverDR) + natDR); pen = raw - DR;
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
      // collateral reaches 2 yards per die of damage (B414), counting the dice before any multiplier (a 6d×4 plasma bolt
      // reaches 12 yards, not 48: the multiplier is the energy in the hit, not the size of the burst); Explosion level
      // L (B107) widens it: distance counts as yards / L
      const reach = 2 * (w.dmg.n || 1) * lv;
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

