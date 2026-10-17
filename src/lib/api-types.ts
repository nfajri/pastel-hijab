// Bentuk data API tahap 1 (server/API.md). Rupiah integer; modal 2 desimal dari server.

export type JenisModal = 'per_pcs' | 'per_kulakan' | 'persen_harga_beli'
export type JenisPotongan = 'persen' | 'per_pesanan' | 'per_pcs'
export type Pembulatan = 'tanpa' | '100' | '500' | '1000' | 'cantik'

export interface Pengaturan {
  pembulatan_bawaan: Pembulatan
}

export interface KomponenModal {
  id: number
  nama: string
  jenis: JenisModal
  nilai: number
  aktif: boolean
  urutan: number
  created_at: string
  updated_at: string
}

export interface Potongan {
  id: number
  saluran_id: number
  nama: string
  jenis: JenisPotongan
  nilai: number
  maks_rp: number | null
  aktif: boolean
  urutan: number
  created_at: string
  updated_at: string
}

export interface Saluran {
  id: number
  nama: string
  aktif: boolean
  urutan: number
  created_at: string
  updated_at: string
  potongan: Potongan[]
}

export interface HargaSaluran {
  saluran_id: number
  harga: number
  updated_at: string
}

export interface Produk {
  id: number
  nama: string
  kategori: string
  stok: number
  modal: number
  batas_stok_menipis: number
  menipis: boolean
  aktif: boolean
  created_at: string
  updated_at: string
  harga: HargaSaluran[]
}

export interface KomponenKulakan {
  komponen_id: number | null
  nama: string
  jenis: JenisModal
  nilai: number
  per_pcs: number
}

export interface BarangMasuk {
  id: number
  tanggal: string
  supplier: string
  produk_id: number
  produk_nama: string
  qty: number
  harga_beli: number
  modal_pcs: number
  modal_sebelum: number
  catatan: string
  created_at: string
  updated_at: string
  komponen: KomponenKulakan[]
}

export interface BarangMasukInput {
  tanggal?: string
  supplier?: string
  produk_id: number
  qty: number
  harga_beli: number
  catatan?: string
  komponen?: ({ komponen_id: number; nilai?: number } | { nama: string; jenis: JenisModal; nilai: number })[]
}

export interface Penyesuaian {
  id: number
  tanggal: string
  produk_id: number
  produk_nama: string
  selisih: number
  alasan: string
  stok_sebelum: number
  stok_sesudah: number
  created_at: string
}

export interface Sesi {
  username: string
  sesi_kedaluwarsa: string
  jumlah_sesi_aktif: number
}
