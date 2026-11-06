import { describe, it, expect } from 'vitest'
import {
  analyze,
  normalize,
  levelOf,
  computeShannonEntropy,
  extractUrlFeatures,
  predictUrlLexical,
  extractUrls,
  analyzeText,
} from './m1.js'

describe('M1 validation (FR-04)', () => {
  it.each([['', 'empty'], ['   ', 'empty'], ['a'.repeat(2049), 'toolong'], ['javascript:alert(1)', 'scheme'], ['data:text/html,x', 'scheme'], ['file:///etc/passwd', 'scheme'], ['ftp://x.com', 'scheme'], ['http://', 'parse'], ['https://exa mple.com', 'parse']])('rejects %s', (i, e) => expect(analyze(i).error).toBe(e))
  it('accepts 2048 chars and defaults scheme visibly', () => {
    expect(analyze('example.com').defaulted).toBe(true)
    expect(analyze('https://example.com').defaulted).toBe(false)
    expect(normalize('https://a.com/' + 'a'.repeat(2034)).error).toBeUndefined()
  })
})
describe('M1 indicator fixtures (FR-06)', () => {
  const cases = [
    ['https://example.com/', []], ['http://example.com/', ['IND-05']], ['https://192.168.0.1/login', ['IND-01', 'IND-07']],
    ['https://0x7f.1/', ['IND-01']], ['https://[::1]/', ['IND-01']], ['https://paypal.com@evil.example/', ['IND-02']],
    ['https://xn--pypal-4ve.example/', ['IND-03']], ['https://a.b.c.d.example.com/', ['IND-04']], ['https://bit.ly/abc', ['IND-06']],
    ['https://example.com/verify', ['IND-07']], ['https://example.com:8443/', ['IND-10']], ['https://example.com/' + 'a'.repeat(100), ['IND-08']],
    ['https://example.com/%61%62%63%64%65', ['IND-09']],
  ]
  it.each(cases)('%s', (u, ids) => expect(analyze(u).indicators.sort()).toEqual(ids))
})
describe('M1 levels (FR-07)', () => {
  it('maps thresholds', () => { expect([0, 1, 39, 40, 100].map(levelOf)).toEqual(['none', 'caution', 'caution', 'high', 'high']) })
  it('high caution for combined', () => expect(analyze('http://1.2.3.4/login').level).toBe('high'))
})

describe('M1 Educational Documentation Addresses (RFC 5737 / RFC 2606)', () => {
  it('flags 192.0.2.10 (TEST-NET-1) as isDocAddress while preserving structural indicators', () => {
    const res = analyze('http://192.0.2.10:8080/account/update')
    expect(res.isDocAddress).toBe(true)
    expect(res.indicators).toContain('IND-01')
    expect(res.indicators).toContain('IND-05')
    expect(res.indicators).toContain('IND-07')
    expect(res.indicators).toContain('IND-10')
    expect(res.score).toBeGreaterThanOrEqual(40)
  })

  it('flags RFC 5737 TEST-NET-2 (198.51.100.1) and TEST-NET-3 (203.0.113.5) as doc addresses', () => {
    expect(analyze('http://198.51.100.1/').isDocAddress).toBe(true)
    expect(analyze('http://203.0.113.5/').isDocAddress).toBe(true)
  })

  it('flags RFC 2606 reserved domains (.example, .test, .invalid, .localhost) as doc addresses', () => {
    expect(analyze('https://sub.portal.example/test').isDocAddress).toBe(true)
    expect(analyze('https://demo.test/').isDocAddress).toBe(true)
    expect(analyze('https://server.invalid/').isDocAddress).toBe(true)
  })

  it('does not flag real or standard private addresses as documentation addresses', () => {
    expect(analyze('https://example.com/').isDocAddress).toBe(false)
    expect(analyze('http://192.168.1.1/').isDocAddress).toBe(false)
    expect(analyze('https://ethiopia.gov.et/').isDocAddress).toBe(false)
  })
})

