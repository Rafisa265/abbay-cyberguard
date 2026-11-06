// Unified Learning Progress Architecture for CyberShield Ethiopia
// Integrates Cyber Hero Journey, Learn Quizzes, and Daily Challenges into a single,
// authoritative progress model with strict anti-duplicate XP and notification integration.

import { getJourneyProgress, saveJourneyProgress, getRank, RANKS } from './journey.js'
import { saveProgress } from './api.js'
import { saveCachedNotifications, getCachedNotifications } from './notificationStorage.js'

export const QUIZ_LEVEL_XP = 100

/**
 * Authoritative Unified Progress Reader
 * Derives overall metrics directly from the single source of truth (journey progress).
 */
export function getUnifiedLearningProgress() {
  const p = getJourneyProgress()

  const completedMissions = p.completedMissions || {}
  const dailyChallenges = p.dailyChallenges || {}
  const quizLevels = p.quizLevels || {}
  const badges = Array.isArray(p.badges) ? p.badges : []
  const totalXp = typeof p.totalXp === 'number' ? p.totalXp : 0
  const rank = getRank(totalXp)

  // Core campaign missions (m01..m04)
  const coreCompletedCount = ['m01', 'm02', 'm03', 'm04'].filter(
    (id) => completedMissions[id]?.completed
  ).length

  // Practice missions
  const practiceCompletedCount = Object.keys(completedMissions).filter(
    (id) => !['m01', 'm02', 'm03', 'm04'].includes(id) && completedMissions[id]?.completed
  ).length

  // Quiz levels passed across all 6 academy levels
  const quizPassedCount = [1, 2, 3, 4, 5, 6].filter((lvl) => quizLevels[lvl]?.passed).length

  const dailyChallengesMap = dailyChallenges.challenges || dailyChallenges
  const dailyCompletedCount = Array.isArray(dailyChallenges.completedDates)
    ? dailyChallenges.completedDates.length
    : Object.keys(dailyChallengesMap).filter((d) => dailyChallengesMap[d]?.completed).length

  const arenaScenarios = p.arena?.completedScenarios || {}
  const arenaCompletedCount = Object.values(arenaScenarios).filter((s) => s?.completed).length
  let arenaTotalXp = 0
  for (const aKey of Object.keys(arenaScenarios)) {
    if (arenaScenarios[aKey]?.completed) {
      arenaTotalXp += typeof arenaScenarios[aKey].xpAwarded === 'number' ? arenaScenarios[aKey].xpAwarded : 50
    }
  }

  return {
    totalXp,
    totalXP: totalXp,
    missionsCompleted: coreCompletedCount + practiceCompletedCount,
    quizzesPassed: quizPassedCount,
    dailyChallengesCompleted: dailyCompletedCount,
    arenaCompleted: arenaCompletedCount,
    rank,
    coreMissions: {
      completed: coreCompletedCount,
      total: 4,
      isAllCompleted: coreCompletedCount >= 4,
    },
    practiceMissions: {
      completed: practiceCompletedCount,
    },
    quiz: {
      completedLevels: quizPassedCount,
      passedCount: quizPassedCount,
      totalLevels: 6,
      isAllPassed: quizPassedCount >= 6,
      levelsData: quizLevels,
    },
    dailyChallenge: {
      completedCount: dailyCompletedCount,
      dates: dailyChallenges,
    },
    arena: {
      arenaCompleted: arenaCompletedCount,
      completedCount: arenaCompletedCount,
      totalXp: arenaTotalXp,
      unlockedTiers: p.arena?.unlockedTiers || ['beginner'],
      completedScenarios: Object.keys(arenaScenarios),
      scenariosMap: arenaScenarios,
    },
    badges: [...badges],
    activeMissionId: p.activeMissionId || 'm01',
  }
}

/**
 * Record a Quiz Level pass with anti-duplicate XP enforcement.
 * Accepts either (lvlNum, score, stars, user) or ({ level, score, stars, user }).
 */
