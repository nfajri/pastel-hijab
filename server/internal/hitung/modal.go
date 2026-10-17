// Package hitung berisi rumus murni (tanpa database) dari spesifikasi §5.2.
//
// Satuan: harga & potongan dalam rupiah bulat (int64). Modal/pcs boleh pecahan
// karena hasil bagi (ongkir per kulakan ÷ qty, rata-rata tertimbang), jadi
// disimpan float64 dan dibulatkan ke 2 desimal (sen) di setiap langkah.
package hitung

import (
	"errors"
	"math"
)

// Jenis komponen modal (§5.2).
const (
	ModalPerPcs     = "per_pcs"           // Rp per pcs
	ModalPerKulakan = "per_kulakan"       // Rp per kulakan, dibagi qty
	ModalPersenBeli = "persen_harga_beli" // % dari harga beli
)

// JenisModalValid melaporkan apakah jenis komponen modal dikenal.
func JenisModalValid(j string) bool {
	return j == ModalPerPcs || j == ModalPerKulakan || j == ModalPersenBeli
}

// KomponenModal adalah nilai satu komponen pada satu kulakan.
// Nilai = rupiah untuk per_pcs/per_kulakan, persen (mis. 2 = 2%) untuk persen_harga_beli.
type KomponenModal struct {
	Jenis string
	Nilai float64
}

// Sen membulatkan ke 2 desimal.
func Sen(x float64) float64 { return math.Round(x*100) / 100 }

// PerPcs menghitung kontribusi satu komponen ke modal/pcs.
func (k KomponenModal) PerPcs(hargaBeli int64, qty int64) float64 {
	switch k.Jenis {
	case ModalPerPcs:
		return k.Nilai
	case ModalPerKulakan:
		return k.Nilai / float64(qty)
	case ModalPersenBeli:
		return k.Nilai / 100 * float64(hargaBeli)
	}
	return 0
}

var (
	ErrQty       = errors.New("qty harus lebih dari 0")
	ErrHargaBeli = errors.New("harga beli tidak boleh negatif")
	ErrJenis     = errors.New("jenis komponen modal tidak dikenal")
	ErrNilai     = errors.New("nilai komponen tidak boleh negatif")
)

// ModalKulakan = harga beli + Σ(Rp/pcs) + Σ(Rp/kulakan ÷ qty) + Σ(% × harga beli).
func ModalKulakan(hargaBeli, qty int64, komponen []KomponenModal) (float64, error) {
	if qty <= 0 {
		return 0, ErrQty
	}
	if hargaBeli < 0 {
		return 0, ErrHargaBeli
	}
	total := float64(hargaBeli)
	for _, k := range komponen {
		if !JenisModalValid(k.Jenis) {
			return 0, ErrJenis
		}
		if k.Nilai < 0 || math.IsNaN(k.Nilai) || math.IsInf(k.Nilai, 0) {
			return 0, ErrNilai
		}
		total += k.PerPcs(hargaBeli, qty)
	}
	return Sen(total), nil
}

// RataRataTertimbang menghitung modal/pcs produk setelah barang masuk (K-8):
// (stok lama × modal lama + qty × modal kulakan) ÷ (stok lama + qty).
// Bila stok lama 0 (atau negatif karena data rusak), modal = modal kulakan.
func RataRataTertimbang(stokLama int64, modalLama float64, qty int64, modalKulakan float64) float64 {
	if stokLama <= 0 {
		return Sen(modalKulakan)
	}
	if qty <= 0 {
		return Sen(modalLama)
	}
	return Sen((float64(stokLama)*modalLama + float64(qty)*modalKulakan) / float64(stokLama+qty))
}

// BatalkanMasuk adalah kebalikan RataRataTertimbang, dipakai saat barang masuk
// dihapus/diubah: unit yang ditarik dinilai dengan modal kulakannya.
// stok & modal = kondisi produk sekarang (sudah termasuk kulakan itu).
// Bila stok habis atau hasilnya tidak masuk akal (≤ 0, mis. karena penjualan di
// antaranya), modal kembali ke modalSebelum (modal produk sebelum kulakan itu).
func BatalkanMasuk(stok int64, modal float64, qty int64, modalKulakan, modalSebelum float64) float64 {
	sisa := stok - qty
	if sisa <= 0 {
		return Sen(modalSebelum)
	}
	m := (float64(stok)*modal - float64(qty)*modalKulakan) / float64(sisa)
	if m <= 0 || math.IsNaN(m) {
		return Sen(modalSebelum)
	}
	return Sen(m)
}
