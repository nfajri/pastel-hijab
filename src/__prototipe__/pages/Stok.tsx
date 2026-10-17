import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Input, RupiahInput, Sheet, Tabs } from '../../components/ui'
import { labelModal, memenuhiTarget, modalKulakan, modalRataRata, nilaiKomponenModalPerPcs, rp, type JenisModal } from '../lib/hitung'
import { useStore } from '../lib/store'
import { BilahAtas, BilahBawah, IK, Ikon, Label, Pilihan, Rinci, StokLencana, Thumb } from '../ui'

function PilihProdukSheet({ open, onClose, onPilih }: { open: boolean; onClose: () => void; onPilih: (id: string) => void }) {
  const st = useStore()
  const [q, setQ] = useState('')
  const list = st.produk.filter((p) => p.nama.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet open={open} onClose={onClose} title="Pilih produk">
      <div className="relative mb-3">
        <Ikon d={IK.cari} className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama produk"
          className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pr-3 pl-10 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        />
      </div>
      <div className="-mx-4 divide-y divide-stone-100">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onPilih(p.id)
              onClose()
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50"
          >
            <Thumb nama={p.nama} kecil />
            <p className="line-clamp-2 min-w-0 flex-1 font-medium text-ink">{p.nama}</p>
            <StokLencana stok={p.stok} batas={p.batas} />
          </button>
        ))}
      </div>
      <Link to="/produk/baru" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold text-brand-700">
        <Ikon d={IK.plus} /> Produk baru
      </Link>
    </Sheet>
  )
}

