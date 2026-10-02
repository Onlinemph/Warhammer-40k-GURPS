// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
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
            // and the aimer has to live to take the shot: under heavy fire a second spent aiming may be its last
            const live = 1 - Math.min(0.95, incoming(m, m.h, "") / remOf(m));
            add(GAMMA * live * Wr * kv(m, t, keepP * Eaim + (1 - keepP) * Eun) - GAMMA * ffCost - rNow, `aim@${t.id}`, () => {
              if (m.aimTarget !== t) m.aimTurns = 0;
              m.aimTarget = t; m.aimTurns++; faceTo(m, t.h); L(`${m.id} aims at ${t.id}`);
            });
          }
        }
        // a weapon that only bites inside 1/2D (a meltagun at a tank's glacis) goes in on its own, squad or not
        const closeOnly = t => {
          if (!w.range || !w.range.half || !w.dmg || hexDist(m.h, t.h) < w.range.half) return false;
          const half = { ...w.dmg, mult: w.dmg.mult / 2, key: (w.dmg.key || "") + "h" };
          if (t.u.veh) { const dr = vehFacingDR(t, "body", m.h); return vehExp(w.dmg, w.follow, dr, "body") > 2 * vehExp(half, null, dr, "body") + 0.5; }
          return expInjRandom(w, t.u) > 2 * expInjRandom(w, t.u, half) + 0.5;
        };
        const keep = t => closeOnly(t) ? 0 : cohesion(m, t);
        // Move and Attack (B365): step up the range and fire at -2 (or Bulk), no Aim; the new position counts next turn
        if (u.stance !== "shoot" && cands.length && !(w.fp)) {
          const t = cands[0], d = hexDist(m.h, t.h), hold = Math.max(2, keep(t));
          if (d > hold + 1) {
            const mv = Math.min(moveOf(m), d - hold), nd = d - mv;
            const h2 = stepHex(m.h, t.h, mv);
            const E = planAttack(m, w, t, wl(m, w) - skillPen(m) + rangePenalty(nd + spdOf(t.steps || 0)) + t.u.sm + Math.min(-2, w.bulk || 0), false, null, { from: h2 }).score * sustainOf(w);
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
          if (d > stop + 1 && (rangePenalty(d) <= -5 || w.fp)) {
            const h2 = stepHex(m.h, t.h, Math.min(moveOf(m), d - stop));
            // a short-ranged gun looks further ahead: the shot from inside 1/2D, however many moves away
            let sv = GAMMA * shotValueFrom(m, h2, pool);
            if (w.range && w.range.half > stop && d > w.range.half) {
              const k = Math.ceil((d - w.range.half + 1) / Math.max(1, moveOf(m)));
              if (k > 1) sv = Math.max(sv, Math.pow(GAMMA, k) * shotValueFrom(m, stepHex(m.h, t.h, d - w.range.half + 1), pool));
            }
            add(sv - risk(m, h2, "") - 0.001, `move-closer@${t.id}`, () => {
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
        // a grenade that can't really hurt anyone (frags on power armour: a point or so of blunt trauma a fragment) isn't
        // worth the seconds to ready it: it has to promise at least 5% of the target's remaining HP
        if (g && g.v >= kv(m, g.c, Math.max(0.5, 0.05 * remOf(g.c)))) {
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
