#!/usr/bin/env bash
# Switches the server to a release that deploy.yml has uploaded (SPEC §18.4 step 4):
#   link the shared env files → point `current` at the release → reload PM2 → health check →
#   on failure point `current` back at the previous release and reload again. Keeps 5 releases.
#
#   bash /srv/aricon/releases/<id>/infra/scripts/activate-release.sh <id>
#
# Runs as the deploy user (owner of /srv/aricon and of the PM2 processes).
set -euo pipefail

ROOT=/srv/aricon
KEEP_RELEASES=5
HEALTH_URL="${HEALTH_URL:-https://shop.aricon.com.pk/api/health}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000/robots.txt}"

RELEASE_ID="${1:?usage: activate-release.sh <release id>}"
RELEASE="$ROOT/releases/$RELEASE_ID"

log() { printf '[activate %s] %s\n' "$RELEASE_ID" "$*"; }

for path in "$RELEASE/api/dist/main.js" "$RELEASE/web/apps/web/server.js" "$RELEASE/infra/ecosystem.config.cjs"; do
  [[ -e "$path" ]] || { log "missing $path — upload incomplete"; exit 1; }
done
for file in "$ROOT/shared/.env.api" "$ROOT/shared/.env.web"; do
  [[ -f "$file" ]] || { log "missing $file (see infra/DEPLOY.md)"; exit 1; }
done

# Env files live on the server only, never in Git or in an upload.
ln -sfn "$ROOT/shared/.env.api" "$RELEASE/api/.env"
ln -sfn "$ROOT/shared/.env.web" "$RELEASE/web/apps/web/.env"

PREVIOUS=""
if [[ -L "$ROOT/current" ]]; then PREVIOUS="$(readlink -f "$ROOT/current")"; fi

# Point `current` at a release (atomic rename of a new symlink) and (re)start both processes.
switch_to() {
  ln -sfn "$1" "$ROOT/current.next"
  mv -Tf "$ROOT/current.next" "$ROOT/current"
  pm2 startOrReload "$ROOT/current/infra/ecosystem.config.cjs" --update-env
}

# The API through Nginx and Cloudflare (as customers reach it), and the web process directly.
healthy() {
  local attempt
  for attempt in $(seq 1 10); do
    if curl -fsS --max-time 5 -o /dev/null "$HEALTH_URL" && curl -fsS --max-time 5 -o /dev/null "$WEB_URL"; then
      return 0
    fi
    log "health check $attempt/10 failed, retrying in 3 s"
    sleep 3
  done
  return 1
}

log "activating (previous: ${PREVIOUS:-none})"
switch_to "$RELEASE"

if ! healthy; then
  if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$RELEASE" ]]; then
    log "unhealthy — rolling back to $PREVIOUS"
    switch_to "$PREVIOUS"
    healthy || log "previous release is unhealthy too — check: pm2 logs"
  else
    log "unhealthy and no previous release to roll back to — check: pm2 logs"
  fi
  exit 1
fi

# Survive a reboot with this release (`pm2 startup` was run once during setup).
pm2 save

# Keep the newest releases (ids are UTC timestamps, so they sort by age); never delete `current`.
CURRENT="$(readlink -f "$ROOT/current")"
mapfile -t releases < <(find "$ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
for old in "${releases[@]:$KEEP_RELEASES}"; do
  [[ "$ROOT/releases/$old" == "$CURRENT" ]] && continue
  log "removing old release $old"
  rm -rf -- "${ROOT:?}/releases/$old"
done

log "live"
