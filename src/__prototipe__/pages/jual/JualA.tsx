// Opsi A — "Formulir ringkas": pilih saluran, tambah barang dari daftar pencarian, simpan.
import { useState } from 'react'
import { Button, RupiahInput, Sheet } from '../../../components/ui'
import { rp } from '../../lib/hitung'
import { BilahAtas, BilahBawah, IK, Ikon, Label, Stepper, StokLencana, Thumb } from '../../ui'
import { PilihSaluran, PilihTanggal, RingkasanUang, useKeranjang, type Keranjang } from './keranjang'

function SheetPilihBarang({ k, open, onClose }: { k: Keranjang; open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const list = [...k.st.produk].sort((a, b) => b.laku30 - a.laku30).filter((p) => p.nama.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet open={open} onClose={onClose} title="Pilih barang">
      <div className="relative mb-3">
        <Ikon d={IK.cari} className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama produk"
          className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pr-3 pl-10 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        />
      </div>
      <div className="-mx-4 divide-y divide-stone-100">
        {list.map((p) => {
          const dipilih = k.qtyDari(p.id) > 0
          const habis = p.stok === 0
          const harga = p.harga[k.saluranId]?.harga
          return (
            <button
              key={p.id}
              type="button"
              disabled={habis}
              onClick={() => {
                if (!dipilih) k.setQty(p.id, 1)
                onClose()
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 disabled:opacity-50"
            >
              <Thumb nama={p.nama} kecil />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium text-ink">{p.nama}</p>
                <p className="text-sm text-stone-500 tabular-nums">{harga ? rp(harga) : 'Harga belum diatur'}</p>
              </div>
              {dipilih ? <Ikon d={IK.cek} className="h-5 w-5 text-brand-700" /> : <StokLencana stok={p.stok} batas={p.batas} />}
            </button>
          )
        })}
        {list.length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-500">Tidak ada produk bernama “{q}”.</p>}
      </div>
    </Sheet>
  )
}

export default function JualA() {
  const k = useKeranjang()
  const [pilih, setPilih] = useState(false)

  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul="Catat penjualan" tutup />
      <div className="flex flex-col gap-5">
        <div>
          <Label>Terjual di</Label>
          <PilihSaluran k={k} />
        </div>
        <div>
          <Label>Tanggal</Label>
          <PilihTanggal k={k} />
        </div>

        <div>
          <Label>Barang</Label>
          <div className="flex flex-col gap-2">
            {k.items.map((x) => {
              const p = k.produkMap.get(x.produkId)!
              const e = k.err[x.produkId]
              return (
                <div key={x.produkId} className={`rounded-2xl border bg-white p-3 shadow-sm ${e ? 'border-red-300' : 'border-brand-100'}`}>
                  <div className="flex items-start gap-3">
                    <Thumb nama={p.nama} kecil />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium text-ink">{p.nama}</p>
                      <p className="text-sm text-stone-500">Stok {p.stok}</p>
                    </div>
                    <button type="button" aria-label={`Hapus ${p.nama}`} onClick={() => k.setQty(p.id, 0)} className="-mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100">
                      <Ikon d={IK.hapus} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-start gap-2">
                    <Stepper label={`Jumlah ${p.nama}`} value={x.qty} onChange={(n) => k.setQty(p.id, n)} max={p.stok} />
                    <div className="min-w-0 flex-1">
                      <RupiahInput aria-label={`Harga ${p.nama}`} value={x.harga} onValueChange={(v) => k.setHarga(p.id, v)} error={!x.harga ? 'Isi harga' : undefined} />
                    </div>
                  </div>
                  {e && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700" role="alert">
                      <Ikon d={IK.peringatan} className="h-4 w-4" /> {e}. Kurangi jumlahnya.
                    </p>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => setPilih(true)}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed font-semibold text-brand-700 ${k.items.length ? 'border-brand-100' : 'min-h-24 border-brand-500/40 bg-white'}`}
            >
              <Ikon d={IK.plus} /> {k.items.length ? 'Tambah barang lain' : 'Pilih barang yang terjual'}
            </button>
          </div>
        </div>
      </div>

      <BilahBawah ringkas={k.items.length > 0 ? <RingkasanUang k={k} /> : undefined}>
        <Button block className="min-h-12" disabled={!k.bisaSimpan} onClick={k.simpan}>
          {Object.keys(k.err).length ? 'Stok tidak cukup' : k.items.length ? `Simpan · ${rp(k.total)}` : 'Simpan penjualan'}
        </Button>
      </BilahBawah>

      <SheetPilihBarang k={k} open={pilih} onClose={() => setPilih(false)} />
    </div>
  )
}
