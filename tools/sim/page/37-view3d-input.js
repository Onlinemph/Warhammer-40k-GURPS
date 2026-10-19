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
    const up = e => { ptr.delete(e.pointerId); if (ptr.size < 2) pin = null; if (drag && !drag.moved && ptr.size === 0) { const [sx, sy] = loc(e), i = hit(sx, sy), g2 = i < 0 && o.onGround ? groundAt(sx, sy) : null; if (!(g2 && o.onGround(hexAt(g2[0], g2[1])))) o.onPick(i); } if (!ptr.size) drag = null; };
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
    // ================= portraits: a figure's head and shoulders as a small picture, in its side's colours. One per
    // kind of model and side, drawn from a figure of that kind that is standing (layer 1 holds just that figure and
    // the lights), and drawn again once the game's model has replaced the built one.
    const PS = 128, prt = keep(new THREE.WebGLRenderTarget(PS, PS)), pcam = new THREE.PerspectiveCamera(26, 1, .05, 60), pix = new Uint8Array(PS * PS * 4), pmade = new Map();
    pcam.layers.set(1); scene.traverse(x => { if (x.isLight) x.layers.enable(1); });
    function portrait(i) {
      const r = ros[i]; if (!r || !figs[i]) return null;
      const kind = `${r.side}|${r.template}|${r.veh || ""}|${r.kit || ""}`;
      const F = figs.find(G => G.g.visible && !deathOf(G.i, last.t) && ros[G.i] && `${ros[G.i].side}|${ros[G.i].template}|${ros[G.i].veh || ""}|${ros[G.i].kit || ""}` === kind && !(fr[last.t] && fr[last.t][G.i] && (fr[last.t][G.i][7] & 2)));
      const key = kind + "|" + (F && F.model ? 1 : 0), have = pmade.get(kind);
      if (have && (have.key === key || !F)) return have.url;
      if (!F) return null;
      F.g.updateMatrixWorld(true);
      const yaw = F.g.rotation.y, fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), rt = new THREE.Vector3(-fwd.z, 0, fwd.x), top = F.veh ? 2.2 : F.top;
      // the head, by the model's own head bone where it has one (a Genestealer's is nowhere near the top of its back)
      let head = null; if (F.model && !F.veh) { F.model.root.traverse(x => { if (!head && x.isBone && /head/i.test(x.name) && !/nub|headgear|_end/i.test(x.name)) head = x; }); }
      const look = head ? head.getWorldPosition(new THREE.Vector3()).addScaledVector(UP, -top * .06) : F.g.position.clone().addScaledVector(UP, F.veh ? top * .5 : top * .8), dist = F.veh ? 9 : Math.max(1.7, top * 1.1);
      pcam.position.copy(look).addScaledVector(fwd, dist * .9).addScaledVector(rt, dist * .42).addScaledVector(UP, dist * .12); pcam.lookAt(look); pcam.updateMatrixWorld(true);
      F.g.traverse(x => x.layers.enable(1)); const barsOn = F.bars.visible, selOn = F.sel.visible; F.bars.visible = false; F.sel.visible = false;
      const bg = scene.background, fog = scene.fog, clr = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
      scene.background = null; scene.fog = null; renderer.setClearColor(0x1b1c22, 1); renderer.setRenderTarget(prt); renderer.clear(); renderer.render(scene, pcam);
      renderer.readRenderTargetPixels(prt, 0, 0, PS, PS, pix);
      renderer.setRenderTarget(null); renderer.setClearColor(clr, ca); scene.background = bg; scene.fog = fog;
      F.g.traverse(x => x.layers.disable(1)); F.bars.visible = barsOn; F.sel.visible = selOn;
      // the target holds linear light, upside down: to sRGB, a little brighter, the right way up
      const c = document.createElement("canvas"); c.width = c.height = PS; const g = c.getContext("2d"), im = g.createImageData(PS, PS), lin2 = renderer.outputEncoding !== THREE.sRGBEncoding || true;
      for (let y = 0; y < PS; y++) for (let x = 0; x < PS; x++) { const s = 4 * ((PS - 1 - y) * PS + x), d = 4 * (y * PS + x); for (let ch = 0; ch < 3; ch++) { const v = pix[s + ch] / 255; im.data[d + ch] = Math.min(255, 255 * Math.pow(Math.min(1, v * 1.35), lin2 ? 1 / 2.2 : 1)); } im.data[d + 3] = 255; }
      g.putImageData(im, 0, 0);
      const url = c.toDataURL("image/jpeg", .85); pmade.set(kind, { key, url }); return url;
    }
    return {
      update(t, p, st) { update(t, p, st); if (!running) render(); }, resize, active,
      secLen(t) { return planOf(t).tsc; },
      calm(t) { return !planOf(t).beats.length; },
      portrait,
      // a battle being played has gone on: scan the new beats
      grow() { scanDowns(); scanBlasts(); decalT = -1; resync(); },
      // turn the camera to a model that is out of the middle of the view
      look(i) { const F = figs[i]; if (!F || lastSt.cine) return; const d = Math.hypot(F.g.position.x - orb.tx, F.g.position.z - orb.tz); if (d > orb.r * .45) { orb.tx = F.g.position.x; orb.tz = F.g.position.z; place(); if (!running) { update(last.t, last.p, last.st); render(); } } },
      sound: setSound,
      cineOff() { syncOrb(); cap.hidden = true; },
      fit(whole) { fit(whole); update(last.t, last.p, last.st); render(); },
      dispose() { active(false); clearText(); clearLines(); for (const b of beams) { scene.remove(b.core); scene.remove(b.halo); } for (const d of disposables) d.dispose && d.dispose(); if (composer) composer.renderTarget1 && composer.renderTarget1.dispose(); renderer.dispose(); el.remove(); },
    };
  }

  let vtt = null;
