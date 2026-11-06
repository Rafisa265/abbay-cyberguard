import { describe, it, expect, beforeEach } from 'vitest'
import {
  GAME3D_MODES,
  GAME3D_DIFFICULTIES,
  ATTACKER_DIFFICULTY_CONFIGS,
  FACILITY_OBJECTS,
  createInitialSimulationState,
  createInitialAttackerSimulationState,
  updateSimulationTick,
  updateAttackerSimulationTick,
  executeAttackerAction,
  executeAction,
  getSuggestedActionForObject,
  getGame3dProgress,
  isGame3dDifficultyUnlocked,
  recordGame3dVictory,
} from './lib/gameEngine3d.js'
import { resetJourneyProgress, getJourneyProgress, reconcileProgressIntegrity } from './lib/journey.js'

describe('3D Cyber Battle Game - Phase 3 Attacker Mode & Defender AI Suite', () => {
  beforeEach(() => {
    resetJourneyProgress()
  })

  describe('1. Attacker Mode Initialization & Synthetic Objective Bank', () => {
    it('initializes Attacker Mode with detection meter at 0% and patrolling Defender AI', () => {
      const state = createInitialSimulationState('beginner', GAME3D_MODES.ATTACKER)

      expect(state.gameMode).toBe(GAME3D_MODES.ATTACKER)
      expect(state.difficulty).toBe('beginner')
      expect(state.detectionMeter).toBe(0.0)
      expect(state.defenderAiState).toBe('patrolling')
      expect(state.missionStatus).toBe('playing')
      expect(state.currentObjectiveIndex).toBe(0)
      expect(state.objectives.length).toBe(3)
      expect(state.activeObjective.id).toBe('obj_probe_gamma')
    })

    it('ensures all Attacker Mode objectives are strictly synthetic audit evaluations', () => {
      for (const diff of GAME3D_DIFFICULTIES) {
        const config = ATTACKER_DIFFICULTY_CONFIGS[diff]
        expect(config).toBeDefined()
        expect(config.xpReward).toBeGreaterThan(0)
        expect(config.detectionRate).toBeGreaterThan(0)

        for (const obj of config.objectives) {
          // Verify objectives map to valid facility objects
          const target = FACILITY_OBJECTS.find((o) => o.id === obj.targetId)
          expect(target).toBeDefined()

          // Allowed fictional actions only
          expect(['PROBE', 'INFILTRATE', 'EXTRACT', 'BYPASS_IDS']).toContain(obj.requiredAction)
        }
      }
    })
  })

  describe('2. Attacker Tactical Actions & State Transitions', () => {
    it('executes PROBE on target node, updating state and advancing objective', () => {
      let state = createInitialAttackerSimulationState('beginner')
      expect(state.activeObjective.requiredAction).toBe('PROBE')
      expect(state.activeObjective.targetId).toBe('srv_gamma_03')

      const res = executeAttackerAction(state, 'srv_gamma_03', 'PROBE')
      expect(res.success).toBe(true)
      expect(res.messageKey).toBe('game.att_probe_gamma_success')

      const next = res.state
      expect(next.currentObjectiveIndex).toBe(1)
      expect(next.nodeStates['srv_gamma_03'].probed).toBe(true)
      expect(next.nodeStates['srv_gamma_03'].status).toBe('probed')
      expect(next.activeObjective.id).toBe('obj_infiltrate_beta')
      // Action generated slight detection noise (+6%)
      expect(next.detectionMeter).toBe(6)
    })

    it('executes INFILTRATE and EXTRACT to progress through full audit chain', () => {
      let state = createInitialAttackerSimulationState('beginner')

      // Step 1: Probe Gamma-03
      state = executeAttackerAction(state, 'srv_gamma_03', 'PROBE').state

      // Step 2: Infiltrate Beta-02
      const resInfiltrate = executeAttackerAction(state, 'srv_beta_02', 'INFILTRATE')
      expect(resInfiltrate.success).toBe(true)
      state = resInfiltrate.state
      expect(state.nodeStates['srv_beta_02'].infiltrated).toBe(true)
      expect(state.currentObjectiveIndex).toBe(2)

      // Step 3: Extract Beta-02
      const resExtract = executeAttackerAction(state, 'srv_beta_02', 'EXTRACT')
      expect(resExtract.success).toBe(true)
      state = resExtract.state
      expect(state.nodeStates['srv_beta_02'].extracted).toBe(true)
      expect(state.missionStatus).toBe('victory')
    })

    it('penalizes detection meter when target or tactical action does not match objective', () => {
      let state = createInitialAttackerSimulationState('beginner')
      const initialDetection = state.detectionMeter

      // Trying wrong action on wrong target
      const res = executeAttackerAction(state, 'srv_alpha_01', 'EXTRACT')
      expect(res.success).toBe(false)
      expect(res.messageKey).toBe('game.att_target_mismatch')
      expect(res.state.detectionMeter).toBe(initialDetection + 8)
      expect(res.state.currentObjectiveIndex).toBe(0)
    })

    it('allows BYPASS_IDS on security consoles to cool down detection meter by -20%', () => {
      let state = createInitialAttackerSimulationState('beginner')
      // Artificially elevate detection meter
      state.detectionMeter = 50

      const res = executeAttackerAction(state, 'srv_gamma_03', 'BYPASS_IDS')
      expect(res.success).toBe(true)
      expect(res.state.detectionMeter).toBe(30)
      expect(res.state.nodeStates['srv_gamma_03'].isBypassed).toBe(true)
    })
  })

  describe('3. Defender AI Detection & Stage Progression', () => {
    it('increases detection meter while player is near active target node', () => {
      let state = createInitialAttackerSimulationState('beginner')
      const targetPos = { x: 6.0, z: -5.0 } // Gamma-03 coordinates

      // Tick 2 seconds with player standing next to target
      state = updateSimulationTick(state, 2.0, targetPos)

      expect(state.detectionMeter).toBeGreaterThan(0)
      expect(state.defenderAiState).toBe('patrolling')
    })

    it('cools down detection meter when player maintains safe distance (>5m)', () => {
      let state = createInitialAttackerSimulationState('beginner')
      state.detectionMeter = 30.0

      const farPos = { x: 12.0, z: 12.0 } // far corner of room
      state = updateSimulationTick(state, 5.0, farPos)

      expect(state.detectionMeter).toBeLessThan(30.0)
    })

    it('transitions Defender AI through patrolling -> alerted -> hunting -> lockdown', () => {
      let state = createInitialAttackerSimulationState('beginner')
      const targetPos = { x: 6.0, z: -5.0 }

      // Advance detection to alerted (>= 40%)
      state = updateSimulationTick(state, 20.0, targetPos)
      expect(state.detectionMeter).toBeGreaterThanOrEqual(40)
      expect(state.defenderAiState).toBe('alerted')

      // Advance detection to hunting (>= 75%)
      state = updateSimulationTick(state, 18.0, targetPos)
      expect(state.detectionMeter).toBeGreaterThanOrEqual(75)
      expect(state.defenderAiState).toBe('hunting')

      // Advance detection to lockdown (>= 100%)
      state = updateSimulationTick(state, 20.0, targetPos)
      expect(state.detectionMeter).toBe(100)
      expect(state.defenderAiState).toBe('lockdown')
      expect(state.missionStatus).toBe('failed')
    })
  })

  describe('4. Difficulty Tiers & Multi-Node Objectives', () => {
    it('configures Intermediate tier with 4 objectives including IDS bypass', () => {
      const state = createInitialAttackerSimulationState('intermediate')
      expect(state.totalObjectives).toBe(4)
      expect(state.objectives[0].requiredAction).toBe('BYPASS_IDS')
      expect(state.objectives[0].targetId).toBe('ws_epsilon_02')
      expect(state.objectives[1].requiredAction).toBe('PROBE')
      expect(state.objectives[1].targetId).toBe('srv_alpha_01')
    })

    it('configures Advanced tier with 5 coordinated objectives', () => {
      const state = createInitialAttackerSimulationState('advanced')
      expect(state.totalObjectives).toBe(5)
      expect(state.objectives[0].targetId).toBe('sec_door_01')
      expect(state.objectives[1].targetId).toBe('srv_gamma_03')
      expect(state.objectives[2].targetId).toBe('srv_alpha_01')
      expect(state.objectives[3].targetId).toBe('srv_beta_02')
      expect(state.objectives[4].targetId).toBe('ws_delta_01')
    })
  })

  describe('5. Unlocking, Progression & XP Idempotency for Attacker Mode', () => {
    it('unlocks Beginner tier initially for Attacker Mode', () => {
      const prog = getGame3dProgress()
      expect(isGame3dDifficultyUnlocked('beginner', GAME3D_MODES.ATTACKER, prog)).toBe(true)
      expect(isGame3dDifficultyUnlocked('intermediate', GAME3D_MODES.ATTACKER, prog)).toBe(false)
      expect(isGame3dDifficultyUnlocked('advanced', GAME3D_MODES.ATTACKER, prog)).toBe(false)
    })

    it('awards +50 XP and unlocks Intermediate tier upon completing Beginner', async () => {
      const xp0 = getJourneyProgress().totalXp
      const res = await recordGame3dVictory({ difficulty: 'beginner', mode: GAME3D_MODES.ATTACKER })

      expect(res.success).toBe(true)
      expect(res.xpAwarded).toBe(50)
      expect(res.alreadyCompleted).toBe(false)
      expect(res.unlockedDifficulties).toContain('intermediate')

      const updatedProg = getGame3dProgress()
      expect(updatedProg.attackerUnlockedDifficulties).toContain('intermediate')
      expect(getJourneyProgress().totalXp).toBe(xp0 + 50)
    })

    it('enforces strict anti-duplicate XP when replaying completed Attacker difficulty', async () => {
      await recordGame3dVictory({ difficulty: 'beginner', mode: GAME3D_MODES.ATTACKER })
      const xpAfterFirst = getJourneyProgress().totalXp

      // Replay
      const replayRes = await recordGame3dVictory({ difficulty: 'beginner', mode: GAME3D_MODES.ATTACKER })
      expect(replayRes.alreadyCompleted).toBe(true)
      expect(replayRes.xpAwarded).toBe(0)
      expect(getJourneyProgress().totalXp).toBe(xpAfterFirst)
    })

    it('reconciles Attacker Mode XP authoritatively in reconcileProgressIntegrity', async () => {
      await recordGame3dVictory({ difficulty: 'beginner', mode: GAME3D_MODES.ATTACKER })
      const progress = getJourneyProgress()

      const reconciled = reconcileProgressIntegrity(progress)
      expect(reconciled.totalXp).toBe(progress.totalXp)
      expect(reconciled.game3d.attackerUnlockedDifficulties).toContain('intermediate')
      expect(reconciled.game3d.attackerCompletedDifficulties.beginner.completed).toBe(true)
    })
  })

  describe('6. Defender Mode Preservation & Non-Regression', () => {
    it('preserves Defender Mode initialization, wave structure, and integrity mechanics', () => {
      const defenderState = createInitialSimulationState('beginner', GAME3D_MODES.DEFENDER)
      expect(defenderState.gameMode).toBe(GAME3D_MODES.DEFENDER)
      expect(defenderState.facilityIntegrity).toBe(100)
      expect(defenderState.serverStates['srv_beta_02'].status).toBe('under_attack')

      // Universal executeAction routes to defensive action
      const res = executeAction(defenderState, 'srv_beta_02', 'CONTAIN')
      expect(res.success).toBe(true)
      expect(res.state.serverStates['srv_beta_02'].status).toBe('contained')
    })
  })
})
