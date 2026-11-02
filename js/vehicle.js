// =====================================================================
// vehicle.js — Motor yang lewat (Anggota B)
// ---------------------------------------------------------------------
// Banyak motor (termasuk ojol berjaket hijau) terlihat di video.
//
// Hierarki satu motor:
//   Motor (TRANSLASI di jalur + ROTASI Y menghadap arah)
//   ├─ Rangka Motor → Jok ; Spakbor Belakang ; Lampu Belakang
//   ├─ Garpu Depan (miring) → Stang ; Lampu Depan
//   │   └─ Poros Roda Depan (ROTASI: roda berputar) → Ban ; Velg ; Jari-jari
//   ├─ Poros Roda Belakang (ROTASI) → Ban ; Velg ; Jari-jari
//   └─ Pengendara (model mahasiswa pose duduk + helm)
//
// Putaran roda dihitung dari jarak tempuh:  sudut = jarak / jari-jari
// (dalam radian) → roda tidak "selip" terhadap kecepatan motor.
// =====================================================================

import { CONFIG } from "./config.js";
import { Node, createMaterial } from "./scene-graph.js";
import { Meshes } from "./geometry.js";
import { createPersonModel, applySeatedPose } from "./student.js";
import { Vec3 } from "./math3d.js";

const V = CONFIG.vehicles;
const WHEEL_RADIUS = 0.3;

function createWheel(gl, name, position, materials) {
  const axle = new Node(name, { position });

  // Silinder berdiri (sumbu Y) diputar 90° di Z → sumbu roda = X
  axle.add(new Node("Ban", {
    rotation: [0, 0, 90],
    mesh: Meshes.cylinder(gl),
    meshScale: [WHEEL_RADIUS, 0.12, WHEEL_RADIUS],
    meshOffset: [0, -0.06, 0],
    material: materials.tire
  }));

  axle.add(new Node("Velg", {
    rotation: [0, 0, 90],
    mesh: Meshes.cylinder(gl),
    meshScale: [WHEEL_RADIUS * 0.6, 0.14, WHEEL_RADIUS * 0.6],
    meshOffset: [0, -0.07, 0],
    material: materials.rim
  }));

  // Jari-jari: dua batang bersilang agar putaran roda TERLIHAT
  for (let k = 0; k < 2; k++) {
    axle.add(new Node(`Jari-jari ${k + 1}`, {
      rotation: [k * 90, 0, 0],
      mesh: Meshes.cube(gl),
      meshScale: [0.15, WHEEL_RADIUS * 1.6, 0.04],
      material: materials.tire
    }));
  }

  return axle;
}

function createMotorcycle(gl, index, bodyColor, riderLook) {
  const m = {
    body: createMaterial({ name: "bodi motor", color: bodyColor, specular: 0.9, shininess: 64 }),
    dark: createMaterial({ name: "hitam", color: [0.07, 0.07, 0.08], specular: 0.3 }),
    tire: createMaterial({ name: "ban", color: [0.05, 0.05, 0.05], specular: 0.05 }),
    rim: createMaterial({ name: "velg", color: [0.7, 0.7, 0.72], specular: 0.8, shininess: 64 }),
    headlight: createMaterial({ name: "lampu depan", color: [0.95, 0.95, 0.9], emissive: [0.15, 0.15, 0.12], nightEmissive: [1.2, 1.15, 0.9] }),
    taillight: createMaterial({ name: "lampu belakang", color: [0.7, 0.05, 0.05], nightEmissive: [0.9, 0.05, 0.05] })
  };

  const motor = new Node(`Motor ${index + 1}`);

  const frame = motor.add(new Node("Rangka Motor", {
    position: [0, 0.52, 0],
    mesh: Meshes.cube(gl),
    meshScale: [0.32, 0.36, 1.2],
    material: m.body
  }));

  frame.add(new Node("Jok", {
    position: [0, 0.24, -0.18],
    mesh: Meshes.cube(gl),
    meshScale: [0.3, 0.1, 0.62],
    material: m.dark
  }));

  frame.add(new Node("Spakbor Belakang", {
    position: [0, 0.05, -0.58],
    mesh: Meshes.cube(gl),
    meshScale: [0.22, 0.12, 0.35],
    material: m.body
  }));

  frame.add(new Node("Lampu Belakang", {
    position: [0, 0.1, -0.77],
    mesh: Meshes.cube(gl),
    meshScale: [0.16, 0.06, 0.04],
    material: m.taillight,
    castShadow: false
  }));

  // Garpu depan miring 20° (rake) — roda depan adalah ANAK garpu
  const fork = motor.add(new Node("Garpu Depan", {
    position: [0, 0.95, 0.55],
    rotation: [-20, 0, 0],   // negatif → ujung bawah garpu condong ke depan
    mesh: Meshes.cube(gl),
    meshScale: [0.08, 0.7, 0.08],
    meshOffset: [0, -0.35, 0],
    material: m.dark
  }));

  fork.add(new Node("Stang", {
    position: [0, 0.08, 0],
    mesh: Meshes.cube(gl),
    meshScale: [0.7, 0.05, 0.05],
    material: m.dark
  }));

  fork.add(new Node("Lampu Depan", {
    position: [0, -0.05, 0.12],
    mesh: Meshes.sphereLow(gl),
    meshScale: [0.09, 0.07, 0.06],
    material: m.headlight,
    castShadow: false
  }));

  const front = fork.add(createWheel(gl, "Poros Roda Depan", [0, -0.68, 0], m));
  front.rotation = [20, 0, 0]; // batalkan kemiringan garpu agar roda tegak

  const rear = motor.add(createWheel(gl, "Poros Roda Belakang", [0, WHEEL_RADIUS, -0.55], m));

  // Pengendara (pose duduk). Disimpan untuk animasi bila perlu.
  const rider = createPersonModel(gl, "Pengendara", riderLook);
  rider.root.position = [0, 0.02, -0.25];
  applySeatedPose(rider.joints);
  motor.add(rider.root);

  motor.userData.wheels = [front, rear];
  return motor;
}

