// The war server: the world service from docs/mmo/design.md in its first form. One process holds the war, keeps
// its event log on disk (data/events.jsonl, one JSON input per line, appended before it's applied), rebuilds the
// state from it on start, ticks on a timer, and serves the web client and its API. Node's standard library only.
//
//   node game/server.js                 # http://localhost:8080
//   PORT=8080 TURN_SECONDS=43200 DATA_DIR=game/data ADMIN_KEY=... node game/server.js
//   TRUST_PROXY=1 behind a proxy (Fly, Caddy): the client's address comes from its header, not the socket
//   BACKUPS=14: daily copies of the event log kept in DATA_DIR/backups (deploy/README.md)
//   BOTS=2: that many scripted warbands for each player faction (game/sample-wars.js), for a playtest; their joins and
//   orders go in the log like anyone's, given just before each tick
//
//   PUBLIC_URL, DISCORD_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET: sign-in (game/auth.js, deploy/README.md)
//   ALLOW_DEV_JOIN=1 keeps the development join (a name and a browser token, no account) even with sign-in set up;
//   it is on by default only when no sign-in provider is configured
//
// Sign-in (a session cookie afterwards):
//   GET  /auth/<discord|google>                  -> to the provider, and back to /auth/<provider>/callback
//   POST /auth/logout
// API (JSON; the session cookie, or a development join's token as "Authorization: Bearer <token>"):
//   GET  /api/me                                 -> {providers, devJoin, signedIn, joined}
//   POST /api/join   {name, faction}            -> {ok} for a signed-in account; {token} for a development join
//   GET  /api/view                               -> what that player can see, and when the next tick is
//   POST /api/orders {move, land, region, recruit:[{unit,count}], ritual:{kind,target}, stance, careful, build: walls|depot,
//                     convoy:{to, supply}} -> {ok} or {error}
//   Admin (header x-admin-key; every action goes in DATA_DIR/admin-log.jsonl, and the players' news):
//   GET  /api/admin/status                       -> {turn, paused, nextTick, players, bots}
//   POST /api/admin/tick                         -> ticks now
//   POST /api/admin/pause, /api/admin/resume     -> stop the clock; start it again with a full turn to go
//   POST /api/admin/rollback                     -> undo the last tick (its battles and the orders given since); the
//                                                   removed events are kept in DATA_DIR/rolledback/
//   POST /api/admin/newwar                       -> archive this war in DATA_DIR/archive/ and start a fresh one
//   POST /api/politics {action: stand|vote|recall|priority|post|cancel|accept, ...} -> {ok} or {error}
//        (vote: {for}; recall: {yes}; priority: {warbands}; post: {contract: {kind, world, turns, supply, reward, offer,
//        deadline}}; cancel and accept: {id}); takes effect at once, in the log as a "politics" event
//   GET  /api/live/<held battle id>              -> a battle held for you to fight: setup, answers so far, whose turn
//   POST /api/live/<id>/answer {k, ans}          -> the k-th answer, from the side the battle waits on
//   POST /api/upvote {report}                    -> {ok}: one mark a player a battle (the highlight feed)
//   GET  /api/tmc/<report id>                    -> a battle fought again on its hex map, with its log round by round
//   GET  /api/replay/<report id>                 -> {status, progress, ahead} until it's ready, then the replay
//                                                   (gzipped JSON); asking for one that isn't queued queues it
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), zlib = require("zlib");
const { Worker } = require("worker_threads");
const { apply, rebuild, view, order, politics, upvote, knows } = require("./world/rules.js");
const { FACTIONS, UNITS } = require("./world/units.js");
const TMC = require("./world/tmc.js");
const { makeAuth } = require("./auth.js");
const { makeLive } = require("./live.js");

