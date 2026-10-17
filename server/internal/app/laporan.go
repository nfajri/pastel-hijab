package app

import (
	"net/http"
	"sort"

	"tokohijab/server/internal/hitung"
)

// Laporan (§5.6): omzet − potongan − HPP = laba kotor − pengeluaran = laba bersih (§7 butir 12).
// Dihitung dari baris penjualan, sehingga filter saluran/model memakai potongan bagian baris itu.

type angkaJual struct {
	Pesanan   int64   `json:"pesanan"`
	Pcs       int64   `json:"pcs"`
	Omzet     int64   `json:"omzet"`
	Potongan  int64   `json:"potongan"`
	HPP       float64 `json:"hpp"`
	LabaKotor float64 `json:"laba_kotor"`
}

type ringkasan struct {
	angkaJual
	// Pengeluaran & laba bersih null bila filter saluran/model aktif (pengeluaran tidak dibagi per saluran/model).
	Pengeluaran *int64   `json:"pengeluaran"`
	LabaBersih  *float64 `json:"laba_bersih"`
}

type lapSaluran struct {
	SaluranID   int64  `json:"saluran_id"`
	SaluranNama string `json:"saluran_nama"`
	angkaJual
}

type lapProduk struct {
	ProdukID   int64  `json:"produk_id"`
	ProdukNama string `json:"produk_nama"`
	Kategori   string `json:"kategori"`
	angkaJual
}

type lapKategori struct {
	KategoriID   int64  `json:"kategori_id"`
	KategoriNama string `json:"kategori_nama"`
	Jumlah       int64  `json:"jumlah"`
}

type lapStokProduk struct {
	ProdukID         int64   `json:"produk_id"`
	ProdukNama       string  `json:"produk_nama"`
	Kategori         string  `json:"kategori"`
	Stok             int64   `json:"stok"`
	Modal            float64 `json:"modal"`
	NilaiStok        float64 `json:"nilai_stok"`
	BatasStokMenipis int64   `json:"batas_stok_menipis"`
	Menipis          bool    `json:"menipis"`
	Aktif            bool    `json:"aktif"`
}

type lapStok struct {
	TotalPcs  int64           `json:"total_pcs"`
	NilaiStok float64         `json:"nilai_stok"`
	Produk    []lapStokProduk `json:"produk"`
	Menipis   []lapStokProduk `json:"menipis"`
}

type laporan struct {
	Dari                   string        `json:"dari"`
	Sampai                 string        `json:"sampai"`
	SaluranID              *int64        `json:"saluran_id"`
	ProdukID               *int64        `json:"produk_id"`
	Ringkasan              ringkasan     `json:"ringkasan"`
	PerSaluran             []lapSaluran  `json:"per_saluran"`
	PerProduk              []lapProduk   `json:"per_produk"`
	PengeluaranPerKategori []lapKategori `json:"pengeluaran_per_kategori"`
	Stok                   lapStok       `json:"stok"`
}

func (a *angkaJual) tambah(qty, harga int64, hpp float64, pot int64) {
	a.Pcs += qty
	a.Omzet += qty * harga
	a.Potongan += pot
	a.HPP += float64(qty) * hpp
}

func (a *angkaJual) selesai() {
	a.HPP = hitung.Sen(a.HPP)
	a.LabaKotor = hitung.Sen(float64(a.Omzet-a.Potongan) - a.HPP)
}

type filterLaporan struct {
	dari, sampai string
	saluranID    int64
	produkID     int64
}

// bacaFilterLaporan: dari/sampai bawaan = awal bulan ini s/d hari ini (WIB).
func (s *Server) bacaFilterLaporan(r *http.Request) (filterLaporan, error) {
	now := s.cfg.Now()
	q := r.URL.Query()
	f := filterLaporan{dari: now.In(wib).Format("2006-01") + "-01", sampai: hariIni(now)}
	var err error
	if v := q.Get("dari"); v != "" {
		if f.dari, err = tanggal(v, now); err != nil {
			return f, bad("dari harus berformat YYYY-MM-DD")
		}
	}
	if v := q.Get("sampai"); v != "" {
		if f.sampai, err = tanggal(v, now); err != nil {
			return f, bad("sampai harus berformat YYYY-MM-DD")
		}
	}
	if f.dari > f.sampai {
		return f, bad("tanggal dari harus sebelum atau sama dengan sampai")
	}
	if f.saluranID, err = queryID(r, "saluran_id"); err != nil {
		return f, err
	}
	if f.produkID, err = queryID(r, "produk_id"); err != nil {
		return f, err
	}
	return f, nil
}

