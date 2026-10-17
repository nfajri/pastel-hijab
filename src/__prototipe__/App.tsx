import { Navigate, Route, Routes } from 'react-router-dom'
import { LayoutFokus, LayoutTab } from './Layout'
import { useStore } from './lib/store'
import Beranda from './pages/Beranda'
import HargaA from './pages/harga/HargaA'
import HargaB from './pages/harga/HargaB'
import JualA from './pages/jual/JualA'
import JualB from './pages/jual/JualB'
import Laporan from './pages/Laporan'
import Pengaturan, { DaftarSaluran, DetailSaluran, KategoriBiayaPage, KomponenModalPage, Masuk, PembulatanPage } from './pages/Pengaturan'
import Produk, { DetailProduk, FormProduk } from './pages/Produk'
import { BarangMasuk, CatatBiaya, PenyesuaianStok } from './pages/Stok'
import Transaksi, { DetailPenjualan } from './pages/Transaksi'

export default function App() {
  const { opsi } = useStore()
  return (
    <Routes>
      <Route element={<LayoutTab />}>
        <Route path="/" element={<Beranda />} />
        <Route path="/transaksi" element={<Transaksi />} />
        <Route path="/produk" element={<Produk />} />
        <Route path="/harga" element={opsi === 'A' ? <HargaA /> : <HargaB />} />
        <Route path="/laporan" element={<Laporan />} />
      </Route>
      <Route element={<LayoutFokus />}>
        <Route path="/jual" element={opsi === 'A' ? <JualA /> : <JualB />} />
        <Route path="/transaksi/:id" element={<DetailPenjualan />} />
        <Route path="/produk/baru" element={<FormProduk />} />
        <Route path="/produk/:id" element={<DetailProduk />} />
        <Route path="/produk/:id/ubah" element={<FormProduk />} />
        <Route path="/masuk" element={<BarangMasuk />} />
        <Route path="/stok/:id" element={<PenyesuaianStok />} />
        <Route path="/biaya/baru" element={<CatatBiaya />} />
        <Route path="/pengaturan" element={<Pengaturan />} />
        <Route path="/pengaturan/saluran" element={<DaftarSaluran />} />
        <Route path="/pengaturan/saluran/:id" element={<DetailSaluran />} />
        <Route path="/pengaturan/modal" element={<KomponenModalPage />} />
        <Route path="/pengaturan/pembulatan" element={<PembulatanPage />} />
        <Route path="/pengaturan/biaya" element={<KategoriBiayaPage />} />
      </Route>
      <Route path="/masuk-akun" element={<Masuk />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
