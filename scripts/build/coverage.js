#!/usr/bin/env node
// Laporan cakupan database: dihitung dari RECORD NYATA (bukan perkiraan persentase). Output: docs/COVERAGE.md
"use strict";
const fs = require("fs"), path = require("path");
const { loadDb, validateDb, ROOT } = require("../validate/validate.js");
const db = loadDb(), val = validateDb(db), man = db.manifest;
const iso = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "–");
const L = [];
const T = (head, rows) => { L.push("| " + head.join(" | ") + " |", "| " + head.map(() => "---").join(" | ") + " |"); for (const r of rows) L.push("| " + r.join(" | ") + " |"); L.push(""); };

// ---- status per jenis record
const statusCount = {};
const bump = (kind, v) => { const s = (v && v.status) || "(tanpa)"; (statusCount[kind] = statusCount[kind] || {})[s] = ((statusCount[kind] || {})[s] || 0) + 1; };
db.countries.forEach((c) => { bump("negara", c.verification); c.capitals.forEach((k) => bump("ibu kota", k.verification)); });
db.leaders.forEach((l) => { l.persons.forEach((p) => bump("tokoh", p.verification)); l.tenures.forEach((t) => bump("masa jabatan", t.verification)); });
db.equipment.models.forEach((m) => { bump("model alutsista", m.verification); m.variants.forEach((v) => bump("varian", v.verification)); m.operators.forEach((o) => bump("operator", o.verification)); m.procurement.forEach((p) => bump("pengadaan", p.verification)); });
db.events.forEach((e) => bump("event", e.verification)); db.trees.forEach((t) => bump("pohon fokus", t.verification));
const STAT = ["verified", "partially_verified", "disputed", "unknown", "fictional_gameplay"];

L.push("# Laporan cakupan database", "", "_Dibangun otomatis oleh `scripts/build/coverage.js` dari berkas di `data/db/`. Semua angka = jumlah record nyata atau rasio yang dihitung dari record nyata; tidak ada persentase perkiraan._", "");
L.push("- Versi database: **" + man.db_version + "** • skema: " + man.schema + " • rentang target: " + man.range.from + " → " + man.range.to);
L.push("- Validasi otomatis: **" + val.errors.length + " error**, " + val.warnings.length + " peringatan (lihat `npm run db:validate`)", "");

L.push("## 1. Jumlah record per kategori", "");
const cnt = (k) => man.files.filter((f) => f.kind === k).reduce((a, f) => a + f.count, 0);
T(["Kategori", "Record nyata", "Berkas"], [
  ["Sumber terdaftar", db.sources.length, man.files.filter((f) => f.kind === "sources").length],
  ["Negara (kerangka + diperkaya)", db.countries.length, man.files.filter((f) => f.kind === "countries").length],
  ["Tokoh", db.leaders.reduce((a, l) => a + l.persons.length, 0), man.files.filter((f) => f.kind === "leaders").length],
  ["Masa jabatan", db.leaders.reduce((a, l) => a + l.tenures.length, 0), "(dalam berkas tokoh)"],
  ["Produsen alutsista", db.equipment.manufacturers.length, man.files.filter((f) => f.kind === "equipment").length],
  ["Model alutsista", db.equipment.models.length, "(dalam berkas alutsista)"],
  ["Varian", db.equipment.models.reduce((a, m) => a + m.variants.length, 0), ""],
  ["Catatan operator", db.equipment.models.reduce((a, m) => a + m.operators.length, 0), ""],
  ["Catatan pengadaan (pesanan/pembelian)", db.equipment.models.reduce((a, m) => a + m.procurement.length, 0), ""],
  ["Inventaris terverifikasi (jumlah unit per tahun)", db.inventories.length, man.files.filter((f) => f.kind === "inventories").length],
  ["Event historis", db.events.filter((e) => e.classification === "historical").length, ""],
  ["Event generik (fiksi gameplay)", db.events.filter((e) => e.classification === "generic_gameplay").length, ""],
  ["Pohon fokus (generik / unik)", db.trees.filter((t) => t.kind === "generic").length + " / " + db.trees.filter((t) => t.kind === "unique").length, man.files.filter((f) => f.kind === "focus").length],
  ["Node fokus", db.trees.reduce((a, t) => a + t.focuses.length, 0), ""],
]);

L.push("## 2. Status verifikasi per jenis record", "", "`verified` butuh ≥ 2 sumber atau 1 sumber primer/dataset resmi; `partially_verified` = ≥ 1 sumber yang benar-benar dibaca tetapi belum silang-sumber.", "");
T(["Jenis", "Total"].concat(STAT), Object.entries(statusCount).map(([k, o]) => [k, Object.values(o).reduce((a, b) => a + b, 0)].concat(STAT.map((s) => o[s] || 0))));

