# Kontrak API Pastel Hijab

Status: **lengkap untuk v1**.
- Tahap 1 (T-0131): auth, pengaturan, komponen modal, saluran & potongan, produk & harga, barang masuk, penyesuaian stok.
- Tahap 2 (T-0135): penjualan, kalkulator harga, pengeluaran & kategorinya, laporan, ekspor Excel, target harga per saluran.

Perubahan yang bisa merusak frontend akan dicatat di bagian "Riwayat" paling bawah.

## Aturan umum

- Basis `/api`, same-origin (frontend dilayani binary yang sama). Pakai `fetch(url, {credentials: "same-origin"})`.
- Body & respons JSON. Request yang mengubah data (POST/PUT/PATCH/DELETE ber-body) **wajib** `Content-Type: application/json`
  (415 jika tidak). Request lintas situs ditolak 403.
- Field tak dikenal di body → 400. `PATCH` = ubah sebagian: field yang tidak dikirim tetap; `null` mengosongkan field yang boleh kosong.
- Sukses: `200` (baca/ubah, mengembalikan objek terbaru), `201` (buat, mengembalikan objek baru), `204` (hapus/logout, tanpa body).
- Error: `{"error": "pesan siap tampil ke pengguna"}`.

  | Kode | Arti | Saran frontend |
  |---|---|---|
  | 400 | input salah | tampilkan `error` di form |
  | 401 | belum login / sesi habis (juga login gagal) | arahkan ke layar login (kecuali di layar login itu sendiri) |
  | 403 | lintas situs; password lama salah | |
  | 404 | data/endpoint tidak ada | |
  | 409 | bentrok (stok kurang, nama dobel, masih dipakai) | tampilkan `error` (sudah berisi alasan, mis. "Stok tersisa 3 …") |
  | 415 | Content-Type bukan JSON | bug frontend |
  | 429 | terlalu banyak login gagal | body juga berisi `retry_after_detik` |

### Satuan

| Data | Tipe | Contoh |
|---|---|---|
| Rupiah (harga, harga beli, maks potongan) | integer | `20000` |
| Modal per pcs (`modal`, `modal_pcs`, `per_pcs`) | number, 2 desimal | `21333.33` |
| Persen | number, ditulis apa adanya | `2` = 2%, `2.5` = 2,5% |
| Tanggal transaksi | `"YYYY-MM-DD"`; kosong/tidak dikirim = hari ini (WIB) | `"2026-10-17"` |
| Waktu sistem (`created_at`, `updated_at`) | ISO UTC | `"2026-10-17T10:00:00.000Z"` |
| `id` | integer | |

Daftar (list) selalu array JSON polos, `[]` bila kosong.

## Health

`GET /api/health` → `200 {"status":"ok"}` (tanpa sesi; `503` bila DB tidak siap).

## Auth

Sesi = cookie HttpOnly (tidak bisa dibaca JS). Untuk tahu sudah login atau belum, panggil `GET /api/auth/saya`: 200 = login, 401 = belum.

| Endpoint | Body | Respons |
|---|---|---|
| `POST /api/auth/login` | `{username, password}` | `200 {username}` + cookie. Gagal: `401 "Username atau password salah"`, `429` |
| `POST /api/auth/logout` | – | `204` |
| `POST /api/auth/logout-semua` | – | `204` (semua perangkat keluar, termasuk ini) |
| `POST /api/auth/ganti-password` | `{password_lama, password_baru}` (8–72 karakter) | `204`; sesi lain dicabut, sesi ini tetap. Password lama salah → `403` |
| `GET /api/auth/saya` | – | `200 {username, sesi_kedaluwarsa, jumlah_sesi_aktif}` |

Tidak ada pendaftaran dari web. Akun dibuat lewat CLI (`pastel create-user`).

## Pengaturan

```ts
type Pengaturan = { pembulatan_bawaan: "tanpa" | "100" | "500" | "1000" | "cantik" }  // awal "1000"
```
- `GET /api/pengaturan` → `Pengaturan`
- `PATCH /api/pengaturan` `{pembulatan_bawaan}` → `Pengaturan`

