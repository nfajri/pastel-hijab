import { useState } from 'react'
import { useParams } from 'react-router-dom'
import DataState from '../../components/DataState'
import { BarisLink, BilahAtas, Button, Daftar, IK, Ikon, Input, Label, Lencana, RupiahInput, Saklar, Sheet, Tabs } from '../../components/ui'
import { api, pesanError } from '../../lib/api'
import type { JenisPotongan, Potongan, Saluran } from '../../lib/api-types'
import { fmtPersen, labelPotongan, parseDesimal, rp, tampilDesimal, LABEL_JENIS_POTONGAN } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { useKirim } from '../../lib/useKirim'

export function DaftarSaluran() {
  const hasil = useApi<Saluran[]>('/saluran')
  const [tambah, setTambah] = useState(false)
  const [nama, setNama] = useState('')
  const { sibuk, galat, setGalat, kirim } = useKirim()

  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul="Saluran & potongan" kembali="/pengaturan" />
      <DataState hasil={hasil} baris={4}>
        {(list) => (
          <>
            <Daftar>
              {list.map((s) => (
                <BarisLink key={s.id} to={`/pengaturan/saluran/${s.id}`} kanan={!s.aktif ? <Lencana>Nonaktif</Lencana> : undefined}>
                  <p className="font-medium text-ink">{s.nama}</p>
                  <p className="truncate text-sm text-stone-500">{s.potongan.length ? s.potongan.map((k) => k.nama).join(' · ') : 'Tanpa potongan'}</p>
                </BarisLink>
              ))}
            </Daftar>
            <Button
              variant="secondary"
              block
              className="mt-4"
              onClick={() => {
                setNama('')
                setGalat('')
                setTambah(true)
              }}
            >
              <Ikon d={IK.plus} /> Tambah saluran
            </Button>
            <p className="mt-4 px-1 text-sm text-stone-500">Aturan potongan marketplace sering berubah. Perbarui angkanya di sini; penjualan lama tidak ikut berubah.</p>
            <Sheet open={tambah} onClose={() => setTambah(false)} title="Tambah saluran">
              <form
                className="flex flex-col gap-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!nama.trim()) return setGalat('Nama saluran wajib diisi')
                  const r = await kirim(() => api<Saluran>('/saluran', { method: 'POST', body: { nama: nama.trim() } }))
                  if (r.ok) {
                    hasil.setData([...list, r.hasil])
                    setTambah(false)
                  }
                }}
              >
                <Input label="Nama saluran" placeholder="mis. Instagram" value={nama} onChange={(e) => setNama(e.target.value)} error={galat || undefined} />
                <Button type="submit" block disabled={sibuk}>
                  {sibuk ? 'Menyimpan…' : 'Simpan'}
                </Button>
              </form>
            </Sheet>
          </>
        )}
      </DataState>
    </div>
  )
}

const JENIS: { key: JenisPotongan; label: string }[] = (Object.keys(LABEL_JENIS_POTONGAN) as JenisPotongan[]).map((key) => ({ key, label: LABEL_JENIS_POTONGAN[key] }))

interface Draf {
  id: number | null
  nama: string
  jenis: JenisPotongan
  nilai: number | null
  maks: number | null
  aktif: boolean
}

function FormPotongan({ saluranId, awal, onSelesai, onHapus }: { saluranId: number; awal: Draf; onSelesai: () => void; onHapus: () => void }) {
  const [d, setD] = useState(awal)
  const [coba, setCoba] = useState(false)
  const { sibuk, galat, kirim } = useKirim()
  const persen = d.jenis === 'persen'
  const errNama = coba && !d.nama.trim() ? 'Nama potongan wajib diisi' : undefined
  const errNilai = coba && d.nilai == null ? 'Isi nilainya' : coba && persen && (d.nilai ?? 0) >= 100 ? 'Persen harus di bawah 100' : undefined

  const simpan = async () => {
    setCoba(true)
    if (!d.nama.trim() || d.nilai == null || (persen && d.nilai >= 100)) return
    const body = { nama: d.nama.trim(), jenis: d.jenis, nilai: d.nilai, maks_rp: persen ? d.maks : null, aktif: d.aktif }
    const r = await kirim(() => (d.id ? api<Potongan>(`/potongan/${d.id}`, { method: 'PATCH', body }) : api<Potongan>(`/saluran/${saluranId}/potongan`, { method: 'POST', body })))
    if (r.ok) onSelesai()
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Nama potongan" placeholder="mis. Biaya admin" value={d.nama} onChange={(e) => setD({ ...d, nama: e.target.value })} error={errNama} />
      <div>
        <Label>Jenis</Label>
        <Tabs items={JENIS} value={d.jenis} onChange={(j) => setD({ ...d, jenis: j })} />
      </div>
      {persen ? (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Persen" inputMode="decimal" value={tampilDesimal(d.nilai)} onChange={(e) => setD({ ...d, nilai: parseDesimal(e.target.value) })} error={errNilai} />
          <RupiahInput label="Maksimal" hint="Kosongkan bila tanpa batas" value={d.maks} onValueChange={(v) => setD({ ...d, maks: v })} />
        </div>
      ) : (
        <RupiahInput label={d.jenis === 'per_pesanan' ? 'Rupiah per pesanan' : 'Rupiah per pcs'} value={d.nilai} onValueChange={(v) => setD({ ...d, nilai: v })} error={errNilai} />
      )}
      <div className="flex items-center justify-between">
        <span className="font-medium text-ink">Aktif</span>
        <Saklar label="Potongan aktif" aktif={d.aktif} onChange={(v) => setD({ ...d, aktif: v })} />
      </div>
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
          Hapus potongan
        </Button>
      )}
    </div>
  )
}

