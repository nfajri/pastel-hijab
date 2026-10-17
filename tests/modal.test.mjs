// Jalankan: npm test (modal.ts di-compile dulu oleh tsc, lalu node --test). Kasus dari spesifikasi §7 dan server/internal/hitung.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { modalKulakan, modalRataRata, perPcs } from '../.test-build/modal.js'

test('§7.3 kulakan 10 pcs Rp20.000 + plastik 1.000/pcs + ongkir 30.000/kulakan + fee 2% = Rp24.400', () => {
  const k = [
    { jenis: 'per_pcs', nilai: 1000 },
    { jenis: 'per_kulakan', nilai: 30000 },
    { jenis: 'persen_harga_beli', nilai: 2 },
  ]
  assert.equal(modalKulakan(20000, 10, k), 24400)
})

test('§7.4 stok 10 modal 20.000 + kulakan 10 modal 30.000 = 25.000', () => {
  assert.equal(modalRataRata(10, 20000, 10, 30000), 25000)
})

test('stok 0 → modal = modal kulakan baru; qty 0 → modal lama', () => {
  assert.equal(modalRataRata(0, 12345, 5, 20000), 20000)
  assert.equal(modalRataRata(5, 20000, 0, 99999), 20000)
})

test('contoh API.md: 3 pcs, ongkir 10.000/kulakan → +3333,33; modal 23.333,33', () => {
  assert.equal(perPcs({ jenis: 'per_kulakan', nilai: 10000 }, 20000, 3), 3333.33)
  assert.equal(modalKulakan(20000, 3, [{ jenis: 'per_kulakan', nilai: 10000 }]), 23333.33)
})

test('persen desimal dan pembulatan 2 desimal', () => {
  assert.equal(perPcs({ jenis: 'persen_harga_beli', nilai: 2.5 }, 21000, 4), 525)
  assert.equal(modalKulakan(10000, 3, [{ jenis: 'per_kulakan', nilai: 1000 }]), 10333.33)
  assert.equal(modalRataRata(3, 10333.33, 2, 11000), 10600)
})
