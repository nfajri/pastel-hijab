import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DataState from '../components/DataState'
import { BilahAtas, BilahBawah, Button, IK, Ikon, Input, Label, Pilihan, Saklar, Sheet } from '../components/ui'
import { api } from '../lib/api'
import type { Produk } from '../lib/api-types'
import { useToast } from '../lib/toast'
import { useApi } from '../lib/useApi'
import { useKirim } from '../lib/useKirim'

const KATEGORI_BAWAAN = ['Pashmina', 'Segi empat', 'Bergo', 'Khimar', 'Instan']

function Isi({ lama, kategoriAda }: { lama: Produk | null; kategoriAda: string[] }) {
  const nav = useNavigate()
  const { tampilkan } = useToast()
  const [nama, setNama] = useState(lama?.nama ?? '')
  const [kat, setKat] = useState(lama ? lama.kategori : KATEGORI_BAWAAN[0])
  const [katBaru, setKatBaru] = useState('')
  const [batas, setBatas] = useState(String(lama?.batas_stok_menipis ?? 5))
  const [aktif, setAktif] = useState(lama?.aktif ?? true)
  const [coba, setCoba] = useState(false)
  const [hapus, setHapus] = useState(false)
  const { sibuk, galat, kirim } = useKirim()
  const hps = useKirim()

  const pilihan = useMemo(() => {
    const s = new Set([...KATEGORI_BAWAAN, ...kategoriAda])
    if (lama?.kategori) s.add(lama.kategori)
    return [...s]
  }, [kategoriAda, lama])
  const kategoriFinal = katBaru.trim() || kat
  const errNama = coba && !nama.trim() ? 'Nama produk wajib diisi' : undefined

  const simpan = async (lanjutMasuk: boolean) => {
    setCoba(true)
    if (!nama.trim()) return
    const body = { nama: nama.trim(), kategori: kategoriFinal, batas_stok_menipis: Number(batas) || 0, ...(lama ? { aktif } : {}) }
    const r = await kirim(() => (lama ? api<Produk>(`/produk/${lama.id}`, { method: 'PATCH', body }) : api<Produk>('/produk', { method: 'POST', body })))
    if (!r.ok) return
    if (lanjutMasuk) nav(`/masuk?produk=${r.hasil.id}`, { replace: true })
    else {
      tampilkan('Produk tersimpan.')
      nav(`/produk/${r.hasil.id}`, { replace: true })
    }
  }

  return (
    <div className="md:max-w-xl">
      <BilahAtas judul={lama ? 'Ubah produk' : 'Tambah produk'} tutup />
      <div className="flex flex-col gap-5">
        <Input label="Nama model" placeholder="mis. Pashmina Ceruty Babydoll" value={nama} onChange={(e) => setNama(e.target.value)} error={errNama} />
        <div>
          <Label>Kategori</Label>
          <Pilihan
            label="Kategori"
            items={pilihan.map((k) => ({ key: k, label: k }))}
            value={katBaru.trim() ? '' : kat}
            onChange={(k) => {
              setKat(k)
              setKatBaru('')
            }}
          />
          <div className="mt-3">
            <Input label="Atau kategori lain" placeholder="Opsional, mis. Sport" value={katBaru} onChange={(e) => setKatBaru(e.target.value)} />
          </div>
        </div>
        <Input
          label="Ingatkan bila stok tinggal"
          inputMode="numeric"
          value={batas}
          onChange={(e) => setBatas(e.target.value.replace(/\D/g, ''))}
          hint="Produk masuk daftar stok menipis saat stok sama atau di bawah angka ini."
        />
        {lama ? (
          <div className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-3">
            <div>
              <p className="font-medium text-ink">Produk aktif</p>
              <p className="text-sm text-stone-500">Produk nonaktif disembunyikan dari daftar dan penjualan.</p>
            </div>
            <Saklar label="Produk aktif" aktif={aktif} onChange={setAktif} />
          </div>
        ) : (
          <p className="rounded-xl bg-white px-3 py-2.5 text-sm text-stone-600">Stok dan modal diisi lewat barang masuk, supaya modal/pcs dihitung dari komponen modal.</p>
        )}
        {galat && (
          <p className="text-sm text-red-600" role="alert">
            {galat}
          </p>
        )}
        {lama && (
          <button type="button" onClick={() => setHapus(true)} className="flex min-h-11 items-center gap-2 self-start px-1 text-sm font-semibold text-red-700">
            <Ikon d={IK.hapus} /> Hapus produk
          </button>
        )}
      </div>
      <BilahBawah>
        {lama ? (
          <Button block className="min-h-12" onClick={() => simpan(false)} disabled={sibuk}>
            Simpan
          </Button>
        ) : (
          <>
            <Button variant="secondary" className="min-h-12 flex-1" onClick={() => simpan(false)} disabled={sibuk}>
              Simpan saja
            </Button>
            <Button className="min-h-12 flex-[1.4]" onClick={() => simpan(true)} disabled={sibuk}>
              Simpan & isi stok
            </Button>
          </>
        )}
      </BilahBawah>
      <Sheet open={hapus} onClose={() => setHapus(false)} title="Hapus produk?">
        <p className="mb-4 text-sm text-stone-600">“{lama?.nama}” dihapus permanen. Produk yang sudah punya riwayat stok tidak bisa dihapus; nonaktifkan saja.</p>
        {hps.galat && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {hps.galat}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            block
            disabled={hps.sibuk}
            onClick={async () => {
              const r = await hps.kirim(() => api(`/produk/${lama!.id}`, { method: 'DELETE' }))
              if (r.ok) {
                tampilkan('Produk dihapus.')
                nav('/produk', { replace: true })
              }
            }}
          >
            Hapus produk
          </Button>
          <Button variant="ghost" block onClick={() => setHapus(false)}>
            Batal
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

export default function FormProduk() {
  const { id } = useParams()
  const semua = useApi<Produk[]>('/produk')
  const lama = useApi<Produk>(id ? `/produk/${id}` : null)
  const kategoriAda = useMemo(() => [...new Set((semua.data ?? []).map((p) => p.kategori).filter(Boolean))], [semua.data])

  if (!id) return <Isi lama={null} kategoriAda={kategoriAda} />
  return (
    <>
      <DataState hasil={lama} baris={3}>
        {(p) => <Isi key={p.id} lama={p} kategoriAda={kategoriAda} />}
      </DataState>
    </>
  )
}
