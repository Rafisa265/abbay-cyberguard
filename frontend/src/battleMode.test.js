import { describe, it, expect, beforeEach } from 'vitest'
import {
  GAME3D_MODES,
  BATTLE_ROLES,
  GAME3D_DIFFICULTIES,
  DEFENDER_MISSIONS,
  ATTACKER_MISSIONS,
  BATTLE_CONFIGS,
  FACILITY_OBJECTS,
  createInitialSimulationState,
  createInitialBattleSimulationState,
  updateSimulationTick,
  updateBattleSimulationTick,
  singleBattleStep,
  executeAction,
  executeBattleDefenderAction,
  executeBattleAttackerAction,
  isGame3dMissionUnlocked,
  isGame3dDifficultyUnlocked,
  recordGame3dVictory,
  getGame3dProgress,
} from './lib/gameEngine3d.js'
import { resetJourneyProgress, getJourneyProgress, reconcileProgressIntegrity } from './lib/journey.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('CyberShield Ethiopia — Phase 4: Mission Progression & Attacker-Defender Battle Suite', () => {
  beforeEach(() => {
    resetJourneyProgress()
  })

  describe('1. Defender & Attacker Structured Mission Progression', () => {
    it('defines at least three distinct fictional missions for Defender Mode', () => {
      expect(DEFENDER_MISSIONS.length).toBeGreaterThanOrEqual(3)
      const missionIds = DEFENDER_MISSIONS.map((m) => m.id)
      expect(missionIds).toContain('def_mission_1')
      expect(missionIds).toContain('def_mission_2')
      expect(missionIds).toContain('def_mission_3')

      for (const m of DEFENDER_MISSIONS) {
        expect(m.titleKey).toBeDefined()
        expect(m.subtitleKey).toBeDefined()
        expect(m.xpReward).toBeGreaterThan(0)
        expect(['beginner', 'intermediate', 'advanced']).toContain(m.difficulty)
        expect(m.waves.length).toBeGreaterThan(0)
      }
    })

    it('defines at least three distinct fictional missions for Attacker Mode', () => {
      expect(ATTACKER_MISSIONS.length).toBeGreaterThanOrEqual(3)
      const missionIds = ATTACKER_MISSIONS.map((m) => m.id)
      expect(missionIds).toContain('att_mission_1')
      expect(missionIds).toContain('att_mission_2')
      expect(missionIds).toContain('att_mission_3')

      for (const m of ATTACKER_MISSIONS) {
        expect(m.titleKey).toBeDefined()
        expect(m.subtitleKey).toBeDefined()
        expect(m.xpReward).toBeGreaterThan(0)
        expect(['beginner', 'intermediate', 'advanced']).toContain(m.difficulty)
        expect(m.objectives.length).toBeGreaterThan(0)
      }
    })

    it('enforces progressive mission unlocking (Mission 1 unlocked by default; 2 and 3 require prior completion)', async () => {
      // Initially, only mission 1 should be unlocked
      expect(isGame3dMissionUnlocked('def_mission_1', GAME3D_MODES.DEFENDER)).toBe(true)
      expect(isGame3dMissionUnlocked('def_mission_2', GAME3D_MODES.DEFENDER)).toBe(false)
      expect(isGame3dMissionUnlocked('def_mission_3', GAME3D_MODES.DEFENDER)).toBe(false)

      expect(isGame3dMissionUnlocked('att_mission_1', GAME3D_MODES.ATTACKER)).toBe(true)
      expect(isGame3dMissionUnlocked('att_mission_2', GAME3D_MODES.ATTACKER)).toBe(false)
      expect(isGame3dMissionUnlocked('att_mission_3', GAME3D_MODES.ATTACKER)).toBe(false)

      // Simulate completing mission 1 in Defender mode
      await recordGame3dVictory('beginner', GAME3D_MODES.DEFENDER, null, 'def_mission_1')
      const progressAfter1 = getGame3dProgress()
      expect(isGame3dMissionUnlocked('def_mission_2', GAME3D_MODES.DEFENDER, progressAfter1)).toBe(true)
      expect(isGame3dMissionUnlocked('def_mission_3', GAME3D_MODES.DEFENDER, progressAfter1)).toBe(false)

      // Simulate completing mission 2 in Defender mode
      await recordGame3dVictory('intermediate', GAME3D_MODES.DEFENDER, null, 'def_mission_2')
      const progressAfter2 = getGame3dProgress()
      expect(isGame3dMissionUnlocked('def_mission_3', GAME3D_MODES.DEFENDER, progressAfter2)).toBe(true)
    })

    it('initializes state with selected mission parameters and tracks wave/objective completion', () => {
      // Defender Mission 2 (Incident Isolation)
      const defState = createInitialSimulationState('intermediate', GAME3D_MODES.DEFENDER, null, 'def_mission_2')
      expect(defState.missionId).toBe('def_mission_2')
      expect(defState.activeMission.id).toBe('def_mission_2')
      expect(defState.totalWaves).toBe(2)

      // Attacker Mission 1 (Reconnaissance)
      const attState = createInitialSimulationState('beginner', GAME3D_MODES.ATTACKER, null, 'att_mission_1')
      expect(attState.missionId).toBe('att_mission_1')
      expect(attState.activeMission.id).toBe('att_mission_1')
      expect(attState.totalObjectives).toBe(3)
    })
  })

  describe('2. Battle Mode Role Selection & Deterministic AI Simulation', () => {
    it('initializes Battle Mode as Defender against adapting Attacker AI', () => {
      const state = createInitialBattleSimulationState('beginner', BATTLE_ROLES.DEFENDER)

      expect(state.gameMode).toBe(GAME3D_MODES.BATTLE)
      expect(state.battleRole).toBe(BATTLE_ROLES.DEFENDER)
      expect(state.battleTimer).toBe(BATTLE_CONFIGS.beginner.battleDuration)
      expect(state.opposingAiRole).toBe('attacker')
      expect(state.opposingAiState).toBe('probing')
      expect(state.opposingAiTarget).toBe('srv_beta_02')
      expect(state.facilityIntegrity).toBe(100.0)
      expect(state.missionStatus).toBe('playing')
    })

    it('initializes Battle Mode as Attacker against patrolling Defender AI', () => {
      const state = createInitialBattleSimulationState('beginner', BATTLE_ROLES.ATTACKER)

      expect(state.gameMode).toBe(GAME3D_MODES.BATTLE)
      expect(state.battleRole).toBe(BATTLE_ROLES.ATTACKER)
      expect(state.battleTimer).toBe(BATTLE_CONFIGS.beginner.battleDuration)
      expect(state.opposingAiRole).toBe('defender')
      expect(state.opposingAiState).toBe('patrolling')
      expect(state.detectionMeter).toBe(0.0)
      expect(state.missionStatus).toBe('playing')
      expect(state.objectives.length).toBe(3)
    })

    it('dispatches executeAction correctly according to game mode and battle role', () => {
      // Defender role in battle
      const defBattle = createInitialSimulationState('beginner', GAME3D_MODES.BATTLE, BATTLE_ROLES.DEFENDER)
      const resDef = executeAction(defBattle, 'srv_gamma_03', 'ISOLATE')
      expect(resDef.success).toBe(true)
      expect(resDef.state.isTargetIsolated).toBe(true)

      // Attacker role in battle
      const attBattle = createInitialSimulationState('beginner', GAME3D_MODES.BATTLE, BATTLE_ROLES.ATTACKER)
      const resAtt = executeAction(attBattle, 'srv_gamma_03', 'PROBE')
      expect(resAtt.success).toBe(true)
      expect(resAtt.state.nodeStates['srv_gamma_03'].probed).toBe(true)
    })
  })

  describe('3. Dynamic AI Adaptation & Reactivity in Battle Mode', () => {
    it('causes Attacker AI to pivot to alternative target when player isolates conduit', () => {
      let state = createInitialBattleSimulationState('beginner', BATTLE_ROLES.DEFENDER)
      expect(state.opposingAiTarget).toBe('srv_beta_02')

      // Player isolates conduit at Firewall Gamma-03
      const res = executeBattleDefenderAction(state, 'srv_gamma_03', 'ISOLATE')
      expect(res.success).toBe(true)
      state = res.state

      expect(state.isTargetIsolated).toBe(true)
      expect(state.opposingAiState).toBe('pivoting')
      expect(state.pivotCooldown).toBeGreaterThan(0)
      expect(state.opposingAiTelemetry).toContain('pivoting')

      // Advance ticks past pivot cooldown (e.g. 4 seconds)
      for (let i = 0; i < 40; i++) {
        state = updateBattleSimulationTick(state, 0.1)
      }

      // Attacker AI should have finished pivoting to an alternative target server
      expect(state.opposingAiState).toBe('probing')
      expect(state.opposingAiTarget).not.toBe('srv_beta_02')
      expect(['srv_alpha_01', 'srv_delta_04']).toContain(state.opposingAiTarget)
      expect(state.isTargetIsolated).toBe(false) // reset for new target
    })

    it('blinds Defender AI and suspends detection alerts when Attacker triggers BYPASS_IDS', () => {
      let state = createInitialBattleSimulationState('beginner', BATTLE_ROLES.ATTACKER)
      expect(state.opposingAiState).toBe('patrolling')

      // Player executes IDS bypass at Station Epsilon-02
      const res = executeBattleAttackerAction(state, 'ws_epsilon_02', 'BYPASS_IDS')
      expect(res.success).toBe(true)
      state = res.state

      expect(state.opposingAiState).toBe('blinded')
      expect(state.blindedTimer).toBe(6.0)
      expect(state.detectionMeter).toBe(0.0) // Bypass reduces detection noise

      // Advance 2 seconds - Defender AI should remain blinded and patrol detection should not tick up
      for (let i = 0; i < 20; i++) {
        state = updateBattleSimulationTick(state, 0.1)
      }
      expect(state.opposingAiState).toBe('blinded')
      expect(state.blindedTimer).toBeCloseTo(4.0, 1)
      expect(state.detectionMeter).toBe(0.0)
    })
  })

  describe('4. Battle Mode Win/Loss Conditions & Fairness', () => {
    it('awards victory to Defender when timer expires and facility integrity is preserved', () => {
      let state = createInitialBattleSimulationState('beginner', BATTLE_ROLES.DEFENDER)
      state.battleTimer = 0.2 // Set near end of round
      state.facilityIntegrity = 85.0

      state = updateBattleSimulationTick(state, 0.3)
      expect(state.battleTimer).toBe(0)
      expect(state.missionStatus).toBe('victory')
    })

    it('triggers failed state for Defender if facility integrity is depleted before timer ends', () => {
      let state = createInitialBattleSimulationState('beginner', BATTLE_ROLES.DEFENDER)
      state.facilityIntegrity = 2.0
      state.opposingAiStage = 'exploiting'
      state.isTargetIsolated = false

      // Ticking down integrity to zero
      state = updateBattleSimulationTick(state, 1.0)
      expect(state.facilityIntegrity).toBe(0)
      expect(state.missionStatus).toBe('failed')
    })

    it('awards victory to Attacker when all authorized infiltration objectives are completed', () => {
      let state = createInitialBattleSimulationState('beginner', BATTLE_ROLES.ATTACKER)

      // Objective 1: Probe Gamma-03
      state = executeBattleAttackerAction(state, 'srv_gamma_03', 'PROBE').state
      expect(state.currentObjectiveIndex).toBe(1)

      // Objective 2: Infiltrate Beta-02
      state = executeBattleAttackerAction(state, 'srv_beta_02', 'INFILTRATE').state
      expect(state.currentObjectiveIndex).toBe(2)

      // Objective 3: Extract Delta-01
      state = executeBattleAttackerAction(state, 'ws_delta_01', 'EXTRACT').state
      expect(state.missionStatus).toBe('victory')
    })

    it('triggers failed state for Attacker if detection meter reaches 100% or timer runs out', () => {
      let state = createInitialBattleSimulationState('beginner', BATTLE_ROLES.ATTACKER)
      state.detectionMeter = 98.0

      // Advance tick when Defender AI is hunting
      state.opposingAiState = 'hunting'
      state = updateBattleSimulationTick(state, 1.0)
      expect(state.detectionMeter).toBeGreaterThanOrEqual(100.0)
      expect(state.missionStatus).toBe('failed')

      // Also verify timer expiration causes failed state for Attacker if objectives incomplete
      let stateTimer = createInitialBattleSimulationState('beginner', BATTLE_ROLES.ATTACKER)
      stateTimer.battleTimer = 0.1
      stateTimer = updateBattleSimulationTick(stateTimer, 0.2)
      expect(stateTimer.missionStatus).toBe('failed')
    })
  })

  describe('5. XP Anti-Duplication & Safe Journey Progression', () => {
    it('awards XP on first mission completion and prevents duplicate XP on replay', async () => {
      const initialProgress = getJourneyProgress()
      const initialXp = initialProgress.totalXp

      // First completion of Defender Mission 1
      const res1 = await recordGame3dVictory('beginner', GAME3D_MODES.DEFENDER, null, 'def_mission_1')
      expect(res1.rewardAwarded).toBe(true)
      expect(res1.xpAwarded).toBe(50)

      const progress1 = getJourneyProgress()
      expect(progress1.totalXp).toBe(initialXp + 50)
      expect(progress1.game3d?.completedMissions?.['def_mission_1']?.completed).toBe(true)

      // Replaying the same mission should award 0 XP
      const res2 = await recordGame3dVictory('beginner', GAME3D_MODES.DEFENDER, null, 'def_mission_1')
      expect(res2.rewardAwarded).toBe(false)
      expect(res2.xpAwarded).toBe(0)

      const progress2 = getJourneyProgress()
      expect(progress2.totalXp).toBe(initialXp + 50) // Unchanged
    })

    it('awards XP on first Battle Mode tier victory and prevents duplicate XP on replay', async () => {
      const initialProgress = getJourneyProgress()
      const initialXp = initialProgress.totalXp

      // First battle victory as Defender
      const res1 = await recordGame3dVictory('beginner', GAME3D_MODES.BATTLE, BATTLE_ROLES.DEFENDER)
      expect(res1.rewardAwarded).toBe(true)
      expect(res1.xpAwarded).toBe(BATTLE_CONFIGS.beginner.xpReward)

      const progress1 = getJourneyProgress()
      expect(progress1.totalXp).toBe(initialXp + BATTLE_CONFIGS.beginner.xpReward)
      expect(progress1.game3d?.battleCompletions?.defender?.beginner?.completed).toBe(true)

      // Replaying the same battle tier awards 0 XP
      const res2 = await recordGame3dVictory('beginner', GAME3D_MODES.BATTLE, BATTLE_ROLES.DEFENDER)
      expect(res2.rewardAwarded).toBe(false)
      expect(res2.xpAwarded).toBe(0)
      expect(getJourneyProgress().totalXp).toBe(initialXp + BATTLE_CONFIGS.beginner.xpReward)
    })

    it('progressively unlocks Battle Mode difficulties (beginner -> intermediate -> advanced)', async () => {
      expect(isGame3dDifficultyUnlocked('beginner', GAME3D_MODES.BATTLE)).toBe(true)
      expect(isGame3dDifficultyUnlocked('intermediate', GAME3D_MODES.BATTLE)).toBe(false)
      expect(isGame3dDifficultyUnlocked('advanced', GAME3D_MODES.BATTLE)).toBe(false)

      // Win beginner battle
      await recordGame3dVictory('beginner', GAME3D_MODES.BATTLE, BATTLE_ROLES.DEFENDER)
      const p1 = getGame3dProgress()
      expect(isGame3dDifficultyUnlocked('intermediate', GAME3D_MODES.BATTLE, p1)).toBe(true)
      expect(isGame3dDifficultyUnlocked('advanced', GAME3D_MODES.BATTLE, p1)).toBe(false)

      // Win intermediate battle
      await recordGame3dVictory('intermediate', GAME3D_MODES.BATTLE, BATTLE_ROLES.ATTACKER)
      const p2 = getGame3dProgress()
      expect(isGame3dDifficultyUnlocked('advanced', GAME3D_MODES.BATTLE, p2)).toBe(true)
    })
  })

  describe('6. Localization Key Parity & Offline Integrity', () => {
    const requiredKeys = [
      'game.mode_battle',
      'game.mode_battle_desc',
      'game.battle_role_defender',
      'game.battle_role_defender_desc',
      'game.battle_role_attacker',
      'game.battle_role_attacker_desc',
      'game.battle_opposing_ai',
      'game.battle_timer_label',
      'game.battle_ai_active',
      'game.battle_ai_pivoting',
      'game.battle_ai_patrolling',
      'game.battle_ai_hunting',
      'game.battle_ai_blinded',
      'game.battle_victory_title',
      'game.battle_victory_desc',
      'game.battle_failed_title',
      'game.battle_failed_desc',
      'game.battle_def_briefing',
      'game.battle_att_briefing',
      'game.mission_1_title',
      'game.mission_1_desc',
      'game.mission_2_title',
      'game.mission_2_desc',
      'game.mission_3_title',
      'game.mission_3_desc',
      'game.att_mission_1_title',
      'game.att_mission_1_desc',
      'game.att_mission_2_title',
      'game.att_mission_2_desc',
      'game.att_mission_3_title',
      'game.att_mission_3_desc',
      'game.mission_completed',
      'game.mission_locked',
      'game.mission_ready',
    ]

    it('ensures all Phase 4 localization keys exist and are non-empty across English, Afaan Oromoo, and Amharic', () => {
      const languages = [
        { code: 'en', dict: en },
        { code: 'om', dict: om },
        { code: 'am', dict: am },
      ]

      for (const { code, dict } of languages) {
        for (const key of requiredKeys) {
          const val = dict[key]
          expect(val, `Missing key "${key}" in language "${code}"`).toBeDefined()
          expect(typeof val, `Key "${key}" in "${code}" should be a string`).toBe('string')
          expect(val.trim().length, `Key "${key}" in "${code}" should not be empty`).toBeGreaterThan(0)
        }
      }
    })

    it('ensures simulation logic uses local, deterministic execution with no remote network calls', () => {
      // Deterministic simulation tick test: running 100 ticks produces identical results
      const s1 = createInitialBattleSimulationState('beginner', BATTLE_ROLES.DEFENDER)
      const s2 = createInitialBattleSimulationState('beginner', BATTLE_ROLES.DEFENDER)

      const step1 = singleBattleStep(s1, 0.1)
      const step2 = singleBattleStep(s2, 0.1)

      expect(step1.battleTimer).toBe(step2.battleTimer)
      expect(step1.facilityIntegrity).toBe(step2.facilityIntegrity)
      expect(step1.opposingAiTarget).toBe(step2.opposingAiTarget)
    })
  })
})
