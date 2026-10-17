import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataState from '../components/DataState'
import { Daftar, IK, Ikon, KepalaHalaman, Kosong, StokLencana, Thumb } from '../components/ui'
import type { Produk as TProduk, Saluran } from '../lib/api-types'
import { rp, rpModal } from '../lib/format'
import { useApi } from '../lib/useApi'

type Saring = 'semua' | 'menipis' | 'nonaktif' | string

function Chip({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={aktif} className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${aktif ? 'border-ink bg-ink text-white' : 'border-stone-200 bg-white text-stone-600'}`}>
      {children}
    </button>
  )
}

export default function Produk() {
  const hasil = useApi<TProduk[]>('/produk')
  const saluran = useApi<Saluran[]>('/saluran?aktif=1')
  const [q, setQ] = useState('')
  const [saring, setSaring] = useState<Saring>('semua')

  const semua = hasil.data
  const aktif = useMemo(() => (semua ?? []).filter((p) => p.aktif), [semua])
  const kategori = useMemo(() => [...new Set(aktif.map((p) => p.kategori).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')), [aktif])
  const adaNonaktif = (semua ?? []).some((p) => !p.aktif)
  const salAktif = saluran.data ?? []

  const list = useMemo(() => {
    const kata = q.trim().toLowerCase()
    return (semua ?? []).filter((p) => {
      if (saring === 'nonaktif') return !p.aktif
      if (!p.aktif) return false
      if (saring === 'menipis' && !p.menipis) return false
      if (saring !== 'semua' && saring !== 'menipis' && p.kategori !== saring) return false
      return !kata || p.nama.toLowerCase().includes(kata) || p.kategori.toLowerCase().includes(kata)
    })
  }, [semua, q, saring])

  return (
    <>
      <KepalaHalaman
        judul="Produk"
        sub={semua ? `${aktif.length} model · ${aktif.reduce((t, p) => t + p.stok, 0)} pcs di stok` : undefined}
        aksi={
          <>
            <Link to="/masuk" className="hidden min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 font-semibold text-stone-700 md:inline-flex">
              <Ikon d={IK.masuk} /> Barang masuk
            </Link>
            <Link to="/produk/baru" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-600" aria-label="Tambah produk">
              <Ikon d={IK.plus} /> <span className="hidden sm:inline">Tambah produk</span>
              <span className="sm:hidden">Tambah</span>
            </Link>
          </>
        }
      />

      <DataState hasil={hasil} baris={6}>
        {(data) =>
          data.length === 0 ? (
            <Kosong
              ikon={IK.produk}
              judul="Belum ada produk"
              teks="Tambahkan model hijab yang dijual. Stok dan modal diisi lewat barang masuk."
              aksi={
                <Link to="/produk/baru" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-semibold text-white">
                  Tambah produk
                </Link>
              }
            />
          ) : (
            <>
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative md:w-72">
                  <Ikon d={IK.cari} className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari produk"
                    aria-label="Cari produk"
                    className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pr-3 pl-10 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                  />
                </div>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
                  <Chip aktif={saring === 'semua'} onClick={() => setSaring('semua')}>
                    Semua
                  </Chip>
                  <Chip aktif={saring === 'menipis'} onClick={() => setSaring('menipis')}>
                    Stok menipis
                  </Chip>
                  {kategori.map((k) => (
                    <Chip key={k} aktif={saring === k} onClick={() => setSaring(k)}>
                      {k}
                    </Chip>
                  ))}
                  {adaNonaktif && (
                    <Chip aktif={saring === 'nonaktif'} onClick={() => setSaring('nonaktif')}>
                      Nonaktif
                    </Chip>
                  )}
                </div>
              </div>

              {list.length === 0 && (
                <Kosong
                  ikon={saring === 'menipis' ? IK.cek : IK.cari}
                  judul={saring === 'menipis' && !q ? 'Semua stok aman' : 'Produk tidak ditemukan'}
                  teks={saring === 'menipis' && !q ? 'Tidak ada produk yang stoknya menipis.' : 'Coba kata lain atau pilih filter Semua.'}
                />
              )}

              {/* HP: daftar */}
              {list.length > 0 && (
                <div className="md:hidden">
                  <Daftar>
                    {list.map((p) => (
                      <Link key={p.id} to={`/produk/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-stone-50">
                        <Thumb nama={p.nama} />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-medium text-ink">{p.nama}</p>
                          <p className="text-sm text-stone-500 tabular-nums">Modal {rpModal(p.modal)}</p>
                        </div>
                        <StokLencana stok={p.stok} batas={p.batas_stok_menipis} />
                      </Link>
                    ))}
                  </Daftar>
                </div>
              )}

              {/* Laptop: tabel dengan harga per saluran */}
              {list.length > 0 && (
                <div className="hidden overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 text-left text-xs font-semibold text-stone-500">
                      <tr>
                        <th className="px-4 py-3">Produk</th>
                        <th className="px-3 py-3 text-right">Stok</th>
                        <th className="px-3 py-3 text-right">Modal</th>
                        {salAktif.map((s) => (
                          <th key={s.id} className="px-3 py-3 text-right whitespace-nowrap">
                            {s.nama}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {list.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50">
                          <td className="px-4 py-3">
                            <Link to={`/produk/${p.id}`} className="flex items-center gap-3">
                              <Thumb nama={p.nama} kecil />
                              <span className="min-w-0">
                                <span className="line-clamp-1 block font-medium text-ink">{p.nama}</span>
                                <span className="text-xs text-stone-500">{p.kategori || 'Tanpa kategori'}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <StokLencana stok={p.stok} batas={p.batas_stok_menipis} />
                          </td>
                          <td className="px-3 py-3 text-right text-stone-700 tabular-nums">{rpModal(p.modal)}</td>
                          {salAktif.map((s) => {
                            const hs = p.harga.find((h) => h.saluran_id === s.id)
                            const rugi = hs && hs.untung < 0
                            return (
                              <td key={s.id} className={`px-3 py-3 text-right tabular-nums ${rugi ? 'font-semibold text-red-700' : 'text-stone-700'}`}>
                                {hs ? rp(hs.harga) : <span className="text-stone-400">—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        }
      </DataState>
    </>
  )
}
