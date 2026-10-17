package hitung

import (
	"errors"
	"math"
	"testing"
)

func rp(n int64) *int64 { return &n }

// Shopee pada contoh §7: potongan 10% + Rp1.250/pesanan.
var shopee = []Potongan{
	{ID: 1, Nama: "Biaya admin", Jenis: PotonganPersen, Nilai: 10},
	{ID: 2, Nama: "Biaya proses pesanan", Jenis: PotonganPerPesanan, Nilai: 1250},
}

// §7 butir 5: modal 25.000, target 30% dari harga jual → 26.250 ÷ 0,6 = 43.750 → Rp44.000.
func TestHarga_Butir5(t *testing.T) {
	saran, mentah, err := HargaSaran(25000, shopee, TargetPersenJual, 30, Bulat1000)
	if err != nil || mentah != 43750 || saran != 44000 {
		t.Fatalf("saran=%d mentah=%d err=%v, mau 44000/43750", saran, mentah, err)
	}
	r := HitungRincian(25000, shopee, saran)
	if !MemenuhiTarget(r, TargetPersenJual, 30) {
		t.Fatalf("44.000 harus memenuhi target 30%%: %+v", r)
	}
	if r.TotalPotongan != 4400+1250 || r.Untung != 13350 {
		t.Fatalf("rincian: %+v", r)
	}
}

// §7 butir 6: target 40% dari modal → (26.250 + 10.000) ÷ 0,9 = 40.278 → Rp41.000; target Rp10.000 sama.
func TestHarga_Butir6(t *testing.T) {
	for _, c := range []struct {
		cara  string
		nilai float64
	}{{TargetPersenModal, 40}, {TargetRupiah, 10000}} {
		saran, mentah, err := HargaSaran(25000, shopee, c.cara, c.nilai, Bulat1000)
		if err != nil || mentah != 40278 || saran != 41000 {
			t.Errorf("%s: saran=%d mentah=%d err=%v, mau 41000/40278", c.cara, saran, mentah, err)
		}
		if !MemenuhiTarget(HitungRincian(25000, shopee, saran), c.cara, c.nilai) {
			t.Errorf("%s: 41.000 harus memenuhi target", c.cara)
		}
		if MemenuhiTarget(HitungRincian(25000, shopee, 40000), c.cara, c.nilai) {
			t.Errorf("%s: 40.000 di bawah target", c.cara)
		}
	}
}

// §7 butir 7: p + m ≥ 100% → tidak ada harga.
func TestHarga_Butir7(t *testing.T) {
	for _, m := range []float64{90, 95} {
		if _, _, err := HargaSaran(25000, shopee, TargetPersenJual, m, Bulat1000); !errors.Is(err, ErrTargetTakTercapai) {
			t.Errorf("m=%v: err=%v, mau ErrTargetTakTercapai", m, err)
		}
	}
	if _, _, err := HargaSaran(25000, shopee, TargetPersenJual, 89, Bulat1000); err != nil {
		t.Errorf("89%% + 10%% < 100%% harus bisa: %v", err)
	}
	semua := []Potongan{{Jenis: PotonganPersen, Nilai: 60}, {Jenis: PotonganPersen, Nilai: 40}}
	if _, ok := HargaMinimal(25000, semua); ok {
		t.Error("potongan 100% tidak punya harga minimal")
	}
	if _, _, err := HargaSaran(25000, semua, TargetRupiah, 1000, BulatTanpa); err == nil {
		t.Error("potongan 100% tidak punya harga saran")
	}
}

// §7 butir 8: mode cek — harga di bawah minimal → rugi beserta selisihnya.
func TestHarga_Butir8(t *testing.T) {
	min, ok := HargaMinimal(25000, shopee)
	if !ok || min != 29167 { // 26.250 ÷ 0,9 = 29.166,67
		t.Fatalf("minimal=%d ok=%v, mau 29167", min, ok)
	}
	r := HitungRincian(25000, shopee, 28000)
	if r.Untung >= 0 || min-28000 != 1167 {
		t.Fatalf("28.000 harus rugi: %+v", r)
	}
	if r := HitungRincian(25000, shopee, min); r.Untung < 0 {
		t.Fatalf("harga minimal tidak boleh rugi: %+v", r)
	}
}

// §7 butir 15: pembulatan.
func TestBulatkan_Butir15(t *testing.T) {
	cases := []struct {
		h    float64
		mode string
		want int64
	}{
		{43750, BulatTanpa, 43750},
		{43750, Bulat100, 43800},
		{43750, Bulat500, 44000},
		{43750, Bulat1000, 44000},
		{43750, BulatCantik, 43900},
		{43950, BulatCantik, 44900},
		{43900, BulatCantik, 43900},
		{44000, Bulat1000, 44000},
		{43750.000000000004, Bulat1000, 44000},
		{40277.78, BulatTanpa, 40278},
		{100, BulatCantik, 900},
	}
	for _, c := range cases {
		if got := Bulatkan(c.h, c.mode); got != c.want {
			t.Errorf("Bulatkan(%v, %s) = %d, mau %d", c.h, c.mode, got, c.want)
		}
	}
}

