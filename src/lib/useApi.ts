import { useCallback, useEffect, useState } from 'react'
import { api, pesanError } from './api'

export interface HasilApi<T> {
  data: T | null
  /** true selama pemuatan pertama (belum ada data untuk path ini). */
  memuat: boolean
  gagal: string | null
  muat: () => void
  setData: (d: T) => void
}

interface Isi<T> {
  path: string
  data: T | null
  gagal: string | null
}

/**
 * GET otomatis saat path berubah; path null = tunda.
 * `pertahankan`: saat path berubah (mis. kata cari) data lama tetap tampil sampai yang baru datang;
 * tanpa itu (detail /produk/1 → /produk/2) data dikosongkan supaya tidak menampilkan data produk lain.
 */
export function useApi<T>(path: string | null, opsi: { pertahankan?: boolean } = {}): HasilApi<T> {
  const [isi, setIsi] = useState<Isi<T>>({ path: path ?? '', data: null, gagal: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (path === null) return
    const ac = new AbortController()
    api<T>(path, { signal: ac.signal })
      .then((d) => setIsi({ path, data: d, gagal: null }))
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setIsi((s) => ({ path, data: s.path === path || opsi.pertahankan ? s.data : null, gagal: pesanError(e) }))
      })
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick])

  const muat = useCallback(() => {
    setIsi((s) => ({ ...s, gagal: null }))
    setTick((t) => t + 1)
  }, [])
  const setData = useCallback((d: T) => setIsi({ path: path ?? '', data: d, gagal: null }), [path])

  const berlaku = path !== null && (isi.path === path || opsi.pertahankan)
  const data = berlaku ? isi.data : null
  const gagal = berlaku && data === null && isi.path === path ? isi.gagal : null
  return { data, memuat: path !== null && data === null && gagal === null, gagal, muat, setData }
}
