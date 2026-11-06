import { Component, useEffect, useMemo, useState } from 'react'
import { LANGS, REVIEWED, makeT, initialLang, saveLang } from './i18n.js'
import { getMe, logoutUser, saveProgress } from './lib/api.js'
import { getJourneyProgress, getRank, saveJourneyProgress, isMissionCompleted } from './lib/journey.js'
import M1 from './components/M1.jsx'
import M2 from './components/M2.jsx'
import M3 from './components/M3.jsx'
import M4 from './components/M4.jsx'
import Learn from './components/Learn.jsx'
import Journey from './components/Journey.jsx'
import Account from './components/Account.jsx'
import NotificationCenter from './components/NotificationCenter.jsx'
import HeaderAccountMenu from './components/HeaderAccountMenu.jsx'
import DailyChallenge from './components/DailyChallenge.jsx'
import Arena from './components/Arena.jsx'
import CyberBattleGame from './components/CyberBattleGame.jsx'
import Assistant from './components/Assistant.jsx'
import DeviceSecurityCheck from './components/DeviceSecurityCheck.jsx'
import {
  AbbayLogo,
  UserRoundIcon,
  LogInIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  BotIcon,
  SparklesIcon,
  KeyRoundIcon,
  FileTextIcon,
  GlobeIcon,
  GraduationCapIcon,
  AwardIcon,
  TrophyIcon,
  Gamepad2Icon,
  BellIcon,
  SettingsIcon,
  CircleHelpIcon,
  LanguagesIcon,
  SwordsIcon,
  CalendarCheckIcon,
  LaptopIcon,
  SmartphoneIcon,
  BookOpenIcon,
} from './components/Icons.jsx'
import { getTodayDateString, getDailyChallengeStatus } from './lib/dailyChallenge.js'
import { getUnifiedLearningProgress } from './lib/learningProgress.js'

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Route error caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ maxWidth: 640, margin: '48px auto', textAlign: 'center', padding: '36px 24px' }}>
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <h2 style={{ marginTop: '16px' }}>{this.props.t('game.mission_failed')}</h2>
          <p className="small" style={{ color: '#ef4444', margin: '16px 0', wordBreak: 'break-word' }}>
            {this.state.error?.message || 'Unexpected application error'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.hash = '#/'
              }}
            >
              🏠 Dashboard
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
            >
              🔄 Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const TOOL_ROUTES = ['m1', 'm2', 'm3', 'm4', 'device', 'learn', 'journey']
const ALL_ROUTES = [...TOOL_ROUTES, 'account', 'daily', 'arena', 'game', 'assistant']
const VIEWS = { m1: M1, m2: M2, m3: M3, m4: M4, device: DeviceSecurityCheck, learn: Learn, journey: Journey, account: Account, daily: DailyChallenge, arena: Arena, game: CyberBattleGame, assistant: Assistant }

const MODULE_META = {
  m1: { icon: '🔗', tag: 'M1 HEURISTICS', tagClass: 'module-tag-m1', cardClass: 'tool-card-m1', artwork: '/images/journey/m1_link_scanner.svg' },
  m2: { icon: '🔑', tag: 'M2 LOCAL CRYPTO', tagClass: 'module-tag-m2', cardClass: 'tool-card-m2', artwork: '/images/journey/m2_password_vault.svg' },
  m3: { icon: '📋', tag: 'M3 INCIDENT DRAFT', tagClass: 'module-tag-m3', cardClass: 'tool-card-m3', artwork: '/images/journey/m3_incident_dossier.svg' },
  m4: { icon: '🛡️', tag: 'M4 SIMULATION', tagClass: 'module-tag-m4', cardClass: 'tool-card-m4', artwork: '/images/journey/m4_security_scanner.svg' },
  device: { icon: '💻', tag: 'DEVICE SECURITY', tagClass: 'module-tag-device', cardClass: 'tool-card-device', artwork: '/images/journey/defense_in_depth_shield.svg' },
  learn: { icon: '🎓', tag: 'M5 CYBER ACADEMY', tagClass: 'module-tag-learn', cardClass: 'tool-card-learn', artwork: '/images/journey/m5_academy_matrix.svg' },
  journey: { icon: '🚀', tag: 'CYBER HERO', tagClass: 'module-tag-journey', cardClass: 'tool-card-journey', artwork: '/images/journey/m01_scholarship_phishing.svg' },
}

const FEATURED_MISSIONS = [
  {
    id: 'm01',
    badgeKey: 'home.missions.m1_badge',
    hookKey: 'home.missions.m1_hook',
    tierLabel: 'Beginner',
    tierClass: 'tier-beginner',
    xp: '+100 XP',
    icon: '🎓',
    artwork: '/images/journey/m01_scholarship_phishing.svg',
  },
  {
    id: 'm02',
    badgeKey: 'home.missions.m2_badge',
    hookKey: 'home.missions.m2_hook',
    tierLabel: 'Intermediate',
    tierClass: 'tier-intermediate',
    xp: '+150 XP',
    icon: '📱',
    artwork: '/images/journey/m02_sim_upgrade.svg',
  },
  {
    id: 'm03',
    badgeKey: 'home.missions.m3_badge',
    hookKey: 'home.missions.m3_hook',
    tierLabel: 'Intermediate',
    tierClass: 'tier-intermediate',
    xp: '+150 XP',
    icon: '🤖',
    artwork: '/images/journey/m03_banking_bot.svg',
  },
  {
    id: 'm04',
    badgeKey: 'home.missions.m4_badge',
    hookKey: 'home.missions.m4_hook',
    tierLabel: 'Advanced',
    tierClass: 'tier-advanced',
    xp: '+200 XP',
    icon: '📦',
    artwork: '/images/journey/m04_malicious_apk.svg',
  },
]

const PILLARS = [
  {
    id: 'offline',
    icon: '🔒',
    titleKey: 'home.pillars.p1_title',
    descKey: 'home.pillars.p1_desc',
  },
  {
    id: 'threats',
    icon: '🇪🇹',
    titleKey: 'home.pillars.p2_title',
    descKey: 'home.pillars.p2_desc',
  },
  {
    id: 'tools',
    icon: '🛠️',
    titleKey: 'home.pillars.p3_title',
    descKey: 'home.pillars.p3_desc',
  },
  {
    id: 'trilingual',
    icon: '🌐',
    titleKey: 'home.pillars.p4_title',
    descKey: 'home.pillars.p4_desc',
  },
]

