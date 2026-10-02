// Puts the simulator back together from its parts: engine/*.js inside the SIM closure, page/*.js inside the
// page's closure, each directory in file-name order. tools/build_site.py does the same in Python for the site;
// test/rules.test.js checks the two agree. `node tools/sim/assemble.js` prints the whole thing.
const fs = require("fs"), path = require("path");

const ENGINE_OPEN = "const SIM = (() => {\n", ENGINE_CLOSE = "})();\nif (typeof module !== \"undefined\") module.exports = SIM;\n";
const PAGE_OPEN = "if (typeof document !== \"undefined\") (() => {\n", PAGE_CLOSE = "})();\n";

function parts(sub) {
  const dir = path.join(__dirname, sub);
  return fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort().map(f => ({ file: `tools/sim/${sub}/${f}`, text: fs.readFileSync(path.join(dir, f), "utf8") }));
}

// the code, and where each part starts in it (1-based lines), to turn a line in the whole back into file:line
function assemble({ page = true } = {}) {
  let code = "", line = 1;
  const map = [];
  const add = (text, file) => { if (file) map.push({ line, file }); code += text; line += text.split("\n").length - 1; };
  add(ENGINE_OPEN); for (const p of parts("engine")) add(p.text, p.file); add(ENGINE_CLOSE);
  if (page) { add("\n" + PAGE_OPEN); for (const p of parts("page")) add(p.text, p.file); add(PAGE_CLOSE); }
  return { code, map };
}

function where(map, n) {
  let at = null;
  for (const m of map) if (m.line <= n) at = m; else break;
  return at ? `${at.file}:${n - at.line + 1}` : `assembled:${n}`;
}

module.exports = { assemble, where, parts };
if (require.main === module) process.stdout.write(assemble().code);
