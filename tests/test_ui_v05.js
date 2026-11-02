// Uji UI v0.5α di jsdom (DOM tiruan, BUKAN browser sungguhan)
const { JSDOM } = require("jsdom"); const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
const html = idx.replace(/<script src="[^"]+"><\/script>/g, "");
const scripts = [...idx.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const errors = [];
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost:8000/", beforeParse(w) {
  w.console.error = (...a) => errors.push(a.map(String).join(" "));
  w.fetch = async (u) => { const f = path.join(root, String(u)); if (!fs.existsSync(f)) return { ok: false, status: 404, json: async () => ({}) }; const t = fs.readFileSync(f, "utf8"); return { ok: true, status: 200, json: async () => JSON.parse(t) }; };
  w.Element.prototype.setPointerCapture = function () {}; w.Element.prototype.scrollIntoView = function () {}; } });
const w = dom.window, d = w.document, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, n = 0;
const check = (name, cond, extra) => { n++; if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  -> " + extra : "")); };
const click = (el, type) => el.dispatchEvent(new w.MouseEvent(type || "click", { bubbles: true, cancelable: true }));
const q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)], panel = () => d.getElementById("panel").innerHTML;
const key = (k) => d.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, code: k === " " ? "Space" : "Key" + k.toUpperCase(), bubbles: true }));
const closeModal = (first) => { const m = d.getElementById("modal"), bs = m.querySelectorAll("[data-mb]"); if (!m.hidden && bs.length) click(first ? bs[0] : bs[bs.length - 1]); };
(async () => {
  for (const s of scripts) w.eval(fs.readFileSync(path.join(root, s), "utf8"));
  d.dispatchEvent(new w.Event("DOMContentLoaded"));
  for (let i = 0; i < 100 && !d.getElementById("loading").hidden; i++) await sleep(100);
  const WO = w.WO, g = w.game, UI = WO.UI, DB = WO.DB, st = () => g.state;
  check("boot dengan database sejarah tanpa error", d.getElementById("loading").hidden && DB.ready && errors.length === 0, errors.join("|").slice(0, 200));
  closeModal();   // "Main bebas"

  // ---- navigasi & jendela ----
  const navBtns = qa("#tabs button");
  check("navigasi kiri: 18 tombol (incl. Misi tersembunyi)", navBtns.length === UI.NAV.filter((x) => !x.sp).length && navBtns.length === 18, navBtns.length);
  const na = navBtns.filter((b) => b.disabled).map((b) => b.dataset.tab).sort();
  check("fitur BELUM ada ditandai disabled + keterangan (bukan tombol palsu)", JSON.stringify(na) === JSON.stringify(["decisions", "highcmd", "intel", "research"]) && navBtns.filter((b) => b.disabled).every((b) => /BELUM TERSEDIA/.test(b.title)));
  check("jendela panel tertutup saat awal (peta penuh)", d.getElementById("window").hidden);
  click(q('#tabs [data-tab="economy"]')); check("klik ikon membuka jendela", !d.getElementById("window").hidden && /Ekonomi/.test(d.getElementById("win-title").textContent));
  click(q('#tabs [data-tab="economy"]')); check("klik ikon yang sama menutup jendela", d.getElementById("window").hidden);
  key("f"); check("pintasan F membuka Fokus Nasional (jendela lebar)", !d.getElementById("window").hidden && d.getElementById("window").classList.contains("wide"));
  key("Escape"); check("Esc menutup jendela", d.getElementById("window").hidden);

  // ---- mulai skenario & HUD ----
  g.startScenario(); await sleep(60); closeModal(false);   // "Jeda dulu"
  check("HUD waktu: 5 tingkat kecepatan", qa(".speed-btn").length === 5 && qa(".speed-btn").map((b) => b.dataset.speed).join() === "1,2,5,10,20");
  click(q('.speed-btn[data-speed="20"]')); check("tombol kecepatan 5 (20 hari/detik) aktif", g.speed === 20 && q('.speed-btn[data-speed="20"]').classList.contains("active"));
  g.setSpeed(1);
  check("bilah atas: pabrik & divisi terisi", /21 \/ 9/.test(d.getElementById("st-factories").textContent) && +d.getElementById("st-divisions").textContent === 13, d.getElementById("st-factories").textContent + " | " + d.getElementById("st-divisions").textContent);
  await sleep(100);
  check("bilah atas menampilkan kepala negara dari DATABASE (Prabowo Subianto)", /Prabowo Subianto/.test(d.getElementById("top-leader").textContent), d.getElementById("top-leader").textContent);

  // ---- panel Politik: data pemimpin sejarah ----
  UI.setTab("country"); await sleep(50); UI.drawPanel();
  check("panel Politik: Prabowo & Gibran + status verifikasi (bukan klaim 'verified')", /Prabowo Subianto/.test(panel()) && /Gibran/.test(panel()) && /sebagian/.test(panel()) && !/terverifikasi ·/.test(panel()));
  UI.viewCountrySet("TLS"); check("negara tanpa data: 'Data pemimpin belum tersedia' (tidak dikarang)", /belum tersedia/.test(panel()) && /tidak diketahui/.test(panel()));
  UI.viewCountrySet("IDN");

  // ---- notifikasi dihitung dari state ----
  const alerts = UI.computeAlerts(st()).map((a) => a.tab);
  check("notifikasi: fokus, konstruksi kosong, pabrik menganggur", alerts.includes("focus") && alerts.includes("build") && alerts.includes("production"), alerts.join());
  check("notifikasi tampil di bilah atas", qa("#alerts .alert-btn").length >= 3);
  click(qa("#alerts .alert-btn")[qa("#alerts .alert-btn").findIndex((b) => /fokus/i.test(b.title))]); check("klik notifikasi membuka panel terkait", ui_tab() === "focus");
  function ui_tab() { return UI.s.tab; }

  // ---- pohon fokus ----
  UI.setTab("focus");
  check("pohon fokus: 24 node digambar", qa(".fnode").length === 24 && qa("svg.links path").length >= 20, qa(".fnode").length);
  const av = qa(".fnode.available").map((e) => e.dataset.id.replace("foc.gen.", "")).sort();
  check("node tersedia/terkunci sesuai prasyarat", JSON.stringify(av) === JSON.stringify(["civil_industry", "conscription_drive", "fiscal_discipline", "national_unity", "regional_diplomacy", "road_network"]) && q('[data-id="foc.gen.mass_production"]').classList.contains("locked"), av.join());
  click(q('[data-id="foc.gen.national_unity"]')); check("klik node menampilkan detail (durasi, efek)", /35 hari/.test(d.getElementById("focus-tip").textContent) && /Stabilitas \+5/.test(d.getElementById("focus-tip").textContent));
  click(q('[data-id="foc.gen.mass_production"]')); check("detail fokus terkunci: tombol Mulai nonaktif + alasan", q('#focus-tip [data-act="focusstart"]').disabled && /Prasyarat/.test(d.getElementById("focus-tip").textContent));
  UI.focusHover("foc.gen.mass_production"); check("hover menyorot rantai prasyarat (3 leluhur) ", qa(".fnode.rel-anc").length === 3, qa(".fnode.rel-anc").length);
  UI.focusHover(null);
  const inp = q("#focus-search"); inp.value = "industri"; inp.dispatchEvent(new w.Event("input", { bubbles: true }));
  check("pencarian: node cocok disorot, lainnya redup", qa(".fnode.hit").length >= 2 && qa(".fnode.dim").length >= 15, qa(".fnode.hit").length + " hit");
  inp.value = ""; inp.dispatchEvent(new w.Event("input", { bubbles: true }));
  click(q('[data-id="foc.gen.national_unity"]')); click(q('#focus-tip [data-act="focusstart"]'));
  check("tombol 'Mulai fokus' menjalankan fokus (state berubah)", st().countries.IDN.focus.current && st().countries.IDN.focus.current.id === "foc.gen.national_unity" && q(".fnode.current"));
  const base0 = st().countries.IDN.baseStab; g.resume(); g.setSpeed(20); for (let i = 0; i < 400 && st().countries.IDN.focus.current; i++) g.frame(); g.pause();
  check("fokus selesai lewat loop game: node 'done' + stabilitas dasar naik", !st().countries.IDN.focus.current && st().countries.IDN.baseStab === base0 + 5 && q('[data-id="foc.gen.national_unity"]').classList.contains("done") || (UI.drawPanel(), q('[data-id="foc.gen.national_unity"]').classList.contains("done")));
  click(q('[data-id="foc.gen.administrative_reform"]')); click(q('#focus-tip [data-act="focusstart"]')); WO.Sim.run(st(), 50); UI.drawPanel();
  click(q('[data-id="foc.gen.open_governance"]')); click(q('#focus-tip [data-act="focusstart"]')); UI.drawPanel();
  check("fokus eksklusif: lawan berstatus 'excluded' di UI", q('[data-id="foc.gen.centralized_state"]').classList.contains("excluded"));

  // ---- Database & slider tanggal ----
  UI.setTab("database"); const slider = () => q("#db-date");
  const setDate = (iso) => { slider().value = DB.dayOfIso(iso); slider().dispatchEvent(new w.Event("input", { bubbles: true })); return d.getElementById("db-results").textContent; };
  let t = setDate("1991-01-01"); const lead = (x) => x.split("Alutsista terdata")[0]; check("DB 1991-01-01: Suharto & Sudharmono (bagian pemimpin), bukan Prabowo", /Suharto/.test(lead(t)) && /Sudharmono/.test(lead(t)) && !/Prabowo/.test(lead(t)));
  t = setDate("1998-05-21"); check("DB 1998-05-21: Habibie presiden", /B\. J\. Habibie/.test(t) && /Kepala negara & pemerintahan/.test(t));
  t = setDate("2001-07-24"); check("DB 2001-07-24: Megawati; wakil = jabatan kosong", /Megawati/.test(t) && /Jabatan kosong/.test(t));
  check("DB: sumber, tipe & lisensi ditampilkan", /S-WP-PRES-IDN/.test(panel()) && /CC BY-SA/.test(panel()) && /tertiary/.test(panel()));
  check("DB: event historis IDN dengan catatan campaign", /Suharto mengundurkan diri/.test(t) && /Campaign 1991\/2001 belum tersedia/.test(t));
  t = setDate("2007-06-01"); check("DB 2007: SS1 aktif, SS2 aktif sejak 2006; varian non-operasional ditandai", /Pindad SS1/.test(t) && /Pindad SS2/.test(t) && /SS2-V3 \(prototype\)/.test(t) && /SS3 \(demonstrator\)/.test(t));
  t = setDate("2004-01-01"); check("DB 2004: SS2 BELUM tercantum", /Pindad SS1/.test(t) && !/Pindad SS2/.test(t));
  UI.viewCountrySet("MYS"); UI.drawPanel(); check("DB negara tanpa data: pesan jujur", /belum tersedia/.test(d.getElementById("db-results").textContent) && /Tidak ada alutsista terdata/.test(d.getElementById("db-results").textContent));
  UI.viewCountrySet("IDN");

  // ---- koran event ----
  const c = st().countries.IDN; c.eventQueue.push({ id: "ev.gen.commodity_boom", day: st().day }); const tr0 = c.treasury;
  UI.showNewspaper("ev.gen.commodity_boom"); const mhtml = d.getElementById("modal").innerHTML;
  check("koran event: masthead, headline, label 'Fiksi gameplay', opsi + konsekuensi", /Warta Dunia/.test(mhtml) && /LONJAKAN|Lonjakan/i.test(mhtml) && /Fiksi gameplay/.test(mhtml) && /Kas \+1\.5% PDB/.test(mhtml) && qa("#modal [data-mb]").length === 2);
  click(q('#modal [data-mb="0"]')); check("memilih opsi: kas naik, antrean kosong, modal tertutup", c.treasury > tr0 && c.eventQueue.length === 0 && d.getElementById("modal").hidden);
  UI.showNewspaper("ev.idn.1998.suharto_resigns"); const hh = d.getElementById("modal").innerHTML;
  check("event historis: label, ringkasan fakta, status data & peringatan 'rancangan gameplay'", /Peristiwa historis/.test(hh) && /Fakta sejarah/.test(hh) && /partially_verified/.test(hh) && /rancangan gameplay/.test(hh)); closeModal(true);
  c.eventQueue.push({ id: "ev.gen.earthquake", day: st().day }); st().pendingMessages.push({ day: st().day, kind: "event", country: "IDN", eventId: "ev.gen.earthquake", text: "x" }); g.resume(); UI.refresh(true);
  check("event masuk: game otomatis pause + koran tampil", g.paused && !d.getElementById("modal").hidden && /Warta Dunia/.test(d.getElementById("modal").innerHTML)); click(q('#modal [data-mb="0"]'));
  const dayP = st().day; for (let i = 0; i < 40; i++) g.frame(); check("saat pause tak ada tick", st().day === dayP);

  // ---- panel logistik & dagang ----
  UI.setTab("logistics"); check("panel Logistik: ringkasan supply & tombol peta supply", /Rata-rata supply divisi/.test(panel()) && q('#panel [data-act="mapmode"]'));
  click(q('#panel [data-act="mapmode"]')); check("tombol memindah ke mode peta Supply", /Supply negaramu/.test(d.getElementById("map-legend").innerHTML));
  click(q('.mode-btn[data-mode="political"]'));
  UI.viewCountrySet("MYS"); UI.setTab("trade"); check("panel Dagang: tombol ajukan perjanjian ke negara terpilih", /Ajukan perjanjian dagang dengan Malaysia/.test(panel()));
  for (const tab of UI.NAV.filter((x) => !x.sp && !x.na).map((x) => x.tab)) UI.setTab(tab);
  check("semua panel yang aktif merender tanpa error JS", errors.length === 0, errors.join("|").slice(0, 300));
  // pause = tidak ada simulasi walau fokus/event ada
  console.log("\n" + (fails ? fails + " DARI " + n + " GAGAL" : "SEMUA " + n + " PENGECEKAN UI v0.5 LOLOS")); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("TEST CRASH", e); process.exit(2); });
