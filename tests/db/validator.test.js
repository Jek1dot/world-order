// Membuktikan validator menangkap kesalahan riset yang sudah pernah terjadi (Part 6 prompt).
const { loadDb, validateDb } = require("../../scripts/validate/validate.js");
let fails = 0, n = 0;
const check = (name, cond, extra) => { n++; if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  -> " + extra : "")); };
const base = loadDb();
const clone = () => { const d = loadDb(); return d; };
const codes = (db) => { const r = validateDb(db); return { errs: r.errors.map((e) => e.code), warns: r.warnings.map((w) => w.code), r }; };
const expect = (name, mutate, code, kind) => { const db = clone(); mutate(db); const c = codes(db); const list = kind === "warn" ? c.warns : c.errs; check(name, list.includes(code), code + (list.includes(code) ? "" : " tidak muncul; ada: " + [...new Set(list)].join(",")));  };

check("data nyata: 0 error validasi", codes(base).errs.length === 0, codes(base).r.errors.map((e) => e.code + " " + e.where).join("; "));
const idn = (db) => db.leaders.find((l) => l.country === "IDN");
const ten = (db, id) => idn(db).tenures.find((t) => t.id === id);
const mod = (db, id) => db.equipment.models.find((m) => m.id === id);

// pemimpin
expect("masa jabatan berakhir tapi end=null tanpa ongoing_as_of", (db) => { const t = ten(db, "ten.IDN.president.1998-05-21"); t.end = null; }, "DB-E007");
expect("end=null padahal ada penerus (jangan null untuk masa jabatan yang sudah berakhir)", (db) => { const t = ten(db, "ten.IDN.president.1998-05-21"); t.end = null; t.ongoing_as_of = "2026-01-01"; }, "DB-E008");
expect("masa jabatan presiden tumpang tindih", (db) => { ten(db, "ten.IDN.president.1998-05-21").end.date = "2000-01-01"; }, "DB-E006");
expect("akhir sebelum awal", (db) => { ten(db, "ten.IDN.president.1998-05-21").end.date = "1998-01-01"; }, "DB-E005");
expect("menjabat sebelum lahir", (db) => { ten(db, "ten.IDN.president.2024-10-20").start.date = "1940-01-01"; }, "DB-E030");
expect("menjabat setelah wafat", (db) => { ten(db, "ten.IDN.president.1998-05-21").start.date = "2019-10-01"; ten(db, "ten.IDN.president.1998-05-21").end.date = "2019-11-01"; }, "DB-E030");
expect("tokoh tidak ada", (db) => { ten(db, "ten.IDN.president.2024-10-20").person = "person.tidak_ada"; }, "DB-E004");
expect("tanggal tidak valid (30 Februari)", (db) => { ten(db, "ten.IDN.president.2014-10-20").start.date = "2014-02-30"; }, "DB-E040");
expect("celah masa jabatan tanpa catatan vacancy -> peringatan", (db) => { idn(db).vacancies.length = 0; }, "DB-W001", "warn");
expect("menjabat sebelum negara ada", (db) => { db.countries.find((c) => c.id === "IDN").existence.from = "2000-01-01"; }, "DB-E032");
{ const jk = idn(base).tenures.filter((t) => t.person === "person.jusuf_kalla"); check("Jusuf Kalla punya 2 masa jabatan terpisah", jk.length === 2); }
// status & sumber
expect("'verified' hanya dengan 1 sumber tersier", (db) => { ten(db, "ten.IDN.president.2024-10-20").verification.status = "verified"; }, "DB-E009");
expect("sumber tidak terdaftar", (db) => { ten(db, "ten.IDN.president.2024-10-20").verification.sources = ["S-TIDAK-ADA"]; }, "DB-E002");
expect("partially_verified tanpa sumber", (db) => { delete ten(db, "ten.IDN.president.2024-10-20").verification.sources; }, "DB-E010");
expect("status unknown tanpa alasan", (db) => { db.countries[0].verification = { status: "unknown", confidence: "low" }; }, "DB-E011");
expect("klaim terverifikasi tanpa tanggal pengecekan", (db) => { delete ten(db, "ten.IDN.president.2024-10-20").verification.checked; }, "DB-E013");
expect("ID ganda", (db) => { db.sources.push(Object.assign({}, db.sources[0])); }, "DB-E001");
expect("properti tak dikenal ditolak skema (cegah typo)", (db) => { const f = db.files["leaders/IDN.json"].obj; f.tenures[0].partai_salah = "x"; }, "DB-SCHEMA");
// alutsista
expect("prototipe/demonstrator tidak boleh punya operator", (db) => { const m = mod(db, "eq.infantry.pindad_ss2"); m.status = "demonstrator"; }, "DB-E022");
expect("tahun masuk dinas model dasar disalin ke varian", (db) => { const v = mod(db, "eq.infantry.pindad_ss1").variants[0]; v.service_entry_year = 1991; }, "DB-E020");
expect("varian masuk dinas sebelum model dasar", (db) => { const v = mod(db, "eq.infantry.pindad_ss1").variants[0]; v.service_entry_year = 1980; v.service_entry_basis = "variant_specific"; }, "DB-E023");
expect("operator sebelum model masuk dinas", (db) => { mod(db, "eq.infantry.pindad_ss2").operators[0].since_year = 2001; }, "DB-E023");
expect("pensiun sebelum masuk dinas", (db) => { const m = mod(db, "eq.infantry.pindad_ss2"); m.retired_year = 2000; }, "DB-E024");
expect("tawaran ekspor tidak boleh berstatus delivered", (db) => { const p = mod(db, "eq.infantry.pindad_ss1").procurement[0]; p.type = "offer"; p.delivery = "delivered"; }, "DB-E026");
expect("inventaris negara yang bukan operator (menyimpulkan kepemilikan dari pesanan)", (db) => { db.inventories.push({ id: "inv.x", item: "eq.infantry.pindad_ss1", country: "LAO", year: 2015, count: 70, basis: "delivered_total", verification: { status: "partially_verified", confidence: "low", sources: ["S-WP-PINDAD-SS1"], checked: "2026-10-30" } }); }, "DB-E025");
expect("inventaris sebelum masuk dinas", (db) => { db.inventories.push({ id: "inv.y", item: "eq.infantry.pindad_ss2", country: "IDN", year: 2000, count: 10, basis: "in_service_count", verification: { status: "partially_verified", confidence: "low", sources: ["S-WP-PINDAD-SS2"], checked: "2026-10-30" } }); }, "DB-E025");
expect("inventaris tanpa sumber", (db) => { db.inventories.push({ id: "inv.z", item: "eq.infantry.pindad_ss2", country: "IDN", year: 2010, count: 10, basis: "in_service_count", verification: { status: "fictional_gameplay", confidence: "low" } }); }, "DB-E010");
expect("negara desain tidak ada", (db) => { mod(db, "eq.infantry.pindad_ss2").design_country = "ZZZ"; }, "DB-E003");
// event
expect("event historis tanpa tanggal", (db) => { db.events.find((e) => e.classification === "historical").date = null; }, "DB-E042");
expect("alternate history disajikan sebagai fakta", (db) => { const e = db.events.find((e) => e.classification === "generic_gameplay"); e.classification = "alternate_history"; e.verification = { status: "verified", confidence: "high", sources: ["S-NE-ADMIN1"], checked: "2026-10-30" }; }, "DB-E042");
expect("historical_outcome tidak merujuk opsi", (db) => { db.events.find((e) => e.classification === "historical").historical_outcome = "tidak_ada"; }, "DB-E042");
expect("efek tak dikenal pada event", (db) => { db.events[0].options[0].effects.push({ type: "spawn_nukes" }); }, "DB-E041");
// focus tree
const tree = (db) => db.trees[0];
expect("fokus: prasyarat tidak ada", (db) => { tree(db).focuses[1].prerequisites = ["foc.gen.hantu"]; }, "DB-E050");
expect("fokus: exclusive tidak simetris", (db) => { const f = tree(db).focuses.find((f) => f.id === "foc.gen.open_governance"); f.exclusive = []; }, "DB-E051");
expect("fokus: siklus prasyarat", (db) => { const t = tree(db); t.focuses.find((f) => f.id === "foc.gen.national_unity").prerequisites = ["foc.gen.administrative_reform"]; }, "DB-E052");
expect("fokus: posisi ganda", (db) => { const t = tree(db); t.focuses[1].x = t.focuses[0].x; t.focuses[1].y = t.focuses[0].y; }, "DB-E050");
expect("fokus: efek tak dikenal", (db) => { tree(db).focuses[0].effects.push({ type: "win_game" }); }, "DB-E041");
console.log("\n" + (fails ? fails + " DARI " + n + " GAGAL" : "SEMUA " + n + " PENGECEKAN VALIDATOR LOLOS"));
process.exit(fails ? 1 : 0);
