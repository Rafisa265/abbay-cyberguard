/**
 * ABBAY CYBERGUARD — ABBAY CYBER ACADEMY
 * Persistent Local Storage Engine (SR-09 & Guest-Mode Privacy Preserving)
 *
 * Persists learner progress, completed lessons, sub-sections, quiz outcomes,
 * simulation lab challenges, and earned certificates locally on the user's device.
 * Survives page refresh and browser restart via unified offline journey storage.
 */

import { getJourneyProgress, saveJourneyProgress } from './journey.js'

const DEFAULT_STATE = {
  version: 2,
  activeLevel: 1,
  unlockedLevels: [1],
  completedLevels: {}, // { [lvlNum]: { passed, score, total, percentage, stars, completed_at } }
  completedLessons: {}, // { [topicKey]: { completed: true, completedSections: [], lastCompletedAt } }
  activeLesson: 0,
  activeSection: 'overview',
  practicalChallenges: {}, // { [challengeId]: { completed: true, score, completed_at } }
  quizAnswers: {}, // { [questionId]: chosenOptionIndex }
  adaptiveOptOut: false,
  certificateSyncConsent: false,
  certificateSyncConsentUserId: null,
  earnedCertificates: [], // [ { id, certificateId, levelNum, title, recipientName, issueDate, verificationCode, score, stars } ]
  lastUpdated: null,
}

let inMemoryState = { ...DEFAULT_STATE }

/**
 * Load persistent Academy progress with safe fallback.
 * Uses unified offline journey progress store to preserve privacy and guest access.
 */
export function loadAcademyProgress() {
  try {
    const jp = getJourneyProgress()
    if (jp && jp.academyProgress && typeof jp.academyProgress === 'object') {
      const merged = {
        ...DEFAULT_STATE,
        ...jp.academyProgress,
        completedLevels: {
          ...(jp.quizLevels || {}),
          ...(jp.academyProgress.completedLevels || {}),
        },
      }
      inMemoryState = merged
      return merged
    }

    if (jp && jp.quizLevels && Object.keys(jp.quizLevels).length > 0) {
      const unlocked = [1]
      for (let l = 1; l <= 6; l++) {
        if (jp.quizLevels[l]?.passed && l < 6) {
          unlocked.push(l + 1)
        }
      }
      const migrated = {
        ...DEFAULT_STATE,
        completedLevels: jp.quizLevels,
        unlockedLevels: Array.from(new Set(unlocked)),
        lastUpdated: new Date().toISOString(),
      }
      inMemoryState = migrated
      return migrated
    }
  } catch (err) {
    console.warn('[CyberShield Academy] Storage read error, falling back to in-memory:', err)
  }

  return inMemoryState
}

/**
 * Save persistent Academy progress to unified offline journey state.
 */
export function saveAcademyProgress(state) {
  const updated = {
    ...state,
    lastUpdated: new Date().toISOString(),
  }

  inMemoryState = updated

  try {
    const jp = getJourneyProgress()
    const mergedQuizLevels = { ...(jp.quizLevels || {}), ...(updated.completedLevels || {}) }
    saveJourneyProgress({
      ...jp,
      quizLevels: mergedQuizLevels,
      academyProgress: updated,
    })
  } catch (err) {
    // Non-critical journey sync failure
  }

  return updated
}

export function hasCertificateSyncConsent(userId) {
  if (userId === null || userId === undefined) return false
  const current = loadAcademyProgress()
  return current.certificateSyncConsent === true &&
    String(current.certificateSyncConsentUserId) === String(userId)
}

export function saveCertificateSyncConsent(enabled, userId) {
  if (enabled && (userId === null || userId === undefined)) {
    throw new Error('An authenticated account is required to enable certificate sync.')
  }
  const current = loadAcademyProgress()
  return saveAcademyProgress({
    ...current,
    certificateSyncConsent: Boolean(enabled),
    certificateSyncConsentUserId: enabled ? String(userId) : null,
  })
}

/**
 * Records completion of a lesson sub-section (e.g. 'overview', 'how', 'examples', 'warnings', 'actions', 'recap').
 */
export function markLessonSectionCompleted(topicKey, sectionKey) {
  const current = loadAcademyProgress()
  const completedLessons = { ...(current.completedLessons || {}) }
  const lessonData = completedLessons[topicKey] || { completed: false, completedSections: [] }

  const sections = Array.from(new Set([...(lessonData.completedSections || []), sectionKey]))
  const allSixDone = ['overview', 'how', 'examples', 'warnings', 'actions', 'recap'].every((s) =>
    sections.includes(s)
  )

  completedLessons[topicKey] = {
    completed: allSixDone,
    completedSections: sections,
    lastCompletedAt: new Date().toISOString(),
  }

  return saveAcademyProgress({
    ...current,
    completedLessons,
  })
}

/**
 * Records completion of an interactive simulation lab challenge.
 */
/**
 * Records user quiz answers for persistence across page refreshes and browser restarts.
 */
export function saveQuizAnswers(answersMap) {
  const current = loadAcademyProgress()
  const updatedAnswers = { ...(current.quizAnswers || {}), ...(answersMap || {}) }
  return saveAcademyProgress({
    ...current,
    quizAnswers: updatedAnswers,
  })
}

export function recordSimulationChallenge(challengeId, score = 100) {
  const current = loadAcademyProgress()
  const practicalChallenges = { ...(current.practicalChallenges || {}) }

  practicalChallenges[challengeId] = {
    completed: true,
    score,
    completed_at: new Date().toISOString(),
  }

  return saveAcademyProgress({
    ...current,
    practicalChallenges,
  })
}

/**
 * Records an earned completion certificate.
 */
export function saveEarnedCertificate(certRecord) {
  const current = loadAcademyProgress()
  const existing = Array.isArray(current.earnedCertificates) ? [...current.earnedCertificates] : []

  // Prevent duplicate certificates for same level/course and recipient
  const duplicateIdx = existing.findIndex((c) => c.certificateId === certRecord.certificateId)
  if (duplicateIdx >= 0) {
    existing[duplicateIdx] = certRecord
  } else {
    existing.push(certRecord)
  }

  return saveAcademyProgress({
    ...current,
    earnedCertificates: existing,
  })
}

/**
 * Resets local Academy progress cleanly.
 */
export function resetAcademyProgress() {
  const fresh = { ...DEFAULT_STATE, lastUpdated: new Date().toISOString() }
  inMemoryState = fresh

  try {
    const jp = getJourneyProgress()
    saveJourneyProgress({
      ...jp,
      quizLevels: {},
      academyProgress: fresh,
    })
  } catch (err) {
    // Non-critical journey sync failure
  }

  return fresh
}
