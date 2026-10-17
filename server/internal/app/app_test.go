package app

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"tokohijab/server/internal/db"
)

const (
	testUser = "ibu"
	testPass = "rahasia-ibu-123"
)

type clock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *clock) Now() time.Time           { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *clock) Add(d time.Duration)      { c.mu.Lock(); c.t = c.t.Add(d); c.mu.Unlock() }
func newClock() *clock                    { return &clock{t: time.Date(2026, 10, 17, 10, 0, 0, 0, time.UTC)} }
func (e *env) client() *http.Client       { return newClient(e.ts) }
func (e *env) url(p string) string        { return e.ts.URL + p }
func (e *env) login(t *testing.T) *client { return e.loginAs(t, testPass) }

type env struct {
	ts    *httptest.Server
	clock *clock
	dir   string
}

// newEnv: server TLS (cookie Secure + __Host- seperti produksi), DB sementara, satu akun.
func newEnv(t *testing.T, static string) *env {
	t.Helper()
	BcryptCost = bcrypt.MinCost
	dir := t.TempDir()
	d, err := db.Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	c := newClock()
	if err := CreateUser(d, testUser, testPass, c.Now()); err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewTLSServer(New(d, Config{CookieSecure: true, StaticDir: static, Now: c.Now}))
	t.Cleanup(ts.Close)
	return &env{ts: ts, clock: c, dir: dir}
}

type client struct {
	t    *testing.T
	base string
	hc   *http.Client
}

func newClient(ts *httptest.Server) *http.Client {
	hc := *ts.Client() // salinan: tiap klien (HP/laptop) punya cookie jar sendiri
	jar, _ := cookiejar.New(nil)
	hc.Jar = jar
	return &hc
}

func (e *env) loginAs(t *testing.T, pass string) *client {
	t.Helper()
	c := &client{t: t, base: e.ts.URL, hc: e.client()}
	code, body := c.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": pass})
	if code != 200 {
		t.Fatalf("login: %d %s", code, body)
	}
	return c
}

func (c *client) do(method, path string, body any, hdr ...string) (int, []byte) {
	c.t.Helper()
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, c.base+path, rd)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	res, err := c.hc.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res.StatusCode, b
}

// json melakukan request dan mewajibkan kode tertentu, lalu decode hasilnya ke out (boleh nil).
func (c *client) json(method, path string, body any, want int, out any) {
	c.t.Helper()
	code, b := c.do(method, path, body)
	if code != want {
		c.t.Fatalf("%s %s: kode %d, mau %d: %s", method, path, code, want, b)
	}
	if out != nil {
		if err := json.Unmarshal(b, out); err != nil {
			c.t.Fatalf("%s %s: decode: %v (%s)", method, path, err, b)
		}
	}
}

func errMsg(b []byte) string {
	var e struct{ Error string }
	json.Unmarshal(b, &e)
	return e.Error
}

// --- auth ---

