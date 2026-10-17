package app

import (
	"bytes"
	"log"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"tokohijab/server/internal/db"
)

// T-0136 butir 1: hash pengganti harus se-mahal hash asli, kalau tidak waktu respons membocorkan username.
func TestDummyHash_CostSamaDenganAsli(t *testing.T) {
	defer func() { BcryptCost = bcrypt.MinCost }()
	for _, cost := range []int{bcrypt.MinCost, bcrypt.MinCost + 1} {
		BcryptCost = cost
		got, err := bcrypt.Cost(dummyHash())
		if err != nil || got != cost {
			t.Fatalf("cost dummy = %d (%v), mau %d", got, err, cost)
		}
	}
}

// T-0136 butir 3: tidak ada kunci global (bisa dipakai mengunci Ibu); kegagalan banyak IP cukup dicatat di log.
func TestRateLimit_TanpaKunciGlobal(t *testing.T) {
	BcryptCost = bcrypt.MinCost
	d, err := db.Open(filepath.Join(t.TempDir(), "g.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	c := newClock()
	CreateUser(d, testUser, testPass, c.Now())
	ts := httptest.NewTLSServer(New(d, Config{CookieSecure: true, TrustProxy: true, Now: c.Now}))
	defer ts.Close()

	var buf bytes.Buffer
	defer log.SetOutput(log.Writer())
	log.SetOutput(&buf)
	cl := &client{t: t, base: ts.URL, hc: newClient(ts)}
	for i := 0; i < 2*ambangPeringatan+5; i++ {
		ip := "203.0.113." + strconv.Itoa(i+1)
		if code, b := cl.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": "salah-salah"}, "X-Forwarded-For", ip); code != 401 {
			t.Fatalf("gagal ke-%d: %d %s", i+1, code, b)
		}
	}
	if code, b := cl.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": testPass}, "X-Forwarded-For", "198.51.100.7"); code != 200 {
		t.Fatalf("login benar dari IP baru: %d %s, mau 200", code, b)
	}
	out := buf.String()
	if n := strings.Count(out, "PERINGATAN"); n != 2 {
		t.Fatalf("baris PERINGATAN = %d, mau 2 (di gagal ke-20 & ke-40):\n%s", n, out)
	}
	if !strings.Contains(out, "20 login gagal dari 20 IP") {
		t.Fatalf("isi peringatan:\n%s", out)
	}
}

// T-0136 butir 4: ubah tanggal/supplier/catatan tetap bisa walau stok kulakan sebagian sudah keluar.
func TestKulakan_UbahKeteranganSaatStokSebagianKeluar(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	c.json("POST", "/api/komponen-modal", map[string]any{"nama": "Ongkir", "jenis": "per_kulakan", "nilai": 15000}, 201, nil)
	p := buatProduk(c, "Bergo Maryam", 0)
	in := map[string]any{"produk_id": p.ID, "qty": 10, "harga_beli": 200000, "supplier": "Tanah Abang"} // komponen bawaan
	var bm bmT
	c.json("POST", "/api/barang-masuk", in, 201, &bm)
	modal := ambilProduk(c, p.ID).Modal
	c.json("POST", "/api/penyesuaian-stok", map[string]any{"produk_id": p.ID, "selisih": -5, "alasan": "rusak"}, 201, nil)

	in["supplier"] = "Thamrin City"
	in["catatan"] = "nota menyusul"
	in["tanggal"] = "2026-10-01"
	var got struct {
		Supplier string `json:"supplier"`
		Catatan  string `json:"catatan"`
		Tanggal  string `json:"tanggal"`
		Komponen []any  `json:"komponen"`
	}
	c.json("PUT", "/api/barang-masuk/"+itoa(bm.ID), in, 200, &got)
	if got.Supplier != "Thamrin City" || got.Catatan != "nota menyusul" || got.Tanggal != "2026-10-01" || len(got.Komponen) != 1 || len(bm.Komponen) != 1 {
		t.Fatalf("hasil ubah = %+v", got)
	}
	if p2 := ambilProduk(c, p.ID); p2.Stok != 5 || p2.Modal != modal {
		t.Fatalf("stok/modal berubah: %d / %v, mau 5 / %v", p2.Stok, p2.Modal, modal)
	}
	// Validasi tetap jalan di jalur ini.
	in["tanggal"] = "kemarin"
	if code, _ := c.do("PUT", "/api/barang-masuk/"+itoa(bm.ID), in); code != 400 {
		t.Fatalf("tanggal salah: %d, mau 400", code)
	}
	in["tanggal"] = "2026-10-01"
	// Mengubah hitungan tetap ditolak bila stok kurang.
	for k, v := range map[string]any{"qty": 9, "harga_beli": 210000, "komponen": []any{}} {
		in2 := map[string]any{}
		for kk, vv := range in {
			in2[kk] = vv
		}
		in2[k] = v
		if code, b := c.do("PUT", "/api/barang-masuk/"+itoa(bm.ID), in2); code != 409 {
			t.Fatalf("ubah %s saat stok kurang: %d %s, mau 409", k, code, b)
		}
	}
}
