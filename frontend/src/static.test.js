import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]))
const src = files('src').filter((f) => /\.(js|jsx)$/.test(f) && !f.endsWith('.test.js'))

describe('static privacy/safety checks (SR-09, FR-13, FR-26)', () => {
  it('only M4 uses the network, and only to the local /api path', () => {
    for (const f of src) {
      const s = readFileSync(f, 'utf8')
      if (f.endsWith('M4.jsx')) { expect(s).toMatch(/\/api\/v1\/m4\//); expect(s).not.toMatch(/https?:\/\//) }
      else expect(s).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b\s*\(?/)
    }
  })
  it('Math.random is never used; no raw HTML injection; no live-mode code', () => {
    for (const f of src) {
      const s = readFileSync(f, 'utf8')
      expect(s).not.toMatch(/Math\.random\(/); expect(s).not.toMatch(/dangerouslySetInnerHTML|innerHTML|eval\(/); expect(s).not.toMatch(/m4\/live/i)
    }
  })
  it('storage use is limited to language, journey progress, and generic device alert metadata (SR-09, FR-26)', () => {
    for (const f of src) {
      const s = readFileSync(f, 'utf8')
      if (!f.endsWith('i18n.js') && !f.endsWith('journey.js') && !f.endsWith('DeviceSecurityCheck.jsx')) {
        expect(s).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/)
      }
    }
    const deviceSecurityCode = readFileSync('src/components/DeviceSecurityCheck.jsx', 'utf8')
    expect(deviceSecurityCode).toContain("const ALERT_HISTORY_STORAGE_KEY = 'abbay-device-security-alerts-v1'")
    expect(deviceSecurityCode).toContain("const ALERT_SETTINGS_STORAGE_KEY = 'abbay-device-security-notifications-v1'")
    const storageKeys = [...deviceSecurityCode.matchAll(/localStorage\.(?:getItem|setItem)\((\w+)/g)]
      .map((match) => match[1])
    expect(storageKeys.length).toBeGreaterThan(0)
    expect(storageKeys.every((key) => (
      key === 'ALERT_HISTORY_STORAGE_KEY' || key === 'ALERT_SETTINGS_STORAGE_KEY'
    ))).toBe(true)
    expect(deviceSecurityCode).toContain('createDeviceSecurityAlert')
    expect(readFileSync('src/i18n.js', 'utf8').match(/localStorage\.\w+\('([^']+)'/g).every((m) => m.includes("'lang'"))).toBe(true)
    const journeyCode = readFileSync('src/lib/journey.js', 'utf8')
    expect(journeyCode).toMatch(/JOURNEY_STORAGE_KEY\s*=\s*'cybershield_journey_progress'/)
    // Confirm no sensitive fields are saved in journey progress
    expect(journeyCode).not.toMatch(/password|credential|reportText|secret|token|identity/i)
  })
})