export async function recordQuizLevelPassed(lvlArg, scoreArg, starsArg, userArg = null) {
  let lvlNum, score, stars, user
  if (typeof lvlArg === 'object' && lvlArg !== null) {
    lvlNum = lvlArg.level || lvlArg.lvlNum || 1
    score = typeof lvlArg.score === 'number' ? lvlArg.score : 3
    stars = typeof lvlArg.stars === 'number' ? lvlArg.stars : (typeof lvlArg.total === 'number' ? lvlArg.total : 3)
    user = lvlArg.user || null
  } else {
    lvlNum = lvlArg
    score = typeof scoreArg === 'number' ? scoreArg : 3
    stars = typeof starsArg === 'number' ? starsArg : 3
    user = userArg
  }

  const p = getJourneyProgress()
  const quizLevels = p.quizLevels || {}
  const alreadyPassed = Boolean(quizLevels[lvlNum]?.passed)

  const now = new Date().toISOString()
  const xpReward = alreadyPassed ? 0 : QUIZ_LEVEL_XP

  // Update level details (preserve or improve high score)
  const prevScore = quizLevels[lvlNum]?.score || 0
  quizLevels[lvlNum] = {
    passed: true,
    score: Math.max(score, prevScore),
    stars: Math.max(stars, quizLevels[lvlNum]?.stars || 1),
    completed_at: quizLevels[lvlNum]?.completed_at || now,
    updated_at: now,
  }

  // Check if foundational 4 levels or all 6 academy levels are passed
  const currentBadges = Array.isArray(p.badges) ? [...p.badges] : []
  let newBadge = null
  const allFourPassed = [1, 2, 3, 4].every((l) => quizLevels[l]?.passed)
  if (allFourPassed && !currentBadges.includes('badge_academy_graduate')) {
    currentBadges.push('badge_academy_graduate')
    newBadge = 'badge_academy_graduate'
  }
  const allSixPassed = [1, 2, 3, 4, 5, 6].every((l) => quizLevels[l]?.passed)
  if (allSixPassed && !currentBadges.includes('badge_academy_master')) {
    currentBadges.push('badge_academy_master')
    if (!newBadge) newBadge = 'badge_academy_master'
  }

  const updatedProgress = {
    ...p,
    quizLevels,
    totalXp: (p.totalXp || 0) + xpReward,
    badges: currentBadges,
    updatedAt: now,
  }

  saveJourneyProgress(updatedProgress)

  // Queue notifications if first time pass
  if (!alreadyPassed) {
    const accountId = user ? user.id : 'guest'
    try {
      const cached = await getCachedNotifications(accountId)
      const newNotifs = []

      // Quiz pass notification
      newNotifs.push({
        id: `quiz_lvl_${lvlNum}_${Date.now()}`,
        account_id: accountId,
        type: 'progress',
        title_key: 'notif.quiz_level_passed_title',
        message_key: 'notif.quiz_level_passed_msg',
        data: { level: lvlNum, xp: xpReward },
        is_read: false,
        created_at: now,
        is_local_only: !user,
      })

      // Academy Graduate badge notification
      if (newBadge) {
        newNotifs.push({
          id: `badge_${newBadge}_${Date.now()}`,
          account_id: accountId,
          type: 'progress',
          title_key: 'notif.badge_earned_title',
          message_key: 'notif.badge_earned_msg',
          data: { badge_id: newBadge },
          is_read: false,
          created_at: now,
          is_local_only: !user,
        })
      }

      await saveCachedNotifications(accountId, newNotifs)
    } catch {
      // Non-blocking notification recording
    }

    // Cloud sync if enabled
    if (user?.preferences?.cloud_progress_sync_enabled) {
      try {
        const unlocked = [1]
        for (let l = 1; l <= 4; l++) {
          if (quizLevels[l]?.passed && l < 4) {
            unlocked.push(l + 1)
          }
        }
        await saveProgress({
          activeLevel: lvlNum,
          unlockedLevels: Array.from(new Set(unlocked)),
          completedLevels: quizLevels,
        })
      } catch {
        // Safe offline preservation
      }
    }
  }

  return {
    alreadyPassed,
    xpAwarded: xpReward,
    badgeAwarded: newBadge,
    updatedProgress,
  }
}
