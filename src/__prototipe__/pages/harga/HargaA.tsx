// Opsi A — "Satu saluran": hitung untuk satu saluran dengan rincian lengkap, mode cek sebagai tab, tabel semua saluran di bawah.
import { useState } from 'react'
import { Button, RupiahInput, Tabs } from '../../../components/ui'
import { fmtPersen, hargaMinimal, hitungHarga, rincian, rp, type Rincian } from '../../lib/hitung'
import { Gagal, IK, Ikon, Kerangka, KepalaHalaman, Kosong, Label, Lencana, Pilihan, Rinci } from '../../ui'
import { InputTarget, PilihPembulatan, PilihProduk, teksBulat, teksTarget, useKalkulator, type Kalk } from './bersama'

function RincianHarga({ r }: { r: Rincian }) {
  return (
    <div>
      <Rinci label="Harga jual" nilai={rp(r.harga)} />
      <Rinci label="Modal" nilai={`−${rp(r.modal)}`} nada="kurang" />
      {r.potongan.map((x) => (
        <Rinci key={x.nama} label={x.nama} nilai={`−${rp(x.nilai)}`} nada="kurang" />
      ))}
      <Rinci label={r.untung < 0 ? 'Rugi' : 'Untung'} nilai={rp(r.untung)} tebal garis nada={r.untung < 0 ? 'rugi' : 'untung'} />
      <p className="text-right text-xs text-stone-500 tabular-nums">
        {fmtPersen(r.persenJual)} dari harga jual · {fmtPersen(r.persenModal)} dari modal
      </p>
    </div>
  )
}

