import { useState, type FormEvent } from 'react'
import DataState from '../../components/DataState'
import { BilahAtas, Button, Daftar, Input, Saklar } from '../../components/ui'
import { api } from '../../lib/api'
import type { KategoriPengeluaran } from '../../lib/api-tahap2'
import { useToast } from '../../lib/toast'
import { useApi } from '../../lib/useApi'
import { useKirim } from '../../lib/useKirim'

export default function KategoriPengeluaranPage() {
  const hasil = useApi<KategoriPengeluaran[]>('/kategori-pengeluaran')
  const { tampilkan } = useToast()
  const { sibuk, galat, setGalat, kirim } = useKirim()
  const [nama, setNama] = useState('')

  const tambah = async (e: FormEvent) => {
    e.preventDefault()
    if (!nama.trim()) {
      setGalat('Isi nama kategori')
      return
    }
    const r = await kirim(() => api<KategoriPengeluaran>('/kategori-pengeluaran', { method: 'POST', body: { nama: nama.trim() } }))
    if (!r.ok) return
    setNama('')
    tampilkan(`Kategori “${r.hasil.nama}” ditambahkan.`)
    hasil.muat()
  }

  const ubahAktif = async (k: KategoriPengeluaran, aktif: boolean) => {
    const r = await kirim(() => api<KategoriPengeluaran>(`/kategori-pengeluaran/${k.id}`, { method: 'PATCH', body: { aktif } }))
    if (r.ok) hasil.muat()
  }

  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul="Kategori pengeluaran" kembali="/pengaturan" />
      <div className="flex flex-col gap-5">
        <DataState hasil={hasil} baris={4}>
          {(ks) => (
            <Daftar judul="Dipakai di Catat pengeluaran">
              {ks.map((k) => (
                <div key={k.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <p className={`min-w-0 flex-1 truncate font-medium ${k.aktif ? 'text-ink' : 'text-stone-400'}`}>
                    {k.nama}
                    {!k.aktif && <span className="ml-2 text-xs font-normal">nonaktif</span>}
                  </p>
                  <Saklar aktif={k.aktif} onChange={(v) => ubahAktif(k, v)} label={`Aktifkan ${k.nama}`} />
                </div>
              ))}
            </Daftar>
          )}
        </DataState>
        <form onSubmit={tambah} className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm" noValidate>
          <Input label="Kategori baru" placeholder="mis. Ongkir stok, Foto produk" value={nama} onChange={(e) => setNama(e.target.value)} maxLength={60} />
          {galat && (
            <p className="text-sm text-red-600" role="alert">
              {galat}
            </p>
          )}
          <Button type="submit" disabled={sibuk}>
            Tambah kategori
          </Button>
          <p className="text-sm text-stone-500">Kategori yang sudah dipakai tidak bisa dihapus; nonaktifkan saja, catatan lama tetap utuh.</p>
        </form>
      </div>
    </div>
  )
}
