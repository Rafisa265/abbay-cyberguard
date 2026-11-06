/**
 * CyberShield Ethiopia — Digital City: 3D Military Character & Weapon System
 *
 * Implements high-fidelity procedural military 3D models and tactical animations for:
 * - Friendly Cyber Guard soldiers (Recruit, Elite Commander, Heavy Support, Precision, Squad)
 * - Hostile Syndicate Hacker military units (Scout, Assault, Heavy, Precision Sniper, Drone Operator, Commander)
 * - Campaign Bosses with multi-stage visual forms
 * - Fully articulated military uniforms: helmets, visors, plate carriers, MOLLE pouches,
 *   pauldrons, elbow/knee pads, combat belts, sidearm holsters, and tactical combat boots.
 * - Modular hand-held 3D weapons attached correctly to hands.
 *
 * Compliant with SR-09: 100% deterministic kinematics (zero Math.random).
 */

import * as THREE from 'three'

export const CHARACTER_CLASSES = {
  // --- DEFENDER CLASSES ---
  cyber_guard_recruit: {
    id: 'cyber_guard_recruit',
    name: 'Cyber Guard Standard Rifleman',
    faction: 'defenders',
    role: 'defender',
    health: 120,
    shield: 80,
    speed: 4.2,
    sprintSpeed: 6.8,
    color: '#00bbff',
    visorColor: '#38bdf8',
    armorStyle: 'tactical_light',
    scale: 1.0,
    weaponName: 'Cyan Precision Energy Rifle',
    weaponType: 'cyber_assault_rifle',
  },
  cyber_guard_elite: {
    id: 'cyber_guard_elite',
    name: 'Elite Squad Commander',
    faction: 'defenders',
    role: 'commander',
    health: 180,
    shield: 140,
    speed: 4.5,
    sprintSpeed: 7.0,
    color: '#0284c7',
    visorColor: '#67e8f9',
    armorStyle: 'tactical_heavy',
    scale: 1.05,
    weaponName: 'Heavy Energy Rifle',
    weaponType: 'heavy_energy_rifle',
  },
  cyber_guard_heavy: {
    id: 'cyber_guard_heavy',
    name: 'Heavy Defense Specialist',
    faction: 'defenders',
    role: 'heavy',
    health: 260,
    shield: 200,
    speed: 3.6,
    sprintSpeed: 5.5,
    color: '#1e3a8a',
    visorColor: '#93c5fd',
    armorStyle: 'heavy_bastion',
    scale: 1.22,
    weaponName: 'Fortress Plasma Cannon',
    weaponType: 'plasma_cannon',
  },
  cyber_guard_precision: {
    id: 'cyber_guard_precision',
    name: 'Precision Support Marksman',
    faction: 'defenders',
    role: 'precision',
    health: 130,
    shield: 90,
    speed: 4.0,
    sprintSpeed: 6.5,
    color: '#0369a1',
    visorColor: '#7dd3fc',
    armorStyle: 'tactical_recon',
    scale: 1.12,
    weaponName: 'Precision Cyber Rifle',
    weaponType: 'precision_rifle',
  },

  // --- ENEMY ATTACKER CLASSES ---
  scout_hacker: {
    id: 'scout_hacker',
    name: 'Syndicate Recon Scout',
    faction: 'attackers',
    role: 'scout',
    health: 60,
    shield: 30,
    speed: 3.8,
    color: '#ef4444',
    visorColor: '#f87171',
    behavior: 'recon_hit_and_run',
    attackRange: 25,
    damage: 10,
    scale: 1.08,
    weaponName: 'Scout Rapid SMG',
    weaponType: 'scout_smg',
  },
  malware_unit: {
    id: 'malware_unit',
    name: 'Malware Assault Trooper',
    faction: 'attackers',
    role: 'assault',
    health: 85,
    shield: 40,
    speed: 3.4,
    color: '#dc2626',
    visorColor: '#fca5a5',
    behavior: 'swarming_infected',
    attackRange: 18,
    damage: 14,
    scale: 1.12,
    weaponName: 'Assault Plasma Rifle',
    weaponType: 'assault_rifle',
  },
  assault_hacker: {
    id: 'assault_hacker',
    name: 'Hostile Assault Soldier',
    faction: 'attackers',
    role: 'assault',
    health: 90,
    shield: 50,
    speed: 3.4,
    color: '#dc2626',
    visorColor: '#fca5a5',
    behavior: 'tactical_fireteam',
    attackRange: 18,
    damage: 15,
    scale: 1.12,
    weaponName: 'Assault Plasma Rifle',
    weaponType: 'assault_rifle',
  },
  infiltrator: {
    id: 'infiltrator',
    name: 'Ghost Infiltrator',
    faction: 'attackers',
    role: 'infiltrator',
    health: 75,
    shield: 60,
    speed: 3.6,
    color: '#7f1d1d',
    visorColor: '#f43f5e',
    behavior: 'stealth_cloaked',
    attackRange: 16,
    damage: 18,
    scale: 1.08,
    hasStealth: true,
    weaponName: 'Silenced Tactical Carbine',
    weaponType: 'carbine',
  },
  heavy_attacker: {
    id: 'heavy_attacker',
    name: 'Brute Force Heavy Gunner',
    faction: 'attackers',
    role: 'heavy',
    health: 240,
    shield: 160,
    speed: 2.6,
    color: '#991b1b',
    visorColor: '#fb7185',
    behavior: 'armored_siege',
    attackRange: 20,
    damage: 24,
    scale: 1.25,
    weaponName: 'Heavy Rotary Plasma Cannon',
    weaponType: 'heavy_cannon',
  },
  drone_controller: {
    id: 'drone_controller',
    name: 'Botnet Drone Operator',
    faction: 'attackers',
    role: 'drone_operator',
    health: 110,
    shield: 80,
    speed: 3.0,
    color: '#b91c1c',
    visorColor: '#f87171',
    behavior: 'drone_summoner',
    attackRange: 30,
    damage: 12,
    scale: 1.0,
    weaponName: 'Telemetry Console & Sidearm',
    weaponType: 'sidearm_blaster',
  },
  precision_sniper: {
    id: 'precision_sniper',
    name: 'Syndicate Precision Marksman',
    faction: 'attackers',
    role: 'precision',
    health: 80,
    shield: 45,
    speed: 3.2,
    color: '#831843',
    visorColor: '#f472b6',
    behavior: 'long_range_overwatch',
    attackRange: 36,
    damage: 35,
    scale: 1.0,
    weaponName: 'Syndicate Beam Sniper',
    weaponType: 'long_range_sniper',
  },
  ransomware_specialist: {
    id: 'ransomware_specialist',
    name: 'Ransomware Encryptor',
    faction: 'attackers',
    role: 'specialist',
    health: 130,
    shield: 90,
    speed: 3.0,
    color: '#701a75',
    visorColor: '#e879f9',
    behavior: 'target_locker',
    attackRange: 22,
    damage: 20,
    scale: 1.05,
    weaponName: 'Cryptographic Beam Lock',
    weaponType: 'burst_rifle',
  },
  network_saboteur: {
    id: 'network_saboteur',
    name: 'Signal Saboteur',
    faction: 'attackers',
    role: 'saboteur',
    health: 120,
    shield: 70,
    speed: 3.6,
    color: '#9a3412',
    visorColor: '#fdba74',
    behavior: 'emp_disruptor',
    attackRange: 24,
    damage: 16,
    scale: 1.12,
    weaponName: 'Signal Jammer Carbine',
    weaponType: 'carbine',
  },
  elite_commander: {
    id: 'elite_commander',
    name: 'Attacker Field Commander',
    faction: 'attackers',
    role: 'commander',
    health: 280,
    shield: 220,
    speed: 3.4,
    color: '#4c0519',
    visorColor: '#f43f5e',
    behavior: 'tactical_coordinator',
    attackRange: 32,
    damage: 26,
    scale: 1.24,
    weaponName: 'Dual Heavy Plasma Rifles',
    weaponType: 'heavy_energy_rifle',
  },

  // --- CAMPAIGN BOSSES ---
  boss_the_phantom: {
    id: 'boss_the_phantom',
    name: 'The Phantom (Infiltration Mastermind)',
    faction: 'boss',
    role: 'boss',
    health: 850,
    shield: 500,
    speed: 3.8,
    color: '#312e81',
    visorColor: '#818cf8',
    behavior: 'boss_teleport_stealth',
    attackRange: 35,
    damage: 32,
    scale: 1.25,
    bossPhases: 3,
    weaponType: 'long_range_sniper',
  },
  boss_the_ransom_king: {
    id: 'boss_the_ransom_king',
    name: 'The Ransom King (Crypto Extortionist)',
    faction: 'boss',
    role: 'boss',
    health: 1200,
    shield: 700,
    speed: 2.8,
    color: '#581c87',
    visorColor: '#c084fc',
    behavior: 'boss_lockdown_earthshaker',
    attackRange: 30,
    damage: 38,
    scale: 1.45,
    bossPhases: 3,
    weaponType: 'heavy_cannon',
  },
  boss_the_signal_breaker: {
    id: 'boss_the_signal_breaker',
    name: 'The Signal Breaker (Telecom Destroyer)',
    faction: 'boss',
    role: 'boss',
    health: 1050,
    shield: 650,
    speed: 3.2,
    color: '#9a3412',
    visorColor: '#fb923c',
    behavior: 'boss_emp_barrage',
    attackRange: 32,
    damage: 34,
    scale: 1.35,
    bossPhases: 3,
    weaponType: 'burst_rifle',
  },
  boss_the_data_reaper: {
    id: 'boss_the_data_reaper',
    name: 'The Data Reaper (Exfiltration Overlord)',
    faction: 'boss',
    role: 'boss',
    health: 1350,
    shield: 800,
    speed: 3.0,
    color: '#064e3b',
    visorColor: '#34d399',
    behavior: 'boss_minion_spawner',
    attackRange: 30,
    damage: 40,
    scale: 1.4,
    bossPhases: 4,
    weaponType: 'quantum_blaster',
  },
  boss_the_architect: {
    id: 'boss_the_architect',
    name: 'The Architect (Syndicate Supreme Core)',
    faction: 'boss',
    role: 'boss',
    health: 1800,
    shield: 1000,
    speed: 3.2,
    color: '#881337',
    visorColor: '#fb7185',
    behavior: 'boss_multi_phase_apocalypse',
    attackRange: 40,
    damage: 45,
    scale: 1.5,
    bossPhases: 4,
    weaponType: 'heavy_cannon',
  },
}

