// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // damage bonus for All-Out Attack (Strong) and Mighty Blows, for planning
    const boosted = (w, k) => ({ ...w.dmg, add: w.dmg.add + k * Math.max(2, w.dmg.n), key: "b" + k });

    // a model's condition for the replay: share of HP left, or the worst wound box under Fractional Health
    const vit = m => {
      if (!frac) return Math.max(0, Math.min(1, m.hp / m.u.HP));
      let worst = 0;
      for (const W of Object.values(m.wounds)) for (let l = 8; l > worst; l--) if (W[l] > 0) { worst = l; break; }
      return 1 - worst / 8;
    };
    // condition bits for the replay: 1 stunned, 2 prone, 4 kneeling, 8 held, 16 holding, 32 All-Out Defense,
    // 64 All-Out Attack, 128 aiming, 256 pinned, 512 waiting
    const bits = m => (m.stunned ? 1 : 0) | (m.prone ? 2 : 0) | (m.kneel ? 4 : 0) | (m.grips.length ? 8 : 0) | (m.holding ? 16 : 0) | (m.aod ? 32 : 0) | (m.aoa ? 64 : 0) | (m.aimTurns > 0 ? 128 : 0) | (m.pinned ? 256 : 0) | (m.waiting ? 512 : 0) | (m.reload > 0 || (m.stn && m.stn.some(x => x.reloading > 0)) ? 1024 : 0);
    const snap = () => models.map(m => {
      const path = m.trail; m.trail = [];
      return m.h ? [m.h.q, m.h.r, m.u.side, m.state === "ok" ? (m.stunned ? 2 : m.prone ? 3 : 1) : 0, m.facing, Math.round(vit(m) * 100) / 100, path,
        bits(m), m.u.shield ? Math.round(100 * Math.max(0, m.sp) / m.u.shield.sp) / 100 : -1, m.aimTarget && m.aimTurns > 0 ? m.aimTarget.ix : -1, m.u.veh ? m.turretFacing ?? m.facing : null] : null;
    });
    let turn = 0;
    for (turn = 1; turn <= maxTurns; turn++) {
      if (!sideActive(0) || !sideActive(1)) break;
      L(`— Turn ${turn} —`); fieldCache.clear(); turnNow = turn - 1;
      if (frames) { if (turn > 1) { fx.push(fxb); fxb = []; } frames.push(snap()); }
      for (const m of models) {
        const sh = m.u.shield;
        if (!sh || m.state !== "ok" || m.sp >= sh.sp || !sh.recharge) continue;
        const delay = (sh.delay || 2) * (m.spCollapsed ? 2 : 1);
        if (turn - m.spHit > delay) { m.sp = Math.min(sh.sp, m.sp + sh.recharge); if (m.sp >= sh.sp) m.spCollapsed = false; }
      }
      for (const m of models) if (m.state === "ok" && m.h && !m.u.routed && !m.stunned) firingLine(m);
      lookAround();
      assignRoles();
      // the order is fixed for the fight (B363): Basic Speed, then DX, then a roll made at the start
      const order = models.filter(active).sort((a, b) => (b.u.speed - a.u.speed) || (b.u.dx - a.u.dx) || (a.init - b.init));
      for (const m of order) {
        if (m.state !== "ok" || m.u.routed || !m.h) continue;
        if (!sideActive(0) || !sideActive(1)) break;
        // per-turn defence limits last from one of the model's turns to the next (B363, B375-377)
        m.parries = 0; m.dodges = 0; m.retreated = false; m.retreatFrom = null; m.blocked = false; m.attacked = false; m.struckWith = null; m.stunRecovering = false;
        m.committed = false; m.defAtk = false; m.aoa = false; m.aod = false; m.mna = false; m.offBalance = false;   // "until its next turn", whatever it does with it
        if (!frac && m.hp <= 0) {
          const k = Math.floor(-m.hp / m.u.HP);
          if (!check(m.u.HT - k + (m.berserk ? 4 : 0) + (m.u.flags.hts || 0)).ok) { incapacitate(m, m.u.veh ? "breaks down" : "collapses unconscious"); continue; }
        }
        if (m.onFire) { burn(m); if (m.state !== "ok") continue; }
        // at 0 FP or less, a Will roll before each maneuver; failure collapses it for the fight (B426)
        if (m.fp <= 0 && !m.u.flags.machine && !check(m.u.will).ok) { incapacitate(m, "collapses from exhaustion"); continue; }
        // a stunned model that recovers still defends at -4, without retreating, until its next turn (B364)
        if (m.stunned) { m.ev = null; }
        if (m.stunned) { if (recoverStun(m)) { m.stunned = false; m.stunRec = null; m.stunT = 0; m.stunRecovering = true; L(`${m.id} recovers from stun`); } m.shock = 0; m.shockInj = 0; m.shockCap = 0; continue; }
        if (underFire(m)) { m.shock = 0; m.shockInj = 0; m.shockCap = 0; continue; }
        if (m.holding && (m.holding.state !== "ok" || !m.holding.h || hexDist(m.h, m.holding.h) > 1)) release(m);
        // grapplers it out-muscles more than twice over, or that are far smaller, are only extra encumbrance (B370)
        { const weak = gripsOn(m).filter(g => hangsOn(g, m)); if (weak.length && weak.length === gripsOn(m).length && !m.pinned) { for (const g of weak) release(g); L(`${m.id} shrugs off ${weak.length} clinging foe${weak.length > 1 ? "s" : ""}`); } }
        // pinned, all it can do is struggle; held on the ground it may also fight back from where it lies
        if (gripsOn(m).length && m.pinned) { if ((m.nextBreak || 0) <= turn) breakFree(m); else L(`${m.id} lies pinned`); m.shock = 0; m.shockInj = 0; m.shockCap = 0; continue; }
        if (!m.warpShadow && shadowed(m) && !m.u.flags.unfazeable && !m.u.flags.noMorale) {
          m.warpShadow = true;
          const fc = fright(m.u);
          if (!fc.ok) { L(`${m.id} feels the Shadow in the Warp close over its mind`); frightTable(m, -fc.margin, "Shadow in the Warp"); m.shock = 0; m.shockInj = 0; m.shockCap = 0; if (m.state !== "ok" || m.stunned) continue; }
          L(`${m.id} steels itself against the Shadow in the Warp`);
        }
        act(m);
        m.shock = 0; m.shockInj = 0; m.shockCap = 0;
        seizeOpenings();
      }
      // Regeneration (B80): HP back each second; under Fractional Health the healing clears the least severe
      // wound box once enough has built up to cover that level's threshold
      for (const m of models) {
        const rate = m.u.flags.regen;
        if (!rate || (m.state !== "ok" && m.state !== "down")) continue;
        if (!frac) { if (m.hp < m.u.HP) m.hp = Math.min(m.u.HP, m.hp + rate); continue; }
        m.regenAcc = (m.regenAcc || 0) + rate;
        for (let l = 1; l <= 7; l++) {
          const need = Math.max(1, m.u.HP * FRAC[l]);
          const k = Object.keys(m.wounds).find(x => m.wounds[x][l] > 0);
          if (!k) continue;
          if (m.regenAcc >= need) { m.wounds[k][l]--; m.regenAcc -= need; L(`${m.id}'s living metal knits a ${SEVN[l]} wound to ${k.replace(/[LR]$/, "")}`); }
          break;
        }
      }
      // regrowing bio-weapon ammunition
      for (const m of models) {
        const w = m.u.ranged;
        if (!w || !w.natural || m.state !== "ok" || w.shots.reload <= 3 || m.ammo > 0) continue;
        if (m.reload <= 0) m.reload = w.shots.reload;
        if (--m.reload <= 0) { m.reload = 0; m.ammo = w.shots.mag; }   // grown, not carried: no magazines used
      }
      // bleeding (B420), once a minute in standard mode: HT at -1 per 5 HP lost; a failure costs 1 HP (3 on a critical
      // failure); a critical success or three successes in a row stop it; No Blood and Diffuse don't bleed, and nor do
      // wounds that were all crushing or burning
      if (!frac && turn % 60 === 0) for (const m of models) {
        if (m.state !== "ok" || m.hp >= m.u.HP || m.u.flags.noblood || m.u.flags.diffuse || m.u.flags.machine || !m.bleeds || m.bleedStop) continue;
        const r = check(m.u.HT - Math.floor((m.u.HP - m.hp) / 5));
        if (r.ok) { m.bleedOK = (m.bleedOK || 0) + 1; if (r.crit || m.bleedOK >= 3) { m.bleedStop = true; L(`${m.id}'s bleeding stops`); } continue; }
        m.bleedOK = 0; const lose = r.fumble ? 3 : 1; m.hp -= lose; L(`${m.id} bleeds (${lose} HP)`);
        if (m.hp <= 0 && !check(m.u.HT).ok) incapacitate(m, "bleeds out");
      }
      // reanimation
      for (const m of models) {
        if (m.state !== "down") continue;
        const r = check(m.u.HT);
        if (r.ok) {
          const spot = m.lastH || null;
          m.state = "ok"; m.hp = Math.max(1, Math.floor(m.u.HP / 2)); m.stunned = false; m.wounds = {}; m.pain = 0; m.painSev = 0;
          m.halfMove = m.halfDodge = false; m.gawd = 0; m.armsLost = 0; m.legsLost = 0; m.crippled = {}; m.prone = true;
          // the body reknits whole: limbs, the gun back in a working hand, plate unpitted
          m.weaponArmLost = false; m.limbInj = {}; m.limbFull = {}; m.corr = {}; m.shock = 0; m.shockInj = 0; m.painAff = 0; m.bleeds = false;
          if (m.inHand === "none") m.inHand = m.u.bothReady ? "both" : "gun";
          const home = m.u.models.find(x => x.h && x !== m);
          let h = spot || (home && home.h);
          if (h) { for (let i = 0; i < 8 && taken(key(h.q, h.r)); i++) h = { q: h.q + DIRS[i % 6][0], r: h.r + DIRS[i % 6][1] }; }
          place(m, h && !taken(key(h.q, h.r)) ? h : null);
          if (!m.h) { m.state = "phased"; continue; }
          L(`${m.id} reanimates`);
        } else if (r.fumble || --m.reanim <= 0) { m.state = "phased"; L(`${m.id} phases out`); }
      }
      // morale, squad by squad: Fright Checks at half and at a quarter strength, and when the squad's leader falls
      if (morale) for (const g of groups) {
        if (g.models.some(x => x.state === "aboard")) continue;   // not under fire yet as a squad
        if (g.units.every(u => u.routed || u.flags.unfazeable || u.flags.noMorale)) continue;
        const alive = g.models.filter(active).length;
        const frac2 = alive / g.count;
        let need = false, why = "casualties";
        if (frac2 <= 0.5 && !g.checked50) { g.checked50 = true; need = true; }
        if (frac2 <= 0.25 && !g.checked25) { g.checked25 = true; need = true; }
        // the leader down (a Mass Combat rule, p. 30, brought to the squad): the next in command rolls Leadership to
        // avert panic; failing, or with no one to take over, the squad makes its Fright Checks
        if (g.hadLeader && !g.models.some(x => x.u.leader && active(x)) && alive > 0) {
          g.hadLeader = false;
          const next = g.models.filter(x => active(x) && !x.u.leader).map(x => ({ x, l: skillOf(x.u, /^Leadership/) })).sort((a, b) => b.l - a.l)[0];
          if (next && next.l > -Infinity && check(next.l - skillPen(next.x)).ok) L(`${next.x.id} takes command of ${g.name} (Leadership)`);
          else { need = true; why = "leader down"; L(`${g.name} loses its leader`); }
        }
        if (need && alive > 0) {
          L(`${g.name} ${why === "leader down" ? "wavers" : "takes heavy losses"}: Fright Checks`);
          const failed = [];
          for (const m of g.models) { if (m.state !== "ok" || m.berserk || m.u.flags.unfazeable || m.u.flags.noMorale) continue; const fc = fright(m.u, ledBonus(m), Infinity); if (!fc.ok) { frightTable(m, -fc.margin, why); failed.push(m); } }
          commissar(g, failed);
          if (!g.models.some(active)) { for (const u of g.units) u.routed = true; L(`${g.name} breaks and flees`); }
        }
      }
      for (const m of models) if (m.h) m.lastH = m.h;
    }
    if (frames) { fx.push(fxb); fxb = []; frames.push(snap()); fx.push([]); }
    const a = sideActive(0), b = sideActive(1);
    const winner = a && !b ? 0 : b && !a ? 1 : -1;
    const timeout = a && b;
    L(winner >= 0 ? `Side ${winner === 0 ? "A" : "B"} wins in ${turn - 1} turns` :
      timeout ? `Still fighting when the ${maxTurns}-second limit ran out` : `Both sides destroyed or broken after ${turn - 1} turns`);
    return {
      winner, timeout, turns: turn - 1, log, frames, fx, terrain: frames && terr ? { floor: [...terr.floor], crates: [...terr.crates], doors: [...terr.doors], shut: [...startShut], events: tev, light: [...terr.floor].map(k => { const [q, r] = k.split(",").map(Number); return [k, darkAt({ q, r })]; }).filter(x => x[1]),
        elev: EL ? terr.hx.map((h, i) => [key(h.q, h.r), EL[i]]).filter(x => x[1]) : [], kind: terr.kind || "facility",
        wallTop: WT ? terr.hx.map((h, i) => [key(h.q, h.r), WT[i]]).filter((x, i) => terr.wallI[i] && x[1] < 99) : null } : null,
      ridge: frames && RIDGE ? { ...RIDGE } : null, roster: models.map(m => { const u = m.u; return { id: m.id, side: u.side, unit: u.idx, template: u.template, faction: u.ai.name, speed: u.speed, move: u.move, hp: u.HP, st: u.st, dx: u.dx, dodge: u.dodge, parry: u.parry, dr: drAt(u.arm.dr, "torso") + drAt(u.nat, "torso"), sp: u.shield ? u.shield.sp : 0, sm: u.sm || 0, body: u.body || "upright", rk: wkind(u.ranged), mk: u.veh ? "" : mkind(u.melee), kit: [((u.ranged && u.ranged.name) || ""), ((u.melee && u.melee.name) || ""), ...(u.armourNames || [])].join("|"), veh: u.veh ? u.veh.name : "", vlocs: u.veh ? u.veh.locs : null,
        ranged: u.ranged ? `${u.ranged.name} (${u.ranged.text}${u.ranged.followText ? " + " + u.ranged.followText : ""})` : "", melee: `${u.melee.name} (${u.melee.text})`, kills: m.kills, fate: m.state }; }),
      units: units.map(u => ({
        name: u.name, side: u.side, count: u.count, routed: u.routed,
        standing: u.models.filter(m => m.state === "ok").length,
        dead: u.models.filter(m => m.state === "dead").length,
        out: u.models.filter(m => m.state === "out" || m.state === "down").length,
        phased: u.models.filter(m => m.state === "phased").length,
        dmg: u.models.reduce((t, m) => t + m.dmgDealt, 0),
        kills: u.models.reduce((t, m) => t + m.kills, 0),
      })),
    };
  }
