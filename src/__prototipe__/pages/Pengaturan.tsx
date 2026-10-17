import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Input, RupiahInput, Sheet, Tabs } from '../../components/ui'
import type { Saluran } from '../lib/data'
import { PEMBULATAN, labelModal, labelPotongan, type JenisModal, type JenisPotongan, type KomponenModal, type KomponenPotongan, type Pembulatan } from '../lib/hitung'
import { useStore, type ModeData } from '../lib/store'
import { BarisLink, BilahAtas, Daftar, IK, Ikon, KepalaHalaman, Label, Lencana, Saklar } from '../ui'
import logoLengkap from '../../assets/brand/logo-lengkap.png'

export default function Pengaturan() {
  const st = useStore()
  const nav = useNavigate()
  const menu: { to: string; ikon: string; judul: string; sub: string }[] = [
    { to: '/pengaturan/saluran', ikon: IK.saluran, judul: 'Saluran & potongan', sub: `${st.saluran.filter((s) => s.aktif).length} saluran aktif` },
    { to: '/pengaturan/modal', ikon: IK.modal, judul: 'Komponen modal', sub: `${st.komponenModal.filter((k) => k.aktif).length} komponen aktif` },
    { to: '/pengaturan/pembulatan', ikon: IK.bulat, judul: 'Pembulatan harga', sub: PEMBULATAN.find((b) => b.key === st.pembulatan)!.label },
    { to: '/pengaturan/biaya', ikon: IK.tag, judul: 'Kategori biaya', sub: st.kategoriBiaya.join(', ') },
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
              <p className="font-medium text-ink">Ibu Rahma</p>
              <p className="truncate text-sm text-stone-500">rahma.hijab@gmail.com</p>
            </div>
          </div>
          <BarisLink to="/pengaturan">
            <p className="font-medium text-ink">Ganti kata sandi</p>
          </BarisLink>
          <button type="button" onClick={() => nav('/masuk-akun')} className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium text-red-700 hover:bg-red-50">
            <Ikon d={IK.keluar} /> Keluar
          </button>
        </Daftar>

        <section className="rounded-2xl border border-dashed border-stone-300 p-4">
          <p className="text-sm font-semibold text-stone-700">Khusus prototipe: keadaan data</p>
          <p className="mb-3 text-xs text-stone-500">Untuk melihat tampilan saat data kosong, sedang dimuat, atau gagal dimuat. Tidak ada di aplikasi asli.</p>
          <Tabs<ModeData>
            items={[
              { key: 'normal', label: 'Normal' },
              { key: 'kosong', label: 'Kosong' },
              { key: 'memuat', label: 'Memuat' },
              { key: 'gagal', label: 'Gagal' },
            ]}
            value={st.mode}
            onChange={st.setMode}
          />
        </section>
      </div>
    </div>
  )
}

export function DaftarSaluran() {
  const st = useStore()
  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul="Saluran & potongan" kembali="/pengaturan" />
      <Daftar>
        {st.saluran.map((s) => (
          <BarisLink key={s.id} to={`/pengaturan/saluran/${s.id}`} kanan={!s.aktif ? <Lencana>Nonaktif</Lencana> : undefined}>
            <p className="font-medium text-ink">{s.nama}</p>
            <p className="truncate text-sm text-stone-500">{s.potongan.length ? s.potongan.map((k) => k.nama).join(' · ') : 'Tanpa potongan'}</p>
          </BarisLink>
        ))}
      </Daftar>
      <Button variant="secondary" block className="mt-4">
        <Ikon d={IK.plus} /> Tambah saluran
      </Button>
      <p className="mt-4 px-1 text-sm text-stone-500">Aturan potongan marketplace sering berubah. Perbarui angkanya di sini; penjualan lama tidak ikut berubah.</p>
    </div>
  )
}

const JENIS_POT: { key: JenisPotongan; label: string }[] = [
  { key: 'persen', label: '% harga jual' },
  { key: 'perPesanan', label: 'Rp/pesanan' },
  { key: 'perPcs', label: 'Rp/pcs' },
]

function FormPotongan({ awal, onSimpan, onHapus }: { awal: KomponenPotongan; onSimpan: (k: KomponenPotongan) => void; onHapus?: () => void }) {
  const [k, setK] = useState(awal)
  const persen = k.jenis === 'persen'
  return (
    <div className="flex flex-col gap-4">
      <Input label="Nama potongan" placeholder="mis. Biaya admin" value={k.nama} onChange={(e) => setK({ ...k, nama: e.target.value })} />
      <div>
        <Label>Jenis</Label>
        <Tabs items={JENIS_POT} value={k.jenis} onChange={(j) => setK({ ...k, jenis: j })} />
      </div>
      {persen ? (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Persen" inputMode="decimal" value={String(k.nilai).replace('.', ',')} onChange={(e) => setK({ ...k, nilai: Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0 })} />
          <RupiahInput label="Maksimal" hint="Kosongkan bila tanpa batas" value={k.maks ?? null} onValueChange={(v) => setK({ ...k, maks: v })} />
        </div>
      ) : (
        <RupiahInput label={k.jenis === 'perPesanan' ? 'Rupiah per pesanan' : 'Rupiah per pcs'} value={k.nilai} onValueChange={(v) => setK({ ...k, nilai: v ?? 0 })} />
      )}
      <Button block onClick={() => onSimpan(k)} disabled={!k.nama.trim()}>
        Simpan
      </Button>
      {onHapus && (
        <Button variant="ghost" block className="text-red-700" onClick={onHapus}>
          Hapus potongan
        </Button>
      )}
    </div>
  )
}

