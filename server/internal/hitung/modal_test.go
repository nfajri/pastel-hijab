package hitung

import "testing"

// §7 butir 3: kulakan 10 pcs @Rp20.000, Plastik Rp1.000/pcs, Ongkir Rp30.000/kulakan,
// Fee 2% harga beli → modal/pcs Rp24.400.
func TestModalKulakan_Butir3(t *testing.T) {
	got, err := ModalKulakan(20000, 10, []KomponenModal{
		{Jenis: ModalPerPcs, Nilai: 1000},
		{Jenis: ModalPerKulakan, Nilai: 30000},
		{Jenis: ModalPersenBeli, Nilai: 2},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got != 24400 {
		t.Fatalf("modal kulakan = %v, mau 24400", got)
	}
}

// §7 butir 4: stok 10 @Rp20.000 + kulakan 10 @Rp30.000 → Rp25.000.
func TestRataRataTertimbang_Butir4(t *testing.T) {
	if got := RataRataTertimbang(10, 20000, 10, 30000); got != 25000 {
		t.Fatalf("modal = %v, mau 25000", got)
	}
}

func TestRataRataTertimbang_StokNol(t *testing.T) {
	if got := RataRataTertimbang(0, 99999, 5, 21000); got != 21000 {
		t.Fatalf("stok 0: modal = %v, mau modal kulakan 21000", got)
	}
}

func TestRataRataTertimbang_Pecahan(t *testing.T) {
	// (1×20000 + 2×25000) ÷ 3 = 23333,33…
	if got := RataRataTertimbang(1, 20000, 2, 25000); got != 23333.33 {
		t.Fatalf("modal = %v, mau 23333.33", got)
	}
}

func TestModalKulakan_Validasi(t *testing.T) {
	if _, err := ModalKulakan(20000, 0, nil); err != ErrQty {
		t.Fatalf("qty 0: err = %v", err)
	}
	if _, err := ModalKulakan(-1, 1, nil); err != ErrHargaBeli {
		t.Fatalf("harga negatif: err = %v", err)
	}
	if _, err := ModalKulakan(1, 1, []KomponenModal{{Jenis: "x", Nilai: 1}}); err != ErrJenis {
		t.Fatalf("jenis: err = %v", err)
	}
	if _, err := ModalKulakan(1, 1, []KomponenModal{{Jenis: ModalPerPcs, Nilai: -1}}); err != ErrNilai {
		t.Fatalf("nilai: err = %v", err)
	}
	got, err := ModalKulakan(20000, 3, []KomponenModal{{Jenis: ModalPerKulakan, Nilai: 10000}})
	if err != nil || got != 23333.33 {
		t.Fatalf("ongkir dibagi 3: %v %v", got, err)
	}
}

func TestBatalkanMasuk(t *testing.T) {
	// Kebalikan butir 4: dari 20 @25.000, tarik 10 @30.000 → 10 @20.000.
	if got := BatalkanMasuk(20, 25000, 10, 30000, 20000); got != 20000 {
		t.Fatalf("batal = %v, mau 20000", got)
	}
	// Stok habis → modal sebelum.
	if got := BatalkanMasuk(10, 30000, 10, 30000, 18000); got != 18000 {
		t.Fatalf("batal habis = %v, mau 18000", got)
	}
}
