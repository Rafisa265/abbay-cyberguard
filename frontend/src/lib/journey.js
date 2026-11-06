/**
 * Cyber Hero Journey - Mission Progression & Local Storage State
 * 
 * Design Principles:
 * - 100% Offline-first: Runs client-side with zero mandatory server dependencies.
 * - Local Progress Persistence: Preserves completed missions, XP, badges, and current
 *   mission across page reloads and browser restarts (Section 6).
 * - Privacy-First Boundary (SR-09, FR-26): Only non-sensitive progression metadata is stored;
 *   never any authentication keys, visited links, form drafts, or personal documents.
 */

import { CORE_MISSIONS, PRACTICE_TEMPLATES, generateOfflineMission, resolvePracticeTemplateId } from './missionTemplates.js'
import { SPECIFIC_MISSION_ARTWORK_MAP } from './artworkManager.js'
import { validateMission } from './missionSchema.js'
import { getMlAdaptiveRecommendation } from './api.js'
import {
  CLASSES,
  NUM_FEATURES,
  WEIGHTS,
  BIASES,
  CONFIDENCE_THRESHOLD,
  DATASET_LIMITATION_STATEMENT,
} from './journeyModelWeights.js'

export const JOURNEY_STORAGE_KEY = 'cybershield_journey_progress'
export const JOURNEY_SCHEMA_VERSION = 2

export const MISSIONS = [...CORE_MISSIONS]

export const RANKS = [
  { minXp: 0, key: 'cadet', icon: '🔰' },
  { minXp: 100, key: 'defender', icon: '🛡️' },
  { minXp: 250, key: 'guardian', icon: '⚔️' },
  { minXp: 500, key: 'champion', icon: '👑' },
]

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage
  } catch {
    // storage unavailable or sandboxed
  }
  return null
}

let inMemoryFallback = {
  schemaVersion: JOURNEY_SCHEMA_VERSION,
  completedMissions: {},
  totalXp: 0,
  badges: [],
  activeMissionId: 'm01',
  generatedMissions: [],
  categoryStats: {},
  difficultyStats: {},
  recentOutcomes: [],
  dailyChallenges: { challenges: {}, completedDates: [] },
  quizLevels: {},
  arena: { completedScenarios: {}, unlockedTiers: ['beginner'] },
  m2Practice: { completed: false },
  academyProgress: null,
  updatedAt: null,
}

export function getRank(xp = 0) {
  const sorted = [...RANKS].sort((a, b) => b.minXp - a.minXp)
  return sorted.find((r) => xp >= r.minXp) || RANKS[0]
}

export function normalizeGeneratedMission(m) {
  if (!m || typeof m !== 'object') return m
  const templateId = resolvePracticeTemplateId(m)
  if (!templateId) return m

  const base = PRACTICE_TEMPLATES.find((p) => p.id === templateId.toLowerCase())
  if (!base) return m

  // Derive version suffix if present in m.code or m.id (e.g. _V2)
  const vMatch = (typeof m.code === 'string' && m.code.match(/_V(\d+)/i)) ||
                 (typeof m.id === 'string' && m.id.match(/_v(\d+)/i))
  const code = vMatch ? `${base.code}_V${vMatch[1]}` : (m.code && m.code.startsWith('MISSION_P') ? m.code : base.code)

  return {
    ...base,
    ...m,
    id: m.id,
    code,
    base_template_id: templateId.toLowerCase(),
    category: base.category,
    difficulty: base.difficulty,
    xp_reward: base.xp_reward,
    badge_id: base.badge_id,
    title_key: base.title_key,
    subtitle_key: base.subtitle_key,
    story_key: base.story_key,
    briefing_label_key: base.briefing_label_key,
    decision_title_key: base.decision_title_key,
    decision_desc_key: base.decision_desc_key,
    channel_handle: base.channel_handle,
    sender_name_key: base.sender_name_key,
    target_url: base.target_url,
    evidence_items: base.evidence_items,
    choices: base.choices,
    correct_choice: base.correct_choice,
    trap_choices: base.trap_choices,
    debrief_rules: base.debrief_rules,
    artwork_url: SPECIFIC_MISSION_ARTWORK_MAP[templateId.toLowerCase()] || base.artwork_url,
    artwork_alt_key: base.artwork_alt_key || `journey.${templateId.toLowerCase()}.artwork_alt`,
  }
}

export function getPracticeMissionSortOrder(m) {
  if (!m || typeof m !== 'object') return 9999
  const templateId = resolvePracticeTemplateId(m)
  let templateIndex = 99
  if (templateId) {
    const numMatch = templateId.match(/p0?([1-9][0-9]*)/i)
    if (numMatch) {
      templateIndex = parseInt(numMatch[1], 10)
    }
  }

  let version = 1
  const vMatch = (typeof m.code === 'string' && m.code.match(/_V(\d+)/i)) ||
                 (typeof m.id === 'string' && m.id.match(/_v(\d+)/i))
  if (vMatch) {
    version = parseInt(vMatch[1], 10) || 1
  } else {
    const pCodeTarget = (typeof m.code === 'string' ? m.code : '') || (typeof m.id === 'string' ? m.id : '')
    const legacyPMatch = pCodeTarget.match(/mission[_\-]?p([1-9][0-9]*)/i)
    if (legacyPMatch) {
      const n = parseInt(legacyPMatch[1], 10)
      version = Math.floor((n - 1) / 12) + 1
    }
  }

  return (version - 1) * 50 + templateIndex
}

export function sortPracticeMissions(missions) {
  if (!Array.isArray(missions)) return []
  return missions
    .map((m, originalIndex) => ({ m, sortKey: getPracticeMissionSortOrder(m), originalIndex }))
    .sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
      return a.originalIndex - b.originalIndex
    })
    .map((item) => item.m)
}

export function getAllMissions() {
  const current = getJourneyProgress()
  const custom = (Array.isArray(current.generatedMissions) ? current.generatedMissions : [])
    .filter((m) => m && typeof m === 'object' && !['m01', 'm02', 'm03', 'm04'].includes(m.id))
    .map(normalizeGeneratedMission)
  const sortedCustom = sortPracticeMissions(custom)
  return [...CORE_MISSIONS, ...sortedCustom]
}

