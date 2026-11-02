// =====================================================================
// main.js — Inisialisasi WebGL2, susun scene graph, render loop, input
// ---------------------------------------------------------------------
// Alur per frame (sama seperti fungsi render(time) di Praktikum 4 & 5,
// hanya lebih banyak tahap):
//
//   1. dt = selisih waktu (maks 0.05 s)         ← sama dengan praktikum
//   2. Input & kamera (state-based: keys{})
//   3. scene.update(dt)   → animasi tiap node (rekursif)
//   4. scene.computeWorld → world matrix = parent × local (rekursif)
//   5. Lighting           → arah & warna matahari dari node Matahari
//   6. SHADOW PASS        → render kedalaman dari sudut pandang matahari
//   7. MAIN PASS          → langit, lalu semua objek (Phong/Blinn-Phong)
//   8. HUD
// =====================================================================

import { CONFIG } from "./config.js";
import { Mat4, normalMatrixFromMat4, Vec3 } from "./math3d.js";
import {
  sceneVertexShaderSource, sceneFragmentShaderSource,
  shadowVertexShaderSource, shadowFragmentShaderSource,
  skyVertexShaderSource, skyFragmentShaderSource,
  createProgram, getLocations
} from "./shaders.js";
import { getMeshCount } from "./geometry.js";
import { Node } from "./scene-graph.js";
import { TextureManager, createAllTextures } from "./texture.js";
import { Camera } from "./camera.js";
import { Lighting } from "./lighting.js";
import { createEnvironment } from "./environment.js";
import { createTower, createNeighborBuildings } from "./building.js";
import { createTrees } from "./tree.js";
import { createProps } from "./props.js";
import { createStudents } from "./student.js";
import { createVehicles } from "./vehicle.js";
import { setupUI } from "./ui.js";

// ---------- WebGL2 Context (sama dengan praktikum) ----------
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2", { antialias: true });

if (!gl) {
  const message = document.getElementById("glError");
  if (message) message.hidden = false;
  throw new Error("WebGL2 tidak tersedia di browser ini.");
}

gl.enable(gl.DEPTH_TEST);
// CULL_FACE sengaja TIDAK diaktifkan: papan/bendera/daun berupa bidang
// tipis yang harus terlihat dari dua sisi.

// ---------- Program shader ----------
const sceneProgram = createProgram(gl, sceneVertexShaderSource, sceneFragmentShaderSource);
const shadowProgram = createProgram(gl, shadowVertexShaderSource, shadowFragmentShaderSource);
const skyProgram = createProgram(gl, skyVertexShaderSource, skyFragmentShaderSource);

const sceneLoc = getLocations(gl, sceneProgram);
const shadowLoc = getLocations(gl, shadowProgram);
const skyLoc = getLocations(gl, skyProgram);

// ---------- Texture ----------
const textures = new TextureManager(gl);
createAllTextures(textures);

// Texture dari crop FOTO ASLI survey (daun pohon besar dari video
// zoom-in-out, dibuat tileable dengan mirror 2×2). Menggantikan versi
// prosedural setelah gambar dimuat — persis Challenge A Praktikum 5.
// (Paving tetap prosedural karena foto paving terlalu miring/perspektif.)
textures.loadImage("leaves", "./assets/textures/daun-foto.jpg");

// Texture 1×1 putih & hitam: dipasang bila material tidak punya texture
function createSolidTexture(rgba) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
  return t;
}

const whiteTexture = createSolidTexture([255, 255, 255, 255]);
const blackTexture = createSolidTexture([0, 0, 0, 255]);

// ---------- Shadow map (depth texture + framebuffer) ----------
const SHADOW_SIZE = CONFIG.lighting.shadowMapSize;
const shadowTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE, 0,
  gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
// Mode "compare": GPU langsung membandingkan kedalaman (sampler2DShadow)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);

const shadowFramebuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTexture, 0);
gl.drawBuffers([gl.NONE]);
gl.readBuffer(gl.NONE);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

