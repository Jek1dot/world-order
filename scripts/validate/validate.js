#!/usr/bin/env node
// Validator database World Order: skema (ajv) + aturan semantik. Pemakaian:
//   node scripts/validate/validate.js            -> validasi data/db, cetak laporan, exit 1 bila ada error
// API: loadDb(root), validateDb(db) -> { errors, warnings, stats }
"use strict";
const fs = require("fs"), path = require("path");
const Ajv = require("ajv"), addFormats = require("ajv-formats");
const ROOT = path.join(__dirname, "..", "..");
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas/world-order-db.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv); ajv.addSchema(SCHEMA);
const check = (def) => ajv.getSchema("wo-db#/$defs/" + def);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
function loadDb(root) {
  const base = path.join(root || ROOT, "data/db");
  const manifest = readJson(path.join(base, "manifest.json"));
  const db = { manifest, vocab: readJson(path.join(base, "vocab.json")), files: {}, sources: [], countries: [], leaders: [], equipment: { manufacturers: [], models: [] }, inventories: [], events: [], trees: [] };
  for (const f of manifest.files) {
    const obj = readJson(path.join(base, f.path)); db.files[f.path] = { kind: f.kind, obj };
    if (f.kind === "sources") db.sources.push(...obj.sources);
    else if (f.kind === "countries") db.countries.push(...obj.countries);
    else if (f.kind === "leaders") db.leaders.push(obj);
    else if (f.kind === "equipment") { db.equipment.manufacturers.push(...(obj.manufacturers || [])); db.equipment.models.push(...obj.models); }
    else if (f.kind === "inventories") db.inventories.push(...obj.records);
    else if (f.kind === "events") db.events.push(...obj.events);
    else if (f.kind === "focus") db.trees.push(...obj.trees);
  }
  return db;
}

const KIND_DEF = { sources: "SourcesFile", countries: "CountriesFile", leaders: "LeadersFile", equipment: "EquipmentFile", inventories: "InventoriesFile", events: "EventsFile", focus: "FocusFile" };
const dayNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

