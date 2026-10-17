package app

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"log"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

// BcryptCost: 11 ≈ 0,2–0,4 dtk per login di VPS kecil. Test menurunkannya.
var BcryptCost = 11

const (
	maxGagalPerIP    = 5  // 5 gagal dari satu IP → tunggu
	ambangPeringatan = 20 // gagal dari semua IP dalam jendela → tulis PERINGATAN di log (tidak mengunci, lihat README)
	jendelaGagal     = 15 * time.Minute
	minPasswordLen   = 8
	maxPasswordByte  = 72 // batas bcrypt
)

var ErrPassword = errors.New("password minimal 8 karakter dan maksimal 72 byte")

// ValidasiPassword dipakai API & CLI.
func ValidasiPassword(p string) error {
	if utf8.RuneCountInString(p) < minPasswordLen || len(p) > maxPasswordByte {
		return ErrPassword
	}
	return nil
}

func HashPassword(p string) (string, error) {
	if err := ValidasiPassword(p); err != nil {
		return "", err
	}
	h, err := bcrypt.GenerateFromPassword([]byte(p), BcryptCost)
	return string(h), err
}

// dummyHash: hash pengganti saat username tidak ada, supaya waktu respons sama (tidak membocorkan username).
// Cost harus sama dengan hash asli; dibuat saat pertama dipakai (dan dibuat ulang bila BcryptCost diubah test).
var dummy struct {
	sync.Mutex
	cost int
	hash []byte
}

func dummyHash() []byte {
	dummy.Lock()
	defer dummy.Unlock()
	if dummy.hash == nil || dummy.cost != BcryptCost {
		dummy.hash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password-x"), BcryptCost)
		dummy.cost = BcryptCost
	}
	return dummy.hash
}

// CreateUser dipakai perintah CLI `user create`.
func CreateUser(db *sql.DB, username, password string, now time.Time) error {
	username = strings.TrimSpace(username)
	if username == "" || utf8.RuneCountInString(username) > 50 {
		return errors.New("username wajib diisi (maks. 50 karakter)")
	}
	h, err := HashPassword(password)
	if err != nil {
		return err
	}
	t := fmtTime(now)
	_, err = db.Exec(`INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)`, username, h, t, t)
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return errors.New("username sudah ada; pakai `user set-password` untuk mengganti password")
	}
	return err
}

