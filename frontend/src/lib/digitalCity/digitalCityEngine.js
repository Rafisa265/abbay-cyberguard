/**
 * CyberShield Ethiopia — Digital City: Master Simulation Engine
 *
 * Coordinates 3D character physics, tactical combat, enemy behavior trees,
 * friendly squad commands, infrastructure damage/recovery, and mission objectives.
 *
 * 100% deterministic (SR-09 compliant: zero Math.random).
 */

import { DISTRICTS, getDistrictByCoordinates, CANONICAL_CITY_COVER_POINTS, hasLineOfSight } from './cityDistricts.js'
import {
  CHARACTER_CLASSES,
} from './characterSystem.js'
import {
  EQUIPMENT_REGISTRY,
  createPlayerEquipmentState,
  canActivateEquipment,
  updateEquipmentTick,
  calculateDamage,
  switchPlayerWeapon,
  startReload,
  getNextWeaponUnlock,
} from './combatEquipment.js'
import {
  createEnemyUnit,
  createFriendlyGuardUnit,
  updateEnemyAITick,
  updateFriendlyGuardTick,
  AI_STATES,
  SQUAD_COMMANDS,
} from './enemyAI.js'
import {
  STORY_MISSIONS,
  DIFFICULTY_TIERS,
  getDifficultyTier,
  generateSurvivalWave,
} from './missionsAndCampaign.js'
import {
  loadDigitalCityProgression,
  recordMissionVictory,
  addCombatXp,
} from './gameProgression.js'

function pointToSegmentDistance(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1
  const dz = z2 - z1
  const l2 = dx * dx + dz * dz
  if (l2 === 0) return Math.hypot(px - x1, pz - z1)
  let t = ((px - x1) * dx + (pz - z1) * dz) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz))
}

/**
 * Calculates priority threat score for Friendly Recon Sentinel drone targeting
 *
 * Priority Policy:
 * 1. Hostile ground soldiers actively attacking or threatening nearby friendly squad members.
 * 2. Hostile ground soldiers threatening the player.
 * 3. Hostile strike drones actively attacking friendly squad members or player.
 * 4. Other valid hostile targets (patrolling ground hostiles / hostile drones).
 */
export function calculateDroneThreatScore(candidate, drone, player, friendlyGuards = []) {
  if (!candidate || candidate.health <= 0) return -1

  let score = 0
  const isGroundEnemy = !candidate.isDrone
  const distToDrone = Math.hypot(candidate.x - drone.x, candidate.z - drone.z)
  const attackRange = drone.attackRange || 38

  // Small proximity factor to break ties (0 to 10 points)
  const proximityBonus = Math.max(0, (1 - distToDrone / attackRange) * 10)
  score += proximityBonus

  // Friendly guard evaluation
  const livingGuards = (Array.isArray(friendlyGuards) ? friendlyGuards : []).filter((g) => g && g.health > 0)
  let minGuardDist = 999
  let targetingGuard = false

  for (const g of livingGuards) {
    const dg = Math.hypot(candidate.x - g.x, candidate.z - g.z)
    if (dg < minGuardDist) minGuardDist = dg
    if (candidate.targetFriendlyId === g.id || candidate.targetId === g.id) {
      targetingGuard = true
    }
  }

  const distToPlayer = player ? Math.hypot(candidate.x - player.x, candidate.z - player.z) : 999
  const targetingPlayer = candidate.targetFriendlyId === 'player' || candidate.targetId === 'player'

  if (isGroundEnemy) {
    // Priority 1: Ground soldiers actively attacking or threatening nearby friendly squad members
    if (targetingGuard && (candidate.state === 'ATTACK' || candidate.state === 'AIM')) {
      score += 180 // Highest priority: lethal fire on squad
    } else if (targetingGuard) {
      score += 140 // Actively chasing squad
    } else if (minGuardDist < 12) {
      score += 100 // Intruding near squad perimeter
    }

    // Priority 2: Ground soldiers threatening the player
    if (targetingPlayer && (candidate.state === 'ATTACK' || candidate.state === 'AIM')) {
      score += 110 // Firing at player
    } else if (targetingPlayer) {
      score += 80 // Chasing player
    } else if (distToPlayer < 10) {
      score += 65 // Near player
    }

    // General ground soldier presence
    score += 45
  } else {
    // Priority 3: Hostile strike drones attacking friendly squad or player
    if (targetingGuard && candidate.isTargetLocked) {
      score += 85 // Drone locked on friendly guard
    } else if (targetingGuard) {
      score += 65
    } else if (targetingPlayer && candidate.isTargetLocked) {
      score += 60 // Drone locked on player
    } else {
      // Priority 4: Other valid hostile targets (patrolling hostile drone)
      score += 30
    }
  }

  return score
}

