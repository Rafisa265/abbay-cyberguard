// CyberShield Ethiopia - 3D Cyber Battle Game Engine (Phase 2)
// Dynamic Attack & Defense Gameplay Engine:
// Real-time deterministic attacker AI, multi-stage attack simulations,
// 3 functional defensive actions (Isolate, Contain, Restore),
// network conduit packet topology, progressive difficulties, and idempotent XP.

import { getJourneyProgress, saveJourneyProgress } from './journey.js'

/**
 * 3D Facility Room Boundaries (Axis-Aligned)
 * Operations center room is 36m x 36m, centered at (0, 0, 0).
 */
export const FACILITY_BOUNDS = {
  minX: -16.5,
  maxX: 16.5,
  minZ: -16.5,
  maxZ: 16.5,
  floorY: 0,
  ceilingY: 5.0,
}

/**
 * Player Physical Dimensions & Movement Specs
 */
export const PLAYER_SPECS = {
  radius: 0.6,
  eyeHeight: 1.7,
  walkSpeed: 5.5,
  sprintMultiplier: 1.75, // 9.625 m/s
  lookSensitivity: 0.0022,
  interactionRange: 3.8,
}

/**
 * Interactive Facility Equipment
 */
export const FACILITY_OBJECTS = [
  // Server Rack Alpha-01 (Directory / Identity Server)
  {
    id: 'srv_alpha_01',
    type: 'server_rack',
    nameKey: 'game.server_alpha',
    position: { x: -6.0, y: 1.5, z: -5.0 },
    size: { x: 1.6, y: 3.0, z: 1.6 },
    interactive: true,
    capabilities: ['CONTAIN', 'ISOLATE', 'RESTORE'],
    diagnosticKey: 'game.server_inspected',
  },
  // Server Rack Beta-02 (Payment & Switch Gateway - Primary Target)
  {
    id: 'srv_beta_02',
    type: 'server_rack',
    nameKey: 'game.server_beta',
    position: { x: 0.0, y: 1.5, z: -5.0 },
    size: { x: 1.6, y: 3.0, z: 1.6 },
    interactive: true,
    capabilities: ['CONTAIN', 'ISOLATE', 'RESTORE'],
    diagnosticKey: 'game.containment_success',
  },
  // Server Rack Gamma-03 (Firewall & IDS Cluster)
  {
    id: 'srv_gamma_03',
    type: 'server_rack',
    nameKey: 'game.server_gamma',
    position: { x: 6.0, y: 1.5, z: -5.0 },
    size: { x: 1.6, y: 3.0, z: 1.6 },
    interactive: true,
    capabilities: ['ISOLATE_ALL', 'CONTAIN', 'RESTORE'],
    diagnosticKey: 'game.server_inspected',
  },
  // Workstation Delta-01 (Security Analyst Console)
  {
    id: 'ws_delta_01',
    type: 'workstation',
    nameKey: 'game.workstation_delta',
    position: { x: -5.0, y: 0.9, z: 4.5 },
    size: { x: 2.4, y: 1.4, z: 1.8 },
    interactive: true,
    capabilities: ['CONTAIN', 'RESTORE'],
    diagnosticKey: 'game.server_inspected',
  },
  // Workstation Epsilon-02 (Network Telemetry & Isolation Station)
  {
    id: 'ws_epsilon_02',
    type: 'workstation',
    nameKey: 'game.workstation_epsilon',
    position: { x: 5.0, y: 0.9, z: 4.5 },
    size: { x: 2.4, y: 1.4, z: 1.8 },
    interactive: true,
    capabilities: ['ISOLATE', 'CONTAIN'],
    diagnosticKey: 'game.server_inspected',
  },
  // Vault Access Airlock Terminal (Perimeter Gateway Entry)
  {
    id: 'sec_door_01',
    type: 'terminal',
    nameKey: 'game.terminal_airlock',
    position: { x: 0.0, y: 1.2, z: -15.8 },
    size: { x: 1.8, y: 2.4, z: 0.8 },
    interactive: true,
    capabilities: ['DIAGNOSE'],
    diagnosticKey: 'game.server_inspected',
  },
]

/**
 * Static Architectural Obstacles
 */
export const STRUCTURAL_OBSTACLES = [
  { id: 'pillar_1', position: { x: -11.0, y: 2.5, z: -10.0 }, size: { x: 1.2, y: 5.0, z: 1.2 } },
  { id: 'pillar_2', position: { x: 11.0, y: 2.5, z: -10.0 }, size: { x: 1.2, y: 5.0, z: 1.2 } },
  { id: 'pillar_3', position: { x: -11.0, y: 2.5, z: 10.0 }, size: { x: 1.2, y: 5.0, z: 1.2 } },
  { id: 'pillar_4', position: { x: 11.0, y: 2.5, z: 10.0 }, size: { x: 1.2, y: 5.0, z: 1.2 } },
]

/**
 * Network Conduit Topology (Paths along which simulated data packets travel)
 */
export const NETWORK_CONDUITS = [
  // Gateway to Firewall/IDS
  { id: 'cond_gw_gamma', from: { x: 0, y: 4.4, z: -15.8 }, to: { x: 6, y: 3.2, z: -5 }, targetServerId: 'srv_gamma_03' },
  // Firewall to Beta-02 (Payment Gateway)
  { id: 'cond_gamma_beta', from: { x: 6, y: 3.2, z: -5 }, to: { x: 0, y: 3.2, z: -5 }, targetServerId: 'srv_beta_02' },
  // Firewall to Alpha-01 (Directory)
  { id: 'cond_gamma_alpha', from: { x: 6, y: 3.2, z: -5 }, to: { x: -6, y: 3.2, z: -5 }, targetServerId: 'srv_alpha_01' },
  // Servers to Monitoring Consoles
  { id: 'cond_alpha_ws1', from: { x: -6, y: 3.2, z: -5 }, to: { x: -5, y: 1.2, z: 4.5 }, targetServerId: 'ws_delta_01' },
  { id: 'cond_beta_ws2', from: { x: 0, y: 3.2, z: -5 }, to: { x: 5, y: 1.2, z: 4.5 }, targetServerId: 'ws_epsilon_02' },
]

/**
 * Difficulty Configurations & Progressive Attack Waves
 */
export const GAME3D_DIFFICULTIES = ['beginner', 'intermediate', 'advanced']

export const DIFFICULTY_CONFIGS = {
  beginner: {
    key: 'beginner',
    nameKey: 'game.diff_beginner',
    xpReward: 50,
    waves: [
      {
        waveNumber: 1,
        targetServerId: 'srv_beta_02',
        probeTime: 8.0,      // Scouting phase
        infiltrateTime: 8.0, // Intrusion phase
        exploitTime: 9.0,    // Critical exploit phase (total ~25s)
      },
    ],
  },
  intermediate: {
    key: 'intermediate',
    nameKey: 'game.diff_intermediate',
    xpReward: 75,
    waves: [
      {
        waveNumber: 1,
        targetServerId: 'srv_beta_02',
        probeTime: 5.0,
        infiltrateTime: 5.0,
        exploitTime: 6.0,
      },
      {
        waveNumber: 2,
        targetServerId: 'srv_alpha_01',
        probeTime: 4.5,
        infiltrateTime: 5.0,
        exploitTime: 5.5,
      },
    ],
  },
  advanced: {
    key: 'advanced',
    nameKey: 'game.diff_advanced',
    xpReward: 100,
    waves: [
      {
        waveNumber: 1,
        targetServerId: 'srv_beta_02',
        probeTime: 3.5,
        infiltrateTime: 3.5,
        exploitTime: 4.5,
      },
      {
        waveNumber: 2,
        targetServerId: 'srv_alpha_01',
        probeTime: 3.5,
        infiltrateTime: 3.5,
        exploitTime: 4.5,
      },
      {
        waveNumber: 3,
        targetServerId: 'srv_gamma_03',
        probeTime: 3.0,
        infiltrateTime: 3.5,
        exploitTime: 4.0,
      },
    ],
  },
}

export const GAME3D_MODES = {
  DEFENDER: 'defender',
  ATTACKER: 'attacker',
  BATTLE: 'battle',
}

export const BATTLE_ROLES = {
  DEFENDER: 'defender',
  ATTACKER: 'attacker',
}

/**
 * Attacker Mode (Red Team Security Audit) Difficulty Configurations
 * Fictional, safe, isolated game simulation of penetration testing workflows.
 */
export const ATTACKER_DIFFICULTY_CONFIGS = {
  beginner: {
    key: 'beginner',
    nameKey: 'game.att_diff_beginner',
    xpReward: 50,
    detectionRate: 2.2, // % per second when within 4.5m of target node
    objectives: [
      {
        id: 'obj_probe_gamma',
        stepNumber: 1,
        targetId: 'srv_gamma_03',
        targetNameKey: 'game.server_gamma',
        requiredAction: 'PROBE',
        actionLabelKey: 'game.action_probe',
        instructionKey: 'game.att_obj_probe_gamma',
        successKey: 'game.att_probe_gamma_success',
      },
      {
        id: 'obj_infiltrate_beta',
        stepNumber: 2,
        targetId: 'srv_beta_02',
        targetNameKey: 'game.server_beta',
        requiredAction: 'INFILTRATE',
        actionLabelKey: 'game.action_infiltrate',
        instructionKey: 'game.att_obj_infiltrate_beta',
        successKey: 'game.att_infiltrate_beta_success',
      },
      {
        id: 'obj_extract_beta',
        stepNumber: 3,
        targetId: 'srv_beta_02',
        targetNameKey: 'game.server_beta',
        requiredAction: 'EXTRACT',
        actionLabelKey: 'game.action_extract',
        instructionKey: 'game.att_obj_extract_beta',
        successKey: 'game.att_extract_beta_success',
      },
    ],
  },
  intermediate: {
    key: 'intermediate',
    nameKey: 'game.att_diff_intermediate',
    xpReward: 75,
    detectionRate: 3.5,
    objectives: [
      {
        id: 'obj_bypass_ids',
        stepNumber: 1,
        targetId: 'ws_epsilon_02',
        targetNameKey: 'game.workstation_epsilon',
        requiredAction: 'BYPASS_IDS',
        actionLabelKey: 'game.action_bypass',
        instructionKey: 'game.att_obj_bypass_ids',
        successKey: 'game.att_bypass_ids_success',
      },
      {
        id: 'obj_probe_alpha',
        stepNumber: 2,
        targetId: 'srv_alpha_01',
        targetNameKey: 'game.server_alpha',
        requiredAction: 'PROBE',
        actionLabelKey: 'game.action_probe',
        instructionKey: 'game.att_obj_probe_alpha',
        successKey: 'game.att_probe_alpha_success',
      },
      {
        id: 'obj_infiltrate_alpha',
        stepNumber: 3,
        targetId: 'srv_alpha_01',
        targetNameKey: 'game.server_alpha',
        requiredAction: 'INFILTRATE',
        actionLabelKey: 'game.action_infiltrate',
        instructionKey: 'game.att_obj_infiltrate_alpha',
        successKey: 'game.att_infiltrate_alpha_success',
      },
      {
        id: 'obj_extract_delta',
        stepNumber: 4,
        targetId: 'ws_delta_01',
        targetNameKey: 'game.workstation_delta',
        requiredAction: 'EXTRACT',
        actionLabelKey: 'game.action_extract',
        instructionKey: 'game.att_obj_extract_delta',
        successKey: 'game.att_extract_delta_success',
      },
    ],
  },
  advanced: {
    key: 'advanced',
    nameKey: 'game.att_diff_advanced',
    xpReward: 100,
    detectionRate: 5.0,
    objectives: [
      {
        id: 'obj_probe_door',
        stepNumber: 1,
        targetId: 'sec_door_01',
        targetNameKey: 'game.terminal_airlock',
        requiredAction: 'PROBE',
        actionLabelKey: 'game.action_probe',
        instructionKey: 'game.att_obj_probe_door',
        successKey: 'game.att_probe_door_success',
      },
      {
        id: 'obj_bypass_gamma',
        stepNumber: 2,
        targetId: 'srv_gamma_03',
        targetNameKey: 'game.server_gamma',
        requiredAction: 'BYPASS_IDS',
        actionLabelKey: 'game.action_bypass',
        instructionKey: 'game.att_obj_bypass_gamma',
        successKey: 'game.att_bypass_gamma_success',
      },
      {
        id: 'obj_infiltrate_alpha',
        stepNumber: 3,
        targetId: 'srv_alpha_01',
        targetNameKey: 'game.server_alpha',
        requiredAction: 'INFILTRATE',
        actionLabelKey: 'game.action_infiltrate',
        instructionKey: 'game.att_obj_infiltrate_alpha',
        successKey: 'game.att_infiltrate_alpha_success',
      },
      {
        id: 'obj_infiltrate_beta',
        stepNumber: 4,
        targetId: 'srv_beta_02',
        targetNameKey: 'game.server_beta',
        requiredAction: 'INFILTRATE',
        actionLabelKey: 'game.action_infiltrate',
        instructionKey: 'game.att_obj_infiltrate_beta',
        successKey: 'game.att_infiltrate_beta_success',
      },
      {
        id: 'obj_extract_ops',
        stepNumber: 5,
        targetId: 'ws_delta_01',
        targetNameKey: 'game.workstation_delta',
        requiredAction: 'EXTRACT',
        actionLabelKey: 'game.action_extract',
        instructionKey: 'game.att_obj_extract_ops',
        successKey: 'game.att_extract_ops_success',
      },
    ],
  },
}

