# deploy/: Pastel Hijab di VPS (pastel.diatera.com)

Runbook lengkap: `office/projects/toko-hijab-pembukuan-stok-pricing/docs/deploy-plan.md`.

| Berkas | Fungsi |
|---|---|
| `scripts/vps-check.sh` | Inventaris VPS (baca saja): port, disk, proxy, certbot, firewall, DNS |
| `scripts/install.sh` | Persiapan pertama: user `pastel`, folder, unit systemd, timer backup (idempoten) |
| `scripts/deploy.sh <binary> [versi]` | Backup pra-deploy → rilis baru → restart → health check, kembali otomatis bila gagal |
| `scripts/rollback.sh [--to v] [--with-db file]` | Kembali ke rilis sebelumnya, opsional pulihkan DB |
| `scripts/backup.sh [--tag label]` | `sqlite3 .backup` + integrity check + gzip + sha256 + retensi + rclone off-site |
| `scripts/restore.sh <file>` | Pulihkan DB produksi (dengan backup pre-restore & batal otomatis bila tidak sehat) |
| `scripts/restore-test.sh <file> [--binary b]` | Uji restore di folder sementara, tidak menyentuh produksi |
| `systemd/` | `pastel.service` (hardening), `pastel-backup.service` + `.timer` (02.30 WIB) |
| `caddy/pastel.caddy` | Blok situs Caddy (HTTPS otomatis) |
| `nginx/pastel.http-only.conf`, `nginx/pastel.conf` | nginx tahap 1 (ambil sertifikat) & tahap 2 (HTTPS + proxy) |
| `env/*.env.example` | Contoh `/etc/pastel/pastel.env` & `backup.env` (tanpa secret) |

Lint: `shellcheck -x deploy/scripts/*.sh` (bisa tanpa install: `uvx --from shellcheck-py shellcheck -x ...`).
