import { useState } from 'react'
import DataState from '../../components/DataState'
import { BilahAtas, Button, Daftar, IK, Ikon, Input, Kosong, Label, RupiahInput, Saklar, Sheet, Tabs } from '../../components/ui'
import { api, pesanError } from '../../lib/api'
import type { JenisModal, KomponenModal } from '../../lib/api-types'
import { labelModal, parseDesimal, tampilDesimal } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { useKirim } from '../../lib/useKirim'

const JENIS: { key: JenisModal; label: string }[] = [
  { key: 'per_pcs', label: 'Rp/pcs' },
  { key: 'per_kulakan', label: 'Rp/kulakan' },
  { key: 'persen_harga_beli', label: '% beli' },
]

interface Draf {
  id: number | null
  nama: string
  jenis: JenisModal
  nilai: number | null
  aktif: boolean
}

function FormKomponen({ awal, onSelesai, onHapus }: { awal: Draf; onSelesai: (k: KomponenModal) => void; onHapus: () => void }) {
  const [d, setD] = useState(awal)
  const [coba, setCoba] = useState(false)
  const { sibuk, galat, kirim } = useKirim()
  const errNama = coba && !d.nama.trim() ? 'Nama komponen wajib diisi' : undefined
  const errNilai = coba && d.nilai == null ? 'Isi nilai bawaan' : undefined

  const simpan = async () => {
    setCoba(true)
    if (!d.nama.trim() || d.nilai == null) return
    const body = { nama: d.nama.trim(), jenis: d.jenis, nilai: d.nilai, aktif: d.aktif }
    const r = await kirim(() => (d.id ? api<KomponenModal>(`/komponen-modal/${d.id}`, { method: 'PATCH', body }) : api<KomponenModal>('/komponen-modal', { method: 'POST', body })))
    if (r.ok) onSelesai(r.hasil)
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Nama komponen" placeholder="mis. Hangtag" value={d.nama} onChange={(e) => setD({ ...d, nama: e.target.value })} error={errNama} />
      <div>
        <Label>Jenis</Label>
        <Tabs items={JENIS} value={d.jenis} onChange={(j) => setD({ ...d, jenis: j })} />
        <p className="mt-1.5 text-sm text-stone-500">
          {d.jenis === 'per_pcs' ? 'Ditambahkan ke setiap pcs.' : d.jenis === 'per_kulakan' ? 'Satu kali per kulakan, dibagi rata ke jumlah pcs.' : 'Persen dari harga beli per pcs.'}
        </p>
      </div>
      {d.jenis === 'persen_harga_beli' ? (
        <Input label="Nilai bawaan (%)" inputMode="decimal" value={tampilDesimal(d.nilai)} onChange={(e) => setD({ ...d, nilai: parseDesimal(e.target.value) })} error={errNilai} />
      ) : (
        <RupiahInput label="Nilai bawaan" value={d.nilai} onValueChange={(v) => setD({ ...d, nilai: v })} error={errNilai} />
      )}
      <div className="flex items-center justify-between">
        <span className="font-medium text-ink">Aktif</span>
        <Saklar label="Aktif" aktif={d.aktif} onChange={(v) => setD({ ...d, aktif: v })} />
      </div>
      <p className="text-xs text-stone-500">Mengubah atau menghapus komponen tidak mengubah kulakan yang sudah tercatat.</p>
      {galat && (
        <p className="text-sm text-red-600" role="alert">
          {galat}
        </p>
      )}
      <Button block onClick={simpan} disabled={sibuk}>
        {sibuk ? 'Menyimpan…' : 'Simpan'}
      </Button>
      {d.id && (
        <Button variant="ghost" block className="text-red-700" onClick={onHapus} disabled={sibuk}>
          Hapus komponen
        </Button>
      )}
    </div>
  )
}

export default function KomponenModalPage() {
  const hasil = useApi<KomponenModal[]>('/komponen-modal')
  const [edit, setEdit] = useState<Draf | null>(null)
  const [hapus, setHapus] = useState<KomponenModal | null>(null)
  const [galatToggle, setGalatToggle] = useState('')
  const hps = useKirim()

  const ganti = (k: KomponenModal) => hasil.data && hasil.setData(hasil.data.some((x) => x.id === k.id) ? hasil.data.map((x) => (x.id === k.id ? k : x)) : [...hasil.data, k])

  const toggle = async (k: KomponenModal, aktif: boolean) => {
    setGalatToggle('')
    try {
      ganti(await api<KomponenModal>(`/komponen-modal/${k.id}`, { method: 'PATCH', body: { aktif } }))
    } catch (e) {
      setGalatToggle(pesanError(e))
    }
  }

  const barisBaru: Draf = { id: null, nama: '', jenis: 'per_pcs', nilai: null, aktif: true }

  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul="Komponen modal" kembali="/pengaturan" />
      <p className="mb-4 px-1 text-sm text-stone-500">Biaya yang ditambahkan ke harga beli saat barang masuk. Komponen nonaktif tidak muncul di kulakan baru.</p>
      <DataState hasil={hasil} baris={4}>
        {(list) => (
          <>
            {galatToggle && (
              <p className="mb-3 text-sm text-red-600" role="alert">
                {galatToggle}
              </p>
            )}
            {list.length === 0 ? (
              <Kosong ikon={IK.modal} judul="Belum ada komponen modal" teks="Tambahkan biaya seperti ongkir kulakan atau plastik supaya modal per pcs akurat." />
            ) : (
              <Daftar>
                {list.map((k) => (
                  <div key={k.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => setEdit({ id: k.id, nama: k.nama, jenis: k.jenis, nilai: k.nilai, aktif: k.aktif })} className="min-w-0 flex-1 text-left">
                      <p className={`font-medium ${k.aktif ? 'text-ink' : 'text-stone-400'}`}>{k.nama}</p>
                      <p className="text-sm text-stone-500">{labelModal(k)}</p>
                    </button>
                    <Saklar label={`${k.nama} aktif`} aktif={k.aktif} onChange={(v) => toggle(k, v)} />
                  </div>
                ))}
              </Daftar>
            )}
            <Button variant="secondary" block className="mt-4" onClick={() => setEdit(barisBaru)}>
              <Ikon d={IK.plus} /> Tambah komponen
            </Button>
            <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah komponen' : 'Tambah komponen'}>
              {edit && (
                <FormKomponen
                  key={edit.id ?? 'baru'}
                  awal={edit}
                  onSelesai={(k) => {
                    ganti(k)
                    setEdit(null)
                  }}
                  onHapus={() => {
                    setHapus(list.find((x) => x.id === edit.id) ?? null)
                    setEdit(null)
                  }}
                />
              )}
            </Sheet>
            <Sheet open={!!hapus} onClose={() => setHapus(null)} title="Hapus komponen?">
              {hapus && (
                <>
                  <p className="mb-4 text-sm text-stone-600">
                    “{hapus.nama}” dihapus dari daftar. Kulakan yang sudah tercatat tidak berubah. Untuk sementara, cukup nonaktifkan bila nanti mungkin dipakai lagi.
                  </p>
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
                        const r = await hps.kirim(() => api(`/komponen-modal/${hapus.id}`, { method: 'DELETE' }))
                        if (r.ok) {
                          hasil.setData(list.filter((x) => x.id !== hapus.id))
                          setHapus(null)
                        }
                      }}
                    >
                      Hapus
                    </Button>
                    <Button variant="ghost" block onClick={() => setHapus(null)}>
                      Batal
                    </Button>
                  </div>
                </>
              )}
            </Sheet>
          </>
        )}
      </DataState>
    </div>
  )
}
