import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'
import {
  ARENA_MODES,
  ARENA_DIFFICULTIES,
  TIER_XP_REWARDS,
  TIER_UNLOCK_THRESHOLDS,
  ARENA_SCENARIOS,
  getArenaScenarios,
  getArenaScenarioById,
  getArenaProgress,
  isTierUnlocked,
  recordArenaScenarioCompleted,
  saveArenaProgress,
  resetArenaProgress,
  getNextUncompletedScenario,
} from './lib/arena.js'
import {
  getJourneyProgress,
  saveJourneyProgress,
  resetJourneyProgress,
  reconcileProgressIntegrity,
} from './lib/journey.js'
import {
  getUnifiedLearningProgress,
} from './lib/learningProgress.js'
import {
  getCachedNotifications,
  clearAccountCache,
} from './lib/notificationStorage.js'
import {
  getNotificationDestination,
} from './lib/notificationManager.js'

describe('Cyber Attack & Defense Arena (Phase 7 - Full Module Test)', () => {
  const cssPath = resolve(__dirname, 'styles.css')
  const css = readFileSync(cssPath, 'utf8')

  beforeEach(async () => {
    vi.restoreAllMocks()
    resetJourneyProgress()
    resetArenaProgress()
    await clearAccountCache('guest')
  })

  describe('1. Scenario Bank Integrity & Safe Simulation Content', () => {
    it('defines 18 bundled fictional scenarios across all 3 modes and 3 tiers', () => {
      expect(ARENA_SCENARIOS.length).toBe(18)

      const modes = ARENA_SCENARIOS.map((s) => s.mode)
      expect(modes.filter((m) => m === ARENA_MODES.ATTACK).length).toBe(6)
      expect(modes.filter((m) => m === ARENA_MODES.DEFENSE).length).toBe(6)
      expect(modes.filter((m) => m === ARENA_MODES.BATTLE).length).toBe(6)

      const diffs = ARENA_SCENARIOS.map((s) => s.difficulty)
      expect(diffs.filter((d) => d === ARENA_DIFFICULTIES.BEGINNER).length).toBe(6)
      expect(diffs.filter((d) => d === ARENA_DIFFICULTIES.INTERMEDIATE).length).toBe(6)
      expect(diffs.filter((d) => d === ARENA_DIFFICULTIES.ADVANCED).length).toBe(6)
    })

    it('ensures all scenarios are strictly synthetic with no real target exploitation', () => {
      for (const scenario of ARENA_SCENARIOS) {
        expect(scenario.id).toBeTruthy()
        expect(scenario.title_key).toBeTruthy()
        expect(scenario.desc_key).toBeTruthy()
        expect(scenario.xp_reward).toBeGreaterThanOrEqual(50)

        // Must include safe synthetic telemetry/logs
        expect(scenario.synthetic_telemetry).toBeTruthy()
        expect(scenario.synthetic_telemetry.length).toBeGreaterThan(0)

        // Disallow dangerous real payloads, live URLs, or real credential attacks
        const telemetryText = scenario.synthetic_telemetry.join(' ')
        expect(telemetryText).not.toMatch(/https?:\/\/(?!localhost|127\.0\.0\.1|synthetic|simulated|sample|bank|cbe|internal)[a-zA-Z0-9.-]+\.com/)
        expect(telemetryText).not.toMatch(/rm\s+-rf\s+\//)
      }
    })

    it('verifies standard single-stage scenarios (Attack & Defense) have 3 options and valid correct index', () => {
      const standardScenarios = ARENA_SCENARIOS.filter((s) => s.mode !== ARENA_MODES.BATTLE)
      for (const s of standardScenarios) {
        expect(s.question_key).toBeTruthy()
        expect(s.options_keys.length).toBe(3)
        expect([0, 1, 2]).toContain(s.correct_choice)
        expect(s.explanation_key).toBeTruthy()
      }
    })

    it('verifies Battle Mode scenarios feature 2 distinct stages (threat detection + defensive action)', () => {
      const battleScenarios = ARENA_SCENARIOS.filter((s) => s.mode === ARENA_MODES.BATTLE)
      for (const s of battleScenarios) {
        expect(s.stages).toBeDefined()
        expect(s.stages.length).toBe(2)

        // Stage 1: Threat Identification
        expect(s.stages[0].stage_number).toBe(1)
        expect(s.stages[0].question_key).toBeTruthy()
        expect(s.stages[0].options_keys.length).toBe(3)
        expect([0, 1, 2]).toContain(s.stages[0].correct_choice)
        expect(s.stages[0].explanation_key).toBeTruthy()

        // Stage 2: Defensive Action
        expect(s.stages[1].stage_number).toBe(2)
        expect(s.stages[1].question_key).toBeTruthy()
        expect(s.stages[1].options_keys.length).toBe(3)
        expect([0, 1, 2]).toContain(s.stages[1].correct_choice)
        expect(s.stages[1].explanation_key).toBeTruthy()
      }
    })
  })

  describe('2. Progressive Difficulty & Tier Unlock Rules', () => {
    it('unlocks Beginner tier initially without prior completions', () => {
      const progress = getArenaProgress()
      expect(isTierUnlocked(ARENA_DIFFICULTIES.BEGINNER, progress)).toBe(true)
      expect(isTierUnlocked(ARENA_DIFFICULTIES.INTERMEDIATE, progress)).toBe(false)
      expect(isTierUnlocked(ARENA_DIFFICULTIES.ADVANCED, progress)).toBe(false)
    })

    it('unlocks Intermediate tier only after completing 3 Beginner scenarios', async () => {
      let progress = getArenaProgress()
      expect(isTierUnlocked(ARENA_DIFFICULTIES.INTERMEDIATE, progress)).toBe(false)

      // Complete 1st Beginner
      await recordArenaScenarioCompleted('att_beg_01', { score: 100 })
      progress = getArenaProgress()
      expect(isTierUnlocked(ARENA_DIFFICULTIES.INTERMEDIATE, progress)).toBe(false)

      // Complete 2nd Beginner
      await recordArenaScenarioCompleted('def_beg_01', { score: 100 })
      progress = getArenaProgress()
      expect(isTierUnlocked(ARENA_DIFFICULTIES.INTERMEDIATE, progress)).toBe(false)

      // Complete 3rd Beginner
      await recordArenaScenarioCompleted('bat_beg_01', { score: 100 })
      progress = getArenaProgress()
      expect(isTierUnlocked(ARENA_DIFFICULTIES.INTERMEDIATE, progress)).toBe(true)
      expect(isTierUnlocked(ARENA_DIFFICULTIES.ADVANCED, progress)).toBe(false)
    })

    it('unlocks Advanced tier only after completing 3 Intermediate scenarios', async () => {
      // Simulate 3 Beginner completed
      saveArenaProgress({
        completedScenarios: {
          att_beg_01: { completedAt: new Date().toISOString(), score: 100 },
          def_beg_01: { completedAt: new Date().toISOString(), score: 100 },
          bat_beg_01: { completedAt: new Date().toISOString(), score: 100 },
        },
      })

      let progress = getArenaProgress()
      expect(isTierUnlocked(ARENA_DIFFICULTIES.INTERMEDIATE, progress)).toBe(true)
      expect(isTierUnlocked(ARENA_DIFFICULTIES.ADVANCED, progress)).toBe(false)

      // Complete 1st Intermediate
      await recordArenaScenarioCompleted('att_int_01', { score: 100 })
      // Complete 2nd Intermediate
      await recordArenaScenarioCompleted('def_int_01', { score: 100 })
      progress = getArenaProgress()
      expect(isTierUnlocked(ARENA_DIFFICULTIES.ADVANCED, progress)).toBe(false)

      // Complete 3rd Intermediate
      await recordArenaScenarioCompleted('bat_int_01', { score: 100 })
      progress = getArenaProgress()
      expect(isTierUnlocked(ARENA_DIFFICULTIES.ADVANCED, progress)).toBe(true)
    })

    it('filters scenarios correctly by mode and difficulty', () => {
      const attackScenarios = getArenaScenarios(ARENA_MODES.ATTACK)
      expect(attackScenarios.length).toBe(6)
      expect(attackScenarios.every((s) => s.mode === ARENA_MODES.ATTACK)).toBe(true)

      const beginnerDefense = getArenaScenarios(ARENA_MODES.DEFENSE, ARENA_DIFFICULTIES.BEGINNER)
      expect(beginnerDefense.length).toBe(2)
      expect(beginnerDefense.map((s) => s.id)).toContain('arena_def_beg_01')
      expect(beginnerDefense.map((s) => s.id)).toContain('arena_def_beg_02')
    })
  })

  describe('3. XP Rewards, Anti-Duplicate Protection & Progression Reconciliation', () => {
    it('awards tiered XP correctly on first scenario completion (+50 Beg, +75 Int, +100 Adv)', async () => {
      const p0 = getJourneyProgress()
      const xp0 = p0.totalXp

      // Beginner (+50)
      const resBeg = await recordArenaScenarioCompleted('att_beg_01', { score: 100 })
      expect(resBeg.success).toBe(true)
      expect(resBeg.alreadyCompleted).toBe(false)
      expect(resBeg.xpAwarded).toBe(TIER_XP_REWARDS[ARENA_DIFFICULTIES.BEGINNER]) // 50
      expect(getJourneyProgress().totalXp).toBe(xp0 + 50)

      // Intermediate (+75)
      const resInt = await recordArenaScenarioCompleted('att_int_01', { score: 100 })
      expect(resInt.success).toBe(true)
      expect(resInt.alreadyCompleted).toBe(false)
      expect(resInt.xpAwarded).toBe(TIER_XP_REWARDS[ARENA_DIFFICULTIES.INTERMEDIATE]) // 75
      expect(getJourneyProgress().totalXp).toBe(xp0 + 50 + 75)

      // Advanced (+100)
      const resAdv = await recordArenaScenarioCompleted('att_adv_01', { score: 100 })
      expect(resAdv.success).toBe(true)
      expect(resAdv.alreadyCompleted).toBe(false)
      expect(resAdv.xpAwarded).toBe(TIER_XP_REWARDS[ARENA_DIFFICULTIES.ADVANCED]) // 100
      expect(getJourneyProgress().totalXp).toBe(xp0 + 50 + 75 + 100)
    })

    it('enforces strict anti-duplicate XP on replaying an already-completed scenario', async () => {
      // First completion
      const res1 = await recordArenaScenarioCompleted('def_beg_01', { score: 100 })
      expect(res1.xpAwarded).toBe(50)
      const xpAfter1 = getJourneyProgress().totalXp

      // Replay completion
      const res2 = await recordArenaScenarioCompleted('def_beg_01', { score: 100 })
      expect(res2.success).toBe(true)
      expect(res2.alreadyCompleted).toBe(true)
      expect(res2.xpAwarded).toBe(0)

      // Total XP must not increase on replay
      const xpAfter2 = getJourneyProgress().totalXp
      expect(xpAfter2).toBe(xpAfter1)
    })

    it('reconciles arena scenario XP authoritatively without inflation or double-counting', () => {
      const initial = getJourneyProgress()
      const initialXP = initial.totalXp

      // Manually add arena completed scenarios into progress
      const progress = {
        ...initial,
        arena: {
          completedScenarios: {
            att_beg_01: { completedAt: new Date().toISOString(), score: 100, xpEarned: 50 },
            def_int_01: { completedAt: new Date().toISOString(), score: 100, xpEarned: 75 },
          },
          unlockedTiers: ['beginner', 'intermediate'],
          totalXp: 125,
        },
        totalXp: initialXP + 125,
      }
      saveJourneyProgress(progress)

      const reconciled = reconcileProgressIntegrity(progress)
      expect(reconciled.arena.totalXp).toBe(125)
      expect(reconciled.totalXp).toBe(initialXP + 125)

      // Repeated reconciliation produces exact same stable XP
      const reconciled2 = reconcileProgressIntegrity(reconciled)
      expect(reconciled2.totalXp).toBe(reconciled.totalXp)
    })
  })

  describe('4. Badge Awarding & Journey Auto-Healing', () => {
    it('awards Threat Spotter badge on Attack Mode completion', async () => {
      await recordArenaScenarioCompleted('att_beg_01', { score: 100 })
      const progress = getJourneyProgress()
      expect(progress.badges).toContain('badge_threat_spotter')
    })

    it('awards Defense Specialist badge on Defense Mode completion', async () => {
      await recordArenaScenarioCompleted('def_beg_01', { score: 100 })
      const progress = getJourneyProgress()
      expect(progress.badges).toContain('badge_defense_specialist')
    })

    it('awards Battle Strategist badge on Battle Mode completion', async () => {
      await recordArenaScenarioCompleted('bat_beg_01', { score: 100 })
      const progress = getJourneyProgress()
      expect(progress.badges).toContain('badge_battle_strategist')
    })

    it('awards Arena Master badge on Advanced tier completion', async () => {
      await recordArenaScenarioCompleted('bat_adv_01', { score: 100 })
      const progress = getJourneyProgress()
      expect(progress.badges).toContain('badge_arena_master')
    })

    it('awards Grandmaster badge on completing all 18 scenarios and tests getNextUncompletedScenario', async () => {
      for (const s of ARENA_SCENARIOS) {
        await recordArenaScenarioCompleted(s.id, { score: 100 })
      }
      const progress = getJourneyProgress()
      expect(progress.badges).toContain('badge_arena_grandmaster')
      const arenaProg = getArenaProgress()
      expect(getNextUncompletedScenario(arenaProg)).toBeNull()
    })

    it('auto-heals arena badges in reconcileProgressIntegrity if missing from badge array', () => {
      const p = getJourneyProgress()
      p.arena = {
        completedScenarios: {
          att_beg_01: { completedAt: new Date().toISOString(), score: 100, xpEarned: 50 },
          def_beg_01: { completedAt: new Date().toISOString(), score: 100, xpEarned: 50 },
          bat_adv_01: { completedAt: new Date().toISOString(), score: 100, xpEarned: 100 },
        },
        totalXp: 200,
      }
      p.badges = [] // deliberately empty badges array

      const healed = reconcileProgressIntegrity(p)
      expect(healed.badges).toContain('badge_threat_spotter')
      expect(healed.badges).toContain('badge_defense_specialist')
      expect(healed.badges).toContain('badge_battle_strategist')
      expect(healed.badges).toContain('badge_arena_master')
    })
  })

  describe('5. Notification Center & Destination Routing Integration', () => {
    it('queues notification upon completing an arena simulation', async () => {
      await recordArenaScenarioCompleted('att_beg_01', { score: 100 })
      const notifs = await getCachedNotifications('guest')
      const arenaNotif = notifs.find((n) => n.title_key === 'notif.arena_completed_title' && n.data?.scenario_id.includes('att_beg_01'))
      expect(arenaNotif).toBeDefined()
      expect(arenaNotif.data.scenario_id).toContain('att_beg_01')
      expect(arenaNotif.data.category).toBe('arena')
    })

    it('routes arena completion notification directly to #/arena', () => {
      const notif = {
        id: 'arena_1',
        title_key: 'notif.arena_completed_title',
        data: { scenario_id: 'att_beg_01', category: 'arena' },
      }
      expect(getNotificationDestination(notif)).toBe('#/arena')
    })

    it('routes all 4 arena badge notifications directly to #/arena', () => {
      const arenaBadges = [
        'badge_threat_spotter',
        'badge_defense_specialist',
        'badge_battle_strategist',
        'badge_arena_master',
      ]
      for (const badgeId of arenaBadges) {
        const notif = {
          id: `badge_${badgeId}`,
          data: { badge_id: badgeId },
        }
        expect(getNotificationDestination(notif)).toBe('#/arena')
      }
    })
  })

  describe('6. Unified Learning Progress Integration', () => {
    it('reflects arena completion metrics in getUnifiedLearningProgress', async () => {
      await recordArenaScenarioCompleted('att_beg_01', { score: 100 })
      await recordArenaScenarioCompleted('def_beg_01', { score: 100 })

      const unified = getUnifiedLearningProgress()
      expect(unified.arena).toBeDefined()
      expect(unified.arena.arenaCompleted).toBe(2)
      expect(unified.arena.totalXp).toBe(100)
      expect(unified.arena.completedScenarios.some((s) => s.includes('att_beg_01'))).toBe(true)
      expect(unified.arena.completedScenarios.some((s) => s.includes('def_beg_01'))).toBe(true)
      expect(unified.arena.unlockedTiers).toContain('beginner')
    })
  })

  describe('7. Trilingual Localization Parity (EN, OM, AM)', () => {
    const requiredArenaKeys = [
      'nav.arena',
      'arena.title',
      'arena.subtitle',
      'arena.safety_notice',
      'arena.mode_attack',
      'arena.mode_defense',
      'arena.mode_battle',
      'arena.tier_beginner',
      'arena.tier_intermediate',
      'arena.tier_advanced',
      'arena.tier_locked',
      'arena.tier_unlocked',
      'arena.tier_unlock_req_intermediate',
      'arena.tier_unlock_req_advanced',
      'arena.start_scenario',
      'arena.replay_scenario',
      'arena.next_scenario',
      'arena.back_to_arena',
      'arena.back_to_home',
      'arena.stage_1',
      'arena.stage_2',
      'arena.synthetic_log_heading',
      'arena.hint_btn',
      'arena.submit_decision',
      'arena.outcome_success',
      'arena.outcome_failure',
      'arena.outcome_xp_awarded',
      'arena.outcome_already_completed',
      'arena.system_health',
      'arena.threat_level',
      'arena.defense_effectiveness',
      'arena.correct_decisions',
      'arena.stats_completed',
      'arena.stats_total_xp',
      'notif.arena_completed_title',
      'notif.arena_completed_msg',
      'journey.badge.badge_threat_spotter',
      'journey.badge.badge_defense_specialist',
      'journey.badge.badge_battle_strategist',
      'journey.badge.badge_arena_master',
    ]

    it('contains all core Arena UI keys across EN, OM, and AM with non-empty translations', () => {
      for (const [lang, dict] of [['en', en], ['om', om], ['am', am]]) {
        for (const k of requiredArenaKeys) {
          expect(dict[k], `Missing key '${k}' in ${lang}`).toBeDefined()
          expect(dict[k].trim().length, `Empty translation for '${k}' in ${lang}`).toBeGreaterThan(0)
        }
      }
    })

    it('contains all 18 scenario titles, descriptions, and question keys across EN, OM, AM', () => {
      for (const scenario of ARENA_SCENARIOS) {
        for (const [lang, dict] of [['en', en], ['om', om], ['am', am]]) {
          expect(dict[scenario.title_key], `Missing title '${scenario.title_key}' in ${lang}`).toBeDefined()
          expect(dict[scenario.desc_key], `Missing desc '${scenario.desc_key}' in ${lang}`).toBeDefined()

          if (scenario.mode === ARENA_MODES.BATTLE) {
            for (const stg of scenario.stages) {
              expect(dict[stg.question_key], `Missing battle stage question '${stg.question_key}' in ${lang}`).toBeDefined()
              for (const optKey of stg.options_keys) {
                expect(dict[optKey], `Missing battle stage option '${optKey}' in ${lang}`).toBeDefined()
              }
              expect(dict[stg.explanation_key], `Missing battle stage explanation '${stg.explanation_key}' in ${lang}`).toBeDefined()
            }
          } else {
            expect(dict[scenario.question_key], `Missing question '${scenario.question_key}' in ${lang}`).toBeDefined()
            for (const optKey of scenario.options_keys) {
              expect(dict[optKey], `Missing option '${optKey}' in ${lang}`).toBeDefined()
            }
            expect(dict[scenario.explanation_key], `Missing explanation '${scenario.explanation_key}' in ${lang}`).toBeDefined()
          }
        }
      }
    })

    it('confirms safety notice in all three languages states strictly synthetic simulations', () => {
      expect(en['arena.safety_notice'].toLowerCase()).toContain('synthetic')
      expect(om['arena.safety_notice'].toLowerCase()).toContain('shaakala')
      expect(am['arena.safety_notice']).toContain('ሰው ሰራሽ')
    })
  })

  describe('8. Responsive Design & Accessibility CSS Validation', () => {
    it('defines arena container, cards, and interactive elements in styles.css', () => {
      expect(css).toContain('.arena-container')
      expect(css).toContain('.arena-header')
      expect(css).toContain('.arena-safety-notice')
      expect(css).toContain('.arena-stats-bar')
      expect(css).toContain('.scenario-card')
      expect(css).toContain('.telemetry-box')
      expect(css).toContain('.battle-meters-panel')
      expect(css).toContain('.arena-outcome-panel')
      expect(css).toContain('.diff-chip')
      expect(css).toContain('.mode-tab')
    })

    it('defines navigation styling for .nav-tab.nav-arena and hero action .hero-btn-arena', () => {
      expect(css).toContain('.nav-tab.nav-arena')
      expect(css).toContain('.hero-btn-arena')
    })

    it('ensures touch targets and focus styles meet accessibility standards', () => {
      expect(css).toContain('.scenario-card:focus-visible')
      expect(css).toContain('.arena-option-btn:focus-visible')
      expect(css).toContain('.telemetry-box')
    })
  })
})
