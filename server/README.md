# Server Pastel Hijab (Go + SQLite)

Satu binary: API JSON di `/api/*` + menyajikan build frontend (`dist/`). Database SQLite satu file
(driver `modernc.org/sqlite`, tanpa CGO). Spesifikasi: `office/docs/toko-hijab/spesifikasi-pembukuan-stok-hijab.md`.

## Build & uji

Butuh Go ≥ 1.26.

```bash
cd server
go test ./...
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o toko-hijab .
# untuk VPS amd64 dari mesin lain:
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o toko-hijab .
```

## Perintah

```bash
toko-hijab [serve]                         # jalankan server
toko-hijab user create <username>          # buat akun; password diketik 2× (tanpa gema) atau 1 baris dari stdin
toko-hijab user set-password <username>    # reset lupa password; semua sesi dicabut
toko-hijab backup /path/backup-YYYYMMDD.db # salinan konsisten (VACUUM INTO), aman saat server jalan; tidak menimpa file
toko-hijab migrate                         # terapkan migrasi lalu keluar (serve juga otomatis migrasi)
```

Tidak ada akun/password bawaan. Setelah deploy pertama: `toko-hijab user create ibu`.

## Konfigurasi (env)

| Env | Bawaan | Keterangan |
|---|---|---|
| `ADDR` | `127.0.0.1:8080` | alamat dengar; di VPS biarkan localhost, Caddy yang membuka HTTPS |
| `DB_PATH` | `data/toko-hijab.db` | file SQLite (folder dibuat otomatis, mode 0700). Ada juga `-wal`/`-shm` di sebelahnya |
| `STATIC_DIR` | (kosong) | folder build frontend (`dist/`). Kosong = API saja |
| `COOKIE_SECURE` | `true` | cookie sesi `__Host-sesi; Secure`. Set `false` hanya untuk uji lokal via http |
| `TRUST_PROXY` | `false` | `true` bila di belakang Caddy: IP klien (untuk rate limit) dari entri terakhir `X-Forwarded-For` |
| `SESSION_DAYS` | `30` | sesi kedaluwarsa bila tidak dipakai selama N hari (diperpanjang otomatis saat dipakai) |

Contoh produksi (di belakang Caddy `pastel.diatera.com`):
`ADDR=127.0.0.1:8080 DB_PATH=/var/lib/toko-hijab/toko-hijab.db STATIC_DIR=/opt/toko-hijab/dist TRUST_PROXY=true toko-hijab serve`

Uji lokal: `COOKIE_SECURE=false STATIC_DIR=../dist ADDR=127.0.0.1:8931 ./toko-hijab`.

## Keamanan

- Password bcrypt (cost 11), 8–72 byte. Login gagal: username tidak ada & password salah dijawab sama ("Username atau password salah").
- Sesi: token acak 256-bit di cookie `HttpOnly; Secure; SameSite=Strict` (prefix `__Host-`); DB hanya menyimpan SHA-256-nya.
- Rate limit: 5 gagal dari satu IP dalam 15 menit → 429 sampai 15 menit sejak kegagalan ke-5 terakhir (+ `Retry-After`).
  Lapis kedua: 20 gagal dari IP mana pun dalam 15 menit → semua login dikunci sementara. Password lama salah di
  "ganti password" juga dihitung.
- Semua `/api/*` selain `POST /api/auth/login` wajib sesi → 401 (termasuk path tak dikenal).
- CSRF: SameSite=Strict + request yang mengubah data wajib `Content-Type: application/json`, dan ditolak (403) bila
  `Origin` beda host atau `Sec-Fetch-Site` = cross-site/same-site.
- Header: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, CSP di HTML. HSTS diserahkan ke Caddy.

## Frontend & cache PWA

Hash router, jadi semua halaman = `index.html`. Path tanpa ekstensi yang tidak ada → `index.html`; file yang hilang → 404.
`Cache-Control`: `index.html`, `*.webmanifest`, `sw.js` → `no-cache`; `assets/*` (nama ber-hash) → 1 tahun `immutable`;
lainnya (ikon) → 1 hari.

## Satuan data

- Rupiah (harga, potongan Rp, batas maks) = bilangan bulat.
- Modal/pcs = desimal 2 angka (mis. ongkir Rp10.000 ÷ 3 pcs). Persen ditulis `2` untuk 2%.
- Tanggal transaksi `YYYY-MM-DD` (kosong = hari ini WIB). Waktu sistem = UTC `2026-10-17T10:00:00.000Z`.

## API

Semua body & respons JSON. Error: `{"error": "pesan untuk pengguna"}` dengan kode 400 (input), 401 (belum login),
403, 404, 409 (bentrok stok/data), 415, 429. Field tak dikenal di body ditolak 400.
`PATCH` = ubah sebagian (field yang tidak dikirim tetap; `null` untuk mengosongkan field yang boleh kosong).

### Auth
| | |
|---|---|
| `POST /api/auth/login` `{username, password}` | → `{username}` + cookie sesi |
| `POST /api/auth/logout` | → 204, sesi ini dihapus |
| `POST /api/auth/logout-semua` | → 204, semua perangkat keluar |
| `POST /api/auth/ganti-password` `{password_lama, password_baru}` | → 204; sesi lain dicabut, sesi ini tetap |
| `GET /api/auth/saya` | → `{username, sesi_kedaluwarsa, jumlah_sesi_aktif}` |

