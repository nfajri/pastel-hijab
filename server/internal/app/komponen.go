package app

import (
	"database/sql"
	"errors"
	"net/http"

	"tokohijab/server/internal/hitung"
)

// --- pengaturan ---

var pilihanPembulatan = map[string]bool{"tanpa": true, "100": true, "500": true, "1000": true, "cantik": true}

func (s *Server) getPengaturan(w http.ResponseWriter, r *http.Request) error {
	rows, err := s.db.Query(`SELECT kunci, nilai FROM pengaturan`)
	if err != nil {
		return err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return err
		}
		out[k] = v
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, out)
}

func (s *Server) patchPengaturan(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		PembulatanBawaan Opt[string] `json:"pembulatan_bawaan"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	if in.PembulatanBawaan.Set {
		if !pilihanPembulatan[in.PembulatanBawaan.V] {
			return bad("pembulatan_bawaan harus salah satu: tanpa, 100, 500, 1000, cantik")
		}
		if _, err := s.db.Exec(`INSERT INTO pengaturan (kunci, nilai) VALUES ('pembulatan_bawaan', ?)
			ON CONFLICT (kunci) DO UPDATE SET nilai = excluded.nilai`, in.PembulatanBawaan.V); err != nil {
			return err
		}
	}
	return s.getPengaturan(w, r)
}

// --- komponen modal (§5.2) ---

type komponenModal struct {
	ID        int64   `json:"id"`
	Nama      string  `json:"nama"`
	Jenis     string  `json:"jenis"`
	Nilai     float64 `json:"nilai"`
	Aktif     bool    `json:"aktif"`
	Urutan    int64   `json:"urutan"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

const kolomKomponen = `id, nama, jenis, nilai, aktif, urutan, created_at, updated_at`

func scanKomponen(sc interface{ Scan(...any) error }) (komponenModal, error) {
	var k komponenModal
	err := sc.Scan(&k.ID, &k.Nama, &k.Jenis, &k.Nilai, &k.Aktif, &k.Urutan, &k.CreatedAt, &k.UpdatedAt)
	return k, err
}

func validasiKomponen(k *komponenModal) error {
	var err error
	if k.Nama, err = teks("nama", k.Nama, true, 100); err != nil {
		return err
	}
	if !hitung.JenisModalValid(k.Jenis) {
		return bad("jenis harus salah satu: per_pcs, per_kulakan, persen_harga_beli")
	}
	return validasiNilaiModal(k.Jenis, k.Nilai)
}

func validasiNilaiModal(jenis string, v float64) error {
	if jenis == hitung.ModalPersenBeli {
		return angka("nilai (%)", v, 100)
	}
	return angka("nilai", v, maxRp)
}

func (s *Server) listKomponen(w http.ResponseWriter, r *http.Request) error {
	q := `SELECT ` + kolomKomponen + ` FROM komponen_modal`
	if queryBool(r, "aktif") {
		q += ` WHERE aktif = 1`
	}
	rows, err := s.db.Query(q + ` ORDER BY urutan, id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	out := []komponenModal{}
	for rows.Next() {
		k, err := scanKomponen(rows)
		if err != nil {
			return err
		}
		out = append(out, k)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, out)
}

func (s *Server) getKomponenByID(id int64) (komponenModal, error) {
	k, err := scanKomponen(s.db.QueryRow(`SELECT `+kolomKomponen+` FROM komponen_modal WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return k, notFound("komponen modal")
	}
	return k, err
}

func (s *Server) createKomponen(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Nama   string  `json:"nama"`
		Jenis  string  `json:"jenis"`
		Nilai  float64 `json:"nilai"`
		Aktif  *bool   `json:"aktif"`
		Urutan int64   `json:"urutan"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	k := komponenModal{Nama: in.Nama, Jenis: in.Jenis, Nilai: in.Nilai, Aktif: in.Aktif == nil || *in.Aktif, Urutan: in.Urutan}
	if err := validasiKomponen(&k); err != nil {
		return err
	}
	now := fmtTime(s.cfg.Now())
	res, err := s.db.Exec(`INSERT INTO komponen_modal (nama, jenis, nilai, aktif, urutan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		k.Nama, k.Jenis, k.Nilai, b2i(k.Aktif), k.Urutan, now, now)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	k, err = s.getKomponenByID(id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusCreated, k)
}

func (s *Server) patchKomponen(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	var in struct {
		Nama   Opt[string]  `json:"nama"`
		Jenis  Opt[string]  `json:"jenis"`
		Nilai  Opt[float64] `json:"nilai"`
		Aktif  Opt[bool]    `json:"aktif"`
		Urutan Opt[int64]   `json:"urutan"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	k, err := s.getKomponenByID(id)
	if err != nil {
		return err
	}
	if in.Nama.Set {
		k.Nama = in.Nama.V
	}
	if in.Jenis.Set {
		k.Jenis = in.Jenis.V
	}
	if in.Nilai.Set {
		k.Nilai = in.Nilai.V
	}
	if in.Aktif.Set {
		k.Aktif = in.Aktif.V
	}
	if in.Urutan.Set {
		k.Urutan = in.Urutan.V
	}
	if err := validasiKomponen(&k); err != nil {
		return err
	}
	// Kulakan lama menyimpan salinan komponennya sendiri, jadi perubahan di sini tidak mengubah modal yang sudah tercatat.
	if _, err := s.db.Exec(`UPDATE komponen_modal SET nama = ?, jenis = ?, nilai = ?, aktif = ?, urutan = ?, updated_at = ? WHERE id = ?`,
		k.Nama, k.Jenis, k.Nilai, b2i(k.Aktif), k.Urutan, fmtTime(s.cfg.Now()), id); err != nil {
		return err
	}
	k, err = s.getKomponenByID(id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, k)
}

func (s *Server) deleteKomponen(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	res, err := s.db.Exec(`DELETE FROM komponen_modal WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return notFound("komponen modal")
	}
	return noContent(w)
}
