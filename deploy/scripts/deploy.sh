#!/usr/bin/env bash
# Pasang/perbarui binary Pastel tanpa menyentuh data.
#
#   deploy.sh <binary-baru> [versi]
#
# Contoh: deploy.sh /root/upload/pastel v0.3.0
# Urutan: backup DB (label pre-deploy) -> salin ke releases/<versi> -> pindah symlink current
#         -> restart -> health check. Bila health gagal: kembali otomatis ke binary sebelumnya.
# Data (/var/lib/pastel) tidak pernah dihapus/ditimpa oleh skrip ini.
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"
load_env /etc/pastel/pastel.env /etc/pastel/backup.env

NEW_BIN=${1:-}
[[ -n $NEW_BIN && $NEW_BIN != -h && $NEW_BIN != --help ]] || { sed -n '2,9p' "$0"; exit 1; }
[[ -f $NEW_BIN ]] || die "binary tidak ada: $NEW_BIN"
VERSION=${2:-$(date +%Y%m%d-%H%M%S)-$(sha256sum "$NEW_BIN" | cut -c1-8)}
[[ $VERSION =~ ^[A-Za-z0-9._-]+$ ]] || die "versi hanya boleh huruf, angka, . _ -"
KEEP_RELEASES=${KEEP_RELEASES:-5}

need_root
need curl systemctl runuser flock sha256sum
exec 8>/run/lock/pastel-deploy.lock
flock -n 8 || die "deploy lain sedang berjalan"

rel=$PASTEL_HOME/releases/$VERSION
[[ ! -e $rel ]] || die "versi $VERSION sudah ada di $rel (pakai label lain, atau rollback.sh --to $VERSION)"
head -c 4 "$NEW_BIN" | grep -q $'\x7fELF' || die "$NEW_BIN bukan binary Linux (ELF)"

# 1) Backup sebelum apa pun berubah. Migrasi skema berjalan saat binary baru start.
if [[ -f $PASTEL_DB ]]; then
  runuser -u "$PASTEL_USER" -- env PASTEL_DB="$PASTEL_DB" BACKUP_DIR="$BACKUP_DIR" \
    RCLONE_REMOTE="${RCLONE_REMOTE:-}" RCLONE_CONFIG="${RCLONE_CONFIG:-/etc/pastel/rclone.conf}" \
    "$SCRIPT_DIR/backup.sh" --tag "pre-deploy-$VERSION" || die "backup pra-deploy gagal, deploy dibatalkan"
else
  log "DB belum ada (instalasi pertama), backup dilewati"
fi

# 2) Pasang rilis baru (milik root, tidak bisa diubah oleh user service).
install -d -m 0755 "$rel"
install -o root -g root -m 0755 "$NEW_BIN" "$rel/pastel"
sha256sum "$rel/pastel" >"$rel/SHA256"
prev=
if [[ -L $PASTEL_HOME/current ]]; then prev=$(readlink -f "$PASTEL_HOME/current"); fi

switch_to() { # pindah symlink secara atomik
  ln -sfn "$1" "$PASTEL_HOME/current.tmp"
  mv -T "$PASTEL_HOME/current.tmp" "$PASTEL_HOME/current"
}

switch_to "$rel"
log "current -> $rel (sebelumnya: ${prev:-tidak ada})"

# 3) Restart + health check.
systemctl restart "$PASTEL_SERVICE"
if wait_healthy 30; then
  [[ -z $prev ]] || ln -sfn "$prev" "$PASTEL_HOME/previous"
  log "SELESAI: versi $VERSION sehat"
else
  log "health check gagal untuk $VERSION"
  journalctl -u "$PASTEL_SERVICE" -n 40 --no-pager >&2 || true
  # Rilis gagal disimpan untuk diselidiki (label bisa dipakai lagi); previous tidak diubah.
  mv -T "$rel" "$rel.gagal-$(date +%Y%m%d-%H%M%S)"
  if [[ -n $prev ]]; then
    switch_to "$prev"
    systemctl restart "$PASTEL_SERVICE"
    if wait_healthy 30; then
      log "binary dikembalikan ke $prev dan sehat"
    else
      log "binary lama juga tidak sehat. Kemungkinan migrasi skema sudah jalan:"
      log "  pulihkan DB pra-deploy: rollback.sh --with-db $BACKUP_DIR/predeploy/<pastel-*-pre-deploy-$VERSION.db.gz>"
    fi
  fi
  die "deploy $VERSION gagal"
fi

# 4) Simpan $KEEP_RELEASES rilis terakhir (current & previous tidak pernah dihapus).
cur=$(readlink -f "$PASTEL_HOME/current")
prv=
if [[ -L $PASTEL_HOME/previous ]]; then prv=$(readlink -f "$PASTEL_HOME/previous"); fi
mapfile -t old < <(find "$PASTEL_HOME/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn | cut -d' ' -f2- | tail -n +"$((KEEP_RELEASES + 1))")
for d in "${old[@]}"; do
  [[ $d == "$cur" || $d == "$prv" ]] && continue
  log "hapus rilis lama: $d"
  rm -rf -- "$d"
done
