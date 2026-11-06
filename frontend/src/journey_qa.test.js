import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import {
  CORE_MISSIONS,
  PRACTICE_TEMPLATES,
  generateOfflineMission,
  resolvePracticeTemplateId,
} from './lib/missionTemplates.js'
import {
  deriveArtworkPromptSpec,
  getFallbackArtwork,
  getArtworkAltKey,
  resolveMissionTemplateId,
  CATEGORY_ARTWORK_MAP,
  SPECIFIC_MISSION_ARTWORK_MAP,
  MODULE_ARTWORK_MAP,
} from './lib/artworkManager.js'

import {
  validateMission,
  SAFE_DOMAINS,
  MISSION_CATEGORIES,
} from './lib/missionSchema.js'
import {
  getAllMissions,
  getRank,
  getJourneyProgress,
  saveJourneyProgress,
  completeMission,
  evaluateChoice,
  isMissionCompleted,
  resetJourneyProgress,
  getNextMissionId,
  addGeneratedMission,
  addAdaptiveMission,
  determineAdaptiveRecommendation,
  JOURNEY_STORAGE_KEY,
} from './lib/journey.js'
import Journey from './components/Journey.jsx'
import { analyze as analyzeUrl } from './lib/m1.js'
import { analyze as analyzePassword } from './lib/m2.js'
import { buildDraft, validate as validateReport } from './lib/m3.js'
import { QUESTIONS } from './lib/quiz.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

const locales = { en, om, am }
const makeT = (lang) => (key) => locales[lang][key] || key

