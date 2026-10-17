import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ToastData {
  id: number
  teks: string
  aksi?: { label: string; to: string }
}

interface ToastValue {
  toast: ToastData | null
  tampilkan: (teks: string, aksi?: ToastData['aksi']) => void
  tutupToast: () => void
}

const Ctx = createContext<ToastValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const tampilkan = useCallback((teks: string, aksi?: ToastData['aksi']) => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), teks, aksi })
    timer.current = window.setTimeout(() => setToast(null), 4000)
  }, [])
  const tutupToast = useCallback(() => setToast(null), [])
  const v = useMemo(() => ({ toast, tampilkan, tutupToast }), [toast, tampilkan, tutupToast])
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}

export function useToast(): ToastValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('ToastProvider belum dipasang')
  return v
}