/**
 * Structured Fictional Missions for Defender Mode
 */
export const DEFENDER_MISSIONS = [
  {
    id: 'def_mission_1',
    missionNumber: 1,
    difficultyKey: 'beginner',
    difficulty: 'beginner',
    nameKey: 'game.def_mission_1_name',
    titleKey: 'game.def_mission_1_name',
    descKey: 'game.def_mission_1_desc',
    subtitleKey: 'game.def_mission_1_desc',
    xpReward: 50,
    targetServerId: 'srv_beta_02',
    objectiveKey: 'game.def_mission_1_obj',
    probeTime: 8.0,
    infiltrateTime: 8.0,
    exploitTime: 9.0,
    waves: [
      {
        waveNumber: 1,
        targetServerId: 'srv_beta_02',
        probeTime: 8.0,
        infiltrateTime: 8.0,
        exploitTime: 9.0,
      },
    ],
  },
  {
    id: 'def_mission_2',
    missionNumber: 2,
    difficultyKey: 'intermediate',
    difficulty: 'intermediate',
    nameKey: 'game.def_mission_2_name',
    titleKey: 'game.def_mission_2_name',
    descKey: 'game.def_mission_2_desc',
    subtitleKey: 'game.def_mission_2_desc',
    xpReward: 75,
    targetServerId: 'srv_beta_02',
    lateralTargetId: 'srv_alpha_01',
    isolationNodes: ['srv_gamma_03', 'ws_epsilon_02'],
    objectiveKey: 'game.def_mission_2_obj',
    probeTime: 5.0,
    infiltrateTime: 5.0,
    exploitTime: 6.0,
    waves: [
      {
        waveNumber: 1,
        targetServerId: 'srv_beta_02',
        probeTime: 5.0,
        infiltrateTime: 5.0,
        exploitTime: 6.0,
      },
      {
        waveNumber: 2,
        targetServerId: 'srv_alpha_01',
        probeTime: 5.0,
        infiltrateTime: 5.0,
        exploitTime: 6.0,
      },
    ],
  },
  {
    id: 'def_mission_3',
    missionNumber: 3,
    difficultyKey: 'advanced',
    difficulty: 'advanced',
    nameKey: 'game.def_mission_3_name',
    titleKey: 'game.def_mission_3_name',
    descKey: 'game.def_mission_3_desc',
    subtitleKey: 'game.def_mission_3_desc',
    xpReward: 100,
    compromisedTargetId: 'srv_alpha_01',
    verificationNodeId: 'ws_delta_01',
    objectiveKey: 'game.def_mission_3_obj1',
    secondaryObjectiveKey: 'game.def_mission_3_obj2',
    waves: [
      {
        waveNumber: 1,
        targetServerId: 'srv_alpha_01',
        probeTime: 0,
        infiltrateTime: 0,
        exploitTime: 0,
      },
    ],
  },
]

/**
 * Structured Fictional Missions for Attacker Mode (Red Team Audit)
 */
export const ATTACKER_MISSIONS = [
  {
    id: 'att_mission_1',
    missionNumber: 1,
    difficultyKey: 'beginner',
    difficulty: 'beginner',
    nameKey: 'game.att_mission_1_name',
    titleKey: 'game.att_mission_1_name',
    descKey: 'game.att_mission_1_desc',
    subtitleKey: 'game.att_mission_1_desc',
    xpReward: 50,
    detectionRate: 2.2,
    objectives: [
      {
        id: 'obj_probe_gamma',
        stepNumber: 1,
        targetId: 'srv_gamma_03',
        targetNameKey: 'game.server_gamma',
        requiredAction: 'PROBE',
        actionLabelKey: 'game.action_probe',
        instructionKey: 'game.att_obj_probe_gamma',
        successKey: 'game.att_probe_gamma_success',
      },
      {
        id: 'obj_infiltrate_beta',
        stepNumber: 2,
        targetId: 'srv_beta_02',
        targetNameKey: 'game.server_beta',
        requiredAction: 'INFILTRATE',
        actionLabelKey: 'game.action_infiltrate',
        instructionKey: 'game.att_obj_infiltrate_beta',
        successKey: 'game.att_infiltrate_beta_success',
      },
      {
        id: 'obj_extract_beta',
        stepNumber: 3,
        targetId: 'srv_beta_02',
        targetNameKey: 'game.server_beta',
        requiredAction: 'EXTRACT',
        actionLabelKey: 'game.action_extract',
        instructionKey: 'game.att_obj_extract_beta',
        successKey: 'game.att_extract_beta_success',
      },
    ],
  },
  {
    id: 'att_mission_2',
    missionNumber: 2,
    difficultyKey: 'intermediate',
    difficulty: 'intermediate',
    nameKey: 'game.att_mission_2_name',
    titleKey: 'game.att_mission_2_name',
    descKey: 'game.att_mission_2_desc',
    subtitleKey: 'game.att_mission_2_desc',
    xpReward: 75,
    detectionRate: 3.5,
    objectives: [
      {
        id: 'obj_att2_bypass',
        stepNumber: 1,
        targetId: 'ws_epsilon_02',
        targetNameKey: 'game.workstation_epsilon',
        requiredAction: 'BYPASS_IDS',
        actionLabelKey: 'game.action_bypass',
        instructionKey: 'game.att_obj_bypass_ids',
        successKey: 'game.att_bypass_ids_success',
      },
      {
        id: 'obj_att2_alpha',
        stepNumber: 2,
        targetId: 'srv_alpha_01',
        targetNameKey: 'game.server_alpha',
        requiredAction: 'INFILTRATE',
        actionLabelKey: 'game.action_infiltrate',
        instructionKey: 'game.att_obj_infiltrate_alpha',
        successKey: 'game.att_infiltrate_alpha_success',
      },
      {
        id: 'obj_att2_extract',
        stepNumber: 3,
        targetId: 'ws_delta_01',
        targetNameKey: 'game.workstation_delta',
        requiredAction: 'EXTRACT',
        actionLabelKey: 'game.action_extract',
        instructionKey: 'game.att_obj_extract_delta',
        successKey: 'game.att_extract_delta_success',
      },
    ],
  },
  {
    id: 'att_mission_3',
    missionNumber: 3,
    difficultyKey: 'advanced',
    difficulty: 'advanced',
    nameKey: 'game.att_mission_3_name',
    titleKey: 'game.att_mission_3_name',
    descKey: 'game.att_mission_3_desc',
    subtitleKey: 'game.att_mission_3_desc',
    xpReward: 100,
    detectionRate: 4.8,
    objectives: [
      {
        id: 'obj_att3_door',
        stepNumber: 1,
        targetId: 'sec_door_01',
        targetNameKey: 'game.terminal_airlock',
        requiredAction: 'PROBE',
        actionLabelKey: 'game.action_probe',
        instructionKey: 'game.att_obj_probe_door',
        successKey: 'game.att_probe_door_success',
      },
      {
        id: 'obj_att3_gamma_bypass',
        stepNumber: 2,
        targetId: 'srv_gamma_03',
        targetNameKey: 'game.server_gamma',
        requiredAction: 'BYPASS_IDS',
        actionLabelKey: 'game.action_bypass',
        instructionKey: 'game.att_obj_bypass_gamma',
        successKey: 'game.att_bypass_gamma_success',
      },
      {
        id: 'obj_att3_beta_infil',
        stepNumber: 3,
        targetId: 'srv_beta_02',
        targetNameKey: 'game.server_beta',
        requiredAction: 'INFILTRATE',
        actionLabelKey: 'game.action_infiltrate',
        instructionKey: 'game.att_obj_infiltrate_beta',
        successKey: 'game.att_infiltrate_beta_success',
      },
      {
        id: 'obj_att3_delta_extract',
        stepNumber: 4,
        targetId: 'ws_delta_01',
        targetNameKey: 'game.workstation_delta',
        requiredAction: 'EXTRACT',
        actionLabelKey: 'game.action_extract',
        instructionKey: 'game.att_obj_extract_ops',
        successKey: 'game.att_extract_ops_success',
      },
    ],
  },
]

/**
 * Battle Mode Configurations:
 * Player chooses Defender (Blue Team vs Attacker AI) or Attacker (Red Team vs Defender AI).
 */
