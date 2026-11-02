#!/usr/bin/env node
// Event & pohon fokus. Event 'generic_gameplay' dan fokus generik = FICTIONAL_GAMEPLAY (buatan sendiri, bukan fakta sejarah).
// Event 'historical' hanya memuat fakta yang terbaca di sumber; konsekuensi/opsi tetap rancangan gameplay.
"use strict";
const fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "..", "..", "data/db"); const ACC = "2026-10-30";
const write = (rel, obj) => fs.writeFileSync(path.join(OUT, rel), JSON.stringify(obj, null, 1) + "\n");
const FICT = { status: "fictional_gameplay", confidence: "high", notes: "Konten permainan orisinal; bukan klaim historis" };
const HIST = (note) => ({ status: "partially_verified", confidence: "medium", sources: ["S-WP-PRES-IDN"], checked: ACC, notes: note });

// ---- event generik (fiksi gameplay) ----
const gen = (id, title, headline, body, mtth, conditions, options) => ({ id: "ev.gen." + id, title, classification: "generic_gameplay", category: "economy", date: null, countries: ["*"], factual_summary: null,
  headline, body, trigger: { mtth_days: mtth, conditions, once_per_country: false, scope: "all" }, options, historical_outcome: null, verification: FICT });
const events = [
  gen("commodity_boom", "Lonjakan harga komoditas", "HARGA KOMODITAS MELONJAK", "Permintaan ekspor naik tajam dan kas negara mendapat angin segar. Para penasihat berdebat: ditabung, atau dialihkan untuk pembangunan?", 900, [{ type: "min_gdp", value: 5 }],
    [{ id: "save", label: "Simpan sebagai cadangan kas", effects: [{ type: "add_treasury", pct_gdp: 1.5 }], ai_weight: 6, outcome: "gameplay" }, { id: "invest", label: "Investasikan ke jalan dan pelabuhan", effects: [{ type: "add_treasury", pct_gdp: 0.5 }, { type: "add_infra_capital", count: 1 }], ai_weight: 4, outcome: "gameplay" }]),
  gen("labor_strike", "Pemogokan buruh pabrik", "PEMOGOKAN MELUMPUHKAN KAWASAN INDUSTRI", "Serikat pekerja menuntut kenaikan upah. Produksi terganggu selama pembicaraan berlangsung.", 700, [{ type: "min_civ", value: 8 }],
    [{ id: "negotiate", label: "Berunding dan penuhi sebagian tuntutan", effects: [{ type: "add_treasury", pct_gdp: -0.3 }, { type: "add_stability", value: 2 }], ai_weight: 6, outcome: "gameplay" }, { id: "crack", label: "Bubarkan pemogokan", effects: [{ type: "add_stability", value: -5 }, { type: "mod_add", mod: "eff", pct: -3 }], ai_weight: 3, outcome: "gameplay" }]),
  gen("foreign_investment", "Tawaran investasi asing", "INVESTOR ASING TAWARKAN MODERNISASI PABRIK", "Konsorsium asing menawarkan teknologi produksi baru dengan imbalan akses pasar dan konsesi.", 1100, [{ type: "min_stability", value: 45 }],
    [{ id: "accept", label: "Terima kesepakatan", effects: [{ type: "mod_add", mod: "eff", pct: 5 }, { type: "add_stability", value: -1 }], ai_weight: 6, outcome: "gameplay" }, { id: "decline", label: "Tolak, utamakan kemandirian", effects: [{ type: "add_stability", value: 1 }], ai_weight: 4, outcome: "gameplay" }]),
  gen("depot_accident", "Kecelakaan gudang amunisi", "LEDAKAN DI DEPOT MILITER", "Ledakan di gudang amunisi menimbulkan korban dan memicu desakan penyelidikan.", 1400, [{ type: "min_divisions", value: 3 }],
    [{ id: "investigate", label: "Penyelidikan terbuka dan ganti rugi", effects: [{ type: "add_treasury", pct_gdp: -0.2 }, { type: "add_stability", value: 1 }], ai_weight: 6, outcome: "gameplay" }, { id: "coverup", label: "Tutup rapat kasusnya", effects: [{ type: "add_stability", value: -3 }, { type: "add_stock", equip: "artillery", amount: -20 }], ai_weight: 2, outcome: "gameplay" }]),
  gen("regional_summit", "Konferensi regional", "PARA PEMIMPIN BERKUMPUL DALAM KTT REGIONAL", "Negara-negara tetangga mengundangmu untuk membahas keamanan dan perdagangan kawasan.", 800, [{ type: "at_peace" }],
    [{ id: "engage", label: "Hadir dan dorong kerja sama", effects: [{ type: "add_opinion_neighbors", value: 10 }], ai_weight: 7, outcome: "gameplay" }, { id: "skip", label: "Kirim utusan tingkat rendah", effects: [{ type: "add_stability", value: 1 }], ai_weight: 3, outcome: "gameplay" }]),
  gen("earthquake", "Gempa bumi", "GEMPA GUNCANG WILAYAH PEDALAMAN", "Gempa kuat merusak jalan dan jembatan di salah satu provinsi.", 1600, [],
    [{ id: "relief", label: "Dana tanggap darurat besar-besaran", effects: [{ type: "damage_infra", amount: 1 }, { type: "add_treasury", pct_gdp: -0.4 }, { type: "add_stability", value: 2 }], ai_weight: 6, outcome: "gameplay" }, { id: "minimal", label: "Bantuan seperlunya", effects: [{ type: "damage_infra", amount: 2 }, { type: "add_stability", value: -2 }], ai_weight: 4, outcome: "gameplay" }]),
];
write("events/generic.json", { shard: "generic", events });

