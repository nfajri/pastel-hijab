import { Link } from 'react-router-dom'
import { tglPendek } from '../lib/data'
import { rp } from '../lib/hitung'
import { omzet, pcs, ringkas } from '../lib/laporan'
import { namaSaluran, useStore } from '../lib/store'
import { BarisLink, Daftar, Gagal, IK, Ikon, Kerangka, Kosong, Lencana, StokLencana, Thumb } from '../ui'

export default function Beranda() {
  const st = useStore()
  const { mode, produk, penjualan, biaya, hariIni, hargaBermasalah, saluran } = st

  const r = ringkas(
    penjualan.filter((j) => j.tanggal === hariIni),
    biaya.filter((b) => b.tanggal === hariIni),
  )
  const menipis = produk.filter((p) => p.stok <= p.batas).sort((a, b) => a.stok - b.stok)

  return (
    <>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Sabtu, 17 Oktober 2026</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Halo, Ibu Rahma</h1>
        </div>
        <Link to="/pengaturan" aria-label="Pengaturan" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-white md:hidden">
          <Ikon d={IK.pengaturan} className="h-6 w-6" />
        </Link>
      </header>

      {mode === 'memuat' && <Kerangka baris={5} />}
      {mode === 'gagal' && <Gagal onUlang={() => st.setMode('normal')} />}

      {(mode === 'normal' || mode === 'kosong') && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_380px] md:items-start">
          <div className="flex flex-col gap-4">
            {/* Ringkasan hari ini */}
            <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm md:p-5">
              <p className="text-sm font-medium text-slate-500">Penjualan hari ini</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{rp(r.omzet)}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-xs text-slate-500">Untung kotor</p>
                  <p className="font-semibold text-emerald-700 tabular-nums">{rp(r.labaKotor)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Pesanan</p>
                  <p className="font-semibold text-slate-900 tabular-nums">{r.pesanan}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Terjual</p>
                  <p className="font-semibold text-slate-900 tabular-nums">{r.pcs} pcs</p>
                </div>
              </div>
            </section>

            {/* Aksi utama: catat penjualan (target < 1 menit) */}
            <Link to="/jual" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-700 text-lg font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-600 md:hidden">
              <Ikon d={IK.plus} className="h-6 w-6" strokeWidth={2.2} /> Catat penjualan
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/masuk" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-slate-300">
                <Ikon d={IK.masuk} className="h-5 w-5 text-brand-700" /> Barang masuk
              </Link>
              <Link to="/biaya/baru" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-slate-300">
                <Ikon d={IK.biaya} className="h-5 w-5 text-brand-700" /> Catat biaya
              </Link>
            </div>

            {mode === 'kosong' ? (
              <Kosong
                ikon={IK.produk}
                judul="Mulai dengan menambah produk"
                teks="Setelah produk dan stok awal tercatat, penjualan bisa dicatat dari sini."
                aksi={
                  <Link to="/produk/baru" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-semibold text-white">
                    Tambah produk
                  </Link>
                }
              />
            ) : (
              <Daftar
                judul="Penjualan terakhir"
                aksi={
                  <Link to="/transaksi" className="text-sm font-semibold text-brand-700">
                    Semua
                  </Link>
                }
              >
                {penjualan.slice(0, 4).map((j) => (
                  <BarisLink
                    key={j.id}
                    to={`/transaksi/${j.id}`}
                    kanan={
                      <div className="text-right">
                        <p className="font-semibold text-slate-900 tabular-nums">{rp(omzet(j))}</p>
                        <p className="text-xs text-slate-500">{pcs(j)} pcs</p>
                      </div>
                    }
                  >
                    <p className="truncate font-medium text-slate-900">{j.baris.map((b) => b.nama).join(', ')}</p>
                    <p className="text-sm text-slate-500">
                      {namaSaluran(saluran, j.saluranId)} · {j.tanggal === hariIni ? j.jam : tglPendek(j.tanggal)}
                    </p>
                  </BarisLink>
                ))}
              </Daftar>
            )}
          </div>

          {mode === 'normal' && (
            <div className="flex flex-col gap-4">
              {hargaBermasalah.length > 0 && (
                <Daftar judul="Harga di bawah target untung">
                  {hargaBermasalah.map((x) => (
                    <BarisLink key={x.produk.id + x.saluran.id} to={`/harga?produk=${x.produk.id}&saluran=${x.saluran.id}`} kanan={<Lencana nada="peringatan">{x.saluran.nama}</Lencana>}>
                      <p className="line-clamp-2 font-medium text-slate-900">{x.produk.nama}</p>
                      <p className="text-sm text-slate-500 tabular-nums">Harga {rp(x.harga)} · modal naik</p>
                    </BarisLink>
                  ))}
                </Daftar>
              )}
              <Daftar
                judul="Stok menipis"
                aksi={
                  <Link to="/laporan?tab=stok" className="text-sm font-semibold text-brand-700">
                    Laporan stok
                  </Link>
                }
              >
                {menipis.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-slate-500">Semua stok aman.</p>
                ) : (
                  menipis.map((p) => (
                    <BarisLink key={p.id} to={`/produk/${p.id}`} kanan={<StokLencana stok={p.stok} batas={p.batas} />}>
                      <div className="flex items-center gap-3">
                        <Thumb nama={p.nama} kecil />
                        <p className="line-clamp-2 min-w-0 font-medium text-slate-900">{p.nama}</p>
                      </div>
                    </BarisLink>
                  ))
                )}
              </Daftar>
            </div>
          )}
        </div>
      )}
    </>
  )
}
