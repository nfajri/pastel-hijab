#!/usr/bin/env bash
# Build satu binary `out/pastel` berisi API + frontend (di-embed).
#   server/build.sh [GOARCH]        GOARCH bawaan amd64 (VPS x86_64); aarch64 → arm64
#   SKIP_FRONTEND=1 server/build.sh pakai dist/ yang sudah ada (tanpa npm run build)
set -euo pipefail
cd "$(dirname "$0")/.."

arch=${1:-amd64}
if [[ ${SKIP_FRONTEND:-0} != 1 ]]; then
  npm run build
fi
[[ -f dist/index.html ]] || { echo "dist/index.html tidak ada; jalankan npm ci && npm run build" >&2; exit 1; }

web=server/internal/web/dist
find "$web" -mindepth 1 ! -name .gitkeep -delete
cp -R dist/. "$web/"

mkdir -p out
(cd server && CGO_ENABLED=0 GOOS=linux GOARCH="$arch" go build -trimpath -ldflags "-s -w" -o ../out/pastel .)
echo "OK: out/pastel (linux/$arch, frontend $(find "$web" -type f ! -name .gitkeep | wc -l) file)"
