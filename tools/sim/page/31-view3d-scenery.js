// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= battlefield scenery from the user's own games (optional)
    // tools/dow/build_pack.py also writes site/models/scenery.js: Dawn of War II's terrain textures and some of its
    // world objects (tools/dow/scenery.json says which). With it the painted ground and walls take the game's
    // textures, the cover crates become its sandbags, barrels and ammunition cases, and an outdoor battlefield gets
    // its rubble, tank traps, a ruined skyline and its sky. None of it changes the fight: the cover the simulator
    // models keeps its place and size, and anything else big enough to hide behind stands clear of every hex a
    // figure enters. Like the models, the file is never committed, and without it the painted battlefield stays.
    (async () => {
      try { if (!window.DOW_SCENERY) await loadScript(PACK + "scenery.js"); } catch (e) { return; }
      const shared = window.DOW_SCENERY; if (!shared || gone) return;
      const redraw = () => { if (!running) render(); };
      // an outdoor battlefield takes one of the pack's themes (city, desert, jungle...): the ruins are always the
      // city, open ground gets the same one every time this battle is watched
      let S = shared;
      const themes = shared.themes || [];
      if (!indoor && themes.length) {
        const pickBy = ros.reduce((a, r, i) => a + (r.template || "").length * (i + 3), fr.length * 7 + ros.length), theme = T ? (themes.includes("urban") ? "urban" : themes[0]) : themes[pickBy % themes.length];
        try { if (!(window.DOW_THEME || {})[theme]) await loadScript(PACK + "scenery_" + theme + ".js"); } catch (e) { return; }
        if (gone) return;
        const th = window.DOW_THEME[theme]; S = { tex: { ...shared.tex, ...th.tex }, props: { ...shared.props, ...th.props } }; decor.theme = theme;
      }
      for (const n in S.tex) if (TEX[n]) { const im = await loadImage(S.tex[n]); if (gone) return; TEX[n].image = im; TEX[n].needsUpdate = true; }
      // ruin walls: the game's concrete laid over them by where each point is in the world, so it runs unbroken from
      // hex to hex instead of repeating on every column
      if (S.tex.stone && walls && T && T.kind === "ruins") {
        const mat = walls.material; mat.color.set(0xffffff);
        mat.onBeforeCompile = sh => {
          sh.vertexShader = "varying vec3 vWallP; varying vec3 vWallN;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vec4 wallP = vec4(transformed, 1.0);\n #ifdef USE_INSTANCING\n wallP = instanceMatrix * wallP;\n #endif\n vWallP = (modelMatrix * wallP).xyz; vWallN = normal;");
          sh.fragmentShader = "varying vec3 vWallP; varying vec3 vWallN;\n" + sh.fragmentShader.replace("#include <map_fragment>", "vec3 wallA = abs(vWallN); vec2 wallUv = wallA.y > .5 ? vWallP.xz : (wallA.x > wallA.z ? vWallP.zy : vWallP.xy);\n vec4 texelColor = mapTexelToLinear(texture2D(map, wallUv * .22)); diffuseColor *= texelColor;");
        };
        mat.needsUpdate = true;
      }
      redraw();
      await gltfReady(); if (gone) return;

      // a world object: its meshes, each with the game's texture
      const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()), loaded = new Map();
      const names = role => Object.keys(S.props).filter(n => S.props[n].role === role);
      const propOf = (n, flat) => { if (!loaded.has(n)) loaded.set(n, (async () => {
        const p = S.props[n], bin = atob(p.glb), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const gltf = await new Promise((ok, no) => new THREE.GLTFLoader().parse(buf.buffer, "", ok, no)), found = [], meshes = [];
        gltf.scene.traverse(o => { if (o.isMesh) { found.push(o); if (o.material && o.material.dispose) keep(o.material); } });
        for (const o of found) {
          const name = o.material.name, map = keep(new THREE.Texture(await loadImage(p.tex[name]))), cut = p.cut.includes(name);
          map.encoding = THREE.sRGBEncoding; map.flipY = false; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = aniso; map.needsUpdate = true;
          meshes.push([keep(o.geometry), keep(flat ? new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, fog: false, depthWrite: false })
            : new THREE.MeshStandardMaterial({ map, roughness: .9, metalness: .05, alphaTest: cut ? .5 : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide }))]);
        }
        return { p, meshes };
      })()); return loaded.get(n); };
      const v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), qy = new THREE.Quaternion();
      // many copies of one object: each [x, height, y, turn, scale]
      const strew = async (n, list) => { const pr = await propOf(n); if (gone) return; for (const [geo, mat] of pr.meshes) inst(geo, mat, list, (im, [x, h, y, yaw, s], i) => { m4.compose(v3.set(x, h, y), qy.setFromAxisAngle(yAx, yaw), s3.set(s, s, s)); im.setMatrixAt(i, m4); }).frustumCulled = false; };
      const lists = new Map(), put = (n, at) => { if (!lists.has(n)) lists.set(n, []); lists.get(n).push(at); };
      const R = rng(53), pick = a => a[Math.floor(R() * a.length)];

      // the map's cover: the same hexes, about the same size, as the crates they replace
      if (decor.crateList && decor.crateList.length && names("crate_light").length && names("crate_heavy").length) {
        for (const [k, kind] of decor.crateList) {
          const [q, r] = keyHex(k), [x, y] = P(q, r), opts = names("crate_" + kind), n = opts[Math.floor(hash(q, r) * opts.length) % opts.length], p = S.props[n];
          const s = Math.min(1.5 / Math.max(p.hi[0] - p.lo[0], p.hi[2] - p.lo[2]), (kind === "heavy" ? 1.45 : 1.1) / (p.hi[1] - p.lo[1]));
          put(n, [x, zOf(q, r) - p.lo[1] * s, y, hash(r, q) * 6.283, s]);
        }
        for (const [n, list] of lists) await strew(n, list);
        if (gone) return;
        decor.crates.forEach(m => { m.visible = false; }); lists.clear(); redraw();
      }

      if (!indoor) {
        // a point d yards outside the fighting area (which already reaches 6 yards past anywhere a figure goes)
        const edge = (t, d) => { const w = bx1 - bx0 + 2 * d, h = by1 - by0 + 2 * d; t = (t % 1) * 2 * (w + h); return t < w ? [bx0 - d + t, by0 - d, 0] : t < w + h ? [bx1 + d, by0 - d + t - w, 1] : t < 2 * w + h ? [bx1 + d - (t - w - h), by1 + d, 2] : [bx0 - d, by1 + d - (t - 2 * w - h), 3]; };
        const within = (x, y) => x > bx0 && x < bx1 && y > by0 && y < by1;
        if (!T) {
          // open ground: small debris underfoot, larger pieces only where nobody fights
          const sc = names("scatter");
          if (sc.length) {
            for (let i = 0; i < Math.min(360, span * 3); i++) { const x = cx + (R() - .5) * span * 1.8, y = cy + (R() - .5) * span * 1.8, n = pick(sc); put(n, [x, zXY(x, y), y, R() * 6.283, S.props[n].scale * (within(x, y) ? .3 + R() * .3 : .6 + R() * .9)]); }
            if (decor.rocks) decor.rocks.visible = false;
          }
        }
        const bigs = names("big");
        if (bigs.length) for (let i = 0; i < Math.max(10, Math.min(48, span / 2)); i++) { const [x, y] = edge(R(), 1.5 + R() * R() * 22), n = pick(bigs); put(n, [x, T ? 0 : zXY(x, y), y, R() * 6.283, S.props[n].scale * (.8 + R() * .5)]); }
        for (const [n, list] of lists) await strew(n, list);
        if (gone) return;
        redraw();

        // the skyline: ruined blocks around the field, a second row behind where the ground reaches that far
        const blds = names("building"), towers = [];
        if (blds.length) {
          if (T) {   // a walled map stands on nothing: give the city something to stand on
            const gt = TEX.dirt.clone(); keep(gt); gt.repeat.set(span * 6 / 12, span * 6 / 12); gt.needsUpdate = true;
            const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(span * 6, span * 6)), keep(new THREE.MeshStandardMaterial({ map: gt, roughness: 1 })));
            ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -.2, cy); ground.receiveShadow = true; scene.add(ground);
          }
          const rows = [[19, 15, 23, 1, .25]]; if (span * 3 - Math.max(bx1 - bx0, by1 - by0) / 2 > 95) rows.push([52, 22, 34, 1.25, .5]);
          for (const [d0, dd, step, k0, kk] of rows) {
            const per = 2 * (bx1 - bx0 + by1 - by0 + 4 * d0), count = Math.max(6, Math.round(per / step));
            for (let i = 0; i < count; i++) {
              const [x, y, side] = edge((i + R() * .5) / count, d0 + R() * dd), pr = await propOf(pick(blds)); if (gone) return;
              const g = new THREE.Group(), k = pr.p.scale * (k0 + R() * kk);
              for (const [geo, mat] of pr.meshes) { const m = new THREE.Mesh(geo, mat); m.castShadow = !big; m.receiveShadow = true; g.add(m); }
              g.position.set(x, 0, y); g.rotation.y = side * Math.PI / 2 + (R() - .5) * .5 + (R() < .3 ? Math.PI / 2 : 0); g.scale.setScalar(k); scene.add(g);
              towers.push({ g, x, y, rad: Math.hypot(pr.p.hi[0] - pr.p.lo[0], pr.p.hi[2] - pr.p.lo[2]) * k / 2, top: pr.p.hi[1] * k });
            }
          }
          // a block standing between the camera and what it looks at steps out of the way
          const fwd = new THREE.Vector3();
          decor.frame = () => {
            camera.getWorldDirection(fwd);
            const c = camera.position, len = fwd.y < -.01 ? Math.min(600, c.y / -fwd.y) : 600, ax = fwd.x * len, ay = fwd.z * len, l2 = ax * ax + ay * ay || 1;
            for (const b of towers) {
              const t = Math.max(0, Math.min(1, ((b.x - c.x) * ax + (b.y - c.z) * ay) / l2));
              b.g.visible = !(Math.hypot(c.x + ax * t - b.x, c.z + ay * t - b.y) < b.rad + 2 && c.y + fwd.y * len * t < b.top + 1);
            }
          };
        }

        const skies = names("sky");
        if (skies.length && skyDome) {
          const pr = await propOf(skies[0], true); if (gone) return;
          const k = 590 / Math.max(pr.p.hi[0], -pr.p.lo[0], pr.p.hi[2], -pr.p.lo[2]);
          for (const [geo, mat] of pr.meshes) { const m = new THREE.Mesh(geo, mat); m.scale.setScalar(k); m.position.set(cx, -120, cy); m.renderOrder = -1; m.frustumCulled = false; scene.add(m); }
          skyDome.visible = false;
          // the haze takes the colour of the sky low down, so the far ground fades into it
          const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); g.drawImage(pr.meshes[0][1].map.image, 0, 0, 32, 32);
          const px = g.getImageData(0, 0, 32, 32).data, sum = [0, 0, 0];
          for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, o = 4 * (Math.round(16 + Math.sin(a) * 11) * 32 + Math.round(16 + Math.cos(a) * 11)); for (let ch = 0; ch < 3; ch++) sum[ch] += px[o + ch] / 24 / 255; }
          scene.fog.color.setRGB(sum[0], sum[1], sum[2]).convertSRGBToLinear();
        }
      }
      decor.ready = true; redraw();
    })().catch(e => console.warn("scenery not loaded:", e));
