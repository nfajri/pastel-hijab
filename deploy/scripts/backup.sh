#!/usr/bin/env bash
# Backup konsisten database Pastel memakai `sqlite3 .backup` (aman saat service jalan, mode WAL).
#
#   backup.sh                 backup harian (dipanggil pastel-backup.timer)
#   backup.sh --tag <label>   backup sebelum deploy/restore, disimpan di predeploy/
#
# Hasil: $BACKUP_DIR/{daily,monthly,predeploy}/pastel-<YYYYmmdd-HHMMSS>[-label].db.gz + .sha256
# Salinan ke luar VPS lewat rclone bila RCLONE_REMOTE diisi (copy, bukan sync: hapus lokal tidak ikut terhapus di remote).
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

TAG=
while [[ $# -gt 0 ]]; do
  case $1 in
    --tag) TAG=${2:?--tag butuh label}; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) die "argumen tidak dikenal: $1" ;;
  esac
done
[[ -z $TAG || $TAG =~ ^[A-Za-z0-9._-]+$ ]] || die "label hanya boleh huruf, angka, . _ -"

KEEP_DAILY_DAYS=${KEEP_DAILY_DAYS:-14}
KEEP_MONTHLY_DAYS=${KEEP_MONTHLY_DAYS:-400}
KEEP_PREDEPLOY_DAYS=${KEEP_PREDEPLOY_DAYS:-30}
RCLONE_REMOTE=${RCLONE_REMOTE:-}
RCLONE_CONFIG=${RCLONE_CONFIG:-/etc/pastel/rclone.conf}
BACKUP_PING_URL=${BACKUP_PING_URL:-}
export RCLONE_CONFIG

need sqlite3 gzip sha256sum flock
[[ -f $PASTEL_DB ]] || die "database tidak ada: $PASTEL_DB"

ping_monitor() { # $1 = "" (sukses) atau "/fail"; backup ber-label (pra-deploy) tidak melapor
  [[ -n $BACKUP_PING_URL && -z $TAG ]] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${BACKUP_PING_URL}$1" || log "ping monitor gagal (diabaikan)"
}
tmp=
on_exit() {
  local rc=$?
  [[ -z $tmp ]] || rm -f -- "$tmp" "$tmp-wal" "$tmp-shm" "$tmp.gz"
  [[ $rc -eq 0 ]] || ping_monitor /fail
}
trap on_exit EXIT

mkdir -p "$BACKUP_DIR"/{daily,monthly,predeploy}
exec 9>"$BACKUP_DIR/.lock"
flock -w 600 9 || die "backup lain masih berjalan"

# Pastikan ruang cukup: minimal 2x ukuran DB.
db_kb=$(du -k "$PASTEL_DB" | cut -f1)
free_kb=$(df -Pk "$BACKUP_DIR" | awk 'NR==2 {print $4}')
(( free_kb > db_kb * 2 + 10240 )) || die "ruang disk kurang di $BACKUP_DIR (bebas ${free_kb}K, DB ${db_kb}K)"

stamp=$(date +%Y%m%d-%H%M%S)
name="pastel-${stamp}${TAG:+-$TAG}.db"
if [[ -n $TAG ]]; then dest_dir=$BACKUP_DIR/predeploy; else dest_dir=$BACKUP_DIR/daily; fi
tmp=$(mktemp "$BACKUP_DIR/.tmp-XXXXXX.db")

log "backup $PASTEL_DB -> $dest_dir/$name.gz"
sqlite3 -bail "$PASTEL_DB" ".timeout 15000" ".backup '$tmp'"
# Jadikan salinan berdiri sendiri (tanpa -wal/-shm); aplikasi menyalakan WAL lagi saat dibuka.
sqlite3 "$tmp" 'PRAGMA journal_mode=DELETE;' >/dev/null
sqlite_check "$tmp" || die "hasil backup tidak lolos integrity_check"
gzip -9 "$tmp"
mv -- "$tmp.gz" "$dest_dir/$name.gz"
(cd "$dest_dir" && sha256sum -- "$name.gz" >"$name.gz.sha256")
log "ok: $(du -h "$dest_dir/$name.gz" | cut -f1)"

# Arsip bulanan: backup harian pertama di tiap bulan disalin ke monthly/.
if [[ -z $TAG ]] && ! compgen -G "$BACKUP_DIR/monthly/pastel-$(date +%Y%m)*.db.gz" >/dev/null; then
  cp -p -- "$dest_dir/$name.gz" "$dest_dir/$name.gz.sha256" "$BACKUP_DIR/monthly/"
  log "disalin ke monthly/"
fi

# Retensi lokal (berdasarkan umur file). Backup yang baru dibuat selalu aman.
prune() { # dir hari
  find "$1" -maxdepth 1 -type f -name 'pastel-*.db.gz*' -mtime "+$2" -print -delete \
    | sed 's/^/  hapus (retensi): /' >&2
}
prune "$BACKUP_DIR/daily" "$KEEP_DAILY_DAYS"
prune "$BACKUP_DIR/monthly" "$KEEP_MONTHLY_DAYS"
prune "$BACKUP_DIR/predeploy" "$KEEP_PREDEPLOY_DAYS"

# Salinan ke luar VPS.
if [[ -n $RCLONE_REMOTE ]]; then
  need rclone
  sub=${dest_dir##*/}
  log "unggah ke $RCLONE_REMOTE/$sub/"
  rclone copy --immutable --retries 5 --low-level-retries 10 \
    --include "$name.gz" --include "$name.gz.sha256" \
    "$dest_dir" "$RCLONE_REMOTE/$sub" \
    || die "unggah off-site gagal (backup lokal tetap ada: $dest_dir/$name.gz)"
  if [[ -f $BACKUP_DIR/monthly/$name.gz ]]; then
    rclone copy --immutable --retries 5 \
      --include "$name.gz" --include "$name.gz.sha256" \
      "$BACKUP_DIR/monthly" "$RCLONE_REMOTE/monthly" || die "unggah monthly gagal"
  fi
  log "off-site ok"
else
  log "PERINGATAN: RCLONE_REMOTE kosong, backup hanya ada di VPS ini"
fi

ping_monitor ""