describe('M1 ML Lexical Phishing Classifier (Offline In-Browser)', () => {
  it('computes shannon entropy consistently', () => {
    expect(computeShannonEntropy('')).toBe(0.0)
    expect(computeShannonEntropy('aaaa')).toBe(0.0)
    expect(computeShannonEntropy('abcdef')).toBeGreaterThan(2.0)
  })

  it('extracts bounded 12-feature vectors in [0.0, 1.0]', () => {
    const vec = extractUrlFeatures('http://192.0.2.10:8080/cbe/login/verify?token=12345')
    expect(vec.length).toBe(12)
    vec.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0.0)
      expect(v).toBeLessThanOrEqual(1.0)
    })
  })

  it('predicts high phishing probability on suspicious multi-indicator URL', () => {
    const phish = predictUrlLexical('http://192.0.2.10:8080/telebirr-account-login-verify-update?id=12345678')
    expect(phish.engine).toBe('ml_url_lexical_v1')
    expect(phish.predictedClass).toBe('phishing')
    expect(phish.phishingProbability).toBeGreaterThan(0.50)
    expect(phish.provenance.dataset).toContain('UCI PhiUSIIL')
  })

  it('predicts legitimate classification on standard clean URL', () => {
    const legit = predictUrlLexical('https://google.com')
    expect(legit.predictedClass).toBe('legitimate')
    expect(legit.phishingProbability).toBeLessThan(0.50)
    expect(legit.confidence).toBeGreaterThan(0.50)
  })

  it('integrates ML predictions directly into analyze(raw)', () => {
    const res = analyze('https://google.com')
    expect(res.ml).toBeDefined()
    expect(res.ml.predictedClass).toBe('legitimate')
    expect(res.ml.evaluation.accuracy).toBeGreaterThanOrEqual(0.90)
  })

  it('properly documents ML prediction score and uncalibrated confidence semantics', () => {
    const phish = predictUrlLexical('http://192.0.2.10:8080/telebirr-account-login-verify-update?id=12345678')
    expect(phish.phishingProbability).toBeGreaterThan(0.50)
    expect(phish.confidenceCalibrated).toBe(false)
    expect(phish.confidenceLabel).toBe('uncalibrated')
    expect(phish.confidence).toBeGreaterThan(0.50)
  })

  it('clamps URL analysis score strictly between 0 and 100 with zero duplicate indicators', () => {
    // Multi-indicator fixture combining IP (30), creds (25), punycode (25), shortener (15), words (10), long (5), port (10)
    const severeUrl = 'http://user:pass@192.168.1.1:8080/account/update/verify/password/login/banking/security/check?' + 'x'.repeat(150)
    const res = analyze(severeUrl)
    expect(res.score).toBeLessThanOrEqual(100)
    expect(res.score).toBeGreaterThanOrEqual(0)
    expect(new Set(res.indicators).size).toBe(res.indicators.length)
  })

  it('guarantees ML score semantics are uncalibrated and prevents calibrated probability interpretation', () => {
    const phish = predictUrlLexical('http://192.0.2.10:8080/telebirr-account-login-verify-update?id=12345678')
    // Raw softmax output must be explicitly flagged uncalibrated
    expect(phish.confidenceCalibrated).toBe(false)
    expect(phish.confidenceLabel).toBe('uncalibrated')
    // Score is bounded in [0, 1]
    expect(phish.phishingProbability).toBeGreaterThanOrEqual(0.0)
    expect(phish.phishingProbability).toBeLessThanOrEqual(1.0)
    // Model risk score matches phishing probability
    expect(phish.modelRiskScore).toBe(phish.phishingProbability)
    // Must NOT imply calibrated statistical probability
    const formattedScore = `${Math.round(phish.phishingProbability * 100)}/100 score`
    expect(formattedScore).toMatch(/^\d+\/100 score$/)
    expect(formattedScore).not.toContain('%')
  })
})

describe('M1 Email Address vs URL Extraction Separation', () => {
  it('does not extract domain as URL from standalone email address (e.g. cbe-notice@gmail.com)', () => {
    const urls = extractUrls('cbe-notice@gmail.com')
    expect(urls).toEqual([])
  })

  it('does not extract domains from email headers or multiple email addresses', () => {
    const emailHeader = 'From: Commercial Bank of Ethiopia <cbe-notice@gmail.com>\nTo: customer@yahoo.com\nCc: support@telecom.et'
    const urls = extractUrls(emailHeader)
    expect(urls).toEqual([])
  })

  it('extracts genuine URLs when embedded in email body while ignoring email address domains', () => {
    const emailText = 'From: Commercial Bank of Ethiopia <cbe-notice@gmail.com>\nSubject: Urgent Notice\n\nPlease visit https://example.com/verify to restore your access.'
    const urls = extractUrls(emailText)
    expect(urls).toEqual(['https://example.com/verify'])
    expect(urls).not.toContain('gmail.com')
  })

  it('extracts multiple distinct genuine URLs while ignoring email addresses', () => {
    const emailWithLinks = 'Contact us at help@cbe.com.et or visit https://first-link.org/test and http://second-link.com/auth.'
    const urls = extractUrls(emailWithLinks)
    expect(urls).toEqual(['https://first-link.org/test', 'http://second-link.com/auth'])
    expect(urls).not.toContain('cbe.com.et')
  })

  it('extracts schemeless domains and shorteners when genuinely present as web links', () => {
    const msg = 'Check our status at bit.ly/update123 or visit telebirr-verify.net/help today.'
    const urls = extractUrls(msg)
    expect(urls).toContain('bit.ly/update123')
    expect(urls).toContain('telebirr-verify.net/help')
  })

  it('extracts raw IPv4 fixtures and basic authentication URLs correctly', () => {
    const complexMsg = 'Urgent: update at http://192.0.2.10:8080/account or https://user:pass@evil.example/login'
    const urls = extractUrls(complexMsg)
    expect(urls).toContain('http://192.0.2.10:8080/account')
    expect(urls).toContain('https://user:pass@evil.example/login')
  })

  it('leaves zero extracted URLs for standard bank email example in analyzeText', () => {
    const bankEmail = 'From: Commercial Bank of Ethiopia <cbe-notice@gmail.com>\nSubject: Urgent: Account Suspended\n\nDear customer, suspicious login detected. Your account will be closed within 24 hours unless you verify your password.'
    const res = analyzeText(bankEmail, 'email')
    expect(res.error).toBeUndefined()
    expect(res.extractedUrls).toEqual([])
    // TXT-08 must still flag free webmail impersonation
    expect(res.indicators).toContain('TXT-08')
    expect(res.indicators).toContain('TXT-01')
    expect(res.indicators).toContain('TXT-02')
    expect(res.indicators).toContain('TXT-03')
  })
})
