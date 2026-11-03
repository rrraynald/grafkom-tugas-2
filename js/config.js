
export const CONFIG = {
  // GEDUNG MENARA SAINS (Tower 1 ITS)  → dipakai building.js
  building: {
    floors: 13,
    floorHeight: 3.3,          
    width: 17.5,               
    depth: 15.0,               
    panelColumns: 13,          
    glassColumnIndex: 6,       
    panelRowsPerFloor: 2,      
    crownHeight: 3.4,          
    crownOverhang: 0.8,        
    louverGap: 1.15,           
    louverSpacing: 0.45,       
    louverStartFloor: 1,       

    colors: {
      panel: [0.86, 0.88, 0.90],      
      glass: [0.22, 0.42, 0.72],      
      louver: [0.93, 0.93, 0.90],     
      stair: [0.36, 0.37, 0.38],      
      crown: [0.17, 0.18, 0.20],      
      base: [0.55, 0.56, 0.58]       
    }
  },

  neighbors: {
    kpa2: { position: [-50, 0, 2.4], size: [40, 11, 40] },
    lowLeft: { position: [-25, 0, -22], size: [24, 8, 14] },
    oldRight: { position: [54, 0, -30], size: [14, 15, 36] }
  },

  garden: {
    center: [3.0, 0, 18.0],    
    wallLength: 17.0,
    wallHeight: 1.35,
    radiusX: 8.5,              
    radiusZ: 5.5,
    totemPosition: [-2.0, 0, 19.7],
    totemSize: [1.8, 6.2, 0.5]       
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

  // POHON 
  trees: {
    hero: { position: [2.6, 0, 10.6], height: 18.5, crownRadius: 4.6 },

    others: [
      [-25, 20, 13, 6.0, "round"],   
      [20, 16, 19, 9.5, "wide"],     
      [31, 26, 17, 8.5, "wide"],     
      [37, 41, 15, 4.0, "tall"],     
      [-2.6, 11.4, 6, 1.5, "round"], 
      [24, 2, 12, 5.0, "round"],
      [-15, -14, 11, 4.5, "round"],
      [14, -20, 12, 5.0, "round"],
      [44, 8, 11, 5.0, "wide"],
      [-6, -36, 12, 5.5, "round"]
    ],

    // Pohon latar
    background: { count: 34, radius: [95, 165] },

    swayAmplitude: 1.6,       
    swaySpeed: 1.1,           
    leafPulse: 0.025,         
    growDuration: 3.0,        

    colors: {
      bark: [0.36, 0.28, 0.22],
      leaf: [0.16, 0.34, 0.14]
    }
  },

  // MAHASISWA 
  students: {
    count: 12,
    walkSpeed: [1.1, 1.6],     
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

  // MOTOR  
  vehicles: {
    loopCenter: [3.0, 0, 21.0],   
    loopRadius: [12.5, 8.5],
    loopSpeed: 4.5,               
    loopCount: 2,
    gatePath: [[-17.5, 0, 46], [-17.5, 0, -6]], 
    gateSpeed: 4.0,
    bodyColors: [[0.12, 0.12, 0.13], [0.75, 0.10, 0.12], [0.82, 0.82, 0.84]],
    jacketOjol: [0.20, 0.62, 0.25]
  },

  // LINGKUNGAN 
  environment: {
    groundSize: 360,
    cloudCount: 16,               
    cloudHeight: [70, 100],
    cloudSpeed: 2.2,             
    cloudRange: 260,             
    sunDistance: 320,
    sunYawDeg: 71,               
    sunRadius: 9
  },

  // CAHAYA 
  lighting: {
    startHour: 8.75,
    dayLengthSeconds: 120,       
    ambientStrength: 1.0,        
    sunIntensity: 0.38,          
    exposure: 1.3,               
    cloudCover: 0.75,            
    specularStrength: 1.0,
    shininessScale: 1.0,
    pointLightRange: 0.045,      
    fogDensity: 0.0032,
    shadowMapSize: 2048,
    shadowArea: 95               
  },

  // KAMERA 
  camera: {
    fov: 50,
    near: 0.3,
    far: 1200,
    defaultPosition: [-44, 7, 112],
    defaultTarget: [0, 21, 0],
    videoPosition: [-32, 1.6, 56],
    videoTarget: [-4.5, 9.2, 15.0],
    videoFov: 42,
    moveSpeed: 14,               
    turnSpeed: 60,               
    smoothing: 7.0,              
    minDistanceToTower: 9.5,     
    maxDistance: 220,
    orbitSpeed: 0.12             
  },

  // ANIMASI GLOBAL
  animation: {
    speed: 1.0                   
  }
};
