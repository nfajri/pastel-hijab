import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DataState from '../components/DataState'
import { BilahAtas, Button, Daftar, IK, Ikon, Lencana, RupiahInput, Sheet, StokLencana, Thumb } from '../components/ui'
import { api } from '../lib/api'
import type { BarangMasuk, Penyesuaian, Produk, Saluran } from '../lib/api-types'
import { fmtPersen, rp, rpModal, tglPendek } from '../lib/format'
import { useToast } from '../lib/toast'
import { perkiraanUntung } from '../lib/untung'
import { useApi } from '../lib/useApi'
import { useKirim } from '../lib/useKirim'

type Riwayat =
  | { jenis: 'masuk'; id: number; tanggal: string; dibuat: string; ubah: number; data: BarangMasuk }
  | { jenis: 'sesuai'; id: number; tanggal: string; dibuat: string; ubah: number; data: Penyesuaian }

function AturHarga({ produk, saluran, buka, tutup, onProduk }: { produk: Produk; saluran: Saluran | null; buka: boolean; tutup: () => void; onProduk: (p: Produk) => void }) {
  const { tampilkan } = useToast()
  const ada = saluran ? produk.harga.find((h) => h.saluran_id === saluran.id) : undefined
  const [harga, setHarga] = useState<number | null>(ada?.harga ?? null)
  const [coba, setCoba] = useState(false)
  const { sibuk, galat, kirim } = useKirim()
  if (!saluran) return null
  const est = harga ? perkiraanUntung(produk.modal, saluran, harga) : null

  const simpan = async () => {
    setCoba(true)
    if (!harga) return
    const r = await kirim(() => api<Produk>(`/produk/${produk.id}/harga/${saluran.id}`, { method: 'PUT', body: { harga } }))
    if (r.ok) {
      onProduk(r.hasil)
      tampilkan(`Harga ${saluran.nama} jadi ${rp(harga)}.`)
      tutup()
    }
  }
  const hapus = async () => {
    const r = await kirim(() => api(`/produk/${produk.id}/harga/${saluran.id}`, { method: 'DELETE' }))
    if (r.ok) {
      onProduk({ ...produk, harga: produk.harga.filter((h) => h.saluran_id !== saluran.id) })
      tampilkan(`Harga ${saluran.nama} dihapus.`)
      tutup()
    }
  }

  return (
    <Sheet open={buka} onClose={tutup} title={`Harga di ${saluran.nama}`}>
      <div className="flex flex-col gap-4">
        <RupiahInput label="Harga jual per pcs" value={harga} onValueChange={setHarga} error={coba && !harga ? 'Isi harga jual' : undefined} autoFocus />
        {est && (
          <div className="rounded-xl bg-stone-50 px-3 py-2.5 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-stone-600">Modal/pcs</span>
              <span className="font-semibold text-ink tabular-nums">{rpModal(produk.modal)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-stone-600">Potongan {saluran.nama} (perkiraan 1 pcs)</span>
              <span className="font-semibold text-ink tabular-nums">{rp(est.totalPotongan)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-stone-600">Untung</span>
              <span className={`font-semibold tabular-nums ${est.untung < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {rp(est.untung)} · {fmtPersen(est.persenJual)}
              </span>
            </div>
          </div>
        )}
        {galat && (
          <p className="text-sm text-red-600" role="alert">
            {galat}
          </p>
        )}
        <Button block onClick={simpan} disabled={sibuk}>
          {sibuk ? 'Menyimpan…' : 'Simpan harga'}
        </Button>
        <Link to={`/harga?produk=${produk.id}&saluran=${saluran.id}`} className="text-center text-sm font-semibold text-brand-700">
          Hitung harga dengan target untung
        </Link>
        {ada && (
          <Button variant="ghost" block className="text-red-700" onClick={hapus} disabled={sibuk}>
            Hapus harga
          </Button>
        )}
      </div>
    </Sheet>
  )
}

function RincianRiwayat({ r, tutup, onUbah }: { r: Riwayat | null; tutup: () => void; onUbah: () => void }) {
  const { tampilkan } = useToast()
  const { sibuk, galat, kirim } = useKirim()
  const [konfirmasi, setKonfirmasi] = useState(false)
  if (!r) return null

  const hapus = async () => {
    const path = r.jenis === 'masuk' ? `/barang-masuk/${r.id}` : `/penyesuaian-stok/${r.id}`
    const res = await kirim(() => api(path, { method: 'DELETE' }))
    if (res.ok) {
      tampilkan(r.jenis === 'masuk' ? 'Barang masuk dihapus, stok dikurangi.' : 'Penyesuaian dibatalkan, stok dikembalikan.')
      setKonfirmasi(false)
      onUbah()
      tutup()
    }
  }

  return (
    <Sheet open onClose={tutup} title={r.jenis === 'masuk' ? 'Barang masuk' : 'Penyesuaian stok'}>
      {r.jenis === 'masuk' ? (
        <div className="text-sm">
          <Baris k="Tanggal" v={r.data.tanggal} />
          {r.data.supplier && <Baris k="Supplier" v={r.data.supplier} />}
          <Baris k="Jumlah" v={`${r.data.qty} pcs`} />
          <Baris k="Harga beli/pcs" v={rp(r.data.harga_beli)} />
          {r.data.komponen.map((k, i) => (
            <Baris key={i} k={k.nama} v={`+${rpModal(k.per_pcs)}`} redup />
          ))}
          <Baris k="Modal/pcs kulakan ini" v={rpModal(r.data.modal_pcs)} tebal />
          <Baris k="Modal/pcs produk sebelumnya" v={rpModal(r.data.modal_sebelum)} />
          {r.data.catatan && <Baris k="Catatan" v={r.data.catatan} />}
        </div>
      ) : (
        <div className="text-sm">
          <Baris k="Tanggal" v={r.data.tanggal} />
          <Baris k="Alasan" v={r.data.alasan} />
          <Baris k="Stok" v={`${r.data.stok_sebelum} → ${r.data.stok_sesudah} (${r.data.selisih > 0 ? '+' : ''}${r.data.selisih})`} tebal />
        </div>
      )}
      {galat && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {galat}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {r.jenis === 'masuk' && (
          <Link to={`/masuk/${r.id}/ubah`} className="flex min-h-11 items-center justify-center rounded-xl border border-brand-500 bg-white px-4 font-semibold text-brand-700 hover:bg-brand-50">
            Ubah barang masuk
          </Link>
        )}
        {!konfirmasi ? (
          <Button variant="ghost" block className="text-red-700" onClick={() => setKonfirmasi(true)}>
            {r.jenis === 'masuk' ? 'Hapus barang masuk' : 'Batalkan penyesuaian'}
          </Button>
        ) : (
          <div className="rounded-xl bg-red-50 p-3">
            <p className="mb-2 text-sm text-red-800">{r.jenis === 'masuk' ? 'Stok dikurangi sebanyak kulakan ini dan modal produk dihitung ulang.' : 'Stok dikembalikan seperti sebelum penyesuaian.'} Lanjutkan?</p>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" onClick={hapus} disabled={sibuk}>
                Ya, lanjutkan
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setKonfirmasi(false)}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function Baris({ k, v, tebal, redup }: { k: string; v: string; tebal?: boolean; redup?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={redup ? 'pl-3 text-stone-500' : 'text-stone-600'}>{k}</span>
      <span className={`text-right tabular-nums ${tebal ? 'font-bold text-ink' : redup ? 'text-stone-600' : 'font-medium text-ink'}`}>{v}</span>
    </div>
  )
}

export default function DetailProduk() {
  const { id } = useParams()
  const produk = useApi<Produk>(`/produk/${id}`)
  const saluran = useApi<Saluran[]>('/saluran?aktif=1')
  const masuk = useApi<BarangMasuk[]>(`/barang-masuk?produk_id=${id}&limit=50`)
  const sesuai = useApi<Penyesuaian[]>(`/penyesuaian-stok?produk_id=${id}`)
  const [harga, setHarga] = useState<number | null>(null)
  const [buka, setBuka] = useState<Riwayat | null>(null)
  const [semua, setSemua] = useState(false)

  const riwayat = useMemo<Riwayat[] | null>(() => {
    if (!masuk.data || !sesuai.data) return null
    const xs: Riwayat[] = [
      ...masuk.data.map((m): Riwayat => ({ jenis: 'masuk', id: m.id, tanggal: m.tanggal, dibuat: m.created_at, ubah: m.qty, data: m })),
      ...sesuai.data.map((s): Riwayat => ({ jenis: 'sesuai', id: s.id, tanggal: s.tanggal, dibuat: s.created_at, ubah: s.selisih, data: s })),
    ]
    return xs.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat.localeCompare(a.dibuat))
  }, [masuk.data, sesuai.data])

  const segarkan = () => {
    produk.muat()
    masuk.muat()
    sesuai.muat()
  }
  const sal = saluran.data?.find((s) => s.id === harga) ?? null

  return (
    <div>
      <BilahAtas
        judul={produk.data?.nama ?? 'Produk'}
        kembali="/produk"
        kanan={
          produk.data && (
            <Link to={`/produk/${produk.data.id}/ubah`} className="flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              Ubah
            </Link>
          )
        }
      />
      <DataState hasil={produk}>
        {(p) => (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
            <div className="flex flex-col gap-4">
              <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Thumb nama={p.nama} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-500">
                      {p.kategori || 'Tanpa kategori'}
                      {!p.aktif && ' · Nonaktif'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <p className="text-3xl font-bold text-ink tabular-nums">
                        {p.stok} <span className="text-base font-medium text-stone-500">pcs</span>
                      </p>
                      {p.menipis && <StokLencana stok={p.stok} batas={p.batas_stok_menipis} />}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3 text-sm">
                  <div>
                    <p className="text-xs text-stone-500">Modal/pcs</p>
                    <p className="font-semibold text-ink tabular-nums">{rpModal(p.modal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">Nilai stok</p>
                    <p className="font-semibold text-ink tabular-nums">{rp(p.stok * p.modal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">Batas menipis</p>
                    <p className="font-semibold text-ink tabular-nums">{p.batas_stok_menipis} pcs</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link to={`/masuk?produk=${p.id}`} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-2 text-sm font-semibold whitespace-nowrap text-white hover:bg-brand-600">
                    <Ikon d={IK.masuk} /> Barang masuk
                  </Link>
                  <Link to={`/stok/${p.id}`} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-500 bg-white px-2 text-sm font-semibold whitespace-nowrap text-brand-700 hover:bg-brand-50">
                    <Ikon d={IK.stok} /> Sesuaikan stok
                  </Link>
                </div>
              </section>

              <DataState hasil={saluran} baris={2}>
                {(sals) => (
                  <Daftar
                    judul="Harga jual per saluran"
                    aksi={
                      <Link to={`/harga?produk=${p.id}`} className="text-sm font-semibold text-brand-700">
                        Hitung harga
                      </Link>
                    }
                  >
                    {sals.length === 0 && <p className="px-4 py-4 text-sm text-stone-500">Belum ada saluran aktif. Aktifkan di Pengaturan → Saluran & potongan.</p>}
                    {sals.map((s) => {
                      const hs = p.harga.find((h) => h.saluran_id === s.id)
                      if (!hs)
                        return (
                          <button key={s.id} type="button" onClick={() => setHarga(s.id)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50">
                            <span className="font-medium text-ink">{s.nama}</span>
                            <span className="text-sm font-semibold text-brand-700">Atur harga</span>
                          </button>
                        )
                      // untung & status target dari server (dihitung ulang setiap dibaca)
                      const persen = hs.harga > 0 ? (hs.untung / hs.harga) * 100 : 0
                      return (
                        <button key={s.id} type="button" onClick={() => setHarga(s.id)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink">{s.nama}</p>
                            <p className="text-sm text-stone-500 tabular-nums">
                              Untung {rp(hs.untung)} · {fmtPersen(persen)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-ink tabular-nums">{rp(hs.harga)}</p>
                            {hs.untung < 0 ? <Lencana nada="bahaya">Rugi</Lencana> : hs.di_bawah_target ? <Lencana nada="peringatan">Di bawah target</Lencana> : null}
                          </div>
                        </button>
                      )
                    })}
                  </Daftar>
                )}
              </DataState>
            </div>

            <div>
              {riwayat === null && (masuk.gagal || sesuai.gagal) ? (
                <div className="rounded-2xl border border-red-200 bg-white p-4 text-center" role="alert">
                  <p className="font-semibold text-ink">Riwayat stok belum bisa dimuat</p>
                  <Button variant="secondary" className="mt-3" onClick={segarkan}>
                    Coba lagi
                  </Button>
                </div>
              ) : riwayat === null ? (
                <p className="px-1 text-sm text-stone-500">Memuat riwayat…</p>
              ) : (
                <Daftar judul="Riwayat stok">
                  {riwayat.length === 0 && <p className="px-4 py-4 text-sm text-stone-500">Belum ada riwayat. Catat barang masuk untuk mengisi stok.</p>}
                  {(semua ? riwayat : riwayat.slice(0, 8)).map((x) => (
                    <button key={`${x.jenis}${x.id}`} type="button" onClick={() => setBuka(x)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                      <div className="w-14 shrink-0 text-sm text-stone-500">{tglPendek(x.tanggal)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{x.jenis === 'masuk' ? 'Barang masuk' : `Penyesuaian · ${x.data.alasan}`}</p>
                        <p className="truncate text-xs text-stone-500">{x.jenis === 'masuk' ? `${x.data.supplier ? x.data.supplier + ' · ' : ''}modal ${rpModal(x.data.modal_pcs)}/pcs` : `Stok ${x.data.stok_sebelum} → ${x.data.stok_sesudah}`}</p>
                      </div>
                      <span className={`font-semibold tabular-nums ${x.ubah > 0 ? 'text-emerald-700' : 'text-stone-700'}`}>
                        {x.ubah > 0 ? '+' : ''}
                        {x.ubah}
                      </span>
                    </button>
                  ))}
                  {!semua && riwayat.length > 8 && (
                    <button type="button" onClick={() => setSemua(true)} className="min-h-11 w-full px-4 text-sm font-semibold text-brand-700">
                      Lihat semua ({riwayat.length})
                    </button>
                  )}
                </Daftar>
              )}
            </div>

            <AturHarga key={harga ?? 0} produk={p} saluran={sal} buka={sal !== null} tutup={() => setHarga(null)} onProduk={produk.setData} />
          </div>
        )}
      </DataState>
      <RincianRiwayat key={buka ? `${buka.jenis}${buka.id}` : 'x'} r={buka} tutup={() => setBuka(null)} onUbah={segarkan} />
    </div>
  )
}