export function DetailSaluran() {
  const { id } = useParams()
  const hasil = useApi<Saluran>(`/saluran/${id}`)
  const [edit, setEdit] = useState<Draf | null>(null)
  const [hapus, setHapus] = useState<Potongan | null>(null)
  const [ubahNama, setUbahNama] = useState<string | null>(null)
  const [galatToggle, setGalatToggle] = useState('')
  const aksi = useKirim()

  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul={hasil.data?.nama ?? 'Saluran'} kembali="/pengaturan/saluran" />
      <DataState hasil={hasil} baris={4}>
        {(s) => {
          const aktifPot = s.potongan.filter((k) => k.aktif)
          const total = aktifPot.filter((k) => k.jenis === 'persen').reduce((t, k) => t + k.nilai, 0)
          const tetap = aktifPot.filter((k) => k.jenis !== 'persen')
          const draf: Draf = { id: null, nama: '', jenis: 'persen', nilai: null, maks: null, aktif: true }
          return (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-3">
                <div>
                  <p className="font-medium text-ink">Saluran aktif</p>
                  <p className="text-sm text-stone-500">Saluran nonaktif tidak muncul saat mencatat penjualan.</p>
                </div>
                <Saklar
                  label="Saluran aktif"
                  aktif={s.aktif}
                  onChange={async (v) => {
                    setGalatToggle('')
                    try {
                      hasil.setData(await api<Saluran>(`/saluran/${s.id}`, { method: 'PATCH', body: { aktif: v } }))
                    } catch (e) {
                      setGalatToggle(pesanError(e))
                    }
                  }}
                />
              </div>
              {galatToggle && (
                <p className="text-sm text-red-600" role="alert">
                  {galatToggle}
                </p>
              )}
              <button type="button" onClick={() => { aksi.setGalat(''); setUbahNama(s.nama) }} className="-mt-2 self-start px-1 text-sm font-semibold text-brand-700">
                Ubah nama saluran
              </button>
              <Daftar
                judul="Komponen potongan"
                aksi={
                  aktifPot.length > 0 && (
                    <span className="text-sm text-stone-500 tabular-nums">
                      Total {total > 0 ? fmtPersen(total) : ''}
                      {total > 0 && tetap.length ? ' + ' : ''}
                      {tetap.map((k) => rp(k.nilai) + (k.jenis === 'per_pcs' ? '/pcs' : '')).join(' + ')}
                    </span>
                  )
                }
              >
                {s.potongan.length === 0 && <p className="px-4 py-4 text-sm text-stone-500">Tanpa potongan. Sewa lapak dicatat sebagai pengeluaran, bukan potongan.</p>}
                {s.potongan.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setEdit({ id: k.id, nama: k.nama, jenis: k.jenis, nilai: k.nilai, maks: k.maks_rp, aktif: k.aktif })}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${k.aktif ? 'text-ink' : 'text-stone-400'}`}>{k.nama}</p>
                      <p className="text-sm text-stone-500">{labelPotongan(k)}</p>
                    </div>
                    {!k.aktif && <Lencana>Nonaktif</Lencana>}
                    <Ikon d={IK.kanan} className="h-4 w-4 text-stone-400" />
                  </button>
                ))}
              </Daftar>
              <Button variant="secondary" block onClick={() => setEdit(draf)}>
                <Ikon d={IK.plus} /> Tambah potongan
              </Button>
              <p className="px-1 text-sm text-stone-500">Penjualan lama tidak ikut berubah bila potongan diubah.</p>

              <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah potongan' : 'Tambah potongan'}>
                {edit && (
                  <FormPotongan
                    key={edit.id ?? 'baru'}
                    saluranId={s.id}
                    awal={edit}
                    onSelesai={() => {
                      setEdit(null)
                      hasil.muat()
                    }}
                    onHapus={() => {
                      setHapus(s.potongan.find((x) => x.id === edit.id) ?? null)
                      setEdit(null)
                    }}
                  />
                )}
              </Sheet>
              <Sheet open={!!hapus} onClose={() => setHapus(null)} title="Hapus potongan?">
                {hapus && (
                  <>
                    <p className="mb-4 text-sm text-stone-600">“{hapus.nama}” dihapus dari saluran {s.nama}. Penjualan lama tidak ikut berubah.</p>
                    {aksi.galat && (
                      <p className="mb-3 text-sm text-red-600" role="alert">
                        {aksi.galat}
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="danger"
                        block
                        disabled={aksi.sibuk}
                        onClick={async () => {
                          const r = await aksi.kirim(() => api(`/potongan/${hapus.id}`, { method: 'DELETE' }))
                          if (r.ok) {
                            setHapus(null)
                            hasil.muat()
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
              <Sheet open={ubahNama !== null} onClose={() => setUbahNama(null)} title="Ubah nama saluran">
                <form
                  className="flex flex-col gap-4"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!ubahNama?.trim()) return aksi.setGalat('Nama saluran wajib diisi')
                    const r = await aksi.kirim(() => api<Saluran>(`/saluran/${s.id}`, { method: 'PATCH', body: { nama: ubahNama.trim() } }))
                    if (r.ok) {
                      hasil.setData(r.hasil)
                      setUbahNama(null)
                    }
                  }}
                >
                  <Input label="Nama saluran" value={ubahNama ?? ''} onChange={(e) => setUbahNama(e.target.value)} error={aksi.galat || undefined} />
                  <Button type="submit" block disabled={aksi.sibuk}>
                    Simpan
                  </Button>
                </form>
              </Sheet>
            </div>
          )
        }}
      </DataState>
    </div>
  )
}
