import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  INCIDENT_ROUTING_PROFILES,
  getRecommendedRouting,
} from './lib/m3.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('M3 Intelligent Incident-Based Reporting & Recovery Guide', () => {
  const logosDir = path.resolve(__dirname, '../public/images/logos')

  it('1. Verifies all 10 requested incident archetypes are defined and non-empty', () => {
    const expectedIds = [
      'bank_fraud',
      'telebirr_fraud',
      'cbe_birr_fraud',
      'facebook_takeover',
      'instagram_takeover',
      'microsoft_compromise',
      'phishing_malware_ransomware',
      'sim_swap_telecom',
      'harassment_cyberbullying',
      'data_exposure',
      'other_unclear',
    ]

    expectedIds.forEach((id) => {
      const profile = INCIDENT_ROUTING_PROFILES.find((p) => p.id === id)
      expect(profile, `Profile for ${id} must exist`).toBeDefined()
      expect(profile.primary, `Primary destination for ${id} must exist`).toBeDefined()
      expect(profile.primary.name).toBeTruthy()
      expect(profile.primary.actionUrl).toMatch(/^https:\/\//)
      expect(profile.primary.logo).toMatch(/^\/images\/logos\/[a-z_]+\.svg$/)
      expect(profile.primary.whyKey).toBeTruthy()
      expect(profile.primary.prepareKey).toBeTruthy()
      expect(profile.primary.neverShareKey).toBeTruthy()
    })
  })

  it('2. Verifies all referenced logo SVG files exist on disk and have valid SVG markup', () => {
    expect(fs.existsSync(logosDir), 'Logos directory must exist').toBe(true)

    const referencedLogos = new Set()
    INCIDENT_ROUTING_PROFILES.forEach((profile) => {
      if (profile.primary?.logo) referencedLogos.add(profile.primary.logo)
      if (profile.secondary?.logo) referencedLogos.add(profile.secondary.logo)
    })

    expect(referencedLogos.size).toBeGreaterThanOrEqual(6)

    referencedLogos.forEach((logoWebPath) => {
      const fileName = path.basename(logoWebPath)
      const diskPath = path.join(logosDir, fileName)
      expect(fs.existsSync(diskPath), `Logo file ${fileName} must exist on disk`).toBe(true)

      const content = fs.readFileSync(diskPath, 'utf8')
      expect(content, `File ${fileName} must be non-empty`).toBeTruthy()
      expect(content).toContain('<svg')
      expect(content).toContain('</svg>')
    })
  })

  it('3. Verifies official attribution README exists with nominative fair use terms', () => {
    const readmePath = path.join(logosDir, 'README.md')
    expect(fs.existsSync(readmePath), 'Official attribution README must exist').toBe(true)
    const readme = fs.readFileSync(readmePath, 'utf8')
    expect(readme).toContain('Nominative Fair Use')
    expect(readme).toContain('Commercial Bank of Ethiopia')
    expect(readme).toContain('Ethio Telecom')
    expect(readme).toContain('INSA')
    expect(readme).toContain('Ethio-CERT')
  })

  it('4. Correctly routes financial fraud incidents to CBE and Ethio Telecom', () => {
    // Bank Fraud
    const bankRec = getRecommendedRouting('bank_fraud')
    expect(bankRec.id).toBe('bank_fraud')
    expect(bankRec.primary.name).toContain('Commercial Bank of Ethiopia')
    expect(bankRec.primary.hotline).toBe('8888')
    expect(bankRec.secondary.name).toContain('Federal Police')

    // Telebirr Fraud
    const telebirrRec = getRecommendedRouting('telebirr_fraud')
    expect(telebirrRec.id).toBe('telebirr_fraud')
    expect(telebirrRec.primary.name).toContain('Telebirr')
    expect(telebirrRec.primary.hotline).toBe('127')
    expect(telebirrRec.primary.secondaryPhone).toBe('994')
    expect(telebirrRec.primary.ussdCode).toBe('*127#')

    // CBE Birr Fraud
    const cbeBirrRec = getRecommendedRouting('cbe_birr_fraud')
    expect(cbeBirrRec.id).toBe('cbe_birr_fraud')
    expect(cbeBirrRec.primary.hotline).toBe('8888')
    expect(cbeBirrRec.primary.ussdCode).toBe('*889#')
    expect(cbeBirrRec.secondary.name).toContain('Ethio-CERT')
  })

  it('5. Correctly routes platform account takeovers directly to official recovery flows', () => {
    // Facebook
    const fbRec = getRecommendedRouting('facebook_takeover')
    expect(fbRec.id).toBe('facebook_takeover')
    expect(fbRec.primary.actionUrl).toBe('https://www.facebook.com/hacked')

    // Instagram
    const igRec = getRecommendedRouting('instagram_takeover')
    expect(igRec.id).toBe('instagram_takeover')
    expect(igRec.primary.actionUrl).toBe('https://www.instagram.com/hacked/')

    // Microsoft
    const msRec = getRecommendedRouting('microsoft_compromise')
    expect(msRec.id).toBe('microsoft_compromise')
    expect(msRec.primary.actionUrl).toBe('https://account.live.com/acsr')
  })

  it('6. Correctly routes national cyber threats to Ethio-CERT and Federal Police', () => {
    // Phishing / Malware / Ransomware
    const malwareRec = getRecommendedRouting('phishing_malware_ransomware')
    expect(malwareRec.id).toBe('phishing_malware_ransomware')
    expect(malwareRec.primary.name).toContain('Ethio-CERT')
    expect(malwareRec.primary.actionUrl).toBe('https://www.ethiocert.et')
    expect(malwareRec.primary.hotline).toBe('951')
    expect(malwareRec.secondary.name).toContain('Federal Police')
    expect(malwareRec.secondary.hotline).toBe('991')

    // SIM Swap
    const simRec = getRecommendedRouting('sim_swap_telecom')
    expect(simRec.id).toBe('sim_swap_telecom')
    expect(simRec.primary.name).toContain('Ethio Telecom')
    expect(simRec.primary.hotline).toBe('994')

    // Other / Unclear
    const unclearRec = getRecommendedRouting('other_unclear')
    expect(unclearRec.clarificationNeeded).toBe(true)
    expect(unclearRec.primary.name).toContain('Ethio-CERT')
  })

  it('7. Guarantees 100% trilingual dictionary coverage across EN, OM, and AM for all routing keys', () => {
    INCIDENT_ROUTING_PROFILES.forEach((profile) => {
      // Category & Title
      [profile.categoryKey, profile.titleKey].forEach((key) => {
        expect(en[key], `EN translation for ${key} must exist`).toBeTruthy()
        expect(om[key], `OM translation for ${key} must exist`).toBeTruthy()
        expect(am[key], `AM translation for ${key} must exist`).toBeTruthy()
      })

      // Primary keys
      const p = profile.primary
      const primaryKeys = [p.badgeKey, p.actionLabelKey, p.whyKey, p.prepareKey, p.neverShareKey]
      primaryKeys.forEach((key) => {
        expect(en[key], `EN translation for ${key} must exist`).toBeTruthy()
        expect(om[key], `OM translation for ${key} must exist`).toBeTruthy()
        expect(am[key], `AM translation for ${key} must exist`).toBeTruthy()
      })

      // Secondary keys if defined
      if (profile.secondary) {
        const s = profile.secondary
        const secKeys = [s.badgeKey, s.actionLabelKey, s.whyKey, s.prepareKey, s.neverShareKey]
        secKeys.forEach((key) => {
          expect(en[key], `EN translation for ${key} must exist`).toBeTruthy()
          expect(om[key], `OM translation for ${key} must exist`).toBeTruthy()
          expect(am[key], `AM translation for ${key} must exist`).toBeTruthy()
        })
      }
    })
  })

  it('8. Heuristic natural language mapper correctly selects incident category', () => {
    expect(getRecommendedRouting('I lost 10,000 birr on Telebirr app').id).toBe('telebirr_fraud')
    expect(getRecommendedRouting('someone stole my CBE Birr balance with 889').id).toBe('cbe_birr_fraud')
    expect(getRecommendedRouting('hacker changed my password on facebook.com').id).toBe('facebook_takeover')
    expect(getRecommendedRouting('Instagram account got locked out and password changed').id).toBe('instagram_takeover')
    expect(getRecommendedRouting('Outlook account compromised and emails forwarded').id).toBe('microsoft_compromise')
    expect(getRecommendedRouting('ransomware encrypted our hospital server files').id).toBe('phishing_malware_ransomware')
    expect(getRecommendedRouting('sudden no service on my phone possible sim swap').id).toBe('sim_swap_telecom')
  })
})

