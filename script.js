const $ = (id) => document.getElementById(id);
const start = new Date(Date.UTC(2026, 0, 1));
const game = {
  day: 0,
  running: false,
  speed: 1,
  selected: "IDN",
  selectedProvince: null,
  player: null,
  countries: {},
};
const seed = {
  IDN: {
    name: "Indonesia",
    flag: "🇮🇩",
    gdp: 1.4,
    population: 280,
    stability: 70,
    industry: 20,
    budget: 100,
  },
  USA: {
    name: "United States",
    flag: "🇺🇸",
    gdp: 29,
    population: 340,
    stability: 65,
    industry: 120,
    budget: 500,
  },
  CHN: {
    name: "China",
    flag: "🇨🇳",
    gdp: 18,
    population: 1400,
    stability: 75,
    industry: 150,
    budget: 400,
  },
  RUS: {
    name: "Russia",
    flag: "🇷🇺",
    gdp: 2.2,
    population: 144,
    stability: 60,
    industry: 70,
    budget: 180,
  },
  IND: {
    name: "India",
    flag: "🇮🇳",
    gdp: 4,
    population: 1450,
    stability: 68,
    industry: 75,
    budget: 150,
  },
  BRA: {
    name: "Brazil",
    flag: "🇧🇷",
    gdp: 2.1,
    population: 215,
    stability: 66,
    industry: 45,
    budget: 110,
  },
  AUS: {
    name: "Australia",
    flag: "🇦🇺",
    gdp: 1.7,
    population: 27,
    stability: 85,
    industry: 35,
    budget: 130,
  },
};
const names = new Intl.DisplayNames(["id"], { type: "region" });
function getCountry(id) {
  if (!game.countries[id]) {
    const code = id.length === 2 ? id : undefined;
    game.countries[id] = {
      name: code ? names.of(code) : id,
      flag: "🌐",
      gdp: 1,
      population: 50,
      stability: 65,
      industry: 10,
      budget: 60,
      ...seed[id],
    };
  }
  return game.countries[id];
}
function show() {
  const c = getCountry(game.selected);
  $("country").textContent = c.name;
  $("flag").textContent = c.flag;
  $("gdp").textContent = "$" + c.gdp.toFixed(1) + " T";
  $("population").textContent = c.population + " juta";
  $("stability").textContent = c.stability + "%";
  $("industry").textContent = c.industry;
  $("budget").textContent = "$" + c.budget.toFixed(1) + " B";
  $("choose").textContent =
    game.player === game.selected
      ? "✓ Negara yang dipimpin"
      : "Pimpin negara ini";
  $("date").textContent = new Date(
    start.getTime() + game.day * 86400000,
  ).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
function select(id) {
  game.selected = id;
  document
    .querySelectorAll(".land")
    .forEach((el) => el.classList.toggle("selected", el.dataset.id === id));
  show();
  updateProvinceHighlight(id);
}
$("choose").onclick = () => {
  game.player = game.selected;
  $("notice").textContent =
    "Kamu sekarang memimpin " +
    getCountry(game.player).name +
    ". Bangun industri untuk mengembangkan negara.";
  show();
};
$("build").onclick = () => {
  if (!game.player) {
    $("notice").textContent = "Pilih “Pimpin negara ini” dahulu.";
    return;
  }
  const c = getCountry(game.player);
  if (c.budget < 10) {
    $("notice").textContent = "Anggaran tidak cukup.";
    return;
  }
  c.budget -= 10;
  c.industry++;
  $("notice").textContent = "Pabrik baru berhasil dibangun!";
  show();
};
$("pause").onclick = () => {
  game.running = !game.running;
  $("pause").textContent = game.running ? "⏸ Jeda" : "▶ Main";
};
$("speed").onclick = () => {
  game.speed = game.speed === 1 ? 2 : game.speed === 2 ? 5 : 1;
  $("speed").textContent = game.speed + "×";
};
$("save").onclick = () => {
  try {
    localStorage.setItem(
      "worldOrderV01",
      JSON.stringify({
        day: game.day,
        selected: game.selected,
        player: game.player,
        countries: game.countries,
      }),
    );
    $("notice").textContent = "Permainan tersimpan di browser ini.";
  } catch {
    $("notice").textContent = "Penyimpanan browser tidak tersedia.";
  }
};
$("load").onclick = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("worldOrderV01"));
    if (!saved) throw Error();
    Object.assign(game, saved, { running: false });
    $("pause").textContent = "▶ Main";
    select(game.selected);
    $("notice").textContent = "Permainan berhasil dimuat.";
  } catch {
    $("notice").textContent = "Belum ada data permainan tersimpan.";
  }
};
setInterval(() => {
  if (!game.running) return;
  game.day += game.speed;
  if (game.day % 30 < game.speed) {
    for (const c of Object.values(game.countries)) {
      c.budget = +(c.budget + c.industry * 0.05).toFixed(2);
    }
  }
  show();
}, 1000);
// Public Natural Earth-derived world GeoJSON via CDN. ISO_A3 codes are used as IDs.
fetch(
  "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
)
  .then((r) => {
    if (!r.ok) throw Error("HTTP " + r.status);
    return r.json();
  })
  .then((data) => {
    const svg = $("map");
    // ===== WORLD ORDER: MAP LAYERS =====

const NS = "http://www.w3.org/2000/svg";

const worldLayer = document.createElementNS(NS, "g");
worldLayer.setAttribute("id", "world-layer");

svg.appendChild(worldLayer);
    const coords = [];
    function project(p) {
      const lon = p[0],
        lat = Math.max(-85, Math.min(85, p[1]));
      return [((lon + 180) * 1000) / 360, ((90 - lat) * 510) / 180];
    }
    function ringToPath(r) {
      return (
        r
          .map((p, i) => {
            const q = project(p);
            return (i ? "L" : "M") + q[0].toFixed(1) + "," + q[1].toFixed(1);
          })
          .join("") + "Z"
      );
    }
    for (const f of data.features) {
      const geo = f.geometry;
      if (!geo) continue;
      const polygons =
        geo.type === "Polygon"
          ? [geo.coordinates]
          : geo.type === "MultiPolygon"
            ? geo.coordinates
            : [];
      const d = polygons.map((poly) => poly.map(ringToPath).join("")).join("");
      const id =
        f.properties["ISO3166-1-Alpha-3"] ||
        f.properties.ADM0_A3 ||
        f.properties.ISO_A3 ||
        f.properties.name;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill-rule", "evenodd");
      path.setAttribute("class", "land");
      path.dataset.id = id;
      path.addEventListener("click", () => {
        if (!seed[id]) {
          const c = getCountry(id);
          c.name = f.properties.ADMIN || f.properties.name || id;
        }
        select(id);
      });
      worldLayer.appendChild(path);
    }
    // ===== WORLD ORDER: WORLD WRAPPING LAYERS =====

// Salinan dunia di sebelah kiri
const worldLeft = worldLayer.cloneNode(true);
worldLeft.setAttribute("id", "world-left");
worldLeft.setAttribute("transform", "translate(-1000, 0)");

// Salinan dunia di sebelah kanan
const worldRight = worldLayer.cloneNode(true);
worldRight.setAttribute("id", "world-right");
worldRight.setAttribute("transform", "translate(1000, 0)");

// Masukkan kedua salinan ke SVG
svg.insertBefore(worldLeft, worldLayer);
svg.appendChild(worldRight);

// Pastikan lapisan provinsi selalu berada di atas peta dunia
const existingProvinceLayer = document.getElementById("province-root");
if (existingProvinceLayer) svg.appendChild(existingProvinceLayer);

// Klik negara pada salinan tetap memilih negara yang sama
for (const layer of [worldLeft, worldRight]) {
    layer.addEventListener("click", (event) => {
        const country = event.target.closest(".land");

        if (!country) return;

        const id = country.dataset.id;
        const original = worldLayer.querySelectorAll(".land");

        for (const path of original) {
            if (path.dataset.id === id) {
                path.dispatchEvent(new MouseEvent("click"));
                break;
            }
        }
    });
}
    select(game.selected);
    $("notice").textContent =
      "Peta siap. Pilih negara atau mulai sebagai Indonesia.";
  })
  .catch((error) => {
    console.error("WORLD ORDER MAP ERROR:", error);
    $("notice").textContent = "Error peta: " + error.message;
  });
