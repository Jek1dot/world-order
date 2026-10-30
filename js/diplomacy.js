// ===== WORLD ORDER v0.4 — DIPLOMASI & STATUS PERANG =====
// Perang disimpan berpasangan (hostilitas A-B), sehingga damai bisa dibuat per pasangan negara.
(function (root) {
  "use strict";
  const WO = root.WO, U = WO.util, C = WO.C;
  const Dip = (WO.Dip = {});
  const PACT_NAMES = { nap: "Pakta non-agresi", alliance: "Aliansi", access: "Akses militer", trade: "Perjanjian dagang" };
  Dip.PACT_NAMES = PACT_NAMES;

  // ---------- indeks cepat (runtime) ----------
  Dip.rebuildIndex = function (state) {
    const rt = state.rt;
    rt.warSet = new Set(); rt.enemies = {}; rt.allies = {}; rt.accessTo = {}; rt.pactSet = new Set();
    const W = WO.World;
    for (const iso of W.countryIds) { rt.enemies[iso] = new Set(); rt.allies[iso] = new Set(); rt.accessTo[iso] = new Set(); }
    for (const w of state.wars) { rt.warSet.add(U.pairKey(w.a, w.b)); rt.enemies[w.a].add(w.b); rt.enemies[w.b].add(w.a); }
    for (const p of state.diplo.pacts) {
      rt.pactSet.add(p.type + ":" + U.pairKey(p.a, p.b));
      if (p.type === "alliance") { rt.allies[p.a].add(p.b); rt.allies[p.b].add(p.a); }
      if (p.type === "access") rt.accessTo[p.b].add(p.a);      // a memberi izin, b boleh masuk wilayah a
    }
  };
  Dip.atWar = (state, a, b) => a !== b && state.rt.warSet.has(U.pairKey(a, b));
  Dip.isAllied = (state, a, b) => state.rt.allies[a].has(b);
  Dip.hasPact = (state, type, a, b) => state.rt.pactSet.has(type + ":" + U.pairKey(a, b));
  Dip.isFriendly = (state, mover, controller) =>
    mover === controller || state.rt.allies[mover].has(controller) || state.rt.accessTo[mover].has(controller);
  Dip.enemiesOf = (state, iso) => state.rt.enemies[iso];
  Dip.isAtWarWithAnyone = (state, iso) => state.rt.enemies[iso].size > 0;

  Dip.history = function (state, text) {
    state.diplo.history.push({ day: state.day, text });
    if (state.diplo.history.length > 200) state.diplo.history.shift();
  };

  // ---------- opini ----------
  Dip.opinion = (state, a, b) => state.diplo.rel[U.pairKey(a, b)] || 0;
  Dip.addOpinion = function (state, a, b, delta) {
    const k = U.pairKey(a, b);
    state.diplo.rel[k] = U.clamp((state.diplo.rel[k] || 0) + delta, -100, 100);
  };

  // ---------- perang ----------
  Dip.canDeclareWar = function (state, a, b) {
    const ca = state.countries[a], cb = state.countries[b];
    if (!ca || !cb || !ca.exists || !cb.exists) return { ok: false, reason: "Negara tidak valid." };
    if (a === b) return { ok: false, reason: "Tidak bisa menyatakan perang pada diri sendiri." };
    if (Dip.atWar(state, a, b)) return { ok: false, reason: "Sudah berperang dengan negara ini." };
    if (Dip.isAllied(state, a, b)) return { ok: false, reason: "Negara ini sekutu. Batalkan aliansi dulu." };
    if (Dip.hasPact(state, "nap", a, b)) return { ok: false, reason: "Ada pakta non-agresi. Batalkan pakta dulu." };
    if (ca.capitulated) return { ok: false, reason: "Negaramu sedang kapitulasi." };
    return { ok: true };
  };

  function addHostility(state, a, b, primary) {
    if (a === b || Dip.atWar(state, a, b)) return false;
    state.wars.push({ id: state.nextWarId++, a, b, start: state.day, primary: !!primary });
    state.rt.warSet.add(U.pairKey(a, b)); state.rt.enemies[a].add(b); state.rt.enemies[b].add(a);
    // pakta apa pun di antara keduanya batal
    state.diplo.pacts = state.diplo.pacts.filter((p) => !(U.pairKey(p.a, p.b) === U.pairKey(a, b)));
    Dip.rebuildIndex(state);
    return true;
  }

  Dip.declareWar = function (state, a, b) {
    const chk = Dip.canDeclareWar(state, a, b);
    if (!chk.ok) return { ok: false, msg: chk.reason };
    const name = (i) => WO.World.countries[i].name;
    const side1 = [a], side2 = [b];
    for (const x of state.rt.allies[a]) if (x !== b && !state.countries[x].capitulated && !Dip.isAllied(state, x, b)) side1.push(x);
    for (const y of state.rt.allies[b]) if (y !== a && !state.countries[y].capitulated && !Dip.isAllied(state, y, a) && side1.indexOf(y) === -1) side2.push(y);
    addHostility(state, a, b, true);
    for (const x of side1) for (const y of side2) if (!(x === a && y === b) && !Dip.isAllied(state, x, y)) addHostility(state, x, y, false);
    Dip.addOpinion(state, a, b, -60);
    for (const y of side2) if (y !== b) Dip.addOpinion(state, a, y, -25);
    const msg = name(a) + " menyatakan perang terhadap " + name(b) +
      (side1.length + side2.length > 2 ? " (" + (side1.length + side2.length) + " negara terlibat)" : "") + ".";
    WO.log(state, msg, "war", a);
    Dip.history(state, msg); WO.flag(state, "declare", a);
    state.rt.dirty.panels = true;
    return { ok: true, msg };
  };

  Dip.endHostility = function (state, a, b) {
    const k = U.pairKey(a, b);
    state.wars = state.wars.filter((w) => U.pairKey(w.a, w.b) !== k);
    Dip.rebuildIndex(state);
  };

  // ---------- pakta ----------
  Dip.aiAccepts = function (state, type, from, to) {
    const op = Dip.opinion(state, from, to);
    if (Dip.atWar(state, from, to)) return { accept: false, reason: "Sedang berperang." };
    if (type === "nap") return op >= -10 ? { accept: true } : { accept: false, reason: "Hubungan terlalu buruk (butuh ≥ -10)." };
    if (type === "access") return op >= 10 ? { accept: true } : { accept: false, reason: "Kurang percaya (butuh opini ≥ 10)." };
    if (type === "trade") return op >= -5 ? { accept: true } : { accept: false, reason: "Hubungan terlalu buruk (butuh ≥ -5)." };
    if (type === "alliance") return op >= 40 ? { accept: true } : { accept: false, reason: "Opini belum cukup (butuh ≥ 40)." };
    return { accept: false, reason: "Jenis pakta tidak dikenal." };
  };

  Dip.proposePact = function (state, type, from, to) {
    if (!PACT_NAMES[type]) return { ok: false, msg: "Jenis pakta tidak dikenal." };
    if (from === to) return { ok: false, msg: "Tidak valid." };
    if (!state.countries[to].exists) return { ok: false, msg: "Negara tidak ada lagi." };
    if (type === "access") {
      if (Dip.hasPact(state, "access", from, to) && state.diplo.pacts.some((p) => p.type === "access" && p.a === to && p.b === from))
        return { ok: false, msg: "Akses militer sudah ada." };
    } else if (Dip.hasPact(state, type, from, to)) return { ok: false, msg: PACT_NAMES[type] + " sudah ada." };
    if (type === "alliance" && Dip.hasPact(state, "nap", from, to)) { /* aliansi menggantikan NAP */ }
    const ans = Dip.aiAccepts(state, type, from, to);
    const nm = (i) => WO.World.countries[i].name;
    if (!ans.accept) {
      const msg = nm(to) + " menolak " + PACT_NAMES[type].toLowerCase() + ": " + ans.reason;
      Dip.history(state, msg); return { ok: false, msg };
    }
    if (type === "access") state.diplo.pacts.push({ id: "P" + state.nextProjId++, type, a: to, b: from, since: state.day });  // 'to' memberi izin
    else {
      if (type === "alliance") state.diplo.pacts = state.diplo.pacts.filter((p) => !(p.type === "nap" && U.pairKey(p.a, p.b) === U.pairKey(from, to)));
      state.diplo.pacts.push({ id: "P" + state.nextProjId++, type, a: from, b: to, since: state.day });
    }
    Dip.addOpinion(state, from, to, type === "alliance" ? 15 : 5);
    Dip.rebuildIndex(state);
    const msg = PACT_NAMES[type] + " dengan " + nm(to) + " disetujui.";
    WO.log(state, msg, "diplo", from); Dip.history(state, msg);
    state.rt.dirty.panels = true;
    return { ok: true, msg };
  };

  Dip.breakPact = function (state, pactId, by) {
    const p = state.diplo.pacts.find((x) => x.id === pactId);
    if (!p) return { ok: false, msg: "Pakta tidak ditemukan." };
    if (by !== p.a && by !== p.b) return { ok: false, msg: "Bukan pihak dalam pakta ini." };
    state.diplo.pacts = state.diplo.pacts.filter((x) => x.id !== pactId);
    const other = by === p.a ? p.b : p.a;
    Dip.addOpinion(state, by, other, -25);
    Dip.rebuildIndex(state);
    const msg = WO.World.countries[by].name + " membatalkan " + PACT_NAMES[p.type].toLowerCase() + " dengan " + WO.World.countries[other].name + ".";
    WO.log(state, msg, "diplo", by); Dip.history(state, msg);
    state.rt.dirty.panels = true;
    return { ok: true, msg };
  };

  Dip.improveRelations = function (state, from, to) {
    const key = "imp:" + from + ">" + to, c = state.countries[from];
    if (state.diplo.cd[key] && state.day < state.diplo.cd[key]) return { ok: false, msg: "Tunggu " + (state.diplo.cd[key] - state.day) + " hari lagi." };
    if (c.treasury < C.IMPROVE_COST) return { ok: false, msg: "Kas tidak cukup ($" + C.IMPROVE_COST + " M)." };
    if (Dip.atWar(state, from, to)) return { ok: false, msg: "Tidak bisa memperbaiki hubungan saat perang." };
    c.treasury -= C.IMPROVE_COST;
    state.diplo.cd[key] = state.day + C.IMPROVE_COOLDOWN;
    Dip.addOpinion(state, from, to, 15);
    return { ok: true, msg: "Hubungan membaik (+15)." };
  };

  Dip.countryPacts = (state, iso) => state.diplo.pacts.filter((p) => p.a === iso || p.b === iso);

  // harian: opini kembali pelan ke 0, perang menahan opini buruk
  Dip.tick = function (state) {
    if (state.day % 5 !== 0) return;
    const rel = state.diplo.rel;
    for (const k of Object.keys(rel)) {
      const [a, b] = k.split("|");
      if (Dip.atWar(state, a, b)) { rel[k] = Math.min(rel[k], -50); continue; }
      const v = rel[k], step = 0.5;
      rel[k] = Math.abs(v) <= step ? 0 : v - Math.sign(v) * step;
      if (rel[k] === 0) delete rel[k];
    }
    // pakta dengan negara yang sudah tidak ada dibersihkan
    const before = state.diplo.pacts.length;
    state.diplo.pacts = state.diplo.pacts.filter((p) => state.countries[p.a].exists && state.countries[p.b].exists);
    if (state.diplo.pacts.length !== before) Dip.rebuildIndex(state);
  };
})(typeof window !== "undefined" ? window : globalThis);
