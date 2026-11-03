
import { CONFIG } from "./config.js";
import { Node, createMaterial } from "./scene-graph.js";
import { Meshes, getMesh, createBox, createEllipseDisc, createArcWall, createTaperedBox } from "./geometry.js";
import { createRandom, Vec3 } from "./math3d.js";

const G = CONFIG.garden;
const P = CONFIG.props;

export function createProps({ gl, tm, lighting, world }) {
  const group = new Node("Properti");

  group.add(createGarden(gl, tm, lighting));
  group.add(createBoomGate(gl, tm, "Palang Parkir Kiri", P.boomGateLeft, false, world));
  group.add(createBoomGate(gl, tm, "Palang Parkir Kanan", P.boomGateRight, true, world));
  group.add(createGuardPost(gl, tm, lighting));
  group.add(createLamps(gl, lighting));
  group.add(createBins(gl));

  return group;
}

// TAMAN DEPAN
//   Taman Depan
//   ├─ Dinding Planter → Bingkai Tosca (Atas, Kiri, Kanan)
//   ├─ Rumput Taman (setengah elips) ; Kerb Melengkung
//   ├─ Totem F-SCIENTICS → Papan Depan ; Papan Belakang ; Lis Hijau
//   ├─ Semak Kuning i → Gumpalan j
//   ├─ Tanaman Ungu i
//   ├─ Palem Kecil → Batang Palem → Pelepah i (bergoyang)
//   └─ Tanaman Runcing i → Bilah Daun j (SKALA bergoyang)

