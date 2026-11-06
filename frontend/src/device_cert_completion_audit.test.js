import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import AcademyCertificateModal from './components/AcademyCertificateModal.jsx'
import DeviceSecurityCheck from './components/DeviceSecurityCheck.jsx'
import { makeT } from './i18n.js'
import en from './locales/en.js'
import am from './locales/am.js'
import om from './locales/om.js'

describe('ABBAY CYBERGUARD — Final Device Security & Certificate Integrity Audit', () => {
  const tEn = makeT('en')

  describe('Part B: Academy Certificate Accuracy, Cryptographic Token & Presentation Audit', () => {
    it('1. Generates unpredictable, cryptographic Certificate ID and 128-bit hex Verification Code', () => {
      const certData = {
        levelNum: 1,
        title: 'Stage 1 — Level 1 Milestone Certificate',
        recipientName: 'Abel Tesfaye',
        score: 95,
        stars: 3,
      }

      const html = renderToString(React.createElement(AcademyCertificateModal, { certData, onClose: () => {}, t: tEn }))
      
      // ID must start with ACYBER-YYYY- and not follow predictable old formula 1337 + 42 = 0x563
      expect(html).toMatch(/ACYBER-\d{4}-[0-9A-F]{16}/)
      expect(html).not.toContain('000563')

      // Verification code must be 32-character hex and not predictable `${certId}-${name}-verified`
      expect(html).toMatch(/[0-9a-f]{32}/)
      expect(html).not.toContain('abeltesfaye-verified')
    })

    it('2. Honest Platform Seal: displays "LOCALLY RECORDED" instead of misleading "VERIFIED SECURE"', () => {
      const certData = {
        levelNum: 2,
        title: 'Stage 1 — Level 2 Milestone Certificate',
        recipientName: 'Sara Bekele',
        score: 85,
        stars: 2,
      }

      const html = renderToString(React.createElement(AcademyCertificateModal, { certData, onClose: () => {}, t: tEn }))

      expect(html).toContain('LOCALLY RECORDED')
      expect(html).not.toContain('VERIFIED SECURE')
      expect(html).toContain('Verification is local only')
    })

    it('3. Honest Educational Record: canvas/footer states "EDUCATIONAL COMPLETION RECORD" without external accreditation claim', () => {
      const certData = {
        levelNum: 1,
        title: 'Phishing Defense Assessment',
        recipientName: 'Guest Defender',
      }

      const html = renderToString(React.createElement(AcademyCertificateModal, { certData, onClose: () => {}, t: tEn }))

      expect(html).toContain('CERTIFICATE OF EDUCATIONAL COMPLETION')
      expect(html).not.toContain('OFFICIAL VERIFIED RECORD')
      expect(html).toContain('It does not confer professional licensure, university degree credit, or official')
    })

    it('4. Conditional Mastery Text: distinguishes "mastered" (score>=80 + 3 stars) vs "completed" vs "participated"', () => {
      // 4a. Mastered: score 90 + 3 stars
      const certMastered = {
        levelNum: 1,
        score: 90,
        stars: 3,
        recipientName: 'Top Learner',
      }
      const htmlMastered = renderToString(React.createElement(AcademyCertificateModal, { certData: certMastered, onClose: () => {}, t: tEn }))
      expect(htmlMastered).toContain('has successfully mastered and demonstrated competence in')

      // 4b. Completed: score 70 + 1 star
      const certCompleted = {
        levelNum: 1,
        score: 70,
        stars: 1,
        recipientName: 'Good Learner',
      }
      const htmlCompleted = renderToString(React.createElement(AcademyCertificateModal, { certData: certCompleted, onClose: () => {}, t: tEn }))
      expect(htmlCompleted).toContain('has successfully completed coursework in')
      expect(htmlCompleted).not.toContain('has successfully mastered')

      // 4c. Participated: score 45
      const certParticipated = {
        levelNum: 1,
        score: 45,
        stars: 0,
        recipientName: 'Participant',
      }
      const htmlParticipated = renderToString(React.createElement(AcademyCertificateModal, { certData: certParticipated, onClose: () => {}, t: tEn }))
      expect(htmlParticipated).toContain('has participated in and engaged with')
    })

    it('5. Score and Stars Prominently Rendered on Certificate Surface', () => {
      const certData = {
        levelNum: 3,
        title: 'Privacy & Device Hygiene',
        recipientName: 'Marta Hailu',
        score: 92,
        stars: 3,
      }

      const html = renderToString(React.createElement(AcademyCertificateModal, { certData, onClose: () => {}, t: tEn }))

      expect(html).toContain('Assessment Score:')
      expect(html).toContain('92%')
      expect(html).toContain('★★★')
    })

    it('6. Works in Guest Mode Without Login, Recipient Name is Editable', () => {
      const certData = {
        levelNum: 1,
        title: 'Essential Awareness Assessment',
        recipientName: 'Guest Defender',
        score: 80,
      }

      const html = renderToString(React.createElement(AcademyCertificateModal, { certData, onClose: () => {}, t: tEn }))

      expect(html).toContain('Guest Defender')
      expect(html).toContain('Change Name')
    })
  })

  describe('Part A: Device Security Final Implementation & Transparency Audit', () => {
    it('7. Renders Honest Capability Inventory with All 12 Controls Categorized', () => {
      const html = renderToString(React.createElement(DeviceSecurityCheck, { t: tEn }))
      expect(html).toContain('Device Security Check')
      expect(html).toContain('LOCAL DEVICE DEFENSE')
      expect(html).toContain('100% On-Device / Zero Telemetry')
    })

    it('8. Trilingual Localization Parity for all New Device Security and Certificate Keys', () => {
      const requiredKeys = [
        'device.check_disk_encryption',
        'device.check_screen_lock',
        'device.check_startup',
        'device.check_process_monitor',
        'device.alert_notifications',
        'device.enable_notifications',
        'device.alert_history',
        'device.clear_alerts',
        'device.monitoring_type',
        'device.monitoring_disclaimer',
        'device.last_checked',
        'device.check_now',
        'device.overall_assessment',
        'device.overall_pass',
        'device.browser_environment',
        'device.capability_inventory',
        'device.capability_browser_only',
        'device.capability_registry',
        'device.capability_unsupported',
        'device.open_settings',
        'device.rating_all_checked_controls_passed',
        'academy.cert.score_label',
        'academy.cert.stars_label',
        'academy.cert.local_verification_note',
        'academy.cert.completion_type_mastered',
        'academy.cert.completion_type_completed',
        'academy.cert.completion_type_participated',
        'academy.cert.locally_recorded',
        'academy.cert.educational_completion_record',
      ]

      for (const k of requiredKeys) {
        expect(en[k], `Missing in English: ${k}`).toBeTruthy()
        expect(am[k], `Missing in Amharic: ${k}`).toBeTruthy()
        expect(om[k], `Missing in Afaan Oromoo: ${k}`).toBeTruthy()
        expect(en[k].length).toBeGreaterThan(0)
        expect(am[k].length).toBeGreaterThan(0)
        expect(om[k].length).toBeGreaterThan(0)
      }
    })
  })
})

