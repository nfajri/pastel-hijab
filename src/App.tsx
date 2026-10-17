import { Navigate, Route, Routes } from 'react-router-dom'
import { LayoutFokus, LayoutTab } from './components/layout/Layout'
import { RequireAuth } from './lib/auth'
// Tahap 2 (penjualan, kalkulator, pengeluaran, laporan, beranda) masih memakai halaman & data tiruan dari prototipe.
import Beranda from './__prototipe__/pages/Beranda'
import HargaB from './__prototipe__/pages/harga/HargaB'
import JualB from './__prototipe__/pages/jual/JualB'
import Laporan from './__prototipe__/pages/Laporan'
import { CatatPengeluaran } from './__prototipe__/pages/Stok'
import Transaksi, { DetailPenjualan } from './__prototipe__/pages/Transaksi'
import { StoreProvider } from './__prototipe__/lib/store'
import BarangMasuk from './pages/BarangMasuk'
import Masuk from './pages/Masuk'
import PenyesuaianStok from './pages/PenyesuaianStok'
import KomponenModalPage from './pages/pengaturan/KomponenModal'
import Pengaturan from './pages/pengaturan/Pengaturan'
import PembulatanPage from './pages/pengaturan/Pembulatan'
import { DaftarSaluran, DetailSaluran } from './pages/pengaturan/Saluran'
import Produk from './pages/Produk'
import DetailProduk from './pages/ProdukDetail'
import FormProduk from './pages/ProdukForm'

export default function App() {
  return (
    <StoreProvider>
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
          <Route path="/harga" element={<HargaB />} />
          <Route path="/laporan" element={<Laporan />} />
        </Route>
        <Route
          element={
            <RequireAuth>
              <LayoutFokus />
            </RequireAuth>
          }
        >
          <Route path="/jual" element={<JualB />} />
          <Route path="/transaksi/:id" element={<DetailPenjualan />} />
          <Route path="/pengeluaran/baru" element={<CatatPengeluaran />} />
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </StoreProvider>
  )
}