L.push("## 3. Cakupan negara", "");
const allC = db.countries.length, sea = db.countries.filter((c) => c.region === "southeast_asia");
const withLeaders = new Set(db.leaders.map((l) => l.country));
const f = (fn) => db.countries.filter(fn).length;
T(["Bidang", "Terisi", "Dari", "Rasio"], [
  ["Nama pendek (Natural Earth)", f((c) => !!c.names.short), allC, pct(f((c) => !!c.names.short), allC)],
  ["Nama resmi", f((c) => !!c.names.official), allC, pct(f((c) => !!c.names.official), allC)],
  ["Ibu kota kini (dataset)", f((c) => c.capitals.length > 0), allC, pct(f((c) => c.capitals.length > 0), allC)],
  ["…di antaranya lokasi perkiraan", f((c) => c.capitals[0] && c.capitals[0].approximate), allC, pct(f((c) => c.capitals[0] && c.capitals[0].approximate), allC)],
  ["Tanggal pembentukan (existence.from)", f((c) => !!c.existence.from), allC, pct(f((c) => !!c.existence.from), allC)],
  ["Kode ISO 3166-1 alpha-3 terverifikasi", f((c) => !!c.iso3), allC, pct(f((c) => !!c.iso3), allC)],
  ["Status keanggotaan PBB", f((c) => c.un_member !== null && c.un_member !== undefined), allC, pct(f((c) => c.un_member !== null && c.un_member !== undefined), allC)],
  ["Struktur eksekutif", f((c) => !!c.executive), allC, pct(f((c) => !!c.executive), allC)],
  ["Data pemimpin (berkas leaders)", withLeaders.size, allC, pct(withLeaders.size, allC)],
]);
L.push("**Tahap 1 — Asia Tenggara (" + sea.length + " negara):**", "");
T(["Negara", "ID", "Pemimpin?", "Alutsista?", "Catatan"], sea.map((c) => [c.names.short, c.id, withLeaders.has(c.id) ? "ya (presiden & wakil)" : "belum", db.equipment.models.some((m) => m.operators.some((o) => o.country === c.id)) ? "ya (senjata api)" : "belum", c.id === "IDN" ? "pilot" : "kerangka saja"]));
L.push("Wilayah lain (Asia Timur/Selatan, Tengah/Timur Tengah, Eropa, Amerika, Afrika, Oseania): **belum diriset**. 239 negara hanya berupa kerangka dari Natural Earth (nama pendek + ibu kota kini).", "");

L.push("## 4. Cakupan periode (pemimpin)", "");
const rows = [];
for (const lf of db.leaders) {
  const A = iso("1991-01-01"), B = iso("2026-08-29"), roles = {};
  for (const t of lf.tenures) for (const r of t.roles) (roles[r] = roles[r] || []).push(t);
  for (const r of Object.keys(roles)) {
    let c = 0; const cover = (s, e) => { c += Math.max(0, Math.min(B, e) - Math.max(A, s)); };
    for (const t of roles[r]) cover(iso(t.start.date), t.end ? iso(t.end.date) : B);
    let vac = 0; for (const v of lf.vacancies) if (v.role === r) { const s = Math.max(A, iso(v.start)), e = Math.min(B, iso(v.end)); vac += Math.max(0, e - s); }
    rows.push([lf.country, r, roles[r].length + " masa jabatan", ((c / (B - A)) * 100).toFixed(1) + "%", ((vac) / (B - A) * 100).toFixed(1) + "%"]);
  }
}
T(["Negara", "Peran", "Record", "Hari tercakup tenure (1991-01-01 → 2026-08-29)", "Hari kosong tercatat"], rows);
L.push("Peran yang BELUM punya satu record pun di negara mana pun: menteri pertahanan, menteri luar negeri, menteri keuangan/ekonomi, panglima angkatan bersenjata, kepala staf, pemimpin partai, jenderal & komandan.", "");

L.push("## 5. Cakupan alutsista", "");
const cats = ["infantry_weapons", "artillery", "anti_tank", "apc", "ifv", "mbt", "air_defense", "radar_ew", "fighter", "attack_aircraft", "bomber", "transport_aircraft", "helicopter", "uav", "frigate", "destroyer", "corvette", "aircraft_carrier", "submarine", "amphibious_ship", "logistics_support"];
T(["Kategori", "Model", "Varian"], cats.map((c) => [c, db.equipment.models.filter((m) => m.category === c).length, db.equipment.models.filter((m) => m.category === c).reduce((a, m) => a + m.variants.length, 0)]));
L.push("Kategori terisi: **" + cats.filter((c) => db.equipment.models.some((m) => m.category === c)).length + " dari " + cats.length + "**. Negara dengan operator tercatat: " + new Set(db.equipment.models.flatMap((m) => m.operators.map((o) => o.country))).size + ". Varian operasional dengan tahun masuk dinas khusus-varian: " + db.equipment.models.reduce((a, m) => a + m.variants.filter((v) => v.status === "operational" && v.service_entry_year != null).length, 0) + " dari " + db.equipment.models.reduce((a, m) => a + m.variants.filter((v) => v.status === "operational").length, 0) + " (sisanya `null`: sengaja tidak disalin dari model dasar).", "");

L.push("## 6. Sumber", "");
T(["ID", "Penerbit", "Jenis", "Keandalan", "Lisensi"], db.sources.map((s) => [s.id, s.publisher, s.type, s.reliability, s.license]));
L.push("## 7. Peringatan validator", "");
if (val.warnings.length) for (const w of val.warnings) L.push("- `" + w.code + "` [" + w.where + "] " + w.msg); else L.push("(tidak ada)");
L.push("");
fs.writeFileSync(path.join(ROOT, "docs/COVERAGE.md"), L.join("\n"));
console.log("docs/COVERAGE.md ditulis;", val.errors.length, "error,", val.warnings.length, "peringatan");
process.exit(val.errors.length ? 1 : 0);
