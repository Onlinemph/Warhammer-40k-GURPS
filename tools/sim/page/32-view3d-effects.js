// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= effects: two particle systems (glowing and smoky), beams, light flashes, decals
    function particles(max, tex, blending) {
      const geo = keep(new THREE.BufferGeometry());
      const pos = new Float32Array(max * 3), colr = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(colr, 3));
      geo.setAttribute("size", new THREE.BufferAttribute(size, 1)); geo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
      const mat = keep(new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, scale: { value: 400 }, hdr: { value: blending === THREE.AdditiveBlending ? 3.0 : 1.0 } }, transparent: true, depthWrite: false, blending,
        vertexShader: "attribute float size; attribute float alpha; attribute vec3 color; varying vec4 vC; uniform float scale; void main(){ vC = vec4(color, alpha); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }",
        fragmentShader: "uniform sampler2D map; uniform float hdr; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb * t.rgb * hdr, vC.a * t.a); }" }));
      const pts2 = new THREE.Points(geo, mat); pts2.frustumCulled = false; scene.add(pts2);
      const list = [];
      return {
        mat, list,
        add(p) { if (list.length >= max) list.shift(); list.push(p); },
        step(dt) {
          let n = 0;
          for (let j = list.length - 1; j >= 0; j--) { const p = list[j]; p.age += dt; if (p.age >= p.life) { list.splice(j, 1); continue; } }
          for (const p of list) {
            if (p.age < 0) { pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z; size[n] = 0; alpha[n] = 0; n++; continue; }   // not started yet
            const f = p.age / p.life, dr = Math.pow(p.drag ?? .9, dt * 10);
            p.vx *= dr; p.vy = p.vy * dr - (p.grav || 0) * dt; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.floor != null && p.y < p.floor) { p.y = p.floor; p.vy *= -.3; p.vx *= .5; p.vz *= .5; }
            pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
            const c = p.c1 && f > .3 ? p.c1 : p.c; colr[n * 3] = c[0]; colr[n * 3 + 1] = c[1]; colr[n * 3 + 2] = c[2];
            size[n] = p.s0 + (p.s1 - p.s0) * f; alpha[n] = p.a * (p.fadeIn ? Math.min(1, f * 5) : 1) * (1 - Math.pow(f, p.fade || 1.5));
            n++;
          }
          geo.setDrawRange(0, n);
          for (const a of ["position", "color", "size", "alpha"]) geo.attributes[a].needsUpdate = true;
        },
        clear() { list.length = 0; },
      };
    }
    const glow = particles(big ? 2500 : 4000, TEX.glow, THREE.AdditiveBlending), smoke = particles(big ? 1500 : 2500, TEX.smoke, THREE.NormalBlending);
    const C = hex => { const c = lin(hex); return [c.r, c.g, c.b]; };
    const rnd = Math.random;
    const burst = (sys, at, n, o2) => { for (let j = 0; j < n; j++) { const a = rnd() * 6.283, e = (rnd() - .3) * (o2.up ?? 1), sp = o2.speed * (.4 + rnd() * .6); sys.add({ x: at.x + (rnd() - .5) * (o2.spread || 0), y: at.y + (rnd() - .5) * (o2.spread || 0) * .5, z: at.z + (rnd() - .5) * (o2.spread || 0), vx: Math.cos(a) * sp, vy: e * sp + (o2.lift || 0), vz: Math.sin(a) * sp, age: 0, life: o2.life * (.6 + rnd() * .6), s0: o2.s0, s1: o2.s1, c: o2.c, c1: o2.c1, a: o2.a ?? 1, drag: o2.drag, grav: o2.grav, fade: o2.fade, floor: o2.floor, fadeIn: o2.fadeIn }); } };
    // beams: an additive cylinder from a to b with a soft outer glow, fading fast
    const beams = [];
    const beamMat = c => new THREE.MeshBasicMaterial({ color: lin(c).multiplyScalar(4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    function beam(a, b, color, r, life, jitter = 0) {
      const d = b.clone().sub(a), len = d.length(); if (len < .01) return;
      const qn = new THREE.Quaternion().setFromUnitVectors(yAx, d.clone().normalize());
      const core = new THREE.Mesh(G.unitCyl, beamMat(0xffffff)), halo = new THREE.Mesh(G.unitCyl, beamMat(color));
      for (const [m, rr] of [[core, r * .45], [halo, r * 2.2]]) { m.position.copy(a); m.quaternion.copy(qn); m.scale.set(rr, len, rr); scene.add(m); }
      beams.push({ core, halo, age: 0, life, jitter, a, qn, r });
    }
    const flashes = [];
    for (let j = 0; j < 4; j++) { const l = new THREE.PointLight(0xffa040, 0, 12, 2); scene.add(l); flashes.push({ l, age: 9, life: 1, i0: 0 }); }
    const flash = (at, color, i0, life, range = 12) => { const f = flashes.reduce((a, b) => b.age / b.life > a.age / a.life ? b : a); f.l.position.copy(at); f.l.color.set(color); f.l.distance = range; f.age = 0; f.life = life; f.i0 = i0; };
    // projectiles: a glowing head and a short trail, flying from a to b (arcing for lobbed shots)
    const shots = [];
    const projectile = (a, b, o2) => shots.push({ a, b, age: 0, dur: o2.dur, arc: o2.arc || 0, c: o2.c, size: o2.size, trail: o2.trail, smokeTrail: o2.smokeTrail, onHit: o2.onHit, done: false });

    // per weapon kind: colour and how the shot looks
    const KIND = {
      las: { c: 0xff3a24, beam: .045, life: .16, pulses: 3 }, lascannon: { c: 0xff2a3a, beam: .09, life: .28, pulses: 1, flare: 1 },
      gauss: { c: 0x39ff6a, beam: .05, life: .24, pulses: 2, crackle: 1 }, dark: { c: 0xb36aff, beam: .06, life: .25, pulses: 1 },
      plasma: { c: 0x6ac8ff, proj: .5, dur: .2, trail: 1 }, pulse: { c: 0x8ad8ff, proj: .28, dur: .14, pulses: 3 },
      bolt: { c: 0xffb04a, proj: .32, dur: .2, pulses: 3, pop: 1 }, slug: { c: 0xffe08a, proj: .2, dur: .16, pulses: 5 },
      shuriken: { c: 0x8affea, proj: .16, dur: .16, pulses: 4 }, splinter: { c: 0xa8ff6a, proj: .12, dur: .14, pulses: 3 },
      melta: { c: 0xffb070, beam: .07, life: .3, pulses: 1, heat: 1 }, flame: { c: 0xff8a2a, flame: 1 }, warpflame: { c: 0x7affff, flame: 1 },
      shell: { c: 0xffd08a, proj: .35, dur: .32, smoke: 1 }, lob: { c: 0xffd08a, proj: .3, dur: .7, arc: 1, smoke: 1 }, grenade: { c: 0xffd08a, proj: .16, dur: .55, arc: .5 },
      bio: { c: 0xb0ff4a, proj: .3, dur: .22, pulses: 2 },
    };
    // decals that stay: scorch where blasts went off, pools where models fell
    const decals = new THREE.Group(); scene.add(decals);
    const scorchMat = keep(new THREE.MeshStandardMaterial({ map: TEX.scorch, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    const poolMat = { blood: keep(new THREE.MeshStandardMaterial({ color: 0x4a0a08, alphaMap: TEX.pool, transparent: true, depthWrite: false, roughness: .3, polygonOffset: true, polygonOffsetFactor: -3 })),
      oil: keep(new THREE.MeshStandardMaterial({ color: 0x0c0c0c, alphaMap: TEX.pool, transparent: true, depthWrite: false, roughness: .25, polygonOffset: true, polygonOffsetFactor: -3 })) };
    const decalGeo = keep(new THREE.PlaneGeometry(1, 1));
    const blasts = [];
    fx.forEach((es, k) => es.forEach(e => { if (e[0] === "b") blasts.push({ t: k + 1, q: e[1], r: e[2], R: e[3] }); }));
    let decalT = -1;
    const buildDecals = t => {
      if (decalT === t) return; decalT = t;
      while (decals.children.length) decals.remove(decals.children[0]);
      for (const b of blasts) if (b.t <= t) { const [x, y] = P(b.q, b.r), m = new THREE.Mesh(decalGeo, scorchMat), s = 1.2 + b.R * 1.1; m.rotation.x = -Math.PI / 2; m.rotation.z = hash(b.q, b.r) * 6; m.scale.set(s, s, 1); m.position.set(x, zOf(b.q, b.r) + .02, y); m.receiveShadow = true; decals.add(m); }
      for (const F of figs) { const d = deathOf(F.i, t); if (!d) continue; const living = !/Necron/.test(ros[F.i].faction || "") && !F.veh; const m = new THREE.Mesh(decalGeo, living ? poolMat.blood : poolMat.oil), s = F.veh ? 2.4 : .9 * Math.max(1, F.k); m.rotation.x = -Math.PI / 2; m.rotation.z = F.i; m.scale.set(s, s * .8, 1); const [x, y] = d.at; m.position.set(x - .2, zXY(x, y) + .025, y); decals.add(m); }
    };

