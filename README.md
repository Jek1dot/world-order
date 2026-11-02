# World Order v0.5.0-alpha.1 — Checkpoint 1

Grand strategy sandbox berbasis browser (HTML, CSS, JavaScript vanilla, SVG), terinspirasi Hearts of Iron IV. Dunia nyata dengan 4.578 provinsi, kepemilikan vs penguasa, ibu kota, divisi, perang, kapitulasi, damai, **Fokus Nasional, event bergaya surat kabar, dan database sejarah 1991–2026 (pilot Indonesia)**. Tanpa backend, tanpa API key, tanpa proses build.

> **Checkpoint 1** dari proyek besar (database global 1991–2026 + UI bergaya HOI4). Yang selesai dan yang belum dijelaskan jujur di bawah. Cakupan data: `docs/COVERAGE.md`.

## Menjalankan
```
cd world-order
python -m http.server 8000        # atau: npx serve .
```
Buka **http://localhost:8000** (server statis wajib; `file://` tidak bisa memuat data). GitHub Pages: unggah isi folder apa adanya. Tidak butuh internet saat bermain.

## Layar & kontrol (familier bagi pemain HOI4)
- **Kolom ikon kiri** membuka jendela panel di atas peta: Politik (K), Fokus (F), Bangun (C), Produksi (P), Logistik (L), Pasukan (M), Perang (W), Diplomasi (D), Dagang (T), Ekonomi (E), Provinsi (V), Log (G), **Data (B)**. Esc menutup. Ikon redup = belum ada (Keputusan, Riset, Komando Tinggi, Intelijen).
- **Bar atas**: negara + kepala negara (dari database), kas, manpower, stabilitas, pabrik, divisi, 5 sumber daya, notifikasi yang dihitung dari state.
- **HUD bawah**: mode peta (Politik, Kepemilikan, Kontrol, Infra, Sumber daya, Supply) dan tanggal + pause + 5 kecepatan (1–20 hari/detik). Spasi = pause (tidak ada simulasi saat pause).
- **Peta**: drag, scroll-zoom, klik; provinsi tampil saat di-zoom. Klik kanan provinsi = perintah gerak/serang untuk divisi terpilih.

## Yang ada (v0.5α)
| Sistem | Status |
|---|---|
| Semua dari v0.4: owner/controller, ibu kota, divisi, perang, kapitulasi, damai, ekonomi, produksi, supply, diplomasi, AI, save | Selesai (lihat CHANGELOG) |
| **Database sejarah modular** (`data/db/`), skema JSON, validator semantik, manifest, lazy loading, cakupan otomatis | Selesai |
| **Pilot data**: presiden & wakil presiden Indonesia 1988–2026 (17 masa jabatan, 14 tokoh, vacancy), keluarga senapan FN FNC → Pindad SS1 → SS2 (10 varian), 5 event historis Indonesia | Selesai, status `partially_verified` |
| Kerangka 250 negara (nama pendek + ibu kota kini dari Natural Earth) | Selesai (sisanya `null` + alasan) |
| **Fokus Nasional**: mesin (prasyarat, any_of, eksklusif, syarat, durasi, efek nyata) + UI pohon (konektor, zoom/geser, cari, sorot dependensi) + AI; 24 fokus generik | Selesai (konten fiktif orisinal) |
| **Event**: mesin (tanggal & MTTH, kondisi, opsi, efek) + koran + auto-pause; 6 event generik + 5 historis | Selesai |
| **Politik**: pemimpin sesuai tanggal permainan + status/keyakinan/sumber; **Data**: penjelajah dengan slider tanggal 1991–2026 | Selesai (hanya Indonesia) |
| Logistik & Dagang (panel nyata), notifikasi dinamis | Selesai |
| Save skema 5 + migrasi otomatis dari skema 4 | Selesai |

## Belum ada (jujur)
- **Campaign 1991 / 2001**: belum tersedia. Butuh lapisan batas wilayah historis (USSR, Yugoslavia, Cekoslowakia, Timor Timur sebagai bagian Indonesia, dst.); batas peta masih kondisi kini, jadi tanggal permainan tetap 1 Januari 2026. Event historis 1998–2024 tidak menyala di campaign 2026 (sudah lampau).
- **Cakupan data**: hanya Indonesia yang punya pemimpin; hanya senjata api infanteri untuk alutsista (1 dari 21 kategori); 0 inventaris terverifikasi; **0 record berstatus `verified`** (semua `partially_verified`, sumber tersier). 239 negara hanya kerangka. Tidak ada menteri, panglima, jenderal, partai berkuasa selain nama partai presiden Indonesia.
- **Mekanik HOI4** yang belum: riset, keputusan, desainer divisi, grup tentara/garis depan/rencana tempur, jenderal, udara, laut, invasi laut, intelijen (matriks lengkap: `docs/AUDIT.md`).
- Pohon fokus unik per negara, produksi per model/varian, ikon bendera orisinal, minimap, dukungan sentuh/mobile (belum diuji).
- Pengujian UI hanya di jsdom (DOM tiruan); belum di browser sungguhan.

## Struktur
```
index.html, style.css            antarmuka & design system (docs/DESIGN_SYSTEM.md)
js/    core world db effects diplomacy pathfinding supply state economy military country focus events war ai sim save   simulasi (tanpa DOM)
       map ui panels panels2 icons main                                                                            tampilan
data/  provinces/borders/countries.geojson, world-data.json (geometri & graf)  •  db/ (database sejarah, docs/DATA_FORMAT.md)
schemas/world-order-db.schema.json    scripts/{import,validate,build}    tools/ (data peta)    tests/    docs/
```

## Perintah
```
npm install
npm test            # validator DB + 292 pengecekan (DB, skenario, aturan, UI)
npm run db:validate # validasi database
npm run db:build    # bangun ulang data/db + manifest + docs/COVERAGE.md
npm run sim         # simulasi dunia 365 hari agresif;  npm run sim:peace  = 730 hari damai
```

## Update GitHub
```
git rm -f script.js            # file v0.3 lama (jika masih ada)
git add -A && git commit -m "v0.5.0-alpha.1: database sejarah, fokus nasional, event, UI bergaya command center" && git push
```
Repositori GitHub saat ini (dicek 2026-10-30) masih snapshot lama (2 commit); v0.4+ belum di-push.

## Sumber & lisensi
Natural Earth (domain publik): batas, ibu kota. Fakta masa jabatan dan senjata api dari halaman Wikipedia/wiki komunitas yang dibaca (hanya fakta; CC BY-SA, URL & tanggal akses di `data/db/sources/sources.json`). Wiki HOI4 (CC BY-SA 3.0) hanya sebagai rujukan konsep; tidak ada aset Paradox yang dipakai. Statistik ekonomi permainan, terrain, sumber daya, dan konten fokus/event generik **sintetis/fiksi** dan berlabel.
