/**
 * CyberShield Ethiopia — Digital City: Military Weapon & Tactical Equipment System
 *
 * Implements a structured weapon progression system with 10 usable futuristic military weapons,
 * magazine ammo management, reload mechanics, weapon switching, and progression unlock tiers.
 * Also preserves the 8 canonical tactical defense gadgets, weapons, and countermeasures.
 *
 * 100% deterministic (SR-09 compliant: zero Math.random).
 */

export const WEAPON_PROGRESSION_TIERS = {
  early: ['cyber_assault_rifle', 'energy_pistol'],
  intermediate: ['burst_rifle', 'tactical_shotgun', 'precision_rifle'],
  advanced: ['heavy_energy_rifle', 'plasma_cannon', 'long_range_sniper'],
  higher: ['quantum_blaster'],
}

export const WEAPON_REGISTRY = {
  cyber_assault_rifle: {
    id: 'cyber_assault_rifle',
    nameKey: 'digital_city.weapon.assault_rifle.name',
    defaultName: 'Basic Cyber Assault Rifle',
    descKey: 'digital_city.weapon.assault_rifle.desc',
    defaultDesc: 'Standard issue infantry rifle firing rapid coherent plasma pulses.',
    icon: '⚡',
    tier: 'early',
    unlockLevel: 1,
    damage: 28,
    magazineCapacity: 30,
    fireRateMs: 200,
    cooldownMs: 200,
    reloadTimeSec: 1.8,
    range: 120,
    projectileSpeed: 38,
    projectileColor: '#00bbff',
    burstCount: 1,
    spreadAngle: 0,
    isAoE: false,
    soundId: 'laser_fire',
    modelType: 'cyber_assault_rifle',
    representedThreat: 'Rapid neutralization of automated exploit payloads',
  },
  energy_pistol: {
    id: 'energy_pistol',
    nameKey: 'digital_city.weapon.energy_pistol.name',
    defaultName: 'Standard Energy Pistol',
    descKey: 'digital_city.weapon.energy_pistol.desc',
    defaultDesc: 'Compact high-mobility sidearm with ultra-fast reload speed.',
    icon: '🔫',
    tier: 'early',
    unlockLevel: 1,
    damage: 22,
    magazineCapacity: 12,
    fireRateMs: 220,
    cooldownMs: 220,
    reloadTimeSec: 1.2,
    range: 85,
    projectileSpeed: 45,
    projectileColor: '#38bdf8',
    burstCount: 1,
    spreadAngle: 0,
    isAoE: false,
    soundId: 'laser_fire',
    modelType: 'energy_pistol',
    representedThreat: 'Lightweight authentication challenge sidearm',
  },
  burst_rifle: {
    id: 'burst_rifle',
    nameKey: 'digital_city.weapon.burst_rifle.name',
    defaultName: 'Burst Energy Rifle',
    descKey: 'digital_city.weapon.burst_rifle.desc',
    defaultDesc: 'Fires 3 concentrated plasma bolts in rapid succession.',
    icon: '💥',
    tier: 'intermediate',
    unlockLevel: 3,
    damage: 24,
    magazineCapacity: 36, // 12 bursts
    fireRateMs: 400,
    cooldownMs: 400,
    burstCount: 3,
    reloadTimeSec: 2.0,
    range: 135,
    projectileSpeed: 46,
    projectileColor: '#06b6d4',
    spreadAngle: 0.02,
    isAoE: false,
    soundId: 'laser_fire',
    modelType: 'burst_rifle',
    representedThreat: 'Multi-factor authentication burst verification',
  },
  tactical_shotgun: {
    id: 'tactical_shotgun',
    nameKey: 'digital_city.weapon.shotgun.name',
    defaultName: 'Tactical Cyber Shotgun',
    descKey: 'digital_city.weapon.shotgun.desc',
    defaultDesc: 'Discharges 6 spread pellets for heavy close-quarters defense.',
    icon: '🔥',
    tier: 'intermediate',
    unlockLevel: 4,
    damage: 15, // 15 x 6 = 90 potential damage
    magazineCapacity: 8,
    fireRateMs: 650,
    cooldownMs: 650,
    burstCount: 6,
    reloadTimeSec: 2.2,
    range: 48,
    projectileSpeed: 36,
    projectileColor: '#f59e0b',
    spreadAngle: 0.14,
    isAoE: false,
    soundId: 'pulse_blast',
    modelType: 'tactical_shotgun',
    representedThreat: 'Broad-spectrum firewall packet scrubbing',
  },
  precision_rifle: {
    id: 'precision_rifle',
    nameKey: 'digital_city.weapon.precision_rifle.name',
    defaultName: 'Precision Cyber Rifle',
    descKey: 'digital_city.weapon.precision_rifle.desc',
    defaultDesc: 'High-velocity sniper rifle engineered for long-distance perimeter overwatch.',
    icon: '🎯',
    tier: 'intermediate',
    unlockLevel: 5,
    damage: 85,
    magazineCapacity: 5,
    fireRateMs: 900,
    cooldownMs: 900,
    reloadTimeSec: 2.4,
    range: 220,
    projectileSpeed: 65,
    projectileColor: '#a855f7',
    burstCount: 1,
    spreadAngle: 0,
    isAoE: false,
    soundId: 'laser_fire',
    modelType: 'precision_rifle',
    representedThreat: 'Deep packet inspection and signature pinpointing',
  },
  heavy_energy_rifle: {
    id: 'heavy_energy_rifle',
    nameKey: 'digital_city.weapon.heavy_rifle.name',
    defaultName: 'Heavy Energy Rifle',
    descKey: 'digital_city.weapon.heavy_rifle.desc',
    defaultDesc: 'Sustained automatic heavy fire with reinforced battery cells.',
    icon: '⚡',
    tier: 'advanced',
    unlockLevel: 6,
    damage: 48,
    magazineCapacity: 40,
    fireRateMs: 220,
    cooldownMs: 220,
    reloadTimeSec: 2.5,
    range: 150,
    projectileSpeed: 40,
    projectileColor: '#3b82f6',
    burstCount: 1,
    spreadAngle: 0.015,
    isAoE: false,
    soundId: 'laser_fire',
    modelType: 'heavy_energy_rifle',
    representedThreat: 'High-throughput enterprise ingress firewalling',
  },
  plasma_cannon: {
    id: 'plasma_cannon',
    nameKey: 'digital_city.weapon.plasma_cannon.name',
    defaultName: 'Heavy Plasma Cannon',
    descKey: 'digital_city.weapon.plasma_cannon.desc',
    defaultDesc: 'Launches unstable plasma spheres that detonate in a destructive AoE blast.',
    icon: '💣',
    tier: 'advanced',
    unlockLevel: 7,
    damage: 110,
    magazineCapacity: 15,
    fireRateMs: 1100,
    cooldownMs: 1100,
    reloadTimeSec: 3.0,
    range: 100,
    projectileSpeed: 30,
    projectileColor: '#ec4899',
    burstCount: 1,
    spreadAngle: 0,
    isAoE: true,
    aoeRadius: 4.5,
    soundId: 'emp_detonate',
    modelType: 'heavy_cannon',
    representedThreat: 'Air-gapped botnet cluster obliteration',
  },
  long_range_sniper: {
    id: 'long_range_sniper',
    nameKey: 'digital_city.weapon.sniper.name',
    defaultName: 'Long-Range Anti-Materiel Sniper',
    descKey: 'digital_city.weapon.sniper.desc',
    defaultDesc: 'Ultra-heavy penetrator beam that neutralizes fortified armor instantly.',
    icon: '🔭',
    tier: 'advanced',
    unlockLevel: 8,
    damage: 160,
    magazineCapacity: 4,
    fireRateMs: 1400,
    cooldownMs: 1400,
    reloadTimeSec: 2.8,
    range: 280,
    projectileSpeed: 80,
    projectileColor: '#8b5cf6',
    burstCount: 1,
    spreadAngle: 0,
    isAoE: false,
    soundId: 'laser_fire',
    modelType: 'long_range_sniper',
    representedThreat: 'Advanced persistent threat (APT) core elimination',
  },
  quantum_blaster: {
    id: 'quantum_blaster',
    nameKey: 'digital_city.weapon.quantum_blaster.name',
    defaultName: 'Quantum Pulse Annihilator',
    descKey: 'digital_city.weapon.quantum_blaster.desc',
    defaultDesc: 'Peak cybersecurity weaponry harnessing quantum cryptographic pulses.',
    icon: '⚛️',
    tier: 'higher',
    unlockLevel: 10,
    damage: 220,
    magazineCapacity: 20,
    fireRateMs: 800,
    cooldownMs: 800,
    reloadTimeSec: 2.6,
    range: 180,
    projectileSpeed: 52,
    projectileColor: '#10b981',
    burstCount: 1,
    spreadAngle: 0,
    isAoE: true,
    aoeRadius: 3.5,
    soundId: 'pulse_blast',
    modelType: 'quantum_blaster',
    representedThreat: 'Post-quantum zero-trust cryptographic pulse',
  },
  threat_blaster: {
    id: 'threat_blaster',
    nameKey: 'digital_city.equipment.threat_blaster.name',
    defaultName: 'Threat Blaster (Assault Rifle)',
    descKey: 'digital_city.equipment.threat_blaster.desc',
    defaultDesc: 'Standard issue infantry rifle firing rapid coherent plasma pulses.',
    icon: '⚡',
    tier: 'early',
    unlockLevel: 1,
    damage: 28,
    magazineCapacity: 30,
    fireRateMs: 280,
    cooldownMs: 280,
    reloadTimeSec: 1.8,
    range: 120,
    projectileSpeed: 38,
    projectileColor: '#00bbff',
    burstCount: 1,
    spreadAngle: 0,
    isAoE: false,
    soundId: 'laser_fire',
    modelType: 'cyber_assault_rifle',
    representedThreat: 'Rapid neutralization of automated exploit payloads',
  },
}