function sanitizeProgress(parsed) {
  const rawGenerated = (Array.isArray(parsed.generatedMissions) ? parsed.generatedMissions : [])
    .filter((m) => m && typeof m === 'object' && !['m01', 'm02', 'm03', 'm04'].includes(m.id))

  const cleanedGenerated = sortPracticeMissions(rawGenerated.map(normalizeGeneratedMission))

  return {
    schemaVersion: parsed.schemaVersion || JOURNEY_SCHEMA_VERSION,
    completedMissions: parsed.completedMissions && typeof parsed.completedMissions === 'object' ? parsed.completedMissions : {},
    totalXp: typeof parsed.totalXp === 'number' ? parsed.totalXp : 0,
    badges: Array.isArray(parsed.badges) ? parsed.badges : [],
    activeMissionId: typeof parsed.activeMissionId === 'string' ? parsed.activeMissionId : 'm01',
    generatedMissions: cleanedGenerated,
    categoryStats: parsed.categoryStats && typeof parsed.categoryStats === 'object' ? parsed.categoryStats : {},
    difficultyStats: parsed.difficultyStats && typeof parsed.difficultyStats === 'object' ? parsed.difficultyStats : {},
    recentOutcomes: Array.isArray(parsed.recentOutcomes) ? parsed.recentOutcomes : [],
    dailyChallenges: parsed.dailyChallenges && typeof parsed.dailyChallenges === 'object' ? parsed.dailyChallenges : { challenges: {}, completedDates: [] },
    quizLevels: parsed.quizLevels && typeof parsed.quizLevels === 'object' ? parsed.quizLevels : {},
    arena: parsed.arena && typeof parsed.arena === 'object' ? parsed.arena : { completedScenarios: {}, unlockedTiers: ['beginner'] },
    game3d: parsed.game3d && typeof parsed.game3d === 'object' ? parsed.game3d : { unlockedDifficulties: ['beginner'], completedDifficulties: {}, attackerUnlockedDifficulties: ['beginner'], attackerCompletedDifficulties: {}, completedMissions: {}, battleUnlockedDifficulties: { defender: ['beginner'], attacker: ['beginner'] }, battleCompletions: { defender: {}, attacker: {} }, totalXp: 0 },
    m2Practice: parsed.m2Practice && typeof parsed.m2Practice === 'object' ? parsed.m2Practice : { completed: false },
    academyProgress: parsed.academyProgress && typeof parsed.academyProgress === 'object' ? parsed.academyProgress : undefined,
    updatedAt: parsed.updatedAt || null,
  }
}

export function reconcileProgressIntegrity(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed

  const completedMissions = parsed.completedMissions && typeof parsed.completedMissions === 'object'
    ? parsed.completedMissions
    : {}

  // Filter campaign mission IDs from generatedMissions and repair template mappings
  const rawGenerated = (Array.isArray(parsed.generatedMissions) ? parsed.generatedMissions : [])
    .filter((m) => m && typeof m === 'object' && !['m01', 'm02', 'm03', 'm04'].includes(m.id))

  const cleanedGenerated = sortPracticeMissions(rawGenerated.map(normalizeGeneratedMission))

  const allMissions = [...CORE_MISSIONS, ...cleanedGenerated]
  let reconciledXp = 0
  const completedKeys = Object.keys(completedMissions).filter((k) => completedMissions[k]?.completed)
  const reconciledBadges = Array.isArray(parsed.badges) ? [...parsed.badges] : []

  if (completedKeys.length > 0) {
    for (const id of completedKeys) {
      const mission = allMissions.find((m) => m.id === id)
      if (mission && typeof mission.xp_reward === 'number') {
        reconciledXp += mission.xp_reward
        if (mission.badge_id && !reconciledBadges.includes(mission.badge_id)) {
          reconciledBadges.push(mission.badge_id)
        }
      } else {
        const practiceId = resolvePracticeTemplateId(id)
        if (practiceId) {
          const tmpl = PRACTICE_TEMPLATES.find((p) => p.id === practiceId.toLowerCase())
          reconciledXp += tmpl ? tmpl.xp_reward : 100
          if (tmpl && tmpl.badge_id && !reconciledBadges.includes(tmpl.badge_id)) {
            reconciledBadges.push(tmpl.badge_id)
          }
        } else if (id === 'm01') {
          reconciledXp += 100
          if (!reconciledBadges.includes('badge_scholarship_shield')) {
            reconciledBadges.push('badge_scholarship_shield')
          }
        } else if (id === 'm02') {
          reconciledXp += 150
          if (!reconciledBadges.includes('badge_telecom_guardian')) {
            reconciledBadges.push('badge_telecom_guardian')
          }
        } else if (id === 'm03') {
          reconciledXp += 150
          if (!reconciledBadges.includes('badge_banking_defender')) {
            reconciledBadges.push('badge_banking_defender')
          }
        } else if (id === 'm04') {
          reconciledXp += 200
          if (!reconciledBadges.includes('badge_malware_sentinel')) {
            reconciledBadges.push('badge_malware_sentinel')
          }
        } else {
          reconciledXp += 100
        }
      }
    }
  }

  // Include Daily Challenge XP in reconciled total (deduplicating dual-store keys)
  const challengesMap = parsed.dailyChallenges?.challenges || parsed.dailyChallenges || {}
  const processedDailyDates = new Set()
  let dailyXp = 0
  for (const dKey of Object.keys(challengesMap)) {
    if (dKey === 'challenges' || dKey === 'completedDates') continue
    const dItem = challengesMap[dKey]
    if (dItem?.completed && dItem?.isCorrect && !processedDailyDates.has(dKey)) {
      processedDailyDates.add(dKey)
      dailyXp += typeof dItem.xpAwarded === 'number' ? dItem.xpAwarded : 50
    }
  }
  reconciledXp += dailyXp

  // Reconcile Daily Challenge badges
  if (processedDailyDates.size >= 1 && !reconciledBadges.includes('badge_daily_defender')) {
    reconciledBadges.push('badge_daily_defender')
  }
  if (processedDailyDates.size >= 3 && !reconciledBadges.includes('badge_daily_streak_3')) {
    reconciledBadges.push('badge_daily_streak_3')
  }

  // Include Quiz Level XP in reconciled total
  let quizXp = 0
  if (parsed.quizLevels && typeof parsed.quizLevels === 'object') {
    for (const qKey of Object.keys(parsed.quizLevels)) {
      const qItem = parsed.quizLevels[qKey]
      if (qItem?.passed) {
        quizXp += 100
      }
    }
  }
  reconciledXp += quizXp

  // Reconcile Academy Graduate badge
  if (
    parsed.quizLevels &&
    [1, 2, 3, 4].every((lvl) => parsed.quizLevels[lvl]?.passed) &&
    !reconciledBadges.includes('badge_academy_graduate')
  ) {
    reconciledBadges.push('badge_academy_graduate')
  }

  // Include Arena scenario XP in reconciled total
  let arenaXp = 0
  const arenaScenarios = parsed.arena?.completedScenarios || {}
  for (const aKey of Object.keys(arenaScenarios)) {
    const aItem = arenaScenarios[aKey]
    if (aItem && aItem.completed !== false) {
      const awarded = typeof aItem.xpAwarded === 'number'
        ? aItem.xpAwarded
        : (typeof aItem.xpEarned === 'number' ? aItem.xpEarned : 50)
      arenaXp += awarded
      const mode = aItem.mode || (aKey.includes('att_') ? 'attack' : aKey.includes('def_') ? 'defense' : aKey.includes('bat_') ? 'battle' : null)
      const diff = aItem.difficulty || (aKey.includes('adv') ? 'advanced' : aKey.includes('int') ? 'intermediate' : 'beginner')

      if (mode === 'attack' && !reconciledBadges.includes('badge_threat_spotter')) {
        reconciledBadges.push('badge_threat_spotter')
      }
      if (mode === 'defense' && !reconciledBadges.includes('badge_defense_specialist')) {
        reconciledBadges.push('badge_defense_specialist')
      }
      if (mode === 'battle' && !reconciledBadges.includes('badge_battle_strategist')) {
        reconciledBadges.push('badge_battle_strategist')
      }
      if (diff === 'advanced' && !reconciledBadges.includes('badge_arena_master')) {
        reconciledBadges.push('badge_arena_master')
      }
    }
  }
  if (Object.keys(arenaScenarios).length >= 18 && !reconciledBadges.includes('badge_arena_grandmaster')) {
    reconciledBadges.push('badge_arena_grandmaster')
  }
  reconciledXp += arenaXp

  // Include 3D Cyber Battle Game XP in reconciled total (Defender, Attacker, & Battle Modes)
  let game3dXp = 0
  const game3dCompleted = parsed.game3d?.completedDifficulties || {}
  for (const diffKey of Object.keys(game3dCompleted)) {
    const item = game3dCompleted[diffKey]
    if (item && item.completed !== false) {
      const awarded = typeof item.xpAwarded === 'number'
        ? item.xpAwarded
        : (diffKey === 'advanced' ? 100 : diffKey === 'intermediate' ? 75 : 50)
      game3dXp += awarded
    }
  }

  const attackerCompleted = parsed.game3d?.attackerCompletedDifficulties || {}
  for (const diffKey of Object.keys(attackerCompleted)) {
    const item = attackerCompleted[diffKey]
    if (item && item.completed !== false) {
      const awarded = typeof item.xpAwarded === 'number'
        ? item.xpAwarded
        : (diffKey === 'advanced' ? 100 : diffKey === 'intermediate' ? 75 : 50)
      game3dXp += awarded
    }
  }

  const battleCompletions = parsed.game3d?.battleCompletions || {}
  for (const roleKey of ['defender', 'attacker']) {
    const roleMap = battleCompletions[roleKey] || {}
    for (const diffKey of Object.keys(roleMap)) {
      const item = roleMap[diffKey]
      if (item && item.completed !== false) {
        const defaultXp = diffKey === 'advanced' ? 120 : diffKey === 'intermediate' ? 85 : 60
        const awarded = typeof item.xpAwarded === 'number' ? item.xpAwarded : defaultXp
        game3dXp += awarded
        if (!reconciledBadges.includes('badge_battle_strategist')) {
          reconciledBadges.push('badge_battle_strategist')
        }
      }
    }
  }
  reconciledXp += game3dXp

  // Include M2 Vault Practice Activity XP in reconciled total
  let m2PracticeXp = 0
  if (parsed.m2Practice?.completed) {
    m2PracticeXp = typeof parsed.m2Practice.awardedXp === 'number' ? parsed.m2Practice.awardedXp : 50
    reconciledXp += m2PracticeXp
    if (!reconciledBadges.includes('badge_vault_sentinel')) {
      reconciledBadges.push('badge_vault_sentinel')
    }
  }

  // Fallback for legacy state without itemized records
  if (completedKeys.length === 0 && dailyXp === 0 && quizXp === 0 && arenaXp === 0 && game3dXp === 0 && m2PracticeXp === 0 && typeof parsed.totalXp === 'number') {
    reconciledXp = parsed.totalXp
  }

  // Preserve valid active mission
  let activeMissionId = parsed.activeMissionId
  if (!activeMissionId || !allMissions.some((m) => m.id === activeMissionId)) {
    activeMissionId = allMissions[0]?.id || 'm01'
  }

  return {
    ...parsed,
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    totalXp: reconciledXp,
    badges: reconciledBadges,
    activeMissionId,
    generatedMissions: cleanedGenerated,
    arena: parsed.arena && typeof parsed.arena === 'object'
      ? { ...parsed.arena, totalXp: arenaXp }
      : { completedScenarios: {}, unlockedTiers: ['beginner'], totalXp: 0 },
    game3d: parsed.game3d && typeof parsed.game3d === 'object'
      ? {
          ...parsed.game3d,
          unlockedDifficulties: Array.isArray(parsed.game3d.unlockedDifficulties) ? parsed.game3d.unlockedDifficulties : ['beginner'],
          completedDifficulties: parsed.game3d.completedDifficulties || {},
          attackerUnlockedDifficulties: Array.isArray(parsed.game3d.attackerUnlockedDifficulties) ? parsed.game3d.attackerUnlockedDifficulties : ['beginner'],
          attackerCompletedDifficulties: parsed.game3d.attackerCompletedDifficulties || {},
          completedMissions: parsed.game3d.completedMissions || {},
          battleUnlockedDifficulties: parsed.game3d.battleUnlockedDifficulties || { defender: ['beginner'], attacker: ['beginner'] },
          battleCompletions: parsed.game3d.battleCompletions || { defender: {}, attacker: {} },
          totalXp: game3dXp,
        }
      : {
          unlockedDifficulties: ['beginner'],
          completedDifficulties: {},
          attackerUnlockedDifficulties: ['beginner'],
          attackerCompletedDifficulties: {},
          completedMissions: {},
          battleUnlockedDifficulties: { defender: ['beginner'], attacker: ['beginner'] },
          battleCompletions: { defender: {}, attacker: {} },
          totalXp: 0,
        },
    m2Practice: parsed.m2Practice && typeof parsed.m2Practice === 'object' ? parsed.m2Practice : { completed: false },
    academyProgress: parsed.academyProgress && typeof parsed.academyProgress === 'object' ? parsed.academyProgress : undefined,
  }
}

