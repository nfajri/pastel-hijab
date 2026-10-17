package app

import (
	"strconv"
	"testing"
)

// Uji temuan QC T-0135 (T-0138).

// #1: potongan manual tidak boleh melebihi total harga; sama persis boleh.
func TestPenjualan_PotonganMelebihiSubtotal(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 10, 25000)
	_, b := f.jual(map[string]any{"saluran_id": salShopee, "potongan": 99999999, "baris": []any{baris(a, 1, 40000)}}, 400)
	if errMsg(b) != "Potongan tidak boleh melebihi total harga" {
		t.Fatalf("pesan: %s", b)
	}
	j, _ := f.jual(map[string]any{"saluran_id": salShopee, "potongan": 80000, "baris": []any{baris(a, 2, 40000)}}, 201)
	if j.UangDiterima != 0 {
		t.Fatalf("potongan = subtotal: %+v", j)
	}
	path := "/api/penjualan/" + strconv.FormatInt(j.ID, 10)
	if code, b := f.c.do("PUT", path, map[string]any{"saluran_id": salShopee, "potongan": 80001, "baris": []any{baris(a, 2, 40000)}}); code != 400 {
		t.Fatalf("PUT potongan > subtotal: %d %s", code, b)
	}
}

// #3 (keputusan Andi, opsi a): edit yang tidak mengubah baris/qty/harga/saluran dan tidak mengirim potongan
// mempertahankan potongan tersimpan walau pengaturan saluran sudah berganti.
func TestPenjualan_EditPertahankanPotongan(t *testing.T) {
	e := newEnv(t, "")
	f := &fixture{t: t, c: e.login(t)}
	var adm potongan
	f.c.json("POST", "/api/saluran/1/potongan", map[string]any{"nama": "Biaya admin", "jenis": "persen", "nilai": 10}, 201, &adm)
	a := f.produk("Pashmina Ceruty", 10, 20000)
	bb := f.produk("Bergo Jersey", 10, 10000)
	j, _ := f.jual(map[string]any{"saluran_id": salShopee, "baris": []any{baris(a, 1, 20000), baris(bb, 1, 10000)}}, 201)
	if j.Potongan != 3000 {
		t.Fatalf("potongan awal: %+v", j)
	}
	f.c.json("PATCH", "/api/potongan/"+strconv.FormatInt(adm.ID, 10), map[string]any{"nilai": 15}, 200, nil)
	path := "/api/penjualan/" + strconv.FormatInt(j.ID, 10)

	// Hanya ganti catatan (urutan baris dibalik pun tetap dianggap sama) → 3.000 tetap, rincian tetap 10%.
	var j2 penjualan
	f.c.json("PUT", path, map[string]any{"saluran_id": salShopee, "catatan": "dikirim JNE", "baris": []any{baris(bb, 1, 10000), baris(a, 1, 20000)}}, 200, &j2)
	if j2.Potongan != 3000 || j2.PotonganOtomatis != 3000 || j2.PotonganDiubah || j2.Untung != j.Untung || j2.Catatan != "dikirim JNE" {
		t.Fatalf("potongan lama harus tetap: %+v", j2)
	}
	if len(j2.RincianPotongan) != 1 || j2.RincianPotongan[0].Nilai != 10 || j2.RincianPotongan[0].Rp != 3000 {
		t.Fatalf("rincian: %+v", j2.RincianPotongan)
	}
	pot := map[int64]int64{}
	for _, x := range j2.Baris {
		pot[x.ProdukID] = x.Potongan
	}
	if pot[a] != 2000 || pot[bb] != 1000 {
		t.Fatalf("potongan per baris: %+v", j2.Baris)
	}

	// Potongan manual lama juga dipertahankan.
	f.c.json("PUT", path, map[string]any{"saluran_id": salShopee, "potongan": 2500, "baris": []any{baris(a, 1, 20000), baris(bb, 1, 10000)}}, 200, &j2)
	f.c.json("PUT", path, map[string]any{"saluran_id": salShopee, "catatan": "x", "baris": []any{baris(a, 1, 20000), baris(bb, 1, 10000)}}, 200, &j2)
	if j2.Potongan != 2500 || !j2.PotonganDiubah || j2.PotonganOtomatis != 4500 {
		t.Fatalf("potongan manual lama: %+v", j2)
	}

	// Qty berubah → hitung ulang dengan pengaturan sekarang (15%).
	f.c.json("PUT", path, map[string]any{"saluran_id": salShopee, "baris": []any{baris(a, 2, 20000), baris(bb, 1, 10000)}}, 200, &j2)
	if j2.Potongan != 7500 || j2.PotonganDiubah || j2.RincianPotongan[0].Nilai != 15 {
		t.Fatalf("qty berubah harus hitung ulang: %+v", j2)
	}
}

