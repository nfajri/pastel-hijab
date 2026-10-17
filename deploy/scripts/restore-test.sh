#!/usr/bin/env bash
# Uji restore TANPA menyentuh data produksi: buka backup di folder sementara, cek integritas,
# hitung baris per tabel, dan (opsional) jalankan binary di port lain untuk health check.
#
#   restore-test.sh <file-backup> [--binary /opt/pastel/current/pastel] [--port 18087]
#
# Pakai untuk checklist uji restore sebelum go-live dan uji bulanan. Tidak butuh root.
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

SRC=${1:-}
[[ -n $SRC && $SRC != -h && $SRC != --help ]] || { sed -n '2,7p' "$0"; exit 1; }
shift
BIN=
PORT=18087
while [[ $# -gt 0 ]]; do
  case $1 in
    --binary) BIN=${2:?}; shift 2 ;;
    --port) PORT=${2:?}; shift 2 ;;
    *) die "argumen tidak dikenal: $1" ;;
  esac
done
need sqlite3 gzip sha256sum

work=$(mktemp -d "${TMPDIR:-/tmp}/pastel-restore-test.XXXXXX")
pid=
cleanup() {
  [[ -z $pid ]] || kill "$pid" 2>/dev/null || true
  rm -rf -- "$work"
}
trap cleanup EXIT

unpack_backup "$SRC" "$work/pastel.db"
sqlite_check "$work/pastel.db" || die "integrity_check gagal"
fk=$(sqlite3 -readonly "$work/pastel.db" 'PRAGMA foreign_key_check;')
[[ -z $fk ]] || die "foreign_key_check menemukan pelanggaran: $fk"

echo "== $(basename "$SRC")"
echo "ukuran       : $(du -h "$work/pastel.db" | cut -f1)"
echo "user_version : $(sqlite3 -readonly "$work/pastel.db" 'PRAGMA user_version;')"
echo "integritas   : ok, foreign key ok"
echo "-- jumlah baris per tabel"
while IFS= read -r t; do
  printf '%-28s %s\n' "$t" "$(sqlite3 -readonly "$work/pastel.db" "SELECT COUNT(*) FROM \"$t\";")"
done < <(sqlite3 -readonly "$work/pastel.db" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")

if [[ -n $BIN ]]; then
  [[ -x $BIN ]] || die "binary tidak bisa dijalankan: $BIN"
  need curl
  echo "-- jalankan $BIN di 127.0.0.1:$PORT memakai salinan DB"
  PASTEL_ADDR=127.0.0.1:$PORT PASTEL_DB=$work/pastel.db PASTEL_COOKIE_SECURE=0 \
    "$BIN" >"$work/app.log" 2>&1 &
  pid=$!
  PASTEL_ADDR=127.0.0.1:$PORT
  if wait_healthy 20; then
    echo "health       : ok (http://127.0.0.1:$PORT$HEALTH_PATH)"
  else
    tail -n 30 "$work/app.log" >&2
    die "aplikasi tidak sehat dengan DB hasil restore"
  fi
fi
echo "HASIL: LULUS"
