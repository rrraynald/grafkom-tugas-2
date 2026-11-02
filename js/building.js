// =====================================================================
// building.js — Gedung Menara Sains (Tower 1 ITS) + gedung sekitar
// (Modul Anggota A)
// ---------------------------------------------------------------------
// Dimensi diambil dari CONFIG.building (lihat config.js). Ciri dari foto:
//   - Balok ramping, tinggi : lebar muka ≈ 3 : 1, ±13 lantai
//   - Muka depan: grid panel abu-perak, 6 kolom | strip kaca biru | 5 kolom
//   - Sisi kiri: louver putih vertikal + tangga darurat zig-zag di baliknya
//   - Atap: pita/kanopi gelap menjorok bertuliskan "TOWER 1 ITS"
//
// Hierarki:
//   Gedung Menara Sains
//   ├─ Plint Dasar → Pintu Lobi
//   ├─ Badan Menara (texture panel)
//   │   ├─ Bingkai Strip Kiri / Kanan
//   │   └─ Lantai i (loop) → Kaca Lantai i
//   ├─ Sisi Louver (kiri)
//   │   ├─ Bilah Louver i (loop) ; Rangka Atas/Bawah ; Tulisan AKTUARIA
//   │   └─ Tangga Darurat → Lantai i → Anak Tangga Diagonal → Railing ; Bordes
//   ├─ Sisi Kanan (koridor) → Kolom i ; Lis Koridor i
//   └─ Atap → Pita Atap (kanopi gelap) → Papan TOWER 1 ITS
//             └─ Atap Datar → Unit AC i ; Antena
// =====================================================================

import { CONFIG } from "./config.js";
import { Node, createMaterial } from "./scene-graph.js";
import { Meshes, getMesh, createBox, createTaperedBox, createPrism } from "./geometry.js";
import { createRandom } from "./math3d.js";
import { segmentBetween } from "./environment.js";

// Konstanta dimensi (alias pendek dari CONFIG agar kode mudah dibaca)
const B = CONFIG.building;
const FLOORS = B.floors;
const FLOOR_HEIGHT = B.floorHeight;
const WIDTH = B.width;
const DEPTH = B.depth;
const HEIGHT = FLOORS * FLOOR_HEIGHT;            // tinggi badan menara
const COLUMN_WIDTH = WIDTH / B.panelColumns;     // lebar 1 kolom panel
const GLASS_X = -WIDTH / 2 + (B.glassColumnIndex + 0.5) * COLUMN_WIDTH; // pusat strip kaca

