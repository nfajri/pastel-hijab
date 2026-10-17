import { useId, type InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

// font-size 16px agar iOS Safari tidak zoom otomatis saat fokus.
export const inputClass =
  'min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-ink placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

export function Field({ id, label, hint, error, children }: { id: string; label?: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-stone-700">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-sm text-red-600">{error}</p> : hint ? <p className="text-sm text-stone-500">{hint}</p> : null}
    </div>
  )
}

export default function Input({ label, hint, error, className = '', id, ...rest }: InputProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Field id={fid} label={label} hint={hint} error={error}>
      <input id={fid} className={`${inputClass} ${error ? 'border-red-500' : ''} ${className}`} aria-invalid={!!error} {...rest} />
    </Field>
  )
}