const ALLOWED_CONTEXTS = ['m1', 'm2', 'm3', 'm4', 'm5', 'learn', 'journey']

const parseHashState = () => {
  const raw = (typeof window !== 'undefined' && window.location.hash ? window.location.hash : '').replace(/^#\/?/, '')
  const [pathPart, queryPart] = raw.split('?')
  let r = pathPart || 'home'
  if (r === 'battle-game' || r === 'battle' || r === '3d-game') r = 'game'
  if (r === 'm5') r = 'learn'
  if (r === 'daily-challenge') r = 'daily'
  const route = ALL_ROUTES.includes(r) ? r : 'home'

  let context = null
  let initialQuery = null
  if (queryPart) {
    try {
      const params = new URLSearchParams(queryPart)
      const rawCtx = params.get('context')
      if (rawCtx && ALLOWED_CONTEXTS.includes(rawCtx)) {
        context = rawCtx === 'm5' ? 'learn' : rawCtx
      }
      const rawQ = params.get('q')
      if (rawQ) {
        initialQuery = rawQ.trim()
      }
    } catch {
      // safe fallback
    }
  }
  return { route, context, initialQuery }
}

const routeFromHash = () => parseHashState().route

export default function App() {
  const [lang, setLang] = useState(initialLang)
  const [route, setRoute] = useState(() => parseHashState().route)
  const [assistantContext, setAssistantContext] = useState(() => parseHashState().context)
  const [assistantInitialQuery, setAssistantInitialQuery] = useState(() => parseHashState().initialQuery)
  const [user, setUser] = useState(null)

  const t = useMemo(() => makeT(lang, (l, k) => {
    if (import.meta.env.DEV) console.warn('missing translation', l, k)
  }), [lang])

  useEffect(() => {
    document.documentElement.lang = lang
    saveLang(lang)
    document.title = t('app.title')
  }, [lang, t])

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState({
    tools: false,
    learning: false,
    games: false,
  })

  const toggleGroup = (grp) => {
    setCollapsedGroups((prev) => ({ ...prev, [grp]: !prev[grp] }))
  }

  // Close mobile navigation drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false)
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [])

  useEffect(() => {
    const h = () => {
      const parsed = parseHashState()
      setRoute(parsed.route)
      setAssistantContext(parsed.context)
      setAssistantInitialQuery(parsed.initialQuery)
      setMobileNavOpen(false)
    }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  // Auto-check existing session on load
  useEffect(() => {
    getMe()
      .then((data) => {
        if (data && data.email) {
          setUser(data)
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    try {
      await logoutUser()
    } catch {
      // safe fallback
    } finally {
      setUser(null)
    }
  }

  const handleSyncProgress = async () => {
    const prog = getJourneyProgress() || {}
    await saveProgress({
      activeLevel: 1,
      unlockedLevels: [1],
      completedLevels: prog.completedMissions || {},
    })
  }

  const [journeyProgress, setJourneyProgress] = useState(getJourneyProgress)

  // Re-read progress whenever returning to home view
  useEffect(() => {
    if (route === 'home') {
      setJourneyProgress(getJourneyProgress())
    }
  }, [route])

  const totalXp = journeyProgress?.totalXp || 0
  const completedMissions = journeyProgress?.completedMissions || {}
  const completedCount = Object.keys(completedMissions).filter((k) => completedMissions[k]?.completed).length
  const rank = getRank(totalXp)
  const activeMissionId = journeyProgress?.activeMissionId || 'm01'
  const hasProgress = totalXp > 0 || completedCount > 0

  const todayStr = getTodayDateString()
  const dailyStatus = getDailyChallengeStatus(todayStr)
  const isDailyDone = dailyStatus?.completed

  const handleLaunchMission = (missionId) => {
    try {
      const p = getJourneyProgress()
      saveJourneyProgress({ ...p, activeMissionId: missionId })
    } catch {
      // safe fallback
    }
    window.location.hash = '#/journey'
  }

  const handleNavigate = (targetHash) => {
    setMobileNavOpen(false)
    if (window.location.hash === targetHash || (!window.location.hash && targetHash === '#/')) {
      const parsed = parseHashState()
      setRoute(parsed.route)
      setAssistantContext(parsed.context)
      setAssistantInitialQuery(parsed.initialQuery)
    } else {
      window.location.hash = targetHash
    }
  }

  const View = VIEWS[route]

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <div className="header-brand-wrap">
          <a className="brand" href="#/" onClick={() => setMobileNavOpen(false)}>
            <AbbayLogo size={32} className="brand-logo-svg" />
            <div className="brand-text-block">
              <span className="brand-text">{t('app.title')}</span>
              <span className="brand-tagline">Learn. Protect. Empower.</span>
            </div>
          </a>
        </div>

        {/* Clean Header Utility Actions */}
        <div className="header-actions">
          {/* Single Unified Header Account Access */}
          <HeaderAccountMenu
            user={user}
            onLogout={handleLogout}
            onNavigate={(hash) => {
              setMobileNavOpen(false)
              handleNavigate(hash)
            }}
            t={t}
          />

          {/* Header AI Assistant Shortcut */}
          <a
            href="#/assistant"
            className={`header-utility-account header-utility-assistant ${route === 'assistant' ? 'user-active' : ''}`}
            aria-label={t('nav.assistant')}
            title={t('nav.assistant')}
            onClick={() => setMobileNavOpen(false)}
          >
            <span className="header-account-icon" aria-hidden="true">🤖</span>
            <span className="header-account-name">
              {t('nav.assistant')}
            </span>
          </a>

          <NotificationCenter t={t} user={user} lang={lang} onNavigate={handleNavigate} />

          <div className="lang">
            <label htmlFor="lang-select" className="sr">{t('app.lang')}</label>
            <span className="lang-icon" aria-hidden="true">
              <LanguagesIcon size={16} />
            </span>
            <select
              id="lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label={t('app.lang')}
            >
              {Object.entries(LANGS).map(([c, n]) => (
                <option key={c} value={c} lang={c}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Accessible Mobile Menu Toggle Button */}
          <button
            type="button"
            className={`nav-mobile-toggle ${mobileNavOpen ? 'active' : ''}`}
            aria-expanded={mobileNavOpen}
            aria-controls="app-sidebar"
            aria-label={mobileNavOpen ? t('nav.menu_close') : t('nav.menu_toggle')}
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            <span className="mobile-toggle-icon" aria-hidden="true">{mobileNavOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </header>

      <div className="app-shell">
        {/* Command Center Vertical Left Sidebar */}
        <aside
          id="app-sidebar"
          className={`app-sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileNavOpen ? 'mobile-open' : ''}`}
          aria-label={t('nav.sidebar_title')}
        >
          <div className="sidebar-header">
            <div className="sidebar-title-badge">
              <span className="sidebar-pulse-dot" aria-hidden="true"></span>
              <span className="sidebar-title-text">{t('nav.sidebar_title')}</span>
            </div>
            <div className="sidebar-header-actions">
              <button
                type="button"
                className="sidebar-toggle-btn desktop-only-btn"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                aria-label={sidebarCollapsed ? t('nav.sidebar_expand') : t('nav.sidebar_collapse')}
                title={sidebarCollapsed ? t('nav.sidebar_expand') : t('nav.sidebar_collapse')}
              >
                <span aria-hidden="true">{sidebarCollapsed ? '◨' : '◧'}</span>
              </button>
              <button
                type="button"
                className="sidebar-close-btn mobile-only-btn"
                onClick={() => setMobileNavOpen(false)}
                aria-label={t('nav.menu_close')}
                title={t('nav.menu_close')}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>

          <div className="sidebar-nav-scroll">
            {/* Home Link */}
            <div className="sidebar-nav-item sidebar-item-home">
              <a
                href="#/"
                className={`sidebar-link sidebar-link-home ${route === 'home' ? 'active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
                title={t('nav.home')}
              >
                <span className="sidebar-icon" aria-hidden="true">🏠</span>
                <span className="sidebar-label">{t('nav.home')}</span>
              </a>
            </div>

            {/* Security Tools Group */}
            <div className="sidebar-group sidebar-group-tools">
              <button
                type="button"
                className="sidebar-group-btn"
                onClick={() => toggleGroup('tools')}
                aria-expanded={!collapsedGroups.tools}
              >
                <span className="sidebar-group-title">
                  <ShieldCheckIcon size={16} className="sidebar-group-vector-icon" /> {t('nav.protect') || t('nav.group_tools')}
                </span>
                <span className="sidebar-chevron" aria-hidden="true">{collapsedGroups.tools ? '▸' : '▾'}</span>
              </button>
              {!collapsedGroups.tools && (
                <div className="sidebar-sub-menu">
                  <a href="#/m1" className={`sidebar-link sidebar-link-tools sidebar-link-m1 ${route === 'm1' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('nav.m1')}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <GlobeIcon size={16} />
                    </span>
                    <span className="sidebar-label">{t('nav.m1')}</span>
                  </a>
                  <a href="#/m2" className={`sidebar-link sidebar-link-tools sidebar-link-m2 ${route === 'm2' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('nav.m2')}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <KeyRoundIcon size={16} />
                    </span>
                    <span className="sidebar-label">{t('nav.m2')}</span>
                  </a>
                  <a href="#/m3" className={`sidebar-link sidebar-link-tools sidebar-link-m3 ${route === 'm3' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('nav.m3')}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <FileTextIcon size={16} />
                    </span>
                    <span className="sidebar-label">{t('nav.m3')}</span>
                  </a>
                  <a href="#/m4" className={`sidebar-link sidebar-link-tools sidebar-link-m4 ${route === 'm4' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('nav.m4')}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <ShieldCheckIcon size={16} />
                    </span>
                    <span className="sidebar-label">{t('nav.m4')}</span>
                  </a>
                  <a href="#/device" className={`sidebar-link sidebar-link-tools sidebar-link-device ${route === 'device' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('nav.device_security') || 'Device Security'}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <LaptopIcon size={16} />
                    </span>
                    <span className="sidebar-label">{t('nav.device_security') || 'Device Security'}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Learning & Missions Group */}
            <div className="sidebar-group sidebar-group-learning">
              <button
                type="button"
                className="sidebar-group-btn"
                onClick={() => toggleGroup('learning')}
                aria-expanded={!collapsedGroups.learning}
              >
                <span className="sidebar-group-title">
                  <GraduationCapIcon size={16} className="sidebar-group-vector-icon" /> {t('nav.learn') || t('nav.group_learning')}
                </span>
                <span className="sidebar-chevron" aria-hidden="true">{collapsedGroups.learning ? '▸' : '▾'}</span>
              </button>
              {!collapsedGroups.learning && (
                <div className="sidebar-sub-menu">
                  <a href="#/learn" className={`sidebar-link sidebar-link-learning ${route === 'learn' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('nav.learn')}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <BookOpenIcon size={16} />
                    </span>
                    <span className="sidebar-label">M5 {t('nav.learn')}</span>
                  </a>
                  <a href="#/journey" className={`sidebar-link sidebar-link-learning ${route === 'journey' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('nav.journey')}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <TrophyIcon size={16} />
                    </span>
                    <span className="sidebar-label">{t('nav.journey')}</span>
                  </a>
                  <a href="#/daily" className={`sidebar-link sidebar-link-learning ${route === 'daily' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('daily.title')}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <CalendarCheckIcon size={16} />
                    </span>
                    <span className="sidebar-label">{t('daily.title')}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Tactical Games Group */}
            <div className="sidebar-group sidebar-group-games">
              <button
                type="button"
                className="sidebar-group-btn"
                onClick={() => toggleGroup('games')}
                aria-expanded={!collapsedGroups.games}
              >
                <span className="sidebar-group-title">
                  <Gamepad2Icon size={16} className="sidebar-group-vector-icon" /> {t('nav.play_learn') || t('nav.group_games')}
                </span>
                <span className="sidebar-chevron" aria-hidden="true">{collapsedGroups.games ? '▸' : '▾'}</span>
              </button>
              {!collapsedGroups.games && (
                <div className="sidebar-sub-menu">
                  <a href="#/arena" className={`sidebar-link sidebar-link-games ${route === 'arena' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('nav.arena')}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <SwordsIcon size={16} />
                    </span>
                    <span className="sidebar-label">{t('nav.arena')}</span>
                  </a>
                  <a href="#/game" className={`sidebar-link sidebar-link-games ${route === 'game' ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)} title={t('nav.game')}>
                    <span className="sidebar-icon" aria-hidden="true">
                      <Gamepad2Icon size={16} />
                    </span>
                    <span className="sidebar-label">{t('nav.game')}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Cyber Alerts & Hotline Link */}
            <div className="sidebar-nav-item sidebar-item-alerts">
              <a
                href="#threats-advisory"
                className="sidebar-link sidebar-link-alerts"
                onClick={(e) => {
                  setMobileNavOpen(false)
                  if (route !== 'home') {
                    handleNavigate('#/')
                    setTimeout(() => {
                      document.getElementById('threats-advisory')?.scrollIntoView({ behavior: 'smooth' })
                    }, 100)
                  } else {
                    document.getElementById('threats-advisory')?.scrollIntoView({ behavior: 'smooth' })
                  }
                }}
                title={t('nav.alerts') || 'Cyber Alerts'}
              >
                <span className="sidebar-icon" aria-hidden="true">
                  <BellIcon size={16} />
                </span>
                <span className="sidebar-label">{t('nav.alerts') || 'Cyber Alerts'}</span>
              </a>
            </div>

            {/* AI Assistant Link */}
            <div className="sidebar-nav-item sidebar-item-assistant">
              <a
                href="#/assistant"
                className={`sidebar-link sidebar-link-assistant ${route === 'assistant' ? 'active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
                title={t('nav.assistant')}
              >
                <span className="sidebar-icon" aria-hidden="true">
                  <BotIcon size={16} />
                </span>
                <span className="sidebar-label">{t('nav.assistant')}</span>
              </a>
            </div>

            {/* Account / Authentication Link */}
            <div className="sidebar-nav-item sidebar-item-account">
              <a
                href="#/account"
                className={`sidebar-link sidebar-link-account ${route === 'account' ? 'active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
                title={user ? (user.display_name || user.email) : (t('nav.login_signup') || t('nav.account'))}
              >
                <span className="sidebar-icon" aria-hidden="true">
                  <UserRoundIcon size={18} />
                </span>
                <span className="sidebar-label">
                  {user ? (user.display_name?.split(' ')[0] || user.email) : (t('nav.login_signup') || t('nav.account'))}
                </span>
              </a>
            </div>
          </div>

          {/* Sidebar Status Footer */}
          <div className="sidebar-footer">
            <span className="sidebar-status-dot" aria-hidden="true"></span>
            <span className="sidebar-status-text">{t('app.in_browser_offline') || 'Core Tools 100% In-Browser • Offline-First'}</span>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {mobileNavOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

        <main id="main" className="app-main" tabIndex={-1}>
          <p className="notice" role="note">
            <span aria-hidden="true">🛡️ </span>
            {t('app.notice')}
          </p>
          {!REVIEWED[lang] && (
            <p className="notice unreviewed" role="note">
              <span aria-hidden="true">ℹ️ </span>
              {t('app.unreviewed')}
            </p>
          )}

          {route === 'home' ? (
            <div className="dashboard-layout">
              {/* Welcome Hero Section with Cinematic Visual */}
              <section className="hero-card" aria-labelledby="hero-title">
                {/* Floating cyber particles for ambient atmosphere */}
                <div className="hero-cyber-particles" aria-hidden="true">
                  <span className="cyber-particle cp-1"></span>
                  <span className="cyber-particle cp-2"></span>
                  <span className="cyber-particle cp-3"></span>
                  <span className="cyber-particle cp-4"></span>
                  <span className="cyber-particle cp-5"></span>
                  <span className="cyber-particle cp-6"></span>
                  <span className="cyber-symbol cs-1">🛡️</span>
                  <span className="cyber-symbol cs-2">🔒</span>
                  <span className="cyber-symbol cs-3">⚡</span>
                </div>
                <div className="hero-content-col">
                  <div className="hero-badge">
                    <span aria-hidden="true">🛡️</span> {t('home.hero.badge')}
                  </div>
                  <h1 id="hero-title" className="hero-title">{t('home.hero.title')}</h1>
                  <p className="hero-desc">{t('home.hero.desc')}</p>
                  <div className="hero-actions">
                    <a className="btn hero-btn-primary" href="#/m1">
                      🔗 {t('home.hero.m1_btn')}
                    </a>
                    <a className="btn hero-btn-journey" href="#/journey">
                      🚀 {t('home.hero.journey_btn')}
                    </a>
                    <a className="btn hero-btn-daily" href="#/daily">
                      ⚡ {t('home.hero.daily_btn')}
                    </a>
                    <a className="btn hero-btn-arena" href="#/arena">
                      ⚔️ {t('nav.arena')}
                    </a>
                    <a className="btn hero-btn-game" href="#/game">
                      🕹️ {t('home.hero.game_btn')}
                    </a>
                    <a className="btn ghost hero-btn-secondary" href="#/learn">
                      🎓 {t('home.hero.learn_btn')}
                    </a>
                    <a className="btn ghost hero-btn-account" href="#/account">
                      👤 {user ? t('auth.profile_title') : (t('nav.login_signup') || t('nav.account'))}
                    </a>
                  </div>
                  <div className="hero-pills" role="list" aria-label="Privacy and Architecture Highlights">
                    <span className="hero-pill" role="listitem">🔒 {t('home.hero.pill_offline')}</span>
                    <span className="hero-pill" role="listitem">🛡️ {t('home.hero.pill_privacy')}</span>
                    <span className="hero-pill" role="listitem">🇪🇹 {t('home.hero.pill_lang')}</span>
                  </div>
                </div>
                <div className="hero-visual-col">
                  <div className="hero-visual-orb-wrap">
                    <div className="hero-cyber-radar-glow" aria-hidden="true"></div>
                    <img
                      src="/images/hero_security_matrix.svg"
                      alt={t('app.title') + ' Security Matrix'}
                      className="hero-matrix-visual"
                      loading="eager"
                    />
                  </div>
                </div>
              </section>

              {/* The Four Connected Pillars of Ethiopian Digital Defense */}
              <section className="dashboard-section pillars-connected-section" aria-labelledby="pillars-heading">
                <div className="section-head">
                  <span className="section-category-tag">CORE ARCHITECTURE</span>
                  <h2 id="pillars-heading">{t('home.pillars.heading')}</h2>
                  <p className="small">{t('home.pillars.subheading')}</p>
                </div>
                <div className="pillars-connected-grid">
                  <article className="card pillar-connected-card pillar-learn">
                    <div className="pillar-top">
                      <span className="pillar-icon" aria-hidden="true">🎓</span>
                      <span className="pillar-category-tag">{t('home.pillars.learn_title')}</span>
                    </div>
                    <h3 className="pillar-title">{t('home.pillars.learn_tagline')}</h3>
                    <p className="pillar-desc">{t('home.pillars.learn_desc')}</p>
                    <div className="pillar-links">
                      <a href="#/journey" className="pillar-action-link">🚀 {t('nav.journey')} →</a>
                      <a href="#/learn" className="pillar-sub-link">M5 {t('nav.learn')}</a>
                    </div>
                  </article>

                  <article className="card pillar-connected-card pillar-protect">
                    <div className="pillar-top">
                      <span className="pillar-icon" aria-hidden="true">🛡️</span>
                      <span className="pillar-category-tag">{t('home.pillars.protect_title')}</span>
                    </div>
                    <h3 className="pillar-title">{t('home.pillars.protect_tagline')}</h3>
                    <p className="pillar-desc">{t('home.pillars.protect_desc')}</p>
                    <div className="pillar-links">
                      <a href="#/m1" className="pillar-action-link">🔗 {t('nav.m1')} →</a>
                      <a href="#/m2" className="pillar-sub-link">🔑 {t('nav.m2')}</a>
                    </div>
                  </article>

                  <article className="card pillar-connected-card pillar-play">
                    <div className="pillar-top">
                      <span className="pillar-icon" aria-hidden="true">⚔️</span>
                      <span className="pillar-category-tag">{t('home.pillars.play_title')}</span>
                    </div>
                    <h3 className="pillar-title">{t('home.pillars.play_tagline')}</h3>
                    <p className="pillar-desc">{t('home.pillars.play_desc')}</p>
                    <div className="pillar-links">
                      <a href="#/game" className="pillar-action-link">🕹️ {t('nav.game')} →</a>
                      <a href="#/arena" className="pillar-sub-link">⚔️ {t('nav.arena')}</a>
                    </div>
                  </article>

                  <article className="card pillar-connected-card pillar-empower">
                    <div className="pillar-top">
                      <span className="pillar-icon" aria-hidden="true">🚨</span>
                      <span className="pillar-category-tag">{t('home.pillars.empower_title')}</span>
                    </div>
                    <h3 className="pillar-title">{t('home.pillars.empower_tagline')}</h3>
                    <p className="pillar-desc">{t('home.pillars.empower_desc')}</p>
                    <div className="pillar-links">
                      <a href="#/m3" className="pillar-action-link">📋 {t('home.empower.report_btn')} →</a>
                      <a href="tel:994" className="pillar-sub-link">📞 Hotline 994</a>
                    </div>
                  </article>
                </div>
              </section>

            {/* Section A — Security Tools & Analyzers */}
            <section className="dashboard-section dashboard-section-tools" aria-labelledby="tools-title">
              <div className="section-head">
                <span className="section-category-tag">SECTION A</span>
                <h2 id="tools-title">{t('home.sec_tools_title')}</h2>
                <p className="small">{t('home.sec_tools_desc')}</p>
              </div>

              <div className="cards tools-grid">
                {TOOL_ROUTES.map((r) => {
                  const meta = MODULE_META[r]
                  return (
                    <article className={`card tool-card ${meta.cardClass}`} key={r}>
                      <div className="tool-card-header">
                        <span className="tool-icon" aria-hidden="true">{meta.icon}</span>
                        <span className={`module-tag ${meta.tagClass}`}>{meta.tag}</span>
                      </div>
                      {meta.artwork && (
                        <div className="tool-card-artwork-wrap">
                          <img
                            src={meta.artwork}
                            alt={t('nav.' + r) + ' Artwork'}
                            className="tool-card-artwork"
                            loading="eager"
                          />
                        </div>
                      )}
                      <h3>{r === 'learn' ? `M5 ${t('nav.learn')}` : r === 'device' ? (t('nav.device_security') || 'Device Security') : t('nav.' + r)}</h3>
                      <p className="tool-desc">{t('home.' + (r === 'learn' ? 'learn' : r))}</p>
                      <div className="tool-card-footer">
                        <a className="btn" href={`#/${r}`}>
                          {t('home.tool_btn.' + r)} →
                        </a>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            {/* Featured CyberShield AI Assistant Entry Point */}
            <section className="dashboard-section dashboard-section-assistant" aria-labelledby="assistant-home-title">
              <div className="section-head">
                <span className="section-category-tag">{t('assistant.home_badge') || 'AI ASSISTANT'}</span>
                <h2 id="assistant-home-title">{t('assistant.home_card_title') || 'CyberShield AI Assistant'}</h2>
                <p className="small">{t('assistant.subtitle')}</p>
              </div>

              <article className="card assistant-home-card">
                <div className="assistant-home-top">
                  <div className="assistant-home-brand">
                    <span className="assistant-home-avatar" aria-hidden="true">🤖</span>
                    <div>
                      <h3 className="assistant-home-title">{t('assistant.home_card_title')}</h3>
                      <p className="assistant-home-desc">{t('assistant.home_card_subtitle')}</p>
                    </div>
                  </div>
                  <div className="assistant-home-status-badge">
                    <span className="assistant-mode-pill pill-offline">
                      🛡️ {t('assistant.pill_offline_first') || 'Offline-First Engine'}
                    </span>
                  </div>
                </div>

                <div className="assistant-home-prompts-row">
                  <span className="assistant-home-prompt-label small">{t('assistant.home_quick_prompt') || 'Common questions:'}</span>
                  <div className="assistant-home-chips">
                    {[
                      t('assistant.quick_q1') || 'What is phishing?',
                      t('assistant.quick_q2') || 'How do I secure Telebirr / CBE Birr?',
                      t('assistant.quick_q3') || 'What if I already clicked a suspicious link?',
                      t('assistant.quick_q4') || 'How does M1 Link Checker work?',
                    ].map((promptText, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        className="btn-chip"
                        onClick={() => handleNavigate(`#/assistant?q=${encodeURIComponent(promptText)}`)}
                      >
                        💬 {promptText}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="assistant-home-footer">
                  <a className="btn btn-primary" href="#/assistant">
                    🤖 {t('assistant.home_card_btn') || 'Open AI Assistant'} →
                  </a>
                </div>
              </article>
            </section>

            {/* Section B — Interactive Learning & Missions */}
            <section className="dashboard-section dashboard-section-learning" aria-labelledby="learning-section-title">
              <div className="section-head">
                <span className="section-category-tag">SECTION B</span>
                <h2 id="learning-section-title">{t('home.sec_learning_title')}</h2>
                <p className="small">{t('home.sec_learning_desc')}</p>
              </div>

              <div className="learning-dashboard-grid">
                {/* User Progress & Resume Hero Card */}
                <div className="resume-section" aria-labelledby="resume-title">
                  {hasProgress ? (
                    <div className="resume-card resume-card-active">
                      <div className="resume-info">
                        <div className="resume-header">
                          <span className="resume-badge" aria-hidden="true">
                            ⚡ {t('home.resume.rank_label')}: {rank.icon} {t('journey.rank.' + rank.key)}
                          </span>
                          <h3 id="resume-title" className="resume-title">{t('home.resume.title')}</h3>
                        </div>
                        <p className="resume-subtitle">{t('home.resume.subtitle')}</p>
                        <div className="resume-stats">
                          <span className="stat-pill stat-xp">⚡ {totalXp} {t('home.resume.xp_label')}</span>
                          <span className="stat-pill stat-completed">✅ {completedCount} / 4 {t('home.resume.completed_label')}</span>
                          {user && <span className="stat-pill stat-cloud">☁️ {(user.display_name?.split(' ')[0] || user.email?.split('@')[0] || 'User')}</span>}
                        </div>
                      </div>
                      <div className="resume-action">
                        <button
                          type="button"
                          className="btn btn-resume-journey"
                          onClick={() => handleLaunchMission(activeMissionId)}
                        >
                          🚀 {t('home.resume.btn')} →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="resume-card resume-card-new">
                      <div className="resume-info">
                        <span className="resume-badge">🔰 {t('journey.rank.cadet')}</span>
                        <h3 id="resume-title" className="resume-title">{t('home.resume.new_title')}</h3>
                        <p className="resume-subtitle">{t('home.resume.new_desc')}</p>
                      </div>
                      <div className="resume-action">
                        <button
                          type="button"
                          className="btn btn-resume-journey"
                          onClick={() => handleLaunchMission('m01')}
                        >
                          🚀 {t('home.resume.new_btn')} →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Daily Challenge Banner Card */}
                <div className="home-daily-section" aria-labelledby="daily-banner-title">
                  <div className="home-daily-card">
                    <div className="home-daily-info">
                      <div className="home-daily-header">
                        <span className="home-daily-badge">
                          {isDailyDone ? '✅ ' + t('daily.completed_badge') : '⚡ ' + t('daily.available_badge')}
                        </span>
                        <span className="home-daily-date">📅 {todayStr}</span>
                      </div>
                      <h3 id="daily-banner-title" className="home-daily-title">{t('daily.title')}</h3>
                      <p className="home-daily-desc">{t('home.daily_banner_desc')}</p>
                    </div>
                    <div className="home-daily-action">
                      <a className="btn btn-primary" href="#/daily">
                        {isDailyDone ? t('daily.review_btn') : t('daily.start_btn')} (+50 XP) →
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Featured Threat Missions & Practice Lab */}
              <div className="featured-missions-section" aria-labelledby="missions-title">
                <div className="sub-section-head">
                  <h3 id="missions-title">{t('home.missions.title')}</h3>
                  <p className="small">{t('home.missions.desc')}</p>
                </div>
                <div className="featured-missions-grid">
                  {FEATURED_MISSIONS.map((m) => {
                    const isDone = isMissionCompleted(m.id)
                    return (
                      <article className={`mission-preview-card ${isDone ? 'mission-preview-done' : ''}`} key={m.id}>
                        <div className="mission-preview-top">
                          <span className="mission-preview-icon" aria-hidden="true">{m.icon}</span>
                          <div className="mission-preview-badges">
                            <span className={`mission-tier-pill ${m.tierClass}`}>{m.tierLabel}</span>
                            <span className="mission-xp-badge">{m.xp}</span>
                            {isDone && <span className="mission-done-tag" title="Completed">✅</span>}
                          </div>
                        </div>
                        {m.artwork && (
                          <div className="mission-preview-artwork-wrap">
                            <img
                              src={m.artwork}
                              alt={t(`journey.${m.id}.title`) + ' Mission Artwork'}
                              className="mission-preview-artwork"
                              loading="eager"
                            />
                          </div>
                        )}
                        <div className="mission-preview-badge-category">{t(m.badgeKey)}</div>
                        <h4 className="mission-preview-title">{t(`journey.${m.id}.title`)}</h4>
                        <p className="mission-preview-hook">{t(m.hookKey)}</p>
                        <div className="mission-preview-footer">
                          <button
                            type="button"
                            className="btn btn-preview-play"
                            onClick={() => handleLaunchMission(m.id)}
                          >
                            {t('home.missions.play_btn')} →
                          </button>
                        </div>
                      </article>
                    )
                  })}

                  <article className="mission-preview-card practice-lab-preview-card">
                    <div className="mission-preview-top">
                      <span className="mission-preview-icon" aria-hidden="true">🧪</span>
                      <div className="mission-preview-badges">
                        <span className="mission-tier-pill tier-dynamic">Adaptive</span>
                        <span className="mission-xp-badge">+100-200 XP</span>
                      </div>
                    </div>
                    <div className="mission-preview-artwork-wrap">
                      <img
                        src="/images/journey/practice_adaptive.svg"
                        alt={t('home.missions.practice_badge') + ' Lab Artwork'}
                        className="mission-preview-artwork"
                        loading="eager"
                      />
                    </div>
                    <div className="mission-preview-badge-category">{t('home.missions.practice_badge')}</div>
                    <h4 className="mission-preview-title">{t('home.missions.practice_badge')}</h4>
                    <p className="mission-preview-hook">{t('home.missions.practice_hook')}</p>
                    <div className="mission-preview-footer">
                      <a className="btn btn-preview-practice" href="#/journey">
                        {t('home.missions.practice_btn')} →
                      </a>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            {/* Section C — Games & Practice */}
            <section className="dashboard-section dashboard-section-games" aria-labelledby="games-section-title">
              <div className="section-head">
                <span className="section-category-tag">SECTION C</span>
                <h2 id="games-section-title">{t('home.sec_games_title')}</h2>
                <p className="small">{t('home.sec_games_desc')}</p>
              </div>

              <div className="games-dashboard-grid">
                <article className="card game-dashboard-card arena-card">
                  <div className="game-card-top">
                    <span className="game-card-icon" aria-hidden="true">⚔️</span>
                    <span className="module-tag module-tag-arena">TACTICAL ARENA</span>
                  </div>
                  <h3>{t('nav.arena')}</h3>
                  <p className="game-card-desc">{t('arena.subtitle')}</p>
                  <div className="game-card-features">
                    <span className="game-feature-pill">🛡️ Red vs Blue Defense</span>
                    <span className="game-feature-pill">🇪🇹 Ethiopian Scenarios</span>
                    <span className="game-feature-pill">⚡ XP & Telemetry</span>
                  </div>
                  <div className="game-card-footer">
                    <a className="btn btn-primary" href="#/arena">
                      ⚔️ {t('nav.arena')} →
                    </a>
                  </div>
                </article>

                <article className="card game-dashboard-card battle-card">
                  <div className="game-card-top">
                    <span className="game-card-icon" aria-hidden="true">🕹️</span>
                    <span className="module-tag module-tag-game">3D SIMULATOR</span>
                  </div>
                  <h3>{t('nav.game')}</h3>
                  <p className="game-card-desc">{t('game.subtitle') || 'Real-time 3D network facility defense against simulated malware waves.'}</p>
                  <div className="game-card-features">
                    <span className="game-feature-pill">🌐 Interactive 3D Canvas</span>
                    <span className="game-feature-pill">🖥️ Multi-Server Containment</span>
                    <span className="game-feature-pill">🎮 Keyboard & Touch Controls</span>
                  </div>
                  <div className="game-card-footer">
                    <a className="btn btn-primary" href="#/game">
                      🕹️ {t('home.hero.game_btn')} →
                    </a>
                  </div>
                </article>
              </div>
            </section>

            {/* Section D — EMPOWER: Regional Threat Advisories & Incident Reporting */}
            <section className="dashboard-section dashboard-section-empower" id="threats-advisory" aria-labelledby="empower-heading">
              <div className="section-head">
                <span className="section-category-tag">SECTION D</span>
                <h2 id="empower-heading">{t('home.sec_empower_title')}</h2>
                <p className="small">{t('home.sec_empower_desc')}</p>
              </div>

              <div className="empower-grid">
                <article className="card advisory-card card-hotline">
                  <div className="advisory-top">
                    <span className="advisory-icon" aria-hidden="true">📱</span>
                    <span className="advisory-badge badge-telecom">ETHIO TELECOM & TELEBIRR SUPPORT</span>
                  </div>
                  <h3 className="advisory-title">{t('home.empower.hotline_title')}</h3>
                  <div className="advisory-hotlines-row">
                    <div className="hotline-pill hotline-ethio">
                      <span className="hotline-label">Ethio Telecom:</span>
                      <a href="tel:994" className="hotline-number">📞 994</a>
                    </div>
                    <div className="hotline-pill hotline-telebirr">
                      <span className="hotline-label">Telebirr Support:</span>
                      <a href="tel:127" className="hotline-number">📞 127</a>
                    </div>
                  </div>
                  <p className="advisory-desc">{t('home.empower.hotline_desc')}</p>
                  <div className="advisory-footer advisory-footer-dual">
                    <a className="btn btn-primary btn-hotline-994" href="tel:994">
                      📞 {t('home.empower.hotline_btn')}
                    </a>
                    <a className="btn btn-primary btn-hotline-127" href="tel:127" style={{ background: '#00C2D7', borderColor: '#00C2D7', color: '#0B1220' }}>
                      📱 {t('home.empower.telebirr_btn')}
                    </a>
                  </div>
                </article>

                <article className="card advisory-card card-report">
                  <div className="advisory-top">
                    <span className="advisory-icon" aria-hidden="true">📋</span>
                    <span className="advisory-badge" style={{ color: '#34d399' }}>CONFIDENTIAL M3</span>
                  </div>
                  <h3 className="advisory-title">{t('home.empower.report_title')}</h3>
                  <p className="advisory-desc">{t('home.empower.report_desc')}</p>
                  <div className="advisory-footer">
                    <a className="btn btn-primary" href="#/m3">
                      📝 {t('home.empower.report_btn')} →
                    </a>
                  </div>
                </article>

                <article className="card advisory-card card-warning">
                  <div className="advisory-top">
                    <span className="advisory-icon" aria-hidden="true">📱</span>
                    <span className="advisory-badge" style={{ color: '#fbbf24' }}>FINANCIAL FRAUD</span>
                  </div>
                  <h3 className="advisory-title">{t('home.empower.alert1_title')}</h3>
                  <p className="advisory-desc">{t('home.empower.alert1_desc')}</p>
                  <div className="advisory-footer">
                    <a className="btn ghost" href="#/assistant?q=How%20to%20avoid%20Telebirr%20and%20CBE%20fraud">
                      🤖 Security Advice →
                    </a>
                  </div>
                </article>

                <article className="card advisory-card card-warning">
                  <div className="advisory-top">
                    <span className="advisory-icon" aria-hidden="true">📶</span>
                    <span className="advisory-badge" style={{ color: '#fbbf24' }}>SOCIAL ENGINEERING</span>
                  </div>
                  <h3 className="advisory-title">{t('home.empower.alert2_title')}</h3>
                  <p className="advisory-desc">{t('home.empower.alert2_desc')}</p>
                  <div className="advisory-footer">
                    <a className="btn ghost" href="#/journey">
                      🚀 Practice Mission (M02) →
                    </a>
                  </div>
                </article>
              </div>
            </section>

            {/* Value Proposition Pillars Section */}
            <section className="pillars-section" aria-labelledby="pillars-title">
              <div className="section-head">
                <h2 id="pillars-title">{t('home.pillars.title')}</h2>
                <p className="small">{t('home.pillars.desc')}</p>
              </div>
              <div className="pillars-grid" role="list">
                {PILLARS.map((p) => (
                  <article className="pillar-card" key={p.id} role="listitem">
                    <span className="pillar-icon" aria-hidden="true">{p.icon}</span>
                    <h3 className="pillar-title">{t(p.titleKey)}</h3>
                    <p className="pillar-desc">{t(p.descKey)}</p>
                  </article>
                ))}
              </div>
            </section>

            {/* Privacy-First & Offline-Ready Architecture Highlights */}
            <section className="dashboard-section-trust" aria-labelledby="trust-heading">
              <div className="section-head" style={{ marginBottom: 0 }}>
                <span className="section-category-tag" style={{ color: '#22d3ee', borderColor: 'rgba(34, 211, 238, 0.3)' }}>SECURITY ASSURANCE</span>
                <h2 id="trust-heading" style={{ color: '#f8fafc' }}>{t('home.trust.title')}</h2>
                <p className="small" style={{ color: '#94a3b8' }}>{t('home.trust.subtitle')}</p>
              </div>
              <div className="trust-grid">
                <div className="trust-card">
                  <h4>🔒 {t('home.trust.in_browser_title')}</h4>
                  <p>{t('home.trust.in_browser_desc')}</p>
                </div>
                <div className="trust-card">
                  <h4>⚡ {t('home.trust.offline_title')}</h4>
                  <p>{t('home.trust.offline_desc')}</p>
                </div>
                <div className="trust-card">
                  <h4>🇪🇹 {t('home.trust.trilingual_title')}</h4>
                  <p>{t('home.trust.trilingual_desc')}</p>
                </div>
              </div>
            </section>

            {/* Clean Brand Footer */}
            <footer className="dashboard-footer" role="contentinfo">
              <div className="dashboard-footer-top">
                <div className="footer-brand-col">
                  <div className="footer-brand">
                    <AbbayLogo size={32} />
                    <div className="footer-brand-text">
                      <span className="footer-title">{t('app.title')}</span>
                      <span className="footer-sub-tagline">Learn. Protect. Empower.</span>
                    </div>
                  </div>
                  <p className="footer-tagline">{t('app.notice')}</p>
                  <div style={{ marginTop: '14px' }}>
                    <a
                      href="tel:994"
                      className="btn btn-sm"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      🚨 National CIRT & Police: <strong>994</strong>
                    </a>
                  </div>
                </div>
                <div className="footer-nav-grid">
                  <div className="footer-nav-col">
                    <h4 className="footer-heading">{t('nav.protect') || t('nav.group_tools')}</h4>
                    <ul className="footer-links">
                      <li><a href="#/m1">🔗 {t('nav.m1')}</a></li>
                      <li><a href="#/m2">🔑 {t('nav.m2')}</a></li>
                      <li><a href="#/m3">📋 {t('nav.m3')}</a></li>
                      <li><a href="#/m4">🛡️ {t('nav.m4')}</a></li>
                      <li><a href="#/device">💻 {t('nav.device_security') || 'Device Security'}</a></li>
                    </ul>
                  </div>
                  <div className="footer-nav-col">
                    <h4 className="footer-heading">{t('nav.learn') || t('nav.group_learning')}</h4>
                    <ul className="footer-links">
                      <li><a href="#/learn">🎓 {t('nav.learn')}</a></li>
                      <li><a href="#/journey">🚀 {t('nav.journey')}</a></li>
                      <li><a href="#/daily">⚡ {t('daily.title')}</a></li>
                      <li><a href="#/assistant">🤖 {t('nav.assistant')}</a></li>
                    </ul>
                  </div>
                  <div className="footer-nav-col">
                    <h4 className="footer-heading">{t('nav.play_learn') || t('nav.group_games')}</h4>
                    <ul className="footer-links">
                      <li><a href="#/arena">⚔️ {t('nav.arena')}</a></li>
                      <li><a href="#/game">🕹️ {t('nav.game')}</a></li>
                      <li><a href="#/account">{user ? t('auth.profile_title') : (t('nav.login_signup') || t('nav.account'))}</a></li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="dashboard-footer-bottom">
                <p className="small offline-note">
                  <span>🔒 {t('app.offline')}</span> • <span>ℹ️ {t('app.safety_note')}</span>
                </p>
                <div className="footer-flag-badge">
                  <span>🇪🇹 {t('home.hero.pill_lang')}</span>
                </div>
              </div>
            </footer>
          </div>
        ) : (
          <RouteErrorBoundary key={route} t={t}>
            <View
              t={t}
              lang={lang}
              user={user}
              setUser={setUser}
              onNavigate={handleNavigate}
              onSyncProgress={handleSyncProgress}
              assistantContext={assistantContext}
              initialQuery={assistantInitialQuery}
            />
          </RouteErrorBoundary>
        )}
      </main>
    </div>
  </>
  )
}
