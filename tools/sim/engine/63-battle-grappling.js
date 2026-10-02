// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ---- grappling (B370-371): grab, take down, pin; a pinned model is helpless until it breaks free
    function gripsOn(t) {
      t.grips = t.grips.filter(g => g.state === "ok" && g.holding === t && g.h && t.h && hexDist(g.h, t.h) <= 1);
      if (!t.grips.length) t.pinned = false;
      return t.grips;
    }
    function release(m) {
      const t = m.holding;
      if (!t) return;
      m.holding = null;
      t.grips = t.grips.filter(g => g !== m);
      if (!t.grips.length) t.pinned = false;
    }
    // several grapplers pull together: the strongest one's ST plus a fifth of each other's (simulator rule)
    // Grappling and size (B370, Pyramid 3/77 p. 9-10): the larger fighter gets +1 per SM of difference to grab (at
    // most +4), and so does a smaller one, "because there's so much to hang on to", but a smaller grappler can only
    // exploit a hold (take down, pin) on a part where that bonus plus the location's grappling penalty is 0 or less:
    // it goes for the neck (-3), and against something more than 3 SM bigger it can only hang on. So can anyone the
    // foe out-muscles more than twice over (B370): it's just extra encumbrance. In the pin, the larger gets +3 per SM.
    const hangsOn = (g, t) => t.u.sm - g.u.sm > 3 || t.u.liftST > 2 * g.u.liftST;
    const smGrab = (m, t) => { const d = t.u.sm - m.u.sm; return d > 0 ? (d <= 3 ? Math.min(4, d) - 3 : 4) : Math.min(4, -d); };
    function gripST(t) {
      const g = gripsOn(t).filter(x => !hangsOn(x, t)).map(x => x.u.liftST).sort((a, b) => b - a);
      return g.length ? g[0] + g.slice(1).reduce((a, x) => a + x / 5, 0) : 0;
    }
    function contest(a, b) { return contest3(a, b) > 0; }
    // Quick Contest (B348): 1 a win, -1 a loss, 0 a tie (both fail, or equal margins)
    function contest3(a, b) {
      const ra = check(a), rb = check(b);
      if (ra.ok !== rb.ok) return ra.ok ? 1 : -1;
      if (!ra.ok) return 0;
      return Math.sign(ra.margin - rb.margin);
    }
    // the grappler whose hold counts, and what the hold is worth in a break-free contest (B371): +5 with two hands,
    // pinned +10 (+5 with one); -4 if it's stunned
    const leadGrip = t => gripsOn(t).filter(x => !hangsOn(x, t)).sort((x, y) => y.u.liftST - x.u.liftST)[0] || gripsOn(t)[0];
    const twoHands = g => g.armsLost < 1 && !g.knifeOut && (g.inHand === "none" || g.inHand === "gun" || !g.u.melee || g.u.melee.natural || g.u.melee.name === "Punch");
    const holdBonus = (t, g) => !g ? 0 : (t.pinned ? (twoHands(g) ? 10 : 5) : (twoHands(g) ? 5 : 0)) - (g.stunned ? 4 : 0) + 2 * (g.u.flags.extraArms || 0);   // +2 per extra arm (MA115)
    const armsOf = x => 2 + (x.u.flags.extraArms || 0) - (x.armsLost || 0);
    // Parrying an unarmed attack with a weapon (B376): the attacker's reaching arm takes the weapon's damage
    function cutsArm(t, att) {
      const w = t.u.melee;
      if (!w || w.natural || w.name === "Punch" || t.state !== "ok" || att.state !== "ok") return;
      if (!check(w.level - skillPen(t) - (att.u.judo ? 4 : 0)).ok) return;   // B376: a skill roll to strike the limb squarely
      L(`  ${t.id}'s ${w.name} catches ${att.id}'s arm`);
      applyHit(t, w, att, "arm", false, false, null, rollDamage(w.dmg));
    }
    function grab(m, t) {
      const lvl = m.u.grapple - skillPen(m) - (m.prone ? 4 : 0) - (m.grips.length ? 4 : 0) + smGrab(m, t) + 2 * (m.u.flags.extraArms || 0);   // +2 per extra arm (MA115)
      m.attacked = true;
      if (lvl < 3) return;   // B344
      const r = check(lvl);
      if (!r.ok) { L(`${m.id} grabs at ${t.id} (skill ${lvl}): misses`); return; }
      if (!r.crit) { const def = defend(t, m, true, 0, 0, UNARMED); if (def) { L(`${m.id} grabs at ${t.id}: ${def.how === "parry" ? "parried" : def.how === "block" ? "blocked" : "dodged"}`); if (def.how === "parry") cutsArm(t, m); return; } }
      release(m); if (m.gunHold) { m.gunHold.gunGrip = null; m.gunHold = null; } m.holding = t; t.grips.push(m);
      L(`${m.id} grabs ${t.id} (${t.grips.length} holding on)`);
    }
    function grabGun(m, t) {
      const lvl = m.u.grapple - skillPen(m) - (m.prone ? 4 : 0) + smGrab(m, t);
      m.attacked = true;
      if (lvl < 3) return;
      const r = check(lvl), gn = t.u.ranged.name.split(",")[0];
      if (!r.ok) { L(`${m.id} grabs at ${t.id}'s ${gn} (skill ${lvl}): misses`); return; }
      if (!r.crit) { const def = defend(t, m, true, 0, 0, UNARMED); if (def) { L(`${m.id} grabs at ${t.id}'s ${gn}: ${def.how === "parry" ? "parried" : def.how === "block" ? "blocked" : "dodged"}`); return; } }
      release(m); m.gunHold = t; t.gunGrip = m;
      L(`${m.id} seizes ${t.id}'s ${gn} and forces the muzzle aside`);
    }
    // wrench the gun free: a Quick Contest of ST, the owner's two hands against one (+2)
    function wrenchGun(m) {
      const g = gunGrip(m);
      if (!g) return;
      if (contest(m.u.liftST - skillPen(m) + 2, g.u.liftST - skillPen(g) + 2 * (g.u.flags.extraArms || 0))) { g.gunHold = null; m.gunGrip = null; L(`${m.id} wrenches its ${m.u.ranged.name.split(",")[0]} free of ${g.id}`); }
      else L(`${m.id} struggles for its ${m.u.ranged.name.split(",")[0]} with ${g.id}`);
    }
    function wrestle(m, t) {
      if (hangsOn(m, t)) { L(`${m.id} hangs on to ${t.id} but can do nothing more with it`); return; }
      const dSM = t.u.sm - m.u.sm;
      if (!t.prone) {
        // Takedown: Quick Contest of the higher of ST, DX or grappling skill
        // the held model is at -4 DX (B370)
        const a = Math.max(gripST(t), m.u.dx, m.u.grapple) - skillPen(m), d = Math.max(t.u.liftST, t.u.dx - 4, t.u.grapple - 4) - skillPen(t) - (t.committed ? 2 : 0);
        // a foe on All-Out Attack is truly defenceless: it loses the contest outright (MA114); a grappler that loses
        // the contest suffers the takedown itself (B370): it goes down and loses its hold
        // Sprawling (MA119): a trained grappler who expects to lose falls willingly; the contest runs at +3 for it, and a
        // grappler that loses or ties goes down too and loses its hold
        if (!t.aoa && t.u.grapple > t.u.dx && a - d >= 2 && t.state === "ok") {
          t.prone = true;
          const c2 = contest3(a, d + 3);
          if (c2 <= 0) { L(`${t.id} sprawls as ${m.id} drags it down, and takes ${m.id} with it`); release(m); m.prone = true; }
          else L(`${t.id} sprawls as ${m.id} drags it down`);
          return;
        }
        const c = t.aoa ? 1 : contest3(a, d);
        if (c > 0) { t.prone = true; L(`${m.id}${t.grips.length > 1 ? ` and ${t.grips.length - 1} more` : ""} drag ${t.id} to the ground`); }
        else if (c < 0) { L(`${m.id} tries to drag ${t.id} down (${Math.round(a)} vs ${d}) and is thrown down itself`); release(m); m.prone = true; }
        else L(`${m.id} tries to drag ${t.id} down (${Math.round(a)} vs ${d}): it keeps its feet`);
      } else if (!t.pinned) {
        // Pin: Quick Contest of ST against a foe on the ground
        // more arms than the foe: +3 to pin it or resist its pin (MA115)
        const arms = armsOf(m) > armsOf(t) ? 3 : armsOf(t) > armsOf(m) ? -3 : 0;
        if (t.aoa || contest(gripST(t) - skillPen(m) + (dSM < 0 ? -3 * dSM : 0) + arms, t.u.liftST - skillPen(t) - (t.committed ? 2 : 0) + (dSM > 0 ? 3 * dSM : 0))) { t.pinned = true; L(`${m.id} pins ${t.id} (${t.grips.length} holding it down)`); }
        else L(`${m.id} tries to pin ${t.id}: it struggles free of the hold`);
      }
    }
    // the held model's turn: break one grip (Quick Contest of ST, or grappling skill if better)
    function breakFree(m) {
      const g = gripsOn(m);
      if (!g.length) return false;
      // a Quick Contest of ST (B371); pinned, one attempt every 10 seconds
      const lead = leadGrip(m), a = m.u.liftST - skillPen(m) + 2 * (m.u.flags.extraArms || 0), d = gripST(m) + holdBonus(m, lead);
      if (m.pinned) m.nextBreak = turn + 10;
      if (contest(a, d)) {
        const strongest = lead;
        release(strongest); m.pinned = false;
        L(`${m.id} breaks free of ${strongest.id}${m.grips.length ? ` (${m.grips.length} still holding)` : ""}`);
      } else L(`${m.id} strains against ${g.length} grappler${g.length > 1 ? "s" : ""} (ST ${Math.round(a)} vs ${Math.round(d)})`);
      return true;
    }