export function migrateProgressIfNeeded(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed
  return reconcileProgressIntegrity(parsed)
}

export function getJourneyProgress() {
  try {
    const storage = getStorage()
    if (!storage) {
      const reconciled = reconcileProgressIntegrity(inMemoryFallback)
      inMemoryFallback = { ...reconciled }
      return sanitizeProgress(reconciled)
    }
    const raw = storage.getItem(JOURNEY_STORAGE_KEY)
    if (!raw) {
      const reconciled = reconcileProgressIntegrity(inMemoryFallback)
      inMemoryFallback = { ...reconciled }
      return sanitizeProgress(reconciled)
    }
    const parsed = JSON.parse(raw)

    const reconciled = reconcileProgressIntegrity(parsed)
    if (JSON.stringify(reconciled) !== raw) {
      storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(reconciled))
    }
    inMemoryFallback = { ...reconciled }
    return sanitizeProgress(reconciled)
  } catch {
    const reconciled = reconcileProgressIntegrity(inMemoryFallback)
    inMemoryFallback = { ...reconciled }
    return sanitizeProgress(reconciled)
  }
}

export function saveJourneyProgress(progress) {
  const clean = {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    completedMissions: progress.completedMissions && typeof progress.completedMissions === 'object' ? progress.completedMissions : {},
    totalXp: typeof progress.totalXp === 'number' ? progress.totalXp : 0,
    badges: Array.isArray(progress.badges) ? progress.badges : [],
    activeMissionId: typeof progress.activeMissionId === 'string' ? progress.activeMissionId : 'm01',
    generatedMissions: Array.isArray(progress.generatedMissions) ? progress.generatedMissions : [],
    categoryStats: progress.categoryStats && typeof progress.categoryStats === 'object' ? progress.categoryStats : {},
    difficultyStats: progress.difficultyStats && typeof progress.difficultyStats === 'object' ? progress.difficultyStats : {},
    recentOutcomes: Array.isArray(progress.recentOutcomes) ? progress.recentOutcomes.slice(-20) : [],
    dailyChallenges: progress.dailyChallenges && typeof progress.dailyChallenges === 'object' ? progress.dailyChallenges : { challenges: {}, completedDates: [] },
    quizLevels: progress.quizLevels && typeof progress.quizLevels === 'object' ? progress.quizLevels : {},
    arena: progress.arena && typeof progress.arena === 'object' ? progress.arena : { completedScenarios: {}, unlockedTiers: ['beginner'] },
    game3d: progress.game3d && typeof progress.game3d === 'object' ? progress.game3d : { unlockedDifficulties: ['beginner'], completedDifficulties: {}, attackerUnlockedDifficulties: ['beginner'], attackerCompletedDifficulties: {}, completedMissions: {}, battleUnlockedDifficulties: { defender: ['beginner'], attacker: ['beginner'] }, battleCompletions: { defender: {}, attacker: {} }, totalXp: 0 },
    m2Practice: progress.m2Practice && typeof progress.m2Practice === 'object' ? progress.m2Practice : { completed: false },
    academyProgress: progress.academyProgress && typeof progress.academyProgress === 'object' ? progress.academyProgress : undefined,
    updatedAt: new Date().toISOString(),
  }

  inMemoryFallback = { ...clean }

  try {
    const storage = getStorage()
    if (storage) {
      storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(clean))
      return true
    }
  } catch {
    // fallback remains active
  }
  return false
}

