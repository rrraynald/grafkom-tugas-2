// =====================================================================
// shaders.js — Semua shader GLSL + helper createShader/createProgram
// ---------------------------------------------------------------------
// Ada 3 program:
//  1. SCENE  : lighting per-fragment (ambient + diffuse + specular)
//              + texture + shadow map + lampu titik + emissive + fog.
//              Pengembangan langsung dari shader Praktikum 5.
//  2. SHADOW : hanya menulis kedalaman (depth) dari sudut pandang
//              matahari → menghasilkan shadow map.
//  3. SKY    : kubah langit (gradasi warna + cahaya matahari).
// =====================================================================

// ---------------------------------------------------------------------
// 1) SCENE — Vertex Shader
// ---------------------------------------------------------------------
// Sama seperti Praktikum 5: kirim posisi dunia, normal, dan UV ke
// fragment shader. Tambahan: v_lightSpacePosition = posisi vertex dilihat
// dari "kamera matahari" (untuk shadow mapping).
export const sceneVertexShaderSource = `#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_texCoord;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat3 u_normalMatrix;
uniform mat4 u_lightSpaceMatrix;   // projection_sun × view_sun

uniform vec2 u_uvScale;            // skala UV per material (repeat)

out vec3 v_worldPosition;
out vec3 v_normal;
out vec2 v_texCoord;
out vec4 v_lightSpacePosition;

void main() {
  vec4 worldPosition = u_model * vec4(a_position, 1.0);

  v_worldPosition = worldPosition.xyz;
  v_normal = u_normalMatrix * a_normal;
  v_texCoord = a_texCoord * u_uvScale;
  v_lightSpacePosition = u_lightSpaceMatrix * worldPosition;

  // Urutan matrix: Projection × View × Model × posisi
  gl_Position = u_projection * u_view * worldPosition;
}
`;

// ---------------------------------------------------------------------
// 1) SCENE — Fragment Shader
// ---------------------------------------------------------------------
export const MAX_POINT_LIGHTS = 8;

