// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= fix and flank: the squads' plan on a big field
    // A soldier weighs only what one move can do, so on its own it never walks a hundred yards round a hedge to
    // shoot a line from the side. This is the plan above it. Once a side has seen enough of the enemy, it keeps some
    // squads where they are as a base of fire and sends others round the end of the enemy's line, by the side whose
    // route the enemy sees least of. A flanking squad moves by the hexes the enemy can't see; when it's beside their
    // line (or meets them, or has lost half its men, or two minutes have gone) it goes back to fighting as before,
    // now from the side: the enemy's cover faces the wrong way, and a man facing his front defends at -2 against a
    // shot from his side and not at all from behind (B390).
    // How readily a faction does it is `flank` in data/sim/ai.yaml (the share of its squads it sends). Only on maps
    // that deploy along the edges (the countryside), unless opt.flanking says otherwise: true or false for both
    // sides, or [side A, side B].
    const FLANK_ON = s => Array.isArray(opt.flanking) ? !!opt.flanking[s] : opt.flanking != null ? !!opt.flanking : !!(terr && terr.deploy === "edge");
    const PLAN_EVERY = 6, FLANK_MAX = 120;
    const planAt = [-99, -99], flankDir = [0, 0];
    const centroid = hs => { let x = 0, y = 0; for (const h of hs) { const [a, b] = px(h); x += a; y += b; } return [x / hs.length, y / hs.length]; };
    // the hex at pixel point (x, y): the inverse of px, cube-rounded
    function hexAt(x, y) {
      const q = x / 1.5, r = y / Math.sqrt(3) - q / 2, s = -q - r;
      let rq = Math.round(q), rr = Math.round(r); const rs = Math.round(s);
      const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
      if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
      return { q: rq, r: rr };
    }
    // the nearest open, walkable hex to a point (within a few yards), or null off the map
    function openNear(x, y) {
      const h0 = hexAt(x, y);
      for (let rad = 0; rad <= 6; rad++) for (let dq = -rad; dq <= rad; dq++) for (let dr = Math.max(-rad, -dq - rad); dr <= Math.min(rad, -dq + rad); dr++) {
        if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) !== rad) continue;
        const h = { q: h0.q + dq, r: h0.r + dr };
        if (walkable(key(h.q, h.r))) return h;
      }
      return null;
    }
    // what a side knows of the enemy: where each foe seen in the last 20 seconds is (or was last seen)
    function enemyPicture(S) {
      const out = [];
      for (const [f, t] of seenAt[S]) if (f.state === "ok" && !f.u.routed && t >= turn - 20) { const h = t >= turn - 1 && f.h ? f.h : f.lastSeenH; if (h) out.push(h); }
      return out;
    }
    // how much of a route from a to b the enemy can see: sample points along it, each looked at from the
    // nearest few known foes
    function exposure(a, b, foesH) {
      let seen = 0;
      const [ax, ay] = px(a), [bx, by] = px(b), n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 12));
      for (let i = 1; i <= n; i++) {
        const h = openNear(ax + (bx - ax) * i / n, ay + (by - ay) * i / n);
        if (!h) { seen += 3; continue; }
        const near = foesH.slice().sort((p, q) => hexDist(p, h) - hexDist(q, h)).slice(0, 4);
        for (const f of near) if (los(f, h)) seen++;
      }
      return seen / n;
    }
    // what a side's known foes can see of the field, cell by cell of the coarse grid (each cell's middle looked at
    // from the nearest eight known foes), made again with each plan; flanking squads route by it
    const TMAP = [null, null];
    function threatMap(S) { return NAV ? TMAP[S] : null; }
    function makeThreatMap(S, foesH) {
      if (!NAV) return;
      const T = new Float32Array(NAV.cw * NAV.ch);
      for (let c = 0; c < T.length; c++) {
        const i = NAV.rep[c];
        if (i < 0) continue;
        const h = terr.hx[i];
        const near = foesH.map(f => [hexDist(f, h), f]).sort((a, b) => a[0] - b[0]).slice(0, 8);
        for (const [d, f] of near) if (d <= 400 && los(f, h)) T[c]++;
      }
      TMAP[S] = T;
    }
    // how much the enemy gains from cover against us where we stand: the share of known foes with cover (a wall,
    // a hedge, a crate, a crest) between them and the middle of our side. A flank is worth its cost against men
    // behind cover; against men in the open the squad does better shooting from where it is
    const coverShare = (foesH, from) => foesH.slice(0, 16).filter(f => hexDist(f, from) > 1 && coverAt(f, from, null) !== "none").length / Math.min(16, foesH.length);
    // the plan, made again every few seconds: who fixes, who flanks, and which way round. A flanking move has three
    // legs, so the squad doesn't just walk at the end of the enemy line through its fire: out sideways to a lane
    // past the end of their line, up that lane to just short of them, then in beside them
    function planManeuvers() {
      if (!terr) return;
      for (const S of [0, 1]) {
        if (!FLANK_ON(S) || turn - planAt[S] < PLAN_EVERY) continue;
        const foesH = enemyPicture(S);
        if (foesH.length < 3) continue;
        planAt[S] = turn;
        if (NAV) makeThreatMap(S, foesH);
        const gs = groups.filter(g => g.units[0].side === S && g.models.some(x => x.state === "ok" && x.h && !x.u.routed));
        const movers = g => g.models.filter(x => x.state === "ok" && x.h && !(x.u.ranged && x.u.ranged.needsSetup) && !x.u.team);
        // the geometry: our mass, theirs, the axis between, and the enemy line's ends across it
        const ours = models.filter(x => x.u.side === S && x.state === "ok" && x.h && !x.u.routed).map(x => x.h);
        const [ox, oy] = centroid(ours), [ex, ey] = centroid(foesH);
        let ax = ex - ox, ay = ey - oy;
        const len = Math.hypot(ax, ay) || 1; ax /= len; ay /= len;
        const qx = -ay, qy = ax;   // across the axis
        let lo = Infinity, hi = -Infinity;
        for (const f of foesH) { const [fx, fy] = px(f), t = (fx - ex) * qx + (fy - ey) * qy; lo = Math.min(lo, t); hi = Math.max(hi, t); }
        // a point by depth along the axis (0: the enemy's mass, negative: toward us) and offset across it; pulled in
        // toward the axis if it's off the map
        const at = (depth, lat) => { for (let k = 0; k < 4; k++) { const l = lat * (1 - k * 0.2), h = openNear(ex + ax * depth + qx * l, ey + ay * depth + qy * l); if (h) return h; } return null; };
        const laneOf = dir => (dir > 0 ? hi : lo) + dir * 35;
        const legsFor = (dir, from) => {
          const [fx, fy] = px(from), d0 = (fx - ex) * ax + (fy - ey) * ay, lane = laneOf(dir);
          const legs = [at(Math.min(-30, d0 + 20), lane), at(-30, lane), at(0, (dir > 0 ? hi : lo) + dir * 15)];
          return legs.every(Boolean) && Math.abs(((px(legs[2])[0] - ex) * qx + (px(legs[2])[1] - ey) * qy) - (dir > 0 ? hi : lo)) * dir > 5 ? legs : null;
        };
        // finished orders: in position, in contact, badly hurt, or too long at it; else on to the next leg
        for (const g of gs) {
          const o = g.order;
          if (!o || o.kind !== "flank") continue;
          const live = movers(g);
          if (!live.length) { g.order = { kind: "engage", since: turn, flanked: true }; continue; }
          const [cx, cy] = centroid(live.map(x => x.h)), here = hexAt(cx, cy), near = Math.min(...foesH.map(f => hexDist(f, here)));
          const legs = legsFor(o.dir, here);
          if (legs) { o.legs[1] = legs[1]; o.legs[2] = legs[2]; }   // the enemy moved: the lane and the end of their line move with them; the first leg stays put
          while (o.stage < 2 && hexDist(here, o.legs[o.stage]) <= 10) o.stage++;
          const done = o.stage === 2 && hexDist(here, o.legs[2]) <= 10;
          if (done || near <= 20 || live.length * 2 < o.n0 || turn - o.since > FLANK_MAX) {
            g.order = { kind: "engage", since: turn, flanked: true };
            L(`${g.name} ${near <= 20 ? "close with the enemy on the flank" : done ? "are in position on the flank" : "give up the flanking move"}`);
          }
        }
        // pick the way round once (and keep it, unless it's gone): the end whose route the enemy sees least of
        const from = hexAt(ox, oy);
        if (!flankDir[S] || !legsFor(flankDir[S], from)) {
          let best = 0, bc = Infinity;
          for (const dir of [1, -1]) {
            const L3 = legsFor(dir, from);
            if (!L3) continue;
            const route = [from, ...L3];
            let c = 0;
            for (let k = 0; k + 1 < route.length; k++) c += exposure(route[k], route[k + 1], foesH) * 2 + hexDist(route[k], route[k + 1]) / 40;
            if (c < bc) { bc = c; best = dir; }
          }
          flankDir[S] = best;
          if (!best) continue;
        }
        // who goes: the share the faction sends, never all of them, the quickest and keenest first; and nobody new
        // while the enemy stands in the open toward us (there's nothing to go round)
        const share = Math.max(...gs.map(g => g.units[0].ai.flank ?? 0.3));
        let n = gs.length < 2 ? 0 : Math.min(gs.length - 1, Math.max(share >= 0.15 ? 1 : 0, Math.round(gs.length * share)));
        const worth = coverShare(foesH, from) >= 0.3;
        n -= gs.filter(g => g.order && g.order.kind === "engage" && g.order.flanked).length;
        const suit = g => {
          const u = g.units[0], live = movers(g);
          if (!live.length) return -Infinity;   // a heavy weapons squad stays
          const [cx, cy] = centroid(live.map(x => x.h)), lat = ((cx - ex) * qx + (cy - ey) * qy) * flankDir[S];
          return live.reduce((a, x) => a + moveOf(x), 0) / live.length + (u.stance === "charge" ? 3 : 0) + 2 * (u.ai.zeal || 0) + lat / 25;
        };
        const ranked = gs.filter(g => (!g.order || g.order.kind === "flank" || g.order.kind === "fix") && suit(g) > -Infinity).sort((a, b) => suit(b) - suit(a));
        const pincer = share >= 0.45 && n >= 2;
        ranked.forEach((g, i) => {
          if (i < n && worth && (!g.order || g.order.kind !== "flank")) {
            const live = movers(g), here = hexAt(...centroid(live.map(x => x.h)));
            let dir = pincer && i % 2 ? -flankDir[S] : flankDir[S], legs = legsFor(dir, here);
            if (!legs) { dir = flankDir[S]; legs = legsFor(dir, here); }
            if (!legs) return;
            g.order = { kind: "flank", dir, legs, stage: 0, since: turn, n0: live.length };
            L(`${g.name} move round the enemy's ${dir > 0 ? "right" : "left"} flank`);
          } else if (i >= n && !g.order) g.order = { kind: "fix", since: turn };
        });
      }
    }
    // a flanking squad's soldier: one more option, to keep moving round, valued over whatever else it could do as
    // long as the step doesn't walk it into much more fire than it stands in now; each takes its own spot in a line
    // across the goal so the squad arrives spread out
    function flankOption(m, opts, add, rNow) {
      const g = m.u.group, o = g && g.order;
      if (!o || o.kind !== "flank" || !m.h || (m.u.ranged && m.u.ranged.needsSetup) || m.u.team) return;   // its heavy weapon team stays with the base of fire
      const live = g.models.filter(x => x.state === "ok" && x.h && !(x.u.ranged && x.u.ranged.needsSetup) && !x.u.team), i = live.indexOf(m);
      const leg = o.legs[o.stage], [gx, gy] = px(leg), [cx, cy] = px(m.h);
      let dx = gx - cx, dy = gy - cy; const L0 = Math.hypot(dx, dy) || 1; dx /= L0; dy /= L0;
      const goal = openNear(gx - dy * 2 * (i - (live.length - 1) / 2), gy + dx * 2 * (i - (live.length - 1) / 2)) || leg;
      // a flanker with nobody to shoot at doesn't lie down in the grass: it's on its way somewhere
      for (let k = opts.length - 1; k >= 0; k--) if (opts[k].label === "lie-low") opts.splice(k, 1);
      const top0 = opts.reduce((a, b) => b.v > a.v ? b : a, { v: 0 });
      const next = stepHex(m.h, goal, moveOf(m));
      const vF = Math.max(top0.v, 0) + 0.35 * Math.max(0.02, Math.abs(top0.v)) - Math.max(0, risk(m, next, "") - rNow);
      add(vF, `flank@${goal.q},${goal.r}`, () => {
        // down on its belly it would only crawl: up to a kneel first (Change Posture), then on next turn
        if (m.prone && m.legsLost < 2 && !gripsOn(m).length) { m.prone = false; m.kneel = true; m.lyingLow = false; L(`${m.id} gets up to move on round the flank`); return; }
        m.flanking = true;
        const n = stepToward(m, goal, runMove(m), 0);
        m.flanking = false;
        if (n >= moveOf(m) - 1) m.runK = m.runPrev + 1;
        if (m.state !== "ok" || !m.h) return;
        const f = scanFoes(m).find(x => x.state === "ok" && x.h && los(m.h, x.h)); if (f) faceTo(m, f.h);
        L(`${m.id} works round the flank`);
      });
    }
