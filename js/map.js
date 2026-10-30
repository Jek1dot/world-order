// ===== WORLD ORDER v0.4 — TAMPILAN PETA (SVG) =====
// Rendering TIDAK mengendalikan state: modul ini hanya membaca state dan memanggil hooks.
// Semua referensi memakai province ID. Geometri dimuat sekali; warna/penanda dihitung dari state.
// Catatan arsitektur: seluruh akses state lewat hooks.getState() -> mudah diganti renderer Canvas/WebGL.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, C = WO.C, U = WO.util;
  const NS = "http://www.w3.org/2000/svg";
  const MV = (WO.MapView = {});

  const LOD_W = 400;                          // provinsi tampil jika lebar viewBox <= angka ini
  const WRAP = [0, 1000];                     // salinan peta untuk world wrapping (x dinormalisasi ke [0,1000))
  const MODES = ["political", "ownership", "control", "infra", "resources", "supply"];
  MV.mode = "political"; MV.resource = "steel"; MV.LOD_W = LOD_W;

  let svg, hooks, defs, landRoot, provRoot, overlay, ocean;
  let vb = { x: 0, y: 0, w: 1000, h: 510 };
  const provEls = new Map();                  // pid -> [elemen utama, elemen salinan kanan]
  const landEls = new Map();                  // iso -> [elemen utama, elemen salinan kanan]
  const jitter = {};                          // pid -> variasi terang
  const patterns = new Map();
  let resMax = {};
  let hlStyle, overlayTimer = 0, lastHover = null;

  const el = (name, attrs) => { const e = document.createElementNS(NS, name); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const px = (lon, lat) => [((lon + 180) * 1000) / 360, ((90 - U.clamp(lat, -85, 85)) * 510) / 180];
  const cxy = (pid) => { const c = W.provinces[pid].center; return px(c[0], c[1]); };
  const cssEsc = (s) => (root.CSS && root.CSS.escape ? root.CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"));

  // ---------- geometri -> path ----------
  function ring(coords, close) {
    let d = "";
    for (let i = 0; i < coords.length; i++) { const p = px(coords[i][0], coords[i][1]); d += (i ? "L" : "M") + p[0].toFixed(2) + "," + p[1].toFixed(2); }
    return close ? d + "Z" : d;
  }
  function geomPath(g) {
    if (!g) return "";
    const c = g.coordinates;
    if (g.type === "Polygon") return c.map((r) => ring(r, true)).join("");
    if (g.type === "MultiPolygon") return c.map((p) => p.map((r) => ring(r, true)).join("")).join("");
    if (g.type === "LineString") return ring(c, false);
    if (g.type === "MultiLineString") return c.map((l) => ring(l, false)).join("");
    return "";
  }

  // ---------- warna ----------
  const countryColor = (iso, lightAdj) => { const c = W.countries[iso]; return "hsl(" + c.hue.toFixed(0) + ",42%," + (c.light + (lightAdj || 0)) + "%)"; };
  MV.countryColor = countryColor;
  const unitColor = (iso) => { const c = W.countries[iso]; return "hsl(" + c.hue.toFixed(0) + ",55%,30%)"; };
  const ramp = (t, h) => "hsl(" + h + "," + Math.round(25 + 45 * t) + "%," + Math.round(11 + 46 * t) + "%)";
  const RES_HUE = { oil: 35, steel: 215, aluminum: 190, coal: 265, food: 100 };

  function getPattern(base, stripe) {
    const key = base + "|" + stripe;
    let p = patterns.get(key);
    if (!p) {
      const id = "occ" + patterns.size;
      const pat = el("pattern", { id, patternUnits: "userSpaceOnUse", width: 8, height: 8, patternTransform: "rotate(45)" });
      const r1 = el("rect", { width: 8, height: 8, fill: countryColor(base) });
      const r2 = el("rect", { width: 4, height: 8, fill: countryColor(stripe, 14) });
      pat.appendChild(r1); pat.appendChild(r2); defs.appendChild(pat);
      p = { id, pat, r1, r2 }; patterns.set(key, p);
      updatePatterns();
    }
    return "url(#" + p.id + ")";
  }
  function updatePatterns() {
    const s = 9 * unitsPerPx();
    for (const p of patterns.values()) { p.pat.setAttribute("width", s); p.pat.setAttribute("height", s); p.r1.setAttribute("width", s); p.r1.setAttribute("height", s); p.r2.setAttribute("width", s / 2); p.r2.setAttribute("height", s); }
  }

  function fillFor(pid, st, mode) {
    const sp = st.provinces[pid], j = jitter[pid];
    switch (mode) {
      case "political": return sp.controller !== sp.owner ? getPattern(sp.owner, sp.controller) : countryColor(sp.owner, j);
      case "ownership": { const orig = W.provinces[pid].country; return sp.owner !== orig ? getPattern(sp.owner, orig) : countryColor(sp.owner, j); }
      case "control": return sp.controller !== sp.owner ? getPattern(sp.controller, sp.owner) : countryColor(sp.controller, j);
      case "infra": return ramp(sp.infra / C.INFRA_MAX, 195);
      case "resources": { const v = W.provinces[pid].res[MV.resource], m = resMax[MV.resource] || 1; return ramp(Math.pow(U.clamp(v / m, 0, 1), 0.55), RES_HUE[MV.resource]); }
      case "supply": {
        const me = st.player; if (!me) return "#243040";
        if (sp.controller !== me) return WO.Dip.atWar(st, me, sp.controller) ? "#4a2020" : "#1d2835";
        const m = st.rt.supply[me], v = m && m.has(pid) ? m.get(pid) : 0, t = U.clamp(v / C.SUPPLY_FULL, 0, 1);
        return "hsl(" + Math.round(t * 120) + ",55%," + Math.round(24 + t * 10) + "%)";
      }
    }
    return "#333";
  }

  MV.recolorProvince = function (pid) {
    const st = hooks.getState(), els = provEls.get(pid); if (!st || !els) return;
    const f = fillFor(pid, st, MV.mode), sp = st.provinces[pid];
    for (const e of els) { e.setAttribute("fill", f); e.dataset.o = sp.owner; e.dataset.k = sp.controller; }
  };
  MV.recolorAll = function () {
    const st = hooks.getState(); if (!st) return;
    for (const pid of provEls.keys()) MV.recolorProvince(pid);
    MV.recolorLand(); MV.updateLegend();
  };
  // warna negara (lapisan zoom-out) mengikuti pemilik mayoritas provinsinya
  MV.recolorLand = function () {
    const st = hooks.getState(); if (!st) return;
    for (const [iso, els] of landEls) {
      const cnt = {}; let best = iso, bv = -1;
      for (const pid of W.countries[iso].provinces) { const o = st.provinces[pid].owner; cnt[o] = (cnt[o] || 0) + 1; if (cnt[o] > bv) { bv = cnt[o]; best = o; } }
      const f = MV.mode === "control" ? countryColor(best) : countryColor(best);
      for (const e of els) e.setAttribute("fill", f);
    }
  };
  MV.setMode = function (mode, resource) {
    if (MODES.indexOf(mode) === -1) return;
    MV.mode = mode; if (resource) MV.resource = resource;
    MV.recolorAll();
  };
  MV.updateLegend = function () {
    const box = document.getElementById("map-legend"); if (!box) return;
    const g = (a, b, la, lb) => '<div class="lg-bar" style="background:linear-gradient(90deg,' + a + ',' + b + ')"></div><div style="display:flex;justify-content:space-between"><span>' + la + "</span><span>" + lb + "</span></div>";
    const m = MV.mode;
    if (m === "infra") box.innerHTML = "<b>Infrastruktur</b>" + g(ramp(0, 195), ramp(1, 195), "0", "5");
    else if (m === "resources") box.innerHTML = "<b>" + C.RES_NAMES[MV.resource] + "</b> (sintetis)" + g(ramp(0, RES_HUE[MV.resource]), ramp(1, RES_HUE[MV.resource]), "rendah", "tinggi");
    else if (m === "supply") box.innerHTML = "<b>Supply negaramu</b>" + g("hsl(0,55%,24%)", "hsl(120,55%,34%)", "0%", "100%") + '<span style="color:#e08a84">merah gelap = wilayah musuh</span>';
    else if (m === "control") box.innerHTML = "<b>Kontrol militer</b><br>Warna dasar = penguasa; garis = pemilik asli";
    else if (m === "ownership") box.innerHTML = "<b>Kepemilikan</b><br>Warna dasar = pemilik; garis = bekas pemilik";
    else box.innerHTML = "<b>Politik</b><br>Warna = pemilik; garis = diduduki negara lain";
  };

  // ---------- kamera ----------
  function aspect() { const r = svg.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r.height / r.width : 0.51; }
  function unitsPerPx() { const r = svg.getBoundingClientRect(); return r.width > 0 ? vb.w / r.width : vb.w / 1000; }
  MV.unitsPerPx = unitsPerPx;
  MV.getViewBox = () => ({ x: vb.x, y: vb.y, w: vb.w, h: vb.h });
  function applyVB() {
    vb.w = U.clamp(vb.w, 5, 1000); vb.h = vb.w * aspect();
    vb.x = ((vb.x % 1000) + 1000) % 1000;
    vb.y = vb.h >= 510 ? (510 - vb.h) / 2 : U.clamp(vb.y, 0, 510 - vb.h);
    svg.setAttribute("viewBox", vb.x.toFixed(3) + " " + vb.y.toFixed(3) + " " + vb.w.toFixed(3) + " " + vb.h.toFixed(3));
    onView();
  }
  MV.zoomTo = function (lon, lat, width) {
    const p = px(lon, lat); vb.w = width; vb.h = width * aspect(); vb.x = p[0] - vb.w / 2; vb.y = p[1] - vb.h / 2; applyVB();
  };
  MV.zoomPreset = function (name) {
    if (name === "world") MV.zoomTo(0, 5, 1000);
    else if (name === "indonesia") MV.zoomTo(118, -2, 190);
    else if (name === "java") MV.zoomTo(110.5, -7.3, 48);
  };
  MV.zoomToProvince = function (pid, width) { const c = W.provinces[pid].center; MV.zoomTo(c[0], c[1], width || 60); };

  function clientToSvg(cx, cy) {
    const r = svg.getBoundingClientRect(); const sc = Math.min(r.width / vb.w, r.height / vb.h) || 1;
    return [vb.x + (cx - r.left) / sc, vb.y + (cy - r.top) / sc];
  }
  function onView() {
    const lod = vb.w <= LOD_W;
    provRoot.style.display = lod ? "" : "none";
    landRoot.style.display = lod ? "none" : "";
    // salinan kanan (world wrapping) hanya digambar bila kamera melewati x=1000
    const needRight = vb.x + vb.w > 1000 ? "" : "none";
    if (provRoot.children[1]) provRoot.children[1].style.display = needRight;
    if (landRoot.children[1]) landRoot.children[1].style.display = needRight;
    updatePatterns();
    MV.requestOverlay();
  }

  function setupCamera() {
    let down = null, moved = false;
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 0.85 : 1 / 0.85;
      const p = clientToSvg(e.clientX, e.clientY), nw = U.clamp(vb.w * f, 5, 1000), s = nw / vb.w;
      vb.x = p[0] - (p[0] - vb.x) * s; vb.y = p[1] - (p[1] - vb.y) * s; vb.w = nw; applyVB();
    }, { passive: false });
    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      down = { cx: e.clientX, cy: e.clientY, vb: { x: vb.x, y: vb.y }, id: e.pointerId }; moved = false;
    });
    svg.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - down.cx, dy = e.clientY - down.cy;
      if (!moved) {
        if (Math.hypot(dx, dy) < 5) return;          // klik biasa tetap sampai ke provinsi/unit
        moved = true; try { svg.setPointerCapture(down.id); } catch (err) {}
        svg.style.cursor = "grabbing"; hooks.onDragStart && hooks.onDragStart();
      }
      const r = svg.getBoundingClientRect(), sc = Math.min(r.width / vb.w, r.height / vb.h) || 1;
      vb.x = down.vb.x - dx / sc; vb.y = down.vb.y - dy / sc; applyVB();
    });
    const end = () => { down = null; svg.style.cursor = "grab"; };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end); svg.addEventListener("lostpointercapture", end);
    window.addEventListener && window.addEventListener("resize", () => applyVB());
  }

  // ---------- membangun DOM dari geometri ----------
  MV.init = function (svgEl, h) {
    svg = svgEl; hooks = h;
    svg.textContent = "";
    defs = el("defs");
    const arrow = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse" });
    arrow.appendChild(el("path", { d: "M0,0L10,5L0,10z", fill: "#ff5a4d" })); defs.appendChild(arrow);
    svg.appendChild(defs);
    ocean = el("rect", { x: -1500, y: -300, width: 4000, height: 1100, class: "ocean" }); svg.appendChild(ocean);
    landRoot = el("g", { id: "land-root" }); provRoot = el("g", { id: "province-root" }); overlay = el("g", { id: "overlay-root" });
    svg.appendChild(landRoot); svg.appendChild(provRoot); svg.appendChild(overlay);
    hlStyle = document.createElement("style"); hlStyle.id = "highlight-style"; document.head.appendChild(hlStyle);
    setupCamera(); setupEvents();
  };

  MV.build = function (provGeo, bordersGeo, countriesGeo) {
    // negara (lapisan zoom-out)
    const mainLand = el("g");
    for (const f of countriesGeo.features) {
      if (!f.geometry || !W.countries[f.properties.id]) continue;
      const p = el("path", { d: geomPath(f.geometry), class: "land", "fill-rule": "evenodd" });
      p.dataset.c = f.properties.id; mainLand.appendChild(p);
    }
    const rightLand = mainLand.cloneNode(true); rightLand.setAttribute("transform", "translate(1000,0)");
    landRoot.appendChild(mainLand); landRoot.appendChild(rightLand);
    const a = mainLand.children, b = rightLand.children;
    for (let i = 0; i < a.length; i++) landEls.set(a[i].dataset.c, [a[i], b[i]]);

    // provinsi
    const mainProv = el("g"), ids = [];
    const feats = provGeo.features.filter((f) => f.geometry && W.provinces[f.properties.id]);
    const allRes = { oil: [], steel: [], aluminum: [], coal: [], food: [] };
    for (const f of feats) {
      const id = f.properties.id;
      const p = el("path", { d: geomPath(f.geometry), class: "province", "fill-rule": "evenodd" });
      p.dataset.id = id; mainProv.appendChild(p); ids.push(id);
      jitter[id] = Math.round(U.hash01(id + "#j") * 6 - 3);
      for (const r of C.RESOURCES) allRes[r].push(W.provinces[id].res[r]);
    }
    for (const r of C.RESOURCES) { const s = allRes[r].sort((x, y) => x - y); resMax[r] = s[Math.floor(s.length * 0.95)] || 1; }
    if (bordersGeo && bordersGeo.features) {
      const bp = el("path", { class: "country-borders", d: bordersGeo.features.map((f) => geomPath(f.geometry)).join("") });
      mainProv.appendChild(bp);
    }
    const rightProv = mainProv.cloneNode(true); rightProv.setAttribute("transform", "translate(1000,0)");
    provRoot.appendChild(mainProv); provRoot.appendChild(rightProv);
    const pa = mainProv.children, pb = rightProv.children;
    for (let i = 0; i < ids.length; i++) provEls.set(ids[i], [pa[i], pb[i]]);
    applyVB();
  };

  // ---------- event ----------
  function setupEvents() {
    svg.addEventListener("click", (e) => {
      const u = e.target.closest && e.target.closest(".unit");
      if (u) { hooks.onUnit && hooks.onUnit(u.dataset.pid, u.dataset.c, e); return; }
      const p = e.target.closest && e.target.closest(".province");
      if (p) { hooks.onProvince && hooks.onProvince(p.dataset.id, e); return; }
      const l = e.target.closest && e.target.closest(".land");
      if (l) hooks.onCountry && hooks.onCountry(l.dataset.c, e);
    });
    svg.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const p = e.target.closest && e.target.closest(".province");
      if (p && hooks.onProvinceContext) hooks.onProvinceContext(p.dataset.id, e);
    });
    const tip = () => document.getElementById("map-tooltip");
    svg.addEventListener("pointermove", (e) => {
      const t = tip(); if (!t) return;
      const p = e.target.closest && e.target.closest(".province"), l = e.target.closest && e.target.closest(".land");
      const st = hooks.getState();
      let text = null, pid = null;
      if (p && st) {
        pid = p.dataset.id; const sp = st.provinces[pid], wp = W.provinces[pid];
        text = wp.name + " — " + W.countries[sp.owner].name;
        if (sp.controller !== sp.owner) text += "\nDiduduki: " + W.countries[sp.controller].name;
        const ds = WO.State.divisionsIn(st, pid); if (ds.length) text += "\n" + ds.length + " divisi";
      } else if (l) text = W.countries[l.dataset.c].name;
      if (pid !== lastHover) { lastHover = pid; hooks.onHover && hooks.onHover(pid); }
      if (!text) { t.style.display = "none"; return; }
      const box = svg.parentElement.getBoundingClientRect();
      t.textContent = text; t.style.left = e.clientX - box.left + 14 + "px"; t.style.top = e.clientY - box.top + 14 + "px"; t.style.display = "block";
    });
    svg.addEventListener("pointerleave", () => { const t = tip(); if (t) t.style.display = "none"; lastHover = null; hooks.onHover && hooks.onHover(null); });
  }

  // ---------- sorotan seleksi ----------
  MV.setHighlight = function (sel) {
    const r = [];
    if (sel.country) r.push('.province[data-o="' + cssEsc(sel.country) + '"]{stroke:#fde68a;}');
    if (sel.province) r.push('.province[data-id="' + cssEsc(sel.province) + '"]{stroke:#fff;stroke-width:2.4;fill-opacity:1;}');
    hlStyle.textContent = r.join("\n");
  };

  // ---------- overlay: ibu kota, unit, jalur, serangan, pertempuran ----------
  MV.requestOverlay = function () {
    if (overlayTimer) return;
    overlayTimer = setTimeout(() => { overlayTimer = 0; MV.refreshOverlay(); }, 80);
  };

  function eachWrap(x, y, k, fn) {
    for (const o of WRAP) { const X = x + o, m = 40 * k; if (X >= vb.x - m && X <= vb.x + vb.w + m && y >= vb.y - m && y <= vb.y + vb.h + m) fn(X, y); }
  }
  function polyline(pidList, cls) {
    const pts = []; let prev = null;
    for (const pid of pidList) {
      let [x, y] = cxy(pid);
      if (prev !== null) { while (x - prev > 500) x -= 1000; while (prev - x > 500) x += 1000; }
      pts.push([x, y]); prev = x;
    }
    return pts;
  }

  MV.refreshOverlay = function () {
    if (!overlay) return;
    const st = hooks.getState();
    overlay.textContent = "";
    if (!st) return;
    const sel = hooks.getSelection ? hooks.getSelection() : { divisions: new Set() };
    const k = unitsPerPx(), lod = vb.w <= LOD_W, me = st.player;
    const frag = document.createDocumentFragment();

    // jalur perintah divisi terpilih
    let drawn = 0;
    for (const id of sel.divisions) {
      const d = st.divisions[id]; if (!d || !d.order || drawn++ >= 40) continue;
      const pts = polyline([d.province].concat(d.order.path.slice(d.order.idx)));
      for (const o of WRAP) frag.appendChild(el("polyline", { class: "path-line", points: pts.map((p) => (p[0] + o).toFixed(2) + "," + p[1].toFixed(2)).join(" ") }));
    }
    if (sel.preview && sel.preview.length > 1) {
      const pts = polyline(sel.preview);
      for (const o of WRAP) frag.appendChild(el("polyline", { class: "path-preview", points: pts.map((p) => (p[0] + o).toFixed(2) + "," + p[1].toFixed(2)).join(" ") }));
    }

    // panah serangan
    let arrows = 0;
    for (const d of Object.values(st.divisions)) {
      if (!d.attacking || arrows >= 150) continue;
      if (!lod && d.country !== me && !(me && WO.Dip.atWar(st, me, d.country))) continue;
      const a = cxy(d.province), b = cxy(d.attacking);
      let bx = b[0]; while (bx - a[0] > 500) bx -= 1000; while (a[0] - bx > 500) bx += 1000;
      const mx = a[0] + (bx - a[0]) * 0.85, my = a[1] + (b[1] - a[1]) * 0.85;
      eachWrap(a[0], a[1], k, (X, Y) => { arrows++; frag.appendChild(el("line", { class: "attack-line", x1: X, y1: Y, x2: X + (mx - a[0]), y2: Y + (my - a[1]) })); });
    }

    // ibu kota (bintang)
    const showCap = (iso) => {
      const c = st.countries[iso]; if (!c.exists) return;
      const ll = c.capital === W.countries[iso].capital ? W.countries[iso].capitalLL : null;
      const [x, y] = ll ? px(ll[0], ll[1]) : cxy(c.capital);
      const lost = st.provinces[c.capital].controller !== iso;
      eachWrap(x, y, k, (X, Y) => {
        const g = el("g", { transform: "translate(" + X + "," + Y + ") scale(" + k + ")" });
        g.appendChild(el("path", { d: "M0,-8 L2.4,-2.6 L8,-2.2 L3.7,1.6 L5,7 L0,4 L-5,7 L-3.7,1.6 L-8,-2.2 L-2.4,-2.6Z", fill: lost ? "#ff6a5e" : "#ffd24a", stroke: "#000", "stroke-width": 1 }));
        frag.appendChild(g);
      });
    };
    if (lod) { for (const iso of W.countryIds) { const p = W.provinces[st.countries[iso].capital].center, pp = px(p[0], p[1]); let ok = false; eachWrap(pp[0], pp[1], k * 4, () => (ok = true)); if (ok) showCap(iso); } }
    else if (me) showCap(me);
    if (hooks.getViewCountry) { const vc = hooks.getViewCountry(); if (vc && vc !== me && !lod) showCap(vc); }

    // penanda unit
    let nCounters = 0;
    for (const pid in st.rt.divsByProv) {
      if (nCounters > 500) break;
      const [x, y] = cxy(pid);
      let visible = false; eachWrap(x, y, k, () => (visible = true)); if (!visible) continue;
      const by = {};
      for (const id of st.rt.divsByProv[pid]) { const d = st.divisions[id]; (by[d.country] = by[d.country] || []).push(d); }
      let row = 0;
      for (const iso in by) {
        if (!lod && iso !== me && !(me && (WO.Dip.atWar(st, me, iso) || WO.Dip.isAllied(st, me, iso)))) continue;
        const list = by[iso]; let avg = 0, selected = false;
        for (const d of list) { avg += d.str; if (sel.divisions.has(d.id)) selected = true; }
        avg /= list.length;
        const fighting = !!st.rt.combats[pid];
        eachWrap(x, y, k, (X, Y) => {
          nCounters++;
          const g = el("g", { class: "unit", transform: "translate(" + X + "," + (Y + row * 15 * k) + ") scale(" + k + ")" });
          g.dataset.pid = pid; g.dataset.c = iso;
          g.appendChild(el("rect", { x: -12, y: -7, width: 24, height: 14, rx: 3, fill: unitColor(iso), stroke: selected ? "#ffe07a" : fighting ? "#ff5a4d" : "rgba(255,255,255,.7)", "stroke-width": selected || fighting ? 2.2 : 1 }));
          const t = el("text", { x: 0, y: 4, "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: "#fff" }); t.textContent = list.length; g.appendChild(t);
          g.appendChild(el("rect", { x: -12, y: 8, width: 24 * avg / 100, height: 2, fill: avg > 60 ? "#59c186" : avg > 30 ? "#e8a43c" : "#e0584f" }));
          frag.appendChild(g);
        });
        row++;
      }
    }
    // indikator pertempuran
    for (const pid in st.rt.combats) {
      const [x, y] = cxy(pid);
      eachWrap(x, y, k, (X, Y) => {
        const g = el("g", { class: "combat-dot", transform: "translate(" + (X + 14 * k) + "," + (Y - 12 * k) + ") scale(" + k + ")" });
        g.appendChild(el("circle", { r: 7, fill: "#c62d22", stroke: "#fff", "stroke-width": 1 }));
        const t = el("text", { x: 0, y: 4, "text-anchor": "middle", "font-size": 10, fill: "#fff" }); t.textContent = "⚔"; g.appendChild(t);
        frag.appendChild(g);
      });
    }
    overlay.appendChild(frag);
  };

  MV.provinceEls = provEls;
})(typeof window !== "undefined" ? window : globalThis);
