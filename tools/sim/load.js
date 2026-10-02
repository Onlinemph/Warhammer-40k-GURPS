// The engine for node: `const SIM = require("./tools/sim/load.js")`. Errors from inside it name the part file
// and line (tools/sim/engine/55-battle-attacks.js:120) instead of a line in the assembled whole.
const vm = require("vm");
const { assemble, where } = require("./assemble.js");

const { code, map } = assemble({ page: false });
const FILE = "sim-engine.js";
const SIM = vm.runInThisContext(`(function () {${code}\nreturn SIM;\n})`, { filename: FILE })();

const mapStack = s => String(s).replace(new RegExp(FILE.replace(".", "\\.") + ":(\\d+)", "g"), (m, n) => where(map, +n));
const prev = Error.prepareStackTrace;
Error.prepareStackTrace = (err, frames) => mapStack(prev ? prev(err, frames) : `${err}\n${frames.map(f => "    at " + f).join("\n")}`);

module.exports = SIM;
