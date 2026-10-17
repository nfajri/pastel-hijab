#!/usr/bin/env bash
# Persiapan pertama Pastel di VPS (idempoten, aman diulang). Jalankan dari salinan folder deploy/ di VPS:
#
#   sudo ./deploy/scripts/install.sh
#
# Yang dilakukan: user sistem `pastel`, folder /opt/pastel, /etc/pastel, /var/backups/pastel,
# salin skrip ke /opt/pastel/deploy, pasang unit systemd, aktifkan timer backup.
# Yang TIDAK dilakukan: memasang paket apt, mengubah konfigurasi proxy/firewall/DNS, menjalankan aplikasi.
# File konfigurasi yang sudah ada di /etc/pastel tidak pernah ditimpa.
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEPLOY_SRC=$(cd "$SCRIPT_DIR/.." && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

need_root
need systemctl sqlite3 curl gzip sha256sum flock runuser install
command -v rclone >/dev/null 2>&1 || log "PERINGATAN: rclone belum terpasang, backup off-site belum bisa jalan"

if ! id -u "$PASTEL_USER" >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/pastel --no-create-home --shell /usr/sbin/nologin "$PASTEL_USER"
  log "user $PASTEL_USER dibuat"
fi

install -d -o root -g root -m 0755 "$PASTEL_HOME" "$PASTEL_HOME/releases"
install -d -o root -g "$PASTEL_USER" -m 0750 /etc/pastel
install -d -o "$PASTEL_USER" -g "$PASTEL_USER" -m 0700 \
  "$BACKUP_DIR" "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly" "$BACKUP_DIR/predeploy"

# Skrip & dokumen deploy (milik root, hanya dibaca service).
rm -rf -- "$PASTEL_HOME/deploy.new"
cp -a -- "$DEPLOY_SRC" "$PASTEL_HOME/deploy.new"
chown -R root:root "$PASTEL_HOME/deploy.new"
chmod -R go-w "$PASTEL_HOME/deploy.new"
rm -rf -- "$PASTEL_HOME/deploy.old"
[[ ! -d $PASTEL_HOME/deploy ]] || mv -T "$PASTEL_HOME/deploy" "$PASTEL_HOME/deploy.old"
mv -T "$PASTEL_HOME/deploy.new" "$PASTEL_HOME/deploy"
log "skrip disalin ke $PASTEL_HOME/deploy"

for f in pastel.env backup.env; do
  if [[ ! -e /etc/pastel/$f ]]; then
    install -o root -g "$PASTEL_USER" -m 0640 "$DEPLOY_SRC/env/$f.example" "/etc/pastel/$f"
    log "/etc/pastel/$f dibuat dari contoh: periksa isinya"
  fi
done

for u in pastel.service pastel-backup.service pastel-backup.timer; do
  install -o root -g root -m 0644 "$DEPLOY_SRC/systemd/$u" "/etc/systemd/system/$u"
done
systemctl daemon-reload
systemctl enable pastel.service
systemctl enable --now pastel-backup.timer
log "unit systemd terpasang; pastel.service aktif saat boot, start pertama lewat deploy.sh"

cat >&2 <<EOF

Langkah berikutnya (lihat deploy-plan.md):
  1. Periksa /etc/pastel/pastel.env dan /etc/pastel/backup.env
  2. Siapkan /etc/pastel/rclone.conf (root:$PASTEL_USER 0640) untuk backup off-site
  3. $PASTEL_HOME/deploy/scripts/deploy.sh <binary> <versi>
  4. Pasang konfigurasi proxy (Caddy ATAU nginx) dari $PASTEL_HOME/deploy/{caddy,nginx}/
EOF
