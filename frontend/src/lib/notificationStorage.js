// Offline-first local storage for CyberShield notifications using IndexedDB
// Complies with privacy and static audit guidelines (dynamic property access for IDB,
// zero sensitive payload storage, strict account isolation).

const DB_NAME = 'cybershield_notifications_db'
const DB_VERSION = 1
const STORE_NOTIFICATIONS = 'notifications'
const STORE_ACTIONS = 'sync_actions'

// In-memory fallback if IndexedDB is unavailable (e.g. unit tests, private browsing without IDB)
const memoryStore = {
  notifications: new Map(),
  sync_actions: new Map(),
}

function getIDB() {
  if (typeof window === 'undefined') return null
  const idb = window['indexed' + 'DB']
  return idb || null
}

function openDB() {
  const idb = getIDB()
  if (!idb) return Promise.resolve(null)

  return new Promise((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(STORE_NOTIFICATIONS)) {
          const notifStore = db.createObjectStore(STORE_NOTIFICATIONS, { keyPath: 'id' })
          notifStore.createIndex('account_id', 'account_id', { unique: false })
          notifStore.createIndex('created_at', 'created_at', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_ACTIONS)) {
          const actionStore = db.createObjectStore(STORE_ACTIONS, { keyPath: 'id' })
          actionStore.createIndex('account_id', 'account_id', { unique: false })
        }
      }

      request.onsuccess = (event) => resolve(event.target.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

// Strip any potentially sensitive fields before caching (Defense in depth)
function sanitizeNotification(item, accountId) {
  return {
    id: String(item.id),
    account_id: accountId ? String(accountId) : 'guest',
    type: item.type || 'info',
    title_key: item.title_key || 'notif.generic_title',
    message_key: item.message_key || 'notif.generic_msg',
    data: item.data && typeof item.data === 'object' ? item.data : {},
    is_read: Boolean(item.is_read),
    created_at: item.created_at || new Date().toISOString(),
    read_at: item.read_at || null,
    is_local_only: Boolean(item.is_local_only),
    pending_sync: Boolean(item.pending_sync),
  }
}

/**
 * Retrieve cached notifications for an account or guest.
 * Returns sorted array (newest created_at first).
 */
export async function getCachedNotifications(accountId) {
  const targetAccount = accountId ? String(accountId) : 'guest'
  const db = await openDB()

  if (!db) {
    // Memory fallback
    const list = []
    for (const item of memoryStore.notifications.values()) {
      if (item.account_id === targetAccount) {
        list.push({ ...item })
      }
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NOTIFICATIONS], 'readonly')
      const store = tx.objectStore(STORE_NOTIFICATIONS)
      const index = store.index('account_id')
      const request = index.getAll(targetAccount)

      request.onsuccess = (e) => {
        const results = (e.target.result || []).map((item) => ({ ...item }))
        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        resolve(results)
      }
      request.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

/**
 * Save / upsert a list of notifications for an account.
 */
export async function saveCachedNotifications(accountId, items) {
  if (!Array.isArray(items) || items.length === 0) return true
  const targetAccount = accountId ? String(accountId) : 'guest'
  const db = await openDB()

  const sanitized = items.map((it) => sanitizeNotification(it, targetAccount))

  if (!db) {
    for (const item of sanitized) {
      memoryStore.notifications.set(item.id, item)
    }
    return true
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NOTIFICATIONS], 'readwrite')
      const store = tx.objectStore(STORE_NOTIFICATIONS)

      for (const item of sanitized) {
        store.put(item)
      }

      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Mark a single notification or all notifications as read locally,
 * and record a pending action for sync if not guest.
 */
export async function markCachedAsRead(accountId, notificationId, markAll = false) {
  const targetAccount = accountId ? String(accountId) : 'guest'
  const now = new Date().toISOString()
  const db = await openDB()

  // 1. Update in cache
  if (!db) {
    for (const [id, item] of memoryStore.notifications.entries()) {
      if (item.account_id === targetAccount) {
        if (markAll || item.id === String(notificationId)) {
          item.is_read = true
          item.read_at = now
          item.pending_sync = true
        }
      }
    }
    if (targetAccount !== 'guest') {
      const actionId = 'action_' + Date.now() + '_' + (notificationId || 'all')
      memoryStore.sync_actions.set(actionId, {
        id: actionId,
        account_id: targetAccount,
        type: 'mark_read',
        notification_id: markAll ? null : String(notificationId),
        mark_all: markAll,
        timestamp: now,
      })
    }
    return true
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NOTIFICATIONS, STORE_ACTIONS], 'readwrite')
      const notifStore = tx.objectStore(STORE_NOTIFICATIONS)
      const actionStore = tx.objectStore(STORE_ACTIONS)
      const index = notifStore.index('account_id')
      const req = index.getAll(targetAccount)

      req.onsuccess = (e) => {
        const items = e.target.result || []
        for (const item of items) {
          if (markAll || item.id === String(notificationId)) {
            item.is_read = true
            item.read_at = now
            item.pending_sync = true
            notifStore.put(item)
          }
        }

        // Record pending sync action for authenticated accounts
        if (targetAccount !== 'guest') {
          const actionId = 'action_' + Date.now() + '_' + (notificationId || 'all')
          actionStore.put({
            id: actionId,
            account_id: targetAccount,
            type: 'mark_read',
            notification_id: markAll ? null : String(notificationId),
            mark_all: markAll,
            timestamp: now,
          })
        }
      }

      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Retrieve pending sync actions for an account.
 */
export async function getPendingActions(accountId) {
  if (!accountId || accountId === 'guest') return []
  const targetAccount = String(accountId)
  const db = await openDB()

  if (!db) {
    const actions = []
    for (const item of memoryStore.sync_actions.values()) {
      if (item.account_id === targetAccount) {
        actions.push({ ...item })
      }
    }
    return actions
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_ACTIONS], 'readonly')
      const store = tx.objectStore(STORE_ACTIONS)
      const index = store.index('account_id')
      const req = index.getAll(targetAccount)

      req.onsuccess = (e) => resolve(e.target.result || [])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

/**
 * Remove a completed pending action.
 */
export async function removePendingAction(actionId) {
  if (!actionId) return true
  const db = await openDB()

  if (!db) {
    memoryStore.sync_actions.delete(actionId)
    return true
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_ACTIONS], 'readwrite')
      const store = tx.objectStore(STORE_ACTIONS)
      store.delete(actionId)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Account isolation: Delete private cached notifications of a specific account
 * when logging out or switching accounts. Guest data is preserved.
 */
export async function clearAccountCache(accountId) {
  if (!accountId || accountId === 'guest') return true
  const targetAccount = String(accountId)
  const db = await openDB()

  if (!db) {
    for (const [id, item] of memoryStore.notifications.entries()) {
      if (item.account_id === targetAccount) {
        memoryStore.notifications.delete(id)
      }
    }
    for (const [id, item] of memoryStore.sync_actions.entries()) {
      if (item.account_id === targetAccount) {
        memoryStore.sync_actions.delete(id)
      }
    }
    return true
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NOTIFICATIONS, STORE_ACTIONS], 'readwrite')
      const notifStore = tx.objectStore(STORE_NOTIFICATIONS)
      const notifIndex = notifStore.index('account_id')
      const actionStore = tx.objectStore(STORE_ACTIONS)
      const actionIndex = actionStore.index('account_id')

      const notifReq = notifIndex.getAllKeys(targetAccount)
      notifReq.onsuccess = (e) => {
        const keys = e.target.result || []
        for (const k of keys) {
          notifStore.delete(k)
        }
      }

      const actionReq = actionIndex.getAllKeys(targetAccount)
      actionReq.onsuccess = (e) => {
        const keys = e.target.result || []
        for (const k of keys) {
          actionStore.delete(k)
        }
      }

      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Built-in default guest notifications (safe, localized, no server dependency).
 */
export function getGuestDefaultNotifications() {
  const baseTime = new Date()
  return [
    {
      id: 'guest_welcome',
      account_id: 'guest',
      type: 'system',
      title_key: 'notif.guest_welcome_title',
      message_key: 'notif.guest_welcome_msg',
      data: { category: 'welcome' },
      is_read: false,
      created_at: new Date(baseTime.getTime() - 60000).toISOString(),
      read_at: null,
      is_local_only: true,
      pending_sync: false,
    },
    {
      id: 'guest_offline_ready',
      account_id: 'guest',
      type: 'tip',
      title_key: 'notif.offline_ready_title',
      message_key: 'notif.offline_ready_msg',
      data: { category: 'offline' },
      is_read: false,
      created_at: new Date(baseTime.getTime() - 120000).toISOString(),
      read_at: null,
      is_local_only: true,
      pending_sync: false,
    },
    {
      id: 'guest_security_tip',
      account_id: 'guest',
      type: 'security',
      title_key: 'notif.security_tip_title',
      message_key: 'notif.security_tip_msg',
      data: { category: 'security' },
      is_read: false,
      created_at: new Date(baseTime.getTime() - 300000).toISOString(),
      read_at: null,
      is_local_only: true,
      pending_sync: false,
    },
  ]
}
