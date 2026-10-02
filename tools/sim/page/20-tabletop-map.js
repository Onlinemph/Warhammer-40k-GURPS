  // ================= the tabletop: one battle replayed on a canvas, like a virtual tabletop =================
  // The map is painted once to an offscreen canvas (a battle-map palette, the same in either theme); tokens,
  // paths, shots, blows, blasts and floating injury are drawn over it each animation frame. Drag pans, the wheel
  // or a pinch zooms, a click opens a token's sheet.
  const MAP = { earth: "#5a5344", earth2: "#4c4638", rock: "#3a352c", crater: "#2b271f", wall: "#23262c", wallHi: "#6b717b", plate: "#5d6167", plate2: "#54585e",
    seam: "#3b3e44", grate: "#44484e", crateL: "#7a5a35", crateLd: "#4e3a22", crateH: "#8a8a84", crateHd: "#55554f", hazard: "#d4a52a", door: "#9aa1a8", doorD: "#2f3338",
    gridO: "rgba(0,0,0,.22)", gridF: "rgba(255,255,255,.07)", sideA: "#c23a30", sideB: "#d6a73c", sideAl: "#f08a7e", sideBl: "#f1d38a", ink: "#15161a", paper: "#f4f1e8",
    shield: "#58b6e8", hpHi: "#5fbf6a", hpMid: "#e3b341", hpLo: "#e0564b", shot: "#fff3c4", miss: "rgba(255,255,255,.35)", blast: "#ffb347" };
  const SQ3 = Math.sqrt(3), rangePenalty = SIM.rangePenalty, DIRN = SIM.DIRS;
  // the two corners bounding the edge toward each neighbour in DIRS (flat-topped hexes, corner i at i x 60 degrees)
  const EDGE = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];
  const hexCorner = (cx, cy, i, k = 1) => [cx + Math.cos(i * Math.PI / 3) * k, cy + Math.sin(i * Math.PI / 3) * k];
  function hexPath(g, cx, cy, k = 1) { g.beginPath(); for (let i = 0; i < 6; i++) { const [x, y] = hexCorner(cx, cy, i, k); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
  // a small repeatable random for textures, so the same map always looks the same
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // faction emblems: simple generated marks, drawn in unit space (radius about 0.45)
  const GLYPH = {
    Astartes(g) { g.beginPath(); g.moveTo(-.34, -.3); g.lineTo(.34, -.3); g.lineTo(.3, .12); g.lineTo(0, .38); g.lineTo(-.3, .12); g.closePath(); g.fill(); g.fillStyle = MAP.ink; g.fillRect(-.22, -.08, .44, .09); },
    Custodes(g) { g.fillRect(-.04, -.42, .08, .84); g.beginPath(); g.moveTo(0, -.46); g.lineTo(.13, -.26); g.lineTo(-.13, -.26); g.closePath(); g.fill(); g.lineWidth = .07; g.beginPath(); g.arc(0, .06, .3, Math.PI * .15, Math.PI * .85); g.stroke(); },
    "Adepta Sororitas"(g) { g.beginPath(); g.moveTo(0, -.4); g.lineTo(.12, -.08); g.lineTo(.4, 0); g.lineTo(.12, .08); g.lineTo(0, .4); g.lineTo(-.12, .08); g.lineTo(-.4, 0); g.lineTo(-.12, -.08); g.closePath(); g.fill(); },
    "Adeptus Mechanicus"(g) { g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? .3 : .42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = MAP.ink; g.beginPath(); g.arc(0, 0, .14, 0, 7); g.fill(); },
    "Imperial Guard"(g) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .17 : .42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); },
    "Inquisition and Psykers"(g) { g.lineWidth = .1; g.beginPath(); g.moveTo(-.2, -.36); g.lineTo(.2, .36); g.moveTo(.2, -.36); g.lineTo(-.2, .36); g.stroke(); g.beginPath(); g.arc(0, 0, .16, 0, 7); g.fill(); },
    Orks(g) { g.beginPath(); g.moveTo(-.36, -.26); g.lineTo(.36, -.26); g.lineTo(.3, .1); g.lineTo(.16, .36); g.lineTo(-.16, .36); g.lineTo(-.3, .1); g.closePath(); g.fill(); g.fillStyle = MAP.ink; g.beginPath(); g.moveTo(-.24, -.14); g.lineTo(-.04, -.04); g.lineTo(-.22, .04); g.closePath(); g.moveTo(.24, -.14); g.lineTo(.04, -.04); g.lineTo(.22, .04); g.closePath(); g.fill(); g.fillRect(-.14, .18, .28, .06); },
    Tyranids(g) { g.lineWidth = .09; g.lineCap = "round"; for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(s * .22, .34); g.quadraticCurveTo(s * .3 + .02, -.1, s * .08 + .12, -.38); g.stroke(); } },
    Necrons(g) { g.lineWidth = .08; g.beginPath(); g.arc(0, -.12, .2, 0, 7); g.stroke(); g.fillRect(-.04, .02, .08, .38); g.fillRect(-.24, .12, .48, .07); },
    Aeldari(g) { g.beginPath(); g.moveTo(0, -.42); g.lineTo(.12, 0); g.lineTo(0, .42); g.lineTo(-.12, 0); g.closePath(); g.fill(); g.lineWidth = .06; g.beginPath(); g.arc(0, 0, .3, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.beginPath(); g.arc(0, 0, .3, Math.PI * .15, Math.PI * .85); g.stroke(); },
    Drukhari(g) { g.beginPath(); g.moveTo(-.34, .3); g.lineTo(.38, -.4); g.lineTo(.08, .06); g.lineTo(.3, .1); g.lineTo(-.2, .36); g.closePath(); g.fill(); },
    "T'au"(g) { g.lineWidth = .07; g.beginPath(); g.arc(0, 0, .34, 0, 7); g.stroke(); g.beginPath(); g.arc(0, .06, .14, 0, 7); g.fill(); g.fillRect(-.03, -.34, .06, .2); },
    "Kroot and Vespid"(g) { g.beginPath(); g.moveTo(-.34, .3); g.quadraticCurveTo(0, -.6, .34, .3); g.quadraticCurveTo(0, .02, -.34, .3); g.fill(); },
    Default(g) { g.beginPath(); g.moveTo(0, -.38); g.lineTo(.3, 0); g.lineTo(0, .38); g.lineTo(-.3, 0); g.closePath(); g.fill(); },
  };
  const BADGES = [[1, "S", "#e3b341"], [2, "P", "#b9b4a8"], [4, "K", "#b9b4a8"], [8, "G", "#e0564b"], [16, "H", "#e0564b"], [32, "D", "#58b6e8"], [64, "A", "#e0564b"], [512, "W", "#b9b4a8"], [256, "N", "#e0564b"]];

