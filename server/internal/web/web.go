// Package web menyimpan build frontend yang di-embed ke binary.
// Isi dist/ disalin oleh build.sh dari hasil `npm run build` (tidak di-commit).
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var dist embed.FS

// FS mengembalikan isi build frontend; ok=false bila binary dibuild tanpa frontend.
func FS() (fsys fs.FS, ok bool) {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		return nil, false
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return sub, false
	}
	return sub, true
}
