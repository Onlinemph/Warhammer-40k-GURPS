// The server end to end: join, view, orders, an admin tick, and the log on disk rebuilding the same state.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");

test("the server: join, see, order, tick, and survive a restart", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "war-"));
  process.env.DATA_DIR = dir; process.env.ADMIN_KEY = "k"; process.env.TURN_SECONDS = "3600";
  delete require.cache[require.resolve("../server.js")];
  const { server, state } = require("../server.js");
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, body, h = {}) => { const r = await fetch(base + p, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...h }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json()]; };
  try {
    assert.equal((await call("/api/view"))[0], 401);
    assert.equal((await call("/api/join", { name: "x", faction: "hegemony" }))[0], 400);
    assert.equal((await call("/api/join", { name: "Varro", faction: "chorus" }))[0], 400);
    const [c, { token }] = await call("/api/join", { name: "Varro", faction: "hegemony" });
    assert.equal(c, 200);
    const auth = { authorization: "Bearer " + token };
    const [, v] = await call("/api/view", null, auth);
    assert.equal(v.you.name, "Varro");
    const here = v.worlds.find(w => w.id === v.you.warband.at);
    assert.equal((await call("/api/orders", { move: "nowhere" }, auth))[0], 400);
    assert.equal((await call("/api/orders", { move: here.links[0], recruit: [{ unit: "levy", count: 3 }] }, auth))[0], 200);
    assert.equal((await call("/api/admin/tick", {}, { "x-admin-key": "nope" }))[0], 403);
    const [, t] = await call("/api/admin/tick", {}, { "x-admin-key": "k" });
    assert.equal(t.turn, 1);
    const [, v2] = await call("/api/view", null, auth);
    assert.equal(v2.you.warband.at, here.links[0]);
    // the log alone rebuilds the state
    const { rebuild } = require("../world/rules.js");
    const ev = fs.readFileSync(path.join(dir, "events.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
    assert.deepEqual(rebuild(ev), state());
    assert.ok(!fs.readFileSync(path.join(dir, "events.jsonl"), "utf8").includes(token), "no secrets in the log");
  } finally { server.closeAllConnections(); server.close(); }
});
