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
  const battleMap = opt => opt.terrain || (opt.battlefield === "facility" ? facilityMap(opt.mapSeed || 1) : opt.battlefield === "ruins" ? ruinsMap(opt.mapSeed || 1) : null);

