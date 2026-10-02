// Part of runBattle, one function body split into files by section (tools/sim/engine/50-69): the locals
// and helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ---- choose and carry out a maneuver
    const gunReady = m => m.inHand === "gun" || m.inHand === "both";
    // a fresh magazine from the belt (the part-used one is put away, its rounds not counted again)
    function refill(m, w) {
      if (m.mags <= 0) return;
      m.mags--; m.ammo = w.shots.mag;
      if (!m.mags) L(`  ${m.id} loads its last magazine`);
    }
    // a foe's hand on the gun (B370: a weapon can be grappled): the muzzle is held aside and the gun can't be fired
    // until its owner wrenches it free (a Quick Contest of ST) or lets it go for another weapon
    function gunGrip(t) {
      const g = t.gunGrip;
      if (!g) return null;
      if (g.state === "ok" && g.h && t.h && t.state === "ok" && g.gunHold === t && hexDist(g.h, t.h) <= 1 && gunReady(t)) return g;
      if (g.gunHold === t) g.gunHold = null;
      t.gunGrip = null; return null;
    }
    const holdingGun = m => m.gunHold && gunGrip(m.gunHold) === m ? m.gunHold : null;
    const longGun = t => t.u.ranged && !t.u.ranged.natural && !t.u.ranged.thrown && (t.u.ranged.bulk || 0) <= -3 && !t.gunBroken;
    const bladeReady = m => (m.inHand === "melee" || m.inHand === "both") && !m.meleeBroken;
    // Ready (B382): swap gun and blade; with Fast-Draw a successful roll makes it free and the model acts at once
    function switchTo(m, hand) {
      m.lastSwitch = turn;
      const w = hand === "melee" ? m.u.melee : m.u.ranged;
      // a model that holds both when it can picks both back up; a long gun it can hold in one hand (B270, 1.5x its ST)
      // stays in the other hand when it draws the blade
      m.knifeOut = false;
      const keep = hand === "melee" && m.u.ranged && m.u.ranged.semiOne && gunReady(m) && !m.gunBroken && !m.armsLost;
      m.inHand = m.u.bothReady || keep ? "both" : hand;
      m.gunOneHand = keep; if (hand === "gun") { m.gunOneHand = false; m.gunSpent = false; }
      const fd = hand === "melee" ? m.u.fdBlade : m.u.fdGun;
      if (fd > -Infinity && !m.fastDrew && check(fd - skillPen(m)).ok) {
        L(`${m.id} fast-draws the ${w.name}${keep ? `, keeping the ${m.u.ranged.name.split(",")[0]} in its other hand` : ""}`);
        m.fastDrew = true; act(m); m.fastDrew = false;
        return;
      }
      L(`${m.id} readies the ${w.name}${keep ? `, keeping the ${m.u.ranged.name.split(",")[0]} in its other hand` : ""}`);
    }
    // the combat knife (B194 Fast-Draw (Knife)): free on a roll, and the model strikes at once; otherwise a Ready
    function drawKnife(m, t) {
      m.knifeOut = true; m.lastSwitch = turn;
      if (m.u.fdKnife > -Infinity && !m.fastDrew && check(m.u.fdKnife - skillPen(m)).ok) {
        L(`${m.id} fast-draws its ${m.u.knife.name.split(",")[0]}`);
        if (t && t.state === "ok" && t.h && m.h && hexDist(m.h, t.h) <= 1) { faceTo(m, t.h); strike(m, m.u.knife, t, {}); }
        return;
      }
      L(`${m.id} draws its ${m.u.knife.name.split(",")[0]}`);
    }
    // ---- heavy weapon teams: a gunner and a loader (squad `team`, `crew`)
    const teamMates = m => m.u.team ? models.filter(x => x !== m && x.u.side === m.u.side && x.u.squad === m.u.squad && x.u.team === m.u.team) : [];
    const crewNear = m => m.h && teamMates(m).some(x => x.state === "ok" && x.h && !x.stunned && hexDist(x.h, m.h) <= 1);
    // a loader beside the gun feeds it: reloading takes half the time (house rule, after the crews of TS and B)
    const reloadTime = (m, w) => Math.max(1, m.u.crew === "gunner" && crewNear(m) ? Math.ceil(w.shots.reload / 2) : w.shots.reload);
    // setting a tripod weapon or mortar up, or packing it to move: 3 seconds with the loader beside it, 6 alone
    // (house rule; the item notes' "about a minute" is an unhurried setup)
    const setupTime = m => crewNear(m) ? 3 : 6;
    function weaponsFor(m, melee) {
      const out = [];
      const oneHand = m.armsLost || holdingGun(m);
      if (melee) { if (m.knifeOut && m.u.knife && m.armsLost < 2) out.push(m.u.knife); else if (m.armsLost < 2 && bladeReady(m) && (!oneHand || m.u.melee.oneHanded !== false)) out.push(m.u.melee); }
      else if (m.u.ranged && !m.gunBroken && !m.jam && m.armsLost < 2 && gunReady(m) && (!oneHand || m.u.ranged.oneHanded) && !gunGrip(m) && !m.gunSpent && (!m.u.ranged.needsSetup || m.setUp)) out.push(m.u.ranged);
      if (!melee && m.u.ranged2 && (m.extraLeft ?? m.u.ranged2.limit) > 0) out.push(m.u.ranged2);
      for (const p of m.u.powers) if (!!p.melee === melee && m.fp - p.fp >= 0) out.push(p);
      return out;
    }
