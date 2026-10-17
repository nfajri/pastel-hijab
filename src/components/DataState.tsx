import type { ReactNode } from 'react'
import { Gagal, Kerangka } from './ui'
import type { HasilApi } from '../lib/useApi'

/** Memuat → Kerangka, gagal → "Data belum bisa dimuat" + Coba lagi, selain itu isi. */
export default function DataState<T>({ hasil, baris = 5, children }: { hasil: HasilApi<T>; baris?: number; children: (data: T) => ReactNode }) {
  if (hasil.gagal !== null) return <Gagal onUlang={hasil.muat} pesan={hasil.gagal} />
  if (hasil.data === null) return <Kerangka baris={baris} />
  return <>{children(hasil.data)}</>
}
