// =====================================================================
// geometry.js — Primitif 3D buatan sendiri (posisi + normal + UV)
// ---------------------------------------------------------------------
// Semua primitif dibuat sebagai daftar SEGITIGA tanpa index, sama seperti
// cube di Praktikum 4/5 (gl.drawArrays(gl.TRIANGLES, ...)).
//
// Setiap generator mengembalikan:
//   { positions: [...], normals: [...], texCoords: [...] }
//   - normals = "smooth normal" (normal permukaan yang sebenarnya,
//     untuk bola/silinder = normal melengkung)
//   - flat normal dihitung otomatis per segitiga di createMesh()
//     → tombol F mengganti FLAT ↔ SMOOTH seperti di Praktikum 5.
//
// Primitif: cube, box (UV dalam meter), plane, sphere, cylinder, cone,
// taperedBox (limas terpancung / piramida), prism (atap pelana),
// ellipseDisc (taman setengah elips), arcWall (dinding melengkung).
// =====================================================================

// ---------------------------------------------------------------------
// Helper kecil: menambahkan satu QUAD (2 segitiga) ke data.
// p0..p3 berurutan berlawanan jarum jam (CCW) dilihat dari depan.
// ---------------------------------------------------------------------
function pushQuad(data, p0, p1, p2, p3, normal, uv0, uv1, uv2, uv3) {
  const verts = [p0, p1, p2, p0, p2, p3];
  const uvs = [uv0, uv1, uv2, uv0, uv2, uv3];

  for (let i = 0; i < 6; i++) {
    data.positions.push(...verts[i]);
    data.normals.push(...normal);
    data.texCoords.push(...uvs[i]);
  }
}

function emptyData() {
  return { positions: [], normals: [], texCoords: [] };
}

function faceNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

// ---------------------------------------------------------------------
// CUBE satuan (−0.5..0.5), UV 0..1 per sisi — sama dengan Praktikum 5.
// Dipakai untuk benda kecil yang diskalakan lewat node (bilah louver,
// tiang, badan motor, tubuh mahasiswa, dll).
// ---------------------------------------------------------------------
export function createCube() {
  return createBox(1, 1, 1, { unitUV: true });
}

// ---------------------------------------------------------------------
// BOX dengan ukuran asli (meter), berpusat di (0,0,0).
// Jika options.tile = [tu, tv] → UV dihitung dalam METER / tile,
// sehingga texture fasad tidak "melar" walaupun sisi depan (17 m) dan
// sisi samping (13 m) berbeda lebar. Ini kunci agar grid panel rapi.
// Jika options.unitUV = true → UV 0..1 per sisi (seperti cube praktikum).
// ---------------------------------------------------------------------
export function createBox(w, h, d, options = {}) {
  const data = emptyData();
  const x = w / 2, y = h / 2, z = d / 2;
  const tu = options.tile ? options.tile[0] : 1;
  const tv = options.tile ? options.tile[1] : 1;

  // Ukuran sisi (lebar, tinggi) untuk menghitung UV dalam meter
  function uv(faceW, faceH) {
    if (options.unitUV || !options.tile) {
      return [[0, 0], [1, 0], [1, 1], [0, 1]];
    }

    const u = faceW / tu;
    const v = faceH / tv;
    return [[0, 0], [u, 0], [u, v], [0, v]];
  }

  let t;
  // Depan (+Z)
  t = uv(w, h);
  pushQuad(data, [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1], ...t);
  // Belakang (−Z)
  t = uv(w, h);
  pushQuad(data, [x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1], ...t);
  // Kiri (−X)
  t = uv(d, h);
  pushQuad(data, [-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0], ...t);
  // Kanan (+X)
  t = uv(d, h);
  pushQuad(data, [x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0], ...t);
  // Atas (+Y)
  t = uv(w, d);
  pushQuad(data, [-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0], ...t);
  // Bawah (−Y)
  t = uv(w, d);
  pushQuad(data, [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0], ...t);

  return data;
}

// ---------------------------------------------------------------------
// PLANE horizontal (bidang XZ, menghadap +Y), berpusat di (0,0,0).
// tileU/tileV = berapa kali texture diulang (wrap REPEAT).
// ---------------------------------------------------------------------
export function createPlane(w, d, tileU = 1, tileV = 1) {
  const data = emptyData();
  const x = w / 2, z = d / 2;

  pushQuad(
    data,
    [-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z],
    [0, 1, 0],
    [0, 0], [tileU, 0], [tileU, tileV], [0, tileV]
  );

  return data;
}

