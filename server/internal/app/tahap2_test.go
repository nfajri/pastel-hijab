package app

import (
	"bytes"
	"encoding/json"
	"io"
	"strconv"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"
)

// Uji API tahap 2 (T-0135): penjualan, kalkulator, pengeluaran, laporan, ekspor. Angka mengikuti spek §7.

const (
	salShopee = 1
	salPasar  = 4
)

type fixture struct {
	t *testing.T
	c *client
}

func newFixture(t *testing.T) *fixture {
	e := newEnv(t, "")
	f := &fixture{t: t, c: e.login(t)}
	// Shopee pada contoh §7: 10% + Rp1.250/pesanan.
	f.c.json("POST", "/api/saluran/1/potongan", map[string]any{"nama": "Biaya admin", "jenis": "persen", "nilai": 10}, 201, nil)
	f.c.json("POST", "/api/saluran/1/potongan", map[string]any{"nama": "Biaya proses pesanan", "jenis": "per_pesanan", "nilai": 1250}, 201, nil)
	return f
}

// produk membuat model dengan stok & modal awal lewat barang masuk tanpa komponen.
func (f *fixture) produk(nama string, stok, modal int64) int64 {
	var p produk
	f.c.json("POST", "/api/produk", map[string]any{"nama": nama, "batas_stok_menipis": 2}, 201, &p)
	if stok > 0 {
		f.masuk(p.ID, stok, modal)
	}
	return p.ID
}

func (f *fixture) masuk(pid, qty, harga int64) {
	f.c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": pid, "qty": qty, "harga_beli": harga, "komponen": []any{}, "tanggal": "2026-10-01"}, 201, nil)
}

func (f *fixture) get(pid int64) produk {
	var p produk
	f.c.json("GET", "/api/produk/"+strconv.FormatInt(pid, 10), nil, 200, &p)
	return p
}

func (f *fixture) jual(body map[string]any, want int) (penjualan, []byte) {
	f.t.Helper()
	code, b := f.c.do("POST", "/api/penjualan", body)
	if code != want {
		f.t.Fatalf("POST /api/penjualan: %d, mau %d: %s", code, want, b)
	}
	var j penjualan
	if want == 201 {
		json.Unmarshal(b, &j)
	}
	return j, b
}

func baris(pid, qty int64, harga ...int64) map[string]any {
	m := map[string]any{"produk_id": pid, "qty": qty}
	if len(harga) > 0 {
		m["harga"] = harga[0]
	}
	return m
}

// §7 butir 9: "Pakai harga ini" menyimpan harga ke produk-saluran; harga terisi otomatis saat mencatat penjualan.
func TestPenjualan_HargaOtomatis_Butir9(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 10, 25000)
	f.c.json("PUT", "/api/produk/"+strconv.FormatInt(a, 10)+"/harga/1", map[string]any{"harga": 44000, "target_cara": "persen_jual", "target_nilai": 30}, 200, nil)
	p := f.get(a)
	if len(p.Harga) != 1 || p.Harga[0].Harga != 44000 || *p.Harga[0].TargetCara != "persen_jual" || *p.Harga[0].TargetNilai != 30 || p.Harga[0].DiBawahTarget {
		t.Fatalf("harga: %+v", p.Harga)
	}
	if p.Harga[0].Untung != 13350 { // 44.000 − 25.000 − 4.400 − 1.250
		t.Fatalf("untung = %v", p.Harga[0].Untung)
	}
	j, _ := f.jual(map[string]any{"saluran_id": salShopee, "baris": []any{baris(a, 1)}}, 201)
	if j.Baris[0].Harga != 44000 {
		t.Fatalf("harga otomatis = %d", j.Baris[0].Harga)
	}
	// Tanpa harga tersimpan di saluran itu → minta isi harga.
	code, b := f.c.do("POST", "/api/penjualan", map[string]any{"saluran_id": salPasar, "baris": []any{baris(a, 1)}})
	if code != 400 || !strings.Contains(errMsg(b), "belum diatur") {
		t.Fatalf("%d %s", code, b)
	}
	// Target harus lengkap berpasangan.
	if code, _ := f.c.do("PUT", "/api/produk/"+strconv.FormatInt(a, 10)+"/harga/1", map[string]any{"harga": 1, "target_cara": "persen_jual"}); code != 400 {
		t.Fatalf("target setengah = %d", code)
	}
}

