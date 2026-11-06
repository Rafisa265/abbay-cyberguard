import { useState, useEffect } from 'react'
import {
  getTodayDateString,
  getDailyChallenge,
  getDailyChallengeStatus,
  submitDailyChallengeAnswer,
} from '../lib/dailyChallenge'
import { getTodayDailyChallenge } from '../lib/api'

const OPTION_LETTERS = ['A', 'B', 'C']

export default function DailyChallenge({ t, user }) {
  const [dateStr, setDateStr] = useState(getTodayDateString())
  const [challenge, setChallenge] = useState(() => getDailyChallenge(dateStr))
  const [status, setStatus] = useState(() => getDailyChallengeStatus(dateStr))
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    const today = getTodayDateString()
    setDateStr(today)
    setChallenge(getDailyChallenge(today))
    const currentStatus = getDailyChallengeStatus(today)
    setStatus(currentStatus)
    if (currentStatus.completed) {
      setSelectedChoice(currentStatus.chosenChoice)
    }

    if (user?.preferences?.cloud_progress_sync_enabled) {
      getTodayDailyChallenge(today)
        .then((remote) => {
          if (remote?.completed) {
            setStatus({
              completed: true,
              chosenChoice: remote.chosen_choice,
              isCorrect: Boolean(remote.is_correct),
              completedAt: null,
              xpAwarded: 0,
              canEarnXp: false,
            })
            if (remote.chosen_choice !== undefined && remote.chosen_choice !== null) {
              setSelectedChoice(remote.chosen_choice)
            }
          }
        })
        .catch(() => {})
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedChoice === null || status.completed || submitting) return

    setSubmitting(true)
    try {
      const outcome = await submitDailyChallengeAnswer(dateStr, selectedChoice, user)
      setResult(outcome)
      const updatedStatus = getDailyChallengeStatus(dateStr)
      setStatus(updatedStatus)
    } finally {
      setSubmitting(false)
    }
  }

  const isCompleted = status.completed
  const hasAttempted = Boolean(result !== null)
  const isAnswered = isCompleted || hasAttempted
  const chosenChoice = isCompleted ? status.chosenChoice : selectedChoice
  const wasCorrect = isCompleted ? status.isCorrect : result?.isCorrect

  const handleRetry = () => {
    setResult(null)
    setSelectedChoice(null)
  }

  return (
    <div className="daily-challenge-container">
      <div className="daily-header">
        <div className="daily-badge-row">
          <span className="daily-calendar-badge" aria-label="Calendar date">
            📅 {dateStr}
          </span>
          {isCompleted ? (
            <span className="daily-status-pill daily-status-done">
              ✅ {t('daily.completed_badge')} (+50 XP)
            </span>
          ) : (
            <span className="daily-status-pill daily-status-ready">
              ⚡ {t('daily.available_badge')} (+50 XP)
            </span>
          )}
        </div>
        <h1 className="daily-title">{t('daily.title')}</h1>
        <p className="daily-subtitle">{t('daily.subtitle')}</p>
      </div>

      {/* Scenario Briefing Card */}
      <article className="card daily-scenario-card" aria-labelledby="daily-scenario-heading">
        <div className="daily-scenario-header">
          <span className="daily-simulated-tag" aria-hidden="true">
            🛡️ {t('c.simulated')}
          </span>
          <h2 id="daily-scenario-heading" className="daily-scenario-title">
            {t('daily.scenario_heading')}
          </h2>
        </div>
        <p className="daily-scenario-text">{t(challenge.scenario_key)}</p>
      </article>

      {/* Interactive Question & Choices Form */}
      <section className="card daily-quiz-card" aria-labelledby="daily-question-heading">
        <h3 id="daily-question-heading" className="daily-question-text">
          {t(challenge.question_key)}
        </h3>

        <form onSubmit={handleSubmit} className="daily-form">
          <fieldset className="daily-options-fieldset" disabled={isAnswered}>
            <legend className="sr">{t(challenge.question_key)}</legend>
            <div className="daily-options-list">
              {challenge.options_keys.map((optKey, idx) => {
                const isSelected = chosenChoice === idx
                const isCorrectOption = challenge.correct_choice === idx

                let optionStateClass = ''
                if (isAnswered) {
                  if (isCorrectOption) {
                    optionStateClass = 'option-correct'
                  } else if (isSelected && !isCorrectOption) {
                    optionStateClass = 'option-wrong'
                  }
                } else if (isSelected) {
                  optionStateClass = 'option-selected'
                }

                return (
                  <label
                    key={optKey}
                    className={`daily-option-card ${optionStateClass}`}
                    htmlFor={`daily-opt-${idx}`}
                  >
                    <input
                      id={`daily-opt-${idx}`}
                      type="radio"
                      name="daily-choice"
                      value={idx}
                      checked={isSelected}
                      disabled={isAnswered}
                      onChange={() => setSelectedChoice(idx)}
                      className="daily-radio-input"
                    />
                    <span className="daily-option-letter" aria-hidden="true">
                      {OPTION_LETTERS[idx]}
                    </span>
                    <span className="daily-option-text">{t(optKey)}</span>
                    {isAnswered && isCorrectOption && (
                      <span className="daily-option-indicator" aria-label="Correct">
                        ✓
                      </span>
                    )}
                    {isAnswered && isSelected && !isCorrectOption && (
                      <span className="daily-option-indicator" aria-label="Incorrect">
                        ✗
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>

          {!isAnswered && (
            <div className="daily-action-footer">
              <button
                type="submit"
                className="btn btn-primary daily-submit-btn"
                disabled={selectedChoice === null || submitting}
              >
                {submitting ? t('c.loading') : t('daily.submit_btn')}
              </button>
            </div>
          )}
        </form>

        {/* Post-Completion Feedback & Explanation */}
        {isAnswered && (
          <div
            className={`daily-feedback-panel ${wasCorrect ? 'feedback-success' : 'feedback-caution'}`}
            role="region"
            aria-live="polite"
          >
            <div className="daily-feedback-header">
              <span className="daily-feedback-icon" aria-hidden="true">
                {wasCorrect ? '🎉' : '⚠️'}
              </span>
              <div>
                <h4 className="daily-feedback-title">
                  {wasCorrect ? t('daily.outcome_correct') : t('daily.outcome_incorrect')}
                </h4>
                <p className="daily-feedback-xp">
                  {wasCorrect
                    ? `+${status.xpAwarded || 50} XP ${t('home.resume.xp_label')}`
                    : t('daily.no_xp_incorrect')}
                </p>
              </div>
            </div>

            <div className="daily-explanation-body">
              <h5 className="daily-explanation-title">{t('learn.explanation')}:</h5>
              <p className="daily-explanation-text">{t(challenge.explanation_key)}</p>
            </div>

            {!wasCorrect && (
              <div className="daily-retry-action" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn ghost daily-retry-btn"
                  onClick={handleRetry}
                  aria-label={t('daily.retry')}
                >
                  🔄 {t('daily.retry')}
                </button>
              </div>
            )}

            <div className="daily-idempotency-note">
              <span aria-hidden="true">ℹ️ </span>
              {t('daily.idempotency_note')}
            </div>

            {/* Next challenge arrival info card */}
            <div className="daily-next-arrival-card" style={{ marginTop: '16px', padding: '14px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>⏳</span>
                <div>
                  <strong style={{ color: '#38bdf8' }}>{t('daily.next_arrival_title')}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>{t('daily.next_arrival_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Guest Mode & Offline Guarantees Footer */}
      <footer className="daily-meta-footer">
        <p className="small">
          {user ? `👤 ${t('daily.signed_in_sync')}` : `🔒 ${t('daily.guest_note')}`}
        </p>
        <div className="daily-nav-links">
          <a className="btn ghost" href="#/">
            ← {t('nav.home')}
          </a>
          <a className="btn ghost" href="#/learn">
            🎓 {t('nav.learn')}
          </a>
          <a className="btn ghost" href="#/arena">
            ⚔️ {t('nav.arena')}
          </a>
          <a className="btn ghost" href="#/journey">
            🚀 {t('nav.journey')}
          </a>
        </div>
      </footer>
    </div>
  )
}
