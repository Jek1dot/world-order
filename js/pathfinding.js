// ===== WORLD ORDER v0.4 — PATHFINDING (A*) =====
// Terpisah dari rendering. Mempertimbangkan: tetangga darat, jarak, infrastruktur, terrain,
// akses militer, wilayah musuh, dan penyeberangan laut domestik (hanya antar wilayah sahabat).
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, C = WO.C;
  const Path = (WO.Path = {});

  class MinHeap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
      const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v, n = k.length; if (!n) return null;
      const rk = k[0], rv = v[0], lk = k.pop(), lv = v.pop();
      if (n > 1) {
        let i = 0; const m = n - 1;
        for (;;) {
          let c = 2 * i + 1; if (c >= m) break;
          if (c + 1 < m && k[c + 1] < k[c]) c++;
          if (k[c] >= lk) break;
          k[i] = k[c]; v[i] = v[c]; i = c;
        }
        k[i] = lk; v[i] = lv;
      }
      return [rk, rv];
    }
  }
  WO.MinHeap = MinHeap;

  // klasifikasi hak masuk suatu provinsi bagi sebuah negara
  Path.access = function (state, iso, pid) {
    const ctrl = state.provinces[pid].controller;
    if (ctrl === iso) return "own";
    if (WO.Dip.isFriendly(state, iso, ctrl)) return "friend";
    if (WO.Dip.atWar(state, iso, ctrl)) return "enemy";
    return null;
  };

  // biaya (hari) menuju provinsi `to` lewat darat
  Path.landCost = function (state, from, to, speed, cls) {
    const t = C.TERRAIN[W.provinces[to].terrain];
    const infra = state.provinces[to].infra;
    let days = W.dist(from, to) / (speed * t.sp * (1 + 0.08 * infra));
    if (cls === "enemy") days *= 1.6;
    return days;
  };

  // opts: { speed, maxExpand }
  Path.find = function (state, iso, from, to, opts) {
    opts = opts || {};
    const speed = opts.speed || 60;
    if (from === to) return { ok: false, reason: "Sudah berada di provinsi tujuan." };
    const accTo = Path.access(state, iso, to);
    if (!accTo) {
      const owner = W.countries[state.provinces[to].controller].name;
      return { ok: false, reason: "Tidak ada izin militer untuk memasuki wilayah " + owner + ". Butuh perang atau akses militer." };
    }
    const g = new Map(), prev = new Map(), closed = new Set(), heap = new MinHeap();
    const tc = W.provinces[to].center;
    const hSpeed = Math.max(speed * 1.4, C.SEA_SPEED);
    const h = (id) => { const c = W.provinces[id].center; return WO.util.haversine(c[0], c[1], tc[0], tc[1]) / hSpeed; };
    g.set(from, 0); heap.push(h(from), from);
    let expanded = 0, max = opts.maxExpand || 6000, found = false;
    while (heap.size) {
      const [, cur] = heap.pop();
      if (closed.has(cur)) continue;
      if (cur === to) { found = true; break; }
      closed.add(cur);
      if (++expanded > max) break;
      const gc = g.get(cur), P = W.provinces[cur];
      const curAcc = Path.access(state, iso, cur);
      // darat
      for (let i = 0; i < P.adj.length; i++) {
        const nx = P.adj[i]; if (closed.has(nx)) continue;
        const cls = Path.access(state, iso, nx); if (!cls) continue;
        // keluar dari wilayah musuh menuju wilayah netral tetap dilarang oleh cls===null
        const ng = gc + Path.landCost(state, cur, nx, speed, cls);
        if (ng < (g.has(nx) ? g.get(nx) : Infinity)) { g.set(nx, ng); prev.set(nx, cur); heap.push(ng + h(nx), nx); }
      }
      // laut (hanya wilayah sahabat/sendiri di kedua ujung)
      if (curAcc === "own" || curAcc === "friend") {
        for (let i = 0; i < P.sea.length; i++) {
          const nx = P.sea[i][0], km = P.sea[i][1]; if (closed.has(nx)) continue;
          const cls = Path.access(state, iso, nx); if (cls !== "own" && cls !== "friend") continue;
          const ng = gc + (km / C.SEA_SPEED + C.SEA_LOAD_DAYS) * C.SEA_COST_MULT;
          if (ng < (g.has(nx) ? g.get(nx) : Infinity)) { g.set(nx, ng); prev.set(nx, cur); heap.push(ng + h(nx), nx); }
        }
      }
    }
    if (!found) return { ok: false, reason: "Tidak ada jalur yang valid ke tujuan (dipisahkan laut tanpa jalur penyeberangan, atau terhalang wilayah netral)." };
    const path = []; let cur = to;
    while (cur !== from) { path.push(cur); cur = prev.get(cur); }
    path.reverse();
    let enemy = 0; for (const id of path) if (Path.access(state, iso, id) === "enemy") enemy++;
    return { ok: true, path, days: g.get(to), enemy };
  };

  // jangkauan BFS (jumlah langkah) dari sebuah provinsi lewat darat, dengan filter
  Path.bfs = function (start, maxSteps, accept) {
    const dist = new Map([[start, 0]]), q = [start];
    for (let i = 0; i < q.length; i++) {
      const cur = q[i], d = dist.get(cur); if (d >= maxSteps) continue;
      for (const nx of W.provinces[cur].adj) {
        if (dist.has(nx)) continue;
        if (accept && !accept(nx)) continue;
        dist.set(nx, d + 1); q.push(nx);
      }
    }
    return dist;
  };
})(typeof window !== "undefined" ? window : globalThis);
