package app

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

// Produk (model). Stok & modal hanya berubah lewat barang masuk / penyesuaian (dan nanti penjualan).

type hargaSaluran struct {
	SaluranID int64  `json:"saluran_id"`
	Harga     int64  `json:"harga"`
	UpdatedAt string `json:"updated_at"`
}

type produk struct {
	ID               int64          `json:"id"`
	Nama             string         `json:"nama"`
	Kategori         string         `json:"kategori"`
	Stok             int64          `json:"stok"`
	Modal            float64        `json:"modal"`
	BatasStokMenipis int64          `json:"batas_stok_menipis"`
	Menipis          bool           `json:"menipis"`
	Aktif            bool           `json:"aktif"`
	CreatedAt        string         `json:"created_at"`
	UpdatedAt        string         `json:"updated_at"`
	Harga            []hargaSaluran `json:"harga"`
}

const kolomProduk = `id, nama, kategori, stok, modal, batas_stok_menipis, aktif, created_at, updated_at`

type querier interface {
	Query(string, ...any) (*sql.Rows, error)
	QueryRow(string, ...any) *sql.Row
}

func scanProduk(sc interface{ Scan(...any) error }) (produk, error) {
	var p produk
	err := sc.Scan(&p.ID, &p.Nama, &p.Kategori, &p.Stok, &p.Modal, &p.BatasStokMenipis, &p.Aktif, &p.CreatedAt, &p.UpdatedAt)
	p.Menipis = p.Stok <= p.BatasStokMenipis // §7 butir 13: stok ≤ batas
	p.Harga = []hargaSaluran{}
	return p, err
}

