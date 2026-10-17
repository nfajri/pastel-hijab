import { NavLink, Outlet } from 'react-router-dom'
import { NAV_ITEMS } from '../../nav'

export default function AppLayout() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Sidebar: laptop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-brand-100 bg-white md:flex">
        <div className="px-5 py-5 text-lg font-bold text-brand-700">Toko Hijab</div>
        <nav className="flex flex-col gap-1 px-3" aria-label="Navigasi utama">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive ? 'bg-brand-100 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-3xl p-4 pb-24 md:p-8 md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* Bottom tab bar: layar kecil */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-brand-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navigasi utama"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? 'text-brand-700' : 'text-slate-500'
              }`
            }
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