function createGarden(gl, tm, lighting) {
  const garden = new Node("Taman Depan", { position: [...G.center] });
  const random = createRandom(55);

  // Dinding planter + bingkai tosca
  const tosca = createMaterial({ name: "tosca", color: [0.45, 0.82, 0.7], specular: 0.35, shininess: 24 });
  const wall = garden.add(new Node("Dinding Planter", {
    position: [0, G.wallHeight / 2, 0],
    mesh: getMesh(gl, "planterWall", () => createBox(G.wallLength, G.wallHeight, 0.45, { tile: [2, 1] })),
    material: createMaterial({ name: "granit", texture: tm.get("planterWall"), specular: 0.5, shininess: 40 })
  }));

  wall.add(new Node("Bingkai Tosca Atas", {
    position: [0, G.wallHeight / 2 + 0.08, 0],
    mesh: Meshes.cube(gl),
    meshScale: [G.wallLength + 0.3, 0.16, 0.6],
    material: tosca
  }));

  for (const side of [-1, 1]) {
    wall.add(new Node(side < 0 ? "Bingkai Tosca Kiri" : "Bingkai Tosca Kanan", {
      position: [side * (G.wallLength / 2 + 0.05), 0, 0.02],
      mesh: Meshes.cube(gl),
      meshScale: [0.28, G.wallHeight, 0.58],
      material: tosca
    }));
  }

  // Rumput & kerb setengah elips
  garden.add(new Node("Rumput Taman", {
    position: [0, 0.12, 0.25],
    mesh: getMesh(gl, "gardenDisc", () => createEllipseDisc(40, 0, Math.PI)),
    meshScale: [G.radiusX, 1, G.radiusZ],
    material: createMaterial({ name: "rumput taman", color: [0.95, 1.0, 0.9], texture: tm.get("grass"), uvScale: [3, 3], specular: 0.03 }),
    castShadow: false
  }));

  garden.add(new Node("Kerb Melengkung", {
    position: [0, 0, 0.25],
    mesh: getMesh(gl, "gardenCurb", () => createArcWall(G.radiusX + 0.25, G.radiusZ + 0.25, 0.3, 0.2, 48, 0, Math.PI)),
    material: createMaterial({ name: "kerb", color: [0.75, 0.75, 0.74], texture: tm.get("concrete"), specular: 0.05 })
  }));

  // Totem F-SCIENTICS
  const [tw, th, td] = G.totemSize;
  const totemOffset = Vec3.subtract(G.totemPosition, G.center);
  const blue = createMaterial({ name: "biru totem", color: [0.13, 0.36, 0.68], specular: 0.4, shininess: 32 });
  const totem = garden.add(new Node("Totem F-SCIENTICS", {
    position: [totemOffset[0], th / 2, totemOffset[2]],
    mesh: Meshes.cube(gl),
    meshScale: [tw, th, td],
    material: blue
  }));

  const signMaterial = createMaterial({
    name: "papan totem",
    texture: tm.get("totem"),
    specular: 0.35,
    shininess: 32,
    nightEmissive: [0.55, 0.6, 0.7]    
  });

  totem.add(new Node("Papan Depan", {
    position: [0, 0, td / 2 + 0.005],
    mesh: Meshes.quad(gl),
    meshScale: [tw, th, 1],
    material: signMaterial,
    castShadow: false
  }));

  totem.add(new Node("Papan Belakang", {
    position: [0, 0, -td / 2 - 0.005],
    rotation: [0, 180, 0],
    mesh: Meshes.quad(gl),
    meshScale: [tw, th, 1],
    material: signMaterial,
    castShadow: false
  }));

  totem.add(new Node("Lis Hijau", {
    position: [-tw / 2 - 0.03, 0, 0],
    mesh: Meshes.cube(gl),
    meshScale: [0.06, th, td + 0.02],
    material: createMaterial({ name: "hijau totem", color: [0.25, 0.68, 0.42], specular: 0.3 })
  }));

  // Semak kuning
  const yellow = createMaterial({ name: "semak kuning", color: [0.95, 0.95, 0.75], texture: tm.get("leaves"), uvScale: [2, 2], specular: 0.1 });
  yellow.color = [2.4, 2.1, 0.55]; 
  const shrubSpots = [[-1.2, 2.3], [2.6, 2.2], [5.0, 1.4], [-4.5, 1.6]];

  shrubSpots.forEach(([x, z], i) => {
    const shrub = garden.add(new Node(`Semak Kuning ${i + 1}`, { position: [x, 0.1, z] }));

    for (let j = 0; j < 4; j++) {
      const r = 0.45 + random() * 0.3;
      shrub.add(new Node(`Gumpalan ${j + 1}`, {
        position: [(j - 1.5) * 0.45, r * 0.55, random() * 0.4 - 0.2],
        mesh: Meshes.sphereLow(gl),
        meshScale: [r * 1.1, r * 0.75, r],
        material: yellow
      }));
    }
  });

  // Tanaman ungu rendah di tepi depan
  const purple = createMaterial({ name: "tanaman ungu", color: [0.42, 0.22, 0.42], specular: 0.1 });

  for (let i = 0; i < 7; i++) {
    const a = 0.35 + (i / 6) * (Math.PI - 0.7);
    garden.add(new Node(`Tanaman Ungu ${i + 1}`, {
      position: [Math.cos(a) * (G.radiusX - 1.1), 0.18, 0.25 + Math.sin(a) * (G.radiusZ - 0.9)],
      mesh: Meshes.sphereLow(gl),
      meshScale: [0.55, 0.18, 0.4],
      material: purple
    }));
  }

  // Palem kecil
  garden.add(createPalm(gl, tm, [-5.0, 0.1, -1.2], 3.4));
  garden.add(createPalm(gl, tm, [-6.6, 0.1, 1.0], 2.4));

  // Tanaman berdaun runcing
  const spiky = createMaterial({ name: "daun runcing", color: [0.35, 0.55, 0.3], specular: 0.15 });

  [[-3.0, 0.8], [0.8, 0.9], [6.2, 0.7], [-6.8, 0.6]].forEach(([x, z], i) => {
    const phase = random() * Math.PI * 2;
    const plant = garden.add(new Node(`Tanaman Runcing ${i + 1}`, {
      position: [x, 0.12, z],
      onUpdate: (node, dt, time) => {
        // SKALA: bergoyang kecil
        const s = 1 + 0.04 * Math.sin(time * 2.2 + phase);
        node.scale = [s, 1 + 0.03 * Math.cos(time * 2.0 + phase), s];
      }
    }));

    for (let j = 0; j < 7; j++) {
      plant.add(new Node(`Bilah Daun ${j + 1}`, {
        rotation: [0, j * (360 / 7), 18 + random() * 22],
        mesh: Meshes.cone(gl),
        meshScale: [0.06, 0.8 + random() * 0.4, 0.06],
        material: spiky
      }));
    }
  });

  return garden;
}

