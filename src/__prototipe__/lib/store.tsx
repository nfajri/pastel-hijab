import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CaraTarget, KomponenModal, Pembulatan } from './hitung'
import { hargaMinimal, memenuhiTarget } from './hitung'
import {
  PENGELUARAN,
  HARI_INI,
  KATEGORI_PENGELUARAN,
  KOMPONEN_MODAL,
  MASUK,
  PEMBULATAN_BAWAAN,
  PENJUALAN,
  PENYESUAIAN,
  PRODUK,
  SALURAN,
  type BarangMasuk,
  type Pengeluaran,
  type BarisJual,
  type Penjualan,
  type Penyesuaian,
  type Produk,
  type Saluran,
} from './data'

/** Keadaan data untuk mendemokan state kosong / memuat / gagal (khusus prototipe). */
export type ModeData = 'normal' | 'kosong' | 'memuat' | 'gagal'

interface Toast {
  id: number
  teks: string
  aksi?: { label: string; to: string }
}

interface State {
  produk: Produk[]
  saluran: Saluran[]
  komponenModal: KomponenModal[]
  penjualan: Penjualan[]
  pengeluaran: Pengeluaran[]
  masuk: BarangMasuk[]
  penyesuaian: Penyesuaian[]
  kategoriPengeluaran: string[]
  pembulatan: Pembulatan
  saluranTerakhir: string
}

const awal = (): State => ({
  produk: PRODUK.map((p) => ({ ...p, harga: { ...p.harga } })),
  saluran: SALURAN.map((s) => ({ ...s, potongan: s.potongan.map((k) => ({ ...k })) })),
  komponenModal: KOMPONEN_MODAL.map((k) => ({ ...k })),
  penjualan: PENJUALAN,
  pengeluaran: PENGELUARAN,
  masuk: MASUK,
  penyesuaian: PENYESUAIAN,
  kategoriPengeluaran: KATEGORI_PENGELUARAN,
  pembulatan: PEMBULATAN_BAWAAN,
  saluranTerakhir: 'shopee',
})

const kosong = (): State => ({ ...awal(), produk: [], penjualan: [], pengeluaran: [], masuk: [], penyesuaian: [] })

