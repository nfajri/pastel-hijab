import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { Button, Card, Input, RupiahInput, Sheet, Tabs, formatRupiah } from '../components/ui'

const CARA = [
  { key: 'persenJual', label: '% jual' },
  { key: 'persenModal', label: '% modal' },
  { key: 'rupiah', label: 'Rupiah' },
] as const

/** Galeri komponen dasar (tidak ada di menu; buka lewat #/komponen). */
export default function Komponen() {
  const [harga, setHarga] = useState<number | null>(125000)
  const [cara, setCara] = useState<(typeof CARA)[number]['key']>('persenJual')
  const [open, setOpen] = useState(false)

  return (
    <>
      <PageHeader title="Galeri komponen" subtitle="Komponen dasar di src/components/ui." />
      <div className="flex flex-col gap-4">
        <Card title="Button">
          <div className="flex flex-wrap gap-2">
            <Button>Simpan</Button>
            <Button variant="secondary">Batal</Button>
            <Button variant="danger">Hapus</Button>
            <Button variant="ghost">Lainnya</Button>
            <Button disabled>Nonaktif</Button>
          </div>
        </Card>
        <Card title="Input">
          <div className="flex flex-col gap-3">
            <Input label="Nama produk" placeholder="mis. Pashmina Ceruty" />
            <Input label="Jumlah" type="number" inputMode="numeric" error="Stok tidak cukup" defaultValue={3} />
            <RupiahInput label="Harga jual" value={harga} onValueChange={setHarga} hint={harga == null ? 'Belum diisi' : formatRupiah(harga)} />
          </div>
        </Card>
        <Card title="Tabs">
          <Tabs items={[...CARA]} value={cara} onChange={setCara} />
        </Card>
        <Card title="Sheet / modal">
          <Button onClick={() => setOpen(true)}>Buka sheet</Button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Contoh sheet">
            <p className="mb-4 text-sm text-slate-600">Bottom sheet di HP, modal di laptop. Tutup dengan × , klik latar, atau Esc.</p>
            <Button block onClick={() => setOpen(false)}>Selesai</Button>
          </Sheet>
        </Card>
      </div>
    </>
  )
}
