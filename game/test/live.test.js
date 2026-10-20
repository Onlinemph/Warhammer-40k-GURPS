// Battles fought live: held open at the tick for a commander, fought on the server's engine one answer at a time, the
// result applied at the next tick; or, unfought, settled by the resolver there.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { apply, rebuild, order } = require("../world/rules.js");

const quiet = S => { S.swarms = []; for (const w of Object.values(S.worlds)) if (w.owner === "chorus" || w.owner === "dormant") w.garrison = {}; return S; };

test("a commanded battle is held: the warband stays put, the world isn't taken, and an unfought one is settled at the next tick", () => {
  let S = quiet(rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }]));
  const wb = S.players.h.warband, here = S.worlds[wb.at], to = S.worlds[here.links.find(l => S.worlds[l].owner !== "hegemony") || here.links[0]];
  Object.assign(to, { owner: null, tomb: false, garrison: { militia: 8 } });
  wb.army = { levy: 40, storm: 4 };
  S = apply(S, { type: "order", player: "h", move: to.id, recruit: [], command: true });
  S = quiet(apply(S, { type: "tick", seed: 1 }));
  assert.equal(S.held.length, 1);
  const h = S.held[0];
  assert.equal(h.commanders.filter(Boolean)[0], "h");
  assert.equal(S.players.h.warband.heldIn, h.id);
  assert.equal(S.worlds[to.id].owner, null, "not taken while it waits");
  assert.equal(S.reports.filter(r => r.world === to.id).length, 0);
  assert.match(order(S, { player: "h", move: here.id }), /held in the battle/);
  assert.ok(S.log.some(l => /waits for its commander: Varro/.test(l.text)));
  // nobody fought it: the next tick settles it
  S = quiet(apply(S, { type: "tick", seed: 2 }));
  assert.equal(S.held.length, 0);
  assert.equal(S.players.h.warband.heldIn, null);
  const rep = S.reports.find(r => r.world === to.id);
  assert.ok(rep && !rep.live, "settled by the resolver");
});

test("fought live through the server: answers in order from the side it waits on, the result applied at the next tick", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "war-live-"));
  Object.assign(process.env, { DATA_DIR: dir, ADMIN_KEY: "k", TURN_SECONDS: "3600" });
  for (const k of ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "BOTS", "PUBLIC_URL"]) delete process.env[k];
  delete require.cache[require.resolve("../server.js")];
  const { server, state, stop } = require("../server.js");
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, body, h = {}) => { const r = await fetch(base + p, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...h }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json()]; };
  try {
    const [, { token }] = await call("/api/join", { name: "Varro", faction: "hegemony" });
    const [, { token: t2 }] = await call("/api/join", { name: "Gut", faction: "brawl" });
    const me = { authorization: "Bearer " + token }, other = { authorization: "Bearer " + t2 };
    // a small fight next door (set up on the server's state directly, for the test)
    const S = quiet(state()), p = Object.values(S.players).find(x => x.name === "Varro"), here = S.worlds[p.warband.at];
    const to = S.worlds[here.links.find(l => S.worlds[l].owner !== "hegemony") || here.links[0]];
    Object.assign(to, { owner: null, tomb: false, garrison: { militia: 4 } });
    p.warband.army = { levy: 12 };
    assert.equal((await call("/api/orders", { move: to.id, recruit: [], command: true }, me))[0], 200);
    await call("/api/admin/tick", {}, { "x-admin-key": "k" });
    const h = state().held[0];
    assert.ok(h, "held");
    const [, B] = await call("/api/live/" + h.id, null, me);
    assert.equal(B.you, h.commanders.indexOf(p.id));
    assert.equal(B.waitingOn, B.you);
    assert.equal((await call("/api/live/" + h.id, null, other))[0], 400, "not the other faction's to see");
    assert.match((await call(`/api/live/${h.id}/answer`, { k: 5, ans: null }, me))[1].error, /out of step/);
    // answer every stop with the AI's own choice, until it's over
    let k = 0, r;
    do { [, r] = await call(`/api/live/${h.id}/answer`, { k, ans: null }, me); k++; } while (r.ok && !r.done && k < 5000);
    assert.ok(r.done, "the battle ended");
    assert.ok(state().held[0].result, "its result is in the log");
    const ev = fs.readFileSync(path.join(dir, "events.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse).filter(e => e.type === "live");
    assert.equal(ev.length, 1);
    await call("/api/admin/tick", {}, { "x-admin-key": "k" });
    const rep = state().reports.find(x => x.held === h.id);
    assert.ok(rep && rep.live && /Fought live by Varro/.test(rep.text));
    assert.equal(rep.winner === "hegemony" ? 0 : rep.winner == null ? -1 : 1, ev[0].winner === -1 ? -1 : ev[0].winner);
  } finally { stop(); server.closeAllConnections(); server.close(); }
});

test("a held battle settles only the forces that were in it: a warband arriving meanwhile isn't touched by its result", () => {
  let S = quiet(rebuild([{ type: "create", seed: 7 }, { type: "join", player: "h", name: "Varro", faction: "hegemony" }, { type: "join", player: "g", name: "Gaius", faction: "hegemony" }]));
  const wb = S.players.h.warband, here = S.worlds[wb.at], to = S.worlds[here.links.find(l => S.worlds[l].owner !== "hegemony") || here.links[0]];
  Object.assign(to, { owner: null, tomb: false, garrison: { militia: 8 } });
  wb.army = { levy: 20 };
  S.players.g.warband.army = { warden: 6 }; S.players.g.warband.at = here.id;
  S = apply(S, { type: "order", player: "h", move: to.id, recruit: [], command: true });
  S = quiet(apply(S, { type: "tick", seed: 1 }));
  const h = S.held[0];
  // Gaius marches in while it waits; the battle is lost live, everyone in it dead
  S = apply(S, { type: "order", player: "g", move: to.id, recruit: [] });
  S = apply(S, { type: "live", id: h.id, winner: h.factions[0] === "hegemony" ? 1 : 0, losses: h.factions[0] === "hegemony" ? [1, 0] : [0, 1] });
  S = quiet(apply(S, { type: "tick", seed: 2 }));
  const rep = S.reports.find(r => r.held === h.id);
  assert.ok(rep && rep.live);
  assert.equal(rep.sides.find(s => s.faction === "hegemony").before.warden, undefined, "the Wardens weren't in it");
  assert.ok((S.players.g.warband.army.warden || 0) > 0 || S.reports.some(r => r.world === to.id && r !== rep), "Gaius fought on his own, or not at all");
});