function useStoreValue() {
  const [s, set] = useState<State>(awal)
  const [mode, setModeRaw] = useState<ModeData>('normal')
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const tampilkan = useCallback((teks: string, aksi?: Toast['aksi']) => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), teks, aksi })
    timer.current = window.setTimeout(() => setToast(null), 4000)
  }, [])

  const setMode = useCallback((m: ModeData) => {
    setModeRaw(m)
    set(m === 'kosong' ? kosong() : awal())
  }, [])

  /** K-11: tolak bila qty melebihi stok. Mengembalikan pesan error per produk, atau null bila tersimpan. */
  const simpanPenjualan = useCallback(
    (data: { tanggal: string; saluranId: string; baris: { produkId: string; qty: number; harga: number }[]; potongan: number }): Record<string, string> | null => {
      const err: Record<string, string> = {}
      for (const b of data.baris) {
        const p = s.produk.find((x) => x.id === b.produkId)!
        if (b.qty > p.stok) err[b.produkId] = p.stok === 0 ? 'Stok habis' : `Stok tersisa ${p.stok}`
      }
      if (Object.keys(err).length) return err
      const baris: BarisJual[] = data.baris.map((b) => {
        const p = s.produk.find((x) => x.id === b.produkId)!
        return { ...b, nama: p.nama, hpp: p.modal }
      })
      const id = `J-${String(1041 + s.penjualan.length - PENJUALAN.length).padStart(4, '0')}`
      const jam = new Date().toTimeString().slice(0, 5).replace(':', '.')
      set((st) => ({
        ...st,
        saluranTerakhir: data.saluranId,
        penjualan: [{ id, tanggal: data.tanggal, jam, saluranId: data.saluranId, baris, potongan: data.potongan }, ...st.penjualan],
        produk: st.produk.map((p) => {
          const q = data.baris.filter((b) => b.produkId === p.id).reduce((t, b) => t + b.qty, 0)
          return q ? { ...p, stok: p.stok - q } : p
        }),
      }))
      return null
    },
    [s.produk, s.penjualan.length],
  )

  const hapusPenjualan = useCallback((id: string) => {
    set((st) => {
      const j = st.penjualan.find((x) => x.id === id)
      if (!j) return st
      return {
        ...st,
        penjualan: st.penjualan.filter((x) => x.id !== id),
        produk: st.produk.map((p) => {
          const q = j.baris.filter((b) => b.produkId === p.id).reduce((t, b) => t + b.qty, 0)
          return q ? { ...p, stok: p.stok + q } : p
        }),
      }
    })
  }, [])

  const pakaiHarga = useCallback((produkId: string, saluranId: string, harga: number, cara: CaraTarget, nilai: number) => {
    set((st) => ({
      ...st,
      produk: st.produk.map((p) => (p.id === produkId ? { ...p, harga: { ...p.harga, [saluranId]: { harga, cara, nilai } } } : p)),
    }))
  }, [])

  const simpanMasuk = useCallback((m: Omit<BarangMasuk, 'id'>, modalBaru: number) => {
    set((st) => ({
      ...st,
      masuk: [{ ...m, id: `M-${st.masuk.length + 10}` }, ...st.masuk],
      produk: st.produk.map((p) => (p.id === m.produkId ? { ...p, stok: p.stok + m.qty, modal: Math.round(modalBaru) } : p)),
    }))
  }, [])

  const simpanPenyesuaian = useCallback((x: Omit<Penyesuaian, 'id'>) => {
    set((st) => ({
      ...st,
      penyesuaian: [{ ...x, id: `S-${st.penyesuaian.length + 10}` }, ...st.penyesuaian],
      produk: st.produk.map((p) => (p.id === x.produkId ? { ...p, stok: p.stok + x.perubahan } : p)),
    }))
  }, [])

  const simpanPengeluaran = useCallback((b: Omit<Pengeluaran, 'id'>) => {
    set((st) => ({ ...st, pengeluaran: [{ ...b, id: `B-${st.pengeluaran.length + 10}` }, ...st.pengeluaran] }))
  }, [])

  const simpanProduk = useCallback((p: Produk) => {
    set((st) => {
      const ada = st.produk.some((x) => x.id === p.id)
      return { ...st, produk: ada ? st.produk.map((x) => (x.id === p.id ? p : x)) : [p, ...st.produk] }
    })
  }, [])

  const update = useCallback(<K extends keyof State>(key: K, val: State[K]) => set((st) => ({ ...st, [key]: val })), [])

  /** Produk-saluran yang untungnya di bawah target (§5.4: tanda setelah modal naik). */
  const hargaBermasalah = useMemo(() => {
    const out: { produk: Produk; saluran: Saluran; harga: number; minimal: number }[] = []
    for (const p of s.produk) {
      for (const sal of s.saluran) {
        const hs = p.harga[sal.id]
        if (!hs || !sal.aktif) continue
        if (!memenuhiTarget(p.modal, sal.potongan, hs.harga, hs.cara, hs.nilai)) {
          out.push({ produk: p, saluran: sal, harga: hs.harga, minimal: hargaMinimal(p.modal, sal.potongan) })
        }
      }
    }
    return out
  }, [s.produk, s.saluran])

  return {
    ...s,
    hariIni: HARI_INI,
    mode,
    setMode,
    toast,
    tampilkan,
    tutupToast: () => setToast(null),
    simpanPenjualan,
    hapusPenjualan,
    pakaiHarga,
    simpanMasuk,
    simpanPenyesuaian,
    simpanPengeluaran,
    simpanProduk,
    update,
    hargaBermasalah,
    reset: () => set(awal()),
  }
}

type Store = ReturnType<typeof useStoreValue>
const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreValue()
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const v = useContext(Ctx)
  if (!v) throw new Error('StoreProvider belum dipasang')
  return v
}

export function namaSaluran(list: Saluran[], id: string): string {
  return list.find((s) => s.id === id)?.nama ?? id
}
