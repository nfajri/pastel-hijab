package app

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
)

// Pengeluaran (biaya operasional §5.5: sewa lapak, iklan, packaging massal, ...) + kategorinya (bisa tambah).

type kategoriPengeluaran struct {
	ID        int64  `json:"id"`
	Nama      string `json:"nama"`
	Aktif     bool   `json:"aktif"`
	Urutan    int64  `json:"urutan"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type pengeluaran struct {
	ID           int64  `json:"id"`
	Tanggal      string `json:"tanggal"`
	KategoriID   int64  `json:"kategori_id"`
	KategoriNama string `json:"kategori_nama"`
	Jumlah       int64  `json:"jumlah"`
	Catatan      string `json:"catatan"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

func loadKategori(q querier, where string, args ...any) ([]kategoriPengeluaran, error) {
	rows, err := q.Query(`SELECT id, nama, aktif, urutan, created_at, updated_at FROM kategori_pengeluaran `+where+` ORDER BY urutan, id`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []kategoriPengeluaran{}
	for rows.Next() {
		var k kategoriPengeluaran
		if err := rows.Scan(&k.ID, &k.Nama, &k.Aktif, &k.Urutan, &k.CreatedAt, &k.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func kategoriByID(q querier, id int64) (kategoriPengeluaran, error) {
	list, err := loadKategori(q, `WHERE id = ?`, id)
	if err != nil {
		return kategoriPengeluaran{}, err
	}
	if len(list) == 0 {
		return kategoriPengeluaran{}, notFound("kategori pengeluaran")
	}
	return list[0], nil
}

func (s *Server) listKategoriPengeluaran(w http.ResponseWriter, r *http.Request) error {
	where := ""
	if queryBool(r, "aktif") {
		where = `WHERE aktif = 1`
	}
	list, err := loadKategori(s.db, where)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, list)
}

func (s *Server) createKategoriPengeluaran(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Nama   string `json:"nama"`
		Aktif  *bool  `json:"aktif"`
		Urutan *int64 `json:"urutan"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	nama, err := teks("nama", in.Nama, true, 50)
	if err != nil {
		return err
	}
	aktif := in.Aktif == nil || *in.Aktif
	var urutan int64
	if in.Urutan != nil {
		urutan = *in.Urutan
	} else if err := s.db.QueryRow(`SELECT COALESCE(MAX(urutan), 0) + 1 FROM kategori_pengeluaran`).Scan(&urutan); err != nil {
		return err
	}
	now := fmtTime(s.cfg.Now())
	res, err := s.db.Exec(`INSERT INTO kategori_pengeluaran (nama, aktif, urutan, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		nama, b2i(aktif), urutan, now, now)
	if uniqueErr(err) {
		return conflict("Kategori %q sudah ada", nama)
	}
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	k, err := kategoriByID(s.db, id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusCreated, k)
}

func (s *Server) patchKategoriPengeluaran(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	var in struct {
		Nama   Opt[string] `json:"nama"`
		Aktif  Opt[bool]   `json:"aktif"`
		Urutan Opt[int64]  `json:"urutan"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	k, err := kategoriByID(s.db, id)
	if err != nil {
		return err
	}
	if in.Nama.Set {
		if k.Nama, err = teks("nama", in.Nama.V, true, 50); err != nil {
			return err
		}
	}
	if in.Aktif.Set {
		if in.Aktif.Null {
			return bad("aktif tidak boleh null")
		}
		k.Aktif = in.Aktif.V
	}
	if in.Urutan.Set {
		if in.Urutan.Null {
			return bad("urutan tidak boleh null")
		}
		k.Urutan = in.Urutan.V
	}
	_, err = s.db.Exec(`UPDATE kategori_pengeluaran SET nama = ?, aktif = ?, urutan = ?, updated_at = ? WHERE id = ?`,
		k.Nama, b2i(k.Aktif), k.Urutan, fmtTime(s.cfg.Now()), id)
	if uniqueErr(err) {
		return conflict("Kategori %q sudah ada", k.Nama)
	}
	if err != nil {
		return err
	}
	if k, err = kategoriByID(s.db, id); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, k)
}

func (s *Server) deleteKategoriPengeluaran(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	if _, err := kategoriByID(s.db, id); err != nil {
		return err
	}
	var n int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM pengeluaran WHERE kategori_id = ?`, id).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return conflict("Kategori sudah dipakai %d pengeluaran; nonaktifkan saja", n)
	}
	if _, err := s.db.Exec(`DELETE FROM kategori_pengeluaran WHERE id = ?`, id); err != nil {
		return err
	}
	return noContent(w)
}

// --- pengeluaran ---

func loadPengeluaran(q querier, tail string, args ...any) ([]pengeluaran, error) {
	rows, err := q.Query(`SELECT e.id, e.tanggal, e.kategori_id, k.nama, e.jumlah, e.catatan, e.created_at, e.updated_at
		FROM pengeluaran e JOIN kategori_pengeluaran k ON k.id = e.kategori_id `+tail, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []pengeluaran{}
	for rows.Next() {
		var e pengeluaran
		if err := rows.Scan(&e.ID, &e.Tanggal, &e.KategoriID, &e.KategoriNama, &e.Jumlah, &e.Catatan, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func pengeluaranByID(q querier, id int64) (pengeluaran, error) {
	list, err := loadPengeluaran(q, `WHERE e.id = ?`, id)
	if err != nil {
		return pengeluaran{}, err
	}
	if len(list) == 0 {
		return pengeluaran{}, notFound("pengeluaran")
	}
	return list[0], nil
}

// GET /api/pengeluaran?dari=&sampai=&kategori_id=&limit=200 (terbaru dulu)
func (s *Server) listPengeluaran(w http.ResponseWriter, r *http.Request) error {
	conds, args, err := s.filterTanggal(r, "e.tanggal", nil, nil)
	if err != nil {
		return err
	}
	kid, err := queryID(r, "kategori_id")
	if err != nil {
		return err
	}
	if kid > 0 {
		conds = append(conds, `e.kategori_id = ?`)
		args = append(args, kid)
	}
	limit, err := queryLimit(r, 200)
	if err != nil {
		return err
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}
	list, err := loadPengeluaran(s.db, where+` ORDER BY e.tanggal DESC, e.id DESC LIMIT `+strconv.Itoa(limit), args...)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, list)
}

func (s *Server) getPengeluaran(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	e, err := pengeluaranByID(s.db, id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, e)
}

type pengeluaranIn struct {
	Tanggal    string `json:"tanggal"`
	KategoriID int64  `json:"kategori_id"`
	Jumlah     int64  `json:"jumlah"`
	Catatan    string `json:"catatan"`
}

// simpanPengeluaran: id 0 = baru. kategoriLama boleh dipakai walau sudah nonaktif (edit data lama).
func (s *Server) simpanPengeluaran(id int64, in pengeluaranIn, kategoriLama int64) (int64, error) {
	now := s.cfg.Now()
	tgl, err := tanggalTransaksi(in.Tanggal, now)
	if err != nil {
		return 0, err
	}
	if in.Jumlah <= 0 {
		return 0, bad("Isi jumlah pengeluaran")
	}
	if err := rupiah("jumlah", in.Jumlah); err != nil {
		return 0, err
	}
	catatan, err := teks("catatan", in.Catatan, false, 500)
	if err != nil {
		return 0, err
	}
	if in.KategoriID <= 0 {
		return 0, bad("Pilih kategori pengeluaran")
	}
	k, err := kategoriByID(s.db, in.KategoriID)
	if err != nil {
		var he *httpError
		if errors.As(err, &he) {
			return 0, bad("kategori pengeluaran tidak ditemukan")
		}
		return 0, err
	}
	if !k.Aktif && k.ID != kategoriLama {
		return 0, bad("Kategori %s nonaktif", k.Nama)
	}
	ts := fmtTime(now)
	if id == 0 {
		res, err := s.db.Exec(`INSERT INTO pengeluaran (tanggal, kategori_id, jumlah, catatan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			tgl, in.KategoriID, in.Jumlah, catatan, ts, ts)
		if err != nil {
			return 0, err
		}
		id, _ = res.LastInsertId()
		return id, nil
	}
	_, err = s.db.Exec(`UPDATE pengeluaran SET tanggal = ?, kategori_id = ?, jumlah = ?, catatan = ?, updated_at = ? WHERE id = ?`,
		tgl, in.KategoriID, in.Jumlah, catatan, ts, id)
	return id, err
}

func (s *Server) createPengeluaran(w http.ResponseWriter, r *http.Request) error {
	var in pengeluaranIn
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	id, err := s.simpanPengeluaran(0, in, 0)
	if err != nil {
		return err
	}
	e, err := pengeluaranByID(s.db, id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusCreated, e)
}

func (s *Server) updatePengeluaran(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	var in pengeluaranIn
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	lama, err := pengeluaranByID(s.db, id)
	if err != nil {
		return err
	}
	if _, err := s.simpanPengeluaran(id, in, lama.KategoriID); err != nil {
		return err
	}
	e, err := pengeluaranByID(s.db, id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, e)
}

func (s *Server) deletePengeluaran(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	res, err := s.db.Exec(`DELETE FROM pengeluaran WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return notFound("pengeluaran")
	}
	return noContent(w)
}