// Overhead dynamic state billboard cache
const STATE_TEXTURE_CACHE = new Map()

export function getOrCreateStateTexture(stateKey, isDefender = false) {
  const cacheKey = `${stateKey}_${isDefender ? 'def' : 'atk'}`
  if (STATE_TEXTURE_CACHE.has(cacheKey)) {
    return STATE_TEXTURE_CACHE.get(cacheKey)
  }

  if (typeof document === 'undefined') {
    return new THREE.Texture()
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) return new THREE.Texture()

    ctx.clearRect(0, 0, 256, 64)

    let bgColor = isDefender ? 'rgba(2, 132, 199, 0.85)' : 'rgba(220, 38, 38, 0.85)'
    let borderColor = isDefender ? '#00f0ff' : '#f87171'
    let textColor = '#ffffff'
    let label = stateKey

    switch (stateKey) {
      case 'ALERT':
        bgColor = 'rgba(234, 88, 12, 0.90)'
        borderColor = '#facc15'
        label = 'ALERT ⚠️'
        break
      case 'AIM':
        bgColor = 'rgba(225, 29, 72, 0.92)'
        borderColor = '#f43f5e'
        label = 'AIM 🎯'
        break
      case 'ATTACK':
        bgColor = 'rgba(185, 28, 28, 0.95)'
        borderColor = '#ef4444'
        label = 'ATTACK ⚔️'
        break
      case 'TAKE_COVER':
      case 'COVER':
        bgColor = 'rgba(37, 99, 235, 0.90)'
        borderColor = '#60a5fa'
        label = 'COVER 🛡️'
        break
      case 'RETREAT':
        bgColor = 'rgba(107, 114, 128, 0.90)'
        borderColor = '#9ca3af'
        label = 'RETREAT 🏃'
        break
      case 'DEFEATED':
        bgColor = 'rgba(30, 41, 59, 0.90)'
        borderColor = '#64748b'
        label = 'DEFEATED ☠️'
        break
      case 'DEFENDER':
      case 'CYBER_GUARD':
        bgColor = 'rgba(2, 132, 199, 0.90)'
        borderColor = '#00f0ff'
        label = 'CYBER GUARD 🛡️'
        break
      case 'PATROL':
      default:
        label = 'PATROL'
        break
    }

    ctx.fillStyle = bgColor
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 3

    ctx.beginPath()
    ctx.roundRect(4, 4, 248, 56, 8)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = textColor
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 128, 32)

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    STATE_TEXTURE_CACHE.set(cacheKey, texture)
    return texture
  } catch (err) {
    return new THREE.Texture()
  }
}

export function updateCharacterStateBadge(charGroup, stateKey) {
  if (!charGroup || !charGroup.userData || !charGroup.userData.parts) return
  const badgeMesh = charGroup.userData.parts.stateBadgeMesh
  if (!badgeMesh || !badgeMesh.material) return

  const isDefender = charGroup.userData.spec?.faction === 'defenders'
  const normalizedKey = stateKey ? stateKey.toUpperCase() : (isDefender ? 'CYBER_GUARD' : 'PATROL')

  if (badgeMesh.userData?.currentState === normalizedKey) return

  const tex = getOrCreateStateTexture(normalizedKey, isDefender)
  badgeMesh.material.map = tex
  badgeMesh.material.needsUpdate = true
  if (!badgeMesh.userData) badgeMesh.userData = {}
  badgeMesh.userData.currentState = normalizedKey
}

/**
 * Builds a bespoke modular 3D military weapon model
 */
