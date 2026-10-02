// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ---- elevation, in yards above the ground: a facility's gantries and docks, or on open ground a ridge held by one
    // side ({ side, height }): a plateau from 3 yards in front of that side's line back, sloping down to the plain
    // over twice its height (at least 6 yards)
    const EL = terr && terr.elev && terr.elev.some(z => z) ? terr.elev : null;
    const RIDGE = !terr && opt.ridge && opt.ridge.height > 0 ? (() => {
      const H = Math.min(30, +opt.ridge.height), side = opt.ridge.side ? 1 : 0;
      return { H, side, qc: side ? distance - 3 : 3, dir: side ? -1 : 1, S: Math.max(6, 2 * H) };
    })() : null;
    const ridgeZ = q => { const x = RIDGE.dir * (q - RIDGE.qc); return x <= 0 ? RIDGE.H : x >= RIDGE.S ? 0 : RIDGE.H * (1 - x / RIDGE.S); };
    const ELEV = !!(EL || RIDGE);
    const elevAt = h => !h || !ELEV ? 0 : EL ? EL[idx(key(h.q, h.r))] || 0 : ridgeZ(h.q);
    // firing up and down (B407): +1 yard of effective range a yard the target is above, -1 for every two yards it's
    // below (to no less than half the ground distance)
    const rngD = (a, b, d) => {
      if (!ELEV || !a || !b) return d;
      const dz = elevAt(b) - elevAt(a);
      if (dz > 0) return d + Math.round(dz);
      const sub = Math.floor(-dz / 2);
      return sub ? Math.max(Math.ceil(d / 2), d - sub) : d;
    };
    // a line over the ridge's crest from a point za yards above a's ground to one zb above b's: clear if it passes
    // above the crest (the plateau's edge is the only point that can block it)
    function overCrest(a, b, za, zb) {
      const { qc } = RIDGE;
      if ((a.q - qc) * (b.q - qc) >= 0) return true;
      const t = (qc - a.q) / (b.q - a.q), z0 = ridgeZ(a.q) + za, z1 = ridgeZ(b.q) + zb;
      return z0 + t * (z1 - z0) >= RIDGE.H - 1e-6;
    }
    // the hexes a line crosses that could block it (walls, doors), or null if it leaves the facility
    // in the ruins, sight runs from eyes 1.6 yards above the floor to the same height over the target's: a wall blocks
    // it only where it stands taller than the line, and a floor (or the solid mass under an upper floor) taller than
    // the line blocks it outright
    const WT = terr && terr.wallTop ? terr.wallTop : null;
    function lineBlockers(a, b, sgn) {
      const n = hexDist(a, b), out = [];
      const za = WT ? terr.elev[idx(key(a.q, a.r))] + 1.6 : 0, zb = WT ? terr.elev[idx(key(b.q, b.r))] + 1.6 : 0;
      for (let i = 1; i < n; i++) {
        const t = i / n, x = a.q + (b.q - a.q) * t + 1e-6 * sgn, z = a.r + (b.r - a.r) * t + 1e-6 * sgn, y = -x - z;
        let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
        const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
        if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
        const j = idx(key(rx, rz));
        if (j == null) return null;
        if (WT) {
          const lz = za + (zb - za) * t;
          if (terr.wallI[j] ? WT[j] <= lz : terr.elev[j] <= lz) continue;
          if (!terr.wallI[j]) return null;
        }
        if (terr.wallI[j] || terr.doorI[j]) { out.push(j); if (out.length > 4) return null; }   // past four walls: no line
      }
      return out;
    }
    function lineEntry(a, b) {
      const k = NK(a.q, a.r) * 16777216 + NK(b.q, b.r);
      let e = terr.lineC.get(k);
      if (e === undefined) { e = [lineBlockers(a, b, 1), lineBlockers(a, b, -1)]; if (terr.lineC.size > 3e6) terr.lineC.clear(); terr.lineC.set(k, e); }
      return e;
    }
    const lineOpen = L2 => L2 !== null && L2.every(i => !blocker(i));
    // line of sight: either of the two lines nudged off the hex edges is clear (a figure at a corner can be seen)
    function los(a, b) {
      if (!a || !b) return true;
      if (!terr) return !RIDGE || overCrest(a, b, 1.6, 1.6);
      const e = lineEntry(a, b);
      return lineOpen(e[0]) || lineOpen(e[1]);
    }
    // cover for a figure on hex h against fire from hex f (B407): a crate in the next hex toward the shooter
    // hides its legs and groin; a wall edge that only one of the two lines clears (a corner or a door frame)
    // hides more of it; on open ground, the side's cover setting while it stands still
    // cover for h against fire from f: { kind, i } with i the crate hex (for wear) or -1
    function coverOf(h, f, m) {
      if (terr && h && f && hexDist(h, f) > 1) {
        const k = NK(h.q, h.r) * 16777216 + NK(f.q, f.r);
        let c = terr.covC.get(k);
        if (c === undefined) {
          const a = lineHexes(h, f, 1)[0], b = lineHexes(h, f, -1)[0];
          c = [idx(key(a.q, a.r)), idx(key(b.q, b.r))].filter(i => i != null && terr.crateI[i]);
          if (terr.covC.size > 3e6) terr.covC.clear();
          terr.covC.set(k, c);
        }
        for (const i of c) if (!crateGone[i]) return { kind: terr.crates.get(key(terr.hx[i].q, terr.hx[i].r)) === "heavy" ? "barricade" : "crate", i };
        // a broken wall in front of a target whose head clears it but whose waist doesn't: a parapet (ruins)
        if (WT) {
          const hi = idx(key(h.q, h.r)), fi = idx(key(f.q, f.r)), n = hexDist(h, f);
          for (const x of [lineHexes(h, f, 1)[0], lineHexes(h, f, -1)[0]]) {
            const j = idx(key(x.q, x.r));
            if (j == null || !terr.wallI[j] || broken[j] || hi == null || fi == null) continue;
            const zw = terr.elev[hi] + 0.9, zf = terr.elev[fi] + 1.6, lz = zw + (zf - zw) / n;
            if (WT[j] > lz && los(h, f)) return { kind: "parapet", i: -1 };
          }
        }
        const e = lineEntry(h, f);
        if (lineOpen(e[0]) !== lineOpen(e[1])) return { kind: "corner", i: -1 };
      }
      // hull-down behind the ridge's crest: the head and shoulders clear it, the legs don't
      if (RIDGE && h && f && !terr && overCrest(f, h, 1.6, 1.6) && !overCrest(f, h, 1.6, 0.9)) return { kind: "crest", i: -1 };
      return { kind: m && cover[m.u.side] !== "none" && !m.moved ? cover[m.u.side] : "none", i: -1 };
    }
    const coverAt = (h, f, m) => coverOf(h, f, m).kind;
    // ---- height (B402-403, Pyramid 3/77 p. 4-5): effective SM is full SM upright, one less horizontal, two less
    // legless; effective height is the Size Modifier Table's longest dimension. Fliers ignore height
    const HFT = { "-4": 1.5, "-3": 2, "-2": 3, "-1": 4.5, "0": 6, "1": 9, "2": 15, "3": 21, "4": 30, "5": 45, "6": 60 };
    const heightOf = u => HFT[Math.max(-4, Math.min(6, (u.sm || 0) - (u.body === "horizontal" ? 1 : u.body === "legless" ? 2 : 0)))];
    // vertical difference in feet for att striking t with weapon w (positive: att is higher), less 3 feet for each
    // yard of the attacker's reach past the first (B403)
    // fighting across a level change (B402): over six feet between a man's feet and his foe's (more for big fighters,
    // less with a long weapon) and they can't reach each other
    function levelOK(ah, au, th, tu, w) {
      if (!ELEV || !ah || !th || au.body === "flying" || tu.body === "flying") return true;
      const dz = 3 * Math.abs(elevAt(ah) - elevAt(th));
      return dz - Math.max(heightOf(au), heightOf(tu)) - 3 * Math.max(0, ((w && w.reachMax) || 1) - 1) <= 0.01;
    }
    function vdiff(att, t, w) {
      if (!att || !t || !att.u || att.u.body === "flying" || t.u.body === "flying") return 0;
      const raw = heightOf(att.u) - heightOf(t.u) + 3 * (elevAt(att.h) - elevAt(t.h)), mit = 3 * Math.max(0, ((w && w.reachMax) || 1) - 1);
      return Math.sign(raw) * Math.max(0, Math.abs(raw) - mit);
    }
    const HEADL = new Set(["skull", "face", "eye", "neck"]), LEGL = new Set(["leg", "foot"]);
    // the hit-location modifier for a melee blow across a height difference, or null if the location is out of reach:
    // the higher fighter -2 at the legs and feet and +1 at the head and neck (up to 5 feet), can't reach the legs from
    // 4 feet, and from 6 feet reaches only the head, neck, arms and torso (Pyramid: a bigger fighter isn't limited to
    // the head); the lower fighter +2 at the legs, -2 at the head, can't reach the head from 5 feet and only the legs
    // and feet from 6
    function heightLoc(att, t, w, loc) {
      const D = vdiff(att, t, w), a = Math.abs(D);
      if (a <= 1 || loc === "random") return 0;
      const l = loc.replace("#c", "");
      if (D > 0) {
        if (a >= 6) return HEADL.has(l) || l === "arm" || l === "hand" || l === "torso" || l === "vitals" ? 0 : null;
        if (a >= 4 && LEGL.has(l)) return null;
        return LEGL.has(l) ? -2 : HEADL.has(l) ? 1 : 0;
      }
      if (a >= 6) return LEGL.has(l) ? 0 : null;
      if (a >= 5 && HEADL.has(l) && l !== "neck") return null;
      return LEGL.has(l) ? 2 : HEADL.has(l) ? -2 : 0;
    }
    // where a random blow lands when part of the target is out of reach
    function reachLoc(att, t, w, loc) {
      if (heightLoc(att, t, w, loc) !== null) return loc;
      return vdiff(att, t, w) > 0 ? "torso" : R() < 0.8 ? "leg" : "foot";
    }
    // the defence modifier: the lower fighter -1 at 3 feet, -2 at 4, -3 at 5 or more; the higher fighter as much better
    const heightDef = (t, att, w) => { const D = vdiff(att, t, w), a = Math.abs(D), k = a >= 5 ? 3 : a >= 4 ? 2 : a >= 3 ? 1 : 0; return D > 0 ? -k : k; };
    const darkAt = h => { if (LIGHT === "lit" || !h) return 0; if (LIGHT === "dark") return -7; const i = idx(key(h.q, h.r)); return i == null || !terr.light ? 0 : terr.light[i]; };
    // what darkness at t's hex costs viewer v to see or strike it: less Night Vision, nothing with Dark Vision, nor with
    // Infravision against a warm body (B47, B60, B71, B394)
    const darkPen = (v, t) => { const L = -darkAt(t.h); if (!L || v.u.flags.darkVision || (v.u.flags.infravision && !t.u.flags.machine)) return 0; return Math.max(0, L - (v.u.flags.nightVision || 0)); };
    // crates and barricades are semi-ablative (TS p. 29, B559): every 10 points of damage they stop wears 1 DR off
    const crateGone = terr ? new Uint8Array(terr.hx.length) : null, crateWear = terr ? new Float64Array(terr.hx.length) : null;
    function wearCover(i, stopped) {
      if (i < 0 || stopped < 10) return;
      crateWear[i] += Math.floor(stopped / 10);
      const base = COVER_DR[terr.crates.get(key(terr.hx[i].q, terr.hx[i].r)) === "heavy" ? "barricade" : "crate"];
      if (crateWear[i] >= base) {
        crateGone[i] = 1; pass[i] = 1; fieldCache.clear();
        tev.push([turnNow, key(terr.hx[i].q, terr.hx[i].r), "broken"]);
        L(`  the cover at ${terr.hx[i].q},${terr.hx[i].r} is shot to pieces`);
      }
    }
    const coverDRof = cv => cv.i >= 0 ? Math.max(0, COVER_DR[cv.kind] - crateWear[cv.i]) : COVER_DR[cv.kind];
    // what a model's own cover costs it to shoot out from (TS p. 28): nothing behind light cover, -2 from medium, -4 from heavy
    const ownCoverPen = (m, tH, bracedAimed) => bracedAimed || !m.h || !tH ? 0 : COVER_OWN[coverAt(m.h, tH, m)];
    // structures (B558): interior walls are plasteel partitions (DR 50, 60 HP a yard) and doors DR 30, 40 HP;
    // both are Homogeneous (B380), so bullets do little and blasts, plasma, melta and power weapons break through
    const STRUCT = { wall: { dr: 50, hp: 60 }, door: { dr: 30, hp: 40 } };
    const structOf = i => terr.wallI[i] && !broken[i] ? STRUCT.wall : terr.doorI[i] && !broken[i] ? STRUCT.door : null;
    const hpOf = i => shp[i] < 0 ? structOf(i).hp : shp[i];
    const hexName = i => (terr.wallI[i] ? "wall" : "door") + " at " + terr.hx[i].q + "," + terr.hx[i].r;
    function damageStructure(i, raw, dm, direct) {
      const st = structOf(i);
      if (!st) return 0;
      const div = direct ? (dm.div || 1) : 1;
      const inj = Math.floor(Math.max(0, raw - Math.floor(st.dr / div)) * woundMult(dm.type, "torso", { homogenous: 1 }, dm.ex));
      if (inj <= 0) return 0;
      shp[i] = hpOf(i) - inj;
      if (shp[i] <= 0) {
        broken[i] = 1; pass[i] = 1; closed[i] = 0; fieldCache.clear();
        tev.push([turnNow, key(terr.hx[i].q, terr.hx[i].r), "broken"]);
        L(`  the ${hexName(i)} is breached`);
      }
      return inj;
    }
    function setDoor(i, shut, who) {
      closed[i] = shut ? 1 : 0;
      tev.push([turnNow, key(terr.hx[i].q, terr.hx[i].r), shut ? "closed" : "open"]);
      L(`${who.id} ${shut ? "closes" : "opens"} a door (Ready)`);
      who.readied = true;
    }
    // walking distance to a goal round the walls, from a breadth-first field cached for the second
    // (typed arrays over the map's walkable hexes; F.get(key) keeps the Map-like use)
    // Crates and barricades (B352): an obstacle 3 or more SM smaller than a model is jumped as part of a Move for +1
    // movement point; anything bigger takes a whole turn and a DX roll (fall on a failure). A crate counts as SM -3 (a
    // SM 0 man hops it, a Gretchin climbs), a barricade as SM -2 (SM +1 and up hop it). Nobody ends a move on one.
    const OBST_SM = { light: -3, heavy: -2 };
    const obstClass = m => Math.max(0, Math.min(2, (m.u.sm | 0) + 1));   // 0: climbs both, 1: hops crates, 2: hops both
    const hops = (cls, i) => terr.crateI[i] && !crateGone[i] ? (cls - 1 >= OBST_SM[terr.crates.get(key(terr.hx[i].q, terr.hx[i].r))] + 3 ? 2 : 6) : 0;
    const fieldCache = new Map();
    // climbing (B349-350, B352): stepping up half a yard is free, a yard (a stair) costs a movement point more, a ledge
    // up to a yard and a half three more (hands and a knee up); higher can't be climbed in a fight. Dropping a yard is
    // free, two yards a point more (a jump down), and anything higher isn't risked. A big model (9 feet and up)
    // manages half as much again; fliers ignore it. cc: 0 man-sized, 1 big, 2 flier
    // Clinging (B43): up or down a wall at half Move, any height: 2 movement points a yard (cc 3)
    const climbCls = m => m.u.veh ? 4 : m.u.body === "flying" ? 2 : m.u.flags.clinging ? 3 : heightOf(m.u) >= 9 ? 1 : 0;
    function climb(i, j, cc = 0) {
      if (!EL || cc === 2 || i == null || j == null) return 0;
      const dz = EL[j] - EL[i], s = cc === 1 ? 1.5 : 1;
      if (cc === 4) return Math.abs(dz) <= 0.5 ? 0 : Infinity;   // a vehicle: gentle slopes only, no stairs or floors
      if (cc === 3) return Math.abs(dz) <= 0.5 ? 0 : Math.round(2 * Math.abs(dz)) - 1;
      if (dz > 0) return dz <= 0.5 * s ? 0 : dz <= 1 * s + 0.01 ? 1 : dz <= 1.5 * s ? 3 : Infinity;
      return -dz <= 1 * s + 0.01 ? 0 : -dz <= 2 * s + 0.01 ? 1 : Infinity;
    }
    function field(goal, cls = 1, cc = 0) {
      const gk = key(goal.q, goal.r) + "|" + cls + "|" + cc;
      let F = fieldCache.get(gk);
      if (F) return F;
      const N = terr.hx.length, D = new Int16Array(N).fill(-1), g = terr.ids.get(key(goal.q, goal.r));
      // Dijkstra with small integer costs: 1 a hex, 2 to hop an obstacle, 6 to clamber over one
      const dist = new Float64Array(N).fill(Infinity), heap = [];
      const push = (i, d) => { if (d >= dist[i]) return; dist[i] = d; heap.push([d, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
      const cost = i => pass[i] ? 1 : hops(cls, i);
      if (g != null) push(g, 0);
      else for (const [dq, dr] of DIRS) { const i = terr.ids.get(key(goal.q + dq, goal.r + dr)); if (i != null && cost(i)) push(i, cost(i)); }
      while (heap.length) {
        const [d, c] = pop();
        if (d > dist[c]) continue;
        for (const x of terr.nb[c]) { const k = cost(x); if (!k) continue; const e = climb(x, c, cc); if (e !== Infinity) push(x, d + k + e); }
      }
      for (let i = 0; i < N; i++) if (dist[i] < Infinity) D[i] = Math.min(32000, dist[i]);
      F = { get: k => { const i = terr.ids.get(k); return i == null || D[i] < 0 ? undefined : D[i]; }, D };
      fieldCache.set(gk, F);
      return F;
    }
    // walking distance (symmetric): the field is built from b, so pass the foe's hex second
    const walk = (a, b) => !terr ? hexDist(a, b) : (field(b).get(key(a.q, a.r)) ?? 999);
    // deployment in a facility: each side fills its staging bay outward from its spawn point, a yard apart
    const spawnList = terr ? terr.spawn.map(sp => { const F = field(sp); return terr.hx.map((h, i) => [key(h.q, h.r), F.D[i]]).filter(x => x[1] >= 0 && !terr.doorI[idx(x[0])]).sort((x, y) => x[1] - y[1]).map(x => x[0]); }) : null;
    const spawnAt = [0, 0];
    function nextSpawn(side) {
      const L2 = spawnList[side];
      while (spawnAt[side] < L2.length) {
        const [q, r] = L2[spawnAt[side]++].split(",").map(Number), h = { q, r };
        if (!taken(key(q, r)) && !DIRS.some(([dq, dr]) => occ.has(key(q + dq, r + dr)))) return h;
      }
      return null;
    }
    // deployment: each side's units side by side in lines facing the enemy, models 2 yards apart,
    // ranks of ten with deeper ranks behind; each side's frontage is centred on the same axis
    const width = [0, 0];
    const sameSquad = (a, b) => a && b && a.squad && a.squad === b.squad && a.side === b.side;
    units.forEach((u, ui) => { width[u.side] += 2 * Math.min(u.count, 10) + (sameSquad(u, units[ui + 1]) ? 0 : 4); });
    const row0 = [-Math.floor((width[0] - 4) / 2), -Math.floor((width[1] - 4) / 2)];
    units.forEach((u, ui) => {
      u.idx = ui; u.models = []; u.routed = false; u.checked50 = false; u.checked25 = false;
      const perRank = Math.min(u.count, 10);
      for (let i = 0; i < u.count; i++) {
        const rank = Math.floor(i / perRank), file = i % perRank;
        const col = u.side === 0 ? -2 * rank : distance + 2 * rank;
        const row = row0[u.side] + 2 * file;
        const m = { u, id: `${u.name} #${i + 1}`, hp: u.HP, fp: u.fp, state: "ok", shock: 0, stunned: false, init: R(),
          facing: u.side === 0 ? 0 : 3, prone: false, moved: false, aimTurns: 0, aimTarget: null, lastTarget: null,
          ammo: u.ranged ? u.ranged.shots.mag : 0, mags: u.mags, reload: 0, jam: 0, gunBroken: false, conc: 0,
          sp: u.shield ? u.shield.sp : 0, spHit: -99, spCollapsed: false, shHP: u.cs && u.cs.hp != null ? u.cs.hp : 0, shState: "ok",
          parries: 0, retreated: false, blocked: false, attacked: false, aoa: false, aod: false, feint: null,
          reanim: 0, dmgDealt: 0, kills: 0, armsLost: 0, legsLost: 0, grips: [], holding: null, pinned: false,
          waiting: null, zone: null, grenadesLeft: u.grenades.map(g => g.count), grenadeReady: null,
          inHand: u.bothReady ? "both" : u.stance === "charge" ? "melee" : "gun",
          setUp: !!(u.ranged && u.ranged.needsSetup), setupT: 0, setupTo: null, idle: 0,
          wounds: {}, pain: 0, painSev: 0, halfMove: false, halfDodge: false, gawd: 0, crippled: {} };
        let h = terr ? nextSpawn(u.side) : fromOffset(col, row);
        if (!terr) while (occ.has(key(h.q, h.r))) h = fromOffset(h.q + (u.side ? 1 : -1), row);
        // a loader deploys beside its gun, on the side away from the enemy where there's room
        const gun = u.crew === "loader" && models.find(x => x.u.side === u.side && x.u.squad === u.squad && x.u.team === u.team && x.u.crew === "gunner" && x.h);
        if (gun) {
          const back = u.side === 0 ? -1 : 1, nbs = DIRS.map(([dq, dr]) => ({ q: gun.h.q + dq, r: gun.h.r + dr })).filter(n => !taken(key(n.q, n.r)) && (!terr || walkable(key(n.q, n.r))));
          nbs.sort((a, b) => back * (b.q - a.q));
          if (nbs.length) { if (terr && h) { spawnAt[u.side]--; } h = nbs[0]; u.besideGun = true; }
        }
        place(m, h);
        if (u.veh) Object.assign(m, { vel: 0, immobile: false, propHalf: 0, turretFacing: m.facing, turretJam: false, trackInj: {}, wheelsLost: 0,
          stn: u.veh.stations.map(s => ({ s, man: { cu: s.cu, hp: s.cu.HP, state: "ok", stunned: false }, ammo: s.w ? s.w.shots.mag : 0, mags: u.mags,
            reloading: 0, aimTurns: 0, aimT: null, follow: null, jam: 0, jamSkill: 0, gunBroken: false, out: false, busy: -1 })) });
        m.ix = models.length; m.trail = []; u.models.push(m); models.push(m);
      }
      if (!u.besideGun) row0[u.side] += 2 * perRank + (sameSquad(u, units[ui + 1]) ? 0 : 4);
    });
    // squads: one morale group per squad (a lone unit is its own group)
    const groups = [], gmap = new Map();
    for (const u of units) {
      const k = u.squad ? u.side + "|" + u.squad : "u" + u.idx;
      let g = gmap.get(k);
      if (!g) { g = { name: u.squad ? (u.squadName || u.squad) : u.name, units: [], models: [], count: 0, checked50: false, checked25: false, led: null, hadLeader: false, steeled: 0, executed: 0 }; gmap.set(k, g); groups.push(g); }
      g.units.push(u); g.models.push(...u.models); g.count += u.count; u.group = g;
    }
    for (const g of groups) g.hadLeader = g.units.some(u => u.leader);
    // transports (Occ., B463): a vehicle that `carries` a squad ("next": the next squad listed on its side) starts
    // with it aboard, as many as its passenger seats hold; the rest walk
    for (const u of units) {
      if (!u.veh || !u.carries || !u.veh.room) continue;
      let tag = u.carries;
      if (tag === "next") { const nx = units.slice(u.idx + 1).find(x => x.side === u.side && x.squad && !x.veh); tag = nx ? nx.squad : null; }
      const pax = models.filter(x => x.u.side === u.side && tag && x.u.squad === tag && !x.u.veh && x.state === "ok" && x.u.crew !== "gunner" && x.u.crew !== "loader");
      for (const v of u.models) {
        v.cargo = [];
        while (v.cargo.length < u.veh.room && pax.length) { const x = pax.shift(); place(x, null); x.state = "aboard"; x.ride = v; v.cargo.push(x); }
        if (v.cargo.length) L(`${v.id} carries ${v.cargo.length} of ${v.cargo[0].u.squadName || v.cargo[0].u.name}`);
      }
    }

    const active = m => m.state === "ok";
    const unitActive = u => !u.routed && u.models.some(active);
    const sideActive = s => units.some(u => u.side === s && unitActive(u));
    const foes = m => models.filter(x => x.state === "ok" && x.u.side !== m.u.side && !x.u.routed);
    // situational awareness (Tactical Shooting p. 11, 21, 27-28): in a facility each side knows only the foes some
    // friend has seen in the last few seconds (a shooter gives itself away to within a yard, B548); models that
    // ambush stay unseen until they attack or a foe comes within 5 yards. "omniscient" restores the old knowledge.
    const AWARE = opt.awareness ? opt.awareness === "limited" : !!terr;
    const seenAt = [new Map(), new Map()];
    const contact = [0, 0];   // the last second each side saw a foe
    const spot = (side, f) => { contact[side] = turn; if (!seenAt[side].has(f) && f.u.ambush && !f.revealed) L(`  ${f.id} is spotted`); seenAt[side].set(f, turn); f.lastSeenH = f.h; };
    // ---- stealth (B222, B47): a model with something to hide behind (cover from the viewer, lying down, a chameleon
    // hide, or 20+ yards) and that hasn't given itself away this second or the last is spotted only by winning a
    // Quick Contest: the viewing side's best Perception (or Observation) plus Acute Vision, the range penalty and the
    // target's SM, against the target's Stealth (DX-5 untrained), -5 if it moved more than half its Move, plus its
    // chameleon hide. Once seen it stays seen while anyone keeps it in sight; one roll a second per side
    const skillOf = (u, re) => Math.max(-Infinity, ...(u.stats.skills || []).filter(x => re.test(x.name) && x.level != null).map(x => x.level));
    const stealthOf = u => u._st ?? (u._st = Math.max(u.dx - 5, skillOf(u, /^Stealth/)));
    const spotOf = u => u._sp ?? (u._sp = Math.max(u.stats.per || u.stats.iq || 10, skillOf(u, /^Observation/)) + (u.flags.acuteVision || 0));
    function concealed(f, x) {
      if ((f.loudAt ?? -99) >= turn - 1) return false;
      return f.prone || !!f.u.flags.chameleon || darkAt(f.h) <= -3 || hexDist(x.h, f.h) >= 20 || coverAt(f.h, x.h, f) !== "none";
    }
    function trySpot(f) {
      const S = 1 - f.u.side, viewers = models.filter(x => x.state === "ok" && x.h && x.u.side === S && los(x.h, f.h));
      if (!viewers.length) return;
      const hidden = f.u.ambush && !f.revealed;
      if (hidden && !viewers.some(x => hexDist(x.h, f.h) <= 5)) return;   // an ambush shows only up close
      if ((seenAt[S].get(f) ?? -99) >= turn - 1) { spot(S, f); return; }   // still being watched
      const hid = viewers.filter(x => concealed(f, x));
      if (hid.length < viewers.length && !hidden) { spot(S, f); return; }   // someone has a clear look at it
      if ((f.spotRoll || [])[S] === turn) return;   // one roll a second per side
      (f.spotRoll ||= [])[S] = turn;
      let best = -Infinity;
      for (const x of viewers) best = Math.max(best, spotOf(x.u) - skillPen(x) + rangePenalty(Math.max(1, hexDist(x.h, f.h))) + f.u.sm - darkPen(x, f));
      const cham = f.u.flags.chameleon || 0, still = !(f.steps > 0);
      const st = stealthOf(f.u) - (f.steps > moveOf(f) / 2 ? 5 : 0) + (still ? cham : Math.floor(cham / 2)) - skillPen(f) + (darkAt(f.h) <= -3 ? 2 * (f.u.flags.chamShadow || 0) : 0);
      const a = check(best), b = check(st);
      if (a.ok && (!b.ok || a.margin > b.margin)) { L(`  ${f.id} is spotted (Per ${best} vs Stealth ${st})`); spot(S, f); }
    }
    function lookAround() {
      if (!AWARE) return;
      for (const f of models) if (f.state === "ok" && f.h) trySpot(f);
    }
    // what a side knows: foes in sight now, and for 5 seconds those last seen that haven't moved since; one that
    // slipped out of sight and moved is only a last known position (search goes there)
    const known = m => !AWARE ? foes(m) : foes(m).filter(f => { const t = seenAt[m.u.side].get(f) ?? -99; return t >= turn - 1 || (t >= turn - 5 && f.h && f.lastSeenH && f.h.q === f.lastSeenH.q && f.h.r === f.lastSeenH.r); });
    // an ambusher that attacks gives itself away; foes who hadn't seen it are partly surprised (B393): each must make
    // an IQ roll (+6 with Combat Reflexes) or lose its next turn
    // an attack gives the attacker away: a gunshot to every foe within earshot (40 yards, walls or not), anything
    // quieter (a blade, a throw, a splinter or shuriken weapon, a psychic power) only to foes that can see it
    const QUIET = /splinter|shuriken|needle|bow\b|crossbow|silenced|stake|shardcarbine|Kroot/i;
    function reveal(m, w) {
      if (!AWARE || !m.h) return;
      const loud = !!w && !w.thrown && w.usage !== "power" && !QUIET.test(w.name || "");
      m.loudAt = turn;
      const side = 1 - m.u.side, fresh = !seenAt[side].has(m), unseen = (seenAt[side].get(m) ?? -99) < turn - 1;
      m.revealed = true;
      if (!models.some(x => x.state === "ok" && x.h && x.u.side === side && (loud ? hexDist(x.h, m.h) <= 40 : los(x.h, m.h)))) return;
      seenAt[side].set(m, turn); m.lastSeenH = m.h; contact[side] = turn;
      if (fresh && m.u.ambush && !m.u.sprung) {
        m.u.sprung = true;
        L(`  ${m.u.name} spring their ambush`);
        for (const x of models) if (x.state === "ok" && x.h && x.u.side === side && !check((x.u.stats.iq || 10) + (x.u.flags.cr ? 6 : 0)).ok) x.surprised = true;
      } else if (unseen) {
        // any attack out of hiding is a surprise attack (B393): foes who see it or are within 10 yards roll IQ
        // (+6 with Combat Reflexes) or lose their next turn
        L(`  ${m.id} strikes from hiding`); m.hiddenStrike = turn;
        for (const x of models) if (x.state === "ok" && x.h && x.u.side === side && (los(x.h, m.h) || hexDist(x.h, m.h) <= 10) && !check((x.u.stats.iq || 10) + (x.u.flags.cr ? 6 : 0)).ok) x.surprised = true;
      }
    }
    // target speed (B373): below Move 10 the book drops it and lets the target's Dodge stand for its movement
    const spdOf = n => n > 10 ? n : 0;
    // how much of location loc the cover of kind k hides on t; a model firing a two-handed gun from behind it
    // exposes its arms and hands and half its torso (B407)
    function hideOf(k, loc, t, f, th = t && t.h) {
      let h = (HIDES[k] || {})[loc] || 0;
      if (h && f && t && th && ELEV && COVER_TOP[k]) {
        const up = elevAt(f) - elevAt(th);
        if (up > 0) {
          const lh = (LOC_H[loc.replace("#c", "")] ?? 1) * (t.prone ? 0.25 : t.kneel ? 0.65 : 1) * heightOf(t.u) / 6;
          if (lh + up / Math.max(1, hexDist(f, th)) >= COVER_TOP[k]) h = 0;
        }
      }
      if (!h || !t || !t.attacked || !t.u.ranged || t.u.ranged.pistol || !gunReady(t)) return h;
      return loc === "arm" || loc === "hand" ? 0 : loc === "torso" || loc === "vitals" ? Math.min(h, 0.5) : h;
    }
    // cover and posture against a shot at t from hex f (B407, B548, B551): an aimed shot at a location the cover
    // hides is -2 and meets the cover's DR; a random one strikes the cover whenever it lands there, at no penalty.
    // A kneeling or lying target is -2 to hit in the torso, groin, legs and feet, and to random fire.
    // keep: the planner's share of a hit's harm that isn't lost in the cover
    function shotFx(t, f, pb) {
      // a lying target is no harder to hit from above (B551): only a shooter at its level or lower is hampered
      const k = pb || !t.h || !f ? "none" : coverAt(t.h, f, t), low = ((t.prone && !(f && elevAt(f) - elevAt(t.h) >= 1)) || t.kneel) && !pb;
      let hid = 0;
      for (const [l, n] of RANDOM_LOCS) hid += n * hideOf(k, l, t, f) / 216;
      return {
        pen: loc => loc === "random" ? (low ? -2 : 0) : (low && LOW.has(loc) ? -2 : 0) - (hideOf(k, loc, t, f) > 0 ? 2 : 0),
        keep: loc => 1 - 0.7 * (loc === "random" ? hid : hideOf(k, loc, t, f)),
      };
    }
    // random hit location on t: a lying figure can't be hit in the groin, legs or feet, only the torso (B551)
    const hitLocOn = t => { const l = hitLocation(); return t && t.prone && (l === "groin" || l === "leg" || l === "foot") ? "torso" : l; };
    const inCover = (t, f) => coverAt(t.h, f, t) !== "none";
    const coverPen = (t, f) => covPenAt(t.h, f, t);
    // what m's cover at h takes off a shot from f: nothing once the shooter is high enough to see over it
    function covPenAt(h, f, m) {
      const k = coverAt(h, f, m);
      if (!COVER_PEN[k] || !ELEV || !COVER_TOP[k] || !f || elevAt(f) <= elevAt(h)) return COVER_PEN[k];
      return Object.keys(HIDES[k]).some(l => hideOf(k, l, m, f, h) > 0) ? COVER_PEN[k] : 0;
    }
    // drilled squads (TS p. 22-23, 37): a drilled shooter fires past a drilled friend at -2, not -4, and doesn't hit him by mistake
    const drilled = x => !!(x && x.u.ai.drilled);
    const linePen = (m, inter) => inter.reduce((a, x) => a + (drilled(m) && x.u.side === m.u.side && drilled(x) ? 2 : 4), 0);

    // skill penalty from shock (standard), or the larger of shock and pain plus wound effects (fractional)
    // (burning clothes are -2 DX, or -3 when all of them are alight, B434)
    // one crippled leg or foot: lame (Lame, Crippled Legs, B141): it can stand and hobble, at -3 to attacks and Dodge
    const lame = m => m.legsLost === 1 ? 3 : 0;
    const skillPen = m => (frac ? Math.max(m.shock, m.pain) + m.gawd : Math.min(m.shockCap || 4, m.shock)) + (m.onFire ? m.onFire + 1 : 0) + (m.painAff || 0) + lame(m);
    // below 1/3 HP (standard HP, B419), or halved by a Fractional Health wound or a crippled leg: half Move and
    // Dodge, rounding up
    const weak = m => !frac && m.hp < m.u.HP / 3 && !m.berserk;   // a berserker's wounds don't slow it (B124)
    // Shadow in the Warp (Tyranid traits): a psyker within the radius of an enemy bioform carrying it is at -3 to
    // psychic skill and to the Will roll against Perils of the Warp
    const psyker = u => u.powers.some(p => p.fp);
    const shadowed = m => !!m.h && psyker(m.u) && models.some(x => x.state === "ok" && x.h && x.u.side !== m.u.side && x.u.flags.shadow && hexDist(x.h, m.h) <= x.u.flags.shadow);
    // a model whose weapon arm is crippled fights with the other hand: -4 unless ambidextrous (B421, B417)
    const wl = (m, w) => w.level - (m.prone ? 0 : w.stStand || 0) - (w.usage === "power" && w.fp && shadowed(m) ? 3 : 0) - (m.weaponArmLost && !w.natural && w.usage !== "power" ? m.u.offPen : 0);
    // Fright Check (B360): Will plus Fearlessness, never better than 13
    // capped at 13 (B360) only for Shadow in the Warp; morale and the Fright Checks under fire aren't capped (user
    // direction: superhuman nerve should tell), so only a 17 or 18 breaks a Marine
    // Cowardice (B129) is a penalty to Fright Checks in physical danger: -4 at self-control 6, -3 at 9, -2 at 12, -1 at 15
    const frightLevel = (u, mod = 0, cap = 13) => Math.min(cap, u.will + (u.flags.fearless || 0) + (u.flags.cr ? 2 : 0) + 5 + mod - (u.flags.coward ? Math.ceil((18 - u.flags.coward) / 3) : 0));
    const fright = (u, mod = 0, cap = 13) => check(frightLevel(u, mod, cap));
    // a failed Fright Check rolls 3d + the margin of failure on the Fright Check Table (B360-361)
    // what happened to a model since its last turn, for keeping its head down and Fright Checks under fire (TS p. 21, 34)
    const ev = m => m.ev || (m.ev = {});
    function sawFall(t) {
      if (!t.h) return;
      for (const x of models) if (x !== t && x.state === "ok" && x.h && x.u.side === t.u.side && hexDist(x.h, t.h) <= 5 && los(x.h, t.h)) ev(x).allyDown = true;
    }
    // under fire (Tactical Shooting): a Fright Check after suppression, a near miss (by 2 or less), a blast within 2
    // yards per die, a wound or a friend going down nearby, at minus the volume of fire (the rapid-fire table as a
    // measure of it) unless in cover (p. 34); then anyone shot at while in cover rolls Will-2 or keeps its head down
    // this turn, unless it has Combat Reflexes (p. 21). Unfazeable and fearless-by-nature models ignore both.
    // fire and movement (TS p. 21): each shooting squad that advances pairs off; one of each pair covers while the
    // other bounds, swapping every two seconds. Zealots (Orks, Tyranids) and chargers just go.
    function assignRoles() {
      for (const u of units) {
        const ms = models.filter(x => x.u === u && x.state === "ok" && x.h && !u.routed);
        // peeling (TS p. 22-23): cautious line troops outgunned by what they can see fall back by pairs out of its
        // sight and hold there (shooting stance), covering each other
        if (!u.peel && u.ai.caution >= 1.1 && !((u.ai.zeal || 0) > 0) && u.ranged && ms.length >= 2 && turn > 3) {
          const ours = ms.reduce((a, x) => a + threatOf(x), 0);
          const seen = models.filter(f => f.u.side !== u.side && f.state === "ok" && f.h && ms.some(x => los(x.h, f.h)));
          const theirs = seen.reduce((a, f) => a + threatOf(f), 0);
          if (ours < 0.35 * theirs) { u.peel = turn; u.stanceWas = u.stance; u.stance = "shoot"; L(`${u.name} fall back by pairs (peeling)`); }
        } else if (u.peel && turn - u.peel > 20) { u.peel = false; u.stance = u.stanceWas || "advance"; }
        if ((u.stance !== "advance" && !u.peel) || (u.ai.zeal || 0) > 0 || !u.ranged || ms.length < 2) { for (const x of ms) x.role = null; continue; }
        const f0 = models.find(x => x.u.side !== u.side && x.state === "ok" && x.h);
        if (!f0) continue;
        ms.sort((a, b) => hexDist(a.h, f0.h) - hexDist(b.h, f0.h) || a.h.q - b.h.q || a.h.r - b.h.r);
        const phase = Math.floor(turn / 2) % 2;
        ms.forEach((x, i) => { x.role = (Math.floor(i / 2) + i + phase) % 2 ? "bound" : "cover"; });
      }
    }
    function underFire(m) {
      const e = m.ev; m.ev = null; m.headsDown = false;
      if (!e || !morale || m.u.flags.unfazeable || m.u.flags.noMorale || m.berserk) return false;
      const covered = e.shotAt && e.shotAt.h && m.h && inCover(m, e.shotAt.h);
      if (e.supp || e.near || e.blast || e.wounded || e.allyDown) {
        const why = e.blast ? "a blast" : e.allyDown ? "a comrade falls" : e.wounded ? "wounded" : e.supp ? "suppression fire" : "a near miss";
        const r = fright(m.u, (e.vol && !covered ? -rapidBonus(e.vol) : 0) + ledBonus(m), Infinity);
        if (!r.ok) { frightTable(m, -r.margin, why); if (m.state === "routed" || (m.stunned && m.stunT > 1)) commissar(m.u.group, [m]); if (m.stunned || m.state !== "ok" || m.u.routed) return true; }
      }
      if (e.horror != null) {
        const r = fright(m.u, -e.horror + ledBonus(m), Infinity);
        if (!r.ok) { frightTable(m, -r.margin, `${e.horrorWhy}, -${e.horror}`); if (m.stunned || m.state !== "ok" || m.u.routed) return true; }
      }
      if (covered && !m.u.flags.cr && !check(m.u.will - 2).ok) m.headsDown = true;
      return false;
    }
    // Leadership (B204): a leader who spends its turn giving orders gives everyone in its squad who can hear it +1
    // (+2 on a critical) to combat Fright Checks and to self-control rolls against Berserk or Cowardice, until its
    // next turn; within 20 yards, or the whole squad when a vox-caster is with it
    function ledBonus(m) {
      const g = m.u.group, o = g && g.led, st = (g && g.steeled) || 0;
      if (!o || o.until < turn || o.by.state !== "ok" || !o.by.h || !m.h) return st;
      return st + (g.models.some(x => x.u.vox && active(x)) || hexDist(m.h, o.by.h) <= 20 ? o.bonus : 0);
    }
    // squad cohesion: a squad member doesn't run more than 4 yards ahead of its nearest squad-mate toward the foe;
    // a flamer closes with the squad, not alone across open ground (chargers rush as they please)
    function cohesion(m, t) {
      const u = m.u;
      if (!u.group || u.stance === "charge" || !t.h) return 0;
      const ds = u.group.models.filter(x => x !== m && x.state === "ok" && x.h && !x.stunned).map(x => hexDist(x.h, t.h));
      return ds.length ? Math.min(...ds) - 4 : 0;
    }
    function giveOrders(m) {
      const g = m.u.group, l = skillOf(m.u, /^Leadership/), r = check(l - skillPen(m));
      m.attacked = false; m.aimTurns = 0;
      if (g.models.some(x => x !== m && x.u.leader && x.state === "ok" && g.led && g.led.by === x && g.led.until >= turn)) return;   // one leader per group
      if (r.ok) { g.led = { by: m, bonus: r.crit ? 2 : 1, until: turn + 1 }; L(`${m.id} bellows orders (Leadership: +${r.crit ? 2 : 1} to the squad's Fright Checks)`); }
      else L(`${m.id} shouts orders, but nobody's listening (Leadership failed)`);
    }
    // a Commissar keeps a squad in the fight (house rule: summary execution as an Intimidation display, B202). When
    // members break or freeze, a Commissar of the squad within 20 yards and in sight shoots the worst of them, then wins a Quick
    // Contest of Intimidation (+3 for the display, +1 if Callous) against the squad's best Will: the frozen snap out of
    // it, and the squad fights on at +2 to its Fright Checks for the rest of the battle
    function commissar(g, failed) {
      const c = g.models.find(x => x.u.commissar && active(x) && x.h && !x.stunned);
      if (!c || !failed.length || turn - (g.execAt ?? -99) < 20) return;   // one example lasts a while
      // the first to run, else the first frozen with fear: a Commissar doesn't wait for the rot to spread
      const v = failed.find(x => x !== c && x.state === "routed") || failed.find(x => x !== c && x.state === "ok" && x.stunned);
      if (!v) return;
      if (v.h && (hexDist(c.h, v.h) > 20 || !los(c.h, v.h))) return;
      L(`${c.id} executes ${v.id} for cowardice`);
      v.state = "dead"; if (v.h) { FX(["d", v.h.q, v.h.r, v.u.side, 1]); place(v, null); }
      g.executed++; g.execAt = turn;
      const it = skillOf(c.u, /^Intimidation/), w = Math.max(...g.models.filter(x => active(x) && x !== c).map(x => x.u.will), 0);
      if (contest(Math.max(it, c.u.will) + 3 + (c.u.flags.callous ? 1 : 0), w)) {
        g.steeled = 2;
        for (const x of g.models) if (x !== c && active(x) && x.stunned && x.stunRec !== "ht") { x.stunned = false; x.stunT = 0; }
        L(`  ${g.name} steels itself under the Commissar's eye`);
      } else L(`  ${g.name} is too shaken to care`);
    }
    function frightTable(m, by, why) {
      by = Math.max(1, by);   // a check with no cap can fail on a 17 with a margin below 1
      const r = roll3() + by, u = m.u;
      const stun = (sec, how, txt) => { m.stunned = true; m.stunT = sec; m.stunRec = how; L(`  ${m.id} ${txt || "freezes"} (${why}, Fright Check Table ${r})`); };
      if (r <= 5) stun(1, "auto");
      else if (r <= 7) stun(1, "will");
      else if (r <= 9) stun(1, "willmod");
      else if (r === 10) stun(d6(), "willmod");
      else if (r === 11) stun(d6() + d6(), "willmod");
      else if (r === 12) stun(d6(), "willmod", "retches, helpless");
      else if (r === 13) L(`  ${m.id} shakes it off with a new quirk (${why}, Fright Check Table 13)`);
      else if (r <= 15) { spendFP(m, d6()); stun(d6(), "willmod", "loses fatigue and freezes"); }
      else if (r === 16) stun(d6(), "willmod");
      else if (r <= 20 || r >= 22) { incapacitate(m, `faints or collapses (${why}, Fright Check Table ${r})`); }
      else { m.state = "routed"; place(m, null); L(`  ${m.id} panics and runs (${why}, Fright Check Table 21)`); }
    }
    // stun recovery: physical stun on HT (B420); a fright stun as its table row says; other mental stun on IQ,
    // +6 with Combat Reflexes (B43, B364)
    function recoverStun(m) {
      if (m.stunT > 0) { m.stunT--; if (m.stunT > 0) return false; if (m.stunRec === "auto") return true; }
      const u = m.u, how = m.stunRec || "ht";
      const lvl = how === "will" ? u.will : how === "willmod" ? frightLevel(u, 0, Infinity) : how === "iq" ? (u.stats.iq || 10) + (u.flags.cr ? 6 : 0) : u.HT;
      return check(lvl).ok;
    }
    function spendFP(m, n) {
      if (m.u.flags.machine || !n) return;
      const before = m.fp; m.fp -= n;
      const over = Math.min(n, Math.max(0, -m.fp) - Math.max(0, -before));
      if (over > 0) { L(`  ${m.id} burns itself out (${over} HP)`); injure(m, m, over, "torso", "cr"); }
      if (m.state === "ok" && m.fp <= -m.u.fp) incapacitate(m, "collapses, utterly spent");
    }
    const tired = m => !m.u.flags.machine && m.fp < m.u.fp / 3;   // below 1/3 FP (B426): Move, Dodge and ST halved
    const dodgeOf = t => (t.halfDodge || weak(t) || tired(t) ? Math.ceil(t.u.dodge / 2) : t.u.dodge) - lame(t);
    // facing (B386-387): a mover faces the way it walks; after a move that used more than half its Move it may turn
    // only one hex-side at the end, so a model that runs past a foe can end with its side or back to it
    function faceTo(m, h) {
      if (!m.h || !h) return;
      const want = faceToward(m.h, h);
      if (!m.movedFar) { m.facing = want; return; }
      const d = ((want - m.facing) % 6 + 6) % 6;
      m.facing = d === 0 ? m.facing : d <= 3 ? (m.facing + 1) % 6 : (m.facing + 5) % 6;
    }
    // sprinting (B354): a Move straight on adds 20% (at least +1) from the second second; Enhanced Move (B52) instead
    // accelerates by Basic Move each second up to its top speed (x2 per level)
    function runMove(m) {
      const base = moveOf(m);
      if (m.legsLost || m.halfMove) return base;
      const k = m.runPrev || 0, L = m.u.flags.enhMove || 0;
      if (L > 0) return Math.min(Math.floor(base * Math.pow(2, L)), base * (k + 1));
      return k >= 1 ? Math.max(base + 1, Math.floor(base * 1.2)) : base;
    }
    const baseMove = m => m.u.ranged && m.u.ranged.needsSetup && !m.setUp ? m.u.movePacked : m.u.move;
    const moveOf = m => m.legsLost >= 2 ? 1 : m.legsLost === 1 ? Math.max(1, (m.halfMove || weak(m) || tired(m) ? Math.ceil(baseMove(m) / 2) : baseMove(m)) - 3) : m.halfMove || weak(m) || tired(m) ? Math.max(1, Math.ceil(baseMove(m) / 2)) : baseMove(m);

