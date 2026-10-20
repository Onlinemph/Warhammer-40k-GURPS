// Accounts: sign-in with Discord or Google (OAuth 2.0 authorization code flow with PKCE), and a session cookie.
// Node's standard library and fetch only.
//
// A player's warband belongs to an account, not to a browser: sign in anywhere and it's there. What's kept, in
// DATA_DIR (never in the event log, which holds no secrets and no personal data):
//   accounts.json  account id -> { player, provider, created }. The account id is a hash of the provider's
//                  user id ("discord:1234..."), so the file names nobody; nothing else from the profile is kept
//   sessions.json  hash of the session secret -> { account, expires }. The secret itself is only in the cookie
//
// Configuration (a provider is offered only when both its id and secret are set):
//   PUBLIC_URL                      the address players use, e.g. https://galactic-war.fly.dev (the redirect URIs
//                                   are PUBLIC_URL/auth/discord/callback and PUBLIC_URL/auth/google/callback)
//   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const SESSION_DAYS = 30, STATE_MINUTES = 10, COOKIE = "war_session", FLOW = "war_signin";
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const b64url = buf => buf.toString("base64url");

function makeAuth({ dataDir, env = process.env }) {
  const ACCOUNTS = path.join(dataDir, "accounts.json"), SESSIONS = path.join(dataDir, "sessions.json");
  const load = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  // written to a temporary file and renamed, so a crash mid-write never leaves half a file
  const save = (f, o) => { fs.writeFileSync(f + ".tmp", JSON.stringify(o)); fs.renameSync(f + ".tmp", f); };
  const accounts = load(ACCOUNTS), sessions = load(SESSIONS);
  const publicUrl = String(env.PUBLIC_URL || "").replace(/\/+$/, "");
  const secure = publicUrl.startsWith("https://");

  // what each provider needs; the URLs can be swapped (the tests point them at a stand-in server)
  const providers = {
    discord: {
      name: "Discord", id: env.DISCORD_CLIENT_ID, secret: env.DISCORD_CLIENT_SECRET, scope: "identify",
      authUrl: "https://discord.com/oauth2/authorize", tokenUrl: "https://discord.com/api/oauth2/token",
      userUrl: "https://discord.com/api/users/@me", userId: u => u.id,
    },
    google: {
      name: "Google", id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET, scope: "openid",
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token",
      userUrl: "https://openidconnect.googleapis.com/v1/userinfo", userId: u => u.sub,
    },
  };
  const enabled = () => Object.entries(providers).filter(([, p]) => p.id && p.secret).map(([k, p]) => ({ id: k, name: p.name }));

  // sign-ins under way: state -> { provider, verifier, at }. In memory: a restart only loses logins in progress
  const pending = new Map();
  const sweep = () => { const now = Date.now(); for (const [k, v] of pending) if (now - v.at > STATE_MINUTES * 60000) pending.delete(k); };

  // step 1: send the browser to the provider, with a one-time state and a PKCE challenge. The state also goes in a
  // short-lived cookie, so the way back only works in the browser that set out (else a link with someone else's
  // code would sign a player in as them)
  function begin(provider) {
    const p = providers[provider];
    if (!p || !p.id || !p.secret) return null;
    sweep();
    const state = b64url(crypto.randomBytes(24)), verifier = b64url(crypto.randomBytes(32));
    pending.set(state, { provider, verifier, at: Date.now() });
    const q = new URLSearchParams({
      client_id: p.id, redirect_uri: `${publicUrl}/auth/${provider}/callback`, response_type: "code", scope: p.scope,
      state, code_challenge: b64url(crypto.createHash("sha256").update(verifier).digest()), code_challenge_method: "S256",
    });
    return { url: `${p.authUrl}?${q}`, cookie: `${FLOW}=${state}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=${STATE_MINUTES * 60}${secure ? "; Secure" : ""}` };
  }

  // step 2: the provider sends the browser back with a code; trade it for the user's id, then open a session
  async function finish(provider, { code, state, error }, req) {
    const p = providers[provider], mine = req && new RegExp(`(?:^|;\\s*)${FLOW}=([\\w-]+)`).exec(req.headers.cookie || "");
    const ps = state && mine && mine[1] === state && pending.get(state);
    if (state) pending.delete(state);
    if (error) throw new Error(error === "access_denied" ? "sign-in was cancelled" : "the provider refused: " + error);
    if (!p || !ps || ps.provider !== provider || Date.now() - ps.at > STATE_MINUTES * 60000) throw new Error("that sign-in link has expired; try again");
    if (!code) throw new Error("no code from the provider");
    const tr = await fetch(p.tokenUrl, { signal: AbortSignal.timeout(10000),
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${publicUrl}/auth/${provider}/callback`, client_id: p.id, client_secret: p.secret, code_verifier: ps.verifier }),
    });
    const tok = await tr.json().catch(() => ({}));
    if (!tr.ok || !tok.access_token) throw new Error("the provider wouldn't confirm the sign-in");
    const ur = await fetch(p.userUrl, { signal: AbortSignal.timeout(10000), headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/json" } });
    const user = await ur.json().catch(() => ({}));
    const uid = ur.ok && p.userId(user);
    if (!uid) throw new Error("the provider didn't say who you are");
    const account = sha(`${provider}:${uid}`);
    if (!accounts[account]) { accounts[account] = { player: null, provider, created: Date.now() }; save(ACCOUNTS, accounts); }
    return openSession(account);
  }

  function openSession(account) {
    const now = Date.now();
    for (const [k, s] of Object.entries(sessions)) if (s.expires < now) delete sessions[k];
    const secret = b64url(crypto.randomBytes(32));
    sessions[sha(secret)] = { account, expires: now + SESSION_DAYS * 86400000 };
    save(SESSIONS, sessions);
    return secret;
  }
  const cookieHeader = secret => `${COOKIE}=${secret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${secret ? SESSION_DAYS * 86400 : 0}${secure ? "; Secure" : ""}`;
  const clearFlow = `${FLOW}=; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
  const cookieOf = req => { const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([\\w-]+)`).exec(req.headers.cookie || ""); return m ? m[1] : null; };

  // the account behind a request, or null
  function accountOf(req) {
    const c = cookieOf(req); if (!c) return null;
    const s = sessions[sha(c)];
    if (!s || s.expires < Date.now()) return null;
    return s.account;
  }
  function signOut(req) {
    const c = cookieOf(req); if (!c) return;
    if (sessions[sha(c)]) { delete sessions[sha(c)]; save(SESSIONS, sessions); }
  }
  const playerOf = account => (account && accounts[account] && accounts[account].player) || null;
  function bind(account, player) { accounts[account].player = player; save(ACCOUNTS, accounts); }
  // a new war: every account is free to raise a warband again
  function unbindAll() { for (const a of Object.values(accounts)) a.player = null; save(ACCOUNTS, accounts); }

  return { providers, enabled, begin, finish, clearFlow, accountOf, playerOf, bind, unbindAll, signOut, cookieHeader, openSession, files: [ACCOUNTS, SESSIONS] };
}

module.exports = { makeAuth };
