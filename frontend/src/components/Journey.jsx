import { useState, useEffect } from 'react'
import {
  getAllMissions,
  RANKS,
  getRank,
  getJourneyProgress,
  saveJourneyProgress,
  evaluateChoice,
  resetJourneyProgress,
  getNextMissionId,
  addGeneratedMission,
  addAdaptiveMission,
  isMissionCompleted,
  sortPracticeMissions,
  getNextPracticeQuestion,
  fetchMlAdaptiveRecommendation,
  predictLocalAdaptiveRecommendation,
  getCachedMlRecommendation,
  determineAdaptiveRecommendation,
  isMlRecommendationsEnabled,
  setMlRecommendationsEnabled,
} from '../lib/journey.js'
import {
  deriveArtworkPromptSpec,
  getFallbackArtwork,
  getArtworkAltKey,
  getCachedArtworkStatus,
  setCachedArtworkStatus,
} from '../lib/artworkManager.js'
import { requestGeneratedArtwork } from '../lib/api.js'
import { resolvePracticeTemplateId } from '../lib/missionTemplates.js'


export default function Journey({
  t,
  lang,
  user,
  initialMissionId,
  initialChoice = null,
  initialSubmitted = false,
  initialEvalResult = null,
  onNavigate,
}) {
  const [progress, setProgress] = useState(getJourneyProgress)
  const [selectedMissionId, setSelectedMissionId] = useState(() => {
    if (initialMissionId) return initialMissionId
    const cur = getJourneyProgress()
    return cur.activeMissionId || 'm01'
  })
  const [selectedChoice, setSelectedChoice] = useState(initialChoice)
  const [submitted, setSubmitted] = useState(initialSubmitted)
  const [evalResult, setEvalResult] = useState(initialEvalResult)
  const [activeTab, setActiveTab] = useState('mission') // 'mission' | 'dashboard'
  const [showEvidence, setShowEvidence] = useState(true)
  const [showStorageNotice, setShowStorageNotice] = useState(false)
  const [practiceFilter, setPracticeFilter] = useState('all') // 'all' | 'beginner' | 'intermediate' | 'advanced'
  const [recommendation, setRecommendation] = useState(() => {
    if (isMlRecommendationsEnabled()) {
      return getCachedMlRecommendation() || predictLocalAdaptiveRecommendation()
    }
    return determineAdaptiveRecommendation(getJourneyProgress(), false)
  })
  const [mlCopilotActive, setMlCopilotActive] = useState(() => isMlRecommendationsEnabled())

  const handleToggleMlCopilot = (enabled) => {
    setMlRecommendationsEnabled(enabled, true)
    setMlCopilotActive(enabled)
    if (enabled) {
      setRecommendation(predictLocalAdaptiveRecommendation(progress))
    } else {
      setRecommendation(determineAdaptiveRecommendation(progress, false))
    }
  }

  const allMissions = getAllMissions()
  const campaignMissions = allMissions.filter((m) => ['m01', 'm02', 'm03', 'm04'].includes(m.id))
  const practiceMissions = sortPracticeMissions(
    allMissions.filter((m) => !['m01', 'm02', 'm03', 'm04'].includes(m.id) && !m.id.startsWith('m0'))
  )
  const completedCampaignCount = campaignMissions.filter((m) => isMissionCompleted(m.id)).length
  const completedPracticeCount = practiceMissions.filter((m) => isMissionCompleted(m.id)).length
  const currentMission = allMissions.find((m) => m.id === selectedMissionId) || allMissions[0]
  const isCompleted = isMissionCompleted(currentMission.id)

  const [artworkState, setArtworkState] = useState(() => {
    const cached = getCachedArtworkStatus(currentMission.id)
    if (cached && cached.artwork_url && !cached.artwork_url.includes('/diff_')) {
      return {
        missionId: currentMission.id,
        url: cached.artwork_url,
        isAi: cached.is_ai_generated || false,
        status: cached.status || 'cached',
      }
    }
    return {
      missionId: currentMission.id,
      url: getFallbackArtwork(currentMission),
      isAi: false,
      status: 'offline',
    }
  })

  useEffect(() => {
    let cancelled = false
    const cached = getCachedArtworkStatus(currentMission.id)
    if (cached && cached.artwork_url && !cached.artwork_url.includes('/diff_')) {
      setArtworkState({
        missionId: currentMission.id,
        url: cached.artwork_url,
        isAi: cached.is_ai_generated || false,
        status: cached.status || 'cached',
      })
      return
    }

    // Immediately display guaranteed offline fallback
    setArtworkState({
      missionId: currentMission.id,
      url: getFallbackArtwork(currentMission),
      isAi: false,
      status: 'offline',
    })

    // Non-blocking query to AI generator when online and available
    const spec = deriveArtworkPromptSpec(currentMission)
    requestGeneratedArtwork(spec)
      .then((res) => {
        if (cancelled || !res) return
        if ((res.status === 'available' || res.status === 'cached') && res.artwork_url && !res.artwork_url.includes('/diff_')) {
          setCachedArtworkStatus(currentMission.id, res)
          setArtworkState({
            missionId: currentMission.id,
            url: res.artwork_url,
            isAi: res.is_ai_generated,
            status: res.status,
          })
        }
      })
      .catch(() => {
        // Fallback remains active; never disrupts gameplay
      })

    return () => {
      cancelled = true
    }
  }, [currentMission.id])

  useEffect(() => {
    const stored = getJourneyProgress()
    setProgress(stored)
    if (stored.activeMissionId && allMissions.some((m) => m.id === stored.activeMissionId)) {
      setSelectedMissionId(stored.activeMissionId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!isMlRecommendationsEnabled()) {
      setRecommendation(determineAdaptiveRecommendation(progress, false))
      return
    }
    fetchMlAdaptiveRecommendation(progress, user)
      .then((rec) => {
        if (!cancelled && rec) {
          setRecommendation(rec)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecommendation(predictLocalAdaptiveRecommendation(progress))
        }
      })
    return () => {
      cancelled = true
    }
  }, [progress, user])

  const currentRank = getRank(progress.totalXp)
  const nextRank = RANKS.find((r) => r.minXp > progress.totalXp)
  const xpNeeded = nextRank ? nextRank.minXp - progress.totalXp : 0

  const handleSelectMission = (missionId) => {
    const validMission = allMissions.find((m) => m.id === missionId) || allMissions[0]
    const targetId = validMission.id
    setSelectedMissionId(targetId)
    setSelectedChoice(null)
    setSubmitted(false)
    setEvalResult(null)
    const fresh = getJourneyProgress()
    const updated = {
      ...fresh,
      activeMissionId: targetId,
    }
    saveJourneyProgress(updated)
    setProgress(updated)
  }

  const handleSelectChoice = (choiceId) => {
    if (submitted) return
    setSelectedChoice(choiceId)
  }

  const handleNextPracticeQuestion = () => {
    const result = getNextPracticeQuestion(currentMission.id, {
      difficulty: practiceFilter !== 'all' ? practiceFilter : null,
    })
    if (result && result.mission) {
      handleSelectMission(result.mission.id)
      setActiveTab('mission')
    }
  }

  const handleStartNewRound = () => {
    const result = getNextPracticeQuestion(currentMission.id, {
      difficulty: practiceFilter !== 'all' ? practiceFilter : null,
      forceNewRound: true,
    })
    if (result && result.mission) {
      handleSelectMission(result.mission.id)
      setActiveTab('mission')
    }
  }

  const handleExecuteChoice = () => {
    if (!selectedChoice) return
    const res = evaluateChoice(currentMission.id, selectedChoice)
    setEvalResult(res)
    setSubmitted(true)
    setProgress(res.currentProgress)
  }

  const handleNextMission = () => {
    const all = getAllMissions()
    const currentIndex = all.findIndex((m) => m.id === currentMission.id)
    const isLastMission = currentIndex === -1 || currentIndex >= all.length - 1
    const uncompleted = all.find((m) => !isMissionCompleted(m.id))

    if (isLastMission && !uncompleted) {
      const newMission = addAdaptiveMission()
      const fresh = getJourneyProgress()
      setProgress(fresh)
      handleSelectMission(newMission.id)
    } else {
      const nextId = getNextMissionId(currentMission.id)
      handleSelectMission(nextId)
    }
  }

  const handleGeneratePracticeMission = (difficulty = null, category = null) => {
    const targetDiff = (typeof difficulty === 'string' && difficulty !== 'all')
      ? difficulty
      : (practiceFilter !== 'all' ? practiceFilter : null)
    const options = {}
    if (targetDiff) options.difficulty = targetDiff
    if (category) options.category = category
    const newMission = addAdaptiveMission(options)
    const fresh = getJourneyProgress()
    setProgress(fresh)
    setSelectedMissionId(newMission.id)
    setSelectedChoice(null)
    setSubmitted(false)
    setEvalResult(null)
    setActiveTab('mission')
  }

  const handleStartPracticeTier = (difficulty, category = null) => {
    let existing = null
    if (category) {
      const resolvedTid = resolvePracticeTemplateId(category)
      existing = practiceMissions.find((m) =>
        m.difficulty === difficulty &&
        (m.category === category || m.category?.includes(category) || (resolvedTid && resolvePracticeTemplateId(m) === resolvedTid)) &&
        !isMissionCompleted(m.id)
      ) || practiceMissions.find((m) =>
        (m.category === category || m.category?.includes(category) || (resolvedTid && resolvePracticeTemplateId(m) === resolvedTid)) &&
        !isMissionCompleted(m.id)
      ) || practiceMissions.find((m) =>
        m.difficulty === difficulty &&
        (m.category === category || m.category?.includes(category) || (resolvedTid && resolvePracticeTemplateId(m) === resolvedTid))
      )
    }

    if (!existing && !category) {
      existing = practiceMissions.find((m) => m.difficulty === difficulty && !isMissionCompleted(m.id))
        || practiceMissions.find((m) => m.difficulty === difficulty)
    }

    if (existing) {
      handleSelectMission(existing.id)
      setActiveTab('mission')
    } else {
      handleGeneratePracticeMission(difficulty, category)
    }
  }

  const handleReplay = () => {
    setSelectedChoice(null)
    setSubmitted(false)
    setEvalResult(null)
  }

  const handleResetAll = () => {
    if (window.confirm(t('journey.reset_confirm'))) {
      const fresh = resetJourneyProgress()
      setProgress(fresh)
      setSelectedMissionId('m01')
      setSelectedChoice(null)
      setSubmitted(false)
      setEvalResult(null)
    }
  }

  const isVictory = submitted && selectedChoice === currentMission.correct_choice
  const isDefeat = submitted && selectedChoice !== currentMission.correct_choice
  const isPractice = !['m01', 'm02', 'm03', 'm04'].includes(currentMission.id)
  const chosenChoice = currentMission.choices.find((c) => c.id === selectedChoice)

  return (
    <div className="journey-container">
      {/* Local Persistence & Privacy Notice (Section 6, SR-09) */}
      <div className="privacy-session-banner" role="note">
        <span>{t('journey.persistence_disclaimer')}</span>
        <button
          type="button"
          className="storage-note-toggle"
          onClick={() => setShowStorageNotice((prev) => !prev)}
          aria-expanded={showStorageNotice}
        >
          {showStorageNotice ? '▲ Hide storage details' : '▼ View storage limitations'}
        </button>
        {showStorageNotice && (
          <p className="storage-note-detail">{t('journey.storage_limitations')}</p>
        )}
      </div>

      {/* Page Header */}
      <div className="journey-header">
        <div className="journey-header-text">
          <div className="journey-tag">
            <span>🚀</span> {t('journey.badge_tag')}
          </div>
          <h1>{t('journey.title')}</h1>
          <p className="journey-subtitle">{t('journey.subtitle')}</p>
          <div className="module-assistant-shortcut" style={{ marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn-sm btn-assistant-help"
              onClick={() => onNavigate ? onNavigate('#/assistant?context=journey') : (window.location.hash = '#/assistant?context=journey')}
              title={t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
            >
              🤖 {t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
            </button>
          </div>
        </div>

        {/* Quick Rank Card */}
        <div className="agent-rank-card" aria-label="Agent Rank Status">
          <div className="agent-rank-badge">
            <span className="rank-icon" aria-hidden="true">{currentRank.icon}</span>
            <div className="rank-info">
              <span className="rank-label">{t('journey.agent_rank')}</span>
              <strong className="rank-name">{t(`journey.rank.${currentRank.key}`)}</strong>
            </div>
          </div>
          <div className="agent-xp-meter">
            <div className="xp-tally">
              <span>{progress.totalXp} {t('journey.xp')}</span>
              {nextRank && (
                <span className="xp-needed">
                  +{xpNeeded} XP → {t(`journey.rank.${nextRank.key}`)}
                </span>
              )}
            </div>
            <div
              className="progress-bar-bg"
              role="progressbar"
              aria-valuenow={progress.totalXp}
              aria-valuemin="0"
              aria-valuemax="500"
            >
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min(100, (progress.totalXp / 500) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="journey-nav-pills" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mission'}
          className={`journey-pill-btn ${activeTab === 'mission' ? 'active' : ''}`}
          onClick={() => setActiveTab('mission')}
        >
          <span>🎯 {t('journey.mission_track')} ({completedCampaignCount}/4 {t('journey.ratio_completed')}){practiceMissions.length > 0 ? ` + ${practiceMissions.length} ${t('journey.practice_label')}` : ''}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'dashboard'}
          className={`journey-pill-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span>👤 {t('journey.agent_rank')} & {t('journey.badges')} ({progress.badges.length})</span>
        </button>
      </div>

      {/* Mission Selector Track */}
      {activeTab === 'mission' && (
        <div className="mission-selector-bar" role="region" aria-label={t('journey.mission_select')}>
          <div className="mission-track-label">
            🛡️ {t('journey.campaign_missions_heading')} ({completedCampaignCount}/4 {t('journey.ratio_completed')})
          </div>
          {campaignMissions.map((m) => {
            const mCompleted = isMissionCompleted(m.id)
            const isSelected = m.id === currentMission.id
            return (
              <button
                key={m.id}
                type="button"
                id={`mission-chip-${m.id}`}
                className={`mission-chip ${isSelected ? 'active' : ''} ${mCompleted ? 'completed' : ''}`}
                onClick={() => handleSelectMission(m.id)}
              >
                <div className="mission-chip-thumb">
                  <img
                    src={getFallbackArtwork(m)}
                    alt=""
                    aria-hidden="true"
                    className="mission-chip-thumb-img"
                    loading="lazy"
                  />
                </div>
                <div className="mission-chip-body">
                  <div className="mission-chip-code">{m.code}</div>
                  <div className="mission-chip-title">{t(m.title_key)}</div>
                  <div className="mission-chip-meta">
                    <span className={`difficulty-tag difficulty-${m.difficulty}`}>
                      {t(`journey.difficulty.${m.difficulty}`)}
                    </span>
                    <span className="mission-chip-xp">+{m.xp_reward}XP</span>
                    {mCompleted && <span className="mission-chip-status">✓</span>}
                  </div>
                </div>
              </button>
            )
          })}

          {practiceMissions.length > 0 && (
            <>
              <div className="mission-track-label practice-track-label">
                ⚡ {t('journey.practice_missions_heading')} ({completedPracticeCount}/{practiceMissions.length} {t('journey.ratio_completed')})
              </div>
              <div className="practice-filter-chips" role="group" aria-label={t('journey.difficulty_label')}>
                {['all', 'beginner', 'intermediate', 'advanced'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`practice-filter-chip ${practiceFilter === lvl ? 'active' : ''}`}
                    onClick={() => setPracticeFilter(lvl)}
                  >
                    {lvl === 'all' ? t('journey.filter_all') : t(`journey.difficulty.${lvl}`)}
                  </button>
                ))}
              </div>
              {practiceMissions
                .filter((m) => practiceFilter === 'all' || m.difficulty === practiceFilter)
                .map((m) => {
                const mCompleted = isMissionCompleted(m.id)
                const isSelected = m.id === currentMission.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    id={`mission-chip-${m.id}`}
                    className={`mission-chip mission-chip-practice ${isSelected ? 'active' : ''} ${mCompleted ? 'completed' : ''}`}
                    onClick={() => handleSelectMission(m.id)}
                  >
                    <div className="mission-chip-thumb">
                      <img
                        src={getFallbackArtwork(m)}
                        alt=""
                        aria-hidden="true"
                        className="mission-chip-thumb-img"
                        loading="lazy"
                      />
                    </div>
                    <div className="mission-chip-body">
                      <div className="mission-chip-code">{m.code}</div>
                      <div className="mission-chip-title">{t(m.title_key)}</div>
                      <div className="mission-chip-meta">
                        <span className={`difficulty-tag difficulty-${m.difficulty}`}>
                          {t(`journey.difficulty.${m.difficulty}`)}
                        </span>
                        <span className="mission-chip-xp">+{m.xp_reward}XP</span>
                        {mCompleted && <span className="mission-chip-status">✓</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          <button
            type="button"
            id="journey-generate-mission-btn"
            className="btn-generate-mission"
            onClick={handleGeneratePracticeMission}
          >
            <span>{t('journey.generate_mission')}</span>
          </button>
        </div>
      )}

      {activeTab === 'dashboard' ? (
        /* Agent Profile & Badges Dashboard */
        <section className="journey-dashboard-panel" aria-label="Agent Dashboard">
          {/* Adaptive Learning Copilot Card (ML Recommender + Safety Guardrail) */}
          <div className="card dashboard-card journey-adaptive-rec-card" id="journey-adaptive-rec-card">
            <div className="rec-card-header">
              <div className="rec-header-titles">
                <span className="rec-sparkle-icon" aria-hidden="true">💡</span>
                <div>
                  <h3>{t('journey.rec.card_title')}</h3>
                  <p className="rec-rationale-text">
                    {recommendation?.reason === 'insufficient_data'
                      ? t('journey.rec.reason_insufficient')
                      : recommendation?.reason?.includes('remediation')
                      ? t('journey.rec.reason_remediation')
                      : (recommendation?.reason?.includes('mastery') || recommendation?.reason?.includes('advancement'))
                      ? t('journey.rec.reason_advancement')
                      : t('journey.rec.reason_steady')}
                  </p>
                </div>
              </div>
              <div className="rec-badge-row">
                {recommendation?.engine?.startsWith('ml') ? (
                  <span className="rec-engine-pill rec-pill-ml" title="Multi-Class Softmax Logistic Regression Classifier">
                    ⚡ {t('journey.rec.card_badge_ml')} ({Math.round((recommendation?.confidence || 0) * 100)}%)
                  </span>
                ) : (
                  <span className="rec-engine-pill rec-pill-det" title="Pedagogical Guardrail & Deterministic Rules">
                    🛡️ {t('journey.rec.card_badge_deterministic')}
                  </span>
                )}
              </div>
            </div>

            {/* User Toggle: ML Adaptive Copilot vs Pedagogical Deterministic Rule Engine */}
            <div className="rec-toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', margin: '12px 0' }}>
              <label htmlFor="journey-ml-toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  id="journey-ml-toggle"
                  checked={mlCopilotActive}
                  onChange={(e) => handleToggleMlCopilot(e.target.checked)}
                />
                <span>⚡ {t('journey.rec.toggle_ml_label')}</span>
              </label>
              <span className="small text-muted" style={{ fontSize: '12px' }}>
                {t('journey.rec.toggle_ml_desc')}
              </span>
            </div>

            <div className="rec-details-grid">
              <div className="rec-detail-item">
                <span className="rec-detail-label">{t('journey.rec.target_diff')}</span>
                <span className={`difficulty-tag difficulty-${recommendation?.difficulty || 'beginner'}`}>
                  {t(`journey.difficulty.${recommendation?.difficulty || 'beginner'}`)}
                </span>
              </div>
              <div className="rec-detail-item">
                <span className="rec-detail-label">{t('journey.rec.target_topic')}</span>
                <span className="rec-detail-value">
                  {recommendation?.targetCategory
                    ? (t(`journey.cat.${recommendation.targetCategory}`) || recommendation.targetCategory)
                    : t('journey.cat.general')}
                </span>
              </div>
              <div className="rec-detail-item">
                <span className="rec-detail-label">{t('journey.rec.recommended_module')}</span>
                <span className="rec-detail-value highlight-cyan">
                  {t(`journey.rec.module_${recommendation?.recommendedModule || 'm5'}`) || (recommendation?.recommendedModule || 'm5').toUpperCase()}
                </span>
              </div>
            </div>

            <div className="rec-actions">
              <button
                type="button"
                id="btn-rec-start-practice"
                className="btn btn-primary-action"
                onClick={() => handleStartPracticeTier(recommendation?.difficulty || 'beginner', recommendation?.targetCategory || null)}
              >
                ⚡ {t('journey.rec.launch_btn')} ({t(`journey.difficulty.${recommendation?.difficulty || 'beginner'}`)}) →
              </button>
              {recommendation?.recommendedModule && recommendation.recommendedModule !== 'm5' && (
                <a
                  id="btn-rec-explore-module"
                  className="btn ghost"
                  href={`#/${recommendation.recommendedModule}`}
                >
                  🚀 {t('journey.rec.explore_module_btn')} ({recommendation.recommendedModule.toUpperCase()})
                </a>
              )}
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="card dashboard-card">
              <h3>🛡️ {t('journey.agent_rank')}</h3>
              <div className="rank-showcase">
                <span className="showcase-icon">{currentRank.icon}</span>
                <div className="showcase-details">
                  <h4>{t(`journey.rank.${currentRank.key}`)}</h4>
                  <p className="small">
                    {progress.totalXp} {t('journey.xp')} — {t('journey.xp_earned_desc')}
                  </p>
                </div>
              </div>
              <div className="rank-ladder">
                {RANKS.map((r) => {
                  const unlocked = progress.totalXp >= r.minXp
                  return (
                    <div
                      key={r.key}
                      className={`rank-ladder-step ${unlocked ? 'unlocked' : 'locked'}`}
                    >
                      <span className="ladder-icon">{r.icon}</span>
                      <span className="ladder-name">{t(`journey.rank.${r.key}`)}</span>
                      <span className="ladder-xp">{r.minXp} {t('journey.xp')}</span>
                      <span className="ladder-status">{unlocked ? '✓' : '🔒'}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card dashboard-card">
              <h3>🏅 {t('journey.badges')}</h3>
              {progress.badges.length === 0 ? (
                <div className="empty-badges">
                  <p>{t('journey.no_badges')}</p>
                </div>
              ) : (
                <div className="badges-list">
                  {progress.badges.map((b) => (
                    <div key={b} className="badge-item unlocked">
                      <span className="badge-item-icon">🎖️</span>
                      <div>
                        <strong>{t(`journey.badge.${b}`) || t('journey.badge.earned')}</strong>
                        <p className="small">{t(`journey.badge.${b}_desc`) || t('journey.badge.desc')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="dashboard-stats">
                <div className="stat-box">
                  <span className="stat-num">{Object.keys(progress.completedMissions).length}</span>
                  <span className="stat-lbl">{t('journey.missions_completed')}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-num">{progress.totalXp}</span>
                  <span className="stat-lbl">{t('journey.xp')}</span>
                </div>
              </div>

              <div className="reset-box">
                <button
                  type="button"
                  id="journey-reset-progress-btn"
                  className="btn ghost btn-danger-soft"
                  onClick={handleResetAll}
                >
                  🔄 {t('journey.reset_progress')}
                </button>
              </div>
            </div>
          </div>

          {/* Difficulty Tiers & Game Artwork Showcase */}
          <div className="card dashboard-card difficulty-tiers-showcase">
            <div className="difficulty-tiers-header">
              <h3>⚡ {t('journey.difficulty_tiers_heading')}</h3>
              <p className="small">{t('journey.difficulty_tiers_subheading')}</p>
            </div>
            <div className="difficulty-cards-grid">
              <div className="difficulty-tier-card tier-beginner">
                <div className="difficulty-card-media">
                  <img
                    src="/images/journey/diff_beginner.svg"
                    alt={t('journey.difficulty.beginner_artwork_alt')}
                    className="difficulty-card-artwork"
                    loading="lazy"
                  />
                </div>
                <div className="difficulty-card-body">
                  <div className="difficulty-tag-row">
                    <span className="difficulty-tag difficulty-beginner">{t('journey.difficulty.beginner')}</span>
                    <span className="tier-xp-pill">100 XP</span>
                  </div>
                  <h4>{t('journey.difficulty.beginner_title')}</h4>
                  <p className="small">{t('journey.difficulty.beginner_desc')}</p>
                  <button
                    type="button"
                    id="btn-practice-tier-beginner"
                    className="btn btn-tier-practice btn-tier-beginner"
                    onClick={() => handleStartPracticeTier('beginner')}
                  >
                    ⚡ {t('journey.practice_tier_btn')} ({t('journey.difficulty.beginner')}) →
                  </button>
                </div>
              </div>

              <div className="difficulty-tier-card tier-intermediate">
                <div className="difficulty-card-media">
                  <img
                    src="/images/journey/diff_intermediate.svg"
                    alt={t('journey.difficulty.intermediate_artwork_alt')}
                    className="difficulty-card-artwork"
                    loading="lazy"
                  />
                </div>
                <div className="difficulty-card-body">
                  <div className="difficulty-tag-row">
                    <span className="difficulty-tag difficulty-intermediate">{t('journey.difficulty.intermediate')}</span>
                    <span className="tier-xp-pill">150 XP</span>
                  </div>
                  <h4>{t('journey.difficulty.intermediate_title')}</h4>
                  <p className="small">{t('journey.difficulty.intermediate_desc')}</p>
                  <button
                    type="button"
                    id="btn-practice-tier-intermediate"
                    className="btn btn-tier-practice btn-tier-intermediate"
                    onClick={() => handleStartPracticeTier('intermediate')}
                  >
                    ⚡ {t('journey.practice_tier_btn')} ({t('journey.difficulty.intermediate')}) →
                  </button>
                </div>
              </div>

              <div className="difficulty-tier-card tier-advanced">
                <div className="difficulty-card-media">
                  <img
                    src="/images/journey/diff_advanced.svg"
                    alt={t('journey.difficulty.advanced_artwork_alt')}
                    className="difficulty-card-artwork"
                    loading="lazy"
                  />
                </div>
                <div className="difficulty-card-body">
                  <div className="difficulty-tag-row">
                    <span className="difficulty-tag difficulty-advanced">{t('journey.difficulty.advanced')}</span>
                    <span className="tier-xp-pill">200 XP</span>
                  </div>
                  <h4>{t('journey.difficulty.advanced_title')}</h4>
                  <p className="small">{t('journey.difficulty.advanced_desc')}</p>
                  <button
                    type="button"
                    id="btn-practice-tier-advanced"
                    className="btn btn-tier-practice btn-tier-advanced"
                    onClick={() => handleStartPracticeTier('advanced')}
                  >
                    ⚡ {t('journey.practice_tier_btn')} ({t('journey.difficulty.advanced')}) →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Active Mission Gameplay View */
        <section className="mission-view" aria-label={t(currentMission.title_key)}>
          {/* Mission Meta Banner */}
          <div className="mission-banner">
            <div className="mission-banner-layout">
              <div className="mission-banner-info">
                <div className="mission-badge-header">
                  <span className="mission-code">{currentMission.code}</span>
                  <span className={`difficulty-tag difficulty-${currentMission.difficulty}`}>
                    {t(`journey.difficulty.${currentMission.difficulty}`)}
                  </span>
                  {(!['m01', 'm02', 'm03', 'm04'].includes(currentMission.id) || currentMission.id.startsWith('gen_m')) && (
                    <span className="difficulty-tag" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
                      ⚡ {t('journey.practice_badge')}
                    </span>
                  )}
                  <span className="mission-xp-tag">+{currentMission.xp_reward} XP</span>
                  {isCompleted && (
                    <span className="status-badge-complete">{t('journey.status_completed')}</span>
                  )}
                </div>
                <h2>{t(currentMission.title_key)}</h2>
                <p className="mission-subtitle">{t(currentMission.subtitle_key)}</p>
              </div>
              <div className="mission-banner-media">
                <img
                  src={(artworkState.missionId === currentMission.id && artworkState.url && !artworkState.url.includes('/diff_')) ? artworkState.url : getFallbackArtwork(currentMission)}
                  alt={t(getArtworkAltKey(currentMission))}
                  className="mission-artwork-img"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
                <div className="mission-artwork-fallback" style={{ display: 'none' }} aria-hidden="true">
                  <span className="fallback-cyber-icon">🛡️</span>
                  <span className="fallback-cyber-label">{currentMission.code}</span>
                </div>
                <div className="artwork-meta-bar">
                  {(artworkState.missionId === currentMission.id && artworkState.isAi) ? (
                    <span className="artwork-status-pill artwork-status-ai" title={t('journey.artwork_ai_pill_title')}>
                      ⚡ {t('journey.artwork_ai_pill')}
                    </span>
                  ) : (
                    <span className="artwork-status-pill artwork-status-offline" title={t('journey.artwork_offline_pill_title')}>
                      🛡️ {t('journey.artwork_offline_pill')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Scenario Simulation */}
          <div className="scenario-card">
            <div className="scenario-card-header">
              <span className="intel-pill">🚨 {t(currentMission.briefing_label_key)}</span>
              <span className="channel-tag">{t('journey.simulated_disclaimer')}</span>
            </div>

            <div className="telegram-chat-sim">
              <div className="telegram-message">
                <div className="telegram-avatar" aria-hidden="true">🇪🇹</div>
                <div className="telegram-bubble">
                  <div className="telegram-sender">
                    <strong>{t(currentMission.sender_name_key)}</strong>
                    <span className="unverified-tag" title="Unverified Channel">
                      {currentMission.channel_handle}
                    </span>
                  </div>
                  <p className="telegram-text">{t(currentMission.story_key)}</p>
                  <div className="telegram-target-box" aria-label="Simulated Link Display">
                    <span className="target-icon">🌐</span>
                    <code className="target-url">{currentMission.target_url}</code>
                  </div>
                  <div className="telegram-time">{t('journey.telegram_time')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Investigation & Warning Signs Board */}
          <div className="evidence-panel">
            <div className="evidence-header">
              <h3>🔍 {t('journey.evidence.title')}</h3>
              <button
                type="button"
                className="btn-toggle-evidence"
                onClick={() => setShowEvidence((prev) => !prev)}
                aria-expanded={showEvidence}
              >
                {showEvidence ? t('journey.evidence.hide') : t('journey.evidence.show')}
              </button>
            </div>

            {showEvidence && (
              <div className="evidence-grid">
                {currentMission.evidence_items.map((item) => (
                  <div key={item.id} className="evidence-card">
                    <span className="evidence-icon" aria-hidden="true">{item.icon}</span>
                    <div>
                      <strong>{t(item.title_key)}</strong>
                      <p>{t(item.desc_key)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Tactical Decision Choices */}
          <div className="decision-panel">
            <div className="decision-header">
              <h3>🎯 {t(currentMission.decision_title_key || 'journey.decision.title')}</h3>
              <p>{t(currentMission.decision_desc_key || 'journey.decision.desc')}</p>
            </div>

            <div className="choices-list" role="radiogroup" aria-label={t(currentMission.decision_title_key || 'journey.decision.title')}>
              {currentMission.choices.map((choice) => {
                const isSelected = selectedChoice === choice.id
                let choiceStateClass = ''
                if (submitted) {
                  if (choice.id === currentMission.correct_choice) {
                    choiceStateClass = 'choice-correct'
                  } else if (isSelected) {
                    choiceStateClass = 'choice-wrong'
                  }
                }

                return (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={submitted}
                    className={`choice-card ${isSelected ? 'selected' : ''} ${choiceStateClass}`}
                    onClick={() => handleSelectChoice(choice.id)}
                  >
                    <span className="choice-icon" aria-hidden="true">{choice.icon}</span>
                    <span className="choice-text">{t(choice.label_key)}</span>
                    <span className="choice-selector">
                      {isSelected ? '●' : '○'}
                    </span>
                  </button>
                )
              })}
            </div>

            {!submitted && (
              <div className="decision-action">
                <button
                  type="button"
                  id="journey-execute-choice-btn"
                  className="btn btn-primary-action"
                  disabled={!selectedChoice}
                  onClick={handleExecuteChoice}
                >
                  {t('journey.decision.execute_btn')}
                </button>
              </div>
            )}
          </div>

          {/* Step 4: Outcome Resolution */}
          {submitted && (
            <div className={`outcome-card ${isVictory ? 'outcome-victory' : 'outcome-defeat'}`}>
              <div className="outcome-icon" aria-hidden="true">
                {isVictory ? '🛡️' : '⚠️'}
              </div>
              <div className="outcome-content">
                <h3>{isVictory ? t('journey.outcome.victory_title') : t('journey.outcome.defeat_title')}</h3>
                {isVictory && (
                  <>
                    <p>{t(chosenChoice?.feedback_key || 'journey.outcome.victory_desc')}</p>
                    <div className="victory-reward-badge">
                      {evalResult?.newlyCompleted ? (
                        <span>🎉 +{evalResult.awardedXp} {t('journey.xp')}</span>
                      ) : (
                        <span>✓ {t('journey.replay_already_awarded')}</span>
                      )}
                      <span>🏅 {t(`journey.badge.${currentMission.badge_id}`) || t('journey.badge.earned')}</span>
                    </div>

                    {/* Adaptive Learning Recommendation Banner */}
                    <div className="post-mission-rec-banner" role="region" aria-label={t('journey.rec.banner_heading')}>
                      <div className="rec-banner-top">
                        <span className="rec-banner-title">⚡ {t('journey.rec.banner_heading')}</span>
                        {recommendation?.engine?.startsWith('ml') ? (
                          <span className="rec-engine-pill rec-pill-ml-mini">AI/ML ({Math.round((recommendation?.confidence || 0) * 100)}%)</span>
                        ) : (
                          <span className="rec-engine-pill rec-pill-det-mini">{t('journey.rec.card_badge_deterministic')}</span>
                        )}
                      </div>
                      <p className="rec-banner-desc">
                        {recommendation?.reason?.includes('remediation')
                          ? t('journey.rec.reason_remediation')
                          : (recommendation?.reason?.includes('mastery') || recommendation?.reason?.includes('advancement'))
                          ? t('journey.rec.reason_advancement')
                          : t('journey.rec.reason_steady')}
                        {' — '}
                        <strong>{t('journey.rec.target_diff')}: {t(`journey.difficulty.${recommendation?.difficulty || 'beginner'}`)}</strong>
                        {recommendation?.targetCategory && (
                          <span> ({t(`journey.cat.${recommendation.targetCategory}`) || recommendation.targetCategory})</span>
                        )}
                      </p>
                      <div className="rec-banner-action-row">
                        <button
                          type="button"
                          id="btn-victory-rec-launch"
                          className="btn btn-rec-banner-launch"
                          onClick={() => handleStartPracticeTier(recommendation?.difficulty || 'beginner', recommendation?.targetCategory || null)}
                        >
                          ⚡ {t('journey.rec.launch_btn')} ({t(`journey.difficulty.${recommendation?.difficulty || 'beginner'}`)}) →
                        </button>
                        {recommendation?.recommendedModule && recommendation.recommendedModule !== 'm5' && (
                          <a
                            className="btn ghost btn-rec-banner-module"
                            href={`#/${recommendation.recommendedModule}`}
                          >
                            🚀 {t('journey.rec.explore_module_btn')} ({recommendation.recommendedModule.toUpperCase()})
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Obvious Next Mission or Next Practice Question Button */}
                    <div className="journey-action-row victory-actions">
                      {isPractice ? (
                        <>
                          <button
                            type="button"
                            id="journey-next-question-btn"
                            className="btn btn-next-mission"
                            onClick={handleNextPracticeQuestion}
                            aria-label={t('journey.next_question')}
                          >
                            ⚡ {t('journey.next_question')} →
                          </button>
                          <button
                            type="button"
                            id="journey-start-round-btn"
                            className="btn btn-generate-mission"
                            onClick={handleStartNewRound}
                            aria-label={t('journey.practice.start_new_round')}
                          >
                            🔄 {t('journey.practice.start_new_round')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            id="journey-next-mission-btn"
                            className="btn btn-next-mission"
                            onClick={handleNextMission}
                          >
                            {t('journey.next_mission')}
                          </button>
                          <button
                            type="button"
                            id="journey-victory-generate-btn"
                            className="btn btn-generate-mission"
                            onClick={handleGeneratePracticeMission}
                          >
                            {t('journey.generate_mission')}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={handleReplay}
                      >
                        🔄 {t('journey.retry')}
                      </button>
                    </div>
                  </>
                )}
                {isDefeat && (
                  <>
                    <p>{t(chosenChoice?.feedback_key || 'journey.outcome.defeat_title')}</p>
                    <div className="post-mission-rec-banner post-mission-rec-remediation" role="region" aria-label={t('journey.rec.banner_heading')}>
                      <div className="rec-banner-top">
                        <span className="rec-banner-title">⚡ {t('journey.rec.banner_heading')}</span>
                        {recommendation?.engine?.startsWith('ml') ? (
                          <span className="rec-engine-pill rec-pill-ml-mini">AI/ML ({Math.round((recommendation?.confidence || 0) * 100)}%)</span>
                        ) : (
                          <span className="rec-engine-pill rec-pill-det-mini">{t('journey.rec.card_badge_deterministic')}</span>
                        )}
                      </div>
                      <p className="rec-banner-desc">
                        {t('journey.rec.reason_remediation')}
                        {' — '}
                        <strong>{t('journey.rec.target_diff')}: {t(`journey.difficulty.${recommendation?.difficulty || 'beginner'}`)}</strong>
                        {recommendation?.targetCategory && (
                          <span> ({t(`journey.cat.${recommendation.targetCategory}`) || recommendation.targetCategory})</span>
                        )}
                      </p>
                      <div className="rec-banner-action-row">
                        <button
                          type="button"
                          id="btn-defeat-rec-launch"
                          className="btn btn-rec-banner-launch"
                          onClick={() => handleStartPracticeTier(recommendation?.difficulty || 'beginner', recommendation?.targetCategory || null)}
                        >
                          ⚡ {t('journey.rec.launch_btn')} ({t(`journey.difficulty.${recommendation?.difficulty || 'beginner'}`)}) →
                        </button>
                        {recommendation?.recommendedModule && recommendation.recommendedModule !== 'm5' && (
                          <a
                            className="btn ghost btn-rec-banner-module"
                            href={`#/${recommendation.recommendedModule}`}
                          >
                            🚀 {t('journey.rec.explore_module_btn')} ({recommendation.recommendedModule.toUpperCase()})
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="journey-action-row defeat-actions">
                      {isPractice && (
                        <button
                          type="button"
                          id="journey-next-question-btn"
                          className="btn btn-next-mission"
                          onClick={handleNextPracticeQuestion}
                          aria-label={t('journey.next_question')}
                        >
                          ⚡ {t('journey.next_question')} →
                        </button>
                      )}
                      <button
                        type="button"
                        id="journey-retry-mission-btn"
                        className="btn ghost retry-btn"
                        onClick={handleReplay}
                      >
                        🔄 {t('journey.retry')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Tactical Debrief & Action Links */}
          {(isVictory || isCompleted) && (
            <div className="debrief-panel">
              <div className="debrief-header">
                <h3>📜 {t('journey.debrief.title')}</h3>
              </div>
              <ul className="debrief-rules-list">
                {currentMission.debrief_rules.map((ruleKey, idx) => (
                  <li key={idx}>{t(ruleKey)}</li>
                ))}
              </ul>

              <div className="debrief-actions">
                {isPractice ? (
                  <button
                    type="button"
                    id="journey-debrief-next-question-btn"
                    className="btn btn-next-mission"
                    onClick={handleNextPracticeQuestion}
                    aria-label={t('journey.next_question')}
                  >
                    ⚡ {t('journey.next_question')} →
                  </button>
                ) : (
                  <button
                    type="button"
                    id="journey-debrief-next-mission-btn"
                    className="btn btn-next-mission"
                    onClick={handleNextMission}
                  >
                    {t('journey.next_mission')}
                  </button>
                )}
                <a className="btn hero-btn-primary" href="#/m1">
                  🔗 {t('journey.debrief.cta_m1')}
                </a>
                {(currentMission.category === 'password_safety' || currentMission.id === 'p02') && (
                  <a className="btn hero-btn-accent" href="#/m2" id="journey-debrief-m2-link">
                    🔑 {t('journey.debrief.cta_m2')}
                  </a>
                )}
                <a className="btn hero-btn-secondary" href="#/m3">
                  📋 {t('journey.debrief.cta_m3')}
                </a>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleReplay}
                >
                  🔄 {t('journey.retry')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
