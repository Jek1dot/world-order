// ===== WORLD ORDER v0.4 — AI SEDERHANA =====
// AI tunduk pada aturan yang sama dengan pemain (kas, manpower, peralatan, izin militer, waktu gerak).
// Evaluasi hanya seminggu sekali per negara (terjadwal bergilir) agar hemat komputasi.
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, U = WO.util, C = WO.C;
  const AI = (WO.AI = {});
  const EQ_SHARE = { rifles: 0.55, artillery: 0.30, tanks: 0.15 };

  AI.tick = function (state) {
    for (const iso of W.countryIds) {
      const c = state.countries[iso];
      if (!c.exists || iso === state.player) continue;
      if ((state.day + c.ai.next) % 7 !== 0) continue;
      AI.think(state, iso);
    }
  };

  AI.think = function (state, iso) {
    const c = state.countries[iso];
    if (c.capitulated) return;
    const atWar = state.rt.enemies[iso].size > 0;
    if (atWar) WO.Cap.aiMaybeRelocate(state, iso);
    AI.economy(state, iso, atWar);
    AI.recruit(state, iso, atWar);
    if (atWar) AI.warOps(state, iso); else AI.peaceOps(state, iso);
  };

  // ---------- ekonomi & produksi ----------
  AI.economy = function (state, iso, atWar) {
    const c = state.countries[iso], a = c.agg;
    if (c.queue.length < (atWar ? 3 : 2) && c.treasury > 6) {
      let type = a.mil < a.civ * 0.5 ? "mil" : (state.day % 28 < 7 ? "infra" : "civ");
      const cands = [...state.rt.owned[iso]].filter((p) => state.provinces[p].controller === iso)
        .sort((x, y) => W.provinces[y].popM - W.provinces[x].popM).slice(0, 12);
      for (const t of [type, type === "infra" ? "civ" : "mil"]) {
        for (const pid of cands) if (WO.Eco.queueBuild(state, iso, t, pid).ok) { type = null; break; }
        if (!type) break;
      }
    }
    // alokasi pabrik militer ke lini produksi
    let free = WO.Eco.freeFactories(c);
    const total = a.mil;
    if (total > 0 && free > 0) {
      const equips = a.gdp >= 800 ? ["rifles", "artillery", "tanks"] : ["rifles", "artillery"];
      while (free > 0) {
        let best = equips[0], bd = -Infinity;
        for (const e of equips) {
          const line = c.lines.find((l) => l.equip === e), n = line ? line.factories : 0;
          const share = EQ_SHARE[e] / equips.reduce((s, x) => s + EQ_SHARE[x], 0);
          const deficit = share * total - n;
          if (deficit > bd) { bd = deficit; best = e; }
        }
        const line = c.lines.find((l) => l.equip === best);
        if (!WO.Eco.setProduction(state, iso, best, (line ? line.factories : 0) + 1).ok) break;
        free--;
      }
    }
  };

  AI.recruit = function (state, iso, atWar) {
    const c = state.countries[iso];
    const n = WO.Eco.armyCount(state, iso);
    const target = Math.min(60, Math.round(Math.max(2, Math.sqrt(W.countries[iso].pop) * 0.9) * (atWar ? 1.5 : 1)));
    let budget = 2;
    while (n + (2 - budget) < target && budget > 0) {
      const types = c.stock.tanks >= C.DIV_TYPES.armored.eq.tanks && c.res.oil > 50 ? ["armored", "infantry", "garrison"] : ["infantry", "garrison"];
      let done = false;
      for (const t of types) {
        let where = c.capital;
        if (state.provinces[where].controller !== iso || state.provinces[where].owner !== iso) {
          where = [...state.rt.owned[iso]].find((p) => state.provinces[p].controller === iso);
          if (!where) return;
        }
        if (WO.Mil.recruit(state, iso, t, where).ok) { done = true; break; }
      }
      if (!done) break;
      budget--;
    }
  };

  // ---------- operasi perang ----------
  AI.warOps = function (state, iso) {
    const rt = state.rt, enemies = rt.enemies[iso];
    const mine = WO.State.countryDivisions(state, iso).filter((d) => state.day >= d.readyDay);
    if (!mine.length) return;
    const ctrlOf = (p) => state.provinces[p].controller;
    // 1) peta ancaman
    const threat = new Map();
    for (const pid of rt.controlled[iso]) {
      let t = 0;
      for (const nx of W.provinces[pid].adj) {
        if (enemies.has(ctrlOf(nx))) t += 1;
        for (const d of WO.State.divisionsIn(state, nx)) if (enemies.has(d.country) && WO.Mil.isActive(state, d)) t += 2;
      }
      if (t > 0) threat.set(pid, t);
    }
    let pathBudget = 6;
    const idle = mine.filter((d) => !d.order && !d.attacking);

    // 2) serangan lokal: provinsi musuh bersebelahan dengan unit menganggur
    const targets = new Map();
    for (const d of idle) {
      if (d.org < C.DIV_TYPES[d.type].org * 0.6 || d.str < 50) continue;
      for (const nx of W.provinces[d.province].adj) {
        if (!enemies.has(ctrlOf(nx))) continue;
        let g = targets.get(nx); if (!g) { g = []; targets.set(nx, g); } g.push(d);
      }
    }
    const used = new Set();
    for (const [pid, group] of targets) {
      const defenders = WO.Mil.hostileIn(state, iso, pid);
      const terr = C.TERRAIN[W.provinces[pid].terrain];
      let ed = 0; for (const x of defenders) ed += C.DIV_TYPES[x.type].def * (1 + terr.def) * (x.str / 100);
      const g = group.filter((d) => !used.has(d.id)).slice(0, C.COMBAT_WIDTH);
      let ea = 0; for (const x of g) ea += C.DIV_TYPES[x.type].atk * terr.atk * (x.str / 100);
      if (!g.length) continue;
      if (defenders.length === 0 || ea >= 1.5 * ed) {
        const ids = g.map((x) => x.id); ids.forEach((id) => used.add(id));
        WO.Mil.orderMove(state, iso, ids, pid);
      }
    }

    // 3) reposisi: unit menganggur di provinsi aman menuju titik paling terancam
    let hot = null, hv = 0; for (const [pid, t] of threat) if (t > hv) { hv = t; hot = pid; }
    const rest = idle.filter((d) => !used.has(d.id));
    if (hot) {
      for (const d of rest) {
        if (pathBudget <= 0) break;
        if (d.province === hot || threat.has(d.province)) continue;
        if (WO.Mil.orderMove(state, iso, [d.id], hot).ok) pathBudget--;
      }
    } else if (rest.length) {
      // 4) tidak ada front: serang ibu kota/provinsi musuh jika kekuatan cukup
      let myStr = 0, enStr = 0;
      for (const d of mine) myStr += d.str / 100;
      for (const e of enemies) enStr += WO.State.armyStrength(state, e);
      if (myStr >= 1.2 * Math.max(1, enStr)) {
        const goal = [];
        for (const e of enemies) {
          if (state.countries[e].capitulated) continue;
          const cp = state.countries[e].capital; if (ctrlOf(cp) === e) goal.push(cp);
          for (const pid of rt.controlled[e]) if (goal.indexOf(pid) === -1 && goal.length < 6) goal.push(pid);
        }
        for (const g of goal) {
          const probe = WO.Path.find(state, iso, rest[0].province, g, { speed: 60 });
          if (!probe.ok) continue;
          for (const d of rest) { if (pathBudget-- <= 0) break; WO.Mil.orderMove(state, iso, [d.id], g); }
          break;
        }
      }
    }
  };

  // ---------- masa damai ----------
  AI.peaceOps = function (state, iso) {
    const c = state.countries[iso];
    // sebar pasukan ke provinsi perbatasan yang menghadap negara bermusuhan (opini negatif)
    // agresi opsional (default MATI): negara kuat menyerang tetangga lemah
    if (state.settings.aiAggressive && state.day > 60 && WO.Eco.armyCount(state, iso) >= 3 && WO.rand(state) < 0.04) {
      const my = WO.State.armyStrength(state, iso);
      const nbrs = new Set();
      for (const pid of state.rt.owned[iso]) for (const nx of W.provinces[pid].adj) { const o = state.provinces[nx].controller; if (o !== iso) nbrs.add(o); }
      for (const n of nbrs) {
        const cn = state.countries[n];
        if (!cn.exists || cn.capitulated || WO.Dip.isAllied(state, iso, n) || WO.Dip.hasPact(state, "nap", iso, n)) continue;
        if (WO.State.armyStrength(state, n) * 3 > my) continue;
        if (WO.Dip.opinion(state, iso, n) > 10) continue;
        WO.Dip.declareWar(state, iso, n); break;
      }
    }
    // diplomasi ringan: tawarkan perjanjian dagang ke tetangga yang disukai
    if (state.day % 63 === (state.countries[iso].ai.next * 9) % 63 && state.day > 30) {
      for (const pid of state.rt.owned[iso]) {
        let done = false;
        for (const nx of W.provinces[pid].adj) {
          const o = state.provinces[nx].controller;
          if (o !== iso && o !== state.player && state.countries[o].exists && !WO.Dip.hasPact(state, "trade", iso, o) && WO.Dip.opinion(state, iso, o) >= -5) {
            WO.Dip.proposePact(state, "trade", iso, o); done = true; break;
          }
        }
        if (done) break;
      }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
