package hitung

import (
	"errors"
	"math"
)

// Rumus kalkulator harga (§5.4) dan potongan penjualan (§5.5, K-12). Sama dengan
// src/__prototipe__/lib/hitung.ts; bila salah satu diubah, ubah keduanya.

// Jenis potongan saluran (§5.3).
const (
	PotonganPersen     = "persen"      // % dari harga jual, opsional batas maks Rp
	PotonganPerPesanan = "per_pesanan" // Rp sekali per pesanan
	PotonganPerPcs     = "per_pcs"     // Rp per pcs
)

// Cara target untung (K-5).
const (
	TargetPersenJual  = "persen_jual"  // m% dari harga jual
	TargetPersenModal = "persen_modal" // k% dari modal
	TargetRupiah      = "rupiah"       // Rp tetap per pcs
)

// Pilihan pembulatan (K-10). Selalu ke atas.
const (
	BulatTanpa  = "tanpa"
	Bulat100    = "100"
	Bulat500    = "500"
	Bulat1000   = "1000"
	BulatCantik = "cantik" // berakhiran 900
)

func CaraTargetValid(c string) bool {
	return c == TargetPersenJual || c == TargetPersenModal || c == TargetRupiah
}

func PembulatanValid(b string) bool {
	switch b {
	case BulatTanpa, Bulat100, Bulat500, Bulat1000, BulatCantik:
		return true
	}
	return false
}

// Potongan adalah satu komponen potongan saluran yang aktif.
type Potongan struct {
	ID     int64
	Nama   string
	Jenis  string
	Nilai  float64 // persen (8 = 8%) atau rupiah
	MaksRp *int64  // hanya untuk persen; nil = tanpa batas
}

// eps meredam galat pecahan biner (mis. 26.250 ÷ 0,6 = 43.750,000000000004).
const eps = 1e-6

// Rp membulatkan rupiah pecahan ke rupiah bulat terdekat.
func Rp(x float64) int64 { return int64(math.Round(x)) }

// ceilRp membulatkan ke atas ke rupiah bulat, dengan toleransi galat pecahan.
func ceilRp(x float64) int64 { return int64(math.Ceil(x - eps)) }

// Bulatkan harga ke atas sesuai pilihan (§5.4, §7 butir 15).
func Bulatkan(h float64, mode string) int64 {
	x := ceilRp(h)
	kelipatan := func(n int64) int64 { return (x + n - 1) / n * n }
	switch mode {
	case Bulat100:
		return kelipatan(100)
	case Bulat500:
		return kelipatan(500)
	case Bulat1000:
		return kelipatan(1000)
	case BulatCantik:
		// ⌈(H + 100) ÷ 1.000⌉ × 1.000 − 100
		return (x+100+999)/1000*1000 - 100
	}
	return x
}

// nilaiPotongan = rupiah satu komponen untuk subtotal (Rp) dan qty pcs dalam satu pesanan.
func nilaiPotongan(k Potongan, subtotal float64, qty int64) float64 {
	switch k.Jenis {
	case PotonganPersen:
		v := subtotal * k.Nilai / 100
		if k.MaksRp != nil && v > float64(*k.MaksRp) {
			v = float64(*k.MaksRp)
		}
		return v
	case PotonganPerPcs:
		return k.Nilai * float64(qty)
	case PotonganPerPesanan:
		return k.Nilai
	}
	return 0
}

// PotonganPesanan menghitung rupiah tiap komponen untuk satu pesanan sebenarnya (K-12):
// persen dari subtotal pesanan (dengan batas maks per pesanan), per pesanan sekali, per pcs × total qty.
// Tiap komponen dibulatkan ke rupiah; totalnya = jumlah hasil itu.
func PotonganPesanan(komponen []Potongan, subtotal int64, qty int64) []int64 {
	out := make([]int64, len(komponen))
	for i, k := range komponen {
		out[i] = Rp(nilaiPotongan(k, float64(subtotal), qty))
	}
	return out
}

// Alokasi membagi total (rupiah bulat) ke baris sebanding bobot (mis. subtotal baris), metode sisa terbesar,
// sehingga jumlahnya tepat = total. Bobot semua 0 → dibagi rata.
func Alokasi(total int64, bobot []int64) []int64 {
	out := make([]int64, len(bobot))
	if len(bobot) == 0 {
		return out
	}
	var sum int64
	for _, b := range bobot {
		sum += b
	}
	if sum <= 0 {
		bobot = make([]int64, len(bobot))
		for i := range bobot {
			bobot[i] = 1
		}
		sum = int64(len(bobot))
	}
	type sisa struct {
		i int
		r float64
	}
	var dibagi int64
	rs := make([]sisa, len(bobot))
	for i, b := range bobot {
		x := float64(total) * float64(b) / float64(sum)
		out[i] = int64(math.Floor(x))
		dibagi += out[i]
		rs[i] = sisa{i, x - math.Floor(x)}
	}
	// Sisa (< jumlah baris) diberikan ke baris dengan pecahan terbesar; seri → baris lebih awal.
	for n := total - dibagi; n > 0; n-- {
		best := -1
		for j, s := range rs {
			if s.r >= 0 && (best < 0 || s.r > rs[best].r) {
				best = j
			}
		}
		out[rs[best].i]++
		rs[best].r = -1
	}
	return out
}

