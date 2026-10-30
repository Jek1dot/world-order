const WO = require("./load.js");
const W = WO.World, S = WO.State;
const days = +process.argv[2] || 365, aggressive = process.argv[3] !== "peace";
const state = S.newGame({ seed: 99, aiAggressive: aggressive });
const sum = (f) => W.countryIds.reduce((a, i) => a + f(state.countries[i]), 0);
const before = { civ: sum((c) => c.agg.civ), mil: sum((c) => c.agg.mil), div: Object.keys(state.divisions).length, lines: sum((c) => c.lines.length), stockR: sum((c) => c.stock.rifles) };
let worst = 0, total = 0, problems = 0, firstProblem = null;
const t00 = Date.now();
for (let i = 0; i < days; i++) {
  const t0 = process.hrtime.bigint();
  WO.Sim.tick(state);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6; total += ms; worst = Math.max(worst, ms);
  if (i % 10 === 0 || i === days - 1) {
    const pr = WO.Save.validate(state, false);
    if (pr.length) { problems += pr.length; if (!firstProblem) firstProblem = "hari " + state.day + ": " + pr.slice(0, 3).join("; "); }
  }
}
const alive = W.countryIds.filter((i) => state.countries[i].exists).length;
const atWar = W.countryIds.filter((i) => state.rt.enemies[i].size > 0).length;
const capitulated = W.countryIds.filter((i) => state.countries[i].capitulated).length;
const changedOwner = W.provinceIds.filter((p) => state.provinces[p].owner !== W.provinces[p].country).length;
const occupied = W.provinceIds.filter((p) => state.provinces[p].owner !== state.provinces[p].controller).length;
const relocs = W.countryIds.reduce((s, i) => s + state.countries[i].capitalHistory.length - 1, 0);
const wars = new Set(state.wars.map((w) => w.a + "-" + w.b)).size;
console.log(`hari: ${state.day} | rata-rata ${(total / days).toFixed(1)} ms/hari | terburuk ${worst.toFixed(0)} ms | total ${((Date.now() - t00) / 1000).toFixed(1)} s`);
console.log(`negara hidup ${alive}/250 | sedang perang ${atWar} | kapitulasi ${capitulated} | hostilitas aktif ${wars} | provinsi pindah owner ${changedOwner} | provinsi diduduki ${occupied} | relokasi ibu kota ${relocs}`);
console.log(`divisi ${Object.keys(state.divisions).length} | pelanggaran invarian: ${problems}${firstProblem ? " | " + firstProblem : ""}`);
const evs = state.log.filter((l) => /KAPITULASI|menyatakan perang|dipindahkan|Perdamaian/.test(l.text)).slice(-8).map((l) => "  [" + WO.dateString(l.day) + "] " + l.text);
console.log(evs.join("\n"));
const after = { civ: sum((c) => c.exists ? c.agg.civ : 0), mil: sum((c) => c.exists ? c.agg.mil : 0), div: Object.keys(state.divisions).length, lines: sum((c) => c.lines.length), stockR: sum((c) => c.stock.rifles) };
console.log('AI ekonomi: pabrik sipil', before.civ, '->', after.civ, '| militer', before.mil, '->', after.mil, '| lini produksi', before.lines, '->', after.lines, '| divisi', before.div, '->', after.div, '| stok senapan', Math.round(before.stockR), '->', Math.round(after.stockR));
process.exit(problems ? 1 : 0);
