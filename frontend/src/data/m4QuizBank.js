/**
 * ABBAY CYBERGUARD — M4 Interactive Website Security Learning Lab
 * Expandable Question Bank for Defensive Web Security & Transport Encryption.
 *
 * Rules:
 * - Deterministic selection (avoids non-deterministic random calls per static safety checks).
 * - Full trilingual key references (EN, OM, AM).
 * - Structured metadata (difficulty, topic, check reference).
 */

export const M4_QUIZ_BANK = [
  // =========================================================================
  // BEGINNER LEVEL (8 Questions)
  // =========================================================================
  {
    id: 'q_tls_01',
    difficulty: 'beginner',
    topic: 'tls',
    checkRef: 'CHK-01',
    qKey: 'm4.quiz.q_tls_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_tls_01_o1', isCorrect: true, expKey: 'm4.quiz.q_tls_01_e1' },
      { textKey: 'm4.quiz.q_tls_01_o2', isCorrect: false, expKey: 'm4.quiz.q_tls_01_e2' },
      { textKey: 'm4.quiz.q_tls_01_o3', isCorrect: false, expKey: 'm4.quiz.q_tls_01_e3' },
    ],
  },
  {
    id: 'q_cert_01',
    difficulty: 'beginner',
    topic: 'tls',
    checkRef: 'CHK-01',
    qKey: 'm4.quiz.q_cert_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_cert_01_o1', isCorrect: true, expKey: 'm4.quiz.q_cert_01_e1' },
      { textKey: 'm4.quiz.q_cert_01_o2', isCorrect: false, expKey: 'm4.quiz.q_cert_01_e2' },
      { textKey: 'm4.quiz.q_cert_01_o3', isCorrect: false, expKey: 'm4.quiz.q_cert_01_e3' },
    ],
  },
  {
    id: 'q_phish_01',
    difficulty: 'beginner',
    topic: 'tls',
    checkRef: 'CHK-01',
    qKey: 'm4.quiz.q_phish_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_phish_01_o1', isCorrect: true, expKey: 'm4.quiz.q_phish_01_e1' },
      { textKey: 'm4.quiz.q_phish_01_o2', isCorrect: false, expKey: 'm4.quiz.q_phish_01_e2' },
      { textKey: 'm4.quiz.q_phish_01_o3', isCorrect: false, expKey: 'm4.quiz.q_phish_01_e3' },
    ],
  },
  {
    id: 'q_redirect_01',
    difficulty: 'beginner',
    topic: 'headers',
    checkRef: 'CHK-02',
    qKey: 'm4.quiz.q_redirect_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_redirect_01_o1', isCorrect: true, expKey: 'm4.quiz.q_redirect_01_e1' },
      { textKey: 'm4.quiz.q_redirect_01_o2', isCorrect: false, expKey: 'm4.quiz.q_redirect_01_e2' },
      { textKey: 'm4.quiz.q_redirect_01_o3', isCorrect: false, expKey: 'm4.quiz.q_redirect_01_e3' },
    ],
  },
  {
    id: 'q_hsts_01',
    difficulty: 'beginner',
    topic: 'headers',
    checkRef: 'CHK-03',
    qKey: 'm4.quiz.q_hsts_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_hsts_01_o1', isCorrect: true, expKey: 'm4.quiz.q_hsts_01_e1' },
      { textKey: 'm4.quiz.q_hsts_01_o2', isCorrect: false, expKey: 'm4.quiz.q_hsts_01_e2' },
      { textKey: 'm4.quiz.q_hsts_01_o3', isCorrect: false, expKey: 'm4.quiz.q_hsts_01_e3' },
    ],
  },
  {
    id: 'q_cookie_01',
    difficulty: 'beginner',
    topic: 'cookies',
    checkRef: 'CHK-06',
    qKey: 'm4.quiz.q_cookie_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_cookie_01_o1', isCorrect: true, expKey: 'm4.quiz.q_cookie_01_e1' },
      { textKey: 'm4.quiz.q_cookie_01_o2', isCorrect: false, expKey: 'm4.quiz.q_cookie_01_e2' },
      { textKey: 'm4.quiz.q_cookie_01_o3', isCorrect: false, expKey: 'm4.quiz.q_cookie_01_e3' },
    ],
  },
  {
    id: 'q_banner_01',
    difficulty: 'beginner',
    topic: 'headers',
    checkRef: 'CHK-07',
    qKey: 'm4.quiz.q_banner_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_banner_01_o1', isCorrect: true, expKey: 'm4.quiz.q_banner_01_e1' },
      { textKey: 'm4.quiz.q_banner_01_o2', isCorrect: false, expKey: 'm4.quiz.q_banner_01_e2' },
      { textKey: 'm4.quiz.q_banner_01_o3', isCorrect: false, expKey: 'm4.quiz.q_banner_01_e3' },
    ],
  },
  {
    id: 'q_browser_01',
    difficulty: 'beginner',
    topic: 'headers',
    checkRef: 'CHK-05',
    qKey: 'm4.quiz.q_browser_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_browser_01_o1', isCorrect: true, expKey: 'm4.quiz.q_browser_01_e1' },
      { textKey: 'm4.quiz.q_browser_01_o2', isCorrect: false, expKey: 'm4.quiz.q_browser_01_e2' },
      { textKey: 'm4.quiz.q_browser_01_o3', isCorrect: false, expKey: 'm4.quiz.q_browser_01_e3' },
    ],
  },

  // =========================================================================
  // INTERMEDIATE LEVEL (8 Questions)
  // =========================================================================
  {
    id: 'q_hsts_02',
    difficulty: 'intermediate',
    topic: 'headers',
    checkRef: 'CHK-03',
    qKey: 'm4.quiz.q_hsts_02',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_hsts_02_o1', isCorrect: true, expKey: 'm4.quiz.q_hsts_02_e1' },
      { textKey: 'm4.quiz.q_hsts_02_o2', isCorrect: false, expKey: 'm4.quiz.q_hsts_02_e2' },
      { textKey: 'm4.quiz.q_hsts_02_o3', isCorrect: false, expKey: 'm4.quiz.q_hsts_02_e3' },
    ],
  },
  {
    id: 'q_cookie_02',
    difficulty: 'intermediate',
    topic: 'cookies',
    checkRef: 'CHK-06',
    qKey: 'm4.quiz.q_cookie_02',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_cookie_02_o1', isCorrect: true, expKey: 'm4.quiz.q_cookie_02_e1' },
      { textKey: 'm4.quiz.q_cookie_02_o2', isCorrect: false, expKey: 'm4.quiz.q_cookie_02_e2' },
      { textKey: 'm4.quiz.q_cookie_02_o3', isCorrect: false, expKey: 'm4.quiz.q_cookie_02_e3' },
    ],
  },
  {
    id: 'q_csp_01',
    difficulty: 'intermediate',
    topic: 'headers',
    checkRef: 'CHK-04',
    qKey: 'm4.quiz.q_csp_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_csp_01_o1', isCorrect: true, expKey: 'm4.quiz.q_csp_01_e1' },
      { textKey: 'm4.quiz.q_csp_01_o2', isCorrect: false, expKey: 'm4.quiz.q_csp_01_e2' },
      { textKey: 'm4.quiz.q_csp_01_o3', isCorrect: false, expKey: 'm4.quiz.q_csp_01_e3' },
    ],
  },
  {
    id: 'q_perm_01',
    difficulty: 'intermediate',
    topic: 'headers',
    checkRef: 'CHK-05',
    qKey: 'm4.quiz.q_perm_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_perm_01_o1', isCorrect: true, expKey: 'm4.quiz.q_perm_01_e1' },
      { textKey: 'm4.quiz.q_perm_01_o2', isCorrect: false, expKey: 'm4.quiz.q_perm_01_e2' },
      { textKey: 'm4.quiz.q_perm_01_o3', isCorrect: false, expKey: 'm4.quiz.q_perm_01_e3' },
    ],
  },
  {
    id: 'q_banner_02',
    difficulty: 'intermediate',
    topic: 'headers',
    checkRef: 'CHK-07',
    qKey: 'm4.quiz.q_banner_02',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_banner_02_o1', isCorrect: true, expKey: 'm4.quiz.q_banner_02_e1' },
      { textKey: 'm4.quiz.q_banner_02_o2', isCorrect: false, expKey: 'm4.quiz.q_banner_02_e2' },
      { textKey: 'm4.quiz.q_banner_02_o3', isCorrect: false, expKey: 'm4.quiz.q_banner_02_e3' },
    ],
  },
  {
    id: 'q_tls_02',
    difficulty: 'intermediate',
    topic: 'tls',
    checkRef: 'CHK-01',
    qKey: 'm4.quiz.q_tls_02',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_tls_02_o1', isCorrect: true, expKey: 'm4.quiz.q_tls_02_e1' },
      { textKey: 'm4.quiz.q_tls_02_o2', isCorrect: false, expKey: 'm4.quiz.q_tls_02_e2' },
      { textKey: 'm4.quiz.q_tls_02_o3', isCorrect: false, expKey: 'm4.quiz.q_tls_02_e3' },
    ],
  },
  {
    id: 'q_samesite_01',
    difficulty: 'intermediate',
    topic: 'cookies',
    checkRef: 'CHK-06',
    qKey: 'm4.quiz.q_samesite_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_samesite_01_o1', isCorrect: true, expKey: 'm4.quiz.q_samesite_01_e1' },
      { textKey: 'm4.quiz.q_samesite_01_o2', isCorrect: false, expKey: 'm4.quiz.q_samesite_01_e2' },
      { textKey: 'm4.quiz.q_samesite_01_o3', isCorrect: false, expKey: 'm4.quiz.q_samesite_01_e3' },
    ],
  },
  {
    id: 'q_nosniff_01',
    difficulty: 'intermediate',
    topic: 'headers',
    checkRef: 'CHK-05',
    qKey: 'm4.quiz.q_nosniff_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_nosniff_01_o1', isCorrect: true, expKey: 'm4.quiz.q_nosniff_01_e1' },
      { textKey: 'm4.quiz.q_nosniff_01_o2', isCorrect: false, expKey: 'm4.quiz.q_nosniff_01_e2' },
      { textKey: 'm4.quiz.q_nosniff_01_o3', isCorrect: false, expKey: 'm4.quiz.q_nosniff_01_e3' },
    ],
  },

  // =========================================================================
  // ADVANCED LEVEL (8 Questions)
  // =========================================================================
  {
    id: 'q_hsts_03',
    difficulty: 'advanced',
    topic: 'headers',
    checkRef: 'CHK-03',
    qKey: 'm4.quiz.q_hsts_03',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_hsts_03_o1', isCorrect: true, expKey: 'm4.quiz.q_hsts_03_e1' },
      { textKey: 'm4.quiz.q_hsts_03_o2', isCorrect: false, expKey: 'm4.quiz.q_hsts_03_e2' },
      { textKey: 'm4.quiz.q_hsts_03_o3', isCorrect: false, expKey: 'm4.quiz.q_hsts_03_e3' },
    ],
  },
  {
    id: 'q_csp_02',
    difficulty: 'advanced',
    topic: 'headers',
    checkRef: 'CHK-04',
    qKey: 'm4.quiz.q_csp_02',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_csp_02_o1', isCorrect: true, expKey: 'm4.quiz.q_csp_02_e1' },
      { textKey: 'm4.quiz.q_csp_02_o2', isCorrect: false, expKey: 'm4.quiz.q_csp_02_e2' },
      { textKey: 'm4.quiz.q_csp_02_o3', isCorrect: false, expKey: 'm4.quiz.q_csp_02_e3' },
    ],
  },
  {
    id: 'q_tls_03',
    difficulty: 'advanced',
    topic: 'tls',
    checkRef: 'CHK-01',
    qKey: 'm4.quiz.q_tls_03',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_tls_03_o1', isCorrect: true, expKey: 'm4.quiz.q_tls_03_e1' },
      { textKey: 'm4.quiz.q_tls_03_o2', isCorrect: false, expKey: 'm4.quiz.q_tls_03_e2' },
      { textKey: 'm4.quiz.q_tls_03_o3', isCorrect: false, expKey: 'm4.quiz.q_tls_03_e3' },
    ],
  },
  {
    id: 'q_cookie_03',
    difficulty: 'advanced',
    topic: 'cookies',
    checkRef: 'CHK-06',
    qKey: 'm4.quiz.q_cookie_03',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_cookie_03_o1', isCorrect: true, expKey: 'm4.quiz.q_cookie_03_e1' },
      { textKey: 'm4.quiz.q_cookie_03_o2', isCorrect: false, expKey: 'm4.quiz.q_cookie_03_e2' },
      { textKey: 'm4.quiz.q_cookie_03_o3', isCorrect: false, expKey: 'm4.quiz.q_cookie_03_e3' },
    ],
  },
  {
    id: 'q_xfo_01',
    difficulty: 'advanced',
    topic: 'headers',
    checkRef: 'CHK-05',
    qKey: 'm4.quiz.q_xfo_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_xfo_01_o1', isCorrect: true, expKey: 'm4.quiz.q_xfo_01_e1' },
      { textKey: 'm4.quiz.q_xfo_01_o2', isCorrect: false, expKey: 'm4.quiz.q_xfo_01_e2' },
      { textKey: 'm4.quiz.q_xfo_01_o3', isCorrect: false, expKey: 'm4.quiz.q_xfo_01_e3' },
    ],
  },
  {
    id: 'q_cors_01',
    difficulty: 'advanced',
    topic: 'headers',
    checkRef: 'CHK-04',
    qKey: 'm4.quiz.q_cors_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_cors_01_o1', isCorrect: true, expKey: 'm4.quiz.q_cors_01_e1' },
      { textKey: 'm4.quiz.q_cors_01_o2', isCorrect: false, expKey: 'm4.quiz.q_cors_01_e2' },
      { textKey: 'm4.quiz.q_cors_01_o3', isCorrect: false, expKey: 'm4.quiz.q_cors_01_e3' },
    ],
  },
  {
    id: 'q_dsa_01',
    difficulty: 'advanced',
    topic: 'scenarios',
    checkRef: 'CHK-01',
    qKey: 'm4.quiz.q_dsa_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_dsa_01_o1', isCorrect: true, expKey: 'm4.quiz.q_dsa_01_e1' },
      { textKey: 'm4.quiz.q_dsa_01_o2', isCorrect: false, expKey: 'm4.quiz.q_dsa_01_e2' },
      { textKey: 'm4.quiz.q_dsa_01_o3', isCorrect: false, expKey: 'm4.quiz.q_dsa_01_e3' },
    ],
  },
  {
    id: 'q_dsb_01',
    difficulty: 'advanced',
    topic: 'scenarios',
    checkRef: 'CHK-05',
    qKey: 'm4.quiz.q_dsb_01',
    correctIdx: 0,
    options: [
      { textKey: 'm4.quiz.q_dsb_01_o1', isCorrect: true, expKey: 'm4.quiz.q_dsb_01_e1' },
      { textKey: 'm4.quiz.q_dsb_01_o2', isCorrect: false, expKey: 'm4.quiz.q_dsb_01_e2' },
      { textKey: 'm4.quiz.q_dsb_01_o3', isCorrect: false, expKey: 'm4.quiz.q_dsb_01_e3' },
    ],
  },
]

