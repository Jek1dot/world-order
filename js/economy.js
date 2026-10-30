// ===== WORLD ORDER v0.4 — EKONOMI, KONSTRUKSI, PRODUKSI =====
// Rantai: pabrik sipil -> konstruksi pabrik militer -> produksi peralatan (butuh sumber daya)
//         -> stok peralatan -> rekrutmen divisi (butuh manpower + peralatan).
// Rumus utama ada di bagian atas dan di WO.C (core.js). Angka SINTETIS untuk balancing.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, U = WO.util, C = WO.C;
  const Eco = (WO.Eco = {});

  const stabMod = (c) => 0.6 + 0.4 * c.stability / 100;           // pengali produktivitas
  Eco.stabMod = stabMod;
  Eco.slots = (state, pid) => C.SLOTS_BASE + C.SLOTS_PER_INFRA * Math.floor(state.provinces[pid].infra);
  Eco.queuedAt = (c, pid, type) => c.queue.filter((q) => q.province === pid && (type ? q.type === type : q.type !== "infra")).length;
  Eco.freeFactories = function (c) {
    let used = 0; for (const l of c.lines) used += l.factories;
    return Math.max(0, (c.agg ? c.agg.mil : 0) - used);
  };
  Eco.armyCount = (state, iso) => state.rt.divsByCountry[iso].size;

  // ---------- konstruksi ----------
  Eco.canBuild = function (state, iso, type, pid) {
    const c = state.countries[iso], b = C.BUILD[type], sp = state.provinces[pid];
    if (!c || !c.exists) return { ok: false, reason: "Negara tidak valid." };
    if (!b) return { ok: false, reason: "Jenis bangunan tidak dikenal." };
    if (!sp) return { ok: false, reason: "Provinsi tidak valid." };
    if (c.capitulated) return { ok: false, reason: "Negara sedang kapitulasi." };
    if (sp.owner !== iso) return { ok: false, reason: "Provinsi ini bukan milikmu." };
    if (sp.controller !== iso) return { ok: false, reason: "Provinsi sedang diduduki musuh." };
    if (c.queue.length >= 30) return { ok: false, reason: "Antrean konstruksi penuh (30)." };
    if (c.treasury < b.cost) return { ok: false, reason: "Kas tidak cukup (butuh $" + b.cost + " M)." };
    if (type === "infra") {
      if (sp.infra + Eco.queuedAt(c, pid, "infra") >= C.INFRA_MAX) return { ok: false, reason: "Infrastruktur sudah maksimum." };
    } else {
      const used = sp.civ + sp.mil + Eco.queuedAt(c, pid);
      if (used >= Eco.slots(state, pid)) return { ok: false, reason: "Slot pabrik penuh (" + used + "/" + Eco.slots(state, pid) + "). Tingkatkan infrastruktur." };
    }
    return { ok: true };
  };
  Eco.queueBuild = function (state, iso, type, pid) {
    const chk = Eco.canBuild(state, iso, type, pid);
    if (!chk.ok) return { ok: false, msg: chk.reason };
    const c = state.countries[iso], b = C.BUILD[type];
    c.treasury -= b.cost;
    c.queue.push({ id: "B" + state.nextProjId++, type, province: pid, progress: 0, pts: b.pts, cost: b.cost });
    WO.flag(state, "build_" + type, iso);
    state.rt.dirty.panels = true;
    return { ok: true, msg: b.name + " dijadwalkan di " + W.provinces[pid].name + "." };
  };
  Eco.cancelBuild = function (state, iso, projId) {
    const c = state.countries[iso], i = c.queue.findIndex((q) => q.id === projId);
    if (i < 0) return { ok: false, msg: "Proyek tidak ditemukan." };
    const q = c.queue[i]; c.treasury += q.cost * (1 - q.progress / q.pts) * 0.5;
    c.queue.splice(i, 1); state.rt.dirty.panels = true;
    return { ok: true, msg: "Proyek dibatalkan (refund 50% sisa biaya)." };
  };

  // ---------- produksi ----------
  Eco.setProduction = function (state, iso, equip, n) {
    const c = state.countries[iso];
    if (!C.EQUIP_INFO[equip]) return { ok: false, msg: "Peralatan tidak dikenal." };
    n = Math.max(0, Math.floor(n));
    let line = c.lines.find((l) => l.equip === equip);
    const others = c.lines.reduce((s, l) => s + (l === line ? 0 : l.factories), 0);
    if (others + n > c.agg.mil) return { ok: false, msg: "Pabrik militer tidak cukup (tersedia " + Math.max(0, c.agg.mil - others) + ")." };
    if (n === 0) { c.lines = c.lines.filter((l) => l !== line); state.rt.dirty.panels = true; return { ok: true, msg: "Lini produksi dihentikan." }; }
    if (!line) { line = { id: "L" + state.nextLineId++, equip, factories: 0, eff: C.EFF_START, produced: 0 }; c.lines.push(line); }
    if (n > line.factories) line.eff = (line.eff * line.factories + C.EFF_START * (n - line.factories)) / n;   // pabrik baru mulai dari efisiensi rendah
    line.factories = n; state.rt.dirty.panels = true; WO.flag(state, "production", iso);
    return { ok: true, msg: "Lini " + C.EQUIP_INFO[equip].name + ": " + n + " pabrik." };
  };

  // ---------- perdagangan sederhana (perjanjian dagang) ----------
  Eco.tradeStep = function (state) {
    for (const p of state.diplo.pacts) {
      if (p.type !== "trade") continue;
      for (const [x, y] of [[p.a, p.b], [p.b, p.a]]) {
        const buyer = state.countries[x], seller = state.countries[y];
        if (!buyer.exists || !seller.exists || buyer.capitulated || seller.capitulated) continue;
        for (const r of C.RESOURCES) {
          const thr = Math.max(60, 20 * (buyer.agg ? buyer.agg.res[r] : 0));
          const sthr = Math.max(60, 20 * (seller.agg ? seller.agg.res[r] : 0)) * 2;
          const amt = Math.min(10, thr - buyer.res[r], seller.res[r] - sthr);
          if (amt <= 0.01) continue;
          const price = amt * 0.01;
          if (buyer.treasury < price) continue;
          buyer.res[r] += amt; seller.res[r] -= amt; buyer.treasury -= price; seller.treasury += price;
          buyer.trade = buyer.trade || {}; buyer.trade[r] = (buyer.trade[r] || 0) + amt;
        }
      }
    }
  };

  // satu kali pemindaian divisi per hari (hindari O(negara x divisi))
  Eco.prepareDay = function (state) {
    const st = {};
    for (const d of Object.values(state.divisions)) {
      const e = st[d.country] || (st[d.country] = { n: 0, food: 0, oil: 0, fight: 0 });
      const t = C.DIV_TYPES[d.type];
      e.n++; e.food += t.food; e.oil += t.oil;
      if (state.rt.fighting && state.rt.fighting.has(d.id)) e.fight++;
    }
    state.rt.divStats = st;
  };

  // ---------- tick harian per negara ----------
  Eco.tickCountry = function (state, iso) {
    const c = state.countries[iso]; if (!c.exists) return;
    const a = c.agg || State_agg(state, iso);
    const sm = stabMod(c);
    const rep = { res: {}, income: 0, upkeep: 0, war: 0 };

    // 1. sumber daya masuk
    for (const r of C.RESOURCES) { c.res[r] += a.res[r]; rep.res[r] = { in: a.res[r], out: 0 }; }

    // 2. konsumsi: batu bara pabrik, pangan & minyak tentara
    const coalNeed = (a.civ + a.mil) * C.COAL_PER_FACTORY;
    let coalF = 1;
    if (coalNeed > 0) {
      if (c.res.coal >= coalNeed) c.res.coal -= coalNeed; else { coalF = c.res.coal / coalNeed; c.res.coal = 0; }
      rep.res.coal.out += coalNeed * coalF;
    }
    const ds = (state.rt.divStats && state.rt.divStats[iso]) || { n: 0, food: 0, oil: 0, fight: 0 };
    const foodNeed = ds.food, oilNeed = ds.oil, nDiv = ds.n, nFight = ds.fight;
    c.foodF = 1; c.oilF = 1;
    if (foodNeed > 0) { if (c.res.food >= foodNeed) c.res.food -= foodNeed; else { c.foodF = c.res.food / foodNeed; c.res.food = 0; } rep.res.food.out += foodNeed * c.foodF; }
    if (oilNeed > 0) { if (c.res.oil >= oilNeed) c.res.oil -= oilNeed; else { c.oilF = c.res.oil / oilNeed; c.res.oil = 0; } rep.res.oil.out += oilNeed * c.oilF; }
    c.coalF = coalF;
    const eff = sm * coalF;

    // 3. konstruksi
    let cap = a.civ * C.CONSTR_PER_CIV * eff;
    rep.constrCap = cap;
    for (let i = 0; i < c.queue.length && cap > 0.001; i++) {
      const q = c.queue[i], sp = state.provinces[q.province];
      if (sp.owner !== iso || sp.controller !== iso) continue;           // wilayah diduduki: proyek berhenti
      const rate = Math.min(cap, C.CONSTR_MAX_RATE, q.pts - q.progress);
      q.progress += rate; cap -= rate;
    }
    for (let i = c.queue.length - 1; i >= 0; i--) {
      const q = c.queue[i];
      if (q.progress >= q.pts - 1e-6) {
        const sp = state.provinces[q.province];
        if (q.type === "civ") sp.civ++; else if (q.type === "mil") sp.mil++; else if (q.type === "infra") sp.infra = Math.min(C.INFRA_MAX, sp.infra + 1);
        c.queue.splice(i, 1);
        state.rt.aggDirty.add(iso); state.rt.supplyDirty.add(iso); state.rt.dirty.provinces.add(q.province); state.rt.dirty.panels = true;
        WO.log(state, C.BUILD[q.type].name + " selesai di " + W.provinces[q.province].name + ".", "econ", iso);
      }
    }

    // 4. produksi peralatan
    let used = 0; for (const l of c.lines) used += l.factories;
    const scale = used > a.mil ? a.mil / used : 1;                       // pabrik hilang (diduduki) -> lini menyusut
    for (const l of c.lines) {
      const info = C.EQUIP_INFO[l.equip];
      const pp = l.factories * scale * C.PP_PER_MIL * l.eff * eff;
      let items = pp / info.pp, ratio = 1;
      for (const r in info.res) { const need = items * info.res[r]; if (need > 0) ratio = Math.min(ratio, c.res[r] / need); }
      ratio = U.clamp(ratio, 0, 1); items *= ratio;
      for (const r in info.res) { const use = items * info.res[r]; c.res[r] -= use; rep.res[r].out += use; }
      c.stock[l.equip] += items; l.produced += items; l.lastItems = items; l.lastRatio = ratio;
      l.eff = Math.min(1, l.eff + C.EFF_GROW);
    }

    // 5. batas stok sumber daya
    for (const r of C.RESOURCES) c.res[r] = Math.min(c.res[r], Math.max(500, a.res[r] * 90));

    // 6. kas
    const income = a.gdp / 365 * 0.20 * sm;
    const upkeep = nDiv * 0.004, warCost = nFight * 0.01;
    c.treasury += income - upkeep - warCost;
    rep.income = income; rep.upkeep = upkeep; rep.war = warCost;

    // 7. manpower
    const max = Math.max(1, a.popM * 1e6 * 0.03);
    c.manpowerMax = Math.round(max);
    c.manpower = Math.min(max, c.manpower + a.popM * 1e6 * 0.00005 * sm);

    // 8. pertumbuhan, kelelahan perang, stabilitas
    const atWar = state.rt.enemies[iso].size > 0;
    c.growth = Math.max(0.3, c.growth * (1 + (atWar ? -0.00001 : 0.00004) * sm));
    c.exhaustion = U.clamp(c.exhaustion + (atWar ? 0.02 : -0.05), 0, 100);
    const lostFrac = a.vpOwned > 0 ? a.vpLost / a.vpOwned : 0;
    let target = c.baseStab - 0.35 * c.exhaustion - 35 * lostFrac;
    if (c.foodF < 1) target -= 10;
    if (c.treasury < 0) target -= 10;
    c.stability = U.clamp(c.stability + U.clamp(target - c.stability, -0.3, 0.3), 5, 100);

    c.lastReport = rep;
  };
  function State_agg(state, iso) { return WO.State.aggregate(state, iso); }
})(typeof window !== "undefined" ? window : globalThis);
