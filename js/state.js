// ===== WORLD ORDER v0.4 — STATE (data dinamis) =====
// Satu-satunya sumber kebenaran game. Geometri TIDAK disimpan di sini, hanya id provinsi.
//  state.provinces[id] = { owner, controller, infra, civ, mil, occ }
//  state.countries[iso], state.divisions[id], state.wars, state.diplo ...
//  state.rt = data runtime turunan (tidak disimpan ke save, dibangun ulang saat load)
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, U = WO.util, C = WO.C;
  const State = (WO.State = {});

  // ---------- indeks runtime ----------
  State.rebuild = function (state) {
    const rt = (state.rt = {
      owned: {}, controlled: {}, divsByProv: {}, divsByCountry: {}, supply: {},
      dirty: { provinces: new Set(), all: true, units: true, panels: true },
      aggDirty: new Set(), supplyDirty: new Set(), combats: {}, today: [], fighting: new Set(), activeBattles: new Set(),
    });
    for (const iso of W.countryIds) { rt.owned[iso] = new Set(); rt.controlled[iso] = new Set(); rt.divsByCountry[iso] = new Set(); rt.aggDirty.add(iso); }
    for (const id of W.provinceIds) {
      const p = state.provinces[id];
      rt.owned[p.owner].add(id); rt.controlled[p.controller].add(id);
    }
    for (const d of Object.values(state.divisions)) {
      (rt.divsByProv[d.province] = rt.divsByProv[d.province] || new Set()).add(d.id);
      rt.divsByCountry[d.country].add(d.id);
    }
    if (WO.Dip) WO.Dip.rebuildIndex(state);
    return state;
  };

  State.setOwner = function (state, pid, iso) {
    const p = state.provinces[pid], old = p.owner;
    if (old === iso) return;
    state.rt.owned[old].delete(pid); state.rt.owned[iso].add(pid);
    p.owner = iso;
    state.rt.aggDirty.add(old); state.rt.aggDirty.add(iso);
    state.rt.dirty.provinces.add(pid);
  };

  State.setController = function (state, pid, iso) {
    const p = state.provinces[pid], old = p.controller;
    if (old === iso) return;
    state.rt.controlled[old].delete(pid); state.rt.controlled[iso].add(pid);
    p.controller = iso;
    p.occ = iso === p.owner ? 0 : state.day;
    state.rt.aggDirty.add(old); state.rt.aggDirty.add(iso); state.rt.aggDirty.add(p.owner);
    state.rt.supplyDirty.add(old); state.rt.supplyDirty.add(iso);
    state.rt.dirty.provinces.add(pid);
  };

  // ---------- agregat negara (dihitung ulang hanya bila ada perubahan wilayah) ----------
  State.aggregate = function (state, iso) {
    const c = state.countries[iso];
    const a = { gdp: 0, popM: 0, vpOwned: 0, vpHeld: 0, vpLost: 0, civ: 0, mil: 0, nOwned: 0, nHeldOwn: 0,
                res: { oil: 0, steel: 0, aluminum: 0, coal: 0, food: 0 } };
    for (const pid of state.rt.owned[iso]) {
      const sp = state.provinces[pid], wp = W.provinces[pid];
      a.nOwned++; a.vpOwned += wp.vp;
      if (sp.controller === iso) {
        a.nHeldOwn++; a.vpHeld += wp.vp; a.gdp += wp.gdpB; a.popM += wp.popM; a.civ += sp.civ; a.mil += sp.mil;
        for (const r of C.RESOURCES) a.res[r] += wp.res[r];
      } else a.vpLost += wp.vp;
    }
    for (const pid of state.rt.controlled[iso]) {      // wilayah pendudukan: hanya 30% manfaat ekonomi
      const sp = state.provinces[pid];
      if (sp.owner === iso) continue;
      const wp = W.provinces[pid];
      a.gdp += wp.gdpB * 0.3;
      for (const r of C.RESOURCES) a.res[r] += wp.res[r] * 0.3;
    }
    a.gdp *= c.growth;
    c.agg = a;
    return a;
  };
  State.refreshAggregates = function (state) {
    for (const iso of state.rt.aggDirty) if (state.countries[iso].exists) State.aggregate(state, iso);
    state.rt.aggDirty.clear();
  };

  // ---------- divisi ----------
  State.createDivision = function (state, iso, type, pid, opts) {
    opts = opts || {};
    const c = state.countries[iso], t = C.DIV_TYPES[type];
    c.divSeq++;
    const id = "D" + state.nextDivId++;
    const d = {
      id, name: c.divSeq + ". " + t.name, country: iso, type, province: pid,
      str: 100, org: t.org, xp: 0, order: null, attacking: null,
      readyDay: state.day + (opts.training === false ? 0 : C.TRAIN_DAYS), supply: 1,
    };
    state.divisions[id] = d;
    state.rt.divsByCountry[iso].add(id);
    (state.rt.divsByProv[pid] = state.rt.divsByProv[pid] || new Set()).add(id);
    state.rt.dirty.units = true;
    return d;
  };
  State.moveDivisionTo = function (state, d, pid) {
    const S = state.rt.divsByProv[d.province];
    if (S) { S.delete(d.id); if (!S.size) delete state.rt.divsByProv[d.province]; }
    d.province = pid;
    (state.rt.divsByProv[pid] = state.rt.divsByProv[pid] || new Set()).add(d.id);
    state.rt.dirty.units = true;
  };
  State.removeDivision = function (state, id) {
    const d = state.divisions[id]; if (!d) return;
    const S = state.rt.divsByProv[d.province];
    if (S) { S.delete(id); if (!S.size) delete state.rt.divsByProv[d.province]; }
    state.rt.divsByCountry[d.country].delete(id);
    delete state.divisions[id];
    state.rt.dirty.units = true;
  };
  State.divisionsIn = function (state, pid) {
    const S = state.rt.divsByProv[pid]; if (!S) return [];
    const out = []; for (const id of S) out.push(state.divisions[id]); return out;
  };
  State.countryDivisions = function (state, iso) {
    const out = []; for (const id of state.rt.divsByCountry[iso]) out.push(state.divisions[id]); return out;
  };
  State.divManpower = (d) => Math.round(C.DIV_TYPES[d.type].man * d.str / 100);
  State.armyStrength = function (state, iso) {
    let s = 0; for (const id of state.rt.divsByCountry[iso]) s += state.divisions[id].str / 100; return s;
  };

  // alokasi bilangan bulat total ke provinsi menurut bobot (largest remainder)
  function allocate(total, ids, weight) {
    let sum = 0; for (const id of ids) sum += weight[id];
    const base = {}, rem = []; let used = 0;
    for (const id of ids) { const x = total * weight[id] / sum; base[id] = Math.floor(x); used += base[id]; rem.push([x - base[id], id]); }
    rem.sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1));
    for (let i = 0; used < total && i < rem.length; i++, used++) base[rem[i][1]]++;
    return base;
  }

  // ---------- permainan baru ----------
  State.newGame = function (opts) {
    opts = opts || {};
    const state = {
      schema: WO.SAVE_SCHEMA, version: WO.VERSION, day: 0, player: null,
      rng: (opts.seed || 20260101) | 0,
      settings: { aiAggressive: !!opts.aiAggressive },
      provinces: {}, countries: {}, divisions: {}, nextDivId: 1, nextWarId: 1, nextProjId: 1, nextLineId: 1,
      wars: [], diplo: { rel: {}, pacts: [], cd: {}, history: [] },
      peaceOffers: [], log: [], pendingMessages: [], flags: {},
    };

    for (const id of W.provinceIds) {
      const wp = W.provinces[id];
      state.provinces[id] = { owner: wp.country, controller: wp.country, infra: wp.infra0, civ: 0, mil: 0, occ: 0 };
    }

    for (const iso of W.countryIds) {
      const wc = W.countries[iso];
      const gpc = wc.gdp / Math.max(0.01, wc.pop);
      const civ = Math.max(1, Math.round(Math.sqrt(wc.gdp) / 1.8));
      const mil = wc.gdp < 20 ? 0 : Math.round(civ * 0.45);
      const weight = {}; for (const id of wc.provinces) weight[id] = W.provinces[id].popM + 0.001;
      const ac = allocate(civ, wc.provinces, weight), am = allocate(mil, wc.provinces, weight);
      for (const id of wc.provinces) { state.provinces[id].civ = ac[id]; state.provinces[id].mil = am[id]; }

      state.countries[iso] = {
        id: iso, exists: true,
        treasury: Math.max(0.5, wc.gdp * 0.06),
        manpower: Math.round(wc.pop * 1e6 * 0.012),
        stability: U.clamp(60 + gpc * 0.5 + (U.hash01(iso + "#stab") * 16 - 8), 45, 88),
        baseStab: 0, exhaustion: 0, growth: 1,
        capital: wc.capital, capitalHistory: [{ day: 0, id: wc.capital }], lastRelocate: -9999, relocCount: 0,
        stock: { rifles: 0, artillery: 0, tanks: 0 },
        res: { oil: 0, steel: 0, aluminum: 0, coal: 0, food: 0 },
        queue: [], lines: [], divSeq: 0, peakArmy: 0, capitulated: false, capDays: 0, casualties: 0,
        ai: { next: Math.floor(U.hash01(iso + "#ai") * 7) },
        income: null, agg: null, lastReport: null,
      };
      state.countries[iso].baseStab = state.countries[iso].stability;
    }

    State.rebuild(state);   // indeks runtime harus ada sebelum membuat divisi

    // divisi awal (perkiraan sintetis): jumlah ~ akar populasi
    for (const iso of W.countryIds) {
      const wc = W.countries[iso], c = state.countries[iso];
      const n = Math.max(1, Math.min(30, Math.round(Math.sqrt(wc.pop) * 0.7)));
      const weight = {}; for (const id of wc.provinces) weight[id] = W.provinces[id].popM + 0.001;
      const places = allocate(n, wc.provinces, weight);
      let k = 0; const armoredEvery = wc.gdp >= 1000 ? 7 : 0;
      const order = Object.keys(places).sort();
      // pastikan ibu kota punya divisi
      if (!places[wc.capital]) { places[wc.capital] = 1; }
      for (const pid of order) {
        for (let i = 0; i < places[pid]; i++) {
          k++;
          const type = wc.pop < 0.5 ? "garrison" : armoredEvery && k % armoredEvery === 0 ? "armored" : "infantry";
          State.createDivision(state, iso, type, pid, { training: false });
        }
      }
      const divs = Object.values(state.divisions).filter((d) => d.country === iso);
      c.stock.rifles = divs.length * 250; c.stock.artillery = divs.length * 6;
      c.stock.tanks = divs.filter((d) => d.type === "armored").length * 20;
      for (const r of C.RESOURCES) c.res[r] = 0;
      c.peakArmy = divs.length;
    }

    State.refreshAggregates(state);
    for (const iso of W.countryIds) {
      const c = state.countries[iso];
      for (const r of C.RESOURCES) c.res[r] = c.agg.res[r] * 20;      // cadangan awal ~20 hari produksi
      c.manpowerMax = Math.round(W.countries[iso].pop * 1e6 * 0.03);
    }
    WO.log(state, "Permainan dimulai. " + WO.dateString(0), "info");
    return state;
  };

  State.setPlayer = function (state, iso) {
    if (!state.countries[iso]) return false;
    state.player = iso; state.rt.dirty.all = true; state.rt.dirty.panels = true;
    return true;
  };
})(typeof window !== "undefined" ? window : globalThis);
