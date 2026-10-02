// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= models from the user's own games (optional)
    // tools/dow/build_pack.py converts models out of a Dawn of War install into site/models/. That folder is never
    // committed: the models are Relic's and Games Workshop's. When it is there, each figure it covers is swapped for
    // the game's model, repainted in the faction's colours and driven by the game's own animations; without it (or
    // for a figure it doesn't cover) the built miniature above stays. Everything loads through <script> tags and
    // data URLs, so the page still works opened straight from disk.
    const PACK = "models/", GLTF_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
    let gone = false; keep({ dispose() { gone = true; } });
    const loadScript = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = () => ok(); s.onerror = () => { s.remove(); no(new Error("could not load " + src)); }; document.head.appendChild(s); });
    let gltfLoading = null;   // the loader comes down once, whoever asks first (the models or the scenery)
    const gltfReady = () => THREE.GLTFLoader ? Promise.resolve() : gltfLoading || (gltfLoading = loadScript(GLTF_URL));
    const loadImage = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("a model texture did not decode")); im.src = src; });
    const pixelsOf = (im, w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(im, 0, 0, w, h); return [c, g, g.getImageData(0, 0, w, h)]; };
    const rgb01 = c => { if (typeof c === "string") c = parseInt(c.replace("#", ""), 16); return [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]; };

    // The game's team colouring: each mask (primary, secondary, trim, weapons, eyes) is overlaid with its colour and
    // the results added; the "dirt" mask says how much of the painted default texture shows through on top.
    async function paintTexture(t, paint) {
      const base = await loadImage(t.base), w = base.naturalWidth, h = base.naturalHeight, [cv, g, B] = pixelsOf(base, w, h);
      if (t.m1) {
        const [i1, i2] = await Promise.all([loadImage(t.m1), loadImage(t.m2)]), M1 = pixelsOf(i1, w, h)[2].data, M2 = pixelsOf(i2, w, h)[2].data, d = B.data;
        // some units use the "eyes" layer for a second pattern (Guard camouflage): a lens colour belongs only on a small one
        let eyeArea = 0; for (let i = 1; i < M2.length; i += 4) if (M2[i] > 30) eyeArea++;
        const cs = [paint.primary, paint.secondary, paint.trim, paint.weapons, eyeArea > M2.length / 4 * .012 ? paint.secondary : paint.eyes].map(rgb01), ms = [0, 0, 0, 0, 0];
        for (let i = 0; i < d.length; i += 4) {
          ms[0] = M1[i] / 255; ms[1] = M1[i + 1] / 255; ms[2] = M1[i + 2] / 255; ms[3] = M2[i] / 255; ms[4] = M2[i + 1] / 255;
          const dirt = M2[i + 2] / 255;
          for (let ch = 0; ch < 3; ch++) {
            let v = d[i + ch] / 255 * dirt;
            for (let L = 0; L < 5; L++) { const m = ms[L]; if (m > .04) { const c = cs[L][ch]; v += m < .5 ? 2 * m * c : 1 - 2 * (1 - m) * (1 - c); } }
            d[i + ch] = v >= 1 ? 255 : v * 255;
          }
        }
        g.putImageData(B, 0, 0);
      }
      const tex = keep(new THREE.CanvasTexture(cv)); tex.encoding = THREE.sRGBEncoding; tex.flipY = false;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return tex;
    }
    const paintOf = (u, S) => ({ primary: S[0], secondary: S[1], trim: S[1], weapons: 0x3a3b40, eyes: S[4] || 0xff3a2a, ...(u.paint || {}) });
    const modelMats = new Map();
    function modelMaterial(u, asset, name, paint) {
      const t = asset.tex[name];
      if (!t) { if (!modelMats.has("plain")) modelMats.set("plain", Promise.resolve(keep(new THREE.MeshStandardMaterial({ color: lin(0x77736a), roughness: .6, metalness: .2, skinning: true })))); return modelMats.get("plain"); }   // a mesh whose textures the pack lacks
      const key = u.id + "|" + name + "|" + (t.m1 ? Object.values(paint).join(",") : "");
      if (!modelMats.has(key)) modelMats.set(key, (async () => {
        const map = await paintTexture(t, paint);
        const mat = keep(new THREE.MeshStandardMaterial({ map, color: u.tint ? lin(parseInt(u.tint.slice(1), 16)) : 0xffffff, roughness: .5, metalness: .25, skinning: true, alphaTest: t.cutout ? .5 : 0, side: t.cutout ? THREE.DoubleSide : THREE.FrontSide }));
        if (t.glow) { const gl = keep(new THREE.Texture(await loadImage(t.glow))); gl.encoding = THREE.sRGBEncoding; gl.flipY = false; gl.needsUpdate = true; mat.emissiveMap = gl; mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = 1.6; }
        return mat;
      })());
      return modelMats.get(key);
    }
    async function loadAsset(id) {
      if (!(window.DOW_MODELS || {})[id]) await loadScript(PACK + id + ".js");
      const d = window.DOW_MODELS[id], bin = atob(d.glb), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const gltf = await new Promise((ok, no) => new THREE.GLTFLoader().parse(buf.buffer, "", ok, no));
      gltf.scene.traverse(o => { if (o.isMesh) { keep(o.geometry); if (o.material && o.material.dispose) keep(o.material); } });
      return { scene: gltf.scene, clips: gltf.animations, tex: d.tex, meta: d.meta };
    }
    // Some models carry no animations of their own: the game plays another unit's on the same skeleton (a Chaos
    // Marine moves as a Space Marine). Borrow those clips, dropping the tracks for bones this model doesn't have.
    function borrowClips(asset, from) {
      const have = new Map(); asset.scene.traverse(o => have.set(o.name.toLowerCase(), o.name));   // bone names differ in case between the game's older and newer models
      const own = new Set(asset.clips.map(c => c.name));
      asset.meta.alias = { ...(from.meta.alias || {}), ...(asset.meta.alias || {}) };
      for (const c of from.clips) if (!own.has(c.name)) asset.clips.push(new THREE.AnimationClip(c.name, c.duration, c.tracks.map(t => { const [node, prop] = t.name.split("."), mine = have.get(node.toLowerCase()); if (!mine) return null; const t2 = t.clone(); t2.name = mine + "." + prop; return t2; }).filter(Boolean)));
    }
    // a copy of a rigged model with its own skeleton (Object3D.clone alone leaves the copy bound to the first one's bones)
    function cloneRig(src) {
      const dst = src.clone(true), a = [], b = [];
      src.traverse(o => a.push(o)); dst.traverse(o => b.push(o));
      const twin = new Map(a.map((o, i) => [o, b[i]]));
      a.forEach((o, i) => { if (!o.isSkinnedMesh) return; const c = b[i]; c.skeleton = new THREE.Skeleton(o.skeleton.bones.map(bn => twin.get(bn)), o.skeleton.boneInverses); c.bind(c.skeleton, o.bindMatrix); });
      return dst;
    }
    async function attachModel(F, r, u, asset) {
      const S = scheme(r), paint = paintOf(u, S), root = cloneRig(asset.scene), k = F.k;
      // which meshes show: the look for this ranged and melee weapon, else for either, else the default. A weapon the
      // unit lists by name (its "kits": a heavy bolter is a bolt weapon, but a different thing to carry) comes first.
      const L = asset.meta.looks, rk = r.rk === "lob" ? "shell" : r.rk || "", named = Object.entries(u.kits || {}).find(([rx]) => new RegExp(rx, "i").test((r.kit || "").split("|")[0]));
      const key = [named && named[1], rk].flatMap(gun => gun ? [gun + "+" + (r.mk || ""), gun] : []).concat(rk ? [] : [r.mk]).find(k => k && L[k]) || "default", look = L[key] || asset.meta.meshes, show = new Set(look);
      const set = (asset.meta.alias || {})[key] || key;   // looks that move alike share one set of clips
      // which of the game's meshes a drawn mesh belongs to: the exporter prefixes mesh names (so none collides with a bone's),
      // and one with several materials arrives as a group of pieces
      const partOf = o => { for (let q = o; q && q !== root.parent; q = q.parent) { const n = (q.userData.name || q.name).replace(/^M_/, ""); if (asset.meta.bounds[n]) return n; } return o.name; };
      const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
      for (const o of meshes) {
        o.visible = show.has(partOf(o));
        o.userData.mat = (o.material && o.material.name) || "";
        o.material = await modelMaterial(u, asset, o.userData.mat, paint);
        o.castShadow = !big; o.receiveShadow = false; o.frustumCulled = false; o.userData.i = F.i;
      }
      if (gone) return;
      // the game's models stand on z = 0 facing -y; the exporter turns that to y-up facing +z, and the figures here face +x
      const tall = u.tall || (asset.meta.head && u.size !== "bounds" ? asset.meta.head * 1.14 : Math.max(...(L.default || look).map(n => (asset.meta.bounds[n] || [0, 0])[1])));   // the head bone sits at the base of the skull
      const h = u.h || 1.75; root.scale.setScalar(h / tall); root.rotation.y = Math.PI / 2 + (u.yaw || 0);
      for (const c of F.fig.children) c.visible = false;
      F.fig.add(root);
      for (let j = pick.length - 1; j >= 0; j--) if (pick[j].userData.i === F.i) pick.splice(j, 1);
      for (const o of meshes) if (o.visible) pick.push(o);
      const mixer = new THREE.AnimationMixer(root), acts = {}, w = {};
      // a look can have clips of its own ("idle@flame": a flamer is held and fired differently); those win over the plain ones
      for (const clip of asset.clips) { const [name, only] = clip.name.split("@"); if (only ? only !== set : asset.clips.some(c => c.name === name + "@" + set)) continue; const a = mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); acts[name] = a; w[name] = 0; }
      F.model = { root, mixer, acts, w, u };
      F.top = h * k * 1.06; F.bars.position.y = F.top + .25;
      if (F.veh) {
        // the built vehicle's moving parts are gone; the turret is the model's own bone, turned about the hull's up axis
        Object.assign(F, { tracks: [], wheels: [], barrels: [], legs: [], walker: 0, exhaust: null, turret: null });
        if (L.wreck && key !== "wreck") { const on = meshes.filter(o => /^wreck(\.|$)/.test(partOf(o))); if (on.length) F.model.wreck = { on, off: meshes.filter(o => o.visible && !on.includes(o)) }; }
        // tracks: the game runs a strip of texture round each one. Slide it as the tank covers ground: the links on
        // the top run move forward and those underneath move back, so measure how fast the strip's v climbs toward
        // the front (+z) along each run. Each tank gets its own copy of the material, since tanks of a kind share theirs.
        root.updateMatrixWorld(true);
        const size = root.getWorldScale(new THREE.Vector3()).x, median = a => a.sort((x, y) => x - y)[a.length >> 1];
        for (const o of meshes) {
          const P = o.geometry.attributes.position, U = o.geometry.attributes.uv, I = o.geometry.index;
          if (!o.visible || !/track|tread/i.test(o.userData.mat) || !o.material.map || !P || !U || !I) continue;
          o.geometry.computeBoundingBox();
          const y0 = o.geometry.boundingBox.min.y, band = (o.geometry.boundingBox.max.y - y0) * .3, over = [[], []], under = [[], []];   // per texture axis: the strip may run along u or v
          for (let t = 0; t < I.count; t += 3) for (let e = 0; e < 3; e++) {
            const i = I.getX(t + e), j = I.getX(t + (e + 1) % 3), dz = P.getZ(j) - P.getZ(i), dy = P.getY(j) - P.getY(i), run = Math.hypot(dy, dz);
            if (run < .05 || Math.abs(dz) < .7 * run || Math.abs(P.getX(j) - P.getX(i)) > .3 * run) continue;   // only edges along the run
            const y = (P.getY(i) + P.getY(j)) / 2 - y0, to = y > 2.33 * band ? over : y < band ? under : null;
            if (to) { to[0].push((U.getX(j) - U.getX(i)) / dz); to[1].push((U.getY(j) - U.getY(i)) / dz); }
          }
          if (!over[0].length && !under[0].length) continue;
          const rates = [0, 1].map(a => over[a].length && under[a].length ? (median(over[a]) - median(under[a])) / 2 : over[a].length ? median(over[a]) : -median(under[a]));
          const axis = Math.abs(rates[0]) > Math.abs(rates[1]) ? "x" : "y", rate = rates[axis === "x" ? 0 : 1];
          const mat = keep(o.material.clone()), map = keep(o.material.map.clone()); map.needsUpdate = true; mat.map = map; o.material = mat;
          (F.model.tracks ||= []).push({ map, axis, rate: rate / size });
        }
        const bone = u.turret && root.getObjectByName(u.turret);
        if (bone) {
          const rest = bone.quaternion.clone(), up = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), rot = { v: 0 };
          Object.defineProperty(rot, "y", { get: () => rot.v, set(a) {
            rot.v = a; F.fig.updateMatrixWorld(true);
            bone.parent.getWorldQuaternion(qa); F.fig.getWorldQuaternion(qb); qa.invert().multiply(qb);   // the figure's frame seen from the bone's parent
            up.set(0, 1, 0).applyQuaternion(qa).normalize(); bone.quaternion.setFromAxisAngle(up, a).multiply(rest);
          } });
          F.turret = { rotation: rot };
        }
      }
    }

    // ---- posing a model: the replay can jump anywhere, so every clip's weight and time is set from the state each frame
    function poseModel(F, bitsv, p, ev, dt, dead) {
      const m = F.model, A = m.acts, W = m.w, fig = F.fig, k = F.k;
      fig.position.set(0, 0, 0); fig.rotation.set(0, 0, 0);
      const prone = bitsv & 2, kneel = bitsv & 4, stun = bitsv & 1, reload = bitsv & 1024;
      const want = {}, time = {};
      const dur = n => A[n].getClip().duration, clampT = (n, t) => Math.max(0, Math.min(dur(n) - 1e-3, t));
      let over = 0;
      if (dead && A.die) { want.die = 1; time.die = clampT("die", ease(dead.f) * dur("die")); over = 1; }
      else {
        // a blow, a throw or a flinch plays through once around its moment
        if (A.melee) for (const s of ev.swing || []) { const d = (p - s.p) * TS + .25, L = Math.min(dur("melee"), 1.1); if (d >= 0 && d <= .8) { want.melee = Math.min(1, d / .1, (.8 - d) / .15); time.melee = clampT("melee", d / .8 * L); } }
        if (A.throw) for (const f of ev.fire || []) if (f.kind === "grenade") { const d = (p - f.p) * TS + .3, L = dur("throw"); if (d >= 0 && d <= .7) { want.throw = Math.min(1, d / .1, (.7 - d) / .15); time.throw = clampT("throw", d / .7 * L); } }
        over = Math.max(want.melee || 0, want.throw || 0);
        if (A.hit && !over) for (const hh of ev.hit || []) { const d = (p - hh.p) * TS; if (d >= 0 && d <= .5) { want.hit = Math.sin(Math.PI * d / .5) * .7; time.hit = clampT("hit", d / .5 * dur("hit")); } }
        const rest = 1 - Math.max(over, want.hit || 0);
        // shooting: the aiming pose held, the firing clip run from each shot
        let fireW = 0;
        if (A.fire && !reload) { fireW = F.aim * rest * (1 - .45 * F.walk); time.fire = 0; for (const f of ev.fire || []) { const d = (p - f.p) * TS; if (d >= 0 && d < dur("fire")) time.fire = clampT("fire", d); } want.fire = fireW; }
        const legs = rest - fireW;
        const crouch = A.kneel && kneel && !prone ? 1 - F.walk : 0;
        if (A.run) { want.run = legs * F.walk; time.run = ((F.phase / (2 * Math.PI)) % 1 + 1) % 1 * dur("run"); }
        if (A.kneel) { want.kneel = legs * (1 - (A.run ? F.walk : 0)) * crouch; time.kneel = (clock + F.i * .37) % dur("kneel"); }
        if (A.idle) { want.idle = Math.max(0, legs - (want.run || 0) - (want.kneel || 0)); time.idle = (clock * (stun ? .3 : 1) + F.i * .37) % dur("idle"); }
      }
      const snap = o.reduce || dt <= 0 || over === 1 && dead;
      for (const n in A) {
        const target = want[n] || 0; W[n] = snap ? target : W[n] + (target - W[n]) * Math.min(1, dt * 14);
        if (W[n] < .004 && !target) W[n] = 0;
        A[n].setEffectiveWeight(W[n]); if (time[n] != null) A[n].time = time[n];
      }
      m.mixer.update(0);
      // posture and reactions the clips don't cover, on the whole figure
      let dodge = 0; for (const d of ev.dodge || []) dodge = Math.max(dodge, bump((p - d.p) * TS + .05, .3));
      fig.position.z = dodge * (F.i % 2 ? -.3 : .3) * k; fig.rotation.x = dodge * (F.i % 2 ? .35 : -.35);
      if (prone && !dead) { fig.rotation.z = -Math.PI / 2 + .04; fig.position.y = .16 * k; fig.position.x = -.85 * k; }
      if (stun && !prone && !dead) { fig.rotation.x += Math.sin(clock * 5 + F.i) * .1; fig.rotation.z = .1; }
      if (dead && !A.die) { const f = ease(dead.f); fig.rotation.z = f * (Math.PI / 2 - .05); fig.position.y = .12 * k * f; fig.position.x = .55 * k * f; }
    }

    // a vehicle model: its idle and moving clips if it has any (a walker's stride follows the ground covered)
    // A destroyed vehicle becomes its wreck if the game has one (a look called "wreck"), else plays its death clip.
    function poseVehicleModel(F, dead) {
      const m = F.model, A = m.acts; let any = false;
      const gone = !!dead && dead.f >= .45;
      if (m.wreck && gone !== m.wrecked) {
        m.wrecked = gone;
        for (const o of m.wreck.on) o.visible = gone;
        for (const o of m.wreck.off) o.visible = !gone;
        if (gone && lastSt.playing && dead.f < 1) blastFx(F.g.position.clone().add(new THREE.Vector3(0, F.top * .4, 0)), 3);
      }
      if (dead && A.die && !m.wreck) {
        for (const n in A) A[n].setEffectiveWeight(n === "die" ? 1 : 0);
        A.die.time = ease(dead.f) * A.die.getClip().duration * .999; m.mixer.update(0); return;
      }
      for (const n in A) {
        // "run", "run2"...: what turns as it drives (a walker's stride, each side's wheels), once every `stride` yards
        const run = n.startsWith("run"), walker = run && !m.u.stride, wgt = run ? (walker ? F.walk : 1) : n === "idle" ? (A.run && !m.u.stride ? 1 - F.walk : 1) : 0; A[n].setEffectiveWeight(wgt); if (!wgt) continue;
        const d = A[n].getClip().duration; A[n].time = run ? ((F.phase / (m.u.stride || 4 * Math.PI)) % 1 + 1) % 1 * d : (clock + F.i) % d; any = true;
      }
      if (any) m.mixer.update(0);
    }

    // ---- swap in the models (the figures were built in the part before this one)
    (async () => {
      try { if (!window.DOW_INDEX) await loadScript(PACK + "index.js"); } catch (e) { return; }   // no pack here: the built miniatures stay
      const idx = window.DOW_INDEX; if (!idx || gone) return;
      const rules = idx.units.map(u => ({ ...u, re: new RegExp(u.match), nre: u.not ? new RegExp(u.not) : null }));
      const jobs = figs.map(F => { const r = ros[F.i], s = `${r.faction || ""} ${r.template || ""} ${r.veh || ""} | ${r.kit || ""}`; return rules.find(u => !!u.veh === !!F.veh && u.re.test(s) && !(u.nre && u.nre.test(s))) || null; });
      if (!jobs.some(Boolean)) return;
      await gltfReady();
      // each model once, with the clips it borrows (and those its lender borrows in turn)
      const loading = new Map(), byId = new Map(rules.map(u => [u.id, u])), assets = new Map();
      const assetOf = id => { if (!loading.has(id)) loading.set(id, (async () => { const u = byId.get(id), a = await loadAsset(id); if (u && u.clips_from) borrowClips(a, await assetOf(u.clips_from)); return a; })()); return loading.get(id); };
      for (const u of new Set(jobs.filter(Boolean))) {
        try { assets.set(u.id, await assetOf(u.id)); } catch (e) { console.warn("model " + u.id + " not loaded:", e); }
        if (gone) return;
      }
      for (const F of figs) { const u = jobs[F.i], a = u && assets.get(u.id); if (a) await attachModel(F, ros[F.i], u, a); if (gone) return; }
      if (!running) { update(last.t, last.p, last.st); render(); }
    })().catch(e => console.warn("models not loaded:", e));
