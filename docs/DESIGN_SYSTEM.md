# Design system World Order (v0.5α)

Tujuan: **terasa familier bagi pemain HOI4** (struktur navigasi, pola interaksi, kepadatan informasi, alur kerja) dengan **identitas & aset orisinal**. Tidak ada sprite, ikon, tekstur, portrait, logo, atau tata letak pixel-perfect milik Paradox.

## Peta familiaritas
| Elemen HOI4 (konsep) | World Order |
|---|---|
| Bar atas (sumber daya, stabilitas, tenaga kerja, pabrik) | Bar atas: bendera + nama + kepala negara (dari DB), kas, manpower, stabilitas, pabrik sipil/militer, jumlah divisi, 5 sumber daya, notifikasi |
| Kolom tombol panel di kiri | Kolom ikon kiri (18 panel); tombol cepat K/F/C/P/L/M/W/D/T/E/B; ikon yang belum berfungsi **dinonaktifkan** dengan penjelasan |
| Panel besar menutupi peta (fokus, produksi) | Jendela melayang di atas peta (lebar untuk Fokus & Database), Esc menutup |
| Mode peta di kiri-bawah | HUD kiri-bawah: 6 mode + zoom |
| Tanggal & kecepatan di kanan-bawah | HUD kanan-bawah: tanggal, pause, 5 kecepatan |
| Peringatan/notifikasi | Tombol notifikasi di bar atas (dihitung dari state: fokus belum dipilih, antrean kosong, pabrik menganggur, tawaran damai, event, supply rendah) |
| Event berbentuk koran | Koran "Warta Dunia": judul, tanggal, bendera, uraian, label historis/fiksi, tombol opsi dengan konsekuensi |
| Pohon fokus | Node bercabang + garis konektor, status selesai/tersedia/terkunci/eksklusif/berjalan, tooltip detail, progres, zoom & geser, pencarian, sorotan dependensi |
| Penanda unit di peta | Penanda per provinsi (jumlah, bar strength), jalur perintah, panah serangan, indikator pertempuran |

## Token (`:root` di `style.css`)
Warna: `--bg #0c0e0a` (arang-olive), `--panel #191d14`, `--edge #3a4329`, `--olive #7d8b43`, `--steel #8d9aa6`, aksen kuningan `--brass #c9a64a`/`--brass2 #e6c872`; semantik `--good #7fb069`, `--bad #cd5b4d`, `--warn #dca43c`, `--info #6fa0c8`. Tekstur halus = gradien CSS diagonal (`--tex`). Font: Segoe UI/system; judul koran: Georgia. Radius kecil (3 px) agar terasa militer, bukan dashboard SaaS.

## Komponen
`.btn` (+`.primary/.danger/.good/.sm`), `.badge`, `.vbadge` (status verifikasi data), `.bar` (+`.org/.warn/.bad`), `.row`, `.kv`, `.chip-btn`, `.leader-card`, `.hud`, `#tabs` (navigasi), `#window`, `.newspaper`, `.fnode` (node fokus), `.alert-btn`, tabel `.t`.

## Prinsip
- Padat tapi terbaca; hierarki jelas (judul bagian kapital kuningan, nilai tabular).
- **Setiap kontrol terhubung ke state**; yang belum ada ditandai "BELUM TERSEDIA" dan dinonaktifkan (Keputusan, Riset, Komando Tinggi, Intelijen).
- Data sejarah selalu menampilkan status verifikasi + keyakinan + sumber; data kosong ditulis jujur ("belum tersedia"), tidak dikarang.
- Ikon: 28 ikon SVG garis buatan sendiri (`js/icons.js`).

## Responsif & mobile
Desktop diprioritaskan. Di bawah 980 px kolom ikon menjadi baris horizontal dan jendela memenuhi lebar. **Belum diuji di perangkat sentuh**; pinch-zoom peta belum ada. Jangan diklaim mendukung mobile penuh.

## Yang belum ada
Minimap, ikon bendera orisinal per negara (saat ini lencana kode negara berwarna), portrait tokoh, panel Komando (grup tentara/garis depan/rencana tempur), desainer divisi, UI riset, tema terang/aksesibilitas kontras tinggi.