const TRUST_PROXY = process.env.TRUST_PROXY === "1", KEEP_BACKUPS = +(process.env.BACKUPS ?? 14);
const PORT = +process.env.PORT || 8080, TURN = (+process.env.TURN_SECONDS || 43200) * 1000;
const DATA = process.env.DATA_DIR || path.join(__dirname, "data"), ADMIN = process.env.ADMIN_KEY || null;
fs.mkdirSync(DATA, { recursive: true });
const LOG = path.join(DATA, "events.jsonl"), TOKENS = path.join(DATA, "tokens.json"), ADMIN_FILE = path.join(DATA, "admin.json");

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
let tokens = fs.existsSync(TOKENS) ? JSON.parse(fs.readFileSync(TOKENS, "utf8")) : {};
// the admin's switches, kept across restarts: paused, and when the next tick is due after a resume
const adm = fs.existsSync(ADMIN_FILE) ? JSON.parse(fs.readFileSync(ADMIN_FILE, "utf8")) : { paused: false, dueAt: null };
const saveAdm = () => fs.writeFileSync(ADMIN_FILE, JSON.stringify(adm));
const adminLog = (action, extra = {}) => fs.appendFileSync(path.join(DATA, "admin-log.jsonl"), JSON.stringify({ at: Date.now(), action, turn: S.turn, ...extra }) + "\n");
// the log written whole (a rollback or a new war), through a temporary file so a crash never leaves half of it
function rewriteLog() { fs.writeFileSync(LOG + ".tmp", events.map(e => JSON.stringify(e) + "\n").join("")); fs.renameSync(LOG + ".tmp", LOG); }
const hash = t => crypto.createHash("sha256").update(t).digest("hex");
// accounts: a warband belongs to a Discord or Google account (game/auth.js)
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const auth = makeAuth({ dataDir: DATA, env: { ...process.env, PUBLIC_URL } });
const DEV_JOIN = process.env.ALLOW_DEV_JOIN === "1" || (process.env.ALLOW_DEV_JOIN !== "0" && !auth.enabled().length);

// battles fought live from the commanders' browsers (game/live.js)
const live = makeLive({ dataDir: DATA, state: () => S, record: e => record(e) });

// ---- battle replays: the full engine re-fights a battle (game/replay/build.js) on a worker thread, one at a time,
// into data/replays/<id>.json.gz, kept for good (a seed always replays the same battle). Every battle a player
// fought in is queued as soon as its tick publishes, so most are ready before anyone opens them; any other is
// queued when someone asks for it
const REPLAYS = path.join(DATA, "replays");
fs.mkdirSync(REPLAYS, { recursive: true });
const replayFile = id => path.join(REPLAYS, id.replace(/[^\w-]/g, "") + ".json.gz");
const jobs = new Map(), queue = [];   // id -> {status, progress}; ids waiting
let worker = null, busy = null;
function startWorker() {
  worker = new Worker(path.join(__dirname, "replay", "worker.js"));
  worker.unref();
  worker.on("message", m => {
    const j = jobs.get(m.id); if (!j) return;
    if (m.progress) j.progress = m.progress;
    if (m.done || m.error) { j.status = m.done ? "ready" : "failed"; j.error = m.error; busy = null; nextReplay(); }
  });
  worker.on("error", e => { if (busy) { const j = jobs.get(busy); if (j) { j.status = "failed"; j.error = e.message; } } busy = null; worker = null; nextReplay(); });
}
function nextReplay() {
  if (busy || !queue.length) return;
  const id = queue.shift(), report = S.reports.find(r => r.id === id);
  if (!report) { jobs.delete(id); return nextReplay(); }
  if (!worker) startWorker();
  busy = id; jobs.get(id).status = "running";
  worker.postMessage({ report, file: replayFile(id) });
}
function wantReplay(id) {
  if (fs.existsSync(replayFile(id))) return { status: "ready" };
  if (!jobs.has(id) || jobs.get(id).status === "failed") { jobs.set(id, { status: "queued", progress: null }); queue.push(id); nextReplay(); }
  return jobs.get(id);
}
function queuePlayerBattles(from) {
  for (const r of S.reports.slice(from)) if (r.sides.some(s => s.players.some(n => !/ bot \d+$/.test(n)))) wantReplay(r.id);   // not the bots' own fights
}