export function createTower({ gl, tm }) {
  const tower = new Node("Gedung Menara Sains");

  // ---------------- Material ----------------
  const panelMaterial = createMaterial({
    name: "panel fasad",
    color: B.colors.panel,
    texture: tm.get("facade"),
    specular: 0.45,           // semi-glossy (ACP / kaca reflektif tipis)
    shininess: 48,
    reflectivity: 0.06,       // sedikit memantulkan langit
    nightEmissive: [1.0, 0.85, 0.6],
    emissiveTexture: tm.get("facadeEmissive")
  });

  const glassMaterial = createMaterial({
    name: "kaca biru",
    color: [1, 1, 1],
    texture: tm.get("glass"),
    specular: 1.2,            // specular tinggi
    shininess: 128,           // highlight kecil & tajam
    reflectivity: 0.35,       // pantulan langit lebih kuat
    nightEmissive: [0.55, 0.65, 0.85]
  });

  const frameMaterial = createMaterial({ name: "bingkai", color: [0.86, 0.87, 0.88], specular: 0.3, shininess: 32 });
  const louverMaterial = createMaterial({ name: "louver", color: B.colors.louver, specular: 0.05, shininess: 6 }); // matte
  const stairMaterial = createMaterial({ name: "tangga", color: B.colors.stair, specular: 0.1, shininess: 8 });
  const crownMaterial = createMaterial({ name: "kanopi gelap", color: B.colors.crown, specular: 0.08, shininess: 10 }); // matte gelap
  const baseMaterial = createMaterial({ name: "plint", color: B.colors.base, texture: tm.get("concrete"), specular: 0.05 });

  // ------------------------------------------------------------------
  // PLINT DASAR + PINTU LOBI
  // ------------------------------------------------------------------
  const plinth = tower.add(new Node("Plint Dasar", {
    position: [0, 0.2, 0],
    mesh: getMesh(gl, "plinth", () => createBox(WIDTH + 0.8, 0.4, DEPTH + 0.8)),
    material: baseMaterial
  }));

  plinth.add(new Node("Pintu Lobi", {
    position: [GLASS_X, 1.45, DEPTH / 2 + 0.06],
    mesh: getMesh(gl, "lobbyDoor", () => createBox(COLUMN_WIDTH * 1.6, 2.5, 0.12)),
    material: createMaterial({
      name: "pintu kaca",
      color: [0.18, 0.24, 0.3],
      specular: 1.0,
      shininess: 96,
      reflectivity: 0.3,
      nightEmissive: [1.0, 0.9, 0.7]
    })
  }));

  // ------------------------------------------------------------------
  // BADAN MENARA — satu box besar dengan texture panel.
  // UV dalam meter: 1 tile texture = 4 kolom × 4 lantai, sehingga grid
  // panel jatuh tepat di batas kolom/lantai pada SEMUA sisi.
  // ------------------------------------------------------------------
  const body = tower.add(new Node("Badan Menara", {
    position: [0, HEIGHT / 2, 0],
    mesh: getMesh(gl, "towerBody", () => createBox(WIDTH, HEIGHT, DEPTH, {
      tile: [COLUMN_WIDTH * 4, FLOOR_HEIGHT * 4]
    })),
    material: panelMaterial
  }));

  // Bingkai strip kaca (sirip vertikal terang di kiri-kanan strip)
  for (const side of [-1, 1]) {
    body.add(new Node(side < 0 ? "Bingkai Strip Kiri" : "Bingkai Strip Kanan", {
      position: [GLASS_X + side * (COLUMN_WIDTH / 2 + 0.12), 0, DEPTH / 2 + 0.12],
      mesh: getMesh(gl, "stripFrame", () => createBox(0.32, HEIGHT, 0.26)),
      material: frameMaterial
    }));
  }

  // Lantai-lantai (LOOP) → segmen kaca per lantai.
  // Origin tiap lantai = lantai itu sendiri; jadi mengubah FLOORS di
  // config otomatis menambah/mengurangi node lantai.
  const random = createRandom(77);

  for (let i = 0; i < FLOORS; i++) {
    const floor = body.add(new Node(`Lantai ${i + 1}`, {
      position: [0, -HEIGHT / 2 + i * FLOOR_HEIGHT, 0]
    }));

    // Lantai 1 = lobi (kaca lebih gelap/pintu), lantai lain = strip kaca
    if (i === 0) {
      continue;
    }

    const lit = random() < 0.7 ? 1 : 0.25; // sebagian lantai lampunya mati saat malam
    floor.add(new Node(`Kaca Lantai ${i + 1}`, {
      position: [GLASS_X, FLOOR_HEIGHT / 2, DEPTH / 2 + 0.05],
      mesh: getMesh(gl, "glassSegment", () => createBox(COLUMN_WIDTH, FLOOR_HEIGHT - 0.04, 0.1, { unitUV: true })),
      material: { ...glassMaterial, nightEmissive: glassMaterial.nightEmissive.map((c) => c * lit) }
    }));
  }

  // ------------------------------------------------------------------
  // SISI LOUVER (KIRI) — bilah vertikal + tangga darurat di baliknya
  // ------------------------------------------------------------------
  const louverX = -WIDTH / 2 - B.louverGap;
  const louverBottom = B.louverStartFloor * FLOOR_HEIGHT;
  const louverHeight = HEIGHT - louverBottom + 0.6;

  const louverSide = tower.add(new Node("Sisi Louver (kiri)", {
    position: [louverX, louverBottom, 0]
  }));

  const slatCount = Math.floor(DEPTH / B.louverSpacing) + 1;

  for (let i = 0; i < slatCount; i++) {
    louverSide.add(new Node(`Bilah Louver ${i + 1}`, {
      position: [0, louverHeight / 2, -DEPTH / 2 + i * B.louverSpacing],
      mesh: Meshes.cube(gl),
      // SKALA NON-SERAGAM: kubus satuan → bilah tipis & tinggi
      meshScale: [0.16, louverHeight, 0.12],
      material: louverMaterial
    }));
  }

  // Rangka horizontal atas & bawah louver
  for (const [name, y] of [["Rangka Bawah", 0.05], ["Rangka Atas", louverHeight - 0.05]]) {
    louverSide.add(new Node(name, {
      position: [0, y, 0],
      mesh: Meshes.cube(gl),
      meshScale: [0.36, 0.12, DEPTH + 0.1],
      material: louverMaterial
    }));
  }

  // Tulisan "AKTUARIA" (huruf timbul di bagian bawah louver, lihat foto)
  louverSide.add(new Node("Tulisan AKTUARIA", {
    position: [-0.2, 2.6, 3.3],
    rotation: [0, -90, 0],               // quad menghadap −X (keluar)
    mesh: Meshes.quad(gl),
    meshScale: [5.2, 0.7, 1],
    material: createMaterial({ name: "aktuaria", texture: tm.get("aktuariaSign"), specular: 0.1 }),
    castShadow: false
  }));

  // ---- Tangga darurat zig-zag (anak dari Sisi Louver) ----
  // Tiap lantai: 1 anak tangga diagonal melintang sisi kiri, arahnya
  // bergantian (zig-zag), + bordes di ujung + railing sejajar.
  const stairs = louverSide.add(new Node("Tangga Darurat", {
    position: [B.louverGap / 2 + 0.05, -louverBottom, 0]
  }));
  const run = DEPTH - 2.2;  // panjang horizontal tiap anak tangga

  for (let i = 0; i < FLOORS; i++) {
    const dir = i % 2 === 0 ? -1 : 1;   // bergantian ke belakang/ke depan
    const y0 = i * FLOOR_HEIGHT;
    const flightStart = [0, y0, -dir * run / 2];
    const flightEnd = [0, y0 + FLOOR_HEIGHT, dir * run / 2];

    const floorStair = stairs.add(new Node(`Tangga Lantai ${i + 1}`));
    const flight = segmentBetween(gl, "Anak Tangga Diagonal", flightStart, flightEnd, 0.35, stairMaterial);
    flight.meshScale = [0.95, 0.35, flight.meshScale[2]];
    flight.castShadow = true;
    floorStair.add(flight);

    // Railing: sejajar anak tangga, 1 m di atasnya (anak dari tangga →
    // ikut posisi/rotasi tangga secara otomatis)
    flight.add(new Node("Railing", {
      position: [-0.42, 1.0, 0],
      mesh: Meshes.cube(gl),
      meshScale: [0.05, 0.05, flight.meshScale[2]],
      material: louverMaterial,
      castShadow: false
    }));

    floorStair.add(new Node("Bordes", {
      position: [0, y0 + FLOOR_HEIGHT, dir * (run / 2 + 0.6)],
      mesh: Meshes.cube(gl),
      meshScale: [1.0, 0.16, 1.2],
      material: stairMaterial
    }));
  }

  // ------------------------------------------------------------------
  // SISI KANAN — ASUMSI: lis koridor tiap lantai + kolom (tidak terlihat
  // jelas di foto karena semua foto diambil dari kiri-depan).
  // ------------------------------------------------------------------
  const rightSide = tower.add(new Node("Sisi Kanan (koridor)", {
    position: [WIDTH / 2, 0, 0]
  }));

  for (let i = 1; i < FLOORS; i++) {
    rightSide.add(new Node(`Lis Koridor ${i + 1}`, {
      position: [0.18, i * FLOOR_HEIGHT, 0],
      mesh: Meshes.cube(gl),
      meshScale: [0.36, 0.18, DEPTH],
      material: frameMaterial
    }));
  }

  for (let c = 0; c < 3; c++) {
    rightSide.add(new Node(`Kolom ${c + 1}`, {
      position: [0.2, HEIGHT / 2, -DEPTH / 2 + 0.3 + c * (DEPTH - 0.6) / 2],
      mesh: Meshes.cube(gl),
      meshScale: [0.4, HEIGHT, 0.5],
      material: frameMaterial
    }));
  }

  // ------------------------------------------------------------------
  // ATAP — pita/kanopi gelap yang MELEBAR ke atas (menjorok keluar)
  // ------------------------------------------------------------------
  // Atap menutupi badan menara + sisi louver, jadi pusatnya digeser ke
  // kiri setengah jarak louver.
  const roof = tower.add(new Node("Atap", { position: [-B.louverGap / 2, HEIGHT, 0] }));
  const ov = B.crownOverhang;
  const crownWidth = WIDTH + B.louverGap + 0.3;

  const crown = roof.add(new Node("Pita Atap (kanopi gelap)", {
    mesh: getMesh(gl, "crown", () => createTaperedBox(
      crownWidth, DEPTH + 0.3,
      crownWidth + 2 * ov, DEPTH + 2 * ov,
      B.crownHeight)),
    material: crownMaterial
  }));

  // Papan tulisan mengikuti kemiringan muka depan kanopi
  const lean = Math.atan2(ov - 0.15, B.crownHeight) * 180 / Math.PI;

  crown.add(new Node("Papan TOWER 1 ITS", {
    position: [0, B.crownHeight / 2, (DEPTH + 0.3) / 2 + (ov - 0.15) / 2 + 0.05],
    rotation: [lean, 0, 0],   // condong keluar mengikuti muka kanopi
    mesh: Meshes.quad(gl),
    meshScale: [crownWidth + ov, B.crownHeight * 0.92, 1],
    material: createMaterial({
      name: "papan tower",
      texture: tm.get("crownSign"),
      specular: 0.15,
      nightEmissive: [1, 1, 1],
      emissiveTexture: tm.get("crownSignGlow")   // tulisan menyala saat malam
    }),
    castShadow: false
  }));

  const roofTop = crown.add(new Node("Atap Datar", {
    position: [0, B.crownHeight - 0.25, 0],
    mesh: getMesh(gl, "roofTop", () => createBox(crownWidth + 2 * ov - 0.4, 0.3, DEPTH + 2 * ov - 0.4)),
    material: createMaterial({ name: "atap", color: [0.45, 0.46, 0.47], specular: 0.05 })
  }));

  // Properti atap: unit AC & antena
  const unitMaterial = createMaterial({ name: "unit atap", color: [0.7, 0.72, 0.73], specular: 0.3 });

  for (let i = 0; i < 3; i++) {
    roofTop.add(new Node(`Unit AC ${i + 1}`, {
      position: [-5 + i * 4, 0.75, -3],
      mesh: Meshes.cube(gl),
      meshScale: [2.4, 1.2, 1.6],
      material: unitMaterial
    }));
  }

  roofTop.add(new Node("Antena", {
    position: [6, 0, -4],
    mesh: Meshes.cylinder(gl),
    meshScale: [0.06, 6, 0.06],
    material: unitMaterial
  }));

  return tower;
}

