#!/usr/bin/env node
// Menghasilkan berkas data/db/* untuk Checkpoint 1 (pilot Indonesia + kerangka negara).
// Semua fakta di sini berasal dari halaman yang BENAR-BENAR dibaca pada 2026-10-30 (lihat sumber di bawah).
// Fakta yang tidak ditemukan dibiarkan null dengan alasan. Jalankan: node scripts/import/seed_pilot.js
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", ".."), OUT = path.join(ROOT, "data/db");
const ACC = "2026-10-30";
const write = (rel, obj) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj, null, 1) + "\n"); };
const ver = (status, confidence, sources, notes, extra) => Object.assign({ status, confidence }, sources && sources.length ? { sources } : {}, status === "unknown" || status === "fictional_gameplay" ? {} : { checked: ACC }, notes ? { notes } : {}, extra || {});
const unk = (reason) => ({ status: "unknown", confidence: "low", reason_unknown: reason });
const dp = (date, precision) => ({ date, precision: precision || "day" });

// ---------------- sumber ----------------
const sources = [
  { id: "S-WP-PRES-IDN", title: "List of presidents of Indonesia (tabel presiden, wakil presiden, partai)", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/List_of_presidents_of_Indonesia", accessed: ACC, license: "CC BY-SA 4.0 (hanya fakta/tanggal yang diambil)", type: "tertiary", reliability: "medium", notes: "Halaman dibaca penuh; catatan kaki menyebut data 'per 29 Agustus 2026'." },
  { id: "S-WP-PINDAD-SS2", title: "Pindad SS2", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Pindad_SS2", accessed: ACC, license: "CC BY-SA 4.0 (hanya fakta)", type: "tertiary", reliability: "medium", notes: "Dibaca lewat cuplikan hasil pencarian, bukan halaman penuh." },
  { id: "S-WP-PINDAD-SS1", title: "Pindad SS1", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Pindad_SS1", accessed: ACC, license: "CC BY-SA 4.0 (hanya fakta)", type: "tertiary", reliability: "medium", notes: "Cuplikan dari en.wikipedia.com (mirror); bukan halaman penuh." },
  { id: "S-MILWIKI-SS1", title: "Pindad SS1 (Military Wiki)", publisher: "Military Wiki / Fandom", url: "https://military-history.fandom.com/wiki/Pindad_SS1", accessed: ACC, license: "CC BY-SA", type: "tertiary", reliability: "low", notes: "Wiki komunitas; dipakai hanya sebagai pendukung, bukan penentu." },
  { id: "S-IMFDB-SS2", title: "Pindad SS2 (IMFDB)", publisher: "Internet Movie Firearms Database", url: "https://www.imfdb.org/wiki/Pindad_SS2", accessed: ACC, license: "CC BY-SA", type: "tertiary", reliability: "low", notes: "Wiki komunitas." },
  { id: "S-SANDBOXX-SS2", title: "Indonesia's Pindad SS2 – Service rifles from around the world", publisher: "Sandboxx", url: "https://www.sandboxx.us/news/indonesias-pindad-ss2-service-rifles-from-around-the-world/", accessed: ACC, license: "hak cipta penerbit; hanya fakta yang dirujuk", type: "secondary", reliability: "medium", notes: "Artikel populer; dibaca lewat cuplikan." },
  { id: "S-WP-FNC", title: "FN FNC", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/FN_FNC", accessed: ACC, license: "CC BY-SA 4.0 (hanya fakta)", type: "tertiary", reliability: "medium", notes: "Cuplikan hasil pencarian." },
  { id: "S-NE-ADMIN1", title: "Natural Earth 10m Admin 1 – States, Provinces", publisher: "Natural Earth", url: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/", accessed: ACC, license: "Domain publik", type: "dataset", reliability: "high", notes: "Nama negara/provinsi, kode adm0_a3. Batas = kondisi kini (bukan 1991)." },
  { id: "S-NE-PLACES", title: "Natural Earth 10m Populated Places (simple)", publisher: "Natural Earth", url: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/", accessed: ACC, license: "Domain publik", type: "dataset", reliability: "high", notes: "Ibu kota kini. Beberapa dependensi tidak punya entri ibu kota." },
  { id: "S-HOI4WIKI-MAIN", title: "Hearts of Iron 4 Wiki (halaman utama)", publisher: "Paradox Wikis", url: "https://hoi4.paradoxwikis.com/Hearts_of_Iron_4_Wiki", accessed: ACC, license: "CC BY-SA 3.0", type: "tertiary", reliability: "medium", notes: "Hanya halaman indeks dibaca (daftar topik mekanik). Halaman mekanik individual belum dibaca." },
];
write("sources/sources.json", { sources });

// ---------------- negara ----------------
const wd = JSON.parse(fs.readFileSync(path.join(ROOT, "data/world-data.json"), "utf8"));
const SEA = ["IDN", "MYS", "SGP", "THA", "PHL", "VNM", "KHM", "LAO", "MMR", "BRN", "TLS"];
const mk = (id, c, region) => {
  const isIdn = id === "IDN";
  const rec = {
    id, kind: "unclassified", iso3: null, iso2: null, ne_a3: id, region, un_member: null,
    names: { official: isIdn ? "Republic of Indonesia" : null, short: c.name, historical: [] },
    existence: { from: null, to: null },
    capitals: [{ city: c.capName, province_id: c.cap, lonlat: c.capLL, from: null, to: null, approximate: !!c.capApprox,
      note: isIdn ? "Sumber S-WP-PRES-IDN menyebut proses pemindahan ibu kota ke Nusantara telah dimulai; belum dicatat sebagai perubahan." : "Ibu kota kini; tanggal penetapan belum diketahui.",
      verification: ver("partially_verified", c.capApprox ? "low" : "high", ["S-NE-PLACES"], c.capApprox ? "Tidak ada entri ibu kota di dataset; provinsi terbesar dipakai sebagai perkiraan" : "Titik kota dari Natural Earth dipetakan ke provinsi pemuatnya") }],
    population: null, gdp_musd: null,
    unknown_fields: { kind: "belum diklasifikasikan dari sumber", iso3: "kode ISO belum diverifikasi dari sumber", iso2: "belum diverifikasi", un_member: "belum diverifikasi dari sumber UN", "existence.from": "tanggal pembentukan belum diriset", population: "angka berdasarkan sumber belum dikumpulkan (nilai permainan terpisah di world-data.json, tidak bersumber)", gdp_musd: "idem", historical_names: "belum diriset" },
    verification: ver("partially_verified", "medium", ["S-NE-ADMIN1", "S-NE-PLACES"], "Hanya nama pendek dan ibu kota kini yang berasal dari dataset; bidang lain null"),
  };
  if (isIdn) {
    rec.executive = { structure: "president_is_head_of_state_and_government", head_of_state_title: "President of Indonesia", head_of_government_title: "President of Indonesia",
      selection_note: "Presiden dan Wakil Presiden dipilih langsung untuk masa jabatan lima tahun sejak 2004", verification: ver("partially_verified", "medium", ["S-WP-PRES-IDN"], "Kalimat pembuka halaman daftar presiden") };
    delete rec.unknown_fields["existence.from"]; rec.unknown_fields["existence.from"] = "tanggal proklamasi/pengakuan tidak ada di teks yang dibaca; jangan diisi dari ingatan";
  }
  return rec;
};
const sea = [], rest = [];
for (const id of Object.keys(wd.countries).sort()) (SEA.includes(id) ? sea : rest).push(mk(id, wd.countries[id], SEA.includes(id) ? "southeast_asia" : "unassigned"));
write("countries/southeast-asia.json", { shard: "southeast-asia", description: "Asia Tenggara (tahap 1). Hanya Indonesia yang punya data pemimpin pada checkpoint 1.", countries: sea });
write("countries/unprocessed.json", { shard: "unprocessed", description: "Kerangka negara dari Natural Earth: nama pendek + ibu kota kini. Belum diriset (tahap 2+).", countries: rest });

// ---------------- pemimpin Indonesia ----------------
const S = ["S-WP-PRES-IDN"];
const P = (key, name, birth, death) => ({ id: "person." + key, name, country: "IDN", birth, death, gameplay_skill: null,
  unknown_fields: birth ? {} : { birth: "tidak tercantum di tabel yang dibaca" }, verification: ver("partially_verified", "medium", S, birth ? "Tanggal lahir/wafat dari tabel masa jabatan presiden" : "Hanya nama & masa jabatan dari tabel") });
const persons = [
  P("suharto", "Suharto", "1921-06-08", "2008-01-27"), P("bj_habibie", "B. J. Habibie", "1936-06-25", "2019-09-11"),
  P("abdurrahman_wahid", "Abdurrahman Wahid", "1940-09-07", "2009-12-30"), P("megawati_sukarnoputri", "Megawati Sukarnoputri", "1947-01-23", null),
  P("susilo_bambang_yudhoyono", "Susilo Bambang Yudhoyono", "1949-09-09", null), P("joko_widodo", "Joko Widodo", "1961-06-21", null),
  P("prabowo_subianto", "Prabowo Subianto", "1951-10-17", null),
  P("sudharmono", "Sudharmono", null, null), P("try_sutrisno", "Try Sutrisno", null, null), P("hamzah_haz", "Hamzah Haz", null, null),
  P("jusuf_kalla", "Jusuf Kalla", null, null), P("boediono", "Boediono", null, null), P("maruf_amin", "Ma'ruf Amin", null, null), P("gibran_rakabuming_raka", "Gibran Rakabuming Raka", null, null),
];
const T = (key, person, roles, title, start, end, party, extra) => Object.assign({ id: "ten.IDN." + key, person: "person." + person, country: "IDN", roles, office_title: title,
  start: dp(start), end: end ? dp(end) : null }, end ? {} : { ongoing_as_of: "2026-08-29" }, { party: party || null }, party ? { party_status: "partially_verified" } : {},
  { verification: ver("partially_verified", "medium", S, "Tanggal dari kolom 'Took office/Left office' tabel presiden") }, extra || {});
const HS = ["head_of_state", "head_of_government"], VP = ["deputy_head_of_state"];
const tenures = [
  T("president.1968-03-27", "suharto", HS, "President of Indonesia", "1968-03-27", "1998-05-21", "Golkar", { end_reason: "mengundurkan diri", notes: "Sebelumnya pejabat presiden 1967-03-12 s.d. 1968-03-27 (di luar cakupan 1991–2026)" }),
  T("president.1998-05-21", "bj_habibie", HS, "President of Indonesia", "1998-05-21", "1999-10-20", "Golkar", { end_reason: "tidak mencalonkan diri (pertanggungjawaban ditolak MPR)" }),
  T("president.1999-10-20", "abdurrahman_wahid", HS, "President of Indonesia", "1999-10-20", "2001-07-23", "PKB", { end_reason: "dimakzulkan MPR" }),
  T("president.2001-07-23", "megawati_sukarnoputri", HS, "President of Indonesia", "2001-07-23", "2004-10-20", "PDI-P"),
  T("president.2004-10-20", "susilo_bambang_yudhoyono", HS, "President of Indonesia", "2004-10-20", "2014-10-20", "Demokrat", { notes: "Dua periode (2004–2009, 2009–2014)" }),
  T("president.2014-10-20", "joko_widodo", HS, "President of Indonesia", "2014-10-20", "2024-10-20", "PDI-P", { notes: "Dua periode (2014–2019, 2019–2024)" }),
  T("president.2024-10-20", "prabowo_subianto", HS, "President of Indonesia", "2024-10-20", null, "Gerindra"),
  T("vp.1988-03-11", "sudharmono", VP, "Vice President of Indonesia", "1988-03-11", "1993-03-11", null),
  T("vp.1993-03-11", "try_sutrisno", VP, "Vice President of Indonesia", "1993-03-11", "1998-03-11", null),
  T("vp.1998-03-11", "bj_habibie", VP, "Vice President of Indonesia", "1998-03-11", "1998-05-21", null, { end_reason: "menjadi presiden" }),
  T("vp.1999-10-21", "megawati_sukarnoputri", VP, "Vice President of Indonesia", "1999-10-21", "2001-07-23", null, { end_reason: "menjadi presiden", verification: ver("partially_verified", "medium", S, "Tanggal mulai disimpulkan dari rentang 'Vacant (20–21 October 1999)' di tabel", {}) }),
  T("vp.2001-07-26", "hamzah_haz", VP, "Vice President of Indonesia", "2001-07-26", "2004-10-20", null, { verification: ver("partially_verified", "medium", S, "Tanggal mulai disimpulkan dari 'Vacant (23–26 July 2001)'") }),
  T("vp.2004-10-20", "jusuf_kalla", VP, "Vice President of Indonesia", "2004-10-20", "2009-10-20", null),
  T("vp.2009-10-20", "boediono", VP, "Vice President of Indonesia", "2009-10-20", "2014-10-20", null),
  T("vp.2014-10-20", "jusuf_kalla", VP, "Vice President of Indonesia", "2014-10-20", "2019-10-20", null, { notes: "Masa jabatan kedua Jusuf Kalla" }),
  T("vp.2019-10-20", "maruf_amin", VP, "Vice President of Indonesia", "2019-10-20", "2024-10-20", null),
  T("vp.2024-10-20", "gibran_rakabuming_raka", VP, "Vice President of Indonesia", "2024-10-20", null, null),
];
// koreksi: ten.* id harus unik per person+tanggal
const vacancies = [
  { country: "IDN", role: "deputy_head_of_state", start: "1998-05-21", end: "1999-10-21", reason: "Kursi wakil presiden kosong (kolom 'Vacant') selama masa jabatan Habibie dan hingga pemilihan Megawati", verification: ver("partially_verified", "medium", S) },
  { country: "IDN", role: "deputy_head_of_state", start: "2001-07-23", end: "2001-07-26", reason: "Kosong setelah Megawati menjadi presiden; Hamzah Haz terpilih 26 Juli 2001", verification: ver("partially_verified", "medium", S) },
];
write("leaders/IDN.json", { country: "IDN", scope: "Presiden & wakil presiden 1988–2026. Belum: menteri pertahanan/luar negeri/keuangan, panglima TNI, kepala staf, pemimpin partai.", persons, tenures, vacancies });

// ---------------- alutsista pilot ----------------
const mfrs = [
  { id: "mfr.pt_pindad", name: "PT Pindad", country: "IDN", notes: "BUMN pertahanan Indonesia, berkantor di Bandung", verification: ver("partially_verified", "medium", ["S-WP-PINDAD-SS2", "S-MILWIKI-SS1"]) },
  { id: "mfr.fn_herstal", name: "FN Herstal", country: "BEL", verification: ver("partially_verified", "medium", ["S-WP-FNC"]) },
  { id: "mfr.carl_gustafs", name: "Carl Gustafs Stads Gevärsfaktori", country: "SWE", notes: "Tercantum sebagai produsen FNC pada infobox", verification: ver("partially_verified", "low", ["S-WP-FNC"]) },
];
const V = (id, name, status, role, specs, sources, notes, yr) => ({ id, name, status, service_entry_year: yr ? yr.y : null, service_entry_basis: yr ? "variant_specific" : "unknown", role,
  specs: specs || {}, notes, verification: yr ? ver("partially_verified", "low", yr.src, "Tahun masuk dinas khusus varian") : ver("partially_verified", "medium", sources, "Tahun masuk dinas varian ini belum ditemukan; sengaja TIDAK disalin dari model dasar") });
const fnc = { id: "eq.infantry.fn_fnc", name: "FN FNC", category: "infantry_weapons", family: "FN FNC", design_country: "BEL", manufacturers: ["mfr.fn_herstal", "mfr.carl_gustafs", "mfr.pt_pindad"],
  derived_from: null, development_start_year: 1975, introduced_year: null, service_entry_year: null, retired_year: null, status: "operational", license: null, variants: [], operators: [], procurement: [],
  notes: "Infobox: dirancang 1975–1977, diproduksi 1979–2004; teks menyebut 'diperkenalkan pada akhir 1970-an'. Daftar operator belum dikumpulkan.", verification: ver("partially_verified", "medium", ["S-WP-FNC"], "Hanya sebagai akar keluarga untuk SS1/SS2") };
const ss1 = { id: "eq.infantry.pindad_ss1", name: "Pindad SS1", category: "infantry_weapons", family: "FN FNC", design_country: "IDN", manufacturers: ["mfr.pt_pindad"], derived_from: "eq.infantry.fn_fnc",
  development_start_year: null, introduced_year: 1991, service_entry_year: 1991, retired_year: null, status: "operational",
  license: { licensor: "mfr.fn_herstal", licensee: "mfr.pt_pindad", note: "Disebut sebagai model FN FNC berlisensi Indonesia" },
  variants: [
    V("eq.infantry.pindad_ss1.v1", "SS1-V1", "operational", "varian utama infanteri reguler", { barrel_mm: 449, mass_kg_no_mag: 4.01, caliber: "5.56x45mm NATO" }, ["S-MILWIKI-SS1", "S-WP-PINDAD-SS1"], "Laras standar, popor lipat"),
    V("eq.infantry.pindad_ss1.v2", "SS1-V2", "operational", "karaben", { barrel_mm: 363, mass_kg_no_mag: 3.91, caliber: "5.56x45mm NATO" }, ["S-MILWIKI-SS1"], "Laras pendek"),
    V("eq.infantry.pindad_ss1.v4", "SS1-V4", "operational", null, { barrel_mm: 449, caliber: "5.56x45mm NATO" }, ["S-MILWIKI-SS1"], "Disebut dalam daftar spesifikasi dan pembelian Laos 2014"),
    V("eq.infantry.pindad_ss1.v5", "SS1-V5", "operational", "kompak", { barrel_mm: 252, mass_kg_no_mag: 3.37, caliber: "5.56x45mm NATO" }, ["S-MILWIKI-SS1"], "Varian lain (R5, M1, M2, M5) ada tetapi hubungan dan statusnya belum dicatat"),
  ],
  operators: [
    { country: "IDN", since_year: 1991, until_year: null, basis: "in_service", notes: "Sedang digantikan SS2 sejak 2005 tetapi masih dipakai infanteri reguler (sumber lama)", verification: ver("partially_verified", "medium", ["S-WP-PINDAD-SS1", "S-MILWIKI-SS1"]) },
    { country: "ARE", since_year: 1992, until_year: null, basis: "received", notes: "'Diekspor pada 1992' (Military Wiki); belum ada konfirmasi jumlah/penggunaan", verification: ver("partially_verified", "low", ["S-MILWIKI-SS1"]) },
    { country: "KHM", since_year: null, until_year: null, basis: "received", notes: "Tercantum sebagai tujuan ekspor; tahun tidak diketahui", verification: ver("partially_verified", "low", ["S-MILWIKI-SS1"]) },
    { country: "NGA", since_year: null, until_year: null, basis: "received", notes: "Tercantum sebagai tujuan ekspor; tahun tidak diketahui", verification: ver("partially_verified", "low", ["S-MILWIKI-SS1"]) },
  ],
  procurement: [
    { country: "LAO", year: 2014, type: "purchase", quantity: 35, delivery: "unknown", variant: "eq.infantry.pindad_ss1.v2", notes: "Laos membeli 35 SS1-V2; pengiriman tidak dikonfirmasi — belum dihitung sebagai operator", verification: ver("partially_verified", "medium", ["S-WP-PINDAD-SS1"]) },
    { country: "LAO", year: 2014, type: "purchase", quantity: 35, delivery: "unknown", variant: "eq.infantry.pindad_ss1.v4", notes: "Laos membeli 35 SS1-V4", verification: ver("partially_verified", "medium", ["S-WP-PINDAD-SS1"]) },
  ],
  notes: "Infobox: dalam dinas 1991–sekarang.", verification: ver("partially_verified", "medium", ["S-WP-PINDAD-SS1", "S-MILWIKI-SS1"], "Dua sumber tersier; tidak ada sumber primer (Pindad/Kemhan)") };
const ss2 = { id: "eq.infantry.pindad_ss2", name: "Pindad SS2", category: "infantry_weapons", family: "FN FNC", design_country: "IDN", manufacturers: ["mfr.pt_pindad"], derived_from: "eq.infantry.pindad_ss1",
  development_start_year: null, introduced_year: 2005, service_entry_year: 2006, retired_year: null, status: "operational", license: null,
  variants: [
    V("eq.infantry.pindad_ss2.v1", "SS2-V1", "operational", "senapan standar", { barrel_mm: 460, caliber: "5.56x45mm NATO" }, ["S-WP-PINDAD-SS2", "S-IMFDB-SS2"]),
    V("eq.infantry.pindad_ss2.v2", "SS2-V2", "operational", "karaben", { barrel_mm: 403, caliber: "5.56x45mm NATO" }, ["S-WP-PINDAD-SS2"]),
    V("eq.infantry.pindad_ss2.v3", "SS2-V3", "prototype", null, {}, ["S-IMFDB-SS2"], "Disebut hanya ada sebagai prototipe — tidak dihitung sebagai operasional"),
    V("eq.infantry.pindad_ss2.v4", "SS2-V4", "operational", "para-sniper/DMR", { barrel_mm: 460, caliber: "5.56x45mm NATO" }, ["S-WP-PINDAD-SS2"]),
    V("eq.infantry.pindad_ss2.v5", "SS2-V5", "operational", "kompak", { barrel_mm: 252, caliber: "5.56x45mm NATO" }, ["S-IMFDB-SS2"], "Tahun 2008 dari IMFDB dan forum; keandalan rendah", { y: 2008, src: ["S-IMFDB-SS2"] }),
    V("eq.infantry.pindad_ss3", "SS3", "demonstrator", "marksman 7.62", { caliber: "7.62x51mm NATO" }, ["S-WP-PINDAD-SS2"], "Dipamerkan di Indo Defence 2016; status dinas BELUM diverifikasi"),
  ],
  operators: [{ country: "IDN", since_year: 2006, until_year: null, basis: "in_service", variants: [], notes: "Militer dan polisi; varian per unit belum dicatat", verification: ver("partially_verified", "medium", ["S-WP-PINDAD-SS2", "S-SANDBOXX-SS2"]) }],
  procurement: [],
  notes: "Diperkenalkan 2005 menggantikan SS1; masuk dinas 2006. Awal pengembangan hanya 'awal 2000-an' (tahun pasti tidak diketahui). Angka pesanan dari sumber berkeandalan rendah sengaja tidak dimasukkan.",
  verification: ver("partially_verified", "medium", ["S-WP-PINDAD-SS2", "S-SANDBOXX-SS2"], "Tidak ada sumber primer") };
write("equipment/small-arms-pilot.json", { shard: "small-arms-pilot", manufacturers: mfrs, models: [fnc, ss1, ss2] });
write("inventories/pilot.json", { note: "Belum ada jumlah inventaris yang terverifikasi pada checkpoint 1. Pesanan/tawaran TIDAK diperlakukan sebagai inventaris.", records: [] });
console.log("seed ok");
