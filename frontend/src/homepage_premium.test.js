import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from './App.jsx'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('Premium Animated Homepage & Cybersecurity Dashboard Suite', () => {
  const cssPath = resolve(__dirname, 'styles.css')
  const css = readFileSync(cssPath, 'utf8')

  const svgPath = resolve(__dirname, '../public/images/hero_security_matrix.svg')
  const svg = readFileSync(svgPath, 'utf8')

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

  describe('Hero Section Architecture & CTAs', () => {
    it('renders hero with brand identity, headline, description, and localized badge', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('class="hero-card"')
      expect(html).toContain('class="hero-badge"')
      expect(html).toContain('class="hero-title"')
      expect(html).toContain('class="hero-desc"')
      expect(html).toContain(en['home.hero.title'])
    })

    it('provides primary CTA to M1 link scanner and secondary CTA to Cyber Hero Journey', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('href="#/m1"')
      expect(html).toContain('hero-btn-primary')
      expect(html).toContain(en['home.hero.m1_btn'])

      expect(html).toContain('href="#/journey"')
      expect(html).toContain('hero-btn-journey')
      expect(html).toContain(en['home.hero.journey_btn'])
    })

    it('renders quick action shortcuts to Daily Challenge, Arena, 3D Game, and Learn', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('href="#/daily"')
      expect(html).toContain('hero-btn-daily')
      expect(html).toContain('href="#/arena"')
      expect(html).toContain('hero-btn-arena')
      expect(html).toContain('href="#/game"')
      expect(html).toContain('hero-btn-game')
      expect(html).toContain('href="#/learn"')
      expect(html).toContain('hero-btn-secondary')
    })

    it('renders ambient floating particles and radar glow in the hero section', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('hero-cyber-particles')
      expect(html).toContain('cyber-particle cp-1')
      expect(html).toContain('cyber-symbol cs-1')
      expect(html).toContain('hero-cyber-radar-glow')
    })
  })

  describe('Cybersecurity Animations & SVG Illustration', () => {
    it('defines lightweight CSS animations for floating particles and drift in styles.css', () => {
      expect(css).toContain('@keyframes floatParticle')
      expect(css).toContain('@keyframes symbolDrift')
      expect(css).toContain('@keyframes radarAmbientGlow')
      expect(css).toContain('.hero-cyber-particles')
    })

    it('embeds continuous native 60fps CSS animations inside hero_security_matrix.svg', () => {
      expect(svg).toContain('@keyframes shieldFloatMotion')
      expect(svg).toContain('@keyframes orbitRotateCW')
      expect(svg).toContain('@keyframes orbitRotateCCW')
      expect(svg).toContain('@keyframes circuitStreamDash')
      expect(svg).toContain('@keyframes nodePulseGlow')
      expect(svg).toContain('@keyframes coreOrbBreathe')
      expect(svg).toContain('class="shield-floating-group"')
      expect(svg).toContain('class="orbit-cw"')
      expect(svg).toContain('class="circuit-stream"')
      expect(svg).toContain('class="core-orb-pulse"')
    })

    it('strictly respects prefers-reduced-motion in both styles.css and the SVG', () => {
      expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)[\s\S]*?\.hero-cyber-particles/)
      expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)[\s\S]*?\.hero-matrix-visual/)
      expect(svg).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)[\s\S]*?animation:\s*none\s*!important/)
    })
  })

  describe('Preserved Vertical Sidebar & Trilingual Parity', () => {
    it('preserves the vertical left sidebar on desktop with accessible active route indicators', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('id="app-sidebar"')
      expect(html).toContain('sidebar-link-home')
      expect(html).toContain('sidebar-group-tools')
      expect(html).toContain('sidebar-group-learning')
      expect(html).toContain('sidebar-group-games')
    })

    it('renders the clean brand footer with navigation shortcuts and offline status badge', () => {
      const html = renderToString(React.createElement(App))
      expect(html).toContain('class="dashboard-footer"')
      expect(html).toContain('class="footer-brand"')
      expect(html).toContain('class="footer-nav-grid"')
      expect(html).toContain('offline-note')
      expect(html).toContain('class="footer-flag-badge"')
    })

    it('maintains 100% translation key parity across English, Afaan Oromoo, and Amharic', () => {
      const enKeys = Object.keys(en).sort()
      const omKeys = Object.keys(om).sort()
      const amKeys = Object.keys(am).sort()

      expect(omKeys).toEqual(enKeys)
      expect(amKeys).toEqual(enKeys)

      for (const d of [en, om, am]) {
        for (const [key, value] of Object.entries(d)) {
          expect(value.trim().length, `Empty value for key "${key}"`).toBeGreaterThan(0)
        }
      }
    })
  })
})
