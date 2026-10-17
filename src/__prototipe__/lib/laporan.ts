import type { Biaya, Penjualan } from './data'

export function omzet(j: Penjualan) {
  return j.baris.reduce((t, b) => t + b.qty * b.harga, 0)
}
export function hpp(j: Penjualan) {
  return j.baris.reduce((t, b) => t + b.qty * b.hpp, 0)
}
export function pcs(j: Penjualan) {
  return j.baris.reduce((t, b) => t + b.qty, 0)
}
export function untung(j: Penjualan) {
  return omzet(j) - j.potongan - hpp(j)
}

export interface Ringkasan {
  omzet: number
  potongan: number
  hpp: number
  labaKotor: number
  biaya: number
  labaBersih: number
  pesanan: number
  pcs: number
}

export function ringkas(js: Penjualan[], bs: Biaya[]): Ringkasan {
  const o = js.reduce((t, j) => t + omzet(j), 0)
  const p = js.reduce((t, j) => t + j.potongan, 0)
  const h = js.reduce((t, j) => t + hpp(j), 0)
  const b = bs.reduce((t, x) => t + x.jumlah, 0)
  return { omzet: o, potongan: p, hpp: h, labaKotor: o - p - h, biaya: b, labaBersih: o - p - h - b, pesanan: js.length, pcs: js.reduce((t, j) => t + pcs(j), 0) }
}

export type Periode = 'hari' | 'minggu' | 'bulan' | 'rentang'

/** Rentang tanggal [dari, sampai] (inklusif) relatif ke hari ini 17 Okt 2026 (Sabtu). */
export function rentang(p: Periode, hariIni: string, custom?: [string, string]): [string, string] {
  if (p === 'hari') return [hariIni, hariIni]
  if (p === 'minggu') return ['2026-10-12', hariIni] // Senin–hari ini
  if (p === 'bulan') return ['2026-10-01', hariIni]
  return custom ?? ['2026-10-01', hariIni]
}

export const dalam = (t: string, [a, b]: [string, string]) => t >= a && t <= b
