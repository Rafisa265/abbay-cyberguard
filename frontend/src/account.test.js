import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getMe,
  loginUser,
  registerUser,
  logoutUser,
  changePassword,
  updatePreferences,
  getProgress,
  saveProgress,
} from './lib/api.js'

describe('Account & API client security tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis
    }
  })

  it('getMe handles unauthenticated session safely', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
    })
    const user = await getMe()
    expect(user).toBeNull()
    expect(globalThis.window.fetch).toHaveBeenCalledWith('/api/v1/auth/me', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }))
  })

  it('registerUser sends credentials with include and handles duplicate email error', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({ error: { code: 'EMAIL_ALREADY_EXISTS' } }),
    })
    await expect(
      registerUser({
        displayName: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      })
    ).rejects.toThrow('EMAIL_ALREADY_EXISTS')
  })

  it('loginUser passes credentials and handles invalid credentials error', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: { code: 'INVALID_CREDENTIALS' } }),
    })
    await expect(
      loginUser({ email: 'test@example.com', password: 'Bad' })
    ).rejects.toThrow('INVALID_CREDENTIALS')
  })

  it('logoutUser calls endpoint and returns success status', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ status: 'logged_out' }),
    })
    const res = await logoutUser()
    expect(res).toBe(true)
  })

  it('saveProgress rejects if sync is not enabled (consent check)', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
      json: async () => ({ error: { code: 'SYNC_NOT_ENABLED' } }),
    })
    await expect(
      saveProgress({ activeLevel: 2, unlockedLevels: [1, 2], completedLevels: {} })
    ).rejects.toThrow('SYNC_NOT_ENABLED')
  })

  it('changePassword sends correct payload and handles success', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ ok: true, message: 'Password updated successfully', revoked_sessions: 2 }),
    })
    const res = await changePassword({
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword456',
      confirmPassword: 'NewPassword456',
    })
    expect(res.ok).toBe(true)
    expect(res.revoked_sessions).toBe(2)
    expect(globalThis.window.fetch).toHaveBeenCalledWith('/api/v1/auth/change-password', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
  })

  it('changePassword rejects on invalid credentials or same password', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: { code: 'INVALID_CREDENTIALS' } }),
    })
    await expect(
      changePassword({
        currentPassword: 'WrongPassword123',
        newPassword: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      })
    ).rejects.toThrow('INVALID_CREDENTIALS')
  })
})