// §7 butir 10 & 17: stok berkurang, potongan per pesanan sekali, untung per baris; hapus mengembalikan stok.
func TestPenjualan_StokPotonganUntung_Butir10_17(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 10, 25000)
	j, _ := f.jual(map[string]any{"saluran_id": salShopee, "tanggal": "2026-10-17", "baris": []any{baris(a, 2, 44000)}}, 201)
	if f.get(a).Stok != 8 {
		t.Fatalf("stok = %d, mau 8", f.get(a).Stok)
	}
	// 10% × 88.000 = 8.800 + Rp1.250 sekali (bukan 2.500).
	if j.PotonganOtomatis != 10050 || j.Potongan != 10050 || j.PotonganDiubah {
		t.Fatalf("potongan: %+v", j)
	}
	if len(j.RincianPotongan) != 2 || j.RincianPotongan[0].Rp != 8800 || j.RincianPotongan[1].Rp != 1250 {
		t.Fatalf("rincian: %+v", j.RincianPotongan)
	}
	b := j.Baris[0]
	if b.Subtotal != 88000 || b.HPP != 25000 || b.HPPTotal != 50000 || b.Potongan != 10050 || b.Untung != 27950 {
		t.Fatalf("baris: %+v", b)
	}
	if j.UangDiterima != 77950 || j.Untung != 27950 || j.Qty != 2 {
		t.Fatalf("total: %+v", j)
	}
	f.c.json("DELETE", "/api/penjualan/"+strconv.FormatInt(j.ID, 10), nil, 204, nil)
	if f.get(a).Stok != 10 {
		t.Fatalf("stok setelah hapus = %d, mau 10", f.get(a).Stok)
	}
	if f.get(a).Modal != 25000 {
		t.Fatalf("modal berubah: %v", f.get(a).Modal)
	}
}

// §7 butir 16 / K-11: stok 3, jual 4 → ditolak "stok tersisa 3", stok tidak berubah (termasuk baris lain).
func TestPenjualan_DitolakStokKurang_Butir16(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 3, 25000)
	bb := f.produk("Bergo Jersey", 5, 10000)
	_, body := f.jual(map[string]any{"saluran_id": salPasar, "baris": []any{baris(bb, 2, 20000), baris(a, 4, 40000)}}, 409)
	if !strings.Contains(errMsg(body), "stok tersisa 3") {
		t.Fatalf("pesan: %s", body)
	}
	var e struct {
		StokKurang []stokKurang `json:"stok_kurang"`
	}
	json.Unmarshal(body, &e)
	if len(e.StokKurang) != 1 || e.StokKurang[0].ProdukID != a || e.StokKurang[0].Stok != 3 || e.StokKurang[0].Qty != 4 || e.StokKurang[0].Pesan != "Stok tersisa 3" {
		t.Fatalf("stok_kurang: %+v", e.StokKurang)
	}
	if f.get(a).Stok != 3 || f.get(bb).Stok != 5 {
		t.Fatalf("stok berubah: %d %d", f.get(a).Stok, f.get(bb).Stok)
	}
	// Stok habis.
	f.jual(map[string]any{"saluran_id": salPasar, "baris": []any{baris(a, 3, 40000)}}, 201)
	_, body = f.jual(map[string]any{"saluran_id": salPasar, "baris": []any{baris(a, 1, 40000)}}, 409)
	json.Unmarshal(body, &e)
	if e.StokKurang[0].Pesan != "Stok habis" {
		t.Fatalf("stok habis: %s", body)
	}
}

