import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import DataState from '../components/DataState'
import { BilahAtas, BilahBawah, Button, IK, Ikon, Input, Label, Rinci, RupiahInput, Sheet, StokLencana, Tabs, Thumb } from '../components/ui'
import { api } from '../lib/api'
import type { BarangMasuk as TBarangMasuk, BarangMasukInput, JenisModal, KomponenModal, Produk, Saluran } from '../lib/api-types'
import { hariIniWIB, labelModal, LABEL_JENIS_MODAL, parseDesimal, rp, rpModal, tampilDesimal } from '../lib/format'
import { modalKulakan, modalRataRata, perPcs } from '../lib/modal'
import { useToast } from '../lib/toast'
import { useApi } from '../lib/useApi'
import { useKirim } from '../lib/useKirim'

interface Baris {
  key: string
  /** null = komponen khusus kulakan ini */
  komponenId: number | null
  nama: string
  jenis: JenisModal
  nilai: number | null
}

const KET_JENIS: Record<JenisModal, string> = {
  per_pcs: 'per pcs',
  per_kulakan: 'per kulakan, dibagi jumlah',
  persen_harga_beli: 'dari harga beli',
}

function PilihProdukSheet({ open, onClose, produk, onPilih }: { open: boolean; onClose: () => void; produk: Produk[]; onPilih: (id: number) => void }) {
  const [q, setQ] = useState('')
  const list = produk.filter((p) => p.nama.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet open={open} onClose={onClose} title="Pilih produk">
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
        {list.length === 0 && <p className="px-4 py-3 text-sm text-stone-500">Produk tidak ditemukan.</p>}
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
            <StokLencana stok={p.stok} batas={p.batas_stok_menipis} />
          </button>
        ))}
      </div>
      <Link to="/produk/baru" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold text-brand-700">
        <Ikon d={IK.plus} /> Produk baru
      </Link>
    </Sheet>
  )
}

function KomponenKhusus({ buka, tutup, onTambah }: { buka: boolean; tutup: () => void; onTambah: (b: Omit<Baris, 'key' | 'komponenId'>) => void }) {
  const [nama, setNama] = useState('')
  const [jenis, setJenis] = useState<JenisModal>('per_kulakan')
  const [nilai, setNilai] = useState<number | null>(null)
  const [coba, setCoba] = useState(false)
  const items = (Object.keys(LABEL_JENIS_MODAL) as JenisModal[]).map((key) => ({ key, label: LABEL_JENIS_MODAL[key] }))
  return (
    <Sheet open={buka} onClose={tutup} title="Komponen khusus kulakan ini">
      <div className="flex flex-col gap-4">
        <Input label="Nama" placeholder="mis. Ongkir" value={nama} onChange={(e) => setNama(e.target.value)} error={coba && !nama.trim() ? 'Isi nama komponen' : undefined} />
        <div>
          <Label>Jenis</Label>
          <Tabs items={items} value={jenis} onChange={setJenis} />
        </div>
        {jenis === 'persen_harga_beli' ? (
          <Input label="Nilai (%)" inputMode="decimal" value={tampilDesimal(nilai)} onChange={(e) => setNilai(parseDesimal(e.target.value))} error={coba && nilai == null ? 'Isi nilai' : undefined} />
        ) : (
          <RupiahInput label="Nilai" value={nilai} onValueChange={setNilai} error={coba && nilai == null ? 'Isi nilai' : undefined} />
        )}
        <p className="text-xs text-stone-500">Hanya berlaku untuk kulakan ini; tidak masuk daftar Komponen modal.</p>
        <Button
          block
          onClick={() => {
            setCoba(true)
            if (!nama.trim() || nilai == null) return
            onTambah({ nama: nama.trim(), jenis, nilai })
            setNama('')
            setNilai(null)
            setCoba(false)
            tutup()
          }}
        >
          Tambahkan
        </Button>
      </div>
    </Sheet>
  )
}

interface IsiProps {
  produk: Produk[]
  master: KomponenModal[]
  saluran: Saluran[]
  supplierAda: string[]
  lama: TBarangMasuk | null
  produkAwal: number | null
}