// Plane VERTIKAL (bidang XY, menghadap +Z) — untuk papan nama/tulisan.
export function createQuad(w, h) {
  const data = emptyData();
  const x = w / 2, y = h / 2;

  pushQuad(
    data,
    [-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0],
    [0, 0, 1],
    [0, 0], [1, 0], [1, 1], [0, 1]
  );

  return data;
}

// ---------------------------------------------------------------------
// SPHERE jari-jari 1 (latitude-longitude). Normal = posisi (karena r=1).
// ---------------------------------------------------------------------
export function createSphere(latBands = 14, lonBands = 18) {
  const data = emptyData();

  function point(lat, lon) {
    const theta = (lat / latBands) * Math.PI;        // 0..π (atas→bawah)
    const phi = (lon / lonBands) * Math.PI * 2;      // 0..2π
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.cos(theta);
    const z = Math.sin(theta) * Math.sin(phi);
    return { p: [x, y, z], uv: [lon / lonBands, 1 - lat / latBands] };
  }

  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const a = point(lat, lon);
      const b = point(lat + 1, lon);
      const c = point(lat + 1, lon + 1);
      const d = point(lat, lon + 1);

      // Dua segitiga, urutan CCW dilihat dari luar bola
      for (const v of [a, d, c, a, c, b]) {
        data.positions.push(...v.p);
        data.normals.push(...v.p);
        data.texCoords.push(...v.uv);
      }
    }
  }

  return data;
}

// ---------------------------------------------------------------------
// CYLINDER dari y=0 (alas) sampai y=1 (atas). Pivot di ALAS → cocok
// untuk batang/cabang pohon & lengan/kaki: rotasi node = rotasi di sendi.
// radiusTop = 0 → menjadi CONE (kerucut).
// ---------------------------------------------------------------------
export function createCylinder(radiusBottom = 1, radiusTop = 1, segments = 16, caps = true) {
  const data = emptyData();
  const slope = radiusBottom - radiusTop; // untuk normal sisi kerucut

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);

    const b0 = [c0 * radiusBottom, 0, s0 * radiusBottom];
    const b1 = [c1 * radiusBottom, 0, s1 * radiusBottom];
    const t0 = [c0 * radiusTop, 1, s0 * radiusTop];
    const t1 = [c1 * radiusTop, 1, s1 * radiusTop];

    // Normal sisi miring: (cos, slope, sin) dinormalisasi
    const n0 = normalize3([c0, slope, s0]);
    const n1 = normalize3([c1, slope, s1]);

    const u0 = i / segments, u1 = (i + 1) / segments;
    const verts = [
      [b0, n0, [u0, 0]], [t1, n1, [u1, 1]], [b1, n1, [u1, 0]],
      [b0, n0, [u0, 0]], [t0, n0, [u0, 1]], [t1, n1, [u1, 1]]
    ];

    for (const [p, n, uv] of verts) {
      data.positions.push(...p);
      data.normals.push(...n);
      data.texCoords.push(...uv);
    }

    if (caps) {
      // Tutup bawah
      if (radiusBottom > 0) {
        for (const p of [[0, 0, 0], b0, b1]) {
          data.positions.push(...p);
          data.normals.push(0, -1, 0);
          data.texCoords.push(p[0] * 0.5 + 0.5, p[2] * 0.5 + 0.5);
        }
      }

      // Tutup atas
      if (radiusTop > 0) {
        for (const p of [[0, 1, 0], t1, t0]) {
          data.positions.push(...p);
          data.normals.push(0, 1, 0);
          data.texCoords.push(p[0] * 0.5 + 0.5, p[2] * 0.5 + 0.5);
        }
      }
    }
  }

  return data;
}

export function createCone(segments = 16) {
  return createCylinder(1, 0, segments, true);
}

