// Kalkulator harga (desain final Opsi B): satu target untuk semua saluran, tiap kartu saluran terisi saran dan bisa diketik ulang (mode cek).
// Semua angka (saran, minimal, untung, status) dihitung server: POST /api/kalkulator.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DataState from '../../components/DataState'
import { Button, IK, Ikon, KepalaHalaman, Kosong, Label, Lencana, Pilihan, RupiahInput, Sheet, StokLencana, Tabs, Thumb } from '../../components/ui'
import { api } from '../../lib/api'
import type { Pengaturan, Pembulatan } from '../../lib/api-types'
import type { CaraTarget, KalkulatorInput, KartuSaluran, ProdukT2 } from '../../lib/api-tahap2'
import { fmtPersen, rp, rpModal } from '../../lib/format'
import { PEMBULATAN } from '../../lib/hitung'
import { useToast } from '../../lib/toast'
import { useApi } from '../../lib/useApi'
import { useKirim } from '../../lib/useKirim'
import { CARA, teksBulatPendek, teksTarget, useKalkulator } from './useKalkulator'

type Ketik = Record<number, number | null | undefined>

function Status({ k, diketik }: { k: KartuSaluran; diketik: boolean }) {
  if (k.status === 'tidak_tercapai') return diketik ? null : <Lencana nada="bahaya">Target tidak bisa dicapai</Lencana>
  if (k.status === 'rugi') return <Lencana nada="bahaya">Rugi · kurang {rp(k.kurang_rp)}</Lencana>
  if (k.status === 'di_bawah_target') return <Lencana nada="peringatan">Di bawah target</Lencana>
  return <Lencana nada="baik">Sesuai target</Lencana>
}