// Exactly 8 canonical tactical equipment types
export const EQUIPMENT_TYPES = [
  'threat_blaster',
  'firewall_shield',
  'network_pulse',
  'security_drone',
  'recovery_beacon',
  'signal_scanner',
  'encryption_barrier',
  'emp_device',
]

export const EQUIPMENT_REGISTRY = {
  threat_blaster: {
    id: 'threat_blaster',
    nameKey: 'digital_city.equipment.threat_blaster.name',
    defaultName: 'Threat Blaster (Assault Rifle)',
    descKey: 'digital_city.equipment.threat_blaster.desc',
    icon: '⚡',
    category: 'weapon',
    cooldownMs: 280,
    damage: 28,
    range: 120,
    projectileSpeed: 38,
    projectileColor: '#00bbff',
    heatPerShot: 8,
    maxHeat: 100,
    coolRatePerSec: 35,
    soundId: 'laser_fire',
    representedThreat: 'Rapid identification and elimination of malicious payloads',
    magazineCapacity: 30,
    reloadTimeSec: 1.8,
  },
  firewall_shield: {
    id: 'firewall_shield',
    nameKey: 'digital_city.equipment.firewall_shield.name',
    defaultName: 'Firewall Shield',
    descKey: 'digital_city.equipment.firewall_shield.desc',
    icon: '🛡️',
    category: 'defense',
    cooldownMs: 1200,
    durationMs: 4000,
    damageReductionRatio: 0.85,
    parryWindowMs: 400,
    energyCost: 20,
    shieldColor: '#38bdf8',
    soundId: 'shield_up',
    representedThreat: 'Dynamic packet filtering and perimeter intrusion defense',
  },
  network_pulse: {
    id: 'network_pulse',
    nameKey: 'digital_city.equipment.network_pulse.name',
    defaultName: 'Network Pulse',
    descKey: 'digital_city.equipment.network_pulse.desc',
    icon: '💫',
    category: 'tactical_aoe',
    cooldownMs: 8000,
    radius: 18,
    damage: 45,
    stunDurationMs: 3000,
    knockbackForce: 14,
    energyCost: 35,
    color: '#a855f7',
    soundId: 'pulse_blast',
    representedThreat: 'SYN flood disruption and broadcast isolation',
  },
  security_drone: {
    id: 'security_drone',
    nameKey: 'digital_city.equipment.security_drone.name',
    defaultName: 'Security Drone (Sentinel)',
    descKey: 'digital_city.equipment.security_drone.desc',
    icon: '🛸',
    category: 'support_drone',
    cooldownMs: 15000,
    durationMs: 25000,
    orbitRadius: 3.5,
    fireRateMs: 650,
    droneDamage: 16,
    energyCost: 40,
    color: '#10b981',
    soundId: 'drone_hum',
    representedThreat: 'Automated EDR (Endpoint Detection & Response) monitoring',
  },
  recovery_beacon: {
    id: 'recovery_beacon',
    nameKey: 'digital_city.equipment.recovery_beacon.name',
    defaultName: 'Recovery Beacon',
    descKey: 'digital_city.equipment.recovery_beacon.desc',
    icon: '🗼',
    category: 'deployable_healing',
    cooldownMs: 12000,
    durationMs: 15000,
    healPerSec: 15,
    infrastructureRepairPerSec: 25,
    radius: 12,
    energyCost: 30,
    color: '#00ff88',
    soundId: 'beacon_deploy',
    representedThreat: 'Disaster recovery failover and air-gapped system restoration',
  },
  signal_scanner: {
    id: 'signal_scanner',
    nameKey: 'digital_city.equipment.signal_scanner.name',
    defaultName: 'Signal Scanner (IoC Sweep)',
    descKey: 'digital_city.equipment.signal_scanner.desc',
    icon: '📡',
    category: 'intel',
    cooldownMs: 6000,
    durationMs: 8000,
    sweepRange: 50,
    critChanceBonus: 0.4,
    energyCost: 15,
    color: '#facc15',
    soundId: 'scanner_sweep',
    representedThreat: 'Threat intelligence telemetry and honeypot detection',
  },
  encryption_barrier: {
    id: 'encryption_barrier',
    nameKey: 'digital_city.equipment.encryption_barrier.name',
    defaultName: 'Encryption Barrier',
    descKey: 'digital_city.equipment.encryption_barrier.desc',
    icon: '🧱',
    category: 'deployable_wall',
    cooldownMs: 14000,
    durationMs: 20000,
    barrierHealth: 350,
    barrierWidth: 8,
    barrierHeight: 4,
    energyCost: 35,
    color: '#ec4899',
    soundId: 'barrier_deploy',
    representedThreat: 'End-to-end cryptographic encapsulation and zero-trust segmentation',
  },
  emp_device: {
    id: 'emp_device',
    nameKey: 'digital_city.equipment.emp_device.name',
    defaultName: 'EMP Defense Device',
    descKey: 'digital_city.equipment.emp_device.desc',
    icon: '💣',
    category: 'ultimate',
    cooldownMs: 22000,
    radius: 28,
    droneDisableDurationMs: 8000,
    enemySilenceDurationMs: 6000,
    damage: 75,
    energyCost: 60,
    color: '#f59e0b',
    soundId: 'emp_detonate',
    representedThreat: 'Electromagnetic isolation and rapid containment of hostile botnets',
  },
}

