// ===== WORLD ORDER v0.4 — SAVE / LOAD =====
// Menyimpan hanya data dinamis (tanpa GeoJSON). Provinsi disimpan sebagai selisih dari kondisi awal.
// Skema berversi: save lama (v0.1-0.3) tidak kompatibel -> pemain diberi peringatan, game tidak crash.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, C = WO.C;
  const Save = (WO.Save = {});
  const COUNTRY_FIELDS = ["exists", "treasury", "manpower", "manpowerMax", "stability", "baseStab", "exhaustion", "growth", "capital",
    "capitalHistory", "lastRelocate", "relocCount", "stock", "res", "queue", "lines", "divSeq", "peakArmy", "capitulated", "capDays", "casualties", "ai"];

  let baseline = null;
  function getBaseline() { if (!baseline) baseline = WO.State.newGame({ seed: 1 }).provinces; return baseline; }

  Save.serialize = function (state) {
    const base = getBaseline(), pd = {};
    for (const id of W.provinceIds) {
      const p = state.provinces[id], b = base[id];
      if (p.owner !== b.owner || p.controller !== b.controller || p.infra !== b.infra || p.civ !== b.civ || p.mil !== b.mil || p.occ !== b.occ)
        pd[id] = [p.owner, p.controller, p.infra, p.civ, p.mil, p.occ];
    }
    const cd = {};
    for (const iso of W.countryIds) { const c = state.countries[iso], o = {}; for (const f of COUNTRY_FIELDS) o[f] = c[f]; cd[iso] = o; }
    return {
      schema: WO.SAVE_SCHEMA, version: WO.VERSION, savedAt: Date.now(),
      day: state.day, player: state.player, rng: state.rng, settings: state.settings,
      nextDivId: state.nextDivId, nextWarId: state.nextWarId, nextProjId: state.nextProjId, nextLineId: state.nextLineId,
      provinces: pd, countries: cd, divisions: state.divisions, wars: state.wars, diplo: state.diplo,
      flags: state.flags, peaceOffers: state.peaceOffers, log: state.log.slice(-120), pendingMessages: state.pendingMessages.slice(-20),
    };
  };

  Save.deserialize = function (obj) {
    if (!obj || typeof obj !== "object") return { ok: false, error: "Data save rusak." };
    if (obj.schema !== WO.SAVE_SCHEMA) return { ok: false, error: "Save dari versi lain (skema " + obj.schema + ") tidak kompatibel dengan v" + WO.VERSION + ". Mulai permainan baru." };
    try {
      const state = WO.State.newGame({ seed: obj.rng, aiAggressive: obj.settings && obj.settings.aiAggressive });
      state.day = obj.day; state.player = obj.player; state.rng = obj.rng | 0;
      state.settings = Object.assign({ aiAggressive: false }, obj.settings);
      state.nextDivId = obj.nextDivId; state.nextWarId = obj.nextWarId; state.nextProjId = obj.nextProjId; state.nextLineId = obj.nextLineId || 1;
      for (const id in obj.provinces) {
        const p = state.provinces[id], v = obj.provinces[id]; if (!p) continue;
        p.owner = v[0]; p.controller = v[1]; p.infra = v[2]; p.civ = v[3]; p.mil = v[4]; p.occ = v[5];
      }
      for (const iso in obj.countries) { const c = state.countries[iso]; if (!c) continue; for (const f of COUNTRY_FIELDS) if (obj.countries[iso][f] !== undefined) c[f] = obj.countries[iso][f]; }
      state.divisions = obj.divisions || {}; state.wars = obj.wars || []; state.diplo = obj.diplo || { rel: {}, pacts: [], cd: {}, history: [] };
      state.flags = obj.flags || {}; state.peaceOffers = obj.peaceOffers || []; state.log = obj.log || []; state.pendingMessages = obj.pendingMessages || [];
      WO.State.rebuild(state); WO.State.refreshAggregates(state);
      const problems = Save.validate(state, true);
      if (problems.length) return { ok: false, error: "Save tidak valid: " + problems.slice(0, 3).join("; ") };
      WO.Supply.update(state, true);
      return { ok: true, state };
    } catch (e) { return { ok: false, error: "Gagal memuat save: " + e.message }; }
  };

  // periksa invarian state; repair=true menghapus divisi yang tidak valid
  Save.validate = function (state, repair) {
    const problems = [], seen = new Set();
    for (const id of Object.keys(state.divisions)) {
      const d = state.divisions[id];
      if (seen.has(d.id) || d.id !== id) problems.push("ID divisi ganda/salah " + id);
      seen.add(d.id);
      if (!state.provinces[d.province]) { problems.push("divisi " + id + " di provinsi tidak ada"); if (repair) delete state.divisions[id]; continue; }
      if (!state.countries[d.country] || !state.countries[d.country].exists) { problems.push("divisi " + id + " milik negara tidak ada"); if (repair) delete state.divisions[id]; continue; }
      for (const f of ["str", "org", "xp"]) if (!WO.util.isNum(d[f])) problems.push("divisi " + id + " " + f + " bukan angka");
      if (d.str < 0 || d.str > 100.0001) problems.push("divisi " + id + " str di luar rentang");
      if (d.order) for (const p of d.order.path) if (!state.provinces[p]) problems.push("jalur divisi " + id + " tidak valid");
    }
    for (const iso of W.countryIds) {
      const c = state.countries[iso];
      if (!c.exists) continue;
      for (const f of ["treasury", "manpower", "stability", "exhaustion", "growth"]) if (!WO.util.isNum(c[f])) problems.push(iso + "." + f + " bukan angka");
      if (c.manpower < 0) problems.push(iso + " manpower negatif");
      for (const e of C.EQUIP) if (!WO.util.isNum(c.stock[e]) || c.stock[e] < -1e-6) problems.push(iso + " stok " + e + " tidak valid");
      for (const r of C.RESOURCES) if (!WO.util.isNum(c.res[r]) || c.res[r] < -1e-6) problems.push(iso + " resource " + r + " tidak valid");
      if (!state.provinces[c.capital]) problems.push(iso + " ibu kota tidak ada");
    }
    for (const id of W.provinceIds) {
      const p = state.provinces[id];
      if (!state.countries[p.owner] || !state.countries[p.controller]) problems.push("provinsi " + id + " owner/controller tidak valid");
    }
    return problems;
  };

  // ---------- localStorage ----------
  const round = (k, v) => (typeof v === "number" && isFinite(v) ? Math.round(v * 1000) / 1000 : v);
  Save.toLocal = function (state) {
    try { const json = JSON.stringify(Save.serialize(state), round); localStorage.setItem(WO.SAVE_KEY, json); return { ok: true, bytes: json.length }; }
    catch (e) { return { ok: false, error: e.message }; }
  };
  Save.fromLocal = function () {
    let raw = null;
    try { raw = localStorage.getItem(WO.SAVE_KEY); } catch (e) { return { ok: false, error: "localStorage tidak tersedia." }; }
    if (!raw) {
      let legacy = null; try { legacy = localStorage.getItem("worldOrderV01"); } catch (e) {}
      return { ok: false, error: legacy ? "Hanya ada save lama (v0.1–0.3) yang tidak kompatibel. Mulai permainan baru." : "Belum ada save." };
    }
    let obj; try { obj = JSON.parse(raw); } catch (e) { return { ok: false, error: "Data save rusak (JSON tidak valid)." }; }
    return Save.deserialize(obj);
  };
})(typeof window !== "undefined" ? window : globalThis);
