// The battle replay: a loading screen while the server's engine fights the battle, then a player. The field is
// drawn once; soldiers move smoothly between seconds, with that second's shots, blows and blasts.
(() => {
  const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let poll = null, raf = null, R = null, t = 0, playing = false, speed = 2, last = 0, field = null, scale = 1, ox = 0, oy = 0;
  const box = $("#replay");
  const close = () => { clearTimeout(poll); cancelAnimationFrame(raf); box.hidden = true; R = null; };
  $("#rp-close").onclick = close;
  addEventListener("keydown", e => { if (!box.hidden && e.key === "Escape") close(); });

  window.openReplay = async (id, report) => {
    close(); box.hidden = false;
    $("#rp-title").textContent = `${report.worldName}, turn ${report.turn}`;
    $("#rp-load").hidden = false; $("#rp-play").hidden = true;
    const step = async () => {
      let j;
      try { const r = await fetch("/api/replay/" + encodeURIComponent(id), { headers: { authorization: "Bearer " + localStorage.getItem("war-token") } }); j = await r.json(); if (!r.ok) throw new Error(j.error); }
      catch (e) { $("#rp-msg").textContent = "Couldn't load it: " + e.message; return; }
      if (j.frames) return show(j);
      const p = j.progress;
      let frac = 0, msg = "";
      if (j.status === "queued") { msg = j.ahead ? `Waiting its turn: ${j.ahead} battle${j.ahead > 1 ? "s" : ""} ahead.` : "Starting…"; }
      else if (j.status === "failed") { msg = "The replay failed: " + (j.error || "unknown error"); }
      else if (p) {
        frac = Math.min(0.95, p.second / Math.max(p.estimate, p.second + 10));
        msg = `Fighting it out: second ${p.second}` + (p.attempt > 1 ? ` (try ${p.attempt} of ${p.attempts}: the first played out differently from the war's result)` : "");
      } else msg = "Fighting it out…";
      $("#rp-bar").style.width = (frac * 100).toFixed(0) + "%"; $("#rp-msg").textContent = msg;
      if (j.status !== "failed") poll = setTimeout(step, 700);
    };
    step();
  };

  // flat-topped hexes in axial coordinates, the hex rectangle in offset order (as the engine builds it)
  const SQ3 = Math.sqrt(3), axial = (c, r) => ({ q: c, r: r - (c - (c & 1)) / 2 }), pxy = (q, r) => [1.5 * q, SQ3 * (r + q / 2)];
  function show(rep) {
    R = rep; t = 0; playing = true;
    $("#rp-load").hidden = true; $("#rp-play").hidden = false;
    const col = f => f === "militia" ? "#8d887e" : (window.warView && warView.factions[f] ? warView.factions[f].colour : "#999");
    R.colours = R.sides.map(s => col(s.faction));
    const names = R.sides.map(s => (s.faction === "militia" ? "Militia" : warView.factions[s.faction].name) + (s.players.length ? ` (${s.players.join(", ")})` : ""));
    $("#rp-sides").innerHTML = names.map((n, i) => `<span><i style="background:${R.colours[i]}"></i>${esc(n)}</span>`).join("");
    $("#rp-note").textContent = R.matched ? "" : "This replay played out differently from the war's result.";
    const sl = $("#rp-slider"); sl.max = R.frames.length - 1; sl.value = 0;
    sl.oninput = () => { t = +sl.value; playing = false; $("#rp-toggle").textContent = "Play"; };
    $("#rp-toggle").onclick = () => { playing = !playing; if (t >= R.frames.length - 1) t = 0; $("#rp-toggle").textContent = playing ? "Pause" : "Play"; };
    $("#rp-toggle").textContent = "Pause";
    $("#rp-speed").onchange = e => speed = +e.target.value; speed = +$("#rp-speed").value;
    drawField(); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function drawField() {
    const cv = $("#rp-canvas"), W = R.map.W, H = R.map.H, hexes = [];
    let k = 0;
    for (let c = 1; c < W - 1; c++) for (let r = 1; r < H - 1; r++) { const a = axial(c, r); hexes.push([a.q, a.r, R.map.ground[k++]]); }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [q, r] of hexes) { const [x, y] = pxy(q, r); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cssW = cv.parentElement.clientWidth, cssH = Math.round(cssW * (y1 - y0 + 2) / (x1 - x0 + 2)), dpr = devicePixelRatio || 1;
    cv.style.height = cssH + "px"; cv.width = cssW * dpr; cv.height = cssH * dpr;
    scale = cssW * dpr / (x1 - x0 + 2); ox = -x0 + 1; oy = -y0 + 1;
    field = document.createElement("canvas"); field.width = cv.width; field.height = cv.height;
    const g = field.getContext("2d");
    for (const [q, r, z] of hexes) {
      const [x, y] = pxy(q, r);
      // obstacles brown; trees dark green; walls by height: low stone grey, hedges olive, buildings brown-grey
      g.fillStyle = z === 1000 ? "#8a6d47" : z <= -990 ? "#2f4a2a" : z < -30 ? "#5c4e3e" : z < -15 ? "#4d5e2c" : z < 0 ? "#9a968c" : `hsl(95, 28%, ${Math.min(62, 34 + z / 4)}%)`;
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, px = (x + ox + Math.cos(a)) * scale, py = (y + oy + Math.sin(a)) * scale; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.fill();
    }
  }
  function loop(now) {
    if (!R) return;
    const dt = (now - last) / 1000; last = now;
    if (playing) { t = Math.min(R.frames.length - 1, t + dt * speed); if (t >= R.frames.length - 1) { playing = false; $("#rp-toggle").textContent = "Play"; } $("#rp-slider").value = Math.floor(t); }
    render(); raf = requestAnimationFrame(loop);
  }
  function render() {
    const cv = $("#rp-canvas"), g = cv.getContext("2d"), i = Math.floor(t), f = t - i, A = R.frames[i], B = R.frames[Math.min(i + 1, R.frames.length - 1)];
    g.drawImage(field, 0, 0);
    const P = (q, r) => { const [x, y] = pxy(q, r); return [(x + ox) * scale, (y + oy) * scale]; };
    // the shots, blows and blasts of this second
    for (const e of R.fx[i] || []) {
      if (e[0] === "b") { const [x, y] = P(e[1], e[2]); g.fillStyle = "rgba(255,170,40,.45)"; g.beginPath(); g.arc(x, y, (e[3] || 1) * scale * 1.5, 0, 7); g.fill(); continue; }
      const [x1, y1] = P(e[1], e[2]), [x2, y2] = P(e[3], e[4]);
      g.strokeStyle = e[0] === "m" ? "rgba(255,255,255,.9)" : e[6] ? "rgba(255,230,120,.85)" : "rgba(255,255,255,.25)";
      g.lineWidth = Math.max(1, scale * 0.25); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    const left = [0, 0], rad = Math.max(2, scale * 0.85);
    A.forEach((m, k) => {
      if (!m) return;
      const n = B[k] || m, side = R.roster[k].side;
      left[side]++;
      const [x, y] = P(m[0] + (n[0] - m[0]) * f, m[1] + (n[1] - m[1]) * f);
      g.globalAlpha = m[2] === 1 ? 1 : 0.55;
      g.fillStyle = R.colours[side]; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
      g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = Math.max(1, rad * 0.25); g.stroke();
      if (m[3] < 50) { g.fillStyle = "#b3261e"; g.beginPath(); g.arc(x, y, rad * 0.4, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    });
    $("#rp-time").textContent = `Second ${i} of ${R.frames.length - 1} · standing ${left[0]} against ${left[1]}`;
  }
  addEventListener("resize", () => { if (R && !box.hidden) drawField(); });
})();
