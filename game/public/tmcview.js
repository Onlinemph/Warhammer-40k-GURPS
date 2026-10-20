// A battle on its hex map (docs/setting.md, Tactical Mass Combat): the server fights it again from its record
// (/api/tmc/<id>) and sends the map and every turn; this draws it, turn by turn, with what happened in each.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const COL = { clear: "#c9c08f", woods: "#5d7a3e", high: "#a08356", swamp: "#7f8f6a", built: "#8a8580", water: "#4f7fa8" };
  const RES = { NE: "no effect", S: "suppressed", P: "pinned", PC: "pinned, a step lost", SL: "a step lost", DE: "eliminated", DO: "obliterated",
    AE: "attackers eliminated", AR: "attackers retreat", AD: "attackers lose a step", EN: "locked in melee", EX: "a bloody exchange", DD: "defenders lose a step", DR: "defenders retreat", DS: "defenders surrender" };
  let B = null, frame = 0, timer = null;
  async function open(id) {
    const ov = $("#hexview"); ov.hidden = false;
    $("#hx-title").textContent = "Fighting it again…"; $("#hx-feed").innerHTML = ""; $("#hx-sides").innerHTML = "";
    const tok = localStorage.getItem("war-token");
    const r = await fetch("/api/tmc/" + encodeURIComponent(id), { headers: tok ? { authorization: "Bearer " + tok } : {} });
    const j = await r.json();
    if (!r.ok) { $("#hx-title").textContent = j.error || "couldn't fetch the battle"; return; }
    B = j; build(); frame = 0; draw(); play(true);
  }
  // the frames: the setup, then each side's turn; the events between two snapshots belong to the second
  function build() {
    const map = B.log.find(e => e.t === "map");
    B.map = map; B.frames = []; let pending = [];
    for (const e of B.log) {
      if (e.t === "snap") { B.frames.push({ snap: e, events: pending }); pending = []; }
      else if (e.t !== "map") pending.push(e);
    }
    B.byId = Object.fromEntries(map.els.map(e => [e.id, e]));
    $("#hx-title").textContent = B.title;
    $("#hx-sides").innerHTML = B.sides.map(s => `<span><i style="background:${esc(s.colour)}"></i>${esc(s.name)}</span>`).join("") +
      `<span class="muted">${B.night ? "night · " : ""}${esc(B.terrain)} · ${B.recon.winner == null ? B.recon.kind + " battle" : esc(B.sides[B.recon.winner].name) + (B.recon.ambush ? " ambushed them" : B.recon.surprise ? " took them by surprise" : " had the initiative")}</span>`;
    $("#hx-slider").max = B.frames.length - 1;
  }
  const name = id => { const e = B.byId[id]; return !e ? "#" + id : e.unit === "militia" ? "the Local Defence" : `${B.sides[e.side].name.replace(/^The /, "")} ${B.units[e.unit] || e.unit}`; };
  function describe(e) {
    if (e.t === "fire") return `${name(e.by[0])}${e.by.length > 1 ? ` and ${e.by.length - 1} more` : ""} fire on ${name(e.at)}: ${RES[e.res] || e.res}`;
    if (e.t === "melee") return `${name(e.by[0])}${e.by.length > 1 ? ` and ${e.by.length - 1} more` : ""} charge ${name(e.at[0])} at ${e.col}: ${RES[e.res] || e.res}`;
    if (e.t === "move") return null;
    if (e.t === "gone") return `${name(e.id)} ${e.why === "surrendered" ? "surrender" : "are destroyed"}`;
    if (e.t === "fled") return `${name(e.id)} flee the field`;
    if (e.t === "broken") return `${name(e.id)} break`;
    if (e.t === "rally") return `${name(e.id)} rally`;
    if (e.t === "reanimate") return `${name(e.id)} rise again`;
    if (e.t === "demoralized") return `${B.sides[e.side].name} are demoralized`;
    if (e.t === "say") return e.text;
    return null;
  }
  function draw() {
    const cv = $("#hx-canvas"), m = B.map, W = m.W, H = m.H, wpx = cv.parentElement.clientWidth || 800;
    const size = Math.min(wpx / (1.5 * W + 0.5), 520 / (Math.sqrt(3) * (H + 0.5)));
    cv.width = Math.ceil((1.5 * W + 0.5) * size); cv.height = Math.ceil(Math.sqrt(3) * (H + 0.5) * size);
    const g = cv.getContext("2d"), cx = x => size + 1.5 * size * x, cy = (x, y) => Math.sqrt(3) * size * (y + 0.5 + 0.5 * (x & 1));
    const hex = (x, y, fill) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; g.lineTo(cx(x) + size * Math.cos(a), cy(x, y) + size * Math.sin(a)); } g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = "rgba(0,0,0,.15)"; g.stroke(); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hex(x, y, COL[m.terrain[y * W + x]] || COL.clear);
    for (const k of m.works) { const x = k % W, y = Math.floor(k / W); g.strokeStyle = "#3b2a17"; g.lineWidth = 2; g.beginPath(); g.arc(cx(x), cy(x, y), size * 0.8, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1; }
    const f = B.frames[frame], els = f.snap.els;
    // the events of this turn: lines of fire and charges
    for (const e of f.events) {
      if (e.t !== "fire" && e.t !== "melee") continue;
      const to = els.find(x => x[0] === (e.t === "fire" ? e.at : e.at[0])); if (!to) continue;
      for (const id of e.by) { const fr = els.find(x => x[0] === id); if (!fr) continue; g.strokeStyle = e.t === "fire" ? "rgba(255,230,120,.8)" : "rgba(220,40,40,.8)"; g.lineWidth = e.t === "fire" ? 1.5 : 3; g.beginPath(); g.moveTo(cx(fr[1]), cy(fr[1], fr[2])); g.lineTo(cx(to[1]), cy(to[1], to[2])); g.stroke(); g.lineWidth = 1; }
    }
    // elements: a counter each, in its side's colour; several in a hex fan out; reduced smaller, pinned ringed
    const byHex = {};
    for (const x of els) if (!(x[4] & 48)) (byHex[x[1] + "," + x[2]] ||= []).push(x);
    for (const list of Object.values(byHex)) list.forEach((x, i) => {
      const e = B.byId[x[0]], k = list.length, ang = (i / k) * Math.PI * 2, off = k > 1 ? size * 0.42 : 0;
      const px = cx(x[1]) + off * Math.cos(ang), py = cy(x[1], x[2]) + off * Math.sin(ang), rad = size * (k > 1 ? 0.4 : 0.62) * (x[4] & 64 ? 0.75 : 1);
      g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fillStyle = B.sides[e.side].colour; g.fill();
      g.strokeStyle = x[4] & 2 ? "#fff" : x[4] & 1 ? "#ff3b30" : x[4] & 8 ? "#ff9500" : "#111"; g.lineWidth = x[4] & 3 ? 2.5 : 1; g.stroke(); g.lineWidth = 1;
      g.fillStyle = "#fff"; g.font = `${Math.max(8, rad * 0.9)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(x[3]), px, py);
    });
    $("#hx-slider").value = frame;
    $("#hx-turn").textContent = f.snap.round === 0 ? "Setup" : `Round ${f.snap.round}, ${B.sides[f.snap.side].name}'s turn`;
    $("#hx-feed").innerHTML = f.events.map(describe).filter(Boolean).map(t => `<li>${esc(t)}</li>`).join("") || "<li class='muted'>Moving into position.</li>";
    if (frame === B.frames.length - 1) $("#hx-feed").innerHTML += `<li><b>${esc(B.text)}</b></li>`;
  }
  function play(on) {
    clearInterval(timer); timer = null;
    $("#hx-toggle").textContent = on ? "Pause" : "Play";
    if (on) timer = setInterval(() => { if (frame >= B.frames.length - 1) return play(false); frame++; draw(); }, 1400 / (+$("#hx-speed").value || 1));
  }
  $("#hx-close").onclick = () => { play(false); $("#hexview").hidden = true; };
  $("#hx-toggle").onclick = () => play(!timer);
  $("#hx-slider").oninput = () => { frame = +$("#hx-slider").value; play(false); draw(); };
  $("#hx-speed").onchange = () => { if (timer) play(true); };
  addEventListener("resize", () => { if (B && !$("#hexview").hidden) draw(); });
  window.openHexBattle = open;
})();
