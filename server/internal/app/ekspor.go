package app

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

// Ekspor Excel (§5.1, §7 butir 14): produk, transaksi, laporan. Angka ditulis sebagai angka (bisa dihitung di Excel).

type kolom struct {
	judul string
	fmt   string // "" teks/angka biasa, "rp" rupiah, "des" 2 desimal, "persen"
	lebar float64
}

type lembar struct {
	nama  string
	kolom []kolom
	baris [][]any
}

func tulisXLSX(w http.ResponseWriter, nama string, sheets []lembar) error {
	f := excelize.NewFile()
	defer f.Close()
	gaya := map[string]int{}
	for k, nf := range map[string]string{"rp": "#,##0", "des": "#,##0.00", "persen": "0.00"} {
		id, err := f.NewStyle(&excelize.Style{CustomNumFmt: &nf})
		if err != nil {
			return err
		}
		gaya[k] = id
	}
	tebal, err := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}, Fill: excelize.Fill{Type: "pattern", Color: []string{"F6E7EC"}, Pattern: 1}})
	if err != nil {
		return err
	}
	for i, sh := range sheets {
		if i == 0 {
			if err := f.SetSheetName("Sheet1", sh.nama); err != nil {
				return err
			}
		} else if _, err := f.NewSheet(sh.nama); err != nil {
			return err
		}
		head := make([]any, len(sh.kolom))
		for c, k := range sh.kolom {
			head[c] = k.judul
			col, _ := excelize.ColumnNumberToName(c + 1)
			lebar := k.lebar
			if lebar == 0 {
				lebar = 14
			}
			if err := f.SetColWidth(sh.nama, col, col, lebar); err != nil {
				return err
			}
			if id, ok := gaya[k.fmt]; ok {
				if err := f.SetColStyle(sh.nama, col, id); err != nil {
					return err
				}
			}
		}
		if err := f.SetSheetRow(sh.nama, "A1", &head); err != nil {
			return err
		}
		last, _ := excelize.ColumnNumberToName(len(sh.kolom))
		if err := f.SetCellStyle(sh.nama, "A1", last+"1", tebal); err != nil {
			return err
		}
		for r, row := range sh.baris {
			if err := f.SetSheetRow(sh.nama, "A"+strconv.Itoa(r+2), &row); err != nil {
				return err
			}
		}
		if err := f.SetPanes(sh.nama, &excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"}); err != nil {
			return err
		}
	}
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return err
	}
	h := w.Header()
	h.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	h.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, nama))
	h.Set("Cache-Control", "no-store")
	h.Set("Content-Length", strconv.Itoa(buf.Len()))
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(buf.Bytes())
	return err
}

func yaTidak(b bool) string {
	if b {
		return "Ya"
	}
	return "Tidak"
}

var labelTarget = map[string]string{"persen_jual": "% dari harga jual", "persen_modal": "% dari modal", "rupiah": "Rp tetap"}

// GET /api/ekspor/produk.xlsx
func (s *Server) eksporProduk(w http.ResponseWriter, r *http.Request) error {
	list, err := loadProduk(s.db, "")
	if err != nil {
		return err
	}
	sal, err := s.loadSaluran("")
	if err != nil {
		return err
	}
	kol := []kolom{{"Nama model", "", 28}, {"Kategori", "", 16}, {"Stok", "", 8}, {"Modal/pcs", "des", 12}, {"Nilai stok", "des", 14},
		{"Batas stok menipis", "", 10}, {"Menipis", "", 9}, {"Aktif", "", 8}}
	for _, c := range sal {
		kol = append(kol, kolom{"Harga " + c.Nama, "rp", 14}, kolom{"Untung " + c.Nama, "des", 14})
	}
	rows := make([][]any, 0, len(list))
	for _, p := range list {
		row := []any{p.Nama, p.Kategori, p.Stok, p.Modal, float64(p.Stok) * p.Modal, p.BatasStokMenipis, yaTidak(p.Menipis), yaTidak(p.Aktif)}
		harga := map[int64]hargaSaluran{}
		for _, h := range p.Harga {
			harga[h.SaluranID] = h
		}
		for _, c := range sal {
			if h, ok := harga[c.ID]; ok {
				row = append(row, h.Harga, h.Untung)
			} else {
				row = append(row, nil, nil)
			}
		}
		rows = append(rows, row)
	}
	// Target harga per saluran (cara & nilai yang dipakai "Pakai harga ini").
	trows := [][]any{}
	salNama := map[int64]string{}
	for _, c := range sal {
		salNama[c.ID] = c.Nama
	}
	for _, p := range list {
		for _, h := range p.Harga {
			cara, nilai := "", any(nil)
			if h.TargetCara != nil {
				cara, nilai = labelTarget[*h.TargetCara], *h.TargetNilai
			}
			trows = append(trows, []any{p.Nama, salNama[h.SaluranID], h.Harga, h.Untung, cara, nilai, yaTidak(h.DiBawahTarget)})
		}
	}
	return tulisXLSX(w, "produk-pastel-hijab.xlsx", []lembar{
		{"Produk", kol, rows},
		{"Harga per saluran", []kolom{{"Nama model", "", 28}, {"Saluran", "", 14}, {"Harga", "rp", 12}, {"Untung/pcs", "des", 12},
			{"Target", "", 18}, {"Nilai target", "des", 12}, {"Di bawah target", "", 10}}, trows},
	})
}