// Batas maks potongan %: bila 10% melewati Rp3.000, dihitung sebagai Rp3.000 tetap.
func TestHarga_BatasMaks(t *testing.T) {
	k := []Potongan{{Jenis: PotonganPersen, Nilai: 10, MaksRp: rp(3000)}, {Jenis: PotonganPerPesanan, Nilai: 1250}}
	// Tanpa batas: 43.750 → potongan 4.375 > 3.000, jadi H = (25.000 + 1.250 + 3.000) ÷ 0,7 = 41.785,71.
	_, mentah, err := HargaSaran(25000, k, TargetPersenJual, 30, BulatTanpa)
	if err != nil || mentah != 41786 {
		t.Fatalf("mentah=%d err=%v, mau 41786", mentah, err)
	}
	r := HitungRincian(25000, k, 41786)
	if r.Potongan[0] != 3000 || !MemenuhiTarget(r, TargetPersenJual, 30) {
		t.Fatalf("rincian: %+v", r)
	}
	// Di bawah batas: potongan tetap persen.
	_, mentah, _ = HargaSaran(1000, k, TargetPersenJual, 30, BulatTanpa)
	if mentah != 3750 { // (1.000 + 1.250) ÷ 0,6
		t.Fatalf("mentah=%d, mau 3750", mentah)
	}
}

// Rp per pcs ikut f di kalkulator (1 pcs per pesanan).
func TestHarga_PerPcs(t *testing.T) {
	k := []Potongan{{Jenis: PotonganPerPcs, Nilai: 500}}
	saran, _, _ := HargaSaran(10000, k, TargetRupiah, 2000, BulatTanpa)
	if saran != 12500 {
		t.Fatalf("saran=%d, mau 12500", saran)
	}
	if saran, _, _ := HargaSaran(10000, nil, TargetPersenJual, 0, BulatTanpa); saran != 10000 {
		t.Fatalf("tanpa potongan & target 0 = modal, dapat %d", saran)
	}
}

// §7 butir 17: per pesanan dihitung sekali walau 2 pcs; per pcs × qty; persen dari subtotal dengan batas per pesanan.
func TestPotonganPesanan_Butir17(t *testing.T) {
	got := PotonganPesanan(shopee, 2*44000, 2)
	if got[0] != 8800 || got[1] != 1250 {
		t.Fatalf("potongan=%v, mau [8800 1250]", got)
	}
	k := []Potongan{{Jenis: PotonganPersen, Nilai: 5, MaksRp: rp(4000)}, {Jenis: PotonganPerPcs, Nilai: 300}}
	got = PotonganPesanan(k, 100000, 3)
	if got[0] != 4000 || got[1] != 900 {
		t.Fatalf("potongan=%v, mau [4000 900]", got)
	}
	if got := PotonganPesanan([]Potongan{{Jenis: PotonganPersen, Nilai: 2.5}}, 12345, 1); got[0] != 309 { // 308,625
		t.Fatalf("pembulatan: %v", got)
	}
}

func TestAlokasi(t *testing.T) {
	cases := []struct {
		total int64
		bobot []int64
		want  []int64
	}{
		{10050, []int64{88000}, []int64{10050}},
		{10000, []int64{1, 1, 1}, []int64{3334, 3333, 3333}},
		{1000, []int64{30000, 10000}, []int64{750, 250}},
		{5, []int64{0, 0}, []int64{3, 2}},
		{0, []int64{100, 200}, []int64{0, 0}},
		{7, []int64{1, 2, 4}, []int64{1, 2, 4}},
	}
	for _, c := range cases {
		got := Alokasi(c.total, c.bobot)
		var sum int64
		for i := range got {
			sum += got[i]
			if got[i] != c.want[i] {
				t.Errorf("Alokasi(%d, %v) = %v, mau %v", c.total, c.bobot, got, c.want)
				break
			}
		}
		if sum != c.total {
			t.Errorf("jumlah %d ≠ %d", sum, c.total)
		}
	}
}

func TestHitungRincian_Persen(t *testing.T) {
	r := HitungRincian(25000, shopee, 44000)
	if math.Abs(r.PersenJual-30.340909) > 1e-4 || math.Abs(r.PersenModal-53.4) > 1e-9 {
		t.Fatalf("%+v", r)
	}
	if r := HitungRincian(0, nil, 0); r.PersenJual != 0 || r.PersenModal != 0 {
		t.Fatalf("pembagian nol: %+v", r)
	}
}
