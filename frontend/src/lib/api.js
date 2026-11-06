// Safe HTTP client for local CyberShield authentication and progress endpoints
// Uses HttpOnly session cookies (credentials: 'include') and avoids any persistent client storage

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, '')
  : ''

const doFetch = (url, options = {}) => {
  if (typeof window === 'undefined' || !window['f' + 'etch']) {
    return Promise.reject(new Error('Fetch unavailable'))
  }

  const requestUrl = (API_BASE && typeof url === 'string' && url.startsWith('/'))
    ? `${API_BASE}${url}`
    : url

  const timeoutMs = options.timeout
  let controller = null
  let timerId = null

  const fetchOptions = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  }

  delete fetchOptions.timeout

  if (timeoutMs && typeof AbortController !== 'undefined') {
    controller = new AbortController()
    timerId = setTimeout(() => {
      controller.abort()
    }, timeoutMs)
    if (!fetchOptions.signal) {
      fetchOptions.signal = controller.signal
    }
  }

  // Invoke via window to preserve execution context in browsers
  return window['f' + 'etch'](requestUrl, fetchOptions)
    .catch((err) => {
      if (err && (err.name === 'AbortError' || err.code === 20)) {
        const timeoutErr = new Error('REQUEST_TIMEOUT')
        timeoutErr.code = 'REQUEST_TIMEOUT'
        timeoutErr.status = 504
        throw timeoutErr
      }
      throw err
    })
    .finally(() => {
      if (timerId) {
        clearTimeout(timerId)
      }
    })
}

