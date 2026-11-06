// Language-neutral quiz structure; text lives in locale files under learn.q.<id>.*
export const TOPICS = ['phishing', 'password', 'privacy', 'response', 'website']

export const LEVELS = [
  { id: 'lvl1', num: 1, passThreshold: 80, questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'] },
  { id: 'lvl2', num: 2, passThreshold: 80, questionIds: ['q8', 'q9', 'q10', 'q11', 'q12'] },
  { id: 'lvl3', num: 3, passThreshold: 80, questionIds: ['q13', 'q14', 'q15', 'q16', 'q17'] },
  { id: 'lvl4', num: 4, passThreshold: 80, questionIds: ['q18', 'q19', 'q20', 'q21', 'q22'] },
  { id: 'lvl5', num: 5, passThreshold: 80, questionIds: ['q23', 'q24', 'q25', 'q26', 'q27'] },
  { id: 'lvl6', num: 6, passThreshold: 80, questionIds: ['q28', 'q29', 'q30', 'q31', 'q32'] },
]

export const QUICK_CHECKS = {
  phishing: { answer: 0 },
  password: { answer: 1 },
  privacy: { answer: 1 },
  response: { answer: 0 },
  website: { answer: 1 },
}

export const QUESTION_BANK = [
  // Level 1: Beginner — Essential Awareness (7 questions)
  { id: 'q1', topic: 'phishing', level: 1, answer: 1 },
  { id: 'q2', topic: 'phishing', level: 1, answer: 2 },
  { id: 'q3', topic: 'password', level: 1, answer: 0 },
  { id: 'q4', topic: 'password', level: 1, answer: 2 },
  { id: 'q5', topic: 'privacy', level: 1, answer: 1 },
  { id: 'q6', topic: 'response', level: 1, answer: 0 },
  { id: 'q7', topic: 'website', level: 1, answer: 1 },

  // Level 2: Foundation — Threat Recognition & Practice (5 questions)
  { id: 'q8', topic: 'phishing', level: 2, answer: 0 },
  { id: 'q9', topic: 'password', level: 2, answer: 0 },
  { id: 'q10', topic: 'privacy', level: 2, answer: 1 },
  { id: 'q11', topic: 'response', level: 2, answer: 0 },
  { id: 'q12', topic: 'website', level: 2, answer: 1 },

  // Level 3: Intermediate — Scenario Analysis & Response (5 questions)
  { id: 'q13', topic: 'phishing', level: 3, answer: 0 },
  { id: 'q14', topic: 'password', level: 3, answer: 0 },
  { id: 'q15', topic: 'privacy', level: 3, answer: 0 },
  { id: 'q16', topic: 'response', level: 3, answer: 0 },
  { id: 'q17', topic: 'website', level: 3, answer: 0 },

  // Level 4: Advanced Awareness — Multi-step Scenarios & Decisions (5 questions)
  { id: 'q18', topic: 'phishing', level: 4, answer: 0 },
  { id: 'q19', topic: 'password', level: 4, answer: 0 },
  { id: 'q20', topic: 'privacy', level: 4, answer: 0 },
  { id: 'q21', topic: 'response', level: 4, answer: 0 },
  { id: 'q22', topic: 'website', level: 4, answer: 0 },

  // Level 5: Continuing Mastery — Complex Threat Chains & Advanced Incident Response (5 questions)
  { id: 'q23', topic: 'phishing', level: 5, answer: 1 },
  { id: 'q24', topic: 'password', level: 5, answer: 0 },
  { id: 'q25', topic: 'privacy', level: 5, answer: 2 },
  { id: 'q26', topic: 'response', level: 5, answer: 0 },
  { id: 'q27', topic: 'website', level: 5, answer: 1 },

  // Level 6: Strategic Cyber Defense — Architecture & Resilience (5 questions)
  { id: 'q28', topic: 'phishing', level: 6, answer: 0 },
  { id: 'q29', topic: 'password', level: 6, answer: 1 },
  { id: 'q30', topic: 'privacy', level: 6, answer: 0 },
  { id: 'q31', topic: 'response', level: 6, answer: 2 },
  { id: 'q32', topic: 'website', level: 6, answer: 1 },
]

// Level 1 questions (7 questions) preserved for backward compatibility
export const QUESTIONS = QUESTION_BANK.slice(0, 7)

export const isCorrect = (q, choice) => q.answer === choice

export const score = (answers, list = QUESTIONS) =>
  list.filter((q) => answers[q.id] !== undefined && isCorrect(q, answers[q.id])).length

export const progress = (answers, list = QUESTIONS) => ({
  answered: list.filter((q) => answers[q.id] !== undefined).length,
  total: list.length,
  correct: score(answers, list),
})

export const getQuestionsForLevel = (lvlNum) =>
  QUESTION_BANK.filter((q) => q.level === lvlNum)

export const evaluateLevel = (answers, lvlNum) => {
  const qList = getQuestionsForLevel(lvlNum)
  const p = progress(answers, qList)
  const percentage = p.total > 0 ? Math.round((p.correct / p.total) * 100) : 0
  const passed = percentage >= 80
  const needsReview = percentage >= 60 && percentage < 80
  const needsRetry = percentage < 60
  const missedTopics = Array.from(
    new Set(
      qList
        .filter((q) => answers[q.id] !== undefined && !isCorrect(q, answers[q.id]))
        .map((q) => q.topic)
    )
  )
  return {
    answered: p.answered,
    total: p.total,
    correct: p.correct,
    incorrect: p.answered - p.correct,
    percentage,
    passed,
    needsReview,
    needsRetry,
    missedTopics,
  }
}
