package app

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"tokohijab/server/internal/hitung"
)

// Barang masuk (kulakan, §5.2): menambah stok dan memperbarui modal/pcs produk (rata-rata tertimbang).

type bmKomponen struct {
	KomponenID *int64  `json:"komponen_id"`
	Nama       string  `json:"nama"`
	Jenis      string  `json:"jenis"`
	Nilai      float64 `json:"nilai"`
	PerPcs     float64 `json:"per_pcs"`
}

type barangMasuk struct {
	ID           int64        `json:"id"`
	Tanggal      string       `json:"tanggal"`
	Supplier     string       `json:"supplier"`
	ProdukID     int64        `json:"produk_id"`
	ProdukNama   string       `json:"produk_nama"`
	Qty          int64        `json:"qty"`
	HargaBeli    int64        `json:"harga_beli"`
	ModalPcs     float64      `json:"modal_pcs"`
	ModalSebelum float64      `json:"modal_sebelum"`
	Catatan      string       `json:"catatan"`
	CreatedAt    string       `json:"created_at"`
	UpdatedAt    string       `json:"updated_at"`
	Komponen     []bmKomponen `json:"komponen"`
}

// Input komponen: komponen_id opsional (rujukan ke master); nama/jenis/nilai = salinan yang dipakai.
// Bila komponen_id diisi dan nama/jenis kosong, diambil dari master. Nilai wajib bila komponen_id kosong.
type bmKomponenIn struct {
	KomponenID *int64   `json:"komponen_id"`
	Nama       string   `json:"nama"`
	Jenis      string   `json:"jenis"`
	Nilai      *float64 `json:"nilai"`
}

type barangMasukIn struct {
	Tanggal   string `json:"tanggal"`
	Supplier  string `json:"supplier"`
	ProdukID  int64  `json:"produk_id"`
	Qty       int64  `json:"qty"`
	HargaBeli int64  `json:"harga_beli"`
	Catatan   string `json:"catatan"`
	// nil (tidak dikirim) = semua komponen aktif dengan nilai bawaan; [] = tanpa komponen.
	Komponen []bmKomponenIn `json:"komponen"`
}

const maxQty = 1_000_000

func (s *Server) listBarangMasuk(w http.ResponseWriter, r *http.Request) error {
	var conds []string
	var args []any
	pid, err := queryID(r, "produk_id")
	if err != nil {
		return err
	}
	if pid > 0 {
		conds = append(conds, `b.produk_id = ?`)
		args = append(args, pid)
	}
	for _, f := range []struct{ q, op string }{{"dari", ">="}, {"sampai", "<="}} {
		if v := r.URL.Query().Get(f.q); v != "" {
			t, err := tanggal(v, s.cfg.Now())
			if err != nil {
				return bad("%s harus berformat YYYY-MM-DD", f.q)
			}
			conds = append(conds, `b.tanggal `+f.op+` ?`)
			args = append(args, t)
		}
	}
	limit := 200
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 1000 {
			return bad("limit 1–1000")
		}
		limit = n
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}
	list, err := loadBarangMasuk(s.db, where+` ORDER BY b.tanggal DESC, b.id DESC LIMIT `+strconv.Itoa(limit), args...)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, list)
}