function Kartu({
  k,
  produkId,
  cara,
  nilaiTarget,
  harga,
  setHarga,
  usang,
  sesudahPakai,
  bawahTarget,
}: {
  k: KartuSaluran
  produkId: number
  cara: CaraTarget
  nilaiTarget: number
  harga: number | null | undefined
  setHarga: (v: number | null | undefined) => void
  usang: boolean
  sesudahPakai: () => void
  /** Harga tersimpan di saluran ini sekarang di bawah target untung (dari server). */
  bawahTarget: boolean
}) {
  const [buka, setBuka] = useState(false)
  const { tampilkan } = useToast()
  const { sibuk, galat, kirim } = useKirim()
  const kosong = harga === null
  const nilai = harga === undefined ? k.saran : harga
  const diketik = typeof harga === 'number' && harga !== k.saran
  const r = !kosong ? k.rincian : null
  const rugi = !kosong && k.status === 'rugi'

  const pakai = async () => {
    if (!nilai) return
    const hasil = await kirim(() => api(`/produk/${produkId}/harga/${k.saluran_id}`, { method: 'PUT', body: { harga: nilai, target_cara: cara, target_nilai: nilaiTarget } }))
    if (!hasil.ok) return
    tampilkan(`Harga ${k.saluran_nama} jadi ${rp(nilai)}.`)
    sesudahPakai()
  }

  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm" data-testid={`kartu-${k.saluran_id}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{k.saluran_nama}</h3>
        <span className={usang ? 'opacity-50' : ''}>{!kosong && <Status k={k} diketik={diketik} />}</span>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <RupiahInput aria-label={`Harga jual ${k.saluran_nama}`} value={nilai} onValueChange={setHarga} className="text-lg font-semibold" />
        <div className={`pb-1 text-right ${usang ? 'opacity-50' : ''}`}>
          <p className="text-xs text-stone-500">Untung</p>
          <p className={`font-bold whitespace-nowrap tabular-nums ${r && r.untung < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{r ? rp(r.untung) : '—'}</p>
        </div>
      </div>
      <p className={`mt-2 text-sm text-stone-500 tabular-nums ${usang ? 'opacity-50' : ''}`}>
        {diketik ? (
          <>
            Saran {k.saran != null ? rp(k.saran) : '—'} ·{' '}
            <button type="button" className="font-semibold text-brand-700" onClick={() => setHarga(undefined)}>
              pakai saran
            </button>
          </>
        ) : !k.tercapai ? (
          k.pesan
        ) : (
          <>
            Minimal {k.minimal != null ? rp(k.minimal) : '—'} · sekarang {k.harga_sekarang ? rp(k.harga_sekarang) : 'belum ada'}
          </>
        )}
      </p>
      {bawahTarget && !diketik && (
        <p className="mt-1 text-sm font-medium text-amber-800">Harga sekarang {k.harga_sekarang ? rp(k.harga_sekarang) : ''} di bawah target untung.</p>
      )}
      <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
        {r && (
          <button type="button" onClick={() => setBuka(!buka)} aria-expanded={buka} className="flex min-h-11 items-center gap-1 pr-2 text-sm font-semibold text-stone-600">
            Rincian
            <Ikon d={IK.kanan} className={`h-4 w-4 transition-transform ${buka ? 'rotate-90' : ''}`} />
          </button>
        )}
        <div className="flex-1" />
        {nilai && nilai === k.harga_sekarang ? (
          <span className="flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-stone-500">
            <Ikon d={IK.cek} /> Sudah dipakai
          </span>
        ) : (
          <Button variant={rugi ? 'secondary' : 'primary'} className="whitespace-nowrap" disabled={!nilai || sibuk || usang} onClick={pakai}>
            {rugi ? 'Tetap pakai' : 'Pakai harga ini'}
          </Button>
        )}
      </div>
      {galat && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {galat}
        </p>
      )}
      {r && buka && (
        <div className={`mt-1 rounded-xl bg-stone-50 px-3 py-2 text-sm ${usang ? 'opacity-50' : ''}`}>
          <div className="flex justify-between py-1 text-stone-600">
            <span>Modal</span>
            <span className="tabular-nums">−{rpModal(r.modal)}</span>
          </div>
          {r.potongan.map((x) => (
            <div key={x.potongan_id} className="flex justify-between py-1 text-stone-600">
              <span>{x.nama}</span>
              <span className="tabular-nums">−{rp(x.rp)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-stone-200 pt-1.5 text-xs text-stone-500">
            <span>Untung % harga jual · % modal</span>
            <span className="tabular-nums">
              {fmtPersen(r.persen_jual)} · {fmtPersen(r.persen_modal)}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

function PilihProduk({ produk, id, onPilih }: { produk: ProdukT2[]; id: number; onPilih: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const p = produk.find((x) => x.id === id)
  const list = produk.filter((x) => x.nama.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Ganti produk" className="flex w-full items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 text-left shadow-sm hover:border-stone-300">
        {p ? <Thumb nama={p.nama} /> : <div className="h-12 w-12 rounded-xl bg-stone-100" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold text-ink">{p?.nama ?? 'Pilih produk'}</p>
          {p && (
            <p className="text-sm text-stone-500 tabular-nums">
              Modal <span className="font-semibold text-stone-700">{rpModal(p.modal)}</span>/pcs · stok {p.stok}
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand-700">Ganti</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Pilih produk">
        <div className="relative mb-3">
          <Ikon d={IK.cari} className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama produk"
            aria-label="Cari nama produk"
            className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pr-3 pl-10 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
          />
        </div>
        <div className="-mx-4 divide-y divide-stone-100">
          {list.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                onPilih(x.id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50"
            >
              <Thumb nama={x.nama} kecil />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium text-ink">{x.nama}</p>
                <p className="text-sm text-stone-500 tabular-nums">Modal {rpModal(x.modal)}</p>
              </div>
              {x.id === id ? <Ikon d={IK.cek} className="h-5 w-5 text-brand-700" /> : <StokLencana stok={x.stok} batas={x.batas_stok_menipis} />}
            </button>
          ))}
          {list.length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-500">Tidak ada produk bernama “{q}”.</p>}
        </div>
      </Sheet>
    </>
  )
}

function InputTarget({ cara, nilai, setCara, setNilai }: { cara: CaraTarget; nilai: number | null; setCara: (c: CaraTarget) => void; setNilai: (v: number | null) => void }) {
  const satuan = CARA.find((c) => c.key === cara)!.satuan
  return (
    <div className="flex flex-col gap-2">
      <Tabs<CaraTarget>
        items={CARA.map((c) => ({ key: c.key, label: c.label }))}
        value={cara}
        onChange={(c) => {
          setCara(c)
          setNilai(CARA.find((x) => x.key === c)!.awal)
        }}
      />
      {satuan === 'Rp' ? (
        <RupiahInput aria-label="Target untung (Rp per pcs)" value={nilai} onValueChange={setNilai} />
      ) : (
        <div className="relative">
          <input
            inputMode="decimal"
            aria-label={`Target untung (${satuan})`}
            value={nilai ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(',', '.').replace(/[^\d.]/g, '')
              setNilai(v === '' ? null : Math.min(999, Number(v)))
            }}
            className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pr-10 pl-3 text-right text-base tabular-nums focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-stone-500">%</span>
        </div>
      )}
      <p className="text-sm text-stone-500">{nilai != null ? `Untung ${teksTarget(cara, nilai, rp).replace('untung ', '')}` : 'Isi target untung'}</p>
    </div>
  )
}

function Isi({ produk, bawaan }: { produk: ProdukT2[]; bawaan: Pembulatan }) {
  const [sp] = useSearchParams()
  const awal = useMemo(() => {
    const q = Number(sp.get('produk'))
    const p = produk.find((x) => x.id === q) ?? produk[0]
    const h = p.harga.find((x) => x.saluran_id === Number(sp.get('saluran')))
    return { produkId: p.id, cara: h?.target_cara ?? ('persen_jual' as CaraTarget), nilai: h?.target_nilai ?? 30 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [produkId, setProdukId] = useState(awal.produkId)
  const [cara, setCara] = useState<CaraTarget>(awal.cara)
  const [nilai, setNilai] = useState<number | null>(awal.nilai)
  const [bulat, setBulat] = useState<Pembulatan | null>(null)
  const [ketik, setKetik] = useState<Ketik>({})
  const [atur, setAtur] = useState(false)
  const [ulang, setUlang] = useState(0)
  const efektif = bulat ?? bawaan

  const cek = Object.entries(ketik)
    .filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0)
    .map(([id, harga]) => ({ saluran_id: Number(id), harga }))
  const body: KalkulatorInput | null = nilai != null ? { produk_id: produkId, cara, nilai, ...(bulat ? { pembulatan: bulat } : {}), ...(cek.length ? { cek } : {}) } : null
  const kalk = useKalkulator(body, ulang)
  const hasil = kalk.hasil && kalk.hasil.produk_id === produkId ? kalk.hasil : null

  const reset = () => setKetik({})
  const p = produk.find((x) => x.id === produkId)!
  const labelBulat = PEMBULATAN.find((b) => b.key === efektif)?.label ?? ''

  return (
    <div className="md:grid md:grid-cols-[340px_minmax(0,1fr)] md:items-start md:gap-6">
      <div className="md:col-span-2">
        <KepalaHalaman judul="Harga" sub="Hitung harga jual semua saluran" />
      </div>
      <div className="flex flex-col gap-4 md:sticky md:top-8">
        <PilihProduk
          produk={produk}
          id={produkId}
          onPilih={(id) => {
            setProdukId(id)
            reset()
          }}
        />
        <button
          type="button"
          onClick={() => setAtur(!atur)}
          aria-expanded={atur}
          className={`flex min-h-12 items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-2 text-left shadow-sm md:hidden ${atur ? 'hidden' : ''}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{nilai != null ? teksTarget(cara, nilai, rp).replace(/^untung /, 'Target untung ') : 'Isi target untung'}</p>
            <p className="text-xs text-stone-500 first-letter:uppercase">{teksBulatPendek(efektif, labelBulat)}</p>
          </div>
          <span className="text-sm font-semibold text-brand-700">Ubah</span>
        </button>
        <section className={`rounded-2xl border border-brand-100 bg-white p-4 shadow-sm ${atur ? '' : 'hidden md:block'}`}>
          <div className="flex items-center justify-between">
            <Label>Target untung</Label>
            <button type="button" className="-mt-1.5 min-h-9 px-1 text-sm font-semibold text-brand-700 md:hidden" onClick={() => setAtur(false)}>
              Selesai
            </button>
          </div>
          <InputTarget
            cara={cara}
            nilai={nilai}
            setCara={(c) => {
              setCara(c)
              reset()
            }}
            setNilai={(v) => {
              setNilai(v)
              reset()
            }}
          />
          <div className="mt-4">
            <Label>Pembulatan</Label>
            <Pilihan<Pembulatan>
              gulir
              label="Pembulatan"
              items={PEMBULATAN.map((b) => ({ key: b.key, label: b.label }))}
              value={efektif}
              onChange={(b) => {
                setBulat(b)
                reset()
              }}
            />
          </div>
        </section>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:mt-0">
        <p className="px-1 text-sm text-stone-500">Harga terisi saran. Ketik harga sendiri untuk mengecek untung-ruginya.</p>
        {p.modal <= 0 && <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-800">Modal produk ini belum ada. Catat barang masuk dulu supaya harga bisa dihitung.</p>}
        {kalk.galat && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
            {kalk.galat}
          </p>
        )}
        {hasil ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {hasil.saluran.map((k) => (
              <Kartu
                key={k.saluran_id}
                k={k}
                produkId={produkId}
                cara={cara}
                nilaiTarget={nilai ?? 0}
                harga={ketik[k.saluran_id]}
                setHarga={(v) => setKetik((x) => ({ ...x, [k.saluran_id]: v }))}
                usang={kalk.memeriksa}
                sesudahPakai={() => setUlang((n) => n + 1)}
                bawahTarget={!!p.harga.find((h) => h.saluran_id === k.saluran_id)?.di_bawah_target}
              />
            ))}
            {hasil.saluran.length === 0 && (
              <div className="lg:col-span-2">
                <Kosong ikon={IK.saluran} judul="Belum ada saluran aktif" teks="Aktifkan saluran di Pengaturan, lalu hitung harganya di sini." />
              </div>
            )}
          </div>
        ) : (
          !kalk.galat && nilai != null && <div className="h-40 animate-pulse rounded-2xl bg-white/60" aria-busy="true" aria-label="Menghitung" />
        )}
      </div>
    </div>
  )
}

export default function Harga() {
  const produk = useApi<ProdukT2[]>('/produk?aktif=1')
  const pengaturan = useApi<Pengaturan>('/pengaturan')
  return (
    <DataState hasil={produk}>
      {(data) =>
        data.length === 0 ? (
          <>
            <KepalaHalaman judul="Harga" sub="Hitung harga jual semua saluran" />
            <Kosong ikon={IK.harga} judul="Belum ada produk" teks="Tambahkan produk beserta modalnya dulu, lalu hitung harganya di sini." />
          </>
        ) : (
          <DataState hasil={pengaturan}>{(pg) => <Isi produk={data} bawaan={pg.pembulatan_bawaan} />}</DataState>
        )
      }
    </DataState>
  )
}
