// Planets in 3D (docs/setting.md): the planet card's globe. Each world a sphere, its regions the areas of it nearest
// their places on the flat map (spread over the sphere), coloured by holder and tinted by their ground, with city lights,
// your warband's region ringed and battles and sieges flaring. Drag to turn it, pick a region as on the flat map.
// three.js is loaded the first time a globe is shown (the same r128 the battle view uses).
(() => {
  const SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  let loading = null;
  const load = () => loading || (loading = new Promise((ok, bad) => { if (window.THREE) return ok(); const s = document.createElement("script"); s.src = SRC; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }));
  const GROUND = { plains: "#9da35a", farmland: "#a6a45c", forest: "#3f6b34", jungle: "#2f5a2a", hills: "#8a7a52", mountains: "#7b746c", desert: "#c9ad6a", swamp: "#556b4a", tundra: "#b9c2c4", wasteland: "#8b7d6b", river: "#5d8a6a", town: "#9a9086", city: "#8c8c8c", hive: "#6e6e74", fortress: "#77736c" };
  // a region's place on the sphere: the flat map's x round the equator, y from pole to pole (kept off the poles)
  const toSphere = (x, y) => { const lon = x / 100 * Math.PI * 2, lat = (0.5 - y / 60) * Math.PI * 0.8; return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]; };
  let state = null;
  const rot = { x: 0.25, y: 0 };   // (kept across redraws of the card)
  async function render(box, world, opts) {
    await load();
    const T = window.THREE, W = box.clientWidth || 600, H = Math.round(W * 0.6);
    if (state && state.box !== box) { state.renderer.dispose(); state = null; }
    if (!state) {
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      box.innerHTML = ""; box.appendChild(renderer.domElement);
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(35, W / H, 0.1, 100);
      camera.position.set(0, 0, 4.2);
      scene.add(new T.AmbientLight(0xffffff, 0.55));
      const sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(3, 2, 4); scene.add(sun);
      const group = new T.Group(); scene.add(group);
      state = { box, renderer, scene, camera, group, drag: null, world: lastWorld, pick: null, flares: [] };
      const el = renderer.domElement;
      el.style.cursor = "grab"; el.style.touchAction = "none";
      el.addEventListener("pointerdown", e => { state.drag = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y, moved: false }; el.setPointerCapture(e.pointerId); });
      el.addEventListener("pointermove", e => { const d = state.drag; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true; rot.y = d.ry + dx * 0.01; rot.x = Math.max(-1.2, Math.min(1.2, d.rx + dy * 0.01)); });
      el.addEventListener("pointerup", e => { const d = state.drag; state.drag = null; if (d && !d.moved) pickAt(e); });
      const tick = () => { if (!state) return; state.group.rotation.set(rot.x, rot.y, 0); const t = performance.now() / 300; for (const f of state.flares) f.material.opacity = 0.45 + 0.4 * Math.sin(t + f.userData.k); state.renderer.render(state.scene, state.camera); state.raf = requestAnimationFrame(tick); };
      tick();
    }
    state.renderer.setSize(W, H); state.camera.aspect = W / H; state.camera.updateProjectionMatrix();
    state.pick = opts.onPick;
    build(world, opts);
  }
  function build(world, opts) {
    const T = window.THREE, g = state.group;
    while (g.children.length) { const c = g.children.pop(); c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }
    state.flares = [];
    const regs = world.regions.map(r => ({ r, p: new T.Vector3(...toSphere(r.x, r.y)) }));
    // the surface: every vertex coloured by its nearest region (holder blended with ground), darker at a border
    const geo = new T.SphereGeometry(1, 192, 128), pos = geo.attributes.position, colors = [], v = new T.Vector3(), col = new T.Color(), gc = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      let best = null, second = Infinity, bd = Infinity;
      for (const x of regs) { const d = v.angleTo(x.p); if (d < bd) { second = bd; bd = d; best = x; } else if (d < second) second = d; }
      col.set(opts.colour(best.r.owner)); gc.set(GROUND[best.r.terrain] || "#888"); col.lerp(gc, 0.45);
      if (second - bd < 0.012) col.multiplyScalar(0.5);
      if (opts.selected === best.r.id) col.lerp(new T.Color("#ffffff"), 0.25);
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    const globe = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true }));
    globe.userData.regs = regs; g.add(globe); state.globe = globe;
    // city lights, the capital the brightest; the warband's ring; battles and sieges flaring
    for (const x of regs) {
      const at = x.p.clone().multiplyScalar(1.01);
      if (x.r.city) { const m = new T.Mesh(new T.SphereGeometry(x.r.capital ? 0.035 : 0.022, 12, 8), new T.MeshBasicMaterial({ color: x.r.capital ? 0xfff0b0 : 0xffd27a })); m.position.copy(at); g.add(m); }
      if (opts.here === x.r.id) { const ring = new T.Mesh(new T.TorusGeometry(0.07, 0.008, 8, 32), new T.MeshBasicMaterial({ color: 0xe0b24a })); ring.position.copy(at); ring.lookAt(at.clone().multiplyScalar(2)); g.add(ring); }
      if (x.r.battle || x.r.siege) { const f = new T.Mesh(new T.SphereGeometry(0.06, 12, 8), new T.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.6 })); f.position.copy(at); f.userData.k = Math.random() * 6; g.add(f); state.flares.push(f); }
    }
    // the links between regions, as arcs just above the ground
    const pts = [];
    for (const x of regs) for (const id of x.r.links) { if (x.r.id > id) continue; const y = regs.find(z => z.r.id === id); for (let k = 0; k < 12; k++) { const a = x.p.clone().lerp(y.p, k / 12).normalize().multiplyScalar(1.006), b = x.p.clone().lerp(y.p, (k + 1) / 12).normalize().multiplyScalar(1.006); pts.push(a, b); } }
    g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.35 })));
  }
  function pickAt(e) {
    const T = window.THREE, rect = state.renderer.domElement.getBoundingClientRect();
    const m = new T.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), ray = new T.Raycaster();
    ray.setFromCamera(m, state.camera);
    const hit = ray.intersectObject(state.globe)[0];
    if (!hit) return;
    const p = state.globe.worldToLocal(hit.point.clone()).normalize();
    const best = state.globe.userData.regs.reduce((a, x) => !a || p.angleTo(x.p) < p.angleTo(a.p) ? x : a, null);
    if (best && state.pick) state.pick(best.r.id);
  }
  // facing the picked region (or the warband's) when a world is first shown
  function face(world, id) {
    const r = world.regions.find(x => x.id === id) || world.regions.find(x => x.capital);
    if (!r || !state) return;
    rot.y = -(r.x / 100 * Math.PI * 2) - Math.PI / 2; rot.x = (0.5 - r.y / 60) * Math.PI * 0.8;
  }
  let lastWorld = null;
  window.planetGlobe = { render: async (box, world, opts) => { const first = lastWorld !== world.id; await render(box, world, opts); if (first) { face(world, opts.selected || opts.here); lastWorld = world.id; state.world = world.id; } }, stop: () => { if (state) { cancelAnimationFrame(state.raf); state.renderer.dispose(); state = null; } } };
})();
