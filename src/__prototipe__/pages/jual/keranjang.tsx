import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RupiahInput } from '../../../components/ui'
import { potonganPesanan, rincianPotonganPesanan, type Produk, type Saluran } from '../../lib/data'
import { rp } from '../../lib/hitung'
import { useStore } from '../../lib/store'
import { IK, Ikon, Rinci } from '../../ui'

export interface Item {
  produkId: string
  qty: number
  harga: number | null
  hargaDiubah: boolean
}

/** State bersama layar catat penjualan (Opsi A & B). */
export function useKeranjang() {
  const st = useStore()
  const nav = useNavigate()
  const [saluranId, setSaluranIdRaw] = useState(st.saluranTerakhir)
  const [tanggal, setTanggal] = useState(st.hariIni)
  const [items, setItems] = useState<Item[]>([])
  const [potonganManual, setPotonganManual] = useState<number | null>(null)
  const [errSimpan, setErrSimpan] = useState<Record<string, string>>({})

  const saluran = st.saluran.find((s) => s.id === saluranId)!
  const produkMap = useMemo(() => new Map(st.produk.map((p) => [p.id, p])), [st.produk])
  const hargaDari = (p: Produk, sid: string) => p.harga[sid]?.harga ?? null

  const setSaluranId = (sid: string) => {
    setSaluranIdRaw(sid)
    setPotonganManual(null)
    setItems((xs) => xs.map((x) => (x.hargaDiubah ? x : { ...x, harga: hargaDari(produkMap.get(x.produkId)!, sid) })))
  }

  const qtyDari = (pid: string) => items.find((x) => x.produkId === pid)?.qty ?? 0

  const setQty = (pid: string, qty: number) => {
    setErrSimpan({})
    setItems((xs) => {
      const ada = xs.find((x) => x.produkId === pid)
      if (qty <= 0) return xs.filter((x) => x.produkId !== pid)
      if (ada) return xs.map((x) => (x.produkId === pid ? { ...x, qty } : x))
      return [...xs, { produkId: pid, qty, harga: hargaDari(produkMap.get(pid)!, saluranId), hargaDiubah: false }]
    })
  }

  const setHarga = (pid: string, harga: number | null) => setItems((xs) => xs.map((x) => (x.produkId === pid ? { ...x, harga, hargaDiubah: true } : x)))

  const baris = items.map((x) => ({ qty: x.qty, harga: x.harga ?? 0 }))
  const total = baris.reduce((t, b) => t + b.qty * b.harga, 0)
  const totalPcs = items.reduce((t, x) => t + x.qty, 0)
  const potonganAuto = items.length ? potonganPesanan(saluran, baris) : 0
  const potongan = potonganManual ?? potonganAuto
  const hppTotal = items.reduce((t, x) => t + x.qty * produkMap.get(x.produkId)!.modal, 0)
  const diterima = total - potongan
  const untung = diterima - hppTotal

  const errStok: Record<string, string> = {}
  for (const x of items) {
    const p = produkMap.get(x.produkId)!
    if (x.qty > p.stok) errStok[x.produkId] = p.stok === 0 ? 'Stok habis' : `Stok tersisa ${p.stok}`
  }
  const err = { ...errSimpan, ...errStok }
  const hargaKosong = items.some((x) => !x.harga)
  const bisaSimpan = items.length > 0 && Object.keys(err).length === 0 && !hargaKosong

  const simpan = () => {
    const e = st.simpanPenjualan({ tanggal, saluranId, baris: items.map((x) => ({ produkId: x.produkId, qty: x.qty, harga: x.harga ?? 0 })), potongan })
    if (e) {
      setErrSimpan(e)
      return
    }
    const sisa = items.map((x) => {
      const p = produkMap.get(x.produkId)!
      return `${p.nama.split(' ').slice(0, 2).join(' ')} sisa ${p.stok - x.qty}`
    })
    st.tampilkan(`Tersimpan. ${sisa.join(', ')}.`, { label: 'Catat lagi', to: '/jual' })
    nav(-1)
  }

  return {
    st,
    saluran,
    saluranId,
    setSaluranId,
    tanggal,
    setTanggal,
    items,
    produkMap,
    qtyDari,
    setQty,
    setHarga,
    total,
    totalPcs,
    potongan,
    potonganAuto,
    potonganManual,
    setPotonganManual,
    hppTotal,
    diterima,
    untung,
    err,
    hargaKosong,
    bisaSimpan,
    simpan,
  }
}

