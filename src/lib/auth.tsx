import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, ApiError, setTidakLoginHandler } from './api'
import type { Sesi } from './api-types'
import { Kerangka } from '../components/ui'

type Status = { tipe: 'memuat' } | { tipe: 'keluar' } | { tipe: 'gagal'; pesan: string } | { tipe: 'masuk'; sesi: Sesi }

interface AuthValue {
  status: Status
  username: string
  masuk: (username: string, password: string) => Promise<void>
  keluar: () => Promise<void>
  cek: () => void
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ tipe: 'memuat' })

  const cek = useCallback(() => {
    setStatus({ tipe: 'memuat' })
    api<Sesi>('/auth/saya', { tanpaRedirect401: true })
      .then((sesi) => setStatus({ tipe: 'masuk', sesi }))
      .catch((e) => setStatus(e instanceof ApiError && e.status === 401 ? { tipe: 'keluar' } : { tipe: 'gagal', pesan: e instanceof Error ? e.message : 'Gagal memeriksa sesi.' }))
  }, [])

  useEffect(() => {
    setTidakLoginHandler(() => setStatus({ tipe: 'keluar' }))
    cek()
  }, [cek])

  const masuk = useCallback(async (username: string, password: string) => {
    await api('/auth/login', { method: 'POST', body: { username, password }, tanpaRedirect401: true })
    const sesi = await api<Sesi>('/auth/saya', { tanpaRedirect401: true })
    setStatus({ tipe: 'masuk', sesi })
  }, [])

  const keluar = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {}, tanpaRedirect401: true })
    } finally {
      setStatus({ tipe: 'keluar' })
    }
  }, [])

  const v = useMemo<AuthValue>(
    () => ({ status, username: status.tipe === 'masuk' ? status.sesi.username : '', masuk, keluar, cek }),
    [status, masuk, keluar, cek],
  )
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider belum dipasang')
  return v
}

/** Bungkus rute yang butuh login: belum login → layar Masuk (ingat tujuan semula). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, cek } = useAuth()
  const lokasi = useLocation()
  if (status.tipe === 'memuat')
    return (
      <div className="mx-auto max-w-md p-6">
        <Kerangka baris={3} />
      </div>
    )
  if (status.tipe === 'gagal')
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
        <p className="font-semibold text-ink">Belum bisa memeriksa sesi</p>
        <p className="text-sm text-stone-500">{status.pesan}</p>
        <button type="button" onClick={cek} className="min-h-11 rounded-xl border border-brand-500 px-4 font-semibold text-brand-700">
          Coba lagi
        </button>
      </div>
    )
  if (status.tipe === 'keluar') return <Navigate to="/masuk-akun" replace state={{ dari: lokasi.pathname + lokasi.search }} />
  return <>{children}</>
}
