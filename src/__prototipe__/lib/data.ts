// Data tiruan prototipe. Angka uji mengikuti spek §7 (Shopee 10% + Rp1.250/pesanan, modal Rp25.000, dst.).
import type { CaraTarget, KomponenModal, KomponenPotongan, Pembulatan } from './hitung'

export const HARI_INI = '2026-10-17' // Sabtu

export interface Saluran {
  id: string
  nama: string
  aktif: boolean
  potongan: KomponenPotongan[]
}

export interface HargaSaluran {
  harga: number
  cara: CaraTarget
  nilai: number
}

export interface Produk {
  id: string
  nama: string
  kategori: string
  stok: number
  modal: number
  batas: number
  harga: Record<string, HargaSaluran | undefined>
  laku30: number
}

export interface BarisJual {
  produkId: string
  nama: string
  qty: number
  harga: number
  hpp: number
}

export interface Penjualan {
  id: string
  tanggal: string
  jam: string
  saluranId: string
  baris: BarisJual[]
  potongan: number
  catatan?: string
}

export interface Pengeluaran {
  id: string
  tanggal: string
  kategori: string
  jumlah: number
  catatan?: string
}

export interface BarangMasuk {
  id: string
  tanggal: string
  supplier: string
  produkId: string
  qty: number
  hargaBeli: number
  modalPcs: number
}

export interface Penyesuaian {
  id: string
  tanggal: string
  produkId: string
  perubahan: number
  alasan: string
  catatan?: string
}

export const SALURAN: Saluran[] = [
  {
    id: 'shopee',
    nama: 'Shopee',
    aktif: true,
    potongan: [
      { id: 'sp1', nama: 'Biaya admin', jenis: 'persen', nilai: 8 },
      { id: 'sp2', nama: 'Gratis Ongkir XTRA', jenis: 'persen', nilai: 2, maks: 10000 },
      { id: 'sp3', nama: 'Biaya proses pesanan', jenis: 'perPesanan', nilai: 1250 },
    ],
  },
  {
    id: 'tokopedia',
    nama: 'Tokopedia',
    aktif: true,
    potongan: [
      { id: 'tp1', nama: 'Biaya layanan', jenis: 'persen', nilai: 6.5, maks: 40000 },
      { id: 'tp2', nama: 'Biaya proses pesanan', jenis: 'perPesanan', nilai: 1000 },
    ],
  },
  {
    id: 'tiktok',
    nama: 'TikTok Shop',
    aktif: true,
    potongan: [
      { id: 'tt1', nama: 'Komisi platform', jenis: 'persen', nilai: 6 },
      { id: 'tt2', nama: 'Komisi afiliasi', jenis: 'persen', nilai: 5 },
      { id: 'tt3', nama: 'Biaya proses pesanan', jenis: 'perPesanan', nilai: 1250 },
    ],
  },
  { id: 'pasar', nama: 'Pasar Minggu', aktif: true, potongan: [] },
]

export const KOMPONEN_MODAL: KomponenModal[] = [
  { id: 'km1', nama: 'Plastik + label', jenis: 'perPcs', nilai: 1000, aktif: true },
  { id: 'km2', nama: 'Ongkir kulakan', jenis: 'perKulakan', nilai: 30000, aktif: true },
  { id: 'km3', nama: 'Fee titip beli', jenis: 'persenBeli', nilai: 2, aktif: true },
  { id: 'km4', nama: 'Hangtag', jenis: 'perPcs', nilai: 500, aktif: false },
]

export const KATEGORI_PENGELUARAN = ['Sewa lapak', 'Iklan', 'Packaging massal', 'Lain-lain']
export const KATEGORI_PRODUK = ['Pashmina', 'Segi empat', 'Bergo', 'Khimar', 'Instan']
export const PEMBULATAN_BAWAAN: Pembulatan = '1000'

const h = (harga: number, cara: CaraTarget = 'persenJual', nilai = 30): HargaSaluran => ({ harga, cara, nilai })

