#!/usr/bin/env bash
# Inventaris VPS SEBELUM memasang Pastel. Hanya membaca, tidak mengubah apa pun.
#
#   sudo ./vps-check.sh [domain] [port-app] > vps-check-$(date +%F).txt
#
# Root disarankan supaya nama proses pemilik port & konfigurasi proxy terbaca; tanpa root tetap jalan.
set -uo pipefail

DOMAIN=${1:-pastel.diatera.com}
APP_PORT=${2:-8087}

sec() { printf '\n===== %s =====\n' "$*"; }
run() { printf '$ %s\n' "$*"; "$@" 2>&1 || printf '(gagal/tidak ada: %s)\n' "$1"; }
has() { command -v "$1" >/dev/null 2>&1; }

sec "Sistem"
run cat /etc/os-release
run uname -a
run uptime
run timedatectl
[[ $(id -u) -eq 0 ]] || echo "CATATAN: bukan root, sebagian info bisa kosong"

sec "Sumber daya (disk, RAM, inode)"
run df -hT -x tmpfs -x devtmpfs -x overlay
run df -i /
run free -m
run nproc

sec "Port yang sedang dipakai (TCP listen)"
run ss -ltnp
for p in 80 443 "$APP_PORT" 18087; do
  if ss -ltn "sport = :$p" 2>/dev/null | grep -q LISTEN; then
    echo ">> port $p SUDAH DIPAKAI"
  else
    echo ">> port $p bebas"
  fi
done

sec "Reverse proxy terpasang"
for b in nginx caddy apache2 httpd traefik haproxy; do
  has "$b" && echo ">> $b: $(command -v "$b")"
done
has nginx && { run nginx -v; run nginx -T 2>/dev/null | grep -E '^\s*(server_name|listen|include)\b' | sort | uniq -c; }
has caddy && { run caddy version; run systemctl status caddy --no-pager -n 0; [[ -r /etc/caddy/Caddyfile ]] && run cat /etc/caddy/Caddyfile; }
has apache2 && run apache2 -v
run systemctl list-units --type=service --state=running --no-pager

sec "Sertifikat & certbot"
has certbot && { run certbot --version; run certbot certificates; }
run ls -la /etc/letsencrypt/live
run systemctl list-timers --all --no-pager

sec "Kontainer (bila ada)"
has docker && { run docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'; }

sec "Firewall"
has ufw && run ufw status verbose
has nft && run nft list ruleset
has iptables && run iptables -S

sec "Alat yang dibutuhkan Pastel"
for b in sqlite3 rclone curl gzip sha256sum flock runuser systemd-analyze; do
  if has "$b"; then echo "ada   $b ($(command -v "$b"))"; else echo "BELUM $b"; fi
done
has sqlite3 && run sqlite3 --version
has rclone && run rclone version
run systemctl --version

sec "DNS $DOMAIN"
if has dig; then run dig +short A "$DOMAIN"; run dig +short AAAA "$DOMAIN"; run dig +short CAA diatera.com
else run getent ahosts "$DOMAIN"; fi
echo "IP publik VPS:"
run curl -4 -fsS -m 5 https://api.ipify.org
echo
run curl -6 -fsS -m 5 https://api64.ipify.org
echo

sec "Bekas instalasi Pastel"
run id pastel
run ls -la /opt/pastel /etc/pastel /var/lib/pastel /var/backups/pastel
run systemctl status pastel pastel-backup.timer --no-pager -n 0

sec "Pembaruan keamanan & reboot"
[[ -f /var/run/reboot-required ]] && echo ">> REBOOT DIBUTUHKAN" || echo "tidak ada reboot tertunda"
has apt && run apt list --upgradable
run systemctl status unattended-upgrades --no-pager -n 0
