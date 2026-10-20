// Sign-in end to end, against a stand-in for Discord that checks what a real provider checks (the client secret,
// the redirect URI, the PKCE verifier against its challenge, a code used once).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http"), crypto = require("crypto");

test("sign-in: a warband belongs to an account, on any browser, and the log holds no account", async () => {
  // the stand-in provider: a code for a user, given out once, redeemable only with the matching verifier
  const codes = new Map(), access = new Map();
  let userId = "4242";
  const fake = http.createServer((req, res) => {
    let b = ""; req.on("data", c => b += c);
    req.on("end", () => {
      const json = (code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
      if (req.url === "/token") {
        const f = new URLSearchParams(b), c = codes.get(f.get("code"));
        codes.delete(f.get("code"));
        const challenge = f.get("code_verifier") && crypto.createHash("sha256").update(f.get("code_verifier")).digest("base64url");
        if (!c || f.get("client_secret") !== "shh" || f.get("redirect_uri") !== c.redirect || challenge !== c.challenge) return json(400, { error: "invalid_grant" });
        const t = crypto.randomBytes(8).toString("hex"); access.set(t, c.user); return json(200, { access_token: t, token_type: "Bearer" });
      }
      if (req.url === "/me") { const u = access.get((req.headers.authorization || "").slice(7)); return u ? json(200, { id: u, username: "someone" }) : json(401, {}); }
      json(404, {});
    });
  });
  await new Promise(r => fake.listen(0, r));
  const fakeBase = `http://127.0.0.1:${fake.address().port}`;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "war-auth-"));
  Object.assign(process.env, { DATA_DIR: dir, ADMIN_KEY: "k", TURN_SECONDS: "3600", DISCORD_CLIENT_ID: "cid", DISCORD_CLIENT_SECRET: "shh", PUBLIC_URL: "http://war.test" });
  delete process.env.ALLOW_DEV_JOIN;
  delete require.cache[require.resolve("../server.js")];
  const { server, stop, auth } = require("../server.js");
  Object.assign(auth.providers.discord, { authUrl: fakeBase + "/authorize", tokenUrl: fakeBase + "/token", userUrl: fakeBase + "/me" });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, body, h = {}) => { const r = await fetch(base + p, { method: body ? "POST" : "GET", redirect: "manual", headers: { "content-type": "application/json", ...h }, body: body ? JSON.stringify(body) : undefined }); return [r.status, r.headers.get("content-type") === "application/json" ? await r.json() : null, r]; };
  // what the browser does: off to the provider, the user says yes, back with a code
  async function signIn(finish = true) {
    const [c, , r] = await call("/auth/discord");
    assert.equal(c, 302);
    const flow = r.headers.get("set-cookie").split(";")[0];
    assert.match(flow, /^war_signin=/);
    const to = new URL(r.headers.get("location"));
    assert.equal(to.origin + to.pathname, fakeBase + "/authorize");
    assert.equal(to.searchParams.get("client_id"), "cid");
    assert.equal(to.searchParams.get("code_challenge_method"), "S256");
    const code = crypto.randomBytes(6).toString("hex");
    codes.set(code, { user: userId, redirect: to.searchParams.get("redirect_uri"), challenge: to.searchParams.get("code_challenge") });
    assert.equal(to.searchParams.get("redirect_uri"), "http://war.test/auth/discord/callback");
    if (!finish) return { link: `/auth/discord/callback?code=${code}&state=${to.searchParams.get("state")}`, flow };
    const [c2, , r2] = await call(`/auth/discord/callback?code=${code}&state=${to.searchParams.get("state")}`, null, { cookie: flow });
    assert.equal(c2, 302); assert.equal(r2.headers.get("location"), "/");
    const set = r2.headers.get("set-cookie").split(/,\s*(?=war_)/).find(c => c.startsWith("war_session="));
    assert.match(set, /HttpOnly/); assert.match(set, /SameSite=Lax/);
    return { cookie: set.split(";")[0], state: to.searchParams.get("state"), code, flow };
  }
  try {
    let [, me] = await call("/api/me");
    assert.deepEqual({ ...me, factions: undefined }, { providers: [{ id: "discord", name: "Discord" }], devJoin: false, signedIn: false, joined: false, factions: undefined });
    assert.deepEqual(me.factions.map(f => f.id), ["hegemony", "apostates", "brawl"]);
    assert.equal((await call("/auth/nowhere"))[0], 404);
    // with sign-in set up there's no development join
    assert.equal((await call("/api/join", { name: "Varro", faction: "hegemony" }))[0], 401);

    const s1 = await signIn(), h1 = { cookie: s1.cookie };
    [, me] = await call("/api/me", null, h1);
    assert.equal(me.signedIn, true); assert.equal(me.joined, false);
    assert.equal((await call("/api/view", null, h1))[0], 401);
    const [jc, jb] = await call("/api/join", { name: "Varro", faction: "hegemony" }, h1);
    assert.equal(jc, 200); assert.deepEqual(jb, { ok: true });
    assert.equal((await call("/api/join", { name: "Varro II", faction: "brawl" }, h1))[0], 400, "one warband an account");
    const [, v] = await call("/api/view", null, h1);
    assert.equal(v.you.name, "Varro");

    // a state or a code is good once
    const [, , replayed] = await call(`/auth/discord/callback?code=${s1.code}&state=${s1.state}`, null, { cookie: s1.flow });
    assert.match(replayed.headers.get("location"), /^\/\?signin=.*expired/);
    assert.ok(!/war_session=\w/.test(replayed.headers.get("set-cookie") || ""));
    // someone else's half-finished sign-in, sent as a link: no good in a browser that didn't start it
    const theirs = await signIn(false);
    const [, , forged] = await call(theirs.link, null, h1);
    assert.match(forged.headers.get("location"), /^\/\?signin=/);
    assert.ok(!/war_session=\w/.test(forged.headers.get("set-cookie") || ""));
    const [, , cancelled] = await call("/auth/discord/callback?error=access_denied&state=x");
    assert.match(decodeURIComponent(cancelled.headers.get("location")), /cancelled/);

    // a POST from another site is refused, cookie or not
    assert.equal((await call("/api/orders", { move: null }, { ...h1, origin: "https://evil.example" }))[0], 403);
    assert.equal((await call("/api/orders", { move: null }, { ...h1, origin: base }))[0], 200);

    // sign out: the session is gone
    assert.equal((await call("/auth/logout", {}, h1))[0], 200);
    assert.equal((await call("/api/view", null, h1))[0], 401);
    // sign in again, as from another browser: the same warband
    const s2 = await signIn();
    assert.notEqual(s2.cookie, s1.cookie);
    assert.equal((await call("/api/view", null, { cookie: s2.cookie }))[1].you.name, "Varro");
    // someone else gets their own
    userId = "777";
    const s3 = await signIn();
    assert.equal((await call("/api/me", null, { cookie: s3.cookie }))[1].joined, false);

    // nothing about accounts or sessions in the log, and no session secret on disk
    const log = fs.readFileSync(path.join(dir, "events.jsonl"), "utf8");
    assert.ok(!log.includes("4242") && !log.includes("discord") && !log.includes(s2.cookie.split("=")[1]));
    const disk = fs.readFileSync(path.join(dir, "accounts.json"), "utf8") + fs.readFileSync(path.join(dir, "sessions.json"), "utf8");
    assert.ok(!disk.includes("4242"), "the provider's user id isn't stored");
    assert.ok(!disk.includes(s2.cookie.split("=")[1]), "nor a session secret");
  } finally { stop(); server.closeAllConnections(); server.close(); fake.closeAllConnections(); fake.close(); }
});
