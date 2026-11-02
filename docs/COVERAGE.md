# Laporan cakupan database

_Dibangun otomatis oleh `scripts/build/coverage.js` dari berkas di `data/db/`. Semua angka = jumlah record nyata atau rasio yang dihitung dari record nyata; tidak ada persentase perkiraan._

- Versi database: **0.1.0-checkpoint1** • skema: wo-db v1 • rentang target: 1991-01-01 → 2026-12-31
- Validasi otomatis: **0 error**, 8 peringatan (lihat `npm run db:validate`)

## 1. Jumlah record per kategori

| Kategori | Record nyata | Berkas |
| --- | --- | --- |
| Sumber terdaftar | 10 | 1 |
| Negara (kerangka + diperkaya) | 250 | 2 |
| Tokoh | 14 | 1 |
| Masa jabatan | 17 | (dalam berkas tokoh) |
| Produsen alutsista | 3 | 1 |
| Model alutsista | 3 | (dalam berkas alutsista) |
| Varian | 10 |  |
| Catatan operator | 5 |  |
| Catatan pengadaan (pesanan/pembelian) | 2 |  |
| Inventaris terverifikasi (jumlah unit per tahun) | 0 | 1 |
| Event historis | 5 |  |
| Event generik (fiksi gameplay) | 6 |  |
| Pohon fokus (generik / unik) | 1 / 0 | 1 |
| Node fokus | 24 |  |

## 2. Status verifikasi per jenis record

`verified` butuh ≥ 2 sumber atau 1 sumber primer/dataset resmi; `partially_verified` = ≥ 1 sumber yang benar-benar dibaca tetapi belum silang-sumber.

| Jenis | Total | verified | partially_verified | disputed | unknown | fictional_gameplay |
| --- | --- | --- | --- | --- | --- | --- |
| negara | 250 | 0 | 250 | 0 | 0 | 0 |
| ibu kota | 250 | 0 | 250 | 0 | 0 | 0 |
| tokoh | 14 | 0 | 14 | 0 | 0 | 0 |
| masa jabatan | 17 | 0 | 17 | 0 | 0 | 0 |
| model alutsista | 3 | 0 | 3 | 0 | 0 | 0 |
| varian | 10 | 0 | 10 | 0 | 0 | 0 |
| operator | 5 | 0 | 5 | 0 | 0 | 0 |
| pengadaan | 2 | 0 | 2 | 0 | 0 | 0 |
| event | 11 | 0 | 5 | 0 | 0 | 6 |
| pohon fokus | 1 | 0 | 0 | 0 | 0 | 1 |

## 3. Cakupan negara

| Bidang | Terisi | Dari | Rasio |
| --- | --- | --- | --- |
| Nama pendek (Natural Earth) | 250 | 250 | 100.0% |
| Nama resmi | 1 | 250 | 0.4% |
| Ibu kota kini (dataset) | 250 | 250 | 100.0% |
| …di antaranya lokasi perkiraan | 56 | 250 | 22.4% |
| Tanggal pembentukan (existence.from) | 0 | 250 | 0.0% |
| Kode ISO 3166-1 alpha-3 terverifikasi | 0 | 250 | 0.0% |
| Status keanggotaan PBB | 0 | 250 | 0.0% |
| Struktur eksekutif | 1 | 250 | 0.4% |
| Data pemimpin (berkas leaders) | 1 | 250 | 0.4% |

**Tahap 1 — Asia Tenggara (11 negara):**

| Negara | ID | Pemimpin? | Alutsista? | Catatan |
| --- | --- | --- | --- | --- |
| Brunei | BRN | belum | belum | kerangka saja |
| Indonesia | IDN | ya (presiden & wakil) | ya (senjata api) | pilot |
| Cambodia | KHM | belum | ya (senjata api) | kerangka saja |
| Laos | LAO | belum | belum | kerangka saja |
| Myanmar | MMR | belum | belum | kerangka saja |
| Malaysia | MYS | belum | belum | kerangka saja |
| Philippines | PHL | belum | belum | kerangka saja |
| Singapore | SGP | belum | belum | kerangka saja |
| Thailand | THA | belum | belum | kerangka saja |
| East Timor | TLS | belum | belum | kerangka saja |
| Vietnam | VNM | belum | belum | kerangka saja |

Wilayah lain (Asia Timur/Selatan, Tengah/Timur Tengah, Eropa, Amerika, Afrika, Oseania): **belum diriset**. 239 negara hanya berupa kerangka dari Natural Earth (nama pendek + ibu kota kini).

