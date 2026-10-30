// ===== WORLD ORDER v0.4 — WORLD (data statis) =====
// Geometri, tetangga, ibu kota, dan atribut sintetis provinsi. Tidak pernah berubah saat bermain.
// Atribut ekonomi/terrain/sumber daya di sini SINTETIS (perkiraan untuk balancing), bukan data dunia nyata.
(function (root) {
  "use strict";
  const WO = root.WO;
  const U = WO.util, C = WO.C;

  // bobot sumber daya per negara (perkiraan kasar produsen besar; sisanya memakai nilai default)
  const RES_DEFAULT = { oil: 0.2, steel: 0.6, aluminum: 0.3, coal: 0.6, food: 1.0 };
  const RES_SCALE = { oil: 0.5, steel: 0.9, aluminum: 0.45, coal: 0.9, food: 1.2 };
  const RES_BIAS = {
    oil: { SAU: 5, RUS: 3.5, USA: 3.5, IRQ: 3.5, IRN: 3.5, ARE: 3.5, KWT: 3, CAN: 3, VEN: 3, NGA: 2.5, LBY: 3, DZA: 2.5, KAZ: 2.5, BRA: 2, MEX: 2, NOR: 2.5, QAT: 3, AGO: 2.5, IDN: 1.2, CHN: 1.5, OMN: 2, AZE: 2, TKM: 2, GNQ: 2, SDS: 2, COG: 1.5, GAB: 1.5, COL: 1.5, ECU: 1.5, EGY: 1.2, MYS: 1.2, TLS: 1.0 },
    steel: { CHN: 2, IND: 1.8, RUS: 1.8, AUS: 2, BRA: 1.8, USA: 1.5, UKR: 1.5, ZAF: 1.5, SWE: 1.3, CAN: 1.2, KAZ: 1.3, IRN: 1.2, MEX: 1, TUR: 1, JPN: 1, DEU: 1, KOR: 1, IDN: 0.9 },
    aluminum: { AUS: 2.5, CHN: 2.5, GIN: 2.5, BRA: 2, IND: 1.5, RUS: 1.5, CAN: 1.5, JAM: 1.5, SUR: 1.5, GUY: 1.5, VNM: 1.2, ARE: 1.2, NOR: 1, ISL: 1.2, USA: 1, IDN: 0.8 },
    coal: { CHN: 3, IND: 2.5, USA: 2, AUS: 2.2, RUS: 2, IDN: 2.2, ZAF: 2, KAZ: 1.5, POL: 1.5, COL: 1.5, DEU: 1 },
    food: { BRA: 2, USA: 2, IND: 2, CHN: 1.5, ARG: 2, UKR: 2, RUS: 1.5, FRA: 1.5, AUS: 1.5, CAN: 1.5, THA: 1.5, VNM: 1.5, IDN: 1.3 },
  };

  function terrainFor(id, lat, area, isCapital) {
    const h = U.hash01(id + "#terrain") * 100, a = Math.abs(lat);
    if (isCapital && area < 8000) return "urban";
    if (a >= 62) return h < 70 ? "arctic" : "mountains";
    if (a < 12) return h < 45 ? "jungle" : h < 65 ? "plains" : h < 80 ? "hills" : h < 90 ? "marsh" : "mountains";
    if (a < 32) return h < 35 ? "desert" : h < 60 ? "plains" : h < 80 ? "hills" : h < 92 ? "mountains" : "forest";
    return h < 35 ? "forest" : h < 65 ? "plains" : h < 85 ? "hills" : "mountains";
  }

  const World = (WO.World = {
    ready: false,
    provinces: {}, provinceIds: [],
    countries: {}, countryIds: [],
    landmasses: {},
    _dist: new Map(),

    init(provGeo, data) {
      this.provinces = {}; this.countries = {}; this._dist = new Map();
      const feats = provGeo.features.filter((f) => f.geometry);
      const byCountry = {};

      for (const f of feats) {
        const p = f.properties, d = data.provinces[p.id];
        if (!d) continue;
        this.provinces[p.id] = {
          id: p.id, name: p.name, country: p.country, countryName: p.country_name,
          center: d.c, area: d.ar, landmass: d.lm, adj: d.adj, sea: d.sea,
        };
        (byCountry[p.country] = byCountry[p.country] || []).push(p.id);
      }
      this.provinceIds = Object.keys(this.provinces);

      // negara
      const codes = Object.keys(byCountry).sort();
      codes.forEach((code, i) => {
        const s = data.countries[code];
        this.countries[code] = {
          id: code, name: s.name, pop: s.pop, gdp: s.gdp, statSource: s.src,
          capital: s.cap, capitalName: s.capName, capitalLL: s.capLL, capitalApprox: s.capApprox,
          provinces: byCountry[code],
          hue: (i * 137.508) % 360, light: [38, 47, 31][i % 3],
        };
      });
      this.countryIds = codes;

      // daratan
      this.landmasses = {};
      for (const id of this.provinceIds) {
        const lm = this.provinces[id].landmass;
        (this.landmasses[lm] = this.landmasses[lm] || []).push(id);
      }

      // atribut sintetis provinsi
      for (const code of codes) this._synthesize(this.countries[code]);
      this.ready = true;
      return this;
    },

    _synthesize(c) {
      const ids = c.provinces, P = this.provinces;
      const w = {}; let sumW = 0, maxW = 0;
      for (const id of ids) {
        const p = P[id];
        const isCap = id === c.capital;
        p.terrain = terrainFor(id, p.center[1], p.area, isCap);
        const jitter = 0.6 + U.hash01(id + "#pop") * 0.8;
        w[id] = Math.sqrt(p.area) * jitter * (isCap ? 4 : 1);
        sumW += w[id]; if (w[id] > maxW) maxW = w[id];
      }
      const gpc = c.gdp / Math.max(0.01, c.pop);       // ribu USD per kapita
      const infraBase = gpc >= 40 ? 4 : gpc >= 15 ? 3 : gpc >= 5 ? 2 : 1;

      for (const id of ids) {
        const p = P[id], share = w[id] / sumW, isCap = id === c.capital;
        p.popM = c.pop * share;
        p.gdpB = c.gdp * (0.5 * share + 0.5 * (share * (0.7 + U.hash01(id + "#gdp") * 0.6))) * (isCap ? 1.2 : 1);
        p.vp = 1 + Math.round(5 * Math.sqrt(w[id] / maxW)) + (isCap ? 10 : 0);
        p.infra0 = U.clamp(infraBase + (isCap ? 1 : 0) + (U.hash01(id + "#infra") < 0.25 ? -1 : 0), 0, C.INFRA_MAX);
        p.isCapitalOriginal = isCap;
      }
      // normalisasi GDP provinsi agar totalnya = GDP negara
      let sg = 0; for (const id of ids) sg += P[id].gdpB;
      for (const id of ids) P[id].gdpB *= c.gdp / sg;

      // sumber daya: total nasional = bobot x skala x sqrt(PDB), dibagi acak-deterministik antar provinsi
      for (const id of ids) P[id].res = { oil: 0, steel: 0, aluminum: 0, coal: 0, food: 0 };
      for (const r of C.RESOURCES) {
        const wt = (RES_BIAS[r][c.id] !== undefined ? RES_BIAS[r][c.id] : RES_DEFAULT[r]);
        const total = wt * RES_SCALE[r] * Math.sqrt(c.gdp);
        const ws = {}; let s = 0;
        for (const id of ids) { ws[id] = Math.pow(U.hash01(id + "#" + r), 2.5) * Math.pow(P[id].area, 0.3) + 0.02; s += ws[id]; }
        for (const id of ids) P[id].res[r] = total * ws[id] / s;
      }
    },

    // jarak (km) antar pusat provinsi, di-cache
    dist(a, b) {
      const k = a < b ? a + "|" + b : b + "|" + a;
      let v = this._dist.get(k);
      if (v === undefined) {
        const A = this.provinces[a].center, B = this.provinces[b].center;
        v = Math.max(15, U.haversine(A[0], A[1], B[0], B[1]));
        this._dist.set(k, v);
      }
      return v;
    },
    seaKm(a, b) {
      const s = this.provinces[a].sea;
      for (let i = 0; i < s.length; i++) if (s[i][0] === b) return s[i][1];
      return null;
    },
    isAdjacent(a, b) { return this.provinces[a].adj.indexOf(b) !== -1; },
  });
})(typeof window !== "undefined" ? window : globalThis);
