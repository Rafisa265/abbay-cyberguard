import { useState } from 'react'
import { analyze, analyzeText } from '../lib/m1.js'
import { checkM1Cti } from '../lib/api.js'

const URL_EXAMPLES = [
  'https://example.com/',
  'http://example-login.test/verify?id=1',
  'https://bit.ly/abc123',
  'http://192.0.2.10:8080/account/update'
]

const MESSAGE_EXAMPLES = [
  {
    label: 'Telecom SIM Deactivation (SMS Phishing)',
    text: 'Ethio Telecom Alert: Your SIM card will be deactivated within 12 hours. Send your OTP code immediately to verify your account: http://192.0.2.10:8080/account/update'
  },
  {
    label: 'Telebirr Lottery Prize (Advance Fee)',
    text: 'Congratulations! You won 100,000 Birr in the annual Telebirr anniversary lottery. Pay a 250 Birr processing fee to claim: https://bit.ly/abc123'
  },
  {
    label: 'CBE Banking APK Upgrade (Malicious APK)',
    text: 'CBE customer support: Our banking app is upgraded. Download and install this new APK file or contact our Telegram bot t.me/cbe_support_bot'
  },
  {
    label: 'Benign Personal Message',
    text: 'Selam! Are we still meeting for coffee at 4:00 PM today? Let me know if you need directions.'
  }
]

const EMAIL_EXAMPLES = [
  {
    label: 'Urgent Bank Suspension (Free Webmail)',
    text: 'From: Commercial Bank of Ethiopia <cbe-notice@gmail.com>\nSubject: Urgent: Account Suspended\n\nDear customer, suspicious login detected. Your account will be closed within 24 hours unless you verify your password.'
  },
  {
    label: 'International Scholarship (Advance Fee)',
    text: 'Subject: International Scholarship Approved - Action Required\n\nCongratulations, your application was approved with full tuition coverage. To release funds, transfer a $50 registration fee via Western Union.'
  },
  {
    label: 'Remote Job Lure (Suspicious Link)',
    text: 'Subject: Remote Data Entry Position - $45/hour\n\nWe reviewed your resume. Start immediately without interview. Click the link to submit your personal and banking details: https://bit.ly/abc123'
  },
  {
    label: 'Benign Business Meeting Invite',
    text: 'Subject: Weekly Project Sync - Thursday 10:00 AM\n\nHi team, attached is the meeting agenda for Thursday. Please review the talking points beforehand.'
  }
]

const LEVEL_ICONS = {
  high: '🚨',
  caution: '⚠️',
  none: 'ℹ️'
}

