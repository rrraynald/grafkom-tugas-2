// =====================================================================
// texture.js — Loader texture + texture prosedural (canvas 2D)
// ---------------------------------------------------------------------
// Pengembangan dari "Membuat Texture Checkerboard" & "Challenge A: Image
// Texture" di Praktikum 5:
//   1. Texture PROSEDURAL digambar dengan canvas 2D (panel fasad,
//      paving herringbone, tulisan "TOWER 1 ITS", totem F-SCIENTICS, dll)
//      → selalu tersedia walaupun file gambar gagal dimuat.
//   2. Texture GAMBAR (crop foto asli survey) dimuat dengan Image.onload,
//      lalu MENGGANTI isi texture prosedural (sama seperti praktikum).
//
// Pengaturan yang diterapkan ke semua texture:
//   - UNPACK_FLIP_Y_WEBGL  : gambar dibalik agar v=0 ada di bawah
//   - generateMipmap       : versi kecil texture untuk objek jauh
//   - Filtering (T)        : MIPMAP (LINEAR_MIPMAP_LINEAR) / LINEAR / NEAREST
//   - Wrapping  (G)        : REPEAT / CLAMP_TO_EDGE / MIRRORED_REPEAT
// =====================================================================

import { createRandom } from "./math3d.js";

export const FILTER_MODES = ["MIPMAP", "LINEAR", "NEAREST"];
export const WRAP_MODES = ["REPEAT", "CLAMP_TO_EDGE", "MIRRORED_REPEAT"];

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

function nextPowerOf2(value) {
  return Math.pow(2, Math.ceil(Math.log2(value)));
}

export class TextureManager {
  constructor(gl) {
    this.gl = gl;
    this.textures = new Map();   // nama → WebGLTexture
    this.filterIndex = 0;
    this.wrapIndex = 0;

    // Anisotropic filtering: paving yang dilihat miring tetap tajam
    this.anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
  }

  // ------------------------------------------------------------------
  // Upload sumber gambar/canvas ke texture (sama seperti praktikum)
  // ------------------------------------------------------------------
  upload(texture, source) {
    const gl = this.gl;

    // NPOT: WebGL2 sebenarnya mendukung mipmap untuk ukuran bukan
    // pangkat 2, tetapi kita tetap ubah ke pangkat 2 agar aman dan
    // konsisten (di WebGL1 ini WAJIB).
    if (!isPowerOf2(source.width) || !isPowerOf2(source.height)) {
      const resized = document.createElement("canvas");
      resized.width = Math.min(nextPowerOf2(source.width), 2048);
      resized.height = Math.min(nextPowerOf2(source.height), 2048);
      resized.getContext("2d").drawImage(source, 0, 0, resized.width, resized.height);
      source = resized;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);

    this.applySettings(texture);
  }

  // ------------------------------------------------------------------
  // Texture prosedural: drawFn(ctx, width, height, random)
  // ------------------------------------------------------------------
  fromCanvas(name, width, height, drawFn, seed = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    drawFn(ctx, width, height, createRandom(seed));

    const texture = this.gl.createTexture();
    this.upload(texture, canvas);
    this.textures.set(name, texture);

    return texture;
  }

  // ------------------------------------------------------------------
  // Texture gambar (crop foto asli). Texture prosedural `name` dipakai
  // dulu; setelah gambar selesai dimuat, isinya diganti.
  // ------------------------------------------------------------------
  loadImage(name, url) {
    const texture = this.textures.get(name);

    if (!texture) {
      console.warn(`Texture prosedural "${name}" belum ada.`);
      return;
    }

    const image = new Image();

    image.onload = () => {
      this.upload(texture, image);
    };

    image.onerror = () => {
      // Tidak fatal: texture prosedural tetap dipakai
      console.warn(`Gagal memuat ${url}, memakai texture prosedural.`);
    };

    image.src = url;
  }

  get(name) {
    return this.textures.get(name) || null;
  }