export const sceneFragmentShaderSource = `#version 300 es

precision highp float;
precision highp sampler2DShadow;

#define MAX_POINT_LIGHTS ${MAX_POINT_LIGHTS}

in vec3 v_worldPosition;
in vec3 v_normal;
in vec2 v_texCoord;
in vec4 v_lightSpacePosition;

// ---- Kamera ----
uniform vec3 u_cameraPosition;

// ---- Matahari (directional light) ----
uniform vec3 u_lightDirection;     // arah DARI permukaan MENUJU matahari
uniform vec3 u_lightColor;
uniform float u_lightIntensity;

// ---- Ambient (hemisphere: langit di atas, tanah di bawah) ----
uniform float u_ambientStrength;
uniform vec3 u_skyColor;
uniform vec3 u_groundColor;
uniform vec3 u_skyHorizonColor;    // untuk pantulan kaca

// ---- Lampu titik (lampu taman, pos satpam) ----
uniform int u_pointLightCount;
uniform vec3 u_pointLightPosition[MAX_POINT_LIGHTS];
uniform vec3 u_pointLightColor[MAX_POINT_LIGHTS];
uniform float u_pointLightRange;

// ---- Toggle demo (panel UI) ----
uniform bool u_useAmbient;
uniform bool u_useDiffuse;
uniform bool u_useSpecular;
uniform bool u_useBlinn;           // true = Blinn-Phong, false = Phong
uniform bool u_useTexture;
uniform bool u_useShadow;
uniform bool u_wireframe;

// ---- Material ----
uniform vec3 u_baseColor;
uniform sampler2D u_texture;
uniform bool u_hasTexture;
uniform float u_shininess;
uniform float u_specularStrength;
uniform float u_reflectivity;      // pantulan langit (kaca)
uniform vec3 u_emissive;           // selalu menyala (mis. matahari)
uniform vec3 u_nightEmissive;      // menyala saat malam (jendela, papan)
uniform sampler2D u_emissiveTexture;
uniform bool u_hasEmissiveTexture;
uniform float u_nightFactor;       // 0 = siang, 1 = malam
uniform bool u_unlit;              // abaikan lighting (matahari, langit)

// ---- Shadow & fog ----
uniform sampler2DShadow u_shadowMap;
uniform float u_shadowMapSize;
uniform vec3 u_fogColor;
uniform float u_fogDensity;
uniform float u_exposure;          // pengali kecerahan sebelum tone mapping
uniform bool u_useToneMapping;

out vec4 outColor;

// Tone mapping ACES (pendekatan Narkowicz): memetakan nilai cahaya > 1
// kembali ke 0..1 secara halus, sehingga bagian terang tidak "gosong"
// dan bagian teduh sedikit terangkat — mirip kamera HP saat langit
// berawan.
vec3 acesToneMap(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// Menghitung seberapa "terang" (tidak terbayangi) sebuah fragment.
// 1.0 = kena matahari, 0.0 = di bayangan.
float computeShadow(vec3 normal, vec3 lightDir) {
  // Dari clip space cahaya → NDC (-1..1) → koordinat texture (0..1)
  vec3 projected = v_lightSpacePosition.xyz / v_lightSpacePosition.w;
  projected = projected * 0.5 + 0.5;

  // Di luar area shadow map → anggap terang
  if (projected.x < 0.0 || projected.x > 1.0 ||
      projected.y < 0.0 || projected.y > 1.0 ||
      projected.z > 1.0) {
    return 1.0;
  }

  // Bias mencegah "shadow acne" (garis-garis bayangan di permukaan sendiri)
  float bias = max(0.0025 * (1.0 - dot(normal, lightDir)), 0.0006);
  float currentDepth = projected.z - bias;

  // PCF 3x3: rata-rata 9 sampel agar tepi bayangan halus
  float texel = 1.0 / u_shadowMapSize;
  float lit = 0.0;

  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      lit += texture(u_shadowMap, vec3(projected.xy + offset, currentDepth));
    }
  }

  return lit / 9.0;
}

// Specular: Phong (seperti Praktikum 5) atau Blinn-Phong.
float specularTerm(vec3 N, vec3 L, vec3 V, float shininess) {
  if (u_useBlinn) {
    // Blinn-Phong: halfway vector H = normalize(L + V)
    vec3 H = normalize(L + V);
    return pow(max(dot(N, H), 0.0), shininess);
  }

  // Phong: R = reflect(-L, N)
  vec3 R = reflect(-L, N);
  return pow(max(dot(R, V), 0.0), shininess);
}

void main() {
  if (u_wireframe) {
    outColor = vec4(0.10, 0.95, 0.60, 1.0);
    return;
  }

  // ---- Warna dasar (texture × warna material) ----
  vec3 albedo = u_baseColor;

  if (u_useTexture && u_hasTexture) {
    albedo *= texture(u_texture, v_texCoord).rgb;
  }

  if (u_unlit) {
    outColor = vec4(albedo + u_emissive, 1.0);
    return;
  }

  vec3 N = normalize(v_normal);
  vec3 V = normalize(u_cameraPosition - v_worldPosition);

  // Permukaan tipis (daun, bilah) bisa terlihat dari belakang:
  // balik normal agar tetap menghadap kamera.
  if (!gl_FrontFacing) {
    N = -N;
  }

  vec3 L = normalize(u_lightDirection);

  // ---- 1. Ambient (hemisphere) ----
  // Permukaan menghadap atas mendapat warna langit, menghadap bawah
  // mendapat pantulan tanah. Lebih realistis dari ambient konstan.
  vec3 ambient = vec3(0.0);

  if (u_useAmbient) {
    float upFactor = N.y * 0.5 + 0.5;
    vec3 hemi = mix(u_groundColor, u_skyColor, upFactor);
    ambient = u_ambientStrength * hemi * albedo;
  }

  // ---- 2. Diffuse (Lambert) & 3. Specular dari matahari ----
  float shadow = 1.0;

  if (u_useShadow) {
    shadow = computeShadow(N, L);
  }

  vec3 diffuse = vec3(0.0);
  vec3 specular = vec3(0.0);
  float diff = max(dot(N, L), 0.0);

  if (u_useDiffuse) {
    diffuse = diff * u_lightColor * u_lightIntensity * albedo * shadow;
  }

  if (u_useSpecular && diff > 0.0) {
    float spec = specularTerm(N, L, V, u_shininess);
    specular = spec * u_specularStrength * u_lightColor
             * u_lightIntensity * shadow;
  }

  // ---- Lampu titik (attenuation = 1 / (1 + k·d²)) ----
  for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
    if (i >= u_pointLightCount) {
      break;
    }

    vec3 toLight = u_pointLightPosition[i] - v_worldPosition;
    float dist = length(toLight);
    vec3 Lp = toLight / dist;
    float attenuation = 1.0 / (1.0 + u_pointLightRange * dist * dist);
    float diffP = max(dot(N, Lp), 0.0);

    if (u_useDiffuse) {
      diffuse += diffP * u_pointLightColor[i] * albedo * attenuation;
    }

    if (u_useSpecular && diffP > 0.0) {
      specular += specularTerm(N, Lp, V, u_shininess)
                * u_specularStrength * u_pointLightColor[i] * attenuation;
    }
  }

  vec3 color = ambient + diffuse + specular;

  // ---- Pantulan langit sederhana (untuk kaca) ----
  // Arah pantulan pandangan: makin ke atas → warna langit atas.
  if (u_reflectivity > 0.0) {
    vec3 R = reflect(-V, N);
    float t = clamp(R.y * 1.5 + 0.2, 0.0, 1.0);
    vec3 skyReflection = mix(u_skyHorizonColor, u_skyColor, t);
    // Fresnel (Schlick): pantulan lebih kuat bila dilihat miring
    float fresnel = u_reflectivity
      + (1.0 - u_reflectivity) * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    color = mix(color, skyReflection * (0.35 + 0.65 * u_lightIntensity),
                clamp(fresnel, 0.0, 0.85));
  }

  // ---- Emissive ----
  vec3 nightGlow = u_nightEmissive;

  if (u_hasEmissiveTexture) {
    nightGlow *= texture(u_emissiveTexture, v_texCoord).rgb;
  }

  color += u_emissive + nightGlow * u_nightFactor;

  // ---- Tone mapping ----
  if (u_useToneMapping) {
    color = acesToneMap(color * u_exposure);
  }

  // ---- Fog eksponensial (kabut tipis atmosfer) ----
  // (setelah tone mapping agar warnanya sama dengan langit di horizon)
  float distanceToCamera = length(u_cameraPosition - v_worldPosition);
  float fogAmount = 1.0 - exp(-pow(distanceToCamera * u_fogDensity, 2.0));
  color = mix(color, u_fogColor, clamp(fogAmount, 0.0, 1.0));

  outColor = vec4(color, 1.0);
}
`;

