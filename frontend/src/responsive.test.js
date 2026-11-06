import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('Cyber Hero Journey & Practice Responsive Layout Suite', () => {
  const cssPath = resolve(__dirname, 'styles.css')
  const css = readFileSync(cssPath, 'utf8')

  describe('Mobile Breakpoints & Media Queries (320px, 360px, 480px, 768px)', () => {
    it('defines standard responsive breakpoints covering mobile and tablet widths', () => {
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*360px\s*\)/)
    })

    it('ensures Journey container and header adapt cleanly on tablet and mobile', () => {
      expect(css).toMatch(/\.journey-header\s*\{[^}]*flex-direction\s*:\s*column/)
      expect(css).toMatch(/\.journey-header-text\s*\{[^}]*min-width\s*:\s*0/)
      expect(css).toMatch(/\.agent-rank-card\s*\{[^}]*min-width\s*:\s*0/)
    })

    it('prevents XP tally text collision by enabling wrapping', () => {
      expect(css).toMatch(/\.xp-tally\s*\{[^}]*flex-wrap\s*:\s*wrap/)
    })
  })

  describe('Touch-Target Usability (WCAG 2.5.5 / 2.5.8)', () => {
    it('guarantees touch targets of at least 44px for primary buttons and interactive chips', () => {
      expect(css).toMatch(/\.journey-pill-btn\s*\{[^}]*min-height\s*:\s*44px/)
      expect(css).toMatch(/\.choice-card\s*\{[^}]*min-height\s*:\s*48px/)
      expect(css).toMatch(/\.btn-next-mission\s*\{[^}]*min-height\s*:\s*48px/)
      expect(css).toMatch(/\.btn-generate-mission\s*\{[^}]*min-height\s*:\s*44px/)
      expect(css).toMatch(/\.btn-toggle-evidence\s*\{[^}]*min-height\s*:\s*44px/)
    })

    it('makes mobile action buttons full-width and touch-friendly under 480px', () => {
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)[\s\S]*?\.btn-primary-action\s*\{[^}]*width\s*:\s*100%/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)[\s\S]*?\.victory-actions[\s\S]*?width\s*:\s*100%/)
    })
  })

  describe('Horizontal Overflow Prevention & Text Wrapping', () => {
    it('prevents overflow on telegram simulation handles, long URLs, and tags', () => {
      expect(css).toMatch(/\.unverified-tag\s*\{[^}]*word-break\s*:\s*break-all/)
      expect(css).toMatch(/\.target-url\s*\{[^}]*word-break\s*:\s*break-all/)
      expect(css).toMatch(/\.telegram-sender\s*\{[^}]*flex-wrap\s*:\s*wrap/)
      expect(css).toMatch(/\.telegram-bubble\s*\{[^}]*min-width\s*:\s*0/)
    })

    it('wraps victory reward badge so badges and XP do not overflow narrow screens', () => {
      expect(css).toMatch(/\.victory-reward-badge\s*\{[^}]*flex-wrap\s*:\s*wrap/)
    })

    it('ensures mission chip body can shrink with ellipsis rather than pushing horizontal track', () => {
      expect(css).toMatch(/\.mission-chip-body\s*\{[^}]*min-width\s*:\s*0/)
      expect(css).toMatch(/\.mission-chip-title\s*\{[^}]*overflow\s*:\s*hidden/)
    })

    it('enables smooth native touch scrolling on mission selector carousel', () => {
      expect(css).toMatch(/\.mission-selector-bar\s*\{[^}]*-webkit-overflow-scrolling\s*:\s*touch/)
      expect(css).toMatch(/\.mission-selector-bar\s*\{[^}]*scroll-snap-type\s*:\s*x/)
    })
  })

  describe('Multilingual Text Adaptability (EN, OM, AM)', () => {
    it('verifies that pill navigation wraps gracefully on mobile in all three languages', () => {
      expect(css).toMatch(/\.journey-pill-btn\s*\{[^}]*white-space\s*:\s*normal/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)[\s\S]*?\.journey-nav-pills\s*\{[^}]*flex-direction\s*:\s*column/)
    })

    it('confirms all localized mission titles can safely wrap with word-break on mobile', () => {
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)[\s\S]*?\.mission-banner\s*h2\s*\{[^}]*word-break\s*:\s*break-word/)
    })
  })
})
