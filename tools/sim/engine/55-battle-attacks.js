// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
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
        FX(["s", m.h.q, m.h.r, t.h.q, t.h.r, m.u.side, 0, m.ix, t.ix, lvl, 0, nb, wkind(w)]);
        wild();
        return;
      }
      let hits = got;
      FX(["s", m.h.q, m.h.r, t.h.q, t.h.r, m.u.side, got ? 1 : 0, m.ix, t.ix, lvl, got, nb, wkind(w)]);
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
            const dg = Math.min(open, 1 + def); hits -= dg; L(`  ${t.id} dodges ${dg}`); if (t.h) for (let k = 0; k < dg; k++) FX(["v", t.ix, "dodge", t.h.q, t.h.r]);
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
      FX(["s", m.h.q, m.h.r, target.h.q, target.h.r, m.u.side, r.ok ? 1 : 0, m.ix, target.ix, lvl, r.ok ? 1 : 0, 1, wkind(w)]);
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
      // a vehicle's mounted gun can't be dropped or turned in the hand: a critical miss is a stoppage (B407)
      if (m.u.veh) { say(`jams the ${w.name}`); m.jam = 3; m.jamSkill = (m.u.stats.iq || 10) - 5 + 2; return; }
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

