import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analyze, generate, randomInt, CLASSES } from './lib/m2.js'
import {
  awardM2PracticeCompletion,
  getJourneyProgress,
  resetJourneyProgress,
  saveJourneyProgress,
  reconcileProgressIntegrity,
  JOURNEY_STORAGE_KEY,
} from './lib/journey.js'

describe('M2 Password Strength Analyzer - Comprehensive Audit', () => {
  it('gracefully handles empty, whitespace-only, non-string, and null inputs', () => {
    expect(analyze('')).toBeNull()
    expect(analyze(null)).toBeNull()
    expect(analyze(undefined)).toBeNull()
    expect(analyze('   ')).toBeNull()
    expect(analyze('\t\n  ')).toBeNull()
    expect(analyze(123456)).toBeNull()
    expect(analyze({})).toBeNull()
    expect(analyze([])).toBeNull()
    expect(analyze(false)).toBeNull()
  })

  it('detects common weak passwords including Ethiopian context and affixed patterns', () => {
    const ethiopianWeak = [
      'ethiopia',
      'ethiopia123',
      'telebirr',
      'telebirr123',
      'telecom',
      'cbe123',
      'cbe1234',
      'cbebirr',
      'habesha',
      'selam',
      'selam123',
      'addisababa',
      'oromia',
      'amhara',
      'tigray',
    ]

    for (const pw of ethiopianWeak) {
      const res = analyze(pw)
      expect(res, `Failed for ${pw}`).not.toBeNull()
      expect(res.category, `Category too high for ${pw}`).toBe(0)
      expect(res.feedback, `Missing 'common' feedback for ${pw}`).toContain('common')
    }

    // Affixed variations (adding symbols or numbers before/after)
    const affixedWeak = [
      '@telebirr',
      '!ethiopia',
      'telebirr@2024!',
      'cbe1234#',
      '123password!',
      '@admin123@',
    ]
    for (const pw of affixedWeak) {
      const res = analyze(pw)
      expect(res, `Failed for affixed ${pw}`).not.toBeNull()
      expect(res.category, `Category too high for affixed ${pw}`).toBeLessThanOrEqual(1)
      expect(res.feedback, `Missing 'common' feedback for affixed ${pw}`).toContain('common')
    }

    const globalWeak = ['password', '123456', 'admin', 'qwerty', 'letmein', 'welcome']
    for (const pw of globalWeak) {
      const res = analyze(pw)
      expect(res.category).toBe(0)
      expect(res.feedback).toContain('common')
    }
  })

  it('detects repeated characters, repeated chunks, and low unique diversity', () => {
    expect(analyze('aaaaaaaaaaaaaa').feedback).toContain('repeat')
    expect(analyze('121212121212').feedback).toContain('repeat')
    expect(analyze('abcabcabcabc').feedback).toContain('repeat')
    // Repeated low character diversity capped at low bits
    const lowDiv = analyze('ababaabababababa')
    expect(lowDiv.feedback).toContain('repeat')
    expect(lowDiv.category).toBeLessThanOrEqual(1)
  })

  it('detects sequential numbers, alphabetic sequences, and keyboard walks', () => {
    const seq = analyze('abcd1234wxyz!')
    expect(seq.feedback).toContain('sequence')

    const walk = analyze('qwertyuiopAS1!')
    expect(walk.feedback).toContain('walk')
  })

  it('enforces length boundaries: short passwords never receive Strong rating', () => {
    // Short password (< 10) with all character types
    const short9 = analyze('X#9a!k2@L')
    expect(short9.feedback).toContain('short')
    expect(short9.category).toBeLessThanOrEqual(1) // Max Weak

    // Password between 10 and 11 characters
    const short11 = analyze('X#9a!k2@Lp1')
    expect(short11.feedback).toContain('short')
    expect(short11.category).toBeLessThanOrEqual(2) // Max Fair

    // High entropy 18-character password
    const strong18 = analyze('Kp9#mZ2$vLq8!wRt4y')
    expect(strong18.category).toBe(3) // Strong
  })

  it('handles non-ASCII Ethiopic and Afaan Oromoo text cleanly', () => {
    const amharic = analyze('ሰላም1234ኢትዮጵያ!')
    expect(amharic.nonAscii).toBe(true)
    expect(amharic.bits).toBeGreaterThan(0)

    const oromo = analyze('FurtuuCimaa2024#')
    expect(oromo.nonAscii).toBe(false)
    expect(oromo.category).toBeGreaterThanOrEqual(2)
  })
})

