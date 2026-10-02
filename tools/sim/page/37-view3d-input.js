// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= input
    const el = renderer.domElement, ptr = new Map(); let drag = null, pin = null;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const hit = (sx, sy) => { ndc.set(sx / W * 2 - 1, -sy / H * 2 + 1); ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(pick.filter(m => { let p2 = m; while (p2.parent && p2.parent !== scene) p2 = p2.parent; return p2.visible; }), false)[0]; return h ? h.object.userData.i : -1; };
    const loc = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("pointerdown", e => { el.setPointerCapture(e.pointerId); ptr.set(e.pointerId, loc(e)); const [sx, sy] = loc(e); drag = { sx, sy, pan: e.button === 2 || e.shiftKey, moved: false }; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pin = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), r: orb.r, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; } });
    el.addEventListener("pointermove", e => {
      const [sx, sy] = loc(e);
      if (!ptr.has(e.pointerId)) { const i = hit(sx, sy); if (i !== last.st.hover) o.onHover(i, sx, sy); else if (i >= 0) o.onHover(i, sx, sy); return; }
      const [px0, py0] = ptr.get(e.pointerId); ptr.set(e.pointerId, [sx, sy]);
      if (pin && ptr.size === 2) {
        const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        orb.r = pin.r * pin.d / Math.max(1, d); panBy(mx - pin.mx, my - pin.my); pin.mx = mx; pin.my = my; place(); return;
      }
      if (!drag) return;
      const dx = sx - px0, dy = sy - py0;
      if (Math.abs(sx - drag.sx) + Math.abs(sy - drag.sy) > 4) drag.moved = true;
      if (lastSt.cine && drag.moved) { o.onCineOff && o.onCineOff(); lastSt.cine = false; syncOrb(); }
      if (drag.pan) panBy(dx, dy); else { orb.th += dx * .008; orb.ph -= dy * .008; }
      place(); if (!running) { update(last.t, last.p, last.st); render(); }
    });
    // the ground under the pointer follows it: right is (sin, -cos), forward (away from the camera) is (-cos, -sin)
    const panBy = (dx, dy) => { const s = orb.r * .0016, c = Math.cos(orb.th), n = Math.sin(orb.th); orb.tx += (-c * dy - n * dx) * s; orb.tz += (-n * dy + c * dx) * s; };
    const up = e => { ptr.delete(e.pointerId); if (ptr.size < 2) pin = null; if (drag && !drag.moved && ptr.size === 0) { const [sx, sy] = loc(e); o.onPick(hit(sx, sy)); } if (!ptr.size) drag = null; };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", () => o.onHover(-1));
    // zoom toward the ground under the pointer
    const groundAt = (sx, sy) => { ndc.set(sx / W * 2 - 1, -sy / H * 2 + 1); ray.setFromCamera(ndc, camera); const d = ray.ray.direction, o2 = ray.ray.origin; if (d.y > -1e-3) return null; const k2 = -o2.y / d.y; return [o2.x + d.x * k2, o2.z + d.z * k2]; };
    el.addEventListener("wheel", e => {
      e.preventDefault(); if (lastSt.cine) { o.onCineOff && o.onCineOff(); lastSt.cine = false; syncOrb(); }
      const f = Math.exp(e.deltaY * .0012), g2 = groundAt(...loc(e));
      if (g2 && f < 1) { orb.tx += (g2[0] - orb.tx) * (1 - f); orb.tz += (g2[1] - orb.tz) * (1 - f); }
      orb.r *= f; place(); if (!running) { update(last.t, last.p, last.st); render(); }
    }, { passive: false });
    return {
      update(t, p, st) { update(t, p, st); if (!running) render(); }, resize, active,
      secLen(t) { return planOf(t).tsc; },
      cineOff() { syncOrb(); cap.hidden = true; },
      fit(whole) { fit(whole); update(last.t, last.p, last.st); render(); },
      dispose() { active(false); clearText(); clearLines(); for (const b of beams) { scene.remove(b.core); scene.remove(b.halo); } for (const d of disposables) d.dispose && d.dispose(); if (composer) composer.renderTarget1 && composer.renderTarget1.dispose(); renderer.dispose(); el.remove(); },
    };
  }

  let vtt = null;
