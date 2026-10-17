// Desain final (Opsi B, T-0130) — "Ketuk produk": daftar produk langsung terbuka, ketuk + untuk menambah, periksa lalu simpan.
import { useState } from 'react'
import { Button, RupiahInput, Sheet } from '../../../components/ui'
import { rp } from '../../lib/hitung'
import { BilahAtas, IK, Ikon, Stepper, Thumb } from '../../ui'
import { PilihSaluran, PilihTanggal, RingkasanUang, useKeranjang, type Keranjang } from './keranjang'

function DaftarProduk({ k }: { k: Keranjang }) {
  const [q, setQ] = useState('')
  const list = [...k.st.produk].sort((a, b) => (a.stok === 0 ? 1 : 0) - (b.stok === 0 ? 1 : 0) || b.laku30 - a.laku30).filter((p) => p.nama.toLowerCase().includes(q.toLowerCase()))
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
          const harga = p.harga[k.saluranId]?.harga
          const habis = p.stok === 0
          const e = k.err[p.id]
          return (
            <div key={p.id} className={`flex items-center gap-3 bg-white px-3 py-3 ${qty ? 'bg-brand-50' : ''} ${habis ? 'opacity-50' : ''}`}>
              <Thumb nama={p.nama} kecil />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] leading-snug font-medium text-ink">{p.nama}</p>
                <p className="mt-0.5 text-sm text-stone-500 tabular-nums">
                  {harga ? rp(harga) : <span className="text-amber-700">Harga belum diatur</span>} · {habis ? <span className="font-medium text-red-700">Habis</span> : `stok ${p.stok}`}
                </p>
                {e && (
                  <p className="text-sm font-medium text-red-700" role="alert">
                    {e}
                  </p>
                )}
              </div>
              {qty > 0 ? (
                <Stepper label={`Jumlah ${p.nama}`} value={qty} min={0} max={p.stok} onChange={(n) => k.setQty(p.id, n)} />
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
      {list.length === 0 && <p className="py-6 text-center text-sm text-stone-500">Tidak ada produk bernama “{q}”.</p>}
    </>
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
              </div>
              <div className="w-36 shrink-0">
                <RupiahInput aria-label={`Harga ${p.nama}`} value={x.harga} onValueChange={(v) => k.setHarga(p.id, v)} error={!x.harga ? 'Isi harga' : undefined} />
              </div>
            </div>
          )
        })}
      </div>
      <RingkasanUang k={k} />
      {Object.values(k.err).length > 0 && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          Stok tidak cukup. Kurangi jumlah barang yang ditandai merah.
        </p>
      )}
      <Button block className="min-h-12" disabled={!k.bisaSimpan} onClick={k.simpan}>
        Simpan penjualan
      </Button>
    </div>
  )
}

export default function JualB() {
  const k = useKeranjang()
  const [periksa, setPeriksa] = useState(false)
  const adaErr = Object.keys(k.err).length > 0

  return (
    <div>
      <BilahAtas judul="Catat penjualan" tutup />
      <div className="md:grid md:grid-cols-[1fr_360px] md:items-start md:gap-6">
        <div>
          <div className="mb-3">
            <PilihSaluran k={k} kompak />
          </div>
          <DaftarProduk k={k} />
        </div>

        {/* Laptop: panel periksa selalu terlihat di kanan */}
        <aside className="sticky top-8 hidden rounded-2xl border border-brand-100 bg-white p-4 shadow-sm md:block">
          <h2 className="mb-3 text-base font-semibold text-ink">Pesanan · {k.saluran.nama}</h2>
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
                  {k.totalPcs} pcs · {k.saluran.nama}
                </p>
                <p className="text-lg font-bold text-ink tabular-nums">{rp(k.total)}</p>
              </>
            ) : (
              <p className="text-sm text-stone-500">Ketuk + pada produk yang terjual</p>
            )}
          </div>
          <Button className="min-h-12 px-6" disabled={!k.items.length || adaErr} onClick={() => setPeriksa(true)}>
            {adaErr ? 'Stok kurang' : 'Lanjut'}
          </Button>
        </div>
      </div>

      <div className="md:hidden">
        <Sheet open={periksa && k.items.length > 0} onClose={() => setPeriksa(false)} title={`Periksa pesanan · ${k.saluran.nama}`}>
          <Periksa k={k} />
        </Sheet>
      </div>
    </div>
  )
}
