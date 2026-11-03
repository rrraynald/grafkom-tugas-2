import { Mat4, Vec3, degToRad, clamp, lerp } from "./math3d.js";
import { CONFIG } from "./config.js";

const C = CONFIG.camera;

function directionFromYawPitch(yaw, pitch) {
  const y = degToRad(yaw);
  const p = degToRad(pitch);

  return [
    Math.sin(y) * Math.cos(p),
    Math.sin(p),
    -Math.cos(y) * Math.cos(p)
  ];
}

function yawPitchFromDirection(dir) {
  const d = Vec3.normalize(dir);

  return {
    yaw: Math.atan2(d[0], -d[2]) * 180 / Math.PI,
    pitch: Math.asin(clamp(d[1], -1, 1)) * 180 / Math.PI
  };
}

// Pilih sudut yang setara (±360°) paling dekat dengan sudut sekarang,
function closestAngle(current, target) {
  let diff = (target - current) % 360;

  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  return current + diff;
}

// Preset near/far
const CLIP_PRESETS = [
  { near: C.near, far: C.far },
  { near: 2.0, far: 300 },
  { near: 10.0, far: 120 }
];

export class Camera {
  constructor() {
    // Nilai yang SEDANG dipakai
    this.position = [...C.defaultPosition];
    this.yaw = 0;
    this.pitch = 0;
    this.fov = C.fov;

    // Nilai TUJUAN
    this.goal = { position: [...C.defaultPosition], yaw: 0, pitch: 0, fov: C.fov };

    this.up = [0, 1, 0];
    this.projectionState = { mode: "perspective", near: C.near, far: C.far };
    this.clipPresetIndex = 0;

    this.orbit = { enabled: false, angle: 0, radius: 60, height: 9 };
    this.activeMove = null;  
    this.autoTour = false;
    this.tourIndex = 0;

    this.reset(true);
  }

  // Posisi default: PALING JAUH, seluruh menara terlihat
  reset(instant = false) {
    this.activeMove = null;
    this.autoTour = false;
    this.orbit.enabled = false;
    this.projectionState.mode = "perspective";
    this.clipPresetIndex = 0;
    this.projectionState.near = CLIP_PRESETS[0].near;
    this.projectionState.far = CLIP_PRESETS[0].far;
    this.setGoalLookAt(C.defaultPosition, C.defaultTarget, C.fov, instant);
  }

  // Atur tujuan kamera dengan format lookAt (posisi + titik yang dilihat)
  setGoalLookAt(position, target, fov = this.goal.fov, instant = false) {
    const { yaw, pitch } = yawPitchFromDirection(Vec3.subtract(target, position));

    this.goal.position = [...position];
    this.goal.yaw = closestAngle(this.yaw, yaw);
    this.goal.pitch = pitch;
    this.goal.fov = fov;

    if (instant) {
      this.position = [...position];
      this.yaw = this.goal.yaw;
      this.pitch = pitch;
      this.fov = fov;
    }
  }

  get forward() {
    return directionFromYawPitch(this.yaw, this.pitch);
  }

  // target = position + forward (dipakai Mat4.lookAt seperti Praktikum 4)
  get target() {
    return Vec3.add(this.position, this.forward);
  }

  // PRESET KAMERA (tombol 1-4)
  applyPreset(name) {
    this.stopMoves();

    const presets = {
      overview: [C.defaultPosition, C.defaultTarget, C.fov],
      // Dekat gedung, mendongak
      near: [[-19.2, 1.6, 43.7], [-4.2, 22.2, 12.9], 50],
      // Sama dengan foto stop-motion-tilt/7: dari titik foto, mendongak ±20°
      tiltPhoto: [[-27, 1.6, 58], [-9.6, 15, 24.6], 42],
      // Sudut pandang mahasiswa di plaza
      student: [[-2, 1.6, 34], [3, 4, 12], 60],
      // Top view (dari atas)
      top: [[0.5, 150, 18.5], [0.5, 0, 18], 55]
    };

    const p = presets[name];

    if (p) {
      this.setGoalLookAt(p[0], p[1], p[2]);
    }
  }

