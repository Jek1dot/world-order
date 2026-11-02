// ===== WORLD ORDER — EVENT & SURAT KABAR =====
// Event dipicu tanggal (fire_on_date), atau acak berbasis MTTH (mean time to happen) dengan kondisi.
// Event 'historical' hanya aktif pada campaign yang dimulai sebelum tanggalnya (campaign 1991/2001 belum tersedia).
// Pemain memilih opsi; AI memilih opsi berbobot tertinggi. Efek konsekuensi = rancangan gameplay.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, U = WO.util;
  const Ev = (WO.Events = {});

  Ev.list = () => WO.DB._events || [];
  Ev.get = (id) => Ev.list().find((e) => e.id === id) || null;
  Ev.firedKey = (id, iso) => id + "|" + iso;

  Ev.eligible = function (state, iso, e, date) {
    const c = state.countries[iso]; if (!c.exists || c.capitulated) return false;
    if (e.countries.indexOf("*") === -1 && e.countries.indexOf(iso) === -1) return false;
    const t = e.trigger;
    if (t.once_per_country && state.events.fired[Ev.firedKey(e.id, iso)] !== undefined) return false;
    if (c.eventQueue.some((q) => q.id === e.id)) return false;
    if (t.not_before && date < t.not_before) return false;
    if (t.not_after && date > t.not_after) return false;
    return WO.Fx.condAll(state, iso, t.conditions);
  };

  Ev.trigger = function (state, iso, e) {
    const c = state.countries[iso];
    if (iso === state.player) {
      c.eventQueue.push({ id: e.id, day: state.day });
      state.pendingMessages.push({ day: state.day, kind: "event", country: iso, eventId: e.id, text: e.headline || e.title });
      state.events.fired[Ev.firedKey(e.id, iso)] = state.day;
    } else {
      const opt = e.options.slice().sort((a, b) => (b.ai_weight || 0) - (a.ai_weight || 0))[0];
      state.events.fired[Ev.firedKey(e.id, iso)] = state.day;
      WO.Fx.applyAll(state, iso, opt.effects, { permanent: false });
    }
  };

  Ev.choose = function (state, iso, eventId, optionId) {
    const c = state.countries[iso], e = Ev.get(eventId), qi = c.eventQueue.findIndex((q) => q.id === eventId);
    if (!e || qi < 0) return { ok: false, msg: "Event tidak menunggu keputusan." };
    const opt = e.options.find((o) => o.id === optionId); if (!opt) return { ok: false, msg: "Opsi tidak ada." };
    c.eventQueue.splice(qi, 1);
    const notes = WO.Fx.applyAll(state, iso, opt.effects, { permanent: false });
    WO.log(state, e.title + " — " + opt.label + (notes.length ? " (" + notes.join(", ") + ")" : ""), "event", iso);
    state.rt.dirty.panels = true; state.rt.dirty.all = true; WO.flag(state, "event_choice", iso);
    return { ok: true, msg: opt.label, effects: opt.effects.map(WO.Fx.text) };
  };

  // dipanggil tiap hari. Pemain dievaluasi tiap hari; AI tiap 7 hari (hemat komputasi).
  Ev.tick = function (state) {
    if (!WO.DB._events) return;
    const date = WO.DB.isoOfDay(state.day), prev = WO.DB.isoOfDay(state.day - 1);
    for (const e of WO.DB._events) {
      const t = e.trigger;
      if (t.fire_on_date) {                                            // peristiwa bertanggal
        if (!(prev < t.fire_on_date && t.fire_on_date <= date)) continue;
        const who = e.countries.indexOf("*") !== -1 ? W.countryIds : e.countries;
        for (const iso of who) if ((t.scope === "all" || iso === state.player) && state.countries[iso] && Ev.eligible(state, iso, e, date)) Ev.trigger(state, iso, e);
        continue;
      }
      const win = 1, p1 = 1 - Math.pow(0.5, win / t.mtth_days), p7 = 1 - Math.pow(0.5, 7 / t.mtth_days);
      if (state.player && state.countries[state.player].exists && Ev.eligible(state, state.player, e, date) && WO.rand(state) < p1) Ev.trigger(state, state.player, e);
      if (t.scope === "all" && state.day % 7 === 0) {
        for (const iso of W.countryIds) { if (iso === state.player) continue; const c = state.countries[iso]; if (!c.exists || (state.day / 7 + c.ai.next) % 3 !== 0) continue; if (Ev.eligible(state, iso, e, date) && WO.rand(state) < p7 * 3) Ev.trigger(state, iso, e); }
      }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
