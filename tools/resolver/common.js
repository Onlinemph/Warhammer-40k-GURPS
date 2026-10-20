// Shared by the resolver's calibration and validation scripts: the engine, the built site's data, and how a
// roster entry becomes a unit spec. (resolver.js itself needs none of this: it runs on the table alone.)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const SIM = require(path.join(ROOT, "tools", "sim", "load.js"));
const html = fs.readFileSync(path.join(ROOT, "site", "index.html"), "utf8");
const DATA = JSON.parse(html.slice(html.indexOf("const DATA = ") + 13, html.indexOf(";\nconst LIBS")));
SIM.index(DATA);
const LO = DATA.loadouts || {};
// variants the resolver is calibrated for besides the templates themselves: a Chorus brood fighting under synapse (its
// Conductor's field), fearless and pain-proof as a linked brood is, which the template alone can't show
const VARIANTS = { "Hormagaunt (linked)": { template: "Hormagaunt", flags: { synIndep: 1 } }, "Termagant (linked)": { template: "Termagant", flags: { synIndep: 1 } } };
const unitSpec = (template, count, side, extra = {}) => {
  const v = VARIANTS[template], t = v ? v.template : template;
  return { side, spec: { template: t, count, ...(LO[t] || {}), ...(v ? { flags: v.flags } : {}), ...extra } };
};
// an army [{template, count}] as engine unit specs, one squad tag per entry
const armySpecs = (army, side) => army.map((e, i) => unitSpec(e.template, e.count, side, { squad: `s${side}u${i}`, squadName: e.template }));
const engineCommit = () => { try { return require("child_process").execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim(); } catch (e) { return "unknown"; } };
module.exports = { SIM, DATA, LO, ROOT, unitSpec, armySpecs, engineCommit, VARIANTS };
