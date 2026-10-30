# World Order v0.4 — Grand Strategy Sandbox

Game strategi berbasis browser (HTML, CSS, JavaScript vanilla, SVG) yang terinspirasi Hearts of Iron IV, Europa Universalis, dan Victoria. Dunia nyata dengan **4.578 provinsi**, kepemilikan wilayah, ibu kota, divisi, peperangan, kapitulasi negara, dan perjanjian damai. Tanpa backend, tanpa API key, tanpa proses build.

## Menjalankan (localhost)

Butuh server statis apa saja (file GeoJSON tidak bisa dimuat dari `file://`).

```
cd world-order
python -m http.server 8000        # atau: npx serve .
```

Buka **http://localhost:8000**. Untuk GitHub Pages: unggah isi folder apa adanya (semua path relatif). Tidak perlu internet saat bermain; peta negara dan provinsi sudah ada di folder `data/`.

## Cara bermain

1. **Pilih negara**: klik negara di peta → tab *Negara* → **Pimpin negara ini**. Atau pakai **Skenario latihan** (Indonesia vs Timor-Leste), lihat tab *Misi*.
2. **Waktu**: Spasi / ▶ = jalan/pause; tombol 1×, 2×, 5×, 10× = hari game per detik. Saat pause *tidak ada* simulasi yang berjalan.
3. **Industri**: tab *Provinsi* → bangun pabrik sipil/militer/infrastruktur di provinsi milikmu. Tab *Produksi* → alokasikan pabrik militer ke senapan, artileri, atau tank (butuh baja, aluminium, minyak).
4. **Tentara**: rekrut divisi (butuh manpower + peralatan + kas, latihan 10 hari). Klik penanda unit di peta atau centang di tab *Militer*. **Klik kanan** provinsi tujuan = gerak/serang (atau "Mode perintah" lalu klik kiri). Esc = batal.
5. **Perang**: klik negara lain → tab *Diplomasi* → Nyatakan perang. Serang provinsi musuh yang bertetangga. Pertempuran berlangsung per hari; pemenang *menduduki* provinsi (penguasa berubah, pemilik tetap).
6. **Kapitulasi & damai**: tekan musuh (ibu kota, wilayah, sisa pasukan, kelelahan perang). Setelah kapitulasi buka tab *Perang*: damai putih, ambil provinsi yang diduduki, aneksasi penuh, reparasi.
7. **Simpan/Muat**: tombol di atas (localStorage).

Mode peta: **Politik** (pemilik), **Kepemilikan**, **Kontrol militer** (penguasa), **Infrastruktur**, **Sumber daya**, **Supply**. Wilayah yang diduduki selalu ditandai **garis diagonal** warna penguasa.

## Apa yang benar-benar berfungsi

Rantai terintegrasi dalam satu state: **produksi → stok peralatan → rekrutmen → gerak (graf provinsi) → perang → pertempuran → pendudukan (controller) → tekanan kapitulasi → damai (owner) → save/load**.

| Sistem | Status |
|---|---|
| Owner vs controller per provinsi, 6 mode peta, pola wilayah pendudukan | Selesai |
| Graf tetangga darat dari sisi batas bersama (41/41 perbatasan uji terdeteksi), jalur laut domestik | Selesai |
| Pathfinding A* (jarak, terrain, infrastruktur, akses militer, wilayah musuh) | Selesai |
| Ibu kota (data Natural Earth), pindah ibu kota (biaya, cooldown, syarat), deteksi pendudukan, riwayat | Selesai |
| Divisi: rekrut, latihan, gerak berbasis waktu, penanda unit, jalur, panah serangan | Selesai |
| Perang berpasangan, aliansi otomatis ikut, pertempuran per hari, retreat, korban, XP | Selesai (sederhana) |
| Kapitulasi multi-faktor (tidak instan), skor perang, damai putih/transfer/aneksasi/reparasi | Selesai |
| Ekonomi: PDB dinamis, kas, manpower, stabilitas, kelelahan perang | Selesai (sintetis) |
| Konstruksi (antrean, kapasitas dari pabrik sipil), produksi 3 jenis peralatan | Selesai |
| 5 sumber daya yang benar-benar dipakai (produksi, pabrik, tentara) | Selesai (sintetis) |
| Supply (jaringan dari ibu kota/pusat regional, putus oleh pendudukan) + efeknya | Selesai |
| Diplomasi: opini, perang, damai, NAP, aliansi, akses militer, dagang, riwayat | Selesai (sederhana) |
| AI: ekonomi, produksi, rekrut, bertahan, menyerang, pindah ibu kota, minta damai | Selesai (sederhana) |
| Save/load berversi, validasi, penolakan save lama tanpa crash | Selesai |