// Edit penjualan: stok lama dikembalikan dulu lalu dicek; HPP lama dipertahankan (§7 butir 11).
func TestPenjualan_Edit(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 5, 25000)
	j, _ := f.jual(map[string]any{"saluran_id": salPasar, "baris": []any{baris(a, 3, 40000)}}, 201)
	path := "/api/penjualan/" + strconv.FormatInt(j.ID, 10)
	// Stok sekarang 2; edit ke 5 boleh (2 + 3 dikembalikan), ke 6 ditolak dengan stok tersisa 5.
	code, b := f.c.do("PUT", path, map[string]any{"saluran_id": salPasar, "baris": []any{baris(a, 6, 40000)}})
	if code != 409 || !strings.Contains(errMsg(b), "stok tersisa 5") {
		t.Fatalf("edit 6: %d %s", code, b)
	}
	if f.get(a).Stok != 2 {
		t.Fatalf("stok setelah edit ditolak = %d", f.get(a).Stok)
	}
	// Modal naik sesudah penjualan: kulakan 5 @Rp35.000 → modal 30.000 (stok 2+5).
	f.masuk(a, 5, 35000)
	if m := f.get(a).Modal; m != 32142.86 { // (2×25.000 + 5×35.000) ÷ 7
		t.Fatalf("modal = %v", m)
	}
	var j2 penjualan
	f.c.json("PUT", path, map[string]any{"saluran_id": salPasar, "baris": []any{baris(a, 4, 40000)}}, 200, &j2)
	if j2.Baris[0].HPP != 25000 || j2.Untung != 4*15000 {
		t.Fatalf("HPP lama harus tetap: %+v", j2.Baris[0])
	}
	if f.get(a).Stok != 6 { // 7 + 3 − 4
		t.Fatalf("stok = %d, mau 6", f.get(a).Stok)
	}
	// Produk baru di edit memakai modal sekarang.
	bb := f.produk("Bergo Jersey", 5, 10000)
	f.c.json("PUT", path, map[string]any{"saluran_id": salPasar, "baris": []any{baris(a, 4, 40000), baris(bb, 1, 20000)}}, 200, &j2)
	if j2.Baris[1].HPP != 10000 || j2.Baris[0].HPP != 25000 {
		t.Fatalf("hpp: %+v", j2.Baris)
	}
}

// §7 butir 11: kulakan baru yang menaikkan modal tidak mengubah untung penjualan lama.
func TestPenjualan_UntungLamaTetap_Butir11(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 10, 25000)
	j, _ := f.jual(map[string]any{"saluran_id": salShopee, "baris": []any{baris(a, 2, 44000)}}, 201)
	f.masuk(a, 8, 40000)
	if f.get(a).Modal <= 25000 {
		t.Fatal("modal harus naik")
	}
	var lagi penjualan
	f.c.json("GET", "/api/penjualan/"+strconv.FormatInt(j.ID, 10), nil, 200, &lagi)
	if lagi.Untung != j.Untung || lagi.Baris[0].HPP != 25000 {
		t.Fatalf("untung lama berubah: %v → %v", j.Untung, lagi.Untung)
	}
}

func TestPenjualan_PotonganManualDanValidasi(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 10, 25000)
	j, _ := f.jual(map[string]any{"saluran_id": salShopee, "potongan": 5000, "catatan": "voucher", "baris": []any{baris(a, 1, 44000)}}, 201)
	if j.Potongan != 5000 || j.PotonganOtomatis != 5650 || !j.PotonganDiubah || j.Untung != 14000 {
		t.Fatalf("potongan manual: %+v", j)
	}
	// Mengirim angka yang sama dengan otomatis = tidak diubah.
	j, _ = f.jual(map[string]any{"saluran_id": salShopee, "potongan": 5650, "baris": []any{baris(a, 1, 44000)}}, 201)
	if j.PotonganDiubah {
		t.Fatal("potongan = otomatis tidak dianggap diubah")
	}
	for name, body := range map[string]map[string]any{
		"tanggal depan": {"saluran_id": salShopee, "tanggal": "2026-10-18", "baris": []any{baris(a, 1, 1)}},
		"kosong":        {"saluran_id": salShopee, "baris": []any{}},
		"dobel":         {"saluran_id": salShopee, "baris": []any{baris(a, 1, 1), baris(a, 1, 1)}},
		"qty 0":         {"saluran_id": salShopee, "baris": []any{baris(a, 0, 1)}},
		"saluran":       {"saluran_id": 99, "baris": []any{baris(a, 1, 1)}},
		"produk":        {"saluran_id": salShopee, "baris": []any{baris(999, 1, 1)}},
		"potongan neg":  {"saluran_id": salShopee, "potongan": -1, "baris": []any{baris(a, 1, 1)}},
	} {
		if code, b := f.c.do("POST", "/api/penjualan", body); code != 400 {
			t.Errorf("%s: %d %s", name, code, b)
		}
	}
	// Saluran nonaktif ditolak untuk penjualan baru.
	f.c.json("PATCH", "/api/saluran/3", map[string]any{"aktif": false}, 200, nil)
	if code, _ := f.c.do("POST", "/api/penjualan", map[string]any{"saluran_id": 3, "baris": []any{baris(a, 1, 1)}}); code != 400 {
		t.Errorf("saluran nonaktif: %d", code)
	}
	// Produk yang sudah terjual tidak bisa dihapus.
	if code, _ := f.c.do("DELETE", "/api/produk/"+strconv.FormatInt(a, 10), nil); code != 409 {
		t.Errorf("hapus produk terjual: %d", code)
	}
}

