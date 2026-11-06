// Notification Coordinator: synchronizes IndexedDB local cache with FastAPI server
// Enforces offline-first principles, account isolation, and automatic resync on reconnect.

import {
  getCachedNotifications,
  saveCachedNotifications,
  markCachedAsRead,
  getPendingActions,
  removePendingAction,
  clearAccountCache,
  getGuestDefaultNotifications,
} from './notificationStorage'
import {
  getNotifications,
  markNotificationsRead,
  syncNotifications,
} from './api'

/**
 * Reconcile local and remote notifications:
 * - Preserves any local read status if user marked items read while offline.
 * - Deduplicates by notification ID.
 * - Sorts newest first.
 */
export function reconcileNotifications(localItems, remoteItems) {
  const mergedMap = new Map()

  // 1. Insert remote items first
  for (const r of (remoteItems || [])) {
    if (r && r.id) {
      mergedMap.set(String(r.id), { ...r })
    }
  }

  // 2. Reconcile with local items
  for (const l of (localItems || [])) {
    if (!l || !l.id) continue
    const id = String(l.id)
    if (mergedMap.has(id)) {
      const existing = mergedMap.get(id)
      // If either local or remote is read, consider it read
      const isRead = Boolean(existing.is_read || l.is_read)
      const readAt = existing.read_at || l.read_at
      mergedMap.set(id, {
        ...existing,
        ...l,
        is_read: isRead,
        read_at: readAt,
        pending_sync: existing.is_read !== isRead ? true : false,
      })
    } else if (l.is_local_only) {
      // Local-only items preserved
      mergedMap.set(id, { ...l })
    }
  }

  const list = Array.from(mergedMap.values())
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return list
}

/**
 * Load notifications for the current state (guest vs authenticated user).
 * Returns { notifications, unreadCount, isOffline, isSyncing, error }
 */
export async function loadNotifications(user) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  const accountId = user ? user.id : 'guest'

  // 1. Load cached first
  let cached = await getCachedNotifications(accountId)

  // Seed default guest notifications if first time
  if (accountId === 'guest' && cached.length === 0) {
    const defaults = getGuestDefaultNotifications()
    await saveCachedNotifications('guest', defaults)
    cached = defaults
  }

  // If guest or offline, return local cache immediately
  if (!user || !isOnline) {
    const unread = cached.filter((n) => !n.is_read).length
    return {
      notifications: cached,
      unreadCount: unread,
      isOffline: !isOnline,
      isSyncing: false,
      error: null,
    }
  }

  // Authenticated and online: execute sync
  try {
    // Check pending read actions
    const pendingActions = await getPendingActions(accountId)
    const pendingReadIds = []
    let hasMarkAll = false

    for (const action of pendingActions) {
      if (action.type === 'mark_read') {
        if (action.mark_all) {
          hasMarkAll = true
        } else if (action.notification_id) {
          pendingReadIds.push(action.notification_id)
        }
      }
    }

    if (hasMarkAll) {
      await markNotificationsRead({ markAll: true })
      for (const a of pendingActions) {
        await removePendingAction(a.id)
      }
    } else if (pendingReadIds.length > 0) {
      await markNotificationsRead({ notificationIds: pendingReadIds })
      for (const a of pendingActions) {
        await removePendingAction(a.id)
      }
    }

    // Fetch latest notifications from server
    const serverData = await getNotifications()
    let reconciled = cached

    if (serverData && Array.isArray(serverData.notifications)) {
      reconciled = reconcileNotifications(cached, serverData.notifications)
      await saveCachedNotifications(accountId, reconciled)
    }

    const unread = reconciled.filter((n) => !n.is_read).length
    return {
      notifications: reconciled,
      unreadCount: unread,
      isOffline: false,
      isSyncing: false,
      error: null,
    }
  } catch (err) {
    // Fall back safely to cached data on server or network error
    const unread = cached.filter((n) => !n.is_read).length
    return {
      notifications: cached,
      unreadCount: unread,
      isOffline: true,
      isSyncing: false,
      error: 'SYNC_FAILED',
    }
  }
}

/**
 * Handle marking notification(s) as read.
 */
export async function markNotificationAsRead(user, notificationId = null, markAll = false) {
  const accountId = user ? user.id : 'guest'
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

  // 1. Mark in cache immediately (optimistic update)
  await markCachedAsRead(accountId, notificationId, markAll)

  // 2. If authenticated and online, push to server
  if (user && isOnline) {
    try {
      if (markAll) {
        await markNotificationsRead({ markAll: true })
      } else if (notificationId) {
        await markNotificationsRead({ notificationIds: [String(notificationId)] })
      }
      // Clear matching pending action
      const pending = await getPendingActions(accountId)
      for (const a of pending) {
        if (markAll && a.mark_all) {
          await removePendingAction(a.id)
        } else if (notificationId && a.notification_id === String(notificationId)) {
          await removePendingAction(a.id)
        }
      }
    } catch {
      // Pending action is preserved in cache for retry on reconnect
    }
  }

  // Return updated cached items
  const updated = await getCachedNotifications(accountId)
  const unread = updated.filter((n) => !n.is_read).length
  return {
    notifications: updated,
    unreadCount: unread,
  }
}