export function BarangMasuk() {
  const st = useStore()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [produkId, setProdukId] = useState(sp.get('produk') ?? '')
  const [pilih, setPilih] = useState(false)
  const [tanggal, setTanggal] = useState(st.hariIni)
  const [supplier, setSupplier] = useState(sp.get('supplier') ?? '')
  const [qty, setQty] = useState(sp.get('qty') ?? '')
  const [beli, setBeli] = useState<number | null>(sp.get('beli') ? Number(sp.get('beli')) : null)
  const aktif = st.komponenModal.filter((k) => k.aktif)
  const [nilai, setNilai] = useState<Record<string, number | null>>(Object.fromEntries(aktif.map((k) => [k.id, k.nilai])))
  const [coba, setCoba] = useState(false)

  const p = st.produk.find((x) => x.id === produkId)
  const q = Number(qty) || 0
  const komp = aktif.map((k) => ({ ...k, nilai: nilai[k.id] ?? 0 }))
  const modalPcs = beli != null && q > 0 ? modalKulakan(beli, q, komp) : null
  const modalBaru = p && modalPcs != null ? modalRataRata(p.stok, p.modal, q, modalPcs) : null
  const turun =
    p && modalBaru != null
      ? st.saluran.filter((s) => {
          const hs = p.harga[s.id]
          return s.aktif && hs && memenuhiTarget(p.modal, s.potongan, hs.harga, hs.cara, hs.nilai) && !memenuhiTarget(modalBaru, s.potongan, hs.harga, hs.cara, hs.nilai)
        })
      : []

  const simpan = () => {
    setCoba(true)
    if (!p || q <= 0 || beli == null || modalPcs == null || modalBaru == null) return
    st.simpanMasuk({ tanggal, supplier, produkId: p.id, qty: q, hargaBeli: beli, modalPcs: Math.round(modalPcs) }, modalBaru)
    st.tampilkan(`Stok ${p.nama.split(' ').slice(0, 3).join(' ')} jadi ${p.stok + q}. Modal ${rp(modalBaru)}/pcs.`, turun.length ? { label: 'Cek harga', to: `/harga?produk=${p.id}` } : undefined)
    nav(-1)
  }

  const satuan = (j: JenisModal) => (j === 'persenBeli' ? '%' : 'Rp')

  return (
    <div className="md:max-w-4xl">
      <BilahAtas judul="Barang masuk" tutup />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
        <div className="flex flex-col gap-5">
          <div>
            <Label>Produk</Label>
            <button
              type="button"
              onClick={() => setPilih(true)}
              className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left ${coba && !p ? 'border-red-500' : 'border-stone-300'}`}
            >
              {p ? <Thumb nama={p.nama} kecil /> : <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-400"><Ikon d={IK.produk} /></div>}
              <div className="min-w-0 flex-1">
                <p className={`line-clamp-2 font-medium ${p ? 'text-ink' : 'text-stone-400'}`}>{p?.nama ?? 'Pilih produk'}</p>
                {p && (
                  <p className="text-sm text-stone-500 tabular-nums">
                    Stok {p.stok} · modal {rp(p.modal)}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold text-brand-700">{p ? 'Ganti' : 'Pilih'}</span>
            </button>
            {coba && !p && <p className="mt-1 text-sm text-red-600">Pilih produk dulu</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jumlah (pcs)" inputMode="numeric" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} error={coba && q <= 0 ? 'Isi jumlah' : undefined} />
            <RupiahInput label="Harga beli/pcs" value={beli} onValueChange={setBeli} error={coba && beli == null ? 'Isi harga' : undefined} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tanggal" type="date" value={tanggal} max={st.hariIni} onChange={(e) => setTanggal(e.target.value)} />
            <Input label="Supplier" placeholder="Opsional" list="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            <datalist id="supplier">
              <option value="Grosir Tanah Abang Blok A" />
              <option value="Toko Kain Bu Hj. Ros" />
            </datalist>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-700">Komponen modal</h2>
              <Link to="/pengaturan/modal" className="text-sm font-semibold text-brand-700">
                Atur
              </Link>
            </div>
            <div className="divide-y divide-stone-100 rounded-2xl border border-brand-100 bg-white">
              {aktif.map((k) => (
                <div key={k.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{k.nama}</p>
                    <p className="text-xs text-stone-500">{k.jenis === 'perPcs' ? 'per pcs' : k.jenis === 'perKulakan' ? 'per kulakan, dibagi jumlah' : 'dari harga beli'}</p>
                  </div>
                  <div className="w-32 shrink-0">
                    {satuan(k.jenis) === 'Rp' ? (
                      <RupiahInput aria-label={k.nama} value={nilai[k.id]} onValueChange={(v) => setNilai((x) => ({ ...x, [k.id]: v }))} />
                    ) : (
                      <div className="relative">
                        <input
                          inputMode="decimal"
                          aria-label={k.nama}
                          value={nilai[k.id] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value.replace(',', '.').replace(/[^\d.]/g, '')
                            setNilai((x) => ({ ...x, [k.id]: v === '' ? null : Number(v) }))
                          }}
                          className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pr-8 pl-3 text-right text-base tabular-nums focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-stone-500">%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 px-1 text-xs text-stone-500">Terisi nilai bawaan. Ubah bila kulakan kali ini berbeda.</p>
          </section>
        </div>

        {/* Hasil hitung modal */}
        <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm md:sticky md:top-8" aria-live="polite">
          <p className="text-sm font-medium text-stone-500">Modal/pcs kulakan ini</p>
          <p className="mt-1 text-3xl font-bold text-ink tabular-nums">{modalPcs != null ? rp(modalPcs) : '—'}</p>
          {modalPcs != null && beli != null && (
            <div className="mt-3 border-t border-stone-100 pt-2">
              <Rinci label="Harga beli" nilai={rp(beli)} />
              {komp.map((k) => (
                <Rinci
                  key={k.id}
                  label={
                    <>
                      {k.nama}
                      <span className="block text-xs text-stone-400">{k.jenis === 'perKulakan' ? `${rp(k.nilai)} ÷ ${q} pcs` : labelModal(k)}</span>
                    </>
                  }
                  nilai={`+${rp(nilaiKomponenModalPerPcs(k, beli, q))}`}
                  nada="kurang"
                />
              ))}
            </div>
          )}
          {p && modalBaru != null && (
            <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm">
              <div className="flex justify-between py-0.5">
                <span className="text-stone-600">Stok</span>
                <span className="font-semibold text-ink tabular-nums">
                  {p.stok} → {p.stok + q}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 py-0.5">
                <span className="text-stone-600">Modal/pcs produk</span>
                <span className="font-semibold whitespace-nowrap text-ink tabular-nums">
                  {rp(p.modal)} → {rp(modalBaru)}
                </span>
              </div>
            </div>
          )}
          {turun.length > 0 && (
            <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <Ikon d={IK.peringatan} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Modal naik. Harga di {turun.map((s) => s.nama).join(', ')} jadi di bawah target untung.</span>
            </p>
          )}
          {modalPcs == null && <p className="mt-2 text-sm text-stone-500">Isi jumlah dan harga beli untuk menghitung modal.</p>}
        </section>
      </div>

      <BilahBawah>
        <Button block className="min-h-12" onClick={simpan}>
          Simpan barang masuk
        </Button>
      </BilahBawah>
      <PilihProdukSheet open={pilih} onClose={() => setPilih(false)} onPilih={setProdukId} />
    </div>
  )
}

const ALASAN = ['Rusak', 'Hilang', 'Hitung fisik', 'Lainnya']

export function PenyesuaianStok() {
  const { id } = useParams()
  const st = useStore()
  const nav = useNavigate()
  const p = st.produk.find((x) => x.id === id)
  const [jenis, setJenis] = useState<'kurang' | 'tambah' | 'hitung'>('kurang')
  const [jml, setJml] = useState('')
  const [alasan, setAlasan] = useState('Rusak')
  const [catatan, setCatatan] = useState('')
  if (!p) return <BilahAtas judul="Produk tidak ditemukan" kembali="/produk" />

  const n = Number(jml)
  const ada = jml !== ''
  const perubahan = !ada ? 0 : jenis === 'kurang' ? -n : jenis === 'tambah' ? n : n - p.stok
  const baru = p.stok + perubahan
  const err = ada && baru < 0 ? `Stok sekarang ${p.stok}, tidak bisa dikurangi ${n}` : undefined

  return (
    <div className="md:max-w-xl">
      <BilahAtas judul="Sesuaikan stok" tutup />
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3">
        <Thumb nama={p.nama} kecil />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium text-ink">{p.nama}</p>
          <p className="text-sm text-stone-500">Stok di aplikasi: {p.stok} pcs</p>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <Tabs
          items={[
            { key: 'kurang', label: 'Kurangi' },
            { key: 'tambah', label: 'Tambah' },
            { key: 'hitung', label: 'Hasil hitung' },
          ]}
          value={jenis}
          onChange={(j) => {
            setJenis(j)
            setAlasan(j === 'hitung' ? 'Hitung fisik' : j === 'kurang' ? 'Rusak' : 'Lainnya')
          }}
        />
        <Input
          label={jenis === 'hitung' ? 'Jumlah sebenarnya di rak' : jenis === 'kurang' ? 'Dikurangi berapa pcs' : 'Ditambah berapa pcs'}
          inputMode="numeric"
          placeholder="0"
          value={jml}
          onChange={(e) => setJml(e.target.value.replace(/\D/g, ''))}
          error={err}
        />
        <div>
          <Label>Alasan</Label>
          <Pilihan label="Alasan" items={ALASAN.map((a) => ({ key: a, label: a }))} value={alasan} onChange={setAlasan} />
        </div>
        <Input label="Catatan" placeholder="Opsional, mis. kena noda" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </div>
      <BilahBawah
        ringkas={
          ada && !err ? (
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Stok</span>
              <span className="font-semibold text-ink tabular-nums">
                {p.stok} → {baru} ({perubahan > 0 ? '+' : ''}
                {perubahan})
              </span>
            </div>
          ) : undefined
        }
      >
        <Button
          block
          className="min-h-12"
          disabled={!ada || !!err || perubahan === 0}
          onClick={() => {
            st.simpanPenyesuaian({ tanggal: st.hariIni, produkId: p.id, perubahan, alasan, catatan: catatan || undefined })
            st.tampilkan(`Stok disesuaikan jadi ${baru}.`)
            nav(-1)
          }}
        >
          Simpan penyesuaian
        </Button>
      </BilahBawah>
    </div>
  )
}

export function CatatBiaya() {
  const st = useStore()
  const nav = useNavigate()
  const [tanggal, setTanggal] = useState(st.hariIni)
  const [kat, setKat] = useState(st.kategoriBiaya[0])
  const [jumlah, setJumlah] = useState<number | null>(null)
  const [catatan, setCatatan] = useState('')
  const [coba, setCoba] = useState(false)
  return (
    <div className="md:max-w-xl">
      <BilahAtas judul="Catat biaya" tutup />
      <div className="flex flex-col gap-5">
        <RupiahInput label="Jumlah" value={jumlah} onValueChange={setJumlah} error={coba && !jumlah ? 'Isi jumlah biaya' : undefined} className="text-lg font-semibold" />
        <div>
          <Label>Kategori</Label>
          <Pilihan label="Kategori" items={st.kategoriBiaya.map((k) => ({ key: k, label: k }))} value={kat} onChange={setKat} />
        </div>
        <Input label="Tanggal" type="date" value={tanggal} max={st.hariIni} onChange={(e) => setTanggal(e.target.value)} />
        <Input label="Catatan" placeholder="Opsional, mis. Pasar minggu Lapangan Merdeka" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </div>
      <BilahBawah>
        <Button
          block
          className="min-h-12"
          onClick={() => {
            setCoba(true)
            if (!jumlah) return
            st.simpanBiaya({ tanggal, kategori: kat, jumlah, catatan: catatan || undefined })
            st.tampilkan(`Biaya ${kat} ${rp(jumlah)} tersimpan.`)
            nav(-1)
          }}
        >
          Simpan biaya
        </Button>
      </BilahBawah>
    </div>
  )
}
