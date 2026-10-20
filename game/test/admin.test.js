// The admin's tools end to end: pause and resume, rolling back a turn, and starting a new war.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");

test("admin: pause, resume, roll back a turn, start a new war; each logged, and the log still rebuilds the war", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "war-admin-"));
  Object.assign(process.env, { DATA_DIR: dir, ADMIN_KEY: "k", TURN_SECONDS: "3600" });
  for (const k of ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "BOTS", "PUBLIC_URL"]) delete process.env[k];
  delete require.cache[require.resolve("../server.js")];
  const { server, state, stop, events } = require("../server.js");
  const { rebuild } = require("../world/rules.js");
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, body, h = {}) => { const r = await fetch(base + p, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...h }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json()]; };
  const A = { "x-admin-key": "k" };
  try {
    assert.equal((await call("/api/admin/status"))[0], 403);
    assert.equal((await call("/api/admin/tick", {}, { "x-admin-key": "wrong" }))[0], 403);
    const [, { token }] = await call("/api/join", { name: "Varro", faction: "hegemony" });
    const me = { authorization: "Bearer " + token };
    assert.equal((await call("/api/admin/tick", {}, A))[1].turn, 1);
    // pause: everyone sees it, and there's no next tick until the resume, which gives a full turn
    let [, st] = await call("/api/admin/pause", {}, A);
    assert.equal(st.paused, true);
    let [, v] = await call("/api/view", null, me);
    assert.equal(v.paused, true); assert.equal(v.nextTick, null);
    assert.ok(v.news.some(n => /paused/.test(n.text)));
    [, st] = await call("/api/admin/resume", {}, A);
    assert.equal(st.paused, false); assert.ok(st.nextTick > Date.now() + 3500 * 1000);
    // roll back turn 2: its battles go, an order given after it goes, the news says so
    await call("/api/admin/tick", {}, A);
    assert.equal(state().turn, 2);
    const reports2 = state().reports.filter(r => r.turn === 2).length;
    const here = (await call("/api/view", null, me))[1].you.warband.at;
    await call("/api/orders", { move: null, recruit: [{ unit: "levy", count: 2 }] }, me);
    const [c, rb] = await call("/api/admin/rollback", {}, A);
    assert.equal(c, 200); assert.equal(rb.rolledBack, 2); assert.equal(rb.turn, 1);
    assert.equal(state().players[Object.keys(state().players)[0]].warband.orders, null, "the order given after the tick went with it");
    assert.equal(state().reports.filter(r => r.turn === 2).length, 0);
    assert.ok(reports2 >= 0 && here);
    assert.ok(fs.readdirSync(path.join(dir, "rolledback")).length === 1);
    v = (await call("/api/view", null, me))[1];
    assert.ok(v.news.some(n => /Turn 2 was rolled back/.test(n.text)));
    // the log on disk rebuilds exactly what the server holds
    const disk = fs.readFileSync(path.join(dir, "events.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
    assert.deepEqual(rebuild(disk), state());
    assert.equal(disk.length, events.length);
    // a new war: the old one archived, the token no longer good, turn 0
    const [, nw] = await call("/api/admin/newwar", {}, A);
    assert.equal(nw.turn, 0); assert.equal(nw.endedAtTurn, 1);
    assert.ok(fs.existsSync(path.join(dir, nw.archived, "events.jsonl")));
    assert.equal((await call("/api/view", null, me))[0], 401);
    assert.equal(Object.keys(state().players).length, 0);
    // every action in the admin log
    const log = fs.readFileSync(path.join(dir, "admin-log.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse).map(e => e.action);
    assert.deepEqual(log, ["tick", "pause", "resume", "tick", "rollback", "newwar"]);
  } finally { stop(); server.closeAllConnections(); server.close(); }
});
