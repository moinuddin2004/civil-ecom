#!/usr/bin/env bash
# Nightly MongoDB backup (SPEC §18.5): mongodump of the whole replica set (with the oplog, so the
# dump is consistent) → R2 private bucket `backups/mongo/{date}.archive.gz` → delete backups older
# than 30 days. Every release ships it; /srv/aricon/scripts/backup-mongo.sh is a symlink to
# /srv/aricon/current/infra/backup/backup-mongo.sh. Cron at 02:30 Asia/Karachi:
#
#   30 21 * * * /srv/aricon/scripts/backup-mongo.sh >> /var/log/aricon/backup-mongo.log 2>&1
#
# (the server clock is UTC; Pakistan has no daylight saving, so 21:30 UTC is always 02:30 PKT).
#
# Needs: mongodump (MongoDB Database Tools) and rclone. Settings in /srv/aricon/shared/backup.env
# (mode 600), never in Git:
#   MONGODUMP_CONFIG     YAML file (mode 600) with the backup user's connection string, e.g.
#                        uri: mongodb://aricon_backup:…@127.0.0.1:27017/?authSource=admin&replicaSet=rs0
#                        (in a file, so the password never shows up in `ps`)
#   R2_ACCOUNT_ID, R2_BACKUP_ACCESS_KEY_ID, R2_BACKUP_SECRET_ACCESS_KEY   token for the private bucket
#   R2_PRIVATE_BUCKET    e.g. aricon-private
set -euo pipefail

SETTINGS="${BACKUP_SETTINGS:-/srv/aricon/shared/backup.env}"
RETENTION_DAYS=30
WORK_DIR="${BACKUP_WORK_DIR:-/var/backups/aricon}"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

# shellcheck source=/dev/null
source "$SETTINGS"
: "${MONGODUMP_CONFIG:?} ${R2_ACCOUNT_ID:?} ${R2_BACKUP_ACCESS_KEY_ID:?} ${R2_BACKUP_SECRET_ACCESS_KEY:?} ${R2_PRIVATE_BUCKET:?}"

# rclone remote "r2" from the environment (no rclone.conf with keys lying around).
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

DATE="$(TZ=Asia/Karachi date +%F)"
ARCHIVE="$WORK_DIR/$DATE.archive.gz"
REMOTE_DIR="r2:$R2_PRIVATE_BUCKET/backups/mongo"

mkdir -p "$WORK_DIR"
chmod 700 "$WORK_DIR"
trap 'rm -f "$ARCHIVE"' EXIT

log "dumping to $ARCHIVE"
mongodump --config="$MONGODUMP_CONFIG" --oplog --gzip --archive="$ARCHIVE" --quiet
log "dump size $(du -h "$ARCHIVE" | cut -f1)"

log "uploading to $REMOTE_DIR/$DATE.archive.gz"
rclone copyto "$ARCHIVE" "$REMOTE_DIR/$DATE.archive.gz"

log "deleting backups older than $RETENTION_DAYS days"
rclone delete "$REMOTE_DIR" --min-age "${RETENTION_DAYS}d" --include '*.archive.gz'

log "done"
