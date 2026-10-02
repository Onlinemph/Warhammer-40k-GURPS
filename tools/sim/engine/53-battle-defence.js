// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
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
      if (tu.veh) { const v = vehExp(d, w.follow, loc === "area" ? (tu.veh.dr.top ?? tu.veh.dr.rear) : tu.veh.est, loc === "vitals" ? "vitals" : "body"); EXP.set(k, v); return v; }
      const aDR = loc === "area" ? areaDR(tu) : null;
      if (aDR) loc = "torso";
      const armDR = aDR ? aDR.arm : chink ? gapDR(tu, loc) : drAt(tu.arm.dr, loc === "vitals" ? (tu.arm.dr.vitals != null ? "vitals" : "torso") : loc);
      const natDR = aDR ? aDR.nat : natDRat(tu, loc);
      const effDR = d.div === Infinity ? 0 : Math.floor((armDR + natDR) / d.div);
      const red = tu.flags.dmgRed > 1 ? tu.flags.dmgRed : 1;
      const cap = loc === "arm" || loc === "leg" ? tu.HP / 2 + 1 : loc === "hand" || loc === "foot" ? tu.HP / 3 + 1 : Infinity;
      const avgF = w.follow ? (w.follow.n * 3.5 + w.follow.add) * w.follow.mult * (w.follow.ex ? 3 : 1) : 0;   // an explosive follow-up bursts inside: x3 (B414)
      let tot = 0;
      // Weak Points: a hit that fails to penetrate finds a gap on 3d <= rating and faces half the armour's DR
      const wpP = !chink && armDR > 0 && tu.arm.wp ? P3[Math.min(18, tu.arm.wp)] : 0;
      const halfDR = d.div === Infinity ? 0 : Math.floor(((aDR ? Math.floor(armDR / 2) : gapDR(tu, loc)) + natDR) / d.div);
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
    // expected injury to a vehicle from damage d against DR dr (the planner's view: no location caps)
    function vehExp(d, fol, dr, loc) {
      const effDR = d.div === Infinity ? 0 : Math.floor(dr / d.div), vm = vehMult(d.type, loc, d.ex);
      const avgF = fol ? (fol.n * 3.5 + fol.add) * fol.mult * (fol.ex ? 3 : 1) * vehMult(fol.type, "body", fol.ex) : 0;
      let tot = 0;
      for (let i = 0; i < 20; i++) { const pen = rollDamage(d) - effDR; if (pen > 0) tot += pen * vm + avgF; }
      return tot / 20;
    }
    function expInjRandom(w, tu, dmgOverride) {
      if (tu.veh) return expInj(w, tu, "body", dmgOverride);
      let s = 0;
      for (const [loc, n] of RANDOM_LOCS) s += n * expInj(w, tu, loc, dmgOverride);
      return s / 216;
    }
    // best location and deceptive level: returns {loc, da, score, lvl}
    function planAttack(m, w, t, lvl, melee, dmgOverride, fo = {}) {
      // a regenerating shield that's up soaks the blow before armour: a called shot is wasted on it, so aim at the
      // body (or not at all) until it's down, and count only what the shield won't absorb
      const sh = t.u.shield, shUp = !!(sh && t.sp > 0 && (!melee || !sh.ranged_only) && !w.malediction && (!sh.arc || shieldCovers(t, m)));
      const pointy = /^pi/.test(w.dmg.type) || w.dmg.type === "imp" || (w.dmg.type === "burn" && !w.dmg.ex && !w.cone);
      // a vehicle: the hull, or (a called shot) its vital area at -3 plus its SM (B554)
      const locs = w.cone ? ["area"] : t.u.veh ? (aimsShots(m) && pointy ? ["random", "vitals"] : ["random"]) : shUp ? [aimsShots(m) ? "torso" : "random"] : aimsShots(m) || (melee && t.pinned) ? [...Object.keys(AIM), ...Object.keys(AIM).filter(l => l !== "eye" && drAt(t.u.arm.dr, l === "vitals" ? "torso" : l) > 0).map(l => l + "#c")] : ["random"];
      const def0 = melee ? bestDefence(t, m, true, w) : w.malediction ? (w.fp && t.u.flags.blank ? 99 : w.resist === "HT" ? t.u.HT : t.u.will) - 2 : rangedDefence(t, m);
      let best = { loc: "torso", da: 0, score: 0, lvl };
      for (const loc of locs) {
        const pen = (fo.fx ? fo.fx.pen(loc.replace("#c", "")) : 0) + (loc === "random" || loc === "area" ? 0 : loc.endsWith("#c") ? Math.min(0, Math.min(AIM[loc.slice(0, -2)], CHINK(loc.slice(0, -2))) + (w.chink || 0)) : loc === "eye" && drAt(t.u.arm.dr, "eye") > 0 ? -10 : AIM[loc]);   // an eye behind a helmet lens or visor is -10 (B399-400)
        const pointed = /^pi/.test(w.dmg.type) || w.dmg.type === "imp" || (w.dmg.type === "burn" && !w.dmg.ex && !w.cone);
        if ((loc === "eye" || loc === "vitals" || loc.endsWith("#c")) && !pointed) continue;   // B398, B400
        const hmod = melee ? heightLoc(m, t, w, loc) : 0;
        if (hmod === null) continue;   // out of reach across the height difference (B402-403)
        if (t.limbFull && t.limbFull[loc.replace("#c", "")]) continue;   // both already crippled: nothing more to take there
        // a vehicle: the DR of the facing this attacker sees, and a gun's damage halved at or beyond 1/2D (B378)
        const from = fo.from || m.h, vd = t.u.veh && from && t.h ? (dmgOverride || w.dmg) : null, vHalf = vd && !melee && w.range && hexDist(from, t.h) >= w.range.half;
        const eatN = vd && w.corrode ? 5 * Math.floor((vd.n * 3.5 + vd.add) * vd.mult / w.corrode) : 0;   // five more hits' worth of corrosion
        const e = (vd ? vehExp(vHalf ? { ...vd, mult: vd.mult / 2 } : vd, vHalf ? null : w.follow, Math.max(0, vehFacingDR(t, loc === "area" ? "area" : "body", from) - eatN), loc === "vitals" ? "vitals" : "body")
          : loc === "area" ? expInj(w, t.u, "area", dmgOverride) : loc === "random" ? expInjRandom(w, t.u, dmgOverride) : expInj(w, t.u, loc, dmgOverride)) * (fo.fx ? fo.fx.keep(loc.replace("#c", "")) : 1);
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
    const canRetreat = (t, att) => !t.u.veh && (t.retreatFrom === att || (!t.retreated && !t.stunned && !t.stunRecovering && !t.mna && !t.grips.length && !(t.kneel && !t.prone) && !!retreatHex(t, att)));
    // shields cover the front and the shield (left) side (B287)
    const shieldCovers = (t, att) => { const a = arcTo(t, att); return a === "front" || (a === "side" && sideOf(t.h, t.facing, att.h) === "L"); };
    const shieldDB = t => t.u.cs && t.shState === "ok" && !t.blockLost ? t.u.cs.db : 0;
    const canParry = t => t.u.parry != null && bladeReady(t) && !(t.u.melee.unbalanced && t.attacked && !t.defAtk) && t.armsLost < 2 && (!t.armsLost || t.u.melee.oneHanded !== false) && !t.mna;
    // the defences open to t against att: kind is melee, ranged, pb (a gun fired at point-blank) or thrown.
    // With Damage to Shields in play (B484) a shield's DB counts against every attack from its arcs (B287)
    function defOpts(t, att, kind, aw) {
      if (t.state !== "ok" || t.aoa || t.pinned) return null;
      if (t.u.veh && (t.immobile || !vehDriver(t))) return null;   // evasive driving needs a driver and a vehicle that moves (B469)
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

