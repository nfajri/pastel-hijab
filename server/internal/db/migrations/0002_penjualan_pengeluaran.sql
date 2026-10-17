-- 0002: target untung per produk-saluran, penjualan, pengeluaran (T-0135).

-- "Pakai harga ini" juga menyimpan cara & nilai target, supaya produk yang untungnya turun di bawah target
-- (modal naik / potongan berubah) bisa ditandai (§5.4 akhir). Keduanya NULL = harga diisi tanpa target.
ALTER TABLE harga_produk_saluran ADD COLUMN target_cara TEXT
  CHECK (target_cara IS NULL OR target_cara IN ('persen_jual', 'persen_modal', 'rupiah'));
ALTER TABLE harga_produk_saluran ADD COLUMN target_nilai REAL CHECK (target_nilai IS NULL OR target_nilai >= 0);

-- Penjualan = satu pesanan di satu saluran. Angka uang disimpan final (potongan bisa diubah manual, mis. voucher).
CREATE TABLE penjualan (
  id                INTEGER PRIMARY KEY,
  tanggal           TEXT    NOT NULL,
  saluran_id        INTEGER NOT NULL REFERENCES saluran(id) ON DELETE RESTRICT,
  catatan           TEXT    NOT NULL DEFAULT '',
  potongan_otomatis INTEGER NOT NULL CHECK (potongan_otomatis >= 0),
  potongan          INTEGER NOT NULL CHECK (potongan >= 0),
  potongan_diubah   INTEGER NOT NULL DEFAULT 0 CHECK (potongan_diubah IN (0, 1)),
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL
);
CREATE INDEX penjualan_tanggal ON penjualan(tanggal);
CREATE INDEX penjualan_saluran ON penjualan(saluran_id);

-- hpp = modal/pcs produk saat dijual (K-8), tidak ikut berubah bila modal berubah kemudian.
-- potongan = bagian baris dari potongan pesanan (sebanding subtotal), untuk laba per model.
CREATE TABLE penjualan_baris (
  id           INTEGER PRIMARY KEY,
  penjualan_id INTEGER NOT NULL REFERENCES penjualan(id) ON DELETE CASCADE,
  produk_id    INTEGER NOT NULL REFERENCES produk(id) ON DELETE RESTRICT,
  qty          INTEGER NOT NULL CHECK (qty > 0),
  harga        INTEGER NOT NULL CHECK (harga >= 0),
  hpp          REAL    NOT NULL CHECK (hpp >= 0),
  potongan     INTEGER NOT NULL CHECK (potongan >= 0)
);
CREATE INDEX penjualan_baris_penjualan ON penjualan_baris(penjualan_id);
CREATE INDEX penjualan_baris_produk ON penjualan_baris(produk_id);

-- Salinan komponen potongan otomatis saat pesanan dicatat (pengaturan saluran boleh berubah kemudian).
CREATE TABLE penjualan_potongan (
  id           INTEGER PRIMARY KEY,
  penjualan_id INTEGER NOT NULL REFERENCES penjualan(id) ON DELETE CASCADE,
  potongan_id  INTEGER REFERENCES potongan_saluran(id) ON DELETE SET NULL,
  nama         TEXT    NOT NULL,
  jenis        TEXT    NOT NULL,
  nilai        REAL    NOT NULL,
  maks_rp      INTEGER,
  rp           INTEGER NOT NULL
);
CREATE INDEX penjualan_potongan_penjualan ON penjualan_potongan(penjualan_id);

CREATE TABLE kategori_pengeluaran (
  id         INTEGER PRIMARY KEY,
  nama       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  aktif      INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  urutan     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
INSERT INTO kategori_pengeluaran (nama, urutan, created_at, updated_at) VALUES
  ('Sewa lapak', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('Iklan', 2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('Packaging massal', 3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('Lain-lain', 4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- Pengeluaran (biaya operasional §5.5; istilah UI "Pengeluaran").
CREATE TABLE pengeluaran (
  id          INTEGER PRIMARY KEY,
  tanggal     TEXT    NOT NULL,
  kategori_id INTEGER NOT NULL REFERENCES kategori_pengeluaran(id) ON DELETE RESTRICT,
  jumlah      INTEGER NOT NULL CHECK (jumlah > 0),
  catatan     TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
CREATE INDEX pengeluaran_tanggal ON pengeluaran(tanggal);
CREATE INDEX pengeluaran_kategori ON pengeluaran(kategori_id);