/**
 * Handle user logout or account switch: purge previous account notifications.
 */
export async function handleLogout(previousUserId) {
  if (previousUserId) {
    await clearAccountCache(previousUserId)
  }
}

/**
 * Resolves the target application route hash for a given notification.
 * Returns a hash string like '#/', '#/m1', '#/learn', '#/daily', '#/journey',
 * or null if the notification has no specific navigation destination.
 */
export function getNotificationDestination(item) {
  if (!item || typeof item !== 'object') return null

  const data = item.data && typeof item.data === 'object' ? item.data : {}

  // 1. Explicit valid target in metadata
  const metaDest = data.route || data.destination || data.target
  if (typeof metaDest === 'string') {
    const trimmed = metaDest.trim()
    if (trimmed === 'home' || trimmed === '/' || trimmed === '#/' || trimmed === '#') {
      return '#/'
    }
    const clean = trimmed.replace(/^#\/?/, '').toLowerCase()
    const validRoutes = ['m1', 'm2', 'm3', 'm4', 'learn', 'journey', 'account', 'daily', 'arena', 'game']
    if (validRoutes.includes(clean)) {
      return `#/${clean}`
    }
  }

  const titleKey = typeof item.title_key === 'string' ? item.title_key : ''
  const category = typeof data.category === 'string' ? data.category.toLowerCase() : ''
  const notifId = typeof item.id === 'string' ? item.id : ''
  const type = typeof item.type === 'string' ? item.type.toLowerCase() : ''

  // 2. Welcome, Defender! & Welcome notifications -> Home / Dashboard
  if (
    titleKey === 'notif.guest_welcome_title' ||
    titleKey === 'notif.welcome_title' ||
    notifId === 'guest_welcome' ||
    category === 'welcome'
  ) {
    return '#/'
  }

  // 3. Offline Protection Ready -> Learn page (or offline info)
  if (
    titleKey === 'notif.offline_ready_title' ||
    notifId === 'guest_offline_ready' ||
    category === 'offline'
  ) {
    return '#/learn'
  }

  // 4. Defensive Tip: Verify Before Clicking -> M1 Link Checker
  if (
    titleKey === 'notif.security_tip_title' ||
    notifId === 'guest_security_tip' ||
    category === 'security' ||
    category === 'advance_fee_phishing' ||
    category === 'phishing' ||
    category === 'm1'
  ) {
    return '#/m1'
  }

  // 5. Daily Challenge notifications -> Daily Challenge
  if (
    type === 'challenge' ||
    titleKey === 'notif.daily_available_title' ||
    titleKey === 'notif.daily_completed_title' ||
    Boolean(data.date) ||
    category === 'challenge' ||
    category === 'daily'
  ) {
    return '#/daily'
  }

  // 6. Quiz / Learning modules -> Learn page
  if (
    titleKey === 'notif.quiz_level_passed_title' ||
    data.level !== undefined ||
    category === 'quiz' ||
    category === 'learn'
  ) {
    return '#/learn'
  }

  // 7. Arena notifications -> Cyber Attack & Defense Arena
  if (
    category === 'arena' ||
    titleKey === 'notif.arena_completed_title' ||
    Boolean(data.scenario_id) ||
    data.badge_id === 'badge_threat_spotter' ||
    data.badge_id === 'badge_defense_specialist' ||
    data.badge_id === 'badge_battle_strategist' ||
    data.badge_id === 'badge_arena_master' ||
    data.badge_id === 'badge_arena_grandmaster'
  ) {
    return '#/arena'
  }

  // 8. Badges & Mission Progress -> Cyber Hero Journey
  if (
    titleKey === 'notif.badge_earned_title' ||
    Boolean(data.badge_id) ||
    Boolean(data.mission_id) ||
    category === 'badge' ||
    category === 'journey' ||
    category === 'mission'
  ) {
    return '#/journey'
  }

  // 9. Account / Profile
  if (category === 'account' || category === 'auth' || category === 'profile') {
    return '#/account'
  }

  // 9. Specific tools
  if (category === 'm2' || category === 'crypto') return '#/m2'
  if (category === 'm3' || category === 'incident') return '#/m3'
  if (category === 'm4' || category === 'simulation') return '#/m4'

  // 10. If a notification has no valid destination, keep it readable without navigating
  return null
}

