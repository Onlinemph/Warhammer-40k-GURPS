// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= the faction's director: orders by need
    // A soldier weighs only what one move can do. Above the soldiers each side has a director, which every few
    // seconds looks at what the side knows and gives each squad an order by what the fight needs:
    //   fire     the squad's guns go on one enemy squad, the one most worth killing (its threat, how close it is to
    //            breaking); soldiers still pick their own shots, but men of that squad count for more to them
    //   assault  a hand-to-hand squad goes for an enemy squad, routed by the ground the enemy can't see
    //   support  a squad losing men or pinned gets help: a free squad turns on whoever is hurting it, moving up
    //            beside it if it can't see them
    //   flank    against an enemy dug in behind cover, a spare squad goes round the end of their line (three legs:
    //            out to a lane past it, up the lane, in beside them)
    // Orders steer; they don't puppet. Each soldier keeps its own tactics (defences, aim, cover, posture) and sees an
    // order as a target priority and one more option, to keep moving where it's sent.
    // Faction temper comes from data/sim/ai.yaml: `focus` (discipline) sets how hard men favour the squad they're
    // told to shoot, `flank` the share of squads it sends round. On by default on the countryside (a big field);
    // opt.director (true, false or [side A, side B]) overrides it. opt.flanking does the same for flanking alone.
    // ---- synapse (data/xenos/tyranids/traits.yaml): a Tyranid brood within a synapse creature's field (a Warrior's
    // or a Zoanthrope's 16 yards, a Hive Tyrant's 32) has Synapse Discipline, Fearlessness 5 and High Pain Threshold,
    // and fights to the Hive Mind's purpose: it takes the director's orders. Out of every field it falls back on
    // instinct (Synapse Dependence): no fearlessness, no pain immunity, no orders; it fights what's in front of it.
    // A Genestealer (Independent Hunter) needs no field: it's always linked.
    // Worked out each second, brood by brood (linked when at least half its living members are in a field), so
    // killing the synapse creatures first breaks the swarm, as the Imperium teaches.
    const SYN = units.some(u => u.flags.synDisc);
    for (const u of units) if (u.flags.synDisc) { u.baseFearless = u.flags.fearless || 0; u.baseHpt = !!u.flags.hpt; }
    function linkSynapse() {
      if (!SYN) return;
      const nodes = models.filter(x => x.state === "ok" && x.h && x.u.flags.synapse);
      for (const u of units) {
        if (!u.flags.synDisc || u.routed) continue;
        const ls = u.models.filter(x => x.state === "ok" && x.h);
        if (!ls.length) continue;
        const inField = ls.filter(x => x.u.flags.synapse || nodes.some(n => n.u.side === u.side && hexDist(n.h, x.h) <= n.u.flags.synapse)).length;
        const linked = !!u.flags.synIndep || inField * 2 >= ls.length;   // an Independent Hunter needs no field
        if (u.linked !== undefined && linked !== u.linked) L(linked ? `${u.name} come back under synapse` : `${u.name} lose synapse and fall back on instinct`);
        u.linked = linked;
        u.flags.fearless = u.baseFearless + (linked ? 5 : 0);
        u.flags.hpt = u.baseHpt || linked ? 1 : 0;
      }
    }
    // a Tyranid brood cut off from synapse hears no orders
    const hearsOrders = u => !u.flags.synDisc || !!u.linked;
    const DIRECTOR_ON = s => Array.isArray(opt.director) ? !!opt.director[s] : opt.director != null ? !!opt.director : !!(terr && terr.deploy === "edge");
    const FLANK_ON = s => DIRECTOR_ON(s) && (Array.isArray(opt.flanking) ? !!opt.flanking[s] : opt.flanking != null ? !!opt.flanking : true);
    const PLAN_EVERY = 6, FLANK_MAX = 120, ORDER_MAX = 90;
    const KINDS = new Set(opt.directorOrders || ["fire", "assault", "support", "flank"]);   // which orders it gives (all, normally)
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
    function planFlanks(S, foesH, gs) {
      {
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
          if (!live.length) { (g.order = null, g.flanked = true); continue; }
          const [cx, cy] = centroid(live.map(x => x.h)), here = hexAt(cx, cy), near = Math.min(...foesH.map(f => hexDist(f, here)));
          const legs = legsFor(o.dir, here);
          if (legs) { o.legs[1] = legs[1]; o.legs[2] = legs[2]; }   // the enemy moved: the lane and the end of their line move with them; the first leg stays put
          while (o.stage < 2 && hexDist(here, o.legs[o.stage]) <= 10) o.stage++;
          const done = o.stage === 2 && hexDist(here, o.legs[2]) <= 10;
          if (done || near <= 20 || live.length * 2 < o.n0 || turn - o.since > FLANK_MAX) {
            (g.order = null, g.flanked = true);
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
          if (!best) return;
        }
        // who goes: the share the faction sends, never all of them, the quickest and keenest first; and nobody new
        // while the enemy stands in the open toward us (there's nothing to go round)
        const share = Math.max(...gs.map(g => g.units[0].ai.flank ?? 0.3));
        let n = gs.length < 2 ? 0 : Math.min(gs.length - 1, Math.max(share >= 0.15 ? 1 : 0, Math.round(gs.length * share)));
        const worth = coverShare(foesH, from) >= 0.3;
        n -= gs.filter(g => g.flanked).length;
        const suit = g => {
          const u = g.units[0], live = movers(g);
          if (!live.length) return -Infinity;   // a heavy weapons squad stays
          const [cx, cy] = centroid(live.map(x => x.h)), lat = ((cx - ex) * qx + (cy - ey) * qy) * flankDir[S];
          return live.reduce((a, x) => a + moveOf(x), 0) / live.length + (u.stance === "charge" ? 3 : 0) + 2 * (u.ai.zeal || 0) + lat / 25;
        };
        const ranked = gs.filter(g => (!g.order || g.order.kind === "flank" || g.order.kind === "fire") && !meleeMinded(g) && suit(g) > -Infinity).sort((a, b) => suit(b) - suit(a));
        const pincer = share >= 0.45 && n >= 2;
        ranked.forEach((g, i) => {
          if (i < n && worth && (!g.order || g.order.kind !== "flank")) {
            const live = movers(g), here = hexAt(...centroid(live.map(x => x.h)));
            let dir = pincer && i % 2 ? -flankDir[S] : flankDir[S], legs = legsFor(dir, here);
            if (!legs) { dir = flankDir[S]; legs = legsFor(dir, here); }
            if (!legs) return;
            g.order = { kind: "flank", dir, legs, stage: 0, since: turn, n0: live.length };
            L(`${g.name} move round the enemy's ${dir > 0 ? "right" : "left"} flank`);
          }
        });
      }
    }
    // ---- the director
    const liveOf = g => g.models.filter(x => x.state === "ok" && x.h && !x.u.routed);
    const moversOf = g => liveOf(g).filter(x => !(x.u.ranged && x.u.ranged.needsSetup) && !x.u.team);
    const hexOfAll = ms => hexAt(...centroid(ms.map(x => x.h)));
    // hand-to-hand minded: no gun, a charging stance, or a faction that would rather close
    const meleeMinded = g => { const ls = liveOf(g); return ls.length > 0 && ls.filter(x => !x.u.ranged || x.u.stance === "charge" || x.u.ai.melee > 1.25 * x.u.ai.ranged).length * 2 > ls.length; };
    function direct() {
      for (const S of [0, 1]) {
        if (!DIRECTOR_ON(S) || turn - planAt[S] < PLAN_EVERY) continue;
        const foesH = enemyPicture(S);
        if (!foesH.length) continue;
        planAt[S] = turn;
        if (NAV) makeThreatMap(S, foesH);
        const gs = groups.filter(g => g.units[0].side === S && liveOf(g).length);
        // the enemy as the side knows it, squad by squad: who's in it that we know of, where, how dangerous, how
        // close to breaking
        const E = new Map();
        for (const [f, t] of seenAt[S]) {
          if (f.state !== "ok" || f.u.routed || t < turn - 20 || !f.u.group) continue;
          const h = t >= turn - 1 && f.h ? f.h : f.lastSeenH;
          if (!h) continue;
          let e = E.get(f.u.group);
          if (!e) E.set(f.u.group, e = { g: f.u.group, ms: [], hs: [], threat: 0 });
          e.ms.push(f); e.hs.push(h); e.threat += threatOf(f);
        }
        const foes = [...E.values()];
        for (const e of foes) {
          e.at = hexAt(...centroid(e.hs));
          const left = liveOf(e.g).length / Math.max(1, e.g.count);
          // worth: what it does to us, more for one already hurt (a squad near half strength is near its morale check)
          e.worth = e.threat * (1 + 0.8 * (1 - left)) * (e.g.units.some(u => u.veh) ? 1.2 : 1);
        }
        // our squads: losses since the last look, how pinned, whether in hand-to-hand already
        for (const g of gs) {
          const ls = liveOf(g);
          g.lost = Math.max(0, (g.seenLive ?? ls.length) - ls.length); g.seenLive = ls.length;
          g.pinnedShare = ls.filter(x => x.pinned || x.headsDown || x.stunned).length / ls.length;
          g.inMelee = ls.some(x => modelsNear(x.h, 1).some(f => f.u.side !== S && f.state === "ok"));
          g.at = hexOfAll(ls);
          // an order that's done or stale is dropped (the squad gets a new one below)
          const o = g.order;
          if (o && o.kind !== "flank" && (turn - o.since > ORDER_MAX || (o.target && !liveOf(o.target).length))) g.order = null;
        }
        if (KINDS.has("flank") && FLANK_ON(S) && foesH.length >= 3 && gs.length >= 2) planFlanks(S, foesH, gs);
        const busy = g => g.order && g.order.kind === "flank";
        const sees = (g, e) => liveOf(g).some(x => e.ms.some(f => f.h && los(x.h, f.h)));
        // 1. support: a squad that lost a fifth of its men since the last look, or is half pinned, gets help: the
        //    enemy squad nearest it is put down by a free squad (the nearest that isn't itself in trouble)
        const trouble = gs.filter(g => !g.inMelee && (g.lost * 10 >= g.count * 3 || g.pinnedShare >= 0.6)).sort((a, b) => b.lost - a.lost);
        const helped = new Set();
        for (const g of KINDS.has("support") ? trouble : []) {
          const e = foes.slice().sort((a, b) => hexDist(a.at, g.at) - hexDist(b.at, g.at))[0];
          if (!e) continue;
          const help = gs.filter(h => h !== g && !busy(h) && !helped.has(h) && !h.inMelee && !trouble.includes(h) && !meleeMinded(h) && moversOf(h).length)
            .sort((a, b) => hexDist(a.at, g.at) - hexDist(b.at, g.at))[0];
          if (!help) continue;
          helped.add(help);
          const was = help.order;
          // a helper that can already see them only turns its guns on them; one that can't moves up beside the friend
          if (sees(help, e)) { help.order = { kind: "fire", target: e.g, since: was && was.kind === "fire" && was.target === e.g ? was.since : turn }; continue; }
          help.order = { kind: "support", target: e.g, goal: g.at, friend: g, since: was && was.kind === "support" && was.friend === g ? was.since : turn };
          if (!was || was.kind !== "support" || was.friend !== g) L(`${help.name} go to support ${g.name}`);
        }
        // 2. assault: a hand-to-hand squad goes for the enemy squad it can reach soonest, weighted to the most worth it
        for (const g of gs) {
          if (!KINDS.has("assault") || busy(g) || helped.has(g) || g.inMelee || !meleeMinded(g)) continue;
          const e = foes.slice().sort((a, b) => hexDist(a.at, g.at) / (1 + a.worth) - hexDist(b.at, g.at) / (1 + b.worth))[0];
          if (!e) continue;
          const was = g.order;
          g.order = { kind: "assault", target: e.g, goal: e.at, since: was && was.kind === "assault" && was.target === e.g ? was.since : turn };
          if (!was || was.kind !== "assault" || was.target !== e.g) L(`${g.name} are sent against ${e.g.name}`);
        }
        // 3. fire: every other squad puts its guns on the enemy squad most worth killing of those it can see,
        //    the side as a whole leaning to the same one or two
        const ranked = foes.slice().sort((a, b) => b.worth - a.worth);
        for (const g of gs) {
          if (!KINDS.has("fire") || busy(g) || helped.has(g) || (g.order && g.order.kind === "assault")) continue;
          const e = ranked.find(x => sees(g, x)) || null;
          if (!e) { if (g.order && g.order.kind === "fire") g.order = null; continue; }
          const was = g.order;
          g.order = { kind: "fire", target: e.g, since: was && was.kind === "fire" && was.target === e.g ? was.since : turn };
        }
      }
    }
    // how much more a soldier makes of a foe its squad has been told to put down: a disciplined army follows the
    // order closely (a T'au Fire Warrior), an unruly one hardly at all (an Ork)
    function orderWeight(m, t) {
      const o = m && m.u.group && m.u.group.order;
      return o && o.target && t.u.group === o.target && hearsOrders(m.u) ? 1 + 0.4 * Math.min(1.5, m.u.ai.focus ?? 1) : 1;
    }
    // a soldier with somewhere to go (assault, support, flank): one more option, to keep moving there, worth a third
    // more than its best other choice unless the step takes it into more fire than it stands in now. Each takes its own
    // spot across the goal so the squad arrives spread out. It ends when there's no more need: an assaulting man close
    // enough to charge, a supporting man who can see the enemy squad it was sent against
    // where a soldier's order sends it now, or null: nowhere, or no further (an assaulting man close enough to
    // charge, a supporting man who can see the enemy squad it was sent against)
    function orderGoal(m) {
      const g = m.u.group, o = g && g.order;
      if (!o || !m.h || (m.u.ranged && m.u.ranged.needsSetup) || m.u.team || !hearsOrders(m.u)) return null;   // heavy weapon teams stay put
      let to = null;
      if (o.kind === "flank") to = o.legs[o.stage];
      else if (o.kind === "assault" || o.kind === "support") {
        const tm = liveOf(o.target).filter(f => (seenAt[m.u.side].get(f) ?? -99) >= turn - 20);
        if (o.kind === "assault") {
          const near = tm.length ? Math.min(...tm.map(f => hexDist(f.h, m.h))) : Infinity;
          if (near <= moveOf(m) * 2 + 2 && tm.some(f => los(m.h, f.h))) return null;   // close enough: its own charge does the rest
          to = tm.length ? hexOfAll(tm) : o.goal;
        } else {
          if (tm.some(f => f.h && los(m.h, f.h))) return null;   // it can see them: its guns do the rest
          to = o.goal;
        }
      }
      if (!to) return null;
      // each takes its own spot across the goal, so the squad arrives spread out
      const live = moversOf(g), i = live.indexOf(m);
      const [gx, gy] = px(to), [cx, cy] = px(m.h);
      let dx = gx - cx, dy = gy - cy; const L0 = Math.hypot(dx, dy) || 1; dx /= L0; dy /= L0;
      const goal = openNear(gx - dy * 2 * (i - (live.length - 1) / 2), gy + dx * 2 * (i - (live.length - 1) / 2)) || to;
      return hexDist(goal, m.h) <= 1 ? null : goal;
    }
    function orderStep(m, goal) {
      const o = m.u.group.order;
      // down on its belly it would only crawl: up to a kneel first (Change Posture)
      if (m.prone && m.legsLost < 2 && !gripsOn(m).length) { m.prone = false; m.kneel = true; m.lyingLow = false; L(`${m.id} gets up to move on`); return; }
      m.covert = true;
      const n = stepToward(m, goal, runMove(m), 0);
      m.covert = false;
      if (n >= moveOf(m) - 1) m.runK = m.runPrev + 1;
      if (m.state !== "ok" || !m.h) return;
      const f = scanFoes(m).find(x => x.state === "ok" && x.h && los(m.h, x.h)); if (f) faceTo(m, f.h);
      L(`${m.id} ${{ flank: "works round the flank", assault: "closes in by cover", support: "moves up in support" }[o.kind]}`);
    }
    // a soldier with somewhere to go (assault, support, flank): one more option, to keep moving there, worth a third
    // more than its best other choice unless the step takes it into more fire than it stands in now
    function orderOption(m, opts, add, rNow) {
      const goal = orderGoal(m);
      if (!goal) return;
      // a man on his way somewhere doesn't lie down in the grass for want of a target
      for (let k = opts.length - 1; k >= 0; k--) if (opts[k].label === "lie-low") opts.splice(k, 1);
      const top0 = opts.reduce((a, b) => b.v > a.v ? b : a, { v: 0 });
      const next = stepHex(m.h, goal, moveOf(m));
      const vF = Math.max(top0.v, 0) + 0.35 * Math.max(0.02, Math.abs(top0.v)) - Math.max(0, risk(m, next, "") - rNow);
      add(vF, `${m.u.group.order.kind}@${goal.q},${goal.r}`, () => orderStep(m, goal));
    }
    // a soldier who knows of no foe itself, but whose squad has been told where to go, goes there instead of
    // searching: the side knows where the enemy is even when this man hasn't seen them
    function orderMove(m) {
      const goal = orderGoal(m);
      if (!goal) return false;
      orderStep(m, goal);
      return true;
    }