// ---- event historis Indonesia (fakta dari S-WP-PRES-IDN; opsi = rancangan gameplay) ----
const hist = (id, title, date, prec, summary, headline, body, opts, histOpt) => ({ id: "ev.idn." + id, title, classification: "historical", category: "politics", date: { date, precision: prec }, countries: ["IDN"],
  factual_summary: summary, headline, body, trigger: { fire_on_date: date, once_per_country: true, scope: "player" }, options: opts, historical_outcome: histOpt, verification: HIST("Fakta dari tabel/ulasan masa jabatan; opsi pemain adalah rancangan gameplay") });
const H = [
  hist("1998.suharto_resigns", "Suharto mengundurkan diri", "1998-05-21", "day",
    "Suharto mengundurkan diri sebagai presiden pada 21 Mei 1998 setelah keruntuhan ekonomi akibat krisis finansial 1997 dan kerusuhan 1998; B. J. Habibie menggantikannya.", "SUHARTO MUNDUR; HABIBIE DILANTIK", "Setelah tiga dekade berkuasa, presiden mengundurkan diri di tengah krisis ekonomi dan kerusuhan.",
    [{ id: "habibie", label: "Serahkan kekuasaan kepada wakil presiden (historis)", effects: [{ type: "add_stability", value: -5 }, { type: "set_flag", flag: "idn_1998_transition" }], ai_weight: 10, outcome: "historical" }], "habibie"),
  hist("2001.wahid_removed", "Abdurrahman Wahid dimakzulkan", "2001-07-23", "day",
    "Abdurrahman Wahid dimakzulkan dan diberhentikan oleh parlemen (MPR); Wakil Presiden Megawati Sukarnoputri menggantikannya pada 23 Juli 2001.", "MPR BERHENTIKAN PRESIDEN; MEGAWATI NAIK", "Parlemen memakzulkan presiden dan wakilnya mengambil alih jabatan.",
    [{ id: "accept", label: "Terima keputusan parlemen (historis)", effects: [{ type: "add_stability", value: -3 }], ai_weight: 10, outcome: "historical" }], "accept"),
  hist("2002.bali_bombing", "Pengeboman Bali", "2002-01-01", "year",
    "Sebuah pengeboman besar menyerang Bali pada 2002, dilakukan oleh Jemaah Islamiyah (tanggal pasti tidak ada di sumber yang dibaca).", "BOM GUNCANG BALI", "Serangan teror besar menimbulkan korban dan kepanikan.",
    [{ id: "crackdown", label: "Perkuat kontra-terorisme (historis: pasukan khusus Detasemen 88 dibentuk)", effects: [{ type: "add_treasury", pct_gdp: -0.3 }, { type: "add_stability", value: 2 }], ai_weight: 10, outcome: "historical" }], "crackdown"),
  hist("2004.direct_election", "Pemilihan presiden langsung pertama", "2004-01-01", "year",
    "Sejak 2004 presiden dan wakil presiden dipilih langsung untuk masa jabatan lima tahun; Susilo Bambang Yudhoyono menjadi presiden terpilih langsung pertama (dilantik 20 Oktober 2004).", "RAKYAT PILIH PRESIDEN SECARA LANGSUNG", "Untuk pertama kalinya pemilih menentukan presiden secara langsung.",
    [{ id: "direct", label: "Selenggarakan pemilihan langsung (historis)", effects: [{ type: "add_stability", value: 4 }], ai_weight: 10, outcome: "historical" }], "direct"),
  hist("2024.prabowo_inaugurated", "Pelantikan Prabowo Subianto", "2024-10-20", "day",
    "Prabowo Subianto dilantik sebagai presiden pada 20 Oktober 2024 bersama Wakil Presiden Gibran Rakabuming Raka.", "PRABOWO DILANTIK SEBAGAI PRESIDEN", "Pelantikan presiden baru menandai pergantian kepemimpinan.",
    [{ id: "inaugurate", label: "Lantik presiden terpilih (historis)", effects: [{ type: "add_stability", value: 1 }], ai_weight: 10, outcome: "historical" }], "inaugurate"),
];
write("events/indonesia-historical.json", { shard: "indonesia-historical", events: H });