// rentangEkspor: dari/sampai opsional (kosong = semua).
func (s *Server) rentangEkspor(r *http.Request) (string, []any, string, error) {
	var conds []string
	var args []any
	conds, args, err := s.filterTanggal(r, "tanggal", conds, args)
	if err != nil {
		return "", nil, "", err
	}
	akhiran := ""
	if d, sp := r.URL.Query().Get("dari"), r.URL.Query().Get("sampai"); d != "" || sp != "" {
		akhiran = "-" + strings.Trim(d+"_"+sp, "_")
	}
	if len(conds) == 0 {
		return "", nil, akhiran, nil
	}
	return strings.Join(conds, " AND "), args, akhiran, nil
}

// GET /api/ekspor/transaksi.xlsx?dari=&sampai= — penjualan per baris, pengeluaran, barang masuk, penyesuaian stok.
func (s *Server) eksporTransaksi(w http.ResponseWriter, r *http.Request) error {
	cond, args, akhiran, err := s.rentangEkspor(r)
	if err != nil {
		return err
	}
	where := func(alias string) string {
		if cond == "" {
			return ""
		}
		return "WHERE " + strings.ReplaceAll(cond, "tanggal", alias+".tanggal")
	}
	jual, err := loadPenjualan(s.db, where("j")+` ORDER BY j.tanggal, j.id`, args...)
	if err != nil {
		return err
	}
	jrows := [][]any{}
	for _, j := range jual {
		for _, b := range j.Baris {
			jrows = append(jrows, []any{j.Tanggal, j.ID, j.SaluranNama, b.ProdukNama, b.Qty, b.Harga, b.Subtotal, b.Potongan,
				b.HPP, b.HPPTotal, b.Untung, j.Catatan})
		}
	}
	prows := [][]any{}
	for _, j := range jual {
		for _, p := range j.RincianPotongan {
			prows = append(prows, []any{j.Tanggal, j.ID, j.SaluranNama, p.Nama, p.Rp})
		}
		if j.PotonganDiubah {
			prows = append(prows, []any{j.Tanggal, j.ID, j.SaluranNama, "Diubah manual (final)", j.Potongan})
		}
	}
	peng, err := loadPengeluaran(s.db, where("e")+` ORDER BY e.tanggal, e.id`, args...)
	if err != nil {
		return err
	}
	erows := [][]any{}
	for _, e := range peng {
		erows = append(erows, []any{e.Tanggal, e.KategoriNama, e.Jumlah, e.Catatan})
	}
	masuk, err := loadBarangMasuk(s.db, where("b")+` ORDER BY b.tanggal, b.id`, args...)
	if err != nil {
		return err
	}
	mrows := [][]any{}
	for _, b := range masuk {
		mrows = append(mrows, []any{b.Tanggal, b.Supplier, b.ProdukNama, b.Qty, b.HargaBeli, b.ModalPcs, b.Catatan})
	}
	adj, err := loadPenyesuaian(s.db, where("a")+` ORDER BY a.tanggal, a.id`, args...)
	if err != nil {
		return err
	}
	arows := [][]any{}
	for _, a := range adj {
		arows = append(arows, []any{a.Tanggal, a.ProdukNama, a.Selisih, a.StokSebelum, a.StokSesudah, a.Alasan})
	}
	return tulisXLSX(w, "transaksi-pastel-hijab"+akhiran+".xlsx", []lembar{
		{"Penjualan", []kolom{{"Tanggal", "", 12}, {"No. pesanan", "", 10}, {"Saluran", "", 14}, {"Model", "", 28}, {"Qty", "", 6},
			{"Harga", "rp", 12}, {"Subtotal", "rp", 12}, {"Potongan", "rp", 12}, {"Modal/pcs", "des", 12}, {"Modal total", "des", 12},
			{"Untung", "des", 12}, {"Catatan", "", 24}}, jrows},
		{"Rincian potongan", []kolom{{"Tanggal", "", 12}, {"No. pesanan", "", 10}, {"Saluran", "", 14}, {"Komponen", "", 26}, {"Rp", "rp", 12}}, prows},
		{"Pengeluaran", []kolom{{"Tanggal", "", 12}, {"Kategori", "", 18}, {"Jumlah", "rp", 14}, {"Catatan", "", 30}}, erows},
		{"Barang masuk", []kolom{{"Tanggal", "", 12}, {"Supplier", "", 18}, {"Model", "", 28}, {"Qty", "", 6}, {"Harga beli", "rp", 12},
			{"Modal/pcs", "des", 12}, {"Catatan", "", 24}}, mrows},
		{"Penyesuaian stok", []kolom{{"Tanggal", "", 12}, {"Model", "", 28}, {"Selisih", "", 8}, {"Stok sebelum", "", 10},
			{"Stok sesudah", "", 10}, {"Alasan", "", 24}}, arows},
	})
}

