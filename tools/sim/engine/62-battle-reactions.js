// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
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
      if (m.u.veh) return;
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