// ---------- Kamera, cahaya, state global ----------
const camera = new Camera();
const lighting = new Lighting();
const world = { vehiclePositions: [] };

const state = {
  paused: false,
  speed: CONFIG.animation.speed,
  time: 0,                // waktu animasi (detik), berhenti saat pause
  shadingMode: "SMOOTH",  // F: FLAT ↔ SMOOTH (Praktikum 5)
  useTexture: true,
  wireframe: false,
  depthTest: true,        // D di Praktikum 4 → di sini lewat panel
  uvScale: 1.0,           // pengali UV global ([ / ] di Praktikum 5 → slider)
  fps: 0,
  drawCalls: 0
};

// =====================================================================
// SUSUN SCENE GRAPH
// =====================================================================
const context = { gl, tm: textures, lighting, world };
const scene = new Node("Scene (root)");

scene.add(createEnvironment(context));
scene.add(createTower(context));
scene.add(createNeighborBuildings(context));
scene.add(createTrees(context));
scene.add(createProps(context));
scene.add(createStudents(context));
scene.add(createVehicles(context));

const sunNode = scene.find("Matahari");
const skyNode = scene.find("Langit (sky dome)");

// =====================================================================
// HELPER ATTRIBUTE (sama dengan setupAttribute Praktikum 5)
// =====================================================================
function setupAttribute(buffer, location, size) {
  if (location === undefined || location < 0) {
    return;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function disableAttribute(location) {
  if (location !== undefined && location >= 0) {
    gl.disableVertexAttribArray(location);
  }
}

// =====================================================================
// RESIZE: ukuran buffer gambar canvas = ukuran tampil × devicePixelRatio
// =====================================================================
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

// =====================================================================
// SHADOW PASS
// =====================================================================
// "Kamera" diletakkan di arah matahari dan memakai proyeksi ORTHOGRAPHIC
// (sinar matahari sejajar). Hasilnya: depth texture berisi jarak
// permukaan terdekat dari matahari untuk tiap piksel.
function computeLightSpaceMatrix() {
  const area = CONFIG.lighting.shadowArea;
  const center = [0, 0, 12];
  const dir = lighting.lightDirection;
  const eye = Vec3.add(center, Vec3.scale(dir, 250));
  const up = Math.abs(dir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
  const view = Mat4.lookAt(eye, center, up);
  const projection = Mat4.orthographic(-area, area, -area, area, 1, 520);

  return Mat4.multiply(projection, view);
}

function renderShadowPass(drawList, lightSpaceMatrix) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
  gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(shadowProgram);
  gl.uniformMatrix4fv(shadowLoc.uniforms.u_lightSpaceMatrix, false, lightSpaceMatrix);

  // Polygon offset: kurangi "shadow acne"
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(2.0, 4.0);

  for (const item of drawList) {
    if (!item.node.castShadow) {
      continue;
    }

    const mesh = item.node.mesh;
    setupAttribute(mesh.positionBuffer, shadowLoc.attributes.a_position, 3);
    gl.uniformMatrix4fv(shadowLoc.uniforms.u_model, false, item.matrix);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
  }

  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// =====================================================================
// SKY PASS
// =====================================================================
function renderSky(view, aspect) {
  // Buang translasi dari view matrix → langit selalu mengelilingi kamera
  const viewRotation = new Float32Array(view);
  viewRotation[12] = 0;
  viewRotation[13] = 0;
  viewRotation[14] = 0;

  // Langit selalu memakai perspective (walau mode orthographic aktif)
  const projection = Mat4.perspective(camera.fov * Math.PI / 180, aspect, 0.1, 10);

  gl.useProgram(skyProgram);
  gl.depthMask(false);

  const u = skyLoc.uniforms;
  gl.uniformMatrix4fv(u.u_viewRotation, false, viewRotation);
  gl.uniformMatrix4fv(u.u_projection, false, projection);
  gl.uniform3fv(u.u_skyTopColor, lighting.skyTop);
  gl.uniform3fv(u.u_skyHorizonColor, lighting.skyHorizon);
  gl.uniform3fv(u.u_groundColor, Vec3.scale(lighting.skyHorizon, 0.8));
  gl.uniform3fv(u.u_sunDirection, Vec3.normalize(sunNode.getWorldPosition()));
  gl.uniform3fv(u.u_sunGlowColor, lighting.sunElevation > -0.05 ? lighting.sunGlowColor : [0, 0, 0]);
  gl.uniform1f(u.u_time, state.time);
  gl.uniform1f(u.u_cloudCover, lighting.cloudCover);
  gl.uniform3fv(u.u_cloudColor, lighting.cloudColor);

  const mesh = skyNode.mesh;
  setupAttribute(mesh.positionBuffer, skyLoc.attributes.a_position, 3);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);

  gl.depthMask(true);
}

// =====================================================================
// MAIN PASS
// =====================================================================
function setGlobalUniforms(view, projection, lightSpaceMatrix) {
  const u = sceneLoc.uniforms;

  gl.uniformMatrix4fv(u.u_view, false, view);
  gl.uniformMatrix4fv(u.u_projection, false, projection);
  gl.uniformMatrix4fv(u.u_lightSpaceMatrix, false, lightSpaceMatrix);
  gl.uniform3fv(u.u_cameraPosition, camera.position);

  gl.uniform3fv(u.u_lightDirection, lighting.lightDirection);
  gl.uniform3fv(u.u_lightColor, lighting.lightColor);
  gl.uniform1f(u.u_lightIntensity, lighting.lightIntensity);

  gl.uniform1f(u.u_ambientStrength, lighting.ambientStrength);
  gl.uniform3fv(u.u_skyColor, lighting.ambientSkyColor);
  gl.uniform3fv(u.u_groundColor, lighting.groundColor);
  gl.uniform3fv(u.u_skyHorizonColor, lighting.skyHorizon);

  const points = lighting.getPointLightUniforms();
  gl.uniform1i(u.u_pointLightCount, points.count);
  gl.uniform3fv(u.u_pointLightPosition, points.positions);
  gl.uniform3fv(u.u_pointLightColor, points.colors);
  gl.uniform1f(u.u_pointLightRange, CONFIG.lighting.pointLightRange);

  gl.uniform1i(u.u_useAmbient, lighting.useAmbient);
  gl.uniform1i(u.u_useDiffuse, lighting.useDiffuse);
  gl.uniform1i(u.u_useSpecular, lighting.useSpecular);
  gl.uniform1i(u.u_useBlinn, lighting.useBlinn);
  gl.uniform1i(u.u_useTexture, state.useTexture);
  gl.uniform1i(u.u_useShadow, lighting.useShadow && lighting.lightIntensity > 0.01);
  gl.uniform1i(u.u_wireframe, state.wireframe);

  gl.uniform1f(u.u_nightFactor, lighting.nightFactor);
  gl.uniform1f(u.u_shadowMapSize, SHADOW_SIZE);
  gl.uniform3fv(u.u_fogColor, lighting.skyHorizon);
  gl.uniform1f(u.u_fogDensity, lighting.fogDensity);
  gl.uniform1f(u.u_exposure, lighting.exposure);
  gl.uniform1i(u.u_useToneMapping, lighting.useToneMapping);

  // Texture unit: 0 = warna, 1 = emissive, 2 = shadow map
  gl.uniform1i(u.u_texture, 0);
  gl.uniform1i(u.u_emissiveTexture, 1);
  gl.uniform1i(u.u_shadowMap, 2);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
}

function setMaterialUniforms(material) {
  const u = sceneLoc.uniforms;

  gl.uniform3fv(u.u_baseColor, material.color);
  gl.uniform2f(u.u_uvScale, material.uvScale[0] * state.uvScale, material.uvScale[1] * state.uvScale);
  gl.uniform1f(u.u_shininess, Math.max(1, material.shininess * lighting.shininessScale));
  gl.uniform1f(u.u_specularStrength, material.specular * lighting.specularStrength);
  gl.uniform1f(u.u_reflectivity, material.reflectivity);
  gl.uniform3fv(u.u_emissive, material.emissive);
  gl.uniform3fv(u.u_nightEmissive, material.nightEmissive);
  gl.uniform1i(u.u_unlit, material.unlit);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, material.texture || whiteTexture);
  gl.uniform1i(u.u_hasTexture, !!material.texture);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, material.emissiveTexture || blackTexture);
  gl.uniform1i(u.u_hasEmissiveTexture, !!material.emissiveTexture);
}

