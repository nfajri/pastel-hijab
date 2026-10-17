package app

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"tokohijab/server/internal/hitung"
)

// Kalkulator harga (§5.4): semua saluran aktif sekaligus (atau satu saluran), dengan mode cek per saluran.
// Tidak menyimpan apa pun; "Pakai harga ini" = PUT /api/produk/{id}/harga/{saluran}.

func validasiTarget(cara string, nilai float64) error {
	if !hitung.CaraTargetValid(cara) {
		return bad("target_cara harus salah satu: persen_jual, persen_modal, rupiah")
	}
	max := float64(maxRp)
	if cara != hitung.TargetRupiah {
		max = 10_000 // persen
	}
	return angka("nilai target", nilai, max)
}

type kalkPotongan struct {
	PotonganID int64   `json:"potongan_id"`
	Nama       string  `json:"nama"`
	Jenis      string  `json:"jenis"`
	Nilai      float64 `json:"nilai"`
	MaksRp     *int64  `json:"maks_rp"`
	Rp         int64   `json:"rp"`
}

type kalkRincian struct {
	Harga         int64          `json:"harga"`
	Modal         float64        `json:"modal"`
	Potongan      []kalkPotongan `json:"potongan"`
	TotalPotongan int64          `json:"total_potongan"`
	Untung        float64        `json:"untung"`
	PersenJual    float64        `json:"persen_jual"`
	PersenModal   float64        `json:"persen_modal"`
}

type targetSimpan struct {
	Cara  string  `json:"cara"`
	Nilai float64 `json:"nilai"`
}

type kalkSaluran struct {
	SaluranID      int64         `json:"saluran_id"`
	SaluranNama    string        `json:"saluran_nama"`
	Tercapai       bool          `json:"tercapai"` // false = target tidak bisa dicapai (p + m ≥ 100%)
	Pesan          string        `json:"pesan"`
	Mentah         *int64        `json:"mentah"`  // harga target sebelum dibulatkan (ke atas ke rupiah)
	Saran          *int64        `json:"saran"`   // sudah dibulatkan
	Minimal        *int64        `json:"minimal"` // harga impas; null bila potongan % ≥ 100%
	HargaSekarang  *int64        `json:"harga_sekarang"`
	TargetSekarang *targetSimpan `json:"target_sekarang"`
	Cek            bool          `json:"cek"`   // true = harga diketik Ibu (mode cek)
	Harga          *int64        `json:"harga"` // harga yang dinilai: harga cek, atau saran
	Rincian        *kalkRincian  `json:"rincian"`
	// sesuai_target | di_bawah_target | rugi (harga < minimal) | tidak_tercapai
	Status   string `json:"status"`
	KurangRp int64  `json:"kurang_rp"` // minimal − harga bila rugi
}

type kalkHasil struct {
	ProdukID   *int64        `json:"produk_id"`
	Modal      float64       `json:"modal"`
	Cara       string        `json:"cara"`
	Nilai      float64       `json:"nilai"`
	Pembulatan string        `json:"pembulatan"`
	Saluran    []kalkSaluran `json:"saluran"`
}

func fmtPersen(x float64) string {
	return strings.Replace(strconv.FormatFloat(x, 'f', -1, 64), ".", ",", 1) + "%"
}

func (s *Server) pembulatanBawaan(q querier) (string, error) {
	var v string
	err := q.QueryRow(`SELECT nilai FROM pengaturan WHERE kunci = 'pembulatan_bawaan'`).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !hitung.PembulatanValid(v)) {
		return hitung.Bulat1000, nil
	}
	return v, err
}