  // ------------------------------------------------------------------
  // Filtering & wrapping (tombol T dan G, seperti Praktikum 5)
  // ------------------------------------------------------------------
  applySettings(texture) {
    const gl = this.gl;
    const filter = FILTER_MODES[this.filterIndex];
    const wrapName = WRAP_MODES[this.wrapIndex];

    gl.bindTexture(gl.TEXTURE_2D, texture);

    if (filter === "NEAREST") {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else if (filter === "LINEAR") {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      // Trilinear: interpolasi di dalam & antar level mipmap
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    let wrap = gl.REPEAT;

    if (wrapName === "CLAMP_TO_EDGE") wrap = gl.CLAMP_TO_EDGE;
    if (wrapName === "MIRRORED_REPEAT") wrap = gl.MIRRORED_REPEAT;

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

    if (this.anisotropy) {
      const max = gl.getParameter(this.anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, this.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
        filter === "MIPMAP" ? Math.min(8, max) : 1);
    }
  }

  applyAll() {
    for (const texture of this.textures.values()) {
      this.applySettings(texture);
    }
  }

  nextFilter() {
    this.filterIndex = (this.filterIndex + 1) % FILTER_MODES.length;
    this.applyAll();
    return FILTER_MODES[this.filterIndex];
  }

  nextWrap() {
    this.wrapIndex = (this.wrapIndex + 1) % WRAP_MODES.length;
    this.applyAll();
    return WRAP_MODES[this.wrapIndex];
  }

  get filterName() {
    return FILTER_MODES[this.filterIndex];
  }

  get wrapName() {
    return WRAP_MODES[this.wrapIndex];
  }
}

// =====================================================================
// HELPER GAMBAR
// =====================================================================

// Variasi warna kecil (noise) agar permukaan tidak terlihat datar/plastik
function noise(ctx, w, h, random, amount, count, size = 2) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor((random() - 0.5) * amount);
    ctx.fillStyle = v > 0
      ? `rgba(255,255,255,${v / 255})`
      : `rgba(0,0,0,${-v / 255})`;
    ctx.fillRect(random() * w, random() * h, size, size);
  }
}

function rgb(c) {
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
}

