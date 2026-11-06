import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'
import { makeT } from './i18n.js'
import { getRank } from './lib/journey.js'

describe('Homepage Polish Suite (Phase 1)', () => {
  const cssPath = resolve(__dirname, 'styles.css')
  const css = readFileSync(cssPath, 'utf8')

  describe('Value Proposition & Pillar Content', () => {
    it('defines 4 core Ethiopian value pillars in all 3 languages', () => {
      const pillarKeys = [
        'home.pillars.title',
        'home.pillars.desc',
        'home.pillars.p1_title',
        'home.pillars.p1_desc',
        'home.pillars.p2_title',
        'home.pillars.p2_desc',
        'home.pillars.p3_title',
        'home.pillars.p3_desc',
        'home.pillars.p4_title',
        'home.pillars.p4_desc',
      ]
      for (const d of [en, om, am]) {
        for (const k of pillarKeys) {
          expect(d[k]).toBeTruthy()
          expect(d[k].trim().length).toBeGreaterThan(0)
        }
      }
    })

    it('prohibits false safety guarantee language in English value pillars', () => {
      const pillarText = [
        en['home.pillars.p1_desc'],
        en['home.pillars.p2_desc'],
        en['home.pillars.p3_desc'],
        en['home.pillars.p4_desc'],
      ].join(' ').toLowerCase()
      expect(pillarText).not.toMatch(/\b(guarantees security|100% safe|certified|bulletproof)\b/)
    })
  })

  describe('Returning User Progress & Journey Starter Banners', () => {
    it('defines resume and starter keys across EN, OM, AM', () => {
      const resumeKeys = [
        'home.resume.title',
        'home.resume.subtitle',
        'home.resume.btn',
        'home.resume.rank_label',
        'home.resume.xp_label',
        'home.resume.completed_label',
        'home.resume.missions_count',
        'home.resume.new_title',
        'home.resume.new_desc',
        'home.resume.new_btn',
      ]
      for (const d of [en, om, am]) {
        for (const k of resumeKeys) {
          expect(d[k]).toBeTruthy()
          expect(d[k].trim().length).toBeGreaterThan(0)
        }
      }
    })

    it('calculates accurate rank icons and titles for returning users', () => {
      expect(getRank(0).key).toBe('cadet')
      expect(getRank(100).key).toBe('defender')
      expect(getRank(250).key).toBe('guardian')
      expect(getRank(500).key).toBe('champion')

      const tEn = makeT('en')
      const tOm = makeT('om')
      const tAm = makeT('am')

      for (const rankKey of ['cadet', 'defender', 'guardian', 'champion']) {
        expect(tEn(`journey.rank.${rankKey}`)).toBeTruthy()
        expect(tOm(`journey.rank.${rankKey}`)).toBeTruthy()
        expect(tAm(`journey.rank.${rankKey}`)).toBeTruthy()
      }
    })
  })

  describe('Featured Threat Missions & Practice Previews', () => {
    it('provides localized badges and educational hooks for all core missions and practice lab', () => {
      const missionKeys = [
        'home.missions.title',
        'home.missions.desc',
        'home.missions.m1_badge',
        'home.missions.m1_hook',
        'home.missions.m2_badge',
        'home.missions.m2_hook',
        'home.missions.m3_badge',
        'home.missions.m3_hook',
        'home.missions.m4_badge',
        'home.missions.m4_hook',
        'home.missions.practice_badge',
        'home.missions.practice_hook',
        'home.missions.play_btn',
        'home.missions.practice_btn',
      ]
      for (const d of [en, om, am]) {
        for (const k of missionKeys) {
          expect(d[k]).toBeTruthy()
          expect(d[k].trim().length).toBeGreaterThan(0)
        }
      }
    })

    it('provides action-oriented tool button labels for all modules in EN, OM, AM', () => {
      const toolKeys = [
        'home.tool_btn.m1',
        'home.tool_btn.m2',
        'home.tool_btn.m3',
        'home.tool_btn.m4',
        'home.tool_btn.learn',
        'home.tool_btn.journey',
      ]
      for (const d of [en, om, am]) {
        for (const k of toolKeys) {
          expect(d[k]).toBeTruthy()
          expect(d[k].trim().length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('Responsive Layout & Touch Usability CSS Verification', () => {
    it('ensures resume card flexes column on tablet and mobile widths', () => {
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*?\.resume-card\s*\{[^}]*flex-direction\s*:\s*column/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*?\.btn-resume-journey\s*\{[^}]*width\s*:\s*100%/)
    })

    it('adapts pillars grid from multi-column to 2 columns on tablet and 1 column on mobile', () => {
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*?\.pillars-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*2\s*,\s*1fr\s*\)/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)[\s\S]*?\.pillars-grid\s*\{[^}]*grid-template-columns\s*:\s*1fr/)
    })

    it('enforces min 44px touch targets on resume and preview CTA buttons', () => {
      expect(css).toMatch(/\.btn-resume-journey\s*\{[^}]*min-height\s*:\s*48px/)
      expect(css).toMatch(/\.mission-preview-footer\s*\.btn\s*\{[^}]*min-height\s*:\s*44px/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)[\s\S]*?\.hero-actions\s*\.btn\s*\{[^}]*min-height\s*:\s*44px/)
    })

    it('prevents horizontal overflow with narrow screen rules at 360px', () => {
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*360px\s*\)[\s\S]*?\.resume-card\s*\{[^}]*padding\s*:\s*16px\s*12px/)
      expect(css).toMatch(/@media\s*\(\s*max-width\s*:\s*360px\s*\)[\s\S]*?\.stat-pill\s*\{[^}]*font-size\s*:\s*0\.76rem/)
    })
  })
})
