#!/bin/bash
# ============================================================================
# ARTIC VMS — Automated PostgreSQL Backup Script
# Run via cron or manually. Stores compressed .sql.gz files.
# Retains the last 30 backups. Optionally uploads to remote storage.
#
# Setup: chmod +x /path/to/backup.sh
# Cron:  0 2 * * * /home/articadmin/artic-vms/infrastructure/backup/backup.sh
# ============================================================================

set -euo pipefail

# ── Config (override with env vars if needed) ─────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/artic}"
RETAIN_COUNT="${RETAIN_COUNT:-30}"
DATE="$(date +%Y%m%d_%H%M%S)"
FILENAME="fleet_management_${DATE}.sql.gz"

# Find the running postgres container
DB_CONTAINER="$(docker ps --filter name=postgres --format '{{.Names}}' | head -1)"

# ── Validate ──────────────────────────────────────────────────────────────────
if [ -z "$DB_CONTAINER" ]; then
  echo "[BACKUP] ERROR: No running postgres container found" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ── Run backup ────────────────────────────────────────────────────────────────
echo "[BACKUP] Starting: $FILENAME"

docker exec "$DB_CONTAINER" \
  pg_dump -U artic_user fleet_management \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE="$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)"
echo "[BACKUP] Done: ${BACKUP_DIR}/${FILENAME} (${SIZE})"

# ── Rotate old backups ────────────────────────────────────────────────────────
BACKUP_COUNT="$(ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | wc -l)"
if [ "$BACKUP_COUNT" -gt "$RETAIN_COUNT" ]; then
  DELETE_COUNT=$(( BACKUP_COUNT - RETAIN_COUNT ))
  echo "[BACKUP] Removing ${DELETE_COUNT} old backup(s)…"
  ls -1t "${BACKUP_DIR}"/*.sql.gz | tail -n "+$((RETAIN_COUNT + 1))" | xargs rm -f
fi

echo "[BACKUP] Kept $(ls -1 "${BACKUP_DIR}"/*.sql.gz | wc -l) backup(s) in ${BACKUP_DIR}"

# ── Optional: verify the backup is readable ───────────────────────────────────
if gzip -t "${BACKUP_DIR}/${FILENAME}" 2>/dev/null; then
  echo "[BACKUP] Integrity check passed ✓"
else
  echo "[BACKUP] WARNING: Integrity check failed for ${FILENAME}" >&2
  exit 2
fi

# ── Optional: copy to a remote location ──────────────────────────────────────
# Uncomment and configure to send offsite (rsync, rclone, scp, etc.)
#
# REMOTE_PATH="user@remote-server:/backups/artic/"
# rsync -az --remove-source-files "${BACKUP_DIR}/${FILENAME}" "$REMOTE_PATH" \
#   && echo "[BACKUP] Uploaded to remote storage" \
#   || echo "[BACKUP] WARNING: Remote upload failed" >&2
#
# For S3-compatible storage (requires rclone configured):
# rclone copy "${BACKUP_DIR}/${FILENAME}" "s3remote:artic-backups/" \
#   && echo "[BACKUP] Uploaded to S3" \
#   || echo "[BACKUP] WARNING: S3 upload failed" >&2

echo "[BACKUP] Completed at $(date)"
