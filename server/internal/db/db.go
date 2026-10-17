// Package db membuka SQLite (modernc.org/sqlite, tanpa CGO) dan menjalankan migrasi berversi.
package db

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Open membuka (atau membuat) file database dan menerapkan migrasi yang belum jalan.
// Satu koneksi saja: pengguna tunggal, dan ini menghindari SQLITE_BUSY antar-koneksi.
func Open(path string) (*sql.DB, error) {
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return nil, err
		}
	}
	q := url.Values{}
	q.Add("_pragma", "foreign_keys(1)")
	q.Add("_pragma", "journal_mode(WAL)")
	q.Add("_pragma", "busy_timeout(5000)")
	q.Add("_pragma", "synchronous(NORMAL)")
	q.Add("_txlock", "immediate")
	d, err := sql.Open("sqlite", "file:"+path+"?"+q.Encode())
	if err != nil {
		return nil, err
	}
	d.SetMaxOpenConns(1)
	if err := d.Ping(); err != nil {
		d.Close()
		return nil, err
	}
	if err := Migrate(d); err != nil {
		d.Close()
		return nil, err
	}
	return d, nil
}

// Migrate menjalankan file migrations/NNNN_*.sql yang versinya belum tercatat, masing-masing dalam satu transaksi.
func Migrate(d *sql.DB) error {
	if _, err := d.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`); err != nil {
		return err
	}
	files, err := fs.Glob(migrations, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(files)
	for _, f := range files {
		base := filepath.Base(f)
		v, err := strconv.Atoi(strings.SplitN(base, "_", 2)[0])
		if err != nil {
			return fmt.Errorf("nama migrasi %s: %w", base, err)
		}
		var n int
		if err := d.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, v).Scan(&n); err != nil {
			return err
		}
		if n > 0 {
			continue
		}
		body, err := migrations.ReadFile(f)
		if err != nil {
			return err
		}
		tx, err := d.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(string(body)); err != nil {
			tx.Rollback()
			return fmt.Errorf("migrasi %s: %w", base, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`, v, time.Now().UTC().Format(time.RFC3339)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// Version mengembalikan versi migrasi tertinggi yang sudah diterapkan.
func Version(d *sql.DB) (int, error) {
	var v sql.NullInt64
	err := d.QueryRow(`SELECT MAX(version) FROM schema_migrations`).Scan(&v)
	return int(v.Int64), err
}

// Backup menyalin database ke file baru secara konsisten (VACUUM INTO), aman saat server jalan.
func Backup(d *sql.DB, dest string) error {
	if _, err := os.Stat(dest); err == nil {
		return fmt.Errorf("%s sudah ada", dest)
	}
	_, err := d.Exec(`VACUUM INTO ?`, dest)
	return err
}