func (s *Server) hitungLaporan(q querier, f filterLaporan) (laporan, error) {
	l := laporan{Dari: f.dari, Sampai: f.sampai, PerSaluran: []lapSaluran{}, PerProduk: []lapProduk{}, PengeluaranPerKategori: []lapKategori{}}
	if f.saluranID > 0 {
		l.SaluranID = &f.saluranID
	}
	if f.produkID > 0 {
		l.ProdukID = &f.produkID
	}
	where := `WHERE j.tanggal >= ? AND j.tanggal <= ?`
	args := []any{f.dari, f.sampai}
	if f.saluranID > 0 {
		where += ` AND j.saluran_id = ?`
		args = append(args, f.saluranID)
	}
	if f.produkID > 0 {
		where += ` AND b.produk_id = ?`
		args = append(args, f.produkID)
	}
	rows, err := q.Query(`SELECT j.id, j.saluran_id, s.nama, s.urutan, b.produk_id, p.nama, p.kategori, b.qty, b.harga, b.hpp, b.potongan
		FROM penjualan_baris b JOIN penjualan j ON j.id = b.penjualan_id JOIN saluran s ON s.id = j.saluran_id JOIN produk p ON p.id = b.produk_id `+where, args...)
	if err != nil {
		return l, err
	}
	sal := map[int64]*lapSaluran{}
	salUrut := map[int64]int64{}
	prd := map[int64]*lapProduk{}
	pesanan := map[int64]bool{}
	pesananSal := map[int64]map[int64]bool{}
	pesananPrd := map[int64]map[int64]bool{}
	for rows.Next() {
		var jid, sid, surut, pid, qty, harga, pot int64
		var snama, pnama, kat string
		var hpp float64
		if err := rows.Scan(&jid, &sid, &snama, &surut, &pid, &pnama, &kat, &qty, &harga, &hpp, &pot); err != nil {
			rows.Close()
			return l, err
		}
		l.Ringkasan.tambah(qty, harga, hpp, pot)
		pesanan[jid] = true
		if sal[sid] == nil {
			sal[sid] = &lapSaluran{SaluranID: sid, SaluranNama: snama}
			salUrut[sid] = surut
			pesananSal[sid] = map[int64]bool{}
		}
		sal[sid].tambah(qty, harga, hpp, pot)
		pesananSal[sid][jid] = true
		if prd[pid] == nil {
			prd[pid] = &lapProduk{ProdukID: pid, ProdukNama: pnama, Kategori: kat}
			pesananPrd[pid] = map[int64]bool{}
		}
		prd[pid].tambah(qty, harga, hpp, pot)
		pesananPrd[pid][jid] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return l, err
	}
	l.Ringkasan.Pesanan = int64(len(pesanan))
	l.Ringkasan.selesai()
	for id, v := range sal {
		v.Pesanan = int64(len(pesananSal[id]))
		v.selesai()
		l.PerSaluran = append(l.PerSaluran, *v)
	}
	sort.Slice(l.PerSaluran, func(i, j int) bool {
		a, b := l.PerSaluran[i], l.PerSaluran[j]
		if salUrut[a.SaluranID] != salUrut[b.SaluranID] {
			return salUrut[a.SaluranID] < salUrut[b.SaluranID]
		}
		return a.SaluranID < b.SaluranID
	})
	for id, v := range prd {
		v.Pesanan = int64(len(pesananPrd[id]))
		v.selesai()
		l.PerProduk = append(l.PerProduk, *v)
	}
	// Per model: laba kotor terbesar dulu.
	sort.Slice(l.PerProduk, func(i, j int) bool {
		a, b := l.PerProduk[i], l.PerProduk[j]
		if a.LabaKotor != b.LabaKotor {
			return a.LabaKotor > b.LabaKotor
		}
		return a.ProdukID < b.ProdukID
	})

	erows, err := q.Query(`SELECT k.id, k.nama, SUM(e.jumlah) FROM pengeluaran e JOIN kategori_pengeluaran k ON k.id = e.kategori_id
		WHERE e.tanggal >= ? AND e.tanggal <= ? GROUP BY k.id ORDER BY k.urutan, k.id`, f.dari, f.sampai)
	if err != nil {
		return l, err
	}
	var totalPeng int64
	for erows.Next() {
		var k lapKategori
		if err := erows.Scan(&k.KategoriID, &k.KategoriNama, &k.Jumlah); err != nil {
			erows.Close()
			return l, err
		}
		totalPeng += k.Jumlah
		l.PengeluaranPerKategori = append(l.PengeluaranPerKategori, k)
	}
	erows.Close()
	if err := erows.Err(); err != nil {
		return l, err
	}
	if f.saluranID == 0 && f.produkID == 0 {
		bersih := hitung.Sen(l.Ringkasan.LabaKotor - float64(totalPeng))
		l.Ringkasan.Pengeluaran, l.Ringkasan.LabaBersih = &totalPeng, &bersih
	}

	l.Stok, err = hitungStok(q)
	return l, err
}

// hitungStok: produk aktif (dan nonaktif yang masih punya stok), nilai stok = stok × modal.
func hitungStok(q querier) (lapStok, error) {
	st := lapStok{Produk: []lapStokProduk{}, Menipis: []lapStokProduk{}}
	list, err := loadProduk(q, `WHERE aktif = 1 OR stok > 0`)
	if err != nil {
		return st, err
	}
	var nilai float64
	for _, p := range list {
		x := lapStokProduk{ProdukID: p.ID, ProdukNama: p.Nama, Kategori: p.Kategori, Stok: p.Stok, Modal: p.Modal,
			NilaiStok: hitung.Sen(float64(p.Stok) * p.Modal), BatasStokMenipis: p.BatasStokMenipis, Menipis: p.Menipis, Aktif: p.Aktif}
		st.TotalPcs += p.Stok
		nilai += x.NilaiStok
		st.Produk = append(st.Produk, x)
		if p.Menipis && p.Aktif {
			st.Menipis = append(st.Menipis, x)
		}
	}
	st.NilaiStok = hitung.Sen(nilai)
	return st, nil
}

// GET /api/laporan?dari=&sampai=&saluran_id=&produk_id=
func (s *Server) getLaporan(w http.ResponseWriter, r *http.Request) error {
	f, err := s.bacaFilterLaporan(r)
	if err != nil {
		return err
	}
	l, err := s.hitungLaporan(s.db, f)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, l)
}
