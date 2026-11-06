import { describe, it, expect } from 'vitest'
import {
  TOPICS,
  LEVELS,
  QUICK_CHECKS,
  QUESTION_BANK,
  QUESTIONS,
  isCorrect,
  score,
  progress,
  getQuestionsForLevel,
  evaluateLevel,
} from './quiz.js'

describe('M5 quiz engine and question bank', () => {
  it('has 5 distinct topics', () => {
    expect(TOPICS).toHaveLength(5)
    expect(TOPICS).toEqual(['phishing', 'password', 'privacy', 'response', 'website'])
  })

  it('defines 6 progressive learning levels', () => {
    expect(LEVELS).toHaveLength(6)
    expect(LEVELS.map((l) => l.num)).toEqual([1, 2, 3, 4, 5, 6])
    for (const lvl of LEVELS) {
      expect(lvl.passThreshold).toBe(80)
      expect(lvl.questionIds.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('contains 32 unique, validated questions covering all levels', () => {
    expect(QUESTION_BANK).toHaveLength(32)
    const ids = QUESTION_BANK.map((q) => q.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(32)

    for (const q of QUESTION_BANK) {
      expect(q.id).toMatch(/^q(1\d|2\d|3[0-2]|[1-9])$/)
      expect(TOPICS).toContain(q.topic)
      expect([1, 2, 3, 4, 5, 6]).toContain(q.level)
      expect([0, 1, 2]).toContain(q.answer)
    }
  })

  it('each level covers diverse cybersecurity topics', () => {
    for (let lvl = 1; lvl <= 6; lvl++) {
      const qList = getQuestionsForLevel(lvl)
      expect(qList.length).toBeGreaterThanOrEqual(5)
      const topicsInLevel = new Set(qList.map((q) => q.topic))
      expect(topicsInLevel.size).toBe(5) // all 5 topics present in each level
    }
  })

  it('preserves Level 1 questions as default QUESTIONS export for backward compatibility', () => {
    expect(QUESTIONS).toHaveLength(7)
    expect(QUESTIONS.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'])
  })

  it('isCorrect validates correct and incorrect answers', () => {
    const q1 = QUESTION_BANK.find((q) => q.id === 'q1')
    expect(isCorrect(q1, 1)).toBe(true)
    expect(isCorrect(q1, 0)).toBe(false)
    expect(isCorrect(q1, 2)).toBe(false)
  })

  it('calculates score and progress correctly', () => {
    const ans = { q1: 1, q2: 2, q3: 1 } // q1 correct (1), q2 correct (2), q3 wrong (ans 1, correct 0)
    expect(score(ans)).toBe(2)
    expect(progress(ans)).toEqual({ answered: 3, total: 7, correct: 2 })
  })

  it('evaluates level progression thresholds at boundary values', () => {
    // Level 2 has 5 questions (q8, q9, q10, q11, q12)
    // 5/5 = 100% -> pass
    const perfectLvl2 = { q8: 0, q9: 0, q10: 1, q11: 0, q12: 1 }
    const resPerfect = evaluateLevel(perfectLvl2, 2)
    expect(resPerfect.percentage).toBe(100)
    expect(resPerfect.passed).toBe(true)
    expect(resPerfect.needsReview).toBe(false)
    expect(resPerfect.needsRetry).toBe(false)
    expect(resPerfect.missedTopics).toHaveLength(0)

    // 4/5 = 80% -> pass boundary
    const fourOfFive = { q8: 0, q9: 0, q10: 1, q11: 0, q12: 0 } // q12 incorrect (website)
    const res80 = evaluateLevel(fourOfFive, 2)
    expect(res80.percentage).toBe(80)
    expect(res80.passed).toBe(true)
    expect(res80.needsReview).toBe(false)
    expect(res80.missedTopics).toEqual(['website'])

    // 3/5 = 60% -> review boundary
    const threeOfFive = { q8: 0, q9: 0, q10: 1, q11: 1, q12: 0 } // q11 (response) & q12 (website) incorrect
    const res60 = evaluateLevel(threeOfFive, 2)
    expect(res60.percentage).toBe(60)
    expect(res60.passed).toBe(false)
    expect(res60.needsReview).toBe(true)
    expect(res60.needsRetry).toBe(false)
    expect(res60.missedTopics).toEqual(['response', 'website'])

    // 2/5 = 40% -> retry
    const twoOfFive = { q8: 0, q9: 0, q10: 0, q11: 1, q12: 0 }
    const res40 = evaluateLevel(twoOfFive, 2)
    expect(res40.percentage).toBe(40)
    expect(res40.passed).toBe(false)
    expect(res40.needsReview).toBe(false)
    expect(res40.needsRetry).toBe(true)
    expect(res40.missedTopics.length).toBe(3)
  })

  it('provides quick knowledge checks for all 5 topics', () => {
    for (const topic of TOPICS) {
      expect(QUICK_CHECKS[topic]).toBeDefined()
      expect([0, 1]).toContain(QUICK_CHECKS[topic].answer)
    }
  })

  it('all 22 questions and quick-checks exist across en, om, and am dictionaries', async () => {
    const en = (await import('../locales/en.js')).default
    const om = (await import('../locales/om.js')).default
    const am = (await import('../locales/am.js')).default

    for (const dict of [en, om, am]) {
      // All 22 questions
      for (const q of QUESTION_BANK) {
        expect(dict[`learn.q.${q.id}.q`]).toBeTruthy()
        expect(dict[`learn.q.${q.id}.o0`]).toBeTruthy()
        expect(dict[`learn.q.${q.id}.o1`]).toBeTruthy()
        expect(dict[`learn.q.${q.id}.o2`]).toBeTruthy()
        expect(dict[`learn.q.${q.id}.x`]).toBeTruthy()
      }

      // Quick checks
      for (const topic of TOPICS) {
        expect(dict[`learn.qc.${topic}.q`]).toBeTruthy()
        expect(dict[`learn.qc.${topic}.o0`]).toBeTruthy()
        expect(dict[`learn.qc.${topic}.o1`]).toBeTruthy()
        expect(dict[`learn.qc.${topic}.x`]).toBeTruthy()
      }

      // Level descriptions and badge keys
      for (const lvl of LEVELS) {
        expect(dict[`learn.${lvl.id}.title`]).toBeTruthy()
        expect(dict[`learn.${lvl.id}.desc`]).toBeTruthy()
      }
      expect(dict['learn.enc.excellent']).toBeTruthy()
      expect(dict['learn.enc.good']).toBeTruthy()
      expect(dict['learn.enc.practice']).toBeTruthy()
      expect(dict['learn.badge.mastered']).toBeTruthy()
      expect(dict['learn.curriculum']).toBeTruthy()
    }
  })
})

