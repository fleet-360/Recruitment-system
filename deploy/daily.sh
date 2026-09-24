#!/usr/bin/env bash
# Daily on the VPS (crontab -e):  0 3 * * * /opt/crm/deploy/daily.sh >> /var/log/crm-daily.log 2>&1
# 1) Encrypted backup of the DB and the CV files, kept 14 days.
# 2) The app's daily job (overdue notifications + collection tasks).
#
# Restore:
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in db-DATE.dump.enc | docker compose -f compose.prod.yml exec -T db pg_restore -U crm -d crm --clean --if-exists
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in uploads-DATE.tar.gz.enc | docker compose -f compose.prod.yml exec -T app tar -C /data -xz
set -euo pipefail
cd "$(dirname "$0")/.."
export BACKUP_PASSPHRASE=${BACKUP_PASSPHRASE:-$(grep '^BACKUP_PASSPHRASE=' .env | cut -d= -f2- | tr -d '"')}
[ -n "$BACKUP_PASSPHRASE" ] || { echo "BACKUP_PASSPHRASE missing in .env"; exit 1; }
OUT=${BACKUP_DIR:-/var/backups/crm}
STAMP=$(date +%F)
dc="docker compose -f compose.prod.yml"
enc() { openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$1"; }

mkdir -p "$OUT"
$dc exec -T db pg_dump -U crm -Fc crm | enc "$OUT/db-$STAMP.dump.enc"
$dc exec -T app tar -C /data -cz uploads | enc "$OUT/uploads-$STAMP.tar.gz.enc"
find "$OUT" -name '*.enc' -mtime +14 -delete
# ponytail: backups sit on the VPS disk — they don't survive losing the server. Add an offsite copy (rclone to S3/Drive) here once a destination is chosen.
echo "$(date -Is) backup ok: $(ls -1 "$OUT" | wc -l) files"

$dc exec -T app sh -c 'wget -qO- --header "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily'
echo
