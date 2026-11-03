# Tugas 2 Grafika Komputer — Scene 3D Gedung Menara Sains (Tower 1 ITS)

Scene 3D area **Gedung Menara Sains / Tower 1 ITS** (Fakultas Sains dan Analitika Data) dengan
**WebGL2 murni + JavaScript ES6**, tanpa Three.js atau engine lain. Isinya: menara 13 lantai dengan
louver dan tangga darurat zig-zag, pohon besar di depan gedung, totem F-SCIENTICS, taman, palang
parkir, pos satpam, gedung parkir KPA 2, mahasiswa berjalan, motor lewat, siklus siang-malam,
bayangan, dan gerak kamera yang meniru video survei.

| | |
|---|---|
| **Anggota A** | Ibrahim Ferel – 5025241049 |
| **Anggota B** | Raynald Ramadhani Fachriansyah – 5025241020 |

---

## 1. Cara menjalankan

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
├─ README.md             
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
│  ├─ building.js        Tower 1 + KPA 2 + gedung sekitar           
│  ├─ tree.js            pohon hierarki batang → cabang → daun      
│  ├─ student.js         mahasiswa + animasi berjalan               
│  ├─ vehicle.js         motor + roda berputar                      
│  ├─ props.js           taman, totem, palang parkir, pos satpam    
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