export type Keranjang = ReturnType<typeof useKeranjang>

/** Ringkasan uang: total, potongan saluran (bisa diubah, mis. ada voucher), diterima, untung. */
export function RingkasanUang({ k, rinciTerbuka = false }: { k: Keranjang; rinciTerbuka?: boolean }) {
  const [ubah, setUbah] = useState(false)
  const [buka, setBuka] = useState(rinciTerbuka)
  const tanpaPotongan = k.saluran.potongan.length === 0
  const rincianPot = rincianPotonganPesanan(
    k.saluran,
    k.items.map((x) => ({ qty: x.qty, harga: x.harga ?? 0 })),
  )
  return (
    <div>
      <Rinci label="Total harga" nilai={rp(k.total)} />
      {!tanpaPotongan && (
        <>
          <div className="flex items-center justify-between gap-3 py-1.5">
            <button type="button" onClick={() => setBuka(!buka)} className="flex min-w-0 items-center gap-1 text-left text-sm text-slate-600" aria-expanded={buka}>
              Potongan {k.saluran.nama}
              {k.potonganManual != null && <span className="text-xs text-brand-700">(diubah)</span>}
              <Ikon d={IK.kanan} className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${buka ? 'rotate-90' : ''}`} />
            </button>
            <span className="text-sm text-slate-600 tabular-nums">−{rp(k.potongan)}</span>
          </div>
          {buka && (
            <div className="mb-1 rounded-xl bg-slate-50 px-3 py-2">
              {k.potonganManual == null ? (
                rincianPot.map((x) => (
                  <div key={x.nama} className="flex justify-between py-0.5 text-xs text-slate-500">
                    <span>{x.nama}</span>
                    <span className="tabular-nums">−{rp(x.nilai)}</span>
                  </div>
                ))
              ) : (
                <p className="py-0.5 text-xs text-slate-500">Otomatis: −{rp(k.potonganAuto)}</p>
              )}
              {ubah ? (
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <RupiahInput label="Potongan sebenarnya" value={k.potonganManual ?? k.potonganAuto} onValueChange={(v) => k.setPotonganManual(v ?? 0)} />
                  </div>
                  <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-brand-700" onClick={() => setUbah(false)}>
                    Selesai
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex gap-3">
                  <button type="button" className="min-h-9 text-sm font-semibold text-brand-700" onClick={() => setUbah(true)}>
                    Ubah potongan
                  </button>
                  {k.potonganManual != null && (
                    <button type="button" className="min-h-9 text-sm font-semibold text-slate-500" onClick={() => k.setPotonganManual(null)}>
                      Kembalikan otomatis
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <Rinci label="Uang diterima" nilai={rp(k.diterima)} tebal garis />
      <Rinci label="Untung (setelah modal)" nilai={rp(k.untung)} nada={k.untung < 0 ? 'rugi' : 'untung'} />
    </div>
  )
}

export function PilihSaluran({ k, kompak }: { k: Keranjang; kompak?: boolean }) {
  const aktif = k.st.saluran.filter((s) => s.aktif)
  return (
    <div role="radiogroup" aria-label="Saluran" className={kompak ? '-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}>
      {aktif.map((s: Saluran) => {
        const on = s.id === k.saluranId
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => k.setSaluranId(s.id)}
            className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
              on ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-700'
            } ${kompak ? '' : 'min-h-12 text-base'}`}
          >
            {s.nama}
          </button>
        )
      })}
    </div>
  )
}

export function PilihTanggal({ k }: { k: Keranjang }) {
  const hariIni = k.tanggal === k.st.hariIni
  return (
    <label className="relative flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
      <Ikon d={IK.kalender} className="h-5 w-5 text-slate-500" />
      <span className="flex-1 font-medium">{hariIni ? 'Hari ini' : new Date(k.tanggal + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
      <span className="text-sm font-semibold text-brand-700">Ubah</span>
      <input type="date" aria-label="Tanggal penjualan" value={k.tanggal} max={k.st.hariIni} onChange={(e) => e.target.value && k.setTanggal(e.target.value)} className="absolute inset-0 opacity-0" />
    </label>
  )
}
