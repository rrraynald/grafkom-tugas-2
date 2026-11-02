# Tugas 2 Grafika Komputer — Scene 3D Gedung Menara Sains (Tower 1 ITS)

Scene 3D area **Gedung Menara Sains / Tower 1 ITS** (Fakultas Sains dan Analitika Data) dengan
**WebGL2 murni + JavaScript ES6**, tanpa Three.js atau engine lain. Isinya: menara 13 lantai dengan
louver dan tangga darurat zig-zag, pohon besar di depan gedung, totem F-SCIENTICS, taman, palang
parkir, pos satpam, gedung parkir KPA 2, mahasiswa berjalan, motor lewat, siklus siang-malam,
bayangan, dan gerak kamera yang meniru video survei.

| | |
|---|---|
| **Kelompok** | [Nama Kelompok] |
| **Anggota A** | [Nama Anggota A] – [NRP] |
| **Anggota B** | Raynald Ramadhani Fachriansyah – 5025241020 |

---

## 1. Cara menjalankan

Kode memakai **ES module** (`<script type="module">`, sama seperti Praktikum 4 & 5), jadi **harus
dibuka lewat local server**. Membuka langsung dengan `file://` diblokir browser (CORS).

**Pilihan A — VS Code Live Server (paling mudah)**
1. Buka folder ini di VS Code.
2. Klik kanan `index.html` → **Open with Live Server**.

**Pilihan B — Python**
```bash
cd grafkom-tugas-2
python3 -m http.server 8000
# buka http://localhost:8000
```

Browser: Chrome / Edge / Safari / Firefox terbaru (wajib mendukung **WebGL2**).
Klik canvas dulu supaya kontrol keyboard aktif.

---

## 2. Struktur file

```
grafkom-tugas-2/
├─ index.html            halaman utama (foto, video, canvas, diagram tree, pembagian tugas)
├─ style.css
├─ README.md             file ini
├─ PENJELASAN.md         penjelasan konsep + daftar pertanyaan dosen
├─ js/
│  ├─ config.js          SEMUA parameter (ukuran, warna, jumlah, kecepatan, kamera, cahaya)
│  ├─ math3d.js          Vec3, Mat4 (gaya Praktikum 4/5), normal matrix
│  ├─ geometry.js        primitif: cube, box, plane, sphere, cylinder, cone, tapered box, prism, ...
│  ├─ shaders.js         shader scene (Phong/Blinn-Phong + shadow + fog), shadow, sky
│  ├─ scene-graph.js     class Node (hierarchical modelling) + createMaterial
│  ├─ texture.js         TextureManager + semua texture prosedural (canvas 2D)
│  ├─ camera.js          kamera, preset, gerak kamera video, orbit, ortho
│  ├─ lighting.js        matahari, siklus siang-malam, lampu titik
│  ├─ environment.js     tanah, langit, matahari, awan, tiang listrik
│  ├─ building.js        Tower 1 + KPA 2 + gedung sekitar           (Anggota A)
│  ├─ tree.js            pohon hierarki batang → cabang → daun      (Anggota B)
│  ├─ student.js         mahasiswa + animasi berjalan               (Anggota B)
│  ├─ vehicle.js         motor + roda berputar                      (Anggota B)
│  ├─ props.js           taman, totem, palang parkir, pos satpam    (Anggota B)
│  ├─ ui.js              panel kontrol, HUD, diagram tree otomatis
│  └─ main.js            init WebGL2, susun scene, render loop, input
└─ assets/
   ├─ photos/            foto survei (JPG dari HEIC) + stop-motion pan/tilt
   ├─ videos/            7 video survei (MP4 H.264 dari MOV HEVC)
   ├─ textures/          daun-foto.jpg (crop foto asli, dibuat tileable)
   └─ screenshots/       perbandingan foto asli vs render
```

---

## 3. Kontrol