show();

// ===== WORLD ORDER v0.2: MAP CAMERA =====

const mapCamera = document.getElementById('map');

document.getElementById('zoom-world').onclick = () => {
    mapCamera.setAttribute('viewBox', '0 0 1000 510');
};

document.getElementById('zoom-indonesia').onclick = () => {
    mapCamera.setAttribute('viewBox', '675 230 190 110');
};

document.getElementById('zoom-java').onclick = () => {
    mapCamera.setAttribute('viewBox', '777 264 48 28');
};

// ===== WORLD ORDER v0.2: DRAG MAP =====

let isDraggingMap = false;
let dragMoved = false; // true kalau mouse sudah bergeser cukup jauh (benar-benar drag)
let dragStartPoint = null;
let dragStartViewBox = null;

mapCamera.style.cursor = 'grab';

mapCamera.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    isDraggingMap = true;
    dragMoved = false;
    dragStartPoint = {
        x: event.clientX,
        y: event.clientY
    };

    dragStartViewBox = mapCamera.viewBox.baseVal;

    dragStartViewBox = {
        x: dragStartViewBox.x,
        y: dragStartViewBox.y,
        width: dragStartViewBox.width,
        height: dragStartViewBox.height
    };

    // setPointerCapture dipindah ke pointermove, supaya klik biasa tetap sampai ke negara/provinsi
});

