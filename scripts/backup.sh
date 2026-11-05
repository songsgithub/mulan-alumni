#!/usr/bin/env bash
# 备份：数据库（pg_dump）+ 上传文件（media / finance-evidence），按天落一份，保留最近 N 天。
#
# 用法：bash scripts/backup.sh [备份目录]        （默认 ./backups）
# 建议：每天凌晨跑一次（crontab：0 3 * * * cd /srv/mulan-alumni && bash scripts/backup.sh /data/backups）
#       并把备份目录同步到另一台机器 / 对象存储——同一块盘上的备份防不了盘坏。
# 恢复：gunzip -c db-*.sql.gz | docker exec -i mulan-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
#       tar -xzf files-*.tar.gz -C <项目目录>
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
[ -f .env ] && . ./.env
set +a

DEST="${1:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

echo "[backup] 数据库 → $DEST/db-$STAMP.sql.gz"
docker exec mulan-postgres pg_dump -U "${POSTGRES_USER:-mulan}" -d "${POSTGRES_DB:-mulan_alumni}" --no-owner \
  | gzip > "$DEST/db-$STAMP.sql.gz"

# 文件：用了 S3 / OSS 的话由对象存储自己做版本与跨区复制，这里只备本地磁盘上的
if [ -z "${S3_ENDPOINT:-}" ]; then
  echo "[backup] 上传文件 → $DEST/files-$STAMP.tar.gz"
  tar -czf "$DEST/files-$STAMP.tar.gz" media finance-evidence
fi

find "$DEST" -maxdepth 1 -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -maxdepth 1 -name 'files-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "[backup] 完成（保留最近 $KEEP_DAYS 天）"