// Palem: batang miring sedikit
function createPalm(gl, tm, position, height) {
  const phase = position[0] * 1.7;
  const palm = new Node("Palem Kecil", { position });
  const trunk = palm.add(new Node("Batang Palem", {
    rotation: [0, 0, 4],
    mesh: Meshes.cylinderTaper(gl),
    meshScale: [0.12, height, 0.12],
    material: createMaterial({ name: "batang palem", color: [0.7, 0.62, 0.5], texture: tm.get("bark"), specular: 0.05 }),
    onUpdate: (node, dt, time) => {
      node.rotation[2] = 4 + 2 * Math.sin(time * 1.3 + phase);
    }
  }));

  const frondMaterial = createMaterial({ name: "pelepah", color: [0.75, 0.95, 0.6], texture: tm.get("leaves"), specular: 0.1 });

  for (let i = 0; i < 8; i++) {
    const frondPhase = i * 0.8;
    trunk.add(new Node(`Pelepah ${i + 1}`, {
      position: [0, height, 0],
      rotation: [0, i * 45, 65],
      mesh: Meshes.cone(gl),
      meshScale: [0.28, 1.5, 0.06],
      material: frondMaterial,
      onUpdate: (node, dt, time) => {
        node.rotation[2] = 65 + 6 * Math.sin(time * 2.0 + frondPhase + phase);
      }
    }));
  }

  return palm;
}

function createBoomGate(gl, tm, name, cfg, raised, world) {
  const hazard = createMaterial({ name: "kuning-hitam", color: [1, 1, 1], texture: tm.get("hazard"), uvScale: [1, 1], specular: 0.3 });
  const hazardArm = createMaterial({ name: "lengan palang", color: [1, 1, 1], texture: tm.get("hazard"), uvScale: [cfg.length * 1.5, 1], specular: 0.3 });
  const gate = new Node(name, { position: [...cfg.position] });

  const post = gate.add(new Node("Tiang Palang", {
    position: [0, 0.55, 0],
    mesh: Meshes.cube(gl),
    meshScale: [0.32, 1.1, 0.32],
    material: hazard
  }));

  const closedAngle = raised ? 58 : 0;

  const pivot = post.add(new Node("Pivot Lengan", {
    position: [0, 0.45, 0],
    rotation: [0, 0, closedAngle],
    userData: { angle: closedAngle },
    onUpdate: (node, dt, time) => {
      if (raised) {
        node.rotation[2] = closedAngle + 1.5 * Math.sin(time * 1.5);
        return;
      }

      const gatePos = gate.position;
      const near = (world.vehiclePositions || []).some((p) =>
        p && Math.hypot(p[0] - (gatePos[0] + cfg.length / 2), p[2] - gatePos[2]) < 7);
      const target = near ? 80 : 0;
      node.userData.angle += (target - node.userData.angle) * (1 - Math.exp(-3 * dt));
      node.rotation[2] = node.userData.angle;
    }
  }));

  // Lengan
  const arm = pivot.add(new Node("Lengan Palang", {
    mesh: Meshes.cube(gl),
    meshScale: [cfg.length, 0.1, 0.1],
    meshOffset: [cfg.length / 2, 0, 0],
    material: hazardArm
  }));

  if (raised) {
    const flagPhase = 1.3;
    arm.add(new Node("Bendera Kuning", {
      position: [cfg.length * 0.72, 0.35, 0],
      mesh: Meshes.quad(gl),
      meshScale: [0.7, 0.55, 1],
      material: createMaterial({ name: "bendera", color: [0.95, 0.85, 0.12], specular: 0.1 }),
      onUpdate: (node, dt, time) => {
        node.rotation[1] = 25 * Math.sin(time * 3.0 + flagPhase);
      },
      castShadow: false
    }));
  }

  for (let i = 1; i <= 3; i++) {
    gate.add(new Node(`Tiang Pembatas ${i}`, {
      position: [i * (cfg.length / 3), 0.45, -0.8],
      mesh: Meshes.cylinder(gl),
      meshScale: [0.08, 0.9, 0.08],
      material: hazard
    }));
  }

  return gate;
}


