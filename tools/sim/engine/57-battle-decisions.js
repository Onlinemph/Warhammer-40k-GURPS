// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= decision layer: one value scale for every choice =================
    // value of an option = aggression x SUM(share of a foe knocked out x that foe's threat)
    //                    - caution x P(I'm knocked out next turn) x my own worth over the next few turns
    //                    + delayed payoffs (Aim, Ready, reload, closing in) discounted GAMMA per turn.
    // "Threat" is the share of an average enemy's HP a model takes off per turn, so harm dealt and harm taken
    // share one currency. Personality weights (data/sim/ai.yaml) and stance (charge / advance / shoot) scale
    // the terms; noise lets a disorderly faction pick among near-best options.
    const GAMMA = 0.8, HORIZON = 4;
    const cl = x => Math.max(0, Math.min(18, Math.round(x)));
    const TV = new Map();
    function threatOf(f) {
      const k = f.u.idx;
      if (TV.has(k)) return TV.get(k);
      let best = 0.15;   // even a harmless foe has to be put down to win
      for (const U of units) {
        if (U.side === f.u.side) continue;
        let v = 0;
        const mw = f.u.melee;
        if (mw) v = Math.max(v, expInjRandom(mw, U) * P3[cl(mw.level - 4)] * (1 + (f.u.flags.extraAttack || 0)));
        const rw = f.u.ranged;
        if (rw) v = Math.max(v, expInjRandom(rw, U) * P3[cl(rw.level - 6)] * Math.min(3, rw.rof || 1));
        for (const p of f.u.powers) if (!p.melee && p.dmg) v = Math.max(v, expInjRandom(p, U) * P3[cl(p.level - 6)]);
        if (f.u.veh) v = f.u.veh.stations.reduce((a, s) => a + (s.w ? expInjRandom(s.w, U) * P3[cl(s.w.level - 6)] * Math.min(3, s.w.rof || 1) : 0), 0);
        best = Math.max(best, Math.min(3, v / Math.max(1, U.HP)));
      }
      TV.set(k, best);
      return best;
    }
    // injury still needed to take a model out of the fight (standard HP: down to about -HP/2 where the
    // consciousness rolls start to bite; Fractional Health: a flat share of HP)
    const remOf = t => frac ? Math.max(1, t.u.HP * 0.75) : Math.max(t.u.HP * 0.3, t.hp + t.u.HP * 0.5);
    // value of E expected injury on foe t, seen by model m (Drukhari "prey" favour the wounded); same horizon as risk()
    function kv(m, t, E) {
      if (!(E > 0) || !t) return 0;
      const rem = remOf(t), share = Math.min(1, E / rem);
      // Bloodlust (B125): it goes for the killing blow, so a wounded foe is worth more to it
      const prey = m && t.hp < t.u.HP ? Math.max(m.u.ai.prey > 1 ? m.u.ai.prey : 1, m.u.flags.bloodlust ? 1.5 : 1) : 1;
      return share * threatOf(t) * prey * HORIZON;   // a foe taken out stops hurting us for the rest of the fight
    }
    // expected injury to m next turn standing on hex h: "aoa" (no defence), "aod" (+2) or normal
    // chance a foe under our fire keeps its head down or freezes (TS p. 21, 34): Will-2 in cover without Combat
    // Reflexes, and a Fright Check for suppression; the unafraid ignore both
    function pinOf(f) {
      if (f.u.flags.unfazeable || f.u.flags.noMorale) return 0;
      const down = f.u.flags.cr ? 0 : 1 - P3[cl(f.u.will - 2)];
      const scare = 1 - P3[cl(frightLevel(f.u, 0, Infinity))];
      return Math.min(0.9, down * 0.7 + scare * 0.5);
    }
    // a foe a friend is covering (an overwatch shooter's target, or inside a friend's suppression zone) shoots back
    // at less than full effect: that's what covering fire is for (TS p. 21)
    const covered = (m, f) => zones.some(z => z.side === m.u.side && z.owner.state === "ok" && f.h && z.hexes.has(key(f.h.q, f.h.r)))
      || models.some(x => x !== m && x.u.side === m.u.side && x.state === "ok" && x.role === "cover" && x.aimTarget === f);
    function incoming(m, h, mode) {
      let tot = 0;
      const near = known(m).filter(f => f.h && f.state === "ok").sort((a, b) => walk(h, a.h) - walk(h, b.h)).slice(0, 8);
      for (const f of near) {
        if (f.pinned || f.grips.length > 1) continue;
        const d = hexDist(f.h, h);
        // a foe spreads its attacks over the models of ours at least as close to it as this hex
        const rivals = models.filter(x => x !== m && x.u.side === m.u.side && x.state === "ok" && x.h && hexDist(x.h, f.h) <= d).length;
        const share = 1 / (1 + rivals);
        let best = 0;
        const mw = f.u.melee;
        if (mw && (terr ? walk(h, f.h) : d) - mw.reachMax <= moveOf(f) && (!ELEV || d > mw.reachMax || levelOK(f.h, f.u, h, m.u, mw))) {
          const lvl = mw.level - (d > mw.reachMax ? 4 : 0) - skillPen(f) + smMelee(f, m);
          const def = mode === "aoa" ? null : (mode === "ca" ? Math.max(m.u.dodge, m.u.db ? m.u.block : 0) - 2 : Math.max(m.u.dodge + 3, m.u.parry != null && bladeReady(m) ? m.u.parry + 1 : 0) + (mode === "da" ? 1 : 0)) + (mode === "aod" ? 2 : 0) - (m.stunned ? 4 : 0) - (m.prone ? 3 : 0) + m.u.db;
          best = expInjRandom(mw, m.u) * P3[cl(lvl)] * (1 - (def == null ? 0 : P3[cl(def)])) * (1 + (f.u.flags.extraAttack || 0));
        }
        const rw = f.u.ranged;
        if (rw && !f.gunBroken && d <= rw.range.max && los(f.h, h) && !(mode === "duck" && DUCK.has(coverAt(h, f.h, m)) && covPenAt(h, f.h, m) > 0)) {
          const lvl = rw.level - skillPen(f) + rangePenalty(rngD(f.h, h, Math.max(1, d)) + spdOf(h === m.h ? m.steps || 0 : hexDist(m.h, h))) + m.u.sm - (m.prone && elevAt(f.h) - elevAt(h) < 1 ? 2 : 0) + Math.min(2, rw.acc || 0) - covPenAt(h, f.h, m) - (f.h ? ownCoverPen(f, h, false) : 0);
          const def = mode === "aoa" ? null : m.u.dodge + (mode === "aod" ? 2 : 0) + m.u.db - (m.prone ? 3 : 0);
          best = Math.max(best, expInjRandom(rw, m.u) * burstHits(lvl, rw.rof || 1, rw) * (1 - (def == null ? 0 : P3[cl(def)])) * (covered(m, f) ? 1 - pinOf(f) : 1));
        }
        tot += best * share;
      }
      return tot + grenadeRisk(m, h, near);
    }
    // grenades (B414): the worst a foe with a grenade left, and a throw that reaches h, can do to m there with one
    // landing a yard or two away, weighted by how tempting a target the spot is (the more of us within 2 yards, the
    // likelier the throw). Cover from the thrower, kneeling and lying all cut the fragments that land (B414, B551)
    function grenadeRisk(m, h, near) {
      let worst = 0;
      const crowd = models.filter(x => x !== m && x.u.side === m.u.side && x.state === "ok" && x.h && hexDist(x.h, h) <= 2).length;
      const low = m.prone || m.kneel;
      for (const f of near) {
        if (!f.u.grenades.length || f.grips.length || f.armsLost >= 1) continue;
        const d = hexDist(f.h, h);
        f.u.grenades.forEach((g, i) => {
          if (!f.grenadesLeft[i] || d < 3 || d > g.range.max || !los(f.h, h)) return;
          const k = coverAt(h, f.h, m);
          let hid = 0;
          for (const [l, n] of RANDOM_LOCS) hid += n * hideOf(k, l, m, f.h, h) / 216;
          let e = expInj(g, m.u, "area", { ...g.dmg, div: 1, mult: g.dmg.mult / 3, key: "s1nd" });
          const fr = g.dmg.frag;
          if (fr) {
            let nF = 0;
            for (let j = 15 + rangePenalty(2) + m.u.sm - (low ? 2 : 0); j >= 3; j -= 3) nF += P3[Math.min(18, j)];
            e += nF * (1 - hid) * expInjRandom(g, m.u, { n: fr.n, add: 0, mult: 1, div: 1, type: fr.type, key: "f" });
          }
          const pHit = P3[cl(g.level - skillPen(f) + rangePenalty(d))];
          worst = Math.max(worst, e * pHit * Math.min(1, 0.15 + 0.25 * crowd));
        });
      }
      return worst;
    }
    // cost of standing on hex h in that posture: chance of being put down x what I'd do over the next turns
    function risk(m, h, mode) {
      const inc = incoming(m, h, mode);
      return m.u.ai.caution * Math.min(1, inc / remOf(m)) * threatOf(m) * HORIZON;
    }
    const stanceW = (m, kind) => {
      const s = m.u.stance, a = m.u.ai;
      if (kind === "melee") return a.melee * (s === "charge" ? 1.6 : s === "shoot" ? 0.8 : 1);
      return a.ranged * (s === "shoot" ? 1.2 : s === "charge" ? 0.6 : 1);
    };
    // how many squad-mates already have this foe in their sights (for spreading fire)
    // (only a gun that can hurt the foe stakes a claim: boltguns plinking at a tank don't crowd out the lascannon)
    const claims = (m, f) => models.reduce((a, x) => a + (x !== m && x.u.side === m.u.side && x.state === "ok" && x.aimTarget === f && (!x.u.ranged || expInjRandom(x.u.ranged, f.u) > 0) ? 1 : 0), 0);
    // sustained harm of a gun: turns firing a magazine vs turns reloading it
    function sustainOf(w) {
      if (!w.shots || w.shots.mag === Infinity) return 1;
      const fire = w.shots.mag / Math.max(1, Math.min(3, w.rof || 1));
      return fire / (fire + w.shots.reload);
    }
    // best shot value a model could take from hex h next turn (for comparing positions)
    function shotValueFrom(m, h, pool) {
      let best = 0;
      for (const w of weaponsFor(m, false)) for (const t of pool.slice(0, 6)) {
        if (!t.h || !los(h, t.h)) continue;
        const d = Math.max(1, hexDist(h, t.h));
        if (d > w.range.max) continue;
        const E = planAttack(m, w, t, wl(m, w) - skillPen(m) + rangePenalty(rngD(h, t.h, d) + spdOf(t.steps || 0)) + t.u.sm - darkPen(m, t) - COVER_OWN[coverAt(h, t.h, null)] - linePen(m, between(h, t.h, m.u.side).filter(x => x !== t && x !== m)), false, null, { fx: shotFx(t, h, false), from: h }).score * sustainOf(w);
        best = Math.max(best, kv(m, t, E));
      }
      return best * stanceW(m, "ranged") * m.u.ai.aggression;
    }

    // nobody known: head for where a foe was last seen, or else for the far side's staging bay, and look; a unit that
    // holds (shooting stance) or lies in ambush stays put and waits
    function search(m) {
      // a holding unit waits 10 quiet seconds before it goes looking, an ambush a minute
      const quiet = turn - contact[m.u.side];
      if ((m.u.ambush && !m.u.sprung && quiet < 60) || (m.u.stance === "shoot" && quiet < 10)) return;
      let goal = null, best = -99;
      for (const [f, t] of seenAt[m.u.side]) if (t > best && f.state === "ok" && f.lastSeenH) { best = t; goal = f.lastSeenH; }
      if (!goal || hexDist(goal, m.h) <= 1) {
        // then the far staging bay, then sweep the facility room by room (a random walkable hex at a time)
        if (!m.searchGoal) m.searchGoal = terr.spawn[1 - m.u.side];
        while (hexDist(m.searchGoal, m.h) <= 2) { const i = Math.floor(R() * terr.hx.length); if (pass[i]) m.searchGoal = terr.hx[i]; }
        goal = m.searchGoal;
      }
      const n = stepToward(m, goal, runMove(m), 1);
      if (n) { L(`${m.id} searches ahead`); if (n >= moveOf(m) - 1) m.runK = m.runPrev + 1; }
    }
