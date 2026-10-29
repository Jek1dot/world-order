const $ = (id) => document.getElementById(id);
const start = new Date(Date.UTC(2026, 0, 1));
const game = {
  day: 0,
  running: false,
  speed: 1,
  selected: "IDN",
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
let dragStartPoint = null;
let dragStartViewBox = null;

mapCamera.style.cursor = 'grab';

mapCamera.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    isDraggingMap = true;
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

    mapCamera.setPointerCapture(event.pointerId);
    mapCamera.style.cursor = 'grabbing';
});

mapCamera.addEventListener('pointermove', (event) => {
    if (!isDraggingMap) return;

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

// ===== WORLD ORDER: PROVINCE SYSTEM =====

// Membaca data provinsi dari folder data
fetch("./data/provinces.geojson")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Gagal membaca GeoJSON: " + response.status);
    }

    return response.json();
  })
  .then((data) => {
    console.log("PROVINCE SYSTEM READY!");
    console.log("Jumlah provinsi:", data.features.length);
    // ===== DRAW PROVINCES ON MAP =====
const svg = document.getElementById("map");
const NS = "http://www.w3.org/2000/svg";

// Buat lapisan khusus provinsi
const provinceLayer = document.createElementNS(NS, "g");
provinceLayer.setAttribute("id", "province-layer");
svg.appendChild(provinceLayer);

// Gunakan proyeksi yang sama dengan peta dunia
function projectProvince(point) {
    const lon = point[0];
    const lat = point[1];

    return [
        ((lon + 180) * 1000) / 360,
        ((90 - lat) * 510) / 180
    ];
}

// Gambar setiap provinsi
data.features.forEach((feature) => {
    if (feature.geometry.type !== "Polygon") return;

    const rings = feature.geometry.coordinates;

    const d = rings.map((ring) => {
        return ring.map((point, index) => {
            const [x, y] = projectProvince(point);

            return `${index === 0 ? "M" : "L"}${x},${y}`;
        }).join(" ") + " Z";
    }).join(" ");

    const path = document.createElementNS(NS, "path");

    path.setAttribute("d", d);
    path.setAttribute("fill", "#facc15");
    path.setAttribute("fill-opacity", "0.75");
    path.setAttribute("stroke", "#111827");
    path.setAttribute("stroke-width", "0.15");
    path.setAttribute("class", "province");

    path.addEventListener("click", (event) => {
        event.stopPropagation();
        alert("Provinsi: " + feature.properties.name);
    });

    provinceLayer.appendChild(path);
});

console.log("Province layer rendered!");
  })
  .catch((error) => {
    console.error("PROVINCE SYSTEM ERROR:", error);
  });