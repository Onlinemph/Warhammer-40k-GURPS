  // ------------------------------------------------------------------ hex map
  // Axial coordinates (q, r), flat-topped hexes, 1 yard each (B384).
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const hexDist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
  // hexes strictly between a and b on the straight line (cube-coordinate lerp, nudged off hex edges)
  function lineHexes(a, b, s = 1) {
    const n = hexDist(a, b), out = [];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = a.q + (b.q - a.q) * t + 1e-6 * s, z = a.r + (b.r - a.r) * t + 1e-6 * s, y = -x - z;
      let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
      out.push({ q: rx, r: rz });
    }
    return out;
  }
  const px = h => [1.5 * h.q, Math.sqrt(3) * (h.r + h.q / 2)];
  const key = (q, r) => q + "," + r;
  const DIRANG = DIRS.map(([q, r]) => { const [x, y] = px({ q, r }); return Math.atan2(y, x); });
  // arc of `from` as seen by a model at `at` facing `facing`: front (3 hexes), side, rear (B385-386)
  function arcOf(at, facing, from) {
    const [ax, ay] = px(at), [bx, by] = px(from);
    let d = Math.abs(Math.atan2(by - ay, bx - ax) - DIRANG[facing]) * 180 / Math.PI;
    if (d > 180) d = 360 - d;
    return d <= 91 ? "front" : d <= 151 ? "side" : "rear";
  }
  // which side a figure in a side or front hex is on: "L" or "R" (the shield arm is the left)
  function sideOf(at, facing, from) {
    const [ax, ay] = px(at), [bx, by] = px(from);
    let d = Math.atan2(by - ay, bx - ax) - DIRANG[facing];
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    return d < 0 ? "L" : "R";
  }
  function faceToward(at, to) {
    const [ax, ay] = px(at), [bx, by] = px(to);
    const a = Math.atan2(by - ay, bx - ax);
    let best = 0, bd = 9;
    DIRANG.forEach((d, i) => { let x = Math.abs(a - d); if (x > Math.PI) x = 2 * Math.PI - x; if (x < bd) { bd = x; best = i; } });
    return best;
  }
  // offset (column, row) to axial, flat-topped "odd-q" layout: a column is a straight line of hexes
  const fromOffset = (col, row) => ({ q: col, r: row - (col - (col & 1)) / 2 });

  // ------------------------------------------------------------------ battlefields
  // A facility (user direction): long hallways three yards wide, cross corridors, rooms off them through doors,
  // staging bays at each end, and crates and barricades for cover. Walls block movement and sight; crates block
  // movement but not sight, and cover whoever crouches behind them. Built from a layout number, so every run of
  // a Monte Carlo fights over the same ground.
  const MAPS = new Map();
  function facilityMap(seed = 1) {
    seed = Math.max(1, Math.floor(seed));
    if (MAPS.has(seed)) return MAPS.get(seed);
    let st = (seed * 2654435761) >>> 0;
    const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const W = 64, H = 37, floor = new Set(), crates = new Map(), doors = new Set();
    const K = (c, r) => { const h = fromOffset(c, r); return key(h.q, h.r); };
    const carve = (c0, r0, c1, r1) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (c > 0 && r > 0 && c < W - 1 && r < H - 1) floor.add(K(c, r)); };
    carve(1, 1, 7, H - 2); carve(W - 8, 1, W - 2, H - 2);                     // staging bays
    const hy = [ri(8, 10), ri(17, 19), ri(26, 28)];                            // hallways
    for (const y of hy) carve(1, y - 1, W - 2, y + 1);
    const vx = [ri(19, 21), ri(31, 33), ri(43, 45)];                           // cross corridors, in pieces
    [[1, hy[0]], [hy[0], hy[1]], [hy[1], hy[2]], [hy[2], H - 2]].forEach(([a, b]) => vx.forEach(x => { if (rnd() < 0.55) carve(x - 1, a, x + 1, b); }));
    const bandsY = [[1, hy[0] - 3], [hy[0] + 3, hy[1] - 3], [hy[1] + 3, hy[2] - 3], [hy[2] + 3, H - 2]];
    const bandsX = [[9, vx[0] - 3], [vx[0] + 3, vx[1] - 3], [vx[1] + 3, vx[2] - 3], [vx[2] + 3, W - 10]];
    const rooms = [];
    for (const [y0, y1] of bandsY) for (const [x0, x1] of bandsX) {
      if (y1 - y0 < 1 || x1 - x0 < 2 || rnd() < 0.12) continue;
      carve(x0, y0, x1, y1); rooms.push([x0, y0, x1, y1]);
      // a door is the two wall hexes cut through to the hallway or corridor
      const door = (c0, r0, c1, r1) => { carve(c0, r0, c1, r1); for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) doors.add(K(c, r)); };
      const up = () => { const c = ri(x0, x1 - 1); door(c, y0 - 1, c + 1, y0 - 1); };
      const down = () => { const c = ri(x0, x1 - 1); door(c, y1 + 1, c + 1, y1 + 1); carve(c, y1 + 2, c + 1, y1 + 2); };
      const left = () => { const r = ri(y0, Math.max(y0, y1 - 1)); door(x0 - 1, r, x0 - 1, r + 1); carve(x0 - 2, r, x0 - 2, r + 1); };
      const right = () => { const r = ri(y0, Math.max(y0, y1 - 1)); door(x1 + 1, r, x1 + 1, r + 1); carve(x1 + 2, r, x1 + 2, r + 1); };
      if (y0 > 1 && (y1 >= H - 2 || rnd() < 0.5)) up(); else down();        // always a door to a hallway
      if (rnd() < 0.6) [up, down, left, right][ri(0, 3)]();
    }
    const spawn = [fromOffset(4, hy[1]), fromOffset(W - 5, hy[1])];
    // crates: a few per room and bay, and every several yards along the hallways; each kept only if every
    // floor hex stays reachable from the first bay
    const reach = () => {
      const k0 = key(spawn[0].q, spawn[0].r), seen = new Set([k0]), q = [spawn[0]];
      for (let i = 0; i < q.length; i++) for (const [dq, dr] of DIRS) {
        const n = { q: q[i].q + dq, r: q[i].r + dr }, nk = key(n.q, n.r);
        if (!seen.has(nk) && floor.has(nk) && !crates.has(nk)) { seen.add(nk); q.push(n); }
      }
      return seen.size;
    };
    const cands = [];
    for (const [x0, y0, x1, y1] of rooms) for (let i = 0; i < Math.floor((x1 - x0 + 1) * (y1 - y0 + 1) / 16); i++) cands.push([ri(x0, x1), ri(y0, y1)]);
    for (const y of hy) for (let c = 10 + ri(0, 4); c < W - 10; c += ri(5, 9)) if (rnd() < 0.75) cands.push([c, y + ri(-1, 1)]);
    for (const x0 of [2, W - 7]) for (let i = 0; i < 5; i++) cands.push([x0 + ri(0, 4), ri(3, H - 4)]);
    let want = reach();
    for (const [c, r] of cands) {
      const k = K(c, r);
      if (!floor.has(k) || crates.has(k) || doors.has(k) || spawn.some(sp => hexDist(sp, fromOffset(c, r)) <= 2)) continue;
      crates.set(k, rnd() < 0.5 ? "light" : "heavy");
      const got = reach();
      if (got < want - 1) crates.delete(k); else want = got;
    }
    // every hex inside the outer wall, as indices: floor, crates, doors and the interior walls (which can be
    // breached); the outer wall can't
    const ids = new Map(), hx = [];
    for (let c = 1; c < W - 1; c++) for (let r = 1; r < H - 1; r++) { const h = fromOffset(c, r), k = key(h.q, h.r); ids.set(k, hx.length); hx.push(h); }
    const nb = hx.map(h => DIRS.map(([dq, dr]) => ids.get(key(h.q + dq, h.r + dr))).filter(i => i != null));
    const ks = hx.map(h => key(h.q, h.r));
    const wallI = Uint8Array.from(ks, k => floor.has(k) ? 0 : 1), crateI = Uint8Array.from(ks, k => crates.has(k) ? 1 : 0), doorI = Uint8Array.from(ks, k => doors.has(k) ? 1 : 0);
    // line of sight and cover geometry never change, so they're cached per map; what a line crosses that can
    // change (walls, doors) is stored with it and checked against the battle's own state
    // lighting (B394): the bays and hallways are lit, the cross corridors dim (-2), and each room lit, dim (-3) or
    // dark (-7), drawn after everything else so the layout itself is unchanged
    const lightAt = new Map();
    for (const x of vx) for (let c = x - 1; c <= x + 1; c++) for (let r = 1; r < H - 1; r++) if (!hy.some(y => Math.abs(r - y) <= 1)) lightAt.set(K(c, r), -2);
    for (const [x0, y0, x1, y1] of rooms) { const v = rnd(), L0 = v < 0.4 ? 0 : v < 0.75 ? -3 : -7; for (let c = x0; c <= x1; c++) for (let r = y0; r <= y1; r++) lightAt.set(K(c, r), L0); }
    const light = Int8Array.from(ks, k => floor.has(k) ? lightAt.get(k) || 0 : 0);
    // elevation (B402, B407), from its own random stream so the layout and lighting above are unchanged: a gantry
    // 3 yards up along the back wall of each staging bay, reached by a stair (a yard a hex) at each end, and in some
    // rooms a loading dock 4 feet high along a wall without a door
    let st2 = (seed * 2246822519 + 3266489917) >>> 0;
    const rnd2 = () => { st2 = (st2 + 0x6D2B79F5) >>> 0; let t = st2; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri2 = (a, b) => a + Math.floor(rnd2() * (b - a + 1));
    const zAt = new Map(), clear = (c, r) => { const k = K(c, r); crates.delete(k); };
    for (const [c0, c1, dir] of [[1, 2, 1], [W - 3, W - 2, -1]]) {
      for (let c = c0; c <= c1; c++) for (let r = 1; r < H - 1; r++) zAt.set(K(c, r), 3);
      const edge = dir > 0 ? c1 : c0;
      for (const r of [ri2(3, hy[0] - 2), ri2(hy[2] + 2, H - 4)]) for (let st = 1; st <= 3; st++) { zAt.set(K(edge + dir * st, r), Math.max(0, 3 - st)); clear(edge + dir * st, r); }
    }
    for (const [x0, y0, x1, y1] of rooms) {
      if (rnd2() >= 0.35 || x1 - x0 < 4) continue;
      const doorBy = c => { for (let r = y0 - 1; r <= y1 + 1; r++) if (doors.has(K(c, r))) return true; return false; };
      const cs = !doorBy(x0 - 1) ? [x0, x0 + 1] : !doorBy(x1 + 1) ? [x1 - 1, x1] : null;
      if (!cs) continue;
      for (const c of cs) for (let r = y0; r <= y1; r++) zAt.set(K(c, r), 4 / 3);
    }
    const elev = Float32Array.from(ks, k => floor.has(k) ? zAt.get(k) || 0 : 0);
    for (let i = 0; i < ks.length; i++) if (crateI[i] && !crates.has(ks[i])) crateI[i] = 0;
    const map = { floor, crates, doors, spawn, W, H, ids, hx, nb, wallI, crateI, doorI, light, elev, lineC: new Map(), covC: new Map() };
    MAPS.set(seed, map);
    return map;
  }

  // ruins (user direction): a shattered city block. Open streets with rubble, and six to nine ruined buildings of one
  // to three storeys. Each storey is 3 yards; an upper floor that still stands covers part of its building (solid
  // beneath, in this one-surface-per-hex map), reached by a stair of 1-yard steps. Outer walls stand at full height in
  // places and are broken down elsewhere: to a parapet a yard and a bit above a floor, to a stump, to rubble (a
  // barricade) or to a gap. Each wall hex keeps its height for sight (wallTop)
  function ruinsMap(seed = 1) {
    seed = Math.max(1, Math.floor(seed));
    const mk = "ruins" + seed;
    if (MAPS.has(mk)) return MAPS.get(mk);
    let st = (seed * 3266489917 + 668265263) >>> 0;
    const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const W = 64, H = 37, floor = new Set(), crates = new Map(), doors = new Set(), zAt = new Map(), top = new Map(), inside = new Set();
    const K = (c, r) => { const h = fromOffset(c, r); return key(h.q, h.r); };
    for (let c = 1; c < W - 1; c++) for (let r = 1; r < H - 1; r++) floor.add(K(c, r));
    const xb = [[10, 22], [26, 38], [42, 53]], yb = [[2, 11], [14, 22], [25, 34]];
    const blds = [];
    for (const [bx0, bx1] of xb) for (const [by0, by1] of yb) {
      if (rnd() < 0.15) continue;   // an open square
      const x0 = bx0 + ri(0, 2), x1 = bx1 - ri(0, 2), y0 = by0 + ri(0, 1), y1 = by1 - ri(0, 1);
      const S = rnd() < 0.25 ? 1 : rnd() < 0.6 ? 2 : 3, Hb = 3 * S + 2;
      const b = { x0, y0, x1, y1, S, Hb, gaps: [] };
      blds.push(b);
      for (let c = x0 + 1; c < x1; c++) for (let r = y0 + 1; r < y1; r++) inside.add(K(c, r));
      // upper floors: the first covers the building's left or right part, the second the top or bottom of that
      if (S >= 2) {
        const left = rnd() < 0.5, w = x1 - x0 - 1, sw = Math.max(3, Math.min(w - 4, Math.round(w * (0.45 + rnd() * 0.2))));
        const sx0 = left ? x0 + 1 : x1 - sw, sx1 = left ? x0 + sw : x1 - 1;
        for (let c = sx0; c <= sx1; c++) for (let r = y0 + 1; r < y1; r++) zAt.set(K(c, r), 3);
        let ry0 = -1, ry1 = -2;
        const third = S === 3 && y1 - y0 >= 7, up = rnd() < 0.5;
        if (third) { const h = y1 - y0 - 1, sh = Math.max(2, Math.round(h * 0.45)); ry0 = up ? y0 + 1 : y1 - sh; ry1 = up ? y0 + sh : y1 - 1; }
        // a stair down into the ground floor: 2 then 1 yard, on a row clear of the walls and of the floor above
        const rows = []; for (let r = y0 + 2; r <= y1 - 2; r++) if (r < ry0 - 1 || r > ry1 + 1) rows.push(r);
        const sr = rows.length ? rows[ri(0, rows.length - 1)] : y1 - 2, dir = left ? 1 : -1, e = left ? sx1 : sx0;
        zAt.set(K(e + dir, sr), 2); zAt.set(K(e + 2 * dir, sr), 1);
        b.stair = [K(e + dir, sr), K(e + 2 * dir, sr), K(e + 3 * dir, sr)];
        if (third) {
          for (let c = sx0; c <= sx1; c++) for (let r = ry0; r <= ry1; r++) zAt.set(K(c, r), 6);
          const sc = ri(sx0 + 1, sx1 - 1), d2 = up ? 1 : -1, e2 = up ? ry1 : ry0;
          zAt.set(K(sc, e2 + d2), 5); zAt.set(K(sc, e2 + 2 * d2), 4);
          b.stair.push(K(sc, e2 + d2), K(sc, e2 + 2 * d2), K(sc, e2 + 3 * d2));
        } else if (S === 3) b.S = S - 1;
      }
      // the outer wall, hex by hex
      const zIn = (c, r) => zAt.get(K(Math.max(x0 + 1, Math.min(x1 - 1, c)), Math.max(y0 + 1, Math.min(y1 - 1, r)))) || 0;
      for (let c = x0; c <= x1; c++) for (let r = y0; r <= y1; r++) {
        if (c > x0 && c < x1 && r > y0 && r < y1) continue;
        const k = K(c, r), corner = (c === x0 || c === x1) && (r === y0 || r === y1), zi = zIn(c, r), v = rnd();
        if (!corner && v < 0.16) { b.gaps.push([c, r, zi]); continue; }                          // a gap: open floor
        if (!corner && v < 0.32) { crates.set(k, rnd() < 0.7 ? "heavy" : "light"); continue; }    // fallen to rubble
        floor.delete(k);
        const full = corner || v < 0.62;
        top.set(k, full ? 3 * b.S + 2 : Math.min(3 * b.S + 2, zi > 0 ? zi + 1.2 : [2, 4.2, 7.2][ri(0, Math.max(0, b.S - 1))]));
      }
      // at least two ways in at street level
      for (let tries = 0; b.gaps.filter(g => g[2] === 0).length < 2 && tries < 60; tries++) {
        const side = ri(0, 3), c = side < 2 ? ri(x0 + 1, x1 - 1) : side === 2 ? x0 : x1, r = side < 2 ? (side ? y1 : y0) : ri(y0 + 1, y1 - 1);
        if (zIn(c, r) > 0 || b.gaps.some(g => g[0] === c && g[1] === r)) continue;
        const k = K(c, r); floor.add(k); top.delete(k); crates.delete(k); b.gaps.push([c, r, 0]);
      }
    }
    const spawn = [fromOffset(4, Math.floor(H / 2)), fromOffset(W - 5, Math.floor(H / 2))];
    // rubble in the streets and the deployment zones, kept only if every street hex stays reachable
    const reach = () => {
      const k0 = key(spawn[0].q, spawn[0].r), seen = new Set([k0]), q = [spawn[0]];
      for (let i = 0; i < q.length; i++) for (const [dq, dr] of DIRS) {
        const n = { q: q[i].q + dq, r: q[i].r + dr }, nk = key(n.q, n.r);
        if (!seen.has(nk) && floor.has(nk) && !crates.has(nk) && Math.abs((zAt.get(nk) || 0) - (zAt.get(key(q[i].q, q[i].r)) || 0)) <= 1.01) { seen.add(nk); q.push(n); }
      }
      return seen.size;
    };
    let want = reach();
    for (let i = 0; i < 70; i++) {
      const c = ri(2, W - 3), r = ri(2, H - 3), k = K(c, r);
      if (!floor.has(k) || crates.has(k) || inside.has(k) || zAt.get(k) || spawn.some(sp => hexDist(sp, fromOffset(c, r)) <= 2)) continue;
      crates.set(k, rnd() < 0.45 ? "heavy" : "light");
      const got = reach();
      if (got < want - 1) crates.delete(k); else want = got;
    }
    // rubble that walls off a stair or a gap goes
    for (const b of blds) { for (const k of b.stair || []) crates.delete(k); for (const [c, r] of b.gaps) crates.delete(K(c, r)); }
    const ids = new Map(), hx = [];
    for (let c = 1; c < W - 1; c++) for (let r = 1; r < H - 1; r++) { const h = fromOffset(c, r), k = key(h.q, h.r); ids.set(k, hx.length); hx.push(h); }
    const nb = hx.map(h => DIRS.map(([dq, dr]) => ids.get(key(h.q + dq, h.r + dr))).filter(i => i != null));
    const ks = hx.map(h => key(h.q, h.r));
    const wallI = Uint8Array.from(ks, k => floor.has(k) ? 0 : 1), crateI = Uint8Array.from(ks, k => crates.has(k) ? 1 : 0), doorI = new Uint8Array(ks.length);
    // the ground floors inside the shells are dim (-2): smoke, dust, the floor above
    const light = Int8Array.from(ks, k => floor.has(k) && inside.has(k) && !zAt.get(k) ? -2 : 0);
    const elev = Float32Array.from(ks, k => floor.has(k) ? zAt.get(k) || 0 : 0);
    const wallTop = Float32Array.from(ks, k => floor.has(k) ? 0 : top.get(k) || 99);
    const map = { kind: "ruins", floor, crates, doors, spawn, W, H, ids, hx, nb, wallI, crateI, doorI, light, elev, wallTop, lineC: new Map(), covC: new Map() };
    MAPS.set(mk, map);
    return map;
  }
  // ------------------------------------------------------------------ more battlefields (user direction)
  // Five more grounds, built on the two kinds above so the fight needs no new rules: an indoor one is a facility
  // (walls to the roof), an outdoor one is ruins (walls of any height, sight over whatever stands lower than the eye,
  // a wall a yard and a bit high a parapet to whoever stands behind it). Each comes from a layout number too.
  function mapKit(name, seed, W = 64, H = 37) {
    let st = (Math.max(1, Math.floor(seed)) * 2246822519 + name.length * 40503 + name.charCodeAt(0) * 9176) >>> 0;
    const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const floor = new Set(), crates = new Map(), doors = new Set(), zAt = new Map(), top = new Map(), lightAt = new Map(), water = new Set();
    const K = (c, r) => { const h = fromOffset(c, r); return key(h.q, h.r); };
    const inside = (c, r) => c > 0 && r > 0 && c < W - 1 && r < H - 1;
    const each = (c0, r0, c1, r1, f) => { for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) if (inside(c, r)) f(K(c, r), c, r); };
    const carve = (c0, r0, c1, r1) => each(c0, r0, c1, r1, k => { floor.add(k); top.delete(k); water.delete(k); });
    const wall = (c0, r0, c1, r1, h = 99) => each(c0, r0, c1, r1, k => { floor.delete(k); crates.delete(k); top.set(k, h); });
    const spawn = [fromOffset(4, Math.floor(H / 2)), fromOffset(W - 5, Math.floor(H / 2))];
    // how much floor can be walked to from the first deployment zone (a step of more than a yard up or down is a wall)
    const reach = () => {
      const seen = new Set([key(spawn[0].q, spawn[0].r)]), q = [spawn[0]];
      for (let i = 0; i < q.length; i++) for (const [dq, dr] of DIRS) {
        const n = { q: q[i].q + dq, r: q[i].r + dr }, nk = key(n.q, n.r);
        if (!seen.has(nk) && floor.has(nk) && !crates.has(nk) && Math.abs((zAt.get(nk) || 0) - (zAt.get(key(q[i].q, q[i].r)) || 0)) <= 1.01) { seen.add(nk); q.push(n); }
      }
      return seen.size;
    };
    // cover objects at the given offsets, each kept only if nothing is cut off by it
    const cover = (spots, heavy = 0.5) => {
      let want = reach();
      for (const [c, r] of spots) {
        const k = K(c, r);
        if (!inside(c, r) || !floor.has(k) || crates.has(k) || doors.has(k) || spawn.some(sp => hexDist(sp, fromOffset(c, r)) <= 3)) continue;
        crates.set(k, rnd() < heavy ? "heavy" : "light");
        const got = reach();
        if (got < want - 1) crates.delete(k); else want = got;
      }
    };
    const finish = (kind, extra = {}) => {
      const ids = new Map(), hx = [];
      for (let c = 1; c < W - 1; c++) for (let r = 1; r < H - 1; r++) { const h = fromOffset(c, r), k = key(h.q, h.r); ids.set(k, hx.length); hx.push(h); }
      const nb = hx.map(h => DIRS.map(([dq, dr]) => ids.get(key(h.q + dq, h.r + dr))).filter(i => i != null));
      const ks = hx.map(h => key(h.q, h.r));
      for (const k of doors) if (!floor.has(k)) doors.delete(k);
      const wallI = Uint8Array.from(ks, k => floor.has(k) ? 0 : 1), crateI = Uint8Array.from(ks, k => crates.has(k) ? 1 : 0), doorI = Uint8Array.from(ks, k => doors.has(k) ? 1 : 0);
      const light = Int8Array.from(ks, k => floor.has(k) ? lightAt.get(k) || 0 : 0);
      const elev = Float32Array.from(ks, k => floor.has(k) ? zAt.get(k) || 0 : 0);
      const map = { kind, style: name, floor, crates, doors, spawn, W, H, ids, hx, nb, wallI, crateI, doorI, light, elev, water, lineC: new Map(), covC: new Map(), ...extra };
      if (kind === "ruins") map.wallTop = Float32Array.from(ks, k => floor.has(k) ? 0 : top.get(k) ?? 99);
      return map;
    };
    return { W, H, rnd, ri, floor, crates, doors, zAt, top, lightAt, water, K, each, carve, wall, spawn, cover, finish };
  }
  const builtMap = (name, seed, make) => { const mk = name + Math.max(1, Math.floor(seed)); if (!MAPS.has(mk)) MAPS.set(mk, make(mapKit(name, seed))); return MAPS.get(mk); };

  // A space hulk: corridors one yard wide between junctions, a few cramped chambers, bulkhead doors, much of it dark
  const hulkMap = (seed = 1) => builtMap("hulk", seed, M => {
    const { W, H, rnd, ri, carve, doors, lightAt, K, each } = M;
    carve(1, 14, 5, 22); carve(W - 6, 14, W - 2, 22);                                         // the boarding bays
    const xs = [9, 15, 21, 27, 33, 39, 45, 51, 54], ys = [3, 9, 15, 21, 27, 33];
    const id = (i, j) => i * ys.length + j, group = xs.flatMap((_, i) => ys.map((_, j) => id(i, j)));
    const find = a => { while (group[a] !== a) a = group[a] = group[group[a]]; return a; };
    const edges = [];
    xs.forEach((_, i) => ys.forEach((_, j) => { if (i + 1 < xs.length) edges.push([i, j, i + 1, j]); if (j + 1 < ys.length) edges.push([i, j, i, j + 1]); }));
    for (let i = edges.length - 1; i > 0; i--) { const j = ri(0, i); [edges[i], edges[j]] = [edges[j], edges[i]]; }
    const dig = ([i0, j0, i1, j1]) => {
      carve(xs[i0], ys[j0], xs[i1], ys[j1]);
      if (rnd() < 0.22) { const c = Math.round((xs[i0] + xs[i1]) / 2), r = Math.round((ys[j0] + ys[j1]) / 2); doors.add(K(c, r)); }   // a bulkhead across the corridor
    };
    // every junction joined to every other by one way round, then some loops so there is a way to flank
    for (const e of edges) { const a = find(id(e[0], e[1])), b = find(id(e[2], e[3])); if (a !== b) { group[a] = b; dig(e); } else if (rnd() < 0.22) dig(e); }
    xs.forEach((x, i) => ys.forEach((y, j) => {
      if (rnd() < 0.3) { carve(x - 1, y - 1, x + 1, y + 1); const dark = rnd() < 0.5 ? -7 : -3; each(x - 1, y - 1, x + 1, y + 1, k => lightAt.set(k, dark)); }
    }));
    carve(6, 15, 9, 15); carve(6, 21, 9, 21); carve(W - 10, 15, W - 7, 15); carve(W - 10, 21, W - 7, 21);   // the bays' hatches
    for (const k of M.floor) if (!lightAt.has(k) && rnd() < 0.55) lightAt.set(k, -3);            // failing lumens
    M.cover([[3, 16], [3, 20], [W - 4, 16], [W - 4, 20], ...xs.flatMap(x => ys.map(y => [x + ri(-1, 1), y + ri(-1, 1)])).filter(() => rnd() < 0.25)]);
    return M.finish("facility");
  });

  // An outpost on open ground: a handful of standing buildings with doorways and firing slits, barricades between
  // them, and a low hill off to one side
  const outpostMap = (seed = 1) => builtMap("outpost", seed, M => {
    const { W, H, rnd, ri, carve, wall, zAt, lightAt, K, each } = M;
    carve(1, 1, W - 2, H - 2);
    const hillTop = rnd() < 0.5, hc = ri(22, 42), hr = hillTop ? ri(4, 7) : ri(H - 8, H - 5);
    each(hc - 9, hr - 6, hc + 9, hr + 6, (k, c, r) => { const z = Math.round(3 - Math.hypot((c - hc) * 0.75, r - hr) / 1.6); if (z > 0) zAt.set(k, Math.min(3, z)); });
    const made = [];
    for (let tries = 0; made.length < 6 && tries < 60; tries++) {
      const w = ri(5, 9), h = ri(4, 6), x0 = ri(12, W - 13 - w), y0 = hillTop ? ri(13, H - 3 - h) : ri(2, H - 14 - h), x1 = x0 + w, y1 = y0 + h;
      if (made.some(([a, b, c, d]) => x0 <= c + 3 && x1 >= a - 3 && y0 <= d + 3 && y1 >= b - 3)) continue;
      made.push([x0, y0, x1, y1]);
      const tall = 5 + 3 * ri(0, 1);
      wall(x0, y0, x1, y0, tall); wall(x0, y1, x1, y1, tall); wall(x0, y0, x0, y1, tall); wall(x1, y0, x1, y1, tall);
      each(x0 + 1, y0 + 1, x1 - 1, y1 - 1, k => lightAt.set(k, -2));
      // two doorways, and slits a man can fire through along the long walls
      const ways = [[ri(x0 + 1, x1 - 2), y0, 1, 0], [ri(x0 + 1, x1 - 2), y1, 1, 0], [x0, ri(y0 + 1, y1 - 2), 0, 1], [x1, ri(y0 + 1, y1 - 2), 0, 1]];
      const a = ri(0, 3), b = (a + ri(1, 3)) % 4;
      for (const i of [a, b]) { const [c, r, dc, dr] = ways[i]; carve(c, r, c + dc, r + dr); }
      for (let c = x0 + 1; c < x1; c++) for (const r of [y0, y1]) if (!M.floor.has(K(c, r)) && rnd() < 0.28) wall(c, r, c, r, 1.2);
    }
    const spots = [];
    for (let i = 0; i < 46; i++) spots.push([ri(9, W - 10), ri(2, H - 3)]);
    M.cover(spots.filter(([c, r]) => !zAt.get(K(c, r))), 0.6);
    return M.finish("ruins", { theme: "desert" });
  });

  // Trench lines: two belts of breastworks on each side with sally ports and communication trenches, and a
  // cratered no-man's-land between. Whoever stands behind a parapet fires over it and is covered to the chest.
  const trenchMap = (seed = 1) => builtMap("trenches", seed, M => {
    const { W, H, rnd, ri, carve, wall, K } = M;
    carve(1, 1, W - 2, H - 2);
    const line = (x, front) => {           // a trench two yards wide at columns x, x+1, parapets either side
      const gaps = new Set(); for (let r = ri(3, 6); r < H - 3; r += ri(6, 9)) { gaps.add(r); gaps.add(r + 1); }
      for (let r = 1; r < H - 1; r++) for (const c of [x - 1, x + 2]) if (!gaps.has(r) || c !== front) wall(c, r, c, r, 1.2);
      const back = front === x - 1 ? x + 2 : x - 1;
      for (let r = ri(4, 8); r < H - 3; r += ri(7, 10)) carve(back, r, back, r + 1);     // ways in from behind
      return gaps;
    };
    const lines = [[11, 13], [19, 21], [W - 21, W - 22], [W - 13, W - 14]];    // [first column, the side that faces the foe]
    for (const [x, front] of lines) line(x, front);
    // communication trenches between a side's two lines, parapets on both flanks
    for (const [xa, xb] of [[13, 18], [W - 20, W - 15]]) for (let n = 0, r = ri(5, 9); n < 3 && r < H - 5; n++, r += ri(9, 12)) {
      wall(xa, r - 1, xb, r - 1, 1.2); wall(xa, r + 2, xb, r + 2, 1.2); carve(xa - 1, r, xb + 1, r + 1);
    }
    // a strongpoint on each front line: a pillbox with a slit toward the foe and its door into the trench
    for (const [x, dir] of [[23, 1], [W - 24, -1]]) { const r = ri(8, H - 12); wall(x - 1, r - 1, x + 1, r + 2, 4); carve(x, r, x, r + 1); carve(x - dir, r, x - dir, r); wall(x + dir, r, x + dir, r + 1, 1.2); }
    const spots = [];
    for (let i = 0; i < 60; i++) spots.push([ri(25, W - 26), ri(2, H - 3)]);     // shell holes and wreckage in no-man's-land
    M.cover(spots, 0.45);
    for (let i = 0; i < 5; i++) { const c = ri(27, W - 28), r = ri(3, H - 5); wall(c, r, c + ri(0, 1), r + ri(0, 2), 2); }   // stumps of walls
    return M.finish("ruins", { theme: "urban" });
  });

  // City streets: standing blocks nobody can enter, streets three yards wide between them, the odd alley a yard
  // wide cut through a block, squares where a block has come down, and barricades across the roads
  const streetsMap = (seed = 1) => builtMap("streets", seed, M => {
    const { W, H, rnd, ri, carve, wall } = M;
    carve(1, 1, W - 2, H - 2);
    const xb = [[10, 21], [25, 38], [42, 53]], yb = [[2, 10], [14, 22], [26, 34]], spots = [];
    for (const [x0, x1] of xb) for (const [y0, y1] of yb) {
      if (rnd() < 0.14) { for (let i = 0; i < 7; i++) spots.push([ri(x0, x1), ri(y0, y1)]); continue; }    // a square full of rubble
      wall(x0, y0, x1, y1, 3 * ri(2, 4) + 2);
      if (rnd() < 0.45) { const c = ri(x0 + 3, x1 - 3); carve(c, y0, c, y1); }                               // an alley through
      if (rnd() < 0.3) { const r = ri(y0 + 2, y1 - 2); carve(x0, r, x1, r); }
      if (rnd() < 0.35) carve(ri(x0 + 1, x1 - 4), ri(y0 + 1, y1 - 3), ri(x0 + 3, x1 - 1), y1 - 1 + 0 * ri(0, 1));   // a courtyard, reached only by an alley if at all
    }
    for (const x of [8, 23, 40, 55]) for (const y of [6, 18, 30]) if (rnd() < 0.6) spots.push([x + ri(-1, 1), y + ri(-2, 2)], [x + ri(-1, 1), y + ri(-2, 2)]);
    for (const y of [12, 24]) for (const x of [15, 31, 47]) if (rnd() < 0.6) spots.push([x + ri(-3, 3), y + ri(-1, 1)], [x + ri(-3, 3), y + ri(-1, 1)]);
    M.cover(spots, 0.6);
    return M.finish("ruins", { theme: "urban" });
  });

  // A river crossing: water nobody can wade and nothing blocks sight across, two or three bridges and a ford, and
  // what cover there is at the bridgeheads
  const riverMap = (seed = 1) => builtMap("river", seed, M => {
    const { W, H, rnd, ri, carve, wall, water, K, each } = M;
    carve(1, 1, W - 2, H - 2);
    const phase = rnd() * 6.28, bend = 2 + rnd() * 2.5, mid = r => Math.round(W / 2 + bend * Math.sin(r / 5.5 + phase));
    for (let r = 1; r < H - 1; r++) each(mid(r) - 3, r, mid(r) + 2, r, k => { M.floor.delete(k); M.top.set(k, 0.02); water.add(k); });
    const rows = [ri(4, 8), ri(15, 21), ri(28, 32)], spots = [];
    rows.forEach((r, i) => {
      if (i === 1 && rnd() < 0.4) return;                                  // the middle bridge is down as often as not
      const wide = i === 1 ? 1 : 0;
      carve(mid(r) - 4, r, mid(r) + 3, r + wide);
      for (const c of [mid(r) - 6, mid(r) - 5, mid(r) + 4, mid(r) + 5]) spots.push([c, r - 1], [c, r + wide + 1]);
    });
    const ford = ri(10, 26); carve(mid(ford) - 4, ford, mid(ford) + 3, ford);
    for (let i = 0; i < 40; i++) spots.push([ri(9, W - 10), ri(2, H - 3)]);
    M.cover(spots, 0.55);
    for (let i = 0; i < 6; i++) { const c = rnd() < 0.5 ? ri(12, 24) : ri(W - 25, W - 13), r = ri(3, H - 6); wall(c, r, c + ri(1, 3), r, rnd() < 0.5 ? 1.2 : 5); }   // field walls on the banks
    return M.finish("ruins", { theme: "jungle" });
  });
  const BATTLEFIELDS = { facility: facilityMap, ruins: ruinsMap, hulk: hulkMap, outpost: outpostMap, trenches: trenchMap, streets: streetsMap, river: riverMap };
  const battleMap = opt => opt.terrain || (BATTLEFIELDS[opt.battlefield] ? BATTLEFIELDS[opt.battlefield](opt.mapSeed || 1) : null);

