  // ---------------------------------------------------------------- wounding
  const BASE = { "pi-": 0.5, pi: 1, "pi+": 1.5, "pi++": 2, imp: 2, cut: 1.5, cr: 1, burn: 1, tox: 1, cor: 1 };
  const UNLIVING = { "pi-": 0.2, pi: 1 / 3, "pi+": 0.5, "pi++": 1, imp: 1 };
  const HOMOG = { "pi-": 0.1, pi: 0.2, "pi+": 1 / 3, "pi++": 0.5, imp: 0.5 };
  // natural DR at a location: the skull's +2 only for those with a brain (No Brain treats the skull as the face, B61);
  // the eye half the hide's DR unless a trait gives an eye value (every template note gives exactly half)
  function natDRat(u, loc) {
    const nb = u.flags.nobrain || u.flags.homogenous || u.flags.diffuse;
    // a hide's eye is as tough as its head (user direction), unless the template gives the eye its own DR
    if (loc === "eye") return u.nat.eye != null ? drAt(u.nat, "eye") : drAt(u.nat, "skull");
    return drAt(u.nat, loc === "vitals" ? "torso" : loc) + (loc === "skull" && !nb ? 2 : 0);
  }
  function woundMult(type, loc, flags, ex) {
    const brain = (loc === "skull" || loc === "eye") && !flags.nobrain && !flags.homogenous;
    if (loc === "skull" && brain) return type === "tox" ? 1 : 4;
    if (loc === "eye" && brain) return type === "tox" ? 1 : 4;
    if (loc === "vitals" && (flags.homogenous || flags.novitals || flags.diffuse)) loc = "torso";
    if (loc === "vitals") return type.startsWith("pi") || type === "imp" ? 3 : type === "burn" && !ex ? 2 : BASE[type] ?? 1;
    let m = BASE[type] ?? 1;
    if (loc === "face" && type === "cor") m = 1.5;
    if (loc === "neck") m = type === "cut" ? 2 : (type === "cr" || type === "cor") ? 1.5 : m;
    if (["arm", "leg", "hand", "foot"].includes(loc) && (type === "pi+" || type === "pi++" || type === "imp")) m = 1;
    if (flags.homogenous && HOMOG[type] != null) m = Math.min(m, HOMOG[type]);
    else if (flags.unliving && UNLIVING[type] != null && loc !== "skull" && loc !== "eye") m = Math.min(m, UNLIVING[type]);
    return m;
  }
  // Large-area injury (B400): cones, area effects and external explosions strike the torso with the average of the
  // torso's DR and the least protected location's, rounded up. Returns { arm, nat } like a location's DR
  const AREA_LOCS = ["skull", "face", "neck", "torso", "groin", "arm", "hand", "leg", "foot"];
  function areaDR(u) {
    const tot = l => drAt(u.arm.dr, l) + natDRat(u, l);
    let lo = Infinity;
    for (const l of AREA_LOCS) lo = Math.min(lo, tot(l));
    const all = Math.ceil((tot("torso") + lo) / 2), nat = Math.min(natDRat(u, "torso"), all);
    return { arm: all - nat, nat };
  }
  // Hit Location Table (B552) for a 3d roll r; a face hit is the eye on a 1 in 6 (eye, the die for it)
  function hitLocation() { const r = roll3(); return locFor(r, r === 5 ? d6() : 0); }
  function locFor(r, eye) {
    if (r <= 4) return "skull";
    if (r === 5) return eye === 1 ? "eye" : "face";
    if (r <= 7 || r === 13 || r === 14) return "leg";
    if (r === 8 || r === 12) return "arm";
    if (r <= 10) return "torso";
    if (r === 11) return "groin";
    if (r === 15) return "hand";
    if (r === 16) return "foot";
    return "neck";
  }

