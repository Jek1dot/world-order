#!/usr/bin/env node
// Membangun data/db/manifest.json: daftar berkas per kategori (untuk lazy loading), ukuran, hash, dan versi skema.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const base = path.join(__dirname, "..", "..", "data/db");
const KINDS = { sources: "sources", countries: "countries", leaders: "leaders", equipment: "equipment", inventories: "inventories", events: "events", focus: "focus" };
const files = [];
for (const dir of Object.keys(KINDS)) {
  const d = path.join(base, dir); if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).sort()) if (f.endsWith(".json")) {
    const buf = fs.readFileSync(path.join(d, f));
    const o = JSON.parse(buf);
    files.push({ kind: KINDS[dir], path: dir + "/" + f, key: f.replace(/\.json$/, ""), bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16),
      count: (o.countries || o.sources || o.models || o.events || o.records || o.trees || o.tenures || []).length });
  }
}
const order = ["sources", "countries", "leaders", "equipment", "inventories", "events", "focus"];
files.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.path < b.path ? -1 : 1));
fs.writeFileSync(path.join(base, "manifest.json"), JSON.stringify({ db_version: "0.1.0-checkpoint1", schema: "wo-db v1", built: "2026-10-30", range: { from: "1991-01-01", to: "2026-12-31" }, files }, null, 1) + "\n");
console.log("manifest:", files.length, "berkas");
