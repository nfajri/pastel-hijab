//go:build unix

package main

import "syscall"

// File yang dibuat proses ini (DB, -wal/-shm, backup) hanya bisa dibaca pemiliknya.
func init() { syscall.Umask(0o077) }
