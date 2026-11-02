// =====================================================================
// environment.js — Tanah, langit, matahari, awan, tiang listrik
// =====================================================================
// Hierarki:
//   Lingkungan
//   ├─ Tanah
//   │   ├─ Paving Plaza (herringbone)
//   │   ├─ Rumput (beberapa petak)
//   │   └─ Marka Cat Pudar
//   ├─ Langit (sky dome, digambar dengan shader khusus)
//   ├─ Pivot Matahari  (ROTASI: orbit sesuai jam)
//   │   └─ Matahari    (SKALA: glow berdenyut)
//   ├─ Grup Awan
//   │   └─ Awan i (TRANSLASI) → Gumpalan j
//   └─ Tiang Listrik → Palang → Kabel i → Segmen j
// =====================================================================

import { CONFIG } from "./config.js";
import { Node, createMaterial } from "./scene-graph.js";
import { Meshes, getMesh, createPlane, createSphere } from "./geometry.js";
import { createRandom, Vec3 } from "./math3d.js";

const E = CONFIG.environment;

export function createEnvironment({ gl, tm, lighting }) {
  const root = new Node("Lingkungan");

  // ------------------------------------------------------------------
  // TANAH
  // ------------------------------------------------------------------
  const ground = root.add(new Node("Tanah"));
  const size = E.groundSize;

  // Paving: 1 tile texture = 1.6 m → diulang size/1.6 kali (wrap REPEAT)
  ground.add(new Node("Paving Plaza", {
    mesh: getMesh(gl, "ground", () => createPlane(size, size, size / 1.6, size / 1.6)),
    material: createMaterial({
      name: "paving",
      color: [0.92, 0.92, 0.92],
      texture: tm.get("paving"),
      specular: 0.08,
      shininess: 8
    }),
    castShadow: false
  }));

  // Petak rumput (y sedikit di atas paving agar tidak z-fighting)
  const grassMaterial = createMaterial({
    name: "rumput",
    color: [0.85, 0.9, 0.8],
    texture: tm.get("grass"),
    uvScale: [1, 1],
    specular: 0.03,
    shininess: 4
  });

  // [x, z, lebar, panjang] — area hijau di samping & belakang gedung
  const grassPatches = [
    [-15, -2, 10, 22],    // kiri gedung (bawah louver)
    [17, 4, 12, 14],      // kanan gedung
    [0, -24, 70, 18],     // belakang
    [26, 22, 14, 14],     // sekitar pohon rindang kanan
    [-25, 20, 7, 7]       // pohon depan KPA 2
  ];

  grassPatches.forEach(([x, z, w, d], i) => {
    ground.add(new Node(`Rumput ${i + 1}`, {
      position: [x, 0.02, z],
      mesh: getMesh(gl, `grass_${w}_${d}`, () => createPlane(w, d, w / 3, d / 3)),
      material: grassMaterial,
      castShadow: false
    }));
  });

  // Marka cat putih pudar di paving (lihat foto stop-motion-tilt 1-4)
  ground.add(new Node("Marka Cat Pudar", {
    position: [-27.5, 0.03, 49],
    rotation: [0, 20, 0],
    mesh: getMesh(gl, "marking", () => createPlane(1.1, 8, 1, 3)),
    material: createMaterial({ name: "marka", texture: tm.get("fadedPaint"), specular: 0.05 }),
    castShadow: false
  }));

  // ------------------------------------------------------------------
  // LANGIT — node penanda; digambar terpisah oleh program SKY (main.js)
  // ------------------------------------------------------------------
  root.add(new Node("Langit (sky dome)", {
    mesh: getMesh(gl, "skyDome", () => createSphere(16, 24)),
    userData: { skyDome: true },
    castShadow: false
  }));

  // ------------------------------------------------------------------
  // MATAHARI — hierarki pivot (ROTASI) → bola matahari
  // ------------------------------------------------------------------
  // Pivot ada di pusat scene. Rotasi Y menentukan arah terbit (timur),
  // rotasi Z menentukan ketinggian sesuai jam (dihitung lighting.js).
  // Karena Matahari adalah ANAK pivot, memutar pivot = matahari mengorbit.
  const sunPivot = root.add(new Node("Pivot Matahari", {
    onUpdate: (node) => {
      node.rotation = [0, E.sunYawDeg, lighting.sunAngle];
    }
  }));

  const sunMaterial = createMaterial({ name: "matahari", unlit: true, color: [1, 0.95, 0.8] });

  sunPivot.add(new Node("Matahari", {
    position: [E.sunDistance, 0, 0],
    mesh: Meshes.sphere(gl),
    meshScale: [E.sunRadius, E.sunRadius, E.sunRadius],
    material: sunMaterial,
    castShadow: false,
    onUpdate: (node, dt, time) => {
      // SKALA: glow matahari berdenyut halus (±6%)
      const pulse = 1 + 0.06 * Math.sin(time * 2.0);
      node.scale = [pulse, pulse, pulse];
      node.material.color = Vec3.scale(lighting.sunGlowColor, 1.25);
      // Sembunyikan bila sudah di bawah horizon
      node.visible = lighting.sunElevation > -0.06;
    }
  }));

  // ------------------------------------------------------------------
  // AWAN — TRANSLASI pelan, muncul lagi dari sisi lain (wrap-around)
  // ------------------------------------------------------------------
  const clouds = root.add(new Node("Grup Awan"));
  const random = createRandom(2026);
  const cloudMaterial = createMaterial({
    name: "awan",
    color: [0.97, 0.97, 0.98],
    specular: 0.0,
    shininess: 2
  });

  for (let i = 0; i < E.cloudCount; i++) {
    const startX = -E.cloudRange + random() * E.cloudRange * 2;
    const y = E.cloudHeight[0] + random() * (E.cloudHeight[1] - E.cloudHeight[0]);
    const z = -260 + random() * 360;
    const speed = E.cloudSpeed * (0.6 + random() * 0.8);

    const cloud = clouds.add(new Node(`Awan ${i + 1}`, {
      position: [startX, y, z],
      castShadow: false,
      userData: { speed },
      onUpdate: (node, dt) => {
        node.position[0] += node.userData.speed * dt;

        if (node.position[0] > E.cloudRange) {
          node.position[0] = -E.cloudRange;
        }
      }
    }));

    // Awan = gabungan beberapa bola pipih (gumpalan)
    const puffCount = 4 + Math.floor(random() * 4);

    for (let j = 0; j < puffCount; j++) {
      const r = 6 + random() * 8;
      cloud.add(new Node(`Gumpalan ${j + 1}`, {
        position: [(j - puffCount / 2) * 9 + random() * 6, random() * 3, random() * 12 - 6],
        mesh: Meshes.sphereLow(gl),
        meshScale: [r * 1.5, r * 0.38, r * 1.1],
        material: cloudMaterial,
        castShadow: false
      }));
    }
  }

  // ------------------------------------------------------------------
  // TIANG LISTRIK + KABEL (kabel melintang di kiri atas foto)
  // ------------------------------------------------------------------
  const poleMaterial = createMaterial({ name: "tiang", color: [0.42, 0.43, 0.45], specular: 0.2 });
  const cableMaterial = createMaterial({ name: "kabel", color: [0.08, 0.08, 0.09], specular: 0.1 });
  const pole = root.add(new Node("Tiang Listrik", {
    position: [...CONFIG.props.powerPole],
    mesh: Meshes.cylinder(gl),
    meshScale: [0.14, 10, 0.14],
    material: poleMaterial
  }));

  const arm = pole.add(new Node("Palang Tiang", {
    position: [0, 9.6, 0],
    mesh: Meshes.cube(gl),
    meshScale: [0.12, 0.12, 1.6],
    material: poleMaterial
  }));

  // Kabel melengkung (catenary sederhana) dari tiang ke luar layar
  // kiri-belakang kamera; disusun dari segmen kubus tipis.
  const cableEnd = CONFIG.props.cableEnd;
  const segments = 10;

  for (let c = 0; c < 4; c++) {
    const cable = arm.add(new Node(`Kabel ${c + 1}`, { castShadow: false }));
    const start = [0, 0.05, -0.7 + c * 0.45];
    const end = Vec3.subtract(cableEnd, [CONFIG.props.powerPole[0], 9.6, CONFIG.props.powerPole[2]]);
    end[2] += c * 1.2;

    let previous = start;

    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const sag = Math.sin(t * Math.PI) * (3.5 + c * 0.4); // kendur di tengah
      const point = [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t - sag,
        start[2] + (end[2] - start[2]) * t
      ];
      cable.add(segmentBetween(gl, `Segmen ${s}`, previous, point, 0.035, cableMaterial));
      previous = point;
    }
  }

  return root;
}

// Membuat kubus tipis yang menghubungkan titik a → b (untuk kabel/tangga).
// Rotasi dihitung dari arah a→b: yaw (Y) lalu pitch (X).
export function segmentBetween(gl, name, a, b, thickness, material) {
  const d = Vec3.subtract(b, a);
  const length = Vec3.length(d);
  const mid = Vec3.scale(Vec3.add(a, b), 0.5);
  const yaw = Math.atan2(d[0], d[2]) * 180 / Math.PI;
  const pitch = -Math.asin(d[1] / length) * 180 / Math.PI;

  return new Node(name, {
    position: mid,
    rotation: [pitch, yaw, 0],
    mesh: Meshes.cube(gl),
    meshScale: [thickness, thickness, length],
    material,
    castShadow: false
  });
}
