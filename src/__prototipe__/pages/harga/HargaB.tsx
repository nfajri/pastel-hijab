// Opsi B — "Semua saluran sekaligus": satu target untuk semua saluran; tiap saluran punya kolom harga
// yang terisi saran dan bisa diketik ulang (otomatis jadi mode cek).
import { useState } from 'react'
import { Button, RupiahInput } from '../../../components/ui'
import type { Saluran } from '../../lib/data'
import { fmtPersen, hargaMinimal, hitungHarga, memenuhiTarget, rincian, rp } from '../../lib/hitung'
import { Gagal, IK, Ikon, Kerangka, KepalaHalaman, Kosong, Label, Lencana } from '../../ui'
import { InputTarget, PilihPembulatan, PilihProduk, teksTarget, useKalkulator, type Kalk } from './bersama'
import { PEMBULATAN, type Pembulatan } from '../../lib/hitung'

const teksBulatPendek = (b: Pembulatan) => (b === 'tanpa' ? 'tanpa pembulatan' : b === 'cantik' ? 'harga cantik' : `bulat ${PEMBULATAN.find((x) => x.key === b)!.label}`)

function KartuSaluran({ k, s, harga, setHarga }: { k: Kalk; s: Saluran; harga: number | null | undefined; setHarga: (v: number | null | undefined) => void }) {
  const [buka, setBuka] = useState(false)
  const p = k.produk!
  const hasil = hitungHarga(p.modal, s.potongan, k.cara, k.nilai ?? 0, k.bulat)
  const minimal = hargaMinimal(p.modal, s.potongan)
  const sekarang = p.harga[s.id]?.harga
  const nilai = harga === undefined ? (hasil.ok ? hasil.saran : null) : harga
  const diketik = harga !== undefined && (!hasil.ok || harga !== hasil.saran)
  const r = nilai ? rincian(p.modal, s.potongan, nilai) : null
  const capai = r ? memenuhiTarget(p.modal, s.potongan, r.harga, k.cara, k.nilai ?? 0) : false

  let status = null
  if (!hasil.ok && !diketik) status = <Lencana nada="bahaya">Target tidak bisa dicapai</Lencana>
  else if (r && r.harga < minimal) status = <Lencana nada="bahaya">Rugi · kurang {rp(minimal - r.harga)}</Lencana>
  else if (r && !capai) status = <Lencana nada="peringatan">Di bawah target</Lencana>
  else if (r) status = <Lencana nada="baik">Sesuai target</Lencana>

  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{s.nama}</h3>
        {status}
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <RupiahInput aria-label={`Harga jual ${s.nama}`} value={nilai} onValueChange={setHarga} className="text-lg font-semibold" />
        <div className="pb-1 text-right">
          <p className="text-xs text-slate-500">Untung</p>
          <p className={`font-bold whitespace-nowrap tabular-nums ${r && r.untung < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{r ? rp(r.untung) : '—'}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-500 tabular-nums">
        {diketik ? (
          <>
            Saran {hasil.ok ? rp(hasil.saran) : '—'} ·{' '}
            <button type="button" className="font-semibold text-brand-700" onClick={() => setHarga(undefined)}>
              pakai saran
            </button>
          </>
        ) : !hasil.ok ? (
          hasil.pesan
        ) : (
          <>
            Minimal {rp(minimal)} · sekarang {sekarang ? rp(sekarang) : 'belum ada'}
          </>
        )}
      </p>
      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        {r && (
          <button type="button" onClick={() => setBuka(!buka)} aria-expanded={buka} className="flex min-h-11 items-center gap-1 pr-2 text-sm font-semibold text-slate-600">
            Rincian
            <Ikon d={IK.kanan} className={`h-4 w-4 transition-transform ${buka ? 'rotate-90' : ''}`} />
          </button>
        )}
        <div className="flex-1" />
        {nilai && nilai === sekarang ? (
          <span className="flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-slate-500">
            <Ikon d={IK.cek} /> Sudah dipakai
          </span>
        ) : (
          <Button
            variant={r && r.harga < minimal ? 'secondary' : 'primary'}
            className="whitespace-nowrap"
            disabled={!nilai}
            onClick={() => {
              k.st.pakaiHarga(p.id, s.id, nilai!, k.cara, k.nilai ?? 0)
              k.st.tampilkan(`Harga ${s.nama} jadi ${rp(nilai!)}.`)
            }}
          >
            {r && r.harga < minimal ? 'Tetap pakai' : 'Pakai harga ini'}
          </Button>
        )}
      </div>
      {r && buka && (
        <div className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          {[{ nama: 'Modal', nilai: r.modal }, ...r.potongan].map((x) => (
            <div key={x.nama} className="flex justify-between py-1 text-slate-600">
              <span>{x.nama}</span>
              <span className="tabular-nums">−{rp(x.nilai)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1.5 text-xs text-slate-500">
            <span>Untung % harga jual · % modal</span>
            <span className="tabular-nums">
              {fmtPersen(r.persenJual)} · {fmtPersen(r.persenModal)}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

export default function HargaB() {
  const k = useKalkulator()
  const { st } = k
  const [ketik, setKetik] = useState<Record<string, number | null | undefined>>({})
  const [atur, setAtur] = useState(false)

  if (st.mode === 'memuat' || st.mode === 'gagal' || !k.produk) {
    return (
      <>
        <KepalaHalaman judul="Harga" sub="Hitung harga jual semua saluran" />
        {st.mode === 'memuat' ? <Kerangka /> : st.mode === 'gagal' ? <Gagal onUlang={() => st.setMode('normal')} /> : <Kosong ikon={IK.harga} judul="Belum ada produk" teks="Tambahkan produk beserta modalnya dulu, lalu hitung harganya di sini." />}
      </>
    )
  }

  const saluran = st.saluran.filter((s) => s.aktif)
  const reset = () => setKetik({})

  return (
    <div className="md:grid md:grid-cols-[340px_minmax(0,1fr)] md:items-start md:gap-6">
      <div className="md:col-span-2">
        <KepalaHalaman judul="Harga" sub="Hitung harga jual semua saluran" />
      </div>
      <div className="flex flex-col gap-4 md:sticky md:top-8">
        <PilihProduk
          k={{
            ...k,
            setProdukId: (id) => {
              k.setProdukId(id)
              reset()
            },
          }}
        />
        <button
          type="button"
          onClick={() => setAtur(!atur)}
          aria-expanded={atur}
          className={`flex min-h-12 items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-2 text-left shadow-sm md:hidden ${atur ? 'hidden' : ''}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{teksTarget(k.cara, k.nilai ?? 0).replace(/^untung /, 'Target untung ')}</p>
            <p className="text-xs text-slate-500 first-letter:uppercase">{teksBulatPendek(k.bulat)}</p>
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
            k={{
              ...k,
              setNilai: (v) => {
                k.setNilai(v)
                reset()
              },
            }}
          />
          <div className="mt-4">
            <Label>Pembulatan</Label>
            <PilihPembulatan
              k={{
                ...k,
                setBulat: (b) => {
                  k.setBulat(b)
                  reset()
                },
              }}
            />
          </div>
        </section>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:mt-0">
        <p className="px-1 text-sm text-slate-500">Harga terisi saran. Ketik harga sendiri untuk mengecek untung-ruginya.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {saluran.map((s) => (
            <KartuSaluran key={s.id + k.produkId} k={k} s={s} harga={ketik[s.id]} setHarga={(v) => setKetik((x) => ({ ...x, [s.id]: v }))} />
          ))}
        </div>
      </div>
    </div>
  )
}
