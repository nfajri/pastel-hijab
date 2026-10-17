// Catat / ubah pengeluaran (sewa lapak, iklan, packaging massal, lain-lain).
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DataState from '../components/DataState'
import { BilahAtas, BilahBawah, Button, IK, Ikon, Input, Label, Pilihan, RupiahInput, Sheet } from '../components/ui'
import { api } from '../lib/api'
import type { KategoriPengeluaran, Pengeluaran } from '../lib/api-tahap2'
import { hariIniWIB, rp } from '../lib/format'
import { kembaliAtau } from '../lib/kembali'
import { useToast } from '../lib/toast'
import { useApi } from '../lib/useApi'
import { useKirim } from '../lib/useKirim'

function Form({ kategori, asal }: { kategori: KategoriPengeluaran[]; asal?: Pengeluaran }) {
  const nav = useNavigate()
  const { tampilkan } = useToast()
  const { sibuk, galat, kirim } = useKirim()
  const hariIni = hariIniWIB()
  // Kategori lama boleh tetap dipakai walau sudah nonaktif (API.md).
  const pilihan = kategori.filter((k) => k.aktif || k.id === asal?.kategori_id)
  const [tanggal, setTanggal] = useState(asal?.tanggal ?? hariIni)
  const [kat, setKat] = useState<number | null>(asal?.kategori_id ?? pilihan[0]?.id ?? null)
  const [jumlah, setJumlah] = useState<number | null>(asal?.jumlah ?? null)
  const [catatan, setCatatan] = useState(asal?.catatan ?? '')
  const [coba, setCoba] = useState(false)
  const [hapus, setHapus] = useState(false)

  const simpan = async () => {
    setCoba(true)
    if (!jumlah || kat == null) return
    const body = { jumlah, kategori_id: kat, tanggal, catatan: catatan.trim() }
    const r = await kirim(() => (asal ? api<Pengeluaran>(`/pengeluaran/${asal.id}`, { method: 'PUT', body }) : api<Pengeluaran>('/pengeluaran', { method: 'POST', body })))
    if (!r.ok) return
    tampilkan(`Pengeluaran ${r.hasil.kategori_nama} ${rp(r.hasil.jumlah)} tersimpan.`)
    if (asal) nav('/transaksi?tab=pengeluaran', { replace: true })
    else kembaliAtau(nav, '/transaksi?tab=pengeluaran')
  }

  const hapusIni = async () => {
    if (!asal) return
    const r = await kirim(() => api(`/pengeluaran/${asal.id}`, { method: 'DELETE' }))
    if (!r.ok) return
    tampilkan('Pengeluaran dihapus.')
    nav('/transaksi?tab=pengeluaran', { replace: true })
  }

  return (
    <div className="md:max-w-xl">
      <BilahAtas
        judul={asal ? 'Ubah pengeluaran' : 'Catat pengeluaran'}
        tutup
        kanan={
          asal && (
            <button type="button" onClick={() => setHapus(true)} aria-label="Hapus pengeluaran" className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50">
              <Ikon d={IK.hapus} />
            </button>
          )
        }
      />
      <div className="flex flex-col gap-5">
        <RupiahInput label="Jumlah" value={jumlah} onValueChange={setJumlah} error={coba && !jumlah ? 'Isi jumlah pengeluaran' : undefined} className="text-lg font-semibold" />
        <div>
          <Label>Kategori</Label>
          {pilihan.length ? (
            <Pilihan<string> label="Kategori" items={pilihan.map((k) => ({ key: String(k.id), label: k.nama }))} value={String(kat)} onChange={(v) => setKat(Number(v))} />
          ) : (
            <p className="text-sm text-stone-500">Belum ada kategori aktif. Tambahkan di Pengaturan → Kategori pengeluaran.</p>
          )}
        </div>
        <Input label="Tanggal" type="date" value={tanggal} max={hariIni} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
        <Input label="Catatan" placeholder="Opsional, mis. Pasar minggu Lapangan Merdeka" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        {galat && (
          <p className="text-sm text-red-600" role="alert">
            {galat}
          </p>
        )}
      </div>
      <BilahBawah>
        <Button block className="min-h-12" disabled={sibuk || kat == null} onClick={simpan}>
          {sibuk ? 'Menyimpan…' : asal ? 'Simpan perubahan' : 'Simpan pengeluaran'}
        </Button>
      </BilahBawah>
      <Sheet open={hapus} onClose={() => setHapus(false)} title="Hapus pengeluaran ini?">
        <p className="mb-4 text-sm text-stone-600">
          {asal?.kategori_nama} {asal ? rp(asal.jumlah) : ''} akan dihapus dan laba bersih periode itu dihitung ulang.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="danger" block disabled={sibuk} onClick={hapusIni}>
            Hapus pengeluaran
          </Button>
          <Button variant="ghost" block onClick={() => setHapus(false)}>
            Batal
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

export default function CatatPengeluaran() {
  const { id } = useParams()
  const kategori = useApi<KategoriPengeluaran[]>('/kategori-pengeluaran')
  const asal = useApi<Pengeluaran>(id ? `/pengeluaran/${id}` : null)
  return (
    <DataState hasil={kategori}>
      {(ks) =>
        id ? (
          <DataState hasil={asal} baris={3}>
            {(p) => <Form key={p.id} kategori={ks} asal={p} />}
          </DataState>
        ) : (
          <Form kategori={ks} />
        )
      }
    </DataState>
  )
}
