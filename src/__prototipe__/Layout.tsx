import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from './lib/store'
import logoTanda from '../assets/brand/logo-tanda.png'
import { IK, Ikon } from './ui'

// HP: 5 tab (6 tab dengan label 10px terlalu sempit di iPhone). Pengaturan lewat ikon di Beranda.
export const TAB = [
  { to: '/', label: 'Beranda', ikon: IK.beranda },
  { to: '/transaksi', label: 'Transaksi', ikon: IK.transaksi },
  { to: '/produk', label: 'Produk', ikon: IK.produk },
  { to: '/harga', label: 'Harga', ikon: IK.harga },
  { to: '/laporan', label: 'Laporan', ikon: IK.laporan },
]

function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-brand-100 bg-white md:flex">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <img src={logoTanda} alt="" className="h-9 w-9" />
        <span className="text-lg font-semibold tracking-tight text-ink">Pastel Hijab</span>
      </div>
      <div className="px-3 pb-4">
        <Link to="/jual" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-600">
          <Ikon d={IK.plus} /> Catat penjualan
        </Link>
      </div>
      <nav className="flex flex-col gap-1 px-3" aria-label="Navigasi utama">
        {[...TAB, { to: '/pengaturan', label: 'Pengaturan', ikon: IK.pengaturan }].map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-brand-100 text-brand-700' : 'text-stone-600 hover:bg-stone-50'}`
            }
          >
            <Ikon d={t.ikon} className="h-6 w-6" />
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-brand-100 px-5 py-4 text-sm text-stone-500">
        <div className="font-medium text-stone-700">Ibu Rahma</div>
        rahma.hijab@gmail.com
      </div>
    </aside>
  )
}

function Toast() {
  const { toast, tutupToast } = useStore()
  const nav = useNavigate()
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6" role="status" key={toast.id}>
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
        <Ikon d={IK.cek} className="h-5 w-5 shrink-0 text-emerald-400" />
        <span className="min-w-0 flex-1">{toast.teks}</span>
        {toast.aksi && (
          <button
            type="button"
            className="shrink-0 rounded-lg px-2 py-1 font-semibold text-brand-100 hover:bg-white/10"
            onClick={() => {
              nav(toast.aksi!.to)
              tutupToast()
            }}
          >
            {toast.aksi.label}
          </button>
        )}
      </div>
    </div>
  )
}

/** Halaman utama: tab bar bawah di HP, sidebar di laptop. */
export function LayoutTab() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <Sidebar />
      <main className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:p-8">
          <Outlet />
        </div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-brand-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navigasi utama">
        {TAB.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) => `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-brand-700' : 'text-stone-500'}`}
          >
            <Ikon d={t.ikon} className="h-6 w-6" />
            <span className="truncate">{t.label}</span>
          </NavLink>
        ))}
      </nav>
      <Toast />
    </div>
  )
}

/** Halaman tugas/detail: layar penuh di HP (tanpa tab bar), tetap ada sidebar di laptop. */
export function LayoutFokus() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <Sidebar />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 pb-40 md:p-8 md:pb-8">
          <Outlet />
        </div>
      </main>
      <Toast />
    </div>
  )
}
