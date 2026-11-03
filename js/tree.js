
import { CONFIG } from "./config.js";
import { Node, createMaterial } from "./scene-graph.js";
import { Meshes } from "./geometry.js";
import { createRandom } from "./math3d.js";

const T = CONFIG.trees;

const TREE_TYPES = {
  hero: { trunkRatio: 0.3, primaries: 12, tiltMin: 25, tiltMax: 55, branchRatio: 0.2, leafStretch: 1.15, spread: 1.0, secondaries: 3, crownStart: 0.22, leafSize: 0.72 },
  round: { trunkRatio: 0.45, primaries: 7, tiltMin: 30, tiltMax: 58, branchRatio: 0.36, leafStretch: 0.9, spread: 0.95, secondaries: 3, leafSize: 0.8 },
  wide: { trunkRatio: 0.35, primaries: 9, tiltMin: 45, tiltMax: 70, branchRatio: 0.48, leafStretch: 0.8, spread: 1.0, secondaries: 3, leafSize: 0.8 },
  far: { trunkRatio: 0.4, primaries: 3, tiltMin: 30, tiltMax: 55, branchRatio: 0.4, leafStretch: 0.85, spread: 1.0, secondaries: 0, leafSize: 1.1 },
  tall: { trunkRatio: 0.6, primaries: 5, tiltMin: 18, tiltMax: 40, branchRatio: 0.28, leafStretch: 1.1, spread: 0.6, secondaries: 2, leafSize: 0.8 }
};

let materials = null;

function getMaterials(tm) {
  if (!materials) {
    materials = {
      bark: createMaterial({
        name: "kulit kayu",
        color: T.colors.bark.map((c) => c * 1.6),
        texture: tm.get("bark"),
        uvScale: [2, 3],
        specular: 0.04,
        shininess: 4
      }),
      leaves: [
        createMaterial({ name: "daun 1", color: [0.6, 0.68, 0.56], texture: tm.get("leaves"), uvScale: [3, 2], specular: 0.12, shininess: 10 }),
        createMaterial({ name: "daun 2", color: [0.5, 0.6, 0.5], texture: tm.get("leaves"), uvScale: [3, 2], specular: 0.12, shininess: 10 }),
        createMaterial({ name: "daun 3", color: [0.68, 0.74, 0.55], texture: tm.get("leaves"), uvScale: [3, 2], specular: 0.12, shininess: 10 })
      ]
    };
  }

  return materials;
}

// Animasi gugus daun: SKALA berdenyut halus (seolah daun tertiup angin)
function leafUpdate(node, dt, time) {
  const s = 1 + T.leafPulse * Math.sin(time * 1.7 + node.userData.phase);
  node.scale = [s, 1 + T.leafPulse * 0.6 * Math.cos(time * 1.3 + node.userData.phase), s];
}

function createLeafCluster(gl, name, position, radius, stretch, material, random) {
  return new Node(name, {
    position,
    mesh: Meshes.sphere(gl),
    meshScale: [radius * (0.9 + random() * 0.25), radius * stretch, radius * (0.9 + random() * 0.25)],
    material,
    userData: { phase: random() * Math.PI * 2 },
    onUpdate: leafUpdate
  });
}

