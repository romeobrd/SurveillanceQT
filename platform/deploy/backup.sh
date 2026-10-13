#!/bin/sh
# Sauvegarde quotidienne de la base (compressée), conservée 14 jours. Planifiée par deploy/crontab.
set -eu
# Les journaux de deploy/crontab sont écrits dans deploy/logs
cd "$(dirname "$0")"
mkdir -p backups logs
docker compose exec -T db \
  pg_dump -U spacora -d spacora --no-owner | gzip > "backups/spacora-$(date +%F).sql.gz"
find backups -name 'spacora-*.sql.gz' -mtime +14 -delete
