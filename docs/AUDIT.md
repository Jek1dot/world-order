# Audit repository & mekanik (Checkpoint 1, 2026-10-30)

## 1. Keadaan repository
| Hal | Temuan |
|---|---|
| GitHub `Jek1dot/world-order` | Halaman repo dibaca 2026-10-30: 2 commit, README masih v0.1, `script.js` tunggal, **tidak ada folder `js/` atau `data/db/`**. v0.4 dan v0.5α **belum di-push**. |
| Basis kerja | Proyek lokal v0.4 (3.025 baris di `js/`), dikembangkan di sini ke v0.5.0-alpha.1. |
| Teknologi | HTML/CSS/JavaScript vanilla + SVG; tanpa framework; devDependencies saja (jsdom, mapshaper, ajv). |
| Fitur lama | Semua dipertahankan (peta, wrapping, LOD provinsi, owner/controller, ibu kota, divisi, perang, kapitulasi, damai, supply, diplomasi, AI, save). 55 pengecekan UI v0.4 tetap lolos di layout baru. |

## 2. Audit kode (bug yang ditemukan lewat pengujian di checkpoint ini)
1. `war.js`: divisi yang terdaftar di dua pertempuran sekaligus lalu hancur di yang pertama → daftar penyerang kosong → **crash** (laten sejak v0.4; baru muncul setelah urutan RNG berubah). Diperbaiki + tes regresi.
2. `military.js`: galat desimal −2,2×10⁻¹⁶ membuat manpower "negatif". Diperbaiki (dipagari ≥ 0).
3. `main.js`: `boot()` tidak idempoten (listener ganda bila `DOMContentLoaded` terkirim dua kali). Diperbaiki.
4. `flags.scenario = 0` dianggap "salah" (tab Misi tersembunyi). Diperbaiki.
5. Kedipan "Memuat…" untuk negara tanpa berkas pemimpin. Diperbaiki.

## 3. Matriks mekanik HOI4 (30 butir)
**Catatan sumber:** dari wiki HOI4 yang kamu berikan, hanya **halaman indeks** yang berhasil kubaca (daftar topik; lisensi CC BY-SA 3.0). Halaman mekanik individual **belum dibaca**; kolom "fungsi di HOI4" memakai pengetahuan umum tentang game dan **belum diverifikasi terhadap wiki**. Spesifikasi di bawah adalah rancangan orisinal World Order.

Status: ✔ ada & teruji • ◐ sebagian • ✖ belum ada. Prioritas: P1 = checkpoint berikut, P2 = v0.6, P3 = nanti.