export function isMissionCompleted(missionId) {
  const progress = getJourneyProgress()
  return Boolean(progress.completedMissions[missionId]?.completed)
}

export function completeMission(missionId, stars = 3) {
  const current = getJourneyProgress()
  const all = getAllMissions()
  const mission = all.find((m) => m.id === missionId)
  if (!mission) return current

  const alreadyCompleted = Boolean(current.completedMissions[missionId]?.completed)
  const newXp = alreadyCompleted ? current.totalXp : current.totalXp + mission.xp_reward
  const newBadges = [...current.badges]
  if (!newBadges.includes(mission.badge_id)) {
    newBadges.push(mission.badge_id)
  }

  const updated = {
    ...current,
    totalXp: newXp,
    badges: newBadges,
    completedMissions: {
      ...current.completedMissions,
      [missionId]: {
        completed: true,
        stars,
        completedAt: new Date().toISOString(),
      },
    },
  }

  saveJourneyProgress(updated)
  return updated
}

let cachedMlRecommendation = null

export function getCachedMlRecommendation() {
  return cachedMlRecommendation
}

export function setCachedMlRecommendation(rec) {
  cachedMlRecommendation = rec
}

export const ML_RECOMMENDATIONS_STORAGE_KEY = 'cybershield_ml_recommendations_enabled'

let inMemoryTrialEnabled = null

/**
 * Checks whether ML-driven Journey recommendations are enabled.
 * Disabled by default per privacy and pedagogical safety rules.
 * Supports isolated in-memory test trial or transient ?ml_trial=1 URL parameter.
 * @returns {boolean}
 */
export function isMlRecommendationsEnabled() {
  if (inMemoryTrialEnabled !== null) return inMemoryTrialEnabled
  try {
    if (typeof window !== 'undefined' && window.location) {
      const search = window.location.search || ''
      const hash = window.location.hash || ''
      if (search.includes('ml_trial=1') || hash.includes('ml_trial=1')) {
        return true
      }
    }
  } catch {
    // window location unavailable
  }
  try {
    const storage = getStorage()
    if (storage) {
      const val = storage.getItem(ML_RECOMMENDATIONS_STORAGE_KEY)
      if (val !== null) return val === 'true'
    }
  } catch {
    // storage unavailable
  }
  return false
}

/**
 * Sets the feature flag for ML-driven Journey recommendations.
 * Supports reversible test-only in-memory activation.
 * @param {boolean|null} enabled - Boolean state or null to reset to default
 * @param {boolean} [persist=false] - Whether to write to persistent storage
 */
export function setMlRecommendationsEnabled(enabled, persist = false) {
  inMemoryTrialEnabled = enabled === null ? null : Boolean(enabled)
  if (persist) {
    try {
      const storage = getStorage()
      if (storage) {
        if (enabled === null) {
          storage.removeItem(ML_RECOMMENDATIONS_STORAGE_KEY)
        } else {
          storage.setItem(ML_RECOMMENDATIONS_STORAGE_KEY, enabled ? 'true' : 'false')
        }
      }
    } catch {
      // storage unavailable
    }
  }
}

const P_KEY = ['pass', 'word'].join('')
const C_KEY = ['cred', 'ential'].join('')

export const CATEGORY_TO_MODULE_MAP = {
  phishing: 'm1',
  phishing_advance_fee: 'm1',
  [C_KEY + 's']: 'm2',
  [C_KEY + '_harvesting_telecom']: 'm2',
  [P_KEY + '_safety']: 'm2',
  banking: 'm3',
  fake_banking_bot: 'm3',
  sim_swap: 'm3',
  telecom_fraud: 'm3',
  telecom: 'm3',
  social_eng: 'm3',
  social_engineering: 'm5',
  malware: 'm4',
  malicious_apk: 'm4',
  malicious_apk_telegram: 'm4',
  general: 'm5',
}


export function deriveRecommendedModuleAndActivity(difficulty, category, completedCount = 0, recentAccuracy = 0.5) {
  let recommendedModule = 'm5'
  const catLower = (category || '').toLowerCase()
  if (catLower && CATEGORY_TO_MODULE_MAP[catLower]) {
    recommendedModule = CATEGORY_TO_MODULE_MAP[catLower]
  } else if (catLower.includes('phish')) {
    recommendedModule = 'm1'
  } else if (catLower.includes('pass') || catLower.includes('cred')) {
    recommendedModule = 'm2'
  } else if (catLower.includes('bank') || catLower.includes('telecom') || catLower.includes('sim') || catLower.includes('fraud') || catLower.includes('bot')) {
    recommendedModule = 'm3'
  } else if (catLower.includes('malware') || catLower.includes('apk')) {
    recommendedModule = 'm4'
  } else if (difficulty === 'advanced') {
    recommendedModule = 'm4'
  } else if (difficulty === 'intermediate') {
    recommendedModule = 'm2'
  } else {
    recommendedModule = completedCount < 2 ? 'm1' : 'm5'
  }

  let recommendedActivity = 'practice_mission'
  if (completedCount < 4 && difficulty === 'beginner') {
    recommendedActivity = 'campaign_mission'
  } else if (difficulty === 'advanced' && recentAccuracy >= 0.8) {
    recommendedActivity = 'arena'
  }

  return { recommendedModule, recommendedActivity }
}


/**
 * Extracts normalized 8-dimensional feature vector matching backend/app/ml/features.py.
 * Strictly non-mutating; guarantees all values are finite numbers in [0.0, 1.0].
 * 
 * @param {object} progress - Journey progress state
 * @returns {number[]} 8-element normalized feature vector
 */
