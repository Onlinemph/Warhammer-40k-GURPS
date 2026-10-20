# Deploying the war

The war server is one long-running Node process. It needs three things a serverless host can't give it: to stay
up between requests (the turns tick on a timer), a disk that survives restarts (the event log *is* the war), and
worker threads (battle replays). So: one small always-on machine with a persistent volume.

**Recommended: Fly.io.** One always-on machine with a volume attached, HTTPS and a `*.fly.dev` address out of the
box, daily volume snapshots, and `fly deploy` from this repository. A shared 1-CPU, 1 GB machine with a 1 GB
volume costs a few dollars a month (see fly.io/pricing). **Alternative: any small VPS** (Hetzner, DigitalOcean and
the like) with Docker, using `docker-compose.yml` here: cheaper at scale and fully yours, but you look after the
server.

Run exactly one copy of the server. Two would each keep their own log and the war would fork.

## Fly.io

```sh
# once: install flyctl (https://fly.io/docs/flyctl/install/) and sign in
fly auth login

# edit fly.toml: set `app` to a name of your own and `primary_region` to the region nearest your players
# (fly platform regions lists them), then, from the repository root:
fly apps create <your-app-name>
fly volumes create war_data --size 1 --region <region>
fly secrets set ADMIN_KEY="$(openssl rand -hex 24)"     # keep a copy: it's what lets you tick by hand
# set PUBLIC_URL in fly.toml to https://<your-app-name>.fly.dev, and the sign-in secrets (Sign-in, below)
fly deploy
```

The war is then at `https://<your-app-name>.fly.dev`. For your own domain: `fly certs add war.example.com`, and
point the DNS records it prints at the app.

`fly.toml` keeps the machine running (`auto_stop_machines = "off"`, `min_machines_running = 1`): a stopped
machine would miss its ticks. Turns are 12 hours (`TURN_SECONDS`); change it there and `fly deploy` again.

**Updating** is `fly deploy`. The machine restarts and rebuilds the war from its log. Replays already made are
kept; battles replayed after an engine change are fought by the new engine.

**Ticking by hand** (a test war on fast turns, or to catch up after an outage):

```sh
curl -X POST -H "x-admin-key: <your ADMIN_KEY>" https://<your-app-name>.fly.dev/api/admin/tick
```

**Watching it:** `fly logs` for the server's output; `https://<your-app-name>.fly.dev/healthz` gives the turn and
player count (Fly polls it every 30 seconds and restarts a machine that stops answering).

## Sign-in

Players sign in with Discord or Google; a warband belongs to the account, so it's there on any device. Set up one
provider or both: the server offers whichever has its id and secret set. Every redirect URI below starts with the
server's `PUBLIC_URL` exactly (scheme, host, no trailing slash).

**Discord.** At https://discord.com/developers/applications make a New Application, open OAuth2, copy the Client ID,
reset and copy the Client Secret, and add the redirect `https://<your address>/auth/discord/callback`. Only the
`identify` scope is asked for.

**Google.** At https://console.cloud.google.com make a project; under APIs & Services, set up the OAuth consent
screen (External; only the `openid` scope), then Credentials, Create credentials, OAuth client ID, Web application,
with the authorized redirect URI `https://<your address>/auth/google/callback`. While the consent screen is in
Testing, only the Google accounts listed as test users can sign in: add the testers, or publish it.

Then give the server the four values:

```sh
fly secrets set DISCORD_CLIENT_ID=... DISCORD_CLIENT_SECRET=... GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
```

(on a VPS, the same four lines in `deploy/.env`). Once a provider is set up the development join is off, unless
`ALLOW_DEV_JOIN=1`; warbands that joined that way keep working from the browser that made them.

What's stored, in the data directory and never in the event log: `accounts.json`, each account as a hash of the
provider's user id with the player it leads (nothing else from the profile is asked for or kept), and
`sessions.json`, each session as a hash of the cookie's secret, for 30 days. The cookie is HttpOnly, SameSite=Lax and
Secure over HTTPS, and the server refuses a POST that comes from another site. One account leads one warband a war.

## Backups

Three copies, each a step further away:

1. **On the volume:** the server copies the event log to `/data/backups/events-<date>.jsonl` at start and once a
   day, keeping the last 14 (`BACKUPS`), with the accounts (which account leads which warband) and the
   development tokens beside them.
2. **The volume's snapshots:** Fly snapshots volumes daily; `fly volumes snapshots list <volume id>` shows them,
   and a volume can be restored from one.
3. **Off site:** `deploy/backup.sh` pulls the log, accounts and tokens to `deploy/backups/<date>/` on your own machine.
   Put it in cron (`0 6 * * * cd /path/to/repo && deploy/backup.sh`).

**Restoring** a log (say yesterday's, after an exploit):

```sh
fly ssh sftp shell            # then: put events.jsonl /data/events.jsonl
fly ssh console -C "chown node:node /data/events.jsonl"
fly machine restart
```

The log only holds inputs (the war's creation, joins, orders, ticks with their seeds), so a log cut back to any
point rebuilds the war exactly as it stood then. Replays in `/data/replays` can always be deleted: they're made
again on demand.

## A VPS with Docker

On a fresh Ubuntu server with Docker installed (https://docs.docker.com/engine/install/ubuntu/), with a DNS A
record for your domain pointing at it:

```sh
git clone <this repository> war && cd war
printf "WAR_DOMAIN=war.example.com\nADMIN_KEY=%s\n" "$(openssl rand -hex 24)" > deploy/.env
# then add the sign-in values to deploy/.env (Sign-in, above): DISCORD_CLIENT_ID=... and the rest
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Caddy fetches and renews the HTTPS certificate by itself. Update with `git pull` and the same `up -d --build`.
The war's data is in the `war_data` Docker volume; copy the log out for an off-site backup with
`docker compose -f deploy/docker-compose.yml cp war:/data/events.jsonl backups/events-$(date +%F).jsonl`.

## Before real players

Set up sign-in (above) and try it from a phone and a second browser. Still missing for a closed test war: admin
tools to pause the war, roll back a turn and start a new war.
