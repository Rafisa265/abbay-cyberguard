import { describe, it, expect } from 'vitest'
import {
  INCIDENT_CATEGORIES,
  PLATFORM_RECOVERY_GUIDES,
  classifyIncidentCategory,
  getEmergencyContainmentActions,
  RECOVERY_SCAM_FLAGS,
  OFFICIAL_REPORTING_DIRECTORY,
  filterReportingDirectory,
  detectLanguageMix,
  professionalizeIncidentText,
  translateInstitutionalContent,
  INSTITUTIONAL_PROFILES,
  buildInstitutionalReport,
  auditReportQuality,
} from './lib/m3.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('M3 Intelligent Incident Response & Institutional Reporting Assistant', () => {
  describe('1. 15 Incident Categories & Multilingual NLP Classifier', () => {
    it('defines exactly 15 standardized incident categories with trilingual titles', () => {
      expect(INCIDENT_CATEGORIES).toHaveLength(15)
      for (const cat of INCIDENT_CATEGORIES) {
        expect(cat.id).toBeDefined()
        expect(cat.titleKey).toBeDefined()
        expect(cat.icon).toBeDefined()
        expect(cat.defaultSeverity).toBeDefined()
        expect(en[cat.titleKey]).toBeDefined()
        expect(om[cat.titleKey]).toBeDefined()
        expect(am[cat.titleKey]).toBeDefined()
      }
    })

    it('classifies Social Media Compromise in English, Afaan Oromoo, and Amharic', () => {
      expect(classifyIncidentCategory('Someone changed my Facebook password and email')).toBe('social_media_compromise')
      expect(classifyIncidentCategory('Herregni Telegram kiyya na jalaa hatamee jira')).toBe('social_media_compromise')
      expect(classifyIncidentCategory('የፌስቡክ አካውንቴ ተጠልፎ የይለፍ ቃሌ ተቀይሯል')).toBe('social_media_compromise')
    })

    it('classifies Banking and Mobile Money Fraud correctly', () => {
      expect(classifyIncidentCategory('15000 Birr transferred via Telebirr without my authorization')).toBe('mobile_money_fraud')
      expect(classifyIncidentCategory('CBE Birr account drained after fake lottery call')).toBe('mobile_money_fraud')
      expect(classifyIncidentCategory('CBE account unauthorized ATM debit withdrawal')).toBe('banking_fraud')
      expect(classifyIncidentCategory('በባንክ ሂሳቤ ላይ ያልተፈቀደ የገንዘብ ዝውውር ተፈጽሟል')).toBe('banking_fraud')
    })

    it('classifies Telecom SIM Swap and OTP Interception', () => {
      expect(classifyIncidentCategory('My SIM card was suddenly deactivated and swapped by Ethio telecom')).toBe('sim_swap_telecom')
      expect(classifyIncidentCategory('SIM card koo cufamee nama biraatiif dabarfame')).toBe('sim_swap_telecom')
      expect(classifyIncidentCategory('የሲም ካርድ ቁጥሬ ተሰርቆ የኤስኤምኤስ ኮድ ወደ ሌላ ስልክ ተላልፏል')).toBe('sim_swap_telecom')
    })

    it('classifies Malware, Ransomware, and DoS attacks', () => {
      expect(classifyIncidentCategory('Downloaded an untrusted APK file and it took over screen permissions')).toBe('malware_infection')
      expect(classifyIncidentCategory('All our database files are encrypted with .locked extension demanding Bitcoin payment')).toBe('ransomware')
      expect(classifyIncidentCategory('Our university portal is completely down under massive SYN flood traffic')).toBe('website_defacement_dos')
    })

    it('classifies BEC, Identity Theft, and Harassment', () => {
      expect(classifyIncidentCategory('Supplier invoice email was intercepted and bank routing details changed')).toBe('bec_fraud')
      expect(classifyIncidentCategory('Someone opened a CBE loan account using my Fayda National ID')).toBe('identity_theft')
      expect(classifyIncidentCategory('Receiving blackmail threats and defamatory photos on TikTok and Telegram')).toBe('online_harassment')
    })
  })

  describe('2. Official Platform Recovery Guides & Anti-Scam Shield', () => {
    it('provides verified official recovery URLs for major platforms with NO fake links', () => {
      const fb = PLATFORM_RECOVERY_GUIDES.facebook
      expect(fb.recoveryUrl).toBe('https://www.facebook.com/hacked')

      const ig = PLATFORM_RECOVERY_GUIDES.instagram
      expect(ig.recoveryUrl).toBe('https://www.instagram.com/hacked/')

      const wa = PLATFORM_RECOVERY_GUIDES.whatsapp
      expect(wa.recoveryUrl).toBe('https://faq.whatsapp.com/1131652977782073')

      const tg = PLATFORM_RECOVERY_GUIDES.telegram
      expect(tg.recoveryUrl).toBe('https://telegram.org/faq#compromised-accounts')

      const gg = PLATFORM_RECOVERY_GUIDES.google_gmail
      expect(gg.recoveryUrl).toBe('https://accounts.google.com/signin/recovery')

      const ms = PLATFORM_RECOVERY_GUIDES.microsoft
      expect(ms.recoveryUrl).toBe('https://account.live.com/acsr')

      const tb = PLATFORM_RECOVERY_GUIDES.telebirr
      expect(tb.hotline).toBe('994')

      const cbe = PLATFORM_RECOVERY_GUIDES.cbe
      expect(cbe.hotline).toBe('951 / 8888')

      // Verify all guide platforms have trilingual warnings and steps
      for (const [key, guide] of Object.entries(PLATFORM_RECOVERY_GUIDES)) {
        expect(en[guide.recoveryStepsKey]).toBeDefined()
        expect(om[guide.recoveryStepsKey]).toBeDefined()
        expect(am[guide.recoveryStepsKey]).toBeDefined()
        expect(en[guide.scamWarningKey]).toBeDefined()
        expect(om[guide.scamWarningKey]).toBeDefined()
        expect(am[guide.scamWarningKey]).toBeDefined()
      }
    })

    it('provides immediate emergency containment actions tailored per incident type', () => {
      const finActions = getEmergencyContainmentActions('mobile_money_fraud')
      expect(finActions.some((a) => a.actionKey.includes('block_accounts') || a.actionKey.includes('freeze'))).toBe(true)

      const malActions = getEmergencyContainmentActions('malware_infection')
      expect(malActions.some((a) => a.actionKey.includes('disconnect') || a.actionKey.includes('airplane'))).toBe(true)

      const socActions = getEmergencyContainmentActions('social_media_compromise')
      expect(socActions.some((a) => a.actionKey.includes('sessions') || a.actionKey.includes('reset'))).toBe(true)
    })

    it('verifies secondary recovery scam red flags with trilingual translations', () => {
      expect(RECOVERY_SCAM_FLAGS.length).toBeGreaterThanOrEqual(5)
      for (const flagKey of RECOVERY_SCAM_FLAGS) {
        expect(en[flagKey]).toBeDefined()
        expect(om[flagKey]).toBeDefined()
        expect(am[flagKey]).toBeDefined()
        expect(en[flagKey].length).toBeGreaterThan(10)
      }
    })
  })

  describe('3. Verified Official Reporting Directory', () => {
    it('contains verified Ethiopian authorities and global platform trust teams', () => {
      expect(OFFICIAL_REPORTING_DIRECTORY.length).toBeGreaterThanOrEqual(8)

      const insa = OFFICIAL_REPORTING_DIRECTORY.find((e) => e.id === 'rep_insa_cert')
      expect(insa).toBeDefined()
      expect(insa.phoneHotline).toBe('951')
      expect(insa.scope).toBe('ethiopia_national')

      const police = OFFICIAL_REPORTING_DIRECTORY.find((e) => e.id === 'rep_federal_police')
      expect(police).toBeDefined()
      expect(police.phoneHotline).toBe('991')
      expect(police.secondaryPhone).toBe('+251 11 551 2744')

      const telecom = OFFICIAL_REPORTING_DIRECTORY.find((e) => e.id === 'rep_ethio_telecom')
      expect(telecom).toBeDefined()
      expect(telecom.phoneHotline).toBe('994')

      const cbe = OFFICIAL_REPORTING_DIRECTORY.find((e) => e.id === 'rep_cbe_fraud')
      expect(cbe).toBeDefined()
      expect(cbe.phoneHotline).toBe('8888')

      const nbe = OFFICIAL_REPORTING_DIRECTORY.find((e) => e.id === 'rep_nbe_regulator')
      expect(nbe).toBeDefined()
    })

    it('filters reporting directory by search keyword, category, and scope', () => {
      const ethioOnly = filterReportingDirectory('', 'all', 'ethiopia_national')
      expect(ethioOnly.every((o) => o.scope === 'ethiopia_national')).toBe(true)

      const globalOnly = filterReportingDirectory('', 'all', 'global_platform')
      expect(globalOnly.every((o) => o.scope === 'global_platform')).toBe(true)

      const searchPolice = filterReportingDirectory('Police', 'all', 'all')
      expect(searchPolice.some((o) => o.id === 'rep_federal_police')).toBe(true)

      const searchMeta = filterReportingDirectory('Meta', 'all', 'all')
      expect(searchMeta.some((o) => o.id === 'rep_meta_security')).toBe(true)
    })
  })

  describe('4. Multilingual Understanding & Professional Polish', () => {
    it('detects language mix accurately for Latin, Ethiopic, and Mixed scripts', () => {
      expect(detectLanguageMix('This is standard english text').primary).toBe('en')
      expect(detectLanguageMix('This is standard english text').mixed).toBe(false)
      expect(detectLanguageMix('ይህ የአማርኛ ጽሑፍ ነው').primary).toBe('am')
      expect(detectLanguageMix('Imeelii fi lakkoofsa kiyya gargaaraa').primary).toBe('om')
      expect(detectLanguageMix('Password koo ተሰርቋል on Facebook').mixed).toBe(true)
    })

    it('transforms informal/code-switching text into professional institutional language while preserving facts', () => {
      const input = 'yesteday someone hacked my fb acct and stole 5000 birr via telebirr ref TX123456'
      const polished = professionalizeIncidentText(input, 'en')

      expect(polished.corrected).toContain('compromised')
      expect(polished.corrected).toContain('account')
      expect(polished.corrected).toContain('TX123456') // critical fact preserved
      expect(polished.corrected).toContain('5000') // amount preserved
    })

    it('translates institutional content between English, Afaan Oromoo, and Amharic while keeping references', () => {
      const enText = 'Executive Summary: Unauthorized access detected on 2026-10-30. Incident Reference: CSE-101.'
      const omText = translateInstitutionalContent(enText, 'en', 'om')
      expect(omText).toContain('Cuunfaa Hojii (Executive Summary)')
      expect(omText).toContain('2026-10-30')
      expect(omText).toContain('CSE-101')

      const amText = translateInstitutionalContent(enText, 'en', 'am')
      expect(amText).toContain('አስፈፃሚ ማጠቃለያ')
      expect(amText).toContain('2026-10-30')
      expect(amText).toContain('CSE-101')
    })
  })

  describe('5. Institutional Report Generator (14 Sections & 7 Profiles)', () => {
    it('defines exactly 7 institutional profiles with verified recipients and mandates', () => {
      expect(INSTITUTIONAL_PROFILES).toHaveLength(7)
      const ids = INSTITUTIONAL_PROFILES.map((p) => p.id)
      expect(ids).toContain('bank_financial')
      expect(ids).toContain('telecom_provider')
      expect(ids).toContain('university_academic')
      expect(ids).toContain('government_regulator')
      expect(ids).toContain('private_company')
      expect(ids).toContain('cert_national')
      expect(ids).toContain('law_enforcement')
    })

    it('builds a complete 14-section standardized report tailored for Bank profile', () => {
      const formData = {
        type: 'mobile_money_fraud',
        date: '2026-10-29',
        what: 'Fraudulent SMS posing as CBE lottery prompted OTP sharing, resulting in 12,000 ETB unauthorized transfer.',
        reporterName: 'Abebe Kebede',
        reporterContact: '0911223344',
        financialLoss: '12000',
        timeline: [
          { date: '2026-10-29', time: '14:15', description: 'Received SMS from spoofed header' },
          { date: '2026-10-29', time: '14:20', description: 'Caller convinced me to provide verification SMS' },
          { date: '2026-10-29', time: '14:22', description: 'Debit alert received for 12,000 ETB' },
        ],
        evidenceItems: [
          { type: 'sms', description: 'SMS screenshot from spoofed shortcode', source: 'Android Device' },
        ],
      }

      const report = buildInstitutionalReport(formData, 'bank_financial', 'en')

      // Verify all 14 section headers are present
      expect(report).toContain('1. REPORT TITLE:')
      expect(report).toContain('2. RECIPIENT INSTITUTION:')
      expect(report).toContain('3. REPORTING PARTY IDENTIFICATION:')
      expect(report).toContain('4. EXECUTIVE SUMMARY:')
      expect(report).toContain('5. INCIDENT CLASSIFICATION & SEVERITY ASSESSMENT:')
      expect(report).toContain('6. INCIDENT CHRONOLOGY & TIMELINE OF EVENTS:')
      expect(report).toContain('7. DETAILED INCIDENT DESCRIPTION:')
      expect(report).toContain('8. SCOPE AND IMPACT ANALYSIS:')
      expect(report).toContain('9. EVIDENCE AND SUPPORTING ARTIFACTS:')
      expect(report).toContain('10. IMMEDIATE ACTIONS ALREADY TAKEN:')
      expect(report).toContain('11. REQUESTED ASSISTANCE & INSTITUTIONAL RELIEF:')
      expect(report).toContain('12. RECOMMENDED PREVENTATIVE DEFENSIVE MEASURES:')
      expect(report).toContain('13. CONCLUSION & FORMAL AFFIRMATION:')
      expect(report).toContain('14. REPORTER SIGN-OFF & TRANSMISSION AUTHENTICATION:')

      // Verify content specific to Bank and form data
      expect(report).toContain('Abebe Kebede')
      expect(report).toContain('12000 ETB')
      expect(report).toContain('14:15')
      expect(report).toContain('14:22')
    })
  })

  describe('6. AI Quality Assurance Review Engine & Privacy Hardening', () => {
    it('detects exposed OTPs or secret credentials and sets privacy_warning status', () => {
      const formData = {
        type: 'phishing',
        date: '2026-10-30',
        what: 'The agent told me to give my OTP 482910 to unlock my account.',
        reporterName: 'Test Reporter',
      }
      const review = auditReportQuality(formData, formData.what)

      expect(review.status).toBe('privacy_warning')
      expect(review.passedChecks.privacy).toBe(false)
      const privacyIssue = review.issues.find((i) => i.category === 'privacy')
      expect(privacyIssue).toBeDefined()
      expect(privacyIssue.severity).toBe('critical')
      expect(privacyIssue.redactCandidate).toBe('482910')
    })

    it('detects valid 16-digit payment card numbers via Luhn algorithm', () => {
      // 4111-1111-1111-1111 is the canonical valid Visa test card passing Luhn
      const formData = {
        type: 'banking_fraud',
        date: '2026-10-30',
        what: 'I typed my card number 4111-1111-1111-1111 into the phishing site.',
        reporterName: 'Test User',
      }
      const review = auditReportQuality(formData, formData.what)

      expect(review.status).toBe('privacy_warning')
      expect(review.passedChecks.privacy).toBe(false)
      const cardIssue = review.issues.find((i) => i.key === 'm3.qa.exposed_card')
      expect(cardIssue).toBeDefined()
    })

    it('flags missing critical fields as incomplete', () => {
      const emptyForm = { type: '', date: '', what: '', reporterName: '' }
      const review = auditReportQuality(emptyForm, '')

      expect(review.status).toBe('needs_more_info')
      expect(review.passedChecks.completeness).toBe(false)
      expect(review.issues.some((i) => i.key === 'm3.qa.missing_description')).toBe(true)
    })

    it('grants ready_for_review status when report is complete, professional, and privacy-clean', () => {
      const cleanForm = {
        type: 'social_media_compromise',
        date: '2026-10-28',
        what: 'An unknown actor compromised my Telegram session from an IP in another country. I have since logged out other sessions and enabled 2FA.',
        reporterName: 'Almaz Tadesse',
        reporterContact: '0922334455',
      }
      const review = auditReportQuality(cleanForm, cleanForm.what)

      expect(review.status).toBe('ready_for_review')
      expect(review.passedChecks.privacy).toBe(true)
      expect(review.passedChecks.completeness).toBe(true)
      expect(review.issues.filter((i) => i.severity === 'critical' || i.severity === 'error')).toHaveLength(0)
    })
  })
})
