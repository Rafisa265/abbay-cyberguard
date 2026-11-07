import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { onRequest } from '../functions/api/[[path]].js'

const origin = 'https://abbay-cyberguard.pages.dev'
const publicRedirects = new URL('../public/_redirects', import.meta.url)
const publicNotFoundPage = new URL('../public/404.html', import.meta.url)
const appShell = new URL('../index.html', import.meta.url)

function makeRequest(path, { method = 'GET', headers = {}, body } = {}) {
  return new Request(`${origin}${path}`, {
    method,
    headers: { Origin: origin, ...headers },
    body,
  })
}

describe('Cloudflare Pages API proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('proxies registration without forwarding authentication credentials and preserves response headers', async () => {
    const cookie = 'cybershield_session=opaque; Path=/; HttpOnly; Secure; SameSite=lax'
    const upstreamFetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ user: { email: 'person@example.com' } }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
          'X-Content-Type-Options': 'nosniff',
        },
      }
    ))
    vi.stubGlobal('fetch', upstreamFetch)

    const response = await onRequest({
      request: makeRequest('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          Cookie: 'cybershield_session=opaque; unrelated=value',
          Authorization: 'Bearer caller-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'person@example.com' }),
      }),
    })

    const upstreamRequest = upstreamFetch.mock.calls[0][0]
    expect(new URL(upstreamRequest.url).origin).toBe('https://abbay-cyberguard-api.onrender.com')
    expect(new URL(upstreamRequest.url).pathname).toBe('/api/v1/auth/register')
    expect(new URL(upstreamRequest.url).search).toBe('')
    expect(upstreamRequest.method).toBe('POST')
    expect(upstreamRequest.headers.get('origin')).toBe(origin)
    expect(upstreamRequest.headers.get('cookie')).toBeNull()
    expect(upstreamRequest.headers.get('authorization')).toBeNull()
    expect(upstreamRequest.headers.get('x-forwarded-host')).toBeNull()
    expect(await upstreamRequest.json()).toEqual({ email: 'person@example.com' })
    expect(response.status).toBe(201)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('set-cookie')).toBe(cookie)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ user: { email: 'person@example.com' } })
  })

  it('proxies auth/me to the fixed API and returns API JSON rather than an SPA document', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }),
    )
    vi.stubGlobal('fetch', upstreamFetch)

    const response = await onRequest({
      request: makeRequest('/api/v1/auth/me', {
        headers: {
          Cookie: 'cybershield_session=opaque; unrelated=value',
          Authorization: 'Bearer user-token',
        },
      }),
    })

    const forwarded = upstreamFetch.mock.calls[0][0]
    expect(new URL(forwarded.url).origin).toBe('https://abbay-cyberguard-api.onrender.com')
    expect(new URL(forwarded.url).pathname).toBe('/api/v1/auth/me')
    expect(forwarded.headers.get('cookie')).toBe('cybershield_session=opaque')
    expect(forwarded.headers.get('authorization')).toBe('Bearer user-token')
    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: { code: 'UNAUTHORIZED' } })
  })

  it('proxies login without forwarding authentication credentials', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', upstreamFetch)

    await onRequest({
      request: makeRequest('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          Cookie: 'cybershield_session=opaque; unrelated=value',
          Authorization: 'Bearer caller-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'person@example.com', password: 'test-password' }),
      }),
    })

    const forwarded = upstreamFetch.mock.calls[0][0]
    expect(new URL(forwarded.url).pathname).toBe('/api/v1/auth/login')
    expect(forwarded.headers.get('cookie')).toBeNull()
    expect(forwarded.headers.get('authorization')).toBeNull()
  })

  it('forwards credentials to daily challenge endpoints for authenticated and personalized responses', async () => {
    const upstreamFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ completed: true }))
      .mockResolvedValueOnce(Response.json({ is_correct: true }))
    vi.stubGlobal('fetch', upstreamFetch)

    await onRequest({
      request: makeRequest('/api/v1/daily/today', {
        headers: {
          Cookie: 'cybershield_session=opaque; unrelated=value',
          Authorization: 'Bearer test-token',
        },
      }),
    })
    await onRequest({
      request: makeRequest('/api/v1/daily/submit', {
        method: 'POST',
        headers: {
          Cookie: 'cybershield_session=opaque; unrelated=value',
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
    })

    for (const [forwarded] of upstreamFetch.mock.calls) {
      expect(forwarded.headers.get('cookie')).toBe('cybershield_session=opaque')
      expect(forwarded.headers.get('authorization')).toBe('Bearer test-token')
    }
    expect(upstreamFetch.mock.calls.map(([forwarded]) => new URL(forwarded.url).pathname)).toEqual([
      '/api/v1/daily/today',
      '/api/v1/daily/submit',
    ])
  })

  it('proxies approved M4 scenario requests to the fixed upstream', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      Response.json({ simulated: true, scenarios: [] })
    )
    vi.stubGlobal('fetch', upstreamFetch)

    const response = await onRequest({
      request: makeRequest('/api/v1/m4/scenarios'),
    })

    expect(response.status).toBe(200)
    expect(new URL(upstreamFetch.mock.calls[0][0].url).origin)
      .toBe('https://abbay-cyberguard-api.onrender.com')
    expect(new URL(upstreamFetch.mock.calls[0][0].url).pathname)
      .toBe('/api/v1/m4/scenarios')
  })

  it('uses Pages built-in SPA fallback without a redirect rule or custom 404 page', () => {
    expect(existsSync(appShell)).toBe(true)
    expect(existsSync(publicRedirects)).toBe(false)
    expect(existsSync(publicNotFoundPage)).toBe(false)
  })

  it('proxies authenticated certificate records and public certificate verification', async () => {
    const upstreamFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ certificate_id: 'ACYBER-2026-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }))
      .mockResolvedValueOnce(Response.json({ status: 'issued' }))
    vi.stubGlobal('fetch', upstreamFetch)

    const certificateId = 'ACYBER-2026-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const ownerRecord = await onRequest({
      request: makeRequest(`/api/v1/academy/certificates/${certificateId}`, {
        headers: { Cookie: 'cybershield_session=opaque; other=ignored' },
      }),
    })
    const publicVerification = await onRequest({
      request: makeRequest(`/api/v1/academy/certificates/verify/${certificateId}`, {
        headers: {
          Cookie: 'cybershield_session=opaque',
          Authorization: 'Bearer user-token',
        },
      }),
    })

    expect(ownerRecord.status).toBe(200)
    expect(upstreamFetch.mock.calls[0][0].headers.get('cookie'))
      .toBe('cybershield_session=opaque')
    expect(publicVerification.status).toBe(200)
    expect(upstreamFetch.mock.calls[1][0].headers.get('cookie')).toBeNull()
    expect(upstreamFetch.mock.calls[1][0].headers.get('authorization')).toBeNull()
  })

  it('only forwards server assessment attempts and certificate issuance methods', async () => {
    const upstreamFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ attempt_id: '00000000-0000-4000-8000-000000000001' }))
      .mockResolvedValueOnce(Response.json({ passed: true }))
      .mockResolvedValueOnce(Response.json({ certificate_id: 'ACYBER-2026-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }))
    vi.stubGlobal('fetch', upstreamFetch)

    await onRequest({
      request: makeRequest('/api/v1/academy/levels/attempts', { method: 'POST', body: '{}' }),
    })
    await onRequest({
      request: makeRequest(
        '/api/v1/academy/levels/attempts/00000000-0000-4000-8000-000000000001/submit',
        { method: 'POST', body: '{}' },
      ),
    })
    await onRequest({
      request: makeRequest('/api/v1/academy/certificates', { method: 'POST', body: '{}' }),
    })

    expect(upstreamFetch.mock.calls.map(([request]) => new URL(request.url).pathname)).toEqual([
      '/api/v1/academy/levels/attempts',
      '/api/v1/academy/levels/attempts/00000000-0000-4000-8000-000000000001/submit',
      '/api/v1/academy/certificates',
    ])
    expect(upstreamFetch.mock.calls.every(([request]) => request.headers.get('cookie') === null)).toBe(true)
  })

  it.each([
    ['/api/v1/voice/transcribe', 'POST'],
    ['/api/v1/voice/synthesize', 'POST'],
    ['/api/v1/device-security/status', 'GET'],
    ['/api/v1/device-security/scan', 'POST'],
    ['/api/v1/academy/levels/complete', 'POST'],
    ['/api/v1/academy/certificates/verify/not-a-certificate', 'GET'],
    ['/api/v1/not-a-route', 'GET'],
  ])('rejects local or unknown route %s without contacting the backend', async (path, method) => {
    const upstreamFetch = vi.fn()
    vi.stubGlobal('fetch', upstreamFetch)

    const response = await onRequest({
      request: makeRequest(path, { method, body: method === 'POST' ? '{}' : undefined }),
    })

    expect(response.status).toBe(404)
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('returns a JSON 404 for an unknown API route instead of SPA HTML', async () => {
    const upstreamFetch = vi.fn()
    vi.stubGlobal('fetch', upstreamFetch)

    const response = await onRequest({
      request: makeRequest('/api/v1/unknown'),
    })

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('content-type')).not.toContain('text/html')
    expect(await response.json()).toEqual({ error: { code: 'NOT_FOUND' } })
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('preserves the allowed daily query string and rejects other query strings', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(Response.json({ challenge: null }))
    vi.stubGlobal('fetch', upstreamFetch)

    const dailyResponse = await onRequest({
      request: makeRequest('/api/v1/daily/today?date=2026-11-07&timezone=Africa%2FAddis_Ababa'),
    })
    const rejectedResponse = await onRequest({
      request: makeRequest('/api/v1/m4/scenarios?unexpected=value'),
    })

    expect(dailyResponse.status).toBe(200)
    expect(new URL(upstreamFetch.mock.calls[0][0].url).search)
      .toBe('?date=2026-11-07&timezone=Africa%2FAddis_Ababa')
    expect(rejectedResponse.status).toBe(400)
    expect(rejectedResponse.headers.get('content-type')).toContain('application/json')
    expect(await rejectedResponse.json()).toEqual({ error: { code: 'QUERY_NOT_ALLOWED' } })
    expect(upstreamFetch).toHaveBeenCalledOnce()
  })

  it('returns a non-cacheable JSON 502 when the fixed upstream is unavailable', async () => {
    const upstreamFetch = vi.fn().mockRejectedValue(new Error('upstream unavailable'))
    vi.stubGlobal('fetch', upstreamFetch)

    const response = await onRequest({
      request: makeRequest('/api/v1/m4/scenarios'),
    })

    expect(response.status).toBe(502)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: { code: 'BACKEND_UNREACHABLE' } })
  })

  it('rejects invalid methods and arbitrary origins before contacting the backend', async () => {
    const upstreamFetch = vi.fn()
    vi.stubGlobal('fetch', upstreamFetch)

    const wrongMethod = await onRequest({
      request: makeRequest('/api/v1/m4/scenarios', { method: 'POST', body: '{}' }),
    })
    const wrongOrigin = await onRequest({
      request: new Request(`${origin}/api/v1/auth/login`, {
        method: 'POST',
        headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
        body: '{}',
      }),
    })
    const missingOrigin = await onRequest({
      request: new Request(`${origin}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    })

    expect(wrongMethod.status).toBe(405)
    expect(wrongOrigin.status).toBe(403)
    expect(missingOrigin.status).toBe(403)
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('does not forward caller-selected upstream host headers', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', upstreamFetch)

    await onRequest({
      request: makeRequest('/api/v1/m4/scenarios', {
        headers: { Host: 'attacker.example', 'X-Forwarded-Host': 'attacker.example' },
      }),
    })

    const forwarded = upstreamFetch.mock.calls[0][0]
    expect(new URL(forwarded.url).origin).toBe('https://abbay-cyberguard-api.onrender.com')
    expect(forwarded.headers.get('host')).toBeNull()
    expect(forwarded.headers.get('x-forwarded-host')).toBeNull()
  })

  it('does not forward unrelated cookies or sensitive headers to public M4 routes', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(Response.json({ simulated: true }))
    vi.stubGlobal('fetch', upstreamFetch)

    await onRequest({
      request: makeRequest('/api/v1/m4/scenarios', {
        headers: {
          Cookie: 'cybershield_session=secret; unrelated=value',
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        },
      }),
    })

    const forwarded = upstreamFetch.mock.calls[0][0]
    expect(forwarded.headers.get('cookie')).toBeNull()
    expect(forwarded.headers.get('authorization')).toBeNull()
  })
})
