package app

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

// Saluran jual + komponen potongan (§5.3). Saluran tidak dihapus, cukup dinonaktifkan.

type potongan struct {
	ID        int64   `json:"id"`
	SaluranID int64   `json:"saluran_id"`
	Nama      string  `json:"nama"`
	Jenis     string  `json:"jenis"`
	Nilai     float64 `json:"nilai"`
	MaksRp    *int64  `json:"maks_rp"`
	Aktif     bool    `json:"aktif"`
	Urutan    int64   `json:"urutan"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

type saluran struct {
	ID        int64      `json:"id"`
	Nama      string     `json:"nama"`
	Aktif     bool       `json:"aktif"`
	Urutan    int64      `json:"urutan"`
	CreatedAt string     `json:"created_at"`
	UpdatedAt string     `json:"updated_at"`
	Potongan  []potongan `json:"potongan"`
}

const (
	PotonganPersen     = "persen"
	PotonganPerPesanan = "per_pesanan"
	PotonganPerPcs     = "per_pcs"
)

const kolomPotongan = `id, saluran_id, nama, jenis, nilai, maks_rp, aktif, urutan, created_at, updated_at`

func scanPotongan(sc interface{ Scan(...any) error }) (potongan, error) {
	var p potongan
	var maks sql.NullInt64
	err := sc.Scan(&p.ID, &p.SaluranID, &p.Nama, &p.Jenis, &p.Nilai, &maks, &p.Aktif, &p.Urutan, &p.CreatedAt, &p.UpdatedAt)
	if maks.Valid {
		p.MaksRp = &maks.Int64
	}
	return p, err
}

func validasiPotongan(p *potongan) error {
	var err error
	if p.Nama, err = teks("nama", p.Nama, true, 100); err != nil {
		return err
	}
	switch p.Jenis {
	case PotonganPersen:
		if err := angka("nilai (%)", p.Nilai, 100); err != nil {
			return err
		}
		if p.MaksRp != nil {
			if err := rupiah("maks_rp", *p.MaksRp); err != nil {
				return err
			}
		}
	case PotonganPerPesanan, PotonganPerPcs:
		if err := angka("nilai", p.Nilai, maxRp); err != nil {
			return err
		}
		if p.MaksRp != nil {
			return bad("maks_rp hanya untuk potongan jenis persen")
		}
	default:
		return bad("jenis harus salah satu: persen, per_pesanan, per_pcs")
	}
	return nil
}

func (s *Server) loadSaluran(where string, args ...any) ([]saluran, error) {
	rows, err := s.db.Query(`SELECT id, nama, aktif, urutan, created_at, updated_at FROM saluran `+where+` ORDER BY urutan, id`, args...)
	if err != nil {
		return nil, err
	}
	out := []saluran{}
	idx := map[int64]int{}
	for rows.Next() {
		var c saluran
		if err := rows.Scan(&c.ID, &c.Nama, &c.Aktif, &c.Urutan, &c.CreatedAt, &c.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		c.Potongan = []potongan{}
		idx[c.ID] = len(out)
		out = append(out, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	prow, err := s.db.Query(`SELECT ` + kolomPotongan + ` FROM potongan_saluran ORDER BY urutan, id`)
	if err != nil {
		return nil, err
	}
	defer prow.Close()
	for prow.Next() {
		p, err := scanPotongan(prow)
		if err != nil {
			return nil, err
		}
		if i, ok := idx[p.SaluranID]; ok {
			out[i].Potongan = append(out[i].Potongan, p)
		}
	}
	return out, prow.Err()
}

func (s *Server) saluranByID(id int64) (saluran, error) {
	list, err := s.loadSaluran(`WHERE id = ?`, id)
	if err != nil {
		return saluran{}, err
	}
	if len(list) == 0 {
		return saluran{}, notFound("saluran")
	}
	return list[0], nil
}

func (s *Server) listSaluran(w http.ResponseWriter, r *http.Request) error {
	where := ""
	if queryBool(r, "aktif") {
		where = `WHERE aktif = 1`
	}
	list, err := s.loadSaluran(where)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, list)
}

func (s *Server) getSaluran(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	c, err := s.saluranByID(id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, c)
}

func uniqueErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint")
}

func (s *Server) createSaluran(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Nama   string `json:"nama"`
		Aktif  *bool  `json:"aktif"`
		Urutan int64  `json:"urutan"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	nama, err := teks("nama", in.Nama, true, 50)
	if err != nil {
		return err
	}
	now := fmtTime(s.cfg.Now())
	res, err := s.db.Exec(`INSERT INTO saluran (nama, aktif, urutan, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		nama, b2i(in.Aktif == nil || *in.Aktif), in.Urutan, now, now)
	if uniqueErr(err) {
		return conflict("saluran %q sudah ada", nama)
	}
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	c, err := s.saluranByID(id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusCreated, c)
}

func (s *Server) patchSaluran(w http.ResponseWriter, r *http.Request) error {
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
	c, err := s.saluranByID(id)
	if err != nil {
		return err
	}
	if in.Nama.Set {
		if c.Nama, err = teks("nama", in.Nama.V, true, 50); err != nil {
			return err
		}
	}
	if in.Aktif.Set {
		c.Aktif = in.Aktif.V
	}
	if in.Urutan.Set {
		c.Urutan = in.Urutan.V
	}
	_, err = s.db.Exec(`UPDATE saluran SET nama = ?, aktif = ?, urutan = ?, updated_at = ? WHERE id = ?`,
		c.Nama, b2i(c.Aktif), c.Urutan, fmtTime(s.cfg.Now()), id)
	if uniqueErr(err) {
		return conflict("saluran %q sudah ada", c.Nama)
	}
	if err != nil {
		return err
	}
	c, err = s.saluranByID(id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, c)
}

func (s *Server) potonganByID(id int64) (potongan, error) {
	p, err := scanPotongan(s.db.QueryRow(`SELECT `+kolomPotongan+` FROM potongan_saluran WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return p, notFound("potongan")
	}
	return p, err
}