// --------------------------------------------------------------------
// Semua motor + logika jalur. `world.vehiclePositions` dibaca props.js
// (palang parkir terbuka bila ada motor mendekat).
// --------------------------------------------------------------------
export function createVehicles({ gl, world }) {
  const group = new Node("Kendaraan");
  world.vehiclePositions = [];

  const riders = [
    { skin: [0.74, 0.55, 0.42], shirt: V.jacketOjol, pants: [0.15, 0.15, 0.18], helmet: true, helmetColor: [0.2, 0.62, 0.25], longSleeve: true },
    { skin: [0.86, 0.68, 0.55], shirt: [0.6, 0.72, 0.85], pants: [0.25, 0.3, 0.45], helmet: true, helmetColor: [0.9, 0.9, 0.9], longSleeve: true },
    { skin: [0.62, 0.45, 0.33], shirt: [0.1, 0.1, 0.12], pants: [0.12, 0.12, 0.14], helmet: true, helmetColor: [0.1, 0.1, 0.1], longSleeve: true }
  ];

  const [cx, , cz] = V.loopCenter;
  const [rx, rz] = V.loopRadius;

  // ---- Motor yang mengelilingi taman (lintasan elips) ----
  for (let i = 0; i < V.loopCount; i++) {
    const motor = createMotorcycle(gl, i, V.bodyColors[i % V.bodyColors.length], riders[i % riders.length]);
    const circumference = Math.PI * (3 * (rx + rz) - Math.sqrt((3 * rx + rz) * (rx + 3 * rz)));

    motor.userData.angle = (i / V.loopCount) * Math.PI * 2 + 0.6;
    motor.onUpdate = (node, dt) => {
      const d = node.userData;
      // Kecepatan sudut ≈ kecepatan linear / keliling × 2π
      d.angle += (V.loopSpeed / circumference) * Math.PI * 2 * dt;

      const a = d.angle;
      node.position = [cx + Math.cos(a) * rx, 0, cz + Math.sin(a) * rz];

      // Arah = turunan posisi terhadap sudut
      const tangent = [-Math.sin(a) * rx, 0, Math.cos(a) * rz];
      node.rotation[1] = Math.atan2(tangent[0], tangent[2]) * 180 / Math.PI;

      spinWheels(node, V.loopSpeed * dt);
      world.vehiclePositions[i] = node.position;
    };

    group.add(motor);
  }

  // ---- Motor yang lewat palang parkir kiri (bolak-balik) ----
  const gateIndex = V.loopCount;
  const gateMotor = createMotorcycle(gl, gateIndex, V.bodyColors[2], riders[2]);
  const [start, end] = V.gatePath;
  const gateLength = Vec3.length(Vec3.subtract(end, start));

  gateMotor.userData.distance = 0;
  gateMotor.userData.direction = 1;
  gateMotor.userData.heading = 0;
  gateMotor.userData.wait = 0;

  gateMotor.onUpdate = (node, dt) => {
    const d = node.userData;

    // Berhenti sebentar di ujung jalur, lalu putar balik
    if (d.wait > 0) {
      d.wait -= dt;
      return;
    }

    d.distance += V.gateSpeed * d.direction * dt;

    if (d.distance > gateLength || d.distance < 0) {
      d.distance = Math.max(0, Math.min(gateLength, d.distance));
      d.direction *= -1;
      d.wait = 2.0;
    }

    node.position = Vec3.lerp(start, end, d.distance / gateLength);
    const dir = Vec3.scale(Vec3.normalize(Vec3.subtract(end, start)), d.direction);
    const target = Math.atan2(dir[0], dir[2]) * 180 / Math.PI;
    let diff = ((target - d.heading) % 360 + 540) % 360 - 180;
    d.heading += diff * (1 - Math.exp(-5 * dt));
    node.rotation[1] = d.heading;

    spinWheels(node, V.gateSpeed * dt);
    world.vehiclePositions[gateIndex] = node.position;
  };

  group.add(gateMotor);
  return group;
}

// ROTASI roda: sudut (derajat) bertambah sesuai jarak / jari-jari
function spinWheels(node, distance) {
  const deltaDeg = (distance / WHEEL_RADIUS) * 180 / Math.PI;

  for (const wheel of node.userData.wheels) {
    wheel.rotation[0] += deltaDeg;
  }
}