// POST /api/kalkulator
func (s *Server) kalkulator(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		ProdukID   *int64   `json:"produk_id"`
		Modal      *float64 `json:"modal"` // tanpa produk: hitung dengan modal ini
		Cara       string   `json:"cara"`
		Nilai      float64  `json:"nilai"`
		Pembulatan string   `json:"pembulatan"` // kosong = bawaan pengaturan
		SaluranID  *int64   `json:"saluran_id"` // kosong = semua saluran aktif
		Cek        []struct {
			SaluranID int64 `json:"saluran_id"`
			Harga     int64 `json:"harga"`
		} `json:"cek"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	if err := validasiTarget(in.Cara, in.Nilai); err != nil {
		return err
	}
	out := kalkHasil{Cara: in.Cara, Nilai: in.Nilai, Pembulatan: in.Pembulatan, Saluran: []kalkSaluran{}}
	if out.Pembulatan == "" {
		var err error
		if out.Pembulatan, err = s.pembulatanBawaan(s.db); err != nil {
			return err
		}
	} else if !hitung.PembulatanValid(out.Pembulatan) {
		return bad("pembulatan harus salah satu: tanpa, 100, 500, 1000, cantik")
	}
	hargaSimpan := map[int64]hargaSaluran{}
	switch {
	case in.ProdukID != nil && in.Modal != nil:
		return bad("isi salah satu: produk_id atau modal")
	case in.ProdukID != nil:
		p, err := produkByID(s.db, *in.ProdukID)
		if err != nil {
			return err
		}
		out.ProdukID, out.Modal = &p.ID, p.Modal
		for _, h := range p.Harga {
			hargaSimpan[h.SaluranID] = h
		}
	case in.Modal != nil:
		if err := angka("modal", *in.Modal, maxRp); err != nil {
			return err
		}
		out.Modal = hitung.Sen(*in.Modal)
	default:
		return bad("isi produk_id atau modal")
	}
	cek := map[int64]int64{}
	for _, c := range in.Cek {
		if err := rupiah("harga cek", c.Harga); err != nil {
			return err
		}
		cek[c.SaluranID] = c.Harga
	}

	var sal []saluran
	var err error
	if in.SaluranID != nil {
		c, err := s.saluranByID(*in.SaluranID)
		if err != nil {
			return err
		}
		sal = []saluran{c}
	} else if sal, err = s.loadSaluran(`WHERE aktif = 1`); err != nil {
		return err
	}
	// Harga cek untuk saluran yang tidak ikut dihitung (tak ada, nonaktif, atau bukan saluran_id yang dipilih) ditolak,
	// bukan dibuang diam-diam.
	dihitung := map[int64]bool{}
	for _, c := range sal {
		dihitung[c.ID] = true
	}
	for _, c := range in.Cek {
		if dihitung[c.SaluranID] {
			continue
		}
		x, err := s.saluranByID(c.SaluranID)
		if err != nil {
			return err
		}
		return bad("harga cek untuk saluran %s tidak bisa dinilai: saluran nonaktif atau tidak dipilih", x.Nama)
	}
	for _, c := range sal {
		var aktif []potongan
		for _, p := range c.Potongan {
			if p.Aktif {
				aktif = append(aktif, p)
			}
		}
		out.Saluran = append(out.Saluran, hitungSaluran(out, c, aktif, hargaSimpan, cek))
	}
	return writeJSON(w, http.StatusOK, out)
}

func hitungSaluran(k kalkHasil, c saluran, pot []potongan, simpan map[int64]hargaSaluran, cek map[int64]int64) kalkSaluran {
	hk := keHitung(pot)
	o := kalkSaluran{SaluranID: c.ID, SaluranNama: c.Nama}
	if h, ok := simpan[c.ID]; ok {
		o.HargaSekarang = &h.Harga
		if h.TargetCara != nil {
			o.TargetSekarang = &targetSimpan{Cara: *h.TargetCara, Nilai: *h.TargetNilai}
		}
	}
	if min, ok := hitung.HargaMinimal(k.Modal, hk); ok {
		o.Minimal = &min
	}
	saran, mentah, err := hitung.HargaSaran(k.Modal, hk, k.Cara, k.Nilai, k.Pembulatan)
	o.Tercapai = err == nil
	if o.Tercapai {
		o.Saran, o.Mentah = &saran, &mentah
	} else {
		var p float64
		for _, x := range pot {
			if x.Jenis == hitung.PotonganPersen {
				p += x.Nilai
			}
		}
		if k.Cara == hitung.TargetPersenJual && o.Minimal != nil {
			o.Pesan = fmt.Sprintf("Potongan saluran %s + target %s = %s. Jumlahnya harus di bawah 100%%, turunkan target untung.",
				fmtPersen(p), fmtPersen(k.Nilai), fmtPersen(p+k.Nilai))
		} else {
			o.Pesan = "Total potongan saluran 100% atau lebih. Periksa pengaturan saluran."
		}
	}
	if h, ok := cek[c.ID]; ok {
		o.Cek, o.Harga = true, &h
	} else if o.Tercapai {
		o.Harga = &saran
	}
	if o.Harga == nil {
		o.Status = "tidak_tercapai"
		return o
	}
	r := hitung.HitungRincian(k.Modal, hk, *o.Harga)
	ri := kalkRincian{Harga: r.Harga, Modal: r.Modal, TotalPotongan: r.TotalPotongan, Untung: r.Untung,
		PersenJual: hitung.Sen(r.PersenJual), PersenModal: hitung.Sen(r.PersenModal), Potongan: []kalkPotongan{}}
	for i, p := range pot {
		ri.Potongan = append(ri.Potongan, kalkPotongan{PotonganID: p.ID, Nama: p.Nama, Jenis: p.Jenis, Nilai: p.Nilai, MaksRp: p.MaksRp, Rp: r.Potongan[i]})
	}
	o.Rincian = &ri
	switch {
	case o.Minimal == nil || *o.Harga < *o.Minimal:
		o.Status = "rugi"
		if o.Minimal != nil {
			o.KurangRp = *o.Minimal - *o.Harga
		}
	case o.Tercapai && hitung.MemenuhiTarget(r, k.Cara, k.Nilai):
		o.Status = "sesuai_target"
	default:
		o.Status = "di_bawah_target"
	}
	return o
}