function renderScene(drawList, view, projection, lightSpaceMatrix) {
  gl.useProgram(sceneProgram);
  setGlobalUniforms(view, projection, lightSpaceMatrix);

  const a = sceneLoc.attributes;
  const u = sceneLoc.uniforms;
  let lastMaterial = null;

  for (const item of drawList) {
    const { node, matrix } = item;
    const mesh = node.mesh;

    // Material yang sama berurutan tidak perlu dikirim ulang
    if (node.material !== lastMaterial) {
      setMaterialUniforms(node.material);
      lastMaterial = node.material;
    }

    gl.uniformMatrix4fv(u.u_model, false, matrix);
    gl.uniformMatrix3fv(u.u_normalMatrix, false, normalMatrixFromMat4(matrix));

    if (state.wireframe) {
      // Mode wireframe: gambar sisi segitiga sebagai garis
      setupAttribute(mesh.getWireBuffer(), a.a_position, 3);
      disableAttribute(a.a_normal);
      disableAttribute(a.a_texCoord);
      gl.drawArrays(gl.LINES, 0, mesh.wireCount);
      continue;
    }

    const normalBuffer = state.shadingMode === "FLAT" ? mesh.flatNormalBuffer : mesh.smoothNormalBuffer;
    setupAttribute(mesh.positionBuffer, a.a_position, 3);
    setupAttribute(normalBuffer, a.a_normal, 3);
    setupAttribute(mesh.texCoordBuffer, a.a_texCoord, 2);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
  }
}

