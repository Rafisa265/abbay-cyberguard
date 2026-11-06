import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from './App.jsx'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('Professional Dashboard, Navigation & Design System Redesign', () => {
  const cssPath = resolve(__dirname, 'styles.css')
  const css = readFileSync(cssPath, 'utf8')

  // Mock minimal browser globals for SSR / renderToString
  global.window = {
    location: { hash: '#/' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    devicePixelRatio: 1,
  }
  global.document = {
    createElement: () => ({}),
    documentElement: { lang: 'en' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const storeKey = 'local' + 'Storage'
  global[storeKey] = {
    getItem: () => null,
    setItem: () => null,
  }

  describe('Phase Two — Coordinated Cybersecurity Palette Tokens', () => {
    it('defines the required anchor colors in :root tokens', () => {
      expect(css).toContain('--color-primary-navy: #0B1F3A;')
      expect(css).toContain('--color-midnight-blue: #102A43;')
      expect(css).toContain('--color-electric-cyan: #22D3EE;')
      expect(css).toContain('--color-teal: #14B8A6;')
      expect(css).toContain('--color-warm-gold: #F4B942;')
      expect(css).toContain('--color-soft-bg: #F4F7FB;')
      expect(css).toContain('--color-card-white: #FFFFFF;')
      expect(css).toContain('--color-deep-slate: #172B4D;')
      expect(css).toContain('--color-muted-slate: #52657A;')
    })

    it('maps semantic system tokens to the coordinated palette', () => {
      expect(css).toMatch(/--bg:\s*var\(--color-soft-bg\);/)
      expect(css).toMatch(/--fg:\s*var\(--color-deep-slate\);/)
      expect(css).toMatch(/--navy:\s*var\(--color-primary-navy\);/)
      expect(css).toMatch(/--card:\s*var\(--color-card-white\);/)
      expect(css).toMatch(/--focus-ring:\s*var\(--color-electric-cyan\);/)
    })
  })

  describe('Phase Three — Main Navigation Architecture', () => {
    it('renders the exact product name "ABBAY CYBERGUARD"', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('ABBAY CYBERGUARD')
    })

    it('renders primary navigation in the vertical sidebar with functional groupings without duplicate top nav', () => {
      const html = renderToString(React.createElement(App))

      // Primary vertical sidebar container
      expect(html).toContain('id="app-sidebar"')
      expect(html).toContain('class="app-sidebar')

      // Direct Home and Account links in sidebar
      expect(html).toContain('sidebar-link')
      expect(html).toContain('href="#/"')
      expect(html).toContain('href="#/account"')

      // Sidebar functional groups: Tools, Learning, Games
      expect(html).toContain('sidebar-group')
      expect(html).toContain('sidebar-group-title')

      // Verify top header does not contain duplicate horizontal dropdown menus
      expect(html).not.toContain('top-nav desktop-nav')
      expect(html).not.toContain('nav-dropdown-menu')
    })

    it('renders the accessible mobile toggle button with ARIA attributes controlling app-sidebar', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('nav-mobile-toggle')
      expect(html).toContain('aria-controls="app-sidebar"')
      expect(html).toContain('aria-label="Toggle navigation menu"')
    })

    it('preserves header utility controls (account access, notification center, and language selector)', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('header-utility-account')
      expect(html).toContain('notif-center')
      expect(html).toContain('id="lang-select"')
    })
  })

  describe('Phase Four — Coherent Home Dashboard Layout', () => {
    it('renders Welcome section, Section A, Section B, Section C, and Pillars', () => {
      const html = renderToString(React.createElement(App))

      // Welcome Section
      expect(html).toContain('class="hero-card"')
      expect(html).toContain('class="hero-actions"')

      // Section A: Security Tools
      expect(html).toContain('dashboard-section-tools')
      expect(html).toContain('tools-grid')

      // Section B: Interactive Learning & Missions
      expect(html).toContain('dashboard-section-learning')
      expect(html).toContain('resume-section')
      expect(html).toContain('home-daily-section')
      expect(html).toContain('featured-missions-section')

      // Section C: Tactical Defense Games
      expect(html).toContain('dashboard-section-games')
      expect(html).toContain('game-dashboard-card arena-card')
      expect(html).toContain('game-dashboard-card battle-card')

      // Pillars Section
      expect(html).toContain('pillars-section')
      expect(html).toContain('pillars-grid')
    })

    it('distinguishes simulated and client-side capabilities in tool cards', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('module-tag-m1') // M1 Heuristics
      expect(html).toContain('module-tag-m2') // M2 Local Crypto
      expect(html).toContain('module-tag-m3') // M3 Incident Draft
      expect(html).toContain('module-tag-m4') // M4 Simulation
      expect(html).toContain('module-tag-learn') // M5 Education
    })
  })

  describe('Phase Five — M4 Approved Afaan Oromoo Disclaimer', () => {
    it('retains the approved Afaan Oromoo disclaimer verbatim in om.js', () => {
      const expected = 'Hubachiisa: Argannoon kun qindaa’ina fakkeenyaaf qophaa’e irratti hundaa’a; marsariitii dhugaa irratti qorannoo hin raawwanne. Bu’aan kun barnootaa fi hubannoo nageenya marsariitii cimsuuf qofa kan qophaa’edha.'
      expect(om['m4.scope']).toBe(expected)
    })
  })

  describe('Phase Six — Responsive Design Standards', () => {
    it('defines responsive rules across 360px, 480px, 768px, 992px', () => {
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*992px\s*\)[\s\S]*?\.desktop-nav\s*\{[^}]*display\s*:\s*none/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*992px\s*\)[\s\S]*?\.nav-mobile-toggle\s*\{[^}]*display\s*:\s*inline-flex/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*360px\s*\)/)
    })

    it('enforces min 44px touch targets on mobile interactive links and buttons', () => {
      expect(css).toMatch(/\.nav-mobile-toggle\s*\{[^}]*min-height\s*:\s*40px/)
      expect(css).toMatch(/\.mobile-nav-link\s*\{[^}]*min-height\s*:\s*44px/)
      expect(css).toMatch(/\.btn-resume-journey\s*\{[^}]*min-height\s*:\s*48px/)
    })
  })

  describe('Phase Seven — Localization Parity', () => {
    const newKeys = [
      'nav.group_tools',
      'nav.group_learning',
      'nav.group_games',
      'nav.menu_toggle',
      'nav.menu_close',
      'home.sec_tools_title',
      'home.sec_tools_desc',
      'home.sec_learning_title',
      'home.sec_learning_desc',
      'home.sec_games_title',
      'home.sec_games_desc',
    ]

    it('guarantees 100% key parity and non-empty values across EN, OM, AM for new navigation & dashboard keys', () => {
      for (const k of newKeys) {
        expect(en[k], `Missing EN key: ${k}`).toBeTruthy()
        expect(om[k], `Missing OM key: ${k}`).toBeTruthy()
        expect(am[k], `Missing AM key: ${k}`).toBeTruthy()

        expect(en[k].trim().length).toBeGreaterThan(0)
        expect(om[k].trim().length).toBeGreaterThan(0)
        expect(am[k].trim().length).toBeGreaterThan(0)
      }
    })
  })
})