function validateDb(db) {
  const errors = [], warnings = [];
  const E = (code, where, msg) => errors.push({ code, where, msg });
  const Wn = (code, where, msg) => warnings.push({ code, where, msg });

  // 1. skema per berkas
  for (const [p, { kind, obj }] of Object.entries(db.files || {})) {
    const v = check(KIND_DEF[kind]); if (!v) { E("DB-E000", p, "jenis berkas tidak dikenal: " + kind); continue; }
    if (!v(obj)) for (const e of v.errors.slice(0, 8)) E("DB-SCHEMA", p + e.instancePath, e.message + (e.params && e.params.additionalProperty ? " (" + e.params.additionalProperty + ")" : ""));
  }
  // jalur uji tanpa manifest: validasi objek langsung
  if (db._direct) for (const [def, obj, where] of db._direct) { const v = check(def); if (!v(obj)) for (const e of v.errors.slice(0, 6)) E("DB-SCHEMA", where + e.instancePath, e.message); }

  // 2. ID unik
  const ids = new Map();
  const reg = (id, kind, where) => { if (ids.has(id)) E("DB-E001", where, "ID ganda: " + id + " (juga di " + ids.get(id) + ")"); else ids.set(id, kind + ":" + where); };
  const srcIds = new Set(db.sources.map((s) => s.id));
  const srcById = Object.fromEntries(db.sources.map((s) => [s.id, s]));
  db.sources.forEach((s) => reg(s.id, "source", s.id));
  const countryIds = new Set(db.countries.map((c) => c.id));
  db.countries.forEach((c) => reg("country." + c.id, "country", c.id));
  const persons = new Map();
  for (const lf of db.leaders) { for (const p of lf.persons) { reg(p.id, "person", p.id); persons.set(p.id, p); } for (const t of lf.tenures) reg(t.id, "tenure", t.id); }
  db.equipment.manufacturers.forEach((m) => reg(m.id, "mfr", m.id));
  const modelIds = new Set(), itemIds = new Map();
  for (const m of db.equipment.models) { reg(m.id, "model", m.id); modelIds.add(m.id); itemIds.set(m.id, m); for (const v of m.variants) { reg(v.id, "variant", v.id); itemIds.set(v.id, { variant: v, model: m }); } }
  db.events.forEach((e) => reg(e.id, "event", e.id));
  for (const t of db.trees) { reg(t.id, "tree", t.id); for (const f of t.focuses) reg(f.id, "focus", f.id); }

  // 3. verifikasi: status vs sumber
  const checkVer = (v, where, opts) => {
    if (!v) return;
    for (const s of v.sources || []) if (!srcIds.has(s)) E("DB-E002", where, "sumber tidak terdaftar: " + s);
    const n = (v.sources || []).length;
    if (v.status === "verified") {
      const primary = (v.sources || []).some((s) => srcById[s] && (srcById[s].type === "primary" || srcById[s].type === "dataset"));
      if (n < 2 && !primary) E("DB-E009", where, "status 'verified' butuh ≥2 sumber atau 1 sumber primer/dataset resmi (ada " + n + ")");
    } else if (v.status === "partially_verified" || v.status === "disputed") {
      if (n < 1) E("DB-E010", where, "status '" + v.status + "' wajib punya sumber");
    } else if (v.status === "unknown") {
      if (!v.reason_unknown) E("DB-E011", where, "status 'unknown' wajib mengisi reason_unknown");
    } else if (v.status === "fictional_gameplay" && n > 0 && !(opts && opts.allowSources)) {
      Wn("DB-W010", where, "record fictional_gameplay punya sumber; pastikan klaim faktual dipisah");
    }
    if (v.status && v.status !== "fictional_gameplay" && v.status !== "unknown" && !v.checked) E("DB-E013", where, "tanggal pengecekan (checked) wajib untuk data yang diklaim terverifikasi");
  };
  db.countries.forEach((c) => { checkVer(c.verification, "country " + c.id); c.capitals.forEach((k, i) => checkVer(k.verification, "country " + c.id + " capital[" + i + "]")); if (c.executive) checkVer(c.executive.verification, "country " + c.id + " executive"); });

  // 4. pemimpin
  const countryById = Object.fromEntries(db.countries.map((c) => [c.id, c]));
  for (const lf of db.leaders) {
    if (!countryIds.has(lf.country)) E("DB-E003", "leaders/" + lf.country, "negara tidak ada di database negara");
    const byRole = {};
    for (const p of lf.persons) {
      checkVer(p.verification, "person " + p.id);
      if (p.birth && !validDate(p.birth)) E("DB-E040", p.id, "tanggal lahir tidak valid: " + p.birth);
      if (p.birth && p.death && p.death < p.birth) E("DB-E030", p.id, "wafat sebelum lahir");
    }
    for (const t of lf.tenures) {
      const where = "tenure " + t.id;
      checkVer(t.verification, where);
      if (!persons.has(t.person)) E("DB-E004", where, "tokoh tidak ada: " + t.person);
      if (!countryIds.has(t.country)) E("DB-E003", where, "negara tidak ada: " + t.country);
      if (!validDate(t.start.date)) E("DB-E040", where, "tanggal mulai tidak valid");
      if (t.end) {
        if (!validDate(t.end.date)) E("DB-E040", where, "tanggal akhir tidak valid");
        else if (t.end.date < t.start.date) E("DB-E005", where, "akhir masa jabatan sebelum awal");
      } else if (!t.ongoing_as_of) E("DB-E007", where, "end=null tanpa ongoing_as_of: masa jabatan yang sudah berakhir tidak boleh null");
      const p = persons.get(t.person);
      if (p) { if (p.birth && t.start.date < p.birth) E("DB-E030", where, "menjabat sebelum lahir"); if (p.death && t.start.date > p.death) E("DB-E030", where, "menjabat setelah wafat"); if (p.death && t.end && t.end.date > p.death) E("DB-E030", where, "masa jabatan melewati tanggal wafat"); }
      const c = countryById[t.country];
      if (c && c.existence.from && t.start.date < c.existence.from) E("DB-E032", where, "menjabat sebelum negara ada (" + c.existence.from + ")");
      if (!t.acting) for (const role of t.roles) (byRole[role] = byRole[role] || []).push(t);
    }
    for (const [role, list] of Object.entries(byRole)) {
      list.sort((a, b) => (a.start.date < b.start.date ? -1 : 1));
      for (let i = 0; i < list.length; i++) {
        const a = list[i], b = list[i + 1]; if (!b) continue;
        const aEnd = a.end ? a.end.date : "9999-12-31";
        if (!a.end) E("DB-E008", "tenure " + a.id, "end=null padahal ada pemegang jabatan berikutnya (" + b.id + ")");
        if (aEnd > b.start.date) E("DB-E006", "tenure " + a.id, "tumpang tindih peran '" + role + "' dengan " + b.id);
        else if (aEnd < b.start.date) {
          const covered = lf.vacancies.some((v) => v.role === role && v.start <= aEnd && v.end >= b.start.date);
          if (!covered) Wn("DB-W001", "tenure " + a.id, "celah " + aEnd + " → " + b.start.date + " pada peran '" + role + "' tanpa catatan vacancy");
        }
      }
    }
    lf.vacancies.forEach((v) => checkVer(v.verification, "vacancy " + v.role));
  }

  // 5. alutsista
  for (const m of db.equipment.models) {
    const w = "model " + m.id; checkVer(m.verification, w);
    if (!countryIds.has(m.design_country)) E("DB-E003", w, "negara desain tidak ada: " + m.design_country);
    for (const mf of m.manufacturers) if (!ids.has(mf)) E("DB-E002", w, "produsen tidak terdaftar: " + mf);
    if (m.derived_from && !modelIds.has(m.derived_from)) E("DB-E002", w, "derived_from tidak ada: " + m.derived_from);
    const se = m.service_entry_year, rt = m.retired_year;
    if (se != null && rt != null && rt < se) E("DB-E024", w, "pensiun sebelum masuk dinas");
    if (m.development_start_year != null && se != null && se < m.development_start_year) E("DB-E024", w, "masuk dinas sebelum pengembangan dimulai");
    if (m.status === "operational" && se == null) Wn("DB-W002", w, "model operasional tanpa tahun masuk dinas");
    const notInService = m.status === "prototype" || m.status === "cancelled" || m.status === "demonstrator";
    if (notInService && (m.operators.length || db.inventories.some((r) => r.item === m.id))) E("DB-E022", w, "status '" + m.status + "' tidak boleh punya operator/inventaris (prototipe ≠ operasional)");
    for (const v of m.variants) {
      const vw = "variant " + v.id; checkVer(v.verification, vw);
      if (v.service_entry_year != null && v.service_entry_basis !== "variant_specific") E("DB-E020", vw, "tahun masuk dinas varian terisi tanpa basis 'variant_specific' (jangan menyalin tahun model dasar ke varian)");
      if (v.service_entry_basis === "variant_specific" && !(v.verification.sources || []).length) E("DB-E020", vw, "basis variant_specific wajib bersumber");
      if (v.status === "operational" && v.service_entry_year == null) Wn("DB-W002", vw, "varian operasional tanpa tahun masuk dinas (belum diketahui)");
      if (v.service_entry_year != null && se != null && v.service_entry_year < se) E("DB-E023", vw, "varian masuk dinas sebelum model dasar");
      if ((v.status === "prototype" || v.status === "cancelled" || v.status === "demonstrator") && m.operators.some((o) => (o.variants || []).includes(v.id))) E("DB-E022", vw, "varian non-operasional dicantumkan sebagai varian operator");
    }
    for (const o of m.operators) {
      const ow = w + " operator " + o.country; checkVer(o.verification, ow);
      if (!countryIds.has(o.country)) E("DB-E003", ow, "negara operator tidak ada");
      if (o.since_year != null && se != null && o.since_year < se) E("DB-E023", ow, "operator sejak " + o.since_year + " sebelum model masuk dinas " + se);
      for (const vid of o.variants || []) if (!m.variants.some((v) => v.id === vid)) E("DB-E002", ow, "varian operator tidak ada: " + vid);
    }
    for (const p of m.procurement) {
      const pw = w + " procurement " + p.country + "/" + p.year; checkVer(p.verification, pw);
      if (!countryIds.has(p.country)) E("DB-E003", pw, "negara tidak ada");
      if (p.type === "offer" && p.delivery === "delivered") E("DB-E026", pw, "tawaran ekspor tidak boleh berstatus delivered");
    }
  }
  for (const r of db.inventories) {
    const w = "inventory " + r.id; checkVer(r.verification, w);
    const it = itemIds.get(r.item); if (!it) { E("DB-E002", w, "item tidak ada: " + r.item); continue; }
    const m = it.model || it, v = it.variant;
    if (!countryIds.has(r.country)) E("DB-E003", w, "negara tidak ada");
    if (m.service_entry_year != null && r.year < m.service_entry_year) E("DB-E025", w, "inventaris tahun " + r.year + " sebelum masuk dinas " + m.service_entry_year);
    if (m.retired_year != null && r.year > m.retired_year + 30) E("DB-E025", w, "inventaris jauh setelah pensiun");
    if (!m.operators.some((o) => o.country === r.country)) E("DB-E025", w, "negara bukan operator model ini (jangan menyimpulkan kepemilikan dari pesanan)");
    if (!(r.verification.sources || []).length) E("DB-E010", w, "inventaris wajib bersumber");
  }

  // 6. event
  const EFF = new Set(db.vocab.effects), CON = new Set(db.vocab.conditions), MODS = new Set(db.vocab.mods);
  const checkFx = (fx, where) => { for (const f of fx) { if (!EFF.has(f.type)) E("DB-E041", where, "tipe efek tidak dikenal: " + f.type); if (f.type === "mod_add" && !MODS.has(f.mod)) E("DB-E041", where, "mod tidak dikenal: " + f.mod); } };
  const checkCond = (cs, where) => { for (const c of cs || []) if (!CON.has(c.type)) E("DB-E041", where, "tipe kondisi tidak dikenal: " + c.type); };
  for (const e of db.events) {
    const w = "event " + e.id; checkVer(e.verification, w, { allowSources: true });
    for (const c of e.countries) if (c !== "*" && !countryIds.has(c)) E("DB-E003", w, "negara tidak ada: " + c);
    if (e.date && !validDate(e.date.date)) E("DB-E040", w, "tanggal event tidak valid");
    if (e.trigger.fire_on_date && !validDate(e.trigger.fire_on_date)) E("DB-E040", w, "fire_on_date tidak valid");
    if (e.classification === "historical") { if (!e.date) E("DB-E042", w, "event historis wajib bertanggal"); if (!e.factual_summary) E("DB-E042", w, "event historis wajib ringkasan faktual"); if (e.verification.status === "fictional_gameplay") E("DB-E042", w, "event historis tidak boleh berstatus fictional_gameplay"); }
    if (e.classification !== "historical" && e.verification.status !== "fictional_gameplay") E("DB-E042", w, "event " + e.classification + " harus fictional_gameplay (jangan menyajikan alternate history sebagai fakta)");
    if (e.historical_outcome && !e.options.some((o) => o.id === e.historical_outcome)) E("DB-E042", w, "historical_outcome tidak merujuk opsi yang ada");
    checkCond(e.trigger.conditions, w);
    e.options.forEach((o) => checkFx(o.effects, w + " opsi " + o.id));
  }

  // 7. focus tree
  for (const t of db.trees) {
    checkVer(t.verification, "tree " + t.id, { allowSources: true });
    if (t.country && !countryIds.has(t.country)) E("DB-E003", "tree " + t.id, "negara tidak ada");
    const byId = Object.fromEntries(t.focuses.map((f) => [f.id, f])), pos = new Set();
    for (const f of t.focuses) {
      const w = "focus " + f.id; const k = f.x + "," + f.y; if (pos.has(k)) E("DB-E050", w, "posisi ganda " + k); pos.add(k);
      for (const p of f.prerequisites || []) if (!byId[p]) E("DB-E050", w, "prasyarat tidak ada: " + p);
      for (const g of f.any_of || []) for (const p of g) if (!byId[p]) E("DB-E050", w, "any_of tidak ada: " + p);
      for (const x of f.exclusive || []) { if (!byId[x]) E("DB-E050", w, "exclusive tidak ada: " + x); else if (!(byId[x].exclusive || []).includes(f.id)) E("DB-E051", w, "exclusive tidak simetris dengan " + x); }
      checkCond(f.available, w); checkFx(f.effects, w);
      if (!f.branch || !t.branches.some((b) => b.id === f.branch)) E("DB-E050", w, "cabang tidak terdaftar: " + f.branch);
    }
    // siklus prasyarat
    const state = {}; const dfs = (id, stack) => { if (state[id] === 2) return; if (state[id] === 1) { E("DB-E052", "tree " + t.id, "siklus prasyarat: " + stack.concat(id).join(" → ")); return; } state[id] = 1; const f = byId[id]; for (const p of (f.prerequisites || []).concat(...(f.any_of || []))) if (byId[p]) dfs(p, stack.concat(id)); state[id] = 2; };
    for (const f of t.focuses) dfs(f.id, []);
  }

  // 8. statistik nyata (bukan perkiraan persentase)
  const stat = { sources: db.sources.length, countries: db.countries.length, persons: persons.size, tenures: db.leaders.reduce((a, l) => a + l.tenures.length, 0),
    models: db.equipment.models.length, variants: db.equipment.models.reduce((a, m) => a + m.variants.length, 0), manufacturers: db.equipment.manufacturers.length,
    inventories: db.inventories.length, events: db.events.length, focus_trees: db.trees.length, focuses: db.trees.reduce((a, t) => a + t.focuses.length, 0) };
  return { errors, warnings, stats: stat };
}

module.exports = { loadDb, validateDb, dayNum, ROOT };

if (require.main === module) {
  const db = loadDb(); const r = validateDb(db);
  console.log("Validasi database World Order");
  console.log("Record:", JSON.stringify(r.stats));
  for (const e of r.errors) console.log("  ERROR   " + e.code + "  [" + e.where + "] " + e.msg);
  for (const w of r.warnings) console.log("  peringatan " + w.code + "  [" + w.where + "] " + w.msg);
  console.log(r.errors.length ? "\nGAGAL: " + r.errors.length + " error, " + r.warnings.length + " peringatan" : "\nLOLOS: 0 error, " + r.warnings.length + " peringatan");
  process.exit(r.errors.length ? 1 : 0);
}