/**
 * Deterministically select questions for a quiz session.
 * Strictly avoids non-deterministic math calls in adherence to project security invariants (static.test.js).
 */
export function selectQuizSessionQuestions(bankOrOptions = M4_QUIZ_BANK, maybeOptions = {}) {
  let bank = Array.isArray(bankOrOptions) ? bankOrOptions : M4_QUIZ_BANK
  const options = Array.isArray(bankOrOptions) ? maybeOptions : bankOrOptions

  const { difficulty = 'all', count = 6, seed = 0, specificIds = null } = options || {}

  let pool = bank
  if (specificIds && specificIds.length > 0) {
    pool = bank.filter((q) => specificIds.includes(q.id))
  } else if (difficulty && difficulty !== 'all') {
    pool = bank.filter((q) => q.difficulty === difficulty)
  }
  if (!pool || pool.length === 0) pool = bank

  const n = pool.length
  const effectiveCount = Math.min(count, n)
  const selected = []
  const chosenIndices = new Set()

  // Deterministic LCG-based permutation avoiding non-deterministic methods
  const mult = 7
  const offset = ((seed * 11) + 3) % n

  for (let step = 0; step < n && selected.length < effectiveCount; step++) {
    const idx = (offset + (step * mult)) % n
    if (!chosenIndices.has(idx)) {
      chosenIndices.add(idx)
      selected.push(pool[idx])
    }
  }

  // Backfill if needed
  for (let i = 0; i < n && selected.length < effectiveCount; i++) {
    if (!chosenIndices.has(i)) {
      chosenIndices.add(i)
      selected.push(pool[i])
    }
  }

  return selected
}

