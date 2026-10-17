// Laporan laba: semua angka dari GET /api/laporan; Ekspor Excel lewat /api/ekspor/*.xlsx.
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DataState from '../components/DataState'
import { Button, IK, Ikon, KepalaHalaman, Kosong, Rinci, Sheet, StokLencana, Tabs, Thumb } from '../components/ui'
import { qs } from '../lib/api'
import type { Saluran } from '../lib/api-types'
import type { Laporan as TLaporan, ProdukT2 } from '../lib/api-tahap2'
import { hariIniWIB, rp, rpModal } from '../lib/format'
import { namaPeriode, rentangPeriode, type Periode } from '../lib/tgl'
import { useApi } from '../lib/useApi'

const PERIODE: Periode[] = ['hari', 'minggu', 'bulan', 'rentang']
const pilihCls = 'min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-ink focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none'
type TabLaporan = 'saluran' | 'model' | 'stok'

function Batang({ nilai, maks }: { nilai: number; maks: number }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${maks > 0 && nilai > 0 ? Math.max(2, (nilai / maks) * 100) : 0}%` }} />
    </div>
  )
}

const nadaLaba = (n: number) => (n < 0 ? 'text-red-700' : 'text-emerald-700')

function Isi({ l, filterAktif, tab, setTab }: { l: TLaporan; filterAktif: boolean; tab: TabLaporan; setTab: (t: TabLaporan) => void }) {
  const r = l.ringkasan
  const utama = filterAktif ? r.laba_kotor : (r.laba_bersih ?? 0)
  const maksSal = Math.max(...l.per_saluran.map((x) => x.omzet), 0)
  const maksMod = Math.max(...l.per_produk.map((x) => x.omzet), 0)
  const baris = filterAktif ? l.per_saluran.filter((x) => x.pesanan > 0) : l.per_saluran
  const stok = [...l.stok.produk].sort((a, b) => Number(b.menipis) - Number(a.menipis) || a.stok - b.stok)
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm md:p-5">
        <p className="text-sm font-medium text-stone-500">{filterAktif ? 'Laba kotor' : 'Laba bersih'}</p>
        <p className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${utama < 0 ? 'text-red-700' : 'text-ink'}`} data-testid="laba-utama">
          {rp(utama)}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {r.pesanan} pesanan · {r.pcs} pcs
        </p>
        <div className="mt-4 border-t border-stone-100 pt-2">
          <Rinci label="Omzet (total harga jual)" nilai={rp(r.omzet)} />
          <Rinci label="Potongan saluran" nilai={`−${rp(r.potongan)}`} nada="kurang" />
          <Rinci label="Modal barang terjual" nilai={`−${rpModal(r.hpp)}`} nada="kurang" />
          <Rinci label="Laba kotor" nilai={rp(r.laba_kotor)} tebal garis />
          {!filterAktif && r.pengeluaran != null && r.laba_bersih != null && (
            <>
              <Rinci label="Pengeluaran" nilai={`−${rp(r.pengeluaran)}`} nada="kurang" />
              <Rinci label="Laba bersih" nilai={rp(r.laba_bersih)} tebal garis nada={r.laba_bersih < 0 ? 'rugi' : 'untung'} />
            </>
          )}
        </div>
        {filterAktif && <p className="mt-2 text-xs text-stone-500">Pengeluaran tidak dibagi per saluran/model, jadi laba bersih hanya tampil tanpa filter.</p>}
        {!filterAktif && l.pengeluaran_per_kategori.length > 0 && (
          <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2">
            {l.pengeluaran_per_kategori.map((k) => (
              <div key={k.kategori_id} className="flex justify-between py-0.5 text-xs text-stone-500">
                <span>Pengeluaran · {k.kategori_nama}</span>
                <span className="tabular-nums">{rp(k.jumlah)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <Tabs<TabLaporan>
          items={[
            { key: 'saluran', label: 'Per saluran' },
            { key: 'model', label: 'Per model' },
            { key: 'stok', label: 'Stok' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'saluran' &&
          (baris.length === 0 ? (
            <p className="rounded-2xl border border-brand-100 bg-white px-4 py-6 text-center text-sm text-stone-500">Tidak ada penjualan di periode ini.</p>
          ) : (
            <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
              {baris.map((x) => (
                <div key={x.saluran_id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-ink">{x.saluran_nama}</span>
                    <span className="font-semibold text-ink tabular-nums">{rp(x.omzet)}</span>
                  </div>
                  <Batang nilai={x.omzet} maks={maksSal} />
                  <div className="mt-1.5 flex justify-between text-xs text-stone-500 tabular-nums">
                    <span>
                      {x.pcs} pcs · potongan {rp(x.potongan)}
                    </span>
                    <span className={`font-semibold ${nadaLaba(x.laba_kotor)}`}>Laba {rp(x.laba_kotor)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        {tab === 'model' &&
          (l.per_produk.length === 0 ? (
            <p className="rounded-2xl border border-brand-100 bg-white px-4 py-6 text-center text-sm text-stone-500">Tidak ada penjualan di periode ini.</p>
          ) : (
            <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
              {l.per_produk.map((x) => (
                <div key={x.produk_id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-ink">{x.produk_nama}</span>
                    <span className="shrink-0 font-semibold text-ink tabular-nums">{rp(x.omzet)}</span>
                  </div>
                  <Batang nilai={x.omzet} maks={maksMod} />
                  <div className="mt-1.5 flex justify-between text-xs text-stone-500 tabular-nums">
                    <span>{x.pcs} pcs</span>
                    <span className={`font-semibold ${nadaLaba(x.laba_kotor)}`}>Laba {rp(x.laba_kotor)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        {tab === 'stok' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-brand-100 bg-white p-4">
                <p className="text-xs text-stone-500">Nilai stok (stok × modal)</p>
                <p className="mt-1 text-lg font-bold text-ink tabular-nums" data-testid="nilai-stok">
                  {rp(l.stok.nilai_stok)}
                </p>
                <p className="text-xs text-stone-500 tabular-nums">{l.stok.total_pcs} pcs</p>
              </div>
              <div className="rounded-2xl border border-brand-100 bg-white p-4">
                <p className="text-xs text-stone-500">Stok menipis / habis</p>
                <p className="mt-1 text-lg font-bold text-amber-700 tabular-nums">{l.stok.menipis.length} model</p>
              </div>
            </div>
            {stok.length === 0 ? (
              <p className="rounded-2xl border border-brand-100 bg-white px-4 py-6 text-center text-sm text-stone-500">Belum ada stok tercatat.</p>
            ) : (
              <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
                {stok.map((p) => (
                  <Link key={p.produk_id} to={`/produk/${p.produk_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                    <Thumb nama={p.produk_nama} kecil />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {p.produk_nama}
                        {!p.aktif && <span className="ml-2 text-xs font-normal text-stone-500">nonaktif</span>}
                      </p>
                      <p className="text-xs text-stone-500 tabular-nums">Nilai {rp(p.nilai_stok)}</p>
                    </div>
                    <StokLencana stok={p.stok} batas={p.batas_stok_menipis} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function Laporan() {
  const [sp, setSp] = useSearchParams()
  const hariIni = hariIniWIB()
  const [periode, setPeriode] = useState<Periode>('bulan')
  const [dari, setDari] = useState(`${hariIni.slice(0, 7)}-01`)
  const [sampai, setSampai] = useState(hariIni)
  const [fSaluran, setFSaluran] = useState('')
  const [fModel, setFModel] = useState('')
  const [ekspor, setEkspor] = useState(false)
  const tab: TabLaporan = sp.get('tab') === 'model' ? 'model' : sp.get('tab') === 'stok' ? 'stok' : 'saluran'

  const saluran = useApi<Saluran[]>('/saluran')
  const produk = useApi<ProdukT2[]>('/produk')
  const [d, s] = rentangPeriode(periode, [dari, sampai], hariIni)
  const filterAktif = fSaluran !== '' || fModel !== ''
  const param = { dari: d, sampai: s, saluran_id: fSaluran, produk_id: fModel }
  const hasil = useApi<TLaporan>(`/laporan${qs(param)}`, { pertahankan: true })
  const rentangSalah = periode === 'rentang' && dari > sampai

  const unduh = [
    { href: `/api/ekspor/laporan.xlsx${qs(param)}`, judul: 'Laporan periode ini', sub: `${namaPeriode[periode]}${filterAktif ? ', sesuai filter' : ''}` },
    { href: '/api/ekspor/transaksi.xlsx', judul: 'Semua transaksi', sub: 'Penjualan per baris + pengeluaran' },
    { href: '/api/ekspor/produk.xlsx', judul: 'Daftar produk', sub: 'Stok, modal, harga per saluran' },
  ]

  return (
    <>
      <KepalaHalaman
        judul="Laporan"
        aksi={
          <Button variant="secondary" onClick={() => setEkspor(true)}>
            <Ikon d={IK.ekspor} /> <span className="hidden sm:inline">Ekspor </span>Excel
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            {PERIODE.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={periode === p}
                onClick={() => setPeriode(p)}
                className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${periode === p ? 'border-ink bg-ink text-white' : 'border-stone-200 bg-white text-stone-600'}`}
              >
                {namaPeriode[p]}
              </button>
            ))}
          </div>
          {periode === 'rentang' && (
            <div className="grid grid-cols-2 gap-2">
              <input type="date" aria-label="Dari tanggal" value={dari} max={sampai} onChange={(e) => e.target.value && setDari(e.target.value)} className={pilihCls} />
              <input type="date" aria-label="Sampai tanggal" value={sampai} min={dari} max={hariIni} onChange={(e) => e.target.value && setSampai(e.target.value)} className={pilihCls} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Filter saluran" value={fSaluran} onChange={(e) => setFSaluran(e.target.value)} className={pilihCls}>
            <option value="">Semua saluran</option>
            {(saluran.data ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.nama}
              </option>
            ))}
          </select>
          <select aria-label="Filter model" value={fModel} onChange={(e) => setFModel(e.target.value)} className={pilihCls}>
            <option value="">Semua model</option>
            {(produk.data ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rentangSalah ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          Tanggal “dari” tidak boleh setelah “sampai”.
        </p>
      ) : (
        <DataState hasil={hasil} baris={5}>
          {(l) =>
            !filterAktif && l.ringkasan.pesanan === 0 && !l.ringkasan.pengeluaran && l.stok.produk.length === 0 ? (
              <Kosong ikon={IK.laporan} judul="Belum ada data untuk dilaporkan" teks="Laporan laba muncul setelah ada penjualan atau pengeluaran yang dicatat." />
            ) : (
              <Isi l={l} filterAktif={filterAktif} tab={tab} setTab={(t) => setSp(t === 'saluran' ? {} : { tab: t }, { replace: true })} />
            )
          }
        </DataState>
      )}

      <Sheet open={ekspor} onClose={() => setEkspor(false)} title="Ekspor ke Excel">
        <p className="mb-3 text-sm text-stone-600">File .xlsx bisa dibuka di Excel dan disimpan sebagai cadangan.</p>
        <div className="-mx-4 divide-y divide-stone-100 border-y border-stone-100">
          {unduh.map((u) => (
            <a key={u.judul} href={u.href} download onClick={() => setEkspor(false)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700">XLS</div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{u.judul}</p>
                <p className="text-sm text-stone-500">{u.sub}</p>
              </div>
              <Ikon d={IK.ekspor} className="h-5 w-5 text-stone-400" />
            </a>
          ))}
        </div>
      </Sheet>
    </>
  )
}
