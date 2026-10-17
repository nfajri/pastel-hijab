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

## Frontend (kerangka prototipe)

Vite + React + TypeScript + Tailwind CSS v4, hash router. Belum ada backend. Tanpa localStorage/cookie/CDN/font eksternal.

```bash
npm install
npm run dev       # dev server (http://localhost:5173), coba lebar 390px & 1280px
npm run build     # tsc + vite build --base ./  -> dist/
npm run preview   # lihat hasil build
```

Hasil `dist/` bisa dibuka langsung sebagai file statis (`dist/index.html` lewat `file://`) atau di-host di folder statis mana pun: build memakai path relatif dan script klasik (bukan ES module) supaya tidak diblokir browser.

### Struktur
- `src/nav.tsx` — daftar menu (satu sumber untuk sidebar & tab bar).
- `src/components/layout/AppLayout.tsx` — bottom tab bar (< 768px) / sidebar (>= 768px).
- `src/pages/` — placeholder: Beranda, Produk, Penjualan, Kalkulator, Laporan, Pengaturan. `#/komponen` = galeri komponen (tidak ada di menu).
- `src/components/ui/` — Button, Input, RupiahInput (+ `formatRupiah`), Card, Sheet (bottom sheet di HP / modal di laptop), Tabs.
- `public/manifest.webmanifest`, `public/icons/` — manifest PWA dasar + ikon placeholder (ganti dengan ikon asli nanti). Meta iOS & `viewport-fit=cover` ada di `index.html`; safe-area dipakai di layout. Belum ada service worker.