func loadProduk(q querier, where string, args ...any) ([]produk, error) {
	rows, err := q.Query(`SELECT `+kolomProduk+` FROM produk `+where+` ORDER BY nama COLLATE NOCASE, id`, args...)
	if err != nil {
		return nil, err
	}
	out := []produk{}
	idx := map[int64]int{}
	for rows.Next() {
		p, err := scanProduk(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		idx[p.ID] = len(out)
		out = append(out, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return out, nil
	}
	hrows, err := q.Query(`SELECT h.produk_id, h.saluran_id, h.harga, h.updated_at FROM harga_produk_saluran h
		JOIN saluran s ON s.id = h.saluran_id ORDER BY s.urutan, s.id`)
	if err != nil {
		return nil, err
	}
	defer hrows.Close()
	for hrows.Next() {
		var pid int64
		var h hargaSaluran
		if err := hrows.Scan(&pid, &h.SaluranID, &h.Harga, &h.UpdatedAt); err != nil {
			return nil, err
		}
		if i, ok := idx[pid]; ok {
			out[i].Harga = append(out[i].Harga, h)
		}
	}
	return out, hrows.Err()
}

func produkByID(q querier, id int64) (produk, error) {
	list, err := loadProduk(q, `WHERE id = ?`, id)
	if err != nil {
		return produk{}, err
	}
	if len(list) == 0 {
		return produk{}, notFound("produk")
	}
	return list[0], nil
}

// GET /api/produk?aktif=1&menipis=1&q=teks
func (s *Server) listProduk(w http.ResponseWriter, r *http.Request) error {
	var conds []string
	var args []any
	if queryBool(r, "aktif") {
		conds = append(conds, `aktif = 1`)
	}
	if queryBool(r, "menipis") {
		conds = append(conds, `stok <= batas_stok_menipis`)
	}
	if q := strings.TrimSpace(r.URL.Query().Get("q")); q != "" {
		conds = append(conds, `(nama LIKE ? ESCAPE '\' OR kategori LIKE ? ESCAPE '\')`)
		like := "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q) + "%"
		args = append(args, like, like)
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}
	list, err := loadProduk(s.db, where, args...)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, list)
}

func (s *Server) getProduk(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	p, err := produkByID(s.db, id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, p)
}

func validasiProduk(p *produk) error {
	var err error
	if p.Nama, err = teks("nama", p.Nama, true, 100); err != nil {
		return err
	}
	if p.Kategori, err = teks("kategori", p.Kategori, false, 50); err != nil {
		return err
	}
	if p.BatasStokMenipis < 0 || p.BatasStokMenipis > 1_000_000 {
		return bad("batas_stok_menipis tidak valid")
	}
	return nil
}

func (s *Server) createProduk(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Nama             string `json:"nama"`
		Kategori         string `json:"kategori"`
		BatasStokMenipis int64  `json:"batas_stok_menipis"`
		Aktif            *bool  `json:"aktif"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	p := produk{Nama: in.Nama, Kategori: in.Kategori, BatasStokMenipis: in.BatasStokMenipis, Aktif: in.Aktif == nil || *in.Aktif}
	if err := validasiProduk(&p); err != nil {
		return err
	}
	now := fmtTime(s.cfg.Now())
	res, err := s.db.Exec(`INSERT INTO produk (nama, kategori, batas_stok_menipis, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		p.Nama, p.Kategori, p.BatasStokMenipis, b2i(p.Aktif), now, now)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	p, err = produkByID(s.db, id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusCreated, p)
}

func (s *Server) patchProduk(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	var in struct {
		Nama             Opt[string] `json:"nama"`
		Kategori         Opt[string] `json:"kategori"`
		BatasStokMenipis Opt[int64]  `json:"batas_stok_menipis"`
		Aktif            Opt[bool]   `json:"aktif"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	p, err := produkByID(s.db, id)
	if err != nil {
		return err
	}
	if in.Nama.Set {
		p.Nama = in.Nama.V
	}
	if in.Kategori.Set {
		p.Kategori = in.Kategori.V
	}
	if in.BatasStokMenipis.Set {
		p.BatasStokMenipis = in.BatasStokMenipis.V
	}
	if in.Aktif.Set {
		p.Aktif = in.Aktif.V
	}
	if err := validasiProduk(&p); err != nil {
		return err
	}
	if _, err := s.db.Exec(`UPDATE produk SET nama = ?, kategori = ?, batas_stok_menipis = ?, aktif = ?, updated_at = ? WHERE id = ?`,
		p.Nama, p.Kategori, p.BatasStokMenipis, b2i(p.Aktif), fmtTime(s.cfg.Now()), id); err != nil {
		return err
	}
	p, err = produkByID(s.db, id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, p)
}

// Produk yang sudah punya riwayat tidak bisa dihapus (laporan butuh), cukup dinonaktifkan.
func (s *Server) deleteProduk(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	if _, err := produkByID(s.db, id); err != nil {
		return err
	}
	var n int
	if err := s.db.QueryRow(`SELECT (SELECT COUNT(*) FROM barang_masuk WHERE produk_id = ?) + (SELECT COUNT(*) FROM penyesuaian_stok WHERE produk_id = ?)`, id, id).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return conflict("Produk sudah punya riwayat stok; nonaktifkan saja")
	}
	_, err = s.db.Exec(`DELETE FROM produk WHERE id = ?`, id)
	if err != nil {
		return err
	}
	return noContent(w)
}

// PUT /api/produk/{id}/harga/{saluran} {"harga": 44000} — dipakai tombol "Pakai harga ini".
func (s *Server) putHarga(w http.ResponseWriter, r *http.Request) error {
	pid, err := pathID(r, "id")
	if err != nil {
		return err
	}
	sid, err := pathID(r, "saluran")
	if err != nil {
		return err
	}
	var in struct {
		Harga *int64 `json:"harga"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	if in.Harga == nil {
		return bad("harga wajib diisi")
	}
	if err := rupiah("harga", *in.Harga); err != nil {
		return err
	}
	if _, err := produkByID(s.db, pid); err != nil {
		return err
	}
	if _, err := s.saluranByID(sid); err != nil {
		return err
	}
	if _, err := s.db.Exec(`INSERT INTO harga_produk_saluran (produk_id, saluran_id, harga, updated_at) VALUES (?, ?, ?, ?)
		ON CONFLICT (produk_id, saluran_id) DO UPDATE SET harga = excluded.harga, updated_at = excluded.updated_at`,
		pid, sid, *in.Harga, fmtTime(s.cfg.Now())); err != nil {
		return err
	}
	p, err := produkByID(s.db, pid)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, p)
}

func (s *Server) deleteHarga(w http.ResponseWriter, r *http.Request) error {
	pid, err := pathID(r, "id")
	if err != nil {
		return err
	}
	sid, err := pathID(r, "saluran")
	if err != nil {
		return err
	}
	res, err := s.db.Exec(`DELETE FROM harga_produk_saluran WHERE produk_id = ? AND saluran_id = ?`, pid, sid)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return notFound("harga")
	}
	return noContent(w)
}

// lockProduk membaca produk di dalam transaksi (BEGIN IMMEDIATE sudah memegang kunci tulis).
func lockProduk(tx *sql.Tx, id int64) (stok int64, modal float64, err error) {
	err = tx.QueryRow(`SELECT stok, modal FROM produk WHERE id = ?`, id).Scan(&stok, &modal)
	if errors.Is(err, sql.ErrNoRows) {
		err = notFound("produk")
	}
	return
}
