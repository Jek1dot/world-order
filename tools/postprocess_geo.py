#!/usr/bin/env python3
"""Pasca-proses hasil mapshaper: buang fitur tanpa geometri & gabungkan garis batas negara jadi satu MultiLineString."""
import json
prov = json.load(open("out/provinces_10.json", encoding="utf-8"))
before = len(prov["features"])
prov["features"] = [f for f in prov["features"] if f["geometry"]]
json.dump(prov, open("data/provinces.geojson", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
b = json.load(open("out/borders_10.json"))
lines = []
for g in b["geometries"]:
    if g["type"] == "LineString": lines.append(g["coordinates"])
    elif g["type"] == "MultiLineString": lines.extend(g["coordinates"])
out = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"name": "country-borders"},
       "geometry": {"type": "MultiLineString", "coordinates": lines}}]}
json.dump(out, open("data/borders.geojson", "w", encoding="utf-8"), separators=(",", ":"))
print("provinsi:", len(prov["features"]), "(dibuang", before - len(prov["features"]), "tanpa geometri) | garis batas:", len(lines))
