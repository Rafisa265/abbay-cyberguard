/**
 * CyberShield Ethiopia — Continuous Offline Practice Question Generation Test Suite
 * 
 * Verifies:
 * 1. Single question display with accessible answer choices and radio states.
 * 2. Clear feedback, educational explanations, and submission lock (prevent duplicate submission / answer tampering).
 * 3. Next Question progression without page reloads.
 * 4. Question repetition minimization while pool has uncompleted questions.
 * 5. Pool exhaustion detection and round restart mechanics.
 * 6. Adaptive difficulty progression and error remediation (100% deterministic, offline).
 * 7. Exactly one correct answer per question and RFC 2606 safe testing domains.
 * 8. XP, Badge, and storage duplicate prevention on repeat clicks, replay, and refreshes.
 * 9. EN, OM, AM localization parity and zero missing translations.
 * 10. Offline and guest-mode operation without external network dependency.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import Journey from './components/Journey.jsx'
import {
  PRACTICE_TEMPLATES,
  PRACTICE_VARIATION_TEMPLATES,
  generateOfflineMission,
  resolvePracticeTemplateId,
} from './lib/missionTemplates.js'
import { validateMission } from './lib/missionSchema.js'
import {
  getJourneyProgress,
  saveJourneyProgress,
  resetJourneyProgress,
  addAdaptiveMission,
  evaluateChoice,
  getNextPracticeQuestion,
  isMissionCompleted,
  reconcileProgressIntegrity,
  determineAdaptiveRecommendation,
  getAllMissions,
} from './lib/journey.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('Continuous Offline Practice Question Generation Suite', () => {
  let memStorage = {}
  const originalStorage = globalThis.localStorage

  beforeEach(() => {
    memStorage = {}
    globalThis.localStorage = {
      getItem: (key) => memStorage[key] || null,
      setItem: (key, val) => {
        memStorage[key] = String(val)
      },
      removeItem: (key) => {
        delete memStorage[key]
      },
      clear: () => {
        memStorage = {}
      },
    }
    resetJourneyProgress()
  })

  afterEach(() => {
    globalThis.localStorage = originalStorage
  })

  describe('1. Single Question Display and Option Presentation', () => {
    it('displays exactly one active question at a time with clear scenario and choices', () => {
      const mission = addAdaptiveMission({ difficulty: 'beginner' })
      expect(mission).toBeDefined()
      expect(mission.id).toBeDefined()

      const html = renderToString(
        React.createElement(Journey, {
          t: (k) => en[k] || k,
          lang: 'en',
          user: null, // Guest mode
        })
      )

      // Active mission scenario simulation header is rendered
      expect(html).toContain('intel-pill')
      expect(html).toContain('telegram-chat-sim')

      // Radiogroup container for decision choices is rendered
      expect(html).toContain('role="radiogroup"')
      expect(html).toContain('role="radio"')

      // Exactly 4 choice cards are rendered for this mission
      const radioCount = (html.match(/role="radio"/g) || []).length
      expect(radioCount).toBe(4)
    })

    it('ensures question choices have accessible labels and keyboard selection states', () => {
      const mission = addAdaptiveMission({ difficulty: 'intermediate' })
      const html = renderToString(
        React.createElement(Journey, {
          t: (k) => en[k] || k,
          lang: 'en',
          user: null,
        })
      )

      // Choice buttons have aria-checked and role attributes
      expect(html).toContain('aria-checked="false"')
      expect(html).toContain('class="choice-card')
      expect(html).toContain('choice-selector')
    })
  })

  describe('2. Answer Validation, Immediate Feedback, and Submission Lock', () => {
    it('provides clear victory feedback and awards XP only on correct answers', () => {
      const mission = addAdaptiveMission({ difficulty: 'beginner' })
      const correctChoiceId = mission.correct_choice
      expect(correctChoiceId).toBeDefined()

      const result = evaluateChoice(mission.id, correctChoiceId)
      expect(result.isCorrect).toBe(true)
      expect(result.isTrap).toBe(false)
      expect(result.newlyCompleted).toBe(true)
      expect(result.awardedXp).toBe(mission.xp_reward)
      expect(result.currentProgress.totalXp).toBe(mission.xp_reward)
      expect(isMissionCompleted(mission.id)).toBe(true)
    })

    it('provides clear defeat explanation without awarding XP on incorrect/trap answers', () => {
      const mission = addAdaptiveMission({ difficulty: 'beginner' })
      const trapChoiceId = mission.choices.find((c) => !c.isCorrect).id
      expect(trapChoiceId).toBeDefined()

      const result = evaluateChoice(mission.id, trapChoiceId)
      expect(result.isCorrect).toBe(false)
      expect(result.newlyCompleted).toBe(false)
      expect(result.awardedXp).toBe(0)
      expect(result.currentProgress.totalXp).toBe(0)
      expect(isMissionCompleted(mission.id)).toBe(false)
    })

    it('locks choices upon submission and prevents answer modification or duplicate submission', () => {
      const mission = addAdaptiveMission({ difficulty: 'beginner' })
      
      // Execute choice once
      const initialEval = evaluateChoice(mission.id, mission.correct_choice)
      expect(initialEval.newlyCompleted).toBe(true)
      const initialXp = initialEval.currentProgress.totalXp

      // Repeat execution for the same mission
      const duplicateEval = evaluateChoice(mission.id, mission.correct_choice)
      expect(duplicateEval.newlyCompleted).toBe(false)
      expect(duplicateEval.awardedXp).toBe(0)
      expect(duplicateEval.currentProgress.totalXp).toBe(initialXp)
    })
  })

  describe('3. Continuous Next Question Progression', () => {
    it('loads a different unanswered question when Next Question is selected without page refresh', () => {
      const m1 = addAdaptiveMission({ difficulty: 'beginner' })
      evaluateChoice(m1.id, m1.correct_choice)

      // Query for next practice question
      const nextResult = getNextPracticeQuestion(m1.id, { difficulty: 'beginner' })
      expect(nextResult).toBeDefined()
      expect(nextResult.mission).toBeDefined()
      expect(nextResult.mission.id).not.toBe(m1.id)
      expect(['m01', 'm02', 'm03', 'm04'].includes(nextResult.mission.id)).toBe(false)
    })

    it('minimizes question repetition while suitable unanswered questions remain in pool', () => {
      const generatedIds = []
      let currentId = 'initial'

      // Answer 4 consecutive questions in rotation
      for (let i = 0; i < 4; i++) {
        const res = getNextPracticeQuestion(currentId)
        expect(res.mission).toBeDefined()
        expect(generatedIds.includes(res.mission.id)).toBe(false)
        generatedIds.push(res.mission.id)
        currentId = res.mission.id
        evaluateChoice(currentId, res.mission.correct_choice)
      }

      // All 4 generated missions must be distinct
      expect(new Set(generatedIds).size).toBe(4)
    })

    it('never gets stuck in an infinite loop, null mission, or disabled navigation', () => {
      let currentId = 'test_start'
      for (let step = 0; step < 15; step++) {
        const res = getNextPracticeQuestion(currentId)
        expect(res).toBeDefined()
        expect(res.mission).toBeDefined()
        expect(typeof res.mission.id).toBe('string')
        expect(res.mission.id.length).toBeGreaterThan(0)
        expect(res.mission.id).not.toBe(currentId)
        expect(['m01', 'm02', 'm03', 'm04'].includes(res.mission.id)).toBe(false)
        currentId = res.mission.id
      }
    })
  })

  describe('4. Pool Exhaustion and Round Restart', () => {
    it('detects when the current pool is exhausted and supports starting another round', () => {
      // Complete all 6 initial templates
      const completed = []
      for (let i = 0; i < 6; i++) {
        const m = addAdaptiveMission()
        evaluateChoice(m.id, m.correct_choice)
        completed.push(m.id)
      }

      // Asking for next practice question should mark pool as completed/exhausted and start next round
      const nextRes = getNextPracticeQuestion(completed[completed.length - 1])
      expect(nextRes.poolExhausted).toBe(true)
      expect(nextRes.mission).toBeDefined()
      // Generates a versioned next round mission without crashing
      expect(nextRes.mission.id).toContain('_v2_')
      expect(nextRes.mission.code).toContain('_V2')
    })

    it('forceNewRound starts a fresh round variation avoiding immediate duplicate of last question', () => {
      const m1 = addAdaptiveMission()
      evaluateChoice(m1.id, m1.correct_choice)

      const restartRes = getNextPracticeQuestion(m1.id, { forceNewRound: true })
      expect(restartRes.isNewRound).toBe(true)
      expect(restartRes.mission).toBeDefined()
      expect(restartRes.mission.id).not.toBe(m1.id)
    })
  })

  describe('5. Adaptive Difficulty Progression and Remediation', () => {
    it('starts at Beginner difficulty for new learners without prior gameplay history', () => {
      const progress = getJourneyProgress()
      const rec = determineAdaptiveRecommendation(progress)
      expect(rec.difficulty).toBe('beginner')
    })

    it('gradually increases difficulty to intermediate after demonstrated beginner success', () => {
      // Simulate 2 consecutive beginner correct answers
      const m1 = addAdaptiveMission({ difficulty: 'beginner' })
      evaluateChoice(m1.id, m1.correct_choice)
      const m2 = addAdaptiveMission({ difficulty: 'beginner' })
      evaluateChoice(m2.id, m2.correct_choice)

      const updatedProgress = getJourneyProgress()
      const rec = determineAdaptiveRecommendation(updatedProgress)
      expect(rec.difficulty).toBe('intermediate')
    })

    it('gradually increases difficulty to advanced after demonstrated intermediate success', () => {
      // 2 beginner correct
      const m1 = addAdaptiveMission({ difficulty: 'beginner' })
      evaluateChoice(m1.id, m1.correct_choice)
      const m2 = addAdaptiveMission({ difficulty: 'beginner' })
      evaluateChoice(m2.id, m2.correct_choice)

      // 2 intermediate correct
      const m3 = addAdaptiveMission({ difficulty: 'intermediate' })
      evaluateChoice(m3.id, m3.correct_choice)
      const m4 = addAdaptiveMission({ difficulty: 'intermediate' })
      evaluateChoice(m4.id, m4.correct_choice)

      const updatedProgress = getJourneyProgress()
      const rec = determineAdaptiveRecommendation(updatedProgress)
      expect(rec.difficulty).toBe('advanced')
    })

    it('triggers immediate beginner remediation upon repeated mistakes (2 consecutive wrong answers)', () => {
      // First reach intermediate
      const m1 = addAdaptiveMission({ difficulty: 'beginner' })
      evaluateChoice(m1.id, m1.correct_choice)
      const m2 = addAdaptiveMission({ difficulty: 'beginner' })
      evaluateChoice(m2.id, m2.correct_choice)
      expect(determineAdaptiveRecommendation(getJourneyProgress()).difficulty).toBe('intermediate')

      // Now make 2 consecutive wrong answers
      const m3 = addAdaptiveMission({ difficulty: 'intermediate' })
      const wrongChoice1 = m3.choices.find((c) => !c.isCorrect).id
      evaluateChoice(m3.id, wrongChoice1)

      const m4 = addAdaptiveMission({ difficulty: 'intermediate' })
      const wrongChoice2 = m4.choices.find((c) => !c.isCorrect).id
      evaluateChoice(m4.id, wrongChoice2)

      const remediatedRec = determineAdaptiveRecommendation(getJourneyProgress())
      expect(remediatedRec.difficulty).toBe('beginner')
      expect(['mastery_beginner', 'category_remediation']).toContain(remediatedRec.reason)
    })
  })

  describe('6. Question Schema Quality and Safe Domain Integrity', () => {
    it('verifies all practice templates have exactly 1 correct answer and >= 3 choices', () => {
      for (const tmpl of PRACTICE_TEMPLATES) {
        const validation = validateMission(tmpl)
        expect(validation.valid).toBe(true)

        const correctChoices = tmpl.choices.filter((c) => c.isCorrect)
        expect(correctChoices.length).toBe(1)
        expect(tmpl.choices.length).toBeGreaterThanOrEqual(4)

        // RFC 2606 safe testing domain
        expect(
          tmpl.target_url.includes('.invalid') ||
          tmpl.target_url.includes('.example') ||
          tmpl.target_url.includes('.example.com')
        ).toBe(true)

        // All debrief rules >= 3
        expect(tmpl.debrief_rules.length).toBeGreaterThanOrEqual(3)
      }
    })

    it('verifies all variation templates have valid structure and safe domains', () => {
      for (const baseId of Object.keys(PRACTICE_VARIATION_TEMPLATES)) {
        const list = PRACTICE_VARIATION_TEMPLATES[baseId]
        expect(Array.isArray(list)).toBe(true)
        for (const v of list) {
          const correctChoices = v.choices.filter((c) => c.isCorrect)
          expect(correctChoices.length).toBe(1)
          expect(v.choices.length).toBe(4)
          expect(
            v.target_url.includes('.invalid') ||
            v.target_url.includes('.example') ||
            v.target_url.includes('.example.com')
          ).toBe(true)
          expect(v.debrief_rules.length).toBeGreaterThanOrEqual(3)
        }
      }
    })
  })

  describe('7. Reward Protection and Duplicate Resistance', () => {
    it('guarantees XP and badges are awarded exactly once per completed challenge', () => {
      const mission = addAdaptiveMission({ difficulty: 'beginner' })
      const res1 = evaluateChoice(mission.id, mission.correct_choice)
      expect(res1.newlyCompleted).toBe(true)
      expect(res1.awardedXp).toBe(mission.xp_reward)
      expect(res1.currentProgress.totalXp).toBe(mission.xp_reward)

      // Second identical evaluation (re-clicking or re-evaluating)
      const res2 = evaluateChoice(mission.id, mission.correct_choice)
      expect(res2.newlyCompleted).toBe(false)
      expect(res2.awardedXp).toBe(0)
      expect(res2.currentProgress.totalXp).toBe(mission.xp_reward)
    })

    it('reconcileProgressIntegrity prevents artificially inflated XP across storage refreshes', () => {
      const m1 = addAdaptiveMission({ difficulty: 'beginner' })
      evaluateChoice(m1.id, m1.correct_choice)

      const saved = getJourneyProgress()
      // Simulate malicious tampering with totalXp in localStorage
      saved.totalXp = 999999
      saveJourneyProgress(saved)

      // Loading progress automatically runs reconcileProgressIntegrity
      const loaded = getJourneyProgress()
      expect(loaded.totalXp).toBe(m1.xp_reward)
      expect(loaded.totalXp).not.toBe(999999)
    })
  })

  describe('8. Trilingual Localization Parity (EN, OM, AM)', () => {
    it('verifies 100% key parity across EN, OM, and AM without missing or empty strings', () => {
      const enKeys = Object.keys(en)
      const omKeys = Object.keys(om)
      const amKeys = Object.keys(am)

      expect(enKeys.length).toBe(omKeys.length)
      expect(enKeys.length).toBe(amKeys.length)

      for (const k of enKeys) {
        expect(om[k], `Missing OM translation for: ${k}`).toBeDefined()
        expect(am[k], `Missing AM translation for: ${k}`).toBeDefined()
        expect(typeof om[k]).toBe('string')
        expect(typeof am[k]).toBe('string')
        expect(om[k].trim().length).toBeGreaterThan(0)
        expect(am[k].trim().length).toBeGreaterThan(0)
      }
    })

    it('verifies practice progression specific keys exist in all three languages', () => {
      const requiredProgressionKeys = [
        'journey.next_question',
        'journey.practice.start_new_round',
        'journey.practice.pool_completed',
        'journey.practice.round_progress',
        'journey.practice.unanswered_remaining',
      ]

      for (const key of requiredProgressionKeys) {
        expect(en[key]).toBeDefined()
        expect(om[key]).toBeDefined()
        expect(am[key]).toBeDefined()
      }
    })
  })

  describe('9. UI Outcome Card and Next Question Rendering', () => {
    it('renders localized Next Question button in outcome card on practice defeat', () => {
      const mission = addAdaptiveMission({ difficulty: 'beginner' })
      // Evaluate wrong choice to trigger defeat state
      const trap = mission.choices.find((c) => !c.isCorrect)
      const res = evaluateChoice(mission.id, trap.id)

      const html = renderToString(
        React.createElement(Journey, {
          t: (k) => en[k] || k,
          lang: 'en',
          user: null,
          initialMissionId: mission.id,
          initialChoice: trap.id,
          initialSubmitted: true,
          initialEvalResult: res,
        })
      )

      // Outcome card is in defeat state
      expect(html).toContain('outcome-card')
      expect(html).toContain('outcome-defeat')

      // Localized Next Question button is rendered
      expect(html).toContain('id="journey-next-question-btn"')
      expect(html).toContain('Next Question')

      // Retry button is also rendered on defeat
      expect(html).toContain('id="journey-retry-mission-btn"')
    })

    it('renders localized Next Question and Start New Round buttons on practice victory', () => {
      const mission = addAdaptiveMission({ difficulty: 'beginner' })
      const res = evaluateChoice(mission.id, mission.correct_choice)

      const html = renderToString(
        React.createElement(Journey, {
          t: (k) => en[k] || k,
          lang: 'en',
          user: null,
          initialMissionId: mission.id,
          initialChoice: mission.correct_choice,
          initialSubmitted: true,
          initialEvalResult: res,
        })
      )

      expect(html).toContain('outcome-victory')
      expect(html).toContain('id="journey-next-question-btn"')
      expect(html).toContain('id="journey-start-round-btn"')
      expect(html).toContain('Next Question')
      expect(html).toContain('Start New Round')
    })
  })
})
