// The web client: draws what the server says this player can see and sends orders. It holds no hidden
// information; the server filters everything.
const $ = s => document.querySelector(s);
let token = localStorage.getItem("war-token"), V = null, sel = null;
const api = async (path, body) => {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const armyText = a => Object.entries(a).map(([k, n]) => `${n} ${esc(k)}`).join(", ") || "nobody";

async function joinWar() {
  try {
    const name = $("#j-name").value, faction = document.querySelector("input[name=faction]:checked").value;
    token = (await api("/api/join", { name, faction })).token; localStorage.setItem("war-token", token); load();
  } catch (e) { $("#j-err").textContent = e.message; }
}
async function load() {
  if (!token) { $("#join").hidden = false; $("#game").hidden = true; return; }
  try { V = await api("/api/view"); } catch (e) { localStorage.removeItem("war-token"); token = null; return load(); }
  $("#join").hidden = true; $("#game").hidden = false;
  draw();
}
function countdown() {
  if (!V) return;
  const s = Math.max(0, Math.round((V.nextTick - V.now - (performance.now() - V.got)) / 1000));
  $("#turn").textContent = `Turn ${V.turn} · next tick in ${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m ${s % 60}s`;
  if (s === 0) setTimeout(load, 2000);
}
// World labels, laid out for the screen they're on. Text is sized so it reads at about 12px however small the map
// is drawn, and each label tries the right, left, top and bottom of its world, taking the first spot that stays on
// the map and clear of other labels and worlds. Labels go down in order of importance (your warband's world, the
// one picked, its neighbours, capitals, your worlds, what you can see, the rest); a minor world whose label can't
// fit goes without (tap it to see its name in the panel).
function labels(W, me) {
  const svgEl = $("#map"), scale = (svgEl.getBoundingClientRect().width || 1000) / 1000, fs = Math.max(12, 12 / scale), fs2 = fs * 0.8;
  const near = new Set(W[me.at].links), prio = w => w.id === me.at ? 0 : w.id === sel ? 1 : near.has(w.id) ? 2 : w.capital ? 3 : w.owner === V.you.faction ? 4 : w.seen ? 5 : 6;
  const placed = [], dots = V.worlds.map(w => ({ id: w.id, x0: w.x - 13, y0: w.y - 13, x1: w.x + 13, y1: w.y + 13 }));
  const hit = (b, id) => b.x0 < 2 || b.y0 < 2 || b.x1 > 998 || b.y1 > 598 || placed.some(p => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0) || dots.some(d => d.id !== id && b.x0 < d.x1 && b.x1 > d.x0 && b.y0 < d.y1 && b.y1 > d.y0);
  let out = "";
  for (const w of V.worlds.slice().sort((a, b) => prio(a) - prio(b))) {
    const n = w.forces ? w.forces.reduce((a, f) => a + Object.values(f.army).reduce((x, y) => x + y, 0), 0) : null;
    const sub = n != null && prio(w) <= 5 ? `${n} troops` : "", wd = Math.max(w.name.length * fs * 0.58, sub.length * fs2 * 0.56), ht = fs + (sub ? fs2 + 2 : 0), r = (w.id === me.at ? 19 : w.capital ? 13 : 10) + 4;   // clear of the warband ring too
    const spots = [
      { x0: w.x + r, y0: w.y - fs * 0.8, anchor: "start", tx: w.x + r },
      { x0: w.x - r - wd, y0: w.y - fs * 0.8, anchor: "end", tx: w.x - r },
      { x0: w.x - wd / 2, y0: w.y - r - ht, anchor: "middle", tx: w.x },
      { x0: w.x - wd / 2, y0: w.y + r, anchor: "middle", tx: w.x },
    ].map(b => ({ ...b, x1: b.x0 + wd, y1: b.y0 + ht }));
    let b = spots.find(s => !hit(s, w.id));
    if (!b && prio(w) <= 1) b = spots.find(s => s.x0 >= 2 && s.x1 <= 998) || spots[0];   // your world and the picked one always get a label
    if (!b) continue;
    placed.push(b);
    out += `<text class="wname" x="${b.tx}" y="${b.y0 + fs * 0.85}" text-anchor="${b.anchor}" style="font-size:${fs.toFixed(1)}px;stroke-width:${(fs * 0.25).toFixed(1)}px">${esc(w.name)}</text>`;
    if (sub) out += `<text class="force" x="${b.tx}" y="${b.y0 + fs + fs2 * 0.9}" text-anchor="${b.anchor}" style="font-size:${fs2.toFixed(1)}px;stroke-width:${(fs2 * 0.25).toFixed(1)}px">${sub}</text>`;
  }
  return out;
}
function draw() {
  V.got = performance.now(); window.warView = V;
  const W = Object.fromEntries(V.worlds.map(w => [w.id, w])), col = f => f ? V.factions[f].colour : "#8d887e";
  const me = V.you.warband;
  let svg = "";
  for (const w of V.worlds) for (const l of w.links) if (w.id < l) svg += `<line class="lane" x1="${w.x}" y1="${w.y}" x2="${W[l].x}" y2="${W[l].y}"/>`;
  for (const w of V.worlds) {
    const n = w.forces ? w.forces.reduce((a, f) => a + Object.values(f.army).reduce((x, y) => x + y, 0), 0) : null;
    svg += `<circle class="world${sel === w.id ? " sel" : ""}" data-id="${w.id}" cx="${w.x}" cy="${w.y}" r="${w.capital ? 13 : 10}" fill="${col(w.owner)}" opacity="${w.seen ? 1 : .55}"><title>${esc(w.name)}</title></circle>`;
    if (me.at === w.id) svg += `<circle class="here" cx="${w.x}" cy="${w.y}" r="19"/>`;
  }
  $("#map").innerHTML = svg + labels(W, me);
  $("#map").querySelectorAll(".world").forEach(c => c.onclick = () => { sel = c.dataset.id; draw(); });
  const st = Object.entries(V.you.stock).map(([k, v]) => `${Math.floor(v)} ${k}`).join(" · ");
  $("#me").innerHTML = `<h2>${esc(V.you.name)}</h2><p>${esc(V.factions[V.you.faction].name)} · stockpile: ${esc(st)}</p>
    <p>Warband at <b>${esc(W[me.at].name)}</b>${me.supplied ? "" : " · <span class='err'>out of supply</span>"}<br>${armyText(Object.fromEntries(Object.entries(me.army).map(([k, n]) => [V.units[k] ? V.units[k].name : k, n])))}</p>
    ${me.orders ? `<p class="muted">Orders in: ${me.orders.move ? "move to " + esc(W[me.orders.move].name) : "hold"}${me.orders.recruit.length ? ", recruit " + me.orders.recruit.map(r => r.count + " " + esc(V.units[r.unit].name)).join(", ") : ""}</p>` : ""}
    <details><summary>History</summary><ol class="feed">${me.history.slice().reverse().map(h => `<li>${esc(h)}</li>`).join("")}</ol></details>`;
  const w = sel && W[sel];
  $("#world").innerHTML = w ? `<h3>${esc(w.name)}</h3><p>${esc(w.typeName)}${w.capital ? ", a capital" : ""} · ${w.owner ? esc(V.factions[w.owner].name) : "unclaimed"}</p>
    ${w.forces ? (w.forces.length ? `<table>${w.forces.map(f => `<tr><td>${f.faction === "militia" ? "Militia" : esc(V.factions[f.faction].name)}${f.players.length ? " (" + f.players.map(esc).join(", ") + ")" : ""}</td><td>${armyText(f.army)}</td></tr>`).join("")}</table>` : "<p class='muted'>Nobody there.</p>") : "<p class='muted'>Your faction has no eyes here.</p>"}` : `<p class="muted">Pick a world on the map.</p>`;
  const here = W[me.at];
  $("#orders").innerHTML = `<h3>Orders for the next tick</h3>
    <label>Move <select id="o-move"><option value="">Hold at ${esc(here.name)}</option>${here.links.map(l => `<option value="${l}">to ${esc(W[l].name)}</option>`).join("")}</select></label>
    ${here.owner === V.you.faction ? Object.entries(V.units).map(([k, u]) => `<label>${esc(u.name)} <small class="muted">(${Object.entries(u.cost).map(([r, c]) => c + " " + r).join(", ")} each)</small> <input type="number" min="0" max="50" value="0" data-unit="${k}"></label>`).join("") : "<p class='muted'>Recruits only come from your own worlds.</p>"}
    <button id="o-go">Send orders</button><p class="err" id="o-err"></p>`;
  $("#o-go").onclick = async () => {
    try {
      const recruit = [...document.querySelectorAll("[data-unit]")].map(i => ({ unit: i.dataset.unit, count: +i.value })).filter(r => r.count > 0);
      await api("/api/orders", { move: $("#o-move").value || null, recruit }); load();
    } catch (e) { $("#o-err").textContent = e.message; }
  };
  $("#reports").innerHTML = V.reports.map((r, i) => `<li><b>Turn ${r.turn}</b> · ${esc(r.text)} ${r.id ? `<button class="link" data-rep="${i}">Watch</button>` : ""}</li>`).join("") || "<li class='muted'>No battles yet.</li>";
  $("#reports").querySelectorAll("[data-rep]").forEach(b => b.onclick = () => openReplay(V.reports[+b.dataset.rep].id, V.reports[+b.dataset.rep]));
  $("#news").innerHTML = V.news.map(n => `<li><b>Turn ${n.turn}</b> · ${esc(n.text)}</li>`).join("");
  countdown();
}
$("#j-go").onclick = joinWar;
let resizeT = null;
addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => V && draw(), 150); });
setInterval(countdown, 1000);
setInterval(load, 60000);
load();