// =====================================================================
// INPUT — state-based (keys{}) & event-based (toggle), seperti praktikum
// =====================================================================
const keys = {};
let keyboardActive = false;   // aktif setelah canvas diklik (fokus)

canvas.addEventListener("focus", () => { keyboardActive = true; });
canvas.addEventListener("blur", () => {
  keyboardActive = false;
  for (const k in keys) keys[k] = false;
});

window.addEventListener("keydown", (event) => {
  if (!keyboardActive) {
    return;
  }

  const key = event.key.toLowerCase();
  keys[key] = true;

  // Cegah halaman ikut scroll saat mengendalikan kamera
  if (event.key.startsWith("Arrow") || key === " " || key === "pageup" || key === "pagedown") {
    event.preventDefault();
  }

  if (event.repeat) {
    return;
  }

  // Toggle event-based
  const actions = {
    " ": () => app.togglePause(),
    r: () => camera.reset(),
    p: () => camera.toggleProjection(),
    o: () => camera.toggleOrbit(),
    n: () => camera.nextClipPreset(),
    v: () => camera.toggleAutoTour(),
    f: () => { state.shadingMode = state.shadingMode === "FLAT" ? "SMOOTH" : "FLAT"; },
    t: () => textures.nextFilter(),
    g: () => textures.nextWrap(),
    b: () => { lighting.useBlinn = !lighting.useBlinn; },
    x: () => { state.wireframe = !state.wireframe; },
    h: () => { lighting.useShadow = !lighting.useShadow; },
    m: () => { lighting.autoCycle = !lighting.autoCycle; },
    ",": () => { lighting.hour = (lighting.hour + 23.5) % 24; },
    ".": () => { lighting.hour = (lighting.hour + 0.5) % 24; },
    1: () => camera.applyPreset("overview"),
    2: () => camera.applyPreset("near"),
    3: () => camera.applyPreset("student"),
    4: () => camera.applyPreset("top"),
    5: () => camera.startMove("stay"),
    6: () => camera.startMove("stayWide"),
    7: () => camera.startMove("pan"),
    8: () => camera.startMove("tilt"),
    9: () => camera.startMove("zoom"),
    0: () => camera.startMove("dolly")
  };

  if (actions[key]) {
    actions[key]();
    app.onStateChange();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

// Drag mouse / sentuh = look-around ; scroll = maju-mundur
let dragging = false;
let lastPointer = [0, 0];

canvas.addEventListener("pointerdown", (event) => {
  dragging = true;
  lastPointer = [event.clientX, event.clientY];
  canvas.setPointerCapture(event.pointerId);
  canvas.focus();
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging) {
    return;
  }

  camera.look(event.clientX - lastPointer[0], event.clientY - lastPointer[1]);
  lastPointer = [event.clientX, event.clientY];
});

canvas.addEventListener("pointerup", () => { dragging = false; });
canvas.addEventListener("pointercancel", () => { dragging = false; });

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  camera.dollyBy(-Math.sign(event.deltaY) * 3);
}, { passive: false });

