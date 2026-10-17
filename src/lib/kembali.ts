import type { NavigateFunction } from 'react-router-dom'

/** Kembali ke layar sebelumnya; bila halaman ini dibuka langsung (tanpa riwayat), ke `cadangan`. */
export function kembaliAtau(nav: NavigateFunction, cadangan: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) nav(-1)
  else nav(cadangan, { replace: true })
}
