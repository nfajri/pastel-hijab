import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import logoLengkap from '../assets/brand/logo-lengkap.png'
import { Button, Input } from '../components/ui'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function Masuk() {
  const { status, masuk } = useAuth()
  const nav = useNavigate()
  const lokasi = useLocation()
  const dari = (lokasi.state as { dari?: string } | null)?.dari || '/'
  const [username, setUsername] = useState('')
  const [sandi, setSandi] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)

  if (status.tipe === 'masuk') return <Navigate to={dari} replace />

  const kirim = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !sandi) {
      setGalat('Isi nama pengguna dan kata sandi.')
      return
    }
    setSibuk(true)
    setGalat('')
    try {
      await masuk(username.trim(), sandi)
      nav(dari, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setGalat('Nama pengguna atau kata sandi salah. Coba lagi.')
      else if (err instanceof ApiError && err.status === 429) {
        const menit = err.retryAfter ? Math.ceil(err.retryAfter / 60) : null
        setGalat(`Terlalu banyak percobaan masuk yang gagal.${menit ? ` Coba lagi sekitar ${menit} menit lagi.` : ' Coba lagi nanti.'}`)
      } else setGalat(err instanceof Error ? err.message : 'Tidak bisa masuk sekarang.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-krem px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1>
            <img src={logoLengkap} alt="Pastel Hijab" className="mx-auto w-36" />
          </h1>
          <p className="mt-3 text-sm text-stone-500">Masuk untuk melanjutkan</p>
        </div>
        <form className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm" onSubmit={kirim} noValidate>
          <Input
            label="Nama pengguna"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setGalat('')
            }}
          />
          <Input
            label="Kata sandi"
            type="password"
            autoComplete="current-password"
            value={sandi}
            onChange={(e) => {
              setSandi(e.target.value)
              setGalat('')
            }}
            error={galat || undefined}
          />
          <Button type="submit" block className="min-h-12" disabled={sibuk}>
            {sibuk ? 'Masuk…' : 'Masuk'}
          </Button>
          <p className="text-center text-sm text-stone-500">Lupa kata sandi? Hubungi pengelola aplikasi untuk mengatur ulang.</p>
        </form>
        <p className="mt-6 text-center text-xs text-stone-500">Tetap masuk di perangkat ini sampai Ibu memilih Keluar.</p>
      </div>
    </div>
  )
}