  // GERAK KAMERA MENIRU VIDEO SURVEY (tombol 5-9)
  startMove(type) {
    this.orbit.enabled = false;

    const base = yawPitchFromDirection(Vec3.subtract(C.videoTarget, C.videoPosition));
    const start = [...C.videoPosition];

    // Mulai semua gerak dari titik perekaman video
    this.setGoalLookAt(C.videoPosition, C.videoTarget, C.videoFov);

    const moves = {
      // STAY: kamera diam (video stay.MOV)
      stay: { duration: 6, update: () => {} },

      // STAY 0.5×: lensa ultra-wide iPhone → FOV jauh lebih lebar
      stayWide: {
        duration: 6,
        update: () => { this.goal.fov = 92; }
      },

      // PAN: kamera diam di tempat, MENENGOK kanan lalu kiri (yaw)
      pan: {
        duration: 14,
        update: (t, d) => {
          const s = Math.sin((t / d) * Math.PI * 2);
          this.goal.yaw = closestAngle(this.yaw, base.yaw + 38 * s);
          this.goal.pitch = base.pitch;
        }
      },

      // TILT: kamera diam, MENDONGAK dari paving ke puncak lalu turun (pitch)
      tilt: {
        duration: 14,
        update: (t, d) => {
          const k = (1 - Math.cos((t / d) * Math.PI * 2)) / 2; // 0→1→0
          this.goal.pitch = lerp(-38, 46, k);
          this.goal.yaw = closestAngle(this.yaw, base.yaw);
        }
      },

      // ZOOM: posisi tetap, FOV menyempit (zoom in) lalu melebar
      zoom: {
        duration: 16,
        update: (t, d) => {
          const k = (1 - Math.cos((t / d) * Math.PI * 2)) / 2;
          const totemDir = yawPitchFromDirection(
            Vec3.subtract([-2.0, 4.0, 19.7], C.videoPosition));
          this.goal.yaw = closestAngle(this.yaw, lerp(base.yaw, totemDir.yaw, k));
          this.goal.pitch = lerp(base.pitch, totemDir.pitch, k);
          this.goal.fov = lerp(C.videoFov, 12, k);
        }
      },

      // DOLLY IN: kamera BERGERAK MAJU (translasi), FOV tetap
      dolly: {
        duration: 6,
        update: (t, d) => {
          const k = Math.min(t / d, 1);
          const dir = Vec3.normalize([C.videoTarget[0] - start[0], 0, C.videoTarget[2] - start[2]]);
          this.goal.position = Vec3.add(start, Vec3.scale(dir, 18 * k));
        }
      }
    };

    this.activeMove = { ...moves[type], type, time: 0 };
    return type;
  }

  stopMoves() {
    this.activeMove = null;
    this.autoTour = false;
    this.orbit.enabled = false;
  }

  toggleAutoTour() {
    const enable = !this.autoTour;
    this.stopMoves();
    this.autoTour = enable;
    this.tourIndex = 0;

    if (enable) {
      this.startMove("dolly");
    }

    return this.autoTour;
  }

  // Orbit camera
  toggleOrbit() {
    const enable = !this.orbit.enabled;
    this.stopMoves();
    this.orbit.enabled = enable;

    if (enable) {
      this.orbit.angle = Math.atan2(this.position[2], this.position[0]);
      this.orbit.radius = clamp(Math.hypot(this.position[0], this.position[2]), 30, 160);
      this.orbit.height = Math.max(this.position[1], 2);
    }

    return enable;
  }

  toggleProjection() {
    this.projectionState.mode =
      this.projectionState.mode === "perspective" ? "orthographic" : "perspective";
    return this.projectionState.mode;
  }

  nextClipPreset() {
    this.clipPresetIndex = (this.clipPresetIndex + 1) % CLIP_PRESETS.length;
    const preset = CLIP_PRESETS[this.clipPresetIndex];
    this.projectionState.near = preset.near;
    this.projectionState.far = preset.far;
    return preset;
  }

  // INPUT state-based
  handleKeys(keys, dt) {
    const anyKey = keys["w"] || keys["s"] || keys["a"] || keys["d"] ||
      keys["q"] || keys["e"] || keys["arrowup"] || keys["arrowdown"] ||
      keys["arrowleft"] || keys["arrowright"] || keys["pageup"] || keys["pagedown"];

    // Input manual menghentikan gerak otomatis
    if (anyKey && (this.activeMove || this.orbit.enabled)) {
      this.stopMoves();
    }

    const move = C.moveSpeed * dt;
    const turn = C.turnSpeed * dt;
    const forward = directionFromYawPitch(this.goal.yaw, this.goal.pitch);
    const right = Vec3.normalize(Vec3.cross(forward, this.up));
    let p = this.goal.position;

    if (keys["w"] || keys["arrowup"]) p = Vec3.add(p, Vec3.scale(forward, move));
    if (keys["s"] || keys["arrowdown"]) p = Vec3.add(p, Vec3.scale(forward, -move));
    if (keys["a"]) p = Vec3.add(p, Vec3.scale(right, -move));
    if (keys["d"]) p = Vec3.add(p, Vec3.scale(right, move));
    if (keys["pageup"]) p = Vec3.add(p, [0, move, 0]);
    if (keys["pagedown"]) p = Vec3.add(p, [0, -move, 0]);
    if (keys["arrowleft"] || keys["q"]) this.goal.yaw -= turn;
    if (keys["arrowright"] || keys["e"]) this.goal.yaw += turn;
    if (keys["["]) this.goal.fov -= 30 * dt;
    if (keys["]"]) this.goal.fov += 30 * dt;

    this.goal.position = this.constrain(p);
  }

