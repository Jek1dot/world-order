# Rumus & balancing (v0.4)

Semua konstanta ada di `js/core.js` (objek `WO.C`). Angka ekonomi/sumber daya **sintetis** untuk keseimbangan permainan, bukan data resmi.

## Waktu
1 tick = 1 hari game. 1×/2×/5×/10× = jumlah hari per detik nyata. Pause = tidak ada tick. Urutan harian (`js/sim.js`):
diplomasi → agregat → dagang → ekonomi tiap negara → AI → supply → pergerakan → pertempuran → pemulihan → kapitulasi/damai.

## Wilayah
- `owner` = pemilik sah; `controller` = penguasa aktual. **Pendudukan hanya mengubah controller.** Owner berubah hanya di `War.settle` (perjanjian damai).
- Tetangga darat = dua provinsi berbagi minimal satu sisi batas yang sama (bukan kedekatan titik). Pulau/provinsi yang dipisahkan laut tidak bertetangga.
- Jalur laut (hanya pengangkutan domestik): pasangan provinsi terdekat antar daratan, jarak ≤ 5° (~550 km), maks 3 per pasangan daratan. Hanya dilalui bila kedua ujung milik/sekutu/akses sendiri. Waktu: 3 hari naik kapal + km/50 per hari, biaya rute ×1,3.

## Ekonomi (per negara, per hari)
- `PDB = (Σ PDB provinsi dimiliki & dikuasai + 0,3 × Σ PDB provinsi diduduki) × pertumbuhan`; pertumbuhan +0,004%/hari (damai), −0,001% (perang), × stabMod.
- `stabMod = 0,6 + 0,4 × stabilitas/100`.
- Pendapatan = `PDB/365 × 0,20 × stabMod`. Biaya: 0,004 miliar/divisi, +0,01 per divisi yang bertempur.
- Manpower awal 1,2% populasi; regen `pop × 0,005% × stabMod`; batas 3%.
- Stabilitas bergerak ≤0,3/hari menuju `dasar − 0,35×kelelahan − 35×(fraksi VP hilang) − 10 (pangan kurang) − 10 (kas negatif)`.
- Kelelahan perang +0,02/hari saat perang, −0,05/hari saat damai, + korban/(populasi×0,03%)×10.
- Pabrik awal: sipil = `max(1, round(√PDB/1,8))`, militer = `round(sipil×0,45)` (0 bila PDB < 20). Dibagi ke provinsi menurut populasi.

## Konstruksi
Kapasitas = `pabrik sipil × 5 × stabMod × faktorBatuBara` poin/hari; tiap proyek maks 75/hari. Biaya: pabrik 3600 poin & $2 M, infrastruktur 1800 poin & $1 M (dibayar saat antre; refund 50% sisa bila batal). Slot pabrik per provinsi = `3 + 3×infrastruktur`. Proyek di provinsi yang diduduki berhenti.

## Produksi
`PP/hari = pabrik × 4,5 × efisiensi × stabMod × faktorBatuBara`; `item = PP / biaya`. Efisiensi lini mulai 10%, +1%/hari sampai 100% (pabrik tambahan mulai dari 10%).
| Peralatan | PP | Bahan/item |
|---|---|---|
| Senapan | 0,5 | baja 0,1 |
| Artileri | 3 | baja 0,8, aluminium 0,2 |
| Tank | 8 | baja 1,5, aluminium 0,6, minyak 0,4 |

Bila bahan kurang, output dikalikan rasio ketersediaan terkecil. Pabrik yang hilang (diduduki) mengecilkan lini secara proporsional.

## Sumber daya (sintetis)
Total nasional = `bobot × skala × √PDB` (skala: minyak 0,5; baja 0,9; aluminium 0,45; batu bara 0,9; pangan 1,2). Bobot default: minyak 0,2; baja 0,6; aluminium 0,3; batu bara 0,6; pangan 1,0; produsen besar punya bobot lebih tinggi (tabel di `world.js`). Dibagi ke provinsi acak-deterministik.
Pemakaian: batu bara 0,25/pabrik/hari (kurang → semua output turun); pangan 0,2/divisi/hari; minyak 0,5/divisi lapis baja/hari. Stok dibatasi `max(500, 90 hari produksi)`. Wilayah diduduki: pemilik kehilangan 100%, penduduk mendapat 30%.

## Divisi
| Tipe | Manpower | Peralatan | Atk | Def | Org | Kecepatan (km/hari) | Biaya |
|---|---|---|---|---|---|---|---|
| Infanteri | 10.000 | 1000 senapan, 30 artileri | 20 | 30 | 60 | 60 | $0,30 M |
| Lapis baja | 8.000 | 400 senapan, 20 artileri, 250 tank | 45 | 30 | 50 | 100 | $0,60 M |
| Garnisun | 5.000 | 400 senapan | 10 | 22 | 45 | 50 | $0,12 M |