mapCamera.addEventListener('pointermove', (event) => {
    if (!isDraggingMap) return;

    // Baru dianggap drag kalau mouse bergeser lebih dari 5 piksel
    if (!dragMoved) {
        const jarak = Math.hypot(
            event.clientX - dragStartPoint.x,
            event.clientY - dragStartPoint.y
        );
        if (jarak < 5) return;

        dragMoved = true;
        mapCamera.setPointerCapture(event.pointerId);
        mapCamera.style.cursor = 'grabbing';
    }

    const rect = mapCamera.getBoundingClientRect();

    const dx = (event.clientX - dragStartPoint.x)
        * dragStartViewBox.width / rect.width;

    const dy = (event.clientY - dragStartPoint.y)
        * dragStartViewBox.height / rect.height;

    const targetX = dragStartViewBox.x - dx;
    const targetY = dragStartViewBox.y - dy;

// ===== INFINITE HORIZONTAL WORLD WRAPPING =====

// ===== INFINITE HORIZONTAL WORLD WRAPPING =====
const newX = ((targetX % 1000) + 1000) % 1000;

// Kamera vertikal tetap dibatasi
const maxY = Math.max(0, 510 - dragStartViewBox.height);
const newY = Math.max(0, Math.min(maxY, targetY));

// Perbarui posisi kamera
mapCamera.setAttribute(
    'viewBox',
    `${newX} ${newY} ${dragStartViewBox.width} ${dragStartViewBox.height}`
);

// Perbarui titik awal drag saat melewati batas dunia
if (targetX < 0 || targetX >= 1000) {
    dragStartPoint = {
        x: event.clientX,
        y: event.clientY
    };

    dragStartViewBox = {
        x: newX,
        y: newY,
        width: dragStartViewBox.width,
        height: dragStartViewBox.height
    };
}
});

function stopMapDragging() {
    isDraggingMap = false;
    mapCamera.style.cursor = 'grab';
}

mapCamera.addEventListener('pointerup', stopMapDragging);
mapCamera.addEventListener('pointercancel', stopMapDragging);
mapCamera.addEventListener('lostpointercapture', stopMapDragging);

// ===== WORLD ORDER v0.2: MOUSE WHEEL ZOOM =====

mapCamera.addEventListener('wheel', (event) => {
    event.preventDefault();

    const svg = mapCamera;
    const vb = svg.viewBox.baseVal;

    // Posisi kursor dalam koordinat SVG
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const matrix = svg.getScreenCTM();
    if (!matrix) return;

    const cursor = point.matrixTransform(matrix.inverse());

    // Scroll atas memperbesar, scroll bawah memperkecil
    const zoomFactor = event.deltaY < 0 ? 0.85 : 1.15;

    const newWidth = Math.max(5, Math.min(1000, vb.width * zoomFactor));
    const newHeight = Math.max(2.55, Math.min(510, vb.height * zoomFactor));

    const scaleX = newWidth / vb.width;
    const scaleY = newHeight / vb.height;

    // Mempertahankan posisi geografis di bawah kursor
    const newX = cursor.x - (cursor.x - vb.x) * scaleX;
    const newY = cursor.y - (cursor.y - vb.y) * scaleY;

    svg.setAttribute(
        'viewBox',
        `${newX} ${newY} ${newWidth} ${newHeight}`
    );

}, { passive: false });

// ===== WORLD ORDER: PROVINCE SYSTEM v0.3 =====
// Data asli batas provinsi (Natural Earth, domain publik):
//   data/provinces.geojson -> ~4.500 provinsi di seluruh dunia
//   data/borders.geojson   -> garis batas antar negara (tebal, seperti di HOI4)

// Provinsi hanya digambar kalau peta sudah di-zoom (lebar viewBox <= angka ini).
// Angka lebih besar = provinsi tampil lebih awal, tapi peta jadi lebih berat.
const PROVINCE_LOD_WIDTH = 400;

// id provinsi -> { name, country, countryName }
const provinceInfo = new Map();

