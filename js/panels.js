// ===== WORLD ORDER v0.4 — PANEL SAMPING =====
// Setiap panel adalah fungsi (state, ui) -> HTML. Semua tombol memakai data-act yang ditangani ui.js.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, C = WO.C, U = WO.util, UI = WO.UI;
  const P = UI.panels, esc = UI.esc, fmt = UI.fmt, fmt1 = UI.fmt1, kv = UI.kv, bar = UI.bar, cname = UI.cname, pname = UI.pname;

  function btn(label, act, data, opt) {
    opt = opt || {}; let a = "";
    for (const k in data || {}) a += " data-" + k + '="' + esc(data[k]) + '"';
    return '<button class="btn ' + (opt.cls || "") + (opt.sm ? " sm" : "") + '" data-act="' + act + '"' + a + (opt.disabled ? " disabled" : "") + (opt.title ? ' title="' + esc(opt.title) + '"' : "") + ">" + label + "</button>";
  }
  const needPlayer = () => '<p class="sub">Pilih negara di peta, lalu tekan <b>Pimpin negara ini</b> di tab Negara.</p>';
  const dayWord = (n) => Math.ceil(n) + " hari";

  // ================= NEGARA =================
  P.country = function (st, ui) {
    const iso = ui.viewCountry || st.player;
    if (!iso) {
      return "<h2>World Order</h2><p>Klik sebuah negara di peta (atau zoom in dan klik provinsi) untuk melihat datanya, lalu pilih <b>Pimpin negara ini</b>.</p>" +
        '<p>Mau langsung mencoba? Skenario latihan membawamu dari membangun pabrik sampai menaklukkan negara kecil.</p>' + btn("Mulai skenario latihan: Indonesia vs Timor-Leste", "scenario", {}, { cls: "primary" }) +
        '<p class="note">Spasi = pause. Klik kanan provinsi = perintah gerak/serang untuk divisi terpilih.</p>';
    }
    const c = st.countries[iso], wc = W.countries[iso], a = c.agg || WO.State.aggregate(st, iso);
    const mine = iso === st.player;
    let h = "<h2>" + UI.flag(iso) + " " + cname(iso) + "</h2>";
    h += '<div class="sub">' + (mine ? '<span class="badge good">Kamu</span> ' : '<span class="badge">AI</span> ') +
      (c.capitulated ? '<span class="badge bad">KAPITULASI</span> ' : "") + (!c.exists ? '<span class="badge bad">Dihapus dari peta</span> ' : "") +
      "statistik: " + wc.statSource + "</div>";
    if (!mine && c.exists) h += btn("Pimpin negara ini", "lead", { c: iso }, { cls: "primary" });
    if (!c.exists) return h + "<p>Negara ini telah dianeksasi.</p>";
    const divs = WO.State.countryDivisions(st, iso);
    let avg = 0; for (const d of divs) avg += d.str; avg = divs.length ? avg / divs.length : 0;
    h += "<h3>Ringkasan</h3>" + kv("PDB (dinamis)", "$" + fmt(a.gdp) + " M") + kv("Populasi (asal)", fmt1(wc.pop) + " juta") +
      kv("Stabilitas", fmt(c.stability) + "%") + kv("Kelelahan perang", fmt(c.exhaustion) + "%") + kv("Kas", "$" + fmt1(c.treasury) + " M") +
      kv("Manpower", fmt(c.manpower)) + kv("Pabrik sipil / militer", a.civ + " / " + a.mil) +
      kv("Provinsi dimiliki / dikuasai sendiri", a.nOwned + " / " + a.nHeldOwn) + kv("Divisi (rata-rata strength)", divs.length + " (" + fmt(avg) + "%)");
    const cap = st.provinces[c.capital], lost = cap.controller !== iso;
    h += "<h3>Ibu kota</h3>";
    h += kv("Provinsi", '<a href="#" onclick="return false" data-act="selprov" data-p="' + c.capital + '">' + pname(c.capital) + "</a>" + (lost ? ' <span class="badge bad">DIDUDUKI ' + cname(cap.controller) + "</span>" : ""));
    if (c.capital === wc.capital) h += kv("Kota", esc(wc.capitalName) + (wc.capitalApprox ? ' <span class="badge warn">perkiraan</span>' : ""));
    else h += kv("Kota", "dipindahkan");
    if (c.capitalHistory.length > 1) h += '<div class="note">Riwayat: ' + c.capitalHistory.map((x) => "hari " + x.day + " → " + pname(x.id)).join("; ") + "</div>";
    if (mine) h += '<p class="note">Pindahkan ibu kota: pilih provinsi milikmu (infra ≥ ' + C.RELOCATE_MIN_INFRA + ") di tab Provinsi. Biaya $" + WO.Cap.cost(st, iso) + " M, cooldown " + C.RELOCATE_COOLDOWN + " hari.</p>";
    const en = [...st.rt.enemies[iso]];
    if (en.length) {
      h += "<h3>Perang</h3>" + en.map((e) => '<span class="badge bad">' + cname(e) + "</span> ").join("");
      if (c.pressure) {
        h += '<div style="margin-top:6px">Tekanan kapitulasi ' + fmt(c.pressure.pressure) + " / " + C.CAP_PRESSURE + UI.bar(c.pressure.pressure, 100, c.pressure.pressure >= C.CAP_PRESSURE ? "bad" : "warn") + "</div>" +
          '<div class="note">Ibu kota ' + (c.pressure.capLost ? "<b>jatuh</b>" : "aman") + " • wilayah hilang " + fmt(c.pressure.lostFrac * 100) + "% • sisa pasukan " + fmt(c.pressure.armyRatio * 100) + "%</div>";
      }
    }
    h += "<h3>Peralatan</h3>" + C.EQUIP.map((e) => kv(C.EQUIP_INFO[e].name, fmt(c.stock[e]))).join("");
    return h;
  };

  // ================= PROVINSI =================
  P.province = function (st, ui) {
    const pid = ui.selProvince;
    if (!pid) return "<h2>Provinsi</h2><p>Klik provinsi di peta (zoom in dulu: scroll mouse atau tombol Indonesia / Pulau Jawa).</p>";
    const sp = st.provinces[pid], wp = W.provinces[pid], me = st.player, terr = C.TERRAIN[wp.terrain];
    const occupied = sp.controller !== sp.owner, mineP = me && sp.owner === me && sp.controller === me;
    let h = "<h2>" + pname(pid) + "</h2><div class=\"sub\">" + UI.flag(sp.owner) + " " + cname(sp.owner) + "</div>";
    h += "<h3>Status</h3>" + kv("Pemilik (owner)", cname(sp.owner)) + kv("Penguasa (controller)", cname(sp.controller) + (occupied ? ' <span class="badge bad">diduduki</span>' : ""));
    if (sp.owner !== wp.country) h += kv("Negara asal", cname(wp.country));
    if (pid === st.countries[sp.owner].capital) h += kv("Ibu kota", "★ " + cname(sp.owner));
    h += kv("Terrain <span class=\"badge\">sintetis</span>", terr.name) + kv("Infrastruktur", sp.infra + " / " + C.INFRA_MAX) +
      kv("Populasi <span class=\"badge\">sintetis</span>", fmt1(wp.popM) + " juta") + kv("Victory points", wp.vp) +
      kv("Pabrik sipil / militer", sp.civ + " / " + sp.mil + " (slot " + (sp.civ + sp.mil) + "/" + WO.Eco.slots(st, pid) + ")") +
      kv("Sumber daya/hari <span class=\"badge\">sintetis</span>", C.RESOURCES.map((r) => C.RES_NAMES[r].slice(0, 4) + " " + fmt1(wp.res[r])).join(" • "));
    if (me && sp.controller === me) { const v = st.rt.supply[me] && st.rt.supply[me].get(pid); h += kv("Supply", v ? fmt(U.clamp(v / C.SUPPLY_FULL, 0, 1) * 100) + "%" : "0%"); }
    const nb = wp.adj.map((id) => '<button class="chip-btn" data-act="selprov" data-p="' + id + '">' + pname(id) + "</button>").join("");
    h += "<h3>Tetangga darat</h3><div class=\"chips\">" + (nb || '<span class="sub">Pulau terpisah (tanpa tetangga darat)</span>') + "</div>";
    if (wp.sea.length) h += "<h3>Jalur penyeberangan laut</h3><div class=\"chips\">" + wp.sea.map(([id, km]) => '<button class="chip-btn" data-act="selprov" data-p="' + id + '">' + pname(id) + " · " + km + " km</button>").join("") + '</div><div class="note">Hanya dilalui pasukan antar wilayah milik/sekutu/akses sendiri.</div>';
    const ds = WO.State.divisionsIn(st, pid);
    if (ds.length) {
      h += "<h3>Divisi di sini</h3>";
      for (const d of ds) h += '<div class="row"><div class="grow"><div class="name">' + UI.flag(d.country) + " " + esc(d.name) + '</div><div class="sub">str ' + fmt(d.str) + "% • org " + fmt(d.org) + "</div></div></div>";
    }
    if (st.rt.combats[pid]) { const cb = st.rt.combats[pid]; h += '<div class="warnbox">⚔ Pertempuran hari ini: ' + cb.att + " penyerang vs " + cb.def + " bertahan.</div>"; }
    if (mineP) {
      h += "<h3>Bangun</h3>";
      for (const t of ["civ", "mil", "infra"]) {
        const b = C.BUILD[t], chk = WO.Eco.canBuild(st, me, t, pid), cap = st.countries[me].agg.civ * C.CONSTR_PER_CIV * WO.Eco.stabMod(st.countries[me]);
        const eta = cap > 0 ? b.pts / Math.min(cap, C.CONSTR_MAX_RATE) : Infinity;
        h += btn(b.name + " ($" + b.cost + " M, ~" + (isFinite(eta) ? dayWord(eta) : "∞") + ")", "build", { type: t, p: pid }, { disabled: !chk.ok, title: chk.ok ? "" : chk.reason });
      }
      h += "<h3>Rekrut divisi di sini</h3>";
      for (const t in C.DIV_TYPES) {
        const chk = WO.Mil.canRecruit(st, me, t, pid), dt = C.DIV_TYPES[t];
        h += btn(dt.name + " (" + fmt(dt.man) + " org)", "recruit", { type: t, p: pid }, { disabled: !chk.ok, title: chk.ok ? "$" + dt.cost + " M" : chk.reason });
      }
      const cr = WO.Cap.canRelocate(st, me, pid);
      if (pid !== st.countries[me].capital) h += "<h3>Ibu kota</h3>" + btn("Jadikan ibu kota ($" + WO.Cap.cost(st, me) + " M)", "setcap", { p: pid }, { disabled: !cr.ok, title: cr.ok ? "" : cr.reason }) + (cr.ok ? "" : '<div class="note">' + esc(cr.reason) + "</div>");
    } else if (me && sp.owner === me) h += '<div class="note">Provinsi ini sedang diduduki — tidak bisa membangun/merekrut sampai dibebaskan.</div>';
    if (me && ui.selDivs.size) h += "<h3>Perintah</h3>" + btn("Kirim " + ui.selDivs.size + " divisi terpilih ke sini", "orderhere", { p: pid }, { cls: "primary" });
    h += '<div style="margin-top:8px">' + btn("🔍 Zoom ke provinsi", "zoomprov", { p: pid }, { sm: true }) + "</div>";
    return h;
  };

  // ================= MILITER =================
  function divStatus(st, d) {
    if (st.day < d.readyDay) return "Melatih (" + (d.readyDay - st.day) + " hari)";
    if (d.attacking) return '<span class="neg">Menyerang ' + pname(d.attacking) + "</span>";
    if (d.order) return "→ " + pname(d.order.target) + " (" + (d.order.path.length - d.order.idx) + " langkah)";
    return "Siaga";
  }
  P.military = function (st, ui) {
    const me = st.player; if (!me) return "<h2>Militer</h2>" + needPlayer();
    const c = st.countries[me], divs = WO.State.countryDivisions(st, me).sort((a, b) => (a.province < b.province ? -1 : 1));
    let h = "<h2>Militer</h2>";
    if (c.capitulated) h += '<div class="warnbox">Negaramu kapitulasi: pasukan berhenti bertempur.</div>';
    h += kv("Divisi", divs.length) + kv("Manpower tersedia", fmt(c.manpower)) +
      kv("Peralatan", C.EQUIP.map((e) => C.EQUIP_INFO[e].name + " " + fmt(c.stock[e])).join(" • "));
    const target = ui.selProvince && st.provinces[ui.selProvince].owner === me && st.provinces[ui.selProvince].controller === me ? ui.selProvince : c.capital;
    h += "<h3>Rekrut di " + pname(target) + "</h3>";
    for (const t in C.DIV_TYPES) {
      const chk = WO.Mil.canRecruit(st, me, t, target), dt = C.DIV_TYPES[t];
      h += btn(dt.name, "recruit", { type: t, p: target }, { disabled: !chk.ok, title: chk.ok ? "$" + dt.cost + " M • " + fmt(dt.man) + " manpower" : chk.reason });
    }
    h += '<div class="note">Kebutuhan: ' + Object.entries(C.DIV_TYPES).map(([, t]) => t.name + " = " + fmt(t.man) + " org + " + Object.entries(t.eq).map(([e, n]) => n + " " + C.EQUIP_INFO[e].name.toLowerCase()).join(", ")).join(" | ") + "</div>";
    h += "<h3>Perintah (" + ui.selDivs.size + " terpilih)</h3>" +
      btn("Pilih semua", "divall", {}, { sm: true }) + btn("Kosongkan", "divclear", {}, { sm: true }) +
      btn(ui.orderMode ? "✔ Mode perintah aktif" : "Mode perintah", "ordermode", {}, { sm: true, cls: ui.orderMode ? "good" : "", disabled: !ui.selDivs.size, title: "Lalu klik provinsi tujuan di peta" }) +
      btn("Batalkan perintah", "cancelorder", {}, { sm: true, disabled: !ui.selDivs.size });
    h += '<div class="note">Atau klik kanan provinsi tujuan di peta. Serang = pilih provinsi musuh yang bertetangga.</div><h3>Daftar divisi</h3>';
    if (!divs.length) h += '<p class="sub">Belum ada divisi.</p>';
    for (const d of divs.slice(0, 80)) {
      const sel = ui.selDivs.has(d.id);
      h += '<div class="row' + (sel ? " sel" : "") + '"><button class="btn sm" data-act="divsel" data-id="' + d.id + '">' + (sel ? "☑" : "☐") + '</button><div class="grow"><div class="name">' + esc(d.name) +
        '</div><div class="sub">' + pname(d.province) + " • " + divStatus(st, d) + "</div>" + UI.bar(d.str, 100) + UI.bar(d.org, C.DIV_TYPES[d.type].org, "org") +
        '</div><div class="sub" style="text-align:right">sup ' + fmt(d.supply * 100) + "%</div>" +
        '<button class="btn sm danger" data-act="disband" data-id="' + d.id + '" title="Bubarkan">✕</button></div>';
    }
    if (divs.length > 80) h += '<p class="sub">…dan ' + (divs.length - 80) + " divisi lain.</p>";
    return h;
  };

  // ================= EKONOMI =================
  P.economy = function (st) {
    const me = st.player; if (!me) return "<h2>Ekonomi</h2>" + needPlayer();
    const c = st.countries[me], a = c.agg, r = c.lastReport;
    let h = "<h2>Ekonomi</h2>";
    h += "<h3>Keuangan (per hari)</h3>";
    if (r) h += kv("Pendapatan pajak", '<span class="pos">+$' + fmt1(r.income * 1000) + " jt</span>") + kv("Biaya pasukan", '<span class="neg">−$' + fmt1(r.upkeep * 1000) + " jt</span>") +
      kv("Biaya pertempuran", '<span class="neg">−$' + fmt1(r.war * 1000) + " jt</span>") + kv("Bersih", (r.income - r.upkeep - r.war >= 0 ? '<span class="pos">+' : '<span class="neg">') + "$" + fmt1((r.income - r.upkeep - r.war) * 1000) + " jt</span>");
    h += kv("Kas", "$" + fmt1(c.treasury) + " M") + kv("PDB dinamis", "$" + fmt(a.gdp) + " M") + kv("Pertumbuhan kumulatif", fmt1((c.growth - 1) * 100) + "%");
    h += "<h3>Industri</h3>" + kv("Pabrik sipil", a.civ) + kv("Pabrik militer (aktif)", a.mil + " (menganggur " + WO.Eco.freeFactories(c) + ")") +
      kv("Kapasitas konstruksi", r ? fmt1(r.constrCap) + " poin/hari" : "–") + kv("Efisiensi", "stabilitas ×" + WO.Eco.stabMod(c).toFixed(2) + ", batu bara ×" + (c.coalF === undefined ? 1 : c.coalF).toFixed(2));
    h += "<h3>Manpower</h3>" + kv("Tersedia", fmt(c.manpower) + " / " + fmt(c.manpowerMax)) + UI.bar(c.manpower, c.manpowerMax || 1, "org") + kv("Korban perang", fmt(c.casualties));
    h += '<h3>Sumber daya <span class="badge">sintetis</span></h3><table class="t"><tr><th>Sumber daya</th><th>Stok</th><th>Masuk</th><th>Keluar</th><th>Net</th></tr>';
    for (const k of C.RESOURCES) {
      const e = r ? r.res[k] : { in: 0, out: 0 }, net = e.in - e.out;
      h += "<tr><td>" + C.RES_NAMES[k] + "</td><td>" + fmt(c.res[k]) + "</td><td>" + fmt1(e.in) + "</td><td>" + fmt1(e.out) + '</td><td class="' + (net < 0 ? "neg" : "pos") + '">' + (net >= 0 ? "+" : "") + fmt1(net) + "</td></tr>";
    }
    h += "</table>";
    if ((c.foodF !== undefined && c.foodF < 1) || (c.oilF !== undefined && c.oilF < 1)) h += '<div class="warnbox">Kekurangan ' + (c.foodF < 1 ? "pangan " : "") + (c.oilF < 1 ? "minyak " : "") + "— supply dan tempur pasukan terganggu.</div>";
    const tr = st.diplo.pacts.filter((p) => p.type === "trade" && (p.a === me || p.b === me));
    h += "<h3>Perdagangan</h3>" + (tr.length ? tr.map((p) => '<span class="badge good">' + cname(p.a === me ? p.b : p.a) + "</span> ").join("") : '<span class="sub">Belum ada perjanjian dagang (tab Diplomasi).</span>');
    h += '<p class="note">Angka ekonomi & sumber daya bersifat sintetis untuk keseimbangan permainan, bukan data resmi.</p>';
    return h;
  };

  // ================= BANGUN =================
  P.build = function (st, ui) {
    const me = st.player; if (!me) return "<h2>Konstruksi</h2>" + needPlayer();
    const c = st.countries[me], cap = c.lastReport ? c.lastReport.constrCap : 0;
    let h = "<h2>Konstruksi</h2>" + kv("Kapasitas", fmt1(cap) + " poin/hari (pabrik sipil × " + C.CONSTR_PER_CIV + ")") + kv("Antrean", c.queue.length + " / 30");
    h += '<p class="note">Pilih provinsi milikmu di peta, lalu bangun lewat tab Provinsi. Proyek di provinsi yang diduduki berhenti.</p>';
    h += "<h3>Cepat (di ibu kota " + pname(c.capital) + ")</h3>";
    for (const t of ["civ", "mil", "infra"]) { const chk = WO.Eco.canBuild(st, me, t, c.capital); h += btn(C.BUILD[t].name + " ($" + C.BUILD[t].cost + " M)", "build", { type: t, p: c.capital }, { disabled: !chk.ok, title: chk.ok ? "" : chk.reason }); }
    h += "<h3>Antrean</h3>";
    if (!c.queue.length) h += '<p class="sub">Tidak ada proyek.</p>';
    let rem = cap;
    for (const q of c.queue) {
      const sp = st.provinces[q.province], active = sp.owner === me && sp.controller === me;
      const rate = active ? Math.min(Math.max(rem, 0), C.CONSTR_MAX_RATE, q.pts - q.progress) : 0; rem -= rate;
      const eta = rate > 0 ? (q.pts - q.progress) / rate : Infinity;
      h += '<div class="row"><div class="grow"><div class="name">' + C.BUILD[q.type].name + " — " + pname(q.province) + "</div>" + UI.bar(q.progress, q.pts) +
        '<div class="sub">' + fmt((q.progress / q.pts) * 100) + "% • " + (active ? (isFinite(eta) ? "~" + dayWord(eta) : "menunggu kapasitas") : '<span class="neg">provinsi diduduki</span>') + "</div></div>" +
        '<button class="btn sm danger" data-act="cancelbuild" data-id="' + q.id + '">Batal</button></div>';
    }
    return h;
  };

  // ================= PRODUKSI =================
  P.production = function (st) {
    const me = st.player; if (!me) return "<h2>Produksi</h2>" + needPlayer();
    const c = st.countries[me], a = c.agg, free = WO.Eco.freeFactories(c);
    let h = "<h2>Produksi peralatan</h2>" + kv("Pabrik militer", a.mil + " (menganggur " + free + ")") +
      '<p class="note">Tiap pabrik menghasilkan ' + C.PP_PER_MIL + " poin produksi/hari × efisiensi (mulai " + C.EFF_START * 100 + "%, naik " + C.EFF_GROW * 100 + "%/hari). Bahan baku dipakai dari stok; kalau habis, output turun.</p><h3>Lini produksi</h3>";
    for (const e of C.EQUIP) {
      const line = c.lines.find((l) => l.equip === e), info = C.EQUIP_INFO[e];
      h += '<div class="row"><div class="grow"><div class="name">' + info.name + '</div><div class="sub">biaya ' + info.pp + " PP • bahan: " + Object.entries(info.res).map(([r, v]) => C.RES_NAMES[r].toLowerCase() + " " + v).join(", ") + "</div>" +
        (line ? '<div class="sub">' + line.factories + " pabrik • efisiensi " + fmt(line.eff * 100) + "% • +" + fmt1(line.lastItems || 0) + "/hari" + (line.lastRatio !== undefined && line.lastRatio < 0.99 ? ' <span class="neg">(bahan baku kurang)</span>' : "") + " • total " + fmt(line.produced) + "</div>" + UI.bar(line.eff, 1) : '<div class="sub">tidak aktif</div>') +
        '</div><div>' + btn("−", "line", { e, d: -1 }, { sm: true, disabled: !line }) + btn("+", "line", { e, d: 1 }, { sm: true, disabled: free < 1 }) + "</div></div>";
    }
    h += "<h3>Stok peralatan</h3>" + C.EQUIP.map((e) => kv(C.EQUIP_INFO[e].name, fmt(c.stock[e]))).join("");
    h += "<h3>Kebutuhan divisi</h3><table class=\"t\"><tr><th>Tipe</th><th>Manpower</th>" + C.EQUIP.map((e) => "<th>" + C.EQUIP_INFO[e].name + "</th>").join("") + "</tr>";
    for (const t in C.DIV_TYPES) { const d = C.DIV_TYPES[t]; h += "<tr><td>" + d.name.replace("Divisi ", "") + "</td><td>" + fmt(d.man) + "</td>" + C.EQUIP.map((e) => "<td>" + (d.eq[e] || "–") + "</td>").join("") + "</tr>"; }
    return h + "</table>";
  };

  // ================= DIPLOMASI =================
  P.diplomacy = function (st, ui) {
    const me = st.player; if (!me) return "<h2>Diplomasi</h2>" + needPlayer();
    const t = ui.viewCountry && ui.viewCountry !== me ? ui.viewCountry : null;
    let h = "<h2>Diplomasi</h2>";
    if (!t) h += '<p class="sub">Klik negara lain di peta untuk melihat opsi diplomasi.</p>';
    else if (!st.countries[t].exists) h += "<p>Negara ini sudah tidak ada.</p>";
    else {
      const atWar = WO.Dip.atWar(st, me, t), op = WO.Dip.opinion(st, me, t);
      h += "<h3>" + UI.flag(t) + " " + cname(t) + "</h3>" + kv("Opini", '<span class="' + (op < 0 ? "neg" : "pos") + '">' + fmt(op) + "</span>") +
        kv("Status", atWar ? '<span class="badge bad">PERANG</span>' : WO.Dip.isAllied(st, me, t) ? '<span class="badge good">Sekutu</span>' : "Damai") +
        kv("Tentara (divisi)", WO.Eco.armyCount(st, t)) + kv("PDB", "$" + fmt(st.countries[t].agg.gdp) + " M");
      const cd = Math.max(0, (st.diplo.cd["imp:" + me + ">" + t] || 0) - st.day);
      h += '<div style="margin-top:6px">';
      if (!atWar) {
        const cw = WO.Dip.canDeclareWar(st, me, t);
        h += btn("Nyatakan perang", "declare", { c: t }, { cls: "danger", disabled: !cw.ok, title: cw.ok ? "" : cw.reason });
        h += btn("Perbaiki hubungan ($" + C.IMPROVE_COST + " M)", "improve", { c: t }, { disabled: cd > 0 || c0(st, me).treasury < C.IMPROVE_COST, title: cd > 0 ? cd + " hari lagi" : "+15 opini" });
        for (const type of ["nap", "trade", "access", "alliance"]) {
          const has = WO.Dip.hasPact(st, type, me, t) && (type !== "access" || st.diplo.pacts.some((p) => p.type === "access" && p.a === t && p.b === me));
          h += btn(WO.Dip.PACT_NAMES[type], "pact", { type, c: t }, { disabled: has, title: has ? "Sudah ada" : "Minta persetujuan negara ini" });
        }
      } else h += btn("Tawarkan damai putih", "whitepeace", { c: t }) + '<div class="note">Rincian damai (aneksasi, transfer wilayah) ada di tab Perang.</div>';
      h += "</div>";
    }
    const mine = WO.Dip.countryPacts(st, me);
    h += "<h3>Pakta kita</h3>";
    if (!mine.length) h += '<p class="sub">Belum ada.</p>';
    for (const p of mine) {
      const other = p.a === me ? p.b : p.a, dir = p.type === "access" ? (p.a === me ? " (kamu memberi izin)" : " (kamu boleh masuk)") : "";
      h += '<div class="row"><div class="grow"><b>' + WO.Dip.PACT_NAMES[p.type] + "</b> — " + cname(other) + dir + '<div class="sub">sejak ' + WO.dateString(p.since) + "</div></div>" + btn("Batalkan", "breakpact", { id: p.id }, { sm: true, cls: "danger" }) + "</div>";
    }
    h += "<h3>Riwayat diplomasi</h3>" + st.diplo.history.slice(-12).reverse().map((x) => '<div class="logline"><time>' + WO.dateString(x.day) + "</time>" + esc(x.text) + "</div>").join("");
    return h;
  };
  const c0 = (st, iso) => st.countries[iso];

  // ================= PERANG =================
  P.war = function (st, ui) {
    const me = st.player; let h = "<h2>Perang</h2>";
    if (me) {
      for (const o of st.peaceOffers.filter((x) => x.to === me)) h += '<div class="warnbox"><b>' + cname(o.from) + "</b> menawarkan damai putih.<br>" + btn("Terima", "acceptoffer", { c: o.from }, { cls: "good", sm: true }) + btn("Tolak", "declineoffer", { c: o.from }, { sm: true }) + "</div>";
      const en = [...st.rt.enemies[me]];
      if (c0(st, me).capitulated) h += '<div class="warnbox">Negaramu kapitulasi. Musuh akan menentukan syarat.</div>';
      if (!en.length) h += '<p class="sub">Kamu sedang damai.</p>';
      for (const e of en) {
        const ec = st.countries[e], ws = WO.War.warScore(st, me, e), wsE = WO.War.warScore(st, e, me), taken = WO.War.controlledProvinces(st, me, e);
        h += "<h3>" + UI.flag(e) + " " + cname(e) + (ec.capitulated ? " — KAPITULASI" : "") + "</h3>";
        h += kv("Skor perang kita", fmt(ws.score * 100) + "/100 (" + taken.length + " provinsi dikuasai)") + kv("Skor perang musuh", fmt(wsE.score * 100) + "/100");
        h += kv("Divisi (kita vs musuh)", WO.Eco.armyCount(st, me) + " vs " + WO.Eco.armyCount(st, e)) + kv("Kelelahan perang (kita/musuh)", fmt(c0(st, me).exhaustion) + "% / " + fmt(ec.exhaustion) + "%");
        if (ec.pressure) h += "<div>Tekanan kapitulasi musuh " + fmt(ec.pressure.pressure) + "/" + C.CAP_PRESSURE + UI.bar(ec.pressure.pressure, 100, ec.pressure.pressure >= C.CAP_PRESSURE ? "bad" : "warn") + "</div>";
        h += "<div style=\"margin-top:6px\"><b>Syarat damai</b> <span class=\"sub\">(skor maks " + fmt(ws.score * 100) + ")</span><br>";
        const tCost = WO.War.termsCost(st, me, e, { transfer: taken, reparations: ui.peaceRep }), aCost = WO.War.termsCost(st, me, e, { annex: true, reparations: ui.peaceRep });
        h += btn("Damai putih", "whitepeace", { c: e }, { title: "Perlu persetujuan musuh bila belum kapitulasi" });
        h += btn("Ambil " + taken.length + " provinsi yang diduduki (" + fmt(tCost.cost * 100) + ")", "settle", { c: e, kind: "transfer" }, { cls: "primary", disabled: !taken.length || tCost.cost > ws.score + 1e-9, title: tCost.cost > ws.score ? "Skor perang kurang" : "" });
        h += btn("Aneksasi penuh (90)", "settle", { c: e, kind: "annex" }, { cls: "danger", disabled: aCost.cost > ws.score + 1e-9, title: "Butuh skor ≥ 90" });
        h += '</div><label class="check" style="cursor:pointer"><i>' + (ui.peaceRep ? "☑" : "☐") + '</i><a href="#" onclick="return false" data-act="togglerep">+ reparasi (50% kas musuh, biaya 15 skor)</a></label>';
        if (!ec.capitulated) h += '<div class="note">Damai putih butuh persetujuan musuh; syarat lain berlaku langsung bila skor perang cukup.</div>';
      }
    }
    // pertempuran aktif hari ini
    const battles = Object.values(st.rt.combats || {});
    h += "<h3>Pertempuran hari ini (" + battles.length + ")</h3>";
    if (!battles.length) h += '<span class="sub">Tidak ada pertempuran.</span>';
    for (const b of battles.slice(0, 12)) {
      h += '<div class="row"><div class="grow"><div class="name"><a href="#" onclick="return false" data-act="selprov" data-p="' + b.pid + '">⚔ ' + pname(b.pid) + "</a>" + (b.captured ? ' <span class="badge bad">direbut</span>' : "") + '</div><div class="sub">' +
        b.attCountries.map(cname).join("/") + " (" + b.att + " div) menyerang " + b.defCountries.map(cname).join("/") + " (" + b.def + " div) • kerugian −" + fmt1(b.aLoss) + "% / −" + fmt1(b.dLoss) + "%</div></div></div>";
    }
    const all = []; const seen = new Set();
    for (const w of st.wars) { const k = w.a + "|" + w.b; if (!seen.has(k)) { seen.add(k); all.push(w); } }
    h += "<h3>Semua perang di dunia (" + all.length + ")</h3>";
    h += all.slice(0, 20).map((w) => '<div class="logline">' + cname(w.a) + " ⚔ " + cname(w.b) + ' <span class="sub">sejak ' + WO.dateString(w.start) + "</span></div>").join("") || '<span class="sub">Dunia damai.</span>';
    return h;
  };

  // ================= LOG =================
  P.log = function (st) {
    let h = "<h2>Log kejadian</h2>";
    h += '<p class="note">AI agresif (negara kuat bisa menyerang tetangga lemah): <b>' + (st.settings.aiAggressive ? "AKTIF" : "mati") + "</b> " + btn("ubah", "settings-ai", {}, { sm: true }) + "</p>";
    const items = st.log.slice(-120).reverse();
    h += items.map((l) => '<div class="logline ' + esc(l.kind) + '"><time>' + WO.dateString(l.day) + "</time>" + esc(l.text) + "</div>").join("");
    return h;
  };

  // ================= MISI (skenario latihan) =================
  const STEPS = [
    ["Pimpin Indonesia", (s) => s.player === "IDN", "Tab Negara → Pimpin negara ini"],
    ["Lihat ibu kota (Jakarta Raya)", (s) => !!s.flags.view_capital, "Klik provinsi Jakarta Raya di Pulau Jawa"],
    ["Pilih provinsi di Pulau Jawa", (s) => !!s.flags.view_java, "Klik provinsi lain di Jawa"],
    ["Bangun pabrik militer", (s) => !!s.flags.build_mil, "Tab Provinsi → Pabrik militer"],
    ["Mulai produksi peralatan", (s) => !!s.flags.production, "Tab Produksi → tombol +"],
    ["Rekrut divisi", (s) => !!s.flags.recruit, "Tab Militer → Rekrut"],
    ["Pindahkan divisi (Jawa → Nusa Tenggara Timur)", (s) => !!s.flags.move, "Pilih divisi, klik kanan NTT. Jalur: darat Jawa + penyeberangan laut domestik"],
    ["Nyatakan perang pada Timor-Leste", (s) => !!s.flags.declare, "Klik Timor-Leste → tab Diplomasi"],
    ["Serang wilayah musuh", (s) => !!s.flags.attack, "Klik kanan provinsi musuh yang bertetangga"],
    ["Duduki provinsi musuh (controller berubah, owner tetap)", (s) => !!s.flags.occupy, "Menangkan pertempuran"],
    ["Duduki ibu kota Dili", (s) => !!s.flags.occupy_capital, "Serang Dili"],
    ["Timor-Leste kapitulasi", (s) => !!s.flags.capitulation, "Tekan terus; kapitulasi butuh beberapa hari tekanan"],
    ["Selesaikan perjanjian damai", (s) => !!s.flags.peace, "Tab Perang → ambil provinsi / aneksasi"],
    ["Simpan permainan", (s) => !!s.flags.saved, "Tombol Simpan, lalu Muat untuk membuktikan hasilnya bertahan"],
  ];
  P.mission = function (st) {
    let done = 0; const rows = STEPS.map(([t, f, hint]) => { const ok = !!f(st); if (ok) done++; return '<div class="check' + (ok ? " done" : "") + '"><i>' + (ok ? "✔" : "○") + "</i><div><span>" + t + '</span><div class="sub">' + hint + "</div></div></div>"; });
    return "<h2>Misi latihan</h2><p class=\"sub\">Indonesia vs Timor-Leste • " + done + "/" + STEPS.length + " selesai</p>" + UI.bar(done, STEPS.length) + rows.join("") +
      '<p class="note">Tips: pasukan awal Indonesia sudah ada. Latih lebih banyak divisi dan kumpulkan di NTT sebelum menyatakan perang.</p>';
  };
})(typeof window !== "undefined" ? window : globalThis);
