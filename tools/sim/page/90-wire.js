  function wire() {
    const main = $("#main");
    main.querySelectorAll("[data-g]").forEach(el => el.onchange = () => {
      S[el.dataset.g] = el.type === "checkbox" ? el.checked : Math.max(1, Number(el.value) || 1); save();
    });
    main.querySelectorAll("[data-o]").forEach(el => el.onchange = () => { S[el.dataset.o] = el.value; save(); if (el.dataset.o === "battlefield" || el.dataset.o === "ridge") render(); });
    const hs = main.querySelector("[data-h]"); hs.onchange = () => { S.health = hs.value; save(); render(); };
    main.querySelectorAll("[data-add]").forEach(el => el.onchange = () => {
      if (!el.value) return; const si = +el.dataset.add;
      S.sides[si].push(...addOf(si, el.value, el.value.startsWith("veh:") ? 1 : 5)); save(); render();
    });
    main.querySelectorAll("[data-preset]").forEach(el => el.onclick = () => {
      const p = PRESETS[+el.dataset.preset];
      S.sides = [[], []]; S.sides[0] = expand(p[1], 0); S.sides[1] = expand(p[2], 1); S.distance = p[3]; S.battlefield = p[4] || "open"; last = null; save(); render();
    });
    main.querySelectorAll("[data-delsq]").forEach(el => el.onclick = () => { const si = +el.dataset.delsq; S.sides[si] = S.sides[si].filter(x => x.squad !== el.dataset.sq); save(); render(); });
    main.querySelectorAll(".sunit").forEach(card => {
      const u = S.sides[+card.dataset.s][+card.dataset.u];
      const upd = () => { save(); render(); };
      card.querySelector("[data-del]").onclick = () => { S.sides[+card.dataset.s].splice(+card.dataset.u, 1); upd(); };
      card.querySelectorAll("[data-f]").forEach(el => el.onchange = () => { u[el.dataset.f] = el.dataset.f === "count" ? Math.max(1, Number(el.value) || 1) : el.value; upd(); });
      card.querySelectorAll("[data-a]").forEach(el => el.onchange = () => { u.armour[+el.dataset.a] = el.value; u.armour = u.armour.filter(Boolean); upd(); });
      card.querySelectorAll("[data-w]").forEach(el => el.onchange = () => {
        const v = el.value;
        if (!v) u[el.dataset.w] = null;
        else { const [k, rest] = [v.slice(0, 2), v.slice(2)]; const [name, mode] = rest.split("\u0000"); u[el.dataset.w] = k === "t:" ? { trait: name, mode } : { item: name, mode }; }
        upd();
      });
      const amb = card.querySelector("[data-amb]");
      if (amb) amb.onchange = () => { u.ambush = amb.checked; save(); };
      const cs = card.querySelector("[data-cs]");
      if (cs) cs.onchange = () => { u.carried = cs.value || null; upd(); };
      const cy = card.querySelector("[data-carry]");
      if (cy) cy.onchange = () => { u.carries = cy.value || null; save(); };
      if (u.vehicle) return;   // a vehicle's card has no loadout
      const sh = card.querySelector("[data-sh]");
      sh.onchange = () => { u.shield = sh.checked ? (LO[u.template] && LO[u.template].shield ? { ...LO[u.template].shield } : { sp: 40, delay: 2, recharge: 10, ranged_only: true }) : null; upd(); };
      card.querySelectorAll("[data-shf]").forEach(el => el.onchange = () => { u.shield[el.dataset.shf] = Number(el.value) || 0; upd(); });
      const det = card.querySelector("details.lo");
      det.open = !!u.open; det.ontoggle = () => { u.open = det.open; save(); };
    });
    $("#simrun").onclick = () => {
      const specs = S.sides.flatMap((units, si) => units.map(u => ({ side: si, spec: u })));
      if (!S.sides[0].length || !S.sides[1].length) { $("#simout").innerHTML = `<p class="empty">Add at least one unit to each side.</p>`; return; }
      $("#simout").innerHTML = `<p class="empty">Fighting ${S.runs} battles…</p>`;
      setTimeout(() => {
        try { last = SIM.monteCarlo(specs, { runs: S.runs, distance: S.distance, maxTurns: S.maxTurns, morale: S.morale, health: S.health, boxes: S.boxes || 5,
          locations: S.locations || "elite", cover: [S.coverA || "none", S.coverB || "none"], battlefield: S.battlefield || "open", mapSeed: S.mapSeed || 1,
          ridge: !MAPPED() && S.ridge ? { side: +S.ridge, height: S.ridgeH || 8 } : null,
          awareness: MAPPED() ? S.awareness || "limited" : undefined, lighting: S.lighting || "mixed", sightedShots: !!S.sightedShots, tacticalDodge: !!S.tacticalDodge, limitedDodges: S.limitedDodges !== false, cinematicEffort: !!S.cinematicEffort }); $("#simout").innerHTML = results(last); setupReplay(); }
        catch (e) { $("#simout").innerHTML = `<p class="empty">Could not run: ${esc(e.message)}</p>`; }
      }, 20);
    };
  }
  window.simView = render;
