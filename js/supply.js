// ===== WORLD ORDER v0.4 — SUPPLY =====
// Supply mengalir dari ibu kota (dan pusat regional) lewat provinsi yang DIKUASAI negara itu.
// Biaya per langkah bergantung pada infrastruktur. Wilayah musuh memutus aliran. Laut hanya lewat jalur domestik.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, C = WO.C;
  const Supply = (WO.Supply = {});

  Supply.compute = function (state, iso) {
    const ctrl = state.rt.controlled[iso];
    const map = new Map();
    if (!ctrl || !ctrl.size) { state.rt.supply[iso] = map; return map; }
    const c = state.countries[iso];
    const SMAX = C.SUPPLY_CAPITAL;
    const heap = new WO.MinHeap(), best = new Map();
    const seed = (pid, s0) => { const key = SMAX - s0; if (key < (best.has(pid) ? best.get(pid) : Infinity)) { best.set(pid, key); heap.push(key, pid); } };

    if (ctrl.has(c.capital)) seed(c.capital, C.SUPPLY_CAPITAL);
    else {                                          // ibu kota jatuh: pusat darurat di provinsi bernilai tertinggi
      let b = null, bv = -1;
      for (const pid of ctrl) { const v = W.provinces[pid].vp; if (v > bv) { bv = v; b = pid; } }
      if (b) seed(b, C.SUPPLY_FALLBACK);
    }
    // pusat regional: provinsi terpadat di tiap daratan yang dikuasai
    const hubs = new Map();
    for (const pid of ctrl) {
      const lm = W.provinces[pid].landmass, cur = hubs.get(lm);
      if (!cur || W.provinces[pid].popM > W.provinces[cur].popM) hubs.set(lm, pid);
    }
    for (const pid of hubs.values()) seed(pid, C.SUPPLY_REGIONAL);

    while (heap.size) {
      const [key, cur] = heap.pop();
      if (key > best.get(cur)) continue;
      const val = SMAX - key;
      if (val <= 0) continue;
      map.set(cur, val);
      const P = W.provinces[cur];
      for (const nx of P.adj) {
        if (!ctrl.has(nx)) continue;
        const step = 0.6 + (C.INFRA_MAX - state.provinces[nx].infra) * 0.15;
        const nk = key + step; if (nk < (best.has(nx) ? best.get(nx) : Infinity)) { best.set(nx, nk); heap.push(nk, nx); }
      }
      for (const [nx, km] of P.sea) {
        if (!ctrl.has(nx)) continue;
        const nk = key + 3 + km / 100; if (nk < (best.has(nx) ? best.get(nx) : Infinity)) { best.set(nx, nk); heap.push(nk, nx); }
      }
    }
    state.rt.supply[iso] = map;
    return map;
  };

  // supply (0..1) untuk sebuah divisi
  Supply.of = function (state, d) {
    let pts = 0;
    const own = state.rt.supply[d.country];
    if (own && own.has(d.province)) pts = own.get(d.province);
    const ctrl = state.provinces[d.province].controller;
    if (ctrl !== d.country && WO.Dip.isFriendly(state, d.country, ctrl)) {
      const m = state.rt.supply[ctrl];
      if (m && m.has(d.province)) pts = Math.max(pts, m.get(d.province) * 0.8);
    }
    return WO.util.clamp(pts / C.SUPPLY_FULL, 0, 1);
  };

  // hitung ulang untuk negara yang punya divisi / berperang (hemat: hanya jika perlu)
  Supply.update = function (state, force) {
    const need = new Set();
    for (const d of Object.values(state.divisions)) need.add(d.country);
    for (const iso of need) {
      if (force || !state.rt.supply[iso] || state.rt.supplyDirty.has(iso) || state.day % 10 === 0) Supply.compute(state, iso);
    }
    state.rt.supplyDirty.clear();
    for (const d of Object.values(state.divisions)) d.supply = Supply.of(state, d);
  };
})(typeof window !== "undefined" ? window : globalThis);
