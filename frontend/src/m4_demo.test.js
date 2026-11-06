import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import M4 from './components/M4.jsx'
import { getM4Scenarios, getM4Demo } from './lib/api.js'
import { makeT } from './i18n.js'
import en from './locales/en.js'

describe('M4 Website Security Check (Demo) Integration & Diagnostics', () => {
  const origFetch = global.fetch
  const origWindow = global.window

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = origFetch
    global.window = origWindow
  })

  it('1. getM4Scenarios sends GET request to /api/v1/m4/scenarios and returns scenario list', async () => {
    const mockData = {
      simulated: true,
      scenarios: [
        { id: 'DS-A', hostname: 'demo-a.example' },
        { id: 'DS-B', hostname: 'demo-b.example' },
        { id: 'DS-C', hostname: 'demo-c.example' },
      ],
    }

    global.window = {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
      }),
    }

    const data = await getM4Scenarios()
    expect(global.window.fetch).toHaveBeenCalledWith('/api/v1/m4/scenarios', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    expect(data.simulated).toBe(true)
    expect(data.scenarios).toHaveLength(3)
    expect(data.scenarios.map((s) => s.id)).toEqual(['DS-A', 'DS-B', 'DS-C'])
  })

  it('2. getM4Demo sends POST to /api/v1/m4/demo with JSON body containing scenario_id', async () => {
    const mockDemoA = {
      simulated: true,
      scenario_id: 'DS-A',
      hostname: 'demo-a.example',
      findings: [
        { check: 'CHK-01', status: 'present' },
        { check: 'CHK-02', status: 'missing' },
        { check: 'CHK-03', status: 'missing' },
        { check: 'CHK-04', status: 'missing' },
        { check: 'CHK-05', status: 'present' },
        { check: 'CHK-06', status: 'missing' },
        { check: 'CHK-07', status: 'present', detail: 'Server / X-Powered-By' },
      ],
    }

    global.window = {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDemoA,
      }),
    }

    const data = await getM4Demo('DS-A')
    expect(global.window.fetch).toHaveBeenCalledWith('/api/v1/m4/demo', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenario_id: 'DS-A' }),
    })
    expect(data.scenario_id).toBe('DS-A')
    expect(data.findings).toHaveLength(7)
  })

  it('3. validates DS-A, DS-B, and DS-C scenario fixtures data structures', async () => {
    const fixtures = {
      'DS-A': {
        simulated: true,
        scenario_id: 'DS-A',
        hostname: 'demo-a.example',
        findings: [
          { check: 'CHK-01', status: 'present' },
          { check: 'CHK-02', status: 'missing' },
          { check: 'CHK-03', status: 'missing' },
          { check: 'CHK-04', status: 'missing' },
          { check: 'CHK-05', status: 'present' },
          { check: 'CHK-06', status: 'missing' },
          { check: 'CHK-07', status: 'present', detail: 'Server / X-Powered-By' },
        ],
      },
      'DS-B': {
        simulated: true,
        scenario_id: 'DS-B',
        hostname: 'demo-b.example',
        findings: [
          { check: 'CHK-01', status: 'present' },
          { check: 'CHK-02', status: 'present' },
          { check: 'CHK-03', status: 'present' },
          { check: 'CHK-04', status: 'present' },
          { check: 'CHK-05', status: 'missing', detail: 'Permissions-Policy' },
          { check: 'CHK-06', status: 'present' },
          { check: 'CHK-07', status: 'missing' },
        ],
      },
      'DS-C': {
        simulated: true,
        scenario_id: 'DS-C',
        hostname: 'demo-c.example',
        findings: [
          { check: 'CHK-01', status: 'missing', detail: 'expired' },
          { check: 'CHK-02', status: 'unknown' },
          { check: 'CHK-03', status: 'unknown' },
          { check: 'CHK-04', status: 'unknown' },
          { check: 'CHK-05', status: 'unknown' },
          { check: 'CHK-06', status: 'unknown' },
          { check: 'CHK-07', status: 'unknown' },
        ],
      },
    }

    for (const [id, expected] of Object.entries(fixtures)) {
      global.window = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => expected,
        }),
      }

      const res = await getM4Demo(id)
      expect(res.scenario_id).toBe(id)
      expect(res.simulated).toBe(true)
      expect(res.findings).toHaveLength(7)
      expect(res.hostname).toBe(expected.hostname)
    }
  })

  it('4. throws when API endpoint returns non-200 error status', async () => {
    global.window = {
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    }

    await expect(getM4Scenarios()).rejects.toThrow('HTTP 500')
    await expect(getM4Demo('DS-A')).rejects.toThrow('HTTP 500')
  })

  it('5. renders M4 component with initial loading state and clean semantic structure', () => {
    const t = makeT('en')
    const html = renderToString(React.createElement(M4, { t }))

    expect(html).toContain('M4 SIMULATED DEMO')
    expect(html).toContain('m4-scenario-grid')
    expect(html).toContain('m4-distinction-banner')
    expect(html).toContain('m4-scope-warning')
    expect(html).toContain('loading-state')
    expect(html).toContain('Loading')
  })
})
