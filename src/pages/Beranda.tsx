import PageHeader from '../components/PageHeader'
import { Card } from '../components/ui'

export default function Beranda() {
  return (
    <>
      <PageHeader title="Beranda" subtitle="Ringkasan hari ini dan pintasan catat penjualan." />
      <Card>
        <p className="text-sm text-stone-500">Placeholder — isi halaman Beranda dibuat setelah desain disetujui.</p>
      </Card>
    </>
  )
}
