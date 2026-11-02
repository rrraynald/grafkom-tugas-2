// =====================================================================
// lighting.js — Matahari, siklus siang-malam, lampu titik
// ---------------------------------------------------------------------
// Praktikum 5 memakai SATU lampu titik (u_lightPosition). Di scene luar
// ruangan, sumber cahaya utama adalah MATAHARI yang sangat jauh, sehingga
// sinarnya dianggap SEJAJAR → DIRECTIONAL LIGHT (hanya punya arah).
//
// Arah matahari diambil dari posisi dunia node "Matahari" di scene graph
// (Matahari adalah anak dari "Pivot Matahari" yang berotasi). Jadi rotasi
// hierarki sekaligus mengatur arah cahaya, warna langit, dan bayangan.
//
// Lampu taman / pos satpam = POINT LIGHT (seperti praktikum), hanya
// menyala saat malam (dikalikan nightFactor).
// =====================================================================

import { CONFIG } from "./config.js";
import { Vec3, clamp, lerp } from "./math3d.js";
import { MAX_POINT_LIGHTS } from "./shaders.js";

const L = CONFIG.lighting;

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix3(a, b, t) {
  return Vec3.lerp(a, b, t);
}

export class Lighting {
  constructor() {
    this.hour = L.startHour;     // jam (0..24)
    this.autoCycle = false;      // siklus otomatis
    this.ambientStrength = L.ambientStrength;
    this.sunIntensity = L.sunIntensity;
    this.specularStrength = L.specularStrength;
    this.shininessScale = L.shininessScale;

    // Toggle komponen (panel UI, untuk demo ke dosen)
    this.useAmbient = true;
    this.useDiffuse = true;
    this.useSpecular = true;
    this.useBlinn = true;        // B: Blinn-Phong ↔ Phong (praktikum)
    this.useShadow = true;
    this.useFog = true;
    this.useToneMapping = true;
    this.exposure = L.exposure;
    this.cloudCover = L.cloudCover;   // lapisan awan di shader langit
    this.cloudColor = [1, 1, 1];

    this.pointLights = [];       // { position, color }

    // Hasil perhitungan per frame (dibaca main.js → uniform)
    this.lightDirection = [0, 1, 0];
    this.lightColor = [1, 1, 1];
    this.lightIntensity = 1;
    this.skyTop = [0.4, 0.6, 0.9];
    this.skyHorizon = [0.85, 0.9, 0.95];
    this.groundColor = [0.35, 0.35, 0.33];
    this.nightFactor = 0;
    this.sunGlowColor = [1, 0.9, 0.7];
    this.sunElevation = 0.5;
  }

  addPointLight(position, color) {
    if (this.pointLights.length < MAX_POINT_LIGHTS) {
      this.pointLights.push({ position, color });
    }
  }

  // Sudut pivot matahari (derajat) dari jam: 06.00 = 0° (terbit),
  // 12.00 = 90° (di atas kepala), 18.00 = 180° (terbenam).
  get sunAngle() {
    return ((this.hour - 6) / 12) * 180;
  }

  get timeText() {
    const h = Math.floor(this.hour) % 24;
    const m = Math.floor((this.hour % 1) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // ------------------------------------------------------------------
  // Dipanggil tiap frame. sunWorldPosition = posisi node Matahari.
  // ------------------------------------------------------------------
  update(dt, sunWorldPosition) {
    if (this.autoCycle) {
      this.hour = (this.hour + (24 / L.dayLengthSeconds) * dt) % 24;
    }

    const sunDir = Vec3.normalize(sunWorldPosition);
    const elevation = sunDir[1];         // sin(sudut elevasi)
    this.sunElevation = elevation;

    // ---- Faktor-faktor waktu ----
    const day = smoothstep(-0.08, 0.22, elevation);           // 0 malam → 1 siang
    const golden = 1 - smoothstep(0.0, 0.38, Math.abs(elevation)); // dekat horizon
    const isAfternoon = this.hour >= 12 && this.hour < 24 ? 1 : 0;
    this.nightFactor = 1 - smoothstep(-0.12, 0.1, elevation);

    // ---- Warna matahari: pagi hangat, siang putih, sore jingga ----
    const noonColor = [1.0, 0.97, 0.92];
    const morningColor = [1.0, 0.82, 0.62];
    const eveningColor = [1.0, 0.56, 0.30];
    const lowColor = isAfternoon ? eveningColor : morningColor;
    let color = mix3(noonColor, lowColor, golden);

    let direction = sunDir;
    let intensity = this.sunIntensity * smoothstep(-0.03, 0.18, elevation) * 0.95;

    // ---- Malam: cahaya bulan biru lemah dari arah berlawanan ----
    if (elevation < 0.0) {
      const moon = 0.16 * smoothstep(0.0, -0.2, elevation);
      direction = Vec3.normalize([-sunDir[0], Math.abs(sunDir[1]) + 0.35, -sunDir[2]]);
      color = [0.55, 0.65, 1.0];
      intensity = Math.max(intensity, moon * this.sunIntensity);
    }

    this.lightDirection = direction;
    this.lightColor = color;
    this.lightIntensity = intensity;

    // ---- Warna langit ----
    // Siang: biru muda pucat & horizon keputihan (langit berawan di foto)
    const dayTop = [0.58, 0.69, 0.85];
    const dayHorizon = [0.86, 0.88, 0.90];
    const duskTop = [0.28, 0.32, 0.55];
    const duskHorizon = isAfternoon ? [0.98, 0.58, 0.34] : [0.98, 0.74, 0.52];
    const nightTop = [0.012, 0.02, 0.06];
    const nightHorizon = [0.05, 0.07, 0.14];

    let top = mix3(nightTop, dayTop, day);
    let horizon = mix3(nightHorizon, dayHorizon, day);
    const duskAmount = golden * smoothstep(-0.25, 0.02, elevation);
    top = mix3(top, duskTop, duskAmount * 0.6);
    horizon = mix3(horizon, duskHorizon, duskAmount * 0.85);

    this.skyTop = top;
    this.skyHorizon = horizon;
    this.groundColor = mix3([0.03, 0.035, 0.05], [0.55, 0.55, 0.53], day);
    this.sunGlowColor = mix3([1.0, 0.95, 0.85], lowColor, golden);
    // Awan: putih siang, jingga saat senja, abu gelap saat malam
    this.cloudColor = mix3(mix3([0.12, 0.13, 0.18], [0.95, 0.95, 0.96], day), duskHorizon, duskAmount * 0.6);
  }

  // Warna ambient dari langit (dipakai shader untuk hemisphere ambient)
  get ambientSkyColor() {
    return Vec3.lerp(this.skyHorizon, this.skyTop, 0.5);
  }

  get fogDensity() {
    return this.useFog ? L.fogDensity * lerp(1, 1.6, this.nightFactor) : 0;
  }

  // Data lampu titik untuk uniform array (flatten ke Float32Array)
  getPointLightUniforms() {
    const count = this.nightFactor > 0.02 ? this.pointLights.length : 0;
    const positions = new Float32Array(MAX_POINT_LIGHTS * 3);
    const colors = new Float32Array(MAX_POINT_LIGHTS * 3);

    for (let i = 0; i < count; i++) {
      const light = this.pointLights[i];
      positions.set(light.position, i * 3);
      colors.set(Vec3.scale(light.color, this.nightFactor), i * 3);
    }

    return { count, positions, colors };
  }
}
