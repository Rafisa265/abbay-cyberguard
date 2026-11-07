import { useState, useEffect, useRef } from 'react'
import {
  TOPICS,
  LEVELS,
  QUICK_CHECKS,
  getQuestionsForLevel,
  evaluateLevel,
  isCorrect,
} from '../lib/quiz.js'
import {
  getAcademyCertificateStatus,
  getProgress,
  issueAcademyCertificate,
  saveProgress,
  startAcademyLevelAttempt,
  submitAcademyLevelAttempt,
} from '../lib/api.js'
import { recordQuizLevelPassed, getUnifiedLearningProgress } from '../lib/learningProgress.js'
import { ACADEMY_TOPIC_ARTWORK_MAP } from '../lib/artworkManager.js'
import {
  ACADEMY_STAGES,
  ACADEMY_LEVELS,
  getLevelCurriculum,
} from '../lib/academyCurriculum.js'
import {
  loadAcademyProgress,
  saveAcademyProgress,
  saveQuizAnswers,
  markLessonSectionCompleted,
  recordSimulationChallenge,
  resetAcademyProgress,
  hasCertificateSyncConsent,
  saveCertificateSyncConsent,
} from '../lib/academyStorage.js'
import {
  calculateTopicMastery,
  generateAdaptiveRecommendations,
  getSmartRevisionQueue,
} from '../lib/adaptiveEngine.js'
import AcademyDashboard from './AcademyDashboard.jsx'
import AcademySimLab from './AcademySimLab.jsx'
import AcademyCertificateModal from './AcademyCertificateModal.jsx'