describe('M2 Secure Password Generator - Comprehensive Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('strictly uses crypto.getRandomValues and NEVER Math.random()', () => {
    const mathSpy = vi.spyOn(Math, 'random')
    const cryptoSpy = vi.spyOn(crypto, 'getRandomValues')

    const pw = generate({ length: 24 })
    expect(cryptoSpy).toHaveBeenCalled()
    expect(mathSpy).not.toHaveBeenCalled()
    expect(pw).toHaveLength(24)
  })

  it('enforces rejection sampling to guarantee uniform draw without modulo bias', () => {
    const fakeDraws = [0xffffffff, 0xfffffffe, 5]
    let callCount = 0
    const mockRng = {
      getRandomValues: (buf) => {
        buf[0] = fakeDraws[callCount++]
      },
    }

    const draw = randomInt(10, mockRng)
    expect(draw).toBe(5)
    expect(callCount).toBe(3)
  })

  it('throws a safe, honest nocrypto error when CSPRNG is unavailable', () => {
    expect(() => randomInt(10, null)).toThrow('nocrypto')
    expect(() => randomInt(10, {})).toThrow('nocrypto')
    expect(() => generate({ length: 16 }, null)).toThrow('nocrypto')
    expect(() => generate({ length: 16 }, {})).toThrow('nocrypto')
  })

  it('validates lengths (12 to 64) and character category selection', () => {
    expect(() => generate({ length: 11 })).toThrow('length')
    expect(() => generate({ length: 65 })).toThrow('length')
    expect(() => generate({ length: 16.5 })).toThrow('length')
    expect(() => generate({ length: 16, classes: {} })).toThrow('noclass')

    // Valid combinations
    for (const len of [12, 16, 32, 64]) {
      const pw = generate({ length: len })
      expect(pw).toHaveLength(len)
      expect(/[a-z]/.test(pw)).toBe(true)
      expect(/[A-Z]/.test(pw)).toBe(true)
      expect(/\d/.test(pw)).toBe(true)
      expect(/[!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]/.test(pw)).toBe(true)
    }
  })
})

describe('Password Privacy and Security Guarantees', () => {
  it('never submits analyzed or generated passwords across the network', () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    analyze('SecretUserPassword123!')
    generate({ length: 20 })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('never persists passwords in localStorage or sessionStorage', () => {
    const sensitive = 'P@ssw0rdToNeverStore2024'
    analyze(sensitive)
    const generated = generate({ length: 20 })

    const localRaw = JSON.stringify(globalThis.localStorage || {})
    const sessionRaw = JSON.stringify(globalThis.sessionStorage || {})

    expect(localRaw).not.toContain(sensitive)
    expect(localRaw).not.toContain(generated)
    expect(sessionRaw).not.toContain(sensitive)
    expect(sessionRaw).not.toContain(generated)
  })

  it('never prints analyzed or generated passwords to console logs', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const sensitive = 'AuditPrivacySuperSecret2026'
    analyze(sensitive)
    generate({ length: 24 })

    const allCalls = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls].flat().join(' ')
    expect(allCalls).not.toContain(sensitive)

    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })
})

describe('Cyber Hero Journey (M5) Integration & Duplicate Protection', () => {
  beforeEach(() => {
    resetJourneyProgress()
  })

  it('operates standalone without requiring an account or prior Journey progress', () => {
    const progress = getJourneyProgress()
    expect(progress).toBeDefined()
    expect(progress.m2Practice?.completed).toBe(false)

    // Password tools work completely independent of journey state
    const res = analyze('IndependentTest123!')
    expect(res).not.toBeNull()
  })

  it('awards non-sensitive XP on educational completion and strictly prevents duplicate rewards', () => {
    const initial = getJourneyProgress()
    const initialXp = initial.totalXp

    // First completion
    const firstResult = awardM2PracticeCompletion()
    expect(firstResult.newlyCompleted).toBe(true)
    expect(firstResult.awardedXp).toBe(50)
    expect(firstResult.currentProgress.totalXp).toBe(initialXp + 50)
    expect(firstResult.currentProgress.badges).toContain('badge_vault_sentinel')
    expect(firstResult.currentProgress.m2Practice.completed).toBe(true)

    // Repeated execution / re-click / refresh MUST NOT duplicate XP
    const secondResult = awardM2PracticeCompletion()
    expect(secondResult.newlyCompleted).toBe(false)
    expect(secondResult.awardedXp).toBe(0)
    expect(secondResult.currentProgress.totalXp).toBe(initialXp + 50)

    // Reconciling progress preserves integrity and awards XP only once
    const reconciled = reconcileProgressIntegrity(secondResult.currentProgress)
    expect(reconciled.totalXp).toBe(initialXp + 50)
  })

  it('stores strictly non-sensitive learning metadata in Journey progress without password content', () => {
    awardM2PracticeCompletion()
    const progress = getJourneyProgress()

    const serialized = JSON.stringify(progress)
    // Confirm no password material exists in Journey progress
    expect(serialized).not.toMatch(/rawPassword/i)
    expect(progress.m2Practice).toEqual({
      completed: true,
      awardedXp: 50,
      completedAt: expect.any(String),
    })
  })
})

