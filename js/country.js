// ===== WORLD ORDER v0.4 — NEGARA: IBU KOTA =====
// Ibu kota asli dari Natural Earth (kota ibu kota -> provinsi yang memuatnya).
// Pemindahan ibu kota: ada biaya, cooldown, syarat infrastruktur, dan penalti stabilitas.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, U = WO.util, C = WO.C;
  const Cap = (WO.Cap = {});

  Cap.cost = (state, iso) => +(2 + 0.003 * W.countries[iso].gdp).toFixed(1);

  Cap.canRelocate = function (state, iso, pid) {
    const c = state.countries[iso], sp = state.provinces[pid];
    if (!c || !c.exists) return { ok: false, reason: "Negara tidak valid." };
    if (!sp) return { ok: false, reason: "Provinsi tidak valid." };
    if (c.capitulated) return { ok: false, reason: "Negara sedang kapitulasi." };
    if (pid === c.capital) return { ok: false, reason: "Sudah menjadi ibu kota." };
    if (sp.owner !== iso) return { ok: false, reason: "Provinsi bukan milikmu." };
    if (sp.controller !== iso) return { ok: false, reason: "Provinsi sedang diduduki." };
    if (sp.infra < C.RELOCATE_MIN_INFRA) return { ok: false, reason: "Infrastruktur minimal " + C.RELOCATE_MIN_INFRA + " untuk jadi ibu kota." };
    const wait = c.lastRelocate + C.RELOCATE_COOLDOWN - state.day;
    if (wait > 0) return { ok: false, reason: "Cooldown pemindahan: " + wait + " hari lagi." };
    const cost = Cap.cost(state, iso);
    if (c.treasury < cost) return { ok: false, reason: "Kas tidak cukup (butuh $" + cost + " M)." };
    // tidak boleh memindahkan ibu kota ke provinsi yang sedang diserang
    if (WO.Mil.hostileIn(state, iso, pid).length) return { ok: false, reason: "Ada pasukan musuh di provinsi itu." };
    return { ok: true, cost };
  };

  Cap.relocate = function (state, iso, pid, free) {
    const chk = free ? { ok: true, cost: 0 } : Cap.canRelocate(state, iso, pid);
    if (!chk.ok) return { ok: false, msg: chk.reason };
    const c = state.countries[iso], old = c.capital;
    c.treasury -= chk.cost; c.stability = Math.max(5, c.stability - (free ? 2 : 5));
    c.capital = pid; c.lastRelocate = state.day; c.relocCount++;
    c.capitalHistory.push({ day: state.day, id: pid });
    state.rt.supplyDirty.add(iso); state.rt.dirty.units = true; state.rt.dirty.panels = true; state.rt.dirty.provinces.add(old); state.rt.dirty.provinces.add(pid);
    const msg = W.countries[iso].name + " memindahkan ibu kota dari " + W.provinces[old].name + " ke " + W.provinces[pid].name + ".";
    WO.log(state, msg, "capital", iso);
    return { ok: true, msg };
  };

  // provinsi terbaik untuk ibu kota baru: jauh dari musuh, infrastruktur & nilai (VP) tinggi
  Cap.bestCandidate = function (state, iso) {
    const enemies = state.rt.enemies[iso];
    const danger = new Set();
    for (const pid of Object.keys(state.rt.divsByProv)) {
      for (const d of WO.State.divisionsIn(state, pid)) if (enemies.has(d.country)) danger.add(pid);
    }
    for (const e of enemies) for (const pid of state.rt.controlled[e]) if (state.provinces[pid].owner === iso) danger.add(pid);
    const dist = new Map(); const q = [];
    for (const pid of danger) { dist.set(pid, 0); q.push(pid); }
    for (let i = 0; i < q.length; i++) {
      const cur = q[i], dd = dist.get(cur); if (dd >= 6) continue;
      for (const nx of W.provinces[cur].adj) if (!dist.has(nx)) { dist.set(nx, dd + 1); q.push(nx); }
    }
    let best = null, bs = -1;
    for (const pid of state.rt.owned[iso]) {
      const sp = state.provinces[pid];
      if (sp.controller !== iso || pid === state.countries[iso].capital || sp.infra < C.RELOCATE_MIN_INFRA) continue;
      const far = dist.has(pid) ? dist.get(pid) : 7;
      const sc = far * 10 + W.provinces[pid].vp + sp.infra * 2;
      if (sc > bs) { bs = sc; best = { pid, far }; }
    }
    return best;
  };

  // untuk negara yang kehilangan ibu kota karena transfer wilayah
  Cap.autoRelocate = function (state, iso) {
    let best = null, bv = -1;
    for (const pid of state.rt.owned[iso]) {
      if (state.provinces[pid].controller !== iso) continue;
      const v = W.provinces[pid].vp + state.provinces[pid].infra;
      if (v > bv) { bv = v; best = pid; }
    }
    if (best) Cap.relocate(state, iso, best, true);
  };

  // pemindahan oleh AI: hanya saat terancam, ada cooldown, dan dibatasi 2 kali per 365 hari
  Cap.aiMaybeRelocate = function (state, iso) {
    const c = state.countries[iso];
    if (c.capitulated || state.rt.enemies[iso].size === 0) return false;
    if (state.day - c.lastRelocate < C.RELOCATE_COOLDOWN) return false;
    const recent = c.capitalHistory.filter((h) => h.day > 0 && h.day > state.day - 365).length;
    if (recent >= 2) return false;
    const enemies = state.rt.enemies[iso];
    const capNear = W.provinces[c.capital];
    // ancaman: provinsi di sekitar ibu kota (<=2 langkah) dikuasai musuh atau berisi divisi musuh
    const near = WO.Path.bfs(c.capital, 2);
    let threat = state.provinces[c.capital].controller !== iso;
    for (const pid of near.keys()) {
      if (enemies.has(state.provinces[pid].controller)) threat = true;
      for (const d of WO.State.divisionsIn(state, pid)) if (enemies.has(d.country) && WO.Mil.isActive(state, d)) threat = true;
    }
    if (!threat) return false;
    const cand = Cap.bestCandidate(state, iso);
    if (!cand || cand.far < 3) return false;           // tidak ada tempat yang cukup aman
    return Cap.relocate(state, iso, cand.pid).ok;
  };
})(typeof window !== "undefined" ? window : globalThis);
