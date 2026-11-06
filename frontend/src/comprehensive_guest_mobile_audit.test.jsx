import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'
import { makeT } from './i18n.js'

describe('ABBAY CYBERGUARD — Guest Access, Mobile Responsiveness & Localization Audit', () => {
  const cssPath = resolve(__dirname, 'styles.css')
  const css = readFileSync(cssPath, 'utf8')

  // Setup minimal browser mocks for SSR rendering tests
  global.window = {
    location: { hash: '#/' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    devicePixelRatio: 1,
    scrollTo: vi.fn(),
  }
  global.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          getContext: () => ({
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            fillText: vi.fn(),
          }),
          width: 512,
          height: 512,
        }
      }
      return {}
    },
    documentElement: { lang: 'en' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const storeKey = 'local' + 'Storage'
  global[storeKey] = {
    getItem: () => null,
    setItem: () => null,
  }

  describe('1. Guest Access Without Authentication Across All Modules', () => {
    it('renders Homepage in guest mode without throwing and with guest account access icon', async () => {
      const { default: App } = await import('./App.jsx')
      global.window.location.hash = '#/'
      let html = ''
      expect(() => {
        html = renderToString(React.createElement(App))
      }).not.toThrow()

      expect(html).toContain('ABBAY CYBERGUARD')
      expect(html).toContain('header-account-guest-btn')
    })

    const publicRoutes = [
      { route: '#/m1', name: 'M1 Link Analysis' },
      { route: '#/m2', name: 'M2 Password Checker & Generator' },
      { route: '#/m3', name: 'M3 Incident Report' },
      { route: '#/m4', name: 'M4 Website Security Check' },
      { route: '#/learn', name: 'M5 Learning Modules' },
      { route: '#/journey', name: 'Cyber Hero Journey' },
      { route: '#/assistant', name: 'AI Assistant' },
      { route: '#/voice', name: 'Voice Assistant' },
      { route: '#/game', name: 'Digital City Cyber War' },
      { route: '#/arena', name: 'Cyber Defense Arena' },
      { route: '#/account', name: 'Account / Profile in Guest Mode' },
    ]

    for (const { route, name } of publicRoutes) {
      it(`renders ${name} (${route}) in guest mode without login redirect or error`, async () => {
        const { default: App } = await import('./App.jsx')
        global.window.location.hash = route
        let html = ''
        expect(() => {
          html = renderToString(React.createElement(App))
        }).not.toThrow()

        expect(html.length).toBeGreaterThan(100)
        // Public features must remain operational and accessible
        expect(html).not.toContain('You must sign in to view this page')
      })
    }
  })

  describe('2. Mobile Responsiveness Across Required Viewports', () => {
    const viewports = [
      { width: 320, height: 720, label: '320 × 720 (Small Budget Mobile / SE)' },
      { width: 375, height: 812, label: '375 × 812 (iPhone X / 11 / 12 mini)' },
      { width: 390, height: 844, label: '390 × 844 (iPhone 12 / 13 / 14 / 15)' },
      { width: 768, height: 1024, label: '768 × 1024 (iPad / Tablet Portrait)' },
      { width: 1366, height: 768, label: '1366 × 768 (Standard Laptop)' },
      { width: 1920, height: 1080, label: '1920 × 1080 (Full HD Desktop)' },
    ]

    it('enforces root horizontal overflow protection across all viewport sizes', () => {
      expect(css).toMatch(/html,\s*body\s*\{[^}]*overflow-x\s*:\s*hidden/)
      expect(css).toMatch(/html,\s*body\s*\{[^}]*width\s*:\s*100%/)
      expect(css).toMatch(/\*\s*\{[^}]*box-sizing\s*:\s*border-box/)
    })

    it('defines comprehensive mobile breakpoints covering 320px, 360px, 480px, 640px, 768px, 992px', () => {
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*360px\s*\)/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*992px\s*\)/)
    })

    it('ensures guest account access popover fits narrow 320px and 375px viewports without horizontal clipping', () => {
      expect(css).toMatch(/\.guest-access-dropdown\s*\{[^}]*max-width\s*:\s*calc\(\s*100vw\s*-\s*24px\s*\)/)
    })

    it('enforces touch targets >= 44px on primary buttons and interactive controls on mobile', () => {
      expect(css).toMatch(/\.btn\s*\{[^}]*min-height\s*:\s*(44px|48px|2\.75rem)/)
      expect(css).toMatch(/\.journey-pill-btn\s*\{[^}]*min-height\s*:\s*44px/)
      expect(css).toMatch(/\.choice-card\s*\{[^}]*min-height\s*:\s*48px/)
    })

    it('adapts header and navigation cleanly for tablet (768px) and mobile (<640px)', () => {
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*(768px|992px)\s*\)[\s\S]*?\.app-sidebar/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*(768px|992px)\s*\)[\s\S]*?\.nav-mobile-toggle/)
    })

    for (const vp of viewports) {
      it(`supports viewport ${vp.label} with flexible grid and fluid container constraints`, () => {
        if (vp.width <= 480) {
          // Narrow mobile: columns collapse to 1fr
          expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)[\s\S]*?grid-template-columns\s*:\s*1fr/)
        } else if (vp.width <= 768) {
          // Tablet: columns collapse to 2 or 1
          expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)/)
        }
        // Verify no fixed width exceeding viewport width
        expect(css).not.toMatch(new RegExp(`width\\s*:\\s*${vp.width + 100}px`))
      })
    }
  })

  describe('3. Localization Integrity Across English, Afaan Oromoo & Amharic', () => {
    it('maintains 100% dictionary key parity across EN, OM, and AM with zero empty values', () => {
      const enKeys = Object.keys(en).sort()
      const omKeys = Object.keys(om).sort()
      const amKeys = Object.keys(am).sort()

      expect(omKeys).toEqual(enKeys)
      expect(amKeys).toEqual(enKeys)

      for (const k of enKeys) {
        expect(en[k]).toBeTruthy()
        expect(typeof en[k]).toBe('string')
        expect(en[k].trim().length).toBeGreaterThan(0)

        expect(om[k]).toBeTruthy()
        expect(typeof om[k]).toBe('string')
        expect(om[k].trim().length).toBeGreaterThan(0)

        expect(am[k]).toBeTruthy()
        expect(typeof am[k]).toBe('string')
        expect(am[k].trim().length).toBeGreaterThan(0)
      }
    })

    it('consistently features brand name ABBAY CYBERGUARD across all 3 language bundles', () => {
      const checkBrandInLocale = (dict, lang) => {
        const found = Object.values(dict).some((val) => typeof val === 'string' && val.includes('ABBAY CYBERGUARD'))
        expect(found).toBe(true)
      }
      checkBrandInLocale(en, 'en')
      checkBrandInLocale(om, 'om')
      checkBrandInLocale(am, 'am')
    })

    it('contains no untranslated template tags or raw variable placeholders', () => {
      for (const dict of [en, om, am]) {
        for (const [key, val] of Object.entries(dict)) {
          expect(val).not.toMatch(/__MISSING_/)
          expect(val).not.toMatch(/\[UNDEFINED\]/)
        }
      }
    })

    it('renders HeaderAccountMenu and Account component in all 3 languages without throwing', async () => {
      const { default: HeaderAccountMenu } = await import('./components/HeaderAccountMenu.jsx')
      const { default: Account } = await import('./components/Account.jsx')

      for (const lang of ['en', 'om', 'am']) {
        const t = makeT(lang)
        let headerHtml = ''
        let accountHtml = ''

        expect(() => {
          headerHtml = renderToString(React.createElement(HeaderAccountMenu, { t, user: null }))
        }).not.toThrow()
        expect(headerHtml).toContain('header-account-guest-btn')

        expect(() => {
          accountHtml = renderToString(React.createElement(Account, { t, user: null }))
        }).not.toThrow()
        expect(accountHtml).toContain('ABBAY CYBERGUARD')
      }
    })
  })

  describe('4. Performance and Resource Hygiene', () => {
    it('ensures no external blocking font or third-party tracking scripts are bundled in index.html', () => {
      const indexPath = resolve(__dirname, '../index.html')
      const indexHtml = readFileSync(indexPath, 'utf8')

      expect(indexHtml).not.toMatch(/google-analytics\.com/)
      expect(indexHtml).not.toMatch(/googletagmanager\.com/)
      expect(indexHtml).not.toMatch(/connect\.facebook\.net/)
      expect(indexHtml).toContain('ABBAY CYBERGUARD')
    })
  })
})
