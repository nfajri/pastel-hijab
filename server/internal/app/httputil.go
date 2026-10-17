package app

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

// Format waktu tetap (panjang sama) supaya perbandingan teks di SQLite = perbandingan waktu.
const timeFmt = "2006-01-02T15:04:05.000Z"

// WIB untuk tanggal bawaan transaksi.
var wib = time.FixedZone("WIB", 7*3600)

func fmtTime(t time.Time) string { return t.UTC().Format(timeFmt) }

// httpError adalah error yang pesannya aman ditampilkan ke pengguna.
type httpError struct {
	code  int
	msg   string
	extra map[string]any // field tambahan di body error (mis. stok_kurang per produk)
}

func (e *httpError) Error() string { return e.msg }

func errf(code int, format string, a ...any) error {
	return &httpError{code: code, msg: fmt.Sprintf(format, a...)}
}

func bad(format string, a ...any) error      { return errf(http.StatusBadRequest, format, a...) }
func notFound(what string) error             { return errf(http.StatusNotFound, "%s tidak ditemukan", what) }
func conflict(format string, a ...any) error { return errf(http.StatusConflict, format, a...) }

// handler mengembalikan error; httpError → kode & pesannya, selain itu → 500 (detail hanya di log).
type handler func(w http.ResponseWriter, r *http.Request) error

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	err := h(w, r)
	if err == nil {
		return
	}
	var he *httpError
	if errors.As(err, &he) {
		body := map[string]any{"error": he.msg}
		for k, v := range he.extra {
			body[k] = v
		}
		writeJSON(w, he.code, body)
		return
	}
	log.Printf("ERROR %s %s: %v", r.Method, r.URL.Path, err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan di server"})
}

func writeJSON(w http.ResponseWriter, code int, v any) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	if v == nil {
		return nil
	}
	return json.NewEncoder(w).Encode(v)
}

func noContent(w http.ResponseWriter) error {
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
	return nil
}

const maxBody = 1 << 20

// readJSON membaca body JSON tepat satu objek; field tak dikenal ditolak supaya salah ketik ketahuan.
func readJSON(w http.ResponseWriter, r *http.Request, v any) error {
	mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if mt != "application/json" {
		return errf(http.StatusUnsupportedMediaType, "Content-Type harus application/json")
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil {
		return errf(http.StatusRequestEntityTooLarge, "data terlalu besar")
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return bad("JSON tidak valid: %s", jsonErrMsg(err))
	}
	if dec.More() {
		return bad("JSON tidak valid: lebih dari satu objek")
	}
	return nil
}

func jsonErrMsg(err error) string {
	var te *json.UnmarshalTypeError
	if errors.As(err, &te) {
		return fmt.Sprintf("field %q harus bertipe %s", te.Field, te.Type)
	}
	return err.Error()
}

// Opt membedakan field PATCH yang tidak dikirim, dikirim null, dan dikirim bernilai.
type Opt[T any] struct {
	Set  bool
	Null bool
	V    T
}

func (o *Opt[T]) UnmarshalJSON(b []byte) error {
	o.Set = true
	if string(b) == "null" {
		o.Null = true
		return nil
	}
	return json.Unmarshal(b, &o.V)
}

func pathID(r *http.Request, name string) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil || id <= 0 {
		return 0, bad("id tidak valid")
	}
	return id, nil
}

func queryID(r *http.Request, name string) (int64, error) {
	s := r.URL.Query().Get(name)
	if s == "" {
		return 0, nil
	}
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id <= 0 {
		return 0, bad("%s tidak valid", name)
	}
	return id, nil
}

func queryBool(r *http.Request, name string) bool {
	switch r.URL.Query().Get(name) {
	case "1", "true", "ya":
		return true
	}
	return false
}

// Validasi umum.

func teks(field, s string, wajib bool, max int) (string, error) {
	s = strings.TrimSpace(s)
	if wajib && s == "" {
		return "", bad("%s wajib diisi", field)
	}
	if utf8.RuneCountInString(s) > max {
		return "", bad("%s maksimal %d karakter", field, max)
	}
	return s, nil
}

func angka(field string, v float64, max float64) error {
	if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 {
		return bad("%s tidak boleh negatif", field)
	}
	if v > max {
		return bad("%s maksimal %v", field, max)
	}
	return nil
}

// Batas atas rupiah agar perkalian tidak meluap (Rp1 triliun).
const maxRp = 1_000_000_000_000

func rupiah(field string, v int64) error {
	if v < 0 {
		return bad("%s tidak boleh negatif", field)
	}
	if v > maxRp {
		return bad("%s terlalu besar", field)
	}
	return nil
}

// tanggal menerima YYYY-MM-DD; kosong = hari ini (WIB).
func tanggal(s string, now time.Time) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return now.In(wib).Format(time.DateOnly), nil
	}
	t, err := time.Parse(time.DateOnly, s)
	if err != nil || t.Year() < 2000 || t.Year() > 2100 {
		return "", bad("tanggal harus berformat YYYY-MM-DD")
	}
	return s, nil
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}
