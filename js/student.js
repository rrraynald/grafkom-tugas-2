// =====================================================================
// student.js — Mahasiswa low-poly + animasi berjalan (Anggota B)
// ---------------------------------------------------------------------
// Hierarki satu mahasiswa (contoh paling jelas dari hierarchical model):
//
//   Mahasiswa (TRANSLASI di jalur + ROTASI Y menghadap arah jalan)
//   └─ Pinggul (naik-turun sedikit saat melangkah)
//       ├─ Torso
//       │   ├─ Kepala → Rambut / Hijab
//       │   ├─ Lengan Atas Kiri  (ROTASI di bahu) → Lengan Bawah Kiri  → Tangan
//       │   ├─ Lengan Atas Kanan (ROTASI di bahu) → Lengan Bawah Kanan → Tangan
//       │   └─ Tas
//       ├─ Paha Kiri  (ROTASI di pinggul) → Betis Kiri  (ROTASI lutut) → Sepatu
//       └─ Paha Kanan (ROTASI di pinggul) → Betis Kanan (ROTASI lutut) → Sepatu
//
// Gerak jalan natural: kaki kiri & kanan berlawanan fase, lengan
// berlawanan dengan kaki di sisi yang sama, lutut menekuk saat kaki
// diayun ke belakang, badan naik-turun 2× per siklus langkah.
//
// Konvensi: wajah menghadap +Z lokal. Rotasi X positif mengayun
// tungkai ke BELAKANG (−Z).
// =====================================================================

import { CONFIG } from "./config.js";
import { Node, createMaterial } from "./scene-graph.js";
import { Meshes } from "./geometry.js";
import { createRandom, Vec3, lerp } from "./math3d.js";

const S = CONFIG.students;
const SKIN_TONES = [[0.86, 0.68, 0.55], [0.74, 0.55, 0.42], [0.62, 0.45, 0.33]];

function mat(name, color, specular = 0.08) {
  return createMaterial({ name, color, specular, shininess: 10 });
}

// --------------------------------------------------------------------
// MODEL — dipakai juga oleh vehicle.js untuk pengendara motor
// --------------------------------------------------------------------
export function createPersonModel(gl, name, look) {
  const skin = mat("kulit", look.skin);
  const shirt = mat("baju", look.shirt);
  const pants = mat("celana", look.pants);
  const dark = mat("rambut", [0.08, 0.07, 0.07]);
  const shoe = mat("sepatu", [0.12, 0.12, 0.13]);
  const cube = Meshes.cube(gl);
  const sphere = Meshes.sphereLow(gl);
  const joints = {};

  const root = new Node(name);

  // Pinggul pada ketinggian ±0.86 m (panjang tungkai)
  const hips = root.add(new Node("Pinggul", {
    position: [0, 0.86, 0],
    mesh: cube,
    meshScale: [0.32, 0.14, 0.2],
    material: pants
  }));
  joints.hips = hips;

  const torso = hips.add(new Node("Torso", {
    position: [0, 0.05, 0],
    mesh: cube,
    meshScale: [0.36, 0.56, 0.21],
    meshOffset: [0, 0.28, 0],     // pivot di pinggang, kubus di atasnya
    material: shirt
  }));
  joints.torso = torso;

  const head = torso.add(new Node("Kepala", {
    position: [0, 0.68, 0],
    mesh: sphere,
    meshScale: [0.105, 0.125, 0.115],
    material: skin
  }));

  if (look.helmet) {
    head.add(new Node("Helm", {
      position: [0, 0.03, -0.01],
      mesh: sphere,
      meshScale: [0.15, 0.15, 0.16],
      material: mat("helm", look.helmetColor || [0.85, 0.85, 0.85], 0.6)
    }));
  } else if (look.hijab) {
    // Hijab: penutup kepala + bagian yang menjuntai ke bahu
    const hijabMat = mat("hijab", look.hijabColor);
    head.add(new Node("Hijab", {
      position: [0, 0.015, -0.01],
      mesh: sphere,
      meshScale: [0.125, 0.14, 0.13],
      material: hijabMat
    }));
    head.add(new Node("Juntaian Hijab", {
      position: [0, -0.16, -0.01],
      mesh: Meshes.cone(gl),
      meshScale: [0.21, 0.2, 0.17],
      meshOffset: [0, -0.02, 0],
      material: hijabMat
    }));
  } else {
    head.add(new Node("Rambut", {
      position: [0, 0.04, -0.015],
      mesh: sphere,
      meshScale: [0.11, 0.1, 0.115],
      material: dark
    }));
  }

  // ---- Lengan (pivot di bahu) ----
  for (const side of ["Kiri", "Kanan"]) {
    const sx = side === "Kiri" ? -1 : 1;

    const upperArm = torso.add(new Node(`Lengan Atas ${side}`, {
      position: [sx * 0.225, 0.54, 0],
      mesh: cube,
      meshScale: [0.09, 0.3, 0.1],
      meshOffset: [0, -0.15, 0],
      material: shirt
    }));

    const lowerArm = upperArm.add(new Node(`Lengan Bawah ${side}`, {
      position: [0, -0.3, 0],
      mesh: cube,
      meshScale: [0.075, 0.27, 0.08],
      meshOffset: [0, -0.135, 0],
      material: look.longSleeve ? shirt : skin
    }));

    lowerArm.add(new Node("Tangan", {
      position: [0, -0.3, 0],
      mesh: sphere,
      meshScale: [0.045, 0.06, 0.045],
      material: skin
    }));

    joints[`upperArm${side}`] = upperArm;
    joints[`lowerArm${side}`] = lowerArm;
  }

  if (look.backpack) {
    torso.add(new Node("Tas", {
      position: [0, 0.32, -0.17],
      mesh: cube,
      meshScale: [0.3, 0.38, 0.14],
      material: mat("tas", look.bagColor)
    }));
  }

  // ---- Tungkai (pivot di sendi pinggul) ----
  for (const side of ["Kiri", "Kanan"]) {
    const sx = side === "Kiri" ? -1 : 1;

    const thigh = hips.add(new Node(`Paha ${side}`, {
      position: [sx * 0.095, -0.02, 0],
      mesh: cube,
      meshScale: [0.13, 0.43, 0.14],
      meshOffset: [0, -0.215, 0],
      material: pants
    }));

    const shin = thigh.add(new Node(`Betis ${side}`, {
      position: [0, -0.43, 0],
      mesh: cube,
      meshScale: [0.11, 0.4, 0.12],
      meshOffset: [0, -0.2, 0],
      material: pants
    }));

    shin.add(new Node("Sepatu", {
      position: [0, -0.41, 0.04],
      mesh: cube,
      meshScale: [0.11, 0.07, 0.25],
      material: shoe
    }));

    joints[`thigh${side}`] = thigh;
    joints[`shin${side}`] = shin;
  }

  return { root, joints };
}

