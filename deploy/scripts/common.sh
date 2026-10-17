#!/usr/bin/env bash
# Fungsi & default bersama untuk skrip deploy Pastel. Di-source, bukan dijalankan.
# shellcheck disable=SC2034  # variabel dipakai oleh skrip yang men-source file ini

PASTEL_HOME=${PASTEL_HOME:-/opt/pastel}
PASTEL_DB=${PASTEL_DB:-/var/lib/pastel/pastel.db}
PASTEL_ADDR=${PASTEL_ADDR:-127.0.0.1:8087}
PASTEL_USER=${PASTEL_USER:-pastel}
PASTEL_SERVICE=${PASTEL_SERVICE:-pastel.service}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/pastel}
HEALTH_PATH=${HEALTH_PATH:-/api/health}

log()  { printf '%s [%s] %s\n' "$(date '+%F %T')" "${0##*/}" "$*" >&2; }
die()  { log "GAGAL: $*"; exit 1; }

need() {
  local c
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || die "perintah '$c' tidak ada (pasang dulu, lihat deploy-plan.md)"
  done
}

need_root() {
  [[ $(id -u) -eq 0 ]] || die "jalankan sebagai root (sudo)"
}

# Muat file env bila ada (format KEY=VALUE seperti EnvironmentFile systemd).
load_env() {
  local f
  for f in "$@"; do
    if [[ -r $f ]]; then
      set -a
      # shellcheck disable=SC1090
      . "$f"
      set +a
    fi
  done
}

# Cek integritas file SQLite. Keluaran "ok" = sehat.
sqlite_check() {
  local db=$1 res
  res=$(sqlite3 -readonly "$db" 'PRAGMA integrity_check;' 2>&1) || { log "integrity_check error: $res"; return 1; }
  [[ $res == ok ]] || { log "integrity_check: $res"; return 1; }
}

# Tunggu health check lokal hijau, maksimal $1 detik.
wait_healthy() {
  local timeout=${1:-30} i
  for ((i = 0; i < timeout; i++)); do
    if curl -fsS --max-time 2 "http://${PASTEL_ADDR}${HEALTH_PATH}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Buka .db.gz atau .db ke file tujuan; cek sha256 bila berkas .sha256 ada di sebelahnya.
unpack_backup() {
  local src=$1 dst=$2
  [[ -f $src ]] || die "berkas backup tidak ada: $src"
  if [[ -f $src.sha256 ]]; then
    (cd "$(dirname "$src")" && sha256sum -c --status "$(basename "$src").sha256") \
      || die "checksum tidak cocok: $src"
    log "checksum cocok: $(basename "$src")"
  else
    log "PERINGATAN: tidak ada $src.sha256, checksum dilewati"
  fi
  case $src in
    *.gz) gzip -dc -- "$src" >"$dst" ;;
    *)    cp -- "$src" "$dst" ;;
  esac
}
