const WO = require("./load.js"); const W = WO.World;
const state = WO.State.newGame({ seed: 99, aiAggressive: true });
WO.Sim.run(state, 60);
const T = {}; const time = (k, fn) => { const t = process.hrtime.bigint(); fn(); T[k] = (T[k] || 0) + Number(process.hrtime.bigint() - t) / 1e6; };
const N = 40;
for (let i = 0; i < N; i++) {
  state.day++;
  time("dip.tick", () => WO.Dip.tick(state));
  time("aggregates", () => WO.State.refreshAggregates(state));
  time("trade", () => WO.Eco.tradeStep(state));
  time("prepareDay", () => WO.Eco.prepareDay(state));
  time("eco.tickCountry x250", () => { for (const iso of W.countryIds) WO.Eco.tickCountry(state, iso); });
  time("ai", () => WO.AI.tick(state));
  time("aggregates2", () => WO.State.refreshAggregates(state));
  time("supply", () => WO.Supply.update(state));
  time("mil.step", () => WO.Mil.step(state));
  time("combat", () => WO.War.resolveCombat(state));
  time("recover", () => WO.Mil.recover(state));
  time("capitulation", () => WO.War.updateCapitulation(state));
}
for (const [k, v] of Object.entries(T).sort((a, b) => b[1] - a[1])) console.log(k.padEnd(24), (v / N).toFixed(2), "ms/hari");