// SetPassword dipakai perintah CLI `user set-password` (reset lupa password); semua sesi dicabut.
func SetPassword(db *sql.DB, username, password string, now time.Time) error {
	h, err := HashPassword(password)
	if err != nil {
		return err
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id int64
	if err := tx.QueryRow(`SELECT id FROM users WHERE username = ?`, strings.TrimSpace(username)).Scan(&id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("username tidak ditemukan")
		}
		return err
	}
	if _, err := tx.Exec(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, h, fmtTime(now), id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM sessions WHERE user_id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

// --- sesi ---

type ctxKey struct{}

type session struct {
	userID int64
	id     int64
}

func withSession(ctx context.Context, s session) context.Context {
	return context.WithValue(ctx, ctxKey{}, s)
}

func sessionFrom(r *http.Request) session {
	s, _ := r.Context().Value(ctxKey{}).(session)
	return s
}

func hashToken(tok string) string {
	h := sha256.Sum256([]byte(tok))
	return hex.EncodeToString(h[:])
}

// Prefix __Host- memaksa Secure + Path=/ + tanpa Domain; hanya bisa dipakai saat Secure.
func (s *Server) cookieName() string {
	if s.cfg.CookieSecure {
		return "__Host-sesi"
	}
	return "sesi"
}

func (s *Server) setCookie(w http.ResponseWriter, token string, maxAge time.Duration) {
	c := &http.Cookie{
		Name:     s.cookieName(),
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteStrictMode,
	}
	if maxAge > 0 {
		c.MaxAge = int(maxAge.Seconds())
	} else {
		c.MaxAge = -1
	}
	http.SetCookie(w, c)
}

func (s *Server) newSession(tx *sql.Tx, w http.ResponseWriter, r *http.Request, userID int64) error {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return err
	}
	tok := base64.RawURLEncoding.EncodeToString(b)
	now := s.cfg.Now()
	ua := r.UserAgent()
	if len(ua) > 200 {
		ua = ua[:200]
	}
	_, err := tx.Exec(`INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)`,
		hashToken(tok), userID, fmtTime(now), fmtTime(now), fmtTime(now.Add(s.cfg.SessionTTL)), ua)
	if err != nil {
		return err
	}
	s.setCookie(w, tok, s.cfg.SessionTTL)
	return nil
}

var errUnauthorized = errf(http.StatusUnauthorized, "Silakan login dulu")

// authenticate memeriksa cookie sesi. Sesi diperpanjang (sliding) paling sering sekali per jam.
func (s *Server) authenticate(w http.ResponseWriter, r *http.Request) (session, error) {
	c, err := r.Cookie(s.cookieName())
	if err != nil || c.Value == "" || len(c.Value) > 100 {
		return session{}, errUnauthorized
	}
	var (
		sess              session
		lastSeen, expires string
	)
	err = s.db.QueryRow(`SELECT id, user_id, last_seen_at, expires_at FROM sessions WHERE token_hash = ?`, hashToken(c.Value)).
		Scan(&sess.id, &sess.userID, &lastSeen, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		s.setCookie(w, "", 0)
		return session{}, errUnauthorized
	}
	if err != nil {
		return session{}, err
	}
	now := s.cfg.Now()
	nowS := fmtTime(now)
	if expires <= nowS {
		s.db.Exec(`DELETE FROM sessions WHERE id = ?`, sess.id)
		s.setCookie(w, "", 0)
		return session{}, errUnauthorized
	}
	if lastSeen <= fmtTime(now.Add(-time.Hour)) {
		if _, err := s.db.Exec(`UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?`, nowS, fmtTime(now.Add(s.cfg.SessionTTL)), sess.id); err != nil {
			return session{}, err
		}
		s.setCookie(w, c.Value, s.cfg.SessionTTL)
	}
	return sess, nil
}

// --- rate limit login ---

func (s *Server) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	// X-Forwarded-For hanya dipercaya dari proxy lokal. Proxy menambahkan IP klien sebagai
	// entri terakhir; entri sebelumnya bisa dipalsukan klien.
	if ip := net.ParseIP(host); s.cfg.TrustProxy && ip != nil && ip.IsLoopback() {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if v := strings.TrimSpace(parts[len(parts)-1]); v != "" {
				return v
			}
		}
	}
	return host
}

// lockedUntil: bila ada ≥ batas kegagalan dalam jendela, kunci berlaku sampai kegagalan ke-batas (dari terbaru) + jendela.
func lockedUntil(q interface {
	QueryRow(string, ...any) *sql.Row
}, where string, arg []any, batas int, now time.Time) (time.Time, error) {
	var at string
	args := append(append([]any{}, arg...), fmtTime(now.Add(-jendelaGagal)), batas-1)
	err := q.QueryRow(`SELECT at FROM login_failures WHERE `+where+` at > ? ORDER BY at DESC LIMIT 1 OFFSET ?`, args...).Scan(&at)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, err
	}
	t, err := time.Parse(timeFmt, at)
	if err != nil {
		return time.Time{}, err
	}
	return t.Add(jendelaGagal), nil
}

func (s *Server) checkLock(ip string) error {
	now := s.cfg.Now()
	until, err := lockedUntil(s.db, "ip = ? AND", []any{ip}, maxGagalPerIP, now)
	if err != nil {
		return err
	}
	if !until.After(now) {
		return nil
	}
	detik := int(math.Ceil(until.Sub(now).Seconds()))
	menit := (detik + 59) / 60
	return &rateLimitError{detik: detik, msg: "Terlalu banyak percobaan gagal. Coba lagi dalam " + strconv.Itoa(menit) + " menit."}
}

type rateLimitError struct {
	detik int
	msg   string
}

func (e *rateLimitError) Error() string { return e.msg }

func (s *Server) recordFailure(ip, username string) error {
	now := s.cfg.Now()
	if len(username) > 100 {
		username = username[:100]
	}
	if _, err := s.db.Exec(`INSERT INTO login_failures (ip, username, at) VALUES (?, ?, ?)`, ip, username, fmtTime(now)); err != nil {
		return err
	}
	// Kunci global sengaja tidak dipakai: penyerang bisa memakainya untuk mengunci Ibu. Cukup dicatat.
	var n, nIP int
	if err := s.db.QueryRow(`SELECT COUNT(*), COUNT(DISTINCT ip) FROM login_failures WHERE at > ?`, fmtTime(now.Add(-jendelaGagal))).Scan(&n, &nIP); err != nil {
		return err
	}
	if n%ambangPeringatan == 0 {
		log.Printf("PERINGATAN: %d login gagal dari %d IP dalam 15 menit terakhir (terakhir: ip=%s username=%q)", n, nIP, ip, username)
	}
	_, err := s.db.Exec(`DELETE FROM login_failures WHERE at < ?`, fmtTime(now.Add(-24*time.Hour)))
	return err
}

