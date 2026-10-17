// Format tampilan. Rupiah bulat dari hitung.ts (rp); modal boleh pecahan 2 desimal.
import { fmtPersen, rp } from './hitung'
import type { JenisModal, JenisPotongan, Potongan } from './api-types'

export { fmtPersen, rp }

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Modal/pcs: tampilkan 2 desimal hanya bila memang pecahan (Rp24.400 / Rp21.333,33). */
export function rpModal(n: number): string {
  const bulat = Math.abs(n - Math.round(n)) < 0.005
  return bulat ? rp(n) : `${n < 0 ? '−' : ''}Rp${nf2.format(Math.abs(n))}`
}

export const angka = (n: number) => nf.format(n)

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export function tglPendek(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${BULAN[m - 1]}`
}

/** Tanggal hari ini menurut WIB, "YYYY-MM-DD" (sama dengan default server). */
export function hariIniWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export const LABEL_JENIS_MODAL: Record<JenisModal, string> = {
  per_pcs: 'Rp/pcs',
  per_kulakan: 'Rp/kulakan',
  persen_harga_beli: '% beli',
}

export function labelModal(k: { jenis: JenisModal; nilai: number }): string {
  if (k.jenis === 'per_pcs') return `${rp(k.nilai)} per pcs`
  if (k.jenis === 'per_kulakan') return `${rp(k.nilai)} per kulakan`
  return `${fmtPersen(k.nilai)} dari harga beli`
}

export const LABEL_JENIS_POTONGAN: Record<JenisPotongan, string> = {
  persen: '% harga jual',
  per_pesanan: 'Rp/pesanan',
  per_pcs: 'Rp/pcs',
}

export function labelPotongan(k: Pick<Potongan, 'jenis' | 'nilai' | 'maks_rp'>): string {
  if (k.jenis === 'persen') return `${fmtPersen(k.nilai)} dari harga jual${k.maks_rp ? ` · maks ${rp(k.maks_rp)}` : ''}`
  if (k.jenis === 'per_pesanan') return `${rp(k.nilai)} per pesanan`
  return `${rp(k.nilai)} per pcs`
}

/** "2,5" → 2.5; kosong → null. Hanya angka dan satu pemisah desimal. */
export function parseDesimal(s: string): number | null {
  const t = s.replace(',', '.').replace(/[^\d.]/g, '')
  if (t === '' || t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export const tampilDesimal = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','))