// Proyeksi sama persis dengan peta dunia: lon/lat -> koordinat SVG
function projectLonLat(lon, lat) {
    const y = Math.max(-85, Math.min(85, lat));
    return [((lon + 180) * 1000) / 360, ((90 - y) * 510) / 180];
}

// Satu ring/garis koordinat -> teks path SVG
function coordsToPathData(coords, closePath) {
    let d = "";
    for (let i = 0; i < coords.length; i++) {
        const [x, y] = projectLonLat(coords[i][0], coords[i][1]);
        d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2);
    }
    return closePath ? d + "Z" : d;
}

// Geometry GeoJSON (Polygon, MultiPolygon, LineString, MultiLineString) -> teks path SVG
function geometryToPathData(geometry) {
    if (!geometry) return "";
    const c = geometry.coordinates;

    if (geometry.type === "Polygon") {
        return c.map((ring) => coordsToPathData(ring, true)).join("");
    }
    if (geometry.type === "MultiPolygon") {
        return c
            .map((poly) => poly.map((ring) => coordsToPathData(ring, true)).join(""))
            .join("");
    }
    if (geometry.type === "LineString") {
        return coordsToPathData(c, false);
    }
    if (geometry.type === "MultiLineString") {
        return c.map((line) => coordsToPathData(line, false)).join("");
    }
    return "";
}

