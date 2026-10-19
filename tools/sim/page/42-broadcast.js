  // ================= the broadcast view: the 3D replay full screen with nothing of the page round it, for recording
  // A scoreboard (each side's name, models standing and health left), the clock, a feed of who put whom down, a
  // title card over the deployment and a result card at the end. The action camera runs it. x is what the table
  // lends: { main, sample, fr, fx, ros, st, toolBtn, resize, ensure3d, setCine, setT, startPlay, stopPlay, redraw }
  const FACTION_NAME = { Astartes: "Adeptus Astartes", "Imperial Guard": "Astra Militarum", "Rubric Marines": "Thousand Sons", Khorne: "World Eaters", "Kroot and Vespid": "Kroot", "Inquisition and Psykers": "The Inquisition", Default: "" };
  function makeBroadcast(x) {
    const { main, sample, fr, fx, ros, st } = x;
    let on = false, was = null, hold = 0, lastKey = "", kills = [], killsAt = -1;
    const el = document.createElement("div"); el.className = "bc"; el.hidden = true; main.appendChild(el);
    const total = [0, 1].map(s => ros.filter(r => r.side === s).length);
    const most = list => { const n = new Map(); for (const v of list) n.set(v, (n.get(v) || 0) + 1); return [...n].sort((a, b) => b[1] - a[1]); };
    // a side is called what the picker says, else by its paint scheme, else by its faction
    const sideName = s => (S["name" + "AB"[s]] || "").trim() || S["col" + "AB"[s]] || (f => FACTION_NAME[f] ?? f)((most(ros.filter(r => r.side === s).map(r => r.faction || ""))[0] || [""])[0]) || "Side " + "AB"[s];
    // (a name with a bracket takes its plural before it: "Fire Warriors (Shas'la)")
    const plural = (n, w) => { const m = /^(.*?)( \(.*\))$/.exec(w); if (m) return plural(n, m[1]) + m[2]; return n === 1 ? w : /(s|x|ch|sh)$/i.test(w) ? w + "es" : /[^aeiou]y$/i.test(w) ? w.slice(0, -1) + "ies" : /man$/.test(w) ? w.slice(0, -3) + "men" : w + "s"; };
    const forces = s => { const m = most(ros.filter(r => r.side === s).map(r => r.veh || r.template || "")); return m.slice(0, 3).map(([t, n]) => `${n} ${esc(plural(n, t.replace(/^(Astartes|Astra Militarum|Adepta Sororitas|Aeldari|Necron|Ork) (?=\S)/, "")))}`).join(" · ") + (m.length > 3 ? ` · +${m.length - 3} more` : ""); };
    const ground = () => { const g = (typeof GROUNDS !== "undefined" ? GROUNDS : []).find(([v]) => v === (S.battlefield || "open")); return g ? g[1] : ""; };
    // portraits come from the 3D view, which may still be loading its models: asked for again each time
    const face = i => { try { return (i >= 0 && x.portrait && x.portrait(i)) || ""; } catch (e) { return ""; } };
    const pic = i => { const u = face(i); return u ? `<img src="${u}" alt="">` : ""; };
    const lead = [0, 1].map(s => { const t = (most(ros.filter(r => r.side === s).map(r => r.template || ""))[0] || [""])[0]; return ros.findIndex(r => r.side === s && (r.template || "") === t); });
    const short = id => id.replace(/^(Astartes|Astra Militarum|Adepta Sororitas|Aeldari) (?=\S)/, "");
    // who fell, when, and to whom: the last model hurt on the hex where a body dropped, and the last attacker before that
    function scanKills() {
      if (killsAt === fx.length) return; killsAt = fx.length; kills = [];
      fx.forEach((es, k) => {
        let atk = null, hurt = new Map();
        for (const e of es) {
          if (e[0] === "s" || e[0] === "m") atk = e;
          else if (e[0] === "h" && e[4] != null) hurt.set(e[4] + "," + e[5], { v: e[1], a: atk ? atk[7] : -1, melee: !!atk && atk[0] === "m" });
          else if (e[0] === "d") {
            // (one that collapsed without a blow this second, from wounds or bleeding: whoever of that side stood there and is gone)
            const h = hurt.get(e[1] + "," + e[2]), a = fr[k] || [], b = fr[k + 1] || [];
            const v = h ? h.v : a.findIndex((m, i) => m && !b[i] && ros[i] && ros[i].side === e[3] && m[0] === e[1] && m[1] === e[2]);
            if (v >= 0) kills.push({ t: k + 1, side: e[3], dead: !!e[4], v, a: h ? h.a : -1, melee: !!(h && h.melee) });
          }
        }
      });
    }
    el.innerHTML = `<div class="bc-top">
        <div class="bc-side a"><img class="bc-face" alt=""><b class="bc-name"></b><span class="bc-n"></span><span class="bc-sub"></span><div class="bc-bar"><i></i></div></div>
        <div class="bc-clock"><b></b><span></span></div>
        <div class="bc-side b"><span class="bc-n"></span><b class="bc-name"></b><span class="bc-sub"></span><img class="bc-face" alt=""><div class="bc-bar"><i></i></div></div>
      </div>
      <ul class="bc-feed"></ul>
      <div class="bc-card bc-title"><p class="bc-ep"></p><h2><span class="a"></span><i>vs</i><span class="b"></span></h2><p class="bc-f"><span class="a"></span><span class="b"></span></p><p class="bc-g"></p></div>
      <div class="bc-card bc-end" hidden></div>
      <button type="button" class="bc-x" title="Leave the broadcast view (Esc)">Exit</button>`;
    const q = s => el.querySelector(s);
    q(".bc-x").onclick = () => exit();
    function labels() {
      for (const s of [0, 1]) {
        const c = "ab"[s];
        q(`.bc-side.${c} .bc-name`).textContent = sideName(s); q(`.bc-side.${c} .bc-sub`).innerHTML = forces(s);
        q(`.bc-title h2 .${c}`).textContent = sideName(s); q(`.bc-title .bc-f .${c}`).innerHTML = forces(s);
      }
      q(".bc-title h2").classList.toggle("long", sideName(0).length + sideName(1).length > 26);   // long names go one above the other
      q(".bc-ep").textContent = (S.showTitle || "").trim(); q(".bc-ep").hidden = !(S.showTitle || "").trim();
      q(".bc-g").textContent = [ground(), sample.terrain ? "" : `${S.distance} yards apart`].filter(Boolean).join(" · ");
    }
    function update(t, p) {
      if (!on) return;
      const key = t + ":" + (p >= 1 ? 99 : Math.floor(p * 12)) + ":" + fr.length; if (key === lastKey) return; lastKey = key;
      const f = fr[t] || [], prev = t > 0 ? fr[t - 1] || [] : f;
      for (const s of [0, 1]) {
        let up = 0, hp = 0; f.forEach((m, i) => { if (m && ros[i] && ros[i].side === s && m[3]) { up++; hp += Math.max(0, m[5] == null ? 1 : m[5]); } });
        const c = "ab"[s]; q(`.bc-side.${c} .bc-n`).textContent = up; q(`.bc-side.${c} .bc-bar i`).style.width = (100 * hp / Math.max(1, total[s])).toFixed(1) + "%";
        // the side's face: its most numerous kind of model
        const im = q(`.bc-side.${c} .bc-face`), url = face(lead[s]); if (url && im.getAttribute("src") !== url) im.src = url; im.hidden = !url;
      }
      const sec = x.live && sample.beatTurn ? sample.beatTurn[t] : t;   // a played battle's frames are beats within its seconds
      q(".bc-clock b").textContent = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); q(".bc-clock span").textContent = "battle time";
      scanKills();
      const seen = kills.filter(k => k.t < t || (k.t === t && p >= .6)).slice(-5).reverse();
      q(".bc-feed").innerHTML = seen.map((k, j) => { const V = ros[k.v], A = ros[k.a];
        return `<li class="${V ? "s" + "ab"[V.side] : ""}${t - k.t > 4 ? " old" : ""}">${A ? `${pic(k.a)}<b class="s${"ab"[A.side]}">${esc(short(A.id))}</b>` : ""}${A ? `<i>${k.melee ? "cuts down" : k.dead ? "kills" : "drops"}</i>` : ""}<b class="s${"ab"[V.side]}">${esc(short(V.id))}</b>${pic(k.v)}${A ? "" : `<i>${k.dead ? "dies" : "falls"}</i>`}</li>`; }).join("");
      q(".bc-title").hidden = t !== 0; q(".bc-title").classList.toggle("show", t === 0);
      const over = sample.over !== false && t === fr.length - 1 && p >= 1, end = q(".bc-end");
      if (over && end.hidden) {
        const w = sample.winner, up = s => (f.filter((m, i) => m && ros[i] && ros[i].side === s && m[3]).length), top = ros.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];
        end.innerHTML = `<p class="bc-ep">${w >= 0 ? "Victory" : sample.timeout ? "Time ran out" : "Mutual ruin"}</p><h2><span class="${w >= 0 ? "ab"[w] : ""}">${w >= 0 ? esc(sideName(w)) : "No one holds the field"}</span></h2>
          <p class="bc-f"><span class="a">${esc(sideName(0))}: ${up(0)} of ${total[0]} standing</span><span class="b">${esc(sideName(1))}: ${up(1)} of ${total[1]} standing</span></p>
          <p class="bc-g">${sample.turns} second${sample.turns === 1 ? "" : "s"}${top && top.kills ? ` · most kills: ${esc(short(top.id))} (${top.kills})` : ""}</p>`;
      }
      end.hidden = !over; end.classList.toggle("show", over);
    }
    const onKey = e => { if (on && e.key === "Escape" && !document.fullscreenElement) exit(); };
    const onFs = () => { if (on && was && was.full && !document.fullscreenElement) exit(); else if (on) setTimeout(x.resize, 60); };
    async function enter() {
      if (on) return exit();
      try { await x.ensure3d(); } catch (e) { return; }
      on = true; lastKey = ""; labels();
      was = { cine: !!st.cine, grid: st.grid, trails: st.trails, full: false };
      main.classList.add("bc-on"); el.hidden = false; st.grid = false; st.trails = false; st.clean = true; x.setCine(true);
      const snd = x.toolBtn("snd"); if (snd && !snd.disabled && snd.getAttribute("aria-pressed") !== "true") snd.click();
      document.addEventListener("keydown", onKey); document.addEventListener("fullscreenchange", onFs);
      try { await main.requestFullscreen(); was.full = true; } catch (e) { /* no fullscreen here: it fills the window instead */ }
      x.resize(); x.stopPlay(); x.setT(0, false);
      // the title card holds for a few seconds, then the battle runs
      clearTimeout(hold); hold = setTimeout(() => { if (on && st.t === 0 && !st.playing) x.startPlay(); }, 3500);
    }
    function exit() {
      if (!on) return; on = false; clearTimeout(hold);
      main.classList.remove("bc-on"); el.hidden = true;
      st.grid = was.grid; st.trails = was.trails; st.clean = false; x.setCine(was.cine);
      document.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      x.stopPlay(); x.resize(); x.redraw();
    }
    return { enter, exit, update, get on() { return on; }, dispose() { if (on) exit(); el.remove(); } };
  }

