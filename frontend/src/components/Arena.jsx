import { useState, useEffect } from 'react'
import {
  ARENA_MODES,
  ARENA_DIFFICULTIES,
  ARENA_SCENARIOS,
  getArenaScenarios,
  getArenaProgress,
  isTierUnlocked,
  recordArenaScenarioCompleted,
  getNextUncompletedScenario,
  getRecommendedArenaScenario,
} from '../lib/arena.js'

export default function Arena({ t, user, onNavigate }) {
  const [selectedMode, setSelectedMode] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [activeScenario, setActiveScenario] = useState(null)
  const [arenaProgress, setArenaProgress] = useState(getArenaProgress)

  // In-scenario gameplay state
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [stageAnswers, setStageAnswers] = useState({})
  const [showHint, setShowHint] = useState(false)
  const [outcome, setOutcome] = useState(null) // { isSuccess, xpAwarded, alreadyCompleted, newBadge, explanationKey, details }
  const [simulatedHealth, setSimulatedHealth] = useState(100)
  const [simulatedRisk, setSimulatedRisk] = useState('medium')
  const [defenseEffectiveness, setDefenseEffectiveness] = useState(100)

  // Refresh progress state whenever returning to list
  const refreshProgress = () => {
    setArenaProgress(getArenaProgress())
  }

  const handleSelectScenario = (scenario) => {
    setActiveScenario(scenario)
    setCurrentStageIndex(0)
    setSelectedChoice(null)
    setStageAnswers({})
    setShowHint(false)
    setOutcome(null)
    setSimulatedHealth(100)
    setSimulatedRisk(scenario.difficulty === 'advanced' ? 'high' : 'medium')
    setDefenseEffectiveness(100)
  }

  const handleCloseScenario = () => {
    setActiveScenario(null)
    setOutcome(null)
    refreshProgress()
  }

  const handleReturnToDashboard = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('#/')
    } else if (typeof window !== 'undefined') {
      window.location.hash = '#/'
    }
  }

  // Handle submitting decision for Attack & Defense single-stage modes
  const handleSingleStageSubmit = async () => {
    if (selectedChoice === null || !activeScenario) return

    const isCorrect = selectedChoice === activeScenario.correctChoice
    const score = isCorrect ? 100 : 0

    const res = await recordArenaScenarioCompleted({
      scenarioId: activeScenario.id,
      score,
      answers: { choice: selectedChoice },
      user,
    })

    setOutcome({
      isSuccess: isCorrect,
      xpAwarded: res.xpAwarded,
      alreadyCompleted: res.alreadyCompleted,
      newBadge: res.newBadge,
      explanationKey: activeScenario.explanationKey,
      chosenChoice: selectedChoice,
      correctChoice: activeScenario.correctChoice,
    })

    refreshProgress()
  }

  // Handle stage submission for Battle Mode
  const handleBattleStageSubmit = async () => {
    if (selectedChoice === null || !activeScenario || !activeScenario.stages) return

    const currentStage = activeScenario.stages[currentStageIndex]
    const isStageCorrect = selectedChoice === currentStage.correctChoice

    const newAnswers = {
      ...stageAnswers,
      [currentStageIndex]: {
        choice: selectedChoice,
        isCorrect: isStageCorrect,
      },
    }
    setStageAnswers(newAnswers)

    // Update simulated meters
    if (!isStageCorrect) {
      setSimulatedHealth((prev) => Math.max(30, prev - 40))
      setSimulatedRisk('high')
      setDefenseEffectiveness((prev) => Math.max(20, prev - 45))
    } else {
      setSimulatedRisk('mitigated')
      setDefenseEffectiveness((prev) => Math.min(100, prev + 5))
    }

    // Check if more stages remain
    if (currentStageIndex < activeScenario.stages.length - 1) {
      setCurrentStageIndex((prev) => prev + 1)
      setSelectedChoice(null)
      setShowHint(false)
    } else {
      // Final Battle stage completed: evaluate overall outcome
      const allCorrect = Object.values(newAnswers).every((a) => a.isCorrect) && isStageCorrect
      const score = allCorrect ? 100 : 50

      const res = await recordArenaScenarioCompleted({
        scenarioId: activeScenario.id,
        score,
        answers: newAnswers,
        user,
      })

      setOutcome({
        isSuccess: allCorrect,
        xpAwarded: res.xpAwarded,
        alreadyCompleted: res.alreadyCompleted,
        newBadge: res.newBadge,
        explanationKey: currentStage.explanationKey,
        stagesSummary: newAnswers,
      })

      refreshProgress()
    }
  }

  const filteredScenarios = getArenaScenarios(selectedMode, selectedDifficulty)

  return (
    <div className="arena-container" id="arena-main">
      {/* Module Header */}
      <header className="arena-header">
        <div className="arena-title-wrap">
          <div className="arena-tag">
            <span aria-hidden="true">⚔️</span> {t('arena.mode_battle')}
          </div>
          <h1 className="arena-title">{t('arena.title')}</h1>
          <p className="arena-subtitle">{t('arena.subtitle')}</p>
        </div>

        {/* Return to Dashboard */}
        <div className="arena-header-actions">
          <button
            type="button"
            className="btn ghost btn-back-dashboard"
            onClick={handleReturnToDashboard}
            aria-label={t('arena.back_to_home')}
          >
            🏠 {t('arena.back_to_home')}
          </button>
        </div>
      </header>

      {/* Safety Notice Banner */}
      <aside className="arena-safety-notice" role="note" aria-label="Educational Safety Notice">
        <span className="safety-icon" aria-hidden="true">🛡️</span>
        <div className="safety-text">
          <strong>{t('arena.safety_notice')}</strong>
        </div>
      </aside>

      {/* Arena Progress & Stats Overview Bar */}
      <section className="arena-stats-bar" aria-label="Arena Player Statistics">
        <div className="arena-stat-item">
          <span className="stat-label">⚡ {t('arena.stats_total_xp')}</span>
          <span className="stat-value">{arenaProgress.totalArenaXp} XP</span>
        </div>
        <div className="arena-stat-item">
          <span className="stat-label">✅ {t('arena.stats_completed')}</span>
          <span className="stat-value">{arenaProgress.completedCount} / {ARENA_SCENARIOS.length}</span>
        </div>
        <div className="arena-stat-item">
          <span className="stat-label">👑 {t('arena.tier_beginner')} / {t('arena.tier_intermediate')} / {t('arena.tier_advanced')}</span>
          <div className="tier-pills">
            <span className="tier-indicator unlocked" title="Beginner Unlocked">🔰 {t('arena.tier_beginner')}</span>
            <span className={`tier-indicator ${arenaProgress.unlockedTiers.includes('intermediate') ? 'unlocked' : 'locked'}`} title={arenaProgress.unlockedTiers.includes('intermediate') ? 'Unlocked' : t('arena.tier_unlock_req_intermediate')}>
              {arenaProgress.unlockedTiers.includes('intermediate') ? '⚡' : '🔒'} {t('arena.tier_intermediate')}
            </span>
            <span className={`tier-indicator ${arenaProgress.unlockedTiers.includes('advanced') ? 'unlocked' : 'locked'}`} title={arenaProgress.unlockedTiers.includes('advanced') ? 'Unlocked' : t('arena.tier_unlock_req_advanced')}>
              {arenaProgress.unlockedTiers.includes('advanced') ? '👑' : '🔒'} {t('arena.tier_advanced')}
            </span>
          </div>
        </div>
      </section>

      {/* View Switch: Active Scenario Player vs Scenario List */}
      {activeScenario ? (
        /* SCENARIO PLAYER INTERFACE */
        <section className="arena-player-card" aria-labelledby="scenario-player-title">
          <div className="player-top-bar">
            <button
              type="button"
              className="btn-back-link"
              onClick={handleCloseScenario}
            >
              ← {t('arena.back_to_arena')}
            </button>
            <div className="player-meta-badges">
              <span className={`mode-badge mode-${activeScenario.mode}`}>
                {activeScenario.mode === 'attack' ? '⚔️ ' + t('arena.mode_attack') : activeScenario.mode === 'defense' ? '🛡️ ' + t('arena.mode_defense') : '⚡ ' + t('arena.mode_battle')}
              </span>
              <span className={`diff-badge diff-${activeScenario.difficulty}`}>
                {t(`arena.tier_${activeScenario.difficulty}`)}
              </span>
              <span className="xp-pill">+{activeScenario.xpReward} XP</span>
            </div>
          </div>

          <h2 id="scenario-player-title" className="player-title">
            {t(activeScenario.titleKey)}
          </h2>
          <p className="player-desc">{t(activeScenario.descKey)}</p>

          {/* Synthetic Security Telemetry / Terminal Box */}
          <div className="telemetry-box" role="region" aria-label={t('arena.synthetic_log_heading')}>
            <div className="telemetry-header">
              <span className="telemetry-dot dot-red"></span>
              <span className="telemetry-dot dot-yellow"></span>
              <span className="telemetry-dot dot-green"></span>
              <span className="telemetry-title">📟 {t('arena.synthetic_log_heading')} [{activeScenario.telemetryType.toUpperCase()}]</span>
            </div>
            <pre className="telemetry-content"><code>{activeScenario.telemetryContent}</code></pre>
          </div>

          {/* Battle Mode Simulated Health & Threat Meter */}
          {activeScenario.mode === 'battle' && (
            <div className="battle-meters-panel" aria-label="Simulated Battle Telemetry">
              <div className="meter-block">
                <span className="meter-label">💚 {t('arena.system_health')}: {simulatedHealth}%</span>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${simulatedHealth}%`, background: simulatedHealth > 50 ? '#10b981' : '#ef4444' }}></div>
                </div>
              </div>
              <div className="meter-block">
                <span className="meter-label">⚠️ {t('arena.threat_level')}: <strong>{simulatedRisk.toUpperCase()}</strong></span>
              </div>
              <div className="meter-block">
                <span className="meter-label">🛡️ {t('arena.defense_effectiveness')}: {defenseEffectiveness}%</span>
              </div>
            </div>
          )}

          {/* OUTCOME & DEBRIEFING VIEW */}
          {outcome ? (
            <div className={`arena-outcome-panel ${outcome.isSuccess ? 'outcome-success' : 'outcome-failure'}`} role="status">
              <div className="outcome-header">
                <span className="outcome-icon" aria-hidden="true">
                  {outcome.isSuccess ? '🎉' : '⚠️'}
                </span>
                <div className="outcome-text-wrap">
                  <h3 className="outcome-title">
                    {outcome.isSuccess ? t('arena.outcome_success') : t('arena.outcome_failure')}
                  </h3>
                  <p className="outcome-sub">
                    {outcome.alreadyCompleted
                      ? t('arena.outcome_already_completed')
                      : `${t('arena.outcome_xp_awarded')}: +${outcome.xpAwarded} XP`}
                  </p>
                </div>
              </div>

              {outcome.newBadge && (
                <div className="outcome-badge-unlocked">
                  <span className="badge-icon">🎖️</span>
                  <div>
                    <strong>{t('notif.badge_earned_title')}</strong>
                    <p>{t(`journey.badge.${outcome.newBadge}`)}</p>
                  </div>
                </div>
              )}

              <div className="outcome-explanation">
                <h4>📖 Defensive Security Analysis:</h4>
                <p>{t(outcome.explanationKey)}</p>
              </div>

              {/* Failure remediation hint */}
              {!outcome.isSuccess && (
                <div className="outcome-remediation-hint" style={{ margin: '14px 0', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px' }}>
                  <strong style={{ color: '#f87171' }}>🛡️ {t('arena.remediation_title')}:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#cbd5e1' }}>{t(activeScenario.hintKey)}</p>
                </div>
              )}

              {/* Grandmaster 100% completion card */}
              {arenaProgress.completedCount >= ARENA_SCENARIOS.length && (
                <div className="outcome-grandmaster-card" style={{ margin: '16px 0', padding: '16px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="/images/journey/arena_grandmaster.svg" alt="Grandmaster" style={{ width: '48px', height: '48px' }} />
                    <div>
                      <h4 style={{ margin: '0 0 4px', color: '#fde047' }}>🏆 {t('arena.grandmaster_title')}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{t('arena.grandmaster_desc')}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="outcome-actions">
                {outcome.isSuccess && getNextUncompletedScenario(arenaProgress) && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSelectScenario(getNextUncompletedScenario(arenaProgress))}
                  >
                    ⏩ {t('arena.next_scenario')}
                  </button>
                )}
                <button
                  type="button"
                  className={`btn ${outcome.isSuccess && getNextUncompletedScenario(arenaProgress) ? 'ghost' : 'btn-primary'}`}
                  onClick={handleCloseScenario}
                >
                  {t('arena.back_to_arena')}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => handleSelectScenario(activeScenario)}
                >
                  🔄 {t('arena.replay_scenario')}
                </button>
              </div>
            </div>
          ) : (
            /* ACTIVE QUESTION & OPTIONS VIEW */
            <div className="player-interactive-section">
              {activeScenario.mode === 'battle' ? (
                /* Battle Mode Multi-stage */
                (() => {
                  const stage = activeScenario.stages[currentStageIndex]
                  return (
                    <div className="stage-card">
                      <div className="stage-header">
                        <span className="stage-pill">
                          {currentStageIndex === 0 ? t('arena.stage_1') : t('arena.stage_2')} ({currentStageIndex + 1}/2)
                        </span>
                        <h3 className="stage-title">{t(stage.titleKey)}</h3>
                      </div>
                      <p className="stage-question">{t(stage.questionKey)}</p>

                      <div className="options-list" role="radiogroup" aria-label={t(stage.questionKey)}>
                        {stage.optionsKeys.map((optKey, idx) => (
                          <button
                            key={optKey}
                            type="button"
                            role="radio"
                            aria-checked={selectedChoice === idx}
                            className={`option-btn ${selectedChoice === idx ? 'selected' : ''}`}
                            onClick={() => setSelectedChoice(idx)}
                          >
                            <span className="opt-letter">{String.fromCharCode(65 + idx)}</span>
                            <span className="opt-text">{t(optKey)}</span>
                          </button>
                        ))}
                      </div>

                      <div className="stage-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-submit-decision"
                          disabled={selectedChoice === null}
                          onClick={handleBattleStageSubmit}
                        >
                          {currentStageIndex < activeScenario.stages.length - 1 ? t('arena.next_scenario') : t('arena.submit_decision')} →
                        </button>
                      </div>
                    </div>
                  )
                })()
              ) : (
                /* Attack & Defense Single-stage */
                <div className="single-stage-card">
                  <h3 className="decision-question">{t(activeScenario.questionKey)}</h3>

                  {activeScenario.hintKey && (
                    <div className="hint-container">
                      <button
                        type="button"
                        className="btn-text-hint"
                        onClick={() => setShowHint((prev) => !prev)}
                      >
                        💡 {t('arena.hint_btn')}
                      </button>
                      {showHint && (
                        <p className="hint-bubble">{t(activeScenario.hintKey)}</p>
                      )}
                    </div>
                  )}

                  <div className="options-list" role="radiogroup" aria-label={t(activeScenario.questionKey)}>
                    {activeScenario.optionsKeys.map((optKey, idx) => (
                      <button
                        key={optKey}
                        type="button"
                        role="radio"
                        aria-checked={selectedChoice === idx}
                        className={`option-btn ${selectedChoice === idx ? 'selected' : ''}`}
                        onClick={() => setSelectedChoice(idx)}
                      >
                        <span className="opt-letter">{String.fromCharCode(65 + idx)}</span>
                        <span className="opt-text">{t(optKey)}</span>
                      </button>
                    ))}
                  </div>

                  <div className="single-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-submit-decision"
                      disabled={selectedChoice === null}
                      onClick={handleSingleStageSubmit}
                    >
                      {t('arena.submit_decision')} →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        /* SCENARIO CATALOG & MODE DASHBOARD */
        <>
          {/* Mode Switcher Tabs */}
          <section className="arena-mode-tabs" role="tablist" aria-label="Arena Game Modes">
            <button
              type="button"
              role="tab"
              aria-selected={selectedMode === 'all'}
              className={`mode-tab ${selectedMode === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedMode('all')}
            >
              🌐 {t('journey.filter_all')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedMode === 'attack'}
              className={`mode-tab mode-tab-attack ${selectedMode === 'attack' ? 'active' : ''}`}
              onClick={() => setSelectedMode('attack')}
            >
              ⚔️ {t('arena.mode_attack')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedMode === 'defense'}
              className={`mode-tab mode-tab-defense ${selectedMode === 'defense' ? 'active' : ''}`}
              onClick={() => setSelectedMode('defense')}
            >
              🛡️ {t('arena.mode_defense')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedMode === 'battle'}
              className={`mode-tab mode-tab-battle ${selectedMode === 'battle' ? 'active' : ''}`}
              onClick={() => setSelectedMode('battle')}
            >
              ⚡ {t('arena.mode_battle')}
            </button>
          </section>

          {/* Difficulty Filter Chips */}
          <section className="arena-diff-chips" role="group" aria-label="Difficulty Filter">
            <span className="diff-chips-label">🎯 {t('journey.difficulty_label')}:</span>
            <button
              type="button"
              className={`diff-chip ${selectedDifficulty === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedDifficulty('all')}
            >
              {t('journey.filter_all')}
            </button>
            {ARENA_DIFFICULTIES.map((tier) => {
              const unlocked = isTierUnlocked(tier, arenaProgress)
              return (
                <button
                  key={tier}
                  type="button"
                  className={`diff-chip ${selectedDifficulty === tier ? 'active' : ''} ${unlocked ? '' : 'chip-locked'}`}
                  onClick={() => setSelectedDifficulty(tier)}
                >
                  {unlocked ? (tier === 'beginner' ? '🔰 ' : tier === 'intermediate' ? '⚡ ' : '👑 ') : '🔒 '}
                  {t(`arena.tier_${tier}`)}
                </button>
              )
            })}
          </section>

          {/* Scenario Grid */}
          <section className="arena-scenarios-grid" aria-label="Available Scenarios">
            {filteredScenarios.map((scenario) => {
              const isCompleted = Boolean(arenaProgress.completedScenarios[scenario.id]?.completed)
              const unlocked = isTierUnlocked(scenario.difficulty, arenaProgress)

              return (
                <article
                  key={scenario.id}
                  className={`scenario-card ${isCompleted ? 'scenario-done' : ''} ${unlocked ? '' : 'scenario-locked'}`}
                >
                  <div className="card-top-row">
                    <div className="card-tags">
                      <span className={`badge-mode badge-mode-${scenario.mode}`}>
                        {scenario.mode === 'attack' ? '⚔️ Attack' : scenario.mode === 'defense' ? '🛡️ Defense' : '⚡ Battle'}
                      </span>
                      <span className={`badge-diff badge-diff-${scenario.difficulty}`}>
                        {t(`arena.tier_${scenario.difficulty}`)}
                      </span>
                    </div>
                    <span className="card-xp-pill">+{scenario.xpReward} XP</span>
                  </div>

                  <h3 className="card-title">{t(scenario.titleKey)}</h3>
                  <p className="card-desc">{t(scenario.descKey)}</p>

                  <div className="card-footer">
                    {isCompleted ? (
                      <span className="status-badge status-completed">✅ {t('arena.scenario_completed')}</span>
                    ) : unlocked ? (
                      <span className="status-badge status-available">⚡ {t('daily.available_badge')}</span>
                    ) : (
                      <span className="status-badge status-locked" title={t(`arena.tier_unlock_req_${scenario.difficulty}`)}>
                        🔒 {t('arena.tier_locked')}
                      </span>
                    )}

                    <button
                      type="button"
                      className={`btn ${isCompleted ? 'ghost' : 'btn-primary'} btn-play-scenario`}
                      disabled={!unlocked}
                      onClick={() => handleSelectScenario(scenario)}
                      aria-label={`${t(isCompleted ? 'arena.replay_scenario' : 'arena.start_scenario')}: ${t(scenario.titleKey)}`}
                    >
                      {unlocked ? (isCompleted ? t('arena.replay_scenario') : t('arena.start_scenario')) : t('arena.tier_locked')} →
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}
