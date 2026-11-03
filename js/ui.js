
const $ = (id) => document.getElementById(id);

export function setupUI(app) {
  const { camera, lighting, textures, state } = app;

  const hud = {
    fps: $("hudFps"),
    time: $("hudTime"),
    camera: $("hudCamera"),
    position: $("hudPosition"),
    projection: $("hudProjection"),
    fov: $("hudFov"),
    clip: $("hudClip"),
    shading: $("hudShading"),
    filter: $("hudFilter"),
    wrap: $("hudWrap"),
    lightModel: $("hudLightModel"),
    draw: $("hudDraw")
  };

  let hudTimer = 0;

  app.updateHUD = () => {
    const now = performance.now();

    if (now - hudTimer < 250) {
      return;
    }

    hudTimer = now;
    const p = camera.position;
    set(hud.fps, state.fps.toFixed(0));
    set(hud.time, lighting.timeText + (lighting.autoCycle ? " (auto)" : ""));
    set(hud.camera, camera.statusText);
    set(hud.position, `(${p[0].toFixed(1)}, ${p[1].toFixed(1)}, ${p[2].toFixed(1)})`);
    set(hud.projection, camera.projectionState.mode);
    set(hud.fov, `${camera.fov.toFixed(1)}°`);
    set(hud.clip, `${camera.projectionState.near} / ${camera.projectionState.far}`);
    set(hud.shading, state.shadingMode);
    set(hud.filter, textures.filterName);
    set(hud.wrap, textures.wrapName);
    set(hud.lightModel, lighting.useBlinn ? "Blinn-Phong" : "Phong");
    set(hud.draw, `${state.drawCalls} draw / ${app.scene.countNodes()} node`);

    if (lighting.autoCycle && $("rangeHour")) {
      $("rangeHour").value = lighting.hour;
      set($("hourValue"), lighting.timeText);
    }
  };

  app.onStateChange = () => {
    check("chkShadow", lighting.useShadow);
    check("chkWireframe", state.wireframe);
    check("chkAutoDay", lighting.autoCycle);
    check("chkBlinn", lighting.useBlinn);
    check("chkFlat", state.shadingMode === "FLAT");
    set($("btnPause"), state.paused ? "▶ Play" : "⏸ Pause");
    set($("btnFilter"), `Filter: ${textures.filterName}`);
    set($("btnWrap"), `Wrap: ${textures.wrapName}`);
    set($("btnTour"), camera.autoTour ? "Auto-tour: ON" : "Auto-tour: OFF");
    set($("btnOrbit"), camera.orbit.enabled ? "Orbit: ON" : "Orbit: OFF");
    set($("btnProjection"), camera.projectionState.mode === "perspective" ? "Perspective" : "Orthographic");
    $("rangeHour").value = lighting.hour;
    set($("hourValue"), lighting.timeText);
  };

  // KONTROL ANIMASI
  on("btnPause", "click", () => { app.togglePause(); app.onStateChange(); });

  bindRange("rangeSpeed", "speedValue", (v) => { state.speed = v; return `${v.toFixed(2)}×`; }, state.speed);

  // WAKTU & CAHAYA
  bindRange("rangeHour", "hourValue", (v) => { lighting.hour = v; return lighting.timeText; }, lighting.hour);
  on("chkAutoDay", "change", (e) => { lighting.autoCycle = e.target.checked; });

  $("hourPresets")?.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      lighting.hour = Number(button.dataset.hour);
      app.onStateChange();
    });
  });

  on("chkAmbient", "change", (e) => { lighting.useAmbient = e.target.checked; });
  on("chkDiffuse", "change", (e) => { lighting.useDiffuse = e.target.checked; });
  on("chkSpecular", "change", (e) => { lighting.useSpecular = e.target.checked; });
  on("chkShadow", "change", (e) => { lighting.useShadow = e.target.checked; });
  on("chkFog", "change", (e) => { lighting.useFog = e.target.checked; });
  on("chkBlinn", "change", (e) => { lighting.useBlinn = e.target.checked; });
  on("chkToneMap", "change", (e) => { lighting.useToneMapping = e.target.checked; });

  bindRange("rangeAmbient", "ambientValue", (v) => { lighting.ambientStrength = v; return v.toFixed(2); }, lighting.ambientStrength);
  bindRange("rangeSun", "sunValue", (v) => { lighting.sunIntensity = v; return v.toFixed(2); }, lighting.sunIntensity);
  bindRange("rangeSpecular", "specularValue", (v) => { lighting.specularStrength = v; return v.toFixed(2); }, lighting.specularStrength);
  bindRange("rangeShininess", "shininessValue", (v) => { lighting.shininessScale = v; return `${v.toFixed(2)}×`; }, lighting.shininessScale);
  bindRange("rangeExposure", "exposureValue", (v) => { lighting.exposure = v; return v.toFixed(2); }, lighting.exposure);

  // TEXTURE & TAMPILAN
  on("chkTexture", "change", (e) => { state.useTexture = e.target.checked; });
  on("chkWireframe", "change", (e) => { state.wireframe = e.target.checked; });
  on("chkFlat", "change", (e) => { state.shadingMode = e.target.checked ? "FLAT" : "SMOOTH"; });
  on("chkDepth", "change", (e) => { state.depthTest = e.target.checked; });
  on("btnFilter", "click", () => { textures.nextFilter(); app.onStateChange(); });
  on("btnWrap", "click", () => { textures.nextWrap(); app.onStateChange(); });
  bindRange("rangeUv", "uvValue", (v) => { state.uvScale = v; return `${v.toFixed(2)}×`; }, state.uvScale);

  // KAMERA
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => { camera.applyPreset(button.dataset.preset); app.onStateChange(); });
  });

  document.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      camera.startMove(button.dataset.move);
      app.onStateChange();

      if (button.dataset.video) {
        playVideo(button.dataset.video, false);
      }
    });
  });

  on("btnTour", "click", () => { camera.toggleAutoTour(); app.onStateChange(); });
  on("btnOrbit", "click", () => { camera.toggleOrbit(); app.onStateChange(); });
  on("btnProjection", "click", () => { camera.toggleProjection(); app.onStateChange(); });
  on("btnClip", "click", () => { camera.nextClipPreset(); app.onStateChange(); });
  on("btnReset", "click", () => { camera.reset(); app.onStateChange(); });

  on("btnFullscreen", "click", () => {
    const wrap = $("canvasWrap");

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (wrap.requestFullscreen) {
      wrap.requestFullscreen();
    }
  });

  // FOTO PEMBANDING (kolom kiri, sebelah canvas)
  document.querySelectorAll("[data-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      $("refPhoto").src = button.dataset.photo;
      document.querySelectorAll("[data-photo]").forEach((b) => b.classList.toggle("active", b === button));

      if (button.dataset.preset) camera.applyPreset(button.dataset.preset);
      if (button.dataset.move) camera.startMove(button.dataset.move);
    });
  });

  // VIDEO ASLI
  function playVideo(src, scroll = true) {
    const video = $("mainVideo");

    if (!video) {
      return;
    }

    video.src = src;
    video.play().catch(() => {});
    document.querySelectorAll("[data-video-tab]").forEach((b) => b.classList.toggle("active", b.dataset.videoTab === src));

    if (scroll) {
      video.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  document.querySelectorAll("[data-video-tab]").forEach((button) => {
    button.addEventListener("click", () => playVideo(button.dataset.videoTab, false));
  });

  // STOP-MOTION 
  setupStopMotion();

  // DIAGRAM TREE dari scene graph
  renderSceneTree(app.scene);

  app.onStateChange();
}

// Helper kecil
function set(element, text) {
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
}

function on(id, event, handler) {
  const element = $(id);

  if (element) {
    element.addEventListener(event, handler);
  }
}

function check(id, value) {
  const element = $(id);

  if (element) {
    element.checked = value;
  }
}

// initial: nilai awal diambil dari state/CONFIG (bukan dari HTML)
function bindRange(id, labelId, apply, initial) {
  const input = $(id);

  if (!input) {
    return;
  }

  if (initial !== undefined) {
    input.value = initial;
  }

  const update = () => {
    const text = apply(Number(input.value));

    if (labelId) {
      set($(labelId), text);
    }
  };

  input.addEventListener("input", update);
  update();
}

// STOP-MOTION PLAYER
function setupStopMotion() {
  const image = $("smImage");
  const slider = $("smSlider");
  const playButton = $("smPlay");
  const label = $("smLabel");

  if (!image || !slider) {
    return;
  }

  const sets = {
    pan: { folder: "./assets/photos/stop-motion-pan/", count: 9, title: "Stop-motion PAN" },
    tilt: { folder: "./assets/photos/stop-motion-tilt/", count: 7, title: "Stop-motion TILT" }
  };

  let current = "pan";
  let timer = null;

  for (const s of Object.values(sets)) {
    for (let i = 1; i <= s.count; i++) {
      new Image().src = `${s.folder}${i}.jpg`;
    }
  }

  function show(index) {
    const s = sets[current];
    image.src = `${s.folder}${index}.jpg`;
    slider.value = index;
    set(label, `${s.title} — frame ${index}/${s.count}`);
  }

  function select(name) {
    current = name;
    slider.max = sets[name].count;
    document.querySelectorAll("[data-sm]").forEach((b) => b.classList.toggle("active", b.dataset.sm === name));
    show(1);
  }

  slider.addEventListener("input", () => show(Number(slider.value)));

  playButton.addEventListener("click", () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      playButton.textContent = "▶ Putar";
      return;
    }

    playButton.textContent = "⏸ Berhenti";
    timer = setInterval(() => {
      const next = (Number(slider.value) % sets[current].count) + 1;
      show(next);
    }, 380);
  });

  document.querySelectorAll("[data-sm]").forEach((button) => {
    button.addEventListener("click", () => select(button.dataset.sm));
  });

  select("pan");
}

