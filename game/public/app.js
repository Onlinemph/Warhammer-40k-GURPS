// The web client: draws what the server says this player can see and sends orders. It holds no hidden
// information; the server filters everything.
const $ = s => document.querySelector(s);
// signed in, the session cookie goes with every request by itself; a development join keeps a token in this browser
let token = localStorage.getItem("war-token"), V = null, sel = null, selR = null, ME = null;
const api = async (path, body) => {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// a named soldier's rank by battles survived (game/world/veterans.js)
const rankOf = b => b >= 10 ? "Legend" : b >= 6 ? "Hardened" : b >= 3 ? "Veteran" : b >= 1 ? "Blooded" : "Recruit";
const unitName = u => u && V.units[u] ? V.units[u].name : "";
function rosterHtml(me) {
  const L = me.leader, named = (me.named || []).slice().sort((a, b) => b.battles - a.battles), fallen = (me.memorial || []).slice().reverse();
  const row = n => `<li><b>${esc(n.name)}</b> · ${rankOf(n.battles)}${n.unit ? ", " + esc(unitName(n.unit)) : ""} · ${n.battles} battle${n.battles === 1 ? "" : "s"}${n.scars && n.scars.length ? ` · <span class="muted">${esc(n.scars.join(", "))}</span>` : ""}<br><small class="muted">${esc(n.how)}</small></li>`;
  return `<details${named.length ? " open" : ""}><summary>Roster: ${L ? esc(L.name) + " and " : ""}${named.length} named</summary>
    ${L ? `<p>Leader: <b>${esc(L.name)}</b> · ${rankOf(L.battles)} · ${L.battles} battles, ${L.wins} won · +${Math.round(Math.min(20, 10 + L.wins))}% in battle</p>` : ""}
    <ol class="feed">${named.map(row).join("") || "<li class='muted'>No one named yet: win a battle.</li>"}</ol></details>
    ${fallen.length ? `<details><summary>Memorial (${fallen.length})</summary><ol class="feed">${fallen.map(m => `<li><b>${esc(m.name)}</b>${m.leader ? " (leader)" : ""} · ${esc(m.rank)} · ${m.retired ? `went home on turn ${m.turn}` : `fell at ${esc(m.fell)} on turn ${m.turn}`}${m.letter ? `<br><i>${esc(m.letter)}</i>` : ""}</li>`).join("")}</ol></details>` : ""}`;
}
// the faction's politics: the Warmaster, the election, recall, contracts, the faction log (game/world/politics.js)
const payText = r => ["manpower", "materiel", "supply"].filter(k => r && r[k]).map(k => `${r[k]} ${k}`).join(", ") || "nothing";
function politicsHtml() {
  const P = V.politics, me = V.you.warband;
  if (!P) return "";
  const wm = P.warmaster, iAm = wm && wm.id === P.youAre, cand = P.candidates.some(c => c.id === P.youAre);
  const worlds = V.worlds.slice().sort((a, b) => a.name.localeCompare(b.name));
  return `<h3>Politics</h3>
    <p>Warmaster: <b>${wm ? esc(wm.name) : "none"}</b>${wm ? ` <small class="muted">(posted ${wm.record.posted}, paid ${wm.record.paid}, cancelled ${wm.record.cancelled})</small>` : ""} · next election on turn ${P.nextElection}</p>
    <p class="muted">Your service ${me.service} · treasury ${esc(payText(me.treasury))} · contracts done ${me.record.done}, failed ${me.record.failed}</p>
    <p>Candidates: ${P.candidates.map(c => `${esc(c.name)} (${c.votes} votes, ${c.service} service)${P.yourVote === c.id ? " ✓" : ` <button class="link" data-pol="vote" data-for="${c.id}">vote</button>`}`).join("; ") || "<span class='muted'>none yet</span>"}
    ${!cand && P.eligible && !iAm ? ` <button class="link" data-pol="stand">Stand for Warmaster</button>` : ""}</p>
    ${wm ? `<p class="muted">Recall: ${P.recall.yes} of ${P.recall.total} service wants ${esc(wm.name)} out (more than half recalls) <button class="link" data-pol="recall" data-yes="${!P.recall.you}">${P.recall.you ? "withdraw my recall vote" : "vote to recall"}</button></p>` : ""}
    <h3>Contracts</h3><ol class="feed">${P.contracts.map(k => `<li>${esc(k.text)} · <b>${esc(payText(k.reward))}</b> · by turn ${k.deadline}${k.offer ? ` · for ${esc(k.offer.name)}${k.accepted ? " (accepted)" : ""}` : " · open bounty"}${k.progress ? ` · your progress ${k.progress}` : ""}
      ${k.offer && k.offer.id === P.youAre && !k.accepted ? ` <button class="link" data-pol="accept" data-id="${k.id}">accept</button>` : ""}${iAm ? ` <button class="link" data-pol="cancel" data-id="${k.id}">cancel</button>` : ""}</li>`).join("") || "<li class='muted'>No contracts.</li>"}</ol>
    ${iAm ? `<details><summary>Warmaster: post a contract, set priorities</summary>
      <label>Kind <select id="k-kind"><option value="take">take a world</option><option value="hold">hold a world</option><option value="deliver">deliver supply to a depot</option><option value="break">break a tomb</option></select></label>
      <label>World <select id="k-world">${worlds.map(w => `<option value="${w.id}">${esc(w.name)}${w.owner ? " (" + esc(V.factions[w.owner].name) + ")" : ""}</option>`).join("")}</select></label>
      <label>Turns to hold <input type="number" id="k-turns" min="${P.limits.hold[0]}" max="${P.limits.hold[1]}" value="3"> · supply to deliver <input type="number" id="k-supply" min="1" max="200" value="30"></label>
      <label>Reward <input type="number" id="k-man" min="0" value="10"> manpower <input type="number" id="k-mat" min="0" value="20"> materiel <input type="number" id="k-sup" min="0" value="0"> supply</label>
      <label>Deadline in <input type="number" id="k-dl" min="1" max="${P.limits.deadline}" value="10"> turns · offer to <select id="k-offer"><option value="">anyone (open bounty)</option>${P.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join("")}</select></label>
      <button id="k-post">Post the contract</button>
      <label>Priority (double share): <select id="k-p1"><option value="">none</option>${P.members.map(m => `<option value="${m.id}"${P.priority[0] && P.priority[0].id === m.id ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
        <select id="k-p2"><option value="">none</option>${P.members.map(m => `<option value="${m.id}"${P.priority[1] && P.priority[1].id === m.id ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select> <button id="k-prio">Set</button></label></details>` : ""}
    <p class="err" id="pol-err"></p>
    <details><summary>Faction log</summary><ol class="feed">${P.log.map(l => `<li><b>Turn ${l.turn}</b> · ${esc(l.text)}</li>`).join("")}</ol></details>`;
}
async function pol(body) { try { await api("/api/politics", body); load(); } catch (e) { $("#pol-err").textContent = e.message; } }
function wirePolitics() {
  document.querySelectorAll("[data-pol]").forEach(b => b.onclick = () => pol({ action: b.dataset.pol, for: b.dataset.for, id: b.dataset.id, yes: b.dataset.yes === "true" }));
  if ($("#k-post")) $("#k-post").onclick = () => pol({ action: "post", contract: { kind: $("#k-kind").value, world: $("#k-world").value, turns: +$("#k-turns").value, supply: +$("#k-supply").value,
    deadline: +$("#k-dl").value, offer: $("#k-offer").value || null, reward: { manpower: +$("#k-man").value, materiel: +$("#k-mat").value, supply: +$("#k-sup").value } } });
  if ($("#k-prio")) $("#k-prio").onclick = () => pol({ action: "priority", warbands: [$("#k-p1").value, $("#k-p2").value].filter(Boolean) });
}
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
// a contested world's slices: each holder's share of its cities
function pie(cx, cy, r, split, col, op) {
  let a = -Math.PI / 2, out = "";
  for (const [f, s] of Object.entries(split).sort()) {
    if (s <= 0) continue;
    const b = a + s * 2 * Math.PI, p = t => `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
    out += `<path d="M${cx} ${cy} L${p(a)} A${r} ${r} 0 ${s > 0.5 ? 1 : 0} 1 ${p(b)} Z" fill="${col(f)}" opacity="${op}" pointer-events="none"/>`;
    a = b;
  }
  return out;
}
// the landing choice for a move: the regions the warband may land in on that world, the default first
function setLanding(id, pick) {
  const L = id && V.you.landing[id], w = id && V.worlds.find(x => x.id === id);
  $("#o-land-l").hidden = !L;
  if (!L) return;
  $("#o-land").innerHTML = L.may.map(rid => { const r = w.regions.find(x => x.id === rid), o = V.you.odds[id + "/" + rid]; return `<option value="${rid}"${rid === (pick || L.default) ? " selected" : ""}>${esc(r.name)} (${esc(V.terrains[r.terrain])}${r.capital ? ", the capital" : r.city ? ", a city" : ""}${o ? `; about ${o[0]}-${o[1]}%` : ""})</option>`; }).join("");
}
// the planet view: the picked world's regions (or your warband's world's), coloured by holder; cities are squares,
// the capital the biggest; your warband's region ringed, a battle waiting dashed red. Picking a region shows what's
// there and sets a march or a landing in the orders
function planet(W, me, col) {
  const w = W[sel || me.at], R = id => w.regions.find(r => r.id === id);
  let s = "";
  for (const r of w.regions) for (const l of r.links) if (r.id < l) s += `<line class="rlink" x1="${r.x}" y1="${r.y}" x2="${R(l).x}" y2="${R(l).y}"/>`;
  for (const r of w.regions) {
    const rad = r.capital ? 3.4 : r.city ? 2.6 : 1.8, c = col(r.owner), cls = `region${selR === r.id ? " sel" : ""}`;
    const n = r.forces ? r.forces.reduce((a, f) => a + Object.values(f.army).reduce((x, y) => x + y, 0), 0) : 0;
    const tip = `<title>${esc(r.name)}: ${esc(V.terrains[r.terrain])}${r.capital ? ", the capital" : r.city ? ", a city" : ""} · ${r.owner ? esc(V.factions[r.owner].name) : "unclaimed"}</title>`;
    s += r.city ? `<rect class="${cls}" data-r="${r.id}" x="${r.x - rad}" y="${r.y - rad}" width="${2 * rad}" height="${2 * rad}" rx="${r.capital ? .3 : .6}" fill="${c}">${tip}</rect>` : `<circle class="${cls}" data-r="${r.id}" cx="${r.x}" cy="${r.y}" r="${rad}" fill="${c}">${tip}</circle>`;
    if (me.at === w.id && me.region === r.id) s += `<circle class="here" cx="${r.x}" cy="${r.y}" r="${rad + 1.4}" style="stroke-width:.5;stroke-dasharray:1 .7"/>`;
    if (r.battle) s += `<circle class="rbattle" cx="${r.x}" cy="${r.y}" r="${rad + 2.2}"/>`;
    if (n) s += `<text class="rforce" x="${r.x}" y="${r.y + .65}" text-anchor="middle">${n}</text>`;
    s += r.city ? `<text class="rname" x="${r.x}" y="${r.y + rad + 2.4}" text-anchor="middle">${esc(r.name)}</text>` : `<text class="rground" x="${r.x}" y="${r.y + rad + 1.9}" text-anchor="middle">${esc(V.terrains[r.terrain])}</text>`;
  }
  const r = selR && R(selR), here = me.at === w.id, odds = r && V.you.odds[w.id + "/" + r.id];
  const canMarch = r && here && V.you.marches.includes(r.id), canLand = r && V.you.landing[w.id] && V.you.landing[w.id].may.includes(r.id);
  const owners = [...new Set(w.regions.map(x => x.owner))];
  $("#planet").innerHTML = `<h3>${esc(w.name)}: its regions</h3>
    <div class="legend">${owners.map(f => `<span><i style="background:${col(f)}"></i>${f ? esc(V.factions[f].name) : "unclaimed"}</span>`).join("")}<span class="muted">squares are cities, the biggest the capital; numbers are troops seen</span></div>
    <svg class="planet-map" viewBox="0 0 100 60" role="img" aria-label="Map of ${esc(w.name)}">${s}</svg>
    ${r ? `<p><b>${esc(r.name)}</b> · ${esc(V.terrains[r.terrain])}${r.capital ? ", the capital" : r.city ? ", a city" : ""} · ${r.owner ? esc(V.factions[r.owner].name) : "unclaimed"}${r.battle ? " · <span class='err'>a battle waits here</span>" : ""}</p>
      ${r.forces ? (r.forces.length ? `<table>${r.forces.map(f => `<tr><td>${esc(V.factions[f.faction].name)}${f.players.length ? " (" + f.players.map(esc).join(", ") + ")" : ""}</td><td>${f.rough ? "about " : ""}${armyText(f.army)}</td></tr>`).join("")}</table>` : "<p class='muted'>Nobody there.</p>") : "<p class='muted'>Your faction has no eyes here.</p>"}
      ${odds ? `<p>If your warband fights here: about <b>${odds[0]}-${odds[1]}%</b> to win.</p>` : ""}
      ${canMarch ? `<button id="p-march">March here next tick</button>` : canLand ? `<button id="p-land">Land here next tick</button>` : here && me.region === r.id ? "<p class='muted'>Your warband is here.</p>" : ""}<p class="muted" id="p-msg"></p>`
      : `<p class="muted">Pick a region on the map.</p>`}`;
  $("#planet").querySelectorAll(".region").forEach(c => c.onclick = () => { selR = c.dataset.r; draw(); });
  const set = () => { $("#p-msg").textContent = "Set in your orders below: send them before the tick."; };
  if ($("#p-march")) $("#p-march").onclick = () => { $("#o-move").value = ""; setLanding(null); $("#o-march").value = r.id; set(); };
  if ($("#p-land")) $("#p-land").onclick = () => { $("#o-march").value = ""; $("#o-move").value = w.id; setLanding(w.id, r.id); set(); };
}
function draw() {
  V.got = performance.now(); window.warView = V;
  const W = Object.fromEntries(V.worlds.map(w => [w.id, w])), col = f => f ? V.factions[f].colour : "#8d887e";
  const me = V.you.warband;
  let svg = "";
  for (const w of V.worlds) for (const l of w.links) if (w.id < l) svg += `<line class="lane" x1="${w.x}" y1="${w.y}" x2="${W[l].x}" y2="${W[l].y}"/>`;
  for (const w of V.worlds) {
    const n = w.forces ? w.forces.reduce((a, f) => a + Object.values(f.army).reduce((x, y) => x + y, 0), 0) : null;
    svg += `<circle class="world${sel === w.id ? " sel" : ""}" data-id="${w.id}" cx="${w.x}" cy="${w.y}" r="${w.capital ? 13 : 10}" fill="${col(w.owner)}" opacity="${w.seen ? 1 : .55}"><title>${esc(w.name)}${w.contested ? " (contested)" : ""}</title></circle>`;
    // a contested world: its cities' holders as slices
    if (w.contested) svg += pie(w.x, w.y, w.capital ? 12 : 9, w.split, f => col(f === "militia" ? null : f), w.seen ? 1 : .55);
    if (me.at === w.id) svg += `<circle class="here" cx="${w.x}" cy="${w.y}" r="19"/>`;
  }
  $("#map").innerHTML = svg + labels(W, me);
  $("#map").querySelectorAll(".world").forEach(c => c.onclick = () => { if (sel !== c.dataset.id) selR = null; sel = c.dataset.id; draw(); });
  const myR = W[me.at].regions.find(r => r.id === me.region) || {};
  planet(W, me, col);
  const st = Object.entries(V.you.stock).map(([k, v]) => `${Math.floor(v)} ${k}`).join(" · ");
  // the faction's own business: the Hegemony's edict, a ritual under way, a Brawl warband growing restless
  const ed = V.you.edict, rit = me.ritual, idle = V.turn - (me.lastFight ?? V.turn);
  const heldHtml = (V.held || []).map(h => `<p class="${h.done ? "muted" : "err"}">${h.done ? `The battle at ${esc(h.region || "")} on ${esc(h.world)} is fought; it counts at the next tick.` : `A battle at <b>${esc(h.region || "")}</b> on <b>${esc(h.world)}</b> waits for you. <a class="link" href="/sim#live=${encodeURIComponent(h.id)}" target="_blank" rel="noopener">Fight it</a> before the next tick, or the war settles it.`}</p>`).join("");
  const own = heldHtml + (ed ? `<p><b>Edict:</b> ${esc(ed.text)}, by turn ${ed.until}${ed.kind === "hold" ? ` (held ${ed.held} of 5)` : ""}</p>` : "") +
    (rit ? `<p><b>${esc(V.you.rituals[rit.kind].name)}</b> under way at ${esc(W[rit.at].name)}${rit.target ? " against " + esc(W[rit.target].name) : ""}, done on turn ${rit.done} if the world isn't fought over</p>` : "") +
    (V.you.faction === "brawl" && idle >= 3 ? `<p class="err">The lads are restless: no fight for ${idle} turns${idle >= 4 ? ", and they're fighting each other" : ""}</p>` : "");
  $("#me").innerHTML = `<h2>${esc(V.you.name)}</h2><p>${esc(V.factions[V.you.faction].name)} · stockpile: ${esc(st)}</p>
    <p>Warband at <b>${esc(myR.name || "")}</b> on <b>${esc(W[me.at].name)}</b>${me.supplied ? "" : " · <span class='err'>out of supply</span>"}<br>${armyText(Object.fromEntries(Object.entries(me.army).map(([k, n]) => [V.units[k] ? V.units[k].name : k, n])))}</p>
    <p class="muted">Eats ${me.eats ?? 0} supply a turn${me.short ? " · <span class='err'>short of supply: fights at x0.8</span>" : ""}${me.depotFed ? " · fed from a depot" : ""}</p>
    <p class="muted">Stance: ${esc(me.stance || "advance")}${me.careful ? ", turning back from bad odds" : ""}</p>
    ${me.orders ? `<p class="muted">Orders in: ${me.orders.move ? "move to " + esc(W[me.orders.move].name) + (me.orders.land ? ", landing at " + esc((W[me.orders.move].regions.find(r => r.id === me.orders.land) || {}).name || "") : "") : me.orders.region ? "march to " + esc((W[me.at].regions.find(r => r.id === me.orders.region) || {}).name || "") : "hold"}${me.orders.recruit.length ? ", recruit " + me.orders.recruit.map(r => r.count + " " + esc(V.units[r.unit].name)).join(", ") : ""}</p>` : ""}
    ${own}${rosterHtml(me)}${me.history.some(h => h.startsWith(`Turn ${V.turn}:`)) ? `<ul class="feed">${me.history.filter(h => h.startsWith(`Turn ${V.turn}:`)).map(h => `<li>${esc(h.replace(/^Turn \d+: /, ""))}</li>`).join("")}</ul>` : ""}<details><summary>History</summary><ol class="feed">${me.history.slice().reverse().map(h => `<li>${esc(h)}</li>`).join("")}</ol></details>`;
  const w = sel && W[sel];
  $("#world").innerHTML = w ? `<h3>${esc(w.name)}</h3><p>${esc(w.typeName)}${w.capital ? ", a capital" : ""}${w.asleep ? ", its tomb asleep" : w.asleep === false ? ", its tomb awake" : ""}${w.gate ? ", a gate" : ""}${w.walls ? `, walls level ${w.walls}` : ""}${w.depot ? `, a depot${w.depot.supply != null ? ` (${w.depot.supply} supply)` : ""}` : ""}${w.blockaded ? ", <span class='err'>blockaded</span>" : ""} · ${w.owner ? esc(V.factions[w.owner].name) : "unclaimed"}${w.contested ? ` · <b>contested</b>: ${Object.entries(w.split).sort((a, b) => b[1] - a[1]).map(([f, s]) => `${esc(V.factions[f].name)} ${Math.round(s * 100)}%`).join(", ")} of its cities` : ""}${w.loyalty != null ? ` · loyalty ${w.loyalty}` : ""}${w.held != null ? ` · held ${w.held} turns` : ""}</p>
    ${w.convoys && w.convoys.length ? `<p>Convoys here: ${w.convoys.map(c => `${esc(V.factions[c.faction].name)} to ${esc(c.to)}${c.supply != null ? ` (${c.supply} supply)` : ""}`).join("; ")}</p>` : ""}${V.you.odds[w.id] != null ? `<p>If your warband lands here (${esc((w.regions.find(r => r.id === V.you.landing[w.id].default) || {}).name || "")}): about <b>${V.you.odds[w.id][0]}-${V.you.odds[w.id][1]}%</b> to win against the strongest force there, before the leaders' contest.</p>` : ""}
    <p class="muted">${w.regions.length} regions, ${w.regions.filter(r => r.city).length} cities; it falls to whoever holds its capital and more than half its cities. Its map is below.</p>${w.terrain && w.terrain.length ? `<p class="muted">Ground: ${esc(w.terrain.join(", "))}</p>` : ""}${w.forces ? (w.forces.length ? `<table>${w.forces.map(f => `<tr><td>${esc(V.factions[f.faction].name)}${f.players.length ? " (" + f.players.map(esc).join(", ") + ")" : ""}</td><td>${f.rough ? "about " : ""}${armyText(f.army)}</td></tr>`).join("")}</table>` : "<p class='muted'>Nobody there.</p>") : "<p class='muted'>Your faction has no eyes here.</p>"}` : `<p class="muted">Pick a world on the map.</p>`;
  const here = W[me.at];
  $("#orders").innerHTML = `<h3>Orders for the next tick</h3>
    <label>Stance <select id="o-stance">${[["advance", "Advance: go where sent, take what you win"], ["fortify", "Fortify: stay, and fight harder on your own world"], ["raid", "Raid: strike, loot, come back"]].map(([k, t]) => `<option value="${k}"${(me.stance || "advance") === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>
    <label><input type="checkbox" id="o-command"${me.command ? " checked" : ""}> Command my warband's battles in person (each is held until the next tick for you to fight; unfought, the war settles it)</label>
    <label><input type="checkbox" id="o-careful"${me.careful ? " checked" : ""}> Turn back if the odds are under ${V.you.turnBack}%</label>
    ${here.owner === V.you.faction && !here.depot ? `<label><input type="checkbox" id="o-depot"> Build a depot at ${esc(here.name)} (${V.you.depot.cost} materiel; holds up to ${V.you.depot.cap} supply)</label>` : ""}
    ${here.owner === V.you.faction && (here.capital || here.depot) && V.worlds.some(t => t.owner === V.you.faction && t.depot && t.id !== here.id) ? `<label>Send a convoy to <select id="o-cv-to"><option value="">none</option>${V.worlds.filter(t => t.owner === V.you.faction && t.depot && t.id !== here.id).map(t => `<option value="${t.id}">${esc(t.name)} (${t.depot.supply} there)</option>`).join("")}</select> with <input type="number" id="o-cv-n" min="1" max="${V.you.convoyMax}" value="${V.you.convoyMax}"> supply</label>` : ""}
    ${here.owner === V.you.faction && here.walls < V.you.walls.max ? `<label><input type="checkbox" id="o-walls"> Raise the walls of ${esc(here.name)} to level ${here.walls + 1} (${V.you.walls.cost[here.walls]} materiel)</label>` : ""}
    <label>March <select id="o-march"${rit ? " disabled" : ""}><option value="">Stay at ${esc(myR.name || "")}</option>${V.you.marches.map(id => { const r = here.regions.find(x => x.id === id), o = V.you.odds[here.id + "/" + id]; return `<option value="${id}">to ${esc(r.name)} (${esc(V.terrains[r.terrain])}${r.city ? ", a city" : ""}${o ? `; fight there: about ${o[0]}-${o[1]}%` : ""})</option>`; }).join("")}</select></label>
    <label>Or move to another world <select id="o-move"${rit ? " disabled" : ""}><option value="">Stay on ${esc(here.name)}</option>${V.you.moves.map(l => `<option value="${l}">${here.links.includes(l) ? "to" : "through the gate to"} ${esc(W[l].name)}${V.you.odds[l] != null ? ` (fight where you'd land: about ${V.you.odds[l][0]}-${V.you.odds[l][1]}% to win)` : ""}</option>`).join("")}</select></label>
    <label id="o-land-l" hidden>Landing at <select id="o-land"></select></label>
    ${V.you.rituals && here.owner === V.you.faction && !rit ? `<label>Ritual <select id="o-rit"><option value="">none</option>${Object.entries(V.you.rituals).map(([k, r]) => k === "corrupt"
      ? here.links.map(l => W[l]).filter(t => t.owner === "hegemony" && !t.capital).map(t => `<option value="corrupt:${t.id}">${r.name} against ${esc(t.name)}${t.loyalty != null ? " (loyalty " + t.loyalty + ")" : ""}, ${r.captives} captives</option>`).join("")
      : `<option value="${k}">${r.name}, ${r.captives} captives</option>`).join("")}</select></label>` : ""}
    ${myR.city && myR.owner === V.you.faction ? [["line", "Line troops"], ["troops", "Troops"], ["special", "Special weapons"], ["heavy", "Heavy weapons"], ["specialist", "Specialists"], ["elite", "Elites"]].map(([role, title]) => {
      const list = Object.entries(V.units).filter(([, u]) => u.role === role);
      if (!list.length) return "";
      return `<fieldset class="recruit"><legend>${title}${role === "special" ? ` <small class="muted">(special and heavy: ${V.specials.have} of ${V.specials.cap}, one for every ten line troops)</small>` : ""}</legend>${list.map(([k, u]) => `<label>${esc(u.name)} <small class="muted">(${Object.entries(u.cost).map(([r, c]) => c + " " + r).join(", ")} each)</small> <input type="number" min="0" value="0" data-unit="${k}"></label>`).join("")}</fieldset>`;
    }).join("") : "<p class='muted'>Recruits only come from cities you hold.</p>"}
    <button id="o-go">Send orders</button><p class="err" id="o-err"></p>`;
  $("#o-move").onchange = () => setLanding($("#o-move").value, null);
  $("#o-go").onclick = async () => {
    try {
      const recruit = [...document.querySelectorAll("[data-unit]")].map(i => ({ unit: i.dataset.unit, count: +i.value })).filter(r => r.count > 0);
      const rv = $("#o-rit") ? $("#o-rit").value : "", [kind, target] = rv.split(":");
      const move = $("#o-move").value || null;
      await api("/api/orders", { move, land: move ? $("#o-land").value || null : null, region: move ? null : $("#o-march").value || null, recruit, ritual: rv ? { kind, target: target || null } : null,
        stance: $("#o-stance").value, careful: $("#o-careful").checked, command: $("#o-command").checked,
        build: $("#o-depot") && $("#o-depot").checked ? "depot" : $("#o-walls") && $("#o-walls").checked ? "walls" : null,
        convoy: $("#o-cv-to") && $("#o-cv-to").value ? { to: $("#o-cv-to").value, supply: +$("#o-cv-n").value } : null }); load();
    } catch (e) { $("#o-err").textContent = e.message; }
  };
  $("#reports").innerHTML = V.reports.map((r, i) => `<li><b>Turn ${r.turn}</b> · ${esc(r.text)} ${r.id ? `${r.tmc ? `<button class="link" data-hex="${esc(r.id)}">On the map</button> ` : ""}<button class="link" data-rep="${i}">Watch</button> <a class="link" href="/sim#war=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">Watch in 3D</a>` : ""}</li>`).join("") || "<li class='muted'>No battles yet.</li>";
  $("#reports").querySelectorAll("[data-rep]").forEach(b => b.onclick = () => openReplay(V.reports[+b.dataset.rep].id, V.reports[+b.dataset.rep]));
  $("#reports").querySelectorAll("[data-hex]").forEach(b => b.onclick = () => window.openHexBattle(b.dataset.hex));
  $("#politics").innerHTML = politicsHtml(); wirePolitics();
  // the highlight feed: this turn's best battles your faction knows of, why, and a mark for the ones worth watching
  const HLV = V.highlights;
  $("#highlights").innerHTML = `<h3>Highlights, turn ${HLV.turn}</h3><ol class="feed">${HLV.list.map(h => `<li${h.mine ? ' class="mine"' : ""}><b>${esc(h.world)}</b>${h.mine ? " · yours" : ""} · ${esc(h.why.join("; ") || "a fight")}
    <br><button class="link" data-hxw="${esc(h.id)}">On the map</button> <button class="link" data-hlw="${esc(h.id)}">Watch</button> <a class="link" href="/sim#war=${encodeURIComponent(h.id)}" target="_blank" rel="noopener">in 3D</a> · ${h.votes} mark${h.votes === 1 ? "" : "s"}${h.voted ? " (yours)" : ` <button class="link" data-hlv="${esc(h.id)}">worth watching</button>`}</li>`).join("") || "<li class='muted'>No battles this turn.</li>"}</ol>`;
  $("#highlights").querySelectorAll("[data-hlw]").forEach(b => b.onclick = () => { const r = V.reports.find(x => x.id === b.dataset.hlw) || { id: b.dataset.hlw }; openReplay(r.id, r); });
  $("#highlights").querySelectorAll("[data-hxw]").forEach(b => b.onclick = () => window.openHexBattle(b.dataset.hxw));
  $("#highlights").querySelectorAll("[data-hlv]").forEach(b => b.onclick = async () => { try { await api("/api/upvote", { report: b.dataset.hlv }); load(); } catch (e) { b.textContent = e.message; } });
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
