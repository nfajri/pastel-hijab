# Toko Hijab — Pembukuan, Stok & Pricing

## Tujuan
Aplikasi web (PWA) untuk usaha jual beli hijab istri Bos ("Ibu", pengguna tunggal; iPhone + laptop Windows): pembukuan sederhana, stok per model, dan kalkulator harga per saluran. Catat 1 transaksi < 1 menit di HP.

## Spesifikasi
`office/docs/toko-hijab/spesifikasi-pembukuan-stok-hijab.md` (FINAL v3, disetujui Bos 17 Okt 2026 14.14, analis Maya). Rumus di §5.4, kriteria penerimaan QC di §7 (17 butir).

## Urutan kerja (K-13, Bos)
1. Desain UI/UX (prototipe) -> direview & disetujui Bos
2. Baru coding v1

## Ruang lingkup v1
Produk & barang masuk (komponen modal fleksibel), pengaturan saluran & komponen potongan, kalkulator harga (3 cara target untung, pembulatan), penjualan (stok ditolak bila kurang, HPP dicatat), biaya operasional & penyesuaian stok, laporan laba, ekspor Excel, login 1 akun.

## Di luar ruang lingkup
Integrasi marketplace, varian warna/ukuran, reseller, retur, promo, akun lihat-saja Bos, pre-order.

## Syarat teknis
Biaya rendah, ada backup, HTTPS. Mobile-first (iPhone), terutama layar catat penjualan dan kalkulator harga.

## Kriteria selesai
Semua 17 butir §7 lolos QC; Bos menyetujui desain sebelum coding.

---

## Frontend

Vite + React + TypeScript + Tailwind CSS v4, hash router. Tahap 1 (T-0134) terhubung ke API Go (`server/API.md`): login, pengaturan, produk, barang masuk, penyesuaian stok. Tahap 2 (beranda, transaksi, catat penjualan, kalkulator harga, pengeluaran, laporan) masih halaman prototipe dengan data tiruan (`src/__prototipe__/`). Tanpa localStorage/CDN/font eksternal; sesi = cookie HttpOnly dari server.

```bash
npm install
# terminal 1: API lokal (binary Go, DB sementara, cookie tanpa Secure karena http)
(cd server && go build -o /tmp/pastel .) && printf 'sandi-uji-123\n' | PASTEL_DB=/tmp/p.db /tmp/pastel create-user ibu
PASTEL_DB=/tmp/p.db PASTEL_COOKIE_SECURE=0 /tmp/pastel serve      # 127.0.0.1:8087
# terminal 2: frontend, /api diteruskan ke 127.0.0.1:8087 (ubah dengan PASTEL_API=http://host:port)
npm run dev       # http://localhost:5173 (start Vite bisa ±10 dtk), coba lebar 390px & 1280px
npm run build     # tsc + vite build --base ./  -> dist/
npm test          # rumus pratinjau modal (src/lib/modal.ts) vs contoh spesifikasi §7
```

Atau satu proses: `npm run build`, lalu jalankan server dengan `PASTEL_STATIC_DIR=$PWD/dist` (same-origin, seperti produksi).

### Struktur
- `src/lib/api.ts` — klien `fetch` (cookie sesi, JSON, `ApiError`, 401 → layar Masuk); `api-types.ts` = tipe respons `server/API.md`; `useApi` (GET + memuat/gagal), `useKirim` (aksi ubah-data), `auth.tsx` (`AuthProvider`, `RequireAuth`), `toast.tsx`.
- `src/lib/modal.ts` — pratinjau modal di form Barang masuk (rumus §5.2/K-8, sama dengan `server/internal/hitung`). Angka resmi selalu dari respons server; browser tidak menghitung ulang modal tersimpan. `hitung.ts` (harga, pembulatan, potongan) dipakai kalkulator tahap 2.
- `src/components/ui/` — Button, Input, RupiahInput, Card, Sheet, Tabs, dan `kit.tsx` (Ikon, BilahAtas/Bawah, Pilihan, Stepper, Lencana, Daftar, Kosong/Gagal/Kerangka, Saklar…). `components/layout/Layout.tsx` — LayoutTab (tab bar HP) / LayoutFokus + sidebar laptop. `components/DataState.tsx` — memuat/gagal/isi.
- `src/pages/` — `Masuk`, `Produk`, `ProdukDetail`, `ProdukForm`, `BarangMasuk` (baru & ubah), `PenyesuaianStok`, `pengaturan/*` (menu, saluran & potongan, komponen modal, pembulatan, ganti sandi).
- `src/__prototipe__/` — prototipe desain final (T-0128) + data tiruan untuk layar tahap 2. `npx vite build --config vite.prototipe.config.ts --base ./ --outDir dist-prototipe`.
- `public/manifest.webmanifest`, `public/icons/` — manifest PWA Pastel Hijab. Belum ada service worker.