## Belum ada / prototipe (jujur)

- **Pendaratan amfibi, angkatan laut, udara**: tidak ada. Penyeberangan laut hanya antar wilayah milik/sekutu/akses sendiri (pengangkutan domestik).
- **Fortifikasi**, template divisi kustom, jenderal, riset, intelijen, negara boneka: tidak ada.
- **Provinsi = wilayah administratif Natural Earth** (4.578), bukan petak kecil seragam ala HOI4 dan tidak ada provinsi laut. Indonesia masih 33 provinsi.
- **Data sintetis**: terrain, populasi/PDB per provinsi, sumber daya, infrastruktur awal, jumlah divisi awal. Statistik negara (populasi, PDB) = perkiraan kasar; 78 negara kecil memakai estimasi sintetis. Semuanya diberi label di UI.
- 56 ibu kota negara kecil/dependensi memakai perkiraan (ditandai "perkiraan").
- Kerugian peralatan tidak dimodelkan terpisah: korban mengurangi *strength*, dan pemulihan menguras manpower + peralatan dari stok.
- Peta belum mendukung pinch-zoom sentuh (scroll mouse/tombol saja).
- Pengujian UI hanya di jsdom (DOM tiruan), belum di browser sungguhan. Lihat `docs/TESTING.md`.

## Struktur proyek

```
index.html, style.css
js/        core, world, diplomacy, pathfinding, supply, state, economy, military, country, war, ai, sim, save   (simulasi, tanpa DOM)
           map (render SVG), ui + panels (antarmuka), main (boot & loop)
data/      provinces.geojson, borders.geojson, countries.geojson (geometri)  •  world-data.json (graf, ibu kota, statistik)
tools/     build_data.sh, build_world_data.py, postprocess_geo.py   (membangun ulang data/)
tests/     scenario, rules, long_sim, test_ui, profile
docs/      SYSTEMS.md (rumus & balancing), TESTING.md (hasil uji)
```

Arsitektur: simulasi (`js/*` kecuali map/ui/panels/main) tidak menyentuh DOM dan hanya memakai **province ID**. `map.js` hanya membaca state (lewat `hooks.getState()`), sehingga renderer bisa diganti Canvas/WebGL tanpa menulis ulang gameplay. Geometri tidak masuk save; provinsi disimpan sebagai selisih dari kondisi awal.

## Tes

```
npm install          # jsdom (dan mapshaper bila ingin membangun ulang data)
npm test             # 150 pengecekan: skenario, aturan, UI
npm run sim          # simulasi dunia 365 hari, semua AI, cek invarian + waktu
```

## Update repository GitHub

```
git rm -f script.js                 # file v0.3 sudah digantikan folder js/
git add -A
git commit -m "v0.4: kepemilikan/penguasa, ibu kota, divisi, perang, kapitulasi, ekonomi, AI"
git push
```
Ekstrak ZIP ke folder repo (timpa), lalu jalankan perintah di atas. Folder `node_modules/` tidak ikut karena ada di `.gitignore`.

## Sumber data & lisensi

Natural Earth (domain publik): batas provinsi 10m Admin-1 dan Populated Places (ibu kota). Disederhanakan dengan mapshaper. Statistik negara adalah perkiraan; jangan dipakai sebagai data resmi.

## Roadmap v0.5

1. Pecah provinsi besar menjadi petak seragam (Voronoi) lalu pindah renderer ke Canvas/WebGL (>10 ribu wilayah).
2. Provinsi laut + angkatan laut + pendaratan amfibi.
3. Template divisi, jenderal, fortifikasi, front line otomatis.
4. Perdagangan sumber daya yang sebenarnya, negara boneka, faksi.
5. Data nyata (terrain, sumber daya) menggantikan data sintetis.
6. Uji di browser sungguhan (Playwright), pinch-zoom, antarmuka sentuh.
