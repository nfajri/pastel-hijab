import { useCallback, useRef, useState } from 'react'
import { pesanError } from './api'

/** Menjalankan aksi ubah-data: mencegah klik ganda, menyimpan pesan error server untuk ditampilkan di form. */
export function useKirim() {
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState('')
  const jalan = useRef(false)

  const kirim = useCallback(async <T,>(fn: () => Promise<T>): Promise<{ ok: true; hasil: T } | { ok: false }> => {
    if (jalan.current) return { ok: false }
    jalan.current = true
    setSibuk(true)
    setGalat('')
    try {
      return { ok: true, hasil: await fn() }
    } catch (e) {
      setGalat(pesanError(e))
      return { ok: false }
    } finally {
      jalan.current = false
      setSibuk(false)
    }
  }, [])

  return { sibuk, galat, setGalat, kirim }
}
