import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import { NAV_ITEMS } from './nav'
import Beranda from './pages/Beranda'
import Produk from './pages/Produk'
import Penjualan from './pages/Penjualan'
import Kalkulator from './pages/Kalkulator'
import Laporan from './pages/Laporan'
import Pengaturan from './pages/Pengaturan'
import Komponen from './pages/Komponen'

const PAGES = { '/': Beranda, '/produk': Produk, '/penjualan': Penjualan, '/kalkulator': Kalkulator, '/laporan': Laporan, '/pengaturan': Pengaturan }

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {NAV_ITEMS.map(({ to }) => {
          const Page = PAGES[to as keyof typeof PAGES]
          return <Route key={to} path={to} element={<Page />} />
        })}
        <Route path="/komponen" element={<Komponen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
