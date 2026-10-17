export default function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
    </header>
  )
}
