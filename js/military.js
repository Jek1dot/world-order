// ===== WORLD ORDER v0.4 — MILITER (divisi, rekrutmen, perintah, pergerakan) =====
// Divisi bergerak provinsi demi provinsi lewat graf tetangga, memakan waktu game.
// Masuk wilayah musuh yang dijaga = menyerang (diselesaikan WO.War.resolveCombat).
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, U = WO.util, C = WO.C;
  const Mil = (WO.Mil = {});

  Mil.isActive = (state, d) => !state.countries[d.country].capitulated;

  // divisi musuh aktif di sebuah provinsi (dari sudut pandang negara iso)
  Mil.hostileIn = function (state, iso, pid) {
    const out = [], S = state.rt.divsByProv[pid]; if (!S) return out;
    for (const id of S) {
      const x = state.divisions[id];
      if (x.country !== iso && Mil.isActive(state, x) && WO.Dip.atWar(state, iso, x.country)) out.push(x);
    }
    return out;
  };

  // ---------- rekrutmen ----------
  Mil.canRecruit = function (state, iso, type, pid) {
    const c = state.countries[iso], t = C.DIV_TYPES[type], sp = state.provinces[pid];
    if (!c || !c.exists) return { ok: false, reason: "Negara tidak valid." };
    if (!t) return { ok: false, reason: "Tipe divisi tidak dikenal." };
    if (!sp) return { ok: false, reason: "Provinsi tidak valid." };
    if (c.capitulated) return { ok: false, reason: "Negara sedang kapitulasi." };
    if (sp.owner !== iso || sp.controller !== iso) return { ok: false, reason: "Divisi hanya bisa direkrut di provinsi milik & kendalimu." };
    if (Mil.hostileIn(state, iso, pid).length) return { ok: false, reason: "Ada pasukan musuh di provinsi ini." };
    if (c.treasury < t.cost) return { ok: false, reason: "Kas tidak cukup (butuh $" + t.cost + " M)." };
    if (c.manpower < t.man) return { ok: false, reason: "Manpower tidak cukup (butuh " + t.man.toLocaleString("en-US") + ")." };
    for (const e in t.eq) if (c.stock[e] < t.eq[e]) return { ok: false, reason: "Peralatan kurang: " + C.EQUIP_INFO[e].name + " " + Math.floor(c.stock[e]) + "/" + t.eq[e] + "." };
    return { ok: true };
  };
  Mil.recruit = function (state, iso, type, pid) {
    const chk = Mil.canRecruit(state, iso, type, pid);
    if (!chk.ok) return { ok: false, msg: chk.reason };
    const c = state.countries[iso], t = C.DIV_TYPES[type];
    c.treasury -= t.cost; c.manpower -= t.man;
    for (const e in t.eq) c.stock[e] -= t.eq[e];
    const d = WO.State.createDivision(state, iso, type, pid);
    WO.flag(state, "recruit", iso);
    c.peakArmy = Math.max(c.peakArmy, WO.State.armyStrength(state, iso));
    state.rt.dirty.panels = true;
    return { ok: true, msg: d.name + " direkrut di " + W.provinces[pid].name + " (latihan " + C.TRAIN_DAYS + " hari).", division: d };
  };
  Mil.disband = function (state, iso, divId) {
    const d = state.divisions[divId];
    if (!d || d.country !== iso) return { ok: false, msg: "Divisi tidak ditemukan." };
    const c = state.countries[iso], t = C.DIV_TYPES[d.type], f = d.str / 100;
    c.manpower += Math.round(t.man * f * 0.8);                 // sebagian kembali ke pool
    for (const e in t.eq) c.stock[e] += t.eq[e] * f * 0.6;
    WO.State.removeDivision(state, divId);
    state.rt.dirty.panels = true;
    return { ok: true, msg: d.name + " dibubarkan (sebagian manpower & peralatan kembali)." };
  };

  // ---------- perintah ----------
  Mil.orderMove = function (state, iso, divIds, target) {
    if (!W.provinces[target]) return { ok: false, msg: "Tujuan tidak valid." };
    let moved = 0, failed = 0, reason = "", maxDays = 0, enemy = 0;
    for (const id of divIds) {
      const d = state.divisions[id];
      if (!d || d.country !== iso || !Mil.isActive(state, d)) { failed++; reason = reason || "Divisi tidak bisa menerima perintah."; continue; }
      if (d.province === target) { d.order = null; d.attacking = null; failed++; reason = reason || "Sudah berada di tujuan."; continue; }
      const r = WO.Path.find(state, iso, d.province, target, { speed: C.DIV_TYPES[d.type].speed });
      if (!r.ok) { failed++; reason = reason || r.reason; continue; }
      d.order = { path: r.path, idx: 0, progress: 0, target };
      d.attacking = null;
      moved++; maxDays = Math.max(maxDays, r.days); enemy = Math.max(enemy, r.enemy);
    }
    state.rt.dirty.units = true;
    if (!moved) return { ok: false, msg: reason || "Tidak ada divisi yang bisa bergerak." };
    WO.flag(state, "move", iso);
    return { ok: true, moved, failed, days: maxDays,
      msg: moved + " divisi bergerak ke " + W.provinces[target].name + " (~" + Math.ceil(maxDays) + " hari)" +
           (enemy ? ", melewati " + enemy + " provinsi musuh" : "") + (failed ? ". " + failed + " gagal: " + reason : ".") };
  };
  Mil.cancelOrder = function (state, iso, divIds) {
    let n = 0;
    for (const id of divIds) { const d = state.divisions[id]; if (d && d.country === iso && (d.order || d.attacking)) { d.order = null; d.attacking = null; n++; } }
    state.rt.dirty.units = true;
    return { ok: n > 0, msg: n ? n + " perintah dibatalkan." : "Tidak ada perintah aktif." };
  };

  // ---------- pergerakan harian ----------
  Mil.step = function (state) {
    for (const d of Object.values(state.divisions)) {
      const o = d.order;
      if (!o || state.day < d.readyDay || !Mil.isActive(state, d)) { if (!o) d.attacking = null; continue; }
      const iso = d.country, t = C.DIV_TYPES[d.type];
      const next = o.path[o.idx];
      if (!next) { d.order = null; d.attacking = null; continue; }
      const cls = WO.Path.access(state, iso, next);
      const isSea = !W.isAdjacent(d.province, next);
      const here = WO.Path.access(state, iso, d.province);
      if (!cls || (isSea && (cls === "enemy" || (here !== "own" && here !== "friend")))) {
        d.order = null; d.attacking = null;
        WO.log(state, d.name + ": jalur ke " + W.provinces[next].name + " tidak lagi valid, perintah dibatalkan.", "mil", iso);
        continue;
      }
      if (cls === "enemy") {
        const def = Mil.hostileIn(state, iso, next);
        if (def.length) {
          // menyerang hanya jika organisasi cukup
          if (d.org >= t.org * C.ATTACK_MIN_ORG) d.attacking = next; else d.attacking = null;
          continue;
        }
      }
      d.attacking = null;
      // penyeberangan laut: waktu naik kapal
      if (isSea && o.progress === 0 && o.load === undefined) o.load = C.SEA_LOAD_DAYS;
      if (isSea && o.load > 0) { o.load--; continue; }
      const terrain = C.TERRAIN[W.provinces[next].terrain];
      const sup = 0.5 + 0.5 * d.supply;
      let fuel = 1; if (t.oil > 0) fuel = 0.4 + 0.6 * (state.countries[iso].oilF === undefined ? 1 : state.countries[iso].oilF);
      const speed = isSea ? C.SEA_SPEED : t.speed * terrain.sp * (1 + 0.08 * state.provinces[next].infra) * sup * fuel;
      const len = isSea ? (W.seaKm(d.province, next) || W.dist(d.province, next)) : W.dist(d.province, next);
      o.progress += speed;
      if (o.progress >= len) {
        WO.State.moveDivisionTo(state, d, next);
        o.progress = 0; o.load = undefined; o.idx++;
        if (cls === "enemy" && WO.Dip.atWar(state, iso, state.provinces[next].controller)) WO.War.capture(state, next, iso);
        if (o.idx >= o.path.length) d.order = null;
      }
    }
  };

  // ---------- pemulihan harian: organisasi, reinforcement, atrisi ----------
  Mil.recover = function (state) {
    const fighting = state.rt.fighting;
    for (const d of Object.values(state.divisions)) {
      const c = state.countries[d.country]; if (!c.exists) continue;
      const t = C.DIV_TYPES[d.type], fought = fighting.has(d.id);
      if (!fought) d.org = Math.min(t.org, d.org + C.ORG_REGEN * (0.3 + 0.7 * d.supply));
      if (d.supply < 0.25 && state.day >= d.readyDay) d.str = Math.max(1, d.str - 0.5 * (0.25 - d.supply) / 0.25);   // atrisi
      if (!fought && d.str < 100 && d.supply >= 0.3 && state.day >= d.readyDay) {
        let gain = Math.min(100 - d.str, C.REINFORCE * d.supply);
        const needMan = gain / 100 * t.man;
        let ratio = needMan > 0 ? Math.min(1, c.manpower / needMan) : 1;
        for (const e in t.eq) { const need = gain / 100 * t.eq[e]; if (need > 0) ratio = Math.min(ratio, c.stock[e] / need); }
        ratio = U.clamp(ratio, 0, 1); gain *= ratio;
        if (gain > 0) {
          c.manpower -= gain / 100 * t.man;
          for (const e in t.eq) c.stock[e] -= gain / 100 * t.eq[e];
          d.str = Math.min(100, d.str + gain);
        }
      }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
