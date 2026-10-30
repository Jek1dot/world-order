#!/usr/bin/env python3
"""
Membangun data/world-data.json dari data/provinces.geojson + Natural Earth populated places.

Isi world-data.json:
  provinces[id] = { c:[lon,lat] titik representatif, ar: luas km2, lm: id daratan,
                    adj:[id tetangga darat], sea:[[id, km], ...] jalur penyeberangan laut }
  countries[iso3] = { name, pop (juta), gdp (miliar USD), src, cap (id provinsi ibu kota),
                      capName, capLL, capApprox }

Tetangga darat = dua provinsi berbagi minimal satu sisi batas yang sama (bukan sekadar berdekatan).
"""
import json, math, collections, sys
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

SEA_MAX_DEG = 5.0     # jarak maksimum jalur penyeberangan laut (derajat, ~550 km)
SEA_PER_PAIR = 3      # maksimal jalur per pasangan daratan

prov = json.load(open("data/provinces.geojson", encoding="utf-8"))
F = prov["features"]
ids = [f["properties"]["id"] for f in F]
country_of = [f["properties"]["country"] for f in F]
names = [f["properties"]["name"] for f in F]

# ---------- 1. tetangga darat dari sisi batas bersama ----------
def rings(g):
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    for poly in polys:
        for r in poly:
            yield r

edges = collections.defaultdict(set)
for k, f in enumerate(F):
    for r in rings(f["geometry"]):
        pts = [(round(x * 100), round(y * 100)) for x, y in r]
        for a, b in zip(pts, pts[1:]):
            if a == b:
                continue
            edges[(a, b) if a < b else (b, a)].add(k)
adj = [set() for _ in F]
for s in edges.values():
    if len(s) > 1:
        s = sorted(s)
        for i in s:
            for j in s:
                if i != j:
                    adj[i].add(j)

# ---------- 2. daratan (komponen terhubung) ----------
parent = list(range(len(F)))
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x
for i, ns in enumerate(adj):
    for j in ns:
        parent[find(i)] = find(j)
lm_of = [find(i) for i in range(len(F))]
lm_index = {r: n for n, r in enumerate(sorted(set(lm_of)))}
lm_of = [lm_index[r] for r in lm_of]

# ---------- 3. geometri: titik representatif & luas ----------
geoms = [shape(f["geometry"]) for f in F]
rep, area_km2 = [], []
for g in geoms:
    parts = list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
    big = max(parts, key=lambda p: p.area)
    p = big.representative_point()
    rep.append((round(p.x, 3), round(p.y, 3)))
    area_km2.append(max(1, round(g.area * 111.32 * 110.57 * math.cos(math.radians(p.y)))))

# ---------- 4. jalur penyeberangan laut antar-daratan ----------
tree = STRtree(geoms)
cand = collections.defaultdict(list)
for i, g in enumerate(geoms):
    for j in tree.query(g, predicate="dwithin", distance=SEA_MAX_DEG):
        j = int(j)
        if j <= i or lm_of[i] == lm_of[j]:
            continue
        a, b = sorted((lm_of[i], lm_of[j]))
        cand[(a, b)].append((geoms[i].distance(geoms[j]), i, j))
sea = [dict() for _ in F]
n_sea = 0
for pair, lst in cand.items():
    lst.sort()
    used_i, used_j, taken = set(), set(), 0
    for d, i, j in lst:
        if i in used_i or j in used_j:
            continue
        used_i.add(i); used_j.add(j)
        km = round(d * 111.0)
        sea[i][j] = km; sea[j][i] = km
        n_sea += 1; taken += 1
        if taken >= SEA_PER_PAIR:
            break

# ---------- 5. ibu kota dari Natural Earth populated places ----------
places = json.load(open("ne_places.geojson", encoding="utf-8"))["features"]
ALIAS = {"SSD": "SDS"}
caps = {}
for f in places:
    p = f["properties"]
    if p.get("featurecla") == "Admin-0 capital":
        c = ALIAS.get(p["adm0_a3"], p["adm0_a3"])
        rank = (p.get("adm0cap") == 1, p.get("pop_max") or 0)   # utamakan penanda ibu kota resmi, lalu penduduk terbanyak
        if c not in caps or rank > caps[c][2]:
            caps[c] = (p["name"], f["geometry"]["coordinates"], rank)