// Add advanced weapon keys to EQUIPMENT_REGISTRY for weapon switching
Object.entries(WEAPON_REGISTRY).forEach(([id, weapon]) => {
  if (!EQUIPMENT_REGISTRY[id]) {
    EQUIPMENT_REGISTRY[id] = {
      ...weapon,
      category: 'weapon',
      heatPerShot: 6,
      maxHeat: 100,
      coolRatePerSec: 35,
    }
  }
})

/**
 * Creates initial equipment inventory for player character
 */
export function createPlayerEquipmentState(playerLevel = 1) {
  const initialUnlocked = [
    'threat_blaster',
    'cyber_assault_rifle',
    'energy_pistol',
    'firewall_shield',
    'network_pulse',
    'recovery_beacon',
  ]

  // Add unlocked weapons according to playerLevel
  Object.values(WEAPON_REGISTRY).forEach((w) => {
    if (w.unlockLevel <= playerLevel && !initialUnlocked.includes(w.id)) {
      initialUnlocked.push(w.id)
    }
  })

  const ammo = {
    threat_blaster: 30,
    cyber_assault_rifle: 30,
    energy_pistol: 12,
    burst_rifle: 36,
    tactical_shotgun: 8,
    precision_rifle: 5,
    heavy_energy_rifle: 40,
    plasma_cannon: 15,
    long_range_sniper: 4,
    quantum_blaster: 20,
  }

  return {
    selectedWeaponId: 'threat_blaster',
    selectedGadgetId: 'firewall_shield',
    secondaryGadgetId: 'network_pulse',
    unlockedEquipment: initialUnlocked,
    ammo,
    isReloading: false,
    reloadTimer: 0,
    reloadTotalTime: 0,
    equipmentLevels: {
      threat_blaster: 1,
      cyber_assault_rifle: 1,
      energy_pistol: 1,
      burst_rifle: 1,
      tactical_shotgun: 1,
      precision_rifle: 1,
      heavy_energy_rifle: 1,
      plasma_cannon: 1,
      long_range_sniper: 1,
      quantum_blaster: 1,
      firewall_shield: 1,
      network_pulse: 1,
      security_drone: 1,
      recovery_beacon: 1,
      signal_scanner: 1,
      encryption_barrier: 1,
      emp_device: 1,
    },
    cooldowns: {},
    activeEffects: [],
    currentHeat: 0,
    isOverheated: false,
    maxEnergy: 100,
    currentEnergy: 100,
  }
}