### Pengaturan
`GET /api/pengaturan` → `{pembulatan_bawaan}`; `PATCH {pembulatan_bawaan: "tanpa"|"100"|"500"|"1000"|"cantik"}` (awal `1000`).

### Komponen modal (§5.2)
- `GET /api/komponen-modal[?aktif=1]`
- `POST /api/komponen-modal` `{nama, jenis: "per_pcs"|"per_kulakan"|"persen_harga_beli", nilai, aktif?=true, urutan?}`
- `PATCH /api/komponen-modal/{id}` · `DELETE /api/komponen-modal/{id}`

Mengubah/menghapus komponen tidak mengubah kulakan yang sudah tercatat (tiap kulakan menyimpan salinan komponennya).

### Saluran & potongan (§5.3)
Awal: Shopee, Tokopedia, TikTok Shop, Pasar Minggu (tanpa potongan; diisi Ibu). Saluran tidak dihapus, cukup `aktif:false`.
- `GET /api/saluran[?aktif=1]` → daftar saluran, masing-masing dengan `potongan: [...]`
- `GET /api/saluran/{id}` · `POST /api/saluran` `{nama, aktif?, urutan?}` · `PATCH /api/saluran/{id}`
- `POST /api/saluran/{id}/potongan` `{nama, jenis: "persen"|"per_pesanan"|"per_pcs", nilai, maks_rp?, aktif?, urutan?}`
  — `maks_rp` hanya untuk `persen` (batas potongan Rp per pesanan/pcs; `null` = tanpa batas)
- `PATCH /api/potongan/{id}` · `DELETE /api/potongan/{id}`

### Produk
- `GET /api/produk[?aktif=1&menipis=1&q=teks]` — `menipis` = `stok <= batas_stok_menipis` (§7 butir 13)
- `GET /api/produk/{id}` → `{id, nama, kategori, stok, modal, batas_stok_menipis, menipis, aktif, harga: [{saluran_id, harga, updated_at}], ...}`
- `POST /api/produk` `{nama, kategori?, batas_stok_menipis?, aktif?}` — stok & modal mulai 0, isi lewat barang masuk
- `PATCH /api/produk/{id}` (nama, kategori, batas_stok_menipis, aktif; stok/modal tidak bisa diubah langsung)
- `DELETE /api/produk/{id}` — hanya bila belum punya riwayat stok (409 → nonaktifkan saja)
- `PUT /api/produk/{id}/harga/{saluran_id}` `{harga}` — harga jual per saluran ("Pakai harga ini") · `DELETE` sama untuk menghapus

### Barang masuk (kulakan)
- `GET /api/barang-masuk[?produk_id=&dari=YYYY-MM-DD&sampai=YYYY-MM-DD&limit=200]` · `GET /api/barang-masuk/{id}`
- `POST /api/barang-masuk`
  ```json
  {"tanggal": "2026-10-17", "supplier": "Tanah Abang", "produk_id": 1, "qty": 10, "harga_beli": 20000, "catatan": "",
   "komponen": [{"komponen_id": 1, "nilai": 1000}, {"nama": "Ongkir khusus", "jenis": "per_kulakan", "nilai": 30000}]}
  ```
  `komponen` tidak dikirim = semua komponen aktif dengan nilai bawaan; `[]` = tanpa komponen. Item dengan `komponen_id`
  boleh hanya mengirim `nilai` (nama/jenis dari master). Hasil: `modal_pcs` (§5.2) + rincian `per_pcs` tiap komponen;
  stok produk bertambah, modal produk = rata-rata tertimbang.
- `PUT /api/barang-masuk/{id}` (body sama; `komponen` tidak dikirim = pakai komponen tersimpan kulakan ini)
- `DELETE /api/barang-masuk/{id}`

Ubah/hapus = kulakan lama ditarik dulu (stok − qty, modal dibalik dengan menilai unit yang ditarik pada `modal_pcs`-nya),
lalu versi baru diterapkan. Ditolak 409 bila stok sekarang < qty kulakan itu (sebagian sudah terjual/dikeluarkan).
Bila stok habis karena penarikan, modal kembali ke `modal_sebelum` (modal produk sebelum kulakan itu).

### Penyesuaian stok
- `GET /api/penyesuaian-stok[?produk_id=]`
- `POST /api/penyesuaian-stok` `{produk_id, alasan, selisih: -2}` atau `{produk_id, alasan, stok_fisik: 7}` (hasil hitung fisik), `tanggal?`
  — tidak mengubah modal; stok tidak boleh minus (409 "Stok tersisa N …")
- `DELETE /api/penyesuaian-stok/{id}` — membatalkan (stok dikembalikan)

## Struktur

- `main.go` — perintah CLI & konfigurasi env
- `internal/hitung` — rumus murni modal (§5.2) + uji §7 butir 3 & 4
- `internal/db` — buka SQLite, migrasi berversi (`migrations/NNNN_*.sql`, tabel `schema_migrations`), backup
- `internal/app` — HTTP: auth, modul, penyaji frontend; `app_test.go` = uji API end-to-end (server TLS + DB sementara)

Migrasi baru: tambah file `internal/db/migrations/0002_nama.sql` (jangan ubah file yang sudah dirilis).