// Membuat 1 pohon
export function createTree({ gl, tm }, options) {
  const {
    name = "Pohon",
    position = [0, 0, 0],
    height = 10,
    crownRadius = 4,
    type = "round",
    seed = 1
  } = options;

  const shape = TREE_TYPES[type] || TREE_TYPES.round;
  const random = createRandom(seed);
  const mats = getMaterials(tm);
  const leafMaterial = () => mats.leaves[Math.floor(random() * mats.leaves.length)];

  const trunkHeight = height * shape.trunkRatio;
  const trunkRadius = Math.max(0.12, height * 0.022);
  const swayPhase = random() * Math.PI * 2;

  // ---- ROOT: efek TUMBUH (skala 0 → 1 di awal animasi) ----
  const tree = new Node(name, {
    position,
    rotation: [0, random() * 360, 0],
    userData: { grow: 0 },
    onUpdate: (node, dt) => {
      if (node.userData.grow < 1) {
        node.userData.grow = Math.min(1, node.userData.grow + dt / T.growDuration);
        const g = 1 - Math.pow(1 - node.userData.grow, 3);
        node.scale = [g, g, g];
      }
    }
  });

  // ---- BATANG: ROTASI goyang di pangkal ----
  const trunk = tree.add(new Node("Batang", {
    mesh: Meshes.cylinderTaper(gl),
    meshScale: [trunkRadius, shape.crownStart ? height * 0.8 : trunkHeight * 1.08, trunkRadius],
    material: mats.bark,
    onUpdate: (node, dt, time) => {
      const a = T.swayAmplitude;
      node.rotation[2] = a * Math.sin(time * T.swaySpeed + swayPhase);
      node.rotation[0] = a * 0.6 * Math.cos(time * T.swaySpeed * 0.8 + swayPhase);
    }
  }));

  trunk.add(createLeafCluster(gl, "Gugus Daun Pucuk",
    [0, height - crownRadius * shape.leafStretch * 0.9, 0],
    crownRadius * 0.75, shape.leafStretch * 1.1, leafMaterial(), random));

  // ---- CABANG PRIMER ----
  for (let i = 0; i < shape.primaries; i++) {
    const crownStart = shape.crownStart ?? 0.55;
    const heightOnTrunk = shape.crownStart
      ? height * (crownStart + (0.78 - crownStart) * (i / (shape.primaries - 1)))
      : trunkHeight * (crownStart + 0.45 * (i / shape.primaries)) + random() * 0.6;
    const tilt = shape.tiltMin + random() * (shape.tiltMax - shape.tiltMin);
    const yaw = (i / shape.primaries) * 360 + random() * 30;
    const length = height * shape.branchRatio * (0.75 + random() * 0.4) * shape.spread;
    const branchRadius = trunkRadius * 0.55;
    const branchPhase = random() * Math.PI * 2;

    const primary = trunk.add(new Node(`Cabang Primer ${i + 1}`, {
      position: [0, heightOnTrunk, 0],
      rotation: [0, yaw, tilt],
      mesh: Meshes.cylinderTaper(gl),
      meshScale: [branchRadius, length, branchRadius],
      material: mats.bark,
      userData: { baseTilt: tilt },
      onUpdate: (node, dt, time) => {
        node.rotation[2] = node.userData.baseTilt + 2.5 * Math.sin(time * 1.6 + branchPhase);
      }
    }));

    const leafSize = shape.leafSize ?? 1;
    primary.add(createLeafCluster(gl, "Gugus Daun",
      [0, length, 0], crownRadius * leafSize * (0.5 + random() * 0.2), shape.leafStretch, leafMaterial(), random));

    // ---- CABANG SEKUNDER ----
    for (let j = 0; j < shape.secondaries; j++) {
      const secLength = length * (0.45 + random() * 0.25);
      const secondary = primary.add(new Node(`Cabang Sekunder ${j + 1}`, {
        position: [0, length * (0.45 + 0.25 * j), 0],
        rotation: [0, random() * 360, -25 + random() * 50],
        mesh: Meshes.cylinderTaper(gl),
        meshScale: [branchRadius * 0.6, secLength, branchRadius * 0.6],
        material: mats.bark
      }));

      secondary.add(createLeafCluster(gl, "Gugus Daun",
        [0, secLength, 0], crownRadius * leafSize * (0.38 + random() * 0.18), shape.leafStretch, leafMaterial(), random));
    }
  }

  return tree;
}

// Semua pohon scene: pohon besar depan gedung + pohon lain (LOOP)
export function createTrees(context) {
  const group = new Node("Pepohonan");
  const hero = T.hero;

  group.add(createTree(context, {
    name: "Pohon Besar Depan Gedung",
    position: hero.position,
    height: hero.height,
    crownRadius: hero.crownRadius,
    type: "hero",
    seed: 101
  }));

  const others = group.add(new Node("Pohon Lain"));

  T.others.forEach(([x, z, height, radius, type], i) => {
    others.add(createTree(context, {
      name: `Pohon ${i + 1} (${type})`,
      position: [x, 0, z],
      height,
      crownRadius: radius,
      type,
      seed: 200 + i * 17
    }));
  });

  // Pohon latar: posisi acak (seed tetap) di cincin jauh, kecuali koridor
  const background = group.add(new Node("Pohon Latar"));
  const random = createRandom(909);
  const bg = T.background;
  let placed = 0;

  while (placed < bg.count) {
    const angle = random() * Math.PI * 2;
    const radius = bg.radius[0] + random() * (bg.radius[1] - bg.radius[0]);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (z > 40 && x > -110 && x < 60) {
      continue;  
    }

    background.add(createTree(context, {
      name: `Pohon Latar ${placed + 1}`,
      position: [x, 0, z],
      height: 10 + random() * 8,
      crownRadius: 4.5 + random() * 3,
      type: "far",
      seed: 3000 + placed * 7
    }));
    placed++;
  }

  return group;
}
