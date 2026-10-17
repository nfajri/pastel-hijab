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