// Pratinjau tidak menyimpan dan tidak mengubah stok, tapi tetap menolak stok kurang.
func TestPenjualan_Hitung(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 3, 25000)
	var j penjualan
	f.c.json("POST", "/api/penjualan/hitung", map[string]any{"saluran_id": salShopee, "baris": []any{baris(a, 2, 44000)}}, 200, &j)
	if j.ID != 0 || j.Potongan != 10050 || j.Untung != 27950 {
		t.Fatalf("pratinjau: %+v", j)
	}
	if code, _ := f.c.do("POST", "/api/penjualan/hitung", map[string]any{"saluran_id": salShopee, "baris": []any{baris(a, 4, 44000)}}); code != 409 {
		t.Fatalf("pratinjau stok kurang: %d", code)
	}
	var list []penjualan
	f.c.json("GET", "/api/penjualan", nil, 200, &list)
	if len(list) != 0 || f.get(a).Stok != 3 {
		t.Fatalf("pratinjau tersimpan: %d, stok %d", len(list), f.get(a).Stok)
	}
}

type kalk struct {
	Modal   float64       `json:"modal"`
	Saluran []kalkSaluran `json:"saluran"`
}

func (f *fixture) kalk(body map[string]any) kalk {
	var k kalk
	f.c.json("POST", "/api/kalkulator", body, 200, &k)
	return k
}

func cari(k kalk, sid int64) kalkSaluran {
	for _, s := range k.Saluran {
		if s.SaluranID == sid {
			return s
		}
	}
	return kalkSaluran{}
}

// §7 butir 5, 6, 7, 8, 15 lewat API.
func TestKalkulator_Butir5_6_7_8_15(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 10, 25000)

	// 5: target 30% harga jual → 44.000 (bawaan pembulatan Rp1.000); semua saluran aktif sekaligus.
	k := f.kalk(map[string]any{"produk_id": a, "cara": "persen_jual", "nilai": 30})
	if len(k.Saluran) != 4 || k.Modal != 25000 {
		t.Fatalf("saluran = %d, modal = %v", len(k.Saluran), k.Modal)
	}
	s := cari(k, salShopee)
	if *s.Saran != 44000 || *s.Mentah != 43750 || s.Status != "sesuai_target" || *s.Minimal != 29167 || s.Cek {
		t.Fatalf("butir 5: %+v", s)
	}
	if s.Rincian.TotalPotongan != 5650 || s.Rincian.Untung != 13350 || len(s.Rincian.Potongan) != 2 || s.Rincian.PersenJual != 30.34 {
		t.Fatalf("rincian: %+v", s.Rincian)
	}
	if p := cari(k, salPasar); *p.Saran != 36000 { // 25.000 ÷ 0,7 = 35.714 → 36.000
		t.Fatalf("pasar: %+v", p)
	}

	// 6: 40% dari modal dan Rp10.000 → 41.000.
	for _, c := range []map[string]any{{"cara": "persen_modal", "nilai": 40}, {"cara": "rupiah", "nilai": 10000}} {
		c["produk_id"] = a
		if s := cari(f.kalk(c), salShopee); *s.Saran != 41000 || *s.Mentah != 40278 {
			t.Errorf("butir 6 %v: %+v", c["cara"], s)
		}
	}

	// 7: p + m ≥ 100% → pesan, tanpa harga.
	s = cari(f.kalk(map[string]any{"produk_id": a, "cara": "persen_jual", "nilai": 90}), salShopee)
	if s.Tercapai || s.Saran != nil || s.Harga != nil || s.Status != "tidak_tercapai" || !strings.Contains(s.Pesan, "10% + target 90% = 100%") {
		t.Fatalf("butir 7: %+v", s)
	}

	// 8: mode cek di bawah minimal → rugi beserta selisihnya.
	s = cari(f.kalk(map[string]any{"produk_id": a, "cara": "persen_jual", "nilai": 30, "cek": []any{map[string]any{"saluran_id": 1, "harga": 28000}}}), salShopee)
	if !s.Cek || *s.Harga != 28000 || s.Status != "rugi" || s.KurangRp != 1167 || s.Rincian.Untung >= 0 {
		t.Fatalf("butir 8: %+v", s)
	}
	s = cari(f.kalk(map[string]any{"produk_id": a, "cara": "persen_jual", "nilai": 30, "cek": []any{map[string]any{"saluran_id": 1, "harga": 40000}}}), salShopee)
	if s.Status != "di_bawah_target" || s.KurangRp != 0 {
		t.Fatalf("cek di bawah target: %+v", s)
	}

	// 15: pembulatan per perhitungan, dan bawaan dari Pengaturan.
	for mode, want := range map[string]int64{"tanpa": 43750, "100": 43800, "500": 44000, "1000": 44000, "cantik": 43900} {
		if s := cari(f.kalk(map[string]any{"produk_id": a, "cara": "persen_jual", "nilai": 30, "pembulatan": mode}), salShopee); *s.Saran != want {
			t.Errorf("pembulatan %s = %d, mau %d", mode, *s.Saran, want)
		}
	}
	f.c.json("PATCH", "/api/pengaturan", map[string]any{"pembulatan_bawaan": "cantik"}, 200, nil)
	var h struct {
		Pembulatan string `json:"pembulatan"`
	}
	f.c.json("POST", "/api/kalkulator", map[string]any{"produk_id": a, "cara": "persen_jual", "nilai": 30}, 200, &h)
	if s := cari(f.kalk(map[string]any{"produk_id": a, "cara": "persen_jual", "nilai": 30}), salShopee); *s.Saran != 43900 || h.Pembulatan != "cantik" {
		t.Fatalf("bawaan cantik: %d %s", *s.Saran, h.Pembulatan)
	}
	// Tanpa produk: modal langsung; satu saluran saja.
	k = f.kalk(map[string]any{"modal": 25000, "cara": "rupiah", "nilai": 10000, "saluran_id": 1, "pembulatan": "1000"})
	if len(k.Saluran) != 1 || *k.Saluran[0].Saran != 41000 {
		t.Fatalf("modal langsung: %+v", k)
	}
	for _, body := range []map[string]any{
		{"produk_id": a, "cara": "x", "nilai": 1},
		{"cara": "rupiah", "nilai": 1},
		{"produk_id": a, "modal": 1, "cara": "rupiah", "nilai": 1},
		{"produk_id": a, "cara": "rupiah", "nilai": -1},
		{"produk_id": a, "cara": "rupiah", "nilai": 1, "pembulatan": "250"},
	} {
		if code, b := f.c.do("POST", "/api/kalkulator", body); code != 400 {
			t.Errorf("%v: %d %s", body, code, b)
		}
	}
}

