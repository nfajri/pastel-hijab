package app

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"io/fs"
	"net/http"
	"path"
	"strings"
	"sync"
)

// Penyaji build frontend (SPA, hash router). Aturan cache untuk PWA:
//   - index.html, manifest, service worker → no-cache (selalu cek versi baru)
//   - assets/* (nama ber-hash dari Vite) → 1 tahun, immutable
//   - lainnya (ikon dll.) → 1 hari
type static struct {
	fsys  fs.FS
	etags sync.Map // nama → ETag, untuk file embed (tanpa waktu modifikasi)
}

func newStatic(fsys fs.FS) http.Handler { return &static{fsys: fsys} }

// etag dari isi file; dipakai bila ModTime nol (embed) supaya revalidasi no-cache tetap murah (304).
func (st *static) etag(name string, rs io.ReadSeeker) string {
	if v, ok := st.etags.Load(name); ok {
		return v.(string)
	}
	h := sha256.New()
	if _, err := io.Copy(h, rs); err != nil {
		return ""
	}
	if _, err := rs.Seek(0, io.SeekStart); err != nil {
		return ""
	}
	tag := `"` + hex.EncodeToString(h.Sum(nil)[:12]) + `"`
	st.etags.Store(name, tag)
	return tag
}

const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
	"font-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; " +
	"object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

func cacheControl(name string) string {
	base := path.Base(name)
	switch {
	case name == "index.html", strings.HasSuffix(base, ".webmanifest"),
		base == "sw.js", base == "service-worker.js", base == "registerSW.js":
		return "no-cache"
	case strings.HasPrefix(name, "assets/"):
		return "public, max-age=31536000, immutable"
	}
	return "public, max-age=86400"
}

func (st *static) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
	if name == "" {
		name = "index.html"
	}
	if !fs.ValidPath(name) || strings.HasPrefix(path.Base(name), ".") {
		http.NotFound(w, r)
		return
	}
	fi, err := fs.Stat(st.fsys, name)
	if err != nil || fi.IsDir() {
		// Hash router: semua route ada di "#/...". Path tanpa ekstensi diarahkan ke index.html
		// supaya tautan/refresh yang salah tetap membuka aplikasi; file yang hilang tetap 404.
		if path.Ext(name) != "" {
			http.NotFound(w, r)
			return
		}
		name = "index.html"
		if fi, err = fs.Stat(st.fsys, name); err != nil {
			http.NotFound(w, r)
			return
		}
	}
	f, err := st.fsys.Open(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", cacheControl(name))
	if fi.ModTime().IsZero() {
		if tag := st.etag(name, rs); tag != "" {
			w.Header().Set("ETag", tag)
		}
	}
	if path.Ext(name) == ".html" {
		w.Header().Set("Content-Security-Policy", csp)
	}
	if path.Ext(name) == ".webmanifest" {
		w.Header().Set("Content-Type", "application/manifest+json")
	}
	http.ServeContent(w, r, name, fi.ModTime(), rs)
}
