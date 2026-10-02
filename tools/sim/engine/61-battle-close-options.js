// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ---- options to close for hand-to-hand: charge (Move and Attack, All-Out Attack, Slam) or just advance
    function approachOptions(m, pool, add, Wm) {
      const u = m.u;
      if (m.armsLost >= 2 && u.melee.name === "Punch") return;
      const mv = moveOf(m), reach = u.melee.reachMax, near = pool[0], d = walk(m.h, near.h);
      // the path search (a mob flowing round its front rank) only matters once the foe is nearly in reach;
      // further off a straight-line estimate and a greedy advance do
      const route = d <= mv + reach + 2 ? engagePath(m, reach, pool, 600) : null;
      const tgt = route ? route.foe : near;
      const len = route ? route.path.length : Math.max(0, d - reach);
      const go = n => route ? followPath(m, route.path, n) : stepToward(m, near.h, n, reach);
      const stopped = () => m.state !== "ok" || m.stunned || m.prone || !m.h || m.readied;
      const w = u.melee;
      const helpers = models.filter(a => a !== m && a.u.side === u.side && a.state === "ok" && a.h && hexDist(a.h, tgt.h) <= moveOf(a) + 1).length;
      const worth = meleeWorth(m, tgt, helpers);
      const arrive = route && route.path.length ? route.path[Math.min(route.path.length, mv) - 1] : stepHex(m.h, tgt.h, Math.min(mv, len));
      const hard = expInjRandom(w, tgt.u) < 1;
      const stepN = Math.max(1, Math.ceil(mv / 10));   // a step is Move/10, rounded up (B368)
      if (route && route.path.length >= 1 && route.path.length <= stepN) {
        // one step short: the Attack maneuver's step, then a blow at full skill (B364-365), or All-Out Attack
        const lvl = w.level - skillPen(m) - (m.prone ? 4 : 0) + smMelee(m, tgt);
        const n = 1 + (u.flags.extraAttack || 0);
        const stepIn = () => { followPath(m, route.path, stepN); return !stopped() && tgt.h && hexDist(m.h, tgt.h) <= reach; };
        add(Wm * kv(m, tgt, planAttack(m, w, tgt, lvl, true).score * n) - risk(m, arrive, ""), `step-strike@${tgt.id}`, () => {
          if (stepIn()) { faceTo(m, tgt.h); strike(m, w, tgt, {}); }
        });
        add(Wm * kv(m, tgt, planAttack(m, w, tgt, lvl + 4, true).score * n) - risk(m, arrive, "aoa"), `step-aoa@${tgt.id}`, () => {
          if (stepIn()) { faceTo(m, tgt.h); m.aoa = true; strike(m, w, tgt, { determined: true }); }
        });
        if (grabValue(m, tgt, 0) > 0) add(Wm * grabValue(m, tgt, helpers) - risk(m, arrive, ""), `step-grab@${tgt.id}`, () => {
          if (stepIn() && hexDist(m.h, tgt.h) <= 1) { faceTo(m, tgt.h); grab(m, tgt); }
        });
      }
      if (len <= mv) {
        // arrives this turn: Move and Attack (-4, max 9) or a Slam if the weapon can't get through
        const lvl = Math.min(9, w.level - skillPen(m) - 4 + smMelee(m, tgt));
        const Ema = planAttack(m, w, tgt, lvl, true).score;
        const slamOK = len >= 2 && hard && !tgt.prone && !tgt.pinned && u.HP >= 0.8 * tgt.u.HP;
        // a Slam's worth: knocking the foe down sets up the pin (valued as a share of the foe taken out)
        const slamV = slamOK ? 0.25 * threatOf(tgt) * P3[cl(Math.max(u.dx, u.grapple) - skillPen(m))] * HORIZON : 0;
        const vMA = Wm * Math.max(kv(m, tgt, Ema), slamV) + GAMMA * Wm * worth - risk(m, arrive, "");
        add(vMA, `charge@${tgt.id}`, () => {
          const moved = go(mv); if (stopped() || !tgt.h) return; faceTo(m, tgt.h);
          if (tgt.h && hexDist(m.h, tgt.h) <= reach) slamOK && slamV > kv(m, tgt, Ema) ? slam(m, tgt, Math.max(1, moved), false) : strike(m, w, tgt, { charge: true });
          else L(`${m.id} charges at ${tgt.id} but can't get through to it`);
        });
        // Heroic Charge (MA132, cinematic option): 1 FP to ignore the Move and Attack penalty and cap
        if (CINEMATIC && !u.flags.machine && m.fp > Math.max(3, u.fp / 3)) {
          const Eh = planAttack(m, w, tgt, w.level - skillPen(m), true).score;
          add(Wm * kv(m, tgt, Eh) + GAMMA * Wm * worth - risk(m, arrive, "") - 0.02, `heroic-charge@${tgt.id}`, () => {
            go(mv); if (stopped() || !tgt.h) return; faceTo(m, tgt.h);
            if (hexDist(m.h, tgt.h) <= reach) { spendFP(m, 1); L(`${m.id} makes a heroic charge (1 FP)`); strike(m, w, tgt, { charge: true, heroic: true }); }
          });
        }
        // All-Out Attack after a half move (B365): +4 to hit, no defence until next turn
        if (len <= Math.max(2, Math.ceil(mv / 2))) {
          const Eaoa = planAttack(m, w, tgt, w.level - skillPen(m) + 4 + smMelee(m, tgt), true).score;
          const grabNear = models.filter(f => f.u.side !== u.side && f.state === "ok" && f.h && hexDist(f.h, tgt.h) <= 2 && f.armsLost < 1).length;
          const rG = grabNear >= 3 ? 0.5 * threatOf(m) * HORIZON * Math.max(0.3, u.ai.caution) : 0;   // a crowd could drag an All-Out Attacker down (MA114)
          add(Wm * Math.max(kv(m, tgt, Eaoa), slamV) + GAMMA * Wm * worth - risk(m, arrive, "aoa") - rG, `aoa-charge@${tgt.id}`, () => {
            const moved = go(Math.max(2, Math.ceil(mv / 2))); if (stopped() || !tgt.h) return; faceTo(m, tgt.h);
            if (hexDist(m.h, tgt.h) <= reach) { m.aoa = true; L(`${m.id} charges in (All-Out Attack)`); slamOK && slamV > kv(m, tgt, Eaoa) ? slam(m, tgt, Math.max(1, moved), true) : strike(m, w, tgt, { determined: true }); }
            else L(`${m.id} rushes at ${tgt.id} but can't get through to it`);
          });
        }
      } else {
        // still out of reach: close the distance; the payoff is the fight when it arrives
        // zeal (faction profile): how little a far-off fight is discounted; Orks and the swarm run at the enemy
        // and zealots run in on faith: they half-ignore the fire on the way and believe the fight is worth having
        const z = u.ai.zeal || 0, rm = Math.max(mv, runMove(m) + (u.flags.enhMove ? mv : 0)), turns = (Math.ceil((len - mv) / Math.max(1, rm)) + 1) * (1 - z);
        const v = Math.pow(GAMMA, turns) * Wm * Math.max(worth, z * 0.1 * threatOf(tgt) * HORIZON) - risk(m, arrive, "") * (1 - z / 2);
        if (cohesion(m, tgt) <= len - rm) add(v, `close@${tgt.id}`, () => { const n = go(runMove(m)); if (n >= mv - 1) m.runK = m.runPrev + 1; if (stopped()) return; if (tgt.h) faceTo(m, tgt.h); L(n ? `${m.id} moves in on ${tgt.id}` : `${m.id} can't find a way to ${tgt.id}`); });
      }
    }

    // worth of grabbing t (B370): a pinned foe is out of the fight while friends hack at it; more hands, better odds
    function grabValue(m, t, helpers) {
      const u = m.u;
      if (m.armsLost >= 1 || t.pinned || hangsOn(m, t) || t.u.veh) return 0;
      const hit = P3[cl(u.grapple - skillPen(m) + smGrab(m, t))];
      const def = bestDefence(t, m, true);
      const pGrab = hit * (1 - (def == null ? 0 : P3[cl(def)]));
      const hands = (t.grips ? t.grips.length : 0) + helpers + 1;
      // the hold only matters if the grapplers can then take the foe down and pin it: Quick Contests of their
      // pooled ST (the strongest plus a fifth of each other) against the foe's ST, DX or grappling skill
      const pooled = u.liftST * (1 + 0.2 * Math.min(3, hands - 1));
      const contest = (a, d) => Math.max(0.02, Math.min(0.98, 0.5 + 0.08 * (a - d)));
      const pDown = t.prone ? 1 : contest(Math.max(pooled, u.dx, u.grapple), Math.max(t.u.liftST, t.u.dx - 4, t.u.grapple - 4));
      const dSM = t.u.sm - u.sm, pPin = contest(pooled + (dSM < 0 ? -3 * dSM : 0), t.u.liftST + (dSM > 0 ? 3 * dSM : 0));
      // and only if someone can then hurt the helpless foe (any location, chinks included); a foe nobody can
      // cut is just held, which doesn't win the fight
      const hurt = models.filter(a => a.u.side === u.side && a.state === "ok" && a.h && hexDist(a.h, t.h) <= moveOf(a) + 1)
        .reduce((b, a) => Math.max(b, ...["torso#c", "neck#c", "skull#c", "vitals", "neck"].map(l => expInj(a.u.melee, t.u, l))), 0);
      const kill = Math.max(0.05, Math.min(1, hurt / remOf(t)));
      return pGrab * pDown * pPin * kill * threatOf(t) * Math.min(1, hands / 4) * 0.8 * HORIZON;
    }
    // worth of being in reach of t: the best of a full blow (with Extra Attacks) and a grab
    function meleeWorth(m, t, helpers) {
      const w = m.u.melee;
      const E = planAttack(m, w, t, w.level - skillPen(m), true).score * (1 + (m.u.flags.extraAttack || 0));
      return Math.max(kv(m, t, E), grabValue(m, t, helpers));
    }
    // ---- options in hand-to-hand
    function meleeOptions(m, adj, add, rNow, Wm, Wr, mw) {
      const u = m.u;
      const gun = m.grips.length || gunGrip(m) || !gunReady(m) || m.gunSpent || (holdingGun(m) && !(u.ranged && u.ranged.oneHanded)) ? null : (u.ranged && !m.gunBroken && !m.jam && m.armsLost < 2 ? u.ranged : null);
      const threat = threatTo(m);
      for (const t of adj) {
        const face = () => { faceTo(m, t.h); };
        for (const w of mw) {
          const lvl = w.level - skillPen(m) - (m.prone ? 4 : 0) - closePen(m, w) + smMelee(m, t);
          const n = 1 + (u.flags.extraAttack || 0), tr = trained(m, w), P = (L2, d) => planAttack(m, w, t, L2, true, d, { noDa: !tr }).score;
          const ev = m.evaluate && m.evaluate.t === t && m.evaluate.turn === turn - 1 ? m.evaluate.n : 0;
          const base = P(lvl + ev);
          add(Wm * kv(m, t, base * n) - rNow, `strike ${w.name}@${t.id}`, () => { face(); strike(m, w, t, {}); });
          // Mighty Blows (extra effort, 1 FP, B357): with an Attack only (MA131)
          // All-Out Attack (Strong) and Mighty Blows only work with ST-based thrust or swing damage (B365)
          const stB = /^\s*(thr|sw)/.test(w.text || "");
          if (stB && m.fp > Math.max(4, m.u.fp / 3) && !u.flags.machine)
            add(Wm * kv(m, t, P(lvl + ev, boosted(w, 1)) * n) - rNow - 0.02 * n, `mighty@${t.id}`, () => { face(); strike(m, w, t, { mighty: true }); });
          // Rapid Strike (B370): two blows at -6 (-3 for a master); trained fighters only (MA113)
          const rp = u.flags.master ? 3 : 6;
          if (tr && lvl - rp >= 10) {
            const Er = 2 * P(lvl - rp) + (n - 1) * P(lvl);
            add(Wm * kv(m, t, Er) - rNow, `rapid@${t.id}`, () => { face(); strike(m, w, t, { rapid: true }); });
          }
          // Flurry of Blows (B357): 1 FP a blow halves the Rapid Strike penalty
          const rf = Math.ceil(rp / 2);
          if (tr && lvl - rf >= 10 && lvl - rp < lvl - rf && m.fp > Math.max(4, m.u.fp / 3) && !u.flags.machine) {
            const Ef = 2 * P(lvl - rf) + (n - 1) * P(lvl);
            add(Wm * kv(m, t, Ef) - rNow - 0.04, `flurry@${t.id}`, () => { face(); strike(m, w, t, { rapid: true, flurry: true }); });
          }
          // the foe's best defence now, and what a feint's margin is worth: the chance to win the contest times the
          // margin (about 1.2 at equal skill, +0.7 a point of edge, MA101)
          const def = bestDefence(t, m, true, w), skillT = Math.max(t.u.melee.level, t.u.dx);
          const gainOf = L2 => Math.max(0, 1.2 + 0.7 * (L2 - skillT));
          const Pfd = (L2, g) => { if (def == null) return P(L2); const a = P3[cl(def)], b = P3[cl(def - g)]; return a < 1 ? P(L2) * (1 - b) / Math.max(0.01, 1 - a) : P(L2); };
          // All-Out Attack (B365): Determined +4, Double (two blows), Strong (+2 or +1/die), Feint (a feint, then a blow, MA97)
          // an All-Out Attacker loses every grapple contest (MA114): held, or with two foes beside it who could grab,
          // that risks being dragged down and pinned, which is as good as out of the fight
          const grabbers = adj.filter(f => f.armsLost < 1 && !f.grips.length).length;
          const rA = risk(m, m.h, "aoa") + (m.grips.length || grabbers >= 2 ? 0.5 * threatOf(m) * HORIZON * Math.max(0.3, u.ai.caution) : 0);
          add(Wm * kv(m, t, P(lvl + 4) * n) - rA, `aoa-det@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { determined: true }); });
          add(Wm * kv(m, t, (n + 1) * P(lvl)) - rA, `aoa-double@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { double: true }); });
          if (stB) add(Wm * kv(m, t, P(lvl, boosted(w, 1)) * n) - rA, `aoa-strong@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { strong: true }); });
          if (tr) {
            add(Wm * kv(m, t, Pfd(lvl, gainOf(lvl)) * n) - rA, `aoa-feint@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { double: true, feintFirst: true }); });
            // All-Out Attack (Double) with a Rapid Strike: three blows, two of them at -6 (MA97)
            if (lvl - rp >= 10) add(Wm * kv(m, t, 2 * P(lvl - rp) + n * P(lvl)) - rA, `aoa-rapid@${t.id}`, () => { face(); m.aoa = true; strike(m, w, t, { double: true, rapid: true }); });
            // a Rapid Strike that opens with a feint (MA127): feint and blow both at -6
            if (lvl - rp >= 10) add(Wm * kv(m, t, Pfd(lvl - rp, gainOf(lvl - rp)) + (n - 1) * P(lvl)) - rNow, `rapid-feint@${t.id}`, () => { face(); strike(m, w, t, { rapid: true, feintFirst: true }); });
            // Committed Attack (MA99): +2 to hit or +1 damage per two dice, defences at -2 with no retreat or parry
            const rC = risk(m, m.h, "ca") + (m.grips.length || grabbers >= 2 ? 0.2 * threatOf(m) * HORIZON * Math.max(0.3, u.ai.caution) : 0);   // -2 in grapple contests (MA114)
            add(Wm * kv(m, t, P(lvl + 2) * n) - rC, `ca-det@${t.id}`, () => { face(); strike(m, w, t, { committed: "det" }); });
            if (stB) add(Wm * kv(m, t, P(lvl, boosted(w, 0.5)) * n) - rC, `ca-strong@${t.id}`, () => { face(); strike(m, w, t, { committed: "str" }); });
            // attack and fly out: a long weapon strikes, then steps back out of a shorter foe's reach
            if (w.reachMax >= 2 && t.u.melee.reachMax < w.reachMax && hexDist(m.h, t.h) < w.reachMax) {
              const h = retreatHex(m, t);
              if (h && hexDist(h, t.h) <= w.reachMax) add(Wm * kv(m, t, P(lvl) * n) - risk(m, h, "ca"), `ca-flyout@${t.id}`, () => { face(); strike(m, w, t, { committed: "fly", flyOut: true }); });
            }
            // Defensive Attack (MA100): -2 damage or -1/die, +1 to a parry or block
            add(Wm * kv(m, t, P(lvl, boosted(w, -1)) * n) - risk(m, m.h, "da"), `da-strike@${t.id}`, () => { face(); strike(m, w, t, { defensive: true }); });
          }
          // Feint, Beat, Ruse (B365, MA100-101): this turn, for the next; trained fighters only (MA113)
          if (tr && def != null && !m.feint && !m.grips.length && P3[cl(def)] > 0.4) {   // no Feint while held (B371)
            const g = gainOf(lvl);
            add(GAMMA * Wm * kv(m, t, Pfd(lvl, g) * n) - rNow, `feint@${t.id}`, () => { face(); m.feint = { t, n: feintRoll(m, w, t, lvl), turn }; });
            // a Ruse (IQ-based) when wits beat hands
            const iqE = (u.stats.iq || 10) - u.dx, perE = (t.u.stats.per || t.u.stats.iq || 10) - t.u.dx;
            if (iqE > 0 && iqE > perE) add(GAMMA * Wm * kv(m, t, Pfd(lvl, gainOf(lvl + iqE - Math.max(0, perE))) * n) - rNow, `ruse@${t.id}`, () => { face(); m.feint = { t, n: feintRoll(m, w, t, lvl, "ruse"), turn }; });
            // a Beat (ST-based) against the Parry or Block that turned our blow, or that we parried: it helps the whole squad
            if (m.parriedBy && m.parriedBy.t === t && turn - m.parriedBy.turn <= 1) {
              const stE = u.st - u.dx - Math.max(0, t.u.st - t.u.dx), pals = models.filter(x => x !== m && x.u.side === u.side && x.state === "ok" && x.h && hexDist(x.h, t.h) <= x.u.melee.reachMax).length;
              const how = m.parriedBy.how;
              add(GAMMA * Wm * kv(m, t, Pfd(lvl, gainOf(lvl + stE)) * n * (1 + 0.6 * pals)) - rNow, `beat@${t.id}`, () => {
                face(); const b = feintRoll(m, w, t, lvl, "beat");
                if (b) t.beat = { how, n: b, until: turn + 1 };
              });
            }
          }
          // Defensive Feint (MA101): throw off the foe's next blow when its weapon is the thing to fear
          if (tr && lvl - skillT >= 4 && !m.feintDef && t.u.melee) {
            const g = gainOf(lvl), fl = t.u.melee.level;
            const cut = rNow * Math.max(0, 1 - P3[cl(fl - g)] / Math.max(0.01, P3[cl(fl)]));
            add(cut * 0.8 - rNow * 0.2, `dfeint@${t.id}`, () => { face(); m.feintDef = { t, n: feintRoll(m, w, t, lvl, "dfeint"), turn }; });
          }
          // Evaluate (B364): +1 a turn (to +3) on the next blow at this foe, and it cancels its feints against us (MA100)
          if (!m.grips.length) {
            const e1 = Math.min(3, (m.evaluate && m.evaluate.t === t ? m.evaluate.n : 0) + 1);
            add(GAMMA * Wm * kv(m, t, P(lvl + e1) * n) - rNow - 0.01, `evaluate@${t.id}`, () => { face(); m.evaluate = { t, n: e1, turn }; L(`${m.id} evaluates ${t.id} (+${e1})`); });
          }
        }
        // point-blank gun (Bulk penalty), averaged over its reloads
        if (gun && (gun.shots.mag === Infinity || m.ammo > 0) && m.reload === 0) {
          const E = planAttack(m, gun, t, gun.level + Math.min(0, gun.bulk || 0) - skillPen(m), false).score * sustainOf(gun);
          add(Wr * kv(m, t, E) - rNow, `point-blank@${t.id}`, () => { face(); fireAt(m, gun, t, { pointBlank: true }); });
          // All-Out Attack (Determined) with a gun at a foe in reach: +4 (TS p. 25)
          const E4 = planAttack(m, gun, t, gun.level + Math.min(0, gun.bulk || 0) - skillPen(m) + 4, false).score * sustainOf(gun);
          add(Wr * kv(m, t, E4) - risk(m, m.h, "aoa"), `aoa-point-blank@${t.id}`, () => { face(); m.aoa = true; fireAt(m, gun, t, { pointBlank: true, aoa: true }); });
          // blade and pistol together (B417)
          if (gun.oneHanded && u.melee.oneHanded && u.melee.name !== "Punch" && !m.armsLost) {
            const pm = u.dualPen, pg = u.dualPen + u.offPen;
            const Ed = planAttack(m, u.melee, t, u.melee.level - skillPen(m) - pm, true).score
              + planAttack(m, gun, t, gun.level + Math.min(0, gun.bulk) - skillPen(m) - pg, false).score;
            add(Wm * kv(m, t, Ed) - rNow, `dual@${t.id}`, () => {
              face(); L(`${m.id} attacks with both hands (${u.melee.name} and ${gun.name})`);
              strike(m, u.melee, t, { pen: pm }); if (t.state === "ok") fireAt(m, gun, t, { pointBlank: true, pen: pg });
            });
          }
        }
        if (gun && gun.shots.mag !== Infinity && m.ammo < gun.shots.mag && gun.shots.reload <= 3 && (m.mags > 0 || m.reload > 0)) {
          const turns = Math.max(1, gun.shots.reload - Math.max(0, m.reload > 0 ? gun.shots.reload - m.reload : 0));
          const Eg = planAttack(m, gun, t, gun.level + Math.min(0, gun.bulk || 0) - skillPen(m), false).score;
          add(Math.pow(GAMMA, turns) * Wr * kv(m, t, Eg) - rNow, `reload-cc`, () => {
            if (m.reload === 0) m.reload = gun.shots.reload;
            if (--m.reload <= 0) { m.reload = 0; refill(m, gun); } L(`${m.id} reloads in close combat`);
          });
        }
        // grappling (B370): grab a foe the weapon can't hurt; a pinned foe is out of the fight while friends hack at it
        if (m.armsLost < 1 && !t.pinned && gripsOn(t).length < 4 && !t.u.veh) {
          const helpers = models.filter(a => a !== m && a.u.side === u.side && a.state === "ok" && a.h && hexDist(a.h, t.h) <= 1).length;
          add(Wm * grabValue(m, t, helpers) - rNow, `grab@${t.id}`, () => { face(); grab(m, t); });
        }
        // grab the gun (B370): a hand on a long gun's barrel pushes the muzzle aside; worth what the gun would do to us
        // over what the foe could do once it lets go and draws a blade
        if (m.armsLost < 1 && !m.grips.length && !holdingGun(m) && !t.u.veh && longGun(t) && gunReady(t) && !gunGrip(t) && !t.pinned && t.reload === 0
          && (m.inHand !== "both" || !u.melee || u.melee.natural || u.melee.oneHanded !== false)) {
          const g = t.u.ranged, hit = P3[cl(u.grapple - skillPen(m) + smGrab(m, t))], def = bestDefence(t, m, true);
          const pGrab = hit * (1 - (def == null ? 0 : P3[cl(def)]));
          const Eg = planAttack(t, g, m, g.level + Math.min(0, g.bulk || 0) - skillPen(t) + 4, false).score * sustainOf(g);
          const Em = t.u.melee ? GAMMA * planAttack(t, t.u.melee, m, t.u.melee.level - skillPen(t), true).score : 0;
          // the share of the foe's threat that is its gun, denied for the two or so turns it takes to wrench it free
          const share = Eg > 0 ? Math.max(0, Eg - Em) / Eg : 0;
          add(pGrab * share * threatOf(t) * 2 - rNow, `grab-gun@${t.id}`, () => { face(); grabGun(m, t); });
        }
        // Shove (B372): put a foe on the ground for friends who can hurt it
        if (!t.prone && m.armsLost < 2) {
          const friends = models.filter(a => a !== m && a.u.side === u.side && a.state === "ok" && a.h && hexDist(a.h, t.h) <= a.u.melee.reachMax);
          if (friends.length) {
            const sd = stDamage(u.st), thr = parseDamage("thr cr", sd.thr, sd.sw);
            const kb = 2 * (thr.n * 3.5 + thr.add) / Math.max(1, t.u.st - 2);
            const pDown = kb >= 1 ? 1 - P3[cl(t.u.dx - Math.floor(kb) + 1)] : 0;
            const pHit = P3[cl(Math.max(u.dx, u.grapple) - skillPen(m))];
            const vS = pHit * pDown * 0.3 * threatOf(t) * Math.min(1, friends.length / 2) * HORIZON;
            add(vS - rNow, `shove@${t.id}`, () => { face(); shove(m, t); });
          }
        }
      }
    }

    // ---- grenades: expected harm of a throw at each foe (the one struck takes it all, the rest the blast and fragments)
    // figures screening x from a blast at hex a, cached for the second (the planner asks the same pairs often)
    const SCR = new Map(); let scrTurn = -1;
    function screenN(a, x) {
      if (scrTurn !== turn) { SCR.clear(); scrTurn = turn; }
      const k = a.q + "," + a.r + ">" + x.ix;
      let n = SCR.get(k);
      if (n === undefined) { n = between(a, x.h, null).filter(y => y !== x).length; SCR.set(k, n); }
      return n;
    }
    function bestGrenade(m, pool) {
      let best = null;
      m.u.grenades.forEach((g, i) => {
        if (!m.grenadesLeft[i]) return;
        for (const c of pool.slice(0, 8)) {
          if (!c.h || !los(m.h, c.h)) continue;
          const d = hexDist(m.h, c.h);
          if (d < 3 || d > g.range.max) continue;
          const lvl = g.level - skillPen(m) + rangePenalty(d + spdOf(c.steps || 0)) + c.u.sm;
          // the target may Dodge (then it takes the blast at a yard, with no divisor)
          const dd = rangedDefence(c, m), pDodge = dd == null ? 0 : P3[Math.max(0, Math.min(18, dd))];
          const third = { ...g.dmg, div: 1, mult: g.dmg.mult / 3, key: "s1nd" };
          const direct = kv(m, c, (1 - pDodge) * expInj(g, c.u, "torso") + pDodge * expInj(g, c.u, "area", third));
          // everyone else in reach of the blast (3 yards counted) and the fragments, friends (and the thrower) included
          let others = 0;
          const fr = g.dmg.frag, fR = fr ? 5 * fr.n : 0;
          for (const x of models) {
            if (x === c || !x.h || x.state !== "ok") continue;
            const k = Math.max(1, hexDist(x.h, c.h));
            if (k > Math.max(3, fR) || !los(c.h, x.h)) continue;
            let e = k <= 3 ? expInj(g, x.u, "area", { ...g.dmg, div: 1, mult: g.dmg.mult / (3 * k), key: "s" + k + "nd" }) : 0;
            // expected fragments: the chance of success by 0, 3, 6... (one more per 3 points, B414)
            if (fr && k <= fR) { let nF = 0; for (let j = 15 + rangePenalty(k) + x.u.sm - (x.prone || x.kneel ? 2 : 0) - 4 * screenN(c.h, x); j >= 3; j -= 3) nF += P3[Math.min(18, j)]; e += nF * expInjRandom(g, x.u, { n: fr.n, add: 0, mult: 1, div: 1, type: fr.type, key: "f" }); }
            others += x.u.side === m.u.side ? -m.u.ai.caution * Math.min(1, e / remOf(x)) * threatOf(x) * HORIZON : kv(m, x, e);
          }
          const v = (direct + others) * P3[Math.max(0, Math.min(18, lvl))];
          if (!best || v > best.s) best = { i, c, s: v, v, lvl };
          // (a foe in sight is thrown at, and may dodge; the +4 throw at a hex is kept for foes out of sight, below:
          // user direction)
        }
        // through a doorway or round a corner (TS p. 24): a foe out of sight, a hex we can see that it can see
        if (terr) for (const c of pool.slice(0, 6)) {
          if (!c.h || los(m.h, c.h) || hexDist(m.h, c.h) > g.range.max + 2) continue;
          for (const [dq, dr] of [...DIRS, ...DIRS.map(([a, b]) => [2 * a, 2 * b])]) {
            const X = { q: c.h.q + dq, r: c.h.r + dr }, xi = idx(key(X.q, X.r));
            if (xi == null || !pass[xi] || closed[xi] || !los(m.h, X) || !los(X, c.h)) continue;
            const d = hexDist(m.h, X);
            if (d < 3 || d > g.range.max) continue;
            const lvl = g.level - skillPen(m) + rangePenalty(d) + 4;   // a throw at a hex (B414)
            let v = 0;
            for (const x of models) {
              if (x.state !== "ok" || !x.h || !los(X, x.h)) continue;
              const k = Math.max(1, hexDist(x.h, X));
              if (k > 3) continue;
              const e = expInj(g, x.u, "area", { ...g.dmg, div: 1, mult: g.dmg.mult / (3 * k), key: "s" + k + "nd" });
              v += x.u.side === m.u.side ? -m.u.ai.caution * Math.min(1, e / remOf(x)) * threatOf(x) * HORIZON : kv(m, x, e);
            }
            v *= P3[Math.max(0, Math.min(18, lvl))];
            if (v > 0 && (!best || v > best.s)) best = { i, c, hex: X, s: v, v, lvl };
          }
        }
      });
      return best;
    }
    // Diving for cover (B377): someone who sees a grenade land beside them may Dodge; success puts them a yard
    // further from the blast, prone
    // Diving for cover (B377): someone who sees a grenade land may Dodge; success puts them a yard further from it,
    // prone, and into a hex out of its sight (behind a crate, a wall or a corner) when there is one
    function dive(x, at) {
      if (x.state !== "ok" || x.pinned || x.aoa || x.grips.length) return false;
      const r = check(dodgeOf(x) - (x.stunned ? 4 : 0) - (x.prone ? 3 : 0));
      if (!r.ok) return false;
      if (at && x.h) {
        let best = null, bs = -1;
        for (const [dq, dr] of DIRS) {
          const h = { q: x.h.q + dq, r: x.h.r + dr };
          if (taken(key(h.q, h.r)) || (terr && !walkable(key(h.q, h.r)))) continue;
          const sc = (los(at, h) ? 0 : 10) + hexDist(h, at);
          if (hexDist(h, at) >= hexDist(x.h, at) && sc > bs) { bs = sc; best = h; }
        }
        if (best) place(x, best);
      }
      x.prone = true; x.kneel = false; L(`  ${x.id} dives for cover`);
      return true;
    }
    function throwGrenade(m, g) {
      const w = m.u.grenades[g.i], c = g.c;
      m.grenadeReady = null; m.grenadeArmed = false; m.grenadesLeft[g.i]--; m.attacked = true;
      reveal(m);
      if (g.hex) {
        // Attacking an area (B414): a throw at a hex is +4 (in g.lvl), with no defence, though anyone there may dive
        // for cover; a miss lands its margin of failure in yards off, at most half the distance
        faceTo(m, g.hex);
        const r = g.lvl < 3 ? { ok: false, margin: g.lvl - 10 } : check(g.lvl), raw = rollDamage(w.dmg);
        const off = r.ok ? 0 : Math.max(1, Math.min(Math.ceil(hexDist(m.h, g.hex) / 2), -r.margin));
        const at = off ? scatter(g.hex, off) : g.hex;
        const how = g.feet ? `at ${c.id}'s feet` : terr && terr.doorI[idx(key(g.hex.q, g.hex.r))] ? `through the doorway at ${c.id}` : `round the corner at ${c.id}`;
        L(`${m.id} lobs a ${w.name} ${how} (skill ${g.lvl})${off ? `: ${off} yd off` : ""}`);
        if (m.h) FX(["s", m.h.q, m.h.r, at.q, at.r, m.u.side, 1, m.ix, c ? c.ix : -1, g.lvl, 1, 1, "grenade"]);
        landOn(m, w, at, raw);
        explosion(m, w, at, raw);
        return;
      }
      faceTo(m, c.h);
      if (m.h && c.h) FX(["s", m.h.q, m.h.r, c.h.q, c.h.r, m.u.side, 1, m.ix, c.ix, g.lvl, 1, 1, "grenade"]);
      const r = g.lvl < 3 ? { ok: false, margin: g.lvl - 10, crit: false, fumble: false } : check(g.lvl);   // no roll below 3 (B344): a wild throw
      const raw = rollDamage(w.dmg);
      if (r.ok) {
        // a thrown grenade can be dodged or blocked (B373-375); it then lands the defence's margin of success in
        // yards away (B414)
        const def = r.crit ? null : defend(c, m, "thrown", 0, 0, w);
        if (def != null) {
          const off = Math.max(1, def.margin), at = scatter(c.h, off);
          L(`${m.id} throws a ${w.name} at ${c.id} (skill ${g.lvl}): ${c.id} ${def.how === "block" ? "knocks it aside" : "dodges"} and it goes off ${off} yd away`);
          landOn(m, w, at, raw);
          explosion(m, w, at, raw);
          return;
        }
        L(`${m.id} throws a ${w.name} at ${c.id} (skill ${g.lvl}): direct hit`);
        const at = c.h;
        applyHit(m, w, c, "torso", true, false, null, raw);
        explosion(m, w, at, raw, c);
      } else {
        const off = Math.max(1, Math.min(Math.ceil(hexDist(m.h, c.h) / 2), -r.margin)), at = scatter(c.h, off);
        L(`${m.id} throws a ${w.name} at ${c.id} (skill ${g.lvl}): it lands ${off} yd wide`);
        landOn(m, w, at, raw);
        explosion(m, w, at, raw);
      }
    }