export const PRODUK: Produk[] = [
  {
    id: 'p1',
    nama: 'Pashmina Ceruty Babydoll',
    kategori: 'Pashmina',
    stok: 18,
    modal: 25000,
    batas: 5,
    harga: { shopee: h(44000), tokopedia: h(42000), tiktok: h(46000), pasar: h(39000, 'rupiah', 14000) },
    laku30: 41,
  },
  {
    id: 'p2',
    nama: 'Bergo Maryam Diamond',
    kategori: 'Bergo',
    stok: 3,
    modal: 18500,
    batas: 5,
    harga: { shopee: h(33000), tokopedia: h(31000), tiktok: h(34000), pasar: h(29000, 'rupiah', 10000) },
    laku30: 28,
  },
  {
    id: 'p3',
    nama: 'Segi Empat Voal Motif',
    kategori: 'Segi empat',
    stok: 24,
    modal: 24400,
    batas: 6,
    harga: { shopee: h(43000), tokopedia: h(41000), tiktok: h(45000), pasar: h(38000, 'rupiah', 13000) },
    laku30: 22,
  },
  {
    id: 'p4',
    nama: 'Pashmina Plisket Premium',
    kategori: 'Pashmina',
    stok: 2,
    modal: 31500,
    batas: 4,
    // Modal naik setelah kulakan terakhir: harga Shopee & TikTok jadi di bawah target 30%.
    harga: { shopee: h(49000), tokopedia: h(52000), tiktok: h(52000), pasar: h(45000, 'rupiah', 12000) },
    laku30: 17,
  },
  {
    id: 'p5',
    nama: 'Khimar Syari Wolfis',
    kategori: 'Khimar',
    stok: 7,
    modal: 52000,
    batas: 3,
    harga: { shopee: h(89000), tokopedia: h(85000), tiktok: h(92000), pasar: h(75000, 'rupiah', 23000) },
    laku30: 9,
  },
  {
    id: 'p6',
    nama: 'Hijab Sport Instan',
    kategori: 'Instan',
    stok: 12,
    modal: 15000,
    batas: 5,
    harga: { shopee: h(28000), tokopedia: h(26000), tiktok: h(28000), pasar: h(25000, 'rupiah', 10000) },
    laku30: 14,
  },
  {
    id: 'p7',
    nama: 'Pashmina Inner 2in1 Jersey',
    kategori: 'Pashmina',
    stok: 0,
    modal: 28000,
    batas: 4,
    harga: { shopee: h(49000), tokopedia: h(47000), tiktok: h(51000), pasar: h(42000, 'rupiah', 14000) },
    laku30: 11,
  },
  {
    id: 'p8',
    nama: 'Segi Empat Paris Premium Jahit Tepi Laser Cut Motif Bunga Sakura',
    kategori: 'Segi empat',
    stok: 9,
    modal: 21000,
    batas: 4,
    harga: { shopee: h(38000), tokopedia: h(36000), pasar: h(32000, 'rupiah', 11000) },
    laku30: 6,
  },
]

function potonganPesanan(s: Saluran, baris: { qty: number; harga: number }[]): number {
  const sub = baris.reduce((t, b) => t + b.qty * b.harga, 0)
  const qty = baris.reduce((t, b) => t + b.qty, 0)
  let total = 0
  for (const k of s.potongan) {
    if (k.jenis === 'persen') {
      const v = (sub * k.nilai) / 100
      total += k.maks ? Math.min(v, k.maks) : v
    } else if (k.jenis === 'perPcs') total += k.nilai * qty
    else total += k.nilai
  }
  return Math.round(total)
}

/** Potongan per komponen untuk satu pesanan (qty sebenarnya, K-12: per pesanan dihitung sekali). */
export function rincianPotonganPesanan(s: Saluran, baris: { qty: number; harga: number }[]) {
  const sub = baris.reduce((t, b) => t + b.qty * b.harga, 0)
  const qty = baris.reduce((t, b) => t + b.qty, 0)
  return s.potongan.map((k) => {
    let v = 0
    if (k.jenis === 'persen') {
      v = (sub * k.nilai) / 100
      if (k.maks) v = Math.min(v, k.maks)
    } else if (k.jenis === 'perPcs') v = k.nilai * qty
    else v = k.nilai
    return { nama: k.nama, nilai: Math.round(v) }
  })
}

export { potonganPesanan }