function TabelSaluran({ k }: { k: Kalk }) {
  const p = k.produk!
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">Semua saluran · {teksTarget(k.cara, k.nilai ?? 0)}</h2>
      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs font-semibold text-stone-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Saluran</th>
              <th className="px-3 py-2.5 text-right font-semibold">Saran</th>
              <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Untung</th>
              <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Minimal</th>
              <th className="px-3 py-2.5 text-right font-semibold">Sekarang</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {k.st.saluran
              .filter((s) => s.aktif)
              .map((s) => {
                const h = hitungHarga(p.modal, s.potongan, k.cara, k.nilai ?? 0, k.bulat)
                const now = p.harga[s.id]?.harga
                const aktif = s.id === k.saluranId
                const beda = h.ok && now != null && now < h.saran
                return (
                  <tr key={s.id} onClick={() => k.setSaluranId(s.id)} className={`cursor-pointer ${aktif ? 'bg-brand-50' : 'hover:bg-stone-50'}`}>
                    <td className={`px-3 py-3 font-medium ${aktif ? 'text-brand-700' : 'text-ink'}`}>{s.nama}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold text-ink">{h.ok ? rp(h.saran) : '—'}</span>
                      {h.ok && <span className="block text-xs text-emerald-700 sm:hidden">+{rp(h.rincian.untung)}</span>}
                    </td>
                    <td className="hidden px-3 py-3 text-right text-emerald-700 tabular-nums sm:table-cell">{h.ok ? rp(h.rincian.untung) : '—'}</td>
                    <td className="hidden px-3 py-3 text-right text-stone-500 tabular-nums sm:table-cell">{h.ok ? rp(h.minimal) : '—'}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${beda ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>{now ? rp(now) : 'Belum'}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 px-1 text-xs text-stone-500">Angka oranye: harga sekarang di bawah saran. Ketuk baris untuk melihat rinciannya.</p>
    </section>
  )
}

export default function HargaA() {
  const k = useKalkulator()
  const [mode, setMode] = useState<'hitung' | 'cek'>('hitung')
  const [hargaCek, setHargaCek] = useState<number | null>(null)
  const { st } = k

  if (st.mode === 'memuat' || st.mode === 'gagal' || !k.produk) {
    return (
      <>
        <KepalaHalaman judul="Harga" sub="Hitung harga jual per saluran" />
        {st.mode === 'memuat' ? <Kerangka /> : st.mode === 'gagal' ? <Gagal onUlang={() => st.setMode('normal')} /> : <Kosong ikon={IK.harga} judul="Belum ada produk" teks="Tambahkan produk beserta modalnya dulu, lalu hitung harganya di sini." />}
      </>
    )
  }

  const p = k.produk
  const saluran = st.saluran.find((s) => s.id === k.saluranId)!
  const hasil = hitungHarga(p.modal, saluran.potongan, k.cara, k.nilai ?? 0, k.bulat)
  const minimal = hargaMinimal(p.modal, saluran.potongan)
  const sekarang = p.harga[k.saluranId]?.harga
  const hargaDipakai = mode === 'hitung' ? (hasil.ok ? hasil.saran : null) : hargaCek
  const rCek = hargaCek ? rincian(p.modal, saluran.potongan, hargaCek) : null

  const pakai = () => {
    if (!hargaDipakai) return
    st.pakaiHarga(p.id, saluran.id, hargaDipakai, k.cara, k.nilai ?? 0)
    st.tampilkan(`Harga ${saluran.nama} untuk ${p.nama.split(' ').slice(0, 3).join(' ')} jadi ${rp(hargaDipakai)}.`)
  }

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6">
      <div className="md:col-span-2">
        <KepalaHalaman judul="Harga" sub="Hitung harga jual per saluran" />
      </div>

      <div className="flex flex-col gap-4">
        <PilihProduk k={k} />
        <div>
          <Label>Saluran</Label>
          <Pilihan gulir label="Saluran" items={st.saluran.filter((s) => s.aktif).map((s) => ({ key: s.id, label: s.nama }))} value={k.saluranId} onChange={k.setSaluranId} />
        </div>
        <Tabs
          items={[
            { key: 'hitung', label: 'Cari harga saran' },
            { key: 'cek', label: 'Cek harga saya' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'hitung' ? (
          <>
            <div>
              <Label>Target untung</Label>
              <InputTarget k={k} />
            </div>
            <div>
              <Label>Pembulatan</Label>
              <PilihPembulatan k={k} />
            </div>
          </>
        ) : (
          <RupiahInput label="Harga jual yang mau dicek" value={hargaCek} onValueChange={setHargaCek} placeholder={sekarang ? String(sekarang) : '0'} />
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4 md:mt-0">
        {/* Hasil */}
        <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm md:p-5" aria-live="polite">
          {mode === 'hitung' ? (
            hasil.ok ? (
              <>
                <p className="text-sm font-medium text-stone-500">Harga saran di {saluran.nama}</p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-ink tabular-nums">{rp(hasil.saran)}</p>
                <p className="mt-1 text-sm text-stone-500 tabular-nums">
                  {hasil.mentah !== hasil.saran ? `Dari ${rp(hasil.mentah)}, ${teksBulat(k.bulat)}` : 'Tanpa pembulatan'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Lencana>Minimal {rp(hasil.minimal)}</Lencana>
                  {sekarang != null && (sekarang < hasil.saran ? <Lencana nada="peringatan">Sekarang {rp(sekarang)}</Lencana> : <Lencana nada="baik">Sekarang {rp(sekarang)}</Lencana>)}
                </div>
                <div className="mt-4 border-t border-stone-100 pt-2">
                  <RincianHarga r={hasil.rincian} />
                </div>
              </>
            ) : (
              <div className="flex gap-3" role="alert">
                <Ikon d={IK.peringatan} className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold text-ink">Target tidak bisa dicapai</p>
                  <p className="mt-1 text-sm text-stone-600">{hasil.pesan}</p>
                </div>
              </div>
            )
          ) : rCek ? (
            <>
              <p className="text-sm font-medium text-stone-500">
                Kalau dijual {rp(rCek.harga)} di {saluran.nama}
              </p>
              <p className={`mt-1 text-4xl font-bold tracking-tight tabular-nums ${rCek.untung < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {rCek.untung < 0 ? 'Rugi ' : 'Untung '}
                {rp(Math.abs(rCek.untung))}
              </p>
              {rCek.harga < minimal && (
                <p className="mt-3 flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  <Ikon d={IK.peringatan} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Di bawah harga minimal {rp(minimal)}. Kurang <b className="tabular-nums">{rp(minimal - rCek.harga)}</b> untuk balik modal.
                  </span>
                </p>
              )}
              <div className="mt-4 border-t border-stone-100 pt-2">
                <RincianHarga r={rCek} />
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-stone-500">Isi harga untuk melihat untung atau ruginya. Harga minimal di {saluran.nama}: {rp(minimal)}.</p>
          )}
        </section>

        <div className="hidden md:block">
          {hargaDipakai && hargaDipakai === sekarang ? (
            <p className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-stone-500">
              <Ikon d={IK.cek} /> Harga ini sudah dipakai di {saluran.nama}
            </p>
          ) : (
            <Button block className="min-h-12" disabled={!hargaDipakai} onClick={pakai}>
              Pakai harga ini untuk {saluran.nama}
            </Button>
          )}
        </div>

        <TabelSaluran k={k} />
      </div>

      <div className="md:hidden">
        <div className="h-20" />
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 border-t border-brand-100 bg-white px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-stone-500">{mode === 'hitung' ? 'Harga saran' : 'Harga dicek'} · {saluran.nama}</p>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-lg font-bold text-ink tabular-nums">{hargaDipakai ? rp(hargaDipakai) : '—'}</span>
              {(mode === 'hitung' ? hasil.ok && hasil.rincian : rCek) && (
                <span className={`text-sm font-semibold whitespace-nowrap tabular-nums ${(mode === 'hitung' ? (hasil.ok ? hasil.rincian.untung : 0) : rCek!.untung) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {(mode === 'hitung' ? (hasil.ok ? hasil.rincian.untung : 0) : rCek!.untung) < 0 ? 'rugi ' : '+'}
                  {rp(Math.abs(mode === 'hitung' ? (hasil.ok ? hasil.rincian.untung : 0) : rCek!.untung))}
                </span>
              )}
            </p>
          </div>
          {hargaDipakai && hargaDipakai === sekarang ? (
            <span className="flex min-h-12 items-center gap-1.5 px-2 text-sm font-semibold text-stone-500">
              <Ikon d={IK.cek} /> Sudah dipakai
            </span>
          ) : (
            <Button className="min-h-12 shrink-0 px-5" variant={mode === 'cek' && rCek && rCek.harga < minimal ? 'secondary' : 'primary'} disabled={!hargaDipakai} onClick={pakai}>
              {mode === 'cek' && rCek && rCek.harga < minimal ? 'Tetap pakai' : 'Pakai harga ini'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
