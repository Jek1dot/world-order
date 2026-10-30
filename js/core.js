// ===== WORLD ORDER v0.4 — CORE =====
// Namespace global WO, konstanta game, RNG, tanggal, utilitas.
// File-file simulasi (core, world, state, ...) tidak menyentuh DOM, jadi bisa diuji di Node.
(function (root) {
  "use strict";
  const WO = (root.WO = root.WO || {});

  WO.VERSION = "0.4.0";
  WO.SAVE_SCHEMA = 4;
  WO.SAVE_KEY = "worldOrderV04";
  WO.START_DATE_UTC = Date.UTC(2026, 0, 1);

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  WO.dateString = function (day) {
    const d = new Date(WO.START_DATE_UTC + day * 86400000);
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  };

  // ---------- konstanta gameplay (semua angka keseimbangan ada di sini) ----------
  WO.C = {
    RESOURCES: ["oil", "steel", "aluminum", "coal", "food"],
    RES_NAMES: { oil: "Minyak", steel: "Baja", aluminum: "Aluminium", coal: "Batu bara", food: "Pangan" },
    EQUIP: ["rifles", "artillery", "tanks"],
    EQUIP_INFO: {
      rifles:    { name: "Senapan",  pp: 0.5, res: { steel: 0.1 } },
      artillery: { name: "Artileri", pp: 3,   res: { steel: 0.8, aluminum: 0.2 } },
      tanks:     { name: "Tank",     pp: 8,   res: { steel: 1.5, aluminum: 0.6, oil: 0.4 } },
    },
    // speed = km/hari, atk/def = kekuatan tempur dasar, org = organisasi maksimum
    DIV_TYPES: {
      infantry: { name: "Divisi Infanteri", man: 10000, eq: { rifles: 1000, artillery: 30 },              atk: 20, def: 30, org: 60, speed: 60, food: 0.20, oil: 0,    cost: 0.30 },
      armored:  { name: "Divisi Lapis Baja", man: 8000, eq: { rifles: 400, artillery: 20, tanks: 250 },   atk: 45, def: 30, org: 50, speed: 100, food: 0.20, oil: 0.50, cost: 0.60 },
      garrison: { name: "Divisi Garnisun",  man: 5000, eq: { rifles: 400 },                               atk: 10, def: 22, org: 45, speed: 50, food: 0.15, oil: 0,    cost: 0.12 },
    },
    TRAIN_DAYS: 10,
    // bangunan: pts = poin konstruksi, cost = biaya kas (miliar USD)
    BUILD: {
      civ:   { name: "Pabrik sipil",   pts: 3600, cost: 2 },
      mil:   { name: "Pabrik militer", pts: 3600, cost: 2 },
      infra: { name: "Infrastruktur",  pts: 1800, cost: 1 },
    },
    CONSTR_PER_CIV: 5,      // poin konstruksi per pabrik sipil per hari
    CONSTR_MAX_RATE: 75,    // maksimum poin per proyek per hari
    PP_PER_MIL: 4.5,        // production point per pabrik militer per hari
    EFF_START: 0.10, EFF_GROW: 0.01,
    COAL_PER_FACTORY: 0.25,
    SLOTS_BASE: 3, SLOTS_PER_INFRA: 3, INFRA_MAX: 5,
    // terrain: sp = pengali kecepatan, atk = pengali serangan penyerang, def = bonus bertahan
    TERRAIN: {
      plains:    { name: "Dataran",   sp: 1.00, atk: 1.00, def: 0.00 },
      forest:    { name: "Hutan",     sp: 0.80, atk: 0.90, def: 0.15 },
      hills:     { name: "Perbukitan",sp: 0.75, atk: 0.85, def: 0.25 },
      mountains: { name: "Pegunungan",sp: 0.50, atk: 0.65, def: 0.45 },
      desert:    { name: "Gurun",     sp: 0.85, atk: 1.00, def: 0.00 },
      jungle:    { name: "Hutan hujan",sp: 0.60, atk: 0.80, def: 0.20 },
      marsh:     { name: "Rawa",      sp: 0.55, atk: 0.80, def: 0.10 },
      arctic:    { name: "Tundra",    sp: 0.60, atk: 0.85, def: 0.10 },
      urban:     { name: "Perkotaan", sp: 0.90, atk: 0.80, def: 0.25 },
    },
    SEA_SPEED: 50, SEA_LOAD_DAYS: 3, SEA_COST_MULT: 1.3,     // penyeberangan laut domestik
    SUPPLY_FULL: 3,                       // poin supply untuk 100%
    SUPPLY_CAPITAL: 20, SUPPLY_FALLBACK: 10, SUPPLY_REGIONAL: 10,
    COMBAT_WIDTH: 10, COMBAT_K: 0.9, STR_PER_ORG: 0.22, ORG_REGEN: 3, REINFORCE: 1.0,
    ATTACK_MIN_ORG: 0.25,
    CAP_PRESSURE: 65, CAP_DAYS: 4,
    RELOCATE_COST: 5, RELOCATE_COOLDOWN: 180, RELOCATE_MIN_INFRA: 2,
    IMPROVE_COST: 0.5, IMPROVE_COOLDOWN: 30,
  };

  // ---------- utilitas ----------
  WO.util = {
    // hash string -> [0,1) deterministik (FNV-1a)
    hash01(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return ((h >>> 0) % 1000003) / 1000003;
    },
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    pairKey(a, b) { return a < b ? a + "|" + b : b + "|" + a; },
    haversine(lon1, lat1, lon2, lat2) {
      const R = 6371, rad = Math.PI / 180;
      const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    },
    isNum(v) { return typeof v === "number" && isFinite(v); },
  };

  // RNG mulberry32: state disimpan di state.rng agar save/load deterministik
  WO.rand = function (state) {
    state.rng = (state.rng + 0x6d2b79f5) | 0;
    let t = state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // penanda progres misi/skenario (hanya untuk tindakan pemain)
  WO.flag = function (state, key, actor) {
    if (actor === undefined || actor === state.player) { state.flags = state.flags || {}; state.flags[key] = state.day; }
  };

  // antrean event untuk UI/log: { day, text, kind, country? }
  WO.log = function (state, text, kind, country) {
    state.log.push({ day: state.day, text, kind: kind || "info", country: country || null });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  };
})(typeof window !== "undefined" ? window : globalThis);