export function buildWeaponModel(weaponType = 'cyber_assault_rifle', isDefender = true, scale = 1.0) {
  const group = new THREE.Group()
  group.name = `weapon_${weaponType}`

  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.8 })
  const metalMat = new THREE.MeshStandardMaterial({ color: isDefender ? 0xcbd5e1 : 0x475569, roughness: 0.3, metalness: 0.85 })
  const glowMat = new THREE.MeshBasicMaterial({ color: isDefender ? 0x00f0ff : 0xff2200 })
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.9 })

  switch (weaponType) {
    case 'scout_smg': {
      // --- SCOUT RAPID SMG ---
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09 * scale, 0.13 * scale, 0.28 * scale), darkMat)
      group.add(receiver)

      // Twin short barrels
      ;[-0.025, 0.025].forEach((xOff) => {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * scale, 0.018 * scale, 0.22 * scale, 6), metalMat)
        barrel.rotation.x = Math.PI / 2
        barrel.position.set(xOff * scale, 0, 0.20 * scale)
        group.add(barrel)
      })

      // Top reflex sight
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04 * scale, 0.06 * scale, 0.08 * scale), glowMat)
      sight.position.set(0, 0.09 * scale, 0.02 * scale)
      group.add(sight)

      // Curved magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05 * scale, 0.14 * scale, 0.08 * scale), darkMat)
      mag.position.set(0, -0.12 * scale, 0.02 * scale)
      group.add(mag)

      const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.035 * scale, 8, 8), glowMat)
      emitter.position.set(0, 0, 0.31 * scale)
      group.add(emitter)
      break
    }

    case 'heavy_cannon': {
      // --- HEAVY ROTARY PLASMA CANNON ---
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.24 * scale, 0.24 * scale, 0.45 * scale), darkMat)
      group.add(housing)

      // Twin heavy barrels
      ;[-0.06, 0.06].forEach((xOff) => {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.045 * scale, 0.55 * scale, 8), metalMat)
        barrel.rotation.x = Math.PI / 2
        barrel.position.set(xOff * scale, 0.04 * scale, 0.40 * scale)
        group.add(barrel)
      })

      // Heavy plasma energy drum
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.14 * scale, 0.18 * scale, 12), metalMat)
      drum.rotation.z = Math.PI / 2
      drum.position.set(0, -0.16 * scale, -0.05 * scale)
      group.add(drum)

      // Heat sink radiator fins
      const heatSink = new THREE.Mesh(new THREE.BoxGeometry(0.26 * scale, 0.08 * scale, 0.25 * scale), glowMat)
      heatSink.position.set(0, 0.14 * scale, 0.05 * scale)
      group.add(heatSink)
      break
    }

    case 'sidearm_blaster':
    case 'energy_pistol': {
      // --- TACTICAL SIDEARM BLASTER ---
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.14 * scale, 0.24 * scale), darkMat)
      group.add(frame)

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * scale, 0.025 * scale, 0.18 * scale, 8), metalMat)
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(0, 0.03 * scale, 0.17 * scale)
      group.add(barrel)

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06 * scale, 0.12 * scale, 0.09 * scale), darkMat)
      grip.position.set(0, -0.12 * scale, -0.05 * scale)
      grip.rotation.x = 0.25
      group.add(grip)

      const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.03 * scale, 8, 8), glowMat)
      emitter.position.set(0, 0.03 * scale, 0.26 * scale)
      group.add(emitter)
      break
    }

    case 'precision_rifle':
    case 'long_range_sniper': {
      // --- LONG-RANGE PRECISION SNIPER RIFLE ---
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.10 * scale, 0.16 * scale, 0.50 * scale), darkMat)
      group.add(receiver)

      // Long fluted precision barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * scale, 0.028 * scale, 0.70 * scale, 8), metalMat)
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(0, 0.02 * scale, 0.55 * scale)
      group.add(barrel)

      // Muzzle compensator / suppressor
      const comp = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.045 * scale, 0.12 * scale, 8), darkMat)
      comp.rotation.x = Math.PI / 2
      comp.position.set(0, 0.02 * scale, 0.92 * scale)
      group.add(comp)

      // Telescopic sniper scope
      const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * scale, 0.035 * scale, 0.24 * scale, 8), darkMat)
      scopeBody.rotation.x = Math.PI / 2
      scopeBody.position.set(0, 0.14 * scale, 0.08 * scale)
      group.add(scopeBody)

      const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.038 * scale, 0.038 * scale, 0.02 * scale, 8), glowMat)
      scopeLens.rotation.x = Math.PI / 2
      scopeLens.position.set(0, 0.14 * scale, 0.20 * scale)
      group.add(scopeLens)

      // Folded tactical bipod
      const bipod = new THREE.Mesh(new THREE.BoxGeometry(0.04 * scale, 0.12 * scale, 0.04 * scale), metalMat)
      bipod.position.set(0, -0.10 * scale, 0.45 * scale)
      group.add(bipod)
      break
    }

    case 'tactical_shotgun': {
      // --- TACTICAL CYBER SHOTGUN ---
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.13 * scale, 0.18 * scale, 0.42 * scale), darkMat)
      group.add(receiver)

      // Wide bore barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.048 * scale, 0.048 * scale, 0.42 * scale, 8), metalMat)
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(0, 0.03 * scale, 0.38 * scale)
      group.add(barrel)

      // Underbarrel tube magazine & pump
      const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.032 * scale, 0.032 * scale, 0.36 * scale, 8), darkMat)
      magTube.rotation.x = Math.PI / 2
      magTube.position.set(0, -0.06 * scale, 0.34 * scale)
      group.add(magTube)

      // Ribbed pump grip
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.12 * scale, 0.16 * scale), metalMat)
      pump.position.set(0, -0.06 * scale, 0.30 * scale)
      group.add(pump)
      break
    }

    case 'heavy_energy_rifle':
    case 'plasma_cannon': {
      // --- HEAVY ADVANCED ENERGY RIFLE ---
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale, 0.20 * scale, 0.52 * scale), darkMat)
      group.add(body)

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.045 * scale, 0.42 * scale, 8), metalMat)
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(0, 0.02 * scale, 0.42 * scale)
      group.add(barrel)

      // Dual battery clips
      ;[-0.09, 0.09].forEach((xOff) => {
        const bat = new THREE.Mesh(new THREE.BoxGeometry(0.05 * scale, 0.14 * scale, 0.15 * scale), glowMat)
        bat.position.set(xOff * scale, -0.04 * scale, -0.05 * scale)
        group.add(bat)
      })

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09 * scale, 0.16 * scale, 0.24 * scale), metalMat)
      stock.position.set(0, -0.02 * scale, -0.34 * scale)
      group.add(stock)
      break
    }

    case 'assault_rifle':
    case 'cyber_assault_rifle':
    case 'threat_blaster':
    default: {
      // --- STANDARD CYBER ASSAULT RIFLE ---
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.11 * scale, 0.17 * scale, 0.48 * scale), darkMat)
      group.add(receiver)

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032 * scale, 0.032 * scale, 0.38 * scale, 8), metalMat)
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(0, 0.02 * scale, 0.38 * scale)
      group.add(barrel)

      // 3 glowing induction coils
      ;[0.26, 0.34, 0.42].forEach((zPos) => {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.048 * scale, 0.014 * scale, 6, 12), glowMat)
        coil.position.set(0, 0.02 * scale, zPos * scale)
        group.add(coil)
      })

      // Tactical underbarrel foregrip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06 * scale, 0.12 * scale, 0.06 * scale), darkMat)
      grip.position.set(0, -0.14 * scale, 0.22 * scale)
      group.add(grip)

      // Curved magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06 * scale, 0.16 * scale, 0.10 * scale), darkMat)
      mag.position.set(0, -0.14 * scale, 0.04 * scale)
      mag.rotation.x = 0.2
      group.add(mag)

      // Shoulder stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.14 * scale, 0.22 * scale), metalMat)
      stock.position.set(0, -0.02 * scale, -0.32 * scale)
      group.add(stock)

      // Muzzle emitter
      const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * scale, 0.042 * scale, 0.08 * scale, 8), glowMat)
      emitter.rotation.x = Math.PI / 2
      emitter.position.set(0, 0.02 * scale, 0.54 * scale)
      group.add(emitter)
      break
    }
  }

  return group
}

/**
 * Updates or swaps the visible weapon mesh held in character's hand
 */
export function updateCharacterWeapon(charGroup, weaponType = 'cyber_assault_rifle') {
  if (!charGroup || !charGroup.userData || !charGroup.userData.parts) return
  const rightArm = charGroup.userData.parts.rightArm
  if (!rightArm) return

  const scale = charGroup.userData.spec?.scale || 1.0
  const isDefender = charGroup.userData.spec?.faction === 'defenders'

  // Remove existing weapon group if present
  const oldWeapon = rightArm.getObjectByName('weapon')
  if (oldWeapon) {
    rightArm.remove(oldWeapon)
  }

  const newWeapon = buildWeaponModel(weaponType, isDefender, scale)
  newWeapon.name = `weapon_${weaponType}`
  newWeapon.position.set(0, -0.48 * scale, 0.18 * scale)
  rightArm.add(newWeapon)
  charGroup.userData.parts.weapon = newWeapon
  charGroup.userData.parts.weaponMesh = newWeapon
  charGroup.userData.equippedWeaponType = weaponType
}

/**
 * Builds the complete military 3D character mesh hierarchy
 */
