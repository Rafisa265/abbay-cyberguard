/**
 * CyberShield Ethiopia — Machine Learning Parity, Robustness & Privacy Suite
 * 
 * Verifies:
 * 1. Exact numerical parity of pure JS Softmax forward pass against authoritative Python reference vectors (tolerance: 1e-5).
 * 2. Exact feature extraction parity matching backend/app/ml/features.py across representative learner profiles.
 * 3. Robustness against non-finite, missing, out-of-bounds, and malformed inputs.
 * 4. Deterministic pedagogical safety guardrails (zero-history, minimum-attempt, category-remediation, low-confidence fallback).
 * 5. Strict privacy boundary: 100% offline local inference, non-mutation of learner progress, and complete suppression of unconsented network telemetry.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  extractFeatureVector,
  predictSoftmax,
  predictLocalAdaptiveRecommendation,
  determineAdaptiveRecommendation,
  fetchMlAdaptiveRecommendation,
  setCachedMlRecommendation,
  getCachedMlRecommendation,
  resetJourneyProgress,
  getJourneyProgress,
  evaluateChoice,
} from './lib/journey.js'
import {
  CLASSES,
  NUM_FEATURES,
  WEIGHTS,
  BIASES,
  CONFIDENCE_THRESHOLD,
  DATASET_LIMITATION_STATEMENT,
} from './lib/journeyModelWeights.js'
import * as api from './lib/api.js'

describe('ML Phase 4: Forward Pass Numerical Parity Suite', () => {
  const TOLERANCE = 1e-5

  it('A. All zeros vector [0, 0, 0, 0, 0, 0, 0, 0]', () => {
    const input = [0, 0, 0, 0, 0, 0, 0, 0]
    const res = predictSoftmax(input)

    expect(res.bestClass).toBe('intermediate')
    expect(res.probabilities.beginner).toBeCloseTo(0.33801368124748, 5)
    expect(res.probabilities.intermediate).toBeCloseTo(0.66095183719963, 5)
    expect(res.probabilities.advanced).toBeCloseTo(0.00103448155289, 5)

    expect(Math.abs(res.probabilities.beginner - 0.33801368124748)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.intermediate - 0.66095183719963)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.advanced - 0.00103448155289)).toBeLessThan(TOLERANCE)
  })

  it('B. All neutral vector [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]', () => {
    const input = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
    const res = predictSoftmax(input)

    expect(res.bestClass).toBe('intermediate')
    expect(res.probabilities.beginner).toBeCloseTo(0.45511351771992, 5)
    expect(res.probabilities.intermediate).toBeCloseTo(0.49208409054960, 5)
    expect(res.probabilities.advanced).toBeCloseTo(0.05280239173048, 5)

    expect(Math.abs(res.probabilities.beginner - 0.45511351771992)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.intermediate - 0.49208409054960)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.advanced - 0.05280239173048)).toBeLessThan(TOLERANCE)
  })

  it('C. All ones vector [1, 1, 1, 1, 1, 1, 1, 1]', () => {
    const input = [1, 1, 1, 1, 1, 1, 1, 1]
    const res = predictSoftmax(input)

    expect(res.bestClass).toBe('advanced')
    expect(res.probabilities.beginner).toBeCloseTo(0.16677482057381, 5)
    expect(res.probabilities.intermediate).toBeCloseTo(0.09970894593026, 5)
    expect(res.probabilities.advanced).toBeCloseTo(0.73351623349593, 5)

    expect(Math.abs(res.probabilities.beginner - 0.16677482057381)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.intermediate - 0.09970894593026)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.advanced - 0.73351623349593)).toBeLessThan(TOLERANCE)
  })

  it('D. Struggling beginner vector [0.1, 0.2, 0, 0, 0.9, 0.8, 0.3, 0.4]', () => {
    const input = [0.1, 0.2, 0, 0, 0.9, 0.8, 0.3, 0.4]
    const res = predictSoftmax(input)

    expect(res.bestClass).toBe('beginner')
    expect(res.probabilities.beginner).toBeCloseTo(0.98996690624694, 5)
    expect(res.probabilities.intermediate).toBeCloseTo(0.01003018432660, 5)
    expect(res.probabilities.advanced).toBeCloseTo(0.00000290942646, 5)

    expect(Math.abs(res.probabilities.beginner - 0.98996690624694)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.intermediate - 0.01003018432660)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.advanced - 0.00000290942646)).toBeLessThan(TOLERANCE)
  })

  it('E. Advanced master vector [0.95, 0.9, 1, 1, 0.05, 0, 0.8, 0.7]', () => {
    const input = [0.95, 0.9, 1, 1, 0.05, 0, 0.8, 0.7]
    const res = predictSoftmax(input)

    expect(res.bestClass).toBe('advanced')
    expect(res.probabilities.beginner).toBeCloseTo(0.00003349332432, 5)
    expect(res.probabilities.intermediate).toBeCloseTo(0.01761854220907, 5)
    expect(res.probabilities.advanced).toBeCloseTo(0.98234796446661, 5)

    expect(Math.abs(res.probabilities.beginner - 0.00003349332432)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.intermediate - 0.01761854220907)).toBeLessThan(TOLERANCE)
    expect(Math.abs(res.probabilities.advanced - 0.98234796446661)).toBeLessThan(TOLERANCE)
  })

  it('verifies probability axioms: finite, non-negative, and summing to 1', () => {
    const testVectors = [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0.1, 0.2, 0, 0, 0.9, 0.8, 0.3, 0.4],
      [0.95, 0.9, 1, 1, 0.05, 0, 0.8, 0.7],
      [0.3, 0.7, 0.5, 0.4, 0.1, 0.2, 0.8, 0.6],
    ]

    for (const vec of testVectors) {
      const res = predictSoftmax(vec)
      let sum = 0
      for (const cls of CLASSES) {
        const p = res.probabilities[cls]
        expect(Number.isFinite(p)).toBe(true)
        expect(p).toBeGreaterThanOrEqual(0.0)
        expect(p).toBeLessThanOrEqual(1.0)
        sum += p
      }
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10)
    }
  })

  it('preserves class ordering (beginner, intermediate, advanced)', () => {
    expect(CLASSES).toEqual(['beginner', 'intermediate', 'advanced'])
    expect(NUM_FEATURES).toBe(8)
    expect(WEIGHTS.length).toBe(3)
    expect(BIASES.length).toBe(3)
  })
})

describe('ML Phase 4: Feature Extraction Parity with Python Implementation', () => {
  const TOLERANCE = 1e-5

  it('Case 1: Empty progress telemetry matches Python baseline', () => {
    // Python: JourneyLearningTelemetry() -> [0.5, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5]
    const vec = extractFeatureVector({})
    expect(vec).toHaveLength(8)
    expect(vec[0]).toBeCloseTo(0.5, 5) // recent_acc
    expect(vec[1]).toBeCloseTo(0.5, 5) // overall_acc
    expect(vec[2]).toBeCloseTo(0.0, 5) // current_difficulty (beginner)
    expect(vec[3]).toBeCloseTo(0.0, 5) // consecutive_correct_norm
    expect(vec[4]).toBeCloseTo(0.0, 5) // max_category_error_rate
    expect(vec[5]).toBeCloseTo(0.0, 5) // error_deficit_score
    expect(vec[6]).toBeCloseTo(0.0, 5) // attempt_volume_norm
    expect(vec[7]).toBeCloseTo(0.5, 5) // recent_trend neutral
  })

  it('Case 2: Beginner learner with 1 correct attempt matches Python reference', () => {
    // Python: [1.0, 1.0, 0.0, 0.2, 0.0, 0.0, 0.05, 0.5]
    const progress = {
      recentOutcomes: [{ category: 'phishing', difficulty: 'beginner', isCorrect: true }],
      categoryStats: { phishing: { attempts: 1, correct: 1, wrong: 0 } },
      difficultyStats: { beginner: { attempts: 1, correct: 1, wrong: 0 } },
      currentDifficulty: 'beginner',
    }

    const vec = extractFeatureVector(progress)
    expect(vec[0]).toBeCloseTo(1.0, 5)
    expect(vec[1]).toBeCloseTo(1.0, 5)
    expect(vec[2]).toBeCloseTo(0.0, 5)
    expect(vec[3]).toBeCloseTo(0.2, 5) // streak 1 / 5
    expect(vec[4]).toBeCloseTo(0.0, 5) // attempts < 2 for category -> error rate 0
    expect(vec[5]).toBeCloseTo(0.0, 5) // deficit 0
    expect(vec[6]).toBeCloseTo(0.05, 5) // 1 / 20 = 0.05
    expect(vec[7]).toBeCloseTo(0.5, 5) // < 4 outcomes -> trend 0.5
  })

  it('Case 3: Category error remediation profile matches Python reference', () => {
    // Python: [0.333333, 0.333333, 0.0, 0.2, 1.0, 0.4, 0.15, 0.5]
    const progress = {
      recentOutcomes: [
        { category: 'sim_swap', difficulty: 'beginner', isCorrect: false },
        { category: 'sim_swap', difficulty: 'beginner', isCorrect: false },
        { category: 'phishing', difficulty: 'beginner', isCorrect: true },
      ],
      categoryStats: {
        sim_swap: { attempts: 2, correct: 0, wrong: 2, consecutiveCorrect: 0 },
        phishing: { attempts: 1, correct: 1, wrong: 0, consecutiveCorrect: 1 },
      },
      difficultyStats: {
        beginner: { attempts: 3, correct: 1, wrong: 2 },
      },
      currentDifficulty: 'beginner',
    }

    const vec = extractFeatureVector(progress)
    expect(vec[0]).toBeCloseTo(1 / 3, 5)
    expect(vec[1]).toBeCloseTo(1 / 3, 5)
    expect(vec[2]).toBeCloseTo(0.0, 5)
    expect(vec[3]).toBeCloseTo(0.2, 5) // last outcome was correct -> streak 1 / 5 = 0.2
    expect(vec[4]).toBeCloseTo(1.0, 5) // sim_swap has 2 attempts, 2 wrong -> 1.0
    expect(vec[5]).toBeCloseTo(0.4, 5) // deficit = 2 - 0 = 2 -> 2 / 5 = 0.4
    expect(vec[6]).toBeCloseTo(0.15, 5) // 3 / 20 = 0.15
    expect(vec[7]).toBeCloseTo(0.5, 5) // 3 outcomes < 4 -> trend 0.5
  })

  it('Case 4: Long history with recent trend momentum matches Python reference', () => {
    // Python: [0.6, 0.428571, 0.5, 0.6, 1.0, 0.6, 0.35, 1.0]
    const progress = {
      recentOutcomes: [
        { category: 'phishing', difficulty: 'intermediate', isCorrect: false },
        { category: 'phishing', difficulty: 'intermediate', isCorrect: false },
        { category: 'phishing', difficulty: 'intermediate', isCorrect: false },
        { category: 'sim_swap', difficulty: 'intermediate', isCorrect: false },
        { category: 'banking', difficulty: 'intermediate', isCorrect: true },
        { category: 'banking', difficulty: 'intermediate', isCorrect: true },
        { category: 'banking', difficulty: 'intermediate', isCorrect: true },
      ],
      categoryStats: {
        phishing: { attempts: 3, correct: 0, wrong: 3 },
        sim_swap: { attempts: 1, correct: 0, wrong: 1 },
        banking: { attempts: 3, correct: 3, wrong: 0 },
      },
      difficultyStats: {
        intermediate: { attempts: 7, correct: 3, wrong: 4 },
      },
      currentDifficulty: 'intermediate',
    }

    const vec = extractFeatureVector(progress)
    expect(vec[0]).toBeCloseTo(0.6, 5) // last 5 outcomes: [F, F, T, T, T] -> 3/5 = 0.6
    expect(vec[1]).toBeCloseTo(3 / 7, 5) // 3/7 = 0.428571...
    expect(vec[2]).toBeCloseTo(0.5, 5) // intermediate = 0.5
    expect(vec[3]).toBeCloseTo(0.6, 5) // 3 consecutive correct -> 3 / 5 = 0.6
    expect(vec[4]).toBeCloseTo(1.0, 5) // phishing error rate 3/3 = 1.0
    expect(vec[5]).toBeCloseTo(0.6, 5) // deficit 3 / 5 = 0.6
    expect(vec[6]).toBeCloseTo(0.35, 5) // 7 attempts / 20 = 0.35
    expect(vec[7]).toBeCloseTo(1.0, 5) // late acc = 3/3=1.0, prior = 0/3=0.0 -> 0.5 + (1.0 * 0.5) = 1.0
  })

  it('Case 5: Saturation clamping for streaks, attempts, and deficits', () => {
    const outcomes = Array.from({ length: 25 }, () => ({
      category: 'general',
      difficulty: 'advanced',
      isCorrect: true,
    }))
    const progress = {
      recentOutcomes: outcomes,
      categoryStats: {
        general: { attempts: 25, correct: 25, wrong: 0 },
        threat: { attempts: 10, correct: 0, wrong: 10 },
      },
      difficultyStats: {
        advanced: { attempts: 35, correct: 25, wrong: 10 },
      },
      currentDifficulty: 'advanced',
    }

    const vec = extractFeatureVector(progress)
    expect(vec[2]).toBe(1.0) // advanced
    expect(vec[3]).toBe(1.0) // 25 streak clamped to 5/5 = 1.0
    expect(vec[5]).toBe(1.0) // deficit 10 clamped to 5/5 = 1.0
    expect(vec[6]).toBe(1.0) // 35 attempts clamped to 20/20 = 1.0
  })
})

describe('ML Phase 4: Robustness & Non-Finite Input Handling', () => {
  it('safely handles non-finite inputs (NaN, Infinity, null, undefined) in forward pass', () => {
    const dirty = [NaN, Infinity, -Infinity, null, undefined, 2.5, -1.0, NaN]
    const res = predictSoftmax(dirty)

    expect(res).toBeDefined()
    expect(CLASSES).toContain(res.bestClass)
    expect(Number.isFinite(res.confidence)).toBe(true)
    for (const p of Object.values(res.probabilities)) {
      expect(Number.isFinite(p)).toBe(true)
      expect(p).toBeGreaterThanOrEqual(0.0)
    }
  })

  it('rejects invalid length vectors with a clean error', () => {
    expect(() => predictSoftmax([0.5, 0.5])).toThrow(/Feature vector must be an array of length 8/)
    expect(() => predictSoftmax('not-an-array')).toThrow(/Feature vector must be an array of length 8/)
  })

  it('safely extracts features from corrupted or malformed progress states', () => {
    const malformed = {
      recentOutcomes: 'not-an-array',
      categoryStats: null,
      difficultyStats: { beginner: { attempts: 'invalid' } },
      currentDifficulty: 9999,
    }

    const vec = extractFeatureVector(malformed)
    expect(vec).toHaveLength(8)
    for (const val of vec) {
      expect(Number.isFinite(val)).toBe(true)
      expect(val).toBeGreaterThanOrEqual(0.0)
      expect(val).toBeLessThanOrEqual(1.0)
    }
  })
})

describe('ML Phase 4: Deterministic Guardrails & Pedagogical Fallback Integrity', () => {
  beforeEach(() => {
    resetJourneyProgress()
    setCachedMlRecommendation(null)
  })

  it('Guardrail 1: Zero-history learner cannot be advanced by ML', () => {
    const zeroProgress = {
      completedMissions: {},
      recentOutcomes: [],
      categoryStats: {},
      difficultyStats: {},
      totalXp: 0,
    }

    const rec = predictLocalAdaptiveRecommendation(zeroProgress)
    expect(rec.engine).toBe('deterministic_fallback')
    expect(rec.difficulty).toBe('beginner')
    expect(rec.confidence).toBe(1.0)
    expect(rec.reason).toBe('insufficient_data')
  })

  it('Guardrail 2: Insufficient attempts prevent premature advancement', () => {
    // 1 single attempt: ML is highly confident (0.91 for advanced), but policy requires >= 2 attempts to advance
    const oneAttempt = {
      completedMissions: {},
      recentOutcomes: [{ category: 'phishing', difficulty: 'advanced', isCorrect: true }],
      categoryStats: { phishing: { attempts: 1, correct: 1, wrong: 0 } },
      difficultyStats: { advanced: { attempts: 1, correct: 1, wrong: 0 } },
      currentDifficulty: 'advanced',
    }

    const rec = predictLocalAdaptiveRecommendation(oneAttempt)
    // Guardrail prevents advancement on single attempt
    expect(rec.difficulty).toBe('beginner')
    expect(rec.reason).toBe('insufficient_attempts_to_advance')
  })

  it('Guardrail 3: Category remediation takes precedence over ML difficulty advancement', () => {
    // Player has high volume and correct answers overall, but struggling in sim_swap
    const progress = {
      completedMissions: { m01: { completed: true }, m02: { completed: true } },
      recentOutcomes: [
        { category: 'phishing', difficulty: 'intermediate', isCorrect: true },
        { category: 'phishing', difficulty: 'intermediate', isCorrect: true },
        { category: 'sim_swap', difficulty: 'intermediate', isCorrect: false },
        { category: 'sim_swap', difficulty: 'intermediate', isCorrect: false },
      ],
      categoryStats: {
        phishing: { attempts: 2, correct: 2, wrong: 0 },
        sim_swap: { attempts: 2, correct: 0, wrong: 2, consecutiveCorrect: 0 },
      },
      difficultyStats: {
        intermediate: { attempts: 4, correct: 2, wrong: 2 },
      },
      currentDifficulty: 'intermediate',
    }

    const rec = predictLocalAdaptiveRecommendation(progress)
    expect(rec.difficulty).toBe('beginner')
    expect(rec.targetCategory).toBe('sim_swap')
    expect(rec.reason).toBe('ml_remediation_policy_for_sim_swap')
  })

  it('Guardrail 4: Low-confidence prediction triggers deterministic fallback', () => {
    // When confidence is artificially low (< 0.55), deterministic engine takes over
    const progress = {
      completedMissions: { m01: { completed: true } },
      recentOutcomes: [
        { category: 'general', difficulty: 'beginner', isCorrect: true },
        { category: 'general', difficulty: 'beginner', isCorrect: true },
      ],
      categoryStats: { general: { attempts: 2, correct: 2, wrong: 0 } },
      difficultyStats: { beginner: { attempts: 2, correct: 2, wrong: 0 } },
      currentDifficulty: 'beginner',
    }

    // Set low confidence cached recommendation
    setCachedMlRecommendation({
      difficulty: 'advanced',
      engine: 'ml_softmax_v1',
      confidence: 0.40,
      reason: 'low_confidence_test',
    })

    const rec = determineAdaptiveRecommendation(progress, true)
    // Low confidence cached recommendation is rejected; deterministic fallback used
    expect(rec.engine).toBe('deterministic_fallback')
  })

  it('Inference non-mutation: predictLocalAdaptiveRecommendation does NOT mutate progress', () => {
    const originalProgress = {
      schemaVersion: 2,
      totalXp: 150,
      completedMissions: { m01: { completed: true, stars: 3 } },
      categoryStats: { phishing: { attempts: 3, correct: 2, wrong: 1 } },
      difficultyStats: { beginner: { attempts: 3, correct: 2, wrong: 1 } },
      recentOutcomes: [{ category: 'phishing', difficulty: 'beginner', isCorrect: true }],
      activeMissionId: 'm02',
    }

    const snapshot = JSON.parse(JSON.stringify(originalProgress))
    predictLocalAdaptiveRecommendation(originalProgress)
    expect(originalProgress).toEqual(snapshot)
  })
})

describe('ML Phase 4: Privacy Boundary & Zero Unconsented Telemetry Suite', () => {
  beforeEach(() => {
    resetJourneyProgress()
    setCachedMlRecommendation(null)
    vi.restoreAllMocks()
  })

  it('local ML inference executes with zero network requests', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const apiSpy = vi.spyOn(api, 'getMlAdaptiveRecommendation')

    const progress = {
      completedMissions: { m01: { completed: true } },
      recentOutcomes: [
        { category: 'phishing', difficulty: 'beginner', isCorrect: true },
        { category: 'phishing', difficulty: 'beginner', isCorrect: true },
      ],
      categoryStats: { phishing: { attempts: 2, correct: 2, wrong: 0 } },
      difficultyStats: { beginner: { attempts: 2, correct: 2, wrong: 0 } },
    }

    const rec = predictLocalAdaptiveRecommendation(progress)
    expect(rec).toBeDefined()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(apiSpy).not.toHaveBeenCalled()
  })

  it('guest learner (user = null) in fetchMlAdaptiveRecommendation suppresses network requests', async () => {
    const apiSpy = vi.spyOn(api, 'getMlAdaptiveRecommendation')

    const progress = getJourneyProgress()
    const rec = await fetchMlAdaptiveRecommendation(progress, null) // Guest user

    expect(apiSpy).not.toHaveBeenCalled()
    expect(rec).toBeDefined()
    expect(rec.offlineCapable).toBe(true)
  })

  it('explicit guest flag ({ isGuest: true }) suppresses network requests', async () => {
    const apiSpy = vi.spyOn(api, 'getMlAdaptiveRecommendation')

    const progress = getJourneyProgress()
    const rec = await fetchMlAdaptiveRecommendation(progress, { isGuest: true })

    expect(apiSpy).not.toHaveBeenCalled()
    expect(rec).toBeDefined()
  })

  it('authenticated user without cloud-sync consent suppresses network requests', async () => {
    const apiSpy = vi.spyOn(api, 'getMlAdaptiveRecommendation')

    const userWithoutConsent = {
      id: 'usr_abc123',
      displayName: 'Alice',
      preferences: { cloud_progress_sync_enabled: false },
    }

    const progress = getJourneyProgress()
    const rec = await fetchMlAdaptiveRecommendation(progress, userWithoutConsent)

    expect(apiSpy).not.toHaveBeenCalled()
    expect(rec).toBeDefined()
  })

  it('gameplay evaluateChoice runs ML locally without triggering network requests', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const apiSpy = vi.spyOn(api, 'getMlAdaptiveRecommendation')

    const outcome = evaluateChoice('m01', 'choice_verify_official')
    expect(outcome.isCorrect).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(apiSpy).not.toHaveBeenCalled()
  })

  it('includes authoritative dataset limitation statement', () => {
    expect(DATASET_LIMITATION_STATEMENT).toContain('synthetic pipeline data')
    expect(DATASET_LIMITATION_STATEMENT).toContain('not been trained or evaluated on human student cohorts')

    const rec = predictLocalAdaptiveRecommendation({})
    expect(rec.offlineCapable).toBe(true)
  })
})
