// ===== WORLD ORDER — EFEK & KONDISI (dipakai Fokus Nasional dan Event) =====
// Kosakata resmi ada di data/db/vocab.json (divalidasi oleh validator). Semua efek mengubah state sungguhan.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, C = WO.C, U = WO.util;
  const Fx = (WO.Fx = {});

  Fx.mult = (c, key) => 1 + ((c.mods && c.mods[key]) || 0) / 100;
  const owned = (state, iso) => [...state.rt.owned[iso]].filter((p) => state.provinces[p].controller === iso);

  Fx.cond = function (state, iso, cd) {
    const c = state.countries[iso], a = c.agg || {};
    switch (cd.type) {
      case "min_civ": return a.civ >= cd.value;
      case "min_mil": return a.mil >= cd.value;
      case "min_stability": return c.stability >= cd.value;
      case "max_stability": return c.stability <= cd.value;
      case "min_treasury": return c.treasury >= cd.value;
      case "min_gdp": return a.gdp >= cd.value;
      case "at_war": return state.rt.enemies[iso].size > 0;
      case "at_peace": return state.rt.enemies[iso].size === 0;
      case "min_divisions": return state.rt.divsByCountry[iso].size >= cd.value;
      case "has_flag": return !!(c.flags && c.flags[cd.flag] !== undefined);
      case "no_flag": return !(c.flags && c.flags[cd.flag] !== undefined);
      case "has_focus": return c.focus.done.indexOf(cd.focus) !== -1;
      case "capital_controlled": return state.provinces[c.capital].controller === iso;
    }
    return false;
  };
  Fx.condAll = (state, iso, list) => (list || []).every((cd) => Fx.cond(state, iso, cd));
  Fx.condText = function (cd) {
    const t = { min_civ: "≥ " + cd.value + " pabrik sipil", min_mil: "≥ " + cd.value + " pabrik militer", min_stability: "stabilitas ≥ " + cd.value, max_stability: "stabilitas ≤ " + cd.value,
      min_treasury: "kas ≥ $" + cd.value + " M", min_gdp: "PDB ≥ $" + cd.value + " M", at_war: "sedang berperang", at_peace: "sedang damai", min_divisions: "≥ " + cd.value + " divisi",
      has_flag: "flag " + cd.flag, no_flag: "tanpa flag " + cd.flag, has_focus: "fokus " + cd.focus, capital_controlled: "ibu kota dikuasai sendiri" };
    return t[cd.type] || cd.type;
  };

  const sign = (v) => (v >= 0 ? "+" : "−") + Math.abs(v);
  Fx.text = function (e) {
    switch (e.type) {
      case "add_stability": return "Stabilitas " + sign(e.value);
      case "add_treasury": return "Kas " + (e.pct_gdp !== undefined ? sign(e.pct_gdp) + "% PDB" : "$" + sign(e.amount) + " M");
      case "add_manpower_pct": return "Manpower " + sign(e.value) + "%";
      case "add_growth_pct": return "Pertumbuhan ekonomi " + sign(e.value) + "%";
      case "grant_factory": return "+" + e.count + " pabrik " + (e.building === "civ" ? "sipil" : "militer");
      case "add_infra_capital": return "Infrastruktur +1 di " + e.count + " provinsi utama";
      case "add_stock": return C.EQUIP_INFO[e.equip].name + " " + sign(e.amount);
      case "mod_add": return { constr: "Kecepatan konstruksi", eff: "Efisiensi produksi", atk: "Serangan divisi", def: "Pertahanan divisi", income: "Pendapatan pajak", manpower: "Regenerasi manpower" }[e.mod] + " " + sign(e.pct) + "%";
      case "add_opinion_neighbors": return "Opini negara tetangga " + sign(e.value);
      case "add_exhaustion": return "Kelelahan perang " + sign(e.value);
      case "set_flag": return "Penanda: " + e.flag;
      case "damage_infra": return "Infrastruktur rusak −" + e.amount + " di satu provinsi";
      case "add_resource": return "+" + e.days + " hari produksi " + C.RES_NAMES[e.res].toLowerCase();
    }
    return e.type;
  };

  // ctx.permanent: efek stabilitas dari fokus mengubah dasar stabilitas (permanen); event hanya bump sementara
  Fx.apply = function (state, iso, e, ctx) {
    ctx = ctx || {};
    const c = state.countries[iso], rt = state.rt, out = [];
    switch (e.type) {
      case "add_stability":
        c.stability = U.clamp(c.stability + e.value, 5, 100); if (ctx.permanent) c.baseStab = U.clamp(c.baseStab + e.value, 5, 100); break;
      case "add_treasury": {
        const amt = e.pct_gdp !== undefined ? (c.agg.gdp * e.pct_gdp) / 100 : e.amount; c.treasury += amt; break; }
      case "add_manpower_pct": c.manpower = Math.min((c.manpowerMax || c.manpower) * 1.5, c.manpower + (c.manpowerMax || 0) * e.value / 100); break;
      case "add_growth_pct": c.growth *= 1 + e.value / 100; rt.aggDirty.add(iso); break;
      case "grant_factory": {
        for (let i = 0; i < e.count; i++) {
          let best = null, bv = -1;
          for (const pid of owned(state, iso)) {
            const sp = state.provinces[pid]; if (sp.civ + sp.mil >= WO.Eco.slots(state, pid)) continue;
            const v = W.provinces[pid].popM; if (v > bv) { bv = v; best = pid; }
          }
          if (!best) { c.treasury += C.BUILD[e.building].cost; out.push("tidak ada slot pabrik"); continue; }
          state.provinces[best][e.building]++; rt.aggDirty.add(iso); rt.dirty.provinces.add(best); rt.supplyDirty.add(iso);
          out.push("pabrik " + e.building + " di " + W.provinces[best].name);
        }
        break; }
      case "add_infra_capital": {
        const list = owned(state, iso).filter((p) => state.provinces[p].infra < C.INFRA_MAX).sort((a, b) => (b === c.capital) - (a === c.capital) || W.provinces[b].popM - W.provinces[a].popM);
        for (const pid of list.slice(0, e.count)) { state.provinces[pid].infra++; rt.dirty.provinces.add(pid); }
        rt.supplyDirty.add(iso); break; }
      case "add_stock": c.stock[e.equip] = Math.max(0, c.stock[e.equip] + e.amount); break;
      case "mod_add": c.mods[e.mod] = (c.mods[e.mod] || 0) + e.pct; break;
      case "add_opinion_neighbors": {
        const nb = new Set();
        for (const pid of rt.owned[iso]) for (const nx of W.provinces[pid].adj) { const o = state.provinces[nx].controller; if (o !== iso && state.countries[o].exists) nb.add(o); }
        for (const o of nb) WO.Dip.addOpinion(state, iso, o, e.value); break; }
      case "add_exhaustion": c.exhaustion = U.clamp(c.exhaustion + e.value, 0, 100); break;
      case "set_flag": c.flags[e.flag] = state.day; break;
      case "damage_infra": {
        const list = owned(state, iso).filter((p) => state.provinces[p].infra > 0);
        if (list.length) { const pid = list[Math.floor(WO.rand(state) * list.length)]; state.provinces[pid].infra = Math.max(0, state.provinces[pid].infra - e.amount); rt.dirty.provinces.add(pid); rt.supplyDirty.add(iso); out.push(W.provinces[pid].name); }
        break; }
      case "add_resource": c.res[e.res] += ((c.agg && c.agg.res[e.res]) || 0) * e.days; break;
      default: throw new Error("efek tidak dikenal: " + e.type);
    }
    rt.dirty.panels = true;
    return out;
  };
  Fx.applyAll = (state, iso, list, ctx) => { const notes = []; for (const e of list) notes.push(...Fx.apply(state, iso, e, ctx)); return notes; };
})(typeof window !== "undefined" ? window : globalThis);
