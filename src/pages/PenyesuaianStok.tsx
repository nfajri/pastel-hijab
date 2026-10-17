import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DataState from '../components/DataState'
import { BilahAtas, BilahBawah, Button, Input, Label, Pilihan, Tabs, Thumb } from '../components/ui'
import { api } from '../lib/api'
import type { Penyesuaian, Produk } from '../lib/api-types'
import { useToast } from '../lib/toast'
import { useApi } from '../lib/useApi'
import { useKirim } from '../lib/useKirim'

const ALASAN = ['Rusak', 'Hilang', 'Hitung fisik', 'Lainnya']
type Mode = 'kurang' | 'tambah' | 'hitung'

function Isi({ p }: { p: Produk }) {
  const nav = useNavigate()
  const { tampilkan } = useToast()
  const { sibuk, galat, kirim } = useKirim()
  const [mode, setMode] = useState<Mode>('kurang')
  const [jml, setJml] = useState('')
  const [alasan, setAlasan] = useState('Rusak')
  const [catatan, setCatatan] = useState('')

  const n = Number(jml)
  const ada = jml !== ''
  const perubahan = !ada ? 0 : mode === 'kurang' ? -n : mode === 'tambah' ? n : n - p.stok
  const baru = p.stok + perubahan
  const err = ada && baru < 0 ? `Stok sekarang ${p.stok}, tidak bisa dikurangi ${n}` : undefined

  const simpan = async () => {
    const teks = catatan.trim() ? `${alasan}: ${catatan.trim()}` : alasan
    const body = mode === 'hitung' ? { produk_id: p.id, alasan: teks, stok_fisik: n } : { produk_id: p.id, alasan: teks, selisih: perubahan }
    const r = await kirim(() => api<Penyesuaian>('/penyesuaian-stok', { method: 'POST', body }))
    if (!r.ok) return
    tampilkan(`Stok disesuaikan jadi ${r.hasil.stok_sesudah}.`)
    nav(`/produk/${p.id}`, { replace: true })
  }

  return (
    <div className="md:max-w-xl">
      <BilahAtas judul="Sesuaikan stok" tutup />
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3">
        <Thumb nama={p.nama} kecil />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium text-ink">{p.nama}</p>
          <p className="text-sm text-stone-500">Stok di aplikasi: {p.stok} pcs</p>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <Tabs<Mode>
          items={[
            { key: 'kurang', label: 'Kurangi' },
            { key: 'tambah', label: 'Tambah' },
            { key: 'hitung', label: 'Hasil hitung' },
          ]}
          value={mode}
          onChange={(j) => {
            setMode(j)
            setAlasan(j === 'hitung' ? 'Hitung fisik' : j === 'kurang' ? 'Rusak' : 'Lainnya')
          }}
        />
        <Input
          label={mode === 'hitung' ? 'Jumlah sebenarnya di rak' : mode === 'kurang' ? 'Dikurangi berapa pcs' : 'Ditambah berapa pcs'}
          inputMode="numeric"
          placeholder="0"
          value={jml}
          onChange={(e) => setJml(e.target.value.replace(/\D/g, '').slice(0, 6))}
          error={err}
        />
        <div>
          <Label>Alasan</Label>
          <Pilihan label="Alasan" items={ALASAN.map((a) => ({ key: a, label: a }))} value={alasan} onChange={setAlasan} />
        </div>
        <Input label="Catatan" placeholder="Opsional, mis. kena noda" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        {galat && (
          <p className="text-sm text-red-600" role="alert">
            {galat}
          </p>
        )}
        <p className="text-sm text-stone-500">Penyesuaian stok tidak mengubah modal/pcs.</p>
      </div>
      <BilahBawah
        ringkas={
          ada && !err ? (
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Stok</span>
              <span className="font-semibold text-ink tabular-nums" data-testid="ringkas-stok">
                {p.stok} → {baru} ({perubahan > 0 ? '+' : ''}
                {perubahan})
              </span>
            </div>
          ) : undefined
        }
      >
        <Button block className="min-h-12" disabled={!ada || !!err || perubahan === 0 || sibuk} onClick={simpan}>
          {sibuk ? 'Menyimpan…' : 'Simpan penyesuaian'}
        </Button>
      </BilahBawah>
    </div>
  )
}

export default function PenyesuaianStok() {
  const { id } = useParams()
  const produk = useApi<Produk>(`/produk/${id}`)
  return (
    <DataState hasil={produk} baris={3}>
      {(p) => <Isi key={p.id} p={p} />}
    </DataState>
  )
}
