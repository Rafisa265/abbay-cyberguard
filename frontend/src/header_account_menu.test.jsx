import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import HeaderAccountMenu from './components/HeaderAccountMenu.jsx'
import App from './App.jsx'
import { makeT } from './i18n.js'

describe('ABBAY CYBERGUARD — Unified Account Access Icon Suite', () => {
  const t = makeT('en')

  it('1. Renders ONLY ONE account icon in guest mode and no separate sign in/register buttons', () => {
    const html = renderToString(
      React.createElement(HeaderAccountMenu, {
        user: null,
        onLogout: vi.fn(),
        onNavigate: vi.fn(),
        t,
      })
    )

    // Single guest account button
    expect(html).toContain('header-account-guest-btn')
    expect(html).toContain('lucide-user-round-plus')
    expect(html).toContain('aria-label="Account Access"')

    // No separate visible Sign In / Register buttons in header
    expect(html).not.toContain('header-signin-btn')
    expect(html).not.toContain('header-register-btn')
    expect(html).not.toContain('header-auth-group')
  })

  it('2. In authenticated mode, replaces guest icon with user profile initials and name', () => {
    const mockUser = {
      display_name: 'Abebe Bikila',
      email: 'abebe@example.com',
    }

    const html = renderToString(
      React.createElement(HeaderAccountMenu, {
        user: mockUser,
        onLogout: vi.fn(),
        onNavigate: vi.fn(),
        t,
      })
    )

    // Guest button is gone
    expect(html).not.toContain('header-account-guest-btn')
    expect(html).not.toContain('lucide-user-round-plus')

    // Authenticated profile button is present
    expect(html).toContain('header-user-profile-btn')
    expect(html).toContain('user-initials-badge')
    expect(html).toContain('AB') // Initials
    expect(html).toContain('Abebe') // First name
  })

  it('3. Full App render in guest mode displays single unified account button and preserves utility classes', () => {
    const html = renderToString(React.createElement(App))

    // Verified single account button in header actions
    expect(html).toContain('header-account-guest-btn')
    expect(html).toContain('lucide-user-round-plus')
    expect(html).toContain('header-utility-account')

    // Verified no separate Sign In / Register buttons in header
    expect(html).not.toContain('header-signin-btn')
    expect(html).not.toContain('header-register-btn')
  })

  it('4. HeaderAccountMenu supports Afaan Oromoo and Amharic labels without errors', () => {
    const tOm = makeT('om')
    const tAm = makeT('am')

    const htmlOm = renderToString(
      React.createElement(HeaderAccountMenu, { user: null, onLogout: vi.fn(), onNavigate: vi.fn(), t: tOm })
    )
    expect(htmlOm).toContain('Banka Herregaa')

    const htmlAm = renderToString(
      React.createElement(HeaderAccountMenu, { user: null, onLogout: vi.fn(), onNavigate: vi.fn(), t: tAm })
    )
    expect(htmlAm).toContain('የመለያ መግቢያ')
  })
})
