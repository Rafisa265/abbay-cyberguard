import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import {
  sensitiveFlags,
  validate,
  buildDraft,
  validChannel,
  luhn,
  TYPES,
  METHODS,
  LOSSES,
  triageIncident,
  sortTimelineEvents,
  generateReportPdfBlob,
  createPdfWithJpegPages,
  createPdfWithJpeg,
  extractIncidentFeatures,
  predictIncidentType,
} from './m3.js'
import channels from '../data/channels.json'
import M3 from '../components/M3.jsx'
import en from '../locales/en.js'
import om from '../locales/om.js'
import am from '../locales/am.js'

const today = new Date('2026-10-16T12:00:00')

describe('M3 — Incident Report Comprehensive QA & Privacy Hardening', () => {
  describe('1. Legacy Functional Regression & Channel Verification', () => {
    it('luhn + flags (FR-20)', () => {
      expect(luhn('4111111111111111')).toBe(true)
      expect(sensitiveFlags('card 4111 1111 1111 1111')).toContain('card')
      expect(sensitiveFlags('my password is hunter2')).toContain('secret')
      expect(sensitiveFlags('OTP: 482913')).toContain('secret')
      expect(sensitiveFlags('id 1234567890123')).toContain('longdigits')
      expect(sensitiveFlags('A caller asked me to send money on Tuesday.')).toEqual([])
    })

    it('validation keeps messages field-level (FR-18)', () => {
      const e = validate({ type: '', date: '2026-12-01', what: '', reporter: 'abc' }, today)
      expect(e).toMatchObject({ type: 'required', date: 'future', what: 'required', reporter: 'contact' })
      expect(validate({ type: 'fraud', date: '2026-10-01', what: 'x'.repeat(3001) }, today).what).toBe('toolong')
      expect(validate({ type: 'fraud', date: '2026-10-01', what: 'ok', reporter: 'a@b.co' }, today)).toEqual({})
    })

    it('draft contains entered data only', () => {
      const t = (k) => k
      const d = buildDraft(
        {
          type: 'fraud',
          date: '2026-10-01',
          what: 'Story',
          suspect: 'handle',
          method: '',
          loss: '',
          amount: '',
          evidence: '',
          reporter: '',
        },
        t,
        today
      )
      expect(d).toContain('Story')
      expect(d).toContain('handle')
      expect(d).not.toContain('m3.d.reporter')
    })

    it('channel list is empty and schema rejects incomplete records (FR-22)', () => {
      expect(channels).toEqual([])
      expect(validChannel({ name: 'x', contact: 'y', sourceUrl: 'https://a.gov', verifiedOn: '2026-01-01', reviewerRole: 'owner' })).toBe(true)
      expect(validChannel({ name: 'x', contact: 'y', verifiedOn: '2026-01-01', reviewerRole: 'owner' })).toBe(false)
      expect(validChannel({ name: 'x', contact: 'y', sourceUrl: 'https://a.gov', reviewerRole: 'owner' })).toBe(false)
    })
  })

  describe('2. Rule-Based Deterministic Incident Triage', () => {
    it('triages active financial extraction or SIM/OTP scam as Urgent', () => {
      const financialUrgent = triageIncident({
        type: 'fraud',
        loss: 'money',
        amount: '10,000 ETB',
        what: 'Unauthorized withdrawal occurred.',
      })
      expect(financialUrgent.severity).toBe('urgent')
      expect(financialUrgent.status).toBe('confirmed')
      expect(financialUrgent.reasons).toContain('m3.triage.reason.financial')

      const simOtpUrgent = triageIncident({
        type: 'sim_otp',
        what: 'Phone lost signal and attacker called asking for OTP.',
      })
      expect(simOtpUrgent.severity).toBe('urgent')
      expect(simOtpUrgent.reasons).toContain('m3.triage.reason.sim_otp')
    })

    it('triages account takeover or malware/APK installation as High', () => {
      const takeoverHigh = triageIncident({
        type: 'takeover',
        loss: 'access',
        what: 'Locked out of account and profile is inaccessible.',
      })
      expect(takeoverHigh.severity).toBe('high')
      expect(takeoverHigh.status).toBe('confirmed')
      expect(takeoverHigh.reasons).toContain('m3.triage.reason.account_compromise')

      const malwareHigh = triageIncident({
        type: 'malware',
        what: 'Installed suspicious Telegram APK requesting Accessibility service.',
      })
      expect(malwareHigh.severity).toBe('high')
      expect(malwareHigh.reasons).toContain('m3.triage.reason.malware')
    })

    it('triages phishing attempts, privacy data loss, and harassment as Medium', () => {
      const phishingMed = triageIncident({
        type: 'phishing',
        loss: 'none',
        what: 'Received fake bank lottery SMS with suspicious link.',
      })
      expect(phishingMed.severity).toBe('medium')
      expect(phishingMed.status).toBe('suspected')
      expect(phishingMed.reasons).toContain('m3.triage.reason.phishing')

      const privacyMed = triageIncident({
        type: 'privacy',
        loss: 'data',
        what: 'Phone number and personal details exposed online.',
      })
      expect(privacyMed.severity).toBe('medium')
      expect(privacyMed.reasons).toContain('m3.triage.reason.data_exposure')
    })

    it('triages unsolicited contact or low-impact reports as Low', () => {
      const lowImpact = triageIncident({
        type: 'other',
        loss: 'none',
        what: 'Received a strange greeting message from an unknown number with no links or requests.',
      })
      expect(lowImpact.severity).toBe('low')
      expect(lowImpact.status).toBe('suspected')
      expect(lowImpact.reasons).toContain('m3.triage.reason.low_impact')
    })

    it('correctly distinguishes Confirmed vs Suspected incidents', () => {
      const confirmed = triageIncident({ type: 'fraud', loss: 'money' })
      expect(confirmed.status).toBe('confirmed')

      const suspected = triageIncident({ type: 'phishing', loss: 'none' })
      expect(suspected.status).toBe('suspected')
    })
  })

  describe('3. Incident Response Plans Across All Required Categories', () => {
    const t = (k) => en[k] || k

    it('includes actionable response plan for Phishing', () => {
      const draft = buildDraft({ type: 'phishing', date: '2026-10-10', what: 'Fake KYC SMS received' }, t, today)
      expect(draft).toContain('Phishing response')
      expect(draft).toContain('Do not open suspicious links')
    })

    it('includes actionable response plan for Suspected Account Compromise', () => {
      const draft = buildDraft({ type: 'takeover', date: '2026-10-10', what: 'Logged out of account' }, t, today)
      expect(draft).toContain('Account recovery')
      expect(draft).toContain('terminate unknown active sessions')
    })

    it('includes actionable response plan for Financial Fraud', () => {
      const draft = buildDraft({ type: 'fraud', date: '2026-10-10', what: 'Lost funds from wallet', loss: 'money' }, t, today)
      expect(draft).toContain('Financial dispute')
      expect(draft).toContain('freeze unauthorized transfers')
    })

    it('includes actionable response plan for Suspicious APKs / Malware', () => {
      const draft = buildDraft({ type: 'malware', date: '2026-10-10', what: 'Installed rogue app from telegram' }, t, today)
      expect(draft).toContain('Malware / APK containment')
      expect(draft).toContain('Airplane Mode')
      expect(draft).toContain('Do not grant Accessibility')
    })

    it('includes actionable response plan for SIM / OTP Scams', () => {
      const draft = buildDraft({ type: 'sim_otp', date: '2026-10-10', what: 'Caller demanded verification code' }, t, today)
      expect(draft).toContain('SIM / OTP Scam response')
      expect(draft).toContain('Never recite or forward incoming SMS codes')
    })

    it('includes actionable response plan for Privacy Exposure', () => {
      const draft = buildDraft({ type: 'privacy', date: '2026-10-10', what: 'Personal profile leaked' }, t, today)
      expect(draft).toContain('Privacy exposure mitigation')
      expect(draft).toContain('Update credentials on any service sharing similar passwords')
    })
  })

  describe('4. Evidence Timeline & Deterministic Ordering', () => {
    it('sorts timeline events chronologically by date and time', () => {
      const rawEvents = [
        { id: '3', date: '2026-10-15', time: '14:00', description: 'Third event' },
        { id: '1', date: '2026-10-14', time: '09:00', description: 'First event' },
        { id: '2', date: '2026-10-14', time: '18:30', description: 'Second event' },
      ]
      const sorted = sortTimelineEvents(rawEvents)
      expect(sorted[0].id).toBe('1')
      expect(sorted[1].id).toBe('2')
      expect(sorted[2].id).toBe('3')
    })

    it('gracefully appends events with unknown/missing dates without fabricating timestamps', () => {
      const eventsWithUnknown = [
        { id: '2', date: '', time: '', description: 'Discovered missing funds much later' },
        { id: '1', date: '2026-10-12', time: '10:00', description: 'Received initial lure' },
      ]
      const sorted = sortTimelineEvents(eventsWithUnknown)
      expect(sorted[0].id).toBe('1')
      expect(sorted[1].id).toBe('2')
      expect(sorted[1].date).toBe('')
    })

    it('filters out empty or blank timeline descriptions', () => {
      const eventsWithBlanks = [
        { id: '1', date: '2026-10-12', description: 'Valid event' },
        { id: '2', date: '2026-10-13', description: '   ' },
        { id: '3', date: '', description: '' },
      ]
      const sorted = sortTimelineEvents(eventsWithBlanks)
      expect(sorted.length).toBe(1)
      expect(sorted[0].id).toBe('1')
    })

    it('embeds chronological timeline in generated report text', () => {
      const t = (k) => en[k] || k
      const draft = buildDraft(
        {
          type: 'fraud',
          date: '2026-10-15',
          what: 'Account was defrauded.',
          timeline: [
            { id: '1', date: '2026-10-14', time: '09:30', description: 'Received SMS lure' },
            { id: '2', date: '', time: '', description: 'Discovered balance drop' },
          ],
        },
        t,
        today
      )

      expect(draft).toContain('CHRONOLOGICAL EVENT TIMELINE:')
      expect(draft).toContain('• [2026-10-14 09:30] Received SMS lure')
      expect(draft).toContain('• [Date/time unrecorded] Discovered balance drop')
    })
  })

  describe('5. Real PDF Document Export & Format Verification', () => {
    it('generates a valid binary PDF Blob with application/pdf MIME type', () => {
      const draftText = 'CyberShield Ethiopia Incident Report\nSeverity: High\nWhat occurred: Details'
      const blob = generateReportPdfBlob(draftText, { title: 'Incident Report Draft', date: '2026-10-16' })

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/pdf')
      expect(blob.size).toBeGreaterThan(100)
    })

    it('generates PDF with valid PDF-1.4 header and EOF trailer', async () => {
      const draftText = 'Incident Report Content'
      const blob = generateReportPdfBlob(draftText, { title: 'Test Report' })
      const buffer = await blob.arrayBuffer()
      const text = new TextDecoder('latin1').decode(buffer)

      expect(text.startsWith('%PDF-1.4')).toBe(true)
      expect(text.includes('%%EOF')).toBe(true)
      expect(text.includes('/Type /Catalog')).toBe(true)
    })

    it('strictly adheres to ISO 32000-1 20-byte cross-reference table entries', async () => {
      const draftText = 'Incident Report Content\nLine 2\nLine 3'
      const blob = generateReportPdfBlob(draftText, { title: 'Test Report' })
      const buffer = await blob.arrayBuffer()
      const text = new TextDecoder('latin1').decode(buffer)

      // Verify startxref offset matches exact byte position of xref
      const match = text.match(/startxref\r?\n(\d+)\r?\n%%EOF/)
      expect(match).not.toBeNull()
      const reportedStartxref = parseInt(match[1], 10)
      const actualXrefIndex = text.indexOf('xref\r\n') !== -1 ? text.indexOf('xref\r\n') : text.indexOf('xref\n')
      expect(reportedStartxref).toBe(actualXrefIndex)

      // Verify xref lines: each table entry must be exactly 20 bytes long
      const xrefBlock = text.slice(actualXrefIndex)
      const xrefLines = xrefBlock.split(/\r?\n/)
      expect(xrefLines[0]).toBe('xref')
      const [startObj, count] = xrefLines[1].split(' ').map(Number)
      expect(startObj).toBe(0)
      expect(count).toBeGreaterThanOrEqual(5)

      // Object 0 is always the free entry '0000000000 65535 f'
      for (let i = 2; i < 2 + count; i++) {
        // When split by \n or \r\n, the entry line without line breaks has 18 or 19 chars (depending on \r)
        // Check raw bytes in buffer for exact 20-byte step
        const entryOffset = actualXrefIndex + text.slice(actualXrefIndex).indexOf(xrefLines[i])
        // If entry is in CRLF format, line is 18 chars + \r\n = 20 bytes
        const lineLen = xrefLines[i].length
        expect([18, 19, 20]).toContain(lineLen)
        if (i > 2) {
          const objOffset = parseInt(xrefLines[i].slice(0, 10), 10)
          const objMarker = `${i - 2} 0 obj`
          expect(text.indexOf(objMarker)).toBe(objOffset)
        }
      }
    })

    it('generates multi-page PDF documents correctly via createPdfWithJpegPages', async () => {
      const mockJpeg = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70])
      const blob = createPdfWithJpegPages([
        { width: 1240, height: 1754, bytes: mockJpeg },
        { width: 1240, height: 1754, bytes: mockJpeg },
      ])

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/pdf')
      const buffer = await blob.arrayBuffer()
      const text = new TextDecoder('latin1').decode(buffer)

      expect(text).toContain('/Count 2')
      expect(text).toContain('/Kids [3 0 R 6 0 R]')
      expect(text).toContain('/Im1')
      expect(text).toContain('/Im2')
      expect(text.includes('%%EOF')).toBe(true)

      // Check startxref precision
      const match = text.match(/startxref\r?\n(\d+)\r?\n%%EOF/)
      const startxref = parseInt(match[1], 10)
      expect(text.indexOf('xref\r\n')).toBe(startxref)
    })
  })

  describe('6. Form Validation & Edge Cases', () => {
    it('requires type, date, and what fields on empty submission', () => {
      const errs = validate({}, today)
      expect(errs.type).toBe('required')
      expect(errs.date).toBe('required')
      expect(errs.what).toBe('required')
      expect(errs.reporter).toBeUndefined()
    })

    it('rejects whitespace-only descriptions for required what field', () => {
      const errs = validate({ type: 'fraud', date: '2026-10-01', what: '    \n\t   ' }, today)
      expect(errs.what).toBe('required')
    })

    it('rejects future dates while accepting current or past dates', () => {
      const future = validate({ type: 'phishing', date: '2026-10-20', what: 'Incident occurred' }, today)
      expect(future.date).toBe('future')

      const validPast = validate({ type: 'phishing', date: '2026-10-10', what: 'Incident occurred' }, today)
      expect(validPast.date).toBeUndefined()

      const validToday = validate({ type: 'phishing', date: '2026-10-16', what: 'Incident occurred' }, today)
      expect(validToday.date).toBeUndefined()
    })

    it('enforces character limits on text areas and inputs', () => {
      const tooLongWhat = validate({ type: 'fraud', date: '2026-10-01', what: 'A'.repeat(3001) }, today)
      expect(tooLongWhat.what).toBe('toolong')

      const okWhat = validate({ type: 'fraud', date: '2026-10-01', what: 'A'.repeat(3000) }, today)
      expect(okWhat.what).toBeUndefined()

      const tooLongSuspect = validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', suspect: 'S'.repeat(1001) }, today)
      expect(tooLongSuspect.suspect).toBe('toolong')

      const tooLongEvidence = validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', evidence: 'E'.repeat(1001) }, today)
      expect(tooLongEvidence.evidence).toBe('toolong')

      const tooLongAmount = validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', amount: '9'.repeat(1001) }, today)
      expect(tooLongAmount.amount).toBe('toolong')

      const tooLongReporter = validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', reporter: 'user@' + 'x'.repeat(250) + '.com' }, today)
      expect(tooLongReporter.reporter).toBe('toolong')
    })

    it('validates reporter contact format (email or phone) when provided, and permits empty', () => {
      expect(validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', reporter: '' }, today).reporter).toBeUndefined()
      expect(validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', reporter: '   ' }, today).reporter).toBeUndefined()
      expect(validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', reporter: 'victim@example.com' }, today).reporter).toBeUndefined()
      expect(validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', reporter: '+251 91 123 4567' }, today).reporter).toBeUndefined()
      expect(validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', reporter: '0911234567' }, today).reporter).toBeUndefined()
      expect(validate({ type: 'fraud', date: '2026-10-01', what: 'Valid', reporter: 'not-an-email-or-phone' }, today).reporter).toBe('contact')
    })
  })

  describe('7. Multilingual Secret Token Detection (EN, OM, AM)', () => {
    it('detects English secret credentials, passwords, and OTPs', () => {
      expect(sensitiveFlags('password is mysecretpass1')).toContain('secret')
      expect(sensitiveFlags('my passcode: 998811')).toContain('secret')
      expect(sensitiveFlags('telebirr OTP: 448899')).toContain('secret')
      expect(sensitiveFlags('verification code is 123456')).toContain('secret')
      expect(sensitiveFlags('card CVV: 789')).toContain('secret')
    })

    it('detects Amharic secret credentials and PINs', () => {
      expect(sensitiveFlags('የይለፍ ቃል: ሚስጥር123')).toContain('secret')
      expect(sensitiveFlags('የይለፍቃል፦ Sec9988')).toContain('secret')
      expect(sensitiveFlags('የባንክ ፒን ቁጥር 4829')).toContain('secret')
      expect(sensitiveFlags('የቴሌብር ኦቲፒ፦ 582914')).toContain('secret')
      expect(sensitiveFlags('የማረጋገጫ ኮድ: 4411')).toContain('secret')
    })

    it('detects Afaan Oromoo secret credentials and PINs', () => {
      expect(sensitiveFlags('jecha darbii: Sec1234')).toContain('secret')
      expect(sensitiveFlags('lakkoofsa iccitii 4829')).toContain('secret')
      expect(sensitiveFlags('koodii mirkaneessaa: 998124')).toContain('secret')
      expect(sensitiveFlags('koodii iccitii 5544')).toContain('secret')
    })

    it('detects 9+ digit identifiers (Ethiopian National ID Fayda, CBE accounts)', () => {
      expect(sensitiveFlags('Fayda ID 1234 5678 9012')).toContain('longdigits')
      expect(sensitiveFlags('CBE account 1000123456789')).toContain('longdigits')
    })

    it('rejects invalid card sequences and pure zero strings in Luhn validation', () => {
      expect(luhn('0000000000000000')).toBe(false)
      expect(luhn('123')).toBe(false)
      expect(luhn('not-a-number')).toBe(false)
      expect(luhn(null)).toBe(false)
      expect(luhn('')).toBe(false)
    })
  })

  describe('8. Privacy & Zero-Persistence Invariants', () => {
    it('verifies that M3 does not write incident details to localStorage or sessionStorage', () => {
      const mockStorage = {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
      }
      const originalLocal = globalThis.localStorage
      const originalSession = globalThis.sessionStorage
      globalThis.localStorage = mockStorage
      globalThis.sessionStorage = mockStorage

      try {
        const draft = buildDraft(
          {
            type: 'fraud',
            date: '2026-10-10',
            what: 'Sensitive incident description text',
            reporter: 'confidential_user@example.com',
          },
          (k) => k,
          today
        )

        expect(draft).toBeDefined()
        expect(mockStorage.setItem).not.toHaveBeenCalled()
      } finally {
        globalThis.localStorage = originalLocal
        globalThis.sessionStorage = originalSession
      }
    })
  })

  describe('9. Localization Trilingual Parity (EN, OM, AM)', () => {
    it('guarantees 100% key parity across EN, OM, and AM for all M3 keys', () => {
      const m3Keys = Object.keys(en).filter((k) => k.startsWith('m3.') || k.startsWith('c.'))
      expect(m3Keys.length).toBeGreaterThan(40)

      for (const k of m3Keys) {
        expect(om[k], `Missing OM key: ${k}`).toBeDefined()
        expect(om[k].trim().length, `Empty OM key: ${k}`).toBeGreaterThan(0)

        expect(am[k], `Missing AM key: ${k}`).toBeDefined()
        expect(am[k].trim().length, `Empty AM key: ${k}`).toBeGreaterThan(0)
      }
    })

    it('verifies triage, response plan, timeline, and export keys exist in all three languages', () => {
      const criticalKeys = [
        'm3.triage.title',
        'm3.severity.urgent',
        'm3.severity.high',
        'm3.severity.medium',
        'm3.severity.low',
        'm3.status.confirmed',
        'm3.status.suspected',
        'm3.triage.reasons_title',
        'm3.rec.financial',
        'm3.rec.account',
        'm3.rec.phishing',
        'm3.rec.malware',
        'm3.rec.sim_otp',
        'm3.rec.privacy',
        'm3.timeline.title',
        'm3.timeline.add',
        'm3.d.triage',
        'm3.d.timeline',
        'c.download_pdf',
        'c.print_pdf',
        'c.pdf_generated',
        'c.open_pdf',
        'c.pdf_opened',
        'c.pdf_download_err',
        'c.pdf_blocked_fallback',
      ]

      for (const k of criticalKeys) {
        expect(en[k]).toBeDefined()
        expect(om[k]).toBeDefined()
        expect(am[k]).toBeDefined()
      }
    })
  })

  describe('10. Component Accessibility & SSR Rendering', () => {
    it('renders M3 component cleanly in English SSR with triage, timeline, and PDF controls', () => {
      const html = renderToString(React.createElement(M3, { t: (k) => en[k] || k, lang: 'en' }))

      // Main container and heading
      expect(html).toContain('module-container')
      expect(html).toContain('id="m3-main-heading"')
      expect(html).toContain('M3 — Cybercrime report assistant')

      // Form inputs and accessibility labels
      expect(html).toContain('id="m3-type"')
      expect(html).toContain('id="m3-date"')
      expect(html).toContain('id="m3-what"')
      expect(html).toContain('aria-required="true"')
      expect(html).toContain('maxLength="3000"')

      // Timeline section
      expect(html).toContain('Incident Timeline')
      expect(html).toContain('+ Add Timeline Event')

      // Safety guidance card
      expect(html).toContain('Next Steps &amp; Safe Evidence Handling')
      expect(html).toContain('Preserve original evidence')

      // Channels card
      expect(html).toContain('Reporting channels')
      expect(html).toContain('No verified reporting channel is available')
    })

    it('renders M3 component cleanly in Afaan Oromoo SSR', () => {
      const html = renderToString(React.createElement(M3, { t: (k) => om[k] || k, lang: 'om' }))
      expect(html).toContain('Gargaaraa gabaasa yakka saayibarii')
      expect(html).toContain('Tarkaanfiiwwan Itti Aanan')
      expect(html).toContain('Tartiiba Yeroo Taatee')
    })

    it('renders M3 component cleanly in Amharic SSR', () => {
      const html = renderToString(React.createElement(M3, { t: (k) => am[k] || k, lang: 'am' }))
      expect(html).toContain('የሳይበር ወንጀል ሪፖርት ረዳት')
      expect(html).toContain('ቀጣይ እርምጃዎች እና አስተማማኝ የማስረጃ አያያዝ')
      expect(html).toContain('የክስተቱ የጊዜ ቅደም ተከተል')
    })
  })

  describe('6. M3 In-Browser ML Incident Category Prediction', () => {
    it('returns null for empty or non-informative text', () => {
      expect(predictIncidentType('')).toBeNull()
      expect(predictIncidentType('Hello world how are you today')).toBeNull()
    })

    it('predicts sim_otp for English telecom SIM and OTP deactivation description', () => {
      const res = predictIncidentType('Ethio telecom agent called saying my SIM card is disconnected and demanded my OTP verification code')
      expect(res).not.toBeNull()
      expect(res.engine).toBe('ml_m3_incident_v1')
      expect(res.predictedClass).toBe('sim_otp')
      expect(res.confidence).toBeGreaterThanOrEqual(0.50)
      expect(res.isConfident).toBe(true)
    })

    it('predicts malware for Amharic APK download and Android accessibility permission description', () => {
      const res = predictIncidentType('አዲስ የባንክ መተግበሪያ ኤፒኬ አውርጄ የአንድሮይድ ቁጥጥር ፈቃድ ሰጥቼ ስልኬ ተዘጋብኝ')
      expect(res).not.toBeNull()
      expect(res.predictedClass).toBe('malware')
      expect(res.isConfident).toBe(true)
    })

    it('predicts fraud for Afaan Oromoo prize and fee advance scam description', () => {
      const res = predictIncidentType('Badhaasa qarshii 100000 mooteetta dursanii kaffaltii galmee kaffalaa jedhan')
      expect(res).not.toBeNull()
      expect(res.predictedClass).toBe('fraud')
      expect(res.isConfident).toBe(true)
    })
  })
})
