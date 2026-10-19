  // ------------------------------------------------------------------ battle
  // A battle is a stepper (a generator): it runs to its end by itself unless a side is played by a person
  // (opt.human), when it stops and yields at each second's start (for orders to whole units) and at the turn of
  // each model under direct control (for a choice among its options). runBattle, below the turn loop, runs it
  // through; playBattle hands the stepper to the page.
  function* battleSteps(unitSpecs, opt = {}) {
    const HUMAN = opt.human ? opt.human.side : null;
    // Who stays on its feet (user direction): the elite (a best combat skill of 17 or more: Space Marines, Custodians,
    // Aspect Warriors, a Genestealer) and any faction whose profile says so (`upright` in data/sim/ai.yaml: Necrons).
    // Standing is nearly always the better place to dodge from, so they don't kneel to fire, go to ground, duck
    // behind a parapet or keep their heads down. They still drop when they need to: a Dodge and Drop from a shot
    // that would cripple or fell them, a dive from a grenade; and then they get straight back up.
    const UP = u => !!(u.ai.upright || u.elite);
    const distance = Math.max(2, Math.round(opt.distance ?? 100)), maxTurns = opt.maxTurns ?? 1200, morale = opt.morale !== false;
    const frac = opt.health === "fractional", boxes = opt.boxes || 5;
    const SIGHTED = !!opt.sightedShots;
    const TDODGE = !!opt.tacticalDodge;
    const LIMDODGE = opt.limitedDodges !== false;   // Limiting Multiple Dodges (MA122), a base rule here (user direction): -1 per dodge after the first each turn
    const CINEMATIC = opt.cinematicEffort !== false;   // (on unless turned off: user direction, to encourage melee)   // Martial Arts option (MA131-132): Heroic Charge and other extra effort   // Tactical Shooting option (p. 17): Dodge firearms only from the one gunman you watch   // Tactical Shooting option: an aimed shot is All-Out Attack (Determined)
    // hit locations: "elite" (default: elites aim, everyone else hits random locations), "aimed" (everyone, RAW), "random"
    const locMode = opt.locations || "elite";
    const aimsShots = m => locMode === "aimed" || (locMode === "elite" && m.u.elite);
    const cover = opt.cover || ["none", "none"];
    const log = opt.log ? [] : null;
    const frames = opt.frames ? [] : null;
    // what happened each second, for the replay: shots, blows, blasts and casualties
    const fx = frames ? [] : null;
    let fxb = [];
    // frames are beats: one a second in a simulated battle; when a person plays, also one each time the battle
    // stops for them, so each stretch of action is shown once. beatTurn is the second each beat belongs to and
    // logAt where the log stood when it was taken
    const beatTurn = frames ? [] : null, logAt = frames ? [] : null;
    const FX = e => { if (fx) fxb.push(e); };
    const L = s => { if (log && log.length < 5000) log.push(s); };
    const units = unitSpecs.map(s => s.spec.vehicle ? buildVehicle(s.spec, s.side) : buildUnit(s.spec, s.side));
    const models = [];
    const occ = new Map();
    const place = (m, h) => { if (!h && m.h && m.cargo && m.cargo.length) dismount(m, true); if (m.h) occ.delete(key(m.h.q, m.h.r)); m.prevH = m.h; m.h = h; if (h) { occ.set(key(h.q, h.r), m); if (frames && m.trail) m.trail.push([h.q, h.r]); } };
    // terrain: walls block movement and sight until breached; crates block movement only; doors block both
    // while closed. The map is shared by every run; what changes in a battle (doors, breaches, wall damage) lives here
    const terr = battleMap(opt);
    // lighting (B394): "mixed" (a facility's default: lit hallways, dim corridors, rooms lit, dim or dark), "lit",
    // or "dark" (-7 everywhere). Open ground is lit
    const LIGHT = terr ? opt.lighting || "mixed" : "lit";
    const nH = terr ? terr.hx.length : 0;
    const pass = terr ? Uint8Array.from(terr.wallI, (w, i) => w || terr.crateI[i] ? 0 : 1) : null;   // walkable (closed doors count: they open)
    const broken = new Uint8Array(nH), closed = new Uint8Array(nH), shp = new Float64Array(nH).fill(-1);
    const tev = [];            // terrain changes for the replay: [second, "q,r", "open" | "closed" | "broken"]
    let turnNow = 0, terrOut = null;
    if (terr) for (let i = 0; i < nH; i++) if (terr.doorI[i] && R() < 0.5) closed[i] = 1;   // half the doors start shut
    const idx = k => terr.ids.get(k);
    const startShut = terr ? new Set([...terr.doors].filter(k => closed[idx(k)])) : null;
    const blocker = i => (terr.wallI[i] && !broken[i]) || closed[i];
    const walkable = k => { const i = idx(k); return i != null && pass[i] && !closed[i]; };
    const wallAt = k => !!terr && !walkable(k);
    const taken = k => occ.has(k) || wallAt(k);
    const NK = (q, r) => (q + 2048) * 4096 + (r + 2048);