// §5.4 akhir: setelah modal naik, produk yang untungnya di bawah target ditandai.
func TestProduk_DiBawahTarget(t *testing.T) {
	f := newFixture(t)
	a := f.produk("Pashmina Ceruty", 10, 25000)
	f.c.json("PUT", "/api/produk/"+strconv.FormatInt(a, 10)+"/harga/1", map[string]any{"harga": 44000, "target_cara": "persen_jual", "target_nilai": 30}, 200, nil)
	var list []produk
	f.c.json("GET", "/api/produk?di_bawah_target=1", nil, 200, &list)
	if len(list) != 0 {
		t.Fatalf("belum ada yang di bawah target: %d", len(list))
	}
	f.masuk(a, 10, 30000) // modal → 27.500
	p := f.get(a)
	if !p.DiBawahTarget || !p.Harga[0].DiBawahTarget {
		t.Fatalf("harus ditandai: %+v", p)
	}
	f.c.json("GET", "/api/produk?di_bawah_target=1", nil, 200, &list)
	if len(list) != 1 || list[0].ID != a {
		t.Fatalf("filter: %+v", list)
	}
	// Harga tanpa target tidak pernah ditandai.
	f.c.json("PUT", "/api/produk/"+strconv.FormatInt(a, 10)+"/harga/1", map[string]any{"harga": 30000}, 200, &p)
	if p.DiBawahTarget || p.Harga[0].TargetCara != nil {
		t.Fatalf("tanpa target: %+v", p.Harga[0])
	}
}

