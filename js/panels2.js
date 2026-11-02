// ===== WORLD ORDER — PANEL TAMBAHAN: Fokus Nasional, Database, Logistik, Perdagangan =====
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, C = WO.C, U = WO.util, UI = WO.UI, DB = WO.DB;
  const P = UI.panels, esc = UI.esc, fmt = UI.fmt, fmt1 = UI.fmt1, kv = UI.kv, cname = UI.cname, pname = UI.pname;
  const $ = (id) => document.getElementById(id);
  const ui = UI.s;
  const btn = (label, act, data, opt) => { opt = opt || {}; let a = ""; for (const k in data || {}) a += " data-" + k + '="' + esc(data[k]) + '"'; return '<button class="btn ' + (opt.cls || "") + (opt.sm ? " sm" : "") + '" data-act="' + act + '"' + a + (opt.disabled ? " disabled" : "") + (opt.title ? ' title="' + esc(opt.title) + '"' : "") + ">" + label + "</button>"; };
  const VLABEL = { verified: "terverifikasi", partially_verified: "sebagian", unknown: "tidak diketahui", disputed: "diperselisihkan", fictional_gameplay: "gameplay" };
  const vbadge = (v) => '<span class="vbadge v-' + v.status + '" title="keyakinan: ' + v.confidence + '">' + VLABEL[v.status] + " · " + v.confidence + "</span>";
  const srcLine = (v) => (v.sources || []).map((s) => { const x = DB.sources && DB.sources[s]; return x ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener" style="color:var(--info)">' + esc(x.publisher) + "</a> <span class=\"sub\">(" + x.type + ", diakses " + x.accessed + ")</span>" : esc(s); }).join("; ");
  UI.vbadge = vbadge;

  // ---------- kartu pemimpin pada tanggal tertentu ----------
  const ROLE = { head_of_state: "Kepala negara", head_of_government: "Kepala pemerintahan", deputy_head_of_state: "Wakil kepala negara" };
  UI.leadersHtml = function (iso, date, withSources) {
    if (!DB.ready) return '<p class="sub">Database belum dimuat.</p>';
    if (!DB.hasLeaders(iso)) DB._leaders[iso] = null;
    if (DB._leaders[iso] === undefined) { DB.loadLeaders(iso).then(() => { if (UI.state()) UI.drawPanel(); }); return '<p class="sub">Memuat data pemimpin…</p>'; }
    const r = DB.leadersAt(iso, date);
    if (!r) return '<div class="leader-card"><div class="portrait">' + WO.Icons.svg("soldier", 26) + '</div><div><b>Data pemimpin belum tersedia</b><div class="sub">Status: <span class="vbadge v-unknown">tidak diketahui</span> — negara ini belum diriset (checkpoint 1 hanya mencakup Indonesia). Tidak ada nama yang dikarang.</div></div></div>';
    let h = ""; const shown = new Set();
    const roles = ["head_of_state", "head_of_government", "deputy_head_of_state"];
    for (const role of roles) {
      const x = r[role]; if (x === undefined) continue;
      if (x === null) { h += '<div class="kv"><span>' + ROLE[role] + "</span><b>tidak ada data pada tanggal ini</b></div>"; continue; }
      if (x.vacancy) { h += '<div class="leader-card"><div class="portrait">' + WO.Icons.svg("soldier", 26) + "</div><div><div class=\"sub\">" + ROLE[role] + "</div><b>Jabatan kosong</b><div class=\"sub\">" + esc(x.vacancy.reason) + "</div></div></div>"; continue; }
      const t = x.tenure; if (shown.has(t.id)) continue; shown.add(t.id);
      const label = t.roles.length > 1 ? "Kepala negara & pemerintahan" : ROLE[role];
      h += '<div class="leader-card"><div class="portrait">' + WO.Icons.svg("soldier", 26) + "</div><div><div class=\"sub\">" + label + "</div><b>" + esc(x.person.name) + "</b> " + vbadge(t.verification) +
        '<div class="sub">' + esc(t.office_title) + " • sejak " + t.start.date + (t.end ? " s.d. " + t.end.date : " (masih menjabat per " + t.ongoing_as_of + ")") + "</div>" +
        (t.party ? '<div class="sub">Partai: ' + esc(t.party) + (t.party_status ? " " + vbadge({ status: t.party_status, confidence: t.verification.confidence }) : "") + "</div>" : '<div class="sub">Partai: tidak tercatat di sumber</div>') +
        (withSources ? '<div class="sub">Sumber: ' + srcLine(t.verification) + (t.verification.notes ? "<br>Catatan: " + esc(t.verification.notes) : "") + "</div>" : "") + "</div></div>";
    }
    return h;
  };

  // ---------- Politik: tambahan data pemimpin di panel negara ----------
  const baseCountry = P.country;
  P.country = function (st, ui2) {
    const iso = ui2.viewCountry || st.player; let html = baseCountry(st, ui2);
    if (!iso || !st.countries[iso] || !st.countries[iso].exists) return html;
    const sec = "<h3>Pemerintahan (data sejarah, tanggal permainan)</h3>" + UI.leadersHtml(iso, DB.isoOfDay(st.day), false) + '<div class="note">Sumber & tingkat keyakinan lengkap: tab Data. Nilai gameplay (stabilitas, dll.) terpisah dari data sejarah.</div>';
    const at = html.indexOf("<h3>Ringkasan</h3>");
    return at > -1 ? html.slice(0, at) + sec + html.slice(at) : html + sec;
  };

  // ================= FOKUS NASIONAL =================
  const NW = 148, NH = 92, NODE_W = 132, NODE_H = 62;
  const pos = (f, minx) => ({ x: (f.x - minx) * NW + 20, y: f.y * NH + 20 });
  P.focus = function (st, ui2) {
    const me = st.player; if (!me) return "<h2>Fokus Nasional</h2>" + '<p class="sub">Pilih negara yang dipimpin dulu.</p>';
    const t = WO.Focus.tree(me), c = st.countries[me];
    if (!t) return "<h2>Fokus Nasional</h2><p>Pohon fokus belum dimuat.</p>";
    const minx = Math.min(...t.focuses.map((f) => f.x)), maxx = Math.max(...t.focuses.map((f) => f.x)), maxy = Math.max(...t.focuses.map((f) => f.y));
    const W_ = (maxx - minx + 1) * NW + 40, H_ = (maxy + 1) * NH + 40, z = ui2.focusZoom || 1;
    const idx = Object.fromEntries(t.focuses.map((f) => [f.id, f]));
    let lines = "";
    for (const f of t.focuses) {
      const b = pos(f, minx);
      const link = (pid, dash) => { const a = pos(idx[pid], minx), x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y, my = (y1 + y2) / 2; lines += '<path d="M' + x1 + "," + y1 + " C" + x1 + "," + my + " " + x2 + "," + my + " " + x2 + "," + y2 + '" stroke="' + (dash ? "#6f8cb0" : "#8a9566") + '" stroke-width="2" fill="none"' + (dash ? ' stroke-dasharray="5 4"' : "") + "/>"; };
      for (const p of f.prerequisites || []) link(p, false);
      for (const g of f.any_of || []) for (const p of g) link(p, true);
      for (const x of f.exclusive || []) if (f.id < x) { const a = pos(idx[x], minx); lines += '<path d="M' + (b.x + NODE_W) + "," + (b.y + NODE_H / 2) + " L" + a.x + "," + (a.y + NODE_H / 2) + '" stroke="#cd5b4d" stroke-width="2" stroke-dasharray="3 5" fill="none"/><text x="' + ((b.x + NODE_W + a.x) / 2 - 4) + '" y="' + ((b.y + a.y) / 2 + NODE_H / 2 + 4) + '" fill="#cd5b4d" font-size="13">✕</text>'; }
    }
    let nodes = "";
    for (const f of t.focuses) {
      const p = pos(f, minx), s = WO.Focus.status(st, me, f.id);
      nodes += '<button class="fnode ' + s + (ui2.focusSel === f.id ? " sel" : "") + '" style="left:' + p.x + "px;top:" + p.y + 'px" data-act="focussel" data-id="' + f.id + '"><span class="fi">' + WO.Icons.svg(f.icon || "star", 18) + '</span><span class="ft">' + esc(f.title) + "<small>" + f.days + " hari</small></span>" + (s === "current" ? '<i class="pb" style="width:' + Math.round((1 - c.focus.current.left / c.focus.current.total) * 100) + '%"></i>' : "") + "</button>";
    }
    const cur = c.focus.current, curF = cur && WO.Focus.get(me, cur.id);
    let h = "<h2>Fokus Nasional</h2>";
    h += '<div class="focus-bar"><div id="focus-current" style="flex:1;min-width:200px">' + focusCurrentHtml(st, me) + '</div><input type="search" id="focus-search" placeholder="Cari fokus…" value="' + esc(ui2.focusQuery || "") + '" style="width:170px">' +
      btn(WO.Icons.svg("plus", 14), "focuszoom", { d: 0.15 }, { sm: true, title: "Perbesar" }) + btn(WO.Icons.svg("minus", 14), "focuszoom", { d: -0.15 }, { sm: true, title: "Perkecil" }) + "</div>";
    h += '<div class="focus-viewport" id="focus-viewport"><div style="position:relative;width:' + W_ * z + "px;height:" + H_ * z + 'px"><div class="focus-canvas" style="width:' + W_ + "px;height:" + H_ + "px;transform:scale(" + z + ')"><svg class="links" width="' + W_ + '" height="' + H_ + '">' + lines + "</svg>" + nodes + "</div></div></div>";
    // cabang
    h += '<div class="note">' + t.branches.map((b) => esc(b.title)).join(" • ") + " — garis penuh = prasyarat, putus-putus biru = salah satu dari, merah ✕ = saling eksklusif. Pohon generik = konten fiksi gameplay orisinal.</div>";
    h += '<div class="focus-tip" id="focus-tip">' + focusTipHtml(st, me, ui2.focusSel) + "</div>";
    return h;
  };
  function focusCurrentHtml(st, me) {
    const c = st.countries[me], cur = c.focus.current;
    if (!cur) return '<span class="sub">Tidak ada fokus aktif. Selesai: ' + c.focus.done.length + " fokus.</span>";
    const f = WO.Focus.get(me, cur.id);
    return "<b>" + esc(f.title) + '</b> <span class="sub">— ' + cur.left + " hari lagi</span>" + UI.bar(cur.total - cur.left, cur.total) + " " + btn("Batalkan", "focuscancel", {}, { sm: true, cls: "danger" });
  }
  function focusTipHtml(st, me, id) {
    if (!id) return '<span class="sub">Klik sebuah fokus untuk melihat detail, prasyarat, dan efeknya. Hover = sorot rantai prasyarat (biru) dan turunan (oranye).</span>';
    const f = WO.Focus.get(me, id); if (!f) return "";
    const s = WO.Focus.status(st, me, id), chk = WO.Focus.canStart(st, me, id), idx = (x) => WO.Focus.get(me, x).title;
    const c = st.countries[me], dn = (x) => (c.focus.done.indexOf(x) !== -1 ? "✔ " : "○ ");
    let h = "<h4>" + esc(f.title) + ' <span class="badge ' + (s === "done" ? "good" : s === "available" ? "warn" : s === "current" ? "info" : "bad") + '">' + { done: "selesai", current: "berjalan", available: "tersedia", locked: "terkunci", excluded: "dikecualikan" }[s] + '</span> <span class="vbadge v-fictional_gameplay">' + (f.classification === "generic" ? "generik · gameplay" : f.classification) + "</span></h4><div class=\"sub\">" + esc(f.desc) + "</div>";
    h += '<div class="kv"><span>Durasi</span><b>' + f.days + " hari</b></div>";
    if ((f.prerequisites || []).length) h += '<div class="kv"><span>Prasyarat</span><b style="text-align:left">' + f.prerequisites.map((p) => dn(p) + esc(idx(p))).join("<br>") + "</b></div>";
    if ((f.any_of || []).length) h += '<div class="kv"><span>Salah satu dari</span><b style="text-align:left">' + f.any_of.map((g) => g.map((p) => dn(p) + esc(idx(p))).join(" / ")).join("<br>") + "</b></div>";
    if ((f.available || []).length) h += '<div class="kv"><span>Syarat</span><b style="text-align:left">' + f.available.map((cd) => (WO.Fx.cond(st, me, cd) ? "✔ " : "○ ") + esc(WO.Fx.condText(cd))).join("<br>") + "</b></div>";
    if ((f.exclusive || []).length) h += '<div class="kv"><span>Menutup</span><b style="text-align:left">' + f.exclusive.map((x) => esc(idx(x))).join(", ") + "</b></div>";
    h += '<div class="kv"><span>Efek</span><b style="text-align:left">' + f.effects.map((e) => esc(WO.Fx.text(e))).join("<br>") + "</b></div>";
    h += btn("Mulai fokus", "focusstart", { id }, { cls: "primary", disabled: !chk.ok, title: chk.ok ? "" : chk.reason }) + (chk.ok ? "" : '<span class="sub"> ' + esc(chk.reason) + "</span>");
    return h;
  }
  UI.focusSelect = function (id) {
    const st = UI.state(); ui.focusSel = id;
    document.querySelectorAll(".fnode").forEach((n) => n.classList.toggle("sel", n.dataset.id === id));
    const tip = $("focus-tip"); if (tip) tip.innerHTML = focusTipHtml(st, st.player, id);
  };
  UI.afterDraw.focus = function (st, ui2) {
    const vp = $("focus-viewport"); if (vp && ui2.focusScroll) { vp.scrollLeft = ui2.focusScroll[0]; vp.scrollTop = ui2.focusScroll[1]; }
    if (ui2.focusQuery) UI.focusSearch(ui2.focusQuery, false);
  };
  UI.focusSearch = function (q, scroll) {
    ui.focusQuery = q; q = q.trim().toLowerCase();
    const st = UI.state(), t = st.player && WO.Focus.tree(st.player); if (!t) return;
    let first = null;
    document.querySelectorAll(".fnode").forEach((n) => {
      const f = WO.Focus.get(st.player, n.dataset.id), hit = !q || (f.title + " " + f.desc).toLowerCase().indexOf(q) !== -1;
      n.classList.toggle("hit", !!q && hit); n.classList.toggle("dim", !!q && !hit); if (q && hit && !first) first = n;
    });
    if (first && scroll) first.scrollIntoView && first.scrollIntoView({ block: "center", inline: "center" });
  };
  UI.focusHover = function (id) {
    const st = UI.state(); document.querySelectorAll(".fnode").forEach((n) => n.classList.remove("rel-anc", "rel-des"));
    if (!id || !st.player) return;
    const r = WO.Focus.relations(st.player, id);
    document.querySelectorAll(".fnode").forEach((n) => { if (r.anc.has(n.dataset.id)) n.classList.add("rel-anc"); if (r.des.has(n.dataset.id)) n.classList.add("rel-des"); });
  };

  // ================= DATABASE SEJARAH =================
  const DB_MIN = "1991-01-01", DB_MAX = "2026-12-31";
  function dbResults(iso, date) {
    const rec = DB.country(iso), year = +date.slice(0, 4);
    let h = "<h3>" + esc(W.countries[iso].name) + " — " + date + "</h3>";
    if (rec) {
      h += kv("Nama resmi", rec.names.official ? esc(rec.names.official) : '<span class="sub">tidak diketahui</span>') + kv("Pembentukan", rec.existence.from || '<span class="sub">null — ' + esc(rec.unknown_fields["existence.from"] || "belum diriset") + "</span>");
      const cap = rec.capitals[0]; h += kv("Ibu kota (kini)", esc(cap.city) + " " + vbadge(cap.verification) + (cap.approximate ? ' <span class="badge warn">perkiraan</span>' : ""));
      if (rec.executive) h += kv("Struktur eksekutif", esc(rec.executive.structure.replace(/_/g, " ")) + " " + vbadge(rec.executive.verification));
      h += '<div class="note">Bidang null = belum diketahui (alasan di <code>unknown_fields</code>). Nilai PDB/populasi gameplay tidak diambil dari database ini.</div>';
    }
    h += "<h3>Pemimpin pada " + date + "</h3>" + UI.leadersHtml(iso, date, true);
    const cov = DB._leaders[iso] ? DB.coverageOf(iso, DB_MIN, "2026-08-29") : null;
    if (cov) h += '<div class="note">Cakupan data 1991-01-01 → 2026-08-29: ' + Object.entries(cov).map(([r, v]) => ROLE[r] + " " + (v * 100).toFixed(1) + "%").join(" • ") + " (tenure + vacancy tercatat)</div>";
    const eq = DB._equipment ? DB.equipmentOf(iso, year) : [];
    h += "<h3>Alutsista terdata pada tahun " + year + "</h3>";
    h += eq.length ? eq.map((m) => '<div class="row"><div class="grow"><div class="name">' + esc(m.name) + " " + vbadge(m.verification) + '</div><div class="sub">' + m.category.replace(/_/g, " ") + " • produsen " + m.manufacturers.map((x) => esc((DB._equipment.manufacturers[x] || { name: x }).name)).join(", ") + " • masuk dinas " + (m.service_entry_year || "?") + " • varian: " + m.variants.map((v) => esc(v.name) + (v.status !== "operational" ? " (" + v.status + ")" : "")).join(", ") + "</div></div></div>").join("") + '<div class="note">Daftar ini hanya model dengan operator terverifikasi; pesanan/tawaran tidak dihitung. Belum ada jumlah inventaris terverifikasi.</div>' : '<p class="sub">Tidak ada alutsista terdata untuk negara/tahun ini (bukan berarti tidak punya: datanya belum dikumpulkan).</p>';
    const evs = (DB._events || []).filter((e) => e.countries.indexOf(iso) !== -1 && e.date);
    if (evs.length) h += "<h3>Event historis dalam database</h3>" + evs.sort((a, b) => (a.date.date < b.date.date ? -1 : 1)).map((e) => '<div class="logline"><time>' + e.date.date + (e.date.precision !== "day" ? " (" + e.date.precision + ")" : "") + "</time>" + esc(e.title) + " " + vbadge(e.verification) + "</div>").join("") + '<div class="note">Hanya menyala pada campaign yang dimulai sebelum tanggalnya. Campaign 1991/2001 belum tersedia (butuh lapisan batas wilayah historis).</div>';
    return h;
  }
  P.database = function (st, ui2) {
    if (!DB.ready) return "<h2>Database</h2><p>Belum dimuat.</p>";
    const iso = ui2.viewCountry || st.player || "IDN";
    if (!ui2.dbDate) ui2.dbDate = DB.isoOfDay(st.day);
    const st2 = DB.stats(), files = DB.manifest.files;
    const cnt = (k) => files.filter((f) => f.kind === k).reduce((a, f) => a + f.count, 0);
    let h = "<h2>Database sejarah</h2><div class=\"sub\">Versi " + esc(st2.version) + " • skema " + esc(DB.manifest.schema) + " • rentang " + DB.manifest.range.from + " – " + DB.manifest.range.to + "</div>";
    h += '<div class="chips" style="margin:6px 0"><span class="badge">' + cnt("countries") + " negara (kerangka)</span><span class=\"badge\">" + cnt("leaders") + " masa jabatan</span><span class=\"badge\">" + cnt("equipment") + " model alutsista</span><span class=\"badge\">" + cnt("events") + " event</span><span class=\"badge\">" + st2.sources + " sumber</span></div>";
    h += '<div class="note">Pilih negara di peta untuk menggantinya (saat ini: <b>' + cname(iso) + "</b>). Geser tanggal untuk melihat siapa yang menjabat — data hanya yang benar-benar tercatat.</div>";
    h += '<div class="kv"><span>Tanggal</span><b id="db-date-label">' + ui2.dbDate + '</b></div><input type="range" id="db-date" min="' + DB.dayOfIso(DB_MIN) + '" max="' + DB.dayOfIso(DB_MAX) + '" value="' + DB.dayOfIso(ui2.dbDate) + '">';
    h += '<div id="db-results">' + dbResults(iso, ui2.dbDate) + "</div>";
    h += '<h3>Sumber & lisensi</h3>' + Object.values(DB.sources).map((s) => '<div class="logline"><b>' + esc(s.id) + "</b> " + esc(s.title) + ' <span class="sub">— ' + esc(s.publisher) + ", " + s.type + ", keandalan " + s.reliability + ", lisensi: " + esc(s.license) + ", diakses " + s.accessed + "</span></div>").join("");
    return h;
  };

  // ================= LOGISTIK =================
  P.logistics = function (st) {
    const me = st.player; if (!me) return '<h2>Logistik</h2><p class="sub">Pilih negara dulu.</p>';
    const divs = WO.State.countryDivisions(st, me).filter((d) => st.day >= d.readyDay);
    const sup = st.rt.supply[me], ctrl = st.rt.controlled[me];
    let avg = 0, low = [], none = 0; for (const d of divs) { avg += d.supply; if (d.supply < 0.5) low.push(d); if (d.supply < 0.25) none++; }
    avg = divs.length ? avg / divs.length : 0;
    let covered = 0; for (const pid of ctrl) if (sup && sup.has(pid)) covered++;
    let h = "<h2>Logistik & Supply</h2>" + kv("Rata-rata supply divisi", fmt(avg * 100) + "%") + kv("Divisi < 50% supply", low.length) + kv("Divisi dalam atrisi (< 25%)", none) +
      kv("Provinsi dikuasai bersuplai", covered + " / " + ctrl.size) + kv("Pusat supply", "ibu kota (" + C.SUPPLY_CAPITAL + ") + pusat regional (" + C.SUPPLY_REGIONAL + ")");
    h += '<div style="margin:6px 0">' + btn("Tampilkan peta supply", "mapmode", { mode: "supply" }, { cls: "primary" }) + "</div>";
    h += '<div class="note">Supply mengalir dari ibu kota lewat provinsi yang kamu kuasai; pendudukan musuh memutusnya. Biaya per langkah naik saat infrastruktur rendah. Efek: kecepatan, pemulihan organisasi, kekuatan tempur, atrisi (&lt;25%).</div>';
    h += "<h3>Divisi kekurangan supply</h3>";
    h += low.length ? low.sort((a, b) => a.supply - b.supply).slice(0, 25).map((d) => '<div class="row"><div class="grow"><div class="name">' + esc(d.name) + '</div><div class="sub">' + pname(d.province) + "</div></div><b>" + fmt(d.supply * 100) + "%</b></div>").join("") : '<p class="sub">Semua divisi cukup bersuplai.</p>';
    const c = st.countries[me]; h += "<h3>Konsumsi harian pasukan</h3>" + kv("Pangan", c.lastReport ? fmt1(c.lastReport.res.food.out) : "–") + kv("Minyak", c.lastReport ? fmt1(c.lastReport.res.oil.out) : "–");
    return h;
  };

  // ================= PERDAGANGAN =================
  P.trade = function (st, ui2) {
    const me = st.player; if (!me) return '<h2>Perdagangan</h2><p class="sub">Pilih negara dulu.</p>';
    const c = st.countries[me], tr = st.diplo.pacts.filter((p) => p.type === "trade" && (p.a === me || p.b === me)), t = ui2.viewCountry && ui2.viewCountry !== me ? ui2.viewCountry : null;
    let h = "<h2>Perdagangan</h2>";
    h += '<div class="note">Perjanjian dagang: tiap hari pembeli yang stok sumber dayanya di bawah ambang membeli (maks 10 unit/sumber daya) dari mitra yang stoknya melimpah, dengan harga $0,01 M/unit.</div>';
    h += "<h3>Mitra dagang</h3>" + (tr.length ? tr.map((p) => { const o = p.a === me ? p.b : p.a; return '<div class="row"><div class="grow"><b>' + UI.flag(o) + " " + cname(o) + '</b><div class="sub">sejak ' + WO.dateString(p.since) + "</div></div>" + btn("Batalkan", "breakpact", { id: p.id }, { sm: true, cls: "danger" }) + "</div>"; }).join("") : '<p class="sub">Belum ada.</p>');
    if (t) { const has = WO.Dip.hasPact(st, "trade", me, t); h += "<h3>Usulan</h3>" + btn("Ajukan perjanjian dagang dengan " + cname(t), "pact", { type: "trade", c: t }, { cls: "primary", disabled: has, title: has ? "Sudah ada" : "" }); } else h += '<p class="note">Klik negara lain di peta untuk mengajukan perjanjian dagang.</p>';
    h += "<h3>Neraca sumber daya</h3><table class=\"t\"><tr><th>Sumber daya</th><th>Stok</th><th>Net/hari</th><th>Dibeli (total)</th></tr>";
    for (const r of C.RESOURCES) { const e = c.lastReport ? c.lastReport.res[r] : { in: 0, out: 0 }, net = e.in - e.out; h += "<tr><td>" + C.RES_NAMES[r] + "</td><td>" + fmt(c.res[r]) + '</td><td class="' + (net < 0 ? "neg" : "pos") + '">' + (net >= 0 ? "+" : "") + fmt1(net) + "</td><td>" + fmt((c.trade && c.trade[r]) || 0) + "</td></tr>"; }
    return h + "</table>";
  };

  // ---------- event DOM untuk panel (delegasi) ----------
  UI.initPanelEvents = function () {
    const panel = $("panel");
    panel.addEventListener("input", (e) => {
      if (e.target.id === "focus-search") UI.focusSearch(e.target.value, true);
      else if (e.target.id === "db-date") {
        const st = UI.state(), iso = DB.isoOfDay(+e.target.value); ui.dbDate = iso; $("db-date-label").textContent = iso;
        $("db-results").innerHTML = dbResults(ui.viewCountry || st.player || "IDN", iso);
      }
    });
    panel.addEventListener("mouseover", (e) => { const n = e.target.closest && e.target.closest(".fnode"); UI.focusHover(n ? n.dataset.id : null); });
    panel.addEventListener("mouseleave", () => UI.focusHover(null));
    panel.addEventListener("scroll", (e) => { if (e.target.id === "focus-viewport") ui.focusScroll = [e.target.scrollLeft, e.target.scrollTop]; }, true);
    panel.addEventListener("wheel", (e) => { if (e.ctrlKey && e.target.closest && e.target.closest("#focus-viewport")) { e.preventDefault(); UI.focusZoom(e.deltaY < 0 ? 0.1 : -0.1); } }, { passive: false });
    let drag = null;
    panel.addEventListener("pointerdown", (e) => { const v = e.target.closest && e.target.closest("#focus-viewport"); if (v && !e.target.closest(".fnode")) drag = { x: e.clientX, y: e.clientY, l: v.scrollLeft, t: v.scrollTop, v }; });
    panel.addEventListener("pointermove", (e) => { if (drag) { drag.v.scrollLeft = drag.l - (e.clientX - drag.x); drag.v.scrollTop = drag.t - (e.clientY - drag.y); } });
    window.addEventListener("pointerup", () => { drag = null; });
    $("alerts").addEventListener("click", (e) => { const b = e.target.closest("[data-alert]"); if (b) UI.openAlert(+b.dataset.alert); });
  };
  UI.focusZoom = function (d) { ui.focusZoom = U.clamp((ui.focusZoom || 1) + d, 0.5, 1.6); UI.drawPanel(); };
  // pembaruan ringan tiap tick (tanpa menggambar ulang agar pencarian/scroll/slider tidak hilang)
  UI.liveUpdate = function (st) {
    if (ui.tab === "focus" && st.player) {
      const cur = $("focus-current"); if (cur) cur.innerHTML = focusCurrentHtml(st, st.player);
      document.querySelectorAll(".fnode").forEach((n) => { const s = WO.Focus.status(st, st.player, n.dataset.id); n.className = n.className.replace(/\b(done|current|available|locked|excluded)\b/g, "").trim() + " " + s; const pb = n.querySelector(".pb"); if (s === "current") { const c = st.countries[st.player].focus.current; if (pb) pb.style.width = Math.round((1 - c.left / c.total) * 100) + "%"; } });
      if (ui.focusSel) { const tip = $("focus-tip"); if (tip) tip.innerHTML = focusTipHtml(st, st.player, ui.focusSel); }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