// ---- pohon fokus generik ----
const F = (id, branch, x, y, days, icon, title, desc, o) => Object.assign({ id: "foc.gen." + id, branch, x, y, days, icon, title, desc, prerequisites: [], any_of: [], exclusive: [], available: [], effects: [], ai_weight: 10, classification: "generic" }, o);
const pre = (...a) => a.map((x) => "foc.gen." + x);
const focuses = [
  F("national_unity", "politics", 0, 0, 35, "flag", "Persatuan Nasional", "Kampanye persatuan untuk menenangkan situasi dalam negeri.", { effects: [{ type: "add_stability", value: 5 }], ai_weight: 14 }),
  F("administrative_reform", "politics", 0, 1, 50, "gear", "Reformasi Administrasi", "Birokrasi lebih efisien meningkatkan penerimaan pajak.", { prerequisites: pre("national_unity"), effects: [{ type: "mod_add", mod: "income", pct: 5 }], ai_weight: 10 }),
  F("open_governance", "politics", -1, 2, 45, "scale", "Pemerintahan Terbuka", "Transparansi menambah kepercayaan publik. Tidak bisa digabung dengan negara tersentralisasi.", { prerequisites: pre("administrative_reform"), exclusive: pre("centralized_state"), effects: [{ type: "add_stability", value: 3 }, { type: "mod_add", mod: "income", pct: 3 }] }),
  F("centralized_state", "politics", 1, 2, 45, "tower", "Negara Tersentralisasi", "Keputusan terpusat mempercepat proyek, dengan harga stabilitas.", { prerequisites: pre("administrative_reform"), exclusive: pre("open_governance"), effects: [{ type: "mod_add", mod: "constr", pct: 10 }, { type: "add_stability", value: -3 }] }),
  F("fiscal_discipline", "economy", 3, 0, 40, "coins", "Disiplin Fiskal", "Kas negara diperkuat dengan pengetatan anggaran.", { effects: [{ type: "add_treasury", pct_gdp: 1.0 }], ai_weight: 12 }),
  F("trade_expansion", "economy", 3, 1, 60, "trade", "Perluasan Perdagangan", "Pertumbuhan ekonomi meningkat.", { prerequisites: pre("fiscal_discipline"), effects: [{ type: "add_growth_pct", value: 1 }] }),
  F("resource_exploitation", "economy", 4, 1, 55, "ore", "Eksploitasi Sumber Daya", "Pasokan bahan baku ditambah (setara 30 hari produksi).", { prerequisites: pre("fiscal_discipline"), effects: [{ type: "add_resource", res: "steel", days: 30 }, { type: "add_resource", res: "coal", days: 30 }, { type: "add_resource", res: "aluminum", days: 30 }] }),
  F("civil_industry", "industry", 6, 0, 60, "factory", "Industri Sipil", "Dua pabrik sipil baru dibangun di provinsi terbaik.", { effects: [{ type: "grant_factory", building: "civ", count: 2 }], ai_weight: 15 }),
  F("military_industry", "industry", 6, 1, 60, "gear", "Industri Militer", "Satu pabrik militer baru.", { prerequisites: pre("civil_industry"), effects: [{ type: "grant_factory", building: "mil", count: 1 }], ai_weight: 12 }),
  F("production_lines", "industry", 7, 1, 50, "crate", "Lini Produksi Efisien", "Efisiensi produksi +10%.", { prerequisites: pre("civil_industry"), effects: [{ type: "mod_add", mod: "eff", pct: 10 }] }),
  F("mass_production", "industry", 7, 2, 70, "crate", "Produksi Massal", "Efisiensi produksi +10% lagi.", { prerequisites: pre("production_lines", "military_industry"), effects: [{ type: "mod_add", mod: "eff", pct: 10 }] }),
  F("road_network", "infrastructure", 9, 0, 55, "road", "Jaringan Jalan", "Infrastruktur +1 di ibu kota dan tiga provinsi terpadat.", { effects: [{ type: "add_infra_capital", count: 4 }], ai_weight: 11 }),
  F("construction_codes", "infrastructure", 9, 1, 40, "crane", "Standar Konstruksi", "Kecepatan konstruksi +15%.", { prerequisites: pre("road_network"), effects: [{ type: "mod_add", mod: "constr", pct: 15 }] }),
  F("regional_hubs", "infrastructure", 10, 1, 60, "road", "Pusat Logistik Regional", "Infrastruktur +1 di tiga provinsi lagi.", { prerequisites: pre("road_network"), effects: [{ type: "add_infra_capital", count: 3 }] }),
  F("regional_diplomacy", "diplomacy", 12, 0, 35, "handshake", "Diplomasi Regional", "Opini negara tetangga +15.", { effects: [{ type: "add_opinion_neighbors", value: 15 }], ai_weight: 8 }),
  F("trade_partners", "diplomacy", 12, 1, 45, "handshake", "Mitra Dagang", "Opini tetangga +10 dan kas bertambah.", { prerequisites: pre("regional_diplomacy"), effects: [{ type: "add_opinion_neighbors", value: 10 }, { type: "add_treasury", pct_gdp: 0.5 }] }),
  F("neutrality_doctrine", "diplomacy", 11, 2, 40, "dove", "Doktrin Netralitas", "Stabilitas +3, tetapi menutup jalur aliansi militer.", { prerequisites: pre("regional_diplomacy"), exclusive: pre("alliance_doctrine"), effects: [{ type: "add_stability", value: 3 }] }),
  F("alliance_doctrine", "diplomacy", 13, 2, 40, "shield", "Doktrin Aliansi", "Opini tetangga +20; pertahanan lebih kokoh.", { prerequisites: pre("regional_diplomacy"), exclusive: pre("neutrality_doctrine"), effects: [{ type: "add_opinion_neighbors", value: 20 }, { type: "mod_add", mod: "def", pct: 3 }] }),
  F("conscription_drive", "military", 15, 0, 40, "soldier", "Kampanye Wajib Militer", "Pool manpower +10%.", { available: [{ type: "min_stability", value: 35 }], effects: [{ type: "add_manpower_pct", value: 10 }], ai_weight: 10 }),
  F("equipment_stockpile", "military", 15, 1, 50, "crate", "Penimbunan Peralatan", "Tambahan 3.000 senapan dan 60 artileri dari gudang cadangan.", { prerequisites: pre("conscription_drive"), effects: [{ type: "add_stock", equip: "rifles", amount: 3000 }, { type: "add_stock", equip: "artillery", amount: 60 }] }),
  F("infantry_doctrine", "military", 14, 2, 50, "target", "Doktrin Infanteri Bertahan", "Pertahanan divisi +10%.", { prerequisites: pre("equipment_stockpile"), exclusive: pre("armored_doctrine"), effects: [{ type: "mod_add", mod: "def", pct: 10 }] }),
  F("armored_doctrine", "military", 16, 2, 50, "tank", "Doktrin Lapis Baja", "Serangan divisi +10%.", { prerequisites: pre("equipment_stockpile"), exclusive: pre("infantry_doctrine"), effects: [{ type: "mod_add", mod: "atk", pct: 10 }] }),
  F("war_readiness", "military", 15, 3, 45, "shield", "Kesiapan Perang", "Serangan dan pertahanan +5%, kelelahan perang −5.", { any_of: [pre("infantry_doctrine", "armored_doctrine")], effects: [{ type: "mod_add", mod: "atk", pct: 5 }, { type: "mod_add", mod: "def", pct: 5 }, { type: "add_exhaustion", value: -5 }] }),
  F("total_mobilization", "military", 15, 4, 60, "soldier", "Mobilisasi Total", "Hanya saat perang: manpower +20%, efisiensi +10%, stabilitas −5.", { prerequisites: pre("war_readiness"), available: [{ type: "at_war" }], effects: [{ type: "add_manpower_pct", value: 20 }, { type: "mod_add", mod: "eff", pct: 10 }, { type: "add_stability", value: -5 }], ai_weight: 20 }),
];
write("focus/generic.json", { trees: [{ id: "tree.generic", kind: "generic", country: null, verification: FICT,
  branches: [{ id: "politics", title: "Politik" }, { id: "economy", title: "Ekonomi" }, { id: "industry", title: "Industri" }, { id: "infrastructure", title: "Infrastruktur" }, { id: "diplomacy", title: "Diplomasi" }, { id: "military", title: "Militer" }], focuses }] });
console.log("events+focus ok:", events.length + H.length, "events,", focuses.length, "focuses");
