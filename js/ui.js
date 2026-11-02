// ===== WORLD ORDER v0.4 — UI: kontrol, seleksi, aksi =====
// UI hanya memanggil API simulasi (WO.Eco, WO.Mil, WO.Dip, WO.War, WO.Cap) lalu menggambar ulang.
// Tidak ada tombol "pajangan": setiap tombol memanggil fungsi yang mengubah state dan melaporkan hasilnya.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, C = WO.C, U = WO.util, MV = WO.MapView;
  const UI = (WO.UI = { panels: {} });

  // ---------- helper tampilan ----------
  UI.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  UI.fmt = (n) => (isFinite(n) ? Math.round(n).toLocaleString("id-ID") : "–");
  UI.fmt1 = (n) => (isFinite(n) ? (Math.round(n * 10) / 10).toLocaleString("id-ID") : "–");
  UI.cname = (iso) => UI.esc(W.countries[iso].name);
  UI.pname = (pid) => UI.esc(W.provinces[pid].name);
  UI.flag = (iso) => '<span class="flag" style="background:' + MV.countryColor(iso) + '">' + iso + "</span>";
  UI.bar = (v, max, cls) => '<div class="bar ' + (cls || "") + '"><i style="width:' + U.clamp((v / (max || 1)) * 100, 0, 100).toFixed(0) + '%"></i></div>';
  UI.kv = (k, v) => '<div class="kv"><span>' + k + "</span><b>" + v + "</b></div>";

  const ui = (UI.s = {
    tab: "country", selProvince: null, viewCountry: null, selDivs: new Set(), orderMode: false, preview: null,
    peaceRep: false, game: null, lastPanelDraw: 0, lastDay: -1, helpShown: false,
  });
  UI.state = () => ui.game && ui.game.state;
  const $ = (id) => document.getElementById(id);

  // ---------- inisialisasi ----------
  UI.init = function (game) {
    ui.game = game;
    UI.buildNav(); UI.hydrateIcons(); UI.initPanelEvents();
    $("win-close").addEventListener("click", () => UI.closeWindow());
    $("tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-tab]"); if (!b || b.disabled) return;
      if (ui.tab === b.dataset.tab && !$("window").hidden) UI.closeWindow(); else UI.setTab(b.dataset.tab);
    });
    $("panel").addEventListener("click", onPanelClick);
    $("mode-buttons").addEventListener("click", (e) => {
      const b = e.target.closest(".mode-btn"); if (!b) return;
      document.querySelectorAll(".mode-btn").forEach((x) => x.classList.toggle("active", x === b));
      $("res-buttons").hidden = b.dataset.mode !== "resources";
      MV.setMode(b.dataset.mode);
    });
    $("res-buttons").addEventListener("click", (e) => {
      const b = e.target.closest(".res-btn"); if (!b) return;
      document.querySelectorAll(".res-btn").forEach((x) => x.classList.toggle("active", x === b));
      MV.setMode("resources", b.dataset.r);
    });
    $("zoom-buttons").addEventListener("click", (e) => { const b = e.target.closest(".zoom-btn"); if (b) MV.zoomPreset(b.dataset.zoom); });
    document.addEventListener("keydown", (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === "Space") { e.preventDefault(); game.togglePause(); }
      else if (e.key === "Escape") {
        if (ui.orderMode || ui.selDivs.size) { ui.orderMode = false; ui.selDivs.clear(); ui.preview = null; UI.updateOrderHint(); UI.refresh(true); }
        else UI.closeWindow();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && UI.KEYS[e.key.toLowerCase()]) { const t = UI.KEYS[e.key.toLowerCase()]; const b = document.querySelector('#tabs [data-tab="' + t + '"]'); if (b && !b.disabled) { if (ui.tab === t && !$("window").hidden) UI.closeWindow(); else UI.setTab(t); } }
    });
    UI.setTab("country", true);
  };

  // hooks yang dipakai peta
  UI.mapHooks = function () {
    return {
      getState: () => UI.state(),
      getSelection: () => ({ divisions: ui.selDivs, preview: ui.preview }),
      getViewCountry: () => ui.viewCountry,
      onProvince(pid) {
        if (ui.orderMode && ui.selDivs.size) return UI.orderTo(pid);
        UI.selectProvince(pid, true);
      },
      onProvinceContext(pid) { if (ui.selDivs.size) UI.orderTo(pid); },
      onCountry(iso) { UI.viewCountrySet(iso); UI.setTab("country"); },
      onUnit(pid, iso) {
        const st = UI.state(); UI.selectProvince(pid, false);
        if (iso === st.player) {
          const ids = WO.State.divisionsIn(st, pid).filter((d) => d.country === iso).map((d) => d.id);
          const all = ids.every((id) => ui.selDivs.has(id));
          if (all) ids.forEach((id) => ui.selDivs.delete(id)); else ids.forEach((id) => ui.selDivs.add(id));
          UI.setTab("military");
        } else UI.setTab("province");
        UI.refresh(true);
      },
      onHover(pid) {
        if (!ui.orderMode || !ui.selDivs.size || !pid) { if (ui.preview) { ui.preview = null; MV.requestOverlay(); } return; }
        const st = UI.state(), d = st.divisions[[...ui.selDivs][0]]; if (!d) return;
        const r = WO.Path.find(st, st.player, d.province, pid, { speed: C.DIV_TYPES[d.type].speed });
        ui.preview = r.ok ? [d.province].concat(r.path) : null; MV.requestOverlay();
      },
    };
  };

  UI.setTab = function (tab, silent) {
    ui.tab = tab;
    const nav = UI.NAV.find((n) => n.tab === tab);
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", !silent && b.dataset.tab === tab));
    const win = $("window");
    if (win) { win.hidden = !!silent; win.classList.toggle("wide", !!(nav && nav.wide)); $("win-title").textContent = nav ? nav.full : tab; }
    UI.drawPanel();
  };
  UI.closeWindow = function () { const w = $("window"); if (w) w.hidden = true; document.querySelectorAll("#tabs button").forEach((b) => b.classList.remove("active")); };

  // ---------- seleksi ----------
  UI.selectProvince = function (pid, switchTab) {
    const st = UI.state(); if (!st) return;
    ui.selProvince = pid;
    const sp = st.provinces[pid];
    ui.viewCountry = sp.owner;
    if (pid === st.countries[sp.owner].capital) WO.flag(st, "view_capital", sp.owner === st.player ? st.player : undefined);
    if (sp.owner === "IDN" && W.provinces[pid].landmass === W.provinces[ui.game.javaProvince].landmass) WO.flag(st, "view_java", st.player);
    MV.setHighlight({ province: pid, country: ui.viewCountry });
    if (switchTab) UI.setTab("province"); else UI.drawPanel();
    UI.updateOrderHint();
  };
  UI.viewCountrySet = function (iso) {
    ui.viewCountry = iso; MV.setHighlight({ province: ui.selProvince, country: iso }); UI.drawPanel();
  };

  UI.updateOrderHint = function () {
    const h = $("order-hint");
    h.hidden = !(ui.orderMode && ui.selDivs.size);
    h.textContent = "Mode perintah: klik provinsi tujuan (Esc = batal)";
  };

  // ---------- umpan balik ----------
  UI.toast = function (msg, kind) {
    const a = $("toast-area"); if (!a) return;
    const t = document.createElement("div"); t.className = "toast " + (kind || ""); t.textContent = msg; a.appendChild(t);
    setTimeout(() => t.remove(), 4200);
    while (a.children.length > 5) a.firstChild.remove();
  };
  UI.report = function (res) { if (!res) return; UI.toast(res.msg || res.reason || "", res.ok ? "good" : "bad"); UI.refresh(true); return res; };
  UI.modal = function (html, buttons) {
    const m = $("modal");
    m.innerHTML = '<div class="modal-box">' + html + '<div class="modal-actions">' +
      (buttons || [{ label: "Tutup" }]).map((b, i) => '<button class="btn ' + (b.cls || "") + '" data-mb="' + i + '">' + b.label + "</button>").join("") + "</div></div>";
    m.hidden = false;
    m.onclick = (e) => {
      const b = e.target.closest("[data-mb]");
      if (!b) return;
      const def = (buttons || [{}])[+b.dataset.mb]; m.hidden = true; m.innerHTML = "";
      if (def.fn) def.fn();
    };
  };

  // ---------- perintah militer ----------
  UI.orderTo = function (pid) {
    const st = UI.state(); if (!st || !st.player) return;
    const ids = [...ui.selDivs].filter((id) => st.divisions[id] && st.divisions[id].country === st.player);
    if (!ids.length) { UI.toast("Pilih divisi dulu (klik penanda unit atau tab Militer).", "warn"); return; }
    const r = WO.Mil.orderMove(st, st.player, ids, pid);
    ui.orderMode = false; ui.preview = null; UI.updateOrderHint();
    UI.report(r);
  };

  // ---------- klik di panel ----------
  function onPanelClick(e) {
    const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    const st = UI.state(); const d = b.dataset; const me = st && st.player;
    switch (d.act) {
      case "lead": if (WO.State.setPlayer(st, d.c)) { ui.game.onPlayerChanged(); UI.toast("Kamu sekarang memimpin " + W.countries[d.c].name + ".", "good"); } break;
      case "selprov": UI.selectProvince(d.p, true); MV.zoomToProvince(d.p, Math.min(MV.getViewBox().w, 80)); return;
      case "selcountry": UI.viewCountrySet(d.c); return;
      case "zoomprov": MV.zoomToProvince(d.p, 60); return;
      case "build": UI.report(WO.Eco.queueBuild(st, me, d.type, d.p)); return;
      case "cancelbuild": UI.report(WO.Eco.cancelBuild(st, me, d.id)); return;
      case "line": {
        const line = st.countries[me].lines.find((l) => l.equip === d.e);
        UI.report(WO.Eco.setProduction(st, me, d.e, (line ? line.factories : 0) + (+d.d))); return;
      }
      case "recruit": UI.report(WO.Mil.recruit(st, me, d.type, d.p)); return;
      case "disband": ui.selDivs.delete(d.id); UI.report(WO.Mil.disband(st, me, d.id)); return;
      case "divsel": if (ui.selDivs.has(d.id)) ui.selDivs.delete(d.id); else ui.selDivs.add(d.id); UI.updateOrderHint(); MV.requestOverlay(); UI.drawPanel(); return;
      case "divall": WO.State.countryDivisions(st, me).forEach((x) => ui.selDivs.add(x.id)); MV.requestOverlay(); UI.drawPanel(); return;
      case "divclear": ui.selDivs.clear(); ui.orderMode = false; UI.updateOrderHint(); MV.requestOverlay(); UI.drawPanel(); return;
      case "ordermode": ui.orderMode = !ui.orderMode; UI.updateOrderHint(); UI.drawPanel(); return;
      case "orderhere": UI.orderTo(d.p); return;
      case "cancelorder": UI.report(WO.Mil.cancelOrder(st, me, [...ui.selDivs])); return;
      case "setcap": UI.report(WO.Cap.relocate(st, me, d.p)); return;
      case "declare": {
        const t = d.c;
        UI.modal("<h2>Nyatakan perang?</h2><p>Menyatakan perang terhadap <b>" + UI.cname(t) + "</b> akan menyeret sekutu kedua pihak, merusak opini, dan menaikkan kelelahan perang.</p>",
          [{ label: "Batal" }, { label: "Nyatakan perang", cls: "danger", fn: () => UI.report(WO.Dip.declareWar(st, me, t)) }]);
        return;
      }
      case "improve": UI.report(WO.Dip.improveRelations(st, me, d.c)); return;
      case "pact": UI.report(WO.Dip.proposePact(st, d.type, me, d.c)); return;
      case "breakpact": UI.report(WO.Dip.breakPact(st, d.id, me)); return;
      case "whitepeace": UI.report(WO.War.offerWhitePeace(st, me, d.c)); return;
      case "togglerep": ui.peaceRep = !ui.peaceRep; UI.drawPanel(); return;
      case "settle": {
        const loser = d.c; let terms = { reparations: ui.peaceRep };
        if (d.kind === "annex") terms.annex = true;
        else if (d.kind === "transfer") terms.transfer = WO.War.controlledProvinces(st, me, loser);
        UI.report(WO.War.settle(st, me, loser, terms)); return;
      }
      case "acceptoffer": UI.report(WO.War.acceptPeaceOffer(st, d.c)); return;
      case "declineoffer": UI.report(WO.War.declinePeaceOffer(st, d.c)); return;
      case "scenario": ui.game.startScenario(); return;
      case "tab": UI.setTab(d.tab); return;
      case "focussel": UI.focusSelect(d.id); return;
      case "focusstart": UI.report(WO.Focus.start(st, me, d.id)); return;
      case "focuscancel": UI.report(WO.Focus.cancel(st, me)); return;
      case "focuszoom": UI.focusZoom(+d.d); return;
      case "mapmode": { const b = document.querySelector('.mode-btn[data-mode="' + d.mode + '"]'); if (b) b.click(); return; }
      case "settings-ai": st.settings.aiAggressive = !st.settings.aiAggressive; UI.toast("AI agresif: " + (st.settings.aiAggressive ? "AKTIF" : "mati"), "warn"); UI.drawPanel(); return;
    }
    UI.refresh(true);
  }

  // ---------- gambar ulang ----------
  UI.drawPanel = function () {
    const st = UI.state(), p = $("panel"); if (!st || !p) return;
    const fn = UI.panels[ui.tab];
    const scroll = p.scrollTop;
    p.innerHTML = fn ? fn(st, ui) : "";
    p.scrollTop = scroll;
    if (UI.afterDraw[ui.tab]) UI.afterDraw[ui.tab](st, ui);
    ui.lastPanelDraw = Date.now();
    $("tab-mission").hidden = !st.flags || st.flags.scenario === undefined;
  };

  UI.updateTop = function () {
    const st = UI.state(); if (!st) return;
    $("date").textContent = WO.dateString(st.day);
    const me = st.player && st.countries[st.player];
    $("top-flag").textContent = me ? st.player : "--";
    $("top-flag").style.background = me ? MV.countryColor(st.player) : "#445";
    $("top-country-name").textContent = me ? W.countries[st.player].name : "Pilih negara di peta";
    $("st-factories").textContent = me ? (me.agg ? me.agg.civ + " / " + me.agg.mil : "–") : "–";
    $("st-divisions").textContent = me ? WO.Eco.armyCount(st, st.player) : "–";
    const ld = $("top-leader");
    if (ld) {
      let t = "";
      if (me && WO.DB.ready) {
        if (WO.DB._leaders[st.player] === undefined) WO.DB.loadLeaders(st.player).then(() => UI.updateTop());
        const r = WO.DB.leadersAt(st.player, WO.DB.isoOfDay(st.day));
        if (r && r.head_of_state && r.head_of_state.person) t = r.head_of_state.tenure.office_title.replace(" of " + W.countries[st.player].name, "") + ": " + r.head_of_state.person.name;
        else if (me) t = WO.DB.hasLeaders(st.player) ? "" : "pemimpin: data belum tersedia";
      }
      ld.textContent = t;
    }
    $("st-treasury").textContent = me ? "$" + UI.fmt1(me.treasury) + " M" : "–";
    $("st-manpower").textContent = me ? UI.fmt(me.manpower / 1000) + " rb" : "–";
    $("st-stability").textContent = me ? UI.fmt(me.stability) + "%" : "–";
    document.querySelectorAll(".stat-chip.res").forEach((chip) => {
      const r = chip.dataset.res, b = chip.querySelector("b");
      if (!me) { b.textContent = "–"; return; }
      b.textContent = UI.fmt(me.res[r]);
      const net = me.lastReport ? me.lastReport.res[r].in - me.lastReport.res[r].out : 0;
      chip.classList.toggle("low", me.res[r] < 20 && net < 0);
      chip.title = C.RES_NAMES[r] + ": " + UI.fmt(me.res[r]) + " (" + (net >= 0 ? "+" : "") + UI.fmt1(net) + "/hari)";
    });
  };

  // dipanggil setelah tick/aksi. force=true menggambar panel sekarang.
  UI.refresh = function (force) {
    const st = UI.state(); if (!st) return;
    const rt = st.rt;
    UI.updateTop();
    // peta
    if (rt.dirty.all) { MV.recolorAll(); rt.dirty.all = false; rt.dirty.provinces.clear(); MV.requestOverlay(); }
    else if (rt.dirty.provinces.size) { for (const pid of rt.dirty.provinces) MV.recolorProvince(pid); rt.dirty.provinces.clear(); MV.recolorLand(); }
    if (MV.mode === "supply" && st.day !== ui.lastDay) MV.recolorAll();
    if (rt.dirty.units || st.day !== ui.lastDay) { rt.dirty.units = false; MV.requestOverlay(); }
    ui.lastDay = st.day;
    // pesan penting
    while (st.pendingMessages.length) UI.handleMessage(st.pendingMessages.shift());
    // panel (dibatasi ~4x/detik kecuali dipaksa)
    const live = ui.tab === "focus" || ui.tab === "database";
    if (force || (rt.dirty.panels && !live && Date.now() - ui.lastPanelDraw > 250)) { rt.dirty.panels = false; UI.drawPanel(); }
    else if (live && rt.dirty.panels) { rt.dirty.panels = false; if (UI.liveUpdate) UI.liveUpdate(st, ui); }
    UI.updateAlerts();
  };

  UI.handleMessage = function (m) {
    const st = UI.state(), me = st.player;
    if (m.kind === "event") { if (ui.game.autoPause) ui.game.pause(); UI.showNewspaper(m.eventId); return; }
    if (m.kind === "focus") { UI.toast(m.text, "good"); return; }
    if (m.kind === "gameover") { ui.game.pause(); UI.modal("<h2>Negara dianeksasi</h2><p>" + UI.esc(m.text) + "</p>"); return; }
    if (m.kind === "capitulation") {
      const mine = m.country === me, enemy = me && WO.Dip.atWar(st, me, m.country);
      if (mine || enemy) {
        if (ui.game.autoPause) ui.game.pause();
        UI.modal("<h2>" + (mine ? "Negaramu kapitulasi!" : UI.cname(m.country) + " kapitulasi!") + "</h2><p>" + UI.esc(m.text) + "</p>" +
          (enemy ? "<p>Buka tab <b>Perang</b> untuk menentukan perjanjian damai (aneksasi, transfer wilayah, atau reparasi).</p>" : "<p>Pasukanmu berhenti bertempur. Musuh akan menentukan syarat damai.</p>"),
          enemy ? [{ label: "Ke tab Perang", cls: "primary", fn: () => UI.setTab("war") }, { label: "Tutup" }] : null);
      } else UI.toast(m.text, "warn");
    } else if (m.kind === "peace-offer" && m.country && me) {
      if (ui.game.autoPause) ui.game.pause();
      UI.toast(m.text + " Lihat tab Perang.", "good"); if (ui.tab === "war") UI.drawPanel();
    }
  };

  // ---------- navigasi HOI4-style (ikon di kolom kiri) ----------
  UI.NAV = [
    { tab: "country", icon: "flag", label: "Politik", full: "Politik & Negara", key: "k" },
    { tab: "focus", icon: "star", label: "Fokus", full: "Fokus Nasional", key: "f", wide: true },
    { tab: "decisions", icon: "scroll", label: "Putusan", full: "Keputusan", na: "Keputusan (decisions)" },
    { tab: "research", icon: "book", label: "Riset", full: "Riset", na: "Riset & teknologi" },
    { sp: true },
    { tab: "build", icon: "crane", label: "Bangun", full: "Konstruksi", key: "c" },
    { tab: "production", icon: "factory", label: "Produksi", full: "Produksi", key: "p" },
    { tab: "logistics", icon: "truck", label: "Logistik", full: "Logistik & Supply", key: "l" },
    { sp: true },
    { tab: "military", icon: "soldier", label: "Pasukan", full: "Rekrutmen & Pasukan", key: "m" },
    { tab: "highcmd", icon: "command", label: "Komando", full: "Komando Tinggi", na: "Grup tentara, garis depan, rencana tempur, template divisi" },
    { tab: "war", icon: "swords", label: "Perang", full: "Perang & Damai", key: "w" },
    { sp: true },
    { tab: "diplomacy", icon: "handshake", label: "Diplomasi", full: "Diplomasi", key: "d" },
    { tab: "trade", icon: "trade", label: "Dagang", full: "Perdagangan", key: "t" },
    { tab: "intel", icon: "eye", label: "Intel", full: "Intelijen", na: "Intelijen & operasi" },
    { sp: true },
    { tab: "economy", icon: "chart", label: "Ekonomi", full: "Ekonomi", key: "e" },
    { tab: "province", icon: "pin", label: "Provinsi", full: "Provinsi", key: "v" },
    { tab: "log", icon: "list", label: "Log", full: "Log Kejadian", key: "g" },
    { tab: "database", icon: "db", label: "Data", full: "Database Sejarah", key: "b", wide: true },
    { tab: "mission", icon: "flagmission", label: "Misi", full: "Misi Latihan", hidden: true },
  ];
  UI.KEYS = {}; UI.NAV.forEach((n) => { if (n.key) UI.KEYS[n.key] = n.tab; });
  UI.buildNav = function () {
    const nav = $("tabs"); nav.textContent = "";
    for (const n of UI.NAV) {
      if (n.sp) { const d = document.createElement("div"); d.className = "sp"; nav.appendChild(d); continue; }
      const b = document.createElement("button");
      b.dataset.tab = n.tab; if (n.tab === "mission") { b.id = "tab-mission"; b.hidden = true; }
      b.innerHTML = WO.Icons.svg(n.icon, 22) + "<span>" + n.label + "</span>";
      b.title = n.na ? n.full + " — BELUM TERSEDIA (" + n.na + "); roadmap v0.5" : n.full + (n.key ? " (" + n.key.toUpperCase() + ")" : "");
      if (n.na) { b.disabled = true; b.classList.add("na"); }
      nav.appendChild(b);
    }
  };
  UI.hydrateIcons = function () { document.querySelectorAll("[data-ic]").forEach((e) => { e.innerHTML = WO.Icons.svg(e.dataset.ic, 16); }); };
  UI.afterDraw = {};

  // ---------- notifikasi (dihitung dari state, bukan hiasan) ----------
  UI.computeAlerts = function (st) {
    const me = st.player && st.countries[st.player]; if (!me || !me.exists) return [];
    const out = [], a = me.agg;
    if (me.eventQueue.length) out.push({ icon: "news", text: "Event menunggu keputusan (" + me.eventQueue.length + ")", tab: "event", urgent: true });
    if (st.peaceOffers.some((o) => o.to === st.player)) out.push({ icon: "dove", text: "Tawaran damai", tab: "war", urgent: true });
    for (const e of st.rt.enemies[st.player]) if (st.countries[e].capitulated) { out.push({ icon: "swords", text: cn(e) + " kapitulasi: tentukan damai", tab: "war", urgent: true }); break; }
    if (WO.DB.treeFor && WO.DB.treeFor(st.player) && !me.focus.current && WO.Focus.tree(st.player).focuses.some((f) => WO.Focus.status(st, st.player, f.id) === "available")) out.push({ icon: "star", text: "Pilih fokus nasional", tab: "focus" });
    if (a && !me.queue.length && a.civ > 0) out.push({ icon: "crane", text: "Antrean konstruksi kosong", tab: "build" });
    if (a && WO.Eco.freeFactories(me) > 0) out.push({ icon: "factory", text: WO.Eco.freeFactories(me) + " pabrik militer menganggur", tab: "production" });
    if (me.treasury < 0) out.push({ icon: "coins", text: "Kas negatif", tab: "economy", urgent: true });
    let low = 0; for (const d of WO.State.countryDivisions(st, st.player)) if (st.day >= d.readyDay && d.supply < 0.5) low++;
    if (low) out.push({ icon: "truck", text: low + " divisi kekurangan supply", tab: "logistics" });
    return out;
  };
  const cn = (iso) => W.countries[iso].name;
  UI.updateAlerts = function () {
    const st = UI.state(), box = $("alerts"); if (!st || !box) return;
    const al = UI.computeAlerts(st), key = JSON.stringify(al.map((x) => x.text));
    if (box._k === key) return; box._k = key;
    box.innerHTML = al.map((x, i) => '<button class="alert-btn' + (x.urgent ? " urgent" : "") + '" data-alert="' + i + '" title="' + UI.esc(x.text) + '">' + WO.Icons.svg(x.icon, 15) + "<span>" + UI.esc(x.text) + "</span></button>").join("");
    box._al = al;
  };
  UI.openAlert = function (i) { const a = $("alerts")._al && $("alerts")._al[i]; if (!a) return; if (a.tab === "event") { const q = UI.state().countries[UI.state().player].eventQueue[0]; if (q) UI.showNewspaper(q.id); } else UI.setTab(a.tab); };

  // ---------- surat kabar event ----------
  UI.showNewspaper = function (eventId) {
    const st = UI.state(), e = WO.Events.get(eventId); if (!e || !st) return;
    const hist = e.classification === "historical", c = st.countries[st.player];
    const tag = hist ? '<span class="np-tag">Peristiwa historis</span>' : '<span class="np-tag">Fiksi gameplay</span>';
    const html = '<div class="newspaper"><div class="np-mast"><h1>Warta Dunia</h1></div><div class="np-meta"><span>' + WO.dateString(st.day) + "</span><span>" + UI.esc(e.title) + "</span><span>" + (e.countries[0] === "*" ? UI.cname(st.player) : e.countries.map(UI.cname).join(", ")) + "</span></div>" +
      '<div class="np-head">' + UI.esc(e.headline || e.title) + "</div>" + tag +
      '<div class="np-flags">' + (e.countries[0] === "*" ? UI.flag(st.player) : e.countries.map(UI.flag).join("")) + "</div>" +
      '<div class="np-body">' + UI.esc(e.body || "") + "</div>" +
      (hist && e.factual_summary ? '<div class="np-fact"><b>Fakta sejarah:</b> ' + UI.esc(e.factual_summary) + '<br><span class="np-note">Status data: ' + e.verification.status + " (" + e.verification.confidence + ") — sumber: " + (e.verification.sources || []).map((s) => UI.esc(WO.DB.sources[s] ? WO.DB.sources[s].publisher : s)).join(", ") + ". Konsekuensi di bawah adalah rancangan gameplay.</span></div>" : '<div class="np-note">Peristiwa ini rekaan permainan, bukan fakta sejarah.</div>') + "</div>";
    const buttons = e.options.map((o) => ({ label: UI.esc(o.label) + "<small>" + o.effects.map((x) => UI.esc(WO.Fx.text(x))).join(" • ") + (o.outcome === "historical" ? " • (hasil historis)" : "") + "</small>", cls: o.outcome === "historical" ? "primary" : "",
      fn: () => { const r = WO.Events.choose(st, st.player, e.id, o.id); UI.toast(r.ok ? e.title + ": " + r.msg : r.msg, r.ok ? "good" : "bad"); UI.refresh(true); const next = c.eventQueue[0]; if (next) setTimeout(() => UI.showNewspaper(next.id), 50); } }));
    UI.modal(html, buttons);
  };

  // dipanggil main.js saat game dimulai/dimuat
  UI.reset = function () {
    ui.selProvince = null; ui.viewCountry = null; ui.selDivs.clear(); ui.orderMode = false; ui.preview = null;
    MV.setHighlight({}); UI.updateOrderHint();
  };
})(typeof window !== "undefined" ? window : globalThis);