func writeRateLimit(w http.ResponseWriter, e *rateLimitError) error {
	w.Header().Set("Retry-After", strconv.Itoa(e.detik))
	return writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": e.msg, "retry_after_detik": e.detik})
}

// --- handler ---

func (s *Server) login(w http.ResponseWriter, r *http.Request) error {
	ip := s.clientIP(r)
	if err := s.checkLock(ip); err != nil {
		var rl *rateLimitError
		if errors.As(err, &rl) {
			return writeRateLimit(w, rl)
		}
		return err
	}
	var in struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	var (
		id   int64
		hash string
	)
	err := s.db.QueryRow(`SELECT id, password_hash FROM users WHERE username = ?`, strings.TrimSpace(in.Username)).Scan(&id, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		hash = string(dummyHash())
		id = 0
	} else if err != nil {
		return err
	}
	okPass := len(in.Password) <= maxPasswordByte && bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) == nil
	if id == 0 || !okPass {
		if err := s.recordFailure(ip, in.Username); err != nil {
			return err
		}
		return errf(http.StatusUnauthorized, "Username atau password salah")
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM login_failures WHERE ip = ?`, ip); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM sessions WHERE expires_at <= ?`, fmtTime(s.cfg.Now())); err != nil {
		return err
	}
	if err := s.newSession(tx, w, r, id); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]string{"username": strings.TrimSpace(in.Username)})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) error {
	if _, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, sessionFrom(r).id); err != nil {
		return err
	}
	s.setCookie(w, "", 0)
	return noContent(w)
}

func (s *Server) logoutSemua(w http.ResponseWriter, r *http.Request) error {
	if _, err := s.db.Exec(`DELETE FROM sessions WHERE user_id = ?`, sessionFrom(r).userID); err != nil {
		return err
	}
	s.setCookie(w, "", 0)
	return noContent(w)
}

// gantiPassword: password lama salah dihitung sebagai kegagalan login (rate limit sama).
// Berhasil → semua sesi lain dicabut, sesi ini tetap.
func (s *Server) gantiPassword(w http.ResponseWriter, r *http.Request) error {
	ip := s.clientIP(r)
	if err := s.checkLock(ip); err != nil {
		var rl *rateLimitError
		if errors.As(err, &rl) {
			return writeRateLimit(w, rl)
		}
		return err
	}
	var in struct {
		PasswordLama string `json:"password_lama"`
		PasswordBaru string `json:"password_baru"`
	}
	if err := readJSON(w, r, &in); err != nil {
		return err
	}
	sess := sessionFrom(r)
	var username, hash string
	if err := s.db.QueryRow(`SELECT username, password_hash FROM users WHERE id = ?`, sess.userID).Scan(&username, &hash); err != nil {
		return err
	}
	if len(in.PasswordLama) > maxPasswordByte || bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.PasswordLama)) != nil {
		if err := s.recordFailure(ip, username); err != nil {
			return err
		}
		return errf(http.StatusForbidden, "Password lama salah")
	}
	newHash, err := HashPassword(in.PasswordBaru)
	if err != nil {
		return bad("%s", err.Error())
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, newHash, fmtTime(s.cfg.Now()), sess.userID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM sessions WHERE user_id = ? AND id <> ?`, sess.userID, sess.id); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return noContent(w)
}

func (s *Server) saya(w http.ResponseWriter, r *http.Request) error {
	sess := sessionFrom(r)
	var username, expires string
	err := s.db.QueryRow(`SELECT u.username, s.expires_at FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.id = ?`, sess.id).Scan(&username, &expires)
	if err != nil {
		return err
	}
	var n int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM sessions WHERE user_id = ? AND expires_at > ?`, sess.userID, fmtTime(s.cfg.Now())).Scan(&n); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"username": username, "sesi_kedaluwarsa": expires, "jumlah_sesi_aktif": n})
}
