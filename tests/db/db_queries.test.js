// Uji kueri DB berdasarkan tanggal (leader sesuai tanggal campaign, vacancy, alutsista vs tahun)
const fs = require("fs"), path = require("path");
global.window = undefined; require("../../js/core.js"); require("../../js/db.js");
const root = path.join(__dirname, "..", "..");
WO.DB.setFetcher(async (rel) => JSON.parse(fs.readFileSync(path.join(root, "data/db", rel), "utf8")));
let fails = 0, n = 0; const check = (name, cond, extra) => { n++; if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  -> " + extra : "")); };
const nm = (r, role) => (r && r[role] ? (r[role].person ? r[role].person.name : "KOSONG:" + r[role].vacancy.reason.slice(0, 25)) : "(tidak ada data)");
(async () => {
  const DB = WO.DB; await DB.init(); await DB.loadCountries(); await DB.loadLeaders("IDN"); await DB.loadEquipment(); await DB.loadEvents(); await DB.loadTrees();
  const at = (d) => DB.leadersAt("IDN", d);
  check("1991-01-01: presiden Suharto (kepala negara & pemerintahan)", nm(at("1991-01-01"), "head_of_state") === "Suharto" && nm(at("1991-01-01"), "head_of_government") === "Suharto");
  check("1991-01-01: wakil presiden Sudharmono", nm(at("1991-01-01"), "deputy_head_of_state") === "Sudharmono");
  check("1993-03-10 Sudharmono, 1993-03-11 Try Sutrisno (batas tepat)", nm(at("1993-03-10"), "deputy_head_of_state") === "Sudharmono" && nm(at("1993-03-11"), "deputy_head_of_state") === "Try Sutrisno");
  check("1998-05-20 Suharto, 1998-05-21 Habibie (hari pengunduran diri)", nm(at("1998-05-20"), "head_of_state") === "Suharto" && nm(at("1998-05-21"), "head_of_state") === "B. J. Habibie");
  check("Habibie 1998-03-12 adalah WAKIL presiden (bukan presiden)", nm(at("1998-03-12"), "deputy_head_of_state") === "B. J. Habibie" && nm(at("1998-03-12"), "head_of_state") === "Suharto");
  check("jabatan wakil presiden kosong 1998-08-01 dicatat sebagai vacancy", at("1998-08-01").deputy_head_of_state && at("1998-08-01").deputy_head_of_state.vacancy);
  check("2001-07-24: Megawati presiden, kursi wakil kosong", nm(at("2001-07-24"), "head_of_state") === "Megawati Sukarnoputri" && !!at("2001-07-24").deputy_head_of_state.vacancy);
  check("2001-07-26: Hamzah Haz wakil presiden", nm(at("2001-07-26"), "deputy_head_of_state") === "Hamzah Haz");
  check("2008-01-01: Jusuf Kalla (periode 1); 2016-01-01: Jusuf Kalla (periode 2)", nm(at("2008-01-01"), "deputy_head_of_state") === "Jusuf Kalla" && nm(at("2016-01-01"), "deputy_head_of_state") === "Jusuf Kalla" && nm(at("2012-01-01"), "deputy_head_of_state") === "Boediono");
  check("2026-01-01: Prabowo & Gibran (masa jabatan berjalan, end=null)", nm(at(DB.isoOfDay(0)), "head_of_state") === "Prabowo Subianto" && nm(at("2026-01-01"), "deputy_head_of_state") === "Gibran Rakabuming Raka");
  check("DB.isoOfDay(0) = 2026-01-01 dan dayOfIso kebalikannya", DB.isoOfDay(0) === "2026-01-01" && DB.dayOfIso("1991-01-01") < -12000 && DB.isoOfDay(DB.dayOfIso("1998-05-21")) === "1998-05-21");
  check("negara tanpa data pemimpin mengembalikan null (bukan data karangan)", DB.leadersAt("MYS", "2026-01-01") === null && !DB.hasLeaders("MYS"));
  const cov = DB.coverageOf("IDN", "1991-01-01", "2026-08-29");
  check("cakupan kepala negara 1991–2026 = 100% dari data nyata", Math.abs(cov.head_of_state - 1) < 1e-9, JSON.stringify(cov));
  check("cakupan wakil presiden penuh (tenure + vacancy tercatat)", Math.abs(cov.deputy_head_of_state - 1) < 1e-9, cov.deputy_head_of_state.toFixed(4));
  check("negara skeleton dimuat: 250 negara, ibu kota Indonesia = Jakarta", DB._countries.length === 250 && DB.country("IDN").capitals[0].city === "Jakarta");
  check("Timor-Leste ada di database tetapi belum punya tanggal pembentukan (null, bukan karangan)", DB.country("TLS").existence.from === null && DB.country("TLS").unknown_fields["existence.from"]);
  // alutsista vs tahun
  const ids = (iso, y) => DB.equipmentOf(iso, y).map((m) => m.id.split(".").pop());
  check("SS1 aktif di Indonesia 1991; SS2 BELUM ada 2005", ids("IDN", 1991).includes("pindad_ss1") && !ids("IDN", 2005).includes("pindad_ss2"));
  check("SS2 mulai 2006", ids("IDN", 2006).includes("pindad_ss2"));
  check("Laos TIDAK dianggap punya SS1 hanya karena membeli 2014 (pembelian ≠ inventaris)", !ids("LAO", 2020).includes("pindad_ss1"));
  check("SS2-V3 prototipe & SS3 demonstrator tidak berstatus operasional", (() => { const m = DB._equipment.byId["eq.infantry.pindad_ss2"]; return m.variants.find((v) => v.name === "SS2-V3").status === "prototype" && m.variants.find((v) => v.name === "SS3").status === "demonstrator"; })());
  check("variant SS1 tidak mewarisi tahun 1991 model dasar", DB._equipment.byId["eq.infantry.pindad_ss1"].variants.every((v) => v.service_entry_year === null));
  check("event & pohon fokus termuat", DB._events.length === 11 && DB.treeFor("IDN").id === "tree.generic" && DB.treeFor("IDN").focuses.length === 24);
  console.log("\n" + (fails ? fails + " DARI " + n + " GAGAL" : "SEMUA " + n + " PENGECEKAN KUERI DB LOLOS")); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("CRASH", e); process.exit(2); });
