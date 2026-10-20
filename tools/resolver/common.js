// Shared by the resolver's calibration and validation scripts: the engine, the built site's data, and how a
// roster entry becomes a unit spec. (resolver.js itself needs none of this: it runs on the table alone.)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const SIM = require(path.join(ROOT, "tools", "sim", "load.js"));
const html = fs.readFileSync(path.join(ROOT, "site", "index.html"), "utf8");
const DATA = JSON.parse(html.slice(html.indexOf("const DATA = ") + 13, html.indexOf(";\nconst LIBS")));
SIM.index(DATA);
const LO = DATA.loadouts || {};
const unitSpec = (template, count, side, extra = {}) => ({ side, spec: { template, count, ...(LO[template] || {}), ...extra } });
// an army [{template, count}] as engine unit specs, one squad tag per entry
const armySpecs = (army, side) => army.map((e, i) => unitSpec(e.template, e.count, side, { squad: `s${side}u${i}`, squadName: e.template }));
const engineCommit = () => { try { return require("child_process").execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim(); } catch (e) { return "unknown"; } };
module.exports = { SIM, DATA, LO, ROOT, unitSpec, armySpecs, engineCommit };
