// Runs replays off the server's main thread: one job at a time from the server, progress back as it goes.
const { parentPort } = require("worker_threads");
const fs = require("fs"), zlib = require("zlib");
const { build } = require("./build.js");
parentPort.on("message", ({ report, file }) => {
  try {
    let last = 0;
    const rep = build(report, p => { const now = Date.now(); if (now - last > 250) { last = now; parentPort.postMessage({ id: report.id, progress: p }); } });
    fs.writeFileSync(file + ".tmp", zlib.gzipSync(JSON.stringify(rep)));
    fs.renameSync(file + ".tmp", file);
    parentPort.postMessage({ id: report.id, done: true });
  } catch (e) { parentPort.postMessage({ id: report.id, error: e.message }); }
});