export const BATTLE_CONFIGS = {
  beginner: {
    key: 'beginner',
    nameKey: 'game.diff_beginner',
    xpReward: 60,
    duration: 75.0,
    battleDuration: 75.0,
    attackerAi: {
      speedMultiplier: 1.0,
      pivotDelay: 3.5,
      targetSequence: ['srv_beta_02', 'srv_alpha_01', 'srv_delta_04', 'srv_gamma_03'],
      probeTime: 7.0,
      infiltrateTime: 7.0,
      exploitTime: 8.0,
      damageRate: 10.0,
    },
    defenderAi: {
      patrolInterval: 8.0,
      detectionRate: 2.5,
      coolingRate: 1.5,
      patrolNodes: ['srv_beta_02', 'srv_gamma_03', 'ws_epsilon_02', 'srv_alpha_01'],
    },
  },
  intermediate: {
    key: 'intermediate',
    nameKey: 'game.diff_intermediate',
    xpReward: 85,
    duration: 65.0,
    battleDuration: 65.0,
    attackerAi: {
      speedMultiplier: 1.3,
      pivotDelay: 2.8,
      targetSequence: ['srv_beta_02', 'srv_gamma_03', 'srv_alpha_01'],
      probeTime: 5.0,
      infiltrateTime: 5.0,
      exploitTime: 6.0,
      damageRate: 14.0,
    },
    defenderAi: {
      patrolInterval: 6.0,
      detectionRate: 3.8,
      coolingRate: 1.2,
      patrolNodes: ['srv_beta_02', 'srv_alpha_01', 'srv_gamma_03', 'ws_delta_01'],
    },
  },
  advanced: {
    key: 'advanced',
    nameKey: 'game.diff_advanced',
    xpReward: 120,
    duration: 55.0,
    battleDuration: 55.0,
    attackerAi: {
      speedMultiplier: 1.6,
      pivotDelay: 2.0,
      targetSequence: ['srv_beta_02', 'srv_alpha_01', 'srv_gamma_03', 'ws_delta_01'],
      probeTime: 3.5,
      infiltrateTime: 3.5,
      exploitTime: 4.5,
      damageRate: 18.0,
    },
    defenderAi: {
      patrolInterval: 4.5,
      detectionRate: 5.5,
      coolingRate: 1.0,
      patrolNodes: ['srv_beta_02', 'srv_gamma_03', 'ws_epsilon_02', 'srv_alpha_01', 'ws_delta_01'],
    },
  },
}


/**
 * Combines all solid objects into a list of Axis-Aligned Bounding Boxes (AABB)
 */
export function getAllSolidObstacles() {
  const all = [...FACILITY_OBJECTS, ...STRUCTURAL_OBSTACLES]
  return all.map((obj) => {
    const halfX = obj.size.x / 2
    const halfZ = obj.size.z / 2
    return {
      id: obj.id,
      minX: obj.position.x - halfX,
      maxX: obj.position.x + halfX,
      minZ: obj.position.z - halfZ,
      maxZ: obj.position.z + halfZ,
    }
  })
}

/**
 * Checks whether a given (x, z) point with player radius collides with any solid obstacle.
 */
export function isCollidingWithObstacle(x, z, obstacles, playerRadius = PLAYER_SPECS.radius) {
  for (let i = 0; i < obstacles.length; i++) {
    const box = obstacles[i]
    if (
      x + playerRadius > box.minX &&
      x - playerRadius < box.maxX &&
      z + playerRadius > box.minZ &&
      z - playerRadius < box.maxZ
    ) {
      return true
    }
  }
  return false
}

/**
 * Substepped Sliding Collision Resolution:
 * Tests X movement and Z movement independently with small substeps to prevent tunneling.
 */
export function resolveMovement(currentPos, inputVector, deltaSeconds, obstacles, bounds = FACILITY_BOUNDS) {
  const speed = inputVector.isSprint
    ? PLAYER_SPECS.walkSpeed * PLAYER_SPECS.sprintMultiplier
    : PLAYER_SPECS.walkSpeed

  const totalDist = speed * deltaSeconds
  if (totalDist <= 0.00001 || (inputVector.x === 0 && inputVector.z === 0)) {
    return { ...currentPos }
  }

  const length = Math.sqrt(inputVector.x * inputVector.x + inputVector.z * inputVector.z)
  const dirX = inputVector.x / length
  const dirZ = inputVector.z / length

  const r = PLAYER_SPECS.radius
  const maxStep = 0.2
  const numSteps = Math.min(Math.ceil(totalDist / maxStep), 30)
  const stepDist = totalDist / numSteps

  let posX = currentPos.x
  let posZ = currentPos.z

  for (let step = 0; step < numSteps; step++) {
    // 1. Resolve X movement
    let candX = posX + dirX * stepDist
    if (candX - r < bounds.minX) candX = bounds.minX + r
    if (candX + r > bounds.maxX) candX = bounds.maxX - r
    if (!isCollidingWithObstacle(candX, posZ, obstacles, r)) {
      posX = candX
    }

    // 2. Resolve Z movement
    let candZ = posZ + dirZ * stepDist
    if (candZ - r < bounds.minZ) candZ = bounds.minZ + r
    if (candZ + r > bounds.maxZ) candZ = bounds.maxZ - r
    if (!isCollidingWithObstacle(posX, candZ, obstacles, r)) {
      posZ = candZ
    }
  }

  return { x: posX, y: currentPos.y, z: posZ }
}

/**
 * Compute 2D horizontal distance between player position and an object.
 */
