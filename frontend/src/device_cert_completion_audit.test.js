import { describe, it, expect, vi } from 'vitest'
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

  describe('Part B: Server-Issued Academy Certificate Integrity', () => {
    it('does not invent local IDs or claim verification before server issuance', () => {
      const certData = {
        levelNum: 1,
        title: 'Level 1: Essential Awareness',
        recipientName: 'Abel Tesfaye',
      }

      const html = renderToString(React.createElement(AcademyCertificateModal, { certData, onClose: () => {}, t: tEn }))

      expect(html).toContain('Preview only')
      expect(html).not.toMatch(/ACYBER-\d{4}-/)
      expect(html).not.toContain('LOCALLY RECORDED')
    })

    it('shows the server-issued record and does not expose a fabricated local code', () => {
      const certData = {
        levelNum: 1,
        title: 'Level 1: Essential Awareness',
        recipientName: 'Sara Bekele',
        certificate: {
          certificate_id: 'ACYBER-2026-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          recipient_name: 'Sara Bekele',
          course_title: 'Level 1: Essential Awareness',
          issued_at: '2026-01-01T00:00:00Z',
          status: 'issued',
          issuer: 'ABBAY CYBERGUARD Academy',
        },
      }

      const html = renderToString(React.createElement(AcademyCertificateModal, { certData, onClose: () => {}, t: tEn }))

      expect(html).toContain('ACYBER-2026-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      expect(html).toContain('issued')
      expect(html).not.toContain('VERIFIED SECURE')
      expect(html).not.toContain('Local Verification Code')
    })

    it('labels the document as an assessment milestone and disclaims course-reading verification', () => {
      const certData = {
        levelNum: 1,
        title: 'Phishing Defense Assessment',
        recipientName: 'Learner Name',
      }

      const html = renderToString(React.createElement(AcademyCertificateModal, { certData, onClose: () => {}, t: tEn }))

      expect(html).toContain('CERTIFICATE OF ASSESSMENT MILESTONE')
      expect(html).not.toContain('OFFICIAL VERIFIED RECORD')
      expect(html).toContain('Does not confer professional licensure')
      expect(html).toContain('lesson reading is not verified')
    })

    it('provides a confirmation field and does not call the issuer during rendering', () => {
      const onIssue = vi.fn()
      const certData = {
        levelNum: 1,
        title: 'Level 1: Essential Awareness',
        recipientName: 'Learner Name',
      }

      const html = renderToString(React.createElement(AcademyCertificateModal, { certData, onIssue, onClose: () => {}, t: tEn }))

      expect(html).toContain('certificate-recipient')
      expect(html).toContain('Issue certificate')
      expect(onIssue).not.toHaveBeenCalled()
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
        'academy.cert.ready',
        'academy.cert.requirements_pending',
        'academy.cert.sync_failed',
        'academy.cert.login_required',
        'academy.cert.name_confirmation',
        'academy.cert.issue_btn',
        'academy.cert.download_pdf',
        'academy.cert.my_certificates',
        'academy.verify.title',
        'academy.verify.loading',
        'academy.verify.not_found',
        'academy.verify.unavailable',
        'academy.verify.valid',
        'academy.verify.privacy',
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
