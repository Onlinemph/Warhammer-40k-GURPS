// Setting up a war for a test, now that worlds are made of regions (game/world/regions.js).
const RG = require("../world/regions.js");

// put a warband (or a swarm) on a world, in the region given or else the world's capital
const at = (S, box, id, rid) => { const b = box.warband || box; b.at = id; b.region = rid ?? RG.capitalOf(S.worlds[id]).id; return b; };
// give a whole world to a holder (null: free), every region its, with this garrison in the capital and none elsewhere
const hold = (w, owner, garrison = {}) => { w.owner = owner; for (const r of w.regions) { r.owner = owner; r.garrison = {}; } RG.capitalOf(w).garrison = { ...garrison }; return w; };
// every garrison on a world emptied, holders kept
const clear = w => { for (const r of w.regions) r.garrison = {}; return w; };
// every garrison on a world added up
const G = w => RG.garrisonOf(w);
const cap = w => RG.capitalOf(w);
// a quiet war: no AI forces anywhere
const quiet = S => { S.swarms = []; for (const w of Object.values(S.worlds)) for (const r of w.regions) if (r.owner === "chorus" || r.owner === "dormant") r.garrison = {}; return S; };
module.exports = { at, hold, clear, G, cap, quiet, RG };
