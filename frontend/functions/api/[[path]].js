const API_ORIGIN = 'https://abbay-cyberguard-api.onrender.com'
const SESSION_COOKIE_NAME = 'cybershield_session'
const ALLOWED_ROUTES = new Map([
  ['/api/v1/auth/register', ['POST']],
  ['/api/v1/auth/login', ['POST']],
  ['/api/v1/auth/logout', ['POST']],
  ['/api/v1/auth/me', ['GET']],
  ['/api/v1/auth/preferences', ['PUT']],
  ['/api/v1/auth/progress', ['GET', 'PUT']],
  ['/api/v1/auth/change-password', ['POST']],
  ['/api/v1/m1/check', ['POST']],
  ['/api/v1/m1/status', ['GET']],
  ['/api/v1/journey/artwork/status', ['GET']],
  ['/api/v1/journey/artwork/generate', ['POST']],
  ['/api/v1/notifications', ['GET']],
  ['/api/v1/notifications/mark-read', ['POST']],
  ['/api/v1/notifications/sync', ['POST']],
  ['/api/v1/notifications/create', ['POST']],
  ['/api/v1/daily/today', ['GET']],
  ['/api/v1/daily/submit', ['POST']],
  ['/api/v1/ml/recommend', ['POST']],
  ['/api/v1/ml/status', ['GET']],
  ['/api/v1/assistant/chat', ['POST']],
  ['/api/v1/assistant/status', ['GET']],
  ['/api/v1/m4/scenarios', ['GET']],
  ['/api/v1/m4/demo', ['POST']],
  ['/api/v1/academy/lessons/section', ['POST']],
  ['/api/v1/academy/levels/attempts', ['POST']],
  ['/api/v1/academy/certificates', ['GET', 'POST']],
])
const AUTHENTICATED_ROUTES = new Set([
  '/api/v1/auth/logout',
  '/api/v1/auth/me',
  '/api/v1/auth/preferences',
  '/api/v1/auth/progress',
  '/api/v1/auth/change-password',
  '/api/v1/notifications',
  '/api/v1/notifications/mark-read',
  '/api/v1/notifications/sync',
  '/api/v1/notifications/create',
  '/api/v1/daily/today',
  '/api/v1/daily/submit',
  '/api/v1/academy/lessons/section',
  '/api/v1/academy/levels/attempts',
  '/api/v1/academy/certificates',
])
const AUTHENTICATED_ROUTE_PATTERNS = [
  /^\/api\/v1\/academy\/levels\/attempts\/[0-9a-f-]{36}\/submit$/i,
  /^\/api\/v1\/academy\/certificates\/ACYBER-[0-9]{4}-[A-F0-9]{32}$/,
]
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function jsonError(status, code) {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function getSessionCookie(cookieHeader) {
  if (!cookieHeader) return ''
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) || ''
}

function requiresAuthentication(pathname) {
  return AUTHENTICATED_ROUTES.has(pathname) ||
    AUTHENTICATED_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
}

export async function onRequest({ request }) {
  const method = request.method.toUpperCase()
  const requestUrl = new URL(request.url)
  const certificateIdPath =
    /^\/api\/v1\/academy\/certificates\/ACYBER-[0-9]{4}-[A-F0-9]{32}$/.test(requestUrl.pathname)
  const certificateVerificationPath =
    /^\/api\/v1\/academy\/certificates\/verify\/ACYBER-[0-9]{4}-[A-F0-9]{32}$/.test(requestUrl.pathname)
  const assessmentSubmissionPath =
    /^\/api\/v1\/academy\/levels\/attempts\/[0-9a-f-]{36}\/submit$/i.test(requestUrl.pathname)
  const allowedMethods = ALLOWED_ROUTES.get(requestUrl.pathname) ||
    (assessmentSubmissionPath ? ['POST'] : null) ||
    (method === 'GET' && (certificateIdPath || certificateVerificationPath) ? ['GET'] : null)
  if (!allowedMethods) return jsonError(404, 'NOT_FOUND')
  if (!allowedMethods.includes(method)) return jsonError(405, 'METHOD_NOT_ALLOWED')
  if (requestUrl.search && requestUrl.pathname !== '/api/v1/daily/today') {
    return jsonError(400, 'QUERY_NOT_ALLOWED')
  }

  const origin = request.headers.get('origin')
  if ((origin && origin !== requestUrl.origin) ||
      (method !== 'GET' && method !== 'OPTIONS' && !origin)) {
    return jsonError(403, 'ORIGIN_NOT_ALLOWED')
  }

  const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, API_ORIGIN)
  const headers = new Headers()
  const authenticatedPath = requiresAuthentication(requestUrl.pathname)
  for (const name of ['accept', 'content-type', 'origin']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (authenticatedPath) {
    const authorization = request.headers.get('authorization')
    if (authorization) headers.set('authorization', authorization)
    const sessionCookie = getSessionCookie(request.headers.get('cookie'))
    if (sessionCookie) headers.set('cookie', sessionCookie)
  }

  try {
    const body = method === 'GET' || method === 'OPTIONS'
      ? undefined
      : await request.arrayBuffer()
    const upstreamRequest = new Request(upstreamUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    })
    const response = await fetch(upstreamRequest)
    const responseHeaders = new Headers(response.headers)
    for (const name of HOP_BY_HOP_HEADERS) responseHeaders.delete(name)
    responseHeaders.set('Cache-Control', 'no-store')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch {
    return jsonError(502, 'BACKEND_UNREACHABLE')
  }
}
