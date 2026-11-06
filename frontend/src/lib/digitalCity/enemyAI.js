/**
 * CyberShield Ethiopia — Digital City: Intelligent Enemy AI & Tactical Squad System
 *
 * Implements tactical behavior trees, cover utilization, and squad combat for:
 * - Friendly Cyber Guard squad units with 5 tactical commands:
 *   Follow (F1), Defend (F2), Advance/Attack (F3), Fall Back/Regroup (F4), Take Cover (F5)
 * - Hostile military units with cover detection, flanking, and telegraphed combat progression:
 *   Patrol -> Alert -> Flank/Chase -> Aim -> Attack -> Seek Cover -> Retreat/Defeat
 *
 * 100% deterministic (SR-09 compliant: zero Math.random).
 */

import { findNearestCoverPoint } from './cityDistricts.js'

export const AI_STATES = {
  PATROL: 'PATROL',
  ALERT: 'ALERT',
  CHASE: 'CHASE',
  AIM: 'AIM',
  ATTACK: 'ATTACK',
  TAKE_COVER: 'TAKE_COVER',
  HACK_OBJECTIVE: 'HACK_OBJECTIVE',
  RETREAT: 'RETREAT',
  STUNNED: 'STUNNED',
  DEFEATED: 'DEFEATED',
}

export const SQUAD_COMMANDS = {
  FOLLOW: 'FOLLOW',
  DEFEND: 'DEFEND',
  ATTACK_TARGET: 'ATTACK_TARGET',
  ADVANCE: 'ADVANCE',
  FALL_BACK: 'FALL_BACK',
  REGROUP: 'REGROUP',
  TAKE_COVER: 'TAKE_COVER',
}

/**
 * Creates an intelligent enemy unit
 */
export function createEnemyUnit({
  id,
  classId = 'scout_hacker',
  x = 0,
  z = 0,
  y = 0,
  targetDistrictId = 'financial',
  targetObjectiveId = null,
  patrolPoints = [],
  health,
  maxHealth,
  shield,
  maxShield,
  attackCooldownMs,
  speed,
  isBoss,
}) {
  const hp = health !== undefined ? health : 80
  const sh = shield !== undefined ? shield : 30
  const boss = isBoss !== undefined ? !!isBoss : (typeof classId === 'string' && classId.startsWith('boss_'))
  return {
    id,
    classId,
    isBoss: boss,
    x,
    y,
    z,
    vx: 0,
    vz: 0,
    rotationY: 0,
    state: AI_STATES.PATROL,
    stateTimer: 0,
    health: hp,
    maxHealth: maxHealth !== undefined ? maxHealth : hp,
    shield: sh,
    maxShield: maxShield !== undefined ? maxShield : sh,
    speed: speed || 3.4,
    attackCooldownMs: attackCooldownMs || 2500,
    lastAttackTimeMs: 0,
    targetDistrictId,
    targetObjectiveId,
    patrolPoints: patrolPoints.length > 0 ? patrolPoints : [
      { x: x + 10, z: z + 10 },
      { x: x - 10, z: z + 10 },
      { x: x - 10, z: z - 10 },
      { x: x + 10, z: z - 10 },
    ],
    currentPatrolIndex: 0,
    animState: 'patrol',
    inCover: false,
    coverPointId: null,
  }
}

/**
 * Creates a friendly Cyber Guard squad ally
 */
export function createFriendlyGuardUnit({
  id,
  classId = 'cyber_guard_recruit',
  name = 'Alpha-1',
  x = -3,
  z = 3,
  health = 140,
  shield = 100,
  command = SQUAD_COMMANDS.FOLLOW,
}) {
  return {
    id,
    classId,
    name,
    x,
    y: 0,
    z,
    vx: 0,
    vz: 0,
    rotationY: 0,
    health,
    maxHealth: health,
    shield,
    maxShield: shield,
    command,
    formationOffset: { x: (id.includes('alpha') ? -3.5 : 3.5), z: 2.5 },
    defendPoint: null,
    attackTargetId: null,
    lastAttackTimeMs: 0,
    attackCooldownMs: 1400,
    animState: 'idle',
    inCover: false,
    coverPointId: null,
  }
}

/**
 * Updates enemy AI behavior tree tick
 */