function decodeEntities(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// Helper to safely format uncalibrated model score as a numeric score out of 100
function formatModelScore(prob) {
  if (typeof prob !== 'number' || isNaN(prob)) return '0/100 score'
  return `${Math.round(prob * 100)}/100 score`
}

export default function M1({ t, onNavigate }) {
  const [mode, setMode] = useState('url') // 'url' | 'message' | 'email'
  const [input, setInput] = useState('')
  const [res, setRes] = useState(null)
  const [onlineCtiEnabled, setOnlineCtiEnabled] = useState(false)
  const [ctiLoading, setCtiLoading] = useState(false)
  const [ctiResult, setCtiResult] = useState(null)
  const [ctiLoadingUrls, setCtiLoadingUrls] = useState({})
  const [extractedUrlCtiResults, setExtractedUrlCtiResults] = useState({})

  const dt = (key) => decodeEntities(t(key))

  const handleModeChange = (newMode) => {
    if (newMode === mode) return
    setMode(newMode)
    setInput('')
    setRes(null)
    setCtiResult(null)
    setCtiLoading(false)
    setCtiLoadingUrls({})
    setExtractedUrlCtiResults({})
  }

  const getCtiSourceLabel = () => {
    if (ctiResult?.source === 'local_database' || ctiResult?.provider === 'local_feed') {
      return dt('m1.cti_source_local_feed')
    }
    return dt('m1.cti_source_provider')
  }

  const getUnavailableReasonText = () => {
    if (!ctiResult?.unavailable_reason) return ''
    const rawReason = String(ctiResult.unavailable_reason).toLowerCase()
    const codeMap = {
      config_missing: 'm1.cti_reason_config',
      config: 'm1.cti_reason_config',
      timeout: 'm1.cti_reason_timeout',
      rate_limited: 'm1.cti_reason_rate_limit',
      rate_limit: 'm1.cti_reason_rate_limit',
      network_error: 'm1.cti_reason_network',
      network: 'm1.cti_reason_network',
      provider_error: 'm1.cti_reason_network',
      provider: 'm1.cti_reason_network',
      feed_missing: 'm1.cti_reason_feed_missing',
      feed_empty: 'm1.cti_reason_feed_empty',
      feed_malformed: 'm1.cti_reason_feed_malformed',
      feed_unreadable: 'm1.cti_reason_feed_unreadable',
    }
    const mappedKey = codeMap[rawReason] || ('m1.cti_reason_' + rawReason)
    const translated = dt(mappedKey)
    if (translated && translated !== mappedKey && !translated.startsWith('m1.cti_reason_')) {
      return translated
    }
    if (ctiResult.details && typeof ctiResult.details === 'string' && !ctiResult.details.toLowerCase().includes('cti service error')) {
      return ctiResult.details
    }
    const fallback = dt('m1.cti_reason_network')
    return (fallback && fallback !== 'm1.cti_reason_network') ? fallback : ''
  }

  const getEvidenceList = (indicators) => {
    if (!indicators || !indicators.length) return []
    const items = []
    if (indicators.includes('TXT-04')) items.push(dt('m1.ev_txt_04'))
    if (indicators.includes('TXT-09')) items.push(dt('m1.ev_txt_09'))
    if (indicators.includes('TXT-10')) items.push(dt('m1.ev_txt_10'))
    if (indicators.includes('TXT-01')) items.push(dt('m1.ev_txt_01'))
    if (indicators.includes('TXT-02')) items.push(dt('m1.ev_txt_02'))
    if (indicators.includes('TXT-03')) items.push(dt('m1.ev_txt_03'))
    if (indicators.includes('TXT-05')) items.push(dt('m1.ev_txt_05'))
    if (indicators.includes('TXT-06')) items.push(dt('m1.ev_txt_06'))
    if (indicators.includes('TXT-07')) items.push(dt('m1.ev_txt_07'))
    if (indicators.includes('TXT-08')) items.push(dt('m1.ev_txt_08'))
    return items
  }

  const getTextVerdictDescription = (targetRes) => {
    if (!targetRes || !targetRes.indicators || targetRes.indicators.length === 0) {
      return dt('m1.verdict_txt_none_desc')
    }
    const evidenceItems = getEvidenceList(targetRes.indicators)
    const lead = targetRes.level === 'high' ? dt('m1.verdict_txt_high_lead') : dt('m1.verdict_txt_caution_lead')
    return `${lead} ${evidenceItems.join('; ')}.`
  }

  const getTextVerdictNextSteps = (targetRes) => {
    if (!targetRes || !targetRes.indicators || targetRes.indicators.length === 0) {
      return dt('m1.rec_txt_none')
    }
    const inds = targetRes.indicators
    const steps = []
    if (inds.includes('TXT-09') || inds.includes('TXT-10')) {
      steps.push(dt('m1.step_no_bank_personal'))
    }
    if (inds.includes('TXT-04')) {
      steps.push(dt('m1.step_verify_prize'))
    }
    if (inds.includes('TXT-01')) {
      steps.push(dt('m1.step_no_secrets'))
    }
    if (inds.includes('TXT-06') || inds.includes('TXT-07')) {
      steps.push(dt('m1.step_no_links'))
    }
    if (steps.length === 0) {
      steps.push(targetRes.level === 'high' ? dt('m1.rec_txt_high') : dt('m1.rec_txt_caution'))
    }
    return steps.join(' ')
  }

  const getCombinedVerdict = () => {
    if (!res) return null

    // Message or Email text mode verdicts
    if (mode !== 'url') {
      if (res.level === 'high') {
        return {
          state: 'txt_high',
          icon: '🚨',
          badgeClass: 'verdict-suspicious',
          title: dt('m1.verdict_txt_high'),
          levelKey: 'm1.lvl.high',
          description: getTextVerdictDescription(res),
          nextSteps: getTextVerdictNextSteps(res),
        }
      }
      if (res.level === 'caution') {
        return {
          state: 'txt_caution',
          icon: '⚠️',
          badgeClass: 'verdict-caution',
          title: dt('m1.verdict_txt_caution'),
          levelKey: 'm1.lvl.caution',
          description: getTextVerdictDescription(res),
          nextSteps: getTextVerdictNextSteps(res),
        }
      }
      return {
        state: 'txt_none',
        icon: 'ℹ️',
        badgeClass: 'verdict-clean',
        title: dt('m1.verdict_txt_none'),
        levelKey: 'm1.lvl.none',
        description: dt('m1.verdict_txt_none_desc'),
        nextSteps: dt('m1.rec_txt_none'),
      }
    }

    // URL Mode:
    // State 1: Online CTI completed and matched a known threat
    if (onlineCtiEnabled && ctiResult?.status === 'known_malicious') {
      return {
        state: 'cti_malicious',
        icon: '🛑',
        badgeClass: 'verdict-malicious',
        title: dt('m1.verdict_cti_threat'),
        levelKey: 'm1.lvl.high',
        description: dt('m1.cti_status_malicious_desc'),
        nextSteps: dt('m1.rec_malicious'),
      }
    }

    // Educational documentation IP address (e.g., 192.0.2.10 under RFC 5737)
    if (res.isDocAddress) {
      return {
        state: 'doc_ip',
        icon: '📝',
        badgeClass: 'verdict-doc-ip',
        title: dt('m1.verdict_doc_ip'),
        levelKey: 'm1.lvl.' + res.level,
        description: dt('m1.verdict_doc_ip_desc'),
        nextSteps: dt('m1.rec_doc'),
      }
    }

    // State 1b: Online CTI query actively in progress
    if (onlineCtiEnabled && ctiLoading) {
      return {
        state: 'cti_checking',
        icon: '⏳',
        badgeClass: `verdict-${res.level}`,
        title: dt('m1.verdict_cti_checking'),
        levelKey: 'm1.lvl.' + res.level,
        description: dt('m1.cti_loading'),
        nextSteps: res.level === 'high' ? dt('m1.rec_high') : res.level === 'caution' ? dt('m1.rec_caution') : dt('m1.rec_none'),
      }
    }

    // State 2: Online CTI completed and no matching threat was found in database
    if (onlineCtiEnabled && ctiResult?.status === 'no_threat_found') {
      if (res.level !== 'none') {
        // Legitimate local indicators exist - do NOT erase them!
        return {
          state: 'cti_clean_local_flagged',
          icon: res.level === 'high' ? '🚨' : '⚠️',
          badgeClass: res.level === 'high' ? 'verdict-suspicious' : 'verdict-caution',
          title: dt('m1.verdict_cti_clean_flagged'),
          levelKey: 'm1.lvl.' + res.level,
          description: dt('m1.verdict_cti_clean_flagged_desc'),
          nextSteps: res.level === 'high' ? dt('m1.rec_high') : dt('m1.rec_caution'),
        }
      }
      // Both local heuristics and CTI found no known threat
      return {
        state: 'both_clean',
        icon: 'ℹ️',
        badgeClass: 'verdict-clean',
        title: dt('m1.verdict_cti_clean'),
        levelKey: 'm1.lvl.none',
        description: dt('m1.verdict_cti_clean_desc'),
        nextSteps: dt('m1.rec_none'),
      }
    }

    // State 4: Online CTI was requested, but service was unavailable / failed
    if (onlineCtiEnabled && ctiResult?.status === 'unavailable') {
      const reasonStr = getUnavailableReasonText()
      const isFlagged = res.level !== 'none'
      const title = isFlagged ? dt('m1.verdict_cti_unavail_flagged') : dt('m1.verdict_cti_unavail_clean')
      const baseDesc = isFlagged ? dt('m1.verdict_cti_unavail_flagged_desc') : dt('m1.verdict_cti_unavail_clean_desc')
      const desc = baseDesc + (reasonStr ? ` (${reasonStr})` : '')
      return {
        state: 'cti_unavailable',
        icon: LEVEL_ICONS[res.level],
        badgeClass: `verdict-${res.level}`,
        title,
        levelKey: 'm1.lvl.' + res.level,
        description: desc,
        nextSteps: res.level === 'high' ? dt('m1.rec_high') : res.level === 'caution' ? dt('m1.rec_caution') : dt('m1.rec_none'),
      }
    }

    // State 3: Offline-only scan (CTI disabled or not requested)
    const titleKey = res.level === 'high' ? 'm1.verdict_offline_high' : res.level === 'caution' ? 'm1.verdict_offline_caution' : 'm1.verdict_offline_none'
    return {
      state: 'offline_only',
      icon: LEVEL_ICONS[res.level],
      badgeClass: `verdict-${res.level}`,
      title: dt(titleKey),
      levelKey: 'm1.lvl.' + res.level,
      description: res.level === 'none' ? dt('m1.none') : dt('m1.rec_' + res.level),
      nextSteps: res.level === 'high' ? dt('m1.rec_high') : res.level === 'caution' ? dt('m1.rec_caution') : dt('m1.rec_none'),
    }
  }

  const run = async (v = input) => {
    if (mode === 'url') {
      const r = analyze(v)
      setRes(r)
      setCtiResult(null)

      if (r.error) return

      if (onlineCtiEnabled) {
        setCtiLoading(true)
        try {
          const targetUrl = r.text || (r.url ? r.url.href : null) || (v.startsWith('http://') || v.startsWith('https://') ? v : 'https://' + v)
          const ctiData = await checkM1Cti(targetUrl)
          setCtiResult(ctiData?.cti || null)
        } catch {
          setCtiResult({
            provider: 'google_safe_browsing_v5',
            status: 'unavailable',
            threat_types: [],
            details: 'Failed to contact threat intelligence service.',
            unavailable_reason: 'NETWORK_ERROR',
            source: 'cti_provider',
          })
        } finally {
          setCtiLoading(false)
        }
      }
    } else {
      // Message or Email text mode: strictly local in-browser analysis!
      const r = analyzeText(v, mode)
      setRes(r)
      setCtiResult(null)
      setExtractedUrlCtiResults({})
      setCtiLoadingUrls({})
    }
  }

  const handleCheckExtractedUrlCti = async (targetUrl, idx) => {
    setCtiLoadingUrls((prev) => ({ ...prev, [idx]: true }))
    try {
      const data = await checkM1Cti(targetUrl)
      setExtractedUrlCtiResults((prev) => ({ ...prev, [idx]: data?.cti || null }))
    } catch {
      setExtractedUrlCtiResults((prev) => ({
        ...prev,
        [idx]: {
          provider: 'google_safe_browsing_v5',
          status: 'unavailable',
          threat_types: [],
          details: 'Failed to contact threat intelligence service.',
          unavailable_reason: 'NETWORK_ERROR',
        },
      }))
    } finally {
      setCtiLoadingUrls((prev) => ({ ...prev, [idx]: false }))
    }
  }

  const handleClear = () => {
    setInput('')
    setRes(null)
    setCtiResult(null)
    setCtiLoading(false)
    setCtiLoadingUrls({})
    setExtractedUrlCtiResults({})
  }

  return (
    <section className="module-container">
      <div className="module-header-box">
        <div className="module-header-content">
          <span className="module-tag module-tag-m1">M1 THREAT CHECKER & CTI</span>
          <h1>🛡️ {dt('m1.title')}</h1>
          <p className="lead">{dt('m1.subtitle')}</p>
          <div className="security-note">
            <span aria-hidden="true">🔒</span>
            <span>{dt('m1.local')}</span>
          </div>
          <div className="module-assistant-shortcut">
            <button
              type="button"
              className="btn btn-sm btn-assistant-help"
              onClick={() => onNavigate ? onNavigate('#/assistant?context=m1') : (window.location.hash = '#/assistant?context=m1')}
              title={t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
            >
              🤖 {t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
            </button>
          </div>
        </div>
        <div className="module-header-artwork">
          <img
            src="/images/journey/m1_link_scanner.svg"
            alt={dt('m1.artwork_alt')}
            className="module-artwork-badge"
            loading="lazy"
          />
        </div>
      </div>

      <div className="card m1-input-card">
        {/* Threat Checker Input Mode Selector */}
        <div className="m1-mode-tabs" role="tablist" aria-label={dt('m1.select_mode')}>
          <button
            type="button"
            role="tab"
            id="m1-tab-url"
            aria-selected={mode === 'url'}
            className={`m1-tab-btn ${mode === 'url' ? 'active' : ''}`}
            onClick={() => handleModeChange('url')}
          >
            🔗 {dt('m1.tab_url')}
          </button>
          <button
            type="button"
            role="tab"
            id="m1-tab-message"
            aria-selected={mode === 'message'}
            className={`m1-tab-btn ${mode === 'message' ? 'active' : ''}`}
            onClick={() => handleModeChange('message')}
          >
            💬 {dt('m1.tab_message')}
          </button>
          <button
            type="button"
            role="tab"
            id="m1-tab-email"
            aria-selected={mode === 'email'}
            className={`m1-tab-btn ${mode === 'email' ? 'active' : ''}`}
            onClick={() => handleModeChange('email')}
          >
            ✉️ {dt('m1.tab_email')}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            run()
          }}
          noValidate
        >
          {mode === 'url' ? (
            <div className="field">
              <label htmlFor="m1-in">{dt('m1.label')}</label>
              <p className="field-hint">{dt('m1.input_help')}</p>
              <div className="row wrap">
                <input
                  id="m1-in"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={dt('m1.ph')}
                  autoComplete="off"
                  spellCheck="false"
                  autoCapitalize="none"
                  aria-describedby="m1-err"
                  aria-invalid={res?.error ? 'true' : undefined}
                />
                <button className="btn primary-action" type="submit" disabled={ctiLoading}>
                  {ctiLoading ? '⏳ ' + dt('c.loading') : '🔍 ' + dt('m1.analyze_btn')}
                </button>
                {input && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={handleClear}
                    aria-label={dt('m1.clear')}
                    disabled={ctiLoading}
                  >
                    ✕ {dt('c.clear')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="m1-text-in">
                {mode === 'message' ? dt('m1.label_message') : dt('m1.label_email')}
              </label>
              <p className="field-hint">
                {mode === 'message' ? dt('m1.input_help_message') : dt('m1.input_help_email')}
              </p>
              <textarea
                id="m1-text-in"
                className="m1-textarea"
                rows={5}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={mode === 'message' ? dt('m1.ph_message') : dt('m1.ph_email')}
                spellCheck="false"
                maxLength={4096}
                aria-describedby="m1-err m1-char-info"
                aria-invalid={res?.error ? 'true' : undefined}
              />
              <div id="m1-char-info" className="m1-char-info">
                <span>{dt('m1.char_limit_note')}</span>
                <span>{input.length} / 4096 {dt('m1.char_count')}</span>
              </div>
              <div className="row wrap" style={{ marginTop: '10px' }}>
                <button className="btn primary-action" type="submit">
                  🔍 {mode === 'message' ? dt('m1.analyze_btn_message') : dt('m1.analyze_btn_email')}
                </button>
                {input && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={handleClear}
                    aria-label={dt('m1.clear')}
                  >
                    ✕ {dt('c.clear')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Privacy Consent & CTI Provider Toggle (Available in URL mode) */}
          {mode === 'url' && (
            <div className="cti-consent-box">
              <label className="cti-toggle-label" htmlFor="m1-cti-toggle">
                <input
                  type="checkbox"
                  id="m1-cti-toggle"
                  checked={onlineCtiEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked
                    setOnlineCtiEnabled(enabled)
                    if (!enabled) {
                      setCtiResult(null)
                    }
                  }}
                />
                <span className="cti-toggle-title">🌐 {dt('m1.cti_toggle_label')}</span>
              </label>
              <p className="small cti-privacy-notice">
                🔒 {dt('m1.cti_privacy_notice')}
              </p>
              <p className="small cti-commercial-notice">
                ℹ️ {dt('m1.cti_commercial_notice')}
              </p>
            </div>
          )}
        </form>

        {/* Educational Examples for each mode */}
        <div className="examples-bar">
          <span className="small examples-title">
            {mode === 'url'
              ? dt('m1.ex')
              : mode === 'message'
              ? dt('m1.ex_message')
              : dt('m1.ex_email')}
            :
          </span>
          <div className="row wrap examples-pills">
            {mode === 'url' &&
              URL_EXAMPLES.map((u) => (
                <button
                  key={u}
                  type="button"
                  className="btn ghost example-btn"
                  onClick={() => {
                    setInput(u)
                    run(u)
                  }}
                  disabled={ctiLoading}
                >
                  {u}
                </button>
              ))}

            {mode === 'message' &&
              MESSAGE_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  className="btn ghost example-btn"
                  style={{ fontFamily: 'inherit' }}
                  onClick={() => {
                    setInput(ex.text)
                    run(ex.text)
                  }}
                >
                  {ex.label}
                </button>
              ))}

            {mode === 'email' &&
              EMAIL_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  className="btn ghost example-btn"
                  style={{ fontFamily: 'inherit' }}
                  onClick={() => {
                    setInput(ex.text)
                    run(ex.text)
                  }}
                >
                  {ex.label}
                </button>
              ))}
          </div>
        </div>

        <div id="m1-err" role="alert">
          {res?.error && (
            <p className="msg error">
              <span aria-hidden="true">⚠️ </span>
              {dt('m1.err.' + res.error)}
            </p>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {res && !res.error && (() => {
          const verdict = getCombinedVerdict()
          return (
            <div className={`m1-result-panel ${res.isDocAddress ? 'lvl-doc' : `lvl-${res.level}`}`} role="region" aria-label="Analysis Results">
              {/* Finding Sources Attribution Bar */}
              <div className="m1-sources-bar">
                <div className="m1-source-pill source-local">
                  <span className="source-dot active" aria-hidden="true">●</span>
                  <span>
                    <strong>{dt('m1.cti_source_local')}</strong>:{' '}
                    {mode !== 'url'
                      ? (res.level === 'none' ? dt('m1.lvl.none') : dt('m1.cti_status_suspicious'))
                      : res.isDocAddress
                      ? dt('m1.verdict_doc_ip')
                      : res.level === 'none'
                      ? dt('m1.lvl.none')
                      : dt('m1.cti_status_suspicious')}
                  </span>
                </div>
                {mode === 'url' && (
                  <div className={`m1-source-pill source-cti ${onlineCtiEnabled && (ctiResult || ctiLoading) ? 'active' : 'disabled'}`}>
                    <span
                      className={`source-dot ${
                        !onlineCtiEnabled || (!ctiResult && !ctiLoading)
                          ? 'muted'
                          : ctiLoading
                          ? 'active'
                          : ctiResult?.status === 'known_malicious'
                          ? 'danger'
                          : ctiResult?.status === 'unavailable'
                          ? 'muted'
                          : 'active'
                      }`}
                      aria-hidden="true"
                    >
                      ●
                    </span>
                    <span>
                      <strong>{getCtiSourceLabel()}</strong>:{' '}
                      {!onlineCtiEnabled || (!ctiResult && !ctiLoading)
                        ? dt('m1.cti_status_not_requested')
                        : ctiLoading
                        ? dt('c.loading')
                        : ctiResult?.status === 'known_malicious'
                        ? dt('m1.cti_status_malicious')
                        : ctiResult?.status === 'no_threat_found'
                        ? dt('m1.cti_status_clean')
                        : dt('m1.cti_status_unavailable')}
                    </span>
                  </div>
                )}
                {mode === 'url' && res.ml && (
                  <div className={`m1-source-pill source-ml ${res.ml.predictedClass === 'phishing' ? 'active-phishing' : 'active'}`}>
                    <span className={`source-dot ${res.ml.predictedClass === 'phishing' ? 'danger' : 'active'}`} aria-hidden="true">
                      ●
                    </span>
                    <span>
                      <strong>{dt('m1.ml_source_label')}</strong>:{' '}
                      {res.ml.predictedClass === 'phishing'
                        ? `${dt('m1.ml_predicted_phishing')} (${formatModelScore(res.ml.phishingProbability)})`
                        : `${dt('m1.ml_predicted_legit')} (${formatModelScore(res.ml.phishingProbability)})`}
                    </span>
                  </div>
                )}
              </div>

              {/* Unified Coherent Final Assessment Card */}
              {verdict && (
                <div className={`m1-verdict-card ${verdict.badgeClass}`} role="region" aria-label="Final Assessment">
                  <div className="verdict-header">
                    <span className="verdict-icon" aria-hidden="true">{verdict.icon}</span>
                    <div className="verdict-title-group">
                      <span className="verdict-tag">{dt('m1.verdict_title')}</span>
                      <h2 className="verdict-heading">{verdict.title}</h2>
                    </div>
                  </div>
                  <p className="verdict-description">{verdict.description}</p>

                  {/* Threat pills if known malicious */}
                  {ctiResult?.status === 'known_malicious' && ctiResult.threat_types?.length > 0 && (
                    <div className="row wrap cti-threat-pills">
                      {ctiResult.threat_types.map((tt) => (
                        <span key={tt} className="threat-pill">⚠️ {tt}</span>
                      ))}
                    </div>
                  )}

                  {/* Checked timestamps */}
                  {ctiResult?.checked_at && (
                    <p className="small cti-timestamp">
                      🕒 {dt('m1.cti_checked_at')}: {new Date(ctiResult.checked_at).toLocaleTimeString()}
                      {ctiResult.feed_updated_at && (
                        <span> ({dt('m1.cti_feed_updated')}: {ctiResult.feed_updated_at})</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* CTI Threat Intelligence Card (when enabled in URL mode) */}
              {mode === 'url' && onlineCtiEnabled && (ctiLoading || ctiResult) && (
                <div className="m1-cti-section">
                  {ctiLoading && (
                    <div className="m1-cti-card cti-loading" role="status">
                      <span className="spinner-icon" aria-hidden="true">⏳</span>
                      <span>{dt('m1.cti_loading')}</span>
                    </div>
                  )}

                  {!ctiLoading && ctiResult?.status === 'known_malicious' && (
                    <div className="m1-cti-card cti-malicious" role="alert">
                      <div className="cti-card-header">
                        <span className="cti-icon" aria-hidden="true">🛑</span>
                        <div>
                          <span className="cti-source-tag">{getCtiSourceLabel()}</span>
                          <h3 className="cti-title">{dt('m1.cti_status_malicious')}</h3>
                        </div>
                      </div>
                      <p className="cti-body-text">{dt('m1.cti_status_malicious_desc')}</p>
                      {ctiResult.details && <p className="small cti-details-text">{ctiResult.details}</p>}
                    </div>
                  )}

                  {!ctiLoading && ctiResult?.status === 'no_threat_found' && (
                    <div className="m1-cti-card cti-clean" role="region" aria-label="Online Threat Intelligence Result">
                      <div className="cti-card-header">
                        <span className="cti-icon" aria-hidden="true">ℹ️</span>
                        <div>
                          <span className="cti-source-tag">{getCtiSourceLabel()}</span>
                          <h3 className="cti-title">{dt('m1.cti_status_clean')}</h3>
                        </div>
                      </div>
                      <p className="cti-body-text">{dt('m1.cti_status_clean_desc')}</p>
                    </div>
                  )}

                  {!ctiLoading && ctiResult?.status === 'unavailable' && (
                    <div className="m1-cti-card cti-unavailable" role="region" aria-label="Online Threat Intelligence Result">
                      <div className="cti-card-header">
                        <span className="cti-icon" aria-hidden="true">⚠️</span>
                        <div>
                          <span className="cti-source-tag">{getCtiSourceLabel()}</span>
                          <h3 className="cti-title">{dt('m1.cti_status_unavailable')}</h3>
                        </div>
                      </div>
                      <p className="cti-body-text">
                        {dt('m1.cti_status_unavailable_desc')}
                        {ctiResult.unavailable_reason && (
                          <span> ({getUnavailableReasonText()})</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Scope of Verification (What was & was not checked) */}
              <div className="m1-scope-box" aria-labelledby="m1-scope-heading">
                <h3 id="m1-scope-heading" className="m1-scope-heading">
                  🔎 {dt('m1.scope_title')}
                </h3>
                {mode === 'url' ? (
                  <ul className="m1-scope-list" role="list">
                    <li className="scope-item checked">
                      <span className="scope-icon" aria-hidden="true">✓</span>
                      <span>{dt('m1.scope_heur')}</span>
                    </li>
                    <li className="scope-item checked">
                      <span className="scope-icon" aria-hidden="true">⚡</span>
                      <span>{dt('m1.scope_ml_lexical')}</span>
                    </li>
                    <li className={`scope-item ${onlineCtiEnabled && (ctiResult || ctiLoading) ? (ctiResult?.status === 'unavailable' ? 'warning' : 'checked') : 'muted'}`}>
                      <span className="scope-icon" aria-hidden="true">
                        {!onlineCtiEnabled || (!ctiResult && !ctiLoading) ? '○' : ctiResult?.status === 'unavailable' ? '⚠️' : '✓'}
                      </span>
                      <span>
                        {!onlineCtiEnabled || (!ctiResult && !ctiLoading)
                          ? dt('m1.scope_cti_off_item')
                          : ctiResult?.status === 'unavailable'
                          ? dt('m1.scope_cti_unavail_item')
                          : dt('m1.scope_cti_queried')}
                      </span>
                    </li>
                    <li className="scope-item notice">
                      <span className="scope-icon" aria-hidden="true">🔒</span>
                      <span>{dt('m1.scope_no_fetch')}</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="m1-scope-list" role="list">
                    <li className="scope-item checked">
                      <span className="scope-icon" aria-hidden="true">✓</span>
                      <span>{dt('m1.scope_txt_rules')}</span>
                    </li>
                    <li className="scope-item notice">
                      <span className="scope-icon" aria-hidden="true">🔒</span>
                      <span>{dt('m1.scope_no_content_leak')}</span>
                    </li>
                    <li className="scope-item notice">
                      <span className="scope-icon" aria-hidden="true">🔒</span>
                      <span>{dt('m1.scope_extracted_no_fetch')}</span>
                    </li>
                  </ul>
                )}
              </div>

              {/* M1 ML Lexical Classifier Card (Offline In-Browser) */}
              {mode === 'url' && res.ml && (
                <div className="card m1-ml-card" role="region" aria-label={dt('m1.ml_card_title')}>
                  <div className="m1-ml-header">
                    <div className="row items-center gap-2">
                      <span className="m1-ml-badge">⚡ {dt('m1.ml_badge')}</span>
                      <h3 className="m1-ml-title">{dt('m1.ml_card_title')}</h3>
                    </div>
                    <span className="small text-muted">{res.ml.engine}</span>
                  </div>
                  <div className="m1-ml-body">
                    <div className="m1-ml-stats-row">
                      <div className="m1-ml-stat">
                        <span className="stat-label">{dt('m1.ml_prob_label')}</span>
                        <span className={`stat-val ${res.ml.phishingProbability >= 0.5 ? 'text-danger' : 'text-success'}`}>
                          {formatModelScore(res.ml.phishingProbability)}
                        </span>
                      </div>
                      <div className="m1-ml-stat">
                        <span className="stat-label">{dt('m1.ml_verdict_label')}</span>
                        <span className="stat-val">
                          {res.ml.predictedClass === 'phishing' ? dt('m1.ml_predicted_phishing') : dt('m1.ml_predicted_legit')}
                        </span>
                      </div>
                      <div className="m1-ml-stat">
                        <span className="stat-label">{dt('m1.ml_confidence_label')}</span>
                        <span className="stat-val text-muted" style={{ fontStyle: 'italic', fontSize: '0.92rem' }}>
                          {dt('m1.ml_confidence_uncalibrated')}
                        </span>
                      </div>
                      <div className="m1-ml-stat">
                        <span className="stat-label">{dt('m1.ml_accuracy_label')}</span>
                        <span className="stat-val">92.5%</span>
                        <span className="small text-muted" style={{ display: 'block', fontSize: '0.72rem', marginTop: '2px' }}>
                          {dt('m1.ml_accuracy_sub')}
                        </span>
                      </div>
                    </div>
                    <p className="small m1-ml-disclaimer">
                      ℹ️ {dt('m1.ml_disclaimer')}
                    </p>
                  </div>
                </div>
              )}

              {/* Top result header with severity and visual score */}
              <div className="m1-result-header">
                <div className="m1-status-badge">
                  <span className="m1-status-icon" aria-hidden="true">
                    {res.isDocAddress ? '📝' : LEVEL_ICONS[res.level]}
                  </span>
                  <div>
                    <span className="m1-concern-label">
                      {res.isDocAddress
                        ? dt('m1.doc_fixture_tag')
                        : `${dt('m1.concern_level')} (${dt('m1.cti_source_local')}):`}
                    </span>
                    <h3 className="m1-concern-heading">
                      {res.isDocAddress ? dt('m1.doc_fixture_status') : dt('m1.lvl.' + res.level)}
                    </h3>
                  </div>
                </div>

                {/* Responsive Horizontal Progress Bar Card */}
                <div className="m1-score-card">
                  <div className="m1-score-top">
                    <span className="m1-score-title">{dt('m1.score_label')}:</span>{' '}
                    <span className="m1-score-numeric">
                      <strong>{res.score}</strong> / 100
                    </span>
                  </div>

                  <div
                    className="m1-progress-container"
                    role="progressbar"
                    aria-valuenow={res.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuetext={`${res.score} / 100, ${res.isDocAddress ? dt('m1.doc_fixture_status') : dt('m1.lvl.' + res.level)}`}
                    aria-label={`${dt('m1.score_label')}: ${res.score} / 100`}
                  >
                    <div className="m1-progress-track">
                      <div
                        className={`m1-progress-fill ${res.isDocAddress ? 'lvl-doc' : `lvl-${res.level}`}`}
                        style={{ width: `${Math.max(0, Math.min(100, res.score))}%` }}
                      />
                    </div>
                  </div>

                  <div className="m1-progress-scale" aria-hidden="true">
                    <span className="scale-mark">0</span>
                    <span className="scale-mark">40</span>
                    <span className="scale-mark">100</span>
                  </div>

                  <p className="m1-score-explanation">
                    {dt('m1.score_rule_note')}
                  </p>
                  {res.isDocAddress && (
                    <p className="small" style={{ color: '#6b21a8', marginTop: '6px', fontWeight: '600' }}>
                      ℹ️ {dt('m1.verdict_doc_ip_desc')}
                    </p>
                  )}
                </div>
              </div>

              {/* Target safe text display */}
              <div className="analyzed-target-box">
                <span className="small label-bold">
                  {mode === 'url' ? dt('m1.analyzed_url') : dt('m1.analyzed_text')}:
                </span>
                <div
                  className="target-url-text mono"
                  style={mode !== 'url' ? { whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' } : undefined}
                  tabIndex={0}
                >
                  {res.text || input}
                </div>
                {res.defaulted && (
                  <p className="defaulted-note small">
                    <span aria-hidden="true">ℹ️ </span>
                    {dt('m1.def')}
                  </p>
                )}
              </div>

              {/* Findings or Clean message */}
              {res.level === 'none' ? (
                <div className="m1-clean-box">
                  <p className="clean-lead">✓ {dt('m1.none')}</p>
                </div>
              ) : (
                <div className="m1-findings-section">
                  <h3>
                    🚩 {res.isDocAddress ? dt('m1.doc_found') : dt('m1.found')} ({res.indicators.length}) — {dt('m1.cti_source_local')}
                  </h3>
                  <div className="indicator-cards-list">
                    {res.indicators.map((id) => (
                      <article className="indicator-card" key={id}>
                        <div className="ind-header">
                          <span className="ind-id-tag">{id}</span>
                          <h4 className="ind-title">{dt('m1.ind.' + id)}</h4>
                        </div>
                        <div className="ind-body">
                          <div className="ind-row ind-row-why">
                            <strong className="ind-field-name">{dt('m1.why_label')}:</strong>
                            <span className="ind-field-text">{dt('m1.why.' + id)}</span>
                          </div>
                          <div className="ind-row ind-row-act">
                            <strong className="ind-field-name">{dt('m1.action_label')}:</strong>
                            <span className="ind-field-text">{dt('m1.act.' + id)}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* Embedded URLs Extracted from Text (in message/email mode) */}
              {mode !== 'url' && res.extractedUrls && res.extractedUrls.length > 0 && (
                <div className="m1-extracted-urls-section">
                  <h3>🔗 {dt('m1.extracted_urls_title')} ({res.extractedUrls.length})</h3>
                  <p className="small">{dt('m1.extracted_urls_desc')}</p>
                  <div className="extracted-urls-list">
                    {res.extractedUrls.map((item, idx) => {
                      const cti = extractedUrlCtiResults[idx]
                      const loading = ctiLoadingUrls[idx]
                      return (
                        <div key={idx} className="extracted-url-card">
                          <div className="extracted-url-header">
                            <span className="extracted-url-text mono" tabIndex={0}>{item.rawUrl}</span>
                            <span className={`badge lvl-${item.analysis?.level || 'none'}`}>
                              {dt('m1.lvl.' + (item.analysis?.level || 'none'))}
                            </span>
                          </div>
                          {item.analysis?.indicators && item.analysis.indicators.length > 0 && (
                            <div className="extracted-url-indicators">
                              <span className="small label-bold">{dt('m1.indicators_detected')}:</span>
                              <div className="row wrap" style={{ gap: '6px', marginTop: '4px' }}>
                                {item.analysis.indicators.map((id) => (
                                  <span key={id} className="ind-id-tag small" title={dt('m1.ind.' + id)}>
                                    {id}: {dt('m1.ind.' + id)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="extracted-url-cti-action">
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => handleCheckExtractedUrlCti(item.rawUrl, idx)}
                              disabled={loading}
                            >
                              {loading ? '⏳ ' + dt('c.loading') : '🌐 ' + dt('m1.check_extracted_cti_btn')}
                            </button>
                            {cti && (
                              <span className={`extracted-cti-pill ${cti.status === 'known_malicious' ? 'danger' : cti.status === 'no_threat_found' ? 'clean' : 'muted'}`}>
                                {cti.status === 'known_malicious'
                                  ? '🛑 ' + dt('m1.cti_status_malicious')
                                  : cti.status === 'no_threat_found'
                                  ? '✓ ' + dt('m1.cti_status_clean')
                                  : '⚠️ ' + dt('m1.cti_status_unavailable')}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Safety-First Response for Sensitive Information & High-Risk Messages */}
              {mode !== 'url' && res.indicators && (res.indicators.some((id) => ['TXT-01', 'TXT-04', 'TXT-05', 'TXT-09', 'TXT-10'].includes(id)) || res.level === 'high') && (
                <div className="m1-safety-advisory-card" role="region" aria-label={dt('m1.safety_advisory_title')}>
                  <div className="safety-advisory-header">
                    <span className="safety-advisory-icon" aria-hidden="true">🛡️</span>
                    <h3 className="safety-advisory-title">{dt('m1.safety_advisory_title')}</h3>
                  </div>
                  <p className="safety-advisory-intro">{dt('m1.safety_advisory_intro')}</p>
                  <ul className="safety-advisory-list" role="list">
                    {/* Specific to findings: bank or personal details */}
                    {(res.indicators.includes('TXT-09') || res.indicators.includes('TXT-10')) && (
                      <li>{dt('m1.safety_rec_no_bank_personal')}</li>
                    )}
                    {/* Specific to findings: prize lure or fee demands */}
                    {(res.indicators.includes('TXT-04') || res.indicators.includes('TXT-05')) && (
                      <li>{dt('m1.safety_rec_no_fee')}</li>
                    )}
                    {/* Specific to findings: independent verification */}
                    <li>{dt('m1.safety_rec_verify_official')}</li>
                    {/* Secrets/credentials: distinct warning if detected, or general reminder if not */}
                    {res.indicators.includes('TXT-01') ? (
                      <li>{dt('m1.safety_rec_no_secrets_detected')}</li>
                    ) : (
                      <li>{dt('m1.safety_rec_no_secrets_general')}</li>
                    )}
                    {/* Only if links/APKs actually detected in text */}
                    {(res.indicators.includes('TXT-06') || res.indicators.includes('TXT-07')) && (
                      <li>{dt('m1.safety_rec_no_links_apks')}</li>
                    )}
                    {/* Strictly conditional escalation guidance */}
                    <li>{dt('m1.safety_rec_if_compromised')}</li>
                  </ul>
                </div>
              )}

              {/* Recommended Next Steps */}
              <div className="m1-next-steps-card">
                <h3>🛡️ {dt('m1.next_steps')}</h3>
                <p className="rec-text">{verdict ? verdict.nextSteps : dt('m1.rec_' + res.level)}</p>
              </div>

              {/* Crucial Heuristic Boundary & Limitations Notice */}
              <div className="m1-limitations-box">
                <p className="caveat-strong">
                  <span aria-hidden="true">⚠️ </span>
                  {dt('m1.caveat')}
                </p>
                <p className="small">
                  {mode === 'url' ? dt('m1.limits') : mode === 'email' ? dt('m1.limits_email') : dt('m1.limits_txt')}
                </p>
                {mode === 'url' && (
                  <p className="small">
                    {onlineCtiEnabled && (ctiResult || ctiLoading) ? dt('m1.heur_online') : dt('m1.heur_offline')}
                  </p>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </section>
  )
}
