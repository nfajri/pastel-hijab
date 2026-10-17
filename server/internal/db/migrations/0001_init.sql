-- 0001: auth, pengaturan, komponen modal, saluran & potongan, produk, barang masuk, penyesuaian stok.
-- Uang (harga, potongan Rp) = rupiah bulat (INTEGER). Modal/pcs = REAL 2 desimal. Persen = REAL (2 = 2%).
-- Waktu = teks RFC3339 UTC. Tanggal transaksi = teks YYYY-MM-DD.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

-- Token sesi hanya disimpan sebagai SHA-256; cookie berisi token aslinya.
CREATE TABLE sessions (
  id           INTEGER PRIMARY KEY,
  token_hash   TEXT    NOT NULL UNIQUE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT    NOT NULL,
  last_seen_at TEXT    NOT NULL,
  expires_at   TEXT    NOT NULL,
  user_agent   TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Percobaan login gagal untuk rate limit (dibersihkan berkala).
CREATE TABLE login_failures (
  id       INTEGER PRIMARY KEY,
  ip       TEXT NOT NULL,
  username TEXT NOT NULL,
  at       TEXT NOT NULL
);
CREATE INDEX login_failures_ip_at ON login_failures(ip, at);
CREATE INDEX login_failures_at ON login_failures(at);

CREATE TABLE pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL
);
INSERT INTO pengaturan (kunci, nilai) VALUES ('pembulatan_bawaan', '1000');

CREATE TABLE komponen_modal (
  id         INTEGER PRIMARY KEY,
  nama       TEXT    NOT NULL,
  jenis      TEXT    NOT NULL CHECK (jenis IN ('per_pcs', 'per_kulakan', 'persen_harga_beli')),
  nilai      REAL    NOT NULL DEFAULT 0 CHECK (nilai >= 0),
  aktif      INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  urutan     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

CREATE TABLE saluran (
  id         INTEGER PRIMARY KEY,
  nama       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  aktif      INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  urutan     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
INSERT INTO saluran (nama, urutan, created_at, updated_at) VALUES
  ('Shopee', 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('Tokopedia', 2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('TikTok Shop', 3, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('Pasar Minggu', 4, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- Komponen potongan per saluran (§5.3). maks_rp hanya untuk jenis persen (NULL = tanpa batas).
CREATE TABLE potongan_saluran (
  id         INTEGER PRIMARY KEY,
  saluran_id INTEGER NOT NULL REFERENCES saluran(id) ON DELETE CASCADE,
  nama       TEXT    NOT NULL,
  jenis      TEXT    NOT NULL CHECK (jenis IN ('persen', 'per_pesanan', 'per_pcs')),
  nilai      REAL    NOT NULL DEFAULT 0 CHECK (nilai >= 0),
  maks_rp    INTEGER CHECK (maks_rp IS NULL OR (jenis = 'persen' AND maks_rp >= 0)),
  aktif      INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  urutan     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX potongan_saluran_saluran ON potongan_saluran(saluran_id);

CREATE TABLE produk (
  id                 INTEGER PRIMARY KEY,
  nama               TEXT    NOT NULL,
  kategori           TEXT    NOT NULL DEFAULT '',
  stok               INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  modal              REAL    NOT NULL DEFAULT 0 CHECK (modal >= 0),
  batas_stok_menipis INTEGER NOT NULL DEFAULT 0 CHECK (batas_stok_menipis >= 0),
  aktif              INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL
);

CREATE TABLE harga_produk_saluran (
  produk_id  INTEGER NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
  saluran_id INTEGER NOT NULL REFERENCES saluran(id) ON DELETE CASCADE,
  harga      INTEGER NOT NULL CHECK (harga >= 0),
  updated_at TEXT    NOT NULL,
  PRIMARY KEY (produk_id, saluran_id)
);

-- Barang masuk menyimpan modal_pcs kulakan + kondisi produk sebelum masuk,
-- supaya bisa dibatalkan (hapus/ubah) dan tidak terpengaruh perubahan komponen.
CREATE TABLE barang_masuk (
  id            INTEGER PRIMARY KEY,
  tanggal       TEXT    NOT NULL,
  supplier      TEXT    NOT NULL DEFAULT '',
  produk_id     INTEGER NOT NULL REFERENCES produk(id) ON DELETE RESTRICT,
  qty           INTEGER NOT NULL CHECK (qty > 0),
  harga_beli    INTEGER NOT NULL CHECK (harga_beli >= 0),
  modal_pcs     REAL    NOT NULL,
  modal_sebelum REAL    NOT NULL,
  catatan       TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);
CREATE INDEX barang_masuk_produk ON barang_masuk(produk_id);
CREATE INDEX barang_masuk_tanggal ON barang_masuk(tanggal);

-- Salinan komponen saat kulakan (nama/jenis/nilai dibekukan; komponen_id boleh hilang).
CREATE TABLE barang_masuk_komponen (
  id              INTEGER PRIMARY KEY,
  barang_masuk_id INTEGER NOT NULL REFERENCES barang_masuk(id) ON DELETE CASCADE,
  komponen_id     INTEGER REFERENCES komponen_modal(id) ON DELETE SET NULL,
  nama            TEXT    NOT NULL,
  jenis           TEXT    NOT NULL,
  nilai           REAL    NOT NULL,
  per_pcs         REAL    NOT NULL
);
CREATE INDEX barang_masuk_komponen_bm ON barang_masuk_komponen(barang_masuk_id);

CREATE TABLE penyesuaian_stok (
  id           INTEGER PRIMARY KEY,
  tanggal      TEXT    NOT NULL,
  produk_id    INTEGER NOT NULL REFERENCES produk(id) ON DELETE RESTRICT,
  selisih      INTEGER NOT NULL CHECK (selisih <> 0),
  alasan       TEXT    NOT NULL,
  stok_sebelum INTEGER NOT NULL,
  stok_sesudah INTEGER NOT NULL,
  created_at   TEXT    NOT NULL
);
CREATE INDEX penyesuaian_stok_produk ON penyesuaian_stok(produk_id);