export function buildCharacterMesh(classId = 'cyber_guard_recruit') {
  const spec = CHARACTER_CLASSES[classId] || CHARACTER_CLASSES.cyber_guard_recruit
  const group = new THREE.Group()
  group.name = `char_${classId}`

  const role = spec.role || (
    classId.includes('scout') ? 'scout' :
    classId.includes('assault') || classId === 'malware_unit' ? 'assault' :
    classId.includes('heavy') ? 'heavy' :
    classId.includes('drone') ? 'drone_operator' :
    spec.faction === 'defenders' ? 'defender' :
    spec.faction === 'boss' ? 'boss' : 'assault'
  )

  const isDefender = spec.faction === 'defenders'
  const isBoss = spec.faction === 'boss'
  const scale = spec.scale || 1.0

  // Palette Materials
  const primaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.color),
    roughness: 0.35,
    metalness: 0.75,
  })

  const fatigueMat = new THREE.MeshStandardMaterial({
    color: isDefender ? 0x1d4ed8 : 0x27272a, // High-visibility royal blue for Guards, dark charcoal camo for Hostiles
    roughness: 0.8,
    metalness: 0.2,
  })

  const vestMat = new THREE.MeshStandardMaterial({
    color: isDefender ? 0x1e293b : 0x991b1b, // Slate tactical vest for Guards, crimson plate carrier for Hostiles
    roughness: 0.6,
    metalness: 0.5,
  })

  const metalMat = new THREE.MeshStandardMaterial({
    color: isDefender ? 0xcbd5e1 : 0x334155,
    roughness: 0.25,
    metalness: 0.85,
  })

  const visorMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(spec.visorColor),
  })

  const glowAccentMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(spec.visorColor),
  })

  const plasmaGlowMat = new THREE.MeshBasicMaterial({
    color: isDefender ? 0x00f0ff : 0xff2200,
  })

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.6,
    metalness: 0.4,
  })

  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.85,
    metalness: 0.15,
  })

  // 1. Root Anchor / Pelvis & Duty Belt
  const pelvis = new THREE.Group()
  pelvis.name = 'pelvis'
  pelvis.position.y = 1.05 * scale
  group.add(pelvis)

  let torsoWidth = 0.55 * scale
  let torsoHeight = 0.65 * scale
  let torsoDepth = 0.35 * scale

  if (role === 'scout') {
    torsoWidth = 0.44 * scale
    torsoHeight = 0.60 * scale
    torsoDepth = 0.28 * scale
  } else if (role === 'assault') {
    torsoWidth = 0.56 * scale
    torsoHeight = 0.65 * scale
    torsoDepth = 0.35 * scale
  } else if (role === 'heavy') {
    torsoWidth = 0.82 * scale
    torsoHeight = 0.72 * scale
    torsoDepth = 0.48 * scale
  } else if (role === 'drone_operator') {
    torsoWidth = 0.52 * scale
    torsoHeight = 0.64 * scale
    torsoDepth = 0.32 * scale
  } else if (isBoss) {
    torsoWidth = 0.88 * scale
    torsoHeight = 0.80 * scale
    torsoDepth = 0.50 * scale
  }

  // Armored Groin / Pelvis Core
  const pelvisGeom = new THREE.BoxGeometry(torsoWidth * 0.88, 0.24 * scale, torsoDepth * 0.88)
  const pelvisMesh = new THREE.Mesh(pelvisGeom, fatigueMat)
  pelvis.add(pelvisMesh)

  // Tactical Military Duty Belt with Metal Buckle
  const beltGeom = new THREE.BoxGeometry(torsoWidth * 1.05, 0.10 * scale, torsoDepth * 1.08)
  const beltMesh = new THREE.Mesh(beltGeom, darkMat)
  beltMesh.position.y = 0.08 * scale
  pelvis.add(beltMesh)

  const buckleGeom = new THREE.BoxGeometry(0.14 * scale, 0.09 * scale, 0.03 * scale)
  const buckleMesh = new THREE.Mesh(buckleGeom, metalMat)
  buckleMesh.position.set(0, 0.08 * scale, (torsoDepth * 1.08 / 2) + 0.01 * scale)
  pelvis.add(buckleMesh)

  // Sidearm Pistol Holster on Right Hip
  const holsterGeom = new THREE.BoxGeometry(0.10 * scale, 0.18 * scale, 0.12 * scale)
  const holster = new THREE.Mesh(holsterGeom, darkMat)
  holster.position.set((torsoWidth / 2) + 0.04 * scale, -0.05 * scale, 0)
  pelvis.add(holster)

  // Ammo Pouches on Left Hip
  ;[-0.04, 0.04].forEach((zOff) => {
    const pouchGeom = new THREE.BoxGeometry(0.08 * scale, 0.12 * scale, 0.08 * scale)
    const pouch = new THREE.Mesh(pouchGeom, vestMat)
    pouch.position.set(-((torsoWidth / 2) + 0.04 * scale), 0.02 * scale, zOff * scale)
    pelvis.add(pouch)
  })

  // 2. Torso, Tactical Plate Carrier Vest & Insignia
  const torso = new THREE.Group()
  torso.name = 'torso'
  pelvis.add(torso)

  // Base Combat Uniform Tunic
  const chestGeom = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth)
  const chestMesh = new THREE.Mesh(chestGeom, fatigueMat)
  chestMesh.position.y = (torsoHeight / 2)
  torso.add(chestMesh)

  // Layered Ballistic Plate Carrier Vest
  const vestGeom = new THREE.BoxGeometry(torsoWidth * 1.02, torsoHeight * 0.85, torsoDepth * 1.12)
  const vestMesh = new THREE.Mesh(vestGeom, primaryMat)
  vestMesh.position.y = (torsoHeight / 2) + 0.02 * scale
  torso.add(vestMesh)

  // 3 Tactical Front Chest MOLLE Magazine Pouches
  ;[-0.14, 0, 0.14].forEach((xOffset) => {
    const pouchGeom = new THREE.BoxGeometry(0.09 * scale, 0.16 * scale, 0.06 * scale)
    const pouch = new THREE.Mesh(pouchGeom, vestMat)
    pouch.position.set(xOffset * scale, 0.30 * scale, (torsoDepth * 1.12 / 2) + 0.03 * scale)
    torso.add(pouch)
  })

  // Raised Faction Insignia Emblem (Ethiopian Shield for Defenders, Cyber Skull for Attackers)
  const emblemWidth = role === 'heavy' ? 0.35 * scale : 0.24 * scale
  const emblemGeom = new THREE.BoxGeometry(emblemWidth, 0.20 * scale, 0.04 * scale)
  const emblemMesh = new THREE.Mesh(emblemGeom, glowAccentMat)
  emblemMesh.position.set(0, 0.50 * scale, (torsoDepth * 1.12 / 2) + 0.02 * scale)
  torso.add(emblemMesh)

  // Tactical Shoulder Pauldrons
  const pWidth = role === 'heavy' ? 0.32 * scale : (role === 'scout' ? 0.18 * scale : 0.22 * scale)
  const pHeight = role === 'heavy' ? 0.24 * scale : 0.16 * scale
  const pDepth = role === 'heavy' ? 0.32 * scale : 0.22 * scale

  // Left pauldron
  const leftPauldron = new THREE.Mesh(new THREE.BoxGeometry(pWidth, pHeight, pDepth), metalMat)
  leftPauldron.position.set(-((torsoWidth / 2) + pWidth * 0.45), torsoHeight * 0.88, 0)
  torso.add(leftPauldron)

  // Right pauldron
  const rightPauldron = new THREE.Mesh(new THREE.BoxGeometry(pWidth, pHeight, pDepth), metalMat)
  rightPauldron.position.set(((torsoWidth / 2) + pWidth * 0.45), torsoHeight * 0.88, 0)
  torso.add(rightPauldron)

  // Backpack Equipment
  if (role === 'drone_operator') {
    // Comms Transceiver Backpack with dual tall telemetry antenna masts
    const packGeom = new THREE.BoxGeometry(0.42 * scale, 0.48 * scale, 0.24 * scale)
    const packMesh = new THREE.Mesh(packGeom, darkMat)
    packMesh.position.set(0, 0.35 * scale, -((torsoDepth / 2) + 0.12 * scale))
    torso.add(packMesh)

    // Left antenna mast
    const antGeom = new THREE.CylinderGeometry(0.015 * scale, 0.02 * scale, 0.65 * scale, 6)
    const antLeft = new THREE.Mesh(antGeom, metalMat)
    antLeft.position.set(-0.14 * scale, 0.65 * scale, -((torsoDepth / 2) + 0.18 * scale))
    torso.add(antLeft)

    const beaconGeom = new THREE.SphereGeometry(0.04 * scale, 8, 8)
    const beaconLeft = new THREE.Mesh(beaconGeom, plasmaGlowMat)
    beaconLeft.position.set(-0.14 * scale, 0.98 * scale, -((torsoDepth / 2) + 0.18 * scale))
    torso.add(beaconLeft)

    // Right antenna mast
    const antRight = new THREE.Mesh(antGeom, metalMat)
    antRight.position.set(0.14 * scale, 0.65 * scale, -((torsoDepth / 2) + 0.18 * scale))
    torso.add(antRight)

    const beaconRight = new THREE.Mesh(beaconGeom, plasmaGlowMat)
    beaconRight.position.set(0.14 * scale, 0.98 * scale, -((torsoDepth / 2) + 0.18 * scale))
    torso.add(beaconRight)
  } else {
    // Standard tactical power cell / field pack
    const packWidth = role === 'heavy' ? 0.55 * scale : 0.40 * scale
    const packGeom = new THREE.BoxGeometry(packWidth, 0.50 * scale, 0.20 * scale)
    const packMesh = new THREE.Mesh(packGeom, darkMat)
    packMesh.position.set(0, 0.35 * scale, -((torsoDepth / 2) + 0.10 * scale))
    torso.add(packMesh)
  }

  // 3. Head, Balaclava, Military Helmet & Visor
  const headGroup = new THREE.Group()
  headGroup.name = 'head'
  headGroup.position.y = (torsoHeight + 0.15 * scale)
  torso.add(headGroup)

  // Balaclava neck cowl
  const neckGeom = new THREE.CylinderGeometry(0.14 * scale, 0.16 * scale, 0.14 * scale, 8)
  const neckMesh = new THREE.Mesh(neckGeom, fatigueMat)
  neckMesh.position.y = -0.06 * scale
  headGroup.add(neckMesh)

  const headSize = role === 'heavy' ? 0.42 * scale : 0.36 * scale
  const helmetGeom = new THREE.BoxGeometry(headSize, headSize, headSize)
  const helmetMesh = new THREE.Mesh(helmetGeom, darkMat)
  headGroup.add(helmetMesh)

  // Helmet Brow Rim & Ear Protection
  const browGeom = new THREE.BoxGeometry(headSize * 1.05, 0.08 * scale, headSize * 1.06)
  const browMesh = new THREE.Mesh(browGeom, metalMat)
  browMesh.position.set(0, 0.10 * scale, 0.02 * scale)
  headGroup.add(browMesh)

  // Tactical Communications Headset Earcups
  ;[-1, 1].forEach((dir) => {
    const earcupGeom = new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.04 * scale, 8)
    const earcup = new THREE.Mesh(earcupGeom, metalMat)
    earcup.rotation.z = Math.PI / 2
    earcup.position.set(dir * (headSize / 2 + 0.02 * scale), 0, 0)
    headGroup.add(earcup)
  })

  // Tactical Visor / Optics tailored to role
  if (role === 'scout') {
    // Narrow horizontal red multi-spectral scanner slit
    const visorGeom = new THREE.BoxGeometry(0.32 * scale, 0.08 * scale, 0.08 * scale)
    const visorMesh = new THREE.Mesh(visorGeom, visorMat)
    visorMesh.position.set(0, 0.04 * scale, (headSize / 2) + 0.01 * scale)
    headGroup.add(visorMesh)
  } else if (role === 'heavy') {
    // Heavy blast visor slit behind reinforced brow
    const visorGeom = new THREE.BoxGeometry(0.36 * scale, 0.10 * scale, 0.08 * scale)
    const visorMesh = new THREE.Mesh(visorGeom, visorMat)
    visorMesh.position.set(0, 0.02 * scale, (headSize / 2) + 0.01 * scale)
    headGroup.add(visorMesh)
  } else if (role === 'precision') {
    // Asymmetric monocular sniper optic with crosshair lens
    const visorGeom = new THREE.BoxGeometry(0.18 * scale, 0.14 * scale, 0.10 * scale)
    const visorMesh = new THREE.Mesh(visorGeom, visorMat)
    visorMesh.position.set(0.08 * scale, 0.04 * scale, (headSize / 2) + 0.02 * scale)
    headGroup.add(visorMesh)
  } else {
    // Full-Face Tactical Hexagonal Visor
    const visorGeom = new THREE.BoxGeometry(0.32 * scale, 0.14 * scale, 0.08 * scale)
    const visorMesh = new THREE.Mesh(visorGeom, visorMat)
    visorMesh.position.set(0, 0.04 * scale, (headSize / 2) + 0.01 * scale)
    headGroup.add(visorMesh)
  }

  // 4. Left Arm (Support Hand & Shield Projector)
  const leftArm = new THREE.Group()
  leftArm.name = 'leftArm'
  const armXOffset = -((torsoWidth / 2) + 0.12 * scale)
  leftArm.position.set(armXOffset, torsoHeight * 0.85, 0)
  torso.add(leftArm)

  const armThickness = role === 'heavy' ? 0.24 * scale : 0.18 * scale

  // Upper arm sleeve
  const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(armThickness, 0.28 * scale, armThickness), fatigueMat)
  leftUpperArm.position.y = -0.14 * scale
  leftArm.add(leftUpperArm)

  // Elbow protector pad
  const leftElbowPad = new THREE.Mesh(new THREE.BoxGeometry(armThickness * 1.1, 0.10 * scale, armThickness * 1.1), metalMat)
  leftElbowPad.position.y = -0.28 * scale
  leftArm.add(leftElbowPad)

  // Forearm vambrace
  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(armThickness * 0.95, 0.24 * scale, armThickness * 0.95), primaryMat)
  leftForearm.position.y = -0.42 * scale
  leftArm.add(leftForearm)

  // Tactical combat glove & hand
  const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(armThickness * 0.85, 0.12 * scale, armThickness * 0.85), darkMat)
  leftGlove.position.y = -0.56 * scale
  leftArm.add(leftGlove)

  // Shield projector node on left forearm
  const shieldNode = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.10 * scale, 8), glowAccentMat)
  shieldNode.rotation.z = Math.PI / 2
  shieldNode.position.set(-0.10 * scale, -0.42 * scale, 0)
  leftArm.add(shieldNode)

  // Holographic Hexagonal Forcefield Shield
  const hexShield = new THREE.Mesh(
    new THREE.CircleGeometry(0.55 * scale, 6),
    new THREE.MeshBasicMaterial({ color: isDefender ? 0x00bbff : 0xff3300, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
  )
  hexShield.rotation.y = Math.PI / 2
  hexShield.position.set(-0.25 * scale, -0.42 * scale, 0.15 * scale)
  hexShield.visible = false
  leftArm.add(hexShield)

  const shieldWire = new THREE.Mesh(
    new THREE.RingGeometry(0.52 * scale, 0.56 * scale, 6),
    new THREE.MeshBasicMaterial({ color: isDefender ? 0x38bdf8 : 0xff5533, side: THREE.DoubleSide })
  )
  shieldWire.rotation.y = Math.PI / 2
  shieldWire.position.set(-0.26 * scale, -0.42 * scale, 0.15 * scale)
  shieldWire.visible = false
  leftArm.add(shieldWire)

  // Drone Operator Forearm Holo-Controller / Cyber-deck
  if (role === 'drone_operator') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.20 * scale, 0.10 * scale), darkMat)
    deck.position.set(-0.08 * scale, -0.38 * scale, 0.08 * scale)
    leftArm.add(deck)

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22 * scale, 0.16 * scale),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    )
    screen.position.set(-0.12 * scale, -0.34 * scale, 0.16 * scale)
    screen.rotation.y = 0.4
    leftArm.add(screen)
  }

  // 5. Right Arm (Weapon Arm & Trigger Hand)
  const rightArm = new THREE.Group()
  rightArm.name = 'rightArm'
  rightArm.position.set(-armXOffset, torsoHeight * 0.85, 0)
  torso.add(rightArm)

  // Upper arm sleeve
  const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(armThickness, 0.28 * scale, armThickness), fatigueMat)
  rightUpperArm.position.y = -0.14 * scale
  rightArm.add(rightUpperArm)

  // Elbow protector pad
  const rightElbowPad = new THREE.Mesh(new THREE.BoxGeometry(armThickness * 1.1, 0.10 * scale, armThickness * 1.1), metalMat)
  rightElbowPad.position.y = -0.28 * scale
  rightArm.add(rightElbowPad)

  // Forearm vambrace
  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(armThickness * 0.95, 0.24 * scale, armThickness * 0.95), primaryMat)
  rightForearm.position.y = -0.42 * scale
  rightArm.add(rightForearm)

  // Tactical combat glove & hand
  const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(armThickness * 0.85, 0.12 * scale, armThickness * 0.85), darkMat)
  rightGlove.position.y = -0.56 * scale
  rightArm.add(rightGlove)

  // Modular Hand-Held 3D Weapon Model
  const weaponType = spec.weaponType || (
    role === 'scout' ? 'scout_smg' :
    role === 'heavy' ? 'heavy_cannon' :
    role === 'drone_operator' ? 'sidearm_blaster' :
    role === 'precision' ? 'precision_rifle' :
    isDefender ? 'cyber_assault_rifle' : 'assault_rifle'
  )

  const weaponGroup = buildWeaponModel(weaponType, isDefender, scale)
  weaponGroup.name = 'weapon'
  weaponGroup.position.set(0, -0.48 * scale, 0.18 * scale)
  rightArm.add(weaponGroup)

  // 6. Left Leg (Thigh, Knee Pad, Shin Greave & Combat Boot)
  const legThickness = role === 'heavy' ? 0.28 * scale : 0.20 * scale

  const leftLeg = new THREE.Group()
  leftLeg.name = 'leftLeg'
  leftLeg.position.set(-((torsoWidth / 4) + 0.04 * scale), 0, 0)
  pelvis.add(leftLeg)

  // Upper thigh with tactical trousers
  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(legThickness, 0.40 * scale, legThickness), fatigueMat)
  leftThigh.position.y = -0.20 * scale
  leftLeg.add(leftThigh)

  // Molded Knee Protector Pad
  const leftKnee = new THREE.Mesh(new THREE.BoxGeometry(legThickness * 1.12, 0.12 * scale, legThickness * 1.15), metalMat)
  leftKnee.position.set(0, -0.42 * scale, 0.02 * scale)
  leftLeg.add(leftKnee)

  // Shin Greave with armor plate
  const leftShin = new THREE.Mesh(new THREE.BoxGeometry(legThickness * 0.95, 0.32 * scale, legThickness * 0.95), primaryMat)
  leftShin.position.y = -0.62 * scale
  leftLeg.add(leftShin)

  // Tactical Combat Boot with Thick Sole Tread & Toe Cap
  const leftBootGroup = new THREE.Group()
  leftBootGroup.position.set(0, -0.80 * scale, 0.04 * scale)
  leftLeg.add(leftBootGroup)

  const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(legThickness * 1.05, 0.16 * scale, legThickness * 1.25), bootMat)
  leftBootGroup.add(bootUpper)

  const bootSole = new THREE.Mesh(new THREE.BoxGeometry(legThickness * 1.15, 0.05 * scale, legThickness * 1.35), darkMat)
  bootSole.position.y = -0.09 * scale
  leftBootGroup.add(bootSole)

  // 7. Right Leg (Thigh, Knee Pad, Shin Greave, Holster & Combat Boot)
  const rightLeg = new THREE.Group()
  rightLeg.name = 'rightLeg'
  rightLeg.position.set(((torsoWidth / 4) + 0.04 * scale), 0, 0)
  pelvis.add(rightLeg)

  const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(legThickness, 0.40 * scale, legThickness), fatigueMat)
  rightThigh.position.y = -0.20 * scale
  rightLeg.add(rightThigh)

  // Drop-leg armored strap on right thigh
  const dropStrap = new THREE.Mesh(new THREE.BoxGeometry(legThickness * 1.08, 0.06 * scale, legThickness * 1.08), darkMat)
  dropStrap.position.y = -0.18 * scale
  rightLeg.add(dropStrap)

  const rightKnee = new THREE.Mesh(new THREE.BoxGeometry(legThickness * 1.12, 0.12 * scale, legThickness * 1.15), metalMat)
  rightKnee.position.set(0, -0.42 * scale, 0.02 * scale)
  rightLeg.add(rightKnee)

  const rightShin = new THREE.Mesh(new THREE.BoxGeometry(legThickness * 0.95, 0.32 * scale, legThickness * 0.95), primaryMat)
  rightShin.position.y = -0.62 * scale
  rightLeg.add(rightShin)

  const rightBootGroup = new THREE.Group()
  rightBootGroup.position.set(0, -0.80 * scale, 0.04 * scale)
  rightLeg.add(rightBootGroup)

  const rBootUpper = new THREE.Mesh(new THREE.BoxGeometry(legThickness * 1.05, 0.16 * scale, legThickness * 1.25), bootMat)
  rightBootGroup.add(rBootUpper)

  const rBootSole = new THREE.Mesh(new THREE.BoxGeometry(legThickness * 1.15, 0.05 * scale, legThickness * 1.35), darkMat)
  rBootSole.position.y = -0.09 * scale
  rightBootGroup.add(rBootSole)

  // Ground Team Ring (tactical circle under feet on road for instant faction recognition)
  const ringColor = isDefender ? 0x00f0ff : (isBoss ? 0xff0055 : 0xef4444)
  const ringGeom = new THREE.RingGeometry(0.65 * scale, 0.82 * scale, 24)
  const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  const groundRing = new THREE.Mesh(ringGeom, ringMat)
  groundRing.rotation.x = Math.PI / 2
  groundRing.position.set(0, 0.04, 0)
  group.add(groundRing)

  // 8. Overhead Faction Marker, Mini-Health Bar & State Badge
  const markerGroup = new THREE.Group()
  markerGroup.name = 'overheadMarker'
  markerGroup.position.set(0, 2.35 * scale, 0)
  group.add(markerGroup)

  const markerColor = isDefender ? 0x00f0ff : (isBoss ? 0xff0055 : 0xef4444)

  const markerGeom = new THREE.ConeGeometry(0.18 * scale, 0.30 * scale, 4)
  const markerMesh = new THREE.Mesh(markerGeom, new THREE.MeshBasicMaterial({ color: markerColor }))
  markerMesh.rotation.x = Math.PI
  markerGroup.add(markerMesh)

  const gemGeom = new THREE.OctahedronGeometry(0.09 * scale, 0)
  const gemMesh = new THREE.Mesh(gemGeom, new THREE.MeshBasicMaterial({ color: markerColor }))
  gemMesh.position.y = 0.24 * scale
  markerGroup.add(gemMesh)

  const hpBackMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.60 * scale, 0.08 * scale),
    new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide })
  )
  hpBackMesh.position.set(0, 0.20 * scale, 0)
  markerGroup.add(hpBackMesh)

  const hpBarMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58 * scale, 0.06 * scale),
    new THREE.MeshBasicMaterial({ color: markerColor, side: THREE.DoubleSide })
  )
  hpBarMesh.position.set(0, 0.20 * scale, 0.005)
  markerGroup.add(hpBarMesh)

  const defaultStateKey = isDefender ? 'CYBER_GUARD' : 'PATROL'
  const initTex = getOrCreateStateTexture(defaultStateKey, isDefender)
  const stateBadgeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25 * scale, 0.28 * scale),
    new THREE.MeshBasicMaterial({ map: initTex, transparent: true, side: THREE.DoubleSide })
  )
  stateBadgeMesh.position.set(0, 0.44 * scale, 0)
  stateBadgeMesh.userData = { currentState: defaultStateKey }
  markerGroup.add(stateBadgeMesh)

  group.userData = {
    classId,
    role,
    spec,
    isDefender,
    isBoss,
    equippedWeaponType: weaponType,
    parts: {
      pelvis,
      torso,
      head: headGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      weapon: weaponGroup,
      weaponMesh: weaponGroup,
      hexShield,
      shieldWire,
      overheadMarker: markerGroup,
      hpBarMesh,
      markerMesh,
      stateBadgeMesh,
    },
    animState: 'idle',
    animTimer: 0,
  }

  return group
}

