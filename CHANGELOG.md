# Changelog

## v0.5.0-alpha.1 — Checkpoint 1: database sejarah + UI bergaya command center
**Baru**
- Database sejarah modular `data/db/` (skema JSON, validator semantik 30+ aturan, manifest, lazy loading, laporan cakupan otomatis `docs/COVERAGE.md`).
- Pilot data bersumber: presiden & wakil presiden Indonesia 1988–2026 (+vacancy), keluarga senapan FN FNC/Pindad SS1/SS2 (varian, operator, pengadaan terpisah dari inventaris), 5 event historis, 10 sumber terdaftar.
- Kerangka 250 negara dari Natural Earth (nama, ibu kota kini; bidang tak diketahui = `null` + alasan).
- Fokus Nasional (mesin + UI pohon + AI), event bertanggal/MTTH + koran "Warta Dunia", modifier ekonomi/tempur dari efek.
- UI bergaya command center: kolom ikon kiri, jendela panel, HUD mode peta & waktu (5 kecepatan), notifikasi dinamis, Politik dengan pemimpin dari DB, penjelajah Database dengan slider tanggal, panel Logistik & Dagang.
- Design system (`docs/DESIGN_SYSTEM.md`), 28 ikon SVG orisinal.
- Save skema 5 dengan migrasi otomatis dari skema 4; `dbVersion` di save.
- Audit repository + matriks 30 mekanik HOI4 (`docs/AUDIT.md`), format data (`docs/DATA_FORMAT.md`).

**Perbaikan bug**
- Crash di pertempuran ganda saat penyerang hancur di pertempuran pertama (`war.js`).
- Manpower "negatif" akibat galat desimal; `boot()` tidak idempoten; tab Misi tidak muncul (flag 0); kedipan "Memuat…".

**Berubah**
- Tata letak: panel samping tetap digantikan jendela melayang; kecepatan jadi 5 tingkat (1/2/5/10/20).
- `WO.VERSION` = 0.5.0-alpha.1, `SAVE_SCHEMA` = 5.

**Belum**: campaign 1991/2001 (butuh batas historis), data di luar Indonesia, riset, keputusan, komando militer, udara/laut.

## v0.4.0 — Fondasi grand strategy & peperangan
**Baru**
- State dunia terpisah dari geometri: owner vs controller per provinsi, infrastruktur, pabrik per provinsi.
- Graf tetangga darat dari batas bersama (`data/world-data.json`), daratan, jalur laut domestik; pathfinding A*.
- Ibu kota asli (Natural Earth) + penanda bintang, pemindahan ibu kota (biaya, cooldown, syarat), deteksi pendudukan, riwayat.
- Divisi (infanteri, lapis baja, garnisun): rekrut, latihan, gerak berbasis waktu, penanda & jalur di peta, panah serangan.
- Perang berpasangan, aliansi/NAP/akses militer/dagang, pertempuran harian, pendudukan, supply, kapitulasi multi-faktor, damai (putih/transfer/aneksasi/reparasi).
- Ekonomi: PDB dinamis, kas, manpower, stabilitas, kelelahan perang; konstruksi; produksi senapan/artileri/tank; 5 sumber daya terpakai.
- AI dasar (ekonomi, produksi, rekrut, bertahan, menyerang, pindah ibu kota, minta damai); opsi AI agresif (default mati).
- UI: top bar, 10 panel, 6 mode peta, legenda, tooltip owner/controller, skenario latihan + misi, notifikasi & auto-pause.
- Save/load berversi (skema 4) dengan validasi; save lama ditolak dengan pesan, tanpa crash.
- Peta negara kini lokal (`data/countries.geojson`): tidak perlu internet/CDN.
- Alat: `tools/build_data.sh`, tes otomatis (150 pengecekan), profil.

**Berubah**
- `script.js` tunggal (v0.3) dipecah menjadi modul di `js/`. Fitur peta v0.3 dipertahankan (drag, zoom, wrapping, LOD provinsi, tooltip, zoom preset).
- Save v0.1–0.3 tidak kompatibel (ditolak dengan pesan).

**Dihapus**
- Eksperimen provinsi uji `JAVA-001` (diganti data asli sejak v0.3).

## v0.3.0
4.578 provinsi asli Natural Earth, batas negara, tooltip, LOD, pilihan provinsi, perbaikan klik (pointer capture), urutan layer.

## v0.1–0.2
Peta dunia interaktif, ekonomi sederhana, tanggal/pause/speed, save/load, zoom, drag, world wrapping.
