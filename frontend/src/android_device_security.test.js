import { describe, expect, it, vi } from 'vitest'
import { inspectAndroidBrowserEnvironment, isAndroidBrowser } from './lib/androidBrowserAssessment.js'
import {
  createDeviceSecurityAlert,
  evaluateLocalServiceHealth,
  requestDeviceSecurityNotificationPermission,
} from './lib/deviceSecurityNotifications.js'
import { createStructuralDeviceSecurityPdf, generateDeviceSecurityPdfBlob } from './lib/deviceSecurityReport.js'
import en from './locales/en.js'
import am from './locales/am.js'
import om from './locales/om.js'

describe('Android browser-only device assessment', () => {
  it('detects Android from browser platform metadata or user agent', () => {
    expect(isAndroidBrowser({ userAgentData: { platform: 'Android' }, userAgent: '' })).toBe(true)
    expect(isAndroidBrowser({ userAgent: 'Mozilla/5.0 (Linux; Android 15)' })).toBe(true)
    expect(isAndroidBrowser({ userAgentData: { platform: 'Windows' }, userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })).toBe(false)
  })

  it('reports only browser-visible properties and never requests permissions or contacts a backend', async () => {
    const query = vi.fn().mockImplementation(async ({ name }) => ({ state: name === 'camera' ? 'denied' : 'prompt' }))
    const fetchBefore = globalThis.fetch
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    let report
    try {
      report = await inspectAndroidBrowserEnvironment({
        windowObject: { isSecureContext: true, location: { protocol: 'https:' }, Notification: { permission: 'default' } },
        navigatorObject: {
          permissions: { query },
          crypto: { subtle: {} },
          serviceWorker: {},
        },
        timestamp: new Date('2026-11-07T00:00:00Z'),
      })
    } finally {
      globalThis.fetch = fetchBefore
    }

    expect(report.target).toBe('android')
    expect(report.overall_status).toBe('BROWSER_ONLY')
    expect(report.findings.find((item) => item.id === 'ANDROID-HTTPS').status).toBe('PASS')
    expect(report.findings.find((item) => item.id === 'ANDROID-SECURE-CONTEXT').status).toBe('PASS')
    expect(report.findings.find((item) => item.id === 'ANDROID-PERMISSION-CAMERA').evidence).toBe('denied')
    expect(query).toHaveBeenCalledTimes(3)
    expect(query.mock.calls.every(([descriptor]) => descriptor.name !== 'notifications')).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(report).not.toHaveProperty('hostname')
    expect(report).not.toHaveProperty('userAgent')
  })

  it('marks insecure transport, unsupported browser APIs, and rejected permission queries accurately', async () => {
    const report = await inspectAndroidBrowserEnvironment({
      windowObject: { isSecureContext: false, location: { protocol: 'http:' } },
      navigatorObject: {
        permissions: { query: vi.fn().mockRejectedValue(new Error('unsupported permission descriptor')) },
      },
    })

    expect(report.findings.find((item) => item.id === 'ANDROID-HTTPS').status).toBe('WARNING')
    expect(report.findings.find((item) => item.id === 'ANDROID-CRYPTO').status).toBe('NOT SUPPORTED')
    expect(report.findings.find((item) => item.id === 'ANDROID-NOTIFICATIONS').status).toBe('NOT SUPPORTED')
    expect(report.findings.find((item) => item.id === 'ANDROID-PERMISSION-GEOLOCATION').status).toBe('NOT CHECKED')
    expect(report.metrics.total_checks).toBe(report.findings.length)
  })

  it('handles browsers without a Permissions API without throwing', async () => {
    const report = await inspectAndroidBrowserEnvironment({
      windowObject: { isSecureContext: true, location: { protocol: 'https:' } },
      navigatorObject: {},
    })
    expect(report.findings.filter((item) => item.id.startsWith('ANDROID-PERMISSION-')).every((item) => (
      item.status === 'NOT SUPPORTED'
    ))).toBe(true)
  })

  it('exports the browser-only assessment through the existing PDF generator', async () => {
    const report = await inspectAndroidBrowserEnvironment({
      windowObject: { isSecureContext: true, location: { protocol: 'https:' } },
      navigatorObject: {},
    })
    for (const language of ['en', 'am', 'om']) {
      const pdf = generateDeviceSecurityPdfBlob(report, { language })
      expect(pdf.type).toBe('application/pdf')
      expect(pdf.size).toBeGreaterThan(0)

      const structuralPdf = createStructuralDeviceSecurityPdf(report, language)
      const pdfText = new TextDecoder().decode(await structuralPdf.arrayBuffer())
      const translations = { en, am, om }[language]
      expect(pdfText).toContain(translations['device.status_browser_only'])
      expect(pdfText).toContain(translations['device.rating_browser_only'])
      expect(pdfText).toContain(translations['device.pdf_metric_total'])
    }
  })

  it('requests notification permission only through an explicit call and respects a denial', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied')
    const result = await requestDeviceSecurityNotificationPermission({ requestPermission, permission: 'denied' })
    expect(requestPermission).toHaveBeenCalledOnce()
    expect(result).toEqual({ permission: 'denied', enabled: false, error: 'denied' })
  })

  it('enables notifications only after permission is granted and handles unsupported APIs', async () => {
    const granted = await requestDeviceSecurityNotificationPermission({
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
    const unsupported = await requestDeviceSecurityNotificationPermission(null)
    expect(granted).toEqual({ permission: 'granted', enabled: true, error: null })
    expect(unsupported).toEqual({ permission: 'unsupported', enabled: false, error: 'unsupported' })
  })

  it('stores only generic alert metadata, never assessment evidence or device details', () => {
    const alert = createDeviceSecurityAlert('assessment_critical', 'CRITICAL', new Date('2026-11-07T00:00:00Z'))
    expect(alert).toEqual({
      id: 'assessment_critical-1794009600000',
      kind: 'assessment_critical',
      severity: 'CRITICAL',
      timestamp: '2026-11-07T00:00:00.000Z',
      dismissed: false,
    })
    expect(Object.keys(alert).sort()).toEqual(['dismissed', 'id', 'kind', 'severity', 'timestamp'])
  })

  it('alerts on outage, repeated failures, and recovery without repeating each poll', () => {
    expect(evaluateLocalServiceHealth(null, 0, false)).toEqual({
      state: 'unavailable',
      consecutiveFailures: 1,
      alerts: ['service_unavailable'],
    })
    expect(evaluateLocalServiceHealth('unavailable', 1, false).alerts).toEqual([])
    expect(evaluateLocalServiceHealth('unavailable', 2, false)).toEqual({
      state: 'unavailable',
      consecutiveFailures: 3,
      alerts: ['service_repeated_failures'],
    })
    expect(evaluateLocalServiceHealth('unavailable', 3, true)).toEqual({
      state: 'available',
      consecutiveFailures: 0,
      alerts: ['service_recovered'],
    })
  })

  it('provides all Android and notification UI copy in English, Afaan Oromoo, and Amharic', () => {
    const requiredKeys = [
      'device.android_detected',
      'device.android_check_failed',
      'device.android_permission_state_label',
      'device.check_android_https_name',
      'device.check_android_secure_context_rem',
      'device.check_android_notifications_name',
      'device.check_android_permission_camera_rem',
      'device.notification_scope',
      'device.notification_service_unavailable',
      'device.notification_service_recovered',
      'device.notifications_disabled',
      'device.service_health_waiting',
    ]
    for (const locale of [en, am, om]) {
      for (const key of requiredKeys) {
        expect(locale[key], `${key} should be translated`).toBeTruthy()
        expect(locale[key]).not.toBe(key)
      }
    }
  })

  it('localizes every Android finding name and remediation in all supported languages', async () => {
    const report = await inspectAndroidBrowserEnvironment({
      windowObject: { isSecureContext: true, location: { protocol: 'https:' } },
      navigatorObject: {},
    })
    for (const finding of report.findings) {
      const id = finding.id.toLowerCase().replace(/[^a-z0-9]/g, '_')
      for (const locale of [en, am, om]) {
        expect(locale[`device.check_${id}_name`], finding.id).toBeTruthy()
        expect(locale[`device.check_${id}_rem`], finding.id).toBeTruthy()
      }
    }
  })
})