// ---------------------------------------------------------------------
// 2) SHADOW — render kedalaman dari sudut pandang matahari
// ---------------------------------------------------------------------
export const shadowVertexShaderSource = `#version 300 es

in vec3 a_position;

uniform mat4 u_model;
uniform mat4 u_lightSpaceMatrix;

void main() {
  gl_Position = u_lightSpaceMatrix * u_model * vec4(a_position, 1.0);
}
`;

// Tidak perlu warna: GPU otomatis menulis depth ke depth texture.
export const shadowFragmentShaderSource = `#version 300 es

precision mediump float;

void main() {
}
`;

// ---------------------------------------------------------------------
// 3) SKY — kubah langit
// ---------------------------------------------------------------------
// Bola besar yang selalu berpusat di kamera (translasi view dibuang)
// sehingga langit terasa "tak terhingga".
export const skyVertexShaderSource = `#version 300 es

in vec3 a_position;

uniform mat4 u_viewRotation;   // view matrix TANPA translasi
uniform mat4 u_projection;

out vec3 v_direction;

void main() {
  v_direction = a_position;
  vec4 clip = u_projection * u_viewRotation * vec4(a_position, 1.0);
  // z ≈ w → setelah dibagi w, kedalaman ≈ 1.0 (paling jauh), jadi
  // langit selalu berada di belakang semua objek.
  gl_Position = vec4(clip.xy, clip.w * 0.99999, clip.w);
}
`;

