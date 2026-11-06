import { useEffect, useRef, useState } from 'react'
import {
  loadNotifications,
  markNotificationAsRead,
  handleLogout,
  getNotificationDestination,
} from '../lib/notificationManager'

function getIconForType(type) {
  switch (type) {
    case 'security':
      return '⚠️'
    case 'tip':
      return '💡'
    case 'system':
      return '🛡️'
    case 'challenge':
      return '🎯'
    case 'progress':
      return '⚡'
    default:
      return 'ℹ️'
  }
}

function formatRelativeTime(isoString, t) {
  if (!isoString) return ''
  try {
    const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000))
    if (diffSeconds < 60) {
      return t('notif.just_now')
    }
    if (diffSeconds < 3600) {
      const mins = Math.floor(diffSeconds / 60)
      return `${mins}${t('notif.mins_ago')}`
    }
    if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600)
      return `${hours}${t('notif.hours_ago')}`
    }
    const days = Math.floor(diffSeconds / 86400)
    return `${days}${t('notif.days_ago')}`
  } catch {
    return ''
  }
}

export default function NotificationCenter({ t, user, lang, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  const containerRef = useRef(null)
  const previousUserIdRef = useRef(user?.id || null)

  // Fetch / refresh notifications
  const refresh = async (currentUser) => {
    setLoading(true)
    try {
      const result = await loadNotifications(currentUser)
      setNotifications(result.notifications || [])
      setUnreadCount(result.unreadCount || 0)
      setIsOffline(result.isOffline)
    } finally {
      setLoading(false)
      setIsSyncing(false)
    }
  }

  // Handle user state changes and account isolation
  useEffect(() => {
    const currentId = user?.id || null
    const prevId = previousUserIdRef.current

    if (prevId && prevId !== currentId) {
      // User switched or logged out: purge previous account cache
      handleLogout(prevId)
    }
    previousUserIdRef.current = currentId

    refresh(user)
  }, [user])

  // Network online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      setIsSyncing(true)
      refresh(user)
    }
    const handleOffline = () => {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [user])

  // Handle click outside and Escape key to close dropdown
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleMarkAll = async () => {
    const result = await markNotificationAsRead(user, null, true)
    setNotifications(result.notifications || [])
    setUnreadCount(result.unreadCount || 0)
  }

  const handleMarkSingle = async (id, e) => {
    if (e) e.stopPropagation()
    const result = await markNotificationAsRead(user, id, false)
    setNotifications(result.notifications || [])
    setUnreadCount(result.unreadCount || 0)
  }

  const handleNotificationClick = async (item) => {
    if (!item.is_read) {
      await handleMarkSingle(item.id)
    }

    const destination = getNotificationDestination(item)
    if (destination) {
      setIsOpen(false)
      if (typeof onNavigate === 'function') {
        onNavigate(destination)
      } else if (typeof window !== 'undefined') {
        window.location.hash = destination
      }
    }
  }

  return (
    <div className="notif-center" ref={containerRef}>
      {/* Bell Button */}
      <button
        id="cs-notification-bell-btn"
        type="button"
        className={`notif-bell-btn ${isOpen ? 'active' : ''}`}
        aria-label={`${t('notif.bell_aria')}${unreadCount > 0 ? ` (${unreadCount} ${t('notif.unread_count')})` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="cs-notification-panel"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="notif-bell-icon" aria-hidden="true">
          🔔
        </span>
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div
          id="cs-notification-panel"
          className="notif-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="notif-panel-title"
        >
          {/* Panel Header */}
          <div className="notif-header">
            <div className="notif-header-title-wrap">
              <h2 id="notif-panel-title" className="notif-title">
                {t('notif.title')}
              </h2>
              {unreadCount > 0 && (
                <span className="notif-unread-pill">
                  {unreadCount} {t('notif.unread_count')}
                </span>
              )}
            </div>

            <div className="notif-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-btn-text"
                  onClick={handleMarkAll}
                >
                  {t('notif.mark_all_read')}
                </button>
              )}
              <button
                type="button"
                className="notif-btn-close"
                aria-label={t('notif.close')}
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Status Banners (Offline / Guest / Syncing) */}
          <div className="notif-status-bar">
            {isOffline && (
              <span className="notif-status-tag notif-tag-offline">
                📶 {t('notif.offline_badge')}
              </span>
            )}
            {isSyncing && (
              <span className="notif-status-tag notif-tag-syncing">
                🔄 {t('notif.syncing')}
              </span>
            )}
            {!user && (
              <span className="notif-status-tag notif-tag-guest">
                👤 {t('notif.guest_mode')}
              </span>
            )}
          </div>

          {/* Notification List Body */}
          <div className="notif-body">
            {loading ? (
              <div className="notif-loading">
                <span className="notif-spinner" aria-hidden="true"></span>
                <p>{t('notif.loading')}</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">
                <span className="notif-empty-icon" aria-hidden="true">
                  🔔
                </span>
                <p className="notif-empty-title">{t('notif.empty')}</p>
                <p className="notif-empty-sub">{t('notif.empty_sub')}</p>
              </div>
            ) : (
              <ul className="notif-list" role="list">
                {notifications.map((item) => {
                  const title = t(item.title_key) || item.title_key
                  const message = t(item.message_key) || item.message_key
                  const icon = getIconForType(item.type)
                  const timeStr = formatRelativeTime(item.created_at, t)
                  const destination = getNotificationDestination(item)
                  const isNavigable = Boolean(destination)

                  return (
                    <li
                      key={item.id}
                      className={`notif-card ${item.is_read ? 'read' : 'unread'} ${isNavigable ? 'notif-card-navigable' : ''}`}
                      onClick={() => handleNotificationClick(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleNotificationClick(item)
                        }
                      }}
                      aria-label={`${title}. ${message}${isNavigable ? ' Click to navigate.' : ''}`}
                    >
                      <div className="notif-card-icon" aria-hidden="true">
                        {icon}
                      </div>
                      <div className="notif-card-content">
                        <div className="notif-card-header">
                          <h3 className="notif-card-title">{title}</h3>
                          <div className="notif-card-indicators">
                            {!item.is_read && (
                              <span className="notif-unread-dot" aria-hidden="true"></span>
                            )}
                            {isNavigable && (
                              <span className="notif-card-arrow" aria-hidden="true">
                                →
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="notif-card-msg">{message}</p>
                        <div className="notif-card-footer">
                          <span className="notif-card-time">{timeStr}</span>
                          {item.pending_sync && (
                            <span className="notif-pending-tag" title="Pending sync">
                              ⏳
                            </span>
                          )}
                          {!item.is_read && (
                            <button
                              type="button"
                              className="notif-item-read-btn"
                              title={t('notif.mark_read')}
                              aria-label={t('notif.mark_read')}
                              onClick={(e) => handleMarkSingle(item.id, e)}
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