function Isi({ produk, master, saluran, supplierAda, lama, produkAwal }: IsiProps) {
  const nav = useNavigate()
  const { tampilkan } = useToast()
  const { sibuk, galat, kirim } = useKirim()
  const hariIni = hariIniWIB()
  const [produkId, setProdukId] = useState<number | null>(lama?.produk_id ?? produkAwal)
  const [pilih, setPilih] = useState(false)
  const [khusus, setKhusus] = useState(false)
  const [tanggal, setTanggal] = useState(lama?.tanggal ?? hariIni)
  const [supplier, setSupplier] = useState(lama?.supplier ?? '')
  const [qty, setQty] = useState(lama ? String(lama.qty) : '')
  const [beli, setBeli] = useState<number | null>(lama?.harga_beli ?? null)
  const [catatan, setCatatan] = useState(lama?.catatan ?? '')
  const [baris, setBaris] = useState<Baris[]>(() =>
    lama
      ? lama.komponen.map((k, i) => ({ key: `l${i}`, komponenId: k.komponen_id, nama: k.nama, jenis: k.jenis, nilai: k.nilai }))
      : master.map((k) => ({ key: `m${k.id}`, komponenId: k.id, nama: k.nama, jenis: k.jenis, nilai: k.nilai })),
  )
  const [coba, setCoba] = useState(false)

  const p = produk.find((x) => x.id === produkId) ?? null
  const q = Number(qty) || 0
  const komp = baris.map((b) => ({ ...b, nilai: b.nilai ?? 0 }))
  const modalPcs = beli != null && q > 0 ? modalKulakan(beli, q, komp) : null
  const modalBaru = !lama && p && modalPcs != null ? modalRataRata(p.stok, p.modal, q, modalPcs) : null
  const naik = p && modalBaru != null && modalBaru > p.modal && p.harga.length > 0
  const salNaik = naik ? saluran.filter((s) => p!.harga.some((h) => h.saluran_id === s.id)) : []

  const errTanggal = !tanggal ? 'Isi tanggal' : tanggal > hariIni ? 'Tanggal tidak boleh di masa depan' : undefined

  const ubahBaris = (key: string, nilai: number | null) => setBaris((bs) => bs.map((b) => (b.key === key ? { ...b, nilai } : b)))

  const simpan = async () => {
    setCoba(true)
    if (!p || q <= 0 || beli == null || errTanggal) return
    const body: BarangMasukInput = {
      tanggal,
      supplier: supplier.trim(),
      produk_id: p.id,
      qty: q,
      harga_beli: beli,
      catatan: catatan.trim(),
      komponen: baris.map((b) => (b.komponenId !== null ? { komponen_id: b.komponenId, nilai: b.nilai ?? 0 } : { nama: b.nama, jenis: b.jenis, nilai: b.nilai ?? 0 })),
    }
    const r = await kirim(async () => {
      const bm = lama ? await api<TBarangMasuk>(`/barang-masuk/${lama.id}`, { method: 'PUT', body }) : await api<TBarangMasuk>('/barang-masuk', { method: 'POST', body })
      const baru = await api<Produk>(`/produk/${p.id}`)
      return { bm, baru }
    })
    if (!r.ok) return
    const { baru } = r.hasil
    const nm = baru.nama.split(' ').slice(0, 3).join(' ')
    const cek = !lama && baru.modal > p.modal && baru.harga.length > 0 ? { label: 'Cek harga', to: `/produk/${baru.id}` } : undefined
    tampilkan(lama ? `Barang masuk diubah. Stok ${nm} ${baru.stok}, modal ${rpModal(baru.modal)}/pcs.` : `Stok ${nm} jadi ${baru.stok}. Modal ${rpModal(baru.modal)}/pcs.`, cek)
    nav(`/produk/${baru.id}`, { replace: true })
  }

  return (
    <div className="md:max-w-4xl">
      <BilahAtas judul={lama ? 'Ubah barang masuk' : 'Barang masuk'} tutup />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
        <div className="flex flex-col gap-5">
          <div>
            <Label>Produk</Label>
            <button
              type="button"
              disabled={!!lama}
              onClick={() => setPilih(true)}
              className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left disabled:opacity-80 ${coba && !p ? 'border-red-500' : 'border-stone-300'}`}
            >
              {p ? (
                <Thumb nama={p.nama} kecil />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                  <Ikon d={IK.produk} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className={`line-clamp-2 font-medium ${p ? 'text-ink' : 'text-stone-400'}`}>{p?.nama ?? 'Pilih produk'}</p>
                {p && (
                  <p className="text-sm text-stone-500 tabular-nums">
                    Stok {p.stok} · modal {rpModal(p.modal)}
                  </p>
                )}
              </div>
              {!lama && <span className="text-sm font-semibold text-brand-700">{p ? 'Ganti' : 'Pilih'}</span>}
            </button>
            {coba && !p && <p className="mt-1 text-sm text-red-600">Pilih produk dulu</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jumlah (pcs)" inputMode="numeric" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, '').slice(0, 6))} error={coba && q <= 0 ? 'Isi jumlah' : undefined} />
            <RupiahInput label="Harga beli/pcs" value={beli} onValueChange={setBeli} error={coba && beli == null ? 'Isi harga' : undefined} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tanggal" type="date" value={tanggal} max={hariIni} onChange={(e) => setTanggal(e.target.value)} error={coba ? errTanggal : undefined} />
            <Input label="Supplier" placeholder="Opsional" list="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            <datalist id="supplier">
              {supplierAda.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-700">Komponen modal</h2>
              <Link to="/pengaturan/modal" className="text-sm font-semibold text-brand-700">
                Atur
              </Link>
            </div>
            {baris.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-3 py-3 text-sm text-stone-500">Tanpa komponen modal. Modal/pcs = harga beli.</p>
            ) : (
              <div className="divide-y divide-stone-100 rounded-2xl border border-brand-100 bg-white">
                {baris.map((b) => (
                  <div key={b.key} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {b.nama}
                        {b.komponenId === null && <span className="ml-1.5 text-xs font-normal text-stone-400">khusus</span>}
                      </p>
                      <p className="text-xs text-stone-500">{KET_JENIS[b.jenis]}</p>
                    </div>
                    <div className="w-32 shrink-0">
                      {b.jenis !== 'persen_harga_beli' ? (
                        <RupiahInput aria-label={b.nama} value={b.nilai} onValueChange={(v) => ubahBaris(b.key, v)} />
                      ) : (
                        <div className="relative">
                          <input
                            inputMode="decimal"
                            aria-label={b.nama}
                            value={tampilDesimal(b.nilai)}
                            onChange={(e) => ubahBaris(b.key, parseDesimal(e.target.value))}
                            className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pr-8 pl-3 text-right text-base tabular-nums focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-stone-500">%</span>
                        </div>
                      )}
                    </div>
                    {b.komponenId === null && (
                      <button type="button" aria-label={`Hapus ${b.nama}`} onClick={() => setBaris((bs) => bs.filter((x) => x.key !== b.key))} className="flex h-11 w-9 shrink-0 items-center justify-center text-stone-400 hover:text-red-600">
                        <Ikon d={IK.tutup} className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-stone-500">{lama ? 'Nilai yang tercatat di kulakan ini.' : 'Terisi nilai bawaan. Ubah bila kulakan kali ini berbeda.'}</p>
              <button type="button" onClick={() => setKhusus(true)} className="shrink-0 text-sm font-semibold text-brand-700">
                + Komponen khusus
              </button>
            </div>
          </section>

          <Input label="Catatan" placeholder="Opsional" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </div>

        {/* Hasil hitung modal */}
        <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm md:sticky md:top-8" aria-live="polite">
          <p className="text-sm font-medium text-stone-500">Modal/pcs kulakan ini</p>
          <p className="mt-1 text-3xl font-bold text-ink tabular-nums" data-testid="modal-kulakan">
            {modalPcs != null ? rpModal(modalPcs) : '—'}
          </p>
          {modalPcs != null && beli != null && (
            <div className="mt-3 border-t border-stone-100 pt-2">
              <Rinci label="Harga beli" nilai={rp(beli)} />
              {komp.map((k) => (
                <Rinci
                  key={k.key}
                  label={
                    <>
                      {k.nama}
                      <span className="block text-xs text-stone-400">{k.jenis === 'per_kulakan' ? `${rp(k.nilai)} ÷ ${q} pcs` : labelModal(k)}</span>
                    </>
                  }
                  nilai={`+${rpModal(perPcs(k, beli, q))}`}
                  nada="kurang"
                />
              ))}
            </div>
          )}
          {p && modalBaru != null && (
            <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm" data-testid="ringkas-produk">
              <div className="flex justify-between py-0.5">
                <span className="text-stone-600">Stok</span>
                <span className="font-semibold text-ink tabular-nums">
                  {p.stok} → {p.stok + q}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 py-0.5">
                <span className="text-stone-600">Modal/pcs produk</span>
                <span className="font-semibold whitespace-nowrap text-ink tabular-nums">
                  {rpModal(p.modal)} → {rpModal(modalBaru)}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">Rata-rata tertimbang. Angka resmi muncul setelah disimpan.</p>
            </div>
          )}
          {lama && <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">Setelah disimpan, stok dan modal produk dihitung ulang oleh server.</p>}
          {salNaik.length > 0 && (
            <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <Ikon d={IK.peringatan} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Modal naik. Periksa harga jual di {salNaik.map((s) => s.nama).join(', ')}.</span>
            </p>
          )}
          {modalPcs == null && <p className="mt-2 text-sm text-stone-500">Isi jumlah dan harga beli untuk menghitung modal.</p>}
        </section>
      </div>

      <BilahBawah ringkas={galat ? <p className="text-sm text-red-600" role="alert">{galat}</p> : undefined}>
        <Button block className="min-h-12" onClick={simpan} disabled={sibuk}>
          {sibuk ? 'Menyimpan…' : lama ? 'Simpan perubahan' : 'Simpan barang masuk'}
        </Button>
      </BilahBawah>
      <PilihProdukSheet open={pilih} onClose={() => setPilih(false)} produk={produk} onPilih={setProdukId} />
      <KomponenKhusus buka={khusus} tutup={() => setKhusus(false)} onTambah={(b) => setBaris((bs) => [...bs, { ...b, key: `k${Date.now()}`, komponenId: null }])} />
    </div>
  )
}

export default function BarangMasuk() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const produk = useApi<Produk[]>('/produk?aktif=1')
  const master = useApi<KomponenModal[]>('/komponen-modal?aktif=1')
  const saluran = useApi<Saluran[]>('/saluran?aktif=1')
  const riwayat = useApi<TBarangMasuk[]>('/barang-masuk?limit=200')
  const lama = useApi<TBarangMasuk>(id ? `/barang-masuk/${id}` : null)
  const supplierAda = useMemo(() => [...new Set((riwayat.data ?? []).map((m) => m.supplier).filter(Boolean))], [riwayat.data])

  // Produk dari riwayat (mis. produk nonaktif) tetap harus ada saat mengubah kulakan lama.
  const produkUntukLama = useApi<Produk>(lama.data ? `/produk/${lama.data.produk_id}` : null)
  const butuhLama = !!id

  const gagal = produk.gagal !== null ? produk : master.gagal !== null ? master : saluran.gagal !== null ? saluran : lama.gagal !== null ? lama : produkUntukLama
  const siap = produk.data && master.data && saluran.data && (!butuhLama || (lama.data && produkUntukLama.data))
  const daftarProduk = produk.data && produkUntukLama.data && !produk.data.some((p) => p.id === produkUntukLama.data!.id) ? [...produk.data, produkUntukLama.data] : (produk.data ?? [])
  const awal = Number(sp.get('produk')) || null

  return (
    <DataState
      hasil={{
        data: siap ? true : null,
        memuat: !siap,
        gagal: gagal.gagal,
        muat: () => {
          produk.muat()
          master.muat()
          saluran.muat()
          lama.muat()
          produkUntukLama.muat()
        },
        setData: () => {},
      }}
      baris={4}
    >
      {() => <Isi key={id ?? 'baru'} produk={daftarProduk} master={master.data!} saluran={saluran.data!} supplierAda={supplierAda} lama={lama.data} produkAwal={awal} />}
    </DataState>
  )
}