// =====================================================================
// RENDER LOOP
// =====================================================================
let lastTime = 0;
let fpsFrames = 0;
let fpsTimer = 0;

function render(time) {
  let dt = (time - lastTime) * 0.001;
  lastTime = time;
  dt = Math.min(dt, 0.05);                       // sama dengan praktikum

  // FPS
  fpsFrames++;
  fpsTimer += dt;

  if (fpsTimer >= 0.5) {
    state.fps = fpsFrames / fpsTimer;
    fpsFrames = 0;
    fpsTimer = 0;
  }

  // Waktu animasi (berhenti saat pause, dipercepat oleh slider)
  const animDt = state.paused ? 0 : dt * state.speed;
  state.time += animDt;

  // Kamera tetap bisa digerakkan walau animasi di-pause
  if (keyboardActive) {
    camera.handleKeys(keys, dt);
  }

  camera.update(dt);

  // 3) Animasi & 4) traversal scene graph
  scene.update(animDt, state.time);
  const drawList = [];
  scene.computeWorld(Mat4.identity(), drawList);

  // Langit digambar terpisah (program SKY)
  const objects = drawList.filter((item) => !item.node.userData.skyDome);

  // 5) Lighting dari posisi node Matahari
  lighting.update(animDt, sunNode.getWorldPosition());

  // 6) Shadow pass
  const lightSpaceMatrix = computeLightSpaceMatrix();

  if (lighting.useShadow && lighting.lightIntensity > 0.01 && !state.wireframe) {
    renderShadowPass(objects, lightSpaceMatrix);
  }

  // 7) Main pass
  resizeCanvas();
  gl.viewport(0, 0, canvas.width, canvas.height);
  const sky = lighting.skyHorizon;
  gl.clearColor(state.wireframe ? 0.02 : sky[0], state.wireframe ? 0.03 : sky[1], state.wireframe ? 0.06 : sky[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (state.depthTest) gl.enable(gl.DEPTH_TEST);
  else gl.disable(gl.DEPTH_TEST);

  const aspect = canvas.width / canvas.height;
  const view = camera.getViewMatrix();
  const projection = camera.getProjectionMatrix(aspect);

  if (!state.wireframe) {
    renderSky(view, aspect);
  }

  renderScene(objects, view, projection, lightSpaceMatrix);
  state.drawCalls = objects.length;

  // 8) HUD
  app.updateHUD();

  requestAnimationFrame(render);
}

// =====================================================================
// OBJEK APP — dibagikan ke ui.js (panel kontrol & diagram tree)
// =====================================================================
const app = {
  gl, canvas, scene, camera, lighting, textures, state, CONFIG,
  togglePause() {
    state.paused = !state.paused;
    return state.paused;
  },
  get meshCount() {
    return getMeshCount();
  },
  updateHUD() {},       // diisi oleh ui.js
  onStateChange() {}    // diisi oleh ui.js
};

setupUI(app);
window.app = app;      // memudahkan eksperimen lewat Console saat demo

requestAnimationFrame(render);
