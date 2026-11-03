

import { Mat4, degToRad } from "./math3d.js";

let nodeIdCounter = 0;

export class Node {
  constructor(name, options = {}) {
    this.id = nodeIdCounter++;
    this.name = name;

    //  Transformasi lokal 
    this.position = options.position ? [...options.position] : [0, 0, 0];
    this.rotation = options.rotation ? [...options.rotation] : [0, 0, 0];
    this.scale = options.scale ? [...options.scale] : [1, 1, 1];

    //  Bentuk 
    this.mesh = options.mesh || null;
    this.material = options.material || null;
    this.meshScale = options.meshScale ? [...options.meshScale] : [1, 1, 1];
    this.meshOffset = options.meshOffset ? [...options.meshOffset] : [0, 0, 0];

    //  Lain-lain 
    this.visible = options.visible !== undefined ? options.visible : true;
    this.castShadow = options.castShadow !== undefined ? options.castShadow : true;
    this.onUpdate = options.onUpdate || null;  
    this.userData = options.userData || {};    

    //  Hierarki 
    this.parent = null;
    this.children = [];

    //  Hasil perhitungan per frame 
    this.localMatrix = Mat4.identity();
    this.worldMatrix = Mat4.identity();
  }

  add(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  // 1) UPDATE: jalankan animasi setiap node 
  update(dt, time) {
    if (this.onUpdate) {
      this.onUpdate(this, dt, time);
    }

    for (const child of this.children) {
      child.update(dt, time);
    }
  }

  // 2) LOCAL MATRIX = T × Ry × Rx × Rz × S
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

  // 3) TRAVERSAL
  computeWorld(parentMatrix, drawList) {
    if (!this.visible) {
      return;
    }

    this.computeLocalMatrix();
    this.worldMatrix = Mat4.multiply(parentMatrix, this.localMatrix);

    if (this.mesh) {
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

  getWorldPosition() {
    const m = this.worldMatrix;
    return [m[12], m[13], m[14]];
  }

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

// MATERIAL
export function createMaterial(options = {}) {
  return {
    name: options.name || "material",
    color: options.color || [1, 1, 1],          
    texture: options.texture || null,           
    uvScale: options.uvScale || [1, 1],         
    shininess: options.shininess ?? 16,         
    specular: options.specular ?? 0.2,          
    reflectivity: options.reflectivity ?? 0,    
    emissive: options.emissive || [0, 0, 0],    
    nightEmissive: options.nightEmissive || [0, 0, 0], 
    emissiveTexture: options.emissiveTexture || null,
    unlit: options.unlit || false
  };
}
