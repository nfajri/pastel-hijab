import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Sheet, Tabs } from '../../components/ui'
import { tglPanjang, tglPendek, type Penjualan } from '../lib/data'
import { rp } from '../lib/hitung'
import { hpp, omzet, pcs, untung } from '../lib/laporan'
import { namaSaluran, useStore } from '../lib/store'
import { BarisLink, BilahAtas, Gagal, IK, Ikon, Kerangka, KepalaHalaman, Kosong, Rinci } from '../ui'

function kelompok<T extends { tanggal: string }>(xs: T[]) {
  const m = new Map<string, T[]>()
  for (const x of xs) m.set(x.tanggal, [...(m.get(x.tanggal) ?? []), x])
  return [...m.entries()]
}

export default function Transaksi() {
  const st = useStore()
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as 'jual' | 'biaya') ?? 'jual'
  const [saluran, setSaluran] = useState('semua')

  const js = st.penjualan.filter((j) => saluran === 'semua' || j.saluranId === saluran)

  return (
    <>
      <KepalaHalaman
        judul="Transaksi"
        aksi={
          tab === 'jual' ? (
            <Link to="/jual" className="hidden min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-600 md:inline-flex">
              <Ikon d={IK.plus} /> Catat penjualan
            </Link>
          ) : (
            <Link to="/biaya/baru" className="hidden min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-600 md:inline-flex">
              <Ikon d={IK.plus} /> Catat biaya
            </Link>
          )
        }
      />
      <div className="mb-4 md:max-w-sm">
        <Tabs
          items={[
            { key: 'jual', label: 'Penjualan' },
            { key: 'biaya', label: 'Biaya' },
          ]}
          value={tab}
          onChange={(t) => setSp(t === 'jual' ? {} : { tab: t }, { replace: true })}
        />
      </div>

      {st.mode === 'memuat' && <Kerangka />}
      {st.mode === 'gagal' && <Gagal onUlang={() => st.setMode('normal')} />}

      {(st.mode === 'normal' || st.mode === 'kosong') && tab === 'jual' && (
        <>
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {[{ id: 'semua', nama: 'Semua' }, ...st.saluran].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSaluran(s.id)}
                className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${saluran === s.id ? 'border-ink bg-ink text-white' : 'border-stone-200 bg-white text-stone-600'}`}
              >
                {s.nama}
              </button>
            ))}
          </div>
          {js.length === 0 ? (
            <Kosong
              ikon={IK.transaksi}
              judul="Belum ada penjualan"
              teks={saluran === 'semua' ? 'Penjualan yang dicatat akan muncul di sini, dikelompokkan per hari.' : `Belum ada penjualan di ${namaSaluran(st.saluran, saluran)}.`}
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
                    <h2 className="text-sm font-semibold text-stone-500">{tglPanjang(tgl)}</h2>
                    <span className="text-sm text-stone-500 tabular-nums">{rp(xs.reduce((t, j) => t + omzet(j), 0))}</span>
                  </div>
                  <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
                    {xs.map((j) => (
                      <BarisLink
                        key={j.id}
                        to={`/transaksi/${j.id}`}
                        kanan={
                          <div className="text-right">
                            <p className="font-semibold text-ink tabular-nums">{rp(omzet(j))}</p>
                            <p className="text-xs text-emerald-700 tabular-nums">+{rp(untung(j))}</p>
                          </div>
                        }
                      >
                        <p className="truncate font-medium text-ink">{j.baris.map((b) => (b.qty > 1 ? `${b.nama} ×${b.qty}` : b.nama)).join(', ')}</p>
                        <p className="text-sm text-stone-500">
                          {namaSaluran(st.saluran, j.saluranId)} · {j.jam}
                        </p>
                      </BarisLink>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {(st.mode === 'normal' || st.mode === 'kosong') && tab === 'biaya' && (
        <>
          {st.biaya.length === 0 ? (
            <Kosong
              ikon={IK.biaya}
              judul="Belum ada biaya"
              teks="Catat sewa lapak, iklan, atau packaging massal supaya laba bersih akurat."
              aksi={
                <Link to="/biaya/baru" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-semibold text-white">
                  Catat biaya
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
              {st.biaya.map((b) => (
                <div key={b.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{b.kategori}</p>
                    <p className="truncate text-sm text-stone-500">
                      {tglPendek(b.tanggal)}
                      {b.catatan ? ` · ${b.catatan}` : ''}
                    </p>
                  </div>
                  <p className="font-semibold text-ink tabular-nums">{rp(b.jumlah)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tombol tambah melayang di HP */}
      <Link
        to={tab === 'jual' ? '/jual' : '/biaya/baru'}
        aria-label={tab === 'jual' ? 'Catat penjualan' : 'Catat biaya'}
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex h-14 items-center gap-2 rounded-2xl bg-brand-700 px-5 font-semibold text-white shadow-lg md:hidden"
      >
        <Ikon d={IK.plus} className="h-6 w-6" strokeWidth={2.2} /> {tab === 'jual' ? 'Catat' : 'Biaya'}
      </Link>
    </>
  )
}

export function DetailPenjualan() {
  const { id } = useParams()
  const st = useStore()
  const nav = useNavigate()
  const [hapus, setHapus] = useState(false)
  const j: Penjualan | undefined = st.penjualan.find((x) => x.id === id)
  if (!j) return <BilahAtas judul="Penjualan tidak ditemukan" kembali="/transaksi" />

  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul={`Penjualan ${j.id}`} kembali="/transaksi" />
      <p className="mb-4 text-sm text-stone-500">
        {namaSaluran(st.saluran, j.saluranId)} · {tglPanjang(j.tanggal)}, {j.jam}
      </p>
      <div className="flex flex-col gap-4">
        <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
          {j.baris.map((b) => (
            <div key={b.produkId} className="px-4 py-3">
              <p className="font-medium text-ink">{b.nama}</p>
              <div className="mt-1 flex justify-between text-sm text-stone-500 tabular-nums">
                <span>
                  {b.qty} × {rp(b.harga)}
                </span>
                <span>Modal saat itu {rp(b.hpp)}/pcs</span>
              </div>
            </div>
          ))}
        </div>
        <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
          <Rinci label={`Total harga (${pcs(j)} pcs)`} nilai={rp(omzet(j))} />
          <Rinci label={`Potongan ${namaSaluran(st.saluran, j.saluranId)}`} nilai={`−${rp(j.potongan)}`} nada="kurang" />
          <Rinci label="Uang diterima" nilai={rp(omzet(j) - j.potongan)} tebal garis />
          <Rinci label="Modal barang (HPP)" nilai={`−${rp(hpp(j))}`} nada="kurang" />
          <Rinci label="Untung" nilai={rp(untung(j))} tebal garis nada="untung" />
        </section>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary">
            <Ikon d={IK.ubah} /> Ubah
          </Button>
          <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setHapus(true)}>
            <Ikon d={IK.hapus} /> Hapus
          </Button>
        </div>
      </div>
      <Sheet open={hapus} onClose={() => setHapus(false)} title="Hapus penjualan ini?">
        <p className="mb-4 text-sm text-stone-600">Stok akan dikembalikan: {j.baris.map((b) => `${b.nama} +${b.qty}`).join(', ')}.</p>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            block
            onClick={() => {
              st.hapusPenjualan(j.id)
              st.tampilkan('Penjualan dihapus, stok dikembalikan.')
              nav('/transaksi')
            }}
          >
            Hapus penjualan
          </Button>
          <Button variant="ghost" block onClick={() => setHapus(false)}>
            Batal
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