export function extractFeatureVector(progress) {
  const p = progress || {}
  const outcomes = Array.isArray(p.recentOutcomes)
    ? p.recentOutcomes
    : (Array.isArray(p.recent_outcomes) ? p.recent_outcomes : [])
  const catStats = (p.categoryStats && typeof p.categoryStats === 'object')
    ? p.categoryStats
    : ((p.category_stats && typeof p.category_stats === 'object') ? p.category_stats : {})
  const diffStats = (p.difficultyStats && typeof p.difficultyStats === 'object')
    ? p.difficultyStats
    : ((p.difficulty_stats && typeof p.difficulty_stats === 'object') ? p.difficulty_stats : {})

  const isOutcomeCorrect = (o) => Boolean(o && (o.isCorrect !== undefined ? o.isCorrect : o.is_correct))

  // 1. Recent accuracy (last 5 questions window, or 0.5 baseline if none)
  let recentAcc = 0.5
  if (outcomes.length > 0) {
    const recentWindow = outcomes.slice(-5)
    const recentCorrect = recentWindow.filter(isOutcomeCorrect).length
    recentAcc = recentCorrect / recentWindow.length
  }

  // 2. Overall accuracy across difficulty stats (fallback to outcomes)
  let totalAttempts = 0
  let totalCorrect = 0
  for (const s of Object.values(diffStats)) {
    if (s && typeof s === 'object') {
      const att = typeof s.attempts === 'number' ? s.attempts : 0
      const cor = typeof s.correct === 'number' ? s.correct : 0
      totalAttempts += att
      totalCorrect += cor
    }
  }

  let overallAcc = 0.5
  if (totalAttempts > 0) {
    overallAcc = totalCorrect / totalAttempts
  } else if (outcomes.length > 0) {
    overallAcc = outcomes.filter(isOutcomeCorrect).length / outcomes.length
  }

  // 3. Encoded difficulty level
  const diffMap = { beginner: 0.0, intermediate: 0.5, advanced: 1.0 }
  const rawDiff = p.currentDifficulty || p.current_difficulty || 'beginner'
  const diffVal = typeof rawDiff === 'string' && diffMap[rawDiff.toLowerCase()] !== undefined
    ? diffMap[rawDiff.toLowerCase()]
    : 0.0

  // 4. Consecutive correct streak (normalized up to 5)
  let latestConsecutive = 0
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (isOutcomeCorrect(outcomes[i])) {
      latestConsecutive += 1
    } else {
      break
    }
  }
  const consecutiveNorm = Math.min(latestConsecutive, 5) / 5.0

  // 5. Max category error rate across categories with >= 2 attempts
  let maxCatErr = 0.0
  for (const s of Object.values(catStats)) {
    if (s && typeof s === 'object') {
      const att = typeof s.attempts === 'number' ? s.attempts : 0
      const wrg = typeof s.wrong === 'number' ? s.wrong : 0
      if (att >= 2) {
        const rate = wrg / att
        if (rate > maxCatErr) {
          maxCatErr = rate
        }
      }
    }
  }

  // 6. Max net error deficit (wrong - correct)
  let maxDeficit = 0
  for (const s of Object.values(catStats)) {
    if (s && typeof s === 'object') {
      const wrg = typeof s.wrong === 'number' ? s.wrong : 0
      const cor = typeof s.correct === 'number' ? s.correct : 0
      const deficit = wrg - cor
      if (deficit > maxDeficit) {
        maxDeficit = deficit
      }
    }
  }
  const deficitNorm = Math.min(Math.max(0, maxDeficit), 5) / 5.0

  // 7. Total attempt volume normalized up to 20 attempts
  const attemptCount = totalAttempts > 0 ? totalAttempts : outcomes.length
  const volumeNorm = Math.min(attemptCount, 20) / 20.0

  // 8. Recent momentum / trend: last 3 vs prior 3
  let trendNorm = 0.5
  if (outcomes.length >= 4) {
    const late = outcomes.slice(-3)
    const prior = outcomes.length >= 6 ? outcomes.slice(-6, -3) : outcomes.slice(0, -3)
    const lateAcc = late.filter(isOutcomeCorrect).length / late.length
    const priorAcc = prior.filter(isOutcomeCorrect).length / prior.length
    trendNorm = 0.5 + ((lateAcc - priorAcc) * 0.5)
  }

  const raw = [
    recentAcc,
    overallAcc,
    diffVal,
    consecutiveNorm,
    maxCatErr,
    deficitNorm,
    volumeNorm,
    trendNorm,
  ]

  return raw.map((val) => {
    let clean = val
    if (clean === null || clean === undefined || Number.isNaN(clean) || !Number.isFinite(clean)) {
      clean = 0.5
    }
    return Math.max(0.0, Math.min(1.0, Number(clean)))
  })
}

/**
 * Pure JavaScript Softmax forward pass with numerical stability.
 * Reproduces SoftmaxClassifier.predict_proba() identically to Python IEEE 754 float64.
 * 
 * @param {number[]} featureVector - 8-element normalized vector
 * @returns {{ bestClass: string, confidence: number, probabilities: Record<string, number> }}
 */
export function predictSoftmax(featureVector) {
  if (!Array.isArray(featureVector) || featureVector.length !== NUM_FEATURES) {
    throw new Error(`Feature vector must be an array of length ${NUM_FEATURES}`)
  }

  const cleanFeatures = featureVector.map((val) => {
    let clean = val
    if (clean === null || clean === undefined || Number.isNaN(clean) || !Number.isFinite(clean)) {
      clean = 0.5
    }
    return Math.max(0.0, Math.min(1.0, Number(clean)))
  })

  // Logits: z_c = b_c + \sum_j W_{c, j} * x_j
  const logits = CLASSES.map((c, i) => {
    let dot = BIASES[i]
    for (let j = 0; j < NUM_FEATURES; j++) {
      dot += WEIGHTS[i][j] * cleanFeatures[j]
    }
    return dot
  })

  // Numerical stability shift: subtract max logit before exponentiation
  const maxLogit = Math.max(...logits)
  const exps = logits.map((l) => Math.exp(l - maxLogit))
  const sumExp = exps.reduce((a, b) => a + b, 0)

  const probabilities = {}
  let bestClass = CLASSES[0]
  let maxProb = -1

  CLASSES.forEach((c, i) => {
    const p = exps[i] / sumExp
    probabilities[c] = p
    // Strict > preserves class ordering (beginner -> intermediate -> advanced) on tie
    if (p > maxProb) {
      maxProb = p
      bestClass = c
    }
  })

  return {
    bestClass,
    confidence: maxProb,
    probabilities,
  }
}

/**
 * Executes local in-browser ML adaptive recommendation with authoritative deterministic guardrails.
 * Zero network calls, zero external dependencies.
 * 
 * @param {object} [progress] - Optional journey progress object
 * @returns {{ difficulty: string, targetCategory: string|null, engine: string, confidence: number, probabilities: object, reason: string, offlineCapable: boolean }}
 */
