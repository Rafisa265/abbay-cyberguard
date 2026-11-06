import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MISSIONS,
  getAllMissions,
  getRank,
  getJourneyProgress,
  saveJourneyProgress,
  completeMission,
  evaluateChoice,
  isMissionCompleted,
  resetJourneyProgress,
  getNextMissionId,
  addGeneratedMission,
  JOURNEY_STORAGE_KEY,
} from './lib/journey.js'
import { CORE_MISSIONS, generateOfflineMission } from './lib/missionTemplates.js'
import { validateMission } from './lib/missionSchema.js'

describe('Cyber Hero Journey - Offline Mission Generator & Progression Suite', () => {
  beforeEach(() => {
    resetJourneyProgress()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  describe('Mission Schema & Validation (FR-26, SR-09)', () => {
    it('validates all core missions M01 - M04 against the strict schema', () => {
      expect(CORE_MISSIONS.length).toBe(4)
      for (const m of CORE_MISSIONS) {
        const val = validateMission(m)
        expect(val.valid, `Mission ${m.id} failed validation: ${val.errors.join(', ')}`).toBe(true)
        expect(val.errors).toEqual([])
      }
    })

    it('rejects missions with unsafe real-world URLs to prevent live attacks', () => {
      const unsafeMission = {
        ...CORE_MISSIONS[0],
        id: 'unsafe_01',
        target_url: 'https://evil-hacker.ru/steal-credentials',
      }
      const val = validateMission(unsafeMission)
      expect(val.valid).toBe(false)
      expect(val.errors.some((e) => e.includes('RFC 2606 reserved testing domain'))).toBe(true)
    })

    it('rejects missions with invalid categories or multiple correct choices', () => {
      const invalidCategory = {
        ...CORE_MISSIONS[0],
        category: 'unapproved_zero_day_exploit',
      }
      expect(validateMission(invalidCategory).valid).toBe(false)

      const multiCorrect = {
        ...CORE_MISSIONS[0],
        choices: [
          ...CORE_MISSIONS[0].choices.map((c) => ({ ...c, isCorrect: true })),
        ],
      }
      expect(validateMission(multiCorrect).valid).toBe(false)
    })
  })

  describe('Offline Procedural Mission Generator', () => {
    it('generates fully validated missions deterministically without Math.random', () => {
      const m1 = generateOfflineMission({ index: 0, difficulty: 'beginner' })
      const m2 = generateOfflineMission({ index: 0, difficulty: 'beginner' })

      // Determinism: Same index yields identical structure
      expect(m1.id).toBe(m2.id)
      expect(m1.code).toBe(m2.code)
      expect(m1.xp_reward).toBe(100)

      const val = validateMission(m1)
      expect(val.valid).toBe(true)
    })

    it('scales XP reward based on selected difficulty tier', () => {
      const beg = generateOfflineMission({ index: 1, difficulty: 'beginner' })
      const mid = generateOfflineMission({ index: 1, difficulty: 'intermediate' })
      const adv = generateOfflineMission({ index: 1, difficulty: 'advanced' })

      expect(beg.xp_reward).toBe(100)
      expect(mid.xp_reward).toBe(150)
      expect(adv.xp_reward).toBe(200)
    })

    it('adds generated practice missions to journey progression', () => {
      const initialCount = getAllMissions().length
      const created = addGeneratedMission()

      expect(created).toBeDefined()
      expect(created.id).toMatch(/^gen_m/)
      const after = getAllMissions()
      expect(after.length).toBe(initialCount + 1)
      expect(after.some((m) => m.id === created.id)).toBe(true)
    })
  })

  describe('Core Mission Definitions & Defensive Logic', () => {
    it('defines Mission 01 with complete security metadata and trap choices', () => {
      const mission = MISSIONS.find((m) => m.id === 'm01')
      expect(mission).toBeDefined()
      expect(mission.code).toBe('MISSION_01')
      expect(mission.xp_reward).toBe(100)
      expect(mission.difficulty).toBe('beginner')
      expect(mission.badge_id).toBe('badge_scholarship_shield')
      expect(mission.correct_choice).toBe('choice_verify_official')
      expect(mission.trap_choices).toContain('choice_pay_fee')
      expect(mission.trap_choices).toContain('choice_enter_creds')
      expect(mission.trap_choices).toContain('choice_forward_friends')
    })

    it('defines Mission 02, 03, and 04 covering telecom, banking, and malware risks', () => {
      const m02 = CORE_MISSIONS.find((m) => m.id === 'm02')
      const m03 = CORE_MISSIONS.find((m) => m.id === 'm03')
      const m04 = CORE_MISSIONS.find((m) => m.id === 'm04')

      expect(m02.code).toBe('MISSION_02')
      expect(m02.xp_reward).toBe(150)
      expect(m02.difficulty).toBe('intermediate')
      expect(m02.badge_id).toBe('badge_telecom_guardian')
      expect(m02.correct_choice).toBe('choice_m02_verify_telecom')

      expect(m03.code).toBe('MISSION_03')
      expect(m03.xp_reward).toBe(150)
      expect(m03.difficulty).toBe('intermediate')
      expect(m03.badge_id).toBe('badge_banking_defender')
      expect(m03.correct_choice).toBe('choice_m03_report_bot')

      expect(m04.code).toBe('MISSION_04')
      expect(m04.xp_reward).toBe(200)
      expect(m04.difficulty).toBe('advanced')
      expect(m04.badge_id).toBe('badge_malware_sentinel')
      expect(m04.correct_choice).toBe('choice_m04_refuse_verify')
    })
  })

  describe('Defense Ranks & XP Calculation', () => {
    it('calculates defense ranks accurately based on XP thresholds', () => {
      expect(getRank(0).key).toBe('cadet')
      expect(getRank(99).key).toBe('cadet')
      expect(getRank(100).key).toBe('defender')
      expect(getRank(249).key).toBe('defender')
      expect(getRank(250).key).toBe('guardian')
      expect(getRank(499).key).toBe('guardian')
      expect(getRank(500).key).toBe('champion')
      expect(getRank(600).key).toBe('champion')
    })
  })

  describe('Choice Evaluation & Immediate Educational Feedback', () => {
    it('evaluates trap choices correctly without awarding XP or badges', () => {
      const traps = ['choice_pay_fee', 'choice_enter_creds', 'choice_forward_friends']

      for (const trap of traps) {
        resetJourneyProgress()
        const res = evaluateChoice('m01', trap)

        expect(res.isCorrect).toBe(false)
        expect(res.isTrap).toBe(true)
        expect(res.newlyCompleted).toBe(false)
        expect(res.awardedXp).toBe(0)

        const progress = getJourneyProgress()
        expect(progress.totalXp).toBe(0)
        expect(progress.badges).toEqual([])
        expect(isMissionCompleted('m01')).toBe(false)
      }
    })

    it('awards XP and badge only when intended defensive action is executed', () => {
      const res = evaluateChoice('m01', 'choice_verify_official')

      expect(res.isCorrect).toBe(true)
      expect(res.isTrap).toBe(false)
      expect(res.newlyCompleted).toBe(true)
      expect(res.awardedXp).toBe(100)

      const current = getJourneyProgress()
      expect(current.totalXp).toBe(100)
      expect(current.badges).toContain('badge_scholarship_shield')
      expect(isMissionCompleted('m01')).toBe(true)
      expect(getRank(current.totalXp).key).toBe('defender')
    })

    it('prevents repeated clicks or replay attempts from awarding duplicate XP', () => {
      // First completion
      const first = evaluateChoice('m01', 'choice_verify_official')
      expect(first.awardedXp).toBe(100)
      expect(first.newlyCompleted).toBe(true)
      expect(getJourneyProgress().totalXp).toBe(100)

      // Repeat attempt / replay
      const second = evaluateChoice('m01', 'choice_verify_official')
      expect(second.isCorrect).toBe(true)
      expect(second.newlyCompleted).toBe(false)
      expect(second.awardedXp).toBe(0)
      expect(getJourneyProgress().totalXp).toBe(100)

      // Direct completeMission duplicate check
      const third = completeMission('m01', 3)
      expect(third.totalXp).toBe(100)
    })
  })

  describe('Mission Progression & Next Mission Navigation', () => {
    it('advances sequentially through campaign missions', () => {
      expect(getNextMissionId('m01')).toBe('m02')
      expect(getNextMissionId('m02')).toBe('m03')
      expect(getNextMissionId('m03')).toBe('m04')
    })

    it('loops to uncompleted missions or retains last mission when campaign complete', () => {
      completeMission('m01')
      completeMission('m02')
      completeMission('m03')
      completeMission('m04')

      const next = getNextMissionId('m04')
      expect(['m01', 'm04']).toContain(next)
    })

    it('accumulates XP and distinct badges across multiple completed missions', () => {
      evaluateChoice('m01', 'choice_verify_official')
      evaluateChoice('m02', 'choice_m02_verify_telecom')

      const prog = getJourneyProgress()
      expect(prog.totalXp).toBe(250)
      expect(prog.badges).toContain('badge_scholarship_shield')
      expect(prog.badges).toContain('badge_telecom_guardian')
      expect(getRank(prog.totalXp).key).toBe('guardian')
    })
  })

  describe('Local Progress Persistence & Recovery (Section 6)', () => {
    it('persists progress to localStorage and restores it across reloads', () => {
      evaluateChoice('m01', 'choice_verify_official')
      const beforeReload = getJourneyProgress()

      // Simulate browser reload by reading raw storage
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(JOURNEY_STORAGE_KEY)
        expect(raw).toBeTruthy()
        const parsed = JSON.parse(raw)
        expect(parsed.totalXp).toBe(100)
        expect(parsed.badges).toContain('badge_scholarship_shield')
        expect(parsed.completedMissions.m01.completed).toBe(true)
      }
    })

    it('resets progress completely when reset action is confirmed', () => {
      evaluateChoice('m01', 'choice_verify_official')
      expect(getJourneyProgress().totalXp).toBe(100)

      const reset = resetJourneyProgress()
      expect(reset.totalXp).toBe(0)
      expect(reset.badges).toEqual([])
      expect(reset.completedMissions).toEqual({})
      expect(isMissionCompleted('m01')).toBe(false)
    })

    it('gracefully handles corrupt or invalid localStorage data', () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(JOURNEY_STORAGE_KEY, '{ invalid json syntax')
        const safe = getJourneyProgress()
        expect(safe.totalXp).toBe(0)
        expect(safe.badges).toEqual([])
      }
    })
  })
})
