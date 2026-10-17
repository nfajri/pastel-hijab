import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DataState from '../../components/DataState'
import { BilahAtas, Button, IK, Ikon, Rinci, Sheet } from '../../components/ui'
import { api } from '../../lib/api'
import type { Penjualan } from '../../lib/api-tahap2'
import { fmtPersen, rp, rpModal } from '../../lib/format'
import { jamWIB, tglPanjang } from '../../lib/tgl'
import { useToast } from '../../lib/toast'
import { useApi } from '../../lib/useApi'
import { useKirim } from '../../lib/useKirim'

function Isi({ j }: { j: Penjualan }) {
  const nav = useNavigate()
  const { tampilkan } = useToast()
  const { sibuk, galat, kirim } = useKirim()
  const [hapus, setHapus] = useState(false)
  const hapusIni = async () => {
    const r = await kirim(() => api(`/penjualan/${j.id}`, { method: 'DELETE' }))
    if (!r.ok) return
    tampilkan('Penjualan dihapus, stok dikembalikan.')
    nav('/transaksi', { replace: true })
  }
  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul={`Penjualan #${j.id}`} kembali="/transaksi" />
      <p className="mb-4 text-sm text-stone-500">
        {j.saluran_nama} · {tglPanjang(j.tanggal)}, {jamWIB(j.created_at)}
      </p>
      <div className="flex flex-col gap-4">
        <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
          {j.baris.map((b) => (
            <div key={b.id} className="px-4 py-3">
              <p className="font-medium text-ink">{b.produk_nama}</p>
              <div className="mt-1 flex justify-between gap-3 text-sm text-stone-500 tabular-nums">
                <span>
                  {b.qty} × {rp(b.harga)}
                </span>
                <span>Modal saat itu {rpModal(b.hpp)}/pcs</span>
              </div>
            </div>
          ))}
        </div>
        <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
          <Rinci label={`Total harga (${j.qty} pcs)`} nilai={rp(j.subtotal)} />
          {j.potongan > 0 || j.rincian_potongan.length > 0 ? (
            <>
              <Rinci
                label={
                  <>
                    Potongan {j.saluran_nama}
                    {j.potongan_diubah && <span className="ml-1 text-xs text-brand-700">(diubah)</span>}
                  </>
                }
                nilai={`−${rp(j.potongan)}`}
                nada="kurang"
              />
              {!j.potongan_diubah &&
                j.rincian_potongan.map((x) => (
                  <div key={x.nama} className="flex justify-between py-0.5 pl-3 text-xs text-stone-500">
                    <span>{x.jenis === 'persen' ? `${x.nama} ${fmtPersen(x.nilai)}` : x.nama}</span>
                    <span className="tabular-nums">−{rp(x.rp)}</span>
                  </div>
                ))}
              {j.potongan_diubah && <p className="pl-3 text-xs text-stone-500">Otomatis: −{rp(j.potongan_otomatis)}</p>}
            </>
          ) : null}
          <Rinci label="Uang diterima" nilai={rp(j.uang_diterima)} tebal garis />
          <Rinci label="Modal barang (HPP)" nilai={`−${rpModal(j.hpp_total)}`} nada="kurang" />
          <Rinci label="Untung" nilai={rp(j.untung)} tebal garis nada={j.untung < 0 ? 'rugi' : 'untung'} />
        </section>
        <div className="grid grid-cols-2 gap-2">
          <Link to={`/transaksi/${j.id}/ubah`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-500 bg-white px-4 font-semibold text-brand-700 hover:bg-brand-50">
            <Ikon d={IK.ubah} /> Ubah
          </Link>
          <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setHapus(true)}>
            <Ikon d={IK.hapus} /> Hapus
          </Button>
        </div>
      </div>
      <Sheet open={hapus} onClose={() => setHapus(false)} title="Hapus penjualan ini?">
        <p className="mb-4 text-sm text-stone-600">Stok akan dikembalikan: {j.baris.map((b) => `${b.produk_nama} +${b.qty}`).join(', ')}.</p>
        {galat && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {galat}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button variant="danger" block disabled={sibuk} onClick={hapusIni}>
            {sibuk ? 'Menghapus…' : 'Hapus penjualan'}
          </Button>
          <Button variant="ghost" block onClick={() => setHapus(false)}>
            Batal
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

export default function DetailPenjualan() {
  const { id } = useParams()
  const hasil = useApi<Penjualan>(`/penjualan/${id}`)
  if (hasil.gagal !== null && /tidak (ada|ditemukan)/i.test(hasil.gagal)) return <BilahAtas judul="Penjualan tidak ditemukan" kembali="/transaksi" />
  return (
    <DataState hasil={hasil} baris={4}>
      {(j) => <Isi j={j} />}
    </DataState>
  )
}