/**
 * Procedural Skeletal Animation Evaluator
 * Blends joint angles based on state:
 * - idle, walk, run, sprint, jump, block
 * - patrol: relaxed stride with weapon low-ready
 * - alert: freeze in place, head high, weapon ready
 * - aim: two-handed stabilized aiming platform
 * - attack: firing recoil impulse
 * - cover: crouched defensive tuck behind obstacle
 * - kneeling_fire: kneeling posture aiming over barricade
 * - reload / reloading: weapon tilted up, hand to pouch
 * - strafe_left, strafe_right: lateral strafing steps
 * - hit / stagger: recoiling back from impact
 * - retreat: high-frequency sprint away
 * - defeat: flat collapse on ground
 */
export function updateCharacterAnimation(charGroup, animState = 'idle', dtSeconds = 0.016, speed = 0) {
  if (!charGroup || !charGroup.userData || !charGroup.userData.parts) return

  charGroup.userData.animState = animState
  const parts = charGroup.userData.parts
  const scale = charGroup.userData.spec?.scale || 1.0
  charGroup.userData.animTimer = (charGroup.userData.animTimer || 0) + dtSeconds
  const t = charGroup.userData.animTimer

  // Neutral resets
  parts.pelvis.position.y = 1.05 * scale
  parts.torso.rotation.set(0, 0, 0)
  parts.head.rotation.set(0, 0, 0)

  // Toggle holographic energy shield visibility
  if (parts.hexShield) {
    parts.hexShield.visible = animState === 'block'
    if (parts.shieldWire) parts.shieldWire.visible = animState === 'block'
  }

  if (parts.markerMesh) {
    parts.markerMesh.rotation.y += dtSeconds * 2.4
  }

  switch (animState) {
    case 'idle': {
      const breath = Math.sin(t * 2.5) * 0.03
      parts.torso.position.y = breath
      parts.head.rotation.x = breath * 0.5
      parts.leftArm.rotation.set(-0.35 + breath, 0.2, 0.1) // Left hand near foregrip
      parts.rightArm.rotation.set(-0.45 + breath, 0, -0.08) // Right hand on pistol grip, low-ready
      parts.leftLeg.rotation.set(0, 0, -0.05)
      parts.rightLeg.rotation.set(0, 0, 0.05)
      break
    }

    case 'patrol': {
      const freq = 5.0
      const legAmp = 0.35
      const legCycle = Math.sin(t * freq)
      parts.leftLeg.rotation.x = legCycle * legAmp
      parts.rightLeg.rotation.x = -legCycle * legAmp
      parts.leftArm.rotation.set(-0.35, 0.15, 0.08)
      parts.rightArm.rotation.set(-0.45, 0, -0.08) // low-ready patrol
      parts.pelvis.position.y += Math.abs(Math.sin(t * freq)) * 0.05
      parts.torso.rotation.y = legCycle * 0.05
      break
    }

    case 'alert': {
      parts.torso.rotation.set(0.04, 0, 0)
      parts.head.rotation.set(-0.15, 0, 0)
      parts.leftArm.rotation.set(-0.6, 0.3, 0.15)
      parts.rightArm.rotation.set(-0.85, 0, -0.1)
      parts.leftLeg.rotation.set(0.1, 0, -0.1)
      parts.rightLeg.rotation.set(-0.1, 0, 0.1)
      break
    }

    case 'aim': {
      // Two-handed deliberate aiming stance, weapon raised forward
      parts.rightArm.rotation.set(-1.45, 0, -0.05)
      parts.leftArm.rotation.set(-1.20, 0.45, 0.15)
      parts.torso.rotation.set(0.05, 0.12, 0)
      parts.head.rotation.set(0, -0.12, 0)
      parts.leftLeg.rotation.set(0.15, 0, -0.1)
      parts.rightLeg.rotation.set(-0.15, 0, 0.1)
      break
    }

    case 'attack': {
      // Aim and fire recoil impulse
      const kick = Math.sin(t * 28.0) * 0.08
      parts.rightArm.rotation.set(-1.58 + kick, 0, 0)
      parts.leftArm.rotation.set(-1.22 + kick * 0.5, 0.45, 0.15)
      parts.torso.rotation.set(-kick * 0.4, 0.12, 0)
      parts.head.rotation.set(0, -0.12, 0)
      break
    }

    case 'reload':
    case 'reloading': {
      // Weapon tilted up, left hand moves to belt ammo pouch
      const reloadPhase = (t * 2.5) % 2.0
      parts.rightArm.rotation.set(-0.95, -0.1, 0.1) // weapon raised at 35 degrees
      if (reloadPhase < 1.0) {
        // Reaching down to pouch
        parts.leftArm.rotation.set(0.1, 0.2, 0.1)
      } else {
        // Inserting magazine into weapon receiver
        parts.leftArm.rotation.set(-0.85, 0.35, 0.1)
      }
      parts.torso.rotation.set(0.05, 0.08, 0)
      break
    }

    case 'cover': {
      // Crouched defensive tuck behind obstacle
      parts.pelvis.position.y = 0.62 * scale
      parts.torso.rotation.set(0.32, 0, 0)
      parts.head.rotation.set(-0.25, 0, 0)
      parts.leftArm.rotation.set(-1.15, 0.4, 0.2)
      parts.rightArm.rotation.set(-0.55, -0.2, -0.1)
      parts.leftLeg.rotation.set(0.70, 0, -0.15)
      parts.rightLeg.rotation.set(-0.60, 0, 0.15)
      break
    }

    case 'kneeling_fire': {
      // Kneeling over cover, aiming and firing forward
      parts.pelvis.position.y = 0.65 * scale
      parts.leftLeg.rotation.set(0.75, 0, -0.1)
      parts.rightLeg.rotation.set(-0.65, 0, 0.1)
      parts.torso.rotation.set(0.04, 0.10, 0)
      parts.rightArm.rotation.set(-1.42, 0, -0.05)
      parts.leftArm.rotation.set(-1.18, 0.42, 0.15)
      parts.head.rotation.set(0, -0.10, 0)
      break
    }

    case 'walk':
    case 'run': {
      const freq = animState === 'run' ? 10.0 : 6.0
      const legAmp = animState === 'run' ? 0.75 : 0.45
      const armAmp = animState === 'run' ? 0.65 : 0.4

      const legCycle = Math.sin(t * freq)
      parts.leftLeg.rotation.x = legCycle * legAmp
      parts.rightLeg.rotation.x = -legCycle * legAmp

      parts.leftArm.rotation.x = -legCycle * armAmp * 0.6 - 0.2
      parts.rightArm.rotation.x = legCycle * armAmp * 0.4 - 0.4 // weapon stays forward

      parts.pelvis.position.y += Math.abs(Math.sin(t * freq)) * 0.08
      parts.torso.rotation.y = legCycle * 0.08
      parts.torso.rotation.x = 0.08
      break
    }

    case 'strafe_left':
    case 'strafe_right': {
      const dir = animState === 'strafe_left' ? -1 : 1
      const freq = 7.0
      const legCycle = Math.sin(t * freq)
      parts.leftLeg.rotation.z = legCycle * 0.35 * dir
      parts.rightLeg.rotation.z = -legCycle * 0.35 * dir
      parts.rightArm.rotation.set(-1.35, 0, -0.05)
      parts.leftArm.rotation.set(-1.10, 0.4, 0.15)
      parts.torso.rotation.y = -0.2 * dir
      break
    }

    case 'sprint':
    case 'retreat': {
      const freq = animState === 'retreat' ? 13.5 : 13.0
      const legCycle = Math.sin(t * freq)
      parts.leftLeg.rotation.x = legCycle * 0.95
      parts.rightLeg.rotation.x = -legCycle * 0.95

      parts.leftArm.rotation.x = -legCycle * 0.8
      parts.rightArm.rotation.x = legCycle * 0.4 - 0.35

      parts.pelvis.position.y += Math.abs(Math.sin(t * freq)) * 0.12
      parts.torso.rotation.x = 0.24
      parts.torso.rotation.y = legCycle * 0.12
      break
    }

    case 'jump': {
      parts.leftLeg.rotation.set(-0.4, 0, -0.1)
      parts.rightLeg.rotation.set(0.3, 0, 0.1)
      parts.leftArm.rotation.set(-0.6, 0, 0.25)
      parts.rightArm.rotation.set(-0.8, 0, -0.2)
      parts.torso.rotation.x = 0.1
      break
    }

    case 'block': {
      parts.leftArm.rotation.set(-1.3, 0.6, 0.4)
      parts.rightArm.rotation.set(-0.4, 0, -0.2)
      parts.torso.rotation.set(0.05, -0.2, 0)
      parts.leftLeg.rotation.set(0.2, 0, -0.15)
      parts.rightLeg.rotation.set(-0.25, 0, 0.15)
      break
    }

    case 'hit':
    case 'stagger': {
      parts.torso.rotation.set(-0.38, 0, 0.1)
      parts.head.rotation.set(-0.35, 0, 0)
      parts.leftArm.rotation.set(-0.35, 0, 0.5)
      parts.rightArm.rotation.set(-0.5, 0, -0.4)
      break
    }

    case 'defeat': {
      parts.pelvis.position.y = 0.18
      parts.torso.rotation.set(-1.5, 0, 0)
      parts.leftLeg.rotation.set(0, 0, -0.3)
      parts.rightLeg.rotation.set(0, 0, 0.3)
      break
    }
  }
}

