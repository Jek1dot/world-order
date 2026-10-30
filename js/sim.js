// ===== WORLD ORDER v0.4 — SIMULASI (satu tick = satu hari game) =====
// Urutan harian: diplomasi -> agregat -> perdagangan -> ekonomi tiap negara -> AI -> supply
//                -> pergerakan -> pertempuran -> pemulihan -> kapitulasi/damai.
// Pause dihentikan oleh pemanggil (UI); Sim.tick hanya dipanggil saat game berjalan.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World;
  const Sim = (WO.Sim = {});

  Sim.tick = function (state) {
    state.day++;
    const rt = state.rt;
    WO.Dip.tick(state);
    WO.State.refreshAggregates(state);
    WO.Eco.tradeStep(state);
    WO.Eco.prepareDay(state);
    for (const iso of W.countryIds) WO.Eco.tickCountry(state, iso);
    WO.AI.tick(state);
    WO.State.refreshAggregates(state);
    WO.Supply.update(state);
    WO.Mil.step(state);
    WO.War.resolveCombat(state);
    WO.Mil.recover(state);
    WO.State.refreshAggregates(state);
    WO.War.updateCapitulation(state);
    if (state.day % 7 === 0) WO.War.aiReview(state);
    if (state.day % 7 === 3) WO.War.withdrawIllegal(state);
    rt.dirty.panels = true;
  };

  Sim.run = function (state, days) { for (let i = 0; i < days; i++) Sim.tick(state); };
})(typeof window !== "undefined" ? window : globalThis);
