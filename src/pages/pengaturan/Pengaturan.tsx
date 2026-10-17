import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarisLink, BilahAtas, Button, Daftar, IK, Ikon, Input, KepalaHalaman, Sheet } from '../../components/ui'
import { api } from '../../lib/api'
import type { KomponenModal, Pengaturan as TPengaturan, Saluran } from '../../lib/api-types'
import type { KategoriPengeluaran } from '../../lib/api-tahap2'
import { useAuth } from '../../lib/auth'
import { PEMBULATAN } from '../../lib/hitung'
import { useToast } from '../../lib/toast'
import { useApi } from '../../lib/useApi'
import { useKirim } from '../../lib/useKirim'

function GantiSandi({ buka, tutup }: { buka: boolean; tutup: () => void }) {
  const { tampilkan } = useToast()
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  const [coba, setCoba] = useState(false)
  const { sibuk, galat, kirim } = useKirim()

  const errBaru = !coba ? undefined : baru.length < 8 ? 'Kata sandi baru minimal 8 karakter' : baru.length > 72 ? 'Kata sandi baru maksimal 72 karakter' : undefined
  const errUlang = coba && baru !== ulang ? 'Kata sandi baru tidak sama' : undefined
  const errLama = coba && !lama ? 'Isi kata sandi lama' : undefined

  const simpan = async (e: FormEvent) => {
    e.preventDefault()
    setCoba(true)
    if (!lama || baru.length < 8 || baru.length > 72 || baru !== ulang) return
    const r = await kirim(() => api('/auth/ganti-password', { method: 'POST', body: { password_lama: lama, password_baru: baru } }))
    if (r.ok) {
      tampilkan('Kata sandi diganti. Perangkat lain perlu masuk lagi.')
      setLama('')
      setBaru('')
      setUlang('')
      setCoba(false)
      tutup()
    }
  }

  return (
    <Sheet open={buka} onClose={tutup} title="Ganti kata sandi">
      <form className="flex flex-col gap-4" onSubmit={simpan} noValidate>
        <Input label="Kata sandi lama" type="password" autoComplete="current-password" value={lama} onChange={(e) => setLama(e.target.value)} error={errLama} />
        <Input label="Kata sandi baru" type="password" autoComplete="new-password" hint="8–72 karakter" value={baru} onChange={(e) => setBaru(e.target.value)} error={errBaru} />
        <Input label="Ulangi kata sandi baru" type="password" autoComplete="new-password" value={ulang} onChange={(e) => setUlang(e.target.value)} error={errUlang} />
        {galat && (
          <p className="text-sm text-red-600" role="alert">
            {galat}
          </p>
        )}
        <Button type="submit" block disabled={sibuk}>
          {sibuk ? 'Menyimpan…' : 'Simpan kata sandi'}
        </Button>
      </form>
    </Sheet>
  )
}

function KeluarSemua({ buka, tutup }: { buka: boolean; tutup: () => void }) {
  const { keluar } = useAuth()
  const { sibuk, galat, kirim } = useKirim()
  return (
    <Sheet open={buka} onClose={tutup} title="Keluar dari semua perangkat?">
      <p className="mb-4 text-sm text-stone-600">Semua perangkat yang sedang masuk, termasuk ini, akan keluar dan perlu masuk lagi dengan kata sandi.</p>
      {galat && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {galat}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          variant="danger"
          block
          disabled={sibuk}
          onClick={async () => {
            const r = await kirim(() => api('/auth/logout-semua', { method: 'POST' }))
            if (r.ok) await keluar().catch(() => {})
          }}
        >
          Keluar dari semua perangkat
        </Button>
        <Button variant="ghost" block onClick={tutup}>
          Batal
        </Button>
      </div>
    </Sheet>
  )
}

export default function Pengaturan() {
  const { username, keluar } = useAuth()
  const nav = useNavigate()
  const saluran = useApi<Saluran[]>('/saluran')
  const komponen = useApi<KomponenModal[]>('/komponen-modal')
  const pengaturan = useApi<TPengaturan>('/pengaturan')
  const kategoriPengeluaran = useApi<KategoriPengeluaran[]>('/kategori-pengeluaran')
  const [sandi, setSandi] = useState(false)
  const [semua, setSemua] = useState(false)

  const menu: { to: string; ikon: string; judul: string; sub: string }[] = [
    { to: '/pengaturan/saluran', ikon: IK.saluran, judul: 'Saluran & potongan', sub: saluran.data ? `${saluran.data.filter((s) => s.aktif).length} saluran aktif` : 'Atur potongan tiap saluran' },
    { to: '/pengaturan/modal', ikon: IK.modal, judul: 'Komponen modal', sub: komponen.data ? `${komponen.data.filter((k) => k.aktif).length} komponen aktif` : 'Ongkir, plastik, dan biaya lain' },
    {
      to: '/pengaturan/pembulatan',
      ikon: IK.bulat,
      judul: 'Pembulatan harga',
      sub: pengaturan.data ? (PEMBULATAN.find((b) => b.key === pengaturan.data!.pembulatan_bawaan)?.label ?? '') : 'Pilihan awal di kalkulator',
    },
    {
      to: '/pengaturan/pengeluaran',
      ikon: IK.tag,
      judul: 'Kategori pengeluaran',
      sub: kategoriPengeluaran.data ? kategoriPengeluaran.data.filter((k) => k.aktif).map((k) => k.nama).join(', ') : 'Sewa lapak, iklan, packaging massal',
    },
  ]

  return (
    <div className="md:max-w-2xl">
      <div className="md:hidden">
        <BilahAtas judul="Pengaturan" kembali="/" />
      </div>
      <div className="hidden md:block">
        <KepalaHalaman judul="Pengaturan" />
      </div>
      <div className="flex flex-col gap-5">
        <Daftar judul="Usaha">
          {menu.map((m) => (
            <BarisLink key={m.to} to={m.to}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Ikon d={m.ikon} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{m.judul}</p>
                  <p className="truncate text-sm text-stone-500">{m.sub}</p>
                </div>
              </div>
            </BarisLink>
          ))}
        </Daftar>
        <Daftar judul="Akun">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-600">
              <Ikon d={IK.akun} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{username}</p>
              <p className="truncate text-sm text-stone-500">Masuk di perangkat ini</p>
            </div>
          </div>
          <button type="button" onClick={() => setSandi(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium text-ink hover:bg-stone-50">
            Ganti kata sandi
          </button>
          <button type="button" onClick={() => setSemua(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium text-ink hover:bg-stone-50">
            Keluar dari semua perangkat
          </button>
          <button
            type="button"
            onClick={async () => {
              await keluar()
              nav('/masuk-akun', { replace: true })
            }}
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium text-red-700 hover:bg-red-50"
          >
            <Ikon d={IK.keluar} /> Keluar
          </button>
        </Daftar>
      </div>
      <GantiSandi buka={sandi} tutup={() => setSandi(false)} />
      <KeluarSemua buka={semua} tutup={() => setSemua(false)} />
    </div>
  )
}
