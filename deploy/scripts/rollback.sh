#!/usr/bin/env bash
# Kembalikan Pastel ke rilis sebelumnya, opsional sekaligus memulihkan DB.
#
#   rollback.sh                              binary -> rilis "previous"
#   rollback.sh --to <versi>                 binary -> releases/<versi>
#   rollback.sh [--to <versi>] --with-db <file-backup>
#                                            + pulihkan DB (mis. backup pre-deploy) lewat restore.sh
#   rollback.sh --list                       daftar rilis & backup pre-deploy
#
# --with-db diperlukan bila rilis baru sudah memigrasi skema yang tidak dikenali binary lama.
# Perhatian: transaksi yang dicatat SETELAH backup itu dibuat akan hilang (catat ulang manual).
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"
load_env /etc/pastel/pastel.env /etc/pastel/backup.env

TO=
DB_FILE=
while [[ $# -gt 0 ]]; do
  case $1 in
    --to) TO=${2:?}; shift 2 ;;
    --with-db) DB_FILE=${2:?}; shift 2 ;;
    --list)
      echo "current : $(readlink -f "$PASTEL_HOME/current" 2>/dev/null || echo -)"
      echo "previous: $(readlink -f "$PASTEL_HOME/previous" 2>/dev/null || echo -)"
      echo "-- rilis (terbaru dulu)"; ls -1t "$PASTEL_HOME/releases" 2>/dev/null || true
      echo "-- backup pre-deploy";     find "$BACKUP_DIR/predeploy" -maxdepth 1 -name '*.db.gz' -printf '%T@ %p\n' 2>/dev/null | sort -rn | cut -d' ' -f2- || true
      exit 0 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) die "argumen tidak dikenal: $1" ;;
  esac
done

need_root
need curl systemctl flock
exec 8>/run/lock/pastel-deploy.lock
flock -n 8 || die "deploy lain sedang berjalan"

if [[ -n $TO ]]; then
  target=$PASTEL_HOME/releases/$TO
else
  [[ -L $PASTEL_HOME/previous ]] || die "tidak ada rilis previous; pakai --to <versi> (lihat --list)"
  target=$(readlink -f "$PASTEL_HOME/previous")
  [[ -n $target ]] || die "tidak ada rilis previous; pakai --to <versi> (lihat --list)"
fi
[[ -x $target/pastel ]] || die "rilis tidak valid: $target"
cur=$(readlink -f "$PASTEL_HOME/current")
[[ $target != "$cur" ]] || log "rilis $target sudah aktif (binary tidak diganti)"

if [[ $target != "$cur" ]]; then
  ln -sfn "$target" "$PASTEL_HOME/current.tmp"
  mv -T "$PASTEL_HOME/current.tmp" "$PASTEL_HOME/current"
  ln -sfn "$cur" "$PASTEL_HOME/previous"
  log "current -> $target (previous -> $cur)"
fi

if [[ -n $DB_FILE ]]; then
  # restore.sh sendiri mem-backup DB saat ini, stop/start service, dan cek health.
  exec 8>&-
  "$SCRIPT_DIR/restore.sh" "$DB_FILE"
  exit $?
fi

systemctl restart "$PASTEL_SERVICE"
wait_healthy 30 || die "tidak sehat setelah rollback; cek journalctl -u $PASTEL_SERVICE, pertimbangkan --with-db"
log "SELESAI: rollback ke $target sehat"