// Penjualan 1–17 Oktober 2026 (deterministik).
function buatPenjualan(): Penjualan[] {
  const rencana: [string, string, string, [string, number][]][] = [
    ['2026-10-17', '13.42', 'shopee', [['p1', 1]]],
    ['2026-10-17', '11.05', 'tiktok', [['p2', 2]]],
    ['2026-10-17', '09.18', 'shopee', [['p3', 1], ['p6', 1]]],
    ['2026-10-16', '20.11', 'tokopedia', [['p1', 2]]],
    ['2026-10-16', '15.30', 'shopee', [['p5', 1]]],
    ['2026-10-16', '10.02', 'tiktok', [['p4', 1]]],
    ['2026-10-15', '19.45', 'shopee', [['p1', 1], ['p2', 1]]],
    ['2026-10-15', '08.20', 'tokopedia', [['p8', 1]]],
    ['2026-10-14', '21.03', 'tiktok', [['p3', 2]]],
    ['2026-10-14', '12.40', 'shopee', [['p6', 2]]],
    ['2026-10-13', '16.12', 'shopee', [['p1', 1]]],
    ['2026-10-12', '18.00', 'tokopedia', [['p5', 1]]],
    ['2026-10-11', '10.30', 'pasar', [['p1', 3], ['p2', 2]]],
    ['2026-10-11', '09.15', 'pasar', [['p3', 2]]],
    ['2026-10-11', '08.40', 'pasar', [['p6', 2], ['p4', 1]]],
    ['2026-10-10', '20.20', 'shopee', [['p7', 2]]],
    ['2026-10-09', '14.10', 'tiktok', [['p1', 2]]],
    ['2026-10-08', '11.11', 'shopee', [['p3', 1]]],
    ['2026-10-07', '19.30', 'tokopedia', [['p2', 2]]],
    ['2026-10-06', '13.00', 'shopee', [['p5', 1], ['p1', 1]]],
    ['2026-10-05', '10.45', 'tiktok', [['p7', 1]]],
    ['2026-10-04', '09.30', 'pasar', [['p1', 4], ['p3', 2], ['p2', 3]]],
    ['2026-10-04', '08.10', 'pasar', [['p6', 3], ['p8', 1]]],
    ['2026-10-03', '21.40', 'shopee', [['p4', 1]]],
    ['2026-10-02', '15.15', 'tokopedia', [['p1', 1]]],
    ['2026-10-01', '12.00', 'shopee', [['p3', 2]]],
  ]
  return rencana.map(([tanggal, jam, saluranId, items], i) => {
    const s = SALURAN.find((x) => x.id === saluranId)!
    const baris = items.map(([pid, qty]) => {
      const p = PRODUK.find((x) => x.id === pid)!
      return { produkId: pid, nama: p.nama, qty, harga: p.harga[saluranId]?.harga ?? 0, hpp: p.id === 'p4' && tanggal < '2026-10-12' ? 27000 : p.modal }
    })
    return { id: `J-${String(1040 - i).padStart(4, '0')}`, tanggal, jam, saluranId, baris, potongan: potonganPesanan(s, baris) }
  })
}

export const PENJUALAN: Penjualan[] = buatPenjualan()

export const PENGELUARAN: Pengeluaran[] = [
  { id: 'B-1', tanggal: '2026-10-11', kategori: 'Sewa lapak', jumlah: 50000, catatan: 'Pasar minggu Lapangan Merdeka' },
  { id: 'B-2', tanggal: '2026-10-09', kategori: 'Iklan', jumlah: 75000, catatan: 'Iklan Shopee 1 minggu' },
  { id: 'B-3', tanggal: '2026-10-06', kategori: 'Packaging massal', jumlah: 120000, catatan: 'Polymailer 200 lembar' },
  { id: 'B-4', tanggal: '2026-10-04', kategori: 'Sewa lapak', jumlah: 50000 },
  { id: 'B-5', tanggal: '2026-10-02', kategori: 'Lain-lain', jumlah: 25000, catatan: 'Lakban & gunting' },
]

export const MASUK: BarangMasuk[] = [
  { id: 'M-1', tanggal: '2026-10-12', supplier: 'Grosir Tanah Abang Blok A', produkId: 'p4', qty: 10, hargaBeli: 30000, modalPcs: 33600 },
  { id: 'M-2', tanggal: '2026-10-10', supplier: 'Grosir Tanah Abang Blok A', produkId: 'p3', qty: 10, hargaBeli: 20000, modalPcs: 24400 },
  { id: 'M-3', tanggal: '2026-10-03', supplier: 'Toko Kain Bu Hj. Ros', produkId: 'p1', qty: 30, hargaBeli: 21000, modalPcs: 23420 },
]

export const PENYESUAIAN: Penyesuaian[] = [
  { id: 'S-1', tanggal: '2026-10-13', produkId: 'p1', perubahan: -1, alasan: 'Rusak', catatan: 'Kena noda tinta' },
  { id: 'S-2', tanggal: '2026-10-05', produkId: 'p6', perubahan: 1, alasan: 'Hitung fisik' },
]

export const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function tglPendek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  void y
  return `${d} ${BULAN[m - 1]}`
}

export function tglPanjang(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const hari = NAMA_HARI[new Date(y, m - 1, d).getDay()]
  if (iso === HARI_INI) return `Hari ini, ${d} ${BULAN[m - 1]}`
  if (iso === '2026-10-16') return `Kemarin, ${d} ${BULAN[m - 1]}`
  return `${hari}, ${d} ${BULAN[m - 1]} ${y}`
}
