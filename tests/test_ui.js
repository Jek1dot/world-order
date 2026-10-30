// Uji integrasi UI di jsdom (lingkungan DOM tiruan, BUKAN browser sungguhan) dengan data dunia asli.
const { JSDOM } = require("jsdom"); const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/<script src="[^"]+"><\/script>/g, "");
const scripts = [...fs.readFileSync(path.join(root, "index.html"), "utf8").matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const errors = [];
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost:8000/",
  beforeParse(w) {
    w.console.error = (...a) => errors.push(a.map(String).join(" "));
    w.fetch = async (u) => { const f = path.join(root, String(u)); if (!fs.existsSync(f)) return { ok: false, status: 404, json: async () => ({}) }; const t = fs.readFileSync(f, "utf8"); return { ok: true, status: 200, json: async () => JSON.parse(t) }; };
    w.Element.prototype.setPointerCapture = function () {};
  } });
const w = dom.window, d = w.document;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, n = 0;
const check = (name, cond, extra) => { n++; if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  -> " + extra : "")); };
const click = (el, type) => el.dispatchEvent(new w.MouseEvent(type || "click", { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
const q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)];
const panel = () => d.getElementById("panel").innerHTML;
const closeModal = (first) => { const m = d.getElementById("modal"); const bs = m.querySelectorAll("[data-mb]"); if (!m.hidden && bs.length) click(first ? bs[0] : bs[bs.length - 1]); };

(async () => {
  for (const s of scripts) w.eval(fs.readFileSync(path.join(root, s), "utf8"));
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  for (let i = 0; i < 100 && !d.getElementById("loading").hidden; i++) await sleep(100);
  const WO = w.WO, g = w.game, W = WO.World;

  check("peta selesai dimuat tanpa error", d.getElementById("loading").hidden && errors.length === 0, errors.join(" | ").slice(0, 200));
  check("4.578 provinsi digambar (×2 salinan wrapping)", qa("#province-root .province").length === 4578 * 2, qa("#province-root .province").length);
  check("lapisan negara digambar", qa("#land-root .land").length >= 480, qa("#land-root .land").length);
  check("modal sambutan tampil", !d.getElementById("modal").hidden);
  closeModal();   // tombol terakhir = "Main bebas"
  check("game mulai dalam keadaan pause", g.paused === true);

  // ---- pause menghentikan seluruh simulasi ----
  const day0 = g.state.day;
  for (let i = 0; i < 50; i++) g.frame();
  check("pause: 50 frame tidak memajukan waktu", g.state.day === day0);
  check("tidak bisa mulai tanpa negara", (g.resume(), g.paused === true));

  // ---- mulai skenario ----
  g.startScenario(); await sleep(50);
  const st = () => g.state;
  check("skenario: pemain = Indonesia", st().player === "IDN");
  check("skenario: tab Misi muncul", !d.getElementById("tab-mission").hidden && /Misi latihan/.test(panel()));
  check("skenario: ibu kota Jakarta Raya terpilih", /Jakarta Raya/.test(d.getElementById("tab-mission") ? W.provinces[g.state.countries.IDN.capital].name : ""));
  closeModal(true);   // tombol pertama "Mulai" -> resume
  check("modal skenario 'Mulai' menjalankan game", g.paused === false);
  g.setSpeed(5);
  const dA = st().day; for (let i = 0; i < 20; i++) g.frame();
  check("kecepatan 5×: 20 frame = ~10 hari", st().day - dA >= 9 && st().day - dA <= 11, st().day - dA);
  g.pause(); const dB = st().day; for (let i = 0; i < 30; i++) g.frame();
  check("pause lagi: waktu berhenti", st().day === dB);

  // ---- mode peta membaca state ----
  const sample = Object.values(W.provinces).find((p) => p.name === "Jawa Tengah" && p.country === "IDN").id;
  const el0 = () => q('#province-root .province[data-id="' + sample + '"]');
  const fills = {};
  for (const m of ["political", "ownership", "control", "infra", "resources", "supply"]) {
    click(q('.mode-btn[data-mode="' + m + '"]')); fills[m] = el0().getAttribute("fill");
  }
  check("6 mode peta menghasilkan warna (infra/sumber daya/supply berbeda dari politik)", fills.infra !== fills.political && fills.resources !== fills.political && fills.supply !== fills.political, JSON.stringify(fills).slice(0, 160));
  check("legenda berubah menurut mode", /Supply/.test(d.getElementById("map-legend").innerHTML));
  click(q('.mode-btn[data-mode="resources"]')); click(q('.res-btn[data-r="oil"]'));
  check("mode sumber daya: pilihan oil", /Minyak/.test(d.getElementById("map-legend").innerHTML));
  click(q('.mode-btn[data-mode="political"]'));

  // ---- klik provinsi, tooltip ----
  w.WO.MapView.zoomPreset("java");
  click(el0());
  check("klik provinsi: tab Provinsi menampilkan owner & controller", /Jawa Tengah/.test(panel()) && /Pemilik \(owner\)/.test(panel()) && /Penguasa \(controller\)/.test(panel()));
  el0().dispatchEvent(new w.MouseEvent("pointermove", { bubbles: true, clientX: 120, clientY: 90 }));
  check("tooltip provinsi", d.getElementById("map-tooltip").style.display === "block" && /Jawa Tengah/.test(d.getElementById("map-tooltip").textContent));

  // ---- bangun & rekrut lewat tombol ----
  const q0 = st().countries.IDN.queue.length, tre0 = st().countries.IDN.treasury;
  const buildBtn = qa('#panel [data-act="build"][data-type="mil"]')[0];
  check("tombol bangun pabrik militer tersedia (aktif)", buildBtn && !buildBtn.disabled);
  click(buildBtn);
  check("klik tombol bangun: antrean +1, kas berkurang", st().countries.IDN.queue.length === q0 + 1 && st().countries.IDN.treasury < tre0);
  UI = w.WO.UI; UI.setTab("build");
  check("tab Bangun menampilkan proyek", /Pabrik militer/.test(panel()) && /Batal/.test(panel()));
  UI.setTab("production");
  const lineBtn = qa('#panel [data-act="line"][data-e="rifles"][data-d="1"]')[0];
  click(lineBtn);
  check("tombol + lini produksi menambah pabrik", st().countries.IDN.lines.length === 1 && st().countries.IDN.lines[0].factories === 1);
  UI.setTab("military");
  const divs0 = Object.keys(st().divisions).length;
  const recBtn = qa('#panel [data-act="recruit"][data-type="infantry"]')[0];
  click(recBtn);
  check("tombol rekrut menambah divisi", Object.keys(st().divisions).length === divs0 + 1);

  // ---- pilih divisi & perintah (klik kanan) ----
  const mine = WO.State.countryDivisions(st(), "IDN").filter((x) => x.province === st().countries.IDN.capital && st().day >= x.readyDay);
  const selBtn = qa('#panel [data-act="divsel"]')[0]; click(selBtn);
  check("memilih divisi dari daftar", g.state && WO.UI.s.selDivs.size === 1);
  const target = Object.values(W.provinces).find((p) => p.name === "Jawa Timur" && p.country === "IDN").id;
  click(q('#province-root .province[data-id="' + target + '"]'), "contextmenu");
  const sd = st().divisions[[...WO.UI.s.selDivs][0]];
  check("klik kanan provinsi memberi perintah gerak (bukan teleportasi)", sd.order && sd.order.target === target && sd.province !== target, sd.order && sd.order.path.length + " langkah");
  w.WO.MapView.refreshOverlay();
  check("jalur perintah digambar di peta", qa("#overlay-root .path-line").length >= 1);
  check("penanda unit digambar", qa("#overlay-root .unit").length >= 1);
  check("bintang ibu kota digambar", qa("#overlay-root path[fill='#ffd24a']").length >= 1);
  const unitEl = qa("#overlay-root .unit")[0]; click(unitEl);
  check("klik penanda unit memilih divisi & membuka tab Militer", /Daftar divisi/.test(panel()));
  click(q('#tabs [data-tab="military"]'));
  click(qa('#panel [data-act="cancelorder"]')[0]);
  check("batalkan perintah", !sd.order);

  // ---- diplomasi & perang ----
  const tls = "TLS";
  w.WO.UI.viewCountrySet(tls); UI.setTab("diplomacy");
  check("panel diplomasi untuk Timor-Leste", /East Timor/.test(panel()) && /Nyatakan perang/.test(panel()));
  click(qa('#panel [data-act="pact"][data-type="nap"]')[0]);
  check("tombol pakta non-agresi memberi umpan balik (diterima/ditolak, bukan diam)", /Pakta|menolak/.test(d.getElementById("toast-area").textContent) || st().diplo.history.length > 0);
  const declBtn = qa('#panel [data-act="declare"]')[0];
  if (WO.Dip.hasPact(st(), "nap", "IDN", tls)) click(qa('#panel [data-act="breakpact"]')[0]);
  UI.setTab("diplomacy");
  click(qa('#panel [data-act="declare"]')[0]);
  check("deklarasi perang meminta konfirmasi (modal)", !d.getElementById("modal").hidden);
  click(d.querySelector('#modal [data-mb="1"]'));
  check("setelah konfirmasi: status perang tersimpan", WO.Dip.atWar(st(), "IDN", tls));
  check("tidak ada deklarasi ganda", !WO.Dip.declareWar(st(), "IDN", tls).ok);

  // ---- simulasi: kirim pasukan, duduki, lihat peta berubah ----
  const dili = st().countries.TLS.capital, ntt = Object.values(W.provinces).find((p) => p.name === "Nusa Tenggara Timur" && p.country === "IDN").id;
  const ids = WO.State.countryDivisions(st(), "IDN").map((x) => x.id);
  // teleport-bebas: letakkan pasukan di NTT lewat API internal HANYA untuk menghemat waktu uji (gerak sudah diuji di tests/scenario.js)
  for (const id of ids.slice(0, 10)) { WO.State.moveDivisionTo(st(), st().divisions[id], ntt); st().divisions[id].readyDay = 0; }
  WO.Mil.orderMove(st(), "IDN", ids.slice(0, 10), dili);
  g.resume(); g.setSpeed(10);
  for (let i = 0; i < 1500 && !(st().provinces[dili].controller === "IDN"); i++) g.frame();
  g.pause();
  const dEl = q('#province-root .province[data-id="' + dili + '"]');
  check("Dili diduduki: controller Indonesia, owner Timor-Leste", st().provinces[dili].controller === "IDN" && st().provinces[dili].owner === "TLS", "hari " + st().day);
  click(q('.mode-btn[data-mode="political"]'));
  check("peta politik menandai wilayah pendudukan dengan POLA (bukan warna polos)", /^url\(#occ/.test(dEl.getAttribute("fill")), dEl.getAttribute("fill"));
  check("data-o/data-k di elemen peta mengikuti owner/controller", dEl.dataset.o === "TLS" && dEl.dataset.k === "IDN");
  click(q('.mode-btn[data-mode="control"]'));
  check("mode kontrol militer juga memakai pola untuk wilayah diduduki", /^url\(#occ/.test(dEl.getAttribute("fill")));
  click(q('.mode-btn[data-mode="political"]'));
  UI.setTab("war"); check("panel perang menampilkan skor perang, syarat damai, dan daftar pertempuran", /Skor perang kita/.test(panel()) && /Syarat damai/.test(panel()) && /Pertempuran hari ini/.test(panel()));

  // ---- lanjut sampai kapitulasi, damai lewat tombol ----
  g.resume(); g.setSpeed(10);
  for (let i = 0; i < 2000 && !st().countries.TLS.capitulated; i++) g.frame();
  g.pause();
  check("Timor-Leste kapitulasi (lewat loop UI)", st().countries.TLS.capitulated, "hari " + st().day);
  check("game otomatis pause + modal saat musuh kapitulasi", g.paused && !d.getElementById("modal").hidden);
  closeModal(); UI.setTab("war");
  const transferBtn = qa('#panel [data-act="settle"][data-kind="transfer"]')[0];
  check("tombol 'ambil provinsi' aktif setelah kapitulasi", transferBtn && !transferBtn.disabled);
  const ownedBefore = st().rt.owned.IDN.size; click(transferBtn);
  check("klik damai: owner berpindah HANYA sekarang", st().rt.owned.IDN.size > ownedBefore && !WO.Dip.atWar(st(), "IDN", tls), "+" + (st().rt.owned.IDN.size - ownedBefore));
  UI.setTab("mission");
  const done = (panel().match(/class="check done"/g) || []).length;
  check("misi latihan: ≥ 12 dari 14 langkah selesai", done >= 12, done + "/14");

  // ---- simpan / muat ----
  click(q("#btn-save"));
  check("simpan ke localStorage", !!w.localStorage.getItem(WO.SAVE_KEY) && st().flags.saved !== undefined);
  const sig = () => JSON.stringify([st().day, st().player, st().rt.owned.IDN.size, Object.keys(st().divisions).length, st().countries.IDN.treasury.toFixed(1)]);
  const before = sig();
  g.resume(); g.setSpeed(5); for (let i = 0; i < 40; i++) g.frame(); g.pause();
  click(q("#btn-load"));
  check("muat mengembalikan state yang disimpan", sig() === before, sig());
  check("UI tetap berfungsi setelah muat (provinsi masih bisa diklik)", (click(el0()), /Jawa Tengah/.test(panel())));

  // ---- semua tab merender tanpa error ----
  for (const t of ["country", "province", "military", "economy", "build", "production", "diplomacy", "war", "log", "mission"]) { UI.setTab(t); }
  check("semua 10 tab merender tanpa error", errors.length === 0 && panel().length > 50, errors.join(" | ").slice(0, 200));

  // ---- save lama tidak membuat crash ----
  w.localStorage.clear(); w.localStorage.setItem("worldOrderV01", JSON.stringify({ day: 5 }));
  click(q("#btn-load"));
  check("save lama v0.1–0.3: pesan aman, tidak crash", /tidak kompatibel/.test(d.getElementById("modal").innerHTML) && errors.length === 0);
  closeModal();
  w.localStorage.setItem(WO.SAVE_KEY, "{bukan json");
  click(q("#btn-load")); check("save rusak: pesan aman", /rusak/.test(d.getElementById("modal").innerHTML)); closeModal();
  const bad = WO.Save.serialize(st()); bad.schema = 3; w.localStorage.setItem(WO.SAVE_KEY, JSON.stringify(bad));
  click(q("#btn-load")); check("save skema lain ditolak dengan peringatan", /skema 3/.test(d.getElementById("modal").innerHTML)); closeModal();

  // ---- permainan baru & escape HTML ----
  const victim = Object.values(W.provinces).find((p) => p.country === "IDN");
  const origName = victim.name; victim.name = '<b id="xss">x</b><img src=x onerror="window.__pwn=1">';
  UI.selectProvince(victim.id, true);
  check("nama berisi HTML tidak dieksekusi (di-escape di panel)", !d.getElementById("xss") && !w.__pwn && /&lt;b id=/.test(panel()));
  victim.name = origName;
  g.newGame(5); check("permainan baru: hari 0, tanpa pemain", st().day === 0 && st().player === null);
  check("tidak ada error JavaScript selama seluruh uji UI", errors.length === 0, errors.join(" | ").slice(0, 300));
  console.log("\n" + (fails ? fails + " DARI " + n + " GAGAL" : "SEMUA " + n + " PENGECEKAN UI LOLOS"));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("TEST CRASH", e); process.exit(2); });