// ---- bots: scripted warbands for a playtest
const BOTS = +(process.env.BOTS || 0);
const botRand = () => Math.random();
function botsJoin() {
  if (!BOTS) return;
  for (const [f, F] of Object.entries(FACTIONS)) if (F.player) for (let i = 1; i <= BOTS; i++) {
    const id = `bot-${f}-${i}`;
    if (!S.players[id]) record({ type: "join", player: id, name: `${F.name.replace(/^The /, "")} bot ${i}`, faction: f });
  }
}
function botsOrder() {
  if (!BOTS) return;
  const { decide, politicsFor } = require("./sample-wars.js");
  for (const p of Object.values(S.players)) {
    if (!p.id.startsWith("bot-")) continue;
    for (const e of politicsFor(S, p)) if (!politics(S, e)) record(e);
    const o = decide(S, p, botRand);
    if (o && !order(JSON.parse(JSON.stringify(S)), { type: "order", player: p.id, ...o })) record({ type: "order", player: p.id, ...o });
  }
}
const tickNow = () => { botsOrder(); const n = S.reports.length; record({ type: "tick", seed: crypto.randomInt(2 ** 31) }); adm.dueAt = null; saveAdm(); queuePlayerBattles(n); live.sweep(); };

// ---- the clock
const lastTick = () => { for (let i = events.length - 1; i >= 0; i--) if (events[i].type === "tick" || events[i].type === "create") return events[i].at; return Date.now(); };
let timer = null;
const nextTick = () => adm.paused ? null : adm.dueAt ?? lastTick() + TURN;
function schedule() {
  clearTimeout(timer);
  if (adm.paused) return;
  const due = nextTick();
  timer = setTimeout(() => { tickNow(); schedule(); }, Math.max(0, due - Date.now()));
  timer.unref();   // the listening server keeps the process alive, not the clock
}

// ---- requests
const hits = new Map();   // a crude per-address rate limit
const limited = ip => { const now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < 60000); h.push(now); hits.set(ip, h); return h.length > RATE; };   // 300 a minute: a player clicking fast, not a script hammering
const RATE = +(process.env.RATE_LIMIT || 300);
const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(type === "application/json" ? JSON.stringify(body) : body); };
const readBody = req => new Promise((ok, bad) => {
  let b = "";
  req.on("data", c => { b += c; if (b.length > 10000) { bad(new Error("too big")); req.destroy(); } });
  req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { bad(new Error("bad JSON")); } });
});
// the player behind a request: the signed-in account's warband, or a development join's token
const who = req => { const p = auth.playerOf(auth.accountOf(req)); if (p) return p; const m = /^Bearer (\S+)$/.exec(req.headers.authorization || ""); return m ? tokens[hash(m[1])] || null : null; };
// a POST must come from the war's own pages (the cookie is SameSite=Lax as well): a page elsewhere can't act for a player
const sameOrigin = req => { const o = req.headers.origin; if (!o) return true; try { const h = new URL(o).host; return h === req.headers.host || h === new URL(PUBLIC_URL).host; } catch (e) { return false; } };
const redirect = (res, to, cookie) => { res.writeHead(302, { location: to, "cache-control": "no-store", ...(cookie ? { "set-cookie": cookie } : {}) }); res.end(); };
// the simulator's page (the library and the 3D replays), served at /sim: the 3D view of a war battle opens it on
// /sim#war=<report id>
const SIM_PAGE = path.join(__dirname, "..", "site", "index.html");
const STATIC = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/style.css": ["style.css", "text/css"], "/replay.js": ["replay.js", "text/javascript"], "/tmcview.js": ["tmcview.js", "text/javascript"], "/planet3d.js": ["planet3d.js", "text/javascript"] };