/**
 * Calculate quiz performance diagnostics by topic.
 */
export function calculateQuizDiagnostics(questions, answers) {
  const byTopic = {
    tls: { total: 0, correct: 0 },
    headers: { total: 0, correct: 0 },
    cookies: { total: 0, correct: 0 },
    scenarios: { total: 0, correct: 0 },
  }
  let totalAnswered = 0
  let correctCount = 0
  const missedIds = []

  questions.forEach((q) => {
    const ans = answers[q.id]
    const top = q.topic || 'headers'
    if (!byTopic[top]) {
      byTopic[top] = { total: 0, correct: 0 }
    }
    byTopic[top].total++

    if (ans !== undefined) {
      totalAnswered++
      if (ans === q.correctIdx) {
        correctCount++
        byTopic[top].correct++
      } else {
        missedIds.push(q.id)
      }
    }
  })

  const total = questions.length
  const incorrectCount = totalAnswered - correctCount
  const percentage = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0

  const strengths = []
  const needsPractice = []

  Object.entries(byTopic).forEach(([topic, stats]) => {
    if (stats.total > 0) {
      const topicPct = Math.round((stats.correct / stats.total) * 100)
      if (topicPct >= 75) {
        strengths.push(topic)
      } else {
        needsPractice.push(topic)
      }
    }
  })

  return {
    total,
    totalAnswered,
    score: correctCount,
    correctCount,
    incorrectCount,
    percentage,
    byTopic,
    topicBreakdown: byTopic,
    strengths,
    practiceAreas: needsPractice,
    needsPractice,
    missedIds,
  }
}