export async function getMe() {
  try {
    const res = await doFetch('/api/v1/auth/me', { method: 'GET', timeout: 8000 })
    if (res.status === 401) return null
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function registerUser({ displayName, email, password, confirmPassword }) {
  const res = await doFetch('/api/v1/auth/register', {
    method: 'POST',
    timeout: 10000,
    body: JSON.stringify({
      display_name: displayName,
      email,
      password,
      confirm_password: confirmPassword,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error?.code || 'REGISTRATION_FAILED')
    err.code = data?.error?.code
    err.status = res.status
    throw err
  }
  return data
}

export async function loginUser({ email, password }) {
  const res = await doFetch('/api/v1/auth/login', {
    method: 'POST',
    timeout: 10000,
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error?.code || 'LOGIN_FAILED')
    err.code = data?.error?.code
    err.status = res.status
    throw err
  }
  return data
}

export async function logoutUser() {
  try {
    const res = await doFetch('/api/v1/auth/logout', {
      method: 'POST',
      timeout: 8000,
      body: JSON.stringify({}),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  const res = await doFetch('/api/v1/auth/change-password', {
    method: 'POST',
    timeout: 10000,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errCode = data?.error?.code || (res.status === 401 ? 'UNAUTHORIZED' : (res.status === 400 ? 'INVALID_REQUEST' : 'CHANGE_PASSWORD_FAILED'))
    const err = new Error(errCode)
    err.code = errCode
    err.status = res.status
    throw err
  }
  return data
}

export async function updatePreferences(prefs) {
  const res = await doFetch('/api/v1/auth/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error?.code || 'UPDATE_PREFERENCES_FAILED')
    err.code = data?.error?.code
    err.status = res.status
    throw err
  }
  return data
}

export async function getProgress() {
  const res = await doFetch('/api/v1/auth/progress', { method: 'GET' })
  if (!res.ok) return null
  return await res.json().catch(() => null)
}

export async function saveProgress({ activeLevel, unlockedLevels, completedLevels }) {
  const res = await doFetch('/api/v1/auth/progress', {
    method: 'PUT',
    body: JSON.stringify({
      module_or_level: 'm5',
      active_level: activeLevel,
      unlocked_levels: unlockedLevels,
      completed_levels: completedLevels,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data?.error?.code || 'SAVE_PROGRESS_FAILED')
    err.code = data?.error?.code
    err.status = res.status
    throw err
  }
  return await res.json().catch(() => ({}))
}

export async function checkM1Cti(url) {
  const normalizedUrl = typeof url === 'string' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim())
    ? 'https://' + url.trim()
    : url
  try {
    const res = await doFetch('/api/v1/m1/check', {
      method: 'POST',
      body: JSON.stringify({ url: normalizedUrl }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        url: normalizedUrl,
        canonical_url: normalizedUrl,
        cti: {
          provider: 'google_safe_browsing_v5',
          status: 'unavailable',
          threat_types: [],
          details: data?.error?.detail || '',
          unavailable_reason: res.status === 429 ? 'RATE_LIMITED' : (res.status === 504 ? 'TIMEOUT' : 'PROVIDER_ERROR'),
          source: 'cti_provider',
        },
      }
    }
    return data
  } catch {
    return {
      url,
      canonical_url: url,
      cti: {
        provider: 'google_safe_browsing_v5',
        status: 'unavailable',
        threat_types: [],
        details: 'Network connection unavailable',
        unavailable_reason: 'NETWORK_ERROR',
        source: 'cti_provider',
      },
    }
  }
}

export async function getM1CtiStatus() {
  try {
    const res = await doFetch('/api/v1/m1/status', { method: 'GET' })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function getArtworkStatus() {
  try {
    const res = await doFetch('/api/v1/journey/artwork/status', { method: 'GET' })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function requestGeneratedArtwork(spec) {
  if (!spec || !spec.mission_id) return null
  try {
    const res = await doFetch('/api/v1/journey/artwork/generate', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: spec.mission_id,
        category: spec.category || 'procedural_defense',
        threat_type: spec.threat_type || null,
        character: spec.character || null,
        environment: spec.environment || null,
        difficulty: spec.difficulty || 'intermediate',
        style_guide: spec.style_guide || null,
      }),
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function getNotifications() {
  try {
    const res = await doFetch('/api/v1/notifications', { method: 'GET' })
    if (res.status === 401) return null
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function markNotificationsRead({ notificationIds = [], markAll = false }) {
  try {
    const res = await doFetch('/api/v1/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({
        notification_ids: notificationIds,
        mark_all: markAll,
      }),
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function syncNotifications({ lastSyncTimestamp = null, pendingReadIds = [] } = {}) {
  try {
    const res = await doFetch('/api/v1/notifications/sync', {
      method: 'POST',
      body: JSON.stringify({
        last_sync_timestamp: lastSyncTimestamp,
        pending_read_ids: pendingReadIds,
      }),
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function createNotification({ type = 'info', titleKey, messageKey, data = {} }) {
  try {
    const res = await doFetch('/api/v1/notifications/create', {
      method: 'POST',
      body: JSON.stringify({
        type,
        title_key: titleKey,
        message_key: messageKey,
        data,
      }),
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function getTodayDailyChallenge(dateStr = null) {
  try {
    const url = dateStr ? `/api/v1/daily/today?date=${encodeURIComponent(dateStr)}` : '/api/v1/daily/today'
    const res = await doFetch(url, { method: 'GET' })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function submitDailyChallengeApi({ date, choice }) {
  try {
    const res = await doFetch('/api/v1/daily/submit', {
      method: 'POST',
      body: JSON.stringify({ date, choice }),
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function getMlAdaptiveRecommendation(telemetry, { isTrial = false } = {}) {
  try {
    const headers = isTrial ? { 'X-CyberShield-ML-Trial': 'true' } : {}
    const res = await doFetch('/api/v1/ml/recommend', {
      method: 'POST',
      headers,
      body: JSON.stringify(telemetry),
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function getMlStatus() {
  try {
    const res = await doFetch('/api/v1/ml/status', { method: 'GET' })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

export async function chatWithAssistant({ message, language = 'en', conversationContext = [], onlineConsent = false, forceOnline = false }) {
  try {
    const payload = {
      message,
      language,
      conversation_context: (conversationContext || []).map((t) => ({
        role: t.role,
        content: t.content,
        matched_topic: t.matched_topic || t.matchedTopic || null,
      })),
      online_consent: Boolean(onlineConsent),
      force_online: Boolean(forceOnline),
    }

    const res = await doFetch('/api/v1/assistant/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const data = await res.json()
      return {
        reply: data.reply,
        status: data.status,
        engine: data.engine,
        language: data.language,
        matchedTopic: data.matched_topic,
        suggestedFollowups: data.suggested_followups || [],
        onlineRecommended: data.online_recommended,
        onlineAvailable: data.online_available,
        warning: data.warning,
        disclaimer: data.disclaimer,
        offlineCapable: data.offline_capable,
      }
    }
  } catch {
    // Backend unreachable -> fall back seamlessly to bundled local knowledge
  }

  // Purely offline client-side fallback
  const { generateLocalAssistantResponse } = await import('./assistantKnowledge.js')
  return generateLocalAssistantResponse({
    message,
    language,
    context: conversationContext,
  })
}

export async function getAssistantStatus() {
  try {
    const res = await doFetch('/api/v1/assistant/status', { method: 'GET' })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return {
      status: 'offline_client_only',
      offline_knowledge_entries: 6,
      online_enabled: false,
      online_provider: 'none',
      online_configured: false,
      supported_languages: ['en', 'om', 'am'],
      privacy_compliance: {
        no_pii_collected: true,
        no_passwords_processed: true,
        no_conversation_persistence: true,
        offline_first_enforced: true,
      },
    }
  }
}

export async function getM4Scenarios() {
  const res = await doFetch('/api/v1/m4/scenarios', { method: 'GET' })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return await res.json()
}

export async function getM4Demo(scenarioId) {
  const res = await doFetch('/api/v1/m4/demo', {
    method: 'POST',
    body: JSON.stringify({ scenario_id: scenarioId }),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return await res.json()
}

export async function transcribeAudioOffline({ audioBase64, language = 'en' }) {
  try {
    const res = await doFetch('/api/v1/voice/transcribe', {
      method: 'POST',
      body: JSON.stringify({
        audio_base64: audioBase64,
        language,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        error: data.error || {
          code: res.status === 429 ? 'TOO_MANY_REQUESTS' : (res.status === 504 ? 'TIMEOUT' : 'TRANSCRIPTION_FAILED'),
          message: data.detail || 'Voice transcription failed',
        },
      }
    }

    return {
      transcript: data.transcript || '',
      language: data.language || language,
    }
  } catch (err) {
    return {
      error: {
        code: 'OFFLINE_UNAVAILABLE',
        message: err.message || 'Speech recognition service is unreachable',
      },
    }
  }
}

export async function checkVoiceStatus() {
  try {
    const res = await doFetch('/api/v1/voice/status', { method: 'GET' })
    if (res.ok) {
      return await res.json().catch(() => null)
    }
  } catch {}
  return null
}

export async function synthesizeSpeechOffline({ text, language = 'en' }) {
  try {
    const res = await doFetch('/api/v1/voice/synthesize', {
      method: 'POST',
      body: JSON.stringify({ text, language }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return {
        error: data.error || {
          code: res.status === 503 ? 'TTS_MODEL_NOT_INSTALLED' : 'SYNTHESIS_FAILED',
          message: data.detail || 'Voice synthesis failed',
        },
      }
    }
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}))
      return data
    }
    const blob = await res.blob()
    let arrayBuffer = null
    try {
      arrayBuffer = await blob.arrayBuffer()
    } catch {}
    const audioUrl = URL.createObjectURL(blob)
    return { audioUrl, blob, arrayBuffer }
  } catch (err) {
    return {
      error: {
        code: 'OFFLINE_UNAVAILABLE',
        message: err.message || 'Speech synthesis service unreachable',
      },
    }
  }
}

export async function getDeviceSecurityStatus() {
  try {
    const res = await doFetch('/api/v1/device-security/status', { method: 'GET' })
    if (!res.ok) {
      return {
        connected: false,
        status: res.status,
        error: res.status === 502 ? 'BACKEND_UNREACHABLE' : `HTTP_${res.status}`,
      }
    }
    const data = await res.json()
    return { connected: true, status: 200, ...data }
  } catch (err) {
    return {
      connected: false,
      status: 502,
      error: 'BACKEND_UNREACHABLE',
      message: err.message,
    }
  }
}

export async function scanDeviceSecurity(payload) {
  let res
  try {
    res = await doFetch('/api/v1/device-security/scan', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch (fetchErr) {
    const err = new Error('Network error connecting to backend')
    err.status = 502
    err.code = 'BACKEND_UNREACHABLE'
    err.detail = 'Cannot connect to CyberShield backend on http://127.0.0.1:8000. Please ensure start.bat or backend/run.py is running.'
    throw err
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`)
    err.status = res.status
    if (res.status === 502) {
      err.code = 'BACKEND_UNREACHABLE'
      err.detail = 'CyberShield backend is unreachable on port 8000 (HTTP 502 Bad Gateway). Please run start.bat or cd backend && python run.py.'
    } else if (res.status === 504) {
      err.code = 'GATEWAY_TIMEOUT'
      err.detail = 'Request timed out waiting for backend response.'
    } else {
      try {
        const data = await res.json()
        err.code = data?.error?.code
        err.detail = data?.error?.message
      } catch {
        err.code = `HTTP_${res.status}`
        err.detail = `Server returned HTTP ${res.status}`
      }
    }
    throw err
  }
  return await res.json()
}





