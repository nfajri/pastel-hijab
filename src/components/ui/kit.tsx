// Komponen UI bersama (dari prototipe T-0128): ikon, kepala/bilah halaman, chip pilihan, stepper, lencana, daftar, state kosong/gagal/memuat.
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from './Button'

export function Ikon({ d, className = 'h-5 w-5', strokeWidth = 1.8 }: { d: string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export const IK = {
  beranda: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  produk: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
  transaksi: 'M4 6h16M4 12h16M4 18h10',
  harga: 'M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01',
  laporan: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  pengaturan:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14 3h-4l-.6 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2L10 21h4l.6-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  kembali: 'M15 18l-6-6 6-6',
  tutup: 'M6 6l12 12M18 6L6 18',
  kanan: 'M9 6l6 6-6 6',
  cari: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3',
  masuk: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  stok: 'M4 7h16M4 12h16M4 17h7M17 15v6M14 18h6',
  pengeluaran: 'M3 7h18v12H3zM3 11h18M7 15h3',
  ekspor: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  cek: 'M5 12l5 5L20 7',
  peringatan: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  hapus: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  ubah: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  saluran: 'M3 9l1-5h16l1 5M3 9h18v11H3zM9 20v-6h6v6',
  modal: 'M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H7',
  bulat: 'M4 12a8 8 0 1016 0 8 8 0 00-16 0zM12 8v4l3 2',
  tag: 'M3 12V3h9l9 9-9 9-9-9zM8 8h.01',
  akun: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  keluar: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  kalender: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
}

/** Kepala halaman utama (tab). */
export function KepalaHalaman({ judul, sub, aksi }: { judul: string; sub?: ReactNode; aksi?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{judul}</h1>
        {sub && <p className="mt-0.5 text-sm text-stone-500">{sub}</p>}
      </div>
      {aksi && <div className="flex shrink-0 items-center gap-2">{aksi}</div>}
    </header>
  )
}

/** Bilah atas untuk halaman tugas/detail (layar penuh di HP). */
export function BilahAtas({ judul, kembali, tutup, kanan }: { judul: string; kembali?: string; tutup?: boolean; kanan?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 flex min-h-14 items-center gap-1 border-b border-brand-100 bg-white/95 px-1 pt-[env(safe-area-inset-top)] backdrop-blur md:static md:mx-0 md:mb-6 md:border-0 md:bg-transparent md:px-0 md:pt-0">
      <button
        type="button"
        onClick={() => (kembali ? nav(kembali) : nav(-1))}
        aria-label={tutup ? 'Tutup' : 'Kembali'}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100"
      >
        <Ikon d={tutup ? IK.tutup : IK.kembali} className="h-6 w-6" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-ink md:text-2xl md:font-bold">{judul}</h1>
      {kanan && <div className="flex shrink-0 items-center gap-1 pr-2">{kanan}</div>}
    </div>
  )
}

/** Bilah aksi yang menempel di bawah (HP) / di akhir form (laptop). */
export function BilahBawah({ children, ringkas }: { children: ReactNode; ringkas?: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:sticky md:mt-6 md:rounded-2xl md:border md:shadow-sm">
      {ringkas && <div className="mb-3">{ringkas}</div>}
      <div className="flex gap-2">{children}</div>
    </div>
  )
}

/** Pilihan berbentuk chip (satu nilai). */
export function Pilihan<K extends string>({
  items,
  value,
  onChange,
  besar,
  gulir,
  label,
}: {
  items: { key: K; label: ReactNode; sub?: ReactNode; disabled?: boolean }[]
  value: K
  onChange: (k: K) => void
  besar?: boolean
  gulir?: boolean
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={besar ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : gulir ? '-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:px-0' : 'flex flex-wrap gap-2'}>
      {items.map((it) => {
        const aktif = it.key === value
        return (
          <button
            key={it.key}
            type="button"
            role="radio"
            aria-checked={aktif}
            disabled={it.disabled}
            onClick={() => onChange(it.key)}
            className={`min-h-11 shrink-0 rounded-xl border px-3 text-left text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40 ${
              aktif ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
            } ${besar ? 'py-2' : ''}`}
          >
            <span className="block truncate">{it.label}</span>
            {it.sub != null && <span className={`block text-xs font-normal ${aktif ? 'text-white/80' : 'text-stone-500'}`}>{it.sub}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Stepper({ value, onChange, max, min = 1, label }: { value: number; onChange: (n: number) => void; max?: number; min?: number; label: string }) {
  return (
    <div className="flex items-center rounded-xl border border-stone-200 bg-white" role="group" aria-label={label}>
      <button type="button" aria-label="Kurangi" disabled={value <= min} onClick={() => onChange(value - 1)} className="flex h-11 w-11 items-center justify-center text-stone-600 disabled:text-stone-300">
        <Ikon d={IK.minus} />
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value.replace(/\D/g, '') || 0)))}
        className="h-11 w-10 bg-transparent text-center text-base font-semibold tabular-nums text-ink focus:outline-none"
      />
      <button
        type="button"
        aria-label="Tambah"
        disabled={max != null && value >= max}
        onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 items-center justify-center text-brand-700 disabled:text-stone-300"
      >
        <Ikon d={IK.plus} />
      </button>
    </div>
  )
}

type Nada = 'netral' | 'brand' | 'peringatan' | 'bahaya' | 'baik'
const NADA: Record<Nada, string> = {
  netral: 'bg-stone-100 text-stone-600',
  brand: 'bg-brand-100 text-brand-700',
  peringatan: 'bg-amber-100 text-amber-800',
  bahaya: 'bg-red-100 text-red-700',
  baik: 'bg-emerald-100 text-emerald-800',
}
export function Lencana({ nada = 'netral', children }: { nada?: Nada; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${NADA[nada]}`}>{children}</span>
}

export function StokLencana({ stok, batas }: { stok: number; batas: number }) {
  if (stok === 0) return <Lencana nada="bahaya">Habis</Lencana>
  if (stok <= batas) return <Lencana nada="peringatan">Sisa {stok}</Lencana>
  return <span className="text-sm text-stone-500 tabular-nums">Stok {stok}</span>
}

/** Pengganti foto produk: inisial di kotak lembut. */
export function Thumb({ nama, kecil }: { nama: string; kecil?: boolean }) {
  const ini = nama
    .split(' ')
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-100 font-semibold text-brand-700 ${kecil ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-base'}`} aria-hidden="true">
      {ini}
    </div>
  )
}

export function BarisLink({ to, children, kanan }: { to: string; children: ReactNode; kanan?: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-50">
      <div className="min-w-0 flex-1">{children}</div>
      {kanan}
      <Ikon d={IK.kanan} className="h-4 w-4 shrink-0 text-stone-400" />
    </Link>
  )
}

/** Kartu daftar dengan pemisah antar-baris. */
export function Daftar({ children, judul, aksi }: { children: ReactNode; judul?: ReactNode; aksi?: ReactNode }) {
  return (
    <section>
      {(judul || aksi) && (
        <div className="mb-2 flex items-center justify-between px-1">
          {judul && <h2 className="text-sm font-semibold text-stone-500">{judul}</h2>}
          {aksi}
        </div>
      )}
      <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">{children}</div>
    </section>
  )
}

export function Kosong({ ikon, judul, teks, aksi }: { ikon: string; judul: string; teks?: string; aksi?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <Ikon d={ikon} className="h-6 w-6" />
      </div>
      <p className="font-semibold text-ink">{judul}</p>
      {teks && <p className="mt-1 max-w-xs text-sm text-stone-500">{teks}</p>}
      {aksi && <div className="mt-4">{aksi}</div>}
    </div>
  )
}

export function Gagal({ onUlang, pesan }: { onUlang: () => void; pesan?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-red-200 bg-white px-6 py-10 text-center" role="alert">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
        <Ikon d={IK.peringatan} className="h-6 w-6" />
      </div>
      <p className="font-semibold text-ink">Data belum bisa dimuat</p>
      <p className="mt-1 max-w-xs text-sm text-stone-500">{pesan || 'Periksa sambungan internet, lalu coba lagi.'} Data yang sudah tersimpan tetap aman.</p>
      <Button variant="secondary" className="mt-4" onClick={onUlang}>
        Coba lagi
      </Button>
    </div>
  )
}

export function Kerangka({ baris = 4 }: { baris?: number }) {
  return (
    <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white" aria-busy="true" aria-label="Memuat">
      {Array.from({ length: baris }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-4">
          <div className="h-10 w-10 rounded-xl bg-stone-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-stone-100" />
            <div className="h-3 w-1/3 rounded bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Baris label–nilai untuk rincian angka. */
export function Rinci({ label, nilai, tebal, nada, garis }: { label: ReactNode; nilai: ReactNode; tebal?: boolean; nada?: 'kurang' | 'untung' | 'rugi'; garis?: boolean }) {
  const warna = nada === 'rugi' ? 'text-red-700' : nada === 'untung' ? 'text-emerald-700' : nada === 'kurang' ? 'text-stone-600' : 'text-ink'
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${garis ? 'mt-1 border-t border-stone-200 pt-2.5' : ''}`}>
      <span className={`min-w-0 text-sm ${tebal ? 'font-semibold text-ink' : 'text-stone-600'}`}>{label}</span>
      <span className={`shrink-0 tabular-nums ${tebal ? 'text-base font-bold' : 'text-sm'} ${warna}`}>{nilai}</span>
    </div>
  )
}

export function Bagian({ judul, children, aksi }: { judul?: ReactNode; children: ReactNode; aksi?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
      {(judul || aksi) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {judul && <h2 className="text-base font-semibold text-ink">{judul}</h2>}
          {aksi}
        </div>
      )}
      {children}
    </section>
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-stone-700">
      {children}
    </label>
  )
}

export function Saklar({ aktif, onChange, label }: { aktif: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      aria-label={label}
      onClick={() => onChange(!aktif)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${aktif ? 'bg-brand-700' : 'bg-stone-300'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${aktif ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}
