// ===== WORLD ORDER v0.4 — MAIN: boot, game loop, save/load, skenario =====
(function (root) {
  "use strict";
  const WO = root.WO, W = WO.World, C = WO.C, MV = WO.MapView, UI = WO.UI;
  const $ = (id) => document.getElementById(id);

  const game = (WO.Game = root.game = {
    state: null, paused: true, speed: 1, autoPause: true, acc: 0, javaProvince: null, timer: null,

    pause() { game.paused = true; game.syncControls(); },
    resume() {
      if (!game.state.player) { UI.toast("Pilih negara yang akan dipimpin dulu.", "warn"); return; }
      game.paused = false; game.syncControls();
    },
    togglePause() { game.paused ? game.resume() : game.pause(); },
    setSpeed(n) { game.speed = n; game.syncControls(); },
    syncControls() {
      $("btn-pause").textContent = game.paused ? "▶" : "⏸";
      document.querySelectorAll(".speed-btn").forEach((b) => b.classList.toggle("active", +b.dataset.speed === game.speed));
    },

    // satu "frame" loop: 1× = 1 hari game per detik. Saat pause TIDAK ada tick sama sekali.
    frame() {
      const st = game.state;
      if (game.paused || !st || !st.player) return;
      game.acc += game.speed * 0.1;
      let n = 0;
      while (game.acc >= 1 && n < 12) { WO.Sim.tick(st); game.acc -= 1; n++; }
      if (n) UI.refresh(false);
    },

    install(state) {
      game.state = state; game.acc = 0;
      UI.reset(); MV.recolorAll(); UI.setTab("country"); UI.refresh(true);
      $("tab-mission").hidden = !(state.flags && state.flags.scenario !== undefined);
    },
    newGame(seed) {
      game.pause();
      game.install(WO.State.newGame({ seed: seed || (Date.now() & 0x7fffffff) }));
      UI.toast("Permainan baru dimulai.", "good");
    },
    onPlayerChanged() {
      const st = game.state;
      if (st.player) UI.viewCountrySet(st.player);
      UI.refresh(true);
    },

    save() {
      WO.flag(game.state, "saved");
      const r = WO.Save.toLocal(game.state);
      UI.toast(r.ok ? "Tersimpan (" + Math.round(r.bytes / 1024) + " KB)." : "Gagal menyimpan: " + r.error, r.ok ? "good" : "bad");
    },
    load() {
      const r = WO.Save.fromLocal();
      if (!r.ok) { UI.toast(r.error, "bad"); UI.modal("<h2>Tidak bisa memuat</h2><p>" + UI.esc(r.error) + "</p>"); return; }
      game.pause(); game.install(r.state); MV.zoomPreset("world");
      UI.toast("Permainan dimuat (" + WO.dateString(r.state.day) + ").", "good");
    },

    startScenario() {
      game.pause();
      const st = WO.State.newGame({ seed: 20260101 });
      st.flags.scenario = 0;
      WO.State.setPlayer(st, "IDN");
      game.install(st);
      const cap = st.countries.IDN.capital;
      MV.zoomPreset("java"); UI.selectProvince(cap, false); UI.setTab("mission");
      $("modal").hidden = true;
      UI.modal("<h2>Skenario latihan</h2><p>Kamu memimpin <b>Indonesia</b>. Targetmu: menaklukkan <b>Timor-Leste</b> lewat jalur yang valid — bangun industri, produksi peralatan, rekrut divisi, kirim lewat darat dan penyeberangan laut domestik ke Nusa Tenggara Timur, lalu perang.</p>" +
        "<p>Ikuti daftar di tab <b>Misi</b>. Tekan <b>Spasi</b> atau ▶ untuk menjalankan waktu. Klik kanan provinsi = perintah untuk divisi terpilih.</p>", [{ label: "Mulai", cls: "primary", fn: () => game.resume() }, { label: "Jeda dulu" }]);
    },
  });

  function welcome() {
    UI.modal("<h2>World Order v0.4</h2><p>Grand strategy sandbox: provinsi nyata, kepemilikan vs penguasa, ibu kota, divisi, peperangan, kapitulasi, dan damai.</p>" +
      "<p>Klik negara di peta lalu <b>Pimpin negara ini</b>, atau coba skenario latihan.</p>",
      [{ label: "Skenario latihan: Indonesia vs Timor-Leste", cls: "primary", fn: () => game.startScenario() }, { label: "Main bebas" }]);
  }
  function help() {
    UI.modal("<h2>Kontrol</h2><p><b>Peta:</b> drag = geser, scroll = zoom, klik = pilih. Provinsi tampil saat di-zoom.<br><b>Waktu:</b> Spasi = pause, tombol 1×–10×.<br><b>Militer:</b> klik penanda unit atau pilih di tab Militer; klik kanan provinsi tujuan = gerak/serang; Esc = batal.<br><b>Penting:</b> pendudukan mengubah <i>penguasa</i>, bukan <i>pemilik</i>; pemilik hanya berubah lewat perjanjian damai.</p>" +
      '<p class="note">Data: Natural Earth (domain publik). Statistik ekonomi, terrain, populasi provinsi, dan sumber daya bersifat perkiraan/sintetis.</p>');
  }

  async function boot() {
    const status = $("loading-text");
    try {
      const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " → HTTP " + r.status); return r.json(); });
      status.textContent = "Mengunduh data dunia…";
      const [prov, wd, borders, countries] = await Promise.all([get("data/provinces.geojson"), get("data/world-data.json"), get("data/borders.geojson"), get("data/countries.geojson")]);
      status.textContent = "Menyiapkan " + prov.features.length + " provinsi…";
      await new Promise((r) => setTimeout(r, 20));
      W.init(prov, wd);
      game.javaProvince = Object.values(W.provinces).find((p) => p.name === "Jawa Barat" && p.country === "IDN").id;
      game.state = WO.State.newGame({ seed: 20260101 });
      MV.init($("map"), UI.mapHooks());
      MV.build(prov, borders, countries);
      UI.init(game);
      MV.recolorAll(); UI.refresh(true); game.syncControls();
      MV.zoomPreset("world");
      $("loading").hidden = true;
      welcome();
    } catch (e) {
      $("loading").classList.add("error");
      $("loading").innerHTML = "<div><b>Gagal memuat data</b><br>" + UI.esc(e.message) + "<br><br>Jalankan lewat server lokal:<br><code>python -m http.server 8000</code> lalu buka <code>http://localhost:8000</code></div>";
      console.error(e);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("btn-pause").onclick = () => game.togglePause();
    document.querySelectorAll(".speed-btn").forEach((b) => (b.onclick = () => game.setSpeed(+b.dataset.speed)));
    $("btn-save").onclick = () => game.save();
    $("btn-load").onclick = () => game.load();
    $("btn-new").onclick = () => UI.modal("<h2>Permainan baru?</h2><p>Progres yang belum disimpan akan hilang.</p>", [{ label: "Batal" }, { label: "Mulai baru", cls: "danger", fn: () => game.newGame() }]);
    $("btn-help").onclick = help;
    game.timer = setInterval(() => game.frame(), 100);
    boot();
  });
})(typeof window !== "undefined" ? window : globalThis);
