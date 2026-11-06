import { useState, useRef, useEffect } from 'react'
import { analyze, generate } from '../lib/m2.js'
import { awardM2PracticeCompletion, getJourneyProgress } from '../lib/journey.js'

const CL = ['lower', 'upper', 'digits', 'symbols']

export default function M2({ t, onNavigate }) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [length, setLength] = useState(16)
  const [classes, setClasses] = useState({ lower: true, upper: true, digits: true, symbols: true })
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false)
  const [out, setOut] = useState('')
  const [showGen, setShowGen] = useState(true)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')
  const copyTimeoutRef = useRef(null)

  // Interactive Educational Practice State (Fictional Scenario)
  const [practiceChoice, setPracticeChoice] = useState(null)
  const [practiceSubmitted, setPracticeSubmitted] = useState(false)
  const [practiceReward, setPracticeReward] = useState(null)
  const [isPracticeCompleted, setIsPracticeCompleted] = useState(() => {
    try {
      const p = getJourneyProgress()
      return Boolean(p?.m2Practice?.completed)
    } catch {
      return false
    }
  })

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const r = analyze(pw)

  const gen = () => {
    setCopied('')
    try {
      const len = Math.min(64, Math.max(12, Number(length) || 16))
      setOut(generate({ length: len, classes, excludeAmbiguous }))
      setErr('')
    } catch (e) {
      setOut('')
      if (e.message === 'length') setErr('m2.err.length')
      else if (e.message === 'nocrypto') setErr('m2.err.nocrypto')
      else setErr('m2.err.noclass')
    }
  }

  const copy = async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('clipboard_unsupported')
      }
      await navigator.clipboard.writeText(out)
      setCopied('m2.copied_success')
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(''), 4000)
    } catch {
      setCopied('m2.copy_failed')
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(''), 4000)
    }
  }

  const handleSelectPracticeChoice = (choiceId) => {
    setPracticeChoice(choiceId)
    setPracticeSubmitted(true)
    if (choiceId === 'opt_b') {
      const res = awardM2PracticeCompletion()
      setPracticeReward(res)
      setIsPracticeCompleted(true)
    }
  }

  return (
    <section className="module-container">
      <div className="module-header-box">
        <div className="module-header-content">
          <span className="module-tag module-tag-m2">M2 LOCAL CRYPTO TOOLS</span>
          <h1>🔑 {t('m2.title')}</h1>
          <div className="security-note">
            <span aria-hidden="true">🔒</span>
            <span>{t('m2.check')}</span>
          </div>
          <div className="module-assistant-shortcut">
            <button
              type="button"
              className="btn btn-sm btn-assistant-help"
              onClick={() => onNavigate ? onNavigate('#/assistant?context=m2') : (window.location.hash = '#/assistant?context=m2')}
              title={t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
            >
              🤖 {t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
            </button>
          </div>
        </div>
        <div className="module-header-artwork">
          <img
            src="/images/journey/m2_password_vault.svg"
            alt={t('m2.artwork_alt')}
            className="module-artwork-badge"
            loading="lazy"
          />
        </div>
      </div>

      {/* 1. Password Strength Evaluator */}
      <div className="card">
        <h2>{t('m2.check')}</h2>
        <div className="field">
          <label htmlFor="m2-pw">{t('m2.label')}</label>
          <div className="row wrap">
            <input
              id="m2-pw"
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="off"
              spellCheck="false"
              placeholder={t('m2.placeholder_input') || 'Enter a password to inspect...'}
            />
            <button
              className="btn ghost"
              type="button"
              aria-pressed={show}
              onClick={() => setShow(!show)}
            >
              {show ? `👁️ ${t('c.hide')}` : `👁️ ${t('c.show')}`}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setPw('')
                setShow(false)
              }}
            >
              ✕ {t('c.clear')}
            </button>
          </div>
        </div>

        <div aria-live="polite">
          {r && (
            <div className={`result cat-${r.category}`} style={{ marginTop: '1rem' }}>
              <div className="m2-strength-header">
                <span className="label-bold">{t('m2.cat')}:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span className={`m2-cat-badge cat-${r.category}`}>
                    {r.category === 0 && '🛑 '}
                    {r.category === 1 && '⚠️ '}
                    {r.category === 2 && '⚡ '}
                    {r.category === 3 && '🛡️ '}
                    {t('m2.cat.' + r.category)}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                    {t('m2.score_label')}: <strong>{r.score}/100</strong>
                  </span>
                </div>
              </div>

              <div className="m2-meter-track">
                <div
                  className={`m2-meter-fill cat-${r.category}`}
                  style={{ width: `${Math.max(5, r.score)}%` }}
                />
              </div>

              {r.feedback?.length > 0 && (
                <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
                  {r.feedback.map((f) => (
                    <li key={f} style={{ fontSize: '0.85rem' }}>{t('m2.fb.' + f)}</li>
                  ))}
                </ul>
              )}

              {r.nonAscii && <p className="msg warn" style={{ marginTop: '0.5rem' }}>⚠️ {t('m2.nonascii')}</p>}

              {/* Password Health Card & App Policy Check */}
              <div className="m2-health-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>🛡️ {t('m2.health_title')}</h4>
                  <span className={`m2-cat-badge ${r.meetsAppPolicy ? 'cat-3' : 'cat-0'}`} style={{ fontSize: '0.75rem' }}>
                    {r.meetsAppPolicy ? `✓ ${t('m2.health_app_policy_met')}` : `⚠️ ${t('m2.health_app_policy_failed')}`}
                  </span>
                </div>

                <div className="m2-policy-grid">
                  <div className={`m2-policy-item ${r.policyChecks.minLength ? 'valid' : 'invalid'}`}>
                    <span>{r.policyChecks.minLength ? '✓' : '✗'}</span>
                    <span>{t('m2.policy.min_length')} (≥12)</span>
                  </div>
                  <div className={`m2-policy-item ${r.policyChecks.maxLength ? 'valid' : 'invalid'}`}>
                    <span>{r.policyChecks.maxLength ? '✓' : '✗'}</span>
                    <span>{t('m2.policy.max_length')} (≤128)</span>
                  </div>
                  <div className={`m2-policy-item ${r.policyChecks.hasLetter ? 'valid' : 'invalid'}`}>
                    <span>{r.policyChecks.hasLetter ? '✓' : '✗'}</span>
                    <span>{t('m2.policy.has_letter')}</span>
                  </div>
                  <div className={`m2-policy-item ${r.policyChecks.hasNumber ? 'valid' : 'invalid'}`}>
                    <span>{r.policyChecks.hasNumber ? '✓' : '✗'}</span>
                    <span>{t('m2.policy.has_number')}</span>
                  </div>
                </div>

                {r.riskFactors?.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: '#fca5a5' }}>⚠️ {t('m2.risk_factors_title')}:</strong>
                    <div className="m2-risk-pills">
                      {r.riskFactors.map((rf) => (
                        <span key={rf} className="m2-risk-pill">
                          <span>●</span>
                          <span>{t('m2.risk.' + rf)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {r.recommendations?.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: '#93c5fd' }}>💡 {t('m2.recommendations_title')}:</strong>
                    <ul className="m2-recs-list">
                      {r.recommendations.map((rec) => (
                        <li key={rec}>
                          <span aria-hidden="true">→</span>
                          <span>{t('m2.rec.' + rec)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="m2-entropy-box">
                  <strong>🔢 {t('m2.entropy_label')}: {r.bits} {t('m2.entropy_bits')}</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>{t('m2.entropy_disclaimer')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="small" style={{ marginTop: '0.75rem' }}>{t('m2.guide')}</p>
      </div>

      {/* 2. Password Generator */}
      <div className="card">
        <h2>{t('m2.gen')}</h2>
        <fieldset>
          <legend>{t('m2.gen')}</legend>

          <div className="m2-presets-row">
            <span className="label-bold" style={{ fontSize: '0.8rem', color: '#334155' }}>{t('m2.presets')}:</span>
            {[16, 20, 24, 32].map((p) => (
              <button
                key={p}
                type="button"
                className={`m2-preset-btn ${Number(length) === p ? 'active' : ''}`}
                onClick={() => setLength(p)}
              >
                {t(`m2.preset_${p}`)}
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="m2-len">{t('m2.length')}: <strong>{length}</strong></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              <input
                id="m2-len-range"
                type="range"
                min="12"
                max="64"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="m2-range-slider"
                aria-label={t('m2.length')}
              />
              <input
                id="m2-len"
                type="number"
                min="12"
                max="64"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                onBlur={() => setLength((l) => Math.min(64, Math.max(12, Number(l) || 16)))}
                style={{ width: '70px', textAlign: 'center' }}
              />
            </div>
          </div>

          <div className="row wrap">
            {CL.map((k) => (
              <label key={k} className="check">
                <input
                  type="checkbox"
                  checked={classes[k]}
                  onChange={(e) => setClasses({ ...classes, [k]: e.target.checked })}
                />{' '}
                {t('m2.cls.' + k)}
              </label>
            ))}
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label className="check" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={excludeAmbiguous}
                onChange={(e) => setExcludeAmbiguous(e.target.checked)}
              />{' '}
              <span>{t('m2.cls.ambiguous')}</span>
            </label>
          </div>
        </fieldset>

        <div role="alert">{err && <p className="msg error">⚠️ {t(err)}</p>}</div>

        <div className="field">
          <label htmlFor="m2-out-val">{t('m2.out')}</label>
          <div className="row wrap">
            <input
              id="m2-out-val"
              aria-label={t('m2.out')}
              type={showGen ? 'text' : 'password'}
              value={out}
              readOnly
              spellCheck="false"
              className="mono"
              placeholder="Click 'Generate new' to create a password"
            />
            <button
              className="btn ghost"
              type="button"
              disabled={!out}
              aria-pressed={showGen}
              onClick={() => setShowGen(!showGen)}
              title={showGen ? t('m2.gen_hide') : t('m2.gen_show')}
            >
              {showGen ? `👁️ ${t('c.hide')}` : `👁️ ${t('c.show')}`}
            </button>
            <button className="btn primary-action" type="button" onClick={gen}>
              ⚡ {t('m2.generate')}
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!out}
              onClick={copy}
            >
              📋 {t('c.copy')}
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!out}
              onClick={() => {
                setOut('')
                setCopied('')
                setErr('')
              }}
            >
              ✕ {t('c.clear')}
            </button>
          </div>
        </div>

        <p aria-live="polite" className="small" style={{ minHeight: '1.25rem', color: copied ? '#34d399' : 'inherit' }}>
          {copied && `✓ ${t(copied)}`}
        </p>
        <p className="msg warn">⚠️ {t('m2.clip')}</p>
        <p className="m2-clipboard-note">🔒 {t('m2.clip_limitation')}</p>
        <p className="msg info">ℹ️ {t('m2.nopass')}</p>
      </div>

      {/* 3. Password Safety Coach */}
      <div className="card m2-coach-card">
        <h2>🛡️ {t('m2.coach.title')}</h2>
        <p className="small">{t('m2.coach.subtitle')}</p>
        <div className="m2-coach-grid">
          <div className="m2-coach-item">
            <div className="m2-coach-item-header">
              <span className="m2-coach-icon" aria-hidden="true">🔑</span>
              <h3 className="m2-coach-title">{t('m2.coach.unique_title')}</h3>
            </div>
            <p className="m2-coach-desc">{t('m2.coach.unique_desc')}</p>
          </div>

          <div className="m2-coach-item">
            <div className="m2-coach-item-header">
              <span className="m2-coach-icon" aria-hidden="true">🗄️</span>
              <h3 className="m2-coach-title">{t('m2.coach.manager_title')}</h3>
            </div>
            <p className="m2-coach-desc">{t('m2.coach.manager_desc')}</p>
          </div>

          <div className="m2-coach-item">
            <div className="m2-coach-item-header">
              <span className="m2-coach-icon" aria-hidden="true">📲</span>
              <h3 className="m2-coach-title">{t('m2.coach.mfa_title')}</h3>
            </div>
            <p className="m2-coach-desc">{t('m2.coach.mfa_desc')}</p>
          </div>

          <div className="m2-coach-item">
            <div className="m2-coach-item-header">
              <span className="m2-coach-icon" aria-hidden="true">🤐</span>
              <h3 className="m2-coach-title">{t('m2.coach.noshare_title')}</h3>
            </div>
            <p className="m2-coach-desc">{t('m2.coach.noshare_desc')}</p>
          </div>

          <div className="m2-coach-item">
            <div className="m2-coach-item-header">
              <span className="m2-coach-icon" aria-hidden="true">🚫</span>
              <h3 className="m2-coach-title">{t('m2.coach.predictable_title')}</h3>
            </div>
            <p className="m2-coach-desc">{t('m2.coach.predictable_desc')}</p>
          </div>

          <div className="m2-coach-item">
            <div className="m2-coach-item-header">
              <span className="m2-coach-icon" aria-hidden="true">🚨</span>
              <h3 className="m2-coach-title">{t('m2.coach.compromise_title')}</h3>
            </div>
            <p className="m2-coach-desc">{t('m2.coach.compromise_desc')}</p>
          </div>
        </div>
      </div>

      {/* 4. Cyber Hero Journey Practice Challenge */}
      <div className="card m2-practice-card">
        <h2>🎯 {t('m2.practice.title')}</h2>
        <p className="small">{t('m2.practice.desc')}</p>
        
        <div className="m2-practice-box">
          <div className="m2-practice-scenario">
            <p>{t('m2.practice.scenario')}</p>
          </div>

          <div className="m2-practice-choices" role="radiogroup" aria-label={t('m2.practice.title')}>
            {[
              { id: 'opt_a', labelKey: 'm2.practice.opt_a', isCorrect: false },
              { id: 'opt_b', labelKey: 'm2.practice.opt_b', isCorrect: true },
              { id: 'opt_c', labelKey: 'm2.practice.opt_c', isCorrect: false }
            ].map((opt) => {
              const isSelected = practiceChoice === opt.id
              let btnClass = ''
              if (practiceSubmitted) {
                if (opt.isCorrect) btnClass = 'correct'
                else if (isSelected) btnClass = 'wrong'
              } else if (isSelected) {
                btnClass = 'selected'
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`m2-practice-choice-btn ${btnClass}`}
                  onClick={() => handleSelectPracticeChoice(opt.id)}
                >
                  <span>{t(opt.labelKey)}</span>
                  <span>{isSelected ? '●' : '○'}</span>
                </button>
              )
            })}
          </div>

          {practiceSubmitted && (
            <div style={{ marginTop: '14px' }}>
              {practiceChoice === 'opt_b' ? (
                <div className="msg success" role="alert">
                  ✓ {t('m2.practice.feedback_correct')}
                </div>
              ) : (
                <div className="msg error" role="alert">
                  ⚠️ {t('m2.practice.feedback_wrong')}
                </div>
              )}
            </div>
          )}

          {isPracticeCompleted && (
            <div className="m2-practice-reward-box">
              <span style={{ fontWeight: 600, color: '#047857' }}>
                {practiceReward?.newlyCompleted ? t('m2.practice.awarded') : t('m2.practice.already_done')}
              </span>
              <a href="#/journey" className="btn hero-btn-accent" style={{ fontSize: '0.875rem' }}>
                {t('m2.practice.journey_btn')}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
