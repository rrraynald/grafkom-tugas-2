// =====================================================================
// scene-graph.js — HIERARCHICAL MODELLING (Scene Graph)
// ---------------------------------------------------------------------
// Materi ini belum ada di praktikum, jadi dijelaskan lengkap di sini.
//
// IDE DASAR
//   Setiap objek adalah NODE yang punya transformasi LOKAL (relatif ke
//   induknya). Posisi akhir di dunia dihitung dengan mengalikan matrix
//   dari akar sampai node tersebut:
//
//     worldMatrix(node) = worldMatrix(parent) × localMatrix(node)
//
//   Akibatnya: jika INDUK bergerak/berputar, semua ANAK ikut.
//   Contoh: lengan atas berayun → lengan bawah & tangan ikut berayun;
//   batang pohon bergoyang → cabang & daun ikut bergoyang.
//
// URUTAN LOCAL MATRIX (dibaca dari kanan ke kiri saat diterapkan):
//
//     localMatrix = T(position) × Ry × Rx × Rz × S(scale)
//
//   Titik di-scale dulu, diputar (Z, X, lalu Y), baru dipindah.
//   Karena rotasi terjadi SEBELUM translasi, rotasi selalu berporos di
//   titik (0,0,0) lokal node = "sendi/pivot" node tersebut.
//
// DUA JENIS SKALA
//   - scale     : DITURUNKAN ke anak (dipakai efek pohon tumbuh: seluruh
//                 pohon membesar bersama cabangnya).
//   - meshScale : HANYA untuk bentuk mesh node itu sendiri, TIDAK
//                 diturunkan. Contoh: badan mahasiswa berbentuk kubus
//                 pipih (meshScale), tetapi lengan yang menempel di
//                 badan tidak ikut menjadi pipih.
//   - meshOffset: geser mesh relatif terhadap pivot (contoh: kubus lengan
//                 digeser ke bawah agar pivotnya ada di bahu).
// =====================================================================

import { Mat4, degToRad } from "./math3d.js";

let nodeIdCounter = 0;

export class Node {
  constructor(name, options = {}) {
    this.id = nodeIdCounter++;
    this.name = name;

    // ---- Transformasi lokal ----
    this.position = options.position ? [...options.position] : [0, 0, 0];
    this.rotation = options.rotation ? [...options.rotation] : [0, 0, 0]; // DERAJAT
    this.scale = options.scale ? [...options.scale] : [1, 1, 1];

    // ---- Bentuk ----
    this.mesh = options.mesh || null;
    this.material = options.material || null;
    this.meshScale = options.meshScale ? [...options.meshScale] : [1, 1, 1];
    this.meshOffset = options.meshOffset ? [...options.meshOffset] : [0, 0, 0];

    // ---- Lain-lain ----
    this.visible = options.visible !== undefined ? options.visible : true;
    this.castShadow = options.castShadow !== undefined ? options.castShadow : true;
    this.onUpdate = options.onUpdate || null;  // fungsi animasi node ini
    this.userData = options.userData || {};    // data bebas (fase, kecepatan)

    // ---- Hierarki ----
    this.parent = null;
    this.children = [];

    // ---- Hasil perhitungan per frame ----
    this.localMatrix = Mat4.identity();
    this.worldMatrix = Mat4.identity();
  }

  // Menambahkan anak. Mengembalikan anak agar bisa dirangkai:
  //   const arm = torso.add(new Node("Lengan"));
  add(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  // --------------------------------------------------------------
  // 1) UPDATE: jalankan animasi setiap node (rekursif, induk dulu)
  // --------------------------------------------------------------
  update(dt, time) {
    if (this.onUpdate) {
      this.onUpdate(this, dt, time);
    }

    for (const child of this.children) {
      child.update(dt, time);
    }
  }

  // --------------------------------------------------------------
  // 2) LOCAL MATRIX = T × Ry × Rx × Rz × S
  // --------------------------------------------------------------
  computeLocalMatrix() {
    const [px, py, pz] = this.position;
    const [rx, ry, rz] = this.rotation;
    const [sx, sy, sz] = this.scale;

    let m = Mat4.translation(px, py, pz);

    if (ry !== 0) m = Mat4.multiply(m, Mat4.rotationY(degToRad(ry)));
    if (rx !== 0) m = Mat4.multiply(m, Mat4.rotationX(degToRad(rx)));
    if (rz !== 0) m = Mat4.multiply(m, Mat4.rotationZ(degToRad(rz)));

    if (sx !== 1 || sy !== 1 || sz !== 1) {
      m = Mat4.multiply(m, Mat4.scaling(sx, sy, sz));
    }

    this.localMatrix = m;
    return m;
  }

  // --------------------------------------------------------------
  // 3) TRAVERSAL: hitung world matrix dari akar ke daun (rekursif)
  //    dan kumpulkan node yang punya mesh ke drawList.
  //    parentMatrix × localMatrix  ← inti hierarchical modelling
  // --------------------------------------------------------------
  computeWorld(parentMatrix, drawList) {
    if (!this.visible) {
      return;
    }

    this.computeLocalMatrix();
    this.worldMatrix = Mat4.multiply(parentMatrix, this.localMatrix);

    if (this.mesh) {
      // Matrix khusus untuk menggambar mesh (offset & meshScale tidak
      // diturunkan ke anak).
      let drawMatrix = this.worldMatrix;
      const [ox, oy, oz] = this.meshOffset;
      const [mx, my, mz] = this.meshScale;

      if (ox !== 0 || oy !== 0 || oz !== 0) {
        drawMatrix = Mat4.multiply(drawMatrix, Mat4.translation(ox, oy, oz));
      }

      if (mx !== 1 || my !== 1 || mz !== 1) {
        drawMatrix = Mat4.multiply(drawMatrix, Mat4.scaling(mx, my, mz));
      }

      drawList.push({ node: this, matrix: drawMatrix });
    }

    for (const child of this.children) {
      child.computeWorld(this.worldMatrix, drawList);
    }
  }

  // Posisi dunia node (kolom translasi dari world matrix)
  getWorldPosition() {
    const m = this.worldMatrix;
    return [m[12], m[13], m[14]];
  }

  // Cari node berdasarkan nama (dipakai UI & debugging)
  find(name) {
    if (this.name === name) {
      return this;
    }

    for (const child of this.children) {
      const found = child.find(name);

      if (found) {
        return found;
      }
    }

    return null;
  }

  countNodes() {
    let count = 1;

    for (const child of this.children) {
      count += child.countNodes();
    }

    return count;
  }
}

// =====================================================================
// MATERIAL: kumpulan sifat permukaan yang dikirim ke shader.
// Nilai default di sini; tiap objek cukup menimpa yang berbeda.
// =====================================================================
export function createMaterial(options = {}) {
  return {
    name: options.name || "material",
    color: options.color || [1, 1, 1],          // u_baseColor
    texture: options.texture || null,           // u_texture
    uvScale: options.uvScale || [1, 1],         // u_uvScale
    shininess: options.shininess ?? 16,         // u_shininess
    specular: options.specular ?? 0.2,          // u_specularStrength
    reflectivity: options.reflectivity ?? 0,    // u_reflectivity (kaca)
    emissive: options.emissive || [0, 0, 0],    // selalu menyala
    nightEmissive: options.nightEmissive || [0, 0, 0], // menyala malam
    emissiveTexture: options.emissiveTexture || null,
    unlit: options.unlit || false
  };
}
