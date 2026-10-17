import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, pesanError } from '../../lib/api'
import type { Saluran } from '../../lib/api-types'
import type { Penjualan, PenjualanInput, ProdukT2, StokKurang } from '../../lib/api-tahap2'
import { hariIniWIB } from '../../lib/format'
import { kembaliAtau } from '../../lib/kembali'
import { useToast } from '../../lib/toast'
import { useKirim } from '../../lib/useKirim'

export interface Item {
  produkId: number
  qty: number
  harga: number | null
  hargaDiubah: boolean
}

interface Pratinjau {
  hasil: Penjualan | null
  galat: string
  stokKurang: StokKurang[]
  memeriksa: boolean
}

const AWAL: Pratinjau = { hasil: null, galat: '', stokKurang: [], memeriksa: false }

/** Hitungan & cek stok dari server (POST /penjualan/hitung), tanpa menyimpan. Ditunda 250 ms supaya tidak menembak tiap ketukan. */
function usePratinjau(body: PenjualanInput | null): Pratinjau {
  const [s, setS] = useState<Pratinjau>(AWAL)
  const kunci = body ? JSON.stringify(body) : ''
  useEffect(() => {
    if (!kunci) {
      setS(AWAL)
      return
    }
    setS((x) => ({ ...x, memeriksa: true }))
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      api<Penjualan>('/penjualan/hitung', { method: 'POST', body: JSON.parse(kunci), signal: ac.signal })
        .then((hasil) => setS({ hasil, galat: '', stokKurang: [], memeriksa: false }))
        .catch((e) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          const stokKurang = e instanceof ApiError && e.status === 409 ? ((e.data as { stok_kurang?: StokKurang[] } | null)?.stok_kurang ?? []) : []
          setS((x) => ({ hasil: x.hasil, galat: pesanError(e), stokKurang, memeriksa: false }))
        })
    }, 250)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [kunci])
  return s
}

export interface DataJual {
  produk: ProdukT2[]
  muatProduk: () => void
  saluran: Saluran[]
  saluranAwal: number
  /** Mode ubah: penjualan yang diedit. */
  asal?: Penjualan
}

const namaPendek = (n: string) => n.split(' ').slice(0, 2).join(' ')

