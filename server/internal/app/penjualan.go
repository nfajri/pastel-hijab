package app

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"tokohijab/server/internal/hitung"
)

// Penjualan (§5.5): satu pesanan di satu saluran, bisa beberapa produk. Stok berkurang dalam transaksi yang sama;
// ditolak bila qty > stok (K-11). Potongan dihitung otomatis per pesanan (K-12) dan boleh diganti manual.

type penjualanBaris struct {
	ID         int64   `json:"id"`
	ProdukID   int64   `json:"produk_id"`
	ProdukNama string  `json:"produk_nama"`
	Qty        int64   `json:"qty"`
	Harga      int64   `json:"harga"`
	Subtotal   int64   `json:"subtotal"`
	HPP        float64 `json:"hpp"`       // modal/pcs saat dijual
	HPPTotal   float64 `json:"hpp_total"` // qty × hpp
	Potongan   int64   `json:"potongan"`  // bagian baris dari potongan pesanan
	Untung     float64 `json:"untung"`
}

type penjualanPotongan struct {
	PotonganID *int64  `json:"potongan_id"`
	Nama       string  `json:"nama"`
	Jenis      string  `json:"jenis"`
	Nilai      float64 `json:"nilai"`
	MaksRp     *int64  `json:"maks_rp"`
	Rp         int64   `json:"rp"`
}

type penjualan struct {
	ID               int64               `json:"id"`
	Tanggal          string              `json:"tanggal"`
	SaluranID        int64               `json:"saluran_id"`
	SaluranNama      string              `json:"saluran_nama"`
	Catatan          string              `json:"catatan"`
	Baris            []penjualanBaris    `json:"baris"`
	Qty              int64               `json:"qty"`
	Subtotal         int64               `json:"subtotal"`
	PotonganOtomatis int64               `json:"potongan_otomatis"`
	Potongan         int64               `json:"potongan"`
	PotonganDiubah   bool                `json:"potongan_diubah"`
	RincianPotongan  []penjualanPotongan `json:"rincian_potongan"`
	UangDiterima     int64               `json:"uang_diterima"`
	HPPTotal         float64             `json:"hpp_total"`
	Untung           float64             `json:"untung"`
	CreatedAt        string              `json:"created_at"`
	UpdatedAt        string              `json:"updated_at"`
}

type penjualanBarisIn struct {
	ProdukID int64  `json:"produk_id"`
	Qty      int64  `json:"qty"`
	Harga    *int64 `json:"harga"` // nil = harga produk di saluran ini
}

type penjualanIn struct {
	Tanggal   string             `json:"tanggal"`
	SaluranID int64              `json:"saluran_id"`
	Catatan   string             `json:"catatan"`
	Potongan  *int64             `json:"potongan"` // nil = otomatis dari pengaturan saluran
	Baris     []penjualanBarisIn `json:"baris"`
}

// stokKurang = satu baris yang ditolak karena stok, supaya UI bisa menandai baris yang tepat.
type stokKurang struct {
	ProdukID   int64  `json:"produk_id"`
	ProdukNama string `json:"produk_nama"`
	Qty        int64  `json:"qty"`
	Stok       int64  `json:"stok"`
	Pesan      string `json:"pesan"`
}

const maxBarisJual = 100