func (s *Server) createPotongan(w http.ResponseWriter, r *http.Request) error {
	sid, err := pathID(r, "id")
	if err != nil {
		return err
	}
	var in struct {
		Nama   string  `json:"nama"`
		Jenis  string  `json:"jenis"`
		Nilai  float64 `json:"nilai"`
		MaksRp *int64  `json:"maks_rp"`
		Aktif  *bool   `json:"aktif"`
		Urutan int64   `json:"urutan"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	if _, err := s.saluranByID(sid); err != nil {
		return err
	}
	p := potongan{SaluranID: sid, Nama: in.Nama, Jenis: in.Jenis, Nilai: in.Nilai, MaksRp: in.MaksRp, Aktif: in.Aktif == nil || *in.Aktif, Urutan: in.Urutan}
	if err := validasiPotongan(&p); err != nil {
		return err
	}
	now := fmtTime(s.cfg.Now())
	res, err := s.db.Exec(`INSERT INTO potongan_saluran (saluran_id, nama, jenis, nilai, maks_rp, aktif, urutan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sid, p.Nama, p.Jenis, p.Nilai, p.MaksRp, b2i(p.Aktif), p.Urutan, now, now)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	p, err = s.potonganByID(id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusCreated, p)
}

func (s *Server) patchPotongan(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	var in struct {
		Nama   Opt[string]  `json:"nama"`
		Jenis  Opt[string]  `json:"jenis"`
		Nilai  Opt[float64] `json:"nilai"`
		MaksRp Opt[int64]   `json:"maks_rp"`
		Aktif  Opt[bool]    `json:"aktif"`
		Urutan Opt[int64]   `json:"urutan"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	p, err := s.potonganByID(id)
	if err != nil {
		return err
	}
	if in.Nama.Set {
		p.Nama = in.Nama.V
	}
	if in.Jenis.Set {
		p.Jenis = in.Jenis.V
		if p.Jenis != PotonganPersen && !in.MaksRp.Set {
			p.MaksRp = nil // batas maks hanya bermakna untuk persen
		}
	}
	if in.Nilai.Set {
		p.Nilai = in.Nilai.V
	}
	if in.MaksRp.Set {
		if in.MaksRp.Null {
			p.MaksRp = nil
		} else {
			v := in.MaksRp.V
			p.MaksRp = &v
		}
	}
	if in.Aktif.Set {
		p.Aktif = in.Aktif.V
	}
	if in.Urutan.Set {
		p.Urutan = in.Urutan.V
	}
	if err := validasiPotongan(&p); err != nil {
		return err
	}
	if _, err := s.db.Exec(`UPDATE potongan_saluran SET nama = ?, jenis = ?, nilai = ?, maks_rp = ?, aktif = ?, urutan = ?, updated_at = ? WHERE id = ?`,
		p.Nama, p.Jenis, p.Nilai, p.MaksRp, b2i(p.Aktif), p.Urutan, fmtTime(s.cfg.Now()), id); err != nil {
		return err
	}
	p, err = s.potonganByID(id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, p)
}

func (s *Server) deletePotongan(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	res, err := s.db.Exec(`DELETE FROM potongan_saluran WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return notFound("potongan")
	}
	return noContent(w)
}
