// Rumus prototipe, mengikuti spek §5.2 (modal) dan §5.4 (harga). Programmer boleh memakai ulang.

export type JenisPotongan = 'persen' | 'perPesanan' | 'perPcs'
export interface KomponenPotongan {
  id: string
  nama: string
  jenis: JenisPotongan
  nilai: number // persen (mis. 8 = 8%) atau rupiah
  maks?: number | null // batas maksimal Rp untuk jenis persen
}

export type JenisModal = 'perPcs' | 'perKulakan' | 'persenBeli'
export interface KomponenModal {
  id: string
  nama: string
  jenis: JenisModal
  nilai: number
  aktif: boolean
}

export type CaraTarget = 'persenJual' | 'persenModal' | 'rupiah'
export type Pembulatan = 'tanpa' | '100' | '500' | '1000' | 'cantik'

export const PEMBULATAN: { key: Pembulatan; label: string; contoh: string }[] = [
  { key: 'tanpa', label: 'Tanpa', contoh: '43.750' },
  { key: '100', label: 'Rp100', contoh: '43.800' },
  { key: '500', label: 'Rp500', contoh: '44.000' },
  { key: '1000', label: 'Rp1.000', contoh: '44.000' },
  { key: 'cantik', label: 'Harga cantik', contoh: '43.900' },
]

export const CARA_TARGET: { key: CaraTarget; label: string; satuan: string }[] = [
  { key: 'persenJual', label: '% jual', satuan: '%' },
  { key: 'persenModal', label: '% modal', satuan: '%' },
  { key: 'rupiah', label: 'Rupiah', satuan: 'Rp' },
]

/** Pembulatan selalu ke atas (§5.4). */
export function bulatkan(h: number, mode: Pembulatan): number {
  const x = Math.ceil(h - 1e-9)
  switch (mode) {
    case 'tanpa':
      return x
    case '100':
      return Math.ceil(x / 100) * 100
    case '500':
      return Math.ceil(x / 500) * 500
    case '1000':
      return Math.ceil(x / 1000) * 1000
    case 'cantik':
      return Math.ceil((x + 100) / 1000) * 1000 - 100
  }
}

/** Nilai rupiah satu komponen potongan untuk harga h per pcs (kalkulator: 1 pcs/pesanan, K-12). */
export function nilaiPotongan(k: KomponenPotongan, h: number, qty = 1): number {
  if (k.jenis === 'persen') {
    const v = (h * qty * k.nilai) / 100
    return k.maks ? Math.min(v, k.maks) : v
  }
  if (k.jenis === 'perPcs') return k.nilai * qty
  return k.nilai // per pesanan
}

export function totalPotongan(list: KomponenPotongan[], h: number, qty = 1): number {
  return list.reduce((s, k) => s + nilaiPotongan(k, h, qty), 0)
}

interface PF {
  p: number
  f: number
}

function pf(list: KomponenPotongan[], dibatasi: Set<string>): PF {
  let p = 0
  let f = 0
  for (const k of list) {
    if (k.jenis === 'persen') {
      if (dibatasi.has(k.id)) f += k.maks ?? 0
      else p += k.nilai / 100
    } else f += k.nilai
  }
  return { p, f }
}

/** Hitung harga mentah (sebelum dibulatkan); null bila p + m >= 100%. */
function hargaMentah(M: number, list: KomponenPotongan[], cara: CaraTarget | 'impas', nilai: number): number | null {
  const dibatasi = new Set<string>()
  for (let i = 0; i <= list.length; i++) {
    const { p, f } = pf(list, dibatasi)
    let h: number
    if (cara === 'impas') {
      if (p >= 1) return null
      h = (M + f) / (1 - p)
    } else if (cara === 'persenJual') {
      const m = nilai / 100
      if (p + m >= 1) return null
      h = (M + f) / (1 - p - m)
    } else if (cara === 'persenModal') {
      if (p >= 1) return null
      h = (M + f + (nilai / 100) * M) / (1 - p)
    } else {
      if (p >= 1) return null
      h = (M + f + nilai) / (1 - p)
    }
    // Potongan % yang melewati batas maksimal dihitung ulang sebagai rupiah tetap.
    const baru = list.filter((k) => k.jenis === 'persen' && k.maks && !dibatasi.has(k.id) && (h * k.nilai) / 100 > k.maks)
    if (baru.length === 0) return h
    baru.forEach((k) => dibatasi.add(k.id))
  }
  return null
}

export interface Rincian {
  harga: number
  modal: number
  potongan: { nama: string; nilai: number }[]
  totalPotongan: number
  untung: number
  persenJual: number
  persenModal: number
}