const server = http.createServer(async (req, res) => {
  try {
    // behind a proxy every request comes from the proxy: take the client's address from the header it adds
    const ip = TRUST_PROXY ? (req.headers["fly-client-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress) : req.socket.remoteAddress;
    if (limited(ip)) return send(res, 429, { error: "slow down" });
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/healthz") return send(res, 200, { ok: true, turn: S.turn, players: Object.keys(S.players).length });
    if (req.method === "GET" && url.pathname === "/sim") { if (!fs.existsSync(SIM_PAGE)) return send(res, 404, { error: "the simulator page isn't built" }); res.writeHead(200, { "content-type": "text/html", "cache-control": "no-cache" }); return res.end(fs.readFileSync(SIM_PAGE)); }
    if (req.method === "GET" && STATIC[url.pathname]) { const [f, t] = STATIC[url.pathname]; return send(res, 200, fs.readFileSync(path.join(__dirname, "public", f)), t); }
    if (req.method === "POST" && !sameOrigin(req)) return send(res, 403, { error: "not from this site" });
    const am = /^\/auth\/(\w+)(\/callback)?$/.exec(url.pathname);
    if (req.method === "GET" && am && !am[2]) {
      const to = auth.begin(am[1]);
      return to ? redirect(res, to.url, to.cookie) : send(res, 404, { error: "no such sign-in" });
    }
    if (req.method === "GET" && am && am[2]) {
      try {
        const secret = await auth.finish(am[1], Object.fromEntries(url.searchParams), req);
        return redirect(res, "/", [auth.cookieHeader(secret), auth.clearFlow]);
      } catch (e) { return redirect(res, "/?signin=" + encodeURIComponent(e.message), auth.clearFlow); }
    }
    if (req.method === "POST" && url.pathname === "/auth/logout") { auth.signOut(req); res.setHeader("set-cookie", auth.cookieHeader("")); return send(res, 200, { ok: true }); }
    if (req.method === "GET" && url.pathname === "/api/me") {
      const a = auth.accountOf(req);
      const factions = Object.entries(FACTIONS).filter(([, f]) => f.player).map(([id, f]) => ({ id, name: f.name, blurb: f.blurb, colour: f.colour }));
      return send(res, 200, { providers: auth.enabled(), devJoin: DEV_JOIN, signedIn: !!a, joined: !!who(req), factions });
    }
    if (req.method === "POST" && url.pathname === "/api/join") {
      const account = auth.accountOf(req);
      if (!account && !DEV_JOIN) return send(res, 401, { error: "sign in first" });
      if (account && auth.playerOf(account)) return send(res, 400, { error: "you already lead a warband in this war" });
      const { name, faction } = await readBody(req);
      const nm = String(name || "").trim().replace(/[^\p{L}\p{N} '\-]/gu, "").slice(0, 24);
      if (nm.length < 2) return send(res, 400, { error: "a name of 2 to 24 letters" });
      if (!FACTIONS[faction] || !FACTIONS[faction].player) return send(res, 400, { error: "choose one of the factions open to players" });
      if (Object.values(S.players).some(p => p.name.toLowerCase() === nm.toLowerCase())) return send(res, 400, { error: "that name is taken" });
      const player = "p" + crypto.randomBytes(6).toString("hex");
      if (account) { auth.bind(account, player); record({ type: "join", player, name: nm, faction }); return send(res, 200, { ok: true }); }
      const token = crypto.randomBytes(24).toString("base64url");
      tokens[hash(token)] = player; fs.writeFileSync(TOKENS, JSON.stringify(tokens));
      record({ type: "join", player, name: nm, faction });
      return send(res, 200, { token });
    }
    if (req.method === "GET" && url.pathname === "/api/view") {
      const p = who(req); if (!p) return send(res, 401, { error: "sign in and join first" });
      return send(res, 200, { ...view(S, p), nextTick: nextTick(), paused: adm.paused, now: Date.now() });
    }
    const lm = /^\/api\/live\/([\w-]+)(\/answer)?$/.exec(url.pathname);
    if (lm) {
      const p = who(req); if (!p) return send(res, 401, { error: "sign in and join first" });
      if (req.method === "GET" && !lm[2]) { const r = live.get(lm[1], p); return send(res, r.error ? 400 : 200, r); }
      if (req.method === "POST" && lm[2]) { const b = await readBody(req), r = live.answer(lm[1], p, Math.floor(+b.k), b.ans ?? null); return send(res, r.error ? 400 : 200, r); }
      return send(res, 404, { error: "not found" });
    }
    if (req.method === "POST" && url.pathname === "/api/upvote") {
      const p = who(req); if (!p) return send(res, 401, { error: "sign in and join first" });
      const b = await readBody(req), e = { type: "upvote", player: p, report: String(b.report || "").slice(0, 40) };
      const err = upvote(S, e);
      if (err) return send(res, 400, { error: err });
      record(e);
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/politics") {
      const p = who(req); if (!p) return send(res, 401, { error: "sign in and join first" });
      const b = await readBody(req), str = (x, n = 16) => x == null ? null : String(x).slice(0, n), num = x => Math.floor(+x) || 0;
      const c = b.contract && typeof b.contract === "object" ? b.contract : null;
      const e = { type: "politics", player: p, action: str(b.action), for: str(b.for), yes: b.yes == null ? undefined : !!b.yes, id: str(b.id),
        warbands: Array.isArray(b.warbands) ? b.warbands.slice(0, 2).map(x => str(x, 32)) : undefined,
        contract: c ? { kind: str(c.kind), world: str(c.world), turns: num(c.turns), supply: num(c.supply), deadline: num(c.deadline), offer: str(c.offer, 32),
          reward: { manpower: num(c.reward && c.reward.manpower), materiel: num(c.reward && c.reward.materiel), supply: num(c.reward && c.reward.supply) } } : undefined };
      for (const k of Object.keys(e)) if (e[k] === undefined || e[k] === null) delete e[k];
      const err = politics(S, e);
      if (err) return send(res, 400, { error: err });
      record(e);
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/orders") {
      const p = who(req); if (!p) return send(res, 401, { error: "sign in and join first" });
      const { move, land, region, recruit, ritual, stance, careful, build, convoy, command } = await readBody(req);
      const e = { type: "order", player: p, move: typeof move === "string" ? move : null, land: typeof land === "string" ? land.slice(0, 8) : null, region: typeof region === "string" ? region.slice(0, 8) : null, recruit: Array.isArray(recruit) ? recruit.slice(0, 6).map(r => ({ unit: String(r.unit), count: Math.floor(+r.count) })) : [],
        ritual: ritual && typeof ritual === "object" ? { kind: String(ritual.kind).slice(0, 16), target: ritual.target ? String(ritual.target).slice(0, 16) : null } : null,
        stance: stance == null ? null : String(stance).slice(0, 16), careful: careful == null ? null : !!careful, build: build == null ? null : String(build).slice(0, 16),
        convoy: convoy && typeof convoy === "object" ? { to: String(convoy.to).slice(0, 16), supply: Math.floor(+convoy.supply) || 0 } : null,
        command: command == null ? null : !!command };
      // check against a copy first: a refused order isn't logged
      const err = order(JSON.parse(JSON.stringify(S)), e);
      if (err) return send(res, 400, { error: err });
      record(e);
      return send(res, 200, { ok: true });
    }
    const ad = /^\/api\/admin\/(\w+)$/.exec(url.pathname);
    if (ad) {
      if (!ADMIN || req.headers["x-admin-key"] !== ADMIN) return send(res, 403, { error: "no" });
      const act = ad[1], status = () => ({ turn: S.turn, paused: adm.paused, nextTick: nextTick(), players: Object.values(S.players).filter(p => !p.id.startsWith("bot-")).length, bots: Object.keys(S.players).filter(id => id.startsWith("bot-")).length });
      if (req.method === "GET" && act === "status") return send(res, 200, status());
      if (req.method !== "POST") return send(res, 404, { error: "not found" });
      if (act === "tick") { tickNow(); schedule(); adminLog("tick"); return send(res, 200, status()); }
      if (act === "pause") { adm.paused = true; saveAdm(); schedule(); record({ type: "notice", text: "The war is paused" }); adminLog("pause"); return send(res, 200, status()); }
      if (act === "resume") { adm.paused = false; adm.dueAt = Date.now() + TURN; saveAdm(); schedule(); record({ type: "notice", text: "The war resumes" }); adminLog("resume"); return send(res, 200, status()); }
      if (act === "rollback") { const r = rollback(); if (r.error) return send(res, 400, r); adminLog("rollback", r); return send(res, 200, { ...status(), ...r }); }
      if (act === "newwar") { const r = newWar(); adminLog("newwar", r); return send(res, 200, { ...status(), ...r }); }
      return send(res, 404, { error: "no such admin action" });
    }
    // a battle on its hex map: Tactical Mass Combat fights it again from its record, round by round (game/world/tmc.js)
    const tm = /^\/api\/tmc\/([\w-]+)$/.exec(url.pathname);
    if (req.method === "GET" && tm) {
      const p = who(req); if (!p) return send(res, 401, { error: "sign in and join first" });
      const r = S.reports.find(x => x.id === tm[1]);
      if (!r || !knows(S, S.players[p])(r)) return send(res, 404, { error: "no such battle that you know of" });
      if (!r.tmc) return send(res, 404, { error: "that battle was fought live, not on the map" });
      const b = TMC.fight({ ...r.tmc, log: true });
      return send(res, 200, { id: r.id, title: `${r.regionName} on ${r.worldName}, turn ${r.turn}`, terrain: r.terrain, sides: r.sides.map((s0, i) => ({ faction: s0.faction, name: r.tmc.sides[i].name, colour: s0.faction === "militia" ? "#8d887e" : FACTIONS[s0.faction].colour })),
        units: Object.fromEntries([...Object.entries(UNITS).map(([k, u]) => [k, u.name]), ["militia", "Local Defence"]]), winner: b.winner, kind: b.kind, rounds: b.rounds, recon: b.recon, night: b.night, log: b.log, text: r.text });
    }
    const rm = /^\/api\/replay\/([\w-]+)$/.exec(url.pathname);
    if (req.method === "GET" && rm) {
      const p = who(req); if (!p) return send(res, 401, { error: "sign in and join first" });
      const id = rm[1], seen = view(S, p).reports.some(r => r.id === id) || S.reports.some(r => r.id === id && r.sides.some(s => s.faction === S.players[p].faction));
      if (!seen) return send(res, 404, { error: "no such battle that you know of" });
      const j = wantReplay(id);
      if (j.status !== "ready") return send(res, 200, { status: j.status, progress: j.progress, error: j.error, ahead: j.status === "queued" ? queue.indexOf(id) + (busy ? 1 : 0) : 0 });
      // ?full=1: the engine's whole result, for the 3D view (replays made before it was kept have none: make it again)
      const file = url.searchParams.get("full") ? replayFile(id).replace(/\.json\.gz$/, ".full.json.gz") : replayFile(id);
      if (!fs.existsSync(file)) { fs.unlinkSync(replayFile(id)); return send(res, 200, wantReplay(id)); }
      res.writeHead(200, { "content-type": "application/json", "content-encoding": "gzip", "cache-control": "private, no-cache" });   // a rollback can make a battle again under the same id
      return res.end(fs.readFileSync(file));
    }
    send(res, 404, { error: "not found" });
  } catch (e) { send(res, 400, { error: e.message }); }
});
// ---- the admin's undo: the last tick goes, with the orders given since (they were for the turn after it); joins
// since are kept. What's removed is saved in DATA_DIR/rolledback/, the replays of that turn's battles are deleted
// (their ids will be reused), and the clock gives a full turn again
function rollback() {
  let i = events.length - 1;
  while (i >= 0 && events[i].type !== "tick") i--;
  if (i < 0) return { error: "no turn to roll back" };
  const turn = S.turn, removed = events.slice(i), kept = events.slice(0, i).concat(removed.filter(e => e.type === "join"));
  const dir = path.join(DATA, "rolledback"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `turn-${turn}-${Date.now()}.jsonl`), removed.map(e => JSON.stringify(e) + "\n").join(""));
  const gone = S.reports.filter(r => r.turn === turn).map(r => r.id);
  stopReplays(gone);
  events.length = 0; events.push(...kept); rewriteLog(); S = rebuild(events);
  record({ type: "notice", text: `Turn ${turn} was rolled back by the war's admin: give your orders again` });
  adm.dueAt = Date.now() + TURN; saveAdm(); schedule();
  return { rolledBack: turn, removedEvents: removed.length - removed.filter(e => e.type === "join").length };
}
// forget replays (all, or these ids): files, queue, and a worker busy on one of them
function stopReplays(ids) {
  const drop = id => !ids || ids.includes(id);
  for (const id of [...jobs.keys()]) if (drop(id)) jobs.delete(id);
  for (let k = queue.length - 1; k >= 0; k--) if (drop(queue[k])) queue.splice(k, 1);
  if (busy && drop(busy)) { if (worker) worker.terminate(); worker = null; busy = null; }
  for (const f of fs.readdirSync(REPLAYS)) if (drop(f.replace(/(\.full)?\.json\.gz$/, ""))) fs.unlinkSync(path.join(REPLAYS, f));
  nextReplay();
}
// a new war: this one's log, replays and tokens go to DATA_DIR/archive/war-<when>/, accounts are freed to join again,
// and a fresh galaxy is made (the bots join it again)
function newWar() {
  const was = S.turn, dir = path.join(DATA, "archive", `war-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(dir, { recursive: true });
  stopReplays(null);
  if (fs.existsSync(LOG)) fs.renameSync(LOG, path.join(dir, "events.jsonl"));
  if (fs.existsSync(TOKENS)) fs.renameSync(TOKENS, path.join(dir, "tokens.json"));
  tokens = {}; auth.unbindAll();
  events.length = 0; S = null;
  record({ type: "create", seed: crypto.randomInt(2 ** 31) });
  botsJoin();
  adm.paused = false; adm.dueAt = null; saveAdm(); schedule();
  return { archived: path.relative(DATA, dir), endedAtTurn: was };
}

// ---- backups: once a day (and at start), a copy of the event log in DATA_DIR/backups, the newest KEEP_BACKUPS
// kept. The log is the whole war; the volume's own snapshots are the second line, an off-site copy the third
const BACKUPS = path.join(DATA, "backups");
function backup() {
  if (!KEEP_BACKUPS || !fs.existsSync(LOG)) return;
  fs.mkdirSync(BACKUPS, { recursive: true });
  const name = `events-${new Date().toISOString().slice(0, 10)}.jsonl`;
  fs.copyFileSync(LOG, path.join(BACKUPS, name));
  if (fs.existsSync(TOKENS)) fs.copyFileSync(TOKENS, path.join(BACKUPS, "tokens.json"));
  if (fs.existsSync(auth.files[0])) fs.copyFileSync(auth.files[0], path.join(BACKUPS, "accounts.json"));   // which account leads which warband
  const all = fs.readdirSync(BACKUPS).filter(f => /^events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
  for (const f of all.slice(0, Math.max(0, all.length - KEEP_BACKUPS))) fs.unlinkSync(path.join(BACKUPS, f));
}
// for tests and a clean shutdown: no clock, no replay worker
function stop() { clearTimeout(timer); if (worker) worker.terminate(); worker = null; }
module.exports = { server, schedule, stop, state: () => S, wantReplay, auth, events };
if (require.main === module) {
  botsJoin();
  schedule();
  try { backup(); } catch (e) { console.error("backup failed:", e.message); }
  setInterval(() => { try { backup(); } catch (e) { console.error("backup failed:", e.message); } }, 24 * 3600 * 1000).unref();
  server.listen(PORT, () => console.log(`the war is on http://localhost:${PORT} (turn ${S.turn}, a tick every ${TURN / 1000} s)`));
  // the host stops the machine with SIGTERM (a deploy, a restart): every input is already on disk, so just stop
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { console.log(`${sig}: stopping`); stop(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
}
