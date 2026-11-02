// ===== WORLD ORDER — DB: pemuat database sejarah (lazy loading + indeks + cache) =====
// Sumber kebenaran data historis. Terpisah dari state permainan; tidak pernah masuk save (hanya versi database).
// Pemuat dapat diganti (browser: fetch, Node: fs) lewat DB.setFetcher.
(function (root) {
  "use strict";
  const WO = root.WO;
  const DB = (WO.DB = { manifest: null, ready: false, _cache: {}, _fetch: null, _countries: null, _countryIdx: null, _leaders: {}, _equipment: null, _events: null, _trees: null });

  DB.setFetcher = (fn) => { DB._fetch = fn; };
  const get = async (rel) => {
    if (DB._cache[rel]) return DB._cache[rel];
    const f = DB._fetch || ((r) => fetch("data/db/" + r).then((x) => { if (!x.ok) throw new Error("data/db/" + r + " → HTTP " + x.status); return x.json(); }));
    return (DB._cache[rel] = await f(rel));
  };

  DB.init = async function () {
    DB.manifest = await get("manifest.json");
    DB.vocab = await get("vocab.json");
    const src = await Promise.all(DB.manifest.files.filter((f) => f.kind === "sources").map((f) => get(f.path)));
    DB.sources = {}; for (const s of src) for (const x of s.sources) DB.sources[x.id] = x;
    DB.ready = true; return DB;
  };
  const filesOf = (kind) => DB.manifest.files.filter((f) => f.kind === kind);

  // ---------- tanggal ----------
  DB.isoOfDay = (day) => new Date(WO.START_DATE_UTC + day * 86400000).toISOString().slice(0, 10);
  DB.dayOfIso = (iso) => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - WO.START_DATE_UTC) / 86400000);

  // ---------- negara ----------
  DB.loadCountries = async function () {
    if (DB._countries) return DB._countries;
    const shards = await Promise.all(filesOf("countries").map((f) => get(f.path)));
    DB._countries = []; DB._countryIdx = {};
    for (const s of shards) for (const c of s.countries) { c._shard = s.shard; DB._countries.push(c); DB._countryIdx[c.id] = c; }
    return DB._countries;
  };
  DB.country = (iso) => (DB._countryIdx ? DB._countryIdx[iso] || null : null);

  // ---------- pemimpin ----------
  DB.hasLeaders = (iso) => !!(DB.manifest && DB.manifest.files.some((f) => f.kind === "leaders" && f.key === iso));
  DB.loadLeaders = async function (iso) {
    if (DB._leaders[iso] !== undefined) return DB._leaders[iso];
    if (!DB.hasLeaders(iso)) return (DB._leaders[iso] = null);
    const f = await get("leaders/" + iso + ".json"), persons = {};
    for (const p of f.persons) persons[p.id] = p;
    const idx = { file: f, persons, byRole: {} };
    for (const t of f.tenures) for (const r of t.roles) (idx.byRole[r] = idx.byRole[r] || []).push(t);
    for (const r in idx.byRole) idx.byRole[r].sort((a, b) => (a.start.date < b.start.date ? -1 : 1));
    return (DB._leaders[iso] = idx);
  };
  // pemegang jabatan pada tanggal ISO (sinkron; data harus sudah dimuat). Mengembalikan {role: {tenure, person} | {vacancy} | null}
  DB.leadersAt = function (iso, date) {
    const idx = DB._leaders[iso]; if (!idx) return null;
    const out = {};
    for (const role of Object.keys(idx.byRole)) {
      let hit = null;
      for (const t of idx.byRole[role]) {
        if (t.acting) continue;
        if (t.start.date <= date && (!t.end || date < t.end.date)) { hit = t; break; }
      }
      if (hit) out[role] = { tenure: hit, person: idx.persons[hit.person] };
      else { const v = idx.file.vacancies.find((v) => v.role === role && v.start <= date && date < v.end); out[role] = v ? { vacancy: v } : null; }
    }
    return out;
  };
  DB.coverageOf = function (iso, from, to) {   // fraksi hari [from,to) yang tertutup masa jabatan atau vacancy tercatat, per peran
    const idx = DB._leaders[iso]; if (!idx) return null;
    const d = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000, A = d(from), B = d(to), out = {};
    for (const role of Object.keys(idx.byRole)) {
      let c = 0; const cover = (s, e) => { c += Math.max(0, Math.min(B, e) - Math.max(A, s)); };
      for (const t of idx.byRole[role]) cover(d(t.start.date), t.end ? d(t.end.date) : B);
      for (const v of idx.file.vacancies) if (v.role === role) cover(d(v.start), d(v.end));
      out[role] = c / (B - A);
    }
    return out;
  };

  // ---------- alutsista ----------
  DB.loadEquipment = async function () {
    if (DB._equipment) return DB._equipment;
    const shards = await Promise.all(filesOf("equipment").map((f) => get(f.path)));
    DB._equipment = { models: [], manufacturers: {}, byId: {} };
    for (const s of shards) { for (const m of s.manufacturers || []) DB._equipment.manufacturers[m.id] = m; for (const m of s.models) { DB._equipment.models.push(m); DB._equipment.byId[m.id] = m; } }
    return DB._equipment;
  };
  // model yang dioperasikan negara pada tahun tertentu (model belum masuk dinas tidak ikut)
  DB.equipmentOf = function (iso, year) {
    if (!DB._equipment) return [];
    return DB._equipment.models.filter((m) => m.operators.some((o) => o.country === iso && (o.since_year == null || o.since_year <= year) && (o.until_year == null || year <= o.until_year))
      && (m.service_entry_year == null || m.service_entry_year <= year));
  };

  // ---------- event & fokus ----------
  DB.loadEvents = async function () { if (!DB._events) { const s = await Promise.all(filesOf("events").map((f) => get(f.path))); DB._events = [].concat(...s.map((x) => x.events)); } return DB._events; };
  DB.loadTrees = async function () { if (!DB._trees) { const s = await Promise.all(filesOf("focus").map((f) => get(f.path))); DB._trees = [].concat(...s.map((x) => x.trees)); } return DB._trees; };
  DB.treeFor = (iso) => { if (!DB._trees) return null; return DB._trees.find((t) => t.country === iso) || DB._trees.find((t) => t.kind === "generic") || null; };

  DB.stats = () => ({ files: DB.manifest.files.length, sources: Object.keys(DB.sources || {}).length, version: DB.manifest.db_version });
})(typeof window !== "undefined" ? window : globalThis);