// DIAGRAM TREE OTOMATIS
function baseName(name) {
  return name.replace(/\s*\(.*\)$/, "").replace(/\s+\d+$/, "");
}

function renderSceneTree(scene) {
  const container = $("sceneTree");

  if (!container) {
    return;
  }

  container.innerHTML = "";
  container.appendChild(buildNodeElement(scene, 0, 1));

  const stats = $("treeStats");

  if (stats) {
    let animated = 0;
    let meshes = 0;
    let maxDepth = 0;

    (function walk(node, depth) {
      if (node.onUpdate) animated++;
      if (node.mesh) meshes++;
      maxDepth = Math.max(maxDepth, depth);
      node.children.forEach((c) => walk(c, depth + 1));
    })(scene, 0);

    stats.textContent =
      `${scene.countNodes()} node · ${meshes} node bermesh · ` +
      `${animated} node beranimasi · kedalaman hierarki ${maxDepth} level`;
  }
}

function buildNodeElement(node, depth, repeatCount) {
  const hasChildren = node.children.length > 0;
  const li = document.createElement(hasChildren ? "details" : "div");
  li.className = "tree-node";

  if (hasChildren && depth < 2) {
    li.open = true;
  }

  const label = document.createElement(hasChildren ? "summary" : "span");
  label.className = "tree-label";

  let text = node.name;

  if (repeatCount > 1) {
    text = `${baseName(node.name)} 1 … ${repeatCount}`;
  }

  label.textContent = text;

  if (repeatCount > 1) {
    label.appendChild(badge(`×${repeatCount}`, "badge-repeat"));
  }

  if (node.onUpdate) {
    label.appendChild(badge("animasi", "badge-anim"));
  }

  if (!node.mesh) {
    label.appendChild(badge("grup", "badge-group"));
  }

  li.appendChild(label);

  if (hasChildren) {
    const list = document.createElement("div");
    list.className = "tree-children";

    let i = 0;
    const children = node.children;

    while (i < children.length) {
      const base = baseName(children[i].name);
      let j = i + 1;

      while (j < children.length && baseName(children[j].name) === base && /\d/.test(children[j].name)) {
        j++;
      }

      list.appendChild(buildNodeElement(children[i], depth + 1, j - i));
      i = j;
    }

    li.appendChild(list);
  }

  return li;
}

function badge(text, className) {
  const span = document.createElement("span");
  span.className = `badge ${className}`;
  span.textContent = text;
  return span;
}

