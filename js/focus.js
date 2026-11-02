// ===== WORLD ORDER — NATIONAL FOCUS =====
// Mekanik terinspirasi HOI4 (satu fokus aktif, durasi hari, prasyarat, saling-eksklusif) — implementasi & konten orisinal.
// Data pohon: data/db/focus/*.json (divalidasi). Efek benar-benar mengubah ekonomi/militer/diplomasi lewat WO.Fx.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World;
  const Focus = (WO.Focus = {});

  const byId = (tree) => (tree._idx = tree._idx || Object.fromEntries(tree.focuses.map((f) => [f.id, f])));
  Focus.tree = (iso) => WO.DB.treeFor(iso);
  Focus.get = (iso, id) => { const t = Focus.tree(iso); return t ? byId(t)[id] : null; };

  // 'done' | 'current' | 'available' | 'locked' (prasyarat/kondisi belum) | 'excluded' (cabang eksklusif sudah diambil)
  Focus.status = function (state, iso, id) {
    const c = state.countries[iso], f = Focus.get(iso, id); if (!f) return null;
    if (c.focus.done.indexOf(id) !== -1) return "done";
    if (c.focus.current && c.focus.current.id === id) return "current";
    if ((f.exclusive || []).some((x) => c.focus.done.indexOf(x) !== -1 || (c.focus.current && c.focus.current.id === x))) return "excluded";
    if (!Focus.prereqOk(c, f)) return "locked";
    if (!WO.Fx.condAll(state, iso, f.available)) return "locked";
    return "available";
  };
  Focus.prereqOk = (c, f) => (f.prerequisites || []).every((p) => c.focus.done.indexOf(p) !== -1) && (f.any_of || []).every((g) => g.some((p) => c.focus.done.indexOf(p) !== -1));

  Focus.canStart = function (state, iso, id) {
    const c = state.countries[iso], f = Focus.get(iso, id);
    if (!c || !c.exists) return { ok: false, reason: "Negara tidak valid." };
    if (!f) return { ok: false, reason: "Fokus tidak ada." };
    if (c.capitulated) return { ok: false, reason: "Negara sedang kapitulasi." };
    if (c.focus.current) return { ok: false, reason: "Masih mengerjakan fokus lain." };
    const s = Focus.status(state, iso, id);
    if (s === "done") return { ok: false, reason: "Sudah selesai." };
    if (s === "excluded") return { ok: false, reason: "Bertentangan dengan fokus yang sudah diambil." };
    if (!Focus.prereqOk(c, f)) return { ok: false, reason: "Prasyarat belum terpenuhi." };
    if (!WO.Fx.condAll(state, iso, f.available)) return { ok: false, reason: "Syarat: " + f.available.filter((cd) => !WO.Fx.cond(state, iso, cd)).map(WO.Fx.condText).join(", ") + "." };
    return { ok: true };
  };
  Focus.start = function (state, iso, id) {
    const chk = Focus.canStart(state, iso, id);
    if (!chk.ok) return { ok: false, msg: chk.reason };
    const f = Focus.get(iso, id);
    state.countries[iso].focus.current = { id, left: f.days, total: f.days };
    state.rt.dirty.panels = true; WO.flag(state, "focus_start", iso);
    return { ok: true, msg: "Fokus dimulai: " + f.title + " (" + f.days + " hari)." };
  };
  Focus.cancel = function (state, iso) {
    const c = state.countries[iso]; if (!c.focus.current) return { ok: false, msg: "Tidak ada fokus aktif." };
    c.focus.current = null; state.rt.dirty.panels = true; return { ok: true, msg: "Fokus dibatalkan (progres hilang)." };
  };

  Focus.complete = function (state, iso) {
    const c = state.countries[iso], cur = c.focus.current, f = Focus.get(iso, cur.id);
    c.focus.done.push(cur.id); c.focus.current = null;
    const notes = WO.Fx.applyAll(state, iso, f.effects, { permanent: true });
    WO.log(state, W.countries[iso].name + " menyelesaikan fokus: " + f.title + (notes.length ? " (" + notes.join(", ") + ")" : "") + ".", "focus", iso);
    WO.flag(state, "focus_done", iso);
    if (iso === state.player) state.pendingMessages.push({ day: state.day, kind: "focus", country: iso, text: "Fokus selesai: " + f.title });
  };

  Focus.tick = function (state) {
    for (const iso of W.countryIds) {
      const c = state.countries[iso]; if (!c.exists || !c.focus.current) continue;
      if (c.capitulated) continue;                                    // fokus terhenti saat kapitulasi
      if (--c.focus.current.left <= 0) Focus.complete(state, iso);
    }
    state.rt.dirty.focus = true;
  };

  // AI: pilih fokus yang tersedia dengan bobot tertinggi (deterministik; tanpa acak)
  Focus.aiPick = function (state, iso) {
    const c = state.countries[iso], t = Focus.tree(iso); if (!t || c.focus.current || c.capitulated) return false;
    let best = null, bw = -1;
    for (const f of t.focuses) {
      if (Focus.status(state, iso, f.id) !== "available") continue;
      const w = (f.ai_weight || 1) - f.days / 100; if (w > bw) { bw = w; best = f; }
    }
    return best ? Focus.start(state, iso, best.id).ok : false;
  };

  // untuk UI: rantai prasyarat (leluhur) dan turunan
  Focus.relations = function (iso, id) {
    const t = Focus.tree(iso), idx = byId(t), anc = new Set(), des = new Set();
    const up = (x) => { const f = idx[x]; for (const p of (f.prerequisites || []).concat(...(f.any_of || []))) if (!anc.has(p)) { anc.add(p); up(p); } };
    const down = (x) => { for (const f of t.focuses) if ((f.prerequisites || []).concat(...(f.any_of || [])).indexOf(x) !== -1 && !des.has(f.id)) { des.add(f.id); down(f.id); } };
    up(id); down(id); return { anc, des };
  };
})(typeof window !== "undefined" ? window : globalThis);