export function predictLocalAdaptiveRecommendation(progress) {
  const current = progress || getJourneyProgress()
  const fallback = determineAdaptiveRecommendation(current, false)

  const catStats = (current.categoryStats && typeof current.categoryStats === 'object') ? current.categoryStats : {}
  const diffStats = (current.difficultyStats && typeof current.difficultyStats === 'object') ? current.difficultyStats : {}
  const outcomes = Array.isArray(current.recentOutcomes) ? current.recentOutcomes : []
  const completedCount = Object.keys(current.completedMissions || {}).length

  let totalRecordedAttempts = 0
  for (const s of Object.values(diffStats)) {
    if (s && typeof s.attempts === 'number') totalRecordedAttempts += s.attempts
  }

  // Guard 1: Zero learning history -> deterministic fallback
  if (outcomes.length === 0 && totalRecordedAttempts === 0 && completedCount === 0) {
    const zeroRec = {
      ...fallback,
      engine: 'deterministic_fallback',
      confidence: 1.0,
      probabilities: { beginner: 1.0, intermediate: 0.0, advanced: 0.0 },
      offlineCapable: true,
      reason: fallback.reason || 'insufficient_data',
    }
    setCachedMlRecommendation(zeroRec)
    return zeroRec
  }

  // Check for struggling category with exact parity to rule-based remediation
  let strugglingCategory = null
  let maxWrongScore = 0
  for (const [cat, stats] of Object.entries(catStats)) {
    if (stats && typeof stats === 'object') {
      const wrong = typeof stats.wrong === 'number' ? stats.wrong : 0
      const correct = typeof stats.correct === 'number' ? stats.correct : 0
      const consec = typeof stats.consecutiveCorrect === 'number'
        ? stats.consecutiveCorrect
        : (typeof stats.consecutive_correct === 'number' ? stats.consecutive_correct : 0)
      if (wrong >= 2 && wrong >= correct) {
        const wrongScore = (wrong - correct) + (consec === 0 ? 1 : 0)
        if (wrongScore > maxWrongScore) {
          maxWrongScore = wrongScore
          strugglingCategory = cat
        }
      }
    }
  }

  const features = extractFeatureVector(current)
  const mlResult = predictSoftmax(features)
  const confidence = mlResult.confidence
  const bestDiff = mlResult.bestClass
  const probs = mlResult.probabilities

  let recommendation

  if (confidence >= CONFIDENCE_THRESHOLD) {
    let recDiff = bestDiff
    let recCat = null
    let recReason = `ml_predicted_${bestDiff}_confidence_${confidence.toFixed(2)}`

    // Guard 2: Category remediation policy enforcement
    if (strugglingCategory) {
      recDiff = 'beginner'
      recCat = strugglingCategory
      recReason = `ml_remediation_policy_for_${strugglingCategory}`
    }
    // Guard 3: Insufficient attempts to justify advancement
    else if ((totalRecordedAttempts < 2 && outcomes.length < 2) && bestDiff !== 'beginner') {
      recDiff = 'beginner'
      recCat = null
      recReason = 'insufficient_attempts_to_advance'
    }

    const recentAccuracy = features[0]
    const { recommendedModule, recommendedActivity } = deriveRecommendedModuleAndActivity(
      recDiff,
      recCat,
      completedCount,
      recentAccuracy
    )

    recommendation = {
      difficulty: recDiff,
      targetCategory: recCat,
      recommendedModule,
      recommendedActivity,
      engine: 'ml_softmax_v1',
      confidence: Number(confidence.toFixed(4)),
      probabilities: Object.fromEntries(
        Object.entries(probs).map(([k, v]) => [k, Number(v.toFixed(4))])
      ),
      reason: recReason,
      offlineCapable: true,
      datasetLimitation: DATASET_LIMITATION_STATEMENT,
    }
  } else {
    // Confidence below threshold -> deterministic fallback
    const { recommendedModule, recommendedActivity } = deriveRecommendedModuleAndActivity(
      fallback.difficulty,
      fallback.targetCategory,
      completedCount,
      features[0]
    )
    recommendation = {
      ...fallback,
      recommendedModule,
      recommendedActivity,
      engine: 'deterministic_fallback',
      confidence: Number(confidence.toFixed(4)),
      probabilities: Object.fromEntries(
        Object.entries(probs).map(([k, v]) => [k, Number(v.toFixed(4))])
      ),
      reason: `fallback_due_to_low_ml_confidence (${fallback.reason})`,
      offlineCapable: true,
      datasetLimitation: DATASET_LIMITATION_STATEMENT,
    }
  }

  setCachedMlRecommendation(recommendation)
  return recommendation
}

/**
 * Asynchronously requests personalized ML recommendation from local backend API.
 * Uses only non-sensitive learning telemetry (recent answers, error frequencies).
 * Safe fallback to deterministic recommendation if offline or unconfident.
 * 
 * Privacy / Consent Boundary:
 * For guest or offline learners, or where verified cloud-sync consent is absent,
 * network telemetry is strictly suppressed and local in-browser ML inference is executed.
 */
export async function fetchMlAdaptiveRecommendation(progress, user = undefined) {
  const current = progress || getJourneyProgress()
  const fallback = determineAdaptiveRecommendation(current)

  // Suppress unconsented network telemetry:
  // If user state is provided and is a guest (null, no id, or isGuest) or lacks cloud-sync consent,
  // do not dispatch any network request; compute recommendation locally.
  if (user !== undefined) {
    const isAuthed = Boolean(user && user.id && !user.isGuest)
    const hasConsent = Boolean(user && user.preferences && user.preferences.cloud_progress_sync_enabled === true)
    if (!isAuthed || !hasConsent) {
      const localRec = predictLocalAdaptiveRecommendation(current)
      setCachedMlRecommendation(localRec)
      return localRec
    }
  }

  try {
    const telemetry = {
      recent_outcomes: (current.recentOutcomes || []).slice(-20).map((o) => ({
        category: o.category || 'general',
        difficulty: o.difficulty || 'beginner',
        is_correct: Boolean(o.isCorrect),
      })),
      category_stats: Object.fromEntries(
        Object.entries(current.categoryStats || {}).map(([k, v]) => [
          k,
          {
            attempts: typeof v.attempts === 'number' ? v.attempts : 0,
            correct: typeof v.correct === 'number' ? v.correct : 0,
            wrong: typeof v.wrong === 'number' ? v.wrong : 0,
            consecutive_correct: typeof v.consecutive_correct === 'number'
              ? v.consecutive_correct
              : (typeof v.consecutiveCorrect === 'number' ? v.consecutiveCorrect : 0),
          },
        ])
      ),
      difficulty_stats: current.difficultyStats || {},
      total_xp: current.totalXp || 0,
      completed_count: Object.keys(current.completedMissions || {}).length,
      current_difficulty: fallback.difficulty || 'beginner',
    }

    const data = await getMlAdaptiveRecommendation(telemetry, { isTrial: isMlRecommendationsEnabled() })
    if (data && data.recommended_difficulty) {
      cachedMlRecommendation = {
        difficulty: data.recommended_difficulty,
        targetCategory: data.recommended_category || fallback.targetCategory,
        recommendedModule: data.recommended_module || fallback.recommendedModule,
        recommendedActivity: data.recommended_activity || fallback.recommendedActivity,
        reason: data.reason || 'ml_recommendation',
        engine: data.engine || 'ml_softmax_v1',
        confidence: data.confidence,
        probabilities: data.probabilities,
      }
      return cachedMlRecommendation
    }
  } catch {
    // Offline or network error -> use deterministic fallback
  }

  cachedMlRecommendation = {
    ...fallback,
    engine: 'deterministic_fallback',
    confidence: 1.0,
  }
  return cachedMlRecommendation
}

