// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= the timeline: when each model went down and came back, from the frames and casualty events
    const downs = ros.map(() => []);   // per model: [{ t: frame it vanished, at: [x, y], dead, back: frame it reappeared or null }]
    {
      const dEv = [];
      fx.forEach((es, k) => es.forEach(e => { if (e[0] === "d") dEv.push({ t: k + 1, q: e[1], r: e[2], dead: !!e[4] }); }));
      for (let i = 0; i < ros.length; i++) {
        let cur = null;
        for (let t = 1; t < fr.length; t++) {
          const a = fr[t - 1] && fr[t - 1][i], b = fr[t] && fr[t][i];
          if (a && !b) { const ev = dEv.find(d => d.t === t && d.q === a[0] && d.r === a[1]); cur = { t, at: P(a[0], a[1]), q: a[0], r: a[1], dead: ev ? ev.dead : null, fell: !!ev, back: null, facing: a[4] }; downs[i].push(cur); }
          else if (!a && b && cur) { cur.back = t; cur = null; }
        }
      }
    }
    const deathOf = (i, t) => downs[i].find(d => d.fell && d.t <= t && (d.back == null || d.back > t)) || null;

    // ================= the action camera: a second split into a move beat, then one beat per attacker in the order
    // they acted, the camera cutting to each; TS is how many seconds of normal replay time this second now takes
    const MOVE = 1.2, plans = new Map();
    let TS = 1;
    // every round fired (or blow struck) is its own step, with the results that followed it: a dodge, a shield,
    // a wound or armour holding; misses are spread among the hits
    function planOf(t) {
      if (plans.has(t)) return plans.get(t);
      const beats = [], byA = new Map(); let cur = null, hitR = [], ri = 0;
      for (const e of t > 0 ? fx[t - 1] || [] : []) {
        if (e[0] === "s" || e[0] === "m") {
          let b = byA.get(e[7]);
          if (!b) { b = { a: e[7], tgt: e[8], at: [e[3], e[4]], melee: e[0] === "m", kind: e[12] || "", shots: 0, rounds: [] }; byA.set(e[7], b); beats.push(b); }
          const blast = e[12] === "grenade" || e[12] === "lob", nb = e[0] === "s" && !blast ? Math.max(1, e[11] || 1) : 1;
          const nh = e[0] === "s" ? (blast ? 1 : Math.min(nb, e[10] || 0)) : (e[6] ? 1 : 0);
          const hitAt = new Set(); for (let i = 0; i < nh; i++) hitAt.add(Math.floor((i + .5) * nb / nh));
          hitR = [];
          for (let k = 0; k < nb; k++) { const r = { e, hit: hitAt.has(k), res: [], blast }; if (r.hit) hitR.push(r); b.rounds.push(r); }
          b.shots += nb; ri = 0; cur = b;
        } else if (cur && (e[0] === "v" || e[0] === "f" || e[0] === "h" || e[0] === "b")) {
          const r = hitR.length ? hitR[Math.min(ri, hitR.length - 1)] : cur.rounds[cur.rounds.length - 1];
          if (!r) continue;
          if (!r.hit) r.hit = true;
          r.res.push({ e });
          // a dodge, a shield or a wound settles a round; a blast's results all belong to its one round
          if (e[0] !== "b" && !r.blast && (e[0] !== "h" || r.res.filter(x => x.e[0] !== "b").length >= 1)) ri++;
        } else if (cur && e[0] === "d") {
          for (let j = cur.rounds.length - 1; j >= 0; j--) { const x = cur.rounds[j].res.slice().reverse().find(y => y.e[0] === "h" && y.e[4] === e[1] && y.e[5] === e[2]); if (x) { x.down = true; break; } }
        }
      }
      let at = MOVE;
      for (const b of beats) {
        const n = b.rounds.length;
        b.SH = b.melee ? .6 : b.rounds[0] && b.rounds[0].blast ? .6 : Math.max(.18, Math.min(.45, 4 / n));
        const L = .6 + n * b.SH + 1.1;
        b.start = at; b.L = L; at += L;
      }
      const tsc = beats.length ? at + .2 : 1;
      for (const b of beats) { b.start /= tsc; b.len = b.L / tsc; }
      const pl = { beats, tsc, byA };
      plans.set(t, pl); return pl;
    }

    // ================= what happens this second, scheduled across it (p from 0 to 1)
    let schedT = -1, schedC = false, sched = [], prevP = 0;
    const evFor = figs.map(() => ({})), hP = new Map(), deathP = new Map();
    function buildSchedule(t, cine) {
      schedT = t; schedC = cine; sched = []; prevP = 0; hP.clear(); deathP.clear(); fxT = -1;
      for (const e of evFor) for (const k in e) delete e[k];
      const pl = planOf(t);
      TS = cine ? pl.tsc : 1;
      if (t <= 0) return;
      const es = fx[t - 1] || [], lastImpact = new Map(), u = 1 / TS;
      hitBy.clear(); for (const e of es) if ((e[0] === "s" || e[0] === "m") && e[6] && e[8] >= 0) hitBy.set(e[8], e[7]);
      if (cine) { cineSchedule(pl, u, es); fallSounds(t); sched.sort((a, b) => a.p - b.p); return; }
      let n = 0;
      // when an attack goes off: spread through the first .4 of a normal second, or a little into its attacker's beat
      const lagOf = () => Math.min(.35, n++ * .03) + .05;
      const imp = (tg, at) => { if (tg >= 0) lastImpact.set(tg, at); };
      // a shooter that moves this second fires as it reaches the hex it fired from, not from part-way there
      const firedAt = e => {
        const cur = fr[t] && fr[t][e[7]], prev = fr[t - 1] && fr[t - 1][e[7]], tr = cur && cur[6];
        if (!prev || !tr || !tr.length || (prev[0] === e[1] && prev[1] === e[2])) return 0;
        let L = 0, at = -1, a = P(prev[0], prev[1]);
        for (const [q, r] of tr) { const b = P(q, r); L += Math.hypot(b[0] - a[0], b[1] - a[1]); a = b; if (at < 0 && q === e[1] && r === e[2]) at = L; }
        return at > 0 ? Math.min(.72, .7 * at / L + .02) : 0;
      };
      for (const e of es) {
        if (e[0] === "s") {
          const lag = Math.max(lagOf(e), firedAt(e)), kind = e[12] || "slug", K = KIND[kind] || KIND.slug;
          const travel = K.beam || K.flame ? .05 : K.dur || .15;
          (evFor[e[7]].fire ||= []).push({ p: lag, kind, tgt: e[8], hits: e[10] || 0, nb: e[11] || 1 });
          imp(e[8], lag + travel * u);
          sched.push({ p: lag, run: () => fireFx(e, kind, K) });
        } else if (e[0] === "m") {
          const lag = lagOf(e);
          (evFor[e[7]].swing ||= []).push({ p: lag, tgt: e[8] });
          imp(e[8], lag + .22 * u);
          sched.push({ p: lag, run: () => swingSound(e, false) });
          if (e[6]) sched.push({ p: lag + .22 * u, run: () => swingSound(e, true) });
          if (e[6]) sched.push({ p: lag + .22 * u, run: () => { const F = figs[e[8]]; if (F) burst(glow, chestOf(F), 10, { speed: 3, life: .25, s0: .12, s1: .02, c: C(0xffe0a0), grav: 6 }); } });
        } else if (e[0] === "v") {
          const pi = lastImpact.get(e[1]) ?? .3 * u; (evFor[e[1]].dodge ||= []).push({ p: pi - .08 * u, how: e[2] });
        } else if (e[0] === "h") {
          const pi = lastImpact.get(e[1]) ?? .35 * u; const F = figs[e[1]];
          hP.set(e, pi); deathP.set(e[1], pi);
          if (e[2] > 0) (evFor[e[1]].hit ||= []).push({ p: pi });
          sched.push({ p: pi, run: () => { if (F) impactFx(F, e[2] > 0); } });
        } else if (e[0] === "f") {
          const pi = lastImpact.get(e[1]) ?? .35 * u; hP.set(e, pi); sched.push({ p: pi, run: () => { const F = figs[e[1]]; if (F) shieldFx(F); } });
        } else if (e[0] === "b") {
          const [x, y] = P(e[1], e[2]); let pb = .4 * u;
          for (const [ti, pi] of lastImpact) { const F = figs[ti]; if (F && F.g.position.distanceTo(W3(x, y, F.g.position.y)) < 1.6) pb = pi; }
          sched.push({ p: pb, run: () => blastFx(W3(x, y, zOf(e[1], e[2])), e[3]) });
        }
      }
      fallSounds(t);
      sched.sort((a, b) => a.p - b.p);
    }
    // a blow's sound: the swing, then what it lands on; a body hitting the ground when a model falls this second
    const swingSound = (e, landed) => { const A = figs[e[7]], F = figs[e[8]], mk = ros[e[7]].mk || ""; if (landed) { if (F) playSound("melee." + mk, F, .9); } else if (A) { playSound("swing." + mk, A, .7); if (rnd() < .3) say(A, "charge", F); else say(A, "effort", null, .6); } };
    // who struck whom this second, so the one who felled a foe can say so
    const hitBy = new Map();
    const fallSounds = t => figs.forEach((F, i) => {
      if (F.veh || !downs[i].some(d => d.t === t && d.fell)) return;
      const p = deathP.get(i) ?? .35 / TS;
      sched.push({ p, run: () => say(F, "death", null, .9) });
      sched.push({ p: p + .3 / TS, run: () => playSound(F.arch === "marine" || F.arch === "terminator" || F.arch === "custodes" ? "fall.armour" : "fall", F, .8) });
      // then the one who did it, or a comrade who saw it
      sched.push({ p: Math.min(.98, p + .5 / TS), run: () => {
        const by = figs[hitBy.get(i)];
        if (by && rnd() < .5) return say(by, "kill", F, .8);
        const mate = figs.find(M => M !== F && !M.veh && M.g.visible && ros[M.i].side === ros[i].side && !deathOf(M.i, t) && M.g.position.distanceTo(F.g.position) < 12);
        if (mate) say(mate, "down", null, .6);
      } });
    });
    // the action camera's timeline: each beat aims for .6 of a second, then fires its rounds one at a time
    function cineSchedule(pl, u, es) {
      for (const b of pl.beats) {
        b.fireP = b.start + .6 * u;
        b.rounds.forEach((r, j) => {
          const e = r.e, fp = b.start + (.6 + j * b.SH) * u; r.p = fp;
          let travel = .22;
          if (e[0] === "s") {
            const kind = e[12] || "slug", K = KIND[kind] || KIND.slug, one = e.slice();
            if (!r.blast) { one[11] = 1; one[10] = r.hit ? 1 : 0; one[6] = r.hit ? 1 : 0; }
            travel = K.beam || K.flame ? .05 : (K.dur || .15) * 1.4;
            (evFor[e[7]].fire ||= []).push({ p: fp, kind, tgt: e[8], hits: one[10] || 0, nb: 1 });
            sched.push({ p: fp, run: () => fireFx(one, kind, K) });
          } else {
            (evFor[e[7]].swing ||= []).push({ p: fp, tgt: e[8] });
            sched.push({ p: fp, run: () => swingSound(e, false) });
            if (r.hit) sched.push({ p: fp + travel * u, run: () => swingSound(e, true) });
            if (r.hit) sched.push({ p: fp + travel * u, run: () => { const F = figs[e[8]]; if (F) burst(glow, chestOf(F), 10, { speed: 3, life: .25, s0: .12, s1: .02, c: C(0xffe0a0), grav: 6 }); } });
          }
          r.ip = fp + travel * u;
          r.res.forEach((x, k) => {
            const e2 = x.e, ip = r.ip + k * (r.blast ? .15 : .1) * u; x.p = ip;
            if (e2[0] === "v") (evFor[e2[1]].dodge ||= []).push({ p: ip - .08 * u, how: e2[2] });
            else if (e2[0] === "h") { const F = figs[e2[1]]; hP.set(e2, ip); deathP.set(e2[1], ip); if (e2[2] > 0) (evFor[e2[1]].hit ||= []).push({ p: ip }); sched.push({ p: ip, run: () => { if (F) impactFx(F, e2[2] > 0); } }); }
            else if (e2[0] === "f") { hP.set(e2, ip); sched.push({ p: ip, run: () => { const F = figs[e2[1]]; if (F) shieldFx(F); } }); }
            else if (e2[0] === "b") { const [x2, y2] = P(e2[1], e2[2]); sched.push({ p: ip, run: () => blastFx(W3(x2, y2, zOf(e2[1], e2[2])), e2[3]) }); }
          });
        });
      }
      // anything outside a beat (a bleeding-out, a blast with no thrower) goes off during the move
      for (const e of es) if ((e[0] === "h" || e[0] === "f") && !hP.has(e)) { const ip = .5 / TS; hP.set(e, ip); if (e[0] === "h") { deathP.set(e[1], ip); const F = figs[e[1]]; sched.push({ p: ip, run: () => { if (F) impactFx(F, e[2] > 0); } }); } }
    }
    const chestOf = F => F.g.position.clone().add(new THREE.Vector3(0, (F.veh ? .9 : F.top * .62), 0));
    // where a shot starts or ends: on the figure while it stands in the hex the shot was fired from (or at). A
    // figure drawn part-way through its move isn't there, and a line drawn to it could cross a wall the shot never
    // did, so the shot keeps to its hex
    const standAt = (F, q, r) => { const [x, y] = P(q, r); return F && F.g.visible && Math.hypot(F.g.position.x - x, F.g.position.z - y) < .5 ? F.g.position.clone() : W3(x, y, zOf(q, r)); };
    const muzzleOf = (F, toward, at = F.g.position.clone()) => {
      const h = F.veh ? (F.turret && F.turret !== F.hull ? .9 : .7) : F.top * (F.arch === "beast" ? .45 : .62);
      const d = toward.clone().sub(at); d.y = 0; d.normalize();
      return at.add(new THREE.Vector3(0, h, 0)).add(d.multiplyScalar(F.veh ? 1.2 : .45 * Math.max(1, F.k)));
    };
    // a shot that misses flies on past its target, until a standing wall, a shut door or the ground stops it or it
    // has gone some way further
    const hexAt = (x, y) => { const q = x / 1.5, r = y / SQ3 - q / 2; let rx = Math.round(q), ry = Math.round(-q - r), rz = Math.round(r); const dx = Math.abs(rx - q), dy = Math.abs(ry + q + r), dz = Math.abs(rz - r); if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry; return rx + "," + rz; };
    let strayT = -1; const brokenNow = new Set(), shutNow = new Set(), wallTopOf = new Map();
    function flyOn(from, near) {
      const d = near.clone().sub(from), len = d.length(), p = near.clone(); if (len < .01) return { to: p, stopped: false };
      d.multiplyScalar(1 / len);
      if (T && strayT !== schedT) {
        strayT = schedT; brokenNow.clear(); shutNow.clear();
        for (const k of T.shut || []) shutNow.add(k);
        for (const [tt, k, what] of T.events || []) if (tt <= schedT) { if (what === "broken") { brokenNow.add(k); shutNow.delete(k); } else if (what === "closed") shutNow.add(k); else shutNow.delete(k); }
        if (!wallTopOf.size) wallList.forEach((k, i) => wallTopOf.set(k, wallH[i]));
      }
      const reach = len + 25 + rnd() * 35;
      for (let s = Math.max(0, len - 1.5); s < reach; s += .3) {
        p.copy(d).multiplyScalar(s).add(from);
        if (p.y < zXY(p.x, p.z) + .05) return { to: p, stopped: true };
        if (!T) continue;
        const k = hexAt(p.x, p.z);
        if (floorSet.has(k) ? shutNow.has(k) && p.y < 2.3 : !brokenNow.has(k) && (indoor || p.y < (wallTopOf.get(k) ?? -1))) return { to: p, stopped: true };
      }
      return { to: p, stopped: false };
    }
    function fireFx(e, kind, K) {
      const A = figs[e[7]]; if (!A) return;
      const tF = e[8] >= 0 ? figs[e[8]] : null;
      const tgt = standAt(tF, e[3], e[4]); tgt.y += tF ? (tF.veh ? .9 : tF.top * .62) : .8;
      const from = muzzleOf(A, tgt, standAt(A, e[1], e[2])), hit = !!e[6];
      const shots = K.beam || K.flame ? 1 : Math.min(3, K.pulses || 1, Math.max(1, e[11] || 1));
      for (let j = 0; j < shots; j++) setTimeout(() => playSound("fire." + kind, A, A.veh ? 1.3 : 1), j * 70 * speedK());
      say(A, "attack", tF, .3); if (tF && !hit) say(tF, "fire", A, .12);
      const miss = () => tgt.clone().add(new THREE.Vector3((rnd() - .5) * 2.5, (rnd() - .2) * 1.2, (rnd() - .5) * 2.5));
      if (o.reduce) return;
      // muzzle flash
      burst(glow, from, 3, { speed: .6, life: .08, s0: K.beam ? .5 : .7, s1: .1, c: C(K.c), fade: 1 });
      if (!K.beam && !K.flame) burst(smoke, from, 2, { speed: .3, life: .8, s0: .25, s1: .7, c: C(0x9a948a), a: .35, lift: .4 });
      flash(from, K.c, K.beam ? 1.5 : 2.2, .09, 6);
      const pulses = Math.min(K.pulses || 1, Math.max(1, e[11] || 1));
      if (K.flame) {
        // a cone of fire licking out to the target
        const d = tgt.clone().sub(from), len = d.length(); d.normalize();
        for (let j = 0; j < 46; j++) { const s = 4 + rnd() * 6; glow.add({ x: from.x, y: from.y, z: from.z, vx: d.x * s * len / 5 + (rnd() - .5) * 1.4, vy: d.y * s * len / 5 + (rnd() - .2) * 1.2, vz: d.z * s * len / 5 + (rnd() - .5) * 1.4, age: -j * .006, life: .45 + rnd() * .2, s0: .25, s1: 1.1, c: C(kind === "warpflame" ? 0x9affff : 0xffe08a), c1: C(K.c), a: .9, drag: .82 }); }
        burst(smoke, tgt, 8, { speed: .6, life: 1.6, s0: .4, s1: 1.4, c: C(0x2a2622), a: .45, lift: .8 });
        return;
      }
      for (let j = 0; j < pulses; j++) {
        const lands = hit && j < Math.max(1, e[10] || 1), near = lands ? tgt.clone().add(new THREE.Vector3((rnd() - .5) * .2, (rnd() - .5) * .3, (rnd() - .5) * .2)) : miss();
        const stray = lands || K.arc ? null : flyOn(from, near), to = stray ? stray.to : near, struck = !stray || stray.stopped;
        const delay = j * .06;
        if (K.beam) {
          setTimeout(() => {
            beam(from, to, K.c, K.beam, K.life, K.crackle ? .08 : 0);
            if (!struck) return;
            if (stray) burst(glow, to, 5, { speed: 2.5, life: .2, s0: .12, s1: .02, c: C(0xffe0a0), grav: 6 });
            if (K.flare) { burst(glow, to, 14, { speed: 2.4, life: .3, s0: .5, s1: .05, c: C(0xffc0b0) }); flash(to, K.c, 3, .2, 8); }
            if (K.heat) burst(glow, to, 10, { speed: 1, life: .35, s0: .6, s1: .1, c: C(0xffe0c0) });
            if (K.crackle) burst(glow, to, 8, { speed: 1.5, life: .35, s0: .18, s1: .02, c: C(0x7aff9a), spread: .3 });
          }, delay * 1000 * speedK());
        } else {
          const K2 = K;
          const far = from.distanceTo(near), dur = (K2.dur || .15) * (1 + far / 60) * (stray ? from.distanceTo(to) / Math.max(1, far) : 1);   // a stray keeps the speed it had to the target
          setTimeout(() => projectile(from.clone(), to, { dur, arc: K2.arc ? Math.min(8, from.distanceTo(to) * .35 * K2.arc) : 0, c: K2.c, size: K2.proj, trail: !K2.smoke, smokeTrail: !!K2.smoke,
            onHit: !struck ? null : K2.pop ? at => burst(glow, at, 6, { speed: 1.5, life: .2, s0: .35, s1: .05, c: C(0xffc070) }) : stray ? at => burst(glow, at, 5, { speed: 2.5, life: .2, s0: .12, s1: .02, c: C(0xffe0a0), grav: 6 }) : null }), delay * 1000 * speedK());
        }
      }
    }
    let speedMs = 1000;
    const speedK = () => Math.max(.25, Math.min(2, speedMs / 1000));
    function impactFx(F, pen) {
      playSound(!pen ? "hit.glance" : F.veh || /Necron/.test(ros[F.i].faction || "") || F.arch === "marine" || F.arch === "terminator" ? "hit.armour" : "hit.flesh", F, .8);
      if (pen) say(F, "pain", null, .5); else say(F, "fire", null, .15);
      if (o.reduce) return;
      const at = chestOf(F).add(new THREE.Vector3((rnd() - .5) * .3, (rnd() - .5) * .3, (rnd() - .5) * .3));
      const metal = F.veh || /Necron/.test(ros[F.i].faction || "");
      if (!pen) burst(glow, at, 9, { speed: 4, life: .3, s0: .1, s1: .02, c: C(0xfff0c0), grav: 9, floor: F.g.position.y + .02, drag: .95 });
      else if (metal) { burst(glow, at, 14, { speed: 4.5, life: .45, s0: .14, s1: .02, c: C(0xffd070), grav: 9, floor: F.g.position.y + .02, drag: .95 }); burst(smoke, at, 3, { speed: .4, life: 1.2, s0: .3, s1: .9, c: C(0x2a2826), a: .5, lift: .6 }); }
      else { burst(smoke, at, 8, { speed: 1.6, life: .45, s0: .12, s1: .28, c: C(0x7a0e0a), a: .9, grav: 7, drag: .9 }); burst(glow, at, 4, { speed: 2, life: .15, s0: .2, s1: .05, c: C(0xffb090) }); }
    }
    function shieldFx(F) { playSound("hit.shield", F, .8); const at = chestOf(F); burst(glow, at, 18, { speed: 1.4, life: .35, s0: .25, s1: .05, c: C(0x58b6e8), spread: .8 }); flash(at, 0x58b6e8, 1.6, .15, 5); }
    function blastFx(at, R) {
      playSound("blast", at, 1.4);
      if (o.reduce) return;
      const s = 1 + Math.max(0, R - 1) * .3;   // the blast's radius on the 2D map, toned down for the eye
      flash(at.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffa040, 5 * s, .35, 8 + s * 4);
      burst(glow, at.clone().add(new THREE.Vector3(0, .4, 0)), 22 + s * 6, { speed: 2.2 * s, life: .5, s0: .7 * s, s1: .15, c: C(0xfff0b0), c1: C(0xff7a20), up: 1.6, drag: .8, fade: 1.2 });
      burst(glow, at.clone().add(new THREE.Vector3(0, .2, 0)), 18, { speed: 5 * Math.sqrt(s), life: .8, s0: .08, s1: .02, c: C(0xffc070), grav: 9, up: 2, floor: at.y + .02, drag: .97 });
      burst(smoke, at.clone().add(new THREE.Vector3(0, .5, 0)), 8 + s * 4, { speed: .7 * s, life: 3, s0: .5 * s, s1: 1.5 * s, c: C(0x2b2723), a: .45, up: 1.2, lift: .8, drag: .9, fadeIn: 1 });
      burst(smoke, at, 8, { speed: 2.2 * s, life: 1.1, s0: .3, s1: .9, c: C(0x6a5a46), a: .35, up: .2, drag: .85 });   // dust skirt
    }

    // ================= text: floating injury numbers, as on the 2D map
    let fxT = -1, fxObjs = [];
    const textSprite = (txt, color) => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 96; const x = c.getContext("2d");
      x.font = "bold 64px ui-monospace,monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 12; x.strokeStyle = "rgba(0,0,0,.8)"; x.strokeText(txt, 128, 48); x.fillStyle = color; x.fillText(txt, 128, 48);
      const tex = new THREE.CanvasTexture(c), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      s.scale.set(1.4, .52, 1); s.renderOrder = 20; return s;
    };
    const clearText = () => { for (const o2 of fxObjs) { scene.remove(o2.obj); o2.obj.material.map.dispose(); o2.obj.material.dispose(); } fxObjs = []; };
    function buildText(t) {
      clearText(); fxT = t;
      if (t <= 0) return;
      const seen = new Map();
      for (const e of fx[t - 1] || []) if (e[0] === "h" || e[0] === "f") {
        const pi = hP.get(e) ?? .45;
        const q0 = e[0] === "h" ? e[4] : e[3], r0 = e[0] === "h" ? e[5] : e[4];
        if (q0 == null) continue;
        const key2 = q0 + "," + r0, nn = seen.get(key2) || 0; seen.set(key2, nn + 1);
        const txt = e[0] === "h" ? (e[2] > 0 ? "−" + e[2] : "no pen") : "shield", colr = e[0] === "h" ? (e[2] > 0 ? "#ffd2c8" : "#c9c6bd") : "#a8dcf6";
        const s = textSprite(txt, colr), [x, y] = P(q0, r0), F = figs[e[1]], base = zOf(q0, r0) + (F ? F.top + .7 : 2.2) + nn * .5;
        if (e[0] === "h" && e[2] > 0) s.scale.multiplyScalar(1.2);
        scene.add(s);
        fxObjs.push({ obj: s, run(p) { const show = p >= pi || o.reduce; s.visible = show; s.position.set(x + .5, base + (o.reduce ? .5 : .2 + Math.min(1, Math.max(0, (p - pi) * TS / .55)) * 1.0), y); s.material.opacity = p >= 1 ? .8 : Math.min(1, (1.15 - p) * 2 + .3); } });
      }
    }
    // aim lines and paths, rebuilt every frame (few of them)
    let lineObjs = [];
    const clearLines = () => { for (const l of lineObjs) { scene.remove(l); l.geometry.dispose(); l.material.dispose(); } lineObjs = []; };
    const dashed = (pts2, color, opacity) => { const g2 = new THREE.BufferGeometry().setFromPoints(pts2), l = new THREE.Line(g2, new THREE.LineDashedMaterial({ color, dashSize: .25, gapSize: .2, transparent: true, opacity })); l.computeLineDistances(); scene.add(l); lineObjs.push(l); };

