import { useState, useRef, useEffect } from 'react'
import {
  UserRoundPlusIcon,
  UserRoundIcon,
  LogInIcon,
  UserPlusIcon,
  LogOutIcon,
  AbbayLogo,
} from './Icons.jsx'

export default function HeaderAccountMenu({
  user,
  onLogout,
  onNavigate,
  t,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  // Close popup when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('touchstart', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [isOpen])

  // Close popup on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleChoice = (mode) => {
    setIsOpen(false)
    if (onNavigate) {
      onNavigate(`#/account?mode=${mode}`)
    } else if (typeof window !== 'undefined') {
      window.location.hash = `#/account?mode=${mode}`
    }
  }

  const handleAccountSettings = () => {
    setIsOpen(false)
    if (onNavigate) {
      onNavigate('#/account')
    } else if (typeof window !== 'undefined') {
      window.location.hash = '#/account'
    }
  }

  const handleSignOutClick = async () => {
    setIsOpen(false)
    if (onLogout) {
      await onLogout()
    }
  }

  const getInitials = (nameOrEmail) => {
    if (!nameOrEmail) return 'U'
    const parts = nameOrEmail.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return nameOrEmail.slice(0, 2).toUpperCase()
  }

  return (
    <div className="header-account-container" ref={menuRef}>
      {user ? (
        /* Authenticated State: User Profile Avatar & Initials */
        <button
          type="button"
          className="header-utility-account header-user-profile-btn user-active"
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label={user.display_name || user.email}
          title={user.display_name || user.email}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="user-initials-badge" aria-hidden="true">
            {getInitials(user.display_name || user.email)}
          </span>
          <span className="header-account-name">
            {user.display_name?.split(' ')[0] || user.email?.split('@')[0]}
          </span>
          <span className="profile-menu-caret" aria-hidden="true">
            {isOpen ? '▴' : '▾'}
          </span>
        </button>
      ) : (
        /* Guest State: Single Unified Account Access Icon (user-round-plus) */
        <button
          type="button"
          className={`header-utility-account header-account-guest-btn ${isOpen ? 'active-open' : ''}`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label={t('nav.account_access') || 'Account Access'}
          title={t('nav.account_access') || 'Account Access'}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <UserRoundPlusIcon size={20} className="header-account-icon" />
          <span className="sr">{t('nav.account_access') || 'Account Access'}</span>
        </button>
      )}

      {/* Dropdown Menu / Popup */}
      {isOpen && (
        <div
          className={`account-dropdown-popover ${user ? 'user-profile-dropdown' : 'guest-access-dropdown'}`}
          role="menu"
          aria-label={user ? (t('auth.profile_title') || 'User Account') : (t('nav.account_access') || 'Account Access')}
        >
          {user ? (
            /* Authenticated Profile Menu */
            <div className="profile-menu-content">
              <div className="profile-menu-head">
                <div className="profile-avatar-large" aria-hidden="true">
                  {getInitials(user.display_name || user.email)}
                </div>
                <div className="profile-info-block">
                  <div className="profile-name-text">{user.display_name}</div>
                  <div className="profile-email-text small text-muted">{user.email}</div>
                  <div className="profile-status-pill">
                    <span className="status-dot-active" aria-hidden="true"></span>
                    <span>{t('auth.mode_signed_in') || 'Signed In'}</span>
                  </div>
                </div>
              </div>

              <div className="profile-menu-actions">
                <button
                  type="button"
                  className="profile-menu-item"
                  role="menuitem"
                  onClick={handleAccountSettings}
                >
                  <UserRoundIcon size={16} className="profile-item-icon" />
                  <span>{t('auth.account_settings') || 'Account Settings'}</span>
                </button>

                <div className="profile-menu-divider" role="separator" />

                <button
                  type="button"
                  className="profile-menu-item profile-signout-item"
                  role="menuitem"
                  onClick={handleSignOutClick}
                >
                  <LogOutIcon size={16} className="profile-item-icon" />
                  <span>{t('auth.logout') || 'Sign Out'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Guest Access Popup with 2 Clear Choices */
            <div className="guest-menu-content">
              <div className="guest-menu-head">
                <div className="guest-brand-row">
                  <AbbayLogo size={22} />
                  <span className="guest-head-title">{t('nav.account_access') || 'Account Access'}</span>
                </div>
                <p className="guest-head-desc small">
                  {t('auth.guest_desc_short') || 'Sign in or create a profile to sync progress.'}
                </p>
              </div>

              <div className="guest-choices-grid">
                {/* Choice 1: Sign In for existing users */}
                <button
                  type="button"
                  className="account-choice-card choice-signin"
                  role="menuitem"
                  onClick={() => handleChoice('login')}
                  aria-label={`${t('auth.login_title') || 'Sign In'} — ${t('auth.sign_in_hint') || 'For existing users'}`}
                >
                  <div className="choice-card-icon-wrap icon-signin">
                    <LogInIcon size={20} />
                  </div>
                  <div className="choice-card-text">
                    <div className="choice-card-title-row">
                      <span className="choice-card-title">{t('auth.login_title') || 'Sign In'}</span>
                      <span className="choice-card-badge badge-existing">{t('auth.existing_user_badge') || 'Existing Users'}</span>
                    </div>
                    <span className="choice-card-desc small">
                      {t('auth.sign_in_hint') || 'Access your saved progress & rankings'}
                    </span>
                  </div>
                  <span className="choice-card-arrow" aria-hidden="true">→</span>
                </button>

                {/* Choice 2: Create Account for new users */}
                <button
                  type="button"
                  className="account-choice-card choice-register"
                  role="menuitem"
                  onClick={() => handleChoice('register')}
                  aria-label={`${t('auth.register_title') || 'Create Account'} — ${t('auth.create_account_hint') || 'For new users'}`}
                >
                  <div className="choice-card-icon-wrap icon-register">
                    <UserPlusIcon size={20} />
                  </div>
                  <div className="choice-card-text">
                    <div className="choice-card-title-row">
                      <span className="choice-card-title">{t('auth.register_title') || 'Create Account'}</span>
                      <span className="choice-card-badge badge-new">{t('auth.new_user_badge') || 'New Users'}</span>
                    </div>
                    <span className="choice-card-desc small">
                      {t('auth.create_account_hint') || 'Get started with encrypted local storage'}
                    </span>
                  </div>
                  <span className="choice-card-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

