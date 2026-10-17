import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  action?: ReactNode
}

export default function Card({ title, action, className = '', children, ...rest }: CardProps) {
  return (
    <section className={`rounded-2xl border border-brand-100 bg-white p-4 shadow-sm ${className}`} {...rest}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
