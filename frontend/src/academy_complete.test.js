import { describe, it, expect, beforeEach } from 'vitest'
import {
  ACADEMY_STAGES,
  ACADEMY_LEVELS,
  getLevelCurriculum,
  getStageMetadata,
  isLevelUnlocked,
} from './lib/academyCurriculum.js'
import {
  loadAcademyProgress,
  saveAcademyProgress,
  markLessonSectionCompleted,
  recordSimulationChallenge,
  saveEarnedCertificate,
  hasCertificateSyncConsent,
  saveCertificateSyncConsent,
  resetAcademyProgress,
} from './lib/academyStorage.js'
import {
  calculateTopicMastery,
  generateAdaptiveRecommendations,
  getSmartRevisionQueue,
} from './lib/adaptiveEngine.js'
import {
  getJourneyProgress,
  saveJourneyProgress,
  resetJourneyProgress,
} from './lib/journey.js'
import {
  recordQuizLevelPassed,
  getUnifiedLearningProgress,
} from './lib/learningProgress.js'
import {
  TOPICS,
  LEVELS,
  QUESTION_BANK,
  getQuestionsForLevel,
  evaluateLevel,
} from './lib/quiz.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('ABBAY CYBER ACADEMY — Complete Architecture & Quality Suite', () => {
  beforeEach(() => {
    resetJourneyProgress()
    resetAcademyProgress()
  })

  it('keeps certificate synchronization off until explicit consent and persists the choice with Academy progress', () => {
    expect(loadAcademyProgress().certificateSyncConsent).toBe(false)
    expect(() => saveCertificateSyncConsent(true)).toThrow(/authenticated account/)
    saveCertificateSyncConsent(true, 'account-a')
    expect(loadAcademyProgress().certificateSyncConsent).toBe(true)
    expect(hasCertificateSyncConsent('account-a')).toBe(true)
    expect(hasCertificateSyncConsent('account-b')).toBe(false)
    saveCertificateSyncConsent(false, 'account-a')
    expect(loadAcademyProgress().certificateSyncConsent).toBe(false)
    expect(hasCertificateSyncConsent('account-a')).toBe(false)
  })

  describe('1. Multi-Stage Curriculum Architecture (Levels 1–16+)', () => {
    it('defines exactly 4 progressive learning stages', () => {
      expect(ACADEMY_STAGES).toHaveLength(4)
      expect(ACADEMY_STAGES.map((s) => s.id)).toEqual(['stage_1', 'stage_2', 'stage_3', 'stage_4'])
      expect(ACADEMY_STAGES[0].status).toBe('active')
      expect(ACADEMY_STAGES[1].status).toBe('curriculum_defined')
      expect(ACADEMY_STAGES[2].status).toBe('curriculum_defined')
      expect(ACADEMY_STAGES[3].status).toBe('curriculum_defined')
    })

    it('covers all 16 progressive level curricula with comprehensive specifications', () => {
      expect(ACADEMY_LEVELS.length).toBeGreaterThanOrEqual(16)
      for (let l = 1; l <= 16; l++) {
        const spec = getLevelCurriculum(l)
        expect(spec).toBeDefined()
        expect(spec.title).toBeTruthy()
        expect(spec.desc).toBeTruthy()
        expect(Array.isArray(spec.objectives)).toBe(true)
        expect(spec.objectives.length).toBeGreaterThanOrEqual(3)
        expect(spec.prerequisites).toBeTruthy()
        expect(spec.requiredPracticalChallenge).toBeTruthy()
        expect(spec.assessmentCriteria).toBeTruthy()
        expect(spec.completionOutcome).toBeTruthy()
      }
    })

    it('stage metadata maps correctly to each stage', () => {
      expect(getStageMetadata('stage_1').levelRange).toBe('1–6')
      expect(getStageMetadata('stage_2').levelRange).toBe('7–10')
      expect(getStageMetadata('stage_3').levelRange).toBe('11–15')
      expect(getStageMetadata('stage_4').levelRange).toBe('16+')
    })

    it('isLevelUnlocked correctly respects unlockedLevels array', () => {
      expect(isLevelUnlocked(1, [1])).toBe(true)
      expect(isLevelUnlocked(2, [1])).toBe(false)
      expect(isLevelUnlocked(2, [1, 2])).toBe(true)
      expect(isLevelUnlocked(6, [1, 2, 3, 4, 5, 6])).toBe(true)
    })
  })

  describe('2. Uncapped 6-Level Progression & 32 Questions', () => {
    it('provides 6 active playable levels in Stage 1 with 32 questions', () => {
      expect(LEVELS).toHaveLength(6)
      expect(QUESTION_BANK).toHaveLength(32)
      for (let l = 1; l <= 6; l++) {
        const qList = getQuestionsForLevel(l)
        expect(qList.length).toBeGreaterThanOrEqual(5)
      }
    })

    it('allows advancement across all 6 levels without getting locked at level 4', async () => {
      // Pass level 1
      await recordQuizLevelPassed(1, 100, 3, null)
      let prog = getUnifiedLearningProgress()
      expect(prog.quiz.passedCount).toBe(1)
      expect(prog.quiz.levelsData[1].passed).toBe(true)

      // Pass level 2, 3, 4
      await recordQuizLevelPassed(2, 100, 3, null)
      await recordQuizLevelPassed(3, 100, 3, null)
      const res4 = await recordQuizLevelPassed(4, 100, 3, null)
      expect(res4.badgeAwarded).toBe('badge_academy_graduate')

      // Pass level 5 and 6
      await recordQuizLevelPassed(5, 100, 3, null)
      const res6 = await recordQuizLevelPassed(6, 100, 3, null)
      expect(res6.badgeAwarded).toBe('badge_academy_master')

      prog = getUnifiedLearningProgress()
      expect(prog.quiz.passedCount).toBe(6)
      expect(prog.badges).toContain('badge_academy_graduate')
      expect(prog.badges).toContain('badge_academy_master')
    })
  })

  describe('3. Offline Persistent Storage Engine (SR-09 Privacy)', () => {
    it('persists progress locally and tracks lesson section completion', () => {
      const initial = loadAcademyProgress()
      expect(initial.version).toBe(2)
      expect(initial.activeLevel).toBe(1)

      // Mark sections completed for phishing
      markLessonSectionCompleted('phishing', 'overview')
      markLessonSectionCompleted('phishing', 'how')
      markLessonSectionCompleted('phishing', 'examples')

      let updated = loadAcademyProgress()
      expect(updated.completedLessons.phishing.completedSections).toEqual(['overview', 'how', 'examples'])
      expect(updated.completedLessons.phishing.completed).toBe(false)

      // Complete remaining sections
      markLessonSectionCompleted('phishing', 'warnings')
      markLessonSectionCompleted('phishing', 'actions')
      markLessonSectionCompleted('phishing', 'recap')

      updated = loadAcademyProgress()
      expect(updated.completedLessons.phishing.completed).toBe(true)
      expect(updated.completedLessons.phishing.completedSections).toHaveLength(6)
    })

    it('records simulation challenge completions and scores', () => {
      recordSimulationChallenge('sim_phish_01', 100)
      recordSimulationChallenge('sim_social_01', 85)

      const prog = loadAcademyProgress()
      expect(prog.practicalChallenges.sim_phish_01.completed).toBe(true)
      expect(prog.practicalChallenges.sim_phish_01.score).toBe(100)
      expect(prog.practicalChallenges.sim_social_01.completed).toBe(true)
      expect(prog.practicalChallenges.sim_social_01.score).toBe(85)
    })

    it('stores certificates and prevents duplicates', () => {
      const cert1 = {
        certificateId: 'ACYBER-2026-TEST01',
        stageId: 'stage_1',
        levelNum: 1,
        title: 'Stage 1 — Level 1 Milestone Certificate',
        recipientName: 'Abebe Bikila',
        issueDate: 'November 5, 2026',
        verificationHash: 'acyber-2026-test01-abebekebede-verified',
      }

      saveEarnedCertificate(cert1)
      let prog = loadAcademyProgress()
      expect(prog.earnedCertificates).toHaveLength(1)
      expect(prog.earnedCertificates[0].certificateId).toBe('ACYBER-2026-TEST01')

      // Save duplicate with updated name
      saveEarnedCertificate({ ...cert1, recipientName: 'Abebe Bikila Updated' })
      prog = loadAcademyProgress()
      expect(prog.earnedCertificates).toHaveLength(1)
      expect(prog.earnedCertificates[0].recipientName).toBe('Abebe Bikila Updated')
    })
  })

  describe('4. Transparent Adaptive Engine & Smart Spaced Revision', () => {
    it('calculates mastery scores accurately per topic', () => {
      // 100% correct answers on phishing questions q1 and q6
      const answers = { q1: 1, q6: 0 }
      const completedLessons = { phishing: { completed: true } }
      const mastery = calculateTopicMastery(answers, completedLessons)

      expect(mastery.phishing.percentage).toBe(100)
      expect(mastery.phishing.status).toBe('mastered')
      expect(mastery.password.percentage).toBe(0)
      expect(mastery.password.status).toBe('not_started')
    })

    it('generates transparent, actionable recommendations with rationale', () => {
      const answers = { q1: 0, q2: 0 } // two wrong answers on phishing questions (< 60%)
      const mastery = calculateTopicMastery(answers, {})
      const recs = generateAdaptiveRecommendations(mastery, 1, answers)

      expect(recs.length).toBeGreaterThan(0)
      const phishRec = recs.find((r) => r.topic === 'phishing')
      expect(phishRec).toBeDefined()
      expect(phishRec.priority).toBe('high')
      expect(phishRec.defaultReason).toBeTruthy()
      expect(phishRec.suggestedAction).toBeTruthy()
    })

    it('builds a spaced revision queue prioritized by lowest score', () => {
      const answers = { q1: 0, q2: 1 } // wrong on phishing, correct on password
      const mastery = calculateTopicMastery(answers, {})
      const queue = getSmartRevisionQueue(mastery)

      expect(queue.length).toBeGreaterThan(0)
      expect(queue[0].topic).toBe('phishing')
      expect(queue[0].recommendedDays).toBe(1) // Immediate 1-day revision
    })
  })

  describe('5. Localization Parity (EN, OM, AM)', () => {
    const requiredKeys = [
      'learn.tab_curriculum',
      'learn.tab_lessons',
      'learn.tab_simlab',
      'learn.tab_quiz',
      'learn.tab_dashboard',
      'academy.guest_persistent_badge',
      'academy.cert.consent_revoke',
      'academy.stage1.title',
      'academy.stage2.title',
      'academy.stage3.title',
      'academy.stage4.title',
      'academy.sim.c1_title',
      'academy.sim.c2_title',
      'academy.sim.c3_title',
      'academy.sim.c4_title',
    ]

    it('has 100% key parity across English, Afaan Oromoo, and Amharic for all Academy keys', () => {
      for (const k of requiredKeys) {
        expect(en[k], `Missing EN key: ${k}`).toBeTruthy()
        expect(om[k], `Missing OM key: ${k}`).toBeTruthy()
        expect(am[k], `Missing AM key: ${k}`).toBeTruthy()
        expect(typeof en[k]).toBe('string')
        expect(typeof om[k]).toBe('string')
        expect(typeof am[k]).toBe('string')
      }
    })
  })
})