const OPTION_LETTERS = ['A', 'B', 'C']
const LESSON_SECTIONS = ['overview', 'how', 'examples', 'warnings', 'actions', 'recap']
function renderStructuredLessonText(text) {
  if (!text) return null
  const paragraphs = text.split('\n\n').filter(Boolean)
  return (
    <div className="lesson-structured-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {paragraphs.map((p, idx) => {
        if (p.includes('\n- ') || p.startsWith('- ')) {
          const lines = p.split('\n').filter(Boolean)
          const header = lines[0].startsWith('- ') ? null : lines[0]
          const bullets = lines.filter((l) => l.startsWith('- ')).map((l) => l.replace(/^- \s*/, ''))
          return (
            <div key={idx} style={{ marginTop: '2px' }}>
              {header && <p style={{ margin: '0 0 6px 0', color: '#F8FAFC', fontWeight: 600 }}>{header}</p>}
              <ul style={{ margin: 0, paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {bullets.map((b, bIdx) => (
                  <li key={bIdx} style={{ color: '#CBD5E1', lineHeight: 1.65 }}>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )
        }
        return (
          <p key={idx} style={{ margin: 0, color: '#CBD5E1', lineHeight: 1.7, fontSize: '0.94rem' }}>
            {p}
          </p>
        )
      })}
    </div>
  )
}

export default function Learn({ t, user, onNavigate }) {
  // Academy Mode / Tab State: 'curriculum' | 'lessons' | 'simlab' | 'quiz' | 'dashboard'
  const [academyTab, setAcademyTab] = useState('curriculum')

  // Lesson State
  const [activeLesson, setActiveLesson] = useState(0)
  const [activeSection, setActiveSection] = useState('overview')
  const [quickCheckAnswers, setQuickCheckAnswers] = useState({})

  // Progression & Level State
  const [activeLevel, setActiveLevel] = useState(1)
  const [unlockedLevels, setUnlockedLevels] = useState([1])
  const [completedLevels, setCompletedLevels] = useState({})

  // Academy Storage State
  const [academyProgress, setAcademyProgress] = useState(() => loadAcademyProgress())
  const [activeCertificate, setActiveCertificate] = useState(null)
  const [certificateStatus, setCertificateStatus] = useState(null)
  const [certificateSyncError, setCertificateSyncError] = useState('')
  const [certificateSyncEnabled, setCertificateSyncEnabled] = useState(
    () => hasCertificateSyncConsent(user?.id),
  )
  const [serverAttempt, setServerAttempt] = useState(null)
  const [serverAttemptAnswers, setServerAttemptAnswers] = useState({})
  const [serverAttemptBusy, setServerAttemptBusy] = useState(false)
  const certificateSyncEnabledRef = useRef(certificateSyncEnabled)
  const certificateSyncUserIdRef = useRef(user?.id == null ? null : String(user.id))
  const certificateSyncRequests = useRef(new Set())

  // Curriculum Stage Inspection State
  const [selectedCurriculumStage, setSelectedCurriculumStage] = useState('stage_1')
  const [expandedCurriculumLevel, setExpandedCurriculumLevel] = useState(1)

  const revokeCertificateSync = () => {
    certificateSyncEnabledRef.current = false
    certificateSyncRequests.current.forEach((controller) => controller.abort())
    certificateSyncRequests.current.clear()
    setServerAttempt(null)
    setServerAttemptAnswers({})
    const updated = saveCertificateSyncConsent(false, user?.id)
    setAcademyProgress(updated)
    setCertificateSyncEnabled(false)
    setCertificateStatus(null)
    setCertificateSyncError('')
    setActiveCertificate(null)
  }

  // Load progress from local storage and optional cloud sync on mount
  useEffect(() => {
    const accountId = user?.id == null ? null : String(user.id)
    const accountHasConsent = hasCertificateSyncConsent(accountId)
    if (certificateSyncUserIdRef.current !== accountId) {
      certificateSyncRequests.current.forEach((controller) => controller.abort())
      certificateSyncRequests.current.clear()
      certificateSyncUserIdRef.current = accountId
      setServerAttempt(null)
      setServerAttemptAnswers({})
    }
    certificateSyncEnabledRef.current = accountHasConsent
    setCertificateSyncEnabled(accountHasConsent)

    const stored = loadAcademyProgress()
    setAcademyProgress(stored)

    const localUnified = getUnifiedLearningProgress()
    const mergedCompleted = { ...(stored.completedLevels || {}) }

    if (localUnified?.quiz?.levelsData && Object.keys(localUnified.quiz.levelsData).length > 0) {
      Object.assign(mergedCompleted, localUnified.quiz.levelsData)
    }

    setCompletedLevels(mergedCompleted)

    const unlocked = [1]
    for (let l = 1; l <= LEVELS.length; l++) {
      if (mergedCompleted[l]?.passed && l < LEVELS.length) {
        unlocked.push(l + 1)
      }
    }
    const finalUnlocked = Array.from(new Set(unlocked))
    setUnlockedLevels(finalUnlocked)

    // Optional Cloud Sync (Off by default, user-enabled preference only)
    if (user?.preferences?.cloud_progress_sync_enabled) {
      getProgress()
        .then((res) => {
          if (res?.progress) {
            if (res.progress.active_level) setActiveLevel(res.progress.active_level)
            if (Array.isArray(res.progress.unlocked_levels) && res.progress.unlocked_levels.length > 0) {
              setUnlockedLevels(Array.from(new Set([...finalUnlocked, ...res.progress.unlocked_levels])))
            }
            if (res.progress.completed_levels && typeof res.progress.completed_levels === 'object') {
              setCompletedLevels((prev) => ({ ...prev, ...res.progress.completed_levels }))
            }
          }
        })
        .catch(() => {})
    }
  }, [user])

  // Local navigation is not evidence that lesson content was read.
  useEffect(() => {
    const currentTopicKey = TOPICS[activeLesson]
    if (currentTopicKey && activeSection) {
      const updated = markLessonSectionCompleted(currentTopicKey, activeSection)
      setAcademyProgress(updated)
    }
  }, [activeLesson, activeSection])

  useEffect(() => {
    let active = true
    if (!user || !hasCertificateSyncConsent(user.id)) {
      setCertificateStatus(null)
      return () => { active = false }
    }

    const controller = new AbortController()
    certificateSyncRequests.current.add(controller)
    getAcademyCertificateStatus({ signal: controller.signal })
      .then((status) => {
        if (active && certificateSyncEnabledRef.current &&
            certificateSyncUserIdRef.current === String(user.id)) {
          setCertificateStatus(status)
          setCertificateSyncError('')
        }
      })
      .catch(() => {
        if (active && certificateSyncEnabledRef.current &&
            certificateSyncUserIdRef.current === String(user.id)) {
          setCertificateSyncError(t('academy.cert.sync_failed') || 'Account progress could not be synchronized. Try again later.')
        }
      })
    return () => {
      active = false
      controller.abort()
      certificateSyncRequests.current.delete(controller)
    }
  }, [user, certificateSyncEnabled, t])

  // Automation hook for certificate modal verification
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__openTestCertificate = (data) => setActiveCertificate(data || {
        stageId: 'stage_1',
        levelNum: 1,
        title: 'Stage 1 — Level 1 Milestone Certificate',
        recipientName: 'Abel Tesfaye',
        score: 95,
        stars: 3,
      })
    }
    return () => {
      if (typeof window !== 'undefined') delete window.__openTestCertificate
    }
  }, [])

  // Quiz State
  const [answers, setAnswers] = useState(() => {
    const stored = loadAcademyProgress()
    return stored.quizAnswers || {}
  })
  const [currentQ, setCurrentQ] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)

  // Current Level Questions & Evaluation
  const currentQuestions = getQuestionsForLevel(activeLevel)
  const safeCurrentQ = Math.min(currentQ, Math.max(0, currentQuestions.length - 1))
  const q = currentQuestions[safeCurrentQ] || currentQuestions[0]
  const currentChosen = q ? answers[q.id] : undefined
  const levelEval = evaluateLevel(answers, activeLevel)
  const allAnswered = levelEval.answered === levelEval.total && levelEval.total > 0

  // Calculate Adaptive Engine Metrics
  const mastery = calculateTopicMastery(answers, academyProgress.completedLessons || {})
  const recommendations = generateAdaptiveRecommendations(mastery, activeLevel, answers)
  const revisionQueue = getSmartRevisionQueue(mastery)

  const handleSelectOption = (qId, optionIdx) => {
    if (answers[qId] !== undefined) return
    const updated = { ...answers, [qId]: optionIdx }
    setAnswers(updated)
    saveQuizAnswers(updated)

    // Check if this was the last question in the level
    const newEval = evaluateLevel(updated, activeLevel)
    if (newEval.answered === newEval.total) {
      if (newEval.passed) {
        const nextCompleted = {
          ...completedLevels,
          [activeLevel]: { passed: true, score: newEval.score, stars: newEval.stars, completed_at: new Date().toISOString() },
        }
        const nextUnlocked =
          activeLevel < LEVELS.length && !unlockedLevels.includes(activeLevel + 1)
            ? [...unlockedLevels, activeLevel + 1]
            : unlockedLevels

        setCompletedLevels(nextCompleted)
        setUnlockedLevels(nextUnlocked)

        // Save into Academy local storage
        const currentStored = loadAcademyProgress()
        currentStored.completedLevels = nextCompleted
        currentStored.unlockedLevels = nextUnlocked
        if (activeLevel < LEVELS.length) {
          currentStored.activeLevel = activeLevel + 1
        }
        saveAcademyProgress(currentStored)
        setAcademyProgress(currentStored)

        // Record in unified learning progress (awards XP, checks badges, queues notification)
        recordQuizLevelPassed(activeLevel, newEval.score, newEval.stars, user).catch(() => {})

        // Optional Cloud Sync when enabled
        if (user?.preferences?.cloud_progress_sync_enabled) {
          saveProgress({
            active_level: activeLevel < LEVELS.length ? activeLevel + 1 : activeLevel,
            unlocked_levels: nextUnlocked,
            completed_levels: nextCompleted,
          }).catch(() => {})
        }
      }
    }
  }

  const handleSelectLevel = (lvlNum) => {
    if (!unlockedLevels.includes(lvlNum)) return
    setActiveLevel(lvlNum)
    setServerAttempt(null)
    setServerAttemptAnswers({})
    setCurrentQ(0)
    setShowResults(false)
    setShowReview(false)
  }

  const handleRetryCurrentLevel = () => {
    setAnswers((prev) => {
      const next = { ...prev }
      currentQuestions.forEach((item) => delete next[item.id])
      saveQuizAnswers(next)
      return next
    })
    setCurrentQ(0)
    setShowResults(false)
    setShowReview(false)
  }

  const handleAdvanceNextLevel = () => {
    if (activeLevel < LEVELS.length && unlockedLevels.includes(activeLevel + 1)) {
      setActiveLevel(activeLevel + 1)
      setServerAttempt(null)
      setServerAttemptAnswers({})
      setCurrentQ(0)
      setShowResults(false)
      setShowReview(false)
    }
  }

  const handleResetAllProgress = () => {
    setAnswers({})
    setActiveLevel(1)
    setUnlockedLevels([1])
    setCompletedLevels({})
    setCurrentQ(0)
    setShowResults(false)
    setShowReview(false)
    setShowConfirmReset(false)
    setServerAttempt(null)
    setServerAttemptAnswers({})
    setQuickCheckAnswers({})
    resetAcademyProgress()
    setAcademyProgress(loadAcademyProgress())
    certificateSyncEnabledRef.current = false
    certificateSyncRequests.current.forEach((controller) => controller.abort())
    certificateSyncRequests.current.clear()
    setCertificateSyncEnabled(false)
    setCertificateStatus(null)
  }

  const handleJumpToLesson = (topicKey) => {
    const idx = TOPICS.indexOf(topicKey)
    if (idx >= 0) {
      setActiveLesson(idx)
      setActiveSection('overview')
      setAcademyTab('lessons')
      setTimeout(() => {
        const lessonEl = document.getElementById('lesson-card-heading')
        if (lessonEl) {
          lessonEl.scrollIntoView({ behavior: 'smooth' })
        }
      }, 50)
    }
  }

  const handleSimChallengeComplete = (challengeId, score) => {
    const updated = recordSimulationChallenge(challengeId, score)
    setAcademyProgress(updated)
  }

  const handleOpenCertificate = (certData) => {
    if (!user) {
      setCertificateSyncError(t('academy.cert.login_required') || 'Sign in to issue and verify an Academy certificate.')
      return
    }
    if (!certificateSyncEnabledRef.current ||
        certificateSyncUserIdRef.current !== String(user.id)) {
      setCertificateSyncError(t('academy.cert.consent_required') || 'Enable account-backed certificate progress first.')
      return
    }
    const storedCertificate = certificateStatus?.certificates?.find(
      (certificate) => certificate.level_num === certData.levelNum,
    )
    setActiveCertificate({
      ...certData,
      recipientName: storedCertificate?.recipient_name || user.display_name || '',
      certificate: storedCertificate || null,
    })
  }

  const handleIssueCertificate = async ({ levelNum, recipientName, language }) => {
    if (!user || !certificateSyncEnabledRef.current ||
        certificateSyncUserIdRef.current !== String(user.id)) {
      throw new Error(t('academy.cert.consent_required') || 'Enable account-backed certificate progress first.')
    }
    const controller = new AbortController()
    certificateSyncRequests.current.add(controller)
    try {
      const certificate = await issueAcademyCertificate({
        levelNum,
        recipientName,
        language,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return certificate
      const status = await getAcademyCertificateStatus({ signal: controller.signal })
      if (!controller.signal.aborted) {
        setCertificateStatus(status)
        setCertificateSyncError('')
      }
      return certificate
    } finally {
      certificateSyncRequests.current.delete(controller)
    }
  }

  const handleEnableCertificateSync = () => {
    if (user?.id === null || user?.id === undefined) return
    const updated = saveCertificateSyncConsent(true, user.id)
    setAcademyProgress(updated)
    certificateSyncEnabledRef.current = true
    setCertificateSyncEnabled(true)
    setCertificateSyncError('')
    getAcademyCertificateStatus()
      .then((status) => {
        if (status) setCertificateStatus(status)
      })
      .catch(() => {
        if (certificateSyncEnabledRef.current &&
            certificateSyncUserIdRef.current === String(user?.id)) {
          setCertificateSyncError(t('academy.cert.sync_failed') || 'Account progress could not be synchronized. Try again later.')
        }
      })
  }

  const handleStartServerAssessment = async () => {
    if (!user || !certificateSyncEnabledRef.current) {
      setCertificateSyncError(t('academy.cert.consent_required') || 'Enable account-backed certificate progress first.')
      return
    }
    setServerAttemptBusy(true)
    setServerAttemptAnswers({})
    try {
      const attempt = await startAcademyLevelAttempt({ levelNum: activeLevel })
      setServerAttempt(attempt)
      setCertificateSyncError('')
    } catch (error) {
      setServerAttempt(null)
      setCertificateSyncError(error.code || t('academy.cert.sync_failed') || 'Assessment could not be started.')
    } finally {
      setServerAttemptBusy(false)
    }
  }

  const handleSubmitServerAssessment = async () => {
    if (!serverAttempt || serverAttemptBusy) return
    setServerAttemptBusy(true)
    try {
      const result = await submitAcademyLevelAttempt({
        attemptId: serverAttempt.attempt_id,
        answers: serverAttemptAnswers,
      })
      setServerAttempt(null)
      setServerAttemptAnswers({})
      const status = await getAcademyCertificateStatus()
      setCertificateStatus(status)
      setCertificateSyncError(result.passed
        ? ''
        : (t('academy.cert.assessment_failed') || 'Assessment not passed. Start a new attempt to try again.'))
    } catch (error) {
      if (['ATTEMPT_EXPIRED', 'ATTEMPT_ALREADY_SUBMITTED', 'LEVEL_ALREADY_VERIFIED']
        .includes(error.code)) {
        setServerAttempt(null)
        setServerAttemptAnswers({})
      }
      setCertificateSyncError(error.code || t('academy.cert.sync_failed') || 'Assessment could not be submitted.')
    } finally {
      setServerAttemptBusy(false)
    }
  }

  const handleToggleAdaptiveOptOut = () => {
    const current = loadAcademyProgress()
    const nextVal = !(current.adaptiveOptOut || false)
    current.adaptiveOptOut = nextVal
    saveAcademyProgress(current)
    setAcademyProgress(current)
  }

  const currentTopic = TOPICS[activeLesson]
  const currentQC = QUICK_CHECKS[currentTopic]
  const currentQCChoice = quickCheckAnswers[currentTopic]
  const isMilestoneLevel = [1, 3, 6].includes(activeLevel)
  const activeCertificateRecord = certificateStatus?.certificates?.find(
    (certificate) => certificate.level_num === activeLevel,
  )
  const canIssueActiveCertificate = Boolean(
    user && (
      certificateStatus?.eligible_levels?.includes(activeLevel)
      || activeCertificateRecord
    ),
  )

  // Certificate eligibility for active level
  return (
    <section className="module-container abbay-academy-container" style={{ paddingBottom: '40px' }}>
      {/* Platform Header with Brand Consistency */}
      <div className="module-header-box" style={{ marginBottom: '20px', background: '#0B172A', border: '1px solid #1E293B' }}>
        <div className="module-header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="module-tag-learn" style={{ background: 'rgba(0, 194, 215, 0.15)', color: '#00C2D7', border: '1px solid rgba(0, 194, 215, 0.3)' }}>
              ABBAY CYBERGUARD
            </span>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>
              Learn. Protect. Empower.
            </span>
          </div>
          {certificateSyncError && (
            <p className="msg error" role="status">{certificateSyncError}</p>
          )}
          {user && !certificateSyncEnabled && (
            <div className="academy-certificate-consent" role="group" aria-labelledby="academy-certificate-consent-title">
              <div>
                <strong id="academy-certificate-consent-title">
                  {t('academy.cert.consent_title') || 'Optional account-backed certificates'}
                </strong>
                <p>{t('academy.cert.consent_description') || 'If enabled, server-generated assessment attempts and results are saved to your account to verify certificate eligibility. Lesson visits are not verified. Your certificate name is sent only when you issue one; public verification never shows your name.'}</p>
              </div>
              <button type="button" className="btn primary" onClick={handleEnableCertificateSync}>
                {t('academy.cert.consent_enable') || 'Enable certificate progress sync'}
              </button>
            </div>
          )}
          {user && certificateSyncEnabled && (
            <div className="academy-certificate-sync-enabled" role="status">
              <span>{t('academy.cert.consent_enabled') || 'Account-backed certificate progress is enabled on this device.'}</span>
              <button type="button" className="btn ghost small" onClick={revokeCertificateSync}>
                {t('academy.cert.consent_revoke') || 'Stop account sync'}
              </button>
            </div>
          )}
          <h1 style={{ color: '#F8FAFC', margin: '4px 0 8px 0', fontSize: '1.85rem' }}>
            🎓 {t('learn.title')}
          </h1>
          <p className="lead" style={{ color: '#CBD5E1', margin: '0 0 10px 0' }}>
            {t('learn.intro')}
          </p>
          <div className="security-note" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: '#10B981', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span>🔒</span> {t('academy.guest_persistent_badge') || '100% Offline Guest-Mode Persistent'}
            </span>
            <span className="small" style={{ color: '#475569' }}>{t('learn.session_notice')}</span>
          </div>

          <div className="module-assistant-shortcut" style={{ marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-sm btn-assistant-help"
              onClick={() => onNavigate ? onNavigate('#/assistant?context=learn') : (window.location.hash = '#/assistant?context=learn')}
              title={t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
              style={{ background: '#14243A', color: '#00C2D7', border: '1px solid #00C2D7' }}
            >
              🤖 {t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
            </button>
          </div>
        </div>
        <div className="module-header-artwork">
          <img
            src="/images/journey/m5_academy_matrix.svg"
            alt={t('learn.artwork_alt')}
            className="module-artwork-badge"
            loading="lazy"
          />
        </div>
      </div>

      {/* Top Multi-Tab Academy Navigation */}
      <div
        role="tablist"
        aria-label="Abbay Cyber Academy Navigation"
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '24px',
          padding: '8px',
          background: '#0B172A',
          borderRadius: '8px',
          border: '1px solid #1E293B',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={academyTab === 'curriculum'}
          className={`btn ${academyTab === 'curriculum' ? '' : 'ghost'}`}
          style={{
            background: academyTab === 'curriculum' ? '#00C2D7' : 'transparent',
            color: academyTab === 'curriculum' ? '#070D18' : '#CBD5E1',
            borderColor: academyTab === 'curriculum' ? '#00C2D7' : '#334155',
            fontWeight: 700,
          }}
          onClick={() => setAcademyTab('curriculum')}
        >
          🗺️ {t('learn.tab_curriculum') || 'Curriculum & Stages'}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={academyTab === 'lessons'}
          className={`btn ${academyTab === 'lessons' ? '' : 'ghost'}`}
          style={{
            background: academyTab === 'lessons' ? '#00C2D7' : 'transparent',
            color: academyTab === 'lessons' ? '#070D18' : '#CBD5E1',
            borderColor: academyTab === 'lessons' ? '#00C2D7' : '#334155',
            fontWeight: 700,
          }}
          onClick={() => setAcademyTab('lessons')}
        >
          📚 {t('learn.tab_lessons') || 'Structured Lessons'}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={academyTab === 'simlab'}
          className={`btn ${academyTab === 'simlab' ? '' : 'ghost'}`}
          style={{
            background: academyTab === 'simlab' ? '#00C2D7' : 'transparent',
            color: academyTab === 'simlab' ? '#070D18' : '#CBD5E1',
            borderColor: academyTab === 'simlab' ? '#00C2D7' : '#334155',
            fontWeight: 700,
          }}
          onClick={() => setAcademyTab('simlab')}
        >
          🧪 {t('learn.tab_simlab') || 'Simulation Lab (4)'}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={academyTab === 'quiz'}
          className={`btn ${academyTab === 'quiz' ? '' : 'ghost'}`}
          style={{
            background: academyTab === 'quiz' ? '#00C2D7' : 'transparent',
            color: academyTab === 'quiz' ? '#070D18' : '#CBD5E1',
            borderColor: academyTab === 'quiz' ? '#00C2D7' : '#334155',
            fontWeight: 700,
          }}
          onClick={() => setAcademyTab('quiz')}
        >
          📝 {t('learn.tab_quiz') || 'Adaptive Quiz (L1–6)'}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={academyTab === 'dashboard'}
          className={`btn ${academyTab === 'dashboard' ? '' : 'ghost'}`}
          style={{
            background: academyTab === 'dashboard' ? '#00C2D7' : 'transparent',
            color: academyTab === 'dashboard' ? '#070D18' : '#CBD5E1',
            borderColor: academyTab === 'dashboard' ? '#00C2D7' : '#334155',
            fontWeight: 700,
          }}
          onClick={() => setAcademyTab('dashboard')}
        >
          📊 {t('learn.tab_dashboard') || 'Personal Dashboard'}
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CURRICULUM & STAGES                                */}
      {/* ======================================================== */}
      {academyTab === 'curriculum' && (
        <div className="academy-curriculum-view" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '20px' }}>
            <h2 style={{ color: '#F8FAFC', marginTop: 0 }}>
              🗺️ {t('learn.curriculum')}
            </h2>
            <p style={{ color: '#CBD5E1', lineHeight: 1.6, margin: '6px 0 16px 0' }}>
              {t('learn.curriculum_desc')}
            </p>

            {/* Stages Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '14px' }}>
              {ACADEMY_STAGES.map((stg) => {
                const isSelected = selectedCurriculumStage === stg.id
                return (
                  <div
                    key={stg.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCurriculumStage(stg.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedCurriculumStage(stg.id) }}
                    style={{
                      background: isSelected ? '#1E293B' : '#0B172A',
                      border: isSelected ? '2px solid #00C2D7' : '1px solid #334155',
                      borderRadius: '8px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{stg.badge}</span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: stg.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                          color: stg.status === 'active' ? '#34D399' : '#94A3B8',
                          border: `1px solid ${stg.status === 'active' ? '#10B981' : '#475569'}`,
                        }}
                      >
                        {stg.status === 'active' ? 'ACTIVE & PLAYABLE' : 'CURRICULUM SPECIFIED'}
                      </span>
                    </div>
                    <strong style={{ display: 'block', color: '#F8FAFC', fontSize: '1rem', marginBottom: '4px' }}>
                      {t(stg.titleKey) || stg.titleDefault}
                    </strong>
                    <span style={{ fontSize: '0.8rem', color: '#00C2D7', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                      Levels {stg.levelRange}
                    </span>
                    <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                      {t(stg.descKey) || stg.descDefault}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detailed Stage Content */}
          {selectedCurriculumStage === 'stage_1' && (
            <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ color: '#F8FAFC', margin: 0 }}>
                    🛡️ Stage 1: Essential Awareness to Strategic Defense (Levels 1–6)
                  </h3>
                  <p style={{ color: '#CBD5E1', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
                    Active core learning track with 5 interactive structured lessons, 4 practical simulation challenges, and 32 validated questions.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: '#00C2D7', color: '#070D18', fontWeight: 700 }}
                    onClick={() => setAcademyTab('quiz')}
                  >
                    Start Quiz (Level {activeLevel})
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm ghost"
                    style={{ color: '#CBD5E1', borderColor: '#334155' }}
                    onClick={() => setAcademyTab('lessons')}
                  >
                    Study Lessons
                  </button>
                </div>
              </div>

              {/* Levels Grid for Stage 1 */}
              <div className="learn-levels-grid" role="region" aria-label="Stage 1 Levels">
                {LEVELS.map((lvl) => {
                  const isUnlocked = unlockedLevels.includes(lvl.num)
                  const isActive = activeLevel === lvl.num
                  const isMastered = completedLevels[lvl.num]?.passed

                  let badgeClass = 'locked'
                  let badgeText = t('learn.badge.locked')
                  if (isMastered) {
                    badgeClass = 'mastered'
                    badgeText = t('learn.badge.mastered')
                  } else if (isActive) {
                    badgeClass = 'in_progress'
                    badgeText = t('learn.badge.in_progress')
                  } else if (isUnlocked) {
                    badgeClass = 'unlocked'
                    badgeText = t('learn.badge.unlocked')
                  }

                  return (
                    <div
                      key={lvl.id}
                      role="button"
                      tabIndex={isUnlocked ? 0 : -1}
                      aria-pressed={isActive}
                      aria-disabled={!isUnlocked}
                      className={`learn-level-card ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}`}
                      onClick={() => {
                        handleSelectLevel(lvl.num)
                        setAcademyTab('quiz')
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && isUnlocked) {
                          e.preventDefault()
                          handleSelectLevel(lvl.num)
                          setAcademyTab('quiz')
                        }
                      }}
                    >
                      <div className="learn-level-header">
                        <span className="learn-level-num">
                          {lvl.num === 1 ? '🟢' : lvl.num === 2 ? '🔵' : lvl.num === 3 ? '🟣' : lvl.num === 4 ? '🟠' : lvl.num === 5 ? '🔴' : '⭐'}{' '}
                          {t('learn.level')} {lvl.num}
                        </span>
                        <span className={`learn-badge ${badgeClass}`}>{badgeText}</span>
                      </div>
                      <strong style={{ fontSize: '0.94rem', color: '#0f172a', marginBottom: '4px', display: 'block', fontWeight: 700 }}>
                        {t(`learn.${lvl.id}.title`)}
                      </strong>
                      <p className="small" style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#334155', lineHeight: 1.45 }}>
                        {t(`learn.${lvl.id}.desc`)}
                      </p>

                      {isMastered && [1, 3, 6].includes(lvl.num) && (
                        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
                            Score: {completedLevels[lvl.num].score}%
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm ghost"
                            disabled={!user || !(
                              certificateStatus?.eligible_levels?.includes(lvl.num)
                              || certificateStatus?.certificates?.some((certificate) => certificate.level_num === lvl.num)
                            )}
                            style={{ padding: '2px 8px', fontSize: '0.72rem', color: '#0284c7', borderColor: '#0284c7', fontWeight: 600 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenCertificate({
                                stageId: 'stage_1',
                                levelNum: lvl.num,
                                title: `Stage 1 — Level ${lvl.num} Milestone Certificate`,
                                recipientName: user?.username || 'Guest Defender',
                                score: completedLevels[lvl.num]?.score,
                                stars: completedLevels[lvl.num]?.stars,
                              })
                            }}
                          >
                            🎓 Certificate
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Planned Curricula for Stages 2, 3, 4 */}
          {selectedCurriculumStage !== 'stage_1' && (
            <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid #F59E0B', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  ADVANCED ROADMAP SPECIFICATION
                </span>
                <h3 style={{ color: '#F8FAFC', margin: '8px 0 4px 0' }}>
                  {selectedCurriculumStage === 'stage_2' && '⚔️ Stage 2: Professional Cyber Defense (Levels 7–10)'}
                  {selectedCurriculumStage === 'stage_3' && '🏛️ Stage 3: Advanced Security Engineering (Levels 11–15)'}
                  {selectedCurriculumStage === 'stage_4' && '⭐ Stage 4: Continuing Mastery & Specialization (Level 16+)'}
                </h3>
                <p style={{ color: '#CBD5E1', fontSize: '0.9rem', margin: 0 }}>
                  Full curriculum architecture defined below. Complete Stage 1 (Levels 1–6) to unlock foundational operational readiness.
                </p>
              </div>

              {/* Levels in this Stage */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {ACADEMY_LEVELS.filter((lvl) => {
                  if (selectedCurriculumStage === 'stage_2') return lvl.stage === 2
                  if (selectedCurriculumStage === 'stage_3') return lvl.stage === 3
                  if (selectedCurriculumStage === 'stage_4') return lvl.stage === 4
                  return false
                }).map((lvl) => {
                  const spec = getLevelCurriculum(lvl.num)
                  const isExpanded = expandedCurriculumLevel === lvl.num
                  return (
                    <div
                      key={lvl.num}
                      style={{
                        background: '#0B172A',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '16px',
                      }}
                    >
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setExpandedCurriculumLevel(isExpanded ? null : lvl.num)}
                      >
                        <div>
                          <span style={{ color: '#00C2D7', fontWeight: 700, fontSize: '0.9rem', marginRight: '8px' }}>
                            Level {lvl.num}
                          </span>
                          <strong style={{ color: '#F8FAFC', fontSize: '1.02rem' }}>
                            {lvl.title}
                          </strong>
                          <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                            {lvl.desc}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm ghost"
                          style={{ color: '#94A3B8', borderColor: '#334155' }}
                        >
                          {isExpanded ? '▲ Hide Specs' : '▼ View Specs'}
                        </button>
                      </div>

                      {isExpanded && spec && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #1E293B', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <span style={{ fontSize: '0.78rem', color: '#00C2D7', fontWeight: 700, textTransform: 'uppercase' }}>Learning Objectives:</span>
                            <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', color: '#CBD5E1', fontSize: '0.85rem' }}>
                              {(spec.objectives || []).map((obj, i) => (
                                <li key={i} style={{ marginBottom: '4px' }}>{obj}</li>
                              ))}
                            </ul>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                            <div style={{ background: '#14233B', padding: '10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                              <span style={{ fontSize: '0.75rem', color: '#F59E0B', fontWeight: 700, display: 'block' }}>Prerequisites:</span>
                              <span style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>{spec.prerequisites}</span>
                            </div>
                            <div style={{ background: '#14233B', padding: '10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                              <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700, display: 'block' }}>Practical Lab Challenge:</span>
                              <span style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>{spec.requiredPracticalChallenge}</span>
                            </div>
                            <div style={{ background: '#14233B', padding: '10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                              <span style={{ fontSize: '0.75rem', color: '#00C2D7', fontWeight: 700, display: 'block' }}>Assessment Criteria:</span>
                              <span style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>{spec.assessmentCriteria}</span>
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, textTransform: 'uppercase' }}>Completion Outcomes:</span>
                            <p style={{ margin: '4px 0 0 0', color: '#CBD5E1', fontSize: '0.85rem' }}>{spec.completionOutcome}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: STRUCTURED LESSONS                                 */}
      {/* ======================================================== */}
      {academyTab === 'lessons' && (
        <div>
          <h2 style={{ color: '#F8FAFC' }}>📚 {t('learn.lessons')}</h2>
          <div className="row wrap" role="tablist" aria-label={t('learn.lessons')} style={{ gap: '8px', marginBottom: '14px' }}>
            {TOPICS.map((topicKey, idx) => {
              const isDone = academyProgress.completedLessons?.[topicKey]?.completed
              return (
                <button
                  key={topicKey}
                  type="button"
                  role="tab"
                  aria-selected={activeLesson === idx}
                  className={'btn' + (activeLesson === idx ? '' : ' ghost')}
                  style={{
                    background: activeLesson === idx ? '#00C2D7' : '#14233B',
                    color: activeLesson === idx ? '#070D18' : '#CBD5E1',
                    borderColor: activeLesson === idx ? '#00C2D7' : '#334155',
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setActiveLesson(idx)
                    setActiveSection('overview')
                  }}
                >
                  {isDone ? '✅ ' : `${idx + 1}. `} {t('learn.t.' + topicKey)}
                </button>
              )
            })}
          </div>

          {/* Structured Lesson Content Card */}
          <article className="card m4-card" role="tabpanel" aria-labelledby={'lesson-' + activeLesson} style={{ background: '#14233B', border: '1px solid #1E293B', padding: '20px' }}>
            <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="small" style={{ color: '#94A3B8' }}>
                {t('learn.lesson')} {activeLesson + 1} {t('learn.q_of')} {TOPICS.length}
              </span>
              <span className="tag" style={{ background: '#0B172A', color: '#00C2D7', borderColor: '#334155' }}>
                {activeLesson === 0 ? 'M1 Threat Connection' : activeLesson === 1 ? 'M2 Hardening Connection' : activeLesson === 3 ? 'M3 Incident Response' : activeLesson === 4 ? 'M4 Web Security' : 'Core Awareness'}
              </span>
            </div>

            <h3 id="lesson-card-heading" style={{ marginTop: 0, color: '#F8FAFC', fontSize: '1.4rem' }}>
              {t('learn.t.' + currentTopic)}
            </h3>

            {/* Structured Sub-Section Tabs */}
            <div className="lesson-section-nav" role="tablist" aria-label="Lesson Sections" style={{ background: '#0B172A', border: '1px solid #1E293B', padding: '6px' }}>
              {LESSON_SECTIONS.map((secKey) => {
                const sectionCompleted = academyProgress.completedLessons?.[currentTopic]?.sections?.[secKey]
                return (
                  <button
                    key={secKey}
                    type="button"
                    role="tab"
                    aria-selected={activeSection === secKey}
                    className={`lesson-section-btn ${activeSection === secKey ? 'active' : ''}`}
                    style={{
                      background: activeSection === secKey ? '#00C2D7' : 'transparent',
                      color: activeSection === secKey ? '#070D18' : '#CBD5E1',
                    }}
                    onClick={() => setActiveSection(secKey)}
                  >
                    {sectionCompleted && <span style={{ color: '#10B981', marginRight: '2px' }}>✓</span>}
                    {secKey === 'overview' && '📌 '}
                    {secKey === 'how' && '⚙️ '}
                    {secKey === 'examples' && '🇪🇹 '}
                    {secKey === 'warnings' && '⚠️ '}
                    {secKey === 'actions' && '🛡️ '}
                    {secKey === 'recap' && '✅ '}
                    {t('learn.sec.' + secKey)}
                  </button>
                )
              })}
            </div>

            {/* Dynamic Sub-Section Content */}
            <div style={{ marginTop: '16px', minHeight: '140px' }}>
              {activeSection === 'overview' && (
                <div>
                  <div className="lesson-callout" style={{ borderLeftColor: '#00C2D7', background: '#0B172A', padding: '14px', borderRadius: '4px' }}>
                    {renderStructuredLessonText(t('learn.obj.' + currentTopic))}
                  </div>
                  <div className="lesson-visual-card" style={{ margin: '16px 0', textAlign: 'center' }}>
                    <img
                      src={ACADEMY_TOPIC_ARTWORK_MAP[currentTopic] || '/images/journey/m5_academy_matrix.svg'}
                      alt={t('learn.t.' + currentTopic)}
                      style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', border: '1px solid #334155' }}
                      loading="lazy"
                    />
                  </div>
                  <div style={{ marginTop: '14px' }}>
                    {renderStructuredLessonText(t('learn.b.' + currentTopic))}
                  </div>
                </div>
              )}

              {activeSection === 'how' && (
                <div className="lesson-callout" style={{ borderLeftColor: '#6366f1', background: '#0B172A', padding: '14px', borderRadius: '4px' }}>
                  {renderStructuredLessonText(t('learn.how.' + currentTopic))}
                </div>
              )}

              {activeSection === 'examples' && (
                <div className="lesson-callout" style={{ borderLeftColor: '#0284c7', background: '#0B172A', padding: '14px', borderRadius: '4px' }}>
                  {renderStructuredLessonText(t('learn.ex.' + currentTopic))}
                </div>
              )}

              {activeSection === 'warnings' && (
                <div className="lesson-callout warning" style={{ borderLeftColor: '#F59E0B', background: '#0B172A', padding: '14px', borderRadius: '4px' }}>
                  {renderStructuredLessonText(t('learn.warn.' + currentTopic))}
                </div>
              )}

              {activeSection === 'actions' && (
                <div className="lesson-callout action" style={{ borderLeftColor: '#10B981', background: '#0B172A', padding: '14px', borderRadius: '4px' }}>
                  {renderStructuredLessonText(t('learn.act.' + currentTopic))}
                </div>
              )}

              {activeSection === 'recap' && (
                <div>
                  <div className="lesson-callout" style={{ borderLeftColor: '#10b981', background: '#0B172A', padding: '14px', borderRadius: '4px' }}>
                    {renderStructuredLessonText(t('learn.recap.' + currentTopic))}
                  </div>

                  {/* Instant Knowledge Check */}
                  <div className="quick-check-card" style={{ marginTop: '18px', background: '#0B172A', border: '1px solid #1E293B', padding: '16px', borderRadius: '8px' }}>
                    <h4 style={{ color: '#F8FAFC', margin: '0 0 8px 0' }}>🎯 {t('learn.sec.quick_check')}</h4>
                    <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: '4px 0 12px 0', color: '#F8FAFC' }}>
                      {t(`learn.qc.${currentTopic}.q`)}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[0, 1].map((optIdx) => {
                        const isPicked = currentQCChoice === optIdx
                        const answered = currentQCChoice !== undefined
                        let btnCls = 'quick-check-opt'
                        if (answered && isPicked) {
                          btnCls += optIdx === currentQC.answer ? ' selected-correct' : ' selected-wrong'
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            className={btnCls}
                            disabled={answered}
                            onClick={() => setQuickCheckAnswers((prev) => ({ ...prev, [currentTopic]: optIdx }))}
                            style={{
                              textAlign: 'left',
                              padding: '10px 14px',
                              borderRadius: '6px',
                              border: '1px solid #334155',
                              background: '#14233B',
                              color: '#F8FAFC',
                              cursor: answered ? 'default' : 'pointer',
                            }}
                          >
                            {optIdx === 0 ? 'A.' : 'B.'} {t(`learn.qc.${currentTopic}.o${optIdx}`)}
                          </button>
                        )
                      })}
                    </div>

                    {currentQCChoice !== undefined && (
                      <div
                        className={'msg ' + (currentQCChoice === currentQC.answer ? 'info' : 'error')}
                        style={{ marginTop: '12px' }}
                        aria-live="polite"
                      >
                        <p style={{ margin: 0, lineHeight: 1.5 }}>
                          <strong>
                            {currentQCChoice === currentQC.answer
                              ? '✔ ' + t('learn.correct')
                              : '✖ ' + t('learn.incorrect')}
                          </strong>{' '}
                          {t(`learn.qc.${currentTopic}.x`)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sequential Lesson Navigation */}
            <div className="row wrap" style={{ justifyContent: 'space-between', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #1E293B' }}>
              <button
                type="button"
                className="btn ghost"
                style={{ color: '#CBD5E1', borderColor: '#334155' }}
                disabled={activeLesson === 0}
                onClick={() => {
                  setActiveLesson((prev) => Math.max(0, prev - 1))
                  setActiveSection('overview')
                }}
              >
                ← {t('learn.prev_lesson')}
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ color: '#CBD5E1', borderColor: '#334155' }}
                disabled={activeLesson === TOPICS.length - 1}
                onClick={() => {
                  setActiveLesson((prev) => Math.min(TOPICS.length - 1, prev + 1))
                  setActiveSection('overview')
                }}
              >
                {t('learn.next_lesson')} →
              </button>
            </div>
          </article>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: SIMULATION LAB                                     */}
      {/* ======================================================== */}
      {academyTab === 'simlab' && (
        <AcademySimLab
          t={t}
          onChallengeComplete={handleSimChallengeComplete}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 4: ADAPTIVE KNOWLEDGE QUIZ                            */}
      {/* ======================================================== */}
      {academyTab === 'quiz' && (
        <div>
          <h2 style={{ color: '#F8FAFC' }}>📝 {t('learn.quiz')}</h2>

          {!showResults ? (
            <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '20px' }}>
              {/* Level Header in Quiz */}
              <div className="row wrap" style={{ justifyContent: 'space-between', borderBottom: '1px solid #1E293B', paddingBottom: '12px', marginBottom: '14px' }}>
                <div>
                  <span className="learn-badge unlocked" style={{ marginRight: '8px' }}>
                    {t('learn.level')} {activeLevel}
                  </span>
                  <strong style={{ color: '#F8FAFC' }}>{t(`learn.lvl${activeLevel}.title`)}</strong>
                </div>

                {/* Level Quick Switcher */}
                <div className="row" style={{ margin: 0, gap: '6px' }}>
                  {LEVELS.map((lvl) => {
                    const isUnlocked = unlockedLevels.includes(lvl.num)
                    const isActive = activeLevel === lvl.num
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        disabled={!isUnlocked}
                        className={`btn ghost ${isActive ? 'active-pill' : ''}`}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.82rem',
                          background: isActive ? '#00C2D7' : '#0B172A',
                          color: isActive ? '#070D18' : isUnlocked ? '#CBD5E1' : '#64748B',
                          borderColor: isActive ? '#00C2D7' : '#334155',
                          fontWeight: 700,
                        }}
                        onClick={() => handleSelectLevel(lvl.num)}
                        title={!isUnlocked ? t('learn.level_locked') : ''}
                      >
                        L{lvl.num}
                        {!isUnlocked ? ' 🔒' : ''}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Progress and Question Counter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span className="small" style={{ color: '#94A3B8' }}>
                  {t('learn.qn')} {safeCurrentQ + 1} {t('learn.q_of')} {currentQuestions.length}
                </span>
                <span className="small" style={{ color: '#00C2D7', fontWeight: 600 }}>
                  Pass threshold: 80% (5 of 6 correct)
                </span>
              </div>

              {/* Active Question Display */}
              {q && (
                <div className="q" style={{ margin: '14px 0' }}>
                  <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#F8FAFC', lineHeight: 1.5, marginBottom: '16px' }}>
                    {t(`learn.q.${q.id}.q`)}
                  </p>

                  <div className="options-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[0, 1, 2].map((optIdx) => {
                      const isPicked = currentChosen === optIdx
                      const answered = currentChosen !== undefined
                      let optClass = 'opt'
                      if (answered && isPicked) {
                        optClass += optIdx === q.answer ? ' correct' : ' wrong'
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          className={optClass}
                          disabled={answered}
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          style={{
                            textAlign: 'left',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid #334155',
                            background: answered && isPicked ? (optIdx === q.answer ? '#064e3b' : '#7f1d1d') : '#0B172A',
                            color: '#F8FAFC',
                            cursor: answered ? 'default' : 'pointer',
                          }}
                        >
                          <span style={{ fontWeight: 700, marginRight: '8px', color: '#00C2D7' }}>
                            {OPTION_LETTERS[optIdx]}.
                          </span>
                          {t(`learn.q.${q.id}.o${optIdx}`)}
                        </button>
                      )
                    })}
                  </div>

                  {/* Immediate Feedback Explanation */}
                  {currentChosen !== undefined && (
                    <div
                      className={'msg ' + (currentChosen === q.answer ? 'info' : 'error')}
                      style={{ marginTop: '16px' }}
                      aria-live="polite"
                    >
                      <p style={{ margin: 0, lineHeight: 1.5 }}>
                        <strong>
                          {currentChosen === q.answer
                            ? '✔ ' + t('learn.correct')
                            : '✖ ' + t('learn.incorrect')}
                        </strong>{' '}
                        {t(`learn.q.${q.id}.x`)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Question Navigation Controls */}
              <div className="row wrap" style={{ justifyContent: 'space-between', marginTop: '18px', paddingTop: '12px', borderTop: '1px solid #1E293B' }}>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ color: '#CBD5E1', borderColor: '#334155' }}
                  disabled={safeCurrentQ === 0}
                  onClick={() => setCurrentQ((prev) => Math.max(0, prev - 1))}
                >
                  ← {t('learn.prev_q')}
                </button>

                {safeCurrentQ < currentQuestions.length - 1 ? (
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#00C2D7', color: '#070D18', fontWeight: 700 }}
                    onClick={() => setCurrentQ((prev) => prev + 1)}
                  >
                    {t('learn.next_q')} →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#10B981', color: '#FFFFFF', fontWeight: 700 }}
                    disabled={!allAnswered}
                    onClick={() => setShowResults(true)}
                  >
                    {t('learn.view_results')} 📊
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Results View */
            <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '20px' }}>
              <h3 style={{ color: '#F8FAFC', marginTop: 0 }}>
                {t('learn.results_title')} — {t(`learn.lvl${activeLevel}.title`)}
              </h3>

              {/* Score and Pass/Fail Summary */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '8px',
                  background: levelEval.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${levelEval.passed ? '#10B981' : '#EF4444'}`,
                  margin: '16px 0',
                }}
              >
                <span style={{ fontSize: '2.5rem' }}>
                  {levelEval.passed ? '🎉' : '⚠️'}
                </span>
                <div>
                  <strong style={{ fontSize: '1.25rem', color: '#F8FAFC', display: 'block' }}>
                    Score: {levelEval.score}% ({levelEval.correct}/{levelEval.total} correct)
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: levelEval.passed ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                    {levelEval.passed ? 'Passed Level Requirements!' : 'Did not meet 80% passing threshold'}
                  </span>
                </div>
              </div>

              {/* Stage Certificate Eligibility Banner */}
              {levelEval.passed && isMilestoneLevel && (
                <div style={{ background: '#0B172A', border: '1px solid #00C2D7', borderRadius: '8px', padding: '14px', margin: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <strong style={{ color: '#00C2D7', display: 'block', fontSize: '0.95rem' }}>
                      🎓 {canIssueActiveCertificate
                        ? (t('academy.cert.ready') || 'Milestone certificate ready')
                        : (t('academy.cert.requirements_pending') || 'Certificate requirements pending')}
                    </strong>
                    <span style={{ color: '#CBD5E1', fontSize: '0.82rem' }}>
                      {canIssueActiveCertificate
                        ? (t('academy.cert.ready_description') || `Level ${activeLevel} assessment milestone is verified. Issue your certificate.`)
                        : (t('academy.cert.requirements_description') || 'Pass this level and all prerequisite server assessments. Lesson reading is not verified.')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: '#00C2D7', color: '#070D18', fontWeight: 700 }}
                    disabled={!canIssueActiveCertificate}
                    onClick={() => handleOpenCertificate({
                      stageId: 'stage_1',
                      levelNum: activeLevel,
                      title: `Stage 1 — Level ${activeLevel} Milestone Certificate`,
                      recipientName: user?.username || 'Guest Defender',
                      score: levelEval.score,
                      stars: levelEval.stars,
                    })}
                  >
                    View & Print Certificate 🎓
                  </button>
                  {user && certificateSyncEnabled && !certificateStatus?.verified_levels?.includes(activeLevel) && (
                    <div className="academy-server-assessment" style={{ flexBasis: '100%', marginTop: '12px' }}>
                      {!serverAttempt ? (
                        <button
                          type="button"
                          className="btn"
                          disabled={serverAttemptBusy}
                          onClick={handleStartServerAssessment}
                        >
                          {serverAttemptBusy
                            ? (t('academy.cert.assessment_starting') || 'Starting assessment…')
                            : `${t('academy.cert.assessment_start') || 'Start server-verified assessment'} — Level ${activeLevel}`}
                        </button>
                      ) : (
                        <div>
                          {serverAttempt.questions.map((question, index) => (
                            <fieldset key={question.id} style={{ border: '1px solid #334155', margin: '10px 0', padding: '10px' }}>
                              <legend style={{ color: '#F8FAFC' }}>{index + 1}. {question.prompt}</legend>
                              {question.options.map((option) => (
                                <label key={option.id} style={{ display: 'block', margin: '6px 0', color: '#CBD5E1' }}>
                                  <input
                                    type="radio"
                                    name={`assessment-${question.id}`}
                                    checked={serverAttemptAnswers[question.id] === option.id}
                                    onChange={() => setServerAttemptAnswers((previous) => ({
                                      ...previous,
                                      [question.id]: option.id,
                                    }))}
                                  />{' '}
                                  {option.text}
                                </label>
                              ))}
                            </fieldset>
                          ))}
                          <button
                            type="button"
                            className="btn"
                            disabled={serverAttemptBusy ||
                              Object.keys(serverAttemptAnswers).length !== serverAttempt.questions.length}
                            onClick={handleSubmitServerAssessment}
                          >
                            {serverAttemptBusy
                              ? (t('academy.cert.assessment_submitting') || 'Submitting assessment…')
                              : (t('academy.cert.assessment_submit') || 'Submit assessment')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Navigation Buttons */}
              <div className="row wrap" style={{ margin: '16px 0', gap: '8px' }}>
                {levelEval.passed && activeLevel < LEVELS.length && (
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#00C2D7', color: '#070D18', fontWeight: 700 }}
                    onClick={handleAdvanceNextLevel}
                  >
                    {t('learn.unlock_next')} {activeLevel + 1} →
                  </button>
                )}

                {!levelEval.passed && (
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#F59E0B', color: '#070D18', fontWeight: 700 }}
                    onClick={handleRetryCurrentLevel}
                  >
                    🔄 {t('learn.retry_level')}
                  </button>
                )}

                <button
                  type="button"
                  className="btn ghost"
                  style={{ color: '#CBD5E1', borderColor: '#334155' }}
                  onClick={() => setShowReview(!showReview)}
                >
                  {showReview ? '▲ ' + t('learn.review') : '▼ ' + t('learn.review')}
                </button>

                <button
                  type="button"
                  className="btn ghost"
                  style={{ color: '#CBD5E1', borderColor: '#334155' }}
                  onClick={() => {
                    setShowResults(false)
                    setCurrentQ(0)
                  }}
                >
                  ← {t('learn.qn')} 1
                </button>

                <button
                  type="button"
                  className="btn ghost"
                  style={{ color: '#EF4444', borderColor: '#EF4444' }}
                  onClick={() => setShowConfirmReset(!showConfirmReset)}
                >
                  ⚠️ {t('learn.restart')}
                </button>
              </div>

              {/* Confirmation Prompt for Restart */}
              {showConfirmReset && (
                <div className="confirm-box" role="alert" style={{ background: '#1c1917', border: '1px solid #dc2626', padding: '14px', borderRadius: '8px', margin: '14px 0' }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: 600, color: '#f87171' }}>
                    {t('learn.restart_confirm')}
                  </p>
                  <div className="row" style={{ margin: 0, gap: '8px' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: '#dc2626', borderColor: '#dc2626', color: '#FFFFFF' }}
                      onClick={handleResetAllProgress}
                    >
                      Yes, Reset Progress
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ color: '#CBD5E1' }}
                      onClick={() => setShowConfirmReset(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Detailed Question Review View */}
              {showReview && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #1E293B' }}>
                  <h4 style={{ color: '#F8FAFC' }}>{t('learn.review')} ({t(`learn.lvl${activeLevel}.title`)})</h4>
                  {currentQuestions.map((item, idx) => {
                    const userChoice = answers[item.id]
                    const correct = userChoice !== undefined && isCorrect(item, userChoice)
                    const answered = userChoice !== undefined

                    return (
                      <div key={item.id} className="result" style={{ margin: '12px 0', background: '#0B172A', padding: '14px', borderRadius: '8px', border: '1px solid #1E293B' }}>
                        <p style={{ fontWeight: 600, marginBottom: '6px', color: '#F8FAFC' }}>
                          {t('learn.qn')} {idx + 1}: {t(`learn.q.${item.id}.q`)}
                        </p>
                        <p className="small" style={{ margin: '4px 0' }}>
                          {t('learn.your_ans')}:{' '}
                          {answered ? (
                            <span style={{ color: correct ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                              {OPTION_LETTERS[userChoice]}. {t(`learn.q.${item.id}.o${userChoice}`)} ({correct ? '✔ ' + t('learn.correct') : '✖ ' + t('learn.incorrect')})
                            </span>
                          ) : (
                            <span style={{ color: '#F59E0B' }}>{t('learn.unanswered')}</span>
                          )}
                        </p>
                        {(!correct || !answered) && (
                          <p className="small" style={{ margin: '4px 0' }}>
                            {t('learn.correct_ans')}:{' '}
                            <strong style={{ color: '#10B981' }}>
                              {OPTION_LETTERS[item.answer]}. {t(`learn.q.${item.id}.o${item.answer}`)}
                            </strong>
                          </p>
                        )}
                        <p className="small" style={{ color: '#94A3B8', marginTop: '6px', lineHeight: 1.5 }}>
                          <strong>{t('learn.explanation')}:</strong> {t(`learn.q.${item.id}.x`)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: PERSONAL LEARNING DASHBOARD                        */}
      {/* ======================================================== */}
      {academyTab === 'dashboard' && (
        <AcademyDashboard
          academyProgress={academyProgress}
          certificateStatus={certificateStatus}
          mastery={mastery}
          recommendations={recommendations}
          revisionQueue={revisionQueue}
          onJumpToLesson={handleJumpToLesson}
          onOpenCertificate={handleOpenCertificate}
          onToggleAdaptiveOptOut={handleToggleAdaptiveOptOut}
          t={t}
        />
      )}

      {/* Modal: Verifiable Educational Certificate */}
      {activeCertificate && (
        <AcademyCertificateModal
          certData={activeCertificate}
          onClose={() => setActiveCertificate(null)}
          onIssue={handleIssueCertificate}
          language={lang}
          t={t}
        />
      )}
    </section>
  )
}
