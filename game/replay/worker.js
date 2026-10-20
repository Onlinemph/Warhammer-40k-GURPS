// Runs replays off the server's main thread: one job at a time from the server, progress back as it goes.
const { parentPort } = require("worker_threads");
const fs = require("fs"), zlib = require("zlib");
const { build } = require("./build.js");
const { FACTIONS, MILITIA } = require("../world/units.js");
const sideName = f => f === "militia" ? MILITIA.name : FACTIONS[f] ? FACTIONS[f].name : f;
parentPort.on("message", ({ report, file }) => {
  try {
    let last = 0;
    const rep = build(report, p => { const now = Date.now(); if (now - last > 250) { last = now; parentPort.postMessage({ id: report.id, progress: p }); } });
    // the full engine result first (the 3D view's), then the compact replay, whose file marks the job done
    const { full, ...compact } = rep, fullFile = file.replace(/\.json\.gz$/, ".full.json.gz");
    fs.writeFileSync(fullFile + ".tmp", zlib.gzipSync(JSON.stringify({ ...full, war: { world: rep.world, turn: rep.turn, sides: rep.sides, sideNames: rep.sides.map(s => sideName(s.faction)), named: report.sides.map(s => s.named || []) } })));
    fs.renameSync(fullFile + ".tmp", fullFile);
    fs.writeFileSync(file + ".tmp", zlib.gzipSync(JSON.stringify(compact)));
    fs.renameSync(file + ".tmp", file);
    parentPort.postMessage({ id: report.id, done: true });
  } catch (e) { parentPort.postMessage({ id: report.id, error: e.message }); }
});