| Tombol | Fungsi | Jenis input |
|---|---|---|
| `W`/`↑`, `S`/`↓` | maju / mundur sepanjang arah pandang | state-based |
| `A` / `D` | geser kiri / kanan | state-based |
| `Q`/`E` atau `←`/`→` | menengok kiri / kanan (yaw) | state-based |
| `PageUp` / `PageDown` | naik / turun | state-based |
| `[` / `]` | FOV (zoom optik) | state-based |
| Drag mouse | look-around (yaw + pitch, dibatasi ±80°) | event |
| Scroll | maju / mundur | event |
| `1` `2` `3` `4` | preset: overview jauh, dekat gedung, mata mahasiswa, top view | event |
| `5` `6` `7` `8` `9` `0` | gerak kamera video: Stay, Stay 0.5×, Pan, Tilt, Zoom, Dolly in | event |
| `V` | auto-tour (dolly → pan → tilt → zoom, berulang) | event |
| `O` | orbit camera (Challenge A Praktikum 4) | event |
| `P` | perspective ↔ orthographic | event |
| `N` | preset near/far | event |
| `R` | reset ke posisi default (paling jauh) | event |
| `Space` | pause / play animasi | event |
| `M` | siklus siang-malam otomatis | event |
| `,` / `.` | jam −/+ 30 menit | event |
| `F` | flat ↔ smooth shading (Praktikum 5) | event |
| `T` | filtering: MIPMAP / LINEAR / NEAREST | event |
| `G` | wrapping: REPEAT / CLAMP / MIRRORED | event |
| `B` | Blinn-Phong ↔ Phong | event |
| `H` | bayangan on/off | event |
| `X` | wireframe | event |

Panel di bawah canvas juga menyediakan semua toggle dan slider: kecepatan animasi, jam, ambient,
matahari, specular, shininess, exposure, UV scale, dan depth test.

---

## 4. Daftar fitur vs spesifikasi

| Spesifikasi | Implementasi |
|---|---|
| WebGL murni | `canvas.getContext("webgl2")`, tanpa library grafika |
| Primitif + normal + UV | `geometry.js` (11 jenis primitif, flat & smooth normal) |
| Hierarchical modelling | `scene-graph.js`, ±1800 node, kedalaman hingga 8 level |
| Translasi | mahasiswa di jalur, motor, awan, dolly kamera |
| Rotasi | matahari mengorbit, sendi lengan/kaki, roda, palang parkir, pohon bergoyang, bendera |
| Skala | pohon tumbuh, daun "bernapas", glow matahari, tanaman runcing, louver (non-seragam) |
| Delta time | semua animasi × `dt`; slider kecepatan & pause |
| Kamera | perspective/ortho, default paling jauh, WASD/QE/mouse, smoothing, batas tidak tembus gedung |
| Preset & auto-tour | 4 preset + 6 gerak kamera video + auto-tour + orbit |
| Lighting | per-fragment ambient (hemisphere) + diffuse + specular (Phong/Blinn), directional sun, 5 point light |
| Siang-malam | slider jam + auto; warna matahari, langit, awan, ambient ikut berubah |
| Emissive malam | jendela fasad (emissive map), strip kaca, papan "TOWER 1 ITS", totem, lampu |
| Material berbeda | panel semi-glossy, kaca specular tinggi + pantulan langit (Fresnel), louver matte, kanopi gelap, kayu/daun specular rendah |
| Texture | prosedural canvas + crop foto asli, mipmap, LINEAR_MIPMAP_LINEAR, REPEAT, flip Y, NPOT, anisotropic |
| Nilai tambah | shadow mapping (PCF 3×3), fog, tone mapping ACES, lapisan awan prosedural (fbm) |
| Kemiripan | posisi kamera & objek dikalibrasi dari foto (lihat bagian 6) |

---

## 5. Cara cepat memodifikasi (untuk challenge dosen)

Hampir semua angka ada di **`js/config.js`**. Ubah, simpan, lalu refresh browser.

| Permintaan dosen | Ubah di |
|---|---|
| Jumlah lantai / tinggi lantai | `CONFIG.building.floors`, `floorHeight` |
| Warna panel, kaca, louver, atap | `CONFIG.building.colors` |
| Jumlah mahasiswa | `CONFIG.students.count` |
| Kecepatan jalan / motor / awan | `CONFIG.students.walkSpeed`, `CONFIG.vehicles.loopSpeed`, `CONFIG.environment.cloudSpeed` |
| Jam awal / lama siklus | `CONFIG.lighting.startHour`, `dayLengthSeconds` |
| Kekuatan ambient / matahari | `CONFIG.lighting.ambientStrength`, `sunIntensity` |
| FOV / posisi default kamera | `CONFIG.camera.fov`, `defaultPosition`, `defaultTarget` |
| Posisi lampu taman | `CONFIG.props.lampPositions` |
| Posisi / jumlah pohon | `CONFIG.trees.others` |
| Kecepatan goyangan pohon | `CONFIG.trees.swayAmplitude`, `swaySpeed` |

