import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Sheet, Tabs } from '../../components/ui'
import { rp } from '../lib/hitung'
import { dalam, rentang, ringkas, type Periode } from '../lib/laporan'
import { useStore } from '../lib/store'
import { Gagal, IK, Ikon, Kerangka, KepalaHalaman, Kosong, Rinci, StokLencana, Thumb } from '../ui'

const PERIODE: { key: Periode; label: string }[] = [
  { key: 'hari', label: 'Hari ini' },
  { key: 'minggu', label: 'Minggu ini' },
  { key: 'bulan', label: 'Bulan ini' },
  { key: 'rentang', label: 'Pilih tanggal' },
]

const pilihCls = 'min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-ink focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none'

function Batang({ nilai, maks }: { nilai: number; maks: number }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${maks > 0 ? Math.max(2, (nilai / maks) * 100) : 0}%` }} />
    </div>
  )
}

export default function Laporan() {
  const st = useStore()
  const [sp, setSp] = useSearchParams()
  const [periode, setPeriode] = useState<Periode>('bulan')
  const [dari, setDari] = useState('2026-10-01')
  const [sampai, setSampai] = useState(st.hariIni)
  const [fSaluran, setFSaluran] = useState('semua')
  const [fModel, setFModel] = useState('semua')
  const [ekspor, setEkspor] = useState(false)
  const tab = (sp.get('tab') as 'saluran' | 'model' | 'stok') ?? 'saluran'

  const r0 = rentang(periode, st.hariIni, [dari, sampai])
  // Filter model: hanya baris produk itu yang dihitung (potongan dibagi proporsional omzet).
  const js = st.penjualan
    .filter((j) => dalam(j.tanggal, r0) && (fSaluran === 'semua' || j.saluranId === fSaluran))
    .map((j) => {
      if (fModel === 'semua') return j
      const baris = j.baris.filter((b) => b.produkId === fModel)
      const tot = j.baris.reduce((t, b) => t + b.qty * b.harga, 0)
      const sub = baris.reduce((t, b) => t + b.qty * b.harga, 0)
      return { ...j, baris, potongan: tot ? Math.round((j.potongan * sub) / tot) : 0 }
    })
    .filter((j) => j.baris.length)
  const filterAktif = fSaluran !== 'semua' || fModel !== 'semua'
  const bs = filterAktif ? [] : st.biaya.filter((b) => dalam(b.tanggal, r0))
  const r = ringkas(js, bs)

  const perSaluran = st.saluran
    .map((s) => {
      const x = ringkas(
        js.filter((j) => j.saluranId === s.id),
        [],
      )
      return { id: s.id, nama: s.nama, ...x }
    })
    .filter((x) => x.pesanan > 0 || fSaluran === 'semua')
  const perModel = st.produk
    .map((p) => {
      let qty = 0
      let omz = 0
      let laba = 0
      for (const j of js) {
        const tot = j.baris.reduce((t, b) => t + b.qty * b.harga, 0)
        for (const b of j.baris.filter((b) => b.produkId === p.id)) {
          const sub = b.qty * b.harga
          qty += b.qty
          omz += sub
          laba += sub - (tot ? (j.potongan * sub) / tot : 0) - b.qty * b.hpp
        }
      }
      return { p, qty, omz, laba }
    })
    .filter((x) => x.qty > 0)
    .sort((a, b) => b.omz - a.omz)
  const maksSal = Math.max(...perSaluran.map((x) => x.omzet), 0)
  const maksMod = Math.max(...perModel.map((x) => x.omz), 0)
  const nilaiStok = st.produk.reduce((t, p) => t + p.stok * p.modal, 0)
  const menipis = st.produk.filter((p) => p.stok <= p.batas)

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

      {st.mode === 'memuat' && <Kerangka baris={5} />}
      {st.mode === 'gagal' && <Gagal onUlang={() => st.setMode('normal')} />}
      {st.mode === 'kosong' && <Kosong ikon={IK.laporan} judul="Belum ada data untuk dilaporkan" teks="Laporan laba muncul setelah ada penjualan atau biaya yang dicatat." />}

      {st.mode === 'normal' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
          <div className="flex flex-col gap-4">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
              {PERIODE.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriode(p.key)}
                  className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${periode === p.key ? 'border-ink bg-ink text-white' : 'border-stone-200 bg-white text-stone-600'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {periode === 'rentang' && (
              <div className="grid grid-cols-2 gap-2">
                <input type="date" aria-label="Dari tanggal" value={dari} max={sampai} onChange={(e) => setDari(e.target.value)} className={pilihCls} />
                <input type="date" aria-label="Sampai tanggal" value={sampai} min={dari} max={st.hariIni} onChange={(e) => setSampai(e.target.value)} className={pilihCls} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Filter saluran" value={fSaluran} onChange={(e) => setFSaluran(e.target.value)} className={pilihCls}>
                <option value="semua">Semua saluran</option>
                {st.saluran.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
              <select aria-label="Filter model" value={fModel} onChange={(e) => setFModel(e.target.value)} className={pilihCls}>
                <option value="semua">Semua model</option>
                {st.produk.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>

            <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm md:p-5">
              <p className="text-sm font-medium text-stone-500">{filterAktif ? 'Laba kotor' : 'Laba bersih'}</p>
              <p className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${(filterAktif ? r.labaKotor : r.labaBersih) < 0 ? 'text-red-700' : 'text-ink'}`}>{rp(filterAktif ? r.labaKotor : r.labaBersih)}</p>
              <p className="mt-1 text-sm text-stone-500">
                {r.pesanan} pesanan · {r.pcs} pcs
              </p>
              <div className="mt-4 border-t border-stone-100 pt-2">
                <Rinci label="Omzet (total harga jual)" nilai={rp(r.omzet)} />
                <Rinci label="Potongan saluran" nilai={`−${rp(r.potongan)}`} nada="kurang" />
                <Rinci label="Modal barang terjual" nilai={`−${rp(r.hpp)}`} nada="kurang" />
                <Rinci label="Laba kotor" nilai={rp(r.labaKotor)} tebal garis />
                {!filterAktif && (
                  <>
                    <Rinci label="Biaya operasional" nilai={`−${rp(r.biaya)}`} nada="kurang" />
                    <Rinci label="Laba bersih" nilai={rp(r.labaBersih)} tebal garis nada={r.labaBersih < 0 ? 'rugi' : 'untung'} />
                  </>
                )}
              </div>
              {filterAktif && <p className="mt-2 text-xs text-stone-500">Biaya operasional tidak dibagi per saluran/model, jadi laba bersih hanya tampil tanpa filter.</p>}
            </section>
          </div>

          <div className="flex flex-col gap-3">
            <Tabs
              items={[
                { key: 'saluran', label: 'Per saluran' },
                { key: 'model', label: 'Per model' },
                { key: 'stok', label: 'Stok' },
              ]}
              value={tab}
              onChange={(t) => setSp(t === 'saluran' ? {} : { tab: t }, { replace: true })}
            />
            {tab === 'saluran' && (
              <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
                {perSaluran.map((x) => (
                  <div key={x.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-ink">{x.nama}</span>
                      <span className="font-semibold text-ink tabular-nums">{rp(x.omzet)}</span>
                    </div>
                    <Batang nilai={x.omzet} maks={maksSal} />
                    <div className="mt-1.5 flex justify-between text-xs text-stone-500 tabular-nums">
                      <span>
                        {x.pcs} pcs · potongan {rp(x.potongan)}
                      </span>
                      <span className="font-semibold text-emerald-700">Laba {rp(x.labaKotor)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === 'model' &&
              (perModel.length === 0 ? (
                <p className="rounded-2xl border border-brand-100 bg-white px-4 py-6 text-center text-sm text-stone-500">Tidak ada penjualan di periode ini.</p>
              ) : (
                <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
                  {perModel.map((x) => (
                    <div key={x.p.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium text-ink">{x.p.nama}</span>
                        <span className="shrink-0 font-semibold text-ink tabular-nums">{rp(x.omz)}</span>
                      </div>
                      <Batang nilai={x.omz} maks={maksMod} />
                      <div className="mt-1.5 flex justify-between text-xs text-stone-500 tabular-nums">
                        <span>{x.qty} pcs</span>
                        <span className="font-semibold text-emerald-700">Laba {rp(x.laba)}</span>
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
                    <p className="mt-1 text-lg font-bold text-ink tabular-nums">{rp(nilaiStok)}</p>
                  </div>
                  <div className="rounded-2xl border border-brand-100 bg-white p-4">
                    <p className="text-xs text-stone-500">Stok menipis / habis</p>
                    <p className="mt-1 text-lg font-bold text-amber-700 tabular-nums">{menipis.length} model</p>
                  </div>
                </div>
                <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
                  {[...st.produk]
                    .sort((a, b) => (a.stok <= a.batas ? 0 : 1) - (b.stok <= b.batas ? 0 : 1) || a.stok - b.stok)
                    .map((p) => (
                      <Link key={p.id} to={`/produk/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                        <Thumb nama={p.nama} kecil />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">{p.nama}</p>
                          <p className="text-xs text-stone-500 tabular-nums">Nilai {rp(p.stok * p.modal)}</p>
                        </div>
                        <StokLencana stok={p.stok} batas={p.batas} />
                      </Link>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Sheet open={ekspor} onClose={() => setEkspor(false)} title="Ekspor ke Excel">
        <p className="mb-3 text-sm text-stone-600">File .xlsx bisa dibuka di Excel dan disimpan sebagai cadangan.</p>
        <div className="-mx-4 divide-y divide-stone-100 border-y border-stone-100">
          {[
            ['Laporan periode ini', `${PERIODE.find((p) => p.key === periode)!.label}${filterAktif ? ', sesuai filter' : ''}`],
            ['Semua transaksi', 'Penjualan per baris + biaya'],
            ['Daftar produk', 'Stok, modal, harga per saluran'],
          ].map(([a, b]) => (
            <button key={a} type="button" onClick={() => setEkspor(false)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700">XLS</div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{a}</p>
                <p className="text-sm text-stone-500">{b}</p>
              </div>
              <Ikon d={IK.ekspor} className="h-5 w-5 text-stone-400" />
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}
