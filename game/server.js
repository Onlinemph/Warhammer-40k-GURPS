// The war server: the world service from docs/mmo/design.md in its first form. One process holds the war, keeps
// its event log on disk (data/events.jsonl, one JSON input per line, appended before it's applied), rebuilds the
// state from it on start, ticks on a timer, and serves the web client and its API. Node's standard library only.
//
//   node game/server.js                 # http://localhost:8080
//   PORT=8080 TURN_SECONDS=43200 DATA_DIR=game/data ADMIN_KEY=... node game/server.js
//
// API (JSON; the player's token as "Authorization: Bearer <token>"):
//   POST /api/join   {name, faction}            -> {token}
//   GET  /api/view                               -> what that player can see, and when the next tick is
//   POST /api/orders {move, recruit:[{unit,count}]} -> {ok} or {error}
//   POST /api/admin/tick  (header x-admin-key)  -> ticks now (testing)
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const { apply, rebuild, view, order } = require("./world/rules.js");
const { FACTIONS } = require("./world/units.js");

const PORT = +process.env.PORT || 8080, TURN = (+process.env.TURN_SECONDS || 43200) * 1000;
const DATA = process.env.DATA_DIR || path.join(__dirname, "data"), ADMIN = process.env.ADMIN_KEY || null;
fs.mkdirSync(DATA, { recursive: true });
const LOG = path.join(DATA, "events.jsonl"), TOKENS = path.join(DATA, "tokens.json");

// ---- the log and the state
const events = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
let S = rebuild(events);
function record(e) {
  e.at = Date.now();
  fs.appendFileSync(LOG, JSON.stringify(e) + "\n");
  events.push(e);
  S = apply(S, e);
}
if (!S) record({ type: "create", seed: crypto.randomInt(2 ** 31) });
// tokens: player id by the hash of their secret (kept apart from the log, which holds no secrets)
const tokens = fs.existsSync(TOKENS) ? JSON.parse(fs.readFileSync(TOKENS, "utf8")) : {};
const hash = t => crypto.createHash("sha256").update(t).digest("hex");

// ---- the clock
const lastTick = () => { for (let i = events.length - 1; i >= 0; i--) if (events[i].type === "tick" || events[i].type === "create") return events[i].at; return Date.now(); };
let timer = null;
function schedule() {
  clearTimeout(timer);
  const due = lastTick() + TURN;
  timer = setTimeout(() => { record({ type: "tick", seed: crypto.randomInt(2 ** 31) }); schedule(); }, Math.max(0, due - Date.now()));
  timer.unref();   // the listening server keeps the process alive, not the clock
}

// ---- requests
const hits = new Map();   // a crude per-address rate limit: 60 requests a minute
const limited = ip => { const now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < 60000); h.push(now); hits.set(ip, h); return h.length > 60; };
const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(type === "application/json" ? JSON.stringify(body) : body); };
const readBody = req => new Promise((ok, bad) => {
  let b = "";
  req.on("data", c => { b += c; if (b.length > 10000) { bad(new Error("too big")); req.destroy(); } });
  req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { bad(new Error("bad JSON")); } });
});
const who = req => { const m = /^Bearer (\S+)$/.exec(req.headers.authorization || ""); return m ? tokens[hash(m[1])] || null : null; };
const STATIC = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/style.css": ["style.css", "text/css"] };

const server = http.createServer(async (req, res) => {
  try {
    if (limited(req.socket.remoteAddress)) return send(res, 429, { error: "slow down" });
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && STATIC[url.pathname]) { const [f, t] = STATIC[url.pathname]; return send(res, 200, fs.readFileSync(path.join(__dirname, "public", f)), t); }
    if (req.method === "POST" && url.pathname === "/api/join") {
      const { name, faction } = await readBody(req);
      const nm = String(name || "").trim().replace(/[^\p{L}\p{N} '\-]/gu, "").slice(0, 24);
      if (nm.length < 2) return send(res, 400, { error: "a name of 2 to 24 letters" });
      if (!FACTIONS[faction] || !FACTIONS[faction].player) return send(res, 400, { error: "choose the Hegemony or the Brawl" });
      if (Object.values(S.players).some(p => p.name.toLowerCase() === nm.toLowerCase())) return send(res, 400, { error: "that name is taken" });
      const player = "p" + crypto.randomBytes(6).toString("hex"), token = crypto.randomBytes(24).toString("base64url");
      tokens[hash(token)] = player; fs.writeFileSync(TOKENS, JSON.stringify(tokens));
      record({ type: "join", player, name: nm, faction });
      return send(res, 200, { token });
    }
    if (req.method === "GET" && url.pathname === "/api/view") {
      const p = who(req); if (!p) return send(res, 401, { error: "join first" });
      return send(res, 200, { ...view(S, p), nextTick: lastTick() + TURN, now: Date.now() });
    }
    if (req.method === "POST" && url.pathname === "/api/orders") {
      const p = who(req); if (!p) return send(res, 401, { error: "join first" });
      const { move, recruit } = await readBody(req);
      const e = { type: "order", player: p, move: typeof move === "string" ? move : null, recruit: Array.isArray(recruit) ? recruit.slice(0, 6).map(r => ({ unit: String(r.unit), count: Math.floor(+r.count) })) : [] };
      // check against a copy first: a refused order isn't logged
      const err = order(JSON.parse(JSON.stringify(S)), e);
      if (err) return send(res, 400, { error: err });
      record(e);
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/admin/tick") {
      if (!ADMIN || req.headers["x-admin-key"] !== ADMIN) return send(res, 403, { error: "no" });
      record({ type: "tick", seed: crypto.randomInt(2 ** 31) }); schedule();
      return send(res, 200, { turn: S.turn });
    }
    send(res, 404, { error: "not found" });
  } catch (e) { send(res, 400, { error: e.message }); }
});
if (require.main === module) { schedule(); server.listen(PORT, () => console.log(`the war is on http://localhost:${PORT} (turn ${S.turn}, a tick every ${TURN / 1000} s)`)); }
module.exports = { server, schedule, state: () => S };