export function DetailSaluran() {
  const { id } = useParams()
  const st = useStore()
  const s = st.saluran.find((x) => x.id === id)
  const [edit, setEdit] = useState<KomponenPotongan | null>(null)
  if (!s) return <BilahAtas judul="Saluran tidak ditemukan" kembali="/pengaturan/saluran" />
  const ubah = (baru: Saluran) => st.update('saluran', st.saluran.map((x) => (x.id === s.id ? baru : x)))
  const total = s.potongan.filter((k) => k.jenis === 'persen').reduce((t, k) => t + k.nilai, 0)
  const rp = s.potongan.filter((k) => k.jenis !== 'persen')

  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul={s.nama} kembali="/pengaturan/saluran" />
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-3">
          <div>
            <p className="font-medium text-ink">Saluran aktif</p>
            <p className="text-sm text-stone-500">Saluran nonaktif tidak muncul saat mencatat penjualan.</p>
          </div>
          <Saklar label="Saluran aktif" aktif={s.aktif} onChange={(v) => ubah({ ...s, aktif: v })} />
        </div>
        <Daftar
          judul="Komponen potongan"
          aksi={
            s.potongan.length > 0 && (
              <span className="text-sm text-stone-500 tabular-nums">
                Total {String(total).replace('.', ',')}%{rp.length ? ` + ${rp.map((k) => labelPotongan(k).split(' ')[0]).join(' + ')}` : ''}
              </span>
            )
          }
        >
          {s.potongan.length === 0 && <p className="px-4 py-4 text-sm text-stone-500">Tanpa potongan. Sewa lapak dicatat sebagai biaya, bukan potongan.</p>}
          {s.potongan.map((k) => (
            <button key={k.id} type="button" onClick={() => setEdit(k)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{k.nama}</p>
                <p className="text-sm text-stone-500">{labelPotongan(k)}</p>
              </div>
              <Ikon d={IK.kanan} className="h-4 w-4 text-stone-400" />
            </button>
          ))}
        </Daftar>
        <Button variant="secondary" block onClick={() => setEdit({ id: '', nama: '', jenis: 'persen', nilai: 0 })}>
          <Ikon d={IK.plus} /> Tambah potongan
        </Button>
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah potongan' : 'Tambah potongan'}>
        {edit && (
          <FormPotongan
            awal={edit}
            onSimpan={(k) => {
              ubah({ ...s, potongan: k.id ? s.potongan.map((x) => (x.id === k.id ? k : x)) : [...s.potongan, { ...k, id: `k${Date.now()}` }] })
              setEdit(null)
            }}
            onHapus={
              edit.id
                ? () => {
                    ubah({ ...s, potongan: s.potongan.filter((x) => x.id !== edit.id) })
                    setEdit(null)
                  }
                : undefined
            }
          />
        )}
      </Sheet>
    </div>
  )
}

const JENIS_MODAL: { key: JenisModal; label: string }[] = [
  { key: 'perPcs', label: 'Rp/pcs' },
  { key: 'perKulakan', label: 'Rp/kulakan' },
  { key: 'persenBeli', label: '% beli' },
]

