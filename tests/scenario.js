const WO = require("./load.js");
const W = WO.World, S = WO.State, C = WO.C;
let fails = 0, checks = 0;
const check = (name, cond, extra) => { checks++; if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  -> " + extra : "")); };
const pid = (n, c) => Object.values(W.provinces).find((p) => p.name === n && p.country === c).id;
const pname = (id) => W.provinces[id].name;

const state = S.newGame({ seed: 7 });
S.setPlayer(state, "IDN");
const me = state.countries.IDN;
const day = (n) => { for (let i = 0; i < n; i++) { WO.Sim.tick(state); const pr = WO.Save.validate(state, false); if (pr.length) { check("invarian hari " + state.day, false, pr.slice(0, 3).join("; ")); process.exit(1); } } };

// 1. negara & ibu kota
check("ibu kota Indonesia = Jakarta Raya (data Natural Earth)", pname(me.capital) === "Jakarta Raya" && !W.countries.IDN.capitalApprox);
check("4578 provinsi dimuat", W.provinceIds.length === 4578);

// 2. bangun pabrik militer di Jawa
const jabar = pid("Jawa Barat", "IDN");
const mil0 = state.provinces[jabar].mil, tr0 = me.treasury;
let r = WO.Eco.queueBuild(state, "IDN", "mil", jabar);
check("antre pabrik militer di Jawa Barat", r.ok, r.msg);
check("kas berkurang saat antre", me.treasury < tr0);
r = WO.Eco.queueBuild(state, "IDN", "mil", pid("Jawa Barat", "IDN")); // masih boleh (slot cukup)
WO.Eco.cancelBuild(state, "IDN", me.queue[1].id);
check("tidak bisa bangun di provinsi negara lain", !WO.Eco.queueBuild(state, "IDN", "civ", pid("Dili", "TLS")).ok);
let built = 0; for (let i = 0; i < 120 && !built; i++) { day(1); if (state.provinces[jabar].mil > mil0) built = state.day; }
check("pabrik militer selesai setelah beberapa hari (butuh waktu)", built > 10, "hari ke-" + built);
check("kapasitas pabrik militer naik di agregat", me.agg.mil === 10, me.agg.mil);

// 3. produksi
const free = WO.Eco.freeFactories(me);
check("ada pabrik militer yang menganggur", free === 10, free);
r = WO.Eco.setProduction(state, "IDN", "rifles", 6); check("lini senapan 6 pabrik", r.ok, r.msg);
r = WO.Eco.setProduction(state, "IDN", "artillery", 4); check("lini artileri 4 pabrik", r.ok, r.msg);
check("tidak bisa alokasi melebihi pabrik", !WO.Eco.setProduction(state, "IDN", "tanks", 1).ok);
const rif0 = me.stock.rifles, steel0 = me.res.steel;
day(30);
check("senapan bertambah dari produksi", me.stock.rifles > rif0 + 100, Math.floor(me.stock.rifles - rif0));
check("artileri bertambah dari produksi", me.lines.find((l) => l.equip === "artillery").produced > 5, me.lines.find((l) => l.equip === "artillery").produced.toFixed(1));
check("efisiensi produksi naik seiring waktu", me.lines[0].eff > 0.3, me.lines[0].eff.toFixed(2));

// 4. rekrutmen
const divs0 = WO.Eco.armyCount(state, "IDN"), man0 = me.manpower, rifS = me.stock.rifles;
r = WO.Mil.recruit(state, "IDN", "infantry", me.capital);
check("rekrut divisi infanteri di Jakarta", r.ok, r.msg);
check("manpower berkurang 10.000", man0 - me.manpower >= 9999 && man0 - me.manpower <= 10001 + 5, Math.round(man0 - me.manpower));
check("senapan berkurang 1000", Math.round(rifS - me.stock.rifles) === 1000);
check("divisi bertambah 1", WO.Eco.armyCount(state, "IDN") === divs0 + 1);
check("tidak bisa rekrut di wilayah asing", !WO.Mil.recruit(state, "IDN", "infantry", pid("Dili", "TLS")).ok);
const div = r.division;
const startP = div.province;
const o1 = WO.Mil.orderMove(state, "IDN", [div.id], pid("Nusa Tenggara Timur", "IDN"));
check("perintah gerak ke NTT diterima (jalur laut domestik)", o1.ok, o1.msg);
day(3);
check("divisi dalam latihan tidak bergerak", div.province === startP);

// 5. gerak berbasis waktu (tanpa teleportasi)
let steps = 0, last = div.province, teleports = 0, seaHops = 0;
const startDay = state.day;
for (let i = 0; i < 120 && div.order; i++) {
  day(1);
  if (div.province !== last) {
    steps++;
    const adj = W.isAdjacent(last, div.province), sea = W.seaKm(last, div.province) !== null;
    if (!adj && !sea) teleports++;
    if (!adj && sea) seaHops++;
    last = div.province;
  }
}
check("divisi sampai di NTT", pname(div.province) === "Nusa Tenggara Timur", pname(div.province));
check("perjalanan butuh waktu (>15 hari) & melalui >2 provinsi", state.day - startDay > 15 && steps >= 3, (state.day - startDay) + " hari, " + steps + " langkah");
check("tidak ada teleportasi (semua langkah tetangga atau jalur laut)", teleports === 0);
check("ada penyeberangan laut domestik", seaHops >= 1, seaHops);

// 6. pertahanan musuh & izin militer
const tlsCap = state.countries.TLS.capital;
check("ibu kota Timor-Leste = Dili", pname(tlsCap) === "Dili");
check("tidak bisa memerintah masuk wilayah netral tanpa perang", !WO.Mil.orderMove(state, "IDN", [div.id], tlsCap).ok, WO.Mil.orderMove(state, "IDN", [div.id], tlsCap).msg);
check("tidak bisa perang dengan diri sendiri", !WO.Dip.declareWar(state, "IDN", "IDN").ok);
// kumpulkan pasukan: pindahkan 8 divisi Indonesia ke NTT
const army = WO.State.countryDivisions(state, "IDN").filter((d) => d.type === "infantry").map((d) => d.id);
const mv = WO.Mil.orderMove(state, "IDN", army, pid("Nusa Tenggara Timur", "IDN"));
check("pasukan utama bergerak ke NTT", mv.ok, mv.msg);
day(60);
const atNtt = WO.State.divisionsIn(state, pid("Nusa Tenggara Timur", "IDN")).filter((d) => d.country === "IDN");
check("pasukan tiba di NTT", atNtt.length >= 6, atNtt.length);

// 7. deklarasi perang & serangan
const exh0 = me.exhaustion;
r = WO.Dip.declareWar(state, "IDN", "TLS");
check("deklarasi perang Indonesia -> Timor-Leste", r.ok, r.msg);
check("tidak bisa deklarasi perang dua kali", !WO.Dip.declareWar(state, "IDN", "TLS").ok);
check("status perang tercatat", WO.Dip.atWar(state, "IDN", "TLS") && WO.Dip.atWar(state, "TLS", "IDN"));
const owner0 = Object.fromEntries(state.rt.owned.TLS.size ? [...state.rt.owned.TLS].map((p) => [p, state.provinces[p].owner]) : []);
const tlsDivs0 = WO.State.countryDivisions(state, "TLS").length;
const go = WO.Mil.orderMove(state, "IDN", atNtt.map((d) => d.id), tlsCap);
check("perintah serang ibu kota Dili (lewat provinsi musuh)", go.ok, go.msg);
let firstCombat = 0, capturedDay = 0, capLostDay = 0, capitulatedDay = 0, minStr = 100, minOrg = 100;
for (let i = 0; i < 200 && !capitulatedDay; i++) {
  day(1);
  if (!firstCombat && Object.keys(state.rt.combats).length) firstCombat = state.day;
  for (const d of Object.values(state.divisions)) if (d.country === "TLS") { minStr = Math.min(minStr, d.str); minOrg = Math.min(minOrg, d.org); }
  if (!capLostDay && state.provinces[tlsCap].controller === "IDN") capLostDay = state.day;
  if (state.countries.TLS.capitulated) capitulatedDay = state.day;
}
check("pertempuran terjadi", firstCombat > 0, "hari " + firstCombat);
check("pertempuran mengurangi strength & organization pembela", minStr < 100 && minOrg < C.DIV_TYPES.infantry.org, "str min " + minStr.toFixed(1) + ", org min " + minOrg.toFixed(1));
check("Dili (ibu kota) diduduki Indonesia", capLostDay > 0, "hari " + capLostDay);
check("OWNER Dili tetap Timor-Leste, hanya CONTROLLER berubah", state.provinces[tlsCap].owner === "TLS" && state.provinces[tlsCap].controller === "IDN");
let ownerChanged = 0; for (const p in owner0) if (state.provinces[p].owner !== owner0[p]) ownerChanged++;
check("pendudukan tidak mengubah owner provinsi mana pun", ownerChanged === 0);
check("kelelahan perang Indonesia naik", me.exhaustion > exh0, exh0.toFixed(1) + " -> " + me.exhaustion.toFixed(1));
check("korban jatuh di kedua pihak", me.casualties > 0 && state.countries.TLS.casualties > 0, Math.round(me.casualties) + " / " + Math.round(state.countries.TLS.casualties));
check("Timor-Leste kapitulasi", capitulatedDay > 0, "hari " + capitulatedDay);
check("kapitulasi TIDAK instan saat ibu kota jatuh", capitulatedDay - capLostDay >= 0 && (capitulatedDay > capLostDay || state.countries.TLS.pressure === null), "jeda " + (capitulatedDay - capLostDay) + " hari");
console.log("   Tekanan TLS saat kapitulasi: ", JSON.stringify(state.countries.TLS.pressure), "| prov dikuasai IDN:", WO.War.controlledProvinces(state, "IDN", "TLS").length, "/", state.countries.TLS.agg.nOwned);

// 8. damai
const ws = WO.War.warScore(state, "IDN", "TLS");
check("skor perang dihitung (0..1)", ws.score > 0 && ws.score <= 1, ws.score.toFixed(2));
const trans = WO.War.controlledProvinces(state, "IDN", "TLS");
const nOwnedIdn = state.rt.owned.IDN.size;
r = WO.War.settle(state, "IDN", "TLS", { transfer: trans });
check("perjanjian damai: transfer wilayah yang diduduki", r.ok, r.msg);
check("OWNER berubah HANYA setelah damai", state.rt.owned.IDN.size === nOwnedIdn + trans.length, "+" + trans.length);
check("status perang berakhir", !WO.Dip.atWar(state, "IDN", "TLS"));
check("Timor-Leste tidak kapitulasi lagi bila tak berperang", !state.countries.TLS.capitulated || !state.countries.TLS.exists);

// 9. save / load deterministik
const json = JSON.stringify(WO.Save.serialize(state));
check("ukuran save wajar (<1.5 MB)", json.length < 1.5e6, (json.length / 1024).toFixed(0) + " KB");
check("save tidak memuat GeoJSON", !json.includes("coordinates"));
const loaded = WO.Save.deserialize(JSON.parse(json));
check("load berhasil", loaded.ok, loaded.error);
const s2 = loaded.state;
const sig = (st) => JSON.stringify([st.day, st.countries.IDN.treasury.toFixed(2), st.countries.IDN.manpower.toFixed(0), Object.keys(st.divisions).length,
  [...st.rt.owned.IDN].length, [...st.rt.controlled.IDN].length, st.countries.TLS.exists, st.rng]);
check("state setelah load identik dengan sebelum save", sig(s2) === sig(state), sig(s2));
// lanjutkan keduanya 40 hari -> harus sama (determinisme)
for (let i = 0; i < 40; i++) { WO.Sim.tick(state); WO.Sim.tick(s2); }
check("simulasi setelah load identik dengan yang tidak di-load (40 hari)", sig(s2) === sig(state), sig(s2).slice(0, 90));
console.log("\n" + (fails ? fails + " DARI " + checks + " GAGAL" : "SEMUA " + checks + " PENGECEKAN LOLOS"));
process.exit(fails ? 1 : 0);