export function createInitialCitySimulationState({
  missionId = 'm_01_orientation',
  gameMode = 'story_campaign',
  difficultyId,
  difficulty,
} = {}) {
  const chosenDiff = difficultyId || difficulty || 'beginner'
  const mission = STORY_MISSIONS.find((m) => m.id === missionId) || STORY_MISSIONS[0]
  const diffTier = getDifficultyTier(chosenDiff)
  const progression = loadDigitalCityProgression()

  // 1. Initial Player State with comfortable tactical speed
  const playerSpeed = 4.2 * (diffTier.playerSpeedMultiplier || 1.0)
  const playerSprint = 6.8 * (diffTier.playerSpeedMultiplier || 1.0)

  const player = {
    classId: 'cyber_guard_recruit',
    x: 0,
    y: 0,
    z: 15,
    vx: 0,
    vz: 0,
    vy: 0,
    isGrounded: true,
    rotationY: Math.PI, // Facing North (-Z) down Grand Avenue into the city
    health: 120,
    maxHealth: 120,
    shield: 80,
    maxShield: 80,
    speed: playerSpeed,
    sprintSpeed: playerSprint,
    animState: 'idle',
    isShieldActive: false,
    isAiming: false,
  }

  // 2. Initial Friendly Squad Units (Military Fireteam of 3)
  const friendlyGuards = [
    createFriendlyGuardUnit({ id: 'guard_alpha', classId: 'cyber_guard_elite', name: 'Alpha-1 (Lead)', x: -3.8, z: 18.0 }),
    createFriendlyGuardUnit({ id: 'guard_bravo', classId: 'cyber_guard_heavy', name: 'Bravo-2 (Support)', x: 3.8, z: 18.0 }),
    createFriendlyGuardUnit({ id: 'guard_charlie', classId: 'cyber_guard_marksman', name: 'Charlie-3 (Overwatch)', x: 0.0, z: 20.0 }),
  ]

  // 3. Initial Enemy Spawns based on Mission and Progressive Pacing
  const enemies = []
  const isMission1 = missionId === 'm_01_orientation'

  if (gameMode === 'factions_demo') {
    // Faction Lineup & Combat showcase: Scout, Assault, Heavy, Drone Operator in clear line of sight
    enemies.push(
      createEnemyUnit({ id: 'demo_scout', classId: 'scout_hacker', x: -5.0, z: -8, health: 60 }),
      createEnemyUnit({ id: 'demo_assault', classId: 'malware_unit', x: -1.5, z: -10, health: 90 }),
      createEnemyUnit({ id: 'demo_heavy', classId: 'heavy_attacker', x: 2.5, z: -12, health: 240 }),
      createEnemyUnit({ id: 'demo_drone_op', classId: 'drone_controller', x: 6.0, z: -8, health: 110 })
    )
  } else if (gameMode === 'landmarks_demo') {
    player.x = 0
    player.z = 8
    enemies.push(
      createEnemyUnit({ id: 'demo_scout', classId: 'scout_hacker', x: -3.5, z: -8, health: 60 }),
      createEnemyUnit({ id: 'demo_heavy', classId: 'heavy_attacker', x: 3.5, z: -8, health: 240 })
    )
  } else if (mission.isBossMission && mission.bossId) {
    enemies.push(
      createEnemyUnit({
        id: `boss_${mission.bossId}`,
        classId: mission.bossId,
        x: 0,
        z: -16,
        targetDistrictId: mission.districtId,
        health: 2000 * (diffTier.enemyHealthMultiplier || 1.0),
        maxHealth: 2000 * (diffTier.enemyHealthMultiplier || 1.0),
        attackCooldownMs: 2500 * (diffTier.attackIntervalMultiplier || 1.0),
        isBoss: true,
      })
    )
  } else if (isMission1) {
    // Mission 1: Paced Introduction
    // Initial scout placed directly down Grand Avenue in clear line of sight (23m distance)
    enemies.push(
      createEnemyUnit({
        id: `en_${missionId}_0`,
        classId: 'scout_hacker',
        x: 0,
        z: -8,
        targetDistrictId: mission.districtId,
        targetObjectiveId: mission.targetObjectiveId,
        health: 50 * (diffTier.enemyHealthMultiplier || 1.0),
        attackCooldownMs: 3600 * (diffTier.attackIntervalMultiplier || 1.0),
        speed: 2.2 * (diffTier.enemySpeedMultiplier || 1.0),
      })
    )
  } else {
    // Other missions: spawn initial tactical wave scaled by difficulty along open Grand Ave corridor
    const enemyTypes = mission.enemyTypes || ['scout_hacker', 'malware_unit']
    const initialCount = Math.min(mission.targetEnemyCount, 3)

    // Open road corridors on Grand Ave directly in visible view (Z = -8 to -16)
    const corridorSpawns = [
      { x: 0, z: -8 },     // Grand Ave North central (direct open street in line of sight)
      { x: -5, z: -12 },   // Grand Ave North left lane
      { x: 5, z: -12 },    // Grand Ave North right lane
      { x: -7, z: -16 },   // Grand Ave deeper approach
      { x: 7, z: -16 },    // Grand Ave deeper approach
      { x: 0, z: -20 },    // Grand Ave North
      { x: -4, z: -24 },   // Grand Ave deeper
    ]

    for (let i = 0; i < initialCount; i++) {
      const type = enemyTypes[i % enemyTypes.length]
      const spot = corridorSpawns[i % corridorSpawns.length]
      enemies.push(
        createEnemyUnit({
          id: `en_${missionId}_${i}`,
          classId: type,
          x: spot.x,
          z: spot.z,
          targetDistrictId: mission.districtId,
          targetObjectiveId: mission.targetObjectiveId,
          health: 70 * (diffTier.enemyHealthMultiplier || 1.0),
          attackCooldownMs: 2800 * (diffTier.attackIntervalMultiplier || 1.0),
          speed: 2.8 * (diffTier.enemySpeedMultiplier || 1.0),
        })
      )
    }
  }

  // 4. District and Infrastructure States
  const districts = JSON.parse(JSON.stringify(DISTRICTS))

  // 5. Autonomous Tactical Flying Drones
  // Friendly sentinels always protect; Hostile drones only active in non-tutorial combat
  const drones = [
    {
      id: 'drone_sentinel_1',
      isEnemy: false,
      x: -4,
      y: 4.2,
      z: 16,
      vx: 0,
      vz: 0,
      heading: 0,
      speed: 6.5,
      orbitOffset: 0,
      health: 80,
      maxHealth: 80,
      detectionRange: 40,
      attackRange: 38,
      lastAttackTimeMs: 0,
      attackCooldownMs: 1200,
      targetId: null,
      targetPos: null,
      isTargetLocked: false,
    },
    {
      id: 'drone_sentinel_2',
      isEnemy: false,
      x: 4,
      y: 4.6,
      z: 16,
      vx: 0,
      vz: 0,
      heading: 0,
      speed: 6.5,
      orbitOffset: Math.PI,
      health: 80,
      maxHealth: 80,
      detectionRange: 40,
      attackRange: 38,
      lastAttackTimeMs: 0,
      attackCooldownMs: 1400,
      targetId: null,
      targetPos: null,
      isTargetLocked: false,
    },
  ]

  // Add hostile drones only for non-orientation missions
  if (!isMission1) {
    drones.push(
      {
        id: 'drone_hostile_1',
        isEnemy: true,
        x: -18,
        y: 5.2,
        z: -25,
        vx: 0,
        vz: 0,
        heading: Math.PI,
        speed: 5.2 * (diffTier.enemySpeedMultiplier || 1.0),
        orbitOffset: 0,
        health: 65 * (diffTier.enemyHealthMultiplier || 1.0),
        maxHealth: 65,
        detectionRange: 42,
        attackRange: 38,
        lastAttackTimeMs: 0,
        attackCooldownMs: 2400 * (diffTier.attackIntervalMultiplier || 1.0),
        targetId: 'player',
        targetPos: null,
        isTargetLocked: true,
      },
      {
        id: 'drone_hostile_2',
        isEnemy: true,
        x: 18,
        y: 5.4,
        z: -25,
        vx: 0,
        vz: 0,
        heading: Math.PI,
        speed: 5.2 * (diffTier.enemySpeedMultiplier || 1.0),
        orbitOffset: Math.PI,
        health: 65 * (diffTier.enemyHealthMultiplier || 1.0),
        maxHealth: 65,
        detectionRange: 42,
        attackRange: 38,
        lastAttackTimeMs: 0,
        attackCooldownMs: 2400 * (diffTier.attackIntervalMultiplier || 1.0),
        targetId: 'player',
        targetPos: null,
        isTargetLocked: true,
      }
    )
  }

  return {
    missionId,
    mission,
    isBossMission: !!mission.isBossMission,
    gameMode,
    difficultyId: chosenDiff,
    difficulty: diffTier,
    status: 'playing', // 'playing' | 'victory' | 'defeat' | 'paused'
    player,
    equipment: createPlayerEquipmentState(),
    friendlyGuards,
    enemies,
    drones,
    activeShockwaves: [],
    activeBeacons: [],
    districts,
    projectiles: [],
    score: 0,
    missionTimer: 0,
    enemiesDefeatedCount: 0,
    survivalWave: 1,
    squadCommand: SQUAD_COMMANDS.FOLLOW,
    objectiveProgress: {
      enemiesDefeated: 0,
      targetEnemies: mission.targetEnemyCount,
      infrastructureHealth: 100,
      objectiveSecured: false,
    },
    uiNotifications: [],
    cameraRotation: { yaw: 0, pitch: 0.22 },
  }
}