/** State bersama layar catat penjualan (baru maupun ubah). Semua angka uang berasal dari server. */
export function useKeranjang({ produk, muatProduk, saluran, saluranAwal, asal }: DataJual) {
  const nav = useNavigate()
  const { tampilkan } = useToast()
  const { sibuk, galat: galatSimpan, setGalat, kirim } = useKirim()
  const hariIni = hariIniWIB()

  const [saluranId, setSaluranIdRaw] = useState(saluranAwal)
  const [tanggal, setTanggal] = useState(asal?.tanggal ?? hariIni)
  const [items, setItems] = useState<Item[]>(() => asal?.baris.map((b) => ({ produkId: b.produk_id, qty: b.qty, harga: b.harga, hargaDiubah: true })) ?? [])
  const [potonganManual, setPotonganManual] = useState<number | null>(asal?.potongan_diubah ? asal.potongan : null)

  const produkMap = useMemo(() => new Map(produk.map((p) => [p.id, p])), [produk])
  const qtyLama = (pid: number) => asal?.baris.find((b) => b.produk_id === pid)?.qty ?? 0
  /** Stok yang boleh dipakai pesanan ini (saat ubah: stok sekarang + qty versi lama). */
  const tersedia = (pid: number) => (produkMap.get(pid)?.stok ?? 0) + qtyLama(pid)
  const sal = saluran.find((s) => s.id === saluranId) ?? saluran[0]
  const hargaDi = (pid: number, sid: number) => produkMap.get(pid)?.harga.find((h) => h.saluran_id === sid)?.harga ?? null

  const setSaluranId = (sid: number) => {
    setSaluranIdRaw(sid)
    setPotonganManual(null)
    setItems((xs) => xs.map((x) => (x.hargaDiubah ? x : { ...x, harga: hargaDi(x.produkId, sid) })))
  }

  const qtyDari = (pid: number) => items.find((x) => x.produkId === pid)?.qty ?? 0
  const setQty = (pid: number, qty: number) => {
    setGalat('')
    setItems((xs) => {
      if (qty <= 0) return xs.filter((x) => x.produkId !== pid)
      if (xs.some((x) => x.produkId === pid)) return xs.map((x) => (x.produkId === pid ? { ...x, qty } : x))
      return [...xs, { produkId: pid, qty, harga: hargaDi(pid, saluranId), hargaDiubah: false }]
    })
  }
  const setHarga = (pid: number, harga: number | null) => setItems((xs) => xs.map((x) => (x.produkId === pid ? { ...x, harga, hargaDiubah: true } : x)))

  const hargaKosong = items.some((x) => !x.harga)
  const total = items.reduce((t, x) => t + x.qty * (x.harga ?? 0), 0)
  const totalPcs = items.reduce((t, x) => t + x.qty, 0)

  const baris = items.map((x) => ({ produk_id: x.produkId, qty: x.qty, harga: x.harga ?? 0 }))
  const dasar: PenjualanInput = { tanggal, saluran_id: saluranId, baris, ...(potonganManual != null ? { potongan: potonganManual } : {}) }
  const pratinjau = usePratinjau(items.length > 0 && !hargaKosong && sal ? { ...dasar, ...(asal ? { id: asal.id } : {}) } : null)

  // Stok berubah di perangkat lain → muat ulang daftar supaya angka stok di layar ikut baru.
  const [stokSimpan, setStokSimpan] = useState<StokKurang[]>([])
  const kurang = pratinjau.stokKurang.length ? pratinjau.stokKurang : stokSimpan
  const err: Record<number, string> = {}
  for (const k of kurang) err[k.produk_id] = k.pesan
  const adaErr = kurang.length > 0
  const muatRef = useRef(muatProduk)
  muatRef.current = muatProduk
  const jumlahKurang = pratinjau.stokKurang.length
  useEffect(() => {
    if (jumlahKurang > 0) muatRef.current()
  }, [jumlahKurang])
  useEffect(() => setStokSimpan([]), [pratinjau.hasil, items, saluranId, tanggal])

  const bisaSimpan = items.length > 0 && !hargaKosong && !adaErr && !pratinjau.memeriksa && pratinjau.hasil !== null && pratinjau.galat === '' && !sibuk

  const simpan = async () => {
    if (!bisaSimpan) return
    const r = await kirim(async () => {
      try {
        return asal ? await api<Penjualan>(`/penjualan/${asal.id}`, { method: 'PUT', body: dasar }) : await api<Penjualan>('/penjualan', { method: 'POST', body: dasar })
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setStokSimpan((e.data as { stok_kurang?: StokKurang[] } | null)?.stok_kurang ?? [])
          muatProduk()
        }
        throw e
      }
    })
    if (!r.ok) return
    const sisa = await Promise.all(
      r.hasil.baris.map((b) =>
        api<ProdukT2>(`/produk/${b.produk_id}`)
          .then((p) => `${namaPendek(b.produk_nama)} sisa ${p.stok}`)
          .catch(() => namaPendek(b.produk_nama)),
      ),
    )
    tampilkan(asal ? `Penjualan diperbarui. ${sisa.join(', ')}.` : `Tersimpan. ${sisa.join(', ')}.`, asal ? undefined : { label: 'Catat lagi', to: '/jual' })
    if (asal) nav(`/transaksi/${asal.id}`, { replace: true })
    else kembaliAtau(nav, '/')
  }

  return {
    produk,
    produkMap,
    saluran,
    sal,
    saluranId,
    setSaluranId,
    tanggal,
    setTanggal,
    hariIni,
    items,
    qtyDari,
    setQty,
    setHarga,
    tersedia,
    hargaDi,
    total,
    totalPcs,
    potonganManual,
    setPotonganManual,
    pratinjau,
    err,
    adaErr,
    hargaKosong,
    bisaSimpan,
    sibuk,
    galat: pratinjau.galat && !pratinjau.stokKurang.length ? pratinjau.galat : galatSimpan,
    simpan,
    edit: !!asal,
  }
}

export type Keranjang = ReturnType<typeof useKeranjang>
