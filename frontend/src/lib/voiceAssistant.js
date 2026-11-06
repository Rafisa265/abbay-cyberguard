/**
 * CyberShield Ethiopia — Voice Assistant Service
 * 
 * Provides Speech-to-Text (STT) and Text-to-Speech (TTS) integration
 * for the CyberShield Conversational AI Assistant.
 * 
 * Invariants:
 * 1. 100% Privacy-preserving: zero audio stored, zero persistent logs.
 * 2. Strict honesty: never fake voice support or substitute an English/Amharic
 *    voice for Afaan Oromoo. If a voice does not exist, report it truthfully.
 * 3. Never auto-submit recognized text: speech populates the input field for
 *    user review and editing before dispatch.
 * 4. Graceful text-only fallback when speech APIs or voices are unavailable.
 * 5. Offline-first: English and Amharic local STT via whisper.cpp.
 */

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  )
}

export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false
  return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance)
}

/**
 * Normalizes speech text by stripping markdown markup (headings, bold, bullets, links)
 * and applying language-aware text normalization for natural pronunciation.
 */
export function cleanTextForSpeech(text, lang = 'en') {
  if (!text) return ''
  let cleaned = String(text)
    // Remove markdown links [label](url) -> label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove standalone URLs
    .replace(/https?:\/\/\S+/g, 'link')
    // Remove bold/italic **text** or *text* or _text_
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove inline code `code`
    .replace(/`([^`]+)`/g, '$1')
    // Remove heading markers #{1,6}
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points
    .replace(/^[•\-\*]\s+/gm, '')
    // Remove numbered lists markers
    .replace(/^\d+\.\s+/gm, '')

  const targetLang = (lang || 'en').toLowerCase().trim()

  if (targetLang === 'am') {
    // Amharic normalization: map Ethiopic punctuation to natural speech pauses & expand common terms
    cleaned = cleaned
      .replace(/።+/g, '. ')
      .replace(/፣+/g, ', ')
      .replace(/፤+/g, '; ')
      .replace(/፦+/g, ': ')
      .replace(/፧+/g, '? ')
      .replace(/፨+/g, '. ')
      .replace(/፡/g, ' ')
      .replace(/\bዓ\.ም\b/g, 'ዓመተ ምሕረት')
      .replace(/\bዓ\/ም\b/g, 'ዓመተ ምሕረት')
      .replace(/\bወ\/ሮ\b/g, 'ወይዘሮ')
      .replace(/\bወ\/ሪት\b/g, 'ወይዘሪት')
      .replace(/\bዶ\/ር\b/g, 'ዶክተር')
      .replace(/\bክ\/ከተማ\b/g, 'ክፍለ ከተማ')
      .replace(/\bት\/ቤት\b/g, 'ትምህርት ቤት')
      .replace(/\b2FA\b/gi, 'ሁለት ደረጃ ማረጋገጫ')
      .replace(/\bMFA\b/gi, 'ባለብዙ ደረጃ ማረጋገጫ')
      .replace(/\bOTP\b/g, 'ኦ ቲ ፒ')
      .replace(/\bPIN\b/gi, 'ፒን')
      .replace(/\bVPN\b/gi, 'ቪ ፒ ኤን')
      .replace(/\bURL\b/gi, 'ዩ አር ኤል')
      .replace(/\bSMS\b/gi, 'ኤስ ኤም ኤስ')
      .replace(/\bAI\b/g, 'ኤ አይ')
      .replace(/\bCyberShield\b/gi, 'ሳይበርሺልድ')
      .replace(/\bphishing\b/gi, 'ፊሺንግ')
      .replace(/\bmalware\b/gi, 'ማልዌር')
      .replace(/\bransomware\b/gi, 'ራንሰምዌር')
      .replace(/\bfirewall\b/gi, 'ፋየርዎል')
      .replace(/\bpassword\b/gi, 'የይለፍ ቃል')
  } else if (targetLang === 'om') {
    // Afaan Oromoo normalization: expand common abbreviations & curly apostrophes
    cleaned = cleaned
      .replace(/’/g, "'")
      .replace(/\bfkn\./gi, 'fakkeenyaaf ')
      .replace(/\bk\.k\.f\./gi, 'fi kkf ')
      .replace(/\bOTP\b/g, 'O T P')
      .replace(/\bPIN\b/g, 'P I N')
  } else {
    // English normalization: expand common shorthand
    cleaned = cleaned
      .replace(/\be\.g\.,?/gi, 'for example,')
      .replace(/\bi\.e\.,?/gi, 'that is,')
      .replace(/\bOTP\b/g, 'O T P')
  }

  return cleaned
    // Collapse multiple whitespace/newlines into a single pause
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Quantizes normalized Float32 samples [-1.0, 1.0] to signed Int16 [-32768, 32767].
 * Strictly clamps out-of-range values and normalizes NaN / Infinity to zero.
 */
export function quantizeFloat32ToInt16(float32Array) {
  const int16 = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    let sample = float32Array[i]
    if (Number.isNaN(sample) || !Number.isFinite(sample)) {
      sample = 0.0
    } else if (sample > 1.0) {
      sample = 1.0
    } else if (sample < -1.0) {
      sample = -1.0
    }
    const scaled = sample < 0 ? sample * 32768.0 : sample * 32767.0
    int16[i] = Math.round(scaled)
  }
  return int16
}

/**
 * Generates an exact canonical 44-byte WAV audio buffer (PCM, 16000 Hz, mono, 16-bit).
 */
export function buildCanonicalWav(int16Samples, sampleRate = 16000) {
  const dataByteLength = int16Samples.length * 2
  const buffer = new ArrayBuffer(44 + dataByteLength)
  const view = new DataView(buffer)

  const writeAscii = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataByteLength, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)             // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true)              // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true)              // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true)     // SampleRate (16000)
  view.setUint32(28, sampleRate * 2, true) // ByteRate (16000 * 1 * 2 = 32000)
  view.setUint16(32, 2, true)              // BlockAlign (1 * 2 = 2)
  view.setUint16(34, 16, true)             // BitsPerSample (16)
  writeAscii(36, 'data')
  view.setUint32(40, dataByteLength, true) // Subchunk2Size

  let offset = 44
  for (let i = 0; i < int16Samples.length; i++) {
    view.setInt16(offset, int16Samples[i], true)
    offset += 2
  }

  return new Uint8Array(buffer)
}

/**
 * Encodes a Uint8Array into a standard Base64 string.
 */
export function uint8ArrayToBase64(uint8Array) {
  let binary = ''
  const len = uint8Array.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64')
}

/**
 * Resamples an AudioBuffer to 16 kHz mono using OfflineAudioContext.
 */
export async function resampleAudioBufferTo16kHz(audioBuffer) {
  const targetRate = 16000
  const duration = audioBuffer.duration
  const targetFrames = Math.max(1, Math.round(duration * targetRate))

  const OfflineCtxClass = typeof window !== 'undefined'
    ? (window.OfflineAudioContext || window.webkitOfflineAudioContext)
    : null

  if (!OfflineCtxClass) {
    throw new Error('OfflineAudioContext is not supported')
  }

  const offlineCtx = new OfflineCtxClass(1, targetFrames, targetRate)
  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  return rendered.getChannelData(0)
}

/**
 * Records a local microphone audio clip with strict privacy controls.
 * Stops all hardware tracks immediately when done or cancelled.
 */
export async function recordAudioClip({ maxDurationMs = 15000, onAutoStop } = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is not supported in this browser')
  }

  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      throw err
    }
    // Fall back to basic audio constraint if advanced constraints are rejected
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  }

  const chunks = []
  let recorder = null
  let options = undefined
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options = { mimeType: 'audio/webm;codecs=opus' }
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      options = { mimeType: 'audio/webm' }
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options = { mimeType: 'audio/mp4' }
    }
  }

  try {
    recorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream)
  } catch {
    recorder = new MediaRecorder(stream)
  }

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data)
    }
  }

  let stopPromiseResolve = null
  let stopPromiseReject = null
  const resultPromise = new Promise((resolve, reject) => {
    stopPromiseResolve = resolve
    stopPromiseReject = reject
  })

  let timeoutId = null

  const cleanupTracks = () => {
    if (timeoutId) clearTimeout(timeoutId)
    stream.getTracks().forEach((track) => {
      try { track.stop() } catch {}
    })
  }

  recorder.onstop = () => {
    cleanupTracks()
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
    if (stopPromiseResolve) stopPromiseResolve(blob)
  }

  recorder.onerror = (err) => {
    cleanupTracks()
    if (stopPromiseReject) stopPromiseReject(err)
  }

  recorder.start()

  timeoutId = setTimeout(() => {
    if (recorder.state === 'recording') {
      try { recorder.stop() } catch {}
      if (onAutoStop) onAutoStop()
    }
  }, maxDurationMs)

  return {
    stop: () => {
      if (recorder.state === 'recording') {
        try { recorder.stop() } catch {}
      }
      return resultPromise
    },
    cancel: () => {
      cleanupTracks()
      if (recorder.state === 'recording') {
        try { recorder.stop() } catch {}
      }
    },
  }
}

import { transcribeAudioOffline, checkVoiceStatus, synthesizeSpeechOffline } from './api.js'
export { transcribeAudioOffline, checkVoiceStatus, synthesizeSpeechOffline }

let activeAudio = null
let globalAudioCtx = null
let activeSourceNode = null
let activeGainNode = null
let activeUtterance = null

/**
 * Returns a singleton AudioContext instance for Web Audio playback.
 */
export function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioCtxClass = window.AudioContext || window.webkitAudioContext
  if (!AudioCtxClass) return null
  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    globalAudioCtx = new AudioCtxClass()
  }
  return globalAudioCtx
}

/**
 * Synchronously resumes or unlocks the AudioContext within a user interaction event.
 * Eliminates browser autoplay rejections when async audio synthesis completes later.
 */
export function unlockAudioContext() {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

/**
 * Returns available voices from the browser, awaiting onvoiceschanged if needed.
 */
export async function getAvailableVoices() {
  if (!isSpeechSynthesisSupported()) return []

  const synth = window.speechSynthesis
  let voices = synth.getVoices()
  if (voices && voices.length > 0) return voices

  return new Promise((resolve) => {
    let resolved = false
    const handler = () => {
      if (!resolved) {
        resolved = true
        if (synth.removeEventListener) {
          synth.removeEventListener('voiceschanged', handler)
        }
        resolve(synth.getVoices() || [])
      }
    }
    if (synth.addEventListener) {
      synth.addEventListener('voiceschanged', handler)
    } else {
      synth.onvoiceschanged = handler
    }
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        if (synth.removeEventListener) {
          synth.removeEventListener('voiceschanged', handler)
        }
        resolve(synth.getVoices() || [])
      }
    }, 1000)
  })
}

/**
 * Resolves the effective speech language for a text utterance.
 * Guarantees that Ethiopic script is strictly synthesized as Amharic ('am'),
 * detects Afaan Oromoo vocabulary/script, and ensures consistent mapping.
 */
export function resolveSpeechLanguage(text, preferredLang = 'en') {
  if (!text) return preferredLang || 'en'
  const str = String(text)

  // Ethiopic Unicode blocks: strictly Amharic ('am')
  if (/[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]/.test(str)) {
    return 'am'
  }

  const pLang = (preferredLang || 'en').toLowerCase().trim()
  if (pLang === 'om' || pLang === 'om-et' || pLang.startsWith('om')) {
    return 'om'
  }
  if (pLang === 'am' || pLang === 'am-et' || pLang.startsWith('am')) {
    return 'am'
  }

  // Detect distinct Afaan Oromoo vocabulary markers and grammar patterns
  const oromoWordRegex = /\b(akkam|akkamitti|eegumsa|saayibarii|saayibariiti|fakkeenyaaf|fkn|akkasumas|nageenya|mallattoo|dubbisi|deebii|odeeffannoo|keessan|keessaniin|keessatti|keessaa|waan|isin|kun|hin|jecha|icciitii|lakkoofsa|lakkofsa|bilbila|koodii|qubeessuu|barreessi|gaaffii|argachuuf|danda'a|dandeessu|dandeessan|yoo|fiishiingii|sobaa|maallaqa|tajaajila|baankii|telekoomii|cufameera|badhaasa|mooteetta|yakkamaa|hoggansa|qoradhu|ilaali)\b/i
  if (oromoWordRegex.test(str)) {
    return 'om'
  }

  return pLang || 'en'
}

/**
 * Finds the genuine voice for the requested language.
 * Strict language isolation:
 * - 'en' -> matches 'en', 'en-US', 'en-GB', etc.
 * - 'am' -> matches 'am', 'am-ET' (e.g. Microsoft መቅደስ or Microsoft አምሀ)
 * - 'om' -> matches 'om', 'om-ET'. If NONE exists, returns NULL (never returns English or Amharic).
 */
export function getVoiceForLanguage(lang, voices = []) {
  if (!voices || voices.length === 0) return null
  const target = (lang || '').toLowerCase().trim()

  if (target === 'am') {
    return voices.find((v) => {
      const vLang = (v.lang || '').toLowerCase()
      return vLang === 'am-et' || vLang === 'am' || vLang.startsWith('am-')
    }) || null
  }

  if (target === 'om') {
    return voices.find((v) => {
      const vLang = (v.lang || '').toLowerCase()
      return vLang === 'om-et' || vLang === 'om' || vLang.startsWith('om-') || vLang.includes('oromo')
    }) || null
  }

  if (target === 'en') {
    return voices.find((v) => {
      const vLang = (v.lang || '').toLowerCase()
      return vLang === 'en-us' || vLang === 'en-gb' || vLang.startsWith('en')
    }) || null
  }

  // Strict isolation: never default to English for non-English requests
  return null
}

function playOfflineSpeech({ text, language, onStart, onEnd, onError }) {
  let isCancelled = false
  console.log(`[CyberShield VoiceTTS] Initiating offline synthesis | lang=${language} | chars=${text.length}`)

  synthesizeSpeechOffline({ text, language })
    .then(async (result) => {
      if (isCancelled) return

      if (result && (result.arrayBuffer || result.audioUrl)) {
        console.log(`[CyberShield VoiceTTS] Received audio payload | bytes=${result.arrayBuffer?.byteLength || result.blob?.size || 'unknown'} | audioUrl=${!!result.audioUrl}`)

        const playFallbackAudio = () => {
          if (!result.audioUrl) {
            console.error('[CyberShield VoiceTTS] playFallbackAudio: missing audioUrl')
            if (onError) onError({ code: 'PLAYBACK_ERROR', language, message: 'Audio playback failed' })
            return
          }
          try {
            console.log('[CyberShield VoiceTTS] Playing via HTMLAudioElement fallback...')
            const audio = new Audio(result.audioUrl)
            activeAudio = audio

            audio.onplay = () => {
              console.log('[CyberShield VoiceTTS] HTMLAudioElement: onplay event fired')
              if (onStart) onStart({ engine: 'offline_mms', language })
            }
            audio.onended = () => {
              console.log('[CyberShield VoiceTTS] HTMLAudioElement: onended event fired')
              if (activeAudio === audio) activeAudio = null
              try { URL.revokeObjectURL(result.audioUrl) } catch {}
              if (onEnd) onEnd()
            }
            audio.onerror = (e) => {
              console.error('[CyberShield VoiceTTS] HTMLAudioElement: onerror event', e)
              if (activeAudio === audio) activeAudio = null
              try { URL.revokeObjectURL(result.audioUrl) } catch {}
              if (onError) {
                onError({
                  code: 'PLAYBACK_ERROR',
                  language,
                  event: e,
                  message: language === 'om'
                    ? 'Sagalee taphachiisuun hin danda\'amne.'
                    : 'ድምጹን ማጫወት አልተቻለም።',
                })
              }
            }

            audio.play().catch((err) => {
              console.error('[CyberShield VoiceTTS] HTMLAudioElement.play() rejected:', err)
              if (activeAudio === audio) activeAudio = null
              if (onError) onError({ code: 'PLAYBACK_ERROR', language, message: err.message || 'Audio playback failed' })
            })
          } catch (err) {
            console.error('[CyberShield VoiceTTS] HTMLAudioElement initialization error:', err)
            if (onError) onError({ code: 'PLAYBACK_ERROR', language, message: err.message || 'Audio playback failed' })
          }
        }

        // Web Audio API primary playback: bypasses browser transient activation expiration
        const audioCtx = getAudioContext()
        if (audioCtx && result.arrayBuffer) {
          try {
            console.log(`[CyberShield VoiceTTS] AudioContext initial state: ${audioCtx.state}`)
            if (audioCtx.state === 'suspended') {
              console.log('[CyberShield VoiceTTS] AudioContext is suspended, calling resume()...')
              await audioCtx.resume()
              console.log(`[CyberShield VoiceTTS] AudioContext resumed, current state: ${audioCtx.state}`)
            }

            const bufferCopy = result.arrayBuffer.slice(0)
            const decodedBuffer = await new Promise((resolve, reject) => {
              const res = audioCtx.decodeAudioData(bufferCopy, resolve, reject)
              if (res && typeof res.then === 'function') {
                res.then(resolve).catch(reject)
              }
            })

            if (isCancelled) return

            console.log(`[CyberShield VoiceTTS] Decoded audio successfully | duration=${decodedBuffer.duration.toFixed(2)}s | channels=${decodedBuffer.numberOfChannels} | rate=${decodedBuffer.sampleRate}Hz`)

            const source = audioCtx.createBufferSource()
            source.buffer = decodedBuffer

            const gainNode = audioCtx.createGain()
            gainNode.gain.value = 1.0
            source.connect(gainNode)
            gainNode.connect(audioCtx.destination)

            activeSourceNode = source
            activeGainNode = gainNode

            source.onended = () => {
              console.log('[CyberShield VoiceTTS] Web Audio source node onended event fired')
              if (activeSourceNode === source) {
                activeSourceNode = null
                activeGainNode = null
              }
              if (result.audioUrl) {
                try { URL.revokeObjectURL(result.audioUrl) } catch {}
              }
              if (onEnd) onEnd()
            }

            if (onStart) onStart({ engine: 'offline_mms', language })
            source.start(0)
            console.log('[CyberShield VoiceTTS] Web Audio source.start(0) executed successfully')
            return
          } catch (webAudioErr) {
            console.warn('[CyberShield VoiceTTS] Web Audio API playback failed, falling back to HTMLAudioElement:', webAudioErr)
            playFallbackAudio()
            return
          }
        }

        playFallbackAudio()
        return
      }

      // Check specific error code returned from backend
      const errDetail = result?.error
      const errorCode = errDetail?.code || (result?.status === 503 ? 'TTS_MODEL_NOT_INSTALLED' : 'SYNTHESIS_FAILED')
      const errorMessage = errDetail?.message || (
        errorCode === 'TTS_MODEL_NOT_INSTALLED'
          ? (language === 'om' ? 'Moodeelli sagalee Afaan Oromoo hin fe\'amne.' : 'የአማርኛ ድምጽ ሞዴል አልተጫነም።')
          : (language === 'om' ? 'Waraabbiin sagalee hin milkoofne.' : 'የድምጽ ቅንብር አልተሳካም።')
      )

      if (onError) {
        onError({
          code: errorCode,
          language,
          message: errorMessage,
        })
      }
    })
    .catch((err) => {
      if (isCancelled) return
      if (onError) {
        onError({
          code: 'OFFLINE_UNAVAILABLE',
          language,
          message: err.message || (language === 'om'
            ? 'Tajaajilli sagalee sarara irraa hin argamne.'
            : 'ከመስመር ውጭ የድምጽ አገልግሎት አልተገኘም።'),
        })
      }
    })

  return {
    cancel: () => {
      isCancelled = true
      stopSpeaking()
    },
  }
}

/**
 * Speaks text using the Layered Voice Architecture:
 * - English ('en'): synthesizes via browser window.speechSynthesis.
 * - Amharic ('am') & Afaan Oromoo ('om'): synthesizes via offline backend MMS VITS.
 * - Online Mekdes: available only if explicitly chosen and connected.
 * - Strict isolation: never substitutes English speech for Amharic or Afaan Oromoo.
 */
export function speakText({
  text,
  lang = 'en',
  voices = [],
  onStart,
  onEnd,
  onError,
  fallbackOffline = false,
  preferredProvider = 'auto',
}) {
  stopSpeaking() // Stop any previous playback (SpeechSynthesis, Web Audio, or HTMLAudioElement)
  unlockAudioContext() // Synchronously unlock AudioContext inside user click activation

  const targetLang = resolveSpeechLanguage(text, lang)
  const clean = cleanTextForSpeech(text, targetLang)
  if (!clean) {
    if (onEnd) onEnd()
    return null
  }

  const availableVoices = (voices && voices.length > 0)
    ? voices
    : (isSpeechSynthesisSupported() ? (window.speechSynthesis.getVoices() || []) : [])

  const matchedVoice = getVoiceForLanguage(targetLang, availableVoices)
  const forceOffline = (preferredProvider === 'offline_mms')

  // When offline synthesis is requested (fallbackOffline === true) for non-English:
  // For 'am': Use genuine natural female voice (Microsoft መቅደስ Online) when available unless user explicitly chose offline MMS.
  // For 'om': Always prioritize offline MMS (no browser native voice exists).
  const shouldUseOfflineDirectly = fallbackOffline && (
    targetLang === 'om' ||
    (targetLang === 'am' && forceOffline)
  )

  // LAYER A: Browser Native Speech Synthesis (when supported, matched, and offline direct not forced)
  if (!shouldUseOfflineDirectly && matchedVoice && isSpeechSynthesisSupported()) {
    const synth = window.speechSynthesis
    const utterance = new window.SpeechSynthesisUtterance(clean)
    utterance.voice = matchedVoice
    utterance.lang = matchedVoice.lang

    utterance.rate = 1.0
    utterance.pitch = 1.0

    activeUtterance = utterance

    utterance.onstart = () => {
      if (onStart) onStart({ engine: 'browser_native', voice: matchedVoice.name, language: targetLang })
    }
    utterance.onend = () => {
      if (activeUtterance === utterance) activeUtterance = null
      if (onEnd) onEnd()
    }
    utterance.onerror = (e) => {
      if (activeUtterance === utterance) activeUtterance = null
      // Graceful fallback: If online voice fails (e.g. offline network disconnect for Microsoft መቅደስ Online),
      // seamlessly synthesize via local offline MMS
      if (fallbackOffline && (targetLang === 'am' || targetLang === 'om')) {
        playOfflineSpeech({ text: clean, language: targetLang, onStart, onEnd, onError })
        return
      }
      if (onError) onError({ code: 'SYNTHESIS_ERROR', language: targetLang, event: e, message: e.error || 'Speech playback failed' })
    }

    synth.speak(utterance)
    return utterance
  }

  // English without explicit matchedVoice: default browser voice
  if (targetLang === 'en') {
    if (!isSpeechSynthesisSupported()) {
      if (onError) onError({ code: 'NOT_SUPPORTED', language: 'en', message: 'Speech synthesis is not supported on this device.' })
      return null
    }
    const synth = window.speechSynthesis
    const utterance = new window.SpeechSynthesisUtterance(clean)
    utterance.lang = 'en-US'
    utterance.rate = 1.0
    utterance.pitch = 1.0

    activeUtterance = utterance

    utterance.onstart = () => {
      if (onStart) onStart({ engine: 'browser_native', language: 'en' })
    }
    utterance.onend = () => {
      if (activeUtterance === utterance) activeUtterance = null
      if (onEnd) onEnd()
    }
    utterance.onerror = (e) => {
      if (activeUtterance === utterance) activeUtterance = null
      if (onError) onError({ code: 'SYNTHESIS_ERROR', language: 'en', event: e, message: e.error || 'Speech playback failed' })
    }

    synth.speak(utterance)
    return utterance
  }

  // LAYER B: Attempt local offline backend synthesis if requested
  if (fallbackOffline) {
    return playOfflineSpeech({ text: clean, language: targetLang, onStart, onEnd, onError })
  }

  // LAYER C: Synchronous Honest Refusal when no genuine voice exists
  if (onError) {
    onError({
      code: 'NO_VOICE_FOR_LANGUAGE',
      language: targetLang,
      message: targetLang === 'om'
        ? 'Sagaleen Afaan Oromoo Browser keessaniin hin deeggaramu.'
        : 'ለአማርኛ ቋንቋ የተዘጋጀ የድምጽ አገልግሎት አልተገኘም።',
    })
  }
  return null
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel()
    } catch {}
  }
  if (activeUtterance) {
    activeUtterance = null
  }
  if (activeSourceNode) {
    try {
      activeSourceNode.onended = null
      activeSourceNode.stop()
      activeSourceNode.disconnect()
    } catch {}
    activeSourceNode = null
  }
  if (activeGainNode) {
    try {
      activeGainNode.disconnect()
    } catch {}
    activeGainNode = null
  }
  if (activeAudio) {
    try {
      activeAudio.onplay = null
      activeAudio.onended = null
      activeAudio.onerror = null
      activeAudio.pause()
      activeAudio.currentTime = 0
    } catch {}
    activeAudio = null
  }
}

export function pauseSpeaking() {
  if (globalAudioCtx && globalAudioCtx.state === 'running') {
    try { globalAudioCtx.suspend() } catch {}
  }
  if (activeAudio && !activeAudio.paused) {
    try { activeAudio.pause() } catch {}
  }
  if (isSpeechSynthesisSupported()) {
    try { window.speechSynthesis.pause() } catch {}
  }
}

export function resumeSpeaking() {
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    try { globalAudioCtx.resume() } catch {}
  }
  if (activeAudio && activeAudio.paused) {
    try { activeAudio.play() } catch {}
  }
  if (isSpeechSynthesisSupported()) {
    try { window.speechSynthesis.resume() } catch {}
  }
}

export function isSpeaking() {
  if (activeSourceNode) return true
  if (activeAudio && !activeAudio.paused && !activeAudio.ended) return true
  if (isSpeechSynthesisSupported() && window.speechSynthesis.speaking) return true
  return false
}

/**
 * Creates and starts a SpeechRecognition instance for speech-to-text.
 * 
 * Returns a controller object: { stop: () => void, abort: () => void }
 */
export function startSpeechRecognition({
  lang = 'en',
  onStart,
  onResult,
  onError,
  onEnd,
}) {
  if (!isSpeechRecognitionSupported()) {
    if (onError) onError({ code: 'NOT_SUPPORTED', message: 'Speech recognition is not supported in this browser.' })
    return null
  }

  const RecClass = window.SpeechRecognition || window.webkitSpeechRecognition
  let recognition = null

  if (!RecClass) {
    if (onError) onError({ code: 'NOT_SUPPORTED', message: 'Speech recognition is not supported in this browser.' })
    return null
  }

  try {
    recognition = new RecClass()
  } catch (err) {
    if (onError) onError({ code: 'INSTANTIATION_FAILED', message: err.message })
    return null
  }

  recognition.continuous = false
  recognition.interimResults = true

  // Set BCP-47 language tag
  if (lang === 'am') {
    recognition.lang = 'am-ET'
  } else if (lang === 'om') {
    recognition.lang = 'om-ET'
  } else {
    recognition.lang = 'en-US'
  }

  recognition.onstart = () => {
    if (onStart) onStart()
  }

  recognition.onresult = (event) => {
    let finalTranscript = ''
    let interimTranscript = ''

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0]?.transcript || ''
      if (event.results[i].isFinal) {
        finalTranscript += transcript
      } else {
        interimTranscript += transcript
      }
    }

    if (onResult) {
      onResult({
        transcript: finalTranscript || interimTranscript,
        isFinal: Boolean(finalTranscript),
      })
    }
  }

  recognition.onerror = (event) => {
    if (onError) {
      onError({
        code: event.error || 'RECOGNITION_ERROR',
        message: event.message || event.error,
      })
    }
  }

  recognition.onend = () => {
    if (onEnd) onEnd()
  }

  try {
    recognition.start()
  } catch (err) {
    if (onError) onError({ code: 'START_FAILED', message: err.message })
    return null
  }

  return {
    stop: () => {
      try { recognition.stop() } catch {}
    },
    abort: () => {
      try { recognition.abort() } catch {}
    },
  }
}