export const skyFragmentShaderSource = `#version 300 es

precision highp float;

in vec3 v_direction;

uniform vec3 u_skyTopColor;
uniform vec3 u_skyHorizonColor;
uniform vec3 u_groundColor;
uniform vec3 u_sunDirection;
uniform vec3 u_sunGlowColor;
uniform float u_time;             // menggeser awan (angin)
uniform float u_cloudCover;       // 0 = cerah, 1 = mendung
uniform vec3 u_cloudColor;

out vec4 outColor;

// ---- Noise prosedural untuk lapisan awan tipis (altocumulus) ----
// hash → value noise → fbm (jumlah beberapa oktaf noise).
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;

  for (int i = 0; i < 5; i++) {
    sum += amp * valueNoise(p);
    p *= 2.03;
    amp *= 0.5;
  }

  return sum;
}

void main() {
  vec3 dir = normalize(v_direction);

  // Gradasi: horizon → atas (pakai pangkat agar horizon lebih lebar)
  float h = clamp(dir.y, 0.0, 1.0);
  vec3 color = mix(u_skyHorizonColor, u_skyTopColor, pow(h, 0.55));

  // Di bawah horizon (tertutup tanah/kabut)
  if (dir.y < 0.0) {
    color = mix(u_skyHorizonColor, u_groundColor, clamp(-dir.y * 4.0, 0.0, 1.0));
  }

  // Lapisan awan: arah pandang diproyeksikan ke "bidang langit" datar
  // (dibagi dir.y) sehingga awan terlihat mengecil ke arah horizon.
  if (dir.y > 0.0 && u_cloudCover > 0.0) {
    vec2 uv = dir.xz / (dir.y + 0.12) * 1.6 + vec2(u_time * 0.004, u_time * 0.0015);
    float n = fbm(uv);
    float detail = fbm(uv * 3.0 + 7.0);
    float cloud = smoothstep(0.62 - u_cloudCover * 0.35, 0.95 - u_cloudCover * 0.25, n * 0.75 + detail * 0.35);
    cloud *= smoothstep(0.0, 0.18, dir.y);           // pudar di horizon
    vec3 shade = mix(u_cloudColor * 0.82, u_cloudColor, detail);
    color = mix(color, shade, cloud);
  }

  // Halo matahari: makin dekat ke arah matahari makin terang
  float sunAmount = max(dot(dir, normalize(u_sunDirection)), 0.0);
  color += u_sunGlowColor * (pow(sunAmount, 12.0) * 0.35
                           + pow(sunAmount, 300.0) * 1.2);

  outColor = vec4(color, 1.0);
}
`;

// ---------------------------------------------------------------------
// Helper Shader & Program (sama dengan Praktikum 4 & 5)
// ---------------------------------------------------------------------
export function createShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);

    gl.deleteShader(shader);

    throw new Error("Shader compile error:\n" + info);
  }

  return shader;
}

export function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);

    gl.deleteProgram(program);

    throw new Error("Program link error:\n" + info);
  }

  return program;
}

// Mengumpulkan semua attribute & uniform location sekali saja di awal
// (di praktikum ditulis satu per satu; di sini otomatis lewat loop
// karena jumlah uniform-nya banyak).
export function getLocations(gl, program) {
  const locations = { attributes: {}, uniforms: {} };

  const attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

  for (let i = 0; i < attributeCount; i++) {
    const info = gl.getActiveAttrib(program, i);
    locations.attributes[info.name] = gl.getAttribLocation(program, info.name);
  }

  const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

  for (let i = 0; i < uniformCount; i++) {
    const info = gl.getActiveUniform(program, i);
    // Uniform array muncul sebagai "nama[0]"; simpan dengan nama dasar.
    const name = info.name.replace(/\[0\]$/, "");
    locations.uniforms[name] = gl.getUniformLocation(program, info.name);
  }

  return locations;
}