// --------------------------------------------------------------------
// POSE
// --------------------------------------------------------------------

// Siklus berjalan. phase dalam radian; amplitude dalam derajat.
export function applyWalkPose(joints, phase, amplitude = 28) {
  const swing = Math.sin(phase);

  // Tungkai: kiri & kanan berlawanan fase
  joints.thighKiri.rotation[0] = -amplitude * swing;
  joints.thighKanan.rotation[0] = amplitude * swing;

  // Lutut hanya menekuk ke belakang (nilai positif)
  joints.shinKiri.rotation[0] = Math.max(0, amplitude * 1.3 * Math.sin(phase - 1.2));
  joints.shinKanan.rotation[0] = Math.max(0, amplitude * 1.3 * Math.sin(phase + Math.PI - 1.2));

  // Lengan berlawanan dengan kaki di sisi yang sama
  joints.upperArmKiri.rotation[0] = amplitude * 0.8 * swing;
  joints.upperArmKanan.rotation[0] = -amplitude * 0.8 * swing;
  joints.lowerArmKiri.rotation[0] = -12 - 8 * Math.max(0, swing);
  joints.lowerArmKanan.rotation[0] = -12 - 8 * Math.max(0, -swing);

  // Badan naik-turun 2× per langkah + sedikit memutar
  joints.hips.position[1] = 0.86 + 0.025 * Math.abs(Math.cos(phase));
  joints.torso.rotation[1] = 4 * swing;
}

// Pose berdiri/ngobrol (ayunan kecil)
export function applyIdlePose(joints, time, phase) {
  const breathe = Math.sin(time * 1.4 + phase);
  joints.thighKiri.rotation[0] = 0;
  joints.thighKanan.rotation[0] = 0;
  joints.shinKiri.rotation[0] = 0;
  joints.shinKanan.rotation[0] = 0;
  joints.upperArmKiri.rotation[0] = 3 * breathe;
  joints.upperArmKanan.rotation = [-35, 0, -10];  // tangan memegang HP
  joints.lowerArmKanan.rotation[0] = -60;
  joints.hips.position[1] = 0.86;
  joints.torso.rotation[1] = 6 * Math.sin(time * 0.4 + phase);
}

// Pose duduk di motor
export function applySeatedPose(joints) {
  joints.hips.position[1] = 0.86;
  joints.thighKiri.rotation[0] = -80;
  joints.thighKanan.rotation[0] = -80;
  joints.shinKiri.rotation[0] = 75;
  joints.shinKanan.rotation[0] = 75;
  joints.upperArmKiri.rotation[0] = -55;
  joints.upperArmKanan.rotation[0] = -55;
  joints.lowerArmKiri.rotation[0] = -20;
  joints.lowerArmKanan.rotation[0] = -20;
  joints.torso.rotation[0] = 8;
}

