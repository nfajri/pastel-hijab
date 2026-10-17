import { useEffect, useState } from 'react'
import { api, pesanError } from '../../lib/api'
import type { Pembulatan } from '../../lib/api-types'
import type { CaraTarget, KalkulatorHasil, KalkulatorInput } from '../../lib/api-tahap2'

export const CARA: { key: CaraTarget; label: string; satuan: '%' | 'Rp'; awal: number }[] = [
  { key: 'persen_jual', label: '% jual', satuan: '%', awal: 30 },
  { key: 'persen_modal', label: '% modal', satuan: '%', awal: 40 },
  { key: 'rupiah', label: 'Rupiah', satuan: 'Rp', awal: 10000 },
]

export interface HasilKalk {
  hasil: KalkulatorHasil | null
  galat: string
  memeriksa: boolean
}

/** Semua kartu saluran sekaligus lewat POST /api/kalkulator; ditunda 250 ms. `ulang` mengubah kunci agar dihitung lagi. */
export function useKalkulator(body: KalkulatorInput | null, ulang: number): HasilKalk {
  const [s, setS] = useState<HasilKalk>({ hasil: null, galat: '', memeriksa: false })
  const kunci = body ? JSON.stringify(body) : ''
  useEffect(() => {
    if (!kunci) {
      setS({ hasil: null, galat: '', memeriksa: false })
      return
    }
    setS((x) => ({ ...x, memeriksa: true }))
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      api<KalkulatorHasil>('/kalkulator', { method: 'POST', body: JSON.parse(kunci), signal: ac.signal })
        .then((hasil) => setS({ hasil, galat: '', memeriksa: false }))
        .catch((e) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setS({ hasil: null, galat: pesanError(e), memeriksa: false })
        })
    }, 250)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [kunci, ulang])
  return s
}

export const teksTarget = (cara: CaraTarget, nilai: number, rp: (n: number) => string) =>
  cara === 'rupiah' ? `untung ${rp(nilai)}/pcs` : `untung ${String(nilai).replace('.', ',')}% dari ${cara === 'persen_jual' ? 'harga jual' : 'modal'}`

export const teksBulatPendek = (b: Pembulatan, label: string) => (b === 'tanpa' ? 'tanpa pembulatan' : b === 'cantik' ? 'harga cantik' : `bulat ${label}`)
