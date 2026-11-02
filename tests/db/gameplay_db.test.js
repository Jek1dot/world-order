const fs = require("fs"), path = require("path");
const WO = require("../load.js");
const root = path.join(__dirname, "..", "..");
WO.DB.setFetcher(async (rel) => JSON.parse(fs.readFileSync(path.join(root, "data/db", rel), "utf8")));
let fails = 0, n = 0; const check = (name, cond, extra) => { n++; if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  -> " + extra : "")); };
const W = WO.World, F = WO.Focus, S = WO.State;
(async () => {
  await WO.DB.init(); await WO.DB.loadCountries(); await WO.DB.loadEquipment(); await WO.DB.loadEvents(); await WO.DB.loadTrees();
  const G = (o) => { const s = S.newGame(Object.assign({ seed: 11 }, o)); S.setPlayer(s, "IDN"); return s; };
  const id = (x) => "foc.gen." + x;

  // ---- fokus ----
  let s = G(), c = s.countries.IDN;
  check("pohon fokus generik dimuat untuk Indonesia (24 fokus)", F.tree("IDN").focuses.length === 24);
  check("fokus terkunci karena prasyarat ditolak", !F.start(s, "IDN", id("administrative_reform")).ok && F.status(s, "IDN", id("administrative_reform")) === "locked");
  check("fokus yang tersedia: status 'available'", F.status(s, "IDN", id("national_unity")) === "available");
  const stab0 = c.stability, base0 = c.baseStab;
  check("memulai fokus Persatuan Nasional", F.start(s, "IDN", id("national_unity")).ok && c.focus.current.left === 35);
  check("tidak bisa mengerjakan dua fokus bersamaan", !F.start(s, "IDN", id("fiscal_discipline")).ok);
  WO.Sim.run(s, 34); check("34 hari: fokus belum selesai", !!c.focus.current && c.focus.current.left === 1, c.focus.current && c.focus.current.left);
  WO.Sim.run(s, 1);
  check("hari ke-35: fokus selesai, efek diterapkan (stabilitas dasar +5 permanen)", c.focus.done.includes(id("national_unity")) && !c.focus.current && c.baseStab === base0 + 5, "baseStab " + base0.toFixed(1) + " -> " + c.baseStab.toFixed(1));
  check("setelah selesai prasyarat terbuka", F.status(s, "IDN", id("administrative_reform")) === "available");
  // efek modifier -> ekonomi
  F.start(s, "IDN", id("administrative_reform")); WO.Sim.run(s, 50);
  check("Reformasi Administrasi: modifier pendapatan +5%", c.mods.income === 5);
  // eksklusif
  F.start(s, "IDN", id("open_governance"));
  check("fokus eksklusif diblokir setelah rival dimulai", F.status(s, "IDN", id("centralized_state")) === "excluded" && !F.start(s, "IDN", id("centralized_state")).ok);
  WO.Sim.run(s, 45); check("fokus eksklusif tetap 'excluded' setelah rival selesai", F.status(s, "IDN", id("centralized_state")) === "excluded");
  // syarat khusus perang
  s = G(); c = s.countries.IDN; c.focus.done = ["conscription_drive", "equipment_stockpile", "infantry_doctrine", "war_readiness"].map(id);
  check("Mobilisasi Total terkunci saat damai (butuh perang)", F.status(s, "IDN", id("total_mobilization")) === "locked");
  WO.Dip.declareWar(s, "IDN", "TLS");
  check("Mobilisasi Total tersedia saat perang", F.status(s, "IDN", id("total_mobilization")) === "available");
  // any_of
  s = G(); c = s.countries.IDN; c.focus.done = [id("conscription_drive"), id("equipment_stockpile")];
  check("any_of: Kesiapan Perang terkunci tanpa doktrin", F.status(s, "IDN", id("war_readiness")) === "locked");
  c.focus.done.push(id("armored_doctrine")); check("any_of: terbuka dengan salah satu doktrin", F.status(s, "IDN", id("war_readiness")) === "available");
  // grant_factory + efisiensi produksi nyata
  s = G(); c = s.countries.IDN; const civ0 = c.agg.civ;
  F.start(s, "IDN", id("civil_industry")); WO.Sim.run(s, 60);
  check("Industri Sipil: +2 pabrik sipil benar-benar bertambah di agregat", c.agg.civ === civ0 + 2, civ0 + " -> " + c.agg.civ);
  const prod = (st) => { const cc = st.countries.IDN; WO.Eco.setProduction(st, "IDN", "rifles", 3); cc.lines[0].eff = 1; const before = cc.stock.rifles; WO.Sim.tick(st); return cc.stock.rifles - before; };
  const sA = G(), sB = G(); sB.countries.IDN.mods.eff = 10;
  const a = prod(sA), b = prod(sB);
  check("modifier efisiensi +10% menaikkan output senapan harian ≈10%", Math.abs(b / a - 1.10) < 0.02, a.toFixed(2) + " vs " + b.toFixed(2));
  const sC = G(), sD = G(); sD.countries.IDN.mods.income = 10; WO.Sim.tick(sC); WO.Sim.tick(sD);
  check("modifier pendapatan +10% menaikkan pemasukan kas", sD.countries.IDN.lastReport.income / sC.countries.IDN.lastReport.income > 1.099 && sD.countries.IDN.lastReport.income / sC.countries.IDN.lastReport.income < 1.101);
  // AI memilih fokus sendiri
  s = G(); WO.Sim.run(s, 200); const aiDone = W.countryIds.filter((i) => i !== "IDN" && s.countries[i].focus.done.length > 0).length;
  check("AI menyelesaikan fokus sendiri (≥ 200 negara dalam 200 hari)", aiDone >= 200, aiDone + " negara");
  check("invarian state valid setelah fokus berjalan", WO.Save.validate(s, false).length === 0, WO.Save.validate(s, false).join(";"));
  // pause: tidak ada progres tanpa tick (Sim.tick tidak dipanggil)
  s = G(); F.start(s, "IDN", id("fiscal_discipline")); const l0 = s.countries.IDN.focus.current.left; check("tanpa tick, fokus tidak berjalan", s.countries.IDN.focus.current.left === l0);

  // ---- event ----
  const saved = WO.START_DATE_UTC;
  WO.START_DATE_UTC = Date.UTC(1998, 4, 20);                 // jam game dimulai 20 Mei 1998 (uji mesin saja; campaign 1991/2001 belum tersedia)
  s = G(); c = s.countries.IDN;
  WO.Sim.tick(s);
  check("1998-05-21: event historis 'Suharto mengundurkan diri' masuk antrean pemain", c.eventQueue.some((q) => q.id === "ev.idn.1998.suharto_resigns"), WO.DB.isoOfDay(s.day));
  check("pesan surat kabar dikirim ke UI", s.pendingMessages.some((m) => m.kind === "event" && m.eventId === "ev.idn.1998.suharto_resigns"));
  const st0 = c.stability, r = WO.Events.choose(s, "IDN", "ev.idn.1998.suharto_resigns", "habibie");
  check("memilih opsi: efek diterapkan & antrean bersih", r.ok && c.stability < st0 && !c.eventQueue.some((q) => q.id === "ev.idn.1998.suharto_resigns") && c.flags.idn_1998_transition !== undefined, r.effects && r.effects.join("; "));
  check("event historis tidak menyala dua kali", (WO.Sim.run(s, 5), !c.eventQueue.some((q) => q.id === "ev.idn.1998.suharto_resigns")));
  check("event untuk negara lain tidak menyala di pemain (Suharto hanya IDN)", (() => { const t = G(); t.countries.IDN.exists = true; S.setPlayer(t, "MYS"); WO.Sim.tick(t); return !t.countries.MYS.eventQueue.length; })());
  check("pilihan di luar antrean ditolak", !WO.Events.choose(s, "IDN", "ev.idn.1998.suharto_resigns", "habibie").ok);
  WO.START_DATE_UTC = saved;
  s = G(); c = s.countries.IDN; WO.Sim.run(s, 800);
  check("campaign 2026: event historis 1998–2024 TIDAK menyala (tidak ada tanggal masa lalu yang dimainkan ulang)", !Object.keys(s.events.fired).some((k) => k.startsWith("ev.idn.")), Object.keys(s.events.fired).filter((k) => k.endsWith("|IDN")).join(","));
  const genFired = Object.keys(s.events.fired).filter((k) => k.startsWith("ev.gen.") && k.endsWith("|IDN")).length;
  check("event generik acak (MTTH) menyala untuk pemain dalam 800 hari", genFired >= 1, genFired + " event");
  const pend = c.eventQueue.length; check("event pemain menunggu keputusan di antrean (tidak otomatis dipilih)", pend === genFired - s.log.filter((l) => l.kind === "event" && l.country === "IDN").length);
  // semua opsi semua event dapat diterapkan tanpa error & tanpa NaN
  let bad = 0; for (const e of WO.DB._events) for (const o of e.options) { const t = G(); try { WO.Fx.applyAll(t, "IDN", o.effects, { permanent: false }); if (WO.Save.validate(t, false).length) bad++; } catch (err) { bad++; console.log("   err", e.id, o.id, err.message); } }
  check("semua opsi event & efek fokus dapat diterapkan tanpa error/NaN", bad === 0);
  for (const f of F.tree("IDN").focuses) { const t = G(); try { WO.Fx.applyAll(t, "IDN", f.effects, { permanent: true }); if (WO.Save.validate(t, false).length) bad++; } catch (err) { bad++; } }
  check("semua efek fokus aman", bad === 0);

  // ---- save/load & migrasi ----
  s = G(); c = s.countries.IDN; F.start(s, "IDN", id("fiscal_discipline")); WO.Sim.run(s, 10); c.eventQueue.push({ id: "ev.gen.earthquake", day: s.day });
  const obj = JSON.parse(JSON.stringify(WO.Save.serialize(s))), ld = WO.Save.deserialize(obj);
  check("save skema 5 memuat fokus aktif & event tertunda", ld.ok && ld.state.countries.IDN.focus.current.left === c.focus.current.left && ld.state.countries.IDN.eventQueue.length === 1, ld.error);
  const old = JSON.parse(JSON.stringify(obj)); old.schema = 4; delete old.events; for (const k in old.countries) { delete old.countries[k].mods; delete old.countries[k].focus; delete old.countries[k].flags; delete old.countries[k].eventQueue; }
  const mig = WO.Save.deserialize(old);
  check("MIGRASI save skema 4 → 5: dimuat dengan nilai default aman", mig.ok && mig.state.countries.IDN.mods.eff === 0 && Array.isArray(mig.state.countries.IDN.focus.done) && mig.state.events.fired, mig.error);
  check("setelah migrasi simulasi tetap berjalan", (WO.Sim.run(mig.state, 20), WO.Save.validate(mig.state, false).length === 0));
  const bad3 = JSON.parse(JSON.stringify(obj)); bad3.schema = 3; check("save skema 3 ditolak dengan pesan (tidak crash)", !WO.Save.deserialize(bad3).ok);
  console.log("\n" + (fails ? fails + " DARI " + n + " GAGAL" : "SEMUA " + n + " PENGECEKAN GAMEPLAY-DB LOLOS")); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("CRASH", e); process.exit(2); });
