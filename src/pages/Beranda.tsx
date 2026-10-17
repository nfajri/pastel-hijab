import { Link } from 'react-router-dom'
import logoTanda from '../assets/brand/logo-tanda.png'
import DataState from '../components/DataState'
import { BarisLink, Daftar, IK, Ikon, Kosong, Lencana, StokLencana, Thumb } from '../components/ui'
import type { Saluran } from '../lib/api-types'
import type { Laporan, Penjualan, ProdukT2 } from '../lib/api-tahap2'
import { hariIniWIB, rp } from '../lib/format'
import { jamWIB, tglHari, tglPanjang } from '../lib/tgl'
import { useApi } from '../lib/useApi'

function Hari({ hari }: { hari: string }) {
  const hasil = useApi<Laporan>(`/laporan?dari=${hari}&sampai=${hari}`)
  return (
    <DataState hasil={hasil} baris={1}>
      {({ ringkasan: r }) => (
        <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm md:p-5">
          <p className="text-sm font-medium text-stone-500">Penjualan hari ini</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink tabular-nums" data-testid="omzet-hari">
            {rp(r.omzet)}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3">
            <div>
              <p className="text-xs text-stone-500">Untung kotor</p>
              <p className={`font-semibold tabular-nums ${r.laba_kotor < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{rp(r.laba_kotor)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Pesanan</p>
              <p className="font-semibold text-ink tabular-nums">{r.pesanan}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Terjual</p>
              <p className="font-semibold text-ink tabular-nums">{r.pcs} pcs</p>
            </div>
          </div>
        </section>
      )}
    </DataState>
  )
}

function Terakhir({ hari }: { hari: string }) {
  const hasil = useApi<Penjualan[]>('/penjualan?limit=4')
  return (
    <DataState hasil={hasil} baris={3}>
      {(js) => (
        <Daftar
          judul="Penjualan terakhir"
          aksi={
            <Link to="/transaksi" className="text-sm font-semibold text-brand-700">
              Semua
            </Link>
          }
        >
          {js.length === 0 && <p className="px-4 py-4 text-sm text-stone-500">Belum ada penjualan. Ketuk “Catat penjualan” untuk memulai.</p>}
          {js.map((j) => (
            <BarisLink
              key={j.id}
              to={`/transaksi/${j.id}`}
              kanan={
                <div className="text-right">
                  <p className="font-semibold text-ink tabular-nums">{rp(j.subtotal)}</p>
                  <p className="text-xs text-stone-500">{j.qty} pcs</p>
                </div>
              }
            >
              <p className="truncate font-medium text-ink">{j.baris.map((b) => b.produk_nama).join(', ')}</p>
              <p className="text-sm text-stone-500">
                {j.saluran_nama} · {j.tanggal === hari ? jamWIB(j.created_at) : tglHari(j.tanggal)}
              </p>
            </BarisLink>
          ))}
        </Daftar>
      )}
    </DataState>
  )
}

function DiBawahTarget() {
  const hasil = useApi<ProdukT2[]>('/produk?aktif=1&di_bawah_target=1')
  const saluran = useApi<Saluran[]>('/saluran')
  const baris = (hasil.data ?? []).flatMap((p) => p.harga.filter((h) => h.di_bawah_target).map((h) => ({ p, h })))
  if (baris.length === 0) return null
  return (
    <Daftar judul="Harga di bawah target untung">
      {baris.map(({ p, h }) => (
        <BarisLink
          key={`${p.id}-${h.saluran_id}`}
          to={`/harga?produk=${p.id}&saluran=${h.saluran_id}`}
          kanan={<Lencana nada="peringatan">{saluran.data?.find((s) => s.id === h.saluran_id)?.nama ?? 'Saluran'}</Lencana>}
        >
          <p className="line-clamp-2 font-medium text-ink">{p.nama}</p>
          <p className="text-sm text-stone-500 tabular-nums">
            Harga {rp(h.harga)} · untung {rp(h.untung)}/pcs
          </p>
        </BarisLink>
      ))}
    </Daftar>
  )
}

export default function Beranda() {
  const hari = hariIniWIB()
  const produk = useApi<ProdukT2[]>('/produk?aktif=1')
  const menipis = (produk.data ?? []).filter((p) => p.menipis).sort((a, b) => a.stok - b.stok)

  return (
    <>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logoTanda} alt="Pastel Hijab" className="h-11 w-11 shrink-0 md:hidden" />
          <div className="min-w-0">
            <p className="text-sm text-stone-500">{tglPanjang(hari)}</p>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Halo, Ibu</h1>
          </div>
        </div>
        <Link to="/pengaturan" aria-label="Pengaturan" className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-600 hover:bg-white md:hidden">
          <Ikon d={IK.pengaturan} className="h-6 w-6" />
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_380px] md:items-start">
        <div className="flex flex-col gap-4">
          <Hari hari={hari} />

          {/* Aksi utama: catat penjualan (target < 1 menit) */}
          <Link to="/jual" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-700 text-lg font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-600 md:hidden">
            <Ikon d={IK.plus} className="h-6 w-6" strokeWidth={2.2} /> Catat penjualan
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/masuk" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-stone-300">
              <Ikon d={IK.masuk} className="h-5 w-5 text-brand-700" /> Barang masuk
            </Link>
            <Link to="/pengeluaran/baru" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:border-stone-300">
              <Ikon d={IK.pengeluaran} className="h-5 w-5 text-brand-700" /> Catat pengeluaran
            </Link>
          </div>

          {produk.data && produk.data.length === 0 ? (
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
            <Terakhir hari={hari} />
          )}
        </div>

        {produk.data && produk.data.length > 0 && (
          <div className="flex flex-col gap-4">
            <DiBawahTarget />
            <Daftar
              judul="Stok menipis"
              aksi={
                <Link to="/laporan?tab=stok" className="text-sm font-semibold text-brand-700">
                  Laporan stok
                </Link>
              }
            >
              {menipis.length === 0 ? (
                <p className="px-4 py-4 text-sm text-stone-500">Semua stok aman.</p>
              ) : (
                menipis.map((p) => (
                  <BarisLink key={p.id} to={`/produk/${p.id}`} kanan={<StokLencana stok={p.stok} batas={p.batas_stok_menipis} />}>
                    <div className="flex items-center gap-3">
                      <Thumb nama={p.nama} kecil />
                      <p className="line-clamp-2 min-w-0 font-medium text-ink">{p.nama}</p>
                    </div>
                  </BarisLink>
                ))
              )}
            </Daftar>
          </div>
        )}
      </div>
      {produk.gagal !== null && <DataState hasil={produk}>{() => null}</DataState>}
    </>
  )
}
