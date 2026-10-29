# World Order v0.1 — Prototipe

Prototipe game grand strategy modern berbasis web, dibuat dengan HTML, CSS, dan JavaScript tanpa framework.

## Cara menjalankan
1. Ekstrak ZIP.
2. Buka `index.html` di browser. Internet diperlukan untuk mengunduh peta GeoJSON saat pertama kali dibuka.
3. Ketuk negara, pilih **Pimpin negara ini**, tekan **Main**, lalu coba **Bangun industri**.
4. Jika browser membatasi akses peta dari file lokal, jalankan lewat server lokal (`python -m http.server 8000`) dan buka `http://localhost:8000`, atau upload ke GitHub Pages.

## Fitur
- Peta dunia dan pilihan negara
- Jam permainan, pause, 1×/2×/5×
- Data ekonomi ilustratif (bukan data dunia nyata)
- Pembangunan industri sederhana
- Save/load menggunakan localStorage
- Layout untuk layar HP

## Catatan
Peta menggunakan data GeoJSON dari `datasets/geo-countries` yang diturunkan dari Natural Earth, diunduh lewat CDN. Untuk distribusi produksi, cek lisensi dan simpan aset peta secara lokal. Versi ini masih prototipe: belum ada sistem perang, AI, diplomasi, atau data negara yang akurat.
