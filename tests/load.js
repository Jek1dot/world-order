// Memuat semua modul simulasi di Node (tanpa DOM) dan data dunia asli.
const fs = require("fs"), path = require("path");
global.window = undefined;
const root = path.join(__dirname, "..");
for (const f of ["core", "world", "diplomacy", "pathfinding", "supply", "state", "economy", "military", "country", "war", "ai", "sim", "save"])
  require(path.join(root, "js", f + ".js"));
WO.World.init(JSON.parse(fs.readFileSync(path.join(root, "data/provinces.geojson"))), JSON.parse(fs.readFileSync(path.join(root, "data/world-data.json"))));
module.exports = WO;
