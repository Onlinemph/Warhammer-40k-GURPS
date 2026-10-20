// The web client: draws what the server says this player can see and sends orders. It holds no hidden
// information; the server filters everything.
const $ = s => document.querySelector(s);
// signed in, the session cookie goes with every request by itself; a development join keeps a token in this browser
let token = localStorage.getItem("war-token"), V = null, sel = null, ME = null;
const api = async (path, body) => {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const armyText = a => Object.entries(a).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${esc(k)}`).join(", ") || "nobody";

async function joinWar() {
  try {
    const name = $("#j-name").value, faction = document.querySelector("input[name=faction]:checked").value;
    const r = await api("/api/join", { name, faction });
    if (r.token) { token = r.token; localStorage.setItem("war-token", token); }
    load();
  } catch (e) { $("#j-err").textContent = e.message; }
}
// signed out: the providers (and the development join, where the server allows it); signed in without a warband:
// the join form; with one: the war
function showJoin() {
  $("#join").hidden = false; $("#game").hidden = true;
  $("#signin").hidden = ME.signedIn || !ME.providers.length;
  $("#providers").innerHTML = ME.providers.map(p => `<a class="button" href="/auth/${encodeURIComponent(p.id)}">Sign in with ${esc(p.name)}</a>`).join("");
  $("#raise").hidden = !(ME.signedIn || ME.devJoin);
  if (!$("#j-factions").children.length) $("#j-factions").innerHTML = ME.factions.map((f, i) => `<label style="border-left:4px solid ${esc(f.colour)}"><input type="radio" name="faction" value="${esc(f.id)}"${i ? "" : " checked"}> <b>${esc(f.name)}</b><br><small>${esc(f.blurb)}</small></label>`).join("");
  $("#j-dev").hidden = ME.signedIn;
  if (!ME.signedIn && !ME.devJoin && !ME.providers.length) $("#j-err").textContent = "Sign-in isn't set up on this server yet.";
}
async function load() {
  try { ME = await api("/api/me"); } catch (e) { $("#j-err").textContent = e.message; return; }
  $("#signout").hidden = !ME.signedIn;
  if (!ME.joined) { if (token) { localStorage.removeItem("war-token"); token = null; } return showJoin(); }
  try { V = await api("/api/view"); } catch (e) { return showJoin(); }
  $("#join").hidden = true; $("#game").hidden = false;
  draw();
}
function countdown() {
  if (!V) return;
  const s = Math.max(0, Math.round((V.nextTick - V.now - (performance.now() - V.got)) / 1000));
  if (V.paused) { $("#turn").textContent = `Turn ${V.turn} · the war is paused`; return; }
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
  // the faction's own business: the Hegemony's edict, a ritual under way, a Brawl warband growing restless
  const ed = V.you.edict, rit = me.ritual, idle = V.turn - (me.lastFight ?? V.turn);
  const own = (ed ? `<p><b>Edict:</b> ${esc(ed.text)}, by turn ${ed.until}${ed.kind === "hold" ? ` (held ${ed.held} of 5)` : ""}</p>` : "") +
    (rit ? `<p><b>${esc(V.you.rituals[rit.kind].name)}</b> under way at ${esc(W[rit.at].name)}${rit.target ? " against " + esc(W[rit.target].name) : ""}, done on turn ${rit.done} if the world isn't fought over</p>` : "") +
    (V.you.faction === "brawl" && idle >= 3 ? `<p class="err">The lads are restless: no fight for ${idle} turns${idle >= 4 ? ", and they're fighting each other" : ""}</p>` : "");
  $("#me").innerHTML = `<h2>${esc(V.you.name)}</h2><p>${esc(V.factions[V.you.faction].name)} · stockpile: ${esc(st)}</p>
    <p>Warband at <b>${esc(W[me.at].name)}</b>${me.supplied ? "" : " · <span class='err'>out of supply</span>"}<br>${armyText(Object.fromEntries(Object.entries(me.army).map(([k, n]) => [V.units[k] ? V.units[k].name : k, n])))}</p>
    <p class="muted">Stance: ${esc(me.stance || "advance")}${me.careful ? ", turning back from bad odds" : ""}</p>
    ${me.orders ? `<p class="muted">Orders in: ${me.orders.move ? "move to " + esc(W[me.orders.move].name) : "hold"}${me.orders.recruit.length ? ", recruit " + me.orders.recruit.map(r => r.count + " " + esc(V.units[r.unit].name)).join(", ") : ""}</p>` : ""}
    ${own}${me.history.some(h => h.startsWith(`Turn ${V.turn}:`)) ? `<ul class="feed">${me.history.filter(h => h.startsWith(`Turn ${V.turn}:`)).map(h => `<li>${esc(h.replace(/^Turn \d+: /, ""))}</li>`).join("")}</ul>` : ""}<details><summary>History</summary><ol class="feed">${me.history.slice().reverse().map(h => `<li>${esc(h)}</li>`).join("")}</ol></details>`;
  const w = sel && W[sel];
  $("#world").innerHTML = w ? `<h3>${esc(w.name)}</h3><p>${esc(w.typeName)}${w.capital ? ", a capital" : ""}${w.asleep ? ", its tomb asleep" : w.asleep === false ? ", its tomb awake" : ""}${w.gate ? ", a gate" : ""}${w.walls ? `, walls level ${w.walls}` : ""} · ${w.owner ? esc(V.factions[w.owner].name) : "unclaimed"}${w.loyalty != null ? ` · loyalty ${w.loyalty}` : ""}${w.held != null ? ` · held ${w.held} turns` : ""}</p>
    ${V.you.odds[w.id] != null ? `<p>If your warband fights here: about <b>${V.you.odds[w.id]}%</b> to win against the strongest force.</p>` : ""}${w.forces ? (w.forces.length ? `<table>${w.forces.map(f => `<tr><td>${esc(V.factions[f.faction].name)}${f.players.length ? " (" + f.players.map(esc).join(", ") + ")" : ""}</td><td>${armyText(f.army)}</td></tr>`).join("")}</table>` : "<p class='muted'>Nobody there.</p>") : "<p class='muted'>Your faction has no eyes here.</p>"}` : `<p class="muted">Pick a world on the map.</p>`;
  const here = W[me.at];
  $("#orders").innerHTML = `<h3>Orders for the next tick</h3>
    <label>Stance <select id="o-stance">${[["advance", "Advance: go where sent, take what you win"], ["fortify", "Fortify: stay, and fight harder on your own world"], ["raid", "Raid: strike, loot, come back"]].map(([k, t]) => `<option value="${k}"${(me.stance || "advance") === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>
    <label><input type="checkbox" id="o-careful"${me.careful ? " checked" : ""}> Turn back if the odds are under ${V.you.turnBack}%</label>
    ${here.owner === V.you.faction && here.walls < V.you.walls.max ? `<label><input type="checkbox" id="o-walls"> Raise the walls of ${esc(here.name)} to level ${here.walls + 1} (${V.you.walls.cost[here.walls]} materiel)</label>` : ""}
    <label>Move <select id="o-move"${rit ? " disabled" : ""}><option value="">Hold at ${esc(here.name)}</option>${V.you.moves.map(l => `<option value="${l}">${here.links.includes(l) ? "to" : "through the gate to"} ${esc(W[l].name)}${V.you.odds[l] != null ? ` (fight there: about ${V.you.odds[l]}% to win)` : ""}</option>`).join("")}</select></label>
    ${V.you.rituals && here.owner === V.you.faction && !rit ? `<label>Ritual <select id="o-rit"><option value="">none</option>${Object.entries(V.you.rituals).map(([k, r]) => k === "corrupt"
      ? here.links.map(l => W[l]).filter(t => t.owner === "hegemony" && !t.capital).map(t => `<option value="corrupt:${t.id}">${r.name} against ${esc(t.name)}${t.loyalty != null ? " (loyalty " + t.loyalty + ")" : ""}, ${r.captives} captives</option>`).join("")
      : `<option value="${k}">${r.name}, ${r.captives} captives</option>`).join("")}</select></label>` : ""}
    ${here.owner === V.you.faction ? Object.entries(V.units).map(([k, u]) => `<label>${esc(u.name)} <small class="muted">(${Object.entries(u.cost).map(([r, c]) => c + " " + r).join(", ")} each)</small> <input type="number" min="0" max="50" value="0" data-unit="${k}"></label>`).join("") : "<p class='muted'>Recruits only come from your own worlds.</p>"}
    <button id="o-go">Send orders</button><p class="err" id="o-err"></p>`;
  $("#o-go").onclick = async () => {
    try {
      const recruit = [...document.querySelectorAll("[data-unit]")].map(i => ({ unit: i.dataset.unit, count: +i.value })).filter(r => r.count > 0);
      const rv = $("#o-rit") ? $("#o-rit").value : "", [kind, target] = rv.split(":");
      await api("/api/orders", { move: $("#o-move").value || null, recruit, ritual: rv ? { kind, target: target || null } : null,
        stance: $("#o-stance").value, careful: $("#o-careful").checked, build: $("#o-walls") && $("#o-walls").checked ? "walls" : null }); load();
    } catch (e) { $("#o-err").textContent = e.message; }
  };
  $("#reports").innerHTML = V.reports.map((r, i) => `<li><b>Turn ${r.turn}</b> · ${esc(r.text)} ${r.id ? `<button class="link" data-rep="${i}">Watch</button>` : ""}</li>`).join("") || "<li class='muted'>No battles yet.</li>";
  $("#reports").querySelectorAll("[data-rep]").forEach(b => b.onclick = () => openReplay(V.reports[+b.dataset.rep].id, V.reports[+b.dataset.rep]));
  $("#news").innerHTML = V.news.map(n => `<li><b>Turn ${n.turn}</b> · ${esc(n.text)}</li>`).join("");
  countdown();
}
$("#j-go").onclick = joinWar;
// the admin panel: open the page once with ?admin=<ADMIN_KEY> (kept for this tab only) to run the war by hand
const adminKey = (() => {
  const q = new URLSearchParams(location.search);
  if (q.has("admin")) { sessionStorage.setItem("war-admin", q.get("admin")); history.replaceState(null, "", "/"); }
  return sessionStorage.getItem("war-admin");
})();
async function admin(act, ask) {
  if (ask && !confirm(ask)) return;
  const r = await fetch("/api/admin/" + act, { method: act === "status" ? "GET" : "POST", headers: { "x-admin-key": adminKey } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { $("#adm-msg").textContent = j.error || "failed: " + r.status; return; }
  drawAdmin(j, act === "rollback" ? `Turn ${j.rolledBack} rolled back.` : act === "newwar" ? `A new war; the old one is in ${j.archived}.` : "");
  if (act !== "status") { if (act === "newwar") { localStorage.removeItem("war-token"); token = null; } load(); }
}
function drawAdmin(st, msg = "") {
  const el = $("#admin"); el.hidden = false;
  el.innerHTML = `<h3>Admin</h3><p class="muted">Turn ${st.turn} · ${st.paused ? "paused" : "running"} · ${st.players} player${st.players === 1 ? "" : "s"}${st.bots ? `, ${st.bots} bots` : ""}</p>
    <div class="admin-buttons"><button data-a="tick">Tick now</button>${st.paused ? `<button data-a="resume">Resume</button>` : `<button data-a="pause">Pause</button>`}
    <button data-a="rollback" data-ask="Roll back turn ${st.turn}? Its battles and the orders given since go.">Roll back turn ${st.turn}</button>
    <button data-a="newwar" data-ask="End this war and start a new one? Everyone joins again.">New war</button></div><p class="muted" id="adm-msg">${esc(msg)}</p>`;
  el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => admin(b.dataset.a, b.dataset.ask));
}
if (adminKey) admin("status");
$("#signout").onclick = async () => { await api("/auth/logout", {}).catch(() => {}); V = null; load(); };
// a sign-in that went wrong comes back as ?signin=<what happened>
{ const q = new URLSearchParams(location.search); if (q.has("signin")) { $("#j-err").textContent = q.get("signin"); history.replaceState(null, "", "/"); } }
let resizeT = null;
addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => V && draw(), 150); });
setInterval(countdown, 1000);
setInterval(() => V && load(), 60000);
load();