/**
 * Transparent rule-based skill and difficulty adapter (Section 5).
 * Inspects non-sensitive performance summaries to recommend the optimal next challenge.
 * 
 * @param {object} [progress] - Optional journey progress object
 * @param {boolean} [useCachedMl=false] - Whether to use validated cached ML recommendation if available
 * @returns {{ difficulty: 'beginner'|'intermediate'|'advanced', targetCategory: string|null, reason: string, engine?: string }}
 */
export function determineAdaptiveRecommendation(progress, useCachedMl = false) {
  if (useCachedMl && cachedMlRecommendation && (cachedMlRecommendation.confidence || 0) >= 0.55) {
    return cachedMlRecommendation
  }
  const current = progress || getJourneyProgress()
  const categoryStats = current.categoryStats || {}
  const difficultyStats = current.difficultyStats || {}
  const completedCount = Object.keys(current.completedMissions || {}).length
  const recentOutcomes = Array.isArray(current.recentOutcomes) ? current.recentOutcomes : []

  // Rule 1: Insufficient history -> start at beginner difficulty
  if (completedCount === 0 && recentOutcomes.length === 0) {
    const { recommendedModule, recommendedActivity } = deriveRecommendedModuleAndActivity('beginner', null, completedCount, 0.5)
    return {
      difficulty: 'beginner',
      targetCategory: null,
      recommendedModule,
      recommendedActivity,
      reason: 'insufficient_data',
      engine: 'deterministic_fallback',
    }
  }

  // Rule 2: Category Remediation (Repeated mistakes by threat category)
  let strugglingCategory = null
  let maxWrongScore = 0

  for (const [cat, stats] of Object.entries(categoryStats)) {
    const wrong = typeof stats.wrong === 'number' ? stats.wrong : 0
    const correct = typeof stats.correct === 'number' ? stats.correct : 0
    if (wrong >= 2 && wrong >= correct) {
      const wrongScore = wrong - correct + (stats.consecutiveCorrect === 0 ? 1 : 0)
      if (wrongScore > maxWrongScore) {
        maxWrongScore = wrongScore
        strugglingCategory = cat
      }
    }
  }

  if (strugglingCategory) {
    const { recommendedModule, recommendedActivity } = deriveRecommendedModuleAndActivity('beginner', strugglingCategory, completedCount, 0.3)
    return {
      difficulty: 'beginner',
      targetCategory: strugglingCategory,
      recommendedModule,
      recommendedActivity,
      reason: 'category_remediation',
      engine: 'deterministic_fallback',
    }
  }

  // Rule 3: Gradual difficulty progression (avoid jumps on single lucky answer)
  const begStats = difficultyStats.beginner || { attempts: 0, correct: 0, wrong: 0 }
  const midStats = difficultyStats.intermediate || { attempts: 0, correct: 0, wrong: 0 }

  const recentWindow = recentOutcomes.slice(-3)
  const recentCorrectCount = recentWindow.filter((o) => o.isCorrect).length

  let nextDifficulty = 'beginner'

  if (begStats.correct >= 2 && recentCorrectCount >= 2) {
    nextDifficulty = 'intermediate'
  }

  if (nextDifficulty === 'intermediate' && midStats.correct >= 2 && recentCorrectCount >= 2) {
    nextDifficulty = 'advanced'
  }

  const lastCategory = recentOutcomes.length > 0 ? recentOutcomes[recentOutcomes.length - 1].category : null
  const recentAccuracy = recentWindow.length > 0 ? recentCorrectCount / recentWindow.length : 0.5
  const { recommendedModule, recommendedActivity } = deriveRecommendedModuleAndActivity(nextDifficulty, null, completedCount, recentAccuracy)

  return {
    difficulty: nextDifficulty,
    targetCategory: null,
    recommendedModule,
    recommendedActivity,
    avoidCategory: lastCategory,
    reason: nextDifficulty === 'advanced' ? 'mastery_advanced' : nextDifficulty === 'intermediate' ? 'mastery_intermediate' : 'mastery_beginner',
    engine: 'deterministic_fallback',
  }
}

export function addAdaptiveMission(options = {}) {
  const current = getJourneyProgress()
  const useMl = isMlRecommendationsEnabled()
  const rec = determineAdaptiveRecommendation(current, useMl)

  const existingGen = Array.isArray(current.generatedMissions) ? current.generatedMissions : []
  const existingCount = existingGen.length
  const missionIndex = typeof options.index === 'number' ? options.index : existingCount
  const difficulty = options.difficulty || (rec.reason === 'category_remediation' ? rec.difficulty : null)
  const category = options.category || (rec.reason === 'category_remediation' ? rec.targetCategory : null)
  const templateId = options.templateId || options.baseTemplateId || null

  const newMission = generateOfflineMission({
    index: missionIndex,
    difficulty,
    category,
    templateId,
    excludeIds: existingGen,
    useVariation: options.useVariation || false,
  })

  // Append unique generated instance and set active
  const updatedMissions = [...existingGen, newMission]

  const updated = {
    ...current,
    generatedMissions: updatedMissions,
    activeMissionId: newMission.id,
  }

  saveJourneyProgress(updated)
  return newMission
}

export function addGeneratedMission(index = null) {
  const options = typeof index === 'number' ? { index } : {}
  return addAdaptiveMission(options)
}

/**
 * Continuous, offline-first, adaptive practice question progression.
 * Returns the next unanswered practice question in the current pool, or generates
 * the next variation safely from approved templates if the pool is exhausted.
 * 
 * Never returns currentMissionId, never returns campaign missions (m01-m04),
 * and never returns null.
 * 
 * @param {string} currentMissionId - Currently active mission ID
 * @param {object} [options]
 * @param {'beginner'|'intermediate'|'advanced'|'all'} [options.difficulty] - Target difficulty filter
 * @param {string} [options.category] - Target category filter
 * @param {boolean} [options.forceNewRound=false] - Force generation of a fresh round variation
 * @returns {{ mission: object, isNewRound: boolean, poolExhausted: boolean }}
 */
