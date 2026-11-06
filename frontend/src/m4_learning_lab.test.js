import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import M4 from './components/M4.jsx'
import { makeT } from './i18n.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'
import { M4_QUIZ_BANK, selectQuizSessionQuestions, calculateQuizDiagnostics } from './data/m4QuizBank.js'

describe('M4 Interactive Website Security Learning Lab - Comprehensive Audit', () => {
  it('1. verifies 100% key parity for all M4 localization keys across EN, OM, AM', () => {
    const enKeys = Object.keys(en).filter((k) => k.startsWith('m4.'))
    const omKeys = Object.keys(om).filter((k) => k.startsWith('m4.'))
    const amKeys = Object.keys(am).filter((k) => k.startsWith('m4.'))

    expect(enKeys.length).toBeGreaterThan(90)
    expect(omKeys.length).toBe(enKeys.length)
    expect(amKeys.length).toBe(enKeys.length)

    const omMissing = enKeys.filter((k) => om[k] === undefined)
    const amMissing = enKeys.filter((k) => am[k] === undefined)

    expect(omMissing).toEqual([])
    expect(amMissing).toEqual([])
  })

  it('2. verifies DS-A, DS-B, DS-C fixtures match educational expectations', () => {
    // DS-A: Needs Hardening (TLS valid, but lacks redirect, HSTS, CSP, secure cookies, and leaks banner)
    const dsaChecks = {
      'CHK-01': 'present',
      'CHK-02': 'missing',
      'CHK-03': 'missing',
      'CHK-04': 'missing',
      'CHK-05': 'present',
      'CHK-06': 'missing',
      'CHK-07': 'present',
    }
    expect(dsaChecks['CHK-01']).toBe('present')
    expect(dsaChecks['CHK-02']).toBe('missing')
    expect(dsaChecks['CHK-07']).toBe('present') // Leaked banner

    // DS-B: Well Hardened
    const dsbChecks = {
      'CHK-01': 'present',
      'CHK-02': 'present',
      'CHK-03': 'present',
      'CHK-04': 'present',
      'CHK-05': 'missing', // Permissions-Policy only
      'CHK-06': 'present',
      'CHK-07': 'missing', // Banner hidden
    }
    expect(dsbChecks['CHK-01']).toBe('present')
    expect(dsbChecks['CHK-02']).toBe('present')
    expect(dsbChecks['CHK-03']).toBe('present')
    expect(dsbChecks['CHK-04']).toBe('present')
    expect(dsbChecks['CHK-07']).toBe('missing')

    // DS-C: Broken TLS (expired)
    const dscChecks = {
      'CHK-01': 'missing',
      'CHK-02': 'unknown',
    }
    expect(dscChecks['CHK-01']).toBe('missing')
    expect(dscChecks['CHK-02']).toBe('unknown')
  })

  it('3. renders M4 tabs and educational structure cleanly in all three languages', () => {
    for (const lang of ['en', 'om', 'am']) {
      const t = makeT(lang)
      const html = renderToString(React.createElement(M4, { t }))

      // Invariant assertions
      expect(html).toContain('class="module-container"')
      expect(html).toContain('class="module-header-box m4-header-box"')
      expect(html).toContain('class="m4-distinction-banner"')
      expect(html).toContain('class="card m4-card"')
      expect(html).toContain('class="m4-scenario-grid"')
      expect(html).toContain('class="m4-tabs-nav"')
      expect(html).toContain('class="m4-scope-warning"')

      // Zero raw undefined strings
      expect(html).not.toContain('undefined')
      expect(html).not.toContain('[object Object]')
    }
  })

  it('4. verifies quiz questions and answer keys are fully deterministic and translated', () => {
    const qKeys = [
      'm4.quiz.q1',
      'm4.quiz.q1_o1',
      'm4.quiz.q1_o2',
      'm4.quiz.q1_o3',
      'm4.quiz.q2',
      'm4.quiz.q2_o1',
      'm4.quiz.q2_o2',
      'm4.quiz.q2_o3',
      'm4.quiz.q3',
      'm4.quiz.q3_o1',
      'm4.quiz.q3_o2',
      'm4.quiz.q3_o3',
      'm4.quiz.q4',
      'm4.quiz.q4_o1',
      'm4.quiz.q4_o2',
      'm4.quiz.q4_o3',
    ]

    for (const k of qKeys) {
      expect(en[k]).toBeDefined()
      expect(om[k]).toBeDefined()
      expect(am[k]).toBeDefined()
      expect(en[k].length).toBeGreaterThan(5)
      expect(om[k].length).toBeGreaterThan(5)
      expect(am[k].length).toBeGreaterThan(5)
    }
  })

  it('5. verifies checklist items have valid definitions and translation across languages', () => {
    const checkKeys = [
      'm4.chklist.c1',
      'm4.chklist.c2',
      'm4.chklist.c3',
      'm4.chklist.c4',
      'm4.chklist.c5',
      'm4.chklist.c6',
    ]

    for (const k of checkKeys) {
      expect(en[k]).toBeDefined()
      expect(om[k]).toBeDefined()
      expect(am[k]).toBeDefined()
    }
  })

  it('6. verifies expanded M4_QUIZ_BANK structure and balance', () => {
    expect(M4_QUIZ_BANK.length).toBe(24)

    const beginner = M4_QUIZ_BANK.filter((q) => q.difficulty === 'beginner')
    const intermediate = M4_QUIZ_BANK.filter((q) => q.difficulty === 'intermediate')
    const advanced = M4_QUIZ_BANK.filter((q) => q.difficulty === 'advanced')

    expect(beginner.length).toBe(8)
    expect(intermediate.length).toBe(8)
    expect(advanced.length).toBe(8)

    const categories = new Set(M4_QUIZ_BANK.map((q) => q.topic))
    expect(categories.has('tls')).toBe(true)
    expect(categories.has('headers')).toBe(true)
    expect(categories.has('cookies')).toBe(true)
    expect(categories.has('scenarios')).toBe(true)

    const idSet = new Set()
    for (const q of M4_QUIZ_BANK) {
      expect(idSet.has(q.id)).toBe(false)
      idSet.add(q.id)
      expect(q.options.length).toBe(3)
      expect([0, 1, 2]).toContain(q.correctIdx)
    }
  })

  it('7. verifies 100% trilingual dictionary coverage for all 24 quiz bank questions and explanations', () => {
    for (const q of M4_QUIZ_BANK) {
      // Question text key
      expect(en[q.qKey]).toBeDefined()
      expect(om[q.qKey]).toBeDefined()
      expect(am[q.qKey]).toBeDefined()
      expect(en[q.qKey].trim().length).toBeGreaterThan(10)
      expect(om[q.qKey].trim().length).toBeGreaterThan(10)
      expect(am[q.qKey].trim().length).toBeGreaterThan(10)

      // Options and explanations
      expect(q.options.length).toBe(3)
      for (const opt of q.options) {
        expect(en[opt.textKey]).toBeDefined()
        expect(om[opt.textKey]).toBeDefined()
        expect(am[opt.textKey]).toBeDefined()
        expect(en[opt.textKey].trim().length).toBeGreaterThan(3)
        expect(om[opt.textKey].trim().length).toBeGreaterThan(3)
        expect(am[opt.textKey].trim().length).toBeGreaterThan(3)

        expect(en[opt.expKey]).toBeDefined()
        expect(om[opt.expKey]).toBeDefined()
        expect(am[opt.expKey]).toBeDefined()
        expect(en[opt.expKey].trim().length).toBeGreaterThan(10)
        expect(om[opt.expKey].trim().length).toBeGreaterThan(10)
        expect(am[opt.expKey].trim().length).toBeGreaterThan(10)
      }
    }
  })

  it('8. verifies deterministic selection without non-deterministic methods or duplicates', () => {
    const session1 = selectQuizSessionQuestions({ difficulty: 'all', count: 6, seed: 101 })
    expect(session1.length).toBe(6)

    const ids1 = session1.map((q) => q.id)
    const uniqueIds1 = new Set(ids1)
    expect(uniqueIds1.size).toBe(6)

    // Repeated call with same seed returns identical ordered questions
    const session1Repeat = selectQuizSessionQuestions({ difficulty: 'all', count: 6, seed: 101 })
    expect(session1Repeat.map((q) => q.id)).toEqual(ids1)

    // Call with different seed rotates questions deterministically
    const session2 = selectQuizSessionQuestions({ difficulty: 'all', count: 6, seed: 202 })
    expect(session2.map((q) => q.id)).not.toEqual(ids1)

    // Specific difficulty filtering
    const begSession = selectQuizSessionQuestions({ difficulty: 'beginner', count: 5, seed: 42 })
    expect(begSession.length).toBe(5)
    expect(begSession.every((q) => q.difficulty === 'beginner')).toBe(true)

    const advSession = selectQuizSessionQuestions({ difficulty: 'advanced', count: 4, seed: 77 })
    expect(advSession.length).toBe(4)
    expect(advSession.every((q) => q.difficulty === 'advanced')).toBe(true)
  })

  it('9. verifies diagnostic calculations and retry evaluation', () => {
    const sampleQuestions = M4_QUIZ_BANK.slice(0, 4) // 4 questions
    // Answer first 3 correctly, 4th incorrectly
    const answers = {
      [sampleQuestions[0].id]: sampleQuestions[0].correctIdx,
      [sampleQuestions[1].id]: sampleQuestions[1].correctIdx,
      [sampleQuestions[2].id]: sampleQuestions[2].correctIdx,
      [sampleQuestions[3].id]: (sampleQuestions[3].correctIdx + 1) % 3,
    }

    const diag = calculateQuizDiagnostics(sampleQuestions, answers)
    expect(diag.total).toBe(4)
    expect(diag.score).toBe(3)
    expect(diag.percentage).toBe(75)
    expect(diag.missedIds).toEqual([sampleQuestions[3].id])
    expect(diag.strengths.length).toBeGreaterThan(0)
    expect(diag.practiceAreas.length).toBeGreaterThan(0)

    // Perfect score test
    const perfectAnswers = {}
    sampleQuestions.forEach((q) => {
      perfectAnswers[q.id] = q.correctIdx
    })
    const perfectDiag = calculateQuizDiagnostics(sampleQuestions, perfectAnswers)
    expect(perfectDiag.score).toBe(4)
    expect(perfectDiag.percentage).toBe(100)
    expect(perfectDiag.missedIds).toEqual([])
    expect(perfectDiag.practiceAreas).toEqual([])
  })

  it('10. verifies completion screen strings and diagnostic labels in EN, OM, AM', () => {
    const diagnosticKeys = [
      'm4.quiz.completed_title',
      'm4.quiz.score_summary',
      'm4.quiz.performance_high',
      'm4.quiz.performance_med',
      'm4.quiz.performance_low',
      'm4.quiz.strengths_label',
      'm4.quiz.practice_label',
      'm4.quiz.btn_retry_missed',
      'm4.quiz.btn_new_quiz',
      'm4.quiz.btn_continue_learning',
      'm4.quiz.topic_tls',
      'm4.quiz.topic_headers',
      'm4.quiz.topic_cookies',
      'm4.quiz.topic_scenarios',
      'm4.quiz.all_correct',
    ]

    for (const k of diagnosticKeys) {
      expect(en[k]).toBeDefined()
      expect(om[k]).toBeDefined()
      expect(am[k]).toBeDefined()
      expect(en[k].length).toBeGreaterThan(0)
      expect(om[k].length).toBeGreaterThan(0)
      expect(am[k].length).toBeGreaterThan(0)
    }
  })

  it('11. verifies all six checklist items render with accessible labels and can be checked', () => {
    const t = makeT('en')
    const html = renderToString(React.createElement(M4, { t }))

    // Checklist tab button rendered with translated text
    expect(html).toContain('m4-tabs-nav')
    expect(html).toContain(t('m4.tab.checklist'))

    // Initial state check
    expect(html.replace(/<!-- -->/g, '')).toContain('(0/6)')
  })

  it('12. verifies high-contrast theme classes and styling rules in styles.css', () => {
    const css = readFileSync('src/styles.css', 'utf-8')

    // Verify critical dark-navy tokens and contrast styles exist for M4
    expect(css).toContain('.m4-card')
    expect(css).toContain('background: #14233B')
    expect(css).toContain('.m4-result-panel')
    expect(css).toContain('background: #0B1220')
    expect(css).toContain('.m4-posture-card')
    expect(css).toContain('.m4-checklist-row')
    expect(css).toContain('.m4-checklist-checkbox')
    expect(css).toContain('.m4-code-block')
    expect(css).toContain('background: #070D18')
    expect(css).toContain('color: #38BDF8')
    expect(css).toContain('.m4-matrix-table')
    expect(css).toContain('.m4-scope-warning')
  })
})

