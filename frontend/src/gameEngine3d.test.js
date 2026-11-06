import { describe, it, expect, beforeEach } from 'vitest'
import {
  FACILITY_BOUNDS,
  PLAYER_SPECS,
  FACILITY_OBJECTS,
  DIFFICULTY_CONFIGS,
  NETWORK_CONDUITS,
  getAllSolidObstacles,
  isCollidingWithObstacle,
  resolveMovement,
  findNearestInteractive,
  getSuggestedActionForObject,
  createInitialSimulationState,
  updateSimulationTick,
  executeDefensiveAction,
  executeAction,
  getGame3dProgress,
  isGame3dDifficultyUnlocked,
  recordGame3dVictory,
} from './lib/gameEngine3d.js'
import { resetJourneyProgress, getJourneyProgress } from './lib/journey.js'

describe('3D Cyber Battle Game Engine - Phase 2 Dynamic Attack & Defense Gameplay', () => {
  beforeEach(() => {
    resetJourneyProgress()
  })

  describe('1. Facility Environment & Network Conduits', () => {
    it('defines 36m x 36m boundaries and solid obstacle collision boxes', () => {
      expect(FACILITY_BOUNDS.minX).toBe(-16.5)
      expect(FACILITY_BOUNDS.maxX).toBe(16.5)
      const obstacles = getAllSolidObstacles()
      expect(obstacles.length).toBeGreaterThanOrEqual(10)
    })

    it('defines network conduits linking gateway, firewall, servers, and consoles', () => {
      expect(NETWORK_CONDUITS.length).toBeGreaterThanOrEqual(4)
      const targetIds = NETWORK_CONDUITS.map((c) => c.targetServerId)
      expect(targetIds).toContain('srv_beta_02')
      expect(targetIds).toContain('srv_alpha_01')
      expect(targetIds).toContain('srv_gamma_03')
    })
  })

  describe('2. Attacker AI State Transitions & Progression', () => {
    it('initializes attack wave in probing stage targeting Server Beta-02', () => {
      const state = createInitialSimulationState('beginner')
      expect(state.missionStatus).toBe('playing')
      expect(state.attackerStage).toBe('probing')
      expect(state.activeWave.targetServerId).toBe('srv_beta_02')
      expect(state.serverStates['srv_beta_02'].status).toBe('under_attack')
    })

    it('progresses from probing -> infiltrating -> exploiting as time advances', () => {
      let state = createInitialSimulationState('beginner')
      const wave = state.activeWave

      // Advance past probeTime
      state = updateSimulationTick(state, wave.probeTime + 0.1)
      expect(state.attackerStage).toBe('infiltrating')

      // Advance past infiltrateTime
      state = updateSimulationTick(state, wave.infiltrateTime + 0.1)
      expect(state.attackerStage).toBe('exploiting')
    })

    it('compromises target server and reduces facility integrity if player takes no action during exploit', () => {
      let state = createInitialSimulationState('beginner')
      const wave = state.activeWave
      const totalAttackTime = wave.probeTime + wave.infiltrateTime + wave.exploitTime + 0.5

      // Simulate full unattended attack
      state = updateSimulationTick(state, totalAttackTime)

      expect(state.serverStates['srv_beta_02'].status).toBe('compromised')
      expect(state.serverStates['srv_beta_02'].health).toBe(0)
      expect(state.facilityIntegrity).toBeLessThan(100)
    })
  })

  describe('3. Functional Defensive Action 1: Network Isolation', () => {
    it('disconnects server from simulated network and blocks active attack stream', () => {
      let state = createInitialSimulationState('beginner')
      // Advance to infiltrating stage
      state = updateSimulationTick(state, state.activeWave.probeTime + 1.0)
      expect(state.attackerStage).toBe('infiltrating')

      // Player triggers ISOLATE at Firewall Gamma-03
      const res = executeDefensiveAction(state, 'srv_gamma_03', 'ISOLATE')
      expect(res.success).toBe(true)

      const updated = res.state
      expect(updated.serverStates['srv_beta_02'].isIsolated).toBe(true)
      expect(updated.serverStates['srv_beta_02'].status).toBe('isolated')

      // Next tick confirms attack stream was deflected by isolation
      const afterTick = updateSimulationTick(updated, 0.5)
      expect(afterTick.attackerStage).toBe('deflected')
      expect(afterTick.neutralizedWaves).toBe(1)
    })
  })

  describe('4. Functional Defensive Action 2: Threat Containment', () => {
    it('stops active attack payload when player contains threat directly at server', () => {
      let state = createInitialSimulationState('beginner')
      // Advance to exploiting stage
      state = updateSimulationTick(state, state.activeWave.probeTime + state.activeWave.infiltrateTime + 1.0)
      expect(state.attackerStage).toBe('exploiting')

      // Player approaches Server Beta-02 and executes CONTAIN
      const res = executeDefensiveAction(state, 'srv_beta_02', 'CONTAIN')
      expect(res.success).toBe(true)

      const updated = res.state
      expect(updated.attackerStage).toBe('deflected')
      expect(updated.neutralizedWaves).toBe(1)
      expect(updated.serverStates['srv_beta_02'].status).toBe('contained')
      expect(updated.facilityIntegrity).toBeGreaterThanOrEqual(85)
    })
  })

  describe('5. Functional Defensive Action 3: Service Restoration', () => {
    it('restores compromised server to normal operation and recovers facility integrity', () => {
      let state = createInitialSimulationState('beginner')
      const wave = state.activeWave
      // Let server fall to compromised
      state = updateSimulationTick(state, wave.probeTime + wave.infiltrateTime + wave.exploitTime + 1.0)
      expect(state.serverStates['srv_beta_02'].status).toBe('compromised')
      const compromisedIntegrity = state.facilityIntegrity

      // Player executes RESTORE on Server Beta-02
      const res = executeDefensiveAction(state, 'srv_beta_02', 'RESTORE')
      expect(res.success).toBe(true)

      const updated = res.state
      expect(updated.serverStates['srv_beta_02'].status).toBe('normal')
      expect(updated.serverStates['srv_beta_02'].health).toBe(100)
      expect(updated.serverStates['srv_beta_02'].isIsolated).toBe(false)
      expect(updated.facilityIntegrity).toBe(Math.min(100, compromisedIntegrity + 25))
    })
  })

  describe('6. Mission Loop: Victory and Failure Outcomes', () => {
    it('declares victory when all attack waves are contained with integrity > 0%', () => {
      let state = createInitialSimulationState('beginner')
      // Contain the single wave in beginner
      const res = executeDefensiveAction(state, 'srv_beta_02', 'CONTAIN')
      expect(res.state.missionStatus).toBe('victory')
    })

    it('declares failure when facility integrity drops to 0%', () => {
      let state = createInitialSimulationState('beginner')
      state.facilityIntegrity = 5

      // Ticking while under critical exploitation drains remaining integrity to 0
      state.attackerStage = 'exploiting'
      const updated = updateSimulationTick(state, 2.0)
      expect(updated.facilityIntegrity).toBe(0)
      expect(updated.missionStatus).toBe('failed')
    })

    it('does not advance simulation when paused or inactive', () => {
      const state = createInitialSimulationState('beginner')
      const pausedState = { ...state, missionStatus: 'paused' }
      const ticked = updateSimulationTick(pausedState, 5.0)

      expect(ticked.stageTimer).toBe(0)
      expect(ticked.attackerStage).toBe('probing')
    })
  })

  describe('7. Difficulty Tiers & Idempotent XP Progression', () => {
    it('unlocks Beginner initially, keeping Intermediate and Advanced locked', () => {
      const progress = getGame3dProgress()
      expect(isGame3dDifficultyUnlocked('beginner', progress)).toBe(true)
      expect(isGame3dDifficultyUnlocked('intermediate', progress)).toBe(false)
      expect(isGame3dDifficultyUnlocked('advanced', progress)).toBe(false)
    })

    it('awards +50 XP and unlocks Intermediate upon completing Beginner', async () => {
      const initialXP = getJourneyProgress().totalXp
      const res = await recordGame3dVictory({ difficulty: 'beginner' })

      expect(res.success).toBe(true)
      expect(res.alreadyCompleted).toBe(false)
      expect(res.xpAwarded).toBe(50)
      expect(res.unlockedDifficulties).toContain('intermediate')

      const updatedXP = getJourneyProgress().totalXp
      expect(updatedXP).toBe(initialXP + 50)
    })

    it('enforces strict anti-duplicate XP on replaying a completed difficulty', async () => {
      // First victory awards XP
      await recordGame3dVictory({ difficulty: 'beginner' })
      const xpAfterFirst = getJourneyProgress().totalXp

      // Replay victory awards 0 XP
      const resReplay = await recordGame3dVictory({ difficulty: 'beginner' })
      expect(resReplay.success).toBe(true)
      expect(resReplay.alreadyCompleted).toBe(true)
      expect(resReplay.xpAwarded).toBe(0)

      const xpAfterReplay = getJourneyProgress().totalXp
      expect(xpAfterReplay).toBe(xpAfterFirst)
    })

    it('unlocks Advanced upon completing Intermediate and awards +75 XP', async () => {
      await recordGame3dVictory({ difficulty: 'beginner' })
      const resInt = await recordGame3dVictory({ difficulty: 'intermediate' })

      expect(resInt.success).toBe(true)
      expect(resInt.xpAwarded).toBe(75)
      expect(resInt.unlockedDifficulties).toContain('advanced')

      const progress = getGame3dProgress()
      expect(isGame3dDifficultyUnlocked('advanced', progress)).toBe(true)
    })
  })

  describe('8. Tactical Action Deck, Server State Legend & Trilingual Parity', () => {
    it('provides complete action card localization in English, Afaan Oromoo, and Amharic', async () => {
      const en = (await import('./locales/en.js')).default
      const om = (await import('./locales/om.js')).default
      const am = (await import('./locales/am.js')).default

      const actionCardKeys = [
        'game.action_isolate',
        'game.action_isolate_ready',
        'game.action_contain',
        'game.action_contain_ready',
        'game.action_restore',
        'game.action_restore_ready',
        'game.action_probe',
        'game.action_probe_desc',
        'game.action_infiltrate',
        'game.action_infiltrate_desc',
        'game.action_bypass',
        'game.action_bypass_desc',
        'game.action_target',
        'game.action_panel_title',
        'game.action_ready_btn',
        'game.action_in_range',
        'game.action_out_of_range',
      ]

      for (const k of actionCardKeys) {
        expect(en[k], `Missing EN key: ${k}`).toBeTruthy()
        expect(om[k], `Missing OM key: ${k}`).toBeTruthy()
        expect(am[k], `Missing AM key: ${k}`).toBeTruthy()
      }
    })

    it('provides accessible server state legend keys across all three languages', async () => {
      const en = (await import('./locales/en.js')).default
      const om = (await import('./locales/om.js')).default
      const am = (await import('./locales/am.js')).default

      const legendKeys = [
        'game.legend_label',
        'game.legend_secure',
        'game.legend_warning',
        'game.legend_attacked',
        'game.legend_firewall',
      ]

      for (const k of legendKeys) {
        expect(en[k], `Missing EN legend key: ${k}`).toBeTruthy()
        expect(om[k], `Missing OM legend key: ${k}`).toBeTruthy()
        expect(am[k], `Missing AM legend key: ${k}`).toBeTruthy()
      }
    })

    it('maps valid facility objects to action card targets without dangling IDs', () => {
      const facilityIds = FACILITY_OBJECTS.map((o) => o.id)
      const defenderTargets = ['srv_gamma_03', 'srv_beta_02', 'srv_alpha_01']
      for (const targetId of defenderTargets) {
        expect(facilityIds).toContain(targetId)
      }
      const attackerTargets = ['sec_door_01', 'srv_beta_02', 'ws_epsilon_02']
      for (const targetId of attackerTargets) {
        expect(facilityIds).toContain(targetId)
      }
    })
  })

  describe('9. Core Directory Server Alpha-01: Reachability, Interaction Range, Prerequisites & Restoration', () => {
    it('defines Core Directory Server Alpha-01 with correct 3D coordinates and displayed name key', () => {
      const alpha = FACILITY_OBJECTS.find((o) => o.id === 'srv_alpha_01')
      expect(alpha).toBeDefined()
      expect(alpha.nameKey).toBe('game.server_alpha')
      expect(alpha.position.x).toBe(-6.0)
      expect(alpha.position.z).toBe(-5.0)
      expect(alpha.position.y).toBe(1.5)
    })

    it('verifies that player can freely approach Core Directory Server Alpha-01 without obstacle collisions', () => {
      const obstacles = getAllSolidObstacles()
      // Standing in front of server (z = -3.5m, x = -6.0m)
      const frontPos = { x: -6.0, z: -3.5 }
      expect(isCollidingWithObstacle(frontPos.x, frontPos.z, PLAYER_SPECS.radius, obstacles)).toBe(false)

      // Standing to the side of server (x = -4.5m, z = -5.0m)
      const sidePos = { x: -4.5, z: -5.0 }
      expect(isCollidingWithObstacle(sidePos.x, sidePos.z, PLAYER_SPECS.radius, obstacles)).toBe(false)
    })

    it('detects Core Directory Server Alpha-01 within interaction range from valid standing positions', () => {
      expect(PLAYER_SPECS.interactionRange).toBeGreaterThanOrEqual(3.8)

      // Standing 1.5m in front of server center (-6.0, -3.5)
      const nearestFront = findNearestInteractive({ x: -6.0, z: -3.5 }, FACILITY_OBJECTS, PLAYER_SPECS.interactionRange)
      expect(nearestFront).not.toBeNull()
      expect(nearestFront.id).toBe('srv_alpha_01')

      // Standing 2.5m in front of server center (-6.0, -2.5)
      const nearestMid = findNearestInteractive({ x: -6.0, z: -2.5 }, FACILITY_OBJECTS, PLAYER_SPECS.interactionRange)
      expect(nearestMid).not.toBeNull()
      expect(nearestMid.id).toBe('srv_alpha_01')

      // Standing far away in center (0, 0)
      const nearestFar = findNearestInteractive({ x: 0, z: 0 }, FACILITY_OBJECTS, PLAYER_SPECS.interactionRange)
      expect(nearestFar?.id).not.toBe('srv_alpha_01')
    })

    it('suggests CONTAIN when Core Directory Server is under active attack', () => {
      const alpha = FACILITY_OBJECTS.find((o) => o.id === 'srv_alpha_01')
      const underAttackState = { id: 'srv_alpha_01', status: 'under_attack', health: 80, isIsolated: false }
      const action = getSuggestedActionForObject(alpha, underAttackState)
      expect(action).toBe('CONTAIN')
    })

    it('suggests RESTORE when Core Directory Server is compromised, isolated, degraded, or normal', () => {
      const alpha = FACILITY_OBJECTS.find((o) => o.id === 'srv_alpha_01')

      expect(getSuggestedActionForObject(alpha, { id: 'srv_alpha_01', status: 'compromised', health: 0 })).toBe('RESTORE')
      expect(getSuggestedActionForObject(alpha, { id: 'srv_alpha_01', status: 'isolated', isIsolated: true, health: 100 })).toBe('RESTORE')
      expect(getSuggestedActionForObject(alpha, { id: 'srv_alpha_01', status: 'normal', isIsolated: false, health: 70 })).toBe('RESTORE')
      expect(getSuggestedActionForObject(alpha, { id: 'srv_alpha_01', status: 'normal', isIsolated: false, health: 100 })).toBe('RESTORE')
    })

    it('successfully executes RESTORE on Core Directory Server Alpha-01 and updates state', () => {
      let state = createInitialSimulationState('beginner')
      // Simulate compromised alpha server
      state.serverStates['srv_alpha_01'].status = 'compromised'
      state.serverStates['srv_alpha_01'].health = 20
      state.serverStates['srv_alpha_01'].isIsolated = true
      state.facilityIntegrity = 50

      const result = executeAction(state, 'srv_alpha_01', 'RESTORE')
      expect(result.success).toBe(true)
      expect(result.messageKey).toBe('game.action_restore_success')

      const updatedAlpha = result.state.serverStates['srv_alpha_01']
      expect(updatedAlpha.status).toBe('normal')
      expect(updatedAlpha.health).toBe(100)
      expect(updatedAlpha.isIsolated).toBe(false)
      expect(result.state.facilityIntegrity).toBeGreaterThan(50)
    })

    it('provides complete restoration localization keys across EN, OM, and AM', async () => {
      const en = (await import('./locales/en.js')).default
      const om = (await import('./locales/om.js')).default
      const am = (await import('./locales/am.js')).default

      const restoreKeys = [
        'game.restore_prereq_operational',
        'game.restore_prereq_active_attack',
        'game.restore_prereq_ready',
        'game.restore_btn_operational',
        'game.restore_btn_contain_first',
        'game.badge_operational',
        'game.badge_compromised',
        'game.badge_isolated',
      ]

      for (const k of restoreKeys) {
        expect(en[k], `Missing EN restore key: ${k}`).toBeTruthy()
        expect(om[k], `Missing OM restore key: ${k}`).toBeTruthy()
        expect(am[k], `Missing AM restore key: ${k}`).toBeTruthy()
      }
    })
  })
})