Bawaan pembulatan dipakai kalkulator bila `pembulatan` tidak dikirim. Kategori pengeluaran: lihat bagian [Pengeluaran](#pengeluaran).

## Komponen modal (§5.2)

```ts
type KomponenModal = {
  id: number; nama: string;
  jenis: "per_pcs" | "per_kulakan" | "persen_harga_beli";
  nilai: number;          // Rp untuk per_pcs/per_kulakan, persen untuk persen_harga_beli
  aktif: boolean; urutan: number; created_at: string; updated_at: string;
}
```
- `GET /api/komponen-modal[?aktif=1]` → `KomponenModal[]` (urut `urutan`, lalu `id`)
- `POST /api/komponen-modal` `{nama, jenis, nilai, aktif?=true, urutan?=0}` → `201 KomponenModal`
- `PATCH /api/komponen-modal/{id}` (field mana pun di atas) → `KomponenModal`
- `DELETE /api/komponen-modal/{id}` → `204`

Mengubah/menghapus komponen tidak mengubah kulakan lama (tiap kulakan menyimpan salinannya).

## Saluran & potongan (§5.3)

```ts
type Potongan = {
  id: number; saluran_id: number; nama: string;
  jenis: "persen" | "per_pesanan" | "per_pcs";
  nilai: number;          // persen atau Rp
  maks_rp: number | null; // hanya untuk jenis "persen"; null = tanpa batas
  aktif: boolean; urutan: number; created_at: string; updated_at: string;
}
type Saluran = {
  id: number; nama: string; aktif: boolean; urutan: number;
  created_at: string; updated_at: string;
  potongan: Potongan[];
}
```
Data awal: Shopee, Tokopedia, TikTok Shop, Pasar Minggu (belum ada potongan; diisi Ibu). Saluran tidak bisa dihapus, cukup `aktif: false`.

- `GET /api/saluran[?aktif=1]` → `Saluran[]`
- `GET /api/saluran/{id}` → `Saluran`
- `POST /api/saluran` `{nama, aktif?, urutan?}` → `201 Saluran` (nama dobel → 409)
- `PATCH /api/saluran/{id}` `{nama?, aktif?, urutan?}` → `Saluran`
- `POST /api/saluran/{id}/potongan` `{nama, jenis, nilai, maks_rp?, aktif?, urutan?}` → `201 Potongan`
- `PATCH /api/potongan/{id}` → `Potongan` · `DELETE /api/potongan/{id}` → `204`

## Produk & harga jual per saluran

```ts
type CaraTarget = "persen_jual" | "persen_modal" | "rupiah"
type HargaSaluran = {
  saluran_id: number; harga: number;
  target_cara: CaraTarget | null;  // disimpan "Pakai harga ini"; null = harga diisi tanpa target
  target_nilai: number | null;     // 30 = 30% (persen_*), atau Rp (rupiah)
  untung: number;                  // untung/pcs di harga ini dengan modal & potongan saluran SEKARANG (2 desimal)
  di_bawah_target: boolean;        // target ada dan untung sekarang di bawahnya → lencana "Di bawah target"
  updated_at: string;
}
type Produk = {
  id: number; nama: string; kategori: string;
  stok: number;                 // pcs, tidak pernah minus
  modal: number;                // modal/pcs rata-rata tertimbang, 2 desimal
  batas_stok_menipis: number;
  menipis: boolean;             // stok <= batas_stok_menipis
  di_bawah_target: boolean;     // ada harga di saluran aktif yang di bawah target (Beranda "Harga di bawah target untung")
  terjual_30_hari: number;      // pcs terjual 30 hari terakhir (urutan "terlaris" di /jual)
  aktif: boolean; created_at: string; updated_at: string;
  harga: HargaSaluran[];        // hanya saluran yang sudah diberi harga
}
```
`di_bawah_target` dihitung ulang setiap dibaca, jadi otomatis muncul setelah kulakan baru menaikkan modal
(atau potongan saluran naik) dan hilang lagi setelah harga diperbarui.

- `GET /api/produk[?aktif=1&menipis=1&di_bawah_target=1&q=teks]` → `Produk[]` (`q` mencari di nama & kategori)
- `GET /api/produk/{id}` → `Produk`
- `POST /api/produk` `{nama, kategori?, batas_stok_menipis?, aktif?}` → `201 Produk` (stok & modal mulai 0)
- `PATCH /api/produk/{id}` `{nama?, kategori?, batas_stok_menipis?, aktif?}` → `Produk`. Stok/modal hanya berubah lewat transaksi.
- `DELETE /api/produk/{id}` → `204`; `409` bila sudah punya riwayat stok atau penjualan (sarankan "Nonaktifkan").
- `PUT /api/produk/{id}/harga/{saluran_id}` `{harga, target_cara?, target_nilai?}` → `Produk` (tombol "Pakai harga ini").
  Target dikirim berpasangan (dua-duanya atau tidak sama sekali); tidak dikirim = target dikosongkan.
- `DELETE /api/produk/{id}/harga/{saluran_id}` → `204`

## Barang masuk (kulakan)

```ts
type KomponenKulakan = {
  komponen_id: number | null;   // null = komponen khusus kulakan ini
  nama: string; jenis: KomponenModal["jenis"];
  nilai: number;
  per_pcs: number;              // kontribusi ke modal/pcs, 2 desimal
}
type BarangMasuk = {
  id: number; tanggal: string; supplier: string;
  produk_id: number; produk_nama: string;
  qty: number; harga_beli: number;   // harga beli per pcs (Rp)
  modal_pcs: number;                 // harga_beli + Σ per_pcs
  modal_sebelum: number;             // modal produk sebelum kulakan ini
  catatan: string; created_at: string; updated_at: string;
  komponen: KomponenKulakan[];
}
type BarangMasukInput = {
  tanggal?: string; supplier?: string; produk_id: number; qty: number; harga_beli: number; catatan?: string;
  komponen?: Array<
    | { komponen_id: number; nilai?: number }                          // dari master; nilai bawaan bila tidak dikirim
    | { nama: string; jenis: KomponenModal["jenis"]; nilai: number }   // khusus kulakan ini
  >;
}
```
- `GET /api/barang-masuk[?produk_id=&dari=YYYY-MM-DD&sampai=YYYY-MM-DD&limit=200]` → `BarangMasuk[]` (terbaru dulu)
- `GET /api/barang-masuk/{id}` → `BarangMasuk`
- `POST /api/barang-masuk` `BarangMasukInput` → `201 BarangMasuk`. Stok produk bertambah `qty`, modal produk dihitung ulang.
  - `komponen` tidak dikirim = semua komponen aktif dengan nilai bawaan; `[]` = tanpa komponen.
- `PUT /api/barang-masuk/{id}` `BarangMasukInput` → `BarangMasuk` (`komponen` tidak dikirim = pakai komponen tersimpan kulakan ini)
- `DELETE /api/barang-masuk/{id}` → `204`

Ubah/hapus ditolak `409` bila stok sekarang < qty kulakan itu (sebagian sudah terjual/dikeluarkan). Pesannya sudah siap tampil.

Contoh:
```json
POST /api/barang-masuk
{"tanggal": "2026-10-17", "supplier": "Tanah Abang", "produk_id": 1, "qty": 3, "harga_beli": 20000,
 "komponen": [{"komponen_id": 1}, {"nama": "Ongkir", "jenis": "per_kulakan", "nilai": 10000}]}
```
→ `modal_pcs` = 20000 + (komponen 1) + 3333.33.

Pratinjau modal di form (sebelum simpan) dihitung di frontend dengan rumus yang sama (§5.2):
`per_pcs` = `nilai` (per_pcs) · `nilai / qty` (per_kulakan) · `harga_beli × nilai / 100` (persen_harga_beli), dibulatkan 2 desimal.
Nilai resmi tetap dari respons server.

## Penyesuaian stok

```ts
type Penyesuaian = {
  id: number; tanggal: string; produk_id: number; produk_nama: string;
  selisih: number;              // + menambah, − mengurangi
  alasan: string; stok_sebelum: number; stok_sesudah: number; created_at: string;
}
```
- `GET /api/penyesuaian-stok[?produk_id=]` → `Penyesuaian[]` (terbaru dulu, maks 500)
- `POST /api/penyesuaian-stok` `{produk_id, alasan, selisih}` **atau** `{produk_id, alasan, stok_fisik}` (hasil hitung fisik), `tanggal?` → `201 Penyesuaian`
  — tidak mengubah modal; stok tidak boleh minus (`409`).
- `DELETE /api/penyesuaian-stok/{id}` → `204` (membatalkan, stok dikembalikan; `409` bila stok jadi minus)

## Penjualan (§5.5)

Satu penjualan = satu pesanan di satu saluran, bisa beberapa model.

```ts
type BarisJual = {
  id: number; produk_id: number; produk_nama: string;
  qty: number; harga: number;     // harga jual/pcs final (Rp)
  subtotal: number;               // qty × harga
  hpp: number;                    // modal/pcs SAAT dijual (2 desimal), tidak ikut berubah bila modal berubah kemudian
  hpp_total: number;              // qty × hpp
  potongan: number;               // bagian baris dari potongan pesanan (sebanding subtotal), untuk laba per model
  untung: number;                 // subtotal − potongan − hpp_total
}
type RincianPotonganJual = {
  potongan_id: number | null;     // null bila komponennya sudah dihapus dari pengaturan
  nama: string; jenis: Potongan["jenis"]; nilai: number; maks_rp: number | null;
  rp: number;                     // rupiah komponen ini untuk pesanan ini (otomatis)
}
type Penjualan = {
  id: number; tanggal: string; saluran_id: number; saluran_nama: string; catatan: string;
  baris: BarisJual[];
  qty: number;                    // total pcs
  subtotal: number;               // "Total harga" (omzet)
  potongan_otomatis: number;      // Σ rincian_potongan[].rp
  potongan: number;               // final (= otomatis, atau "Potongan sebenarnya" yang diketik)
  potongan_diubah: boolean;       // label "(diubah)"
  rincian_potongan: RincianPotonganJual[];
  uang_diterima: number;          // subtotal − potongan
  hpp_total: number;              // "Modal (HPP)"
  untung: number;                 // uang_diterima − hpp_total ("Untung (setelah modal)"), boleh negatif
  created_at: string; updated_at: string;
}
type PenjualanInput = {
  tanggal?: string;               // kosong = hari ini; tidak boleh setelah hari ini
  saluran_id: number;
  catatan?: string;
  potongan?: number;              // tidak dikirim = otomatis; dikirim = potongan sebenarnya (mis. ada voucher)
  baris: Array<{ produk_id: number; qty: number; harga?: number }>;  // harga tidak dikirim = harga produk di saluran ini
}
```
- `GET /api/penjualan[?dari=&sampai=&saluran_id=&produk_id=&limit=200]` → `Penjualan[]` (terbaru dulu, limit maks 5000).
  "Saluran terakhir dipakai" = `GET /api/penjualan?limit=1`.
- `GET /api/penjualan/{id}` → `Penjualan`
- `POST /api/penjualan` `PenjualanInput` → `201 Penjualan`. Stok semua baris berkurang dalam satu transaksi.
- `POST /api/penjualan/hitung` `PenjualanInput` (+ `id?` untuk pratinjau edit) → `200 Penjualan` dengan `id: 0`:
  hitungan & cek stok persis seperti simpan, **tanpa menyimpan**. Cocok untuk layar "Periksa".
- `PUT /api/penjualan/{id}` `PenjualanInput` → `Penjualan`. Stok versi lama dikembalikan dulu, lalu versi baru dicek & diterapkan.
  Model yang sudah ada di versi lama tetap memakai `hpp` lamanya; model baru memakai modal sekarang.
- `DELETE /api/penjualan/{id}` → `204` ("Penjualan dihapus, stok dikembalikan."). Modal produk tidak berubah.

Aturan:
- **Potongan otomatis per pesanan** (K-12): `persen` = % × subtotal pesanan (dibatasi `maks_rp` per pesanan), `per_pesanan` sekali
  (2 pcs dengan Rp1.250/pesanan → Rp1.250, bukan Rp2.500), `per_pcs` × total qty. Hanya komponen aktif. Tiap komponen dibulatkan
  ke rupiah, `potongan_otomatis` = jumlahnya (jadi rincian selalu cocok dengan totalnya).
- Model nonaktif, saluran nonaktif, model yang sama dua kali, `qty` < 1, tanggal depan → `400`.
- Harga tidak dikirim dan belum ada harga di saluran itu → `400 "Harga {model} di {saluran} belum diatur. Isi harga"`.
- **Stok kurang (K-11)** → seluruh pesanan ditolak, stok tidak berubah:
  ```json
  409 {"error": "Stok tidak cukup. Pashmina Ceruty: stok tersisa 3",
       "stok_kurang": [{"produk_id": 1, "produk_nama": "Pashmina Ceruty", "qty": 4, "stok": 3, "pesan": "Stok tersisa 3"}]}
  ```
  `pesan` = `"Stok tersisa N"` atau `"Stok habis"`, satu entri per baris yang kurang (untuk teks merah per baris).
  Saat edit, `stok` = stok yang tersedia untuk pesanan ini (stok sekarang + qty lama).

## Kalkulator harga (§5.4)

Tidak menyimpan apa pun. "Pakai harga ini" = `PUT /api/produk/{id}/harga/{saluran_id}` dengan `target_cara` & `target_nilai`.

`POST /api/kalkulator`
```ts
type KalkulatorInput = {
  produk_id?: number;             // salah satu: produk_id (modal produk sekarang) atau modal
  modal?: number;
  cara: CaraTarget; nilai: number;            // 30 = 30%, atau Rp untuk "rupiah"
  pembulatan?: "tanpa" | "100" | "500" | "1000" | "cantik";   // kosong = bawaan Pengaturan
  saluran_id?: number;            // kosong = semua saluran aktif (satu kartu per saluran)
  cek?: Array<{ saluran_id: number; harga: number }>;         // mode cek: harga yang diketik Ibu per kartu
}
type KartuSaluran = {
  saluran_id: number; saluran_nama: string;
  tercapai: boolean;              // false = target tidak bisa dicapai (potongan % + target % ≥ 100%)
  pesan: string;                  // penjelasan bila tidak tercapai, mis. "Potongan saluran 10% + target 90% = 100%. Jumlahnya harus di bawah 100%, turunkan target untung."
  mentah: number | null;          // harga target sebelum pembulatan (ke atas ke rupiah)
  saran: number | null;           // harga saran, sudah dibulatkan ke atas
  minimal: number | null;         // harga impas ("Minimal Rp…"); null bila potongan % ≥ 100%
  harga_sekarang: number | null;  // harga tersimpan ("· sekarang Rp…"), hanya bila produk_id
  target_sekarang: { cara: CaraTarget; nilai: number } | null;
  cek: boolean;                   // true = kartu menilai harga ketikan
  harga: number | null;           // harga yang dinilai (ketikan, atau saran); null bila tidak tercapai & tidak cek
  rincian: null | {
    harga: number; modal: number;
    potongan: Array<{ potongan_id: number; nama: string; jenis: Potongan["jenis"]; nilai: number; maks_rp: number | null; rp: number }>;
    total_potongan: number; untung: number;
    persen_jual: number; persen_modal: number;   // 2 desimal
  };
  status: "sesuai_target" | "di_bawah_target" | "rugi" | "tidak_tercapai";
  kurang_rp: number;              // status rugi: minimal − harga ("Rugi · kurang Rp…"), selain itu 0
}
type KalkulatorHasil = { produk_id: number | null; modal: number; cara: CaraTarget; nilai: number; pembulatan: string; saluran: KartuSaluran[] }
```
Rumus (sama dengan `src/__prototipe__/lib/hitung.ts`): asumsi 1 pcs per pesanan (K-12); p = total % potongan, f = Rp per pesanan + Rp per pcs.
Impas = (M + f) ÷ (1 − p); % jual: (M + f) ÷ (1 − p − m); % modal: (M + f + k·M) ÷ (1 − p); Rp: (M + f + R) ÷ (1 − p).
Potongan % yang melewati `maks_rp` dihitung ulang sebagai Rp tetap. Pembulatan selalu ke atas; harga cantik = ⌈(H + 100) ÷ 1.000⌉ × 1.000 − 100.

Contoh (§7 butir 5): modal 25.000, Shopee 10% + Rp1.250/pesanan, `{"produk_id": 1, "cara": "persen_jual", "nilai": 30}` →
kartu Shopee `mentah 43750, saran 44000, minimal 29167, status "sesuai_target"`, rincian potongan 4.400 + 1.250, untung 13.350 (30,34%).
Dengan `cek: [{"saluran_id": 1, "harga": 28000}]` → `status "rugi", kurang_rp 1167`.

## Pengeluaran

```ts
type KategoriPengeluaran = { id: number; nama: string; aktif: boolean; urutan: number; created_at: string; updated_at: string }
type Pengeluaran = {
  id: number; tanggal: string; kategori_id: number; kategori_nama: string;
  jumlah: number;                 // Rp, > 0
  catatan: string; created_at: string; updated_at: string;
}
```
Kategori bawaan: Sewa lapak, Iklan, Packaging massal, Lain-lain.
- `GET /api/kategori-pengeluaran[?aktif=1]` → `KategoriPengeluaran[]` (chip di `/pengeluaran/baru`)
- `POST /api/kategori-pengeluaran` `{nama, aktif?, urutan?}` → `201` (urutan bawaan = paling akhir; nama dobel → 409)
- `PATCH /api/kategori-pengeluaran/{id}` `{nama?, aktif?, urutan?}` → `KategoriPengeluaran`
- `DELETE /api/kategori-pengeluaran/{id}` → `204`; `409` bila sudah dipakai (nonaktifkan saja)
- `GET /api/pengeluaran[?dari=&sampai=&kategori_id=&limit=200]` → `Pengeluaran[]` (terbaru dulu)
- `GET /api/pengeluaran/{id}` → `Pengeluaran`
- `POST /api/pengeluaran` `{jumlah, kategori_id, tanggal?, catatan?}` → `201 Pengeluaran`
  (jumlah 0/kosong → `400 "Isi jumlah pengeluaran"`; kategori nonaktif / tanggal depan → 400)
- `PUT /api/pengeluaran/{id}` (body sama) → `Pengeluaran` (kategori lama boleh tetap dipakai walau sudah nonaktif)
- `DELETE /api/pengeluaran/{id}` → `204`

## Laporan (§5.6)

`GET /api/laporan[?dari=&sampai=&saluran_id=&produk_id=]` — bawaan: awal bulan ini s/d hari ini. Periode "Hari ini" =
`dari=sampai=hari ini` (juga untuk kartu "Penjualan hari ini" di Beranda); "Minggu ini" = Senin s/d hari ini (dihitung frontend).

```ts
type AngkaJual = {
  pesanan: number; pcs: number;
  omzet: number;                  // Σ qty × harga
  potongan: number;               // potongan saluran (final)
  hpp: number;                    // modal barang terjual (2 desimal)
  laba_kotor: number;             // omzet − potongan − hpp
}
type Laporan = {
  dari: string; sampai: string; saluran_id: number | null; produk_id: number | null;
  ringkasan: AngkaJual & {
    pengeluaran: number | null;   // null bila filter saluran/model aktif
    laba_bersih: number | null;   // laba_kotor − pengeluaran; null bila filter aktif
  };
  per_saluran: Array<AngkaJual & { saluran_id: number; saluran_nama: string }>;   // urut saluran
  per_produk: Array<AngkaJual & { produk_id: number; produk_nama: string; kategori: string }>;  // laba kotor terbesar dulu
  pengeluaran_per_kategori: Array<{ kategori_id: number; kategori_nama: string; jumlah: number }>;
  stok: {
    total_pcs: number; nilai_stok: number;          // Σ stok × modal
    produk: StokModel[];                            // produk aktif + nonaktif yang masih punya stok
    menipis: StokModel[];                           // produk aktif dengan stok ≤ batas
  };
}
type StokModel = { produk_id: number; produk_nama: string; kategori: string; stok: number; modal: number;
                   nilai_stok: number; batas_stok_menipis: number; menipis: boolean; aktif: boolean }
```
- Filter saluran/model menyaring baris penjualan; `potongan` per model memakai bagian baris (`BarisJual.potongan`), jadi
  per saluran dan per model selalu berjumlah sama dengan ringkasan tanpa filter. `stok` tidak ikut difilter.
- Bila filter aktif, frontend menampilkan **Laba kotor** sebagai angka utama dan catatan "Pengeluaran tidak dibagi per saluran/model, …".
- Laba boleh negatif (tampilkan merah dengan "−").

## Ekspor Excel (§7 butir 14)

Unduh biasa (`<a href>` / `window.location`), cookie sesi ikut terkirim. Respons `.xlsx` + `Content-Disposition: attachment`.
- `GET /api/ekspor/laporan.xlsx[?dari=&sampai=&saluran_id=&produk_id=]` — "Laporan periode ini": sheet Ringkasan, Per saluran, Per model, Pengeluaran, Stok.
- `GET /api/ekspor/transaksi.xlsx[?dari=&sampai=]` — "Semua transaksi" (tanpa tanggal = semua): sheet Penjualan (per baris),
  Rincian potongan, Pengeluaran, Barang masuk, Penyesuaian stok.
- `GET /api/ekspor/produk.xlsx` — "Daftar produk": sheet Produk (stok, modal, nilai stok, harga & untung per saluran) dan Harga per saluran (dengan target).

Angka disimpan sebagai angka (bisa dijumlah di Excel), rupiah berformat `#,##0`.

## Riwayat

- 17 Okt 2026 — versi pertama (T-0131).
- 17 Okt 2026 — tahap 2 (T-0135): penjualan, kalkulator, pengeluaran, laporan, ekspor. Tambahan di tahap 1 (tidak merusak):
  `HargaSaluran` + `target_cara/target_nilai/untung/di_bawah_target`, `Produk` + `di_bawah_target/terjual_30_hari`,
  `PUT .../harga` menerima target, `GET /api/produk?di_bawah_target=1`; produk yang sudah terjual juga tidak bisa dihapus (409).