func TestPengeluaran(t *testing.T) {
	f := newFixture(t)
	var kat []kategoriPengeluaran
	f.c.json("GET", "/api/kategori-pengeluaran", nil, 200, &kat)
	if len(kat) != 4 || kat[0].Nama != "Sewa lapak" || kat[3].Nama != "Lain-lain" {
		t.Fatalf("kategori bawaan: %+v", kat)
	}
	var k kategoriPengeluaran
	f.c.json("POST", "/api/kategori-pengeluaran", map[string]any{"nama": "Ongkir retur"}, 201, &k)
	if k.Urutan != 5 || !k.Aktif {
		t.Fatalf("kategori baru: %+v", k)
	}
	if code, _ := f.c.do("POST", "/api/kategori-pengeluaran", map[string]any{"nama": "iklan"}); code != 409 {
		t.Fatalf("kategori dobel: %d", code)
	}
	var e pengeluaran
	f.c.json("POST", "/api/pengeluaran", map[string]any{"kategori_id": 1, "jumlah": 50000, "catatan": "Minggu ke-2", "tanggal": "2026-10-11"}, 201, &e)
	if e.KategoriNama != "Sewa lapak" || e.Jumlah != 50000 || e.Tanggal != "2026-10-11" {
		t.Fatalf("pengeluaran: %+v", e)
	}
	code, b := f.c.do("POST", "/api/pengeluaran", map[string]any{"kategori_id": 1, "jumlah": 0})
	if code != 400 || errMsg(b) != "Isi jumlah pengeluaran" {
		t.Fatalf("jumlah 0: %d %s", code, b)
	}
	if code, _ := f.c.do("POST", "/api/pengeluaran", map[string]any{"kategori_id": 1, "jumlah": 1, "tanggal": "2026-10-18"}); code != 400 {
		t.Fatalf("tanggal depan: %d", code)
	}
	// Kategori dipakai tidak bisa dihapus; nonaktif tidak bisa dipakai pengeluaran baru, tapi edit data lama boleh.
	if code, _ := f.c.do("DELETE", "/api/kategori-pengeluaran/1", nil); code != 409 {
		t.Fatalf("hapus kategori terpakai: %d", code)
	}
	f.c.json("PATCH", "/api/kategori-pengeluaran/1", map[string]any{"aktif": false}, 200, nil)
	if code, _ := f.c.do("POST", "/api/pengeluaran", map[string]any{"kategori_id": 1, "jumlah": 1}); code != 400 {
		t.Fatalf("kategori nonaktif: %d", code)
	}
	path := "/api/pengeluaran/" + strconv.FormatInt(e.ID, 10)
	f.c.json("PUT", path, map[string]any{"kategori_id": 1, "jumlah": 60000, "tanggal": "2026-10-11"}, 200, &e)
	if e.Jumlah != 60000 {
		t.Fatalf("edit: %+v", e)
	}
	f.c.json("GET", "/api/kategori-pengeluaran?aktif=1", nil, 200, &kat)
	if len(kat) != 4 {
		t.Fatalf("aktif = %d", len(kat))
	}
	f.c.json("DELETE", "/api/kategori-pengeluaran/"+strconv.FormatInt(k.ID, 10), nil, 204, nil)
	f.c.json("DELETE", path, nil, 204, nil)
	var list []pengeluaran
	f.c.json("GET", "/api/pengeluaran", nil, 200, &list)
	if len(list) != 0 {
		t.Fatalf("sisa %d", len(list))
	}
}

// dataLaporan: data uji §7 butir 12, dihitung manual di komentar.
func dataLaporan(f *fixture) (a, bb int64) {
	a = f.produk("Pashmina Ceruty", 10, 25000)
	bb = f.produk("Bergo Jersey", 10, 10000)
	// 1) 5 Okt Shopee: A×2 @44.000 + B×1 @20.000 = 108.000; potongan 10.800 + 1.250 = 12.050; modal 60.000.
	//    Potongan per baris sebanding subtotal: A 9.819, B 2.231.
	f.jual(map[string]any{"saluran_id": salShopee, "tanggal": "2026-10-05", "baris": []any{baris(a, 2, 44000), baris(bb, 1, 20000)}}, 201)
	// 2) 10 Okt Pasar Minggu: A×1 @40.000, tanpa potongan; modal 25.000.
	f.jual(map[string]any{"saluran_id": salPasar, "tanggal": "2026-10-10", "baris": []any{baris(a, 1, 40000)}}, 201)
	// 3) 30 Sep (di luar periode).
	f.jual(map[string]any{"saluran_id": salShopee, "tanggal": "2026-09-30", "baris": []any{baris(bb, 1, 20000)}}, 201)
	f.c.json("POST", "/api/pengeluaran", map[string]any{"kategori_id": 1, "jumlah": 50000, "tanggal": "2026-10-11"}, 201, nil)
	f.c.json("POST", "/api/pengeluaran", map[string]any{"kategori_id": 2, "jumlah": 20000, "tanggal": "2026-10-12"}, 201, nil)
	f.c.json("POST", "/api/pengeluaran", map[string]any{"kategori_id": 2, "jumlah": 99999, "tanggal": "2026-09-20"}, 201, nil)
	return
}