/**
 * Main simulation step executed each game tick
 */
export function stepDigitalCitySimulation(state, input = {}, obstacles = [], dtSeconds = 0.016, nowMs = Date.now()) {
  if (state.status !== 'playing' || state.isPaused) {
    return { ...state, audioEvents: [] }
  }

  const next = { ...state }
  const player = { ...next.player }
  let equipment = { ...next.equipment }
  const audioEvents = []

  // Check squad command changes for radio response
  if (input.squadCommand && input.squadCommand !== next.squadCommand) {
    next.squadCommand = input.squadCommand
    audioEvents.push({ type: 'radio_command', command: next.squadCommand })
  }

  // 1. Process Player Input & Movement
  const isSprinting = input.sprint && !player.isShieldActive
  const moveSpeed = isSprinting ? player.sprintSpeed : player.speed

  let moveX = 0
  let moveZ = 0

  if (input.forward) moveZ -= 1
  if (input.backward) moveZ += 1
  if (input.left) moveX -= 1
  if (input.right) moveX += 1

  // Normalize diagonal movement
  const moveLen = Math.hypot(moveX, moveZ)
  if (moveLen > 0) {
    moveX /= moveLen
    moveZ /= moveLen

    // Camera-relative movement
    const yaw = next.cameraRotation?.yaw || 0
    const camForwardX = -Math.sin(yaw)
    const camForwardZ = -Math.cos(yaw)
    const camRightX = Math.cos(yaw)
    const camRightZ = -Math.sin(yaw)

    const worldX = moveX * camRightX - moveZ * camForwardX
    const worldZ = moveX * camRightZ - moveZ * camForwardZ

    player.vx = worldX * moveSpeed
    player.vz = worldZ * moveSpeed
    player.rotationY = Math.atan2(worldX, worldZ)

    player.animState = isSprinting ? 'sprint' : 'run'

    // Footstep pacing when grounded
    if (player.isGrounded) {
      player.stepTimer = (player.stepTimer || 0) + dtSeconds
      const footstepInterval = isSprinting ? 0.26 : 0.4
      if (player.stepTimer >= footstepInterval) {
        player.stepTimer = 0
        audioEvents.push({ type: 'footstep', isSprinting })
      }
    }
  } else {
    player.vx = 0
    player.vz = 0
    player.stepTimer = 0
    if (input.shoot || player.isShieldActive) {
      const yaw = next.cameraRotation?.yaw || 0
      player.rotationY = Math.atan2(-Math.sin(yaw), -Math.cos(yaw))
    }
    player.animState = player.isShieldActive ? 'block' : (input.shoot ? 'attack' : 'idle')
  }

  // 2. Jump & Vertical Gravity
  if (input.jump && player.isGrounded) {
    player.vy = 8.5
    player.isGrounded = false
    player.animState = 'jump'
    audioEvents.push({ type: 'jump' })
  }

  if (!player.isGrounded) {
    player.vy -= 18.0 * dtSeconds // gravity
    player.y += player.vy * dtSeconds
    if (player.y <= 0) {
      player.y = 0
      player.vy = 0
      player.isGrounded = true
      audioEvents.push({ type: 'land' })
    }
  }

  // 3. Collision Resolution against city obstacles
  const candidateX = player.x + player.vx * dtSeconds
  const candidateZ = player.z + player.vz * dtSeconds

  let canMoveX = true
  let canMoveZ = true
  const playerRadius = 0.65

  for (const box of obstacles) {
    if (
      candidateX + playerRadius > box.minX &&
      candidateX - playerRadius < box.maxX &&
      player.z + playerRadius > box.minZ &&
      player.z - playerRadius < box.maxZ
    ) {
      canMoveX = false
    }

    if (
      player.x + playerRadius > box.minX &&
      player.x - playerRadius < box.maxX &&
      candidateZ + playerRadius > box.minZ &&
      candidateZ - playerRadius < box.maxZ
    ) {
      canMoveZ = false
    }
  }

  if (canMoveX) player.x = candidateX
  if (canMoveZ) player.z = candidateZ

  // 4. Equipment Updates & Heat Cooling
  equipment = updateEquipmentTick(equipment, dtSeconds, nowMs)

  // 5. Player Shield & Weapon Activation
  const wasShieldActive = player.isShieldActive
  player.isShieldActive = !!input.block
  if (player.isShieldActive) {
    player.animState = 'block'
    if (!wasShieldActive) {
      audioEvents.push({ type: 'shield_activate' })
    }
  }

  // Tactical Weapon Switching & Reload Inputs
  if (input.selectWeapon) {
    switchPlayerWeapon(equipment, input.selectWeapon, next.progression?.playerLevel || 1)
  }
  if (input.reload) {
    if (startReload(equipment, nowMs)) {
      player.animState = 'reloading'
      audioEvents.push({ type: 'weapon_reload' })
    }
  }

  // Update squad command if commanded
  if (input.squadCommand && next.friendlyGuards) {
    next.friendlyGuards.forEach((g) => {
      g.command = input.squadCommand
    })
  }

  // Shooting Active Weapon
  const newProjectiles = [...(next.projectiles || [])]
  const weaponId = equipment.selectedWeaponId || 'threat_blaster'
  const activeWeapon = EQUIPMENT_REGISTRY[weaponId] || EQUIPMENT_REGISTRY.threat_blaster

  if (input.shoot && !player.isShieldActive) {
    if (canActivateEquipment(equipment, weaponId, nowMs)) {
      equipment.cooldowns[weaponId] = nowMs
      equipment.currentHeat = Math.min(100, equipment.currentHeat + (activeWeapon.heatPerShot || 8))
      if (equipment.currentHeat >= 100) {
        equipment.isOverheated = true
      }

      // Consume ammo
      if (!equipment.ammo) equipment.ammo = {}
      const curAmmo = equipment.ammo[weaponId] !== undefined ? equipment.ammo[weaponId] : (activeWeapon.magazineCapacity || 30)
      equipment.ammo[weaponId] = Math.max(0, curAmmo - 1)
      if (equipment.ammo[weaponId] <= 0) {
        startReload(equipment, nowMs)
      }

      const burstCount = activeWeapon.burstCount || 1
      const spreadAngle = activeWeapon.spreadAngle || 0

      for (let b = 0; b < burstCount; b++) {
        const spreadOffset = (burstCount > 1) ? ((b - (burstCount - 1) / 2) * spreadAngle) : 0
        const forwardAngle = player.rotationY + spreadOffset

        const muzzleForward = 0.85
        const muzzleRight = 0.35
        const muzzleX = player.x + Math.sin(player.rotationY) * muzzleForward + Math.cos(player.rotationY) * muzzleRight
        const muzzleZ = player.z + Math.cos(player.rotationY) * muzzleForward - Math.sin(player.rotationY) * muzzleRight

        newProjectiles.push({
          id: `proj_${nowMs}_${newProjectiles.length}_${b}`,
          startX: muzzleX,
          startY: 1.25,
          startZ: muzzleZ,
          dirX: Math.sin(forwardAngle),
          dirZ: Math.cos(forwardAngle),
          speed: activeWeapon.projectileSpeed || 38,
          damage: activeWeapon.damage || 28,
          isEnemy: false,
          color: activeWeapon.projectileColor || '#00bbff',
          isAoE: !!activeWeapon.isAoE,
          aoeRadius: activeWeapon.aoeRadius || 0,
          lifetime: 1.8,
        })
      }

      player.animState = 'attack'
      audioEvents.push({ type: 'player_fire', weaponId, soundId: activeWeapon.soundId || 'laser_fire' })
    }
  }

  // 5b. Tactical Ability Activation: Network Pulse (Q)
  if (input.activatePulse && canActivateEquipment(equipment, 'network_pulse', nowMs)) {
    equipment.cooldowns['network_pulse'] = nowMs
    equipment.currentEnergy = Math.max(0, equipment.currentEnergy - EQUIPMENT_REGISTRY.network_pulse.energyCost)
    audioEvents.push({ type: 'network_pulse' })

    if (!next.activeShockwaves) next.activeShockwaves = []
    next.activeShockwaves.push({
      x: player.x,
      y: 0.2,
      z: player.z,
      radius: 0.5,
      maxRadius: EQUIPMENT_REGISTRY.network_pulse.radius,
      lifetime: 0.6,
    })

    // Stun and damage all enemies within range
    next.enemies.forEach((en) => {
      if (!en || en.health <= 0) return
      const dist = Math.hypot(en.x - player.x, en.z - player.z)
      if (dist <= EQUIPMENT_REGISTRY.network_pulse.radius) {
        en.health = Math.max(0, en.health - EQUIPMENT_REGISTRY.network_pulse.damage)
        en.state = AI_STATES.STUNNED
        en.stateTimer = 3.0
        if (en.health <= 0) {
          next.enemiesDefeatedCount += 1
          next.score += en.isBoss ? 2000 : 150
          next.objectiveProgress.enemiesDefeated += 1
          audioEvents.push({ type: 'enemy_defeat', isBoss: en.isBoss })
        }
      }
    })
  }

  // 5c. Tactical Ability Activation: Recovery Beacon (E)
  if (input.activateBeacon && canActivateEquipment(equipment, 'recovery_beacon', nowMs)) {
    equipment.cooldowns['recovery_beacon'] = nowMs
    equipment.currentEnergy = Math.max(0, equipment.currentEnergy - EQUIPMENT_REGISTRY.recovery_beacon.energyCost)
    audioEvents.push({ type: 'recovery_beacon' })

    if (!next.activeBeacons) next.activeBeacons = []
    next.activeBeacons.push({
      id: `beacon_${nowMs}`,
      x: player.x,
      z: player.z,
      duration: 18.0,
      pulseTimer: 0,
    })
  }

  // Update active beacons & heal player
  const updatedBeacons = (next.activeBeacons || []).filter((b) => b.duration > 0)
  updatedBeacons.forEach((b) => {
    b.duration -= dtSeconds
    b.pulseTimer = (b.pulseTimer || 0) + dtSeconds
    if (b.pulseTimer >= 1.0) {
      b.pulseTimer = 0
      const distToPlayer = Math.hypot(player.x - b.x, player.z - b.z)
      if (distToPlayer <= 12) {
        player.health = Math.min(player.maxHealth, player.health + 12)
        player.shield = Math.min(player.maxShield, player.shield + 10)
      }
    }
  })
  next.activeBeacons = updatedBeacons

  // Update active shockwaves
  const updatedShockwaves = (next.activeShockwaves || []).filter((s) => s.lifetime > 0)
  updatedShockwaves.forEach((s) => {
    s.lifetime -= dtSeconds
    s.radius += (s.maxRadius / 0.6) * dtSeconds
  })
  next.activeShockwaves = updatedShockwaves

  // 6. Update Projectiles & Hit Detection
  for (let i = newProjectiles.length - 1; i >= 0; i--) {
    const p = newProjectiles[i]
    const oldX = p.startX
    const oldZ = p.startZ
    p.startX += p.dirX * p.speed * dtSeconds
    p.startZ += p.dirZ * p.speed * dtSeconds
    p.lifetime -= dtSeconds

    // Check hit against environmental cover barricades (continuous swept segment collision)
    if (CANONICAL_CITY_COVER_POINTS) {
      for (const cover of CANONICAL_CITY_COVER_POINTS) {
        const halfW = (cover.width || 3.5) / 2
        const halfD = (cover.depth || 0.8) / 2
        const minX = cover.x - halfW
        const maxX = cover.x + halfW
        const minZ = cover.z - halfD
        const maxZ = cover.z + halfD
        const minSegX = Math.min(oldX, p.startX)
        const maxSegX = Math.max(oldX, p.startX)
        const minSegZ = Math.min(oldZ, p.startZ)
        const maxSegZ = Math.max(oldZ, p.startZ)

        if (
          maxSegX >= minX && minSegX <= maxX &&
          maxSegZ >= minZ && minSegZ <= maxZ &&
          p.startY <= (cover.height || 1.4)
        ) {
          p.lifetime = 0
          break
        }
      }
    }

    // Check hit against enemies
    if (!p.isEnemy) {
      // 1. Check hit against hostile ground soldiers
      for (const enemy of next.enemies) {
        if (!enemy || enemy.health <= 0) continue
        const dist = pointToSegmentDistance(enemy.x, enemy.z, oldX, oldZ, p.startX, p.startZ)
        if (dist <= 1.4) {
          const dmgResult = calculateDamage({
            baseDamage: p.damage,
            targetShield: enemy.shield,
          })
          enemy.shield = Math.max(0, enemy.shield - dmgResult.shieldDamage)
          enemy.health = Math.max(0, enemy.health - dmgResult.healthDamage)

          // Positive hit feedback & combat marker
          audioEvents.push({
            type: 'hit_marker',
            damage: dmgResult.healthDamage + dmgResult.shieldDamage,
            enemyId: enemy.id,
            x: enemy.x,
            z: enemy.z,
          })
          audioEvents.push({ type: 'enemy_hurt' })

          if (enemy.health <= 0) {
            next.enemiesDefeatedCount += 1
            next.score += enemy.isBoss ? 2000 : 150
            next.objectiveProgress.enemiesDefeated += 1
            audioEvents.push({ type: 'enemy_defeat', isBoss: enemy.isBoss })
            audioEvents.push({ type: 'radio_enemy_defeated' })
            addCombatXp(enemy.isBoss ? 250 : 50, { enemiesDefeated: 1 })
          } else if (dmgResult.shieldDamage > 0) {
            audioEvents.push({ type: 'shield_deflect' })
          } else {
            audioEvents.push({ type: 'armor_impact' })
          }

          p.lifetime = 0
          break
        }
      }

      // 2. Check hit against hostile strike drones
      if (p.lifetime > 0 && next.drones) {
        for (const drone of next.drones) {
          if (!drone || !drone.isEnemy || drone.health <= 0) continue
          const dist = pointToSegmentDistance(drone.x, drone.z, oldX, oldZ, p.startX, p.startZ)
          const distY = Math.abs((drone.y || 4.8) - (p.startY || 1.3))
          if (dist <= 1.6 && distY <= 2.5) {
            drone.health = Math.max(0, drone.health - p.damage)
            audioEvents.push({
              type: 'hit_marker',
              damage: p.damage,
              enemyId: drone.id,
              x: drone.x,
              z: drone.z,
            })
            if (drone.health <= 0) {
              next.score += 250
              audioEvents.push({ type: 'enemy_defeat', isBoss: false })
              audioEvents.push({ type: 'radio_enemy_defeated' })
              addCombatXp(75, { dronesDestroyed: 1 })
            } else {
              audioEvents.push({ type: 'armor_impact' })
            }
            p.lifetime = 0
            break
          }
        }
      }
    } else {
      // 1. Enemy projectile hitting player
      const distToPlayer = pointToSegmentDistance(player.x, player.z, oldX, oldZ, p.startX, p.startZ)
      if (distToPlayer <= 1.2) {
        const dmgResult = calculateDamage({
          baseDamage: p.damage,
          targetShield: player.shield,
          isShieldActive: player.isShieldActive,
          damageReduction: EQUIPMENT_REGISTRY.firewall_shield.damageReductionRatio,
        })

        player.shield = Math.max(0, player.shield - dmgResult.shieldDamage)
        player.health = Math.max(0, player.health - dmgResult.healthDamage)

        if (player.isShieldActive) {
          audioEvents.push({ type: 'shield_deflect' })
        } else {
          audioEvents.push({ type: 'player_hurt', damage: dmgResult.healthDamage + dmgResult.shieldDamage })
          if (player.health < 45) {
            audioEvents.push({ type: 'radio_under_fire' })
          }
        }

        p.lifetime = 0
      }

      // 2. Enemy projectile hitting friendly guards
      if (p.lifetime > 0 && next.friendlyGuards) {
        for (const guard of next.friendlyGuards) {
          if (!guard || guard.health <= 0) continue
          const distToGuard = pointToSegmentDistance(guard.x, guard.z, oldX, oldZ, p.startX, p.startZ)
          if (distToGuard <= 1.2) {
            guard.shield = Math.max(0, (guard.shield || 0) - p.damage)
            if (guard.shield <= 0) {
              guard.health = Math.max(0, guard.health - Math.round(p.damage * 0.7))
            }
            audioEvents.push({ type: 'armor_impact' })
            p.lifetime = 0
            break
          }
        }
      }

      // 3. Enemy projectile hitting friendly sentinels
      if (p.lifetime > 0 && next.drones) {
        for (const drone of next.drones) {
          if (!drone || drone.isEnemy || drone.health <= 0) continue
          const distToDrone = pointToSegmentDistance(drone.x, drone.z, oldX, oldZ, p.startX, p.startZ)
          const distY = Math.abs((drone.y || 4.2) - (p.startY || 1.3))
          if (distToDrone <= 1.4 && distY <= 2.2) {
            drone.health = Math.max(0, drone.health - p.damage)
            audioEvents.push({ type: 'armor_impact' })
            p.lifetime = 0
            break
          }
        }
      }
    }

    if (p.lifetime <= 0) {
      audioEvents.push({ type: 'projectile_impact' })
      newProjectiles.splice(i, 1)
    }
  }

  // 7. Update Enemy AI
  const updatedEnemies = next.enemies.map((enemy) => {
    const aiResult = updateEnemyAITick(
      enemy,
      { x: player.x, z: player.z },
      next.friendlyGuards,
      obstacles,
      dtSeconds,
      nowMs
    )

    if (aiResult.isHacking) {
      audioEvents.push({ type: 'alarm' })
      audioEvents.push({ type: 'radio_core_attacked' })
      next.objectiveProgress.infrastructureHealth = Math.max(0, (next.objectiveProgress.infrastructureHealth || 100) - dtSeconds * 3.5)
    }

    // Enemy weapon firing (weapon-specific behavior directed at locked friendly target)
    if (aiResult.attackTarget && nowMs - (enemy.lastAttackTimeMs || 0) > enemy.attackCooldownMs) {
      enemy.lastAttackTimeMs = nowMs
      const target = aiResult.attackTarget || player
      const dx = target.x - enemy.x
      const dz = target.z - enemy.z
      const dist = Math.hypot(dx, dz)
      if (dist > 0.1) {
        const enemyClass = CHARACTER_CLASSES[enemy.classId] || {}
        let enemyProjSpeed = 20 * (next.difficulty?.projectileSpeedMultiplier || 1.0)
        let enemyProjColor = '#ef4444'
        let enemyDamage = enemy.damage || 14
        let soundType = 'plasma_fire'

        if (enemyClass.role === 'scout') {
          enemyProjSpeed = 24 * (next.difficulty?.projectileSpeedMultiplier || 1.0)
          enemyDamage = 10
          enemyProjColor = '#f87171'
        } else if (enemyClass.role === 'heavy') {
          enemyProjSpeed = 16 * (next.difficulty?.projectileSpeedMultiplier || 1.0)
          enemyDamage = 24
          enemyProjColor = '#ea580c'
          soundType = 'emp_detonate'
        } else if (enemyClass.role === 'precision') {
          enemyProjSpeed = 48 * (next.difficulty?.projectileSpeedMultiplier || 1.0)
          enemyDamage = 35
          enemyProjColor = '#a855f7'
        }

        const eMuzzleX = enemy.x + (dx / dist) * 0.75
        const eMuzzleZ = enemy.z + (dz / dist) * 0.75

        newProjectiles.push({
          id: `en_proj_${nowMs}_${enemy.id}`,
          targetId: target.id,
          startX: eMuzzleX,
          startY: 1.25,
          startZ: eMuzzleZ,
          dirX: dx / dist,
          dirZ: dz / dist,
          speed: enemyProjSpeed,
          damage: enemyDamage,
          isEnemy: true,
          color: enemyProjColor,
          lifetime: 2.2,
        })
        audioEvents.push({ type: soundType })
      }
    }

    return aiResult.enemy
  })

  // Progressive Wave Spawning for All Missions & Survival Mode
  const activeLivingEnemies = updatedEnemies.filter((e) => e && e.health > 0)
  const isSurvival = next.gameMode === 'survival_endless'
  const targetCount = isSurvival ? 9999 : (next.mission?.targetEnemyCount || 8)

  if (activeLivingEnemies.length === 0 && next.enemiesDefeatedCount < targetCount) {
    const curWave = next.survivalWave || 1
    const totalWaves = next.mission?.totalWaves || 3

    if (curWave < totalWaves || isSurvival) {
      if (next.missionId === 'm_01_orientation') {
        if (next.enemiesDefeatedCount === 1 && curWave < 2) {
          audioEvents.push({ type: 'radio_enemy_spotted' })
          updatedEnemies.push(
            createEnemyUnit({
              id: `en_m_01_1`,
              classId: 'scout_hacker',
              x: -6,
              z: -14,
              health: 55 * (next.difficulty?.enemyHealthMultiplier || 1.0),
              attackCooldownMs: 3200 * (next.difficulty?.attackIntervalMultiplier || 1.0),
              speed: 2.6 * (next.difficulty?.enemySpeedMultiplier || 1.0),
            }),
            createEnemyUnit({
              id: `en_m_01_2`,
              classId: 'scout_hacker',
              x: 6,
              z: -14,
              health: 55 * (next.difficulty?.enemyHealthMultiplier || 1.0),
              attackCooldownMs: 3200 * (next.difficulty?.attackIntervalMultiplier || 1.0),
              speed: 2.6 * (next.difficulty?.enemySpeedMultiplier || 1.0),
            })
          )
          next.survivalWave = 2
        } else if (next.enemiesDefeatedCount === 3 && curWave < 3) {
          audioEvents.push({ type: 'radio_core_attacked' })
          updatedEnemies.push(
            createEnemyUnit({
              id: `en_m_01_3`,
              classId: 'scout_hacker',
              x: -4,
              z: -10,
              targetObjectiveId: 'cc_core',
              health: 60 * (next.difficulty?.enemyHealthMultiplier || 1.0),
              attackCooldownMs: 3000 * (next.difficulty?.attackIntervalMultiplier || 1.0),
              speed: 2.8 * (next.difficulty?.enemySpeedMultiplier || 1.0),
            }),
            createEnemyUnit({
              id: `en_m_01_4`,
              classId: 'scout_hacker',
              x: 4,
              z: -10,
              targetObjectiveId: 'cc_core',
              health: 60 * (next.difficulty?.enemyHealthMultiplier || 1.0),
              attackCooldownMs: 3000 * (next.difficulty?.attackIntervalMultiplier || 1.0),
              speed: 2.8 * (next.difficulty?.enemySpeedMultiplier || 1.0),
            })
          )
          next.survivalWave = 3
        }
      } else {
        // Multi-wave progression for Story Campaign Missions (m_02 through m_15) and Survival Mode
        next.survivalWave = curWave + 1
        const waveIdx = next.survivalWave
        audioEvents.push({ type: waveIdx % 2 === 0 ? 'radio_enemy_spotted' : 'radio_core_attacked' })

        const enemyTypes = next.mission?.enemyTypes || ['scout_hacker', 'malware_unit']
        const remainingNeeded = targetCount - next.enemiesDefeatedCount
        const waveSize = Math.min(remainingNeeded, 3)

        const waveSpawns = [
          { x: 0, z: -12 },
          { x: -6, z: -14 },
          { x: 6, z: -14 },
          { x: -8, z: -16 },
          { x: 8, z: -16 },
          { x: -4, z: -20 },
          { x: 4, z: -20 },
        ]

        for (let s = 0; s < waveSize; s++) {
          const type = enemyTypes[(s + waveIdx) % enemyTypes.length]
          const spot = waveSpawns[(s + waveIdx) % waveSpawns.length]
          updatedEnemies.push(
            createEnemyUnit({
              id: `en_${next.missionId}_w${waveIdx}_${s}`,
              classId: type,
              x: spot.x,
              z: spot.z,
              targetDistrictId: next.mission?.districtId,
              targetObjectiveId: next.mission?.targetObjectiveId,
              health: (65 + waveIdx * 10) * (next.difficulty?.enemyHealthMultiplier || 1.0),
              attackCooldownMs: Math.max(1600, (2800 - waveIdx * 200)) * (next.difficulty?.attackIntervalMultiplier || 1.0),
              speed: (2.4 + waveIdx * 0.15) * (next.difficulty?.enemySpeedMultiplier || 1.0),
            })
          )
        }

        // Hostile strike drone reinforcement if hostile drones are all eliminated
        if (next.drones && next.missionId !== 'm_01_orientation' && waveIdx >= 2) {
          const livingHostileDrones = next.drones.filter((d) => d && d.isEnemy && d.health > 0)
          if (livingHostileDrones.length === 0) {
            next.drones.push({
              id: `drone_hostile_reinforce_${waveIdx}`,
              isEnemy: true,
              x: 0,
              y: 5.2,
              z: -30,
              vx: 0,
              vz: 0,
              heading: Math.PI,
              speed: 5.2 * (next.difficulty?.enemySpeedMultiplier || 1.0),
              orbitOffset: Math.PI * 0.5,
              health: 60 * (next.difficulty?.enemyHealthMultiplier || 1.0),
              maxHealth: 60,
              detectionRange: 42,
              attackRange: 38,
              lastAttackTimeMs: nowMs,
              attackCooldownMs: 2400 * (next.difficulty?.attackIntervalMultiplier || 1.0),
              targetId: 'player',
              targetPos: null,
              isTargetLocked: true,
            })
          }
        }
      }
    }
  }

  // 8. Update Friendly Cyber Guard Squad
  const updatedGuards = (next.friendlyGuards || []).map((guard) => {
    const guardResult = updateFriendlyGuardTick(
      guard,
      { x: player.x, z: player.z, rotationY: player.rotationY },
      updatedEnemies,
      dtSeconds,
      nowMs,
      obstacles
    )

    // Guard fires at hostile target
    if (guardResult.attackTarget && nowMs - (guard.lastAttackTimeMs || 0) > guard.attackCooldownMs) {
      guard.lastAttackTimeMs = nowMs
      const target = guardResult.attackTarget
      const dx = target.x - guard.x
      const dz = target.z - guard.z
      const dist = Math.hypot(dx, dz)
      if (dist > 0.1) {
        const guardClass = CHARACTER_CLASSES[guard.classId] || {}
        let guardProjSpeed = 34
        let guardProjColor = '#38bdf8'
        let guardDamage = 22

        if (guardClass.role === 'heavy') {
          guardProjSpeed = 28
          guardDamage = 32
          guardProjColor = '#00bbff'
        } else if (guardClass.role === 'precision') {
          guardProjSpeed = 55
          guardDamage = 50
          guardProjColor = '#7dd3fc'
        }

        const gMuzzleX = guard.x + (dx / dist) * 0.75
        const gMuzzleZ = guard.z + (dz / dist) * 0.75

        newProjectiles.push({
          id: `guard_proj_${nowMs}_${guard.id}`,
          startX: gMuzzleX,
          startY: 1.25,
          startZ: gMuzzleZ,
          dirX: dx / dist,
          dirZ: dz / dist,
          speed: guardProjSpeed,
          damage: guardDamage,
          isEnemy: false,
          color: guardProjColor,
          lifetime: 2.0,
        })
        audioEvents.push({ type: 'guard_fire' })
      }
    }

    return guardResult.guard
  })

  // 8b. Update Autonomous Flying Drones
  const updatedDrones = (next.drones || []).map((drone) => {
    if (drone.health <= 0) return drone
    const updated = { ...drone }

    if (!updated.isEnemy) {
      // Friendly Sentinel: Orbits smoothly around player
      const orbitRadius = 4.8
      const orbitSpeed = 1.1
      const angle = nowMs * 0.001 * orbitSpeed + updated.orbitOffset
      const targetX = player.x + Math.sin(angle) * orbitRadius
      const targetZ = player.z + Math.cos(angle) * orbitRadius
      const targetY = 3.8 + Math.sin(nowMs * 0.002 + updated.orbitOffset) * 0.4

      updated.x += (targetX - updated.x) * 0.12
      updated.z += (targetZ - updated.z) * 0.12
      updated.y += (targetY - updated.y) * 0.12

      // Target selection among hostile units: ground enemies and hostile strike drones
      const candidateTargets = []
      for (const en of updatedEnemies) {
        if (en && en.health > 0) {
          candidateTargets.push({
            id: en.id,
            x: en.x,
            y: en.y || 1.2,
            z: en.z,
            isDrone: false,
            state: en.state,
            targetFriendlyId: en.targetFriendlyId,
            health: en.health,
          })
        }
      }
      for (const d of (next.drones || [])) {
        if (d && d.isEnemy && d.health > 0) {
          candidateTargets.push({
            id: d.id,
            x: d.x,
            y: d.y || 4.8,
            z: d.z,
            isDrone: true,
            isTargetLocked: d.isTargetLocked,
            targetId: d.targetId,
            health: d.health,
          })
        }
      }

      let bestTarget = null
      let highestThreat = -1

      for (const candidate of candidateTargets) {
        const d = Math.hypot(candidate.x - updated.x, candidate.z - updated.z)
        if (d <= (updated.attackRange || 38)) {
          // Check line of sight against city buildings/obstacles
          if (hasLineOfSight(updated.x, updated.z, candidate.x, candidate.z, obstacles)) {
            const threat = calculateDroneThreatScore(candidate, updated, player, next.friendlyGuards)
            if (threat > highestThreat) {
              highestThreat = threat
              bestTarget = candidate
            }
          }
        }
      }

      if (bestTarget) {
        updated.targetId = bestTarget.id
        updated.targetPos = { x: bestTarget.x, y: bestTarget.y, z: bestTarget.z }
        updated.isTargetLocked = true
        // Orient heading directly toward target
        updated.heading = Math.atan2(bestTarget.x - updated.x, bestTarget.z - updated.z)
      } else {
        updated.targetId = null
        updated.targetPos = null
        updated.isTargetLocked = false
        // Smoothly resume circular patrol orientation
        updated.heading = angle + Math.PI / 2
      }

      // Attack execution when weapon cooldown has elapsed
      if (updated.isTargetLocked && bestTarget && (nowMs - (updated.lastAttackTimeMs || 0) > (updated.attackCooldownMs || 1200))) {
        updated.lastAttackTimeMs = nowMs
        const dx = bestTarget.x - updated.x
        const dz = bestTarget.z - updated.z
        const dist = Math.hypot(dx, dz)
        if (dist > 0.1) {
          const dirX = dx / dist
          const dirZ = dz / dist
          const perpX = -dirZ
          const perpZ = dirX

          // Fire twin high-velocity pulse blaster bolts from actual twin emitter positions (±0.15m)
          ;[-0.15, 0.15].forEach((offset, idx) => {
            newProjectiles.push({
              id: `drone_proj_${nowMs}_${updated.id}_${idx}`,
              droneId: updated.id,
              targetId: bestTarget.id,
              startX: updated.x + perpX * offset,
              startY: updated.y - 0.1,
              startZ: updated.z + perpZ * offset,
              dirX,
              dirZ,
              speed: 55,
              damage: 12,
              isEnemy: false,
              color: '#00f0ff',
              lifetime: 1.4,
              isDroneShot: true,
            })
          })
          audioEvents.push({ type: 'guard_fire' })
        }
      }
    } else {
      // Hostile Drone: Patrols combat airspace and targets player, friendly guards, or friendly sentinels
      const targetX = player.x + Math.sin(nowMs * 0.0007 + updated.orbitOffset) * 18
      const targetZ = player.z + Math.cos(nowMs * 0.0007 + updated.orbitOffset) * 18
      const targetY = 4.8 + Math.sin(nowMs * 0.002 + updated.orbitOffset) * 0.5

      updated.x += (targetX - updated.x) * 0.06
      updated.z += (targetZ - updated.z) * 0.06
      updated.y += (targetY - updated.y) * 0.06

      // Select target among player, friendly guards, and friendly sentinels
      const friendlyCandidates = [
        { id: 'player', x: player.x, y: (player.y || 0) + 1.2, z: player.z }
      ]
      for (const g of (next.friendlyGuards || [])) {
        if (g && g.health > 0) {
          friendlyCandidates.push({ id: g.id, x: g.x, y: (g.y || 0) + 1.2, z: g.z })
        }
      }
      for (const d of (next.drones || [])) {
        if (d && !d.isEnemy && d.health > 0) {
          friendlyCandidates.push({ id: d.id, x: d.x, y: d.y || 4.2, z: d.z })
        }
      }

      let nearestHostileTarget = null
      let nearestHostileDist = updated.detectionRange || 35

      for (const fc of friendlyCandidates) {
        const d = Math.hypot(fc.x - updated.x, fc.z - updated.z)
        if (d <= (updated.attackRange || 28) && d < nearestHostileDist) {
          if (hasLineOfSight(updated.x, updated.z, fc.x, fc.z, obstacles)) {
            nearestHostileDist = d
            nearestHostileTarget = fc
          }
        }
      }

      if (nearestHostileTarget) {
        updated.targetId = nearestHostileTarget.id
        updated.targetPos = { x: nearestHostileTarget.x, y: nearestHostileTarget.y, z: nearestHostileTarget.z }
        updated.isTargetLocked = true
        updated.heading = Math.atan2(nearestHostileTarget.x - updated.x, nearestHostileTarget.z - updated.z)
      } else {
        updated.targetId = null
        updated.targetPos = null
        updated.isTargetLocked = false
        updated.heading = Math.atan2(player.x - updated.x, player.z - updated.z)
      }

      // Hostile drone fires plasma at locked target
      if (updated.isTargetLocked && nearestHostileTarget && (nowMs - (updated.lastAttackTimeMs || 0) > (updated.attackCooldownMs || 2400))) {
        const dx = nearestHostileTarget.x - updated.x
        const dz = nearestHostileTarget.z - updated.z
        const dist = Math.hypot(dx, dz)
        if (dist > 0.1) {
          updated.lastAttackTimeMs = nowMs
          const dirX = dx / dist
          const dirZ = dz / dist
          const perpX = -dirZ
          const perpZ = dirX

          ;[-0.14, 0.14].forEach((offset, idx) => {
            newProjectiles.push({
              id: `en_drone_proj_${nowMs}_${updated.id}_${idx}`,
              droneId: updated.id,
              startX: updated.x + perpX * offset,
              startY: updated.y - 0.1,
              startZ: updated.z + perpZ * offset,
              dirX,
              dirZ,
              speed: 42,
              damage: 10,
              isEnemy: true,
              color: '#ef4444',
              lifetime: 1.5,
              isDroneShot: true,
            })
          })
          audioEvents.push({ type: 'plasma_fire' })
        }
      }
    }

    return updated
  })

  // 9. Victory & Defeat Conditions
  if (player.health <= 0) {
    next.status = 'defeat'
    audioEvents.push({ type: 'defeat' })
  } else {
    // Check mission completion
    const allEnemiesDefeated = updatedEnemies.every((e) => e && e.health <= 0)
    if (allEnemiesDefeated && updatedEnemies.length > 0) {
      next.status = 'victory'
      audioEvents.push({ type: 'victory' })
      recordMissionVictory(next.missionId, next.mission.xpReward, next.mission.creditReward, {
        enemiesDefeated: next.enemiesDefeatedCount,
        isBoss: next.mission.isBossMission,
      })
    }
  }

  next.player = player
  next.equipment = equipment
  next.enemies = updatedEnemies
  next.friendlyGuards = updatedGuards
  next.drones = updatedDrones
  next.projectiles = newProjectiles
  next.missionTimer += dtSeconds
  next.audioEvents = audioEvents

  return next
}