describe('Cyber Hero Journey - Comprehensive QA & Hardening Suite', () => {
  beforeEach(() => {
    resetJourneyProgress()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  describe('1. Full Campaign Progression (M01 -> M02 -> M03 -> M04)', () => {
    it('executes the full campaign sequentially, elevating rank and unlocking all badges', () => {
      // Step 1: Initial state
      let progress = getJourneyProgress()
      expect(progress.totalXp).toBe(0)
      expect(getRank(progress.totalXp).key).toBe('cadet')
      expect(progress.badges).toEqual([])

      // Step 2: M01 - The Scholarship Scam
      const m01Traps = CORE_MISSIONS[0].choices.filter((c) => c.isTrap)
      expect(m01Traps.length).toBe(3)
      for (const trap of m01Traps) {
        const trapRes = evaluateChoice('m01', trap.id)
        expect(trapRes.isCorrect).toBe(false)
        expect(trapRes.isTrap).toBe(true)
        expect(trapRes.awardedXp).toBe(0)
        expect(trap.feedback_key).toBeTruthy()
        expect(en[trap.feedback_key]).toBeDefined()
      }

      // Complete M01
      const m01Res = evaluateChoice('m01', CORE_MISSIONS[0].correct_choice)
      expect(m01Res.isCorrect).toBe(true)
      expect(m01Res.awardedXp).toBe(100)
      expect(m01Res.currentProgress.totalXp).toBe(100)
      expect(m01Res.currentProgress.badges).toContain('badge_scholarship_shield')
      expect(getRank(m01Res.currentProgress.totalXp).key).toBe('defender')

      // Step 3: Next Mission Navigation to M02
      expect(getNextMissionId('m01')).toBe('m02')

      // Step 4: M02 - The SIM Upgrade Trap
      const m02Traps = CORE_MISSIONS[1].choices.filter((c) => c.isTrap)
      for (const trap of m02Traps) {
        const trapRes = evaluateChoice('m02', trap.id)
        expect(trapRes.isCorrect).toBe(false)
        expect(trapRes.isTrap).toBe(true)
        expect(trapRes.awardedXp).toBe(0)
      }
      const m02Res = evaluateChoice('m02', CORE_MISSIONS[1].correct_choice)
      expect(m02Res.isCorrect).toBe(true)
      expect(m02Res.awardedXp).toBe(150)
      expect(m02Res.currentProgress.totalXp).toBe(250)
      expect(m02Res.currentProgress.badges).toContain('badge_telecom_guardian')
      expect(getRank(m02Res.currentProgress.totalXp).key).toBe('guardian')

      // Step 5: Next Mission Navigation to M03
      expect(getNextMissionId('m02')).toBe('m03')

      // Step 6: M03 - The Fake Banking Bot
      const m03Traps = CORE_MISSIONS[2].choices.filter((c) => c.isTrap)
      for (const trap of m03Traps) {
        const trapRes = evaluateChoice('m03', trap.id)
        expect(trapRes.isCorrect).toBe(false)
        expect(trapRes.isTrap).toBe(true)
      }
      const m03Res = evaluateChoice('m03', CORE_MISSIONS[2].correct_choice)
      expect(m03Res.isCorrect).toBe(true)
      expect(m03Res.currentProgress.totalXp).toBe(400)
      expect(m03Res.currentProgress.badges).toContain('badge_banking_defender')

      // Step 7: Next Mission Navigation to M04
      expect(getNextMissionId('m03')).toBe('m04')

      // Step 8: M04 - Malicious Job APK
      const m04Traps = CORE_MISSIONS[3].choices.filter((c) => c.isTrap)
      for (const trap of m04Traps) {
        const trapRes = evaluateChoice('m04', trap.id)
        expect(trapRes.isCorrect).toBe(false)
        expect(trapRes.isTrap).toBe(true)
      }
      const m04Res = evaluateChoice('m04', CORE_MISSIONS[3].correct_choice)
      expect(m04Res.isCorrect).toBe(true)
      expect(m04Res.currentProgress.totalXp).toBe(600)
      expect(m04Res.currentProgress.badges).toContain('badge_malware_sentinel')
      expect(getRank(m04Res.currentProgress.totalXp).key).toBe('champion')

      // Final Check: All 4 missions marked completed
      expect(isMissionCompleted('m01')).toBe(true)
      expect(isMissionCompleted('m02')).toBe(true)
      expect(isMissionCompleted('m03')).toBe(true)
      expect(isMissionCompleted('m04')).toBe(true)
    })
  })

  describe('2. Replay & Duplicate Reward Prevention', () => {
    it('allows replaying any completed mission without awarding duplicate XP or badges', () => {
      evaluateChoice('m01', CORE_MISSIONS[0].correct_choice)
      const afterFirst = getJourneyProgress()
      expect(afterFirst.totalXp).toBe(100)
      expect(afterFirst.badges.length).toBe(1)

      // Replay M01
      const replayRes = evaluateChoice('m01', CORE_MISSIONS[0].correct_choice)
      expect(replayRes.isCorrect).toBe(true)
      expect(replayRes.newlyCompleted).toBe(false)
      expect(replayRes.awardedXp).toBe(0)

      const afterReplay = getJourneyProgress()
      expect(afterReplay.totalXp).toBe(100)
      expect(afterReplay.badges.length).toBe(1)
      expect(afterReplay.badges).toEqual(['badge_scholarship_shield'])
    })
  })

  describe('3. Incorrect-Answer Feedback & Safe Learning Recovery', () => {
    it('provides educational explanations for all 12 trap choices across M01-M04', () => {
      for (const mission of CORE_MISSIONS) {
        const traps = mission.choices.filter((c) => c.isTrap)
        expect(traps.length).toBe(3)
        for (const trap of traps) {
          expect(trap.feedback_key).toBeTruthy()
          // Must exist in English, Afaan Oromoo, and Amharic
          expect(en[trap.feedback_key], `Missing EN feedback for ${trap.id}`).toBeDefined()
          expect(om[trap.feedback_key], `Missing OM feedback for ${trap.id}`).toBeDefined()
          expect(am[trap.feedback_key], `Missing AM feedback for ${trap.id}`).toBeDefined()

          // Verify the feedback contains substantive educational content (> 25 characters)
          expect(en[trap.feedback_key].length).toBeGreaterThan(25)
          expect(om[trap.feedback_key].length).toBeGreaterThan(25)
          expect(am[trap.feedback_key].length).toBeGreaterThan(25)
        }
      }
    })

    it('allows learner to continue and recover after a trap selection', () => {
      // Step 1: Select trap on M02
      const trapRes = evaluateChoice('m02', 'choice_m02_enter_pin')
      expect(trapRes.isCorrect).toBe(false)
      expect(isMissionCompleted('m02')).toBe(false)

      // Step 2: Retry with correct defensive choice
      const recoverRes = evaluateChoice('m02', 'choice_m02_verify_telecom')
      expect(recoverRes.isCorrect).toBe(true)
      expect(recoverRes.newlyCompleted).toBe(true)
      expect(recoverRes.awardedXp).toBe(150)
      expect(isMissionCompleted('m02')).toBe(true)
    })
  })

  describe('4. Local Persistence & Malformed Recovery (Section 6)', () => {
    it('persists progress, active mission, and custom practice missions across reloads', () => {
      evaluateChoice('m01', CORE_MISSIONS[0].correct_choice)
      const p1 = addGeneratedMission(5)
      saveJourneyProgress({
        ...getJourneyProgress(),
        activeMissionId: p1.id,
      })

      // Simulate browser reload by reading raw storage
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(JOURNEY_STORAGE_KEY)
        expect(raw).toBeTruthy()

        const restored = getJourneyProgress()
        expect(restored.totalXp).toBe(150)
        expect(restored.activeMissionId).toBe(p1.id)
        expect(restored.completedMissions.m01.completed).toBe(true)
        expect(restored.generatedMissions.length).toBe(1)
        expect(restored.generatedMissions[0].id).toBe(p1.id)
      }
    })

    it('safely recovers to initial state without throwing if localStorage is corrupt', () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(JOURNEY_STORAGE_KEY, '{ broken json payload !!!')
        const safe = getJourneyProgress()
        expect(safe.totalXp).toBe(0)
        expect(safe.badges).toEqual([])
        expect(safe.activeMissionId).toBe('m01')
        expect(safe.completedMissions).toEqual({})
      }
    })

    it('safely handles non-object corrupted storage values', () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify('a primitive string'))
        const safe = getJourneyProgress()
        expect(safe.totalXp).toBe(0)
        expect(safe.activeMissionId).toBe('m01')
      }
    })

    it('clears storage completely upon resetJourneyProgress', () => {
      evaluateChoice('m01', CORE_MISSIONS[0].correct_choice)
      expect(getJourneyProgress().totalXp).toBe(100)

      const cleared = resetJourneyProgress()
      expect(cleared.totalXp).toBe(0)
      expect(cleared.badges).toEqual([])
      expect(cleared.completedMissions).toEqual({})

      if (typeof localStorage !== 'undefined') {
        expect(localStorage.getItem(JOURNEY_STORAGE_KEY)).toBeNull()
      }
    })
  })

  describe('5. Fictional URLs & Domain Safety (RFC 2606 Compliance)', () => {
    it('uses only RFC 2606 reserved domains (.invalid, .example, .test, .example.com/.net/.org)', () => {
      const all = getAllMissions()
      for (const m of all) {
        expect(m.target_url).toBeDefined()
        const isSafe = SAFE_DOMAINS.some((d) => m.target_url.includes(d))
        expect(isSafe, `Mission ${m.id} URL "${m.target_url}" is not in SAFE_DOMAINS`).toBe(true)

        // Specifically verify NO misleading .example.top domain is used
        expect(m.target_url).not.toContain('.example.top')
      }
    })

    it('uses the RFC 2606 .invalid domain for Mission 01', () => {
      const m01 = CORE_MISSIONS.find((m) => m.id === 'm01')
      expect(m01.target_url).toBe('http://scholarship-ethiopia-simulated-demo.invalid/verify')
    })
  })

  describe('6. Offline Procedural Mission Generator Validation', () => {
    it('generates valid missions across all three difficulty tiers', () => {
      for (const diff of ['beginner', 'intermediate', 'advanced']) {
        const mission = generateOfflineMission({ index: 2, difficulty: diff })
        const val = validateMission(mission)
        expect(val.valid, `Generated ${diff} mission failed validation: ${val.errors.join(', ')}`).toBe(true)
        expect(mission.difficulty).toBe(diff)
      }
    })

    it('generates deterministic output for identical seed parameters without Math.random', () => {
      const a = generateOfflineMission({ index: 7, difficulty: 'advanced' })
      const b = generateOfflineMission({ index: 7, difficulty: 'advanced' })
      expect(a.id).toBe(b.id)
      expect(a.target_url).toBe(b.target_url)
      expect(a.correct_choice).toBe(b.correct_choice)
      expect(a.xp_reward).toBe(200)
    })
  })

  describe('7. Trilingual Localization Parity (EN, OM, AM)', () => {
    it('contains all mission strings, feedback, debrief rules, and badges in EN, OM, and AM', () => {
      const all = getAllMissions()
      const langs = ['en', 'om', 'am']

      for (const lang of langs) {
        const dict = locales[lang]
        expect(dict).toBeDefined()

        // Common UI keys
        const commonKeys = [
          'journey.title',
          'journey.subtitle',
          'journey.agent_rank',
          'journey.xp',
          'journey.badges',
          'journey.next_mission',
          'journey.generate_mission',
          'journey.mission_track',
          'journey.persistence_disclaimer',
          'journey.storage_limitations',
          'journey.reset_progress',
          'journey.reset_confirm',
        ]
        for (const k of commonKeys) {
          expect(dict[k], `Missing "${k}" in ${lang}`).toBeDefined()
          expect(dict[k].trim().length).toBeGreaterThan(0)
        }

        // Each mission
        for (const m of all) {
          expect(dict[m.title_key], `Missing title_key "${m.title_key}" in ${lang}`).toBeDefined()
          expect(dict[m.subtitle_key], `Missing subtitle_key "${m.subtitle_key}" in ${lang}`).toBeDefined()
          expect(dict[m.story_key], `Missing story_key "${m.story_key}" in ${lang}`).toBeDefined()
          expect(dict[m.sender_name_key], `Missing sender_name_key "${m.sender_name_key}" in ${lang}`).toBeDefined()

          if (m.decision_title_key) {
            expect(dict[m.decision_title_key], `Missing decision title "${m.decision_title_key}" in ${lang}`).toBeDefined()
            expect(dict[m.decision_title_key].trim().length).toBeGreaterThan(0)
          }
          if (m.decision_desc_key) {
            expect(dict[m.decision_desc_key], `Missing decision desc "${m.decision_desc_key}" in ${lang}`).toBeDefined()
            expect(dict[m.decision_desc_key].trim().length).toBeGreaterThan(0)
          }

          for (const ev of m.evidence_items) {
            expect(dict[ev.title_key], `Missing evidence title "${ev.title_key}" in ${lang}`).toBeDefined()
            expect(dict[ev.desc_key], `Missing evidence desc "${ev.desc_key}" in ${lang}`).toBeDefined()
          }

          for (const c of m.choices) {
            expect(dict[c.label_key], `Missing choice label "${c.label_key}" in ${lang}`).toBeDefined()
            expect(dict[c.feedback_key], `Missing feedback "${c.feedback_key}" in ${lang}`).toBeDefined()
          }

          for (const r of m.debrief_rules) {
            expect(dict[r], `Missing debrief rule "${r}" in ${lang}`).toBeDefined()
          }
        }
      }
    })
  })

  describe('8. Component Rendering & Non-Clickable URL Safety', () => {
    it('renders Journey component safely to string without raw clickable target links', () => {
      for (const lang of ['en', 'om', 'am']) {
        const t = makeT(lang)
        const html = renderToString(React.createElement(Journey, { t, lang, user: null }))

        // Must render mission selector bar
        expect(html).toContain('mission-selector-bar')

        // Must render mission chips
        expect(html).toContain('mission-chip')

        // Must render safe non-clickable target url inside <code> and NOT <a href=...>
        expect(html).toContain('target-url')
        expect(html).toContain('scholarship-ethiopia-simulated-demo.invalid')
        expect(html).not.toMatch(/<a[^>]+href=["']http:\/\/scholarship-ethiopia-simulated-demo/)

        // Must render persistence disclaimer
        expect(html).toContain('privacy-session-banner')

        // Must render execute action button
        expect(html).toContain('journey-execute-choice-btn')
      }
    })
  })

  describe('9. Mission-Specific Character Name & Question Heading Integrity', () => {
    it('verifies each campaign mission displays its own character name and natural grammatical question in EN, OM, and AM', () => {
      const expectedQuestions = {
        m01: {
          character: { en: 'Sufian', om: 'Sufiyaan', am: 'ሱፊያን' },
          question: {
            en: 'What should Sufian do?',
            om: 'Sufiyaan maal gochuu qaba?',
            am: 'ሱፊያን ምን ማድረግ አለበት?',
          },
        },
        m02: {
          character: { en: 'Selam', om: 'Salaam', am: 'ሰላም' },
          question: {
            en: 'What should Selam do?',
            om: 'Salaam maal gochuu qabdi?',
            am: 'ሰላም ምን ማድረግ አለባት?',
          },
        },
        m03: {
          character: { en: 'Dawit', om: 'Daawwit', am: 'ዳዊት' },
          question: {
            en: 'What should Dawit do?',
            om: 'Daawwit maal gochuu qaba?',
            am: 'ዳዊት ምን ማድረግ አለበት?',
          },
        },
        m04: {
          character: { en: 'Hana', om: 'Haanaan', am: 'ሃና' },
          question: {
            en: 'What should Hana do?',
            om: 'Haanaan maal gochuu qabdi?',
            am: 'ሃና ምን ማድረግ አለባት?',
          },
        },
      }

      for (const [mid, exp] of Object.entries(expectedQuestions)) {
        const mission = CORE_MISSIONS.find((m) => m.id === mid)
        expect(mission).toBeDefined()
        expect(mission.decision_title_key).toBe(`journey.${mid}.decision.title`)
        expect(mission.decision_desc_key).toBe(`journey.${mid}.decision.desc`)

        for (const lang of ['en', 'om', 'am']) {
          const dict = locales[lang]
          const qText = dict[mission.decision_title_key]
          expect(qText, `Mission ${mid} question in ${lang}`).toBe(exp.question[lang])
          expect(qText, `Mission ${mid} question in ${lang}`).toContain(exp.character[lang])

          const dText = dict[mission.decision_desc_key]
          expect(dText).toBeDefined()
          expect(dText.length).toBeGreaterThan(0)
        }
      }
    })

    it('asserts that the Afaan Oromoo question heading is NOT erroneously reused across missions', () => {
      const m01Om = om[CORE_MISSIONS[0].decision_title_key]
      const m02Om = om[CORE_MISSIONS[1].decision_title_key]
      const m03Om = om[CORE_MISSIONS[2].decision_title_key]
      const m04Om = om[CORE_MISSIONS[3].decision_title_key]

      expect(m01Om).toBe('Sufiyaan maal gochuu qaba?')
      expect(m02Om).toBe('Salaam maal gochuu qabdi?')
      expect(m03Om).toBe('Daawwit maal gochuu qaba?')
      expect(m04Om).toBe('Haanaan maal gochuu qabdi?')

      // Distinctness assertion - all 4 mission question headings in Afaan Oromoo are distinct
      const allOmHeadings = [m01Om, m02Om, m03Om, m04Om]
      const uniqueHeadings = new Set(allOmHeadings)
      expect(uniqueHeadings.size).toBe(4)

      // Ensure Sufiyaan does not appear in M02, M03, or M04
      expect(m02Om).not.toContain('Sufiyaan')
      expect(m03Om).not.toContain('Sufiyaan')
      expect(m04Om).not.toContain('Sufiyaan')
    })

    it('renders the correct character question heading in the Journey component for each mission', () => {
      for (const mid of ['m01', 'm02', 'm03', 'm04']) {
        saveJourneyProgress({ activeMissionId: mid })

        for (const lang of ['en', 'om', 'am']) {
          const t = makeT(lang)
          const html = renderToString(React.createElement(Journey, { t, lang, user: null }))

          const mission = CORE_MISSIONS.find((m) => m.id === mid)
          const expectedHeading = locales[lang][mission.decision_title_key]

          // Heading must be rendered in h3
          expect(html).toContain(expectedHeading)

          // Other character question headings must not appear
          for (const otherMid of ['m01', 'm02', 'm03', 'm04']) {
            if (otherMid !== mid) {
              const otherMission = CORE_MISSIONS.find((m) => m.id === otherMid)
              const otherHeading = locales[lang][otherMission.decision_title_key]
              expect(html).not.toContain(`<h3>🎯 ${otherHeading}</h3>`)
            }
          }
        }
      }
    })
  })

  describe('10. Comprehensive Section 10 Requirements (Offline Adaptive Generator)', () => {
    it('Req 1: M01–M04 content and character-specific headings remain correct across all languages, as well as P01–P06', () => {
      // Core missions M01-M04
      const coreExpected = [
        { id: 'm01', en: 'What should Sufian do?', om: 'Sufiyaan maal gochuu qaba?', am: 'ሱፊያን ምን ማድረግ አለበት?' },
        { id: 'm02', en: 'What should Selam do?', om: 'Salaam maal gochuu qabdi?', am: 'ሰላም ምን ማድረግ አለባት?' },
        { id: 'm03', en: 'What should Dawit do?', om: 'Daawwit maal gochuu qaba?', am: 'ዳዊት ምን ማድረግ አለበት?' },
        { id: 'm04', en: 'What should Hana do?', om: 'Haanaan maal gochuu qabdi?', am: 'ሃና ምን ማድረግ አለባት?' },
      ]

      for (const item of coreExpected) {
        const m = CORE_MISSIONS.find((x) => x.id === item.id)
        expect(m).toBeDefined()
        expect(en[m.decision_title_key]).toBe(item.en)
        expect(om[m.decision_title_key]).toBe(item.om)
        expect(am[m.decision_title_key]).toBe(item.am)
      }

      // Practice templates P01-P06
      const practiceExpected = [
        { id: 'p01', charEn: 'Abel', charOm: 'Abeel', charAm: 'አቤል', qEn: 'What should Abel do?', qOm: 'Abeel maal gochuu qaba?', qAm: 'አቤል ምን ማድረግ አለበት?' },
        { id: 'p02', charEn: 'Tigist', charOm: 'Tiigistii', charAm: 'ትዕግስት', qEn: 'What should Tigist do?', qOm: 'Tiigistii maal gochuu qabdi?', qAm: 'ትዕግስት ምን ማድረግ አለባት?' },
        { id: 'p03', charEn: 'Robel', charOm: 'Roobeel', charAm: 'ሮቤል', qEn: 'What should Robel do?', qOm: 'Roobeel maal gochuu qaba?', qAm: 'ሮቤል ምን ማድረግ አለበት?' },
        { id: 'p04', charEn: 'Aster', charOm: 'Asteer', charAm: 'አስቴር', qEn: 'What should Aster do?', qOm: 'Asteer maal gochuu qabdi?', qAm: 'አስቴር ምን ማድረግ አለባት?' },
        { id: 'p05', charEn: 'Biniam', charOm: 'Biniyaam', charAm: 'ቢንያም', qEn: 'What should Biniam do?', qOm: 'Biniyaam maal gochuu qaba?', qAm: 'ቢንያም ምን ማድረግ አለበት?' },
        { id: 'p06', charEn: 'Lemlem', charOm: 'Lamlam', charAm: 'ለምለም', qEn: 'What should Lemlem do?', qOm: 'Lamlam maal gochuu qabdi?', qAm: 'ለምለም ምን ማድረግ አለባት?' },
      ]

      for (const item of practiceExpected) {
        const tmpl = PRACTICE_TEMPLATES.find((x) => x.id === item.id)
        expect(tmpl).toBeDefined()
        expect(en[`journey.${item.id}.decision.title`]).toBe(item.qEn)
        expect(om[`journey.${item.id}.decision.title`]).toBe(item.qOm)
        expect(am[`journey.${item.id}.decision.title`]).toBe(item.qAm)

        // Gender grammar assertions
        expect(en[`journey.${item.id}.decision.title`]).toContain(item.charEn)
        expect(om[`journey.${item.id}.decision.title`]).toContain(item.charOm)
        expect(am[`journey.${item.id}.decision.title`]).toContain(item.charAm)
      }
    })

    it('Req 2: Multiple subsequent missions can be generated beyond the four core missions', () => {
      const initialTotal = getAllMissions().length
      expect(initialTotal).toBe(4)

      const generated = []
      for (let i = 0; i < 6; i++) {
        const m = addAdaptiveMission()
        expect(m).toBeDefined()
        expect(m.id.startsWith('gen_m')).toBe(true)
        generated.push(m)
      }

      const updatedAll = getAllMissions()
      expect(updatedAll.length).toBe(10)

      // Ensure each has a unique ID and passes validation
      const ids = new Set(updatedAll.map((m) => m.id))
      expect(ids.size).toBe(10)

      for (const m of generated) {
        const val = validateMission(m)
        expect(val.valid).toBe(true)
      }
    })

    it('Req 3: Generation is deterministic for the same inputs', () => {
      const params = { index: 4, difficulty: 'intermediate', category: 'password_safety' }
      const run1 = generateOfflineMission(params)
      const run2 = generateOfflineMission(params)

      expect(run1.id).toBe(run2.id)
      expect(run1.code).toBe(run2.code)
      expect(run1.category).toBe(run2.category)
      expect(run1.difficulty).toBe(run2.difficulty)
      expect(run1.target_url).toBe(run2.target_url)
      expect(run1.correct_choice).toBe(run2.correct_choice)
      expect(run1.choices.length).toBe(run2.choices.length)
      expect(run1.debrief_rules).toEqual(run2.debrief_rules)
    })

    it('Req 4: Generated missions pass schema validation', () => {
      for (const diff of ['beginner', 'intermediate', 'advanced']) {
        for (let idx = 0; idx < 8; idx++) {
          const m = generateOfflineMission({ index: idx, difficulty: diff })
          const val = validateMission(m)
          expect(val.valid, `Mission ${m.id} at ${diff} failed: ${val.errors.join(', ')}`).toBe(true)
          expect(val.errors).toEqual([])
        }
      }
    })

    it('Req 5: Invalid missions are rejected and safe fallbacks work', () => {
      // 5a: Schema rejection on tampered attributes
      const invalidUrl = {
        ...CORE_MISSIONS[0],
        id: 'bad_url_mission',
        target_url: 'http://malicious-live-site.com/exploit',
      }
      expect(validateMission(invalidUrl).valid).toBe(false)

      const invalidCat = {
        ...CORE_MISSIONS[0],
        id: 'bad_cat_mission',
        category: 'trojan_payload_delivery',
      }
      expect(validateMission(invalidCat).valid).toBe(false)

      const noCorrect = {
        ...CORE_MISSIONS[0],
        id: 'no_correct_mission',
        choices: CORE_MISSIONS[0].choices.map((c) => ({ ...c, isCorrect: false })),
      }
      expect(validateMission(noCorrect).valid).toBe(false)

      // 5b: Generator fallback when given an invalid category or non-existent template
      const fallbackMission = generateOfflineMission({
        index: 999,
        difficulty: 'intermediate',
        category: 'non_existent_category_xyz',
      })
      expect(fallbackMission).toBeDefined()
      const val = validateMission(fallbackMission)
      expect(val.valid).toBe(true)
      expect(SAFE_DOMAINS.some((d) => fallbackMission.target_url.includes(d))).toBe(true)
    })

    it('Req 6: Adaptive difficulty starts at beginner when no history exists', () => {
      const rec = determineAdaptiveRecommendation({
        completedMissions: {},
        categoryStats: {},
        difficultyStats: {},
        recentOutcomes: [],
      })

      expect(rec.difficulty).toBe('beginner')
      expect(rec.targetCategory).toBeNull()
      expect(rec.reason).toBe('insufficient_data')
    })

    it('Req 7: Repeated errors in one category trigger appropriate additional practice', () => {
      const historyWithErrors = {
        completedMissions: { m01: { completed: true } },
        categoryStats: {
          fake_job_offers: { attempts: 2, correct: 0, wrong: 2, consecutiveCorrect: 0 },
        },
        difficultyStats: {
          beginner: { attempts: 2, correct: 0, wrong: 2 },
        },
        recentOutcomes: [
          { category: 'fake_job_offers', isCorrect: false },
          { category: 'fake_job_offers', isCorrect: false },
        ],
      }

      const rec = determineAdaptiveRecommendation(historyWithErrors)
      expect(rec.difficulty).toBe('beginner')
      expect(rec.targetCategory).toBe('fake_job_offers')
      expect(rec.reason).toBe('category_remediation')

      // Verifying addAdaptiveMission respects targeted category
      saveJourneyProgress(historyWithErrors)
      const mission = addAdaptiveMission()
      expect(mission.category).toBe('fake_job_offers')
      expect(mission.difficulty).toBe('beginner')
    })

    it('Req 8: Consistent success gradually raises difficulty without abrupt jumps', () => {
      // 8a: Single correct answer does not jump to intermediate or advanced
      const singleSuccess = {
        completedMissions: { m01: { completed: true } },
        categoryStats: {
          phishing: { attempts: 1, correct: 1, wrong: 0, consecutiveCorrect: 1 },
        },
        difficultyStats: {
          beginner: { attempts: 1, correct: 1, wrong: 0 },
        },
        recentOutcomes: [
          { category: 'phishing', isCorrect: true },
        ],
      }
      expect(determineAdaptiveRecommendation(singleSuccess).difficulty).toBe('beginner')

      // 8b: Two consecutive correct beginner answers elevates to intermediate
      const twoSuccessBeg = {
        completedMissions: { m01: { completed: true }, m02: { completed: true } },
        categoryStats: {
          phishing: { attempts: 1, correct: 1, wrong: 0, consecutiveCorrect: 1 },
          account_security: { attempts: 1, correct: 1, wrong: 0, consecutiveCorrect: 1 },
        },
        difficultyStats: {
          beginner: { attempts: 2, correct: 2, wrong: 0 },
        },
        recentOutcomes: [
          { category: 'phishing', isCorrect: true },
          { category: 'account_security', isCorrect: true },
        ],
      }
      expect(determineAdaptiveRecommendation(twoSuccessBeg).difficulty).toBe('intermediate')

      // 8c: Two consecutive correct intermediate answers elevates to advanced
      const twoSuccessMid = {
        ...twoSuccessBeg,
        difficultyStats: {
          beginner: { attempts: 2, correct: 2, wrong: 0 },
          intermediate: { attempts: 2, correct: 2, wrong: 0 },
        },
        recentOutcomes: [
          { category: 'phishing', isCorrect: true },
          { category: 'account_security', isCorrect: true },
        ],
      }
      expect(determineAdaptiveRecommendation(twoSuccessMid).difficulty).toBe('advanced')
    })

    it('Req 9: Different categories and scenarios can be selected without unintended immediate repetition', () => {
      const rec = determineAdaptiveRecommendation({
        completedMissions: { m01: { completed: true } },
        categoryStats: {},
        difficultyStats: {},
        recentOutcomes: [{ category: 'fake_job_offers', isCorrect: true }],
      })

      expect(rec.avoidCategory).toBe('fake_job_offers')

      const m1 = generateOfflineMission({ index: 0 })
      const m2 = generateOfflineMission({ index: 1, excludeIds: [m1.id] })
      expect(m1.category).not.toBe(m2.category)
    })

    it('Req 10: XP and completion rewards cannot be duplicated by replaying missions', () => {
      // Create and complete an adaptive mission
      const m = addAdaptiveMission({ difficulty: 'intermediate' })
      expect(m.xp_reward).toBe(150)

      const firstAttempt = evaluateChoice(m.id, m.correct_choice)
      expect(firstAttempt.isCorrect).toBe(true)
      expect(firstAttempt.newlyCompleted).toBe(true)
      expect(firstAttempt.awardedXp).toBe(150)
      const xpAfterFirst = getJourneyProgress().totalXp
      expect(xpAfterFirst).toBe(150)

      // Replay the mission
      const replayAttempt = evaluateChoice(m.id, m.correct_choice)
      expect(replayAttempt.isCorrect).toBe(true)
      expect(replayAttempt.newlyCompleted).toBe(false)
      expect(replayAttempt.awardedXp).toBe(0)
      expect(getJourneyProgress().totalXp).toBe(xpAfterFirst)
    })

    it('Req 11: Progress survives refresh and remains compatible with existing saved progress', () => {
      // Legacy saved progress structure without adaptive telemetry
      const legacySaved = {
        totalXp: 300,
        badges: ['badge_scholarship_shield', 'badge_telecom_guardian'],
        completedMissions: {
          m01: { completed: true, stars: 3 },
          m02: { completed: true, stars: 3 },
        },
        activeMissionId: 'm03',
      }

      const mockStorage = new Map()
      mockStorage.set(JOURNEY_STORAGE_KEY, JSON.stringify(legacySaved))
      const prevStorage = globalThis.localStorage
      globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
      }

      try {
        const loaded = getJourneyProgress()
        expect(loaded.totalXp).toBe(250)
        expect(loaded.badges).toEqual(['badge_scholarship_shield', 'badge_telecom_guardian'])
        expect(loaded.activeMissionId).toBe('m03')
        expect(loaded.categoryStats).toEqual({})
        expect(loaded.difficultyStats).toEqual({})
        expect(Array.isArray(loaded.recentOutcomes)).toBe(true)

        // Updating after loaded preserves backward compatibility
        evaluateChoice('m03', CORE_MISSIONS[2].correct_choice)
        const afterSave = getJourneyProgress()
        expect(afterSave.totalXp).toBe(400)
        expect(afterSave.badges).toContain('badge_banking_defender')
        expect(afterSave.completedMissions.m01.completed).toBe(true)
        expect(afterSave.completedMissions.m02.completed).toBe(true)
        expect(afterSave.completedMissions.m03.completed).toBe(true)
      } finally {
        globalThis.localStorage = prevStorage
      }
    })

    it('Req 12: Malformed or unavailable localStorage does not crash the Journey', () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(JOURNEY_STORAGE_KEY, '<<<NOT_JSON>>>')
      }
      expect(() => getJourneyProgress()).not.toThrow()
      expect(getJourneyProgress().totalXp).toBe(0)

      // Test rendering component with broken storage
      for (const lang of ['en', 'om', 'am']) {
        const t = makeT(lang)
        expect(() => renderToString(React.createElement(Journey, { t, lang, user: null }))).not.toThrow()
      }
    })

    it('Req 13: Reset still requires confirmation', () => {
      evaluateChoice('m01', CORE_MISSIONS[0].correct_choice)
      expect(getJourneyProgress().totalXp).toBe(100)

      // Ensure window is defined in test runner
      const prevWindow = globalThis.window
      globalThis.window = globalThis.window || {}
      const confirmSpy = vi.fn()
      globalThis.window.confirm = confirmSpy

      try {
        // Case A: User cancels confirmation
        confirmSpy.mockReturnValueOnce(false)
        // If user cancels, resetJourneyProgress is NOT triggered
        expect(getJourneyProgress().totalXp).toBe(100)

        // Case B: User confirms
        confirmSpy.mockReturnValueOnce(true)
        resetJourneyProgress()
        expect(getJourneyProgress().totalXp).toBe(0)
        expect(getJourneyProgress().badges).toEqual([])
      } finally {
        globalThis.window = prevWindow
      }
    })

    it('Req 14: English, Afaan Oromoo, and Amharic locale keys remain consistent', () => {
      const enKeys = Object.keys(en).sort()
      const omKeys = Object.keys(om).sort()
      const amKeys = Object.keys(am).sort()

      expect(omKeys).toEqual(enKeys)
      expect(amKeys).toEqual(enKeys)
      expect(enKeys.length).toBeGreaterThanOrEqual(901)


      for (const k of enKeys) {
        expect(en[k].trim().length).toBeGreaterThan(0)
        expect(om[k].trim().length).toBeGreaterThan(0)
        expect(am[k].trim().length).toBeGreaterThan(0)
      }
    })

    it('Req 15: The generator works without network access (no fetch or XHR)', () => {
      const fetchSpy = vi.fn().mockImplementation(() => {
        throw new Error('Offline rule violation: network fetch attempted!')
      })
      globalThis.fetch = fetchSpy

      try {
        // Generate several adaptive missions and evaluate them offline
        for (let i = 0; i < 4; i++) {
          const m = addAdaptiveMission()
          expect(m).toBeDefined()
          evaluateChoice(m.id, m.choices[0].id)
        }
        expect(fetchSpy).not.toHaveBeenCalled()
      } finally {
        delete globalThis.fetch
      }
    })

    it('Req 16: Existing M1–M5 functionality and existing tests remain intact', () => {
      // M1 link heuristic checker
      const m1Res = analyzeUrl('http://192.168.1.1/login')
      expect(m1Res.error).toBeUndefined()
      expect(m1Res.indicators).toContain('IND-01')

      // M2 password tool
      const m2Res = analyzePassword('P@ssw0rd2026Secure!')
      expect(m2Res).toBeDefined()
      expect(m2Res.bits).toBeGreaterThan(40)

      // M3 report drafting
      const draft = buildDraft(
        { type: 'phishing', date: '2026-10-21', what: 'Received spoofed SMS' },
        (k) => en[k] || k,
        new Date('2026-10-21')
      )
      expect(draft).toContain('Phishing')
      expect(draft).toContain('Received spoofed SMS')

      // M5 quiz engine
      expect(QUESTIONS.length).toBeGreaterThan(0)
    })
  })

  describe('11. Futuristic Cybersecurity Game Artwork & Difficulty Tiers Integration', () => {
    it('all core campaign missions (M01-M04) have dedicated artwork_url and localized artwork_alt_key', () => {
      expect(CORE_MISSIONS.length).toBe(4)
      for (const m of CORE_MISSIONS) {
        expect(m.artwork_url).toBeDefined()
        expect(m.artwork_url).toMatch(/^\/images\/journey\/m\d\d_.*\.svg$/)
        expect(m.artwork_alt_key).toBe(`journey.${m.id}.artwork_alt`)
        // Ensure alt text is localized in all 3 languages
        expect(en[m.artwork_alt_key]).toBeDefined()
        expect(om[m.artwork_alt_key]).toBeDefined()
        expect(am[m.artwork_alt_key]).toBeDefined()
      }
    })

    it('all practice templates (P01-P06) have valid artwork_url and localized alt keys', () => {
      expect(PRACTICE_TEMPLATES.length).toBe(6)
      for (const p of PRACTICE_TEMPLATES) {
        expect(p.artwork_url).toBeDefined()
        expect(p.artwork_url.startsWith('/images/journey/')).toBe(true)
        expect(p.artwork_alt_key).toBeDefined()
        expect(en[p.artwork_alt_key]).toBeDefined()
        expect(om[p.artwork_alt_key]).toBeDefined()
        expect(am[p.artwork_alt_key]).toBeDefined()
      }
    })

    it('procedurally generated missions inherit artwork_url and alt keys', () => {
      const generated = generateOfflineMission({ index: 0, difficulty: 'beginner' })
      expect(generated.artwork_url).toBeDefined()
      expect(generated.artwork_url.startsWith('/images/journey/')).toBe(true)
      expect(generated.artwork_alt_key).toBeDefined()
    })

    it('renders mission artwork and difficulty cards in Journey component without layout shifts', () => {
      const html = renderToString(
        React.createElement(Journey, {
          t: (k) => en[k] || k,
          lang: 'en',
          user: null,
        })
      )
      // Mission banner artwork
      expect(html).toContain('mission-banner-media')
      expect(html).toContain('mission-artwork-img')
      expect(html).toContain('mission-artwork-fallback')
      expect(html).toContain('/images/journey/m01_scholarship_phishing.svg')

      // Mission chip thumbnail
      expect(html).toContain('mission-chip-thumb')
      expect(html).toContain('mission-chip-thumb-img')

      // Artwork status pill
      expect(html).toContain('artwork-status-pill')
    })

    it('artworkManager resolves deterministic fallbacks for all core and practice missions', () => {
      // Core missions M01-M04
      expect(getFallbackArtwork({ id: 'm01' })).toBe('/images/journey/m01_scholarship_phishing.svg')
      expect(getFallbackArtwork({ id: 'm02' })).toBe('/images/journey/m02_sim_upgrade.svg')
      expect(getFallbackArtwork({ id: 'm03' })).toBe('/images/journey/m03_banking_bot.svg')
      expect(getFallbackArtwork({ id: 'm04' })).toBe('/images/journey/m04_malicious_apk.svg')

      // Practice missions P01-P06
      expect(getFallbackArtwork({ id: 'p01' })).toBe('/images/journey/p01_fake_job.svg')
      expect(getFallbackArtwork({ id: 'p02' })).toBe('/images/journey/p02_password_sync.svg')
      expect(getFallbackArtwork({ id: 'p03' })).toBe('/images/journey/p03_qr_phishing.svg')
      expect(getFallbackArtwork({ id: 'p04' })).toBe('/images/journey/p04_social_transfer.svg')
      expect(getFallbackArtwork({ id: 'p05' })).toBe('/images/journey/p05_data_leak.svg')
      expect(getFallbackArtwork({ id: 'p06' })).toBe('/images/journey/p06_compromised_peer.svg')

      // Category matching
      expect(getFallbackArtwork({ category: 'fake_job_offers' })).toBe('/images/journey/p01_fake_job.svg')
      expect(getFallbackArtwork({ category: 'password_safety' })).toBe('/images/journey/p02_password_sync.svg')

      // Unknown category and difficulty tier fallback
      expect(getFallbackArtwork({ category: 'unseen_cat', difficulty: 'beginner' })).toBe('/images/journey/diff_beginner.svg')
      expect(getFallbackArtwork({ category: 'unseen_cat', difficulty: 'intermediate' })).toBe('/images/journey/diff_intermediate.svg')
      expect(getFallbackArtwork({ category: 'unseen_cat', difficulty: 'advanced' })).toBe('/images/journey/diff_advanced.svg')
      expect(getFallbackArtwork(null)).toBe('/images/journey/practice_adaptive.svg')
    })

    it('deriveArtworkPromptSpec extracts sanitized scenario metadata without sensitive fields', () => {
      const spec = deriveArtworkPromptSpec(CORE_MISSIONS[0])
      expect(spec.mission_id).toBe('m01')
      expect(spec.category).toBe('phishing_advance_fee')
      expect(spec.threat_type.toLowerCase()).toContain('scholarship')
      expect(spec.character).toContain('Sufian')
      expect(spec.style_guide).toContain('Futuristic cybersecurity')
      expect(spec.password).toBeUndefined()
      expect(spec.url).toBeUndefined()
    })

    it('all module artwork assets (M1-M5) are mapped to valid vector files', () => {
      expect(MODULE_ARTWORK_MAP.m1).toBe('/images/journey/m1_link_scanner.svg')
      expect(MODULE_ARTWORK_MAP.m2).toBe('/images/journey/m2_password_vault.svg')
      expect(MODULE_ARTWORK_MAP.m3).toBe('/images/journey/m3_incident_dossier.svg')
      expect(MODULE_ARTWORK_MAP.m4).toBe('/images/journey/m4_security_scanner.svg')
      expect(MODULE_ARTWORK_MAP.m5).toBe('/images/journey/m5_academy_matrix.svg')
    })
  })

  describe('12. Cyber Hero Journey Hardening & Regression Verification', () => {
    it('exhausts all 6 practice templates before repeating any scenario', () => {
      resetJourneyProgress()
      const generated = []
      for (let i = 0; i < 6; i++) {
        const m = addAdaptiveMission()
        generated.push(m)
      }

      // Must have produced all 6 distinct practice templates (p01 to p06)
      const baseIds = generated.map((m) => m.base_template_id).sort()
      expect(baseIds).toEqual(['p01', 'p02', 'p03', 'p04', 'p05', 'p06'])

      // Every mission must maintain 100% template field integrity
      for (const m of generated) {
        const tmpl = PRACTICE_TEMPLATES.find((p) => p.id === m.base_template_id)
        expect(m.title_key).toBe(tmpl.title_key)
        expect(m.story_key).toBe(tmpl.story_key)
        expect(m.category).toBe(tmpl.category)
        expect(m.difficulty).toBe(tmpl.difficulty)
        expect(m.choices.length).toBe(tmpl.choices.length)
        expect(m.correct_choice).toBe(tmpl.correct_choice)
        expect(m.debrief_rules).toEqual(tmpl.debrief_rules)
      }
    })

    it('practice missions receive matching artwork and specific alt text, never generic matrix', () => {
      const p01 = generateOfflineMission({ index: 0, category: 'fake_job_offers' })
      expect(p01.base_template_id).toBe('p01')
      expect(getFallbackArtwork(p01)).toBe('/images/journey/p01_fake_job.svg')
      expect(getFallbackArtwork(p01)).not.toBe('/images/journey/m01_scholarship_phishing.svg')
      expect(getArtworkAltKey(p01)).toBe('journey.p01.artwork_alt')
      expect(getArtworkAltKey(p01)).not.toBe('journey.practice.artwork_alt')

      const p03 = generateOfflineMission({ index: 2, category: 'suspicious_links' })
      expect(getFallbackArtwork(p03)).toBe('/images/journey/p03_qr_phishing.svg')
      expect(getArtworkAltKey(p03)).toBe('journey.p03.artwork_alt')
    })

    it('enforces agreed XP rules across campaign and practice missions', () => {
      // Beginner = 100, Intermediate = 150, Advanced = 200
      const m01 = CORE_MISSIONS.find((m) => m.id === 'm01')
      const m02 = CORE_MISSIONS.find((m) => m.id === 'm02')
      const m03 = CORE_MISSIONS.find((m) => m.id === 'm03')
      const m04 = CORE_MISSIONS.find((m) => m.id === 'm04')

      expect(m01.xp_reward).toBe(100)
      expect(m01.difficulty).toBe('beginner')
      expect(m02.xp_reward).toBe(150)
      expect(m02.difficulty).toBe('intermediate')
      expect(m03.xp_reward).toBe(150)
      expect(m03.difficulty).toBe('intermediate')
      expect(m04.xp_reward).toBe(200)
      expect(m04.difficulty).toBe('advanced')

      // Completing all campaign missions gives exactly 600 XP
      resetJourneyProgress()
      evaluateChoice('m01', m01.correct_choice)
      expect(getJourneyProgress().totalXp).toBe(100)
      expect(getRank(getJourneyProgress().totalXp).key).toBe('defender')

      evaluateChoice('m02', m02.correct_choice)
      expect(getJourneyProgress().totalXp).toBe(250)
      expect(getRank(getJourneyProgress().totalXp).key).toBe('guardian')

      evaluateChoice('m03', m03.correct_choice)
      expect(getJourneyProgress().totalXp).toBe(400)
      expect(getRank(getJourneyProgress().totalXp).key).toBe('guardian')

      evaluateChoice('m04', m04.correct_choice)
      expect(getJourneyProgress().totalXp).toBe(600)
      expect(getRank(getJourneyProgress().totalXp).key).toBe('champion')

      // Replay M04 awards 0 additional XP
      const replayM04 = evaluateChoice('m04', m04.correct_choice)
      expect(replayM04.awardedXp).toBe(0)
      expect(replayM04.newlyCompleted).toBe(false)
      expect(getJourneyProgress().totalXp).toBe(600)
    })

    it('safe migration preserves existing progress and updates schemaVersion', () => {
      const v1Progress = {
        completedMissions: {
          m01: { completed: true, stars: 3 },
          m04: { completed: true, stars: 3 },
        },
        totalXp: 300,
        badges: ['badge_scholarship_shield', 'badge_malware_sentinel'],
        activeMissionId: 'm04',
      }

      const mockStorage = new Map()
      mockStorage.set(JOURNEY_STORAGE_KEY, JSON.stringify(v1Progress))
      const prevStorage = globalThis.localStorage
      globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
      }

      try {
        const migrated = getJourneyProgress()
        expect(migrated.schemaVersion).toBe(2)
        // 100 (m01) + 200 (m04) = 300 XP
        expect(migrated.totalXp).toBe(300)
        expect(migrated.completedMissions.m01.completed).toBe(true)
        expect(migrated.completedMissions.m04.completed).toBe(true)
        expect(migrated.badges).toEqual(['badge_scholarship_shield', 'badge_malware_sentinel'])
      } finally {
        globalThis.localStorage = prevStorage
      }
    })

    it('campaign missions and practice missions remain distinct in progress model and UI', () => {
      resetJourneyProgress()
      const p1 = addAdaptiveMission()
      const p2 = addAdaptiveMission()

      const all = getAllMissions()
      const campaign = all.filter((m) => ['m01', 'm02', 'm03', 'm04'].includes(m.id))
      const practice = all.filter((m) => !['m01', 'm02', 'm03', 'm04'].includes(m.id))

      expect(campaign.length).toBe(4)
      expect(practice.length).toBe(2)

      evaluateChoice('m01', CORE_MISSIONS[0].correct_choice)
      evaluateChoice(p1.id, p1.correct_choice)

      const prog = getJourneyProgress()
      expect(prog.completedMissions.m01.completed).toBe(true)
      expect(prog.completedMissions[p1.id].completed).toBe(true)
      expect(prog.completedMissions.m02).toBeUndefined()
      expect(prog.completedMissions[p2.id]).toBeUndefined()
    })

    it('Req 1 & 2: rotates through all 6 practice templates across two full cycles without premature repeats', () => {
      resetJourneyProgress()

      // Cycle 1: missions 1 to 6
      const cycle1 = []
      for (let i = 0; i < 6; i++) {
        const m = addAdaptiveMission()
        cycle1.push(m)
      }
      const cycle1BaseIds = cycle1.map((m) => m.base_template_id)
      expect(new Set(cycle1BaseIds).size).toBe(6)
      expect(cycle1BaseIds).toEqual(['p01', 'p02', 'p03', 'p04', 'p05', 'p06'])

      // Cycle 2: missions 7 to 12
      const cycle2 = []
      for (let i = 0; i < 6; i++) {
        const m = addAdaptiveMission()
        cycle2.push(m)
      }
      const cycle2BaseIds = cycle2.map((m) => m.base_template_id)
      expect(new Set(cycle2BaseIds).size).toBe(6)
      expect(cycle2BaseIds).toEqual(['p01', 'p02', 'p03', 'p04', 'p05', 'p06'])

      // Consecutive duplicate avoidance across rotation boundary
      const lastOfCycle1 = cycle1[cycle1.length - 1].base_template_id
      const firstOfCycle2 = cycle2[0].base_template_id
      expect(firstOfCycle2).not.toBe(lastOfCycle1)

      // Total generated missions must equal 12 with 12 unique IDs
      const allGen = getJourneyProgress().generatedMissions
      expect(allGen.length).toBe(12)
      const allGenIds = new Set(allGen.map((m) => m.id))
      expect(allGenIds.size).toBe(12)
    })

    it('Req 3: accurately resolves generated IDs and legacy IDs to base template IDs without confusing with campaign missions', () => {
      // Direct practice IDs
      expect(resolvePracticeTemplateId('p01')).toBe('p01')
      expect(resolvePracticeTemplateId('p06')).toBe('p06')

      // Campaign missions MUST return null from practice resolver
      expect(resolvePracticeTemplateId('m01')).toBeNull()
      expect(resolvePracticeTemplateId('m02')).toBeNull()
      expect(resolvePracticeTemplateId('m03')).toBeNull()
      expect(resolvePracticeTemplateId('m04')).toBeNull()

      // Modern generated mission IDs
      expect(resolvePracticeTemplateId('gen_m_p01_fake_job_offers')).toBe('p01')
      expect(resolvePracticeTemplateId('gen_m_p03_suspicious_links')).toBe('p03')
      expect(resolvePracticeTemplateId('gen_m_p06_malicious_apk_telegram')).toBe('p06')

      // Legacy generated mission IDs (e.g. gen_m01_fake_job_offers_beginner)
      expect(resolvePracticeTemplateId('gen_m01_fake_job_offers_beginner')).toBe('p01')
      expect(resolvePracticeTemplateId('gen_m02_suspicious_links_beginner')).toBe('p03')

      // Object formats
      expect(resolvePracticeTemplateId({ id: 'gen_m_p05_v2', base_template_id: 'p05' })).toBe('p05')
      expect(resolvePracticeTemplateId({ id: 'gen_m_custom', category: 'password_safety' })).toBe('p02')

      // Artwork manager unified resolver
      expect(resolveMissionTemplateId('m01')).toBe('m01')
      expect(resolveMissionTemplateId('gen_m_p01_fake_job_offers')).toBe('p01')
      expect(resolveMissionTemplateId('gen_m01_fake_job_offers_beginner')).toBe('p01')
      expect(resolveMissionTemplateId('gen_m_p06_malicious_apk_telegram')).toBe('p06')
      expect(resolveMissionTemplateId('m04')).toBe('m04')
    })

    it('Req 4: practice templates P01-P06 consistently resolve to approved artwork and alt text', () => {
      // P01 Fake Job Offer
      const p01Gen = { id: 'gen_m_p01_fake_job_offers', base_template_id: 'p01', category: 'fake_job_offers' }
      expect(getFallbackArtwork(p01Gen)).toBe('/images/journey/p01_fake_job.svg')
      expect(getFallbackArtwork(p01Gen)).not.toBe('/images/journey/m01_scholarship_phishing.svg')
      expect(getArtworkAltKey(p01Gen)).toBe('journey.p01.artwork_alt')

      // P02 Password Sync
      const p02Gen = { id: 'gen_m_p02_password_safety', base_template_id: 'p02', category: 'password_safety' }
      expect(getFallbackArtwork(p02Gen)).toBe('/images/journey/p02_password_sync.svg')
      expect(getArtworkAltKey(p02Gen)).toBe('journey.p02.artwork_alt')

      // P03 QR Phishing
      const p03Gen = { id: 'gen_m_p03_suspicious_links', base_template_id: 'p03', category: 'suspicious_links' }
      expect(getFallbackArtwork(p03Gen)).toBe('/images/journey/p03_qr_phishing.svg')
      expect(getArtworkAltKey(p03Gen)).toBe('journey.p03.artwork_alt')

      // P04 Social Transfer
      const p04Gen = { id: 'gen_m_p04_social_engineering', base_template_id: 'p04', category: 'social_engineering' }
      expect(getFallbackArtwork(p04Gen)).toBe('/images/journey/p04_social_transfer.svg')
      expect(getArtworkAltKey(p04Gen)).toBe('journey.p04.artwork_alt')

      // P05 Data Leak
      const p05Gen = { id: 'gen_m_p05_privacy_incident_response', base_template_id: 'p05', category: 'privacy_incident_response' }
      expect(getFallbackArtwork(p05Gen)).toBe('/images/journey/p05_data_leak.svg')
      expect(getArtworkAltKey(p05Gen)).toBe('journey.p05.artwork_alt')

      // P06 Compromised Peer (dedicated practice artwork, never M04 campaign artwork)
      const p06Gen = { id: 'gen_m_p06_malicious_apk_telegram', base_template_id: 'p06', category: 'malicious_apk_telegram' }
      expect(getFallbackArtwork(p06Gen)).toBe('/images/journey/p06_compromised_peer.svg')
      expect(getFallbackArtwork(p06Gen)).not.toBe('/images/journey/m04_malicious_apk.svg')
      expect(getArtworkAltKey(p06Gen)).toBe('journey.p06.artwork_alt')

      // Campaign M01–M04 retain their own artwork
      expect(getFallbackArtwork({ id: 'm01' })).toBe('/images/journey/m01_scholarship_phishing.svg')
      expect(getFallbackArtwork({ id: 'm02' })).toBe('/images/journey/m02_sim_upgrade.svg')
      expect(getFallbackArtwork({ id: 'm03' })).toBe('/images/journey/m03_banking_bot.svg')
      expect(getFallbackArtwork({ id: 'm04' })).toBe('/images/journey/m04_malicious_apk.svg')
    })

    it('Req 5: verifies authoritative 800 XP total for 4 campaign missions and 2 completed practice missions', () => {
      // 4 campaign missions completed: 100 + 150 + 150 + 200 = 600 XP
      // 2 practice missions completed (P01: 100 XP + P03: 100 XP) = 200 XP
      // Total authoritative earned XP = 800 XP
      const stateWith800Xp = {
        schemaVersion: 2,
        completedMissions: {
          m01: { completed: true, stars: 3 },
          m02: { completed: true, stars: 3 },
          m03: { completed: true, stars: 3 },
          m04: { completed: true, stars: 3 },
          gen_m_p01_fake_job_offers: { completed: true, stars: 3 },
          gen_m_p03_suspicious_links: { completed: true, stars: 3 },
        },
        totalXp: 800,
        badges: ['badge_scholarship_shield', 'badge_telecom_guardian', 'badge_banking_defender', 'badge_malware_sentinel', 'badge_adaptive_scout'],
        activeMissionId: 'gen_m_p03_suspicious_links',
        generatedMissions: [
          { id: 'gen_m_p01_fake_job_offers', base_template_id: 'p01', category: 'fake_job_offers', xp_reward: 100, difficulty: 'beginner' },
          { id: 'gen_m_p03_suspicious_links', base_template_id: 'p03', category: 'suspicious_links', xp_reward: 100, difficulty: 'beginner' },
        ],
      }

      const mockStorage = new Map()
      mockStorage.set(JOURNEY_STORAGE_KEY, JSON.stringify(stateWith800Xp))
      const prevStorage = globalThis.localStorage
      globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
      }

      try {
        const loaded = getJourneyProgress()
        expect(loaded.totalXp).toBe(800)
        expect(getRank(loaded.totalXp).key).toBe('champion')
        expect(Object.keys(loaded.completedMissions).length).toBe(6)
        expect(loaded.badges.length).toBe(5)
      } finally {
        globalThis.localStorage = prevStorage
      }
    })

    it('Req 6: rendering Journey component with practice missions shows clear completed count label', () => {
      const html = renderToString(
        React.createElement(Journey, {
          t: (k) => en[k] || k,
          lang: 'en',
          user: null,
        })
      )
      const cleanText = html.replace(/<!--.*?-->/g, '')
      expect(cleanText).toContain('Campaign Missions (0/4 completed)')
    })

    it('Req 10 regression: generated IDs and codes resembling MISSION_P5, MISSION_P7, MISSION_P9 do not all resolve to P01', () => {
      // Test direct string resolution
      expect(resolvePracticeTemplateId('MISSION_P5')).toBe('p05')
      expect(resolvePracticeTemplateId('MISSION_P7')).toBe('p01')
      expect(resolvePracticeTemplateId('MISSION_P9')).toBe('p03')

      // Test objects resembling legacy generated missions
      const legacyM5 = { id: 'gen_m05_fake_job_offers_beginner', code: 'MISSION_P5', category: 'fake_job_offers' }
      const legacyM7 = { id: 'gen_m07_fake_job_offers_beginner', code: 'MISSION_P7', category: 'fake_job_offers' }
      const legacyM9 = { id: 'gen_m09_fake_job_offers_beginner', code: 'MISSION_P9', category: 'fake_job_offers' }

      expect(resolvePracticeTemplateId(legacyM5)).toBe('p05')
      expect(resolvePracticeTemplateId(legacyM7)).toBe('p01')
      expect(resolvePracticeTemplateId(legacyM9)).toBe('p03')

      // Artwork and alt keys must not all resolve to P01
      expect(resolveMissionTemplateId(legacyM5)).toBe('p05')
      expect(resolveMissionTemplateId(legacyM7)).toBe('p01')
      expect(resolveMissionTemplateId(legacyM9)).toBe('p03')

      expect(getFallbackArtwork(legacyM5)).toBe('/images/journey/p05_data_leak.svg')
      expect(getFallbackArtwork(legacyM7)).toBe('/images/journey/p01_fake_job.svg')
      expect(getFallbackArtwork(legacyM9)).toBe('/images/journey/p03_qr_phishing.svg')
    })

    it('Req 10 regression: 6 consecutive generations produce all 6 distinct templates P01-P06 before repetition in generator-to-UI flow', () => {
      const prevStorage = globalThis.localStorage
      const memStore = {}
      globalThis.localStorage = {
        getItem: (k) => memStore[k] || null,
        setItem: (k, v) => { memStore[k] = String(v) },
        removeItem: (k) => { delete memStore[k] },
      }

      try {
        const generatedList = []
        for (let i = 0; i < 6; i++) {
          const m = addAdaptiveMission()
          generatedList.push(m)
          // Newly generated mission is immediately active
          expect(getJourneyProgress().activeMissionId).toBe(m.id)
        }

        // All 6 base template IDs must be unique and span P01 to P06
        const baseIds = generatedList.map((m) => m.base_template_id.toUpperCase())
        const uniqueBaseIds = new Set(baseIds)
        expect(uniqueBaseIds.size).toBe(6)
        expect(uniqueBaseIds.has('P01')).toBe(true)
        expect(uniqueBaseIds.has('P02')).toBe(true)
        expect(uniqueBaseIds.has('P03')).toBe(true)
        expect(uniqueBaseIds.has('P04')).toBe(true)
        expect(uniqueBaseIds.has('P05')).toBe(true)
        expect(uniqueBaseIds.has('P06')).toBe(true)

        // Generating a 7th mission starts cycle 2 and does not immediately repeat the 6th
        const m7 = addAdaptiveMission()
        const lastTemplateOfCycle1 = generatedList[5].base_template_id.toUpperCase()
        expect(m7.base_template_id.toUpperCase()).not.toBe(lastTemplateOfCycle1)

        // UI rendering verification: each generated mission chip displays its own distinct template title
        const html = renderToString(
          React.createElement(Journey, {
            t: (k) => en[k] || k,
            lang: 'en',
            user: null,
          })
        )
        const cleanText = html.replace(/<!--.*?-->/g, '')
        expect(cleanText).toContain('Practice 01: The Fictional Campus Job Offer')
        expect(cleanText).toContain('Practice 02: The Urgent Password Sync')
        expect(cleanText).toContain('Practice 03: The Deceptive QR Code')
        expect(cleanText).toContain('Practice 04: The Mistaken Transfer Lure')
        expect(cleanText).toContain('Practice 05: The Data Leak Lookup Trap')
        expect(cleanText).toContain('Practice 06: The Compromised Peer Message')
      } finally {
        globalThis.localStorage = prevStorage
      }
    })

    it('Req 10 regression: legacy localStorage with MISSION_P5/P7/P9 reconciles to correct base templates without progress loss', () => {
      const prevStorage = globalThis.localStorage
      const legacyState = {
        schemaVersion: 2,
        totalXp: 800,
        badges: ['badge_phishing_scout'],
        activeMissionId: 'gen_m05_fake_job_offers_beginner',
        generatedMissions: [
          { id: 'gen_m05_fake_job_offers_beginner', code: 'MISSION_P5', category: 'fake_job_offers' },
          { id: 'gen_m07_fake_job_offers_beginner', code: 'MISSION_P7', category: 'fake_job_offers' },
          { id: 'gen_m09_fake_job_offers_beginner', code: 'MISSION_P9', category: 'fake_job_offers' },
        ],
        completedMissions: {
          m01: { completed: true, stars: 3 },
          m02: { completed: true, stars: 3 },
          m03: { completed: true, stars: 3 },
          m04: { completed: true, stars: 3 },
          gen_m05_fake_job_offers_beginner: { completed: true, stars: 3 },
        },
      }
      const memStore = {
        cybershield_journey_progress: JSON.stringify(legacyState),
      }
      globalThis.localStorage = {
        getItem: (k) => memStore[k] || null,
        setItem: (k, v) => { memStore[k] = String(v) },
        removeItem: (k) => { delete memStore[k] },
      }

      try {
        const progress = getJourneyProgress()
        const missions = getAllMissions()
        const m5 = missions.find((m) => m.code === 'MISSION_P5')
        const m7 = missions.find((m) => m.code === 'MISSION_P7')
        const m9 = missions.find((m) => m.code === 'MISSION_P9')

        expect(m5.base_template_id.toLowerCase()).toBe('p05')
        expect(m5.title_key).toBe('journey.p05.title')
        expect(m5.artwork_url).toBe('/images/journey/p05_data_leak.svg')

        expect(m7.base_template_id.toLowerCase()).toBe('p01')
        expect(m7.title_key).toBe('journey.p01.title')
        expect(m7.artwork_url).toBe('/images/journey/p01_fake_job.svg')

        expect(m9.base_template_id.toLowerCase()).toBe('p03')
        expect(m9.title_key).toBe('journey.p03.title')
        expect(m9.artwork_url).toBe('/images/journey/p03_qr_phishing.svg')

        // Progress, XP, and badges preserved
        expect(progress.badges).toContain('badge_phishing_scout')
        expect(progress.completedMissions['gen_m05_fake_job_offers_beginner'].completed).toBe(true)
      } finally {
        globalThis.localStorage = prevStorage
      }
    })

    it('Req 11 regression: Practice 05 Intermediate resolves authoritatively to p05_data_leak.svg and is never overridden by difficulty, generated ID, or legacy codes', () => {
      // 1. Template definition inspection
      const p05Template = PRACTICE_TEMPLATES.find((p) => p.id === 'p05')
      expect(p05Template).toBeDefined()
      expect(p05Template.id).toBe('p05')
      expect(p05Template.base_template_id).toBe('p05')
      expect(p05Template.difficulty).toBe('intermediate')
      expect(p05Template.category).toBe('privacy_incident_response')
      expect(p05Template.artwork_url).toBe('/images/journey/p05_data_leak.svg')
      expect(p05Template.artwork_alt_key).toBe('journey.p05.artwork_alt')

      // 2. All variations of Practice 05 Intermediate resolve authoritatively to 'p05'
      const p05Variants = [
        { id: 'p05', difficulty: 'intermediate' },
        { id: 'p05', base_template_id: 'p05', difficulty: 'intermediate' },
        { id: 'gen_m_p05_privacy_incident_response', difficulty: 'intermediate' },
        { id: 'gen_m_p05_privacy_incident_response', base_template_id: 'p05', difficulty: 'intermediate' },
        { id: 'gen_m_p05_v2_privacy_incident_response', base_template_id: 'p05', difficulty: 'intermediate' },
        { id: 'gen_m_p05_v3_privacy_incident_response', base_template_id: 'P05', difficulty: 'intermediate' },
        { id: 'gen_m05_privacy_incident_response_intermediate', difficulty: 'intermediate' },
        { id: 'gen_m05_intermediate', difficulty: 'intermediate' },
        { id: 'practice-05', difficulty: 'intermediate' },
        { id: 'practice_05', difficulty: 'intermediate' },
        { code: 'MISSION_P5', difficulty: 'intermediate' },
        { code: 'PRACTICE_05', difficulty: 'intermediate' },
        { base_template_id: 'practice_05', difficulty: 'intermediate' },
        { base_template_id: 'PRACTICE_05', difficulty: 'intermediate' },
        { base_template_id: 'MISSION_P5', difficulty: 'intermediate' },
        { category: 'privacy_incident_response', difficulty: 'intermediate' },
        // Stale pre-assigned generic difficulty URL must NOT override dedicated artwork
        { id: 'gen_m_p05_stale', base_template_id: 'p05', difficulty: 'intermediate', artwork_url: '/images/journey/diff_intermediate.svg' },
      ]

      p05Variants.forEach((variant) => {
        const resolvedBaseId = resolvePracticeTemplateId(variant)
        expect(resolvedBaseId).toBe('p05')

        const resolvedMissionId = resolveMissionTemplateId(variant)
        expect(resolvedMissionId).toBe('p05')

        const artwork = getFallbackArtwork(variant)
        expect(artwork).toBe('/images/journey/p05_data_leak.svg')
        expect(artwork).not.toBe('/images/journey/diff_intermediate.svg')

        const altKey = getArtworkAltKey(variant)
        expect(altKey).toBe('journey.p05.artwork_alt')
      })

      // 3. Alt-text localization exists across en, om, am
      expect(en['journey.p05.artwork_alt']).toBeDefined()
      expect(en['journey.p05.artwork_alt']).toContain('breached database query form')
      expect(om['journey.p05.artwork_alt']).toBeDefined()
      expect(om['journey.p05.artwork_alt']).toContain('unka qorannoo daataa saaxilamee')
      expect(am['journey.p05.artwork_alt']).toBeDefined()
      expect(am['journey.p05.artwork_alt']).toContain('የተመዘበረ የመረጃ ቋት ፍተሻ ቅጽ')

      // 4. Component SSR rendering of Practice 05 Intermediate displays correct dedicated artwork
      const prevStorage = globalThis.localStorage
      const mockStorage = {
        store: {},
        getItem(key) { return this.store[key] || null },
        setItem(key, value) { this.store[key] = String(value) },
        removeItem(key) { delete this.store[key] },
        clear() { this.store = {} },
      }
      globalThis.localStorage = mockStorage

      try {
        const p05Instance = generateOfflineMission({
          index: 4,
          difficulty: 'intermediate',
          category: 'privacy_incident_response',
          excludeIds: ['p01', 'p02', 'p03', 'p04'],
        })

        expect(p05Instance.base_template_id).toBe('p05')
        expect(p05Instance.difficulty).toBe('intermediate')
        expect(p05Instance.artwork_url).toBe('/images/journey/p05_data_leak.svg')

        const progressState = {
          schemaVersion: 2,
          completedMissions: {},
          totalXp: 0,
          badges: [],
          activeMissionId: p05Instance.id,
          generatedMissions: [p05Instance],
          categoryStats: {},
          difficultyStats: {},
          recentOutcomes: [],
        }
        mockStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(progressState))

        const html = renderToString(React.createElement(Journey, { t: makeT('en') }))
        expect(html).toContain('/images/journey/p05_data_leak.svg')
        expect(html).not.toContain('/images/journey/diff_intermediate.svg')
        expect(html).toContain('breached database query form warning against secondary National ID harvesting')
      } finally {
        globalThis.localStorage = prevStorage
      }
    })

    describe('Practice Ordering and Rotation Regression Suite', () => {
      it('Req 1 & 4: guarantees strict P01->P02->P03->P04->P05->P06 rotation without premature repeat', () => {
        resetJourneyProgress()

        const expectedOrder = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06']
        const expectedCodes = ['PRACTICE_01', 'PRACTICE_02', 'PRACTICE_03', 'PRACTICE_04', 'PRACTICE_05', 'PRACTICE_06']
        const expectedDiffs = ['beginner', 'intermediate', 'beginner', 'advanced', 'intermediate', 'advanced']
        const expectedArtworks = [
          '/images/journey/p01_fake_job.svg',
          '/images/journey/p02_password_sync.svg',
          '/images/journey/p03_qr_phishing.svg',
          '/images/journey/p04_social_transfer.svg',
          '/images/journey/p05_data_leak.svg',
          '/images/journey/p06_compromised_peer.svg',
        ]

        // Cycle 1
        for (let i = 0; i < 6; i++) {
          const m = addAdaptiveMission()
          expect(m.base_template_id).toBe(expectedOrder[i])
          expect(m.code).toBe(expectedCodes[i])
          expect(m.difficulty).toBe(expectedDiffs[i])
          expect(m.artwork_url).toBe(expectedArtworks[i])
          expect(m.title_key).toBe(`journey.${expectedOrder[i]}.title`)
          expect(m.story_key).toBe(`journey.${expectedOrder[i]}.story`)
        }

        // Cycle 2 (repeat cycle with versioned codes)
        for (let i = 0; i < 6; i++) {
          const m = addAdaptiveMission()
          expect(m.base_template_id).toBe(expectedOrder[i])
          expect(m.code).toBe(`${expectedCodes[i]}_V2`)
          expect(m.difficulty).toBe(expectedDiffs[i])
          expect(m.artwork_url).toBe(expectedArtworks[i])
          expect(m.title_key).toBe(`journey.${expectedOrder[i]}.title`)
          expect(m.story_key).toBe(`journey.${expectedOrder[i]}.story`)
        }
      })

      it('Req 2 & 5: preserves multilingual content across English, Afaan Oromoo, and Amharic for all practice templates', () => {
        resetJourneyProgress()
        const missions = []
        for (let i = 0; i < 6; i++) {
          missions.push(addAdaptiveMission())
        }

        const langs = ['en', 'om', 'am']
        missions.forEach((m) => {
          langs.forEach((lang) => {
            const loc = locales[lang]
            // Title
            expect(loc[m.title_key]).toBeDefined()
            expect(typeof loc[m.title_key]).toBe('string')
            expect(loc[m.title_key].length).toBeGreaterThan(0)

            // Story / scenario content
            expect(loc[m.story_key]).toBeDefined()
            expect(typeof loc[m.story_key]).toBe('string')
            expect(loc[m.story_key].length).toBeGreaterThan(0)

            // Artwork alt-text
            expect(loc[m.artwork_alt_key]).toBeDefined()
            expect(typeof loc[m.artwork_alt_key]).toBe('string')
            expect(loc[m.artwork_alt_key].length).toBeGreaterThan(0)

            // Choices labels and feedback
            m.choices.forEach((c) => {
              expect(loc[c.label_key]).toBeDefined()
              expect(loc[c.feedback_key]).toBeDefined()
            })
          })
        })
      })

      it('Req 6: legacy progress data cannot cause mixed mission data or template mismatch', () => {
        const corruptedLegacyMissions = [
          // Corrupted with wrong category or mismatched code
          { id: 'gen_m_p02_corrupt', base_template_id: 'p02', category: 'fake_job_offers', difficulty: 'beginner', code: 'PRACTICE_01' },
          { id: 'gen_m_p05_corrupt', base_template_id: 'p05', artwork_url: '/images/journey/diff_intermediate.svg' },
        ]

        corruptedLegacyMissions.forEach((corrupt) => {
          const normalized = getAllMissions().find((m) => m.id === corrupt.id) || null
        })

        const prevStorage = globalThis.localStorage
        const mockStorage = {
          store: {},
          getItem(key) { return this.store[key] || null },
          setItem(key, value) { this.store[key] = String(value) },
          removeItem(key) { delete this.store[key] },
        }
        globalThis.localStorage = mockStorage

        try {
          const legacyState = {
            schemaVersion: 2,
            activeMissionId: 'gen_m_p02_corrupt',
            generatedMissions: corruptedLegacyMissions,
            completedMissions: {},
            totalXp: 100,
            badges: [],
          }
          mockStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(legacyState))

          const all = getAllMissions()
          const p02Mission = all.find((m) => m.id === 'gen_m_p02_corrupt')
          expect(p02Mission.base_template_id).toBe('p02')
          expect(p02Mission.category).toBe('password_safety') // restored from base
          expect(p02Mission.difficulty).toBe('intermediate') // restored from base
          expect(p02Mission.artwork_url).toBe('/images/journey/p02_password_sync.svg')
          expect(p02Mission.title_key).toBe('journey.p02.title')

          const p05Mission = all.find((m) => m.id === 'gen_m_p05_corrupt')
          expect(p05Mission.base_template_id).toBe('p05')
          expect(p05Mission.artwork_url).toBe('/images/journey/p05_data_leak.svg') // restored dedicated artwork
          expect(p05Mission.difficulty).toBe('intermediate')
        } finally {
          globalThis.localStorage = prevStorage
        }
      })

      it('Req 2 & 7: UI SSR renders correct practice title, code, and dedicated artwork for every practice template', () => {
        resetJourneyProgress()
        const missions = []
        for (let i = 0; i < 6; i++) {
          missions.push(addAdaptiveMission())
        }

        const expectedArtworks = {
          p01: '/images/journey/p01_fake_job.svg',
          p02: '/images/journey/p02_password_sync.svg',
          p03: '/images/journey/p03_qr_phishing.svg',
          p04: '/images/journey/p04_social_transfer.svg',
          p05: '/images/journey/p05_data_leak.svg',
          p06: '/images/journey/p06_compromised_peer.svg',
        }

        missions.forEach((mission) => {
          const prevStorage = globalThis.localStorage
          const mockStorage = {
            store: {},
            getItem(key) { return this.store[key] || null },
            setItem(key, value) { this.store[key] = String(value) },
            removeItem(key) { delete this.store[key] },
          }
          globalThis.localStorage = mockStorage

          try {
            const state = {
              schemaVersion: 2,
              activeMissionId: mission.id,
              generatedMissions: missions,
              completedMissions: {},
              totalXp: 0,
              badges: [],
            }
            mockStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(state))

            const html = renderToString(React.createElement(Journey, { t: makeT('en') }))

            // Verify active mission banner displays matching mission code, title, and artwork
            expect(html).toContain(mission.code)
            expect(html).toContain(en[mission.title_key])
            expect(html).toContain(expectedArtworks[mission.base_template_id])
            // Ensure no generic difficulty fallback artwork is rendered
            expect(html).not.toContain('/images/journey/diff_beginner.svg')
            expect(html).not.toContain('/images/journey/diff_intermediate.svg')
            expect(html).not.toContain('/images/journey/diff_advanced.svg')
          } finally {
            globalThis.localStorage = prevStorage
          }
        })
      })
      it('Req Issue 1 & 2: Practice 05 SVG artwork is well-formed XML and renders consistently on card and detail panel', async () => {
        // Test SVG existence and XML validity
        const fs = await import('fs')
        const path = await import('path')
        const svgPath = path.resolve('public/images/journey/p05_data_leak.svg')
        expect(fs.existsSync(svgPath)).toBe(true)
        const svgContent = fs.readFileSync(svgPath, 'utf-8')
        expect(svgContent).toContain('<svg')
        expect(svgContent).toContain('</svg>')
        expect(svgContent).toContain('&amp;')
        expect(svgContent).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/)

        // Test component rendering consistency for both card and detail panel
        resetJourneyProgress()
        const p05Instance = generateOfflineMission({
          index: 4,
          difficulty: 'intermediate',
          category: 'privacy_incident_response',
          templateId: 'p05',
        })

        const prevStorage = globalThis.localStorage
        const mockStorage = {
          store: {},
          getItem(key) { return this.store[key] || null },
          setItem(key, value) { this.store[key] = String(value) },
          removeItem(key) { delete this.store[key] },
        }
        globalThis.localStorage = mockStorage

        try {
          const state = {
            schemaVersion: 2,
            activeMissionId: p05Instance.id,
            generatedMissions: [p05Instance],
            completedMissions: {
              [p05Instance.id]: { completed: true, stars: 3 },
            },
            totalXp: 150,
            badges: ['badge_adaptive_scout'],
          }
          mockStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(state))

          const html = renderToString(React.createElement(Journey, { t: makeT('en') }))

          // Both detail banner and card thumbnail render the dedicated p05_data_leak.svg
          expect(html).toContain('src="/images/journey/p05_data_leak.svg"')
          expect(html).toContain('mission-chip-thumb-img')
          expect(html).toContain('mission-artwork-img')
          expect(html).not.toContain('/images/journey/diff_intermediate.svg')

          // Completed progress status is preserved
          expect(html).toContain('status-badge-complete')
        } finally {
          globalThis.localStorage = prevStorage
        }
      })

      it('Req Issue 2: sortPracticeMissions restores canonical P01..P06 order across multiple rotation cycles including versioned IDs', () => {
        const unorderedMissions = [
          { id: 'gen_m_p03_v2_suspicious_links', code: 'PRACTICE_03_V2', base_template_id: 'p03' },
          { id: 'gen_m_p05_privacy_incident_response', code: 'PRACTICE_05', base_template_id: 'p05' },
          { id: 'gen_m_p01_v2_fake_job_offers', code: 'PRACTICE_01_V2', base_template_id: 'p01' },
          { id: 'gen_m_p02_password_safety', code: 'PRACTICE_02', base_template_id: 'p02' },
          { id: 'gen_m_p06_compromised_peer', code: 'PRACTICE_06', base_template_id: 'p06' },
          { id: 'gen_m_p01_fake_job_offers', code: 'PRACTICE_01', base_template_id: 'p01' },
          { id: 'gen_m_p05_v2_privacy_incident_response', code: 'PRACTICE_05_V2', base_template_id: 'p05' },
          { id: 'gen_m_p04_social_transfer', code: 'PRACTICE_04', base_template_id: 'p04' },
          { id: 'gen_m_p03_suspicious_links', code: 'PRACTICE_03', base_template_id: 'p03' },
        ]

        const prevStorage = globalThis.localStorage
        const mockStorage = {
          store: {},
          getItem(key) { return this.store[key] || null },
          setItem(key, value) { this.store[key] = String(value) },
          removeItem(key) { delete this.store[key] },
        }
        globalThis.localStorage = mockStorage

        try {
          const state = {
            schemaVersion: 2,
            activeMissionId: 'gen_m_p01_fake_job_offers',
            generatedMissions: unorderedMissions,
            completedMissions: {
              gen_m_p05_v2_privacy_incident_response: { completed: true, stars: 3 },
            },
            totalXp: 500,
            badges: [],
          }
          mockStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(state))

          const all = getAllMissions()
          const practice = all.filter((m) => !['m01', 'm02', 'm03', 'm04'].includes(m.id))

          // Canonical sequence:
          // Cycle 1: P01, P02, P03, P04, P05, P06
          // Cycle 2: P01_V2, P03_V2, P05_V2
          const codes = practice.map((m) => m.code)
          expect(codes).toEqual([
            'PRACTICE_01',
            'PRACTICE_02',
            'PRACTICE_03',
            'PRACTICE_04',
            'PRACTICE_05',
            'PRACTICE_06',
            'PRACTICE_01_V2',
            'PRACTICE_03_V2',
            'PRACTICE_05_V2',
          ])

          // Progress on PRACTICE_05_V2 is preserved
          expect(isMissionCompleted('gen_m_p05_v2_privacy_incident_response')).toBe(true)

          // Data consistency: PRACTICE_05_V2 has correct template attributes and artwork
          const p05v2 = practice.find((m) => m.code === 'PRACTICE_05_V2')
          expect(p05v2.base_template_id).toBe('p05')
          expect(p05v2.category).toBe('privacy_incident_response')
          expect(p05v2.difficulty).toBe('intermediate')
          expect(p05v2.artwork_url).toBe('/images/journey/p05_data_leak.svg')
          expect(p05v2.title_key).toBe('journey.p05.title')
        } finally {
          globalThis.localStorage = prevStorage
        }
      })
    })

    describe('13. Phase 2 Cyber Hero Journey & Practice Missions QA Suite', () => {
      it('Phase 2 QA: replay outcome copy does not falsely claim 150 XP on 100 XP or 200 XP missions', () => {
        // Enforce that replay_already_awarded does not hardcode '150 XP'
        expect(en['journey.replay_already_awarded']).not.toContain('150 XP')
        expect(om['journey.replay_already_awarded']).not.toContain('150')
        expect(am['journey.replay_already_awarded']).not.toContain('150')

        // Test replay on M01 (100 XP)
        resetJourneyProgress()
        evaluateChoice('m01', CORE_MISSIONS[0].correct_choice)
        const replayM01 = evaluateChoice('m01', CORE_MISSIONS[0].correct_choice)
        expect(replayM01.isCorrect).toBe(true)
        expect(replayM01.newlyCompleted).toBe(false)
        expect(replayM01.awardedXp).toBe(0)
        expect(getJourneyProgress().totalXp).toBe(100)

        // Test replay on M04 (200 XP)
        evaluateChoice('m04', CORE_MISSIONS[3].correct_choice)
        const replayM04 = evaluateChoice('m04', CORE_MISSIONS[3].correct_choice)
        expect(replayM04.isCorrect).toBe(true)
        expect(replayM04.newlyCompleted).toBe(false)
        expect(replayM04.awardedXp).toBe(0)
        expect(getJourneyProgress().totalXp).toBe(300)
      })

      it('Phase 2 QA: reconcileProgressIntegrity reconciles missing badges for completed missions', () => {
        const stateWithoutBadges = {
          schemaVersion: 2,
          completedMissions: {
            m01: { completed: true, stars: 3 },
            m02: { completed: true, stars: 3 },
          },
          totalXp: 250,
          badges: [], // empty badges list
          activeMissionId: 'm02',
        }

        const reconciled = getJourneyProgress()
        const restored = (typeof window !== 'undefined' && window.localStorage)
          ? null
          : null

        const mockStorage = new Map()
        mockStorage.set(JOURNEY_STORAGE_KEY, JSON.stringify(stateWithoutBadges))
        const prevStorage = globalThis.localStorage
        globalThis.localStorage = {
          getItem: (k) => mockStorage.get(k) || null,
          setItem: (k, v) => mockStorage.set(k, String(v)),
          removeItem: (k) => mockStorage.delete(k),
        }

        try {
          const loaded = getJourneyProgress()
          expect(loaded.totalXp).toBe(250)
          expect(loaded.badges).toContain('badge_scholarship_shield')
          expect(loaded.badges).toContain('badge_telecom_guardian')
        } finally {
          globalThis.localStorage = prevStorage
        }
      })

      it('Phase 2 QA: practice missions can be generated by explicit difficulty tier (Beginner, Intermediate, Advanced)', () => {
        resetJourneyProgress()

        const beg = addAdaptiveMission({ difficulty: 'beginner' })
        expect(beg.difficulty).toBe('beginner')
        expect(beg.xp_reward).toBe(100)

        const mid = addAdaptiveMission({ difficulty: 'intermediate' })
        expect(mid.difficulty).toBe('intermediate')
        expect(mid.xp_reward).toBe(150)

        const adv = addAdaptiveMission({ difficulty: 'advanced' })
        expect(adv.difficulty).toBe('advanced')
        expect(adv.xp_reward).toBe(200)

        const all = getAllMissions()
        const practice = all.filter((m) => !['m01', 'm02', 'm03', 'm04'].includes(m.id))
        expect(practice.length).toBe(3)
        expect(practice.some((m) => m.difficulty === 'beginner')).toBe(true)
        expect(practice.some((m) => m.difficulty === 'intermediate')).toBe(true)
        expect(practice.some((m) => m.difficulty === 'advanced')).toBe(true)
      })

      it('Phase 2 QA: incorrect answers across all practice missions never award XP, badges, or mark completed', () => {
        for (const tmpl of PRACTICE_TEMPLATES) {
          resetJourneyProgress()
          const mission = addAdaptiveMission({ templateId: tmpl.id })

          for (const trapId of mission.trap_choices) {
            const trapRes = evaluateChoice(mission.id, trapId)
            expect(trapRes.isCorrect).toBe(false)
            expect(trapRes.isTrap).toBe(true)
            expect(trapRes.newlyCompleted).toBe(false)
            expect(trapRes.awardedXp).toBe(0)

            const progress = getJourneyProgress()
            expect(progress.totalXp).toBe(0)
            expect(progress.badges).toEqual([])
            expect(isMissionCompleted(mission.id)).toBe(false)
          }

          // Then execute correct choice and verify success
          const correctRes = evaluateChoice(mission.id, mission.correct_choice)
          expect(correctRes.isCorrect).toBe(true)
          expect(correctRes.newlyCompleted).toBe(true)
          expect(correctRes.awardedXp).toBe(mission.xp_reward)
          expect(isMissionCompleted(mission.id)).toBe(true)
        }
      })

      it('Phase 2 QA: Journey component renders difficulty tier launch buttons and filter chips in SSR', () => {
        resetJourneyProgress()
        addAdaptiveMission({ difficulty: 'beginner' })

        for (const lang of ['en', 'om', 'am']) {
          const t = makeT(lang)
          const html = renderToString(React.createElement(Journey, { t, lang, user: null }))

          // Must render practice filter chips
          expect(html).toContain('practice-filter-chips')
          expect(html).toContain('practice-filter-chip')

          // Must render practice mission chip
          expect(html).toContain('mission-chip-practice')
        }
      })
    })
  })
})