| # | Mekanik | Fungsi di HOI4 (umum) | Status di World Order | Spesifikasi / yang kurang | Prio | Bergantung pada | Acceptance test |
|---|---|---|---|---|---|---|---|
| 1 | Pemilihan negara | Pilih negara + tanggal mulai | ◐ klik peta + "Pimpin"; skenario latihan | Pemilih campaign 1991/2001/2026, daftar negara dengan bendera & bias | P1 | Batas historis (#data) | Semua negara dapat dipilih; negara belum berdiri tak muncul |
| 2 | Sistem politik | Ideologi, partai, hukum, penasihat | ◐ pemimpin historis dari DB (IDN) | Partai/ideologi terstruktur, hukum (wajib militer, ekonomi), penasihat | P2 | Data pemerintahan | Pemimpin sesuai tanggal (✔ `db_queries.test`) |
| 3 | Fokus nasional | Pohon fokus, 1 aktif, durasi, efek | ✔ mesin + UI; 24 fokus generik | Pohon unik per negara, flag/event historis, bobot AI per ideologi | P1 | Data sejarah | prasyarat/eksklusif/any_of/efek (✔ `gameplay_db.test`) |
| 4 | Keputusan | Aksi berbiaya dengan syarat | ✖ | Sistem decision dengan biaya, cooldown, syarat | P2 | Efek/kondisi (✔ ada) | Tombol aktif hanya bila syarat terpenuhi |
| 5 | Event | Event bertanggal & MTTH dengan opsi | ✔ mesin + koran | Lebih banyak event historis tervalidasi | P1 | Riset data | event bertanggal & acak (✔) |
| 6 | Riset | Slot riset, teknologi, bonus | ✖ | Pohon teknologi per era; membuka model alutsista | P1 | Database alutsista | Teknologi membuka model; tanggal historis dihormati |
| 7 | Produksi | Lini per model, efisiensi, impor | ◐ 3 jenis abstrak, efisiensi, bahan baku | Lini per **model/varian** dari DB, upgrade, lisensi, impor | P1 | DB alutsista, riset | Model belum ada tidak bisa diproduksi |
| 8 | Konstruksi | Antrean, slot, infrastruktur | ✔ | Pelabuhan/benteng/radar | P3 | — | slot & biaya (✔ `rules`) |
| 9 | Desainer divisi | Template batalion | ✖ (3 tipe tetap) | Template kustom dari model alutsista | P2 | #7 | Statistik divisi = fungsi template |
| 10 | Organisasi pasukan | Grup tentara, tentara | ✖ (daftar datar) | Hirarki grup tentara → tentara → divisi | P2 | UI komando | Perintah ke grup menggerakkan anggota |
| 11 | Jenderal & marsekal | Skill & sifat | ✖ | Tokoh militer DB + skill gameplay terpisah | P2 | DB tokoh militer | Skill tidak diklaim sebagai fakta |
| 12 | Front line | Garis depan otomatis | ✖ (hanya panah serangan) | Hitung garis depan dari kontrol provinsi | P2 | #10 | Garis berubah saat controller berubah |
| 13 | Garis ofensif | Gambar garis serangan | ✖ | Perintah via garis | P3 | #12 | — |
| 14 | Rencana tempur | Aggressive/defensive | ✖ | Rencana tempur per grup | P3 | #12 | — |
| 15 | Pertempuran darat | Lebar, org, stat, terrain | ◐ harian, lebar 10, terrain, org/str/supply/xp | Benteng, sungai, koordinasi, serangan balik | P2 | Terrain nyata | hasil bergantung statistik (✔ `rules`) |
| 16 | Terrain | Efek kecepatan/tempur | ◐ 9 jenis, **sintetis** | Data terrain nyata per provinsi | P2 | Dataset terrain | Gunung memperlambat/menggagalkan (✔) |
| 17 | Supply & logistik | Hub, rel, truk | ◐ jaringan dari ibu kota/hub regional | Rel, pelabuhan, truk, konvoi | P2 | Infrastruktur | Pendudukan memutus supply (✔) |
| 18 | Perang udara | Wilayah, misi | ✖ | Pesawat, supremasi udara | P3 | DB pesawat | — |
| 19 | Perang laut | Armada, misi | ✖ | Provinsi laut, armada | P3 | Provinsi laut | — |
| 20 | Invasi laut | Amfibi | ✖ (hanya pengangkutan domestik) | Pendaratan dengan kapal angkut | P3 | #19 | Unit tak menyeberang tanpa kapal (✔ saat ini) |
| 21 | Diplomasi | Aliansi, jaminan, boneka | ◐ perang, NAP, aliansi, akses, dagang | Jaminan, faksi, boneka, justifikasi perang | P2 | — | validasi aksi (✔ `rules`) |
| 22 | Intelijen | Agen, operasi | ✖ | Agen, operasi, kerangka pengetahuan | P3 | — | — |
| 23 | Konferensi damai | Pembagian multi-pihak | ◐ damai bilateral (transfer/aneksasi/reparasi) | Konferensi multi-pemenang | P3 | — | skor perang membatasi syarat (✔) |
| 24 | Perdagangan | Slot dagang | ◐ pakta dagang sederhana | Ekspor/impor sumber daya bernilai | P2 | #25 | Pembeli bayar, penjual terima (✔ logika) |
| 25 | Sumber daya | 5+ sumber daya | ✔ (sintetis) | Data geologi nyata | P2 | Dataset | konsumsi nyata (✔) |
| 26 | Infrastruktur | Level, supply, kecepatan | ✔ | Data awal nyata | P3 | — | — |
| 27 | AI | Strategi & ekonomi | ◐ ekonomi, produksi, rekrut, bertahan, menyerang, fokus, ibu kota, damai | Perencanaan kampanye, front | P2 | #12 | AI tunduk aturan sama (✔) |
| 28 | Save/load | Berversi | ✔ skema 5 + migrasi 4→5 | — | — | — | migrasi (✔ `gameplay_db.test`) |
| 29 | Kecepatan | Pause + 5 level | ✔ (1/2/5/10/20 hari/detik) | — | — | — | pause menghentikan simulasi (✔) |
| 30 | Mode peta | Politik, medan, dll. | ◐ 6 mode | Terrain, diplomasi, ideologi | P2 | — | mode membaca state (✔) |
