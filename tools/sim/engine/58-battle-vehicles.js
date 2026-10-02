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
      m.aoa = m.aod = m.mna = false; m.steps = 0; m.moved = false; m.movedFar = false; m.waiting = null; m.waitOpen = null; clearZone(m);
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
            const sc = Math.min(...melee.map(f => hexDist(g, f.h))) + (terr && idx(key(g.q, g.r)) == null ? -99 : 0);
            if (sc > bs) { bs = sc; best = g; }
          }
          if (best) { drove = stepToward(m, best, steps, 0); if (drove) L(`${m.id} reverses away from ${melee[0].id}`); }
        } else if (!shots) {
          drove = stepToward(m, pool[0].h, steps, 1);
          if (drove) L(`${m.id} drives forward (${drove} yd)`);
        }
        m.vel = drove;
        // the front armour to the worst gun that can hurt it (a tracked hull pivots in place)
        const at = pool.filter(f => (f.u.ranged && expInjRandom(f.u.ranged, u) > 0) || (f.u.veh && f.u.veh.stations.some(s => s.w && expInjRandom(s.w, u) > 0)))
          .sort((a, b) => threatOf(b) / Math.max(1, hexDist(b.h, m.h)) - threatOf(a) / Math.max(1, hexDist(a.h, m.h)))[0] || pool[0];
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
          add(Wm * kv(m, t, E) - risk(m, n, "") + 0.001, `flank@${t.id}`, () => {
            if (step) place(m, n); else stepToward(m, n, mv, 0);
            if (!m.h || !t.h || hexDist(m.h, t.h) > 1 || m.state !== "ok") return;
            m.moved = true; faceTo(m, t.h); L(`${m.id} goes round to the ${arcOf(t.h, t.facing, m.h)} of ${t.id}`); strike(m, w, t, step ? {} : { charge: true });
          });
        }
      }
    }
    function act(m) {
      if (m.u.veh) return vehicleAct(m);
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
      // lying down costs -3 to every defence (B551): a model gets up unless lying there keeps it out of the line of
      // fire (behind a crate, a parapet or a crest, so the foes' fire mostly can't reach it) or it has gone to ground
      // with nothing left to fight with
      const downSafe = () => { if (m.lyingLow) return true; const rDown = risk(m, m.h, ""); m.prone = false; const rUp = risk(m, m.h, ""); m.prone = true; return rDown < 0.5 * rUp; };
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
      if (bladeReady(m) && !m.grips.length && m.u.melee.reachMax <= 2) flankOptions(m, pool, add, Wm);
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
      // disarmed (a crippled arm, a dropped or broken gun) and with fists that can't hurt the foe: stay down out of
      // the line of fire rather than walk at the enemy
      if (!adj.length && !opts.some(o => /^(fire |aim@|hold@|reload|tac-reload|ready-|re-ready-|throw|grenade|cast|suppress|wait@|watch@)/.test(o.label))
        && (!u.melee || !pool[0] || expInjRandom(u.melee, pool[0].u) < 1)) {
        add(-0.5 * risk(m, here, "duck"), "lie-low", () => { if (!m.prone) { m.prone = true; L(`${m.id} goes to ground, with nothing left to fight with`); } else L(`${m.id} keeps its head down`); });
      }
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
      m.lyingLow = pick.label === "lie-low";
      if (globalThis.SIM_DEBUG) globalThis.SIM_DEBUG(m, opts.slice().sort((a, b) => b.v - a.v).slice(0, globalThis.SIM_DEBUG_ALL ? 40 : 6).map(o => `${o.label}=${o.v.toFixed(3)}`).join("  "));
      pick.run();
    }

