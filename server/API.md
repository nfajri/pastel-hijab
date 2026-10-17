# Kontrak API Pastel Hijab — tahap 1

Status: **stabil untuk tahap 1** (T-0131: auth, pengaturan, komponen modal, saluran & potongan, produk & harga,
barang masuk, penyesuaian stok). Modul berikutnya (penjualan, kalkulator, **pengeluaran**, laporan) akan ditambahkan
di dokumen ini tanpa mengubah bentuk endpoint di bawah. Perubahan yang bisa merusak frontend akan dicatat di bagian
"Riwayat" paling bawah.

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

(Kategori pengeluaran untuk chip di `/pengeluaran/baru` akan ditambahkan di sini pada modul Pengeluaran.)

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
type HargaSaluran = { saluran_id: number; harga: number; updated_at: string }
type Produk = {
  id: number; nama: string; kategori: string;
  stok: number;                 // pcs, tidak pernah minus
  modal: number;                // modal/pcs rata-rata tertimbang, 2 desimal
  batas_stok_menipis: number;
  menipis: boolean;             // stok <= batas_stok_menipis
  aktif: boolean; created_at: string; updated_at: string;
  harga: HargaSaluran[];        // hanya saluran yang sudah diberi harga
}
```
- `GET /api/produk[?aktif=1&menipis=1&q=teks]` → `Produk[]` (`q` mencari di nama & kategori)
- `GET /api/produk/{id}` → `Produk`
- `POST /api/produk` `{nama, kategori?, batas_stok_menipis?, aktif?}` → `201 Produk` (stok & modal mulai 0)
- `PATCH /api/produk/{id}` `{nama?, kategori?, batas_stok_menipis?, aktif?}` → `Produk`. Stok/modal hanya berubah lewat transaksi.
- `DELETE /api/produk/{id}` → `204`; `409` bila sudah punya riwayat stok (sarankan "Nonaktifkan").
- `PUT /api/produk/{id}/harga/{saluran_id}` `{harga}` → `Produk` (tombol "Pakai harga ini" di kalkulator)
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

## Belum ada (modul berikutnya)

- **Penjualan** (`/api/penjualan`): catat jual per saluran, potongan otomatis, untung per transaksi.
- **Kalkulator harga** (`/api/kalkulator`): bisa juga dihitung di frontend; endpoint server menyusul agar rumusnya satu sumber.
- **Pengeluaran** (`/api/pengeluaran` + kategori di pengaturan): jumlah Rp, kategori, tanggal, catatan.
- **Laporan** (`/api/laporan`): omzet − potongan − modal terjual = laba kotor − pengeluaran = laba bersih.

Selama belum ada, frontend boleh memakai data tiruan dari prototipe untuk layar-layar itu.

## Riwayat

- 17 Okt 2026 — versi pertama (T-0131).