func loadBarangMasuk(q querier, tail string, args ...any) ([]barangMasuk, error) {
	rows, err := q.Query(`SELECT b.id, b.tanggal, b.supplier, b.produk_id, p.nama, b.qty, b.harga_beli, b.modal_pcs, b.modal_sebelum, b.catatan, b.created_at, b.updated_at
		FROM barang_masuk b JOIN produk p ON p.id = b.produk_id `+tail, args...)
	if err != nil {
		return nil, err
	}
	out := []barangMasuk{}
	idx := map[int64]int{}
	var ids []string
	for rows.Next() {
		var b barangMasuk
		if err := rows.Scan(&b.ID, &b.Tanggal, &b.Supplier, &b.ProdukID, &b.ProdukNama, &b.Qty, &b.HargaBeli, &b.ModalPcs, &b.ModalSebelum, &b.Catatan, &b.CreatedAt, &b.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		b.Komponen = []bmKomponen{}
		idx[b.ID] = len(out)
		ids = append(ids, strconv.FormatInt(b.ID, 10))
		out = append(out, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(out) == 0 {
		return out, err
	}
	// ids berasal dari INTEGER database, aman disisipkan.
	krows, err := q.Query(`SELECT barang_masuk_id, komponen_id, nama, jenis, nilai, per_pcs FROM barang_masuk_komponen
		WHERE barang_masuk_id IN (` + strings.Join(ids, ",") + `) ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer krows.Close()
	for krows.Next() {
		var bid int64
		var k bmKomponen
		var kid sql.NullInt64
		if err := krows.Scan(&bid, &kid, &k.Nama, &k.Jenis, &k.Nilai, &k.PerPcs); err != nil {
			return nil, err
		}
		if kid.Valid {
			k.KomponenID = &kid.Int64
		}
		out[idx[bid]].Komponen = append(out[idx[bid]].Komponen, k)
	}
	return out, krows.Err()
}

func barangMasukByID(q querier, id int64) (barangMasuk, error) {
	list, err := loadBarangMasuk(q, `WHERE b.id = ?`, id)
	if err != nil {
		return barangMasuk{}, err
	}
	if len(list) == 0 {
		return barangMasuk{}, notFound("barang masuk")
	}
	return list[0], nil
}

func (s *Server) getBarangMasuk(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	b, err := barangMasukByID(s.db, id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, b)
}

// siapkanKomponen memvalidasi input dan menghasilkan salinan komponen yang akan disimpan.
func siapkanKomponen(tx *sql.Tx, in []bmKomponenIn) ([]bmKomponen, error) {
	if in == nil {
		rows, err := tx.Query(`SELECT id, nama, jenis, nilai FROM komponen_modal WHERE aktif = 1 ORDER BY urutan, id`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []bmKomponen{}
		for rows.Next() {
			var k bmKomponen
			var id int64
			if err := rows.Scan(&id, &k.Nama, &k.Jenis, &k.Nilai); err != nil {
				return nil, err
			}
			k.KomponenID = &id
			out = append(out, k)
		}
		return out, rows.Err()
	}
	if len(in) > 50 {
		return nil, bad("komponen terlalu banyak")
	}
	out := make([]bmKomponen, 0, len(in))
	for i, c := range in {
		k := bmKomponen{KomponenID: c.KomponenID, Nama: c.Nama, Jenis: c.Jenis}
		if c.KomponenID != nil {
			var nama, jenis string
			var nilai float64
			err := tx.QueryRow(`SELECT nama, jenis, nilai FROM komponen_modal WHERE id = ?`, *c.KomponenID).Scan(&nama, &jenis, &nilai)
			if errors.Is(err, sql.ErrNoRows) {
				return nil, bad("komponen[%d]: komponen_id %d tidak ditemukan", i, *c.KomponenID)
			}
			if err != nil {
				return nil, err
			}
			if strings.TrimSpace(k.Nama) == "" {
				k.Nama = nama
			}
			if k.Jenis == "" {
				k.Jenis = jenis
			}
			if c.Nilai == nil {
				c.Nilai = &nilai
			}
		}
		if c.Nilai == nil {
			return nil, bad("komponen[%d]: nilai wajib diisi", i)
		}
		k.Nilai = *c.Nilai
		var err error
		if k.Nama, err = teks("nama komponen", k.Nama, true, 100); err != nil {
			return nil, err
		}
		if !hitung.JenisModalValid(k.Jenis) {
			return nil, bad("komponen[%d]: jenis tidak dikenal", i)
		}
		if err := validasiNilaiModal(k.Jenis, k.Nilai); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, nil
}

// terapkanMasuk menambah stok & memperbarui modal produk, lalu menyimpan baris barang masuk (id 0 = baru).
func (s *Server) terapkanMasuk(tx *sql.Tx, id int64, in barangMasukIn) (int64, error) {
	if err := s.rapikanKeterangan(&in); err != nil {
		return 0, err
	}
	if in.Qty <= 0 || in.Qty > maxQty {
		return 0, bad("qty harus 1–%d", maxQty)
	}
	if err := rupiah("harga_beli", in.HargaBeli); err != nil {
		return 0, err
	}
	if in.ProdukID <= 0 {
		return 0, bad("produk_id wajib diisi")
	}
	komp, err := siapkanKomponen(tx, in.Komponen)
	if err != nil {
		return 0, err
	}
	hk := make([]hitung.KomponenModal, len(komp))
	for i, k := range komp {
		hk[i] = hitung.KomponenModal{Jenis: k.Jenis, Nilai: k.Nilai}
		komp[i].PerPcs = hitung.Sen(hk[i].PerPcs(in.HargaBeli, in.Qty))
	}
	modalPcs, err := hitung.ModalKulakan(in.HargaBeli, in.Qty, hk)
	if err != nil {
		return 0, bad("%s", err.Error())
	}
	stok, modal, err := lockProduk(tx, in.ProdukID)
	if err != nil {
		return 0, err
	}
	modalBaru := hitung.RataRataTertimbang(stok, modal, in.Qty, modalPcs)
	now := fmtTime(s.cfg.Now())
	if _, err := tx.Exec(`UPDATE produk SET stok = stok + ?, modal = ?, updated_at = ? WHERE id = ?`, in.Qty, modalBaru, now, in.ProdukID); err != nil {
		return 0, err
	}
	if id == 0 {
		res, err := tx.Exec(`INSERT INTO barang_masuk (tanggal, supplier, produk_id, qty, harga_beli, modal_pcs, modal_sebelum, catatan, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, in.Tanggal, in.Supplier, in.ProdukID, in.Qty, in.HargaBeli, modalPcs, modal, in.Catatan, now, now)
		if err != nil {
			return 0, err
		}
		id, _ = res.LastInsertId()
	} else {
		if _, err := tx.Exec(`UPDATE barang_masuk SET tanggal = ?, supplier = ?, produk_id = ?, qty = ?, harga_beli = ?, modal_pcs = ?, modal_sebelum = ?, catatan = ?, updated_at = ? WHERE id = ?`,
			in.Tanggal, in.Supplier, in.ProdukID, in.Qty, in.HargaBeli, modalPcs, modal, in.Catatan, now, id); err != nil {
			return 0, err
		}
		if _, err := tx.Exec(`DELETE FROM barang_masuk_komponen WHERE barang_masuk_id = ?`, id); err != nil {
			return 0, err
		}
	}
	for _, k := range komp {
		if _, err := tx.Exec(`INSERT INTO barang_masuk_komponen (barang_masuk_id, komponen_id, nama, jenis, nilai, per_pcs) VALUES (?, ?, ?, ?, ?, ?)`,
			id, k.KomponenID, k.Nama, k.Jenis, k.Nilai, k.PerPcs); err != nil {
			return 0, err
		}
	}
	return id, nil
}

// rapikanKeterangan memvalidasi tanggal/supplier/catatan (bagian yang tidak memengaruhi stok & modal).
func (s *Server) rapikanKeterangan(in *barangMasukIn) error {
	var err error
	if in.Tanggal, err = tanggalTransaksi(in.Tanggal, s.cfg.Now()); err != nil {
		return err
	}
	if in.Supplier, err = teks("supplier", in.Supplier, false, 100); err != nil {
		return err
	}
	in.Catatan, err = teks("catatan", in.Catatan, false, 500)
	return err
}

// hitunganSama: produk, qty, harga beli, dan komponen tidak berubah → stok & modal tidak perlu disentuh.
func hitunganSama(tx *sql.Tx, lama barangMasuk, in barangMasukIn) (bool, error) {
	if in.ProdukID != lama.ProdukID || in.Qty != lama.Qty || in.HargaBeli != lama.HargaBeli || len(in.Komponen) != len(lama.Komponen) {
		return false, nil
	}
	komp, err := siapkanKomponen(tx, in.Komponen)
	if err != nil {
		return false, err
	}
	for i, k := range komp {
		l := lama.Komponen[i]
		if k.Nama != l.Nama || k.Jenis != l.Jenis || k.Nilai != l.Nilai || (k.KomponenID == nil) != (l.KomponenID == nil) ||
			(k.KomponenID != nil && *k.KomponenID != *l.KomponenID) {
			return false, nil
		}
	}
	return true, nil
}

// batalkanMasuk menarik kembali stok & modal dari satu barang masuk. Ditolak bila stok sekarang kurang
// dari qty-nya (sebagian sudah terjual/dikeluarkan).
func batalkanMasuk(tx *sql.Tx, id int64, now string) error {
	var pid, qty int64
	var modalPcs, modalSebelum float64
	err := tx.QueryRow(`SELECT produk_id, qty, modal_pcs, modal_sebelum FROM barang_masuk WHERE id = ?`, id).Scan(&pid, &qty, &modalPcs, &modalSebelum)
	if errors.Is(err, sql.ErrNoRows) {
		return notFound("barang masuk")
	}
	if err != nil {
		return err
	}
	stok, modal, err := lockProduk(tx, pid)
	if err != nil {
		return err
	}
	if stok < qty {
		return conflict("Stok produk tinggal %d, kurang dari qty kulakan ini (%d); sebagian sudah terjual/dikeluarkan", stok, qty)
	}
	modalBaru := hitung.BatalkanMasuk(stok, modal, qty, modalPcs, modalSebelum)
	_, err = tx.Exec(`UPDATE produk SET stok = stok - ?, modal = ?, updated_at = ? WHERE id = ?`, qty, modalBaru, now, pid)
	return err
}

func (s *Server) createBarangMasuk(w http.ResponseWriter, r *http.Request) error {
	var in barangMasukIn
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	id, err := s.terapkanMasuk(tx, 0, in)
	if err != nil {
		return err
	}
	b, err := barangMasukByID(tx, id)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return writeJSON(w, http.StatusCreated, b)
}

// PUT = batalkan versi lama lalu terapkan versi baru, dalam satu transaksi.
// Komponen tidak dikirim (null) → pakai komponen tersimpan kulakan ini (bukan bawaan terbaru).
// Bila hitungan (produk/qty/harga/komponen) sama, hanya tanggal/supplier/catatan yang diubah, sehingga tetap
// bisa walau stoknya sebagian sudah keluar.
func (s *Server) updateBarangMasuk(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	var in barangMasukIn
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	lama, err := barangMasukByID(tx, id)
	if err != nil {
		return err
	}
	if in.Komponen == nil {
		in.Komponen = make([]bmKomponenIn, len(lama.Komponen))
		for i, k := range lama.Komponen {
			nilai := k.Nilai
			in.Komponen[i] = bmKomponenIn{Nama: k.Nama, Jenis: k.Jenis, Nilai: &nilai}
			if k.KomponenID != nil {
				var ada int
				if err := tx.QueryRow(`SELECT COUNT(*) FROM komponen_modal WHERE id = ?`, *k.KomponenID).Scan(&ada); err != nil {
					return err
				}
				if ada > 0 {
					in.Komponen[i].KomponenID = k.KomponenID
				}
			}
		}
	}
	sama, err := hitunganSama(tx, lama, in)
	if err != nil {
		return err
	}
	if sama {
		if err := s.rapikanKeterangan(&in); err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE barang_masuk SET tanggal = ?, supplier = ?, catatan = ?, updated_at = ? WHERE id = ?`,
			in.Tanggal, in.Supplier, in.Catatan, fmtTime(s.cfg.Now()), id); err != nil {
			return err
		}
	} else {
		if err := batalkanMasuk(tx, id, fmtTime(s.cfg.Now())); err != nil {
			return err
		}
		if _, err := s.terapkanMasuk(tx, id, in); err != nil {
			return err
		}
	}
	b, err := barangMasukByID(tx, id)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, b)
}

func (s *Server) deleteBarangMasuk(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := batalkanMasuk(tx, id, fmtTime(s.cfg.Now())); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM barang_masuk WHERE id = ?`, id); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return noContent(w)
}