function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------------------------------------------------------------------
// TAPERED BOX: kotak yang alas & atasnya beda ukuran, y = 0..h.
//   - topW = topD = 0 → piramida (atap pos satpam)
//   - top > bottom → melebar ke atas (kanopi atap Tower 1 yang menjorok)
// ---------------------------------------------------------------------
export function createTaperedBox(bw, bd, tw, td, h) {
  const data = emptyData();
  const B = [
    [-bw / 2, 0, bd / 2], [bw / 2, 0, bd / 2],
    [bw / 2, 0, -bd / 2], [-bw / 2, 0, -bd / 2]
  ];
  const T = [
    [-tw / 2, h, td / 2], [tw / 2, h, td / 2],
    [tw / 2, h, -td / 2], [-tw / 2, h, -td / 2]
  ];
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];

  // 4 sisi miring: depan, kanan, belakang, kiri
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const n = faceNormal(B[i], B[j], T[j]);
    pushQuad(data, B[i], B[j], T[j], T[i], n, ...uv);
  }

  // Tutup atas (jika ada)
  if (tw > 0 && td > 0) {
    pushQuad(data, T[0], T[1], T[2], T[3], [0, 1, 0], ...uv);
  }

  // Tutup bawah
  pushQuad(data, B[3], B[2], B[1], B[0], [0, -1, 0], ...uv);

  return data;
}

// ---------------------------------------------------------------------
// PRISM segitiga (atap pelana), punggung atap sejajar sumbu Z.
// Lebar w (X), tinggi h (Y, dari 0), panjang d (Z), berpusat di X & Z.
// UV dalam meter / tile agar genteng tidak melar.
// ---------------------------------------------------------------------
export function createPrism(w, h, d, tile = 1) {
  const data = emptyData();
  const x = w / 2, z = d / 2;
  const slopeLen = Math.hypot(x, h);

  // Sisi miring kiri & kanan
  const nL = normalize3([-h, x, 0]);
  const nR = normalize3([h, x, 0]);
  const u = d / tile, v = slopeLen / tile;

  pushQuad(data, [-x, 0, -z], [-x, 0, z], [0, h, z], [0, h, -z], nL,
    [0, 0], [u, 0], [u, v], [0, v]);
  pushQuad(data, [x, 0, z], [x, 0, -z], [0, h, -z], [0, h, z], nR,
    [0, 0], [u, 0], [u, v], [0, v]);

  // Segitiga depan & belakang
  const tri = (a, b, c, n) => {
    for (const p of [a, b, c]) {
      data.positions.push(...p);
      data.normals.push(...n);
      data.texCoords.push((p[0] + x) / tile, p[1] / tile);
    }
  };

  tri([-x, 0, z], [x, 0, z], [0, h, z], [0, 0, 1]);
  tri([x, 0, -z], [-x, 0, -z], [0, h, -z], [0, 0, -1]);

  return data;
}

// ---------------------------------------------------------------------
// ELLIPSE DISC: bidang datar (menghadap +Y) berbentuk elips jari-jari 1
// dari sudut a0 sampai a1 (radian). a0=0, a1=π → setengah elips ke +Z.
// UV dalam meter (setelah diskalakan) diatur lewat uvScale material.
// ---------------------------------------------------------------------
export function createEllipseDisc(segments = 32, a0 = 0, a1 = Math.PI * 2) {
  const data = emptyData();

  for (let i = 0; i < segments; i++) {
    const t0 = a0 + (a1 - a0) * (i / segments);
    const t1 = a0 + (a1 - a0) * ((i + 1) / segments);
    const p0 = [Math.cos(t0), 0, Math.sin(t0)];
    const p1 = [Math.cos(t1), 0, Math.sin(t1)];

    for (const p of [[0, 0, 0], p1, p0]) {
      data.positions.push(...p);
      data.normals.push(0, 1, 0);
      data.texCoords.push(p[0] * 0.5 + 0.5, p[2] * 0.5 + 0.5);
    }
  }

  return data;
}

// ---------------------------------------------------------------------
// ARC WALL: dinding/kerb melengkung mengikuti elips (rx, rz).
// Dipakai untuk kerb beton taman depan yang melengkung.
// ---------------------------------------------------------------------
export function createArcWall(rx, rz, thickness, height, segments = 40, a0 = 0, a1 = Math.PI) {
  const data = emptyData();

  for (let i = 0; i < segments; i++) {
    const t0 = a0 + (a1 - a0) * (i / segments);
    const t1 = a0 + (a1 - a0) * ((i + 1) / segments);

    const o0 = [Math.cos(t0) * rx, Math.sin(t0) * rz];
    const o1 = [Math.cos(t1) * rx, Math.sin(t1) * rz];
    const i0 = [Math.cos(t0) * (rx - thickness), Math.sin(t0) * (rz - thickness)];
    const i1 = [Math.cos(t1) * (rx - thickness), Math.sin(t1) * (rz - thickness)];

    const nOut = normalize3([Math.cos((t0 + t1) / 2) / rx, 0, Math.sin((t0 + t1) / 2) / rz]);
    const nIn = [-nOut[0], 0, -nOut[2]];
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];

    // Sisi luar
    pushQuad(data, [o1[0], 0, o1[1]], [o0[0], 0, o0[1]],
      [o0[0], height, o0[1]], [o1[0], height, o1[1]], nOut, ...uv);
    // Sisi dalam
    pushQuad(data, [i0[0], 0, i0[1]], [i1[0], 0, i1[1]],
      [i1[0], height, i1[1]], [i0[0], height, i0[1]], nIn, ...uv);
    // Atas
    pushQuad(data, [i0[0], height, i0[1]], [i1[0], height, i1[1]],
      [o1[0], height, o1[1]], [o0[0], height, o0[1]], [0, 1, 0], ...uv);
  }

  return data;
}

