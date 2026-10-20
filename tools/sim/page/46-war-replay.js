  // ================= a battle from the war (game/): /sim#war=<report id>, served by the war server, opens the
  // battle's full engine result on the table and switches to the 3D view, with the sides as the war names them.
  // The page asks the war's API for it with the player's own sign-in (the cookie, or a development join's token)
  async function warReplay(id) {
    const main = $("#main");
    main.innerHTML = `<header class="libhead"><div class="eyebrow">Galactic War</div><h1 id="war-h">A battle of the war</h1><p id="war-msg">Loading the battle…</p></header><div id="simout"></div>`;
    const msg = t => { const el = document.getElementById("war-msg"); if (el) el.textContent = t; };
    const tok = localStorage.getItem("war-token");
    let r = null;
    for (let tries = 0; tries < 400 && !r; tries++) {
      let res, j;
      try { res = await fetch("/api/replay/" + encodeURIComponent(id) + "?full=1", { cache: "no-cache", headers: tok ? { authorization: "Bearer " + tok } : {} }); j = await res.json(); }
      catch (e) { msg("This page shows a war battle when the war's server sends it: " + e.message); return; }
      if (!res.ok) { msg(j.error || "Couldn't load the battle (" + res.status + ")"); return; }
      if (j.frames) { r = j; break; }
      if (j.status === "failed") { msg("The battle couldn't be fought out: " + (j.error || "unknown")); return; }
      const p = j.progress;
      msg(j.status === "queued" ? `Waiting to be fought out (${j.ahead || 0} ahead)…` : p ? `Being fought out: second ${p.second}${p.attempts > 1 ? `, try ${p.attempt} of ${p.attempts}` : ""}…` : "Being fought out…");
      await new Promise(ok => setTimeout(ok, 1500));
    }
    if (!r) return;
    const W = r.war || {}, names = W.sideNames || [];
    // the broadcast's names and title (for this page only: not saved with the simulator's settings)
    S.nameA = names[0] || ""; S.nameB = names[1] || ""; S.showTitle = W.world ? `${W.world}, turn ${W.turn}` : "";
    document.getElementById("war-h").textContent = W.world ? `${W.world}, turn ${W.turn}` : "A battle of the war";
    msg(`${names[0] || "Side A"} against ${names[1] || "Side B"}. ${r.winner >= 0 ? (names[r.winner] || "Side " + "AB"[r.winner]) + " hold the field" : "Neither side holds the field"} after ${r.turns} seconds. Use 3D or Broadcast on the map.`);
    if (vtt) vtt.stop();
    $("#simout").innerHTML = tableHtml(r.frames.length - 1, false);
    vtt = makeTable(r, document.getElementById("vtt-c"));
    // into 3D once the table has wired its tools
    // (tried every half second until it takes: at page load the table isn't ready for it at once)
    let n = 0;
    const to3d = () => { const b3 = document.querySelector('[data-tool="3d"]'); if (!b3 || b3.getAttribute("aria-pressed") === "true" || n++ > 20) return; b3.click(); setTimeout(to3d, 500); };
    setTimeout(to3d, 400);
  }
  window.warReplay = warReplay;

  // ================= fighting a war battle live: /sim#live=<held battle id>. The war's server sends the battle's setup
  // and the answers so far; the page runs the battle from them (as Play it yourself does), sends each answer back, and
  // in a battle between two commanders waits for the other's. The server steps its own copy and keeps the result
  async function warLive(id) {
    const main = $("#main");
    main.innerHTML = `<header class="libhead"><div class="eyebrow">Galactic War</div><h1 id="war-h">A battle to fight</h1><p id="war-msg">Loading the battle…</p></header><div id="simout"></div>`;
    const msg = t => { const el = document.getElementById("war-msg"); if (el) el.textContent = t; };
    const tok = localStorage.getItem("war-token"), H = { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) };
    const api = async (p, body) => { const r = await fetch(p, { method: body ? "POST" : "GET", cache: "no-cache", headers: H, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j; };
    let B;
    try { B = await api("/api/live/" + encodeURIComponent(id)); } catch (e) { msg(e.message); return; }
    const names = B.sides.map(s => s.name + (s.players.length ? ` (${s.players.join(", ")})` : ""));
    document.getElementById("war-h").textContent = `${B.world}, turn ${B.turn}`;
    msg(`You command ${names[B.you]}, against ${names[1 - B.you]}${B.commanders[1 - B.you] ? " (commanded in person too: the battle waits on both of you)" : " (the engine's AI)"}. The battle counts for the war at its next tick; unfought by then, the war settles it.`);
    // the same battle as the server's, stepped through the answers so far
    let gen, step;
    try { gen = SIM.playBattle(B.setup.units, B.setup.opts); step = gen.next(); for (const a of B.answers) step = gen.next(a); }
    catch (e) { msg("Couldn't start the battle: " + e.message); return; }
    let k = B.answers.length, chain = Promise.resolve();
    const remote = {
      endNote: "The result goes to the war: it counts at the next tick.",
      // each answer in order, one after another
      sent: a => { const n = k++; chain = chain.then(() => api(`/api/live/${encodeURIComponent(id)}/answer`, { k: n, ans: a })).catch(e => msg("The war's server refused an answer: " + e.message + ". Reload the page to pick up where it stands.")); },
      // the other commander's next answer, when it comes
      wait: async () => { for (;;) { await chain; const j = await api("/api/live/" + encodeURIComponent(id)); if (j.answers.length > k) return j.answers[k++]; await new Promise(ok => setTimeout(ok, 2000)); } },
    };
    beginGame(gen, step, B.you, true, remote);
  }
  window.warLive = warLive;