// #4: harga produk-saluran harus > 0; harga 0 di penjualan (hadiah) tetap boleh.
func TestHarga_NolDitolak(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 10, 25000)
	code, b := f.c.do("PUT", "/api/produk/"+strconv.FormatInt(a, 10)+"/harga/1", map[string]any{"harga": 0})
	if code != 400 || errMsg(b) != "Isi harga" {
		t.Fatalf("harga 0: %d %s", code, b)
	}
	j, _ := f.jual(map[string]any{"saluran_id": salPasar, "catatan": "hadiah", "baris": []any{baris(a, 1, 0)}}, 201)
	if j.Subtotal != 0 || j.Untung != -25000 {
		t.Fatalf("penjualan hadiah: %+v", j)
	}
}

// #5: harga cek untuk saluran yang tidak ikut dihitung ditolak, tidak dibuang diam-diam.
func TestKalkulator_CekSaluranTakDikenal(t *testing.T) {
	f := newFixture(t)
	if code, b := f.c.do("POST", "/api/kalkulator", map[string]any{"modal": 1000, "cara": "rupiah", "nilai": 10,
		"cek": []any{map[string]any{"saluran_id": 999, "harga": 100}}}); code != 404 {
		t.Fatalf("saluran 999: %d %s", code, b)
	}
	// Saluran ada tapi tidak dipilih (saluran_id = Shopee) → 400.
	if code, b := f.c.do("POST", "/api/kalkulator", map[string]any{"modal": 1000, "cara": "rupiah", "nilai": 10, "saluran_id": salShopee,
		"cek": []any{map[string]any{"saluran_id": salPasar, "harga": 100}}}); code != 400 {
		t.Fatalf("saluran tak dipilih: %d %s", code, b)
	}
	// Saluran nonaktif → 400.
	f.c.json("PATCH", "/api/saluran/3", map[string]any{"aktif": false}, 200, nil)
	if code, b := f.c.do("POST", "/api/kalkulator", map[string]any{"modal": 1000, "cara": "rupiah", "nilai": 10,
		"cek": []any{map[string]any{"saluran_id": 3, "harga": 100}}}); code != 400 {
		t.Fatalf("saluran nonaktif: %d %s", code, b)
	}
}

// #2: saran dengan pembulatan "tanpa" dinilai sesuai target, dan lencana produk tidak muncul setelah "Pakai harga ini".
func TestKalkulator_SaranTanpaSesuaiTarget(t *testing.T) {
	f := newFixture(t)
	f.c.json("POST", "/api/saluran/2/potongan", map[string]any{"nama": "Admin", "jenis": "persen", "nilai": 5, "maks_rp": 2000}, 201, nil)
	f.c.json("POST", "/api/saluran/2/potongan", map[string]any{"nama": "Layanan", "jenis": "per_pcs", "nilai": 500}, 201, nil)
	k := f.kalk(map[string]any{"modal": 25000, "cara": "persen_jual", "nilai": 30, "saluran_id": 2, "pembulatan": "tanpa"})
	s := cari(k, 2)
	if s.Saran == nil || *s.Saran != 39231 || s.Status != "sesuai_target" {
		t.Fatalf("kartu: %+v", s)
	}
	a := f.produk("Pashmina Ceruty", 1, 25000)
	f.c.json("PUT", "/api/produk/"+strconv.FormatInt(a, 10)+"/harga/2", map[string]any{"harga": 39231, "target_cara": "persen_jual", "target_nilai": 30}, 200, nil)
	if f.get(a).DiBawahTarget {
		t.Fatal("produk tidak boleh berlencana di bawah target")
	}
}
