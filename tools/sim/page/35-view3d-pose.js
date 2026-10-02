// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= posing the miniatures
    const facingAng = d => [0, -60, -120, 180, 120, 60][d] * Math.PI / 180;
    const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
    const bump = (x, w) => x < 0 || x > w ? 0 : Math.sin(Math.PI * x / w);
    let last = { t: 0, p: 1, st: {} }, clock = 0;
    function pose(F, x, bitsv, p, ev, at, dt, dead) {
      const B = F.B || {};
      // walking: the stride follows the ground actually covered
      const prevAt = F.last; F.last = at ? [at[0], at[1]] : null;
      const moved = prevAt && at ? Math.hypot(at[0] - prevAt[0], at[1] - prevAt[1]) : 0;
      const speed = dt > 0 ? moved / dt : 0;
      F.walk += ((speed > .3 ? Math.min(1, speed / 3) : 0) - F.walk) * Math.min(1, dt * 8);
      F.phase += moved * (F.veh ? 1 : 4.2 / Math.max(.6, F.k));
      const prone = bitsv & 2, kneel = bitsv & 4, stun = bitsv & 1, aimB = bitsv & 128, reload = bitsv & 1024;
      // this second's actions
      const fires = ev.fire || [], swings = ev.swing || [], dodges = ev.dodge || [], hits = ev.hit || [];
      let aimT = aimB ? 1 : 0, recoil = 0, swing = -1, dodge = 0, flinch = 0, throwing = -1;
      for (const f of fires) { const d = (p - f.p) * TS; if (d >= -.3 && d <= .55) aimT = 1; if (d >= 0) recoil = Math.max(recoil, Math.exp(-d * 22)); if (f.kind === "grenade" && d >= -.25 && d <= .2) throwing = (d + .25) / .45; }
      for (const s of swings) { const d = (p - s.p) * TS; if (d >= -.2 && d <= .3) swing = (d + .2) / .5; }
      for (const d of dodges) dodge = Math.max(dodge, bump((p - d.p) * TS + .05, .3));
      for (const h of hits) { const d = (p - h.p) * TS; if (d >= 0) flinch = Math.max(flinch, Math.exp(-d * 9)); }
      if (reload) aimT = 0;
      F.aim += (aimT - F.aim) * Math.min(1, dt * 10 + (o.reduce ? 1 : 0));
      if (F.veh) return poseVehicle(F, x, ev, p, moved, dt, recoil);
      const fig = F.fig, k = F.k;
      fig.position.set(0, 0, 0); fig.rotation.set(0, 0, 0);
      const breathe = Math.sin(clock * 1.7 + F.i) * .012;
      // legs and arms by default: stance, idle sway, walk cycle
      const w = F.walk, ph = F.phase;
      if (F.hips) F.hips.position.y = F.hipY * (1 - .04 * w) + Math.abs(Math.sin(ph)) * .03 * w;
      for (const L of F.legs) {
        const sgn = (L.s > 0 ? 1 : -1) * (L.x != null && L.x < 0 ? -1 : 1);
        if (L.walker) { L.p.rotation.z = .5 + Math.sin(ph * .7 + (L.s > 0 ? 0 : Math.PI)) * .35 * w; L.kn.rotation.z = -1.0 - Math.max(0, Math.sin(ph * .7 + (L.s > 0 ? 0 : Math.PI))) * .4 * w; continue; }
        L.p.rotation.z = Math.sin(ph + (sgn > 0 ? 0 : Math.PI)) * .6 * w;
        L.kn.rotation.z = -Math.max(0, Math.sin(ph + (sgn > 0 ? 0 : Math.PI) - .9)) * .9 * w;
      }
      if (F.torso && !F.quad) F.torso.rotation.set(0, 0, -(B.hunch || 0) - .12 * w);
      if (F.torso) F.torso.scale.y = 1 + breathe;
      if (F.segs) F.segs.forEach((sg, j) => { sg.position.z = Math.sin(ph * 1.4 - j * .9) * .12 * (w + .2); });
      if (F.hover) F.hips.position.y = F.hipY + Math.sin(clock * 2 + F.i) * .06;
      if (F.wings) F.wings.forEach((wg, j) => { wg.rotation.x = (j ? -1 : 1) * (.5 + Math.sin(clock * 9) * .35); });
      const arms = F.arms, R2 = arms[0], L2 = arms[1];
      const gunLevel = F.aim;
      for (const a of arms) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
      if (!F.quad && R2) {
        // the gun arm: hanging at low ready, up and level when aiming, kicking back on a shot
        const swingArm = -Math.sin(ph + Math.PI) * .45 * w * (1 - gunLevel);
        R2.sh.rotation.z = .55 + gunLevel * .95 + swingArm - recoil * .25; R2.el.rotation.z = .35 * (1 - gunLevel) + recoil * .15;
        R2.sh.rotation.x = -.15 * gunLevel;
        if (L2) { L2.sh.rotation.z = .45 + gunLevel * .9 - swingArm; L2.el.rotation.z = .55 * gunLevel; L2.sh.rotation.x = .45 * gunLevel; }
        if (reload && L2) { R2.sh.rotation.z = .7; L2.sh.rotation.z = .9 + Math.sin(clock * 9) * .25; L2.el.rotation.z = 1.2; }
        if (F.gun) F.gun.position.x = -recoil * .08;
        if (throwing >= 0) { const s = throwing; R2.sh.rotation.z = s < .5 ? 1 + s * 3.4 : 2.7 - (s - .5) * 5; R2.el.rotation.z = -.4; }
        if (swing >= 0) {
          // an overhead blow with the blade arm, the body leaning into it
          const A2 = F.blade && L2 ? L2 : R2, s = swing;
          A2.sh.rotation.z = s < .4 ? .5 + ease(s / .4) * 2.4 : 2.9 - ease((s - .4) / .35) * 2.6;
          A2.el.rotation.z = s < .4 ? .2 : .1;
          if (F.torso) F.torso.rotation.z -= bump(s - .3, .6) * .35;
          if (A2 === L2 && R2) R2.sh.rotation.z = .5;
        }
        if (F.arms.length > 2) for (const a of F.arms.slice(2)) { a.sh.rotation.z = .9 + Math.sin(clock * 3 + a.s) * .15 + (swing >= 0 ? bump(swing, 1) * 1.2 : 0); a.el.rotation.z = -1.2; }
      } else if (F.quad) {
        for (const a of arms) { a.sh.rotation.z = 1.2 + (swing >= 0 ? bump(swing, 1) * (a.s > 0 ? 1.2 : .9) : 0) + Math.sin(clock * 2.3 + a.s) * .06; a.el.rotation.z = -1.8 + (swing >= 0 ? bump(swing - .2, .6) * 1.2 : 0); }
        if (F.torso) F.torso.rotation.z = -(swing >= 0 ? bump(swing - .2, .6) * .2 : 0);
      }
      if (F.head) F.head.rotation.set(0, 0, stun ? -.35 : -.05 * gunLevel);
      // flinch back from a wound, sway aside from a dodge
      if (F.torso) { F.torso.rotation.z += flinch * .45; F.torso.rotation.x = dodge * (F.i % 2 ? .5 : -.5); }
      fig.position.z = dodge * (F.i % 2 ? -.3 : .3) * k;
      // posture: kneeling on one knee, lying on the belly, reeling when stunned
      if (kneel && !prone && F.legs.length === 2) {
        F.hips.position.y = F.hipY * .55; const [a, b] = F.legs;
        a.p.rotation.z = 1.35; a.kn.rotation.z = -1.5; b.p.rotation.z = -.35; b.kn.rotation.z = -1.45;
      }
      if (prone && !F.quad && !F.segs) {
        fig.rotation.z = -Math.PI / 2 + .04; fig.position.y = .14 * k; fig.position.x = -.85 * k;
        if (R2) { R2.sh.rotation.z = 2.6 + gunLevel * .25; R2.el.rotation.z = .2; } if (L2) { L2.sh.rotation.z = 2.5; L2.el.rotation.z = .4; }
        for (const L of F.legs) { L.p.rotation.z = Math.sin(ph) * .2 * w; L.kn.rotation.z = -.2; }
      } else if (prone) fig.scale.y = .6;
      if (stun && !prone) { fig.rotation.x = Math.sin(clock * 5 + F.i) * .12; fig.rotation.z = .12; }
      // going down: toppling backward over the fall; then lying where it fell
      if (dead) {
        const f = dead.f; fig.rotation.z = ease(f) * (Math.PI / 2 - .05); fig.position.y = .1 * k * ease(f); fig.position.x = .55 * k * ease(f) * (F.quad ? 0 : 1);
        if (F.quad || F.segs) { fig.rotation.z = 0; fig.rotation.x = ease(f) * Math.PI / 2 * .9; fig.position.y = -.1 * k * ease(f); }
        for (const L of F.legs) { L.p.rotation.z = .3 * ease(f); L.kn.rotation.z = -.4 * ease(f); }
        if (R2) R2.sh.rotation.z = .5 + 1.8 * ease(f); if (L2) L2.sh.rotation.z = .3 + 2.2 * ease(f);
      }
    }
    function poseVehicle(F, x, ev, p, moved, dt, recoil) {
      for (const tm of F.tracks) tm.map.offset.x -= moved * .45;
      for (const w of F.wheels) w.rotation.z -= moved * 3;
      F.fig.position.y = F.walk > .1 && !F.walker ? Math.sin(clock * 22) * .01 : 0;
      if (F.walker) { for (const L of F.legs) { L.p.rotation.z = .5 + Math.sin(F.phase * 1.6 + (L.s > 0 ? 0 : Math.PI)) * .4 * F.walk; L.kn.rotation.z = -1.0 - Math.max(0, Math.sin(F.phase * 1.6 + (L.s > 0 ? 0 : Math.PI))) * .5 * F.walk; } F.hips.position.y = F.hipY + Math.abs(Math.sin(F.phase * 1.6)) * .05 * F.walk; }
      // the turret swings to its own facing (the gunner's last target), the guns recoil when they fire
      if (F.turret && x && x[10] != null) {
        const want = -facingAng(x[10]) - F.g.rotation.y;
        let cur = F.turret.rotation.y, d = ((want - cur) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        F.turret.rotation.y = cur + d * Math.min(1, dt * 4 + (o.reduce ? 1 : 0));
      }
      for (const b of F.barrels) b.position.x = (b.userData.x0 ?? (b.userData.x0 = b.position.x)) - recoil * .18;
      if (F.exhaust && !o.reduce && rnd() < (F.walk > .2 ? .6 : .15)) { const at = F.exhaust.clone().applyMatrix4(F.fig.matrixWorld); smoke.add({ x: at.x, y: at.y, z: at.z, vx: (rnd() - .5) * .2, vy: .6 + rnd() * .3, vz: (rnd() - .5) * .2, age: 0, life: 2.4, s0: .2, s1: .9, c: C(0x2a2826), a: .35, drag: .95, fadeIn: 1 }); }
    }

    // ================= one frame
    let lastFrameT = performance.now(), lastSt = {};
    function update(t, p, st) {
      last = { t, p, st }; lastSt = st;
      speedMs = +(document.getElementById("rspeed") || { value: 1000 }).value || 1000;
      if (schedT !== t || schedC !== !!st.cine) { if (t < schedT) { glow.clear(); smoke.clear(); } buildSchedule(t, !!st.cine); }
      const pm = TS > 1 ? Math.min(1, p * TS / MOVE) : p;   // with the action camera everyone moves first, then the beats play
      if (fxT !== t) buildText(t);
      buildDecals(t);
      // effects whose moment has come this second
      if (p < prevP) prevP = 0;
      for (const s of sched) if (s.p > prevP && s.p <= p) s.run();
      prevP = p;
      const f = fr[t] || [], prev = t > 0 ? fr[t - 1] || [] : [];
      const now = performance.now(), dt = Math.min(.1, (now - lastFrameT) / 1000);
      figs.forEach((F, i) => {
        const x = f[i];
        let at = posAt(i, t, pm), dead = null;
        const d = downs[i].find(dd => dd.t <= t && (dd.back == null || dd.back > t));
        if (!x && d) {
          if (!d.fell) { F.g.visible = false; return; }   // fled, boarded a transport or phased out: gone from the table
          at = d.at; dead = { f: d.t === t ? (o.reduce ? 1 : Math.max(0, Math.min(1, (p - (deathP.get(i) ?? .35 / TS)) * TS / .4))) : 1 };
        }
        const back = downs[i].find(dd => dd.back === t);
        if (x && back && back.fell && !o.reduce && p < .7) { at = back.at; dead = { f: 1 - Math.max(0, (p - .1) / .6) }; if (p > .1 && p < .14 && /Necron/.test(ros[i].faction || "")) burst(glow, F.g.position.clone().add(new THREE.Vector3(0, .5, 0)), 20, { speed: 1, life: .8, s0: .4, s1: .05, c: C(0x39ff6a), spread: .8, lift: 1 }); }
        F.g.visible = !!at;
        if (!at) return;
        const cur = x || prev[i] || (d && fr[d.t - 1] && fr[d.t - 1][i]) || [0, 0, F.side, 0, 0, 1, null, 0, -1, -1];
        F.g.position.set(at[0], zXY(at[0], at[1]), at[1]);
        const yaw = -facingAng(cur[4] || 0);
        if (F.yaw == null) F.yaw = yaw;
        let dy = ((yaw - F.yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; F.yaw += dy * Math.min(1, dt * 9 + (o.reduce || p >= 1 && !st.playing ? 1 : 0));
        F.g.rotation.y = F.yaw;
        pose(F, x, cur[7] || 0, p, evFor[i], at, dt, dead);
        F.sel.visible = !dead && (i === st.sel || i === st.hover); F.sel.material.color.set(i === st.sel ? 0xffffff : 0x9aa0a8);
        F.bars.visible = !dead;
        const hpv = cur[5] == null ? 1 : Math.max(0, cur[5]);
        F.hp.scale.set(1.24 * hpv, .13, 1); F.hp.position.x = -.62 + .62 * hpv; F.hp.material.color.set(hpv > .6 ? 0x5fbf6a : hpv > .3 ? 0xe3b341 : 0xe0564b);
        F.sp.visible = cur[8] >= 0; if (cur[8] >= 0) { F.sp.scale.set(1.24 * cur[8], .07, 1); F.sp.position.set(-.62 + .62 * cur[8], .14, 0); }
        F.bars.quaternion.copy(F.g.quaternion).invert().multiply(camera.quaternion);
        if (dead && dead.f >= 1 && F.veh && !o.reduce && rnd() < .5) { const sp2 = F.g.position.clone().add(new THREE.Vector3((rnd() - .5) * .6, 1, (rnd() - .5) * .6)); smoke.add({ x: sp2.x, y: sp2.y, z: sp2.z, vx: (rnd() - .5) * .3, vy: 1.2, vz: (rnd() - .5) * .3, age: 0, life: 4, s0: .5, s1: 2.2, c: C(0x1c1a18), a: .55, drag: .97, fadeIn: 1 }); if (rnd() < .3) glow.add({ x: sp2.x, y: sp2.y - .5, z: sp2.z, vx: 0, vy: .8, vz: 0, age: 0, life: .5, s0: .6, s1: .1, c: C(0xff7a20), a: .8 }); }
      });
      for (const r of rubble) r.g.visible = r.t <= t;
      if (T) {
        const state = new Map(doorList.map(k => [k, (T.shut || []).includes(k) ? "shut" : "open"]));
        const broken = new Set();
        for (const [tt, k, what] of T.events || []) if (tt <= t) { if (what === "broken") broken.add(k); if (state.has(k)) state.set(k, what === "broken" ? "rubble" : what === "closed" ? "shut" : "open"); }
        doorList.forEach((k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r), s2 = state.get(k); m4.compose(W3(x, y, 0), q0, new THREE.Vector3(1, s2 === "shut" ? 1 : .02, 1)); doorMesh.setMatrixAt(i, m4); doorMesh.setColorAt(i, col.set(s2 === "shut" ? 0x9aa1a8 : 0xd4a52a)); });
        doorMesh.instanceMatrix.needsUpdate = true; if (doorMesh.instanceColor) doorMesh.instanceColor.needsUpdate = true;
        wallList.forEach((k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.compose(W3(x, y, 0), q0, new THREE.Vector3(1, broken.has(k) ? .001 : wallH[i] * (st.lowWalls || st.cine ? .25 : 1), 1)); walls.setMatrixAt(i, m4); });
        walls.instanceMatrix.needsUpdate = true;
      }
      for (const o2 of fxObjs) o2.run(p);
      clearLines();
      f.forEach((x, i) => { if (!x || x[9] == null || x[9] < 0 || !f[x[9]]) return; const a = posAt(i, t, pm), c = posAt(x[9], t, pm); if (a && c) dashed([W3(a[0], a[1], zXY(a[0], a[1]) + figs[i].top * .6), W3(c[0], c[1], zXY(c[0], c[1]) + figs[x[9]].top * .55)], x[2] ? 0xf1d38a : 0xf08a7e, .45); });
      if (st.trails && t > 0) f.forEach((x, i) => { if (!x || !x[6] || !x[6].length || !prev[i]) return; dashed([P(prev[i][0], prev[i][1]), ...x[6].map(([q, r]) => P(q, r))].map(([a, b]) => W3(a, b, zXY(a, b) + .08)), x[2] ? 0xd6a73c : 0xc23a30, .55); });
      for (const l of gridLines) l.visible = !!st.grid;
    }