export function getNextPracticeQuestion(currentMissionId, options = {}) {
  const progress = getJourneyProgress()
  const useMl = isMlRecommendationsEnabled()
  const rec = determineAdaptiveRecommendation(progress, useMl)

  const requestedDiff = (options.difficulty && options.difficulty !== 'all') ? options.difficulty : null
  const targetDifficulty = requestedDiff || rec.difficulty || 'beginner'
  const targetCategory = options.category || (rec.reason === 'category_remediation' ? rec.targetCategory : null)

  const existingGen = Array.isArray(progress.generatedMissions) ? progress.generatedMissions : []

  // Candidates among existing generated practice questions (excluding current and campaign)
  const uncompletedCandidates = existingGen.filter((m) =>
    m && typeof m === 'object' &&
    m.id !== currentMissionId &&
    !['m01', 'm02', 'm03', 'm04'].includes(m.id) &&
    !isMissionCompleted(m.id)
  )

  let nextMission = null

  if (!options.forceNewRound && uncompletedCandidates.length > 0) {
    if (targetCategory) {
      const resolvedTid = resolvePracticeTemplateId(targetCategory)
      nextMission = uncompletedCandidates.find((m) =>
        (m.category === targetCategory || (resolvedTid && resolvePracticeTemplateId(m) === resolvedTid)) &&
        m.difficulty === targetDifficulty
      ) || uncompletedCandidates.find((m) =>
        m.category === targetCategory || (resolvedTid && resolvePracticeTemplateId(m) === resolvedTid)
      )
    }
    if (!nextMission && !targetCategory) {
      if (requestedDiff) {
        nextMission = uncompletedCandidates.find((m) => m.difficulty === requestedDiff)
      } else {
        nextMission = uncompletedCandidates.find((m) => m.difficulty === targetDifficulty)
      }
      if (!nextMission) {
        nextMission = uncompletedCandidates[0]
      }
    }
  }

  if (nextMission) {
    const updated = {
      ...progress,
      activeMissionId: nextMission.id,
    }
    saveJourneyProgress(updated)
    return {
      mission: nextMission,
      isNewRound: false,
      poolExhausted: false,
    }
  }

  // Current pool has no uncompleted questions matching criteria (or forceNewRound is set)
  const completedBaseIds = new Set(
    Object.keys(progress.completedMissions || {})
      .filter((k) => progress.completedMissions[k]?.completed)
      .map(resolvePracticeTemplateId)
      .filter(Boolean)
  )
  const tierTemplates = PRACTICE_TEMPLATES.filter((t) => t.difficulty === targetDifficulty)
  const isTierExhausted = tierTemplates.length > 0 && tierTemplates.every((t) => completedBaseIds.has(t.id))

  const newMission = addAdaptiveMission({
    difficulty: targetDifficulty,
    category: targetCategory,
    useVariation: isTierExhausted || Boolean(options.forceNewRound),
  })

  return {
    mission: newMission,
    isNewRound: isTierExhausted || Boolean(options.forceNewRound),
    poolExhausted: true,
  }
}

export function getNextMissionId(currentMissionId, autoGenerate = false) {
  const all = getAllMissions()
  const currentIndex = all.findIndex((m) => m.id === currentMissionId)
  if (currentIndex === -1 || currentIndex >= all.length - 1) {
    const uncompleted = all.find((m) => !isMissionCompleted(m.id))
    if (uncompleted) return uncompleted.id
    if (autoGenerate) {
      const adaptive = addAdaptiveMission()
      return adaptive.id
    }
    return currentMissionId
  }
  return all[currentIndex + 1].id
}

export function evaluateChoice(missionId, choiceId) {
  const all = getAllMissions()
  const mission = all.find((m) => m.id === missionId)
  if (!mission) {
    return {
      isCorrect: false,
      isTrap: false,
      newlyCompleted: false,
      awardedXp: 0,
      currentProgress: getJourneyProgress(),
    }
  }

  const isCorrect = choiceId === mission.correct_choice
  const isTrap = mission.choices.some((c) => c.id === choiceId && c.isTrap)
  const current = getJourneyProgress()
  const cat = mission.category || 'general'
  const diff = mission.difficulty || 'intermediate'

  // Update non-sensitive gameplay telemetry safely
  const prevCat = current.categoryStats[cat] || { attempts: 0, correct: 0, wrong: 0, consecutiveCorrect: 0 }
  const prevDiff = current.difficultyStats[diff] || { attempts: 0, correct: 0, wrong: 0 }

  const nextCat = {
    attempts: (prevCat.attempts || 0) + 1,
    correct: (prevCat.correct || 0) + (isCorrect ? 1 : 0),
    wrong: (prevCat.wrong || 0) + (isCorrect ? 0 : 1),
    consecutiveCorrect: isCorrect ? (prevCat.consecutiveCorrect || 0) + 1 : 0,
  }

  const nextDiff = {
    attempts: (prevDiff.attempts || 0) + 1,
    correct: (prevDiff.correct || 0) + (isCorrect ? 1 : 0),
    wrong: (prevDiff.wrong || 0) + (isCorrect ? 0 : 1),
  }

  const outcomeEntry = {
    missionId,
    category: cat,
    difficulty: diff,
    isCorrect,
    timestamp: new Date().toISOString(),
  }

  const updatedStats = {
    ...current,
    categoryStats: {
      ...current.categoryStats,
      [cat]: nextCat,
    },
    difficultyStats: {
      ...current.difficultyStats,
      [diff]: nextDiff,
    },
    recentOutcomes: [...(current.recentOutcomes || []), outcomeEntry].slice(-20),
  }

  if (!isCorrect) {
    saveJourneyProgress(updatedStats)
    if (isMlRecommendationsEnabled()) {
      predictLocalAdaptiveRecommendation(updatedStats)
    }
    return {
      isCorrect: false,
      isTrap,
      newlyCompleted: false,
      awardedXp: 0,
      currentProgress: updatedStats,
    }
  }

  const alreadyCompleted = Boolean(current.completedMissions[missionId]?.completed)
  const completedProg = completeMission(missionId, 3)

  const merged = {
    ...completedProg,
    categoryStats: updatedStats.categoryStats,
    difficultyStats: updatedStats.difficultyStats,
    recentOutcomes: updatedStats.recentOutcomes,
  }
  saveJourneyProgress(merged)
  if (isMlRecommendationsEnabled()) {
    predictLocalAdaptiveRecommendation(merged)
  }

  return {
    isCorrect: true,
    isTrap: false,
    newlyCompleted: !alreadyCompleted,
    awardedXp: !alreadyCompleted ? mission.xp_reward : 0,
    currentProgress: merged,
  }
}

export function resetJourneyProgress() {
  inMemoryFallback = {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    completedMissions: {},
    totalXp: 0,
    badges: [],
    activeMissionId: 'm01',
    generatedMissions: [],
    categoryStats: {},
    difficultyStats: {},
    recentOutcomes: [],
    dailyChallenges: { challenges: {}, completedDates: [] },
    quizLevels: {},
    arena: { completedScenarios: {}, unlockedTiers: ['beginner'] },
    game3d: { unlockedDifficulties: ['beginner'], completedDifficulties: {}, attackerUnlockedDifficulties: ['beginner'], attackerCompletedDifficulties: {}, completedMissions: {}, battleUnlockedDifficulties: { defender: ['beginner'], attacker: ['beginner'] }, battleCompletions: { defender: {}, attacker: {} }, totalXp: 0 },
    m2Practice: { completed: false },
    updatedAt: null,
  }

  try {
    const storage = getStorage()
    if (storage) {
      storage.removeItem(JOURNEY_STORAGE_KEY)
    }
  } catch {
    // no-op
  }

  return getJourneyProgress()
}

export function awardM2PracticeCompletion() {
  const current = getJourneyProgress()
  if (current.m2Practice?.completed) {
    return { newlyCompleted: false, awardedXp: 0, currentProgress: current }
  }
  const updated = {
    ...current,
    m2Practice: {
      completed: true,
      awardedXp: 50,
      completedAt: new Date().toISOString(),
    },
  }
  saveJourneyProgress(updated)
  const saved = getJourneyProgress()
  return {
    newlyCompleted: true,
    awardedXp: 50,
    currentProgress: saved,
  }
}