// =====================================================================
// MESH: upload data ke GPU (buffer) — gaya createArrayBuffer Praktikum 5
// =====================================================================

export function createArrayBuffer(gl, data) {
  const buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  return buffer;
}

// Hitung FLAT normal: tiap segitiga memakai satu normal (normal bidang
// segitiga tsb). Inilah yang membuat bola terlihat "bersegi" saat
// mode FLAT, persis seperti eksperimen Flat vs Smooth di Praktikum 5.
function computeFlatNormals(positions) {
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 9) {
    const a = [positions[i], positions[i + 1], positions[i + 2]];
    const b = [positions[i + 3], positions[i + 4], positions[i + 5]];
    const c = [positions[i + 6], positions[i + 7], positions[i + 8]];
    const n = faceNormal(a, b, c);

    for (let k = 0; k < 3; k++) {
      normals.set(n, i + k * 3);
    }
  }

  return normals;
}

// Ubah segitiga menjadi garis (3 sisi per segitiga) untuk mode wireframe.
function computeWireframe(positions) {
  const lines = [];

  for (let i = 0; i < positions.length; i += 9) {
    const a = positions.slice(i, i + 3);
    const b = positions.slice(i + 3, i + 6);
    const c = positions.slice(i + 6, i + 9);
    lines.push(...a, ...b, ...b, ...c, ...c, ...a);
  }

  return new Float32Array(lines);
}

export function createMesh(gl, data) {
  const positions = new Float32Array(data.positions);
  const smoothNormals = new Float32Array(data.normals);
  const flatNormals = computeFlatNormals(positions);
  const texCoords = new Float32Array(data.texCoords);

  return {
    positionBuffer: createArrayBuffer(gl, positions),
    smoothNormalBuffer: createArrayBuffer(gl, smoothNormals),
    flatNormalBuffer: createArrayBuffer(gl, flatNormals),
    texCoordBuffer: createArrayBuffer(gl, texCoords),
    vertexCount: positions.length / 3,
    // Buffer garis dibuat hanya jika wireframe dinyalakan (hemat memori)
    wireBuffer: null,
    wireCount: 0,
    getWireBuffer() {
      if (!this.wireBuffer) {
        const lines = computeWireframe(positions);
        this.wireBuffer = createArrayBuffer(gl, lines);
        this.wireCount = lines.length / 3;
      }

      return this.wireBuffer;
    }
  };
}

// =====================================================================
// Cache mesh: primitif yang sama dipakai bersama oleh banyak node.
// Contoh: 1 mesh cube dipakai ratusan bilah louver → hemat memori GPU.
// =====================================================================
const meshCache = new Map();

export function getMesh(gl, key, buildFn) {
  if (!meshCache.has(key)) {
    meshCache.set(key, createMesh(gl, buildFn()));
  }

  return meshCache.get(key);
}

export function getMeshCount() {
  return meshCache.size;
}

// Shortcut yang sering dipakai modul objek
export const Meshes = {
  cube: (gl) => getMesh(gl, "cube", createCube),
  sphere: (gl) => getMesh(gl, "sphere", () => createSphere(14, 18)),
  sphereLow: (gl) => getMesh(gl, "sphereLow", () => createSphere(7, 9)),
  cylinder: (gl) => getMesh(gl, "cylinder", () => createCylinder(1, 1, 14)),
  cylinderTaper: (gl) => getMesh(gl, "cylTaper", () => createCylinder(1, 0.7, 10)),
  cone: (gl) => getMesh(gl, "cone", () => createCone(16)),
  quad: (gl) => getMesh(gl, "quad", () => createQuad(1, 1))
};
