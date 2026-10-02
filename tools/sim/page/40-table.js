  function setupReplay() {
    if (vtt) vtt.stop();
    const cv = document.getElementById("vtt-c");
    if (!cv || !last || !last.sample.frames.length) return;
    vtt = makeTable(last.sample, cv);
  }

  function makeTable(sample, cv) {
    const fr = sample.frames, fx = sample.fx || [], log = sample.log, T = sample.terrain, ros = sample.roster || [];
    const P = (q, r) => SIM.px({ q, r });
    const g = cv.getContext("2d");
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = { t: 0, p: 1, playing: false, grid: true, trails: true, measure: false, sel: -1, hover: -1, meas: null, view3d: false, lowWalls: false };
    let v3 = null;   // the 3D view, made the first time it's switched on
    // ---- the map, painted once
    const pts = [];
    fr.forEach(f => f.forEach(x => { if (x) pts.push(P(x[0], x[1])); }));
    const floor = T ? new Set(T.floor) : null, crates = T ? new Map(T.crates) : null, doors = T ? new Set(T.doors || []) : null;
    // elevation in yards: a facility's gantries and docks, or the ridge on open ground
    const ZM = new Map(T && T.elev ? T.elev : []), RG = sample.ridge;
    const zOf = (q, r) => { if (RG) { const x = RG.dir * (q - RG.qc); return x <= 0 ? RG.H : x >= RG.S ? 0 : RG.H * (1 - x / RG.S); } return ZM.get(q + "," + r) || 0; };
    if (T) for (const k of T.floor) { const [q, r] = k.split(",").map(Number); pts.push(P(q, r)); }
    let x0 = Math.min(...pts.map(p => p[0])) - 4, x1 = Math.max(...pts.map(p => p[0])) + 4, y0 = Math.min(...pts.map(p => p[1])) - 4, y1 = Math.max(...pts.map(p => p[1])) + 4;
    if (!T) { const padX = Math.max(0, 24 - (x1 - x0)) / 2, padY = Math.max(0, 16 - (y1 - y0)) / 2; x0 -= padX; x1 += padX; y0 -= padY; y1 += padY; }
    const RES = Math.max(8, Math.min(24, Math.floor(4200 / Math.max(x1 - x0, y1 - y0))));
    const bg = document.createElement("canvas");
    bg.width = Math.ceil((x1 - x0) * RES); bg.height = Math.ceil((y1 - y0) * RES);
    const b = bg.getContext("2d");
    b.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
    const eachHex = fn => { for (let q = Math.floor(x0 / 1.5) - 1; q <= Math.ceil(x1 / 1.5) + 1; q++) for (let r = Math.floor(y0 / SQ3 - q / 2) - 1; r <= Math.ceil(y1 / SQ3 - q / 2) + 1; r++) fn(q, r); };
    if (!T) {
      // open ground: churned earth, speckle, stones and old craters
      b.fillStyle = MAP.earth; b.fillRect(x0, y0, x1 - x0, y1 - y0);
      eachHex((q, r) => { const [cx, cy] = P(q, r), h = hash(q, r); b.fillStyle = h < .5 ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.035)"; hexPath(b, cx, cy, 1.02); b.fill(); });
      const area = (x1 - x0) * (y1 - y0);
      for (let i = 0; i < area * 5; i++) { const x = x0 + hash(i, 7) * (x1 - x0), y = y0 + hash(i, 13) * (y1 - y0), s = .03 + hash(i, 3) * .08; b.fillStyle = hash(i, 5) < .5 ? MAP.earth2 : "rgba(255,255,255,.08)"; b.fillRect(x, y, s, s); }
      for (let i = 0; i < area / 110; i++) {
        const x = x0 + hash(i, 101) * (x1 - x0), y = y0 + hash(i, 103) * (y1 - y0), rr = .8 + hash(i, 107) * 2.2;
        const gr = b.createRadialGradient(x, y, rr * .1, x, y, rr); gr.addColorStop(0, "rgba(43,39,31,.7)"); gr.addColorStop(.7, "rgba(40,36,28,.3)"); gr.addColorStop(1, "rgba(90,83,68,0)");
        b.fillStyle = gr; b.beginPath(); b.arc(x, y, rr, 0, 7); b.fill();
      }
      for (let i = 0; i < area / 12; i++) { const x = x0 + hash(i, 211) * (x1 - x0), y = y0 + hash(i, 223) * (y1 - y0), rr = .08 + hash(i, 227) * .18; b.fillStyle = MAP.rock; b.beginPath(); b.ellipse(x, y, rr, rr * .7, hash(i, 229) * 3, 0, 7); b.fill(); }
      if (RG) {
        // the ridge: lighter the higher, a contour every 2 yards, and the crest marked
        eachHex((q, r) => { const z = zOf(q, r); if (z <= 0) return; const [cx, cy] = P(q, r); b.fillStyle = `rgba(255,236,190,${(.05 + .22 * z / RG.H).toFixed(3)})`; hexPath(b, cx, cy, 1.02); b.fill(); });
        b.lineWidth = .07;
        for (let z = 2; z < RG.H; z += 2) { const qz = RG.qc + RG.dir * RG.S * (1 - z / RG.H), xz = 1.5 * qz; b.strokeStyle = "rgba(255,236,190,.28)"; b.setLineDash([.4, .3]); b.beginPath(); b.moveTo(xz, y0); b.lineTo(xz, y1); b.stroke(); }
        b.setLineDash([]); const xc = 1.5 * RG.qc; b.strokeStyle = "rgba(255,236,190,.7)"; b.lineWidth = .14; b.beginPath(); b.moveTo(xc, y0); b.lineTo(xc, y1); b.stroke();
        b.fillStyle = "rgba(255,236,190,.85)"; b.font = "1px ui-monospace, monospace"; b.textAlign = RG.dir > 0 ? "right" : "left";
        for (let y = y0 + 3; y < y1; y += 18) b.fillText(`crest ${RG.H} yd`, xc - RG.dir * .5, y);
      }
    } else {
      // a facility: gunmetal walls, deck plates with seams, grates, bulkhead edges, crates and barricades
      b.fillStyle = MAP.wall; b.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let i = 0; i < (x1 - x0) * (y1 - y0) * 2; i++) { b.fillStyle = "rgba(255,255,255,.025)"; b.fillRect(x0 + hash(i, 31) * (x1 - x0), y0 + hash(i, 37) * (y1 - y0), .25, .04); }
      const RU = T.kind === "ruins";
      for (const k of T.floor) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r), h = hash(q, r);
        b.fillStyle = RU ? (h < .5 ? "#67625a" : "#5f5a52") : h < .5 ? MAP.plate : MAP.plate2; hexPath(b, cx, cy, 1.02); b.fill();
        if (RU) { for (let i = 0; i < 3; i++) { b.fillStyle = hash(q + i, r - i) < .5 ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.07)"; b.fillRect(cx + (hash(q, r + i) - .5) * 1.3, cy + (hash(q + i, r) - .5) * 1.3, .12, .09); } continue; }
        if (h > .9) { b.save(); hexPath(b, cx, cy, .8); b.clip(); b.strokeStyle = MAP.grate; b.lineWidth = .06; for (let d = -1; d <= 1; d += .2) { b.beginPath(); b.moveTo(cx - 1, cy + d); b.lineTo(cx + 1, cy + d); b.stroke(); } b.restore(); }
        b.strokeStyle = MAP.seam; b.lineWidth = .04; hexPath(b, cx, cy, 1); b.stroke();
        if (h < .12) { b.fillStyle = "rgba(0,0,0,.18)"; b.beginPath(); b.ellipse(cx + (h - .06) * 4, cy, .5, .28, h * 9, 0, 7); b.fill(); }
      }
      // lighting: dim corridors and dim or dark rooms shaded
      for (const [k, v] of T.light || []) { const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r); b.fillStyle = `rgba(0,0,0,${v <= -7 ? .55 : v <= -3 ? .35 : .18})`; hexPath(b, cx, cy, 1.02); b.fill(); }
      // ruined walls: the taller, the darker and heavier; stumps and parapets lighter, with a broken top edge
      for (const [k, tp] of T.wallTop || []) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
        b.fillStyle = tp >= 8 ? "#34312e" : tp >= 5 ? "#46423e" : tp >= 3 ? "#5a554f" : "#6e685f"; hexPath(b, cx, cy, 1.02); b.fill();
        b.strokeStyle = tp >= 5 ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.22)"; b.lineWidth = .07; hexPath(b, cx, cy, .82); b.stroke();
        if (tp < 5 && hash(q, r) < .5) { b.fillStyle = "rgba(255,255,255,.5)"; b.font = ".5px ui-monospace, monospace"; b.textAlign = "center"; b.fillText(`${Math.round(tp * 3)}ft`, cx, cy + .18); }
      }
      // gantries, stairs and docks: lighter deck, a dark lip where it drops a yard or more, the height marked
      for (const [k, z] of ZM) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
        b.fillStyle = `rgba(255,255,255,${(.06 + .05 * z).toFixed(3)})`; hexPath(b, cx, cy, 1.02); b.fill();
        DIRN.forEach(([dq, dr], i) => {
          const k2 = (q + dq) + "," + (r + dr); if (!floor.has(k2) || (ZM.get(k2) || 0) > z - 1 + 1e-3) return;
          const [ax, ay] = hexCorner(cx, cy, EDGE[i][0]), [bx, by] = hexCorner(cx, cy, EDGE[i][1]);
          b.strokeStyle = "rgba(0,0,0,.7)"; b.lineWidth = .2; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
          b.strokeStyle = MAP.hazard; b.lineWidth = .06; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
        });
        if (T.kind === "ruins" ? z % 3 !== 0 || hash(q, r) < .06 : hash(q, r) < .25 || z < 3) { b.fillStyle = "rgba(255,255,255,.55)"; b.font = ".55px ui-monospace, monospace"; b.textAlign = "center"; b.fillText(`+${Math.round(z * 3)}ft`, cx, cy + .2); }
      }
      // bulkhead edges where floor meets wall
      b.lineCap = "round";
      for (const k of T.floor) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
        DIRN.forEach(([dq, dr], i) => {
          if (floor.has((q + dq) + "," + (r + dr))) return;
          const [ax, ay] = hexCorner(cx, cy, EDGE[i][0]), [bx, by] = hexCorner(cx, cy, EDGE[i][1]);
          b.strokeStyle = "rgba(0,0,0,.55)"; b.lineWidth = .28; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
          b.strokeStyle = MAP.wallHi; b.lineWidth = .08; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
        });
      }
      for (const [k, kind] of crates) {
        const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
        b.fillStyle = "rgba(0,0,0,.35)"; b.fillRect(cx - .62, cy - .5, 1.3, 1.1);
        if (kind === "light") {
          b.fillStyle = MAP.crateL; b.fillRect(cx - .7, cy - .6, 1.3, 1.1); b.strokeStyle = MAP.crateLd; b.lineWidth = .08; b.strokeRect(cx - .7, cy - .6, 1.3, 1.1);
          b.beginPath(); b.moveTo(cx - .7, cy - .6); b.lineTo(cx + .6, cy + .5); b.moveTo(cx + .6, cy - .6); b.lineTo(cx - .7, cy + .5); b.stroke();
        } else {
          b.fillStyle = MAP.crateH; b.fillRect(cx - .75, cy - .55, 1.4, 1.05); b.save(); b.beginPath(); b.rect(cx - .75, cy + .25, 1.4, .25); b.clip();
          for (let d = -1; d < 1.6; d += .3) { b.fillStyle = MAP.hazard; b.beginPath(); b.moveTo(cx - .75 + d, cy + .5); b.lineTo(cx - .6 + d, cy + .5); b.lineTo(cx - .35 + d, cy + .25); b.lineTo(cx - .5 + d, cy + .25); b.fill(); }
          b.restore(); b.strokeStyle = MAP.crateHd; b.lineWidth = .07; b.strokeRect(cx - .75, cy - .55, 1.4, 1.05);
        }
      }
    }
    // ---- camera
    const cam = { s: 20, x: x0, y: y0 };
    let W = 0, H = 0, dpr = 1;
    // the first view frames where the fighting happens; Fit shows the whole map
    const tp = []; fr.forEach(f => f.forEach(x => { if (x) tp.push(P(x[0], x[1])); }));
    const act = [Math.min(...tp.map(p2 => p2[0])) - 5, Math.min(...tp.map(p2 => p2[1])) - 5, Math.max(...tp.map(p2 => p2[0])) + 5, Math.max(...tp.map(p2 => p2[1])) + 5];
    const frame = (ax0, ay0, ax1, ay1) => { cam.s = Math.min(W / (ax1 - ax0), H / (ay1 - ay0)); cam.x = ax0 - (W / cam.s - (ax1 - ax0)) / 2; cam.y = ay0 - (H / cam.s - (ay1 - ay0)) / 2; };
    const fit = () => frame(x0, y0, x1, y1);
    const resize = () => {
      const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(200, Math.round(r.width)), h = Math.round(Math.min(640, Math.max(280, w * 0.62)));
      cv.style.height = h + "px"; cv.width = w * dpr; cv.height = h * dpr;
      const side = cv.closest(".vtt").querySelector(".vtt-side"); if (side) side.style.height = window.innerWidth > 820 ? h + "px" : "";
      const firstFit = !W; W = w; H = h; if (firstFit) frame(...act);
      const h3 = document.getElementById("vtt-3d"); if (h3) h3.style.height = h + "px";
      if (v3) v3.resize(w, h);
      draw();
    };
    const toWorld = (sx, sy) => [sx / cam.s + cam.x, sy / cam.s + cam.y];
    // world point to hex (flat-topped, size 1)
    const toHex = (wx, wy) => {
      const q = wx / 1.5, r = wy / SQ3 - q / 2;
      let x = q, z = r, y = -x - z, rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
      return { q: rx, r: rz };
    };
    const hexDistUI = (a, b2) => (Math.abs(a.q - b2.q) + Math.abs(a.r - b2.r) + Math.abs(a.q + a.r - b2.q - b2.r)) / 2;
    // ---- where each model stands at second t, progress p through that second (moving along its path)
    const along = (path, p) => {
      if (path.length < 2) return path[0];
      let L = 0; const seg = [];
      for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); L += d; }
      let want = L * p;
      for (let i = 0; i < seg.length; i++) { if (want <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, want / seg[i]) : 1; return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f]; } want -= seg[i]; }
      return path[path.length - 1];
    };
    const posAt = (i, t, p) => {
      const cur = fr[t] && fr[t][i], prev = t > 0 && fr[t - 1] ? fr[t - 1][i] : null;
      if (!cur) return prev && p < 0.6 ? P(prev[0], prev[1]) : null;
      if (!prev || p >= 1) return P(cur[0], cur[1]);
      const path = [P(prev[0], prev[1]), ...(cur[6] || []).map(([q, r]) => P(q, r))];
      if (path.length === 1) path.push(P(cur[0], cur[1]));
      return along(path, Math.min(1, p / 0.7));
    };
    // the fallen: where and when each model went down, from the casualty events
    const fallen = [];
    fx.forEach((es, k) => es.forEach(e => { if (e[0] === "d") fallen.push({ t: k + 1, q: e[1], r: e[2], side: e[3], dead: e[4] }); }));
    const ticks = document.getElementById("vtt-ticks");
    if (ticks) ticks.innerHTML = fallen.map(f => `<i class="s${f.side ? "b" : "a"}${f.dead ? " dead" : ""}" style="left:${(100 * f.t / Math.max(1, fr.length - 1)).toFixed(2)}%"></i>`).join("");
    const names = ros.map(r => r.id), sideOf = i => ros[i] ? ros[i].side : 0;
    const order = ros.map((r, i) => i).sort((a, c) => (ros[c].speed - ros[a].speed) || a - c);

    // ---- drawing
    function token(i, x, y, f, alpha) {
      const r = ros[i] || {}, side = f[2], hp = f[5] == null ? 1 : f[5], bitsv = f[7] || 0, prone = bitsv & 2, rad = prone ? .62 : .78;
      g.save(); g.globalAlpha = alpha; g.translate(x, y);
      g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(.08, .12, rad, rad * .9, 0, 0, 7); g.fill();
      g.fillStyle = side ? MAP.sideB : MAP.sideA; g.beginPath(); g.arc(0, 0, rad, 0, 7); g.fill();
      g.fillStyle = MAP.ink; g.beginPath(); g.arc(0, 0, rad - .13, 0, 7); g.fill();
      if (i === st.sel || i === st.hover) { g.strokeStyle = i === st.sel ? "#fff" : "rgba(255,255,255,.6)"; g.lineWidth = .1; g.beginPath(); g.arc(0, 0, rad + .12, 0, 7); g.stroke(); }
      // facing notch
      const a = [0, -60, -120, 180, 120, 60][f[4]] * Math.PI / 180;
      g.fillStyle = side ? MAP.sideB : MAP.sideA; g.beginPath(); g.moveTo(Math.cos(a) * (rad + .22), Math.sin(a) * (rad + .22)); g.lineTo(Math.cos(a + .35) * rad, Math.sin(a + .35) * rad); g.lineTo(Math.cos(a - .35) * rad, Math.sin(a - .35) * rad); g.closePath(); g.fill();
      // emblem
      g.save(); g.scale(rad / .78, rad / .78); g.fillStyle = side ? MAP.sideBl : MAP.sideAl; g.strokeStyle = g.fillStyle; (GLYPH[r.faction] || GLYPH.Default)(g); g.restore();
      if (bitsv & 1) { g.strokeStyle = MAP.hpMid; g.lineWidth = .08; g.setLineDash([.18, .12]); g.beginPath(); g.arc(0, 0, rad + .02, 0, 7); g.stroke(); g.setLineDash([]); }
      // health and shield bars
      const bw = 1.5, by = rad + .18;
      g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(-bw / 2 - .03, by - .03, bw + .06, .22);
      g.fillStyle = hp > .6 ? MAP.hpHi : hp > .3 ? MAP.hpMid : MAP.hpLo; g.fillRect(-bw / 2, by, bw * Math.max(0, hp), .16);
      if (f[8] >= 0) { g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(-bw / 2 - .03, by - .25, bw + .06, .18); g.fillStyle = MAP.shield; g.fillRect(-bw / 2, by - .22, bw * f[8], .12); }
      // condition badges
      let n = 0;
      for (const [bit, ch, col] of BADGES) {
        if (!(bitsv & bit)) continue;
        const ang = -Math.PI / 4 + n * .62, bx = Math.cos(ang) * (rad + .12), byy = Math.sin(ang) * (rad + .12) - .1;
        g.fillStyle = MAP.ink; g.beginPath(); g.arc(bx, byy, .26, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = .06; g.stroke();
        g.fillStyle = col; g.font = "bold .3px ui-monospace,monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, bx, byy + .02); n++;
      }
      g.restore();
    }
    function draw() {
      if (st.view3d && v3) { v3.update(st.t, st.p, st); return; }
      const t = st.t, p = st.p;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = T ? MAP.wall : MAP.earth; g.fillRect(0, 0, W, H);
      g.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, -cam.x * cam.s * dpr, -cam.y * cam.s * dpr);
      g.imageSmoothingEnabled = true; g.drawImage(bg, x0, y0, x1 - x0, y1 - y0);
      // doors and breaches as they stand
      if (T) {
        const state = new Map([...doors].map(k => [k, (T.shut || []).includes(k) ? "shut" : "open"]));
        for (const [tt, k, what] of T.events || []) if (tt <= t) state.set(k, what === "broken" ? "rubble" : what === "closed" ? "shut" : "open");
        for (const [k, s2] of state) {
          const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
          if (s2 === "shut") { g.fillStyle = MAP.door; hexPath(g, cx, cy, .96); g.fill(); g.strokeStyle = MAP.doorD; g.lineWidth = .1; g.beginPath(); g.moveTo(cx - .8, cy); g.lineTo(cx + .8, cy); g.stroke(); g.strokeStyle = MAP.hazard; g.lineWidth = .06; hexPath(g, cx, cy, .9); g.stroke(); }
          else if (s2 === "open") { g.strokeStyle = MAP.door; g.lineWidth = .08; g.setLineDash([.2, .15]); hexPath(g, cx, cy, .9); g.stroke(); g.setLineDash([]); }
          else { g.fillStyle = MAP.plate2; hexPath(g, cx, cy, 1); g.fill(); for (let i = 0; i < 6; i++) { g.fillStyle = MAP.seam; g.beginPath(); g.arc(cx + (hash(q + i, r) - .5) * 1.2, cy + (hash(q, r + i) - .5) * 1.2, .08 + hash(i, q) * .1, 0, 7); g.fill(); } }
        }
        for (const [tt, k, what] of T.events || []) if (what === "broken" && tt <= t && !doors.has(k)) {
          const [q, r] = k.split(",").map(Number), [cx, cy] = P(q, r);
          g.fillStyle = MAP.plate2; hexPath(g, cx, cy, 1.02); g.fill();
          for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? MAP.seam : MAP.wallHi; g.beginPath(); g.arc(cx + (hash(q + i, r) - .5) * 1.3, cy + (hash(q, r + i) - .5) * 1.3, .07 + hash(i, q) * .12, 0, 7); g.fill(); }
        }
      }
      // hex grid over the visible area
      if (st.grid && cam.s > 6) {
        const [vx0, vy0] = toWorld(0, 0), [vx1, vy1] = toWorld(W, H);
        g.strokeStyle = T ? MAP.gridF : MAP.gridO; g.lineWidth = 1 / cam.s; g.beginPath();
        for (let q = Math.floor(vx0 / 1.5) - 1; q <= Math.ceil(vx1 / 1.5) + 1; q++) for (let r = Math.floor(vy0 / SQ3 - q / 2) - 1; r <= Math.ceil(vy1 / SQ3 - q / 2) + 1; r++) {
          const [cx, cy] = P(q, r); for (let i = 0; i < 3; i++) { const [ax, ay] = hexCorner(cx, cy, i), [bx, by] = hexCorner(cx, cy, i + 1); g.moveTo(ax, ay); g.lineTo(bx, by); }
        }
        g.stroke();
      }
      // the fallen
      for (const f of fallen) {
        if (f.t > t || (f.t === t && p < 0.6)) continue;
        const [cx, cy] = P(f.q, f.r);
        g.globalAlpha = f.t === t ? 1 : .55; g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(cx, cy, .62, 0, 7); g.fill();
        g.strokeStyle = f.side ? MAP.sideB : MAP.sideA; g.lineWidth = f.dead ? .16 : .1; g.beginPath(); g.moveTo(cx - .38, cy - .38); g.lineTo(cx + .38, cy + .38); g.moveTo(cx + .38, cy - .38); g.lineTo(cx - .38, cy + .38); g.stroke();
        g.globalAlpha = 1;
      }
      const f = fr[t] || [];
      // paths walked this second
      if (st.trails && t > 0) {
        g.lineWidth = .1; g.setLineDash([.25, .2]); g.lineCap = "round";
        f.forEach((x, i) => { if (!x || !x[6] || !x[6].length || !fr[t - 1][i]) return; const pr = fr[t - 1][i]; g.strokeStyle = x[2] ? "rgba(214,167,60,.55)" : "rgba(194,58,48,.55)"; g.beginPath(); const [sx, sy] = P(pr[0], pr[1]); g.moveTo(sx, sy); for (const [q, r] of x[6]) { const [px2, py2] = P(q, r); g.lineTo(px2, py2); } g.stroke(); });
        g.setLineDash([]);
      }
      // aim lines
      g.setLineDash([.12, .18]); g.lineWidth = .06;
      f.forEach((x, i) => { if (!x || x[9] == null || x[9] < 0 || !f[x[9]]) return; const a = posAt(i, t, p), c = posAt(x[9], t, p); if (!a || !c) return; g.strokeStyle = x[2] ? "rgba(241,211,138,.5)" : "rgba(240,138,126,.5)"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke(); });
      g.setLineDash([]);
      // tokens
      const drawn = [];
      f.forEach((x, i) => { const at = posAt(i, t, p); if (x && at) { token(i, at[0], at[1], x, 1); drawn.push([i, at]); } });
      if (t > 0 && p < 0.6) (fr[t - 1] || []).forEach((x, i) => { if (x && !f[i]) { const at = posAt(i, t, p); if (at) token(i, at[0], at[1], x, 1 - p / 0.6); } });
      st.drawn = drawn;
      // this second's action: shots, blows, blasts, and what the hits did
      if (t > 0) {
        const es = fx[t - 1] || [];
        let k = 0;
        for (const e of es) {
          const lag = Math.min(0.3, k++ * 0.012), q2 = reduce ? 1 : Math.max(0, Math.min(1, (p - lag) / 0.45));
          if (e[0] === "s") {
            const [ax, ay] = P(e[1], e[2]), [bx, by] = P(e[3], e[4]);
            g.strokeStyle = e[6] ? (e[5] ? "rgba(241,211,138,.8)" : "rgba(255,160,140,.8)") : MAP.miss; g.lineWidth = e[6] ? .08 : .05;
            if (!e[6]) g.setLineDash([.3, .25]);
            g.globalAlpha = p >= 1 ? .45 : 1; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (bx - ax) * q2, ay + (by - ay) * q2); g.stroke(); g.setLineDash([]);
            if (q2 < 1) { g.fillStyle = MAP.shot; g.beginPath(); g.arc(ax + (bx - ax) * q2, ay + (by - ay) * q2, .16, 0, 7); g.fill(); }
            else if (e[6]) { g.fillStyle = MAP.shot; g.globalAlpha = p >= 1 ? .6 : 1; g.beginPath(); g.arc(bx, by, .28, 0, 7); g.fill(); }
            g.globalAlpha = 1;
          } else if (e[0] === "m") {
            const [ax, ay] = P(e[1], e[2]), [bx, by] = P(e[3], e[4]), ang = Math.atan2(by - ay, bx - ax);
            g.strokeStyle = e[5] ? MAP.sideBl : MAP.sideAl; g.lineWidth = e[6] ? .16 : .08; g.globalAlpha = e[6] ? 1 : .5; g.lineCap = "round";
            g.beginPath(); g.arc(bx - Math.cos(ang) * .3, by - Math.sin(ang) * .3, .75, ang - 1.1 * q2, ang + 1.1 * q2); g.stroke(); g.globalAlpha = 1;
          } else if (e[0] === "b") {
            const [cx, cy] = P(e[1], e[2]), rr = e[3] * 1.4 * (reduce ? 1 : Math.min(1, .25 + p));
            const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, `rgba(255,220,140,${p >= 1 ? .35 : .9})`); gr.addColorStop(.6, `rgba(255,140,40,${p >= 1 ? .2 : .55})`); gr.addColorStop(1, "rgba(255,120,30,0)");
            g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill();
          }
        }
        // floating numbers
        const seen = new Map();
        g.textAlign = "center"; g.textBaseline = "middle";
        for (const e of es) {
          if (e[0] !== "h" && e[0] !== "v" && e[0] !== "f") continue;
          const q0 = e[0] === "h" ? e[4] : e[3], r0 = e[0] === "h" ? e[5] : e[4];
          if (q0 == null) continue;
          const key2 = q0 + "," + r0, n = seen.get(key2) || 0; seen.set(key2, n + 1);
          const lift = reduce ? .6 : .3 + Math.min(1, Math.max(0, (p - .35) / .65)) * 1.1;
          const [cx, cy] = P(q0, r0), txt = e[0] === "h" ? (e[2] > 0 ? "−" + e[2] : "no pen") : e[0] === "f" ? "shield" : e[2];
          const col = e[0] === "h" ? (e[2] > 0 ? "#ffd2c8" : "#c9c6bd") : e[0] === "f" ? "#a8dcf6" : "#f4f1e8";
          if (p < .35 && !reduce) continue;
          g.font = `bold ${e[0] === "h" && e[2] > 0 ? .62 : .48}px ui-monospace,monospace`;
          g.lineWidth = .14; g.strokeStyle = "rgba(0,0,0,.75)"; g.globalAlpha = p >= 1 ? .85 : Math.min(1, (1.15 - p) * 2 + .3);
          const yy = cy - 1 - lift - n * .55; g.strokeText(txt, cx + .6, yy); g.fillStyle = col; g.fillText(txt, cx + .6, yy); g.globalAlpha = 1;
        }
      }
      // the measuring tape
      if (st.meas) {
        const [a, c] = st.meas, [ax, ay] = P(a.q, a.r), [cx, cy] = P(c.q, c.r), d = hexDistUI(a, c);
        g.strokeStyle = "#fff"; g.lineWidth = .1; g.setLineDash([.3, .2]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(cx, cy); g.stroke(); g.setLineDash([]);
        for (const [x, y] of [[ax, ay], [cx, cy]]) { g.strokeStyle = "#fff"; g.lineWidth = .08; hexPath(g, x, y, .95); g.stroke(); }
        const lab = `${d} yd · ${rangePenalty(Math.max(1, d))}`;
        g.font = "bold .6px ui-monospace,monospace"; g.textAlign = "center"; g.lineWidth = .16; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(lab, (ax + cx) / 2, (ay + cy) / 2 - .6); g.fillStyle = "#fff"; g.fillText(lab, (ax + cx) / 2, (ay + cy) / 2 - .6);
      }
    }
    // ---- side panels
    const hudA = document.getElementById("hudA"), hudB = document.getElementById("hudB"), clock = document.getElementById("rlab");
    const initEl = document.getElementById("vtt-init"), chatEl = document.getElementById("vtt-chat"), sheetEl = document.getElementById("vtt-sheet");
    const idRe = names.length ? new RegExp(names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, c) => c.length - a.length).join("|"), "g") : null;
    const idSide = new Map(names.map((n, i) => [n, sideOf(i)]));
    const COND = [[1, "stunned"], [2, "prone"], [4, "kneeling"], [8, "held"], [16, "holding a foe"], [32, "All-Out Defense"], [64, "All-Out Attack"], [128, "aiming"], [256, "pinned"], [512, "waiting"]];
    const fate = (i, t) => { const x = fr[t] && fr[t][i]; if (x) return x[3] === 2 ? "stunned" : x[3] === 3 ? "prone" : ""; const f = fallen.find(v => v.q != null && v.t <= t && ros[i] && sideOf(i) === v.side && fr[v.t - 1] && fr[v.t - 1][i] && fr[v.t - 1][i][0] === v.q && fr[v.t - 1][i][1] === v.r); return f ? (f.dead ? "killed" : "down") : "out of the fight"; };
    function panels() {
      const t = st.t, f = fr[t] || [];
      const up = s => f.filter(x => x && x[2] === s && x[3]).length, tot = s => ros.filter(r => r.side === s).length;
      hudA.textContent = `A ${up(0)}/${tot(0)}`; hudB.textContent = `B ${up(1)}/${tot(1)}`;
      clock.textContent = t === 0 ? "Deployment" : t === fr.length - 1 ? `End · ${t} s` : `${t} s`;
      initEl.innerHTML = `<ol class="vtt-init">${order.map(i => { const x = f[i], r = ros[i], hp = x ? x[5] : 0;
        return `<li data-i="${i}" class="s${r.side ? "b" : "a"}${x ? "" : " gone"}${i === st.sel ? " sel" : ""}"><span class="spd">${r.speed.toFixed(2)}</span><span class="nm">${esc(r.id)}</span><span class="hb"><i style="width:${Math.round(100 * Math.max(0, hp))}%"></i></span><span class="st">${x ? COND.filter(([bit]) => x[7] & bit).map(c => c[1]).join(", ") : esc(fate(i, t))}</span></li>`; }).join("")}</ol>`;
      const a = log.findIndex(l => l === `— Turn ${t} —`), b2 = log.findIndex(l => l === `— Turn ${t + 1} —`);
      const lines = t === 0 ? ["The sides deploy."] : a < 0 ? log.slice(-3) : log.slice(a + 1, b2 < 0 ? undefined : b2);
      chatEl.innerHTML = lines.map(l => { const sub = l.startsWith("  "); let h = esc(l.trim()); if (idRe) h = h.replace(idRe, m2 => `<b class="s${idSide.get(m2) ? "b" : "a"}">${m2}</b>`); return `<p class="${sub ? "sub" : "act"}">${h}</p>`; }).join("");
      if (st.sel >= 0) {
        const i = st.sel, r = ros[i], x = f[i];
        sheetEl.innerHTML = `<div class="vtt-sheet s${r.side ? "b" : "a"}"><div class="sh-top"><span class="side">Side ${"AB"[r.side]}</span><h3>${esc(r.id)}</h3><p>${esc(r.template)} · ${esc(r.faction)}</p></div>
          <dl class="sh-grid"><div><dt>ST</dt><dd>${r.st}</dd></div><div><dt>DX</dt><dd>${r.dx}</dd></div><div><dt>Speed</dt><dd>${r.speed}</dd></div><div><dt>Move</dt><dd>${r.move}</dd></div>
          <div><dt>HP</dt><dd>${x ? Math.round(x[5] * r.hp) + " / " : ""}${r.hp}</dd></div><div><dt>Dodge</dt><dd>${r.dodge}</dd></div><div><dt>Parry</dt><dd>${r.parry ?? "—"}</dd></div><div><dt>DR</dt><dd>${r.dr}</dd></div>
          ${r.sp ? `<div><dt>Shield</dt><dd>${x && x[8] >= 0 ? Math.round(x[8] * r.sp) + " / " : ""}${r.sp}</dd></div>` : ""}</dl>
          <p class="sh-w"><b>Ranged</b>${r.ranged ? esc(r.ranged) : "none"}</p><p class="sh-w"><b>Melee</b>${esc(r.melee)}</p>
          <p class="sh-w"><b>Now</b>${x ? (COND.filter(([bit]) => x[7] & bit).map(c => c[1]).join(", ") || "ready") : esc(fate(i, st.t))}</p>
          <p class="sh-w"><b>Whole battle</b>${r.kills} kill${r.kills === 1 ? "" : "s"}; ended ${r.fate === "ok" ? "still fighting" : r.fate === "dead" ? "dead" : r.fate === "routed" ? "fleeing" : "out of the fight"}</p></div>`;
      }
    }
    const tabs = [...document.querySelectorAll(".vtt-tabs [data-tab]")];
    const showTab = name => { tabs.forEach(b2 => b2.setAttribute("aria-selected", b2.dataset.tab === name)); [initEl, chatEl, sheetEl].forEach(el => el.hidden = el.id !== "vtt-" + name); };
    tabs.forEach(b2 => b2.onclick = () => showTab(b2.dataset.tab));
    initEl.onclick = e => { const li = e.target.closest("li[data-i]"); if (!li) return; st.sel = +li.dataset.i; panels(); draw(); showTab("sheet"); };
    // ---- time
    const slider = document.getElementById("rturn"), play = document.getElementById("rplay"), speed = document.getElementById("rspeed");
    let raf = 0, t0 = 0;
    const setT = (t, animate) => { st.t = Math.max(0, Math.min(fr.length - 1, t)); slider.value = st.t; st.p = animate && !reduce ? 0 : 1; t0 = performance.now(); panels(); if (animate && !reduce) loop(); else draw(); };
    function loop() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(now => {
        const dur = +speed.value;
        const len = st.view3d && st.cine && v3 ? v3.secLen(st.t) : 1;   // the action camera stretches a busy second
        st.p = Math.min(1, (now - t0) / (dur * 0.85 * len));
        draw();
        if (st.p < 1) loop();
        else if (st.playing) { if (st.t >= fr.length - 1) stopPlay(); else setTimeout(() => { if (st.playing) setT(st.t + 1, true); }, dur * 0.15); }
      });
    }
    const stopPlay = () => { st.playing = false; play.textContent = "Play"; play.setAttribute("aria-label", "Play"); };
    const startPlay = () => { if (st.t >= fr.length - 1) setT(0, false); st.playing = true; play.textContent = "Pause"; play.setAttribute("aria-label", "Pause"); setT(st.t + 1, true); };
    play.onclick = () => st.playing ? stopPlay() : startPlay();
    document.getElementById("rback").onclick = () => { stopPlay(); setT(st.t - 1, false); };
    document.getElementById("rstep").onclick = () => { stopPlay(); setT(st.t + 1, true); };
    slider.oninput = () => { stopPlay(); setT(+slider.value, false); };
    const root = document.getElementById("vtt");
    root.tabIndex = -1;
    const onKey = e => { if (!root.contains(document.activeElement) && document.activeElement !== document.body) return; if (e.key === " ") { e.preventDefault(); play.click(); } else if (e.key === "ArrowRight") { stopPlay(); setT(st.t + 1, true); } else if (e.key === "ArrowLeft") { stopPlay(); setT(st.t - 1, false); } };
    root.addEventListener("keydown", onKey);
    // ---- tools
    const toolBtn = n => root.querySelector(`[data-tool="${n}"]`);
    toolBtn("fit").onclick = () => { if (st.view3d && v3) v3.fit(true); else { fit(); draw(); } };
    // ---- the 3D view: three.js loads the first time it's asked for; the 2D canvas keeps the size and stays underneath
    const host3 = document.getElementById("vtt-3d");
    const tip3 = (i, sx, sy) => {
      if (i !== st.hover) { st.hover = i; draw(); }
      const tp2 = document.getElementById("vtt-tip"); if (!tp2) return;
      if (i < 0) { tp2.hidden = true; return; }
      const x = (fr[st.t] || [])[i], r = ros[i]; tp2.hidden = false; tp2.style.left = sx + 14 + "px"; tp2.style.top = sy + 10 + "px";
      tp2.innerHTML = `<b>${esc(r.id)}</b><span>${x ? Math.round(x[5] * r.hp) : 0} / ${r.hp} HP${x && x[8] >= 0 ? ` · shield ${Math.round(x[8] * r.sp)}` : ""}</span>`;
    };
    const set3d = on => {
      st.view3d = on; toolBtn("3d").setAttribute("aria-pressed", on);
      toolBtn("walls").hidden = !on || !T; toolBtn("measure").hidden = on; toolBtn("follow").hidden = !on; toolBtn("cine").hidden = !on; toolBtn("snd").hidden = !on;
      if (v3) v3.active(on);
      if (on) { st.measure = false; st.meas = null; toolBtn("measure").setAttribute("aria-pressed", "false"); }
      host3.hidden = !on; cv.style.visibility = on ? "hidden" : "";
      draw();
    };
    toolBtn("3d").onclick = () => {
      if (st.view3d) { set3d(false); return; }
      const b3 = toolBtn("3d"); b3.textContent = "Loading…"; b3.disabled = true;
      loadThree().then(THREE => {
        if (!v3) {
          v3 = makeView3D(THREE, { host: host3, fr, fx, T, ros, P, posAt, fallen, reduce, zOf,
            onPick: i => { st.sel = i; panels(); draw(); if (i >= 0) showTab("sheet"); }, onHover: tip3,
            onCineOff: () => { st.cine = false; toolBtn("cine").setAttribute("aria-pressed", "false"); } });
          host3.hidden = false; v3.resize(W, H); v3.fit(false);
        }
        set3d(true);
      }).catch(err => {
        const tp2 = document.getElementById("vtt-tip"); tp2.hidden = false; tp2.style.left = "12px"; tp2.style.top = "46px";
        tp2.innerHTML = `<b>3D view unavailable</b><span>${esc(err.message)}</span>`; setTimeout(() => { tp2.hidden = true; }, 4000);
      }).finally(() => { const b3 = toolBtn("3d"); b3.textContent = "3D"; b3.disabled = false; });
    };
    toolBtn("snd").onclick = e => {
      const b = e.currentTarget, on = b.getAttribute("aria-pressed") !== "true";
      if (v3) v3.sound(on).then(ok => { b.setAttribute("aria-pressed", ok && on); if (!ok) { b.disabled = true; b.title = "No sound pack here: tools/dow/README.md says how to build one"; } });
    };
    toolBtn("walls").onclick = e => { st.lowWalls = !st.lowWalls; e.currentTarget.setAttribute("aria-pressed", st.lowWalls); draw(); };
    toolBtn("follow").onclick = e => { st.follow = !st.follow; e.currentTarget.setAttribute("aria-pressed", st.follow); draw(); };
    toolBtn("cine").onclick = e => { st.cine = !st.cine; e.currentTarget.setAttribute("aria-pressed", st.cine); if (!st.cine && v3) v3.cineOff(); draw(); };
    toolBtn("grid").onclick = e => { st.grid = !st.grid; e.currentTarget.setAttribute("aria-pressed", st.grid); draw(); };
    toolBtn("trails").onclick = e => { st.trails = !st.trails; e.currentTarget.setAttribute("aria-pressed", st.trails); draw(); };
    toolBtn("measure").onclick = e => { st.measure = !st.measure; e.currentTarget.setAttribute("aria-pressed", st.measure); if (!st.measure) st.meas = null; cv.classList.toggle("measuring", st.measure); draw(); };
    // ---- pan, zoom, pick
    const pointers = new Map(); let drag = null, pinch = null;
    const tip = document.getElementById("vtt-tip");
    const pick = (sx, sy) => { const [wx, wy] = toWorld(sx, sy); let best = -1, bd = 0.9; for (const [i, [x, y]] of st.drawn || []) { const d = Math.hypot(x - wx, y - wy); if (d < bd) { bd = d; best = i; } } return best; };
    const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", e => {
      cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, local(e));
      if (pointers.size === 2) { const [a, c] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - c[0], a[1] - c[1]), s: cam.s, m: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2] }; drag = null; return; }
      const [sx, sy] = local(e);
      if (st.measure) { const [wx, wy] = toWorld(sx, sy); const h = toHex(wx, wy); st.meas = [h, h]; drag = { measure: true }; draw(); return; }
      drag = { sx, sy, cx: cam.x, cy: cam.y, moved: false };
    });
    cv.addEventListener("pointermove", e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, local(e));
      const [sx, sy] = local(e);
      if (pinch && pointers.size === 2) {
        const [a, c] = [...pointers.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]);
        const [wx, wy] = toWorld(pinch.m[0], pinch.m[1]); cam.s = Math.max(2, Math.min(90, pinch.s * d / pinch.d)); cam.x = wx - pinch.m[0] / cam.s; cam.y = wy - pinch.m[1] / cam.s; draw(); return;
      }
      if (drag && drag.measure) { const [wx, wy] = toWorld(sx, sy); st.meas[1] = toHex(wx, wy); draw(); return; }
      if (drag) { const dx = sx - drag.sx, dy = sy - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; cam.x = drag.cx - dx / cam.s; cam.y = drag.cy - dy / cam.s; draw(); return; }
      const i = pick(sx, sy);
      if (i !== st.hover) { st.hover = i; draw(); }
      if (i >= 0) { const x = (fr[st.t] || [])[i], r = ros[i]; tip.hidden = false; tip.style.left = sx + 14 + "px"; tip.style.top = sy + 10 + "px"; tip.innerHTML = `<b>${esc(r.id)}</b><span>${x ? Math.round(x[5] * r.hp) : 0} / ${r.hp} HP${x && x[8] >= 0 ? ` · shield ${Math.round(x[8] * r.sp)}` : ""}</span>`; }
      else tip.hidden = true;
    });
    const end = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && !drag.measure && !drag.moved) { const [sx, sy] = local(e); const i = pick(sx, sy); st.sel = i; panels(); draw(); if (i >= 0) showTab("sheet"); }
      drag = null;
    };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    cv.addEventListener("pointerleave", () => { tip.hidden = true; if (st.hover >= 0) { st.hover = -1; draw(); } });
    cv.addEventListener("wheel", e => { e.preventDefault(); const [sx, sy] = local(e), [wx, wy] = toWorld(sx, sy); cam.s = Math.max(2, Math.min(90, cam.s * Math.exp(-e.deltaY * 0.0015))); cam.x = wx - sx / cam.s; cam.y = wy - sy / cam.s; draw(); }, { passive: false });
    const ro = new ResizeObserver(() => resize()); ro.observe(cv);
    resize(); panels(); draw();
    return { stop() { stopPlay(); cancelAnimationFrame(raf); ro.disconnect(); root.removeEventListener("keydown", onKey); if (v3) { v3.dispose(); v3 = null; } } };
  }

