import type { ReactElement } from 'react'

export interface NavItem {
  to: string
  label: string
  icon: ReactElement
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Beranda', icon: <Icon d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" /> },
  { to: '/produk', label: 'Produk', icon: <Icon d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8" /> },
  { to: '/penjualan', label: 'Penjualan', icon: <Icon d="M6 6h15l-1.5 9H8L6 3H3M9 20h.01M18 20h.01" /> },
  { to: '/kalkulator', label: 'Kalkulator', icon: <Icon d="M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" /> },
  { to: '/laporan', label: 'Laporan', icon: <Icon d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { to: '/pengaturan', label: 'Pengaturan', icon: <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14 3h-4l-.6 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2L10 21h4l.6-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /> },
]