# koreksi manual: Natural Earth memakai kota terbesar/legislatif untuk beberapa negara
CAP_OVERRIDE = {"TZA": ("Dodoma", [35.74, -6.17]), "CIV": ("Yamoussoukro", [-5.28, 6.82]), "ZAF": ("Pretoria", [28.19, -25.75])}
for c, (nm, ll) in CAP_OVERRIDE.items():
    caps[c] = (nm, ll, (True, 0))

by_country = collections.defaultdict(list)
for i, c in enumerate(country_of):
    by_country[c].append(i)

# ---------- 6. statistik negara (perkiraan kasar ~2024, populasi juta, PDB miliar USD) ----------
STATS = {
 "USA":(340,29000),"CHN":(1410,18700),"JPN":(124,4000),"DEU":(84,4650),"IND":(1450,3900),"GBR":(68,3600),
 "FRA":(68,3100),"ITA":(59,2300),"BRA":(216,2200),"CAN":(41,2240),"RUS":(144,2200),"KOR":(52,1870),
 "AUS":(27,1800),"MEX":(129,1850),"ESP":(48,1700),"IDN":(280,1400),"NLD":(18,1200),"SAU":(36,1100),
 "TUR":(85,1100),"CHE":(9,940),"POL":(37,810),"TWN":(23,780),"BEL":(12,630),"SWE":(10.5,600),
 "ARG":(46,640),"IRL":(5.3,550),"THA":(71,520),"AUT":(9,520),"ISR":(9.8,510),"ARE":(10,540),
 "NOR":(5.5,480),"SGP":(6,500),"VNM":(100,430),"MYS":(34,430),"PHL":(117,440),"BGD":(173,450),
 "EGY":(112,390),"ZAF":(61,400),"DNK":(6,410),"IRN":(89,400),"COL":(52,400),"CHL":(20,330),
 "PAK":(241,370),"FIN":(5.6,300),"ROU":(19,350),"CZE":(10.9,330),"PRT":(10.4,290),"NZL":(5.2,250),
 "PER":(34,270),"IRQ":(45,270),"GRC":(10.4,250),"KAZ":(20,260),"DZA":(46,260),"QAT":(3,220),
 "HUN":(9.6,210),"KWT":(4.3,160),"MAR":(37,150),"UKR":(38,180),"SVK":(5.4,130),"ECU":(18,120),
 "ETH":(126,160),"KEN":(55,110),"NGA":(223,250),"AGO":(37,110),"DOM":(11,120),"LKA":(22,90),
 "MMR":(54,65),"GTM":(18,110),"OMN":(5,105),"CRI":(5.2,90),"URY":(3.4,80),"UZB":(36,100),"BLR":(9.2,70),
 "TZA":(67,85),"GHA":(34,80),"CIV":(28,80),"COD":(102,70),"PAN":(4.5,85),"BGR":(6.5,100),"HRV":(3.9,85),
 "SRB":(6.6,80),"LTU":(2.9,80),"SVN":(2.1,70),"LUX":(0.66,90),"TUN":(12,50),"LBY":(7,50),"JOR":(11.5,50),
 "BOL":(12,46),"PRY":(6.9,43),"VEN":(28,100),"CMR":(28,50),"UGA":(49,50),"SDN":(48,35),"ZMB":(20,28),
 "SEN":(18,31),"NPL":(30,42),"KHM":(17,45),"LVA":(1.9,43),"EST":(1.4,42),"CYP":(1.3,33),"ISL":(0.38,33),
 "PRK":(26,18),"AFG":(42,17),"SYR":(23,15),"YEM":(34,20),"LBN":(5.5,18),"MNG":(3.4,20),"AZE":(10.3,75),
 "GEO":(3.7,32),"ARM":(3,26),"MOZ":(34,20),"ZWE":(16.6,35),"BWA":(2.5,20),"NAM":(2.6,13),"MDG":(31,16),
 "HTI":(11.7,20),"CUB":(11,110),"JAM":(2.8,20),"TTO":(1.4,29),"SLV":(6.3,35),"HND":(10.7,35),
 "NIC":(6.9,17),"BHR":(1.5,45),"MLT":(0.54,20),"MKD":(1.8,15),"ALB":(2.4,24),"BIH":(3.2,28),
 "MDA":(2.4,16),"LAO":(7.6,15),"PNG":(10.3,32),"FJI":(0.93,6),"TLS":(1.4,2),"BRN":(0.46,16),
 "SOM":(18,12),"SSD":(11,6),"MLI":(23,20),"BFA":(23,21),"NER":(27,17),"TCD":(18,13),"RWA":(14,15),
 "SDS":(11,6),"CAF":(5.5,2.5),"COG":(6,15),"GUY":(0.8,16),"SOL":(4.5,2.5),"SUR":(0.6,3.5),"ERI":(3.5,2.5),
 "MWI":(21,13),"BEN":(13.7,20),"LBR":(5.4,4.2),"SAH":(0.6,1),"SLE":(8.6,4),"TGO":(9,9),"BTN":(0.8,3),
 "GNB":(2.1,2),"LSO":(2.3,2.2),"GNQ":(1.7,12),"BDI":(13,3),"SLB":(0.74,1.7),"DJI":(1.1,3.9),"BLZ":(0.41,3),
 "NCL":(0.27,10),"SWZ":(1.2,4.8),"GRL":(0.057,3.2),"ATA":(0.001,0.1),"KOS":(1.8,10),"PSX":(5.4,18),
 "KGZ":(7,14),"TJK":(10,12),"TKM":(6.5,60),"GAB":(2.4,20),"GIN":(14,23),"MRT":(4.9,10),
}
GDP_PER_CAPITA_DEFAULT = 4.0   # miliar USD per juta jiwa (= $4.000 per kapita) untuk negara tanpa data
DENSITY_DEFAULT = 25           # jiwa per km2 untuk negara tanpa data

