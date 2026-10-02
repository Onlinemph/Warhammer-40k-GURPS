// The simulator view in site/index.html. Uses DATA, $, esc and showLib from the page.
  SIM.index(DATA);
  const LO = DATA.loadouts || {};
  const flatEq = e => [e, ...(e.children || []).flatMap(flatEq)];
  const EQS = DATA.libraries.filter(l => l.kind === "equipment").flatMap(l => l.items.flatMap(flatEq).map(e => ({ e, lib: l })));
  const isFollow = w => /follow-?up/i.test(w.usage || "");
  const shieldOpts = Object.keys(DATA.simWeapons || {}).filter(n => DATA.simWeapons[n]._item && DATA.simWeapons[n]._item.db).sort();
  const armourOpts = [...new Set(EQS.filter(x => x.e.feat && x.e.feat.dr && x.e.feat.dr.some(r => !r.vs)).map(x => x.e.name))].sort();
  const lineOpts = melee => {
    const out = [], seen = new Set();
    for (const { e } of EQS) for (const w of e.weapons || []) {
      if (!!w.melee !== melee || isFollow(w)) continue;
      const k = e.name + "\u0000" + w.usage;
      if (seen.has(k)) continue; seen.add(k);
      out.push({ item: e.name, mode: w.usage, label: `${e.name} — ${w.usage} (${w.damage})` });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  };
  const RANGED = lineOpts(false), MELEE = lineOpts(true);
  const TEMPL = DATA.libraries.filter(l => l.kind === "template" && !l.template.addon);

  const KEY = "sim-state-v1";
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (_) { S = null; }
  if (!S || !S.sides) S = { distance: 100, runs: 200, maxTurns: 1200, morale: true, sides: [[], []] };
  if (S.maxTurns === 60 || S.maxTurns === 300) S.maxTurns = 1200;   // old defaults
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

  function newUnit(template, count) {
    const lo = LO[template] || {};
    return { template, count: count || 5, stance: lo.stance || "advance", armour: [...(lo.armour || [])],
      ranged: lo.ranged ? { ...lo.ranged } : null, melee: lo.melee ? { ...lo.melee } : null,
      ranged2: lo.ranged2 ? { ...lo.ranged2 } : null, shield: lo.shield ? { ...lo.shield } : null, carried: lo.carried || null, grenades: (lo.grenades || []).map(g => ({ ...g })), body: lo.body, mags: lo.mags, knife: lo.knife ? { ...lo.knife } : null, skills: lo.skills ? { ...lo.skills } : undefined };
  }
  const MAPPED = () => S.battlefield === "facility" || S.battlefield === "ruins";
  const PRESETS = [
    ["20 Guardsmen vs 5 Space Marines", [["Astra Militarum Guardsman", 20]], [["Astartes Battle-Brother", 5]], 150],
    ["10 Ork Boyz charge 5 Marines", [["Ork Boy", 10]], [["Astartes Battle-Brother", 5]], 40],
    ["Custodian vs 3 Marines", [["Custodian Guardian", 1]], [["Astartes Battle-Brother", 3]], 20],
    ["Fire Warriors vs Necron Warriors", [["Fire Warrior (Shas'la)", 10]], [["Necron Warrior", 10]], 100],
    ["Wyches vs Guardsmen", [["Wych", 10]], [["Astra Militarum Guardsman", 10]], 30],
    ["Genestealers vs Marines", [["Genestealer", 5]], [["Astartes Battle-Brother", 5]], 40],
    ["Facility: 5 Marines vs 10 Genestealers", [["Astartes Battle-Brother", 5]], [["Genestealer", 10]], 60, "facility"],
    ["Facility: 20 Guardsmen vs 20 Ork Boyz", [["Astra Militarum Guardsman", 20]], [["Ork Boy", 20]], 60, "facility"],
    ["Ruins: 10 Genestealers vs a Tactical squad", [["Genestealer", 10]], [["squad:Astartes Tactical Squad"]], 60, "ruins"],
    ["Ruins: 2 Guard squads vs Ork Boyz", [["squad:Astra Militarum Infantry Squad"], ["squad:Astra Militarum Infantry Squad"]], [["squad:Ork Boyz Mob"]], 60, "ruins"],
    ["Lascannon teams vs a Carnifex", [["squad:Heavy Weapons Squad (Lascannons)"]], [["Carnifex", 1]], 150],
    ["Mortars and a Guard squad vs 30 Hormagaunts", [["squad:Heavy Weapons Squad (Mortars)"], ["squad:Astra Militarum Infantry Squad"]], [["Hormagaunt", 30]], 150],
    ["Meltaguns and a Guard squad vs a Carnifex", [["squad:Special Weapons Squad (Meltaguns)"], ["squad:Astra Militarum Infantry Squad"]], [["Carnifex", 1]], 60],
    ["Squads: Commissar's squad vs Ork Boyz", [["squad:Astra Militarum Infantry Squad with Commissar"]], [["squad:Ork Boyz Mob"]], 80],
    ["Squads: Tactical vs Chaos", [["squad:Astartes Tactical Squad"]], [["squad:Chaos Space Marine Squad"]], 40],
    ["Squads: 3 Guard squads vs a Tactical squad", [["squad:Astra Militarum Infantry Squad"], ["squad:Astra Militarum Infantry Squad"], ["squad:Astra Militarum Infantry Squad"]], [["squad:Astartes Tactical Squad"]], 100],
    ["Vehicles: Leman Russ vs a Tactical squad", [["veh:Leman Russ Battle Tank", 1]], [["squad:Astartes Tactical Squad"]], 150],
    ["Vehicles: Lascannon teams vs a Leman Russ", [["squad:Heavy Weapons Squad (Lascannons)"]], [["veh:Leman Russ Battle Tank", 1]], 150],
    ["Vehicles: Predator vs Leman Russ", [["veh:Predator Destructor", 1]], [["veh:Leman Russ Battle Tank", 1]], 300],
    ["Vehicles: Chimera and a Guard squad vs Ork Boyz", [["veh:Chimera", 1], ["squad:Astra Militarum Infantry Squad"]], [["squad:Ork Boyz Mob"]], 100],
    ["Transports: Rhino-borne Tactical squad (lascannon, meltagun) vs a Leman Russ", [["veh:Rhino", 1, { carries: "next" }], ["squad:Astartes Tactical Squad (Meltagun, Lascannon)"]], [["veh:Leman Russ Battle Tank", 1]], 200],
    ["Transports: Boyz in a Trukk vs a Guard squad", [["veh:Trukk", 1, { carries: "next" }], ["squad:Ork Boyz Mob"]], [["squad:Astra Militarum Infantry Squad"]], 150],
    ["Transports: Chimera-borne Guard vs Ork Boyz", [["veh:Chimera", 1, { carries: "next" }], ["squad:Astra Militarum Infantry Squad"]], [["squad:Ork Boyz Mob"]], 150],
    ["Vehicles: Carnifex vs a Leman Russ", [["Carnifex", 1]], [["veh:Leman Russ Battle Tank", 1]], 100],
    ["Ruins: Leman Russ and Guard vs 2 Ork mobs", [["veh:Leman Russ Battle Tank", 1], ["squad:Astra Militarum Infantry Squad"]], [["squad:Ork Boyz Mob"], ["squad:Ork Boyz Mob"]], 60, "ruins"],
  ];

  const trW = template => {
    const T = SIM.templates.get(template);
    return T ? SIM.traitWeapons(T.t.traits).flatMap(t => t.weapons.filter(w => !isFollow(w)).map(w => ({ trait: t.name, mode: w.usage, melee: !!w.melee, label: `${t.name} — ${w.usage} (${w.damage})` }))) : [];
  };
  const selKey = s => !s ? "" : s.trait ? "t:" + s.trait + "\u0000" + (s.mode || "") : "i:" + s.item + "\u0000" + (s.mode || "");
  function weaponSelect(u, which) {
    const melee = which === "melee";
    const nat = trW(u.template).filter(w => w.melee === melee);
    const cur = selKey(u[which]);
    const opts = [`<option value="">${melee ? "Unarmed (punch)" : "None"}</option>`];
    if (nat.length) opts.push(`<optgroup label="Natural weapons">${nat.map(w => { const k = selKey(w); return `<option value="${esc(k)}"${k === cur ? " selected" : ""}>${esc(w.label)}</option>`; }).join("")}</optgroup>`);
    opts.push(`<optgroup label="Equipment">${(melee ? MELEE : RANGED).map(w => { const k = selKey(w); return `<option value="${esc(k)}"${k === cur ? " selected" : ""}>${esc(w.label)}</option>`; }).join("")}</optgroup>`);
    return `<select data-w="${which}">${opts.join("")}</select>`;
  }
  function armourSelect(u, i) {
    const cur = u.armour[i] || "";
    return `<select data-a="${i}"><option value="">${i ? "No second item" : "No armour"}</option>${armourOpts.map(n => `<option${n === cur ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
  }
  function vehProfile(u) {
    try {
      const d = SIM.describe(SIM.buildVehicle({ ...u, count: 1 }, 0)), v = d.vehicle, dr = v.dr;
      return `<div class="prof"><span><b>HP</b>${d.hp} · HT ${d.ht}</span><span><b>DR</b>${dr.front} front · ${dr.side} side · ${dr.rear} rear${v.turret ? ` · turret ${v.turret.front}` : ""}</span>
        <span><b>Dodge</b>${d.dodge}</span><span><b>Move</b>${v.accel}/${v.top}</span><span><b>SM</b>+${v.sm}</span><span><b>Hnd/SR</b>${v.hnd >= 0 ? "+" : ""}${v.hnd}/${v.sr}</span></div>
        <div class="prof">${v.stations.map(s => `<span><b>${esc(s.role)}</b>${s.weapon ? `${esc(s.weapon)}, skill ${s.skill}, ${esc(s.arc)}` : s.role === "Driver" ? `control ${v.ctl}` : "crew"}</span>`).join("")}</div>`;
    } catch (e) { return `<div class="prof err">${esc(e.message)}</div>`; }
  }
  function profile(u) {
    if (u.vehicle) return vehProfile(u);
    try {
      const d = SIM.describe(SIM.buildUnit({ ...u, count: 1 }, 0));
      const r = d.ranged, m = d.melee;
      return `<div class="prof"><span><b>HP</b>${d.hp}${d.dmgRed ? ` · injury ÷${d.dmgRed}` : ""}</span><span><b>DR</b>${d.drTorso} torso · ${d.drEye} eye${d.wp ? ` · WP ${d.wp}` : ""}</span>
        <span><b>Dodge</b>${d.dodge}</span>${d.parry != null ? `<span><b>Parry</b>${d.parry}</span>` : ""}<span><b>Move</b>${d.move}</span>
        ${d.carried ? `<span><b>${esc(d.carried.name)}</b>DB ${d.carried.db}${d.carried.dr != null ? ` · DR ${d.carried.dr} · ${d.carried.hp} HP` : ""}</span>` : ""}
        ${d.shield ? `<span><b>Field</b>${d.shield.sp} SP${d.shield.recharge ? "" : ", no recharge"}</span>` : ""}</div>
        <div class="prof">${r ? `<span><b>Ranged</b>${esc(r.name)}: ${esc(r.dmg)}${r.follow ? " + " + esc(r.follow) : ""}, skill ${r.skill}, Acc ${r.acc}, RoF ${r.rof}, ${r.range.half}/${r.range.max} yd</span>` : ""}
        <span><b>Melee</b>${esc(m.name)}: ${esc(m.dmg)}, skill ${m.skill}</span></div>`;
    } catch (e) { return `<div class="prof err">${esc(e.message)}</div>`; }
  }
  const ptsOf = name => { const l = TEMPL.find(x => x.title === name); return l ? l.template.points : 0; };
  // one pip per model (up to 30), so a mob looks like a mob
  const pips = n => `<span class="pips" aria-hidden="true">${"<i></i>".repeat(Math.min(n, 30))}${n > 30 ? `<em>+${n - 30}</em>` : ""}</span>`;
  function unitCard(u, si, ui) {
    if (u.vehicle) {
      const V = SIM.vehicles.get(u.vehicle), room = V ? Number((/\+(\d+)/.exec(String(V.vehicle.occ || "")) || [0, 0])[1]) : 0;
      const sqs = [...new Map(S.sides[si].filter(x => x.squad && !x.vehicle).map(x => [x.squad, x.squadName || x.squad])).entries()];
      return `<div class="sunit" data-s="${si}" data-u="${ui}">
      <div class="shead"><input type="number" min="1" max="20" value="${u.count}" data-f="count" aria-label="Vehicles"><b>${esc(u.vehicle)}<small>vehicle${room ? ` · seats ${room}` : ""}</small></b>
        <button class="x" data-del aria-label="Remove vehicle">×</button></div>
      ${vehProfile(u)}
      ${room ? `<label class="carry">Carries <select data-carry><option value="">Nobody</option><option value="next"${u.carries === "next" ? " selected" : ""}>The next squad listed</option>${sqs.map(([t, n]) => `<option value="${esc(t)}"${u.carries === t ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>` : ""}</div>`;
    }
    const p = ptsOf(u.template);
    return `<div class="sunit" data-s="${si}" data-u="${ui}">
      <div class="shead"><input type="number" min="1" max="200" value="${u.count}" data-f="count" aria-label="Models"><b>${esc(u.role || u.template)}${u.role || p ? `<small>${u.role ? esc(u.template) + (p ? " · " : "") : ""}${p ? `${p.toLocaleString("en-US")} pts each` : ""}</small>` : ""}</b>
        <select data-f="stance" aria-label="Stance">${["shoot", "advance", "charge"].map(s => `<option${s === u.stance ? " selected" : ""}>${s}</option>`).join("")}</select>
        <button class="x" data-del aria-label="Remove unit">×</button></div>
      ${pips(u.count)}
      ${profile(u)}
      <details class="lo"><summary>Loadout</summary><div class="lgrid">
        <label>Armour ${armourSelect(u, 0)}</label><label>Armour 2 ${armourSelect(u, 1)}</label>
        <label>Ranged ${weaponSelect(u, "ranged")}</label><label>Melee ${weaponSelect(u, "melee")}</label>
        <label class="chk"><input type="checkbox" data-amb${u.ambush ? " checked" : ""}> Lies in ambush (facility)</label>
        <label>Carried shield <select data-cs><option value="">None</option>${shieldOpts.map(n => `<option${n === u.carried ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
        <label class="sh">Energy field <input type="checkbox" data-sh${u.shield ? " checked" : ""}>
          ${u.shield ? `SP <input type="number" data-shf="sp" value="${u.shield.sp}"> delay <input type="number" data-shf="delay" value="${u.shield.delay}"> recharge/s <input type="number" data-shf="recharge" value="${u.shield.recharge}">` : ""}</label>
      </div>${LO[u.template] && LO[u.template].note ? `<p class="lonote">${esc(LO[u.template].note)}</p>` : ""}</details></div>`;
  }
  // a squad's members stay separate cards (each with its own loadout) under one heading for the squad
  function squadHead(u, si) {
    const ms = S.sides[si].filter(x => x.squad === u.squad), n = ms.reduce((a, x) => a + x.count, 0), pts = ms.reduce((a, x) => a + x.count * ptsOf(x.template), 0);
    return `<div class="squad-h"><b>${esc(u.squadName || u.squad)}</b><small>${n} models${pts ? ` · ${pts.toLocaleString("en-US")} pts` : ""}</small><button class="x" data-delsq="${si}" data-sq="${esc(u.squad)}" aria-label="Remove squad">×</button></div>`;
  }
  // squads added from the picker get a tag unique on the page; n numbers a second squad of the same kind
  function addSquad(si, name) {
    const SQ = SIM.squads[name], short = (SQ && SQ.short) || name;
    const n = new Set(S.sides.flat().filter(x => x.squad && x.squadName && x.squadName.startsWith(short)).map(x => x.squad)).size + 1;
    return SIM.squadSpecs(name, `${name}#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, n).map(sp => ({ ...newUnit(sp.template, sp.count), ...sp, armour: sp.armour || [] }));
  }
  const newVehicle = (name, n) => ({ vehicle: name, template: name, count: n || 1, stance: "shoot", armour: [] });
  const addOf = (si, v, n) => v.startsWith("squad:") ? addSquad(si, v.slice(6)) : v.startsWith("veh:") ? [newVehicle(v.slice(4), n)] : [newUnit(v, n)];
  const expand = (list, si) => list.flatMap(([t, n, extra]) => addOf(si, t, n).map(u => Object.assign(u, extra || {})));
  function tmplOptions() {
    const groups = {};
    for (const l of TEMPL) (groups[l.section.replace(/\/Templates$/, "").replace(/\//g, " › ")] ||= []).push(l.title);
    const sq = Object.keys(SIM.squads || {}), vs = [...(SIM.vehicles || new Map()).keys()];
    return `<option value="">Add a unit…</option>` + (sq.length ? `<optgroup label="Squads (lore organisation)">${sq.map(n => `<option value="squad:${esc(n)}">${esc(n)}</option>`).join("")}</optgroup>` : "")
      + (vs.length ? `<optgroup label="Vehicles">${vs.map(n => `<option value="veh:${esc(n)}">${esc(n)}</option>`).join("")}</optgroup>` : "") + Object.entries(groups).map(([g, ts]) => `<optgroup label="${esc(g)}">${ts.map(t => `<option>${esc(t)}</option>`).join("")}</optgroup>`).join("");
  }

  let last = null;
  function render() {
    const sidePts = si => S.sides[si].reduce((a, u) => a + u.count * ptsOf(u.template), 0);
    const side = si => `<section class="sside"><h2>Side ${"AB"[si]}${sidePts(si) ? `<small>${sidePts(si).toLocaleString("en-US")} pts</small>` : ""}</h2>${S.sides[si].map((u, ui) => (u.squad && (ui === 0 || S.sides[si][ui - 1].squad !== u.squad) ? squadHead(u, si) : "") + unitCard(u, si, ui)).join("") || `<p class="empty">No units yet.</p>`}
      <select class="addu" data-add="${si}" aria-label="Add a unit to side ${"AB"[si]}">${tmplOptions()}</select></section>`;
    $("#main").innerHTML = `<header class="libhead"><div class="eyebrow">Tools</div><h1>Combat Simulator</h1>
      <p>Pit units against each other using their templates and default loadouts. Every run plays a full GURPS fight second by second; the result is the spread over many runs.</p></header>
      <div class="spresets">${PRESETS.map((p, i) => `<button class="chip tag" data-preset="${i}">${esc(p[0])}</button>`).join("")}</div>
      <form class="sset" onsubmit="return false">
        <fieldset><legend>Engagement</legend>
          <label for="s-dist">Starting distance <span><input id="s-dist" type="number" min="1" max="3000" value="${S.distance}" data-g="distance"> yd</span></label>
          <label for="s-runs">Battles to fight <input id="s-runs" type="number" min="1" max="2000" value="${S.runs}" data-g="runs"></label>
          <label for="s-turns">Time limit <span><input id="s-turns" type="number" min="5" max="3600" value="${S.maxTurns}" data-g="maxTurns"> s</span></label>
          <label class="chk" for="s-morale"><input id="s-morale" type="checkbox" data-g="morale"${S.morale ? " checked" : ""}> Morale (Fright Checks)</label>
        </fieldset>
        <fieldset><legend>Rules</legend>
          <label for="s-loc">Hit locations <select id="s-loc" data-o="locations"><option value="elite"${!S.locations || S.locations === "elite" ? " selected" : ""}>Elites aim</option><option value="aimed"${S.locations === "aimed" ? " selected" : ""}>Everyone aims (RAW)</option><option value="random"${S.locations === "random" ? " selected" : ""}>Random</option></select></label>
          <label for="s-hp">Wounds <select id="s-hp" data-h><option value="standard"${S.health !== "fractional" ? " selected" : ""}>Standard HP</option><option value="fractional"${S.health === "fractional" ? " selected" : ""}>Fractional Health</option></select></label>
          <label class="chk" for="s-sight"><input id="s-sight" type="checkbox" data-g="sightedShots"${S.sightedShots ? " checked" : ""}> Aimed shots are All-Out Attacks (Tactical Shooting)</label>
          <label class="chk" for="s-ldodge"><input id="s-ldodge" type="checkbox" data-g="limitedDodges"${S.limitedDodges !== false ? " checked" : ""}> -1 per extra dodge in a turn (Martial Arts; on by default)</label>
          <label class="chk" for="s-cine"><input id="s-cine" type="checkbox" data-g="cinematicEffort"${S.cinematicEffort ? " checked" : ""}> Cinematic extra effort: Heroic Charge (Martial Arts)</label>
          <label class="chk" for="s-tdodge"><input id="s-tdodge" type="checkbox" data-g="tacticalDodge"${S.tacticalDodge ? " checked" : ""}> Dodge gunfire from one shooter only (Tactical Shooting)</label>
          ${S.health === "fractional" ? `<label for="s-box">Boxes per level <input id="s-box" type="number" min="1" max="9" value="${S.boxes || 5}" data-g="boxes"></label>` : ""}
        </fieldset>
        <fieldset><legend>Battlefield</legend>
          <label for="s-bf">Ground <select id="s-bf" data-o="battlefield"><option value="open"${!S.battlefield || S.battlefield === "open" ? " selected" : ""}>Open ground</option><option value="facility"${S.battlefield === "facility" ? " selected" : ""}>Facility</option><option value="ruins"${S.battlefield === "ruins" ? " selected" : ""}>Ruins</option></select></label>
          ${MAPPED() ? `<label for="s-aw">Knowledge <select id="s-aw" data-o="awareness"><option value="limited"${S.awareness !== "omniscient" ? " selected" : ""}>Only what they've seen</option><option value="omniscient"${S.awareness === "omniscient" ? " selected" : ""}>Everyone sees everything</option></select></label>
          <label for="s-lt">Lighting <select id="s-lt" data-o="lighting"><option value="mixed"${!S.lighting || S.lighting === "mixed" ? " selected" : ""}>Mixed (dim and dark rooms)</option><option value="lit"${S.lighting === "lit" ? " selected" : ""}>All lit</option><option value="dark"${S.lighting === "dark" ? " selected" : ""}>Dark (−7)</option></select></label>` : ""}
          ${!MAPPED() ? `<label for="s-rg">Ridge <select id="s-rg" data-o="ridge"><option value=""${!S.ridge ? " selected" : ""}>none (flat)</option><option value="0"${S.ridge === "0" ? " selected" : ""}>held by side A</option><option value="1"${S.ridge === "1" ? " selected" : ""}>held by side B</option></select></label>
          ${S.ridge ? `<label for="s-rh">Ridge height <span><input id="s-rh" type="number" min="1" max="30" value="${S.ridgeH || 8}" data-g="ridgeH"> yd</span></label>` : ""}` : ""}
          ${MAPPED() ? `<label for="s-map">Layout number <input id="s-map" type="number" min="1" max="9999" value="${S.mapSeed || 1}" data-g="mapSeed"></label>` : ""}
          <label for="s-ca">Cover, side A <select id="s-ca" data-o="coverA"><option${(S.coverA || "none") === "none" ? " selected" : ""}>none</option><option${S.coverA === "light" ? " selected" : ""}>light</option><option${S.coverA === "heavy" ? " selected" : ""}>heavy</option></select></label>
          <label for="s-cb">Cover, side B <select id="s-cb" data-o="coverB"><option${(S.coverB || "none") === "none" ? " selected" : ""}>none</option><option${S.coverB === "light" ? " selected" : ""}>light</option><option${S.coverB === "heavy" ? " selected" : ""}>heavy</option></select></label>
        </fieldset>
        <div class="go"><button class="run" id="simrun" type="button">Run simulation</button><p>${S.battlefield === "facility" ? "Each side deploys in its staging bay; starting distance is ignored." : S.battlefield === "ruins" ? "Each side deploys at its end of the ruined block; starting distance is ignored." : "Sides deploy in lines facing each other at the starting distance."}</p></div>
      </form>
      <div class="sgrid">${side(0)}${side(1)}</div>
      <div id="simout">${last ? results(last) : ""}</div>
      <details class="more"><summary>How the simulator works</summary><p>${esc(HOW)}</p></details>`;
    wire();
    if (last) setupReplay();
  }
  const HOW = `Every run plays a full GURPS 4e fight on a hex map, one yard per hex, second by second. Models act in Basic Speed order and an AI picks each one's maneuver: Aim, Attack, Move and Attack, All-Out Attack (Determined or Double) when nothing can hurt it, All-Out Defense when it can't hurt its foe, Feint and Deceptive Attack against strong defences, Rapid Strike, Ready to reload or clear a jam, Change Posture, and Concentrate for psychic powers. Facing matters: attacks from a flank cost the defender 2, from behind it gets no defence, so surrounding a foe pays. Elite attackers (best combat skill 17+, IQ 8+) aim at the location that does most harm (vitals, skull, eye lens at −10, neck, limbs, or a chink in the armour at −8 or −10 that halves its DR); everyone else hits random locations, with 1 in 6 face hits striking an eye lens. The setting can let everyone aim, as RAW allows, or no one. Ranged fire uses range penalties, per-round rolls with climbing Recoil for automatic fire, and can malfunction or overheat; explosions splash neighbours, fragments fly, flamers hit the whole cone. Defenders Dodge, Parry or Block with retreat and shield DB, and shooters Dodge and Drop. Cover hides legs and groin and costs attackers 2; prone models are harder to shoot but fight badly. Armour divisors, Weak Points, regenerating shields, wounding, Injury Tolerance, Damage Reduction, follow-ups, crippling, knockback, bleeding, shock, stun, consciousness and death rolls, Reanimation Protocols, morale and Perils of the Warp all apply, with either standard HP or the Revised Fractional Health wound system. The full rule list with page references is docs/simulator.md. A charging mob that can barely hurt its foe grabs it, drags it down and pins it (B370), then the rest lay in with All-Out Attack (Strong) and Mighty Blows (1 FP). Not modelled: vehicles and stealth.`;

  function results(r) {
    const pct = x => Math.round(100 * x / r.runs);
    const sideUnits = si => r.units.filter(u => u.side === si);
    const roster = si => sideUnits(si).map(u => `<span>${u.count} × ${esc(u.name)}</span>`).join("");
    const wA = pct(r.wins[0]), wB = pct(r.wins[1]), wD = 100 - wA - wB;
    const lead = wA > wB + 10 ? 0 : wB > wA + 10 ? 1 : -1;
    const verdict = lead < 0 ? "Too close to call" : `Side ${"AB"[lead]} is favoured`;
    return `<section class="verdict" aria-label="Result over ${r.runs} battles">
        <div class="vside a${lead === 0 ? " lead" : ""}"><span class="vlab">Side A wins</span><b>${wA}<small>%</small></b><div class="vros">${roster(0)}</div></div>
        <div class="vmid"><span class="vsays">${verdict}</span><span class="vvs">vs</span><span class="vmeta">${r.runs} battles · average ${r.turns.toFixed(1)} s${r.timeouts ? ` · ${pct(r.timeouts)}% ran out of time` : ""}${r.mutual ? ` · ${pct(r.mutual)}% mutual ruin` : ""}</span></div>
        <div class="vside b${lead === 1 ? " lead" : ""}"><span class="vlab">Side B wins</span><b>${wB}<small>%</small></b><div class="vros">${roster(1)}</div></div>
      </section>
      <div class="vbar" role="img" aria-label="Side A ${wA}%, neither ${wD}%, side B ${wB}%"><span class="a" style="flex:${wA}"></span><span class="d" style="flex:${wD}"></span><span class="b" style="flex:${wB}"></span></div>
      <div class="rgrid">
        <figure class="rcard"><figcaption>How long the battles lasted</figcaption>${histogram(r)}</figure>
        <figure class="rcard"><figcaption>What was left of each unit (average)</figcaption>${casualties(r)}</figure>
      </div>
      <h2>One battle on the table</h2>
      <div class="vtt" id="vtt">
        <div class="vtt-main">
          <canvas class="vtt-c" id="vtt-c" aria-label="Battle map. Drag to pan, scroll or pinch to zoom, click a token to see its sheet."></canvas>
          <div class="vtt-3d" id="vtt-3d" hidden aria-label="Battle in 3D. Drag to orbit, right-drag or Shift-drag to pan, scroll or pinch to zoom, click a figure to see its sheet."></div>
          <div class="vtt-hud"><span class="hud-a" id="hudA"></span><span class="clock" id="rlab"></span><span class="hud-b" id="hudB"></span></div>
          <div class="vtt-tools" role="toolbar" aria-label="Map tools">
            <button type="button" data-tool="3d" aria-pressed="false" title="Show the battle in 3D (loads three.js)">3D</button>
            <button type="button" data-tool="walls" aria-pressed="false" title="Lower the walls to see into the rooms" hidden>Low walls</button>
            <button type="button" data-tool="cine" aria-pressed="false" title="Action camera: everyone moves, then the camera cuts to each attack in turn" hidden>Action cam</button>
            <button type="button" data-tool="follow" aria-pressed="false" title="Keep the camera on the selected model" hidden>Follow</button>
            <button type="button" data-tool="fit" title="Fit the battle to the view">Fit</button>
            <button type="button" data-tool="grid" aria-pressed="true" title="Show the hex grid">Grid</button>
            <button type="button" data-tool="trails" aria-pressed="true" title="Show each model's path this second">Paths</button>
            <button type="button" data-tool="measure" aria-pressed="false" title="Drag between two hexes to measure range">Measure</button>
          </div>
          <div class="vtt-tip" id="vtt-tip" hidden></div>
        </div>
        <aside class="vtt-side">
          <div class="vtt-tabs" role="tablist"><button type="button" role="tab" data-tab="init" aria-selected="true">Initiative</button><button type="button" role="tab" data-tab="chat" aria-selected="false">Log</button><button type="button" role="tab" data-tab="sheet" aria-selected="false">Sheet</button></div>
          <div class="vtt-pane" id="vtt-init"></div>
          <div class="vtt-pane" id="vtt-chat" hidden></div>
          <div class="vtt-pane" id="vtt-sheet" hidden><p class="vtt-empty">Click a token on the map, or a name in the initiative list.</p></div>
        </aside>
        <div class="vtt-time">
          <button type="button" id="rback" title="Back one second" aria-label="Back one second">◂◂</button>
          <button type="button" id="rplay" class="primary" aria-label="Play">Play</button>
          <button type="button" id="rstep" title="Forward one second" aria-label="Forward one second">▸▸</button>
          <div class="vtt-track"><div class="vtt-ticks" id="vtt-ticks"></div><input id="rturn" type="range" min="0" max="${Math.max(0, r.sample.frames.length - 1)}" value="0" aria-label="Second"></div>
          <label for="rspeed">Speed <select id="rspeed"><option value="1400">½×</option><option value="800" selected>1×</option><option value="420">2×</option><option value="200">4×</option></select></label>
        </div>
      </div>
      <p class="rleg">Drag to pan, scroll or pinch to zoom, click a token for its sheet. Space plays and pauses; the arrow keys step. Tokens: rim colour is the side, bar is health (blue above it is a shield). Badges: <b>S</b> stunned, <b>P</b> prone, <b>K</b> kneeling, <b>G</b> held, <b>H</b> holding, <b>D</b> All-Out Defense, <b>A</b> All-Out Attack, <b>W</b> waiting; a dotted line shows what a model is aiming at. Floating numbers are injury; grey is a hit armour stopped.</p>
      <details class="more"><summary>Blow-by-blow of the whole battle</summary><pre class="slog">${esc(r.sample.log.join("\n"))}</pre></details>`;
  }
  // battle lengths, stacked by who won
  function histogram(r) {
    const runs = r.runsList || [];
    if (!runs.length) return "";
    const lens = runs.map(x => x[0]).sort((a, b) => a - b);
    const hi = Math.max(2, lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.97))]);
    const nb = Math.min(24, Math.max(6, hi));
    const bw = hi / nb;
    const bins = Array.from({ length: nb }, () => [0, 0, 0]);
    for (const [t, w] of runs) bins[Math.min(nb - 1, Math.floor(Math.min(t, hi) / bw * 0.99999))][w === 0 ? 0 : w === 1 ? 1 : 2]++;
    const top = Math.max(1, ...bins.map(b => b[0] + b[1] + b[2]));
    const W = 320, H = 150, L = 28, B = 22, T = 8, cw = (W - L - 6) / nb;
    const y = v => T + (H - T - B) * (1 - v / top);
    let bars = "";
    bins.forEach((b, k) => {
      let acc = 0;
      [[0, "a"], [2, "d"], [1, "b"]].forEach(([i, c]) => { if (!b[i]) return; const y0 = y(acc), y1 = y(acc + b[i]); bars += `<rect class="${c}" x="${(L + k * cw + 1).toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(1, cw - 2).toFixed(1)}" height="${(y0 - y1).toFixed(1)}"/>`; acc += b[i]; });
    });
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => { const x = L + f * nb * cw; return `<line class="tk" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${H - B}" y2="${H - B + 4}"/><text x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${Math.round(f * hi)}${f === 1 ? "s" : ""}</text>`; }).join("");
    return `<svg class="hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="Battle lengths"><line class="grid" x1="${L}" x2="${W - 6}" y1="${y(top / 2)}" y2="${y(top / 2)}"/><text x="${L - 5}" y="${y(top) + 4}" text-anchor="end">${top}</text><text x="${L - 5}" y="${y(top / 2) + 4}" text-anchor="end">${Math.round(top / 2)}</text>${bars}<line class="axis" x1="${L}" x2="${W - 6}" y1="${H - B}" y2="${H - B}"/>${ticks}</svg>`;
  }
  // per unit: still standing, fled, fallen but alive, killed
  function casualties(r) {
    return `<div class="cas">${r.units.map(u => {
      const dead = u.dead, up = u.standing, down = Math.max(0, u.count - up - dead);
      const seg = (v, c, t) => v > 0.005 ? `<span class="${c}" style="flex:${v.toFixed(3)}" title="${t}: ${v.toFixed(1)}"></span>` : "";
      return `<div class="crow"><div class="cname"><b class="s${u.side ? "b" : "a"}">${"AB"[u.side]}</b>${esc(u.name)}<span>${up.toFixed(1)} of ${u.count} standing</span></div>
        <div class="cbar">${seg(up, "up s" + (u.side ? "b" : "a"), "Standing")}${seg(down, "down", "Down or fled")}${seg(dead, "dead", "Killed")}</div>
        <div class="cfoot"><span>${u.dead.toFixed(1)} killed</span><span>${Math.round(100 * u.wiped / r.runs)}% wiped out</span><span>${Math.round(100 * u.routed / r.runs)}% broke</span><span>${u.dmg.toFixed(0)} HP dealt</span></div></div>`;
    }).join("")}<p class="ckey"><span class="k up"></span>standing <span class="k down"></span>down or fled <span class="k dead"></span>killed</p></div>`;
  }

