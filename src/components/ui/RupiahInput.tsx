import { useId, type InputHTMLAttributes } from 'react'
import { Field, inputClass } from './Input'

export interface RupiahInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Nilai dalam rupiah bulat; null = kosong. */
  value: number | null
  onValueChange: (value: number | null) => void
  label?: string
  hint?: string
  error?: string
}

const fmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** Format angka jadi "Rp 1.250.000". */
export function formatRupiah(n: number): string {
  return `Rp ${fmt.format(n)}`
}

/** Input angka Rupiah: keyboard numerik di HP, tampil dengan pemisah ribuan, hanya bilangan bulat >= 0. */
export default function RupiahInput({ value, onValueChange, label, hint, error, className = '', id, ...rest }: RupiahInputProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Field id={fid} label={label} hint={hint} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-500">Rp</span>
        <input
          id={fid}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          className={`${inputClass} pl-10 text-right tabular-nums ${error ? 'border-red-500' : ''} ${className}`}
          aria-invalid={!!error}
          value={value == null ? '' : fmt.format(value)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
            onValueChange(digits === '' ? null : Number(digits))
          }}
          {...rest}
        />
      </div>
    </Field>
  )
}