/**
 * Initiates weapon reload
 */
export function startReload(equipmentState, nowMs = 0) {
  if (!equipmentState) return false
  if (equipmentState.isReloading) return false

  const weaponId = equipmentState.selectedWeaponId || 'threat_blaster'
  const weapon = EQUIPMENT_REGISTRY[weaponId] || EQUIPMENT_REGISTRY.threat_blaster
  const maxAmmo = weapon.magazineCapacity || 30
  const currentAmmo = equipmentState.ammo?.[weaponId] ?? maxAmmo

  if (currentAmmo >= maxAmmo) return false

  equipmentState.isReloading = true
  equipmentState.reloadTimer = weapon.reloadTimeSec || 1.8
  equipmentState.reloadTotalTime = weapon.reloadTimeSec || 1.8
  return true
}

/**
 * Updates reload tick; returns { completed: true, weaponId } when reload finishes
 */
export function updateReloadTick(equipmentState, dtSeconds = 0.016) {
  if (!equipmentState || !equipmentState.isReloading) return null

  equipmentState.reloadTimer -= dtSeconds
  if (equipmentState.reloadTimer <= 0) {
    const weaponId = equipmentState.selectedWeaponId || 'threat_blaster'
    const weapon = EQUIPMENT_REGISTRY[weaponId] || EQUIPMENT_REGISTRY.threat_blaster
    if (!equipmentState.ammo) equipmentState.ammo = {}
    equipmentState.ammo[weaponId] = weapon.magazineCapacity || 30
    equipmentState.isReloading = false
    equipmentState.reloadTimer = 0
    return { completed: true, weaponId }
  }
  return null
}

