// Klien API: fetch same-origin dengan cookie sesi, JSON, dan penanganan 401 terpusat.

export class ApiError extends Error {
  status: number
  /** Hanya untuk 429: detik sampai boleh mencoba lagi. */
  retryAfter?: number
  /** Body JSON error apa adanya (mis. `stok_kurang[]` pada 409 penjualan). */
  data?: unknown
  constructor(status: number, message: string, retryAfter?: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
    this.data = data
  }
}

const PESAN_JARINGAN = 'Tidak bisa terhubung ke server. Periksa sambungan internet, lalu coba lagi.'

let saatTidakLogin: () => void = () => {}
/** Dipasang AuthProvider: dipanggil saat API menjawab 401 di luar layar Masuk. */
export function setTidakLoginHandler(fn: () => void) {
  saatTidakLogin = fn
}

export interface OpsiRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** true = 401 bukan "sesi habis" (mis. login gagal), jangan arahkan ke layar Masuk. */
  tanpaRedirect401?: boolean
}

export async function api<T = void>(path: string, opsi: OpsiRequest = {}): Promise<T> {
  const { method = 'GET', body, signal, tanpaRedirect401 } = opsi
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError(0, PESAN_JARINGAN)
  }
  if (res.status === 204) return undefined as T
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // body kosong / bukan JSON
  }
  if (!res.ok) {
    if (res.status === 401 && !tanpaRedirect401) saatTidakLogin()
    const d = (data ?? {}) as { error?: string; retry_after_detik?: number }
    throw new ApiError(res.status, d.error || `Permintaan gagal (${res.status}).`, d.retry_after_detik, data)
  }
  return data as T
}

export const pesanError = (e: unknown): string => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Terjadi kesalahan.')

/** Parameter query: nilai undefined/kosong dilewati. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, v === true ? '1' : String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}
