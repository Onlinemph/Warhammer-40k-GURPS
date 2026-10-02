// Part of makeView3D, one function body split into files by section (tools/sim/page/30-37): the locals and
// helpers declared in earlier parts are in scope here. tools/sim/README.md has the layout.
    // ================= shared shapes for the miniatures
    const G = {
      box: keep(new THREE.BoxGeometry(1, 1, 1)), cyl: keep(new THREE.CylinderGeometry(1, 1, 1, big ? 6 : 10)), cylT: keep(new THREE.CylinderGeometry(.7, 1, 1, big ? 6 : 10)),
      sph: keep(new THREE.SphereGeometry(1, big ? 8 : 14, big ? 6 : 10)), cone: keep(new THREE.ConeGeometry(1, 1, big ? 6 : 10)), hemi: keep(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
      tor: keep(new THREE.TorusGeometry(1, .25, 6, 16)), base: keep(new THREE.CylinderGeometry(.47, .5, .09, 28)), baseTop: keep(new THREE.CircleGeometry(.44, 28)),
      ring: keep(new THREE.TorusGeometry(.62, .05, 6, 32)), bar: keep(new THREE.PlaneGeometry(1, 1)), unitCyl: keep(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true)),
    };
    G.unitCyl.translate(0, .5, 0);
    const mesh = (g, m, sx, sy, sz, x = 0, y = 0, z = 0, shadow = true) => { const p = new THREE.Mesh(g, m); p.scale.set(sx, sy, sz); p.position.set(x, y, z); p.castShadow = shadow && !big; return p; };
    const grp = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };

    // faction paint schemes: main, second (trim), skin, metal, eye glow
    const SCHEME = [
      [/Custodes/, [0xc9a347, 0x8a1c1c, 0xd9a982, 0xd4b45a, 0x66ccff]], [/Sororitas/, [0x24242a, 0x8a1a1a, 0xe2c3a8, 0x9a9a9a, 0x000000]],
      [/Mechanicus/, [0x8e2a22, 0x2d2d33, 0xd9a982, 0xb0a070, 0x7dff9a]], [/Khorne/, [0x8a1c1c, 0x2a2a2e, 0xd9a982, 0xa07a3a, 0xff5a3a]],
      [/Rubric|Thousand/, [0x1f6f78, 0xc9a347, 0xd9a982, 0xc9a347, 0x7affff]], [/Heretic|Chaos Space|Traitor Astartes/, [0x24242a, 0x9a7a3a, 0xd9a982, 0x9a7a3a, 0xff3a2a]],
      [/Traitor|Cultist/, [0x5a4632, 0x7a2a22, 0xcf9f7c, 0x77736a, 0xff6a3a]], [/Deathwatch/, [0x1a1a1e, 0xa9a9b0, 0xd9a982, 0xa9a9b0, 0x3aff6a]],
      [/Grey Knight/, [0x9aa0a8, 0x6a2a8a, 0xd9a982, 0xb0b6be, 0x7ab8ff]], [/Astartes/, [0x1f3f8f, 0xc9a24a, 0xd9a982, 0xa9a9b0, 0xff3a2a]],
      [/Guard|Militarum|Tempestus/, [0x6a6a48, 0x3e4a2c, 0xd9a982, 0x77736a, 0x000000]], [/Inquisition|Psyker/, [0x2e2a2e, 0x8a1a1a, 0xd9a982, 0x9a9a9a, 0x66ccff]],
      [/Ork/, [0x5a4632, 0x8a6a22, 0x4f7a2e, 0x77736a, 0xff3a1a]], [/Tyranid/, [0x5a2c6e, 0xb8a684, 0xb8a684, 0x5a2c6e, 0xffb030]],
      [/Necron/, [0x6e7378, 0x23272b, 0x6e7378, 0x8a9096, 0x39ff6a]], [/Drukhari/, [0x2a2236, 0x5a8a7a, 0xe8e0e8, 0x9aa0a6, 0xff3a8a]],
      [/Aeldari/, [0x2c6e6a, 0xe8d8b0, 0xe8d8c8, 0xd8c9a8, 0x7affea]], [/T'au/, [0xc9b98c, 0x3a3d42, 0x6a8aa8, 0x8a8f96, 0x7ad8ff]],
      [/Kroot|Vespid/, [0x7a6a4a, 0x3a5a3a, 0x9a8a5a, 0x77736a, 0xffd03a]],
    ];
    const scheme = r => (SCHEME.find(([re]) => re.test(r.faction || "") || re.test(r.template || "")) || [0, [0x6b6f76, 0x3a3d42, 0xd9a982, 0x8a8f96, 0x000000]])[1];
    // what kind of miniature each model is
    function archOf(r) {
      const f = (r.faction || "") + " " + (r.template || ""), kit = r.kit || "";
      if (r.body === "vehicle" || r.body === "walker") return "vehicle";
      if (/Tyranid/.test(f)) return r.body === "horizontal" ? (/Carnifex/.test(f) ? "carnifex" : "beast") : r.body === "legless" ? "serpent" : /Zoanthrope/.test(f) ? "floater" : "nid";
      if (/Necron/.test(f)) return /Destroyer/.test(f) ? "necronBig" : "necron";
      if (/Ork/.test(f)) return /Meganob|Mega Armour/.test(f + kit) ? "orkMega" : "ork";
      if (/Custodes|Custodian|Shield-Captain/.test(f)) return "custodes";
      if (/Terminator|Cataphractii|Tactical Dreadnought|Mega Armour/.test(kit)) return "terminator";
      if (/Astartes|Heretic|Khorne|Rubric|Chaos Space|Deathwatch|Grey Knight|Power Armour/i.test(f + kit) && !/Sororitas|Sister/.test(f)) return /Scout/.test(f) ? "human" : "marine";
      if (/Sororitas|Battle Sister/.test(f)) return "sister";
      if (/Mechanicus|Skitarii|Servitor|Enginseer|Magos|Electro|Sicarian/.test(f)) return "mech";
      if (/T'au|Fire Warrior/.test(f)) return /Drone/.test(f) ? "drone" : "tau";
      if (/Kroot/.test(f)) return "kroot";
      if (/Aeldari|Drukhari|Eldar/.test(f)) return "eldar";
      if (/Cultist|Traitor/.test(f)) return "cultist";
      if (r.body === "flying") return "flyer";
      return "human";
    }
    // proportions: leg length, torso height, shoulder half-width, hip half-width, head size, bulk, hunch, head style, extras
    const BUILD = {
      human: { leg: .8, torso: .62, sh: .2, hw: .09, head: .13, bulk: 1, hunch: 0, helm: "flak", pack: "roll" },
      cultist: { leg: .8, torso: .6, sh: .19, hw: .09, head: .13, bulk: .95, hunch: .1, helm: "hood", robe: 1 },
      sister: { leg: .8, torso: .64, sh: .23, hw: .1, head: .13, bulk: 1.1, hunch: 0, helm: "bare", robe: .6, pack: "box" },
      marine: { leg: .82, torso: .7, sh: .3, hw: .12, head: .15, bulk: 1.45, hunch: 0, helm: "marine", pauldron: 1, pack: "marine" },
      terminator: { leg: .7, torso: .78, sh: .4, hw: .15, head: .14, bulk: 1.9, hunch: .05, helm: "sunk", pauldron: 1.5, pack: "marine" },
      custodes: { leg: .95, torso: .76, sh: .3, hw: .12, head: .15, bulk: 1.4, hunch: 0, helm: "custodes", pauldron: .9, robe: .5 },
      mech: { leg: .78, torso: .64, sh: .21, hw: .09, head: .13, bulk: 1, hunch: .15, helm: "hood", robe: 1, eyes: 1 },
      ork: { leg: .64, torso: .66, sh: .3, hw: .13, head: .19, bulk: 1.5, hunch: .35, helm: "ork", arms: 1.25 },
      orkMega: { leg: .64, torso: .74, sh: .4, hw: .15, head: .19, bulk: 2, hunch: .3, helm: "ork", pauldron: 1.4, arms: 1.25 },
      necron: { leg: .86, torso: .66, sh: .21, hw: .09, head: .13, bulk: .8, hunch: .05, helm: "skull", skel: 1 },
      necronBig: { leg: .9, torso: .8, sh: .28, hw: .12, head: .14, bulk: 1.1, hunch: .25, helm: "skull", skel: 1 },
      tau: { leg: .82, torso: .62, sh: .22, hw: .1, head: .13, bulk: 1.1, hunch: 0, helm: "tau", pack: "box" },
      kroot: { leg: .9, torso: .66, sh: .2, hw: .09, head: .14, bulk: .9, hunch: .3, helm: "kroot" },
      eldar: { leg: .88, torso: .62, sh: .19, hw: .08, head: .13, bulk: .95, hunch: 0, helm: "eldar" },
      nid: { leg: .82, torso: .66, sh: .24, hw: .1, head: .16, bulk: 1.2, hunch: .45, helm: "nid", extraArms: 1, tail: 1 },
      flyer: { leg: .8, torso: .6, sh: .2, hw: .09, head: .13, bulk: 1, hunch: .1, helm: "bare", wings: 1 },
      floater: { leg: .0, torso: .5, sh: .16, hw: .08, head: .32, bulk: .8, hunch: 0, helm: "brain", float: 1 },
      drone: { drone: 1 },
    };

    // ---- weapons, built along +x from the grip
    function gunMesh(kind, S) {
      const g = grp(), d = M(0x1d1e22, { r: .5, m: .5 }), mtl = METAL(S[3]);
      const add = (...a) => { g.add(mesh(...a)); };
      switch (kind) {
        case "las": add(G.box, M(0x3a3226), .62, .07, .06, .22, 0, 0); add(G.box, M(0x6a4a2a), .22, .09, .06, -.12, -.02, 0); add(G.box, d, .08, .1, .05, .1, -.07, 0); add(G.cyl, d, .025, .2, .025, .6, .02, 0); g.children[3].rotation.z = Math.PI / 2; break;
        case "bolt": add(G.box, d, .5, .13, .09, .16, 0, 0); add(G.box, d, .08, .16, .07, .12, -.12, 0); add(G.box, mtl, .12, .05, .1, .3, .08, 0); add(G.cyl, d, .035, .14, .035, .46, .02, 0); g.children[3].rotation.z = Math.PI / 2; break;
        case "slug": add(G.box, M(0x4a3a2a), .55, .11, .07, .18, 0, 0); add(G.cyl, d, .07, .06, .07, .1, -.09, 0); add(G.cyl, d, .03, .3, .03, .55, .02, 0); g.children[2].rotation.z = Math.PI / 2; break;
        case "plasma": add(G.box, d, .5, .12, .09, .16, 0, 0); for (let i = 0; i < 3; i++) add(G.tor, GLOW(0x5ab8ff), .06, .06, .06, .18 + i * .1, .02, 0); g.children.slice(1).forEach(c => c.rotation.y = Math.PI / 2); add(G.cyl, d, .04, .16, .04, .48, .02, 0); g.children[4].rotation.z = Math.PI / 2; break;
        case "gauss": add(G.box, METAL(0x6a6e72), .62, .06, .06, .2, 0, 0); add(G.cyl, GLOW(0x39ff6a), .028, .52, .028, .24, .07, 0); g.children[1].rotation.z = Math.PI / 2; add(G.box, METAL(0x6a6e72), .1, .14, .05, .48, .05, 0); add(G.box, d, .1, .13, .05, .02, -.06, 0); break;
        case "flame": add(G.box, d, .45, .1, .08, .14, 0, 0); add(G.cyl, M(0x8a2a1a, { m: .4, r: .4 }), .06, .26, .06, .12, -.11, 0); g.children[1].rotation.z = Math.PI / 2; add(G.cone, d, .06, .14, .06, .43, .01, 0); g.children[2].rotation.z = -Math.PI / 2; break;
        case "melta": add(G.box, d, .44, .12, .09, .14, 0, 0); add(G.cyl, METAL(0x9a9a92), .07, .22, .07, .44, .02, 0); g.children[1].rotation.z = Math.PI / 2; add(G.tor, METAL(0x9a9a92), .07, .07, .07, .5, .02, 0); g.children[2].rotation.y = Math.PI / 2; break;
        case "pulse": add(G.box, M(S[1]), .75, .08, .07, .26, 0, 0); add(G.box, M(S[0]), .3, .11, .08, .06, .02, 0); add(G.cyl, GLOW(0x7ad8ff), .02, .04, .02, .64, .02, 0); break;
        case "shuriken": add(G.box, M(S[1]), .48, .08, .06, .16, 0, 0); add(G.cyl, M(S[0]), .09, .03, .09, .12, .07, 0); break;
        case "splinter": add(G.box, M(0x2a2236), .7, .05, .05, .24, 0, 0); add(G.cone, GLOW(0x8aff6a), .025, .14, .025, .62, 0, 0); g.children[1].rotation.z = -Math.PI / 2; break;
        case "dark": add(G.box, M(0x2a2236), .8, .07, .07, .28, 0, 0); add(G.cyl, GLOW(0xb36aff), .02, .5, .02, .3, .06, 0); g.children[1].rotation.z = Math.PI / 2; break;
        case "lascannon": add(G.cyl, d, .06, .9, .06, .3, .04, 0); g.children[0].rotation.z = Math.PI / 2; add(G.box, M(0x5a5a40), .3, .16, .14, -.05, 0, 0); add(G.cyl, GLOW(0xff3020), .03, .03, .03, .76, .04, 0); break;
        case "shell": add(G.cyl, M(0x4a5030, { r: .5 }), .07, .8, .07, .2, .04, 0); g.children[0].rotation.z = Math.PI / 2; add(G.box, d, .14, .14, .1, .05, -.07, 0); break;
        case "bio": add(G.sph, M(S[0]), .14, .1, .1, .18, 0, 0); add(G.sph, M(S[1]), .07, .07, .07, .32, .02, 0); add(G.cyl, GLOW(0xa8ff4a), .03, .06, .03, .38, .02, 0); g.children[2].rotation.z = Math.PI / 2; break;
        default: break;
      }
      return g;
    }
    // melee weapons, blade along -y from the hand (hanging down at rest)
    function bladeMesh(kind, S) {
      const g = grp(), d = M(0x1d1e22, { r: .5, m: .5 });
      const add = (...a) => g.add(mesh(...a));
      switch (kind) {
        case "chain": add(G.box, d, .03, .06, .05, 0, -.03, 0); add(G.box, M(S[1], { m: .5, r: .4 }), .05, .5, .09, 0, -.32, 0); add(G.box, METAL(0x9a9a92), .02, .5, .11, 0, -.32, 0); break;
        case "power": add(G.box, d, .03, .1, .04, 0, -.05, 0); add(G.box, GLOW(0x6ab8ff), .02, .55, .07, 0, -.38, 0); break;
        case "axe": add(G.cyl, M(0x4a3a2a), .022, .55, .022, 0, -.27, 0); add(G.box, METAL(0x8a8a82), .03, .2, .2, 0, -.48, .07); break;
        case "hammer": add(G.cyl, d, .025, .6, .025, 0, -.3, 0); add(G.box, METAL(S[3]), .16, .12, .26, 0, -.6, 0); break;
        case "spear": add(G.cyl, METAL(S[3]), .022, 1.4, .022, 0, -.2, 0); add(G.cone, METAL(0xd8d8d0), .045, .26, .045, 0, -1.0, 0); g.children[1].rotation.z = Math.PI; break;
        case "fist": add(G.box, METAL(S[0]), .16, .16, .16, 0, -.06, 0); add(G.box, GLOW(0x6ab8ff), .17, .03, .17, 0, -.02, 0); break;
        case "claw": for (const s of [-1, 0, 1]) { add(G.cone, M(0xd8c9a8), .025, .26, .025, 0, -.15, s * .04); } break;
        case "blade": add(G.box, METAL(0xb0b0a8), .02, .38, .06, 0, -.24, 0); add(G.box, d, .02, .03, .12, 0, -.04, 0); break;
        default: break;
      }
      return g;
    }

    // ---- a humanoid miniature: hips, two jointed legs, torso, head, two jointed arms, gun and blade
    function humanoid(r, B, S) {
      const fig = grp(), F = { legs: [], arms: [] };
      const main = M(S[0], B.pauldron ? { r: .42, m: .25 } : {}), second = METAL(S[1]), skin = M(S[2], { r: .7 }), dark = M(0x26262a, { r: .55, m: .2 }), eye = GLOW(S[4] || 0xff3a2a);
      const limb = B.skel ? METAL(S[0]) : main, lw = (B.skel ? .035 : .065) * B.bulk, legW = (B.skel ? .04 : .075) * Math.sqrt(B.bulk);
      const hips = grp(0, B.float ? .7 : B.leg, 0); fig.add(hips); F.hips = hips; F.hipY = hips.position.y;
      if (!B.float) for (const s of [1, -1]) {
        const p = grp(0, 0, s * B.hw * (B.bulk > 1.3 ? 1.3 : 1)); hips.add(p);
        p.add(mesh(G.cyl, B.skel ? limb : dark, legW, B.leg * .5, legW, 0, -B.leg * .25, 0));
        const kn = grp(0, -B.leg * .5, 0); p.add(kn);
        kn.add(mesh(G.cyl, B.skel ? limb : dark, legW * .9, B.leg * .5, legW * .9, 0, -B.leg * .25, 0));
        if (B.skel) kn.add(mesh(G.sph, limb, legW * 1.3, legW * 1.3, legW * 1.3, 0, 0, 0));
        kn.add(mesh(G.box, B.pauldron ? main : M(0x1f1f22), .22 * Math.sqrt(B.bulk), .08, .12 * Math.sqrt(B.bulk), .05, -B.leg * .5 + .04, 0));
        if (B.pauldron) p.add(mesh(G.box, main, legW * 2.6, B.leg * .3, legW * 2.4, .02, -B.leg * .2, 0));
        F.legs.push({ p, kn, s });
      }
      if (B.robe) hips.add(mesh(G.cylT, M(B.robe < 1 ? S[1] : S[0], { r: .85 }), .14 * B.bulk + .03, B.leg * B.robe * .95, .18 * B.bulk, 0, -B.leg * B.robe * .45, 0));
      const torso = grp(); hips.add(torso); F.torso = torso; torso.rotation.z = -B.hunch;
      torso.add(mesh(G.box, B.pauldron ? main : dark, .18 * B.bulk, .14, B.hw * 2.4 * B.bulk, 0, .06, 0));   // pelvis / belt
      if (B.skel) {
        torso.add(mesh(G.cyl, limb, .03, B.torso, .03, -.04, B.torso * .5, 0));
        for (let i = 0; i < 3; i++) torso.add(mesh(G.tor, limb, .1 * B.bulk, .1, .14 * B.bulk, .02, B.torso * (.4 + i * .17), 0));
        torso.children.slice(-3).forEach(c => c.rotation.x = Math.PI / 2);
        torso.add(mesh(G.box, M(S[1]), .14, .16, .26 * B.bulk, 0, B.torso * .82, 0));
      } else {
        torso.add(mesh(G.sph, B.pauldron ? main : M(S[0]), .17 * B.bulk, B.torso * .55, B.sh * .95, 0, B.torso * .55, 0));
        if (!B.pauldron) torso.add(mesh(G.box, M(S[1], { r: .7 }), .2 * B.bulk, B.torso * .45, B.sh * 1.25, .03, B.torso * .55, 0));   // flak vest / tabard
        else torso.add(mesh(G.box, second, .05, .08, .12, .16 * B.bulk, B.torso * .72, 0));   // chest aquila
      }
      const head = grp(0, B.torso * (B.helm === "sunk" ? .9 : 1.02), 0); torso.add(head); F.head = head;
      const H = B.head;
      switch (B.helm) {
        case "marine": head.add(mesh(G.sph, main, H, H * 1.05, H * .95, 0, H * .7, 0)); head.add(mesh(G.box, dark, H * .5, H * .45, H * .6, H * .75, H * .4, 0)); for (const s of [1, -1]) head.add(mesh(G.sph, eye, H * .18, H * .14, H * .18, H * .85, H * .85, s * H * .38)); break;
        case "sunk": head.add(mesh(G.sph, main, H, H * .9, H * .95, .05, H * .4, 0)); for (const s of [1, -1]) head.add(mesh(G.sph, eye, H * .18, H * .14, H * .18, .05 + H * .85, H * .5, s * H * .38)); break;
        case "custodes": head.add(mesh(G.sph, main, H, H * 1.1, H * .9, 0, H * .75, 0)); head.add(mesh(G.box, M(S[1]), H * 1.6, H * .5, .03, -H * .1, H * 1.9, 0)); head.add(mesh(G.box, dark, .02, H * .5, H * .7, H * .85, H * .75, 0)); break;
        case "flak": head.add(mesh(G.sph, skin, H, H * 1.1, H, 0, H * .8, 0)); head.add(mesh(G.hemi, M(S[0], { r: .55 }), H * 1.18, H * .95, H * 1.18, 0, H * 1.05, 0)); head.add(mesh(G.cyl, M(S[0]), H * 1.3, .02, H * 1.3, 0, H * 1.05, 0)); head.add(mesh(G.box, dark, H * .3, H * .22, H * 1.1, H * .85, H * .95, 0)); break;
        case "bare": head.add(mesh(G.sph, skin, H, H * 1.1, H, 0, H * .8, 0)); head.add(mesh(G.hemi, M(0xe8e8e0, { r: .9 }), H * 1.08, H * .9, H * 1.08, -.01, H * 1.0, 0)); break;
        case "hood": head.add(mesh(G.sph, M(0x0b0b0c), H * .9, H, H * .9, .02, H * .8, 0)); head.add(mesh(G.cone, M(S[0], { r: .85 }), H * 1.35, H * 2.4, H * 1.35, -.02, H * 1.2, 0)); if (B.eyes) for (const s of [1, -1]) head.add(mesh(G.sph, eye, H * .12, H * .12, H * .12, H * .8, H * .8, s * H * .3)); break;
        case "skull": head.add(mesh(G.sph, METAL(S[0]), H * .95, H * 1.15, H * .85, 0, H * .85, 0)); head.add(mesh(G.box, METAL(S[0]), H * .7, H * .35, H * .9, H * .35, H * .25, 0)); for (const s of [1, -1]) head.add(mesh(G.sph, eye, H * .2, H * .16, H * .2, H * .8, H * .95, s * H * .35)); head.add(mesh(G.box, M(S[1]), H * 1.2, H * .6, .025, -.02, H * 1.3, 0)); break;
        case "ork": head.add(mesh(G.sph, skin, H * 1.1, H, H, .03, H * .6, 0)); head.add(mesh(G.box, skin, H * .9, H * .5, H * 1.4, H * .45, H * .15, 0)); for (const s of [1, -1]) { head.add(mesh(G.cone, M(0xe8e0c8), H * .12, H * .4, H * .12, H * .9, H * .45, s * H * .5)); head.add(mesh(G.sph, eye, H * .14, H * .12, H * .14, H * .85, H * .8, s * H * .35)); } break;
        case "tau": head.add(mesh(G.box, M(S[0]), H * 1.6, H * 1.3, H * 1.4, .03, H * .8, 0)); head.children[0].rotation.z = -.25; head.add(mesh(G.cyl, GLOW(S[4]), H * .22, .05, H * .22, H * .8, H * .95, 0)); head.children[1].rotation.z = Math.PI / 2; break;
        case "eldar": head.add(mesh(G.sph, M(S[0]), H, H * 1.25, H * .9, 0, H * .85, 0)); head.add(mesh(G.box, M(S[1]), H * 1.8, H * .35, .03, -H * .3, H * 1.9, 0)); for (const s of [1, -1]) head.add(mesh(G.sph, GLOW(S[4]), H * .22, H * .2, H * .2, H * .8, H * .95, s * H * .35)); break;
        case "kroot": head.add(mesh(G.sph, skin, H, H * 1.1, H * .9, 0, H * .8, 0)); head.add(mesh(G.cone, M(0x3a3a2a), H * .35, H * 1.2, H * .35, H * 1.1, H * .7, 0)); head.children[1].rotation.z = -Math.PI / 2; for (let i = 0; i < 4; i++) head.add(mesh(G.cone, M(S[1]), H * .12, H * 1.3, H * .12, -H * .5, H * 1.2, (i - 1.5) * H * .3)); break;
        case "nid": head.add(mesh(G.sph, M(S[1]), H * 1.3, H * .9, H * .8, H * .3, H * .6, 0)); head.add(mesh(G.sph, M(S[0]), H * 1.1, H * .6, H * .85, -.04, H * 1.0, 0)); for (const s of [1, -1]) head.add(mesh(G.sph, eye, H * .14, H * .12, H * .14, H * 1.1, H * .7, s * H * .35)); break;
        case "brain": head.add(mesh(G.sph, M(S[1], { r: .5 }), H, H * .85, H, 0, H * .5, 0)); for (const s of [1, -1]) head.add(mesh(G.sph, eye, H * .1, H * .1, H * .1, H * .9, H * .2, s * H * .3)); break;
        default: head.add(mesh(G.sph, skin, H, H * 1.1, H, 0, H * .8, 0));
      }
      if (B.pack === "marine") { torso.add(mesh(G.box, main, .16 * B.bulk, B.torso * .5, B.sh * 1.1, -.17 * B.bulk, B.torso * .62, 0)); for (const s of [1, -1]) torso.add(mesh(G.cyl, dark, .045, .16, .045, -.26 * B.bulk, B.torso * .95, s * B.sh * .35)); }
      else if (B.pack === "roll") torso.add(mesh(G.cyl, M(0x4a4a34), .06, B.sh * 1.6, .06, -.17, B.torso * .8, 0)), torso.children[torso.children.length - 1].rotation.x = Math.PI / 2;
      else if (B.pack === "box") torso.add(mesh(G.box, M(S[1]), .1, B.torso * .4, B.sh, -.17, B.torso * .6, 0));
      if (B.tail) torso.add(mesh(G.cone, M(S[1]), .07, .7, .07, -.3, .1, 0)), torso.children[torso.children.length - 1].rotation.z = 1.9;
      if (B.wings) for (const s of [1, -1]) { const w = mesh(G.box, M(S[1], { tr: true, op: .75, ds: true }), .5, .02, .7, -.2, B.torso * .9, s * .4); w.rotation.x = s * .5; torso.add(w); F.wings = (F.wings || []).concat(w); }
      // arms: a shoulder joint swinging forward (rotation.z), an elbow, a hand
      const armSets = B.extraArms ? [[1, B.torso * .88], [-1, B.torso * .88], [1, B.torso * .62], [-1, B.torso * .62]] : [[1, B.torso * .88], [-1, B.torso * .88]];
      const al = .3 * (B.arms || 1);
      for (const [s, y] of armSets) {
        const sh = grp(0, y, s * B.sh); torso.add(sh);
        sh.add(mesh(G.cyl, limb, lw, al, lw, 0, -al / 2, 0));
        const el = grp(0, -al, 0); sh.add(el);
        el.add(mesh(G.cyl, limb, lw * .9, al * .9, lw * .9, 0, -al * .45, 0));
        el.add(mesh(G.sph, B.helm === "ork" || B.helm === "nid" ? skin : B.skel ? limb : B.pauldron ? main : dark, lw * 1.25, lw * 1.25, lw * 1.25, 0, -al * .92, 0));
        const hand = grp(0, -al * .92, 0); el.add(hand);
        if (B.pauldron && y > B.torso * .7) sh.add(mesh(G.sph, main, .16 * B.pauldron, .12 * B.pauldron, .15 * B.pauldron, -.01, .02, s * .05));
        if (B.pauldron && y > B.torso * .7) sh.add(mesh(G.tor, second, .14 * B.pauldron, .14 * B.pauldron, .03, 0, .0, s * .05)), sh.children[sh.children.length - 1].rotation.x = Math.PI / 2;
        F.arms.push({ sh, el, hand, s });
      }
      // the gun in the right hand (horizontal when the arm is raised level), the blade in the left
      const rk = r.rk || "", mk = r.mk || "";
      const nid = /^(nid|beast|carnifex|serpent)$/.test(B.kind);
      if (rk && rk !== "grenade" && !(nid && rk === "bio")) {
        const gun = gunMesh(rk === "lob" ? "shell" : rk, S); const R2 = F.arms[0];
        gun.rotation.z = -Math.PI / 2 + .15; gun.scale.setScalar(B.pauldron ? 1.15 : 1); R2.hand.add(gun); F.gun = gun; F.gunKind = rk;
      }
      if (mk && mk !== "fist" || (mk === "fist" && B.pauldron)) {
        const bl = bladeMesh(nid ? "claw" : mk, S); const L2 = F.arms[1] || F.arms[0];
        bl.scale.setScalar(B.pauldron ? 1.2 : 1); L2.hand.add(bl); F.blade = bl;
      }
      if (nid) for (const a of F.arms) { const b2 = bladeMesh("claw", S); b2.scale.setScalar(1.6); a.hand.add(b2); }
      F.fig = fig; F.B = B;
      return F;
    }
    // ---- a four-legged Tyranid beast (gaunts, the Carnifex) and a serpent
    function beast(r, B, S, heavy) {
      const fig = grp(), F = { legs: [], arms: [], quad: 1 }, main = M(S[0], { r: .45 }), flesh = M(S[1], { r: .7 }), eye = GLOW(S[4]);
      const body = grp(0, heavy ? .75 : .6, 0); fig.add(body); F.hips = body; F.hipY = body.position.y; F.torso = body;
      body.add(mesh(G.sph, flesh, heavy ? .62 : .5, heavy ? .4 : .26, heavy ? .4 : .24, 0, 0, 0));
      for (let i = 0; i < (heavy ? 4 : 3); i++) body.add(mesh(G.sph, main, heavy ? .3 : .2, .12, heavy ? .4 : .26, (heavy ? .35 : .25) - i * (heavy ? .25 : .2), heavy ? .3 : .17, 0));
      const head = grp(heavy ? .65 : .52, heavy ? .1 : .12, 0); body.add(head); F.head = head;
      head.add(mesh(G.sph, main, heavy ? .3 : .17, heavy ? .2 : .13, heavy ? .24 : .13, 0, 0, 0));
      for (const s of [1, -1]) head.add(mesh(G.sph, eye, .035, .03, .035, heavy ? .22 : .13, .04, s * (heavy ? .12 : .07)));
      body.add(mesh(G.cone, flesh, heavy ? .12 : .08, heavy ? 1.0 : .7, heavy ? .12 : .08, heavy ? -.9 : -.6, -.05, 0)); body.children[body.children.length - 1].rotation.z = Math.PI / 2 + .2;
      for (const [x, s] of [[heavy ? .3 : .22, 1], [heavy ? .3 : .22, -1], [heavy ? -.32 : -.25, 1], [heavy ? -.32 : -.25, -1]]) {
        const p = grp(x, -.05, s * (heavy ? .32 : .18)); body.add(p);
        const L = heavy ? .45 : .35;
        p.add(mesh(G.cyl, flesh, heavy ? .09 : .05, L, heavy ? .09 : .05, 0, -L / 2, 0)); p.rotation.x = s * .25;
        const kn = grp(0, -L, 0); p.add(kn); kn.add(mesh(G.cyl, main, heavy ? .07 : .04, L, heavy ? .07 : .04, 0, -L / 2, 0));
        F.legs.push({ p, kn, s, x });
      }
      for (const s of [1, -1]) {
        const sh = grp(heavy ? .5 : .4, heavy ? .15 : .1, s * (heavy ? .3 : .16)); body.add(sh);
        const al = heavy ? .4 : .28;
        sh.add(mesh(G.cyl, flesh, heavy ? .1 : .05, al, heavy ? .1 : .05, 0, -al / 2, 0));
        const el = grp(0, -al, 0); sh.add(el);
        if (heavy) { el.add(mesh(G.box, main, .22, .3, .16, .05, -.12, 0)); el.add(mesh(G.cone, M(0xe8dcc0), .06, .3, .06, .12, -.3, 0)); }
        else { el.add(mesh(G.cone, M(0xe8dcc0), .04, .5, .04, 0, -.25, 0)); el.children[0].rotation.z = Math.PI; }
        sh.rotation.z = 1.2; el.rotation.z = -1.8;
        F.arms.push({ sh, el, hand: el, s });
      }
      if (heavy) { body.add(mesh(G.cyl, M(S[0]), .12, .6, .12, .1, .45, .18)); body.children[body.children.length - 1].rotation.z = Math.PI / 2 - .2; }
      F.fig = fig; F.B = B;
      return F;
    }
    function serpent(r, B, S) {
      const fig = grp(), F = { legs: [], arms: [], segs: [] }, main = M(S[0], { r: .45 }), flesh = M(S[1], { r: .7 });
      for (let i = 0; i < 6; i++) { const s = .26 - i * .03, m = mesh(G.sph, i % 2 ? flesh : main, s, s * .8, s, -i * .32, s * .8, 0); fig.add(m); F.segs.push(m); }
      const torso = grp(.1, .5, 0); fig.add(torso); F.torso = torso; F.hips = torso; F.hipY = .5;
      torso.add(mesh(G.sph, main, .2, .3, .2, 0, .25, 0));
      const head = grp(.05, .6, 0); torso.add(head); F.head = head; head.add(mesh(G.sph, main, .16, .12, .14, .05, 0, 0));
      for (const s of [1, -1]) { const sh = grp(0, .4, s * .18); torso.add(sh); const el = grp(0, -.25, 0); sh.add(mesh(G.cyl, flesh, .04, .25, .04, 0, -.12, 0)); sh.add(el); el.add(mesh(G.cone, M(0xe8dcc0), .04, .5, .04, 0, -.25, 0)); el.children[0].rotation.z = Math.PI; F.arms.push({ sh, el, hand: el, s }); }
      F.fig = fig; F.B = B;
      return F;
    }
    function drone(r, S) {
      const fig = grp(), F = { legs: [], arms: [], hover: 1 };
      const disc = grp(0, 1.1, 0); fig.add(disc); F.hips = disc; F.hipY = 1.1; F.torso = disc;
      disc.add(mesh(G.cyl, M(S[0], { r: .45 }), .32, .08, .32)); disc.add(mesh(G.sph, M(S[1]), .14, .1, .14, 0, .07, 0)); disc.add(mesh(G.cyl, GLOW(S[4]), .05, .02, .05, .2, .03, 0)); disc.children[2].rotation.z = Math.PI / 2;
      const gun = gunMesh("pulse", S); gun.position.set(.05, -.08, 0); disc.add(gun); F.gun = gun; F.gunKind = "pulse";
      F.fig = fig; F.B = { kind: "drone" };
      return F;
    }

    // ---- vehicles: hull, tracks or wheels or legs, turret, guns, sponsons
    function vehicle(r, S) {
      const F = { veh: 1, legs: [], arms: [], tracks: [], wheels: [], barrels: [] }, fig = grp(); F.fig = fig;
      const name = r.veh || r.template || "", main = M(S[0], { r: .55, m: .25 }), trim = METAL(S[1]), dark = M(0x232326, { r: .6, m: .3 });
      const trackMat = M(0xffffff, { map: TEX.track.clone(), r: .7, m: .3 }); keep(trackMat.map); trackMat.map.needsUpdate = true; trackMat.map.repeat.set(4, 1);
      F.tracks = [trackMat];
      const track = (x, z, len, h, w) => { const t = mesh(G.box, trackMat, len, h, w, x, h / 2, z); fig.add(t); return t; };
      const hull = grp(); fig.add(hull); F.hull = hull;
      const turret = grp(); F.turret = turret;
      const barrel = (parent, x, y, z, len, rad, glow) => { const b = grp(x, y, z); const m = mesh(G.cyl, dark, rad, len, rad, len / 2, 0, 0); m.rotation.z = Math.PI / 2; b.add(m); if (glow) b.add(mesh(G.sph, GLOW(glow), rad * 1.1, rad * 1.1, rad * 1.1, len, 0, 0)); parent.add(b); F.barrels.push(b); return b; };
      if (r.body === "walker" || /Sentinel/.test(name)) {
        // a chicken-legged walker: cab on two reverse-jointed legs
        const cab = grp(0, 1.55, 0); fig.add(cab); F.hips = cab; F.hipY = 1.55; F.torso = cab;
        cab.add(mesh(G.box, main, .7, .5, .6, 0, .1, 0)); cab.add(mesh(G.box, trim, .72, .05, .62, 0, .37, 0)); cab.add(mesh(G.box, dark, .2, .2, .5, -.3, .05, 0));
        cab.add(mesh(G.sph, M(S[2]), .09, .1, .09, .05, .42, 0));   // the pilot's head in the open cab
        const g2 = gunMesh(r.rk || "las", S); g2.position.set(.38, -.12, 0); g2.scale.setScalar(1.3); cab.add(g2); F.gun = g2; F.gunKind = r.rk;
        for (const s of [1, -1]) { const p = grp(0, -.1, s * .22); cab.add(p); p.add(mesh(G.cyl, dark, .06, .7, .06, 0, -.35, 0)); p.rotation.z = .5; const kn = grp(0, -.7, 0); p.add(kn); kn.add(mesh(G.cyl, main, .05, .8, .05, 0, -.4, 0)); kn.rotation.z = -1.0; kn.add(mesh(G.box, dark, .3, .06, .16, .05, -.8, 0)); F.legs.push({ p, kn, s, walker: 1 }); }
        F.walker = 1; return F;
      }
      if (/Trukk/.test(name)) {
        hull.add(mesh(G.box, M(0x8a1a12, { r: .7, m: .3 }), 1.0, .45, .9, .55, .65, 0));   // red cab, it goes faster
        hull.add(mesh(G.box, METAL(0x6a5a4a), 1.4, .12, 1.0, -.45, .5, 0));
        for (const [x, z, a] of [[-.2, .48, .1], [-.7, -.48, -.12], [-1.05, .2, .05]]) { const p = mesh(G.box, METAL(0x7a6a52), .5, .35, .05, x, .72, z); p.rotation.y = a; hull.add(p); }
        hull.add(mesh(G.box, dark, .1, .6, .1, .95, .9, .3));
        for (const [x, z] of [[.6, .5], [.6, -.5], [-.7, .5], [-.7, -.5]]) { const w = grp(x, .3, z); const m = mesh(G.cyl, dark, .3, .18, .3); m.rotation.x = Math.PI / 2; w.add(m); fig.add(w); F.wheels.push(w); }
        const pin = grp(-.2, .9, 0); hull.add(pin); const g2 = gunMesh("slug", S); g2.scale.setScalar(1.6); pin.add(g2); F.turret = pin; F.gunKind = "slug";
        return F;
      }
      const lr = /Land Raider/.test(name), rus = /Leman Russ/.test(name), pred = /Predator/.test(name), rhino = /Rhino/.test(name), chim = /Chimera/.test(name);
      const L = lr ? 2.9 : rus ? 2.5 : 2.3, Wd = lr ? 1.6 : 1.35, th = lr ? .95 : .55;
      // sloped hull: an extruded side profile
      const prof = new THREE.Shape(); const hh = rus ? .55 : lr ? .55 : .8, nose = rus ? .55 : .45;
      prof.moveTo(-L / 2, .2); prof.lineTo(L / 2 - nose * .4, .2); prof.lineTo(L / 2, .45); prof.lineTo(L / 2 - nose, .2 + hh); prof.lineTo(-L / 2 + .1, .2 + hh); prof.lineTo(-L / 2, .2 + hh - .1); prof.closePath();
      const hg = keep(new THREE.ExtrudeGeometry(prof, { depth: Wd * (lr ? .6 : .8), bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 1 })); hg.translate(0, 0, -Wd * (lr ? .6 : .8) / 2);
      const hm = new THREE.Mesh(hg, main); hm.castShadow = true; hm.receiveShadow = true; hull.add(hm);
      if (lr) {
        // rhomboid track units, taller than the hull
        for (const s of [1, -1]) { const tp = new THREE.Shape(); tp.moveTo(-L / 2, .25); tp.lineTo(-L / 2 + .4, 0); tp.lineTo(L / 2 - .3, 0); tp.lineTo(L / 2 + .25, .7); tp.lineTo(L / 2 - .1, 1.15); tp.lineTo(-L / 2 + .2, 1.15); tp.closePath(); const tg = keep(new THREE.ExtrudeGeometry(tp, { depth: .38, bevelEnabled: false })); tg.translate(0, 0, -.19); const tm = new THREE.Mesh(tg, main); tm.position.z = s * (Wd / 2 - .05); tm.castShadow = true; hull.add(tm); const sp = mesh(G.box, main, .6, .35, .3, .2, .6, s * (Wd / 2 + .3)); hull.add(sp); barrel(hull, .4, .62, s * (Wd / 2 + .3) + s * .06, .7, .05, 0xff3020); barrel(hull, .4, .62, s * (Wd / 2 + .3) - s * .06, .7, .05, 0xff3020); }
        hull.add(mesh(G.box, trim, .3, .06, Wd * .6, .9, .76, 0)); barrel(hull, 1.2, .55, .07, .35, .04); barrel(hull, 1.2, .55, -.07, .35, .04);
        fig.add(mesh(G.box, trackMat, L * .95, .22, .14, 0, .11, Wd / 2 + .1)); fig.add(mesh(G.box, trackMat, L * .95, .22, .14, 0, .11, -Wd / 2 - .1));
      } else {
        for (const s of [1, -1]) track(0, s * (Wd / 2 - .02), L * (rus ? 1.06 : .98), th, .32);
        hull.add(mesh(G.box, trim, L * .6, .05, .06, -.1, .2 + hh + .01, Wd * .4));
        hull.add(mesh(G.box, trim, L * .6, .05, .06, -.1, .2 + hh + .01, -Wd * .4));
        hull.add(mesh(G.cyl, dark, .06, .35, .06, -L / 2 + .25, .2 + hh + .15, Wd * .3));   // exhaust stack
        F.exhaust = new THREE.Vector3(-L / 2 + .25, .2 + hh + .35, Wd * .3);
      }
      if (rus || pred || chim) {
        // the turret, turning on its own
        turret.position.set(rus ? -.15 : chim ? .05 : -.1, .2 + hh, 0); hull.add(turret);
        turret.add(mesh(G.cyl, main, rus ? .5 : .38, .32, rus ? .5 : .38, 0, .16, 0)); turret.add(mesh(G.box, main, rus ? .9 : .65, .28, rus ? .75 : .55, .05, .2, 0));
        turret.add(mesh(G.cyl, trim, .12, .08, .12, -.15, .38, .15));
        if (rus) barrel(turret, .4, .2, 0, 1.4, .08);
        else if (pred) { barrel(turret, .3, .2, .08, .9, .05); barrel(turret, .3, .2, -.08, .9, .05); }
        else { barrel(turret, .3, .22, .06, .7, .03, 0xff3020); barrel(turret, .3, .22, -.06, .7, .03, 0xff3020); }
        F.turret = turret;
      }
      if (rus || pred) for (const s of [1, -1]) { const sp = mesh(G.box, main, .45, .3, .25, .15, .55, s * (Wd / 2 + .12)); hull.add(sp); barrel(hull, .37, .58, s * (Wd / 2 + .15), .4, .04); }
      if (rus) barrel(hull, L / 2 - .2, .55, 0, .5, .06, 0xff3020);
      if (chim) barrel(hull, L / 2 - .25, .45, .2, .3, .04);
      if (rhino) { hull.add(mesh(G.cyl, dark, .2, .1, .2, -.2, .2 + hh + .05, 0)); const pin = grp(-.2, .2 + hh + .12, 0); hull.add(pin); const g2 = gunMesh("bolt", S); g2.scale.setScalar(1.4); pin.add(g2); F.turret = pin; }
      return F;
    }

    // ---- every figure on its round base, the side's colour on the rim
    const SIDE = [0xc23a30, 0xd6a73c];
    const pick = [];
    const sandMat = M(0xffffff, { map: TEX.sand, r: 1 });
    const figs = ros.map((r, i) => {
      const S = scheme(r), arch = archOf(r), side = r.side || 0;
      const veh = arch === "vehicle";
      const k = veh ? 1 : HFT3[String(Math.max(-4, Math.min(6, r.sm || 0)))] / 6;
      const g = new THREE.Group();
      const bs = veh ? 1 : Math.max(1, Math.min(2.4, k * (arch === "terminator" || arch === "orkMega" ? 1.25 : arch === "marine" || arch === "custodes" ? 1.1 : 1)));
      if (!veh) { g.add(mesh(G.base, M(0x18181a, { r: .5 }), bs, 1, bs, 0, .045, 0)); const top = mesh(G.baseTop, sandMat, bs, bs, bs, 0, .1, 0, false); top.rotation.x = -Math.PI / 2; top.receiveShadow = true; g.add(top); g.add(mesh(G.tor, M(SIDE[side], { r: .4, m: .3 }), .48 * bs, .48 * bs, .1, 0, .07, 0, false)); g.children[2].rotation.x = Math.PI / 2; }
      const B = BUILD[arch] ? { ...BUILD[arch], kind: arch } : { kind: arch };
      const F = veh ? vehicle(r, S) : arch === "beast" ? beast(r, B, S, false) : arch === "carnifex" ? beast(r, B, S, true) : arch === "serpent" ? serpent(r, B, S) : arch === "drone" ? drone(r, S) : humanoid(r, B, S);
      if (veh) { const sideRing = mesh(G.tor, M(SIDE[side], { r: .4, m: .3 }), 1.25, 1.25, .1, 0, .04, 0, false); sideRing.rotation.x = Math.PI / 2; g.add(sideRing); }
      F.fig.scale.setScalar(k); g.add(F.fig);
      F.fig.traverse(m => { if (m.isMesh) { m.userData.i = i; pick.push(m); } });
      const sel = new THREE.Mesh(G.ring, keep(new THREE.MeshBasicMaterial({ color: 0xffffff }))); sel.rotation.x = Math.PI / 2; sel.position.y = .1; sel.scale.setScalar(veh ? 2.2 : Math.max(1, bs * .9)); sel.visible = false; g.add(sel);
      // health and shield bars, turned to the camera
      const bars = new THREE.Group();
      const back = new THREE.Mesh(G.bar, keep(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .6, depthTest: false }))); back.scale.set(1.32, .2, 1);
      const hp = new THREE.Mesh(G.bar, keep(new THREE.MeshBasicMaterial({ color: 0x5fbf6a, depthTest: false })));
      const sp = new THREE.Mesh(G.bar, keep(new THREE.MeshBasicMaterial({ color: 0x58b6e8, depthTest: false })));
      [back, hp, sp].forEach((m, j) => { m.renderOrder = 10 + j; bars.add(m); });
      const top = veh ? (F.walker ? 2.4 : 1.7) : arch === "beast" ? 1.15 : arch === "carnifex" ? 1.6 : arch === "serpent" ? 1.4 : arch === "drone" ? 1.5 : 2.05;
      bars.position.y = top * k + .25; F.top = top * k;
      g.add(bars); scene.add(g);
      Object.assign(F, { g, sel, bars, hp, sp, k, body: r.body || "upright", side, arch, i, veh, phase: hash(i, 7) * 6, walk: 0, aim: 0, last: null, turretAng: null, yaw: null });
      return F;
    });

