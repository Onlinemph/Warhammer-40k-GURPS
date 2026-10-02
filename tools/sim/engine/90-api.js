
  function monteCarlo(unitSpecs, opt = {}) {
    const runs = opt.runs ?? 200;
    if (opt.seed != null) seed(opt.seed);
    const res = { runs, wins: [0, 0], draws: 0, timeouts: 0, mutual: 0, turns: 0, units: null, sample: null, runsList: [] };
    const terrain = battleMap(opt);
    for (let i = 0; i < runs; i++) {
      const r = runBattle(unitSpecs, { ...opt, terrain, log: i === 0, frames: i === 0 });
      if (i === 0) res.sample = r;
      if (r.winner < 0) { res.draws++; if (r.timeout) res.timeouts++; else res.mutual++; } else res.wins[r.winner]++;
      res.runsList.push([r.turns, r.winner]);
      res.turns += r.turns;
      if (!res.units) res.units = r.units.map(u => ({ name: u.name, side: u.side, count: u.count, standing: 0, dead: 0, wiped: 0, routed: 0, dmg: 0, kills: 0 }));
      r.units.forEach((u, k) => {
        const a = res.units[k];
        a.standing += u.standing; a.dead += u.dead; a.dmg += u.dmg; a.kills += u.kills;
        if (u.standing === 0 && !u.routed) a.wiped++;
        if (u.routed) a.routed++;
      });
    }
    res.turns /= runs;
    res.units.forEach(u => { u.standing /= runs; u.dead /= runs; u.dmg /= runs; u.kills /= runs; });
    return res;
  }

  return { index, buildUnit, buildVehicle, describe, runBattle, monteCarlo, parseDamage, seed, woundMult, fmtDice, px, facilityMap, ruinsMap, battlefields: BATTLEFIELDS, fromOffset, rangePenalty, DIRS, squadSpecs,
    get squads() { return SQUADS; }, get vehicles() { return VEHICLES; },
    get templates() { return TEMPLATES; }, get equipment() { return EQ; }, traitWeapons,
    // the pure rule helpers, for test/rules.test.js
    rules: { P3, judge, critP, rangePenalty, rapidBonus, rclPen, burstHits, locFor, woundMult, drAt, armourProfile, stDamage, parseRange, parseRoF,
      parseShots, hexDist, lineHexes, arcOf, vehicleLocs, rollDamage } };
