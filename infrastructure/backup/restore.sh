#!/bin/bash
# ============================================================================
# ARTIC VMS — Database Restore Script
# Usage: ./restore.sh /var/backups/artic/fleet_management_20261021_020000.sql.gz
#
# WARNING: This replaces ALL data in the target database.
#          Run only when you intentionally want to restore from backup.
# ============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
DB_CONTAINER="$(docker ps --filter name=postgres --format '{{.Names}}' | head -1)"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lht /var/backups/artic/*.sql.gz 2>/dev/null | head -10 || echo "  No backups found in /var/backups/artic/"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: $BACKUP_FILE" >&2
  exit 1
fi

if [ -z "$DB_CONTAINER" ]; then
  echo "ERROR: No running postgres container found" >&2
  exit 1
fi

echo "============================================================"
echo "  ARTIC VMS — Database Restore"
echo "  File:      $BACKUP_FILE"
echo "  Container: $DB_CONTAINER"
echo "  Target:    fleet_management"
echo "============================================================"
echo ""
read -r -p "This will REPLACE all current data. Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "[RESTORE] Dropping and recreating database…"
docker exec "$DB_CONTAINER" psql -U artic_user -c \
  "DROP DATABASE IF EXISTS fleet_management; CREATE DATABASE fleet_management;" postgres

echo "[RESTORE] Restoring from backup…"
gunzip -c "$BACKUP_FILE" | \
  docker exec -i "$DB_CONTAINER" psql -U artic_user fleet_management

echo "[RESTORE] Running Prisma migrations to ensure schema is current…"
cd /home/articadmin/artic-vms
docker compose exec backend npx prisma migrate deploy

echo "[RESTORE] Complete! Verify the application is working correctly."
