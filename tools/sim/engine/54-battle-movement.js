// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ---- movement: greedy steps through free hexes toward a goal hex
    // Moving through friends (B368): a model may pass through an ally's hex for +1 movement point but not stop there.
    // A hop over a friend or an obstacle lands on the free hex beyond it.
    // a friend, or a foe 3+ SM smaller that a big model simply steps over for a movement point (Pyramid 3/77 p. 6)
    const friendAt = (m, k) => { const x = occ.get(k); return x && x !== m && (x.u.side === m.u.side || (x.state === "ok" && m.u.sm - x.u.sm >= 3)) ? x : null; };
    function hopTo(m, over, target, cost, ctx) {
      if (cost >= 6) {
        // too big to hop: the whole turn and a DX roll to clamber over (B352)
        if (!check(m.u.dx - skillPen(m)).ok) { m.prone = true; L(`${m.id} tries to climb the obstacle and falls`); return false; }
        L(`${m.id} clambers over the obstacle`);
      }
      place(m, target);
      return true;
    }
    // a mover under grenade threat (a known foe with a grenade left and within a move of throwing range) spreads out:
    // among the steps that gain as much ground, it takes the one with fewest squad-mates beside it (user direction:
    // charging mobs too)
    const nearFriends = (m, h) => { let c = 0; for (const [dq, dr] of DIRS) { const x = occ.get(key(h.q + dq, h.r + dr)); if (x && x !== m && x.u.side === m.u.side && x.state === "ok") c++; } return c; };
    // a stalker: a stealthy model (Stealth 14+ or a chameleon hide) that fights hand to hand and hasn't been seen
    const stalker = m => AWARE && m.h && (stealthOf(m.u) >= 14 || !!m.u.flags.chameleon || !!m.u.flags.chamShadow)
      && (!m.u.ranged || m.u.stance === "charge" || m.u.ai.melee > m.u.ai.ranged) && (seenAt[1 - m.u.side].get(m) ?? -99) < turn - 1;
    const grenadeThreat = m => known(m).some(f => f.h && f.state === "ok" && f.u.grenades.length && f.grenadesLeft.some(n => n > 0) && hexDist(f.h, m.h) <= Math.max(...f.u.grenades.map(g => g.range.max)) + moveOf(m));
    function stepToward(m, goal, steps, stopAt = 1) {
      if (m.prone) steps = Math.min(steps, 1);   // crawling (B551)
      let moved = 0;
      const spread = grenadeThreat(m), stalk = stalker(m);
      // a stalker near its prey moves at half Move (no -5 to Stealth) and keeps to steps the foe can't see, then the dark
      if (stalk && hexDist(m.h, goal) <= 20) steps = Math.min(steps, Math.max(1, Math.floor(moveOf(m) / 2)));
      const foesK = stalk ? known(m).filter(f => f.h) : [];
      const sc = n => (stalk ? (foesK.some(f => los(f.h, n)) ? 10 : 0) + (darkAt(n) <= -3 ? 0 : 1) : 0) + (spread ? nearFriends(m, n) : 0);
      const better = (n, d, bd, best) => d < bd || (d === bd && best && (sc(n) < sc(best) || (sc(n) === sc(best) && R() < 0.3)));
      if (terr) {
        // round the walls: each step goes to a free neighbour nearer the goal on foot, hopping crates it's big
        // enough to jump and friends in the way
        const cls = obstClass(m), cc = climbCls(m), F = field(goal, cls, cc);
        while (moved < steps) {
          const cur = F.get(key(m.h.q, m.h.r)) ?? 999, ci = idx(key(m.h.q, m.h.r));
          if (cur <= stopAt && los(m.h, goal)) break;
          let best = null, bd = cur, via = null, bc = 1;
          for (const [dq, dr] of DIRS) {
            const n = { q: m.h.q + dq, r: m.h.r + dr }, nk = key(n.q, n.r), i = idx(nk);
            if (i == null) continue;
            const e = climb(ci, i, cc);
            if (e === Infinity) continue;
            if (!occ.has(nk) && pass[i]) {
              if (e && moved + 1 + e > steps) continue;
              const d = F.get(nk) ?? 999;
              if (d < bd || (d === bd && best && !via && better(n, d, bd, best))) { bd = d; best = n; via = null; bc = 1 + e; }
              continue;
            }
            // a friend or an obstacle in the way: hop it to the free hex straight beyond
            const fr = friendAt(m, nk), ob = !fr && hops(cls, i);
            if (!fr && !ob) continue;
            const cost = fr ? 2 : ob;
            const b = { q: n.q + dq, r: n.r + dr }, bk = key(b.q, b.r), bi = idx(bk);
            if (bi == null || occ.has(bk) || !pass[bi] || closed[bi] || climb(i, bi, cc) === Infinity) continue;
            if (cost >= 6 ? moved > 0 : moved + cost + 1 > steps) continue;
            const d = F.get(bk) ?? 999;
            if (d < bd) { bd = d; best = b; via = n; bc = cost + 1; }
          }
          if (!best) break;
          const bi = idx(key(best.q, best.r));
          if (closed[bi]) { if (!moved) setDoor(bi, false, m); break; }   // opening a door is a Ready (B382)
          if (via) { if (!hopTo(m, via, best, bc - 1)) { moved = steps; break; } moved += bc >= 7 ? steps : bc; }
          else { place(m, best); moved += bc; }
          if (afterStep(m)) break;
        }
        if (moved) { m.moved = true; m.aimTurns = 0; m.follow = null; }
        return moved;
      }
      while (moved < steps && hexDist(m.h, goal) > stopAt) {
        let best = null, bd = hexDist(m.h, goal), via = null;
        for (const [dq, dr] of DIRS) {
          const n = { q: m.h.q + dq, r: m.h.r + dr }, nk = key(n.q, n.r);
          if (!taken(nk)) {
            const d = hexDist(n, goal);
            if (d < bd || (d === bd && (!best || better(n, d, bd, best)))) { bd = d; best = n; via = null; }
            continue;
          }
          // through a friend: +1 movement point, onto the hex beyond
          if (!friendAt(m, nk) || moved + 3 > steps) continue;
          const b = { q: n.q + dq, r: n.r + dr };
          if (taken(key(b.q, b.r))) continue;
          const d = hexDist(b, goal);
          if (d < bd) { bd = d; best = b; via = n; }
        }
        if (!best) break;
        place(m, best); moved += via ? 3 : 1;
        if (afterStep(m)) break;
      }
      if (moved) { m.moved = true; m.aimTurns = 0; m.follow = null; }
      return moved;
    }
    // breadth-first search through free hexes for the nearest hex from which a foe is within reach: a mob flows
    // around its own front rank and spreads over every foe with room left beside it, instead of queueing on one
    function engagePath(m, reach, pool, maxNodes = 2500) {
      const slots = new Map();
      for (const f of pool) {
        if (!f.h) continue;
        for (let dq = -reach; dq <= reach; dq++) for (let dr = Math.max(-reach, -dq - reach); dr <= Math.min(reach, -dq + reach); dr++) {
          if (!dq && !dr) continue;
          const k = key(f.h.q + dq, f.h.r + dr);
          if (!taken(k) && !slots.has(k) && (!ELEV || levelOK({ q: f.h.q + dq, r: f.h.r + dr }, m.u, f.h, f.u, { reachMax: reach }))) slots.set(k, f);
        }
      }
      if (!slots.size) return null;
      // a shield (and a storm shield's field) covers only the front and the shield side: go round to the weapon
      // side or the back when that's no more than two steps further (B287)
      const stalk = stalker(m);
      const guarded = (hk, f) => {
        // a stalker goes for the flank or the back (the front is a last resort)
        if (stalk) { const [q, r] = hk.split(",").map(Number); if (arcOf(f.h, f.facing, { q, r }) === "front") return true; }
        if (!(shieldDB(f) || (f.u.shield && f.u.shield.arc && f.sp > 0))) return false;
        const [q, r] = hk.split(",").map(Number), h = { q, r }, a = arcOf(f.h, f.facing, h);
        return a === "front" || (a === "side" && sideOf(f.h, f.facing, h) === "L");
      };
      const start = key(m.h.q, m.h.r), prev = new Map([[start, null]]), dist = new Map([[start, 0]]), q = [m.h], cc = climbCls(m);
      let fallback = null;
      const route = (hk, h) => {
        const path = [];
        for (let k = hk, n = h; k !== start; ) { path.unshift(n); const p = prev.get(k); k = key(p.q, p.r); n = p; }
        return { path, foe: slots.get(hk) };
      };
      for (let i = 0; i < q.length && prev.size < maxNodes; i++) {
        const h = q[i], hk = key(h.q, h.r);
        if (fallback && dist.get(hk) > fallback.d + 2) break;
        if (hk !== start && slots.has(hk)) {
          if (!guarded(hk, slots.get(hk))) return route(hk, h);
          if (!fallback) fallback = { hk, h, d: dist.get(hk) };
        }
        for (const [dq, dr] of DIRS) {
          const n = { q: h.q + dq, r: h.r + dr }, nk = key(n.q, n.r);
          if (prev.has(nk) || (taken(nk) && !friendAt(m, nk))) continue;   // friends can be passed through (B368)
          const e = EL ? climb(idx(hk), idx(nk), cc) : 0;
          if (e === Infinity) continue;
          prev.set(nk, h); dist.set(nk, dist.get(hk) + (taken(nk) ? 2 : 1) + e); q.push(n);
        }
      }
      return fallback ? route(fallback.hk, fallback.h) : null;
    }
    function followPath(m, path, steps) {
      if (m.prone) steps = Math.min(steps, 1);   // lying down it can only crawl, a yard a second (B551)
      let moved = 0;
      // still more than a move out and under grenade threat: head for the same end but fan out on the way
      if (path.length > steps + 1 && (grenadeThreat(m) || stalker(m))) return stepToward(m, path[path.length - 1], steps, 0);
      // a friend on the path is passed through for an extra movement point (B368), never stopped on
      let from = m.h;
      for (const n of path) {
        const nk = key(n.q, n.r), e = EL ? climb(idx(key(from.q, from.r)), idx(nk), climbCls(m)) : 0;
        if (moved >= steps || e === Infinity || (e && moved + 1 + e > steps)) break;
        from = n;
        if (taken(nk)) { if (friendAt(m, nk) && moved + 2 + e < steps) { moved += 2 + e; continue; } break; }
        place(m, n); moved += 1 + e; if (afterStep(m)) break;
      }
      if (moved) { m.moved = true; m.aimTurns = 0; m.follow = null; }
      return moved;
    }
    function nearestFoe(m, pool) {
      let best = null, bd = Infinity;
      for (const f of pool || foes(m)) { if (!f.h) continue; const d = hexDist(f.h, m.h); if (d < bd) { bd = d; best = f; } }
      return best;
    }