// Semua endpoint API (kecuali login) wajib sesi → 401 tanpa cookie, termasuk path tak dikenal & method salah.
func TestAPI_TanpaSesi401(t *testing.T) {
	e := newEnv(t, "")
	anon := &client{t: t, base: e.ts.URL, hc: e.client()}
	cases := [][2]string{
		{"GET", "/api/auth/saya"}, {"POST", "/api/auth/logout"}, {"POST", "/api/auth/logout-semua"},
		{"POST", "/api/auth/ganti-password"}, {"GET", "/api/pengaturan"}, {"PATCH", "/api/pengaturan"},
		{"GET", "/api/komponen-modal"}, {"POST", "/api/komponen-modal"}, {"PATCH", "/api/komponen-modal/1"}, {"DELETE", "/api/komponen-modal/1"},
		{"GET", "/api/saluran"}, {"POST", "/api/saluran"}, {"GET", "/api/saluran/1"}, {"PATCH", "/api/saluran/1"},
		{"POST", "/api/saluran/1/potongan"}, {"PATCH", "/api/potongan/1"}, {"DELETE", "/api/potongan/1"},
		{"GET", "/api/produk"}, {"POST", "/api/produk"}, {"GET", "/api/produk/1"}, {"PATCH", "/api/produk/1"}, {"DELETE", "/api/produk/1"},
		{"PUT", "/api/produk/1/harga/1"}, {"DELETE", "/api/produk/1/harga/1"},
		{"GET", "/api/barang-masuk"}, {"POST", "/api/barang-masuk"}, {"GET", "/api/barang-masuk/1"}, {"PUT", "/api/barang-masuk/1"}, {"DELETE", "/api/barang-masuk/1"},
		{"GET", "/api/penyesuaian-stok"}, {"POST", "/api/penyesuaian-stok"}, {"DELETE", "/api/penyesuaian-stok/1"},
		{"GET", "/api/tidak-ada"}, {"DELETE", "/api/produk"}, {"GET", "/api"},
	}
	for _, c := range cases {
		code, b := anon.do(c[0], c[1], map[string]any{})
		if code != 401 {
			t.Errorf("%s %s tanpa sesi: %d %s, mau 401", c[0], c[1], code, b)
		}
	}
	// Cookie palsu juga ditolak.
	code, _ := anon.do("GET", "/api/produk", nil, "Cookie", "__Host-sesi=palsu")
	if code != 401 {
		t.Errorf("cookie palsu: %d", code)
	}
}

func TestLogin_CookieDanLogout(t *testing.T) {
	e := newEnv(t, "")
	anon := &client{t: t, base: e.ts.URL, hc: e.client()}
	code, b := anon.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": "salah-salah"})
	if code != 401 || !strings.Contains(errMsg(b), "salah") {
		t.Fatalf("password salah: %d %s", code, b)
	}
	code, _ = anon.do("POST", "/api/auth/login", map[string]string{"username": "orang-lain", "password": testPass})
	if code != 401 {
		t.Fatalf("username salah: %d", code)
	}

	// Atribut cookie.
	req, _ := http.NewRequest("POST", e.url("/api/auth/login"), strings.NewReader(`{"username":"IBU","password":"`+testPass+`"}`))
	req.Header.Set("Content-Type", "application/json")
	res, err := e.ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	sc := res.Header.Get("Set-Cookie")
	for _, want := range []string{"__Host-sesi=", "Path=/", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=2592000"} {
		if !strings.Contains(sc, want) {
			t.Errorf("Set-Cookie %q tidak memuat %q", sc, want)
		}
	}

	c := e.login(t)
	var saya struct {
		Username string `json:"username"`
	}
	c.json("GET", "/api/auth/saya", nil, 200, &saya)
	if saya.Username != testUser {
		t.Fatalf("saya = %+v", saya)
	}
	c.json("POST", "/api/auth/logout", nil, 204, nil)
	c.json("GET", "/api/auth/saya", nil, 401, nil)
}

func TestLogin_RateLimit(t *testing.T) {
	e := newEnv(t, "")
	c := &client{t: t, base: e.ts.URL, hc: e.client()}
	for i := 0; i < 5; i++ {
		code, _ := c.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": "salah-salah"})
		if code != 401 {
			t.Fatalf("percobaan %d: %d", i+1, code)
		}
		e.clock.Add(time.Second)
	}
	// Percobaan ke-6, walau password benar, ditolak.
	code, b := c.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": testPass})
	if code != 429 || !strings.Contains(errMsg(b), "15 menit") {
		t.Fatalf("ke-6: %d %s, mau 429", code, b)
	}
	e.clock.Add(14 * time.Minute)
	if code, _ := c.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": testPass}); code != 429 {
		t.Fatalf("setelah 14 menit masih harus terkunci: %d", code)
	}
	e.clock.Add(time.Minute)
	if code, b := c.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": testPass}); code != 200 {
		t.Fatalf("setelah 15 menit: %d %s", code, b)
	}
	// Login sukses mereset hitungan.
	for i := 0; i < 4; i++ {
		c.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": "salah-salah"})
	}
	if code, _ := c.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": testPass}); code != 200 {
		t.Fatalf("4 gagal belum boleh terkunci: %d", code)
	}
}

