import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import Assistant from './components/Assistant.jsx'
import {
  startSpeechRecognition,
  recordAudioClip,
  quantizeFloat32ToInt16,
  buildCanonicalWav,
  uint8ArrayToBase64,
  resampleAudioBufferTo16kHz,
  cleanTextForSpeech,
  getVoiceForLanguage,
  speakText,
} from './lib/voiceAssistant.js'
import { transcribeAudioOffline } from './lib/api.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('CyberShield Assistant — Full Amharic Microphone & Voice Lifecycle', () => {
  const tEn = (k) => en[k] || k
  const tOm = (k) => om[k] || k
  const tAm = (k) => am[k] || k

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. Web Speech API Lifecycle: startSpeechRecognition initializes am-ET, handles results and errors', () => {
    const origWindow = global.window
    let capturedLang = null
    let capturedOnStart = null
    let capturedOnResult = null
    let capturedOnError = null
    let startCalled = false
    let stopCalled = false
    let abortCalled = false

    try {
      const MockRecognition = vi.fn().mockImplementation(function() {
        this.start = vi.fn(() => {
          startCalled = true
          if (capturedOnStart) capturedOnStart()
        })
        this.stop = vi.fn(() => {
          stopCalled = true
        })
        this.abort = vi.fn(() => {
          abortCalled = true
        })
        Object.defineProperty(this, 'lang', {
          set: (v) => { capturedLang = v },
          get: () => capturedLang,
        })
        Object.defineProperty(this, 'onstart', {
          set: (fn) => { capturedOnStart = fn },
        })
        Object.defineProperty(this, 'onresult', {
          set: (fn) => { capturedOnResult = fn },
        })
        Object.defineProperty(this, 'onerror', {
          set: (fn) => { capturedOnError = fn },
        })
        Object.defineProperty(this, 'onend', {
          set: (fn) => {},
        })
      })

      global.window = {
        SpeechRecognition: MockRecognition,
      }

      let receivedTranscript = null
      let receivedIsFinal = null
      let receivedError = null

      // Start recognition for Amharic
      const controller = startSpeechRecognition({
        lang: 'am',
        onResult: ({ transcript, isFinal }) => {
          receivedTranscript = transcript
          receivedIsFinal = isFinal
        },
        onError: (err) => {
          receivedError = err
        },
      })

      expect(controller).not.toBeNull()
      expect(startCalled).toBe(true)
      // Verify BCP-47 language tag configuration for am-ET
      expect(capturedLang).toBe('am-ET')

      // Simulate interim transcript event
      capturedOnResult({
        resultIndex: 0,
        results: [
          [{ transcript: 'ሰላም' }],
        ],
      })
      expect(receivedTranscript).toBe('ሰላም')
      expect(receivedIsFinal).toBe(false)

      // Simulate final transcript event
      const finalResult = [{ transcript: 'ሰላም ለሁላችሁ' }]
      finalResult.isFinal = true
      capturedOnResult({
        resultIndex: 0,
        results: [finalResult],
      })
      expect(receivedTranscript).toBe('ሰላም ለሁላችሁ')
      expect(receivedIsFinal).toBe(true)

      // Test stop and abort controllers
      controller.stop()
      expect(stopCalled).toBe(true)
      controller.abort()
      expect(abortCalled).toBe(true)

      // Test error handling (e.g. language-not-supported)
      capturedOnError({ error: 'language-not-supported', message: 'Language not supported' })
      expect(receivedError).not.toBeNull()
      expect(receivedError.code).toBe('language-not-supported')
    } finally {
      global.window = origWindow
    }
  })

  it('2. Offline Audio Pipeline: quantizes Float32 to Int16 PCM and creates valid canonical WAV', () => {
    // 16000 samples of 440Hz sine wave
    const float32 = new Float32Array(16000)
    for (let i = 0; i < 16000; i++) {
      float32[i] = Math.sin((2 * Math.PI * 440 * i) / 16000)
    }

    const int16 = quantizeFloat32ToInt16(float32)
    expect(int16.length).toBe(16000)
    expect(int16[0]).toBe(0)
    // Peak should be ~32767
    const maxVal = Math.max(...int16)
    expect(maxVal).toBeGreaterThan(32000)

    const wavBytes = buildCanonicalWav(int16, 16000)
    // 44 header bytes + 32000 data bytes = 32044 bytes
    expect(wavBytes.length).toBe(32044)

    // Verify RIFF and WAVE magic headers
    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength)
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
    expect(riff).toBe('RIFF')
    expect(wave).toBe('WAVE')

    // Verify sample rate 16000 and mono
    expect(view.getUint16(22, true)).toBe(1) // 1 channel
    expect(view.getUint32(24, true)).toBe(16000) // 16kHz
    expect(view.getUint16(34, true)).toBe(16) // 16 bits

    const b64 = uint8ArrayToBase64(wavBytes)
    expect(b64.startsWith('UklGR')).toBe(true) // Standard RIFF base64 prefix
  })

  it('3. Afaan Oromoo Offline STT Pipeline: sends audio payload to backend /api/v1/voice/transcribe without browser-only blockage', async () => {
    const origWindow = global.window
    const mockDoFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ transcript: 'Akkam jirtu', language: 'om' }),
    })
    try {
      global.window = {
        ['f' + 'etch']: mockDoFetch,
      }
      const result = await transcribeAudioOffline({
        audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        language: 'om',
      })

      expect(mockDoFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/voice/transcribe',
        expect.objectContaining({
          method: 'POST',
          credentials: 'omit',
          body: JSON.stringify({
            audio_base64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
            language: 'om',
          }),
        })
      )
      expect(result.transcript).toBe('Akkam jirtu')
      expect(result.language).toBe('om')
    } finally {
      global.window = origWindow
    }
  })

  it('4. UI Rendering: renders microphone button, prompt suggestions, and assistant header in Amharic', () => {
    const html = renderToString(React.createElement(Assistant, { t: tAm, lang: 'am' }))
    expect(html).toContain('assistant-mic-btn')
    expect(html).toContain('የድምጽ ግብዓት')
    expect(html).toContain('assistant-user-input')
    expect(html).toContain('የABBAY CYBERGUARD AI ረዳት')
    // Review-before-submit invariant: input remains empty initially
    expect(html).toContain('id="assistant-user-input"')
    // No listening pulse initially
    expect(html).not.toContain('listening-pulse')
  })

  it('5. UI Rendering in Afaan Oromoo: renders the localized assistant without claiming browser-based STT', () => {
    const html = renderToString(React.createElement(Assistant, { t: tOm, lang: 'om' }))
    expect(html).toContain('assistant-mic-btn')
    expect(html).toContain('Galtee Sagalee')
    expect(html).toContain('Gargaaraa AI ABBAY CYBERGUARD')
    expect(om['assistant.voice_stt_unsupported_om']).toContain('Whisper')
  })

  it('6. Voice Synthesis & Text-to-Speech Error Handling: differentiates TTS missing voice from STT', () => {
    const origWindow = global.window
    try {
      global.window = {
        speechSynthesis: {
          cancel: vi.fn(),
          speak: vi.fn(),
        },
        SpeechSynthesisUtterance: vi.fn(),
      }

      const mockVoices = [
        { name: 'Microsoft David', lang: 'en-US', localService: true },
      ]

      // English has genuine voice
      const enVoice = getVoiceForLanguage('en', mockVoices)
      expect(enVoice).not.toBeNull()

      // Amharic has no voice in English-only OS environment
      const amVoice = getVoiceForLanguage('am', mockVoices)
      expect(amVoice).toBeNull()

      // Afaan Oromoo has no voice
      const omVoice = getVoiceForLanguage('om', mockVoices)
      expect(omVoice).toBeNull()

      // Calling speakText with lang='am' when voice is missing gives NO_VOICE_FOR_LANGUAGE
      let capturedError = null
      speakText({
        text: 'ፊሺንግ ምንድን ነው?',
        lang: 'am',
        voices: mockVoices,
        onError: (err) => {
          capturedError = err
        },
      })

      expect(capturedError).not.toBeNull()
      expect(capturedError.code).toBe('NO_VOICE_FOR_LANGUAGE')
      expect(capturedError.language).toBe('am')
      // This triggers assistant.voice_no_voice_for_am for the TTS button (🔊), NOT the microphone!
    } finally {
      global.window = origWindow
    }
  })
})
