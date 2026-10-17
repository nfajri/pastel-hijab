package app

import (
	"database/sql"
	"errors"
	"net/http"
)

// Penyesuaian stok (§5.5): koreksi manual dengan alasan. Tidak mengubah modal/pcs.

type penyesuaian struct {
	ID          int64  `json:"id"`
	Tanggal     string `json:"tanggal"`
	ProdukID    int64  `json:"produk_id"`
	ProdukNama  string `json:"produk_nama"`
	Selisih     int64  `json:"selisih"`
	Alasan      string `json:"alasan"`
	StokSebelum int64  `json:"stok_sebelum"`
	StokSesudah int64  `json:"stok_sesudah"`
	CreatedAt   string `json:"created_at"`
}

func loadPenyesuaian(q querier, tail string, args ...any) ([]penyesuaian, error) {
	rows, err := q.Query(`SELECT a.id, a.tanggal, a.produk_id, p.nama, a.selisih, a.alasan, a.stok_sebelum, a.stok_sesudah, a.created_at
		FROM penyesuaian_stok a JOIN produk p ON p.id = a.produk_id `+tail, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []penyesuaian{}
	for rows.Next() {
		var a penyesuaian
		if err := rows.Scan(&a.ID, &a.Tanggal, &a.ProdukID, &a.ProdukNama, &a.Selisih, &a.Alasan, &a.StokSebelum, &a.StokSesudah, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Server) listPenyesuaian(w http.ResponseWriter, r *http.Request) error {
	pid, err := queryID(r, "produk_id")
	if err != nil {
		return err
	}
	tail, args := "", []any{}
	if pid > 0 {
		tail, args = `WHERE a.produk_id = ?`, append(args, pid)
	}
	list, err := loadPenyesuaian(s.db, tail+` ORDER BY a.tanggal DESC, a.id DESC LIMIT 500`, args...)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, list)
}

// POST {"produk_id", "selisih": -2, "alasan"} atau {"produk_id", "stok_fisik": 7, "alasan"} (hasil hitung fisik).
func (s *Server) createPenyesuaian(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Tanggal   string `json:"tanggal"`
		ProdukID  int64  `json:"produk_id"`
		Selisih   *int64 `json:"selisih"`
		StokFisik *int64 `json:"stok_fisik"`
		Alasan    string `json:"alasan"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	tgl, err := tanggalTransaksi(in.Tanggal, s.cfg.Now())
	if err != nil {
		return err
	}
	alasan, err := teks("alasan", in.Alasan, true, 200)
	if err != nil {
		return err
	}
	if (in.Selisih == nil) == (in.StokFisik == nil) {
		return bad("isi salah satu: selisih atau stok_fisik")
	}
	if in.ProdukID <= 0 {
		return bad("produk_id wajib diisi")
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stok, _, err := lockProduk(tx, in.ProdukID)
	if err != nil {
		return err
	}
	var selisih int64
	if in.StokFisik != nil {
		if *in.StokFisik < 0 || *in.StokFisik > maxQty {
			return bad("stok_fisik tidak valid")
		}
		selisih = *in.StokFisik - stok
		if selisih == 0 {
			return bad("stok fisik sama dengan stok tercatat (%d), tidak ada yang disesuaikan", stok)
		}
	} else {
		selisih = *in.Selisih
		if selisih == 0 || selisih > maxQty || selisih < -maxQty {
			return bad("selisih tidak boleh 0")
		}
	}
	sesudah := stok + selisih
	if sesudah < 0 {
		return conflict("Stok tersisa %d, tidak bisa dikurangi %d", stok, -selisih)
	}
	now := fmtTime(s.cfg.Now())
	if _, err := tx.Exec(`UPDATE produk SET stok = ?, updated_at = ? WHERE id = ?`, sesudah, now, in.ProdukID); err != nil {
		return err
	}
	res, err := tx.Exec(`INSERT INTO penyesuaian_stok (tanggal, produk_id, selisih, alasan, stok_sebelum, stok_sesudah, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tgl, in.ProdukID, selisih, alasan, stok, sesudah, now)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	list, err := loadPenyesuaian(tx, `WHERE a.id = ?`, id)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return writeJSON(w, http.StatusCreated, list[0])
}

// DELETE membatalkan penyesuaian (stok dikembalikan). Ditolak bila stok jadi negatif.
func (s *Server) deletePenyesuaian(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var pid, selisih int64
	err = tx.QueryRow(`SELECT produk_id, selisih FROM penyesuaian_stok WHERE id = ?`, id).Scan(&pid, &selisih)
	if errors.Is(err, sql.ErrNoRows) {
		return notFound("penyesuaian stok")
	}
	if err != nil {
		return err
	}
	stok, _, err := lockProduk(tx, pid)
	if err != nil {
		return err
	}
	if stok-selisih < 0 {
		return conflict("Stok tersisa %d, pembatalan akan membuat stok negatif", stok)
	}
	if _, err := tx.Exec(`UPDATE produk SET stok = stok - ?, updated_at = ? WHERE id = ?`, selisih, fmtTime(s.cfg.Now()), pid); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM penyesuaian_stok WHERE id = ?`, id); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return noContent(w)
}