/**
 * Builds autonomous flying drone 3D mesh (friendly sentinel or hostile attack drone)
 */
export function buildDroneMesh(isEnemy = false) {
  const group = new THREE.Group()
  group.name = isEnemy ? 'drone_hostile' : 'drone_friendly'

  const darkMat = new THREE.MeshStandardMaterial({
    color: isEnemy ? 0x18181b : 0x0f172a,
    roughness: 0.5,
    metalness: 0.8,
  })

  const factionMat = new THREE.MeshStandardMaterial({
    color: isEnemy ? 0x881337 : 0x1d4ed8,
    roughness: 0.4,
    metalness: 0.65,
  })

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.4,
  })

  const glowColor = isEnemy ? 0xef4444 : 0x00f0ff
  const glowMat = new THREE.MeshBasicMaterial({ color: glowColor })

  if (isEnemy) {
    // === HOSTILE STRIKE DRONE (Angular Predatory Arrowhead Design) ===
    // Central angular chassis
    const chassisGeom = new THREE.ConeGeometry(0.42, 0.85, 4)
    const chassis = new THREE.Mesh(chassisGeom, factionMat)
    chassis.rotation.x = Math.PI / 2
    chassis.rotation.y = Math.PI / 4
    group.add(chassis)

    // Crimson reinforced armor cowl
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.50), darkMat)
    cowl.position.set(0, 0.04, -0.05)
    group.add(cowl)

    // Hostile red optics eye
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 10), glowMat)
    eye.position.set(0, 0.02, 0.36)
    group.add(eye)

    // Underslung Twin Heavy Plasma Blaster Barrels
    ;[-0.14, 0.14].forEach((xOff) => {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.40, 8), darkMat)
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(xOff, -0.10, 0.22)
      group.add(barrel)

      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), glowMat)
      muzzle.rotation.x = Math.PI / 2
      muzzle.position.set(xOff, -0.10, 0.42)
      group.add(muzzle)
    })

    // Forward Red Targeting Laser Guide
    const laserSightGeom = new THREE.CylinderGeometry(0.006, 0.006, 12, 4)
    const laserSightMat = new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.55 })
    const laserSight = new THREE.Mesh(laserSightGeom, laserSightMat)
    laserSight.rotation.x = Math.PI / 2
    laserSight.position.set(0, -0.10, 6.4)
    group.add(laserSight)

    // 4 Quad-Rotor Arms & Spinning Crimson Blades
    const rotors = []
    const armOffsets = [
      [-0.45, 0.35],
      [0.45, 0.35],
      [-0.45, -0.35],
      [0.45, -0.35],
    ]
    armOffsets.forEach(([ox, oz]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.30), darkMat)
      arm.position.set(ox * 0.55, 0.02, oz * 0.55)
      arm.rotation.y = Math.atan2(ox, oz)
      group.add(arm)

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), darkMat)
      pod.position.set(ox, 0.06, oz)
      group.add(pod)

      const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.015, 0.04), glowMat)
      rotor.position.set(ox, 0.11, oz)
      group.add(rotor)
      rotors.push(rotor)
    })

    group.userData = { rotors, isEnemy: true, type: 'strike_drone' }
  } else {
    // === FRIENDLY RECON SENTINEL DRONE (Aerodynamic Clean Hexacopter) ===
    // Central streamlined fuselage in royal blue and white
    const bodyGeom = new THREE.BoxGeometry(0.55, 0.16, 0.55)
    const body = new THREE.Mesh(bodyGeom, factionMat)
    group.add(body)

    const topCowl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.10, 0.42), whiteMat)
    topCowl.position.set(0, 0.10, -0.02)
    group.add(topCowl)

    // Downward Spherical Optical Recon Camera Turret
    const turret = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), glowMat)
    turret.position.set(0, -0.10, 0.10)
    group.add(turret)

    // Downward Translucent Cyan Recon Scanning Cone
    const coneGeom = new THREE.ConeGeometry(1.6, 3.2, 16, 1, true)
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
    const scanCone = new THREE.Mesh(coneGeom, coneMat)
    scanCone.rotation.x = Math.PI
    scanCone.position.set(0, -1.7, 0.10)
    group.add(scanCone)

    // Underslung Twin Pulse Blaster Emitters
    ;[-0.12, 0.12].forEach((xOff) => {
      const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), darkMat)
      emitter.rotation.x = Math.PI / 2
      emitter.position.set(xOff, -0.06, 0.28)
      group.add(emitter)

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), glowMat)
      ring.position.set(xOff, -0.06, 0.42)
      group.add(ring)
    })

    // 4 Rotor Arms & Spinning Cyan Rotor Blades
    const rotors = []
    const armOffsets = [
      [-0.42, 0.42],
      [0.42, 0.42],
      [-0.42, -0.42],
      [0.42, -0.42],
    ]
    armOffsets.forEach(([ox, oz]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.32), whiteMat)
      arm.position.set(ox * 0.5, 0.03, oz * 0.5)
      arm.rotation.y = Math.atan2(ox, oz)
      group.add(arm)

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), darkMat)
      pod.position.set(ox, 0.07, oz)
      group.add(pod)

      const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.015, 0.04), glowMat)
      rotor.position.set(ox, 0.12, oz)
      group.add(rotor)
      rotors.push(rotor)
    })

    group.userData = { rotors, isEnemy: false, type: 'recon_sentinel' }
  }

  return group
}

export function buildRecoveryBeaconMesh() {
  const group = new THREE.Group()
  group.name = 'recovery_beacon'

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.85,
  })

  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 })

  // Tripod/octagonal anchor base
  const baseGeom = new THREE.CylinderGeometry(0.65, 0.85, 0.35, 8)
  const base = new THREE.Mesh(baseGeom, metalMat)
  base.position.y = 0.18
  group.add(base)

  // Central transmitter spire
  const spireGeom = new THREE.CylinderGeometry(0.12, 0.18, 1.8, 8)
  const spire = new THREE.Mesh(spireGeom, metalMat)
  spire.position.y = 1.05
  group.add(spire)

  // Emitter crystal / sphere
  const emitterGeom = new THREE.SphereGeometry(0.22, 16, 16)
  const emitter = new THREE.Mesh(emitterGeom, glowMat)
  emitter.position.y = 2.05
  group.add(emitter)

  // Expanding restoration aura ring
  const ringGeom = new THREE.RingGeometry(1.6, 1.85, 32)
  const ring = new THREE.Mesh(
    ringGeom,
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.05
  group.add(ring)

  group.userData = { ring, spire, emitter }
  return group
}
