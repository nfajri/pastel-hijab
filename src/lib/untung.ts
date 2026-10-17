// Perkiraan untung per pcs di satu saluran (kalkulator K-12: 1 pcs per pesanan). Modal dari server, tidak dihitung ulang.
import type { Saluran } from './api-types'
import { rincian, type KomponenPotongan } from './hitung'

export function potonganUntukHitung(s: Saluran): KomponenPotongan[] {
  return s.potongan
    .filter((k) => k.aktif)
    .map((k) => ({
      id: String(k.id),
      nama: k.nama,
      jenis: k.jenis === 'persen' ? 'persen' : k.jenis === 'per_pesanan' ? 'perPesanan' : 'perPcs',
      nilai: k.nilai,
      maks: k.maks_rp,
    }))
}

export function perkiraanUntung(modal: number, s: Saluran, harga: number) {
  return rincian(modal, potonganUntukHitung(s), harga)
}