// GET /api/ekspor/laporan.xlsx?dari=&sampai=&saluran_id=&produk_id= — isi sama dengan GET /api/laporan.
func (s *Server) eksporLaporan(w http.ResponseWriter, r *http.Request) error {
	f, err := s.bacaFilterLaporan(r)
	if err != nil {
		return err
	}
	l, err := s.hitungLaporan(s.db, f)
	if err != nil {
		return err
	}
	g := l.Ringkasan
	ring := [][]any{
		{"Periode", l.Dari + " s/d " + l.Sampai},
		{"Pesanan", g.Pesanan},
		{"Terjual (pcs)", g.Pcs},
		{"Omzet", g.Omzet},
		{"Potongan saluran", g.Potongan},
		{"Modal barang terjual", g.HPP},
		{"Laba kotor", g.LabaKotor},
	}
	if g.Pengeluaran != nil {
		ring = append(ring, []any{"Pengeluaran", *g.Pengeluaran}, []any{"Laba bersih", *g.LabaBersih})
	} else {
		ring = append(ring, []any{"Catatan", "Pengeluaran tidak dibagi per saluran/model, jadi laba bersih hanya tampil tanpa filter."})
	}
	if l.SaluranID != nil {
		ring = append(ring, []any{"Filter saluran (id)", *l.SaluranID})
	}
	if l.ProdukID != nil {
		ring = append(ring, []any{"Filter model (id)", *l.ProdukID})
	}
	srows := [][]any{}
	for _, x := range l.PerSaluran {
		srows = append(srows, []any{x.SaluranNama, x.Pesanan, x.Pcs, x.Omzet, x.Potongan, x.HPP, x.LabaKotor})
	}
	prows := [][]any{}
	for _, x := range l.PerProduk {
		prows = append(prows, []any{x.ProdukNama, x.Kategori, x.Pesanan, x.Pcs, x.Omzet, x.Potongan, x.HPP, x.LabaKotor})
	}
	erows := [][]any{}
	for _, x := range l.PengeluaranPerKategori {
		erows = append(erows, []any{x.KategoriNama, x.Jumlah})
	}
	strows := [][]any{}
	for _, x := range l.Stok.Produk {
		strows = append(strows, []any{x.ProdukNama, x.Kategori, x.Stok, x.Modal, x.NilaiStok, x.BatasStokMenipis, yaTidak(x.Menipis)})
	}
	strows = append(strows, []any{"TOTAL", "", l.Stok.TotalPcs, nil, l.Stok.NilaiStok})
	angkaKol := []kolom{{"Pesanan", "", 9}, {"Pcs", "", 7}, {"Omzet", "rp", 14}, {"Potongan", "rp", 12}, {"Modal terjual", "des", 14}, {"Laba kotor", "des", 14}}
	return tulisXLSX(w, "laporan-pastel-hijab-"+l.Dari+"_"+l.Sampai+".xlsx", []lembar{
		{"Ringkasan", []kolom{{"Keterangan", "", 24}, {"Nilai", "des", 18}}, ring},
		{"Per saluran", append([]kolom{{"Saluran", "", 16}}, angkaKol...), srows},
		{"Per model", append([]kolom{{"Model", "", 28}, {"Kategori", "", 14}}, angkaKol...), prows},
		{"Pengeluaran", []kolom{{"Kategori", "", 20}, {"Jumlah", "rp", 14}}, erows},
		{"Stok", []kolom{{"Model", "", 28}, {"Kategori", "", 14}, {"Stok", "", 8}, {"Modal/pcs", "des", 12}, {"Nilai stok", "des", 14},
			{"Batas menipis", "", 10}, {"Menipis", "", 9}}, strows},
	})
}