// =====================================================================
// GEDUNG SEKITAR — KPA 2, gedung rendah kiri, gedung lama kanan
// =====================================================================
export function createNeighborBuildings({ gl, tm }) {
  const N = CONFIG.neighbors;
  const group = new Node("Gedung Sekitar");

  // ---------------- Gedung parkir KPA 2 (kiri depan) ----------------
  const [kw, kh, kd] = N.kpa2.size;
  const kpa = group.add(new Node("Gedung Parkir KPA 2", {
    position: [N.kpa2.position[0], kh / 2, N.kpa2.position[2]]
  }));

  kpa.add(new Node("Badan Parkir", {
    mesh: getMesh(gl, "kpaBody", () => createBox(kw, kh, kd, { tile: [8, kh / 4] })),
    material: createMaterial({ name: "kpa", color: [1, 1, 1], texture: tm.get("kpaFacade"), specular: 0.1, nightEmissive: [0.06, 0.06, 0.05] })
  }));

  kpa.add(new Node("Pita Biru Dasar", {
    position: [0, -kh / 2 + 1.1, 0],
    mesh: Meshes.cube(gl),
    meshScale: [kw + 0.2, 0.5, kd + 0.2],
    material: createMaterial({ name: "biru kpa", color: [0.18, 0.36, 0.66], specular: 0.3 })
  }));

  // Menara tangga di sudut kanan-depan (papan "KPA 2" + panel louver putih)
  const stairTower = kpa.add(new Node("Menara Tangga KPA 2", {
    position: [kw / 2 - 2.5, 1.0, kd / 2 + 2.6],
    mesh: Meshes.cube(gl),
    meshScale: [5.0, kh + 2, 5.2],
    material: createMaterial({ name: "kpa tower", color: [0.66, 0.69, 0.72], specular: 0.15 })
  }));

  stairTower.add(new Node("Papan KPA 2", {
    position: [0.6, 2.5, 2.62],
    mesh: Meshes.quad(gl),
    meshScale: [3.6, 3.6, 1],
    material: createMaterial({ name: "papan kpa", texture: tm.get("kpaSign"), specular: 0.1, nightEmissive: [0.6, 0.6, 0.6] }),
    castShadow: false
  }));

  const kpaLouver = stairTower.add(new Node("Panel Louver Putih", {
    position: [-1.5, 4.6, 2.75]
  }));

  for (let i = 0; i < 9; i++) {
    kpaLouver.add(new Node(`Bilah ${i + 1}`, {
      position: [i * 0.32 - 1.3, 0, 0],
      rotation: [0, 0, 8],
      mesh: Meshes.cube(gl),
      meshScale: [0.1, 4.5, 0.2],
      material: createMaterial({ name: "louver kpa", color: [0.95, 0.95, 0.94], specular: 0.05 })
    }));
  }

  stairTower.add(new Node("Banner Kuning", {
    position: [-1.0, -2.8, 2.65],
    mesh: Meshes.quad(gl),
    meshScale: [4.2, 1.8, 1],
    material: createMaterial({ name: "banner", texture: tm.get("yellowBanner"), specular: 0.1 }),
    castShadow: false
  }));

  // ---------------- Gedung rendah kiri (putih + kaca biru) -----------
  const [lw, lh, ld] = N.lowLeft.size;
  const low = group.add(new Node("Gedung Rendah Kiri", {
    position: [N.lowLeft.position[0], lh / 2, N.lowLeft.position[2]],
    mesh: getMesh(gl, "lowBody", () => createBox(lw, lh, ld, { tile: [4, lh / 2] })),
    material: createMaterial({ name: "gedung rendah", texture: tm.get("lowFacade"), specular: 0.3, shininess: 32, nightEmissive: [0.08, 0.1, 0.14] })
  }));

  low.add(new Node("Atap Gedung Rendah", {
    position: [0, lh / 2 + 0.3, 0],
    mesh: Meshes.cube(gl),
    meshScale: [lw + 0.8, 0.6, ld + 0.8],
    material: createMaterial({ name: "atap putih", color: [0.9, 0.9, 0.9], specular: 0.1 })
  }));

  // ---------------- Gedung lama kanan (atap pelana genteng) ----------
  const [ow, oh, od] = N.oldRight.size;
  const old = group.add(new Node("Gedung Lama Kanan", {
    position: [N.oldRight.position[0], oh / 2, N.oldRight.position[2]],
    mesh: getMesh(gl, "oldBody", () => createBox(ow, oh, od, { tile: [3.5, 3.5] })),
    material: createMaterial({ name: "gedung lama", texture: tm.get("oldFacade"), specular: 0.08, nightEmissive: [0.1, 0.08, 0.05] })
  }));

  old.add(new Node("Atap Pelana", {
    position: [0, oh / 2, 0],
    mesh: getMesh(gl, "oldRoof", () => createPrism(ow + 1.6, 4.2, od + 1.2, 2)),
    material: createMaterial({ name: "genteng", texture: tm.get("roofTile"), uvScale: [1, 1], specular: 0.12 })
  }));

  return group;
}
