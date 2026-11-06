// Curated Daily Challenge Bank and Deterministic Selection for CyberShield Ethiopia
// 100% offline, privacy-first, zero PRNG, strict anti-duplicate XP enforcement.

import { getJourneyProgress, saveJourneyProgress } from './journey.js'
import { submitDailyChallengeApi } from './api.js'
import { saveCachedNotifications, getCachedNotifications } from './notificationStorage.js'

export const DAILY_CHALLENGES = [
  {
    id: 'dc_01',
    topic: 'phishing_advance_fee',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_01.scenario',
    question_key: 'daily.dc_01.question',
    options_keys: [
      'daily.dc_01.o0',
      'daily.dc_01.o1',
      'daily.dc_01.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_01.explanation',
  },
  {
    id: 'dc_02',
    topic: 'credential_harvesting_telecom',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_02.scenario',
    question_key: 'daily.dc_02.question',
    options_keys: [
      'daily.dc_02.o0',
      'daily.dc_02.o1',
      'daily.dc_02.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_02.explanation',
  },
  {
    id: 'dc_03',
    topic: 'fake_mobile_money_reversal',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_03.scenario',
    question_key: 'daily.dc_03.question',
    options_keys: [
      'daily.dc_03.o0',
      'daily.dc_03.o1',
      'daily.dc_03.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_03.explanation',
  },
  {
    id: 'dc_04',
    topic: 'malicious_apk_distribution',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_04.scenario',
    question_key: 'daily.dc_04.question',
    options_keys: [
      'daily.dc_04.o0',
      'daily.dc_04.o1',
      'daily.dc_04.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_04.explanation',
  },
  {
    id: 'dc_05',
    topic: 'public_wifi_interception',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_05.scenario',
    question_key: 'daily.dc_05.question',
    options_keys: [
      'daily.dc_05.o0',
      'daily.dc_05.o1',
      'daily.dc_05.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_05.explanation',
  },
  {
    id: 'dc_06',
    topic: 'password_entropy_hygiene',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_06.scenario',
    question_key: 'daily.dc_06.question',
    options_keys: [
      'daily.dc_06.o0',
      'daily.dc_06.o1',
      'daily.dc_06.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_06.explanation',
  },
  {
    id: 'dc_07',
    topic: 'support_bot_impersonation',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_07.scenario',
    question_key: 'daily.dc_07.question',
    options_keys: [
      'daily.dc_07.o0',
      'daily.dc_07.o1',
      'daily.dc_07.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_07.explanation',
  },
  {
    id: 'dc_08',
    topic: 'lookalike_domain_https',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_08.scenario',
    question_key: 'daily.dc_08.question',
    options_keys: [
      'daily.dc_08.o0',
      'daily.dc_08.o1',
      'daily.dc_08.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_08.explanation',
  },
  {
    id: 'dc_09',
    topic: 'predatory_loan_permissions',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_09.scenario',
    question_key: 'daily.dc_09.question',
    options_keys: [
      'daily.dc_09.o0',
      'daily.dc_09.o1',
      'daily.dc_09.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_09.explanation',
  },
  {
    id: 'dc_10',
    topic: 'secondary_id_harvesting',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_10.scenario',
    question_key: 'daily.dc_10.question',
    options_keys: [
      'daily.dc_10.o0',
      'daily.dc_10.o1',
      'daily.dc_10.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_10.explanation',
  },
  {
    id: 'dc_11',
    topic: 'qr_code_quishing',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_11.scenario',
    question_key: 'daily.dc_11.question',
    options_keys: [
      'daily.dc_11.o0',
      'daily.dc_11.o1',
      'daily.dc_11.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_11.explanation',
  },
  {
    id: 'dc_12',
    topic: 'emergency_friend_pretext',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_12.scenario',
    question_key: 'daily.dc_12.question',
    options_keys: [
      'daily.dc_12.o0',
      'daily.dc_12.o1',
      'daily.dc_12.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_12.explanation',
  },
  {
    id: 'dc_13',
    topic: 'totp_authenticator_defense',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_13.scenario',
    question_key: 'daily.dc_13.question',
    options_keys: [
      'daily.dc_13.o0',
      'daily.dc_13.o1',
      'daily.dc_13.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_13.explanation',
  },
  {
    id: 'dc_14',
    topic: 'evidence_preservation_dossier',
    badge_id: 'badge_daily_defender',
    xp_reward: 50,
    scenario_key: 'daily.dc_14.scenario',
    question_key: 'daily.dc_14.question',
    options_keys: [
      'daily.dc_14.o0',
      'daily.dc_14.o1',
      'daily.dc_14.o2',
    ],
    correct_choice: 1,
    explanation_key: 'daily.dc_14.explanation',
  },
]

/**
 * Returns current local date as 'YYYY-MM-DD'
 */
export function getTodayDateString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns 1-indexed day of the year in UTC, exactly matching Python's tm_yday.
 */
export function getUtcDayOfYear(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const startOfYear = new Date(Date.UTC(y, 0, 1))
  const diffDays = Math.floor((dt - startOfYear) / 86400000)
  return diffDays + 1
}

/**
 * Deterministically select a challenge based on date string (YYYY-MM-DD).
 */
export function getDailyChallenge(dateStr = null) {
  const targetDate = dateStr || getTodayDateString()
  const dayOfYear = getUtcDayOfYear(targetDate)
  const idx = dayOfYear % DAILY_CHALLENGES.length
  return {
    ...DAILY_CHALLENGES[idx],
    date: targetDate,
  }
}

export const getDailyChallengeForDate = getDailyChallenge

/**
 * Evaluate a defensive choice against the daily challenge offline.
 */
export function evaluateDailyChoice(dateStr, chosenIndex) {
  const targetDate = dateStr || getTodayDateString()
  const challenge = getDailyChallenge(targetDate)
  const isCorrect = chosenIndex === challenge.correct_choice
  return {
    isCorrect,
    challengeId: challenge.id,
    correctChoice: challenge.correct_choice,
    explanationKey: challenge.explanation_key,
  }
}

/**
 * Check if the user has already completed the daily challenge for dateStr.
 */
export function getDailyChallengeStatus(dateStr = null) {
  const targetDate = dateStr || getTodayDateString()
  const progress = getJourneyProgress()
  const daily = progress?.dailyChallenges || {}
  const record = daily.challenges?.[targetDate] || daily[targetDate]

  if (record && record.completed) {
    return {
      completed: true,
      chosenChoice: record.chosenChoice,
      isCorrect: Boolean(record.isCorrect),
      completedAt: record.completedAt,
      xpAwarded: record.xpAwarded || 0,
      canEarnXp: false,
    }
  }

  return {
    completed: false,
    chosenChoice: null,
    isCorrect: null,
    completedAt: null,
    xpAwarded: 0,
    canEarnXp: true,
  }
}

/**
 * Submit an answer for the daily challenge with strict anti-duplicate XP enforcement.
 * Accepts either (dateStr, chosenIndex, user) or ({ dateStr, choice, user }).
 */
export async function submitDailyChallengeAnswer(dateArg, choiceArg, userArg = null) {
  let dateStr, chosenIndex, user
  if (typeof dateArg === 'object' && dateArg !== null) {
    dateStr = dateArg.dateStr || dateArg.date || null
    chosenIndex = dateArg.choice !== undefined ? dateArg.choice : dateArg.chosenIndex
    user = dateArg.user || null
  } else {
    dateStr = dateArg
    chosenIndex = choiceArg
    user = userArg
  }

  const targetDate = dateStr || getTodayDateString()
  const challenge = getDailyChallenge(targetDate)
  const isCorrect = chosenIndex === challenge.correct_choice

  const progress = getJourneyProgress()
  const daily = progress.dailyChallenges && typeof progress.dailyChallenges === 'object'
    ? progress.dailyChallenges
    : { challenges: {}, completedDates: [] }
  const challengesMap = daily.challenges && typeof daily.challenges === 'object'
    ? daily.challenges
    : (daily.challenges = {})

  // 1. Idempotency Check: if already completed, NEVER award duplicate XP
  const existing = challengesMap[targetDate] || daily[targetDate]
  if (existing && existing.completed) {
    return {
      isCorrect: Boolean(existing.isCorrect),
      correctChoice: challenge.correct_choice,
      explanationKey: challenge.explanation_key,
      xpAwarded: 0, // Duplicate XP strictly prevented
      alreadyCompleted: true,
      badgeAwarded: null,
    }
  }

  // If answer is incorrect: return outcome and explanation, award 0 XP, do not mark completed
  if (!isCorrect) {
    return {
      isCorrect: false,
      correctChoice: challenge.correct_choice,
      explanationKey: challenge.explanation_key,
      xpAwarded: 0,
      alreadyCompleted: false,
      badgeAwarded: null,
    }
  }

  // 2. Successful completion
  const xpAwarded = challenge.xp_reward
  const now = new Date().toISOString()
  const record = {
    completed: true,
    chosenChoice: chosenIndex,
    isCorrect: true,
    completedAt: now,
    xpAwarded,
  }

  challengesMap[targetDate] = record
  daily[targetDate] = record // dual store for backwards compatibility

  const completedDates = Array.isArray(daily.completedDates) ? [...daily.completedDates] : []
  if (!completedDates.includes(targetDate) && isCorrect) {
    completedDates.push(targetDate)
  }
  daily.completedDates = completedDates

  // Check badges
  const currentBadges = Array.isArray(progress.badges) ? [...progress.badges] : []
  let newBadge = null

  if (isCorrect && !currentBadges.includes('badge_daily_defender')) {
    currentBadges.push('badge_daily_defender')
    newBadge = 'badge_daily_defender'
  }

  if (completedDates.length >= 3 && !currentBadges.includes('badge_daily_streak_3')) {
    currentBadges.push('badge_daily_streak_3')
    newBadge = 'badge_daily_streak_3'
  }

  const updatedProgress = {
    ...progress,
    dailyChallenges: daily,
    totalXp: (progress.totalXp || 0) + xpAwarded,
    badges: currentBadges,
    updatedAt: now,
  }

  saveJourneyProgress(updatedProgress)

  // 3. Queue / send notifications via Phase 6.1 Notification Center
  const accountId = user ? user.id : 'guest'
  try {
    const cached = await getCachedNotifications(accountId)
    const newNotifs = []

    // Completion notification (deduplicated by date)
    const alreadyNotified = cached.some(
      (n) => n.type === 'challenge' && n.data?.date === targetDate
    )
    if (!alreadyNotified && isCorrect) {
      newNotifs.push({
        id: `daily_${targetDate}_${accountId}`,
        account_id: accountId,
        type: 'challenge',
        title_key: 'notif.daily_completed_title',
        message_key: 'notif.daily_completed_msg',
        data: { date: targetDate, xp: xpAwarded },
        is_read: false,
        created_at: now,
        is_local_only: !user,
      })
    }

    // Badge earned notification (deduplicated by badge ID)
    if (newBadge) {
      const badgeNotified = cached.some(
        (n) => n.type === 'progress' && n.data?.badge_id === newBadge
      )
      if (!badgeNotified) {
        newNotifs.push({
          id: `badge_${newBadge}_${accountId}`,
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
    }

    if (newNotifs.length > 0) {
      await saveCachedNotifications(accountId, newNotifs)
    }
  } catch {
    // Non-blocking notification recording
  }

  // 4. Server synchronization for authenticated accounts with sync enabled
  if (user?.preferences?.cloud_progress_sync_enabled) {
    try {
      await submitDailyChallengeApi({ date: targetDate, choice: chosenIndex })
    } catch {
      // Offline fallback: progress preserved locally
    }
  }

  return {
    isCorrect,
    correctChoice: challenge.correct_choice,
    explanationKey: challenge.explanation_key,
    xpAwarded,
    alreadyCompleted: false,
    badgeAwarded: newBadge,
  }
}

export const recordDailyChallengeCompleted = submitDailyChallengeAnswer