Latihan 10 hari. Gerak: `km/hari = kecepatan × terrain × (1+0,08×infra) × (0,5+0,5×supply) × bahan bakar`; tiap provinsi = jarak antar titik representatif.

## Pertempuran (harian)
- Penyerang: divisi dengan perintah menyerang provinsi musuh bertetangga, atau musuh yang sudah berada di dalam. Bertahan: divisi pengendali provinsi + sekutu. Lebar tempur 10 divisi per sisi.
- Kekuatan divisi = `atk|def × (0,5+0,5×org/orgMax) × (0,3+0,7×str/100) × (0,6+0,4×supply) × (1+xp/400) × terrain × bahanBakar`. Terrain mengalikan serangan (0,65–1,0) dan menambah bertahan (0 – +45%).
- Kerusakan organisasi ke tiap divisi sisi X = `Σ kekuatan lawan × 0,9 × acak(0,85–1,15) / jumlah divisi X`. Strength turun `kerusakanOrg × 0,22 × 100/orgMax × 0,6` poin.
- Org ≤ 0: pembela mundur ke provinsi sendiri terdekat ke ibu kota (atau hancur bila terkepung); penyerang batal menyerang (org 10%). Strength ≤ 0,5 = hancur.
- Bila semua pembela hilang, penyerang masuk dan menduduki (`controller` berubah).
- Pemulihan harian: org +3×(0,3+0,7×supply); strength +1%×supply bila ada manpower & peralatan di stok (dikurangi dari stok). Atrisi bila supply < 25%.

## Supply
Pusat: ibu kota (20), pusat regional per daratan (10), pusat darurat bila ibu kota jatuh (10). Aliran lewat provinsi yang **dikuasai** negara itu; biaya per langkah `0,6 + (5−infra)×0,15`; jalur laut domestik `3 + km/100`. `supply = poin/3` (maks 100%). Wilayah musuh memutus aliran.

## Kapitulasi
`tekanan = 30×[ibu kota diduduki] + 45×min(1, VP hilang/55%) + 12×kelelahan/100 + 13×(1−sisa pasukan/puncak)`. Negara kapitulasi bila tekanan ≥ 65 **dan** (ibu kota jatuh atau ≥ 40% VP hilang) selama 4 hari berturut-turut, atau bila tak menguasai satu pun provinsinya. Kehilangan ibu kota saja ≈ 30–40 → tidak cukup. Saat kapitulasi: pasukan di wilayah musuh menyerah, sisanya pasif.

## Damai
`skor perang = VP wilayah lawan yang kita kuasai / total VP lawan (+0,25 bila lawan kapitulasi)`. Biaya syarat: transfer = fraksi VP provinsi yang diambil; aneksasi = 0,9; reparasi = 0,15 (50% kas lawan, maks $200 M). Damai putih gratis (butuh persetujuan AI bila lawan belum kapitulasi). Setelah damai provinsi yang tidak ditransfer dikembalikan ke pemilik, pasukan di wilayah terlarang ditarik ke wilayah sahabat terdekat. Negara tanpa provinsi dihapus.

## Ibu kota
Biaya `2 + 0,003×PDB` miliar, cooldown 180 hari, provinsi harus milik & dikuasai, infra ≥ 2, tanpa musuh; stabilitas −5. AI hanya memindahkan saat terancam (musuh ≤ 2 langkah / ibu kota jatuh), ke provinsi ≥ 3 langkah dari musuh, maks 2 kali per 365 hari.

## Diplomasi
Opini −100…100, pulih ke 0 pelan. Perbaiki hubungan: $0,5 M, +15, cooldown 30 hari. Persetujuan AI: NAP opini ≥ −10; dagang ≥ −5; akses ≥ 10; aliansi ≥ 40. Perang: −60 opini, sekutu kedua pihak ikut otomatis, pakta di antara keduanya batal. NAP/aliansi memblokir deklarasi perang. Dagang: tiap hari pembeli dengan stok di bawah ambang membeli maks 10 unit/sumber daya dari mitra yang stoknya > 2× ambang, $0,01 M/unit.

## AI (evaluasi tiap 7 hari, bergilir)
Ekonomi (antre pabrik: rasio militer:sipil 1:2, kadang infrastruktur), lini produksi (55% senapan, 30% artileri, 15% tank bila PDB ≥ 800), rekrut hingga target `√populasi×0,9` (×1,5 saat perang), menyebar ke titik terancam, menyerang bila kekuatan lokal ≥ 1,5× pembela, menyerbu bila total kekuatan ≥ 1,2× musuh, memindahkan ibu kota, meminta damai bila tekanan ≥ 45 atau kelelahan ≥ 70. Memulai perang sendiri hanya bila opsi "AI agresif" dinyalakan (default mati). AI memakai fungsi yang sama dengan pemain (kas, manpower, peralatan, izin militer, waktu gerak).
