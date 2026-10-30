// ===== WORLD ORDER v0.4 — PERANG: PERTEMPURAN, PENDUDUKAN, KAPITULASI, DAMAI =====
// Prinsip: pendudukan mengubah CONTROLLER saja. OWNER hanya berubah lewat perjanjian damai.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, U = WO.util, C = WO.C;
  const War = (WO.War = {});
  const nm = (iso) => W.countries[iso].name;

  // ---------- pendudukan ----------
  War.capture = function (state, pid, iso) {
    const sp = state.provinces[pid], prev = sp.controller;
    if (prev === iso) return;
    if (sp.owner !== iso) sp.infra = Math.max(0, sp.infra - 1);       // kerusakan perang
    WO.State.setController(state, pid, iso);
    const wp = W.provinces[pid];
    const ownerC = state.countries[sp.owner];
    if (sp.owner === iso) WO.log(state, wp.name + " dibebaskan oleh " + nm(iso) + ".", "war", iso);
    else if (ownerC.capital === pid) WO.log(state, "IBU KOTA " + nm(sp.owner) + " (" + wp.name + ") diduduki " + nm(iso) + "!", "capital-lost", iso);
    else WO.log(state, nm(iso) + " menduduki " + wp.name + " (milik " + nm(sp.owner) + ").", "war", iso);
    state.rt.dirty.units = true;
    if (sp.owner !== iso) { WO.flag(state, "occupy", iso); if (ownerC.capital === pid) WO.flag(state, "occupy_capital", iso); }
  };

  // ---------- pertempuran darat ----------
  function activeIn(state, pid) {
    const out = [], S = state.rt.divsByProv[pid]; if (!S) return out;
    for (const id of S) { const x = state.divisions[id]; if (WO.Mil.isActive(state, x)) out.push(x); }
    return out;
  }
  function power(state, d, terrainMul, isAttack) {
    const t = C.DIV_TYPES[d.type], c = state.countries[d.country];
    let v = (isAttack ? t.atk : t.def) * (0.5 + 0.5 * d.org / t.org) * (0.3 + 0.7 * d.str / 100);
    v *= (0.6 + 0.4 * d.supply) * (1 + d.xp / 400) * terrainMul;
    if (t.oil > 0) v *= 0.4 + 0.6 * (c.oilF === undefined ? 1 : c.oilF);
    return v;
  }
  function strongestCountry(divs) {
    const m = {}; for (const d of divs) m[d.country] = (m[d.country] || 0) + d.str;
    return Object.keys(m).sort((a, b) => m[b] - m[a])[0];
  }
  function findRetreat(state, d) {
    const iso = d.country, cap = W.provinces[state.countries[iso].capital];
    let best = null, bv = Infinity;
    for (const nx of W.provinces[d.province].adj) {
      const ctrl = state.provinces[nx].controller;
      if (!(ctrl === iso || WO.Dip.isAllied(state, iso, ctrl))) continue;
      if (WO.Mil.hostileIn(state, iso, nx).length) continue;
      const dd = W.dist(nx, cap.id);
      if (dd < bv) { bv = dd; best = nx; }
    }
    return best;
  }
  function destroy(state, d, why) {
    WO.log(state, d.name + " (" + nm(d.country) + ") " + why, "mil", d.country);
    WO.State.removeDivision(state, d.id);
  }
  function addCasualties(state, d, strLoss) {
    const c = state.countries[d.country], men = strLoss / 100 * C.DIV_TYPES[d.type].man;
    c.casualties += men;
    c.exhaustion = Math.min(100, c.exhaustion + men / (W.countries[d.country].pop * 1e6 * 0.0003) * 100 * 0.1);
  }

  War.resolveCombat = function (state) {
    const rt = state.rt;
    rt.fighting = new Set(); rt.combats = {};
    const prevActive = rt.activeBattles || new Set(); rt.activeBattles = new Set();
    const battles = new Map();
    const get = (pid) => { let b = battles.get(pid); if (!b) { b = { pid, att: new Set() }; battles.set(pid, b); } return b; };

    // penyerang berdasarkan perintah
    for (const d of Object.values(state.divisions)) {
      if (!d.attacking) continue;
      const sp = state.provinces[d.attacking];
      if (!WO.Mil.isActive(state, d) || !WO.Dip.atWar(state, d.country, sp.controller) || !W.isAdjacent(d.province, d.attacking)) { d.attacking = null; continue; }
      get(d.attacking).att.add(d);
    }
    // musuh yang sudah berada di dalam provinsi
    const multi = [];
    for (const pid in rt.divsByProv) if (rt.divsByProv[pid].size > 1) multi.push(pid);
    for (const pid of multi) {
      const ctrl = state.provinces[pid].controller;
      for (const x of activeIn(state, pid)) if (x.country !== ctrl && WO.Dip.atWar(state, x.country, ctrl)) get(pid).att.add(x);
    }

    for (const b of battles.values()) {
      const pid = b.pid, sp = state.provinces[pid], ctrl = sp.controller;
      let att = [...b.att].filter((x) => state.divisions[x.id]);
      const defAll = activeIn(state, pid).filter((x) => x.country === ctrl || WO.Dip.isAllied(state, ctrl, x.country));
      if (!defAll.length) {
        const inside = att.filter((x) => x.province === pid);
        if (inside.length) War.capture(state, pid, strongestCountry(inside));
        for (const a of att) if (a.attacking === pid) a.attacking = null;
        continue;
      }
      const terr = C.TERRAIN[W.provinces[pid].terrain];
      att.sort((x, y) => y.str - x.str); defAll.sort((x, y) => y.str - x.str);
      const A = att.slice(0, C.COMBAT_WIDTH), D = defAll.slice(0, C.COMBAT_WIDTH);
      let Fa = 0, Fd = 0;
      for (const x of A) Fa += power(state, x, terr.atk, true);
      for (const x of D) Fd += power(state, x, 1 + terr.def, false);
      const r1 = 0.85 + WO.rand(state) * 0.3, r2 = 0.85 + WO.rand(state) * 0.3;
      const orgToDef = Fa * C.COMBAT_K * r1 / D.length, orgToAtt = Fd * C.COMBAT_K * r2 / A.length;

      let aLoss = 0, dLoss = 0;
      const apply = (list, orgDmg, isDef) => {
        for (const x of list) {
          const t = C.DIV_TYPES[x.type];
          const strLoss = Math.min(x.str, orgDmg * C.STR_PER_ORG * 100 / t.org * 0.6);
          x.org -= orgDmg; x.str -= strLoss; x.xp = Math.min(100, x.xp + 0.4);
          rt.fighting.add(x.id); addCasualties(state, x, strLoss);
          if (isDef) dLoss += strLoss; else aLoss += strLoss;
        }
      };
      apply(D, orgToDef, true); apply(A, orgToAtt, false);

      // dihancurkan / hancur organisasi
      for (const x of D) {
        if (!state.divisions[x.id]) continue;
        if (x.str <= 0.5) destroy(state, x, "hancur di " + W.provinces[pid].name + ".");
        else if (x.org <= 0) {
          const rp = findRetreat(state, x);
          if (rp) { WO.State.moveDivisionTo(state, x, rp); x.org = C.DIV_TYPES[x.type].org * 0.1; x.order = null; x.attacking = null; }
          else destroy(state, x, "terkepung dan hancur di " + W.provinces[pid].name + ".");
        }
      }
      for (const x of A) {
        if (!state.divisions[x.id]) continue;
        if (x.str <= 0.5) destroy(state, x, "hancur saat menyerang " + W.provinces[pid].name + ".");
        else if (x.org <= 0) { x.org = C.DIV_TYPES[x.type].org * 0.1; x.order = null; x.attacking = null; b.att.delete(x); }
      }

      // apakah pertahanan runtuh?
      const left = activeIn(state, pid).filter((x) => x.country === ctrl || WO.Dip.isAllied(state, ctrl, x.country));
      const alive = [...b.att].filter((x) => state.divisions[x.id] && x.org > 0);
      let captured = false;
      if (!left.length && alive.length) {
        const winner = strongestCountry(alive);
        for (const x of alive) {
          if (x.province !== pid) {
            WO.State.moveDivisionTo(state, x, pid);
            if (x.order && x.order.path[x.order.idx] === pid) { x.order.idx++; x.order.progress = 0; x.order.load = undefined; if (x.order.idx >= x.order.path.length) x.order = null; }
          }
          x.attacking = null; x.xp = Math.min(100, x.xp + 2);
        }
        War.capture(state, pid, winner);
        captured = true;
      }
      for (const x of A) if (x.country === state.player) WO.flag(state, "attack", x.country);
      rt.combats[pid] = { pid, att: A.length, def: D.length, aLoss, dLoss, captured, attCountries: [...new Set(A.map((x) => x.country))], defCountries: [...new Set(D.map((x) => x.country))] };
      if (!captured) rt.activeBattles.add(pid);
      if (!prevActive.has(pid) && !captured) WO.log(state, "Pertempuran di " + W.provinces[pid].name + ": " + [...new Set(A.map((x) => nm(x.country)))].join("/") + " menyerang " + [...new Set(D.map((x) => nm(x.country)))].join("/") + ".", "battle", A[0].country);
    }
    rt.dirty.units = true;
  };

  // ---------- skor perang & tekanan kapitulasi ----------
  War.pressure = function (state, iso, strBy) {
    const c = state.countries[iso], a = c.agg;
    const lostFrac = a.vpOwned > 0 ? a.vpLost / a.vpOwned : 0;
    const capSp = state.provinces[c.capital];
    const capLost = capSp.controller !== iso ? 1 : 0;
    const str = strBy ? (strBy[iso] || 0) : WO.State.armyStrength(state, iso);
    const armyRatio = U.clamp(str / Math.max(1, c.peakArmy), 0, 1);
    const pressure = 30 * capLost + 45 * Math.min(1, lostFrac / 0.55) + 12 * c.exhaustion / 100 + 13 * (1 - armyRatio);
    return { pressure, capLost: !!capLost, lostFrac, armyRatio };
  };

  War.updateCapitulation = function (state) {
    const strBy = {};
    for (const d of Object.values(state.divisions)) strBy[d.country] = (strBy[d.country] || 0) + d.str / 100;
    for (const iso of WO.World.countryIds) {
      const c = state.countries[iso];
      if (!c.exists) continue;
      if (strBy[iso] > c.peakArmy) c.peakArmy = strBy[iso];
      if (c.capitulated || state.rt.enemies[iso].size === 0) { c.capDays = 0; c.pressure = null; continue; }
      const p = War.pressure(state, iso, strBy);
      c.pressure = p;
      const lostAll = c.agg.nOwned > 0 && c.agg.nHeldOwn === 0;
      const cond = p.pressure >= C.CAP_PRESSURE && (p.capLost || p.lostFrac >= 0.4);
      c.capDays = cond ? c.capDays + 1 : Math.max(0, c.capDays - 1);
      if (lostAll || c.capDays >= C.CAP_DAYS) War.capitulate(state, iso);
    }
  };

  War.capitulate = function (state, iso) {
    const c = state.countries[iso];
    c.capitulated = true; c.capDays = 0;
    // pasukan di wilayah yang diduduki musuh menyerah; sisanya berhenti bertempur (pasif)
    for (const d of Object.values(state.divisions)) {
      if (d.country !== iso) continue;
      const ctrl = state.provinces[d.province].controller;
      if (ctrl !== iso && state.rt.enemies[iso].has(ctrl)) WO.State.removeDivision(state, d.id);
      else { d.order = null; d.attacking = null; }
    }
    const enemies = [...state.rt.enemies[iso]].map(nm).join(", ");
    const msg = nm(iso) + " KAPITULASI! Musuh: " + enemies + ".";
    WO.log(state, msg, "capitulation", iso);
    WO.Dip.history(state, msg);
    state.pendingMessages.push({ day: state.day, kind: "capitulation", country: iso, text: msg });
    for (const e of state.rt.enemies[iso]) WO.flag(state, "capitulation", e);
    state.rt.dirty.panels = true; state.rt.dirty.units = true; state.rt.dirty.all = true;
  };

  War.warScore = function (state, winner, loser) {
    const l = state.countries[loser];
    const total = l.agg ? l.agg.vpOwned : 0;
    let ctrl = 0;
    for (const pid of state.rt.owned[loser]) if (state.provinces[pid].controller === winner) ctrl += W.provinces[pid].vp;
    const fraction = total > 0 ? ctrl / total : 0;
    return { score: Math.min(1, fraction + (l.capitulated ? 0.25 : 0)), controlledVP: ctrl, totalVP: total, fraction };
  };
  War.controlledProvinces = function (state, winner, loser) {
    const out = []; for (const pid of state.rt.owned[loser]) if (state.provinces[pid].controller === winner) out.push(pid); return out;
  };
  War.termsCost = function (state, winner, loser, terms) {
    const ws = War.warScore(state, winner, loser);
    let cost = 0;
    if (terms.annex) cost = 0.9;
    else if (terms.transfer && terms.transfer.length && ws.totalVP > 0) {
      let vp = 0; for (const pid of terms.transfer) vp += W.provinces[pid].vp; cost = vp / ws.totalVP;
    }
    if (terms.reparations) cost += 0.15;
    return { cost, score: ws.score };
  };

  // ---------- perjanjian damai ----------
  War.settle = function (state, winner, loser, terms) {
    terms = terms || {};
    if (!WO.Dip.atWar(state, winner, loser)) return { ok: false, msg: "Tidak sedang berperang dengan negara ini." };
    const tc = War.termsCost(state, winner, loser, terms);
    if (tc.cost > tc.score + 1e-9) return { ok: false, msg: "Skor perang tidak cukup (butuh " + Math.round(tc.cost * 100) + ", ada " + Math.round(tc.score * 100) + ")." };
    if (terms.annex && tc.score < 0.9) return { ok: false, msg: "Aneksasi butuh skor perang ≥ 90." };
    const L = state.countries[loser], Wn = state.countries[winner];
    let transfer = [];
    if (terms.annex) transfer = [...state.rt.owned[loser]];
    else if (terms.transfer) transfer = terms.transfer.filter((pid) => state.provinces[pid].owner === loser && state.provinces[pid].controller === winner);
    const hadCapital = transfer.indexOf(L.capital) !== -1;

    for (const pid of transfer) { WO.State.setOwner(state, pid, winner); WO.State.setController(state, pid, winner); }
    let paid = 0;
    if (terms.reparations) { paid = Math.max(0, Math.min(L.treasury * 0.5, 200)); L.treasury -= paid; Wn.treasury += paid; }
    // provinsi yang tidak ditransfer dikembalikan ke pemilik
    for (const pid of [...state.rt.controlled[winner]]) if (state.provinces[pid].owner === loser) WO.State.setController(state, pid, loser);
    for (const pid of [...state.rt.controlled[loser]]) if (state.provinces[pid].owner === winner) WO.State.setController(state, pid, winner);

    WO.Dip.endHostility(state, winner, loser);
    War.withdrawIllegal(state);

    const kind = terms.annex ? "aneksasi penuh" : transfer.length ? "transfer " + transfer.length + " provinsi" : "damai putih";
    let msg = "Perdamaian " + nm(winner) + " – " + nm(loser) + ": " + kind + (paid ? ", reparasi $" + paid.toFixed(1) + " M" : "") + ".";
    WO.log(state, msg, "peace", winner); WO.Dip.history(state, msg); WO.flag(state, "peace", winner);

    if (state.rt.owned[loser].size === 0) War.eliminate(state, loser, winner);
    else {
      if (hadCapital) WO.Cap.autoRelocate(state, loser);
      if (state.rt.enemies[loser].size === 0) { L.capitulated = false; L.capDays = 0; L.exhaustion *= 0.6; }
    }
    Wn.exhaustion *= 0.8; WO.Dip.addOpinion(state, winner, loser, -20);
    state.peaceOffers = state.peaceOffers.filter((o) => !(U.pairKey(o.from, o.to) === U.pairKey(winner, loser)));
    state.rt.aggDirty.add(winner); state.rt.aggDirty.add(loser);
    state.rt.dirty.all = true; state.rt.dirty.panels = true; state.rt.dirty.units = true;
    return { ok: true, msg, transferred: transfer.length };
  };

  War.eliminate = function (state, iso, by) {
    const c = state.countries[iso];
    c.exists = false; c.capitulated = false;
    for (const d of Object.values(state.divisions)) if (d.country === iso) WO.State.removeDivision(state, d.id);
    state.wars = state.wars.filter((w) => w.a !== iso && w.b !== iso);
    state.diplo.pacts = state.diplo.pacts.filter((p) => p.a !== iso && p.b !== iso);
    state.peaceOffers = state.peaceOffers.filter((o) => o.from !== iso && o.to !== iso);
    WO.Dip.rebuildIndex(state);
    const msg = nm(iso) + " dihapus dari peta" + (by ? " (dianeksasi " + nm(by) + ")" : "") + ".";
    WO.log(state, msg, "capitulation", iso); WO.Dip.history(state, msg);
    if (state.player === iso) state.pendingMessages.push({ day: state.day, kind: "gameover", country: iso, text: "Negaramu, " + nm(iso) + ", telah dianeksasi. Pilih negara lain untuk dipimpin." });
  };

  // pasukan yang berdiri di wilayah yang tidak boleh dimasuki (setelah damai / akses dicabut) dipindahkan
  War.withdrawIllegal = function (state) {
    for (const d of Object.values(state.divisions)) {
      const ctrl = state.provinces[d.province].controller;
      if (WO.Dip.isFriendly(state, d.country, ctrl) || WO.Dip.atWar(state, d.country, ctrl)) continue;
      const dist = WO.Path.bfs(d.province, 10, null);
      let dest = null, bd = Infinity;
      for (const [pid, steps] of dist) {
        const a = WO.Path.access(state, d.country, pid);
        if ((a === "own" || a === "friend") && steps < bd) { bd = steps; dest = pid; }
      }
      if (dest) { WO.State.moveDivisionTo(state, d, dest); d.order = null; d.attacking = null; WO.log(state, d.name + " ditarik mundur ke " + W.provinces[dest].name + ".", "mil", d.country); }
      else destroy(state, d, "dibubarkan karena terjebak di wilayah asing.");
    }
  };

  // ---------- tawaran damai putih ----------
  War.aiWouldAcceptWhitePeace = function (state, aiIso, otherIso) {
    const c = state.countries[aiIso], p = War.pressure(state, aiIso);
    const myScore = War.warScore(state, aiIso, otherIso).score;
    if (c.capitulated) return { accept: true };
    if (p.pressure >= 35 || c.exhaustion >= 55) return { accept: true };
    if (myScore > 0.25) return { accept: false, reason: "Merasa menang (menguasai " + Math.round(myScore * 100) + "% wilayahmu)." };
    return { accept: c.exhaustion >= 40, reason: "Belum bersedia berdamai." };
  };
  War.offerWhitePeace = function (state, from, to) {
    if (!WO.Dip.atWar(state, from, to)) return { ok: false, msg: "Tidak sedang berperang." };
    const ans = War.aiWouldAcceptWhitePeace(state, to, from);
    if (!ans.accept) { const m = nm(to) + " menolak damai: " + (ans.reason || "belum bersedia."); WO.Dip.history(state, m); return { ok: false, msg: m }; }
    return War.settle(state, from, to, {});
  };

  // ---------- peninjauan damai oleh AI (mingguan) ----------
  War.aiReview = function (state) {
    const done = new Set();
    for (const w of [...state.wars]) {
      const k = U.pairKey(w.a, w.b); if (done.has(k) || !WO.Dip.atWar(state, w.a, w.b)) continue; done.add(k);
      const A = state.countries[w.a], B = state.countries[w.b];
      for (const [win, lose] of [[w.a, w.b], [w.b, w.a]]) {
        const L = state.countries[lose];
        if (!L.capitulated) continue;
        if (win === state.player) continue;                                  // pemain yang memutuskan
        // AI pemenang menyelesaikan: aneksasi jika skor cukup, kalau tidak ambil wilayah yang dikuasai + reparasi
        const ws = War.warScore(state, win, lose);
        let terms;
        if (ws.score >= 0.9) terms = { annex: true };
        else terms = { transfer: War.controlledProvinces(state, win, lose), reparations: ws.score >= 0.4 };
        let r = War.settle(state, win, lose, terms);
        if (!r.ok) r = War.settle(state, win, lose, { transfer: War.controlledProvinces(state, win, lose) });
        if (!r.ok) War.settle(state, win, lose, {});
        break;
      }
      if (!WO.Dip.atWar(state, w.a, w.b)) continue;
      // damai putih bila keduanya lelah, atau salah satu kalah telak
      if (state.day - w.start < 45) continue;
      const aAI = w.a !== state.player, bAI = w.b !== state.player;
      for (const [x, y] of [[w.a, w.b], [w.b, w.a]]) {
        const px = War.pressure(state, x);
        if (px.pressure >= 45 || state.countries[x].exhaustion >= 70) {
          if (y !== state.player && x !== state.player) { if (War.offerWhitePeace(state, x, y).ok) break; }
          else if (x !== state.player && y === state.player) {
            if (!state.peaceOffers.some((o) => o.from === x && o.to === y)) {
              state.peaceOffers.push({ from: x, to: y, day: state.day, type: "white" });
              WO.log(state, nm(x) + " menawarkan damai putih kepadamu.", "peace-offer", x);
              state.pendingMessages.push({ day: state.day, kind: "peace-offer", country: x, text: nm(x) + " menawarkan damai putih." });
            }
          }
        }
      }
    }
    state.peaceOffers = state.peaceOffers.filter((o) => state.day - o.day <= 30 && WO.Dip.atWar(state, o.from, o.to));
  };
  War.acceptPeaceOffer = function (state, from) {
    const o = state.peaceOffers.find((x) => x.from === from && x.to === state.player);
    if (!o) return { ok: false, msg: "Tawaran tidak ada." };
    return War.settle(state, state.player, from, {});
  };
  War.declinePeaceOffer = function (state, from) {
    state.peaceOffers = state.peaceOffers.filter((x) => !(x.from === from && x.to === state.player));
    return { ok: true, msg: "Tawaran ditolak." };
  };
})(typeof window !== "undefined" ? window : globalThis);