export function updateEnemyAITick(enemy, playerPos, friendlyGuards, objectives, dtSeconds, nowMs) {
  if (!enemy || enemy.health <= 0) {
    return { enemy: { ...enemy, state: AI_STATES.DEFEATED, animState: 'defeat' }, attackTarget: null }
  }

  const updated = { ...enemy }
  updated.stateTimer = (updated.stateTimer || 0) + dtSeconds

  // Evaluate candidate friendly targets: player and living friendly squad members
  const validGuards = Array.isArray(friendlyGuards)
    ? friendlyGuards.filter((g) => g && typeof g.health === 'number' && g.health > 0)
    : []

  const candidateFriendlyTargets = [
    { id: 'player', x: playerPos.x, z: playerPos.z, isPlayer: true },
    ...validGuards.map((g) => ({ id: g.id, x: g.x, z: g.z, isPlayer: false })),
  ]

  let closestFriendly = candidateFriendlyTargets[0]
  let distToTarget = Math.hypot(closestFriendly.x - updated.x, closestFriendly.z - updated.z)

  for (let i = 1; i < candidateFriendlyTargets.length; i++) {
    const ft = candidateFriendlyTargets[i]
    const d = Math.hypot(ft.x - updated.x, ft.z - updated.z)
    if (d < distToTarget) {
      distToTarget = d
      closestFriendly = ft
    }
  }

  updated.targetFriendlyId = closestFriendly.id
  const distToPlayer = Math.hypot(playerPos.x - updated.x, playerPos.z - updated.z)
  const attackRange = updated.attackRange || 24
  const detectionRadius = 48

  // 1. Check Stun
  if (updated.stunnedUntilMs && nowMs < updated.stunnedUntilMs) {
    updated.state = AI_STATES.STUNNED
    updated.vx = 0
    updated.vz = 0
    updated.animState = 'stagger'
    return { enemy: updated, attackTarget: null }
  }

  // 2. State Machine Transitions
  if (updated.state === AI_STATES.PATROL) {
    if (distToTarget <= detectionRadius) {
      updated.state = AI_STATES.ALERT
      updated.stateTimer = 0
      updated.vx = 0
      updated.vz = 0
      updated.rotationY = Math.atan2(closestFriendly.x - updated.x, closestFriendly.z - updated.z)
    }
  } else if (updated.state === AI_STATES.ALERT) {
    updated.vx = 0
    updated.vz = 0
    updated.rotationY = Math.atan2(closestFriendly.x - updated.x, closestFriendly.z - updated.z)
    if (updated.stateTimer >= 0.40) {
      updated.state = AI_STATES.CHASE
      updated.stateTimer = 0
    }
  } else if (updated.state === AI_STATES.CHASE) {
    if (distToTarget <= attackRange) {
      updated.state = AI_STATES.AIM
      updated.stateTimer = 0
      updated.vx = 0
      updated.vz = 0
      updated.rotationY = Math.atan2(closestFriendly.x - updated.x, closestFriendly.z - updated.z)
    } else if (distToTarget > detectionRadius * 1.5) {
      updated.state = AI_STATES.PATROL
      updated.stateTimer = 0
    }
  } else if (updated.state === AI_STATES.AIM) {
    updated.vx = 0
    updated.vz = 0
    updated.rotationY = Math.atan2(closestFriendly.x - updated.x, closestFriendly.z - updated.z)
    if (updated.stateTimer >= 0.40) {
      updated.state = AI_STATES.ATTACK
      updated.stateTimer = 0
    }
  } else if (updated.state === AI_STATES.ATTACK) {
    if (updated.health < (updated.maxHealth * 0.35)) {
      updated.state = AI_STATES.TAKE_COVER
      updated.stateTimer = 0
    } else if (updated.stateTimer >= 0.60) {
      if (distToTarget > attackRange) {
        updated.state = AI_STATES.CHASE
      } else {
        updated.state = AI_STATES.AIM
      }
      updated.stateTimer = 0
    }
  } else if (updated.state === AI_STATES.TAKE_COVER) {
    if (updated.stateTimer > 3.0) {
      if (updated.health < updated.maxHealth * 0.20 && (updated.classId === 'scout_hacker' || updated.classId === 'drone_controller')) {
        updated.state = AI_STATES.RETREAT
      } else {
        updated.state = AI_STATES.AIM
      }
      updated.stateTimer = 0
      updated.inCover = false
    }
  } else if (updated.state === AI_STATES.RETREAT) {
    if (updated.stateTimer > 4.5 || distToTarget > 35) {
      updated.state = AI_STATES.PATROL
      updated.stateTimer = 0
    }
  }

  // 3. Movement and Actions Execution
  let moveTarget = null
  let attackTarget = null

  if (updated.state === AI_STATES.PATROL) {
    const currentPt = updated.patrolPoints[updated.currentPatrolIndex % updated.patrolPoints.length]
    if (currentPt) {
      moveTarget = currentPt
      if (Math.hypot(currentPt.x - updated.x, currentPt.z - updated.z) < 2) {
        updated.currentPatrolIndex = (updated.currentPatrolIndex + 1) % updated.patrolPoints.length
      }
    }
    updated.animState = 'patrol'
  } else if (updated.state === AI_STATES.ALERT) {
    moveTarget = null
    updated.animState = 'alert'
  } else if (updated.state === AI_STATES.CHASE) {
    const flankAngle = Math.sin(nowMs * 0.001) * 0.35
    const angle = Math.atan2(closestFriendly.x - updated.x, closestFriendly.z - updated.z) + flankAngle
    moveTarget = {
      x: closestFriendly.x - Math.sin(angle) * (attackRange * 0.7),
      z: closestFriendly.z - Math.cos(angle) * (attackRange * 0.7),
    }
    updated.animState = 'run'
  } else if (updated.state === AI_STATES.AIM) {
    moveTarget = null
    updated.animState = 'aim'
  } else if (updated.state === AI_STATES.ATTACK) {
    attackTarget = closestFriendly
    updated.animState = 'attack'
    const strafeAngle = Math.sin(nowMs * 0.001) * 0.4
    const targetAngle = Math.atan2(closestFriendly.x - updated.x, closestFriendly.z - updated.z) + strafeAngle
    moveTarget = {
      x: updated.x + Math.sin(targetAngle) * 2,
      z: updated.z + Math.cos(targetAngle) * 2,
    }
  } else if (updated.state === AI_STATES.HACK_OBJECTIVE) {
    updated.hackChannelMs = (updated.hackChannelMs || 0) + dtSeconds * 1000
    updated.animState = 'aim'
  } else if (updated.state === AI_STATES.TAKE_COVER) {
    const nearestCover = findNearestCoverPoint(updated.x, updated.z, 28)
    if (nearestCover) {
      const angleToTarget = Math.atan2(closestFriendly.x - nearestCover.x, closestFriendly.z - nearestCover.z)
      moveTarget = {
        x: nearestCover.x - Math.sin(angleToTarget) * 1.5,
        z: nearestCover.z - Math.cos(angleToTarget) * 1.5,
      }
      const distToCover = Math.hypot(moveTarget.x - updated.x, moveTarget.z - updated.z)
      if (distToCover < 1.4) {
        updated.inCover = true
        updated.coverPointId = nearestCover.id
        moveTarget = null
        // Alternate between crouching cover and kneeling peek fire
        updated.animState = (updated.stateTimer % 2.0 < 1.2) ? 'cover' : 'kneeling_fire'
        if (updated.animState === 'kneeling_fire') {
          attackTarget = closestFriendly
        }
      } else {
        updated.animState = 'run'
      }
    } else {
      const awayAngle = Math.atan2(updated.x - closestFriendly.x, updated.z - closestFriendly.z)
      moveTarget = {
        x: updated.x + Math.sin(awayAngle) * 14,
        z: updated.z + Math.cos(awayAngle) * 14,
      }
      updated.animState = 'run'
    }
  } else if (updated.state === AI_STATES.RETREAT) {
    const awayAngle = Math.atan2(updated.x - closestFriendly.x, updated.z - closestFriendly.z)
    moveTarget = {
      x: updated.x + Math.sin(awayAngle) * 25,
      z: updated.z + Math.cos(awayAngle) * 25,
    }
    updated.animState = 'retreat'
  }

  // 4. Movement Execution with Building Obstacle Avoidance
  if (moveTarget) {
    const dx = moveTarget.x - updated.x
    const dz = moveTarget.z - updated.z
    const dist = Math.hypot(dx, dz)
    if (dist > 0.5) {
      const moveSpeed = updated.speed * (updated.state === AI_STATES.RETREAT ? 1.3 : 1.0)
      updated.vx = (dx / dist) * moveSpeed
      updated.vz = (dz / dist) * moveSpeed
      updated.rotationY = Math.atan2(dx, dz)

      let candidateX = updated.x + updated.vx * dtSeconds
      let candidateZ = updated.z + updated.vz * dtSeconds

      // Check collision against obstacle boxes
      const boxes = Array.isArray(objectives) ? objectives : []
      if (boxes.length > 0) {
        const radius = 0.65
        for (const box of boxes) {
          if (box.minX !== undefined && box.maxX !== undefined) {
            if (
              candidateX + radius > box.minX &&
              candidateX - radius < box.maxX &&
              updated.z + radius > box.minZ &&
              updated.z - radius < box.maxZ
            ) {
              candidateX = updated.x
              updated.vx = 0
            }
            if (
              updated.x + radius > box.minX &&
              updated.x - radius < box.maxX &&
              candidateZ + radius > box.minZ &&
              candidateZ - radius < box.maxZ
            ) {
              candidateZ = updated.z
              updated.vz = 0
            }
          }
        }
      }

      updated.x = candidateX
      updated.z = candidateZ
    } else {
      updated.vx = 0
      updated.vz = 0
    }
  } else {
    updated.vx = 0
    updated.vz = 0
  }

  return {
    enemy: updated,
    attackTarget,
    isHacking: updated.state === AI_STATES.HACK_OBJECTIVE,
  }
}