## 4. Cakupan periode (pemimpin)

| Negara | Peran | Record | Hari tercakup tenure (1991-01-01 → 2026-08-29) | Hari kosong tercatat |
| --- | --- | --- | --- | --- |
| IDN | head_of_state | 7 masa jabatan | 100.0% | 0.0% |
| IDN | head_of_government | 7 masa jabatan | 100.0% | 0.0% |
| IDN | deputy_head_of_state | 10 masa jabatan | 96.0% | 4.0% |

Peran yang BELUM punya satu record pun di negara mana pun: menteri pertahanan, menteri luar negeri, menteri keuangan/ekonomi, panglima angkatan bersenjata, kepala staf, pemimpin partai, jenderal & komandan.

## 5. Cakupan alutsista

| Kategori | Model | Varian |
| --- | --- | --- |
| infantry_weapons | 3 | 10 |
| artillery | 0 | 0 |
| anti_tank | 0 | 0 |
| apc | 0 | 0 |
| ifv | 0 | 0 |
| mbt | 0 | 0 |
| air_defense | 0 | 0 |
| radar_ew | 0 | 0 |
| fighter | 0 | 0 |
| attack_aircraft | 0 | 0 |
| bomber | 0 | 0 |
| transport_aircraft | 0 | 0 |
| helicopter | 0 | 0 |
| uav | 0 | 0 |
| frigate | 0 | 0 |
| destroyer | 0 | 0 |
| corvette | 0 | 0 |
| aircraft_carrier | 0 | 0 |
| submarine | 0 | 0 |
| amphibious_ship | 0 | 0 |
| logistics_support | 0 | 0 |

Kategori terisi: **1 dari 21**. Negara dengan operator tercatat: 4. Varian operasional dengan tahun masuk dinas khusus-varian: 1 dari 8 (sisanya `null`: sengaja tidak disalin dari model dasar).

## 6. Sumber

| ID | Penerbit | Jenis | Keandalan | Lisensi |
| --- | --- | --- | --- | --- |
| S-WP-PRES-IDN | Wikipedia | tertiary | medium | CC BY-SA 4.0 (hanya fakta/tanggal yang diambil) |
| S-WP-PINDAD-SS2 | Wikipedia | tertiary | medium | CC BY-SA 4.0 (hanya fakta) |
| S-WP-PINDAD-SS1 | Wikipedia | tertiary | medium | CC BY-SA 4.0 (hanya fakta) |
| S-MILWIKI-SS1 | Military Wiki / Fandom | tertiary | low | CC BY-SA |
| S-IMFDB-SS2 | Internet Movie Firearms Database | tertiary | low | CC BY-SA |
| S-SANDBOXX-SS2 | Sandboxx | secondary | medium | hak cipta penerbit; hanya fakta yang dirujuk |
| S-WP-FNC | Wikipedia | tertiary | medium | CC BY-SA 4.0 (hanya fakta) |
| S-NE-ADMIN1 | Natural Earth | dataset | high | Domain publik |
| S-NE-PLACES | Natural Earth | dataset | high | Domain publik |
| S-HOI4WIKI-MAIN | Paradox Wikis | tertiary | medium | CC BY-SA 3.0 |

## 7. Peringatan validator

- `DB-W002` [model eq.infantry.fn_fnc] model operasional tanpa tahun masuk dinas
- `DB-W002` [variant eq.infantry.pindad_ss1.v1] varian operasional tanpa tahun masuk dinas (belum diketahui)
- `DB-W002` [variant eq.infantry.pindad_ss1.v2] varian operasional tanpa tahun masuk dinas (belum diketahui)
- `DB-W002` [variant eq.infantry.pindad_ss1.v4] varian operasional tanpa tahun masuk dinas (belum diketahui)
- `DB-W002` [variant eq.infantry.pindad_ss1.v5] varian operasional tanpa tahun masuk dinas (belum diketahui)
- `DB-W002` [variant eq.infantry.pindad_ss2.v1] varian operasional tanpa tahun masuk dinas (belum diketahui)
- `DB-W002` [variant eq.infantry.pindad_ss2.v2] varian operasional tanpa tahun masuk dinas (belum diketahui)
- `DB-W002` [variant eq.infantry.pindad_ss2.v4] varian operasional tanpa tahun masuk dinas (belum diketahui)
