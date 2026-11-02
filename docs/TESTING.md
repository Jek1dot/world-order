# Hasil pengujian v0.5.0-alpha.1 (riwayat v0.4 di bawah)

**Penting:** tidak ada browser sungguhan di lingkungan pengembangan. Pengujian UI memakai **jsdom** (DOM tiruan) dengan data dunia asli. Tampilan visual (warna, ukuran, kelancaran drag/zoom) **belum diuji di Chrome/Firefox**; kinerja rendering SVG di browser belum diukur.

Jalankan semua: `npm install && npm test`.

| Berkas | Isi | Hasil |
|---|---|---|
| `tests/scenario.js` | Skenario Indonesia vs Timor-Leste lewat API: bangun pabrik militer → produksi → rekrut → gerak (jalur laut domestik) → izin militer → perang → tempur → pendudukan → kapitulasi → damai → save/load deterministik. Invarian dicek tiap hari. | 53/53 lolos |
| `tests/rules.js` | Relokasi ibu kota, akses militer, NAP, aliansi, supply terputus, kapitulasi tidak instan, AI memindah ibu kota, tawaran damai AI, stok tak negatif, tempur bergantung statistik & terrain, aneksasi & game over | 42/42 lolos |
| `tests/test_ui.js` | Boot peta (4.578 provinsi), pause, kecepatan, 6 mode peta, klik/hover provinsi, tombol bangun/produksi/rekrut, seleksi & perintah, jalur & penanda di peta, diplomasi, perang, pola pendudukan, kapitulasi via loop UI, damai, simpan/muat, save lama/rusak/skema lain, escape HTML, semua tab | 55/55 lolos |
| `tests/long_sim.js` | Simulasi dunia penuh, semua AI | lihat bawah |

## Checkpoint 1 (v0.5α) — ringkasan
`npm test` = validasi database nyata (0 error, 8 peringatan jujur) + **292 pengecekan** lolos:
| Berkas | Isi | Hasil |
|---|---|---|
| `tests/db/validator.test.js` | 38 fixture yang sengaja merusak data (masa jabatan null padahal berakhir, tumpang tindih, prototipe dianggap operasional, tanggal model disalin ke varian, pesanan dianggap inventaris, alternate history diklaim fakta, ID/sumber hilang, siklus fokus, dll.) | 38/38 |
| `tests/db/db_queries.test.js` | Pemimpin menurut tanggal (1991, hari pengunduran diri Suharto 1998-05-21, vacancy, dua periode Jusuf Kalla, 2026), alutsista menurut tahun, negara tanpa data = `null` | 22/22 |
| `tests/db/gameplay_db.test.js` | Fokus (prasyarat, eksklusif, any_of, syarat perang, efek nyata, modifier ke ekonomi), event bertanggal pada jam game 1998, event historis tidak menyala di campaign 2026, migrasi save 4→5 | 36/36 |
| `tests/scenario.js` · `tests/rules.js` | Skenario Indonesia–Timor-Leste & aturan (termasuk regresi crash pertempuran ganda) | 53/53 · 45/45 |
| `tests/test_ui.js` · `tests/test_ui_v05.js` | UI di jsdom: layout baru, navigasi, fokus, database & slider, koran, notifikasi, logistik/dagang | 55/55 · 43/43 |

Simulasi: 7 seed × 600 hari (AI agresif + fokus + event) dan 5 tahun damai: **0 pelanggaran invarian**, 3–8 ms/hari.
**Batasan jujur**: UI diuji di jsdom, bukan browser sungguhan; 0 record `verified`; tanpa uji perangkat sentuh; kinerja render SVG 4.578 provinsi di browser belum diukur.


## Simulasi panjang (v0.4)
- **Mode bawaan (AI agresif mati), 730 hari:** 0 perang, 0 pelanggaran invarian, rata-rata 2,9 ms/hari (terburuk 45 ms). Ekonomi AI berkembang: pabrik sipil 1.484 → 2.032, militer 599 → 967, 250 lini produksi, divisi 734 → 839.
- **AI agresif, 365 hari:** 0 pelanggaran invarian (NaN, manpower/stok negatif, ID divisi ganda, referensi provinsi/negara tidak valid), rata-rata 8,6 ms/hari (terburuk 57 ms). Terjadi perang, kapitulasi, damai, aneksasi (19 negara hilang), dan 14 pemindahan ibu kota oleh AI.
- Profil: sebelum optimasi 56 ms/hari (`Eco.tickCountry` memindai semua divisi per negara); setelah indeks divisi per negara 8,6 ms/hari dengan hasil identik.

## Kualitas data
- 41 perbatasan darat nyata yang diuji (Prancis–Spanyol, AS–Meksiko, Indonesia–Malaysia, dst.) semuanya terdeteksi; tidak ada koneksi darat lewat laut (mis. Bali–Jawa bukan tetangga darat).
- `tools/build_data.sh` membangun ulang seluruh `data/` dan menghasilkan berkas identik byte-per-byte.

## Bug yang ditemukan & diperbaiki saat pengujian
1. Urutan inisialisasi state (`rt` belum ada saat membuat divisi awal).
2. `flags.scenario = 0` dianggap "salah" sehingga tab Misi tidak muncul.
3. Pilihan ibu kota Natural Earth: Afrika Selatan/Myanmar/Tanzania/Pantai Gading salah kota; Sudan Selatan memakai kode berbeda (`SSD` vs `SDS`).
4. Statistik sintetis konyol (Antartika 431 juta jiwa) → tabel perkiraan + override.
5. Rute laut memutar karena biaya laut terlalu murah → biaya ×1,3 dan kecepatan laut diturunkan.
6. Performa tick (lihat atas).

## Belum diuji
Browser sungguhan, perangkat sentuh, kinerja render SVG 4.578 provinsi di perangkat lemah, keseimbangan jangka panjang (>2 tahun) permainan manusia.
