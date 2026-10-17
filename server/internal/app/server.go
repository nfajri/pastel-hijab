// Package app berisi HTTP API (auth + modul) dan penyaji frontend statis.
package app

import (
	"database/sql"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Config struct {
	// CookieSecure: cookie sesi hanya lewat HTTPS (wajib true di produksi).
	CookieSecure bool
	// TrustProxy: IP klien diambil dari X-Forwarded-For (pakai bila di belakang Caddy).
	TrustProxy bool
	// StaticDir: folder build frontend (dist/). Kosong = tidak menyajikan frontend.
	StaticDir string
	// SessionTTL: sesi kedaluwarsa bila tidak dipakai selama ini (bawaan 30 hari).
	SessionTTL time.Duration
	// Now bisa diganti di test.
	Now func() time.Time
}

type Server struct {
	db     *sql.DB
	cfg    Config
	api    *http.ServeMux
	static http.Handler
}

func New(db *sql.DB, cfg Config) *Server {
	if cfg.SessionTTL == 0 {
		cfg.SessionTTL = 30 * 24 * time.Hour
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	s := &Server{db: db, cfg: cfg, api: http.NewServeMux()}
	s.routes()
	if cfg.StaticDir != "" {
		s.static = newStatic(cfg.StaticDir)
	}
	return s
}

func (s *Server) routes() {
	m := s.api
	m.Handle("POST /api/auth/login", handler(s.login))
	m.Handle("POST /api/auth/logout", handler(s.logout))
	m.Handle("POST /api/auth/logout-semua", handler(s.logoutSemua))
	m.Handle("POST /api/auth/ganti-password", handler(s.gantiPassword))
	m.Handle("GET /api/auth/saya", handler(s.saya))

	m.Handle("GET /api/pengaturan", handler(s.getPengaturan))
	m.Handle("PATCH /api/pengaturan", handler(s.patchPengaturan))

	m.Handle("GET /api/komponen-modal", handler(s.listKomponen))
	m.Handle("POST /api/komponen-modal", handler(s.createKomponen))
	m.Handle("PATCH /api/komponen-modal/{id}", handler(s.patchKomponen))
	m.Handle("DELETE /api/komponen-modal/{id}", handler(s.deleteKomponen))

	m.Handle("GET /api/saluran", handler(s.listSaluran))
	m.Handle("POST /api/saluran", handler(s.createSaluran))
	m.Handle("GET /api/saluran/{id}", handler(s.getSaluran))
	m.Handle("PATCH /api/saluran/{id}", handler(s.patchSaluran))
	m.Handle("POST /api/saluran/{id}/potongan", handler(s.createPotongan))
	m.Handle("PATCH /api/potongan/{id}", handler(s.patchPotongan))
	m.Handle("DELETE /api/potongan/{id}", handler(s.deletePotongan))

	m.Handle("GET /api/produk", handler(s.listProduk))
	m.Handle("POST /api/produk", handler(s.createProduk))
	m.Handle("GET /api/produk/{id}", handler(s.getProduk))
	m.Handle("PATCH /api/produk/{id}", handler(s.patchProduk))
	m.Handle("DELETE /api/produk/{id}", handler(s.deleteProduk))
	m.Handle("PUT /api/produk/{id}/harga/{saluran}", handler(s.putHarga))
	m.Handle("DELETE /api/produk/{id}/harga/{saluran}", handler(s.deleteHarga))

	m.Handle("GET /api/barang-masuk", handler(s.listBarangMasuk))
	m.Handle("POST /api/barang-masuk", handler(s.createBarangMasuk))
	m.Handle("GET /api/barang-masuk/{id}", handler(s.getBarangMasuk))
	m.Handle("PUT /api/barang-masuk/{id}", handler(s.updateBarangMasuk))
	m.Handle("DELETE /api/barang-masuk/{id}", handler(s.deleteBarangMasuk))

	m.Handle("GET /api/penyesuaian-stok", handler(s.listPenyesuaian))
	m.Handle("POST /api/penyesuaian-stok", handler(s.createPenyesuaian))
	m.Handle("DELETE /api/penyesuaian-stok/{id}", handler(s.deletePenyesuaian))

	m.Handle("/api/", handler(func(w http.ResponseWriter, r *http.Request) error {
		return errf(http.StatusNotFound, "endpoint tidak ditemukan")
	}))
}

// Endpoint yang boleh diakses tanpa sesi. Hanya login.
func publicAPI(r *http.Request) bool {
	return r.URL.Path == "/api/auth/login"
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "same-origin")
	h.Set("X-Frame-Options", "DENY")

	if r.URL.Path == "/api" || strings.HasPrefix(r.URL.Path, "/api/") {
		s.serveAPI(w, r)
		return
	}
	if s.static == nil {
		http.NotFound(w, r)
		return
	}
	s.static.ServeHTTP(w, r)
}

func (s *Server) serveAPI(w http.ResponseWriter, r *http.Request) {
	if !safeMethod(r.Method) && !sameOrigin(r) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "permintaan lintas situs ditolak"})
		return
	}
	if !publicAPI(r) {
		uid, err := s.authenticate(w, r)
		if err != nil {
			handler(func(http.ResponseWriter, *http.Request) error { return err }).ServeHTTP(w, r)
			return
		}
		r = r.WithContext(withSession(r.Context(), uid))
	}
	s.api.ServeHTTP(w, r)
}

func safeMethod(m string) bool {
	return m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions
}

// sameOrigin: lapis CSRF di samping SameSite=Strict. Browser modern selalu mengirim
// Sec-Fetch-Site dan/atau Origin pada POST/PUT/PATCH/DELETE; klien non-browser (curl) tanpa keduanya diizinkan.
func sameOrigin(r *http.Request) bool {
	switch r.Header.Get("Sec-Fetch-Site") {
	case "cross-site", "same-site":
		return false
	}
	o := r.Header.Get("Origin")
	if o == "" {
		return true
	}
	u, err := url.Parse(o)
	return err == nil && u.Host == r.Host
}
