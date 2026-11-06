/**
 * CyberShield Ethiopia — Digital City: 3D Graphics & World Rendering Engine
 *
 * Implements the full-scale 3D metropolis using Three.js:
 * - Denser Cyan & Warm Orange Cyber-City Skyline Architecture
 * - Landmark District Buildings: Hospital, Telecom Tower 994, Data Center, Bank, Government
 * - Autonomous Flying Drones (Friendly Sentinels & Hostile Attack Drones)
 * - Third-Person Follow Camera with Responsive Collision Pullback
 * - Holographic Forcefield Shields, Deployed Recovery Beacons & Expanding Shockwaves
 * - High-Contrast Dark Navy / Neon Ground Grid
 * - 100% Offline Procedural Generation (zero Math.random, SR-09 compliant)
 */

import * as THREE from 'three'
import {
  DISTRICTS,
  CANONICAL_CITY_LANDMARKS,
  CANONICAL_CITY_COVER_POINTS,
  generateCityBuildingLayout,
  getCityCollisionBoxes,
} from './cityDistricts.js'
import {
  buildCharacterMesh,
  updateCharacterAnimation,
  updateCharacterStateBadge,
  updateCharacterWeapon,
  buildDroneMesh,
  buildRecoveryBeaconMesh,
} from './characterSystem.js'

function createLandmarkLabel(text, color = '#00f0ff') {
  if (typeof document === 'undefined') return new THREE.Group()
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 340
    canvas.height = 48
    const ctx = canvas.getContext('2d')
    if (!ctx) return new THREE.Group()

    ctx.fillStyle = '#060d1a'
    ctx.fillRect(0, 0, 340, 48)
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.strokeRect(1, 1, 338, 46)

    ctx.font = 'bold 15px "Courier New", monospace'
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 170, 24)

    const texture = new THREE.CanvasTexture(canvas)
    const geom = new THREE.PlaneGeometry(18, 2.5)
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geom, mat)
    return mesh
  } catch (e) {
    return new THREE.Group()
  }
}

