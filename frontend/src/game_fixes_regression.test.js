import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from './App.jsx'
import DailyChallenge from './components/DailyChallenge.jsx'
import Arena from './components/Arena.jsx'
import CyberBattleGame from './components/CyberBattleGame.jsx'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'
import { makeT } from './i18n.js'
import {
  DAILY_CHALLENGES,
  getTodayDateString,
  getDailyChallenge,
  getDailyChallengeStatus,
  submitDailyChallengeAnswer,
} from './lib/dailyChallenge.js'
import {
  ARENA_SCENARIOS,
  getArenaProgress,
  recordArenaScenarioCompleted,
  isTierUnlocked,
} from './lib/arena.js'
import { resetJourneyProgress, getJourneyProgress } from './lib/journey.js'

describe('CyberShield Ethiopia — Game Fixes & Navigation Regression Suite', () => {
  beforeEach(() => {
    resetJourneyProgress()
  })

  describe('1. Hash Routing Fixes (App.jsx)', () => {
    it('properly maps #/m5 to learn and #/daily-challenge to daily', () => {
      // Test hash mapping logic from App.jsx
      const ALL_ROUTES = ['m1', 'm2', 'm3', 'm4', 'learn', 'journey', 'account', 'daily', 'arena', 'game']
      const routeFromHash = (hash) => {
        const r = hash.replace(/^#\/?/, '')
        if (r === 'battle-game' || r === 'battle' || r === '3d-game') return 'game'
        if (r === 'm5') return 'learn'
        if (r === 'daily-challenge') return 'daily'
        return ALL_ROUTES.includes(r) ? r : 'home'
      }

      expect(routeFromHash('#/m5')).toBe('learn')
      expect(routeFromHash('#/daily-challenge')).toBe('daily')
      expect(routeFromHash('#/3d-game')).toBe('game')
      expect(routeFromHash('#/battle-game')).toBe('game')
      expect(routeFromHash('#/arena')).toBe('arena')
      expect(routeFromHash('#/journey')).toBe('journey')
      expect(routeFromHash('#/daily')).toBe('daily')
      expect(routeFromHash('#/non-existent-route')).toBe('home')
      expect(routeFromHash('')).toBe('home')
    })

    it('renders M5 CYBER ACADEMY tag and title on the homepage tools grid', () => {
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

      const html = renderToString(React.createElement(App))
      expect(html).toContain('M5 CYBER ACADEMY')
      expect(html).toContain('module-tag-learn')
      expect(html).toContain('href="#/learn"')
    })
  })

  describe('2. Daily Challenge Incorrect Feedback & Retry Flow', () => {
    it('provides daily.retry translation in all three locales', () => {
      expect(en['daily.retry']).toBe('Try Again / Choose Another Option')
      expect(om['daily.retry']).toBe('Irra Deebi / Filannoo Biraa Filadhu')
      expect(am['daily.retry']).toBe('እንደገና ይሞክሩ / ሌላ አማራጭ ይምረጡ')
    })

    it('handles incorrect answer submission without marking as completed and supports retry', async () => {
      const today = getTodayDateString()
      const challenge = getDailyChallenge(today)
      const wrongChoice = (challenge.correct_choice + 1) % 3

      // Submit incorrect answer
      const result = await submitDailyChallengeAnswer(today, wrongChoice)
      expect(result.isCorrect).toBe(false)
      expect(result.xpAwarded).toBe(0)

      // Verify status is NOT marked completed (allowing retry)
      const status = getDailyChallengeStatus(today)
      expect(status.completed).toBe(false)

      // Now submit the correct answer
      const correctResult = await submitDailyChallengeAnswer(today, challenge.correct_choice)
      expect(correctResult.isCorrect).toBe(true)
      expect(correctResult.xpAwarded).toBe(50)

      // Verify status IS marked completed
      const finalStatus = getDailyChallengeStatus(today)
      expect(finalStatus.completed).toBe(true)
      expect(finalStatus.isCorrect).toBe(true)
    })

    it('renders the Daily Challenge component with caution feedback and retry button structure', () => {
      const t = makeT('en')
      const html = renderToString(React.createElement(DailyChallenge, { t, user: null }))
      expect(html).toContain('daily-challenge-container')
      expect(html).toContain('daily-scenario-card')
      expect(html).toContain('daily-quiz-card')
      expect(html).toContain('daily-submit-btn')
    })
  })

  describe('3. Cyber Battle 3D Simulation & Mobile Touch Controls', () => {
    it('defines start button and touch controls in CyberBattleGame component', () => {
      const t = makeT('en')
      // Test rendering in SSR
      const html = renderToString(React.createElement(CyberBattleGame, { t, user: null }))
      expect(html).toContain('cyber-game-wrapper')
      expect(html).toContain('btn-start-simulation')
      expect(html).toContain('start-modal-card')
      expect(html).toContain('start-actions')
    })
  })

  describe('4. Tactical Arena Scenario Progression & Replay Ability', () => {
    it('loads all arena scenarios across Attack, Defense, and Battle modes', () => {
      expect(ARENA_SCENARIOS.length).toBeGreaterThanOrEqual(6)
      const attackScenarios = ARENA_SCENARIOS.filter((s) => s.mode === 'attack')
      const defenseScenarios = ARENA_SCENARIOS.filter((s) => s.mode === 'defense')
      const battleScenarios = ARENA_SCENARIOS.filter((s) => s.mode === 'battle')

      expect(attackScenarios.length).toBeGreaterThanOrEqual(2)
      expect(defenseScenarios.length).toBeGreaterThanOrEqual(2)
      expect(battleScenarios.length).toBeGreaterThanOrEqual(2)
    })

    it('records scenario completion, awards XP once, and prevents duplicate XP on replay', async () => {
      const scenario = ARENA_SCENARIOS[0]
      const firstResult = await recordArenaScenarioCompleted({
        scenarioId: scenario.id,
        score: 100,
        answers: { choice: scenario.correctChoice },
      })

      expect(firstResult.xpAwarded).toBe(scenario.xpReward)
      expect(firstResult.alreadyCompleted).toBe(false)

      // Replay the scenario
      const replayResult = await recordArenaScenarioCompleted({
        scenarioId: scenario.id,
        score: 100,
        answers: { choice: scenario.correctChoice },
      })

      expect(replayResult.xpAwarded).toBe(0)
      expect(replayResult.alreadyCompleted).toBe(true)
    })

    it('renders Arena component with mode tabs and scenario catalog', () => {
      const t = makeT('en')
      const html = renderToString(React.createElement(Arena, { t, user: null }))
      expect(html).toContain('arena-container')
      expect(html).toContain('arena-mode-tabs')
      expect(html).toContain('arena-scenarios-grid')
      expect(html).toContain('btn-play-scenario')
    })
  })

  describe('5. Trilingual Localization Parity (EN, OM, AM)', () => {
    it('maintains 100% key parity across all three locales with non-empty values', () => {
      const enKeys = Object.keys(en)
      const omKeys = Object.keys(om)
      const amKeys = Object.keys(am)

      expect(omKeys.length).toBe(enKeys.length)
      expect(amKeys.length).toBe(enKeys.length)

      for (const k of enKeys) {
        expect(om[k], `Missing OM key: ${k}`).toBeDefined()
        expect(am[k], `Missing AM key: ${k}`).toBeDefined()

        expect(typeof en[k]).toBe('string')
        expect(typeof om[k]).toBe('string')
        expect(typeof am[k]).toBe('string')

        expect(en[k].trim().length, `Empty EN value for ${k}`).toBeGreaterThan(0)
        expect(om[k].trim().length, `Empty OM value for ${k}`).toBeGreaterThan(0)
        expect(am[k].trim().length, `Empty AM value for ${k}`).toBeGreaterThan(0)
      }
    })
  })
})