describe('M2 Component Trilingual Rendering and Accessibility', () => {
  it('renders M2 component cleanly across EN, OM, and AM without throwing', async () => {
    const React = (await import('react')).default
    const { renderToString } = await import('react-dom/server')
    const { default: M2 } = await import('./components/M2.jsx')
    const { makeT } = await import('./i18n.js')

    for (const lang of ['en', 'om', 'am']) {
      const t = makeT(lang)
      let html = ''
      expect(() => {
        html = renderToString(React.createElement(M2, { t }))
      }).not.toThrow()

      expect(html).toContain('m2-coach-card')
      expect(html).toContain('m2-practice-card')
      expect(html).toContain('module-tag-m2')
      expect(html).not.toContain('undefined')
    }
  })
})



describe('M2 Enhanced Hardening & Policy Verification (Final Audit)', () => {
  it('strictly excludes ambiguous characters when excludeAmbiguous is enabled', () => {
    const AMBIGUOUS = '1lI|0Oo8B2Z5S`\'"~;:.,<>()[]{}/\\'
    for (let i = 0; i < 50; i++) {
      const pw = generate({ length: 32, classes: { lower: true, upper: true, digits: true, symbols: true }, excludeAmbiguous: true })
      expect(pw).toHaveLength(32)
      for (const char of pw) {
        expect(AMBIGUOUS.includes(char), `Found ambiguous character '${char}' in '${pw}'`).toBe(false)
      }
      // Ensure required classes are still fulfilled with non-ambiguous members
      expect(/[a-z]/.test(pw)).toBe(true)
      expect(/[A-Z]/.test(pw)).toBe(true)
      expect(/\d/.test(pw)).toBe(true)
      expect(/[!#$%&*+\-=?@^_]/.test(pw)).toBe(true)
    }
  })

  it('detects predictable structures like SingleCapitalWord+Digits+Symbol (e.g. Password123!)', () => {
    const predictablePasswords = [
      'Password123!',
      'Welcome2026#',
      'Abcdefgh123!',
      'Hospital2024!',
      'Ethiopia2026@'
    ]

    for (const pw of predictablePasswords) {
      const res = analyze(pw)
      expect(res).not.toBeNull()
      expect(res.feedback).toContain('predictable_structure')
      expect(res.riskFactors).toContain('predictable_structure')
      expect(res.recommendations).toContain('rec_avoid_structure')
      // Even if length is 12+, predictable structure must cap category to at most 1 (or 0 if dictionary)
      expect(res.category).toBeLessThanOrEqual(1)
    }
  })

  it('detects leetspeak substitutions for dictionary and Ethiopian context passwords', () => {
    const leetPasswords = [
      'P@ssw0rd',
      'P@ssw0rd123!',
      'T3l3b1rr!',
      'Adm1n1str@t0r!',
      '3th10p1@2026!'
    ]

    for (const pw of leetPasswords) {
      const res = analyze(pw)
      expect(res).not.toBeNull()
      expect(res.feedback).toContain('common')
      expect(res.riskFactors).toContain('common_dictionary')
      expect(res.category).toBe(0)
    }
  })

  it('verifies application password policy compliance (>=12 chars, letters, numbers)', () => {
    // Under 12 chars
    const shortPw = analyze('Short123!')
    expect(shortPw.policyChecks.minLength).toBe(false)
    expect(shortPw.meetsAppPolicy).toBe(false)

    // Over 128 chars
    const longPw = analyze('A'.repeat(129) + '1')
    expect(longPw.policyChecks.maxLength).toBe(false)
    expect(longPw.meetsAppPolicy).toBe(false)

    // 12 chars but numbers only
    const digitsOnly = analyze('123456789012')
    expect(digitsOnly.policyChecks.hasLetter).toBe(false)
    expect(digitsOnly.meetsAppPolicy).toBe(false)

    // 12 chars but letters only
    const lettersOnly = analyze('abcdefghijkl')
    expect(lettersOnly.policyChecks.hasNumber).toBe(false)
    expect(lettersOnly.meetsAppPolicy).toBe(false)

    // Valid policy compliant (12+ chars, letters and digits)
    const validPolicy = analyze('SafeEthiopia2026Secure')
    expect(validPolicy.policyChecks.minLength).toBe(true)
    expect(validPolicy.policyChecks.maxLength).toBe(true)
    expect(validPolicy.policyChecks.hasLetter).toBe(true)
    expect(validPolicy.policyChecks.hasNumber).toBe(true)
    expect(validPolicy.meetsAppPolicy).toBe(true)
  })

  it('provides honest score semantics (0-100) and theoretical entropy disclaimer', () => {
    const res = analyze('Xq7#mT2v!Lp9aRw4zK')
    expect(res.score).toBeGreaterThanOrEqual(75)
    expect(res.score).toBeLessThanOrEqual(100)
    expect(res.limitations).toBe('theoretical_entropy_only')
    expect(res.bits).toBeGreaterThanOrEqual(80)

    const weak = analyze('123456')
    expect(weak.score).toBeLessThanOrEqual(24)
    expect(weak.category).toBe(0)
    expect(weak.limitations).toBe('theoretical_entropy_only')
  })
})
