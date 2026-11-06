import { describe, it, expect, vi } from 'vitest'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'
import { makeT, REVIEWED } from './i18n.js'
import { QUESTIONS, TOPICS, score, progress, isCorrect } from './lib/quiz.js'

describe('translations (NFR-04)', () => {
  it('identical key sets, no empty values', () => {
    const k = Object.keys(en).sort()
    expect(Object.keys(om).sort()).toEqual(k); expect(Object.keys(am).sort()).toEqual(k)
    for (const d of [en, om, am]) for (const v of Object.values(d)) expect(v.trim().length).toBeGreaterThan(0)
  })
  it('falls back to English and reports missing keys', () => {
    const spy = vi.fn(); const t = makeT('om', spy)
    expect(t('nonexistent.key')).toBe('nonexistent.key')
    const t2 = makeT('en'); expect(t2('app.title')).toBe('ABBAY CYBERGUARD')
    expect(spy).toHaveBeenCalled()
  })
  it('no safety guarantee wording in English M1/M4 strings (FR-07, FR-25)', () => {
    const txt = Object.entries(en).filter(([k]) => /^(m1|m4)\./.test(k) && !/caveat|none|scope|exp\./.test(k)).map(([, v]) => v).join(' ').toLowerCase()
    expect(txt).not.toMatch(/\b(is safe|link is safe|certified|compliant|guaranteed)\b/)
    expect(en['app.notice']).not.toMatch(/guarantees security|certified|compliant/)
  })
  it('temporary translation draft-warning banners are disabled across English, Afaan Oromoo, and Amharic', () => {
    expect(REVIEWED.en).toBe(true)
    expect(REVIEWED.om).toBe(true)
    expect(REVIEWED.am).toBe(true)
    expect(!REVIEWED['en']).toBe(false)
    expect(!REVIEWED['om']).toBe(false)
    expect(!REVIEWED['am']).toBe(false)
  })
})
describe('learning content and quiz', () => {
  it('every question has text, 3 options, an explanation, in all languages', () => {
    for (const d of [en, om, am]) for (const q of QUESTIONS) for (const s of ['q', 'o0', 'o1', 'o2', 'x']) expect(d[`learn.q.${q.id}.${s}`]).toBeTruthy()
    for (const d of [en, om, am]) for (const t of TOPICS) { expect(d[`learn.t.${t}`]).toBeTruthy(); expect(d[`learn.b.${t}`]).toBeTruthy() }
  })
  it('correct answers are in range; all five topics covered', () => {
    for (const q of QUESTIONS) expect([0, 1, 2]).toContain(q.answer)
    expect(new Set(QUESTIONS.map((q) => q.topic))).toEqual(new Set(TOPICS))
  })
  it('scoring and progress', () => {
    expect(isCorrect(QUESTIONS[0], 1)).toBe(true); expect(isCorrect(QUESTIONS[0], 0)).toBe(false)
    const a = { q1: 1, q2: 0, q3: 0 }
    expect(score(a)).toBe(2); expect(progress(a)).toEqual({ answered: 3, total: 7, correct: 2 })
  })
})

describe('Afaan Oromoo technical terminology — Browser preservation', () => {
  const affectedKeys = [
    'home.m2',
    'home.hero.pill_offline',
    'm1.local',
    'm1.input_help',
    'm1.ind.IND-02',
    'm1.why.IND-02',
    'm2.check',
    'c.pdf_blocked_fallback',
    'm4.chk.CHK-05',
    'm4.exp.CHK-01',
    'm4.exp.CHK-03',
    'learn.q.q2.o1',
    'learn.session_notice',
    'learn.obj.website',
    'learn.q.q12.q',
    'learn.q.q18.x',
    'journey.privacy_session_note',
    'journey.persistence_disclaimer',
    'journey.storage_limitations',
    'daily.dc_05.o2',
    'daily.dc_08.scenario',
    'm1.input_help_message',
    'm1.input_help_email',
    'm1.char_limit_note',
    'm1.scope_txt_rules',
    'journey.p07.story',
  ]

  it('uses the exact English spelling "Browser" in all affected Afaan Oromoo keys', () => {
    for (const key of affectedKeys) {
      expect(om[key], `Expected key "${key}" to contain "Browser"`).toMatch(/\bBrowser\b/)
    }
  })

  it('contains no transliterated or translated variants of "Browser" across all Afaan Oromoo strings', () => {
    const forbiddenPattern = /\b(birawzar[a-z]*|biraawzar[a-z]*|brawuzar[a-z]*|braawuzer[a-z]*)\b/i
    for (const [key, value] of Object.entries(om)) {
      expect(value, `Key "${key}" contains forbidden transliterated browser term`).not.toMatch(forbiddenPattern)
    }
  })

  it('verifies specific critical user-facing strings retain natural Afaan Oromoo grammar', () => {
    expect(om['c.pdf_blocked_fallback']).toBe(
      "Browser foddaa haaraa cuseera. Maaloo eeyyamaa ykn 'Maxxansi / Gara PDFtti Olkaawi' fayyadamaa."
    )
    expect(om['home.hero.pill_offline']).toBe("100% Browser Keessa & Interneetii Malee")
    expect(om['home.m2']).toContain("Browser kee keessaa hin ba’u")
    expect(om['m1.local']).toContain("Geessituun Browser kee keessatti")
    expect(om['m2.check']).toBe("Jecha icciitii mirkaneessi (Browser kana keessa qofa)")
  })

  it('ensures English and Amharic counterparts remain unmodified', () => {
    expect(en['c.pdf_blocked_fallback']).toBe(
      "Browser blocked opening the tab. Please allow popups or use 'Print / Save to PDF'."
    )
    expect(am['c.pdf_blocked_fallback']).toBe(
      "አሳሹ ትሩን እንዳይከፍት አግዶታል። እባክዎ ብቅ-ባይን ይፍቀዱ ወይም 'አትም / በፒዲኤፍ አስቀምጥ'ን ይጠቀሙ።"
    )
    expect(en['home.hero.pill_offline']).toBe("100% In-Browser & Offline")
    expect(am['home.hero.pill_offline']).toBe("100% በአሳሽ ውስጥና ያለ ኢንተርኔት")
  })
})
