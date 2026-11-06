import { useState, useEffect } from 'react'
import {
  getMe,
  loginUser,
  registerUser,
  logoutUser,
  changePassword,
  updatePreferences,
  getProgress,
  saveProgress,
} from '../lib/api.js'
import { getJourneyProgress } from '../lib/journey.js'
import { UserRoundIcon, LogInIcon, UserPlusIcon, ShieldCheckIcon, AbbayLogo } from './Icons.jsx'

export default function Account({ t, user, setUser, onSyncProgress, initialTab }) {
  const getTabFromHash = () => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash || ''
      if (h.includes('register') || h.includes('mode=register') || h.includes('tab=register')) {
        return 'register'
      }
    }
    return initialTab || 'login'
  }
  const [tab, setTab] = useState(getTabFromHash)

  useEffect(() => {
    const handleHash = () => {
      const h = (typeof window !== 'undefined' ? window.location.hash : '') || ''
      if (h.includes('register') || h.includes('mode=register') || h.includes('tab=register')) {
        setTab('register')
      } else if (h.includes('login') || h.includes('mode=login') || h.includes('tab=login')) {
        setTab('login')
      }
    }
    window.addEventListener('hashchange', handleHash)
    handleHash()
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Form states
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Cloud sync state for signed in user
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(
    user?.preferences?.cloud_progress_sync_enabled || false
  )
  const [syncLoading, setSyncLoading] = useState(false)
  const [cloudProgressData, setCloudProgressData] = useState(null)

  // Password change state for signed in user
  const [currPassword, setCurrPassword] = useState('')
  const [newPasswordVal, setNewPasswordVal] = useState('')
  const [confirmNewPasswordVal, setConfirmNewPasswordVal] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState('')

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwdLoading) return
    setPwdError('')
    setPwdSuccess('')

    if (!currPassword) {
      setPwdError(t('auth.err_curr_pwd'))
      return
    }
    if (newPasswordVal.length < 8 || newPasswordVal.length > 128 || !/[A-Za-z]/.test(newPasswordVal) || !/[0-9]/.test(newPasswordVal)) {
      setPwdError(t('auth.err_pwd_policy'))
      return
    }
    if (newPasswordVal !== confirmNewPasswordVal) {
      setPwdError(t('auth.err_pwd_mismatch'))
      return
    }
    if (newPasswordVal === currPassword) {
      setPwdError(t('auth.err_same_pwd'))
      return
    }

    setPwdLoading(true)
    try {
      await changePassword({
        currentPassword: currPassword,
        newPassword: newPasswordVal,
        confirmPassword: confirmNewPasswordVal,
      })
      setPwdSuccess(t('auth.pwd_changed'))
      setCurrPassword('')
      setNewPasswordVal('')
      setConfirmNewPasswordVal('')
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') {
        setPwdError(t('auth.err_curr_pwd'))
      } else if (err.code === 'NEW_PASSWORD_SAME_AS_OLD') {
        setPwdError(t('auth.err_same_pwd'))
      } else if (
        err.code === 'PASSWORD_POLICY_VIOLATION' ||
        err.code === 'INVALID_REQUEST' ||
        err.status === 422 ||
        (err.status === 400 && err.code !== 'NEW_PASSWORD_SAME_AS_OLD')
      ) {
        setPwdError(t('auth.err_pwd_policy'))
      } else if (err.code === 'UNAUTHORIZED' || err.status === 401) {
        setPwdError(t('auth.err_session_expired') || t('auth.err_generic'))
      } else if (err.code === 'TOO_MANY_REQUESTS' || err.status === 429) {
        setPwdError(t('auth.err_rate_limit'))
      } else if (err.code === 'REQUEST_TIMEOUT' || err.status === 504) {
        setPwdError(t('auth.err_timeout'))
      } else {
        setPwdError(t('auth.err_generic'))
      }
    } finally {
      setPwdLoading(false)
    }
  }

  useEffect(() => {
    if (user?.preferences) {
      setCloudSyncEnabled(user.preferences.cloud_progress_sync_enabled || false)
    }
  }, [user])

  useEffect(() => {
    let active = true
    if (user && cloudSyncEnabled) {
      getProgress()
        .then((res) => {
          if (active) {
            setCloudProgressData(res?.progress || null)
          }
        })
        .catch(() => {
          if (active) setCloudProgressData(null)
        })
    } else {
      setCloudProgressData(null)
    }
    return () => {
      active = false
    }
  }, [user, cloudSyncEnabled])

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setErrorMsg('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (loading) return
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    try {
      const data = await loginUser({ email, password })
      setUser(data.user)
      resetForm()
      setSuccessMsg(t('auth.login_title') + ' - ' + t('c.copied').replace('.', ''))
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') {
        setErrorMsg(t('auth.err_bad_creds'))
      } else if (err.code === 'TOO_MANY_REQUESTS') {
        setErrorMsg(t('auth.err_rate_limit'))
      } else if (err.code === 'REQUEST_TIMEOUT') {
        setErrorMsg(t('auth.err_timeout'))
      } else if (err.code === 'INVALID_REQUEST') {
        setErrorMsg(t('auth.err_bad_creds'))
      } else {
        setErrorMsg(t('auth.err_generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (loading) return
    setErrorMsg('')
    setSuccessMsg('')

    if (password !== confirmPassword) {
      setErrorMsg(t('auth.err_pwd_mismatch'))
      return
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMsg(t('auth.err_pwd_policy'))
      return
    }

    setLoading(true)
    try {
      const data = await registerUser({
        displayName,
        email,
        password,
        confirmPassword,
      })
      setUser(data.user)
      resetForm()
      setDisplayName('')
    } catch (err) {
      if (err.code === 'EMAIL_ALREADY_EXISTS') {
        setErrorMsg(t('auth.err_email_taken'))
      } else if (err.code === 'TOO_MANY_REQUESTS') {
        setErrorMsg(t('auth.err_rate_limit'))
      } else if (err.code === 'REQUEST_TIMEOUT') {
        setErrorMsg(t('auth.err_timeout'))
      } else if (err.code === 'INVALID_REQUEST') {
        setErrorMsg(t('auth.err_pwd_policy'))
      } else {
        setErrorMsg(t('auth.err_generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)
    try {
      await logoutUser()
      setUser(null)
      setCloudProgressData(null)
      resetForm()
    } finally {
      setLoading(false)
    }
  }

  const handleToggleCloudSync = async () => {
    if (syncLoading || !user) return
    const nextState = !cloudSyncEnabled
    setSyncLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await updatePreferences({ cloud_progress_sync_enabled: nextState })
      setCloudSyncEnabled(res.cloud_progress_sync_enabled)
      setUser((prev) =>
        prev
          ? {
              ...prev,
              preferences: {
                ...prev.preferences,
                cloud_progress_sync_enabled: res.cloud_progress_sync_enabled,
              },
            }
          : null
      )
      setSuccessMsg(t('auth.sync_success'))

      // If enabling, check whether cloud progress already exists in database
      if (nextState) {
        try {
          const p = await getProgress()
          setCloudProgressData(p?.progress || null)
        } catch {
          setCloudProgressData(null)
        }
      } else {
        setCloudProgressData(null)
      }
    } catch {
      setErrorMsg(t('auth.err_generic'))
    } finally {
      setSyncLoading(false)
    }
  }

  const handleManualSync = async () => {
    if (!cloudSyncEnabled || syncLoading) return
    setSyncLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      if (onSyncProgress) {
        await onSyncProgress()
      } else {
        const localProg = getJourneyProgress() || {}
        await saveProgress({
          activeLevel: localProg.activeLevel || 1,
          unlockedLevels: localProg.unlockedLevels || [1],
          completedLevels: localProg.completedLevels || {},
        })
      }
      const res = await getProgress()
      if (res?.progress) {
        setCloudProgressData(res.progress)
      }
      setSuccessMsg(t('auth.synced_just_now'))
    } catch {
      setErrorMsg(t('auth.err_generic'))
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <div className="account-container" aria-labelledby="account-page-title">
      <header className="module-header account-header">
        <div className="module-tag module-tag-m4">
          <ShieldCheckIcon size={16} /> <span>{user ? t('auth.mode_signed_in') : t('auth.mode_guest')}</span>
        </div>
        <h1 id="account-page-title">{t('auth.profile_title')}</h1>
        <p className="account-intro">
          {user
            ? `${t('auth.mode_signed_in')} : ${user.display_name} (${user.email})`
            : t('auth.guest_desc')}
        </p>
      </header>

      {errorMsg && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">⚠️ </span>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" role="status">
          <ShieldCheckIcon size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {user ? (
        /* Authenticated Account View */
        <div className="account-grid">
          {/* Account Profile Summary Card */}
          <section className="card account-card" aria-labelledby="summary-title">
            <div className="card-header">
              <span className="tool-icon" aria-hidden="true">
                <UserRoundIcon size={24} />
              </span>
              <h2 id="summary-title">{t('auth.account_summary')}</h2>
            </div>

            <div className="account-details-list">
              <div className="detail-row">
                <span className="detail-label">{t('auth.display_name')}:</span>
                <span className="detail-val font-semibold">{user.display_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t('auth.email')}:</span>
                <span className="detail-val">{user.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t('auth.member_since')}:</span>
                <span className="detail-val">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className="badge badge-success">
                  <span className="status-dot-active" aria-hidden="true"></span>
                  {t('auth.status_active')}
                </span>
              </div>
            </div>

            <div className="account-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleLogout}
                disabled={loading}
              >
                <LogInIcon size={18} /> {loading ? t('c.loading') : t('auth.logout')}
              </button>
            </div>
          </section>

          {/* Cloud Progress Synchronization Card */}
          <section className="card account-card sync-card" aria-labelledby="sync-title">
            <div className="card-header">
              <span className="tool-icon" aria-hidden="true">
                <ShieldCheckIcon size={24} />
              </span>
              <h2 id="sync-title">{t('auth.sync_title')}</h2>
            </div>

            <p className="small text-muted">
              {cloudSyncEnabled
                ? t('auth.sync_desc_on') || t('auth.sync_desc')
                : t('auth.sync_desc_off') || t('auth.sync_desc')}
            </p>

            {/* Privacy & Consent Notice Box */}
            <div className="privacy-notice-box" role="region" aria-label="Privacy Guarantees">
              <div className="notice-point point-allowed">
                <span className="notice-icon" aria-hidden="true">✓</span>
                <span>{t('auth.sync_explain_saved')}</span>
              </div>
              <div className="notice-point point-blocked">
                <span className="notice-icon" aria-hidden="true">✕</span>
                <span>{t('auth.sync_explain_never')}</span>
              </div>
            </div>

            {/* Toggle Status */}
            <div className="sync-status-indicator">
              <div
                className={`sync-badge ${
                  cloudSyncEnabled ? 'sync-badge-active' : 'sync-badge-inactive'
                }`}
              >
                <span
                  className={cloudSyncEnabled ? 'status-dot-active' : 'status-dot-inactive'}
                  aria-hidden="true"
                ></span>
                <span>
                  {cloudSyncEnabled
                    ? cloudProgressData
                      ? t('auth.sync_status_on')
                      : t('auth.sync_status_pending')
                    : t('auth.sync_status_off')}
                </span>
              </div>
            </div>

            {cloudSyncEnabled && cloudProgressData && (
              <div className="cloud-stats-panel">
                <h4>☁️ Saved Cloud Progress</h4>
                <div className="stats-badges">
                  <span className="pill">
                    Active Level: <strong>{cloudProgressData.active_level}</strong>
                  </span>
                  <span className="pill">
                    Unlocked:{' '}
                    <strong>
                      {Array.isArray(cloudProgressData.unlocked_levels)
                        ? cloudProgressData.unlocked_levels.join(', ')
                        : '1'}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            <div className="sync-actions-row">
              <button
                type="button"
                className={`btn ${cloudSyncEnabled ? 'ghost' : 'btn-primary'}`}
                onClick={handleToggleCloudSync}
                disabled={syncLoading}
              >
                {syncLoading
                  ? t('c.loading')
                  : cloudSyncEnabled
                  ? t('auth.sync_toggle_disable')
                  : t('auth.sync_toggle_enable')}
              </button>

              {cloudSyncEnabled && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleManualSync}
                  disabled={syncLoading}
                >
                  🔄 {t('auth.sync_now')}
                </button>
              )}
            </div>
          </section>

          {/* Change Password Card */}
          <section className="card account-card change-password-card" aria-labelledby="change-pwd-title">
            <div className="card-header">
              <span className="tool-icon" aria-hidden="true">
                <ShieldCheckIcon size={24} />
              </span>
              <h2 id="change-pwd-title">{t('auth.change_pwd_title')}</h2>
            </div>

            <p className="small text-muted">{t('auth.pwd_hint')}</p>

            {pwdError && (
              <div className="alert alert-error" role="alert">
                <span aria-hidden="true">⚠️ </span>
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="alert alert-success" role="status">
                <ShieldCheckIcon size={18} />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="current-password-input" className="form-label">
                  {t('auth.curr_pwd')}
                </label>
                <input
                  id="current-password-input"
                  type="password"
                  className="form-input"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={pwdLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-password-input" className="form-label">
                  {t('auth.new_pwd')}
                </label>
                <input
                  id="new-password-input"
                  type="password"
                  className="form-input"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={pwdLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm-new-password-input" className="form-label">
                  {t('auth.confirm_new_pwd')}
                </label>
                <input
                  id="confirm-new-password-input"
                  type="password"
                  className="form-input"
                  value={confirmNewPasswordVal}
                  onChange={(e) => setConfirmNewPasswordVal(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={pwdLoading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={pwdLoading}
              >
                <ShieldCheckIcon size={18} />
                <span>{pwdLoading ? t('c.loading') : t('auth.btn_change_pwd')}</span>
              </button>
            </form>
          </section>
        </div>
      ) : (
        /* Guest / Unauthenticated Form View */
        <div className="auth-forms-container">
          <div className="auth-brand-badge">
            <AbbayLogo size={36} />
            <span className="auth-brand-title">ABBAY CYBERGUARD</span>
          </div>

          <div className="auth-tab-bar" role="tablist" aria-label="Authentication Options">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setTab('login')
                setErrorMsg('')
                setSuccessMsg('')
              }}
            >
              <LogInIcon size={18} />
              <span>{t('auth.login_title') || 'Sign in'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => {
                setTab('register')
                setErrorMsg('')
                setSuccessMsg('')
              }}
            >
              <UserPlusIcon size={18} />
              <span>{t('auth.register_title') || 'Create account'}</span>
            </button>
          </div>

          <div className="card auth-card">
            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="auth-form" noValidate>
                <div className="auth-card-head">
                  <LogInIcon size={24} className="auth-card-icon" />
                  <h2>{t('auth.login_title') || 'Sign in'}</h2>
                </div>
                <p className="auth-card-subtitle small text-muted">
                  Access your synchronized offline progress and security telemetry.
                </p>

                <div className="form-group">
                  <label htmlFor="login-email">{t('auth.email')}</label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    className="input-field"
                    placeholder="name@example.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="login-password">{t('auth.password')}</label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="input-field"
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary w-full auth-submit-btn" disabled={loading}>
                    <LogInIcon size={18} />
                    <span>{loading ? t('c.loading') : (t('auth.login') || 'Sign in')}</span>
                  </button>
                </div>

                <p className="auth-switch-note">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setTab('register')
                      setErrorMsg('')
                    }}
                  >
                    <UserPlusIcon size={16} /> {t('auth.no_account')}
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="auth-form" noValidate>
                <div className="auth-card-head">
                  <UserPlusIcon size={24} className="auth-card-icon" />
                  <h2>{t('auth.register_title') || 'Create account'}</h2>
                </div>
                <p className="auth-card-subtitle small text-muted">
                  Create an encrypted local profile. Zero telemetry; your passwords never leave your device.
                </p>

                <div className="form-group">
                  <label htmlFor="reg-name">{t('auth.display_name')}</label>
                  <input
                    id="reg-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    maxLength={100}
                    className="input-field"
                    placeholder="Abebe Bikila"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-email">{t('auth.email')}</label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    className="input-field"
                    placeholder="name@example.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-password">{t('auth.password')}</label>
                  <input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="input-field"
                    placeholder="••••••••"
                  />
                  <p className="small text-muted">{t('auth.pwd_hint')}</p>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-confirm">{t('auth.confirm_password')}</label>
                  <input
                    id="reg-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="input-field"
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary w-full auth-submit-btn" disabled={loading}>
                    <UserPlusIcon size={18} />
                    <span>{loading ? t('c.loading') : (t('auth.register') || 'Create account')}</span>
                  </button>
                </div>

                <p className="auth-switch-note">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setTab('login')
                      setErrorMsg('')
                    }}
                  >
                    <LogInIcon size={16} /> {t('auth.have_account')}
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