func loadPenjualan(q querier, tail string, args ...any) ([]penjualan, error) {
	rows, err := q.Query(`SELECT j.id, j.tanggal, j.saluran_id, s.nama, j.catatan, j.potongan_otomatis, j.potongan, j.potongan_diubah, j.created_at, j.updated_at
		FROM penjualan j JOIN saluran s ON s.id = j.saluran_id `+tail, args...)
	if err != nil {
		return nil, err
	}
	out := []penjualan{}
	idx := map[int64]int{}
	var ids []string
	for rows.Next() {
		var j penjualan
		if err := rows.Scan(&j.ID, &j.Tanggal, &j.SaluranID, &j.SaluranNama, &j.Catatan, &j.PotonganOtomatis, &j.Potongan, &j.PotonganDiubah, &j.CreatedAt, &j.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		j.Baris = []penjualanBaris{}
		j.RincianPotongan = []penjualanPotongan{}
		idx[j.ID] = len(out)
		ids = append(ids, strconv.FormatInt(j.ID, 10))
		out = append(out, j)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(out) == 0 {
		return out, err
	}
	// ids berasal dari INTEGER database, aman disisipkan.
	in := strings.Join(ids, ",")
	brows, err := q.Query(`SELECT b.penjualan_id, b.id, b.produk_id, p.nama, b.qty, b.harga, b.hpp, b.potongan
		FROM penjualan_baris b JOIN produk p ON p.id = b.produk_id WHERE b.penjualan_id IN (` + in + `) ORDER BY b.id`)
	if err != nil {
		return nil, err
	}
	for brows.Next() {
		var jid int64
		var b penjualanBaris
		if err := brows.Scan(&jid, &b.ID, &b.ProdukID, &b.ProdukNama, &b.Qty, &b.Harga, &b.HPP, &b.Potongan); err != nil {
			brows.Close()
			return nil, err
		}
		b.Subtotal = b.Qty * b.Harga
		b.HPPTotal = hitung.Sen(float64(b.Qty) * b.HPP)
		b.Untung = hitung.Sen(float64(b.Subtotal-b.Potongan) - b.HPPTotal)
		j := &out[idx[jid]]
		j.Baris = append(j.Baris, b)
	}
	brows.Close()
	if err := brows.Err(); err != nil {
		return nil, err
	}
	prows, err := q.Query(`SELECT penjualan_id, potongan_id, nama, jenis, nilai, maks_rp, rp FROM penjualan_potongan
		WHERE penjualan_id IN (` + in + `) ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer prows.Close()
	for prows.Next() {
		var jid int64
		var p penjualanPotongan
		var pid, maks sql.NullInt64
		if err := prows.Scan(&jid, &pid, &p.Nama, &p.Jenis, &p.Nilai, &maks, &p.Rp); err != nil {
			return nil, err
		}
		if pid.Valid {
			p.PotonganID = &pid.Int64
		}
		if maks.Valid {
			p.MaksRp = &maks.Int64
		}
		j := &out[idx[jid]]
		j.RincianPotongan = append(j.RincianPotongan, p)
	}
	if err := prows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		j := &out[i]
		var hpp float64
		for _, b := range j.Baris {
			j.Qty += b.Qty
			j.Subtotal += b.Subtotal
			hpp += b.HPPTotal
		}
		j.HPPTotal = hitung.Sen(hpp)
		j.UangDiterima = j.Subtotal - j.Potongan
		j.Untung = hitung.Sen(float64(j.UangDiterima) - j.HPPTotal)
	}
	return out, nil
}

func penjualanByID(q querier, id int64) (penjualan, error) {
	list, err := loadPenjualan(q, `WHERE j.id = ?`, id)
	if err != nil {
		return penjualan{}, err
	}
	if len(list) == 0 {
		return penjualan{}, notFound("penjualan")
	}
	return list[0], nil
}

// filterTanggal menambahkan kondisi dari/sampai (YYYY-MM-DD, inklusif) pada kolom tertentu.
func (s *Server) filterTanggal(r *http.Request, kolom string, conds []string, args []any) ([]string, []any, error) {
	for _, f := range []struct{ q, op string }{{"dari", ">="}, {"sampai", "<="}} {
		if v := r.URL.Query().Get(f.q); v != "" {
			t, err := tanggal(v, s.cfg.Now())
			if err != nil {
				return nil, nil, bad("%s harus berformat YYYY-MM-DD", f.q)
			}
			conds = append(conds, kolom+` `+f.op+` ?`)
			args = append(args, t)
		}
	}
	return conds, args, nil
}

func queryLimit(r *http.Request, bawaan int) (int, error) {
	v := r.URL.Query().Get("limit")
	if v == "" {
		return bawaan, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 || n > 5000 {
		return 0, bad("limit 1–5000")
	}
	return n, nil
}

// GET /api/penjualan?dari=&sampai=&saluran_id=&produk_id=&limit=200 (terbaru dulu)
func (s *Server) listPenjualan(w http.ResponseWriter, r *http.Request) error {
	conds, args, err := s.filterTanggal(r, "j.tanggal", nil, nil)
	if err != nil {
		return err
	}
	sid, err := queryID(r, "saluran_id")
	if err != nil {
		return err
	}
	if sid > 0 {
		conds = append(conds, `j.saluran_id = ?`)
		args = append(args, sid)
	}
	pid, err := queryID(r, "produk_id")
	if err != nil {
		return err
	}
	if pid > 0 {
		conds = append(conds, `EXISTS (SELECT 1 FROM penjualan_baris x WHERE x.penjualan_id = j.id AND x.produk_id = ?)`)
		args = append(args, pid)
	}
	limit, err := queryLimit(r, 200)
	if err != nil {
		return err
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}
	list, err := loadPenjualan(s.db, where+` ORDER BY j.tanggal DESC, j.id DESC LIMIT `+strconv.Itoa(limit), args...)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, list)
}

func (s *Server) getPenjualan(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	j, err := penjualanByID(s.db, id)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, j)
}

// potonganAktif = komponen potongan aktif sebuah saluran, urut tampilan.
func potonganAktif(q querier, saluranID int64) ([]potongan, error) {
	rows, err := q.Query(`SELECT `+kolomPotongan+` FROM potongan_saluran WHERE saluran_id = ? AND aktif = 1 ORDER BY urutan, id`, saluranID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []potongan{}
	for rows.Next() {
		p, err := scanPotongan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func keHitung(list []potongan) []hitung.Potongan {
	out := make([]hitung.Potongan, len(list))
	for i, p := range list {
		out[i] = hitung.Potongan{ID: p.ID, Nama: p.Nama, Jenis: p.Jenis, Nilai: p.Nilai, MaksRp: p.MaksRp}
	}
	return out
}

func hariIni(now time.Time) string { return now.In(wib).Format(time.DateOnly) }

// terapkanJual memvalidasi pesanan, mengurangi stok, lalu menyimpan penjualan (id 0 = baru).
// lama = versi sebelum diubah (stoknya sudah dikembalikan oleh batalkanJual), nil untuk penjualan baru:
// produk yang sudah ada di versi lama memakai HPP lama, supaya edit tidak mengubah untung karena modal berubah (§7 butir 11).
func (s *Server) terapkanJual(tx *sql.Tx, id int64, in penjualanIn, lama *penjualan) (int64, error) {
	now := s.cfg.Now()
	tgl, err := tanggal(in.Tanggal, now)
	if err != nil {
		return 0, err
	}
	if tgl > hariIni(now) {
		return 0, bad("Tanggal penjualan tidak boleh setelah hari ini")
	}
	catatan, err := teks("catatan", in.Catatan, false, 500)
	if err != nil {
		return 0, err
	}
	if in.SaluranID <= 0 {
		return 0, bad("saluran_id wajib diisi")
	}
	var salNama string
	var salAktif bool
	err = tx.QueryRow(`SELECT nama, aktif FROM saluran WHERE id = ?`, in.SaluranID).Scan(&salNama, &salAktif)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, bad("saluran tidak ditemukan")
	}
	if err != nil {
		return 0, err
	}
	if !salAktif && (lama == nil || lama.SaluranID != in.SaluranID) {
		return 0, bad("Saluran %s nonaktif", salNama)
	}
	if len(in.Baris) == 0 {
		return 0, bad("Pilih minimal satu barang")
	}
	if len(in.Baris) > maxBarisJual {
		return 0, bad("barang dalam satu pesanan maksimal %d", maxBarisJual)
	}
	hppLama := map[int64]float64{}
	if lama != nil {
		for _, b := range lama.Baris {
			hppLama[b.ProdukID] = b.HPP
		}
	}

	type baris struct {
		produkID int64
		qty      int64
		harga    int64
		hpp      float64
	}
	bs := make([]baris, 0, len(in.Baris))
	var kurang []stokKurang
	seen := map[int64]bool{}
	var subtotal, qty int64
	for i, b := range in.Baris {
		if b.ProdukID <= 0 {
			return 0, bad("baris[%d]: produk_id wajib diisi", i)
		}
		if seen[b.ProdukID] {
			return 0, bad("baris[%d]: produk yang sama muncul dua kali", i)
		}
		seen[b.ProdukID] = true
		if b.Qty <= 0 || b.Qty > maxQty {
			return 0, bad("baris[%d]: qty harus 1–%d", i, maxQty)
		}
		var nama string
		var aktif bool
		var stok int64
		var modal float64
		err := tx.QueryRow(`SELECT nama, aktif, stok, modal FROM produk WHERE id = ?`, b.ProdukID).Scan(&nama, &aktif, &stok, &modal)
		if errors.Is(err, sql.ErrNoRows) {
			return 0, bad("baris[%d]: produk tidak ditemukan", i)
		}
		if err != nil {
			return 0, err
		}
		_, diLama := hppLama[b.ProdukID]
		if !aktif && !diLama {
			return 0, bad("Produk %s nonaktif", nama)
		}
		var harga int64
		if b.Harga != nil {
			harga = *b.Harga
		} else {
			err := tx.QueryRow(`SELECT harga FROM harga_produk_saluran WHERE produk_id = ? AND saluran_id = ?`, b.ProdukID, in.SaluranID).Scan(&harga)
			if errors.Is(err, sql.ErrNoRows) {
				return 0, bad("Harga %s di %s belum diatur. Isi harga", nama, salNama)
			}
			if err != nil {
				return 0, err
			}
		}
		if err := rupiah("harga", harga); err != nil {
			return 0, err
		}
		if b.Qty > stok {
			k := stokKurang{ProdukID: b.ProdukID, ProdukNama: nama, Qty: b.Qty, Stok: stok, Pesan: fmt.Sprintf("Stok tersisa %d", stok)}
			if stok == 0 {
				k.Pesan = "Stok habis"
			}
			kurang = append(kurang, k)
		}
		hpp, ok := hppLama[b.ProdukID]
		if !ok {
			hpp = modal
		}
		bs = append(bs, baris{b.ProdukID, b.Qty, harga, hpp})
		subtotal += b.Qty * harga
		qty += b.Qty
	}
	if len(kurang) > 0 {
		// §7 butir 16 / K-11: seluruh pesanan ditolak, stok tidak berubah (transaksi di-rollback pemanggil).
		pesan := make([]string, len(kurang))
		for i, k := range kurang {
			pesan[i] = k.ProdukNama + ": " + strings.ToLower(k.Pesan[:1]) + k.Pesan[1:]
		}
		return 0, &httpError{code: http.StatusConflict, msg: "Stok tidak cukup. " + strings.Join(pesan, "; "),
			extra: map[string]any{"stok_kurang": kurang}}
	}
	if subtotal > maxRp {
		return 0, bad("total pesanan terlalu besar")
	}

	komp, err := potonganAktif(tx, in.SaluranID)
	if err != nil {
		return 0, err
	}
	rpKomp := hitung.PotonganPesanan(keHitung(komp), subtotal, qty)
	var otomatis int64
	for _, v := range rpKomp {
		otomatis += v
	}
	final, diubah := otomatis, false
	if in.Potongan != nil {
		if err := rupiah("potongan", *in.Potongan); err != nil {
			return 0, err
		}
		final, diubah = *in.Potongan, *in.Potongan != otomatis
	}
	bobot := make([]int64, len(bs))
	for i, b := range bs {
		bobot[i] = b.qty * b.harga
	}
	alok := hitung.Alokasi(final, bobot)

	ts := fmtTime(now)
	for _, b := range bs {
		if _, err := tx.Exec(`UPDATE produk SET stok = stok - ?, updated_at = ? WHERE id = ?`, b.qty, ts, b.produkID); err != nil {
			return 0, err
		}
	}
	if id == 0 {
		res, err := tx.Exec(`INSERT INTO penjualan (tanggal, saluran_id, catatan, potongan_otomatis, potongan, potongan_diubah, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, tgl, in.SaluranID, catatan, otomatis, final, b2i(diubah), ts, ts)
		if err != nil {
			return 0, err
		}
		id, _ = res.LastInsertId()
	} else {
		if _, err := tx.Exec(`UPDATE penjualan SET tanggal = ?, saluran_id = ?, catatan = ?, potongan_otomatis = ?, potongan = ?, potongan_diubah = ?, updated_at = ? WHERE id = ?`,
			tgl, in.SaluranID, catatan, otomatis, final, b2i(diubah), ts, id); err != nil {
			return 0, err
		}
		for _, t := range []string{"penjualan_baris", "penjualan_potongan"} {
			if _, err := tx.Exec(`DELETE FROM `+t+` WHERE penjualan_id = ?`, id); err != nil {
				return 0, err
			}
		}
	}
	for i, b := range bs {
		if _, err := tx.Exec(`INSERT INTO penjualan_baris (penjualan_id, produk_id, qty, harga, hpp, potongan) VALUES (?, ?, ?, ?, ?, ?)`,
			id, b.produkID, b.qty, b.harga, b.hpp, alok[i]); err != nil {
			return 0, err
		}
	}
	for i, k := range komp {
		if _, err := tx.Exec(`INSERT INTO penjualan_potongan (penjualan_id, potongan_id, nama, jenis, nilai, maks_rp, rp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, k.ID, k.Nama, k.Jenis, k.Nilai, k.MaksRp, rpKomp[i]); err != nil {
			return 0, err
		}
	}
	return id, nil
}

// batalkanJual mengembalikan stok semua baris penjualan. Modal produk tidak berubah (penjualan tidak mengubah modal, §5.2).
func batalkanJual(tx *sql.Tx, j penjualan, now string) error {
	for _, b := range j.Baris {
		if _, err := tx.Exec(`UPDATE produk SET stok = stok + ?, updated_at = ? WHERE id = ?`, b.Qty, now, b.ProdukID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) createPenjualan(w http.ResponseWriter, r *http.Request) error {
	var in penjualanIn
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	id, err := s.terapkanJual(tx, 0, in, nil)
	if err != nil {
		return err
	}
	j, err := penjualanByID(tx, id)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return writeJSON(w, http.StatusCreated, j)
}

// POST /api/penjualan/hitung = pratinjau: validasi & hitung seperti simpan (termasuk cek stok), tanpa menyimpan.
// Body sama dengan POST /api/penjualan, plus "id" opsional untuk pratinjau edit.
func (s *Server) hitungPenjualan(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		penjualanIn
		ID int64 `json:"id"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() // selalu dibatalkan
	var lama *penjualan
	if in.ID > 0 {
		l, err := penjualanByID(tx, in.ID)
		if err != nil {
			return err
		}
		if err := batalkanJual(tx, l, fmtTime(s.cfg.Now())); err != nil {
			return err
		}
		lama = &l
	}
	id, err := s.terapkanJual(tx, in.ID, in.penjualanIn, lama)
	if err != nil {
		return err
	}
	j, err := penjualanByID(tx, id)
	if err != nil {
		return err
	}
	if in.ID == 0 {
		j.ID, j.CreatedAt, j.UpdatedAt = 0, "", ""
		for i := range j.Baris {
			j.Baris[i].ID = 0
		}
	}
	return writeJSON(w, http.StatusOK, j)
}

// PUT = kembalikan stok versi lama lalu terapkan versi baru (dicek terhadap stok), dalam satu transaksi.
func (s *Server) updatePenjualan(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	var in penjualanIn
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	lama, err := penjualanByID(tx, id)
	if err != nil {
		return err
	}
	if err := batalkanJual(tx, lama, fmtTime(s.cfg.Now())); err != nil {
		return err
	}
	if _, err := s.terapkanJual(tx, id, in, &lama); err != nil {
		return err
	}
	j, err := penjualanByID(tx, id)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, j)
}

func (s *Server) deletePenjualan(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	lama, err := penjualanByID(tx, id)
	if err != nil {
		return err
	}
	if err := batalkanJual(tx, lama, fmtTime(s.cfg.Now())); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM penjualan WHERE id = ?`, id); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return noContent(w)
}
