// =====================================================================
// config.js — SEMUA parameter scene ada di sini (siap untuk "challenge")
// ---------------------------------------------------------------------
// Satuan: 1 unit = 1 meter. Sumbu: +Y ke atas, +Z ke arah kamera
// (depan gedung), +X ke kanan (dilihat dari depan gedung).
// Titik (0,0,0) = pusat tapak Tower 1 di permukaan tanah.
//
// Kalau dosen minta "ganti warna / jumlah lantai / kecepatan / posisi
// lampu / FOV", cukup ubah nilai di file ini lalu refresh browser.
// =====================================================================

export const CONFIG = {
  // ------------------------------------------------------------------
  // GEDUNG MENARA SAINS (Tower 1 ITS)  → dipakai building.js
  // ------------------------------------------------------------------
  building: {
    // ASUMSI: ±13 lantai, dihitung dari ±26 baris panel (2 baris/lantai)
    // dan ±13 bordes tangga di balik louver pada foto stop-motion-tilt/7.
    floors: 13,
    // ASUMSI: 3.3 m/lantai → total ±46 m (rasio tinggi:lebar di foto ±2.6:1)
    floorHeight: 3.3,          // tinggi 1 lantai (m)
    width: 17.5,               // lebar muka depan (sumbu X)
    depth: 15.0,               // kedalaman / sisi louver (sumbu Z)
    panelColumns: 13,          // kolom panel di muka depan (6 + kaca + 6)
    glassColumnIndex: 6,       // kolom ke-7 (index 6) = strip kaca biru
    panelRowsPerFloor: 2,      // 2 baris panel per lantai (lihat foto)
    crownHeight: 3.4,          // pita atap gelap "TOWER 1 ITS"
    crownOverhang: 0.8,        // seberapa jauh kanopi atap menjorok
    louverGap: 1.15,           // jarak bidang louver dari dinding kiri
    louverSpacing: 0.45,       // jarak antar bilah louver
    louverStartFloor: 1,       // louver mulai dari lantai 2 (lantai 1 terbuka)

    colors: {
      panel: [0.86, 0.88, 0.90],      // panel abu-perak
      glass: [0.22, 0.42, 0.72],      // strip kaca biru
      louver: [0.93, 0.93, 0.90],     // bilah louver putih gading
      stair: [0.36, 0.37, 0.38],      // tangga darurat (lebih gelap agar terlihat di balik louver)
      crown: [0.17, 0.18, 0.20],      // pita atap gelap
      base: [0.55, 0.56, 0.58]        // plint dasar
    }
  },

  // Gedung-gedung di sekitar (lihat foto pan: KPA 2 di kiri, gedung lama
  // beratap genteng di kanan belakang, gedung rendah putih-biru di kiri).
  neighbors: {
    // Posisi dihitung ulang dari foto stop-motion-pan/1 & /5 (lihat
    // README bagian "Kalibrasi kemiripan").
    kpa2: { position: [-50, 0, 2.4], size: [40, 11, 40] },
    lowLeft: { position: [-25, 0, -22], size: [24, 8, 14] },
    oldRight: { position: [54, 0, -30], size: [14, 15, 36] }
  },

  // ------------------------------------------------------------------
  // TAMAN DEPAN & PROPERTI  → props.js
  // ------------------------------------------------------------------
  garden: {
    // ASUMSI: dari lebar dinding di foto, taman berada ±10 m di depan
    // muka menara (bukan menempel).
    center: [3.0, 0, 18.0],    // pusat dinding planter
    wallLength: 17.0,
    wallHeight: 1.35,
    radiusX: 8.5,              // jari-jari taman setengah elips
    radiusZ: 5.5,
    totemPosition: [-2.0, 0, 19.7],
    totemSize: [1.8, 6.2, 0.5]       // ASUMSI dari foto: ±6 m (lebih tinggi dari orang)
  },

  props: {
    gazeboPosition: [16, 0, 30.5],
    boomGateLeft: { position: [-23, 0, 19], length: 10.0 },
    boomGateRight: { position: [10, 0, 20.5], length: 6.0 },
    lampPositions: [
      [-7, 0, 29], [16, 0, 24], [-14, 0, 12], [22, 0, 38]
    ],
    binPositions: [[18.5, 0, 33], [19.3, 0, 33]],
    powerPole: [-28, 0, 24],
    cableEnd: [-50, 13, 62]
  },

  // ------------------------------------------------------------------
  // POHON  → tree.js
  // ------------------------------------------------------------------
  trees: {
    // Pohon besar di depan gedung (objek "hero" kedua). ASUMSI tinggi
    // ±16 m (≈1/3 tinggi menara, sesuai foto).
    // Dari foto stop-motion-pan/5: puncak ±18.5 m, tajuk mulai ±3.5 m,
    // lebar tajuk ±10 m (lonjong tinggi).
    hero: { position: [2.6, 0, 10.6], height: 18.5, crownRadius: 4.6 },

    // Pohon lain: [x, z, tinggi, jari-jari tajuk, tipe]
    // tipe "round" = tajuk bulat rimbun, "wide" = tajuk lebar,
    // "tall" = kurus tinggi (pohon kanan jauh di foto)
    others: [
      [-25, 20, 13, 6.0, "round"],   // depan KPA 2 (kiri foto)
      [20, 16, 19, 9.5, "wide"],     // rindang kanan di belakang pos satpam
      [31, 26, 17, 8.5, "wide"],     // rindang kanan kedua
      [37, 41, 15, 4.0, "tall"],     // kurus tinggi kanan jauh
      [-2.6, 11.4, 6, 1.5, "round"], // pohon kecil di taman (kiri totem)
      [24, 2, 12, 5.0, "round"],
      [-15, -14, 11, 4.5, "round"],
      [14, -20, 12, 5.0, "round"],
      [44, 8, 11, 5.0, "wide"],
      [-6, -36, 12, 5.5, "round"]
    ],

    // Pohon latar (pengisi kampus di kejauhan), dibuat dengan LOOP
    background: { count: 34, radius: [95, 165] },

    swayAmplitude: 1.6,       // derajat goyangan batang
    swaySpeed: 1.1,           // rad/detik
    leafPulse: 0.025,         // skala "napas" gugus daun (2.5%)
    growDuration: 3.0,        // detik efek tumbuh di awal

    colors: {
      bark: [0.36, 0.28, 0.22],
      leaf: [0.16, 0.34, 0.14]
    }
  },

  // ------------------------------------------------------------------
  // MAHASISWA  → student.js
  // ------------------------------------------------------------------
  students: {
    count: 12,
    walkSpeed: [1.1, 1.6],     // m/detik (min, max)
    // Jalur (polyline) di plaza paving. Mahasiswa bolak-balik di jalur.
    paths: [
      [[-20, 0, 30], [-6, 0, 27], [10, 0, 25]],
      [[-12, 0, 18], [-8, 0, 23], [-4, 0, 34], [-6, 0, 50]],
      [[-18, 0, 12], [-12, 0, 16], [-6, 0, 9.5]],
      [[12, 0, 22], [18, 0, 32], [26, 0, 42]],
      [[-30, 0, 44], [-14, 0, 41], [4, 0, 40], [18, 0, 36]],
      [[12, 0, 9], [13, 0, 18], [6, 0, 29]],
      [[-2, 0, 54], [2, 0, 37], [10, 0, 27]]
    ],
    shirtColors: [
      [0.92, 0.92, 0.92], [0.15, 0.17, 0.22], [0.62, 0.10, 0.12],
      [0.20, 0.36, 0.62], [0.82, 0.68, 0.52], [0.26, 0.42, 0.30],
      [0.85, 0.56, 0.64], [0.45, 0.45, 0.48]
    ],
    pantsColors: [
      [0.12, 0.13, 0.18], [0.30, 0.38, 0.55], [0.20, 0.20, 0.20],
      [0.55, 0.50, 0.42]
    ],
    hijabChance: 0.4
  },

  // ------------------------------------------------------------------
  // MOTOR  → vehicle.js
  // ------------------------------------------------------------------
  vehicles: {
    loopCenter: [3.0, 0, 21.0],   // motor berputar mengelilingi taman
    loopRadius: [12.5, 8.5],
    loopSpeed: 4.5,               // m/detik
    loopCount: 2,
    gatePath: [[-17.5, 0, 46], [-17.5, 0, -6]], // lewat palang kiri
    gateSpeed: 4.0,
    bodyColors: [[0.12, 0.12, 0.13], [0.75, 0.10, 0.12], [0.82, 0.82, 0.84]],
    jacketOjol: [0.20, 0.62, 0.25]
  },

  // ------------------------------------------------------------------
  // LINGKUNGAN  → environment.js
  // ------------------------------------------------------------------
  environment: {
    groundSize: 360,
    cloudCount: 16,               // awan 3D (selain lapisan awan di shader langit)
    cloudHeight: [70, 100],
    cloudSpeed: 2.2,             // m/detik (translasi awan)
    cloudRange: 260,             // awan muncul lagi setelah keluar batas
    sunDistance: 320,
    sunYawDeg: 71,               // arah terbit (sun naik di belakang gedung)
    sunRadius: 9
  },

  // ------------------------------------------------------------------
  // CAHAYA  → lighting.js
  // ------------------------------------------------------------------
  lighting: {
    // Foto & video diambil ±08:43 WIB (metadata EXIF/QuickTime).
    startHour: 8.75,
    dayLengthSeconds: 120,       // 1 siklus 24 jam = 120 detik saat auto
    ambientStrength: 1.0,        // tinggi karena langit berawan (difus)
    sunIntensity: 0.38,          // matahari tertutup awan → bayangan samar
    exposure: 1.3,               // kecerahan sebelum tone mapping ACES
    cloudCover: 0.75,            // lapisan awan langit (0 cerah – 1 mendung)
    specularStrength: 1.0,
    shininessScale: 1.0,
    pointLightRange: 0.045,      // makin kecil makin jauh jangkauan lampu
    fogDensity: 0.0032,
    shadowMapSize: 2048,
    shadowArea: 95               // setengah lebar area shadow map (m)
  },

  // ------------------------------------------------------------------
  // KAMERA  → camera.js
  // ------------------------------------------------------------------
  camera: {
    fov: 50,
    near: 0.3,
    far: 1200,
    // Posisi default PALING JAUH: seluruh menara + pohon + taman masuk.
    defaultPosition: [-44, 7, 112],
    defaultTarget: [0, 21, 0],
    // Titik tempat Anggota A berdiri saat memotret/merekam, dihitung dari
    // foto stop-motion-pan/5: ±60 m dari menara, menyerong 26° ke kiri,
    // kamera mendongak ±9°. FOV vertikal kamera utama iPhone 16:9 ≈ 42°.
    videoPosition: [-32, 1.6, 56],
    videoTarget: [-4.5, 9.2, 15.0],
    videoFov: 42,
    moveSpeed: 14,               // m/detik (W/S/A/D)
    turnSpeed: 60,               // derajat/detik (Q/E/←/→)
    smoothing: 7.0,              // makin besar makin cepat mengejar target
    minDistanceToTower: 9.5,     // kamera tidak boleh menembus gedung
    maxDistance: 220,
    orbitSpeed: 0.12             // rad/detik untuk orbit camera (O)
  },

  // ------------------------------------------------------------------
  // ANIMASI GLOBAL
  // ------------------------------------------------------------------
  animation: {
    speed: 1.0                   // pengali kecepatan semua animasi
  }
};
