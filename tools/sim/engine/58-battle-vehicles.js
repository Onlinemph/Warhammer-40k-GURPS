// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ---- a vehicle's second (B467-469): the crew close up on empty stations, the driver moves (or overruns), then
    // every gunner works his own weapon at his own target, in his own arc
    const vehDriver = m => { const x = m.stn && m.stn.find(y => y.s.station === "driver"); return x && crewOK(x.man) && x.busy !== turn && !x.man.stunned ? x : null; };
    function crewShuffle(m) {
      const need = x => x.s.station === "driver" || (x.s.w && !x.out);
      for (let i = 0; i < m.stn.length; i++) {
        const x = m.stn[i];
        if (crewOK(x.man) || !need(x)) continue;
        // the lowest-priority crewman free to move takes the empty seat; it costs him the second (B467)
        for (let j = m.stn.length - 1; j > i; j--) {
          const y = m.stn[j];
          if (!crewOK(y.man) || y.busy === turn || (need(y) && y.s.station === "driver")) continue;
          x.man = y.man; y.man = null; x.busy = turn; x.aimTurns = 0;
          L(`${m.id}'s ${y.s.role.toLowerCase()} takes over as ${x.s.role.toLowerCase()}`);
          break;
        }
      }
    }
    // which way a station's gun can fire: a turret or pintle all round (a jammed turret only to the hull's front),
    // a hull gun to the front, a sponson to the front and its own side
    function arcOK(m, x, h) {
      const a = x.s.arc;
      if (a === "pintle" || (a === "turret" && !m.turretJam)) return true;
      const arc = arcOf(m.h, m.facing, h);
      if (a === "front" || a === "turret") return arc === "front";
      return arc === "front" || (arc === "side" && sideOf(m.h, m.facing, h) === (a === "left" ? "L" : "R"));
    }
    // firing from a moving ground vehicle across country (B548): stabilised turret -1, turret or hull mount -2, an
    // external open mount -3
    const movePen = (m, x) => !m.moved ? 0 : x.s.stab ? 1 : x.s.arc === "pintle" ? 3 : 2;
    const vehShotLvl = (m, x, w, t) => wl(m, w) + (m.moved ? 0 : 1) + rangePenalty(rngD(m.h, t.h, Math.max(1, hexDist(m.h, t.h))) + spdOf(t.steps || 0)) + t.u.sm - darkPen(m, t) - movePen(m, x);
    function vehicleAct(m) {
      const u = m.u, V = u.veh;
      m.aoa = m.aod = m.mna = false; m.steps = 0; m.moved = false; m.movedFar = false; m.waiting = null; setOpen(m, null); clearZone(m);
      if (m.doNothing) { m.doNothing = false; return; }
      if (m.surprised) { m.surprised = false; L(`${m.id} is caught by surprise`); return; }
      if (m.skipNext) { m.skipNext = false; m.skipWhy = null; return; }
      crewShuffle(m);
      const pool = known(m).filter(f => f.h && f.state === "ok").sort((a, b) => hexDist(m.h, a.h) - hexDist(m.h, b.h));
      const drv = vehDriver(m);
      if (!pool.length) { m.vel = 0; if (AWARE && drv && !m.immobile) search(m); return; }
      // ---- the driver
      const half = 2 ** m.propHalf * (m.wheelsLost ? 2 : 1);
      const top = Math.max(1, Math.floor(V.top / half)), acc = Math.max(1, Math.floor(V.accel / half));
      const steps = Math.min(top, m.vel + acc);
      let drove = 0;
      // a transport drives its passengers in and drops them at assault range (8 yards for a charging squad, 20 for
      // shooters), or at once if it can't move
      const carrying = (m.cargo || []).some(x => x.state === "aboard");
      if (carrying) {
        const drop = m.cargo.some(x => x.u.stance === "charge") ? 8 : 20;
        if (drv && !m.immobile && hexDist(m.h, pool[0].h) > drop) { drove = stepToward(m, pool[0].h, steps, drop); if (drove) L(`${m.id} drives its passengers forward (${drove} yd)`); m.vel = drove; }
        if (!drv || m.immobile || hexDist(m.h, pool[0].h) <= drop || (drv && !drove)) dismount(m, false);
        if (drv && pool[0].h) m.facing = faceToward(m.h, pool[0].h);
      } else if (drv && !m.immobile) {
        // a good shot from here (an aimed shot from some gun worth a twentieth of what a foe has left) holds it
        // still; otherwise it drives in
        const shots = m.stn.some(x => x.s.w && !x.out && !x.gunBroken && crewOK(x.man) && (x.ammo > 0 || x.mags > 0 || x.reloading > 0 || x.s.w.shots.mag === Infinity) && pool.some(f => hexDist(m.h, f.h) <= x.s.w.range.max && arcOK(m, x, f.h) && los(m.h, f.h)
          && planAttack(m, x.s.w, f, vehShotLvl(m, x, x.s.w, f) + (x.s.w.acc >= 2 && !x.s.w.cone ? x.s.w.acc : 0), false, null, { aim: x.s.w.acc, braced: true }).score >= 0.05 * remOf(f)));
        // foes that could close and hurt it in hand-to-hand (power fists, melta bombs on the rear armour)
        const rearDR = V.dr.rear;
        const melee = pool.filter(f => f.u.melee && !f.u.veh && vehExp(f.u.melee.dmg, f.u.melee.follow, rearDR, "body") >= 0.03 * u.HP && hexDist(f.h, m.h) <= moveOf(f) + f.u.melee.reachMax + 1);
        const adj = pool.filter(f => hexDist(f.h, m.h) === 1 && canTrample(m, f) && !f.u.veh);
        if (adj.length && !melee.some(f => hexDist(f.h, m.h) === 1 && !canTrample(m, f))) {
          // run them down (an overrun, B404): the driver's attack this second
          const t = adj.sort((a, b) => threatOf(b) - threatOf(a))[0];
          trample(m, t); m.vel = 0;
        } else if (melee.length) {
          // back away from anyone who could get a melta bomb or a power fist onto it, guns still firing
          let best = null, bs = -Infinity;
          for (const [dq, dr] of DIRS) {
            const g = { q: m.h.q + dq * steps, r: m.h.r + dr * steps };
            const sc = Math.min(...melee.map(f => hexDist(g, f.h))) + (terr && iQR(g.q, g.r) == null ? -99 : 0);
            if (sc > bs) { bs = sc; best = g; }
          }
          if (best) { drove = stepToward(m, best, steps, 0); if (drove) L(`${m.id} reverses away from ${melee[0].id}`); }
        } else if (!shots) {
          drove = stepToward(m, pool[0].h, steps, 1);
          if (drove) L(`${m.id} drives forward (${drove} yd)`);
        }
        m.vel = drove;
        // the front armour to the worst gun that can hurt it (a tracked hull pivots in place)
        const at = !m.h ? null : pool.filter(f => f.h && ((f.u.ranged && expInjRandom(f.u.ranged, u) > 0) || (f.u.veh && f.u.veh.stations.some(s => s.w && expInjRandom(s.w, u) > 0))))
          .sort((a, b) => threatOf(b) / Math.max(1, hexDist(b.h, m.h)) - threatOf(a) / Math.max(1, hexDist(a.h, m.h)))[0] || pool.find(f => f.h);
        if (at && at.h && m.h) m.facing = faceToward(m.h, at.h);
      } else m.vel = 0;
      // ---- the gunners
      for (const x of m.stn) {
        const w = x.s.w;
        if (!w || x.out || !crewOK(x.man) || x.busy === turn || m.state !== "ok") continue;
        if (x.man.stunned) { x.man.stunned = false; continue; }
        if (x.gunBroken) continue;
        if (x.jam > 0) { if (--x.jam === 0) { if (check(x.jamSkill).ok) L(`${m.id}'s ${x.s.role.toLowerCase()} clears the ${w.name}`); else x.jam = 3; } continue; }
        if (w.shots.mag !== Infinity && x.ammo <= 0 && !x.reloading) {
          if (x.mags <= 0) continue;
          const ld = m.stn.find(y => y.s.loads === x.s.role && crewOK(y.man) && y.busy !== turn);
          x.reloading = Math.max(1, ld ? Math.ceil(w.shots.reload / 2) : w.shots.reload);
        }
        if (x.reloading > 0) { if (--x.reloading === 0) { x.ammo = w.shots.mag; x.mags--; } continue; }
        if (m.moved && !x.s.stab) x.aimTurns = 0;
        let best = null;
        for (const f of pool) {
          if (f.state !== "ok" || !f.h) continue;
          const d = hexDist(m.h, f.h);
          if (d > w.range.max || (w.minRange && d < w.minRange) || !arcOK(m, x, f.h) || !los(m.h, f.h) || duckedFrom(f, m.h)) continue;
          // no shell into a melee with our own side in it
          if ((w.dmg.ex || w.blast) && models.some(y => y.u.side === u.side && y !== m && y.state === "ok" && y.h && !y.u.veh && hexDist(y.h, f.h) <= 3)) continue;
          const lvl = vehShotLvl(m, x, w, f), aimed = x.aimT === f && x.aimTurns > 0;
          const now = kv(m, f, planAttack(m, w, f, lvl + (aimed ? w.acc : 0), false, null, { aim: aimed ? w.acc : 0, braced: !m.moved }).score);
          const later = !aimed && !m.moved && w.acc >= 2 && !w.cone ? GAMMA * kv(m, f, planAttack(m, w, f, lvl + w.acc, false, null, { aim: w.acc, braced: true }).score) : 0;
          const v = Math.max(now, later);
          if (v > 0 && (!best || v > best.v)) best = { f, v, aimed, aim: later > now };
        }
        if (!best) { x.aimTurns = 0; x.aimT = null; continue; }
        if (x.s.arc === "turret" && !m.turretJam) m.turretFacing = faceToward(m.h, best.f.h);
        if (best.aim) { x.aimT = best.f; x.aimTurns = 1; L(`${m.id}'s ${x.s.role.toLowerCase()} lays the ${w.name.split(",")[0]} on ${best.f.id}`); continue; }
        if (best.aimed) x.aimTurns++;
        const save = { id: m.id, ammo: m.ammo, aimTurns: m.aimTurns, follow: m.follow, jam: m.jam, gunBroken: m.gunBroken };
        m.id = `${save.id} (${x.s.role.toLowerCase()})`; m.ammo = x.ammo; m.aimTurns = best.aimed ? x.aimTurns - 1 : 0; m.follow = x.follow; m.jam = 0; m.gunBroken = false;
        fireAt(m, w, best.f, { aim: best.aimed, pen: movePen(m, x) });
        x.ammo = m.ammo; x.follow = m.follow; x.aimTurns = 0; x.aimT = null;
        if (m.jam) { x.jam = m.jam; x.jamSkill = m.jamSkill; }
        if (m.gunBroken) x.gunBroken = true;
        Object.assign(m, save);
      }
    }
    // hand-to-hand against a vehicle: step round it to a weaker facing (side, then rear) and strike there; a step is
    // part of an Attack (B364), and the hull's DR is the facing's (B554)
    function flankOptions(m, pool, add, Wm) {
      const w = m.u.melee, mv = moveOf(m);
      for (const t of pool) {
        if (!t.u.veh || !t.h || hexDist(m.h, t.h) > mv + 1) continue;
        const V = t.u.veh, adj0 = hexDist(m.h, t.h) <= 1, now = adj0 ? V.dr[arcOf(t.h, t.facing, m.h)] : V.dr.front;
        const dd = bestDefence(t, m, true, w);
        for (const [dq, dr] of DIRS) {
          const n = { q: t.h.q + dq, r: t.h.r + dr }, k = key(n.q, n.r);
          if (occ.has(k) || (terr && !walkable(k)) || (ELEV && Math.abs(elevAt(n) - elevAt(t.h)) > 0.5)) continue;
          const there = V.dr[arcOf(t.h, t.facing, n)], far = terr ? walk(m.h, n) : hexDist(m.h, n);
          if (there >= now || far > mv) continue;
          // one step is part of the Attack; more is a Move and Attack (-4, at most 9, B365)
          const step = far <= 1, lvl = step ? w.level - skillPen(m) + smMelee(m, t) : Math.min(9, w.level - skillPen(m) + smMelee(m, t) - 4);
          const E = P3[cl(lvl)] * (1 - (dd == null ? 0 : P3[cl(dd)])) * vehExp(w.dmg, w.follow, there, "body") * (step ? 1 + (m.u.flags.extraAttack || 0) : 1);
          DEST = n; add(Wm * kv(m, t, E) - risk(m, n, "") + 0.001, `flank@${t.id}`, () => {
            if (step) place(m, n); else stepToward(m, n, mv, 0);
            if (!m.h || !t.h || hexDist(m.h, t.h) > 1 || m.state !== "ok") return;
            m.moved = true; faceTo(m, t.h); L(`${m.id} goes round to the ${arcOf(t.h, t.facing, m.h)} of ${t.id}`); strike(m, w, t, step ? {} : { charge: true });
          });
        }
      }
    }
    let DEST = null;
    // the foes a model has to get away from: those whose hand-to-hand blows can hurt it and that could be on it
    // within six of their moves (not a vehicle: nobody outruns a tank, and what it does to infantry is its guns' work)
    const menaces = (m, pool) => pool.filter(f => f.h && f.state === "ok" && f.u.melee && !f.u.veh && !f.pinned && expInjRandom(f.u.melee, m.u) >= 1 && (terr ? walk(m.h, f.h) : hexDist(m.h, f.h)) - f.u.melee.reachMax <= 6 * moveOf(f));
    // where to fall back to: of the hexes within a full Move, the one furthest from the nearest of them, out of
    // their sight counting for four yards more; nothing if nowhere is better than where it stands
    function awayFrom(m, from) {
      const mv = runMove(m), start = key(m.h.q, m.h.r), prev = new Map([[start, null]]), q = [{ h: m.h, d: 0 }];
      const score = h => Math.min(...from.map(f => hexDist(h, f.h))) + (from.some(f => los(f.h, h)) ? 0 : 4);
      let best = null, bs = score(m.h) + 0.5;
      for (let i = 0; i < q.length && i < 900; i++) {
        const { h, d } = q[i];
        if (d > 0) { const s = score(h); if (s > bs) { bs = s; best = h; } }
        if (d >= mv) continue;
        for (const [dq, dr] of DIRS) {
          const n = { q: h.q + dq, r: h.r + dr }, nk = key(n.q, n.r);
          if (prev.has(nk) || taken(nk)) continue;
          prev.set(nk, h); q.push({ h: n, d: d + 1 });
        }
      }
      if (!best) return null;
      const path = [];
      for (let k = key(best.q, best.r), n = best; k !== start; ) { path.unshift(n); const p = prev.get(k); k = key(p.q, p.r); n = p; }
      return { h: best, path };
    }
    // ---- infantry against a vehicle (user direction): a weapon that can't get through the plate in front of it may
    // get through the side or the rear, so a model with nothing to do from where it stands works round to the face
    // its weapon needs, at a run, half the squad each way so the hull can't keep its front to all of them.
    // The least of a vehicle's faces a weapon gets through on an average roll, for at least 1% of its HP
    const FACES = ["front", "side", "rear"], NEED = { front: 0, side: 100 * Math.PI / 180, rear: 160 * Math.PI / 180 };
    function faceFor(w, t) {
      const d = w && w.dmg;
      if (!d || w.malediction) return null;
      for (const f of FACES) if (vehAvg(w, vehFacingDRof(t, f)) >= 0.01 * t.u.HP) return f;
      return null;
    }
    // the injury an average roll of a weapon does to a hull through plate of that DR
    const vehAvg = (w, dr) => { const d = w.dmg; return Math.max(0, (d.n * 3.5 + (d.add || 0)) * (d.mult || 1) - (d.div === Infinity ? 0 : Math.floor(dr / d.div))) * vehMult(d.type, "body", d.ex); };
    const vehFacingDRof = (t, f) => Math.max(0, t.u.veh.dr[f] - ((t.corr && t.corr[f]) || 0));
    // what a model still has to fight with: its gun (with rounds for it), its blade, the grenades it has left, its
    // powers, and for a loader the team's gun it would take over
    const kitOf = x => x.u.veh ? x.stn.filter(s => s.s.w && !s.out && !s.gunBroken).map(s => s.s.w)
      : [x.u.ranged && !x.gunBroken && (x.armsLost < 1 || (x.armsLost < 2 && gunReady(x))) && (x.ammo > 0 || x.mags > 0 || x.u.ranged.shots.mag === Infinity) ? x.u.ranged : null,
        x.u.melee && x.armsLost < 2 && !x.meleeBroken ? x.u.melee : null, x.u.heavy && x.u.crew !== "gunner" && !x.tookOver && x.armsLost < 1 ? x.u.heavy : null, ...x.u.grenades.filter((g, i) => x.grenadesLeft[i] > 0), ...x.u.powers].filter(Boolean);
    // could x hurt f at all, with anything it has, from any side of it? (a tenth of a point of injury a second counts:
    // a heavy bolter chipping at a Carnifex is still a fight)
    const canHurt = (x, f) => kitOf(x).some(w => f.u.veh ? !!faceFor(w, f) : w.malediction || (w.dmg && !hopeless(w, f, x.h) && (w.cone ? expInj(w, f.u, "area") : expInjRandom(w, f.u) * Math.max(1, w.rof || 1)) >= 0.1));
    const sideCanHurt = (side, foes) => models.some(x => x.u.side === side && x.state === "ok" && x.h && foes.some(f => canHurt(x, f)));
    const hexOfPx = (x, y) => {
      const q = x / 1.5, r = y / Math.sqrt(3) - q / 2, s = -q - r;
      let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
      const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
      if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
      return { q: rq, r: rr };
    };
    // the nearest hex to h a model can stand on (h itself if it can)
    function standNear(h) {
      const ok = n => { const k = key(n.q, n.r); return !taken(k) && (!terr || walkable(k)); };
      if (ok(h)) return h;
      for (let rad = 1; rad <= 8; rad++) for (let dq = -rad; dq <= rad; dq++) for (let dr = Math.max(-rad, -dq - rad); dr <= Math.min(rad, -dq + rad); dr++) {
        const n = { q: h.q + dq, r: h.r + dr };
        if (hexDist(n, h) === rad && ok(n)) return n;
      }
      return null;
    }
    // Where to go to get a weapon onto a face it can get through: { w, arc, goal, inArc, wait, gi }, or nothing.
    // A gun makes for the face itself (the nearer way round, and from in front of it by turns). Grenades and blades
    // can't chase a hull that pivots faster than a man runs, so those models ring it instead: each takes its own
    // place on a circle round it, and uses what it has when the weak plate comes round to it.
    // the angle each hex direction points at, for working round a vehicle (deterministic: datan2, not Math.atan2)
    const DIRANG = DIRS.map(([q, r]) => { const [x, y] = px({ q, r }); return datan2(y, x); });
    function huntPlan(m, t) {
      const u = m.u, cand = [];
      if (u.ranged && !u.ranged.cone && !m.gunBroken && (m.ammo > 0 || m.mags > 0 || u.ranged.shots.mag === Infinity)) { const a = faceFor(u.ranged, t); if (a) cand.push({ w: u.ranged, arc: a, r: Math.min(u.ranged.range.half || u.ranged.range.max, 40), gun: true }); }
      if (m.armsLost < 1) u.grenades.forEach((g, i) => { if (m.grenadesLeft[i] > 0) { const a = faceFor(g, t); if (a) cand.push({ w: g, arc: a, r: Math.min(g.range.max, 8), gi: i }); } });
      if (u.melee && m.armsLost < 2 && !m.meleeBroken) { const a = faceFor(u.melee, t); if (a) cand.push({ w: u.melee, arc: a, r: 3 }); }
      if (!cand.length) return null;
      // the least demanding face first, then the longer reach
      const best = cand.sort((x, y) => FACES.indexOf(x.arc) - FACES.indexOf(y.arc) || y.r - x.r)[0], need = NEED[best.arc];
      const [tx, ty] = px(t.h), [mx, my] = px(m.h), d = hexDist(m.h, t.h), ma = datan2(my - ty, mx - tx);
      const norm = x => { while (x > Math.PI) x -= 2 * Math.PI; while (x <= -Math.PI) x += 2 * Math.PI; return x; };
      const off = norm(ma - DIRANG[t.facing]), inArc = Math.abs(off) >= need;
      let sign, left;
      if (best.gun || need === 0) {
        if (Math.abs(off) > 0.6) m.huntSign = Math.sign(off); else if (m.huntT !== t) m.huntSign = Math.abs(off) > 0.35 ? Math.sign(off) : m.ix % 2 ? 1 : -1;
        sign = m.huntSign; left = inArc ? 0 : need - sign * off;
        if (inArc && d <= best.r) return null;   // in place already: what stops it isn't where it stands
      } else {
        const ring = models.filter(x => x.u.side === u.side && !x.u.veh), delta = norm(2 * Math.PI * ring.indexOf(m) / ring.length - ma);
        sign = delta < 0 ? -1 : 1; left = Math.abs(delta);
        const spot = hexOfPx(tx + Math.sqrt(3) * best.r * dcos(ma + delta), ty + Math.sqrt(3) * best.r * dsin(ma + delta));
        if (hexDist(spot, m.h) <= 1 || (left < 0.25 && d <= best.r + 1)) return { ...best, inArc, wait: true, goal: m.h };
      }
      m.huntT = t;
      // a step of the way: up to 70 degrees round, closing as it goes (never nearer than it needs to be, or 12 yards)
      const turn1 = Math.min(left, 70 * Math.PI / 180), last = turn1 >= left;
      const rad = last ? Math.min(d, best.r) : Math.max(Math.min(d, best.r), Math.min(d, Math.max(12, 0.7 * d)));
      const a2 = ma + sign * turn1, goal = standNear(hexOfPx(tx + Math.sqrt(3) * rad * dcos(a2), ty + Math.sqrt(3) * rad * dsin(a2)));
      return !goal ? null : hexDist(goal, m.h) >= 1 ? { ...best, inArc, goal } : best.gun ? null : { ...best, inArc, wait: true, goal: m.h };
    }
    // a model a person commands directly (not a vehicle, whose crew the AI plays)
    const directed = m => isHuman(m.u.side) && m.u.direct && !m.u.veh;
    // act returns nothing when the turn is done, or the choice it has to put to the player: { opts, pick, adj }
    function act(m) {
      if (m.u.veh) return vehicleAct(m);
      const u = m.u, A = u.ai;
      m.aoa = false; m.aod = false; m.mna = false; m.offBalance = false; m.readied = false; m.steps = 0; m.moved = false; m.movedFar = false;
      m.runPrev = m.runK || 0; m.runK = 0;   // a sprint carries on only through consecutive straight Moves
      if (m.feint && m.feint.turn !== turn - 1) m.feint = null;   // a feint lapses if not used the next turn (B365)
      clearZone(m); m.waiting = null; m.watch = false; m.ducked = false; setOpen(m, null);
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
      m.scanT = -1;   // a fresh look at the field each time it acts
      const pool = scanFoes(m).filter(f => f.state === "ok" && f.h).sort((a, b) => walk(m.h, a.h) - walk(m.h, b.h));
      if (!pool.length) {
        // no foe known: the AI goes looking (or follows its order); the player's model asks where to go (search, hold, or a hex of their choosing)
        if (directed(m) && !m.berserk) {
          const o2 = [...(AWARE ? [{ v: 0, label: "search", run: () => search(m), to: null }] : []), { v: -1e-6, label: "pass", run: () => L(`${m.id} holds`), to: null }];
          return { opts: o2, pick: o2[0], adj: [] };
        }
        if (!orderMove(m) && AWARE) search(m); return;
      }
      const adj = pool.filter(f => hexDist(f.h, m.h) <= u.melee.reachMax && los(m.h, f.h) && levelOK(m.h, u, f.h, f.u, u.melee));
      const shooter = u.ranged || u.powers.some(p => !p.melee);
      // stand up (Change Posture) unless a shooter holding its ground is better off prone
      // a firing line (house rule on B364/B551: kneeling to or from standing is the step of a maneuver): a shooter
      // holding its ground with friends behind it kneels to fire, so they shoot over it; it rises when a foe closes
      // to 3 yards, when it moves (afterStep) or when its squad charges
      // kneeling to standing is the step of a maneuver (B364): it rises and acts, but can't also move
      let rose = false;
      if (m.kneel && !m.prone && !m.kneelVol) { m.kneel = false; rose = true; L(`${m.id} stands up`); }
      // lying down costs -3 to every defence (B551): a model gets up unless lying there keeps it out of the line of
      // fire (behind a crate, a parapet or a crest, so the foes' fire mostly can't reach it) or it has gone to ground
      // with nothing left to fight with
      const downSafe = () => { if (m.lyingLow || (UP(u) && m.lowAt != null && turn - m.lowAt <= 3)) return !menaces(m, pool).length; if (UP(u)) return false; const rDown = risk(m, m.h, ""); m.prone = false; const rUp = risk(m, m.h, ""); m.prone = true; return rDown < 0.5 * rUp; };
      if (m.prone && m.legsLost < 2 && !gripsOn(m).length && (adj.length || !downSafe())) {
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
      // DEST: the hex a moving option ends on, set just before it is added, for the page to show
      const add = (v, label, run) => { if (Number.isFinite(v)) opts.push({ v, label, run, to: DEST && MOVES.test(label) ? DEST : null }); DEST = null; };
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
      if (bladeReady(m) && !m.grips.length && m.u.melee.reachMax <= 2) flankOptions(m, pool, add, Wm);
      if (adj.length) meleeOptions(m, adj, add, rNow, Wm, Wr, mw);
      else {
        rangedOptions(m, pool, add, rNow, Wr);
        if (bladeReady(m)) approachOptions(m, pool, add, Wm);
      }
      // Ready the other weapon (B382): worth what it could do next turn
      // (not straight back to what it just put away: swapping every second is a deadlock, not a plan)
      if ((!u.bothReady || m.inHand !== "both") && !m.grips.length && turn - (m.lastSwitch ?? -99) >= 4) {
        const tmp = [], save = m.inHand, push = v => { DEST = null; if (Number.isFinite(v)) tmp.push(v); };
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
            if (t) { const e = []; meleeOptions(m, [t], v => { DEST = null; if (Number.isFinite(v)) e.push(v); }, rNow, Wm, Wr, weaponsFor(m, true)); if (e.length) early = GAMMA * 0.7 * Math.max(...e); }
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
        const tmp = [], push = v => { DEST = null; if (Number.isFinite(v)) tmp.push(v); };
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
        const tmp = [], push = v => { DEST = null; if (Number.isFinite(v)) tmp.push(v); };
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
        DEST = hide && hide.h; if (hide) { const top0 = opts.reduce((a, b) => b.v > a.v ? b : a, { v: 0 }); add(top0.v + 0.3 * Math.max(0.02, Math.abs(top0.v)), "peel", () => { followPath(m, hide.path, moveOf(m)); L(`${m.id} falls back out of sight`); }); }
      }
      // fire and movement: the covering half leans to shooting (and aiming), the bounding half to moving up
      if (m.role && !adj.length && !(pool[0] && hexDist(pool[0].h, m.h) <= 5)) {
        const moveL = /^(advance@|move-closer@|cover@|advance-fire@|close@)/, fireL = /^(fire |aim@|aoa-fire@|suppress|wait@|watch@)/;
        const top0 = opts.reduce((a, b) => b.v > a.v ? b : a, { v: 0 });
        const bonus = 0.3 * Math.max(0.02, Math.abs(top0.v));
        for (const o of opts) if ((m.role === "bound" ? moveL : fireL).test(o.label)) o.v += bonus;
      }
      if (u.team) crewOptions(m, pool, opts, add, rNow, adj);
      // Nothing it has can hurt the foe (a crippled arm, a dropped gun, or a foe its weapons can't touch).
      const NOTHING = /^(fire |aim@|hold@|reload|tac-reload|ready-|re-ready-|throw|grenade|cast|suppress|wait@|watch@)/;
      // Against a vehicle, with nothing to do from here: work round to a face of it that something it carries can
      // get through. It is taken ahead of anything else it could do (none of which harms the foe).
      // (only with nothing but vehicles to fight, and nothing in hand that bites the plate it is looking at)
      const bitesNow = t => los(m.h, t.h) && [u.ranged && gunReady(m) && !m.gunBroken && (m.ammo > 0 || u.ranged.shots.mag === Infinity) ? u.ranged : null, ...(m.armsLost < 1 ? u.grenades.filter((g, i) => m.grenadesLeft[i] > 0) : [])]
        .some(w => w && hexDist(m.h, t.h) <= w.range.max && vehAvg(w, vehFacingDR(t, "body", m.h)) >= 0.01 * t.u.HP);
      const tank = !adj.length && !m.grips.length && m.legsLost < 1 && !m.headsDown && pool.every(f => f.u.veh) && !pool.some(bitesNow)
        && !opts.some(o => /^(reload|tac-reload|concentrate|flank@|crew|setup|set-up)/.test(o.label)) ? pool.find(f => f.h) : null;
      const hunt = tank ? huntPlan(m, tank) : null;
      if (hunt) {
        const top0 = opts.reduce((a, b) => b.v > a.v ? b : a, { v: 0 });
        DEST = stepHex(m.h, hunt.goal, runMove(m));
        add(top0.v + 0.05 * Math.max(0.02, Math.abs(top0.v)) + 0.001, `hunt@${tank.id}`, () => {
          if (m.prone) { m.prone = false; m.kneel = true; L(`${m.id} gets up to a kneel`); return; }
          // in its place on the ring: the grenade out and armed, then wait for the plate to come round
          if (hunt.wait) {
            if (hunt.gi != null && grenadeStage(m, hunt.gi) < 2) readyGrenade(m, hunt.gi);
            else L(`${m.id} waits for ${tank.id} to show its ${hunt.arc} armour`);
            return;
          }
          const n = stepToward(m, hunt.goal, runMove(m), 0);
          if (n >= moveOf(m) - 1) m.runK = m.runPrev + 1;
          if (m.state !== "ok" || !m.h) return;
          const nm = hunt.w.name.split(",")[0];
          L(!n ? `${m.id} can't get round ${tank.id}` : hunt.inArc ? `${m.id} closes on ${tank.id}'s ${hunt.arc === "front" ? "front" : hunt.arc + " armour"} with its ${nm}` : `${m.id} works round to ${tank.id}'s ${hunt.arc} armour with its ${nm}`);
        });
      }
      // With only vehicles to fight and nothing left that gets through any face of them (the grenades thrown, the
      // launcher empty), it is out of the fight: no plinking at the hull, no walking up to it, no swapping weapons.
      const spent = !hunt && !adj.length && pool.every(f => f.u.veh) && !pool.some(f => canHurt(m, f));
      if (spent) for (let i = opts.length - 1; i >= 0; i--) if (/^(fire |aim@|hold@|aoa-fire@|advance-fire@|move-closer@|advance@|close@|charge|aoa-charge|heroic|ready-blade|ready-gun|re-ready-gun|draw-early|suppress|watch@|wait)/.test(opts[i].label)) opts.splice(i, 1);
      const helpless = hunt ? false : spent ? true : adj.length ? adj.every(f => !u.melee || expInjRandom(u.melee, f.u) < 1) && !opts.some(o => /^(point-blank|aoa-point-blank|dual|fire |throw|cast)/.test(o.label))
        // (having nobody in sight to shoot at is not the same thing: it must have nothing that can hurt any of them)
        : !opts.some(o => NOTHING.test(o.label)) && (!u.melee || !pool[0] || expInjRandom(u.melee, pool[0].u) < 1) && !pool.some(f => canHurt(m, f));
      // (and it doesn't walk up to a foe it can do nothing to)
      if (helpless && !adj.length) for (let i = opts.length - 1; i >= 0; i--) if (/^(move-closer@|advance-fire@|advance@|close@)/.test(opts[i].label)) opts.splice(i, 1);
      // Self-preservation (user direction): it doesn't wait to be cut down. From a foe whose blows can hurt it and
      // that is closing, it falls back: a full Move to the hex it can reach that is furthest from them, out of their
      // sight if it can be. It leaves the field only when the fight is lost: ten seconds of running in a row, and
      // nobody left on its side with anything that can hurt the foe (while a squad-mate's heavy weapon is still
      // in the fight it keeps its distance and stays). With nothing on its side able to hurt any foe it knows of, it
      // withdraws from all of them the same way, a tank included.
      const lost = helpless && !m.grips.length && m.legsLost < 1 && !sideCanHurt(u.side, pool);
      const close = helpless && !m.grips.length && m.legsLost < 1 ? menaces(m, pool) : [];
      // (and, with nothing left for it, from a vehicle it is within 30 yards of: that is no place to lie down)
      const threat = close.length ? close : lost ? pool.filter(f => f.h && f.state === "ok") : helpless && !m.grips.length && m.legsLost < 1 ? pool.filter(f => f.u.veh && f.h && f.state === "ok" && hexDist(f.h, m.h) <= 30) : [];
      // Run down by something faster, it turns at bay (user direction): if the best it can do still leaves a foe able to
      // reach it this second, running only offers its back. The bold strike back for what it's worth; the careful
      // go on All-Out Defense.
      const reaches = (f, h) => !f.u.veh && f.u.melee && hexDist(h, f.h) - f.u.melee.reachMax <= moveOf(f) + 1;
      const to = threat.length ? awayFrom(m, threat) : null;
      const bay = close.length && close.some(f => reaches(f, m.h) && (!to || reaches(f, to.h))) ? close.filter(f => reaches(f, m.h)).sort((a, b) => hexDist(a.h, m.h) - hexDist(b.h, m.h))[0] : null;
      if (bay) {
        const hit = A.caution < 1 && u.melee && bladeReady(m) && hexDist(bay.h, m.h) <= u.melee.reachMax && los(m.h, bay.h);
        add(-risk(m, here, hit ? "" : "aod") + 0.003, "stand", () => {
          m.fled = 0; faceTo(m, bay.h);
          if (hit) { L(`${m.id} turns at bay and fights ${bay.id}, though its blows can't hurt it`); strike(m, u.melee, bay, {}); return; }
          m.aod = true;
          const par = u.parry != null ? u.parry + 1 : -1, blk = u.db ? u.block + 1 : -1, dod = u.dodge + 3;
          m.aodDef = par >= dod && par >= blk ? "parry" : blk >= dod ? "block" : "dodge";
          L(`${m.id} turns at bay against ${bay.id}: it can't outrun it (All-Out Defense, +2 ${m.aodDef})`);
        });
      } else if (threat.length) {
        if (to) {
          DEST = to.h;
          add((adj.length ? -1 : -0.45) * risk(m, to.h, "") + 0.002, "fall-back", () => {
            const mv = moveOf(m), n = followPath(m, to.path, runMove(m));
            if (n >= mv - 1) m.runK = m.runPrev + 1;
            m.fled = (m.fledAt === turn - 1 ? m.fled || 0 : 0) + 1; m.fledAt = turn;
            L(n ? `${m.id} falls back from ${threat[0].id}` : `${m.id} can't get away from ${threat[0].id}`);
            // (once it has got clear: with the foe still within two moves it keeps running)
            if (m.fled >= 10 && m.state === "ok" && m.h && !threat.some(f => f.h && !f.u.veh && f.u.melee && hexDist(f.h, m.h) - f.u.melee.reachMax <= 2 * moveOf(f)) && !sideCanHurt(u.side, pool)) { if (fx) FX(["q", m.ix, fleePath(m)]); m.state = "routed"; place(m, null); L(`  ${m.id} quits the field: nothing its side has left can hurt the foe`); }
          });
        }
      }
      // With no such foe near, it gets out of the line of fire: behind something if there is anything within a Move,
      // and else down on the ground, rather than walk at the enemy. (This is the one time the elite lie down too:
      // nothing to shoot back with and nowhere to hide. A faction set to stay on its feet doesn't even then.)
      const stuck = !threat.length || (!to && !bay);
      const seen = !adj.length && helpless && stuck && pool.some(f => f.h && los(f.h, m.h));
      const hide = seen && !m.prone ? hideHex(m, pool) : null;
      if (hide) { DEST = hide.h; add(-0.4 * risk(m, hide.h, ""), "take-cover", () => { followPath(m, hide.path, moveOf(m)); L(`${m.id} gets out of the line of fire`); }); }
      if (!adj.length && helpless && stuck && !u.ai.upright && (seen || !UP(u))) {
        add(-0.5 * risk(m, here, "duck"), "lie-low", () => { m.lowAt = turn; if (!m.prone) { m.prone = true; L(`${m.id} goes to ground, with nothing left to fight with`); } else L(`${m.id} keeps its head down`); });
      }
      if (!adj.length) orderOption(m, opts, add, rNow);
      // keeping its head down (TS p. 21): only what doesn't expose it: reload, ready, defend, a door, or stay down
      if (m.headsDown && !adj.length) {
        const safe = opts.filter(o => /^(reload|reloading|tac-reload|ready-|re-ready-|draw-early|orders|aod|concentrate|close-door|door)/.test(o.label));
        opts.length = 0; opts.push(...safe);
        add(-rNow * 0.5, "heads-down", () => L(`${m.id} keeps its head down`));
      }
      if (rose) { const still = opts.filter(o => !/^(advance|close|charge|aoa-charge|heroic|move-closer|advance-fire|cover@|peel|reload-cover|step-|ca-flyout|watch|fall-back|take-cover|hunt@|flank@|assault@|support@)/.test(o.label)); opts.length = 0; opts.push(...still); }
      if (!opts.length) return;
      // pick the best; a disorderly faction picks among the near-best
      const top = opts.reduce((a, b) => b.v > a.v ? b : a);
      let pick = top;
      if (A.noise > 0) {
        const span = Math.max(0.05, Math.abs(top.v)) * A.noise;
        const close = opts.filter(o => o.v >= top.v - span);
        pick = close[Math.floor(AR() * close.length)];
      }
      // Battle Rage (B124): berserk on entering combat unless it makes its self-control roll
      if (u.flags.battleRage && !m.rageRolled) { m.rageRolled = true; if (roll3() > u.flags.berserk + ledBonus(m)) goBerserk(m, "battle rage"); }
      // the player's model: the choice is theirs (a berserker's isn't), with holding still always offered
      if (directed(m) && !m.berserk) { add(-1e-6, "pass", () => L(`${m.id} holds`)); return { opts, pick, adj }; }
      pick = mentalPick(m, opts, pick, adj);
      // (lying low lasts through anything done from the ground: orders, a reload)
      m.lyingLow = pick.label === "lie-low" || (!!m.lyingLow && m.prone && !MOVES.test(pick.label) && pick.label !== "stand");
      if (globalThis.SIM_DEBUG) globalThis.SIM_DEBUG(m, opts.slice().sort((a, b) => b.v - a.v).slice(0, globalThis.SIM_DEBUG_ALL ? 40 : 6).map(o => `${o.label}=${o.v.toFixed(3)}`).join("  "));
      pick.run();
    }
    // carry out the player's answer for a model: an option's number, { move: hex } to walk or run to a hex, or
    // nothing for the AI's own pick. Self-control rolls still apply to what was chosen (B120)
    function obey(m, pend, ans) {
      if (ans && ans.move) {
        const goal = { q: ans.move.q, r: ans.move.r };
        if (goal.q === m.h.q && goal.r === m.h.r) { L(`${m.id} holds`); return; }
        const from = m.h, mv = moveOf(m), said = log ? log.length : 0, n = stepToward(m, goal, runMove(m), 0);
        if (!n && log && log.length === said) return false;
        if (n >= mv - 1) m.runK = m.runPrev + 1;
        if (m.state === "ok" && m.h && n) faceTo(m, { q: 2 * m.h.q - from.q, r: 2 * m.h.r - from.r });
        L(n ? `${m.id} moves ${n} yard${n === 1 ? "" : "s"} (ordered)` : `${m.id} can't move that way`);
        return;
      }
      let o = typeof ans === "number" && pend.opts[ans] ? pend.opts[ans] : pend.pick;
      o = mentalPick(m, pend.opts, o, pend.adj);
      m.lyingLow = o.label === "lie-low";
      o.run();
    }

