import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RupiahInput, Sheet, Tabs } from '../../../components/ui'
import type { Produk } from '../../lib/data'
import { CARA_TARGET, PEMBULATAN, rp, type CaraTarget, type Pembulatan } from '../../lib/hitung'
import { useStore } from '../../lib/store'
import { IK, Ikon, Pilihan, StokLencana, Thumb } from '../../ui'

/** State bersama kalkulator (Opsi A & B). */
export function useKalkulator() {
  const st = useStore()
  const [sp] = useSearchParams()
  const awalProduk = sp.get('produk') ?? st.produk[0]?.id ?? ''
  const awalSaluran = sp.get('saluran') ?? 'shopee'
  const [produkId, setProdukIdRaw] = useState(awalProduk)
  const [saluranId, setSaluranId] = useState(awalSaluran)
  const produk = st.produk.find((p) => p.id === produkId)
  const hs = produk?.harga[saluranId]
  const [cara, setCara] = useState<CaraTarget>(hs?.cara ?? 'persenJual')
  const [nilai, setNilai] = useState<number | null>(hs?.nilai ?? 30)
  const [bulat, setBulat] = useState<Pembulatan>(st.pembulatan)

  const setProdukId = (id: string) => setProdukIdRaw(id)
  return { st, produk, produkId, setProdukId, saluranId, setSaluranId, cara, setCara, nilai, setNilai, bulat, setBulat }
}
export type Kalk = ReturnType<typeof useKalkulator>

export function PilihProduk({ k }: { k: Kalk }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const p = k.produk
  const list = k.st.produk.filter((x) => x.nama.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 text-left shadow-sm hover:border-slate-300">
        {p ? <Thumb nama={p.nama} /> : <div className="h-12 w-12 rounded-xl bg-slate-100" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold text-slate-900">{p?.nama ?? 'Pilih produk'}</p>
          {p && (
            <p className="text-sm text-slate-500 tabular-nums">
              Modal <span className="font-semibold text-slate-700">{rp(p.modal)}</span>/pcs · stok {p.stok}
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand-700">Ganti</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Pilih produk">
        <div className="relative mb-3">
          <Ikon d={IK.cari} className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama produk"
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pr-3 pl-10 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
          />
        </div>
        <div className="-mx-4 divide-y divide-slate-100">
          {list.map((x: Produk) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                k.setProdukId(x.id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <Thumb nama={x.nama} kecil />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium text-slate-900">{x.nama}</p>
                <p className="text-sm text-slate-500 tabular-nums">Modal {rp(x.modal)}</p>
              </div>
              {x.id === k.produkId ? <Ikon d={IK.cek} className="h-5 w-5 text-brand-700" /> : <StokLencana stok={x.stok} batas={x.batas} />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}

export function InputTarget({ k }: { k: Kalk }) {
  const satuan = CARA_TARGET.find((c) => c.key === k.cara)!.satuan
  return (
    <div className="flex flex-col gap-2">
      <Tabs items={CARA_TARGET.map((c) => ({ key: c.key, label: c.label }))} value={k.cara} onChange={(c) => {
        k.setCara(c)
        k.setNilai(c === 'rupiah' ? 10000 : c === 'persenModal' ? 40 : 30)
      }} />
      {satuan === 'Rp' ? (
        <RupiahInput aria-label="Target untung (Rp per pcs)" value={k.nilai} onValueChange={k.setNilai} />
      ) : (
        <div className="relative">
          <input
            inputMode="decimal"
            aria-label={`Target untung (${satuan})`}
            value={k.nilai ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(',', '.').replace(/[^\d.]/g, '')
              k.setNilai(v === '' ? null : Math.min(999, Number(v)))
            }}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pr-10 pl-3 text-right text-base tabular-nums focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">%</span>
        </div>
      )}
      <p className="text-sm text-slate-500">{k.nilai != null ? `Untung ${teksTarget(k.cara, k.nilai).replace('untung ', '')}` : 'Isi target untung'}</p>
    </div>
  )
}

export function PilihPembulatan({ k }: { k: Kalk }) {
  return <Pilihan gulir label="Pembulatan" items={PEMBULATAN.map((b) => ({ key: b.key, label: b.label }))} value={k.bulat} onChange={k.setBulat} />
}

export function teksTarget(cara: CaraTarget, nilai: number) {
  if (cara === 'rupiah') return `untung ${rp(nilai)}/pcs`
  return `untung ${String(nilai).replace('.', ',')}% dari ${cara === 'persenJual' ? 'harga jual' : 'modal'}`
}

export function teksBulat(b: Pembulatan) {
  if (b === 'tanpa') return 'tanpa pembulatan'
  if (b === 'cantik') return 'dibulatkan ke harga cantik (…900)'
  return `dibulatkan ke atas kelipatan Rp${b === '1000' ? '1.000' : b}`
}