**Menambah objek baru** (contoh: bola di atas totem):
```js
// di props.js, setelah totem dibuat:
totem.add(new Node("Bola Hiasan", {
  position: [0, 3.5, 0],                 // relatif terhadap totem
  mesh: Meshes.sphere(gl),
  meshScale: [0.4, 0.4, 0.4],
  material: createMaterial({ color: [1, 0.2, 0.2], specular: 1, shininess: 64 }),
  onUpdate: (node, dt, t) => { node.rotation[1] += 90 * dt; }   // berputar 90°/detik
}));
```
Diagram tree di halaman otomatis ikut berubah karena dibuat dari scene graph.

**Mengganti warna material saat demo** (lewat Console browser):
```js
app.scene.find("Badan Menara").material.color = [0.9, 0.6, 0.6];
app.lighting.hour = 18;                 // langsung sore
app.camera.applyPreset("top");          // top view
```

**Mengganti jenis lampu**: matahari = directional (`u_lightDirection`); lampu taman = point light
(`lighting.addPointLight(posisi, warna)`). Kalau mau lampu titik seperti Praktikum 5, cukup panggil
`addPointLight` dengan posisi baru.

---

## 6. Kalibrasi kemiripan dengan foto

- Metadata foto/video: **2 November 2026, ±08:43–08:47 WIB** → jam awal scene 08:45.
- Lensa utama iPhone 16:9: FOV horizontal ±69°, vertikal ±42°. Dari lebar menara di foto
  (`stop-motion-pan/5`), kamera berada ±60 m dari menara dan menyerong ±26–34° ke kiri
  (`CONFIG.camera.videoPosition`).
- Tinggi pohon besar (±18,5 m), totem (±6 m), posisi pos satpam, KPA 2, dan pohon kiri dihitung
  dari sudut elevasi/azimut objek di foto yang sama.
- Hasil perbandingan: `assets/screenshots/perbandingan.jpg`. Di halaman, tombol foto di kolom kiri
  memindahkan kamera WebGL ke sudut yang sama.

**Asumsi** (ditandai `ASUMSI:` di kode): jumlah lantai (13), tinggi lantai (3,3 m), sisi kanan gedung
(tidak terlihat di foto), tampilan malam, dan jarak taman dari menara.

---

## 7. Cara menggabungkan pekerjaan 2 anggota

Setiap objek ada di modul sendiri dan hanya berhubungan lewat **antarmuka** berikut:

```js
createTower(context)              // building.js  → Node
createNeighborBuildings(context)  // building.js  → Node
createTrees(context)              // tree.js      → Node
createProps(context)              // props.js     → Node
createStudents(context)           // student.js   → Node
createVehicles(context)           // vehicle.js   → Node
createEnvironment(context)        // environment.js → Node
// context = { gl, tm (TextureManager), lighting, world }
```

`main.js` cukup memanggil `scene.add(createX(context))`. Jadi Anggota A bisa mengerjakan
`building.js` dan Anggota B mengerjakan `tree.js` dkk. di branch Git berbeda tanpa konflik, lalu
di-merge. Alurnya: `git checkout -b anggota-a` → commit → `git merge`.

---

## 8. Pembagian tugas

| Anggota | Modul | Objek & fitur |
|---|---|---|
| A | survei, `building.js`, `texture.js`, `index.html`, `style.css` | foto/video, Tower 1, KPA 2, gedung sekitar, texture fasad/kaca/paving/totem, halaman & uji kemiripan |
| B | `main.js`, `shaders.js`, `scene-graph.js`, `geometry.js`, `math3d.js`, `camera.js`, `lighting.js`, `environment.js`, `tree.js`, `student.js`, `vehicle.js`, `props.js`, `ui.js` | arsitektur WebGL2, shadow map, kamera, cahaya, pohon, mahasiswa, motor, taman, UI |
