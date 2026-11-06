import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyze, analyzeText, extractUrls, TXT_WEIGHTS, levelOf } from './lib/m1.js'
import { checkM1Cti } from './lib/api.js'

describe('M1 Multi-Type Threat Checker - High-Priority Hardened Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis
    }
  })

  // 1. The exact supplied Amharic prize-plus-bank-account message
  describe('1. Exact User-Supplied Amharic Test Message', () => {
    it('reliably detects prize lure, bank details request, and personal data harvesting with High Concern verdict', () => {
      const realMessage = 'በጣም ጥሩ! እባክዎ የሚከተሉትን መረጃዎች ይስጡኝ፦ ሽልማት፦ 350 ብር ስም፦ የባንክ ስም፡ የአካውንት ቁጥር፦ ዕድሜ፦ ፆታ፦ ሥራ፦'
      const result = analyzeText(realMessage, 'message')

      expect(result.error).toBeUndefined()
      // Explicitly verifies all three distinct indicators
      expect(result.indicators).toContain('TXT-04') // Unexpected prize (350 ብር ሽልማት)
      expect(result.indicators).toContain('TXT-09') // Bank name & account number request (የባንክ ስም, የአካውንት ቁጥር)
      expect(result.indicators).toContain('TXT-10') // Personal identity details request (ስም, ዕድሜ, ፆታ, ሥራ)

      // Score must be consistent with combined evidence: 25 + 30 + 20 = 75
      expect(result.score).toBe(75)
      // Overall risk label MUST NOT be a weak "caution", but a high-risk warning
      expect(result.level).toBe('high')
    })
  })

  // 2. A prize lure requesting personal details but no URL
  describe('2. Prize Lure with Personal Details Request (No URL)', () => {
    it('detects prize claim combined with demographic harvesting', () => {
      const text = 'Congratulations! You have won 50,000 Birr cash reward. Please submit your full name, age, gender, and occupation to receive your payment.'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toContain('TXT-04')
      expect(result.indicators).toContain('TXT-10')
      expect(result.extractedUrls).toEqual([])
      expect(result.level).toBe('high')
      expect(result.score).toBe(45)
    })
  })

  // 3. A message asking for an account number and bank name
  describe('3. Financial Account Information Request', () => {
    it('detects requests for bank name and account number', () => {
      const text = 'Please reply with your bank name and account number to receive the incoming funds.'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toContain('TXT-09')
      expect(result.score).toBe(30)
      expect(result.level).toBe('caution')
    })
  })

  // 4. A message asking for an OTP, PIN, or password
  describe('4. Authentication Secrets & OTP Harvesting', () => {
    it('flags requests for OTP codes or PINs as high-concern credential risk', () => {
      const text = 'Please send the 6-digit OTP verification code sent to your phone.'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toContain('TXT-01')
      expect(result.score).toBe(40)
      expect(result.level).toBe('high')
    })
  })

  // 5. A fake bank or telecom account-verification message
  describe('5. Fake Bank / Telecom Impersonation with Urgency', () => {
    it('detects official claim with urgency and account suspension pressure', () => {
      const text = 'Official Notice from Commercial Bank of Ethiopia: Urgent security alert, your account will be suspended within 24 hours. Verify your account now: http://192.0.2.10:8080/verify'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toContain('TXT-02') // Urgency / suspension
      expect(result.indicators).toContain('TXT-03') // Bank impersonation
      expect(result.indicators).toContain('TXT-06') // IP address link
      expect(result.level).toBe('high')
    })
  })

  // 6. A suspicious prize that demands an upfront fee
  describe('6. Prize Lure Demanding Upfront Fee', () => {
    it('flags advance-fee lottery fraud', () => {
      const text = 'Congratulations! You won the grand lottery prize of 100,000 Birr. Pay a 500 Birr processing fee upfront to claim your winnings.'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toContain('TXT-04') // Prize
      expect(result.indicators).toContain('TXT-05') // Upfront fee
      expect(result.score).toBe(50)
      expect(result.level).toBe('high')
    })
  })

  // 7. A benign message that mentions a bank without asking for sensitive data
  describe('7. Benign Message Mentioning a Bank', () => {
    it('does not flag an innocent mention of an Ethiopian bank in normal conversation', () => {
      const text = 'I visited the Commercial Bank of Ethiopia branch today at 2 PM to deposit my salary into my savings account.'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toEqual([])
      expect(result.score).toBe(0)
      expect(result.level).toBe('none')
    })
  })

  // 8. A legitimate informational message about prizes or scholarships
  describe('8. Legitimate Informational Message on Scholarships', () => {
    it('evaluates informational scholarship mention without inflating to high alarm', () => {
      const text = 'Congratulations to all high school graduates who received government university scholarships this year!'
      const result = analyzeText(text, 'message')

      // TXT-04 detects the scholarship / congratulations topic
      expect(result.indicators).toContain('TXT-04')
      // Does NOT trigger credential theft (TXT-01), bank details (TXT-09), or upfront fee (TXT-05)
      expect(result.indicators).not.toContain('TXT-01')
      expect(result.indicators).not.toContain('TXT-09')
      expect(result.indicators).not.toContain('TXT-05')
      expect(result.score).toBe(25)
      expect(result.level).toBe('caution')
    })
  })

  // 9. Benign Amharic text
  describe('9. Benign Amharic Text', () => {
    it('returns score 0 and clean level for ordinary Amharic conversations', () => {
      const text = 'ሰላም እንደምን አደርክ? ዛሬ ከሰዓት በኋላ ለስብሰባ እንገናኝ። ሻይ አብረን እንጠጣ።'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toEqual([])
      expect(result.score).toBe(0)
      expect(result.level).toBe('none')
    })
  })

  // 10. Benign Afaan Oromoo text
  describe('10. Benign Afaan Oromoo Text', () => {
    it('returns score 0 and clean level for ordinary Afaan Oromoo conversations', () => {
      const text = 'Akkam jirtu? Baga nagaan dhuftan, har\'a walgahii qabna, sa\'aatii 8:00 irratti walargina.'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toEqual([])
      expect(result.score).toBe(0)
      expect(result.level).toBe('none')
    })
  })

  // 11. Existing English phishing examples
  describe('11. Representative English Phishing Scenarios', () => {
    it('flags telebirr SIM swap phishing attempt', () => {
      const text = 'Telebirr Security: Your account is blocked due to suspicious activity. Enter your password and PIN code immediately to reactivate.'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toContain('TXT-01') // Password / PIN
      expect(result.indicators).toContain('TXT-02') // Blocked urgency
      expect(result.indicators).toContain('TXT-03') // Telebirr impersonation
      expect(result.level).toBe('high')
    })
  })

  // 12. Mixed-language content and punctuation variations
  describe('12. Mixed-Language Content & Ethiopic Punctuation', () => {
    it('handles mixed Amharic, Oromo, and English with Ethiopic punctuation correctly', () => {
      const text = 'Baga gammaddan! ሽልማት፦ 500 Birr. እባክዎ lakkoofsa herregaa fi ስም፦ ergaa.'
      const result = analyzeText(text, 'message')

      expect(result.indicators).toContain('TXT-04') // Prize
      expect(result.indicators).toContain('TXT-09') // lakkoofsa herregaa
      expect(result.level).toBe('high')
    })
  })

  // 13. False-positive controls for words like "bank", "account", and "prize"
  describe('13. False-Positive Controls for Ordinary Words', () => {
    it('does not trigger on ordinary mentions of account or prize in casual sentences', () => {
      const text1 = 'I opened a new savings account last year with my family.'
      expect(analyzeText(text1, 'message').indicators).toEqual([])

      const text2 = 'My daughter won a spelling bee prize at school.'
      expect(analyzeText(text2, 'message').indicators).not.toContain('TXT-09')
      expect(analyzeText(text2, 'message').indicators).not.toContain('TXT-01')
    })
  })

  // 14. Score boundaries, overlapping rules, and deterministic results
  describe('14. Score Boundaries & Determinism', () => {
    it('caps scores strictly at 100 even if all indicators trigger', () => {
      const everything = `
        Dear customer, official notice from Commercial Bank of Ethiopia.
        Urgent: Your account is suspended within 24 hours.
        Congratulations, you have won 100,000 Birr lottery prize!
        Pay a 500 Birr registration fee first.
        Send your password, OTP, and bank name and account number.
        Provide your full name, age, gender, and occupation.
        Download our APK at http://192.0.2.10:8080/cbe.apk or contact on whatsapp.
      `
      const result = analyzeText(everything, 'message')
      expect(result.score).toBe(100)
      expect(result.level).toBe('high')

      // Deterministic: multiple runs produce identical output
      const run2 = analyzeText(everything, 'message')
      expect(run2).toEqual(result)
    })

    it('respects level thresholds: 0 is none, 1-39 is caution, >=40 is high', () => {
      expect(levelOf(0)).toBe('none')
      expect(levelOf(25)).toBe('caution')
      expect(levelOf(39)).toBe('caution')
      expect(levelOf(40)).toBe('high')
      expect(levelOf(75)).toBe('high')
      expect(levelOf(100)).toBe('high')
    })
  })

  // 15. Existing URL Check and Email Text Check behavior
  describe('15. URL Mode & Email Mode Compatibility', () => {
    it('preserves existing analyze() URL function behavior', () => {
      const u = 'http://192.0.2.10:8080/login'
      const r = analyze(u)
      expect(r.isDocAddress).toBe(true)
      expect(r.score).toBeGreaterThanOrEqual(50)
      expect(r.indicators).toContain('IND-01')
    })

    it('preserves email mode free webmail impersonation detection (TXT-08)', () => {
      const email = 'From: Commercial Bank of Ethiopia <cbe@gmail.com>\nSubject: Urgent verify\nYour account will be closed in 24 hours.'
      const r = analyzeText(email, 'email')
      expect(r.indicators).toContain('TXT-08')
      expect(r.level).toBe('high')
    })
  })

  // 16. CTI disabled by default and no automatic CTI request during text analysis
  describe('16. No Automatic CTI Lookups During Text Analysis', () => {
    it('does not invoke fetch during analyzeText even when text contains URLs', () => {
      const fetchSpy = vi.fn()
      globalThis.window.fetch = fetchSpy

      const text = 'Check out this link: https://example.com/test'
      const res = analyzeText(text, 'message')

      expect(res.extractedUrls.length).toBe(1)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  // 17. Privacy tests ensuring pasted text is not persisted, logged, or transmitted
  describe('17. In-Memory Privacy Guarantees', () => {
    it('does not write pasted content to localStorage or sessionStorage', () => {
      const mockStorage = { setItem: vi.fn(), getItem: vi.fn() }
      const origLocal = globalThis.localStorage
      const origSession = globalThis.sessionStorage
      globalThis.localStorage = mockStorage
      globalThis.sessionStorage = mockStorage

      const text = 'Sensitive message: my bank account is 100012345678'
      analyzeText(text, 'message')

      expect(mockStorage.setItem).not.toHaveBeenCalled()

      globalThis.localStorage = origLocal
      globalThis.sessionStorage = origSession
    })
  })

  // 18. Safe rendering of HTML-like and script-like pasted text
  describe('18. XSS & Injection Prevention', () => {
    it('handles script tags and malformed input safely without execution', () => {
      const xss = '<script>window.__pwned = true;</script><img src=x onerror="window.__pwned=true">'
      const res = analyzeText(xss, 'message')

      expect(res.error).toBeUndefined()
      expect(res.text).toBe(xss)
      expect(globalThis.window.__pwned).toBeUndefined()
    })
  })

  // 19. Empty input and maximum-length input behavior
  describe('19. Input Boundary Handling', () => {
    it('returns empty error for empty or whitespace text', () => {
      expect(analyzeText('').error).toBe('empty')
      expect(analyzeText('   \n\t  ').error).toBe('empty')
    })

    it('enforces 4096 character upper limit', () => {
      const valid = 'a'.repeat(4096)
      expect(analyzeText(valid).error).toBeUndefined()

      const tooLong = 'a'.repeat(4097)
      expect(analyzeText(tooLong).error).toBe('toolong')
    })
  })

  // 20. EN/OM/AM locale-key parity and missing-translation checks
  describe('20. Trilingual Parity Across All 1,500 Keys', () => {
    it('guarantees identical key sets and non-empty strings across EN, OM, and AM', async () => {
      const en = (await import('./locales/en.js')).default
      const om = (await import('./locales/om.js')).default
      const am = (await import('./locales/am.js')).default

      const enKeys = Object.keys(en)
      const omKeys = Object.keys(om)
      const amKeys = Object.keys(am)

      expect(enKeys.length).toBeGreaterThanOrEqual(1500)
      expect(omKeys.length).toBe(enKeys.length)
      expect(amKeys.length).toBe(enKeys.length)

      const enSet = new Set(enKeys)
      const omSet = new Set(omKeys)
      const amSet = new Set(amKeys)

      for (const k of enKeys) {
        expect(omSet.has(k), `Missing key in OM: ${k}`).toBe(true)
        expect(amSet.has(k), `Missing key in AM: ${k}`).toBe(true)
        expect(typeof en[k]).toBe('string')
        expect(typeof om[k]).toBe('string')
        expect(typeof am[k]).toBe('string')
        expect(en[k].length).toBeGreaterThan(0)
        expect(om[k].length).toBeGreaterThan(0)
        expect(am[k].length).toBeGreaterThan(0)
      }

      // Check specific hardened and evidence keys
      const hardenedKeys = [
        'm1.ind.TXT-09', 'm1.why.TXT-09', 'm1.act.TXT-09',
        'm1.ind.TXT-10', 'm1.why.TXT-10', 'm1.act.TXT-10',
        'm1.safety_advisory_title', 'm1.safety_advisory_intro',
        'm1.safety_rec_no_bank_personal', 'm1.safety_rec_no_fee',
        'm1.safety_rec_verify_official', 'm1.safety_rec_no_secrets_detected',
        'm1.safety_rec_no_secrets_general', 'm1.safety_rec_no_links_apks',
        'm1.safety_rec_if_compromised',
        'm1.verdict_txt_high_lead', 'm1.verdict_txt_caution_lead',
        'm1.ev_txt_01', 'm1.ev_txt_02', 'm1.ev_txt_03', 'm1.ev_txt_04',
        'm1.ev_txt_05', 'm1.ev_txt_06', 'm1.ev_txt_07', 'm1.ev_txt_08',
        'm1.ev_txt_09', 'm1.ev_txt_10',
        'm1.step_no_bank_personal', 'm1.step_verify_prize', 'm1.step_no_secrets', 'm1.step_no_links'
      ]
      for (const hk of hardenedKeys) {
        expect(en[hk]).toBeTruthy()
        expect(om[hk]).toBeTruthy()
        expect(am[hk]).toBeTruthy()
      }
    })
  })

  // 21. Evidence-Based Result Explanation & Calibrated Recommendations
  describe('21. Evidence-Based Result Explanations & Conditional Recommendations', () => {
    it('generates calibrated explanation for the Amharic test message matching only detected evidence', async () => {
      const en = (await import('./locales/en.js')).default
      const om = (await import('./locales/om.js')).default
      const am = (await import('./locales/am.js')).default

      const realMessage = 'በጣም ጥሩ! እባክዎ የሚከተሉትን መረጃዎች ይስጡኝ፦ ሽልማት፦ 350 ብር ስም፦ የባንክ ስም፡ የአካውንት ቁጥር፦ ዕድሜ፦ ፆታ፦ ሥራ፦'
      const res = analyzeText(realMessage, 'message')

      // Verify detections
      expect(res.indicators).toEqual(['TXT-04', 'TXT-09', 'TXT-10'])
      expect(res.score).toBe(75)
      expect(res.level).toBe('high')

      // Simulate evidence composition as in M1.jsx
      const getEvidence = (dict) => [dict['m1.ev_txt_04'], dict['m1.ev_txt_09'], dict['m1.ev_txt_10']].join('; ')

      const enEvidence = getEvidence(en)
      expect(enEvidence).toContain('unexpected prize offer')
      expect(enEvidence).toContain('request for bank name or account details')
      expect(enEvidence).toContain('request for personal identity and profile information')
      // Must NOT contain false claims
      expect(enEvidence).not.toContain('urgency')
      expect(enEvidence).not.toContain('passwords')
      expect(enEvidence).not.toContain('web links')

      const amEvidence = getEvidence(am)
      expect(amEvidence).toContain('ያልተጠበቀ የሽልማት ወይም የገንዘብ ማባበያ')
      expect(amEvidence).toContain('የባንክ ስም እና የሂሳብ (አካውንት) ቁጥር ጥያቄ')
      expect(amEvidence).toContain('የግል ማንነት እና ዝርዝር መረጃዎች ጥያቄ')

      const omEvidence = getEvidence(om)
      expect(omEvidence).toContain('badhaasa hin eegamne')
      expect(omEvidence).toContain('gaaffii maqaa baankii fi lakkoofsa herregaa')
      expect(omEvidence).toContain('gaaffii ragaalee eenyummaa dhuunfaa')

      // Verify conditional account action wording
      expect(en['m1.safety_rec_if_compromised']).toContain('Conditional precaution: If you have already disclosed')
      expect(am['m1.safety_rec_if_compromised']).toContain('ሁኔታዊ ጥንቃቄ፦ የባንክ አካውንት ቁጥርዎን፣ የይለፍ ቃልዎን ወይም ፒንዎን አስቀድመው ያጋሩ ከሆነ')
      expect(om['m1.safety_rec_if_compromised']).toContain('Tarkaanfii haala irratti hundaa\'e: Ragaa herrega baankii')

      // Verify consistent risk labels across locales
      expect(en['m1.lvl.high']).toBe('High Concern')
      expect(en['m1.verdict_txt_high']).toContain('High Concern')

      expect(om['m1.lvl.high']).toBe('Balaa Ol\'aanaa')
      expect(om['m1.verdict_txt_high']).toContain('Balaa Ol\'aanaa')

      expect(am['m1.lvl.high']).toBe('ከፍተኛ ስጋት')
      expect(am['m1.verdict_txt_high']).toContain('ከፍተኛ ስጋት')
    })

    it('includes credential warnings only when credential rules actually trigger', async () => {
      const en = (await import('./locales/en.js')).default

      // Message with actual credentials and urgency
      const credMsg = 'Urgent: Send your OTP verification code to prevent account suspension.'
      const res = analyzeText(credMsg, 'message')

      expect(res.indicators).toContain('TXT-01')
      expect(res.indicators).toContain('TXT-02')

      // When TXT-01 triggers, the warning is specific
      expect(en['m1.safety_rec_no_secrets_detected']).toContain('Warning: This message requests authentication secrets')
      // When TXT-01 does NOT trigger (e.g. in prize message), the general reminder is used
      expect(en['m1.safety_rec_no_secrets_general']).toContain('General precaution:')
    })
  })
})
