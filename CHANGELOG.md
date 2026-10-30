# Changelog

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
