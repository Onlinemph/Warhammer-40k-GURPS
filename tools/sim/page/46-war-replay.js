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
