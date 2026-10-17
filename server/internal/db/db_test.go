package db

import (
	"os"
	"path/filepath"
	"testing"
)

func izin(t *testing.T, p string) os.FileMode {
	t.Helper()
	st, err := os.Stat(p)
	if err != nil {
		t.Fatal(err)
	}
	return st.Mode().Perm()
}

// T-0136 butir 2: DB berisi hash password & data usaha → hanya pemilik yang boleh membaca (0600),
// termasuk -wal/-shm, file lama yang terlanjur 0644, dan hasil backup.
func TestIzinFile0600(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "pastel.db")
	d, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := d.Exec(`CREATE TABLE x (a)`); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{path, path + "-wal", path + "-shm"} {
		if m := izin(t, p); m != 0o600 {
			t.Errorf("%s = %o, mau 600", filepath.Base(p), m)
		}
	}
	dest := filepath.Join(dir, "cadangan.db")
	if err := Backup(d, dest); err != nil {
		t.Fatal(err)
	}
	if m := izin(t, dest); m != 0o600 {
		t.Errorf("backup = %o, mau 600", m)
	}
	if err := Backup(d, dest); err == nil {
		t.Error("backup menimpa file yang ada")
	}
	d.Close()

	// Instalasi lama (file 0644) dirapikan saat dibuka.
	for _, p := range []string{path, dest} {
		os.Chmod(p, 0o644)
	}
	d, err = Open(dest)
	if err != nil {
		t.Fatal(err)
	}
	d.Close()
	if m := izin(t, dest); m != 0o600 {
		t.Errorf("file lama setelah dibuka = %o, mau 600", m)
	}
}
