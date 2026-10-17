// Pratinjau modal di form Barang masuk (rumus §5.2, sama dengan server/internal/hitung/modal.go).
// Hanya pratinjau sebelum simpan; angka resmi selalu dari respons server.
import type { JenisModal } from './api-types'

export const sen = (x: number): number => Math.round(x * 100) / 100

export interface NilaiKomponen {
  jenis: JenisModal
  nilai: number
}

/** Kontribusi satu komponen ke modal/pcs, dibulatkan 2 desimal. */
export function perPcs(k: NilaiKomponen, hargaBeli: number, qty: number): number {
  if (k.jenis === 'per_pcs') return sen(k.nilai)
  if (k.jenis === 'per_kulakan') return qty > 0 ? sen(k.nilai / qty) : 0
  return sen((k.nilai / 100) * hargaBeli)
}

/** Modal/pcs satu kulakan = harga beli + Σ kontribusi komponen (dibulatkan 2 desimal sekali di akhir, seperti server). */
export function modalKulakan(hargaBeli: number, qty: number, komponen: NilaiKomponen[]): number {
  let total = hargaBeli
  for (const k of komponen) {
    if (k.jenis === 'per_pcs') total += k.nilai
    else if (k.jenis === 'per_kulakan') total += k.nilai / qty
    else total += (k.nilai / 100) * hargaBeli
  }
  return sen(total)
}

/** Modal/pcs produk setelah barang masuk: rata-rata tertimbang (K-8). */
export function modalRataRata(stokLama: number, modalLama: number, qty: number, modalKulakanBaru: number): number {
  if (stokLama <= 0) return sen(modalKulakanBaru)
  if (qty <= 0) return sen(modalLama)
  return sen((stokLama * modalLama + qty * modalKulakanBaru) / (stokLama + qty))
}
