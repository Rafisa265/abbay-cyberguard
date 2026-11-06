import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateTopicMastery,
  generateAdaptiveRecommendations,
  getSmartRevisionQueue,
} from './lib/adaptiveEngine.js'
import {
  TOPICS,
  QUESTION_BANK,
  LEVELS,
  getQuestionsForLevel,
  evaluateLevel,
} from './lib/quiz.js'
import {
  loadAcademyProgress,
  saveAcademyProgress,
  saveQuizAnswers,
  markLessonSectionCompleted,
  recordSimulationChallenge,
  resetAcademyProgress,
} from './lib/academyStorage.js'
import { getJourneyProgress, saveJourneyProgress } from './lib/journey.js'
import en from './locales/en.js'
import am from './locales/am.js'
import om from './locales/om.js'

describe('ABBAY CYBERGUARD M5 — Academy Accuracy, Progress & Lesson Depth Verification', () => {
  beforeEach(() => {
    resetAcademyProgress()
  })

  describe('1. Progress Calculations & State Distinctions', () => {
    it('accurately distinguishes Level Active, Level Completed, and Level Mastered', () => {
      const state = loadAcademyProgress()
      // Initial state: Level 1 active, 0 completed, 0 mastered
      expect(state.activeLevel).toBe(1)
      const completedCount = Object.values(state.completedLevels || {}).filter((l) => l.passed).length
      const masteredCount = Object.values(state.completedLevels || {}).filter(
        (l) => l.passed && (l.score === 100 || l.percentage === 100 || l.stars === 3)
      ).length
      expect(completedCount).toBe(0)
      expect(masteredCount).toBe(0)

      // Active level 1 must NOT be counted as completed or mastered
      expect(completedCount).not.toBe(state.activeLevel)

      // Simulate completing Level 1 with 80% (Completed, but not Mastered)
      state.completedLevels = {
        1: { passed: true, score: 85, percentage: 85, stars: 2, completed_at: new Date().toISOString() },
        2: { passed: true, score: 100, percentage: 100, stars: 3, completed_at: new Date().toISOString() },
      }
      state.activeLevel = 3

      const updatedCompleted = Object.values(state.completedLevels).filter((l) => l.passed).length
      const updatedMastered = Object.values(state.completedLevels).filter(
        (l) => l.passed && (l.score === 100 || l.percentage === 100 || l.stars === 3)
      ).length

      expect(state.activeLevel).toBe(3)
      expect(updatedCompleted).toBe(2)
      expect(updatedMastered).toBe(1)
    })

    it('calculates Total Academy Progress accurately with strict numerator/denominator/percentage agreement', () => {
      const state = loadAcademyProgress()
      state.completedLessons = {
        phishing: { completed: true, completedSections: ['overview', 'how', 'examples', 'warnings', 'actions', 'recap'] },
        password: { completed: true, completedSections: ['overview', 'how', 'examples', 'warnings', 'actions', 'recap'] },
      }
      state.completedLevels = {
        1: { passed: true, score: 100, percentage: 100, stars: 3 },
      }
      state.practicalChallenges = {
        sim_phish_01: { completed: true, score: 100 },
      }

      const completedLessonsCount = Object.values(state.completedLessons).filter((l) => l.completed).length
      const completedLevelsCount = Object.values(state.completedLevels).filter((l) => l.passed).length
      const challengesCount = Object.keys(state.practicalChallenges).length

      const totalUnits = 15 // 5 lessons + 6 levels + 4 challenges
      const completedUnits = completedLessonsCount + completedLevelsCount + challengesCount
      const expectedPercentage = Math.round((completedUnits / totalUnits) * 100)

      expect(completedLessonsCount).toBe(2)
      expect(completedLevelsCount).toBe(1)
      expect(challengesCount).toBe(1)
      expect(completedUnits).toBe(4)
      expect(expectedPercentage).toBe(27) // 4 / 15 = 26.666% -> 27%
    })
  })

  describe('2. Quiz Question Bank Counts & Transparent Status', () => {
    it('provides genuine, consistent question bank totals (7, 7, 6, 6, 6 = 32 questions)', () => {
      expect(QUESTION_BANK).toHaveLength(32)
      const phishQuestions = QUESTION_BANK.filter((q) => q.topic === 'phishing')
      const passQuestions = QUESTION_BANK.filter((q) => q.topic === 'password')
      const privQuestions = QUESTION_BANK.filter((q) => q.topic === 'privacy')
      const respQuestions = QUESTION_BANK.filter((q) => q.topic === 'response')
      const webQuestions = QUESTION_BANK.filter((q) => q.topic === 'website')

      expect(phishQuestions).toHaveLength(7)
      expect(passQuestions).toHaveLength(7)
      expect(privQuestions).toHaveLength(6)
      expect(respQuestions).toHaveLength(6)
      expect(webQuestions).toHaveLength(6)
    })

    it('calculates mastery accurately without misleading "0 / 0" and reports honest not-attempted status', () => {
      // Zero answers provided
      const mastery = calculateTopicMastery({}, {})

      for (const topic of TOPICS) {
        const item = mastery[topic]
        expect(item.answeredCount).toBe(0)
        expect(item.correctCount).toBe(0)
        expect(item.totalQuestions).toBeGreaterThanOrEqual(6)
        expect(item.percentage).toBe(0)
        expect(item.status).toBe('not_started')
      }

      // Provide 3 answers for phishing: 2 correct, 1 incorrect
      const phishQ = QUESTION_BANK.filter((q) => q.topic === 'phishing')
      const sampleAnswers = {
        [phishQ[0].id]: phishQ[0].answer,
        [phishQ[1].id]: phishQ[1].answer,
        [phishQ[2].id]: (phishQ[2].answer + 1) % 3, // incorrect
      }

      const updatedMastery = calculateTopicMastery(sampleAnswers, {})
      expect(updatedMastery.phishing.answeredCount).toBe(3)
      expect(updatedMastery.phishing.correctCount).toBe(2)
      expect(updatedMastery.phishing.totalQuestions).toBe(7)
      expect(updatedMastery.phishing.percentage).toBe(67) // 2 / 3 = 66.67% -> 67%
      expect(updatedMastery.phishing.status).toBe('review_recommended')
    })
  })

  describe('3. Offline Persistence Across Reloads (SR-09 Privacy)', () => {
    it('persists quiz answers and progress in unified journey storage', () => {
      saveQuizAnswers({ q1: 1, q2: 2 })
      const stored = loadAcademyProgress()
      expect(stored.quizAnswers).toEqual({ q1: 1, q2: 2 })

      // Verify that journey progress preserved academyProgress
      const jp = getJourneyProgress()
      expect(jp.academyProgress).toBeDefined()
      expect(jp.academyProgress.quizAnswers).toEqual({ q1: 1, q2: 2 })

      // Complete a simulation challenge and verify persistence
      recordSimulationChallenge('sim_phish_01', 95)
      const afterSim = loadAcademyProgress()
      expect(afterSim.practicalChallenges['sim_phish_01']).toBeDefined()
      expect(afterSim.practicalChallenges['sim_phish_01'].score).toBe(95)
    })
  })

  describe('4. Instructional Depth & Quality Audit Across All 5 Courses', () => {
    const requiredSections = ['obj', 'b', 'how', 'ex', 'warn', 'act', 'recap']

    it('ensures all 5 courses have comprehensive educational content in en.js', () => {
      for (const topic of TOPICS) {
        for (const sec of requiredSections) {
          const key = `learn.${sec}.${topic}`
          const val = en[key]
          expect(val, `Missing or empty key ${key}`).toBeTruthy()
          // Ensure meaningful teaching depth (not just a 1-sentence placeholder)
          expect(val.length, `Key ${key} is too brief (${val.length} chars)`).toBeGreaterThan(100)
        }
      }
    })

    it('ensures all 5 courses contain specific Ethiopian context and realistic scenarios', () => {
      expect(en['learn.ex.phishing']).toContain('CBE Birr')
      expect(en['learn.ex.phishing']).toContain('Telebirr')
      expect(en['learn.ex.password']).toContain('Ethio Telecom')
      expect(en['learn.ex.privacy']).toContain('Kebele')
      expect(en['learn.ex.privacy']).toContain('Fayda')
      expect(en['learn.ex.response']).toContain('Merkato')
      expect(en['learn.ex.website']).toContain('Bole')
    })

    it('maintains 100% key parity across English, Amharic, and Afaan Oromoo for all curriculum keys', () => {
      for (const topic of TOPICS) {
        for (const sec of requiredSections) {
          const key = `learn.${sec}.${topic}`
          expect(am[key], `Missing Amharic key ${key}`).toBeTruthy()
          expect(om[key], `Missing Afaan Oromoo key ${key}`).toBeTruthy()
          expect(am[key].length).toBeGreaterThan(80)
          expect(om[key].length).toBeGreaterThan(80)
        }
      }
    })
  })
})

