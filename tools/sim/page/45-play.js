  // ================= playing a battle yourself
  // SIM.playBattle gives a stepper that stops at the start of each second (orders to whole units) and at the turn
  // of each model commanded directly (a choice among the options the AI would weigh for it). This shows each stop
  // in the table's Orders pane, plays what happened since the last one, and feeds the answer back.
  let game = null;

  // the options in plain words: name, and what the maneuver costs or gives (Basic Set pages in docs/simulator.md)
  const ACT = {
    "aoa-fire": ["All-Out Attack: fire", "+1 to hit, no defence until its next turn"], aim: ["Aim", "Acc next turn, more if it keeps aiming"],
    "advance-fire": ["Move and fire", "Move and Attack: skill capped at 9, no Acc"], "move-closer": ["Move closer", "a full Move toward it"], advance: ["Advance on", "a full Move toward a firing position"],
    hold: ["Hold fire on", "keep the aim, shoot when the shot improves"], watch: ["Watch for", "Wait: shoot it when it shows itself"], wait: ["Wait for", "shoot it as it comes"], "wait-melee": ["Wait for", "strike it as it comes into reach"],
    "fire-through": ["Fire through the cover at", "the cover's DR comes off the damage"], popup: ["Pop up and fire at", "from cover and back, -2"], "popup-trench": ["Fire from the trench at", "pop up, fire, duck"],
    indirect: ["Indirect fire on", "lobbed over what's between"], "point-blank": ["Shoot point-blank at", "in close combat: Bulk counts"], "aoa-point-blank": ["All-Out Attack: shoot point-blank", "+1, no defence"],
    charge: ["Charge", "Move and Attack: skill capped at 9"], "aoa-charge": ["All-Out charge", "full move and strike, no defence"], "heroic-charge": ["Heroic Charge", "a full move and a full attack, for FP"],
    close: ["Close in on", "a full Move toward it"], flank: ["Go round to its flank", "a Move to a hex it defends badly from"],
    "step-strike": ["Step and strike", "an Attack after one step"], "step-aoa": ["Step and All-Out Attack", "no defence"], "step-grab": ["Step and grapple", ""],
    mighty: ["Mighty Blow", "1 FP for +2 damage or +1 a die"], rapid: ["Rapid Strike", "two blows at -6 each"], flurry: ["Flurry of Blows", "Rapid Strike at -3 each, 1 FP a blow"],
    "aoa-det": ["All-Out Attack (Determined)", "+4 to hit, no defence"], "aoa-double": ["All-Out Attack (Double)", "two blows, no defence"], "aoa-strong": ["All-Out Attack (Strong)", "+2 damage or +1 a die, no defence"],
    "aoa-feint": ["All-Out Attack (Feint)", "a feint and a blow, no defence"], "aoa-rapid": ["All-Out Attack with a Rapid Strike", "three blows, no defence"], "rapid-feint": ["Feint and strike", "a Rapid Strike: feint, then the blow"],
    "ca-det": ["Committed Attack (Determined)", "+2 to hit, defences at -2"], "ca-strong": ["Committed Attack (Strong)", "+1 damage, defences at -2"], "ca-flyout": ["Committed Attack with two steps", "defences at -2"],
    "da-strike": ["Defensive Attack", "less damage, +1 to a defence"], feint: ["Feint", "a contest of skill: its margin comes off the foe's defence next turn"], ruse: ["Ruse", "a feint on IQ"], beat: ["Beat", "a feint on ST: knock its guard aside"],
    dfeint: ["Defensive Feint", "its margin comes off the foe's next attack"], evaluate: ["Evaluate", "+1 to hit it next turn, up to +3"], dual: ["Dual-Weapon Attack", "both weapons, -4 each"],
    grab: ["Grapple", "seize it"], "grab-gun": ["Grab its gun", "hold the muzzle aside"], shove: ["Shove", "push it back"], trample: ["Trample", "walk over it"], hook: ["Flesh hooks", "strike and drag it in"],
    "reload-cc": ["Reload", "in close combat"], reload: ["Reload", ""], reloading: ["Keep reloading", ""], "tac-reload": ["Reload now", "a fresh magazine before the fighting starts again"], "reload-cover": ["Step out of sight and reload", ""],
    throw: ["Throw the grenade", ""], "ready-grenade": ["Ready a grenade", "a Ready; thrown next turn"], suppress: ["Suppression fire", "All-Out Attack: spray a zone, no defence"],
    "ready-blade": ["Ready the melee weapon", "a Ready"], "ready-gun": ["Ready the gun", "a Ready"], "re-ready-gun": ["Bring the gun back to bear", "a Ready"], "draw-early": ["Draw the melee weapon now", "before the foe arrives"], "draw-knife": ["Draw the knife", "for close combat"],
    concentrate: ["Concentrate", "on a psychic power"], orders: ["Give orders", "Leadership: steadies the squad's Fright Checks"], "wrench-gun": ["Wrench the gun free", ""], "break-free": ["Break free", "of the hold"],
    aod: ["All-Out Defense", "+2 to one defence, no attack"], peel: ["Fall back out of sight", ""], "lie-low": ["Go to ground", "stay down out of the fire"], "heads-down": ["Keep its head down", ""], "beat-flames": ["Beat out the flames", ""],
    "close-door": ["Close the door", ""], breach: ["Breach the wall", "blows or shots at it"], "breach-grenade": ["Breach the wall with a grenade", ""], spread: ["Spread out", "away from squad-mates, against blasts"],
    cover: ["Take cover", "move to the hex marked"], "high-ground": ["Make for the high ground", ""], "setting-up": ["Keep setting up the weapon", ""], "set-up": ["Set up the weapon", ""], "pack-up": ["Pack up the weapon", "to move it"],
    rejoin: ["Rejoin", "move back to the squad"], "fall-back": ["Fall back", "run from a foe nothing it has can hurt"], hunt: ["Work round it", "run for a face of the vehicle its weapons can get through"], stand: ["Turn at bay", "it can't outrun the foe: fight or defend where it stands"], "take-cover": ["Get out of the line of fire", "nothing it has can hurt the foe"], search: ["Search ahead", "no enemy in sight: move toward where one was last seen, or deeper in"], "take-over": ["Take over the weapon", ""], pass: ["Hold", "do nothing this second"],
  };
  const STANCE = { shoot: "Hold and shoot", advance: "Advance", charge: "Charge" };
  function optText(label) {
    let m = /^(fire|strike|step-fire) (.*)@(.*)$/.exec(label);
    if (m) return { kind: m[1], name: (m[1] === "fire" ? "Fire the " : m[1] === "step-fire" ? "Step clear and fire the " : "Strike with the ") + m[2].split(",")[0], note: m[1] === "step-fire" ? "an Attack with its step, out of a friend's way" : "an Attack", target: m[3], hex: null };
    m = /^([^@]+)@(.*)$/.exec(label);
    const kind = m ? m[1] : label, at = m ? m[2] : null, hex = !!at && /^-?\d+,-?\d+$/.test(at), A = ACT[kind];
    return { kind, name: A ? A[0] : kind.replace(/-/g, " ").replace(/^./, c => c.toUpperCase()), note: A ? A[1] : "", target: at && !hex ? at : null, hex: hex ? at.split(",").map(Number) : null };
  }
  // every setting the picker holds, as the engine takes them (the simulation and a played battle share it)
  function battleSetup() {
    return { specs: S.sides.flatMap((units, si) => units.map(u => ({ side: si, spec: u }))),
      opts: { distance: S.distance, maxTurns: S.maxTurns, morale: S.morale, health: S.health, boxes: S.boxes || 5,
        locations: S.locations || "elite", cover: [S.coverA || "none", S.coverB || "none"], battlefield: S.battlefield || "open", mapSeed: S.mapSeed || 1,
        ridge: !MAPPED() && S.ridge ? { side: +S.ridge, height: S.ridgeH || 8 } : null,
        awareness: MAPPED() ? S.awareness || "limited" : undefined, lighting: S.lighting || "mixed", sightedShots: !!S.sightedShots, tacticalDodge: !!S.tacticalDodge, limitedDodges: S.limitedDodges !== false, cinematicEffort: S.cinematicEffort !== false } };
  }
  const hexD = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[0] + a[1] - b[0] - b[1])) / 2;
  const ordEl = () => document.getElementById("vtt-orders");

  function playShell() {
    const me = "AB"[game.side], foe = "AB"[1 - game.side];
    return `<h2>Your battle<small>you command Side ${me}; the AI plays Side ${foe}</small></h2>
      ${tableHtml(0, true)}
      <p class="rleg">The battle stops when it needs you and the Orders pane says what for. On a model's turn, click an enemy to pick it as the target and then what to do to it, click an empty hex to move there, or press <b>Enter</b> for the AI's own choice; the number keys pick from the list. The bar under each choice is how the AI rates it. Everything before now can be played back with the controls under the map; orders are taken only at the newest moment.</p>
      <details class="more" id="playlog-d"><summary>Blow-by-blow so far</summary><pre class="slog" id="playlog"></pre></details>`;
  }

  function startGame() {
    const { specs, opts } = battleSetup(), side = +S.playSide || 0;
    if (!S.sides[0].length || !S.sides[1].length) { $("#simout").innerHTML = `<p class="empty">Add at least one unit to each side.</p>`; return; }
    let gen, step;
    try { gen = SIM.playBattle(specs, { ...opts, seed: Math.floor(Math.random() * 2147483647), human: { side, direct: S.playCtl === "squads" ? [] : "all" } }); step = gen.next(); }
    catch (e) { $("#simout").innerHTML = `<p class="empty">Could not start: ${esc(e.message)}</p>`; return; }
    last = null;
    if (vtt) vtt.stop();
    // pause: stop at each second for orders to units (always on while no model is commanded directly, or the battle
    // would run to its end untouched); autoTurn: the second the AI was asked to finish
    game = { gen, step, side, pause: S.playCtl === "squads", autoTurn: -1, target: null, waiting: false, cur: null, view: step.done ? step.value : step.value.view };
    $("#simout").innerHTML = playShell();
    vtt = makeTable(game.view, document.getElementById("vtt-c"), { onMap: mapClick });
    const d = document.getElementById("playlog-d");
    if (d) d.ontoggle = () => { if (d.open) document.getElementById("playlog").textContent = game ? game.view.log.join("\n") : ""; };
    ordEl().onclick = ordersClick; ordEl().onmouseover = ordersHover; ordEl().onchange = ordersChange;
    document.removeEventListener("keydown", playKey); document.addEventListener("keydown", playKey);
    const box = document.getElementById("vtt"); if (box && box.scrollIntoView) box.scrollIntoView({ block: "nearest" });
    ask();
  }
  const endGame = () => { game = null; document.removeEventListener("keydown", playKey); };

  // answer the stop the battle is at and run it on to the next one that needs the player
  function go(ans) {
    const G = game; if (!G || G.step.done || !G.waiting) return;
    G.waiting = false; G.cur = null; G.said = G.view.log.length;
    const from = G.view.frames.length - 1;
    try {
      let step = G.gen.next(ans);
      while (!step.done) {
        const v = step.value;
        if ((v.type === "turn" && !G.pause && v.units.some(u => u.side === G.side && u.direct && u.up > 0)) || (v.type === "act" && G.autoTurn === v.turn)) step = G.gen.next(null);
        else break;
      }
      G.step = step;
    } catch (e) { ordEl().innerHTML = `<p class="vtt-empty">The battle stopped on an error: ${esc(e.message)}</p>`; if (window.console) console.error(e); return; }
    vtt.st.mark = null;
    vtt.grow(G.step.done ? G.step.value : G.step.value.view);
    ordEl().innerHTML = `<p class="vtt-empty">The fighting goes on…</p>`;
    vtt.catchUp(ask, from);
  }

  function ask() {
    const G = game, el = ordEl(); if (!G || !el) return;
    G.waiting = true; vtt.showTab("orders");
    if (G.step.done) return showEnd(el, G.step.value);
    const v = G.step.value;
    if (v.type === "turn") showTurn(el, v); else { G.target = null; showAct(el, v); }
  }

  function showTurn(el, v) {
    const G = game, mine = v.units.filter(u => u.side === G.side && u.up > 0);
    const anyDirect = mine.some(u => u.direct);
    let sq = null;
    el.innerHTML = `<div class="ord"><p class="ord-k">Second ${v.turn} · orders to your units</p>
      <div class="ord-all"><span>All units</span>${Object.entries(STANCE).map(([k, n]) => `<button type="button" data-all="${k}">${n}</button>`).join("")}</div>
      ${mine.map(u => { const head = u.squadName && u.squadName !== sq ? `<h4>${esc(u.squadName)}</h4>` : ""; sq = u.squadName || sq;
        const nm = u.squadName && u.name.startsWith(u.squadName + " ") ? u.name.slice(u.squadName.length + 1) : u.name;
        return `${head}<div class="ord-u" data-u="${u.idx}"><b>${esc(nm)}</b><small>${u.up} of ${u.count}</small>
          <select data-st aria-label="Standing order for ${esc(u.name)}">${Object.entries(STANCE).map(([k, n]) => `<option value="${k}"${k === u.stance ? " selected" : ""}>${n}</option>`).join("")}</select>
          ${u.veh ? "" : `<label><input type="checkbox" data-dir${u.direct ? " checked" : ""}> command each model</label>`}</div>`; }).join("")}
      <button type="button" class="ord-ai" data-fight><span>Fight this second</span><kbd>Enter</kbd></button>
      ${recap()}
      <label class="ord-p"><input type="checkbox" data-pause${G.pause || !anyDirect ? " checked" : ""}> Stop for these orders every second</label>
      <p class="ord-h">Hold and shoot keeps a unit where it is, firing. Advance moves it up by fire and movement. Charge sends it in hand to hand. A unit you command model by model stops for you at each model's turn.</p></div>`;
    vtt.st.mark = null; vtt.redraw();
  }
  const turnAnswer = () => {
    const units = {};
    ordEl().querySelectorAll(".ord-u").forEach(row => { const d = row.querySelector("[data-dir]"); units[row.dataset.u] = { stance: row.querySelector("[data-st]").value, direct: d ? d.checked : false }; });
    const p = ordEl().querySelector("[data-pause]"); game.pause = !!(p && p.checked);
    return { units };
  };

  function showAct(el, v) {
    const G = game, ros = G.view.roster, f = G.view.frames[G.view.frames.length - 1] || [];
    const ixOf = new Map(ros.map((r, i) => [r.id, i]));
    const opts = v.opts.map(o => ({ ...o, ...optText(o.label) }));
    const byT = new Map(), free = [];
    for (const o of opts) { if (o.target && ixOf.has(o.target)) { if (!byT.has(o.target)) byT.set(o.target, []); byT.get(o.target).push(o); } else free.push(o); }
    for (const l of [free, ...byT.values()]) l.sort((a, b) => b.v - a.v);
    const hi = Math.max(...opts.map(o => o.v)), lo = Math.min(...opts.map(o => o.v)), bar = o => Math.round(100 * (hi > lo ? (o.v - lo) / (hi - lo) : 1));
    const ai = opts[v.pick] || null;
    const targets = [...byT.keys()].sort((a, b) => byT.get(b)[0].v - byT.get(a)[0].v);
    if (!G.target || !byT.has(G.target)) G.target = ai && ai.target && byT.has(ai.target) ? ai.target : targets[0] || null;
    const distTo = id => { const x = f[ixOf.get(id)]; return x ? hexD(v.at, x) : null; };
    const list = G.target ? byT.get(G.target) : [];
    G.cur = { v, opts, byT, ixOf, list };
    const btn = (o, n) => `<button type="button" data-i="${o.i}"${o === ai ? ' class="ai"' : ""}><span>${n != null && n < 9 ? `<kbd>${n + 1}</kbd>` : ""}${esc(o.name)}${o === ai ? "<em>AI</em>" : ""}</span>${o.note ? `<small>${esc(o.note)}</small>` : ""}<i style="width:${bar(o)}%"></i></button>`;
    el.innerHTML = `<div class="ord"><p class="ord-k">Second ${v.turn} · your move</p><h3>${esc(v.id)}</h3>
      <button type="button" class="ord-ai" data-ai><span>${ai ? `${esc(ai.name)}${ai.target ? " · " + esc(ai.target) : ""}` : "Let the AI choose"}<small>the AI's choice</small></span><kbd>Enter</kbd></button>
      ${targets.length ? `<h4>Target</h4><div class="ord-ts">${targets.slice(0, 40).map(id => { const d = distTo(id); return `<button type="button" data-t="${esc(id)}" aria-pressed="${id === G.target}">${esc(id)}${d != null ? `<small>${d} yd</small>` : ""}</button>`; }).join("")}</div>
      <h4>Against ${esc(G.target)}</h4><div class="ord-as">${list.map((o, n) => btn(o, n)).join("")}</div>` : ""}
      ${free.length ? `<h4>${targets.length ? "Or" : "It can"}</h4><div class="ord-as">${free.map(o => btn(o, null)).join("")}</div>` : ""}
      <p class="ord-h">Click an enemy on the map to pick it as the target. Click an empty hex to move there: up to ${v.move} yard${v.move === 1 ? "" : "s"} this second.</p>
      <div class="ord-x"><button type="button" data-auto>AI plays the rest of this second</button><button type="button" data-rel>Give this unit back to the AI</button><button type="button" data-units aria-pressed="${G.pause}">Unit orders next second</button></div>
      ${recap()}</div>`;
    marks(null); vtt.st.sel = v.ix; vtt.redraw(); vtt.focus(v.ix);
  }
  // what has happened since the player last gave an order, newest last (the Log pane has each moment's in full)
  function recap() {
    const G = game, log = G.view.log, lines = log.slice(G.said || 0).filter(l => !/^— Turn/.test(l) && !l.startsWith("  "));
    if (!lines.length) return "";
    return `<h4>Since your last order</h4><ul class="ord-log">${lines.slice(-14).map(l => `<li>${esc(l)}</li>`).join("")}</ul>`;
  }
  // rings on the map: whose turn it is, the target picked, and where the option under the pointer (or the AI's) ends
  function marks(o) {
    const G = game, c = G && G.cur; if (!c) return;
    const f = G.view.frames[G.view.frames.length - 1] || [], rings = [[c.v.at[0], c.v.at[1], "#ffffff"]];
    const t = G.target != null ? f[c.ixOf.get(G.target)] : null;
    if (t) rings.push([t[0], t[1], "#ff5a4a"]);
    const d = o || c.opts[c.v.pick], to = d && (d.to || d.hex);
    if (to) rings.push([to[0], to[1], "#6fdc7a"]);
    vtt.st.mark = { rings, range: [c.v.at[0], c.v.at[1], c.v.move] };
  }

  function showEnd(el, r) {
    const G = game, won = r.winner === G.side, lost = r.winner === 1 - G.side;
    const line = u => `<li class="s${u.side ? "b" : "a"}"><b>${esc(u.name)}</b><span>${u.standing} of ${u.count} standing · ${u.kills} kill${u.kills === 1 ? "" : "s"}${u.routed ? " · broke" : ""}</span></li>`;
    el.innerHTML = `<div class="ord"><p class="ord-k">The battle is over · ${r.turns} second${r.turns === 1 ? "" : "s"}</p>
      <h3>${won ? "Victory" : lost ? "Defeat" : r.timeout ? "Time ran out" : "Mutual ruin"}</h3>
      <ul class="ord-end">${r.units.map(line).join("")}</ul>
      <button type="button" class="ord-ai" data-again><span>Play it again</span></button>
      <p class="ord-h">The controls under the map play the whole battle back, in 2D or 3D.</p></div>`;
    vtt.st.mark = null; vtt.redraw();
    const d = document.getElementById("playlog-d"); if (d && d.open) document.getElementById("playlog").textContent = r.log.join("\n");
  }

  function ordersClick(e) {
    const G = game; if (!G) return;
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.again != null) { startGame(); return; }
    if (!G.waiting || G.step.done) return;
    const v = G.step.value;
    if (b.dataset.all) { ordEl().querySelectorAll("[data-st]").forEach(s => { s.value = b.dataset.all; }); return; }
    if (b.dataset.fight != null) return go(turnAnswer());
    if (v.type !== "act") return;
    if (b.dataset.t != null) { G.target = b.dataset.t; showAct(ordEl(), v); return; }
    if (b.dataset.ai != null) return go(null);
    if (b.dataset.i != null) return go({ i: +b.dataset.i });
    if (b.dataset.auto != null) { G.autoTurn = v.turn; return go(null); }
    if (b.dataset.rel != null) { G.pause = true; return go({ release: true }); }
    if (b.dataset.units != null) { G.pause = !G.pause; b.setAttribute("aria-pressed", G.pause); }
  }
  function ordersHover(e) {
    const G = game; if (!G || !G.cur) return;
    const b = e.target.closest("button[data-i]"), o = b ? G.cur.opts[+b.dataset.i] : null;
    if (o === G.hover) return; G.hover = o;
    marks(o); vtt.redraw();
  }
  function ordersChange(e) { if (game && e.target.matches("[data-pause]")) game.pause = e.target.checked; }
  function playKey(e) {
    const G = game; if (!G || !G.waiting || G.step.done || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!document.getElementById("vtt-orders")) { endGame(); return; }
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag) || (tag === "BUTTON" && e.key === "Enter")) return;   // Enter on a button presses that button
    const v = G.step.value;
    if (e.key === "Enter") { e.preventDefault(); go(v.type === "turn" ? turnAnswer() : null); }
    else if (v.type === "act" && /^[1-9]$/.test(e.key) && G.cur && G.cur.list[+e.key - 1]) { e.preventDefault(); go({ i: G.cur.list[+e.key - 1].i }); }
  }
  // a click on the map while a model waits for its orders: an enemy it can act against becomes the target; an
  // empty hex is where it moves. Anything else is the table's own (select a token, show its sheet)
  function mapClick(i, hex) {
    const G = game; if (!G || !G.waiting || G.step.done || !G.cur) return false;
    if (vtt.st.t < G.view.frames.length - 1) return false;   // looking back at an earlier moment
    const v = G.step.value, ros = G.view.roster;
    if (i >= 0) { if (ros[i] && G.cur.byT.has(ros[i].id)) { G.target = ros[i].id; showAct(ordEl(), v); return true; } return false; }
    if (!hex) return false;
    const f = G.view.frames[G.view.frames.length - 1] || [];
    if (f.some(x => x && x[0] === hex.q && x[1] === hex.r)) return false;
    go({ move: hex }); return true;
  }

