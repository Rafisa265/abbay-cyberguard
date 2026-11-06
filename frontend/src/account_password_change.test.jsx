import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import Account from './components/Account.jsx'
import { makeT } from './i18n.js'

describe('ABBAY CYBERGUARD — Account Password Change UI & Localization Integration', () => {
  const mockUser = {
    id: 42,
    display_name: 'Test Agent',
    email: 'agent@abbayguard.et',
    created_at: '2026-11-01T10:00:00Z',
    preferences: {
      cloud_progress_sync_enabled: false,
    },
  }

  it('1. Renders Change Password form for authenticated users', () => {
    const t = makeT('en')
    const html = renderToString(
      React.createElement(Account, {
        t,
        user: mockUser,
        setUser: vi.fn(),
        onSyncProgress: vi.fn(),
      })
    )

    // Verify presence of Change Password Card
    expect(html).toContain('change-password-card')
    expect(html).toContain(t('auth.change_pwd_title'))
    expect(html).toContain(t('auth.curr_pwd'))
    expect(html).toContain(t('auth.new_pwd'))
    expect(html).toContain(t('auth.confirm_new_pwd'))
    expect(html).toContain(t('auth.btn_change_pwd'))

    // Verify accessibility and security form attributes
    expect(html).toContain('id="current-password-input"')
    expect(html).toContain('autoComplete="current-password"')
    expect(html).toContain('id="new-password-input"')
    expect(html).toContain('autoComplete="new-password"')
    expect(html).toContain('id="confirm-new-password-input"')
  })

  it('2. Does not render Change Password form in guest mode', () => {
    const t = makeT('en')
    const html = renderToString(
      React.createElement(Account, {
        t,
        user: null,
        setUser: vi.fn(),
        onSyncProgress: vi.fn(),
      })
    )

    // Guest mode shows login/register forms, never password change
    expect(html).not.toContain('change-password-card')
    expect(html).toContain('auth-forms-container')
  })

  it('3. Renders full password change interface in Afaan Oromoo (OM)', () => {
    const tOm = makeT('om')
    const html = renderToString(
      React.createElement(Account, {
        t: tOm,
        user: mockUser,
        setUser: vi.fn(),
        onSyncProgress: vi.fn(),
      })
    )

    expect(html).toContain('change-password-card')
    expect(html).toContain('Jecha Darbii Herregaa Jijjiiri')
    expect(html).toContain('Jecha Darbii Ammaa')
    expect(html).toContain('Jecha Darbii Haaraa')
    expect(html).toContain('Jecha Darbii Haaromsi')
  })

  it('4. Renders full password change interface in Amharic (AM)', () => {
    const tAm = makeT('am')
    const html = renderToString(
      React.createElement(Account, {
        t: tAm,
        user: mockUser,
        setUser: vi.fn(),
        onSyncProgress: vi.fn(),
      })
    )

    expect(html).toContain('change-password-card')
    expect(html).toContain('የመለያ የይለፍ ቃል ቀይር')
    expect(html).toContain('የአሁኑ የይለፍ ቃል')
    expect(html).toContain('አዲስ የይለፍ ቃል')
    expect(html).toContain('የይለፍ ቃል አዘምን')
  })

  it('5. Renders accurate Cloud Sync status when sync is strictly OFF', () => {
    const t = makeT('en')
    const userWithSyncOff = {
      ...mockUser,
      preferences: { cloud_progress_sync_enabled: false },
    }
    const html = renderToString(
      React.createElement(Account, {
        t,
        user: userWithSyncOff,
        setUser: vi.fn(),
        onSyncProgress: vi.fn(),
      })
    )

    // Must show OFF description and OFF badge, never ACTIVE or backed up
    expect(html).toContain(t('auth.sync_desc_off'))
    expect(html).toContain(t('auth.sync_status_off'))
    expect(html).not.toContain(t('auth.sync_status_on'))
    expect(html).not.toContain(t('auth.sync_status_pending'))
  })

  it('6. Renders PENDING status when Cloud Sync is enabled but no cloud backup recorded yet', () => {
    const t = makeT('en')
    const userWithSyncOn = {
      ...mockUser,
      preferences: { cloud_progress_sync_enabled: true },
    }
    const html = renderToString(
      React.createElement(Account, {
        t,
        user: userWithSyncOn,
        setUser: vi.fn(),
        onSyncProgress: vi.fn(),
      })
    )

    // Must show ON description and PENDING badge, NEVER falsely claiming progress is backed up
    expect(html).toContain(t('auth.sync_desc_on'))
    expect(html).toContain(t('auth.sync_status_pending'))
    expect(html).not.toContain(t('auth.sync_desc_off'))
    expect(html).not.toContain(t('auth.sync_status_on'))
  })

  it('7. Verifies Cloud Sync localized strings across EN, OM, and AM have full parity', () => {
    const tEn = makeT('en')
    const tOm = makeT('om')
    const tAm = makeT('am')

    // EN checks
    expect(tEn('auth.sync_desc_off')).toContain('strictly OFF')
    expect(tEn('auth.sync_desc_on')).toContain('currently ENABLED')
    expect(tEn('auth.sync_status_pending')).toContain('No cloud backup recorded yet')

    // OM checks
    expect(tOm('auth.sync_desc_off')).toContain('Dhaameera')
    expect(tOm('auth.sync_desc_on')).toContain('BANAMEERA')
    expect(tOm('auth.sync_status_pending')).toContain('hin galmoofne')

    // AM checks
    expect(tAm('auth.sync_desc_off')).toContain('ጠፍቷል')
    expect(tAm('auth.sync_desc_on')).toContain('በርቷል')
    expect(tAm('auth.sync_status_pending')).toContain('የደመና ቅጂ የለም')
  })
})

