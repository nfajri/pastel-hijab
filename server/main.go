// Command toko-hijab: server API + frontend Pastel Hijab (satu binary, SQLite).
//
//	toko-hijab serve                          jalankan server (bawaan bila tanpa argumen)
//	toko-hijab user create <username>         buat akun (password dibaca dari terminal/stdin)
//	toko-hijab user set-password <username>   reset password + cabut semua sesi
//	toko-hijab backup <file-tujuan.db>        salinan konsisten database (aman saat server jalan)
//	toko-hijab migrate                        terapkan migrasi skema lalu keluar
//
// Konfigurasi lewat env, lihat README.md.
package main

import (
	"bufio"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"golang.org/x/term"

	"tokohijab/server/internal/app"
	"tokohijab/server/internal/db"
)

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func envBool(key string, def bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		log.Fatalf("%s harus true/false, bukan %q", key, v)
	}
	return b
}

func openDB() *sql.DB {
	d, err := db.Open(env("DB_PATH", "data/toko-hijab.db"))
	if err != nil {
		log.Fatalf("buka database: %v", err)
	}
	return d
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	args := os.Args[1:]
	if len(args) == 0 {
		args = []string{"serve"}
	}
	switch args[0] {
	case "serve":
		serve()
	case "migrate":
		d := openDB()
		v, err := db.Version(d)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("skema versi %d\n", v)
	case "user":
		if len(args) != 3 || (args[1] != "create" && args[1] != "set-password") {
			usage()
		}
		d := openDB()
		pw, err := readPassword()
		if err != nil {
			log.Fatal(err)
		}
		if args[1] == "create" {
			err = app.CreateUser(d, args[2], pw, time.Now())
		} else {
			err = app.SetPassword(d, args[2], pw, time.Now())
		}
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("OK")
	case "backup":
		if len(args) != 2 {
			usage()
		}
		if err := db.Backup(openDB(), args[1]); err != nil {
			log.Fatalf("backup: %v", err)
		}
		fmt.Println("backup tersimpan di", args[1])
	default:
		usage()
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `pemakaian:
  toko-hijab [serve]
  toko-hijab user create <username>
  toko-hijab user set-password <username>
  toko-hijab backup <file-tujuan.db>
  toko-hijab migrate`)
	os.Exit(2)
}

// readPassword: dari terminal (tanpa gema, diketik 2×) atau satu baris dari stdin (untuk skrip).
func readPassword() (string, error) {
	fd := int(os.Stdin.Fd())
	if term.IsTerminal(fd) {
		fmt.Fprint(os.Stderr, "Password: ")
		p1, err := term.ReadPassword(fd)
		fmt.Fprintln(os.Stderr)
		if err != nil {
			return "", err
		}
		fmt.Fprint(os.Stderr, "Ulangi password: ")
		p2, err := term.ReadPassword(fd)
		fmt.Fprintln(os.Stderr)
		if err != nil {
			return "", err
		}
		if string(p1) != string(p2) {
			return "", errors.New("password tidak sama")
		}
		return string(p1), app.ValidasiPassword(string(p1))
	}
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && line == "" {
		return "", errors.New("password tidak terbaca dari stdin")
	}
	p := strings.TrimRight(line, "\r\n")
	return p, app.ValidasiPassword(p)
}

func serve() {
	d := openDB()
	defer d.Close()

	var n int
	if err := d.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		log.Fatal(err)
	}
	if n == 0 {
		log.Printf("PERINGATAN: belum ada akun. Buat dengan: toko-hijab user create <username>")
	}

	days, err := strconv.Atoi(env("SESSION_DAYS", "30"))
	if err != nil || days < 1 {
		log.Fatalf("SESSION_DAYS tidak valid")
	}
	cfg := app.Config{
		CookieSecure: envBool("COOKIE_SECURE", true),
		TrustProxy:   envBool("TRUST_PROXY", false),
		StaticDir:    env("STATIC_DIR", ""),
		SessionTTL:   time.Duration(days) * 24 * time.Hour,
	}
	if !cfg.CookieSecure {
		log.Printf("PERINGATAN: COOKIE_SECURE=false — hanya untuk pengembangan lokal")
	}
	if cfg.StaticDir != "" {
		if fi, err := os.Stat(cfg.StaticDir); err != nil || !fi.IsDir() {
			log.Fatalf("STATIC_DIR %q bukan folder", cfg.StaticDir)
		}
	}

	srv := &http.Server{
		Addr:              env("ADDR", "127.0.0.1:8080"),
		Handler:           app.New(d, cfg),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		sctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(sctx)
	}()
	log.Printf("toko-hijab mendengarkan di %s (static=%q, secure=%v, proxy=%v)", srv.Addr, cfg.StaticDir, cfg.CookieSecure, cfg.TrustProxy)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
