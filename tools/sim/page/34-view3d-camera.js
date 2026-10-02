// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= camera: orbit around a target, optionally following the selected model
    const orb = { tx: cx, ty: 0, tz: cy, r: span * .8, th: -Math.PI / 2 + .35, ph: .95 };
    const tp = (fr[0] || []).filter(Boolean).map(x => P(x[0], x[1]));
    const actB = tp.length ? [Math.min(...tp.map(p => p[0])), Math.max(...tp.map(p => p[0])), Math.min(...tp.map(p => p[1])), Math.max(...tp.map(p => p[1]))] : [bx0, bx1, by0, by1];
    const place = () => {
      orb.ph = Math.max(.12, Math.min(1.45, orb.ph)); orb.r = Math.max(2.5, Math.min(span * 3, orb.r));
      camera.position.set(orb.tx + orb.r * Math.sin(orb.ph) * Math.cos(orb.th), orb.ty + orb.r * Math.cos(orb.ph), orb.tz + orb.r * Math.sin(orb.ph) * Math.sin(orb.th));
      camera.lookAt(orb.tx, orb.ty, orb.tz);
    };
    const fit = (whole) => {
      const [ax0, ax1, ay0, ay1] = whole ? [bx0, bx1, by0, by1] : actB;
      orb.tx = (ax0 + ax1) / 2; orb.tz = (ay0 + ay1) / 2; orb.ty = 0;
      orb.r = Math.max(9, Math.max(ax1 - ax0, (ay1 - ay0) * camera.aspect) * (whole ? 1.1 : .85) + (whole ? 6 : 4)); orb.th = Math.PI / 2 + .3; orb.ph = .85; place();
    };

    // ================= rendering: bloom when the vendored post-processing loaded, ACES tone mapping either way
    let W = 0, H = 0, composer = null, bloom = null;
    try {
      if (typeof installThreePost === "function") installThreePost();
      if (THREE.EffectComposer && THREE.UnrealBloomPass) {
        const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
        composer = new THREE.EffectComposer(renderer, rt);
        composer.addPass(new THREE.RenderPass(scene, camera));
        bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), big ? .6 : .8, .4, .97);   // only what glows (beams, flashes, eye lenses) blooms composer.addPass(bloom);
        // the final pass: ACES filmic tone mapping, sRGB, and a light vignette
        composer.addPass(new THREE.ShaderPass({ uniforms: { tDiffuse: { value: null }, exposure: { value: indoor ? 1.1 : 1.0 } },
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: "uniform sampler2D tDiffuse; uniform float exposure; varying vec2 vUv; vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); } void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * exposure; c = aces(c); c = pow(c, vec3(1.0 / 2.2)); float v = smoothstep(0.95, 0.35, length(vUv - 0.5)); gl_FragColor = vec4(c * mix(0.78, 1.0, v), 1.0); }" }));
        renderer.toneMapping = THREE.NoToneMapping; renderer.outputEncoding = THREE.LinearEncoding;
      }
    } catch (e) { composer = null; }
    if (!composer) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = indoor ? 1.1 : 1.0; renderer.outputEncoding = THREE.sRGBEncoding; }
    function resize(w, h) {
      W = w; H = h; renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px"; camera.aspect = w / h; camera.updateProjectionMatrix();
      if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
      const s = H * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360)); glow.mat.uniforms.scale.value = s; smoke.mat.uniforms.scale.value = s;
      place(); render();
    }
    function render() { if (!W) return; if (composer) composer.render(); else renderer.render(scene, camera); }