/**
 * Updates friendly Cyber Guard squad ally
 * Supports: FOLLOW, DEFEND, ADVANCE/ATTACK_TARGET, FALL_BACK/REGROUP, TAKE_COVER
 */
export function updateFriendlyGuardTick(guard, playerPos, enemies, arg4 = 0.016, arg5 = 0, arg6 = 0, arg7 = null) {
  if (!guard) return { guard: null, attackTarget: null }
  if (guard.health <= 0) return { guard: { ...guard, animState: 'defeat' }, attackTarget: null }

  let dtSeconds = 0.016
  let nowMs = 0
  let obstacles = []

  if (typeof arg4 === 'number') {
    dtSeconds = arg4
    nowMs = typeof arg5 === 'number' ? arg5 : 0
    obstacles = Array.isArray(arg6) ? arg6 : (Array.isArray(arg7) ? arg7 : [])
  } else if (typeof arg5 === 'number') {
    dtSeconds = arg5
    nowMs = typeof arg6 === 'number' ? arg6 : 0
    obstacles = Array.isArray(arg7) ? arg7 : []
  }

  const updated = { ...guard }
  if (typeof enemies === 'string') {
    updated.command = enemies
  }

  let targetPos = null
  let attackTarget = null

  const isAlpha = (guard.id || '').includes('alpha')
  const isBravo = (guard.id || '').includes('bravo')
  const isCharlie = (guard.id || '').includes('charlie')

  // Dynamic tactical wedge formation offsets
  let formationOffsetX = -4.5
  let formationOffsetZ = 3.0

  if (isBravo) {
    formationOffsetX = 4.5
    formationOffsetZ = 3.0
  } else if (isCharlie) {
    formationOffsetX = 0.0
    formationOffsetZ = 5.5
  } else if (isAlpha) {
    formationOffsetX = -4.5
    formationOffsetZ = 3.0
  } else {
    formationOffsetX = 3.5
    formationOffsetZ = 2.5
  }

  updated.formationOffset = { x: formationOffsetX, z: formationOffsetZ }
  const playerYaw = playerPos.rotationY || 0

  // 1. Calculate Target Position based on Squad Command
  if (updated.command === SQUAD_COMMANDS.FOLLOW) {
    const worldFormationX = playerPos.x + formationOffsetX * Math.cos(playerYaw) - formationOffsetZ * Math.sin(playerYaw)
    const worldFormationZ = playerPos.z + formationOffsetX * Math.sin(playerYaw) + formationOffsetZ * Math.cos(playerYaw)
    const distToFormation = Math.hypot(worldFormationX - updated.x, worldFormationZ - updated.z)
    if (distToFormation > 1.8) {
      targetPos = { x: worldFormationX, z: worldFormationZ }
    }
    updated.inCover = false
  } else if (updated.command === SQUAD_COMMANDS.ADVANCE) {
    // Push forward 18m ahead of player along negative Z with tactical lateral spacing
    const spreadX = isAlpha ? -4.5 : (isBravo ? 4.5 : 0)
    const advanceX = playerPos.x - 18 * Math.sin(playerYaw) + spreadX * Math.cos(playerYaw)
    const advanceZ = playerPos.z - 18 * Math.cos(playerYaw) - spreadX * Math.sin(playerYaw)
    targetPos = { x: advanceX, z: advanceZ }
    updated.inCover = false
  } else if (updated.command === SQUAD_COMMANDS.FALL_BACK || updated.command === SQUAD_COMMANDS.REGROUP) {
    // Fall back 10m behind player to cover withdrawal (+Z) with tactical perimeter spacing
    const fallbackSpreadX = isAlpha ? -3.5 : (isBravo ? 3.5 : 0)
    const fallbackOffsetZ = isCharlie ? 13 : 10
    const fallbackX = playerPos.x + fallbackOffsetZ * Math.sin(playerYaw) + fallbackSpreadX * Math.cos(playerYaw)
    const fallbackZ = playerPos.z + fallbackOffsetZ * Math.cos(playerYaw) - fallbackSpreadX * Math.sin(playerYaw)
    targetPos = { x: fallbackX, z: fallbackZ }
    updated.inCover = false
  } else if (updated.command === SQUAD_COMMANDS.DEFEND) {
    const defendOffsetX = isAlpha ? -5 : (isBravo ? 5 : 0)
    const defendOffsetZ = isCharlie ? -8 : -5
    targetPos = updated.defendPoint || { x: defendOffsetX, z: defendOffsetZ }
    const nearestCover = findNearestCoverPoint(targetPos.x, targetPos.z, 20)
    if (nearestCover) {
      targetPos = { x: nearestCover.x + (isAlpha ? -1.2 : 1.2), z: nearestCover.z + 1.2 }
    }
  } else if (updated.command === SQUAD_COMMANDS.TAKE_COVER) {
    const nearestCover = findNearestCoverPoint(updated.x, updated.z, 30)
    if (nearestCover) {
      const coverSpreadX = isAlpha ? -1.5 : (isBravo ? 1.5 : 0)
      targetPos = { x: nearestCover.x + coverSpreadX, z: nearestCover.z + 1.2 }
    }
  }

  if (targetPos) {
    updated.targetX = targetPos.x
    updated.targetZ = targetPos.z
  }

  // 2. Target Acquisition: find closest hostile threat
  let nearestDist = 48
  const enemyList = Array.isArray(enemies) ? enemies : []
  for (const en of enemyList) {
    if (!en || en.health <= 0) continue
    const d = Math.hypot(en.x - updated.x, en.z - updated.z)
    if (d < nearestDist) {
      nearestDist = d
      attackTarget = en
    }
  }

  if (updated.command === SQUAD_COMMANDS.ATTACK_TARGET && attackTarget) {
    const distToEn = Math.hypot(attackTarget.x - updated.x, attackTarget.z - updated.z)
    if (distToEn > 12) {
      targetPos = { x: attackTarget.x, z: attackTarget.z }
    }
  }

  // 3. Movement Execution & Tactical Stance with Obstacle Avoidance
  if (targetPos) {
    const dx = targetPos.x - updated.x
    const dz = targetPos.z - updated.z
    const dist = Math.hypot(dx, dz)
    if (dist > 1.2) {
      const isSprinting = updated.command === SQUAD_COMMANDS.FALL_BACK || updated.command === SQUAD_COMMANDS.REGROUP || dist > 8
      const speed = isSprinting ? 5.8 : 4.2
      updated.vx = (dx / dist) * speed
      updated.vz = (dz / dist) * speed
      updated.rotationY = Math.atan2(dx, dz)

      let candidateX = updated.x + updated.vx * dtSeconds
      let candidateZ = updated.z + updated.vz * dtSeconds

      // Check collision against obstacles
      if (obstacles && obstacles.length > 0) {
        const radius = 0.65
        for (const box of obstacles) {
          if (box.minX !== undefined && box.maxX !== undefined) {
            if (
              candidateX + radius > box.minX &&
              candidateX - radius < box.maxX &&
              updated.z + radius > box.minZ &&
              updated.z - radius < box.maxZ
            ) {
              candidateX = updated.x
              updated.vx = 0
            }
            if (
              updated.x + radius > box.minX &&
              updated.x - radius < box.maxX &&
              candidateZ + radius > box.minZ &&
              candidateZ - radius < box.maxZ
            ) {
              candidateZ = updated.z
              updated.vz = 0
            }
          }
        }
      }

      updated.x = candidateX
      updated.z = candidateZ
      updated.animState = isSprinting ? 'sprint' : 'run'
    } else {
      updated.vx = 0
      updated.vz = 0
      if (updated.command === SQUAD_COMMANDS.TAKE_COVER || updated.command === SQUAD_COMMANDS.DEFEND) {
        updated.inCover = true
        updated.animState = attackTarget ? 'kneeling_fire' : 'cover'
      } else {
        updated.animState = attackTarget ? 'attack' : 'idle'
      }
      if (attackTarget) {
        updated.rotationY = Math.atan2(attackTarget.x - updated.x, attackTarget.z - updated.z)
      }
    }
  } else {
    updated.vx = 0
    updated.vz = 0
    if (attackTarget) {
      updated.rotationY = Math.atan2(attackTarget.x - updated.x, attackTarget.z - updated.z)
      updated.animState = updated.inCover ? 'kneeling_fire' : 'attack'
    } else {
      updated.animState = updated.inCover ? 'cover' : 'idle'
    }
  }

  return {
    guard: updated,
    attackTarget,
    formationOffset: updated.formationOffset,
    x: updated.x,
    z: updated.z,
  }
}
