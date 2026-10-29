# World Order v0.3 — Prototipe

Prototipe game grand strategy modern berbasis web (terinspirasi Hearts of Iron IV), dibuat dengan HTML, CSS, JavaScript, dan SVG tanpa framework.

## Cara menjalankan

1. Jalankan server lokal di folder proyek: `python -m http.server 8000`
2. Buka `http://localhost:8000` (internet diperlukan untuk mengunduh peta negara saat pertama kali dibuka).
3. Klik negara, pilih **Pimpin negara ini**, tekan **Main**, lalu coba **Bangun industri**.
4. Scroll mouse atau klik tombol **Indonesia / Pulau Jawa** untuk zoom dan melihat batas provinsi.

Membuka `index.html` langsung dari file tidak bisa memuat data provinsi, gunakan server lokal.

## Fitur

- Peta dunia, drag, zoom scroll, dan world wrapping horizontal
- ~4.500 provinsi asli seluruh dunia dengan warna per negara, batas negara tebal, tooltip nama, dan klik untuk memilih
- Provinsi hanya digambar saat peta di-zoom (level of detail) supaya tetap ringan
- Jam permainan, pause, 1×/2×/5×
- Data ekonomi ilustratif (bukan data dunia nyata)
- Pembangunan industri sederhana
- Save/load menggunakan localStorage

## Data peta

- Negara: `datasets/geo-countries` (turunan Natural Earth), diunduh lewat CDN.
- Provinsi dan batas negara: **Natural Earth 10m Admin 1 – States, Provinces** (domain publik), disederhanakan dengan mapshaper. Hasilnya ada di `data/provinces.geojson` dan `data/borders.geojson`.

Membuat ulang data provinsi (perlu Node.js):

```
npx mapshaper ne_10m_admin_1_states_provinces.geojson \
  -each 'id=adm1_code, country=adm0_a3, country_name=admin, name=(name || gn_name || woe_name || adm1_code)' \
  -filter-fields id,name,country,country_name \
  -filter-slivers min-area=0.00002 \
  -simplify 10% keep-shapes \
  -o data/provinces.geojson format=geojson precision=0.01
```

## Catatan

Versi ini masih prototipe: belum ada sistem perang, AI, diplomasi, atau data negara yang akurat. Batas provinsi mengikuti pembagian administratif Natural Earth (misalnya Indonesia masih 33 provinsi).