func TestGantiPassword_DanLogoutSemua(t *testing.T) {
	e := newEnv(t, "")
	hp := e.login(t)
	laptop := e.login(t)

	code, b := hp.do("POST", "/api/auth/ganti-password", map[string]string{"password_lama": "keliru-keliru", "password_baru": "baru-12345678"})
	if code != 403 {
		t.Fatalf("password lama salah: %d %s", code, b)
	}
	code, b = hp.do("POST", "/api/auth/ganti-password", map[string]string{"password_lama": testPass, "password_baru": "pendek"})
	if code != 400 {
		t.Fatalf("password baru pendek: %d %s", code, b)
	}
	hp.json("POST", "/api/auth/ganti-password", map[string]string{"password_lama": testPass, "password_baru": "baru-12345678"}, 204, nil)
	hp.json("GET", "/api/auth/saya", nil, 200, nil)     // sesi sendiri tetap
	laptop.json("GET", "/api/auth/saya", nil, 401, nil) // sesi lain dicabut

	anon := &client{t: t, base: e.ts.URL, hc: e.client()}
	if code, _ := anon.do("POST", "/api/auth/login", map[string]string{"username": testUser, "password": testPass}); code != 401 {
		t.Fatalf("password lama masih bisa login: %d", code)
	}
	laptop = e.loginAs(t, "baru-12345678")

	hp.json("POST", "/api/auth/logout-semua", nil, 204, nil)
	hp.json("GET", "/api/auth/saya", nil, 401, nil)
	laptop.json("GET", "/api/auth/saya", nil, 401, nil)
}

func TestSesi_Kedaluwarsa(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	e.clock.Add(29 * 24 * time.Hour)
	c.json("GET", "/api/auth/saya", nil, 200, nil) // dipakai → diperpanjang 30 hari lagi
	e.clock.Add(29 * 24 * time.Hour)
	c.json("GET", "/api/auth/saya", nil, 200, nil)
	e.clock.Add(31 * 24 * time.Hour) // tidak dipakai > 30 hari
	c.json("GET", "/api/auth/saya", nil, 401, nil)
}

