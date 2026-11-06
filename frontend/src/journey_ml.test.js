import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  determineAdaptiveRecommendation,
  fetchMlAdaptiveRecommendation,
  getCachedMlRecommendation,
  setCachedMlRecommendation,
  evaluateChoice,
  resetJourneyProgress,
  getJourneyProgress,
  predictLocalAdaptiveRecommendation,
  getNextPracticeQuestion,
  isMlRecommendationsEnabled,
  setMlRecommendationsEnabled,
} from './lib/journey.js'
import { generateOfflineMission, resolvePracticeTemplateId } from './lib/missionTemplates.js'
import * as api from './lib/api.js'
import React from 'react'
import { renderToString } from 'react-dom/server'
import Journey from './components/Journey.jsx'
import en from './locales/en.js'

describe('Cyber Hero Journey - Machine Learning Adaptive Recommendation Suite', () => {
  beforeEach(() => {
    resetJourneyProgress()
    setCachedMlRecommendation(null)
    vi.restoreAllMocks()
  })

  it('1. Offline Deterministic Fallback - operates safely without backend or cached ML', () => {
    const progress = getJourneyProgress()
    const rec = determineAdaptiveRecommendation(progress, true)
    expect(rec).toBeDefined()
    expect(rec.difficulty).toBe('beginner')
    expect(rec.reason).toBe('insufficient_data')
    expect(rec.engine).toBe('deterministic_fallback')
  })

  it('2. Category Remediation Fallback - recommends struggling category', () => {
    const progress = {
      ...getJourneyProgress(),
      categoryStats: {
        sim_swap: { attempts: 3, correct: 0, wrong: 3, consecutiveCorrect: 0 },
      },
      difficultyStats: {
        beginner: { attempts: 3, correct: 0, wrong: 3 },
      },
      recentOutcomes: [
        { missionId: 'm02', category: 'sim_swap', difficulty: 'beginner', isCorrect: false },
        { missionId: 'm02', category: 'sim_swap', difficulty: 'beginner', isCorrect: false },
      ],
    }

    const rec = determineAdaptiveRecommendation(progress, false)
    expect(rec.difficulty).toBe('beginner')
    expect(rec.targetCategory).toBe('sim_swap')
    expect(rec.reason).toBe('category_remediation')
    expect(rec.engine).toBe('deterministic_fallback')
  })

  it('3. ML Cache Integration - adopts high-confidence ML recommendation when enabled', () => {
    const mockMlRec = {
      recommended_difficulty: 'intermediate',
      recommended_category: null,
      reason: 'ml_predicted_intermediate_confidence_0.84',
      engine: 'ml_softmax_v1',
      confidence: 0.84,
      probabilities: { beginner: 0.1, intermediate: 0.84, advanced: 0.06 },
    }

    setCachedMlRecommendation(mockMlRec)
    expect(getCachedMlRecommendation()).toEqual(mockMlRec)

    const rec = determineAdaptiveRecommendation(getJourneyProgress(), true)
    expect(rec.recommended_difficulty || rec.difficulty).toBe('intermediate')
    expect(rec.engine).toBe('ml_softmax_v1')
    expect(rec.confidence).toBe(0.84)
  })

  it('4. Low Confidence Safeguard - falls back to deterministic rule engine when confidence < 0.55', () => {
    const lowConfidenceRec = {
      recommended_difficulty: 'advanced',
      recommended_category: null,
      reason: 'ml_predicted_advanced_confidence_0.42',
      engine: 'ml_softmax_v1',
      confidence: 0.42,
      probabilities: { beginner: 0.28, intermediate: 0.30, advanced: 0.42 },
    }

    setCachedMlRecommendation(lowConfidenceRec)

    // Player with insufficient data should NOT be jumped to advanced
    const rec = determineAdaptiveRecommendation(getJourneyProgress(), true)
    expect(rec.difficulty).toBe('beginner')
    expect(rec.reason).toBe('insufficient_data')
  })

  it('5. fetchMlAdaptiveRecommendation - invokes API with non-sensitive telemetry and handles network failure', async () => {
    const spy = vi.spyOn(api, 'getMlAdaptiveRecommendation').mockRejectedValue(new Error('Network Offline'))

    const progress = getJourneyProgress()
    const rec = await fetchMlAdaptiveRecommendation(progress)

    expect(spy).toHaveBeenCalled()
    const calledArg = spy.mock.calls[0][0]

    // Verify privacy constraints on telemetry payload
    expect(calledArg).toHaveProperty('recent_outcomes')
    expect(calledArg).toHaveProperty('category_stats')
    expect(calledArg).toHaveProperty('difficulty_stats')
    expect(calledArg).toHaveProperty('total_xp')
    expect(calledArg).not.toHaveProperty('password')
    expect(calledArg).not.toHaveProperty('token')
    expect(calledArg).not.toHaveProperty('email')
    expect(calledArg).not.toHaveProperty('user_name')

    // Verifies clean fallback
    expect(rec.engine).toBe('deterministic_fallback')
    expect(rec.difficulty).toBe('beginner')
  })

  it('6. fetchMlAdaptiveRecommendation - successfully parses and caches valid ML response', async () => {
    vi.spyOn(api, 'getMlAdaptiveRecommendation').mockResolvedValue({
      recommended_difficulty: 'intermediate',
      recommended_category: 'phishing',
      engine: 'ml_softmax_v1',
      confidence: 0.88,
      probabilities: { beginner: 0.08, intermediate: 0.88, advanced: 0.04 },
      reason: 'ml_predicted_intermediate_confidence_0.88',
    })

    const rec = await fetchMlAdaptiveRecommendation(getJourneyProgress())
    expect(rec.difficulty).toBe('intermediate')
    expect(rec.targetCategory).toBe('phishing')
    expect(rec.engine).toBe('ml_softmax_v1')
    expect(rec.confidence).toBe(0.88)
    expect(getCachedMlRecommendation()).toEqual(rec)
  })

  it('7. evaluateChoice integration - preserves progression XP while safely pre-warming ML', () => {
    const outcome = evaluateChoice('m01', 'choice_verify_official') // correct choice
    expect(outcome.isCorrect).toBe(true)
    expect(outcome.newlyCompleted).toBe(true)
    expect(outcome.awardedXp).toBe(100)

    const updated = getJourneyProgress()
    expect(updated.completedMissions['m01']?.completed).toBe(true)
    expect(updated.totalXp).toBe(100)
    expect(updated.categoryStats['phishing_advance_fee']?.correct).toBe(1)
  })

  it('8. Recommended module and activity mapping across categories', () => {
    const testCases = [
      { cat: 'phishing', expectedModule: 'm1' },
      { cat: 'credentials', expectedModule: 'm2' },
      { cat: 'telecom_fraud', expectedModule: 'm3' },
      { cat: 'malware', expectedModule: 'm4' },
      { cat: 'social_engineering', expectedModule: 'm5' },
    ]
    for (const { cat, expectedModule } of testCases) {
      // With completedCount < 4 (campaign mission activity)
      const progEarly = {
        ...getJourneyProgress(),
        completedMissions: {},
        categoryStats: {
          [cat]: { attempts: 3, correct: 0, wrong: 3, consecutiveCorrect: 0 },
        },
        recentOutcomes: [
          { category: cat, isCorrect: false },
          { category: cat, isCorrect: false },
        ],
      }
      const recEarly = determineAdaptiveRecommendation(progEarly, false)
      expect(recEarly.recommendedModule).toBe(expectedModule)
      expect(recEarly.recommendedActivity).toBe('campaign_mission')

      // With completedCount >= 4 (practice mission activity)
      const progExperienced = {
        ...getJourneyProgress(),
        completedMissions: { m01: { completed: true }, m02: { completed: true }, m03: { completed: true }, m04: { completed: true } },
        categoryStats: {
          [cat]: { attempts: 3, correct: 0, wrong: 3, consecutiveCorrect: 0 },
        },
        recentOutcomes: [
          { category: cat, isCorrect: false },
          { category: cat, isCorrect: false },
        ],
      }
      const recExp = determineAdaptiveRecommendation(progExperienced, false)
      expect(recExp.recommendedModule).toBe(expectedModule)
      expect(recExp.recommendedActivity).toBe('practice_mission')
    }
  })

  it('9. Category-targeted practice selection prevents silent fallback to unrelated categories', () => {
    // sim_swap threat category must resolve to P04 (social engineering / OTP / telecom protection)
    expect(resolvePracticeTemplateId('sim_swap')).toBe('p04')
    const simMission = generateOfflineMission({ category: 'sim_swap' })
    expect(simMission.base_template_id).toBe('p04')
    expect(simMission.category).toBe('social_engineering')

    // credential harvesting must resolve to P02 (password safety / credential protection)
    expect(resolvePracticeTemplateId('credential_harvesting_telecom')).toBe('p02')
    const credMission = generateOfflineMission({ category: 'credential_harvesting_telecom' })
    expect(credMission.base_template_id).toBe('p02')
    expect(credMission.category).toBe('password_safety')

    // fake banking bot must resolve to P05 (privacy incident response / financial breach)
    expect(resolvePracticeTemplateId('fake_banking_bot')).toBe('p05')
    const bankMission = generateOfflineMission({ category: 'fake_banking_bot' })
    expect(bankMission.base_template_id).toBe('p05')
    expect(bankMission.category).toBe('privacy_incident_response')

    // getNextPracticeQuestion with category target returns matched mission, not arbitrary P01
    const pResult = getNextPracticeQuestion('m01', { category: 'sim_swap' })
    expect(pResult.mission).toBeDefined()
    expect(resolvePracticeTemplateId(pResult.mission)).toBe('p04')
  })

  it('10. End-to-end edge case verification across empty history, streaks, and privacy consent boundary', async () => {
    // A. Empty history -> beginner with insufficient_data
    const emptyProg = getJourneyProgress()
    const emptyRec = predictLocalAdaptiveRecommendation(emptyProg)
    expect(emptyRec.difficulty).toBe('beginner')
    expect(emptyRec.engine).toBe('deterministic_fallback')
    expect(emptyRec.reason).toBe('insufficient_data')

    // B. Insufficient attempts (< 2 total attempts) blocks jump to advanced
    const oneAttemptProg = {
      ...emptyProg,
      recentOutcomes: [{ category: 'phishing', difficulty: 'beginner', isCorrect: true }],
      difficultyStats: { beginner: { attempts: 1, correct: 1, wrong: 0 } },
    }
    const oneAttemptRec = predictLocalAdaptiveRecommendation(oneAttemptProg)
    expect(oneAttemptRec.difficulty).toBe('beginner')

    // C. Successful streaks (>= 2 beginner correct -> intermediate, >= 2 intermediate -> advanced)
    const midStreakProg = {
      ...emptyProg,
      recentOutcomes: [
        { category: 'phishing', difficulty: 'beginner', isCorrect: true },
        { category: 'phishing', difficulty: 'beginner', isCorrect: true },
        { category: 'phishing', difficulty: 'beginner', isCorrect: true },
      ],
      difficultyStats: {
        beginner: { attempts: 3, correct: 3, wrong: 0 },
      },
    }
    const midRec = determineAdaptiveRecommendation(midStreakProg, false)
    expect(midRec.difficulty).toBe('intermediate')

    const advStreakProg = {
      ...midStreakProg,
      difficultyStats: {
        beginner: { attempts: 3, correct: 3, wrong: 0 },
        intermediate: { attempts: 3, correct: 3, wrong: 0 },
      },
      recentOutcomes: [
        { category: 'phishing', difficulty: 'intermediate', isCorrect: true },
        { category: 'phishing', difficulty: 'intermediate', isCorrect: true },
        { category: 'phishing', difficulty: 'intermediate', isCorrect: true },
      ],
    }
    const advRec = determineAdaptiveRecommendation(advStreakProg, false)
    expect(advRec.difficulty).toBe('advanced')

    // D. Guest privacy boundary: unconsented or guest users execute in-browser without network dispatch
    const apiSpy = vi.spyOn(api, 'getMlAdaptiveRecommendation')
    const guestUser = { id: null, isGuest: true, preferences: {} }
    const guestRec = await fetchMlAdaptiveRecommendation(emptyProg, guestUser)
    expect(apiSpy).not.toHaveBeenCalled()
    expect(guestRec.offlineCapable).toBe(true)
  })

  it('11. UI Rendering - renders Adaptive Recommendation Banner in outcome DOM views', () => {
    const t = (k) => en[k] || k

    // Victory outcome screen
    const victoryHtml = renderToString(
      React.createElement(Journey, {
        t,
        lang: 'en',
        user: null,
        initialMissionId: 'm01',
        initialSubmitted: true,
        initialEvalResult: { isCorrect: true, isTrap: false, awardedXp: 100 },
      })
    )
    expect(victoryHtml).toContain('post-mission-rec-banner')
    expect(victoryHtml).toContain('Recommended Next Step')
    expect(victoryHtml).toContain('btn-rec-banner-launch')

    // Defeat outcome screen
    const defeatHtml = renderToString(
      React.createElement(Journey, {
        t,
        lang: 'en',
        user: null,
        initialMissionId: 'm01',
        initialSubmitted: true,
        initialEvalResult: { isCorrect: false, isTrap: true, awardedXp: 0 },
      })
    )
    expect(defeatHtml).toContain('post-mission-rec-banner')
    expect(defeatHtml).toContain('Recommended Next Step')
    expect(defeatHtml).toContain('btn-rec-banner-launch')
  })

  it('12. User ML Copilot Toggle - allows explicit toggle of ML recommender trial', () => {
    setMlRecommendationsEnabled(false)
    expect(isMlRecommendationsEnabled()).toBe(false)

    setMlRecommendationsEnabled(true)
    expect(isMlRecommendationsEnabled()).toBe(true)

    const activeProgress = {
      ...getJourneyProgress(),
      completedMissions: { m01: { completed: true, score: 3 } },
      recentOutcomes: [{ missionId: 'm01', isCorrect: true, difficulty: 'beginner', category: 'phishing' }],
    }
    const mlRec = predictLocalAdaptiveRecommendation(activeProgress)
    expect(mlRec.engine).toBe('ml_softmax_v1')

    const rec = determineAdaptiveRecommendation(activeProgress, true)
    expect(rec.engine).toBe('ml_softmax_v1')

    setMlRecommendationsEnabled(false)
    expect(isMlRecommendationsEnabled()).toBe(false)
    const recDet = determineAdaptiveRecommendation(activeProgress, false)
    expect(recDet.engine).toBe('deterministic_fallback')
  })
})


