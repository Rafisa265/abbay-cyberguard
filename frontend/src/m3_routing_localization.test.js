import { describe, it, expect } from 'vitest'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'
import {
  OFFICIAL_REPORTING_DIRECTORY,
  filterReportingDirectory,
} from './lib/m3ReportingDirectory.js'
import { TYPES, METHODS, LOSSES } from './lib/m3.js'

describe('ABBAY CYBERGUARD — M3 Localization, Routing & Directory Invariants', () => {
  const LOCALES = [
    { lang: 'en', dict: en },
    { lang: 'om', dict: om },
    { lang: 'am', dict: am },
  ]

  describe('1. M3 Description and Core Copy Invariants', () => {
    it.each(LOCALES)('provides non-empty m3.desc in $lang with zero raw keys', ({ dict }) => {
      expect(dict['m3.desc']).toBeDefined()
      expect(typeof dict['m3.desc']).toBe('string')
      expect(dict['m3.desc'].trim().length).toBeGreaterThan(15)
      expect(dict['m3.desc']).not.toContain('m3.desc')
    })

    it.each(LOCALES)('provides valid m3.type translations for all defined types in $lang', ({ dict }) => {
      for (const ty of TYPES) {
        const key = `m3.type.${ty}`
        expect(dict[key], `Missing ${key} in locale`).toBeDefined()
        expect(dict[key]).not.toContain('m3.type.')
      }
    })

    it.each(LOCALES)('provides valid m3.method and m3.meth translations for all non-empty methods in $lang', ({ dict }) => {
      const activeMethods = METHODS.filter(Boolean)
      expect(activeMethods.length).toBeGreaterThan(0)
      for (const m of activeMethods) {
        expect(dict[`m3.method.${m}`], `Missing m3.method.${m}`).toBeDefined()
        expect(dict[`m3.meth.${m}`], `Missing m3.meth.${m}`).toBeDefined()
      }
    })

    it.each(LOCALES)('provides valid m3.loss translations for all non-empty losses in $lang', ({ dict }) => {
      const activeLosses = LOSSES.filter(Boolean)
      expect(activeLosses.length).toBeGreaterThan(0)
      for (const l of activeLosses) {
        expect(dict[`m3.loss.${l}`], `Missing m3.loss.${l}`).toBeDefined()
      }
    })

    it.each(LOCALES)('provides directory empty state & reset translations in $lang', ({ dict }) => {
      expect(dict['m3.directory.no_results']).toBeDefined()
      expect(dict['m3.directory.reset_filter']).toBeDefined()
      expect(dict['m3.directory.badge.official']).toBeDefined()
      expect(dict['m3.directory.badge.telecom']).toBeDefined()
      expect(dict['m3.directory.badge.financial']).toBeDefined()
      expect(dict['m3.directory.badge.global']).toBeDefined()
    })
  })

  describe('2. Official Reporting Directory Operational Scopes and Integrity', () => {
    it('contains verified directory contacts with accurate hotlines and limitations', () => {
      expect(OFFICIAL_REPORTING_DIRECTORY.length).toBeGreaterThanOrEqual(8)

      // INSA Ethio-CERT
      const insa = OFFICIAL_REPORTING_DIRECTORY.find((o) => o.id === 'rep_insa_cert')
      expect(insa).toBeDefined()
      expect(insa.phoneHotline).toBe('951')
      expect(insa.scope).toBe('ethiopia_national')
      expect(insa.badgeKey).toBe('m3.directory.badge.official')

      // Federal Police Cyber Crime
      const police = OFFICIAL_REPORTING_DIRECTORY.find((o) => o.id === 'rep_federal_police')
      expect(police).toBeDefined()
      expect(police.phoneHotline).toBe('991')
      expect(police.secondaryPhone).toBe('+251 11 551 2744')
      expect(police.phoneHotline).not.toBe('994') // 994 is Ethio Telecom, not police!

      // Ethio Telecom
      const telecom = OFFICIAL_REPORTING_DIRECTORY.find((o) => o.id === 'rep_ethio_telecom')
      expect(telecom).toBeDefined()
      expect(telecom.phoneHotline).toBe('994')
      expect(telecom.scope).toBe('ethiopia_telecom')
      expect(telecom.badgeKey).toBe('m3.directory.badge.telecom')

      // CBE
      const cbe = OFFICIAL_REPORTING_DIRECTORY.find((o) => o.id === 'rep_cbe_fraud')
      expect(cbe).toBeDefined()
      expect(cbe.phoneHotline).toBe('8888')
      expect(cbe.phoneHotline).not.toBe('951') // 951 is INSA CSIRT!
      expect(cbe.scope).toBe('ethiopia_financial')

      // Global platforms have no local phone hotlines
      const globals = OFFICIAL_REPORTING_DIRECTORY.filter((o) => o.scope === 'global_platform')
      expect(globals.length).toBeGreaterThan(0)
      for (const g of globals) {
        expect(g.phoneHotline).toBeFalsy()
        expect(g.reportingUrl).toMatch(/^https?:\/\//)
      }
    })

    it('filters correctly by search query, category, and jurisdiction scope', () => {
      // By query
      const cbeResults = filterReportingDirectory('Commercial Bank')
      expect(cbeResults.some((r) => r.id === 'rep_cbe_fraud')).toBe(true)

      // By national scope
      const national = filterReportingDirectory('', 'all', 'ethiopia_national')
      expect(national.every((r) => r.scope === 'ethiopia_national')).toBe(true)

      // Empty search match
      const empty = filterReportingDirectory('non_existent_query_xyz_123')
      expect(empty).toEqual([])
    })
  })

  describe('3. User Account Identity and Offline Wording Invariants', () => {
    it.each(LOCALES)('provides honest in-browser offline status string in $lang', ({ dict }) => {
      expect(dict['app.in_browser_offline']).toBeDefined()
      expect(dict['app.in_browser_offline'].length).toBeGreaterThan(5)
    })
  })
})
