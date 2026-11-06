import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'
import { makeT } from './i18n.js'
import {
  getCachedNotifications,
  saveCachedNotifications,
  markCachedAsRead,
  getPendingActions,
  removePendingAction,
  clearAccountCache,
  getGuestDefaultNotifications,
} from './lib/notificationStorage.js'
import {
  reconcileNotifications,
  loadNotifications,
  markNotificationAsRead,
  handleLogout,
  getNotificationDestination,
} from './lib/notificationManager.js'
import {
  getNotifications,
  markNotificationsRead,
  syncNotifications,
  createNotification,
} from './lib/api.js'

describe('Notification Center - Comprehensive Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis
    }
  })

  describe('1. Trilingual Localization & Privacy (EN, OM, AM)', () => {
    const notifKeys = [
      'notif.title',
      'notif.bell_aria',
      'notif.unread_count',
      'notif.mark_all_read',
      'notif.empty',
      'notif.empty_sub',
      'notif.loading',
      'notif.offline_badge',
      'notif.syncing',
      'notif.guest_mode',
      'notif.mark_read',
      'notif.close',
      'notif.just_now',
      'notif.mins_ago',
      'notif.hours_ago',
      'notif.days_ago',
      'notif.welcome_title',
      'notif.welcome_msg',
      'notif.guest_welcome_title',
      'notif.guest_welcome_msg',
      'notif.offline_ready_title',
      'notif.offline_ready_msg',
      'notif.security_tip_title',
      'notif.security_tip_msg',
      'notif.generic_title',
      'notif.generic_msg',
    ]

    it('contains all notification keys across EN, OM, AM with non-empty values', () => {
      for (const d of [en, om, am]) {
        for (const k of notifKeys) {
          expect(d[k]).toBeTruthy()
          expect(typeof d[k]).toBe('string')
          expect(d[k].trim().length).toBeGreaterThan(0)
        }
      }
    })

    it('contains zero sensitive tokens or false security guarantees in notification strings', () => {
      for (const d of [en, om, am]) {
        for (const k of notifKeys) {
          const val = d[k].toLowerCase()
          expect(val).not.toMatch(/\b(password|pin|otp|secret|token|api_key)\b/)
          expect(val).not.toMatch(/\b(guarantees security|100% safe|certified|unhackable)\b/)
        }
      }
    })
  })

  describe('2. Notification Storage & Account Isolation', () => {
    it('returns default guest notifications without sensitive data', () => {
      const guestNotifs = getGuestDefaultNotifications()
      expect(Array.isArray(guestNotifs)).toBe(true)
      expect(guestNotifs.length).toBeGreaterThanOrEqual(3)
      for (const n of guestNotifs) {
        expect(n.account_id).toBe('guest')
        expect(n.is_read).toBe(false)
        expect(n.is_local_only).toBe(true)
        expect(JSON.stringify(n)).not.toMatch(/password|secret|token|otp/i)
      }
    })

    it('saves and retrieves notifications isolated per account', async () => {
      const userAId = 'user_aaa_111'
      const userBId = 'user_bbb_222'

      await saveCachedNotifications(userAId, [
        {
          id: 'notif_1',
          type: 'system',
          title_key: 'notif.welcome_title',
          message_key: 'notif.welcome_msg',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ])

      await saveCachedNotifications(userBId, [
        {
          id: 'notif_2',
          type: 'security',
          title_key: 'notif.security_tip_title',
          message_key: 'notif.security_tip_msg',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ])

      const userAItems = await getCachedNotifications(userAId)
      const userBItems = await getCachedNotifications(userBId)

      expect(userAItems.length).toBe(1)
      expect(userAItems[0].id).toBe('notif_1')

      expect(userBItems.length).toBe(1)
      expect(userBItems[0].id).toBe('notif_2')

      // Purging User A does not affect User B or Guest
      await clearAccountCache(userAId)
      const userAAfter = await getCachedNotifications(userAId)
      const userBAfter = await getCachedNotifications(userBId)

      expect(userAAfter.length).toBe(0)
      expect(userBAfter.length).toBe(1)
      expect(userBAfter[0].id).toBe('notif_2')
    })

    it('marks notifications as read locally and records pending action for sync', async () => {
      const testUserId = 'user_test_read_1'
      await saveCachedNotifications(testUserId, [
        {
          id: 'item_unread_1',
          type: 'info',
          title_key: 'notif.generic_title',
          message_key: 'notif.generic_msg',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ])

      await markCachedAsRead(testUserId, 'item_unread_1', false)
      const items = await getCachedNotifications(testUserId)
      expect(items[0].is_read).toBe(true)
      expect(items[0].read_at).toBeTruthy()

      const actions = await getPendingActions(testUserId)
      expect(actions.length).toBe(1)
      expect(actions[0].type).toBe('mark_read')
      expect(actions[0].notification_id).toBe('item_unread_1')

      await removePendingAction(actions[0].id)
      const remainingActions = await getPendingActions(testUserId)
      expect(remainingActions.length).toBe(0)
    })
  })

  describe('3. Notification Coordinator & Reconciliation', () => {
    it('reconciles local and remote notifications safely preserving local read status', () => {
      const local = [
        {
          id: 'n_100',
          type: 'system',
          title_key: 'notif.welcome_title',
          is_read: true, // Marked read while offline
          read_at: '2026-10-22T10:00:00Z',
          created_at: '2026-10-22T09:00:00Z',
        },
      ]
      const remote = [
        {
          id: 'n_100',
          type: 'system',
          title_key: 'notif.welcome_title',
          is_read: false, // Server still shows unread
          created_at: '2026-10-22T09:00:00Z',
        },
        {
          id: 'n_101',
          type: 'tip',
          title_key: 'notif.security_tip_title',
          is_read: false,
          created_at: '2026-10-22T11:00:00Z',
        },
      ]

      const merged = reconcileNotifications(local, remote)
      expect(merged.length).toBe(2)
      // Newest first
      expect(merged[0].id).toBe('n_101')
      expect(merged[1].id).toBe('n_100')
      // Local read status is preserved
      expect(merged[1].is_read).toBe(true)
      expect(merged[1].read_at).toBe('2026-10-22T10:00:00Z')
    })

    it('loads default notifications for guest without throwing', async () => {
      const result = await loadNotifications(null)
      expect(result.notifications.length).toBeGreaterThanOrEqual(3)
      expect(result.unreadCount).toBeGreaterThanOrEqual(1)
      expect(result.error).toBeNull()
    })

    it('handleLogout clears target user cache', async () => {
      const targetUser = 'logout_user_99'
      await saveCachedNotifications(targetUser, [
        { id: 'notif_logout_1', type: 'system', is_read: false },
      ])
      await handleLogout(targetUser)
      const remaining = await getCachedNotifications(targetUser)
      expect(remaining.length).toBe(0)
    })
  })

  describe('4. API Client Notification Endpoints', () => {
    it('getNotifications calls /api/v1/notifications with credentials: include', async () => {
      globalThis.window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ notifications: [], total: 0, unread_count: 0 }),
      })

      const res = await getNotifications()
      expect(res).toEqual({ notifications: [], total: 0, unread_count: 0 })
      expect(globalThis.window.fetch).toHaveBeenCalledWith(
        '/api/v1/notifications',
        expect.objectContaining({ method: 'GET', credentials: 'include' })
      )
    })

    it('markNotificationsRead posts array of IDs or markAll', async () => {
      globalThis.window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', marked_count: 1 }),
      })

      const res = await markNotificationsRead({ notificationIds: ['abc-123'] })
      expect(res.marked_count).toBe(1)
      expect(globalThis.window.fetch).toHaveBeenCalledWith(
        '/api/v1/notifications/mark-read',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ notification_ids: ['abc-123'], mark_all: false }),
        })
      )
    })

    it('syncNotifications posts pending read IDs and last sync timestamp', async () => {
      globalThis.window.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ notifications: [], server_timestamp: '2026-10-22T12:00:00Z' }),
      })

      const res = await syncNotifications({
        lastSyncTimestamp: '2026-10-22T10:00:00Z',
        pendingReadIds: ['n1'],
      })
      expect(res.server_timestamp).toBe('2026-10-22T12:00:00Z')
    })
  })

  describe('5. CSS Responsive Styles & UI Contract', () => {
    const cssPath = resolve(__dirname, 'styles.css')
    const css = readFileSync(cssPath, 'utf8')

    it('contains bell button, badge, panel, and responsive media query styles', () => {
      expect(css).toContain('.notif-center')
      expect(css).toContain('.notif-bell-btn')
      expect(css).toContain('.notif-badge')
      expect(css).toContain('.notif-panel')
      expect(css).toContain('.notif-status-bar')
      expect(css).toContain('.notif-card')
      expect(css).toContain('.notif-card.unread')
      expect(css).toContain('.notif-card.read')
      expect(css).toContain('.notif-item-read-btn')
      expect(css).toMatch(/@media\s*\(\s*max-width:\s*600px\s*\)/)
    })

    it('enforces touch target accessibility on mobile', () => {
      expect(css).toMatch(/min-height:\s*44px/)
      expect(css).toMatch(/min-width:\s*44px/)
    })
  })

  describe('6. Notification Navigation & Destination Routing', () => {
    const cssPath = resolve(__dirname, 'styles.css')
    const css = readFileSync(cssPath, 'utf8')

    it('navigates Welcome, Defender! and welcome notifications to Home/Dashboard (#/)', () => {
      const guestWelcome = { id: 'guest_welcome', title_key: 'notif.guest_welcome_title' }
      const authWelcome = { id: 'welcome_1', title_key: 'notif.welcome_title' }
      const catWelcome = { id: 'cat_w', data: { category: 'welcome' } }

      expect(getNotificationDestination(guestWelcome)).toBe('#/')
      expect(getNotificationDestination(authWelcome)).toBe('#/')
      expect(getNotificationDestination(catWelcome)).toBe('#/')
    })

    it('navigates Offline Protection Ready to Learn page (#/learn)', () => {
      const offlineNotif = { id: 'guest_offline_ready', title_key: 'notif.offline_ready_title' }
      const catOffline = { id: 'cat_off', data: { category: 'offline' } }

      expect(getNotificationDestination(offlineNotif)).toBe('#/learn')
      expect(getNotificationDestination(catOffline)).toBe('#/learn')
    })

    it('navigates Defensive Tip: Verify Before Clicking to M1 Link Checker (#/m1)', () => {
      const tipNotif = { id: 'guest_security_tip', title_key: 'notif.security_tip_title' }
      const phishingNotif = { id: 'tip_phish', data: { category: 'advance_fee_phishing' } }
      const m1Notif = { id: 'm1_tip', data: { category: 'security' } }

      expect(getNotificationDestination(tipNotif)).toBe('#/m1')
      expect(getNotificationDestination(phishingNotif)).toBe('#/m1')
      expect(getNotificationDestination(m1Notif)).toBe('#/m1')
    })

    it('navigates Daily Challenge notifications to #/daily', () => {
      const dcType = { id: 'd1', type: 'challenge' }
      const dcAvail = { id: 'd2', title_key: 'notif.daily_available_title' }
      const dcDone = { id: 'd3', title_key: 'notif.daily_completed_title' }
      const dcDate = { id: 'd4', data: { date: '2026-10-22' } }

      expect(getNotificationDestination(dcType)).toBe('#/daily')
      expect(getNotificationDestination(dcAvail)).toBe('#/daily')
      expect(getNotificationDestination(dcDone)).toBe('#/daily')
      expect(getNotificationDestination(dcDate)).toBe('#/daily')
    })

    it('navigates Quiz module passes to #/learn', () => {
      const quizNotif = { id: 'q1', title_key: 'notif.quiz_level_passed_title' }
      const quizLevel = { id: 'q2', data: { level: 2 } }

      expect(getNotificationDestination(quizNotif)).toBe('#/learn')
      expect(getNotificationDestination(quizLevel)).toBe('#/learn')
    })

    it('navigates Badges and Journey progress to #/journey', () => {
      const badgeNotif = { id: 'b1', title_key: 'notif.badge_earned_title' }
      const badgeData = { id: 'b2', data: { badge_id: 'badge_daily_defender' } }
      const missionData = { id: 'm_notif', data: { mission_id: 'm02' } }

      expect(getNotificationDestination(badgeNotif)).toBe('#/journey')
      expect(getNotificationDestination(badgeData)).toBe('#/journey')
      expect(getNotificationDestination(missionData)).toBe('#/journey')
    })

    it('supports metadata route overrides for valid routes', () => {
      expect(getNotificationDestination({ id: 'r1', data: { route: 'm2' } })).toBe('#/m2')
      expect(getNotificationDestination({ id: 'r2', data: { route: 'account' } })).toBe('#/account')
      expect(getNotificationDestination({ id: 'r3', data: { destination: 'home' } })).toBe('#/')
    })

    it('returns null for notifications with no valid destination without routing to unrelated pages', () => {
      const generic = { id: 'g1', title_key: 'notif.generic_title' }
      const random = { id: 'g2', title_key: 'some.unknown.key' }
      const empty = null

      expect(getNotificationDestination(generic)).toBeNull()
      expect(getNotificationDestination(random)).toBeNull()
      expect(getNotificationDestination(empty)).toBeNull()
    })

    it('contains CSS styling for navigable notification cards and indicators', () => {
      expect(css).toContain('.notif-card-navigable')
      expect(css).toContain('.notif-card-indicators')
      expect(css).toContain('.notif-card-arrow')
    })
  })
})