export function getDistance2D(pos1, pos2) {
  const dx = pos1.x - pos2.x
  const dz = pos1.z - pos2.z
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Find the nearest interactive object within interaction range.
 */
export function findNearestInteractive(playerPos, interactiveObjects = FACILITY_OBJECTS, maxRange = PLAYER_SPECS.interactionRange) {
  let nearest = null
  let minDistance = maxRange

  for (let i = 0; i < interactiveObjects.length; i++) {
    const obj = interactiveObjects[i]
    if (!obj.interactive) continue

    const dist = getDistance2D(playerPos, obj.position)
    if (dist <= minDistance) {
      minDistance = dist
      nearest = {
        ...obj,
        distance: dist,
      }
    }
  }

  return nearest
}

/**
 * Determine suggested action for Attacker Mode based on current objective
 */
export function getSuggestedActionForAttacker(obj, nodeState, activeObjective) {
  if (!obj) return 'PROBE'
  if (activeObjective && activeObjective.targetId === obj.id) {
    return activeObjective.requiredAction
  }
  if (obj.id === 'srv_gamma_03' || obj.id === 'ws_epsilon_02') {
    return 'BYPASS_IDS'
  }
  return 'PROBE'
}

/**
 * Determine the context-appropriate action for an object based on game mode and state.
 */
export function getSuggestedActionForObject(obj, serverState, gameMode = GAME3D_MODES.DEFENDER, activeObjective = null) {
  if (!obj) return 'DIAGNOSE'

  if (gameMode === GAME3D_MODES.ATTACKER) {
    return getSuggestedActionForAttacker(obj, serverState, activeObjective)
  }

  if (!serverState) return 'DIAGNOSE'

  // If server is currently under active attack (probing, infiltrating, exploiting)
  if (serverState.status === 'under_attack') {
    if (obj.id === 'srv_gamma_03' || obj.id === 'ws_epsilon_02') {
      return 'ISOLATE'
    }
    return 'CONTAIN'
  }

  // If server has been compromised, primary action is to RESTORE
  if (serverState.status === 'compromised') {
    return 'RESTORE'
  }

  // If server is currently isolated, player can restore network connectivity
  if (serverState.isIsolated || serverState.status === 'isolated') {
    return 'RESTORE'
  }

  // If server health is degraded (< 100), restore service
  if (typeof serverState.health === 'number' && serverState.health < 100) {
    return 'RESTORE'
  }

  // Workstations provide global management
  if (obj.id === 'ws_delta_01') return 'CONTAIN'
  if (obj.id === 'ws_epsilon_02') return 'ISOLATE'
  if (obj.id === 'srv_gamma_03') return 'ISOLATE'

  // Core Directory Server Alpha-01 is dedicated to Directory Service Restoration
  if (obj.id === 'srv_alpha_01') return 'RESTORE'

  return 'DIAGNOSE'
}

/**
 * Initialize simulation state for Attacker Mode (Red Team Security Audit).
 */
export function createInitialAttackerSimulationState(difficulty = 'beginner') {
  const config = ATTACKER_DIFFICULTY_CONFIGS[difficulty] || ATTACKER_DIFFICULTY_CONFIGS.beginner

  const nodeStates = {}
  for (const obj of FACILITY_OBJECTS) {
    nodeStates[obj.id] = {
      id: obj.id,
      status: 'normal',
      probed: false,
      infiltrated: false,
      extracted: false,
      isBypassed: false,
    }
  }

  return {
    gameMode: GAME3D_MODES.ATTACKER,
    difficulty: config.key,
    detectionMeter: 0.0,
    defenderAiState: 'patrolling', // 'patrolling' | 'alerted' | 'hunting' | 'lockdown'
    currentObjectiveIndex: 0,
    totalObjectives: config.objectives.length,
    activeObjective: config.objectives[0] ? { ...config.objectives[0] } : null,
    objectives: config.objectives.map((o) => ({ ...o })),
    completedObjectives: [],
    missionStatus: 'playing', // 'playing' | 'victory' | 'failed'
    nodeStates,
    startTime: Date.now(),
    elapsedTime: 0.0,
  }
}

/**
 * Initialize simulation state for Battle Mode Against In-Game AI.
 */
export function createInitialBattleSimulationState(difficulty = 'beginner', battleRole = BATTLE_ROLES.DEFENDER) {
  const config = BATTLE_CONFIGS[difficulty] || BATTLE_CONFIGS.beginner

  if (battleRole === BATTLE_ROLES.ATTACKER) {
    const nodeStates = {}
    for (const obj of FACILITY_OBJECTS) {
      nodeStates[obj.id] = {
        id: obj.id,
        status: 'normal',
        probed: false,
        infiltrated: false,
        extracted: false,
        isBypassed: false,
      }
    }

    const objectives = [
      {
        id: 'bat_obj_1',
        stepNumber: 1,
        targetId: 'srv_gamma_03',
        targetNameKey: 'game.server_gamma',
        requiredAction: 'PROBE',
        actionLabelKey: 'game.action_probe',
        instructionKey: 'game.att_obj_probe_gamma',
        successKey: 'game.att_probe_gamma_success',
      },
      {
        id: 'bat_obj_2',
        stepNumber: 2,
        targetId: 'srv_beta_02',
        targetNameKey: 'game.server_beta',
        requiredAction: 'INFILTRATE',
        actionLabelKey: 'game.action_infiltrate',
        instructionKey: 'game.att_obj_infiltrate_beta',
        successKey: 'game.att_infiltrate_beta_success',
      },
      {
        id: 'bat_obj_3',
        stepNumber: 3,
        targetId: 'ws_delta_01',
        targetNameKey: 'game.workstation_delta',
        requiredAction: 'EXTRACT',
        actionLabelKey: 'game.action_extract',
        instructionKey: 'game.att_obj_extract_ops',
        successKey: 'game.att_extract_ops_success',
      },
    ]

    return {
      gameMode: GAME3D_MODES.BATTLE,
      battleRole: BATTLE_ROLES.ATTACKER,
      difficulty: config.key,
      duration: config.duration,
      battleDuration: config.duration,
      battleTimerRemaining: config.duration,
      battleTimer: config.duration,
      detectionMeter: 0.0,
      opposingAiRole: 'defender',
      opposingAiState: 'patrolling',
      opposingAiTelemetry: 'Defender AI: Patrolling Baseline',
      defenderAiState: 'patrolling',
      defenderAiPatrolIndex: 0,
      defenderAiPatrolTimer: 0.0,
      defenderAiCurrentNode: config.defenderAi.patrolNodes[0],
      defenderAiBlindedTimer: 0.0,
      blindedTimer: 0.0,
      currentObjectiveIndex: 0,
      totalObjectives: objectives.length,
      activeObjective: { ...objectives[0] },
      objectives,
      completedObjectives: [],
      missionStatus: 'playing',
      nodeStates,
      startTime: Date.now(),
      elapsedTime: 0.0,
    }
  }

  // Defender Role vs Attacker AI
  const serverStates = {}
  for (const obj of FACILITY_OBJECTS) {
    serverStates[obj.id] = {
      id: obj.id,
      status: 'normal',
      health: 100,
      isIsolated: false,
      interactedCount: 0,
      lastInteractionAt: null,
    }
  }

  const initialTargetId = config.attackerAi.targetSequence[0] || 'srv_beta_02'
  if (serverStates[initialTargetId]) {
    serverStates[initialTargetId].status = 'under_attack'
  }

  return {
    gameMode: GAME3D_MODES.BATTLE,
    battleRole: BATTLE_ROLES.DEFENDER,
    difficulty: config.key,
    duration: config.duration,
    battleDuration: config.duration,
    battleTimerRemaining: config.duration,
    battleTimer: config.duration,
    facilityIntegrity: 100,
    opposingAiRole: 'attacker',
    opposingAiState: 'probing',
    opposingAiTelemetry: 'Attacker AI: Probing ' + (initialTargetId === 'srv_beta_02' ? 'Payment Gateway Beta-02' : initialTargetId),
    opposingAiTarget: initialTargetId,
    opposingAiTargetIndex: 0,
    opposingAiStage: 'probing',
    opposingAiStageTimer: 0.0,
    opposingAiPivoting: false,
    opposingAiPivotTimer: 0.0,
    pivotCooldown: 0.0,
    isTargetIsolated: false,
    deflectedWaves: 0,
    missionStatus: 'playing',
    serverStates,
    startTime: Date.now(),
    elapsedTime: 0.0,
  }
}

/**
 * Initialize simulation state for a chosen difficulty and mode.
 * Supports missionId and battleRole options.
 */
export function createInitialSimulationState(
  difficulty = 'beginner',
  mode = GAME3D_MODES.DEFENDER,
  battleRoleOrOptions = {},
  missionId = null
) {
  let options = {}
  if (typeof battleRoleOrOptions === 'string') {
    options = { battleRole: battleRoleOrOptions, missionId }
  } else if (typeof battleRoleOrOptions === 'object' && battleRoleOrOptions !== null) {
    options = { ...battleRoleOrOptions }
    if (missionId) options.missionId = missionId
  } else if (missionId) {
    options = { missionId }
  }

  if (mode === GAME3D_MODES.BATTLE) {
    const role = options.battleRole || (options.role === 'attacker' ? BATTLE_ROLES.ATTACKER : BATTLE_ROLES.DEFENDER)
    return createInitialBattleSimulationState(difficulty, role)
  }

  if (mode === GAME3D_MODES.ATTACKER) {
    if (options.missionId) {
      const mission = ATTACKER_MISSIONS.find((m) => m.id === options.missionId)
      if (mission) {
        const nodeStates = {}
        for (const obj of FACILITY_OBJECTS) {
          nodeStates[obj.id] = {
            id: obj.id,
            status: 'normal',
            probed: false,
            infiltrated: false,
            extracted: false,
            isBypassed: false,
          }
        }
        return {
          gameMode: GAME3D_MODES.ATTACKER,
          difficulty: mission.difficultyKey,
          missionId: mission.id,
          activeMission: { ...mission, titleKey: mission.nameKey, subtitleKey: mission.descKey, difficulty: mission.difficultyKey },
          detectionMeter: 0.0,
          defenderAiState: 'patrolling',
          currentObjectiveIndex: 0,
          totalObjectives: mission.objectives.length,
          activeObjective: mission.objectives[0] ? { ...mission.objectives[0] } : null,
          objectives: mission.objectives.map((o) => ({ ...o })),
          completedObjectives: [],
          missionStatus: 'playing',
          nodeStates,
          startTime: Date.now(),
          elapsedTime: 0.0,
        }
      }
    }
    return createInitialAttackerSimulationState(difficulty)
  }

  // Defender Mode: check for specific mission
  if (options.missionId) {
    const mission = DEFENDER_MISSIONS.find((m) => m.id === options.missionId)
    if (mission) {
      const serverStates = {}
      for (const obj of FACILITY_OBJECTS) {
        serverStates[obj.id] = {
          id: obj.id,
          status: 'normal',
          health: 100,
          isIsolated: false,
          interactedCount: 0,
          lastInteractionAt: null,
        }
      }

      if (mission.id === 'def_mission_3') {
        serverStates['srv_alpha_01'].status = 'compromised'
        serverStates['srv_alpha_01'].health = 0
        return {
          gameMode: GAME3D_MODES.DEFENDER,
          difficulty: mission.difficultyKey,
          missionId: mission.id,
          activeMission: { ...mission, titleKey: mission.nameKey, subtitleKey: mission.descKey, difficulty: mission.difficultyKey },
          facilityIntegrity: 65,
          currentWaveIndex: 0,
          totalWaves: mission.waves ? mission.waves.length : 1,
          activeWave: {
            waveNumber: 1,
            targetServerId: 'srv_alpha_01',
            probeTime: 0,
            infiltrateTime: 0,
            exploitTime: 0,
          },
          attackerStage: 'compromised',
          stageTimer: 0.0,
          missionStatus: 'playing',
          serverStates,
          neutralizedWaves: 0,
          totalDefensiveActions: 0,
          startTime: Date.now(),
          elapsedTime: 0.0,
        }
      }

      const targetId = mission.targetServerId || 'srv_beta_02'
      if (serverStates[targetId]) {
        serverStates[targetId].status = 'under_attack'
      }

      return {
        gameMode: GAME3D_MODES.DEFENDER,
        difficulty: mission.difficultyKey,
        missionId: mission.id,
        activeMission: { ...mission, titleKey: mission.nameKey, subtitleKey: mission.descKey, difficulty: mission.difficultyKey },
        facilityIntegrity: 100,
        currentWaveIndex: 0,
        totalWaves: mission.waves ? mission.waves.length : 1,
        activeWave: {
          waveNumber: 1,
          targetServerId: targetId,
          probeTime: mission.probeTime || 6.0,
          infiltrateTime: mission.infiltrateTime || 6.0,
          exploitTime: mission.exploitTime || 7.0,
        },
        attackerStage: 'probing',
        stageTimer: 0.0,
        missionStatus: 'playing',
        serverStates,
        neutralizedWaves: 0,
        totalDefensiveActions: 0,
        startTime: Date.now(),
        elapsedTime: 0.0,
      }
    }
  }

  const config = DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.beginner

  // Initialize server states
  const serverStates = {}
  for (const obj of FACILITY_OBJECTS) {
    serverStates[obj.id] = {
      id: obj.id,
      status: 'normal',
      health: 100,
      isIsolated: false,
      interactedCount: 0,
      lastInteractionAt: null,
    }
  }

  const firstWave = config.waves[0]
  if (firstWave && serverStates[firstWave.targetServerId]) {
    serverStates[firstWave.targetServerId].status = 'under_attack'
  }

  return {
    gameMode: GAME3D_MODES.DEFENDER,
    difficulty: config.key,
    facilityIntegrity: 100,
    currentWaveIndex: 0,
    totalWaves: config.waves.length,
    activeWave: firstWave ? { ...firstWave } : null,
    attackerStage: 'probing',
    stageTimer: 0.0,
    missionStatus: 'playing',
    serverStates,
    neutralizedWaves: 0,
    totalDefensiveActions: 0,
    startTime: Date.now(),
    elapsedTime: 0.0,
  }
}

/**
 * Single step of deterministic attacker AI simulation tick.
 */
function singleSimulationStep(state, deltaSeconds) {
  if (state.missionStatus !== 'playing') {
    return state
  }

  const currentWave = state.activeWave
  if (!currentWave) {
    return state
  }

  const targetId = currentWave.targetServerId
  const server = state.serverStates[targetId]
  if (!server) {
    return state
  }

  let { attackerStage, stageTimer, facilityIntegrity, missionStatus, neutralizedWaves } = state
  stageTimer += deltaSeconds

  const updatedServerStates = { ...state.serverStates }
  const updatedServer = { ...server }

  // 1. If target server is ISOLATED from network, the incoming attack is DEFLECTED / STALLED
  if (updatedServer.isIsolated) {
    if (attackerStage === 'probing' || attackerStage === 'infiltrating' || attackerStage === 'exploiting') {
      attackerStage = 'deflected'
      neutralizedWaves += 1
      updatedServer.status = 'isolated'

      // Advance to next wave or declare victory
      const nextWaveIdx = state.currentWaveIndex + 1
      const config = DIFFICULTY_CONFIGS[state.difficulty]

      if (nextWaveIdx < config.waves.length) {
        const nextWave = config.waves[nextWaveIdx]
        const nextTarget = updatedServerStates[nextWave.targetServerId]
        if (nextTarget && !nextTarget.isIsolated && nextTarget.status !== 'compromised') {
          nextTarget.status = 'under_attack'
        }
        return {
          ...state,
          attackerStage: 'probing',
          stageTimer: 0,
          currentWaveIndex: nextWaveIdx,
          activeWave: { ...nextWave },
          neutralizedWaves,
          serverStates: updatedServerStates,
          elapsedTime: state.elapsedTime + deltaSeconds,
        }
      } else {
        // All waves neutralized
        missionStatus = 'victory'
        return {
          ...state,
          attackerStage: 'deflected',
          missionStatus: 'victory',
          neutralizedWaves,
          serverStates: updatedServerStates,
          elapsedTime: state.elapsedTime + deltaSeconds,
        }
      }
    }
  }

  // 2. Normal Attacker AI Stage Progression (Probing -> Infiltrating -> Exploiting -> Compromised)
  if (attackerStage === 'probing') {
    updatedServer.status = 'under_attack'
    if (stageTimer >= currentWave.probeTime) {
      attackerStage = 'infiltrating'
      stageTimer = 0
    }
  } else if (attackerStage === 'infiltrating') {
    updatedServer.status = 'under_attack'
    // Minor health degradation during intrusion
    updatedServer.health = Math.max(0, updatedServer.health - deltaSeconds * 2)
    if (stageTimer >= currentWave.infiltrateTime) {
      attackerStage = 'exploiting'
      stageTimer = 0
    }
  } else if (attackerStage === 'exploiting') {
    updatedServer.status = 'under_attack'
    // Severe health degradation during critical exploit
    updatedServer.health = Math.max(0, updatedServer.health - deltaSeconds * 12)
    facilityIntegrity = Math.max(0, facilityIntegrity - deltaSeconds * 4)

    if (stageTimer >= currentWave.exploitTime) {
      attackerStage = 'compromised'
      updatedServer.status = 'compromised'
      updatedServer.health = 0
      facilityIntegrity = Math.max(0, facilityIntegrity - 25)
      stageTimer = 0

      // Advance to next wave if any remain
      const nextWaveIdx = state.currentWaveIndex + 1
      const config = DIFFICULTY_CONFIGS[state.difficulty]
      if (nextWaveIdx < config.waves.length) {
        const nextWave = config.waves[nextWaveIdx]
        const nextTarget = updatedServerStates[nextWave.targetServerId]
        if (nextTarget && !nextTarget.isIsolated) {
          nextTarget.status = 'under_attack'
        }
        return {
          ...state,
          attackerStage: 'probing',
          stageTimer: 0,
          currentWaveIndex: nextWaveIdx,
          activeWave: { ...nextWave },
          facilityIntegrity,
          serverStates: updatedServerStates,
          elapsedTime: state.elapsedTime + deltaSeconds,
        }
      }
    }
  }

  updatedServerStates[targetId] = updatedServer

  // Check facility failure
  if (facilityIntegrity <= 0) {
    missionStatus = 'failed'
  }

  return {
    ...state,
    attackerStage,
    stageTimer,
    facilityIntegrity,
    missionStatus,
    neutralizedWaves,
    serverStates: updatedServerStates,
    elapsedTime: state.elapsedTime + deltaSeconds,
  }
}

/**
 * Single step of deterministic Defender AI in Attacker Mode.
 * Tracks player proximity to target nodes and accretes/cools down detection.
 */
function singleAttackerSimulationStep(state, deltaSeconds, playerPos = null) {
  if (!state || state.missionStatus !== 'playing') {
    return state
  }

  const config = ATTACKER_DIFFICULTY_CONFIGS[state.difficulty] || ATTACKER_DIFFICULTY_CONFIGS.beginner
  let { detectionMeter, defenderAiState, missionStatus, elapsedTime } = state
  elapsedTime += deltaSeconds

  const activeObj = state.activeObjective
  const targetObj = activeObj ? FACILITY_OBJECTS.find((o) => o.id === activeObj.targetId) : null

  let inDetectionZone = false
  if (playerPos && targetObj) {
    const dx = playerPos.x - targetObj.position.x
    const dz = playerPos.z - targetObj.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    // Within 4.8m of target node increases detection
    if (dist <= 4.8) {
      inDetectionZone = true
    }
  } else {
    // If no playerPos provided (e.g. unit test step), active objective generates baseline detection
    inDetectionZone = true
  }

  if (inDetectionZone) {
    detectionMeter = Math.min(100, detectionMeter + config.detectionRate * deltaSeconds)
  } else {
    // Cool down detection if player keeps stealth distance
    detectionMeter = Math.max(0, detectionMeter - 1.2 * deltaSeconds)
  }

  // Defender AI state transitions
  if (detectionMeter >= 100) {
    detectionMeter = 100
    defenderAiState = 'lockdown'
    missionStatus = 'failed'
  } else if (detectionMeter >= 75) {
    defenderAiState = 'hunting'
  } else if (detectionMeter >= 40) {
    defenderAiState = 'alerted'
  } else {
    defenderAiState = 'patrolling'
  }

  return {
    ...state,
    detectionMeter,
    defenderAiState,
    missionStatus,
    elapsedTime,
  }
}

/**
 * Update real-time Attacker Mode simulation tick with Defender AI in 0.1s substeps.
 */
export function updateAttackerSimulationTick(state, deltaSeconds, playerPos = null) {
  if (!state || state.missionStatus !== 'playing') {
    return state
  }
  if (!deltaSeconds || deltaSeconds <= 0) {
    return state
  }

  const SUBSTEP = 0.1
  let remaining = deltaSeconds
  let currentState = state

  while (remaining > 0.0001 && currentState.missionStatus === 'playing') {
    const dt = Math.min(remaining, SUBSTEP)
    currentState = singleAttackerSimulationStep(currentState, dt, playerPos)
    remaining -= dt
  }

  return currentState
}

/**
 * Single step of Battle Mode simulation tick (deterministic opposing AI).
 */
export function singleBattleStep(state, deltaSeconds, playerPos = null) {
  if (!state || state.missionStatus !== 'playing') return state

  const config = BATTLE_CONFIGS[state.difficulty] || BATTLE_CONFIGS.beginner
  const currentTimer = typeof state.battleTimer === 'number' && state.battleTimer < (state.battleTimerRemaining ?? 9999)
    ? state.battleTimer
    : (typeof state.battleTimerRemaining === 'number' ? state.battleTimerRemaining : config.duration)
  let battleTimerRemaining = Math.max(0, currentTimer - deltaSeconds)
  let elapsedTime = state.elapsedTime + deltaSeconds
  let missionStatus = state.missionStatus

  // 1. ROLE: ATTACKER (Red Team vs Defender AI)
  if (state.battleRole === BATTLE_ROLES.ATTACKER) {
    let { detectionMeter, defenderAiState, defenderAiPatrolIndex, defenderAiPatrolTimer, defenderAiBlindedTimer } = state

    // If timer ran out before completing all objectives -> failed
    if (battleTimerRemaining <= 0) {
      return {
        ...state,
        battleTimerRemaining: 0,
        battleTimer: 0,
        missionStatus: 'failed',
        elapsedTime,
      }
    }

    // Handle Defender AI Blinded Timer from BYPASS_IDS
    if (defenderAiBlindedTimer > 0) {
      defenderAiBlindedTimer = Math.max(0, defenderAiBlindedTimer - deltaSeconds)
      detectionMeter = Math.max(0, detectionMeter - config.defenderAi.coolingRate * deltaSeconds * 1.5)
      defenderAiState = 'patrolling'
    } else {
      // Defender AI Patrol Navigation
      defenderAiPatrolTimer += deltaSeconds
      let currentNode = state.defenderAiCurrentNode
      if (defenderAiPatrolTimer >= config.defenderAi.patrolInterval) {
        defenderAiPatrolTimer = 0.0
        const patrolNodes = config.defenderAi.patrolNodes
        defenderAiPatrolIndex = (defenderAiPatrolIndex + 1) % patrolNodes.length
        currentNode = patrolNodes[defenderAiPatrolIndex]
      }

      // Proximity detection check
      const targetObj = state.activeObjective ? FACILITY_OBJECTS.find((o) => o.id === state.activeObjective.targetId) : null
      const patrolObj = FACILITY_OBJECTS.find((o) => o.id === currentNode)

      let closeToPatrol = false
      let closeToTarget = false

      if (playerPos) {
        if (patrolObj) {
          const dx = playerPos.x - patrolObj.position.x
          const dz = playerPos.z - patrolObj.position.z
          if (Math.sqrt(dx * dx + dz * dz) <= 5.0) closeToPatrol = true
        }
        if (targetObj) {
          const dx = playerPos.x - targetObj.position.x
          const dz = playerPos.z - targetObj.position.z
          if (Math.sqrt(dx * dx + dz * dz) <= 4.8) closeToTarget = true
        }
      } else {
        closeToTarget = true
      }

      if (closeToPatrol) {
        detectionMeter = Math.min(100, detectionMeter + config.defenderAi.detectionRate * 1.5 * deltaSeconds)
      } else if (closeToTarget) {
        detectionMeter = Math.min(100, detectionMeter + config.defenderAi.detectionRate * deltaSeconds)
      } else {
        detectionMeter = Math.max(0, detectionMeter - config.defenderAi.coolingRate * deltaSeconds)
      }

      if (detectionMeter >= 100) {
        detectionMeter = 100
        defenderAiState = 'lockdown'
        missionStatus = 'failed'
      } else if (detectionMeter >= 75) {
        defenderAiState = 'hunting'
      } else if (detectionMeter >= 40) {
        defenderAiState = 'alerted'
      } else {
        defenderAiState = 'patrolling'
      }
    }

    const isBlinded = defenderAiBlindedTimer > 0
    const finalMissionStatus = state.currentObjectiveIndex >= state.objectives.length ? 'victory' : missionStatus

    return {
      ...state,
      battleTimerRemaining,
      battleTimer: battleTimerRemaining,
      detectionMeter,
      defenderAiState,
      opposingAiRole: 'defender',
      opposingAiState: isBlinded ? 'blinded' : defenderAiState,
      opposingAiTelemetry: isBlinded ? 'blinded' : defenderAiState,
      defenderAiPatrolIndex,
      defenderAiPatrolTimer,
      defenderAiCurrentNode: state.defenderAiCurrentNode,
      defenderAiBlindedTimer,
      blindedTimer: defenderAiBlindedTimer,
      missionStatus: finalMissionStatus,
      elapsedTime,
    }
  }

  // 2. ROLE: DEFENDER (Blue Team vs Attacker AI)
  let {
    facilityIntegrity,
    opposingAiTarget,
    opposingAiTargetIndex,
    opposingAiStage,
    opposingAiStageTimer,
    opposingAiPivoting,
    opposingAiPivotTimer,
    deflectedWaves,
  } = state

  const serverStates = { ...state.serverStates }
  const currentTargetServer = { ...(serverStates[opposingAiTarget] || { id: opposingAiTarget, status: 'normal', health: 100 }) }

  // Check survival victory condition: timer reaches 0 with facility integrity > 0
  if (battleTimerRemaining <= 0) {
    if (facilityIntegrity > 0) {
      return {
        ...state,
        battleTimerRemaining: 0,
        battleTimer: 0,
        missionStatus: 'victory',
        elapsedTime,
      }
    } else {
      return {
        ...state,
        battleTimerRemaining: 0,
        battleTimer: 0,
        missionStatus: 'failed',
        elapsedTime,
      }
    }
  }

  // AI Pivot Handling (when player isolated or contained the active target)
  if (opposingAiPivoting) {
    opposingAiPivotTimer += deltaSeconds
    if (opposingAiPivotTimer >= config.attackerAi.pivotDelay) {
      opposingAiPivoting = false
      opposingAiPivotTimer = 0.0
      opposingAiStageTimer = 0.0
      opposingAiStage = 'probing'

      // Advance to next target in sequence
      const seq = config.attackerAi.targetSequence
      opposingAiTargetIndex = (opposingAiTargetIndex + 1) % seq.length
      opposingAiTarget = seq[opposingAiTargetIndex]
      const nextServer = { ...(serverStates[opposingAiTarget] || { id: opposingAiTarget, status: 'normal', health: 100 }) }
      if (!nextServer.isIsolated && nextServer.status !== 'compromised') {
        nextServer.status = 'under_attack'
      }
      serverStates[opposingAiTarget] = nextServer
    }

    const pivotCooldown = Math.max(0, (config.attackerAi?.pivotDelay || 3.5) - opposingAiPivotTimer)
    return {
      ...state,
      battleTimerRemaining,
      battleTimer: battleTimerRemaining,
      opposingAiTarget,
      opposingAiTargetIndex,
      opposingAiStage,
      opposingAiStageTimer,
      opposingAiPivoting,
      opposingAiPivotTimer,
      opposingAiRole: 'attacker',
      opposingAiState: opposingAiPivoting ? 'pivoting' : opposingAiStage,
      pivotCooldown,
      opposingAiTelemetry: 'pivoting',
      isTargetIsolated: opposingAiPivoting ? true : Boolean(serverStates[opposingAiTarget]?.isIsolated),
      facilityIntegrity,
      missionStatus,
      serverStates,
      elapsedTime,
    }
  }

  // Normal Attacker AI Stage Progression
  opposingAiStageTimer += deltaSeconds

  if (opposingAiStage === 'probing') {
    currentTargetServer.status = 'under_attack'
    if (opposingAiStageTimer >= config.attackerAi.probeTime) {
      opposingAiStage = 'infiltrating'
      opposingAiStageTimer = 0.0
    }
  } else if (opposingAiStage === 'infiltrating') {
    currentTargetServer.status = 'under_attack'
    currentTargetServer.health = Math.max(0, currentTargetServer.health - deltaSeconds * 3)
    if (opposingAiStageTimer >= config.attackerAi.infiltrateTime) {
      opposingAiStage = 'exploiting'
      opposingAiStageTimer = 0.0
    }
  } else if (opposingAiStage === 'exploiting') {
    currentTargetServer.status = 'under_attack'
    currentTargetServer.health = Math.max(0, currentTargetServer.health - deltaSeconds * config.attackerAi.damageRate)
    facilityIntegrity = Math.max(0, facilityIntegrity - deltaSeconds * 5.0)

    if (opposingAiStageTimer >= config.attackerAi.exploitTime) {
      currentTargetServer.status = 'compromised'
      currentTargetServer.health = 0
      facilityIntegrity = Math.max(0, facilityIntegrity - 20)
      // Node was compromised -> trigger pivot to next node
      opposingAiPivoting = true
      opposingAiPivotTimer = 0.0
    }
  }

  serverStates[opposingAiTarget] = currentTargetServer

  if (facilityIntegrity <= 0) {
    facilityIntegrity = 0
    missionStatus = 'failed'
  }

  return {
    ...state,
    battleTimerRemaining,
    battleTimer: battleTimerRemaining,
    opposingAiTarget,
    opposingAiTargetIndex,
    opposingAiStage,
    opposingAiStageTimer,
    opposingAiPivoting,
    opposingAiPivotTimer,
    opposingAiRole: 'attacker',
    opposingAiState: opposingAiPivoting ? 'pivoting' : opposingAiStage,
    pivotCooldown: 0,
    opposingAiTelemetry: opposingAiPivoting ? 'pivoting' : opposingAiStage,
    isTargetIsolated: Boolean(serverStates[opposingAiTarget]?.isIsolated),
    deflectedWaves,
    facilityIntegrity,
    missionStatus,
    serverStates,
    elapsedTime,
  }
}

/**
 * Update real-time Battle Mode simulation tick with 0.1s substeps.
 */
export function updateBattleSimulationTick(state, deltaSeconds, playerPos = null) {
  if (!state || state.missionStatus !== 'playing') {
    return state
  }
  if (!deltaSeconds || deltaSeconds <= 0) {
    return state
  }

  const SUBSTEP = 0.1
  let remaining = deltaSeconds
  let currentState = state

  while (remaining > 0.0001 && currentState.missionStatus === 'playing') {
    const dt = Math.min(remaining, SUBSTEP)
    currentState = singleBattleStep(currentState, dt, playerPos)
    remaining -= dt
  }

  return currentState
}

/**
 * Update real-time simulation tick (dispatches by game mode: Defender, Attacker, or Battle).
 * Substeps in 0.1s increments so multi-second steps or framerate dips advance reliably.
 */
export function updateSimulationTick(state, deltaSeconds, playerPos = null) {
  if (!state || state.missionStatus !== 'playing') {
    return state
  }
  if (!deltaSeconds || deltaSeconds <= 0) {
    return state
  }

  if (state.gameMode === GAME3D_MODES.BATTLE) {
    return updateBattleSimulationTick(state, deltaSeconds, playerPos)
  }

  if (state.gameMode === GAME3D_MODES.ATTACKER) {
    return updateAttackerSimulationTick(state, deltaSeconds, playerPos)
  }

  const SUBSTEP = 0.1
  let remaining = deltaSeconds
  let currentState = state

  while (remaining > 0.0001 && currentState.missionStatus === 'playing') {
    const dt = Math.min(remaining, SUBSTEP)
    currentState = singleSimulationStep(currentState, dt)
    remaining -= dt
  }

  return currentState
}

/**
 * Execute a functional defensive action (Isolate, Contain, Restore, or Diagnose)
 */
export function executeDefensiveAction(state, targetId, explicitAction = null) {
  const obj = FACILITY_OBJECTS.find((o) => o.id === targetId)
  if (!obj) {
    return { state, success: false, messageKey: 'game.server_inspected' }
  }

  const server = state.serverStates[targetId] || {
    id: targetId,
    status: 'normal',
    health: 100,
    isIsolated: false,
    interactedCount: 0,
  }

  const action = explicitAction || getSuggestedActionForObject(obj, server)
  const updatedServerStates = { ...state.serverStates }
  const updatedServer = { ...server, interactedCount: server.interactedCount + 1, lastInteractionAt: Date.now() }

  let newFacilityIntegrity = state.facilityIntegrity
  let newAttackerStage = state.attackerStage
  let newNeutralizedWaves = state.neutralizedWaves
  let newMissionStatus = state.missionStatus
  let messageKey = 'game.server_inspected'

  // ACTION 1: ISOLATE NETWORK
  if (action === 'ISOLATE' || action === 'ISOLATE_ALL') {
    // If performed at Firewall or Network Station, isolate active target server
    const targetToIsolate = (obj.id === 'srv_gamma_03' || obj.id === 'ws_epsilon_02')
      ? (state.activeWave?.targetServerId || targetId)
      : targetId

    const srv = updatedServerStates[targetToIsolate] || updatedServer
    srv.isIsolated = true
    srv.status = 'isolated'
    updatedServerStates[targetToIsolate] = srv

    // Deflect active attack
    if (state.activeWave?.targetServerId === targetToIsolate && newAttackerStage !== 'compromised') {
      newAttackerStage = 'deflected'
      newNeutralizedWaves += 1
      messageKey = 'game.action_isolate_success'

      if (state.missionId === 'def_mission_2') {
        newMissionStatus = 'victory'
      }
    } else if (state.missionId === 'def_mission_2' && (obj.id === 'srv_gamma_03' || obj.id === 'ws_epsilon_02')) {
      newAttackerStage = 'deflected'
      newNeutralizedWaves += 1
      newMissionStatus = 'victory'
      messageKey = 'game.action_isolate_success'
    } else {
      messageKey = 'game.action_isolate_ready'
    }
  }

  // ACTION 2: CONTAIN THREAT
  else if (action === 'CONTAIN') {
    const targetToContain = (obj.id === 'ws_delta_01')
      ? (state.activeWave?.targetServerId || targetId)
      : targetId

    const srv = updatedServerStates[targetToContain] || updatedServer
    srv.status = 'contained'
    srv.health = Math.max(srv.health, 90)
    updatedServerStates[targetToContain] = srv

    if (state.activeWave?.targetServerId === targetToContain) {
      newAttackerStage = 'deflected'
      newNeutralizedWaves += 1
      newFacilityIntegrity = Math.min(100, newFacilityIntegrity + 15)
      messageKey = 'game.containment_success'

      if (state.missionId === 'def_mission_1') {
        newMissionStatus = 'victory'
      } else {
        // Advance wave or victory
        const nextWaveIdx = state.currentWaveIndex + 1
        const config = DIFFICULTY_CONFIGS[state.difficulty]
        if (config && nextWaveIdx >= config.waves.length) {
          newMissionStatus = 'victory'
        }
      }
    } else if (state.missionId === 'def_mission_3' && obj.id === 'ws_delta_01' && updatedServerStates['srv_alpha_01']?.status === 'normal') {
      newMissionStatus = 'victory'
      newFacilityIntegrity = 100
      messageKey = 'game.containment_success'
    } else {
      messageKey = 'game.server_inspected'
    }
  }

  // ACTION 3: RESTORE SERVICE
  else if (action === 'RESTORE') {
    const targetToRestore = targetId
    const srv = updatedServerStates[targetToRestore] || updatedServer
    srv.status = 'normal'
    srv.health = 100
    srv.isIsolated = false
    updatedServerStates[targetToRestore] = srv

    newFacilityIntegrity = Math.min(100, newFacilityIntegrity + 25)
    messageKey = 'game.action_restore_success'

    if (state.missionId === 'def_mission_3' && targetId === 'srv_alpha_01') {
      newFacilityIntegrity = Math.min(100, newFacilityIntegrity + 25)
    }
  }

  // ACTION 4: DIAGNOSE
  else {
    if (state.missionId === 'def_mission_3' && obj.id === 'ws_delta_01' && updatedServerStates['srv_alpha_01']?.status === 'normal') {
      newMissionStatus = 'victory'
      newFacilityIntegrity = 100
      messageKey = 'game.containment_success'
    } else {
      messageKey = 'game.server_inspected'
    }
  }

  const newState = {
    ...state,
    attackerStage: newAttackerStage,
    facilityIntegrity: newFacilityIntegrity,
    neutralizedWaves: newNeutralizedWaves,
    missionStatus: newMissionStatus,
    serverStates: updatedServerStates,
    totalDefensiveActions: state.totalDefensiveActions + 1,
  }

  return {
    state: newState,
    success: true,
    action,
    targetId,
    targetNameKey: obj.nameKey,
    messageKey,
  }
}

/**
 * Execute an in-game simulated action in Attacker Mode (Red Team Security Audit).
 * Handles PROBE, INFILTRATE, EXTRACT, and BYPASS_IDS tactics safely inside the local engine.
 */
export function executeAttackerAction(state, targetId, explicitAction = null) {
  const obj = FACILITY_OBJECTS.find((o) => o.id === targetId)
  if (!obj) {
    return { state, success: false, messageKey: 'game.server_inspected' }
  }

  const activeObj = state.activeObjective
  const nodeStates = { ...state.nodeStates }
  const currentNodeState = { ...(nodeStates[targetId] || { id: targetId, status: 'normal' }) }

  const action = explicitAction || getSuggestedActionForAttacker(obj, currentNodeState, activeObj)
  let { detectionMeter, currentObjectiveIndex, defenderAiState, missionStatus, completedObjectives } = state
  let success = false
  let messageKey = 'game.att_target_mismatch'

  // BYPASS IDS Action (Defensive countermeasure evasion at firewall or network consoles)
  if (action === 'BYPASS_IDS') {
    if (obj.id === 'srv_gamma_03' || obj.id === 'ws_epsilon_02') {
      detectionMeter = Math.max(0, detectionMeter - 20)
      currentNodeState.isBypassed = true
      nodeStates[targetId] = currentNodeState
      success = true
      messageKey = 'game.att_action_bypass_success'

      // If active objective requested BYPASS_IDS at this node, complete it
      if (activeObj && activeObj.requiredAction === 'BYPASS_IDS' && activeObj.targetId === targetId) {
        completedObjectives = [...completedObjectives, activeObj.id]
        currentObjectiveIndex += 1
        messageKey = activeObj.successKey || 'game.att_action_bypass_success'
      }
    } else {
      detectionMeter = Math.min(100, detectionMeter + 8)
      messageKey = 'game.att_target_mismatch'
    }
  } else if (activeObj && activeObj.targetId === targetId && activeObj.requiredAction === action) {
    // Correct target and required action for the active objective!
    success = true
    messageKey = activeObj.successKey
    completedObjectives = [...completedObjectives, activeObj.id]

    if (action === 'PROBE') {
      currentNodeState.probed = true
      currentNodeState.status = 'probed'
    } else if (action === 'INFILTRATE') {
      currentNodeState.infiltrated = true
      currentNodeState.status = 'infiltrated'
    } else if (action === 'EXTRACT') {
      currentNodeState.extracted = true
      currentNodeState.status = 'extracted'
    }
    nodeStates[targetId] = currentNodeState

    // Action execution noise raises detection meter moderately
    detectionMeter = Math.min(100, detectionMeter + 6)
    currentObjectiveIndex += 1
  } else {
    // Mismatched target or action
    detectionMeter = Math.min(100, detectionMeter + 8)
    messageKey = 'game.att_target_mismatch'
  }

  // Check victory / failure conditions
  const nextActiveObj = state.objectives[currentObjectiveIndex] || null
  if (currentObjectiveIndex >= state.objectives.length) {
    missionStatus = 'victory'
  } else if (detectionMeter >= 100) {
    detectionMeter = 100
    defenderAiState = 'lockdown'
    missionStatus = 'failed'
  } else if (detectionMeter >= 75) {
    defenderAiState = 'hunting'
  } else if (detectionMeter >= 40) {
    defenderAiState = 'alerted'
  } else {
    defenderAiState = 'patrolling'
  }

  const updatedState = {
    ...state,
    detectionMeter,
    defenderAiState,
    currentObjectiveIndex,
    activeObjective: nextActiveObj,
    completedObjectives,
    missionStatus,
    nodeStates,
  }

  return {
    state: updatedState,
    success,
    action,
    targetId,
    targetNameKey: obj.nameKey,
    messageKey,
  }
}

/**
 * Execute Battle Mode defensive action (Player: Blue Team vs Attacker AI)
 */
export function executeBattleDefenderAction(state, targetId, explicitAction = null) {
  const obj = FACILITY_OBJECTS.find((o) => o.id === targetId)
  if (!obj) {
    return { state, success: false, messageKey: 'game.server_inspected' }
  }

  const server = state.serverStates[targetId] || {
    id: targetId,
    status: 'normal',
    health: 100,
    isIsolated: false,
    interactedCount: 0,
  }

  const action = explicitAction || getSuggestedActionForObject(obj, server)
  const updatedServerStates = { ...state.serverStates }
  const updatedServer = { ...server, interactedCount: server.interactedCount + 1, lastInteractionAt: Date.now() }

  let newFacilityIntegrity = state.facilityIntegrity
  let deflectedWaves = state.deflectedWaves || 0
  let opposingAiPivoting = state.opposingAiPivoting
  let opposingAiPivotTimer = state.opposingAiPivotTimer
  let messageKey = 'game.server_inspected'

  // ACTION 1: ISOLATE NETWORK
  if (action === 'ISOLATE' || action === 'ISOLATE_ALL') {
    const targetToIsolate = (obj.id === 'srv_gamma_03' || obj.id === 'ws_epsilon_02')
      ? (state.opposingAiTarget || targetId)
      : targetId

    const srv = updatedServerStates[targetToIsolate] || updatedServer
    srv.isIsolated = true
    srv.status = 'isolated'
    updatedServerStates[targetToIsolate] = srv

    opposingAiPivoting = true
    opposingAiPivotTimer = 0.0
    deflectedWaves += 1
    messageKey = 'game.action_isolate_success'
  }

  // ACTION 2: CONTAIN THREAT
  else if (action === 'CONTAIN') {
    const targetToContain = (obj.id === 'ws_delta_01')
      ? (state.opposingAiTarget || targetId)
      : targetId

    const srv = updatedServerStates[targetToContain] || updatedServer
    srv.status = 'contained'
    srv.health = Math.max(srv.health, 90)
    updatedServerStates[targetToContain] = srv

    if (state.opposingAiTarget === targetToContain) {
      opposingAiPivoting = true
      opposingAiPivotTimer = 0.0
      deflectedWaves += 1
      newFacilityIntegrity = Math.min(100, newFacilityIntegrity + 15)
      messageKey = 'game.containment_success'
    } else {
      messageKey = 'game.server_inspected'
    }
  }

  // ACTION 3: RESTORE SERVICE
  else if (action === 'RESTORE') {
    const srv = updatedServerStates[targetId] || updatedServer
    srv.status = 'normal'
    srv.health = 100
    srv.isIsolated = false
    updatedServerStates[targetId] = srv

    newFacilityIntegrity = Math.min(100, newFacilityIntegrity + 20)
    messageKey = 'game.action_restore_success'
  }

  const config = BATTLE_CONFIGS[state.difficulty] || BATTLE_CONFIGS.beginner
  const pivotCooldown = opposingAiPivoting ? Math.max(0, (config.attackerAi?.pivotDelay || 3.5) - opposingAiPivotTimer) : 0
  const opposingAiState = opposingAiPivoting ? 'pivoting' : state.opposingAiStage

  const newState = {
    ...state,
    opposingAiPivoting,
    opposingAiPivotTimer,
    opposingAiRole: 'attacker',
    opposingAiState,
    pivotCooldown,
    isTargetIsolated: true,
    opposingAiTelemetry: opposingAiState,
    deflectedWaves,
    facilityIntegrity: newFacilityIntegrity,
    serverStates: updatedServerStates,
  }

  return {
    state: newState,
    success: true,
    action,
    targetId,
    targetNameKey: obj.nameKey,
    messageKey,
  }
}

/**
 * Execute Battle Mode attacker action (Player: Red Team vs Defender AI)
 */
export function executeBattleAttackerAction(state, targetId, explicitAction = null) {
  const obj = FACILITY_OBJECTS.find((o) => o.id === targetId)
  if (!obj) {
    return { state, success: false, messageKey: 'game.server_inspected' }
  }

  const activeObj = state.activeObjective
  const nodeStates = { ...state.nodeStates }
  const currentNodeState = { ...(nodeStates[targetId] || { id: targetId, status: 'normal' }) }

  const action = explicitAction || getSuggestedActionForAttacker(obj, currentNodeState, activeObj)
  let { detectionMeter, currentObjectiveIndex, defenderAiState, missionStatus, completedObjectives, defenderAiBlindedTimer } = state
  let success = false
  let messageKey = 'game.att_target_mismatch'

  // BYPASS IDS Action (Blinds opposing Defender AI for 6s)
  if (action === 'BYPASS_IDS') {
    if (obj.id === 'srv_gamma_03' || obj.id === 'ws_epsilon_02') {
      detectionMeter = Math.max(0, detectionMeter - 20)
      defenderAiBlindedTimer = 6.0
      currentNodeState.isBypassed = true
      nodeStates[targetId] = currentNodeState
      success = true
      messageKey = 'game.att_action_bypass_success'

      if (activeObj && activeObj.requiredAction === 'BYPASS_IDS' && activeObj.targetId === targetId) {
        completedObjectives = [...completedObjectives, activeObj.id]
        currentObjectiveIndex += 1
      }
    } else {
      detectionMeter = Math.min(100, detectionMeter + 8)
      messageKey = 'game.att_target_mismatch'
    }
  } else if (activeObj && activeObj.targetId === targetId && activeObj.requiredAction === action) {
    success = true
    messageKey = activeObj.successKey || 'game.server_inspected'
    completedObjectives = [...completedObjectives, activeObj.id]

    if (action === 'PROBE') {
      currentNodeState.probed = true
      currentNodeState.status = 'probed'
    } else if (action === 'INFILTRATE') {
      currentNodeState.infiltrated = true
      currentNodeState.status = 'infiltrated'
    } else if (action === 'EXTRACT') {
      currentNodeState.extracted = true
      currentNodeState.status = 'extracted'
    }
    nodeStates[targetId] = currentNodeState

    detectionMeter = Math.min(100, detectionMeter + 6)
    currentObjectiveIndex += 1
  } else {
    detectionMeter = Math.min(100, detectionMeter + 8)
    messageKey = 'game.att_target_mismatch'
  }

  const nextActiveObj = state.objectives[currentObjectiveIndex] || null
  if (currentObjectiveIndex >= state.objectives.length) {
    missionStatus = 'victory'
  } else if (detectionMeter >= 100) {
    detectionMeter = 100
    defenderAiState = 'lockdown'
    missionStatus = 'failed'
  }

  const isBlinded = (defenderAiBlindedTimer || 0) > 0
  const updatedState = {
    ...state,
    detectionMeter,
    defenderAiState,
    defenderAiBlindedTimer: defenderAiBlindedTimer || 0,
    blindedTimer: defenderAiBlindedTimer || 0,
    opposingAiRole: 'defender',
    opposingAiState: isBlinded ? 'blinded' : defenderAiState,
    opposingAiTelemetry: isBlinded ? 'blinded' : defenderAiState,
    currentObjectiveIndex,
    activeObjective: nextActiveObj,
    completedObjectives,
    missionStatus,
    nodeStates,
  }

  return {
    state: updatedState,
    success,
    action,
    targetId,
    targetNameKey: obj.nameKey,
    messageKey,
  }
}

/**
 * Universal action execution dispatcher for Defender, Attacker, and Battle modes
 */
export function executeAction(state, targetId, explicitAction = null) {
  if (!state) return { state, success: false, messageKey: 'game.server_inspected' }
  if (state.gameMode === GAME3D_MODES.BATTLE) {
    if (state.battleRole === BATTLE_ROLES.ATTACKER) {
      return executeBattleAttackerAction(state, targetId, explicitAction)
    }
    return executeBattleDefenderAction(state, targetId, explicitAction)
  }
  if (state.gameMode === GAME3D_MODES.ATTACKER) {
    return executeAttackerAction(state, targetId, explicitAction)
  }
  return executeDefensiveAction(state, targetId, explicitAction)
}

/**
 * Backward-compatible single-object interaction wrapper
 */
export function interactWithObject(state, targetId) {
  return executeAction(state, targetId)
}

/**
 * Read current 3D Game progress from Journey storage (single source of truth).
 */
export function getGame3dProgress() {
  const p = getJourneyProgress()
  const g = (p && typeof p.game3d === 'object' && p.game3d !== null) ? p.game3d : {}

  const unlockedDifficulties = Array.isArray(g.unlockedDifficulties)
    ? [...g.unlockedDifficulties]
    : ['beginner']

  const completedDifficulties = (g.completedDifficulties && typeof g.completedDifficulties === 'object')
    ? g.completedDifficulties
    : {}

  const attackerUnlockedDifficulties = Array.isArray(g.attackerUnlockedDifficulties)
    ? [...g.attackerUnlockedDifficulties]
    : ['beginner']

  const attackerCompletedDifficulties = (g.attackerCompletedDifficulties && typeof g.attackerCompletedDifficulties === 'object')
    ? g.attackerCompletedDifficulties
    : {}

  const completedMissions = (g.completedMissions && typeof g.completedMissions === 'object')
    ? g.completedMissions
    : {}

  const battleUnlockedDifficulties = (g.battleUnlockedDifficulties && typeof g.battleUnlockedDifficulties === 'object')
    ? g.battleUnlockedDifficulties
    : { defender: ['beginner'], attacker: ['beginner'] }

  const battleCompletions = (g.battleCompletions && typeof g.battleCompletions === 'object')
    ? g.battleCompletions
    : { defender: {}, attacker: {} }

  let totalXp = 0
  for (const diff of Object.keys(completedDifficulties)) {
    const item = completedDifficulties[diff]
    if (item && item.completed !== false) {
      totalXp += typeof item.xpAwarded === 'number'
        ? item.xpAwarded
        : (diff === 'advanced' ? 100 : diff === 'intermediate' ? 75 : 50)
    }
  }
  for (const diff of Object.keys(attackerCompletedDifficulties)) {
    const item = attackerCompletedDifficulties[diff]
    if (item && item.completed !== false) {
      totalXp += typeof item.xpAwarded === 'number'
        ? item.xpAwarded
        : (diff === 'advanced' ? 100 : diff === 'intermediate' ? 75 : 50)
    }
  }
  for (const role of ['defender', 'attacker']) {
    const roleMap = battleCompletions[role] || {}
    for (const diff of Object.keys(roleMap)) {
      const item = roleMap[diff]
      if (item && item.completed !== false) {
        totalXp += typeof item.xpAwarded === 'number'
          ? item.xpAwarded
          : (diff === 'advanced' ? 120 : diff === 'intermediate' ? 85 : 60)
      }
    }
  }

  return {
    unlockedDifficulties,
    completedDifficulties,
    attackerUnlockedDifficulties,
    attackerCompletedDifficulties,
    completedMissions,
    battleUnlockedDifficulties,
    battleCompletions,
    totalXp,
  }
}

/**
 * Check if a difficulty tier is unlocked for 3D Cyber Battle Game.
 */
export function isGame3dDifficultyUnlocked(difficulty, mode = GAME3D_MODES.DEFENDER, progress = null, battleRole = BATTLE_ROLES.DEFENDER) {
  if (difficulty === 'beginner') return true
  const prog = progress || getGame3dProgress()
  if (mode === GAME3D_MODES.BATTLE) {
    const roleKey = battleRole === BATTLE_ROLES.ATTACKER ? 'attacker' : 'defender'
    const list = prog.battleUnlockedDifficulties?.[roleKey] || ['beginner']
    const anyList = (prog.battleUnlockedDifficulties?.defender || []).concat(prog.battleUnlockedDifficulties?.attacker || [])
    return list.includes(difficulty) || anyList.includes(difficulty)
  }
  if (mode === GAME3D_MODES.ATTACKER) {
    return (prog.attackerUnlockedDifficulties || ['beginner']).includes(difficulty)
  }
  return (prog.unlockedDifficulties || ['beginner']).includes(difficulty)
}

/**
 * Check if a structured mission is unlocked
 */
export function isGame3dMissionUnlocked(missionId, mode = GAME3D_MODES.DEFENDER, progress = null) {
  const prog = progress || getGame3dProgress()
  if (mode === GAME3D_MODES.ATTACKER) {
    if (missionId === 'att_mission_1') return true
    if (missionId === 'att_mission_2') return Boolean(prog.attackerUnlockedDifficulties?.includes('intermediate') || prog.completedMissions?.['att_mission_1']?.completed)
    if (missionId === 'att_mission_3') return Boolean(prog.attackerUnlockedDifficulties?.includes('advanced') || prog.completedMissions?.['att_mission_2']?.completed)
    return true
  }
  if (missionId === 'def_mission_1') return true
  if (missionId === 'def_mission_2') return Boolean(prog.unlockedDifficulties?.includes('intermediate') || prog.completedMissions?.['def_mission_1']?.completed)
  if (missionId === 'def_mission_3') return Boolean(prog.unlockedDifficulties?.includes('advanced') || prog.completedMissions?.['def_mission_2']?.completed)
  return true
}

/**
 * Record a 3D Cyber Battle Game victory with strict idempotency and anti-duplicate XP.
 * Supports both object options { difficulty, mode, battleRole, missionId, user } and positional parameters.
 */
export async function recordGame3dVictory(arg1, arg2, arg3, arg4, arg5) {
  let difficulty = 'beginner'
  let mode = GAME3D_MODES.DEFENDER
  let battleRole = BATTLE_ROLES.DEFENDER
  let missionId = null
  let user = null

  if (typeof arg1 === 'object' && arg1 !== null) {
    difficulty = arg1.difficulty || 'beginner'
    mode = arg1.mode || GAME3D_MODES.DEFENDER
    battleRole = arg1.battleRole || BATTLE_ROLES.DEFENDER
    missionId = arg1.missionId || null
    user = arg1.user || null
  } else {
    difficulty = arg1 || 'beginner'
    mode = arg2 || GAME3D_MODES.DEFENDER
    battleRole = arg3 || BATTLE_ROLES.DEFENDER
    missionId = arg4 || null
    user = arg5 || null
  }

  const currentJourney = getJourneyProgress()
  const currentG3d = (currentJourney.game3d && typeof currentJourney.game3d === 'object')
    ? currentJourney.game3d
    : {}

  const now = new Date().toISOString()

  // CASE 1: BATTLE MODE VICTORY
  if (mode === GAME3D_MODES.BATTLE) {
    const battleConfig = BATTLE_CONFIGS[difficulty] || BATTLE_CONFIGS.beginner
    const roleKey = battleRole === BATTLE_ROLES.ATTACKER ? 'attacker' : 'defender'
    const battleCompletions = { ...(currentG3d.battleCompletions || { defender: {}, attacker: {} }) }
    const roleMap = { ...(battleCompletions[roleKey] || {}) }

    const alreadyCompleted = Boolean(roleMap[difficulty]?.completed !== false && roleMap[difficulty])
    const xpAwarded = alreadyCompleted ? 0 : battleConfig.xpReward

    roleMap[difficulty] = {
      completed: true,
      difficulty,
      role: roleKey,
      xpAwarded: alreadyCompleted ? (roleMap[difficulty]?.xpAwarded || 0) : xpAwarded,
      completedAt: roleMap[difficulty]?.completedAt || now,
      updatedAt: now,
    }
    battleCompletions[roleKey] = roleMap

    const battleUnlocked = { ...(currentG3d.battleUnlockedDifficulties || { defender: ['beginner'], attacker: ['beginner'] }) }
    const roleUnlocked = new Set(battleUnlocked[roleKey] || ['beginner'])
    roleUnlocked.add('beginner')
    if (difficulty === 'beginner') roleUnlocked.add('intermediate')
    if (difficulty === 'intermediate') roleUnlocked.add('advanced')
    battleUnlocked[roleKey] = Array.from(roleUnlocked)

    const updatedG3d = {
      ...currentG3d,
      battleCompletions,
      battleUnlockedDifficulties: battleUnlocked,
      updatedAt: now,
    }

    const updatedJourney = {
      ...currentJourney,
      game3d: updatedG3d,
      totalXp: (currentJourney.totalXp || 0) + xpAwarded,
      updatedAt: now,
    }

    saveJourneyProgress(updatedJourney)

    return {
      success: true,
      mode,
      difficulty,
      battleRole: roleKey,
      rewardAwarded: !alreadyCompleted,
      xpAwarded,
      alreadyCompleted,
      unlockedDifficulties: battleUnlocked[roleKey],
      currentProgress: getGame3dProgress(),
    }
  }

  // CASE 2: DEFENDER OR ATTACKER MODE VICTORY (including Missions)
  const isAttacker = mode === GAME3D_MODES.ATTACKER
  const config = isAttacker
    ? (ATTACKER_DIFFICULTY_CONFIGS[difficulty] || ATTACKER_DIFFICULTY_CONFIGS.beginner)
    : (DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.beginner)

  const completedMapKey = isAttacker ? 'attackerCompletedDifficulties' : 'completedDifficulties'
  const unlockedListKey = isAttacker ? 'attackerUnlockedDifficulties' : 'unlockedDifficulties'

  const completedMap = { ...(currentG3d[completedMapKey] || {}) }
  const alreadyCompleted = Boolean(completedMap[difficulty]?.completed !== false && completedMap[difficulty])
  const xpAwarded = alreadyCompleted ? 0 : config.xpReward

  // Update completion record
  completedMap[difficulty] = {
    completed: true,
    difficulty,
    mode,
    xpAwarded: alreadyCompleted ? (completedMap[difficulty]?.xpAwarded || 0) : xpAwarded,
    completedAt: completedMap[difficulty]?.completedAt || now,
    updatedAt: now,
  }

  // Also mark completedMissions
  const completedMissions = { ...(currentG3d.completedMissions || {}) }
  const effectiveMissionId = missionId || (isAttacker
    ? (difficulty === 'advanced' ? 'att_mission_3' : difficulty === 'intermediate' ? 'att_mission_2' : 'att_mission_1')
    : (difficulty === 'advanced' ? 'def_mission_3' : difficulty === 'intermediate' ? 'def_mission_2' : 'def_mission_1')
  )
  completedMissions[effectiveMissionId] = {
    completed: true,
    missionId: effectiveMissionId,
    mode,
    difficulty,
    xpAwarded: alreadyCompleted ? 0 : xpAwarded,
    completedAt: now,
  }

  // Unlock next difficulty tier for the specific mode
  const unlockedSet = new Set(currentG3d[unlockedListKey] || ['beginner'])
  unlockedSet.add('beginner')
  if (difficulty === 'beginner') unlockedSet.add('intermediate')
  if (difficulty === 'intermediate') unlockedSet.add('advanced')
  const unlockedList = Array.from(unlockedSet)

  const updatedG3d = {
    ...currentG3d,
    [completedMapKey]: completedMap,
    [unlockedListKey]: unlockedList,
    completedMissions,
    updatedAt: now,
  }

  const updatedJourney = {
    ...currentJourney,
    game3d: updatedG3d,
    totalXp: (currentJourney.totalXp || 0) + xpAwarded,
    updatedAt: now,
  }

  saveJourneyProgress(updatedJourney)

  return {
    success: true,
    difficulty,
    mode,
    missionId: effectiveMissionId,
    rewardAwarded: !alreadyCompleted,
    xpAwarded,
    alreadyCompleted,
    unlockedDifficulties: unlockedList,
    currentProgress: getGame3dProgress(),
  }
}

// Re-export complete Digital City — Cyber War 3D Subsystems
export * from './digitalCity/index.js'

