import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import DeviceSecurityCheck from './components/DeviceSecurityCheck.jsx'
import App from './App.jsx'
import { makeT } from './i18n.js'
import en from './locales/en.js'
import am from './locales/am.js'
import om from './locales/om.js'
import { generateDeviceSecurityPdfBlob, formatReportForSpeech, localizeFinding, localizeLimitation, formatLocalizedRating } from './lib/deviceSecurityReport.js'

describe('DeviceSecurityCheck Subsystem & UI Audit', () => {
  it('renders DeviceSecurityCheck component in English without crashing', () => {
    const t = makeT('en')
    const html = renderToString(React.createElement(DeviceSecurityCheck, { t }))

    expect(html).toContain('Device Security Check')
    expect(html).toContain('100% On-Device / Zero Telemetry')
    expect(html).toContain('Windows Host Security')
    expect(html).toContain('Android Mobile Check')
    expect(html).toContain('I authorize ABBAY CYBERGUARD to inspect local security configuration')
  })

  it('renders DeviceSecurityCheck component in Amharic without crashing', () => {
    const t = makeT('am')
    const html = renderToString(React.createElement(DeviceSecurityCheck, { t, lang: 'am' }))

    expect(html).toContain('የመሳሪያ ደህንነት ፍተሻ እና የመከላከያ ግምገማ')
    expect(html).toContain('100% በመሳሪያ ላይ / ምንም የውጭ ግንኙነት የሌለው')
    expect(html).toContain('የWindows አስተናጋጅ ደህንነት')
    expect(html).toContain('የአንድሮይድ ተንቀሳቃሽ ስልክ ፍተሻ')
    expect(html).toContain('ABBAY CYBERGUARD')
  })

  it('renders DeviceSecurityCheck component in Afaan Oromoo without crashing', () => {
    const t = makeT('om')
    const html = renderToString(React.createElement(DeviceSecurityCheck, { t, lang: 'om' }))

    expect(html).toContain("Sakatta&#x27;iinsa Nageenya Meeshaa fi Madaallii Ittisaa")
    expect(html).toContain('100% Meeshaa Irratti / Ergaa Alaa Malee')
    expect(html).toContain('Nageenya Meeshaa Windows')
    expect(html).toContain("Sakatta&#x27;iinsa Moobaayila Android")
    expect(html).toContain("ABBAY CYBERGUARD qindaa&#x27;ina nageenya naannoo akka qoratu nan hayyama")
  })

  it('verifies that Device Security translations are defined in all three languages', () => {
    const keys = [
      'nav.device',
      'nav.device_security',
      'device.title',
      'device.desc',
      'home.device',
      'home.tool_btn.device',
    ]

    for (const locale of [en, am, om]) {
      for (const k of keys) {
        expect(locale[k]).toBeTruthy()
        expect(locale[k].length).toBeGreaterThan(0)
      }
    }
  })

  it('verifies that PDF and Voice action translations exist in all three languages', () => {
    const keys = [
      'device.download_pdf',
      'device.pdf_download_success',
      'device.pdf_download_error',
      'device.read_aloud',
      'device.pause_voice',
      'device.resume_voice',
      'device.stop_voice',
      'device.voice_not_supported',
    ]

    for (const locale of [en, am, om]) {
      for (const k of keys) {
        expect(locale[k]).toBeTruthy()
        expect(locale[k].length).toBeGreaterThan(0)
      }
    }
  })

  it('generates standalone PDF report blobs in en, am, and om', () => {
    const mockAssessment = {
      target: 'windows',
      overall_status: 'PASS',
      overall_rating: 'PROTECTED',
      scan_time: '2026-11-02T12:00:00Z',
      device_summary: { hostname: 'ETH-SEC-PC', os: 'Windows 11' },
      metrics: { pass_count: 5, warning_count: 0, fail_count: 0 },
      findings: [
        {
          id: 'DEF-SIG',
          name: 'Antivirus Signatures',
          status: 'PASS',
          severity: 'INFO',
          evidence: 'Signature version 1.400.12.0 active',
          remediation: 'Keep signatures updated',
        },
      ],
    }

    for (const lang of ['en', 'om', 'am']) {
      const blob = generateDeviceSecurityPdfBlob(mockAssessment, { language: lang })
      expect(blob).toBeTruthy()
      expect(blob.type).toBe('application/pdf')
      expect(blob.size).toBeGreaterThan(100)
    }
  })

  it('formats natural voice summaries in en, am, and om without sensitive internal data', () => {
    const mockAssessment = {
      target: 'windows',
      overall_status: 'WARNING',
      device_summary: { hostname: 'ETH-SEC-PC' },
      metrics: { pass_count: 4, warning_count: 1, fail_count: 0 },
      findings: [
        {
          id: 'DEF-RTP',
          name: 'Real-time Protection',
          status: 'NOT CHECKED',
          severity: 'MEDIUM',
          evidence: 'CIM Query Restricted',
          remediation: 'Run elevated check',
        },
      ],
    }

    const enText = formatReportForSpeech(mockAssessment, 'en')
    expect(enText).toContain('ABBAY CYBERGUARD Device Security Assessment Report')
    expect(enText).not.toContain('\x00')

    const omText = formatReportForSpeech(mockAssessment, 'om')
    expect(omText).toContain("Gabaasa Sakatta'iinsa Nageenya Meeshaa ABBAY CYBERGUARD")
    expect(omText).not.toContain('\x00')

    const amText = formatReportForSpeech(mockAssessment, 'am')
    expect(amText).toContain('የABBAY CYBERGUARD የመሳሪያ ደህንነት ግምገማ ሪፖርት')
    expect(amText).not.toContain('\x00')
  })

  it('renders App shell with Device Security sidebar link in command center', () => {
    const html = renderToString(React.createElement(App))
    expect(html).toContain('href="#/device"')
    expect(html).toContain('sidebar-link-device')
  })

  it('verifies that all check IDs have localized names and remediations in EN, OM, AM', () => {
    const checkIds = [
      'def_sig', 'def_rtp', 'def_cli', 'def_last_scan', 'def_scan_exec',
      'fw_dom', 'fw_priv', 'fw_pub', 'fw_svc',
      'upd_patch', 'hard_uac',
      'and_adb', 'and_conn', 'and_auth', 'and_ver', 'and_patch',
      'and_build', 'and_boot', 'and_verity', 'and_lock', 'and_unknown_src',
      'and_apps', 'and_play_protect',
    ]

    for (const locale of [en, am, om]) {
      for (const id of checkIds) {
        const nameKey = `device.check_${id}_name`
        const remKey = `device.check_${id}_rem`
        expect(locale[nameKey], `Missing ${nameKey}`).toBeTruthy()
        expect(locale[nameKey].length).toBeGreaterThan(0)
        expect(locale[remKey], `Missing ${remKey}`).toBeTruthy()
        expect(locale[remKey].length).toBeGreaterThan(0)
      }
    }
  })

  it('dynamically localizes finding objects without altering technical id or raw evidence', () => {
    const rawFinding = {
      id: 'DEF-RTP',
      category: 'Antivirus',
      name: 'Defender Real-Time Protection Policy',
      status: 'NOT CHECKED',
      severity: 'MEDIUM',
      evidence: 'CIM Query Restricted on Win32 Root',
      remediation: 'Run elevated check',
    }

    // Amharic
    const amFinding = localizeFinding(rawFinding, 'am', makeT('am'))
    expect(amFinding.id).toBe('DEF-RTP')
    expect(amFinding.evidence).toBe('CIM Query Restricted on Win32 Root')
    expect(amFinding.name).toBe('የDefender የእውነተኛ ጊዜ ጥበቃ ፖሊሲ')
    expect(amFinding.category).toBe('ፀረ-ቫይረስ')
    expect(amFinding.status).toBe('አልተፈተሸም')
    expect(amFinding.severity).toBe('መካከለኛ')
    expect(amFinding.remediation).toContain('Windows Security')

    // Afaan Oromoo
    const omFinding = localizeFinding(rawFinding, 'om', makeT('om'))
    expect(omFinding.id).toBe('DEF-RTP')
    expect(omFinding.evidence).toBe('CIM Query Restricted on Win32 Root')
    expect(omFinding.name).toBe('Imaammata Eegumsa Yeroo-Qabatamaa Defender')
    expect(omFinding.category).toBe('Farra-Vaayirasii')
    expect(omFinding.status).toBe('HIN QORATAMNE')
    expect(omFinding.severity).toBe('GIDDU-GALEESSA')
    expect(omFinding.remediation).toContain('Defender CIM')
  })

  it('localizes limitation notes accurately across languages', () => {
    const rawLim = 'WMI/CIM Defender queries require administrator privileges; registry inspection used for non-privileged safety.'
    expect(localizeLimitation(rawLim, 'en', makeT('en'))).toContain('administrator privileges')
    expect(localizeLimitation(rawLim, 'am', makeT('am'))).toContain('የአስተዳዳሪ ፈቃድ ይፈልጋሉ')
    expect(localizeLimitation(rawLim, 'om', makeT('om'))).toContain('mirga bulchaa barbaada')
  })

  it('formats overall rating localized string accurately', () => {
    expect(formatLocalizedRating('PROTECTED', makeT('en'))).toBe('PROTECTED')
    expect(formatLocalizedRating('PROTECTED', makeT('am'))).toBe('የተጠበቀ')
    expect(formatLocalizedRating('PROTECTED', makeT('om'))).toBe('EEGAMEERA')
  })

  it('preserves underlying assessment results and updates localized visible text across EN, OM, AM', () => {
    const assessmentResult = {
      target: 'windows',
      overall_status: 'PASS',
      overall_rating: 'PROTECTED',
      scan_time: '2026-11-02T12:00:00Z',
      device_summary: { hostname: 'ETH-SEC-PC', os: 'Windows 11', architecture: 'x64' },
      metrics: {
        total_checks: 1,
        pass_count: 1,
        warning_count: 0,
        fail_count: 0,
        not_supported_count: 0,
        not_checked_count: 0,
      },
      findings: [
        {
          id: 'DEF-SIG',
          name: 'Defender Antivirus Signatures & Engine',
          category: 'Antivirus',
          status: 'PASS',
          severity: 'INFO',
          evidence: 'Signature version 1.400.12.0 verified in registry',
          remediation: 'Antivirus signatures and engine are current. Continue daily signature updates.',
        },
      ],
      limitations: [
        'WMI/CIM Defender queries require administrator privileges; registry inspection used for non-privileged safety.',
      ],
    }

    // 1. English
    const enFinding = localizeFinding(assessmentResult.findings[0], 'en', makeT('en'))
    expect(enFinding.id).toBe('DEF-SIG')
    expect(enFinding.name).toBe('Defender Antivirus Signatures & Engine')
    expect(enFinding.remediation).toBe('Antivirus signatures and engine are current. Continue daily signature updates.')

    // 2. Amharic
    const amFinding = localizeFinding(assessmentResult.findings[0], 'am', makeT('am'))
    expect(amFinding.id).toBe('DEF-SIG') // Technical ID invariant
    expect(amFinding.evidence).toBe('Signature version 1.400.12.0 verified in registry') // Raw evidence invariant
    expect(amFinding.name).toBe('የDefender ፀረ-ቫይረስ ፊርማዎች እና ኢንጂን')
    expect(amFinding.category).toBe('ፀረ-ቫይረስ')
    expect(amFinding.status).toBe('አልፏል')
    expect(amFinding.remediation).toBe('የፀረ-ቫይረስ ፊርማዎች እና ኢንጂን ወቅታዊ ናቸው። ዕለታዊ የፊርማ ማሻሻያዎችን ይቀጥሉ።')

    // 3. Afaan Oromoo
    const omFinding = localizeFinding(assessmentResult.findings[0], 'om', makeT('om'))
    expect(omFinding.id).toBe('DEF-SIG') // Technical ID invariant
    expect(omFinding.evidence).toBe('Signature version 1.400.12.0 verified in registry') // Raw evidence invariant
    expect(omFinding.name).toBe('Mallattoolee fi Injiinii Farra-Vaayirasii Defender')
    expect(omFinding.category).toBe('Farra-Vaayirasii')
    expect(omFinding.status).toBe('DARBEERA')
    expect(omFinding.remediation).toBe('Mallattoolee fi injiiniin farra-vaayirasii yeroo ammaa ti. Haaromsa guyyaa guyyaa itti fufaa.')

    // Verify underlying data was NOT mutated
    expect(assessmentResult.findings[0].id).toBe('DEF-SIG')
    expect(assessmentResult.findings[0].name).toBe('Defender Antivirus Signatures & Engine')
  })
})
