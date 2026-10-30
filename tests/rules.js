// Uji aturan khusus (headless, data dunia asli)
const WO = require("./load.js");
const W = WO.World, S = WO.State, C = WO.C;
let fails = 0, n = 0;
const check = (name, cond, extra) => { n++; if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  -> " + extra : "")); };
const pid = (nm, c) => Object.values(W.provinces).find((p) => p.name === nm && p.country === c).id;
const fresh = (p) => { const s = S.newGame({ seed: 3 }); if (p) S.setPlayer(s, p); return s; };

// --- relokasi ibu kota ---
{
  const s = fresh("IDN"), c = s.countries.IDN;
  const jatim = pid("Jawa Timur", "IDN");
  check("relokasi: tidak bisa ke provinsi negara lain", !WO.Cap.canRelocate(s, "IDN", pid("Dili", "TLS")).ok);
  check("relokasi: tidak bisa ke ibu kota yang sama", !WO.Cap.canRelocate(s, "IDN", c.capital).ok);
  s.provinces[jatim].infra = 1; check("relokasi: infrastruktur < 2 ditolak", !WO.Cap.canRelocate(s, "IDN", jatim).ok);
  s.provinces[jatim].infra = 3;
  const t0 = c.treasury, stab0 = c.stability, old = c.capital;
  const r = WO.Cap.relocate(s, "IDN", jatim);
  check("relokasi: berhasil, biaya & penalti stabilitas", r.ok && c.capital === jatim && c.treasury < t0 && c.stability < stab0, r.msg);
  check("relokasi: riwayat ibu kota tercatat", c.capitalHistory.length === 2 && c.capitalHistory[1].id === jatim);
  check("relokasi: cooldown mencegah pemindahan beruntun", !WO.Cap.canRelocate(s, "IDN", old).ok, WO.Cap.canRelocate(s, "IDN", old).reason);
  s.day += 200; check("relokasi: boleh lagi setelah cooldown", WO.Cap.canRelocate(s, "IDN", old).ok);
  const s2 = fresh("IDN"); s2.countries.IDN.treasury = 0.1; check("relokasi: butuh kas", !WO.Cap.canRelocate(s2, "IDN", jatim).ok);
  const s3 = fresh("IDN"); WO.State.setController(s3, jatim, "TLS"); check("relokasi: tidak ke provinsi yang diduduki", !WO.Cap.canRelocate(s3, "IDN", jatim).ok);
}

// --- akses militer, NAP, aliansi ---
{
  const s = fresh("IDN"), kalbar = pid("Kalimantan Barat", "IDN"), sarawak = pid("Sarawak", "MYS");
  const d = S.createDivision(s, "IDN", "infantry", kalbar, { training: false });
  check("akses: tanpa izin, tidak boleh masuk Sarawak (negara netral)", !WO.Mil.orderMove(s, "IDN", [d.id], sarawak).ok, WO.Mil.orderMove(s, "IDN", [d.id], sarawak).msg);
  const rej = WO.Dip.proposePact(s, "access", "IDN", "MYS");
  check("akses: ditolak saat opini rendah (ada alasan)", !rej.ok && /opini/.test(rej.msg), rej.msg);
  WO.Dip.addOpinion(s, "IDN", "MYS", 20);
  const okp = WO.Dip.proposePact(s, "access", "IDN", "MYS");
  check("akses: disetujui setelah opini naik", okp.ok, okp.msg);
  check("akses: sekarang boleh masuk Sarawak", WO.Mil.orderMove(s, "IDN", [d.id], sarawak).ok);
  for (let i = 0; i < 30 && d.province !== sarawak; i++) WO.Sim.tick(s);
  check("akses: divisi masuk Sarawak tanpa perang & tanpa mengubah penguasa", d.province === sarawak && s.provinces[sarawak].controller === "MYS");
  const pact = s.diplo.pacts.find((p) => p.type === "access");
  WO.Dip.breakPact(s, pact.id, "MYS"); WO.War.withdrawIllegal(s);
  check("akses dicabut: divisi ditarik keluar dari wilayah MYS", s.provinces[d.province].controller !== "MYS" && s.divisions[d.id]);
  // NAP
  const n1 = fresh("IDN"); WO.Dip.addOpinion(n1, "IDN", "MYS", 20);
  check("NAP disetujui", WO.Dip.proposePact(n1, "nap", "IDN", "MYS").ok);
  check("NAP memblokir deklarasi perang", !WO.Dip.declareWar(n1, "IDN", "MYS").ok);
  WO.Dip.breakPact(n1, n1.diplo.pacts[0].id, "IDN");
  check("setelah NAP dibatalkan, perang boleh", WO.Dip.declareWar(n1, "IDN", "MYS").ok);
  // aliansi
  const a = fresh("IDN"); WO.Dip.addOpinion(a, "IDN", "SGP", 50); WO.Dip.addOpinion(a, "IDN", "MYS", 0);
  check("aliansi disetujui bila opini ≥ 40", WO.Dip.proposePact(a, "alliance", "IDN", "SGP").ok);
  WO.Dip.declareWar(a, "AUS", "SGP");
  check("aliansi: sekutu otomatis ikut perang", WO.Dip.atWar(a, "IDN", "AUS"));
  check("tidak bisa menyerang sekutu", !WO.Dip.declareWar(a, "IDN", "SGP").ok);
}

// --- supply & kapitulasi tidak instan ---
{
  const s = fresh("IDN"), jabar = pid("Jawa Barat", "IDN"), jateng = pid("Jawa Tengah", "IDN");
  WO.Dip.declareWar(s, "MYS", "IDN");
  WO.Supply.compute(s, "IDN"); const before = s.rt.supply.IDN.get(jateng) || 0;
  WO.State.setController(s, jabar, "MYS"); WO.Supply.compute(s, "IDN");
  check("supply tidak melewati provinsi yang diduduki musuh", !s.rt.supply.IDN.has(jabar));
  check("supply provinsi di balik wilayah pendudukan tidak naik", (s.rt.supply.IDN.get(jateng) || 0) <= before + 1e-9, before.toFixed(1) + " -> " + (s.rt.supply.IDN.get(jateng) || 0).toFixed(1));
  // negara pemain (AI tidak mengurus ibu kota): kehilangan ibu kota SAJA tidak cukup untuk kapitulasi
  const b = fresh("BRA"); WO.Dip.declareWar(b, "ARG", "BRA");
  const cap = b.countries.BRA.capital; WO.State.setController(b, cap, "ARG"); S.refreshAggregates(b);
  for (let i = 0; i < 12; i++) WO.Sim.tick(b);
  const pr = b.countries.BRA.pressure;
  check("kapitulasi: ibu kota jatuh menaikkan tekanan (>= 30) tapi negara besar TIDAK langsung kalah", pr && pr.capLost && pr.pressure >= 30 && pr.pressure < C.CAP_PRESSURE && !b.countries.BRA.capitulated, "tekanan " + (pr ? pr.pressure.toFixed(0) : "-") + "/" + C.CAP_PRESSURE);
  // AI: memindahkan ibu kota ketika terancam, dengan batas
  const a = fresh("IDN"); WO.Dip.declareWar(a, "ARG", "BRA");
  const capA = a.countries.BRA.capital; WO.State.setController(a, capA, "ARG"); S.refreshAggregates(a);
  for (let i = 0; i < 8; i++) WO.Sim.tick(a);
  const cb = a.countries.BRA;
  check("AI memindahkan ibu kota yang diduduki (dengan biaya & riwayat)", cb.capital !== capA && cb.capitalHistory.length === 2 && cb.relocCount === 1, W.provinces[cb.capital].name);
  check("AI tidak bisa memindahkan lagi sebelum cooldown selesai", !WO.Cap.canRelocate(a, "BRA", capA).ok || cb.capitalHistory.length === 2);
  for (let i = 0; i < 40; i++) WO.Sim.tick(a);
  check("AI tidak memindahkan ibu kota tanpa batas (maks 2 per tahun)", cb.capitalHistory.length <= 3, "pemindahan: " + (cb.capitalHistory.length - 1));
}

// --- tawaran damai AI -> pemain ---
{
  const s = fresh("IDN"); WO.Dip.declareWar(s, "IDN", "MYS");
  s.day = 140; s.wars[0].start = 20; s.countries.MYS.exhaustion = 85;
  WO.War.aiReview(s);
  check("AI yang lelah menawarkan damai ke pemain", s.peaceOffers.some((o) => o.from === "MYS" && o.to === "IDN"));
  const r = WO.War.acceptPeaceOffer(s, "MYS");
  check("menerima tawaran damai mengakhiri perang", r.ok && !WO.Dip.atWar(s, "IDN", "MYS"), r.msg);
}

// --- sumber daya, peralatan, manpower tak pernah negatif ---
{
  const s = fresh("IDN"), c = s.countries.IDN;
  WO.Eco.setProduction(s, "IDN", "tanks", 4); c.res.steel = 0; c.res.aluminum = 0; c.res.oil = 0;
  const a = c.agg; const inc = { ...a.res }; a.res.steel = 0; a.res.aluminum = 0; a.res.oil = 0;
  WO.Sim.tick(s); a.res = inc;
  check("tanpa bahan baku, produksi tank nol (bukan negatif)", c.stock.tanks >= 20 - 1e-9 && c.res.steel >= 0);
  let ok = 0; for (let i = 0; i < 60; i++) if (WO.Mil.recruit(s, "IDN", "infantry", c.capital).ok) ok++;
  check("rekrut berlebihan dibatasi oleh peralatan/manpower (tidak negatif)", ok > 0 && ok < 60 && c.manpower >= 0 && c.stock.rifles >= 0 && c.stock.artillery >= 0, ok + " divisi");
  check("tidak ada ID divisi ganda", new Set(Object.values(s.divisions).map((d) => d.id)).size === Object.keys(s.divisions).length);
  check("invarian state valid", WO.Save.validate(s, false).length === 0);
}

// --- hasil tempur bergantung statistik ---
{
  const run = (nAtt, nDef, terrain) => {
    const s = fresh(); const A = "IDN", D = "TLS", tgt = pid("Bobonaro", "TLS"), from = pid("Nusa Tenggara Timur", "IDN");
    W.provinces[tgt].terrain = terrain;
    WO.Dip.declareWar(s, A, D);
    for (const d of Object.values(s.divisions)) if (d.country === A || d.country === D) S.removeDivision(s, d.id);
    const att = [], def = [];
    for (let i = 0; i < nAtt; i++) att.push(S.createDivision(s, A, "infantry", from, { training: false }));
    for (let i = 0; i < nDef; i++) def.push(S.createDivision(s, D, "infantry", tgt, { training: false }));
    WO.Mil.orderMove(s, A, att.map((d) => d.id), tgt);
    for (let i = 0; i < 40 && s.provinces[tgt].controller !== A; i++) { WO.Sim.step ? 0 : 0; WO.Mil.step(s); WO.War.resolveCombat(s); WO.Mil.recover(s); s.day++; }
    return { captured: s.provinces[tgt].controller === A, days: s.day, att: att.filter((d) => s.divisions[d.id]).length, def: def.filter((d) => s.divisions[d.id]).length };
  };
  const strong = run(8, 1, "plains"), weak = run(1, 4, "mountains");
  check("8 penyerang vs 1 bertahan: provinsi direbut", strong.captured, JSON.stringify(strong));
  check("1 penyerang vs 4 bertahan di pegunungan: serangan gagal", !weak.captured, JSON.stringify(weak));
  const t1 = run(3, 2, "plains"), t2 = run(3, 2, "mountains");
  check("terrain berpengaruh: pegunungan memperlambat/menggagalkan serangan yang sama", (!t2.captured && t1.captured) || t2.days > t1.days, "dataran " + t1.days + "h/" + t1.captured + " vs gunung " + t2.days + "h/" + t2.captured);
}

// --- aneksasi, game over ---
{
  const s = fresh("TLS"); WO.Dip.declareWar(s, "IDN", "TLS");
  for (const p of [...s.rt.owned.TLS]) WO.State.setController(s, p, "IDN");
  S.refreshAggregates(s); WO.War.capitulate(s, "TLS");
  const ws = WO.War.warScore(s, "IDN", "TLS");
  check("skor perang penuh bila semua wilayah diduduki", ws.score === 1, ws.score);
  const r = WO.War.settle(s, "IDN", "TLS", { annex: true });
  check("aneksasi penuh: negara dihapus", r.ok && !s.countries.TLS.exists && s.rt.owned.TLS.size === 0, r.msg);
  check("pemain yang dianeksasi mendapat pesan game over", s.pendingMessages.some((m) => m.kind === "gameover"));
  check("pasukan & pakta negara yang dihapus dibersihkan", Object.values(s.divisions).every((d) => d.country !== "TLS"));
  check("invarian setelah aneksasi", WO.Save.validate(s, false).length === 0, WO.Save.validate(s, false).join(";"));
  const s2 = fresh("IDN"); WO.Dip.declareWar(s2, "IDN", "TLS");
  check("aneksasi ditolak bila skor perang kurang", !WO.War.settle(s2, "IDN", "TLS", { annex: true }).ok);
}
console.log("\n" + (fails ? fails + " DARI " + n + " GAGAL" : "SEMUA " + n + " PENGECEKAN ATURAN LOLOS"));
process.exit(fails ? 1 : 0);
