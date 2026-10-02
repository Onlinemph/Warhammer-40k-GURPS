  // ================= the 3D view: the same replay drawn with three.js, loaded on demand from cdnjs =================
  // Presentation only: the engine stays a flat hex map, one yard per hex. Every model is a painted miniature on a
  // round base (the side's colour on the rim), built from simple shapes by faction (Marines, Guard, Orks, Necrons,
  // Tyranids, T'au, Aeldari...) and jointed so it can walk, aim, recoil, swing, dodge, flinch, kneel, go prone and
  // fall; vehicles have tracks that roll, turrets that turn and guns that recoil. Shots are drawn by weapon (las and
  // gauss beams, bolt and plasma rounds, flame, shells), with particles, light flashes, bloom and scorch marks.
  // Textures are painted on canvases at load; no image or model files, unless a local pack of game models is there
  // (31-view3d-models.js). Drag to orbit, right-drag or Shift-drag (two
  // fingers) to pan, wheel or pinch to zoom, click a figure for its sheet, Follow keeps the camera on it.
  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  let threeLoading = null;
  const loadThree = () => window.THREE ? Promise.resolve(window.THREE) : (threeLoading = threeLoading || new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = THREE_URL; s.async = true;
    s.onload = () => window.THREE ? ok(window.THREE) : no(new Error("three.js did not load"));
    s.onerror = () => { threeLoading = null; s.remove(); no(new Error("three.js could not be fetched")); };
    document.head.appendChild(s);
  }));
  // faction colours for the figures (the side shows in the base and trim)
  const FACTION3 = [[/Custodes/, 0xc9a347], [/Sororitas/, 0x2c2b30], [/Mechanicus/, 0x8e2a22], [/Khorne/, 0x8a1c1c], [/Rubric/, 0x1f6f78],
    [/Heretic|Chaos Space/, 0x2b2b2e], [/Traitor/, 0x5a4a3a], [/Cultist/, 0x6a5a48], [/Astartes/, 0x2d4f8a], [/Guard|Militarum/, 0x5b6a3e],
    [/Inquisition|Psyker/, 0x3b3b44], [/Ork/, 0x4f7a2e], [/Tyranid/, 0x6a3d7a], [/Necron/, 0x8c9298], [/Drukhari/, 0x3a2d4a],
    [/Aeldari/, 0x2c6e6a], [/T'au/, 0xb8a77c], [/Kroot|Vespid/, 0x7a6a4a]];
  const ARMOURED = /Astartes|Custodes|Heretic|Khorne|Rubric|Chaos Space/;
  // height by Size Modifier in feet (as the engine's height rules), SM 0 = 6 ft
  const HFT3 = { "-4": 1.5, "-3": 2, "-2": 3, "-1": 4.5, "0": 6, "1": 9, "2": 15, "3": 21, "4": 30, "5": 45, "6": 60 };
  function makeView3D(THREE, o) {
    const { host, fr, fx, T, ros, P, posAt } = o;
    // ground height (yards; a 3D unit is about a yard upward) under a hex, or under a world point
    const zOf = o.zOf || (() => 0);
    const zXY = (x, y) => { const q = x / 1.5, r = y / SQ3 - q / 2; let rx = Math.round(q), ry = Math.round(-q - r), rz = Math.round(r); const dx = Math.abs(rx - q), dy = Math.abs(ry + q + r), dz = Math.abs(rz - r); if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry; return zOf(rx, rz); };
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); } catch (e) { throw new Error("this browser can't draw WebGL"); }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block"; renderer.domElement.style.touchAction = "none";
    const big = ros.length > 120;   // a big battle: fewer shadows and parts, so it still runs smoothly
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
    const disposables = [];
    const keep = x => { disposables.push(x); return x; };
    const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const W3 = (x, y, h = 0) => new THREE.Vector3(x, h, y);

    // ================= procedural textures (painted with a 2D canvas, no image files)
    const canvasTex = (w, h, draw, srgb = true) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
      const tex = keep(new THREE.CanvasTexture(c)); if (srgb) tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return tex;
    };
    const speckle = (g, w, h, R, n, cols, rmin, rmax, a = 1) => { for (let i = 0; i < n; i++) { g.globalAlpha = a * (.4 + R() * .6); g.fillStyle = cols[Math.floor(R() * cols.length)]; const r = rmin + R() * (rmax - rmin); g.beginPath(); g.ellipse(R() * w, R() * h, r, r * (.6 + R() * .4), R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; };
    const TEX = {
      dirt: canvasTex(512, 512, (g, w, h) => { const R = rng(11); g.fillStyle = "#5b5040"; g.fillRect(0, 0, w, h); speckle(g, w, h, R, 900, ["#4c4234", "#685a47", "#55493a", "#3f372c", "#71634e"], 6, 28, .35); speckle(g, w, h, R, 1600, ["#7d6e58", "#2f2a22", "#8b7c63"], 1, 3.5, .8); g.strokeStyle = "rgba(30,25,20,.35)"; for (let i = 0; i < 18; i++) { g.lineWidth = 1 + R() * 1.5; g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - .5) * 40; y += (R() - .5) * 40; g.lineTo(x, y); } g.stroke(); } }),
      sand: canvasTex(256, 256, (g, w, h) => { const R = rng(5); g.fillStyle = "#a8936c"; g.fillRect(0, 0, w, h); speckle(g, w, h, R, 1400, ["#c4ae84", "#8c7854", "#d8c49a", "#6f5f44"], .8, 2.4, .9); for (let i = 0; i < 9; i++) { const x = R() * w, y = R() * h; g.strokeStyle = R() < .5 ? "#7d8a3a" : "#a6a24a"; g.lineWidth = 1.4; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 14, y + (R() - .5) * 14); g.stroke(); } } }),
      stone: canvasTex(512, 512, (g, w, h) => { const R = rng(7); g.fillStyle = "#5f594f"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 42) { let x = -R() * 60; while (x < w) { const bw = 60 + R() * 70, t = Math.floor(120 + R() * 40); g.fillStyle = `rgb(${t + 10},${t + 4},${t - 8})`; g.fillRect(x + 3, y + 3, bw - 6, 36); speckle(g, w, h, R, 0, [], 0, 0); g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(x + 3, y + 30, bw - 6, 9); x += bw; } } speckle(g, w, h, R, 2200, ["#3e3a33", "#a59d8e", "#2f2b26"], .8, 2.5, .55); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(20,16,10,.35)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
      plate: canvasTex(256, 256, (g, w, h) => { const R = rng(3); g.fillStyle = "#575c63"; g.fillRect(0, 0, w, h); for (const [x, y] of [[0, 0], [128, 0], [0, 128], [128, 128]]) { const t = 82 + Math.floor(R() * 16); g.fillStyle = `rgb(${t},${t + 4},${t + 10})`; g.fillRect(x + 3, y + 3, 122, 122); g.fillStyle = "#2c2f34"; for (const [a, b] of [[10, 10], [118, 10], [10, 118], [118, 118]]) { g.beginPath(); g.arc(x + a, y + b, 3, 0, 7); g.fill(); } } speckle(g, w, h, R, 500, ["#3a3d42", "#7d838b", "#6b5a44"], 1, 6, .35); g.strokeStyle = "rgba(255,255,255,.08)"; for (let i = 0; i < 20; i++) { g.beginPath(); const x = R() * w, y = R() * h; g.moveTo(x, y); g.lineTo(x + (R() - .5) * 60, y + (R() - .5) * 8); g.stroke(); } }),
      grate: canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#1f2226"; g.fillRect(0, 0, w, h); g.fillStyle = "#4b5057"; for (let i = 0; i < w; i += 16) { g.fillRect(i, 0, 5, h); g.fillRect(0, i, w, 5); } }),
      panel: canvasTex(256, 256, (g, w, h) => { const R = rng(9); g.fillStyle = "#30353c"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 64) { const t = 44 + Math.floor(R() * 12); g.fillStyle = `rgb(${t},${t + 4},${t + 10})`; g.fillRect(x + 2, 4, 60, h * .78); } g.fillStyle = "#14161a"; g.fillRect(0, h * .82, w, h * .18); for (let x = -64; x < w + 64; x += 32) { g.fillStyle = "#d4a52a"; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h * .82); g.lineTo(x + 32, h * .82); g.lineTo(x + 16, h); g.closePath(); g.fill(); } speckle(g, w, h, R, 300, ["#1b1d21", "#5a4632"], 1, 5, .35); }),
      wood: canvasTex(128, 128, (g, w, h) => { const R = rng(4); g.fillStyle = "#7a5a35"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 21) { g.fillStyle = `rgba(0,0,0,${.08 + R() * .1})`; g.fillRect(0, y, w, 2); } g.strokeStyle = "#4e3a22"; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, h - 8); g.stroke(); speckle(g, w, h, R, 200, ["#5a4024", "#93714a"], 1, 3, .5); }),
      metal: canvasTex(128, 128, (g, w, h) => { const R = rng(6); g.fillStyle = "#7d7e78"; g.fillRect(0, 0, w, h); g.fillStyle = "#5d5e59"; for (let x = 8; x < w; x += 24) g.fillRect(x, 0, 6, h); speckle(g, w, h, R, 120, ["#8a5a32", "#6b4426", "#9a9a92"], 2, 9, .45); }),
      track: canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#1b1b1d"; g.fillRect(0, 0, w, h); g.fillStyle = "#3b3b3f"; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 8, h); g.fillStyle = "#57575c"; for (let x = 2; x < w; x += 16) g.fillRect(x, h * .4, 4, h * .2); }),
      glow: canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, "rgba(255,255,255,.8)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, false),
      smoke: canvasTex(64, 64, (g, w, h) => { const R = rng(8); for (let i = 0; i < 14; i++) { const x = 18 + R() * 28, y = 18 + R() * 28, r = 8 + R() * 14, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); } }, false),
      scorch: canvasTex(128, 128, (g, w, h) => { const R = rng(2); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, "rgba(10,8,6,.9)"); gr.addColorStop(.55, "rgba(20,16,12,.6)"); gr.addColorStop(1, "rgba(20,16,12,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, R, 80, ["#0b0a08"], 1, 4, .6); }),
      pool: canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(.7, "rgba(255,255,255,.8)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.ellipse(32, 32, 30, 22, .4, 0, 7); g.fill(); }, false),
    };
    TEX.track.encoding = THREE.sRGBEncoding;

    // ================= materials: painted plastic, metallic paints a little shiny
    const MC = new Map();
    // paint colours are sRGB; the renderer works in linear light and encodes once at the end
    const lin = c => new THREE.Color(c).convertSRGBToLinear();
    const M = (c, o2 = {}) => { const k = c + "|" + Object.entries(o2).map(([a, b]) => a + ":" + (b && b.isTexture ? b.uuid : b)).join(","); let m = MC.get(k); if (!m) { m = keep(new THREE.MeshStandardMaterial({ color: lin(c), roughness: o2.r ?? .62, metalness: o2.m ?? .05, emissive: lin(o2.e ?? 0x000000), emissiveIntensity: o2.ei ?? 1, map: o2.map || null, transparent: !!o2.tr, opacity: o2.op ?? 1, side: o2.ds ? THREE.DoubleSide : THREE.FrontSide })); MC.set(k, m); } return m; };
    const METAL = c => M(c, { r: .38, m: .65 });
    const GLOW = c => M(c, { e: c, ei: 2.2, r: .4 });

    // ================= bounds, sky, light
    const pts = [];
    fr.forEach(f => f.forEach(x => { if (x) pts.push(P(x[0], x[1])); }));
    if (T) for (const k of T.floor) { const [q, r] = k.split(",").map(Number); pts.push(P(q, r)); }
    const bx0 = Math.min(...pts.map(p => p[0])) - 6, bx1 = Math.max(...pts.map(p => p[0])) + 6, by0 = Math.min(...pts.map(p => p[1])) - 6, by1 = Math.max(...pts.map(p => p[1])) + 6;
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, span = Math.max(bx1 - bx0, by1 - by0);
    const indoor = T && T.kind !== "ruins";
    const horizon = indoor ? 0x15171b : 0x8a7d6c;
    scene.fog = new THREE.Fog(lin(horizon), Math.max(60, span * .9), Math.max(200, span * 2.6));
    if (indoor) scene.background = lin(0x101216);
    else {
      // a war-torn sky: dust-brown at the horizon, smoky blue-grey above
      const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(600, 32, 16)), keep(new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: lin(0x2e3846) }, hor: { value: lin(horizon) }, bot: { value: lin(0x3a3228) } },
        vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h > 0.0 ? mix(hor, top, pow(min(1.0, h * 1.6), 0.7)) : mix(hor, bot, min(1.0, -h * 4.0)); gl_FragColor = vec4(c, 1.0); }" })));
      sky.position.set(cx, 0, cy); scene.add(sky);
    }
    scene.add(new THREE.HemisphereLight(lin(indoor ? 0xaab4c4 : 0xc8d4e6), lin(0x4a3f30), indoor ? 1.1 : 1.0));
    const sun = new THREE.DirectionalLight(lin(indoor ? 0xf2f0ea : 0xffdcb0), indoor ? 2.2 : 3.0);
    sun.position.set(cx - span * .45, span * .9, cy - span * .35); sun.target.position.set(cx, 0, cy);
    sun.castShadow = true; sun.shadow.mapSize.set(big ? 2048 : 4096, big ? 2048 : 4096); sun.shadow.bias = -0.0008; sun.shadow.normalBias = .06;
    Object.assign(sun.shadow.camera, { left: -span * .75, right: span * .75, top: span * .75, bottom: -span * .75, near: 1, far: span * 3 });
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(lin(0x8fa8d0), .6); fill.position.set(cx + span, span * .4, cy + span * .6); scene.add(fill);

    // ================= the battlefield
    const hexGeo = (h, k = 1) => {
      const sh = new THREE.Shape();
      for (let i = 0; i < 6; i++) { const x = Math.cos(i * Math.PI / 3) * k, y = Math.sin(i * Math.PI / 3) * k; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return keep(g);
    };
    const m4 = new THREE.Matrix4(), col = new THREE.Color(), q0 = new THREE.Quaternion(), yAx = new THREE.Vector3(0, 1, 0);
    const inst = (geo, material, list, place, shadow = true) => {
      const im = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
      im.count = list.length; list.forEach((it, i) => place(im, it, i)); im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.receiveShadow = true; im.castShadow = shadow && !big; scene.add(im); return im;
    };
    const keyHex = k => k.split(",").map(Number);
    const dark = new Map(T && T.light ? T.light : []);
    const shade = v => v == null ? 1 : v <= -7 ? .42 : v <= -3 ? .62 : .82;
    const chunkGeo = keep(new THREE.DodecahedronGeometry(.22, 0));
    let walls = null, wallList = [], wallH = [], doorMesh = null, doorList = [], rubble = [];
    const gridLines = [];
    const floorSet = T ? new Set(T.floor) : null;
    const R0 = rng(31);
    if (T) {
      const floor = [...T.floor], ruins = T.kind === "ruins";
      const fTex = ruins ? TEX.dirt : TEX.plate;
      inst(hexGeo(.15, .995), M(0xffffff, { map: fTex, r: ruins ? .95 : .7, m: ruins ? 0 : .25 }), floor, (im, k, i) => {
        const [q, r] = keyHex(k), [x, y] = P(q, r);
        m4.makeTranslation(x, zOf(q, r) - .15, y); im.setMatrixAt(i, m4);
        const h = hash(q, r);
        im.setColorAt(i, col.setScalar((.85 + .15 * h) * shade(dark.get(k))));
      }, false);
      // raised decks and upper floors: solid under each high hex
      const up = floor.filter(k => zOf(...keyHex(k)) > 0);
      if (up.length) inst(hexGeo(1, .995), ruins ? M(0x8d867a, { map: TEX.stone, r: .9 }) : M(0x6c7178, { r: .6, m: .4 }), up, (im, k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.compose(W3(x, y, -.15), q0, new THREE.Vector3(1, zOf(q, r), 1)); im.setMatrixAt(i, m4); });
      const ws = new Set();
      for (const k of floor) { const [q, r] = keyHex(k); for (const [dq, dr] of DIRN) { const k2 = (q + dq) + "," + (r + dr); if (!floorSet.has(k2)) ws.add(k2); } }
      wallList = [...ws];
      const wTop = new Map(T.wallTop || []), wFull = 2.4 + Math.max(0, ...floor.map(k => zOf(...keyHex(k))));
      wallH = wallList.map(k => wTop.get(k) || wFull);
      walls = inst(hexGeo(1), ruins ? M(0xb0a898, { map: TEX.stone, r: .92 }) : M(0x9aa2ad, { map: TEX.panel, r: .55, m: .35 }), wallList, (im, k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.compose(W3(x, y, 0), q0, new THREE.Vector3(1, wallH[i], 1)); im.setMatrixAt(i, m4); });
      if (ruins) {
        // broken tops: rubble chunks along the jagged edge, rebar sticking out, and spill at the foot of the walls
        const tops = [], spill = [], bars = [];
        wallList.forEach((k, i) => {
          const [q, r] = keyHex(k), [x, y] = P(q, r), h = wallH[i];
          if (h < wFull - .05) { for (let j = 0; j < 3; j++) tops.push([x + (R0() - .5) * 1.3, h + R0() * .2, y + (R0() - .5) * 1.3, .9 + R0() * 1.3]); if (R0() < .5) bars.push([x + (R0() - .5) * .8, h, y + (R0() - .5) * .8]); }
          for (const [dq, dr] of DIRN) { const k2 = (q + dq) + "," + (r + dr); if (floorSet.has(k2) && R0() < .35) { const [x2, y2] = P(q + dq, r + dr); for (let j = 0; j < 3; j++) spill.push([x2 + (x - x2) * .45 + (R0() - .5) * .7, zOf(q + dq, r + dr) + .05, y2 + (y - y2) * .45 + (R0() - .5) * .7, .6 + R0() * 1.1]); } }
        });
        const rotQ = new THREE.Quaternion(), e3 = new THREE.Euler();
        inst(chunkGeo, M(0x8d867a, { map: TEX.stone, r: .95 }), [...tops, ...spill], (im, [x, h, y, s], i) => { e3.set(R0() * 3, R0() * 3, R0() * 3); rotQ.setFromEuler(e3); m4.compose(new THREE.Vector3(x, h, y), rotQ, new THREE.Vector3(s, s * .7, s)); im.setMatrixAt(i, m4); im.setColorAt(i, col.setScalar(.75 + R0() * .35)); });
        const barGeo = keep(new THREE.CylinderGeometry(.025, .025, 1, 5));
        inst(barGeo, M(0x5a3a22, { r: .7, m: .5 }), bars.flatMap(b => [0, 1, 2].map(j => [b[0] + j * .12, b[1], b[2] + j * .05])), (im, [x, h, y], i) => { e3.set((R0() - .5) * .8, 0, (R0() - .5) * .8); rotQ.setFromEuler(e3); m4.compose(new THREE.Vector3(x, h + .3, y), rotQ, new THREE.Vector3(1, .5 + R0() * .6, 1)); im.setMatrixAt(i, m4); });
      } else {
        // facility: grated walkways on the decks, light strips along the wall tops
        if (up.length) inst(hexGeo(.02, .8), M(0xffffff, { map: TEX.grate, r: .6, m: .5 }), up, (im, k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.makeTranslation(x, zOf(q, r) + .005, y); im.setMatrixAt(i, m4); }, false);
        const strips = wallList.filter((k, i) => hash(...keyHex(k)) < .18);
        inst(keep(new THREE.BoxGeometry(.6, .06, .6)), GLOW(0xcfe6ff), strips, (im, k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.makeTranslation(x, wFull + .03, y); im.setMatrixAt(i, m4); }, false);
      }
      const crates = [...(T.crates || [])];
      const cGeo = keep(new THREE.BoxGeometry(1.15, 1, 1.15));
      for (const [kind, mt] of [["light", M(0xffffff, { map: TEX.wood, r: .8 })], ["heavy", M(0xffffff, { map: TEX.metal, r: .55, m: .45 })]]) {
        const list = crates.filter(([, v]) => v === kind);
        inst(cGeo, mt, list, (im2, [k], i) => { const [q, r] = keyHex(k), [x, y] = P(q, r), h = kind === "heavy" ? 1.1 : .85; m4.compose(W3(x, y, zOf(q, r) + h / 2), new THREE.Quaternion().setFromAxisAngle(yAx, hash(q, r) * .6), new THREE.Vector3(1, h, 1)); im2.setMatrixAt(i, m4); });
      }
      doorList = [...(T.doors || [])];
      doorMesh = inst(hexGeo(2.3, .9), M(0xffffff, { m: .45, r: .45 }), doorList, (im, k, i) => { const [q, r] = keyHex(k), [x, y] = P(q, r); m4.makeTranslation(x, 0, y); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(0x9aa1a8)); });
      const rMat = M(0x4a4e55, { r: .9 });
      for (const [tt, k, what] of T.events || []) if (what === "broken") {
        const [q, r] = keyHex(k), [x, y] = P(q, r), g = new THREE.Group();
        for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(chunkGeo, rMat); m.position.set(x + (hash(q + i, r) - .5) * 1.3, .1, y + (hash(q, r + i) - .5) * 1.3); m.scale.setScalar(.6 + hash(i, q) * 1.2); m.rotation.set(i, i * 2, 0); m.castShadow = true; g.add(m); }
        g.visible = false; scene.add(g); rubble.push({ t: tt, k, g });
      }
    } else {
      // open ground: churned earth, craters, rocks and debris
      const gt = TEX.dirt; gt.repeat.set(span / 9, span / 9);
      const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(span * 6, span * 6)), M(0xffffff, { map: gt, r: 1 }));
      gt.repeat.set(span * 6 / 12, span * 6 / 12);
      ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -.02, cy); ground.receiveShadow = true; scene.add(ground);
      const tiles = [];
      for (let q = Math.floor(bx0 / 1.5) - 1; q <= Math.ceil(bx1 / 1.5) + 1; q++) for (let r = Math.floor(by0 / SQ3 - q / 2) - 1; r <= Math.ceil(by1 / SQ3 - q / 2) + 1; r++) tiles.push([q, r]);
      const hill = tiles.filter(([q, r]) => zOf(q, r) > 0);
      if (hill.length) inst(hexGeo(1, .995), M(0xffffff, { map: TEX.dirt, r: 1 }), hill, (im, [q, r], i) => { const [x, y] = P(q, r); m4.compose(W3(x, y, -.02), q0, new THREE.Vector3(1, zOf(q, r), 1)); im.setMatrixAt(i, m4); im.setColorAt(i, col.setScalar(.8 + .3 * hash(q, r))); });
      const R1 = rng(17), rocks = [];
      for (let i = 0; i < Math.min(400, span * 3); i++) rocks.push([cx + (R1() - .5) * span * 1.6, cy + (R1() - .5) * span * 1.6, .25 + R1() * R1() * 1.4]);
      const e3 = new THREE.Euler(), rq = new THREE.Quaternion();
      inst(chunkGeo, M(0x6f675a, { r: .95 }), rocks, (im, [x, y, s], i) => { e3.set(R1() * 3, R1() * 3, R1() * 3); rq.setFromEuler(e3); m4.compose(new THREE.Vector3(x, zXY(x, y) + s * .05, y), rq, new THREE.Vector3(s, s * .55, s)); im.setMatrixAt(i, m4); im.setColorAt(i, col.setScalar(.7 + R1() * .4)); });
      const cr = [];
      for (let i = 0; i < Math.max(6, span / 6); i++) cr.push([cx + (R1() - .5) * span * 1.4, cy + (R1() - .5) * span * 1.4, 1.5 + R1() * 3]);
      const cMat = keep(new THREE.MeshStandardMaterial({ map: TEX.scorch, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
      for (const [x, y, s] of cr) { const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(s * 2, s * 2)), cMat); m.rotation.x = -Math.PI / 2; m.position.set(x, zXY(x, y) + .02, y); m.receiveShadow = true; scene.add(m); }
    }
    // hex grid lines on the floor
    {
      const pos = [];
      for (let q = Math.floor(bx0 / 1.5) - 1; q <= Math.ceil(bx1 / 1.5) + 1; q++) for (let r = Math.floor(by0 / SQ3 - q / 2) - 1; r <= Math.ceil(by1 / SQ3 - q / 2) + 1; r++) {
        if (floorSet && !floorSet.has(q + "," + r)) continue;
        const [x, y] = P(q, r), z = zOf(q, r) + .015;
        for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3, b = (i + 1) * Math.PI / 3; pos.push(x + Math.cos(a), z, y + Math.sin(a), x + Math.cos(b), z, y + Math.sin(b)); }
      }
      const g = keep(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const ls = new THREE.LineSegments(g, keep(new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: .22 })));
      scene.add(ls); gridLines.push(ls);
    }

