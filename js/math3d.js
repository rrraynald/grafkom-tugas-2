// =====================================================================
// math3d.js — Helper vektor & matrix 4x4
// ---------------------------------------------------------------------
// Gaya penulisan SAMA dengan math3d.js Praktikum 4 & 5:
//   - Matrix disimpan COLUMN-MAJOR di Float32Array(16)
//     (elemen [12],[13],[14] = translasi), sesuai format yang diminta
//     gl.uniformMatrix4fv(..., false, m).
//   - Mat4.multiply(a, b) menghasilkan a × b. Karena column-major,
//     titik ditransformasi dari KANAN: p' = a × b × p (b dulu, lalu a).
// Tambahan dibanding praktikum: translation, rotationZ, orthographic,
// beberapa fungsi Vec3, dan transformPoint (dipakai shadow & kamera).
// =====================================================================

export function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Interpolasi linear: t=0 → a, t=1 → b. Dipakai untuk smoothing kamera
// dan transisi warna langit/cahaya.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export const Vec3 = {
  add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  },

  subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },

  scale(v, s) {
    return [v[0] * s, v[1] * s, v[2] * s];
  },

  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },

  cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  },

  length(v) {
    return Math.hypot(v[0], v[1], v[2]);
  },

  normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]);

    if (length < 0.000001) {
      return [0, 0, 0];
    }

    return [v[0] / length, v[1] / length, v[2] / length];
  },

  lerp(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
};

export const Mat4 = {
  identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  },

  translation(tx, ty, tz) {
    return new Float32Array([
      1,  0,  0,  0,
      0,  1,  0,  0,
      0,  0,  1,  0,
      tx, ty, tz, 1
    ]);
  },

  rotationX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
      1,  0, 0, 0,
      0,  c, s, 0,
      0, -s, c, 0,
      0,  0, 0, 1
    ]);
  },

  rotationY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
      c, 0, -s, 0,
      0, 1,  0, 0,
      s, 0,  c, 0,
      0, 0,  0, 1
    ]);
  },

  rotationZ(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
       c, s, 0, 0,
      -s, c, 0, 0,
       0, 0, 1, 0,
       0, 0, 0, 1
    ]);
  },

  scaling(x, y, z) {
    return new Float32Array([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1
    ]);
  },

  // result = a * b  (column-major, sama persis dengan Praktikum 5)
  multiply(a, b) {
    const out = new Float32Array(16);

    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;

        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[col * 4 + k];
        }

        out[col * 4 + row] = sum;
      }
    }

    return out;
  },

  // Mengalikan matrix dengan titik (w = 1). Dipakai misalnya untuk
  // mengambil posisi dunia matahari dari matrix dunianya.
  transformPoint(m, p) {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;

    return [
      (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
    ];
  },

  // View matrix (sama dengan Praktikum 5): basis kamera
  //   z = arah DARI target KE mata (kamera melihat ke -z)
  //   x = up × z  (kanan),  y = z × x (atas yang sudah dikoreksi)
  lookAt(eye, target, up) {
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];

    let len = Math.hypot(zx, zy, zz);
    zx /= len; zy /= len; zz /= len;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;

    len = Math.hypot(xx, xy, xz);
    xx /= len; xy /= len; xz /= len;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
      1
    ]);
  },

  perspective(fovY, aspect, near, far) {
    const f = 1.0 / Math.tan(fovY / 2);
    const nf = 1.0 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0,                   0,
      0,          f, 0,                   0,
      0,          0, (far + near) * nf,  -1,
      0,          0, 2 * far * near * nf, 0
    ]);
  },

  // Sama dengan Praktikum 4. Dipakai untuk toggle orthographic DAN
  // untuk kamera "cahaya matahari" saat membuat shadow map.
  orthographic(left, right, bottom, top, near, far) {
    return new Float32Array([
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, -2 / (far - near), 0,

      -(right + left) / (right - left),
      -(top + bottom) / (top - bottom),
      -(far + near) / (far - near),
      1
    ]);
  }
};

// Normal matrix = transpose(inverse(3x3 kiri-atas model)).
// Sama dengan Praktikum 5. Penting saat model diskalakan TIDAK seragam
// (contoh: bilah louver yang tipis), agar normal tetap tegak lurus
// permukaan.
export function normalMatrixFromMat4(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  let det = a00 * b01 + a01 * b11 + a02 * b21;

  if (Math.abs(det) < 0.000001) {
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  det = 1.0 / det;

  const inv00 = b01 * det;
  const inv01 = (-a22 * a01 + a02 * a21) * det;
  const inv02 = (a12 * a01 - a02 * a11) * det;

  const inv10 = b11 * det;
  const inv11 = (a22 * a00 - a02 * a20) * det;
  const inv12 = (-a12 * a00 + a02 * a10) * det;

  const inv20 = b21 * det;
  const inv21 = (-a21 * a00 + a01 * a20) * det;
  const inv22 = (a11 * a00 - a01 * a10) * det;

  // transpose(inverse)
  return new Float32Array([
    inv00, inv10, inv20,
    inv01, inv11, inv21,
    inv02, inv12, inv22
  ]);
}

// Random dengan seed tetap → posisi pohon/warna baju mahasiswa selalu
// sama setiap kali halaman dibuka (penting saat demo ke dosen).
export function createRandom(seed) {
  let s = seed >>> 0;

  return function random() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