// §7 butir 12: laba bersih = omzet − potongan − HPP − pengeluaran; filter per saluran & per model.
func TestLaporan_Butir12(t *testing.T) {
	f := newFixture(t)
	a, bb := dataLaporan(f)
	var l laporan
	f.c.json("GET", "/api/laporan?dari=2026-10-01&sampai=2026-10-17", nil, 200, &l)
	g := l.Ringkasan
	// Omzet 148.000 − potongan 12.050 − modal 85.000 = laba kotor 50.950 − pengeluaran 70.000 = −19.050.
	if g.Omzet != 148000 || g.Potongan != 12050 || g.HPP != 85000 || g.LabaKotor != 50950 || g.Pesanan != 2 || g.Pcs != 4 {
		t.Fatalf("ringkasan: %+v", g)
	}
	if *g.Pengeluaran != 70000 || *g.LabaBersih != -19050 {
		t.Fatalf("laba bersih: %v %v", *g.Pengeluaran, *g.LabaBersih)
	}
	if len(l.PerSaluran) != 2 || l.PerSaluran[0].SaluranID != salShopee || l.PerSaluran[0].LabaKotor != 35950 || l.PerSaluran[1].LabaKotor != 15000 {
		t.Fatalf("per saluran: %+v", l.PerSaluran)
	}
	// Per model: A omzet 128.000, potongan 9.819, modal 75.000 → 43.181; B 20.000 − 2.231 − 10.000 = 7.769.
	if len(l.PerProduk) != 2 || l.PerProduk[0].ProdukID != a || l.PerProduk[0].LabaKotor != 43181 || l.PerProduk[0].Pesanan != 2 ||
		l.PerProduk[1].ProdukID != bb || l.PerProduk[1].LabaKotor != 7769 {
		t.Fatalf("per model: %+v", l.PerProduk)
	}
	if len(l.PengeluaranPerKategori) != 2 || l.PengeluaranPerKategori[0].Jumlah != 50000 {
		t.Fatalf("pengeluaran per kategori: %+v", l.PengeluaranPerKategori)
	}
	// Stok: A 10−3 = 7 × 25.000, B 10−2 = 8 × 10.000.
	if l.Stok.TotalPcs != 15 || l.Stok.NilaiStok != 255000 || len(l.Stok.Menipis) != 0 {
		t.Fatalf("stok: %+v", l.Stok)
	}

	// Filter saluran: pengeluaran & laba bersih tidak ditampilkan.
	f.c.json("GET", "/api/laporan?dari=2026-10-01&sampai=2026-10-17&saluran_id=1", nil, 200, &l)
	if l.Ringkasan.Omzet != 108000 || l.Ringkasan.LabaKotor != 35950 || l.Ringkasan.Pengeluaran != nil || l.Ringkasan.LabaBersih != nil {
		t.Fatalf("filter saluran: %+v", l.Ringkasan)
	}
	f.c.json("GET", "/api/laporan?dari=2026-10-01&sampai=2026-10-17&produk_id="+strconv.FormatInt(a, 10), nil, 200, &l)
	if l.Ringkasan.Omzet != 128000 || l.Ringkasan.Potongan != 9819 || l.Ringkasan.LabaKotor != 43181 || l.Ringkasan.Pesanan != 2 || len(l.PerSaluran) != 2 {
		t.Fatalf("filter model: %+v", l.Ringkasan)
	}
	// Bawaan = bulan ini s/d hari ini.
	f.c.json("GET", "/api/laporan", nil, 200, &l)
	if l.Dari != "2026-10-01" || l.Sampai != "2026-10-17" || l.Ringkasan.Omzet != 148000 {
		t.Fatalf("bawaan: %s %s %d", l.Dari, l.Sampai, l.Ringkasan.Omzet)
	}
	if code, _ := f.c.do("GET", "/api/laporan?dari=2026-10-10&sampai=2026-10-01", nil); code != 400 {
		t.Fatalf("rentang terbalik: %d", code)
	}
	// Stok menipis (§7 butir 13): batas 2.
	f.jual(map[string]any{"saluran_id": salPasar, "baris": []any{baris(a, 5, 40000)}}, 201)
	f.c.json("GET", "/api/laporan", nil, 200, &l)
	if len(l.Stok.Menipis) != 1 || l.Stok.Menipis[0].ProdukID != a {
		t.Fatalf("menipis: %+v", l.Stok.Menipis)
	}
	var list []produk
	f.c.json("GET", "/api/produk", nil, 200, &list)
	for _, p := range list {
		if p.ID == a && p.Terjual30Hari != 8 {
			t.Fatalf("terjual 30 hari = %d, mau 8", p.Terjual30Hari)
		}
	}
}