countries = {}
for c, members in by_country.items():
    cname = F[members[0]]["properties"]["country_name"]
    total_area = sum(area_km2[i] for i in members)
    if c in STATS:
        pop, gdp = STATS[c]; src = "perkiraan"
    else:
        pop = round(max(0.02, total_area * DENSITY_DEFAULT / 1e6), 2)
        gdp = round(max(0.1, pop * GDP_PER_CAPITA_DEFAULT), 1); src = "sintetis"
    entry = {"name": cname, "pop": pop, "gdp": gdp, "src": src}
    # ibu kota
    cap_idx, approx, cap_name, cap_ll = None, False, None, None
    if c in caps:
        cap_name, (lon, lat), _ = caps[c]
        pt = Point(lon, lat)
        hits = [i for i in members if geoms[i].contains(pt)]
        if hits:
            cap_idx = hits[0]
        else:
            d, cap_idx = min((geoms[i].distance(pt), i) for i in members)
            approx = d > 0.25
        cap_ll = [round(lon, 3), round(lat, 3)]
    else:
        cap_idx = max(members, key=lambda i: area_km2[i]); approx = True
        cap_name = names[cap_idx]; cap_ll = list(rep[cap_idx])
    entry.update({"cap": ids[cap_idx], "capName": cap_name, "capLL": cap_ll, "capApprox": approx})
    countries[c] = entry

# ---------- 7. tulis ----------
out = {
  "meta": {"version": 1, "source": "Natural Earth 10m Admin-1 & Populated Places (domain publik); statistik negara = perkiraan kasar/sintetis"},
  "provinces": {},
  "countries": countries,
}
for i, pid in enumerate(ids):
    out["provinces"][pid] = {
        "c": list(rep[i]), "ar": area_km2[i], "lm": lm_of[i],
        "adj": sorted(ids[j] for j in adj[i]),
        "sea": sorted([ids[j], km] for j, km in sea[i].items()),
    }
json.dump(out, open("data/world-data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

print("provinsi:", len(ids), "| daratan:", len(set(lm_of)), "| jalur laut:", n_sea)
print("negara:", len(countries), "| ibu kota perkiraan:", sum(1 for v in countries.values() if v["capApprox"]),
      "| statistik sintetis:", sum(1 for v in countries.values() if v["src"] == "sintetis"))
