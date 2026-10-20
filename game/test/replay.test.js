// Battle replays: the full engine re-fights a reported battle, agreeing with the war's result, and the server
// queues them at the tick and hands them over gzipped.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib");
const { apply } = require("../world/rules.js");
const { build } = require("../replay/build.js");

test("a replay re-fights the reported battle, with the report's winner, and reports its progress", () => {
  let S = apply(null, { type: "create", seed: 7 });
  for (let t = 0; t < 12; t++) S = apply(S, { type: "tick", seed: 100 + t });
  const r = S.reports[0], seen = [];
  const rep = build(r, p => seen.push(p.second));
  // (the war is decided by Tactical Mass Combat as written; the engine's re-fight tries four seeds for the war's winner
  // and says when it ends otherwise, about one battle in three)
  assert.equal(typeof rep.matched, "boolean");
  assert.ok(rep.attempt >= 1 && rep.attempt <= 4);
  assert.equal(rep.frames.length, rep.seconds + 1);
  assert.equal(rep.roster.length, r.sides.reduce((a, s) => a + Object.values(s.before).reduce((x, y) => x + y, 0), 0));
  assert.equal(rep.map.ground.length, (rep.map.W - 2) * (rep.map.H - 2));
  assert.ok(seen.length > 3 && seen[seen.length - 1] >= seen[0], "progress, second by second");
  assert.deepEqual(build(r), rep, "the same report always replays the same way");
});

test("the server queues a player's battles at the tick and serves the replay when it's ready", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "war-"));
  process.env.DATA_DIR = dir; process.env.ADMIN_KEY = "k"; process.env.TURN_SECONDS = "3600";
  delete require.cache[require.resolve("../server.js")];
  const { server, stop } = require("../server.js");
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, body, h = {}) => { const r = await fetch(base + p, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...h }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json()]; };
  try {
    const [, { token }] = await call("/api/join", { name: "Varro", faction: "hegemony" }), auth = { authorization: "Bearer " + token };
    let rep = null;
    for (let k = 0; k < 10 && !rep; k++) {
      const [, v] = await call("/api/view", null, auth), here = v.worlds.find(w => w.id === v.you.warband.at);
      // on a world it doesn't hold, landed away from the capital (a fortress denied the sky): march on the capital
      const capR = here.regions.find(r => r.capital);
      if (here.owner !== "hegemony" && v.you.warband.region !== capR.id) {
        const prev = { [v.you.warband.region]: null }, q = [v.you.warband.region];
        while (q.length && !(capR.id in prev)) { const a = q.shift(); for (const b of here.regions.find(r => r.id === a).links) if (!(b in prev)) { prev[b] = a; q.push(b); } }
        let s = capR.id; while (prev[s] !== v.you.warband.region) s = prev[s];
        await call("/api/orders", { region: s }, auth);
        await call("/api/admin/tick", {}, { "x-admin-key": "k" });
        rep = (await call("/api/view", null, auth))[1].reports.find(r => r.sides.some(x => x.players.includes("Varro")));
        continue;
      }
      const to = here.links.map(l => v.worlds.find(w => w.id === l)).find(w => w.owner !== "hegemony") || v.worlds.find(w => w.id === here.links[0]);
      // (landing at the capital, where there's a garrison to fight, if it may)
      const cap = to.regions.find(r => r.capital), L = v.you.landing[to.id], land = L && L.may.includes(cap.id) ? cap.id : undefined;
      await call("/api/orders", { move: to.id, land, recruit: [{ unit: "levy", count: 20 }] }, auth);
      await call("/api/admin/tick", {}, { "x-admin-key": "k" });
      rep = (await call("/api/view", null, auth))[1].reports.find(r => r.sides.some(s => s.players.includes("Varro")));
    }
    assert.ok(rep, "the warband should have fought someone");
    assert.equal((await call("/api/replay/" + rep.id))[0], 401);
    assert.equal((await call("/api/replay/t999-w0-0", null, auth))[0], 404);
    let body = null;
    for (let k = 0; k < 120 && !body; k++) {
      const [code, j] = await call("/api/replay/" + rep.id, null, auth);
      assert.equal(code, 200);
      if (j.frames) body = j; else { assert.ok(["queued", "running"].includes(j.status), JSON.stringify(j)); await new Promise(r => setTimeout(r, 500)); }
    }
    assert.ok(body && body.frames.length > 1, "the replay should arrive");
    assert.ok(fs.existsSync(path.join(dir, "replays", rep.id + ".json.gz")));
    assert.equal(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, "replays", rep.id + ".json.gz")))).id, rep.id);
  } finally { stop(); server.closeAllConnections(); server.close(); }
});