/**
 * Switches the player's active weapon safely
 */
export function switchPlayerWeapon(equipmentState, targetWeaponId, playerLevel = 1) {
  if (!equipmentState || !targetWeaponId) return false
  const weapon = EQUIPMENT_REGISTRY[targetWeaponId]
  if (!weapon) return false

  const isUnlocked = equipmentState.unlockedEquipment.includes(targetWeaponId) ||
    ((weapon.unlockLevel || 1) <= playerLevel)
  if (!isUnlocked) return false

  if (equipmentState.isReloading) {
    equipmentState.isReloading = false
    equipmentState.reloadTimer = 0
  }

  equipmentState.selectedWeaponId = targetWeaponId
  if (!equipmentState.unlockedEquipment.includes(targetWeaponId)) {
    equipmentState.unlockedEquipment.push(targetWeaponId)
  }
  return true
}

/**
 * Returns next weapon unlock and required level
 */
export function getNextWeaponUnlock(playerLevel = 1) {
  const locked = Object.values(WEAPON_REGISTRY)
    .filter((w) => w.unlockLevel > playerLevel)
    .sort((a, b) => a.unlockLevel - b.unlockLevel)
  if (!locked[0]) return null
  return {
    ...locked[0],
    requiredLevel: locked[0].unlockLevel,
  }
}

