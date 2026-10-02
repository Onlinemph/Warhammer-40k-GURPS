// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ---- Trampling (B404): a model 2+ SM bigger (1+ against a prone foe) tramples: DX or Brawling (with the relative
    // SM penalty for the bigger striker, Pyramid 3/77 p. 7), dodge only, thrust crushing on its own ST; 3+ SM bigger is
    // large-area injury
    const canTrample = (m, t) => m.u.sm - t.u.sm >= 2 || (m.u.sm - t.u.sm >= 1 && t.prone && !m.prone);
    const brawlOf = u => u._br ?? (u._br = Math.max(u.dx, skillOf(u, /^Brawling/)));
    function trample(m, t) {
      m.attacked = true; faceTo(m, t.h); reveal(m);
      const lvl = brawlOf(m.u) - skillPen(m) + smMelee(m, t) - darkPen(m, t), r = check(lvl);
      if (!r.ok) { L(`${m.id} tries to trample ${t.id} (skill ${lvl}): misses`); return; }
      if (!r.crit && defend(t, m, true, 0, 0, { ...UNARMED, weight: m.u.st * m.u.st / 10, huge: true })) { L(`${m.id} tries to trample ${t.id}: dodged`); return; }
      L(`${m.id} tramples ${t.id}`);
      m.landed = t;
      applyHit(m, { dmg: m.u.thrCr, follow: null }, t, m.u.sm - t.u.sm >= 3 ? "area" : hitLocOn(t), false, false, m.u.thrCr);
    }
    function trampleOptions(m, adj, add, rNow, Wm) {
      for (const t of adj) {
        if (!t.h || hexDist(m.h, t.h) > 1 || !canTrample(m, t)) continue;
        const lvl = brawlOf(m.u) - skillPen(m) + smMelee(m, t), dd = dodgeOf(t) - (t.prone ? 3 : 0);
        const E = P3[cl(lvl)] * (1 - P3[cl(dd)]) * expInj({ id: "trample" + m.u.idx, dmg: m.u.thrCr, follow: null }, t.u, m.u.sm - t.u.sm >= 3 ? "area" : "torso");
        add(Wm * kv(m, t, E) - rNow, `trample@${t.id}`, () => trample(m, t));
      }
    }
    // ---- Flesh Hooks: strike with the hooks; on a hit, a free grapple (no defence: the hooks already hold) that drags the
    // victim beside the bearer; an Extra Attack then goes into it with the claws
    function hookStrike(m, f) {
      const u = m.u;
      faceTo(m, f.h); m.landed = null;
      L(`${m.id} lashes its flesh hooks at ${f.id}`);
      strike(m, u.hooks, f, { blows: 1 });
      if (m.landed !== f || f.state !== "ok" || !f.h || m.state !== "ok" || !m.h) return;
      const g = check(u.grapple - skillPen(m) + smGrab(m, f) + 2 * (u.flags.extraArms || 0));
      if (!g.ok) { L(`  the hooks tear free of ${f.id}`); return; }
      release(m); m.holding = f; f.grips.push(m);
      if (hexDist(m.h, f.h) > 1) {
        const h = DIRS.map(([dq, dr]) => ({ q: m.h.q + dq, r: m.h.r + dr })).filter(h => !taken(key(h.q, h.r)) && (!terr || walkable(key(h.q, h.r)))).sort((a, b) => hexDist(a, f.h) - hexDist(b, f.h))[0];
        if (h) place(f, h);
      }
      L(`  the hooks drag ${f.id} in`);
      if ((u.flags.extraAttack || 0) > 0 && f.state === "ok" && f.h && hexDist(m.h, f.h) <= u.melee.reachMax) strike(m, u.melee, f, { blows: u.flags.extraAttack });
    }
    function hookOptions(m, pool, add, rNow, Wm) {
      const u = m.u, w = u.hooks;
      if (!w || m.grips.length || m.holding || m.armsLost >= 1) return;
      for (const f of pool) {
        if (!f.h || hexDist(m.h, f.h) > w.reachMax || !los(m.h, f.h) || f.grips.includes(m)) continue;
        const lvl = wl(m, w) - skillPen(m) + smMelee(m, f) - darkPen(m, f), def = bestDefence(f, m, true, w);
        const pHit = P3[cl(lvl)] * (1 - (def == null ? 0 : P3[cl(def)])), pGrab = P3[cl(u.grapple - skillPen(m) + smGrab(m, f))];
        const eC = expInjRandom(u.melee, f.u);
        // what the hook does, the claws that follow it, and the held victim's lost defences next turn
        const E = pHit * (expInjRandom(w, f.u) + pGrab * ((u.flags.extraAttack || 0) * eC + 0.5 * eC));
        add(Wm * kv(m, f, E) - rNow, `hook@${f.id}`, () => hookStrike(m, f));
      }
    }
    // ---- mental disadvantages steer the choice (B120 self-control rolls)
    const AGGR = /^(aoa|charge|strike|step-|rapid|flurry|mighty|dual|heroic|ca-|da-strike|beat|feint|ruse|grab|shove|fire |point-blank|advance|close@|move-closer|throw|suppress)/;
    const CAUTIOUS = /^(aod|peel|reload-cover|cover@|wait|watch|spread)/;
    const DANGER = /^(charge|aoa-charge|heroic|advance|close@|move-closer|step-|grab)/;
    const bestOf = (opts, re, not) => opts.filter(o => re.test(o.label) && !(not && not.test(o.label))).reduce((a, b) => !a || b.v > a.v ? b : a, null);
    function mentalPick(m, opts, pick, adj) {
      const f = m.u.flags;
      // berserk: All-Out Attack anything in reach; else close on the nearest foe (Move and Attack, a charge or a
      // slam if it can); else blaze away with its gun, never aiming
      if (m.berserk) { const b = (adj.length ? bestOf(opts, /^(aoa|step-aoa)/) : bestOf(opts, /^(aoa-charge|charge|heroic|close@|advance|move-closer|step-)/)) || bestOf(opts, /^(aoa-fire|fire |point-blank)/); if (b) return b; }
      // Cowardice (B129): before closing with the enemy, a self-control roll (-5 if hurt badly enough to die); being
      // in melee already is greater danger, so it fights back
      if (f.coward && !adj.length && DANGER.test(pick.label) && roll3() > f.coward + ledBonus(m) - (m.hp < m.u.HP / 3 ? 5 : 0)) {
        const s = opts.filter(o => !DANGER.test(o.label)).reduce((a, b) => !a || b.v > a.v ? b : a, null);
        if (s) { L(`${m.id} hangs back (Cowardice)`); return s; }
      }
      // Overconfidence (B148): caution needs a self-control roll; failing, it takes the best bold option
      if (f.overconf && CAUTIOUS.test(pick.label) && roll3() > f.overconf) { const a = bestOf(opts, AGGR); if (a) { L(`${m.id} scorns caution (Overconfidence)`); return a; } }
      // Impulsiveness (B139): waiting, holding in cover or aiming a second time needs a self-control roll
      if (f.impulsive && (/^(wait|watch|cover@)/.test(pick.label) || (/^aim@/.test(pick.label) && m.aimTurns >= 1)) && roll3() > f.impulsive) { const a = bestOf(opts, AGGR); if (a) { L(`${m.id} can't wait (Impulsiveness)`); return a; } }
      return pick;
    }
    // the chance an Aim lasts to the model's next turn: an active defence spoils it (B364). A foe in reach, or one that
    // will charge into reach, almost surely forces one; a gunman in range does if it picks this model and hits.
    // Worked out once per model per turn
    const keepC = new Map(); let keepTurn = -1;
    function aimKeep(m) {
      if (keepTurn !== turn) { keepC.clear(); keepTurn = turn; }
      if (keepC.has(m)) return keepC.get(m);
      let p = 1;
      for (const f of models) {
        if (f.u.side === m.u.side || f.state !== "ok" || !f.h || !m.h || f.pinned) continue;
        // a stunned foe may shake it off and come on this very turn: half the threat
        const d = hexDist(f.h, m.h), reach = f.u.melee ? f.u.melee.reachMax : 1, half = x => f.stunned ? 1 - (1 - x) / 2 : x;
        if (d <= reach) { p *= half(0.3); continue; }
        const closer = f.u.melee && (f.u.stance === "charge" || (f.u.ai.zeal || 0) > 0 || bladeReady(f)) && d <= moveOf(f) + reach;
        if (closer) { p *= half(0.5); continue; }
        if (f.u.ranged && d <= f.u.ranged.range.max && los(f.h, m.h)) {
          const mine = models.filter(x => x.u.side === m.u.side && x.state === "ok" && x.h && hexDist(f.h, x.h) <= f.u.ranged.range.max).length;
          p *= 1 - 0.5 / Math.max(1, mine);
        }
      }
      keepC.set(m, p); return p;
    }
    // ---- pop-up attacks (B390): an Attack in which the shooter comes out of cover, fires and goes back into it in one
    // turn, at -2 (it couldn't see the target when its turn began; none for Gunslinger) and with no Aim. Firearms and
    // thrown weapons only. Two kinds: round a corner (a step to a hex that sees a known foe, the shot, the step back),
    // and up out of a trench (rising over the cover in front, firing, ducking down again). Only a foe holding a Wait on
    // that spot can shoot it while it's out; ducked behind its cover till its next turn, a foe the cover screens from
    // can't target it at all
    const DUCK = new Set(["crate", "barricade", "parapet", "crest", "light", "heavy"]);
    const popPen = m => m.u.flags.gunslinger ? 0 : 2;
    const popW = w => w.range && !w.malediction && !w.fp && !w.cone && w.usage !== "power";
    // fire from foes holding a Wait (watch) on hex n: what stepping or rising into their sights costs m
    function waitRisk(m, n) {
      let inc = 0;
      for (const f of models) {
        if (f.u.side === m.u.side || f.state !== "ok" || !f.h || !f.watch || f.waiting !== f.u.ranged || f.stunned) continue;
        const rw = f.u.ranged, d = hexDist(f.h, n);
        if (d > rw.range.max || !los(f.h, n)) continue;
        const lvl = rw.level - skillPen(f) + rangePenalty(rngD(f.h, n, Math.max(1, d))) + m.u.sm;
        inc += expInjRandom(rw, m.u) * burstHits(lvl, rw.rof || 1, rw) * (1 - P3[cl(m.u.dodge + m.u.db)]);
      }
      return m.u.ai.caution * Math.min(1, inc / remOf(m)) * threatOf(m) * HORIZON;
    }
    // watchers fire as m comes into view (its rising out of cover; a step is handled by afterStep)
    function popWaits(m) {
      for (const f of models) {
        if (m.state !== "ok" || m.stunned) return;
        if (!f.waiting || !f.watch || f.state !== "ok" || !f.h || f.u.side === m.u.side || f.stunned) continue;
        if (!los(f.h, m.h) || hexDist(f.h, m.h) > f.waiting.range.max) continue;
        const w = f.waiting; f.waiting = null; f.watch = false;
        if (w === f.u.ranged && gunGrip(f)) continue;
        L(`${f.id} was waiting for ${m.id} to show itself (Wait)`);
        fireAt(f, w, m, { pointBlank: hexDist(f.h, m.h) <= 1 });
      }
    }
    function popUpOptions(m, pool, cands, ws, add, rNow, Wr) {
      const u = m.u;
      if (m.grips.length) return;
      const usable = ws.filter(w => popW(w) && (w !== u.ranged || (m.ammo > 0 && m.reload <= 0 && !m.jam && !m.gunBroken && gunReady(m))));
      if (!usable.length) return;
      const shotAt = (from, t, w) => {
        const d = Math.max(1, hexDist(from, t.h));
        if (d > w.range.max) return 0;
        const lvl = wl(m, w) - skillPen(m) + rangePenalty(rngD(from, t.h, d) + spdOf(t.steps || 0)) + t.u.sm - popPen(m) - darkPen(m, t) - linePen(m, between(from, t.h, u.side).filter(x => x !== t && x !== m));
        return planAttack(m, w, t, lvl, false, null, { fx: shotFx(t, from, false) }).score * sustainOf(w);
      };
      // up out of a trench: a foe in sight that m's cover screens it from
      for (const t of cands.slice(0, 4)) {
        const k = coverAt(m.h, t.h, m);
        if (!DUCK.has(k) || !covPenAt(m.h, t.h, m)) continue;
        for (const w of usable) {
          const E = shotAt(m.h, t, w);
          if (E <= 0) continue;
          add(Wr * kv(m, t, E) - risk(m, m.h, "duck") - waitRisk(m, m.h), `popup-trench@${t.id}`, () => {
            L(`${m.id} rises out of cover to fire at ${t.id} (pop-up attack)`);
            popWaits(m); if (m.state !== "ok" || m.stunned || !t.h) return;
            m.aimTurns = 0; m.follow = null; faceTo(m, t.h);
            fireAt(m, w, t, { pen: popPen(m), popup: true });
            if (m.state === "ok" && m.h) { m.ducked = true; L(`  ${m.id} ducks back down`); }
          });
        }
      }
      // round a corner: nobody in sight from here, a known foe in sight from the next hex
      if (!terr || cands.length || m.u.stance === "charge") return;
      const ci = idx(key(m.h.q, m.h.r));
      for (const [dq, dr] of DIRS) {
        const n = { q: m.h.q + dq, r: m.h.r + dr }, nk = key(n.q, n.r);
        if (taken(nk) || !walkable(nk) || (EL && climb(ci, idx(nk), climbCls(m)) > 0)) continue;
        let best = null;
        for (const t of pool.slice(0, 6)) {
          if (!t.h || !los(n, t.h) || duckedFrom(t, n)) continue;
          for (const w of usable) { const E = shotAt(n, t, w); if (E > 0 && (!best || E * kv(m, t, 1) > best.v)) best = { t, w, E, v: E * kv(m, t, 1) }; }
        }
        if (!best) continue;
        const { t, w, E } = best;
        add(Wr * kv(m, t, E) - rNow - waitRisk(m, n), `popup@${t.id}`, () => {
          const h0 = m.h;
          L(`${m.id} steps out of cover to fire at ${t.id} (pop-up attack)`);
          m.popping = true; place(m, n); afterStep(m); m.popping = false;
          if (m.state === "ok" && m.h && !m.stunned && t.h && t.state === "ok") { m.aimTurns = 0; m.follow = null; faceTo(m, t.h); fireAt(m, w, t, { pen: popPen(m) }); }
          if (m.state === "ok" && m.h && !m.grips.length && !taken(key(h0.q, h0.r))) { place(m, h0); L(`  ${m.id} steps back into cover`); }
        });
      }
    }
    // a model ducked behind its cover after a pop-up: no foe the cover screens it from can draw a bead on it
    function duckedFrom(t, fh) {
      if (!t.ducked || !t.h || !fh) return false;
      const k = coverAt(t.h, fh, t);
      return DUCK.has(k) && covPenAt(t.h, fh, t) > 0;
    }
    // ---- the heavy weapon team's choices, laid over the ordinary ones
    const MOVES = /^(advance|move-closer|cover@|high-ground|close@|charge|aoa-charge|heroic|advance-fire|spread@|peel|reload-cover|step-|popup@|search|rejoin)/;
    const targetsFor = (m, w, h = m.h) => known(m).filter(f => f.h && f.state === "ok" && hexDist(h, f.h) <= w.range.max && hexDist(h, f.h) >= (w.minRange || 0) && (w.indirect ? spotted(m, f) : los(h, f.h)));
    function crewOptions(m, pool, opts, add, rNow, adj) {
      const u = m.u, top = () => opts.reduce((a, b) => b.v > a.v ? b : a, { v: 0 }), force = (label, run) => { const t0 = top(); add(t0.v + 0.5 * Math.max(0.05, Math.abs(t0.v)), label, run); };
      const w = u.ranged;
      // setting up or packing up takes several seconds of Ready; once begun it's carried through
      if (m.setupT > 0) {
        opts.length = 0;
        add(0, "setting-up", () => {
          if (--m.setupT <= 0) { m.setUp = m.setupTo === "up"; L(`${m.id} ${m.setUp ? "has the " + w.name + " set up" : "has the " + w.name + " packed to move"}`); }
          else L(`${m.id} keeps ${m.setupTo === "up" ? "setting up" : "packing up"} the ${w.name}`);
        });
        return;
      }
      if (u.crew === "gunner" && w && w.needsSetup && !adj.length) {
        const have = targetsFor(m, w).length > 0;
        m.idle = have ? 0 : (m.idle || 0) + 1;
        if (m.setUp) {
          // dug in: it fires from here; after ten quiet seconds with nothing in range it packs up to find a new spot
          for (let i = opts.length - 1; i >= 0; i--) if (MOVES.test(opts[i].label)) opts.splice(i, 1);
          if (m.idle >= 10) force("pack-up", () => { m.setupTo = "down"; m.setupT = setupTime(m) - 1; L(`${m.id} starts packing up the ${w.name} to move`); });
        } else if (have) {
          // something to shoot: set the gun up here
          force("set-up", () => { m.setupTo = "up"; m.setupT = setupTime(m) - 1; L(`${m.id} starts setting up the ${w.name}`); });
        }
      }
      if (u.crew === "loader") {
        const g = teamMates(m).find(x => x.u.crew === "gunner");
        if (g && g.state === "ok" && g.h) {
          // with the gun: stay beside it, go where it goes
          if (hexDist(m.h, g.h) > 1) force(`rejoin@${g.id}`, () => { stepToward(m, g.h, moveOf(m), 1); L(`${m.id} keeps up with ${g.id}`); });
          else if (g.setUp || g.setupT > 0) for (let i = opts.length - 1; i >= 0; i--) if (MOVES.test(opts[i].label)) opts.splice(i, 1);
        } else if (g && u.heavy && !m.tookOver && (g.lastH || g.h) && hexDist(m.h, g.lastH || g.h) <= 2 && !adj.length) {
          // the gunner is down: the loader takes the gun (two seconds to get behind it)
          force("take-over", () => {
            m.takeT = (m.takeT || 0) + 1;
            if (m.takeT < 2) { L(`${m.id} drags ${g.id} off the ${u.heavy.name}`); return; }
            m.tookOver = true; u.ranged = u.heavy; u.crew = "gunner";
            m.ammo = g.ammo > 0 ? g.ammo : 0; m.mags = Math.max(0, g.mags ?? 0); m.reload = 0; m.jam = 0; m.gunBroken = !!g.gunBroken; m.inHand = "gun";
            m.setUp = !!(u.ranged.needsSetup && g.setUp); m.idle = 0;
            L(`${m.id} takes over the ${u.heavy.name}`);
          });
        }
      }
    }
    // indirect fire (mortars): at a foe someone on its side can see (the shooter, or a spotter) within range and outside
    // the minimum. Attacking a hex is +4 (B414); without its own line of sight -2 (house rule: the spotter's
    // corrections); no defence (anyone there may dive for cover); a miss lands its margin in yards off, at most half
    // the distance, as a thrown grenade's does
    const spotted = (m, f) => !AWARE || models.some(x => x.u.side === m.u.side && x.state === "ok" && x.h && !x.stunned && los(x.h, f.h) && hexDist(x.h, f.h) <= 120);
    function indirectOptions(m, w, add, rNow, Wr) {
      for (const t of targetsFor(m, w).slice(0, 6)) {
        const d = hexDist(m.h, t.h), own = los(m.h, t.h);
        const lvl = wl(m, w) - skillPen(m) + rangePenalty(d) + 4 + (own ? 0 : -2) + Math.min(2, w.acc || 0);
        const crowd = models.filter(x => x !== t && x.state === "ok" && x.h && x.u.side !== m.u.side && hexDist(x.h, t.h) <= 2).length;
        const E = P3[cl(lvl)] * expInjRandom(w, t.u) * (1 + 0.5 * crowd);
        add(Wr * kv(m, t, E) - rNow, `indirect@${t.id}`, () => lobShell(m, w, t, lvl, own));
      }
    }
    function lobShell(m, w, t, lvl, own) {
      if (!t.h) return;
      reveal(m, w); m.attacked = true; m.aimTurns = 0;
      if (w.shots.mag !== Infinity) m.ammo--;
      const r = lvl < 3 ? { ok: false, margin: lvl - 10 } : check(lvl), raw = rollDamage(w.dmg);
      const d = hexDist(m.h, t.h), off = r.ok ? 0 : Math.max(1, Math.min(Math.ceil(d / 2), -r.margin)), at = off ? scatter(t.h, off) : t.h;
      L(`${m.id} fires the ${w.name} at ${t.id}'s position (${d} yd${own ? "" : ", called in by a spotter"}, skill ${lvl})${off ? `: ${off} yd off` : ": on target"}`);
      FX(["s", m.h.q, m.h.r, at.q, at.r, m.u.side, r.ok ? 1 : 0, m.ix, t.ix, lvl, r.ok ? 1 : 0, 0, "lob"]);
      explosion(m, w, at, raw);
    }
    // a foe that can hardly defend against a shot just now: stunned, down, exhausted, All-Out Attacking, held
    const openFor = (t, m) => { if (t.state !== "ok" || !t.h) return false; const dd = rangedDefence(t, m); return dd == null || P3[cl(dd)] <= 0.375; };
    // a gun holding for an opening fires the moment its foe shows one (the Wait's trigger, B366), spending its next turn
    function seizeOpenings() {
      for (const x of models) {
        const o = x.waitOpen;
        if (!o || x.state !== "ok" || !x.h || x.stunned) continue;
        const t = o.t;
        if (t.state !== "ok" || !t.h) { x.waitOpen = null; continue; }
        if (!openFor(t, x) || !los(x.h, t.h) || duckedFrom(t, x.h) || !weaponsFor(x, false).includes(o.w) || (o.w === x.u.ranged && x.ammo <= 0)) continue;
        x.waitOpen = null;
        L(`${x.id} sees ${t.id} falter and fires (Wait)`);
        fireAt(x, o.w, t, { aim: x.aimTarget === t && x.aimTurns > 0 });
        x.skipNext = true; x.skipWhy = "it fired on its Wait";
      }
    }
