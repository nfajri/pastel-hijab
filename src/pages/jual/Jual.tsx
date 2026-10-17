// Catat penjualan (desain final Opsi B): daftar produk langsung terbuka, ketuk + untuk menambah, Periksa lalu Simpan.
// Potongan, untung, dan cek stok semuanya dari server (POST /api/penjualan/hitung); browser hanya menampilkan.
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { BilahAtas, Button, Gagal, IK, Ikon, Kerangka, Kosong, Pilihan, Rinci, RupiahInput, Sheet, Stepper, Thumb } from '../../components/ui'
import type { Saluran } from '../../lib/api-types'
import type { Penjualan, ProdukT2 } from '../../lib/api-tahap2'
import { fmtPersen, rp } from '../../lib/format'
import { tglHari } from '../../lib/tgl'
import { useApi } from '../../lib/useApi'
import { useKeranjang, type Keranjang } from './useKeranjang'

function DaftarProduk({ k }: { k: Keranjang }) {
  const [q, setQ] = useState('')
  const kata = q.trim().toLowerCase()
  const list = k.produk
    .filter((p) => (p.aktif || k.qtyDari(p.id) > 0) && p.nama.toLowerCase().includes(kata))
    .sort((a, b) => Number(k.tersedia(a.id) === 0) - Number(k.tersedia(b.id) === 0) || b.terjual_30_hari - a.terjual_30_hari || a.nama.localeCompare(b.nama, 'id'))
  return (
    <>
      <div className="relative mb-3">
        <Ikon d={IK.cari} className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari produk"
          aria-label="Cari produk"
          className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pr-3 pl-10 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        />
      </div>
      <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm 2xl:grid 2xl:grid-cols-2 2xl:divide-y-0 2xl:gap-px 2xl:bg-stone-100">
        {list.map((p) => {
          const qty = k.qtyDari(p.id)
          const harga = k.hargaDi(p.id, k.saluranId)
          const stok = k.tersedia(p.id)
          const habis = stok === 0
          const e = k.err[p.id]
          return (
            <div key={p.id} className={`flex items-center gap-3 bg-white px-3 py-3 ${qty ? 'bg-brand-50' : ''} ${habis && !qty ? 'opacity-50' : ''}`} data-testid={`produk-${p.id}`}>
              <Thumb nama={p.nama} kecil />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] leading-snug font-medium text-ink">{p.nama}</p>
                <p className="mt-0.5 text-sm text-stone-500 tabular-nums">
                  {harga ? rp(harga) : <span className="text-amber-700">Harga belum diatur</span>} · {habis ? <span className="font-medium text-red-700">Habis</span> : `stok ${stok}`}
                </p>
                {e && (
                  <p className="text-sm font-medium text-red-700" role="alert">
                    {e}
                  </p>
                )}
              </div>
              {qty > 0 ? (
                <Stepper label={`Jumlah ${p.nama}`} value={qty} min={0} max={stok} onChange={(n) => k.setQty(p.id, n)} />
              ) : (
                <button
                  type="button"
                  disabled={habis}
                  aria-label={`Tambah ${p.nama}`}
                  onClick={() => k.setQty(p.id, 1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-500 text-brand-700 hover:bg-brand-50 disabled:border-stone-200 disabled:text-stone-300"
                >
                  <Ikon d={IK.plus} strokeWidth={2.2} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {list.length === 0 && <p className="py-6 text-center text-sm text-stone-500">{kata ? `Tidak ada produk bernama “${q}”.` : 'Belum ada produk aktif.'}</p>}
    </>
  )
}

function PilihTanggal({ k }: { k: Keranjang }) {
  const hariIni = k.tanggal === k.hariIni
  return (
    <label className="relative flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700">
      <Ikon d={IK.kalender} className="h-5 w-5 text-stone-500" />
      <span className="flex-1 font-medium">{hariIni ? 'Hari ini' : tglHari(k.tanggal)}</span>
      <span className="text-sm font-semibold text-brand-700">Ubah</span>
      <input type="date" aria-label="Tanggal penjualan" value={k.tanggal} max={k.hariIni} onChange={(e) => e.target.value && k.setTanggal(e.target.value)} className="absolute inset-0 opacity-0" />
    </label>
  )
}

function labelKomponen(r: Penjualan['rincian_potongan'][number]) {
  return r.jenis === 'persen' ? `${r.nama} ${fmtPersen(r.nilai)}` : r.nama
}

/** Total harga − potongan = uang diterima; untung. Angka dari server. */
function RingkasanUang({ k }: { k: Keranjang }) {
  const [ubah, setUbah] = useState(false)
  const [buka, setBuka] = useState(false)
  const h = k.pratinjau.hasil
  const usang = k.pratinjau.memeriksa || k.pratinjau.galat !== ''
  const tanpaPotongan = !!h && h.rincian_potongan.length === 0 && h.potongan_otomatis === 0 && k.potonganManual == null
  const strip = (n: number | undefined) => (h && n !== undefined ? rp(n) : '…')
  return (
    <div className={usang ? 'opacity-60' : ''} aria-busy={k.pratinjau.memeriksa}>
      <Rinci label="Total harga" nilai={strip(h?.subtotal)} />
      {!tanpaPotongan && (
        <>
          <div className="flex items-center justify-between gap-3 py-1.5">
            <button type="button" onClick={() => setBuka(!buka)} className="flex min-w-0 items-center gap-1 text-left text-sm text-stone-600" aria-expanded={buka}>
              Potongan {k.sal?.nama}
              {h?.potongan_diubah && <span className="text-xs text-brand-700">(diubah)</span>}
              <Ikon d={IK.kanan} className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${buka ? 'rotate-90' : ''}`} />
            </button>
            <span className="text-sm text-stone-600 tabular-nums">{h ? `−${rp(h.potongan)}` : '…'}</span>
          </div>
          {buka && h && (
            <div className="mb-1 rounded-xl bg-stone-50 px-3 py-2">
              {!h.potongan_diubah ? (
                h.rincian_potongan.map((x) => (
                  <div key={x.nama} className="flex justify-between py-0.5 text-xs text-stone-500">
                    <span>{labelKomponen(x)}</span>
                    <span className="tabular-nums">−{rp(x.rp)}</span>
                  </div>
                ))
              ) : (
                <p className="py-0.5 text-xs text-stone-500">Otomatis: −{rp(h.potongan_otomatis)}</p>
              )}
              {ubah ? (
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <RupiahInput label="Potongan sebenarnya" value={k.potonganManual ?? h.potongan} onValueChange={(v) => k.setPotonganManual(v ?? 0)} />
                  </div>
                  <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-brand-700" onClick={() => setUbah(false)}>
                    Selesai
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex gap-3">
                  <button type="button" className="min-h-9 text-sm font-semibold text-brand-700" onClick={() => setUbah(true)}>
                    Ubah potongan
                  </button>
                  {k.potonganManual != null && (
                    <button type="button" className="min-h-9 text-sm font-semibold text-stone-500" onClick={() => k.setPotonganManual(null)}>
                      Kembalikan otomatis
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <Rinci label="Uang diterima" nilai={strip(h?.uang_diterima)} tebal garis />
      <Rinci label="Untung (setelah modal)" nilai={strip(h?.untung)} nada={h && h.untung < 0 ? 'rugi' : 'untung'} />
    </div>
  )
}

function Periksa({ k }: { k: Keranjang }) {
  return (
    <div className="flex flex-col gap-4">
      <PilihTanggal k={k} />
      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200">
        {k.items.map((x) => {
          const p = k.produkMap.get(x.produkId)!
          return (
            <div key={x.produkId} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-ink">{p.nama}</p>
                <p className="text-sm text-stone-500 tabular-nums">× {x.qty}</p>
                {k.err[p.id] && <p className="text-sm font-medium text-red-700">{k.err[p.id]}</p>}
              </div>
              <div className="w-36 shrink-0">
                <RupiahInput aria-label={`Harga ${p.nama}`} value={x.harga} onValueChange={(v) => k.setHarga(p.id, v)} error={!x.harga ? 'Isi harga' : undefined} />
              </div>
            </div>
          )
        })}
      </div>
      <RingkasanUang k={k} />
      {k.adaErr ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          Stok tidak cukup. Kurangi jumlah barang yang ditandai merah.
        </p>
      ) : (
        k.galat && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
            {k.galat}
          </p>
        )
      )}
      <Button block className="min-h-12" disabled={!k.bisaSimpan} onClick={k.simpan}>
        {k.adaErr ? 'Stok tidak cukup' : k.sibuk ? 'Menyimpan…' : k.edit ? 'Simpan perubahan' : 'Simpan penjualan'}
      </Button>
    </div>
  )
}

function PilihSaluran({ k }: { k: Keranjang }) {
  return (
    <Pilihan<string>
      gulir
      label="Saluran"
      items={k.saluran.map((s) => ({ key: String(s.id), label: s.nama }))}
      value={String(k.saluranId)}
      onChange={(v) => k.setSaluranId(Number(v))}
    />
  )
}

function Isi({ k }: { k: Keranjang }) {
  const [periksa, setPeriksa] = useState(false)
  return (
    <div>
      <BilahAtas judul={k.edit ? 'Ubah penjualan' : 'Catat penjualan'} tutup />
      <div className="md:grid md:grid-cols-[1fr_360px] md:items-start md:gap-6">
        <div>
          <div className="mb-3">
            <PilihSaluran k={k} />
          </div>
          <DaftarProduk k={k} />
        </div>

        {/* Laptop: panel periksa selalu terlihat di kanan */}
        <aside className="sticky top-8 hidden rounded-2xl border border-brand-100 bg-white p-4 shadow-sm md:block">
          <h2 className="mb-3 text-base font-semibold text-ink">Pesanan · {k.sal?.nama}</h2>
          {k.items.length ? <Periksa k={k} /> : <p className="py-6 text-center text-sm text-stone-500">Ketuk + pada produk yang terjual.</p>}
        </aside>
      </div>

      {/* HP: bilah bawah ringkas → lembar periksa */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {k.items.length ? (
              <>
                <p className="text-sm text-stone-500">
                  {k.totalPcs} pcs · {k.sal?.nama}
                </p>
                <p className="text-lg font-bold text-ink tabular-nums">{k.hargaKosong ? 'Isi harga' : rp(k.total)}</p>
              </>
            ) : (
              <p className="text-sm text-stone-500">Ketuk + pada produk yang terjual</p>
            )}
          </div>
          <Button className="min-h-12 px-6" disabled={!k.items.length || k.adaErr} onClick={() => setPeriksa(true)}>
            {k.adaErr ? 'Stok tidak cukup' : 'Lanjut'}
          </Button>
        </div>
      </div>

      <div className="md:hidden">
        <Sheet open={periksa && k.items.length > 0} onClose={() => setPeriksa(false)} title={`Periksa pesanan · ${k.sal?.nama}`}>
          <Periksa k={k} />
        </Sheet>
      </div>
    </div>
  )
}

function Siap({ produk, muatProduk, saluran, saluranAwal, asal }: { produk: ProdukT2[]; muatProduk: () => void; saluran: Saluran[]; saluranAwal: number; asal?: Penjualan }) {
  const k = useKeranjang({ produk, muatProduk, saluran, saluranAwal, asal })
  if (!k.sal)
    return (
      <>
        <BilahAtas judul="Catat penjualan" tutup />
        <Kosong ikon={IK.saluran} judul="Belum ada saluran aktif" teks="Aktifkan minimal satu saluran di Pengaturan." />
      </>
    )
  return <Isi k={k} />
}

export default function Jual() {
  const { id } = useParams()
  const edit = id ? Number(id) : null
  const produk = useApi<ProdukT2[]>('/produk')
  const saluran = useApi<Saluran[]>('/saluran')
  const terakhir = useApi<Penjualan[]>(edit ? null : '/penjualan?limit=1')
  const asal = useApi<Penjualan>(edit ? `/penjualan/${edit}` : null)

  const gagal = [produk, saluran, terakhir, asal].find((h) => h.gagal !== null)
  const siap = produk.data && saluran.data && (edit ? asal.data : terakhir.data)
  if (!siap) {
    return (
      <>
        <BilahAtas judul={edit ? 'Ubah penjualan' : 'Catat penjualan'} tutup />
        {gagal ? <Gagal onUlang={gagal.muat} pesan={gagal.gagal ?? undefined} /> : <Kerangka />}
      </>
    )
  }
  const aktif = saluran.data!.filter((s) => s.aktif || s.id === asal.data?.saluran_id)
  const awal = asal.data?.saluran_id ?? terakhir.data?.[0]?.saluran_id
  const saluranAwal = aktif.find((s) => s.id === awal)?.id ?? aktif[0]?.id ?? 0
  return <Siap key={edit ?? 'baru'} produk={produk.data!} muatProduk={produk.muat} saluran={aktif} saluranAwal={saluranAwal} asal={asal.data ?? undefined} />
}