// --- kalkulator (1 pcs per pesanan, K-12) ---

var ErrTargetTakTercapai = errors.New("target tidak bisa dicapai")

// pf = total persen (p, pecahan) dan total rupiah tetap per pcs (f); komponen persen yang sudah
// dibatasi maks dihitung sebagai rupiah tetap.
func pf(komponen []Potongan, dibatasi map[int]bool) (p, f float64) {
	for i, k := range komponen {
		switch {
		case k.Jenis == PotonganPersen && dibatasi[i]:
			f += float64(*k.MaksRp)
		case k.Jenis == PotonganPersen:
			p += k.Nilai / 100
		default:
			f += k.Nilai
		}
	}
	return
}

// HargaMentah = harga sebelum pembulatan untuk modal M dan target (cara "" = impas/harga minimal).
// ok=false bila tidak mungkin (p + m ≥ 100%, atau total potongan % ≥ 100%).
func HargaMentah(M float64, komponen []Potongan, cara string, nilai float64) (float64, bool) {
	dibatasi := map[int]bool{}
	for range len(komponen) + 1 {
		p, f := pf(komponen, dibatasi)
		var h float64
		switch cara {
		case TargetPersenJual:
			m := nilai / 100
			if p+m >= 1-1e-12 {
				return 0, false
			}
			h = (M + f) / (1 - p - m)
		case TargetPersenModal:
			if p >= 1-1e-12 {
				return 0, false
			}
			h = (M + f + nilai/100*M) / (1 - p)
		case TargetRupiah:
			if p >= 1-1e-12 {
				return 0, false
			}
			h = (M + f + nilai) / (1 - p)
		default:
			if p >= 1-1e-12 {
				return 0, false
			}
			h = (M + f) / (1 - p)
		}
		// Potongan % yang melewati batas maks di harga ini dihitung ulang sebagai rupiah tetap.
		baru := false
		for i, k := range komponen {
			if k.Jenis == PotonganPersen && k.MaksRp != nil && !dibatasi[i] && h*k.Nilai/100 > float64(*k.MaksRp) {
				dibatasi[i] = true
				baru = true
			}
		}
		if !baru {
			return h, true
		}
	}
	return 0, false
}

// HargaMinimal = harga impas dibulatkan ke atas ke rupiah. ok=false bila potongan % ≥ 100%.
func HargaMinimal(M float64, komponen []Potongan) (int64, bool) {
	h, ok := HargaMentah(M, komponen, "", 0)
	if !ok {
		return 0, false
	}
	return ceilRp(h), true
}

// Rincian untung pada harga jual tertentu (1 pcs per pesanan).
type Rincian struct {
	Harga         int64
	Modal         float64
	Potongan      []int64 // rupiah per komponen, urutan sama dengan input
	TotalPotongan int64
	Untung        float64 // harga − modal − potongan (2 desimal)
	PersenJual    float64 // untung ÷ harga × 100
	PersenModal   float64 // untung ÷ modal × 100
}

func HitungRincian(M float64, komponen []Potongan, harga int64) Rincian {
	r := Rincian{Harga: harga, Modal: M, Potongan: PotonganPesanan(komponen, harga, 1)}
	for _, v := range r.Potongan {
		r.TotalPotongan += v
	}
	r.Untung = Sen(float64(harga) - M - float64(r.TotalPotongan))
	if harga > 0 {
		r.PersenJual = r.Untung / float64(harga) * 100
	}
	if M > 0 {
		r.PersenModal = r.Untung / M * 100
	}
	return r
}

// toleransiTarget = selisih rupiah yang masih dianggap "sesuai target". Harga dan tiap komponen potongan
// dibulatkan ke rupiah, sehingga untung pada harga saran (pembulatan "tanpa") bisa kurang sepersekian
// rupiah dari target persis (mis. 11.769 vs 11.769,3).
const toleransiTarget = 1

// MemenuhiTarget melaporkan apakah untung pada rincian ini mencapai target (dengan toleransi ±Rp1).
func MemenuhiTarget(r Rincian, cara string, nilai float64) bool {
	var target float64
	switch cara {
	case TargetPersenJual:
		target = nilai / 100 * float64(r.Harga)
	case TargetPersenModal:
		target = nilai / 100 * r.Modal
	case TargetRupiah:
		target = nilai
	default:
		return true
	}
	return r.Untung+toleransiTarget+eps >= target
}

// HargaSaran = harga target yang sudah dibulatkan ke atas.
func HargaSaran(M float64, komponen []Potongan, cara string, nilai float64, bulat string) (saran, mentah int64, err error) {
	h, ok := HargaMentah(M, komponen, cara, nilai)
	if !ok {
		return 0, 0, ErrTargetTakTercapai
	}
	return Bulatkan(h, bulat), ceilRp(h), nil
}
