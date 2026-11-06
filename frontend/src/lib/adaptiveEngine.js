/**
 * ABBAY CYBERGUARD — ABBAY CYBER ACADEMY
 * Lightweight Adaptive Learning & Smart Revision Engine
 *
 * Evaluates learner competencies transparently using quiz history, quick checks,
 * and practical challenge results. Operates entirely on-device (zero PII transmitted).
 */

import { TOPICS, QUESTION_BANK, isCorrect } from './quiz.js'

/**
 * Calculates topic mastery metrics based on user's answers.
 * Returns an object with mastery percentage and question counts per topic.
 */
export function calculateTopicMastery(answers = {}, completedLessons = {}) {
  const mastery = {}

  for (const topic of TOPICS) {
    const topicQuestions = QUESTION_BANK.filter((q) => q.topic === topic)
    let answeredCount = 0
    let correctCount = 0

    for (const q of topicQuestions) {
      if (answers[q.id] !== undefined) {
        answeredCount++
        if (isCorrect(q, answers[q.id])) {
          correctCount++
        }
      }
    }

    const percentage = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
    const lessonDone = Boolean(completedLessons[topic]?.completed)

    let status = 'not_started'
    if (answeredCount > 0) {
      if (percentage >= 80) status = 'mastered'
      else if (percentage >= 60) status = 'review_recommended'
      else status = 'needs_reinforcement'
    } else if (lessonDone) {
      status = 'lesson_completed'
    }

    mastery[topic] = {
      topic,
      answeredCount,
      correctCount,
      totalQuestions: topicQuestions.length,
      percentage,
      status,
      lessonDone,
    }
  }

  return mastery
}

/**
 * Generates transparent learning recommendations based on mastery and quiz performance.
 */
export function generateAdaptiveRecommendations(mastery, activeLevel = 1, answers = {}) {
  const recommendations = []

  // Check for weak topics (< 60% accuracy)
  for (const topic of TOPICS) {
    const m = mastery[topic]
    if (m && m.answeredCount >= 2 && m.percentage < 60) {
      recommendations.push({
        id: `rec_weak_${topic}`,
        topic,
        type: 'needs_practice',
        priority: 'high',
        reasonKey: `academy.rec.weak_${topic}`,
        defaultReason: `Your score on ${topic} questions is ${m.percentage}%. Reviewing this lesson will strengthen your defense against active attacks.`,
        suggestedAction: 'review_lesson',
        topicIndex: TOPICS.indexOf(topic),
      })
    } else if (m && m.answeredCount >= 2 && m.percentage >= 60 && m.percentage < 80) {
      recommendations.push({
        id: `rec_review_${topic}`,
        topic,
        type: 'reinforce',
        priority: 'medium',
        reasonKey: `academy.rec.review_${topic}`,
        defaultReason: `Good progress in ${topic} (${m.percentage}%), but a quick review of key attack examples will help you reach full mastery.`,
        suggestedAction: 'review_lesson',
        topicIndex: TOPICS.indexOf(topic),
      })
    }
  }

  // Check if all answered topics are >= 80%
  const allMastered = TOPICS.every((t) => mastery[t]?.percentage >= 80 && mastery[t]?.answeredCount >= 2)
  if (allMastered) {
    recommendations.push({
      id: 'rec_ready_advance',
      topic: 'general',
      type: 'advance',
      priority: 'low',
      reasonKey: 'academy.rec.ready_advance',
      defaultReason: 'Outstanding defense proficiency across all five cybersecurity topics! You are ready to advance to higher level challenges.',
      suggestedAction: 'advance_level',
      topicIndex: 0,
    })
  }

  return recommendations
}

/**
 * Calculates Spaced Repetition queue for missed topics.
 * Standard intervals: 1 day, 3 days, 7 days, 14 days, 30 days.
 */
export function getSmartRevisionQueue(mastery) {
  const revisionItems = []

  for (const topic of TOPICS) {
    const m = mastery[topic]
    if (m && m.answeredCount > 0 && m.percentage < 80) {
      revisionItems.push({
        topic,
        percentage: m.percentage,
        missedCount: m.answeredCount - m.correctCount,
        recommendedDays: m.percentage < 50 ? 1 : 3,
        urgency: m.percentage < 50 ? 'urgent' : 'suggested',
      })
    }
  }

  // Sort by lowest percentage first
  return revisionItems.sort((a, b) => a.percentage - b.percentage)
}

