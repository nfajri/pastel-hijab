package app

import (
	"testing"
	"time"
)

// Uji T-0146: tanggal transaksi tidak boleh setelah hari ini (WIB).

const pesanTanggalDepan = "Tanggal tidak boleh lewat dari hari ini"

func TestTanggalTransaksi_BatasHariWIB(t *testing.T) {
	// 16:59:59 UTC = 23:59:59 WIB 17 Okt; 17:00 UTC = 00:00 WIB 18 Okt.
	sebelum := time.Date(2026, 10, 17, 16, 59, 59, 0, time.UTC)
	sesudah := time.Date(2026, 10, 17, 17, 0, 0, 0, time.UTC)
	cases := []struct {
		now  time.Time
		in   string
		want string // "" = ditolak
	}{
		{sebelum, "2026-10-17", "2026-10-17"},
		{sebelum, "2026-10-18", ""},
		{sebelum, "", "2026-10-17"},
		{sesudah, "2026-10-18", "2026-10-18"},
		{sesudah, "2026-10-19", ""},
		{sesudah, "", "2026-10-18"},
		{sesudah, "2025-01-31", "2025-01-31"}, // input susulan
	}
	for _, c := range cases {
		got, err := tanggalTransaksi(c.in, c.now)
		if c.want == "" {
			if err == nil || err.Error() != pesanTanggalDepan {
				t.Errorf("%s @%s: mau ditolak, dapat %q %v", c.in, c.now, got, err)
			}
			continue
		}
		if err != nil || got != c.want {
			t.Errorf("%s @%s: mau %s, dapat %q %v", c.in, c.now, c.want, got, err)
		}
	}
	if _, err := tanggalTransaksi("17-10-2026", sebelum); err == nil || err.Error() == pesanTanggalDepan {
		t.Errorf("format salah harus pesan format: %v", err)
	}
}

func TestTanggalDepan_SemuaTransaksi(t *testing.T) {
	e := newEnv(t, "")
	f := &fixture{t: t, c: e.login(t)}
	// Jam uji 10:00 UTC = 17:00 WIB 17 Okt 2026.
	besok, hariIni, lampau := "2026-10-18", "2026-10-17", "2026-09-30"
	a := f.produk("Pashmina Ceruty", 10, 20000)

	tolak := func(nama, method, path string, body map[string]any) {
		t.Helper()
		code, b := f.c.do(method, path, body)
		if code != 400 || errMsg(b) != pesanTanggalDepan {
			t.Fatalf("%s: mau 400 %q, dapat %d %s", nama, pesanTanggalDepan, code, b)
		}
	}

	// Barang masuk: POST, dan PUT yang hanya mengubah tanggal.
	km := map[string]any{"produk_id": a, "qty": 2, "harga_beli": 20000, "komponen": []any{}}
	km["tanggal"] = besok
	tolak("barang masuk POST", "POST", "/api/barang-masuk", km)
	var bm barangMasuk
	km["tanggal"] = lampau
	f.c.json("POST", "/api/barang-masuk", km, 201, &bm)
	km["tanggal"] = besok
	tolak("barang masuk PUT", "PUT", "/api/barang-masuk/"+itoa(bm.ID), km)

	// Penyesuaian stok.
	tolak("penyesuaian", "POST", "/api/penyesuaian-stok", map[string]any{"produk_id": a, "selisih": -1, "alasan": "rusak", "tanggal": besok})
	f.c.json("POST", "/api/penyesuaian-stok", map[string]any{"produk_id": a, "selisih": -1, "alasan": "rusak", "tanggal": lampau}, 201, nil)

	// Penjualan: POST dan PUT.
	tolak("penjualan POST", "POST", "/api/penjualan", map[string]any{"saluran_id": salShopee, "tanggal": besok, "baris": []any{baris(a, 1, 40000)}})
	j, _ := f.jual(map[string]any{"saluran_id": salShopee, "tanggal": hariIni, "baris": []any{baris(a, 1, 40000)}}, 201)
	tolak("penjualan PUT", "PUT", "/api/penjualan/"+itoa(j.ID), map[string]any{"saluran_id": salShopee, "tanggal": besok, "baris": []any{baris(a, 1, 40000)}})

	// Pengeluaran: POST dan PUT.
	var kat []kategoriPengeluaran
	f.c.json("GET", "/api/kategori-pengeluaran", nil, 200, &kat)
	pg := map[string]any{"kategori_id": kat[0].ID, "jumlah": 50000, "tanggal": besok}
	tolak("pengeluaran POST", "POST", "/api/pengeluaran", pg)
	var p pengeluaran
	pg["tanggal"] = lampau
	f.c.json("POST", "/api/pengeluaran", pg, 201, &p)
	pg["tanggal"] = besok
	tolak("pengeluaran PUT", "PUT", "/api/pengeluaran/"+itoa(p.ID), pg)

	// Lewat tengah malam WIB, "besok" tadi sudah jadi hari ini → diterima.
	e.clock.Add(7 * time.Hour) // 17:00 UTC = 00:00 WIB 18 Okt
	f.c.json("POST", "/api/pengeluaran", pg, 201, nil)
}