export function rincian(M: number, list: KomponenPotongan[], harga: number): Rincian {
  const potongan = list.map((k) => ({ nama: k.nama, nilai: Math.round(nilaiPotongan(k, harga)) }))
  const tp = potongan.reduce((s, x) => s + x.nilai, 0)
  const untung = harga - M - tp
  return {
    harga,
    modal: M,
    potongan,
    totalPotongan: tp,
    untung,
    persenJual: harga > 0 ? (untung / harga) * 100 : 0,
    persenModal: M > 0 ? (untung / M) * 100 : 0,
  }
}

export interface HasilHarga {
  ok: true
  mentah: number
  saran: number
  minimal: number
  rincian: Rincian
}
export interface HasilGagal {
  ok: false
  pesan: string
}

export function hitungHarga(M: number, list: KomponenPotongan[], cara: CaraTarget, nilai: number, bulat: Pembulatan): HasilHarga | HasilGagal {
  const p = list.filter((k) => k.jenis === 'persen').reduce((s, k) => s + k.nilai, 0)
  const h = hargaMentah(M, list, cara, nilai)
  if (h == null) {
    return {
      ok: false,
      pesan:
        cara === 'persenJual'
          ? `Potongan saluran ${fmtPersen(p)} + target ${fmtPersen(nilai)} = ${fmtPersen(p + nilai)}. Jumlahnya harus di bawah 100%, turunkan target untung.`
          : 'Total potongan saluran 100% atau lebih. Periksa pengaturan saluran.',
    }
  }
  const minimal = Math.ceil(hargaMentah(M, list, 'impas', 0) ?? 0)
  const saran = bulatkan(h, bulat)
  return { ok: true, mentah: Math.ceil(h - 1e-9), saran, minimal, rincian: rincian(M, list, saran) }
}

export function hargaMinimal(M: number, list: KomponenPotongan[]): number {
  return Math.ceil(hargaMentah(M, list, 'impas', 0) ?? 0)
}

/** Apakah untung di harga h memenuhi target. */
export function memenuhiTarget(M: number, list: KomponenPotongan[], h: number, cara: CaraTarget, nilai: number): boolean {
  const r = rincian(M, list, h)
  if (cara === 'persenJual') return r.persenJual + 1e-6 >= nilai
  if (cara === 'persenModal') return r.persenModal + 1e-6 >= nilai
  return r.untung >= nilai
}

/** Modal/pcs satu kulakan (§5.2). */
export function modalKulakan(hargaBeli: number, qty: number, komponen: { jenis: JenisModal; nilai: number }[]): number {
  if (qty <= 0) return hargaBeli
  return komponen.reduce((s, k) => {
    if (k.jenis === 'perPcs') return s + k.nilai
    if (k.jenis === 'perKulakan') return s + k.nilai / qty
    return s + (k.nilai / 100) * hargaBeli
  }, hargaBeli)
}

export function nilaiKomponenModalPerPcs(k: { jenis: JenisModal; nilai: number }, hargaBeli: number, qty: number): number {
  if (k.jenis === 'perPcs') return k.nilai
  if (k.jenis === 'perKulakan') return qty > 0 ? k.nilai / qty : 0
  return (k.nilai / 100) * hargaBeli
}

/** Rata-rata tertimbang (K-8). */
export function modalRataRata(stokLama: number, modalLama: number, qtyMasuk: number, modalBaru: number): number {
  if (stokLama <= 0) return modalBaru
  return (stokLama * modalLama + qtyMasuk * modalBaru) / (stokLama + qtyMasuk)
}

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
export const rp = (n: number) => (Math.round(n) < 0 ? `−Rp${nf.format(Math.abs(Math.round(n)))}` : `Rp${nf.format(Math.round(n))}`)
export const angka = (n: number) => nf.format(Math.round(n))
export const fmtPersen = (n: number) => `${nf1.format(n)}%`.replace('-', '−')

export function labelPotongan(k: KomponenPotongan): string {
  if (k.jenis === 'persen') return `${fmtPersen(k.nilai)} dari harga jual${k.maks ? ` · maks ${rp(k.maks)}` : ''}`
  if (k.jenis === 'perPesanan') return `${rp(k.nilai)} per pesanan`
  return `${rp(k.nilai)} per pcs`
}

export function labelModal(k: { jenis: JenisModal; nilai: number }): string {
  if (k.jenis === 'perPcs') return `${rp(k.nilai)} per pcs`
  if (k.jenis === 'perKulakan') return `${rp(k.nilai)} per kulakan`
  return `${fmtPersen(k.nilai)} dari harga beli`
}
