import { BilahAtas } from '../../components/ui'
import DataState from '../../components/DataState'
import { api } from '../../lib/api'
import type { Pembulatan, Pengaturan } from '../../lib/api-types'
import { PEMBULATAN } from '../../lib/hitung'
import { useApi } from '../../lib/useApi'
import { useKirim } from '../../lib/useKirim'

export default function PembulatanPage() {
  const hasil = useApi<Pengaturan>('/pengaturan')
  const { sibuk, galat, kirim } = useKirim()

  const pilih = async (key: Pembulatan) => {
    const r = await kirim(() => api<Pengaturan>('/pengaturan', { method: 'PATCH', body: { pembulatan_bawaan: key } }))
    if (r.ok) hasil.setData(r.hasil)
  }

  return (
    <div className="md:max-w-2xl">
      <BilahAtas judul="Pembulatan harga" kembali="/pengaturan" />
      <p className="mb-4 px-1 text-sm text-stone-500">Pilihan awal di kalkulator. Tetap bisa diganti setiap kali menghitung. Selalu dibulatkan ke atas.</p>
      <DataState hasil={hasil} baris={5}>
        {(p) => (
          <>
            <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-brand-100 bg-white" role="radiogroup" aria-label="Pembulatan bawaan">
              {PEMBULATAN.map((b) => {
                const aktif = p.pembulatan_bawaan === b.key
                return (
                  <button
                    key={b.key}
                    type="button"
                    role="radio"
                    aria-checked={aktif}
                    disabled={sibuk}
                    onClick={() => !aktif && pilih(b.key)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 disabled:opacity-60"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${aktif ? 'border-brand-700' : 'border-stone-300'}`}>{aktif && <span className="h-2.5 w-2.5 rounded-full bg-brand-700" />}</span>
                    <span className="flex-1 font-medium text-ink">{b.key === 'tanpa' ? 'Tanpa pembulatan' : b.key === 'cantik' ? 'Harga cantik (…900)' : `Ke atas kelipatan ${b.label}`}</span>
                    <span className="text-sm text-stone-500 tabular-nums">43.750 → {b.contoh}</span>
                  </button>
                )
              })}
            </div>
            {galat && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {galat}
              </p>
            )}
          </>
        )}
      </DataState>
    </div>
  )
}
