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
    $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-tab]"); if (b) UI.setTab(b.dataset.tab); });
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
      else if (e.key === "Escape") { ui.orderMode = false; ui.selDivs.clear(); ui.preview = null; UI.updateOrderHint(); UI.refresh(true); }
    });
    UI.setTab("country");
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

  UI.setTab = function (tab) {
    ui.tab = tab;
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    UI.drawPanel();
  };

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
    if (force || (rt.dirty.panels && Date.now() - ui.lastPanelDraw > 250)) { rt.dirty.panels = false; UI.drawPanel(); }
  };

  UI.handleMessage = function (m) {
    const st = UI.state(), me = st.player;
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

  // dipanggil main.js saat game dimulai/dimuat
  UI.reset = function () {
    ui.selProvince = null; ui.viewCountry = null; ui.selDivs.clear(); ui.orderMode = false; ui.preview = null;
    MV.setHighlight({}); UI.updateOrderHint();
  };
})(typeof window !== "undefined" ? window : globalThis);
