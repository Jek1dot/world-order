#!/usr/bin/env bash
# Membangun ulang seluruh folder data/ dari Natural Earth (domain publik).
# Butuh: curl, Node.js (npx mapshaper), Python 3 + shapely  ->  pip install shapely
# Jalankan dari akar proyek:  bash tools/build_data.sh
set -euo pipefail
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
mkdir -p data out
[ -f ne_admin1.geojson ] || curl -L -o ne_admin1.geojson "$NE/ne_10m_admin_1_states_provinces.geojson"
[ -f ne_places.geojson ] || curl -L -o ne_places.geojson "$NE/ne_10m_populated_places_simple.geojson"

# 1. provinsi (disederhanakan; batas antar-provinsi tetap menyatu karena topologi dijaga)
npx mapshaper ne_admin1.geojson \
  -each 'id=adm1_code, country=adm0_a3, country_name=admin, name=(name || gn_name || woe_name || adm1_code)' \
  -filter-fields id,name,country,country_name \
  -filter-slivers min-area=0.00002 \
  -simplify 10% keep-shapes \
  -o out/provinces_10.json format=geojson precision=0.01

# 2. garis batas antar-negara dari topologi yang sama
npx mapshaper ne_admin1.geojson \
  -each 'country=adm0_a3' -filter-fields country \
  -filter-slivers min-area=0.00002 -simplify 10% keep-shapes \
  -innerlines where='A.country != B.country' \
  -o out/borders_10.json format=geojson precision=0.01

python3 tools/postprocess_geo.py            # -> data/provinces.geojson, data/borders.geojson
python3 tools/build_world_data.py           # -> data/world-data.json (tetangga, daratan, jalur laut, ibu kota, statistik)

# 3. lapisan negara untuk zoom-out (provinsi digabung per negara)
npx mapshaper data/provinces.geojson \
  -dissolve country copy-fields=country_name \
  -each 'id=country, name=country_name' -filter-fields id,name \
  -simplify 40% keep-shapes \
  -o data/countries.geojson format=geojson precision=0.01
echo "Selesai. Jalankan 'npm test' untuk memverifikasi."
