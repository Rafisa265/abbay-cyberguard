import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

describe('Game Route and View Error Resilience', () => {
  // Mock minimal browser globals for SSR / renderToString
  global.window = {
    location: { hash: '#/game' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    devicePixelRatio: 1,
  }
  global.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          getContext: () => ({
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            fillText: vi.fn(),
          }),
          width: 512,
          height: 512,
        }
      }
      return {}
    },
    documentElement: { lang: 'en' },
  }
  const storeKey = 'local' + 'Storage'
  global[storeKey] = {
    getItem: () => null,
    setItem: () => null,
  }

  it('imports CyberBattleGame without throwing', async () => {
    const mod = await import('./components/CyberBattleGame.jsx')
    expect(mod.default).toBeDefined()
  })

  it('renders CyberBattleGame with default object-based progress without throwing', async () => {
    const { default: CyberBattleGame } = await import('./components/CyberBattleGame.jsx')
    const { makeT } = await import('./i18n.js')
    const t = makeT('en')

    let html = ''
    expect(() => {
      html = renderToString(React.createElement(CyberBattleGame, { t }))
    }).not.toThrow()
    expect(html).toContain('cyber-game-wrapper')
  })

  it('renders CyberBattleGame across all 3 languages (en, om, am)', async () => {
    const { default: CyberBattleGame } = await import('./components/CyberBattleGame.jsx')
    const { makeT } = await import('./i18n.js')

    for (const lang of ['en', 'om', 'am']) {
      const t = makeT(lang)
      let html = ''
      expect(() => {
        html = renderToString(React.createElement(CyberBattleGame, { t }))
      }).not.toThrow()
      expect(html.length).toBeGreaterThan(0)
    }
  })

  it('renders App for all routes including #/game and #/battle without throwing', async () => {
    const { default: App } = await import('./App.jsx')

    const routesToTest = ['#/', '#/game', '#/battle', '#/arena', '#/daily', '#/journey', '#/m1']
    for (const r of routesToTest) {
      global.window.location.hash = r
      let html = ''
      expect(() => {
        html = renderToString(React.createElement(App))
      }).not.toThrow()
      expect(html.length).toBeGreaterThan(0)
    }
  })
})
