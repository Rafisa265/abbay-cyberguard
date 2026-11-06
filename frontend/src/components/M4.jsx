import { useEffect, useState, useCallback, useMemo } from 'react'
import { M4_QUIZ_BANK, selectQuizSessionQuestions, calculateQuizDiagnostics } from '../data/m4QuizBank.js'

const api = async (path, body) => {
  try {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status}`)
      err.status = r.status
      err.endpoint = path
      try {
        const text = await r.text()
        const parsed = JSON.parse(text)
        err.code = parsed?.error?.code
      } catch {
        // non-JSON response
      }
      console.error(`[CyberShield M4 Error] ${path} returned HTTP ${r.status}`, err.code || '')
      throw err
    }
    return await r.json()
  } catch (err) {
    if (!err.endpoint) {
      err.endpoint = path
      err.status = 'NETWORK_ERROR'
      console.error(`[CyberShield M4 Network Error] ${path}:`, err.message || err)
    }
    throw err
  }
}

function decodeEntities(str) {
  if (typeof str !== 'string') return str
  let prev = str
  for (let i = 0; i < 5; i++) {
    const next = prev
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#x([0-9a-fA-F]+);?/gi, (_, hex) => {
        const code = parseInt(hex, 16)
        return code === 0xA0 ? ' ' : String.fromCharCode(code)
      })
      .replace(/&#(\d+);?/g, (_, dec) => {
        const code = parseInt(dec, 10)
        return code === 160 ? ' ' : String.fromCharCode(code)
      })
    if (next === prev) break
    prev = next
  }
  return prev
}

// Config snippets and educational remediation specs per check
const CHECK_META = {
  'CHK-01': {
    codeSnippet: 'ssl_certificate /etc/letsencrypt/live/example/fullchain.pem;\nssl_certificate_key /etc/letsencrypt/live/example/privkey.pem;\nssl_protocols TLSv1.2 TLSv1.3;',
    standard: 'Active TLS 1.3 with auto-renewal (Let\'s Encrypt / Certbot)',
  },
  'CHK-02': {
    codeSnippet: 'server {\n    listen 80;\n    server_name example.com www.example.com;\n    return 301 ' + 'https:' + '//$host$request_uri;\n}',
    standard: 'HTTP 301 Permanent Redirect to HTTPS on port 80',
  },
  'CHK-03': {
    codeSnippet: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
    standard: 'HSTS max-age >= 31536000 with includeSubDomains; preload',
  },
  'CHK-04': {
    codeSnippet: 'add_header Content-Security-Policy "default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; object-src \'none\'; base-uri \'self\';" always;',
    standard: 'Strict CSP restricting script execution and object-src',
  },
  'CHK-05': {
    codeSnippet: 'add_header Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=()" always;\nadd_header X-Content-Type-Options "nosniff" always;\nadd_header X-Frame-Options "DENY" always;',
    standard: 'Permissions-Policy disabling unused APIs & X-Content-Type-Options: nosniff',
  },
  'CHK-06': {
    codeSnippet: 'Set-Cookie: session_id=token_val; Path=/; Secure; HttpOnly; SameSite=Strict',
    standard: 'Secure; HttpOnly; SameSite=Strict on all auth session cookies',
  },
  'CHK-07': {
    codeSnippet: '# Nginx: in http {} or server {}\nserver_tokens off;\n\n# Apache: in httpd.conf\nServerTokens Prod\nServerSignature Off',
    standard: 'Server and X-Powered-By software version banners suppressed',
  },
}

const CHECKLIST_ITEMS = [
  { key: 'chk_tls', textKey: 'm4.chklist.c1' },
  { key: 'chk_redirect', textKey: 'm4.chklist.c2' },
  { key: 'chk_hsts', textKey: 'm4.chklist.c3' },
  { key: 'chk_csp', textKey: 'm4.chklist.c4' },
  { key: 'chk_cookies', textKey: 'm4.chklist.c5' },
  { key: 'chk_tokens', textKey: 'm4.chklist.c6' },
]

export default function M4({ t, onNavigate }) {
  const [list, setList] = useState(null)
  const [res, setRes] = useState(null)
  const [state, setState] = useState('loading')
  const [errorDetails, setErrorDetails] = useState(null)
  const [activeTab, setActiveTab] = useState('findings') // 'findings' | 'matrix' | 'checklist' | 'quiz'
  const [learningLevel, setLearningLevel] = useState('intermediate') // 'beginner' | 'intermediate' | 'advanced'
  const [checkedItems, setCheckedItems] = useState([])
  const [exportNotice, setExportNotice] = useState('')

  // Expanded Quiz state
  const [quizDifficulty, setQuizDifficulty] = useState('all') // 'all' | 'beginner' | 'intermediate' | 'advanced'
  const [quizSessionSeed, setQuizSessionSeed] = useState(1)
  const [quizCurrentIdx, setQuizCurrentIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState({}) // { [qid]: optIdx }
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [retryQuestions, setRetryQuestions] = useState(null)

  const [activeScenarioId, setActiveScenarioId] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('scenario=')) {
      const match = window.location.hash.match(/scenario=([A-Za-z0-9_-]+)/)
      if (match) return match[1]
    }
    return 'DS-A'
  })

  const dt = (k) => decodeEntities(t(k))

  const loadData = useCallback(async (targetScenarioId = null) => {
    setState('loading')
    setErrorDetails(null)
    try {
      const d = await api('/api/v1/m4/scenarios')
      const scenarios = d?.scenarios || []
      setList(scenarios)
      const selected = targetScenarioId || activeScenarioId || scenarios[0]?.id || 'DS-A'
      setActiveScenarioId(selected)
      const demoData = await api('/api/v1/m4/demo', { scenario_id: selected })
      setRes(demoData)
      setState('idle')
    } catch (err) {
      setErrorDetails({
        endpoint: err.endpoint || '/api/v1/m4/scenarios',
        status: err.status || 'NETWORK_ERROR',
        category: err.status === 502 ? 'Backend unreachable (check port 8000)' :
                  err.status === 403 ? 'Origin or access denied' :
                  err.status === 404 ? 'Endpoint not found' :
                  err.status === 'NETWORK_ERROR' ? 'Connection refused' :
                  `HTTP ${err.status || 'unknown'}`,
      })
      setState('error')
    }
  }, [activeScenarioId])

  useEffect(() => {
    loadData()
  }, [])

  const pick = async (id) => {
    setState('loading')
    setErrorDetails(null)
    setActiveScenarioId(id)
    try {
      const demoData = await api('/api/v1/m4/demo', { scenario_id: id })
      setRes(demoData)
      setState('idle')
    } catch (err) {
      setErrorDetails({
        endpoint: err.endpoint || '/api/v1/m4/demo',
        status: err.status || 'NETWORK_ERROR',
        category: err.status === 502 ? 'Backend unreachable (check port 8000)' :
                  err.status === 403 ? 'Origin or access denied' :
                  err.status === 404 ? 'Endpoint not found' :
                  err.status === 'NETWORK_ERROR' ? 'Connection refused' :
                  `HTTP ${err.status || 'unknown'}`,
      })
      setState('error')
    }
  }

  // Determine finding severity
  const getFindingSeverity = (check, status) => {
    if (check === 'CHK-01') {
      return status === 'missing' ? 'critical' : status === 'unknown' ? 'critical' : 'info'
    }
    if (check === 'CHK-02' || check === 'CHK-03' || check === 'CHK-04' || check === 'CHK-06') {
      return status === 'missing' ? 'high' : 'info'
    }
    if (check === 'CHK-05') {
      return status === 'missing' ? 'medium' : 'info'
    }
    if (check === 'CHK-07') {
      return status === 'present' ? 'medium' : 'info'
    }
    return 'info'
  }

  // Security Posture Evaluation
  const posture = useMemo(() => {
    if (!res) return null
    if (res.scenario_id === 'DS-C') {
      return {
        id: 'critical_failure',
        titleKey: 'm4.posture.critical_failure',
        summaryKey: 'm4.posture.summary_dsc',
        badgeClass: 'critical_failure',
      }
    }
    if (res.scenario_id === 'DS-B') {
      return {
        id: 'hardened',
        titleKey: 'm4.posture.hardened',
        summaryKey: 'm4.posture.summary_dsb',
        badgeClass: 'hardened',
      }
    }
    return {
      id: 'needs_hardening',
      titleKey: 'm4.posture.needs_hardening',
      summaryKey: 'm4.posture.summary_dsa',
      badgeClass: 'needs_hardening',
    }
  }, [res])

  // Findings severity counts
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    if (!res?.findings) return counts
    for (const f of res.findings) {
      const sev = getFindingSeverity(f.check, f.status)
      if (counts[sev] !== undefined) counts[sev]++
    }
    return counts
  }, [res])

  // Checklist handlers (in-memory state preserving SR-09 / static.test.js)
  const toggleChecklistItem = (key) => {
    setCheckedItems((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const resetChecklist = () => {
    setCheckedItems([])
  }

  const markAllChecklist = () => {
    const allKeys = CHECKLIST_ITEMS.map((item) => item.key)
    setCheckedItems(allKeys)
  }

  // Expanded Quiz Session & Handlers
  const sessionQuestions = useMemo(() => {
    if (retryQuestions && retryQuestions.length > 0) {
      return retryQuestions
    }
    return selectQuizSessionQuestions({
      difficulty: quizDifficulty,
      count: 6,
      seed: quizSessionSeed,
    })
  }, [quizDifficulty, quizSessionSeed, retryQuestions])

  const handleDifficultyChange = (newDiff) => {
    setQuizDifficulty(newDiff)
    setRetryQuestions(null)
    setQuizCurrentIdx(0)
    setQuizAnswers({})
    setQuizCompleted(false)
  }

  const handleNewQuizSession = () => {
    setQuizSessionSeed((prev) => prev + 1)
    setRetryQuestions(null)
    setQuizCurrentIdx(0)
    setQuizAnswers({})
    setQuizCompleted(false)
  }

  const handleSelectQuizOption = (qid, optIdx) => {
    if (quizAnswers[qid] !== undefined) return
    setQuizAnswers((prev) => ({ ...prev, [qid]: optIdx }))
  }

  const handleNextQuestion = () => {
    if (quizCurrentIdx < sessionQuestions.length - 1) {
      setQuizCurrentIdx((prev) => prev + 1)
    } else {
      setQuizCompleted(true)
    }
  }

  const diagnostics = useMemo(() => {
    if (!quizCompleted) return null
    return calculateQuizDiagnostics(sessionQuestions, quizAnswers)
  }, [quizCompleted, sessionQuestions, quizAnswers])

  const handleRetryMissed = () => {
    if (!diagnostics || diagnostics.missedIds.length === 0) return
    const missedSet = new Set(diagnostics.missedIds)
    const missed = sessionQuestions.filter((q) => missedSet.has(q.id))
    setRetryQuestions(missed)
    setQuizCurrentIdx(0)
    setQuizAnswers({})
    setQuizCompleted(false)
  }

  // Simulated Report Exports
  const handleExportJson = () => {
    if (!res) return
    const payload = {
      meta: {
        platform: 'ABBAY CYBERGUARD',
        module: 'M4 Interactive Website Security Learning Lab',
        mode: 'SIMULATED_OFFLINE_EDUCATIONAL',
        exportedAt: new Date().toISOString(),
        disclaimer: 'Generated offline for training purposes. No external network scanning was performed.',
      },
      scenario: {
        id: res.scenario_id,
        hostname: res.hostname,
        posture: posture?.id,
        severity_breakdown: severityCounts,
        learning_level: learningLevel,
        findings: res.findings.map((f) => ({
          check: f.check,
          name: dt('m4.chk.' + f.check),
          status: f.status,
          severity: getFindingSeverity(f.check, f.status),
          detail: f.detail || null,
          standard: CHECK_META[f.check]?.standard,
        })),
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abbay-m4-security-lab-${res.scenario_id.toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportNotice(dt('m4.export.disclaimer'))
    setTimeout(() => setExportNotice(''), 4000)
  }

  const handleExportTxt = () => {
    if (!res) return
    const lines = [
      '================================================================================',
      'ABBAY CYBERGUARD — M4 INTERACTIVE WEBSITE SECURITY LAB REPORT',
      'Learn. Protect. Empower. | Ethiopian Digital Safety Platform',
      '================================================================================',
      `Audit Date:     ${new Date().toISOString()}`,
      `Target Domain:  ${res.hostname} (Simulated Scenario: ${res.scenario_id})`,
      `Security Posture: ${dt(posture?.titleKey)}`,
      `Learning Level: ${learningLevel.toUpperCase()}`,
      '',
      'FINDINGS BREAKDOWN:',
      `  Critical: ${severityCounts.critical} | High: ${severityCounts.high} | Medium: ${severityCounts.medium} | Low: ${severityCounts.low} | Info: ${severityCounts.info}`,
      '--------------------------------------------------------------------------------',
      ...res.findings.map((f, idx) => {
        const sev = getFindingSeverity(f.check, f.status).toUpperCase()
        const title = dt('m4.chk.' + f.check)
        const st = dt('m4.st.' + f.status)
        const detail = f.detail ? ` [${f.detail}]` : ''
        const exp = dt('m4.exp.' + f.check)
        return `\n[${idx + 1}] ${f.check} — ${title}\n    Status:   ${st}${detail}\n    Severity: ${sev}\n    Guidance: ${exp}\n    Standard: ${CHECK_META[f.check]?.standard || 'N/A'}`
      }),
      '',
      '================================================================================',
      'SIMULATION NOTICE: This educational lab operates strictly on local fixtures.',
      'No live network probe or offensive tool was executed.',
      '================================================================================',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abbay-m4-security-lab-${res.scenario_id.toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportNotice(dt('m4.export.disclaimer'))
    setTimeout(() => setExportNotice(''), 4000)
  }

  return (
    <section className="module-container">
      <div className="module-header-box m4-header-box">
        <div className="module-header-content">
          <span className="module-tag module-tag-m4 simulated-tag">M4 SIMULATED DEMO</span>
          <h1 className="m4-page-title">
            <span className="m4-title-text">🛡️ {dt('m4.title')}</span>
            <span className="tag m4-simulated-badge">{dt('c.simulated')}</span>
          </h1>
          <p className="lead m4-lead">{dt('m4.desc')}</p>
          <div className="security-note m4-auth-note">
            <span aria-hidden="true">🔒</span>
            <span>{dt('m4.auth')}</span>
          </div>
          <div className="module-assistant-shortcut">
            <button
              type="button"
              className="btn btn-sm btn-assistant-help"
              onClick={() => (onNavigate ? onNavigate('#/assistant?context=m4') : (window.location.hash = '#/assistant?context=m4'))}
              title={t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
            >
              🤖 {t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
            </button>
          </div>
        </div>
        <div className="module-header-artwork">
          <img
            src="/images/journey/m4_security_scanner.svg"
            alt={dt('m4.artwork_alt')}
            className="module-artwork-badge"
            loading="lazy"
          />
        </div>
      </div>

      {/* Clear distinction between M1 Link Checker and M4 Educational Scenario Simulation */}
      <aside className="m4-distinction-banner" aria-label="M1 vs M4 distinction">
        <div className="m4-distinction-content">
          <span className="m4-distinction-icon" aria-hidden="true">💡</span>
          <span className="m4-distinction-text">{dt('m4.distinction')}</span>
        </div>
        <a href="#/m1" className="m4-m1-link">🔗 {dt('nav.m1')} →</a>
      </aside>

      <div className="card m4-card">
        <div className="m4-card-header">
          <h2 className="m4-pick-title">{dt('m4.pick')}</h2>
          <p className="m4-instructions-text">
            {dt('m4.instruction')}
          </p>
        </div>

        {/* Scenario Selection Grid */}
        <div className="m4-scenario-grid" role="group" aria-label={dt('m4.pick')}>
          {(list || []).map((s) => {
            const isSelected = (res?.scenario_id === s.id) || (activeScenarioId === s.id)
            return (
              <button
                key={s.id}
                type="button"
                className={`m4-scenario-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => pick(s.id)}
                aria-pressed={isSelected}
              >
                <div className="m4-scenario-btn-top">
                  <span className="m4-scenario-id-badge">
                    <span aria-hidden="true">🌐 </span>
                    {s.id}
                  </span>
                  {isSelected && (
                    <span className="m4-selected-indicator" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </div>
                <span className="m4-scenario-hostname mono">{s.hostname}</span>
              </button>
            )
          })}
        </div>

        {/* Educational Mode Navigation Bar */}
        <nav className="m4-tabs-nav" aria-label="Educational Lab Modes">
          <button
            type="button"
            className={`m4-tab-btn ${activeTab === 'findings' ? 'active' : ''}`}
            onClick={() => setActiveTab('findings')}
          >
            📋 {dt('m4.tab.findings')}
          </button>
          <button
            type="button"
            className={`m4-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            ⚖️ {dt('m4.tab.matrix')}
          </button>
          <button
            type="button"
            className={`m4-tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
            onClick={() => setActiveTab('checklist')}
          >
            ☑️ {dt('m4.tab.checklist')} ({checkedItems.length}/{CHECKLIST_ITEMS.length})
          </button>
          <button
            type="button"
            className={`m4-tab-btn ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            🧠 {dt('m4.tab.quiz')}
          </button>
        </nav>

        {exportNotice && (
          <div className="alert info" role="status" style={{ marginBottom: '1rem', background: '#0B1220', border: '1px solid #00C2D7', color: '#67E8F9' }}>
            ℹ️ {exportNotice}
          </div>
        )}

        <div aria-live="polite">
          {state === 'loading' && <p className="small loading-state">⏳ {dt('c.loading')}</p>}
          {state === 'error' && (
            <div className="m4-error-box" role="alert" style={{ margin: '1rem 0' }}>
              <p className="msg error">
                ⚠️ {dt('c.err.net')}
              </p>
              {errorDetails && (
                <div className="m4-error-diagnostics small" style={{ margin: '0.5rem 0', opacity: 0.9, fontFamily: 'monospace' }}>
                  <span>Target: <code>{errorDetails.endpoint}</code></span>
                  {errorDetails.status && <span> | Status: <code>{errorDetails.status}</code></span>}
                  {errorDetails.category && <span> | Info: <em>{errorDetails.category}</em></span>}
                </div>
              )}
              <button
                type="button"
                className="btn btn-outline m4-retry-btn"
                onClick={() => (list ? pick(activeScenarioId || 'DS-A') : loadData(activeScenarioId))}
                style={{ marginTop: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span aria-hidden="true">🔄</span>
                <span>{dt('daily.retry') ? dt('daily.retry').split('/')[0].trim() : (dt('c.reset') || 'Try Again')}</span>
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 1: LAB FINDINGS & IN-DEPTH ANALYSIS                          */}
          {/* ================================================================ */}
          {!res && state === 'idle' && activeTab === 'findings' && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>👆 {dt('m4.pick')}</p>
              <p style={{ fontSize: '0.9rem', color: '#64748B' }}>{dt('m4.instruction')}</p>
            </div>
          )}
          {res && activeTab === 'findings' && (
            <div className="m4-result-panel simulated" role="region" aria-label="Simulated Findings">
              {/* Security Posture Summary Card */}
              {posture && (
                <div className="m4-posture-card">
                  <div className="m4-posture-header">
                    <h3 className="m4-posture-title">
                      🛡️ {dt('m4.posture.title')}: <span style={{ color: '#00C2D7' }}>{res.hostname}</span>
                    </h3>
                    <span className={`m4-posture-badge ${posture.badgeClass}`}>
                      {dt(posture.titleKey)}
                    </span>
                  </div>

                  {/* Severity Distribution Counters */}
                  <div className="m4-posture-stats-row">
                    <div className="m4-stat-box stat-critical">
                      <span className="m4-stat-num">{severityCounts.critical}</span>
                      <span className="m4-stat-label">{dt('m4.sev.critical')}</span>
                    </div>
                    <div className="m4-stat-box stat-high">
                      <span className="m4-stat-num">{severityCounts.high}</span>
                      <span className="m4-stat-label">{dt('m4.sev.high')}</span>
                    </div>
                    <div className="m4-stat-box stat-medium">
                      <span className="m4-stat-num">{severityCounts.medium}</span>
                      <span className="m4-stat-label">{dt('m4.sev.medium')}</span>
                    </div>
                    <div className="m4-stat-box stat-low">
                      <span className="m4-stat-num">{severityCounts.low}</span>
                      <span className="m4-stat-label">{dt('m4.sev.low')}</span>
                    </div>
                    <div className="m4-stat-box stat-info">
                      <span className="m4-stat-num">{severityCounts.info}</span>
                      <span className="m4-stat-label">{dt('m4.sev.info')}</span>
                    </div>
                  </div>

                  <p className="m4-posture-summary-text">
                    {dt(posture.summaryKey)}
                  </p>
                </div>
              )}

              {/* Learning Level Selector */}
              <div className="m4-level-bar">
                <span className="m4-level-label">
                  🎓 {dt('m4.lvl.label')}:
                </span>
                <div className="m4-level-options">
                  <button
                    type="button"
                    className={`m4-level-btn ${learningLevel === 'beginner' ? 'selected' : ''}`}
                    onClick={() => setLearningLevel('beginner')}
                  >
                    🟢 {dt('m4.lvl.beginner')}
                  </button>
                  <button
                    type="button"
                    className={`m4-level-btn ${learningLevel === 'intermediate' ? 'selected' : ''}`}
                    onClick={() => setLearningLevel('intermediate')}
                  >
                    🟡 {dt('m4.lvl.intermediate')}
                  </button>
                  <button
                    type="button"
                    className={`m4-level-btn ${learningLevel === 'advanced' ? 'selected' : ''}`}
                    onClick={() => setLearningLevel('advanced')}
                  >
                    🔵 {dt('m4.lvl.advanced')}
                  </button>
                </div>
              </div>

              {/* Header Title with Counts and Simulated Accent */}
              <div className="m4-result-header" style={{ marginBottom: '1rem' }}>
                <div>
                  <h3 className="m4-result-heading">
                    📋 {dt('m4.result')} ({res.findings.length})
                  </h3>
                  <p className="m4-target-hostname-row mono">
                    <span className="m4-target-label">Target (simulated): </span>
                    <strong className="m4-target-value">{res.hostname}</strong>
                  </p>
                </div>
                <span className="tag simulated-accent-tag">{dt('c.simulated')}</span>
              </div>

              {/* Detailed Findings Cards */}
              <div className="m4-findings-list">
                {res.findings.map((f) => {
                  const statusClass = f.status === 'present' ? 'status-present' : f.status === 'missing' ? 'status-missing' : 'status-unknown'
                  const statusIcon = f.status === 'present' ? '✓' : f.status === 'missing' ? '✗' : '?'
                  const severity = getFindingSeverity(f.check, f.status)
                  const meta = CHECK_META[f.check] || {}

                  return (
                    <article className={`m4-finding-card ${statusClass}`} key={f.check}>
                      <div className="m4-finding-top">
                        <div className="m4-finding-title-group">
                          <span className="m4-chk-code">{f.check}</span>
                          <h4 className="m4-chk-title">{dt('m4.chk.' + f.check)}</h4>
                          <span className={`m4-sev-pill sev-${severity}`}>
                            {dt('m4.sev.' + severity)}
                          </span>
                        </div>
                        <div className="m4-finding-status-group">
                          <span className={`m4-status-pill ${statusClass}`}>
                            <span aria-hidden="true">{statusIcon} </span>
                            {dt('m4.st.' + f.status)}
                          </span>
                          {f.detail && (
                            <>
                              {' '}
                              <span className="m4-finding-detail-tag mono">
                                [{decodeEntities(f.detail)}]
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Guidance & Remediation */}
                      <div className="m4-finding-guidance">
                        <strong className="m4-fix-label">{dt('m4.fix')}:</strong>{' '}
                        <span className="m4-fix-text">{dt('m4.exp.' + f.check)}</span>

                        {/* Learning Level Guidance Depth — shown at ALL levels (more detail at intermediate/advanced) */}
                        <div className="m4-guidance-extra">
                          <strong className="m4-guidance-extra-label">🎯 {dt('m4.detail.why_it_matters')}: </strong>
                          <span className="m4-guidance-extra-text">
                            {learningLevel === 'beginner'
                              ? dt('m4.exp.' + f.check)
                              : (meta.standard || dt('m4.exp.' + f.check))}
                          </span>
                        </div>

                        {/* Advanced Code Configuration Snippet */}
                        {learningLevel === 'advanced' && meta.codeSnippet && (
                          <div className="m4-code-wrap">
                            <span className="m4-code-label">
                              💻 {dt('m4.detail.server_config')} (Nginx / Production):
                            </span>
                            <pre className="m4-code-block">
                              <code>{meta.codeSnippet}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>

              {/* Simulated Report Export Bar */}
              <div className="m4-export-bar">
                <span style={{ fontSize: '0.88rem', color: '#CBD5E1' }}>
                  📥 <strong>Export Simulated Lab Dossier:</strong>
                </span>
                <div className="m4-export-actions">
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={handleExportJson}
                    style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                  >
                    📄 {dt('m4.export.json')}
                  </button>
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={handleExportTxt}
                    style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                  >
                    📝 {dt('m4.export.txt')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: SCENARIO COMPARISON MATRIX (DS-A vs DS-B vs DS-C)         */}
          {/* ================================================================ */}
          {activeTab === 'matrix' && (
            <div className="m4-matrix-table-wrap" role="region" aria-label="Comparison Matrix">
              <table className="m4-matrix-table">
                <thead>
                  <tr>
                    <th>{dt('m4.matrix.check')}</th>
                    <th>{dt('m4.matrix.dsa')}</th>
                    <th>{dt('m4.matrix.dsb')}</th>
                    <th>{dt('m4.matrix.dsc')}</th>
                    <th>{dt('m4.matrix.target')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>CHK-01 (TLS)</strong></td>
                    <td><span className="m4-status-pill status-present">✓ Present</span></td>
                    <td><span className="m4-status-pill status-present">✓ Present</span></td>
                    <td><span className="m4-status-pill status-missing">✗ Missing [expired]</span></td>
                    <td style={{ color: '#00C2D7' }}>{dt('m4.matrix.target_chk01')}</td>
                  </tr>
                  <tr>
                    <td><strong>CHK-02 (Redirect)</strong></td>
                    <td><span className="m4-status-pill status-missing">✗ Missing</span></td>
                    <td><span className="m4-status-pill status-present">✓ Present</span></td>
                    <td><span className="m4-status-pill status-unknown">? Unknown</span></td>
                    <td style={{ color: '#00C2D7' }}>{dt('m4.matrix.target_chk02')}</td>
                  </tr>
                  <tr>
                    <td><strong>CHK-03 (HSTS)</strong></td>
                    <td><span className="m4-status-pill status-missing">✗ Missing</span></td>
                    <td><span className="m4-status-pill status-present">✓ Present</span></td>
                    <td><span className="m4-status-pill status-unknown">? Unknown</span></td>
                    <td style={{ color: '#00C2D7' }}>{dt('m4.matrix.target_chk03')}</td>
                  </tr>
                  <tr>
                    <td><strong>CHK-04 (CSP)</strong></td>
                    <td><span className="m4-status-pill status-missing">✗ Missing</span></td>
                    <td><span className="m4-status-pill status-present">✓ Present</span></td>
                    <td><span className="m4-status-pill status-unknown">? Unknown</span></td>
                    <td style={{ color: '#00C2D7' }}>{dt('m4.matrix.target_chk04')}</td>
                  </tr>
                  <tr>
                    <td><strong>CHK-05 (Browser Defenses)</strong></td>
                    <td><span className="m4-status-pill status-present">✓ Present</span></td>
                    <td><span className="m4-status-pill status-missing">✗ Missing [Permissions-Policy]</span></td>
                    <td><span className="m4-status-pill status-unknown">? Unknown</span></td>
                    <td style={{ color: '#00C2D7' }}>{dt('m4.matrix.target_chk05')}</td>
                  </tr>
                  <tr>
                    <td><strong>CHK-06 (Cookie Flags)</strong></td>
                    <td><span className="m4-status-pill status-missing">✗ Missing</span></td>
                    <td><span className="m4-status-pill status-present">✓ Present</span></td>
                    <td><span className="m4-status-pill status-unknown">? Unknown</span></td>
                    <td style={{ color: '#00C2D7' }}>{dt('m4.matrix.target_chk06')}</td>
                  </tr>
                  <tr>
                    <td><strong>CHK-07 (Banner Leakage)</strong></td>
                    <td><span className="m4-status-pill status-leaked">⚠️ Leaked [Server / X-Powered-By]</span></td>
                    <td><span className="m4-status-pill status-hidden">✓ Hidden (Safe)</span></td>
                    <td><span className="m4-status-pill status-unknown">? Unknown</span></td>
                    <td style={{ color: '#00C2D7' }}>{dt('m4.matrix.target_chk07')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: INTERACTIVE HARDENING CHECKLIST                           */}
          {/* ================================================================ */}
          {activeTab === 'checklist' && (
            <div className="m4-checklist-card" role="region" aria-label="Hardening Checklist">
              <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: '#00C2D7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ☑️ {dt('m4.chklist.title')}
              </h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#CBD5E1' }}>
                {dt('m4.chklist.desc')}
              </p>

              {/* Progress Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#94A3B8' }}>
                <span>{dt('m4.chklist.progress')}: <strong>{checkedItems.length} of {CHECKLIST_ITEMS.length} completed</strong></span>
                <span style={{ fontWeight: 700, color: '#00C2D7' }}>
                  {Math.round((checkedItems.length / CHECKLIST_ITEMS.length) * 100)}%
                </span>
              </div>
              <div className="m4-progress-track">
                <div
                  className="m4-progress-fill"
                  style={{ width: `${(checkedItems.length / CHECKLIST_ITEMS.length) * 100}%` }}
                />
              </div>

              {/* Checklist Items */}
              <div className="m4-checklist-items" role="group" aria-label={dt('m4.chklist.title')}>
                {CHECKLIST_ITEMS.map((item, idx) => {
                  const isChecked = checkedItems.includes(item.key)
                  const inputId = `m4-chk-item-${item.key}`
                  return (
                    <label
                      key={item.key}
                      htmlFor={inputId}
                      className={`m4-checklist-row ${isChecked ? 'completed' : ''}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault()
                          toggleChecklistItem(item.key)
                        }
                      }}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        className="m4-checklist-checkbox"
                        checked={isChecked}
                        onChange={() => toggleChecklistItem(item.key)}
                        tabIndex={-1}
                      />
                      <span className="m4-checklist-text">
                        <strong className="m4-checklist-num">{idx + 1}.</strong> {dt(item.textKey)}
                      </span>
                      <span className={`m4-checklist-badge ${isChecked ? 'done' : 'pending'}`}>
                        {isChecked ? '✓ DONE' : '○ PENDING'}
                      </span>
                    </label>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={resetChecklist}
                  style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                >
                  🔄 {dt('m4.chklist.reset')}
                </button>
                <button
                  type="button"
                  className="btn primary small"
                  onClick={markAllChecklist}
                  style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                >
                  ✓ {dt('m4.chklist.mark_all')}
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: EXPANDED DETERMINISTIC KNOWLEDGE QUIZ                     */}
          {/* ================================================================ */}
          {activeTab === 'quiz' && (
            <div className="m4-quiz-card" role="region" aria-label="Knowledge Quiz">
              {/* Header and Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #1E293B' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#00C2D7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🧠 {dt('m4.quiz.title')}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#CBD5E1' }}>
                    {dt('m4.quiz.desc')}
                  </p>
                </div>

                {/* Difficulty Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>{dt('m4.lvl.label')}:</span>
                  {[
                    { id: 'all', labelKey: 'm4.quiz.diff_all' },
                    { id: 'beginner', labelKey: 'm4.quiz.diff_beginner' },
                    { id: 'intermediate', labelKey: 'm4.quiz.diff_intermediate' },
                    { id: 'advanced', labelKey: 'm4.quiz.diff_advanced' },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => handleDifficultyChange(lvl.id)}
                      style={{
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: quizDifficulty === lvl.id ? '1px solid #00C2D7' : '1px solid #334155',
                        background: quizDifficulty === lvl.id ? 'rgba(0, 194, 215, 0.15)' : '#0F172A',
                        color: quizDifficulty === lvl.id ? '#00C2D7' : '#94A3B8',
                        cursor: 'pointer',
                        fontWeight: quizDifficulty === lvl.id ? 700 : 500,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {dt(lvl.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retry mode banner */}
              {retryQuestions && retryQuestions.length > 0 && !quizCompleted && (
                <div style={{ marginBottom: '1rem', padding: '8px 14px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #F59E0B', color: '#FCD34D', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🔄 {dt('m4.quiz.btn_retry_missed')} ({sessionQuestions.length})</span>
                  <button
                    type="button"
                    onClick={handleNewQuizSession}
                    style={{ background: 'none', border: 'none', color: '#FCD34D', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.78rem' }}
                  >
                    {dt('m4.quiz.btn_new_quiz')}
                  </button>
                </div>
              )}

              {/* State A: Active Question View */}
              {!quizCompleted && sessionQuestions.length > 0 && (() => {
                const currentQ = sessionQuestions[quizCurrentIdx] || sessionQuestions[0]
                const selectedOptIdx = quizAnswers[currentQ.id]
                const hasAnswered = selectedOptIdx !== undefined
                const isCorrect = hasAnswered && selectedOptIdx === currentQ.correctIdx

                const badgeColor = currentQ.difficulty === 'beginner' ? { bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981', text: '#34D399', label: dt('m4.quiz.badge_beginner') } :
                                   currentQ.difficulty === 'intermediate' ? { bg: 'rgba(0, 194, 215, 0.15)', border: '#00C2D7', text: '#00C2D7', label: dt('m4.quiz.badge_intermediate') } :
                                   { bg: 'rgba(244, 63, 94, 0.15)', border: '#F43F5E', text: '#FB7185', label: dt('m4.quiz.badge_advanced') }

                const topicLabel = currentQ.topic === 'tls' ? dt('m4.quiz.topic_tls') :
                                   currentQ.topic === 'headers' ? dt('m4.quiz.topic_headers') :
                                   currentQ.topic === 'cookies' ? dt('m4.quiz.topic_cookies') :
                                   dt('m4.quiz.topic_scenarios')

                return (
                  <div className="m4-quiz-active-panel">
                    {/* Progress & Metadata */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F8FAFC' }}>
                        {dt('m4.quiz.question_progress')} {quizCurrentIdx + 1} / {sessionQuestions.length}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#1E293B', color: '#94A3B8', border: '1px solid #334155' }}>
                          {topicLabel}
                        </span>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: badgeColor.bg, color: badgeColor.text, border: `1px solid ${badgeColor.border}`, fontWeight: 600 }}>
                          {badgeColor.label}
                        </span>
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '10px', padding: '16px 20px', marginBottom: '1.25rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#F8FAFC', lineHeight: 1.5 }}>
                        {dt(currentQ.qKey)}
                      </h4>
                    </div>

                    {/* Options Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
                      {currentQ.options.map((opt, optIdx) => {
                        const isOptionSelected = selectedOptIdx === optIdx
                        let btnBorder = '#334155'
                        let btnBg = '#14233B'
                        let btnColor = '#E2E8F0'

                        if (hasAnswered) {
                          if (optIdx === currentQ.correctIdx) {
                            btnBorder = '#10B981'
                            btnBg = 'rgba(16, 185, 129, 0.15)'
                            btnColor = '#34D399'
                          } else if (isOptionSelected) {
                            btnBorder = '#EF4444'
                            btnBg = 'rgba(239, 68, 68, 0.15)'
                            btnColor = '#FCA5A5'
                          } else {
                            btnColor = '#64748B'
                            btnBg = '#0B1220'
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectQuizOption(currentQ.id, optIdx)}
                            disabled={hasAnswered}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px 16px',
                              borderRadius: '8px',
                              border: `1px solid ${btnBorder}`,
                              background: btnBg,
                              color: btnColor,
                              textAlign: 'left',
                              fontSize: '0.92rem',
                              lineHeight: 1.45,
                              cursor: hasAnswered ? 'default' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span style={{ fontWeight: 800, minWidth: '22px', color: '#00C2D7' }}>
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span style={{ flex: 1 }}>{dt(opt.textKey)}</span>
                            {hasAnswered && optIdx === currentQ.correctIdx && (
                              <span style={{ color: '#10B981', fontWeight: 800 }}>✓</span>
                            )}
                            {hasAnswered && isOptionSelected && optIdx !== currentQ.correctIdx && (
                              <span style={{ color: '#EF4444', fontWeight: 800 }}>✗</span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Instant Feedback & Explanation */}
                    {hasAnswered && (
                      <div
                        style={{
                          borderRadius: '8px',
                          padding: '14px 18px',
                          marginBottom: '1.25rem',
                          border: isCorrect ? '1px solid #10B981' : '1px solid #EF4444',
                          background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: '#F8FAFC',
                          fontSize: '0.88rem',
                          lineHeight: 1.5,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, marginBottom: '6px', color: isCorrect ? '#34D399' : '#FCA5A5' }}>
                          <span>{isCorrect ? `✓ ${dt('m4.quiz.correct')}` : `✗ ${dt('m4.quiz.incorrect')}`}</span>
                        </div>
                        <p style={{ margin: 0, color: '#E2E8F0' }}>
                          {dt(currentQ.options[selectedOptIdx]?.expKey)}
                        </p>
                      </div>
                    )}

                    {/* Progression Action */}
                    {hasAnswered && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button
                          type="button"
                          className="btn primary"
                          onClick={handleNextQuestion}
                          style={{ fontSize: '0.9rem', padding: '8px 20px', fontWeight: 700 }}
                        >
                          {quizCurrentIdx < sessionQuestions.length - 1 ? (
                            <span>{dt('m4.quiz.next_btn')} →</span>
                          ) : (
                            <span>{dt('m4.quiz.view_results')} →</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* State B: Completion & Diagnostic Summary Screen */}
              {quizCompleted && diagnostics && (
                <div className="m4-quiz-completion-panel" style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '1.4rem', color: '#00C2D7' }}>
                      🎉 {dt('m4.quiz.completed_title')}
                    </h4>
                    <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#F8FAFC' }}>
                      {dt('m4.quiz.score_summary')}: <span style={{ color: '#00C2D7' }}>{diagnostics.score} / {diagnostics.total}</span> ({diagnostics.percentage}%)
                    </p>
                    <p style={{ margin: '8px auto 0', maxWidth: '600px', fontSize: '0.9rem', color: '#94A3B8' }}>
                      {diagnostics.percentage >= 90 ? dt('m4.quiz.performance_high') :
                       diagnostics.percentage >= 60 ? dt('m4.quiz.performance_med') :
                       dt('m4.quiz.performance_low')}
                    </p>
                  </div>

                  {/* Topic Diagnostics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
                    {[
                      { key: 'tls', nameKey: 'm4.quiz.topic_tls', stats: diagnostics.topicBreakdown.tls },
                      { key: 'headers', nameKey: 'm4.quiz.topic_headers', stats: diagnostics.topicBreakdown.headers },
                      { key: 'cookies', nameKey: 'm4.quiz.topic_cookies', stats: diagnostics.topicBreakdown.cookies },
                      { key: 'scenarios', nameKey: 'm4.quiz.topic_scenarios', stats: diagnostics.topicBreakdown.scenarios },
                    ].map((top) => {
                      const pct = top.stats.total > 0 ? Math.round((top.stats.correct / top.stats.total) * 100) : 0
                      return (
                        <div key={top.key} style={{ background: '#14233B', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>{dt(top.nameKey)}</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: pct === 100 ? '#10B981' : pct > 0 ? '#00C2D7' : '#EF4444' }}>
                              {top.stats.correct} / {top.stats.total}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>{pct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Strengths and Practice Areas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34D399', display: 'block', marginBottom: '6px' }}>
                        💪 {dt('m4.quiz.strengths_label')}
                      </span>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#E2E8F0' }}>
                        {diagnostics.strengths.length > 0 ? (
                          diagnostics.strengths.map((s) => {
                            const k = s === 'tls' ? dt('m4.quiz.topic_tls') :
                                      s === 'headers' ? dt('m4.quiz.topic_headers') :
                                      s === 'cookies' ? dt('m4.quiz.topic_cookies') :
                                      dt('m4.quiz.topic_scenarios')
                            return `• ${k}`
                          }).join('  ')
                        ) : (
                          dt('m4.quiz.performance_low')
                        )}
                      </p>
                    </div>

                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FCA5A5', display: 'block', marginBottom: '6px' }}>
                        🎯 {dt('m4.quiz.practice_label')}
                      </span>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#E2E8F0' }}>
                        {diagnostics.practiceAreas.length > 0 ? (
                          diagnostics.practiceAreas.map((p) => {
                            const k = p === 'tls' ? dt('m4.quiz.topic_tls') :
                                      p === 'headers' ? dt('m4.quiz.topic_headers') :
                                      p === 'cookies' ? dt('m4.quiz.topic_cookies') :
                                      dt('m4.quiz.topic_scenarios')
                            return `• ${k}`
                          }).join('  ')
                        ) : (
                          dt('m4.quiz.all_correct')
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Completion Actions */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {diagnostics.missedIds.length > 0 && (
                      <button
                        type="button"
                        className="btn outline"
                        onClick={handleRetryMissed}
                        style={{ fontSize: '0.88rem', padding: '8px 18px', fontWeight: 600 }}
                      >
                        🔄 {dt('m4.quiz.btn_retry_missed')} ({diagnostics.missedIds.length})
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn primary"
                      onClick={handleNewQuizSession}
                      style={{ fontSize: '0.88rem', padding: '8px 18px', fontWeight: 700 }}
                    >
                      🎲 {dt('m4.quiz.btn_new_quiz')}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setActiveTab('findings')}
                      style={{ fontSize: '0.88rem', padding: '8px 18px' }}
                    >
                      📖 {dt('m4.quiz.btn_continue_learning')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="m4-scope-warning" role="note">
          <span className="m4-scope-icon" aria-hidden="true">⚠️</span>
          <p className="m4-scope-text">{dt('m4.scope')}</p>
        </div>
      </div>
    </section>
  )
}
