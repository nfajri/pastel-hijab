import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DataState from '../../components/DataState'
import { BarisLink, IK, Ikon, KepalaHalaman, Kosong, Tabs } from '../../components/ui'
import type { Saluran } from '../../lib/api-types'
import type { Pengeluaran, Penjualan } from '../../lib/api-tahap2'
import { qs } from '../../lib/api'
import { rp } from '../../lib/format'
import { jamWIB, tglHari } from '../../lib/tgl'
import { useApi } from '../../lib/useApi'

function kelompok<T extends { tanggal: string }>(xs: T[]) {
  const m = new Map<string, T[]>()
  for (const x of xs) m.set(x.tanggal, [...(m.get(x.tanggal) ?? []), x])
  return [...m.entries()]
}

const teksBaris = (j: Penjualan) => j.baris.map((b) => (b.qty > 1 ? `${b.produk_nama} ×${b.qty}` : b.produk_nama)).join(', ')

function DaftarPenjualan() {
  const [saluranId, setSaluranId] = useState<number | null>(null)
  const saluran = useApi<Saluran[]>('/saluran')
  const hasil = useApi<Penjualan[]>(`/penjualan${qs({ saluran_id: saluranId ?? undefined, limit: 200 })}`, { pertahankan: true })
  return (
    <>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {[{ id: null as number | null, nama: 'Semua' }, ...(saluran.data ?? [])].map((s) => (
          <button
            key={s.id ?? 'semua'}
            type="button"
            aria-pressed={saluranId === s.id}
            onClick={() => setSaluranId(s.id)}
            className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${saluranId === s.id ? 'border-ink bg-ink text-white' : 'border-stone-200 bg-white text-stone-600'}`}
          >
            {s.nama}
          </button>
        ))}
      </div>
      <DataState hasil={hasil} baris={6}>
        {(js) =>
          js.length === 0 ? (
            <Kosong
              ikon={IK.transaksi}
              judul="Belum ada penjualan"
              teks={saluranId == null ? 'Penjualan yang dicatat akan muncul di sini, dikelompokkan per hari.' : `Belum ada penjualan di ${saluran.data?.find((s) => s.id === saluranId)?.nama ?? 'saluran ini'}.`}
              aksi={
                <Link to="/jual" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-semibold text-white">
                  Catat penjualan
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-5">
              {kelompok(js).map(([tgl, xs]) => (
                <section key={tgl}>
                  <div className="mb-2 flex items-baseline justify-between px-1">
                    <h2 className="text-sm font-semibold text-stone-500">{tglHari(tgl)}</h2>
                    <span className="text-sm text-stone-500 tabular-nums">{rp(xs.reduce((t, j) => t + j.subtotal, 0))}</span>
                  </div>
                  <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
                    {xs.map((j) => (
                      <BarisLink
                        key={j.id}
                        to={`/transaksi/${j.id}`}
                        kanan={
                          <div className="text-right">
                            <p className="font-semibold text-ink tabular-nums">{rp(j.subtotal)}</p>
                            <p className={`text-xs tabular-nums ${j.untung < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{j.untung < 0 ? rp(j.untung) : `+${rp(j.untung)}`}</p>
                          </div>
                        }
                      >
                        <p className="truncate font-medium text-ink">{teksBaris(j)}</p>
                        <p className="text-sm text-stone-500">
                          {j.saluran_nama} · {jamWIB(j.created_at)}
                        </p>
                      </BarisLink>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        }
      </DataState>
    </>
  )
}

function DaftarPengeluaran() {
  const hasil = useApi<Pengeluaran[]>('/pengeluaran?limit=200')
  return (
    <DataState hasil={hasil} baris={6}>
      {(xs) =>
        xs.length === 0 ? (
          <Kosong
            ikon={IK.pengeluaran}
            judul="Belum ada pengeluaran"
            teks="Catat sewa lapak, iklan, atau packaging massal supaya laba bersih akurat."
            aksi={
              <Link to="/pengeluaran/baru" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-semibold text-white">
                Catat pengeluaran
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
            {xs.map((b) => (
              <BarisLink key={b.id} to={`/pengeluaran/${b.id}/ubah`} kanan={<p className="font-semibold text-ink tabular-nums">{rp(b.jumlah)}</p>}>
                <p className="font-medium text-ink">{b.kategori_nama}</p>
                <p className="truncate text-sm text-stone-500">
                  {tglHari(b.tanggal)}
                  {b.catatan ? ` · ${b.catatan}` : ''}
                </p>
              </BarisLink>
            ))}
          </div>
        )
      }
    </DataState>
  )
}

export default function Transaksi() {
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') === 'pengeluaran' ? 'pengeluaran' : 'jual'
  return (
    <>
      <KepalaHalaman
        judul="Transaksi"
        aksi={
          <Link to={tab === 'jual' ? '/jual' : '/pengeluaran/baru'} className="hidden min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-600 md:inline-flex">
            <Ikon d={IK.plus} /> {tab === 'jual' ? 'Catat penjualan' : 'Catat pengeluaran'}
          </Link>
        }
      />
      <div className="mb-4 md:max-w-sm">
        <Tabs<'jual' | 'pengeluaran'>
          items={[
            { key: 'jual', label: 'Penjualan' },
            { key: 'pengeluaran', label: 'Pengeluaran' },
          ]}
          value={tab}
          onChange={(t) => setSp(t === 'jual' ? {} : { tab: t }, { replace: true })}
        />
      </div>
      {tab === 'jual' ? <DaftarPenjualan /> : <DaftarPengeluaran />}

      {/* Tombol tambah melayang di HP */}
      <Link
        to={tab === 'jual' ? '/jual' : '/pengeluaran/baru'}
        aria-label={tab === 'jual' ? 'Catat penjualan' : 'Catat pengeluaran'}
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex h-14 items-center gap-2 rounded-2xl bg-brand-700 px-5 font-semibold text-white shadow-lg md:hidden"
      >
        <Ikon d={IK.plus} className="h-6 w-6" strokeWidth={2.2} /> {tab === 'jual' ? 'Catat' : 'Pengeluaran'}
      </Link>
    </>
  )
}
