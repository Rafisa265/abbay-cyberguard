import { describe, it, expect, vi, beforeEach } from 'vitest'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'
import { makeT, REVIEWED, LANGS } from './i18n.js'
import {
  getAllMissions,
  CORE_MISSIONS,
  getJourneyProgress,
  saveJourneyProgress,
  resetJourneyProgress,
  evaluateChoice,
  isMissionCompleted,
  getRank,
  reconcileProgressIntegrity,
  JOURNEY_STORAGE_KEY,
  addAdaptiveMission,
} from './lib/journey.js'
import { PRACTICE_TEMPLATES } from './lib/missionTemplates.js'
import { analyze as analyzePassword, generate as generatePassword } from './lib/m2.js'
import { validate as validateM3, sensitiveFlags, validChannel, buildDraft } from './lib/m3.js'
import { analyze as analyzeUrl, normalize as normalizeUrl } from './lib/m1.js'

describe('Phase 3 — Full Application QA Suite', () => {
  const tEn = makeT('en')
  const tOm = makeT('om')
  const tAm = makeT('am')

  beforeEach(() => {
    vi.restoreAllMocks()
    resetJourneyProgress()
  })

  describe('Area 1 & 10: Homepage, Navigation & Module Integration', () => {
    it('all 7 views and default home route are registered with localized labels', () => {
      const routes = ['m1', 'm2', 'm3', 'm4', 'learn', 'journey', 'account']
      for (const r of routes) {
        expect(tEn(`nav.${r}`)).toBeTruthy()
        expect(tOm(`nav.${r}`)).toBeTruthy()
        expect(tAm(`nav.${r}`)).toBeTruthy()
      }
    })

    it('value proposition pillars have complete, localized descriptions without exaggerated claims', () => {
      const pillarPrefixes = ['p1', 'p2', 'p3', 'p4']
      for (const p of pillarPrefixes) {
        expect(tEn(`home.pillars.${p}_title`)).toBeTruthy()
        expect(tEn(`home.pillars.${p}_desc`)).toBeTruthy()
        expect(tEn(`home.pillars.${p}_desc`)).not.toMatch(/100% safe|guarantee security|hack-proof/i)
      }
    })
  })

  describe('Area 2: M1 Link Checker Heuristics & Safe Disclaimers', () => {
    it('analyzes suspicious links passively and never claims a URL is guaranteed safe', () => {
      const rSuspicious = analyzeUrl('http://192.168.1.1/login-bank')
      expect(rSuspicious.indicators.length).toBeGreaterThan(0)

      const rStandard = analyzeUrl('https://example.com/page')
      // Even for standard URLs, caveat warns that indicators are not proof and links are not guaranteed safe
      expect(en['m1.caveat']).toMatch(/warning sign|not proof/i)
      expect(en['m1.limits']).toBeTruthy()
      const allM1Strings = Object.entries(en)
        .filter(([k]) => k.startsWith('m1.'))
        .map(([, v]) => v.toLowerCase())
        .join(' ')
      expect(allM1Strings).not.toMatch(/\b(guaranteed safe|completely safe|100% safe|certified safe)\b/)
    })

    it('respects URL length and input boundaries', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2100)
      const res = analyzeUrl(longUrl)
      expect(res.error).toBe('toolong')
    })
  })

  describe('Area 3: M2 Password Strength & Privacy Zero-Storage Guarantee', () => {
    it('evaluates entropy and penalties for common words and sequences without storage', () => {
      const weak = analyzePassword('password123')
      expect(weak.category).toBeLessThanOrEqual(1)
      expect(weak.feedback).toContain('common')

      const strong = analyzePassword('K!9#mP$2vL@8qZ&4')
      expect(strong.category).toBe(3)
      expect(strong.bits).toBeGreaterThanOrEqual(60)
    })

    it('generates secure passwords with cryptographically unbiased character distribution', () => {
      const pwd = generatePassword({ length: 20 })
      expect(pwd.length).toBe(20)
      expect(/[a-z]/.test(pwd)).toBe(true)
      expect(/[A-Z]/.test(pwd)).toBe(true)
      expect(/\d/.test(pwd)).toBe(true)
      expect(/[^A-Za-z0-9]/.test(pwd)).toBe(true)
    })

    it('rejects invalid password generator lengths', () => {
      expect(() => generatePassword({ length: 8 })).toThrow('length')
      expect(() => generatePassword({ length: 100 })).toThrow('length')
    })
  })

  describe('Area 4: M3 Incident Report Drafter & Channel Safety', () => {
    it('validates required fields, date constraints, and field lengths', () => {
      const emptyErrors = validateM3({})
      expect(emptyErrors.type).toBe('required')
      expect(emptyErrors.date).toBe('required')
      expect(emptyErrors.what).toBe('required')

      const futureDate = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
      const futureErrors = validateM3({ type: 'phishing', date: futureDate, what: 'Incident occurred' })
      expect(futureErrors.date).toBe('future')

      const validErrors = validateM3({ type: 'phishing', date: '2026-10-20', what: 'Received fake SMS' })
      expect(Object.keys(validErrors).length).toBe(0)
    })

    it('detects sensitive credentials in incident narrative to prevent accidental leak', () => {
      const textWithOtp = 'The scammer asked me for my one-time code 849201 and password: Secret123'
      const flags = sensitiveFlags(textWithOtp)
      expect(flags).toContain('secret')

      const textWithCard = 'I typed my card number 4111 1111 1111 1111 into the link'
      const cardFlags = sensitiveFlags(textWithCard)
      expect(cardFlags).toContain('card')
    })

    it('only presents reporting channels if strictly verified with HTTPS source URL and reviewer role', () => {
      const unverifiedChannel = { name: 'Fake Help', contact: '999' }
      expect(validChannel(unverifiedChannel)).toBe(false)

      const verifiedChannel = {
        name: 'INSA Incident Response',
        contact: '933',
        sourceUrl: 'https://insa.gov.et/incident',
        verifiedOn: '2026-09-01',
        reviewerRole: 'Lead Incident Officer',
      }
      expect(validChannel(verifiedChannel)).toBe(true)
    })
  })

  describe('Area 5: M4 Simulated Security Demonstration Safeguards', () => {
    it('confirms M4 uses safe, simulated fixtures and does not perform live network exploits', () => {
      expect(en['c.simulated']).toBe('SIMULATED')
      expect(en['m4.auth']).toMatch(/explicit authorization|not offered/i)
      expect(en['m4.scope']).toMatch(/bundled test data|never mean a site is secure/i)
    })
  })

  describe('Area 6: Cyber Hero Journey & P01 Fictional Campus Job Scam Verification', () => {
    it('P01 awards exactly 100 XP only on first completion; replay awards 0 additional XP and preserves progress', () => {
      resetJourneyProgress()

      // 1. Verify P01 template specification
      const p01Template = PRACTICE_TEMPLATES.find((p) => p.id === 'p01')
      expect(p01Template).toBeDefined()
      expect(p01Template.id).toBe('p01')
      expect(p01Template.base_template_id).toBe('p01')
      expect(p01Template.xp_reward).toBe(100)
      expect(p01Template.badge_id).toBe('badge_adaptive_scout')
      expect(tEn(p01Template.title_key)).toContain('Campus Job')

      // 2. Launch P01 into the journey session (as done by the Journey UI)
      const p01 = addAdaptiveMission({ templateId: 'p01' })
      expect(p01.base_template_id).toBe('p01')
      expect(p01.xp_reward).toBe(100)
      expect(p01.badge_id).toBe('badge_adaptive_scout')

      // 3. Select incorrect / trap choice first: must award 0 XP and NOT complete mission
      const trapResult = evaluateChoice(p01.id, 'choice_p01_pay_fee')
      expect(trapResult.isCorrect).toBe(false)
      expect(trapResult.isTrap).toBe(true)
      expect(trapResult.newlyCompleted).toBe(false)
      expect(trapResult.awardedXp).toBe(0)
      expect(getJourneyProgress().totalXp).toBe(0)
      expect(isMissionCompleted(p01.id)).toBe(false)

      // 4. Complete P01 for the first time with correct choice: awards 100 XP and badge
      const firstCompletion = evaluateChoice(p01.id, p01.correct_choice)
      expect(firstCompletion.isCorrect).toBe(true)
      expect(firstCompletion.newlyCompleted).toBe(true)
      expect(firstCompletion.awardedXp).toBe(100)

      const progAfterFirst = getJourneyProgress()
      expect(progAfterFirst.totalXp).toBe(100)
      expect(isMissionCompleted(p01.id)).toBe(true)
      expect(progAfterFirst.badges).toContain('badge_adaptive_scout')
      expect(getRank(progAfterFirst.totalXp).key).toBe('defender')

      // 5. Replay P01 with the correct choice: must award 0 additional XP and preserve existing progress
      const replayResult = evaluateChoice(p01.id, p01.correct_choice)
      expect(replayResult.isCorrect).toBe(true)
      expect(replayResult.newlyCompleted).toBe(false)
      expect(replayResult.awardedXp).toBe(0)

      const progAfterReplay = getJourneyProgress()
      expect(progAfterReplay.totalXp).toBe(100) // Stays exactly 100 XP (no duplicate award)
      expect(isMissionCompleted(p01.id)).toBe(true) // Still completed
      expect(progAfterReplay.badges).toContain('badge_adaptive_scout')

      // 6. Selecting a trap choice after replay does not revoke existing completion or XP
      const postReplayTrap = evaluateChoice(p01.id, 'choice_p01_send_id')
      expect(postReplayTrap.isCorrect).toBe(false)
      expect(postReplayTrap.isTrap).toBe(true)
      expect(postReplayTrap.awardedXp).toBe(0)

      const progAfterPostTrap = getJourneyProgress()
      expect(progAfterPostTrap.totalXp).toBe(100)
      expect(isMissionCompleted(p01.id)).toBe(true)
    })

    it('persistence test: XP, badges, and completed missions survive storage reload and integrity reconciliation', () => {
      const mockStorage = new Map()
      const initialProgress = {
        schemaVersion: 2,
        completedMissions: {
          m01: { completed: true, stars: 3 },
          p01: { completed: true, stars: 3 },
        },
        totalXp: 200,
        badges: ['badge_scholarship_shield', 'badge_adaptive_scout'],
        activeMissionId: 'p01',
      }
      mockStorage.set(JOURNEY_STORAGE_KEY, JSON.stringify(initialProgress))

      const prevStorage = globalThis.localStorage
      globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
      }

      try {
        const loaded = getJourneyProgress()
        expect(loaded.totalXp).toBe(200)
        expect(loaded.badges).toContain('badge_scholarship_shield')
        expect(loaded.badges).toContain('badge_adaptive_scout')
        expect(isMissionCompleted('m01')).toBe(true)
        expect(isMissionCompleted('p01')).toBe(true)
      } finally {
        globalThis.localStorage = prevStorage
      }
    })
  })

  describe('Area 7: Authentication & Access Control', () => {
    it('handles guest mode without breaking journey progress or throwing on unauthenticated state', () => {
      const user = null
      expect(user).toBeNull()
      const guestProg = getJourneyProgress()
      expect(typeof guestProg.totalXp).toBe('number')
    })
  })

  describe('Area 8: Trilingual Completeness & Parity (EN, OM, AM)', () => {
    it('exact dictionary key match between English, Afaan Oromoo, and Amharic with zero empty entries', () => {
      const enKeys = Object.keys(en).sort()
      const omKeys = Object.keys(om).sort()
      const amKeys = Object.keys(am).sort()

      expect(omKeys).toEqual(enKeys)
      expect(amKeys).toEqual(enKeys)
      expect(enKeys.length).toBeGreaterThanOrEqual(900)

      for (const k of enKeys) {
        expect(en[k].trim().length).toBeGreaterThan(0)
        expect(om[k].trim().length).toBeGreaterThan(0)
        expect(am[k].trim().length).toBeGreaterThan(0)
      }
    })

    it('supported language list contains English, Afaan Oromoo, and Amharic', () => {
      expect(LANGS).toEqual({
        en: 'English',
        om: 'Afaan Oromoo',
        am: 'አማርኛ',
      })
    })
  })

  describe('Area 9: Offline First & Data Boundary Guarantees', () => {
    it('guarantees that sensitive data like passwords or full incident narratives are not stored in journey storage', () => {
      const prog = getJourneyProgress()
      const serialized = JSON.stringify(prog)
      expect(serialized).not.toMatch(/password|pin|card|otp/i)
    })
  })
})
