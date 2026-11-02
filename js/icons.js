// ===== WORLD ORDER — IKON SVG ORISINAL (24×24, garis) =====
// Dibuat sendiri; bukan salinan ikon/sprite Paradox atau pihak lain.
(function (root) {
  "use strict";
  const WO = root.WO;
  const P = {
    star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    flag: '<path d="M6 3v18M6 4h11l-2.5 4L17 12H6"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    coins: '<ellipse cx="12" cy="7" rx="6" ry="3"/><path d="M6 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
    trade: '<path d="M4 9h14l-3-3M20 15H6l3 3"/>',
    ore: '<path d="M4 17l3-8 5-4 6 3 2 9zM9 9l3 5 5-2"/>',
    factory: '<path d="M3 21V11l6 4v-4l6 4V6h3v15zM8 21v-3M13 21v-3"/>',
    crate: '<path d="M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9"/>',
    road: '<path d="M8 3L5 21M16 3l3 18M12 4v3M12 10v4M12 17v3"/>',
    crane: '<path d="M6 21V4h11M17 4v6M3 8h8M17 10v3"/><circle cx="17" cy="15" r="1.6"/>',
    handshake: '<path d="M3 12l4-4 4 2 3-2 4 3 3-1M7 16l4 3 3-3M10 13l3 3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3 3.5 15 0 18M12 3c-3.5 3-3.5 15 0 18"/>',
    dove: '<path d="M3 13c3-1 5-4 8-5 3-1 6 0 9 4-3-1-4 0-5 2l1 5c-3-1-4-3-5-5-2 1-5 1-8-1z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    soldier: '<circle cx="12" cy="7" r="3"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7M8 4h8"/>',
    tank: '<path d="M3 16h18v3H3zM6 16v-3h9l3 3M14 13l7-2"/><circle cx="7" cy="19" r=".8"/><circle cx="12" cy="19" r=".8"/><circle cx="17" cy="19" r=".8"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    scale: '<path d="M12 4v16M5 8h14M5 8l-3 7h6zM19 8l-3 7h6zM8 20h8"/>',
    tower: '<path d="M8 21V9l4-5 4 5v12M6 21h12M10 13h4"/>',
    scroll: '<path d="M7 4h11a2 2 0 012 2v12a2 2 0 01-2 2H8M7 4a2 2 0 00-2 2v10a2 2 0 002 2h1M10 9h7M10 13h7"/>',
    book: '<path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h10"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    truck: '<path d="M2 7h11v9H2zM13 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/>',
    command: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7l1.6 3.4 3.7.4-2.8 2.5.8 3.7L12 15l-3.3 2 .8-3.7-2.8-2.5 3.7-.4z"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    swords: '<path d="M4 4l9 9M20 4l-9 9M13 13l-2.5 2.5M11 13l2.5 2.5M4 20l4-4M20 20l-4-4"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 00-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    bell: '<path d="M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4"/>',
    news: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M7 8h6M7 12h10M7 16h10M16 8h1"/>',
    flagmission: '<path d="M5 21V3M5 4h13l-3 4 3 4H5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  };
  const svg = (name, size) => '<svg class="ic" viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.star) + "</svg>";
  WO.Icons = { paths: P, svg };
})(typeof window !== "undefined" ? window : globalThis);
