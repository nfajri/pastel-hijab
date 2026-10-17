// Bentuk data API tahap 2 (server/API.md): penjualan, kalkulator, pengeluaran, laporan, ekspor.
// Tipe tahap 1 ada di api-types.ts; yang di sini hanya tambahan tahap 2.
import type { JenisPotongan, Pembulatan } from './api-types'

export type CaraTarget = 'persen_jual' | 'persen_modal' | 'rupiah'

/** Harga produk di satu saluran, dengan target yang disimpan lewat "Pakai harga ini" (tahap 2). */
export interface HargaTarget {
  saluran_id: number
  harga: number
  target_cara: CaraTarget | null
  target_nilai: number | null
  untung: number
  di_bawah_target: boolean
  updated_at: string
}

/** Produk dengan field tambahan tahap 2. */
export interface ProdukT2 {
  id: number
  nama: string
  kategori: string
  stok: number
  modal: number
  batas_stok_menipis: number
  menipis: boolean
  di_bawah_target: boolean
  terjual_30_hari: number
  aktif: boolean
  harga: HargaTarget[]
}

export interface BarisJual {
  id: number
  produk_id: number
  produk_nama: string
  qty: number
  harga: number
  subtotal: number
  hpp: number
  hpp_total: number
  potongan: number
  untung: number
}

export interface RincianPotonganJual {
  potongan_id: number | null
  nama: string
  jenis: JenisPotongan
  nilai: number
  maks_rp: number | null
  rp: number
}

export interface Penjualan {
  id: number
  tanggal: string
  saluran_id: number
  saluran_nama: string
  catatan: string
  baris: BarisJual[]
  qty: number
  subtotal: number
  potongan_otomatis: number
  potongan: number
  potongan_diubah: boolean
  rincian_potongan: RincianPotonganJual[]
  uang_diterima: number
  hpp_total: number
  untung: number
  created_at: string
  updated_at: string
}

export interface PenjualanInput {
  id?: number
  tanggal?: string
  saluran_id: number
  catatan?: string
  potongan?: number
  baris: { produk_id: number; qty: number; harga?: number }[]
}

export interface StokKurang {
  produk_id: number
  produk_nama: string
  qty: number
  stok: number
  pesan: string
}

export interface KartuSaluran {
  saluran_id: number
  saluran_nama: string
  tercapai: boolean
  pesan: string
  mentah: number | null
  saran: number | null
  minimal: number | null
  harga_sekarang: number | null
  target_sekarang: { cara: CaraTarget; nilai: number } | null
  cek: boolean
  harga: number | null
  rincian: null | {
    harga: number
    modal: number
    potongan: { potongan_id: number; nama: string; jenis: JenisPotongan; nilai: number; maks_rp: number | null; rp: number }[]
    total_potongan: number
    untung: number
    persen_jual: number
    persen_modal: number
  }
  status: 'sesuai_target' | 'di_bawah_target' | 'rugi' | 'tidak_tercapai'
  kurang_rp: number
}

export interface KalkulatorInput {
  produk_id?: number
  modal?: number
  cara: CaraTarget
  nilai: number
  pembulatan?: Pembulatan
  saluran_id?: number
  cek?: { saluran_id: number; harga: number }[]
}

export interface KalkulatorHasil {
  produk_id: number | null
  modal: number
  cara: CaraTarget
  nilai: number
  pembulatan: Pembulatan
  saluran: KartuSaluran[]
}

export interface KategoriPengeluaran {
  id: number
  nama: string
  aktif: boolean
  urutan: number
  created_at: string
  updated_at: string
}

export interface Pengeluaran {
  id: number
  tanggal: string
  kategori_id: number
  kategori_nama: string
  jumlah: number
  catatan: string
  created_at: string
  updated_at: string
}

export interface AngkaJual {
  pesanan: number
  pcs: number
  omzet: number
  potongan: number
  hpp: number
  laba_kotor: number
}

export interface StokModel {
  produk_id: number
  produk_nama: string
  kategori: string
  stok: number
  modal: number
  nilai_stok: number
  batas_stok_menipis: number
  menipis: boolean
  aktif: boolean
}

export interface Laporan {
  dari: string
  sampai: string
  saluran_id: number | null
  produk_id: number | null
  ringkasan: AngkaJual & { pengeluaran: number | null; laba_bersih: number | null }
  per_saluran: (AngkaJual & { saluran_id: number; saluran_nama: string })[]
  per_produk: (AngkaJual & { produk_id: number; produk_nama: string; kategori: string })[]
  pengeluaran_per_kategori: { kategori_id: number; kategori_nama: string; jumlah: number }[]
  stok: { total_pcs: number; nilai_stok: number; produk: StokModel[]; menipis: StokModel[] }
}