// POS SATPAM 
function createGuardPost(gl, tm, lighting) {
  const post = new Node("Pos Satpam", { position: [...P.gazeboPosition], rotation: [0, -15, 0] });

  const floor = post.add(new Node("Lantai Pos", {
    position: [0, 0.15, 0],
    mesh: Meshes.cube(gl),
    meshScale: [4.4, 0.3, 4.4],
    material: createMaterial({ name: "lantai pos", color: [0.6, 0.6, 0.58], specular: 0.05 })
  }));

  const walls = floor.add(new Node("Dinding Pos", {
    position: [0, 1.45, 0],
    mesh: Meshes.cube(gl),
    meshScale: [3.4, 2.6, 3.4],
    material: createMaterial({ name: "dinding pos", texture: tm.get("gazeboWall"), specular: 0.1, nightEmissive: [0.4, 0.35, 0.2] })
  }));

  const roof = walls.add(new Node("Atap Limas", {
    position: [0, 1.3, 0],
    mesh: getMesh(gl, "hipRoof", () => createTaperedBox(6.0, 6.0, 0.3, 0.3, 2.6)),
    material: createMaterial({ name: "atap genteng", color: [1, 1, 1], texture: tm.get("roofTile"), uvScale: [2, 2], specular: 0.15 })
  }));

  roof.add(new Node("Puncak Atap", {
    position: [0, 2.6, 0],
    mesh: Meshes.cone(gl),
    meshScale: [0.12, 0.6, 0.12],
    material: createMaterial({ name: "puncak", color: [0.85, 0.85, 0.82], specular: 0.3 })
  }));

  const lampWorld = Vec3.add(P.gazeboPosition, [0, 2.8, 2.1]);
  walls.add(new Node("Lampu Pos", {
    position: [0, 1.0, 1.75],
    mesh: Meshes.sphereLow(gl),
    meshScale: [0.12, 0.12, 0.12],
    material: createMaterial({ name: "bohlam", color: [1, 0.95, 0.8], nightEmissive: [2.0, 1.7, 1.0] }),
    castShadow: false
  }));
  lighting.addPointLight(lampWorld, [1.0, 0.75, 0.45]);

  return post;
}


// LAMPU TAMAN 

function createLamps(gl, lighting) {
  const lamps = new Node("Lampu Taman");
  const poleMat = createMaterial({ name: "tiang lampu", color: [0.15, 0.16, 0.18], specular: 0.5, shininess: 32 });
  const bulbMat = createMaterial({ name: "lampu", color: [0.95, 0.95, 0.9], nightEmissive: [2.2, 2.0, 1.5] });

  P.lampPositions.forEach((position, i) => {
    const lamp = lamps.add(new Node(`Lampu ${i + 1}`, { position: [...position] }));

    const pole = lamp.add(new Node("Tiang Lampu", {
      mesh: Meshes.cylinder(gl),
      meshScale: [0.07, 4.2, 0.07],
      material: poleMat
    }));

    pole.add(new Node("Kepala Lampu", {
      position: [0, 4.3, 0],
      mesh: Meshes.sphereLow(gl),
      meshScale: [0.25, 0.2, 0.25],
      material: bulbMat,
      castShadow: false
    }));

    lighting.addPointLight(Vec3.add(position, [0, 4.1, 0]), [1.0, 0.82, 0.55]);
  });

  return lamps;
}

function createBins(gl) {
  const bins = new Node("Tempat Sampah");
  const blue = createMaterial({ name: "biru sampah", color: [0.12, 0.35, 0.75], specular: 0.5, shininess: 32 });

  P.binPositions.forEach((p, i) => {
    bins.add(new Node(`Tong ${i + 1}`, {
      position: p,
      mesh: Meshes.cylinder(gl),
      meshScale: [0.32, 0.95, 0.32],
      material: blue
    }));
  });

  return bins;
}
