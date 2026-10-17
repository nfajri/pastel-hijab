#!/usr/bin/env bash
# Pulihkan database Pastel dari file backup (.db.gz atau .db). MENGGANTI data yang sedang dipakai.
#
#   restore.sh <file-backup> [--yes]
#
# Urutan: cek checksum & integritas -> backup DB saat ini (label pre-restore) -> stop service
#         -> pasang file -> start -> health check. Bila health gagal, DB lama dikembalikan otomatis.
# Ambil dari off-site dulu bila perlu: rclone copy <remote>/daily/<file> /root/restore/ (lihat deploy-plan.md).
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"
load_env /etc/pastel/pastel.env /etc/pastel/backup.env

SRC=${1:-}
YES=${2:-}
[[ -n $SRC && $SRC != -h && $SRC != --help ]] || { sed -n '2,9p' "$0"; exit 1; }
need_root
need sqlite3 gzip sha256sum curl systemctl runuser

work=$(mktemp -d /var/tmp/pastel-restore.XXXXXX)
trap 'rm -rf -- "$work"' EXIT
unpack_backup "$SRC" "$work/new.db"
sqlite_check "$work/new.db" || die "file backup rusak, restore dibatalkan"
log "file backup sehat: user_version=$(sqlite3 -readonly "$work/new.db" 'PRAGMA user_version;')"

if [[ $YES != --yes ]]; then
  read -r -p "Ganti database $PASTEL_DB dengan $(basename "$SRC")? Ketik 'pulihkan': " ans
  [[ $ans == pulihkan ]] || die "dibatalkan"
fi

# Simpan kondisi sekarang dulu (bila DB ada & sehat), supaya restore pun bisa dibatalkan.
if [[ -f $PASTEL_DB ]]; then
  runuser -u "$PASTEL_USER" -- env PASTEL_DB="$PASTEL_DB" BACKUP_DIR="$BACKUP_DIR" RCLONE_REMOTE= \
    "$SCRIPT_DIR/backup.sh" --tag pre-restore \
    || log "PERINGATAN: backup pre-restore gagal; salinan mentah tetap disimpan (lihat di bawah)"
fi

log "stop $PASTEL_SERVICE"
systemctl stop "$PASTEL_SERVICE"
# File DB lama dipindah utuh (termasuk -wal/-shm) ke folder yang TIDAK dihapus otomatis.
old=$BACKUP_DIR/restore-old-$(date +%Y%m%d-%H%M%S)
install -d -m 0700 "$old"
for f in "$PASTEL_DB" "$PASTEL_DB-wal" "$PASTEL_DB-shm"; do
  if [[ -f $f ]]; then mv -- "$f" "$old/"; fi
done
log "file DB lama disimpan di $old (hapus manual setelah yakin)"

install -o "$PASTEL_USER" -g "$PASTEL_USER" -m 0600 "$work/new.db" "$PASTEL_DB"
log "start $PASTEL_SERVICE"
systemctl start "$PASTEL_SERVICE"
if wait_healthy 30; then
  log "SELESAI: database dipulihkan dari $(basename "$SRC"), service sehat"
  exit 0
fi

log "health check gagal, kembalikan database sebelumnya"
systemctl stop "$PASTEL_SERVICE"
rm -f -- "$PASTEL_DB" "$PASTEL_DB-wal" "$PASTEL_DB-shm"
for f in "$old"/*; do
  if [[ -e $f ]]; then cp -p -- "$f" "$(dirname "$PASTEL_DB")/"; fi
done
systemctl start "$PASTEL_SERVICE"
wait_healthy 30 || log "service tetap tidak sehat, cek: journalctl -u $PASTEL_SERVICE -n 100"
die "restore dibatalkan, database lama dipakai lagi"
