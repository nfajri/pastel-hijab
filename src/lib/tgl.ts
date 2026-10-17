// Tanggal "YYYY-MM-DD" (WIB) untuk tampilan dan periode laporan. Hanya kalender, bukan hitungan uang.
import { hariIniWIB } from './format'

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const bagian = (iso: string) => iso.split('-').map(Number) as [number, number, number]
const hariKe = (iso: string) => {
  const [y, m, d] = bagian(iso)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** "Sabtu, 17 Okt" */
export function tglHari(iso: string): string {
  const [, m, d] = bagian(iso)
  return `${HARI[hariKe(iso)]}, ${d} ${BULAN[m - 1]}`
}

/** "Sabtu, 17 Oktober 2026" */
export function tglPanjang(iso: string): string {
  const [y, m, d] = bagian(iso)
  return `${HARI[hariKe(iso)]}, ${d} ${BULAN_PANJANG[m - 1]} ${y}`
}

/** Jam WIB dari waktu sistem ISO UTC, "14.05". */
export function jamWIB(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)).replace(':', '.')
}

export type Periode = 'hari' | 'minggu' | 'bulan' | 'rentang'

/** Rentang laporan. "Minggu ini" = Senin s/d hari ini. */
export function rentangPeriode(periode: Periode, rentang: [string, string], hariIni = hariIniWIB()): [string, string] {
  if (periode === 'hari') return [hariIni, hariIni]
  if (periode === 'bulan') return [`${hariIni.slice(0, 7)}-01`, hariIni]
  if (periode === 'minggu') {
    const [y, m, d] = bagian(hariIni)
    const mundur = (hariKe(hariIni) + 6) % 7
    const senin = new Date(Date.UTC(y, m - 1, d - mundur))
    return [senin.toISOString().slice(0, 10), hariIni]
  }
  return rentang
}

export const namaPeriode: Record<Periode, string> = { hari: 'Hari ini', minggu: 'Minggu ini', bulan: 'Bulan ini', rentang: 'Pilih tanggal' }
