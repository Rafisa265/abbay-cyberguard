import { describe, it, expect, beforeEach } from 'vitest'
import {
  DAILY_CHALLENGES,
  getTodayDateString,
  getDailyChallengeForDate,
  evaluateDailyChoice,
  getDailyChallengeStatus,
  recordDailyChallengeCompleted,
} from './lib/dailyChallenge.js'
import {
  getUnifiedLearningProgress,
  recordQuizLevelPassed,
} from './lib/learningProgress.js'
import {
  getJourneyProgress,
  saveJourneyProgress,
  resetJourneyProgress,
} from './lib/journey.js'
import {
  getCachedNotifications,
  clearAccountCache,
} from './lib/notificationStorage.js'

describe('Daily Challenge & Learning Progress Integration (Phase 6.2)', () => {
  beforeEach(async () => {
    resetJourneyProgress()
    await clearAccountCache('guest')
  })

  describe('1. Challenge Bank & Deterministic Selection', () => {
    it('contains 14 pre-reviewed educational challenges with valid metadata', () => {
      expect(DAILY_CHALLENGES.length).toBe(14)
      for (const dc of DAILY_CHALLENGES) {
        expect(dc.id).toMatch(/^dc_\d{2}$/)
        expect(dc.topic).toBeTruthy()
        expect(dc.badge_id).toBe('badge_daily_defender')
        expect(dc.xp_reward).toBe(50)
        expect(dc.scenario_key).toMatch(/^daily\.dc_\d{2}\.scenario$/)
        expect(dc.question_key).toMatch(/^daily\.dc_\d{2}\.question$/)
        expect(dc.options_keys.length).toBe(3)
        expect([0, 1, 2]).toContain(dc.correct_choice)
        expect(dc.explanation_key).toMatch(/^daily\.dc_\d{2}\.explanation$/)
      }
    })

    it('returns today date string in YYYY-MM-DD format', () => {
      const today = getTodayDateString()
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('selects challenges deterministically from calendar date without PRNG', () => {
      const c1 = getDailyChallengeForDate('2026-10-22')
      const c2 = getDailyChallengeForDate('2026-10-22')
      expect(c1.id).toBe(c2.id)

      // Test consecutive days cycle forward predictably
      const cNext = getDailyChallengeForDate('2026-10-23')
      const idx1 = DAILY_CHALLENGES.findIndex((c) => c.id === c1.id)
      const idxNext = DAILY_CHALLENGES.findIndex((c) => c.id === cNext.id)
      expect(idxNext).toBe((idx1 + 1) % DAILY_CHALLENGES.length)
    })
  })

  describe('2. Offline Evaluation & Anti-Duplicate XP', () => {
    it('evaluates choices correctly offline', () => {
      const challenge = getDailyChallengeForDate('2026-10-22')
      const correctEval = evaluateDailyChoice('2026-10-22', challenge.correct_choice)
      expect(correctEval.isCorrect).toBe(true)
      expect(correctEval.challengeId).toBe(challenge.id)

      const wrongChoice = (challenge.correct_choice + 1) % 3
      const wrongEval = evaluateDailyChoice('2026-10-22', wrongChoice)
      expect(wrongEval.isCorrect).toBe(false)
    })

    it('awards +50 XP and badge_daily_defender on first correct completion', async () => {
      const initialProgress = getJourneyProgress()
      const initialXP = initialProgress.totalXp

      const res = await recordDailyChallengeCompleted({
        dateStr: '2026-10-22',
        choice: 1, // all 14 challenges have correct_choice: 1
        user: null, // Guest Mode
      })

      expect(res.isCorrect).toBe(true)
      expect(res.xpAwarded).toBe(50)
      expect(res.alreadyCompleted).toBe(false)
      expect(res.badgeAwarded).toBe('badge_daily_defender')

      const updatedProgress = getJourneyProgress()
      expect(updatedProgress.totalXp).toBe(initialXP + 50)
      expect(updatedProgress.badges).toContain('badge_daily_defender')
    })

    it('strictly prevents duplicate XP on replay or re-submission (idempotency)', async () => {
      // First submission
      const first = await recordDailyChallengeCompleted({
        dateStr: '2026-10-22',
        choice: 1,
        user: null,
      })
      expect(first.xpAwarded).toBe(50)

      const xpAfterFirst = getJourneyProgress().totalXp

      // Second submission for the same date/challenge
      const second = await recordDailyChallengeCompleted({
        dateStr: '2026-10-22',
        choice: 1,
        user: null,
      })

      expect(second.alreadyCompleted).toBe(true)
      expect(second.xpAwarded).toBe(0) // Zero XP on duplicate!

      const xpAfterSecond = getJourneyProgress().totalXp
      expect(xpAfterSecond).toBe(xpAfterFirst) // No XP increase!
    })

    it('does not award XP for incorrect choices', async () => {
      const initialXP = getJourneyProgress().totalXp
      const res = await recordDailyChallengeCompleted({
        dateStr: '2026-10-22',
        choice: 0, // incorrect
        user: null,
      })

      expect(res.isCorrect).toBe(false)
      expect(res.xpAwarded).toBe(0)

      expect(getJourneyProgress().totalXp).toBe(initialXP)
      const status = getDailyChallengeStatus('2026-10-22')
      expect(status.completed).toBe(false)
    })
  })

  describe('3. Daily Streaks & Badges', () => {
    it('awards badge_daily_streak_3 after completing 3 daily challenges', async () => {
      await recordDailyChallengeCompleted({ dateStr: '2026-10-20', choice: 1, user: null })
      await recordDailyChallengeCompleted({ dateStr: '2026-10-21', choice: 1, user: null })
      const res3 = await recordDailyChallengeCompleted({ dateStr: '2026-10-22', choice: 1, user: null })

      expect(res3.badgeAwarded).toBe('badge_daily_streak_3')
      const progress = getJourneyProgress()
      expect(progress.badges).toContain('badge_daily_streak_3')
      expect(progress.dailyChallenges?.completedDates?.length).toBe(3)
    })
  })

  describe('4. Unified Learning Progress Model', () => {
    it('aggregates progress across missions, quizzes, and daily challenges', async () => {
      // 1. Mission completion
      const journey = getJourneyProgress()
      journey.completedMissions.m01 = { completed: true, score: 100 }
      journey.totalXp += 100
      journey.badges.push('badge_scholarship_shield')
      saveJourneyProgress(journey)

      // 2. Quiz Level 1 passed
      await recordQuizLevelPassed({ level: 1, score: 3, total: 3, user: null })

      // 3. Daily challenge completed
      await recordDailyChallengeCompleted({ dateStr: '2026-10-22', choice: 1, user: null })

      const unified = getUnifiedLearningProgress(null)
      expect(unified.missionsCompleted).toBe(1)
      expect(unified.quizzesPassed).toBe(1)
      expect(unified.dailyChallengesCompleted).toBe(1)
      expect(unified.totalXP).toBe(100 + 100 + 50) // 100 mission + 100 quiz level 1 + 50 daily challenge
      expect(unified.badges).toContain('badge_scholarship_shield')
      expect(unified.badges).toContain('badge_daily_defender')
    })

    it('awards badge_academy_graduate when all 4 quiz levels are passed', async () => {
      await recordQuizLevelPassed({ level: 1, score: 3, total: 3, user: null })
      await recordQuizLevelPassed({ level: 2, score: 3, total: 3, user: null })
      await recordQuizLevelPassed({ level: 3, score: 3, total: 3, user: null })
      const res4 = await recordQuizLevelPassed({ level: 4, score: 3, total: 3, user: null })

      expect(res4.badgeAwarded).toBe('badge_academy_graduate')
      const progress = getJourneyProgress()
      expect(progress.badges).toContain('badge_academy_graduate')
    })

    it('progress does not inflate upon multiple page reloads or repeated getJourneyProgress calls', async () => {
      await recordDailyChallengeCompleted({ dateStr: '2026-10-22', choice: 1, user: null })
      await recordQuizLevelPassed({ level: 1, score: 3, total: 3, user: null })

      const firstRead = getJourneyProgress()
      expect(firstRead.totalXp).toBe(150) // 50 daily + 100 quiz

      // Simulate 5 consecutive page reloads/reads
      for (let i = 0; i < 5; i++) {
        const reloadRead = getJourneyProgress()
        expect(reloadRead.totalXp).toBe(150)
      }
    })

    it('reconciles missing badges automatically without awarding extra XP', async () => {
      await recordDailyChallengeCompleted({ dateStr: '2026-10-20', choice: 1, user: null })
      await recordDailyChallengeCompleted({ dateStr: '2026-10-21', choice: 1, user: null })
      await recordDailyChallengeCompleted({ dateStr: '2026-10-22', choice: 1, user: null })

      const current = getJourneyProgress()
      // Strip badges intentionally to test auto-healing
      current.badges = []
      saveJourneyProgress(current)

      const healed = getJourneyProgress()
      expect(healed.badges).toContain('badge_daily_defender')
      expect(healed.badges).toContain('badge_daily_streak_3')
      expect(healed.totalXp).toBe(150)
    })
  })

  describe('5. Notification Integration & Deduplication', () => {
    it('queues notifications for challenge completion and deduplicates re-submissions', async () => {
      await recordDailyChallengeCompleted({ dateStr: '2026-10-22', choice: 1, user: null })

      const notifs1 = await getCachedNotifications('guest')
      const dailyCompletedNotifs = notifs1.filter(
        (n) => n.type === 'challenge' && n.data?.date === '2026-10-22'
      )
      expect(dailyCompletedNotifs.length).toBe(1)

      // Re-submit
      await recordDailyChallengeCompleted({ dateStr: '2026-10-22', choice: 1, user: null })
      const notifs2 = await getCachedNotifications('guest')
      const dailyCompletedNotifs2 = notifs2.filter(
        (n) => n.type === 'challenge' && n.data?.date === '2026-10-22'
      )
      expect(dailyCompletedNotifs2.length).toBe(1) // Still exactly 1, deduplicated!
    })
  })

  describe('6. Privacy & Safety Constraints', () => {
    it('persists zero sensitive credentials or incident narratives in progress', () => {
      const journey = getJourneyProgress()
      const json = JSON.stringify(journey)

      expect(json).not.toMatch(/password|hash|token|otp|secret|telebirr_pin/i)
      expect(json).not.toMatch(/incident_report|dossier_text/i)
    })
  })
})
