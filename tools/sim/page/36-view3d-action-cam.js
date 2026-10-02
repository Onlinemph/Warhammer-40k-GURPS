// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= the action camera: a wide shot of whoever moved, then over the shoulder of each attacker in turn
    const camLook = new THREE.Vector3(orb.tx, orb.ty, orb.tz), camWant = new THREE.Vector3(), lookWant = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
    const beatAt = (pl, p) => { let b = null; for (const x of pl.beats) if (p >= x.start - .25 / pl.tsc) b = x; return b; };
    // close in: side on; middling range: over the shoulder with both in frame; long range: over the shoulder, then
    // a cut to the target as the shot goes in
    function shotOf(b, p) {
      const A = figs[b.a]; if (!A || !A.g.visible) return null;
      const tF = b.tgt >= 0 ? figs[b.tgt] : null;
      const a = A.g.position.clone(), [qx, qy] = P(b.at[0], b.at[1]);
      const bp = tF && tF.g.visible ? tF.g.position.clone() : W3(qx, qy, zOf(b.at[0], b.at[1]));
      const h = A.veh ? 1.6 : Math.max(.8, A.top), ht = tF ? (tF.veh ? 1.6 : Math.max(.8, tF.top)) : 1, dir = bp.clone().sub(a); dir.y = 0;
      const d = Math.max(.01, dir.length()); dir.divideScalar(d);
      const mid = a.clone().add(bp).multiplyScalar(.5);
      // keep to the side of the line the camera is already on, so it doesn't swing across
      const side = new THREE.Vector3(-dir.z, 0, dir.x); if (side.dot(camera.position.clone().sub(mid)) < 0) side.negate();
      if (d <= 2.2) {
        camWant.copy(mid).addScaledVector(side, 3 + h).addScaledVector(UP, 1.6 + h * .6).addScaledVector(dir, -.8);
        lookWant.copy(mid).addScaledVector(UP, h * .5); return "melee";
      }
      if (d > 10 && p >= b.fireP + .12 / TS) {
        camWant.copy(bp).addScaledVector(dir, -(4 + ht * 1.5)).addScaledVector(side, 1.5 + ht * .4).addScaledVector(UP, 1.8 + ht);
        lookWant.copy(bp).addScaledVector(UP, ht * .85); return "target";
      }
      camWant.copy(a).addScaledVector(dir, -(2.4 + h * 1.2)).addScaledVector(side, 1 + h * .4).addScaledVector(UP, 1.6 + h * 1.1);
      lookWant.copy(a).addScaledVector(dir, Math.min(d * .6, 7)).addScaledVector(UP, h * .45); return "shoulder";
    }
    function wideOf(t) {
      const f = fr[t] || [], pts2 = [];
      figs.forEach((F, i) => { if (F.g.visible && f[i] && f[i][6] && f[i][6].length) pts2.push(F.g.position); });
      if (!pts2.length) return false;
      const c = new THREE.Vector3(); pts2.forEach(q => c.add(q)); c.divideScalar(pts2.length);
      let ext = 0; pts2.forEach(q => { ext = Math.max(ext, Math.hypot(q.x - c.x, q.z - c.z)); });
      const th = Math.atan2(camera.position.z - camLook.z, camera.position.x - camLook.x), r = ext * 1.2 + 8, ph = .9;
      lookWant.copy(c); camWant.set(c.x + r * Math.sin(ph) * Math.cos(th), c.y + r * Math.cos(ph), c.z + r * Math.sin(ph) * Math.sin(th));
      return true;
    }
    let camKey = "";
    function cineCam(dt) {
      const pl = planOf(last.t), b = TS > 1 ? beatAt(pl, last.p) : null;
      const mode = b ? shotOf(b, last.p) : wideOf(last.t) ? "wide" : pl.beats.length ? shotOf(pl.beats[0], 0) : null;
      if (!mode) return;
      // a cut rather than a long flight: to the target as the shot goes in, or to an attack far across the table
      const key = last.t + ":" + (b ? b.a : -1) + ":" + mode;
      if (key !== camKey) { camKey = key; if (mode === "target" || camera.position.distanceTo(camWant) > 30) { camera.position.copy(camWant); camLook.copy(lookWant); camera.lookAt(camLook); return; } }
      // swoop up and over on the way to a new shot, so the camera doesn't fly through the figures in between
      const far = camera.position.distanceTo(camWant); camWant.y += Math.min(5, far * .35);
      const k = 1 - Math.exp(-dt * 3.5);
      camera.position.lerp(camWant, k); camLook.lerp(lookWant, k); camera.lookAt(camLook);
    }
    // back to the orbit camera where the action camera left it
    function syncOrb() {
      const v = camera.position.clone().sub(camLook); orb.tx = camLook.x; orb.ty = camLook.y; orb.tz = camLook.z;
      orb.r = v.length(); orb.ph = Math.acos(Math.max(-1, Math.min(1, v.y / orb.r))); orb.th = Math.atan2(v.z, v.x); place();
    }
    // what the beat's attacker did, and after the impact what came of it
    const cap = document.createElement("div"); cap.className = "vtt-cap"; cap.hidden = true; host.appendChild(cap);
    let capKey = "";
    function caption() {
      const pl = planOf(last.t), p = last.p, b = lastSt.cine && TS > 1 ? pl.beats.find(x => p >= x.start && p < x.start + x.len) || (p >= 1 ? pl.beats[pl.beats.length - 1] : null) : null;
      if (!b) { if (!cap.hidden) cap.hidden = true; capKey = ""; return; }
      let shown = 0; for (const r of b.rounds) { if (p >= r.ip) shown++; for (const x of r.res) if (p >= x.p) shown++; }
      const key = last.t + ":" + b.a + ":" + shown;
      if (key === capKey) return; capKey = key;
      const A = ros[b.a], who = i => i >= 0 && ros[i] ? ros[i].id : "the ground", Tn = who(b.tgt);
      const nm = w => w.replace(/ \(.*$/, "").replace(/,.*$/, ""), gun = !A.veh && A.ranged ? nm(A.ranged) : "", blade = A.melee ? nm(A.melee) : "";
      const blast = b.rounds[0] && b.rounds[0].blast;
      const verb = b.melee ? `strikes at ${esc(Tn)}${blade ? " with " + esc(blade) : ""}` : b.kind === "grenade" ? `throws a grenade at ${esc(Tn)}` : b.kind === "lob" ? `drops a shell on ${esc(Tn)}`
        : `fires ${b.shots > 1 ? b.shots + " shots " : ""}at ${esc(Tn)}${gun ? " with " + esc(gun) : ""}`;
      const how = { dodge: "dodged", parry: "parried", block: "blocked" };
      const resTxt = (x, r) => {
        const e = x.e, other = e[1] !== r.e[8] && e[0] !== "b" ? esc(who(e[1])) + ": " : "";
        if (e[0] === "v") return other + (how[e[2]] || "dodged");
        if (e[0] === "f") return other + "shield holds";
        if (e[0] === "h") return other + (e[2] > 0 ? `<b>${e[2]} injury</b>, ${esc(e[3])}` : `armour holds (${esc(e[3])})`) + (x.down ? ` <b class="dn">down</b>` : "");
        return "";
      };
      const items = [];
      b.rounds.forEach((r, j) => {
        if (p < r.ip) return;
        const lab = b.melee ? `Blow ${j + 1}` : blast ? "Blast" : `Shot ${j + 1}`;
        const rs = r.res.filter(x => p >= x.p).map(x => resTxt(x, r)).filter(Boolean);
        // a blast (a grenade, a shell, a plasma or missile burst): what it did to each model, the shrugged-off hits counted
        if (blast || r.res.some(x => x.e[0] === "b") || r.res.length > 2) {
          const seen = r.res.filter(x => p >= x.p), held = seen.filter(x => x.e[0] === "h" && x.e[2] <= 0 && !x.down);
          items.push(`<li class="hit"><span class="n">${lab}</span>${blast ? (r.res.some(x => x.e[0] !== "b") ? "" : "no one caught") : "hit" + (seen.some(x => x.e[0] === "b") ? " · it bursts" : "")}</li>`);
          seen.filter(x => !held.includes(x)).map(x => resTxt(x, { e: [0, 0, 0, 0, 0, 0, 0, 0, -9] })).filter(Boolean).forEach(t2 => items.push(`<li class="hit sub">${t2}</li>`));
          if (held.length) items.push(`<li class="miss sub">armour holds on ${held.length === 1 ? esc(who(held[0].e[1])) : held.length + " models"}</li>`);
          return;
        }
        items.push(`<li class="${r.hit ? "hit" : "miss"}"><span class="n">${lab}</span>${r.hit ? "hit" + (rs.length ? " · " + rs.join(" · ") : "") : "miss"}</li>`);
      });
      cap.hidden = false; cap.className = "vtt-cap s" + (A.side ? "b" : "a");
      cap.innerHTML = `<span class="who">${esc(A.id)}</span> ${verb}${items.length ? `<ol class="shots">${items.join("")}</ol>` : ""}`;
    }
    // the animation clock: idle breathing, particles, beams, flashes and the follow camera run on their own
    let running = false, raf2 = 0;
    function tick(now) {
      if (!running) return;
      const dt = Math.min(.1, (now - lastFrameT) / 1000); lastFrameT = now; clock += dt;
      update(last.t, last.p, lastSt);
      glow.step(dt); smoke.step(dt);
      for (let j = shots.length - 1; j >= 0; j--) {
        const s = shots[j]; s.age += dt; const f = Math.min(1, s.age / s.dur);
        const at = s.a.clone().lerp(s.b, f); at.y += Math.sin(Math.PI * f) * s.arc;
        glow.add({ x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, age: 0, life: .05, s0: s.size, s1: s.size * .8, c: C(s.c), a: 1 });
        if (s.trail) glow.add({ x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, age: 0, life: .12, s0: s.size * .55, s1: .02, c: C(s.c), a: .6 });
        if (s.smokeTrail) smoke.add({ x: at.x, y: at.y, z: at.z, vx: (rnd() - .5) * .2, vy: .1, vz: (rnd() - .5) * .2, age: 0, life: 1.2, s0: .2, s1: .7, c: C(0x8a8478), a: .4, fadeIn: 1 });
        if (f >= 1) { if (s.onHit) s.onHit(at); shots.splice(j, 1); }
      }
      for (let j = beams.length - 1; j >= 0; j--) {
        const b = beams[j]; b.age += dt; const f = b.age / b.life;
        if (f >= 1) { scene.remove(b.core); scene.remove(b.halo); b.core.material.dispose(); b.halo.material.dispose(); beams.splice(j, 1); continue; }
        const a2 = 1 - f; b.core.material.opacity = a2; b.halo.material.opacity = a2 * .35;
        const jit = b.jitter ? (rnd() - .5) * b.jitter : 0; b.halo.scale.x = b.halo.scale.z = b.r * (2.2 + jit * 10);
      }
      for (const fl of flashes) { fl.age += dt; fl.l.intensity = fl.age < fl.life ? fl.i0 * (1 - fl.age / fl.life) : 0; }
      if (lastSt.cine) cineCam(dt);
      else if (lastSt.follow && lastSt.sel >= 0 && figs[lastSt.sel] && figs[lastSt.sel].g.visible) {
        const P2 = figs[lastSt.sel].g.position, kk = Math.min(1, dt * 3);
        orb.tx += (P2.x - orb.tx) * kk; orb.tz += (P2.z - orb.tz) * kk; orb.ty += (P2.y - orb.ty) * kk; place();
      }
      caption();
      render();
      raf2 = requestAnimationFrame(tick);
    }
    if (window.SIM3D_DEBUG) window.SIM3D_DEBUG = { glow, smoke, beams, shots, sched: () => sched, figs, planOf, fx, camera, camLook, camWant, lookWant };
    const active = on => { if (on && !running) { running = true; lastFrameT = performance.now(); raf2 = requestAnimationFrame(tick); } else if (!on && running) { running = false; cancelAnimationFrame(raf2); } };

