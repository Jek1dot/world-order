# Format & aturan database sejarah (v1)

Lokasi: `data/db/`. Skema: `schemas/world-order-db.schema.json` (JSON Schema draft-07, divalidasi dengan ajv). Aturan semantik: `scripts/validate/validate.js`. Jalankan `npm run db:validate`.

## Struktur
```
data/db/
  manifest.json          daftar berkas per kategori (kind, path, key, ukuran, hash, jumlah) → dasar lazy loading
  vocab.json             kosakata efek & kondisi yang dikenali engine (dipakai validator DAN game)
  sources/sources.json   registri sumber (id, URL, tanggal akses, lisensi, jenis, keandalan)
  countries/<shard>.json negara per shard (southeast-asia, unprocessed, …)
  leaders/<ISO3>.json    tokoh + masa jabatan + vacancy per negara  → dimuat HANYA saat dibutuhkan
  equipment/<shard>.json produsen + model + varian + operator + pengadaan
  inventories/*.json     jumlah unit terverifikasi per tahun (terpisah dari pesanan)
  events/<shard>.json    event historis / generik / alternate-history
  focus/<tree>.json      pohon fokus nasional
scripts/import/          pembuat data (data sebagai kode, bisa diaudit & diulang)
scripts/validate/        validator       scripts/build/ manifest + laporan cakupan
```
Database **tidak pernah** disalin ke save; save hanya menyimpan versi database (`dbVersion`) dan ID stabil. Menambah/mengubah data tidak merusak save selama ID lama tidak dihapus.

## Aturan inti
- **ID stabil**: negara = kode Natural Earth `adm0_a3` (sama dengan ID permainan); tokoh `person.<slug>`; masa jabatan `ten.<NEGARA>.<jabatan>.<tanggal>`; model `eq.<kategori>.<slug>`; varian `<model>.<varian>`; event `ev.<…>`; fokus `foc.<…>`; sumber `S-<…>`.
- **Tanggal**: ISO `YYYY-MM-DD`. Tanggal tidak lengkap memakai `precision: month|year` (game memakai hari pertama). Akhir masa jabatan **tidak boleh `null`** bila sudah berakhir; `null` hanya untuk yang masih berjalan dan wajib disertai `ongoing_as_of`.
- **Nilai tidak diketahui = `null`** dan alasannya ditulis di `unknown_fields`. Tidak ada angka/nama karangan.
- **Status wajib di setiap record** (`verification.status`): `verified`, `partially_verified`, `disputed`, `unknown`, `fictional_gameplay`; plus `confidence` (high/medium/low), `sources`, `checked` (tanggal cek).
  - `verified` ⇒ ≥ 2 sumber, atau 1 sumber `primary`/`dataset`.
  - `partially_verified` ⇒ ≥ 1 sumber yang benar-benar dibaca (mis. satu sumber tersier).
  - `unknown` ⇒ wajib `reason_unknown`. `fictional_gameplay` ⇒ konten permainan buatan sendiri.
- **Fakta ≠ gameplay**: nilai balancing (skill jenderal, statistik divisi, efek event) tidak disimpan sebagai fakta. Event `generic_gameplay` dan `alternate_history` **harus** `fictional_gameplay`; event `historical` wajib bertanggal dan berisi ringkasan faktual.
- **Pemimpin**: satu tokoh boleh banyak masa jabatan (mis. Jusuf Kalla 2004–09 dan 2014–19). Peran dipisah (`head_of_state`, `head_of_government`, `deputy_head_of_state`, …); satu tenure boleh memegang beberapa peran (presiden Indonesia = kepala negara & pemerintahan). Kekosongan jabatan dicatat sebagai `vacancy`, bukan dibiarkan celah.
- **Alutsista**: tahun masuk dinas varian **tidak boleh disalin** dari model dasar (`service_entry_basis` harus `variant_specific` dan bersumber, bila tidak maka `null`). Prototipe/demonstrator/dibatalkan tidak boleh punya operator atau inventaris. **Pesanan, tawaran, dan pembelian ≠ kepemilikan**: dicatat di `procurement` dengan status pengiriman; operator & inventaris butuh bukti terpisah. Tawaran ekspor tidak boleh `delivered`.

## Kode aturan validator
| Kode | Arti |
|---|---|
| DB-SCHEMA | Melanggar skema (properti tak dikenal, tipe salah, field wajib hilang) |
| DB-E001 | ID ganda | DB-E002 | Referensi tidak ada (sumber, produsen, model, varian) |
| DB-E003 | Negara tidak ada | DB-E004 | Tokoh tidak ada |
| DB-E005 | Akhir sebelum awal | DB-E006 | Tumpang tindih masa jabatan satu peran |
| DB-E007 | `end=null` tanpa `ongoing_as_of` | DB-E008 | `end=null` padahal ada penerus |
| DB-E009 | `verified` tanpa bukti cukup | DB-E010 | Status berklaim tanpa sumber |
| DB-E011 | `unknown` tanpa alasan | DB-E013 | Klaim terverifikasi tanpa tanggal cek |
| DB-E020 | Tahun varian disalin dari model dasar / tanpa sumber |
| DB-E022 | Prototipe/demonstrator dianggap operasional (operator/inventaris) |
| DB-E023 | Operator/varian sebelum model masuk dinas | DB-E024 | Pensiun/dinas tidak konsisten |
| DB-E025 | Inventaris tidak sah (sebelum dinas, bukan operator) | DB-E026 | Tawaran ekspor berstatus delivered |
| DB-E030 | Menjabat sebelum lahir / setelah wafat | DB-E032 | Menjabat sebelum negara ada |
| DB-E040 | Tanggal tidak valid | DB-E041 | Efek/kondisi tidak dikenal |
| DB-E042 | Event: klasifikasi vs status, historis tanpa tanggal/fakta, `historical_outcome` salah |
| DB-E050/51/52 | Fokus: prasyarat hilang / eksklusif tak simetris / siklus |
| DB-W001 | (peringatan) celah masa jabatan tanpa vacancy | DB-W002 | (peringatan) tahun masuk dinas belum diketahui |

38 fixture di `tests/db/validator.test.js` sengaja merusak data untuk membuktikan tiap aturan menangkap kesalahan.

## Alur menambah negara
1. Baca sumber (resmi bila ada); catat ke `sources.json` (URL asli, tanggal akses, lisensi, jenis, keandalan).
2. Tulis data di `scripts/import/` (bukan edit manual JSON), isi hanya yang ditemukan; sisanya `null` + alasan.
3. `npm run db:build` (seed → manifest → cakupan) lalu `npm run db:validate` harus 0 error.
4. Tambah kueri/tes bila ada aturan baru.

## Muat lazy & performa
Hanya `manifest`, `vocab`, `sources` (± 5 KB) dimuat saat boot, plus negara (330 KB), alutsista, event, pohon fokus (kecil). Berkas pemimpin dimuat per negara saat panel dibuka (`DB.loadLeaders(iso)`), di-cache. Kueri berbasis tanggal memakai daftar terurut per peran.

## Yang BELUM ada
Batas wilayah historis (1991/2001), pemerintahan selain presiden/wakil Indonesia, menteri/panglima/jenderal, inventaris bertahun, pohon fokus unik, event historis terverifikasi di luar Indonesia, teknologi/riset.
