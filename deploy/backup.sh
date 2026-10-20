#!/bin/sh
# Pulls the war's event log and tokens from Fly to deploy/backups/<date>/ on your own machine: the off-site copy.
# Run it from the repository root (it uses the app named in fly.toml). Put it in cron for a daily copy.
set -eu
dir="deploy/backups/$(date +%Y-%m-%d)"
mkdir -p "$dir"
fly ssh sftp get /data/events.jsonl "$dir/events.jsonl"
fly ssh sftp get /data/tokens.json "$dir/tokens.json" || true
echo "saved to $dir"