function hashString(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
        h = (h * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

// Setiap negara dapat warna sendiri. Sudut 137.5 derajat membuat warna
// negara yang berurutan tetap berbeda jauh satu sama lain.
function buildCountryColors(features) {
    const codes = [...new Set(features.map((f) => f.properties.country))].sort();
    const lightness = [38, 47, 31];
    const colors = {};

    codes.forEach((code, i) => {
        colors[code] = { hue: (i * 137.508) % 360, light: lightness[i % 3] };
    });

    return colors;
}

function escapeForSelector(text) {
    return window.CSS && CSS.escape
        ? CSS.escape(text)
        : String(text).replace(/["\\]/g, "\\$&");
}

// Dipanggil oleh select() setiap negara dipilih.
// Menyorot negara terpilih + provinsi terpilih lewat satu tag <style>
// (jauh lebih ringan daripada mengubah ribuan elemen satu per satu).
function updateProvinceHighlight(countryId) {
    // Kalau yang dipilih negara lain, lepaskan pilihan provinsi
    const current = game.selectedProvince && provinceInfo.get(game.selectedProvince);
    if (current && current.country !== countryId) {
        game.selectedProvince = null;
    }

    let style = document.getElementById("province-highlight-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "province-highlight-style";
        document.head.appendChild(style);
    }

    const rules = [];
    if (countryId) {
        rules.push(
            '.province[data-c="' + escapeForSelector(countryId) + '"]' +
            "{fill-opacity:1;stroke:#fde68a;}"
        );
    }
    if (game.selectedProvince) {
        rules.push(
            '.province[data-id="' + escapeForSelector(game.selectedProvince) + '"]' +
            "{fill:#fb923c;fill-opacity:1;stroke:#ffffff;stroke-width:1.8;}"
        );
    }
    style.textContent = rules.join("\n");

    // Panel kanan
    const info = game.selectedProvince && provinceInfo.get(game.selectedProvince);
    const nameBox = document.getElementById("province-name");
    const ownerBox = document.getElementById("province-owner");
    if (nameBox) nameBox.textContent = info ? info.name : "—";
    if (ownerBox) ownerBox.textContent = info ? info.countryName : "—";
}

function loadJson(url, required) {
    return fetch(url)
        .then((response) => {
            if (!response.ok) throw new Error(url + " -> HTTP " + response.status);
            return response.json();
        })
        .catch((error) => {
            if (required) throw error;
            console.warn("Data opsional gagal dimuat:", error.message);
            return null;
        });
}

Promise.all([
    loadJson("./data/provinces.geojson", true),
    loadJson("./data/borders.geojson", false),
])
    .then(([provinces, borders]) => {
        const svg = document.getElementById("map");
        const NS = "http://www.w3.org/2000/svg";
        const features = provinces.features.filter((f) => f.geometry);

        console.log("PROVINCE SYSTEM READY! Jumlah provinsi:", features.length);

        // ----- 1. Lapisan utama: provinsi + batas negara -----
        const mainLayer = document.createElementNS(NS, "g");
        mainLayer.setAttribute("id", "province-layer");

        const colors = buildCountryColors(features);
        const fragment = document.createDocumentFragment();

        for (const feature of features) {
            const p = feature.properties;
            const d = geometryToPathData(feature.geometry);
            if (!d) continue;

            provinceInfo.set(p.id, {
                name: p.name,
                country: p.country,
                countryName: p.country_name,
            });

            const color = colors[p.country];
            const light = color.light + (hashString(p.id) % 7) - 3;

            const path = document.createElementNS(NS, "path");
            path.setAttribute("d", d);
            path.setAttribute("class", "province");
            path.setAttribute("fill-rule", "evenodd");
            path.setAttribute("fill", "hsl(" + color.hue.toFixed(0) + ",42%," + light + "%)");
            path.dataset.id = p.id;
            path.dataset.c = p.country;
            fragment.appendChild(path);
        }
        mainLayer.appendChild(fragment);

        if (borders && borders.features) {
            const borderPath = document.createElementNS(NS, "path");
            borderPath.setAttribute("class", "country-borders");
            borderPath.setAttribute(
                "d",
                borders.features.map((f) => geometryToPathData(f.geometry)).join("")
            );
            mainLayer.appendChild(borderPath);
        }

        // ----- 2. Salinan kiri & kanan untuk world wrapping -----
        const leftLayer = mainLayer.cloneNode(true);
        leftLayer.setAttribute("id", "province-layer-left");
        leftLayer.setAttribute("transform", "translate(-1000, 0)");

        const rightLayer = mainLayer.cloneNode(true);
        rightLayer.setAttribute("id", "province-layer-right");
        rightLayer.setAttribute("transform", "translate(1000, 0)");

        const root = document.createElementNS(NS, "g");
        root.setAttribute("id", "province-root");
        root.appendChild(leftLayer);
        root.appendChild(mainLayer);
        root.appendChild(rightLayer);
        svg.appendChild(root);

        // ----- 3. Klik provinsi (satu listener untuk semua provinsi & salinannya) -----
        root.addEventListener("click", (event) => {
            const path = event.target.closest(".province");
            if (!path) return;
            event.stopPropagation();

            const id = path.dataset.id;
            const info = provinceInfo.get(id);
            if (!info) return;

            // Pilih provinsi, sekaligus negara pemiliknya
            game.selectedProvince = id;
            const country = getCountry(info.country);
            if (!seed[info.country] && country.name === info.country) {
                country.name = info.countryName;
            }
            select(info.country);

            $("notice").textContent =
                "Provinsi dipilih: " + info.name + " (" + info.countryName + ")";
        });

        // ----- 4. Tooltip nama provinsi saat mouse melintas -----
        const tooltip = document.getElementById("map-tooltip");

        svg.addEventListener("pointermove", (event) => {
            if (!tooltip) return;

            const path = event.target.closest ? event.target.closest(".province") : null;
            const info = path ? provinceInfo.get(path.dataset.id) : null;

            if (!info) {
                tooltip.style.display = "none";
                return;
            }

            const box = svg.parentElement.getBoundingClientRect();
            tooltip.textContent = info.name + " — " + info.countryName;
            tooltip.style.left = event.clientX - box.left + 14 + "px";
            tooltip.style.top = event.clientY - box.top + 14 + "px";
            tooltip.style.display = "block";
        });

        svg.addEventListener("pointerleave", () => {
            if (tooltip) tooltip.style.display = "none";
        });

        // ----- 5. Level of detail: provinsi hanya tampil saat peta di-zoom -----
        // Dipantau lewat perubahan atribut viewBox, jadi kode zoom/drag lama tidak perlu diubah.
        function updateProvinceVisibility() {
            const vb = (svg.getAttribute("viewBox") || "0 0 1000 510")
                .trim()
                .split(/\s+/)
                .map(Number);
            const x = vb[0];
            const width = vb[2];

            const zoomedIn = width <= PROVINCE_LOD_WIDTH;
            root.style.display = zoomedIn ? "" : "none";
            if (!zoomedIn) return;

            // Salinan kiri/kanan hanya dirender kalau kamera melewati tepi dunia
            leftLayer.style.display = x < 0 ? "" : "none";
            rightLayer.style.display = x + width > 1000 ? "" : "none";
        }

        new MutationObserver(updateProvinceVisibility).observe(svg, {
            attributes: true,
            attributeFilter: ["viewBox"],
        });
        updateProvinceVisibility();

        // Sinkronkan sorotan dengan negara yang sedang dipilih
        updateProvinceHighlight(game.selected);

        console.log("Province layer rendered!");
    })
    .catch((error) => {
        console.error("PROVINCE SYSTEM ERROR:", error);
        $("notice").textContent = "Error provinsi: " + error.message;
    });
