import { Navigate, Route, Routes } from 'react-router-dom'
import { LayoutFokus, LayoutTab } from './components/layout/Layout'
import { RequireAuth } from './lib/auth'
import Beranda from './pages/Beranda'
import BarangMasuk from './pages/BarangMasuk'
import Harga from './pages/harga/Harga'
import Jual from './pages/jual/Jual'
import Laporan from './pages/Laporan'
import Masuk from './pages/Masuk'
import PenyesuaianStok from './pages/PenyesuaianStok'
import CatatPengeluaran from './pages/Pengeluaran'
import KategoriPengeluaranPage from './pages/pengaturan/KategoriPengeluaran'
import KomponenModalPage from './pages/pengaturan/KomponenModal'
import Pengaturan from './pages/pengaturan/Pengaturan'
import PembulatanPage from './pages/pengaturan/Pembulatan'
import { DaftarSaluran, DetailSaluran } from './pages/pengaturan/Saluran'
import Produk from './pages/Produk'
import DetailProduk from './pages/ProdukDetail'
import FormProduk from './pages/ProdukForm'
import DetailPenjualan from './pages/transaksi/DetailPenjualan'
import Transaksi from './pages/transaksi/Transaksi'

export default function App() {
  return (
    <Routes>
      <Route path="/masuk-akun" element={<Masuk />} />
      <Route
        element={
          <RequireAuth>
            <LayoutTab />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Beranda />} />
        <Route path="/transaksi" element={<Transaksi />} />
        <Route path="/produk" element={<Produk />} />
        <Route path="/harga" element={<Harga />} />
        <Route path="/laporan" element={<Laporan />} />
      </Route>
      <Route
        element={
          <RequireAuth>
            <LayoutFokus />
          </RequireAuth>
        }
      >
        <Route path="/jual" element={<Jual />} />
        <Route path="/transaksi/:id/ubah" element={<Jual />} />
        <Route path="/transaksi/:id" element={<DetailPenjualan />} />
        <Route path="/pengeluaran/baru" element={<CatatPengeluaran />} />
        <Route path="/pengeluaran/:id/ubah" element={<CatatPengeluaran />} />
        <Route path="/produk/baru" element={<FormProduk />} />
        <Route path="/produk/:id" element={<DetailProduk />} />
        <Route path="/produk/:id/ubah" element={<FormProduk />} />
        <Route path="/masuk" element={<BarangMasuk />} />
        <Route path="/masuk/:id/ubah" element={<BarangMasuk />} />
        <Route path="/stok/:id" element={<PenyesuaianStok />} />
        <Route path="/pengaturan" element={<Pengaturan />} />
        <Route path="/pengaturan/saluran" element={<DaftarSaluran />} />
        <Route path="/pengaturan/saluran/:id" element={<DetailSaluran />} />
        <Route path="/pengaturan/modal" element={<KomponenModalPage />} />
        <Route path="/pengaturan/pembulatan" element={<PembulatanPage />} />
        <Route path="/pengaturan/pengeluaran" element={<KategoriPengeluaranPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      )
}
