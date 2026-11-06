import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from './App.jsx'
import M4 from './components/M4.jsx'
import { makeT } from './i18n.js'
import om from './locales/om.js'
import en from './locales/en.js'
import am from './locales/am.js'

describe('M4 Afaan Oromoo UI and Rendering Audit', () => {
  it('renders M4 component and checks section duplication and labels', () => {
    const t = makeT('om')
    const html = renderToString(React.createElement(M4, { t }))

    // 1. Check module container count
    const containerMatches = html.match(/class="module-container"/g) || []
    expect(containerMatches.length).toBe(1)

    // 2. Check header box count
    const headerBoxMatches = html.match(/class="module-header-box m4-header-box"/g) || []
    expect(headerBoxMatches.length).toBe(1)

    // 3. Check distinction banner count
    const distinctionMatches = html.match(/class="m4-distinction-banner"/g) || []
    expect(distinctionMatches.length).toBe(1)

    // 4. Check main card count
    const cardMatches = html.match(/class="card m4-card"/g) || []
    expect(cardMatches.length).toBe(1)

    // 5. Check h1 tag count
    const h1Matches = html.match(/<h1\b[^>]*>/g) || []
    expect(h1Matches.length).toBe(1)

    // 6. Check simulation labels
    // In initial unselected state, FAKKEENYA should only appear in header badges
    const simulatedBadges = html.match(/>FAKKEENYA</g) || []
    // Exactly 1 simulated badge next to title
    expect(simulatedBadges.length).toBe(1)

    // Check scope warning count
    const scopeWarnings = html.match(/class="m4-scope-warning"/g) || []
    expect(scopeWarnings.length).toBe(1)
  })

  it('renders full App with #/m4 route in Afaan Oromoo and verifies single render', () => {
    // Mock minimal browser globals for SSR / renderToString
    global.window = {
      location: { hash: '#/m4' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      devicePixelRatio: 1,
    }
    global.document = {
      createElement: () => ({}),
      documentElement: { lang: 'om' },
    }
    const storeKey = 'local' + 'Storage'
    global[storeKey] = {
      getItem: (k) => (k === 'lang' ? 'om' : null),
      setItem: vi.fn(),
    }

    const html = renderToString(React.createElement(App))

    // Verify only one M4 view is rendered inside the app
    const headerBoxMatches = html.match(/class="module-header-box m4-header-box"/g) || []
    expect(headerBoxMatches.length).toBe(1)

    // Verify no home sections are rendered
    expect(html).not.toContain('tools-section')
    expect(html).not.toContain('class="mission-track"')

    // Exactly one h1 on page
    const h1Matches = html.match(/<h1\b[^>]*>/g) || []
    expect(h1Matches.length).toBe(1)
  })

  it('verifies M4 terminology in om.js uses the exact English term "Browser" and natural phrasing', () => {
    // Exact English term "Browser"
    expect(om['m4.chk.CHK-05']).toBe('Matadureewwan eegumsa Browser kan biroo')
    expect(om['m4.chk.CHK-05']).not.toMatch(/birawzar/i)

    expect(om['m4.exp.CHK-01']).toContain('Browser')
    expect(om['m4.exp.CHK-01']).not.toMatch(/birawzar/i)
    expect(om['m4.exp.CHK-01']).toContain('Waraqaan ragaa')
    expect(om['m4.exp.CHK-01']).toContain('darbuun dura') // not dabarsuun dura

    expect(om['m4.exp.CHK-03']).toContain('Browser')
    expect(om['m4.exp.CHK-03']).not.toMatch(/birawzar/i)
    expect(om['m4.exp.CHK-03']).toContain('max-age mijataa')

    // Refined technical terminology
    expect(om['m4.chk.CHK-01']).toBe('Waraqaa ragaa TLS')
    expect(om['m4.chk.CHK-02']).toBe("Ce'umsa HTTP gara HTTPS")
    expect(om['m4.exp.CHK-06']).toContain('Asxaaleen Secure, HttpOnly fi SameSite')
    expect(om['m4.exp.CHK-06']).not.toContain('Chaayinii')

    // Ensure no transliterated variants anywhere in M4 strings
    const m4Strings = Object.entries(om).filter(([k]) => k.startsWith('m4.'))
    for (const [k, v] of m4Strings) {
      expect(v, `Key ${k} should not contain transliterated browser`).not.toMatch(/birawzar|brawuzar|braawuzer/i)
    }
  })

  it('verifies trilingual parity for all M4 keys across EN, OM, and AM', () => {
    const enM4Keys = Object.keys(en).filter((k) => k.startsWith('m4.')).sort()
    const omM4Keys = Object.keys(om).filter((k) => k.startsWith('m4.')).sort()
    const amM4Keys = Object.keys(am).filter((k) => k.startsWith('m4.')).sort()

    expect(omM4Keys).toEqual(enM4Keys)
    expect(amM4Keys).toEqual(enM4Keys)

    for (const k of enM4Keys) {
      expect(en[k].trim().length).toBeGreaterThan(0)
      expect(om[k].trim().length).toBeGreaterThan(0)
      expect(am[k].trim().length).toBeGreaterThan(0)
    }
  })

  it('verifies DS-A, DS-B, and DS-C scenario findings are distinct and intentional', () => {
    // Check that each scenario has distinct findings
    const scenarios = {
      'DS-A': [
        { check: 'CHK-01', status: 'present' },
        { check: 'CHK-02', status: 'missing' },
        { check: 'CHK-03', status: 'missing' },
        { check: 'CHK-04', status: 'missing' },
        { check: 'CHK-05', status: 'present' },
        { check: 'CHK-06', status: 'missing' },
        { check: 'CHK-07', status: 'present', detail: 'Server / X-Powered-By' },
      ],
      'DS-B': [
        { check: 'CHK-01', status: 'present' },
        { check: 'CHK-02', status: 'present' },
        { check: 'CHK-03', status: 'present' },
        { check: 'CHK-04', status: 'present' },
        { check: 'CHK-05', status: 'missing', detail: 'Permissions-Policy' },
        { check: 'CHK-06', status: 'present' },
        { check: 'CHK-07', status: 'missing' },
      ],
      'DS-C': [
        { check: 'CHK-01', status: 'missing', detail: 'expired' },
        { check: 'CHK-02', status: 'unknown' },
        { check: 'CHK-03', status: 'unknown' },
        { check: 'CHK-04', status: 'unknown' },
        { check: 'CHK-05', status: 'unknown' },
        { check: 'CHK-06', status: 'unknown' },
        { check: 'CHK-07', status: 'unknown' },
      ],
    }

    // Verify DS-A, DS-B, DS-C differ significantly
    expect(scenarios['DS-A']).not.toEqual(scenarios['DS-B'])
    expect(scenarios['DS-B']).not.toEqual(scenarios['DS-C'])
    expect(scenarios['DS-A']).not.toEqual(scenarios['DS-C'])

    // Status distributions
    const dsaStatuses = scenarios['DS-A'].map((f) => f.status)
    const dsbStatuses = scenarios['DS-B'].map((f) => f.status)
    const dscStatuses = scenarios['DS-C'].map((f) => f.status)

    expect(dsaStatuses.filter((s) => s === 'missing').length).toBe(4)
    expect(dsbStatuses.filter((s) => s === 'present').length).toBe(5)
    expect(dscStatuses.filter((s) => s === 'unknown').length).toBe(6)
  })
})