func TestCSRF_LintasSitusDitolak(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	body := map[string]any{"nama": "X"}
	if code, _ := c.do("POST", "/api/produk", body, "Origin", "https://evil.example"); code != 403 {
		t.Fatalf("Origin asing: %d", code)
	}
	if code, _ := c.do("POST", "/api/produk", body, "Sec-Fetch-Site", "cross-site"); code != 403 {
		t.Fatalf("Sec-Fetch-Site cross-site: %d", code)
	}
	if code, _ := c.do("POST", "/api/produk", body, "Origin", e.ts.URL, "Sec-Fetch-Site", "same-origin"); code != 201 {
		t.Fatalf("Origin sendiri: %d", code)
	}
	// Body bukan JSON (form lintas situs) ditolak.
	req, _ := http.NewRequest("POST", e.url("/api/produk"), strings.NewReader("nama=X"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, _ := c.hc.Do(req)
	res.Body.Close()
	if res.StatusCode != 415 {
		t.Fatalf("form: %d", res.StatusCode)
	}
}

// --- modul ---

type produkT struct {
	ID      int64   `json:"id"`
	Stok    int64   `json:"stok"`
	Modal   float64 `json:"modal"`
	Menipis bool    `json:"menipis"`
	Harga   []struct {
		SaluranID int64 `json:"saluran_id"`
		Harga     int64 `json:"harga"`
	} `json:"harga"`
}

type bmT struct {
	ID       int64   `json:"id"`
	ModalPcs float64 `json:"modal_pcs"`
	Komponen []struct {
		Nama   string  `json:"nama"`
		PerPcs float64 `json:"per_pcs"`
	} `json:"komponen"`
}

func buatProduk(c *client, nama string, batas int64) produkT {
	var p produkT
	c.json("POST", "/api/produk", map[string]any{"nama": nama, "batas_stok_menipis": batas}, 201, &p)
	return p
}

func ambilProduk(c *client, id int64) produkT {
	var p produkT
	c.json("GET", "/api/produk/"+itoa(id), nil, 200, &p)
	return p
}

func itoa(i int64) string { return strconv.FormatInt(i, 10) }

// §7 butir 2 & 3: komponen 3 jenis; komponen nonaktif tidak ikut kulakan baru; modal/pcs Rp24.400.
func TestKulakan_Butir2dan3(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	for _, k := range []map[string]any{
		{"nama": "Plastik", "jenis": "per_pcs", "nilai": 1000},
		{"nama": "Ongkir kulakan", "jenis": "per_kulakan", "nilai": 30000},
		{"nama": "Fee", "jenis": "persen_harga_beli", "nilai": 2},
	} {
		c.json("POST", "/api/komponen-modal", k, 201, nil)
	}
	var hangtag struct{ ID int64 }
	c.json("POST", "/api/komponen-modal", map[string]any{"nama": "Hangtag", "jenis": "per_pcs", "nilai": 500}, 201, &hangtag)
	c.json("PATCH", "/api/komponen-modal/"+itoa(hangtag.ID), map[string]any{"aktif": false}, 200, nil)
	if code, _ := c.do("POST", "/api/komponen-modal", map[string]any{"nama": "X", "jenis": "per_lusin", "nilai": 1}); code != 400 {
		t.Fatalf("jenis tak dikenal harus 400, dapat %d", code)
	}

	var aktif []struct{ Nama string }
	c.json("GET", "/api/komponen-modal?aktif=1", nil, 200, &aktif)
	if len(aktif) != 3 {
		t.Fatalf("komponen aktif = %d, mau 3 (Hangtag nonaktif)", len(aktif))
	}

	p := buatProduk(c, "Pashmina Ceruty", 3)
	var bm bmT
	c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": p.ID, "qty": 10, "harga_beli": 20000, "supplier": "Tanah Abang"}, 201, &bm)
	if bm.ModalPcs != 24400 {
		t.Fatalf("modal/pcs kulakan = %v, mau 24400", bm.ModalPcs)
	}
	if len(bm.Komponen) != 3 {
		t.Fatalf("komponen tersimpan = %d, mau 3", len(bm.Komponen))
	}
	p = ambilProduk(c, p.ID)
	if p.Stok != 10 || p.Modal != 24400 {
		t.Fatalf("produk = %+v, mau stok 10 modal 24400", p)
	}

	// Mengubah/menghapus komponen tidak mengubah modal kulakan yang sudah tercatat (§5.2).
	c.json("PATCH", "/api/komponen-modal/1", map[string]any{"nilai": 5000}, 200, nil)
	c.json("DELETE", "/api/komponen-modal/2", nil, 204, nil)
	var lagi bmT
	c.json("GET", "/api/barang-masuk/"+itoa(bm.ID), nil, 200, &lagi)
	if lagi.ModalPcs != 24400 || len(lagi.Komponen) != 3 {
		t.Fatalf("kulakan lama berubah: %+v", lagi)
	}
}

// §7 butir 4: stok 10 @20.000 + kulakan 10 @30.000 → 25.000; batal kulakan → kembali 20.000.
func TestKulakan_Butir4_RataRataDanBatal(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	p := buatProduk(c, "Segi Empat Voal", 0)
	c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": p.ID, "qty": 10, "harga_beli": 20000, "komponen": []any{}}, 201, nil)
	var bm2 bmT
	c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": p.ID, "qty": 10, "harga_beli": 30000, "komponen": []any{}}, 201, &bm2)
	p = ambilProduk(c, p.ID)
	if p.Stok != 20 || p.Modal != 25000 {
		t.Fatalf("produk = stok %d modal %v, mau 20 / 25000", p.Stok, p.Modal)
	}

	// Ubah kulakan ke-2 jadi harga 40.000 → (10×20.000 + 10×40.000)/20 = 30.000.
	c.json("PUT", "/api/barang-masuk/"+itoa(bm2.ID), map[string]any{"produk_id": p.ID, "qty": 10, "harga_beli": 40000, "komponen": []any{}}, 200, nil)
	if p = ambilProduk(c, p.ID); p.Stok != 20 || p.Modal != 30000 {
		t.Fatalf("setelah ubah: stok %d modal %v, mau 20 / 30000", p.Stok, p.Modal)
	}

	c.json("DELETE", "/api/barang-masuk/"+itoa(bm2.ID), nil, 204, nil)
	if p = ambilProduk(c, p.ID); p.Stok != 10 || p.Modal != 20000 {
		t.Fatalf("setelah hapus: stok %d modal %v, mau 10 / 20000", p.Stok, p.Modal)
	}

	// Kulakan yang sebagian stoknya sudah keluar tidak bisa dihapus.
	var bm3 bmT
	c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": p.ID, "qty": 5, "harga_beli": 20000, "komponen": []any{}}, 201, &bm3)
	c.json("POST", "/api/penyesuaian-stok", map[string]any{"produk_id": p.ID, "stok_fisik": 3, "alasan": "hitung fisik"}, 201, nil)
	code, b := c.do("DELETE", "/api/barang-masuk/"+itoa(bm3.ID), nil)
	if code != 409 {
		t.Fatalf("hapus kulakan saat stok kurang: %d %s", code, b)
	}
	if p = ambilProduk(c, p.ID); p.Stok != 3 {
		t.Fatalf("stok berubah setelah penolakan: %d", p.Stok)
	}
}

// §7 butir 11 (bagian backend yang sudah ada): kulakan baru yang menaikkan modal produk
// tidak mengubah modal yang tersimpan di kulakan lama. Uji penuh untung penjualan lama
// menyusul di task penjualan (HPP disimpan per baris penjualan).
func TestKulakan_Butir11_ModalLamaTetap(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	p := buatProduk(c, "Bergo", 0)
	var bm1 bmT
	c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": p.ID, "qty": 4, "harga_beli": 20000, "komponen": []any{}}, 201, &bm1)
	c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": p.ID, "qty": 4, "harga_beli": 40000, "komponen": []any{}}, 201, nil)
	var lama bmT
	c.json("GET", "/api/barang-masuk/"+itoa(bm1.ID), nil, 200, &lama)
	if lama.ModalPcs != 20000 {
		t.Fatalf("modal kulakan lama = %v, mau 20000", lama.ModalPcs)
	}
	if p = ambilProduk(c, p.ID); p.Modal != 30000 {
		t.Fatalf("modal produk = %v, mau 30000", p.Modal)
	}
}

// §7 butir 13: stok ≤ batas → menipis.
func TestProduk_Butir13_StokMenipis(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	a := buatProduk(c, "A Tipis", 3)
	b := buatProduk(c, "B Aman", 3)
	c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": a.ID, "qty": 3, "harga_beli": 10000, "komponen": []any{}}, 201, nil)
	c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": b.ID, "qty": 4, "harga_beli": 10000, "komponen": []any{}}, 201, nil)
	var list []struct {
		Nama    string `json:"nama"`
		Menipis bool   `json:"menipis"`
	}
	c.json("GET", "/api/produk?menipis=1", nil, 200, &list)
	if len(list) != 1 || list[0].Nama != "A Tipis" || !list[0].Menipis {
		t.Fatalf("stok menipis = %+v, mau hanya A Tipis", list)
	}
	c.json("PATCH", "/api/produk/"+itoa(b.ID), map[string]any{"batas_stok_menipis": 4}, 200, nil)
	c.json("GET", "/api/produk?menipis=1", nil, 200, &list)
	if len(list) != 2 {
		t.Fatalf("setelah batas B=4: %+v", list)
	}
	// Stok & modal tidak bisa diubah langsung.
	if code, _ := c.do("PATCH", "/api/produk/"+itoa(a.ID), map[string]any{"stok": 100}); code != 400 {
		t.Fatalf("PATCH stok harus 400, dapat %d", code)
	}
	// Produk ber-riwayat tidak bisa dihapus.
	if code, _ := c.do("DELETE", "/api/produk/"+itoa(a.ID), nil); code != 409 {
		t.Fatalf("hapus produk ber-riwayat: %d", code)
	}
}

func TestPenyesuaianStok(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	p := buatProduk(c, "Khimar", 0)
	c.json("POST", "/api/barang-masuk", map[string]any{"produk_id": p.ID, "qty": 3, "harga_beli": 50000, "komponen": []any{}}, 201, nil)

	code, b := c.do("POST", "/api/penyesuaian-stok", map[string]any{"produk_id": p.ID, "selisih": -4, "alasan": "rusak"})
	if code != 409 || !strings.Contains(errMsg(b), "Stok tersisa 3") {
		t.Fatalf("kurangi melebihi stok: %d %s", code, b)
	}
	var adj struct {
		ID      int64 `json:"id"`
		Selisih int64 `json:"selisih"`
	}
	c.json("POST", "/api/penyesuaian-stok", map[string]any{"produk_id": p.ID, "stok_fisik": 1, "alasan": "hitung fisik"}, 201, &adj)
	if adj.Selisih != -2 {
		t.Fatalf("selisih = %d, mau -2", adj.Selisih)
	}
	if p = ambilProduk(c, p.ID); p.Stok != 1 || p.Modal != 50000 {
		t.Fatalf("setelah penyesuaian: %+v (modal tidak boleh berubah)", p)
	}
	if code, _ := c.do("POST", "/api/penyesuaian-stok", map[string]any{"produk_id": p.ID, "alasan": "x"}); code != 400 {
		t.Fatalf("tanpa selisih/stok_fisik: %d", code)
	}
	c.json("DELETE", "/api/penyesuaian-stok/"+itoa(adj.ID), nil, 204, nil)
	if p = ambilProduk(c, p.ID); p.Stok != 3 {
		t.Fatalf("setelah batal: stok %d, mau 3", p.Stok)
	}
}

func TestSaluran_PotonganDanHarga(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	var list []struct {
		ID   int64  `json:"id"`
		Nama string `json:"nama"`
	}
	c.json("GET", "/api/saluran", nil, 200, &list)
	if len(list) != 4 || list[0].Nama != "Shopee" || list[3].Nama != "Pasar Minggu" {
		t.Fatalf("saluran awal = %+v", list)
	}
	shopee := list[0].ID
	if code, _ := c.do("POST", "/api/saluran", map[string]any{"nama": "shopee"}); code != 409 {
		t.Fatalf("nama ganda: %d", code)
	}

	type potT struct {
		ID     int64   `json:"id"`
		Jenis  string  `json:"jenis"`
		Nilai  float64 `json:"nilai"`
		MaksRp *int64  `json:"maks_rp"`
	}
	var adm potT
	c.json("POST", "/api/saluran/"+itoa(shopee)+"/potongan", map[string]any{"nama": "Admin", "jenis": "persen", "nilai": 10, "maks_rp": 10000}, 201, &adm)
	if adm.MaksRp == nil || *adm.MaksRp != 10000 {
		t.Fatalf("maks_rp = %v", adm.MaksRp)
	}
	c.json("POST", "/api/saluran/"+itoa(shopee)+"/potongan", map[string]any{"nama": "Proses pesanan", "jenis": "per_pesanan", "nilai": 1250}, 201, nil)
	if code, _ := c.do("POST", "/api/saluran/"+itoa(shopee)+"/potongan", map[string]any{"nama": "X", "jenis": "per_pcs", "nilai": 1, "maks_rp": 5}); code != 400 {
		t.Fatalf("maks_rp di per_pcs harus 400, dapat %d", code)
	}
	if code, _ := c.do("POST", "/api/saluran/"+itoa(shopee)+"/potongan", map[string]any{"nama": "X", "jenis": "persen", "nilai": 101}); code != 400 {
		t.Fatalf("persen > 100 harus 400, dapat %d", code)
	}
	// Hapus batas maks dengan null; ganti jenis → batas ikut hilang.
	c.json("PATCH", "/api/potongan/"+itoa(adm.ID), map[string]any{"maks_rp": nil}, 200, &adm)
	if adm.MaksRp != nil {
		t.Fatalf("maks_rp harus null")
	}
	c.json("PATCH", "/api/potongan/"+itoa(adm.ID), map[string]any{"maks_rp": 8000}, 200, nil)
	c.json("PATCH", "/api/potongan/"+itoa(adm.ID), map[string]any{"jenis": "per_pcs", "nilai": 500}, 200, &adm)
	if adm.MaksRp != nil || adm.Jenis != "per_pcs" {
		t.Fatalf("ganti jenis: %+v", adm)
	}

	var sal struct {
		Potongan []potT `json:"potongan"`
	}
	c.json("GET", "/api/saluran/"+itoa(shopee), nil, 200, &sal)
	if len(sal.Potongan) != 2 {
		t.Fatalf("potongan shopee = %d", len(sal.Potongan))
	}
	c.json("PATCH", "/api/saluran/"+itoa(list[2].ID), map[string]any{"aktif": false}, 200, nil)
	c.json("GET", "/api/saluran?aktif=1", nil, 200, &list)
	if len(list) != 3 {
		t.Fatalf("saluran aktif = %d, mau 3", len(list))
	}

	// Harga jual per saluran ("Pakai harga ini").
	p := buatProduk(c, "Pashmina", 0)
	c.json("PUT", "/api/produk/"+itoa(p.ID)+"/harga/"+itoa(shopee), map[string]any{"harga": 44000}, 200, &p)
	if len(p.Harga) != 1 || p.Harga[0].Harga != 44000 || p.Harga[0].SaluranID != shopee {
		t.Fatalf("harga = %+v", p.Harga)
	}
	c.json("PUT", "/api/produk/"+itoa(p.ID)+"/harga/"+itoa(shopee), map[string]any{"harga": 45000}, 200, &p)
	if p.Harga[0].Harga != 45000 {
		t.Fatalf("harga update = %+v", p.Harga)
	}
	if code, _ := c.do("PUT", "/api/produk/"+itoa(p.ID)+"/harga/999", map[string]any{"harga": 1}); code != 404 {
		t.Fatalf("saluran tak ada: %d", code)
	}
}

func TestPengaturan_Pembulatan(t *testing.T) {
	e := newEnv(t, "")
	c := e.login(t)
	var p map[string]string
	c.json("GET", "/api/pengaturan", nil, 200, &p)
	if p["pembulatan_bawaan"] != "1000" {
		t.Fatalf("bawaan = %q", p["pembulatan_bawaan"])
	}
	c.json("PATCH", "/api/pengaturan", map[string]any{"pembulatan_bawaan": "cantik"}, 200, &p)
	if p["pembulatan_bawaan"] != "cantik" {
		t.Fatalf("setelah ubah = %q", p["pembulatan_bawaan"])
	}
	if code, _ := c.do("PATCH", "/api/pengaturan", map[string]any{"pembulatan_bawaan": "250"}); code != 400 {
		t.Fatalf("nilai tak dikenal: %d", code)
	}
}

func TestStatic_SPAdanCache(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html><div id=root></div>"), 0o644)
	os.WriteFile(filepath.Join(dir, "assets", "index-abc123.js"), []byte("console.log(1)"), 0o644)
	os.WriteFile(filepath.Join(dir, "manifest.webmanifest"), []byte("{}"), 0o644)
	os.WriteFile(filepath.Join(dir, ".env"), []byte("rahasia"), 0o644)
	e := newEnv(t, dir)
	hc := e.ts.Client()
	get := func(p string) *http.Response {
		res, err := hc.Get(e.url(p))
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res
	}
	cases := []struct {
		path, cache string
		code        int
	}{
		{"/", "no-cache", 200},
		{"/index.html", "no-cache", 200},
		{"/produk", "no-cache", 200}, // fallback ke index.html
		{"/assets/index-abc123.js", "public, max-age=31536000, immutable", 200},
		{"/manifest.webmanifest", "no-cache", 200},
		{"/assets/hilang.js", "", 404},
		{"/.env", "", 404},
	}
	for _, tc := range cases {
		res := get(tc.path)
		if res.StatusCode != tc.code {
			t.Errorf("%s: kode %d, mau %d", tc.path, res.StatusCode, tc.code)
		}
		if tc.cache != "" && res.Header.Get("Cache-Control") != tc.cache {
			t.Errorf("%s: Cache-Control %q, mau %q", tc.path, res.Header.Get("Cache-Control"), tc.cache)
		}
	}
	if csp := get("/").Header.Get("Content-Security-Policy"); !strings.Contains(csp, "frame-ancestors 'none'") {
		t.Errorf("CSP index.html = %q", csp)
	}
	if ct := get("/manifest.webmanifest").Header.Get("Content-Type"); ct != "application/manifest+json" {
		t.Errorf("manifest Content-Type = %q", ct)
	}
	// /api tidak pernah jatuh ke frontend.
	if res := get("/api/produk"); res.StatusCode != 401 {
		t.Errorf("/api/produk tanpa sesi = %d", res.StatusCode)
	}
}

func TestMigrasi_Idempoten(t *testing.T) {
	p := filepath.Join(t.TempDir(), "m.db")
	for i := 0; i < 2; i++ {
		d, err := db.Open(p)
		if err != nil {
			t.Fatalf("buka ke-%d: %v", i+1, err)
		}
		v, _ := db.Version(d)
		if v != 1 {
			t.Fatalf("versi = %d", v)
		}
		var n int
		d.QueryRow(`SELECT COUNT(*) FROM saluran`).Scan(&n)
		if n != 4 {
			t.Fatalf("saluran = %d setelah buka ke-%d", n, i+1)
		}
		d.Close()
	}
}

func TestBackup(t *testing.T) {
	dir := t.TempDir()
	d, err := db.Open(filepath.Join(dir, "a.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	CreateUser(d, "ibu", testPass, time.Now())
	dest := filepath.Join(dir, "b.db")
	if err := db.Backup(d, dest); err != nil {
		t.Fatal(err)
	}
	if err := db.Backup(d, dest); err == nil {
		t.Fatal("backup menimpa file yang ada")
	}
	d2, err := db.Open(dest)
	if err != nil {
		t.Fatal(err)
	}
	defer d2.Close()
	var n int
	d2.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	if n != 1 {
		t.Fatalf("users di backup = %d", n)
	}
}

func TestCLI_UserDanPassword(t *testing.T) {
	d, err := db.Open(filepath.Join(t.TempDir(), "u.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	BcryptCost = bcrypt.MinCost
	if err := CreateUser(d, "ibu", "pendek", time.Now()); err == nil {
		t.Fatal("password pendek diterima")
	}
	if err := CreateUser(d, "ibu", testPass, time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := CreateUser(d, "IBU", testPass, time.Now()); err == nil {
		t.Fatal("username ganda (beda huruf besar) diterima")
	}
	var hash string
	d.QueryRow(`SELECT password_hash FROM users`).Scan(&hash)
	if strings.Contains(hash, testPass) || !strings.HasPrefix(hash, "$2") {
		t.Fatalf("password tidak di-hash bcrypt: %q", hash)
	}
	if err := SetPassword(d, "tidak-ada", testPass, time.Now()); err == nil {
		t.Fatal("set-password user tak ada")
	}
}