export function KomponenModalPage() {
  const st = useStore()
  const [edit, setEdit] = useState<KomponenModal | null>(null)
  const simpan = (k: KomponenModal) => st.update('komponenModal', k.id ? st.komponenModal.map((x) => (x.id === k.id ? k : x)) : [...st.komponenModal, { ...k, id: `km${Date.now()}` }])

  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul="Komponen modal" kembali="/pengaturan" />
      <p className="mb-4 px-1 text-sm text-stone-500">Biaya yang ditambahkan ke harga beli saat barang masuk. Komponen nonaktif tidak muncul di kulakan baru.</p>
      <Daftar>
        {st.komponenModal.map((k) => (
          <div key={k.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
            <button type="button" onClick={() => setEdit(k)} className="min-w-0 flex-1 text-left">
              <p className={`font-medium ${k.aktif ? 'text-ink' : 'text-stone-400'}`}>{k.nama}</p>
              <p className="text-sm text-stone-500">{labelModal(k)}</p>
            </button>
            <Saklar label={`${k.nama} aktif`} aktif={k.aktif} onChange={(v) => simpan({ ...k, aktif: v })} />
          </div>
        ))}
      </Daftar>
      <Button variant="secondary" block className="mt-4" onClick={() => setEdit({ id: '', nama: '', jenis: 'perPcs', nilai: 0, aktif: true })}>
        <Ikon d={IK.plus} /> Tambah komponen
      </Button>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah komponen' : 'Tambah komponen'}>
        {edit && (
          <div className="flex flex-col gap-4">
            <Input label="Nama komponen" placeholder="mis. Hangtag" value={edit.nama} onChange={(e) => setEdit({ ...edit, nama: e.target.value })} />
            <div>
              <Label>Jenis</Label>
              <Tabs items={JENIS_MODAL} value={edit.jenis} onChange={(j) => setEdit({ ...edit, jenis: j })} />
              <p className="mt-1.5 text-sm text-stone-500">
                {edit.jenis === 'perPcs' ? 'Ditambahkan ke setiap pcs.' : edit.jenis === 'perKulakan' ? 'Satu kali per kulakan, dibagi rata ke jumlah pcs.' : 'Persen dari harga beli per pcs.'}
              </p>
            </div>
            {edit.jenis === 'persenBeli' ? (
              <Input label="Nilai bawaan (%)" inputMode="decimal" value={String(edit.nilai).replace('.', ',')} onChange={(e) => setEdit({ ...edit, nilai: Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0 })} />
            ) : (
              <RupiahInput label="Nilai bawaan" value={edit.nilai} onValueChange={(v) => setEdit({ ...edit, nilai: v ?? 0 })} />
            )}
            <Button
              block
              disabled={!edit.nama.trim()}
              onClick={() => {
                simpan(edit)
                setEdit(null)
              }}
            >
              Simpan
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

export function PembulatanPage() {
  const st = useStore()
  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul="Pembulatan harga" kembali="/pengaturan" />
      <p className="mb-4 px-1 text-sm text-stone-500">Pilihan awal di kalkulator. Tetap bisa diganti setiap kali menghitung. Selalu dibulatkan ke atas.</p>
      <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white" role="radiogroup" aria-label="Pembulatan bawaan">
        {PEMBULATAN.map((b) => (
          <button
            key={b.key}
            type="button"
            role="radio"
            aria-checked={st.pembulatan === b.key}
            onClick={() => st.update('pembulatan', b.key as Pembulatan)}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50"
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${st.pembulatan === b.key ? 'border-brand-700' : 'border-stone-300'}`}>
              {st.pembulatan === b.key && <span className="h-2.5 w-2.5 rounded-full bg-brand-700" />}
            </span>
            <span className="flex-1 font-medium text-ink">{b.key === 'tanpa' ? 'Tanpa pembulatan' : b.key === 'cantik' ? 'Harga cantik (…900)' : `Ke atas kelipatan ${b.label}`}</span>
            <span className="text-sm text-stone-500 tabular-nums">43.750 → {b.contoh}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function KategoriBiayaPage() {
  const st = useStore()
  const [baru, setBaru] = useState('')
  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul="Kategori biaya" kembali="/pengaturan" />
      <Daftar>
        {st.kategoriBiaya.map((k) => (
          <div key={k} className="flex min-h-14 items-center px-4 py-3 font-medium text-ink">
            {k}
          </div>
        ))}
      </Daftar>
      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <Input label="Kategori baru" placeholder="mis. Ongkir retur" value={baru} onChange={(e) => setBaru(e.target.value)} />
        </div>
        <Button
          disabled={!baru.trim()}
          onClick={() => {
            st.update('kategoriBiaya', [...st.kategoriBiaya, baru.trim()])
            setBaru('')
          }}
        >
          Tambah
        </Button>
      </div>
    </div>
  )
}

export function Masuk() {
  const nav = useNavigate()
  const [salah, setSalah] = useState(false)
  const [sandi, setSandi] = useState('')
  return (
    <div className="flex min-h-full items-center justify-center bg-krem px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1>
            <img src={logoLengkap} alt="Pastel Hijab" className="mx-auto w-36" />
          </h1>
          <p className="mt-3 text-sm text-stone-500">Masuk untuk melanjutkan</p>
        </div>
        <form
          className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            if (sandi.length < 4) setSalah(true)
            else nav('/')
          }}
        >
          <Input label="Email" type="email" autoComplete="username" defaultValue="rahma.hijab@gmail.com" />
          <Input
            label="Kata sandi"
            type="password"
            autoComplete="current-password"
            value={sandi}
            onChange={(e) => {
              setSandi(e.target.value)
              setSalah(false)
            }}
            error={salah ? 'Email atau kata sandi salah. Coba lagi.' : undefined}
          />
          <Button type="submit" block className="min-h-12">
            Masuk
          </Button>
          <Link to="/masuk-akun" className="text-center text-sm font-semibold text-brand-700">
            Lupa kata sandi?
          </Link>
        </form>
        <p className="mt-6 text-center text-xs text-stone-500">Tetap masuk di perangkat ini sampai Ibu memilih Keluar.</p>
      </div>
    </div>
  )
}