/**
 * Updates heat cooling, energy regeneration, and reload timers every tick
 */
export function updateEquipmentTick(equipment, dtSeconds = 0.016, nowMs = 0) {
  if (!equipment) return createPlayerEquipmentState()
  const updated = { ...equipment }

  // Cool down heat
  if (updated.currentHeat > 0) {
    const coolRate = 35
    updated.currentHeat = Math.max(0, updated.currentHeat - coolRate * dtSeconds)
    if (updated.currentHeat === 0) {
      updated.isOverheated = false
    }
  }

  // Regenerate energy
  if (updated.currentEnergy < (updated.maxEnergy || 100)) {
    const energyRegen = 15 // 15 energy / sec
    updated.currentEnergy = Math.min(updated.maxEnergy || 100, updated.currentEnergy + energyRegen * dtSeconds)
  }

  // Update reload state
  updateReloadTick(updated, dtSeconds)

  return updated
}

/**
 * Checks if equipment/weapon can be activated
 */
export function canActivateEquipment(equipmentState, equipmentId, nowMs) {
  const eq = EQUIPMENT_REGISTRY[equipmentId]
  if (!eq) return false

  if (!equipmentState.unlockedEquipment.includes(equipmentId)) return false

  if (equipmentState.cooldowns && equipmentState.cooldowns[equipmentId] !== undefined) {
    const lastActivated = equipmentState.cooldowns[equipmentId]
    const cd = eq.cooldownMs || eq.fireRateMs || 250
    if (nowMs - lastActivated < cd) return false
  }

  if (eq.energyCost && equipmentState.currentEnergy < eq.energyCost) return false
  if (equipmentState.isOverheated && eq.category === 'weapon') return false

  // If reloading, cannot shoot
  if (eq.category === 'weapon' && equipmentState.isReloading) return false

  return true
}

/**
 * Calculates damage reduction, shield absorption, and critical hits
 */
export function calculateDamage({
  baseDamage,
  targetShield = 0,
  isShieldActive = false,
  damageReduction = 0.85,
  isCritical = false,
  isParry = false,
}) {
  const critMultiplier = isCritical ? 1.75 : 1.0
  const rawDamage = Math.round(baseDamage * critMultiplier)

  if (isParry) {
    return {
      rawDamage,
      finalDamage: 0,
      damageReflected: rawDamage,
      shieldDepleted: 0,
      shieldDamage: 0,
      healthDamage: 0,
      isParry: true,
      soundEffect: 'parry_deflect',
    }
  }

  let effectiveDamage = rawDamage
  if (isShieldActive) {
    effectiveDamage = Math.round(rawDamage * (1 - damageReduction))
  }

  const shieldDamage = Math.min(targetShield, effectiveDamage)
  const healthDamage = Math.max(0, effectiveDamage - shieldDamage)

  return {
    rawDamage,
    shieldDamage,
    healthDamage,
    finalDamage: healthDamage,
    damageReflected: 0,
    shieldDepleted: shieldDamage,
    isParry: false,
    soundEffect: isShieldActive ? 'shield_impact' : 'hit_impact',
  }
}