// --------------------------------------------------------------------
// JALUR: posisi & arah pada polyline berdasarkan jarak tempuh
// --------------------------------------------------------------------
function pathLength(path) {
  let total = 0;

  for (let i = 1; i < path.length; i++) {
    total += Vec3.length(Vec3.subtract(path[i], path[i - 1]));
  }

  return total;
}

export function samplePath(path, distance) {
  let remaining = distance;

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const seg = Vec3.length(Vec3.subtract(b, a));

    if (remaining <= seg || i === path.length - 1) {
      const t = Math.min(remaining / seg, 1);
      return { position: Vec3.lerp(a, b, t), direction: Vec3.normalize(Vec3.subtract(b, a)) };
    }

    remaining -= seg;
  }

  return { position: [...path[0]], direction: [0, 0, 1] };
}

// Belok halus: interpolasi sudut lewat jalur terpendek
function turnTowards(current, target, k) {
  let diff = (target - current) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return current + diff * k;
}

// --------------------------------------------------------------------
// Semua mahasiswa
// --------------------------------------------------------------------
export function createStudents({ gl }) {
  const group = new Node("Mahasiswa");
  const random = createRandom(4242);

  for (let i = 0; i < S.count; i++) {
    const hijab = random() < S.hijabChance;
    const look = {
      skin: SKIN_TONES[Math.floor(random() * SKIN_TONES.length)],
      shirt: S.shirtColors[Math.floor(random() * S.shirtColors.length)],
      pants: S.pantsColors[Math.floor(random() * S.pantsColors.length)],
      hijab,
      hijabColor: [[0.88, 0.72, 0.72], [0.2, 0.2, 0.25], [0.82, 0.78, 0.7]][Math.floor(random() * 3)],
      backpack: random() < 0.6,
      bagColor: [[0.1, 0.1, 0.12], [0.25, 0.3, 0.45], [0.45, 0.32, 0.2]][Math.floor(random() * 3)],
      longSleeve: random() < 0.5
    };

    const { root, joints } = createPersonModel(gl, `Mahasiswa ${i + 1}`, look);

    // Dua mahasiswa terakhir berdiri di dekat taman (seperti di video)
    const idle = i >= S.count - 2;
    const path = S.paths[i % S.paths.length];
    const length = pathLength(path);

    root.userData = {
      joints,
      idle,
      path,
      length,
      distance: random() * length,
      direction: random() < 0.5 ? 1 : -1,     // bolak-balik
      speed: S.walkSpeed[0] + random() * (S.walkSpeed[1] - S.walkSpeed[0]),
      lateral: (random() - 0.5) * 1.6,          // geser kiri-kanan dari garis jalur
      phase: random() * Math.PI * 2,
      heading: 0
    };

    if (idle) {
      root.position = i === S.count - 1 ? [-12.2, 0, 26.4] : [-11.4, 0, 27.0];
      root.rotation[1] = i === S.count - 1 ? 60 : -120;
    }

    root.onUpdate = updateStudent;
    group.add(root);
  }

  return group;
}

function updateStudent(node, dt, time) {
  const d = node.userData;

  if (d.idle) {
    applyIdlePose(d.joints, time, d.phase);
    return;
  }

  // ---- TRANSLASI sepanjang jalur (bolak-balik) ----
  d.distance += d.speed * d.direction * dt;

  if (d.distance > d.length) {
    d.distance = d.length;
    d.direction = -1;
  } else if (d.distance < 0) {
    d.distance = 0;
    d.direction = 1;
  }

  const sample = samplePath(d.path, d.distance);
  const forward = Vec3.scale(sample.direction, d.direction);
  const side = [forward[2], 0, -forward[0]];   // tegak lurus arah jalan
  node.position = Vec3.add(sample.position, Vec3.scale(side, d.lateral));

  // ---- ROTASI Y: menghadap arah jalan (berbalik dengan halus) ----
  const targetHeading = Math.atan2(forward[0], forward[2]) * 180 / Math.PI;
  d.heading = turnTowards(d.heading, targetHeading, 1 - Math.exp(-6 * dt));
  node.rotation[1] = d.heading;

  // ---- Ayunan tangan & kaki ----
  // 1 siklus langkah ≈ 1.4 m → kecepatan fase sebanding kecepatan jalan
  d.phase += (d.speed / 1.4) * Math.PI * 2 * dt;
  applyWalkPose(d.joints, d.phase, lerp(24, 32, (d.speed - 1) / 0.6));
}