// Teks yang otomatis mengecil bila terlalu lebar
function fitText(ctx, text, x, y, maxWidth, fontSize, weight = "bold", family = "Arial, sans-serif") {
  let size = fontSize;
  ctx.font = `${weight} ${size}px ${family}`;

  while (ctx.measureText(text).width > maxWidth && size > 6) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${family}`;
  }

  ctx.fillText(text, x, y);
}

// =====================================================================
// SEMUA TEXTURE PROSEDURAL SCENE
// =====================================================================
export function createAllTextures(tm) {
  // ---------------- Checkerboard (warisan Praktikum 5) ----------------
  tm.fromCanvas("checker", 64, 64, (ctx) => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#f8fafc" : "#0ea5e9";
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
  });

  // ---------------- Fasad panel Tower 1 -------------------------------
  // 1 tile texture = 4 kolom panel × 4 lantai (2 baris panel per lantai)
  // → di building.js, tile UV = [4 × lebarKolom, 4 × tinggiLantai].
  // Warna mendekati putih; warna akhir diatur oleh material.color.
  const FACADE_COLS = 4, FACADE_FLOORS = 4, ROWS_PER_FLOOR = 2;

  tm.fromCanvas("facade", 512, 1024, (ctx, w, h, random) => {
    const colW = w / FACADE_COLS;
    const rowH = h / (FACADE_FLOORS * ROWS_PER_FLOOR);

    for (let r = 0; r < FACADE_FLOORS * ROWS_PER_FLOOR; r++) {
      for (let c = 0; c < FACADE_COLS; c++) {
        // Tiap panel sedikit beda terang (efek panel ACP/kaca reflektif)
        const base = 222 + Math.floor((random() - 0.5) * 18);
        const grad = ctx.createLinearGradient(0, r * rowH, 0, (r + 1) * rowH);
        grad.addColorStop(0, `rgb(${base + 8},${base + 10},${base + 12})`);
        grad.addColorStop(1, `rgb(${base - 10},${base - 8},${base - 6})`);
        ctx.fillStyle = grad;
        ctx.fillRect(c * colW, r * rowH, colW, rowH);
      }
    }

    noise(ctx, w, h, random, 14, 5000, 2);

    // Garis sambungan panel (joint) abu gelap
    ctx.fillStyle = "rgb(120,124,130)";

    for (let c = 0; c <= FACADE_COLS; c++) {
      ctx.fillRect(c * colW - 3, 0, 6, h);
    }

    for (let r = 0; r <= FACADE_FLOORS * ROWS_PER_FLOOR; r++) {
      // Sambungan antar lantai sedikit lebih tebal
      const thick = r % ROWS_PER_FLOOR === 0 ? 7 : 4;
      ctx.fillRect(0, r * rowH - thick / 2, w, thick);
    }

    // Baut/titik kecil di sudut panel (detail halus)
    ctx.fillStyle = "rgba(90,95,100,0.6)";

    for (let r = 0; r < FACADE_FLOORS * ROWS_PER_FLOOR; r++) {
      for (let c = 0; c < FACADE_COLS; c++) {
        ctx.fillRect(c * colW + 10, r * rowH + 10, 3, 3);
        ctx.fillRect((c + 1) * colW - 13, r * rowH + 10, 3, 3);
      }
    }
  }, 11);

  // Emissive fasad (MALAM): sebagian panel bercahaya kuning seperti
  // ruangan yang lampunya menyala. Hitam = tidak menyala.
  // ASUMSI: tidak ada data malam dari survey.
  tm.fromCanvas("facadeEmissive", 512, 1024, (ctx, w, h, random) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const colW = w / FACADE_COLS;
    const floorH = h / FACADE_FLOORS;

    for (let f = 0; f < FACADE_FLOORS; f++) {
      for (let c = 0; c < FACADE_COLS; c++) {
        if (random() < 0.45) {
          const warm = 150 + Math.floor(random() * 90);
          ctx.fillStyle = `rgb(${warm},${Math.floor(warm * 0.82)},${Math.floor(warm * 0.5)})`;
          // Hanya baris bawah tiap lantai (setinggi jendela)
          ctx.fillRect(c * colW + 8, f * floorH + floorH * 0.5 + 6, colW - 16, floorH * 0.5 - 12);
        }
      }
    }
  }, 23);

  // ---------------- Strip kaca biru ----------------------------------
  // 1 tile = 1 lantai; mullion horizontal tiap setengah lantai.
  tm.fromCanvas("glass", 128, 256, (ctx, w, h, random) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#9fc2ea");
    grad.addColorStop(0.5, "#6f9ad2");
    grad.addColorStop(1, "#86aee0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    noise(ctx, w, h, random, 10, 600, 2);

    // Bingkai aluminium
    ctx.fillStyle = "#c9ced4";
    ctx.fillRect(0, 0, 8, h);
    ctx.fillRect(w - 8, 0, 8, h);
    ctx.fillRect(0, 0, w, 7);
    ctx.fillRect(0, h / 2 - 3, w, 6);
  }, 5);

  // ---------------- Pita atap "TOWER 1 ITS" --------------------------
  // CATATAN: lambang dibuat sebagai emblem bulat SEDERHANA (bukan
  // reproduksi logo resmi) — cukup untuk memberi kesan papan nama.
  function drawCrownSign(ctx, w, h, glow) {
    ctx.fillStyle = glow ? "#000" : "#25282c";
    ctx.fillRect(0, 0, w, h);

    if (!glow) {
      // Sambungan panel pita atap
      ctx.fillStyle = "#1c1e21";

      for (let x = 0; x < w; x += 64) {
        ctx.fillRect(x, 0, 2, h);
      }
    }

    // Emblem bulat: cincin biru + isi kuning (posisi mirip foto)
    const cx = w * 0.555, cy = h * 0.5, r = h * 0.3;
    ctx.fillStyle = glow ? "#3b6fd6" : "#2d5fb8";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = glow ? "#ffe066" : "#f2c230";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Tulisan putih
    ctx.fillStyle = glow ? "#fff6dc" : "#f2f4f6";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    fitText(ctx, "TOWER 1 ITS", cx + r * 1.4, cy + 2, w * 0.38, Math.floor(h * 0.5), "bold");
  }

  tm.fromCanvas("crownSign", 1024, 128, (ctx, w, h) => drawCrownSign(ctx, w, h, false));
  tm.fromCanvas("crownSignGlow", 1024, 128, (ctx, w, h) => drawCrownSign(ctx, w, h, true));

  // ---------------- Tulisan "AKTUARIA" di louver bawah ----------------
  tm.fromCanvas("aktuariaSign", 512, 64, (ctx, w, h) => {
    ctx.fillStyle = "#e9e9e4";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#5b6066";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, "AKTUARIA", w / 2, h / 2 + 2, w * 0.9, 44, "bold");
  });

  // ---------------- Totem F-SCIENTICS (depan taman) -------------------
  // Isi tulisan dari foto zoom-in-out: daftar departemen FSAD.
  tm.fromCanvas("totem", 256, 1024, (ctx, w, h) => {
    // Bagian atas putih
    ctx.fillStyle = "#f4f6f5";
    ctx.fillRect(0, 0, w, h * 0.3);

    // Kepala kecil: nama fakultas
    ctx.fillStyle = "#5f6b72";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fitText(ctx, "FAKULTAS", 26, h * 0.05, w * 0.7, 18, "normal");
    fitText(ctx, "SAINS DAN", 26, h * 0.075, w * 0.7, 18, "normal");
    fitText(ctx, "ANALITIKA DATA", 26, h * 0.1, w * 0.7, 18, "normal");

    // Tulisan utama
    ctx.fillStyle = "#26404c";
    ctx.textAlign = "center";
    fitText(ctx, "F-SCIENTICS", w / 2, h * 0.24, w * 0.86, 34, "bold");

    // Garis hijau di tepi & batas
    ctx.fillStyle = "#3fae6a";
    ctx.fillRect(0, h * 0.3 - 6, w, 6);
    ctx.fillRect(0, 0, 10, h);

    // Bagian bawah biru
    ctx.fillStyle = "#1f5aa8";
    ctx.fillRect(10, h * 0.3, w - 10, h * 0.7);

    // Daftar departemen + panah
    const departments = [
      ["Fisika", "←"], ["Kimia", "←"], ["Matematika", "↑"],
      ["Statistika", "↑"], ["Biologi", "→"], ["Aktuaria", "↑"]
    ];
    ctx.fillStyle = "#eef4ff";
    ctx.textAlign = "left";

    departments.forEach(([name, arrow], i) => {
      const y = h * 0.36 + i * h * 0.048;
      fitText(ctx, name, 30, y, w * 0.6, 22, "normal");
      ctx.textAlign = "right";
      fitText(ctx, arrow, w - 26, y, 40, 24, "bold");
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(30, y + h * 0.022, w - 56, 1);
      ctx.fillStyle = "#eef4ff";
    });
  });

  // ---------------- Dinding planter (granit gelap) --------------------
  tm.fromCanvas("planterWall", 256, 128, (ctx, w, h, random) => {
    ctx.fillStyle = "#2b2e30";
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, random, 40, 3000, 2);
    ctx.fillStyle = "#1a1c1d";

    for (let x = 0; x <= w; x += 64) ctx.fillRect(x - 1, 0, 2, h);
    for (let y = 0; y <= h; y += 64) ctx.fillRect(0, y - 1, w, 2);
  }, 7);

  // ---------------- Paving herringbone (blok 20×10 cm) ----------------
  // Pola herringbone 90°: strip "tangga" diagonal berisi bata horizontal
  // (2×1) & vertikal (1×2) yang diulang tiap 4 unit ke atas.
  // 1 tile = 16×16 unit = 1.6 m × 1.6 m (dipakai uvScale di environment).
  tm.fromCanvas("paving", 512, 512, (ctx, w, h, random) => {
    const units = 16;
    const u = w / units;
    ctx.fillStyle = "#5d6064"; // warna nat
    ctx.fillRect(0, 0, w, h);

    function brick(x, y, bw, bh) {
      // Bungkus (wrap) agar tile bisa diulang tanpa sambungan
      for (const dx of [-w, 0, w]) {
        for (const dy of [-h, 0, h]) {
          const shade = 128 + Math.floor((random() - 0.5) * 26);
          ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
          ctx.fillRect(x * u + dx + 1.5, y * u + dy + 1.5, bw * u - 3, bh * u - 3);
        }
      }
    }

    for (let s = -units; s < units; s += 4) {        // strip ke atas
      for (let k = -units; k < units * 2; k++) {     // langkah diagonal
        const x = k, y = k + s;

        if (x >= -2 && x < units + 2 && y >= -3 && y < units + 3) {
          brick(x, y, 2, 1);       // bata horizontal
          brick(x, y + 1, 1, 2);   // bata vertikal
        }
      }
    }

    noise(ctx, w, h, random, 30, 9000, 2);
  }, 3);

  // ---------------- Rumput ------------------------------------------
  tm.fromCanvas("grass", 256, 256, (ctx, w, h, random) => {
    ctx.fillStyle = "#4f8a35";
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 9000; i++) {
      const g = 90 + Math.floor(random() * 90);
      ctx.fillStyle = `rgba(${Math.floor(g * 0.45)},${g},${Math.floor(g * 0.3)},0.6)`;
      ctx.fillRect(random() * w, random() * h, 1.5, 3 + random() * 4);
    }
  }, 9);

  // ---------------- Kulit kayu ---------------------------------------
  tm.fromCanvas("bark", 128, 256, (ctx, w, h, random) => {
    ctx.fillStyle = "#6b5646";
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 140; i++) {
      const x = random() * w;
      const shade = 40 + Math.floor(random() * 60);
      ctx.fillStyle = `rgba(${shade},${Math.floor(shade * 0.8)},${Math.floor(shade * 0.65)},0.7)`;
      ctx.fillRect(x, 0, 1 + random() * 3, h);
    }

    noise(ctx, w, h, random, 50, 1500, 3);
  }, 13);

  // ---------------- Daun (gugus daun rimbun) --------------------------
  tm.fromCanvas("leaves", 256, 256, (ctx, w, h, random) => {
    ctx.fillStyle = "#2d5226";
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 1400; i++) {
      const x = random() * w, y = random() * h;
      const g = 70 + Math.floor(random() * 110);
      ctx.fillStyle = `rgba(${Math.floor(g * 0.45)},${g},${Math.floor(g * 0.35)},0.85)`;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + random() * 5, 1.5 + random() * 2.5, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 17);

  // ---------------- Genteng (atap pos satpam & gedung lama) -----------
  tm.fromCanvas("roofTile", 128, 128, (ctx, w, h, random) => {
    ctx.fillStyle = "#a3482c";
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < 8; row++) {
      const y = row * 16;
      ctx.fillStyle = "rgba(60,20,10,0.5)";
      ctx.fillRect(0, y, w, 3);

      for (let x = (row % 2) * 8; x < w; x += 16) {
        ctx.fillStyle = "rgba(60,20,10,0.35)";
        ctx.fillRect(x, y, 2, 16);
      }
    }

    noise(ctx, w, h, random, 40, 800, 2);
  }, 19);

  // ---------------- Dinding pos satpam (putih + jendela) ---------------
  tm.fromCanvas("gazeboWall", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#eeeeea";
    ctx.fillRect(0, 0, w, h);
    // Jendela kaca gelap dengan kusen
    ctx.fillStyle = "#3a4a57";
    ctx.fillRect(w * 0.15, h * 0.12, w * 0.7, h * 0.5);
    ctx.fillStyle = "#d8d8d2";
    ctx.fillRect(w * 0.49, h * 0.12, w * 0.02, h * 0.5);
    ctx.fillStyle = "#c9c9c3";
    ctx.fillRect(0, h * 0.85, w, h * 0.15);
  });

  // ---------------- Gedung lama (krem + jendela gelap) ----------------
  tm.fromCanvas("oldFacade", 128, 128, (ctx, w, h, random) => {
    ctx.fillStyle = "#d9d2c3";
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, random, 25, 500, 2);
    ctx.fillStyle = "#3b4146";
    ctx.fillRect(w * 0.18, h * 0.12, w * 0.64, h * 0.52);
    ctx.fillStyle = "#b9b2a4";
    ctx.fillRect(0, h * 0.78, w, h * 0.08);
  }, 29);

  // ---------------- Gedung rendah kiri (putih + pita kaca biru) --------
  tm.fromCanvas("lowFacade", 128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#eef1f3";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3f6fa8";
    ctx.fillRect(0, h * 0.2, w, h * 0.38);
    ctx.fillStyle = "#d5dbe0";
    ctx.fillRect(w * 0.48, h * 0.2, w * 0.04, h * 0.38);
  });

  // ---------------- Gedung parkir KPA 2 -------------------------------
  // 1 tile = 1 lantai parkir: pelat abu + bukaan gelap + railing biru.
  tm.fromCanvas("kpaFacade", 256, 128, (ctx, w, h, random) => {
    ctx.fillStyle = "#8c9196";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#2a2e33";
    ctx.fillRect(0, h * 0.25, w, h * 0.55);
    ctx.fillStyle = "#7c8187";

    for (let x = 0; x < w; x += 64) {
      ctx.fillRect(x, h * 0.25, 8, h * 0.55);   // kolom
    }

    ctx.fillStyle = "#2f5fa0";
    ctx.fillRect(0, h * 0.72, w, h * 0.06);     // railing biru
    noise(ctx, w, h, random, 20, 600, 2);
  }, 31);

  tm.fromCanvas("kpaSign", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#9aa0a6";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f5f6f7";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, "KPA 2", w / 2, h * 0.42, w * 0.8, 70, "bold");
    fitText(ctx, "PARKIR PUSAT", w / 2, h * 0.62, w * 0.8, 26, "normal");
  });

  tm.fromCanvas("yellowBanner", 256, 128, (ctx, w, h) => {
    ctx.fillStyle = "#f4d21e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1b1b1b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, "PEMBERITAHUAN", w / 2, h * 0.3, w * 0.85, 26, "bold");
    fitText(ctx, "JAM OPERASIONAL PARKIR", w / 2, h * 0.58, w * 0.85, 18, "bold");
    fitText(ctx, "06.00 – 22.00", w / 2, h * 0.8, w * 0.85, 18, "normal");
  });

  // ---------------- Strip kuning-hitam (palang & tiang) ---------------
  tm.fromCanvas("hazard", 64, 64, (ctx, w, h) => {
    ctx.fillStyle = "#f2c80f";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w / 2, h);
  });

  // ---------------- Kerb beton & aspal marka ------------------------
  tm.fromCanvas("concrete", 128, 128, (ctx, w, h, random) => {
    ctx.fillStyle = "#8d8f90";
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, random, 40, 2500, 2);
  }, 37);

  tm.fromCanvas("fadedPaint", 256, 256, (ctx, w, h, random) => {
    ctx.fillStyle = "#cfd0cc";
    ctx.fillRect(0, 0, w, h);

    // Cat marka putih yang terkelupas (lihat foto stop-motion-tilt)
    for (let i = 0; i < 500; i++) {
      const g = 100 + Math.floor(random() * 40);
      ctx.fillStyle = `rgba(${g},${g + 2},${g + 6},${0.4 + random() * 0.5})`;
      ctx.fillRect(random() * w, random() * h, 4 + random() * 14, 4 + random() * 8);
    }
  }, 41);
}
