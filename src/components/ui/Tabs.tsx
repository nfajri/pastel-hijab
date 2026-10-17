export interface TabItem<K extends string = string> {
  key: K
  label: string
}

export interface TabsProps<K extends string> {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
}

/** Tab segmented (mis. pilih cara target untung). Terkontrol. */
export default function Tabs<K extends string>({ items, value, onChange }: TabsProps<K>) {
  return (
    <div role="tablist" className="flex gap-1 rounded-xl bg-stone-100 p-1">
      {items.map((it) => {
        const active = it.key === value
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors ${active ? 'bg-white text-brand-700 shadow-sm' : 'text-stone-600'}`}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