func (f *fixture) xlsx(path string) *excelize.File {
	f.t.Helper()
	req, err := f.c.hc.Get(f.c.base + path)
	if err != nil {
		f.t.Fatal(err)
	}
	defer req.Body.Close()
	b, _ := io.ReadAll(req.Body)
	if req.StatusCode != 200 || !strings.Contains(req.Header.Get("Content-Type"), "spreadsheetml") ||
		!strings.Contains(req.Header.Get("Content-Disposition"), "attachment") {
		f.t.Fatalf("%s: %d %s %s", path, req.StatusCode, req.Header.Get("Content-Type"), b)
	}
	x, err := excelize.OpenReader(bytes.NewReader(b))
	if err != nil {
		f.t.Fatalf("%s: bukan xlsx: %v", path, err)
	}
	f.t.Cleanup(func() { x.Close() })
	return x
}

// §7 butir 14: ekspor Excel produk, transaksi, laporan.
func TestEkspor_Butir14(t *testing.T) {
	f := newFixture(t)
	dataLaporan(f)
	cell := func(x *excelize.File, sh, c string) string {
		v, err := x.GetCellValue(sh, c)
		if err != nil {
			t.Fatal(err)
		}
		return v
	}

	x := f.xlsx("/api/ekspor/produk.xlsx")
	if s := x.GetSheetList(); len(s) != 2 || s[0] != "Produk" {
		t.Fatalf("sheet produk: %v", s)
	}
	if cell(x, "Produk", "A1") != "Nama model" || cell(x, "Produk", "A2") != "Bergo Jersey" || cell(x, "Produk", "C2") != "8" {
		t.Fatalf("isi produk: %s %s %s", cell(x, "Produk", "A1"), cell(x, "Produk", "A2"), cell(x, "Produk", "C2"))
	}

	x = f.xlsx("/api/ekspor/transaksi.xlsx?dari=2026-10-01&sampai=2026-10-17")
	if s := x.GetSheetList(); len(s) != 5 || s[0] != "Penjualan" || s[2] != "Pengeluaran" {
		t.Fatalf("sheet transaksi: %v", s)
	}
	rows, _ := x.GetRows("Penjualan")
	if len(rows) != 1+3 { // judul + 3 baris penjualan dalam periode
		t.Fatalf("baris penjualan = %d", len(rows))
	}
	if typ, _ := x.GetCellType("Penjualan", "F2"); typ == excelize.CellTypeSharedString || typ == excelize.CellTypeInlineString {
		t.Fatal("harga harus angka, bukan teks")
	}
	rows, _ = x.GetRows("Pengeluaran")
	if len(rows) != 1+2 {
		t.Fatalf("baris pengeluaran = %d", len(rows))
	}
	x = f.xlsx("/api/ekspor/transaksi.xlsx")
	if rows, _ := x.GetRows("Penjualan"); len(rows) != 1+4 {
		t.Fatalf("semua penjualan = %d", len(rows)-1)
	}

	x = f.xlsx("/api/ekspor/laporan.xlsx?dari=2026-10-01&sampai=2026-10-17")
	if s := x.GetSheetList(); len(s) != 5 || s[0] != "Ringkasan" {
		t.Fatalf("sheet laporan: %v", s)
	}
	rows, _ = x.GetRows("Ringkasan")
	got := map[string]string{}
	for _, r := range rows {
		if len(r) == 2 {
			got[r[0]] = r[1]
		}
	}
	if got["Laba bersih"] != "-19,050.00" || got["Omzet"] != "148,000.00" {
		t.Fatalf("ringkasan: %v", got)
	}
	if code, _ := f.c.do("GET", "/api/ekspor/laporan.xlsx?dari=x", nil); code != 400 {
		t.Fatalf("tanggal salah: %d", code)
	}
}