export class DigitalCityWorldRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.options = {
      graphicsQuality: 'high',
      antialias: true,
      ...options,
    }

    this.scene = null
    this.camera = null
    this.renderer = null
    this.buildings = []
    this.collisionBoxes = []
    this.characterMeshes = new Map() // id -> THREE.Group
    this.droneMeshes = new Map() // id -> THREE.Group
    this.droneLockLasers = new Map() // id -> THREE.Mesh (Target lock laser)
    this.beaconMeshes = new Map() // id -> THREE.Group
    this.shockwaveMeshes = [] // active shockwave rings
    this.projectileMeshes = [] // active projectile objects
    this.projectileMeshesMap = new Map() // id -> THREE.Mesh
    this.particlePool = []

    this.playerMesh = null
    this.cameraDistance = 7.5
    this.cameraHeight = 3.2
    this.cameraPitch = 0.22
    this.cameraYaw = 0
    this.targetCameraPos = new THREE.Vector3()

    this.isDisposed = false
    this.clock = new THREE.Clock()

    this.init()
  }

  init() {
    // 1. Scene - Crisp Ethiopian Afternoon Sunlight & Bright Sky
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xb2daf5) // Crisp daylight sky
    this.scene.fog = new THREE.FogExp2(0xcde5f7, 0.0016)

    // 2. Camera
    const aspect = this.canvas.clientWidth / (this.canvas.clientHeight || 1)
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.2, 800)
    this.camera.position.set(0, 5, 10)

    // 3. Renderer (with headless fallback)
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: this.options.graphicsQuality !== 'low',
        powerPreference: 'high-performance',
      })
      this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.options.graphicsQuality === 'ultra' ? 2 : 1.5))
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping
      this.renderer.toneMappingExposure = 1.15
    } catch {
      this.renderer = null
    }

    // 4. Lighting (Bright Natural Ethiopian Sunlight with Soft Sky Bounce)
    this.setupLighting()

    // 5. Environment & City Grid
    this.setupGroundTerrain()
    this.setupRoadNetwork()
    this.setupCoverBarricades()
    this.buildMetropolis()
    this.setupSkywardBeacons()
    this.setupObjectiveBeacon()
  }

  setupLighting() {
    // Ambient daylight fill
    const ambient = new THREE.AmbientLight(0xffffff, 1.25)
    this.scene.add(ambient)

    // Primary celestial sunlight (Warm Golden Ethiopian Afternoon Sun)
    const sunLight = new THREE.DirectionalLight(0xfff6e8, 2.2)
    sunLight.position.set(120, 220, 80)
    this.scene.add(sunLight)

    // Natural hemisphere sky/ground bounce light
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x64748b, 0.95)
    this.scene.add(hemiLight)

    // Soft sky fill light
    const fillLight = new THREE.DirectionalLight(0xbbe1fa, 0.8)
    fillLight.position.set(-100, 150, -80)
    this.scene.add(fillLight)
  }

  setupGroundTerrain() {
    // Large ground plane (420m x 420m) - Light concrete / paved stone urban plaza
    const groundGeom = new THREE.PlaneGeometry(420, 420, 32, 32)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.8,
      metalness: 0.15,
    })
    const groundMesh = new THREE.Mesh(groundGeom, groundMat)
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.position.y = 0
    this.scene.add(groundMesh)

    // Subtle Architectural Paver Grid Floor Overlay
    const gridHelper = new THREE.GridHelper(420, 84, 0x64748b, 0xcfd8dc)
    gridHelper.position.y = 0.05
    this.scene.add(gridHelper)
  }

  setupRoadNetwork() {
    const roadGroup = new THREE.Group()
    roadGroup.name = 'city_road_network'

    // Slate asphalt road material
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.82,
      metalness: 0.15,
    })

    const yellowDividerMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    const whiteMarkingMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.7, metalness: 0.1 })

    // 1. North-South Grand Avenue (x = 0, z from -200 to +200)
    const nsRoadGeom = new THREE.PlaneGeometry(14, 400)
    const nsRoad = new THREE.Mesh(nsRoadGeom, roadMat)
    nsRoad.rotation.x = -Math.PI / 2
    nsRoad.position.set(0, 0.08, 0)
    roadGroup.add(nsRoad)

    // Double yellow centerlines
    ;[-0.15, 0.15].forEach((offset) => {
      const lineGeom = new THREE.PlaneGeometry(0.18, 400)
      const line = new THREE.Mesh(lineGeom, yellowDividerMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(offset, 0.09, 0)
      roadGroup.add(line)
    })

    // Raised concrete sidewalks (Left & Right of NS Grand Avenue)
    ;[-8.5, 8.5].forEach((xSide) => {
      const sidewalkGeom = new THREE.BoxGeometry(3.0, 0.20, 400)
      const sidewalk = new THREE.Mesh(sidewalkGeom, curbMat)
      sidewalk.position.set(xSide, 0.10, 0)
      roadGroup.add(sidewalk)
    })

    // 2. East-West Federal Boulevard (z = 0, x from -200 to +200)
    const ewRoadGeom = new THREE.PlaneGeometry(400, 14)
    const ewRoad = new THREE.Mesh(ewRoadGeom, roadMat)
    ewRoad.rotation.x = -Math.PI / 2
    ewRoad.position.set(0, 0.08, 0)
    roadGroup.add(ewRoad)

    // Double yellow centerlines
    ;[-0.15, 0.15].forEach((offset) => {
      const lineGeom = new THREE.PlaneGeometry(400, 0.18)
      const line = new THREE.Mesh(lineGeom, yellowDividerMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(0, 0.09, offset)
      roadGroup.add(line)
    })

    // Raised concrete sidewalks (North & South of EW Boulevard)
    ;[-8.5, 8.5].forEach((zSide) => {
      const sidewalkGeom = new THREE.BoxGeometry(400, 0.20, 3.0)
      const sidewalk = new THREE.Mesh(sidewalkGeom, curbMat)
      sidewalk.position.set(0, 0.10, zSide)
      roadGroup.add(sidewalk)
    })

    // Zebra Crosswalks at central intersection
    ;[-12, 12].forEach((zCross) => {
      for (let s = -5; s <= 5; s += 1.4) {
        const stripeGeom = new THREE.PlaneGeometry(0.8, 3.5)
        const stripe = new THREE.Mesh(stripeGeom, whiteMarkingMat)
        stripe.rotation.x = -Math.PI / 2
        stripe.position.set(s, 0.095, zCross)
        roadGroup.add(stripe)
      }
    })

    // 3. District Ring Boulevards at X = ±120 and Z = ±120
    ;[-120, 120].forEach((xPos) => {
      const ringRoadGeom = new THREE.PlaneGeometry(10, 400)
      const ringRoad = new THREE.Mesh(ringRoadGeom, roadMat)
      ringRoad.rotation.x = -Math.PI / 2
      ringRoad.position.set(xPos, 0.08, 0)
      roadGroup.add(ringRoad)

      const lineGeom = new THREE.PlaneGeometry(0.25, 400)
      const line = new THREE.Mesh(lineGeom, yellowDividerMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(xPos, 0.09, 0)
      roadGroup.add(line)
    })

    ;[-120, 120].forEach((zPos) => {
      const ringRoadGeom = new THREE.PlaneGeometry(400, 10)
      const ringRoad = new THREE.Mesh(ringRoadGeom, roadMat)
      ringRoad.rotation.x = -Math.PI / 2
      ringRoad.position.set(0, 0.08, zPos)
      roadGroup.add(ringRoad)

      const lineGeom = new THREE.PlaneGeometry(400, 0.25)
      const line = new THREE.Mesh(lineGeom, yellowDividerMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(0, 0.09, zPos)
      roadGroup.add(line)
    })

    // 4. Streetlight Posts along Grand Avenues
    const poleGeom = new THREE.CylinderGeometry(0.10, 0.14, 6.5, 6)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85 })
    const lampHeadGeom = new THREE.BoxGeometry(0.5, 0.2, 0.9)
    const lampLightGeom = new THREE.PlaneGeometry(0.4, 0.8)
    const lampLightMat = new THREE.MeshBasicMaterial({ color: 0xfff8e7, side: THREE.DoubleSide })

    for (let z = -180; z <= 180; z += 40) {
      if (Math.abs(z) < 20) continue // leave plaza clear
      ;[-10.2, 10.2].forEach((xSide) => {
        const pole = new THREE.Mesh(poleGeom, poleMat)
        pole.position.set(xSide, 3.25, z)
        roadGroup.add(pole)

        const lamp = new THREE.Mesh(lampHeadGeom, poleMat)
        lamp.position.set(xSide + (xSide > 0 ? -0.4 : 0.4), 6.4, z)
        roadGroup.add(lamp)

        const bulb = new THREE.Mesh(lampLightGeom, lampLightMat)
        bulb.rotation.x = Math.PI / 2
        bulb.position.set(xSide + (xSide > 0 ? -0.4 : 0.4), 6.28, z)
        roadGroup.add(bulb)
      })
    }

    this.scene.add(roadGroup)
  }

  setupCoverBarricades() {
    const coverGroup = new THREE.Group()
    coverGroup.name = 'city_cover_barricades'

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8, metalness: 0.2 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.4 })
    const hazardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 })
    const shieldFieldMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85 })

    for (const c of CANONICAL_CITY_COVER_POINTS) {
      const bGroup = new THREE.Group()
      bGroup.position.set(c.x, 0, c.z)
      bGroup.name = c.id

      if (c.type === 'jersey_barrier') {
        // Concrete Jersey Barrier with chamfered base and yellow hazard chevrons
        const barrier = new THREE.Mesh(new THREE.BoxGeometry(c.width, c.height, c.depth), concreteMat)
        barrier.position.y = c.height / 2
        bGroup.add(barrier)

        // Yellow Hazard stripe trim on both sides
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(c.width * 0.92, 0.15, c.depth * 1.04), hazardMat)
        stripe.position.y = c.height * 0.65
        bGroup.add(stripe)

        ;[-1, 1].forEach((dir) => {
          const refl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, c.depth * 1.05), hazardMat)
          refl.position.set(dir * (c.width / 2 - 0.15), c.height * 0.75, 0)
          bGroup.add(refl)
        })
      } else if (c.type === 'sandbag_bunker') {
        // Multi-tiered Sandbag Revetment
        const numTiers = 3
        for (let t = 0; t < numTiers; t++) {
          const tierW = c.width - t * 0.25
          const tierD = c.depth - t * 0.1
          const tierH = c.height / numTiers
          const tier = new THREE.Mesh(new THREE.BoxGeometry(tierW, tierH * 0.95, tierD), sandbagMat)
          tier.position.y = t * tierH + tierH / 2
          bGroup.add(tier)
        }
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(c.width * 0.9, 0.20, c.depth * 0.7), sandbagMat)
        parapet.position.y = c.height + 0.10
        bGroup.add(parapet)
      } else if (c.type === 'cyber_shield_barrier') {
        // Heavy metallic generator base
        const base = new THREE.Mesh(new THREE.BoxGeometry(c.width, 0.35, c.depth), darkMat)
        base.position.y = 0.175
        bGroup.add(base)

        // Dual vertical emitter pylons
        ;[-1, 1].forEach((dir) => {
          const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.20, c.height, 8), pylonMat)
          pylon.position.set(dir * (c.width / 2 - 0.25), c.height / 2, 0)
          bGroup.add(pylon)
        })

        // Glowing translucent forcefield screen
        const forcefield = new THREE.Mesh(new THREE.PlaneGeometry(c.width * 0.85, c.height * 0.85), shieldFieldMat)
        forcefield.position.y = c.height * 0.52
        bGroup.add(forcefield)
      } else {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(c.width, c.height, c.depth), darkMat)
        bar.position.y = c.height / 2
        bGroup.add(bar)
      }

      coverGroup.add(bGroup)
    }

    this.coverGroup = coverGroup
    this.scene.add(coverGroup)
  }

  buildMetropolis() {
    this.buildings = generateCityBuildingLayout()
    this.collisionBoxes = getCityCollisionBoxes(this.buildings)

    const buildingGroup = new THREE.Group()
    buildingGroup.name = 'city_buildings'

    // Procedural cyan and orange matrix window textures
    const cyanTexture = this.createProceduralWindowTexture(false)
    const orangeTexture = this.createProceduralWindowTexture(true)

    this.buildings.forEach((b, idx) => {
      const geom = new THREE.BoxGeometry(b.width, b.height, b.depth)
      const isOrangeTheme = idx % 3 === 0 || b.districtId === 'industrial' || b.districtId === 'financial'
      const winTex = isOrangeTheme ? orangeTexture : cyanTexture
      const glowCol = isOrangeTheme ? 0xff7700 : 0x00f0ff

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(b.color).multiplyScalar(0.85),
        roughness: 0.45,
        metalness: 0.65,
        emissiveMap: winTex,
        emissive: new THREE.Color(glowCol).multiplyScalar(0.25),
      })

      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(b.x, b.height / 2, b.z)
      buildingGroup.add(mesh)

      // Rooftop glowing neon accent trim
      const roofStripGeom = new THREE.BoxGeometry(b.width + 0.3, 0.45, b.depth + 0.3)
      const roofStripMat = new THREE.MeshBasicMaterial({ color: glowCol })
      const roofStrip = new THREE.Mesh(roofStripGeom, roofStripMat)
      roofStrip.position.set(b.x, b.height, b.z)
      buildingGroup.add(roofStrip)

      // Rooftop transmission antenna with warning beacon
      if (b.hasRooftopAntenna) {
        const antennaGeom = new THREE.CylinderGeometry(0.12, 0.22, 9, 6)
        const antennaMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9 })
        const antenna = new THREE.Mesh(antennaGeom, antennaMat)
        antenna.position.set(b.x, b.height + 4.5, b.z)
        buildingGroup.add(antenna)

        const beaconGeom = new THREE.SphereGeometry(0.35, 8, 8)
        const beaconMat = new THREE.MeshBasicMaterial({ color: isOrangeTheme ? 0xff2200 : 0x00f0ff })
        const beacon = new THREE.Mesh(beaconGeom, beaconMat)
        beacon.position.set(b.x, b.height + 9, b.z)
        buildingGroup.add(beacon)
      }
    })

    // ========================================================================
    // 8 CANONICAL DISTRICT LANDMARKS & RECOGNIZABLE INSTITUTIONS
    // ========================================================================

    // A. Central Government Administration HQ & Citadel Plaza (x: 0, z: -120)
    const govPlazaGroup = new THREE.Group()
    govPlazaGroup.name = 'landmark_central_gov'

    const govPalaceGeom = new THREE.BoxGeometry(46, 36, 32)
    const govPalaceMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 })
    const govPalace = new THREE.Mesh(govPalaceGeom, govPalaceMat)
    govPalace.position.set(0, 18, -120)
    govPlazaGroup.add(govPalace)

    // Grand Entrance Steps descending forward
    for (let step = 0; step < 4; step++) {
      const stepGeom = new THREE.BoxGeometry(28 - step * 2, 1.2, 5 + step * 2.5)
      const stepMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })
      const stepMesh = new THREE.Mesh(stepGeom, stepMat)
      stepMesh.position.set(0, 0.6 + step * 1.2, -100 + step * 1.5)
      govPlazaGroup.add(stepMesh)
    }

    // 8 Neoclassical Cyber Columns along front portico
    const colGeom = new THREE.CylinderGeometry(0.85, 0.85, 24, 12)
    const colMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, emissive: 0x713f12, emissiveIntensity: 0.3 })
    for (let c = -3.5; c <= 3.5; c += 1.0) {
      const col = new THREE.Mesh(colGeom, colMat)
      col.position.set(c * 5.2, 12, -103)
      govPlazaGroup.add(col)
    }

    // Golden Pediment with national cyber crest
    const pedimentGeom = new THREE.ConeGeometry(24, 7, 4)
    const pedimentMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85 })
    const pediment = new THREE.Mesh(pedimentGeom, pedimentMat)
    pediment.rotation.y = Math.PI / 4
    pediment.position.set(0, 27.5, -103)
    govPlazaGroup.add(pediment)

    // Central Golden Dome & Observation Spire
    const domeGeom = new THREE.SphereGeometry(11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.15 })
    const dome = new THREE.Mesh(domeGeom, domeMat)
    dome.position.set(0, 36, -120)
    govPlazaGroup.add(dome)

    const govSpireGeom = new THREE.CylinderGeometry(0.2, 1.2, 38, 8)
    const govSpire = new THREE.Mesh(govSpireGeom, colMat)
    govSpire.position.set(0, 66, -120)
    govPlazaGroup.add(govSpire)

    const govLabel = createLandmarkLabel('CENTRAL GOVERNMENT ADMINISTRATION HQ', '#facc15')
    govLabel.position.set(0, 42, -102)
    govPlazaGroup.add(govLabel)
    buildingGroup.add(govPlazaGroup)

    // B. Security District (Federal Police HQ & Cybercrime SOC) (x: 0, z: 0)
    const secGroup = new THREE.Group()
    secGroup.name = 'landmark_security_soc'

    const citadelGeom = new THREE.CylinderGeometry(16, 26, 75, 8)
    const citadelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.25,
      metalness: 0.85,
      emissive: 0x00bbff,
      emissiveIntensity: 0.25,
    })
    const citadel = new THREE.Mesh(citadelGeom, citadelMat)
    citadel.position.set(0, 37.5, 0)
    secGroup.add(citadel)

    // Rotating Holographic Defense Ring
    const ringGeom = new THREE.TorusGeometry(28, 0.65, 8, 36)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true })
    this.citadelRing = new THREE.Mesh(ringGeom, ringMat)
    this.citadelRing.rotation.x = Math.PI / 2
    this.citadelRing.position.set(0, 62, 0)
    secGroup.add(this.citadelRing)

    // Security Gatehouse & Controlled Boom Gates
    const gateGeom = new THREE.BoxGeometry(16, 6, 8)
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 })
    const gate = new THREE.Mesh(gateGeom, gateMat)
    gate.position.set(0, 3, 26)
    secGroup.add(gate)

    // Police Strobes (Blue & Red)
    const strobeB = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: 0x0066ff }))
    strobeB.position.set(-6, 6.5, 26)
    secGroup.add(strobeB)
    const strobeR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: 0xff0033 }))
    strobeR.position.set(6, 6.5, 26)
    secGroup.add(strobeR)

    // Federal Police Patrol Cruiser parked in security lane
    const policeCarGroup = new THREE.Group()
    policeCarGroup.position.set(10, 0.9, 24)
    policeCarGroup.rotation.y = -Math.PI / 2
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 }))
    policeCarGroup.add(carBody)
    const carCabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.9), new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7 }))
    carCabin.position.set(-0.2, 1.1, 0)
    policeCarGroup.add(carCabin)
    const lightBarB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0x0066ff }))
    lightBarB.position.set(-0.2, 1.7, -0.3)
    policeCarGroup.add(lightBarB)
    const lightBarR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff0033 }))
    lightBarR.position.set(-0.2, 1.7, 0.3)
    policeCarGroup.add(lightBarR)
    secGroup.add(policeCarGroup)

    const secLabel = createLandmarkLabel('FEDERAL POLICE & CYBERCRIME SOC', '#00f0ff')
    secLabel.position.set(0, 32, 28)
    secGroup.add(secLabel)
    buildingGroup.add(secGroup)

    // C. Healthcare District (Black Lion Digital Emergency Hospital) (x: -120, z: 0)
    const hcGroup = new THREE.Group()
    hcGroup.name = 'landmark_hospital'

    const hospGeom = new THREE.BoxGeometry(38, 52, 32)
    const hospMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x064e3b, emissiveIntensity: 0.35, metalness: 0.8 })
    const hosp = new THREE.Mesh(hospGeom, hospMat)
    hosp.position.set(-120, 26, 0)
    hcGroup.add(hosp)

    // Prominent Glowing 3D Medical Cross (+)
    const crossHorizGeom = new THREE.BoxGeometry(8, 2.2, 0.6)
    const crossVertGeom = new THREE.BoxGeometry(2.2, 8, 0.6)
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    const crossH = new THREE.Mesh(crossHorizGeom, crossMat)
    const crossV = new THREE.Mesh(crossVertGeom, crossMat)
    crossH.position.set(-120, 45, 16.5)
    crossV.position.set(-120, 45, 16.5)
    hcGroup.add(crossH)
    hcGroup.add(crossV)

    // Ambulance Intake Ramp with cyan guide lights
    const rampGeom = new THREE.BoxGeometry(14, 2, 18)
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })
    const ramp = new THREE.Mesh(rampGeom, rampMat)
    ramp.rotation.x = 0.12
    ramp.position.set(-120, 1.5, 22)
    hcGroup.add(ramp)

    // Parked Ambulance Vehicle in Emergency Bay
    const ambulanceGroup = new THREE.Group()
    ambulanceGroup.position.set(-106, 1.2, 22)
    ambulanceGroup.rotation.y = -Math.PI / 2
    const ambBody = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.2, 2.4), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }))
    ambulanceGroup.add(ambBody)
    const ambStripe = new THREE.Mesh(new THREE.BoxGeometry(4.82, 0.35, 2.42), new THREE.MeshBasicMaterial({ color: 0xdc2626 }))
    ambStripe.position.y = 0.1
    ambulanceGroup.add(ambStripe)
    const ambCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 2.44), new THREE.MeshBasicMaterial({ color: 0xdc2626 }))
    ambulanceGroup.add(ambCrossH)
    const ambCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 2.44), new THREE.MeshBasicMaterial({ color: 0xdc2626 }))
    ambulanceGroup.add(ambCrossV)
    const ambLightB = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.6), new THREE.MeshBasicMaterial({ color: 0x00bbff }))
    ambLightB.position.set(0.6, 1.22, -0.4)
    ambulanceGroup.add(ambLightB)
    const ambLightR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.6), new THREE.MeshBasicMaterial({ color: 0xff0033 }))
    ambLightR.position.set(0.6, 1.22, 0.4)
    ambulanceGroup.add(ambLightR)
    hcGroup.add(ambulanceGroup)

    // Rooftop Air-Ambulance Helipad [H]
    const heliPadGeom = new THREE.RingGeometry(5, 6, 24)
    const heliPadMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide })
    const helipad = new THREE.Mesh(heliPadGeom, heliPadMat)
    helipad.rotation.x = Math.PI / 2
    helipad.position.set(-120, 52.2, 0)
    hcGroup.add(helipad)

    const hcLabel = createLandmarkLabel('BLACK LION EMERGENCY HOSPITAL 24/7', '#00ff88')
    hcLabel.position.set(-120, 56, 0)
    hcGroup.add(hcLabel)
    buildingGroup.add(hcGroup)

    // D. Education District (Addis Cyber Academy & University Campus) (x: -120, z: 120)
    const uniGroup = new THREE.Group()
    uniGroup.name = 'landmark_university'

    const uniQuadGeom = new THREE.BoxGeometry(38, 28, 32)
    const uniQuadMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, emissive: 0x581c87, emissiveIntensity: 0.3, metalness: 0.8 })
    const uniQuad = new THREE.Mesh(uniQuadGeom, uniQuadMat)
    uniQuad.position.set(-120, 14, 120)
    uniGroup.add(uniQuad)

    // 6 Classical Cyber Pillars along university entrance
    const uniColGeom = new THREE.CylinderGeometry(0.75, 0.75, 20, 10)
    const uniColMat = new THREE.MeshStandardMaterial({ color: 0xc084fc, metalness: 0.8 })
    for (let p = -2.5; p <= 2.5; p += 1.0) {
      const col = new THREE.Mesh(uniColGeom, uniColMat)
      col.position.set(-120 + p * 5.5, 10, 103)
      uniGroup.add(col)
    }

    // Quantum Research Dome with glowing latitude rings
    const qDomeGeom = new THREE.SphereGeometry(12, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
    const qDomeMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.9, roughness: 0.2 })
    const qDome = new THREE.Mesh(qDomeGeom, qDomeMat)
    qDome.position.set(-120, 28, 120)
    uniGroup.add(qDome)

    const qRingGeom = new THREE.TorusGeometry(12.2, 0.25, 8, 32)
    const qRingMat = new THREE.MeshBasicMaterial({ color: 0xc084fc })
    const qRing = new THREE.Mesh(qRingGeom, qRingMat)
    qRing.rotation.x = Math.PI / 2
    qRing.position.set(-120, 34, 120)
    uniGroup.add(qRing)

    // Quantum Atom Holographic Sculpture in University Quad
    const atomGroup = new THREE.Group()
    atomGroup.position.set(-120, 3.5, 90)
    const nucleus = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 12), new THREE.MeshBasicMaterial({ color: 0xc084fc }))
    atomGroup.add(nucleus)
    ;[0, Math.PI / 3, (2 * Math.PI) / 3].forEach((ang) => {
      const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.08, 6, 24), new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true }))
      orbitRing.rotation.x = ang
      orbitRing.rotation.y = ang * 0.5
      atomGroup.add(orbitRing)
    })
    uniGroup.add(atomGroup)

    const uniLabel = createLandmarkLabel('ADDIS CYBER ACADEMY & AI LAB', '#c084fc')
    uniLabel.position.set(-120, 36, 102)
    uniGroup.add(uniLabel)
    buildingGroup.add(uniGroup)

    // E. Financial District (Commercial Bank of Ethiopia - CBE Bank HQ) (x: 120, z: 0)
    const finGroup = new THREE.Group()
    finGroup.name = 'landmark_cbe_bank'

    const bankTowerGeom = new THREE.BoxGeometry(34, 95, 34)
    const bankTowerMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0xb45309, emissiveIntensity: 0.35, metalness: 0.9 })
    const bankTower = new THREE.Mesh(bankTowerGeom, bankTowerMat)
    bankTower.position.set(120, 47.5, 0)
    finGroup.add(bankTower)

    // 6 Classical Stone-and-Glass Columns
    const bankColGeom = new THREE.CylinderGeometry(1.0, 1.0, 22, 12)
    const bankColMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85 })
    for (let bc = -2.5; bc <= 2.5; bc += 1.0) {
      const col = new THREE.Mesh(bankColGeom, bankColMat)
      col.position.set(120 + bc * 5.6, 11, 18)
      finGroup.add(col)
    }

    // Heavy Currency Vault Door at Base with radial locking spokes
    const vaultDoorGeom = new THREE.CylinderGeometry(4.5, 4.5, 1.2, 24)
    const vaultDoorMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.95, roughness: 0.2 })
    const vaultDoor = new THREE.Mesh(vaultDoorGeom, vaultDoorMat)
    vaultDoor.rotation.x = Math.PI / 2
    vaultDoor.position.set(120, 6, 18.2)
    finGroup.add(vaultDoor)

    // Radial locking spokes on vault door
    const spokeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9 })
    for (let sp = 0; sp < 6; sp++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 0.4), spokeMat)
      spoke.rotation.z = (sp * Math.PI) / 3
      spoke.position.set(120, 6, 18.85)
      finGroup.add(spoke)
    }

    // Armored Cash Transport Truck at Bank Loading Dock
    const truckGroup = new THREE.Group()
    truckGroup.position.set(134, 1.6, 22)
    truckGroup.rotation.y = Math.PI / 2
    const truckCab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.5), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 }))
    truckGroup.add(truckCab)
    const truckVault = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.8, 2.6), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.95 }))
    truckVault.position.set(-3.2, 0.2, 0)
    truckGroup.add(truckVault)
    const truckGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(4.52, 0.25, 2.62), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9 }))
    truckGoldTrim.position.set(-3.2, 0.2, 0)
    truckGroup.add(truckGoldTrim)
    finGroup.add(truckGroup)

    // Accurate Birr / ETB Signage without Bitcoin symbol
    const finSign = createLandmarkLabel('COMMERCIAL BANK OF ETHIOPIA (CBE) - DIGITAL VAULT (ETB)', '#ffb800')
    finSign.position.set(120, 26, 18.5)
    finGroup.add(finSign)
    buildingGroup.add(finGroup)

    // F. Telecommunications District & Sovereign Cloud Data Center
    // 1) Ethio Telecom Tower 994 (x: 120, z: -120)
    const telGroup = new THREE.Group()
    telGroup.name = 'landmark_telecom'

    const towerGeom = new THREE.CylinderGeometry(1.2, 5.0, 115, 8)
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 })
    const tower = new THREE.Mesh(towerGeom, towerMat)
    tower.position.set(120, 57.5, -120)
    telGroup.add(tower)

    ;[65, 82, 100].forEach((height) => {
      const signalRingGeom = new THREE.TorusGeometry(8.5, 0.35, 8, 24)
      const signalRingMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true })
      const sRing = new THREE.Mesh(signalRingGeom, signalRingMat)
      sRing.rotation.x = Math.PI / 2
      sRing.position.set(120, height, -120)
      telGroup.add(sRing)
    })

    const telLabel = createLandmarkLabel('ETHIO TELECOM SPIRE 994', '#06b6d4')
    telLabel.position.set(120, 45, -104)
    telGroup.add(telLabel)
    buildingGroup.add(telGroup)

    // 2) Sovereign Cloud Data Center (x: 120, z: 120)
    const dcGroup = new THREE.Group()
    dcGroup.name = 'landmark_data_center'

    const dcBunkerGeom = new THREE.BoxGeometry(34, 34, 34)
    const dcBunkerMat = new THREE.MeshStandardMaterial({
      color: 0x0a192f,
      emissive: 0x10b981,
      emissiveIntensity: 0.25,
      metalness: 0.9,
    })
    const dcBunker = new THREE.Mesh(dcBunkerGeom, dcBunkerMat)
    dcBunker.position.set(120, 17, 120)
    dcGroup.add(dcBunker)

    ;[8, 16, 24, 32].forEach((h) => {
      const finGeom = new THREE.BoxGeometry(36, 0.55, 36)
      const finMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      const fin = new THREE.Mesh(finGeom, finMat)
      fin.position.set(120, h, 120)
      dcGroup.add(fin)
    })

    const dcLabel = createLandmarkLabel('SOVEREIGN CLOUD DATA CENTER (INSA)', '#10b981')
    dcLabel.position.set(120, 38, 102)
    dcGroup.add(dcLabel)
    buildingGroup.add(dcGroup)

    // G. Residential & Commercial District (x: -120, z: -120)
    const resGroup = new THREE.Group()
    resGroup.name = 'landmark_residential'

    const resApt1Geom = new THREE.BoxGeometry(26, 68, 26)
    const resAptMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, emissive: 0x831843, emissiveIntensity: 0.25, metalness: 0.8 })
    const resApt1 = new THREE.Mesh(resApt1Geom, resAptMat)
    resApt1.position.set(-120, 34, -120)
    resGroup.add(resApt1)

    const resApt2Geom = new THREE.BoxGeometry(22, 54, 22)
    const resApt2 = new THREE.Mesh(resApt2Geom, resAptMat)
    resApt2.position.set(-148, 27, -120)
    resGroup.add(resApt2)

    // Retail Arcade Storefronts
    const shopGeom = new THREE.BoxGeometry(28, 5, 6)
    const shopMat = new THREE.MeshBasicMaterial({ color: 0xec4899 })
    const shop = new THREE.Mesh(shopGeom, shopMat)
    shop.position.set(-120, 2.5, -104)
    resGroup.add(shop)

    const resLabel = createLandmarkLabel('SMART RESIDENTIAL & RETAIL ARCADE', '#ec4899')
    resLabel.position.set(-120, 22, -103)
    resGroup.add(resLabel)
    buildingGroup.add(resGroup)

    // H. Industrial & Energy District (Grand Renaissance SCADA Power Station) (x: 0, z: 120)
    const indGroup = new THREE.Group()
    indGroup.name = 'landmark_power_grid'

    const indPlantGeom = new THREE.BoxGeometry(42, 26, 32)
    const indPlantMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: 0xc2410c, emissiveIntensity: 0.3, metalness: 0.85 })
    const indPlant = new THREE.Mesh(indPlantGeom, indPlantMat)
    indPlant.position.set(0, 13, 120)
    indGroup.add(indPlant)

    // Dual Hyperbolic Cooling Towers
    const coolTowerGeom = new THREE.CylinderGeometry(6, 9, 36, 16)
    const coolTowerMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.8 })
    const coolT1 = new THREE.Mesh(coolTowerGeom, coolTowerMat)
    coolT1.position.set(-22, 18, 120)
    indGroup.add(coolT1)

    const coolT2 = new THREE.Mesh(coolTowerGeom, coolTowerMat)
    coolT2.position.set(22, 18, 120)
    indGroup.add(coolT2)

    const indLabel = createLandmarkLabel('GRAND RENAISSANCE POWER STATION (SCADA)', '#f97316')
    indLabel.position.set(0, 32, 102)
    indGroup.add(indLabel)
    buildingGroup.add(indGroup)

    this.scene.add(buildingGroup)
  }

  setupObjectiveBeacon() {
    this.objectiveBeaconGroup = new THREE.Group()
    this.objectiveBeaconGroup.name = 'objective_waypoint_beacon'
    this.objectiveBeaconGroup.position.set(120, 0, -120)

    // 1. Soaring vertical light beam (180m cylinder)
    const beamGeom = new THREE.CylinderGeometry(0.8, 1.6, 180, 16)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    })
    const beam = new THREE.Mesh(beamGeom, beamMat)
    beam.position.y = 90
    this.objectiveBeaconGroup.add(beam)

    // 2. Rotating Gold Waypoint Diamond
    const diamondGeom = new THREE.OctahedronGeometry(2.5, 0)
    const diamondMat = new THREE.MeshBasicMaterial({ color: 0xffd700 })
    this.waypointDiamond = new THREE.Mesh(diamondGeom, diamondMat)
    this.waypointDiamond.position.y = 28
    this.objectiveBeaconGroup.add(this.waypointDiamond)

    // 3. Ground target ring
    const groundRingGeom = new THREE.RingGeometry(8, 9.2, 32)
    const groundRingMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    const groundRing = new THREE.Mesh(groundRingGeom, groundRingMat)
    groundRing.rotation.x = Math.PI / 2
    groundRing.position.y = 0.2
    this.objectiveBeaconGroup.add(groundRing)

    // 4. Billboard label
    this.objectiveBeaconLabel = createLandmarkLabel('DEFEND TARGET: ETHIO TELECOM SPIRE 994', '#ffd700')
    this.objectiveBeaconLabel.position.set(0, 34, 0)
    this.objectiveBeaconGroup.add(this.objectiveBeaconLabel)

    this.scene.add(this.objectiveBeaconGroup)
  }

  updateObjectiveBeacon(targetX = 120, targetZ = -120, labelText = 'OBJECTIVE TARGET', isVisible = true) {
    if (!this.objectiveBeaconGroup) return
    this.objectiveBeaconGroup.visible = isVisible
    this.objectiveBeaconGroup.position.set(targetX, 0, targetZ)

    if (this.waypointDiamond) {
      this.waypointDiamond.rotation.y += 0.04
      this.waypointDiamond.rotation.x = Math.sin(Date.now() * 0.004) * 0.2
    }

    if (this.objectiveBeaconLabel && this.camera) {
      this.objectiveBeaconLabel.quaternion.copy(this.camera.quaternion)
    }
  }

  createProceduralWindowTexture(isOrange = false) {
    if (typeof document === 'undefined') return null
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#050811'
      ctx.fillRect(0, 0, 128, 128)

      ctx.fillStyle = isOrange ? '#ff7700' : '#00f0ff'
      const step = 8
      for (let y = 4; y < 128; y += step) {
        for (let x = 4; x < 128; x += step) {
          if ((x + y * 3) % 4 !== 0) {
            ctx.fillRect(x, y, 4, 4)
          }
        }
      }

      const texture = new THREE.CanvasTexture(canvas)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(4, 16)
      return texture
    } catch (e) {
      return null
    }
  }

  setupSkywardBeacons() {
    // Vertical light beam from Citadel core into the sky
    const beamGeom = new THREE.CylinderGeometry(0.8, 1.6, 320, 16)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.38,
    })
    const beam = new THREE.Mesh(beamGeom, beamMat)
    beam.position.set(0, 160, 0)
    this.scene.add(beam)
  }

  /**
   * Syncs character 3D meshes with simulation state
   */
  syncCharacters(player, friendlyGuards = [], enemies = []) {
    // 1. Sync or build Player Mesh
    if (!this.playerMesh) {
      this.playerMesh = buildCharacterMesh(player.classId || 'cyber_guard_recruit')
      this.scene.add(this.playerMesh)
      this.characterMeshes.set('player', this.playerMesh)
    }
    this.playerMesh.position.set(player.x, player.y || 0, player.z)
    this.playerMesh.rotation.y = player.rotationY || 0
    updateCharacterAnimation(this.playerMesh, player.animState || 'idle', 0.016, player.speed || 0)
    updateCharacterStateBadge(this.playerMesh, 'DEFENDER')

    if (this.playerMesh.userData?.parts?.overheadMarker && this.camera) {
      this.playerMesh.userData.parts.overheadMarker.quaternion.copy(this.camera.quaternion)
    }

    // 2. Sync Friendly Guards
    friendlyGuards.forEach((g) => {
      let mesh = this.characterMeshes.get(g.id)
      if (!mesh) {
        mesh = buildCharacterMesh(g.classId || 'cyber_guard_elite')
        this.scene.add(mesh)
        this.characterMeshes.set(g.id, mesh)
      }
      mesh.position.set(g.x, g.y || 0, g.z)
      mesh.rotation.y = g.rotationY || 0
      updateCharacterAnimation(mesh, g.health > 0 ? (Math.hypot(g.vx, g.vz) > 0.5 ? 'run' : 'idle') : 'defeat', 0.016)
      updateCharacterStateBadge(mesh, g.command || 'DEFENDER')

      // Scale overhead health bar and orientation
      if (mesh.userData && mesh.userData.parts) {
        if (mesh.userData.parts.hpBarMesh) {
          const hpRatio = Math.max(0, Math.min(1, g.health / (g.maxHealth || 120)))
          mesh.userData.parts.hpBarMesh.scale.x = hpRatio
        }
        if (mesh.userData.parts.overheadMarker) {
          mesh.userData.parts.overheadMarker.visible = g.health > 0
          if (this.camera) {
            mesh.userData.parts.overheadMarker.quaternion.copy(this.camera.quaternion)
          }
        }
      }
    })

    // 3. Sync Enemies & Clean Dead
    const activeEnemyIds = new Set(enemies.map((e) => e.id))
    for (const [id, mesh] of this.characterMeshes.entries()) {
      if (id !== 'player' && !id.startsWith('guard_') && !activeEnemyIds.has(id)) {
        this.scene.remove(mesh)
        this.characterMeshes.delete(id)
      }
    }

    if (!this.aimLasers) this.aimLasers = new Map()
    for (const [id, laserMesh] of this.aimLasers.entries()) {
      if (!activeEnemyIds.has(id)) {
        this.scene.remove(laserMesh)
        this.aimLasers.delete(id)
      }
    }

    enemies.forEach((e) => {
      let mesh = this.characterMeshes.get(e.id)
      if (!mesh) {
        mesh = buildCharacterMesh(e.classId || 'scout_hacker')
        this.scene.add(mesh)
        this.characterMeshes.set(e.id, mesh)
      }
      mesh.position.set(e.x, e.y || 0, e.z)
      mesh.rotation.y = e.rotationY || 0

      // Infiltrator cloaking
      mesh.visible = !e.isStealthed

      const anim = e.health <= 0 ? 'defeat' :
                   e.state === 'TAKE_COVER' ? 'cover' :
                   e.state === 'AIM' ? 'aim' :
                   e.state === 'ALERT' ? 'alert' :
                   e.state === 'ATTACK' ? 'attack' :
                   e.state === 'RETREAT' ? 'retreat' :
                   e.state === 'PATROL' ? 'patrol' :
                   (Math.hypot(e.vx || 0, e.vz || 0) > 0.5 ? 'run' : 'idle')

      updateCharacterAnimation(mesh, anim, 0.016)
      updateCharacterStateBadge(mesh, e.state)

      // Aim Telegraph Laser Beam (Visible red ray during AIM state)
      let laser = this.aimLasers.get(e.id)
      if (e.state === 'AIM' && e.health > 0) {
        if (!laser) {
          const laserGeom = new THREE.CylinderGeometry(0.005, 0.005, 1, 4)
          const laserMat = new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.40 })
          laser = new THREE.Mesh(laserGeom, laserMat)
          this.scene.add(laser)
          this.aimLasers.set(e.id, laser)
        }
        laser.visible = true
        const dx = player.x - e.x
        const dy = (player.y || 0) + 1.2 - 1.3
        const dz = player.z - e.z
        const dist = Math.hypot(dx, dy, dz)
        laser.scale.set(1, Math.max(0.1, dist), 1)
        laser.position.set(e.x + dx * 0.5, 1.3 + dy * 0.5, e.z + dz * 0.5)
        laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize())
      } else if (laser) {
        laser.visible = false
      }

      // Scale overhead health bar and billboard orientation
      if (mesh.userData && mesh.userData.parts) {
        if (mesh.userData.parts.hpBarMesh) {
          const hpRatio = Math.max(0, Math.min(1, e.health / (e.maxHealth || 100)))
          mesh.userData.parts.hpBarMesh.scale.x = hpRatio
        }
        if (mesh.userData.parts.overheadMarker) {
          mesh.userData.parts.overheadMarker.visible = e.health > 0
          if (this.camera) {
            mesh.userData.parts.overheadMarker.quaternion.copy(this.camera.quaternion)
          }
        }
      }
    })
  }

  /**
   * Syncs active 3D flying drones
   */
  syncDrones(drones = []) {
    const activeDroneIds = new Set(drones.map((d) => d.id))
    for (const [id, mesh] of this.droneMeshes.entries()) {
      if (!activeDroneIds.has(id)) {
        this.scene.remove(mesh)
        this.droneMeshes.delete(id)
      }
    }

    if (!this.droneLockLasers) this.droneLockLasers = new Map()
    for (const [id, laserMesh] of this.droneLockLasers.entries()) {
      if (!activeDroneIds.has(id)) {
        this.scene.remove(laserMesh)
        this.droneLockLasers.delete(id)
      }
    }

    drones.forEach((d) => {
      if (d.health <= 0) {
        const existingMesh = this.droneMeshes.get(d.id)
        if (existingMesh) {
          this.scene.remove(existingMesh)
          this.droneMeshes.delete(d.id)
        }
        const existingLaser = this.droneLockLasers.get(d.id)
        if (existingLaser) {
          this.scene.remove(existingLaser)
          this.droneLockLasers.delete(d.id)
        }
        return
      }

      let mesh = this.droneMeshes.get(d.id)
      if (!mesh) {
        mesh = buildDroneMesh(d.isEnemy)
        this.scene.add(mesh)
        this.droneMeshes.set(d.id, mesh)
      }

      mesh.position.set(d.x, d.y || 4.2, d.z)
      mesh.rotation.y = d.heading || 0
      // Combat pitch forward when locked onto target
      mesh.rotation.x = d.isTargetLocked ? 0.15 : 0
      mesh.rotation.z = Math.sin(Date.now() * 0.003 + (d.orbitOffset || 0)) * 0.06

      // Spin rotor discs
      if (mesh.userData && mesh.userData.rotors) {
        mesh.userData.rotors.forEach((r, idx) => {
          r.rotation.z += idx % 2 === 0 ? 0.45 : -0.45
        })
      }

      // Visual target lock indicator beam
      let lockLaser = this.droneLockLasers.get(d.id)
      if (d.isTargetLocked && d.targetPos) {
        if (!lockLaser) {
          const laserGeom = new THREE.CylinderGeometry(0.005, 0.005, 1, 4)
          const laserMat = new THREE.MeshBasicMaterial({
            color: d.isEnemy ? 0xff0033 : 0x00f0ff,
            transparent: true,
            opacity: 0.45,
          })
          lockLaser = new THREE.Mesh(laserGeom, laserMat)
          this.scene.add(lockLaser)
          this.droneLockLasers.set(d.id, lockLaser)
        }
        lockLaser.visible = true
        const dx = d.targetPos.x - d.x
        const dy = (d.targetPos.y || 1.2) - (d.y - 0.1)
        const dz = d.targetPos.z - d.z
        const dist = Math.hypot(dx, dy, dz)
        lockLaser.scale.set(1, Math.max(0.1, dist), 1)
        lockLaser.position.set(d.x + dx * 0.5, (d.y - 0.1) + dy * 0.5, d.z + dz * 0.5)
        lockLaser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize())
      } else if (lockLaser) {
        lockLaser.visible = false
      }
    })
  }

  /**
   * Syncs deployed Recovery Beacon totems
   */
  syncBeacons(beacons = []) {
    const activeIds = new Set(beacons.map((b) => b.id))
    for (const [id, mesh] of this.beaconMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh)
        this.beaconMeshes.delete(id)
      }
    }

    beacons.forEach((b) => {
      let mesh = this.beaconMeshes.get(b.id)
      if (!mesh) {
        mesh = buildRecoveryBeaconMesh()
        this.scene.add(mesh)
        this.beaconMeshes.set(b.id, mesh)
      }
      mesh.position.set(b.x, 0, b.z)
      if (mesh.userData && mesh.userData.ring) {
        mesh.userData.ring.rotation.z += 0.05
        const scale = 1.0 + Math.sin(Date.now() * 0.006) * 0.25
        mesh.userData.ring.scale.set(scale, scale, 1)
      }
    })
  }

  /**
   * Syncs expanding Network Pulse shockwave rings
   */
  syncShockwaves(shockwaves = []) {
    this.shockwaveMeshes.forEach((m) => this.scene.remove(m))
    this.shockwaveMeshes = []

    shockwaves.forEach((s) => {
      if (s.lifetime <= 0) return
      const geom = new THREE.RingGeometry(Math.max(0.1, s.radius - 0.75), s.radius, 36)
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: Math.max(0.1, s.lifetime / 0.6),
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.rotation.x = Math.PI / 2
      mesh.position.set(s.x, 0.2, s.z)
      this.scene.add(mesh)
      this.shockwaveMeshes.push(mesh)
    })
  }

  /**
   * Syncs active 3D simulated laser, energy, and plasma projectiles
   */
  syncProjectiles(projectiles = []) {
    if (!this.projectileMeshesMap) this.projectileMeshesMap = new Map()

    const activeIds = new Set(projectiles.map((p) => p.id))
    for (const [id, mesh] of this.projectileMeshesMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh)
        this.projectileMeshesMap.delete(id)
      }
    }

    projectiles.forEach((p) => {
      let mesh = this.projectileMeshesMap.get(p.id)
      if (!mesh) {
        const isEnemy = !!p.isEnemy
        const color = p.color || (isEnemy ? 0xef4444 : 0x00f0ff)
        // High-visibility glowing tracer bolt
        const geom = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6)
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) })
        mesh = new THREE.Mesh(geom, mat)

        const coreGeom = new THREE.SphereGeometry(0.12, 6, 6)
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
        const core = new THREE.Mesh(coreGeom, coreMat)
        mesh.add(core)

        this.scene.add(mesh)
        this.projectileMeshesMap.set(p.id, mesh)
      }

      mesh.position.set(p.startX, p.startY || 1.3, p.startZ)
      mesh.rotation.x = Math.PI / 2
      mesh.rotation.z = -Math.atan2(p.dirX || 0, p.dirZ || 1)
    })
  }

  /**
   * Spawns a laser or plasma projectile in 3D space
   */
  spawnProjectile({ id, startX, startY, startZ, dirX, dirZ, speed = 80, isEnemy = false, color = '#00f0ff' }) {
    const geom = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6)
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) })
    const mesh = new THREE.Mesh(geom, mat)

    mesh.position.set(startX, startY || 1.3, startZ)
    mesh.rotation.x = Math.PI / 2
    mesh.rotation.z = -Math.atan2(dirX, dirZ)

    this.scene.add(mesh)
    this.projectileMeshes.push({
      id,
      mesh,
      dirX,
      dirZ,
      speed,
      lifetime: 2.0, // seconds
      isEnemy,
    })
  }

  /**
   * Updates projectile movement and lifetimes
   */
  updateProjectiles(dtSeconds) {
    for (let i = this.projectileMeshes.length - 1; i >= 0; i--) {
      const p = this.projectileMeshes[i]
      p.lifetime -= dtSeconds
      p.mesh.position.x += p.dirX * p.speed * dtSeconds
      p.mesh.position.z += p.dirZ * p.speed * dtSeconds

      if (p.lifetime <= 0) {
        this.scene.remove(p.mesh)
        this.projectileMeshes.splice(i, 1)
      }
    }
  }

  /**
   * Updates third-person camera following the player smoothly
   */
  updateCamera(playerPos, cameraRotation = { yaw: 0, pitch: 0.25 }) {
    if (!this.camera || !playerPos) return

    const yaw = cameraRotation.yaw || 0
    const pitch = Math.max(-0.2, Math.min(0.85, cameraRotation.pitch || 0.25))

    const dist = this.cameraDistance
    const height = this.cameraHeight + Math.sin(pitch) * 2.5

    const offsetX = Math.sin(yaw) * Math.cos(pitch) * dist
    const offsetZ = Math.cos(yaw) * Math.cos(pitch) * dist

    this.targetCameraPos.set(
      playerPos.x + offsetX,
      Math.max(1.0, (playerPos.y || 0) + height),
      playerPos.z + offsetZ
    )

    // Smooth camera interpolation
    this.camera.position.lerp(this.targetCameraPos, 0.2)

    // Look at player chest
    const lookTarget = new THREE.Vector3(playerPos.x, (playerPos.y || 0) + 1.6, playerPos.z)
    this.camera.lookAt(lookTarget)
  }

  /**
   * Resize viewport dynamically when window or fullscreen state changes
   */
  handleResize() {
    if (this.isDisposed || !this.canvas || !this.renderer || !this.camera) return
    const width = this.canvas.clientWidth || window.innerWidth
    const height = this.canvas.clientHeight || window.innerHeight
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  /**
   * Master render call executed each frame
   */
  render() {
    if (this.isDisposed || !this.renderer || !this.scene || !this.camera) return

    const dt = this.clock.getDelta()

    // Rotate Citadel holographic ring
    if (this.citadelRing) {
      this.citadelRing.rotation.z += dt * 0.35
    }

    this.updateProjectiles(dt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.isDisposed = true
    if (this.renderer) {
      this.renderer.dispose()
    }
    if (this.droneLockLasers) {
      for (const l of this.droneLockLasers.values()) this.scene.remove(l)
      this.droneLockLasers.clear()
    }
    this.characterMeshes.clear()
    this.droneMeshes.clear()
    this.beaconMeshes.clear()
    this.shockwaveMeshes = []
  }
}
