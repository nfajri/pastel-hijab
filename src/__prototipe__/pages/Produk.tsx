import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Input } from '../../components/ui'
import { KATEGORI_PRODUK, tglPendek, type Produk as TProduk } from '../lib/data'
import { fmtPersen, memenuhiTarget, rincian, rp } from '../lib/hitung'
import { useStore } from '../lib/store'
import { BilahAtas, BilahBawah, Daftar, Gagal, IK, Ikon, Kerangka, KepalaHalaman, Kosong, Label, Lencana, Pilihan, StokLencana, Thumb } from '../ui'

export default function Produk() {
  const st = useStore()
  const [q, setQ] = useState('')
  const [kat, setKat] = useState('Semua')
  const list = st.produk.filter((p) => (kat === 'Semua' || p.kategori === kat) && p.nama.toLowerCase().includes(q.toLowerCase()))
  const salAktif = st.saluran.filter((s) => s.aktif)

  return (
    <>
      <KepalaHalaman
        judul="Produk"
        sub={st.mode === 'normal' ? `${st.produk.length} model · ${st.produk.reduce((t, p) => t + p.stok, 0)} pcs di stok` : undefined}
        aksi={
          <>
            <Link to="/masuk" className="hidden min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700 md:inline-flex">
              <Ikon d={IK.masuk} /> Barang masuk
            </Link>
            <Link to="/produk/baru" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-600" aria-label="Tambah produk">
              <Ikon d={IK.plus} /> <span className="hidden sm:inline">Tambah produk</span>
              <span className="sm:hidden">Tambah</span>
            </Link>
          </>
        }
      />

      {st.mode === 'memuat' && <Kerangka baris={6} />}
      {st.mode === 'gagal' && <Gagal onUlang={() => st.setMode('normal')} />}
      {st.mode === 'kosong' && (
        <Kosong
          ikon={IK.produk}
          judul="Belum ada produk"
          teks="Tambahkan model hijab yang dijual. Stok dan modal diisi lewat barang masuk."
          aksi={
            <Link to="/produk/baru" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-semibold text-white">
              Tambah produk
            </Link>
          }
        />
      )}

      {st.mode === 'normal' && (
        <>
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative md:w-72">
              <Ikon d={IK.cari} className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari produk"
                aria-label="Cari produk"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pr-3 pl-10 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
              />
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
              {['Semua', ...KATEGORI_PRODUK].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKat(k)}
                  className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${kat === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {list.length === 0 && <Kosong ikon={IK.cari} judul="Produk tidak ditemukan" teks="Coba kata lain atau pilih kategori Semua." />}

          {/* HP: daftar */}
          {list.length > 0 && (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm md:hidden">
              {list.map((p) => (
                <Link key={p.id} to={`/produk/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-slate-50">
                  <Thumb nama={p.nama} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium text-slate-900">{p.nama}</p>
                    <p className="text-sm text-slate-500 tabular-nums">Modal {rp(p.modal)}</p>
                  </div>
                  <StokLencana stok={p.stok} batas={p.batas} />
                </Link>
              ))}
            </div>
          )}

          {/* Laptop: tabel dengan harga per saluran */}
          {list.length > 0 && (
            <div className="hidden overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-3 py-3 text-right">Stok</th>
                    <th className="px-3 py-3 text-right">Modal</th>
                    {salAktif.map((s) => (
                      <th key={s.id} className="px-3 py-3 text-right whitespace-nowrap">
                        {s.nama}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link to={`/produk/${p.id}`} className="flex items-center gap-3">
                          <Thumb nama={p.nama} kecil />
                          <span className="min-w-0">
                            <span className="line-clamp-1 font-medium text-slate-900">{p.nama}</span>
                            <span className="text-xs text-slate-500">{p.kategori}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <StokLencana stok={p.stok} batas={p.batas} />
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700 tabular-nums">{rp(p.modal)}</td>
                      {salAktif.map((s) => {
                        const hs = p.harga[s.id]
                        const kurang = hs && !memenuhiTarget(p.modal, s.potongan, hs.harga, hs.cara, hs.nilai)
                        return (
                          <td key={s.id} className={`px-3 py-3 text-right tabular-nums ${kurang ? 'font-semibold text-amber-700' : 'text-slate-700'}`}>
                            {hs ? rp(hs.harga) : <span className="text-slate-400">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}

function riwayat(st: ReturnType<typeof useStore>, p: TProduk) {
  const xs: { tanggal: string; teks: string; sub: string; ubah: number }[] = []
  st.masuk.filter((m) => m.produkId === p.id).forEach((m) => xs.push({ tanggal: m.tanggal, teks: 'Barang masuk', sub: `${m.supplier} · modal ${rp(m.modalPcs)}/pcs`, ubah: m.qty }))
  st.penyesuaian.filter((s) => s.produkId === p.id).forEach((s) => xs.push({ tanggal: s.tanggal, teks: `Penyesuaian · ${s.alasan}`, sub: s.catatan ?? '', ubah: s.perubahan }))
  st.penjualan.forEach((j) =>
    j.baris
      .filter((b) => b.produkId === p.id)
      .forEach((b) => xs.push({ tanggal: j.tanggal, teks: `Terjual · ${st.saluran.find((s) => s.id === j.saluranId)?.nama}`, sub: `${rp(b.harga)}/pcs`, ubah: -b.qty })),
  )
  return xs.sort((a, b) => b.tanggal.localeCompare(a.tanggal))
}

export function DetailProduk() {
  const { id } = useParams()
  const st = useStore()
  const p = st.produk.find((x) => x.id === id)
  if (!p) return <BilahAtas judul="Produk tidak ditemukan" kembali="/produk" />
  const rw = riwayat(st, p)

  return (
    <div>
      <BilahAtas
        judul={p.nama}
        kembali="/produk"
        kanan={
          <Link to={`/produk/${p.id}/ubah`} className="flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            Ubah
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Thumb nama={p.nama} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-500">{p.kategori}</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <p className="text-3xl font-bold text-slate-900 tabular-nums">
                    {p.stok} <span className="text-base font-medium text-slate-500">pcs</span>
                  </p>
                  {p.stok <= p.batas && <StokLencana stok={p.stok} batas={p.batas} />}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Modal/pcs</p>
                <p className="font-semibold text-slate-900 tabular-nums">{rp(p.modal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Nilai stok</p>
                <p className="font-semibold text-slate-900 tabular-nums">{rp(p.stok * p.modal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Batas menipis</p>
                <p className="font-semibold text-slate-900 tabular-nums">{p.batas} pcs</p>
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

          <Daftar
            judul="Harga jual per saluran"
            aksi={
              <Link to={`/harga?produk=${p.id}`} className="text-sm font-semibold text-brand-700">
                Hitung harga
              </Link>
            }
          >
            {st.saluran
              .filter((s) => s.aktif)
              .map((s) => {
                const hs = p.harga[s.id]
                if (!hs)
                  return (
                    <Link key={s.id} to={`/harga?produk=${p.id}&saluran=${s.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                      <span className="font-medium text-slate-900">{s.nama}</span>
                      <span className="text-sm font-semibold text-brand-700">Atur harga</span>
                    </Link>
                  )
                const r = rincian(p.modal, s.potongan, hs.harga)
                const ok = memenuhiTarget(p.modal, s.potongan, hs.harga, hs.cara, hs.nilai)
                return (
                  <Link key={s.id} to={`/harga?produk=${p.id}&saluran=${s.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{s.nama}</p>
                      <p className="text-sm text-slate-500 tabular-nums">
                        Untung {rp(r.untung)} · {fmtPersen(r.persenJual)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 tabular-nums">{rp(hs.harga)}</p>
                      {!ok && <Lencana nada="peringatan">Di bawah target</Lencana>}
                    </div>
                  </Link>
                )
              })}
          </Daftar>
        </div>

        <Daftar judul="Riwayat stok">
          {rw.length === 0 && <p className="px-4 py-4 text-sm text-slate-500">Belum ada riwayat.</p>}
          {rw.slice(0, 8).map((x, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="w-14 shrink-0 text-sm text-slate-500">{tglPendek(x.tanggal)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{x.teks}</p>
                {x.sub && <p className="truncate text-xs text-slate-500">{x.sub}</p>}
              </div>
              <span className={`font-semibold tabular-nums ${x.ubah > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                {x.ubah > 0 ? '+' : ''}
                {x.ubah}
              </span>
            </div>
          ))}
        </Daftar>
      </div>
    </div>
  )
}

export function FormProduk() {
  const { id } = useParams()
  const st = useStore()
  const nav = useNavigate()
  const lama = st.produk.find((x) => x.id === id)
  const [nama, setNama] = useState(lama?.nama ?? '')
  const [kat, setKat] = useState(lama?.kategori ?? KATEGORI_PRODUK[0])
  const [batas, setBatas] = useState(String(lama?.batas ?? 5))
  const [coba, setCoba] = useState(false)
  const errNama = coba && !nama.trim() ? 'Nama produk wajib diisi' : undefined

  const simpan = (lanjutMasuk: boolean) => {
    setCoba(true)
    if (!nama.trim()) return
    const pid = lama?.id ?? `p${Date.now()}`
    st.simpanProduk({ ...(lama ?? { id: pid, stok: 0, modal: 0, harga: {}, laku30: 0 }), nama: nama.trim(), kategori: kat, batas: Number(batas) || 0 } as TProduk)
    if (lanjutMasuk) nav(`/masuk?produk=${pid}`, { replace: true })
    else {
      st.tampilkan('Produk tersimpan.')
      nav(`/produk/${pid}`, { replace: true })
    }
  }

  return (
    <div className="md:max-w-xl">
      <BilahAtas judul={lama ? 'Ubah produk' : 'Tambah produk'} tutup />
      <div className="flex flex-col gap-5">
        <button type="button" className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500">
          <Ikon d={IK.plus} /> Foto
        </button>
        <Input label="Nama model" placeholder="mis. Pashmina Ceruty Babydoll" value={nama} onChange={(e) => setNama(e.target.value)} error={errNama} />
        <div>
          <Label>Kategori</Label>
          <Pilihan label="Kategori" items={KATEGORI_PRODUK.map((k) => ({ key: k, label: k }))} value={kat} onChange={setKat} />
        </div>
        <Input label="Ingatkan bila stok tinggal" inputMode="numeric" value={batas} onChange={(e) => setBatas(e.target.value.replace(/\D/g, ''))} hint="Produk masuk daftar stok menipis saat stok sama atau di bawah angka ini." />
        {!lama && <p className="rounded-xl bg-white px-3 py-2.5 text-sm text-slate-600">Stok dan modal diisi lewat barang masuk, supaya modal/pcs dihitung dari komponen modal.</p>}
      </div>
      <BilahBawah>
        {lama ? (
          <Button block className="min-h-12" onClick={() => simpan(false)}>
            Simpan
          </Button>
        ) : (
          <>
            <Button variant="secondary" className="min-h-12 flex-1" onClick={() => simpan(false)}>
              Simpan saja
            </Button>
            <Button className="min-h-12 flex-[1.4]" onClick={() => simpan(true)}>
              Simpan & isi stok
            </Button>
          </>
        )}
      </BilahBawah>
    </div>
  )
}