  // Drag mouse = look-around (yaw & pitch)
  look(deltaX, deltaY) {
    if (this.activeMove || this.orbit.enabled) {
      this.stopMoves();
    }

    this.goal.yaw += deltaX * 0.18;
    this.goal.pitch -= deltaY * 0.18;
  }

  // Scroll = maju/mundur
  dollyBy(amount) {
    if (this.activeMove || this.orbit.enabled) {
      this.stopMoves();
    }

    const forward = directionFromYawPitch(this.goal.yaw, this.goal.pitch);
    this.goal.position = this.constrain(Vec3.add(this.goal.position, Vec3.scale(forward, amount)));
  }

  // BATASAN: tidak menembus menara, tidak di bawah tanah, tidak terlalu jauh
  constrain(p) {
    const b = CONFIG.building;
    const halfW = b.width / 2 + b.louverGap + 1.5;
    const halfD = b.depth / 2 + 1.5;
    const height = b.floors * b.floorHeight + b.crownHeight + 1.5;
    const result = [...p];

    result[1] = clamp(result[1], 0.6, 260);

    // Jika masuk ke kotak menara → dorong keluar lewat sisi terdekat
    if (Math.abs(result[0]) < halfW && Math.abs(result[2]) < halfD && result[1] < height) {
      const pushX = halfW - Math.abs(result[0]);
      const pushZ = halfD - Math.abs(result[2]);
      const pushY = height - result[1];
      const minPush = Math.min(pushX, pushZ, pushY);

      if (minPush === pushX) result[0] = Math.sign(result[0] || 1) * halfW;
      else if (minPush === pushZ) result[2] = Math.sign(result[2] || 1) * halfD;
      else result[1] = height;
    }

    // Jarak maksimum dari pusat scene
    const dist = Math.hypot(result[0], result[2]);

    if (dist > C.maxDistance) {
      result[0] *= C.maxDistance / dist;
      result[2] *= C.maxDistance / dist;
    }

    return result;
  }

  // UPDATE per frame: gerak otomatis + smoothing
  update(dt) {
    // 1) Gerak video aktif
    if (this.activeMove) {
      this.activeMove.time += dt;
      this.activeMove.update(this.activeMove.time, this.activeMove.duration);

      if (this.activeMove.time >= this.activeMove.duration) {
        this.activeMove = null;

        // Auto-tour
        if (this.autoTour) {
          const sequence = ["dolly", "pan", "tilt", "zoom"];
          this.tourIndex = (this.tourIndex + 1) % sequence.length;
          this.startMove(sequence[this.tourIndex]);
        }
      }
    }

    // 2) Orbit
    if (this.orbit.enabled) {
      this.orbit.angle += C.orbitSpeed * dt;
      const pos = [
        Math.cos(this.orbit.angle) * this.orbit.radius,
        this.orbit.height,
        Math.sin(this.orbit.angle) * this.orbit.radius
      ];
      this.setGoalLookAt(pos, [0, 20, 0], this.goal.fov);
    }

    // 3) Batas sudut & FOV
    this.goal.pitch = clamp(this.goal.pitch, -80, 80);
    this.goal.fov = clamp(this.goal.fov, 15, 100);

    // 4) SMOOTHING
    const k = 1 - Math.exp(-C.smoothing * dt);
    this.position = Vec3.lerp(this.position, this.goal.position, k);
    this.yaw = lerp(this.yaw, this.goal.yaw, k);
    this.pitch = lerp(this.pitch, this.goal.pitch, k);
    this.fov = lerp(this.fov, this.goal.fov, k);
  }

  // MATRIX
  getViewMatrix() {
    return Mat4.lookAt(this.position, this.target, this.up);
  }

  getProjectionMatrix(aspect) {
    const { mode, near, far } = this.projectionState;

    if (mode === "perspective") {
      return Mat4.perspective(degToRad(this.fov), aspect, near, far);
    }

    // Orthographic: ukuran disesuaikan dengan jarak ke menara agar
    const distance = Math.max(Vec3.length(Vec3.subtract(this.position, [0, 20, 0])), 10);
    const size = distance * Math.tan(degToRad(this.fov) / 2);

    return Mat4.orthographic(-size * aspect, size * aspect, -size, size, -400, far);
  }

  get statusText() {
    if (this.autoTour) return `Auto-tour (${this.activeMove ? this.activeMove.type : "-"})`;
    if (this.activeMove) return `Gerak: ${this.activeMove.type}`;
    if (this.orbit.enabled) return "Orbit";
    return "Manual";
  }
}
